---
phase: 223-a-connection-leaves-a-record
plan: 04
subsystem: ui-chat
tags: [chat, connectors, session-state, durability, recovery]

requires:
  - phase: 223-01
    provides: "Column active_connector_ids jsonb on public.messages and MessageResponse model update"
provides:
  - "Backend persistence of active_connector_ids on user message rows distinguishing [] from None"
  - "Frontend Message type extension with activeConnectorIds?: string[]"
  - "threads.ts wire mapping from snake_case active_connector_ids to camelCase activeConnectorIds"
  - "MessageInput per-thread armed connectors restoration governed by Decision 2 Map.has() check and last user message anchor"
  - "ChatArea passing messages to MessageInput"
  - "Unit test coverage for Decision 2 restoration rules and SC#2 disarm preservation"
affects: [223-05]

tech-stack:
  added: []
  patterns: [Map.has() session cache restoration, user-message anchor hydration]

key-files:
  created: []
  modified:
    - backend/app/api/threads.py
    - frontend/src/types/index.ts
    - frontend/src/lib/api/threads.ts
    - frontend/src/components/chat/ChatArea.tsx
    - frontend/src/components/chat/MessageInput.tsx
    - frontend/src/components/chat/__tests__/MessageInput.connectors.test.tsx

key-decisions:
  - "Decision 2: Key the restore on Map.has(), never on the value. activeConnectorsByThread.get(id) returns undefined for ABSENT and [] for EXPLICITLY CLEARED. A reload re-arming cleared connectors violates SC#2."
  - "Decision 2 Rider 1: Seed from the last USER message. Assistant messages carry no armed set and must not disarm the thread."
  - "Decision 2 Rider 2: Distinguish [] from None on the wire and DB: [] stores as '[]'::jsonb and None as SQL NULL."

patterns-established:
  - "Armed connector selections anchor to the conversation via the last user message, surviving reloads and navigations without violating explicit user disarm."

requirements-completed:
  - CHAT-06
  - BUG-260902-03

duration: 15min
completed: 2026-09-02
---

# Phase 223 Plan 04 Summary

**Persisted armed connector selections to database messages and restored them in the chat composer using Decision 2's Map.has() semantics and last-user-message anchor.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-09-02T17:48:00Z
- **Completed:** 2026-09-02T18:03:00Z
- **Tasks:** 2 completed
- **Files modified:** 6

## Accomplishments
- Updated `send_message` in `backend/app/api/threads.py` to persist `active_connector_ids` into `public.messages`, maintaining the wire distinction between `None` (SQL NULL) and `[]` (`'[]'::jsonb`).
- Extended frontend `Message` in `frontend/src/types/index.ts` and mapper `_mapMessageResponse` in `frontend/src/lib/api/threads.ts` to deserialize `active_connector_ids` preserving explicit `[]`.
- Updated `frontend/src/components/chat/ChatArea.tsx` to pass `messages` into `MessageInput`.
- Implemented Decision 2 restoration in `frontend/src/components/chat/MessageInput.tsx`:
  - Uses `activeConnectorsByThread.has(draftKey)` to protect session state (including explicit `[]`).
  - When unvisited, seeds from the latest `role === 'user'` message having `activeConnectorIds !== undefined`.
  - Assistant messages without active connectors are skipped and do not disarm the thread.
- Authored comprehensive unit tests in `MessageInput.connectors.test.tsx` verifying:
  - Unvisited thread restoration from last user message.
  - Explicit empty array restoration (`[]`).
  - Trailing assistant message bypass.
  - `Map.has()` protection when user turns off connectors in session (persists disarmed state across thread switches).

## Task Commits
- `a922b556b`: feat(223-04): persist and restore armed connectors per thread with Map.has() check

## Verification
- Unit test suite: `npx vitest run MessageInput.connectors` (9 passed, 0 failed).
- Composer drafts test suite: `npx vitest run MessageInputDrafts` (5 passed, 0 failed).
