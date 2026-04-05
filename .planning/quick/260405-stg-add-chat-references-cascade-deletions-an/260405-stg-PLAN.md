---
id: 260405-stg
type: quick
title: Add chat references, cascade deletions, and sandbox file cleanup
status: planned
---

# Add Chat References, Cascade Deletions, and Sandbox File Cleanup

## Task 1: Chat Source References — Show source documents after assistant responses

**Problem:** When the RAG system retrieves document chunks via `search_documents` or `analyze_document`, the source documents are not surfaced to the user after the assistant's text response. Users have no visibility into which documents informed the answer.

**Approach:** Extract unique source document references from `search_documents` tool results during streaming, emit them as a new SSE event type (`sources`), and render them as a compact "Sources" bar below the assistant message content.

**Files:**
- `backend/app/api/threads.py` — Collect source document references during tool execution, emit `sources` SSE event after final assistant content
- `frontend/src/types/index.ts` — Add `SourceReference` interface and `sources` field to `Message`
- `frontend/src/lib/api.ts` — Add `onSources` callback to `streamMessage`, parse `sources` SSE event
- `frontend/src/hooks/useMessages.ts` — Wire `onSources` callback to update message state
- `frontend/src/components/chat/MessageItem.tsx` — Render sources bar below assistant content
- `frontend/src/components/chat/SourceReferences.tsx` — New component: compact horizontal pill/chip list of source document names

**Backend changes (threads.py):**

1. After the main tool execution loop, before persisting the assistant message, collect all unique source documents from `search_documents` and `analyze_document` tool results:
   ```python
   # After the for-loop over tool_calls, inside the tool execution round:
   # Track sources in a list outside the iteration loop (alongside persisted_tool_calls):
   source_refs: list[dict] = []  # {"document_id": str, "filename": str}
   ```

2. When `search_documents` returns results, extract unique `(document_id, filename)` pairs and append to `source_refs`. When `analyze_document` completes, add `(doc_id, filename)` to `source_refs`. Deduplicate by `document_id`.

3. After the final assistant content is streamed (after the iteration loop breaks with no tool_calls), emit a `sources` SSE event:
   ```python
   if source_refs:
       unique_sources = list({s["document_id"]: s for s in source_refs}.values())
       yield f"data: {json.dumps({'type': 'sources', 'sources': unique_sources})}\n\n"
   ```

4. Also persist `source_refs` in the assistant message row (add to `row` dict before insert) so reloaded conversations show sources too. Use a new `sources` JSONB column on messages table OR embed in the existing tool_calls — prefer adding a `source_refs` key to the persisted row dict (no schema change needed; Supabase ignores unknown columns... actually we need a migration). Add a nullable `source_refs` JSONB column to messages.

**Frontend changes:**

1. `types/index.ts` — Add:
   ```typescript
   export interface SourceReference {
     document_id: string
     filename: string
   }
   ```
   Add `sources?: SourceReference[]` to `Message` interface.

2. `lib/api.ts` — Add `onSources?: (sources: SourceReference[]) => void` parameter to `streamMessage`. Parse `sources` SSE event type.

3. `hooks/useMessages.ts` — Wire `onSources` callback:
   ```typescript
   // onSources
   (sources) => {
     setMessages((prev) =>
       prev.map((m) => m.id === assistantId ? { ...m, sources } : m)
     )
   }
   ```

4. `components/chat/SourceReferences.tsx` — New component:
   - Renders a horizontal row of compact document pills/chips
   - Each pill shows a `FileText` icon + truncated filename
   - Styled with `text-xs bg-muted/40 rounded-full px-2.5 py-1` for subtle appearance
   - Wrapped in a flex container with gap-2 and overflow-x-auto

5. `components/chat/MessageItem.tsx` — After the message content `<MarkdownRenderer>` block, conditionally render:
   ```tsx
   {message.sources && message.sources.length > 0 && (
     <SourceReferences sources={message.sources} />
   )}
   ```

**Migration (020_message_source_refs.sql):**
```sql
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS source_refs jsonb;
```

**Verify:**
- Send a chat message that triggers `search_documents` (e.g., "What do my documents say about X?")
- After the assistant responds, source document names appear as pills below the response
- Reload the page — sources still appear (persisted via `source_refs` column)
- Messages that don't use search show no sources bar

---

## Task 2: Cascade Deletions and Sandbox File Cleanup

**Problem:** Deleting a thread currently closes the sandbox session and deletes the thread row (messages cascade via FK), but sandbox output files in the `sandbox-outputs` storage bucket are orphaned. The `code_executions` rows cascade (FK ON DELETE CASCADE from thread), and `sandbox_files` rows cascade from `code_executions`, but the actual files in Supabase Storage are never removed.

**Current cascade status (from schema investigation):**
- `threads` -> `messages`: ON DELETE CASCADE (001_initial_schema.sql) -- OK
- `threads` -> `code_executions`: ON DELETE CASCADE (015_sandbox.sql) -- OK
- `code_executions` -> `sandbox_files`: ON DELETE CASCADE (015_sandbox.sql) -- OK (DB rows)
- `documents` -> `document_chunks`: ON DELETE CASCADE (002_module2_byo_retrieval.sql) -- OK
- `folders` -> subfolders: ON DELETE CASCADE (014_folders.sql) -- OK
- `folders` -> documents: ON DELETE SET NULL (014_folders.sql) -- OK (intentional, orphans to root)
- `folders` -> threads: ON DELETE SET NULL (016_thread_folder_scope.sql) -- OK (intentional)
- `skills` -> `skill_files`: ON DELETE CASCADE (017_skills.sql) -- OK (DB rows)
- Skills delete endpoint already cleans storage files -- OK
- Folder delete endpoint already cleans document storage files -- OK
- Document delete endpoint already cleans storage files -- OK

**The only gap: sandbox output files in Supabase Storage are not cleaned up when a thread is deleted.** The `sandbox_files` DB rows cascade away, but the actual blobs in `sandbox-outputs` bucket remain.

**Files:**
- `backend/app/api/threads.py` — Enhance `delete_thread` to clean up sandbox storage files before deleting the thread

**Implementation:**

In `delete_thread`, before the existing thread delete call:

1. Query `code_executions` for this thread to get execution IDs
2. Query `sandbox_files` for those execution IDs to get `storage_path` values
3. Batch-remove all storage paths from the `sandbox-outputs` bucket
4. Then proceed with the existing thread delete (which cascades DB rows)

```python
@router.delete("/{thread_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_thread(
    thread_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    # Close sandbox session if sandbox is enabled (SAND-10)
    if settings.sandbox_enabled:
        from app.services.sandbox_service import sandbox_manager
        sandbox_manager.close_session(thread_id)

    # Clean up sandbox output files from storage before cascade deletes DB rows
    try:
        exec_rows = (
            supabase.table("code_executions")
            .select("id")
            .eq("thread_id", thread_id)
            .eq("user_id", current_user["id"])
            .execute()
        ).data or []
        if exec_rows:
            exec_ids = [r["id"] for r in exec_rows]
            file_rows = (
                supabase.table("sandbox_files")
                .select("storage_path")
                .in_("execution_id", exec_ids)
                .execute()
            ).data or []
            if file_rows:
                paths = [f["storage_path"] for f in file_rows]
                supabase.storage.from_("sandbox-outputs").remove(paths)
    except Exception:
        pass  # Best-effort cleanup — don't block thread deletion

    supabase.table("threads").delete().eq("id", thread_id).eq("user_id", current_user["id"]).execute()
```

Also clean up document storage files from the `documents` bucket. Currently, deleting a thread does NOT delete documents (documents are a separate entity), but we should also ensure that when a document is deleted, its storage file is cleaned. This is ALREADY handled in `delete_document` and `delete_folder`. No additional work needed.

**Verify:**
- Create a thread, run execute_code that produces an output file
- Note the file exists in sandbox-outputs bucket
- Delete the thread
- Verify: sandbox_files rows are gone (cascade), AND the actual storage blob is removed
- Verify: deleting a thread with no sandbox files still works (no errors)

---

## Summary of All Changes

| File | Change |
|------|--------|
| `supabase/migrations/020_message_source_refs.sql` | Add `source_refs` JSONB column to messages |
| `backend/app/api/threads.py` | (1) Collect source refs during tool execution, emit `sources` SSE event, persist in message row. (2) Clean up sandbox storage files on thread deletion |
| `frontend/src/types/index.ts` | Add `SourceReference` interface, add `sources` to `Message` |
| `frontend/src/lib/api.ts` | Add `onSources` callback, parse `sources` SSE event |
| `frontend/src/hooks/useMessages.ts` | Wire `onSources` to update message state |
| `frontend/src/components/chat/SourceReferences.tsx` | New component: source document pills |
| `frontend/src/components/chat/MessageItem.tsx` | Render `<SourceReferences>` below assistant content |
