---
id: BUG-260712-01
title: Killed-workflow launch renders an empty chat card instead of the "disabled by administrator" message
reported: 2026-07-12
surface: Agentic-RAG
severity: minor
status: folded
affected_areas: [frontend/streaming, workflows, chat]
folded_into: "174"
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: HEAD (post-148 execution, 2026-07-12)
  date: 2026-07-12
---

# BUG-260712-01: Killed-workflow launch renders an empty chat card instead of the "disabled by administrator" message

## What we observed

Observed live during Phase 148 UAT (2026-07-12). With the **Workflows kill-switch** (Control Plane tab, FLAG-01 / Phase 147) turned OFF:
- Workflows still appear in the catalog and the composer's Harness picker — **expected** (the kill-switch is a run-block panic button, not a visibility control; it deliberately does not hide the catalog and does not touch in-flight runs).
- Launching a workflow from chat is correctly refused — **expected** (`threads.py:949` returns `403 "Workflows are currently disabled by the administrator"` before inserting any run/message).
- BUT the chat area shows the **workflow title with an empty body** — no message explaining why it did not run. **This is the defect.**

## Why it matters

Minor (not security/enforcement — the run is correctly blocked; only the *explanation* is missing). But it is a run-honesty gap: the user sees a blank workflow card and cannot tell whether it is loading, broken, or disabled. The backend refuses cleanly with an honest detail string; the frontend just isn't surfacing it.

## Hypothesized cause

`StreamsProvider.sendMessage` writes two optimistic placeholders (user + assistant) **synchronously**, then calls `postMessage`. On a workflow launch the kill-switch 403 is thrown by `postMessage` (a plain POST, *before* any SSE stream opens), so it lands in the `sendMessage` catch block — not the `onTerminal` SSE-error path. The catch does not appear to replace the empty assistant placeholder with `ApiError.message`, leaving a blank card. (After the Phase-148 code-review fix CR-02, this same 403 correctly no longer triggers the wrong "administrators only" feature-bounce — but the *correct* handling, rendering the kill-switch detail in chat, was never wired.)

## Surface classification

`Agentic-RAG` — this app. It is a **Phase-147 FLAG-01 kill-switch UX** concern exposed at the chat render (`StreamsProvider.tsx` / the assistant-placeholder path), NOT a Phase-148 defect. Cross-check at `/gsd:discuss-phase` for any phase touching the workflows kill-switch UX or the chat error-render path.

## Suggested fix (scoped)

In `StreamsProvider.sendMessage`'s catch block: when `postMessage` throws an `ApiError` (esp. 403), replace the empty assistant placeholder for that send with an honest error bubble carrying `err.message` (e.g. "Workflows are currently disabled by the administrator"), and clear the harness workflow-lock seeded at kickoff if the launch never registered a run. One file (`StreamsProvider.tsx`), ~10 lines. G-5 hot file — do via `/gsd:quick` with a render regression check, not an inline edit. Also worth a companion check: the same catch should surface the app-layer ban 403 honestly (banned mid-send).
