-- Migration 028: message_feedback table for user response ratings (Phase 39)
-- Immutable ratings: INSERT + SELECT only (no UPDATE/DELETE). One rating per message per user.
-- D-01: permanent ratings enforced by UNIQUE(message_id, user_id) with no mutation endpoints.

CREATE TABLE IF NOT EXISTS public.message_feedback (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id  uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  rating      varchar(16) NOT NULL CHECK (rating IN ('positive', 'negative')),
  reason      varchar(32) CHECK (reason IN ('wrong_answer', 'not_from_documents', 'incomplete', 'other')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT message_feedback_message_user_unique UNIQUE (message_id, user_id)
);

-- Index for stats queries: filter by user_id and created_at for 30-day window (D-15)
CREATE INDEX IF NOT EXISTS message_feedback_user_created_idx
  ON public.message_feedback (user_id, created_at DESC);

-- Row-Level Security: INSERT and SELECT only (immutable — no UPDATE/DELETE policies)
ALTER TABLE public.message_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own feedback"
  ON public.message_feedback FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own feedback"
  ON public.message_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);
