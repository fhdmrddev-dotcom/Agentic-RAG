ALTER TABLE public.documents ADD COLUMN content_hash text;

CREATE INDEX documents_user_hash_idx ON public.documents (user_id, content_hash);
CREATE INDEX documents_user_filename_idx ON public.documents (user_id, filename);

-- DB-level safety net against race conditions
CREATE UNIQUE INDEX documents_completed_hash_unique_idx
  ON public.documents (user_id, content_hash)
  WHERE content_hash IS NOT NULL AND status = 'completed';
