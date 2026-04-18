-- Migration 030: Create missing tables never ported from backend/supabase/migrations/
-- Tables: audit_log, code_executions, sandbox_files, document_tables, document_images

-- ============================================================
-- audit_log
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  metadata    jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_log_action_type_check CHECK (
    action_type IN (
      'document.upload', 'document.delete', 'search.query',
      'code.execute', 'skill.load', 'thread.create',
      'thread.delete', 'settings.update',
      'memory.remember', 'memory.recall',
      'feedback.submit'
    )
  )
);

CREATE INDEX IF NOT EXISTS audit_log_user_created_idx
  ON public.audit_log (user_id, created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own audit entries" ON public.audit_log;
CREATE POLICY "Users can insert own audit entries"
  ON public.audit_log FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- code_executions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.code_executions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id   uuid NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code        text NOT NULL,
  exit_code   integer,
  duration_ms integer,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.code_executions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own executions" ON public.code_executions;
CREATE POLICY "Users can view own executions"
  ON public.code_executions FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own executions" ON public.code_executions;
CREATE POLICY "Users can insert own executions"
  ON public.code_executions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- sandbox_files
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sandbox_files (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id uuid NOT NULL REFERENCES public.code_executions(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename     text NOT NULL,
  storage_path text NOT NULL,
  file_size    bigint NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sandbox_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own sandbox files" ON public.sandbox_files;
CREATE POLICY "Users can view own sandbox files"
  ON public.sandbox_files FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own sandbox files" ON public.sandbox_files;
CREATE POLICY "Users can insert own sandbox files"
  ON public.sandbox_files FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- document_tables
-- ============================================================
CREATE TABLE IF NOT EXISTS public.document_tables (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page        integer,
  table_index integer NOT NULL,
  headers     jsonb NOT NULL DEFAULT '[]',
  rows        jsonb NOT NULL DEFAULT '[]',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS document_tables_document_idx
  ON public.document_tables (document_id);

ALTER TABLE public.document_tables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own document tables" ON public.document_tables;
CREATE POLICY "Users can manage own document tables"
  ON public.document_tables FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- document_images
-- ============================================================
CREATE TABLE IF NOT EXISTS public.document_images (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page        integer,
  image_index integer NOT NULL,
  description text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS document_images_document_idx
  ON public.document_images (document_id);

ALTER TABLE public.document_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own document images" ON public.document_images;
CREATE POLICY "Users can manage own document images"
  ON public.document_images FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
