---
phase: 120-collision-fix-context-isolation
reviewed: 2026-06-22T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - backend/app/services/sandbox_service.py
  - backend/app/services/tool_dispatcher.py
  - backend/app/db/runs.py
  - backend/app/services/agent_loop.py
  - backend/app/services/harness_engine.py
  - backend/app/services/harness/phase_types.py
  - backend/app/api/runs.py
  - supabase/migrations/076_messages_origin.sql
  - backend/tests/unit/test_120_collision_regression.py
  - backend/tests/test_120_origin_filter.py
  - backend/tests/integration/test_120_migration.py
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 120: Code Review Report

**Reviewed:** 2026-06-22
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Phase 120 ships two changes: **COLL-01** (run-scope the sandbox-output harvest via a
once-per-run SHA-256 baseline seed so a Deep/Harness run emits only files it created)
and **CTX-01** (a `messages.origin` column + asymmetric origin history filter so a Deep
turn never replays a workflow's rows and vice-versa).

The four security-critical CTX-01 properties from the phase brief all hold:

1. **Raw SQL INSERT does not f-string origin** — `harness_engine.py:227-241` binds origin
   as positional `$4`; `db/runs.py:179` binds it as `$10`. No string interpolation of the
   value anywhere. ✅
2. **Owner/thread scope never relaxed** — the history query at `agent_loop.py:1056-1057`
   keeps `.eq("thread_id", thread_id)` + `.eq("user_id", current_user["id"])`, and
   `_apply_origin_filter` only chains a `neq`/`eq` on top (never replaces the builder). ✅
3. **origin not in projection** — `agent_loop.py:1055` selects
   `"role, content, tool_calls, reasoning_content"`; origin is a pure WHERE clause. ✅
4. **No harness insert site missed** — I enumerated EVERY `messages` insert across the
   backend (`harness_engine.py` raw + 2 helper calls + disposition ask_user,
   `phase_types.py` llm_human_input, `api/runs.py` workflow-fallback) and confirmed each
   harness-originating row is tagged `'harness'`. The Deep-only sites
   (`tool_dispatcher._handle_ask_user`, `agent_loop.persist_cap_paused`,
   `agent_loop._persist_system_messages`, the Deep `_persist_assistant_message`, the user
   message insert at `threads.py:1020`) correctly default to `'deep'` because they are
   **unreachable from the harness path** (producer branches `if _active_workflow_run_id:
   run_workflow else: run_agent_loop` at `threads.py:1304`; `ask_user` is in
   `_SUB_AGENT_EXCLUDED` at `tool_dispatcher.py:2256` so harness sub-agents cannot reach
   the Deep ask_user handler). ✅

COLL-01 is sound: `snapshot_output_baseline` mirrors the harvest container-I/O idiom,
returns the exact `{content_hash: meta}` shape `harvest_output_files` consumes, never
clears `/sandbox/output/` (D-120-02), and is `run_in_threadpool`-wrapped behind a
once-per-run `ctx._output_baseline_seeded` guard. Migration 076 is idempotent
(`ADD COLUMN IF NOT EXISTS` + `DROP CONSTRAINT IF EXISTS` before re-add), applied, and
the regenerated `full-schema.sql:615-616` matches.

No BLOCKERs. Three WARNINGs (one latent read-side asymmetry, one harvest UX quirk, one
guard-robustness gap) and four INFO items follow.

## Warnings

### WR-01: Read-side origin filter keys on `body.agent_mode`, which is never `"harness"` — the `eq` branch is dead and the write/read keys are asymmetric

**File:** `backend/app/services/agent_loop.py:743-745` (and call site `:1059`)
**Issue:**
`_apply_origin_filter(history_q, agent_mode)` returns the harness branch
(`eq("origin","harness")`) only when `agent_mode == "harness"`. But the read-side key is
`body.agent_mode`, and `MessageCreate.agent_mode` is declared
`agent_mode: str = "default"   # "default" | "explorer"` (`backend/app/models/message.py:12`)
— there is **no `"harness"` enum value**, and nothing in the request path ever sets it to
`"harness"`. Meanwhile the WRITE-side mode decision (Deep vs Harness) is keyed on a
DIFFERENT signal entirely: `_active_workflow_run_id is not None` (`threads.py:1304`) and
`mode = "harness" if active_workflow_run_id is not None else "deep"` (`threads.py:1891`).

Consequences:
- The harness branch of `_apply_origin_filter` (`eq("origin","harness")`) is **dead code
  in production** — it can never be reached via `body.agent_mode`. The code comments
  acknowledge "A1: the harness does not reconstruct via `messages` today; this is the one
  place `agent_mode` is evaluated against the history read," so the dead branch is
  *currently* harmless. But it is presented as a live defense-in-depth control and tested
  as if reachable (`test_harness_mode_applies_eq`), which overstates the guard.
- The write-side branch key (`_active_workflow_run_id`) and the read-side filter key
  (`body.agent_mode`) are decoupled. If a future change ever routes a harness phase
  through `run_agent_loop` (e.g. a sub-agent reconstructing thread history), it would
  silently take the Deep `neq` branch and the asymmetry becomes a real isolation gap.

The core security property (Deep never replays harness rows) DOES hold today, because the
Deep `neq("origin","harness")` branch always fires and correctly drops harness rows — so
this is a WARNING, not a BLOCKER.
**Fix:** Make the read-side key match the write-side mode signal so the two cannot drift,
and document the branch as defense-in-depth-only until a harness reader exists. Either
pass the same mode discriminator the producer computes:
```python
# threads.py — compute once, pass explicitly
_history_mode = "harness" if _active_workflow_run_id is not None else body.agent_mode
# agent_loop.run_agent_loop signature gains an explicit history_mode param
_history_q = _apply_origin_filter(_history_q, history_mode)
```
or, if the harness genuinely never reads `messages`, drop the `eq` branch and the
`test_harness_mode_applies_eq` assertion and comment the helper as
"Deep/Explorer-only — harness reconstructs from durable phase outputs, not messages."

### WR-02: `supersedes` can point at an invisible pre-run baseline file, producing a misleading "Replaces:" affordance

**File:** `backend/app/services/sandbox_service.py:352-359`
**Issue:**
`snapshot_output_baseline` seeds the per-run baseline with pre-existing files keyed by
content hash, each carrying `url: None` and `iteration: -1`. The harvest's supersedes
detection at `:352` indexes `previous_files` by filename
(`prev_by_filename = {meta["filename"]: meta ...}` at `:339`) and stamps
`delta_entry["supersedes"] = prev["filename"]` whenever a NEW-hash file shares a filename
with any prior entry — including a **seeded baseline entry**.

Scenario: a thread has a stale `report.docx` (leftover from a prior workflow) on disk at
run start → it is seeded into the baseline. A skill then regenerates `report.docx` with
different bytes. The new file is (correctly) emitted, but it carries
`supersedes: "report.docx"` pointing at the pre-run leftover the user **never saw this
run** (it was never uploaded — `url: None`). `OutputFileCard` then renders
"Replaces: report.docx" for a file with no visible predecessor. This is the inverse of
the bug COLL-01 closes: instead of re-emitting the stale file, it now annotates the real
file as superseding a phantom.

Not a correctness/security defect (the right file IS emitted), but a user-visible
honesty quirk on exactly the collision path this phase targets, and the tests don't cover
it.
**Fix:** Exclude pre-run baseline entries (`iteration == -1`) from supersedes detection so
the affordance only fires against files the run actually emitted:
```python
prev_by_filename = {
    meta["filename"]: meta
    for meta in previous_files.values()
    if meta.get("iteration", 0) != -1   # never "supersede" an unseen pre-run leftover
}
```
Add a regression test: stale `report.docx` seeded → skill regenerates same name, new
bytes → delta has the file but NO `supersedes` key.

### WR-03: `ctx._output_baseline_seeded` guard relies on a non-declared dynamic attribute and a silent `getattr` default

**File:** `backend/app/services/tool_dispatcher.py:882-885`
**Issue:**
The once-per-run seed guard reads/writes `ctx._output_baseline_seeded`, but this attribute
is **not declared on the `ToolContext` dataclass** (`tool_dispatcher.py:76-131`). It is
read via `getattr(ctx, "_output_baseline_seeded", False)` and then set with
`ctx._output_baseline_seeded = True`. Two robustness concerns:

1. If `ToolContext` were ever made `frozen=True` or `slots=True` (a plausible
   future hardening, as `RunContext` already is `frozen=True`), the assignment at `:885`
   would raise `FrozenInstanceError` / `AttributeError` and break every `execute_code`
   call — the failure would be a hard crash inside the tool handler, surfaced only at
   runtime.
2. The guard's correctness depends on the SAME `ToolContext` instance persisting across
   all cells of a run. For Deep that holds (one `ToolContext` per run is documented). For
   harness, `_build_phase_tool_context` (`phase_types.py:330`) builds a **NEW**
   `ToolContext` per phase — so a multi-phase harness run re-seeds the baseline at the
   start of every phase's first `execute_code`. That is arguably the intended D-120-03
   per-phase symmetry (the test `test_harness_phase_keeps_own_output` asserts a phase
   excludes a PRIOR phase's leftover), but the guard comment says "per-RUN scope" while
   the harness behavior is actually per-PHASE — the docstring and the harness reality
   disagree, which will mislead the next maintainer.
**Fix:** Declare the field explicitly on the dataclass so it is part of the contract and
survives a future `frozen`/`slots` change, and reconcile the comment with the per-phase
harness reality:
```python
# in ToolContext
_output_baseline_seeded: bool = False  # COLL-01 once-per-(Deep run / harness phase) seed guard
```
Then update the `:870-881` comment to say "once per Deep run OR once per harness phase
(a fresh per-phase ToolContext intentionally re-seeds — D-120-03 symmetry)."

## Info

### IN-01: `test_empty_baseline_emits_both_files_pre_fix` is named a "fails-before-fix" guard but passes both before AND after the fix

**File:** `backend/tests/unit/test_120_collision_regression.py:117-143`
**Issue:** The docstring frames this as "the fails-before-fix guard," but the test calls
`harvest_output_files(..., previous_files={})` directly with an empty baseline and asserts
both files are emitted — behavior that is identical before and after Task 2's
`snapshot_output_baseline` lands. The only thing that makes the *module* RED pre-fix is
the top-level `from ... import snapshot_output_baseline` (ImportError). The test itself is
not a true red-before/green-after oracle for the fix; it documents the OLD behavior.
**Fix:** Rename to `test_empty_baseline_emits_both_files_documents_pre_seed_behavior` (or
similar) and adjust the docstring so it does not claim to fail before the fix — it pins
the contrast case, not a regression that flips.

### IN-02: `snapshot_output_baseline` and `harvest_output_files` duplicate the container-I/O preamble verbatim

**File:** `backend/app/services/sandbox_service.py:399-417` vs `:252-280`
**Issue:** The `mkdir -p /sandbox/output` best-effort + `TemporaryDirectory` +
`copy_from_runtime("/sandbox/output", tmpdir)` + `os.walk` + `sha256` block is copy-pasted
between the two functions. The duplication is intentional per the docstring ("Mirrors the
`harvest_output_files` container-I/O idiom verbatim"), but it means a future fix to the
copy idiom (e.g. handling a `copy_from_runtime` trailing-slash regression) must be applied
in two places or they silently drift.
**Fix:** Extract a private `_walk_output_dir(session) -> Iterator[tuple[str, bytes]]`
helper yielding `(filename, data)` and have both functions consume it. Low priority —
acceptable as-is given the explicit "mirror verbatim" intent.

### IN-03: Migration 076 comment block references Plan 03 as the apply step, but the column is already applied — comment will go stale

**File:** `supabase/migrations/076_messages_origin.sql:24-26`
**Issue:** The header says "Plan 03 (operator ...) applies it ... This plan (120-02) ONLY
AUTHORS the file — it is NOT applied here." Since `full-schema.sql:615-616` already carries
the column + CHECK, the migration has been applied — the comment now describes a
process-time state, not the committed reality. Harmless, but future readers may think the
migration is pending.
**Fix:** Trim the Plan-03/Plan-02 process commentary from the committed migration header;
keep only the load-bearing schema rationale (the `NOT NULL DEFAULT 'deep'` NULL-trap note
and the CHECK rationale).

### IN-04: `_apply_origin_filter` test `test_harness_mode_applies_eq` asserts a branch that production never exercises

**File:** `backend/tests/test_120_origin_filter.py:59-63`
**Issue:** `test_harness_mode_applies_eq` calls `_apply_origin_filter(b, "harness")` and
asserts the `eq` branch fires. Per WR-01, no production caller ever passes
`agent_mode == "harness"`, so this test validates a code path that cannot be reached
through the live call site (`agent_loop.py:1059` passes `body.agent_mode`, which is only
`"default"`/`"explorer"`). The test gives false confidence that harness-mode history
isolation is live-exercised. If WR-01 is resolved by dropping the dead branch, this test
should be removed; if resolved by threading an explicit `history_mode`, this test should
drive that param instead of the never-`"harness"` `agent_mode`.
**Fix:** Align with the WR-01 resolution — either delete this test or repoint it at the
real mode discriminator.

---

_Reviewed: 2026-06-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
