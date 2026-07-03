---
phase: 136-skill-publish-gate-gate-01
plan: 02
subsystem: api
tags: [fastapi, supabase, pytest, rls, eval-gate, publish-gate, mass-assignment]

# Dependency graph
requires:
  - phase: 136-01-publish-gate-read-model
    provides: compute_publish_gate(supabase, skill_id, user_id) -> PublishGate, TogglePublishBody, migration 084 skill_publish_overrides, the 6 named enforcement test stubs
provides:
  - Gated toggle_global — private→global recomputes the publish gate server-side and refuses with a structured 409 unless the gate is met OR an explicit override is sent (D-07)
  - Force-publish override path — an unmet-gate override applies the is_global=true UPDATE AND records an owner-visible skill_publish_overrides row (gate snapshot + latest skill_version_id + when) (D-01/D-02)
  - Born-global side door closed — create_skill hard-sets is_global=false, ignoring any client value; the gated toggle is now the ONLY road to global (D-08)
  - GET /skills/{id}/publish-gate — server-computed, owner-scoped read for the Plan 03 dialog (D-05)
  - Full tests/test_publish_gate.py green (11/11, none skipped) — all six enforcement paths exercised
affects: [136-03 frontend PublishGateDialog + SkillCard interception, 136-04, 137-skill-evals-panel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gate the mutation direction only: compute_publish_gate lives INSIDE the new_value is True branch — unshare is an ungated straight UPDATE, and every re-share re-gates (D-09, no grandfathering)"
    - "Structured 409 + evidence-at-override (evals.py force_promote idiom): refuse with {error, gate} unless override; on override record the gate snapshot at the moment of override"
    - "Hard-set share flags server-side (classification_rule_service.py:79 precedent): is_global=False in the create insert dict, never read from the caller (T-118-02-01)"
    - "run_in_threadpool wraps the NEW gate/override hot path even though the legacy skills handlers do not (D-v2.5-01, RESEARCH Pitfall 5)"

key-files:
  created: []
  modified:
    - backend/app/api/skills.py
    - backend/tests/test_publish_gate.py
    - backend/tests/integration/test_skills.py

key-decisions:
  - "Kept the existing owner-only 403 block in toggle_global VERBATIM (endpoint-local convention: skills router uses 403 on non-owner, newer eval routes use 404) — the GET publish-gate endpoint also uses 403 for consistency with its sibling toggle"
  - "GET /skills/{id}/publish-gate delegates to the exhaustively-tested compute_publish_gate after a 5-line owner-verify; no dedicated 12th test added — the plan's artifact contract is exactly 6 enforcement tests and the endpoint mirrors the battle-tested get_eval_run owner-scoping pattern"
  - "Force-publish resolves skill_version_id via an owner-scoped LATEST-version read (order version_number desc, limit 1) BEFORE the INSERT; null only when the skill has no version rows"

patterns-established:
  - "The gated toggle is the single choke point to is_global=true; create hard-sets false, import already hard-codes false, and save_skill omits is_global — every write path to global funnels through the one gated door"
  - "In-memory enforcement tests use a _CreateSupabase fake that back-fills the DB-side skills defaults (id/is_enabled/timestamps) so SkillResponse serialization + the import path's skill_row['id'] thread succeed against the fake store, while leaving is_global untouched so a born-global bypass surfaces as True"

requirements-completed: [GATE-01]

# Metrics
duration: 33min
completed: 2026-07-03
---

# Phase 136 Plan 02: Publish-Gate Enforcement Summary

**The server is now the gate — toggle_global recomputes the publish gate on every private→global flip and refuses with a structured 409 unless met-or-overridden (override recorded), create_skill hard-sets is_global=false, and GET /skills/{id}/publish-gate exposes the server-computed status; 11/11 enforcement tests green**

## Performance

- **Duration:** 33 min
- **Started:** 2026-07-03T03:19:12Z
- **Completed:** 2026-07-03T03:52:21Z
- **Tasks:** 2 (both TDD: RED → GREEN)
- **Files modified:** 3

## Accomplishments

- **The gated toggle (D-07).** `toggle_global` now recomputes `compute_publish_gate` on the private→global direction ONLY. An unmet gate with no override raises a structured `409 {"error": "publish_gate_unmet", "gate": <server-computed PublishGate>}` — the client can never fabricate a passing eval; the dialog renders this server payload (server→client only, T-136-03). Unshare (global→private) is an ungated straight UPDATE, and a later re-share re-runs the whole check fresh (D-09, no was-ever-published grandfathering).
- **Force-publish with a recorded, non-repudiable audit row (D-01/D-02).** An `override=true` on an unmet gate applies the `is_global=true` UPDATE AND inserts exactly one `skill_publish_overrides` row carrying `gate_state`, a `gate_snapshot` (`measured_count`/`passed_count`/`reason`), and the resolved LATEST `skill_version_id` — the honest state at the moment of override. Both the version-resolve read and the INSERT are `run_in_threadpool`-wrapped (D-v2.5-01).
- **Born-global side door closed (D-08 / T-136-01).** `create_skill`'s insert hard-sets `"is_global": False`, ignoring any client-supplied value. The gated toggle is now the single road to global; import already hard-codes False and `save_skill` omits `is_global` (both verified by the regression test, unchanged per D-08).
- **`GET /skills/{id}/publish-gate` (D-05).** Owner-scoped (endpoint-local 403), returns the server-computed `PublishGate` for the Plan 03 dialog; ignores any client input beyond the path skill_id + auth user (T-136-03).
- **All 11 tests green, none skipped** — the 5 gate-compute tests from Plan 01 plus the 6 enforcement tests this plan filled (blocked / allowed / force-records-override / create-hard-set / import-and-save-stay-private / unshare-reshare-regated).

## Task Commits

Each task was executed TDD (RED → GREEN) and committed atomically:

1. **Task 1 (RED): failing enforcement tests for the gated toggle** - `6e5dc343` (test) — 3 gating tests fail against the ungated toggle; the allowed-path test passes as a regression guard
2. **Task 1 (GREEN): gate toggle-global + record override + GET publish-gate** - `c73ce752` (feat) — skills.py enforcement + the test_skills.py regression fix
3. **Task 2 (RED): failing create-hard-set + import/save-stay-private tests** - `1f246e2e` (test) — create test fails (still passes body.is_global through); import + save_skill green as regression guards
4. **Task 2 (GREEN): hard-set is_global=false on create** - `63fcee5b` (feat) — full module 11/11 green

## Files Created/Modified

- `backend/app/api/skills.py` - (1) `toggle_global` accepts `body: TogglePublishBody | None`, gates the private→global direction with `compute_publish_gate` → 409-unless-override, records the `skill_publish_overrides` row on override (latest-version resolve + INSERT, both threadpool-wrapped); (2) new `GET /skills/{id}/publish-gate` (owner-verify 403 → `compute_publish_gate`); (3) `create_skill` insert hard-sets `is_global=False`; (4) added `run_in_threadpool`, `compute_publish_gate`, `PublishGate`, `TogglePublishBody` imports
- `backend/tests/test_publish_gate.py` - Un-skipped + implemented the 6 enforcement tests (HTTP via `httpx.AsyncClient` + `ASGITransport`, `get_current_user`/`get_supabase` dependency-overridden against `_FilterSupabase`); added a `_CreateSupabase` fake that back-fills the DB-side skills defaults; direct `_handle_save_skill` call proves the agent save_skill path stays private
- `backend/tests/integration/test_skills.py` - Regression fix: `test_toggle_global_flips_value` updated to the new gated read sequence (met-gate mock, 6 ordered execute results) so it still proves private→global flips to True

## Decisions Made

1. **Endpoint-local 403 preserved.** Kept the existing owner-only 403 block in `toggle_global` verbatim (the skills router's convention; newer eval routes use 404). The new `GET /skills/{id}/publish-gate` also uses 403 for consistency with its sibling toggle, per the plan.
2. **No 12th test for the GET endpoint.** The plan's artifact contract is exactly six enforcement tests (11 total). The GET endpoint is a 5-line owner-verify wrapper over the exhaustively-tested `compute_publish_gate` and mirrors the battle-tested `get_eval_run` owner-scoping pattern, so it ships without a dedicated test to honor the plan's inventory precisely.
3. **`_CreateSupabase` back-fill fake.** The in-memory `_FilterSupabase.insert` returns the raw payload, which lacks the DB-side `id`/`is_enabled`/timestamps that `SkillResponse` serialization and the import path's `skill_row["id"]` require. A thin `_CreateSupabase` subclass back-fills those defaults but deliberately NOT `is_global`, so a born-global bypass would surface as `True`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated `test_skills.py::test_toggle_global_flips_value` broken by the new gate**
- **Found during:** Task 1 (gating `toggle_global`)
- **Issue:** The existing (green-at-baseline) integration test mocked exactly two `.execute()` calls (fetch + update). Gating the private→global direction inserts 4 `compute_publish_gate` reads between them, so the old mock raised `StopIteration` and the test went red — a regression directly caused by this task's change.
- **Fix:** Rewrote the test's `side_effect` to the new 6-call gated sequence (owner-verify fetch → gate skill/runs/versions/override → UPDATE) with a MET gate, preserving the test's original intent (private→global flips `is_global` to `True`).
- **Files modified:** `backend/tests/integration/test_skills.py`
- **Verification:** `test_skills.py` + `test_skills_lint.py` + `test_skills_import_export.py` all green (42 passed, 2 skipped→now 0 after Task 2).
- **Committed in:** `c73ce752` (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug — a directly-caused test regression). This touches a test file only; the D-10 red line (no agent-loop / provider-gateway / threads.py runtime touch, Deep Mode byte-identical) is fully intact. The plan's "only skills.py + the test module" expectation refers to the production surface — updating a directly-impacted existing test is a necessary, documented correction, not scope creep.
**Impact on plan:** No production-code scope creep; all six enforcement paths delivered exactly as specified.

## Issues Encountered

- **Import-path `KeyError: 'id'` in the first RED of Task 2.** The plain `_FilterSupabase` fake does not populate an inserted skills row's `id`, but the import handler threads `skill_row["id"]` into `_upload_skill_files`. Resolved by pointing the import test at `_CreateSupabase` (which back-fills `id`), keeping the import path a clean regression guard (import already hard-codes `is_global=False`).

## Threat Surface

All changes fall within the plan's threat register — no new surface introduced:
- T-136-01 (mass-assignment on create) — mitigated: `create_skill` hard-sets `is_global=false`.
- T-136-02 (tamper/repudiation on override) — mitigated: server re-verifies ownership, recomputes the gate, and RECORDS the override (snapshot + when).
- T-136-03 (forged gate payload) — mitigated: server recomputes from `eval_runs`; the 409 gate is server→client only; GET ignores client gate data.
- T-136-04 (IDOR) — mitigated: owner-scoped `.eq("user_id")` on every read/write; endpoint-local 403 on non-owner.
- T-136-06 (client-side bypass) — mitigated: a direct PATCH without a passing eval still 409s.

No threat flags: no new network endpoint, auth path, file access, or schema surface beyond the plan.

## Known Stubs

None. The two previously-skipped Plan-01 enforcement stubs are now fully implemented; `tests/test_publish_gate.py` runs 11/11 with none skipped. No UI/data stubs (this plan ships no UI and no hardcoded-empty values).

## Verification

- `tests/test_publish_gate.py` → **11 passed, 0 skipped** (verbatim per-test PASS list captured).
- Skill/eval/tool blast-radius sweep → **153 passed** (test_publish_gate + test_evals_router + test_skill_proposals_router + test_skill_proposals + test_skills + test_skills_lint + test_skills_import_export + test_eval_runner + test_skill_tuner_service + test_skill_tuner_routes + test_132_test_cases).
- `git diff --name-only` vs base = `backend/app/api/skills.py` + the two test files (no agent-loop / threads.py / provider-gateway runtime touch — D-10 held).
- **Full-suite context:** the whole backend suite shows ~120 pre-existing failures (documented rot: the `runs_thread_id_fkey` live-DB FK-violation cluster in `test_threads_skills.py`/`test_077_*`, plus `test_retrieval_service`/`test_sql_service`/`test_sandbox_service`/`test_multimodal_query`/`test_module7_tools`/`test_streaming_reliability` unit mock-drift — see 075.4-TEST-TRIAGE / SEED-011). ZERO are in this plan's domain: every failing file tests a module this plan never touched, and `app.main` imports cleanly (proven by the 11 passing HTTP tests). No new failures introduced.

## User Setup Required

None - no external service configuration required. (Cloud parity note carried from Plan 01: migration 084 `skill_publish_overrides` must be pasted into the cloud Supabase SQL editor at the eventual deploy — a standard checklist item, not a local setup step.)

## Next Phase Readiness

- **Plan 03 (frontend)** can consume the wire contract now: `PATCH /skills/{id}/toggle-global` accepts an optional `{override: boolean}` body and returns `409 {detail: {error: "publish_gate_unmet", gate: <PublishGate>}}` on an unmet gate; `GET /skills/{id}/publish-gate` returns the server-computed `PublishGate`. SkillCard should intercept the private→global Globe click and open the dialog; unshare stays a direct call (D-07).
- **Plan 04 / Phase 137** inherit the recorded override history (`skill_publish_overrides` + `PublishGate.last_override`) for the owner-visible gate-status readout.
- No blockers.

## Self-Check: PASSED

- All 3 modified files exist on disk (verified): `backend/app/api/skills.py`, `backend/tests/test_publish_gate.py`, `backend/tests/integration/test_skills.py`.
- All 4 task commits exist in git log: `6e5dc343` (test), `c73ce752` (feat), `1f246e2e` (test), `63fcee5b` (feat).
- TDD gate sequences verified: Task 1 test(`6e5dc343`)→feat(`c73ce752`); Task 2 test(`1f246e2e`)→feat(`63fcee5b`).
- `tests/test_publish_gate.py` 11/11 green, none skipped.

---
*Phase: 136-skill-publish-gate-gate-01*
*Completed: 2026-07-03*
