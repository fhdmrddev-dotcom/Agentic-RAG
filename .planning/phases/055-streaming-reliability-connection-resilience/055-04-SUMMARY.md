---
plan: 055-04
phase: 055-streaming-reliability-connection-resilience
status: complete
completed: 2026-04-27
---

# Summary: 055-04 — Frontend Realtime Subscription + sseDrop Removal

## What Was Built

Wired Supabase Realtime subscription into `useMessages.ts` for SSE drop recovery and removed the 1.5s sseDrop setTimeout fallback.

## Key Changes

### frontend/src/hooks/useMessages.ts
- Added `import { supabase } from "../lib/supabase"`
- Added `channelRef` and `isStreamingRef` refs
- `isStreamingRef.current = true` synced with `setIsStreaming(true)`
- Realtime subscription created before `streamMessage()` call, scoped to `messages-thread-{threadId}` with `filter: thread_id=eq.{threadId}`
- `isStreamingRef.current` guard prevents callbacks from processing during active SSE stream
- INSERT: replaces optimistic `temp-*` assistant placeholder or deduplicates by id
- UPDATE: merges by message id
- Finally block: `isStreamingRef.current = false` then `supabase.removeChannel(channelRef.current)`
- Removed the sseDrop/racedEmpty/1500ms setTimeout block entirely

## Self-Check: PASSED

All acceptance criteria met:
- `import { supabase }`: 1 match ✓
- `channelRef`: 3 matches (declare, assign, cleanup) ✓
- `isStreamingRef`: 4 matches ✓
- `messages-thread`: 1 match ✓
- `removeChannel`: 1 match in finally ✓
- `sseDrop`, `racedEmpty`, `1500`: 0 matches ✓
- `postgres_changes`: 1 match ✓
- `thread_id=eq`: 1 match ✓
- `npx tsc --noEmit`: exit 0, no errors ✓

## Commits

- `feat(055-04)`: add Realtime subscription for SSE drop recovery, remove sseDrop fallback
