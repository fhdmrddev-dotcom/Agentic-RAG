-- 116_connector_connections.sql
-- Phase 190 (CONN-03 / CONN-02) — the org-scoped connector credential table.
-- Decisions: D-10 (the table), D-11 (the secret is enc:v1: through the SHIPPED cipher),
--            D-12 (the RLS shape, and the branch that is DELIBERATELY ABSENT).
--
-- WHY: Phase 189 shipped the whole external_action seam except the send — the executor
-- resolves, records, and sends nothing. 190 gives it a real destination, and a real
-- destination needs a real credential. This table is where an ORG's credential lives:
-- one row per (org, capability, name), the non-secret facts in `config`, the secret
-- itself only ever as an `enc:v1:` envelope in `secret_ciphertext`. The workflow
-- definition JSONB stores a `connection_id` REFERENCE and never a secret (D-13), which
-- is CONN-03 SC#4 read literally.
--
-- CREATE (not ALTER) — this table is net-new at 190. CREATE TABLE IF NOT EXISTS +
-- DROP POLICY IF EXISTS before every CREATE POLICY + DROP TRIGGER IF EXISTS before every
-- CREATE TRIGGER, so the whole file is RE-PASTE-SAFE (the rule 104:23 states).
--
-- ── RLS: the shape is `sso_configs` (104:372-390), NOT `skills` ────────────────────────
--   READ  is ORG-WIDE — a connection exists precisely so a colleague's published workflow
--         can bind it. There is no per-user connector.
--   WRITE is behind `public.current_user_has_permission(org_id, 'org:manage')` — the
--         permission ALREADY seeded to super-admin + org-admin at 104:416-426. No new
--         permission key is minted here.
--   That pair is exactly 190-UI-SPEC.md §2b / U-02: read + bind org-wide, create / edit /
--   delete / check org-admin only. ⚠ The UI half (a removed `＋ Add a connection` button)
--   is NOT the gate — this RLS and the API dependency are. A hidden button the API still
--   honours is the defect the 069-A contract exists to prevent.
--
-- ── ⚠ D-12 — THE DECISION HERE IS AN ABSENCE, AND THE ABSENCE IS WRITTEN DOWN ─────────
--   The SELECT policy below has NO `is_system` / `is_system_global` / global-visibility
--   escape branch, and **the absence is the decision**, not an oversight. Sibling tables
--   DO carry such a branch (`workflow_definitions` reads `is_system_global = true OR …`),
--   so its omission here would otherwise read to the next author as a thing someone forgot
--   to add. It is exactly the branch SEED-125 / migration 112 had to CLOSE for skill files
--   after it leaked cross-org, and a connector connection carries a tenant's live
--   credential: **a connector connection is never cross-org readable.** Anyone adding such
--   a branch later is re-opening SEED-125 on a strictly worse asset and owes a new
--   threat-model entry, not a one-line policy edit.
--
--   Mechanical check on this file: `grep -n "is_system" 116_connector_connections.sql`
--   returns ONLY lines inside this header comment. The four policy bodies below contain
--   neither token — that is the property, and it is greppable.
--
-- ── Apply discipline (CLAUDE.md, D-21) ────────────────────────────────────────────────
--   Paste this WHOLE file into the LOCAL Supabase SQL editor and run it. NEVER
--   `supabase db push` / `supabase db reset` (both destroy dev data). Then run
--   `bash scripts/regenerate-full-schema.sh` with NO `--reset`, and commit this migration
--   together with the regenerated `supabase/full-schema.sql`. Never hand-edit that file.
--   Filename is DIGITS-ONLY (`116_…`) — a letter suffix like `116b` is silently skipped by
--   the Supabase CLI, which would ship a table that does not exist.
--
-- ── Cloud parity (do NOT touch cloud now) ─────────────────────────────────────────────
--   Migrations 099 → 115 + SECRETS_ENCRYPTION_KEY are already pending on the cloud DB.
--   116 and 117 JOIN that pending set, applied to cloud in order at the next
--   operator-gated production push (D-22, docs/DEPLOYMENT-WORKFLOW.md). This file is
--   NOT seed-bearing (no reference data, no env var, no bundled service, no sandbox tag),
--   so it owes no docs/OPERATOR.md Step-3 or check-deploy-drift.sh change.

-- ================================================================================================
-- §1 — the table
-- ================================================================================================
CREATE TABLE IF NOT EXISTS public.connector_connections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    -- Matches the GROUP 2 sibling tables verbatim (workflow_definitions_created_by_fkey,
    -- full-schema.sql:4375): REFERENCES auth.users(id) ON DELETE CASCADE.
    created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- The CLOSED capability set D-04 pins. SQL cannot import the Python frozenset
    -- (EXTERNAL_ACTION_CAPABILITIES, grounding.py), so it is spelled here — one literal
    -- per line so the three are individually greppable and individually reviewable.
    capability text NOT NULL CHECK (capability IN (
        'send_email',
        'create_ticket',
        'post_message'
    )),
    name text NOT NULL,
    config jsonb NOT NULL DEFAULT '{}',
    secret_ciphertext text,
    is_enabled boolean NOT NULL DEFAULT true,
    last_checked_at timestamptz,
    last_check_verdict text CHECK (last_check_verdict IN ('not_checked', 'ok', 'failed')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.connector_connections.secret_ciphertext IS
  'D-11: the connector secret as an `enc:v1:` envelope produced by the SHIPPED cipher (backend/app/security/secret_cipher.py) — no new crypto, no new key (SECRETS_ENCRYPTION_KEY). Nullable because a row may exist before its secret is set. ⚠ POLARITY INVERSION, stated so it is not read as a bug: get_cipher() returns None when unkeyed, a deliberate fail-OPEN plaintext path for app_settings provider keys (D-150-01). For an org-scoped TENANT credential 190 is fail-CLOSED — it REFUSES to store a connector secret when no cipher is available. Also: this column is NOT in SECRET_COLUMNS, which drives the app_settings boot sweep and does not fit a per-org, per-row table (encrypt at write, decrypt at call time).';

COMMENT ON COLUMN public.connector_connections.config IS
  'D-13 / CONN-03 SC#4: NON-SECRET facts ONLY — host, port, base_url, from_address, default_channel, project_key. No token, no password, no API key ever lands here. The workflow definition JSONB stores a connection_id REFERENCE, so no secret and no host reaches the client or the definition.';

COMMENT ON COLUMN public.connector_connections.last_check_verdict IS
  '190-UI-SPEC §5a: a QUALITY HINT, never an authorization boundary. It feeds the Credential column (§2c) and the client-side picker filter (Gate 1); the SERVER bind gate (Gate 2) validates org + is_enabled ONLY and deliberately does NOT read this column (U-07a, door (b)) — because check is admin-only while bind is org-wide, so a stale `failed` would hard-block a member who cannot clear it. NULL means never checked.';

-- ================================================================================================
-- §2 — indexes
-- ================================================================================================
-- Every read is org-scoped (D-14's resolver scopes by the RUN's org, never by id alone).
CREATE INDEX IF NOT EXISTS idx_connector_connections_org_id
  ON public.connector_connections USING btree (org_id);
-- The picker's read is ALWAYS capability-scoped: GET /connectors/connections?capability=…
CREATE INDEX IF NOT EXISTS idx_connector_connections_org_capability
  ON public.connector_connections USING btree (org_id, capability);
-- Owner lookups + the ON DELETE CASCADE from auth.users.
CREATE INDEX IF NOT EXISTS idx_connector_connections_created_by
  ON public.connector_connections USING btree (created_by);

-- ================================================================================================
-- §3 — RLS: four policies, mirroring sso_configs (104:372-390), org:manage on write
-- ================================================================================================
ALTER TABLE public.connector_connections ENABLE ROW LEVEL SECURITY;

-- READ — org-wide. No escape branch (see the D-12 note in the header).
DROP POLICY IF EXISTS connector_connections_select ON public.connector_connections;
CREATE POLICY connector_connections_select ON public.connector_connections
  FOR SELECT TO authenticated USING (org_id IN (SELECT public.current_user_org_ids()));

DROP POLICY IF EXISTS connector_connections_insert ON public.connector_connections;
CREATE POLICY connector_connections_insert ON public.connector_connections
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_permission(org_id, 'org:manage') AND org_id IN (SELECT public.current_user_org_ids()));

DROP POLICY IF EXISTS connector_connections_update ON public.connector_connections;
CREATE POLICY connector_connections_update ON public.connector_connections
  FOR UPDATE TO authenticated
  USING (public.current_user_has_permission(org_id, 'org:manage'))
  WITH CHECK (public.current_user_has_permission(org_id, 'org:manage') AND org_id IN (SELECT public.current_user_org_ids()));

DROP POLICY IF EXISTS connector_connections_delete ON public.connector_connections;
CREATE POLICY connector_connections_delete ON public.connector_connections
  FOR DELETE TO authenticated USING (public.current_user_has_permission(org_id, 'org:manage'));

-- ================================================================================================
-- §4 — triggers
-- ================================================================================================
-- org_id auto-fill (106:74-107). GROUP 2 — this table owns by `created_by`, so TG_ARGV[0]
-- is 'created_by' (same as workflow_definitions / workspace_files). The function is
-- SECURITY DEFINER with a pinned empty search_path, a forward-compat NO-OP when org_id is
-- supplied explicitly, and FAIL-SAFE to NULL — which the NOT NULL column above then
-- rejects, so no silent bad-org row is ever written (T-190-03-ORPHAN).
DROP TRIGGER IF EXISTS connector_connections_autofill_org_id ON public.connector_connections;
CREATE TRIGGER connector_connections_autofill_org_id BEFORE INSERT ON public.connector_connections
  FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('created_by');

-- updated_at touch — REUSES the shipped public.set_updated_at() (full-schema.sql:434, the
-- same function folders / threads / skills / skill_proposals already carry). No second
-- touch function is minted.
DROP TRIGGER IF EXISTS connector_connections_set_updated_at ON public.connector_connections;
CREATE TRIGGER connector_connections_set_updated_at BEFORE UPDATE ON public.connector_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
