-- Migration 019: Fix visibility of sub-folders and documents inside global folders
--
-- Problem: Only the root folder with is_global = true was visible to other users.
-- Sub-folders (is_global = false) and documents inside them were hidden.
--
-- Fix: Recursive helper function that walks the ancestor chain. A folder or
-- document is globally visible if any ancestor folder (or itself) is_global = true.

-- ============================================================
-- Helper function
-- ============================================================
CREATE OR REPLACE FUNCTION public.folder_is_globally_visible(p_folder_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE ancestors AS (
    SELECT id, parent_id, is_global
    FROM public.folders
    WHERE id = p_folder_id

    UNION ALL

    SELECT f.id, f.parent_id, f.is_global
    FROM public.folders f
    INNER JOIN ancestors a ON f.id = a.parent_id
  )
  SELECT COALESCE(bool_or(is_global), false) FROM ancestors;
$$;

-- ============================================================
-- Fix folders SELECT policy
-- Previously: only rows where is_global = true were visible.
-- Now: any folder whose ancestor chain contains an is_global = true folder is visible.
-- ============================================================
DROP POLICY IF EXISTS "Users can view own and global folders" ON public.folders;

CREATE POLICY "Users can view own and global folders"
  ON public.folders FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.folder_is_globally_visible(id)
  );

-- ============================================================
-- Fix documents SELECT policy
-- Previously: only documents whose folder_id directly pointed to an is_global folder.
-- Now: documents anywhere in a global folder subtree are visible.
-- ============================================================
DROP POLICY IF EXISTS "Users can view own or global-folder documents" ON public.documents;

CREATE POLICY "Users can view own or global-folder documents"
  ON public.documents FOR SELECT
  USING (
    auth.uid() = user_id
    OR (
      folder_id IS NOT NULL
      AND public.folder_is_globally_visible(folder_id)
    )
  );
