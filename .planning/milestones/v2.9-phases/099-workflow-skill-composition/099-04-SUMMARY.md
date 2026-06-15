---
phase: 099-workflow-skill-composition
plan: 04
subsystem: api
tags: [harness, workflow, skills, snapshot, kickoff, fastapi, threads, G-5]

# Dependency graph
requires:
  - phase: 099-01
    provides: "SkillSnapshot model + skill_ref/skill_snapshot optional config fields + ToolContext.skill_snapshot + the test_kickoff_snapshot_wiring TDD stub this plan flips green"
  - phase: 099-03
    provides: "skill_snapshot.py — validate_skill_refs (D-10 publish gate) + materialize_skill_snapshots_if_needed (D-03a idempotent materializer) — the two functions this plan calls"
provides:
  - "_ensure_skill_snapshots kickoff seam in threads.py: D-10 validate (ValueError->400) + D-03a materialize-if-needed at first kickoff, reassigning the materialized definition for the downstream run"
  - "WFSKILL-01 end-to-end: a published workflow's skill_refs are gated + snapshotted at run-start; subsequent runs reuse the persisted snapshot (deterministic)"
affects: [phase-100, phase-101, phase-103, threads.py-extraction, WFSKILL-01]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Kickoff seam = one thin helper that delegates ALL gate/copy logic to a service (G-5): no inline skill query / Storage call enters the hot file"
    - "Service imported as a MODULE (skill_snapshot as _skill_snapshot) so the seam stays patchable + the ValueError->400 mapping mirrors the 098 assert_folder_scopes_subset call-site exactly"

key-files:
  created: []
  modified:
    - "backend/app/api/threads.py — import skill_snapshot module + _ensure_skill_snapshots helper + the kickoff call (below the 098 scope assert, above the user-message insert)"
    - "backend/tests/test_099_skill_composition.py — un-marked test_kickoff_snapshot_wiring xfail->green"

key-decisions:
  - "Wired via a thin _ensure_skill_snapshots HELPER (not inline code as the plan prose suggested) because the binding Plan-01 TDD stub imports and calls _ensure_skill_snapshots(definition, run_id, supabase, user_id) — the helper IS the one-call-into-service seam (only 2 service calls + the reused 400 mapping; no extractable logic), so G-5 is honored AND the binding test passes"
  - "Service functions called THROUGH the module object (_skill_snapshot.validate_skill_refs / .materialize_skill_snapshots_if_needed) so monkeypatch.setattr on the module attribute is honored by the seam"
  - "definition_id (the workflow_definitions.id) is the materializer persist key — passed as _kickoff_definition_id at the real call-site; run_id keys nothing (passed None at kickoff since the run isn't created until downstream)"

patterns-established:
  - "G-5 one-liner-into-service: a hot-file route call-site adds only an import + a thin wrapper that forwards to a dedicated service; grep-verified no inline domain logic"
  - "ValueError -> HTTPException(400) at a kickoff call-site = the 098 definition-validity failure shape, reused verbatim for the 099 skill gate"

requirements-completed: [WFSKILL-01]

# Metrics
duration: 3min
completed: 2026-06-10
---

# Phase 099 Plan 04: Kickoff Snapshot Wiring Summary

**Wired the Plan-03 skill-snapshot service into the `threads.py` workflow-kickoff path via a thin `_ensure_skill_snapshots` seam — validates every phase `skill_ref` (D-10, ValueError->400) and materializes the immutable snapshot at first kickoff (D-03a, idempotent), without growing the G-5 hot file beyond an import + one wrapper call.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-06-10T00:01:59Z
- **Completed:** 2026-06-10T00:05:19Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- `_ensure_skill_snapshots(*, definition, run_id, supabase, user_id, definition_id=None)` seam added to `threads.py`: runs `validate_skill_refs` first (ValueError -> `HTTPException(400)`, the exact 098 `assert_folder_scopes_subset` mapping shape — never a silent run on a disabled/missing/non-visible skill), then `materialize_skill_snapshots_if_needed` (lazy first-kickoff, idempotent, persisted by `definition_id`).
- Kickoff block now calls the seam immediately AFTER the 098 scope assert and BEFORE the user-message insert, reassigning `_kickoff_definition` so the downstream run reads the materialized snapshot.
- G-5 honored: the hot file gains only the module import + the thin wrapper — grep-verified no inline skills query (`table("skills")`) and no Storage path (`skill-files`) entered `threads.py`.
- `test_kickoff_snapshot_wiring` un-marked from `xfail` to green; all 10 Phase-099 tests pass with **zero remaining xfail**.
- Deep mode stays byte-identical: a no-skill workflow no-ops through both calls (validate has no skill_ref to check; materialize returns the definition unchanged).

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire the snapshot gate + materializer into the kickoff path (G-5 one-liner-into-service)** — `d963b5fb` (feat, TDD GREEN)

**Plan metadata:** (this SUMMARY + STATE/ROADMAP) committed separately.

_TDD note: the failing test (`test_kickoff_snapshot_wiring`) was authored in Plan 01 as an `xfail` stub (the RED gate landed cross-plan); Plan 04 implements + un-marks it in the single GREEN commit above._

## Files Created/Modified
- `backend/app/api/threads.py` — added `from app.services.harness import skill_snapshot as _skill_snapshot`; added the module-level `async def _ensure_skill_snapshots(...)` helper above `send_message`; added the `_kickoff_definition = await _ensure_skill_snapshots(...)` call in the kickoff block (below the 098 scope assert, above the user-message insert).
- `backend/tests/test_099_skill_composition.py` — removed the `@pytest.mark.xfail` decorator on `test_kickoff_snapshot_wiring` (now a hard GREEN assertion).

## Decisions Made
- **Helper, not inline.** The plan's `<action>` prose described inline kickoff code, but the binding Plan-01 TDD stub (`test_kickoff_snapshot_wiring`) imports `_ensure_skill_snapshots` from `app.api.threads` and calls it with `(definition=, run_id=, supabase=, user_id=)`, expecting a `ValueError -> HTTPException(400)` translation. The binding test contract wins (same precedent as Plans 02 `_skill_block` and 03 `materialize_skill_snapshots` reconciliations). The helper itself IS the one-call-into-service seam — its body is only two service calls plus the reused 400 mapping, so G-5 is honored (nothing extractable enters the hot path) AND the test passes. See Deviation [Rule 1] below.
- **Module-attribute call.** The test patches `snap_mod.validate_skill_refs`; the seam therefore imports the service as a module (`_skill_snapshot`) and calls `_skill_snapshot.validate_skill_refs(...)` / `_skill_snapshot.materialize_skill_snapshots_if_needed(...)` so the monkeypatch on the module attribute is honored.
- **`definition_id` vs `run_id`.** The materializer's persist key is the `workflow_definitions.id` (`_kickoff_definition_id`), not the run id. The helper signature accepts both: `run_id` is forwarded (the materializer keys nothing on it) and `definition_id` is the real `.update().eq("id", ...)` key, passed as `str(_kickoff_definition_id)` at the kickoff call-site. The test (which only exercises the ValueError->400 path) passes `run_id` and leaves `definition_id=None`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Implemented the kickoff wiring as the `_ensure_skill_snapshots` helper required by the binding TDD stub (plan prose described inline code)**
- **Found during:** Task 1 (kickoff wiring)
- **Issue:** The plan `<action>` block specified inline gate/materialize code at the kickoff site, but the Plan-01 TDD stub `test_kickoff_snapshot_wiring` imports `_ensure_skill_snapshots` from `app.api.threads` and asserts the `ValueError -> HTTPException(400)` translation against THAT function. Inline-only code would leave the import unresolvable and the test xfailing forever (it would never flip green — the plan's own `<verification>`/`<success_criteria>` demand 10/10 green, 0 xfail).
- **Fix:** Added a thin module-level `async def _ensure_skill_snapshots(*, definition, run_id, supabase, user_id, definition_id=None)` that forwards to `_skill_snapshot.validate_skill_refs` (ValueError->400) + `_skill_snapshot.materialize_skill_snapshots_if_needed`, and called it from the kickoff block. The helper contains no inline domain logic (no skills query, no Storage call) — every line is a service call or the reused 400 mapping — so the G-5 acceptance greps still pass.
- **Files modified:** `backend/app/api/threads.py`
- **Verification:** `test_kickoff_snapshot_wiring` green; the 6 G-5 acceptance greps confirmed (import present once, `validate_skill_refs`/`materialize_skill_snapshots_if_needed` each once, `_skill_err` mapping present, no `skill-files`/new `table("skills")` in threads.py).
- **Committed in:** `d963b5fb` (Task 1 commit)

**Added `definition_id` param to the helper** (within the same fix): the helper signature also carries an optional `definition_id` (defaulting None) beyond the test's `(definition, run_id, supabase, user_id)` call so the real kickoff site can pass the `workflow_definitions.id` for the materializer persist-back. The test's narrower call (no `definition_id`) still resolves because it defaults to None. No scope creep — this is the persist key the materializer already expects.

---

**Total deviations:** 1 auto-fixed (1 bug — TDD-contract reconciliation).
**Impact on plan:** The deviation makes the binding test pass while preserving the plan's exact behavioral intent and every G-5 acceptance grep. No scope creep; the hot file gains only the import + the thin seam.

## Issues Encountered
- The single failing test in the harness regression run — `tests/test_harness_gates.py::test_bounded_retry_reaches_failed_after_3_attempts` (`KeyError: 'tool_call_id'` in `harness_engine.py:219`) — is **documented PRE-EXISTING rot** (flagged in the prior-wave context and Plan 099-02's deviation log). Proven net-new=0 by stashing this plan's edits and reproducing the identical failure at base. NOT this plan's to fix (untouched file). Already logged to `099-workflow-skill-composition/deferred-items.md` by Plan 02.

## Deferred Issues
None new. (Pre-existing rot only — `test_bounded_retry_reaches_failed_after_3_attempts` + the `tests/integration/test_threads_skills.py` FK-violation cluster + the ~114 documented full-suite failures, all from `075.4-TEST-TRIAGE.md`.)

## Known Stubs
None. The kickoff wiring is fully functional: it calls the live Plan-03 service (real DB gate + real Storage materialize) at run-start. No hardcoded empties, no placeholder text, no unwired data path.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- **WFSKILL-01 behavior is complete end-to-end** across Plans 01-04 (data contract -> framing/auto-whitelist -> snapshot host + gated read -> kickoff wiring). The requirement marks complete at phase close after verification.
- **Phase verification (`/gsd:verify-work 099`)** runs the live cross-provider UAT rows L1-L10 in `099-VALIDATION.md` (representative-4 x the SC#10 4 axes + the SC#3 Deep byte-identical diff + the SC#2 immutability/gate live probes). This plan's wiring is the seam those probes exercise at run-start.
- **`threads.py` extraction remains DUE** (G-5 — 9+ touches). This plan added only the import + the thin seam (the smallest possible addition per the plan constraint); it did NOT grow the hot file's domain logic. The extraction is still owed before the next feature insert on this file.
- No blockers.

## Self-Check: PASSED

- `backend/app/api/threads.py` — FOUND (modified; helper `_ensure_skill_snapshots` present at line 787, call at line 931, import at line 50).
- `backend/tests/test_099_skill_composition.py` — FOUND (xfail removed; 10/10 green).
- Commit `d963b5fb` — FOUND in `git log`.

---
*Phase: 099-workflow-skill-composition*
*Completed: 2026-06-10*
