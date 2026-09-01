-- 151_connector_tokens_rls_policy.sql
-- Phase 222 / SEED-233 — connector_tokens has RLS ENABLED and ZERO POLICIES.
--
-- ── THE DEFECT, MEASURED RATHER THAN INFERRED ────────────────────────────────────────────
-- Read from the live local DB on 2026-09-01:
--
--     relname                relrowsecurity   policies
--     connector_connections  true             4
--     connector_tokens       true             0        <-- this
--     (2 real rows behind it)
--
-- Migration 129 §3 enables RLS on this table and §4 grants column-level SELECT on the nine
-- NON-secret columns to `authenticated`, correctly withholding the two ciphertext columns.
-- It never creates a POLICY.
--
-- ⚠ AND THAT IS NOT A HARMLESS OMISSION, BECAUSE OF THE ORDER POSTGRES APPLIES THEM IN.
-- RLS enabled with no policy is DENY ALL — it does not fall back to the grants, it overrides
-- them. So §4's careful column list has never once been reachable: every user-JWT read of
-- this table returns EMPTY. `GET /connections/{id}/oauth/token` therefore 404s on rows that
-- exist, and its shipped client function has, as far as anyone can tell, never worked.
--
-- ⚠ SAME FAMILY AS MIGRATION 118'S COLUMN-GRANT TRAP, ONE TABLE OVER: a permission detail
-- that is invisible from the application code, where the failure presents as absent DATA
-- rather than as a refusal — which is the shape nobody debugs, because an empty list looks
-- like an empty table.
--
-- ── WHY A POLICY RATHER THAN THE SERVICE-CLIENT WORKAROUND ───────────────────────────────
-- Phase 221 worked around this on the service client and recorded that the real fix is a
-- policy (SEED-233, `221-CARRY-FORWARD.md` §B). Taking the workaround a second time would
-- make the table permanently unreadable by design and charge every future feature the same
-- tax.
--
-- ⚠ AND THE POLICY IS THE MORE LOCKED-DOWN OPTION, NOT THE LOOSER ONE — worth stating
-- plainly because "adding a policy to a credential table" reads like a widening. The
-- service-role client the workaround uses BYPASSES RLS entirely and can read every row of
-- every org, including both ciphertext columns. This policy grants strictly less: the
-- caller's own orgs, SELECT only, and only over the nine columns 129 §4 already allowed.
-- The ciphertext columns stay ungranted and are unreachable through it.
--
-- ── Apply discipline (CLAUDE.md, D-21) ───────────────────────────────────────────────────
--   Paste this WHOLE file into the Supabase SQL editor and run it. NEVER apply it with the
--   Supabase CLI's `db push` or `db reset`. Then run `bash scripts/regenerate-full-schema.sh`
--   with NO `--reset`.
--   ⚠ CLOUD PARITY: this must be pasted into the CLOUD SQL editor too, before any deploy
--   that ships the Phase 222 OAuth flow. Code that reads this table against a policy-less
--   one does not error — it reads EMPTY, which is the silent half of the same defect.
-- ================================================================================================

-- §1 — SELECT, scoped through the parent connection's org
--
-- ⚠ SCOPED VIA THE PARENT, because this table HAS NO `org_id` COLUMN of its own. That is
-- correct and is not being changed here: a token belongs to a connection, and duplicating
-- the org onto it would create a second source of truth that can disagree with the first.
-- The subquery reads `connector_connections`, which carries its own RLS — so a caller who
-- cannot see the connection cannot see its token either, by construction rather than by a
-- second copy of the rule.
--
-- `current_user_org_ids()` is the same helper `connector_connections_select` uses
-- (`116:115-116`), so the two tables answer "whose org is this?" identically. A second
-- spelling here would be the drift this project keeps finding in its own registries.
DROP POLICY IF EXISTS connector_tokens_select ON public.connector_tokens;
CREATE POLICY connector_tokens_select ON public.connector_tokens
  FOR SELECT TO authenticated
  USING (
    connection_id IN (
      SELECT c.id
      FROM public.connector_connections c
      WHERE c.org_id IN (SELECT public.current_user_org_ids())
    )
  );

-- §2 — NO INSERT, UPDATE OR DELETE POLICY, AND THAT IS A DECISION
--
-- ⚠ Deliberately absent, so the omission is not later read as this migration forgetting the
-- other three verbs the way 129 forgot all four. Every write to this table is a TOKEN MINT
-- or a TOKEN REFRESH, and both happen on the server during an OAuth callback — never from a
-- browser holding a user JWT. Migration 129's own column comments say the ciphertext columns
-- "must NEVER be granted SELECT to authenticated or anon"; letting that same role INSERT one
-- would be the same leak with the arrow reversed.
--
-- Writes therefore continue to run on the service client, which is the correct privilege for
-- them. Adding a write policy here would widen the surface for no caller that exists.

-- §3 — the grants 129 §4 intended, restated so this file is self-contained
--
-- ⚠ IDEMPOTENT AND UNCHANGED FROM 129 §4 — re-stated rather than assumed, because a policy
-- without the column grant is as dead as a grant without the policy, and the two halves now
-- live in different files. The ciphertext columns are absent from this list, exactly as they
-- are absent from 129's.
REVOKE ALL ON TABLE public.connector_tokens FROM anon;

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

COMMENT ON TABLE public.connector_tokens IS
  'Phase 215 (OAUTH-01..03): Encrypted OAuth tokens and claim-based refresh leases. '
  'Phase 222/SEED-233: RLS was enabled at 129 with NO policy, which is deny-all and made '
  '129 §4''s column grants unreachable; connector_tokens_select scopes reads through the '
  'parent connection''s org. Writes stay on the service client by design — see §2.';
