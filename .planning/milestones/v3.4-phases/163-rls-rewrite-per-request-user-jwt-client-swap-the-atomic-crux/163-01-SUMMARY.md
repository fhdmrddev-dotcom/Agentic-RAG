---
phase: 163-rls-rewrite-per-request-user-jwt-client-swap-the-atomic-crux
plan: 01
subsystem: auth
tags: [rls, asyncpg, supabase, postgrest, jwt, set-local, multi-tenancy, org_id, testing]

# Dependency graph
requires:
  - phase: 161-org-dept-role-schema
    provides: org_members / organizations / current_user_org_ids() the fixtures seed + probe
  - phase: 162-personal-org-backfill
    provides: handle_new_user personal-org trigger + autofill_org_id_by_owner net (auto-fills seeded rows' org_id)
  - phase: 162.5-threads-producer-extraction
    provides: clean send_message seam (D-01 precondition — no org_id touches producer yet)
provides:
  - get_user_pg_connection (asyncpg RLS context: SET LOCAL ROLE authenticated + both GUC forms)
  - get_user_supabase (per-request ANON-key + Bearer client, no singleton mutation)
  - get_service_role_supabase (hardened BYPASSRLS factory — refuses missing org_id)
  - _apply_rls_user_context (single-source role-first + both-GUC helper reused by tests)
  - _rls_harness.py (DSN/skip-guard + as_user_asyncpg + as_user_supabase_txn + assert_auth_uid + variant probe)
  - two_orgs_two_users + auth_uid_variant fixtures (two-user/two-org non-vacuous scaffold)
affects: [163-02, 163-03, 163-04, 163-05, 163-06, 163-07, 163-08, 164-secdef-isolation-suite]

# Tech tracking
tech-stack:
  added: []   # no new package — httpx/asyncpg/supabase/ClientOptions all already in venv
  patterns:
    - "Per-request DB-context factory seam (asyncpg SET-LOCAL + supabase-py anon+Bearer)"
    - "Shared _apply_rls_user_context so factory and test harness cannot drift on the RLS shape"
    - "Two-user/two-org non-vacuous live fixture with FK-safe (CASCADE-aware) teardown"
    - "Fail-loud assert_auth_uid preflight (NULL uid false-passes isolation at 0 rows)"

key-files:
  created:
    - backend/tests/integration/_rls_harness.py
    - backend/tests/integration/test_163_factories.py
  modified:
    - backend/app/dependencies.py
    - backend/tests/integration/conftest.py

key-decisions:
  - "Extracted the SET-LOCAL sequence into _apply_rls_user_context and had BOTH the factory and the test harness import it — one source of truth, zero drift risk on the security-critical shape."
  - "Fixtures reuse the mig-105 handle_new_user personal orgs when present, with an explicit org+membership fallback so the seed is deterministic on any DB."
  - "get_user_supabase constructs fresh per request with the ANON key; get_service_role_supabase constructs fresh service-role but guards on org_id (no singleton reuse) to keep the refuse-without-scope contract crisp."

patterns-established:
  - "Front-B request-seam factories (dead-until-wired; Wave-4 swaps the router Depends onto them)"
  - "Live RLS harness: SET LOCAL ROLE authenticated + both request.jwt.claim.sub and request.jwt.claims (is_local=true)"

requirements-completed: []   # TEN-02 is phase-spanning — ADVANCED (factories authored) but NOT completed here; it completes at the Wave-4 hot-path swap. Kept Pending.

# Metrics
duration: 25min
completed: 2026-07-19
---

# Phase 163 Plan 01: RLS Front-B DB-Context Factories + Two-User/Two-Org Scaffold Summary

**Three additive, dead-until-wired `dependencies.py` factories — `get_user_pg_connection` (asyncpg `SET LOCAL ROLE authenticated` + both JWT-claim GUC forms), `get_user_supabase` (per-request ANON-key+Bearer client, no singleton mutation), `get_service_role_supabase` (refuses a missing org) — plus a reusable two-user/two-org live RLS harness proven on Postgres :54322.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-19T11:38Z
- **Completed:** 2026-07-19T12:00Z
- **Tasks:** 2 (Task 1 = TDD: RED→GREEN)
- **Files modified/created:** 4 (2 created, 2 modified) + deferred-items.md

## Accomplishments
- **The atomic-crux request seam exists and is verified on the live DB:** `get_user_pg_connection` yields a connection reporting `current_user = authenticated` (the load-bearing `SET LOCAL ROLE` swap took effect — a bare-claims connection stays `postgres` and BYPASSes RLS) AND `auth.uid() = <passed uid>` (both GUC forms resolve). Probed the live `auth.uid()` body first: it reads legacy `request.jwt.claim.sub` first, then JSON `request.jwt.claims` — both-forms is variant-independent by construction (D-02).
- **`get_user_supabase`** builds a NEW per-request client with the ANON key + `Authorization: Bearer <token>` (PostgREST → `authenticated`, RLS enforced) and never mutates the shared service-role singleton (Pitfall 2 — cross-request identity bleed).
- **`get_service_role_supabase(org_id)`** raises `ValueError` on falsy `org_id` — a BYPASSRLS client can't be built without an explicit org scope (D-05).
- **Reusable scaffold for every later `test_163_*`:** `_rls_harness.py` (DSN + skip-guard + `as_user_asyncpg` + `as_user_supabase_txn` bridge + fail-loud `assert_auth_uid` + `auth.uid()` variant probe) and the `two_orgs_two_users` / `auth_uid_variant` conftest fixtures (non-vacuous, disjoint orgs, FK-safe teardown leaving 0 residual rows).
- **No drift risk:** the factory and the harness both import ONE `_apply_rls_user_context` helper for the role-first + both-GUC-forms + `is_local=true` sequence.

## Task Commits

Each task was committed atomically:

1. **Task 1 (TDD RED): failing factory smoke tests** — `f025c6c0` (test)
2. **Task 1 (TDD GREEN): three Front-B factories in dependencies.py** — `045123e0` (feat)
3. **Task 2: fixtures + shared RLS harness + live factory proof** — `e3cb1ada` (test)

**Plan metadata:** (this commit) `docs(163-01): complete plan`

## Files Created/Modified
- `backend/app/dependencies.py` — added `_apply_rls_user_context`, `get_user_pg_connection` (@asynccontextmanager), `_shared_httpx`/`_get_shared_httpx`, `get_user_supabase`, `get_service_role_supabase`. Existing `get_supabase`/`get_pg_pool`/`get_current_user` byte-unchanged (only the `supabase` import line extended with `ClientOptions`; added `httpx`, `asynccontextmanager`, `AsyncIterator` imports).
- `backend/tests/integration/_rls_harness.py` (new) — shared harness: `PG_TEST_DSN`/`PG_AVAILABLE`/`requires_pg`, `open_user_conn`, `as_user_asyncpg`, `as_user_fetchval`, `as_user_supabase_txn`, `assert_auth_uid`, `probe_auth_uid_variant`.
- `backend/tests/integration/conftest.py` — added `pg_pool`, `two_orgs_two_users`, `auth_uid_variant` fixtures + `_table_exists`.
- `backend/tests/integration/test_163_factories.py` (new) — 8 tests (5 unit + 3 live), all green.

## Decisions Made
- **One-source SET-LOCAL:** factored the role-swap+claims sequence into `_apply_rls_user_context` so the app factory and the test harness are provably identical (a divergence would silently weaken every downstream leak proof).
- **Personal-org-first fixtures with explicit fallback:** use the mig-105 auto-provisioned personal orgs when present; fall back to an explicit `organizations` + `org_members` insert so the seed is deterministic regardless of trigger presence.
- **Fresh construction over singleton reuse** for both `get_user_supabase` (per-request identity) and `get_service_role_supabase` (keeps the refuse-without-org guard the single meaningful behavior).

## Deviations from Plan

None affecting scope. Two bookkeeping notes:

- **TDD sequencing:** `test_163_factories.py` is listed under Task 2's files, but Task 1 is `tdd="true"` — so its RED unit smoke tests were authored in the Task-1 RED commit (`f025c6c0`) and Task 2 EXTENDED the same file with the live two-user/two-org proofs. The file is shared across both tasks by design; no behavior or scope changed.
- **Requirement marking (deliberate deviation from the mechanical mark-complete step):** the workflow marks each PLAN's frontmatter requirements complete, which flipped **TEN-02** to Complete. Reverted it to **Pending** — TEN-02 is a phase-spanning deliverable ("the singleton is **replaced on hot paths**") delivered by the Wave-4 client swap, and this plan is explicitly additive/dead-until-wired (0 call sites). Marking a security-core requirement complete after plan 1 of 10 would be inaccurate and could weaken the milestone two-org isolation exit gate. TEN-02 is advanced (its factories exist + are live-proven) but completes at the swap.

## Issues Encountered
- **Pre-existing rot in `tests/integration/test_119_leak.py` (out of scope, logged).** 3 governance-leak tests fail with `asyncpg InterfaceError: another operation is in progress` (TestClient threadpool vs the app singleton pool on connection reset). **Proven pre-existing** by re-running test_119 against the Phase-163 base-commit conftest (`cf2907fd`) with all Plan 163-01 additions removed — identical 3 failures. test_119 defines its own module-level `pg_pool`, which overrides (does not consume) the new conftest fixture. Logged to `deferred-items.md`; NOT fixed (SCOPE BOUNDARY).

## User Setup Required
None — no external service configuration. (Note for the Wave-4 client swap: `SUPABASE_ANON_KEY` must be populated in `backend/.env` before `get_user_supabase` is wired live; it defaults to `""` and is already used by `/public-config`.)

## Next Phase Readiness
- The contract every later 163 plan consumes is LOCKED and verified live: the SET-LOCAL shape, the anon-key+Bearer client, the refuse-without-org guard, the shared harness, and the two-user/two-org non-vacuous fixtures.
- Factories are dead-until-wired (0 call sites in `backend/app/api` + `backend/app/services`) — Deep Mode byte-identical; no app behavior changed.
- Ready for the RLS predicate-rewrite bundles (mig 107) + the leak/cluster/role-swap test files that import `_rls_harness`, and the Wave-4 router `Depends` swap.

## Self-Check: PASSED
- Files: FOUND `backend/app/dependencies.py`, `_rls_harness.py`, `test_163_factories.py`, `conftest.py`
- Commits: FOUND `f025c6c0`, `045123e0`, `e3cb1ada`
- Live suite: `pytest tests/integration/test_163_factories.py` = 8 passed; teardown leaves 0 residual rows; dead-until-wired confirmed (0 app call sites); `dependencies.py` existing functions byte-unchanged.

---
*Phase: 163-rls-rewrite-per-request-user-jwt-client-swap-the-atomic-crux*
*Completed: 2026-07-19*
