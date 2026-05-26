---
id: BUG-260526-03
title: Output files not visible after page reload — finalOutputFiles SSE-only
reported: 2026-05-26
surface: Agentic-RAG
severity: medium
status: open
affected_areas: [frontend/chat, backend/streaming]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: v2.5-dev
  commit: 1652b30
  date: 2026-05-26
---

# BUG-260526-03: Output files not visible after page reload

## What we observed

After an agent generates output files (e.g., PPTX via execute_code), the "Final outputs" panel at the bottom of the assistant message only appears during live SSE streaming. After page reload (F5 or thread switch + return), the panel is gone. Users must manually uncollapse the tool panel to find their files.

Observed on both DeepSeek (thread `5e7e9f54`, 4 output files in tool_calls) and Kimi (thread `df8e3024`, 7 output files in tool_calls).

## Why it matters

Output files are the primary deliverable for code-execution tasks (PPTX, CSV, charts). Hiding them behind a collapsed tool panel after reload means users can't find their files without knowing the UI deeply. This is the #1 thing they came to get.

## Hypothesized cause

`finalOutputFiles` is set via the `final_output_files` SSE event during streaming (`api.ts:452` → `StreamsProvider.tsx:580` → `MessageItem.tsx:323`). This is an in-memory property on the message object — it is NOT persisted to the `messages` table in Supabase.

When messages are loaded from DB via `_mapMessageResponse` (`api.ts:61-98`), `finalOutputFiles` is not reconstructed. The output files data EXISTS in the `tool_calls` JSONB column (each `execute_code` result has an `output_files` array), but nothing extracts it on DB load.

## Surface classification

Agentic-RAG — needs either DB persistence of finalOutputFiles or client-side reconstruction from tool_calls on message load.

## Suggested routing

- **Fold into in-flight phase:** n/a (076.2 closing)
- **Defer to future phase / milestone:** Next UX polish phase
- **Plant as seed:** n/a
- **External — note only:** no

## Workarounds (prompt-side, code-side, or UI-side)

Users can click the collapsed run card header to expand the tool panel, then find output files inside the ExecuteCodeBody cards. Not discoverable without guidance.

## Reference / evidence links

- `frontend/src/lib/api.ts:61-98` (_mapMessageResponse — no finalOutputFiles reconstruction)
- `frontend/src/lib/api.ts:452` (SSE dispatch for final_output_files)
- `frontend/src/providers/StreamsProvider.tsx:580` (stamps on message during streaming)
- `frontend/src/components/chat/MessageItem.tsx:323-344` (renders Final outputs panel)
- `backend/app/api/threads.py:3400-3409` (emits final_output_files SSE)
- Phase 076.2 VALIDATION.md BUG-260526-03 entry
