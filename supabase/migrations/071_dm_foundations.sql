-- 071_dm_foundations.sql — v3.0 Document Management substrate (Phase 110, DMF-01/02/03).
-- 4 RLS tables + audit CHECK 11->19 + app_settings.document_management_enabled.
--
-- Apply by pasting this whole file into the Supabase SQL editor (or psycopg2 to
-- local :54322 per the 100/099/101.1/102 precedent) — NEVER `supabase db push` /
-- `db reset` (preserves dev data); then `bash scripts/regenerate-full-schema.sh`
-- (no --reset), commit migration + regenerated full-schema.sql + the code edits
-- together. Plan 02 (operator, autonomous:false) applies it + regenerates.
-- This plan ONLY AUTHORS the file — it is NOT applied here.
--
-- Wrapped in one BEGIN; ... COMMIT; so a partial failure rolls back atomically.

BEGIN;

-- ============================================================================
-- Section 1 — audit_log CHECK DROP/ADD (11 -> 19)
-- ----------------------------------------------------------------------------
-- Copy the existing 11 VERBATIM (do not reorder/rename), add the 8 D-110-1
-- strings (locked vocabulary — downstream phases 111-119 consume as-is). This
-- array MUST stay in lockstep with audit_service.VALID_ACTION_TYPES (the silent
-- audit-drop trap this phase exists to remove — write_audit_entry swallows the
-- 23514). Plain DROP+ADD (not NOT VALID+VALIDATE): net-new values, no existing
-- row violates the broader CHECK; instant on dev (A1). Prod-cutover note ONLY: a
-- large audit_log takes ACCESS EXCLUSIVE during the validation scan.
-- ============================================================================
ALTER TABLE public.audit_log DROP CONSTRAINT audit_log_action_type_check;
ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_action_type_check
  CHECK (action_type = ANY (ARRAY[
    -- existing 11 (preserve VERBATIM)
    'document.upload','document.delete','search.query','code.execute','skill.load',
    'thread.create','thread.delete','settings.update','memory.remember','memory.recall','feedback.submit',
    -- 8 new DM types (D-110-1): 113/114 views, 116 relationships, 118 classification, 112 metadata.update, 111 metadata.field.create
    'view.create','view.delete','relationship.create','relationship.delete',
    'classification.apply','classification.rule.create','metadata.update','metadata.field.create'
  ]::text[]));

-- ============================================================================
-- Section 2 — the 4 CREATE TABLE blocks (D-110-3 × ARCHITECTURE.md §1-4)
-- RLS shape mirrors `skills` (user_id + is_global), borrowing the
-- workflow_definitions global-INSERT forcing (is_global=false). org_id is a
-- nullable, no-FK forward-compat column on every table (F7 trap). A2/A3
-- decisions baked in (see inline comments).
-- ============================================================================

-- 2.1 document_views (folder_scope ON DELETE SET NULL — matches documents.folder_id)
CREATE TABLE public.document_views (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id        uuid,                                   -- forward-compat, NO FK
    name          text NOT NULL,
    filter_expr   jsonb NOT NULL DEFAULT '{}'::jsonb,
    folder_scope  uuid REFERENCES public.folders(id) ON DELETE SET NULL,
    is_global     boolean NOT NULL DEFAULT false,
    created_at    timestamptz NOT NULL DEFAULT now()
);

-- 2.2 document_relationships (both doc FKs CASCADE — matches document_chunks/images/tables)
CREATE TABLE public.document_relationships (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id        uuid,                                   -- forward-compat, NO FK
    source_doc_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    target_doc_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    rel_type      text NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT no_self_rel CHECK (source_doc_id <> target_doc_id),
    CONSTRAINT document_relationships_rel_type_check
      CHECK (rel_type = ANY (ARRAY['supersedes','amends','references','attached_to']::text[]))
);

-- 2.3 classification_rules
CREATE TABLE public.classification_rules (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id            uuid,                               -- forward-compat, NO FK
    name              text NOT NULL,
    match_expr        jsonb NOT NULL,
    -- A3 DECISION: SET NULL (ARCHITECTURE.md said CASCADE). A classification rule
    -- is config, not a child of the folder; it should survive inert/editable when
    -- its suggested folder is deleted, consistent with document_views.folder_scope.
    -- A CASCADE would silently destroy a user's rule on an unrelated folder delete.
    suggest_folder_id uuid REFERENCES public.folders(id) ON DELETE SET NULL,
    is_global         boolean NOT NULL DEFAULT false,
    enabled           boolean NOT NULL DEFAULT true,
    created_at        timestamptz NOT NULL DEFAULT now()
);

-- 2.4 metadata_field_definitions (ONLY table with NULLABLE user_id; NULL = global/admin field)
CREATE TABLE public.metadata_field_definitions (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,   -- NULLABLE per D-110-3: NULL = global/admin field
    org_id      uuid,                                               -- forward-compat, NO FK
    field_key   text NOT NULL,
    field_type  text NOT NULL DEFAULT 'string',
    description text,
    is_global   boolean NOT NULL DEFAULT false,
    enabled     boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now(),
    -- A2 DECISION: prevents an RLS-unreachable orphan. With a nullable owner,
    -- auth.uid()=user_id is NULL (not true) when user_id IS NULL, so a global
    -- field is reached only via OR is_global=true. A (user_id NULL AND
    -- is_global false) row would be reachable by neither RLS clause.
    CONSTRAINT mfd_reachable CHECK (user_id IS NOT NULL OR is_global = true)
);

-- ----------------------------------------------------------------------------
-- Forward-compat org_id COMMENT (grep-consistent with the 4 workflow-table
-- precedents; the v3.0 milestone is noted in the header, not the comment text).
-- ----------------------------------------------------------------------------
COMMENT ON COLUMN public.document_views.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v2.8; no FK until org schema exists; RLS stays user-scoped.';
COMMENT ON COLUMN public.document_relationships.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v2.8; no FK until org schema exists; RLS stays user-scoped.';
COMMENT ON COLUMN public.classification_rules.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v2.8; no FK until org schema exists; RLS stays user-scoped.';
COMMENT ON COLUMN public.metadata_field_definitions.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v2.8; no FK until org schema exists; RLS stays user-scoped.';

-- ----------------------------------------------------------------------------
-- RLS + 4 policies per table — mirror `skills` (user_id + is_global), borrow
-- the workflow_definitions global-INSERT forcing (is_global=false). There is NO
-- DB admin role — globals are service-role/migration-seeded only (service-role
-- key bypasses RLS). Forcing is_global=false in WITH CHECK = "no end-user
-- request can create a global row." (For metadata_field_definitions, a global
-- row reaches users only via OR is_global=true — hence mfd_reachable above.)
-- ----------------------------------------------------------------------------

-- document_views policies
ALTER TABLE public.document_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own and global document_views" ON public.document_views
  FOR SELECT USING (((auth.uid() = user_id) OR (is_global = true)));
CREATE POLICY "Users can insert own document_views" ON public.document_views
  FOR INSERT WITH CHECK (((auth.uid() = user_id) AND (is_global = false)));
CREATE POLICY "Users can update own document_views" ON public.document_views
  FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK (((auth.uid() = user_id) AND (is_global = false)));
CREATE POLICY "Users can delete own document_views" ON public.document_views
  FOR DELETE USING ((auth.uid() = user_id));

-- document_relationships policies
ALTER TABLE public.document_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own and global document_relationships" ON public.document_relationships
  FOR SELECT USING (((auth.uid() = user_id) OR (is_global = true)));
CREATE POLICY "Users can insert own document_relationships" ON public.document_relationships
  FOR INSERT WITH CHECK (((auth.uid() = user_id) AND (is_global = false)));
CREATE POLICY "Users can update own document_relationships" ON public.document_relationships
  FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK (((auth.uid() = user_id) AND (is_global = false)));
CREATE POLICY "Users can delete own document_relationships" ON public.document_relationships
  FOR DELETE USING ((auth.uid() = user_id));

-- classification_rules policies
ALTER TABLE public.classification_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own and global classification_rules" ON public.classification_rules
  FOR SELECT USING (((auth.uid() = user_id) OR (is_global = true)));
CREATE POLICY "Users can insert own classification_rules" ON public.classification_rules
  FOR INSERT WITH CHECK (((auth.uid() = user_id) AND (is_global = false)));
CREATE POLICY "Users can update own classification_rules" ON public.classification_rules
  FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK (((auth.uid() = user_id) AND (is_global = false)));
CREATE POLICY "Users can delete own classification_rules" ON public.classification_rules
  FOR DELETE USING ((auth.uid() = user_id));

-- metadata_field_definitions policies (nullable user_id; global rows via is_global=true)
ALTER TABLE public.metadata_field_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own and global metadata_field_definitions" ON public.metadata_field_definitions
  FOR SELECT USING (((auth.uid() = user_id) OR (is_global = true)));
CREATE POLICY "Users can insert own metadata_field_definitions" ON public.metadata_field_definitions
  FOR INSERT WITH CHECK (((auth.uid() = user_id) AND (is_global = false)));
CREATE POLICY "Users can update own metadata_field_definitions" ON public.metadata_field_definitions
  FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK (((auth.uid() = user_id) AND (is_global = false)));
CREATE POLICY "Users can delete own metadata_field_definitions" ON public.metadata_field_definitions
  FOR DELETE USING ((auth.uid() = user_id));

-- ============================================================================
-- Section 3 — indexes (cheap forward-compat). btree on org_id + user_id for
-- each table; source/target for relationships. NO GIN on filter_expr/match_expr
-- this phase (those query paths ship in 111+/113+).
-- ============================================================================
CREATE INDEX idx_document_views_org_id  ON public.document_views  USING btree (org_id);
CREATE INDEX idx_document_views_user_id ON public.document_views USING btree (user_id);

CREATE INDEX idx_document_relationships_org_id  ON public.document_relationships USING btree (org_id);
CREATE INDEX idx_document_relationships_user_id ON public.document_relationships USING btree (user_id);
CREATE INDEX idx_document_relationships_source  ON public.document_relationships USING btree (source_doc_id);
CREATE INDEX idx_document_relationships_target  ON public.document_relationships USING btree (target_doc_id);

CREATE INDEX idx_classification_rules_org_id  ON public.classification_rules USING btree (org_id);
CREATE INDEX idx_classification_rules_user_id ON public.classification_rules USING btree (user_id);

CREATE INDEX idx_metadata_field_definitions_org_id  ON public.metadata_field_definitions USING btree (org_id);
CREATE INDEX idx_metadata_field_definitions_user_id ON public.metadata_field_definitions USING btree (user_id);

-- ============================================================================
-- Section 4 — capability-flag column (clone of sandbox_enabled / token_capture_enabled)
-- The single id='global' app_settings row backfills automatically
-- (ADD COLUMN ... DEFAULT true) — no separate seed INSERT.
-- ============================================================================
ALTER TABLE public.app_settings ADD COLUMN document_management_enabled boolean DEFAULT true;
COMMENT ON COLUMN public.app_settings.document_management_enabled IS
  'Phase 110 DMF-03. Master gate for net-new DM surfaces+tools (113-119). Default true => v3.0 behavior unchanged. Seam SEED-080 (v3.2) entitlement enforcement plugs into. NOT entangled with Phase 111 enrichment (D-110-2).';

COMMIT;
