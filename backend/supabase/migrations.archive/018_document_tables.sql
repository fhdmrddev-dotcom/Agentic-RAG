-- Migration 018: document_tables table for Phase 35 multi-modal ingestion
CREATE TABLE IF NOT EXISTS document_tables (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page          INTEGER,
  table_index   INTEGER NOT NULL,
  headers       JSONB NOT NULL DEFAULT '[]',
  rows          JSONB NOT NULL DEFAULT '[]',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE document_tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own document tables"
  ON document_tables FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS document_tables_document_idx
  ON document_tables (document_id);
