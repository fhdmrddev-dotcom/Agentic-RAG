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

-- ================================================================================================
-- §B — BATCHED org_id BACKFILL  (D-07 / D-09 / D-10)
-- One reusable batching PROCEDURE with a per-batch COMMIT (the lock-storm mitigation, T-162-02 —
-- the COMMIT is legal only in the autocommit / non-atomic apply context; see the header apply note),
-- then one CALL per target with its EXPLICIT resolver, in THREE ordered waves. Children resolve from
-- the parent's ALREADY-backfilled org_id, so wave order is load-bearing (Wave 3 after Wave 2 after
-- Wave 1). Every UPDATE keeps WHERE org_id IS NULL (idempotent re-run) + a LIMIT $1 batch bound.
-- Resolution is purely via user_id / created_by / parent org_id — the sharing flags are NEVER read or
-- written (D-04 HANDS-OFF, T-162-04), so no flip can orphan a shared or system resource. The two
-- Phase-163-deferred vector tables + the org-agnostic operator audit table are NOT targets.
-- ================================================================================================
CREATE OR REPLACE PROCEDURE public._mig105_backfill(p_sql text, p_batch int DEFAULT 10000)
  LANGUAGE plpgsql
  AS $$
DECLARE
  v_rows int;
  v_iter int := 0;
BEGIN
  LOOP
    EXECUTE p_sql USING p_batch;             -- p_sql is a migration-authored UPDATE … LIMIT $1 (never user input)
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_iter := v_iter + 1;
    RAISE NOTICE '_mig105_backfill batch % -> % rows', v_iter, v_rows;
    COMMIT;                                  -- releases the lock window between batches
    EXIT WHEN v_rows = 0;
  END LOOP;
END;
$$;

-- ── WAVE 1 — 31 direct-owner targets ─────────────────────────────────────────────────────────────
-- 28 resolved via own user_id -> org_members.org_id (each user has exactly ONE membership at 162 time,
-- so pm.org_id is unambiguous):
CALL public._mig105_backfill($SQL$
  UPDATE public.audit_log t SET org_id = pm.org_id FROM public.org_members pm
  WHERE pm.user_id = t.user_id AND t.org_id IS NULL
    AND t.id IN (SELECT id FROM public.audit_log WHERE org_id IS NULL LIMIT $1)
$SQL$);
CALL public._mig105_backfill($SQL$
  UPDATE public.classification_rules t SET org_id = pm.org_id FROM public.org_members pm
  WHERE pm.user_id = t.user_id AND t.org_id IS NULL
    AND t.id IN (SELECT id FROM public.classification_rules WHERE org_id IS NULL LIMIT $1)
$SQL$);
CALL public._mig105_backfill($SQL$
  UPDATE public.code_executions t SET org_id = pm.org_id FROM public.org_members pm
  WHERE pm.user_id = t.user_id AND t.org_id IS NULL
    AND t.id IN (SELECT id FROM public.code_executions WHERE org_id IS NULL LIMIT $1)
$SQL$);
CALL public._mig105_backfill($SQL$
  UPDATE public.document_images t SET org_id = pm.org_id FROM public.org_members pm
  WHERE pm.user_id = t.user_id AND t.org_id IS NULL
    AND t.id IN (SELECT id FROM public.document_images WHERE org_id IS NULL LIMIT $1)
$SQL$);
CALL public._mig105_backfill($SQL$
  UPDATE public.document_relationships t SET org_id = pm.org_id FROM public.org_members pm
  WHERE pm.user_id = t.user_id AND t.org_id IS NULL
    AND t.id IN (SELECT id FROM public.document_relationships WHERE org_id IS NULL LIMIT $1)
$SQL$);
CALL public._mig105_backfill($SQL$
  UPDATE public.document_tables t SET org_id = pm.org_id FROM public.org_members pm
  WHERE pm.user_id = t.user_id AND t.org_id IS NULL
    AND t.id IN (SELECT id FROM public.document_tables WHERE org_id IS NULL LIMIT $1)
$SQL$);
CALL public._mig105_backfill($SQL$
  UPDATE public.document_views t SET org_id = pm.org_id FROM public.org_members pm
  WHERE pm.user_id = t.user_id AND t.org_id IS NULL
    AND t.id IN (SELECT id FROM public.document_views WHERE org_id IS NULL LIMIT $1)
$SQL$);
CALL public._mig105_backfill($SQL$
  UPDATE public.documents t SET org_id = pm.org_id FROM public.org_members pm
  WHERE pm.user_id = t.user_id AND t.org_id IS NULL
    AND t.id IN (SELECT id FROM public.documents WHERE org_id IS NULL LIMIT $1)
$SQL$);
CALL public._mig105_backfill($SQL$
  UPDATE public.eval_ratings t SET org_id = pm.org_id FROM public.org_members pm
  WHERE pm.user_id = t.user_id AND t.org_id IS NULL
    AND t.id IN (SELECT id FROM public.eval_ratings WHERE org_id IS NULL LIMIT $1)
$SQL$);
CALL public._mig105_backfill($SQL$
  UPDATE public.eval_results t SET org_id = pm.org_id FROM public.org_members pm
  WHERE pm.user_id = t.user_id AND t.org_id IS NULL
    AND t.id IN (SELECT id FROM public.eval_results WHERE org_id IS NULL LIMIT $1)
$SQL$);
CALL public._mig105_backfill($SQL$
  UPDATE public.eval_runs t SET org_id = pm.org_id FROM public.org_members pm
  WHERE pm.user_id = t.user_id AND t.org_id IS NULL
    AND t.id IN (SELECT id FROM public.eval_runs WHERE org_id IS NULL LIMIT $1)
$SQL$);
CALL public._mig105_backfill($SQL$
  UPDATE public.folders t SET org_id = pm.org_id FROM public.org_members pm
  WHERE pm.user_id = t.user_id AND t.org_id IS NULL
    AND t.id IN (SELECT id FROM public.folders WHERE org_id IS NULL LIMIT $1)
$SQL$);
CALL public._mig105_backfill($SQL$
  UPDATE public.harness_audit t SET org_id = pm.org_id FROM public.org_members pm
  WHERE pm.user_id = t.user_id AND t.org_id IS NULL
    AND t.id IN (SELECT id FROM public.harness_audit WHERE org_id IS NULL LIMIT $1)
$SQL$);
CALL public._mig105_backfill($SQL$
  UPDATE public.message_feedback t SET org_id = pm.org_id FROM public.org_members pm
  WHERE pm.user_id = t.user_id AND t.org_id IS NULL
    AND t.id IN (SELECT id FROM public.message_feedback WHERE org_id IS NULL LIMIT $1)
$SQL$);
CALL public._mig105_backfill($SQL$
  UPDATE public.messages t SET org_id = pm.org_id FROM public.org_members pm
  WHERE pm.user_id = t.user_id AND t.org_id IS NULL
    AND t.id IN (SELECT id FROM public.messages WHERE org_id IS NULL LIMIT $1)
$SQL$);
CALL public._mig105_backfill($SQL$
  UPDATE public.pdf_extraction_runs t SET org_id = pm.org_id FROM public.org_members pm
  WHERE pm.user_id = t.user_id AND t.org_id IS NULL
    AND t.id IN (SELECT id FROM public.pdf_extraction_runs WHERE org_id IS NULL LIMIT $1)
$SQL$);
CALL public._mig105_backfill($SQL$
  UPDATE public.runs t SET org_id = pm.org_id FROM public.org_members pm
  WHERE pm.user_id = t.user_id AND t.org_id IS NULL
    AND t.id IN (SELECT id FROM public.runs WHERE org_id IS NULL LIMIT $1)
$SQL$);
CALL public._mig105_backfill($SQL$
  UPDATE public.sandbox_files t SET org_id = pm.org_id FROM public.org_members pm
  WHERE pm.user_id = t.user_id AND t.org_id IS NULL
    AND t.id IN (SELECT id FROM public.sandbox_files WHERE org_id IS NULL LIMIT $1)
$SQL$);
CALL public._mig105_backfill($SQL$
  UPDATE public.skill_files t SET org_id = pm.org_id FROM public.org_members pm
  WHERE pm.user_id = t.user_id AND t.org_id IS NULL
    AND t.id IN (SELECT id FROM public.skill_files WHERE org_id IS NULL LIMIT $1)
$SQL$);
CALL public._mig105_backfill($SQL$
  UPDATE public.skill_proposals t SET org_id = pm.org_id FROM public.org_members pm
  WHERE pm.user_id = t.user_id AND t.org_id IS NULL
    AND t.id IN (SELECT id FROM public.skill_proposals WHERE org_id IS NULL LIMIT $1)
$SQL$);
CALL public._mig105_backfill($SQL$
  UPDATE public.skill_publish_overrides t SET org_id = pm.org_id FROM public.org_members pm
  WHERE pm.user_id = t.user_id AND t.org_id IS NULL
    AND t.id IN (SELECT id FROM public.skill_publish_overrides WHERE org_id IS NULL LIMIT $1)
$SQL$);
CALL public._mig105_backfill($SQL$
  UPDATE public.skill_test_cases t SET org_id = pm.org_id FROM public.org_members pm
  WHERE pm.user_id = t.user_id AND t.org_id IS NULL
    AND t.id IN (SELECT id FROM public.skill_test_cases WHERE org_id IS NULL LIMIT $1)
$SQL$);
CALL public._mig105_backfill($SQL$
  UPDATE public.skill_versions t SET org_id = pm.org_id FROM public.org_members pm
  WHERE pm.user_id = t.user_id AND t.org_id IS NULL
    AND t.id IN (SELECT id FROM public.skill_versions WHERE org_id IS NULL LIMIT $1)
$SQL$);
CALL public._mig105_backfill($SQL$
  UPDATE public.skills t SET org_id = pm.org_id FROM public.org_members pm
  WHERE pm.user_id = t.user_id AND t.org_id IS NULL
    AND t.id IN (SELECT id FROM public.skills WHERE org_id IS NULL LIMIT $1)
$SQL$);
CALL public._mig105_backfill($SQL$
  UPDATE public.threads t SET org_id = pm.org_id FROM public.org_members pm
  WHERE pm.user_id = t.user_id AND t.org_id IS NULL
    AND t.id IN (SELECT id FROM public.threads WHERE org_id IS NULL LIMIT $1)
$SQL$);
CALL public._mig105_backfill($SQL$
  UPDATE public.tuner_runs t SET org_id = pm.org_id FROM public.org_members pm
  WHERE pm.user_id = t.user_id AND t.org_id IS NULL
    AND t.id IN (SELECT id FROM public.tuner_runs WHERE org_id IS NULL LIMIT $1)
$SQL$);
CALL public._mig105_backfill($SQL$
  UPDATE public.user_memory t SET org_id = pm.org_id FROM public.org_members pm
  WHERE pm.user_id = t.user_id AND t.org_id IS NULL
    AND t.id IN (SELECT id FROM public.user_memory WHERE org_id IS NULL LIMIT $1)
$SQL$);
CALL public._mig105_backfill($SQL$
  UPDATE public.user_settings t SET org_id = pm.org_id FROM public.org_members pm
  WHERE pm.user_id = t.user_id AND t.org_id IS NULL
    AND t.id IN (SELECT id FROM public.user_settings WHERE org_id IS NULL LIMIT $1)
$SQL$);
-- 2 resolved via created_by -> org_members.org_id (these two carry created_by, not user_id):
CALL public._mig105_backfill($SQL$
  UPDATE public.workflow_definitions t SET org_id = pm.org_id FROM public.org_members pm
  WHERE pm.user_id = t.created_by AND t.org_id IS NULL
    AND t.id IN (SELECT id FROM public.workflow_definitions WHERE org_id IS NULL LIMIT $1)
$SQL$);
CALL public._mig105_backfill($SQL$
  UPDATE public.workspace_files t SET org_id = pm.org_id FROM public.org_members pm
  WHERE pm.user_id = t.created_by AND t.org_id IS NULL
    AND t.id IN (SELECT id FROM public.workspace_files WHERE org_id IS NULL LIMIT $1)
$SQL$);
-- 1 nullable-owner resolved via user_id (0 NULL-owner rows live; the §C self-guard catches any straggler):
CALL public._mig105_backfill($SQL$
  UPDATE public.metadata_field_definitions t SET org_id = pm.org_id FROM public.org_members pm
  WHERE pm.user_id = t.user_id AND t.org_id IS NULL
    AND t.id IN (SELECT id FROM public.metadata_field_definitions WHERE org_id IS NULL LIMIT $1)
$SQL$);

-- ── WAVE 2 — 3 owner-less / nullable-owner children resolved via parent's ALREADY-backfilled org_id ──
-- (Wave-1 parents threads + workspace_files are committed above; child.org_id = parent.org_id is the
--  RLS-join invariant 163 relies on.)
CALL public._mig105_backfill($SQL$
  UPDATE public.workflow_runs c SET org_id = p.org_id FROM public.threads p
  WHERE p.id = c.thread_id AND c.org_id IS NULL AND p.org_id IS NOT NULL
    AND c.id IN (SELECT id FROM public.workflow_runs WHERE org_id IS NULL LIMIT $1)
$SQL$);
CALL public._mig105_backfill($SQL$
  UPDATE public.todos c SET org_id = p.org_id FROM public.threads p
  WHERE p.id = c.thread_id AND c.org_id IS NULL AND p.org_id IS NOT NULL
    AND c.id IN (SELECT id FROM public.todos WHERE org_id IS NULL LIMIT $1)
$SQL$);
CALL public._mig105_backfill($SQL$
  UPDATE public.workspace_file_versions c SET org_id = p.org_id FROM public.workspace_files p
  WHERE p.id = c.workspace_file_id AND c.org_id IS NULL AND p.org_id IS NOT NULL
    AND c.id IN (SELECT id FROM public.workspace_file_versions WHERE org_id IS NULL LIMIT $1)
$SQL$);

-- ── WAVE 3 — workflow_phases resolves via workflow_runs.org_id (MUST run AFTER the Wave-2 workflow_runs CALL) ──
CALL public._mig105_backfill($SQL$
  UPDATE public.workflow_phases wp SET org_id = p.org_id FROM public.workflow_runs p
  WHERE p.id = wp.workflow_run_id AND wp.org_id IS NULL AND p.org_id IS NOT NULL
    AND wp.id IN (SELECT id FROM public.workflow_phases WHERE org_id IS NULL LIMIT $1)
$SQL$);

-- =====  §C (NOT-NULL flips + DROP) is appended below by Plan 162-01 Task 3.  =====
