-- 195 — Phase 266 (PACK-18/19/20, D-266-06/08/18, SEED-304)
-- Table: public.expert_installs — the per-org home of a first-party Expert's installed knowledge
-- Index: public.documents_completed_hash_unique_idx — widened to (org_id, user_id, content_hash)
-- Data:  migration 188's orphaned seed knowledge — retired deliberately
--
-- WHY. Migration 188 seeded the Financial Analyzer's corpus (folder …0260, document …0261,
-- chunks …0262/…0263) into ONE seed org, owned by the seed user …0001, with the document at
-- status 'failed' and ZERO embeddings. resolve_expert_bundle's `is_system_folder` bypass then
-- APPROVED that folder for every caller in every org — while retrieval could never read it,
-- because match_document_chunks gates on current_user_org_ids(). The Expert's scope was a
-- promise retrieval broke (SEED-304). Phase 266 replaces the global folder with a per-org
-- INSTALLED copy recorded here, and deletes the bypass (D-266-10).
--
-- The 188 rows are retired DELIBERATELY, under the SEED-177 / D-206-07 rule ("retire it
-- deliberately, never trip it by surprise"), by fixed id only. Nothing else is touched.
-- Skill …0264 (financial_ratio_calculator) is KEPT: it is is_system = true, which makes it
-- visible platform-wide through backend/app/utils/skill_visibility.py, so it never had the
-- cross-org defect the knowledge rows had. The Expert's member_skills binding is unchanged.
--
-- Apply discipline (CLAUDE.md): paste into the Supabase SQL editor.
-- NEVER `supabase db push` / `db reset`. Idempotent: safe to paste twice.
-- ============================================================================

BEGIN;

-- ── 1. public.expert_installs (D-266-08) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.expert_installs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    expert_bundle_id uuid NOT NULL REFERENCES public.expert_bundles(id) ON DELETE CASCADE,
    folder_id uuid REFERENCES public.folders(id) ON DELETE SET NULL,
    status text NOT NULL DEFAULT 'installing' CHECK (status IN ('installing', 'installed', 'failed')),
    error text,
    -- deliberately no FK: an installer's account deletion must not erase the fact of the install
    installed_by uuid,
    corpus_version text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_expert_install UNIQUE (org_id, expert_bundle_id)
);

COMMENT ON TABLE public.expert_installs IS
    'Per-org install of a first-party (is_system) Expert''s knowledge (PACK-18, Phase 266). One row per (org, expert). resolve_expert_bundle reads the caller org''s row for an is_system bundle; no row means no folders (D-266-09). Written only by the backend pool.';
COMMENT ON COLUMN public.expert_installs.id IS
    'Surrogate key.';
COMMENT ON COLUMN public.expert_installs.org_id IS
    'The org this install belongs to. The tenancy boundary: every backend query binds it from the validated active org.';
COMMENT ON COLUMN public.expert_installs.expert_bundle_id IS
    'The first-party Expert bundle installed.';
COMMENT ON COLUMN public.expert_installs.folder_id IS
    'The org''s installed knowledge folder. ON DELETE SET NULL: a deleted folder is recreated and re-pointed on the next install, never left dangling.';
COMMENT ON COLUMN public.expert_installs.status IS
    'What the installer knows about the COPY step: installing | installed | failed. Readiness of the corpus documents is derived at read time from documents.status, never stored twice.';
COMMENT ON COLUMN public.expert_installs.error IS
    'Why the copy step failed, when status = failed. NULL otherwise.';
COMMENT ON COLUMN public.expert_installs.installed_by IS
    'The user who last installed or repaired. No FK by design.';
COMMENT ON COLUMN public.expert_installs.corpus_version IS
    'sha256 over the LF-normalised corpus the install copied, so a newer shipped corpus is detectable.';
COMMENT ON COLUMN public.expert_installs.created_at IS
    'First install time.';
COMMENT ON COLUMN public.expert_installs.updated_at IS
    'Last claim/status change. A claim older than 10 minutes in status installing is treated as stale and may be re-claimed.';

CREATE INDEX IF NOT EXISTS idx_expert_installs_folder
    ON public.expert_installs (folder_id);

-- ── 2. RLS + privileges: members READ their org's installs; only the backend writes ──
ALTER TABLE public.expert_installs ENABLE ROW LEVEL SECURITY;

-- Default privileges gave anon/authenticated ALL on a new public table; take them back
-- (PUBLIC first — the CLAUDE.md trap), then grant only what is needed.
REVOKE ALL ON TABLE public.expert_installs FROM PUBLIC;
REVOKE ALL ON TABLE public.expert_installs FROM anon;
REVOKE ALL ON TABLE public.expert_installs FROM authenticated;
GRANT SELECT ON TABLE public.expert_installs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.expert_installs TO service_role;

DROP POLICY IF EXISTS "expert_installs_member_read" ON public.expert_installs;
CREATE POLICY "expert_installs_member_read" ON public.expert_installs
    FOR SELECT TO authenticated
    USING (org_id IN (SELECT public.current_user_org_ids()));

-- There is NO authenticated write policy, and no client write grant, on purpose: installs are
-- written only by the backend pool, behind require_capability('experts') + require_expert_manage.

-- ── 3. Org-scope the completed-hash uniqueness (D-266-18) ───────────────────
-- Before: (user_id, content_hash). A person who administers two orgs could not hold the same
-- completed document in both — the second org's copy would 23505 at completion. The new key
-- is STRICTLY LOOSER than the old one, so no existing row can violate it.
-- CONCURRENTLY is deliberately NOT used: it cannot run inside the transaction this file (and
-- the SQL editor paste) uses, and public.documents is small enough for a brief build lock.
DROP INDEX IF EXISTS public.documents_completed_hash_unique_idx;
CREATE UNIQUE INDEX documents_completed_hash_unique_idx
    ON public.documents USING btree (org_id, user_id, content_hash)
    WHERE ((content_hash IS NOT NULL) AND (status = 'completed'::text));

-- ── 4. Retire migration 188's orphaned knowledge rows (D-266-06) ────────────
-- By fixed id only; each statement is a no-op on a database where 188 never landed.
-- Every FK referencing documents / folders carries an ON DELETE action (measured in
-- full-schema.sql: CASCADE for chunks/images/tables/relationships/ingestion_jobs, SET NULL for
-- folder references), so no dependent row can block these deletes. Chunks are deleted
-- explicitly anyway so the intent is visible.
DELETE FROM public.document_chunks WHERE document_id = '00000000-0000-0000-0000-000000000261'::uuid;
DELETE FROM public.documents WHERE id = '00000000-0000-0000-0000-000000000261'::uuid;
DELETE FROM public.folders WHERE id = '00000000-0000-0000-0000-000000000260'::uuid AND user_id = '00000000-0000-0000-0000-000000000001'::uuid;
UPDATE public.expert_bundles
    SET knowledge_folder_ids = array_remove(knowledge_folder_ids, '00000000-0000-0000-0000-000000000260'::uuid),
        updated_at = now()
    WHERE slug = 'financial-analyzer' AND is_system = true;

COMMIT;
