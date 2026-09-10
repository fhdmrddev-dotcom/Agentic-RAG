-- 153_ingestion_jobs.sql
-- Phase 230: The Durable Ingestion Queue (QUEUE-01 / QUEUE-05 / SC#1 / D-01..D-04)
--
-- Introduces public.ingestion_jobs to make document ingestion survive worker restarts,
-- bursts of hundreds of files under a concurrency cap, and embedding provider outages.
--
-- Claim pattern: FOR UPDATE SKIP LOCKED inside an explicit transaction (matches schedules.py:307).
-- Stale recovery: Sweeps jobs in 'processing' whose claimed_at is older than lease timeout.
--
-- Apply discipline (CLAUDE.md):
-- Apply via psycopg2-direct to local :54322 or SQL editor. NEVER `supabase db push` / `db reset`.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ingestion_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'paused', 'retry_queued')),
    stage text NOT NULL DEFAULT 'pending' CHECK (stage IN ('pending', 'extracting', 'tables_embedded', 'chunks_embedded', 'completed', 'failed')),
    progress jsonb NOT NULL DEFAULT '{}'::jsonb,
    retry_count integer NOT NULL DEFAULT 0,
    max_retries integer NOT NULL DEFAULT 3,
    last_error text,
    error_details jsonb,
    next_run_at timestamptz NOT NULL DEFAULT now(),
    claimed_at timestamptz,
    claimed_by text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ingestion_jobs IS
  'Phase 230: Durable queue table for asynchronous, restart-resilient document ingestion (QUEUE-01).';

COMMENT ON COLUMN public.ingestion_jobs.progress IS
  'Checkpoint JSONB containing chunk_offset, total_chunks, and stage metadata for granular resumption (SC#4).';

COMMENT ON COLUMN public.ingestion_jobs.claimed_at IS
  'Timestamp when worker claimed row via FOR UPDATE SKIP LOCKED. Read by reclaim_stale_ingestion_claims to rescue stranded jobs (G-1 / SC#1).';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_claim
    ON public.ingestion_jobs USING btree (status, next_run_at)
    WHERE status IN ('pending', 'retry_queued');

CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_stale
    ON public.ingestion_jobs USING btree (status, claimed_at)
    WHERE status = 'processing';

CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_document_id
    ON public.ingestion_jobs USING btree (document_id);

CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_user_id
    ON public.ingestion_jobs USING btree (user_id);

-- Row Level Security
ALTER TABLE public.ingestion_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own ingestion jobs" ON public.ingestion_jobs;
CREATE POLICY "Users can view own ingestion jobs" ON public.ingestion_jobs
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);
