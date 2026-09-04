# Phase 227 Plan 02 Summary: Decompose ToolCallPanel

**Execution Date:** 2026-09-04  
**Plan Reference:** `.planning/phases/227-the-run-frame-has-one-owner/227-02-PLAN.md`  
**Status:** Complete  

## Overview
Decomposed `ToolCallPanel.tsx` from 1019 lines to a lean orchestrator of 351 lines (a ~65% reduction, shedding 668 lines of monolithic responsibilities). Extracted detail inspection into `ToolCallDetails.tsx`, timeline rail and essence line into `StepRow.tsx`, and pure state derivations into `toolStepDerivation.ts`. Prepared SC#3 1-file edit readiness for right-aligned result columns within `StepRow.tsx`.

## Changes Completed

1. **Extracted `ToolCallDetails.tsx` (`188 lines`)**:
   - `ToolArgsBlock`: parameter display and JSON preview.
   - `ToolResultBlock`: result dispatch across tool bodies, diffs, images, and copy button.
   - `SubAgentBlock`: subagent status and markdown rendering.

2. **Extracted `StepRow.tsx` (`158 lines`)**:
   - `StepRow`: 2-column grid with timeline spine, status node, and step number.
   - `ToolEssenceLine`: 1-line essence card button with icon, label, result summary, status pill, and chevron.
   - Helpers: `toolIcon`, `toolIconColor`, `toolSummary`, `pillStatus`.
   - Localized flex layout of `ToolEssenceLine` so right-aligning the result column (SC#3) is a 1-file edit in `StepRow.tsx`.

3. **Extracted `toolStepDerivation.ts` (`60 lines`, `B-3`)**:
   - Pure, side-effect-free step state computation: `buildDisplayItems`, `buildToolStepNumberMap`, `stepKeyOf`, `nodeStateOf`, `findLastPreparingIndex`, `findActiveIndex`, and `formatDuration`.

4. **Refactored `ToolCallPanel.tsx` (`351 lines`)**:
   - Orchestrates `StepRow`, `ToolCallDetails`, `toolStepDerivation`, `SkillRow`, and `ElapsedTimer`.
   - File size reduced from 1019 lines to 351 lines.

5. **Verification**:
   - `ToolCallPanel.test.tsx`: 16/16 tests passing.
   - `RunCard.characterization.test.tsx`: 8/8 tests passing.
   - TypeScript `tsc`: 66 errors (0 new errors against baseline).

## Commits
- `a743aeef4`: refactor(227-02): decompose ToolCallPanel into ToolCallDetails, StepRow, and toolStepDerivation
