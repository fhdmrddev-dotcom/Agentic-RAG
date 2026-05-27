-- Migration 053: Settings architecture unification (Phase 081.1)
-- Adds new columns to app_settings for values previously in settings_override.json.
-- Creates model_capabilities_overrides table for runtime model registration (D-09).
--
-- Section 1: ALTER TABLE app_settings — ~15 new columns per D-16, D-17, D-18,
--   D-22, D-23 and the RESEARCH key routing table.
-- Section 2: CREATE TABLE model_capabilities_overrides — per-model tunables (D-09, D-10).
-- Section 3: Ensure global row exists (idempotent seed).

-- ============================================================================
-- Section 1: Extend app_settings with settings previously in override JSON
-- ============================================================================

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS llm_provider                    text DEFAULT '',
  ADD COLUMN IF NOT EXISTS llm_model                       text DEFAULT 'gpt-4o',
  ADD COLUMN IF NOT EXISTS web_search_max_results          integer DEFAULT 5,
  ADD COLUMN IF NOT EXISTS web_search_enabled              boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS sandbox_enabled                 boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS context_window_max_tokens       integer DEFAULT 200000,
  ADD COLUMN IF NOT EXISTS sub_agent_max_output_tokens     integer DEFAULT 32768,
  ADD COLUMN IF NOT EXISTS sub_agent_model                 text DEFAULT '',
  ADD COLUMN IF NOT EXISTS llm_max_output_tokens           integer DEFAULT 32768,
  ADD COLUMN IF NOT EXISTS openrouter_tool_strategy        text DEFAULT 'quality',
  ADD COLUMN IF NOT EXISTS ollama_base_url                 text DEFAULT 'http://localhost:11434',
  ADD COLUMN IF NOT EXISTS provider_model_lists            jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS title_drafting_config           jsonb DEFAULT '{"max_tokens": 30, "max_length": 60}'::jsonb,
  ADD COLUMN IF NOT EXISTS sub_agent_config                jsonb DEFAULT '{"max_output_tokens": 32768}'::jsonb,
  ADD COLUMN IF NOT EXISTS token_capture_enabled           boolean DEFAULT true;

-- ============================================================================
-- Section 2: model_capabilities_overrides — runtime model registration (D-09)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.model_capabilities_overrides (
    model_id                 text PRIMARY KEY,
    provider                 text NOT NULL,
    llm_call_timeout_seconds integer,
    context_window_tokens    integer,
    max_output_tokens        integer,
    native_tools             boolean,
    enabled                  boolean DEFAULT true,
    created_at               timestamptz DEFAULT now(),
    updated_at               timestamptz DEFAULT now()
);

ALTER TABLE public.model_capabilities_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "model_overrides_read_all" ON public.model_capabilities_overrides
    FOR SELECT TO authenticated USING (true);

-- ============================================================================
-- Section 3: Ensure global row exists (idempotent)
-- ============================================================================

INSERT INTO public.app_settings (id) VALUES ('global') ON CONFLICT DO NOTHING;
