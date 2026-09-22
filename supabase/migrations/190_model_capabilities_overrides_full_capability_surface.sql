-- Migration 190: model_capabilities_overrides — the SIX capability columns that were
-- reachable only from Python (Phase 262)
--
-- WHY. `ModelCapability` (backend/app/config.py) declares FIFTEEN fields. Before this
-- migration `model_capabilities_overrides` could express SIX of them
-- (llm_call_timeout_seconds, context_window_tokens, max_output_tokens, native_tools,
-- deprecated, emit_tier). The rest existed ONLY as literals in a hardcoded Python dict, so
-- a model needing one of them could not be added from the registry at all — it needed a
-- commit, a review and a deploy.
--
-- ⚠ THAT IS NOT A HYPOTHETICAL COST; IT IS WHY THIS PHASE EXISTS. OpenAI's gpt-5.6 family
--   (sol/terra/luna) requires a different API surface (/v1/responses) to use native tools at
--   all. There was no field anywhere that could say "call this one on a different endpoint",
--   so the only place the fact could live was a routing branch — and the branch that landed
--   in Phase 175 answered the constraint by giving native tool calling up entirely. The
--   family shipped with tool calls parsed back out of prose, and a registry UI reading
--   `native_tools: true` over a toggle that could not fire, for months. The defect was never
--   in the code; it was that a fact about a model had nowhere to be data.
--
-- WHAT THIS BUYS, stated precisely so it is not over-claimed:
--   * a new MODEL           -> already zero code (provider inference + this table)
--   * a new model QUIRK     -> after this migration, a row edit instead of a commit
--   * a new model PROTOCOL  -> still an adapter. Data selects from behaviours the code
--                              knows; it cannot invent one. `api_surface` is a CLOSED
--                              vocabulary for exactly that reason — offering a surface with
--                              no adapter behind it would be a dropdown that 404s.
--
-- SHAPE: every column is NULLABLE with NO DEFAULT, deliberately. Every pre-190 row must read
-- NULL afterwards so its behaviour stays BYTE-IDENTICAL — `get_model_capability_async`
-- overlays only non-NULL values, so NULL means "not asserted here" and the code registry (or
-- the inference fallback) still decides. A DEFAULT would silently assert a capability for
-- every model on the box, which is the opposite of the intent.
--
-- THE TWO CHECKS ARE CLOSED VOCABULARIES, PINNED IN CODE (the migration-120 precedent).
-- backend/tests/unit/test_262_capability_column_pin.py asserts, in BOTH directions:
--   api_surface   <-> config.API_SURFACES
--                 <-> admin._MODEL_CAP_ENUM_COLUMNS["api_surface"]
--                 <-> the surfaces provider_gateway.dispatcher can actually route
--   reasoning_off <-> the config.ModelCapability Literal
--                 <-> admin._MODEL_CAP_ENUM_COLUMNS["reasoning_off"]
-- ⛔ A value the CHECK accepts but the dispatcher cannot route would not raise anything: the
--   fork falls through to the chat-completions adapter and the operator's setting is
--   silently ignored. That silence is why the equality is a test and not a comment — the
--   same lesson migration 120 recorded for emit_tier, where an unrecognised tier was
--   rewritten to "coerce" with no exception, no audit row and no log line.
--
-- NO NEW RLS POLICY. This adds COLUMNS, not a table: migration 053 already ships
-- `model_overrides_read_all FOR SELECT TO authenticated USING (true)` on
-- model_capabilities_overrides, and writes are service-role only through the operator-gated
-- PATCH /admin/models/{id}. The registry is global by design — no org_id, no owner column.
--
-- `_load_model_overrides` issues `SELECT *`, so these columns reach the warm override cache
-- with no query change. That is load-bearing for the SYNC readers in openai_service.py,
-- which cannot await the async overlay on the hot path.
--
-- APPLY (CLAUDE.md): paste the FULL contents of this file into the LOCAL Supabase SQL editor
--   and run it. NEVER `supabase db push` / `supabase db reset` — those wipe local dev data.
-- THEN: from the repo root run `bash scripts/regenerate-full-schema.sh` (no --reset) to
--   rebuild supabase/full-schema.sql, and commit this file + full-schema.sql together.
-- CLOUD PARITY: paste this same SQL into the CLOUD Supabase SQL editor at promotion — a new
--   column is a non-code deploy half (docs/DEPLOYMENT-WORKFLOW.md deploy-parity checklist).
--   OWED, operator-gated; do not touch cloud now.

-- ── The API surface this model is called on ────────────────────────────────
-- NULL => chat.completions (every model today). 'responses' => OpenAI /v1/responses.
-- ⛔ Meaningful ONLY on provider='openai' rows: /v1/responses is OpenAI's own surface and an
--    OpenRouter / Ollama / LM Studio endpoint serving the same model id does not implement
--    it. The runtime gate (openai_service.uses_responses_api) checks the RESOLVED provider,
--    so a misapplied row degrades to today's behaviour rather than to a 404.
ALTER TABLE public.model_capabilities_overrides
  ADD COLUMN IF NOT EXISTS api_surface text
    CONSTRAINT model_capabilities_overrides_api_surface_check
    CHECK (api_surface IS NULL OR api_surface IN ('responses'));

COMMENT ON COLUMN public.model_capabilities_overrides.api_surface IS
  'Phase 262. The OpenAI API surface this model is called on. NULL = chat.completions (the '
  'shipped state for every pre-190 row, byte-identical). ''responses'' routes the model '
  'through provider_gateway/openai_responses.py, where reasoning and native tool calling are '
  'served together. CLOSED vocabulary, pinned EQUAL to config.API_SURFACES and to the '
  'surfaces the gateway dispatcher can route by test_262_capability_column_pin.py — a value '
  'with no adapter behind it is silently ignored, never an error.';

-- ── Reasoning-first: the model emits reasoning BEFORE tool calls ───────────
-- Keeps the STRUCTURED downgrade armed for any route that has no Responses surface
-- available. TRUE + api_surface NULL is the combination that says "this model cannot carry
-- a native tools param here".
ALTER TABLE public.model_capabilities_overrides
  ADD COLUMN IF NOT EXISTS reasoning_first boolean;

COMMENT ON COLUMN public.model_capabilities_overrides.reasoning_first IS
  'Phase 262 (registry half of the Phase 175 XPROV-01 gate). TRUE => this model rejects a '
  'chat.completions call carrying BOTH a native tools param AND reasoning, so it is routed '
  'STRUCTURED unless api_surface names a surface that serves both. NULL = not asserted.';

-- ── reasoning_off: the docs-confirmed way to DISABLE reasoning ─────────────
ALTER TABLE public.model_capabilities_overrides
  ADD COLUMN IF NOT EXISTS reasoning_off text
    CONSTRAINT model_capabilities_overrides_reasoning_off_check
    CHECK (reasoning_off IS NULL OR reasoning_off IN ('thinking_disabled', 'effort_none'));

COMMENT ON COLUMN public.model_capabilities_overrides.reasoning_off IS
  'Phase 262 (registry half of Phase 175 XPROV-04 / D-05). The docs-confirmed mechanism for '
  'turning reasoning OFF on cheap side-calls such as thread titling: ''thinking_disabled'' '
  '(extra_body thinking.type=disabled) or ''effort_none'' (reasoning_effort=none). NULL = '
  'UNSAFE/unknown, which keeps today''s derived fallback. CLOSED vocabulary pinned to the '
  'config.ModelCapability Literal by test_262_capability_column_pin.py.';

-- ── uses_max_completion_tokens: max_tokens vs max_completion_tokens ────────
-- Sending the wrong one is a hard 400. Today this is inferred from a startswith() heuristic
-- on o1/o3/o4/gpt-5 prefixes — a naming convention, i.e. a guess about the future.
ALTER TABLE public.model_capabilities_overrides
  ADD COLUMN IF NOT EXISTS uses_max_completion_tokens boolean;

COMMENT ON COLUMN public.model_capabilities_overrides.uses_max_completion_tokens IS
  'Phase 262. TRUE => send max_completion_tokens, not max_tokens (OpenAI o-series + GPT-5+). '
  'Sending the wrong parameter is a hard 400. NULL falls back to openai_service.'
  '_uses_max_completion_tokens'' prefix heuristic, which is byte-identical to today.';

-- ── supports_parallel_tools: may we send parallel_tool_calls at all ────────
-- False for providers whose compat layer REJECTS the parameter (Google). The distinction is
-- "does the API accept the kwarg", never "do we want parallel tools".
ALTER TABLE public.model_capabilities_overrides
  ADD COLUMN IF NOT EXISTS supports_parallel_tools boolean;

COMMENT ON COLUMN public.model_capabilities_overrides.supports_parallel_tools IS
  'Phase 262. FALSE => this endpoint REJECTS the parallel_tool_calls parameter, so it must '
  'not be sent. It is a claim about the API accepting the kwarg, NOT about whether parallel '
  'tools are wanted. NULL falls back to the provider-prefix inference (byte-identical).';

-- ── max_tools: per-model soft ceiling on the tool-schema list ──────────────
ALTER TABLE public.model_capabilities_overrides
  ADD COLUMN IF NOT EXISTS max_tools integer
    CONSTRAINT model_capabilities_overrides_max_tools_check
    CHECK (max_tools IS NULL OR max_tools > 0);

COMMENT ON COLUMN public.model_capabilities_overrides.max_tools IS
  'Phase 262 (registry half of Phase 091 TOOL-05 / SEED-035). Soft ceiling on how many tool '
  'schemas are offered to this model — some models degrade past a modest count. NULL = no '
  'cap, which is the shipped default for every model without a registry entry.';
