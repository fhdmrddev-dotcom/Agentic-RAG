---
phase: 45-chat-ux-fixes
plan: 01
subsystem: frontend
tags: [chat, ux, confirmation-dialog, ghost-content, alert-dialog]
dependency_graph:
  requires: ["44-sse-stop-reliability"]
  provides: ["CHAT-01", "CHAT-02"]
  affects: ["NavPanel", "ChatArea", "useMessages"]
tech_stack:
  added: ["@radix-ui/react-alert-dialog"]
  patterns: ["AlertDialog confirmation flow", "clearMessages on thread switch"]
key_files:
  created:
    - frontend/src/components/ui/alert-dialog.tsx
  modified:
    - frontend/src/components/layout/NavPanel.tsx
    - frontend/src/components/chat/ChatArea.tsx
    - frontend/src/hooks/useMessages.ts
    - frontend/package.json
    - frontend/package-lock.json
decisions:
  - AlertDialog built on @radix-ui/react-alert-dialog (separate primitive from regular Dialog)
  - clearMessages resets messages synchronously before loadMessages to prevent ghost content flash
  - ChatLayout mobile drawer does NOT get confirmation dialog (no delete button exists there)
  - useThreads does NOT need changes (deleteThread already sets selectedThread to null correctly)
metrics:
  duration: 136s
  completed: "2026-04-23"
---

# Phase 45 Plan 01: Chat Delete Confirmation & Ghost Content Fix Summary

Confirmation dialog before thread deletion and message state cleanup to eliminate ghost content after thread delete+new chat.

## What Changed

### Task 1: AlertDialog UI Component
Created `frontend/src/components/ui/alert-dialog.tsx` — a shadcn/ui-style confirmation dialog built on `@radix-ui/react-alert-dialog`. Follows the same pattern as the existing `dialog.tsx` but adds:
- **Destructive action button**: `bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/30`
- **Non-destructive cancel button**: `ghost-border bg-transparent hover:bg-accent`
- **Deep Midnight glassmorphism**: `bg-card/95 backdrop-blur-xl border border-border/30 shadow-2xl shadow-black/30 rounded-xl`
- **Overlay**: `bg-black/60 backdrop-blur-sm` (softer than regular dialog's `bg-black/80`)
- **Animations**: `animate-in fade-in zoom-in-95` / `animate-out fade-out zoom-out-95`

### Task 2: Confirmation Flow & Ghost Content Fix
- **useMessages.ts**: Added `clearMessages()` callback that resets messages to `[]`, sets `isStreaming` to `false`, aborts any in-flight request, and resets `isSendingRef`. Exported in the `UseMessages` interface.
- **ChatArea.tsx**: Updated the thread-switching `useEffect` to call `clearMessages()` synchronously when `thread` is null or when the thread ID changes. This ensures old messages are removed instantly before `loadMessages` fetches new ones — no ghost content flash.
- **NavPanel.tsx**: Replaced the immediate `onDeleteThread(thread.id)` call with a two-step confirmation flow: clicking Delete opens an `AlertDialog` with destructive styling. Only clicking "Delete" in the dialog executes the deletion. Added `AlertCircle` icon in the dialog header for visual emphasis.

## Requirements Validated

| Requirement | Status | Evidence |
|------------|--------|---------|
| CHAT-01 | ✅ | AlertDialog requires explicit "Delete" click before thread deletion executes |
| CHAT-02 | ✅ | clearMessages runs synchronously on thread change, eliminating ghost content flash |

## Deviations from Plan

None — plan executed exactly as written.

## Threat Flags

No new threat surface introduced. The confirmation dialog is a client-side UX safeguard (T-45-03 accepted). Backend RLS provides actual security (T-45-01 accepted). Audit logging already exists via `write_audit_entry` (T-45-02 mitigated).

## Known Stubs

None.

## Commits

| Commit | Message |
|--------|---------|
| `4baab87` | feat(45-01): create AlertDialog UI component with destructive action styling |
| `efd8a06` | feat(45-01): wire confirmation dialog into thread deletion and clear ghost content |

## Self-Check

- [x] `frontend/src/components/ui/alert-dialog.tsx` exists
- [x] `frontend/src/components/layout/NavPanel.tsx` contains `deleteConfirmId` and `AlertDialog`
- [x] `frontend/src/hooks/useMessages.ts` exports `clearMessages`
- [x] `frontend/src/components/chat/ChatArea.tsx` calls `clearMessages` in useEffect
- [x] TypeScript compilation passes (`npx tsc --noEmit` — no errors)
- [x] Commit `4baab87` exists
- [x] Commit `efd8a06` exists

## Self-Check: PASSED
