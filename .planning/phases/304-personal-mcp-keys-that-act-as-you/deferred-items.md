# Phase 304 — deferred items (out of scope for the plan that found them)

## 304-01 · F-1 — an `anon` call to `current_user_org_ids()` crashed a local Postgres backend

**Found:** 2026-10-31, while running `tests/integration/test_304_acting_org_rls_live.py` (first draft).

**Observed (twice, local Postgres 17.6, the shared Supabase stack):** on a postgres-role asyncpg
connection, `BEGIN; SET LOCAL ROLE anon; SELECT public.current_user_org_ids();` did NOT return
`permission denied for function` (anon holds no EXECUTE since mig 181). The connection dropped with
`ConnectionDoesNotExistError: connection was closed in the middle of operation`, and a new
connection was refused with `CannotConnectNowError: the database system is in recovery mode` — a
backend crash and cluster crash-recovery. The cluster came back on its own within seconds, data
intact (`pg_postmaster_start_time` unchanged, 221's function still live). Directly before it, the
same connection's `SET LOCAL ROLE anon; SELECT id, kind FROM public.api_keys` raised a normal
`InsufficientPrivilegeError`. GoTrue `DELETE /admin/users` returned 500 during the window.

**NOT established:** whether this pre-dates migration 221. It was not re-driven: every drive
restarts the shared local cluster under every other session. The 221 change is to the function BODY
only; EXECUTE is checked before the body runs, which points at a pre-existing defect in the
permission-denied path (or an extension hook), but that is reasoning, not a measurement.

**Why it matters:** if it reproduces through PostgREST (`POST /rest/v1/rpc/current_user_org_ids`
with the anon key), an unauthenticated caller can crash-loop the database. `current_user_org_ids`
is exposed in the `public` schema.

**Recommended next step (operator):** reproduce on a DISPOSABLE Postgres (not the shared local
stack, never production) — first on the pre-221 body, then on 221 — and capture the server log
(`docker logs supabase_db_Agentic_RAG`) for the crashing statement. Then try the same call through
local PostgREST as anon. Production read-only check is free: `get_advisors(security)` + the
Postgres logs via the Supabase MCP `get_logs` (reads only).

**What 304-01 did instead:** the anon EXECUTE arm is pinned by catalog
(`has_function_privilege('anon', ..., 'EXECUTE') = false`) in `test_privileges` and in
`scripts/check-migration-221-live.py`; the role-level anon call is not made, with a comment saying
why. Fixtures left by the crashed run (4 GoTrue users, 3 orgs, their rows — exact ids, all
`phase-271-p304*` / `phase-271-304-*`) were removed with the suite's own teardown helpers.

## 304-01 · F-2 — `model_rates_insert_policy`'s role arm names roles that do not exist

`org_members_role_check` allows `super-admin`, `org-admin`, `dept-admin`, `member`. The policy (mig
183, carried byte-identical through 221 per D-39) tests `m.role IN ('admin', 'owner')`, which no row
can satisfy — so no `authenticated` caller can ever insert an org rate; only `service_role` can.
Fail-closed, so not a leak. 221 deliberately kept the arm unchanged (its job was narrowing, not
semantics). Re-open trigger: the first phase that lets an org admin set model rates from the app.
