-- 118_connector_secret_column_privilege.sql
-- Phase 190 code-review fix · CR-01 — take `secret_ciphertext` OUT of every PostgREST
-- projection an org member (or an anonymous visitor) can ask for.
--
-- ── THE DEFECT ────────────────────────────────────────────────────────────────────────
-- Migration 116 gave this table a ROW-level SELECT policy:
--
--     CREATE POLICY connector_connections_select ON public.connector_connections
--       FOR SELECT TO authenticated USING (org_id IN (SELECT public.current_user_org_ids()));
--
-- Row-level, not column-level — and the row carries `secret_ciphertext`. Supabase exposes
-- `public` to `authenticated` through PostgREST and this app ships a live browser Supabase
-- client (`frontend/src/lib/supabase.ts`, already used for direct table reads). So ANY
-- plain member of an org — one explicitly denied create/edit/delete/check by
-- `require_org_manage` (UI-SPEC U-02, and 116's own write policies) — could run
--
--     await supabase.from("connector_connections").select("id,name,secret_ciphertext")
--
-- and receive the `enc:v1:` envelope for every connector credential in their org.
--
-- The API gate the phase spent a module-scope assert on (`connector_service.py:108`,
-- *"T7: ConnectorConnectionResponse grew a secret-bearing field"*) is NOT IN THAT PATH.
-- It guards the API; this guards the database. `connector_service.py:27` claims *"Every
-- log line emits column NAMES, ids and counts only — never a ciphertext"* and
-- `list_connections`' docstring claims *"no row reaches a caller with its ciphertext
-- attached"* — true of the API, false of the database, and the phase's T7 falsification
-- row was only ever driven against the API.
--
-- ⚠ MEASURED BEFORE THE FIX, and it was WORSE than the review stated —
-- `information_schema.column_privileges` for `secret_ciphertext` held:
--
--     ('anon',          'SELECT')   ← the UNAUTHENTICATED role
--     ('authenticated', 'SELECT')
--
-- plus INSERT / UPDATE / REFERENCES for both, and full table SELECT/INSERT/UPDATE/DELETE/
-- TRUNCATE/TRIGGER for both. All of it comes from Supabase's stock
-- `GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role`;
-- migration 116 simply never narrowed it.
--
-- ⚠ AND THE PRECEDENT DID NOT CARRY. 116's header cites `sso_configs` (mig 104:372-374)
-- as the model for its RLS shape — **a table with no secret column at all**. Copying a
-- row-level policy onto a table that holds a tenant credential is where this went.
--
-- ── WHY THIS IS NOT "just ciphertext" ─────────────────────────────────────────────────
--   (a) it defeats the exact least-privilege split the phase designed — credential
--       MANAGEMENT is org-admin-only, credential MATERIAL would be org-wide;
--   (b) it is an offline artefact an insider retains against a future
--       `SECRETS_ENCRYPTION_KEY` disclosure or a key-rotation mistake;
--   (c) two shipped docstrings assert the opposite (quoted above).
--
-- ── WHAT THIS MIGRATION DOES ──────────────────────────────────────────────────────────
--   * `anon` loses EVERYTHING. It is the pre-sign-in role and has no business with this
--     table in any mode. 116's four policies are all `TO authenticated`, so RLS already
--     denied it every row — but privileges and policies are INDEPENDENT gates and this is
--     the cheaper of the two to keep closed.
--   * `authenticated` keeps INSERT / UPDATE / DELETE at TABLE level (so the org-admin CRUD
--     path can still WRITE the secret through the user-JWT client) and gets SELECT
--     COLUMN BY COLUMN, omitting exactly one column.
--   * `service_role` and `postgres` are UNTOUCHED. The harness resolver
--     (`connector_service._fetch_connection_row`) runs on the service-role pool because
--     the workflow engine carries no user JWT (the Phase-163 red line), and it MUST still
--     read the column. Revoking it from every role would turn every live send into a
--     credential-resolution failure.
--
-- ⚠ WRITE ACCESS IS NOT READ ACCESS, and the asymmetry is the whole design: a role may
-- INSERT into and UPDATE a column it can never SELECT. That is exactly the shape a
-- write-only credential field wants.
--
-- ── ⚠ A CONSEQUENCE THAT IS STATED, NOT DISCOVERED LATER ──────────────────────────────
-- With the column grant in place, `SELECT *` FAILS for `authenticated` — Postgres expands
-- `*` to every column and checks SELECT on each, so the refusal is `42501 permission
-- denied for table connector_connections`, not a silently-narrowed row. **PostgREST's
-- default projection is `select=*`.** Every read this app performs on the USER-JWT client
-- therefore has to name its columns, and `backend/app/services/connector_service.py` was
-- changed in the SAME COMMIT to do so (`_SELECTABLE_COLUMNS`, derived from
-- `ConnectorConnectionResponse.model_fields` rather than retyped). A future reader who
-- reintroduces `.select("*")` on the user client will get a hard 42501, which is the loud
-- failure mode rather than the silent one.
--
-- ── RE-PASTE-SAFE ─────────────────────────────────────────────────────────────────────
-- REVOKE and GRANT are idempotent; running this file twice is a no-op. It creates nothing
-- and drops nothing.
--
-- ── Apply discipline (CLAUDE.md, D-21) ────────────────────────────────────────────────
--   Paste this WHOLE file into the LOCAL Supabase SQL editor and run it. NEVER
--   `supabase db push` / `supabase db reset` (both destroy dev data). Then run
--   `bash scripts/regenerate-full-schema.sh` with NO `--reset`, and commit this migration
--   together with the regenerated `supabase/full-schema.sql`. Never hand-edit that file.
--   Filename is DIGITS-ONLY (`118_…`) — a letter suffix like `118b` is silently skipped by
--   the Supabase CLI, which would ship a grant that does not exist.
--
-- ── Cloud parity ──────────────────────────────────────────────────────────────────────
--   The standing pending queue was 099 → 117 + SECRETS_ENCRYPTION_KEY. **118 JOINS it**,
--   applied to cloud in order at the next operator-gated production push (D-22,
--   docs/DEPLOYMENT-WORKFLOW.md). ⚠ This one is SECURITY-BEARING: until it is applied to
--   cloud, the cloud database has the defect described above. It is NOT seed-bearing (no
--   reference data, no env var, no bundled service, no sandbox tag), so it owes no
--   docs/OPERATOR.md Step-3 or check-deploy-drift.sh change.

-- ================================================================================================
-- §1 — take the blanket grants away
-- ================================================================================================
REVOKE ALL ON public.connector_connections FROM anon;
REVOKE ALL ON public.connector_connections FROM authenticated;

-- ================================================================================================
-- §2 — re-grant, column by column, to `authenticated` only
-- ================================================================================================
-- One column per line so the omission is VISIBLE in a diff rather than inferred from a
-- comma-separated blob. The column that is not here is `secret_ciphertext`, and its absence
-- is the entire point of this file.
GRANT SELECT (
    id,
    org_id,
    created_by,
    capability,
    name,
    config,
    is_enabled,
    last_checked_at,
    last_check_verdict,
    created_at,
    updated_at
) ON public.connector_connections TO authenticated;

-- Writes stay at TABLE level, INCLUDING the secret column: the org-admin create/edit path
-- runs on the user-JWT client (`get_user_supabase_client` → role `authenticated`) and has to
-- be able to store an `enc:v1:` envelope. RLS (116 §3) is still the row gate on top of this;
-- `org:manage` is still required by both the policy and `require_org_manage`.
GRANT INSERT, UPDATE, DELETE ON public.connector_connections TO authenticated;

-- ================================================================================================
-- §3 — the property, greppable
-- ================================================================================================
-- After this file, the following must hold on the live database:
--
--   SELECT grantee, privilege_type
--     FROM information_schema.column_privileges
--    WHERE table_name = 'connector_connections' AND column_name = 'secret_ciphertext';
--
--     -> `authenticated` : INSERT, UPDATE, REFERENCES   (NO SELECT)
--     -> `anon`          : (no rows)
--     -> `service_role`  : SELECT, INSERT, UPDATE, REFERENCES
--
-- Driven, not asserted, by
-- `backend/tests/integration/test_190_secret_column_privilege.py` — seven cases including
-- the anti-over-correction one (`service_role` must STILL read it) and the devtools shape
-- (`SELECT *` must fail).
COMMENT ON COLUMN public.connector_connections.secret_ciphertext IS
  'D-11: the connector secret as an `enc:v1:` envelope produced by the SHIPPED cipher (backend/app/security/secret_cipher.py) — no new crypto, no new key (SECRETS_ENCRYPTION_KEY). Nullable because a row may exist before its secret is set. ⚠ POLARITY INVERSION, stated so it is not read as a bug: get_cipher() returns None when unkeyed, a deliberate fail-OPEN plaintext path for app_settings provider keys (D-150-01). For an org-scoped TENANT credential 190 is fail-CLOSED — it REFUSES to store a connector secret when no cipher is available. Also: this column is NOT in SECRET_COLUMNS, which drives the app_settings boot sweep and does not fit a per-org, per-row table (encrypt at write, decrypt at call time). ⚠ CR-01 / migration 118: this column is WRITE-ONLY for the `authenticated` role — it carries INSERT and UPDATE but NOT SELECT, so it cannot appear in any PostgREST projection a browser client can request, including `select=*`. Only `service_role` (the harness resolver, which has no user JWT) may read it. Re-granting SELECT here re-opens CR-01.';
