---
phase: 162-personal-org-backfill
plan: 03
subsystem: database
tags: [postgres, supabase, migration, org_id, trigger, before-insert, security-definer, multi-tenancy, rls-prep, idempotent-apply, full-schema, gap-closure]

# Dependency graph
requires:
  - phase: 162-personal-org-backfill (Plan 02)
    provides: "mig 105 APPLIED — org_id backfilled + flipped NOT NULL across 35 tables; 8 personal orgs + org-admin memberships; this is exactly what broke app-style INSERTs that omit org_id"
  - phase: 161-org-dept-role-schema
    provides: "mig 104 — org_members table + idx_org_members_user_id, SECDEF pinned-search_path hygiene pattern"
provides:
  - "APPLIED local DB: migration 106 — a transitional BEFORE-INSERT org_id auto-fill net across all 35 backfilled tables; app-style INSERTs that omit org_id succeed again with the correctly-resolved org"
  - "The 162 'nothing breaks' goal is genuinely met while org_id stays NOT NULL on all 35 targets (only operator_audit_log stays nullable)"
  - "105+106 are now self-sufficient (deployable together WITHOUT 163) — decouples the cloud deploy per the v3.4 4-tier deployment-flexibility contract (Phase-160 ADR SC#4)"
  - "supabase/full-schema.sql regenerated (no --reset) — greenfield bootstrap now installs the 2 autofill functions + 35 triggers"
affects: [163-rls-rewrite, 165-is-global-retirement, 167-invitations]

# Tech tracking
tech-stack:
  added: []  # no packages; Postgres 17.6 built-ins only
  patterns:
    - "Two shared SECDEF trigger functions parameterised by TG_ARGV (owner column / parent FK+table+PK) serve all 35 targets — to_jsonb(NEW)->>col gives dynamic column access, so no 35 hardcoded functions"
    - "Transitional forward-compat trigger: `IF NEW.org_id IS NOT NULL RETURN NEW` FIRST makes the net a pure no-op the moment Phase 163 threads org_id explicitly (163 supersedes; net kept as a redundant belt)"
    - "Fail-safe by construction: an unresolvable owner leaves org_id NULL so the NOT-NULL constraint (not the trigger) rejects — no silent bad-org row; NOT NULL is checked (ExecConstraints) BEFORE the FK AFTER-trigger, so unknown-user inserts reject as 23502"

key-files:
  created:
    - "supabase/migrations/106_org_id_autofill_trigger.sql — 2 SECDEF pinned-search_path('') functions + 35 BEFORE-INSERT triggers (29 by user_id, 2 by created_by, 4 by parent FK)"
  modified:
    - "supabase/full-schema.sql — regenerated from the applied live DB (no --reset); 5467 -> 5785 lines; captures both functions + all 35 triggers"

key-decisions:
  - "Two-function TG_ARGV design (autofill_org_id_by_owner / autofill_org_id_from_parent) over 35 hardcoded functions — one indexed org_members lookup (or one parent lookup) per insert; negligible for a transitional net"
  - "autofill_org_id_from_parent takes a 3rd TG_ARGV (parent PK, default 'id') to make each trigger site self-documenting and avoid a hidden PK assumption — all 4 parents (threads/workspace_files/workflow_runs) verified live to use `id`"
  - "REVOKE EXECUTE ... FROM PUBLIC on both functions as defense-in-depth (matches the mig-104 SECDEF posture / CR-01 lesson). These fns RETURN trigger (pseudo-type) so PostgREST never exposes them as /rpc anyway, and the REVOKE does NOT affect trigger firing (Postgres skips the EXECUTE check when a trigger fires) — verified live: inserts still auto-fill after the REVOKE"
  - "SET search_path = '' (pinned empty, all refs schema-qualified; pg_catalog implicit) — the strongest SECDEF hygiene, dumped by pg_dump as SET search_path TO ''"
  - "LIMIT 1 on the org_members lookup is unambiguous pre-167 (one membership per user at 162 time); 163 supersedes this net before 167's multi-org invitations land, so no personal-org disambiguation is needed now [Assumption A1]"
  - "No supplement sync needed (contrast mig 105): scripts/full-schema-supplement.sql never references the autofill functions/triggers, so the appended-last supplement cannot clobber them — verified 0 autofill mentions after line 5618"

patterns-established:
  - "Gap-closure via an additive, trivially-reversible BEFORE-INSERT net: closes a NOT-NULL-vs-app-write seam WITHOUT reverting the NOT-NULL flip and WITHOUT waiting for the downstream feature phase (163)"
  - "Acceptance test as the proof-of-close: 5 rolled-back-savepoint cases (autofill / created_by / child-from-parent / explicit-honored / fail-safe-reject) run live, not an illustrative snippet"

requirements-completed: [MIG-01]  # already completed by 162-02; this gap-closure hardens the 'nothing breaks' half of MIG-01

# Metrics
duration: ~30min
completed: 2026-07-18
---

# Phase 162 Plan 03: org_id Auto-Fill Safety Net (Gap-Closure) Summary

**Migration 106 adds a transitional BEFORE-INSERT org_id auto-fill trigger across all 35 backfilled tables — 2 SECURITY-DEFINER pinned-search_path functions parameterised by TG_ARGV — so app-style INSERTs that omit org_id succeed again with the correctly-resolved org, closing the 162→163 NOT-NULL-vs-app-threading seam while org_id stays NOT NULL.**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-07-18T21:34Z
- **Tasks:** 3 (Task 1 author 106; Task 2 apply + acceptance test (a)-(e) + idempotency; Task 3 regen + same-commit)
- **Files modified:** 2 (1 created migration + 1 regenerated full-schema.sql)

## Accomplishments
- **Authored migration 106** — 2 SECDEF, `SET search_path = ''` functions + 35 `BEFORE INSERT ... FOR EACH ROW` triggers, wired per mig 105's exact resolution: 29 GROUP-1 via `user_id`, 2 GROUP-2 via `created_by`, 4 GROUP-3 owner-less children via parent FK (workflow_runs+todos→threads, workspace_file_versions→workspace_files, workflow_phases→workflow_runs). Re-paste-safe (CREATE OR REPLACE + DROP TRIGGER IF EXISTS).
- **Applied LOCAL** via psycopg2 autocommit @ 127.0.0.1:54322 (the proven mig-104/105/161 path); never `db push`/`db reset`; cloud untouched.
- **Acceptance test (a)-(e) all PASS** (rolled-back savepoints, so the DB is not polluted):
  - (a) `threads` insert with ONLY user_id (no org_id) → **succeeds**, org_id == owner's org (`8aa82242…`).
  - (b) `workflow_definitions` insert with created_by + required cols (no org_id) → **succeeds**, org_id == creator's org.
  - (c) `todos` (GROUP-3 child) via a real thread_id (no org_id) → **succeeds**, org_id == parent thread's org.
  - (d) `threads` insert WITH an explicit *different* org_id → **provided value kept** (trigger no-op) — forward-compat proof.
  - (e) `threads` insert with an unknown-user uuid (no membership), no org_id → **rejected by NOT NULL (SQLSTATE 23502 on org_id)** — fail-safe proof (no silent bad-org row).
- **org_id still NOT NULL on all 35 targets** post-106 (106 changes no nullability); `operator_audit_log` correctly stays the only org_id-nullable table (untouched).
- **Idempotent:** re-applying the whole file is a clean no-op — 35 triggers before and after (not doubled); both functions confirmed `prosecdef=true` with `search_path=""`.
- **Regenerated `supabase/full-schema.sql`** (no `--reset`) → 5785 lines; contains both functions (SECURITY DEFINER + `SET search_path TO ''`) and all 35 `CREATE TRIGGER ..._autofill_org_id`. The appended-last supplement has 0 autofill mentions, so it does **not** clobber them.
- **Committed 106 + full-schema.sql SAME-COMMIT (D-06):** `170c5f13`.

## Task Commits

Per the plan's D-06 same-commit design (migration + regenerated schema are one atomic artifact), the code deliverables consolidated into a single commit; this metadata rides in the plan-completion commit:

1. **Task 1 (author 106) + Task 2 (apply — no file change, live DB mutation + verified) + Task 3 (regen full-schema.sql)** — `170c5f13` (feat) — the D-06 same-commit (106 + full-schema.sql, 623 insertions).

_No per-task commits: Task 2's apply is a live-DB action with no file delta of its own; Task 1's authored .sql and Task 3's regenerated artifact are the same atomic deploy pair and commit together._

## Files Created/Modified
- `supabase/migrations/106_org_id_autofill_trigger.sql` (created, 305 lines) — the transitional BEFORE-INSERT org_id auto-fill net: 2 TG_ARGV-parameterised SECDEF functions + 35 triggers, with a full header documenting forward-compat / fail-safe / idempotent / cloud-safe invariants + the LIMIT-1 pre-167 assumption + the mig-104 CR-01 security reasoning.
- `supabase/full-schema.sql` (modified, regenerated no --reset) — 5467 → 5785 lines; the greenfield bootstrap now installs the autofill functions + 35 triggers.

## Decisions Made
- **Two shared functions over 35 hardcoded ones** — `to_jsonb(NEW)->>col` gives dynamic owner/FK-column access; one function serves all owner-based targets, the other all parent-based children.
- **3rd TG_ARGV (parent PK, default 'id') on the parent resolver** — makes each GROUP-3 trigger self-documenting and removes a hidden PK assumption; all 4 parents verified live to key on `id`.
- **REVOKE EXECUTE FROM PUBLIC on both fns** — defense-in-depth matching the mig-104 SECDEF/CR-01 posture. These functions RETURN `trigger` (a pseudo-type), so PostgREST never exposes them as `/rpc` (a direct call errors "trigger functions can only be called as triggers"); the REVOKE closes an already-non-existent direct-call path and does NOT affect trigger firing (Postgres does not check EXECUTE on a trigger function when the trigger fires) — proven live by the passing acceptance test after apply.
- **No supplement change** — unlike mig 105 (whose supplement carried a stale `handle_new_user` copy), the supplement never touches the autofill objects, so the appended-last copy cannot clobber the dump's functions/triggers (verified 0 autofill mentions in the supplement region). This commit is 2 files, not 3.
- **[Assumption A1] LIMIT 1** on `org_members` is correct pre-167 (one membership per user at 162 time); 163 supersedes the net before 167's multi-org invitations, so no disambiguation is needed now.

## Deviations from Plan

None — plan executed as written. Per Task 2's explicit instruction, the illustrative verify snippet in the PLAN was **not** run verbatim; the full acceptance test (a)-(e) was implemented per the task's `acceptance_criteria` (constructing correct INSERTs from each table's live NOT-NULL/no-default columns), which is what the plan directed. The three "equivalently-correct shape" choices the plan explicitly permitted (the 3-arg parent resolver, the REVOKE hardening, trigger naming) are recorded under Decisions above, not as deviations.

## Issues Encountered
- **Fail-safe path vs the user_id FK (test e):** an unknown-user insert could in principle trip the `threads.user_id` FK instead of the org_id NOT-NULL. Confirmed live it rejects as **SQLSTATE 23502 (not_null_violation on org_id)** — because NOT NULL is enforced during `ExecConstraints` (before the tuple is written) while FK is an AFTER-row trigger, so the NOT-NULL fail-safe fires first. Test (e) asserts the 23502 code explicitly, so the proof is unambiguous.
- No other issues. Local Supabase was already running (psycopg2 @ :54322 and the `docker exec` pg_dump both succeeded).

## Cloud Parity Reminder
**Migration 106 is owed on cloud.** It joins the pending-cloud set — apply **099 → 100 → 101 → 102 → 103 → 104 → 105 → 106** in order at the next operator-gated production push, plus set `SECRETS_ENCRYPTION_KEY`. Cloud was NOT touched by this plan. 106 is **NOT seed-bearing** (adds only trigger functions + triggers; no reference data, env var, bundled service, or sandbox tag), so no `docs/OPERATOR.md` Step-3 seed-list change and no `scripts/check-deploy-drift.sh` entry are owed (D-16 parity satisfied by exclusion). Because 105+106 are self-sufficient (deployable without 163), the cloud deploy is decoupled from Phase 163.

## User Setup Required
None — the local apply is the only live action and it is complete. Cloud apply is operator-gated (see Cloud Parity Reminder).

## Next Phase Readiness
- **Phase 163 (atomic RLS + user-JWT crux):** ready — the app can create threads/messages/documents/runs/todos again NOW (org_id auto-filled), so 163 can be developed against a working local app. When 163 threads org_id explicitly on every INSERT, all 35 triggers short-circuit on the `IF NEW.org_id IS NOT NULL` guard (pure no-op); the net stays as a redundant fail-safe belt.
- **Deep Mode / agent loop / retrieval:** unaffected — the trigger only fires on INSERT and is a no-op when org_id is provided; RLS stays service-role-bypassed until 163.
- **No blockers.**

## Self-Check: PASSED

- **Created/modified files exist:** `supabase/migrations/106_org_id_autofill_trigger.sql` (FOUND), `supabase/full-schema.sql` (FOUND, regenerated 5785 lines), `162-03-SUMMARY.md` (this file).
- **D-06 commit exists:** `170c5f13` — `git show --stat` lists exactly the 2 deliverables; no `.claude/` / `supabase/snippets/` / `supabase/.temp/` / `scripts/_uat*` noise.
- **Live re-check:** 35 `_autofill_org_id` triggers installed; both SECDEF functions with `search_path=""`; org_id NOT NULL on all 35 targets; `operator_audit_log` still nullable; acceptance test (a)-(e) OVERALL PASS; re-apply idempotent (still 35, not doubled).
- **full-schema.sql:** contains `autofill_org_id` (74 mentions), 35 `CREATE TRIGGER ..._autofill_org_id`, both function bodies SECURITY DEFINER + `SET search_path TO ''`; supplement region has 0 autofill mentions (no clobber).

---
*Phase: 162-personal-org-backfill*
*Completed: 2026-07-18*
