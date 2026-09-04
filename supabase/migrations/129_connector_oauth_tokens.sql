-- 129_connector_oauth_tokens.sql
-- Phase 215 (OAUTH-01, OAUTH-02, OAUTH-03) — BYO OAuth.
--
-- Decisions: D-215-01 (Hybrid client credentials with tenant & per-connection support),
--            D-215-02 (Google & Microsoft first-party provider scopes),
--            D-215-03 (Backend-mediated OAuth callback with PKCE & state HMAC),
--            D-215-04 (Atomic claim-based token refresh lease on connector_tokens.refresh_claimed_until),
--            D-215-05 (Account identity extraction and honest revoked status presentation).
--
-- WHY: Stores encrypted OAuth tokens for first-party enterprise integrations (Google, Microsoft)
-- with multi-worker concurrency safety (WORKER_COUNT=2) and zero plaintext leakage.
--
-- ── Apply discipline (CLAUDE.md, D-21) ───────────────────────────────────────────────────
--   Paste this WHOLE file into the LOCAL Supabase SQL editor and run it. NEVER apply it with
--   the Supabase CLI's push or reset subcommands. Then run `bash scripts/regenerate-full-schema.sh`
--   with NO `--reset`.
-- ================================================================================================

-- §1 — Update connector_connections with auth_type and status
ALTER TABLE public.connector_connections
    ADD COLUMN IF NOT EXISTS auth_type text NOT NULL DEFAULT 'static_key',
    ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS error_message text NULL;

ALTER TABLE public.connector_connections
    DROP CONSTRAINT IF EXISTS connector_connections_auth_type_check;

ALTER TABLE public.connector_connections
    ADD CONSTRAINT connector_connections_auth_type_check
    CHECK (auth_type IN ('static_key', 'oauth_byo', 'mcp'));

ALTER TABLE public.connector_connections
    DROP CONSTRAINT IF EXISTS connector_connections_status_check;

ALTER TABLE public.connector_connections
    ADD CONSTRAINT connector_connections_status_check
    CHECK (status IN ('active', 'revoked', 'error'));

COMMENT ON COLUMN public.connector_connections.auth_type IS
  'Phase 215 (D-215-01): The authentication mechanism used by the connection (static_key, oauth_byo, mcp).';

COMMENT ON COLUMN public.connector_connections.status IS
  'Phase 215 (D-215-05): Connection operational status (active, revoked, error).';

-- §2 — Create connector_tokens table
CREATE TABLE IF NOT EXISTS public.connector_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID NOT NULL REFERENCES public.connector_connections(id) ON DELETE CASCADE,
    account_email TEXT NULL,
    account_name TEXT NULL,
    access_token_ciphertext TEXT NOT NULL,
    refresh_token_ciphertext TEXT NULL,
    token_type TEXT NOT NULL DEFAULT 'Bearer',
    scopes TEXT[] NOT NULL DEFAULT '{}',
    expires_at TIMESTAMPTZ NOT NULL,
    refresh_claimed_until TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT connector_tokens_connection_id_key UNIQUE (connection_id)
);

CREATE INDEX IF NOT EXISTS idx_connector_tokens_connection_id
    ON public.connector_tokens (connection_id);

CREATE INDEX IF NOT EXISTS idx_connector_tokens_expires_at
    ON public.connector_tokens (connection_id, expires_at);

COMMENT ON TABLE public.connector_tokens IS
  'Phase 215 (OAUTH-01..03): Encrypted OAuth tokens and claim-based refresh leases for connector connections.';

COMMENT ON COLUMN public.connector_tokens.access_token_ciphertext IS
  'Phase 215 (SEC-1): Encrypted access token envelope (enc:v1: AES-256-GCM). Must NEVER be granted SELECT to authenticated or anon.';

COMMENT ON COLUMN public.connector_tokens.refresh_token_ciphertext IS
  'Phase 215 (SEC-1): Encrypted refresh token envelope (enc:v1: AES-256-GCM). Must NEVER be granted SELECT to authenticated or anon.';

COMMENT ON COLUMN public.connector_tokens.refresh_claimed_until IS
  'Phase 215 (D-215-04): Timestamp lease for multi-worker atomic refresh locking (WORKER_COUNT=2).';

-- §3 — Enable Row Level Security (RLS)
ALTER TABLE public.connector_tokens ENABLE ROW LEVEL SECURITY;

-- §4 — Column-level privileges (SEC-1 & SEC-2)
-- Revoke all default table permissions from anon and authenticated
REVOKE ALL ON TABLE public.connector_tokens FROM anon, authenticated;

-- Grant safe non-secret columns to authenticated (ciphertext columns intentionally excluded)
GRANT SELECT (
    id,
    connection_id,
    account_email,
    account_name,
    token_type,
    scopes,
    expires_at,
    created_at,
    updated_at
) ON public.connector_tokens TO authenticated;

-- Grant new columns on connector_connections to authenticated
GRANT SELECT (
    auth_type,
    status,
    error_message
) ON public.connector_connections TO authenticated;
