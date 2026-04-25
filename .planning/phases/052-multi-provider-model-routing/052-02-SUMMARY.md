---
phase: "052-multi-provider-model-routing"
plan: "02"
subsystem: "frontend"
tags: ["model-routing", "fallback", "settings", "sub-agent", "sse", "validation"]
dependency_graph:
  requires:
    - "052-01 — resolved_sub_agent_model in GET /api/settings"
    - "052-01 — 422 validation in PATCH /api/settings"
    - "052-01 — fallback_model SSE event from event_stream()"
  provides:
    - "updateSettings() parses FastAPI 422 detail and throws it as Error message"
    - "FullAppSettings interface includes resolved_sub_agent_model: string"
    - "streamMessage() accepts onFallbackModel callback; calls it on fallback_model SSE event"
    - "SettingsPage inline error under sub-agent model dropdown on 422 failure"
    - "Save AI Model button disabled while subAgentModelError is non-null"
    - "Title drafting and Follow-up suggestions read-only label rows in SettingsPage"
    - "Ephemeral amber fallback banner in ChatArea (4-second auto-dismiss)"
  affects:
    - "frontend/src/lib/api.ts"
    - "frontend/src/pages/SettingsPage.tsx"
    - "frontend/src/hooks/useMessages.ts"
    - "frontend/src/components/chat/ChatArea.tsx"
tech_stack:
  added: []
  patterns:
    - "FastAPI 422 detail parsing: try JSON parse, check detail type (string vs array), re-throw as Error"
    - "Ephemeral banner state: useState<string | null> + setTimeout auto-dismiss in hook"
    - "positional SSE callback pattern: onFallbackModel added after onPlanning in streamMessage signature"
    - "Inline field error routing: catch block inspects error message to route to field vs global error state"
key_files:
  created: []
  modified:
    - "frontend/src/lib/api.ts"
    - "frontend/src/pages/SettingsPage.tsx"
    - "frontend/src/hooks/useMessages.ts"
    - "frontend/src/components/chat/ChatArea.tsx"
decisions:
  - "fallbackNotice state lives in useMessages hook (not ChatArea) so it co-locates with the streamMessage call that triggers it"
  - "ChatArea destructures fallbackNotice from useMessages and renders the amber banner above MessageList"
  - "Dropdown onChange also clears subAgentModelError — better UX than waiting for next save attempt"
metrics:
  duration: "~25 minutes"
  completed: "2026-04-25"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 4
  files_created: 0
---

# Phase 052 Plan 02: Frontend Validation, Resolved Model Labels, and Fallback Banner Summary

Frontend counterpart to the backend model-routing foundation: 422 error parsing in updateSettings(), resolved_sub_agent_model labels in SettingsPage, and ephemeral fallback_model SSE banner wired through useMessages hook to ChatArea.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update api.ts — 422 error parsing, FullAppSettings field, streamMessage onFallbackModel | 407efb9 | api.ts, useMessages.ts, ChatArea.tsx |
| 2 | Update SettingsPage.tsx — inline model error, resolved model labels, fallback notice wiring | 0bff2c4 | SettingsPage.tsx |

## What Was Built

### Task 1: api.ts + Hook + Banner

**api.ts changes:**
- `FullAppSettings` interface gains `resolved_sub_agent_model: string` field
- `updateSettings()` replaces generic `throw new Error("Failed to save settings")` with a try/catch that parses the response JSON — if `detail` is a string, throws it directly; if it's a FastAPI validation array, joins the messages; falls through to generic on parse failure
- `streamMessage()` gains `onFallbackModel?: (originalModel: string, fallbackModel: string) => void` as a new optional parameter (before `signal`); the SSE parser handles `fallback_model` events by calling this callback

**useMessages.ts changes:**
- Adds `fallbackNotice: string | null` to the `UseMessages` interface and hook return
- Passes `onFallbackModel` callback to `streamMessage` that sets a notice message and auto-clears after 4 seconds

**ChatArea.tsx changes:**
- Destructures `fallbackNotice` from `useMessages()`
- Renders an amber `text-xs` banner above `MessageList` when `fallbackNotice` is non-null

### Task 2: SettingsPage.tsx

- Adds `subAgentModelError: string | null` and `resolvedSubAgentModel: string` state
- Hydrates `resolvedSubAgentModel` from `data.resolved_sub_agent_model` on settings load
- `handleSaveAIModel` clears `subAgentModelError` on each save attempt; catch block routes errors containing "is not available for provider" to `setSubAgentModelError`, everything else to `setError`
- Sub-agent model dropdown now clears `subAgentModelError` on change (immediate UX feedback)
- Inline `<p className="text-xs text-destructive mt-1">` error paragraph rendered inside the FieldRow after the select element
- Save AI Model button: `disabled={savingAI || subAgentModelError !== null}`
- Two read-only FieldRow entries added after the sub-agent model FieldRow: "Title drafting" and "Follow-up suggestions" — show `{resolvedSubAgentModel || "auto"} (auto)` when no override is set, or just the override model name when set

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Correctness] Added subAgentModelError clear on dropdown onChange**
- **Found during:** Task 2
- **Issue:** Plan specified clearing subAgentModelError only on save attempt. Without clearing on dropdown change, the error message would linger even after the user corrects the value, confusing the UX (the Save button would remain disabled despite a valid selection)
- **Fix:** Added `setSubAgentModelError(null)` to the dropdown's `onChange` handler
- **Files modified:** `frontend/src/pages/SettingsPage.tsx`
- **Commit:** 0bff2c4

**2. [Rule 2 - Architecture] fallbackNotice state placed in useMessages (not SettingsPage)**
- **Found during:** Task 1 — analyzing where streamMessage is called
- **Issue:** Plan mentioned SettingsPage as fallback notice location but streamMessage is called in useMessages.ts. Placing fallbackNotice in SettingsPage would require drilling the setter down through ChatArea → useMessages, breaking encapsulation
- **Fix:** fallbackNotice state and the onFallbackModel callback handler live in useMessages hook; ChatArea destructures and renders the banner
- **Files modified:** `frontend/src/hooks/useMessages.ts`, `frontend/src/components/chat/ChatArea.tsx`
- **Commit:** 407efb9

## Threat Surface Scan

No new network endpoints introduced. The 422 body parsing in `updateSettings()` uses a try/catch that falls through to a generic message on parse failure (T-052-06 mitigated). React auto-escapes JSX text content — server-supplied detail strings are displayed safely without HTML injection risk (T-052-07 accepted as documented).

## Known Stubs

None — all data flows are wired:
- `resolved_sub_agent_model` is populated from live backend on each settings GET (backend provides, frontend consumes)
- `subAgentModelError` is driven by actual 422 responses from the backend validation added in plan 052-01
- `fallbackNotice` is driven by actual `fallback_model` SSE events from the backend fallback logic added in plan 052-01

## Self-Check: PASSED

- `frontend/src/lib/api.ts` contains `resolved_sub_agent_model` in FullAppSettings — verified (line 419)
- `frontend/src/lib/api.ts` contains `onFallbackModel` parameter and SSE handler — verified (lines 121, 207-208)
- `frontend/src/lib/api.ts` contains `err.detail` parsing in updateSettings — verified (lines 476-477)
- `frontend/src/pages/SettingsPage.tsx` contains `subAgentModelError` state, setter calls, and JSX — verified (lines 524, 573, 595, 821-822)
- `frontend/src/pages/SettingsPage.tsx` contains `resolvedSubAgentModel` state, hydration, and label rows — verified (lines 525, 560, 826, 833)
- `frontend/src/pages/SettingsPage.tsx` contains Save button `disabled={savingAI || subAgentModelError !== null}` — verified (line 847)
- `frontend/src/hooks/useMessages.ts` contains `fallbackNotice` state, callback, and return — verified (lines 8, 23, 330)
- `frontend/src/components/chat/ChatArea.tsx` destructures and renders `fallbackNotice` — verified (lines 27, 193-195)
- Commits 407efb9 and 0bff2c4 exist in git log — verified
- TypeScript compiler (`npx tsc --noEmit`) reports zero errors — verified
