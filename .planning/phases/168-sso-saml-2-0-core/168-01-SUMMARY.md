---
phase: 168-sso-saml-2-0-core
plan: 01
subsystem: database
tags: [supabase, postgres, rls, sso, saml, migration, secrets, role_permissions]

# Dependency graph
requires:
  - phase: 161-org-dept-role-schema
    provides: "sso_configs table + RLS write policies gating on current_user_has_permission(org_id,'sso:manage') (mig 104); role_permissions catalog with the super-admin-only sso:manage grant reserving the org-admin flip for 168"
  - phase: 150-secrets-at-rest
    provides: "MultiFernet app-layer cipher (enc:v1: envelope) + SECRET_COLUMNS allowlist that Plan 02 extends with supabase_management_token"
provides:
  - "Migration 113 — the org-admin sso:manage grant that ACTIVATES the dormant mig-104 sso_configs RLS write policies (D-168-01)"
  - "sso_configs.status approval gate (default pending_approval, 3-value CHECK) — D-168-05"
  - "sso_configs_email_domain_lower_unique — case-insensitive one-org-per-domain partial unique index (anti-hijack)"
  - "sso_configs.approved_by / approved_at operator-approval audit columns"
  - "app_settings.supabase_management_token — encrypted-token store for the Cloud sbp_ management token (D-168-01)"
  - "Regenerated supabase/full-schema.sql reflecting mig 113 (live dump, no reset)"
affects: [168-02-provider-crud-service, 168-04-domain-routing-enforcement, secure-phase-168]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Grant-flip activation: ship RLS policies gating on a permission key first (mig 104), then a later migration seeds the org-admin grant to turn them on — no policy rewrite needed"
    - "Partial functional unique index on lower(email_domain) WHERE email_domain IS NOT NULL for case-insensitive uniqueness that tolerates thin/unclaimed rows"
    - "Additive encrypted secret column: DB column added here; the app-layer SECRET_COLUMNS sweep (Plan 02) does the encryption at boot"

key-files:
  created:
    - "supabase/migrations/113_sso_configs_firming.sql"
  modified:
    - "supabase/full-schema.sql"

key-decisions:
  - "Org-admin-only sso:manage grant — never widened to member/dept-admin (T-168-06)"
  - "provider_id stays text with NO FK into the Supabase-owned auth schema; no metadata_url/xml columns (D-07 preserved — Supabase owns SAML internals)"
  - "status defaults pending_approval so a newly-created config cannot route logins until approved (D-168-05 approval gate)"
  - "supabase_management_token column added now (plaintext-capable) but not swept until Plan 02 registers it in SECRET_COLUMNS"

patterns-established:
  - "Idempotent, re-paste-safe migrations: IF NOT EXISTS on all DDL + ON CONFLICT (role, permission_key) DO NOTHING on the seed; digits-only filename (no letter suffix the CLI skips)"
  - "Apply-via-SQL-editor discipline: migration authored + committed, operator applies live, then regenerate full-schema (no reset) and commit both"

requirements-completed: [SSO-01]

# Metrics
duration: 12min
completed: 2026-07-22
---

# Phase 168 Plan 01: Migration 113 — sso_configs Firming Summary

**Flipped the org-admin `sso:manage` grant live to activate mig-104's dormant `sso_configs` RLS write policies, added the D-168-05 approval gate (status + lowercased-domain uniqueness + approval audit columns), and added the encrypted `app_settings.supabase_management_token` store — the load-bearing schema foundation the rest of the SSO phase stands on.**

## Performance

- **Duration:** ~12 min (spans the operator-apply checkpoint)
- **Started:** 2026-07-22T07:35:22Z
- **Completed:** 2026-07-22T07:48:12Z
- **Tasks:** 3 (Task 2 = blocking operator-apply checkpoint)
- **Files modified:** 2

## Accomplishments
- Authored idempotent migration 113 with five statements: the load-bearing `('org-admin','sso:manage')` grant, the `sso_configs.status` approval gate, the case-insensitive one-org-per-domain unique index, the `approved_by`/`approved_at` audit columns, and the `app_settings.supabase_management_token` encrypted-token store.
- Operator applied migration 113 to the live local DB via the Supabase SQL editor (never `db push`/`db reset` — dev data preserved); confirmed live by both the orchestrator's psycopg2 gate and this executor's second-confirmation gate (`MIG113_LIVE_OK`).
- Activated the previously-dormant mig-104 `sso_configs` RLS write policies for org-admins — without this grant every org-admin write to `sso_configs` would 403 (RESEARCH Pitfall 1 / D-168-01).
- Regenerated `supabase/full-schema.sql` from the live DB (no reset); diff is additive-only (13 insertions, 1 comma-shift), no objects dropped.

## Task Commits

Each task was committed atomically:

1. **Task 1: Author migration 113** - `9e7cb2e1` (feat)
2. **Task 2: [BLOCKING] Operator applies migration 113 to the live local DB** - no commit (human-action checkpoint; live-DB apply, no file change)
3. **Task 3: Regenerate full-schema.sql + record cloud-parity debt** - `ef154e1a` (chore)

_Note: Task 2 is a blocking operator-apply checkpoint — it produces no commit because the migration file was already committed in Task 1 and the apply mutates only the live DB._

## Files Created/Modified
- `supabase/migrations/113_sso_configs_firming.sql` - The five-statement firming migration (grant + status + unique index + approval audit + mgmt-token column), fully idempotent with an apply-discipline + cloud-parity header.
- `supabase/full-schema.sql` - Regenerated bootstrap artifact reflecting mig 113 (live-DB dump, no reset).

## Decisions Made
- **Org-admin-only grant:** `sso:manage` was granted to `org-admin` only — never `member`/`dept-admin` (T-168-06 keeps the write surface minimal).
- **D-07 preserved:** `provider_id` stays `text` (holds the GoTrue provider UUID string), no FK was added into the Supabase-owned `auth` schema, and no `metadata_url`/`metadata_xml` columns were added (Supabase Auth owns the SAML provider internals).
- **Approval-gate default:** `status` defaults `pending_approval` so a freshly-created SSO config cannot route logins until an operator approves it (D-168-05).
- **Deferred encryption wiring:** the `supabase_management_token` column is added here (plaintext-capable) but is not swept by the Phase-150 cipher until Plan 02 adds its name to `SECRET_COLUMNS`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. The only diff churn in `full-schema.sql` beyond the new objects was the `sso_configs.updated_at` line gaining a trailing comma (a pg_dump artifact from appending columns after it) — verified benign, no object dropped.

## Cloud-Parity Debt (recorded)
Migration 113 joins the pending cloud set **099 → 100 → … → 112 → 113**, applied to production only at the next operator-gated push, in numeric order (plus `SECRETS_ENCRYPTION_KEY`). Migration 113 seeds one reference-data row (the `sso:manage` grant) and adds additive schema columns; it adds no env var / bundled service / sandbox tag, so it owes no `docs/OPERATOR.md` or `check-deploy-drift.sh` change of its own. **Plan 02 registers the two new SSO env vars in the deploy artifacts (D-16) in its own commit.**

## User Setup Required
None for this plan — the only manual step was the operator applying migration 113 via the Supabase SQL editor (completed at the Task 2 checkpoint).

## Next Phase Readiness
- The `sso_configs` schema and the org-admin write path are now live: Plan 02's provider-CRUD service can insert/update `sso_configs` as an org-admin (RLS write policies active) and decrypt the `supabase_management_token` at call time.
- Plan 02 must add `supabase_management_token` to `backend/app/security/secret_cipher.py` `SECRET_COLUMNS` so `main.py`'s boot sweep encrypts it at rest.
- Plan 04 will enforce the `status`/domain-uniqueness approval gate at login-routing time.
- No blockers.

---
*Phase: 168-sso-saml-2-0-core*
*Completed: 2026-07-22*
