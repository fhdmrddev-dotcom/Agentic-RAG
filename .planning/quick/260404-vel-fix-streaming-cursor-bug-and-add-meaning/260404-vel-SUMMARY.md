# Quick Task 260404-vel — Summary

**Task:** Fix streaming cursor bug and add meaningful agent-working indicator
**Date:** 2026-04-04
**Status:** Complete

## What Was Done

### Bug Fix 1: `useMessages.ts` — isStreaming stuck on error

Added a `catch` block to `sendMessage` so `setIsStreaming(false)` is called even when `streamMessage` throws. Previously, if the SSE stream failed mid-way, `isStreaming` would remain `true` indefinitely (since `onDone` was only called on success), leaving the cursor indicator frozen on screen.

**File:** `frontend/src/hooks/useMessages.ts`

### Bug Fix 2 + Enhancement: `MessageItem.tsx` — cursor and working indicator

**Bug fixed:** The blinking cursor (`animate-pulse` block) was showing at the end of message text whenever `isStreaming` was true, even during tool execution (after text had finished streaming). Cursor now only renders when `isStreaming && !hasRunningTools`.

**Enhancement added:** When `isStreaming && hasRunningTools && message.content` (tools are actively running after text is done), a clear "Agent is working" indicator with three bouncing dots appears below the message text. This replaces the misleading cursor and tells the user the agent is still processing.

**File:** `frontend/src/components/chat/MessageItem.tsx`

## Behavior Before / After

| Scenario | Before | After |
|----------|--------|-------|
| Stream error | Cursor frozen forever | Cursor clears immediately |
| Tools running, text done | Blinking cursor at end of text | "Agent is working" dots indicator |
| Text actively streaming | Blinking cursor | Blinking cursor (unchanged) |
| Stream complete | No cursor | No cursor (unchanged) |
