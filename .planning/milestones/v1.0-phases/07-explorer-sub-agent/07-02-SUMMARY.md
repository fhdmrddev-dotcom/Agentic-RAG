---
phase: 07-explorer-sub-agent
plan: 02
subsystem: frontend
tags: [explorer-agent, agent-mode, mode-selector, chat-ui, dropdown]
dependency_graph:
  requires:
    - phase: 07-01
      provides: [explorer-agent-backend, agent_mode-field]
  provides: [agent-mode-selector-ui, agentMode-state, agent_mode-in-post-body]
  affects: [frontend/src/lib/api.ts, frontend/src/hooks/useMessages.ts, frontend/src/components/chat/ChatArea.tsx, frontend/src/components/chat/MessageInput.tsx]
tech_stack:
  added: []
  patterns: [prop-threading, controlled-dropdown, stateful-toolbar]
key_files:
  created: []
  modified:
    - frontend/src/lib/api.ts
    - frontend/src/hooks/useMessages.ts
    - frontend/src/components/chat/ChatArea.tsx
    - frontend/src/components/chat/MessageInput.tsx
decisions:
  - "agentMode state lives in ChatArea — resets automatically on thread switch because ChatArea remounts per thread"
  - "agentMode defaults to 'default' — Explorer mode is opt-in, no change to existing behavior"
  - "agent_mode sent as agentMode ?? 'default' in POST body — backend always receives the field"
metrics:
  duration: "~2 min"
  completed: "2026-03-22"
  tasks: 1
  files: 4
---

# Phase 07 Plan 02: Explorer Mode Frontend Summary

**One-liner:** General/Explorer mode selector dropdown wired through the chat frontend — selecting Explorer sends `agent_mode="explorer"` to the backend.

## What Was Built

The `streamMessage` API function now accepts an `agentMode` parameter and includes `agent_mode` in the POST body. `useMessages.sendMessage` threads the parameter through. `ChatArea` manages `agentMode` state (defaults `"default"`, resets on thread switch). `MessageInput` renders a Compass-icon dropdown in the toolbar alongside the model selector with General and Explorer options; active mode is visually highlighted.

## Tasks Completed

| Task | Name | Files |
|------|------|-------|
| 1 | Thread agentMode through API/hook layers + mode selector UI | api.ts, useMessages.ts, ChatArea.tsx, MessageInput.tsx |

## Requirements Satisfied

- **AGENT-01:** Explorer mode accessible from chat UI via dropdown selector
- **AGENT-03:** Explorer mode triggers synthesized KB-tool responses via backend branching on `agent_mode`

## Deviations from Plan

None — implementation matches plan spec exactly.

## Known Stubs

None — mode resets on thread switch as documented v1.0 behavior (agentMode state lives in ChatArea, which remounts per thread).

## Self-Check: PASSED
