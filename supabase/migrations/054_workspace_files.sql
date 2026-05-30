-- 054_workspace_files.sql
-- Phase 084: Workspace filesystem tables, RLS, and storage bucket

-- Section 1: workspace_files table
CREATE TABLE public.workspace_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    thread_id uuid NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    path text NOT NULL,
    size_bytes bigint NOT NULL DEFAULT 0,
    mime_type text NOT NULL DEFAULT 'application/octet-stream',
    content_inline bytea,
    content_storage_path text,
    created_by uuid NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT workspace_files_thread_path_unique UNIQUE (thread_id, path),
    CONSTRAINT workspace_files_path_length CHECK (char_length(path) <= 500),
    CONSTRAINT workspace_files_size_limit CHECK (size_bytes <= 10485760)
);
CREATE INDEX idx_workspace_files_thread ON workspace_files(thread_id);

-- Section 2: workspace_file_versions table
CREATE TABLE public.workspace_file_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    workspace_file_id uuid NOT NULL REFERENCES workspace_files(id) ON DELETE CASCADE,
    version integer NOT NULL,
    content_inline bytea,
    content_storage_path text,
    size_bytes bigint NOT NULL DEFAULT 0,
    delta_from_prev jsonb,
    created_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT workspace_versions_file_version_unique UNIQUE (workspace_file_id, version)
);
CREATE INDEX idx_workspace_versions_file ON workspace_file_versions(workspace_file_id, version DESC);

-- Section 3: RLS on workspace_files
ALTER TABLE workspace_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_files_select_own" ON workspace_files
    FOR SELECT TO authenticated
    USING (auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id));

CREATE POLICY "workspace_files_insert_own" ON workspace_files
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id));

CREATE POLICY "workspace_files_update_own" ON workspace_files
    FOR UPDATE TO authenticated
    USING (auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id));

CREATE POLICY "workspace_files_delete_own" ON workspace_files
    FOR DELETE TO authenticated
    USING (auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id));

-- Section 4: RLS on workspace_file_versions
ALTER TABLE workspace_file_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_versions_select_own" ON workspace_file_versions
    FOR SELECT TO authenticated
    USING (
        auth.uid() = (
            SELECT t.user_id FROM threads t
            JOIN workspace_files wf ON wf.thread_id = t.id
            WHERE wf.id = workspace_file_id
        )
    );

CREATE POLICY "workspace_versions_insert_own" ON workspace_file_versions
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() = (
            SELECT t.user_id FROM threads t
            JOIN workspace_files wf ON wf.thread_id = t.id
            WHERE wf.id = workspace_file_id
        )
    );

-- Section 5: workspace-files storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('workspace-files', 'workspace-files', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "workspace_storage_select_own" ON storage.objects;
CREATE POLICY "workspace_storage_select_own" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'workspace-files'
        AND (storage.foldername(name))[1] = (select auth.uid()::text)
    );

DROP POLICY IF EXISTS "workspace_storage_insert_own" ON storage.objects;
CREATE POLICY "workspace_storage_insert_own" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'workspace-files'
        AND (storage.foldername(name))[1] = (select auth.uid()::text)
    );

DROP POLICY IF EXISTS "workspace_storage_delete_own" ON storage.objects;
CREATE POLICY "workspace_storage_delete_own" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'workspace-files'
        AND (storage.foldername(name))[1] = (select auth.uid()::text)
    );
