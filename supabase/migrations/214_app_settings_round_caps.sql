-- 214 — the tool-round caps become operator settings (Phase 292.1, BUG-261024-03; D-17/D-18/D-19).
--
-- A chat turn stops after `chat_max_tool_rounds` tool rounds (the explorer after
-- `explorer_max_tool_rounds`) and shows the limit line with a Continue button. Until now both were
-- constants (15 and 8), so the only way to exercise the cap — the cross-provider UAT board included
-- — was to burn 15 real tool rounds. Operator direction: every non-secret setting is controllable
-- in the Settings UI, never by env.
--
-- SCHEMA, NOT A SEED: no INSERT, no UPDATE, no docs/OPERATOR.md Step-3 entry, no env var. The
-- defaults keep today's behaviour exactly (15 / 8); a database WITHOUT this migration still reads
-- 15 / 8 through the `_val` fallback in app/models/user_settings.py.
--
-- BOUNDED 2..50 IN THREE PLACES THAT AGREE: the CHECKs below, the PUT /settings 400
-- (app/api/settings.py, through _range_refusal_detail), and the Settings UI input clamp
-- (AgentRoundLimits.tsx). At 1 no tool could ever run before the limit line; above 50 a single
-- turn can run for a very long time. The CHECK is the backstop for every writer that is not that
-- endpoint (psql, a restored dump, the SQL editor).
--
-- Additive and idempotent; no RLS change (app_settings policies and table-level grants are
-- unchanged — scripts/full-schema-supplement.sql §5d); no function, so no EXECUTE revoke is owed.
-- App-wide by construction: app_settings is a single row, and there is no per-user column.

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS chat_max_tool_rounds integer NOT NULL DEFAULT 15;

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS explorer_max_tool_rounds integer NOT NULL DEFAULT 8;

ALTER TABLE public.app_settings
  DROP CONSTRAINT IF EXISTS app_settings_chat_max_tool_rounds_bound;

ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_chat_max_tool_rounds_bound
  CHECK (chat_max_tool_rounds >= 2 AND chat_max_tool_rounds <= 50);

ALTER TABLE public.app_settings
  DROP CONSTRAINT IF EXISTS app_settings_explorer_max_tool_rounds_bound;

ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_explorer_max_tool_rounds_bound
  CHECK (explorer_max_tool_rounds >= 2 AND explorer_max_tool_rounds <= 50);

COMMENT ON COLUMN public.app_settings.chat_max_tool_rounds IS
  'Phase 292.1 (BUG-261024-03). Tool rounds a general chat turn may run before it stops with the '
  'limit line and a Continue button. Default 15. Bounded 2..50 by the API (app/api/settings.py) '
  'and by app_settings_chat_max_tool_rounds_bound. Read once per run.';

COMMENT ON COLUMN public.app_settings.explorer_max_tool_rounds IS
  'Phase 292.1 (BUG-261024-03). Tool rounds an explorer (sub-agent) turn may run before it stops '
  'with the limit line and a Continue button. Default 8. Bounded 2..50 by the API '
  '(app/api/settings.py) and by app_settings_explorer_max_tool_rounds_bound. Read once per run.';
