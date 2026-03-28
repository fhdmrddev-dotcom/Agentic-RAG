-- Migration 015: Allow reading documents in global folders
-- Replaces the original SELECT policy to add global folder visibility.

DROP POLICY IF EXISTS "Users can view their own documents" ON public.documents;

CREATE POLICY "Users can view own or global-folder documents"
  ON public.documents FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.folders
      WHERE folders.id = documents.folder_id
      AND folders.is_global = true
    )
  );
