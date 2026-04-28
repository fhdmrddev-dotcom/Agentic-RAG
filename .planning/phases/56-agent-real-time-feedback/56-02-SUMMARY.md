---
phase: 56-agent-real-time-feedback
plan: 02
subsystem: frontend
tags: [sse, react, ux, tool-call-panel, streaming, skills]

# Dependency graph
requires:
  - phase: 56-agent-real-time-feedback
    plan: 01
    provides: iteration_start SSE event from backend agentic loop

provides:
  - SkillActivation type and iterationCount/activatedSkills fields on Message
  - onIterationStart callback in streamMessage() SSE parser
  - Step N — task phase label header in ToolCallPanel (D-03/D-05/D-07)
  - SkillRow inline component for skill activation display (D-08/D-09)
  - displayItems interleave of tool calls and skill activations by timestamp
  - taskPhaseLabel() helper in toolMeta.ts

affects:
  - 56-03-PLAN (Plan 03): MessageItem and useMessages changes are complete; Plan 03 can extend useMessages for Realtime reconnect without conflicts

# Tech tracking
tech-stack:
  added: []
  patterns:
    - displayItems union type merges toolCalls and activatedSkills sorted by occurredAt/startedAt timestamp
    - isSynthesizing derived purely from existing component state — no new SSE event or prop
    - Step N prefix uses iterationCount + 1 display (0-based index from backend)
    - SkillRow as inline function component within same file as ToolCallPanel (SubAgentBlock pattern)

key-files:
  created: []
  modified:
    - frontend/src/types/index.ts (SkillActivation interface + iterationCount/activatedSkills on Message)
    - frontend/src/lib/api.ts (onIterationStart param + iteration_start SSE dispatch)
    - frontend/src/hooks/useMessages.ts (onIterationStart callback + activatedSkills array append)
    - frontend/src/lib/toolMeta.ts (taskPhaseLabel function)
    - frontend/src/components/chat/ToolCallPanel.tsx (Props, headerLabel IIFE, SkillRow, displayItems)
    - frontend/src/components/chat/MessageItem.tsx (pass iterationCount/activatedSkills to ToolCallPanel)

key-decisions:
  - "taskPhaseLabel default is 'Thinking...' not 'Working...' — matches D-07 and eliminates stale fallback"
  - "isSynthesizing derived from !allDone && !isPlanning && !activeTool && toolCalls.length > 0 — pure state derivation, no new SSE"
  - "displayItems union type merges by timestamp so skill rows appear inline in chronological order with tool rows"
  - "Legacy activatedSkill field retained on Message — backward compat for MessageItem.tsx Zap indicator and DB-loaded messages"
  - "Pre-existing unused imports removed (OutputLine, ConfidenceResult, cn) — these caused build errors in Phase-56 modified files"

requirements-completed: [D-01, D-02, D-03, D-05, D-06, D-07, D-08, D-09]

# Metrics
duration: 35min
completed: 2026-04-29
---

# Phase 56 Plan 02: Frontend ToolCallPanel Real-Time Feedback Summary

**Step N header, task phase labels (Gathering context / Analyzing / Running code / Loading skill / Synthesizing answer / Thinking...), and inline SkillRow activations wired from iteration_start and skill_activated SSE events through useMessages state to ToolCallPanel display**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-04-29
- **Tasks:** 5 (all complete)
- **Files modified:** 6

## Accomplishments

- `SkillActivation` interface added to `types/index.ts` with `type`, `skillName`, `occurredAt` fields. `Message` gains `iterationCount?: number` (0-based, from `iteration_start`) and `activatedSkills?: SkillActivation[]` (ordered live-stream array). Legacy `activatedSkill?: string` retained.
- `streamMessage()` in `api.ts` accepts new `onIterationStart?: (iteration: number) => void` parameter positioned between `onPlanning` and `onFallbackModel`. SSE parser dispatches `iteration_start` events to this callback.
- `useMessages.ts` wires `onIterationStart` to set `iterationCount` on the active assistant message. `onSkillActivated` now appends to `activatedSkills` array (preserving chronological order per D-09) while retaining legacy `activatedSkill` write.
- `taskPhaseLabel()` function added to `toolMeta.ts` — maps `search_documents`/`query_documents`/`web_search` → "Gathering context", `analyze_document` → "Analyzing", `execute_code` → "Running code", `load_skill` → "Loading skill", default → "Thinking…"
- `ToolCallPanel` accepts `iterationCount` and `activatedSkills` props. `headerLabel` IIFE now emits: "Used N tools" (done), "Step N — Gathering context…" (active tool), "Step N — Synthesizing answer" (streaming final answer, no active tool), "Step N — Thinking…" (between rounds / isPlanning). Old "Planning next action…" and "Working…" labels removed.
- `SkillRow` inline component added (Zap icon, violet text, "Using skill: {name}") following `SubAgentBlock` pattern.
- `displayItems` union array interleaves `toolCalls` and `activatedSkills` sorted by timestamp, replacing direct `toolCalls.map` in JSX body. Existing `ToolArgsBlock`/`ToolResultBlock`/`SubAgentBlock`/`ExecuteCodeBlock` render bodies preserved verbatim.
- `MessageItem.tsx` passes `iterationCount={message.iterationCount}` and `activatedSkills={message.activatedSkills}` to `<ToolCallPanel />`.

## Task Commits

1. **Task 1: Types + SSE parser** — `3acae96` (feat)
2. **Task 2: useMessages wiring** — `3fd3ef1` (feat)
3. **Task 3: toolMeta + ToolCallPanel header** — `7ceb865` (feat)
4. **Task 4: SkillRow + displayItems + MessageItem** — `4777f52` (feat)
5. **Task 5: Build smoke test** — no dedicated commit; inline fix `5d7fc0d` (fix)

## Files Created/Modified

- `frontend/src/types/index.ts` — SkillActivation interface, iterationCount/activatedSkills on Message
- `frontend/src/lib/api.ts` — onIterationStart parameter + iteration_start SSE dispatch
- `frontend/src/hooks/useMessages.ts` — onIterationStart callback + activatedSkills array append
- `frontend/src/lib/toolMeta.ts` — taskPhaseLabel() function
- `frontend/src/components/chat/ToolCallPanel.tsx` — Props, headerLabel IIFE, SkillRow, displayItems, isSynthesizing
- `frontend/src/components/chat/MessageItem.tsx` — two new props passed to ToolCallPanel

## Decisions Made

- **taskPhaseLabel default "Thinking…"**: Matches D-07 spec for between-tool / unknown state. The old fallback "Working…" had no contextual meaning; "Thinking…" is consistent with the isPlanning label.
- **isSynthesizing derivation**: Derived from `!allDone && !isPlanning && !activeTool && toolCalls.length > 0` — no new SSE event or prop needed. Correctly identifies the brief window where deltas arrive after all tools are done but before `allDone` flips (which happens after the `done` event).
- **displayItems sort by startedAt ?? 0**: Tool calls without `startedAt` (shouldn't happen but guard) sort to front at t=0. Skill activations with `occurredAt = Date.now()` always have real timestamps, so they interleave correctly.
- **Legacy activatedSkill retained**: `MessageItem.tsx` has an existing Zap indicator that reads `message.activatedSkill`. Removing it would require a separate change. Keeping it is zero-cost.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused imports that caused build errors in Phase-56 modified files**
- **Found during:** Task 5 (build smoke test)
- **Issue:** `OutputLine` in `useMessages.ts`, `ConfidenceResult` in `api.ts`, and `cn` in `MessageItem.tsx` were imported but never used (TS6133/TS6196). These were pre-existing issues in the original files but became visible when running the build against the worktree source. Per Task 5 acceptance criteria, no errors allowed in Phase-56-modified files.
- **Fix:** Removed the three unused imports from their respective files.
- **Files modified:** `useMessages.ts`, `api.ts`, `MessageItem.tsx`
- **Committed in:** `5d7fc0d`

**2. [Rule 3 - Blocking] node_modules junction required for worktree build**
- **Found during:** Task 5 (build smoke test)
- **Issue:** The worktree `frontend/` directory has no `node_modules` (git worktrees share committed files only). `npm run build` and `npx tsc` fail without it.
- **Fix:** Created a Windows junction point from worktree `frontend/node_modules` to main repo `frontend/node_modules`. This allows the build to use the same installed packages without duplication.
- **Files modified:** None (junction is `.gitignore`d, not committed)

### Pre-existing Build Failures (Out of Scope)

The `npm run build` exits with non-zero due to pre-existing TypeScript errors in unrelated files:
- `src/__tests__/components/FolderNode.test.tsx` — missing `currentUserId`/`onToggleGlobal` props
- `src/__tests__/components/FolderTree.test.tsx` — same
- `src/components/skills/SkillFormDialog.tsx` — `RefObject<HTMLInputElement | null>` incompatibility
- `src/pages/SettingsPage.tsx` — `web_search_enabled`/`llm_max_output_tokens` property mismatches
- `src/components/settings/MemorySection.tsx` — `finally` on `PromiseLike`

These all predate Phase 56. The build was not passing before these changes. The key acceptance criterion is confirmed: **zero errors in Phase-56-modified files**.

---

Total deviations: 2 (one Rule 1 fix, one Rule 3 fix). No scope creep.

## Issues Encountered

- **Build smoke test against worktree source required special setup**: The worktree has no `node_modules`, requiring a Windows junction point to the main repo's `node_modules`. This is an infrastructure artifact of the parallel worktree execution model — not a code issue.
- **npx tsc --noEmit from worktree returned empty (misleading "pass")**: Without `node_modules`, `npx tsc` fails immediately with a non-TypeScript error. The empty grep output looked like "no errors" but was actually "command not found". All TypeScript validation was eventually done using the main repo's `node_modules/.bin/tsc` with explicit project path — confirmed zero errors in all Phase-56 files.

## Known Stubs

None — all features are fully wired:
- `iterationCount` flows from `iteration_start` SSE → `onIterationStart` callback → `setMessages` → `ToolCallPanel.stepPrefix`
- `activatedSkills` flows from `skill_activated` SSE → `onSkillActivated` callback → `setMessages` → `ToolCallPanel.displayItems` → `SkillRow`

## Threat Flags

No new threat surface introduced:
- T-56-07 (Tampering — SkillRow XSS): `{activation.skillName}` uses JSX text interpolation (auto-escaped). No `dangerouslySetInnerHTML`. Confirmed by inspection.
- T-56-06 (iteration_start NaN guard): `iterationCount != null && iterationCount >= 0` in `stepPrefix` rejects negative/NaN values.

---
*Phase: 56-agent-real-time-feedback*
*Completed: 2026-04-29*
