-- Migration 120: model_capabilities_overrides.emit_tier (Phase 196, AUTH-04 / D-13 / D-14)
--
-- Adds the ONE column that makes the forced-emission tier operator-correctable.
--
-- WHY: SEED-135 called this "a one-line prerequisite". That is true of the OVERLAY LIST in
-- backend/app/config.py and FALSE of the feature — RESEARCH.md M-5 measured
-- model_capabilities_overrides at ELEVEN columns against information_schema, with no
-- `emit_tier` among them. Until this column exists, every one of the 8 DB-only models
-- (every local LM Studio row, and `gemini-3.6-flash` — the exact id SEED-135 measured
-- silently degrading a run) resolves through forced_emit.py's read-time
-- `cap.get("emit_tier", "coerce")` default and therefore reads `coerce` FOREVER, with no
-- knob anywhere to correct it. Surfacing that value in a picker without this column would
-- tell the operator the truth about a number nobody can fix.
--
-- SHAPE: nullable text, NO `NOT NULL`, NO `DEFAULT` — deliberately. All 37 existing override
-- rows must read NULL after this migration, so their behaviour stays BYTE-IDENTICAL to today
-- via that same read-time `coerce` default. A DEFAULT here would silently assert a tier for
-- every model that ships, which is the opposite of what D-14 asks for.
--
-- THE CHECK IS A CLOSED VOCABULARY, AND IT IS PINNED IN CODE (A7). The three literals below
-- are pinned EQUAL, in both directions, to two Python layers by
-- backend/tests/unit/test_196_emit_tier_two_layer_pin.py:
--   layer 2  backend/app/services/forced_emit.py  -> set(_RUNGS_BY_TIER)
--   layer 3  backend/app/api/admin.py             -> _MODEL_CAP_ENUM_COLUMNS["emit_tier"]
-- A tier this CHECK ACCEPTS but the ladder REJECTS would not raise anything — forced_emit.py's
-- boundary guard silently rewrites it to `coerce` and the run degrades with nobody told. That
-- silence is exactly why the equality is a test and not a comment. (Same two-layer lesson as
-- migration 114 / BUG-260731-02, where the failure was at least loud.)
--
-- NO NEW RLS POLICY. This adds a COLUMN, not a table: migration 053 already ships
-- `model_overrides_read_all FOR SELECT TO authenticated USING (true)` on
-- model_capabilities_overrides, and writes are service-role only through the operator-gated
-- PATCH /admin/models/{id}. The registry is global by design — no org_id, no owner column.
--
-- APPLY (CLAUDE.md): paste the FULL contents of this file into the LOCAL Supabase SQL editor
--   and run it. NEVER `supabase db push` / `supabase db reset` — those wipe local dev data.
--   Idempotence note: `ADD COLUMN IF NOT EXISTS <col> ... CONSTRAINT ... CHECK (...)` is proven
--   by NEITHER shipped analog (099 has the IF NOT EXISTS but no CHECK; 081 has the CHECK but no
--   IF NOT EXISTS), so re-run behaviour is MEASURED at apply time rather than claimed here.
-- THEN: from the repo root run `bash scripts/regenerate-full-schema.sh` (no --reset — a live-DB
--   schema dump that preserves dev data) to rebuild supabase/full-schema.sql, then commit this
--   file + full-schema.sql together.
-- CLOUD PARITY: paste this same SQL into the CLOUD Supabase SQL editor at promotion — a new
--   column is a non-code deploy half (docs/DEPLOYMENT-WORKFLOW.md deploy-parity checklist).
--   OWED, operator-gated; do not touch cloud now.

-- ── D-13 / D-14: the operator-correctable forced-emission tier ──────────────
ALTER TABLE public.model_capabilities_overrides
  ADD COLUMN IF NOT EXISTS emit_tier text
    CONSTRAINT model_capabilities_overrides_emit_tier_check
    CHECK (emit_tier IS NULL OR emit_tier IN ('force_strict', 'force', 'coerce'));

COMMENT ON COLUMN public.model_capabilities_overrides.emit_tier IS
  'Phase 196 (AUTH-04 / D-14). The forced-emission tier an OPERATOR asserts for this model, '
  'overlaid over the code registry by config.get_model_capability_async. NULL means "not '
  'tracked here" and is the shipped state for all 37 pre-120 rows — forced_emit.py then '
  'applies its read-time cap.get("emit_tier", "coerce") default, so NULL is byte-identical to '
  'today. The CHECK vocabulary is pinned EQUAL to set(_RUNGS_BY_TIER) in '
  'backend/app/services/forced_emit.py and to _MODEL_CAP_ENUM_COLUMNS["emit_tier"] in '
  'backend/app/api/admin.py by backend/tests/unit/test_196_emit_tier_two_layer_pin.py. A tier '
  'this CHECK accepted but the ladder rejected would be rewritten to "coerce" by the boundary '
  'guard at forced_emit.py:377 and the run would degrade SILENTLY — hence the closed set. '
  'D-122-04 still holds: emit_tier is the single source of truth; forced_emission and '
  'strict_json_schema are DEPRECATED-UNREAD and no derived view may re-read them.';
