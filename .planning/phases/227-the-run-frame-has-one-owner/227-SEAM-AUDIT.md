# Phase 227 — Cross-Plan Seam Audit

Every file on the path between what one plan writes and another reads is named below, with its direction, readers, and verification mechanism.

---

## Seam 1: Plan 227-01 (Wave 1) → Plan 227-02 (Wave 2) & 227-03 (Wave 3)

| Component | Detail |
|---|---|
| **What 227-01 writes** | `scripts/vitest-count-gate.cjs` (adopts all 15 covering test suites into `TARGETS` and `BASELINE`), `frontend/src/__tests__/components/ToolCallPanel.test.tsx`, `frontend/src/__tests__/components/MessageItem.test.tsx`. |
| **What 227-02 / 227-03 read** | Every subsequent plan runs `node scripts/vitest-count-gate.cjs` to guard against deleted tests, test count decrease, or broken regressions. |
| **Files on the path in between** | 1. `scripts/vitest-count-gate.cjs` (spawns vitest child process).<br>2. `frontend/src/__tests__/components/ToolCallPanel.test.tsx` (reads `frontend/src/components/chat/ToolCallPanel.tsx`).<br>3. `frontend/src/__tests__/components/MessageItem.test.tsx` (reads `frontend/src/components/chat/MessageItem.tsx`).<br>4. All 13 other covering suites listed in `227-MEASUREMENT-PACK.md` §4. |
| **Failure mode guarded against** | Plan 227-02's refactoring of `ToolCallPanel.tsx` or Plan 227-03's edits to `MessageItem.tsx` / `RunCard.tsx` breaking existing component behavior or quietly dropping an `it()` test block. |
| **Verification mechanism** | `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` executes synchronously at the end of each plan. Exit code 0 is required. |

---

## Seam 2: Plan 227-02 (Wave 2) → Plan 227-03 (Wave 3)

| Component | Detail |
|---|---|
| **What 227-02 writes** | `frontend/src/components/chat/ToolCallDetails.tsx` [NEW], `frontend/src/components/chat/StepRow.tsx` [NEW], `frontend/src/components/chat/ToolCallPanel.tsx` [REFACTORED to slim orchestrator]. |
| **What 227-03 reads** | `frontend/src/components/chat/RunCard.tsx` imports and mounts `<ToolCallPanel ... />`. |
| **Files on the path in between** | 1. `frontend/src/components/chat/RunCard.tsx` (mounts `<ToolCallPanel toolCalls={...} />` at line 523).<br>2. `frontend/src/components/chat/ToolCallPanel.tsx` (mounts `<StepRow>` and `<ToolCallDetails>`).<br>3. `frontend/src/components/chat/StepRow.tsx` (renders `StepRow` grid and `ToolEssenceLine`).<br>4. `frontend/src/components/chat/ToolCallDetails.tsx` (renders expandable payload/result details). |
| **Failure mode guarded against** | Props mismatch between `RunCard` and `ToolCallPanel`, broken imports, missing `data-testid` attributes on step rows, or styling regression in expanded step cards. |
| **Verification mechanism** | TypeScript type check (`npx tsc -p tsconfig.app.json --noEmit`) and covering test suites (`RunCard.test.tsx`, `ToolCallPanel.test.tsx`, `ChatArea.approval.test.tsx`). |

---

## Seam 3: Plan 227-03 (Wave 3) Internal Integration

| Component | Detail |
|---|---|
| **What 227-03 writes** | `frontend/src/components/chat/RunCard.tsx` (exports `RunTerminalStatus`), `frontend/src/components/chat/MessageItem.tsx` (imports and renders `<RunTerminalStatus>`). |
| **What 227-03 reads** | `MessageItem.tsx` reads `RunTerminalStatus` from `RunCard.tsx`. |
| **Files on the path in between** | 1. `frontend/src/components/chat/RunCard.tsx` (`export function RunTerminalStatus`).<br>2. `frontend/src/components/chat/MessageItem.tsx` (`import { RunCard, RunTerminalStatus } from "./RunCard"`). |
| **Failure mode guarded against** | Terminal status condition drift (`stopped`, `timed_out`, `cancelled`), missing or mismatched copy, or CSS class divergence between pre-refactor and post-refactor render. |
| **Verification mechanism** | `src/__tests__/components/MessageItem.test.tsx` (specifically STATE-01a, STATE-02, and timing tests asserting `"Agent reached time limit"` / `"Response stopped"`), and visual verification in browser drive. |

---

## Seam 4: Plan 227-03 (Wave 3) → Ledger & Project Contract

| Component | Detail |
|---|---|
| **What 227-03 writes** | `CLAUDE.md` and `docs/HOT-FILE-LEDGER.md` (updates G-5 triples and discharges "extraction due" to "honoured by extraction (227)"), and `.planning/phases/227-the-run-frame-has-one-owner/227-VALIDATION.md`. |
| **What reviewers / downstream agents read** | Preflight checks, G-5 hot-file scans, and future phases touching `MessageItem.tsx`, `ToolCallPanel.tsx`, or `RunCard.tsx`. |
| **Files on the path in between** | 1. `CLAUDE.md` (hot file table lines 535-537).<br>2. `docs/HOT-FILE-LEDGER.md` (dedicated sections for each file).<br>3. `scripts/check-hot-file-sizes.sh` (enforces max file sizes). |
| **Failure mode guarded against** | Unearned discharge of "extraction due" without actual shedding of responsibilities, or hot file size budget violations. |
| **Verification mechanism** | Triple re-derivation from git, `git diff`, and hot file size check script. |

---
*Authored: 2026-09-03 | Builder: Gemini | Reviewer: Claude*
