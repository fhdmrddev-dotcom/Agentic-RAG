-- Phase 137.1-05 follow-up (schema-drift fix, same class as migration 078): the shared
-- `harness_judge_model` knob (EVAL-05f / D-11) shipped in code (config.py
-- `Settings.harness_judge_model`, the settings PUT validation, the SettingsPage judge
-- picker in Plan 10) but NO migration ever created its `app_settings` column. The loader
-- tolerates the gap (user_settings.py defaults a missing column to ""), so READ only 500'd
-- because the field was ALSO missing from UserEffectiveSettings (fixed in the same commit) —
-- but every judge-model save writes `harness_judge_model`, so the whole atomic UPDATE would
-- throw `column "harness_judge_model" ... does not exist`. `save_app_settings` swallows the
-- exception (silent except), so the API returns 200 + the UI shows "Saved" while NOTHING in
-- that save persists (the picked judge model AND any co-saved fields are lost).
-- Fix: create the missing column. Matches the Python field default (`str = ""`).
-- Apply via Supabase SQL editor OR psycopg2-direct to :54322 — NEVER db push/db reset.
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS harness_judge_model text NOT NULL DEFAULT '';
