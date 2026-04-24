---
phase: 040-user-feedback-loop-frontend
plan: "01"
subsystem: frontend
tags: [feedback, ui, api, chat]
dependency_graph:
  requires: [039-user-feedback-loop-backend]
  provides: [MessageFeedback component, submitFeedback API, getFeedbackStats API]
  affects: [frontend/src/components/chat/MessageItem.tsx]
tech_stack:
  added: []
  patterns: [optimistic-update, fire-and-forget, group-hover reveal, inline reason selector]
key_files:
  created:
    - frontend/src/components/chat/MessageFeedback.tsx
  modified:
    - frontend/src/lib/api.ts
    - frontend/src/components/chat/MessageItem.tsx
decisions:
  - submitFeedback returns raw Response so caller handles 409 (already-rated) silently
  - Optimistic state set before await; reverted on non-409 error, kept on 409
  - ThumbsDown shows inline ReasonSelector before submitting (not fire-and-forget)
  - group CSS class on outer MessageItem div enables group-hover opacity transition
metrics:
  duration: ~8min
  completed: "2026-04-18"
  tasks_completed: 3
  files_modified: 3
---

# Phase 040 Plan 01: Feedback API Layer and MessageFeedback Component Summary

One-liner: Thumbs-up/down feedback UI wired to POST /feedback with inline ReasonSelector, optimistic state, and silent 409 handling.

## What Was Built

Three tasks executed atomically:

1. **api.ts additions** — `FeedbackRequest`, `DownvotedDocument`, `FeedbackStats` interfaces exported. `submitFeedback` returns raw `Response` (no throw on HTTP errors) so callers handle 409 themselves. `getFeedbackStats` throws on non-ok for standard error propagation.

2. **MessageFeedback.tsx** — New component with three-state machine: idle -> (thumbs-up: optimistic-positive | thumbs-down: show-reason-selector -> optimistic-negative) -> rated. After rating, both buttons remain visible (`opacity-100`). Before rating, hidden until parent row hover (`group-hover:opacity-100`). ReasonSelector has 4 fixed options plus "Skip for now" (passes `null` reason).

3. **MessageItem.tsx wiring** — `"group"` added to outer assistant message div, `MessageFeedback` imported and rendered below `SuggestionPills` inside the `message.content` truthy branch, guarded by `!isStreaming && message.role === "assistant" && message.content`.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 48daca5 | feat(040-01): add submitFeedback and getFeedbackStats to api.ts |
| 2 | 05b7308 | feat(040-01): create MessageFeedback component with thumbs + ReasonSelector |
| 3 | 016e419 | feat(040-01): wire MessageFeedback into MessageItem below SuggestionPills |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all feedback interactions are fully wired to the live POST /feedback endpoint.

## Threat Flags

No new threat surface introduced beyond what is documented in the plan's threat model (T-040-01 through T-040-07). `getAuthHeaders()` applied on all outbound requests per T-040-01.

## Self-Check: PASSED

- `frontend/src/components/chat/MessageFeedback.tsx` — exists
- `frontend/src/lib/api.ts` — contains `submitFeedback`, `getFeedbackStats`, `FeedbackRequest`, `FeedbackStats`, `DownvotedDocument`
- `frontend/src/components/chat/MessageItem.tsx` — contains `group flex gap-3`, `MessageFeedback messageId`
- Commits 48daca5, 05b7308, 016e419 — verified in git log
- `tsc --noEmit` — zero errors
