-- 108_rls_membership_rewrite.sql
-- Phase 163 (TEN-01) — THE ATOMIC CRUX, Front A: rewrite every RLS predicate on all 37 target
-- user-facing tables from the per-user form  auth.uid() = user_id  to the membership form
--   org_id IN (SELECT public.current_user_org_ids()) AND (<owner> OR <preserved global branch>)
-- using the proven template already live on the 8 org tables (departments_* / organizations_* —
-- full-schema.sql:4976-5235). Shipped as ONE migration with 6 clearly-sectioned per-cluster bundles
-- (documents / DM / chat / skills / workflow-eval / identity-audit). Reviewability comes from the
-- SECTIONS, not letter-suffixed files (`108b_*` is silently skipped by the Supabase CLI).
--
-- WHY THIS IS ONE FILE / WHY IT IS INERT (D-06):
--   This is Front A of the crux. It is authored FIRST and applied while INERT — the current app
--   connections are BYPASSRLS (asyncpg DSN role = postgres; supabase-py = service_role), so NO policy
--   predicate is evaluated on any path. Applying this migration therefore changes ZERO behavior. The
--   Wave-4 client swap (per-request user-JWT client / SET LOCAL ROLE authenticated) is what FLIPS RLS
--   on. Because there must be NO window where the client is swapped but predicates are incomplete, ALL
--   37 tables land in THIS one migration — never "policies now, client later" for a subset.
--
-- ── MIGRATION ORDER (LOCKED — 107 BEFORE 108) ──────────────────────────────────────────────────
--   Apply 107 (TEN-04) FIRST, then 108. The document_chunks + skill_embeddings membership predicates
--   below reference the denormalized org_id column that migration 107 adds to those two pgvector hot
--   tables. Postgres applies migrations in integer filename order, so 107 lands first. Filename is
--   digits-only (`108_…`) — a letter suffix is silently skipped by the Supabase CLI (CLAUDE.md).
--
-- ── PREDICATE SHAPES (copied from the live departments_* template) ──────────────────────────────
--   * membership macro (identical on all rewritten tables) :  org_id IN (SELECT public.current_user_org_ids())
--       - the helper RETURNS SETOF uuid (full-schema.sql:212-217), so the shape is IN (SELECT …),
--         NEVER the ANY(array) form. It is SECURITY DEFINER / STABLE / search_path-pinned and reads
--         org_members off auth.uid() — this is the 42P17 recursion break (161), so the predicates
--         call the helper and NEVER inline an org_members subquery.
--   * Shape A (owner only)     :  <M> AND (auth.uid() = <owner>)
--   * Shape B (owner OR global):  <M> AND ((auth.uid() = <owner>) OR <global expr preserved verbatim>)
--   Every rewritten policy is  TO authenticated  (matches the org-table template; the swapped client
--   connects as role authenticated). Postgres has no CREATE-OR-REPLACE for policies, so each is
--   DROP POLICY IF EXISTS "<exact live name>" then re-created (re-paste-safe).
--
-- ── PRESERVED GLOBAL OR-BRANCHES (verbatim — T-163-02: a dropped branch is a data-loss/leak) ────
--   Using the LIVE column names is_global / is_system (the rename to is_org_shared / is_system_global
--   is Phase 165 — 162-D-05 binds; do NOT rename here):
--     * folder_is_globally_visible(folder_id) on documents ; folder_is_globally_visible(id) on folders
--     * is_global on document_views / classification_rules / metadata_field_definitions / skills /
--       workflow_definitions
--     * EXISTS-on-skills(is_global) subquery on skill_files and tuner_runs
--   The INSERT/UPDATE WITH CHECK clauses that today carry  is_global = false  (classification_rules /
--   document_views / metadata_field_definitions / workflow_definitions) keep that clause; the
--   membership macro is prepended to it.
--   Under the new shape a global row is now visible to its ORG's members (membership gates the OR),
--   not the entire install — post-162 every user has exactly one personal org, so membership-set
--   isolation == today's per-user behavior; org-wide sharing arrives with invitations (Phase 167).
--
-- ── SPECIAL OWNER COLUMNS / SPECIAL CASES ───────────────────────────────────────────────────────
--   * workflow_definitions owner column is  created_by  (NOT user_id).
--   * parent-thread-resolved tables keep their live ownership subquery and only PREPEND the membership
--     macro (org_id is backfilled by mig 105 + autofilled by mig 106 on these tables):
--       todos / workspace_files (via threads) ; workspace_file_versions (via workspace_files→threads) ;
--       workflow_runs (via threads) ; workflow_phases (via workflow_runs→threads).
--   * document_chunks / skill_embeddings reference the org_id column added by migration 107.
--   * profiles — DEVIATION (Rule 1/Rule 3, documented in 108-SUMMARY): profiles has NO org_id column
--     (verified live at head 107: mig 104 excluded it — it is the identity row keyed by id = auth.uid()).
--     A membership prefix here would reference a non-existent column and ABORT the whole rewrite at
--     apply. Its 3 policies are re-created with the OWNER branch only (auth.uid() = id) — byte-identical
--     self-only isolation, strictly more restrictive than membership. Org-wide profile visibility (roster)
--     is Phase 166, which will add profiles.org_id first.
--   * audit_log — D-10: genuinely org-agnostic operator/system audit rows must not vanish, so its
--     INSERT WITH CHECK carries an explicit  org_id IS NULL  branch reached via the operator path, in
--     addition to the membership branch. (Its org_id is NOT NULL today, so the branch is forward-compat
--     defense-in-depth; audit_log is insert-only for authenticated callers — operators read via
--     service-role, never via a SELECT policy.)
--
-- ── EXCLUDED (NOT rewritten — do NOT appear below) ──────────────────────────────────────────────
--   The 8 org tables (161-correct membership RLS already): departments, dept_members, organizations,
--   org_members (its non-recursive self-rows-only policy is sacrosanct — 161-D-10), org_invitations,
--   sso_configs. Global-read catalogs (USING true): model_capabilities_overrides, roles,
--   role_permissions. Operator deny-all path: operator_audit_log, operator_users, app_settings.
--
-- IDEMPOTENT / RE-PASTE-SAFE + ATOMIC: pure DDL wrapped in ONE BEGIN…COMMIT — all 97 policy swaps land
--   together or not at all (no half-rewritten window). DROP … IF EXISTS before each create. Re-running
--   the whole paste is a safe recovery.
--
-- ── APPLY DISCIPLINE (CLAUDE.md) — AUTHORED HERE, APPLIED IN PLAN 163-05 ─────────────────────────
--   This plan (163-03) only AUTHORS the file. The operator APPLIES it in the [BLOCKING] Wave-3 plan
--   (163-05) by pasting it — AFTER 107 — into the LOCAL Supabase SQL editor as ONE execution (pure DDL,
--   BEGIN…COMMIT is fine). NEVER `supabase db push` / `db reset` (preserves dev data). Do NOT apply it
--   here, and do NOT paste it into any DB from this plan. After applying (plan 163-05): run
--   `bash scripts/regenerate-full-schema.sh` (no --reset) and commit the migration + regenerated
--   supabase/full-schema.sql together (D-06). NEVER hand-edit full-schema.sql.
--
-- ── CLOUD PARITY / DEPLOYMENT-ARTIFACT PARITY ───────────────────────────────────────────────────
--   108 joins the pending cloud set (099 → … → 107 → 108), applied to production only at the next
--   operator-gated push, in order. It is schema-only (policy DDL) — it seeds NO reference data, touches
--   NO env var / bundled service / sandbox tag — so it is NOT seed-bearing and owes NO docs/OPERATOR.md
--   or check-deploy-drift.sh change (D-16 satisfied by exclusion, as mig 105/106/107).

BEGIN;

-- ================================================================================================
-- §1 — DOCUMENTS cluster (4 tables): documents, folders, document_views, document_chunks
--   Global branches preserved: folder_is_globally_visible on documents+folders ; is_global on
--   document_views. document_chunks references the org_id added by migration 107.
-- ================================================================================================

-- documents (owner = user_id ; SELECT carries the global-folder branch) --------------------------
DROP POLICY IF EXISTS "Users can delete their own documents" ON public.documents;
CREATE POLICY "Users can delete their own documents" ON public.documents FOR DELETE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can insert their own documents" ON public.documents;
CREATE POLICY "Users can insert their own documents" ON public.documents FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can update their own documents" ON public.documents;
CREATE POLICY "Users can update their own documents" ON public.documents FOR UPDATE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can view own or global-folder documents" ON public.documents;
CREATE POLICY "Users can view own or global-folder documents" ON public.documents FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids())
         AND ((auth.uid() = user_id) OR ((folder_id IS NOT NULL) AND public.folder_is_globally_visible(folder_id))));

-- folders (owner = user_id ; SELECT carries the global-folder branch) ----------------------------
DROP POLICY IF EXISTS "Users can delete own folders" ON public.folders;
CREATE POLICY "Users can delete own folders" ON public.folders FOR DELETE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can insert own folders" ON public.folders;
CREATE POLICY "Users can insert own folders" ON public.folders FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can update own folders" ON public.folders;
CREATE POLICY "Users can update own folders" ON public.folders FOR UPDATE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can view own and global folders" ON public.folders;
CREATE POLICY "Users can view own and global folders" ON public.folders FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids())
         AND ((auth.uid() = user_id) OR public.folder_is_globally_visible(id)));

-- document_views (owner = user_id ; is_global branch ; INSERT/UPDATE keep is_global = false) ------
DROP POLICY IF EXISTS "Users can delete own document_views" ON public.document_views;
CREATE POLICY "Users can delete own document_views" ON public.document_views FOR DELETE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can insert own document_views" ON public.document_views;
CREATE POLICY "Users can insert own document_views" ON public.document_views FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id) AND (is_global = false));

DROP POLICY IF EXISTS "Users can update own document_views" ON public.document_views;
CREATE POLICY "Users can update own document_views" ON public.document_views FOR UPDATE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id))
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id) AND (is_global = false));

DROP POLICY IF EXISTS "Users can view own and global document_views" ON public.document_views;
CREATE POLICY "Users can view own and global document_views" ON public.document_views FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND ((auth.uid() = user_id) OR (is_global = true)));

-- document_chunks (owner = user_id ; org_id from migration 107 ; no global branch) ---------------
DROP POLICY IF EXISTS "Users can delete their own chunks" ON public.document_chunks;
CREATE POLICY "Users can delete their own chunks" ON public.document_chunks FOR DELETE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can insert their own chunks" ON public.document_chunks;
CREATE POLICY "Users can insert their own chunks" ON public.document_chunks FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can update their own chunks" ON public.document_chunks;
CREATE POLICY "Users can update their own chunks" ON public.document_chunks FOR UPDATE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can view their own chunks" ON public.document_chunks;
CREATE POLICY "Users can view their own chunks" ON public.document_chunks FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

-- ================================================================================================
-- §2 — DM / doc-management cluster (6 tables): document_images, document_tables,
--   document_relationships, classification_rules, metadata_field_definitions, pdf_extraction_runs
--   Global branches preserved: is_global on classification_rules + metadata_field_definitions.
--   document_images/document_tables use a single FOR ALL policy ; pdf_extraction_runs is SELECT-only.
-- ================================================================================================

-- document_images (owner = user_id ; single FOR ALL policy) --------------------------------------
DROP POLICY IF EXISTS "Users can manage own document images" ON public.document_images;
CREATE POLICY "Users can manage own document images" ON public.document_images FOR ALL TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()) AND (user_id = auth.uid()));

-- document_tables (owner = user_id ; single FOR ALL policy) --------------------------------------
DROP POLICY IF EXISTS "Users can manage own document tables" ON public.document_tables;
CREATE POLICY "Users can manage own document tables" ON public.document_tables FOR ALL TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()) AND (user_id = auth.uid()));

-- document_relationships (owner = user_id ; no global branch) ------------------------------------
DROP POLICY IF EXISTS "Users can delete own document_relationships" ON public.document_relationships;
CREATE POLICY "Users can delete own document_relationships" ON public.document_relationships FOR DELETE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can insert own document_relationships" ON public.document_relationships;
CREATE POLICY "Users can insert own document_relationships" ON public.document_relationships FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can update own document_relationships" ON public.document_relationships;
CREATE POLICY "Users can update own document_relationships" ON public.document_relationships FOR UPDATE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id))
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can view own document_relationships" ON public.document_relationships;
CREATE POLICY "Users can view own document_relationships" ON public.document_relationships FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

-- classification_rules (owner = user_id ; is_global branch ; INSERT/UPDATE keep is_global = false) -
DROP POLICY IF EXISTS "Users can delete own classification_rules" ON public.classification_rules;
CREATE POLICY "Users can delete own classification_rules" ON public.classification_rules FOR DELETE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can insert own classification_rules" ON public.classification_rules;
CREATE POLICY "Users can insert own classification_rules" ON public.classification_rules FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id) AND (is_global = false));

DROP POLICY IF EXISTS "Users can update own classification_rules" ON public.classification_rules;
CREATE POLICY "Users can update own classification_rules" ON public.classification_rules FOR UPDATE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id))
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id) AND (is_global = false));

DROP POLICY IF EXISTS "Users can view own and global classification_rules" ON public.classification_rules;
CREATE POLICY "Users can view own and global classification_rules" ON public.classification_rules FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND ((auth.uid() = user_id) OR (is_global = true)));

-- metadata_field_definitions (owner = user_id ; is_global branch ; INSERT/UPDATE keep is_global=false)
DROP POLICY IF EXISTS "Users can delete own metadata_field_definitions" ON public.metadata_field_definitions;
CREATE POLICY "Users can delete own metadata_field_definitions" ON public.metadata_field_definitions FOR DELETE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can insert own metadata_field_definitions" ON public.metadata_field_definitions;
CREATE POLICY "Users can insert own metadata_field_definitions" ON public.metadata_field_definitions FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id) AND (is_global = false));

DROP POLICY IF EXISTS "Users can update own metadata_field_definitions" ON public.metadata_field_definitions;
CREATE POLICY "Users can update own metadata_field_definitions" ON public.metadata_field_definitions FOR UPDATE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id))
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id) AND (is_global = false));

DROP POLICY IF EXISTS "Users can view own and global metadata_field_definitions" ON public.metadata_field_definitions;
CREATE POLICY "Users can view own and global metadata_field_definitions" ON public.metadata_field_definitions FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND ((auth.uid() = user_id) OR (is_global = true)));

-- pdf_extraction_runs (owner = user_id ; SELECT-only ; terse live name) --------------------------
DROP POLICY IF EXISTS pdf_extraction_runs_select_own ON public.pdf_extraction_runs;
CREATE POLICY pdf_extraction_runs_select_own ON public.pdf_extraction_runs FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

-- ================================================================================================
-- §3 — CHAT cluster (10 tables): threads, messages, message_feedback, runs, code_executions,
--   sandbox_files, todos, user_memory, workspace_files, workspace_file_versions
--   No global branches. todos / workspace_files / workspace_file_versions resolve ownership through
--   the parent thread — that subquery is preserved verbatim and only PREPENDED with the membership
--   macro (their org_id is backfilled by mig 105 + autofilled by mig 106).
-- ================================================================================================

-- threads (owner = user_id) ----------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can delete their own threads" ON public.threads;
CREATE POLICY "Users can delete their own threads" ON public.threads FOR DELETE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can insert their own threads" ON public.threads;
CREATE POLICY "Users can insert their own threads" ON public.threads FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can update their own threads" ON public.threads;
CREATE POLICY "Users can update their own threads" ON public.threads FOR UPDATE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can view their own threads" ON public.threads;
CREATE POLICY "Users can view their own threads" ON public.threads FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

-- messages (owner = user_id) ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.messages;
CREATE POLICY "Users can delete their own messages" ON public.messages FOR DELETE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can insert their own messages" ON public.messages;
CREATE POLICY "Users can insert their own messages" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;
CREATE POLICY "Users can update their own messages" ON public.messages FOR UPDATE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can view their own messages" ON public.messages;
CREATE POLICY "Users can view their own messages" ON public.messages FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

-- message_feedback (owner = user_id ; INSERT + SELECT) -------------------------------------------
DROP POLICY IF EXISTS "Users can insert own feedback" ON public.message_feedback;
CREATE POLICY "Users can insert own feedback" ON public.message_feedback FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can select own feedback" ON public.message_feedback;
CREATE POLICY "Users can select own feedback" ON public.message_feedback FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

-- runs (owner = user_id ; SELECT-only ; terse live name) -----------------------------------------
DROP POLICY IF EXISTS runs_select_own ON public.runs;
CREATE POLICY runs_select_own ON public.runs FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

-- code_executions (owner = user_id ; INSERT + SELECT) --------------------------------------------
DROP POLICY IF EXISTS "Users can insert own executions" ON public.code_executions;
CREATE POLICY "Users can insert own executions" ON public.code_executions FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can view own executions" ON public.code_executions;
CREATE POLICY "Users can view own executions" ON public.code_executions FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

-- sandbox_files (owner = user_id ; INSERT + SELECT) ----------------------------------------------
DROP POLICY IF EXISTS "Users can insert own sandbox files" ON public.sandbox_files;
CREATE POLICY "Users can insert own sandbox files" ON public.sandbox_files FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can view own sandbox files" ON public.sandbox_files;
CREATE POLICY "Users can view own sandbox files" ON public.sandbox_files FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

-- todos (ownership resolved through the parent thread — subquery preserved verbatim) --------------
DROP POLICY IF EXISTS todos_delete_own ON public.todos;
CREATE POLICY todos_delete_own ON public.todos FOR DELETE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids())
         AND (auth.uid() = (SELECT threads.user_id FROM public.threads WHERE (threads.id = todos.thread_id))));

DROP POLICY IF EXISTS todos_insert_own ON public.todos;
CREATE POLICY todos_insert_own ON public.todos FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids())
              AND (auth.uid() = (SELECT threads.user_id FROM public.threads WHERE (threads.id = todos.thread_id))));

DROP POLICY IF EXISTS todos_select_own ON public.todos;
CREATE POLICY todos_select_own ON public.todos FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids())
         AND (auth.uid() = (SELECT threads.user_id FROM public.threads WHERE (threads.id = todos.thread_id))));

DROP POLICY IF EXISTS todos_update_own ON public.todos;
CREATE POLICY todos_update_own ON public.todos FOR UPDATE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids())
         AND (auth.uid() = (SELECT threads.user_id FROM public.threads WHERE (threads.id = todos.thread_id))));

-- user_memory (owner = user_id) ------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can delete own memory" ON public.user_memory;
CREATE POLICY "Users can delete own memory" ON public.user_memory FOR DELETE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can insert own memory" ON public.user_memory;
CREATE POLICY "Users can insert own memory" ON public.user_memory FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can update own memory" ON public.user_memory;
CREATE POLICY "Users can update own memory" ON public.user_memory FOR UPDATE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can select own memory" ON public.user_memory;
CREATE POLICY "Users can select own memory" ON public.user_memory FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

-- workspace_files (ownership resolved through the parent thread — subquery preserved verbatim) ----
DROP POLICY IF EXISTS workspace_files_delete_own ON public.workspace_files;
CREATE POLICY workspace_files_delete_own ON public.workspace_files FOR DELETE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids())
         AND (auth.uid() = (SELECT threads.user_id FROM public.threads WHERE (threads.id = workspace_files.thread_id))));

DROP POLICY IF EXISTS workspace_files_insert_own ON public.workspace_files;
CREATE POLICY workspace_files_insert_own ON public.workspace_files FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids())
              AND (auth.uid() = (SELECT threads.user_id FROM public.threads WHERE (threads.id = workspace_files.thread_id))));

DROP POLICY IF EXISTS workspace_files_select_own ON public.workspace_files;
CREATE POLICY workspace_files_select_own ON public.workspace_files FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids())
         AND (auth.uid() = (SELECT threads.user_id FROM public.threads WHERE (threads.id = workspace_files.thread_id))));

DROP POLICY IF EXISTS workspace_files_update_own ON public.workspace_files;
CREATE POLICY workspace_files_update_own ON public.workspace_files FOR UPDATE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids())
         AND (auth.uid() = (SELECT threads.user_id FROM public.threads WHERE (threads.id = workspace_files.thread_id))));

-- workspace_file_versions (ownership via workspace_files → threads — subquery preserved verbatim) -
DROP POLICY IF EXISTS workspace_versions_insert_own ON public.workspace_file_versions;
CREATE POLICY workspace_versions_insert_own ON public.workspace_file_versions FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids())
              AND (auth.uid() = (SELECT t.user_id
                   FROM (public.threads t JOIN public.workspace_files wf ON ((wf.thread_id = t.id)))
                  WHERE (wf.id = workspace_file_versions.workspace_file_id))));

DROP POLICY IF EXISTS workspace_versions_select_own ON public.workspace_file_versions;
CREATE POLICY workspace_versions_select_own ON public.workspace_file_versions FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids())
         AND (auth.uid() = (SELECT t.user_id
              FROM (public.threads t JOIN public.workspace_files wf ON ((wf.thread_id = t.id)))
             WHERE (wf.id = workspace_file_versions.workspace_file_id))));

-- ================================================================================================
-- §4 — SKILLS cluster (7 tables): skills, skill_files, skill_versions, skill_test_cases,
--   skill_proposals, skill_publish_overrides, skill_embeddings
--   Global branches preserved: is_global on skills ; EXISTS-on-skills(is_global) subquery on
--   skill_files. skill_embeddings references the org_id added by migration 107. The eval/version/
--   proposal/override tables are SELECT-only for authenticated callers (writes go via service-role).
-- ================================================================================================

-- skills (owner = user_id ; is_global branch on SELECT) ------------------------------------------
DROP POLICY IF EXISTS "Users can delete own skills" ON public.skills;
CREATE POLICY "Users can delete own skills" ON public.skills FOR DELETE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can insert own skills" ON public.skills;
CREATE POLICY "Users can insert own skills" ON public.skills FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can update own skills" ON public.skills;
CREATE POLICY "Users can update own skills" ON public.skills FOR UPDATE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can view own and global skills" ON public.skills;
CREATE POLICY "Users can view own and global skills" ON public.skills FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND ((auth.uid() = user_id) OR (is_global = true)));

-- skill_files (owner = user_id ; EXISTS-on-skills global branch on SELECT ; DELETE+INSERT+SELECT) -
DROP POLICY IF EXISTS "Users can delete own skill files" ON public.skill_files;
CREATE POLICY "Users can delete own skill files" ON public.skill_files FOR DELETE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can insert own skill files" ON public.skill_files;
CREATE POLICY "Users can insert own skill files" ON public.skill_files FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can view files on own or global skills" ON public.skill_files;
CREATE POLICY "Users can view files on own or global skills" ON public.skill_files FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids())
         AND ((auth.uid() = user_id) OR (EXISTS ( SELECT 1
             FROM public.skills
            WHERE ((skills.id = skill_files.skill_id) AND (skills.is_global = true))))));

-- skill_versions (owner = user_id ; SELECT-only) -------------------------------------------------
DROP POLICY IF EXISTS "Users can view own skill versions" ON public.skill_versions;
CREATE POLICY "Users can view own skill versions" ON public.skill_versions FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

-- skill_test_cases (owner = user_id) -------------------------------------------------------------
DROP POLICY IF EXISTS "Users can delete own skill test cases" ON public.skill_test_cases;
CREATE POLICY "Users can delete own skill test cases" ON public.skill_test_cases FOR DELETE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can insert own skill test cases" ON public.skill_test_cases;
CREATE POLICY "Users can insert own skill test cases" ON public.skill_test_cases FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can update own skill test cases" ON public.skill_test_cases;
CREATE POLICY "Users can update own skill test cases" ON public.skill_test_cases FOR UPDATE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can view own skill test cases" ON public.skill_test_cases;
CREATE POLICY "Users can view own skill test cases" ON public.skill_test_cases FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

-- skill_proposals (owner = user_id ; SELECT-only) ------------------------------------------------
DROP POLICY IF EXISTS "Users can view own skill proposals" ON public.skill_proposals;
CREATE POLICY "Users can view own skill proposals" ON public.skill_proposals FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

-- skill_publish_overrides (owner = user_id ; SELECT-only) ----------------------------------------
DROP POLICY IF EXISTS "Users can view own publish overrides" ON public.skill_publish_overrides;
CREATE POLICY "Users can view own publish overrides" ON public.skill_publish_overrides FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

-- skill_embeddings (owner = user_id ; org_id from migration 107 ; SELECT-only) -------------------
DROP POLICY IF EXISTS "Users can view own skill embeddings" ON public.skill_embeddings;
CREATE POLICY "Users can view own skill embeddings" ON public.skill_embeddings FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

-- ================================================================================================
-- §5 — WORKFLOW-EVAL cluster (8 tables): workflow_definitions, workflow_phases, workflow_runs,
--   eval_runs, eval_results, eval_ratings, tuner_runs, harness_audit
--   Special: workflow_definitions owner column is created_by (NOT user_id) + is_global branch.
--   workflow_phases/workflow_runs resolve ownership through the parent thread (subquery preserved).
--   tuner_runs preserves the EXISTS-on-skills(is_global) global branch. eval_* are SELECT-only.
-- ================================================================================================

-- workflow_definitions (owner = created_by ; is_global branch ; INSERT/UPDATE keep is_global=false)
DROP POLICY IF EXISTS "Users can delete own workflow definitions" ON public.workflow_definitions;
CREATE POLICY "Users can delete own workflow definitions" ON public.workflow_definitions FOR DELETE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = created_by));

DROP POLICY IF EXISTS "Users can insert own workflow definitions" ON public.workflow_definitions;
CREATE POLICY "Users can insert own workflow definitions" ON public.workflow_definitions FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = created_by) AND (is_global = false));

DROP POLICY IF EXISTS "Users can update own workflow definitions" ON public.workflow_definitions;
CREATE POLICY "Users can update own workflow definitions" ON public.workflow_definitions FOR UPDATE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = created_by))
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = created_by) AND (is_global = false));

DROP POLICY IF EXISTS "Users can view own and global workflow definitions" ON public.workflow_definitions;
CREATE POLICY "Users can view own and global workflow definitions" ON public.workflow_definitions FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND ((auth.uid() = created_by) OR (is_global = true)));

-- workflow_phases (ownership via workflow_runs → threads — subquery preserved verbatim) -----------
DROP POLICY IF EXISTS workflow_phases_delete_own ON public.workflow_phases;
CREATE POLICY workflow_phases_delete_own ON public.workflow_phases FOR DELETE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids())
         AND (auth.uid() = (SELECT t.user_id
              FROM (public.threads t JOIN public.workflow_runs wr ON ((wr.thread_id = t.id)))
             WHERE (wr.id = workflow_phases.workflow_run_id))));

DROP POLICY IF EXISTS workflow_phases_insert_own ON public.workflow_phases;
CREATE POLICY workflow_phases_insert_own ON public.workflow_phases FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids())
              AND (auth.uid() = (SELECT t.user_id
                   FROM (public.threads t JOIN public.workflow_runs wr ON ((wr.thread_id = t.id)))
                  WHERE (wr.id = workflow_phases.workflow_run_id))));

DROP POLICY IF EXISTS workflow_phases_select_own ON public.workflow_phases;
CREATE POLICY workflow_phases_select_own ON public.workflow_phases FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids())
         AND (auth.uid() = (SELECT t.user_id
              FROM (public.threads t JOIN public.workflow_runs wr ON ((wr.thread_id = t.id)))
             WHERE (wr.id = workflow_phases.workflow_run_id))));

DROP POLICY IF EXISTS workflow_phases_update_own ON public.workflow_phases;
CREATE POLICY workflow_phases_update_own ON public.workflow_phases FOR UPDATE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids())
         AND (auth.uid() = (SELECT t.user_id
              FROM (public.threads t JOIN public.workflow_runs wr ON ((wr.thread_id = t.id)))
             WHERE (wr.id = workflow_phases.workflow_run_id))))
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids())
              AND (auth.uid() = (SELECT t.user_id
                   FROM (public.threads t JOIN public.workflow_runs wr ON ((wr.thread_id = t.id)))
                  WHERE (wr.id = workflow_phases.workflow_run_id))));

-- workflow_runs (ownership via threads — subquery preserved verbatim) -----------------------------
DROP POLICY IF EXISTS workflow_runs_delete_own ON public.workflow_runs;
CREATE POLICY workflow_runs_delete_own ON public.workflow_runs FOR DELETE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids())
         AND (auth.uid() = (SELECT threads.user_id FROM public.threads WHERE (threads.id = workflow_runs.thread_id))));

DROP POLICY IF EXISTS workflow_runs_insert_own ON public.workflow_runs;
CREATE POLICY workflow_runs_insert_own ON public.workflow_runs FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids())
              AND (auth.uid() = (SELECT threads.user_id FROM public.threads WHERE (threads.id = workflow_runs.thread_id))));

DROP POLICY IF EXISTS workflow_runs_select_own ON public.workflow_runs;
CREATE POLICY workflow_runs_select_own ON public.workflow_runs FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids())
         AND (auth.uid() = (SELECT threads.user_id FROM public.threads WHERE (threads.id = workflow_runs.thread_id))));

DROP POLICY IF EXISTS workflow_runs_update_own ON public.workflow_runs;
CREATE POLICY workflow_runs_update_own ON public.workflow_runs FOR UPDATE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids())
         AND (auth.uid() = (SELECT threads.user_id FROM public.threads WHERE (threads.id = workflow_runs.thread_id))))
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids())
              AND (auth.uid() = (SELECT threads.user_id FROM public.threads WHERE (threads.id = workflow_runs.thread_id))));

-- eval_runs (owner = user_id ; SELECT-only) ------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own eval runs" ON public.eval_runs;
CREATE POLICY "Users can view own eval runs" ON public.eval_runs FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

-- eval_results (owner = user_id ; SELECT-only) ---------------------------------------------------
DROP POLICY IF EXISTS "Users can view own eval results" ON public.eval_results;
CREATE POLICY "Users can view own eval results" ON public.eval_results FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

-- eval_ratings (owner = user_id ; SELECT-only) ---------------------------------------------------
DROP POLICY IF EXISTS "Users can view own eval ratings" ON public.eval_ratings;
CREATE POLICY "Users can view own eval ratings" ON public.eval_ratings FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

-- tuner_runs (owner = user_id ; EXISTS-on-skills global branch on SELECT ; SELECT-only) ----------
DROP POLICY IF EXISTS "Users can view tuner runs on own or global skills" ON public.tuner_runs;
CREATE POLICY "Users can view tuner runs on own or global skills" ON public.tuner_runs FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids())
         AND ((auth.uid() = user_id) OR (EXISTS ( SELECT 1
             FROM public.skills
            WHERE ((skills.id = tuner_runs.skill_id) AND (skills.is_global = true))))));

-- harness_audit (owner = user_id ; INSERT + SELECT) ----------------------------------------------
DROP POLICY IF EXISTS "Users can insert own harness audit" ON public.harness_audit;
CREATE POLICY "Users can insert own harness audit" ON public.harness_audit FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can view own harness audit" ON public.harness_audit;
CREATE POLICY "Users can view own harness audit" ON public.harness_audit FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

-- ================================================================================================
-- §6 — IDENTITY-AUDIT cluster (2 tables): profiles, audit_log
--   profiles — DEVIATION (see header): NO org_id column (verified live at head 107), so its 3
--     policies keep the OWNER branch ONLY (auth.uid() = id) — byte-identical self-only isolation,
--     no membership macro. A membership prefix would reference a non-existent column and abort the
--     whole rewrite at apply. Org-wide roster visibility is Phase 166 (adds profiles.org_id first).
--   audit_log — D-10: insert-only for authenticated callers; its WITH CHECK carries an explicit
--     org_id IS NULL branch so genuinely org-agnostic operator/system audit rows (reached via the
--     operator/service-role path) are never rejected, in addition to the membership branch.
-- ================================================================================================

-- profiles (owner = id ; NO org_id column — owner-only, no membership macro by design) ------------
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- audit_log (owner = user_id ; INSERT-only ; explicit org_id IS NULL branch — D-10) --------------
DROP POLICY IF EXISTS "Users can insert own audit entries" ON public.audit_log;
CREATE POLICY "Users can insert own audit entries" ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK ((user_id = auth.uid())
              AND ((org_id IS NULL) OR (org_id IN (SELECT public.current_user_org_ids()))));

COMMIT;

-- Closing note: 108 rewrites all 37 target user-facing tables (97 policies across the 6 sections) to
-- the membership predicate org_id IN (SELECT public.current_user_org_ids()) AND (owner [OR preserved
-- global branch]), TO authenticated, using the live departments_* template — every global OR-branch
-- (folder_is_globally_visible / is_global / EXISTS-on-skills), the is_global=false WITH CHECKs, the
-- created_by owner on workflow_definitions, and the parent-thread ownership subqueries preserved
-- verbatim; profiles kept owner-only (no org_id column); audit_log carries the D-10 NULL branch. The
-- migration is BEGIN/COMMIT-atomic + re-paste-safe, and INERT under the current BYPASSRLS connections
-- — it changes zero behavior until the Wave-4 client swap. Apply AFTER 107; then regenerate
-- full-schema (plan 163-05). The 8 org tables + operator/catalog tables are deliberately untouched.

