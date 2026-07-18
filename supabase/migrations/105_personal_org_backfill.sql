-- 105_personal_org_backfill.sql
-- Phase 162 (MIG-01) — personal-org provisioning + org_id backfill + NOT-NULL flip + forward trigger.
--
-- WHAT THIS SHIPS (a pure DATA migration — populates the org_id substrate Phase 163's RLS crux consumes;
-- Deep Mode stays byte-identical, RLS is still service-role-bypassed until 163):
--   * §A — one personal org ("{email}'s Organization") + default 'General' department + org-admin
--     membership for EVERY existing auth.users row, via create_org_with_default_dept() (mig 104),
--     behind a NOT-EXISTS(org_members) idempotency gate (D-01).
--   * §D — extends the EXISTING handle_new_user DEFINER trigger so FUTURE signups auto-provision the
--     same personal org; defensive (EXCEPTION WHEN OTHERS swallow) so it can NEVER abort signup (D-02/D-03).
--   * §B — a single reusable batched PROCEDURE (_mig105_backfill) with a per-batch COMMIT, CALLed once
--     per target to backfill org_id across 35 user-facing tables in 3 ordered waves (D-07/D-09/D-10).
--   * §C — a RAISE-EXCEPTION zero-NULL guard before EVERY SET NOT NULL flip (35 targets); the
--     org-agnostic operator audit table is EXCLUDED and stays nullable (D-08/D-11).
--
-- HANDS-OFF is_global / is_system (D-04): resolution is purely via user_id / created_by / parent org_id;
--   this file never reads, renames, or writes those sharing flags, so no shared resource loses reach.
--   The value-preserving is_global -> is_org_shared rename stays in Phase 165 (D-05 handoff).
--
-- ── APPLY DISCIPLINE (CLAUDE.md numbered-migration rules) ──────────────────────────────────────
--   * IDEMPOTENT / re-paste-safe: §A is NOT-EXISTS-gated + ON CONFLICT DO NOTHING; every backfill
--     UPDATE carries WHERE org_id IS NULL; every flip is IF-EXISTS-guarded; every function is
--     CREATE OR REPLACE. Re-running the whole paste is a safe recovery step.
--   * Apply by running this file through psycopg2 autocommit=True @ 127.0.0.1:54322 (the proven path —
--     the per-batch COMMIT in _mig105_backfill is ONLY legal in a non-atomic / autocommit context),
--     OR paste into the LOCAL Supabase SQL editor running each CALL as a SEPARATE execution. NEVER a
--     single wrapping-transaction paste (that raises "invalid transaction termination" on the CALL),
--     and NEVER `supabase db push` / `db reset` (preserves dev data).
--   * AFTER applying: run `bash scripts/regenerate-full-schema.sh` (no --reset) and commit the
--     migration AND the regenerated supabase/full-schema.sql together (D-06). NEVER hand-edit it.
--     (Apply + regenerate + same-commit is Plan 162-02; this file is AUTHORED in Plan 162-01.)
--   * Filename is digits-only (`105_...`) — a letter suffix like `105b` is silently skipped by the CLI.
--
-- ── CLOUD PARITY (do NOT touch cloud now) ──────────────────────────────────────────────────────
--   Migrations 099-104 + SECRETS_ENCRYPTION_KEY are already pending on the cloud (production) DB.
--   105 joins that pending set — applied to cloud only at the next operator-gated production push,
--   in order, per docs/DEPLOYMENT-WORKFLOW.md. This phase AUTHORS + applies LOCAL only.
--
-- ── DEPLOYMENT-ARTIFACT PARITY (NOT seed-bearing) ──────────────────────────────────────────────
--   162 writes only user-OWNED rows (personal orgs / memberships + backfilled org_id) — it seeds NO
--   reference data, so it is NOT seed-bearing and adds nothing to docs/OPERATOR.md Step-3 (contrast
--   mig 104, which seeded roles / role_permissions). No check-deploy-drift.sh registration owed.

-- ================================================================================================
-- §A — PERSONAL-ORG CREATION LOOP  (D-01 / SC#1)
-- One personal org + default 'General' dept + org-admin membership per existing auth.users row.
-- A NORMAL transactional DO block (bounded by user count — NO per-iteration COMMIT): a mid-loop
-- failure rolls the WHOLE block back, so there are never half-created orgs (a clean re-run). The gate
-- is membership-existence (Option B) — there is no personal-org marker column, and this file adds
-- NONE (mig-104 minimalism); a user with zero org_members rows has no personal org yet. Idempotent by
-- construction: the NOT-EXISTS gate skips already-provisioned users + the membership insert is
-- ON CONFLICT DO NOTHING (T-162-01). create_org_with_default_dept() creates the org + default dept but
-- NOT the membership, so the caller inserts it separately (D-01).
-- ================================================================================================
DO $$
DECLARE
  u        record;
  v_org_id uuid;
BEGIN
  FOR u IN
    SELECT id, email
    FROM auth.users au
    WHERE NOT EXISTS (SELECT 1 FROM public.org_members m WHERE m.user_id = au.id)   -- the idempotency gate
  LOOP
    v_org_id := public.create_org_with_default_dept(
                  COALESCE(u.email, u.id::text) || '''s Organization', NULL, 'General');
    INSERT INTO public.org_members (org_id, user_id, role)
    VALUES (v_org_id, u.id, 'org-admin')
    ON CONFLICT (org_id, user_id) DO NOTHING;
  END LOOP;
END $$;

-- ================================================================================================
-- §D — FORWARD handle_new_user TRIGGER EXTENSION  (D-02 / D-03)
-- Extends the EXISTING trigger's function so future signups auto-provision the same personal org,
-- closing the 163->167 org-less window. KEEPS SECURITY DEFINER + pinned search_path (the EoP
-- mitigation, T-162-06 — never drop either). The inner BEGIN…EXCEPTION WHEN OTHERS…RAISE WARNING…END
-- SWALLOWS any org-creation failure so it can NEVER abort the auth.users INSERT / break signup
-- (D-03 / T-162-05). Reuses the EXACT §A gate + membership shape so the two creation paths are
-- identical logic. The trigger itself (on_auth_user_created AFTER INSERT ON auth.users) already
-- exists — only the FUNCTION body changes here (do NOT re-create the trigger).
-- ================================================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Existing behavior, hardened with ON CONFLICT so a re-fire can't duplicate the profile row
  -- (profiles PK = id — verified live).
  INSERT INTO public.profiles (id, display_name)
  VALUES (new.id, new.raw_user_meta_data->>'display_name')
  ON CONFLICT (id) DO NOTHING;

  -- NEW: defensive personal-org provisioning — identical logic to §A, wrapped in a swallow so a
  -- failure logs a WARNING and returns normally instead of aborting the signup INSERT.
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.org_members m WHERE m.user_id = new.id) THEN
      v_org_id := public.create_org_with_default_dept(
                    COALESCE(new.email, new.id::text) || '''s Organization', NULL, 'General');
      INSERT INTO public.org_members (org_id, user_id, role)
      VALUES (v_org_id, new.id, 'org-admin')
      ON CONFLICT (org_id, user_id) DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: personal-org creation failed for %: %', new.id, SQLERRM;
  END;

  RETURN new;
END;
$$;

-- =====  §B (batched backfill) and §C (NOT-NULL flips) are appended below by Plan 162-01 Tasks 2 and 3.  =====
