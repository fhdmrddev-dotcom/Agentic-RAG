---
phase: 099-workflow-skill-composition
plan: 07
subsystem: database
tags: [postgres, jsonb, supabase-trigger, harness, skill-snapshot, immutability, CAS, pydantic, fastapi]

# Dependency graph
requires:
  - phase: 099-04
    provides: "_ensure_skill_snapshots kickoff seam + materialize_skill_snapshots_if_needed"
  - phase: 099-03
    provides: "skill_snapshot.py host service (validate_skill_refs + materialize)"
  - phase: 056 (091)
    provides: "workflow_definitions table + immutable-on-publish trigger (the amend target)"
provides:
  - "Migration 067: skill_snapshots jsonb sibling column (exempt from immutability) + amended block-published trigger (9-column authored allowlist)"
  - "skill_snapshot.py persist-back to the sibling column with .is_('skill_snapshots','null') CAS guard"
  - "graft_skill_snapshots() pure helper (re-attach persisted snapshots onto a parsed definition by phase slug)"
  - "Read-point grafts at kickoff (threads.py) + run-definition load (harness_engine.py)"
  - "Structured HTTPException(500) mapping for unexpected materializer failures (no naked ASGI traceback)"
  - "De-mocked test fakes that model the 067 trigger (this collision class can never pass tests again)"
affects: [100, 101, 102, 103, 104, workflow-skill-composition, harness-kickoff, workflow-definitions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sibling-column-for-derived-state: store materialization state in a column EXEMPT from an immutability guarantee rather than mutating the locked authored JSONB"
    - "CAS via PostgREST .is_(col,'null'): a concurrent loser updates 0 rows and proceeds with its identical in-memory value (no error)"
    - "Read-point graft: persisted derived state re-attached onto a freshly-parsed model BEFORE validate/materialize"
    - "De-mock the DB constraint: offline fakes model the real trigger so a constraint-collision class can never pass tests silently"

key-files:
  created:
    - "supabase/migrations/067_skill_snapshots_sibling_column.sql"
  modified:
    - "supabase/full-schema.sql"
    - "backend/app/services/harness/skill_snapshot.py"
    - "backend/app/api/threads.py"
    - "backend/app/services/harness_engine.py"
    - "backend/tests/test_099_skill_composition.py"

key-decisions:
  - "Persist materialized snapshots to a NEW skill_snapshots sibling column (operator-locked), NOT the locked definition JSONB"
  - "Amended trigger narrows but PRESERVES immutability — every authored column stays locked (IS DISTINCT FROM); only skill_snapshots (+ trigger-mutated updated_at) may change on a published row"
  - "CAS via .is_('skill_snapshots','null') doubles as the IN-03 double-kickoff race guard"
  - "Structured 500 mapping is defense-in-depth: 067 removes the 23514 root cause; the wrapper backstops any future materializer fault"

patterns-established:
  - "Sibling-column-for-derived-state on an immutable row"
  - "PostgREST CAS guard (.is_(col,'null')) as a no-error concurrent-loser path"
  - "Read-point graft of persisted derived state before validate"

requirements-completed: [WFSKILL-01]

# Metrics
duration: 8min
completed: 2026-06-10
---

# Phase 099 Plan 07: Skill-Snapshot Sibling Column + First-Kickoff 23514 Fix Summary

**Closed the UAT Test 1 blocker: first kickoff of a skill-bearing PUBLISHED workflow no longer 500s with SQLSTATE 23514 — the materializer now persists snapshots to a new `skill_snapshots` jsonb sibling column (exempt from the published-immutability trigger) with a CAS guard, grafts them back at every read point, and maps any unexpected materializer fault to a structured 500 instead of a naked ASGI traceback.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-06-10T07:50:19Z
- **Completed:** 2026-06-10T07:58:09Z
- **Tasks:** 4
- **Files modified:** 5 (1 created)

## Accomplishments
- **Migration 067 applied to the live local DB** (psycopg2 direct, no reset): added `workflow_definitions.skill_snapshots jsonb` (nullable, exempt from immutability) and amended `workflow_definitions_block_published_update()` to raise 23514 ONLY when one of 9 authored columns changes (`slug/version/name/description/status/definition/created_by/is_global/org_id`). Live-DB verified: column exists + amended function body carries the `IS DISTINCT FROM` allowlist. The live UAT fixture row (`skill_compose_099uat`, id `8a11b1b1...`, published) now has `skill_snapshots = NULL` — exactly the first-kickoff target state.
- **full-schema.sql regenerated** (live-DB dump, no reset) and committed with the migration — the bootstrap artifact reflects both the new column and the amended trigger.
- **Persist-back rewritten** in `skill_snapshot.py`: writes `{phase_slug: snapshot_json}` to the sibling column with a `.is_("skill_snapshots", "null")` CAS guard (closes the IN-03 concurrent double-kickoff race); the old `.update({"definition": ...})` is GONE.
- **`graft_skill_snapshots()` pure helper** re-attaches persisted snapshots onto a freshly-parsed definition by phase slug (fail-closed via `SkillSnapshot.model_validate`); wired at the kickoff read point (`threads.py`) and the run-definition load (`harness_engine.py`, local import).
- **Structured 500 mapping** around the kickoff materialize call — an unexpected fault returns JSON, never a naked traceback (the reported blank-thread / "New Chat"-stuck symptom).
- **De-mocked the test fakes**: `_FakeWorkflowDefsQuery` models the 067 trigger (raises `APIError(23514)` on a published authored-column update, honors the CAS filter) so this collision class can never pass tests silently again. 5 new/updated tests; full 099 suite 15/15 green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Author + apply migration 067 (sibling column + amended trigger)** — `17b3e47d` (feat)
2. **Task 2: Persist to sibling column with CAS + graft helper + de-mock the trigger** — `9dd578c9` (feat, TDD RED→GREEN coupled)
3. **Task 3: Read-point grafts + structured kickoff error UX** — `a6a2a656` (feat, TDD RED→GREEN coupled)
4. **Task 4: Full regression sweep (net-new = 0)** — `f4b39d5f` (docs: re-confirm pre-existing failure)

**Plan metadata:** (this SUMMARY + STATE/ROADMAP) committed separately as the final docs commit.

## Files Created/Modified
- `supabase/migrations/067_skill_snapshots_sibling_column.sql` (NEW) — sibling column + amended 9-column immutability trigger
- `supabase/full-schema.sql` — regenerated from live DB (reflects 067)
- `backend/app/services/harness/skill_snapshot.py` — persist to sibling column + CAS guard; new `graft_skill_snapshots()` pure helper
- `backend/app/api/threads.py` — kickoff SELECTs + grafts `skill_snapshots`; `_ensure_skill_snapshots` gains `skill_snapshots=` kwarg, grafts before validate, maps unexpected materializer errors to HTTPException(500)
- `backend/app/services/harness_engine.py` — `_load_run_definition` SELECTs + grafts `skill_snapshots` (local import)
- `backend/tests/test_099_skill_composition.py` — `_FakeWorkflowDefsQuery` (067 trigger model); updated `test_snapshot_materialize` / `test_snapshot_immune_to_live_edit`; new `test_persist_survives_published_trigger`, `test_graft_skill_snapshots`, `test_cas_second_materialize_no_op`, `test_kickoff_grafts_before_materialize`, `test_kickoff_unexpected_error_maps_500`

## Decisions Made
- None beyond the operator-locked sibling-column design specified in the plan — followed the plan's verbatim SQL and behavioral spec exactly. The migration was applied directly to the live local DB via psycopg2 (operator pre-approved per the kickoff context: "you can apply the migration directly never reset data. then regenerate the full schema"), never `db push`/`db reset`.

## Deviations from Plan

None - plan executed exactly as written. The TDD tasks (2 and 3) authored their RED tests and GREEN implementation in one flow each, committed as a single `feat` commit per task (RED was verified failing before implementing GREEN; both stages were confirmed in-session).

## Authentication Gates
None - the migration apply was a pre-approved operator-authorized DB write executed directly (not an auth gate); all other work was offline.

## Issues Encountered
- **Pre-existing failure surfaced in the Task 4 sweep:** `tests/test_harness_gates.py::test_bounded_retry_reaches_failed_after_3_attempts` (`KeyError: 'tool_call_id'` at `harness_engine.py:219` in `_expire_pending_ask_user`). Because Task 3 touched `harness_engine.py`, it was re-proven PRE-EXISTING via stash-at-base: checked out `harness_engine.py` at the phase base (`b169b29d`) and re-ran — fails identically with the 099-07 `_load_run_definition` graft reverted. 099-07's only `harness_engine.py` change is in `_load_run_definition` (the `skill_snapshots` SELECT + graft, lines ~1055-1078) and does NOT touch line 219. Logged to `deferred-items.md`. Net-new failures = 0.

## Regression Sweep Results
- `tests/test_099_skill_composition.py` — 15 passed (10 original + 5 new/updated)
- `tests/test_harness_gates.py tests/test_harness_whitelist.py tests/test_098_scope_governance.py` — 39 passed, 1 pre-existing failure (bounded-retry KeyError, documented)
- `tests/unit/test_tool_dispatcher.py tests/test_harness_engine.py tests/test_harness_resume.py tests/test_harness_reachability.py tests/test_harness_templates.py tests/test_harness_conftest_smoke.py` — 93 passed
- **Net-new failures = 0.**

## Threat Model Compliance
All 6 STRIDE threats addressed per the plan's register:
- **T-099-07-01** (amended trigger preserves immutability) — `test_persist_survives_published_trigger` proves a definition-touching update on a published row still raises 23514.
- **T-099-07-02** (concurrent double-kickoff race) — `.is_("skill_snapshots","null")` CAS; `test_cas_second_materialize_no_op` verifies the 0-row no-op.
- **T-099-07-03** (malformed stored JSON) — `graft_skill_snapshots` validates via `SkillSnapshot.model_validate` (`extra="forbid"`) → `ValidationError` → fail-closed.
- **T-099-07-04** (naked ASGI 500) — structured `HTTPException(500, detail=...)` wrapper; `test_kickoff_unexpected_error_maps_500` verifies.
- **T-099-07-05** (column readability) — accepted; same `workflow_definitions` row, same owned-or-global SELECT RLS, no new exposure.
- **T-099-07-06** (kickoff IDOR) — n/a; the owned-or-global `.or_` predicate is unchanged, only the SELECT column list widened.

No new threat surface beyond the threat model.

## Deep-Mode Red Line
Byte-identical: graft only fires on workflow definitions (the read points), `ToolContext.skill_snapshot` default stays `None`, and `graft_skill_snapshots(_, None)` early-returns on a falsy map. The dispatcher unit suite (15/15) confirms `_handle_read_skill_file` is unchanged.

## User Setup Required
None - the migration is already applied to the live local DB and committed; greenfield deploys pick it up from `supabase/full-schema.sql` and `supabase/migrations/067_*.sql`.

## Next Phase Readiness
- **POST-EXECUTE (operator, live):** re-run UAT row L1 — first kickoff of the skill-bearing published workflow should now succeed (no 500; run streams; title resolves; `read_skill_file` round-trips from the snapshot), then L2-L10 across the representative-4 + the 4-axis VALIDATION rows. The fixture row (`skill_compose_099uat`) is ready with `skill_snapshots = NULL`.
- `threads.py` extraction remains DUE (G-5) — this plan added only thin wrapper lines (SELECT column + graft/validate/materialize wrapper); do not grow further.

## Self-Check: PASSED

All 7 created/modified files verified present on disk; all 4 task commits (`17b3e47d`, `9dd578c9`, `a6a2a656`, `f4b39d5f`) verified in git history.

---
*Phase: 099-workflow-skill-composition*
*Completed: 2026-06-10*
