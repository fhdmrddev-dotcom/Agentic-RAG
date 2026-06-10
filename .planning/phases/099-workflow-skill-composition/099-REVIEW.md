---
phase: 099-workflow-skill-composition
reviewed: 2026-06-10T00:16:33Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - backend/app/api/threads.py
  - backend/app/models/harness.py
  - backend/app/services/harness/phase_types.py
  - backend/app/services/harness/skill_snapshot.py
  - backend/app/services/tool_dispatcher.py
  - backend/tests/test_099_skill_composition.py
findings:
  critical: 2
  warning: 3
  info: 4
  total: 9
status: issues_found
---

# Phase 099: Code Review Report

**Reviewed:** 2026-06-10T00:16:33Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Reviewed the Phase 099 workflow↔skill composition diff (`bab85e8c..HEAD`) across the 6 listed files, scoped to the 099 additions. The five critical invariants were checked explicitly:

1. **Deep-mode byte-identical (no snapshot → no-op):** HOLDS. `_skill_block` returns `""` and `_effective_tools` returns `available_tools` unchanged when no snapshot; `ToolContext.skill_snapshot` defaults to `None`, and `_decode_skill_file_bytes` is a byte-identical extraction of the pre-099 inline decode block (verified against the diff).
2. **No IDOR/existence leak in `validate_skill_refs`:** HOLDS. The resolve query is owned-or-global + `is_enabled` with the ref as a Pydantic-validated UUID (no injection surface); the `ValueError` message is generic and only echoes the ref the caller's own definition already contains.
3. **No blocking supabase-py I/O in async paths:** VIOLATED in one new spot — the snapshot read branch's un-wrapped Storage `.download()` (WR-02). All DB queries go through `aexec`, and the materializer's Storage calls are correctly `run_in_threadpool`-wrapped.
4. **Author-scoped snapshot prefix:** HOLDS structurally (`{user_id}/` is always the first segment), but `definition.slug` is an unconstrained `str` interpolated into a service-role storage key — hardening gap ahead of the Phase 103 publish surface (WR-03).
5. **Pre-099 JSONB rows still `model_validate`:** HOLDS. All new fields are additive-optional with defaults under `extra="forbid"`, and the test covers the zero-migration shape.

However, two critical integration defects make the **file half** of the feature non-functional in production while passing the offline test suite — both are mock-masking failures of exactly the class `feedback_mock_completeness` and the 096-02 `phase_whitelist` wiring fix warned about: the materializer reads a `files` column that does not exist on the `skills` table (CR-01), and the materialized snapshot never reaches `dispatch_tool` on the live harness path because `task_service.py`'s `sub_ctx` does not propagate it (CR-02). The skill-instructions half (prompt framing) composes correctly.

## Critical Issues

### CR-01: Snapshot file manifest is always empty in production — `files` is not a column on `skills`

**File:** `backend/app/services/harness/skill_snapshot.py:185` (also `:60`)
**Issue:** `materialize_skill_snapshots` builds the manifest from `filenames = list(row.get("files") or [])`, but the row comes from `_resolve_skill_query`, whose select list (`_SKILL_SELECT`, line 60: `"id, name, description, instructions, user_id, is_enabled, is_global"`) does not include `files` — and the `skills` table has no `files` column at all (`supabase/migrations/017_skills.sql`). Filenames live in the separate `skill_files` table, which is exactly how the live path fetches them (`_handle_load_skill`, `tool_dispatcher.py:375-381`). In production, every snapshot therefore materializes with `files: []`: **zero Storage copies happen, the prompt never lists a manifest, and every `read_skill_file` call in a snapshot phase is rejected** ("not in the workflow's skill snapshot"). Worse, the empty snapshot is **persisted permanently** into `workflow_definitions.definition` JSONB, and the idempotency check (`skill_snapshot is not None → skip`) then locks it in: any definition that first-kicks-off before a fix keeps the empty manifest forever, even after the code is fixed — if the live skill is later edited/deleted, its files are unrecoverable for that workflow, which is precisely the loss D-01/D-02 exist to prevent. The bug is masked by `_FakeSkillsDB` rows carrying a `files` key that the real schema doesn't have (`test_099_skill_composition.py:370, 394`).
**Fix:** Query `skill_files` for the manifest, mirroring `_handle_load_skill`:
```python
_files_resp = await aexec(
    supabase.table("skill_files")
    .select("filename")
    .eq("skill_id", str(skill_ref))
    .order("filename")
)
filenames = [f["filename"] for f in (_files_resp.data or [])]
```
Also basename-validate each filename before building `src_path`/`dst_path` (see WR-03), and update the test fakes to model the real two-table shape (`skills` + `skill_files`) so the fake can't carry a column production doesn't have. For already-persisted empty snapshots, consider a one-off re-materialization sweep (or treat `files == [] and live skill_files non-empty` as un-materialized).

### CR-02: `skill_snapshot` never reaches `dispatch_tool` on the live harness path — the snapshot-gated read branch is structurally unreachable

**File:** `backend/app/services/harness/phase_types.py:271` (root cause: `backend/app/services/task_service.py:585-626`)
**Issue:** `_build_phase_tool_context` attaches the snapshot to the **parent** phase ctx (`skill_snapshot=getattr(phase.config, "skill_snapshot", None)`), but the only two call sites (`phase_types.py:359, 449` — `_exec_llm_agent` / `_exec_llm_batch_agents`, the only phase types where `read_skill_file` is live) hand that ctx to `run_task_sub_agent`, which rebuilds a fresh `sub_ctx = ToolContext(...)` (`task_service.py:585`) — and every harness tool call dispatches with `sub_ctx`. That construction explicitly propagates `phase_whitelist` and `workflow_run_id` but **not** `skill_snapshot`, so it defaults to `None` and `_handle_read_skill_file` always falls through to the **live-skill path**. This is the identical structural-unreachability bug the 096-02 wiring fix documents in the adjacent comment for `phase_whitelist` ("the harness phase-ctx builder sets it on the PARENT ctx only, but every harness tool call dispatches with sub_ctx"). Consequences: D-01 immutability is silently broken (reads track the live skill, so a mid-run or post-publish skill edit changes a published run; a deleted/renamed skill breaks the run mid-phase), and the snapshot-routing branch in `tool_dispatcher.py:478-490` is dead code on the live path. `test_snapshot_routing` masks this by injecting the snapshot directly onto the handler's ctx instead of exercising the sub-agent dispatch chain.
**Fix:** Propagate the field in the `sub_ctx` construction (task_service.py, alongside `workflow_run_id`):
```python
        # 099 D-04 — propagate the materialized snapshot onto the SUB-agent ctx,
        # where dispatch_tool actually runs (same unreachability class as the
        # 096-02 phase_whitelist fix above). None (Deep/tasks callers) => no-op.
        skill_snapshot=parent_ctx.skill_snapshot,
```
Add a regression test mirroring `test_096_whitelist_refusal`'s shape: assert the `sub_ctx` built by `run_task_sub_agent` carries the parent's `skill_snapshot`.

## Warnings

### WR-01: `validate_skill_refs` re-gates the LIVE skill on every kickoff, even when the snapshot already exists — deleting the source skill bricks the published workflow

**File:** `backend/app/services/harness/skill_snapshot.py:95-120` (call site: `backend/app/api/threads.py:805-811, 931`)
**Issue:** `_ensure_skill_snapshots` runs `validate_skill_refs` unconditionally before the (idempotent) materializer. The validator resolves every `skill_ref` against the **live** `skills` table — it does not skip phases that already carry a persisted `skill_snapshot`. So after the first kickoff materializes the snapshot, deleting (or disabling) the source skill makes **every subsequent kickoff fail with 400**, directly contradicting the module's own load-bearing claim ("a published workflow runs *identically regardless of what happens to the source skill afterward* — determinism beats freshness", lines 3-5 / D-01). The snapshot then only protects against edits, not delete/disable. There is also a visibility variant: a global definition whose snapshot was materialized by the skill author will 400 for every other user, because validate re-checks live visibility against the *kicker's* `user_id`. Disable-as-kill-switch may be intentional — but delete-bricks-the-workflow defeats the phase's stated purpose, and nothing in the code or docs declares this trade-off.
**Fix:** Validate only un-materialized refs (the same predicate the materializer already uses):
```python
for phase in definition.phases:
    skill_ref = getattr(phase.config, "skill_ref", None)
    if skill_ref is None or getattr(phase.config, "skill_snapshot", None) is not None:
        continue  # already snapshotted — the immutable copy is the authority (D-01)
    ...
```
If disable-as-kill-switch is wanted, keep an `is_enabled`-only re-check for snapshotted phases and record the decision (it changes D-01 semantics).

### WR-02: New un-wrapped blocking Storage `.download()` inside the async dispatch handler

**File:** `backend/app/services/tool_dispatcher.py:488`
**Issue:** The new snapshot branch of `_handle_read_skill_file` calls `ctx.supabase.storage.from_("skill-files").download(storage_path)` directly in the async handler — blocking HTTP on the event loop, violating the project rule "Do not run blocking I/O directly inside async handlers — wrap with run_in_threadpool" (D-v2.5-01) and review invariant 3. The in-code justification ("byte-symmetry with the live path") doesn't hold: `run_in_threadpool` changes scheduling, not bytes, and the live path's un-wrapped download (line 523) is pre-existing debt that new 099 code shouldn't extend. A slow or large snapshot download stalls every concurrent stream on that worker.
**Fix:**
```python
raw_bytes = await run_in_threadpool(
    lambda: ctx.supabase.storage.from_("skill-files").download(storage_path)
)
```
(Optionally wrap the pre-existing live-path download at line 523 in the same change — same handler, same risk.)

### WR-03: Unvalidated `definition.slug` flows into a service-role Storage object key

**File:** `backend/app/services/harness/skill_snapshot.py:186-188` (model: `backend/app/models/harness.py:174`)
**Issue:** The snapshot prefix is `f"{user_id}/_snapshots/{definition.slug}-v{definition.version}/{skill_ref}"`. `skill_ref` is a Pydantic UUID (safe) and the leading `{user_id}` segment preserves the 017 first-segment RLS scoping — but `WorkflowDefinition.slug` is a plain unconstrained `str`. A slug containing `/` or `..` shapes the object key under the **service-role** storage client (RLS bypassed), and HTTP clients normalize dot segments in URL paths, so a crafted slug (e.g. `x/../../{victim_id}/{skill_id}`) could redirect the snapshot **upload** outside the author's prefix. Today exploitability is low — there is no self-serve publish path, so slugs are operator-seeded — but Phase 103 adds publish, and this is exactly review invariant 4. The same hardening applies to filenames once CR-01's fix sources them from `skill_files`: the upload endpoint stores raw `file.filename` (`backend/app/api/skills.py:441`, no `os.path.basename` — unlike the import path at `:223`).
**Fix:** Constrain the slug at the model (`slug: str = Field(pattern=r"^[a-z0-9][a-z0-9_-]*$")` on `WorkflowDefinition` — also locks phase slugs if applied to `PhaseSpec.slug`), or defensively reject `"/"`/`".."` in `materialize_skill_snapshots` before building the prefix; basename-validate filenames in the copy loop.

## Info

### IN-01: `_skill_block` manifest-derivation disagrees with `_effective_tools` for a tool-bearing phase with empty `available_tools`

**File:** `backend/app/services/harness/phase_types.py:163-169` (vs `:186-190`)
**Issue:** For an `llm_agent`/`llm_batch_agents` phase with `available_tools=[]` and a snapshot, `_effective_tools` still appends `read_skill_file` (the tool is live for the model), but `_skill_block`'s derive treats empty `available_tools` as "no tools" and omits the file manifest — the agent can call the tool but is never told which files exist (and has no `load_skill` to discover them).
**Fix:** Derive from the effective list: `_no_tools = not _effective_tools(phase)` (or skip the auto-whitelist when `available_tools` is empty, matching the derive).

### IN-02: Snapshot branch captures ALL `read_skill_file` calls in a skill-bearing phase, regardless of `skill_name`

**File:** `backend/app/services/tool_dispatcher.py:478-490`
**Issue:** The gate ignores the `skill_name` argument entirely. A phase that whitelists `load_skill` alongside a `skill_ref` lets the agent load a *different* live skill and obtain its file list — but every `read_skill_file` call then routes to the snapshot manifest and is rejected. Intentional immutability is defensible, but it's an undocumented behavior change for that tool combination, and the error message doesn't explain it.
**Fix:** Document the capture in the gate comment and include the snapshot's skill name in the rejection message (e.g. `"File '{filename}' not in the workflow's skill snapshot for '{snapshot.name}'."`) so the agent self-corrects instead of retrying other skill names.

### IN-03: First-kickoff materialization race — unconditional whole-JSONB persist, no CAS

**File:** `backend/app/services/harness/skill_snapshot.py:222-228`
**Issue:** With `WORKER_COUNT=2`, two concurrent first-kickoffs of the same definition can both see "no snapshot", both materialize, and both run the unguarded `.update({"definition": ...})` — last write wins, and if the live skill is edited between them, the two runs diverge once (a one-shot D-01 violation). The blanket update can also clobber a concurrent edit to the definition row. The Phase 091 review caught the same CAS-shaped gap on run state.
**Fix:** Make the persist-back conditional (optimistic CAS), e.g. add `.eq("status", "published")` plus a JSONB guard that the targeted phase's `skill_snapshot` is still null (or re-read + compare before update); on lost race, re-fetch and use the winner's persisted snapshot.

### IN-04: Stale test-module docstring — tests are green but the header still says "xfail (strict=False) RED-by-design"

**File:** `backend/tests/test_099_skill_composition.py:14-16`
**Issue:** The module docstring documents the Plan 02/03/04 tests as xfail-marked cross-plan TDD stubs, but no test in the file carries an xfail marker any more (each is annotated "GREEN — landed"). A future reader auditing suite health will mis-read the file's pass/fail contract.
**Fix:** Update the docstring to state all tests are green as of Plans 02-04 landing.

---

_Reviewed: 2026-06-10T00:16:33Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
