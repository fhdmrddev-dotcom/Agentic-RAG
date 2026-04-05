---
id: 260405-stg
type: quick
title: Add chat references, cascade deletions, and sandbox file cleanup
status: complete
completed_at: "2026-04-05"
duration: "~2min 16sec"
tasks_completed: 2
files_changed: 9
commits:
  - cb9a573
  - e26ccb1
key-decisions:
  - source_refs is DB column name; sources is frontend field name — getMessages maps source_refs -> sources on load
  - Deduplicate sources by document_id before emitting SSE event and persisting
  - Sandbox storage cleanup is best-effort (exception swallowed) to never block thread deletion
  - source_refs added to MessageResponse Pydantic model so select(*) serializes it through the API
---

# Quick Task 260405-stg Summary

**One-liner:** Source document pills below RAG responses via sources SSE event (persisted as source_refs JSONB), plus sandbox storage file cleanup on thread deletion.

## Tasks Completed

### Task 1: Chat Source References

Surfaces the source documents that informed an assistant response as compact pills below the message content.

**Backend changes:**
- `backend/app/api/threads.py`: Tracks `source_refs` list during tool execution. Collects `(document_id, filename)` pairs from `search_documents` results and `analyze_document` calls. After streaming completes, deduplicates by `document_id` and emits a `sources` SSE event. Persists `source_refs` JSONB in the assistant message row.
- `backend/app/models/message.py`: Added `source_refs: list[dict] | None = None` to `MessageResponse` so the column is serialized on GET /messages.
- `supabase/migrations/020_message_source_refs.sql`: `ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS source_refs jsonb`

**Frontend changes:**
- `frontend/src/types/index.ts`: Added `SourceReference` interface (`document_id`, `filename`) and `sources?: SourceReference[]` to `Message`.
- `frontend/src/lib/api.ts`: Added `onSources` callback to `streamMessage`; parse `sources` SSE event type. Updated `getMessages` to map `source_refs` -> `sources` on reload.
- `frontend/src/hooks/useMessages.ts`: Wired `onSources` callback to `setMessages` — updates the assistant message's `sources` array when the SSE event arrives.
- `frontend/src/components/chat/SourceReferences.tsx`: New component — horizontal flex row of `FileText` icon + truncated filename pills with `bg-muted/40 rounded-full` styling.
- `frontend/src/components/chat/MessageItem.tsx`: Renders `<SourceReferences sources={message.sources} />` inside the message content block, after `MarkdownRenderer`.

### Task 2: Cascade Deletions and Sandbox File Cleanup

Ensures sandbox output files in Supabase Storage are removed when a thread is deleted.

**Changes:**
- `backend/app/api/threads.py` (`delete_thread`): Before deleting the thread row, queries `code_executions` for the thread, then `sandbox_files` for those execution IDs, and calls `supabase.storage.from_("sandbox-outputs").remove(paths)`. Wrapped in try/except for best-effort behavior.

## Deviations from Plan

None — plan executed exactly as written. One minor addition: `source_refs` was added to `MessageResponse` Pydantic model (not mentioned explicitly in plan but required for the reload behavior to work through FastAPI serialization).

## Known Stubs

None — source data is wired from real tool results.

## Self-Check: PASSED

- `supabase/migrations/020_message_source_refs.sql` — created
- `frontend/src/components/chat/SourceReferences.tsx` — created
- Commits cb9a573 and e26ccb1 exist in git log
