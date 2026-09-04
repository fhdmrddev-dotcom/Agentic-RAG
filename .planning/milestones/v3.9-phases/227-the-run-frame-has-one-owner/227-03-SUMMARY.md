# Phase 227 Plan 03 Summary: MessageItem Decomposition & G-5 Discharge

**Execution Date:** 2026-09-04  
**Plan Reference:** `.planning/phases/227-the-run-frame-has-one-owner/227-03-PLAN.md`  
**Status:** Complete  

## Overview
Completed the run frame owner consolidation and decomposition (Wave 3). Extracted `RunTerminalStatus` in `RunCard.tsx` (SC#1 / SC#3 preparation), extracted `messageText.ts` and `UserMessageBubble.tsx` from `MessageItem.tsx` (B-2), reduced `MessageItem.tsx` size from 823 lines to 702 lines, and synchronized the hot-file ledger in `CLAUDE.md` and `docs/HOT-FILE-LEDGER.md` in the same commit with `check-claude-md-size.cjs` validation (B-4).

## Changes Completed

1. **Extracted `RunTerminalStatus` in `RunCard.tsx` (`36 lines`, `SC#1 / SC#3`)**:
   - Encapsulates terminal status derivation ("Agent reached time limit" / "Response stopped") and copy conditions.
   - Prepares SC#3: moving terminal status inside the `RunCard` container is now a localized 1-file edit in `RunCard.tsx`.

2. **Extracted `messageText.ts` (`54 lines`, `B-2`)**:
   - Encapsulates two-pass text transformation and paragraph deduplication (`dedupParagraphs`).

3. **Extracted `UserMessageBubble.tsx` (`65 lines`, `B-2`)**:
   - Encapsulates user message role presentation, 7-line clamping with gradient fade into violet, and "Read more" / "Show less" toggle (`UserBubble`).

4. **Refactored `MessageItem.tsx` (`702 lines`)**:
   - Shed 121 lines of non-message presentation code.
   - Delegated terminal run status rendering to `<RunTerminalStatus message={message} isStreaming={isStreaming} />`.

5. **Hot-File Ledger Sync (`SC#4`, `B-4`)**:
   - Updated `CLAUDE.md` hot-file triples and G-5 discharge dispositions for `ToolCallPanel.tsx` (51 / 23 / 351 L) and `MessageItem.tsx` (62 / 33 / 702 L).
   - Updated `docs/HOT-FILE-LEDGER.md` detailing extraction metrics and SC#3 preparations.
   - Ran `node scripts/check-claude-md-size.cjs`: 106,965 chars (71.3% of limit), zero syntax errors, 0 malformed rows.

6. **Verification**:
   - `vitest-count-gate.cjs`: 215/215 pinned test suites present, 0 failing, 7,407 tests passing (+732 vs baseline).
   - `tsc`: 66 errors (0 new errors against baseline).
   - `pytest tests/test_225_oauth_state_security.py`: 9 passed.

## Commits
- `585d451dd`: refactor(227-03): extract RunTerminalStatus, UserMessageBubble, messageText, and sync hot-file ledger
