-- Phase 123 follow-up (schema-drift fix): the `skill_builder_model` knob (D-08 / TRIG-01)
-- shipped in code (config.py `Settings.skill_builder_model`, the settings PUT, SettingsPage)
-- but NO migration ever created its `app_settings` column. The loader tolerates the gap
-- (user_settings.py:529 defaults a missing column to ""), so it went unnoticed on READ —
-- but every AI-Model Settings save writes `skill_builder_model`, so the whole atomic UPDATE
-- throws `column "skill_builder_model" ... does not exist`. `save_app_settings` swallows the
-- exception (silent except), so the API returns 200 + the UI shows "Saved" while NOTHING
-- persists (provider_model_lists / llm_model / everything in that save is lost). Symptom:
-- added models vanish on reload; app_settings.updated_at frozen at the last pre-123 save.
-- Fix: create the missing column. Matches the Python field default (`str = ""`).
-- Apply via Supabase SQL editor OR psycopg2-direct to :54322 — NEVER db push/db reset.
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS skill_builder_model text NOT NULL DEFAULT '';
