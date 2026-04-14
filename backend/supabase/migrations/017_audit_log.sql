-- Migration 017: Audit log table for Phase 30
CREATE TABLE IF NOT EXISTS audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type  TEXT NOT NULL,
  metadata     JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT audit_log_action_type_check CHECK (
    action_type IN (
      'document.upload', 'document.delete', 'search.query',
      'code.execute', 'skill.load', 'thread.create',
      'thread.delete', 'settings.update'
    )
  )
);

-- Index for Phase 31 pagination: list by user, newest first
CREATE INDEX IF NOT EXISTS audit_log_user_created_idx
  ON audit_log (user_id, created_at DESC);

-- RLS: enable row-level security
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Users may INSERT their own entries; no SELECT/UPDATE/DELETE
CREATE POLICY "Users can insert own audit entries"
  ON audit_log FOR INSERT
  WITH CHECK (user_id = auth.uid());
