-- 180: self-hosted / OpenAI-compatible endpoints reachable from the Settings UI
--
-- WHY: `lmstudio` has been a first-class provider since Phase 111 (D-111-7) with its own
-- base_url in config.py -- but NO app_settings column ever existed for it, so the only way
-- to point it anywhere was the LMSTUDIO_BASE_URL env var. That violates the standing rule
-- "Settings live in user_settings / app_settings and the Settings UI; env vars are for
-- secrets and infra only" -- the rule was followed for cloud providers and UNREACHABLE for
-- local ones (SEED-172), and the requirement it blocks is SEED-173: a model on the
-- customer's own hardware must behave identically whether served by Ollama, LM Studio,
-- vLLM or the vendor's own OpenAI-compatible API.
--
-- ⚠ THE SILENT-SAVE BUG THIS CLOSES: `lmstudio_api_key` did not exist either, yet the
-- Settings PUT writes f"{p.id}_api_key" for EVERY provider in KNOWN_PROVIDERS. A key typed
-- into the LM Studio card passed the _VALID_COLUMN_NAME identifier guard (it is a legal
-- identifier), reached the UPDATE, and threw UndefinedColumn -- which save_app_settings
-- swallows. The whole atomic UPDATE rolled back and the API still returned 200 + "Saved".
-- Same failure class as migration 078 (skill_builder_model), which hid for ~10 days.
--
-- `custom_*` is the generic OpenAI-compatible slot: any base URL + any bearer token, for an
-- endpoint this codebase has no vendor knowledge of (an Unsloth / vLLM / llama.cpp server
-- behind a tunnel). Its base_url is stored and used VERBATIM -- no /v1 append, no /v1 strip.

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS lmstudio_base_url text DEFAULT 'http://localhost:1234/v1',
  ADD COLUMN IF NOT EXISTS lmstudio_api_key  text,
  ADD COLUMN IF NOT EXISTS custom_base_url   text DEFAULT '',
  ADD COLUMN IF NOT EXISTS custom_api_key    text;

COMMENT ON COLUMN app_settings.lmstudio_base_url IS
  'LM Studio OpenAI-compatible endpoint. INCLUDES /v1 -- stored and used verbatim (unlike ollama_base_url, which omits /v1 and has it appended at load).';
COMMENT ON COLUMN app_settings.custom_base_url IS
  'Generic OpenAI-compatible endpoint (vLLM / Unsloth / llama.cpp / any tunnel). Stored and used VERBATIM -- include /v1 yourself.';
COMMENT ON COLUMN app_settings.custom_api_key IS
  'Bearer token for custom_base_url. Encrypted at rest via SECRET_COLUMNS when SECRETS_ENCRYPTION_KEY is configured.';
