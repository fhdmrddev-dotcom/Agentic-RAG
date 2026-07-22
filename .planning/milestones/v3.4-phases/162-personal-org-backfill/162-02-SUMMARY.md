---
phase: 162-personal-org-backfill
plan: 02
subsystem: database
tags: [postgres, supabase, migration, org_id, backfill, multi-tenancy, rls-prep, handle_new_user, idempotent-apply, full-schema]

# Dependency graph
requires:
  - phase: 162-personal-org-backfill (Plan 01)
    provides: "supabase/migrations/105_personal_org_backfill.sql — AUTHORED: personal-org provisioning loop + defensive handle_new_user + batched-COMMIT org_id backfill (35 tables) + 35 self-guarded NOT-NULL flips"
  - phase: 161-org-dept-role-schema
    provides: "mig 104 — create_org_with_default_dept() helper, org_members + unique constraint, 23-table nullable org_id sweep, 4-tier role CHECK"
provides:
  - "APPLIED local DB: 8 users -> 8 personal orgs + 8 default General departments + 8 org-admin memberships; org_id backfilled + flipped NOT NULL across all 35 targets"
  - "MIG-01 COMPLETE — the org_id substrate + org-admin memberships Phase 163's RLS crux consumes are now populated and verified (SC#1-4 PASS)"
  - "supabase/full-schema.sql regenerated (no --reset) reflecting the applied 105 — greenfield bootstrap now provisions personal orgs for new signups"
affects: [163-rls-rewrite, 165-is-global-retirement, 166-org-admin-shell, 167-invitations, 168-sso]

# Tech tracking
tech-stack:
  added: []  # no packages; Postgres 17.6 built-ins + the mig-104 helper only
  patterns:
    - "Non-atomic apply for batched-COMMIT migrations: psycopg2 conn.autocommit=True @ :54322 (a single wrapping-transaction paste raises 'invalid transaction termination', Pitfall 1)"
    - "Surgical, self-restoring immutability-trigger bypass: ALTER TABLE .. DISABLE TRIGGER <named> around a one-time backfill CALL, ENABLE immediately after — table-ownership-only (cloud-safe, no superuser)"
    - "Deploy-artifact parity for handle_new_user: the full-schema SUPPLEMENT copy is appended LAST (wins the greenfield paste) so it MUST mirror the applied migration body — kept in sync in the same commit"

key-files:
  created:
    - ".planning/phases/162-personal-org-backfill/162-BASELINE.md — machine-parseable pre-apply SC#3 before-image (39 keys: 35 target row-counts + 4 is_global/is_system census)"
  modified:
    - "supabase/migrations/105_personal_org_backfill.sql — two apply-time corrections (Bug-1 non-id PK paging; Bug-2 surgical trigger-wrap)"
    - "supabase/full-schema.sql — regenerated from the applied live DB (no --reset)"
    - "scripts/full-schema-supplement.sql — Rule 1/2 fix: handle_new_user body updated to mirror mig 105 §D (was the stale pre-105 body, clobbering the extension in a greenfield paste)"

key-decisions:
  - "Applied via psycopg2 autocommit (proven mig-104/161 path); never db push/db reset; LOCAL only — cloud parity deferred to the next operator-gated push"
  - "Bug-2 immutability triggers are DISABLED only for their single backfill CALL then re-ENABLED immediately — normal-app row immutability is fully restored; the mechanism is cloud-safe (needs table ownership, which postgres has)"
  - "operator_audit_log stays the ONLY org_id-nullable table (D-11) — it has no owning auth.users; 163's RLS predicate must handle its NULL org_id"
  - "metadata_field_definitions flipped NOT NULL locally (0 NULL-owner rows) — the self-guard passed; a cloud DB with NULL-owner system field-defs would self-abort and defer to operator per D-11/A1"
  - "The full-schema supplement's handle_new_user must stay byte-for-byte in step with the migration (it is the last/effective definition in a greenfield paste) — added an in-file keep-in-sync note"

patterns-established:
  - "Author-then-apply migration split closes here: Plan 01 authored+committed the .sql; Plan 02 applied it live, proved SC#1-4, regenerated full-schema.sql, committed all same-commit (D-06)"
  - "SC#3 'nothing disappeared' proof = a committed machine-parseable BASELINE before-image diffed against live counts after apply (zero delta)"

requirements-completed: [MIG-01]

# Metrics
duration: ~48min (across continuation agents: baseline -> apply+verify -> regen+commit)
completed: 2026-07-18
---

# Phase 162 Plan 02: Personal-Org Backfill (Apply) Summary

**Migration 105 applied to the local DB via psycopg2 autocommit — 8 users provisioned into 8 personal orgs (+ default depts + org-admin memberships), org_id backfilled and flipped NOT NULL across all 35 targets (only `operator_audit_log` stays nullable), a re-apply proven idempotent, and `full-schema.sql` regenerated so a greenfield bootstrap also provisions personal orgs. MIG-01 COMPLETE.**

## Performance

- **Duration:** ~48 min (baseline capture 20:08:59Z → apply/verify → regen + D-06 commit ~20:56Z, across continuation agents)
- **Completed:** 2026-07-18
- **Tasks:** 3 (Task 1 baseline; Task 2 BLOCKING apply + SC#1-4 verify + idempotency; Task 3 regen + same-commit)
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- **Applied migration 105 non-atomically** (psycopg2 `conn.autocommit=True` @ 127.0.0.1:54322 — the proven mig-104/161 path; a wrapping-transaction paste would raise "invalid transaction termination" on the batched COMMIT). LOCAL only; never `db push`/`db reset`.
- **SC#1 PASS (coverage + shape)** — live-confirmed: `auth.users`=8, `organizations`=8, `org_members` role=org-admin=8, `departments`=8; **0 duplicate-membership rows**, **0 multi-default orgs** (exactly one default dept per org).
- **SC#2 PASS (nullable set post-flip)** — the ONLY org_id-nullable column left is `operator_audit_log`; all 35 backfill targets are NOT NULL, **including `metadata_field_definitions`** (its self-guard passed locally — 0 NULL-owner rows — so it flipped).
- **SC#3 PASS (nothing disappeared)** — every one of the 35 target row-counts and the 4-key is_global/is_system census (folders=1, skills global=1, skills system=1, workflow_definitions=15) are **identical** to the committed `162-BASELINE.md` before-image (zero delta).
- **SC#4 PASS (idempotency)** — a full re-apply of 105 left org/member counts identical (no duplicate orgs, no lock-storm); the batched `RAISE NOTICE` NOTICEs showed M ≤ 10000 with a per-batch COMMIT.
- **Regenerated `supabase/full-schema.sql`** (no `--reset` — live-DB dump preserving dev data) so the single-file greenfield bootstrap reflects the applied 105 (extended `handle_new_user` + backfilled/NOT-NULL org_id).
- **Committed all deliverables SAME-COMMIT (D-06):** `f3281cce`.

## Task Commits

Per the apply/verify/commit plan design, all three tasks' file deliverables consolidated into the single D-06 same-commit (Task 2's work was a live-DB mutation + the two apply-time migration-file corrections; Task 1's baseline + Task 3's regen landed alongside):

1. **Task 1 (baseline) + Task 2 (apply-time migration fixes) + Task 3 (regen + schema)** — `f3281cce` (feat) — the D-06 same-commit.

_No per-task commits: the migration `.sql` was already committed in Plan 01 (`1d10605c`/`b0b24bf3`/`aad6391a`); this plan applies it live and commits the apply-time corrections + regenerated artifact + baseline together per D-06._

## Files Created/Modified
- `.planning/phases/162-personal-org-backfill/162-BASELINE.md` (created) — the pre-apply SC#3 before-image: 39 machine-parseable `| key | count |` rows (35 targets + 4 census) captured read-only before apply.
- `supabase/migrations/105_personal_org_backfill.sql` (modified) — two apply-time corrections (below).
- `supabase/full-schema.sql` (modified) — regenerated from the applied live DB (no --reset); 5467 lines.
- `scripts/full-schema-supplement.sql` (modified) — `handle_new_user` body brought in sync with mig 105 §D (Rule 1/2 fix, below).

## Decisions Made
- **Apply path = psycopg2 autocommit**, not the SQL editor — automation-first, the proven mig-104/161 path, and the only way the batched per-target COMMIT is legal.
- **`operator_audit_log` intentionally left org_id-nullable** (D-11) — org-agnostic system data with no owning `auth.users`; 163's RLS must special-case its NULL org_id.
- **`metadata_field_definitions` flipped NOT NULL** — the self-guard census found 0 NULL-owner rows locally, so the guarded `SET NOT NULL` proceeded (matches SC#2's "iff kept nullable" being resolved to "flipped" locally). Cloud, if it holds NULL-owner global field-defs, would self-abort and defer to the operator (A1/D-11).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Page `runs` by `run_id` and `user_settings` by `user_id` (neither has an `id` column)**
- **Found during:** Task 2 (apply).
- **Issue:** The authored backfill CALLs paged every target with `... AND t.id IN (SELECT id FROM <table> WHERE org_id IS NULL LIMIT $1)`, but `public.runs` (PK `run_id`) and `public.user_settings` (PK `user_id`) have **no `id` column** — the CALL errored at apply time.
- **Fix:** Changed those two CALLs to page by their real PK (`run_id` / `user_id`). Logic otherwise identical; `WHERE org_id IS NULL` keeps them re-run-safe.
- **Files modified:** `supabase/migrations/105_personal_org_backfill.sql`
- **Verification:** Apply completed; SC#3 shows `runs`/`user_settings` row-counts unchanged vs baseline and both org_id columns flipped NOT NULL.
- **Committed in:** `f3281cce`

**2. [Rule 3 - Blocking] Surgical DISABLE/ENABLE of two immutability triggers around their one-time backfill CALL**
- **Found during:** Task 2 (apply).
- **Issue:** `public.skill_versions` carries `skill_versions_no_update` (rejects ANY UPDATE) and `public.workflow_definitions` carries `workflow_definitions_block_published` (rejects org_id change on published rows) — both blocked the one-time org_id backfill UPDATE.
- **Fix:** Wrapped ONLY those two CALLs in `ALTER TABLE .. DISABLE TRIGGER <named>` / `ENABLE TRIGGER <named>` so each trigger is off only for its own backfill and **re-enabled immediately after** (row immutability fully restored for all normal app operations). Left the unrelated `workflow_definitions_set_updated_at` untouched. Cloud-safe: DISABLE/ENABLE TRIGGER needs table ownership only (postgres owns the tables), not superuser. Re-paste-safe: a re-apply updates 0 rows and the triggers end ENABLED.
- **Files modified:** `supabase/migrations/105_personal_org_backfill.sql`
- **Verification:** SC#4 re-apply idempotent; both triggers verified ENABLED after apply; `skill_versions`/`workflow_definitions` org_id flipped NOT NULL with row-counts unchanged.
- **Committed in:** `f3281cce`

**3. [Rule 1/Rule 2 - Bug + Missing Critical] full-schema supplement `handle_new_user` was stale — clobbered the mig-105 extension in a greenfield paste**
- **Found during:** Task 3 (regen).
- **Issue:** `regenerate-full-schema.sh` appends `scripts/full-schema-supplement.sql` AFTER the public pg_dump. The supplement carried the **pre-105 minimal** `handle_new_user` (profile-insert only, no personal-org creation, no `EXCEPTION WHEN OTHERS`). Its `create or replace` is therefore the **last/effective** definition in a greenfield bootstrap — so a fresh deploy pasted from `full-schema.sql` would create the OLD function and **provision NO personal org for new signups** (breaking the org model in that env) and drop the defensive signup-safe swallow. The Task-3 grep gate alone would still pass (the extended body exists in the dump portion), masking the defect.
- **Fix:** Updated the supplement's `handle_new_user` to mirror mig 105 §D verbatim (personal-org provisioning + inner `EXCEPTION WHEN OTHERS` swallow + `ON CONFLICT`, keeping SECURITY DEFINER + pinned search_path), added a keep-in-sync maintenance note, then re-ran the regen so `full-schema.sql`'s effective `handle_new_user` provisions personal orgs. Both copies (dump + supplement) now agree, making the last-wins redundancy benign.
- **Files modified:** `scripts/full-schema-supplement.sql`, `supabase/full-schema.sql` (re-regenerated)
- **Verification:** `full-schema.sql` now has `EXCEPTION WHEN OTHERS` in BOTH the dump copy (line ~197) and the supplement copy (line ~5442); both reference `create_org_with_default_dept`. This 4th file rides in the same D-06 commit because `full-schema.sql` is regenerated FROM it (reproducibility) and it is the source that makes the D-06 artifact correct.
- **Committed in:** `f3281cce`

---

**Total deviations:** 3 auto-fixed (2 apply-time migration corrections during Task 2; 1 deploy-artifact correctness fix during Task 3).
**Impact on plan:** No change to the SQL's intended behavior or the 35-target scope. Bug-1/Bug-2 were required to apply at all; the supplement fix is required for the regenerated artifact to actually "reflect the applied 105" (Task 3's stated purpose) and to keep greenfield deploys correct per CLAUDE.md deploy-artifact discipline. The supplement made the commit 4 files instead of the planned 3 — it is a documented Rule 1/2 correctness fix, not scope creep, and no pre-existing noise (`.claude/`, `supabase/snippets/`, `supabase/.temp/`) was swept in.

## Issues Encountered
- The two immutability triggers and the two non-`id` PKs were only discoverable at apply time (they are live-DB facts, not visible in the authored file). Both were handled inline as re-paste-safe corrections (deviations 1 & 2) rather than blocking.

## Cloud Parity Reminder
**Migration 105 is owed on cloud.** It joins the pending-cloud set — apply **099 → 100 → 101 → 102 → 103 → 104 → 105** in order at the next operator-gated production push, plus set `SECRETS_ENCRYPTION_KEY`. Cloud was NOT touched by this plan. 162 is NOT seed-bearing (it writes user-owned rows, no reference data), so no `docs/OPERATOR.md` Step-3 seed-list change and no `scripts/check-deploy-drift.sh` entry are needed (D-16 parity satisfied by exclusion).

## User Setup Required
None — the apply is the only live action and it is complete on local. Cloud apply is operator-gated (see Cloud Parity Reminder).

## Next Phase Readiness
- **Phase 163 (atomic RLS + user-JWT crux):** ready — `org_id` is populated and NOT NULL across all 35 targets, every user has exactly one org-admin membership, `current_user_org_ids()` has real rows to resolve, and `operator_audit_log`'s deliberate NULL org_id is documented for 163's RLS predicate.
- **Deep Mode / agent loop / retrieval:** byte-identical — RLS stays service-role-bypassed until 163 (D-14 satisfied by construction).
- **No blockers.**

## Self-Check: PASSED

- **Created/modified files exist:** `162-BASELINE.md` (FOUND), `supabase/full-schema.sql` (FOUND, regenerated), `scripts/full-schema-supplement.sql` (FOUND, fixed), `supabase/migrations/105_personal_org_backfill.sql` (FOUND, apply-time fixes), `162-02-SUMMARY.md` (this file).
- **D-06 commit exists:** `f3281cce` — `git show --stat` lists exactly the 4 deliverable files; no `.claude/` / `supabase/snippets/` / `supabase/.temp/` noise.
- **Task 3 verify gate:** PASS (handle_new_user + EXCEPTION WHEN OTHERS present in full-schema.sql; 105 + full-schema.sql in HEAD).
- **Applied-state live re-check:** users=orgs=admin_members=departments=8; 0 dup; 0 multi-default; org_id-nullable set = {operator_audit_log}; metadata_field_definitions org_id NOT NULL.

---
*Phase: 162-personal-org-backfill*
*Completed: 2026-07-18*
