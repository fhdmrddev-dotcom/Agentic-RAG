-- Plan 075.4-03 D-075.4-E1 — widen messages_role_check to allow role='system'.
--
-- Pre-migration: CHECK constraint at supabase/full-schema.sql:418 limited
-- messages.role to ('user', 'assistant'). Plan 075.4-03 persists
-- system_warning events (kind='context_truncated' /
-- kind='iteration_cap_dropped_tool_calls') as messages rows so they
-- survive thread reload.
--
-- Post-migration: role IN ('user', 'assistant', 'system').
--
-- RLS posture: messages rows are RLS-bound to thread owner via
-- existing thread_id-scoped policy. system-role rows inherit the same
-- policy; no new privilege escalation. The structured kind field lives
-- in tool_calls jsonb (no new column).
--
-- FORWARD-REF #6 (Phase 082.5): unified error sink will read kind by
-- trace_id; keep the kind identifier names stable
-- ('context_truncated', 'iteration_cap_dropped_tool_calls').
--
-- Idempotent: DROP IF EXISTS guards against re-application.

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_role_check;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_role_check
  CHECK (role = ANY (ARRAY['user'::text, 'assistant'::text, 'system'::text]));
