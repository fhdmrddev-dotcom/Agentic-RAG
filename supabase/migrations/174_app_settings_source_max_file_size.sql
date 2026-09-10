-- SEED-258: the source file-size ceiling is a SETTING, not three hardcoded Python constants.
-- Apply via Supabase SQL editor — NEVER db push / db reset (CLAUDE.md).
--
-- ⚠ WHY THIS EXISTS. Phase 239 shipped MCP as a source family and found two constants that
--   disagreed in production:
--
--       mcp_source.MAX_FILE_BYTES     = 25 MB   (the decoded file)
--       mcp_client.MAX_MCP_BODY_BYTES =  2 MB   (the WHOLE JSON-RPC response)
--
--   MCP carries file content INSIDE the envelope, base64-inflated 4/3, so the real ceiling
--   was ~1.5 MB and the 25 MB one COULD NEVER FIRE. A 3 MB PDF failed with a transport error
--   naming a byte cap instead of a plain "this file is too large".
--
--   ⭐ Both numbers were individually defensible. What was wrong was the RELATION between
--   them, and a relation has no home in a file of constants. On top of that, MAX_FILE_BYTES
--   was duplicated across google_drive.py, microsoft_graph.py and mcp_source.py and agreed in
--   all three only by coincidence of careful authorship — a fourth source family is where
--   that luck runs out.
--
-- ⛔ app_settings, NOT user_settings. This bounds how much memory ONE in-flight request
--   buffers from a remote server we do not control. A DoS guard a user can raise for
--   themselves is not a guard. app_settings is the global singleton with RLS disabled.
--
-- ⛔ ONE COLUMN, and there must never be a second. The MCP envelope cap is DERIVED from this
--   value server-side (mcp_client.mcp_max_body_bytes() = ceiling x 4/3 + 1 MB headroom).
--   Adding an envelope column would re-create the exact disagreement described above, with
--   the difference that an operator could then cause it.
--
-- ⚠ NUMBER 174. The ROADMAP reserved 174 for Phase 239 and the phase shipped without using
--   it; supabase/migrations/ ends at 173_classification_rules_scope.sql. Numbers are
--   monotonic and gaps are NEVER backfilled.
--
-- ⚠ NOT APPLIED BY THE AUTHORING AGENT. Until an operator pastes this, the column is absent
--   and `_val(row, "source_max_file_size_mb", None, 25)` reads the shipped 25 MB — the
--   migration-authored-but-not-applied case is fail-soft by construction, exactly like
--   model_discovery_filter_enabled before 159-03. Nothing changes size until the column
--   exists AND an operator sets it.
--
-- The bounds below are enforced in TWO places that this CHECK makes three: the API refuses an
-- out-of-range PATCH (app/api/settings.py) and the read clamps (source_max_file_bytes()).
-- The CHECK is the backstop for a hand-edit in this very SQL editor.
--   * floor 1  — a ceiling of 0 disables ingestion while every sync still reports success.
--   * max  50  — app/api/documents.py refuses a hand-uploaded file at 50 MB, so a CONNECTED
--                source must never admit a file the app would refuse from a person's disk.
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS source_max_file_size_mb integer DEFAULT 25;

ALTER TABLE public.app_settings
  DROP CONSTRAINT IF EXISTS app_settings_source_max_file_size_mb_bounds;

ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_source_max_file_size_mb_bounds
  CHECK (source_max_file_size_mb IS NULL
         OR (source_max_file_size_mb >= 1 AND source_max_file_size_mb <= 50));

COMMENT ON COLUMN public.app_settings.source_max_file_size_mb IS
  'SEED-258. The largest file any connected source (Google Drive, Microsoft Graph, any MCP '
  'file surface) will import, in MB. Read through source_max_file_bytes(); the MCP JSON-RPC '
  'envelope cap is DERIVED from this (x 4/3 for base64, plus 1 MB headroom) and is never a '
  'second setting. Bounded 1..50: 0 would stop every source importing while each sync still '
  'reported success, and 50 MB is the application''s own manual-upload ceiling. Raising it '
  'costs memory — the whole response is buffered per in-flight request from a server we do '
  'not control. NULL reads as the shipped 25 MB.';
