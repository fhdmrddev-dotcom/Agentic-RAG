-- ============================================================
-- FULL SCHEMA — Single fresh-install migration
-- Consolidates migrations 001–030 into final state.
-- Safe to run on a blank Supabase project.
-- ============================================================

-- ============================================================
-- Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- Helper functions
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'display_name');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================================
-- profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ============================================================
-- folders  (before threads/documents — they FK to it)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.folders (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  parent_id  uuid REFERENCES public.folders(id) ON DELETE CASCADE,
  is_global  boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS folders_parent_id_idx ON public.folders(parent_id);
CREATE INDEX IF NOT EXISTS folders_user_id_idx ON public.folders(user_id);

ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

-- Recursive helper: a folder is visible if any ancestor has is_global = true
CREATE OR REPLACE FUNCTION public.folder_is_globally_visible(p_folder_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH RECURSIVE ancestors AS (
    SELECT id, parent_id, is_global FROM public.folders WHERE id = p_folder_id
    UNION ALL
    SELECT f.id, f.parent_id, f.is_global
    FROM public.folders f
    INNER JOIN ancestors a ON f.id = a.parent_id
  )
  SELECT COALESCE(bool_or(is_global), false) FROM ancestors;
$$;

DROP POLICY IF EXISTS "Users can view own and global folders" ON public.folders;
CREATE POLICY "Users can view own and global folders"
  ON public.folders FOR SELECT
  USING (auth.uid() = user_id OR public.folder_is_globally_visible(id));

DROP POLICY IF EXISTS "Users can insert own folders" ON public.folders;
CREATE POLICY "Users can insert own folders"
  ON public.folders FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own folders" ON public.folders;
CREATE POLICY "Users can update own folders"
  ON public.folders FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own folders" ON public.folders;
CREATE POLICY "Users can delete own folders"
  ON public.folders FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS folders_set_updated_at ON public.folders;
CREATE TRIGGER folders_set_updated_at
  BEFORE UPDATE ON public.folders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.folders;

-- ============================================================
-- threads
-- ============================================================
CREATE TABLE IF NOT EXISTS public.threads (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      text NOT NULL DEFAULT 'New Chat',
  folder_id  uuid REFERENCES public.folders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS threads_folder_id_idx ON public.threads(folder_id);

ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own threads" ON public.threads;
CREATE POLICY "Users can view their own threads"
  ON public.threads FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own threads" ON public.threads;
CREATE POLICY "Users can insert their own threads"
  ON public.threads FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own threads" ON public.threads;
CREATE POLICY "Users can update their own threads"
  ON public.threads FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own threads" ON public.threads;
CREATE POLICY "Users can delete their own threads"
  ON public.threads FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_threads_updated_at ON public.threads;
CREATE TRIGGER set_threads_updated_at
  BEFORE UPDATE ON public.threads
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ============================================================
-- messages
-- ============================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id                uuid NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  user_id                  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role                     text NOT NULL CHECK (role IN ('user', 'assistant')),
  content                  text NOT NULL,
  tool_calls               jsonb,
  source_refs              jsonb,
  confidence_level         text,
  confidence_avg_similarity float8,
  confidence_disclaimer    text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own messages" ON public.messages;
CREATE POLICY "Users can view their own messages"
  ON public.messages FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own messages" ON public.messages;
CREATE POLICY "Users can insert their own messages"
  ON public.messages FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;
CREATE POLICY "Users can update their own messages"
  ON public.messages FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own messages" ON public.messages;
CREATE POLICY "Users can delete their own messages"
  ON public.messages FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_messages_updated_at ON public.messages;
CREATE TRIGGER set_messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ============================================================
-- documents
-- ============================================================
CREATE TABLE IF NOT EXISTS public.documents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename       text NOT NULL,
  file_path      text NOT NULL,
  file_size      integer NOT NULL,
  mime_type      text NOT NULL,
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN (
                   'pending', 'processing', 'extracting_tables',
                   'extracting_images', 'completed', 'failed'
                 )),
  error_message  text,
  chunk_count    integer,
  content_hash   text,
  metadata       jsonb,
  folder_id      uuid REFERENCES public.folders(id) ON DELETE SET NULL,
  version_number integer NOT NULL DEFAULT 1,
  is_latest      boolean NOT NULL DEFAULT true,
  full_markdown  text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS documents_user_hash_idx      ON public.documents(user_id, content_hash);
CREATE INDEX IF NOT EXISTS documents_user_filename_idx  ON public.documents(user_id, filename);
CREATE INDEX IF NOT EXISTS documents_folder_id_idx      ON public.documents(folder_id);
CREATE INDEX IF NOT EXISTS documents_metadata_gin_idx   ON public.documents USING gin(metadata);
CREATE INDEX IF NOT EXISTS documents_latest_idx         ON public.documents(user_id, filename, is_latest) WHERE is_latest = true;
CREATE UNIQUE INDEX IF NOT EXISTS documents_completed_hash_unique_idx
  ON public.documents(user_id, content_hash)
  WHERE content_hash IS NOT NULL AND status = 'completed';

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents REPLICA IDENTITY FULL;

DROP POLICY IF EXISTS "Users can view own or global-folder documents" ON public.documents;
CREATE POLICY "Users can view own or global-folder documents"
  ON public.documents FOR SELECT
  USING (
    auth.uid() = user_id
    OR (folder_id IS NOT NULL AND public.folder_is_globally_visible(folder_id))
  );

DROP POLICY IF EXISTS "Users can insert their own documents" ON public.documents;
CREATE POLICY "Users can insert their own documents"
  ON public.documents FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own documents" ON public.documents;
CREATE POLICY "Users can update their own documents"
  ON public.documents FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own documents" ON public.documents;
CREATE POLICY "Users can delete their own documents"
  ON public.documents FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_documents_updated_at ON public.documents;
CREATE TRIGGER set_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;

-- ============================================================
-- document_chunks
-- ============================================================
CREATE TABLE IF NOT EXISTS public.document_chunks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content       text NOT NULL,
  chunk_index   integer NOT NULL,
  embedding     vector(1536),
  search_vector tsvector,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx ON public.document_chunks
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS document_chunks_search_vector_idx
  ON public.document_chunks USING gin(search_vector);

ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own chunks" ON public.document_chunks;
CREATE POLICY "Users can view their own chunks"
  ON public.document_chunks FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own chunks" ON public.document_chunks;
CREATE POLICY "Users can insert their own chunks"
  ON public.document_chunks FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own chunks" ON public.document_chunks;
CREATE POLICY "Users can update their own chunks"
  ON public.document_chunks FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own chunks" ON public.document_chunks;
CREATE POLICY "Users can delete their own chunks"
  ON public.document_chunks FOR DELETE USING (auth.uid() = user_id);

-- Auto-populate search_vector
CREATE OR REPLACE FUNCTION public.update_search_vector()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.content, ''));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_search_vector ON public.document_chunks;
CREATE TRIGGER trg_update_search_vector
  BEFORE INSERT OR UPDATE OF content ON public.document_chunks
  FOR EACH ROW EXECUTE FUNCTION public.update_search_vector();

-- ============================================================
-- document_tables  (multimodal ingestion)
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

CREATE INDEX IF NOT EXISTS document_tables_document_idx ON public.document_tables(document_id);

ALTER TABLE public.document_tables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own document tables" ON public.document_tables;
CREATE POLICY "Users can manage own document tables"
  ON public.document_tables FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================
-- document_images  (multimodal ingestion)
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

CREATE INDEX IF NOT EXISTS document_images_document_idx ON public.document_images(document_id);

ALTER TABLE public.document_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own document images" ON public.document_images;
CREATE POLICY "Users can manage own document images"
  ON public.document_images FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================
-- user_settings  (user-specific UI preferences)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id     uuid PRIMARY KEY,
  preferences jsonb DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at  timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
CREATE POLICY "Users can view own settings"
  ON public.user_settings FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
CREATE POLICY "Users can insert own settings"
  ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
CREATE POLICY "Users can update own settings"
  ON public.user_settings FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- app_settings  (global admin config)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
  id                        text PRIMARY KEY DEFAULT 'global',
  llm_providers             jsonb DEFAULT '[]'::jsonb,
  embedding_model           text,
  embedding_base_url        text,
  embedding_api_key         text,
  embedding_dimensions      integer,
  rerank_enabled            boolean,
  rerank_provider           text,
  rerank_api_key            text,
  rerank_model              text,
  rerank_top_n              integer,
  retrieval_top_k           integer,
  retrieval_match_threshold float,
  hybrid_search_enabled     boolean,
  hybrid_candidate_count    integer,
  vector_search_weight      float,
  keyword_search_weight     float,
  rrf_k                     integer,
  updated_at                timestamptz DEFAULT now()
);

INSERT INTO public.app_settings (id) VALUES ('global') ON CONFLICT DO NOTHING;

-- ============================================================
-- skills
-- ============================================================
CREATE TABLE IF NOT EXISTS public.skills (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         text NOT NULL,
  description  text NOT NULL DEFAULT '',
  instructions text NOT NULL DEFAULT '',
  is_enabled   boolean NOT NULL DEFAULT true,
  is_global    boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS skills_user_id_idx ON public.skills(user_id);

ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own and global skills" ON public.skills;
CREATE POLICY "Users can view own and global skills"
  ON public.skills FOR SELECT
  USING (auth.uid() = user_id OR is_global = true);

DROP POLICY IF EXISTS "Users can insert own skills" ON public.skills;
CREATE POLICY "Users can insert own skills"
  ON public.skills FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own skills" ON public.skills;
CREATE POLICY "Users can update own skills"
  ON public.skills FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own skills" ON public.skills;
CREATE POLICY "Users can delete own skills"
  ON public.skills FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS skills_set_updated_at ON public.skills;
CREATE TRIGGER skills_set_updated_at
  BEFORE UPDATE ON public.skills
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- skill_files
-- ============================================================
CREATE TABLE IF NOT EXISTS public.skill_files (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id   uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename   text NOT NULL,
  file_path  text NOT NULL,
  file_size  bigint NOT NULL DEFAULT 0,
  mime_type  text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS skill_files_skill_id_idx ON public.skill_files(skill_id);
CREATE INDEX IF NOT EXISTS skill_files_user_id_idx ON public.skill_files(user_id);

ALTER TABLE public.skill_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view files on own or global skills" ON public.skill_files;
CREATE POLICY "Users can view files on own or global skills"
  ON public.skill_files FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.skills
      WHERE skills.id = skill_files.skill_id AND skills.is_global = true
    )
  );

DROP POLICY IF EXISTS "Users can insert own skill files" ON public.skill_files;
CREATE POLICY "Users can insert own skill files"
  ON public.skill_files FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own skill files" ON public.skill_files;
CREATE POLICY "Users can delete own skill files"
  ON public.skill_files FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- user_memory
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_memory (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key        text NOT NULL,
  value      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_memory_user_key_unique UNIQUE (user_id, key)
);

CREATE INDEX IF NOT EXISTS user_memory_user_updated_idx
  ON public.user_memory(user_id, updated_at DESC);

ALTER TABLE public.user_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select own memory" ON public.user_memory;
CREATE POLICY "Users can select own memory"
  ON public.user_memory FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own memory" ON public.user_memory;
CREATE POLICY "Users can insert own memory"
  ON public.user_memory FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own memory" ON public.user_memory;
CREATE POLICY "Users can update own memory"
  ON public.user_memory FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own memory" ON public.user_memory;
CREATE POLICY "Users can delete own memory"
  ON public.user_memory FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS user_memory_updated_at ON public.user_memory;
CREATE TRIGGER user_memory_updated_at
  BEFORE UPDATE ON public.user_memory
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ============================================================
-- message_feedback
-- ============================================================
CREATE TABLE IF NOT EXISTS public.message_feedback (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  rating     varchar(16) NOT NULL CHECK (rating IN ('positive', 'negative')),
  reason     varchar(32) CHECK (reason IN ('wrong_answer', 'not_from_documents', 'incomplete', 'other')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT message_feedback_message_user_unique UNIQUE (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS message_feedback_user_created_idx
  ON public.message_feedback(user_id, created_at DESC);

ALTER TABLE public.message_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select own feedback" ON public.message_feedback;
CREATE POLICY "Users can select own feedback"
  ON public.message_feedback FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own feedback" ON public.message_feedback;
CREATE POLICY "Users can insert own feedback"
  ON public.message_feedback FOR INSERT WITH CHECK (auth.uid() = user_id);

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
  ON public.audit_log(user_id, created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own audit entries" ON public.audit_log;
CREATE POLICY "Users can insert own audit entries"
  ON public.audit_log FOR INSERT WITH CHECK (user_id = auth.uid());

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
-- RPCs
-- ============================================================

-- Vector similarity search (final version: returns chunk_index, filters is_latest)
CREATE OR REPLACE FUNCTION public.match_document_chunks(
  query_embedding vector,
  match_user_id   uuid,
  match_count     integer DEFAULT 5,
  match_threshold float   DEFAULT 0.3,
  metadata_filter jsonb   DEFAULT NULL,
  p_folder_ids    uuid[]  DEFAULT NULL
)
RETURNS TABLE (id uuid, document_id uuid, content text, chunk_index integer, similarity float)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT dc.id, dc.document_id, dc.content, dc.chunk_index,
         1 - (dc.embedding <=> query_embedding) AS similarity
  FROM public.document_chunks dc
  JOIN public.documents d ON d.id = dc.document_id
  WHERE dc.user_id = match_user_id
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
    AND d.is_latest = true
    AND (metadata_filter IS NULL OR d.metadata @> metadata_filter)
    AND (p_folder_ids IS NULL OR d.folder_id = ANY(p_folder_ids))
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Keyword search (final version: returns chunk_index, filters is_latest)
CREATE OR REPLACE FUNCTION public.keyword_search_chunks(
  search_query    text,
  match_user_id   uuid,
  match_count     integer DEFAULT 20,
  metadata_filter jsonb   DEFAULT NULL,
  p_folder_ids    uuid[]  DEFAULT NULL
)
RETURNS TABLE (id uuid, document_id uuid, content text, chunk_index integer, rank float)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  tsq tsquery;
BEGIN
  tsq := plainto_tsquery('english', search_query);
  RETURN QUERY
  SELECT dc.id, dc.document_id, dc.content, dc.chunk_index,
         ts_rank_cd(dc.search_vector, tsq)::float AS rank
  FROM public.document_chunks dc
  JOIN public.documents d ON d.id = dc.document_id
  WHERE dc.user_id = match_user_id
    AND dc.search_vector @@ tsq
    AND d.is_latest = true
    AND (metadata_filter IS NULL OR d.metadata @> metadata_filter)
    AND (p_folder_ids IS NULL OR d.folder_id = ANY(p_folder_ids))
  ORDER BY rank DESC
  LIMIT match_count;
END;
$$;

-- Text-to-SQL RPC (SELECT only, SECURITY INVOKER so RLS applies)
CREATE OR REPLACE FUNCTION public.query_user_documents(sql_query text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  result      jsonb;
  clean_query text;
BEGIN
  clean_query := trim(sql_query);
  IF lower(clean_query) NOT LIKE 'select%' THEN
    RAISE EXCEPTION 'Only SELECT queries are permitted';
  END IF;
  IF position(';' IN clean_query) > 0 THEN
    RAISE EXCEPTION 'Query must be a single statement (no semicolons)';
  END IF;
  EXECUTE format('SELECT jsonb_agg(t) FROM (%s) t', clean_query) INTO result;
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.query_user_documents(text) TO authenticated;

-- Utility: resize embedding column (manual-use only)
CREATE OR REPLACE FUNCTION public.resize_embedding_column(new_dim integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DROP INDEX IF EXISTS public.document_chunks_embedding_idx;
  EXECUTE format(
    'ALTER TABLE public.document_chunks ALTER COLUMN embedding TYPE vector(%s) USING NULL',
    new_dim
  );
  EXECUTE format(
    'CREATE INDEX document_chunks_embedding_idx ON public.document_chunks
     USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)'
  );
END;
$$;

-- ============================================================
-- Storage buckets + RLS
-- ============================================================

-- documents bucket (path: {user_id}/{document_id}/{filename})
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can read own documents" ON storage.objects;
CREATE POLICY "Users can read own documents" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text));

DROP POLICY IF EXISTS "Users can upload to own documents folder" ON storage.objects;
CREATE POLICY "Users can upload to own documents folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text));

DROP POLICY IF EXISTS "Users can delete own documents" ON storage.objects;
CREATE POLICY "Users can delete own documents" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text));

-- skill-files bucket (path: {user_id}/...)
INSERT INTO storage.buckets (id, name, public)
VALUES ('skill-files', 'skill-files', false) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can read own skill files" ON storage.objects;
CREATE POLICY "Users can read own skill files" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'skill-files'
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid()::text)
      OR EXISTS (
        SELECT 1 FROM public.skill_files sf
        JOIN public.skills s ON s.id = sf.skill_id
        WHERE sf.file_path = name AND s.is_global = true
      )
    )
  );

DROP POLICY IF EXISTS "Users can upload to own skill files folder" ON storage.objects;
CREATE POLICY "Users can upload to own skill files folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'skill-files' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text));

DROP POLICY IF EXISTS "Users can delete own skill files" ON storage.objects;
CREATE POLICY "Users can delete own skill files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'skill-files' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text));

-- sandbox-outputs bucket (path: {user_id}/{execution_id}/{filename})
INSERT INTO storage.buckets (id, name, public)
VALUES ('sandbox-outputs', 'sandbox-outputs', false) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can read own sandbox outputs" ON storage.objects;
CREATE POLICY "Users can read own sandbox outputs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'sandbox-outputs' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text));

DROP POLICY IF EXISTS "Users can upload to own sandbox outputs folder" ON storage.objects;
CREATE POLICY "Users can upload to own sandbox outputs folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'sandbox-outputs' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text));

DROP POLICY IF EXISTS "Users can delete own sandbox outputs" ON storage.objects;
CREATE POLICY "Users can delete own sandbox outputs" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'sandbox-outputs' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text));

-- ============================================================
-- Seed data
-- ============================================================

-- System user (satisfies FK for global skills)
INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'seed@system.local', '', now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{}',
  'authenticated', 'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- skill-creator global skill
INSERT INTO public.skills (id, user_id, name, description, instructions, is_enabled, is_global)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  'skill-creator',
  'Guides users through creating new AI skills via conversation. Asks clarifying questions, then calls save_skill to persist the result.',
  'You are a skill-creation assistant. When the user asks you to create a skill, follow these steps:

1. Ask the user: What task should this skill perform?
2. Ask the user: What context or constraints apply? (e.g., tone, format, domain)
3. Ask the user: What should the output look like?

Once you have clear answers to all three questions, call save_skill with:
- name: A concise, lowercase-hyphenated name (e.g., "sql-writer", "code-reviewer")
- description: A single sentence describing what the skill does
- instructions: Step-by-step instructions based on the user''s answers, written as directives the agent should follow when the skill is loaded

After saving, confirm to the user that the skill has been created and is now available in their Skills tab. Let them know they can edit it further from the Skills page or try it immediately by saying "Use the <skill-name> skill" in chat.',
  true, true
) ON CONFLICT (id) DO NOTHING;
