-- 169_connector_watch_items.sql
-- Phase 234: The Watch Loop — The Library Reads By Itself (SRC-06 / VIS-03 / VIS-04 / ARCHITECTURE.md §5)
--
-- Persistent mirror table tracking items discovered in watched external folders.
-- Records presence, hashes, versions, document linkage, and lifecycle states:
--   present       -> item currently live at source and synced to Library
--   missing       -> deleted or moved out at source; retained in Library (VIS-03)
--   unauthorized  -> access denied / revoked at source (VIS-04)
--   skipped_type  -> unsupported MIME type or folder
--   skipped_size  -> file exceeds maximum ingestion size limit
--   failed        -> ingestion or extraction attempt failed
--
-- Apply discipline (CLAUDE.md): paste into the Supabase SQL editor.
-- NEVER `supabase db push` / `db reset`.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.connector_watch_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    watch_id uuid NOT NULL REFERENCES public.connector_watches(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    external_id text NOT NULL,
    name text NOT NULL,
    path_hint text NOT NULL DEFAULT '',

    source_version text,
    source_modified_at timestamptz,
    content_hash text,

    document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,

    state text NOT NULL DEFAULT 'present',

    first_seen_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    missing_since timestamptz,

    last_error text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT uq_watch_item_watch_external UNIQUE (watch_id, external_id),
    CONSTRAINT connector_watch_items_state_check CHECK (
        state IN ('present', 'missing', 'unauthorized', 'skipped_type', 'skipped_size', 'failed')
    )
);

COMMENT ON TABLE public.connector_watch_items IS
  'Phase 234: Mirror table for external source items tracked by a connector_watch (ARCHITECTURE.md §5).';

COMMENT ON COLUMN public.connector_watch_items.external_id IS
  'Source system unique file identifier (e.g. Google Drive file ID).';

COMMENT ON COLUMN public.connector_watch_items.document_id IS
  'Associated Library document in public.documents. Set NULL when document is purged.';

COMMENT ON COLUMN public.connector_watch_items.state IS
  'Lifecycle state: present | missing | unauthorized | skipped_type | skipped_size | failed.';

COMMENT ON COLUMN public.connector_watch_items.missing_since IS
  'Timestamp when this item was first detected missing from a complete source listing (H-5).';

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_connector_watch_items_watch_id
  ON public.connector_watch_items USING btree (watch_id);

CREATE INDEX IF NOT EXISTS idx_connector_watch_items_document_id
  ON public.connector_watch_items USING btree (document_id)
  WHERE document_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_connector_watch_items_org_user
  ON public.connector_watch_items USING btree (org_id, user_id);

CREATE INDEX IF NOT EXISTS idx_connector_watch_items_state
  ON public.connector_watch_items USING btree (state);

-- ── RLS (Shape A: Tenant membership AND owner) ──────────────────────────────
ALTER TABLE public.connector_watch_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS connector_watch_items_select ON public.connector_watch_items;
CREATE POLICY connector_watch_items_select ON public.connector_watch_items
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS connector_watch_items_insert ON public.connector_watch_items;
CREATE POLICY connector_watch_items_insert ON public.connector_watch_items
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS connector_watch_items_update ON public.connector_watch_items;
CREATE POLICY connector_watch_items_update ON public.connector_watch_items
  FOR UPDATE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id))
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS connector_watch_items_delete ON public.connector_watch_items;
CREATE POLICY connector_watch_items_delete ON public.connector_watch_items
  FOR DELETE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

-- ── Triggers ─────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS connector_watch_items_autofill_org_id ON public.connector_watch_items;
CREATE TRIGGER connector_watch_items_autofill_org_id BEFORE INSERT ON public.connector_watch_items
  FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');

DROP TRIGGER IF EXISTS connector_watch_items_set_updated_at ON public.connector_watch_items;
CREATE TRIGGER connector_watch_items_set_updated_at BEFORE UPDATE ON public.connector_watch_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Grants ───────────────────────────────────────────────────────────────────
REVOKE ALL ON TABLE public.connector_watch_items FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.connector_watch_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.connector_watch_items TO service_role;

COMMIT;
