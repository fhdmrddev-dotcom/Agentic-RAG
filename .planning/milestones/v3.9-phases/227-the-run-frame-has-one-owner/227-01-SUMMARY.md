# Phase 227 Plan 01 Summary: Pinning Covering Suites & Characterization

**Execution Date:** 2026-09-04  
**Plan Reference:** `.planning/phases/227-the-run-frame-has-one-owner/227-01-PLAN.md`  
**Status:** Complete  

## Overview
Adopted all 16 covering test suites for the chat run frame into `scripts/vitest-count-gate.cjs`, resolved the bare-name collision on `MessageItem.test.tsx` (B-1), aligned pre-existing assertions with shipped noise audit and copy contracts (A-2), and authored the pre-refactor characterization suite `RunCard.characterization.test.tsx` across all 8 canonical run states (A-1 / SC#2).

## Changes Completed

1. **Resolved Bare-Name Collision (`B-1`)**:
   - `git mv frontend/src/components/chat/__tests__/MessageItem.test.tsx frontend/src/components/chat/__tests__/MessageItem.cancelledRun.test.tsx`.
   - Distinct keys in `BASELINE` prevent silent overwrite or summing in the count gate.

2. **Aligned Pre-existing Assertions (`A-2`)**:
   - `frontend/src/__tests__/components/ToolCallPanel.test.tsx`: Aligned with 2026-08-31 operator noise audit (`status-pill` absent on plain `done` steps; positive control asserting `status-pill` present on running/active/interrupted steps).
   - `frontend/src/__tests__/components/MessageItem.test.tsx`: Aligned streaming empty-content expectation with literal `"Setting up agent…"` (`toolMeta.ts:197`).

3. **Authored Characterization Suite (`A-1 / SC#2`)**:
   - Created `frontend/src/components/chat/__tests__/RunCard.characterization.test.tsx` covering all 8 run states (streaming, settled, failed, timed_out, cancelled, paused_on_approval, no_tools, sub_agent).
   - 8/8 tests pass on pre-refactor components.

4. **Updated `scripts/vitest-count-gate.cjs` (`SC#5`)**:
   - Pinned all 16 covering suites in `BASELINE` and added paths to `TARGETS`.
   - Total pinned tests: 149 across the 16 covering suites.

## Commits
- `26cb7397e`: feat(227-01): pin covering suites, resolve collision, and author characterization suite
