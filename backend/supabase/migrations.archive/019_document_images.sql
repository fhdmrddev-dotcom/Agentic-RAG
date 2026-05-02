-- Migration 019: document_images table for Phase 35 multi-modal ingestion
CREATE TABLE IF NOT EXISTS document_images (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page          INTEGER,
  image_index   INTEGER NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE document_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own document images"
  ON document_images FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS document_images_document_idx
  ON document_images (document_id);
