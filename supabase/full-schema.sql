-- ============================================================
-- FULL SCHEMA — Generated bootstrap artifact
-- Single-file consolidation of all numbered migrations.
-- Use case: greenfield deploy (Hostinger fresh DB, brand-new
-- Supabase cloud project) where you want to apply the entire
-- schema in one shot instead of 30+ ordered migrations.
--
-- Source of truth: supabase/migrations/*.sql (numbered).
-- This file is GENERATED — do NOT edit by hand.
--
-- To regenerate after adding a migration:
--   bash scripts/regenerate-full-schema.sh
-- ============================================================

--
-- PostgreSQL database dump
--

\restrict qPLUHuo1GcgCXeKcC2LORugO4UMxe1VOPVRjdFL2o7ylfnviUGPwhXvhbDzSOrT

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: folder_is_globally_visible(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.folder_is_globally_visible(p_folder_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  WITH RECURSIVE ancestors AS (
    SELECT id, parent_id, is_global
    FROM public.folders
    WHERE id = p_folder_id

    UNION ALL

    SELECT f.id, f.parent_id, f.is_global
    FROM public.folders f
    INNER JOIN ancestors a ON f.id = a.parent_id
  )
  SELECT COALESCE(bool_or(is_global), false) FROM ancestors;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name');
  return new;
end;
$$;


--
-- Name: keyword_search_chunks(text, uuid, integer, jsonb, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.keyword_search_chunks(search_query text, match_user_id uuid, match_count integer DEFAULT 20, metadata_filter jsonb DEFAULT NULL::jsonb, p_folder_ids uuid[] DEFAULT NULL::uuid[]) RETURNS TABLE(id uuid, document_id uuid, content text, chunk_index integer, rank double precision)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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


--
-- Name: match_document_chunks(public.vector, uuid, integer, double precision, jsonb, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.match_document_chunks(query_embedding public.vector, match_user_id uuid, match_count integer DEFAULT 5, match_threshold double precision DEFAULT 0.3, metadata_filter jsonb DEFAULT NULL::jsonb, p_folder_ids uuid[] DEFAULT NULL::uuid[]) RETURNS TABLE(id uuid, document_id uuid, content text, chunk_index integer, similarity double precision)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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


--
-- Name: query_user_documents(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.query_user_documents(sql_query text) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
  result jsonb;
  clean_query text;
BEGIN
  clean_query := trim(sql_query);

  -- Injection guard: SELECT only, no semicolons
  IF lower(clean_query) NOT LIKE 'select%' THEN
    RAISE EXCEPTION 'Only SELECT queries are permitted';
  END IF;
  IF position(';' IN clean_query) > 0 THEN
    RAISE EXCEPTION 'Query must be a single statement (no semicolons)';
  END IF;

  EXECUTE format('SELECT jsonb_agg(t) FROM (%s) t', clean_query)
    INTO result;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;


--
-- Name: resize_embedding_column(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resize_embedding_column(new_dim integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Drop the HNSW index
  DROP INDEX IF EXISTS public.document_chunks_embedding_idx;
  -- Alter column type (NULLs out existing embeddings — incompatible dimensions)
  EXECUTE format(
    'ALTER TABLE public.document_chunks ALTER COLUMN embedding TYPE vector(%s) USING NULL',
    new_dim
  );
  -- Recreate HNSW index
  EXECUTE format(
    'CREATE INDEX document_chunks_embedding_idx ON public.document_chunks
     USING hnsw (embedding vector_cosine_ops)
     WITH (m = 16, ef_construction = 64)'
  );
END;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_search_vector(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_search_vector() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.content, ''));
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: app_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_settings (
    id text DEFAULT 'global'::text NOT NULL,
    llm_providers jsonb DEFAULT '[]'::jsonb,
    embedding_model text,
    embedding_base_url text,
    embedding_api_key text,
    embedding_dimensions integer,
    rerank_enabled boolean,
    rerank_provider text,
    rerank_api_key text,
    rerank_model text,
    rerank_top_n integer,
    retrieval_top_k integer,
    retrieval_match_threshold double precision,
    hybrid_search_enabled boolean,
    hybrid_candidate_count integer,
    vector_search_weight double precision,
    keyword_search_weight double precision,
    rrf_k integer,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    action_type text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_action_type_check CHECK ((action_type = ANY (ARRAY['document.upload'::text, 'document.delete'::text, 'search.query'::text, 'code.execute'::text, 'skill.load'::text, 'thread.create'::text, 'thread.delete'::text, 'settings.update'::text, 'memory.remember'::text, 'memory.recall'::text, 'feedback.submit'::text])))
);


--
-- Name: code_executions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.code_executions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    thread_id uuid NOT NULL,
    user_id uuid NOT NULL,
    code text NOT NULL,
    exit_code integer,
    duration_ms integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: document_chunks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_chunks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    user_id uuid NOT NULL,
    content text NOT NULL,
    chunk_index integer NOT NULL,
    embedding public.vector(1536),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    search_vector tsvector
);


--
-- Name: document_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_images (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    user_id uuid NOT NULL,
    page integer,
    image_index integer NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: document_tables; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_tables (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    user_id uuid NOT NULL,
    page integer,
    table_index integer NOT NULL,
    headers jsonb DEFAULT '[]'::jsonb NOT NULL,
    rows jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    filename text NOT NULL,
    file_path text NOT NULL,
    file_size integer NOT NULL,
    mime_type text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    error_message text,
    chunk_count integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    content_hash text,
    metadata jsonb,
    folder_id uuid,
    version_number integer DEFAULT 1 NOT NULL,
    is_latest boolean DEFAULT true NOT NULL,
    full_markdown text,
    ingestion_step text,
    CONSTRAINT documents_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: folders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.folders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    parent_id uuid,
    is_global boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: message_feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    message_id uuid NOT NULL,
    rating character varying(16) NOT NULL,
    reason character varying(32),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT message_feedback_rating_check CHECK (((rating)::text = ANY ((ARRAY['positive'::character varying, 'negative'::character varying])::text[]))),
    CONSTRAINT message_feedback_reason_check CHECK (((reason)::text = ANY ((ARRAY['wrong_answer'::character varying, 'not_from_documents'::character varying, 'incomplete'::character varying, 'other'::character varying])::text[])))
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    thread_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tool_calls jsonb,
    source_refs jsonb,
    confidence_level text,
    confidence_avg_similarity double precision,
    confidence_disclaimer text,
    CONSTRAINT messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text])))
);

ALTER TABLE ONLY public.messages REPLICA IDENTITY FULL;


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    display_name text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.runs (
    run_id uuid DEFAULT gen_random_uuid() NOT NULL,
    thread_id uuid NOT NULL,
    user_id uuid NOT NULL,
    message_id uuid,
    status text NOT NULL,
    model text NOT NULL,
    provider text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    input_tokens integer,
    output_tokens integer,
    error text,
    CONSTRAINT runs_status_check CHECK ((status = ANY (ARRAY['streaming'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])))
);


--
-- Name: sandbox_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sandbox_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    execution_id uuid NOT NULL,
    user_id uuid NOT NULL,
    filename text NOT NULL,
    storage_path text NOT NULL,
    file_size bigint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: skill_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.skill_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    skill_id uuid NOT NULL,
    user_id uuid NOT NULL,
    filename text NOT NULL,
    file_path text NOT NULL,
    file_size bigint DEFAULT 0 NOT NULL,
    mime_type text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: skills; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.skills (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    instructions text DEFAULT ''::text NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    is_global boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: threads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.threads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text DEFAULT 'New Chat'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    folder_id uuid
);


--
-- Name: user_memory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_memory (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    key text NOT NULL,
    value text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_settings (
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    preferences jsonb DEFAULT '{}'::jsonb
);


--
-- Name: app_settings app_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: code_executions code_executions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.code_executions
    ADD CONSTRAINT code_executions_pkey PRIMARY KEY (id);


--
-- Name: document_chunks document_chunks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_chunks
    ADD CONSTRAINT document_chunks_pkey PRIMARY KEY (id);


--
-- Name: document_images document_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_images
    ADD CONSTRAINT document_images_pkey PRIMARY KEY (id);


--
-- Name: document_tables document_tables_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_tables
    ADD CONSTRAINT document_tables_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: folders folders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folders
    ADD CONSTRAINT folders_pkey PRIMARY KEY (id);


--
-- Name: message_feedback message_feedback_message_user_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_feedback
    ADD CONSTRAINT message_feedback_message_user_unique UNIQUE (message_id, user_id);


--
-- Name: message_feedback message_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_feedback
    ADD CONSTRAINT message_feedback_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: runs runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runs
    ADD CONSTRAINT runs_pkey PRIMARY KEY (run_id);


--
-- Name: sandbox_files sandbox_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandbox_files
    ADD CONSTRAINT sandbox_files_pkey PRIMARY KEY (id);


--
-- Name: skill_files skill_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_files
    ADD CONSTRAINT skill_files_pkey PRIMARY KEY (id);


--
-- Name: skills skills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skills
    ADD CONSTRAINT skills_pkey PRIMARY KEY (id);


--
-- Name: threads threads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.threads
    ADD CONSTRAINT threads_pkey PRIMARY KEY (id);


--
-- Name: user_memory user_memory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_memory
    ADD CONSTRAINT user_memory_pkey PRIMARY KEY (id);


--
-- Name: user_memory user_memory_user_key_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_memory
    ADD CONSTRAINT user_memory_user_key_unique UNIQUE (user_id, key);


--
-- Name: user_settings user_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_pkey PRIMARY KEY (user_id);


--
-- Name: audit_log_user_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_user_created_idx ON public.audit_log USING btree (user_id, created_at DESC);


--
-- Name: document_chunks_embedding_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_chunks_embedding_idx ON public.document_chunks USING hnsw (embedding public.vector_cosine_ops) WITH (m='16', ef_construction='64');


--
-- Name: document_chunks_search_vector_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_chunks_search_vector_idx ON public.document_chunks USING gin (search_vector);


--
-- Name: document_images_document_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_images_document_idx ON public.document_images USING btree (document_id);


--
-- Name: document_tables_document_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_tables_document_idx ON public.document_tables USING btree (document_id);


--
-- Name: documents_completed_hash_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX documents_completed_hash_unique_idx ON public.documents USING btree (user_id, content_hash) WHERE ((content_hash IS NOT NULL) AND (status = 'completed'::text));


--
-- Name: documents_folder_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX documents_folder_id_idx ON public.documents USING btree (folder_id);


--
-- Name: documents_latest_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX documents_latest_idx ON public.documents USING btree (user_id, filename, is_latest) WHERE (is_latest = true);


--
-- Name: documents_metadata_gin_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX documents_metadata_gin_idx ON public.documents USING gin (metadata);


--
-- Name: documents_user_filename_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX documents_user_filename_idx ON public.documents USING btree (user_id, filename);


--
-- Name: documents_user_hash_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX documents_user_hash_idx ON public.documents USING btree (user_id, content_hash);


--
-- Name: folders_parent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX folders_parent_id_idx ON public.folders USING btree (parent_id);


--
-- Name: folders_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX folders_user_id_idx ON public.folders USING btree (user_id);


--
-- Name: idx_runs_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runs_active ON public.runs USING btree (user_id, thread_id, status) WHERE (status = 'streaming'::text);


--
-- Name: idx_runs_history; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runs_history ON public.runs USING btree (user_id, thread_id, started_at DESC);


--
-- Name: message_feedback_user_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_feedback_user_created_idx ON public.message_feedback USING btree (user_id, created_at DESC);


--
-- Name: skill_files_skill_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX skill_files_skill_id_idx ON public.skill_files USING btree (skill_id);


--
-- Name: skill_files_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX skill_files_user_id_idx ON public.skill_files USING btree (user_id);


--
-- Name: skills_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX skills_user_id_idx ON public.skills USING btree (user_id);


--
-- Name: threads_folder_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX threads_folder_id_idx ON public.threads USING btree (folder_id);


--
-- Name: user_memory_user_updated_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_memory_user_updated_idx ON public.user_memory USING btree (user_id, updated_at DESC);


--
-- Name: folders folders_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER folders_set_updated_at BEFORE UPDATE ON public.folders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: messages set_messages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_messages_updated_at BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: profiles set_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: threads set_threads_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_threads_updated_at BEFORE UPDATE ON public.threads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: skills skills_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER skills_set_updated_at BEFORE UPDATE ON public.skills FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: document_chunks trg_update_search_vector; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_search_vector BEFORE INSERT OR UPDATE OF content ON public.document_chunks FOR EACH ROW EXECUTE FUNCTION public.update_search_vector();


--
-- Name: user_memory user_memory_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_memory_updated_at BEFORE UPDATE ON public.user_memory FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: audit_log audit_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: code_executions code_executions_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.code_executions
    ADD CONSTRAINT code_executions_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.threads(id) ON DELETE CASCADE;


--
-- Name: code_executions code_executions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.code_executions
    ADD CONSTRAINT code_executions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: document_chunks document_chunks_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_chunks
    ADD CONSTRAINT document_chunks_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: document_chunks document_chunks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_chunks
    ADD CONSTRAINT document_chunks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: document_images document_images_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_images
    ADD CONSTRAINT document_images_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: document_images document_images_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_images
    ADD CONSTRAINT document_images_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: document_tables document_tables_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_tables
    ADD CONSTRAINT document_tables_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: document_tables document_tables_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_tables
    ADD CONSTRAINT document_tables_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: documents documents_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.folders(id) ON DELETE SET NULL;


--
-- Name: documents documents_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: folders folders_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folders
    ADD CONSTRAINT folders_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.folders(id) ON DELETE CASCADE;


--
-- Name: folders folders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folders
    ADD CONSTRAINT folders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: message_feedback message_feedback_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_feedback
    ADD CONSTRAINT message_feedback_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: message_feedback message_feedback_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_feedback
    ADD CONSTRAINT message_feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: messages messages_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.threads(id) ON DELETE CASCADE;


--
-- Name: messages messages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: runs runs_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runs
    ADD CONSTRAINT runs_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE SET NULL;


--
-- Name: runs runs_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runs
    ADD CONSTRAINT runs_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.threads(id) ON DELETE CASCADE;


--
-- Name: runs runs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runs
    ADD CONSTRAINT runs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sandbox_files sandbox_files_execution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandbox_files
    ADD CONSTRAINT sandbox_files_execution_id_fkey FOREIGN KEY (execution_id) REFERENCES public.code_executions(id) ON DELETE CASCADE;


--
-- Name: sandbox_files sandbox_files_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandbox_files
    ADD CONSTRAINT sandbox_files_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: skill_files skill_files_skill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_files
    ADD CONSTRAINT skill_files_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES public.skills(id) ON DELETE CASCADE;


--
-- Name: skill_files skill_files_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_files
    ADD CONSTRAINT skill_files_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: skills skills_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skills
    ADD CONSTRAINT skills_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: threads threads_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.threads
    ADD CONSTRAINT threads_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.folders(id) ON DELETE SET NULL;


--
-- Name: threads threads_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.threads
    ADD CONSTRAINT threads_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_memory user_memory_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_memory
    ADD CONSTRAINT user_memory_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: folders Users can delete own folders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own folders" ON public.folders FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: user_memory Users can delete own memory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own memory" ON public.user_memory FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: skill_files Users can delete own skill files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own skill files" ON public.skill_files FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: skills Users can delete own skills; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own skills" ON public.skills FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: document_chunks Users can delete their own chunks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own chunks" ON public.document_chunks FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: documents Users can delete their own documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own documents" ON public.documents FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: messages Users can delete their own messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own messages" ON public.messages FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: threads Users can delete their own threads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own threads" ON public.threads FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: audit_log Users can insert own audit entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own audit entries" ON public.audit_log FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: code_executions Users can insert own executions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own executions" ON public.code_executions FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: message_feedback Users can insert own feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own feedback" ON public.message_feedback FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: folders Users can insert own folders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own folders" ON public.folders FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_memory Users can insert own memory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own memory" ON public.user_memory FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: sandbox_files Users can insert own sandbox files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own sandbox files" ON public.sandbox_files FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: skill_files Users can insert own skill files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own skill files" ON public.skill_files FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: skills Users can insert own skills; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own skills" ON public.skills FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: document_chunks Users can insert their own chunks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own chunks" ON public.document_chunks FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: documents Users can insert their own documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own documents" ON public.documents FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: messages Users can insert their own messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own messages" ON public.messages FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users can insert their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: threads Users can insert their own threads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own threads" ON public.threads FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: document_images Users can manage own document images; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own document images" ON public.document_images USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: document_tables Users can manage own document tables; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own document tables" ON public.document_tables USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: message_feedback Users can select own feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can select own feedback" ON public.message_feedback FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_memory Users can select own memory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can select own memory" ON public.user_memory FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: folders Users can update own folders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own folders" ON public.folders FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: user_memory Users can update own memory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own memory" ON public.user_memory FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: skills Users can update own skills; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own skills" ON public.skills FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: document_chunks Users can update their own chunks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own chunks" ON public.document_chunks FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: documents Users can update their own documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own documents" ON public.documents FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: messages Users can update their own messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own messages" ON public.messages FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: threads Users can update their own threads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own threads" ON public.threads FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: skill_files Users can view files on own or global skills; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view files on own or global skills" ON public.skill_files FOR SELECT USING (((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM public.skills
  WHERE ((skills.id = skill_files.skill_id) AND (skills.is_global = true))))));


--
-- Name: folders Users can view own and global folders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own and global folders" ON public.folders FOR SELECT USING (((auth.uid() = user_id) OR public.folder_is_globally_visible(id)));


--
-- Name: skills Users can view own and global skills; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own and global skills" ON public.skills FOR SELECT USING (((auth.uid() = user_id) OR (is_global = true)));


--
-- Name: code_executions Users can view own executions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own executions" ON public.code_executions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: documents Users can view own or global-folder documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own or global-folder documents" ON public.documents FOR SELECT USING (((auth.uid() = user_id) OR ((folder_id IS NOT NULL) AND public.folder_is_globally_visible(folder_id))));


--
-- Name: sandbox_files Users can view own sandbox files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own sandbox files" ON public.sandbox_files FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: document_chunks Users can view their own chunks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own chunks" ON public.document_chunks FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: messages Users can view their own messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own messages" ON public.messages FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: threads Users can view their own threads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own threads" ON public.threads FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: code_executions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.code_executions ENABLE ROW LEVEL SECURITY;

--
-- Name: document_chunks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

--
-- Name: document_images; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_images ENABLE ROW LEVEL SECURITY;

--
-- Name: document_tables; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_tables ENABLE ROW LEVEL SECURITY;

--
-- Name: documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

--
-- Name: folders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

--
-- Name: message_feedback; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.message_feedback ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;

--
-- Name: runs runs_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY runs_select_own ON public.runs FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: sandbox_files; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sandbox_files ENABLE ROW LEVEL SECURITY;

--
-- Name: skill_files; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.skill_files ENABLE ROW LEVEL SECURITY;

--
-- Name: skills; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

--
-- Name: threads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;

--
-- Name: user_memory; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_memory ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict qPLUHuo1GcgCXeKcC2LORugO4UMxe1VOPVRjdFL2o7ylfnviUGPwhXvhbDzSOrT

