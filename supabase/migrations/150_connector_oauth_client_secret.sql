-- Migration 150 — the BYO-OAuth client secret gets a column of its own, encrypted.
--
-- ⚠ WHY: A CREDENTIAL WAS BEING STORED IN PLAINTEXT WHERE EVERY ORG MEMBER COULD READ IT.
--
-- Phase 215 added `OAuthConnectionConfig.custom_client_secret` as a field of `config`. That
-- column's own `COMMENT ON COLUMN` (migration 116) says, verbatim:
--
--     "host, port, base_url, from_address, default_channel, project_key.
--      No token, no password, no API key ever lands here"
--
-- and `models/connector.py` explains that the per-capability `extra='forbid'` config models
-- exist precisely so "a password key in `config` is UNCONSTRUCTABLE rather than merely
-- discouraged". The OAuth config model declared one anyway.
--
-- Measured 2026-08-31 on the live local database: `config` IS granted SELECT to
-- `authenticated` (migration 118 grants column by column, and `config` is on the list), so a
-- client secret written there is returned to any member of the org by the ordinary
-- connections list. Same class as CR-01, one column over.
--
-- ⚠ AND THE SECRET WAS NEVER ACTUALLY BEING WRITTEN, WHICH IS THE OTHER HALF. The operator
-- entered a Google client id and secret, pressed Connect, and was asked for them again:
-- `configFromDraft` never persisted them, so `/oauth/authorize`'s read-back
-- (`api/connectors.py:832`) found nothing and `resolve_client_credentials` raised
-- "OAuth credentials not configured for provider 'google'". Reproduced through the live API
-- this session: HTTP 422, that exact sentence. Silent token refresh
-- (`oauth_refresh_service.py:156`) reads the same absent value, so OAUTH-02 could not have
-- worked either.
--
-- So this column is BOTH halves of the fix: somewhere to put it, and somewhere it is safe.
--
-- ⚠ `custom_client_id` STAYS IN `config` AND THAT IS DELIBERATE. An OAuth client id is not a
-- secret — it travels in the authorization URL, in the browser, in the address bar. Moving it
-- here would imply it needs protecting and would make the honest thing (showing an author
-- which application their connection uses) need a decryption round trip.
--
-- Apply by pasting into the Supabase SQL editor. Re-paste-safe.

-- ── 1 · the column ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.connector_connections
    ADD COLUMN IF NOT EXISTS oauth_client_secret_ciphertext text NULL;

COMMENT ON COLUMN public.connector_connections.oauth_client_secret_ciphertext IS
  'Phase 215 follow-up (2026-08-31): the customer-registered OAuth application secret, '
  'encrypted (enc:v1: AES-256-GCM) exactly as secret_ciphertext is. NEVER granted SELECT to '
  'authenticated or anon — it is deliberately absent from the GRANT below and from '
  '_SELECTABLE_COLUMNS. It previously lived in config.custom_client_secret as PLAINTEXT, in '
  'a column every org member can read.';

-- ── 2 · the grant, and what it deliberately omits ───────────────────────────────────────
-- ⚠ MIGRATION 118 GRANTS THIS TABLE COLUMN BY COLUMN, so a new column is UNREADABLE by
-- default and every read that names it fails with `42501 permission denied`. That is the
-- desirable direction here and the reason there is no line adding the new column: the
-- application reads it through the service role, at the two places that need the plaintext,
-- and a user-JWT client must never be able to name it at all.
--
-- The two columns below are re-granted because migration 129 added them and this migration
-- is re-paste-safe; granting an already-granted column is a no-op.
GRANT SELECT (auth_type, status) ON public.connector_connections TO authenticated;

-- ── 3 · the one-way move for any row that already carries the plaintext ─────────────────
-- ⚠ THIS DOES NOT ENCRYPT — SQL HAS NO ACCESS TO THE APPLICATION'S FERNET KEY. It REMOVES
-- the plaintext, which is the half that can be done here and the half that matters: a secret
-- that cannot be re-derived is a secret that has stopped leaking. The owner re-enters it once
-- on the next Connect, and from then on it is written to the encrypted column above.
--
-- Measured before writing this: on the live local database all four `oauth_byo` rows carry
-- `config = {"headers": {}}` — no secret was ever stored, so this clause updates 0 rows here.
-- It exists for any environment where one WAS.
UPDATE public.connector_connections
   SET config = config - 'custom_client_secret'
 WHERE config ? 'custom_client_secret';
