# Phase 227 Validation: The Run Frame Has One Owner

**Validation Date:** 2026-09-04  
**Author:** Gemini (Builder)  
**Reviewer:** Claude  
**Verdict:** PASS  

---

## 1. Mechanical Gates

### 1.1 Vitest Count Gate
- **Command:** `$env:GSD_VITEST_MAX_WORKERS="2"; node scripts/vitest-count-gate.cjs`
- **Output:**
  ```text
  count gate OK — 215/215 pinned files present, no per-file decrease, 0 failing.
  total 7407  ·  failed 0  ·  pinned total 6675 (+732)
  ```
- **Covering Suites Adopted in BASELINE:**
  - `RunCard.characterization.test.tsx` (8 tests)
  - `ToolCallPanel.test.tsx` (16 tests)
  - `MessageItem.cancelledRun.test.tsx` (8 tests)
  - `MessageItem.test.tsx` (24 tests)
  - All 16 run-frame covering test suites verified green (149 tests).

### 1.2 TypeScript Compilation Check
- **Command:** `(npx tsc --noEmit -p tsconfig.app.json 2>&1 | Select-String "error TS").Count` (inside `frontend/`)
- **Output:** `66` (0 new errors against pre-Phase-227 baseline of 66; 3 TS6133s in `MessageItem.tsx` removed).
- *Note:* Pre-existing `BUG-260904-01` (`TS2304: Cannot find name 'continueRun'` at `MessageItem.tsx:647`) is tracked independently and untouched.

### 1.3 CLAUDE.md Size & Ledger Integrity Gate
- **Command:** `node scripts/check-claude-md-size.cjs`
- **Output:**
  ```text
  CLAUDE.md                                  106939 chars   71.3% of limit  headroom   43061  [OK]
  claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.
  ```

---

## 2. Success Criteria Audit

| Criterion | Target | Measured / Proof | Status |
|---|---|---|---|
| **SC#1: Single Frame Ownership** | Run frame chrome + terminal status owned by `RunCard` | `RunTerminalStatus` extracted to `RunCard.tsx` and consumed by `MessageItem.tsx`. All frame headers, progress shimmers, badges, and terminal derivations reside in `RunCard.tsx`. | **PASS** |
| **SC#2: Byte-Identical Visual Fidelity** | All 8 run states mechanically verified | `RunCard.characterization.test.tsx` tests all 8 states. 8/8 tests pass. | **PASS** |
| **SC#3: Future 1-File Edit Readiness** | Future layout shifts localized | Result column layout localized in `StepRow.tsx`. Run status positioning localized in `RunCard.tsx`. Future adjustments are 1-file edits. | **PASS** |
| **SC#4: G-5 Hot-File Extraction** | Monolithic hot files decomposed and discharged | `ToolCallPanel.tsx`: 1019 → 351 L (-65%). `MessageItem.tsx`: 823 → 702 L (-15%). `RunCard.tsx` re-derived at 26 / 12 / 728 L. | **PASS** |

---

## 3. SC#2 Run State Coverage & Browser Drive Status

### 3.1 Mechanically Driven States (8 of 8 Covered in `RunCard.characterization.test.tsx`)
1. **Streaming active run (`status: "running"`):** Live duration timer rendered via `ElapsedTimer`, pulsing loader glyph, tool list displayed.
2. **Settled completed run (`status: "done"`):** Green checkmark glyph, execution duration, terminal status badge, resting essence rows.
3. **Failed run (`status: "error"`):** Red error glyph, destructive error pill, error message rendered via `ToolResultBlock`.
4. **Timed out run (`status: "timed_out"`):** Amber clock glyph, timeout status pill.
5. **Cancelled run (`status: "cancelled"`):** Stop glyph `■`, cancelled badge, partial tool list preserved.
6. **Paused on tool approval (`status: "paused_on_approval"`):** Amber shield glyph, approval banner / `ChatToolApprovalCard` embedded.
7. **No-tools run (text-only generation / reasoning):** Clean run frame with reasoning delta summary and zero tool artifacts.
8. **Sub-agent tool run (`tc.sub_agent` attached):** Subagent nested block with model moniker, task summary, and streaming Markdown body.

### 3.2 Browser Drive Verification
- **Mechanical Characterization:** **DRIVEN & PASSED** (8/8 unit characterization tests green, 0 regressions across all 16 covering suites).
- **Human Interactive Browser Drive:** **OWED to Operator** (Visual inspection in live browser session across the 8 states before production milestone tag).

---

## 4. Re-check Closure Items (BUS-101)

1. **TSC Error Count Cleaned:** Removed unused `useLayoutEffect`, `useRef`, and `cn` imports in `MessageItem.tsx`. `tsc` count verified at exactly `66` (pre-227 baseline).
2. **`RunCard.tsx` Ledger Row Re-derived:** Measured at `26 commits / 12 phases / 728 L` (gained `RunTerminalStatus`). Recorded in both `CLAUDE.md` and `docs/HOT-FILE-LEDGER.md`.
3. **Decision Comments Restored:**
   - `frontend/src/components/chat/StepRow.tsx`: Restored `NOISE AUDIT 2026-08-31 (operator, item A6)` block, `Variant B merged live chip` note, and `Phase 075.8 Task 2 (sketch 002 D5)` mapping docblocks.
   - `frontend/src/components/chat/ToolCallPanel.tsx`: Restored `075.6 Plan 02 / SPEC Req #4 default-expand-for-active-preparing rule`, per-tool-id panel state notes, and `Phase 075.8 Task 3` bottom progress shimmer notes.
   - `frontend/src/components/chat/ToolCallDetails.tsx`: Restored `ToolResultBlock` and `SubAgentBlock` root fix docblocks.
