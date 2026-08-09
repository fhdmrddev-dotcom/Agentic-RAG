---
phase: 162-personal-org-backfill
plan: 01
subsystem: database
tags: [postgres, supabase, migration, org_id, backfill, multi-tenancy, rls-prep, handle_new_user, plpgsql-procedure]

# Dependency graph
requires:
  - phase: 161-org-dept-role-schema
    provides: "mig 104 — create_org_with_default_dept() helper, org_members table + org_members_org_user_unique, the 23-table nullable org_id sweep, the 4-tier role CHECK"
  - phase: 160-tenancy-model-adr
    provides: "D-v3.4-01 naming locks (is_system_global/is_org_shared) + the 4-tier flexibility contract that 162 must not make any tier harder"
provides:
  - "supabase/migrations/105_personal_org_backfill.sql — AUTHORED (not yet applied): idempotent personal-org provisioning + defensive handle_new_user trigger + batched-COMMIT org_id backfill across 35 tables + 35 self-guarded NOT-NULL flips"
  - "The org_id substrate + org-admin memberships that Phase 163's RLS crux consumes (populated once Plan 162-02 applies)"
affects: [163-rls-rewrite, 165-is-global-retirement, 166-org-admin-shell, 167-invitations, 168-sso]

# Tech tracking
tech-stack:
  added: []  # no packages; Postgres 17.6 built-ins + the mig-104 helper only
  patterns:
    - "Single reusable batched-backfill PROCEDURE (_mig105_backfill) with per-batch COMMIT, CALLed once per target with an explicit resolver — batching logic written once, resolvers auditable per call"
    - "Self-verifying NOT-NULL flip: a RAISE-EXCEPTION zero-NULL guard precedes every SET NOT NULL so the DB (not a human) enforces zero-NULL"
    - "Personal-org identity = membership-existence gate (Option B) — no is_personal/joined_via marker column added"
    - "org_id = home org, sharing flag = reach — global/system rows land in owner's personal org; HANDS-OFF is_global/is_system"

key-files:
  created:
    - "supabase/migrations/105_personal_org_backfill.sql (606 lines) — the complete §A+§D+§B+§C migration"
  modified: []

key-decisions:
  - "Committed the authored .sql per-task (staging only the migration file) per the orchestrator's explicit critical_constraints + the mig-104 author-plan precedent — full-schema.sql regeneration + apply deferred to Plan 162-02 (see Deviations)"
  - "Batch size 10000; procedure named public._mig105_backfill(text,int), dropped at end of §C"
  - "metadata_field_definitions gets the SAME RAISE-guarded flip as the other 34 (not unconditional) — flips iff apply-time is zero-NULL, self-aborts otherwise (D-11 / A1 cloud caveat)"
  - "operator_audit_log EXCLUDED from backfill and kept NULLABLE (D-11 resolved) — no owning auth.users; 163 RLS must handle its NULL org_id"
  - "§A uses COALESCE(email, id::text) so its logic is byte-identical to §D's defensive path (minor hardening; see Deviations)"

patterns-established:
  - "Batched-COMMIT procedure + per-table CALL resolver is the cloud-scale backfill vehicle (extends mig 096's child-via-parent-FK precedent)"
  - "Author-then-apply migration split: Plan 01 authors + commits the .sql; Plan 02 applies live + regenerates full-schema.sql same-commit"

requirements-completed: []  # MIG-01 is AUTHORED here but COMPLETES at Plan 162-02 (live apply + SC#1-4 verification); left Pending in REQUIREMENTS.md

# Metrics
duration: ~19min
completed: 2026-07-18
---

# Phase 162 Plan 01: Personal-Org Backfill (Authoring) Summary

**Idempotent migration 105 authored: personal-org provisioning loop + a defensive `handle_new_user` trigger that can never abort signup + a single batched-COMMIT procedure backfilling `org_id` across 35 user-facing tables in 3 ordered waves + 35 self-guarded NOT-NULL flips — HANDS-OFF `is_global`/`is_system`, machine-verified re-paste-safe, not yet applied.**

## Performance

- **Duration:** ~19 min
- **Started:** 2026-07-18T19:32:00Z
- **Completed:** 2026-07-18T19:51:23Z
- **Tasks:** 3
- **Files modified:** 1 (created)

## Accomplishments
- **§A personal-org loop** — a normal transactional `DO` block (no per-iteration COMMIT) creates one personal org (`"{email}'s Organization"`, tier NULL, default `'General'` dept) + an `org-admin` membership for every `auth.users` row, gated by `NOT EXISTS (org_members WHERE user_id=…)` and `ON CONFLICT (org_id,user_id) DO NOTHING` — idempotent by construction (T-162-01).
- **§D defensive trigger** — `CREATE OR REPLACE FUNCTION public.handle_new_user` keeps `SECURITY DEFINER` + pinned `SET search_path TO 'public'` (T-162-06), hardens the profiles insert with `ON CONFLICT (id) DO NOTHING`, and wraps identical personal-org creation in an inner `BEGIN…EXCEPTION WHEN OTHERS…RAISE WARNING…END` swallow so org-creation failure can NEVER abort the `auth.users` INSERT / break signup (T-162-05). The `on_auth_user_created` trigger is NOT re-created (already exists).
- **§B batched backfill** — one reusable `public._mig105_backfill(p_sql, p_batch DEFAULT 10000)` procedure loops `EXECUTE … LIMIT $1 → GET DIAGNOSTICS → RAISE NOTICE → COMMIT → EXIT WHEN 0`; 35 explicit resolver CALLs in 3 waves (31 direct-owner via user_id/created_by; 3 parent-FK children via threads/workspace_files; workflow_phases via workflow_runs — Wave 3 after Wave 2). Every UPDATE keeps `WHERE org_id IS NULL` (re-run-safe) + a `LIMIT $1` batch bound (lock-storm mitigation T-162-02).
- **§C self-guarded flips** — a pre-flip NULL census (UNION over the 35 targets) then 35 flips, each preceded by a `RAISE EXCEPTION` zero-NULL guard so the flip is structurally impossible on dirty data (T-162-03); the procedure is dropped afterward.
- **HANDS-OFF `is_global`/`is_system` (D-04, T-162-04)** — machine-verified (comment-stripped grep in Tasks 2 & 3): those sharing flags appear in NO SQL statement; resolution is purely via `user_id`/`created_by`/parent `org_id`, so no shared/system resource can lose reach. The rename stays in Phase 165 (D-05).

## Task Commits

Each task was committed atomically (single-repo; each commit staged ONLY the migration file):

1. **Task 1: §A personal-org loop + §D handle_new_user trigger** — `1d10605c` (feat)
2. **Task 2: §B batched procedure + 35 resolver CALLs (3 waves)** — `b0b24bf3` (feat)
3. **Task 3: §C pre-flip census + 35 self-guarded NOT-NULL flips + DROP** — `aad6391a` (feat)

**Plan metadata:** (this commit) `docs(162-01): complete personal-org-backfill authoring plan`

Each task's automated grep gate returned **PASS** (Task 1: trigger/SECDEF/gate/no-stale-columns; Task 2: procedure + all 35 tables + exclusions + no is_global/is_system in SQL + wave order; Task 3: exactly 35 flips + ≥35 guards + operator_audit_log unflipped + DROP + comment-stripped is_global/is_system absence).

## Files Created/Modified
- `supabase/migrations/105_personal_org_backfill.sql` (606 lines) — the complete idempotent backfill migration: header (apply discipline + cloud-parity + NOT-seed-bearing) → §A provisioning loop → §D defensive trigger → §B batched procedure + 35 CALLs → §C census + 35 guarded flips + DROP + is_global HANDS-OFF closing note.

## Decisions Made
- **Idempotency gate = Option B (membership-existence):** `NOT EXISTS (SELECT 1 FROM org_members WHERE user_id=…)`; no `is_personal`/`joined_via`/`slug` referenced or added (they do not exist — Pitfall 4). Both §A and §D use the identical gate + membership shape.
- **Batch size 10000; procedure `public._mig105_backfill(text,int)`** — single parameterized batching procedure (COMMIT loop written once) invoked with each table's explicit resolver (auditable per call); dropped at the end of §C.
- **`metadata_field_definitions` — guarded flip, not unconditional:** same RAISE-guarded `SET NOT NULL` as the other 34; locally 0 NULL-owner rows so it flips, but if a cloud DB holds NULL-owner global system field-defs the guard FIRES and the operator decides at apply time (D-11 fallback = keep nullable). Flagged inline as Assumption A1.
- **`operator_audit_log` — excluded + nullable (D-11 resolved by evidence):** it carries `org_id` but has no owning `auth.users` (its `operator_user_id` → `operator_users`, outside the org model), so it is org-agnostic system data. No backfill, no flip; an inline comment records that Phase 163's RLS predicate MUST handle its NULL `org_id`.
- **`org_id = home org, sharing flag = reach`** — the 1 global folder / 1 global skill / 1 system skill-creator / 15 global workflow_definitions all resolve to their owner's personal org; no synthetic system org invented (D-09).

## Deviations from Plan

### 1. [Commit scope] Committed the authored `.sql` per-task (plan text said "authored-but-uncommitted")

- **Found during:** Execution start (planning the commit strategy).
- **Issue:** The PLAN objective/output say "This plan AUTHORS only — it does NOT ... commit the SQL" and "authored-but-uncommitted (Plan 02 ... commits it same-commit with the regenerated full-schema.sql)." This directly conflicts with the orchestrator's `critical_constraints`: *"Authoring + **committing** the .sql file ... is the full scope. Live DB apply + verification is Plan 162-02,"* and with success-criterion *"Each task committed individually."*
- **Resolution:** Followed the orchestrator's explicit direction + the actual mig-104 precedent. Phase 161-01 (the author plan the 162 plan says it "mirrors") **did** commit the migration per-task ("each commit staged ONLY the migration file"; commits `65b2af18`/`e98be4f6`/`97fe513b`), and full-schema.sql was regenerated + committed **separately** in Plan 02 (`0a9f6ea3`). So the migration `.sql` is committed here (per-task, migration-file-only); **apply + `regenerate-full-schema.sh` + the D-06 same-commit of full-schema.sql remain Plan 162-02's job.** The plan's "uncommitted" language rested on a mis-statement of the 161 precedent; committing the authored file now does not violate D-06 (whose "same-commit" pairs the migration's *regenerated schema dump* with apply, exactly the 161 pattern).
- **Files modified:** `supabase/migrations/105_personal_org_backfill.sql`
- **Verification:** `git log` shows 3 task commits, each `1 file changed`; the pre-existing `.claude/*` modifications were never staged.
- **Committed in:** `1d10605c`, `b0b24bf3`, `aad6391a`

### 2. [Rule 2 - Hardening] §A uses `COALESCE(u.email, u.id::text)` for the org name

- **Found during:** Task 1 (§A authoring).
- **Issue:** RESEARCH's §A loop used bare `u.email || '''s Organization'`; §D's trigger uses `COALESCE(new.email, new.id::text) || …`. A single NULL-email row at cloud scale would make `NULL || 'x' = NULL`, violating `organizations.name NOT NULL` and rolling back the WHOLE §A block.
- **Fix:** §A uses `COALESCE(u.email, u.id::text) || '''s Organization'`, making its logic byte-identical to §D's defensive path (the plan explicitly wants the two creation paths to be "identical logic"). Locally all 8 users have non-NULL email so behavior is unchanged; this is pure cloud-scale insurance.
- **Files modified:** `supabase/migrations/105_personal_org_backfill.sql`
- **Verification:** Task 1 grep gate PASS; identical membership shape as §D.
- **Committed in:** `1d10605c`

---

**Total deviations:** 2 (1 commit-scope reconciliation, 1 Rule-2 minor hardening).
**Impact on plan:** No scope change to the SQL's behavior vs. the plan's spec (all 35 targets, all guards, all D-01…D-11 honored). The commit-scope reconciliation follows the orchestrator's explicit instruction + established precedent; the COALESCE hardening only strengthens cloud-scale robustness.

## Issues Encountered
- **Task-2 exclusion grep is point-in-time.** Task 2's `! grep -Eq "operator_audit_log|…"` must run on the Task-2 file state (before §C). §C legitimately adds an `operator_audit_log` *exclusion comment* (required by Task 3's acceptance). Resolved by building the file incrementally and running each task's grep on its own incremental state; final-file check confirms `operator_audit_log` appears **only** in `--` comments (never in live SQL), and `document_chunks`/`skill_embeddings` are fully absent.

## User Setup Required
None — no external service configuration. Note: this file is **authored + committed but NOT applied**. Live application is operator-gated in **Plan 162-02**: run mig 105 via psycopg2 `autocommit=True` @ `:54322` (proven path — the per-batch COMMIT is only legal in a non-atomic/autocommit context; a single wrapping-transaction paste raises "invalid transaction termination", Pitfall 1) OR paste into the LOCAL SQL editor running each `CALL` separately — never `db push`/`db reset`. Then `bash scripts/regenerate-full-schema.sh` (no `--reset`) and commit the migration + regenerated `full-schema.sql` together (D-06). 105 joins the pending-cloud set (099–104 + `SECRETS_ENCRYPTION_KEY`).

## Next Phase Readiness
- **Plan 162-02 (BLOCKING apply/verify):** ready — the file is authored, ordered for a single top-to-bottom apply, grep-verified, and re-paste-safe (gate-on-no-personal-org, `WHERE org_id IS NULL`, `ON CONFLICT DO NOTHING`, `CREATE OR REPLACE`, IF-EXISTS guards). Plan 02 applies it locally, runs the SC#1–4 verification-query pack (personal-org coverage; zero-NULL census; is_global/is_system reach unchanged; idempotent re-paste), regenerates `full-schema.sql`, and commits both same-commit. **MIG-01 completes there** (left Pending in REQUIREMENTS.md here).
- **Downstream:** 163 consumes the populated `org_id` + memberships + `current_user_org_ids()`; 165 owns the `is_global` → `is_org_shared` rename (D-05 handoff); 167/168 layer invitations/SSO-join onto 162's universal personal org.
- **No blockers.** Deep Mode stays byte-identical (RLS still service-role-bypassed until 163).

## Self-Check: PASSED

- **Created files exist:** `supabase/migrations/105_personal_org_backfill.sql` (FOUND), `162-01-SUMMARY.md` (FOUND).
- **Task commits exist:** `1d10605c` (FOUND), `b0b24bf3` (FOUND), `aad6391a` (FOUND).
- **Structural gates:** all 3 task greps PASS; whole-file re-check — 35 CALLs / 35 flips / 35 guards, 38 `$$` + 35 `$SQL$` balanced pairs, census = 35 targets, `operator_audit_log` comment-only, `document_chunks`/`skill_embeddings` absent, is_global/is_system absent from all SQL (comment-stripped).

---
*Phase: 162-personal-org-backfill*
*Completed: 2026-07-18*
