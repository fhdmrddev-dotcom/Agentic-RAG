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

CREATE SCHEMA IF NOT EXISTS public;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

-- COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: autofill_org_id_by_owner(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.autofill_org_id_by_owner() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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
$$;


--
-- Name: autofill_org_id_from_parent(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.autofill_org_id_from_parent() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
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
$_$;


--
-- Name: capture_skill_version(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.capture_skill_version() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  next_num integer;
BEGIN
  -- D-02: on UPDATE, capture a version ONLY when the content trifecta changes. A
  -- toggle-only flip (is_enabled / is_org_shared) MUST NOT version.
  IF TG_OP = 'UPDATE' THEN
    IF NOT (
         NEW.name         IS DISTINCT FROM OLD.name
      OR NEW.description  IS DISTINCT FROM OLD.description
      OR NEW.instructions IS DISTINCT FROM OLD.instructions
    ) THEN
      RETURN NEW;  -- toggle-only / no content change → no version
    END IF;
  END IF;

  -- COALESCE(MAX)+1 per skill; the UNIQUE(skill_id, version_number) constraint turns any
  -- concurrent collision into a benign retryable 23505 (D-03-R3 / T-132-04).
  SELECT COALESCE(MAX(version_number), 0) + 1
    INTO next_num
    FROM public.skill_versions
   WHERE skill_id = NEW.id;

  INSERT INTO public.skill_versions
    (skill_id, user_id, version_number, name, description, instructions, source)
  VALUES
    (NEW.id, NEW.user_id, next_num, NEW.name, NEW.description, NEW.instructions, 'manual');
    -- user_id = NEW.user_id (NOT auth.uid() — NULL under service-role, D-03-R3 / T-132-03).
    -- source 'manual': the trigger cannot distinguish write paths (D-03-R1); the 5-value enum
    -- stays for forward-compat (import/tuner/self_improve/backfill set by other paths).

  RETURN NEW;
END;
$$;


--
-- Name: create_org_with_default_dept(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_org_with_default_dept(p_name text, p_subscription_tier text DEFAULT NULL::text, p_default_dept_name text DEFAULT 'General'::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_org_id uuid;
BEGIN
  INSERT INTO public.organizations (name, subscription_tier)
  VALUES (p_name, p_subscription_tier)
  RETURNING id INTO v_org_id;

  INSERT INTO public.departments (org_id, name, is_default)
  VALUES (v_org_id, p_default_dept_name, true);

  RETURN v_org_id;
END;
$$;


--
-- Name: current_user_has_permission(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_user_has_permission(p_org_id uuid, p_permission_key text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_members m
    JOIN public.role_permissions rp ON rp.role = m.role
    WHERE m.org_id = p_org_id
      AND m.user_id = auth.uid()
      AND rp.permission_key = p_permission_key
  );
$$;


--
-- Name: current_user_org_ids(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_user_org_ids() RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT org_id FROM public.org_members WHERE user_id = auth.uid();
$$;


--
-- Name: folder_is_org_shared(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.folder_is_org_shared(p_folder_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  WITH RECURSIVE ancestors AS (
    SELECT id, parent_id, is_org_shared
    FROM public.folders
    WHERE id = p_folder_id

    UNION ALL

    SELECT f.id, f.parent_id, f.is_org_shared
    FROM public.folders f
    INNER JOIN ancestors a ON f.id = a.parent_id
  )
  SELECT COALESCE(bool_or(is_org_shared), false) FROM ancestors;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Existing behavior, hardened with ON CONFLICT so a re-fire can't duplicate the profile row
  -- (profiles PK = id — verified live).
  INSERT INTO public.profiles (id, display_name)
  VALUES (new.id, new.raw_user_meta_data->>'display_name')
  ON CONFLICT (id) DO NOTHING;

  -- NEW: defensive personal-org provisioning — identical logic to §A, wrapped in a swallow so a
  -- failure logs a WARNING and returns normally instead of aborting the signup INSERT.
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.org_members m WHERE m.user_id = new.id) THEN
      v_org_id := public.create_org_with_default_dept(
                    COALESCE(new.email, new.id::text) || '''s Organization', NULL, 'General');
      INSERT INTO public.org_members (org_id, user_id, role)
      VALUES (v_org_id, new.id, 'org-admin')
      ON CONFLICT (org_id, user_id) DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: personal-org creation failed for %: %', new.id, SQLERRM;
  END;

  RETURN new;
END;
$$;


--
-- Name: keyword_search_chunks(text, uuid, integer, jsonb, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.keyword_search_chunks(search_query text, match_user_id uuid, match_count integer DEFAULT 20, metadata_filter jsonb DEFAULT NULL::jsonb, p_folder_ids uuid[] DEFAULT NULL::uuid[]) RETURNS TABLE(id uuid, document_id uuid, content text, chunk_index integer, rank double precision)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
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
  WHERE dc.org_id = ANY (SELECT public.current_user_org_ids())          -- D-164-01 org gate (indexed, mig 107)
    AND (                                                               -- PRAG-01 within-org visibility
      dc.user_id = auth.uid()                                          --   owner (session-derived, NOT match_user_id)
      OR (d.folder_id IS NOT NULL AND public.folder_is_org_shared(d.folder_id))
    )
    AND dc.search_vector @@ tsq
    AND d.is_latest = true
    AND (metadata_filter IS NULL OR d.metadata @> metadata_filter)
    AND (p_folder_ids IS NULL OR d.folder_id = ANY(p_folder_ids))
  ORDER BY rank DESC
  LIMIT match_count;
END;
$$;


--
-- Name: match_document_chunks(public.vector, uuid, integer, double precision, jsonb, uuid[], text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.match_document_chunks(query_embedding public.vector, match_user_id uuid, match_count integer DEFAULT 5, match_threshold double precision DEFAULT 0.3, metadata_filter jsonb DEFAULT NULL::jsonb, p_folder_ids uuid[] DEFAULT NULL::uuid[], p_embedding_model text DEFAULT NULL::text) RETURNS TABLE(id uuid, document_id uuid, content text, chunk_index integer, similarity double precision)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  RETURN QUERY
  SELECT dc.id, dc.document_id, dc.content, dc.chunk_index,
         1 - (dc.embedding OPERATOR(public.<=>) query_embedding) AS similarity
  FROM public.document_chunks dc
  JOIN public.documents d ON d.id = dc.document_id
  WHERE dc.org_id = ANY (SELECT public.current_user_org_ids())          -- D-164-01 org gate (indexed, mig 107)
    AND (                                                               -- PRAG-01 within-org visibility
      dc.user_id = auth.uid()                                          --   owner (session-derived, NOT match_user_id)
      OR (d.folder_id IS NOT NULL AND public.folder_is_org_shared(d.folder_id))
    )
    AND 1 - (dc.embedding OPERATOR(public.<=>) query_embedding) > match_threshold
    AND d.is_latest = true
    AND (metadata_filter IS NULL OR d.metadata @> metadata_filter)
    AND (p_folder_ids IS NULL OR d.folder_id = ANY(p_folder_ids))
    AND (p_embedding_model IS NULL OR dc.embedding_model = p_embedding_model)  -- D-10 stale-model filter
  ORDER BY dc.embedding OPERATOR(public.<=>) query_embedding
  LIMIT match_count;
END;
$$;


--
-- Name: match_skills(public.vector, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.match_skills(query_embedding public.vector, match_user_id uuid, p_embedding_model text DEFAULT NULL::text) RETURNS TABLE(id uuid, name text, description text, similarity double precision)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.name, s.description,
         CASE WHEN se.embedding IS NULL THEN NULL
              ELSE 1 - (se.embedding OPERATOR(public.<=>) query_embedding) END AS similarity
  FROM public.skills s
  LEFT JOIN public.skill_embeddings se
         ON se.skill_id = s.id
        AND (p_embedding_model IS NULL OR se.embedding_model = p_embedding_model)  -- D-10 stale-model filter
  -- FIX-A (mig 109): is_system = true is a UNIVERSAL escape OUTSIDE the org gate; the
  -- owner OR user-is_org_shared branch stays INSIDE the org gate (owner keys on auth.uid()).
  WHERE ( (s.is_system = true)
          OR (s.org_id = ANY (SELECT public.current_user_org_ids())
              AND (s.user_id = auth.uid() OR s.is_org_shared = true)) )
    AND s.is_enabled = true
  ORDER BY similarity DESC NULLS LAST, s.name;   -- NULL sim (no vector) = fail-open, ranked last-but-kept
END;
$$;


--
-- Name: FUNCTION match_skills(query_embedding public.vector, match_user_id uuid, p_embedding_model text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.match_skills(query_embedding public.vector, match_user_id uuid, p_embedding_model text) IS 'Cosine ranking of the owner+global enabled skill set against a query vector (TRIG-02, Phase 140). Mirrors match_document_chunks (mig 073). LEFT JOIN → NULL similarity for a skill with no current-model vector (fail-open keep, NULLS LAST). WHERE clause is the byte-exact clone of agent_loop.py:1207-1208; as a SECURITY DEFINER body it is the ONLY cross-user gate (T-140-01) — never widen it.';


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
  -- Alter column type (NULLs out existing embeddings + their embedded_at — incompatible
  -- dimensions mean the vector no longer exists, so "last indexed" is a lie)
  EXECUTE format(
    'ALTER TABLE public.document_chunks
       ALTER COLUMN embedding TYPE vector(%s) USING NULL,
       ALTER COLUMN embedded_at TYPE timestamptz USING NULL',
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
-- Name: skill_versions_block_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.skill_versions_block_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RAISE EXCEPTION
    'skill_versions row % is append-only and immutable; insert a new version instead',
    OLD.id
    USING ERRCODE = 'check_violation';   -- SQLSTATE 23514, distinguishable in tests
END;
$$;


--
-- Name: stale_skill_embedding(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.stale_skill_embedding() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NOT (
       NEW.name        IS DISTINCT FROM OLD.name
    OR NEW.description IS DISTINCT FROM OLD.description
  ) THEN
    RETURN NEW;  -- instructions/toggle-only change → vector stays valid, no invalidation
  END IF;
  DELETE FROM public.skill_embeddings WHERE skill_id = NEW.id;
  RETURN NEW;
END;
$$;


--
-- Name: stale_skill_embedding_from_case(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.stale_skill_embedding_from_case() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  DELETE FROM public.skill_embeddings WHERE skill_id = COALESCE(NEW.skill_id, OLD.skill_id);
  RETURN COALESCE(NEW, OLD);
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


--
-- Name: view_iso_to_date(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.view_iso_to_date(s text) RETURNS date
    LANGUAGE plpgsql IMMUTABLE STRICT
    AS $_$
BEGIN
  IF s !~ '^\d{4}-\d{2}-\d{2}$' THEN
    RETURN NULL;  -- not ISO YYYY-MM-DD shape
  END IF;
  RETURN make_date(
    substring(s FROM 1 FOR 4)::int,   -- year
    substring(s FROM 6 FOR 2)::int,   -- month
    substring(s FROM 9 FOR 2)::int    -- day
  );
EXCEPTION WHEN others THEN
  RETURN NULL;  -- calendar-invalid (2026-13-99 / 2026-02-31) → NULL, never raises
END;
$_$;


--
-- Name: workflow_definitions_block_published_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.workflow_definitions_block_published_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF OLD.status = 'published' AND (
        NEW.slug             IS DISTINCT FROM OLD.slug
     OR NEW.version          IS DISTINCT FROM OLD.version
     OR NEW.name             IS DISTINCT FROM OLD.name
     OR NEW.description       IS DISTINCT FROM OLD.description
     OR NEW.status           IS DISTINCT FROM OLD.status
     OR NEW.definition       IS DISTINCT FROM OLD.definition
     OR NEW.created_by       IS DISTINCT FROM OLD.created_by
     OR NEW.is_system_global IS DISTINCT FROM OLD.is_system_global
     OR NEW.org_id           IS DISTINCT FROM OLD.org_id
  ) THEN
    RAISE EXCEPTION
      'workflow_definitions row % is published and immutable; create a new version instead',
      OLD.id
      USING ERRCODE = 'check_violation';
  END IF;
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
    updated_at timestamp with time zone DEFAULT now(),
    multimodal_max_vision_calls integer DEFAULT 100,
    multimodal_max_b64_bytes_kb integer DEFAULT 4096,
    extraction_text_engine_pdf text DEFAULT 'legacy'::text,
    extraction_text_engine_docx text DEFAULT 'legacy'::text,
    extraction_table_engine_pdf text DEFAULT 'camelot'::text,
    extraction_image_engine_pdf text DEFAULT 'pymupdf_full'::text,
    extraction_image_engine_docx text DEFAULT 'zip_xpath'::text,
    extraction_equation_engine text DEFAULT 'none'::text,
    extraction_per_call_hints_enabled boolean DEFAULT true,
    chat_tool_args_progress_emit_boundary_bytes integer DEFAULT 256 NOT NULL,
    llm_provider text DEFAULT ''::text,
    llm_model text DEFAULT 'gpt-4o'::text,
    web_search_max_results integer DEFAULT 5,
    web_search_enabled boolean DEFAULT false,
    sandbox_enabled boolean DEFAULT true,
    context_window_max_tokens integer DEFAULT 200000,
    sub_agent_max_output_tokens integer DEFAULT 32768,
    sub_agent_model text DEFAULT ''::text,
    llm_max_output_tokens integer DEFAULT 32768,
    openrouter_tool_strategy text DEFAULT 'quality'::text,
    ollama_base_url text DEFAULT 'http://localhost:11434'::text,
    provider_model_lists jsonb DEFAULT '{}'::jsonb,
    title_drafting_config jsonb DEFAULT '{"max_length": 60, "max_tokens": 30}'::jsonb,
    sub_agent_config jsonb DEFAULT '{"max_output_tokens": 32768}'::jsonb,
    token_capture_enabled boolean DEFAULT true,
    template_ttl_hours integer DEFAULT 24,
    document_management_enabled boolean DEFAULT true,
    extraction_model text,
    extraction_window_cap integer DEFAULT 32000,
    metadata_enrichment_mode text DEFAULT 'enriched'::text,
    embedding_provider text,
    extraction_provider text,
    confidence_bucket_high double precision DEFAULT 0.54,
    confidence_bucket_medium double precision DEFAULT 0.38,
    skill_builder_model text DEFAULT ''::text NOT NULL,
    harness_judge_model text DEFAULT ''::text NOT NULL,
    skill_catalog_max_tokens integer DEFAULT 1500 NOT NULL,
    self_improve_enabled boolean DEFAULT true,
    workflows_enabled boolean DEFAULT true,
    maintenance_mode boolean DEFAULT false,
    feature_visibility jsonb DEFAULT '{}'::jsonb NOT NULL,
    llm_model_locked boolean DEFAULT false NOT NULL,
    openai_api_key text,
    anthropic_api_key text,
    google_api_key text,
    openrouter_api_key text,
    ollama_api_key text,
    deepseek_api_key text,
    moonshot_api_key text,
    minimax_api_key text,
    zhipu_api_key text,
    tavily_api_key text,
    setup_complete boolean DEFAULT false NOT NULL,
    model_discovery_filter_enabled boolean DEFAULT true NOT NULL,
    supabase_management_token text,
    CONSTRAINT app_settings_extraction_table_engine_pdf_check CHECK ((extraction_table_engine_pdf = ANY (ARRAY['camelot'::text, 'pdfplumber'::text])))
);


--
-- Name: COLUMN app_settings.chat_tool_args_progress_emit_boundary_bytes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.app_settings.chat_tool_args_progress_emit_boundary_bytes IS 'Byte boundary at which provider services emit tool_args_progress SSE events during tool argument generation. Lower = more visible streaming (per Claude.ai) but more SSE bandwidth. Default 256 ≈ a line of Python every event. Was hardcoded 5120 pre-075.10.';


--
-- Name: COLUMN app_settings.template_ttl_hours; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.app_settings.template_ttl_hours IS 'Phase 100 D-05. Hours an uploaded template_input file lives before expiry. Default 24. No new RLS — app_settings is the single global-row config table.';


--
-- Name: COLUMN app_settings.document_management_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.app_settings.document_management_enabled IS 'Phase 110 DMF-03. Master gate for net-new DM surfaces+tools (113-119). Default true => v3.0 behavior unchanged. Seam SEED-080 (v3.2) entitlement enforcement plugs into. NOT entangled with Phase 111 enrichment (D-110-2).';


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    action_type text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid NOT NULL,
    CONSTRAINT audit_log_action_type_check CHECK ((action_type = ANY (ARRAY['document.upload'::text, 'document.delete'::text, 'search.query'::text, 'code.execute'::text, 'skill.load'::text, 'thread.create'::text, 'thread.delete'::text, 'settings.update'::text, 'memory.remember'::text, 'memory.recall'::text, 'feedback.submit'::text, 'view.create'::text, 'view.delete'::text, 'relationship.create'::text, 'relationship.delete'::text, 'classification.apply'::text, 'classification.rule.create'::text, 'metadata.update'::text, 'metadata.field.create'::text])))
);


--
-- Name: COLUMN audit_log.org_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audit_log.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.4; no FK until backfill/RLS (Phase 162/163).';


--
-- Name: checked_queries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checked_queries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    user_id uuid NOT NULL,
    question text NOT NULL,
    expected_document_id uuid NOT NULL,
    last_rank integer,
    previous_rank integer,
    checked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN checked_queries.question; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.checked_queries.question IS 'The question to evaluate against the user''s corpus.';


--
-- Name: COLUMN checked_queries.expected_document_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.checked_queries.expected_document_id IS 'The document that SHOULD be among the top hits for this question. Validated for ownership on write.';


--
-- Name: COLUMN checked_queries.last_rank; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.checked_queries.last_rank IS 'The 1-indexed rank of expected_document_id at the most recent check. NULL = checked but the document was not found in the top N results (never 0).';


--
-- Name: COLUMN checked_queries.previous_rank; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.checked_queries.previous_rank IS 'The last_rank from the check BEFORE the most recent one, so Holding/Slipped can be derived.';


--
-- Name: COLUMN checked_queries.checked_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.checked_queries.checked_at IS 'When the most recent evaluation finished. NULL = not yet checked (a fresh create that awaits triggerCheck).';


--
-- Name: classification_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.classification_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    org_id uuid NOT NULL,
    name text NOT NULL,
    match_expr jsonb NOT NULL,
    suggest_folder_id uuid,
    is_system_global boolean DEFAULT false NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN classification_rules.org_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.classification_rules.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v2.8; no FK until org schema exists; RLS stays user-scoped.';


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
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid NOT NULL
);


--
-- Name: COLUMN code_executions.org_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.code_executions.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.4; no FK until backfill/RLS (Phase 162/163).';


--
-- Name: connector_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.connector_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    created_by uuid NOT NULL,
    capability text,
    name text NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    secret_ciphertext text,
    is_enabled boolean DEFAULT true NOT NULL,
    last_checked_at timestamp with time zone,
    last_check_verdict text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    mcp_server_url text,
    tool_grants jsonb DEFAULT '{}'::jsonb NOT NULL,
    discovered_tools jsonb DEFAULT '[]'::jsonb NOT NULL,
    service_id text,
    default_approval_posture text DEFAULT 'ask'::text NOT NULL,
    auth_type text DEFAULT 'static_key'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    error_message text,
    oauth_client_secret_ciphertext text,
    CONSTRAINT connector_connections_auth_type_check CHECK ((auth_type = ANY (ARRAY['static_key'::text, 'oauth_byo'::text, 'mcp'::text]))),
    CONSTRAINT connector_connections_capability_check CHECK ((capability = ANY (ARRAY['send_email'::text, 'create_ticket'::text, 'post_message'::text]))),
    CONSTRAINT connector_connections_default_posture_check CHECK ((default_approval_posture = ANY (ARRAY['allow'::text, 'ask'::text, 'deny'::text]))),
    CONSTRAINT connector_connections_has_a_service_identity CHECK (((service_id IS NOT NULL) AND (length(btrim(service_id)) > 0))),
    CONSTRAINT connector_connections_last_check_verdict_check CHECK ((last_check_verdict = ANY (ARRAY['not_checked'::text, 'ok'::text, 'failed'::text]))),
    CONSTRAINT connector_connections_mcp_url_is_https CHECK (((mcp_server_url IS NULL) OR (mcp_server_url ~~ 'https://%'::text))),
    CONSTRAINT connector_connections_shape_is_not_ambiguous CHECK ((NOT ((capability IS NOT NULL) AND (mcp_server_url IS NOT NULL)))),
    CONSTRAINT connector_connections_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'error'::text])))
);


--
-- Name: COLUMN connector_connections.config; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.connector_connections.config IS 'D-13 / CONN-03 SC#4: NON-SECRET facts ONLY — host, port, base_url, from_address, default_channel, project_key. No token, no password, no API key ever lands here. The workflow definition JSONB stores a connection_id REFERENCE, so no secret and no host reaches the client or the definition.';


--
-- Name: COLUMN connector_connections.secret_ciphertext; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.connector_connections.secret_ciphertext IS 'D-11: the connector secret as an `enc:v1:` envelope produced by the SHIPPED cipher (backend/app/security/secret_cipher.py) — no new crypto, no new key (SECRETS_ENCRYPTION_KEY). Nullable because a row may exist before its secret is set. ⚠ POLARITY INVERSION, stated so it is not read as a bug: get_cipher() returns None when unkeyed, a deliberate fail-OPEN plaintext path for app_settings provider keys (D-150-01). For an org-scoped TENANT credential 190 is fail-CLOSED — it REFUSES to store a connector secret when no cipher is available. Also: this column is NOT in SECRET_COLUMNS, which drives the app_settings boot sweep and does not fit a per-org, per-row table (encrypt at write, decrypt at call time). ⚠ CR-01 / migration 118: this column is WRITE-ONLY for the `authenticated` role — it carries INSERT and UPDATE but NOT SELECT, so it cannot appear in any PostgREST projection a browser client can request, including `select=*`. Only `service_role` (the harness resolver, which has no user JWT) may read it. Re-granting SELECT here re-opens CR-01.';


--
-- Name: COLUMN connector_connections.last_check_verdict; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.connector_connections.last_check_verdict IS '190-UI-SPEC §5a: a QUALITY HINT, never an authorization boundary. It feeds the Credential column (§2c) and the client-side picker filter (Gate 1); the SERVER bind gate (Gate 2) validates org + is_enabled ONLY and deliberately does NOT read this column (U-07a, door (b)) — because check is admin-only while bind is org-wide, so a stale `failed` would hard-block a member who cannot clear it. NULL means never checked.';


--
-- Name: COLUMN connector_connections.mcp_server_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.connector_connections.mcp_server_url IS 'Phase 206 (D-206-01): The HTTPS endpoint of the remote MCP server. Required for MCP provider connections.';


--
-- Name: COLUMN connector_connections.tool_grants; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.connector_connections.tool_grants IS 'Phase 206 (F-1 / D-206-06): JSONB mapping of tool names to boolean permission grants. Key presence and true means granted; absent or false means denied.';


--
-- Name: COLUMN connector_connections.discovered_tools; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.connector_connections.discovered_tools IS 'Phase 206 (D-206-05): JSONB array of tool schemas discovered from the remote MCP server via tools/list.';


--
-- Name: COLUMN connector_connections.service_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.connector_connections.service_id IS 'Phase 211 (D-211-01): the SERVICE this connection reaches — ''slack'', ''jira'', ''smtp'', ''notion'', anything. FREE TEXT. It is NOT a foreign key, it is NEVER CHECK-constrained against a closed list, and no migration may later close it: a closed set here is migration 116''s `capability` mistake moved to a nicer axis, where every unknown service again becomes invisible or has to squeeze into a known name (SEED-207). The curated "Popular" set (Phase 212) is a PRESENTATION LOOKUP keyed by this value (D-211-02) — a miss degrades to a generic mark, NEVER to a refusal and NEVER to a hidden row, which is what makes adding a service cost a presentation row instead of a migration. The only constraint this column carries is the one in §3: present and non-blank.';


--
-- Name: COLUMN connector_connections.default_approval_posture; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.connector_connections.default_approval_posture IS 'Phase 213 (D-213-06, D-213-08): The connection-level default approval posture (''allow'', ''ask'', ''deny''). Newly discovered or unconfigured tools inherit this posture until explicitly overridden in tool_grants.';


--
-- Name: COLUMN connector_connections.auth_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.connector_connections.auth_type IS 'Phase 215 (D-215-01): The authentication mechanism used by the connection (static_key, oauth_byo, mcp).';


--
-- Name: COLUMN connector_connections.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.connector_connections.status IS 'Phase 215 (D-215-05): Connection operational status (active, revoked, error).';


--
-- Name: COLUMN connector_connections.oauth_client_secret_ciphertext; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.connector_connections.oauth_client_secret_ciphertext IS 'Phase 215 follow-up (2026-08-31): the customer-registered OAuth application secret, encrypted (enc:v1: AES-256-GCM) exactly as secret_ciphertext is. NEVER granted SELECT to authenticated or anon — it is deliberately absent from the GRANT below and from _SELECTABLE_COLUMNS. It previously lived in config.custom_client_secret as PLAINTEXT, in a column every org member can read.';


--
-- Name: connector_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.connector_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    connection_id uuid NOT NULL,
    account_email text,
    account_name text,
    access_token_ciphertext text NOT NULL,
    refresh_token_ciphertext text,
    token_type text DEFAULT 'Bearer'::text NOT NULL,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    refresh_claimed_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE connector_tokens; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.connector_tokens IS 'Phase 215 (OAUTH-01..03): Encrypted OAuth tokens and claim-based refresh leases for connector connections.';


--
-- Name: COLUMN connector_tokens.access_token_ciphertext; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.connector_tokens.access_token_ciphertext IS 'Phase 215 (SEC-1): Encrypted access token envelope (enc:v1: AES-256-GCM). Must NEVER be granted SELECT to authenticated or anon.';


--
-- Name: COLUMN connector_tokens.refresh_token_ciphertext; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.connector_tokens.refresh_token_ciphertext IS 'Phase 215 (SEC-1): Encrypted refresh token envelope (enc:v1: AES-256-GCM). Must NEVER be granted SELECT to authenticated or anon.';


--
-- Name: COLUMN connector_tokens.refresh_claimed_until; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.connector_tokens.refresh_claimed_until IS 'Phase 215 (D-215-04): Timestamp lease for multi-worker atomic refresh locking (WORKER_COUNT=2).';


--
-- Name: departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.departments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    name text NOT NULL,
    parent_id uuid,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT departments_no_self_parent CHECK (((parent_id IS NULL) OR (parent_id <> id)))
);


--
-- Name: dept_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dept_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    dept_id uuid NOT NULL,
    org_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT dept_members_role_check CHECK ((role = ANY (ARRAY['super-admin'::text, 'org-admin'::text, 'dept-admin'::text, 'member'::text])))
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
    search_vector tsvector,
    embedding_model text,
    embedding_dimensions integer,
    org_id uuid NOT NULL,
    embedded_at timestamp with time zone
);


--
-- Name: COLUMN document_chunks.org_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.document_chunks.org_id IS 'TEN-04 (Phase 163): denormalized from documents.org_id via document_id. NOT NULL. RLS (mig 108) + Phase-164 SECDEF filter this directly — never a per-row join to documents (CONCUR-01).';


--
-- Name: COLUMN document_chunks.embedded_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.document_chunks.embedded_at IS 'Phase 217.1 (BE-1 / LIB-01): the instant THIS chunk''s vector was written, set at all FOUR document_chunks write sites — main ingest (backend/app/api/documents.py:2296), table chunks (backend/app/services/multimodal_service.py:423), image chunks (multimodal_service.py:896) and the re-embed UPDATE (backend/app/services/reembed_service.py:187). NULLABLE and NOT BACKFILLED (D-217.1-13): a pre-140 chunk keeps NULL forever, which reads "never indexed" — distinct from "time not recorded". created_at is the CHUNKING time and does not move on a re-embed; using it would print a lie after the first re-index. resize_embedding_column NULLs it alongside the vector on a dims change.';


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
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    bbox jsonb,
    org_id uuid NOT NULL
);


--
-- Name: COLUMN document_images.org_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.document_images.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.4; no FK until backfill/RLS (Phase 162/163).';


--
-- Name: document_relationships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_relationships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    org_id uuid NOT NULL,
    source_doc_id uuid NOT NULL,
    target_doc_id uuid NOT NULL,
    rel_type text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT document_relationships_rel_type_check CHECK ((rel_type = ANY (ARRAY['supersedes'::text, 'amends'::text, 'references'::text, 'attached_to'::text]))),
    CONSTRAINT no_self_rel CHECK ((source_doc_id <> target_doc_id))
);


--
-- Name: COLUMN document_relationships.org_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.document_relationships.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v2.8; no FK until org schema exists; RLS stays user-scoped.';


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
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    bbox jsonb,
    extractor text,
    org_id uuid NOT NULL
);


--
-- Name: COLUMN document_tables.org_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.document_tables.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.4; no FK until backfill/RLS (Phase 162/163).';


--
-- Name: document_views; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_views (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    org_id uuid NOT NULL,
    name text NOT NULL,
    filter_expr jsonb DEFAULT '{}'::jsonb NOT NULL,
    folder_scope uuid,
    is_system_global boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN document_views.org_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.document_views.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v2.8; no FK until org schema exists; RLS stays user-scoped.';


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
    extractor text,
    document_type_norm text GENERATED ALWAYS AS (lower((metadata ->> 'document_type'::text))) STORED,
    date_typed date GENERATED ALWAYS AS (public.view_iso_to_date((metadata ->> 'date'::text))) STORED,
    org_id uuid NOT NULL,
    CONSTRAINT documents_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: COLUMN documents.org_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documents.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.3; no FK until org schema exists.';


--
-- Name: eval_ratings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.eval_ratings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    eval_result_id uuid NOT NULL,
    user_id uuid NOT NULL,
    rating text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid NOT NULL,
    CONSTRAINT eval_ratings_rating_check CHECK ((rating = ANY (ARRAY['up'::text, 'down'::text])))
);


--
-- Name: TABLE eval_ratings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.eval_ratings IS 'Owner-scoped human-preference thumbs (EVAL-04, D-08/D-09). One thumbs up/down per (user, answer = an eval_results row), re-ratable (clear = DELETE the row). Minimal shape (id, eval_result_id, user_id, rating, created_at, updated_at) so Phase 135 can join verdict <-> rating for human-judge disagreement (D-09). Written via the service-role ratings endpoint (Plan 03) with an .eq("user_id") IDOR gate; owner-only RLS SELECT is defense-in-depth (T-134-01). NO client write policies (T-134-04). Both FKs ON DELETE CASCADE — no orphaned rating survives its parent (T-134-05).';


--
-- Name: COLUMN eval_ratings.org_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.eval_ratings.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.4; no FK until backfill/RLS (Phase 162/163).';


--
-- Name: eval_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.eval_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    eval_run_id uuid NOT NULL,
    test_case_id uuid,
    user_id uuid NOT NULL,
    variant text NOT NULL,
    provider text NOT NULL,
    model text NOT NULL,
    output text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'completed'::text NOT NULL,
    error text,
    input_tokens integer,
    output_tokens integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    verdict_state text DEFAULT 'not_measured'::text NOT NULL,
    verdict_passed boolean,
    verdict_score integer,
    verdict_reason text,
    judge_model text,
    duration_ms integer,
    case_feedback text,
    org_id uuid NOT NULL,
    CONSTRAINT eval_results_status_check CHECK ((status = ANY (ARRAY['completed'::text, 'failed'::text, 'timed_out'::text, 'cancelled'::text]))),
    CONSTRAINT eval_results_variant_check CHECK ((variant = ANY (ARRAY['with_skill'::text, 'without_skill'::text]))),
    CONSTRAINT eval_results_verdict_state_check CHECK ((verdict_state = ANY (ARRAY['graded'::text, 'not_measured'::text, 'judge_error'::text])))
);


--
-- Name: TABLE eval_results; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.eval_results IS 'One row per (test_case × variant) for an eval run (EVAL-02, D-08). variant is a CHECK-constrained with_skill/without_skill discriminator (D-04). Carries provider+model (D-02 — provider-keyed even though the run is single-provider, so multi-provider fan-out is additive). output holds the full final content; survives Redis TTL + a backend restart (D-06 / SC#3). test_case_id FKs skill_test_cases.id for exact case traceability (Phase-132 D-10); Phase 134 ratings FK eval_results.id (keep PK stable). Owner-only RLS SELECT defense-in-depth; service-role writes (bypasses RLS), app-code .eq("user_id") is the real gate (T-133-01). NO write policies (T-133-EoP).';


--
-- Name: COLUMN eval_results.verdict_state; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.eval_results.verdict_state IS 'OQ1 3-value verdict discriminator (D-06). graded = the judge ran and returned a verdict; not_measured = the arm errored/was empty and the judge was NEVER called (D-04); judge_error = the arm completed but the judge call itself failed. NOT NULL DEFAULT ''not_measured'' backfills the old Phase 133 rows to not_measured — accurate, they were never graded. verdict_passed/score are NULL unless graded (a not_measured/judge_error arm carrying a non-NULL verdict_passed is a bug).';


--
-- Name: COLUMN eval_results.duration_ms; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.eval_results.duration_ms IS 'EVAL-05e per-arm wall-clock in milliseconds (time.monotonic around the agent loop). NULL on pre-085 rows and on arms that never timed. Persisted in the SAME insert as the result row (never a follow-up UPDATE), alongside input_tokens / output_tokens.';


--
-- Name: COLUMN eval_results.case_feedback; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.eval_results.case_feedback IS 'EVAL-05d advisory judge critique of the TEST CASE itself (is the case weak / non-discriminating / ambiguous?). Written from the schema-bound JudgeVerdict.case_feedback field. NEVER a verdict, NEVER a gate input, NEVER counted in rollup math — it renders visually distinct from PASS/FAIL. NULL on pre-085 rows and un-graded arms.';


--
-- Name: COLUMN eval_results.org_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.eval_results.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.4; no FK until backfill/RLS (Phase 162/163).';


--
-- Name: eval_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.eval_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    skill_id uuid,
    skill_version_id uuid,
    user_id uuid NOT NULL,
    provider text NOT NULL,
    model text NOT NULL,
    status text DEFAULT 'running'::text NOT NULL,
    case_count integer DEFAULT 0 NOT NULL,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    passed_count integer,
    measured_count integer,
    verdict_summary text,
    matrix_group_id uuid,
    feeds_gate boolean DEFAULT false NOT NULL,
    org_id uuid NOT NULL,
    CONSTRAINT eval_runs_status_check CHECK ((status = ANY (ARRAY['running'::text, 'completed'::text, 'failed'::text, 'cancelled'::text, 'interrupted'::text])))
);


--
-- Name: TABLE eval_runs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.eval_runs IS 'One durable row per eval run (EVAL-02, D-08). Single provider/model per run (D-01) — provider/model live here. status is a durable run-audit enum (035 precedent): a backend that dies mid-run leaves a recoverable running/interrupted row (D-06 / SC#3). id doubles as the stream run_id (companion public.runs row uses the same UUID). skill_version_id FKs skill_versions.id for exact instruction-snapshot traceability (Phase-132 D-10). Owner-only RLS SELECT is defense-in-depth; the service-role eval task writes (bypasses RLS) and the app-code .eq("user_id") filter is the real gate (T-133-01). NO write policies — only the service-role task writes (T-133-EoP).';


--
-- Name: COLUMN eval_runs.verdict_summary; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.eval_runs.verdict_summary IS 'NON-AUTHORITATIVE default rollup (OQ2, D-07). Default rule: "pass" iff measured_count >= 1 AND passed_count == measured_count, else "fail". This is DERIVED TEXT, not a hard constraint — Phase 136 (GATE-01) owns the real publish threshold and MUST be able to override it WITHOUT a new migration. passed_count/measured_count count WITH-SKILL arms only (D-02/D-07); the without-skill verdict is stored per-arm for the A/B story + SI-01, not as a rollup denominator.';


--
-- Name: COLUMN eval_runs.matrix_group_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.eval_runs.matrix_group_id IS 'D-06 matrix grouping. The shared uuid identity for the N single-provider arms of one matrix run; NULL for a single run (pre-085 rows backfill NULL — accurate, they were never matrix runs). Indexed (idx_eval_runs_matrix_group_id) for the group readout.';


--
-- Name: COLUMN eval_runs.feeds_gate; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.eval_runs.feeds_gate IS 'D-05 gate-feeder flag. Exactly ONE arm per matrix_group_id is TRUE (default = the user''s active provider); single runs and every pre-085 row are false and their publish-gate read is UNCHANGED. The "feeds gate" chip is a LABEL on this flag — NEVER a second gate computation.';


--
-- Name: COLUMN eval_runs.org_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.eval_runs.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.4; no FK until backfill/RLS (Phase 162/163).';


--
-- Name: folders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.folders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    parent_id uuid,
    is_org_shared boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid NOT NULL
);


--
-- Name: COLUMN folders.org_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.folders.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.3; no FK until org schema exists.';


--
-- Name: harness_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.harness_audit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    run_id uuid,
    event_type text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    org_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT harness_audit_event_type_check CHECK ((event_type = ANY (ARRAY['phase_started'::text, 'phase_completed'::text, 'phase_transition'::text, 'gate_passed'::text, 'gate_failed'::text, 'tool_refused'::text, 'run_started'::text, 'run_completed'::text, 'run_failed'::text, 'emit_forced'::text, 'emit_recovered'::text, 'emit_validated'::text, 'emit_rejected'::text, 'emit_rendered'::text, 'emit_integrity_failed'::text, 'emit_failed'::text, 'judge_verdict'::text, 'publish_attempted'::text, 'publish_blocked'::text, 'publish_succeeded'::text, 'policy_applied'::text, 'validator_ask_user_approved'::text, 'action_risk_pending'::text, 'external_action_sent'::text, 'circuit_breaker_tripped'::text])))
);


--
-- Name: COLUMN harness_audit.org_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.harness_audit.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v2.8; no FK until org schema exists; RLS stays user-scoped.';


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
    org_id uuid NOT NULL,
    CONSTRAINT message_feedback_rating_check CHECK (((rating)::text = ANY ((ARRAY['positive'::character varying, 'negative'::character varying])::text[]))),
    CONSTRAINT message_feedback_reason_check CHECK (((reason)::text = ANY ((ARRAY['wrong_answer'::character varying, 'not_from_documents'::character varying, 'incomplete'::character varying, 'other'::character varying])::text[])))
);


--
-- Name: COLUMN message_feedback.org_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.message_feedback.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.4; no FK until backfill/RLS (Phase 162/163).';


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
    reasoning_content text,
    origin text DEFAULT 'deep'::text NOT NULL,
    org_id uuid NOT NULL,
    CONSTRAINT messages_origin_check CHECK ((origin = ANY (ARRAY['deep'::text, 'harness'::text]))),
    CONSTRAINT messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text, 'system'::text])))
);

ALTER TABLE ONLY public.messages REPLICA IDENTITY FULL;


--
-- Name: COLUMN messages.tool_calls; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.messages.tool_calls IS 'JSONB array. For role=system rows, first element may carry a "kind" discriminator: context_truncated | iteration_cap_dropped_tool_calls (Phase 075.4) | ask_user_prompt | ask_user_response (Phase 085).';


--
-- Name: COLUMN messages.org_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.messages.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.4; no FK until backfill/RLS (Phase 162/163).';


--
-- Name: metadata_field_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.metadata_field_definitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    org_id uuid NOT NULL,
    field_key text NOT NULL,
    field_type text DEFAULT 'string'::text NOT NULL,
    description text,
    is_system_global boolean DEFAULT false NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    options jsonb,
    CONSTRAINT mfd_reachable CHECK (((user_id IS NOT NULL) OR (is_system_global = true)))
);


--
-- Name: COLUMN metadata_field_definitions.org_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.metadata_field_definitions.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v2.8; no FK until org schema exists; RLS stays user-scoped.';


--
-- Name: model_capabilities_overrides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.model_capabilities_overrides (
    model_id text NOT NULL,
    provider text NOT NULL,
    llm_call_timeout_seconds integer,
    context_window_tokens integer,
    max_output_tokens integer,
    native_tools boolean,
    enabled boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deprecated boolean DEFAULT false NOT NULL,
    deprecated_reason text,
    emit_tier text,
    CONSTRAINT model_capabilities_overrides_emit_tier_check CHECK (((emit_tier IS NULL) OR (emit_tier = ANY (ARRAY['force_strict'::text, 'force'::text, 'coerce'::text]))))
);


--
-- Name: COLUMN model_capabilities_overrides.emit_tier; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.model_capabilities_overrides.emit_tier IS 'Phase 196 (AUTH-04 / D-14). The forced-emission tier an OPERATOR asserts for this model, overlaid over the code registry by config.get_model_capability_async. NULL means "not tracked here" and is the shipped state for all 37 pre-120 rows — forced_emit.py then applies its read-time cap.get("emit_tier", "coerce") default, so NULL is byte-identical to today. The CHECK vocabulary is pinned EQUAL to set(_RUNGS_BY_TIER) in backend/app/services/forced_emit.py and to _MODEL_CAP_ENUM_COLUMNS["emit_tier"] in backend/app/api/admin.py by backend/tests/unit/test_196_emit_tier_two_layer_pin.py. A tier this CHECK accepted but the ladder rejected would be rewritten to "coerce" by the boundary guard at forced_emit.py:377 and the run would degrade SILENTLY — hence the closed set. D-122-04 still holds: emit_tier is the single source of truth; forced_emission and strict_json_schema are DEPRECATED-UNREAD and no derived view may re-read them.';


--
-- Name: operator_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.operator_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    operator_user_id uuid NOT NULL,
    action text NOT NULL,
    label text NOT NULL,
    is_write boolean DEFAULT false NOT NULL,
    target_type text,
    target_id text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    org_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN operator_audit_log.org_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.operator_audit_log.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.3; no FK until org schema exists.';


--
-- Name: operator_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.operator_users (
    user_id uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_by uuid,
    note text
);


--
-- Name: org_invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    email text NOT NULL,
    role text NOT NULL,
    token_hash text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    invited_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT org_invitations_role_check CHECK ((role = ANY (ARRAY['super-admin'::text, 'org-admin'::text, 'dept-admin'::text, 'member'::text]))),
    CONSTRAINT org_invitations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'expired'::text, 'revoked'::text])))
);


--
-- Name: org_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT org_members_role_check CHECK ((role = ANY (ARRAY['super-admin'::text, 'org-admin'::text, 'dept-admin'::text, 'member'::text])))
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text,
    subscription_tier text,
    add_ons jsonb DEFAULT '{}'::jsonb NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN organizations.add_ons; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organizations.add_ons IS 'D-01 / ENT-01 entitlements + feature-flags (STRETCH 170). SEPARATE from settings.';


--
-- Name: COLUMN organizations.settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organizations.settings IS 'D-01 / SEED-120 forward-compat home: per-org provider config / BYO keys / model selection land here as keys in v3.5 with NO schema rewrite (BYO values reuse the SEC-01 enc:v1: envelope). SEPARATE from add_ons.';


--
-- Name: pdf_extraction_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pdf_extraction_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    user_id uuid NOT NULL,
    engine text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    duration_ms integer,
    table_count integer,
    image_count integer,
    error text,
    org_id uuid NOT NULL
);


--
-- Name: COLUMN pdf_extraction_runs.org_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pdf_extraction_runs.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.4; no FK until backfill/RLS (Phase 162/163).';


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
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    role text NOT NULL,
    permission_key text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    role text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
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
    spawned_by_worker text,
    parent_run_id uuid,
    continues_used integer DEFAULT 0 NOT NULL,
    org_id uuid NOT NULL,
    CONSTRAINT runs_status_check CHECK ((status = ANY (ARRAY['streaming'::text, 'cap_paused'::text, 'completed'::text, 'failed'::text, 'cancelled'::text, 'timed_out'::text])))
);


--
-- Name: COLUMN runs.spawned_by_worker; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.runs.spawned_by_worker IS 'OS PID of the uvicorn worker that INSERTed this run. Populated at INSERT time (Phase 079). NULL for pre-079 runs.';


--
-- Name: COLUMN runs.continues_used; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.runs.continues_used IS 'D-06: Continue cap counter, max 3/run (Deep-run cap). Durable (WORKER_COUNT=2).';


--
-- Name: COLUMN runs.org_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.runs.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.4; no FK until backfill/RLS (Phase 162/163).';


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
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid NOT NULL
);


--
-- Name: COLUMN sandbox_files.org_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sandbox_files.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.4; no FK until backfill/RLS (Phase 162/163).';


--
-- Name: skill_embeddings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.skill_embeddings (
    skill_id uuid NOT NULL,
    user_id uuid NOT NULL,
    embedding public.vector(1536),
    embedding_model text,
    embedding_dimensions integer,
    source_text_hash text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid NOT NULL
);


--
-- Name: TABLE skill_embeddings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.skill_embeddings IS 'One embedding row per skill (TRIG-02, Phase 140). Sibling to skills, mirroring documents→document_chunks (mig 002) but with NO ANN index (skills are tens–hundreds of rows). Ships EMPTY (SQL cannot call the embedding API) — the skill_embedding_service backfill job (Plan 02) populates it; absence of a row == D-05 fail-open. Owner-only RLS (defense-in-depth); the service-role backfill writer bypasses RLS and hand-scopes .eq("user_id", …) (V4). embedding_model is the D-10 stale-model tag; source_text_hash is a non-crypto staleness fingerprint.';


--
-- Name: COLUMN skill_embeddings.org_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.skill_embeddings.org_id IS 'TEN-04 (Phase 163): denormalized from skills.org_id via skill_id. NOT NULL. RLS (mig 108) filters this directly.';


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
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid NOT NULL
);


--
-- Name: COLUMN skill_files.org_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.skill_files.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.4; no FK until backfill/RLS (Phase 162/163).';


--
-- Name: skill_proposals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.skill_proposals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    skill_id uuid NOT NULL,
    base_skill_version_id uuid NOT NULL,
    new_skill_version_id uuid,
    re_eval_run_id uuid,
    source_eval_run_id uuid,
    user_id uuid NOT NULL,
    proposed_instructions text,
    rationale text DEFAULT ''::text NOT NULL,
    evidence_summary text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'proposed'::text NOT NULL,
    override_forced boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    kind text DEFAULT 'instruction'::text NOT NULL,
    proposed_description text,
    scoreboard_snapshot jsonb,
    source_tuner_run_id uuid,
    org_id uuid NOT NULL,
    CONSTRAINT skill_proposals_kind_check CHECK ((kind = ANY (ARRAY['instruction'::text, 'description'::text]))),
    CONSTRAINT skill_proposals_kind_fields CHECK ((((kind = 'instruction'::text) AND (proposed_instructions IS NOT NULL) AND (proposed_description IS NULL)) OR ((kind = 'description'::text) AND (proposed_description IS NOT NULL) AND (proposed_instructions IS NULL)))),
    CONSTRAINT skill_proposals_status_check CHECK ((status = ANY (ARRAY['proposed'::text, 'rejected'::text, 'approved'::text, 're_evaling'::text, 'promoted'::text, 'not_promoted'::text, 'interrupted'::text])))
);


--
-- Name: TABLE skill_proposals; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.skill_proposals IS 'One durable row per proposed skill-instruction edit (SI-01, D-07). proposed_instructions + rationale + evidence_summary + the 7-value lifecycle status (proposed/rejected/approved/re_evaling/promoted/not_promoted/interrupted). base_skill_version_id (NOT NULL) is what the diff is against; new_skill_version_id is INSERTed ONLY on approval (source=''self_improve'', Plan 05) so skill_versions history stays clean of unapproved drafts; rejections keep their audit trail here with new_skill_version_id NULL. source_eval_run_id = the run whose evidence drove the proposal (D-13 baseline); re_eval_run_id = the auto re-eval (D-12, Phase 136 can consume). override_forced records a D-06 force-promote-with-evidence. Owner-only RLS SELECT is defense-in-depth; the service-role SI-01 router writes (bypasses RLS) and the app-code .eq("user_id") filter is the real gate (T-135-07). NO write policies — only the service-role router writes (T-135-01).';


--
-- Name: COLUMN skill_proposals.kind; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.skill_proposals.kind IS 'Discriminator (SI-02, D-11): ''instruction'' (SI-01 loop — proposed_instructions set) or ''description'' (SI-02 Trigger-Tuner-winner loop — proposed_description set). Enforced together with the presence invariant by the skill_proposals_kind_fields CHECK. Defaults ''instruction'' so pre-existing rows backfill correctly.';


--
-- Name: COLUMN skill_proposals.proposed_description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.skill_proposals.proposed_description IS 'The proposed skill DESCRIPTION (SI-02) — the held-out per-provider WINNING description snapshotted from a Trigger Tuner run at propose-time. NULL for kind=''instruction'' rows. On approval it is written to skills.description (the 079/132 trigger versions it — no draft INSERT, no re-eval; D-07).';


--
-- Name: COLUMN skill_proposals.scoreboard_snapshot; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.skill_proposals.scoreboard_snapshot IS 'IMMUTABLE proposed-vs-current per-provider scoreboard cells, COPIED inline at propose-time (SI-02, RESEARCH Pitfall 1). This — NOT source_tuner_run_id — is the evidence the proposal card renders, because tuner_runs is a latest-wins singleton (UNIQUE(skill_id)) that mutates on re-run.';


--
-- Name: COLUMN skill_proposals.source_tuner_run_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.skill_proposals.source_tuner_run_id IS 'PROVENANCE-ONLY FK to the tuner_runs row that produced this description proposal (ON DELETE SET NULL). The displayed evidence is scoreboard_snapshot (copied inline); this FK is audit lineage only and MUST NOT be read live for the scoreboard — the tuner_runs row is overwritten latest-wins on every re-run (RESEARCH Pitfall 1, Pattern 1).';


--
-- Name: COLUMN skill_proposals.org_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.skill_proposals.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.4; no FK until backfill/RLS (Phase 162/163).';


--
-- Name: CONSTRAINT skill_proposals_kind_fields ON skill_proposals; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT skill_proposals_kind_fields ON public.skill_proposals IS 'Kind-gated presence invariant (SI-02): an ''instruction'' row has proposed_instructions and no proposed_description; a ''description'' row has proposed_description and no proposed_instructions. DB-level integrity gate below the route validation (T-139-02).';


--
-- Name: skill_publish_overrides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.skill_publish_overrides (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    skill_id uuid NOT NULL,
    skill_version_id uuid,
    user_id uuid NOT NULL,
    gate_state text NOT NULL,
    gate_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid NOT NULL
);


--
-- Name: TABLE skill_publish_overrides; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.skill_publish_overrides IS 'One APPEND-ONLY row per skill force-publish past an unmet publish gate (GATE-01, D-01/D-02). gate_state = what the gate read at the moment of override (never_evaled/latest_failed/passed_on_older_version); gate_snapshot = the honest counts jsonb; created_at = the when. skill_version_id (nullable, SET NULL) pins which version was live when overridden. The gate compute reads the most-recent row per skill as PublishGate.last_override so the eval surface shows an honest "published without passing eval" status (D-02/D-06). Owner-only RLS SELECT is defense-in-depth; the service-role toggle handler writes (bypasses RLS) and the app-code .eq("user_id") filter is the real gate (T-136-04). NO write policies — clients can never forge, mutate, or delete an override record (035/079/080/081/083 precedent).';


--
-- Name: COLUMN skill_publish_overrides.org_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.skill_publish_overrides.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.4; no FK until backfill/RLS (Phase 162/163).';


--
-- Name: skill_test_cases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.skill_test_cases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    skill_id uuid NOT NULL,
    user_id uuid NOT NULL,
    prompt text NOT NULL,
    expected_behavior text DEFAULT ''::text NOT NULL,
    order_index integer DEFAULT 0 NOT NULL,
    name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid NOT NULL
);


--
-- Name: TABLE skill_test_cases; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.skill_test_cases IS 'Editable eval test cases (EVAL-01, D-05). Bind to the SKILL via skill_id (NOT a version) so cases stay freely editable/deletable before any run (D-07). expected_behavior is free text, NOT an assertion (D-06); NO provider/model columns (D-08). Owner-only RLS (D-12). Stable id is the Phase 133 results FK target (D-10).';


--
-- Name: COLUMN skill_test_cases.org_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.skill_test_cases.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.4; no FK until backfill/RLS (Phase 162/163).';


--
-- Name: skill_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.skill_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    skill_id uuid NOT NULL,
    user_id uuid NOT NULL,
    version_number integer NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    instructions text DEFAULT ''::text NOT NULL,
    source text DEFAULT 'manual'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid NOT NULL,
    CONSTRAINT skill_versions_source_check CHECK ((source = ANY (ARRAY['manual'::text, 'import'::text, 'tuner'::text, 'self_improve'::text, 'backfill'::text])))
);


--
-- Name: TABLE skill_versions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.skill_versions IS 'Per-skill APPEND-ONLY version history (VER-01, D-01/D-03). One row captured per skill content save (name/description/instructions) by the AFTER INSERT OR UPDATE trigger on public.skills; toggles (is_enabled/is_org_shared) capture NO version (D-02). Immutable (BEFORE UPDATE block trigger, 23514) but cascades on skill delete (D-03-R2). user_id sourced from NEW.user_id, NEVER auth.uid() (NULL under service-role, T-132-03). RLS is owner-only defense-in-depth (D-12); the app-code owner filter is the real runtime gate (service-role bypasses RLS). Distinct from the workflow-scoped skill_snapshots table (D-04). Stable id is the Phase 133 FK target (D-10).';


--
-- Name: COLUMN skill_versions.org_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.skill_versions.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.4; no FK until backfill/RLS (Phase 162/163).';


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
    is_org_shared boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    org_id uuid NOT NULL
);


--
-- Name: COLUMN skills.org_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.skills.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.3; no FK until org schema exists.';


--
-- Name: sso_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sso_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    email_domain text,
    provider_id text,
    attribute_mapping jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'pending_approval'::text NOT NULL,
    approved_by uuid,
    approved_at timestamp with time zone,
    CONSTRAINT sso_configs_status_check CHECK ((status = ANY (ARRAY['pending_approval'::text, 'active'::text, 'disabled'::text])))
);


--
-- Name: COLUMN sso_configs.provider_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sso_configs.provider_id IS 'D-07: nullable pointer to the Supabase-owned SSO provider id (auth.sso_providers). NO FK into the Supabase auth schema.';


--
-- Name: threads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.threads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text DEFAULT 'New Chat'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    folder_id uuid,
    active_workflow_run_id uuid,
    is_eval boolean DEFAULT false NOT NULL,
    org_id uuid NOT NULL
);


--
-- Name: COLUMN threads.org_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.threads.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.3; no FK until org schema exists.';


--
-- Name: todos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.todos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    thread_id uuid NOT NULL,
    todo_id text NOT NULL,
    content text NOT NULL,
    status text NOT NULL,
    parent_id text,
    order_index integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid NOT NULL,
    CONSTRAINT todos_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text])))
);


--
-- Name: COLUMN todos.org_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.todos.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.4; no FK until backfill/RLS (Phase 162/163).';


--
-- Name: tuner_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tuner_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    skill_id uuid NOT NULL,
    user_id uuid NOT NULL,
    run_id uuid NOT NULL,
    scoreboard jsonb DEFAULT '{}'::jsonb NOT NULL,
    builder_model text DEFAULT ''::text NOT NULL,
    target_count integer DEFAULT 0 NOT NULL,
    case_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid NOT NULL
);


--
-- Name: TABLE tuner_runs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tuner_runs IS 'Durable latest-per-skill Skill Trigger Tuner result (D-07). Exactly one row per skill (UNIQUE(skill_id) — upsert on_conflict=skill_id overwrites latest-wins). user_id = whoever last ran it; for a GLOBAL skill the SELECT-by-skill is identical for all global viewers (user_id is the last-runner attribution, NOT an access gate — T-123.1-05). Companion to the ephemeral Redis tuner_result:{run_id} stash — survives a Redis flush.';


--
-- Name: COLUMN tuner_runs.org_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tuner_runs.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.4; no FK until backfill/RLS (Phase 162/163).';


--
-- Name: user_memory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_memory (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    key text NOT NULL,
    value text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid NOT NULL
);


--
-- Name: COLUMN user_memory.org_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_memory.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.4; no FK until backfill/RLS (Phase 162/163).';


--
-- Name: user_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_settings (
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    preferences jsonb DEFAULT '{}'::jsonb,
    org_id uuid NOT NULL
);


--
-- Name: COLUMN user_settings.org_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_settings.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.4; no FK until backfill/RLS (Phase 162/163).';


--
-- Name: workflow_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_definitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    definition jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid NOT NULL,
    is_system_global boolean DEFAULT false NOT NULL,
    org_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    skill_snapshots jsonb,
    CONSTRAINT workflow_definitions_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text])))
);


--
-- Name: COLUMN workflow_definitions.org_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workflow_definitions.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v2.8; no FK until org schema exists; RLS stays user-scoped.';


--
-- Name: COLUMN workflow_definitions.skill_snapshots; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workflow_definitions.skill_snapshots IS 'Phase 099 D-03a materialization state (derived at FIRST kickoff), NOT authored content. Keyed by phase slug -> SkillSnapshot JSON. EXCLUDED from the immutable-on-publish guarantee (the amended block-published trigger lets a published row change ONLY this column). Nullable, no default; NULL until first kickoff materializes the referenced skills.';


--
-- Name: workflow_phases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_phases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workflow_run_id uuid NOT NULL,
    phase_index integer NOT NULL,
    slug text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    output jsonb DEFAULT '{}'::jsonb NOT NULL,
    org_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    CONSTRAINT workflow_phases_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'completed'::text, 'failed'::text, 'skipped'::text, 'recorded_not_sent'::text, 'cancelled'::text])))
);


--
-- Name: COLUMN workflow_phases.org_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workflow_phases.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v2.8; no FK until org schema exists; RLS stays user-scoped.';


--
-- Name: COLUMN workflow_phases.started_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workflow_phases.started_at IS 'Phase 200 (DES-02 / D-05): the instant this phase flipped to active, written ONCE by mark_phase_active (backend/app/db/workflows.py:1441) BEFORE any of the phase''s work runs. NULLABLE and NOT BACKFILLED (D-06): a pre-200 row keeps NULL forever, which reads "time not recorded" — distinct from "never ran". A backfill from updated_at is right for some rows and silently wrong for others, and nothing on the row would say which. created_at cannot substitute: every phase row of a run is batch-INSERTed together at run creation.';


--
-- Name: COLUMN workflow_phases.completed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workflow_phases.completed_at IS 'Phase 200 (DES-02 / D-05): the instant this phase reached a terminal status. Written at FIVE sites in backend/app/db/workflows.py — complete_phase (:1483), fail_phase (:1505), record_phase_not_sent (:1548), cancel_phase (:1597) and cancel_active_phases (:1649, the run-keyed engineless-Stop arm 194 built, whose AND status = ''active'' predicate means it only moves rows that already carry a started_at). skip_phase (:1517) writes NEITHER column deliberately — a skipped phase never ran. NULLABLE and NOT BACKFILLED (D-06).';


--
-- Name: workflow_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    thread_id uuid NOT NULL,
    definition_id uuid NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    current_phase_id uuid,
    org_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    claimed_at timestamp with time zone,
    inputs jsonb DEFAULT '{}'::jsonb NOT NULL,
    model text,
    continues_used integer DEFAULT 0 NOT NULL,
    user_id uuid,
    is_golden_run boolean DEFAULT false,
    definition_snapshot jsonb,
    metadata jsonb,
    CONSTRAINT workflow_runs_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'cap_paused'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])))
);


--
-- Name: COLUMN workflow_runs.org_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workflow_runs.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v2.8; no FK until org schema exists; RLS stays user-scoped.';


--
-- Name: COLUMN workflow_runs.claimed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workflow_runs.claimed_at IS 'Resume CAS lease (Phase 091 CR-01): the startup sweep stamps now() when it wins the claim_run CAS so a racing WORKER_COUNT=2 sibling matches 0 rows and skips. Re-claimable once the lease (engine constant, default 5 min) expires. Orthogonal to status; NULL = never claimed.';


--
-- Name: COLUMN workflow_runs.inputs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workflow_runs.inputs IS 'SEED-047: kickoff inputs persisted at creation for resume rehydration (top-level programmatic inputs + kickoff_prompt). Defaults to {} for legacy rows.';


--
-- Name: COLUMN workflow_runs.model; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workflow_runs.model IS 'SEED-047: resolved model at run creation, rehydrated into the resume ctx so resumed llm_* phases do not run with an empty model. Nullable — older rows have none.';


--
-- Name: COLUMN workflow_runs.continues_used; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workflow_runs.continues_used IS 'D-06: Continue cap counter, max 3/run. Durable (WORKER_COUNT=2) — the Continue-handling worker may differ from the one that hit the cap.';


--
-- Name: COLUMN workflow_runs.user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workflow_runs.user_id IS '092-05 F1: run-owner (server-side current_user at creation). Sourced into harness_audit.user_id (NOT NULL) on every audit write and into the      
  resume ctx (_build_resume_context). FK -> auth.users ON DELETE CASCADE. Nullable for legacy rows; new inserts always supply it.';


--
-- Name: COLUMN workflow_runs.is_golden_run; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workflow_runs.is_golden_run IS 'Phase 102 QUAL-01 (D-05). True = a publish-time validation run (real engine, real KB, judge-graded). Excluded from ordinary run history/listings. Default false (every pre-102 + ordinary run byte-identical).';


--
-- Name: COLUMN workflow_runs.definition_snapshot; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workflow_runs.definition_snapshot IS 'Phase 200 follow-on: the WorkflowDefinition this run actually executed, serialized from the same in-memory object that produced this run''s workflow_phases rows, in the same transaction (backend/app/db/workflows.py:create_workflow_run). It exists because workflow_definitions.definition is MUTABLE while status = ''draft'': measured 2026-08-20, 21 of 228 runs point at a draft, 14 of those drafts were edited after their run, and on 2 the phase ORDER changed so the run page''s phase_index join reported each step''s state as its neighbour''s. NULLABLE and NOT BACKFILLED: a pre-122 run keeps NULL and the read path falls back to the live definition row, which is the current behaviour including its crossing risk. A backfill would store a document the run never executed for exactly the rows that motivated the column. Stored as a jsonb OBJECT, never a JSON string scalar - the shape workflow_definitions.definition has, which makes ->''phases'' return NULL instead of erroring.';


--
-- Name: COLUMN workflow_runs.metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workflow_runs.metadata IS 'Phase 204 (SCHED-02): run-level operational metadata. Today it carries exactly one key, "circuit_breaker", written by CircuitBreaker.trip_breaker with the trip reason and the exact token/timing measurements. Merged with ||, never replaced.';


--
-- Name: workflow_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    workflow_id uuid NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    cron_expression text,
    interval_seconds integer,
    timezone text DEFAULT 'UTC'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    max_tokens_per_run integer DEFAULT 50000 NOT NULL,
    max_duration_seconds integer DEFAULT 600 NOT NULL,
    inputs jsonb DEFAULT '{}'::jsonb NOT NULL,
    last_run_at timestamp with time zone,
    next_run_at timestamp with time zone,
    last_status text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT schedule_cadence_exactly_one CHECK ((((cron_expression IS NOT NULL) AND (interval_seconds IS NULL)) OR ((cron_expression IS NULL) AND (interval_seconds IS NOT NULL)))),
    CONSTRAINT schedule_duration_cap_positive CHECK ((max_duration_seconds > 0)),
    CONSTRAINT schedule_interval_floor CHECK (((interval_seconds IS NULL) OR (interval_seconds >= 60))),
    CONSTRAINT schedule_token_cap_positive CHECK ((max_tokens_per_run > 0))
);


--
-- Name: COLUMN workflow_schedules.timezone; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workflow_schedules.timezone IS 'The IANA zone the cron expression is READ IN (D-204-10). Interval schedules ignore it entirely — an interval is a duration, and a duration has no timezone. Defaults to UTC; an unrecognised zone is rejected at the API boundary, because the run must fire where the author expects rather than where the server happens to sit.';


--
-- Name: COLUMN workflow_schedules.inputs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workflow_schedules.inputs IS 'The kickoff inputs each unattended run is launched with (the same shape workflow_runs.inputs carries, e.g. a kickoff_prompt key). Written as a jsonb OBJECT, never a JSON string scalar: the asyncpg pool registers a jsonb codec (dependencies.py _init_pg_connection), so a call site that pre-encodes with json.dumps stores a STRING and every arrow read then returns NULL. That defect shipped on 484 of 484 workflow_phases.output rows and was repaired by migration 123 — do not reintroduce it here.';


--
-- Name: COLUMN workflow_schedules.next_run_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workflow_schedules.next_run_at IS 'The claim key. The poller reads WHERE is_active AND next_run_at <= now() FOR UPDATE SKIP LOCKED and ADVANCES this column inside the SAME transaction that claims the row — which is what makes a duplicate firing impossible across uvicorn workers (D-204-09). NULL means never computed: such a row is invisible to the poller and will never fire, so every writer must set it.';


--
-- Name: COLUMN workflow_schedules.last_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workflow_schedules.last_status IS 'A HINT for the schedule list, never an authorization or control input: the terminal status of the most recent run this schedule launched, or launch_failed when the launch itself raised. NULL = has never run.';


--
-- Name: workspace_file_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_file_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_file_id uuid NOT NULL,
    version integer NOT NULL,
    content_inline bytea,
    content_storage_path text,
    size_bytes bigint DEFAULT 0 NOT NULL,
    delta_from_prev jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid NOT NULL
);


--
-- Name: COLUMN workspace_file_versions.org_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspace_file_versions.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.4; no FK until backfill/RLS (Phase 162/163).';


--
-- Name: workspace_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    thread_id uuid NOT NULL,
    path text NOT NULL,
    size_bytes bigint DEFAULT 0 NOT NULL,
    mime_type text DEFAULT 'application/octet-stream'::text NOT NULL,
    content_inline bytea,
    content_storage_path text,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    kind text,
    expires_at timestamp with time zone,
    run_claim text,
    org_id uuid NOT NULL,
    CONSTRAINT workspace_files_kind_check CHECK (((kind IS NULL) OR (kind = ANY (ARRAY['template_input'::text, 'agent'::text])))),
    CONSTRAINT workspace_files_path_length CHECK ((char_length(path) <= 500)),
    CONSTRAINT workspace_files_size_limit CHECK ((size_bytes <= 10485760))
);


--
-- Name: COLUMN workspace_files.kind; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspace_files.kind IS 'Phase 100 TMPL-01. NULL/''agent'' = agent-written (permanent, byte-identical to pre-100). ''template_input'' = user-uploaded ephemeral template (TTL-bound).';


--
-- Name: COLUMN workspace_files.expires_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspace_files.expires_at IS 'Phase 100 TMPL-01. NULL = never expires (agent files). Non-NULL = read-path filter excludes the row once now() passes it (D-06); the lifespan sweep GCs row + Storage bytes (D-07); kickoff run-pin extends it to cover the run (D-09).';


--
-- Name: COLUMN workspace_files.run_claim; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspace_files.run_claim IS 'Phase 141 (COLL-02). Run-context claim lineage for kind=''template_input'' rows: str(workflow_run_id) for a workflow phase, the ''deep'' sentinel for a Deep turn, NULL = unclaimed. Server-set on first resolve; the ''deep'' sentinel makes the cross-context block symmetric. Nullable, no default, no backfill (D-141-02/04).';


--
-- Name: COLUMN workspace_files.org_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspace_files.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.4; no FK until backfill/RLS (Phase 162/163).';


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
-- Name: checked_queries checked_queries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checked_queries
    ADD CONSTRAINT checked_queries_pkey PRIMARY KEY (id);


--
-- Name: classification_rules classification_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classification_rules
    ADD CONSTRAINT classification_rules_pkey PRIMARY KEY (id);


--
-- Name: code_executions code_executions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.code_executions
    ADD CONSTRAINT code_executions_pkey PRIMARY KEY (id);


--
-- Name: connector_connections connector_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connector_connections
    ADD CONSTRAINT connector_connections_pkey PRIMARY KEY (id);


--
-- Name: connector_tokens connector_tokens_connection_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connector_tokens
    ADD CONSTRAINT connector_tokens_connection_id_key UNIQUE (connection_id);


--
-- Name: connector_tokens connector_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connector_tokens
    ADD CONSTRAINT connector_tokens_pkey PRIMARY KEY (id);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: dept_members dept_members_dept_user_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dept_members
    ADD CONSTRAINT dept_members_dept_user_unique UNIQUE (dept_id, user_id);


--
-- Name: dept_members dept_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dept_members
    ADD CONSTRAINT dept_members_pkey PRIMARY KEY (id);


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
-- Name: document_relationships document_relationships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_relationships
    ADD CONSTRAINT document_relationships_pkey PRIMARY KEY (id);


--
-- Name: document_tables document_tables_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_tables
    ADD CONSTRAINT document_tables_pkey PRIMARY KEY (id);


--
-- Name: document_views document_views_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_views
    ADD CONSTRAINT document_views_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: eval_ratings eval_ratings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_ratings
    ADD CONSTRAINT eval_ratings_pkey PRIMARY KEY (id);


--
-- Name: eval_ratings eval_ratings_result_user_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_ratings
    ADD CONSTRAINT eval_ratings_result_user_unique UNIQUE (eval_result_id, user_id);


--
-- Name: eval_results eval_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_results
    ADD CONSTRAINT eval_results_pkey PRIMARY KEY (id);


--
-- Name: eval_runs eval_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_runs
    ADD CONSTRAINT eval_runs_pkey PRIMARY KEY (id);


--
-- Name: folders folders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folders
    ADD CONSTRAINT folders_pkey PRIMARY KEY (id);


--
-- Name: harness_audit harness_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.harness_audit
    ADD CONSTRAINT harness_audit_pkey PRIMARY KEY (id);


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
-- Name: metadata_field_definitions metadata_field_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metadata_field_definitions
    ADD CONSTRAINT metadata_field_definitions_pkey PRIMARY KEY (id);


--
-- Name: model_capabilities_overrides model_capabilities_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_capabilities_overrides
    ADD CONSTRAINT model_capabilities_overrides_pkey PRIMARY KEY (model_id);


--
-- Name: operator_audit_log operator_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operator_audit_log
    ADD CONSTRAINT operator_audit_log_pkey PRIMARY KEY (id);


--
-- Name: operator_users operator_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operator_users
    ADD CONSTRAINT operator_users_pkey PRIMARY KEY (user_id);


--
-- Name: org_invitations org_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_invitations
    ADD CONSTRAINT org_invitations_pkey PRIMARY KEY (id);


--
-- Name: org_members org_members_org_user_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_members
    ADD CONSTRAINT org_members_org_user_unique UNIQUE (org_id, user_id);


--
-- Name: org_members org_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_members
    ADD CONSTRAINT org_members_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_slug_key UNIQUE (slug);


--
-- Name: pdf_extraction_runs pdf_extraction_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdf_extraction_runs
    ADD CONSTRAINT pdf_extraction_runs_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role, permission_key);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (role);


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
-- Name: skill_embeddings skill_embeddings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_embeddings
    ADD CONSTRAINT skill_embeddings_pkey PRIMARY KEY (skill_id);


--
-- Name: skill_files skill_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_files
    ADD CONSTRAINT skill_files_pkey PRIMARY KEY (id);


--
-- Name: skill_proposals skill_proposals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_proposals
    ADD CONSTRAINT skill_proposals_pkey PRIMARY KEY (id);


--
-- Name: skill_publish_overrides skill_publish_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_publish_overrides
    ADD CONSTRAINT skill_publish_overrides_pkey PRIMARY KEY (id);


--
-- Name: skill_test_cases skill_test_cases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_test_cases
    ADD CONSTRAINT skill_test_cases_pkey PRIMARY KEY (id);


--
-- Name: skill_versions skill_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_versions
    ADD CONSTRAINT skill_versions_pkey PRIMARY KEY (id);


--
-- Name: skill_versions skill_versions_skill_num_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_versions
    ADD CONSTRAINT skill_versions_skill_num_unique UNIQUE (skill_id, version_number);


--
-- Name: skills skills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skills
    ADD CONSTRAINT skills_pkey PRIMARY KEY (id);


--
-- Name: sso_configs sso_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sso_configs
    ADD CONSTRAINT sso_configs_pkey PRIMARY KEY (id);


--
-- Name: threads threads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.threads
    ADD CONSTRAINT threads_pkey PRIMARY KEY (id);


--
-- Name: todos todos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.todos
    ADD CONSTRAINT todos_pkey PRIMARY KEY (id);


--
-- Name: todos todos_thread_todo_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.todos
    ADD CONSTRAINT todos_thread_todo_unique UNIQUE (thread_id, todo_id);


--
-- Name: tuner_runs tuner_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tuner_runs
    ADD CONSTRAINT tuner_runs_pkey PRIMARY KEY (id);


--
-- Name: tuner_runs tuner_runs_skill_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tuner_runs
    ADD CONSTRAINT tuner_runs_skill_unique UNIQUE (skill_id);


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
-- Name: workflow_definitions workflow_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_definitions
    ADD CONSTRAINT workflow_definitions_pkey PRIMARY KEY (id);


--
-- Name: workflow_definitions workflow_definitions_slug_version_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_definitions
    ADD CONSTRAINT workflow_definitions_slug_version_unique UNIQUE (slug, version);


--
-- Name: workflow_phases workflow_phases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_phases
    ADD CONSTRAINT workflow_phases_pkey PRIMARY KEY (id);


--
-- Name: workflow_runs workflow_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_runs
    ADD CONSTRAINT workflow_runs_pkey PRIMARY KEY (id);


--
-- Name: workflow_schedules workflow_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_schedules
    ADD CONSTRAINT workflow_schedules_pkey PRIMARY KEY (id);


--
-- Name: workspace_file_versions workspace_file_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_file_versions
    ADD CONSTRAINT workspace_file_versions_pkey PRIMARY KEY (id);


--
-- Name: workspace_files workspace_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_files
    ADD CONSTRAINT workspace_files_pkey PRIMARY KEY (id);


--
-- Name: workspace_files workspace_files_thread_path_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_files
    ADD CONSTRAINT workspace_files_thread_path_unique UNIQUE (thread_id, path);


--
-- Name: workspace_file_versions workspace_versions_file_version_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_file_versions
    ADD CONSTRAINT workspace_versions_file_version_unique UNIQUE (workspace_file_id, version);


--
-- Name: audit_log_user_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_user_created_idx ON public.audit_log USING btree (user_id, created_at DESC);


--
-- Name: departments_one_default_per_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX departments_one_default_per_org_idx ON public.departments USING btree (org_id) WHERE (is_default = true);


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
-- Name: document_relationships_idempotency_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX document_relationships_idempotency_idx ON public.document_relationships USING btree (user_id, source_doc_id, target_doc_id, rel_type);


--
-- Name: document_tables_document_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_tables_document_idx ON public.document_tables USING btree (document_id);


--
-- Name: documents_completed_hash_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX documents_completed_hash_unique_idx ON public.documents USING btree (user_id, content_hash) WHERE ((content_hash IS NOT NULL) AND (status = 'completed'::text));


--
-- Name: documents_dedup_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX documents_dedup_idx ON public.documents USING btree (user_id, content_hash, COALESCE(folder_id, '00000000-0000-0000-0000-000000000000'::uuid)) WHERE (status <> 'failed'::text);


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
-- Name: idx_audit_log_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_org_id ON public.audit_log USING btree (org_id);


--
-- Name: idx_checked_queries_org_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checked_queries_org_user ON public.checked_queries USING btree (org_id, user_id);


--
-- Name: idx_checked_queries_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checked_queries_user ON public.checked_queries USING btree (user_id);


--
-- Name: idx_classification_rules_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classification_rules_org_id ON public.classification_rules USING btree (org_id);


--
-- Name: idx_classification_rules_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classification_rules_user_id ON public.classification_rules USING btree (user_id);


--
-- Name: idx_code_executions_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_code_executions_org_id ON public.code_executions USING btree (org_id);


--
-- Name: idx_connector_connections_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connector_connections_created_by ON public.connector_connections USING btree (created_by);


--
-- Name: idx_connector_connections_org_capability; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connector_connections_org_capability ON public.connector_connections USING btree (org_id, capability);


--
-- Name: idx_connector_connections_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connector_connections_org_id ON public.connector_connections USING btree (org_id);


--
-- Name: idx_connector_connections_org_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connector_connections_org_service ON public.connector_connections USING btree (org_id, service_id);


--
-- Name: idx_connector_tokens_connection_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connector_tokens_connection_id ON public.connector_tokens USING btree (connection_id);


--
-- Name: idx_connector_tokens_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connector_tokens_expires_at ON public.connector_tokens USING btree (connection_id, expires_at);


--
-- Name: idx_departments_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_departments_org_id ON public.departments USING btree (org_id);


--
-- Name: idx_departments_parent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_departments_parent_id ON public.departments USING btree (parent_id);


--
-- Name: idx_dept_members_dept_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dept_members_dept_id ON public.dept_members USING btree (dept_id);


--
-- Name: idx_dept_members_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dept_members_org_id ON public.dept_members USING btree (org_id);


--
-- Name: idx_dept_members_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dept_members_user_id ON public.dept_members USING btree (user_id);


--
-- Name: idx_document_chunks_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_chunks_org_id ON public.document_chunks USING btree (org_id);


--
-- Name: idx_document_images_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_images_org_id ON public.document_images USING btree (org_id);


--
-- Name: idx_document_relationships_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_relationships_org_id ON public.document_relationships USING btree (org_id);


--
-- Name: idx_document_relationships_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_relationships_source ON public.document_relationships USING btree (source_doc_id);


--
-- Name: idx_document_relationships_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_relationships_target ON public.document_relationships USING btree (target_doc_id);


--
-- Name: idx_document_relationships_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_relationships_user_id ON public.document_relationships USING btree (user_id);


--
-- Name: idx_document_tables_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_tables_org_id ON public.document_tables USING btree (org_id);


--
-- Name: idx_document_views_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_views_org_id ON public.document_views USING btree (org_id);


--
-- Name: idx_document_views_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_views_user_id ON public.document_views USING btree (user_id);


--
-- Name: idx_documents_date_typed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_date_typed ON public.documents USING btree (date_typed);


--
-- Name: idx_documents_document_type_norm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_document_type_norm ON public.documents USING btree (document_type_norm);


--
-- Name: idx_eval_ratings_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eval_ratings_org_id ON public.eval_ratings USING btree (org_id);


--
-- Name: idx_eval_ratings_result_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eval_ratings_result_id ON public.eval_ratings USING btree (eval_result_id);


--
-- Name: idx_eval_ratings_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eval_ratings_user_id ON public.eval_ratings USING btree (user_id);


--
-- Name: idx_eval_results_case_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eval_results_case_id ON public.eval_results USING btree (test_case_id);


--
-- Name: idx_eval_results_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eval_results_org_id ON public.eval_results USING btree (org_id);


--
-- Name: idx_eval_results_run_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eval_results_run_id ON public.eval_results USING btree (eval_run_id);


--
-- Name: idx_eval_results_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eval_results_user_id ON public.eval_results USING btree (user_id);


--
-- Name: idx_eval_runs_matrix_group_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eval_runs_matrix_group_id ON public.eval_runs USING btree (matrix_group_id);


--
-- Name: idx_eval_runs_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eval_runs_org_id ON public.eval_runs USING btree (org_id);


--
-- Name: idx_eval_runs_skill_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eval_runs_skill_id ON public.eval_runs USING btree (skill_id);


--
-- Name: idx_eval_runs_skill_version_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eval_runs_skill_version_id ON public.eval_runs USING btree (skill_version_id);


--
-- Name: idx_eval_runs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eval_runs_user_id ON public.eval_runs USING btree (user_id);


--
-- Name: idx_harness_audit_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_harness_audit_run ON public.harness_audit USING btree (run_id) WHERE (run_id IS NOT NULL);


--
-- Name: idx_harness_audit_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_harness_audit_user_created ON public.harness_audit USING btree (user_id, created_at DESC);


--
-- Name: idx_message_feedback_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_feedback_org_id ON public.message_feedback USING btree (org_id);


--
-- Name: idx_messages_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_org_id ON public.messages USING btree (org_id);


--
-- Name: idx_metadata_field_definitions_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_metadata_field_definitions_org_id ON public.metadata_field_definitions USING btree (org_id);


--
-- Name: idx_metadata_field_definitions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_metadata_field_definitions_user_id ON public.metadata_field_definitions USING btree (user_id);


--
-- Name: idx_operator_audit_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operator_audit_created ON public.operator_audit_log USING btree (created_at DESC);


--
-- Name: idx_org_invitations_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_invitations_org_id ON public.org_invitations USING btree (org_id);


--
-- Name: idx_org_members_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_members_org_id ON public.org_members USING btree (org_id);


--
-- Name: idx_org_members_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_members_user_id ON public.org_members USING btree (user_id);


--
-- Name: idx_pdf_extraction_runs_document_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pdf_extraction_runs_document_id ON public.pdf_extraction_runs USING btree (document_id);


--
-- Name: idx_pdf_extraction_runs_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pdf_extraction_runs_org_id ON public.pdf_extraction_runs USING btree (org_id);


--
-- Name: idx_pdf_extraction_runs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pdf_extraction_runs_user_id ON public.pdf_extraction_runs USING btree (user_id);


--
-- Name: idx_runs_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runs_active ON public.runs USING btree (user_id, thread_id, status) WHERE (status = 'streaming'::text);


--
-- Name: idx_runs_history; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runs_history ON public.runs USING btree (user_id, thread_id, started_at DESC);


--
-- Name: idx_runs_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runs_org_id ON public.runs USING btree (org_id);


--
-- Name: idx_runs_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runs_parent ON public.runs USING btree (parent_run_id) WHERE (parent_run_id IS NOT NULL);


--
-- Name: idx_sandbox_files_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sandbox_files_org_id ON public.sandbox_files USING btree (org_id);


--
-- Name: idx_skill_embeddings_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_skill_embeddings_org_id ON public.skill_embeddings USING btree (org_id);


--
-- Name: idx_skill_embeddings_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_skill_embeddings_user_id ON public.skill_embeddings USING btree (user_id);


--
-- Name: idx_skill_files_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_skill_files_org_id ON public.skill_files USING btree (org_id);


--
-- Name: idx_skill_proposals_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_skill_proposals_org_id ON public.skill_proposals USING btree (org_id);


--
-- Name: idx_skill_proposals_skill_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_skill_proposals_skill_id ON public.skill_proposals USING btree (skill_id);


--
-- Name: idx_skill_proposals_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_skill_proposals_user_id ON public.skill_proposals USING btree (user_id);


--
-- Name: idx_skill_publish_overrides_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_skill_publish_overrides_org_id ON public.skill_publish_overrides USING btree (org_id);


--
-- Name: idx_skill_publish_overrides_skill_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_skill_publish_overrides_skill_id ON public.skill_publish_overrides USING btree (skill_id);


--
-- Name: idx_skill_publish_overrides_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_skill_publish_overrides_user_id ON public.skill_publish_overrides USING btree (user_id);


--
-- Name: idx_skill_test_cases_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_skill_test_cases_org_id ON public.skill_test_cases USING btree (org_id);


--
-- Name: idx_skill_test_cases_skill_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_skill_test_cases_skill_id ON public.skill_test_cases USING btree (skill_id);


--
-- Name: idx_skill_test_cases_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_skill_test_cases_user_id ON public.skill_test_cases USING btree (user_id);


--
-- Name: idx_skill_versions_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_skill_versions_org_id ON public.skill_versions USING btree (org_id);


--
-- Name: idx_skill_versions_skill_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_skill_versions_skill_id ON public.skill_versions USING btree (skill_id);


--
-- Name: idx_skill_versions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_skill_versions_user_id ON public.skill_versions USING btree (user_id);


--
-- Name: idx_sso_configs_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sso_configs_org_id ON public.sso_configs USING btree (org_id);


--
-- Name: idx_threads_active_workflow_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_threads_active_workflow_run ON public.threads USING btree (active_workflow_run_id) WHERE (active_workflow_run_id IS NOT NULL);


--
-- Name: idx_threads_user_visible; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_threads_user_visible ON public.threads USING btree (user_id, updated_at DESC) WHERE (is_eval = false);


--
-- Name: idx_todos_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_todos_org_id ON public.todos USING btree (org_id);


--
-- Name: idx_todos_thread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_todos_thread ON public.todos USING btree (thread_id, order_index);


--
-- Name: idx_tuner_runs_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tuner_runs_org_id ON public.tuner_runs USING btree (org_id);


--
-- Name: idx_tuner_runs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tuner_runs_user_id ON public.tuner_runs USING btree (user_id);


--
-- Name: idx_user_memory_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_memory_org_id ON public.user_memory USING btree (org_id);


--
-- Name: idx_user_settings_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_settings_org_id ON public.user_settings USING btree (org_id);


--
-- Name: idx_workflow_definitions_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_definitions_created_by ON public.workflow_definitions USING btree (created_by);


--
-- Name: idx_workflow_definitions_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_definitions_slug ON public.workflow_definitions USING btree (slug);


--
-- Name: idx_workflow_phases_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_phases_run ON public.workflow_phases USING btree (workflow_run_id, phase_index);


--
-- Name: idx_workflow_runs_thread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_runs_thread ON public.workflow_runs USING btree (thread_id);


--
-- Name: idx_workflow_runs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_runs_user_id ON public.workflow_runs USING btree (user_id);


--
-- Name: idx_workflow_schedules_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_schedules_due ON public.workflow_schedules USING btree (next_run_at) WHERE is_active;


--
-- Name: idx_workflow_schedules_org_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_schedules_org_user ON public.workflow_schedules USING btree (org_id, user_id);


--
-- Name: idx_workflow_schedules_workflow_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_schedules_workflow_id ON public.workflow_schedules USING btree (workflow_id);


--
-- Name: idx_workspace_file_versions_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_file_versions_org_id ON public.workspace_file_versions USING btree (org_id);


--
-- Name: idx_workspace_files_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_files_expires_at ON public.workspace_files USING btree (expires_at) WHERE (expires_at IS NOT NULL);


--
-- Name: idx_workspace_files_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_files_org_id ON public.workspace_files USING btree (org_id);


--
-- Name: idx_workspace_files_thread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_files_thread ON public.workspace_files USING btree (thread_id);


--
-- Name: idx_workspace_versions_file; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_versions_file ON public.workspace_file_versions USING btree (workspace_file_id, version DESC);


--
-- Name: message_feedback_user_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_feedback_user_created_idx ON public.message_feedback USING btree (user_id, created_at DESC);


--
-- Name: skill_files_skill_filename_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX skill_files_skill_filename_uniq ON public.skill_files USING btree (skill_id, filename);


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
-- Name: sso_configs_email_domain_lower_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sso_configs_email_domain_lower_unique ON public.sso_configs USING btree (lower(email_domain)) WHERE (email_domain IS NOT NULL);


--
-- Name: threads_folder_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX threads_folder_id_idx ON public.threads USING btree (folder_id);


--
-- Name: user_memory_user_updated_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_memory_user_updated_idx ON public.user_memory USING btree (user_id, updated_at DESC);


--
-- Name: audit_log audit_log_autofill_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_log_autofill_org_id BEFORE INSERT ON public.audit_log FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');


--
-- Name: checked_queries checked_queries_autofill_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER checked_queries_autofill_org_id BEFORE INSERT ON public.checked_queries FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');


--
-- Name: checked_queries checked_queries_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER checked_queries_set_updated_at BEFORE UPDATE ON public.checked_queries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: classification_rules classification_rules_autofill_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER classification_rules_autofill_org_id BEFORE INSERT ON public.classification_rules FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');


--
-- Name: code_executions code_executions_autofill_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER code_executions_autofill_org_id BEFORE INSERT ON public.code_executions FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');


--
-- Name: connector_connections connector_connections_autofill_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER connector_connections_autofill_org_id BEFORE INSERT ON public.connector_connections FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('created_by');


--
-- Name: connector_connections connector_connections_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER connector_connections_set_updated_at BEFORE UPDATE ON public.connector_connections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: document_chunks document_chunks_autofill_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER document_chunks_autofill_org_id BEFORE INSERT ON public.document_chunks FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_from_parent('document_id', 'documents', 'id');


--
-- Name: document_images document_images_autofill_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER document_images_autofill_org_id BEFORE INSERT ON public.document_images FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');


--
-- Name: document_relationships document_relationships_autofill_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER document_relationships_autofill_org_id BEFORE INSERT ON public.document_relationships FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');


--
-- Name: document_tables document_tables_autofill_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER document_tables_autofill_org_id BEFORE INSERT ON public.document_tables FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');


--
-- Name: document_views document_views_autofill_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER document_views_autofill_org_id BEFORE INSERT ON public.document_views FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');


--
-- Name: documents documents_autofill_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER documents_autofill_org_id BEFORE INSERT ON public.documents FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');


--
-- Name: eval_ratings eval_ratings_autofill_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER eval_ratings_autofill_org_id BEFORE INSERT ON public.eval_ratings FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');


--
-- Name: eval_ratings eval_ratings_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER eval_ratings_set_updated_at BEFORE UPDATE ON public.eval_ratings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: eval_results eval_results_autofill_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER eval_results_autofill_org_id BEFORE INSERT ON public.eval_results FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');


--
-- Name: eval_runs eval_runs_autofill_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER eval_runs_autofill_org_id BEFORE INSERT ON public.eval_runs FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');


--
-- Name: folders folders_autofill_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER folders_autofill_org_id BEFORE INSERT ON public.folders FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');


--
-- Name: folders folders_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER folders_set_updated_at BEFORE UPDATE ON public.folders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: harness_audit harness_audit_autofill_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER harness_audit_autofill_org_id BEFORE INSERT ON public.harness_audit FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');


--
-- Name: message_feedback message_feedback_autofill_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER message_feedback_autofill_org_id BEFORE INSERT ON public.message_feedback FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');


--
-- Name: messages messages_autofill_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER messages_autofill_org_id BEFORE INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');


--
-- Name: metadata_field_definitions metadata_field_definitions_autofill_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER metadata_field_definitions_autofill_org_id BEFORE INSERT ON public.metadata_field_definitions FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');


--
-- Name: pdf_extraction_runs pdf_extraction_runs_autofill_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pdf_extraction_runs_autofill_org_id BEFORE INSERT ON public.pdf_extraction_runs FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');


--
-- Name: runs runs_autofill_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER runs_autofill_org_id BEFORE INSERT ON public.runs FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');


--
-- Name: sandbox_files sandbox_files_autofill_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sandbox_files_autofill_org_id BEFORE INSERT ON public.sandbox_files FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');


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
-- Name: skill_embeddings skill_embeddings_autofill_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER skill_embeddings_autofill_org_id BEFORE INSERT ON public.skill_embeddings FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_from_parent('skill_id', 'skills', 'id');


--
-- Name: skill_files skill_files_autofill_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER skill_files_autofill_org_id BEFORE INSERT ON public.skill_files FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');


--
-- Name: skill_proposals skill_proposals_autofill_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER skill_proposals_autofill_org_id BEFORE INSERT ON public.skill_proposals FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');


--
-- Name: skill_proposals skill_proposals_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER skill_proposals_set_updated_at BEFORE UPDATE ON public.skill_proposals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: skill_publish_overrides skill_publish_overrides_autofill_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER skill_publish_overrides_autofill_org_id BEFORE INSERT ON public.skill_publish_overrides FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');


--
-- Name: skill_test_cases skill_test_cases_autofill_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER skill_test_cases_autofill_org_id BEFORE INSERT ON public.skill_test_cases FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');


--
-- Name: skill_test_cases skill_test_cases_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER skill_test_cases_set_updated_at BEFORE UPDATE ON public.skill_test_cases FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: skill_versions skill_versions_autofill_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER skill_versions_autofill_org_id BEFORE INSERT ON public.skill_versions FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');


--
-- Name: skill_versions skill_versions_no_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER skill_versions_no_update BEFORE UPDATE ON public.skill_versions FOR EACH ROW EXECUTE FUNCTION public.skill_versions_block_mutation();


--
-- Name: skills skills_autofill_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER skills_autofill_org_id BEFORE INSERT ON public.skills FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');


--
-- Name: skills skills_capture_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER skills_capture_version AFTER INSERT OR UPDATE ON public.skills FOR EACH ROW EXECUTE FUNCTION public.capture_skill_version();


--
-- Name: skills skills_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER skills_set_updated_at BEFORE UPDATE ON public.skills FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: skills stale_skill_embedding; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER stale_skill_embedding AFTER UPDATE ON public.skills FOR EACH ROW EXECUTE FUNCTION public.stale_skill_embedding();


--
-- Name: skill_test_cases stale_skill_embedding_from_case; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER stale_skill_embedding_from_case AFTER INSERT OR DELETE OR UPDATE ON public.skill_test_cases FOR EACH ROW EXECUTE FUNCTION public.stale_skill_embedding_from_case();


--
-- Name: threads threads_autofill_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER threads_autofill_org_id BEFORE INSERT ON public.threads FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');


--
-- Name: todos todos_autofill_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER todos_autofill_org_id BEFORE INSERT ON public.todos FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_from_parent('thread_id', 'threads', 'id');


--
-- Name: document_chunks trg_update_search_vector; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_search_vector BEFORE INSERT OR UPDATE OF content ON public.document_chunks FOR EACH ROW EXECUTE FUNCTION public.update_search_vector();


--
-- Name: tuner_runs tuner_runs_autofill_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tuner_runs_autofill_org_id BEFORE INSERT ON public.tuner_runs FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');


--
-- Name: user_memory user_memory_autofill_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_memory_autofill_org_id BEFORE INSERT ON public.user_memory FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');


--
-- Name: user_memory user_memory_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_memory_updated_at BEFORE UPDATE ON public.user_memory FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: user_settings user_settings_autofill_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_settings_autofill_org_id BEFORE INSERT ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');


--
-- Name: workflow_definitions workflow_definitions_autofill_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER workflow_definitions_autofill_org_id BEFORE INSERT ON public.workflow_definitions FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('created_by');


--
-- Name: workflow_definitions workflow_definitions_block_published; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER workflow_definitions_block_published BEFORE UPDATE ON public.workflow_definitions FOR EACH ROW EXECUTE FUNCTION public.workflow_definitions_block_published_update();


--
-- Name: workflow_definitions workflow_definitions_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER workflow_definitions_set_updated_at BEFORE UPDATE ON public.workflow_definitions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: workflow_phases workflow_phases_autofill_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER workflow_phases_autofill_org_id BEFORE INSERT ON public.workflow_phases FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_from_parent('workflow_run_id', 'workflow_runs', 'id');


--
-- Name: workflow_phases workflow_phases_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER workflow_phases_set_updated_at BEFORE UPDATE ON public.workflow_phases FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: workflow_runs workflow_runs_autofill_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER workflow_runs_autofill_org_id BEFORE INSERT ON public.workflow_runs FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_from_parent('thread_id', 'threads', 'id');


--
-- Name: workflow_runs workflow_runs_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER workflow_runs_set_updated_at BEFORE UPDATE ON public.workflow_runs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: workflow_schedules workflow_schedules_autofill_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER workflow_schedules_autofill_org_id BEFORE INSERT ON public.workflow_schedules FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');


--
-- Name: workflow_schedules workflow_schedules_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER workflow_schedules_set_updated_at BEFORE UPDATE ON public.workflow_schedules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: workspace_file_versions workspace_file_versions_autofill_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER workspace_file_versions_autofill_org_id BEFORE INSERT ON public.workspace_file_versions FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_from_parent('workspace_file_id', 'workspace_files', 'id');


--
-- Name: workspace_files workspace_files_autofill_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER workspace_files_autofill_org_id BEFORE INSERT ON public.workspace_files FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('created_by');


--
-- Name: audit_log audit_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: checked_queries checked_queries_expected_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checked_queries
    ADD CONSTRAINT checked_queries_expected_document_id_fkey FOREIGN KEY (expected_document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: checked_queries checked_queries_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checked_queries
    ADD CONSTRAINT checked_queries_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: checked_queries checked_queries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checked_queries
    ADD CONSTRAINT checked_queries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: classification_rules classification_rules_suggest_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classification_rules
    ADD CONSTRAINT classification_rules_suggest_folder_id_fkey FOREIGN KEY (suggest_folder_id) REFERENCES public.folders(id) ON DELETE SET NULL;


--
-- Name: classification_rules classification_rules_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classification_rules
    ADD CONSTRAINT classification_rules_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


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
-- Name: connector_connections connector_connections_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connector_connections
    ADD CONSTRAINT connector_connections_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: connector_connections connector_connections_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connector_connections
    ADD CONSTRAINT connector_connections_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: connector_tokens connector_tokens_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connector_tokens
    ADD CONSTRAINT connector_tokens_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.connector_connections(id) ON DELETE CASCADE;


--
-- Name: departments departments_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: departments departments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.departments(id) ON DELETE CASCADE;


--
-- Name: dept_members dept_members_dept_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dept_members
    ADD CONSTRAINT dept_members_dept_id_fkey FOREIGN KEY (dept_id) REFERENCES public.departments(id) ON DELETE CASCADE;


--
-- Name: dept_members dept_members_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dept_members
    ADD CONSTRAINT dept_members_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: dept_members dept_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dept_members
    ADD CONSTRAINT dept_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


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
-- Name: document_relationships document_relationships_source_doc_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_relationships
    ADD CONSTRAINT document_relationships_source_doc_id_fkey FOREIGN KEY (source_doc_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: document_relationships document_relationships_target_doc_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_relationships
    ADD CONSTRAINT document_relationships_target_doc_id_fkey FOREIGN KEY (target_doc_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: document_relationships document_relationships_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_relationships
    ADD CONSTRAINT document_relationships_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


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
-- Name: document_views document_views_folder_scope_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_views
    ADD CONSTRAINT document_views_folder_scope_fkey FOREIGN KEY (folder_scope) REFERENCES public.folders(id) ON DELETE SET NULL;


--
-- Name: document_views document_views_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_views
    ADD CONSTRAINT document_views_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


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
-- Name: eval_ratings eval_ratings_eval_result_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_ratings
    ADD CONSTRAINT eval_ratings_eval_result_id_fkey FOREIGN KEY (eval_result_id) REFERENCES public.eval_results(id) ON DELETE CASCADE;


--
-- Name: eval_ratings eval_ratings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_ratings
    ADD CONSTRAINT eval_ratings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: eval_results eval_results_eval_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_results
    ADD CONSTRAINT eval_results_eval_run_id_fkey FOREIGN KEY (eval_run_id) REFERENCES public.eval_runs(id) ON DELETE CASCADE;


--
-- Name: eval_results eval_results_test_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_results
    ADD CONSTRAINT eval_results_test_case_id_fkey FOREIGN KEY (test_case_id) REFERENCES public.skill_test_cases(id) ON DELETE CASCADE;


--
-- Name: eval_results eval_results_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_results
    ADD CONSTRAINT eval_results_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: eval_runs eval_runs_skill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_runs
    ADD CONSTRAINT eval_runs_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES public.skills(id) ON DELETE CASCADE;


--
-- Name: eval_runs eval_runs_skill_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_runs
    ADD CONSTRAINT eval_runs_skill_version_id_fkey FOREIGN KEY (skill_version_id) REFERENCES public.skill_versions(id) ON DELETE CASCADE;


--
-- Name: eval_runs eval_runs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_runs
    ADD CONSTRAINT eval_runs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


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
-- Name: harness_audit harness_audit_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.harness_audit
    ADD CONSTRAINT harness_audit_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


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
-- Name: metadata_field_definitions metadata_field_definitions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metadata_field_definitions
    ADD CONSTRAINT metadata_field_definitions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: operator_users operator_users_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operator_users
    ADD CONSTRAINT operator_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: org_invitations org_invitations_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_invitations
    ADD CONSTRAINT org_invitations_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: org_members org_members_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_members
    ADD CONSTRAINT org_members_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: org_members org_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_members
    ADD CONSTRAINT org_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: pdf_extraction_runs pdf_extraction_runs_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdf_extraction_runs
    ADD CONSTRAINT pdf_extraction_runs_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: pdf_extraction_runs pdf_extraction_runs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdf_extraction_runs
    ADD CONSTRAINT pdf_extraction_runs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_fkey FOREIGN KEY (role) REFERENCES public.roles(role) ON DELETE CASCADE;


--
-- Name: runs runs_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runs
    ADD CONSTRAINT runs_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE SET NULL;


--
-- Name: runs runs_parent_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runs
    ADD CONSTRAINT runs_parent_run_id_fkey FOREIGN KEY (parent_run_id) REFERENCES public.runs(run_id) ON DELETE SET NULL;


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
-- Name: skill_embeddings skill_embeddings_skill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_embeddings
    ADD CONSTRAINT skill_embeddings_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES public.skills(id) ON DELETE CASCADE;


--
-- Name: skill_embeddings skill_embeddings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_embeddings
    ADD CONSTRAINT skill_embeddings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


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
-- Name: skill_proposals skill_proposals_base_skill_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_proposals
    ADD CONSTRAINT skill_proposals_base_skill_version_id_fkey FOREIGN KEY (base_skill_version_id) REFERENCES public.skill_versions(id) ON DELETE CASCADE;


--
-- Name: skill_proposals skill_proposals_new_skill_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_proposals
    ADD CONSTRAINT skill_proposals_new_skill_version_id_fkey FOREIGN KEY (new_skill_version_id) REFERENCES public.skill_versions(id) ON DELETE SET NULL;


--
-- Name: skill_proposals skill_proposals_re_eval_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_proposals
    ADD CONSTRAINT skill_proposals_re_eval_run_id_fkey FOREIGN KEY (re_eval_run_id) REFERENCES public.eval_runs(id) ON DELETE SET NULL;


--
-- Name: skill_proposals skill_proposals_skill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_proposals
    ADD CONSTRAINT skill_proposals_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES public.skills(id) ON DELETE CASCADE;


--
-- Name: skill_proposals skill_proposals_source_eval_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_proposals
    ADD CONSTRAINT skill_proposals_source_eval_run_id_fkey FOREIGN KEY (source_eval_run_id) REFERENCES public.eval_runs(id) ON DELETE SET NULL;


--
-- Name: skill_proposals skill_proposals_source_tuner_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_proposals
    ADD CONSTRAINT skill_proposals_source_tuner_run_id_fkey FOREIGN KEY (source_tuner_run_id) REFERENCES public.tuner_runs(id) ON DELETE SET NULL;


--
-- Name: skill_proposals skill_proposals_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_proposals
    ADD CONSTRAINT skill_proposals_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: skill_publish_overrides skill_publish_overrides_skill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_publish_overrides
    ADD CONSTRAINT skill_publish_overrides_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES public.skills(id) ON DELETE CASCADE;


--
-- Name: skill_publish_overrides skill_publish_overrides_skill_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_publish_overrides
    ADD CONSTRAINT skill_publish_overrides_skill_version_id_fkey FOREIGN KEY (skill_version_id) REFERENCES public.skill_versions(id) ON DELETE SET NULL;


--
-- Name: skill_publish_overrides skill_publish_overrides_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_publish_overrides
    ADD CONSTRAINT skill_publish_overrides_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: skill_test_cases skill_test_cases_skill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_test_cases
    ADD CONSTRAINT skill_test_cases_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES public.skills(id) ON DELETE CASCADE;


--
-- Name: skill_test_cases skill_test_cases_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_test_cases
    ADD CONSTRAINT skill_test_cases_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: skill_versions skill_versions_skill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_versions
    ADD CONSTRAINT skill_versions_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES public.skills(id) ON DELETE CASCADE;


--
-- Name: skill_versions skill_versions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_versions
    ADD CONSTRAINT skill_versions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: skills skills_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skills
    ADD CONSTRAINT skills_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sso_configs sso_configs_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sso_configs
    ADD CONSTRAINT sso_configs_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: threads threads_active_workflow_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.threads
    ADD CONSTRAINT threads_active_workflow_run_id_fkey FOREIGN KEY (active_workflow_run_id) REFERENCES public.workflow_runs(id) ON DELETE SET NULL;


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
-- Name: todos todos_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.todos
    ADD CONSTRAINT todos_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.threads(id) ON DELETE CASCADE;


--
-- Name: tuner_runs tuner_runs_skill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tuner_runs
    ADD CONSTRAINT tuner_runs_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES public.skills(id) ON DELETE CASCADE;


--
-- Name: tuner_runs tuner_runs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tuner_runs
    ADD CONSTRAINT tuner_runs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_memory user_memory_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_memory
    ADD CONSTRAINT user_memory_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: workflow_definitions workflow_definitions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_definitions
    ADD CONSTRAINT workflow_definitions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: workflow_phases workflow_phases_workflow_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_phases
    ADD CONSTRAINT workflow_phases_workflow_run_id_fkey FOREIGN KEY (workflow_run_id) REFERENCES public.workflow_runs(id) ON DELETE CASCADE;


--
-- Name: workflow_runs workflow_runs_definition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_runs
    ADD CONSTRAINT workflow_runs_definition_id_fkey FOREIGN KEY (definition_id) REFERENCES public.workflow_definitions(id) ON DELETE RESTRICT;


--
-- Name: workflow_runs workflow_runs_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_runs
    ADD CONSTRAINT workflow_runs_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.threads(id) ON DELETE CASCADE;


--
-- Name: workflow_runs workflow_runs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_runs
    ADD CONSTRAINT workflow_runs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: workflow_schedules workflow_schedules_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_schedules
    ADD CONSTRAINT workflow_schedules_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: workflow_schedules workflow_schedules_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_schedules
    ADD CONSTRAINT workflow_schedules_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: workflow_schedules workflow_schedules_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_schedules
    ADD CONSTRAINT workflow_schedules_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.workflow_definitions(id) ON DELETE CASCADE;


--
-- Name: workspace_file_versions workspace_file_versions_workspace_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_file_versions
    ADD CONSTRAINT workspace_file_versions_workspace_file_id_fkey FOREIGN KEY (workspace_file_id) REFERENCES public.workspace_files(id) ON DELETE CASCADE;


--
-- Name: workspace_files workspace_files_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_files
    ADD CONSTRAINT workspace_files_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.threads(id) ON DELETE CASCADE;


--
-- Name: classification_rules Users can delete own classification_rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own classification_rules" ON public.classification_rules FOR DELETE TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: document_relationships Users can delete own document_relationships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own document_relationships" ON public.document_relationships FOR DELETE TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: document_views Users can delete own document_views; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own document_views" ON public.document_views FOR DELETE TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: folders Users can delete own folders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own folders" ON public.folders FOR DELETE TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: user_memory Users can delete own memory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own memory" ON public.user_memory FOR DELETE TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: metadata_field_definitions Users can delete own metadata_field_definitions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own metadata_field_definitions" ON public.metadata_field_definitions FOR DELETE TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: skill_files Users can delete own skill files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own skill files" ON public.skill_files FOR DELETE TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: skill_test_cases Users can delete own skill test cases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own skill test cases" ON public.skill_test_cases FOR DELETE TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: skills Users can delete own skills; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own skills" ON public.skills FOR DELETE TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: workflow_definitions Users can delete own workflow definitions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own workflow definitions" ON public.workflow_definitions FOR DELETE TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = created_by)));


--
-- Name: document_chunks Users can delete their own chunks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own chunks" ON public.document_chunks FOR DELETE TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: documents Users can delete their own documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own documents" ON public.documents FOR DELETE TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: messages Users can delete their own messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own messages" ON public.messages FOR DELETE TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: threads Users can delete their own threads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own threads" ON public.threads FOR DELETE TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: audit_log Users can insert own audit entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own audit entries" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) AND ((org_id IS NULL) OR (org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)))));


--
-- Name: classification_rules Users can insert own classification_rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own classification_rules" ON public.classification_rules FOR INSERT TO authenticated WITH CHECK (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id) AND (is_system_global = false)));


--
-- Name: document_relationships Users can insert own document_relationships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own document_relationships" ON public.document_relationships FOR INSERT TO authenticated WITH CHECK (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: document_views Users can insert own document_views; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own document_views" ON public.document_views FOR INSERT TO authenticated WITH CHECK (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id) AND (is_system_global = false)));


--
-- Name: code_executions Users can insert own executions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own executions" ON public.code_executions FOR INSERT TO authenticated WITH CHECK (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: message_feedback Users can insert own feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own feedback" ON public.message_feedback FOR INSERT TO authenticated WITH CHECK (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: folders Users can insert own folders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own folders" ON public.folders FOR INSERT TO authenticated WITH CHECK (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: harness_audit Users can insert own harness audit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own harness audit" ON public.harness_audit FOR INSERT TO authenticated WITH CHECK (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: user_memory Users can insert own memory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own memory" ON public.user_memory FOR INSERT TO authenticated WITH CHECK (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: metadata_field_definitions Users can insert own metadata_field_definitions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own metadata_field_definitions" ON public.metadata_field_definitions FOR INSERT TO authenticated WITH CHECK (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id) AND (is_system_global = false)));


--
-- Name: sandbox_files Users can insert own sandbox files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own sandbox files" ON public.sandbox_files FOR INSERT TO authenticated WITH CHECK (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: skill_files Users can insert own skill files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own skill files" ON public.skill_files FOR INSERT TO authenticated WITH CHECK (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: skill_test_cases Users can insert own skill test cases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own skill test cases" ON public.skill_test_cases FOR INSERT TO authenticated WITH CHECK (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: skills Users can insert own skills; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own skills" ON public.skills FOR INSERT TO authenticated WITH CHECK (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id) AND (is_system = false)));


--
-- Name: workflow_definitions Users can insert own workflow definitions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own workflow definitions" ON public.workflow_definitions FOR INSERT TO authenticated WITH CHECK (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = created_by) AND (is_system_global = false)));


--
-- Name: document_chunks Users can insert their own chunks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own chunks" ON public.document_chunks FOR INSERT TO authenticated WITH CHECK (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: documents Users can insert their own documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own documents" ON public.documents FOR INSERT TO authenticated WITH CHECK (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: messages Users can insert their own messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: profiles Users can insert their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = id));


--
-- Name: threads Users can insert their own threads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own threads" ON public.threads FOR INSERT TO authenticated WITH CHECK (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: document_images Users can manage own document images; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own document images" ON public.document_images TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (user_id = auth.uid()))) WITH CHECK (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (user_id = auth.uid())));


--
-- Name: document_tables Users can manage own document tables; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own document tables" ON public.document_tables TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (user_id = auth.uid()))) WITH CHECK (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (user_id = auth.uid())));


--
-- Name: message_feedback Users can select own feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can select own feedback" ON public.message_feedback FOR SELECT TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: user_memory Users can select own memory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can select own memory" ON public.user_memory FOR SELECT TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: classification_rules Users can update own classification_rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own classification_rules" ON public.classification_rules FOR UPDATE TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id))) WITH CHECK (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id) AND (is_system_global = false)));


--
-- Name: document_relationships Users can update own document_relationships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own document_relationships" ON public.document_relationships FOR UPDATE TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id))) WITH CHECK (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: document_views Users can update own document_views; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own document_views" ON public.document_views FOR UPDATE TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id))) WITH CHECK (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id) AND (is_system_global = false)));


--
-- Name: folders Users can update own folders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own folders" ON public.folders FOR UPDATE TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: user_memory Users can update own memory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own memory" ON public.user_memory FOR UPDATE TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: metadata_field_definitions Users can update own metadata_field_definitions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own metadata_field_definitions" ON public.metadata_field_definitions FOR UPDATE TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id))) WITH CHECK (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id) AND (is_system_global = false)));


--
-- Name: skill_test_cases Users can update own skill test cases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own skill test cases" ON public.skill_test_cases FOR UPDATE TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: skills Users can update own skills; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own skills" ON public.skills FOR UPDATE TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id))) WITH CHECK (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id) AND (is_system = false)));


--
-- Name: workflow_definitions Users can update own workflow definitions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own workflow definitions" ON public.workflow_definitions FOR UPDATE TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = created_by))) WITH CHECK (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = created_by) AND (is_system_global = false)));


--
-- Name: document_chunks Users can update their own chunks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own chunks" ON public.document_chunks FOR UPDATE TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: documents Users can update their own documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own documents" ON public.documents FOR UPDATE TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: messages Users can update their own messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own messages" ON public.messages FOR UPDATE TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = id));


--
-- Name: threads Users can update their own threads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own threads" ON public.threads FOR UPDATE TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: skill_files Users can view files on own or global skills; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view files on own or global skills" ON public.skill_files FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.skills
  WHERE ((skills.id = skill_files.skill_id) AND (skills.is_system = true)))) OR ((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND ((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM public.skills
  WHERE ((skills.id = skill_files.skill_id) AND (skills.is_org_shared = true))))))));


--
-- Name: classification_rules Users can view own and global classification_rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own and global classification_rules" ON public.classification_rules FOR SELECT TO authenticated USING (((is_system_global = true) OR ((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id))));


--
-- Name: document_views Users can view own and global document_views; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own and global document_views" ON public.document_views FOR SELECT TO authenticated USING (((is_system_global = true) OR ((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id))));


--
-- Name: folders Users can view own and global folders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own and global folders" ON public.folders FOR SELECT TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND ((auth.uid() = user_id) OR public.folder_is_org_shared(id))));


--
-- Name: metadata_field_definitions Users can view own and global metadata_field_definitions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own and global metadata_field_definitions" ON public.metadata_field_definitions FOR SELECT TO authenticated USING (((is_system_global = true) OR ((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id))));


--
-- Name: skills Users can view own and global skills; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own and global skills" ON public.skills FOR SELECT TO authenticated USING (((is_system = true) OR ((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND ((auth.uid() = user_id) OR (is_org_shared = true)))));


--
-- Name: workflow_definitions Users can view own and global workflow definitions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own and global workflow definitions" ON public.workflow_definitions FOR SELECT TO authenticated USING (((is_system_global = true) OR ((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = created_by))));


--
-- Name: document_relationships Users can view own document_relationships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own document_relationships" ON public.document_relationships FOR SELECT TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: eval_ratings Users can view own eval ratings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own eval ratings" ON public.eval_ratings FOR SELECT TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: eval_results Users can view own eval results; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own eval results" ON public.eval_results FOR SELECT TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: eval_runs Users can view own eval runs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own eval runs" ON public.eval_runs FOR SELECT TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: code_executions Users can view own executions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own executions" ON public.code_executions FOR SELECT TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: harness_audit Users can view own harness audit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own harness audit" ON public.harness_audit FOR SELECT TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: documents Users can view own or global-folder documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own or global-folder documents" ON public.documents FOR SELECT TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND ((auth.uid() = user_id) OR ((folder_id IS NOT NULL) AND public.folder_is_org_shared(folder_id)))));


--
-- Name: skill_publish_overrides Users can view own publish overrides; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own publish overrides" ON public.skill_publish_overrides FOR SELECT TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: sandbox_files Users can view own sandbox files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own sandbox files" ON public.sandbox_files FOR SELECT TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: skill_embeddings Users can view own skill embeddings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own skill embeddings" ON public.skill_embeddings FOR SELECT TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: skill_proposals Users can view own skill proposals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own skill proposals" ON public.skill_proposals FOR SELECT TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: skill_test_cases Users can view own skill test cases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own skill test cases" ON public.skill_test_cases FOR SELECT TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: skill_versions Users can view own skill versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own skill versions" ON public.skill_versions FOR SELECT TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: document_chunks Users can view their own chunks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own chunks" ON public.document_chunks FOR SELECT TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND ((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM public.documents d
  WHERE ((d.id = document_chunks.document_id) AND (d.folder_id IS NOT NULL) AND public.folder_is_org_shared(d.folder_id)))))));


--
-- Name: messages Users can view their own messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own messages" ON public.messages FOR SELECT TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO authenticated USING ((auth.uid() = id));


--
-- Name: threads Users can view their own threads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own threads" ON public.threads FOR SELECT TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: tuner_runs Users can view tuner runs on own or global skills; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view tuner runs on own or global skills" ON public.tuner_runs FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.skills
  WHERE ((skills.id = tuner_runs.skill_id) AND (skills.is_system = true)))) OR ((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND ((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM public.skills
  WHERE ((skills.id = tuner_runs.skill_id) AND (skills.is_org_shared = true))))))));


--
-- Name: audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: checked_queries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.checked_queries ENABLE ROW LEVEL SECURITY;

--
-- Name: checked_queries checked_queries_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY checked_queries_delete ON public.checked_queries FOR DELETE TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: checked_queries checked_queries_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY checked_queries_insert ON public.checked_queries FOR INSERT TO authenticated WITH CHECK (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: checked_queries checked_queries_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY checked_queries_select ON public.checked_queries FOR SELECT TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: checked_queries checked_queries_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY checked_queries_update ON public.checked_queries FOR UPDATE TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id))) WITH CHECK (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: classification_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.classification_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: code_executions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.code_executions ENABLE ROW LEVEL SECURITY;

--
-- Name: connector_connections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.connector_connections ENABLE ROW LEVEL SECURITY;

--
-- Name: connector_connections connector_connections_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY connector_connections_delete ON public.connector_connections FOR DELETE TO authenticated USING (public.current_user_has_permission(org_id, 'org:manage'::text));


--
-- Name: connector_connections connector_connections_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY connector_connections_insert ON public.connector_connections FOR INSERT TO authenticated WITH CHECK ((public.current_user_has_permission(org_id, 'org:manage'::text) AND (org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids))));


--
-- Name: connector_connections connector_connections_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY connector_connections_select ON public.connector_connections FOR SELECT TO authenticated USING ((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)));


--
-- Name: connector_connections connector_connections_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY connector_connections_update ON public.connector_connections FOR UPDATE TO authenticated USING (public.current_user_has_permission(org_id, 'org:manage'::text)) WITH CHECK ((public.current_user_has_permission(org_id, 'org:manage'::text) AND (org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids))));


--
-- Name: connector_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.connector_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: departments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

--
-- Name: departments departments_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY departments_delete ON public.departments FOR DELETE TO authenticated USING (public.current_user_has_permission(org_id, 'org:manage'::text));


--
-- Name: departments departments_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY departments_insert ON public.departments FOR INSERT TO authenticated WITH CHECK ((public.current_user_has_permission(org_id, 'org:manage'::text) AND (org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids))));


--
-- Name: departments departments_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY departments_select ON public.departments FOR SELECT TO authenticated USING ((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)));


--
-- Name: departments departments_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY departments_update ON public.departments FOR UPDATE TO authenticated USING (public.current_user_has_permission(org_id, 'org:manage'::text)) WITH CHECK ((public.current_user_has_permission(org_id, 'org:manage'::text) AND (org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids))));


--
-- Name: dept_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dept_members ENABLE ROW LEVEL SECURITY;

--
-- Name: dept_members dept_members_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dept_members_delete ON public.dept_members FOR DELETE TO authenticated USING (public.current_user_has_permission(org_id, 'org:manage'::text));


--
-- Name: dept_members dept_members_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dept_members_insert ON public.dept_members FOR INSERT TO authenticated WITH CHECK ((public.current_user_has_permission(org_id, 'org:manage'::text) AND (org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (role <> 'super-admin'::text)));


--
-- Name: dept_members dept_members_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dept_members_select ON public.dept_members FOR SELECT TO authenticated USING ((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)));


--
-- Name: dept_members dept_members_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dept_members_update ON public.dept_members FOR UPDATE TO authenticated USING (public.current_user_has_permission(org_id, 'org:manage'::text)) WITH CHECK ((public.current_user_has_permission(org_id, 'org:manage'::text) AND (org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (role <> 'super-admin'::text)));


--
-- Name: document_chunks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

--
-- Name: document_images; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_images ENABLE ROW LEVEL SECURITY;

--
-- Name: document_relationships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_relationships ENABLE ROW LEVEL SECURITY;

--
-- Name: document_tables; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_tables ENABLE ROW LEVEL SECURITY;

--
-- Name: document_views; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_views ENABLE ROW LEVEL SECURITY;

--
-- Name: documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

--
-- Name: eval_ratings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.eval_ratings ENABLE ROW LEVEL SECURITY;

--
-- Name: eval_results; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.eval_results ENABLE ROW LEVEL SECURITY;

--
-- Name: eval_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.eval_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: folders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

--
-- Name: harness_audit; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.harness_audit ENABLE ROW LEVEL SECURITY;

--
-- Name: message_feedback; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.message_feedback ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: metadata_field_definitions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.metadata_field_definitions ENABLE ROW LEVEL SECURITY;

--
-- Name: model_capabilities_overrides; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.model_capabilities_overrides ENABLE ROW LEVEL SECURITY;

--
-- Name: model_capabilities_overrides model_overrides_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY model_overrides_read_all ON public.model_capabilities_overrides FOR SELECT TO authenticated USING (true);


--
-- Name: operator_audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.operator_audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: operator_users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.operator_users ENABLE ROW LEVEL SECURITY;

--
-- Name: org_invitations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.org_invitations ENABLE ROW LEVEL SECURITY;

--
-- Name: org_invitations org_invitations_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_invitations_delete ON public.org_invitations FOR DELETE TO authenticated USING (public.current_user_has_permission(org_id, 'org:invite'::text));


--
-- Name: org_invitations org_invitations_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_invitations_insert ON public.org_invitations FOR INSERT TO authenticated WITH CHECK ((public.current_user_has_permission(org_id, 'org:invite'::text) AND (org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids))));


--
-- Name: org_invitations org_invitations_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_invitations_select ON public.org_invitations FOR SELECT TO authenticated USING ((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)));


--
-- Name: org_invitations org_invitations_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_invitations_update ON public.org_invitations FOR UPDATE TO authenticated USING (public.current_user_has_permission(org_id, 'org:invite'::text)) WITH CHECK ((public.current_user_has_permission(org_id, 'org:invite'::text) AND (org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids))));


--
-- Name: org_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

--
-- Name: org_members org_members_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_members_admin_select ON public.org_members FOR SELECT TO authenticated USING ((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)));


--
-- Name: org_members org_members_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_members_delete ON public.org_members FOR DELETE TO authenticated USING (public.current_user_has_permission(org_id, 'org:manage'::text));


--
-- Name: org_members org_members_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_members_insert ON public.org_members FOR INSERT TO authenticated WITH CHECK ((public.current_user_has_permission(org_id, 'org:manage'::text) AND (org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (role <> 'super-admin'::text)));


--
-- Name: org_members org_members_self_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_members_self_select ON public.org_members FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: org_members org_members_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_members_update ON public.org_members FOR UPDATE TO authenticated USING (public.current_user_has_permission(org_id, 'org:manage'::text)) WITH CHECK ((public.current_user_has_permission(org_id, 'org:manage'::text) AND (org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (role <> 'super-admin'::text)));


--
-- Name: organizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

--
-- Name: organizations organizations_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY organizations_select ON public.organizations FOR SELECT TO authenticated USING ((id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)));


--
-- Name: organizations organizations_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY organizations_update ON public.organizations FOR UPDATE TO authenticated USING (public.current_user_has_permission(id, 'org:manage'::text)) WITH CHECK ((public.current_user_has_permission(id, 'org:manage'::text) AND (id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids))));


--
-- Name: pdf_extraction_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pdf_extraction_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: pdf_extraction_runs pdf_extraction_runs_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pdf_extraction_runs_select_own ON public.pdf_extraction_runs FOR SELECT TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: role_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: role_permissions role_permissions_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY role_permissions_read_all ON public.role_permissions FOR SELECT TO authenticated USING (true);


--
-- Name: roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

--
-- Name: roles roles_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY roles_read_all ON public.roles FOR SELECT TO authenticated USING (true);


--
-- Name: runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;

--
-- Name: runs runs_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY runs_select_own ON public.runs FOR SELECT TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: sandbox_files; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sandbox_files ENABLE ROW LEVEL SECURITY;

--
-- Name: skill_embeddings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.skill_embeddings ENABLE ROW LEVEL SECURITY;

--
-- Name: skill_files; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.skill_files ENABLE ROW LEVEL SECURITY;

--
-- Name: skill_proposals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.skill_proposals ENABLE ROW LEVEL SECURITY;

--
-- Name: skill_publish_overrides; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.skill_publish_overrides ENABLE ROW LEVEL SECURITY;

--
-- Name: skill_test_cases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.skill_test_cases ENABLE ROW LEVEL SECURITY;

--
-- Name: skill_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.skill_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: skills; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_configs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sso_configs ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_configs sso_configs_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sso_configs_delete ON public.sso_configs FOR DELETE TO authenticated USING (public.current_user_has_permission(org_id, 'sso:manage'::text));


--
-- Name: sso_configs sso_configs_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sso_configs_insert ON public.sso_configs FOR INSERT TO authenticated WITH CHECK ((public.current_user_has_permission(org_id, 'sso:manage'::text) AND (org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids))));


--
-- Name: sso_configs sso_configs_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sso_configs_select ON public.sso_configs FOR SELECT TO authenticated USING ((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)));


--
-- Name: sso_configs sso_configs_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sso_configs_update ON public.sso_configs FOR UPDATE TO authenticated USING (public.current_user_has_permission(org_id, 'sso:manage'::text)) WITH CHECK ((public.current_user_has_permission(org_id, 'sso:manage'::text) AND (org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids))));


--
-- Name: threads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;

--
-- Name: todos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

--
-- Name: todos todos_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY todos_delete_own ON public.todos FOR DELETE TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = ( SELECT threads.user_id
   FROM public.threads
  WHERE (threads.id = todos.thread_id)))));


--
-- Name: todos todos_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY todos_insert_own ON public.todos FOR INSERT TO authenticated WITH CHECK (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = ( SELECT threads.user_id
   FROM public.threads
  WHERE (threads.id = todos.thread_id)))));


--
-- Name: todos todos_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY todos_select_own ON public.todos FOR SELECT TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = ( SELECT threads.user_id
   FROM public.threads
  WHERE (threads.id = todos.thread_id)))));


--
-- Name: todos todos_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY todos_update_own ON public.todos FOR UPDATE TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = ( SELECT threads.user_id
   FROM public.threads
  WHERE (threads.id = todos.thread_id)))));


--
-- Name: tuner_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tuner_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: user_memory; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_memory ENABLE ROW LEVEL SECURITY;

--
-- Name: workflow_definitions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workflow_definitions ENABLE ROW LEVEL SECURITY;

--
-- Name: workflow_phases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workflow_phases ENABLE ROW LEVEL SECURITY;

--
-- Name: workflow_phases workflow_phases_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workflow_phases_delete_own ON public.workflow_phases FOR DELETE TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = ( SELECT t.user_id
   FROM (public.threads t
     JOIN public.workflow_runs wr ON ((wr.thread_id = t.id)))
  WHERE (wr.id = workflow_phases.workflow_run_id)))));


--
-- Name: workflow_phases workflow_phases_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workflow_phases_insert_own ON public.workflow_phases FOR INSERT TO authenticated WITH CHECK (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = ( SELECT t.user_id
   FROM (public.threads t
     JOIN public.workflow_runs wr ON ((wr.thread_id = t.id)))
  WHERE (wr.id = workflow_phases.workflow_run_id)))));


--
-- Name: workflow_phases workflow_phases_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workflow_phases_select_own ON public.workflow_phases FOR SELECT TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = ( SELECT t.user_id
   FROM (public.threads t
     JOIN public.workflow_runs wr ON ((wr.thread_id = t.id)))
  WHERE (wr.id = workflow_phases.workflow_run_id)))));


--
-- Name: workflow_phases workflow_phases_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workflow_phases_update_own ON public.workflow_phases FOR UPDATE TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = ( SELECT t.user_id
   FROM (public.threads t
     JOIN public.workflow_runs wr ON ((wr.thread_id = t.id)))
  WHERE (wr.id = workflow_phases.workflow_run_id))))) WITH CHECK (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = ( SELECT t.user_id
   FROM (public.threads t
     JOIN public.workflow_runs wr ON ((wr.thread_id = t.id)))
  WHERE (wr.id = workflow_phases.workflow_run_id)))));


--
-- Name: workflow_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: workflow_runs workflow_runs_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workflow_runs_delete_own ON public.workflow_runs FOR DELETE TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = ( SELECT threads.user_id
   FROM public.threads
  WHERE (threads.id = workflow_runs.thread_id)))));


--
-- Name: workflow_runs workflow_runs_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workflow_runs_insert_own ON public.workflow_runs FOR INSERT TO authenticated WITH CHECK (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = ( SELECT threads.user_id
   FROM public.threads
  WHERE (threads.id = workflow_runs.thread_id)))));


--
-- Name: workflow_runs workflow_runs_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workflow_runs_select_own ON public.workflow_runs FOR SELECT TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = ( SELECT threads.user_id
   FROM public.threads
  WHERE (threads.id = workflow_runs.thread_id)))));


--
-- Name: workflow_runs workflow_runs_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workflow_runs_update_own ON public.workflow_runs FOR UPDATE TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = ( SELECT threads.user_id
   FROM public.threads
  WHERE (threads.id = workflow_runs.thread_id))))) WITH CHECK (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = ( SELECT threads.user_id
   FROM public.threads
  WHERE (threads.id = workflow_runs.thread_id)))));


--
-- Name: workflow_schedules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workflow_schedules ENABLE ROW LEVEL SECURITY;

--
-- Name: workflow_schedules workflow_schedules_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workflow_schedules_delete ON public.workflow_schedules FOR DELETE TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: workflow_schedules workflow_schedules_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workflow_schedules_insert ON public.workflow_schedules FOR INSERT TO authenticated WITH CHECK (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: workflow_schedules workflow_schedules_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workflow_schedules_select ON public.workflow_schedules FOR SELECT TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: workflow_schedules workflow_schedules_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workflow_schedules_update ON public.workflow_schedules FOR UPDATE TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id))) WITH CHECK (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));


--
-- Name: workspace_file_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_file_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_files; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_files ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_files workspace_files_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_files_delete_own ON public.workspace_files FOR DELETE TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = ( SELECT threads.user_id
   FROM public.threads
  WHERE (threads.id = workspace_files.thread_id)))));


--
-- Name: workspace_files workspace_files_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_files_insert_own ON public.workspace_files FOR INSERT TO authenticated WITH CHECK (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = ( SELECT threads.user_id
   FROM public.threads
  WHERE (threads.id = workspace_files.thread_id)))));


--
-- Name: workspace_files workspace_files_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_files_select_own ON public.workspace_files FOR SELECT TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = ( SELECT threads.user_id
   FROM public.threads
  WHERE (threads.id = workspace_files.thread_id)))));


--
-- Name: workspace_files workspace_files_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_files_update_own ON public.workspace_files FOR UPDATE TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = ( SELECT threads.user_id
   FROM public.threads
  WHERE (threads.id = workspace_files.thread_id)))));


--
-- Name: workspace_file_versions workspace_versions_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_versions_insert_own ON public.workspace_file_versions FOR INSERT TO authenticated WITH CHECK (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = ( SELECT t.user_id
   FROM (public.threads t
     JOIN public.workspace_files wf ON ((wf.thread_id = t.id)))
  WHERE (wf.id = workspace_file_versions.workspace_file_id)))));


--
-- Name: workspace_file_versions workspace_versions_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_versions_select_own ON public.workspace_file_versions FOR SELECT TO authenticated USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = ( SELECT t.user_id
   FROM (public.threads t
     JOIN public.workspace_files wf ON ((wf.thread_id = t.id)))
  WHERE (wf.id = workspace_file_versions.workspace_file_id)))));


--
-- PostgreSQL database dump complete
--



-- ============================================================
-- CROSS-SCHEMA SUPPLEMENT (storage buckets/policies, auth trigger,
-- realtime publication) — appended by regenerate-full-schema.sh from
-- scripts/full-schema-supplement.sql. See that file for maintenance notes.
-- ============================================================

-- ============================================================
-- FULL-SCHEMA SUPPLEMENT — cross-schema bootstrap bits
-- ============================================================
-- pg_dump --schema=public (used by regenerate-full-schema.sh) captures the
-- entire public schema (tables, functions, indexes, RLS on public tables) but
-- CANNOT capture objects that live in other schemas or are global:
--
--   * storage buckets        (rows in storage.buckets)
--   * storage RLS policies   (policies on storage.objects)
--   * the signup trigger     (trigger on auth.users)
--   * realtime memberships   (ALTER PUBLICATION supabase_realtime ...)
--
-- This file collects those bits so full-schema.sql is a TRUE one-paste
-- bootstrap for a fresh Supabase project (cloud or local). It is appended to
-- the generated dump by regenerate-full-schema.sh.
--
-- EVERYTHING HERE IS IDEMPOTENT — safe to run repeatedly (e.g. to patch an
-- already-provisioned DB that predates a new bucket/realtime table).
--
-- MAINTENANCE: when a NEW migration adds a storage bucket, an auth.users
-- trigger, or a realtime table, mirror it here (idempotently). Sources:
--   storage  -> migrations 017 (skill-files), 029 (documents, sandbox-outputs),
--               054 (workspace-files), 111 (skill-files read policy: legacy global
--               flag retired -> s.is_system OR s.is_org_shared, D-165-01), 112 (skill-files
--               read policy: shared branch ORG-GATED to current_user_org_ids(), SEED-125 CR-02)
--   auth     -> migration 001 (on_auth_user_created)
--   realtime -> migrations 002 (documents), 014 (folders), 032 (messages)
--   ACLs     -> migration 118 (connector_connections.secret_ciphertext column grant,
--               CR-01). pg_dump runs with --no-privileges, so ANY migration that
--               narrows a table privilege must be mirrored here or it is absent from
--               every greenfield bootstrap.
-- ============================================================


-- ============================================================
-- 1. pgvector — ensure the extension exists in public.
--    (Belt-and-suspenders: the generator also injects this near the top so it
--    precedes the public.vector column/index definitions. Harmless here.)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


-- ============================================================
-- 2. Storage buckets (all private) + RLS on storage.objects
-- ============================================================

-- documents — path: {user_id}/{document_id}/{filename}
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false) ON CONFLICT (id) DO NOTHING;

-- sandbox-outputs — path: {user_id}/{execution_id}/{filename}
INSERT INTO storage.buckets (id, name, public)
VALUES ('sandbox-outputs', 'sandbox-outputs', false) ON CONFLICT (id) DO NOTHING;

-- skill-files — path: {user_id}/{...}
INSERT INTO storage.buckets (id, name, public)
VALUES ('skill-files', 'skill-files', false) ON CONFLICT (id) DO NOTHING;

-- workspace-files — path: {user_id}/{...}
INSERT INTO storage.buckets (id, name, public)
VALUES ('workspace-files', 'workspace-files', false) ON CONFLICT (id) DO NOTHING;

-- documents policies
DROP POLICY IF EXISTS "Users can read own documents" ON storage.objects;
CREATE POLICY "Users can read own documents" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = (select auth.uid()::text));
DROP POLICY IF EXISTS "Users can upload to own documents folder" ON storage.objects;
CREATE POLICY "Users can upload to own documents folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = (select auth.uid()::text));
DROP POLICY IF EXISTS "Users can delete own documents" ON storage.objects;
CREATE POLICY "Users can delete own documents" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = (select auth.uid()::text));

-- sandbox-outputs policies
DROP POLICY IF EXISTS "Users can read own sandbox outputs" ON storage.objects;
CREATE POLICY "Users can read own sandbox outputs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'sandbox-outputs' AND (storage.foldername(name))[1] = (select auth.uid()::text));
DROP POLICY IF EXISTS "Users can upload to own sandbox outputs folder" ON storage.objects;
CREATE POLICY "Users can upload to own sandbox outputs folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'sandbox-outputs' AND (storage.foldername(name))[1] = (select auth.uid()::text));
DROP POLICY IF EXISTS "Users can delete own sandbox outputs" ON storage.objects;
CREATE POLICY "Users can delete own sandbox outputs" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'sandbox-outputs' AND (storage.foldername(name))[1] = (select auth.uid()::text));

-- skill-files policies (read allows owner OR files belonging to a system built-in
-- OR an org-shared skill WITHIN the caller's org — mig 112 SEED-125 CR-02: the shared
-- branch is ORG-GATED to genuinely match the mig-109 skill_files TABLE-RLS shape
-- [is_system universal OUTSIDE the org gate; owner/is_org_shared INSIDE
-- org_id ∈ current_user_org_ids()]. mig 111's earlier "reconciled" comment was inaccurate —
-- its branch was s.is_system OR s.is_org_shared with NO org predicate, a cross-org read leak;
-- 112 closes it. Storage RLS runs under the user JWT so auth.uid()/current_user_org_ids() resolve.)
DROP POLICY IF EXISTS "Users can read own skill files" ON storage.objects;
CREATE POLICY "Users can read own skill files" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'skill-files'
    AND (
      (storage.foldername(name))[1] = (select auth.uid()::text)
      OR EXISTS (
        SELECT 1 FROM public.skill_files sf
        JOIN public.skills s ON s.id = sf.skill_id
        WHERE sf.file_path = name
          AND (
            s.is_system = true
            OR (
              s.org_id IN (SELECT public.current_user_org_ids())
              AND (s.user_id = (select auth.uid()) OR s.is_org_shared = true)
            )
          )
      )
    )
  );
DROP POLICY IF EXISTS "Users can upload to own skill files folder" ON storage.objects;
CREATE POLICY "Users can upload to own skill files folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'skill-files' AND (storage.foldername(name))[1] = (select auth.uid()::text));
DROP POLICY IF EXISTS "Users can delete own skill files" ON storage.objects;
CREATE POLICY "Users can delete own skill files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'skill-files' AND (storage.foldername(name))[1] = (select auth.uid()::text));

-- workspace-files policies
DROP POLICY IF EXISTS "workspace_storage_select_own" ON storage.objects;
CREATE POLICY "workspace_storage_select_own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'workspace-files' AND (storage.foldername(name))[1] = (select auth.uid()::text));
DROP POLICY IF EXISTS "workspace_storage_insert_own" ON storage.objects;
CREATE POLICY "workspace_storage_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'workspace-files' AND (storage.foldername(name))[1] = (select auth.uid()::text));
DROP POLICY IF EXISTS "workspace_storage_delete_own" ON storage.objects;
CREATE POLICY "workspace_storage_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'workspace-files' AND (storage.foldername(name))[1] = (select auth.uid()::text));


-- ============================================================
-- 3. Auth: auto-create a profile row on signup (trigger on auth.users)
-- ============================================================
-- NOTE: keep this body in sync with migration 105 §D (public.handle_new_user). pg_dump emits
-- handle_new_user in the public dump ABOVE, but this supplement copy is appended LAST, so this is
-- the definition a greenfield paste actually keeps. It must therefore carry the SAME mig-105
-- extension: provision a personal org for every new signup (identical logic to mig 105 §A), wrapped
-- in an inner EXCEPTION-WHEN-OTHERS swallow so org-creation failure can NEVER abort the auth.users
-- INSERT / break signup (T-162-05). KEEP security definer + pinned search_path (T-162-06). If a future
-- migration changes handle_new_user, update this copy in the SAME commit or greenfield deploys drift.
create or replace function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer set search_path = public
  as $$
declare
  v_org_id uuid;
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name')
  on conflict (id) do nothing;

  -- defensive personal-org provisioning — identical logic to mig 105 §A, swallowed so a failure
  -- logs a WARNING and returns normally instead of aborting the signup INSERT.
  begin
    if not exists (select 1 from public.org_members m where m.user_id = new.id) then
      v_org_id := public.create_org_with_default_dept(
                    coalesce(new.email, new.id::text) || '''s Organization', null, 'General');
      insert into public.org_members (org_id, user_id, role)
      values (v_org_id, new.id, 'org-admin')
      on conflict (org_id, user_id) do nothing;
    end if;
  exception when others then
    raise warning 'handle_new_user: personal-org creation failed for %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ============================================================
-- 4. Realtime: add tables to the supabase_realtime publication.
--    Wrapped so re-runs (table already a member) don't error.
-- ============================================================
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.folders;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
-- 5. Column-level privilege: connector_connections.secret_ciphertext
--    (migration 118 / Phase 190 code-review finding CR-01)
-- ============================================================
-- ⚠ WHY THIS LIVES HERE RATHER THAN IN THE DUMP: regenerate-full-schema.sh runs
--    `pg_dump --no-privileges`, so full-schema.sql carries NO ACLs AT ALL
--    (`grep -c '^GRANT\|^REVOKE' supabase/full-schema.sql` -> 0, measured
--    2026-08-09). Migration 118 is therefore INVISIBLE to the generated dump —
--    its COMMENT survives, its GRANT does not. A greenfield project bootstrapped
--    from full-schema.sql alone would ship with `secret_ciphertext` readable over
--    PostgREST by every authenticated org member, which is exactly the defect 118
--    exists to close.
--
--    The rest of this file's ACL story is unchanged: Supabase's stock
--    `GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role`
--    default privileges are what give every other table its grants, and that is
--    still the right posture for every table that holds no secret. This one holds
--    a tenant credential, so it opts out — and the opt-out has to be re-stated in
--    a place the bootstrap can see.
--
--    Idempotent, like everything else in this file: REVOKE and GRANT are.
--
--    ⚠ ORDER MATTERS AGAINST THE DEFAULT PRIVILEGES. This block must run AFTER
--    the table exists and after any blanket grant, which it does: the supplement
--    is appended at the END of full-schema.sql.
REVOKE ALL ON public.connector_connections FROM anon;
REVOKE ALL ON public.connector_connections FROM authenticated;

-- One column per line so the OMISSION is visible in a diff. The column that is not
-- here is `secret_ciphertext`.
-- ⚠ MEASURED DRIFT, 2026-08-26 (Phase 211). This list had fallen FOUR COLUMNS behind the
--    live table, and the failure it ships is TOTAL rather than partial. `_SELECTABLE_COLUMNS`
--    (connector_service.py) is DERIVED from `ConnectorConnectionResponse`'s keys, so every
--    read projects every response field by name. A greenfield project bootstrapped from
--    full-schema.sql would therefore name four columns `authenticated` has no grant on and
--    PostgREST answers `42501 permission denied for table connector_connections` — on EVERY
--    connector read, including a pre-existing row that has nothing to do with the new column.
--    It looks like an outage, not a permissions bug. That is migration 118's own lesson,
--    recorded in this very file, recurring because the mirror is manual.
--
--    Three of the four (`mcp_server_url`, `tool_grants`, `discovered_tools`) drifted in at
--    Phase 206 and were latent for the whole milestone; `service_id` is migration 127's.
--    Derived from the live table, not retyped:
--      select column_name from information_schema.column_privileges
--       where table_name='connector_connections' and grantee='authenticated'
--         and privilege_type='SELECT';
--    Compare that set against this block whenever a migration adds a column here.
GRANT SELECT (
    id,
    org_id,
    created_by,
    capability,
    name,
    config,
    is_enabled,
    last_checked_at,
    last_check_verdict,
    created_at,
    updated_at,
    mcp_server_url,
    tool_grants,
    discovered_tools,
    service_id
) ON public.connector_connections TO authenticated;

-- Writes stay at TABLE level, INCLUDING the secret column: the org-admin create/edit
-- path runs on the user-JWT client and must be able to store an `enc:v1:` envelope.
-- A role may INSERT into and UPDATE a column it can never SELECT.
GRANT INSERT, UPDATE, DELETE ON public.connector_connections TO authenticated;
