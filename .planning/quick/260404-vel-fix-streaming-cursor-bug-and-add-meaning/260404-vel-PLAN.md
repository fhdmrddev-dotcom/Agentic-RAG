# Quick Task 260404-vel: Fix streaming cursor bug and add meaningful agent-working indicator

**Complexity:** ✅ Simple — two file edits, well-understood logic

## Context

Two related issues in `MessageItem.tsx`:

1. **Bug:** The blinking cursor (`animate-pulse` block) shows at the end of message text whenever `isStreaming` is true, even when tool calls are actively running (text has finished streaming but code/tools still executing). This misleads the user into thinking text is still being typed.

2. **Bug:** In `useMessages.ts`, if `streamMessage` throws an error, `setIsStreaming(false)` is never called (it only runs in `onDone` callback), leaving `isStreaming` stuck as `true` indefinitely — causing the cursor to persist after completion.

3. **Enhancement:** Replace the misleading cursor (when tools are running) with a meaningful "Agent is working..." status indicator that tells the user the agent is still processing.

## Files

- `frontend/src/components/chat/MessageItem.tsx` — cursor logic fix + new indicator
- `frontend/src/hooks/useMessages.ts` — setIsStreaming(false) in error path

## Tasks

### Task 1: Fix `useMessages.ts` — ensure isStreaming resets on error

**Action:** Add `setIsStreaming(false)` to a catch block in `sendMessage` so the streaming state always resets even if `streamMessage` throws.

**Current code** (lines 57-182):
```tsx
try {
  await streamMessage(...)
} finally {
  isSendingRef.current = false
}
```

**Fix:** Add explicit `setIsStreaming(false)` in a `catch` before the finally:
```tsx
try {
  await streamMessage(...)
} catch {
  setIsStreaming(false)
} finally {
  isSendingRef.current = false
}
```

**Verify:** If stream errors out, `isStreaming` returns to false.

**Done:** `catch` block added to `sendMessage` in `useMessages.ts`.

---

### Task 2: Fix `MessageItem.tsx` — cursor and working indicator

**Action:**
1. Compute `hasRunningTools` = any tool_call with `status === "running"`
2. Fix cursor: only render when `isStreaming && !hasRunningTools` (text is actively streaming)
3. Add "Agent is working" indicator: render below content when `isStreaming && hasRunningTools && message.content`

**Current cursor code** (line 68-70):
```tsx
{isStreaming && (
  <span className="inline-block w-2 h-4 ml-0.5 bg-primary/50 animate-pulse rounded-sm align-text-bottom" />
)}
```

**Fix cursor:**
```tsx
{isStreaming && !hasRunningTools && (
  <span className="inline-block w-2 h-4 ml-0.5 bg-primary/50 animate-pulse rounded-sm align-text-bottom" />
)}
```

**New "working" indicator** (added after the content div, inside the outer flex-1 div):
```tsx
{isStreaming && hasRunningTools && message.content && (
  <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
    <span className="flex gap-1 items-center">
      <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-dotBounce" style={{ animationDelay: "0ms" }} />
      <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-dotBounce" style={{ animationDelay: "160ms" }} />
      <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-dotBounce" style={{ animationDelay: "320ms" }} />
    </span>
    <span className="italic">Agent is working</span>
  </div>
)}
```

**Verify:** 
- During tool execution with text content: cursor gone, working indicator visible
- After stream complete (`isStreaming=false`): no indicators
- Pure text streaming (no tools): cursor still shows correctly

**Done:** Both changes applied to `MessageItem.tsx`.
