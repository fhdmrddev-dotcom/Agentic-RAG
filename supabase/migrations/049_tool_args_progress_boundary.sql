-- Migration 049 (Phase 075.10): tool_args_progress emission boundary knob.
--
-- Pre-075.10 the per-provider streaming services emitted a `tool_args_progress`
-- SSE event every 5120 bytes of cumulative tool-arg JSON. For typical code-gen
-- prompts (< 5 KB of code), that boundary fires AT MOST ONCE per tool call —
-- so the frontend's live-code panel either stays blank or pops in all-at-once
-- at `tool_start`. Phase 075.9 UAT (Chrome MCP + SSE intercept) confirmed
-- "fewer than 3 tool_args_progress events" on every provider for a 1 KB code
-- prompt.
--
-- This migration adds the `chat_tool_args_progress_emit_boundary_bytes` knob
-- (default 256 B) so emission fires ~20x more frequently for typical code
-- generations, matching Claude.ai's visible character-by-character render
-- cadence. Operator can raise the value via SQL or future Settings UI if SSE
-- bandwidth becomes a concern.

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS chat_tool_args_progress_emit_boundary_bytes INTEGER NOT NULL DEFAULT 256;

COMMENT ON COLUMN app_settings.chat_tool_args_progress_emit_boundary_bytes IS
  'Byte boundary at which provider services emit tool_args_progress SSE events during '
  'tool argument generation. Lower = more visible streaming (per Claude.ai) but more SSE '
  'bandwidth. Default 256 ≈ a line of Python every event. Was hardcoded 5120 pre-075.10.';
