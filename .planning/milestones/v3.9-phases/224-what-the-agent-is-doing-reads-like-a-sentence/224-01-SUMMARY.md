---
phase: 224-what-the-agent-is-doing-reads-like-a-sentence
plan: 01
subsystem: ui
tags: [vocabulary, chat, panel, seam, tool-names]

requires:
  - phase: 223
    provides: durable audit logging & connector thread state
provides:
  - "Shared frontend/src/lib/toolNames.ts re-exporting toolName and TOOL_PHRASES"
  - "toolLabel fallback in lib/toolMeta.ts resolving via toolName rather than raw machine tokens"
  - "SeamCard.tsx pruned per Winner D (workspace_write and write_todos arms deleted; ask_user preserved)"
  - "SeamCard header formatted with human-readable phrase toolName(kind) without CSS uppercase"
  - "33 lines of dead parsing code pruned from MessageItem.tsx"
  - "Seam.test.tsx pruned from 10 to 8 passing tests"
affects: [224-02, 224-03, 224-04, 224-05]

tech-stack:
  added: []
  patterns: [single source tool phrases across chat and workflows, subtraction-based extraction]

key-files:
  created:
    - frontend/src/lib/toolNames.ts
    - frontend/src/lib/__tests__/toolNames.test.ts
  modified:
    - frontend/src/lib/toolMeta.ts
    - frontend/src/components/panel/SeamCard.tsx
    - frontend/src/components/panel/__tests__/Seam.test.tsx
    - frontend/src/components/chat/MessageItem.tsx

key-decisions:
  - "D-224-03: Shared tool vocabulary re-exported via @/lib/toolNames without cross-domain leakage"
  - "D-224-04: Winner D implemented in SeamCard.tsx (pruning write_todos and workspace_write arms; preserving ask_user)"
  - "D-224-04b: Discharged hot-file extraction on MessageItem.tsx by subtraction (-33 lines)"

requirements-completed:
  - SEED-240

duration: 10min
completed: 2026-09-03
---

# Phase 224 Plan 01 Summary

**Shared tool vocabulary established via `@/lib/toolNames` and duplicate `SeamCard` transcript arms pruned per Winner D, discharging 33 lines from `MessageItem.tsx` by subtraction.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-09-03T00:15:00Z
- **Completed:** 2026-09-03T00:24:00Z
- **Tasks:** 2 completed
- **Files modified:** 6 (2 created, 4 modified)
- **Net code delta:** +64 / -115 lines (-51 net lines)

## Accomplishments

1. **Shared Tool Vocabulary**:
   - Created [`frontend/src/lib/toolNames.ts`](file:///c:/Vibe%20Apps/Agentic%20RAG/frontend/src/lib/toolNames.ts) re-exporting `toolName` and `TOOL_PHRASES` from `@/components/workflows/toolNames`.
   - Wired `toolName` into [`frontend/src/lib/toolMeta.ts`](file:///c:/Vibe%20Apps/Agentic%20RAG/frontend/src/lib/toolMeta.ts) so that any unspecialized schema tool resolves to its human phrase (e.g. "Track its to-dos", "Write a file", "Ask a person") instead of raw machine snake_case tokens.
   - Added unit test suite [`frontend/src/lib/__tests__/toolNames.test.ts`](file:///c:/Vibe%20Apps/Agentic%20RAG/frontend/src/lib/__tests__/toolNames.test.ts) (3 tests, all passing).

2. **Winner D SeamCard Pruning**:
   - Pruned `workspace_write` and `write_todos` reload arms from [`frontend/src/components/panel/SeamCard.tsx`](file:///c:/Vibe%20Apps/Agentic%20RAG/frontend/src/components/panel/SeamCard.tsx). The right-hand Workspace panel is the canonical durable view; duplicate transcript cards produced noise without information.
   - Preserved `ask_user` as the sole surviving arm, closing the reload Q&A transcript gap.
   - Replaced uppercase monospace header styling with standard phrase copy via `toolName(kind)` ("Ask a person").

3. **Subtraction-Based Hot-File Discharge in `MessageItem.tsx`**:
   - Updated `seamKindFor` in [`frontend/src/components/chat/MessageItem.tsx`](file:///c:/Vibe%20Apps/Agentic%20RAG/frontend/src/components/chat/MessageItem.tsx) to match only `ask_user`.
   - Deleted 35 lines of dead JSON parsing and version-extraction logic from `seamCardPayloadFor`, reducing `MessageItem.tsx` lines from 863 to 830 (-33 lines).

4. **Test & Mechanical Gate Integrity**:
   - Pruned deleted arm tests in [`frontend/src/components/panel/__tests__/Seam.test.tsx`](file:///c:/Vibe%20Apps/Agentic%20RAG/frontend/src/components/panel/__tests__/Seam.test.tsx) (8 tests remaining, all passing).
   - TypeScript check (`npx tsc -p tsconfig.app.json`) confirmed unchanged at 66 errors (0 new errors).
   - Vitest count gate confirmed: `188/188 pinned files present, no per-file decrease, 0 failing`.
