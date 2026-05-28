-- 055_todos_table.sql
-- Phase 085: per-thread todo list (TOOL-01) + runs.parent_run_id for sub-agents (TOOL-02)
--           + doc-comment on messages.tool_calls.kind allowed values (TOOL-03/04)

-- Section 1: todos table
CREATE TABLE public.todos (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    thread_id uuid NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    todo_id text NOT NULL,
    content text NOT NULL,
    status text NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed')),
    parent_id text,
    order_index integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT todos_thread_todo_unique UNIQUE (thread_id, todo_id)
);
CREATE INDEX idx_todos_thread ON public.todos(thread_id, order_index);

-- Section 2: RLS via FK chain to threads.user_id (mirrors workspace_files pattern)
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "todos_select_own" ON public.todos
    FOR SELECT TO authenticated
    USING (auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id));

CREATE POLICY "todos_insert_own" ON public.todos
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id));

CREATE POLICY "todos_update_own" ON public.todos
    FOR UPDATE TO authenticated
    USING (auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id));

CREATE POLICY "todos_delete_own" ON public.todos
    FOR DELETE TO authenticated
    USING (auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id));

-- Section 3: runs.parent_run_id column for sub-agent index (D-085-14 + D-085-23)
ALTER TABLE public.runs
    ADD COLUMN parent_run_id uuid REFERENCES public.runs(run_id) ON DELETE SET NULL;
CREATE INDEX idx_runs_parent ON public.runs(parent_run_id) WHERE parent_run_id IS NOT NULL;

-- Section 4: doc-comment on messages.tool_calls.kind values
-- (Phase 075.4 added 'context_truncated', 'iteration_cap_dropped_tool_calls';
--  Phase 085 adds 'ask_user_prompt' and 'ask_user_response'.)
COMMENT ON COLUMN public.messages.tool_calls IS
'JSONB array. For role=system rows, first element may carry a "kind" discriminator: '
'context_truncated | iteration_cap_dropped_tool_calls (Phase 075.4) | '
'ask_user_prompt | ask_user_response (Phase 085).';
