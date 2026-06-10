---
phase: 099-workflow-skill-composition
reviewed: 2026-06-10T06:43:56Z
depth: standard
review_round: 2 (post-gap-closure re-review after plans 099-05 / 099-06)
files_reviewed: 8
files_reviewed_list:
  - backend/app/api/threads.py
  - backend/app/models/harness.py
  - backend/app/services/harness/phase_types.py
  - backend/app/services/harness/skill_snapshot.py
  - backend/app/services/task_service.py
  - backend/app/services/tool_dispatcher.py
  - backend/tests/test_096_ci_workflow_regression.py
  - backend/tests/test_099_skill_composition.py
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
status: issues
---

# Phase 099: Code Review Report (Round 2 — Post-Gap-Closure Re-Review)

**Reviewed:** 2026-06-10T06:43:56Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues (0 critical, 4 warning, 4 info)

## Summary

Fresh standard-depth re-review of all 8 Phase 099 files after gap plans 099-05
(CR-01) and 099-06 (CR-02). **Both prior criticals are verifiably resolved in the
current code** — see "Prior Criticals" below for the line-level confirmation.
The CR-02 fix is locked by a true live-chain regression test
(`test_099_snapshot_routing_live_chain`, test_096_ci_workflow_regression.py:679-808)
that drives the REAL engine → REAL `run_task_sub_agent` → REAL `dispatch_tool`
and asserts the leaf handler receives the materialized snapshot — exactly the
test class that would have caught the original structural-unreachability bug.
The CR-01 fix is locked by the reshaped `_FakeSkillsDB` two-table fake plus
`test_snapshot_materialize`'s one-upload-per-skill_files-row assertion.

The Deep-mode red line holds end-to-end: `ToolContext.skill_snapshot` defaults
`None` (tool_dispatcher.py:114), the snapshot gate is a literal no-op on `None`
(line 479) with the live-skill path below byte-unchanged, `_effective_tools` /
`_skill_block` are no-ops without a snapshot, and `run_task_sub_agent`'s new
propagation copies the parent value (None on every Deep/tasks caller). The
kickoff wiring is also sound: the materializer persist-back lands in
`workflow_definitions.definition` BEFORE the producer's `_load_run_definition`
re-read, so the snapshot genuinely reaches the live run (verified —
`create_workflow_run` does not store the JSONB itself).

No new criticals. Three prior warnings and four prior info items remain
unaddressed (the gap plans scoped only the criticals; WR-02 was explicitly
accepted in-code), and this round surfaces ONE new warning in the
materializer's persist-back seam (WR-04, cross-user write on global
definitions). Each finding below is tagged `[carried]` or `[new]`.

## Prior Criticals — Resolution Confirmed

### CR-01 (round 1) — phantom `skills.files` column read: **FIXED** (commit 7a496829)

**File:** `backend/app/services/harness/skill_snapshot.py:64, 199-205`
`_SKILL_SELECT` no longer carries a `files` token (and now carries an explicit
"Do NOT add a `files` token here" guard comment, lines 60-63). The manifest is
fetched from the real `skill_files` table
(`select("filename").eq("skill_id", str(skill_ref)).order("filename")`),
mirroring `_handle_load_skill` (tool_dispatcher.py:376-383), keyed by the
already-validated Pydantic UUID (no injection surface). Regression-locked:
`_FakeSkillsDB` (test_099_skill_composition.py:460-538) now models the real
two-table shape — skills rows carry NO `files` key; `table("skill_files")`
routes to a separate `_FakeSkillFilesQuery` matching the production fluent
chain — and `test_snapshot_materialize` asserts `len(storage.uploads) == 1`.
The residual from round 1 (pre-fix empty-manifest snapshots locked in by the
idempotency check) is documented in-code as accepted out-of-scope
(skill_snapshot.py:167-172); the dev DB likely has no such rows.

### CR-02 (round 1) — `skill_snapshot` not propagated onto `sub_ctx`: **FIXED** (commit 75b67eff)

**File:** `backend/app/services/task_service.py:626-636`
`run_task_sub_agent` now builds `sub_ctx` with
`skill_snapshot=parent_ctx.skill_snapshot`, alongside the structurally
identical 096-02 `phase_whitelist` and WR-03 `workflow_run_id` propagations,
with a comment naming the unreachability class. Deep/tasks callers carry
`None` (dataclass default) so Deep dispatch stays byte-identical. Locked by
`test_099_snapshot_routing_live_chain`, which fails pre-fix (captured snapshot
is None) and passes post-fix, asserting the leaf receives the SAME materialized
snapshot (`storage_prefix` equality) and that the run still terminalizes
completed.

## Warnings

### WR-01 [carried, unaddressed]: `validate_skill_refs` re-gates the LIVE skill on every kickoff, even for already-materialized phases — deleting/disabling the source skill bricks the published workflow

**File:** `backend/app/services/harness/skill_snapshot.py:112-124` (call site: `backend/app/api/threads.py:807-815, 931`)
**Issue:** Unchanged from round 1. The validator resolves every `skill_ref`
against the live `skills` table without skipping phases that already carry a
persisted `skill_snapshot`. After first kickoff materializes the snapshot,
deleting (or disabling) the source skill makes every subsequent kickoff 400 —
contradicting the module's own load-bearing claim ("runs identically regardless
of what happens to the source skill afterward", D-01: determinism beats
freshness). The snapshot then protects only against edits, not delete/disable.
Visibility variant: a global definition materialized by the skill author 400s
for every other user, because validate re-checks live visibility against the
kicker's `user_id`.
**Fix:** Skip validation for phases whose `skill_snapshot` is already
materialized:
```python
if skill_ref is None or getattr(phase.config, "skill_snapshot", None) is not None:
    continue  # snapshotted — the immutable copy is the authority (D-01)
```
If disable-as-kill-switch is intended, keep an `is_enabled`-only re-check for
snapshotted phases and record the decision (it changes D-01 semantics). Either
way, document the chosen trade-off — it is currently silent.

### WR-02 [carried — explicitly accepted in-code; needs recorded operator sign-off or the one-line wrap]: blocking Storage `.download()` on the event loop in the NEW snapshot read branch

**File:** `backend/app/services/tool_dispatcher.py:486-488`
**Issue:** The snapshot branch of `_handle_read_skill_file` still calls
`ctx.supabase.storage.from_("skill-files").download(storage_path)` directly in
the async handler — blocking HTTP on the event loop (D-v2.5-01 violation). The
gap closure added a comment accepting this ("Un-wrapped .download() for
byte-symmetry with the live path (Open Question 4 — single small file)").
Two problems with the rationale: (a) `run_in_threadpool` changes scheduling,
not bytes — wrapping ONLY the new branch leaves the frozen live path (line 523)
byte-identical; (b) "single small file" is not guaranteed — skill files include
docx/xlsx/pptx that can be multi-MB, and against cloud Supabase a slow download
stalls every SSE stream and concurrent run on that worker, mid-workflow on the
hot dispatch path. The same module's materializer correctly threadpool-wraps
its Storage calls (skill_snapshot.py:212-224).
**Fix:** Wrap the new branch only (`run_in_threadpool` is already imported at
line 26):
```python
raw_bytes = await run_in_threadpool(
    lambda: ctx.supabase.storage.from_("skill-files").download(storage_path)
)
```
If the Open-Question-4 acceptance stands, record it in 099-VERIFICATION so the
override is auditable rather than living only in a code comment.

### WR-03 [carried, unaddressed]: unvalidated `definition.slug` flows into a service-role Storage object key

**File:** `backend/app/services/harness/skill_snapshot.py:206-207` (model: `backend/app/models/harness.py:174`)
**Issue:** Unchanged from round 1. The snapshot prefix is
`f"{user_id}/_snapshots/{definition.slug}-v{definition.version}/{skill_ref}"`.
`skill_ref` is a Pydantic UUID (safe) and the leading `{user_id}` segment is
server-controlled, but `WorkflowDefinition.slug` is a plain unconstrained
`str`. A slug containing `/` or `..` shapes the object key under the
service-role storage client (RLS bypassed), and HTTP clients normalize dot
segments in URL paths — a crafted slug could redirect the snapshot upload
outside the author's prefix. Exploitability today is low (slugs are
operator-seeded; no self-serve publish), but Phase 103 adds publish and this
prefix is the declared seam (T-099-03). Filenames in the copy loop have the
same exposure (the skills upload endpoint stores raw `file.filename`).
**Fix:** Constrain at the model
(`slug: str = Field(pattern=r"^[a-z0-9][a-z0-9_-]*$")` — also consider
`PhaseSpec.slug`), or defensively reject `/` and `..` in
`materialize_skill_snapshots` before building the prefix; basename-validate
filenames in the copy loop.

### WR-04 [new]: materializer persist-back lets a non-owner mutate a shared GLOBAL definition row and pins the snapshot under the first runner's storage prefix

**File:** `backend/app/services/harness/skill_snapshot.py:206-207, 242-248` (call site: `backend/app/api/threads.py:883-887, 931-937`)
**Issue:** The kickoff resolve admits `is_global.eq.true` definitions
(threads.py:887) and `get_supabase` is the service-role client (RLS bypassed,
dependencies.py:19), so the persist-back
`update({"definition": ...}).eq("id", definition_id)` succeeds for a definition
the kicking user does NOT own — there is no ownership predicate on the UPDATE.
For a global, skill-bearing workflow:
1. The FIRST user to kick it off writes their materialized snapshot into the
   shared global row (a non-owner mutating a shared resource).
2. The persisted `storage_prefix` is rooted at that first runner's id
   (`{user_id}/_snapshots/...`). The idempotency check then locks it in: every
   other user's runs read from an arbitrary third user's storage prefix
   forever. If that account/storage is later purged, the global workflow
   silently breaks for everyone (`read_skill_file` → "not found in snapshot").
3. It inverts the T-099-03 assumption that the prefix's first segment grants
   the *author* RLS read — the definition author cannot read a snapshot prefix
   rooted at someone else's id.
T-099-03 documents the READ side for Phase 109; this WRITE side is unaddressed.
Practical exposure today is low (global skill-bearing definitions don't exist
yet), but the path is fully reachable with current code.
**Fix:** When the definition is global and `created_by != user_id`, either
(a) fail closed ("global workflow not yet materialized by its owner"), or
(b) root the snapshot prefix at the *definition owner's* id and restrict the
persist-back to the owner (e.g. `.eq("created_by", ...)` or owner-only
materialization). At minimum, document this next to T-099-03 so Phase 109
inherits both halves of the seam. (Related: the WR-01 visibility variant means
non-author kickoffs of such a definition currently 400 anyway when the skill is
private — the interaction between these two findings should be resolved
together.)

## Info

### IN-01 [carried]: `_skill_block` manifest derivation disagrees with `_effective_tools` for a snapshot-bearing phase with empty `available_tools`

**File:** `backend/app/services/harness/phase_types.py:166-169` (vs `:186-190`)
**Issue:** An `llm_agent`/`llm_batch_agents` phase with `available_tools=[]`
plus a snapshot gets `read_skill_file` auto-whitelisted by `_effective_tools`
(the tool is live for the model), but `_skill_block`'s derive treats empty
`available_tools` as "no tools" and omits the file manifest — the model can
call the tool but is never told which files exist.
**Fix:** Derive from the effective list: `_no_tools = not _effective_tools(phase)`
(keeping the `llm_single` omission), or skip the auto-whitelist when
`available_tools` is empty so the two helpers agree.

### IN-02 [carried]: snapshot branch captures ALL `read_skill_file` calls in the phase, ignoring `skill_name`; `SkillSnapshot.name` comment claims routing-by-name

**File:** `backend/app/services/tool_dispatcher.py:478-492` (vs `backend/app/models/harness.py:44`)
**Issue:** With a snapshot present, every `read_skill_file` call routes to the
snapshot manifest regardless of the `skill_name` argument. A phase that also
whitelists `load_skill` lets the agent load a *different* live skill and learn
its file list — but every read is then rejected ("not in the workflow's skill
snapshot") without explanation. Fail-closed and safe, but the model field
comment ("read_skill_file routing-by-name within the phase") does not match the
implementation, and the rejection message doesn't name the snapshot skill.
**Fix:** Document the capture in the gate comment, fix the model comment, and
include the snapshot's name in the rejection (e.g.
`f"File '{filename}' not in the workflow's skill snapshot for '{snapshot.name}'."`)
so the agent self-corrects.

### IN-03 [carried]: first-kickoff materialization race — unconditional whole-JSONB persist, no CAS

**File:** `backend/app/services/harness/skill_snapshot.py:242-248`
**Issue:** With `WORKER_COUNT=2`, two concurrent first-kickoffs of the same
definition can both see "no snapshot", both materialize, and both run the
unguarded `.update({"definition": ...})` — last write wins; if the live skill
is edited between them the two runs diverge once (a one-shot D-01 violation),
and the blanket update can clobber a concurrent definition edit. Same CAS-shaped
gap class the Phase 091 review caught on run state.
**Fix:** Optimistic guard on the persist-back (re-read + compare, or a JSONB
predicate that the targeted phase's `skill_snapshot` is still null); on a lost
race, re-fetch and adopt the winner's persisted snapshot.

### IN-04 [carried]: stale "RED-by-design / xfail" module docstring in the 099 test file

**File:** `backend/tests/test_099_skill_composition.py:14-16`
**Issue:** The module docstring still says the Plan 02/03/04 tests "are marked
xfail (strict=False) so the full suite stays exit-0", but no test carries an
xfail marker any more (each is annotated "GREEN — Plan 0X landed"). A future
reader auditing suite health will mis-read the file's pass/fail contract.
**Fix:** Update the docstring to state all tests are green as of Plans 02-06.

---

## Red-Line Verification (Deep-mode byte-identity)

- `ToolContext.skill_snapshot: Any = None` (tool_dispatcher.py:114) — no Deep caller sets it; locked by `test_toolcontext_field_default_none`.
- `_handle_read_skill_file` gate is `if snapshot is not None` (line 479); the live-skill resolution below is byte-unchanged; `_decode_skill_file_bytes` is a pure extraction shared by both paths.
- `_effective_tools` returns `list(available_tools)` unchanged without a snapshot (phase_types.py:186-190); never drops a tool.
- `_skill_block` returns `""` without a snapshot (phase_types.py:162-163); composed BEFORE `_retry_suffix` in all three LLM executors.
- `run_task_sub_agent` propagates `parent_ctx.skill_snapshot` — `None` for every Deep/tasks caller (task_service.py:636).
- `WorkflowDefinition` structural validator rejects snapshot-without-ref (models/harness.py:203-217); pre-099 JSONB rows validate to defaults under `extra="forbid"` (zero-migration, locked by `test_skill_ref_additive_optional`).
- Kickoff seam (`_ensure_skill_snapshots`, threads.py:787-822) is a thin module-object delegation (G-5 honored; the seam stays patchable — exercised by `test_kickoff_snapshot_wiring`'s ValueError→400 contract). A no-skill workflow is a validate no-op + materialize-unchanged.
- Wiring round-trip verified cross-file: the persist-back updates `workflow_definitions.definition` before the producer spawns; `_load_run_definition` (harness_engine.py:1048-1064) reads that same row via the `workflow_runs.definition_id` JOIN, so the materialized snapshot reaches the live run AND both resume paths (startup sweep + Continue) with no further wiring.

---

_Reviewed: 2026-06-10T06:43:56Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
