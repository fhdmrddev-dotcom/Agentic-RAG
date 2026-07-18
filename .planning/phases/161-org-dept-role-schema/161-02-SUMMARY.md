---
phase: 161-org-dept-role-schema
plan: 02
subsystem: database
tags: [postgres, supabase, rls, security-definer, multi-tenancy, org-rbac, migration, full-schema, deploy-parity, 42P17]

# Dependency graph
requires:
  - phase: 161-01
    provides: "authored supabase/migrations/104_org_dept_role_schema.sql (8 org tables + 3 SECDEF helpers + membership RLS + seeded permission catalog + 23-table org_id sweep)"
  - phase: (live schema head 103)
    provides: "the pre-104 full-schema.sql bootstrap artifact + the running local Supabase DB (port 54322)"
provides:
  - "migration 104 APPLIED to the live local DB (operator SQL-editor apply, confirmed) — the schema-application gate is now satisfied"
  - "regenerated supabase/full-schema.sql (head 104) — the single-file greenfield bootstrap now reflects the 8 org tables + current_user_org_ids() and the 23 swept org_id columns"
  - "LIVE proof that ORG-01 + ORG-02 hold against the running DB (not build/type checks) — headlined by the 42P17 non-recursion test on org_members"
affects: [162-personal-org-backfill, 163-rls-rewrite-user-jwt-crux, 164-secdef-audit-isolation-suite]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "apply-then-regenerate: operator pastes the numbered migration into the local Supabase SQL editor, then scripts/regenerate-full-schema.sh (NO --reset) dumps the live DB into full-schema.sql — never hand-edit the artifact"
    - "LIVE-DB verification via venv psycopg2 against localhost:54322 (docker exec is sandbox-blocked; the venv interpreter carries psycopg2) — schema-application proven with running-DB evidence, not type checks"
    - "the 42P17 live proof: SET LOCAL ROLE authenticated + SET LOCAL request.jwt.claims + SELECT count(*) FROM org_members must return 0 without SQLSTATE 42P17"

key-files:
  created: []
  modified:
    - "supabase/full-schema.sql — regenerated (head 104) via scripts/regenerate-full-schema.sh; +1016/-15 (the 8 org tables, 3 SECDEF helpers, 25 policies, 23 swept org_id columns/indexes). Schema-only dump — the roles/role_permissions SEED does NOT travel here (it lives in migration 104)."

key-decisions:
  - "full-schema.sql is schema-only (pg_dump --schema-only) — the roles/role_permissions seed is NOT in it; it travels in migration 104. Refines Plan 01's step-3 wording ('travels inside 104 and full-schema.sql')."
  - "OPERATOR.md Step-3 seed-list registration for 104 is DEFERRED to the deploy step — check-deploy-drift.sh Check-2 only SOFT-WARNs it, alongside the already-shipped-but-unregistered 093/094/098; no blocking drift, no same-commit artifact change required."
  - "commit type = chore (house style for a full-schema regen after applying a migration: 159-03/158-12/150-02/149-01 precedent); the feat was Plan 01's migration authoring."

patterns-established:
  - "when docker exec is sandbox-blocked, LIVE-DB evidence still comes from the running DB via the backend venv's psycopg2 on port 54322 — never substitute build/type checks"

requirements-completed: [ORG-01, ORG-02]

# Metrics
duration: 8min
completed: 2026-07-18
---

# Phase 161 Plan 02: Org / Dept / Role Schema — Apply + Verify + Regenerate Summary

**Applied migration 104 live (operator SQL-editor), regenerated the schema-only `full-schema.sql` bootstrap to head 104, and PROVED ORG-01/ORG-02 against the running DB — headlined by the 42P17 non-recursion test (`SELECT count(*) FROM public.org_members` returns 0 with no SQLSTATE 42P17 under `SET LOCAL ROLE authenticated`).**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-18T16:20:29Z
- **Completed:** 2026-07-18T16:28:19Z
- **Tasks:** 2 (Task 1 = operator-applied BLOCKING gate [confirmed before this executor ran]; Task 2 = regenerate + verify live + deploy-parity + commit)
- **Files modified:** 1 (`supabase/full-schema.sql`)

## Accomplishments
- **Migration 104 is APPLIED to the live local DB** (operator pasted it into the local Supabase SQL editor and confirmed a clean run — no `db push` / `db reset`). The phase's mandatory schema-application gate is satisfied.
- **`supabase/full-schema.sql` regenerated to head 104** via `scripts/regenerate-full-schema.sh` (no `--reset` — live-DB dump preserving dev data). Contains `public.organizations` + `current_user_org_ids()` + all 8 org tables + all 3 SECDEF helpers. Never hand-edited.
- **All live assertions pass (9/9)** against localhost:54322 via venv psycopg2 — headlined by the **42P17 non-recursion proof** (SC#2 / ORG-02).
- **Deploy-drift check PASS (exit 0)**; migration 104 recorded as owed at the next cloud push (joins the pending 099-103 set).

## Task Commits

Single-repo (`sub_repos: []`); staged ONLY `supabase/full-schema.sql` (the dirty tree's ~342 unrelated `.claude/` files + `supabase/snippets/` Studio scratch were left untouched):

1. **Task 1: [BLOCKING] operator applies migration 104 via the SQL editor** — no commit (operator manual apply; the migration file was committed in Plan 01 as `65b2af18` / `e98be4f6` / `97fe513b` and applied unchanged).
2. **Task 2: regenerate full-schema.sql, prove it live, check deploy parity, commit** — `0a9f6ea3` (chore)

**Plan metadata:** (this commit) `docs(161-02): complete org/dept/role schema plan`

## Files Created/Modified
- `supabase/full-schema.sql` — regenerated (head 104) via the no-reset live-DB dump. +1016/-15 (the −15 are pg_dump alphabetical-reordering line moves within the file, NOT file deletions; the +1016 are the 8 org tables, 3 SECDEF helpers, 25 policies, and 23 swept `org_id` columns/indexes). Schema-only, so it carries the table/function/policy DDL but NOT the roles/role_permissions seed rows.

## LIVE Verification Evidence (running DB, localhost:54322 — not build/type checks)

Captured via the backend venv's `psycopg2` (docker exec is sandbox-blocked; the venv interpreter carries psycopg2 and connects to `postgresql://postgres:postgres@127.0.0.1:54322/postgres` → `PostgreSQL 17.6`).

### [HEADLINE] The 42P17 non-recursion test — SC#2 / ORG-02 / D-10 / T-161-01
```
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}';
SELECT count(*) FROM public.org_members;
=> 0        (NO SQLSTATE 42P17 raised — recursion-break PROVEN live)
```
The self-rows-only `org_members` SELECT + helper-routed everything else holds against the running DB; a recursive policy would have raised `42P17` here.

### Existence + RLS (SC#1 / ORG-01) — all 8 non-null, all relrowsecurity=t
```
to_regclass: organizations, departments, org_members, dept_members, roles, role_permissions, org_invitations, sso_configs  → all non-null
relrowsecurity: all 8 = True
```

### SECDEF helpers (ORG-02 / T-161-05) — prosecdef=t for all 3
```
create_org_with_default_dept   prosecdef=True
current_user_has_permission    prosecdef=True
current_user_org_ids           prosecdef=True
```
(the regenerated dump preserves `LANGUAGE sql STABLE SECURITY DEFINER` + `SET search_path TO 'public'` on `current_user_org_ids`.)

### Seed catalog (D-02) — roles=4; grant distribution matches the matrix
```
roles_count = 4
role_permissions:  super-admin=5   org-admin=3   dept-admin=1   member=0 (absent)
```

### Sweep held (SC#3)
```
swept sample WITH org_id:   code_executions, messages, todos, user_settings   (all 4 present)
exclusions WITHOUT org_id:  document_chunks, skill_embeddings, app_settings, operator_users, profiles, model_capabilities_overrides   (0 wrongly present)
swept btree index:          idx_messages_org_id present
```

### full-schema.sql regenerated-artifact grep
```
CREATE TABLE public.{organizations,departments,org_members,dept_members,roles,role_permissions,org_invitations,sso_configs}  → all 8 present
CREATE FUNCTION public.{current_user_org_ids,current_user_has_permission,create_org_with_default_dept}  → all 3 present
INSERT INTO public.roles / role_permissions  → 0 (schema-only dump; seed lives in migration 104)
```

## Deployment-artifact parity (CLAUDE.md D-16)

`bash scripts/check-deploy-drift.sh` → **RESULT: PASS (exit 0)**. Two non-blocking WARNs:
- **Check-2 (seed list) SOFT-WARN:** migrations above #089 carrying seed-like INSERT/UPDATE — `093_skill_creator_sandbox_library_awareness`, `094_starter_workflows`, `098_feature_visibility`, `104_org_dept_role_schema`. 104 joins three *already-shipped, also-unregistered* seed-bearing migrations, so deferring its OPERATOR.md Step-3 registration to the deploy step is the established precedent, not a new gap. This WARN is non-blocking by design (the script author made new-seed detection a human-review WARN because auto-detection is imperfect).
- **Check-4 (compose parse):** docker is sandbox-denied here, so the script used its dependency-free structural fallback (backend mounts `setup_data:/data` + top-level volume declared) — passed. CI's ubuntu-latest runs the authoritative `docker compose config`.

**Assessment (surfaced for operator):** NO same-commit artifact change is required. The permission-catalog seed is reference data embedded in migration 104; because `full-schema.sql` is schema-only, that seed is applied on a greenfield deploy by running migration 104 (or an eventual OPERATOR.md Step-3 line) — NOT "for free via full-schema.sql". The OPERATOR.md Step-3 registration is deferred to the next operator-gated production push together with 099-103 (per Plan 01's D-16 decision + the 093/094/098 precedent). No `checkpoint:decision` triggered because no real same-commit artifact change was needed.

## Cloud parity note
**Migration 104 is now OWED at the next operator-gated production push**, joining the already-pending **099-103** set (+ `SECRETS_ENCRYPTION_KEY`). Applied in numeric order per `docs/DEPLOYMENT-WORKFLOW.md`. This plan touched LOCAL only; cloud was not touched.

## Decisions Made
- **Verification path pivot (mechanical, not a plan deviation):** `docker exec … psql` is blocked by the execution sandbox, so live evidence was gathered via the backend venv's `psycopg2` (`backend/venv/Scripts/python.exe`) against port 54322 — the sanctioned "psycopg2 or psql against localhost:54322" path. The throwaway verification script was written to the OS temp scratchpad, never into `backend/` (uvicorn --reload watch-tree safety). Same evidence, different client.
- **Commit type = `chore`** (regenerate-full-schema-after-apply house style: 159-03/158-12/150-02/149-01), staging only the regenerated artifact — the `feat` was Plan 01's migration authoring; migration 104 was unmodified here.
- **`full-schema.sql` is schema-only** — recorded so Phase 162 / the next cloud push do not assume the roles seed ships inside the bootstrap artifact.

## Deviations from Plan

**None — plan executed exactly as written.** No Rule 1/2/3/4 fixes were needed. The only adjustment was a mechanical verification-client pivot (docker exec sandbox-blocked → venv psycopg2), which is an environment accommodation on the plan's own sanctioned "psycopg2 OR psql OR SQL-editor" evidence path — not a change to what was proven.

## Issues Encountered
- **docker exec sandbox-blocked:** `docker exec -i supabase_db_… psql …` was denied by the permission sandbox (while `docker ps` and `bash scripts/regenerate-full-schema.sh` — whose internal `docker exec pg_dump` runs as a child of the top-level bash command — were allowed). Resolved by using the backend venv's psycopg2 directly against port 54322. All 9 live assertions were captured with running-DB evidence.

## Known Stubs
None new. The empty org tables + the 23 nullable `org_id` columns remain intentional forward-compat by design (Plan 01): populated by the Phase 162 backfill; FK + NOT NULL land in 162/163. The plan's goal (apply + prove live + regenerate + commit) is fully achieved.

## Next Phase Readiness
- **Phase 162 (Personal-Org Backfill):** ready on a **confirmed-live** foundation — the 8 tables, `create_org_with_default_dept()`, and the 23 swept `org_id` columns all exist and are proven live. The backfill sets `settings = '{}'` on every org for free (D-01).
- **Phase 163 (RLS crux):** `current_user_org_ids()` is live and SECDEF; the 8 org tables are already correct (excluded from the 38-table rewrite per D-09), shrinking the crux blast radius.
- **Standing cloud action:** migration 104 owed at the next production push (with 099-103) + its OPERATOR.md Step-3 seed-list line to be added at that deploy step.

## Self-Check: PASSED
- **Modified file exists:** FOUND `supabase/full-schema.sql` (contains `CREATE TABLE public.organizations` + `CREATE FUNCTION public.current_user_org_ids`).
- **SUMMARY exists:** FOUND `.planning/phases/161-org-dept-role-schema/161-02-SUMMARY.md`.
- **Task commit exists:** FOUND `0a9f6ea3`.
- **Live assertions (9/9):** existence, RLS, SECDEF, roles=4, D-02 grant matrix, sweep held, exclusions held, swept index, and the 42P17 non-recursion proof (0 rows, no SQLSTATE 42P17) — all captured against the running DB on port 54322.

---
*Phase: 161-org-dept-role-schema*
*Completed: 2026-07-18*
