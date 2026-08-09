-- 106_org_id_autofill_trigger.sql
-- Phase 162 (MIG-01, gap-closure Plan 162-03) — transitional BEFORE-INSERT org_id auto-fill safety net.
--
-- WHY THIS EXISTS (the 162→163 seam):
--   Migration 105 flipped org_id NOT NULL across 35 user-facing tables. But the app does NOT populate
--   org_id on INSERT until Phase 163 (the RLS + user-JWT crux threads org_id explicitly). So RIGHT NOW
--   every app-style INSERT that omits org_id — `INSERT INTO threads (user_id, title) …`, messages,
--   documents, runs, todos, … — FAILS with "null value in column org_id violates not-null constraint".
--   This migration closes that gap: a BEFORE-INSERT trigger on each of the 35 backfilled tables
--   auto-fills org_id from the inserting row's OWNER — mirroring mig 105's per-table resolution EXACTLY
--   (105 lines 145-351) but at INSERT time instead of as a one-time UPDATE. The local app keeps working
--   NOW while the NOT-NULL flip stays in place; Phase 162's "nothing breaks" goal is genuinely met.
--
-- FOUR INVARIANTS (all four proven by Plan 162-03's acceptance test):
--   * FORWARD-COMPATIBLE — `IF NEW.org_id IS NOT NULL THEN RETURN NEW` is the FIRST statement, so when
--     163 starts threading org_id explicitly the trigger is a pure NO-OP (the provided value is used
--     unchanged). 163 supersedes this net without conflict; the net stays as a redundant belt.
--   * FAIL-SAFE — if the owner is unresolvable (NULL owner column, an owner with no org membership, or a
--     missing/NULL-org parent) the trigger LEAVES org_id NULL and the NOT-NULL constraint rejects the
--     row. No silent bad-org data is ever written.
--   * IDEMPOTENT / RE-PASTE-SAFE — CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS before every
--     CREATE TRIGGER. Re-running the whole file changes nothing.
--   * CLOUD-SAFE — the two functions are SECURITY DEFINER with a PINNED empty search_path (all refs
--     schema-qualified; pg_catalog is implicitly first), owned by `postgres` (which owns the tables), so
--     they need table-OWNERSHIP only, never superuser. Matches the mig-104 SECDEF hygiene pattern.
--
-- DESIGN — TWO shared functions parameterised by trigger args (TG_ARGV), not 35 hardcoded functions:
--   * public.autofill_org_id_by_owner()   — TG_ARGV[0] = owner column ('user_id' | 'created_by').
--       Reads (to_jsonb(NEW)->>owner)::uuid, resolves org_members.org_id for that user (LIMIT 1).
--   * public.autofill_org_id_from_parent()— TG_ARGV[0] = FK column on NEW, TG_ARGV[1] = parent table
--       (in public), TG_ARGV[2] = parent PK (default 'id'). Reads the parent row's org_id.
--   `to_jsonb(NEW)->>col` gives dynamic column access so ONE function serves every owner-based target.
--
-- LIMIT-1 / multi-org assumption (pre-167): each user has EXACTLY ONE membership at 162 time
--   (dup_membership=0 verified in 162-02), so the org_members lookup is unambiguous. 163 supersedes this
--   net BEFORE 167's multi-org invitations land, so no personal-org disambiguation is needed here.
--
-- BEFORE INSERT does NOT conflict with the UPDATE-only immutability triggers (skill_versions_no_update /
--   workflow_definitions_block_published) — those gate UPDATE, not INSERT; no DISABLE/ENABLE needed here
--   (contrast the mig-105 backfill, which had to wrap those two around its one-time UPDATE).
--
-- ── APPLY DISCIPLINE (CLAUDE.md numbered-migration rules) ──────────────────────────────────────
--   * Apply LOCAL by running this whole file through psycopg2 autocommit=True @ 127.0.0.1:54322 (the
--     proven mig-104/105/161 path), OR paste into the LOCAL Supabase SQL editor. NEVER `supabase db
--     push` / `db reset` (preserves dev data). This file has NO COMMIT statements, so a single wrapping
--     transaction is also fine — but autocommit matches the established path.
--   * AFTER applying: run `bash scripts/regenerate-full-schema.sh` (no --reset) and commit this
--     migration AND the regenerated supabase/full-schema.sql together (D-06). NEVER hand-edit it.
--   * Filename is digits-only (`106_…`) — a letter suffix like `106b` is silently skipped by the CLI.
--
-- ── CLOUD PARITY (do NOT touch cloud now) ──────────────────────────────────────────────────────
--   Migrations 099–105 + SECRETS_ENCRYPTION_KEY are already pending on the cloud (production) DB. 106
--   JOINS that pending set — applied to cloud only at the next operator-gated production push, in order
--   (099 → … → 105 → 106), per docs/DEPLOYMENT-WORKFLOW.md. This plan AUTHORS + applies LOCAL only.
--   Because 105+106 are now self-sufficient (deployable together WITHOUT 163), the cloud deploy is
--   decoupled from 163 — honoring the v3.4 4-tier deployment-flexibility contract (Phase-160 ADR SC#4).
--
-- ── DEPLOYMENT-ARTIFACT PARITY (NOT seed-bearing) ──────────────────────────────────────────────
--   106 adds only trigger functions + triggers — it seeds NO reference data, touches NO env var, no
--   bundled service, no sandbox tag. So it is NOT seed-bearing and owes NO docs/OPERATOR.md Step-3 or
--   scripts/check-deploy-drift.sh change (D-16 parity satisfied by exclusion, same as mig 105).
--
-- ── SECURITY NOTE (mig-104 CR-01 lesson, applied deliberately) ──────────────────────────────────
--   Both functions RETURN trigger (a pseudo-type). PostgREST does NOT expose trigger-returning functions
--   as /rpc endpoints (a direct call raises "trigger functions can only be called as triggers"), so —
--   unlike mig-104's callable SECDEF RPCs — there is NO anon/authenticated direct-call surface here.
--   We still REVOKE EXECUTE … FROM PUBLIC as defense-in-depth (matches the mig-104 SECDEF posture). This
--   does NOT affect trigger firing: PostgreSQL does not check EXECUTE on a trigger function when the
--   trigger fires — the REVOKE only closes the (already non-existent) direct-call path.

-- ================================================================================================
-- §1 — OWNER-BASED resolver  (GROUP 1 via user_id, GROUP 2 via created_by)
-- ================================================================================================
CREATE OR REPLACE FUNCTION public.autofill_org_id_by_owner()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $fn$
DECLARE
  v_owner_col text := TG_ARGV[0];      -- 'user_id' (GROUP 1) or 'created_by' (GROUP 2)
  v_owner_id  uuid;
  v_org_id    uuid;
BEGIN
  -- Forward-compat NO-OP: org_id already provided (e.g. Phase 163) -> keep it verbatim.
  IF NEW.org_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Dynamic owner-column read (one shared fn for all owner-based targets). to_jsonb / ->> / ::uuid
  -- all live in pg_catalog, which is implicitly first on the path even with search_path=''.
  v_owner_id := (to_jsonb(NEW) ->> v_owner_col)::uuid;
  IF v_owner_id IS NULL THEN
    RETURN NEW;                          -- fail-safe: no owner -> org_id stays NULL -> NOT NULL rejects
  END IF;

  -- One membership per user at 162 time (verified) -> LIMIT 1 is unambiguous pre-167.
  SELECT om.org_id INTO v_org_id
  FROM public.org_members om
  WHERE om.user_id = v_owner_id
  LIMIT 1;

  NEW.org_id := v_org_id;                -- may stay NULL (owner has no membership) -> fail-safe reject
  RETURN NEW;
END;
$fn$;

-- ================================================================================================
-- §2 — PARENT-FK resolver  (GROUP 3: owner-less children inherit the parent's org_id)
-- ================================================================================================
CREATE OR REPLACE FUNCTION public.autofill_org_id_from_parent()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $fn$
DECLARE
  v_fk_col     text := TG_ARGV[0];               -- FK column on NEW (e.g. 'thread_id')
  v_parent_tbl text := TG_ARGV[1];               -- parent table in public (e.g. 'threads')
  v_parent_pk  text := COALESCE(TG_ARGV[2], 'id');-- parent PK column (all 4 parents use 'id')
  v_fk_val     uuid;
  v_org_id     uuid;
BEGIN
  IF NEW.org_id IS NOT NULL THEN
    RETURN NEW;                          -- forward-compat no-op
  END IF;

  v_fk_val := (to_jsonb(NEW) ->> v_fk_col)::uuid;
  IF v_fk_val IS NULL THEN
    RETURN NEW;                          -- fail-safe: no parent ref -> NOT NULL rejects
  END IF;

  -- Resolve the parent row's org_id. public.%I is schema-qualified (pinned empty search_path); %I quotes
  -- the identifiers; the args are migration-authored constants (never user input) -> injection-safe.
  EXECUTE format('SELECT org_id FROM public.%I WHERE %I = $1 LIMIT 1', v_parent_tbl, v_parent_pk)
    INTO v_org_id
    USING v_fk_val;

  NEW.org_id := v_org_id;                -- may stay NULL (parent missing / parent.org_id NULL) -> reject
  RETURN NEW;
END;
$fn$;

-- Defense-in-depth: no direct-call surface for these trigger-returning fns (see SECURITY NOTE above).
-- Does NOT affect trigger firing (Postgres skips the EXECUTE check when a trigger fires).
REVOKE EXECUTE ON FUNCTION public.autofill_org_id_by_owner()    FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.autofill_org_id_from_parent() FROM PUBLIC;

-- ================================================================================================
-- §3 — GROUP 1 triggers (29 targets) — resolve org via own user_id -> org_members.org_id
-- ================================================================================================
DROP TRIGGER IF EXISTS audit_log_autofill_org_id ON public.audit_log;
CREATE TRIGGER audit_log_autofill_org_id BEFORE INSERT ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');

DROP TRIGGER IF EXISTS classification_rules_autofill_org_id ON public.classification_rules;
CREATE TRIGGER classification_rules_autofill_org_id BEFORE INSERT ON public.classification_rules
  FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');

DROP TRIGGER IF EXISTS code_executions_autofill_org_id ON public.code_executions;
CREATE TRIGGER code_executions_autofill_org_id BEFORE INSERT ON public.code_executions
  FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');

DROP TRIGGER IF EXISTS document_images_autofill_org_id ON public.document_images;
CREATE TRIGGER document_images_autofill_org_id BEFORE INSERT ON public.document_images
  FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');

DROP TRIGGER IF EXISTS document_relationships_autofill_org_id ON public.document_relationships;
CREATE TRIGGER document_relationships_autofill_org_id BEFORE INSERT ON public.document_relationships
  FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');

DROP TRIGGER IF EXISTS document_tables_autofill_org_id ON public.document_tables;
CREATE TRIGGER document_tables_autofill_org_id BEFORE INSERT ON public.document_tables
  FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');

DROP TRIGGER IF EXISTS document_views_autofill_org_id ON public.document_views;
CREATE TRIGGER document_views_autofill_org_id BEFORE INSERT ON public.document_views
  FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');

DROP TRIGGER IF EXISTS documents_autofill_org_id ON public.documents;
CREATE TRIGGER documents_autofill_org_id BEFORE INSERT ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');

DROP TRIGGER IF EXISTS eval_ratings_autofill_org_id ON public.eval_ratings;
CREATE TRIGGER eval_ratings_autofill_org_id BEFORE INSERT ON public.eval_ratings
  FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');

DROP TRIGGER IF EXISTS eval_results_autofill_org_id ON public.eval_results;
CREATE TRIGGER eval_results_autofill_org_id BEFORE INSERT ON public.eval_results
  FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');

DROP TRIGGER IF EXISTS eval_runs_autofill_org_id ON public.eval_runs;
CREATE TRIGGER eval_runs_autofill_org_id BEFORE INSERT ON public.eval_runs
  FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');

DROP TRIGGER IF EXISTS folders_autofill_org_id ON public.folders;
CREATE TRIGGER folders_autofill_org_id BEFORE INSERT ON public.folders
  FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');

DROP TRIGGER IF EXISTS harness_audit_autofill_org_id ON public.harness_audit;
CREATE TRIGGER harness_audit_autofill_org_id BEFORE INSERT ON public.harness_audit
  FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');

DROP TRIGGER IF EXISTS message_feedback_autofill_org_id ON public.message_feedback;
CREATE TRIGGER message_feedback_autofill_org_id BEFORE INSERT ON public.message_feedback
  FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');

DROP TRIGGER IF EXISTS messages_autofill_org_id ON public.messages;
CREATE TRIGGER messages_autofill_org_id BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');

DROP TRIGGER IF EXISTS pdf_extraction_runs_autofill_org_id ON public.pdf_extraction_runs;
CREATE TRIGGER pdf_extraction_runs_autofill_org_id BEFORE INSERT ON public.pdf_extraction_runs
  FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');

DROP TRIGGER IF EXISTS runs_autofill_org_id ON public.runs;
CREATE TRIGGER runs_autofill_org_id BEFORE INSERT ON public.runs
  FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');

DROP TRIGGER IF EXISTS sandbox_files_autofill_org_id ON public.sandbox_files;
CREATE TRIGGER sandbox_files_autofill_org_id BEFORE INSERT ON public.sandbox_files
  FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');

DROP TRIGGER IF EXISTS skill_files_autofill_org_id ON public.skill_files;
CREATE TRIGGER skill_files_autofill_org_id BEFORE INSERT ON public.skill_files
  FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');

DROP TRIGGER IF EXISTS skill_proposals_autofill_org_id ON public.skill_proposals;
CREATE TRIGGER skill_proposals_autofill_org_id BEFORE INSERT ON public.skill_proposals
  FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');

DROP TRIGGER IF EXISTS skill_publish_overrides_autofill_org_id ON public.skill_publish_overrides;
CREATE TRIGGER skill_publish_overrides_autofill_org_id BEFORE INSERT ON public.skill_publish_overrides
  FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');

DROP TRIGGER IF EXISTS skill_test_cases_autofill_org_id ON public.skill_test_cases;
CREATE TRIGGER skill_test_cases_autofill_org_id BEFORE INSERT ON public.skill_test_cases
  FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');

-- skill_versions carries skill_versions_no_update (an UPDATE-only immutability trigger) — a BEFORE
-- INSERT trigger is orthogonal to it, so no DISABLE/ENABLE is needed (contrast the mig-105 UPDATE).
DROP TRIGGER IF EXISTS skill_versions_autofill_org_id ON public.skill_versions;
CREATE TRIGGER skill_versions_autofill_org_id BEFORE INSERT ON public.skill_versions
  FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');

DROP TRIGGER IF EXISTS skills_autofill_org_id ON public.skills;
CREATE TRIGGER skills_autofill_org_id BEFORE INSERT ON public.skills
  FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');

DROP TRIGGER IF EXISTS threads_autofill_org_id ON public.threads;
CREATE TRIGGER threads_autofill_org_id BEFORE INSERT ON public.threads
  FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');

DROP TRIGGER IF EXISTS tuner_runs_autofill_org_id ON public.tuner_runs;
CREATE TRIGGER tuner_runs_autofill_org_id BEFORE INSERT ON public.tuner_runs
  FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');

DROP TRIGGER IF EXISTS user_memory_autofill_org_id ON public.user_memory;
CREATE TRIGGER user_memory_autofill_org_id BEFORE INSERT ON public.user_memory
  FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');

DROP TRIGGER IF EXISTS user_settings_autofill_org_id ON public.user_settings;
CREATE TRIGGER user_settings_autofill_org_id BEFORE INSERT ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');

DROP TRIGGER IF EXISTS metadata_field_definitions_autofill_org_id ON public.metadata_field_definitions;
CREATE TRIGGER metadata_field_definitions_autofill_org_id BEFORE INSERT ON public.metadata_field_definitions
  FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');

-- ================================================================================================
-- §4 — GROUP 2 triggers (2 targets) — resolve org via created_by -> org_members.org_id
-- ================================================================================================
-- workflow_definitions carries workflow_definitions_block_published (UPDATE-only) — orthogonal to a
-- BEFORE INSERT trigger; no DISABLE/ENABLE needed (contrast the mig-105 UPDATE backfill).
DROP TRIGGER IF EXISTS workflow_definitions_autofill_org_id ON public.workflow_definitions;
CREATE TRIGGER workflow_definitions_autofill_org_id BEFORE INSERT ON public.workflow_definitions
  FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('created_by');

DROP TRIGGER IF EXISTS workspace_files_autofill_org_id ON public.workspace_files;
CREATE TRIGGER workspace_files_autofill_org_id BEFORE INSERT ON public.workspace_files
  FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('created_by');

-- ================================================================================================
-- §5 — GROUP 3 triggers (4 owner-less children) — inherit org_id from the parent FK's row
-- (Mirrors mig 105 Waves 2-3: child.org_id = parent.org_id, the RLS-join invariant 163 relies on.)
-- ================================================================================================
DROP TRIGGER IF EXISTS workflow_runs_autofill_org_id ON public.workflow_runs;
CREATE TRIGGER workflow_runs_autofill_org_id BEFORE INSERT ON public.workflow_runs
  FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_from_parent('thread_id', 'threads', 'id');

DROP TRIGGER IF EXISTS todos_autofill_org_id ON public.todos;
CREATE TRIGGER todos_autofill_org_id BEFORE INSERT ON public.todos
  FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_from_parent('thread_id', 'threads', 'id');

DROP TRIGGER IF EXISTS workspace_file_versions_autofill_org_id ON public.workspace_file_versions;
CREATE TRIGGER workspace_file_versions_autofill_org_id BEFORE INSERT ON public.workspace_file_versions
  FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_from_parent('workspace_file_id', 'workspace_files', 'id');

DROP TRIGGER IF EXISTS workflow_phases_autofill_org_id ON public.workflow_phases;
CREATE TRIGGER workflow_phases_autofill_org_id BEFORE INSERT ON public.workflow_phases
  FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_from_parent('workflow_run_id', 'workflow_runs', 'id');

-- Closing note: 106 is a TRANSITIONAL net. Phase 163 threads org_id explicitly on every INSERT, at which
-- point every trigger above short-circuits on the `IF NEW.org_id IS NOT NULL` guard (pure no-op). The net
-- is intentionally kept after 163 as a redundant belt (fail-safe if any code path forgets org_id).
