-- Migration 100: Secret key columns on app_settings (Phase 150, SEC-01, D-150-08)
-- Closes the load-bearing DB divergence RESEARCH found: of the nominal 12 secret
-- columns in main._API_KEY_COLUMNS, only `embedding_api_key` and `rerank_api_key`
-- ever existed in the DB — the 9 `{provider}_api_key` columns and `tavily_api_key`
-- were designed in code but never migrated. This adds the 10 missing `text` columns
-- so provider + Tavily keys become DB-persistable and encryptable at rest (Plan 03/04).
--
-- Why this matters (D-150-07 root cause): a provider-key save today writes to a
-- nonexistent column → UndefinedColumn → caught → bool ignored → HTTP 200 (silent
-- failure). Once encryption is active (Plan 04), encrypt-on-write into a missing
-- column would fail the whole UPDATE atomically (RESEARCH Pitfall 2), turning the
-- silent 200 into a 500 that also drops the co-submitted embedding key. Adding the
-- columns first (Wave 1) makes provider-key saves target real columns before the
-- Wave-2 encryption seams land.
--
-- Metadata-only: 10 idempotent ADD COLUMN statements, no data backfill. A NULL secret
-- column is the correct "unset → env fallback" state (D-150-01) — the migration only
-- creates capacity, it never writes plaintext. Plain `text`, NO default. No RLS change:
-- app_settings writes are service-role only (no per-user RLS backstop). Analog shape:
-- 099_model_registry_deprecated.sql (text-column add) + 097_operator_flags.sql (header).
--
-- APPLY (CLAUDE.md): paste the FULL contents of this file into the LOCAL Supabase SQL
--   editor and run it (or psycopg2 to 127.0.0.1:54322). Idempotent (ADD COLUMN IF NOT
--   EXISTS) — safe to re-run. NEVER `supabase db push` / `supabase db reset` — those
--   wipe local dev data.
-- THEN: from the repo root run `bash scripts/regenerate-full-schema.sh` (no --reset — a
--   live-DB schema dump that preserves data) to rebuild supabase/full-schema.sql, then
--   commit this file + full-schema.sql together.
-- CLOUD PARITY: paste this same SQL into the CLOUD Supabase SQL editor at promotion — new
--   app_settings columns are a non-code deploy half (docs/DEPLOYMENT-WORKFLOW.md deploy-
--   parity checklist). mig 100 joins mig 099 in the pending-on-cloud set
--   (scripts/pending-cloud-migrations.sh); DEFERRED to the standing production-push
--   checklist — do NOT touch cloud now.

-- Ensure the global row exists (idempotent — mirrors 097 Section, 053 Section 3).
INSERT INTO public.app_settings (id) VALUES ('global') ON CONFLICT DO NOTHING;

-- ── The 10 missing secret text columns (9 provider keys + tavily) ───────────
-- Source of truth: main._API_KEY_COLUMNS (backend/app/main.py:125-130). The two
-- already-existing members (embedding_api_key, rerank_api_key) are intentionally
-- omitted from the target set — IF NOT EXISTS would make re-including them harmless,
-- but the 10 below are the deliverable.
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS openai_api_key text;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS anthropic_api_key text;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS google_api_key text;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS openrouter_api_key text;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS ollama_api_key text;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS deepseek_api_key text;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS moonshot_api_key text;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS minimax_api_key text;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS zhipu_api_key text;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS tavily_api_key text;
