---
phase: 132-skill-versioning-eval-test-case-persistence
plan: 02
subsystem: backend-api
tags: [fastapi, supabase, owner-scoping, rls-defense, eval, skill-versioning, crud, tdd, pydantic]

# Dependency graph
requires:
  - phase: 132-01
    provides: "public.skill_test_cases + public.skill_versions tables (live), capture trigger, append-only immutability, owner-only RLS, v1 backfill"
  - phase: 017-skills
    provides: "public.skills table (owner gate target) + skills.py CRUD conventions mirrored here"
  - phase: 123-skill-triggering
    provides: "skill_tuner.py owner-scoped net-new router precedent + its main.py registration style"
provides:
  - "Owner-scoped eval test-case CRUD API (EVAL-01): GET/POST /skills/{id}/test-cases, PATCH/DELETE /test-cases/{id}"
  - "Read-only skill version-history API (VER-01): GET /skills/{id}/versions (version_number DESC, owner-scoped)"
  - "TestCaseCreate/TestCaseUpdate/TestCaseResponse + SkillVersionResponse Pydantic contracts"
  - "Integration coverage: CRUD persistence + version DESC + cross-user owner-scope isolation (51 passing with adjacent skill-router tests)"
affects: [133-eval-runner, 134-eval-results, 135-self-improvement, 137-evals-panel-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "App-code .eq('user_id', current_user['id']) on EVERY query as the SOLE runtime leak gate (service-role bypasses RLS) — 123 tuner precedent"
    - "POST sources user_id/skill_id from caller+path, never the request body (forged-id ignored, T-132-07)"
    - "Read-only resource (versions) exposes NO write route — immutability enforced at the DB (Plan 01 triggers)"
    - "In-memory fake supabase honoring .eq() filters so route tests genuinely exercise the owner gate (no live DB / no provider)"
    - "TDD RED via module-missing ImportError → GREEN on implementation (unambiguous, no false-green RED)"

key-files:
  created:
    - "backend/app/models/skill_test_case.py"
    - "backend/app/models/skill_version.py"
    - "backend/app/api/skill_test_cases.py"
    - "backend/tests/integration/test_132_test_cases.py"
  modified:
    - "backend/app/main.py (import + include_router registration)"

key-decisions:
  - "Parent-skill check on POST is OWNER-ONLY (.eq('user_id')) — a user authors eval cases only against skills they OWN, keeping the .eq('user_id') gate uniform on every route (satisfies must_have truth 3 literally). Global-skill eval authoring is not enabled in this foundation."
  - "Versions GET is owner-scoped on user_id directly (no separate skill check) — a global-skill consumer who is not the author gets [], never the author's history (D-12 / T-132-08)"
  - "Mirrored skills.py SYNC-inline supabase convention (no run_in_threadpool) per RESEARCH A3 / accepted tech-debt; holistic backfill = SEED-097"

patterns-established:
  - "Owner-scoped net-new router that touches NO G-5 hot file (mirrors skill_tuner.py; threads.py untouched)"

requirements-completed: [EVAL-01, VER-01]

# Metrics
duration: ~25min
completed: 2026-06-30
---

# Phase 132 Plan 02: Eval Test-Case CRUD + Version-History API Summary

**A net-new owner-scoped FastAPI router exposes test-case CRUD (EVAL-01) and read-only skill version history (VER-01) over the Plan 01 tables — every query carries the app-code `.eq("user_id", …)` gate (the sole runtime leak control under the service-role client), proven by a cross-user isolation test, and built TDD (RED→GREEN) with zero touch to any G-5 hot file.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2 (Task 1 models autonomous; Task 2 router TDD)
- **Files:** 5 (4 created + main.py)

## Accomplishments
- **Pydantic contracts** (`skill_test_case.py`, `skill_version.py`) mirroring the migration-079 columns exactly: `TestCaseCreate` / `TestCaseUpdate` (all-optional) / `TestCaseResponse`, and a read-only `SkillVersionResponse` (no create/update model — versions are trigger-created + immutable). No provider/model fields anywhere (D-08).
- **Five routes** in `backend/app/api/skill_test_cases.py` (no shared prefix — full paths per route):
  - `GET /skills/{skill_id}/test-cases` — list, owner-scoped, ordered by `order_index` ASC
  - `POST /skills/{skill_id}/test-cases` — create; `user_id`/`skill_id` from caller+path (forged body id ignored, T-132-07); parent skill must be owned (404 otherwise)
  - `PATCH /test-cases/{case_id}` — edit only-supplied fields; non-owned/unknown → 404
  - `DELETE /test-cases/{case_id}` — remove; non-owned/unknown → 404
  - `GET /skills/{skill_id}/versions` — version history, `version_number` DESC, owner-scoped, **read-only** (no write route)
- **The owner gate is on EVERY DB query** — `.eq("user_id", current_user["id"])`. `get_supabase()` is the service-role client (RLS bypassed), so this app-code filter is the only thing preventing cross-user reads/edits. 404 (never 403) on a miss so existence isn't leaked.
- **Registered in `main.py`** (combined import line + `app.include_router(...)` with a Phase 132 EVAL-01/VER-01 comment), adjacent to the skill_tuner registration.
- **Integration coverage** (`test_132_test_cases.py`, 5 tests): create-persists-and-list-ordered, patch-only-supplied-fields (+ updated_at advances), delete-removes, versions-DESC, and `test_owner_scope_isolation` (user B cannot list/patch/delete user A's cases or read A's versions; A's data stays intact). A small in-memory fake supabase honors `.eq()` filters so the owner gate is genuinely exercised — no live DB, no provider.

## Task Commits

1. **Task 1: Pydantic models** — `9eb97b6e` (feat) — TestCaseCreate/Update/Response + SkillVersionResponse, no provider/model fields
2. **Task 2 RED: failing tests** — `059610b7` (test) — CRUD + isolation tests; RED via missing `app.api.skill_test_cases` module
3. **Task 2 GREEN: router + registration** — `a54df786` (feat) — 5 owner-scoped routes, `.eq("user_id")` on every query, registered in main.py

## Files Created/Modified
- `backend/app/models/skill_test_case.py` — TestCaseCreate / TestCaseUpdate / TestCaseResponse
- `backend/app/models/skill_version.py` — SkillVersionResponse (read-only)
- `backend/app/api/skill_test_cases.py` — the 5-route owner-scoped router
- `backend/app/main.py` — import + `include_router(skill_test_cases.router)`
- `backend/tests/integration/test_132_test_cases.py` — 5 route tests incl. `test_owner_scope_isolation`

## Decisions Made
- **Parent-skill check on POST is owner-only** (`.eq("user_id")`), keeping the `.eq("user_id")` gate uniform across all five routes (satisfies must_have truth 3 literally). A user authors eval cases only against skills they own; global-skill eval authoring is not enabled in this foundation (revisit if a later phase needs it).
- **Versions GET filters on `user_id` directly** (no separate skill-existence probe) — a global-skill consumer who is not the author gets `[]`, never the author's private history (D-12 / T-132-08).
- **Mirrored the `skills.py` SYNC-inline supabase convention** (no `run_in_threadpool`) per RESEARCH A3 — accepted prevailing tech-debt; the holistic threadpool backfill is SEED-097 (do NOT diverge this one router).

## Deviations from Plan
None — plan executed exactly as written (Task 1 autonomous, Task 2 TDD RED→GREEN).

## Deferred Issues
- **Pre-existing backend test rot (NOT a Plan 02 regression):** the full suite reports 124 pre-existing failures in unrelated subsystems — agent-loop tool-registry count (`test_threads_skills.py` "22 vs 24 tools", driven by the **working-tree** `threads.py`/`thread.py` edits present at session start, not touched here), `sql_service`, `sandbox_service`, `retrieval_service` (document versioning), `streaming_reliability`, and a `test_077` collection error. None reference `skill_test_cases`/`skill_versions`. The app boots cleanly (1970 pass). Logged to `deferred-items.md`; tracked under the existing rot ledger (075.4-TEST-TRIAGE / SEED-056). Plan 02 + adjacent skill-router tests: **51 passed**.

## Threat Flags
None — no new security surface beyond the planned threat model. The owner gate (T-132-06), forged-body-id rejection (T-132-07), and author-private versions (T-132-08) are all implemented and tested.

## Next Phase Readiness
- The persistence foundation is now usable end-to-end from the API: Phase 137 (Evals Panel UI) can wire a test-case editor + version-history viewer against these routes; Phase 133 (eval runner) consumes the stable `skill_test_cases.id` / `skill_versions.id` PKs as FK targets (D-10).
- **Deploy-time note (not now):** these are pure app-code routes — no new migration. (Migration 079 cloud-apply is still pending the next operator-gated deploy per Plan 01.)

## Self-Check: PASSED

- `backend/app/models/skill_test_case.py` — FOUND
- `backend/app/models/skill_version.py` — FOUND
- `backend/app/api/skill_test_cases.py` — FOUND
- `backend/tests/integration/test_132_test_cases.py` — FOUND
- `backend/app/main.py` contains 2 `skill_test_cases` references (import + include_router) — FOUND
- Commits `9eb97b6e` / `059610b7` / `a54df786` — all FOUND in git history
- `test_132_test_cases.py` — 5 passed; with adjacent skill-router tests — 51 passed

---
*Phase: 132-skill-versioning-eval-test-case-persistence*
*Completed: 2026-06-30*
