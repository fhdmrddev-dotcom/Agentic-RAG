---
phase: 146-operator-foundation
plan: 01
subsystem: database
tags: [postgres, supabase, migrations, rls, operator-role, audit-log, multi-tenancy-stub]

# Dependency graph
requires:
  - phase: 090-harness-schema (mig 059)
    provides: "harness_audit append-only audit-table idioms — PLAIN-uuid-no-FK actor, org_id stub + COMMENT, ENABLE RLS"
provides:
  - "public.operator_users — org-agnostic operator principal (D-06), user_id PK -> auth.users ON DELETE CASCADE, NO org_id column"
  - "public.operator_audit_log — append-only operator action ledger; operator_user_id PLAIN uuid NO FK (tamper-resistant); action free-text NO CHECK (A4); label/is_write/target_type/target_id/metadata; org_id D-05 stub; idx_operator_audit_created (created_at DESC)"
  - "Deny-all RLS on both operator tables (ENABLE ROW LEVEL SECURITY, zero policies) — only the service-role backend behind require_operator reads them"
  - "org_id uuid forward-compat stub on documents/folders/threads/skills (D-05 — nullable, no FK, no index, no backfill)"
  - "supabase/full-schema.sql regenerated from the live local DB including all of the above"
affects: [146-02, 146-03, 146-04, 146-05, 146-06, 147-operator-control-plane, 148-governance, v3.4-org-rbac]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Deny-all RLS by omission: ENABLE ROW LEVEL SECURITY + zero policies (stricter than harness_audit owner SELECT/INSERT)"
    - "Tamper-resistant audit actor: PLAIN stored uuid, never FK CASCADE (059:16 idiom)"
    - "Free-text audit action (no CHECK) so the auto audit-floor never needs a migration per new admin action (RESEARCH A4)"
    - "org_id metadata stub: bare nullable column + forward-compat COMMENT, no FK/index/backfill (D-05, harness_audit precedent over the DM-era indexed shape)"

key-files:
  created:
    - supabase/migrations/095_operator_foundation.sql
    - supabase/migrations/096_org_id_stub_sweep.sql
  modified:
    - supabase/full-schema.sql

key-decisions:
  - "operator_users carries NO org_id (D-06 org-agnostic principal) — protects the v3.4 one-way door"
  - "operator_audit_log.action is free-text with NO CHECK (A4) — the audit floor derives actions per route"
  - "096 follows the harness_audit stub shape (no idx_*_org_id) over the DM-era indexed shape (RESEARCH INDEX TENSION resolved per D-05)"
  - "095/096 split so the operator tables can ship/rollback independently of the metadata sweep"

patterns-established:
  - "Deny-all RLS by omission for operator-only tables: ENABLE RLS + zero policies; service-role backend is the sole reader"
  - "Operator audit ledger shape: plain-uuid actor / free-text action / plain-sentence label / is_write mark / jsonb metadata / org_id stub"

requirements-completed: [ADMIN-01]

# Metrics
duration: 9min (incl. operator checkpoint wait + one re-apply round-trip)
completed: 2026-07-10
---

# Phase 146 Plan 01: Operator Foundation Schema Summary

**Migrations 095 (operator_users + operator_audit_log with deny-all RLS + tamper-resistant plain-uuid audit actor) and 096 (org_id forward-compat stub on documents/folders/threads/skills) authored, operator-applied to the live local DB, and full-schema.sql regenerated**

## Performance

- **Duration:** ~9 min wall clock (including the blocking operator checkpoint and one failed-apply round-trip)
- **Started:** 2026-07-10T21:20:21Z
- **Completed:** 2026-07-10T21:29:06Z
- **Tasks:** 3/3 (2 auto + 1 blocking human-action checkpoint)
- **Files modified:** 3

## Accomplishments

- `public.operator_users` live: the org-agnostic operator principal (D-06) — `user_id` PK → `auth.users(id) ON DELETE CASCADE`, `granted_at`, `granted_by` (NULL = env-bootstrap provenance), `note`. Deliberately NO `org_id` column, protecting the v3.4 org-RBAC one-way door (T-146-04 mitigated).
- `public.operator_audit_log` live: append-only ledger with a PLAIN-uuid `operator_user_id` (NO FK — an operator's history survives their deletion, T-146-07 mitigated), free-text `action` (no CHECK, A4), plain-sentence `label`, `is_write` mark, nullable `target_type`/`target_id`, jsonb `metadata`, the D-05 `org_id` stub with a forward-compat COMMENT, and `idx_operator_audit_created (created_at DESC)` for feed ordering.
- Both operator tables ship RLS-ENABLED with ZERO policies — deny-all for anon/authenticated; only the service-role backend behind `require_operator` (Plan 02) reads them (T-146-09 mitigated). Verified live: `pg_class.relrowsecurity = true` on both, `pg_policy` empty.
- `org_id uuid` stub added to exactly the four owned roots (documents/folders/threads/skills) with per-column forward-compat COMMENTs — no FK, no index, no backfill; child tables and the already-stubbed workflow tables untouched (D-05).
- `supabase/full-schema.sql` regenerated via `scripts/regenerate-full-schema.sh` (live dump, no reset, +115/−3) — contains both operator tables, both RLS enables, and all four `org_id` columns.

## Task Commits

Each task was committed atomically:

1. **Task 1: Author migration 095 — operator_users + operator_audit_log (RLS deny-all)** - `385febfd` (feat)
2. **Task 2: Author migration 096 — org_id stub sweep on the four owned roots** - `612fb4fd` (feat)
3. **Task 3: [BLOCKING checkpoint] Apply 095+096 live + regenerate full-schema** - `2e8aec72` (chore)

## Files Created/Modified

- `supabase/migrations/095_operator_foundation.sql` - operator_users + operator_audit_log DDL, deny-all RLS, feed index, org_id COMMENT
- `supabase/migrations/096_org_id_stub_sweep.sql` - four ADD COLUMN IF NOT EXISTS org_id stubs + four forward-compat COMMENTs
- `supabase/full-schema.sql` - regenerated single-file bootstrap artifact (generated; never hand-edited)

## Decisions Made

- Followed the plan's locked DDL shapes exactly (RESEARCH §Schema): no org_id on the principal (D-06), plain-uuid audit actor (059:16), free-text action (A4), deny-all-by-omission RLS, no idx_*_org_id on the 096 stubs (INDEX TENSION resolved toward the harness_audit shape per D-05).
- Migration comments reworded to avoid the literal phrase "CREATE POLICY" so the plan's negative grep gate (`! grep -qi "CREATE POLICY"`) validates the real invariant (zero policy statements) without a comment false-positive.

## Deviations from Plan

None - plan executed exactly as written. (Two trivial in-file adjustments during authoring, both to satisfy the plan's own automated grep gates before first commit: comment wording in 095 as noted above, and single-space alignment on the 096 ALTER lines so the exact-string gate matches. Neither changes any DDL semantics.)

## Authentication/Checkpoint Gates

- **Task 3 blocking human-action checkpoint (expected):** operator applies 095+096 via the LOCAL Supabase SQL editor (project rule — never `db push`/`db reset`).
- **First "applied" confirmation failed verification:** three independent checks (pg_dump via regenerate script, direct psycopg2 query at 127.0.0.1:54322, byte-identical full-schema.sql) all showed the migrations absent from the local DB — likely applied to the wrong editor/project on the first attempt. Returned to checkpoint with evidence.
- **Second confirmation verified clean:** both tables present, RLS on, zero policies, both indexes present, four org_id columns present. Regeneration then picked up all changes (+115/−3).

## Issues Encountered

- First operator apply did not land in the local DB (see checkpoint gates above). Resolved by re-applying in the local Supabase Studio (`http://localhost:54323`) with the `to_regclass('public.operator_users')` sanity check.

## Known Stubs

- `org_id uuid` on `operator_audit_log`, `documents`, `folders`, `threads`, `skills` — **intentional** forward-compat metadata stubs (D-05/D-PRD-02/D-11): NULL in v3.3, no FK/index/backfill; the v3.4 org-RBAC milestone resolves them. This is the plan's explicit deliverable, not deferred work.

## User Setup Required

**Deployment parity (operator-gated, at promotion — NOT now):** paste migrations 095 + 096 into the CLOUD Supabase SQL editor, and in Coolify SET `OPERATOR_EMAILS` + REMOVE `BACKPRESSURE_ADMIN_USER_IDS` at the same promotion (docs/DEPLOYMENT-WORKFLOW.md, D-02).

## Next Phase Readiness

- Plans 02-06 (Wave 2+) unblocked: `require_operator` gate, audit floor, startup seed, and the Control Room UI can now read/write live tables.
- The backend seed at startup (`seed_operators_from_env`, Plan 02+) targets an existing `operator_users` table; the D-09 live UAT can run.
- No blockers.

## Threat Flags

None — all security surface introduced (operator tables, RLS posture, tamper-resistant actor) is exactly the plan's `<threat_model>` register (T-146-04/-07/-09 mitigated as specified; T-146-SC N/A, zero package installs).

---
*Phase: 146-operator-foundation*
*Completed: 2026-07-10*

## Self-Check: PASSED

- Files: 095_operator_foundation.sql, 096_org_id_stub_sweep.sql, full-schema.sql, 146-01-SUMMARY.md all present
- Commits: 385febfd, 612fb4fd, 2e8aec72 all found in git log
- Live DB: operator tables + RLS-on/zero-policies + idx_operator_audit_created + 4 org_id columns verified via psycopg2
