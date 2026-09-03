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
- **Output:** `66` (0 new errors against baseline of 66).

### 1.3 CLAUDE.md Size & Ledger Integrity Gate
- **Command:** `node scripts/check-claude-md-size.cjs`
- **Output:**
  ```text
  CLAUDE.md                                  106965 chars   71.3% of limit  headroom   43035  [OK]
  claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.
  ```

---

## 2. Success Criteria Audit

| Criterion | Target | Measured / Proof | Status |
|---|---|---|---|
| **SC#1: Single Frame Ownership** | Run frame chrome + terminal status owned by `RunCard` | `RunTerminalStatus` extracted to `RunCard.tsx` and consumed by `MessageItem.tsx`. All frame headers, progress shimmers, badges, and terminal derivations reside in `RunCard.tsx`. | **PASS** |
| **SC#2: Byte-Identical Visual Fidelity** | All 8 run states mechanically verified | `RunCard.characterization.test.tsx` tests all 8 states (streaming, settled, failed, timed_out, cancelled, paused_on_approval, no_tools, sub_agent). 8/8 tests pass. | **PASS** |
| **SC#3: Future 1-File Edit Readiness** | Future layout shifts localized | Result column layout localized in `StepRow.tsx`. Run status positioning localized in `RunCard.tsx`. Future adjustments are 1-file edits. | **PASS** |
| **SC#4: G-5 Hot-File Extraction** | Monolithic hot files decomposed and discharged | `ToolCallPanel.tsx`: 1019 → 351 L (-65%). `MessageItem.tsx`: 823 → 702 L (-15%). G-5 discharge recorded in `CLAUDE.md` and `docs/HOT-FILE-LEDGER.md` in commit `585d451dd`. | **PASS** |

---

## 3. Commit Ledger for Phase 227
- `26cb7397e`: `test(227-01): rename MessageItem.cancelledRun.test.tsx, align assertions with noise audit, add characterization suite`
- `21ad53312`: `docs(227-01): record Plan 227-01 execution summary and baseline adoption`
- `a743aeef4`: `refactor(227-02): decompose ToolCallPanel into ToolCallDetails, StepRow, and toolStepDerivation`
- `48f137cc7`: `docs(227-02): record Plan 227-02 execution summary`
- `585d451dd`: `refactor(227-03): extract RunTerminalStatus, UserMessageBubble, messageText, and sync hot-file ledger`
