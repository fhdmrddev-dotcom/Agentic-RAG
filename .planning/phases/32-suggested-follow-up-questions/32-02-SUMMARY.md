---
phase: 32-suggested-follow-up-questions
plan: "02"
subsystem: ui
tags: [react, typescript, vitest, tailwind, sse, suggestion-pills]

requires:
  - phase: 32-suggested-follow-up-questions plan 01
    provides: Backend suggestion_service + SSE events done/suggestions/stream_end

provides:
  - SuggestionPills React component with glassmorphic pill styling and animate-fadeSlideUp
  - Message.suggestions ephemeral field in types/index.ts
  - onSuggestions callback in streamMessage + SSE done/suggestions/stream_end event handling
  - Prop threading ChatArea→MessageList→MessageItem for Explorer mode gate
  - 5 unit tests for SUG-01 (render) and SUG-02 (click) behaviours

affects:
  - chat-ui
  - message-streaming
  - agent-mode-gating

tech-stack:
  added: []
  patterns:
    - Ephemeral message fields (not persisted, not loaded) — pattern from confidence; suggestions follows same approach
    - Prop-threading Explorer mode gate — showSuggestions=false gates pills without conditional logic in leaf components
    - Four-gate render condition for pills — !isStreaming && suggestions && length>0 && onSendMessage

key-files:
  created:
    - frontend/src/components/chat/SuggestionPills.tsx
    - frontend/src/__tests__/components/SuggestionPills.test.tsx
  modified:
    - frontend/src/types/index.ts
    - frontend/src/lib/api.ts
    - frontend/src/hooks/useMessages.ts
    - frontend/src/components/chat/MessageItem.tsx
    - frontend/src/components/chat/MessageList.tsx
    - frontend/src/components/chat/ChatArea.tsx

key-decisions:
  - "Legacy [DONE] literal removed from api.ts; replaced by JSON {type:done}/{type:stream_end} event types"
  - "stream_end is the true end-of-stream sentinel; done calls onDone() without closing the stream (allows suggestions to follow)"
  - "Explorer mode gate implemented via prop threading (showSuggestions=false) not conditional logic inside MessageItem"
  - "onSendMessage passed only to last assistant message in MessageList — historical messages never receive it, so pills cannot render on them"
  - "Four-gate render condition prevents pills during streaming, on history, in Explorer mode, and when backend never emits suggestions"

patterns-established:
  - "Ephemeral SSE fields pattern: add optional field to Message interface with comment noting it is not persisted and not loaded from DB"
  - "Prop threading for mode gates: feature enable/disable passed top-down as props rather than queried in leaf components"

requirements-completed: [SUG-01, SUG-02]

duration: 3min
completed: 2026-04-15
---

# Phase 32 Plan 02: Suggested Follow-Up Questions Summary

**Glassmorphic suggestion pill buttons wired end-to-end: SSE done/suggestions/stream_end event parsing in api.ts, ephemeral questions stored on Message via useMessages, SuggestionPills component rendering below citations, gated on General mode and !isStreaming**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-15T17:30:56Z
- **Completed:** 2026-04-15T17:33:56Z
- **Tasks:** 5
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments

- Created `SuggestionPills` component with exact Tailwind class spec (glassmorphic bg-card/60, hover:bg-primary/10, animate-fadeSlideUp, rounded-full pills)
- Wired complete SSE event pipeline: api.ts handles done/suggestions/stream_end, useMessages stores questions on assistant message
- Threaded `onSendMessage`+`showSuggestions` from ChatArea through MessageList into MessageItem for Explorer mode gate
- All 5 unit tests pass (SUG-01 render + SUG-02 click-to-submit)
- TypeScript clean across all 7 files with no regressions in CitationCard/ConfidenceBadge test suites

## Task Commits

1. **Task 1: Wave 0 — Create SuggestionPills test stub** - `a296845` (test)
2. **Task 2: Add suggestions field to Message type + onSuggestions to streamMessage** - `ef0c13d` (feat)
3. **Task 3: Wire onSuggestions callback in useMessages.ts** - `def8a40` (feat)
4. **Task 4: Create SuggestionPills component (turns Task 1 tests GREEN)** - `fc2563b` (feat)
5. **Task 5: Thread onSendMessage + showSuggestions through ChatArea→MessageList→MessageItem** - `153c8cb` (feat)

## Files Created/Modified

- `frontend/src/components/chat/SuggestionPills.tsx` — New component; glassmorphic pill buttons with onSelect callback
- `frontend/src/__tests__/components/SuggestionPills.test.tsx` — 5 unit tests for SUG-01/SUG-02
- `frontend/src/types/index.ts` — Added `suggestions?: string[]` ephemeral field to Message interface
- `frontend/src/lib/api.ts` — Added onSuggestions callback, removed legacy [DONE] literal, added done/suggestions/stream_end event handlers
- `frontend/src/hooks/useMessages.ts` — Wired onSuggestions callback storing questions on assistantId message
- `frontend/src/components/chat/MessageItem.tsx` — Imports SuggestionPills, adds onSendMessage prop, four-gate render after CitationList
- `frontend/src/components/chat/MessageList.tsx` — Extends Props with onSendMessage/showSuggestions, passes to last assistant only
- `frontend/src/components/chat/ChatArea.tsx` — Passes handleSend + agentMode!=explorer gate to MessageList

## Decisions Made

- Legacy `[DONE]` literal removed from `api.ts` — backend (Phase 32 Plan 01) no longer emits it; JSON event types replace it
- `stream_end` is the true end-of-stream sentinel; `done` calls `onDone()` (hides cursor) but leaves stream open for the suggestions event
- Explorer mode gated via prop threading not component-level conditionals — `showSuggestions=false` in ChatArea → `onSendMessage=undefined` on all items → pills never render
- `onSendMessage` passed only when `isLastAssistant && showSuggestions` — single expression prevents historical message pills without extra state

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing test failures in FolderNode, FolderTree, IngestionPage, MessageItem (legacy), and useDocuments test suites — confirmed pre-existing, not caused by this plan's changes. SuggestionPills, CitationCard, and ConfidenceBadge test suites all pass cleanly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- F-08 Suggested Follow-Up Questions fully shipped (backend Plan 01 + frontend Plan 02)
- v2.2 Trust & Compliance milestone complete — all 5 features shipped (F-01, F-05, F-02, F-06, F-08)
- Phase 32 complete; ready for milestone close

---
*Phase: 32-suggested-follow-up-questions*
*Completed: 2026-04-15*
