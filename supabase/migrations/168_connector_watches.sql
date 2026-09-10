-- 168_connector_watches.sql
-- Phase 234: The Watch Loop — The Library Reads By Itself (LIB-08 / QUEUE-03 / D-234-01..10)
--
-- Maps an external connection source folder (e.g. Google Drive) to an internal Library folder.
-- Polled by the background watch loop on a scheduled cadence (interval_minutes).
--
-- Concurrency guard (QUEUE-03):
--   Atomic claim query uses FOR UPDATE SKIP LOCKED with leased_until to prevent concurrent ticks
--   from overlapping on the same watch.
--
-- Apply discipline (CLAUDE.md): paste into the Supabase SQL editor.
-- NEVER `supabase db push` / `db reset`.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.connector_watches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    connection_id uuid NOT NULL REFERENCES public.connector_connections(id) ON DELETE CASCADE,

    source_folder_id text NOT NULL,
    source_folder_name text NOT NULL,
    source_drive_id text,
    library_folder_id uuid REFERENCES public.folders(id) ON DELETE SET NULL,

    interval_minutes integer NOT NULL DEFAULT 30,
    next_run_at timestamptz NOT NULL DEFAULT now(),
    leased_until timestamptz,

    is_active boolean NOT NULL DEFAULT true,

    last_run_at timestamptz,
    last_status text,
    last_error text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT connector_watches_interval_floor CHECK (interval_minutes >= 5)
);

COMMENT ON TABLE public.connector_watches IS
  'Phase 234 (LIB-08): Scheduled folder watches mapping external cloud folders to Library folders.';

COMMENT ON COLUMN public.connector_watches.source_folder_id IS
  'External source folder identifier (e.g. Google Drive folder ID, or "root").';

COMMENT ON COLUMN public.connector_watches.source_drive_id IS
  'External shared drive identifier when folder lives in a Shared Drive, or NULL for My Drive.';

COMMENT ON COLUMN public.connector_watches.library_folder_id IS
  'Destination folder in public.folders. NULL means Library root.';

COMMENT ON COLUMN public.connector_watches.interval_minutes IS
  'Polling cadence in minutes (presets: 15, 30, 60, 360, 1440; floor: 5m).';

COMMENT ON COLUMN public.connector_watches.next_run_at IS
  'Timestamp when this watch is next due for polling. Indexed for rapid SKIP LOCKED claim.';

COMMENT ON COLUMN public.connector_watches.leased_until IS
  'Concurrency lease expiration (QUEUE-03). Non-null while a sync worker is processing this watch.';

COMMENT ON COLUMN public.connector_watches.last_status IS
  'Status of the latest sync run: success, failed, running, skipped_still_running, or partial.';

-- ── Indexes ──────────────────────────────────────────────────────────────────
-- Poller read index: partial on is_active to make due claims fast and cheap.
CREATE INDEX IF NOT EXISTS idx_connector_watches_due
  ON public.connector_watches USING btree (next_run_at)
  WHERE is_active;

-- Tenant & owner lookup
CREATE INDEX IF NOT EXISTS idx_connector_watches_org_user
  ON public.connector_watches USING btree (org_id, user_id);

-- Connection lookup (for cascading deactivation / disconnect freeze VIS-05)
CREATE INDEX IF NOT EXISTS idx_connector_watches_connection_id
  ON public.connector_watches USING btree (connection_id);

-- ── RLS (Shape A: Tenant membership AND owner) ──────────────────────────────
ALTER TABLE public.connector_watches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS connector_watches_select ON public.connector_watches;
CREATE POLICY connector_watches_select ON public.connector_watches
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS connector_watches_insert ON public.connector_watches;
CREATE POLICY connector_watches_insert ON public.connector_watches
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS connector_watches_update ON public.connector_watches;
CREATE POLICY connector_watches_update ON public.connector_watches
  FOR UPDATE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id))
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS connector_watches_delete ON public.connector_watches;
CREATE POLICY connector_watches_delete ON public.connector_watches
  FOR DELETE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

-- ── Triggers ─────────────────────────────────────────────────────────────────
-- Autofill org_id from user_id if omitted
DROP TRIGGER IF EXISTS connector_watches_autofill_org_id ON public.connector_watches;
CREATE TRIGGER connector_watches_autofill_org_id BEFORE INSERT ON public.connector_watches
  FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');

-- Touch updated_at on row mutation
DROP TRIGGER IF EXISTS connector_watches_set_updated_at ON public.connector_watches;
CREATE TRIGGER connector_watches_set_updated_at BEFORE UPDATE ON public.connector_watches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Grants ───────────────────────────────────────────────────────────────────
REVOKE ALL ON TABLE public.connector_watches FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.connector_watches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.connector_watches TO service_role;

COMMIT;
