---
phase: 094-workflow-legibility-mode-clarity
fixed_at: 2026-06-05T00:05:00Z
review_path: .planning/phases/094-workflow-legibility-mode-clarity/094-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
deferred: 3
status: all_fixed
branch: v2.5-dev
---

# Phase 094: Code Review Fix Report

**Source review:** 094-REVIEW.md (11 findings: 0 critical, 5 warning, 6 info)
**Scope:** the specific subset directed by the fix brief (8 findings); 3 explicitly DEFERRED.
**Branch:** `v2.5-dev` · normal commits (hooks on) · one atomic commit per finding.

## Summary

| | Count |
|---|---|
| Findings in scope | 8 |
| Fixed (committed) | 8 |
| Deferred (out of scope) | 3 |

**Verification (all GREEN after the full chain):**
- `npx vitest run src/components/panel src/providers src/components/chat` → **17 files / 162 tests pass** (was 159; +3 new BatchResultList mount tests). vitest-axe gates clean — the IN-05 change introduced no axe violations; the WR-01 mount kept WorkspacePanel tests green.
- `npx tsc -b` → **37 errors** = the documented baseline (zero net-new). `npx vite build` → clean.
- Acceptance greps: `accent-violet-text` in `index.css` = 4 (≥2) · in `tailwind.config.js` = 2 (≥1) · `BatchResultList` mount (import + JSX) present in `WorkspacePanel.tsx` · zero real `dangerouslySetInnerHTML` in panel components (all matches are XSS-guard comments).

## Fixed Issues

### WR-04 — retrying status TEXT below AA 4.5:1 in dark
**Commit:** `c0baab3d`
**Files:** `frontend/src/index.css`, `frontend/tailwind.config.js`, `frontend/src/components/panel/PhaseCard.tsx`
**Change:** Added a panel-scoped `--accent-violet-text` token to both theme blocks (dark `258 95% 84%` → 9.83:1; light `258 80% 40%` → 8.52:1), registered `"accent-violet-text"` in Tailwind, and pointed the `retrying` status `textClass` at `text-accent-violet-text`. The glyph and card border keep `text-accent-violet`/`border-accent-violet` (graphic ≥3:1). Light behavior unchanged.

### WR-01 + WR-03b — batch sub-results made visible; dead per-phase block removed (closes SC#6)
**Commit:** `b82150e0`
**Files:** `frontend/src/components/panel/WorkspacePanel.tsx`, `frontend/src/components/panel/PhaseCard.tsx`, `frontend/src/components/panel/__tests__/WorkspacePanel.test.tsx`
**Change:** Mounted `<BatchResultList threadId={threadId}/>` as a "Sub-results" `PanelSection` beneath the Workflow timeline, gated on `showTimeline && tasks.length > 0` (harness/phases-exist context AND tasks present) — so the per-subtopic `sub_agent_done.summary` rows are now visible before merge, and never appear in Deep mode or as an empty box. It reads `useTasks(threadId)` (the honest run-level source; PANEL-09 chat-isolation preserved). Removed the structurally-dead `phase.subAgents` render block in `PhaseCard` plus the now-orphaned `SubAgentRow` component and the unused `TaskRunIndexItem` import (`phase.subAgents` is never populated — grep-confirmed `SubAgentRow` had no other consumer). Per-phase association stays deferred (SEED-053). All agent text renders as plain React children. Updated the WorkspacePanel test to mock `BatchResultList`/`useTasks` and assert the mount/no-mount matrix (+3 tests).

### IN-06 — greedy dotAll regex in cleanDescription
**Commit:** `a5516daf`
**File:** `frontend/src/components/panel/BatchResultList.tsx`
**Change:** Dropped the `s` (dotAll) flag from the sub-question regex so `(.+)` captures only the first line. Now load-bearing since the component is mounted (WR-01).

### WR-02 — counterFloorRef cross-thread leak
**Commit:** `c9749e0a`
**File:** `frontend/src/components/panel/PhaseTimeline.tsx`
**Change:** Added `useEffect(() => { counterFloorRef.current = 0 }, [threadId])`, mirroring the existing `frame` reset effect, so the "Phase i / N" high-water mark no longer bleeds across thread switches (restores PANEL-09 isolation for the render-local ref).

### IN-02 — duplicate placeholder phase rows
**Commit:** `19ba1193`
**File:** `frontend/src/providers/StreamsProvider.tsx` (`appendPhaseForThread`)
**Change:** On live `phase_started`, if a positional placeholder row (`slug === phase-${i}`) still holds that `phaseIndex`, replace it in place by index instead of appending — preventing both a `phase-1` skeleton and a `research` running row for the same index. Exact-slug re-emit stays a no-op; forward-only counting preserved.

### IN-01 — onRunFailed empty-slug mis-targeting
**Commit:** `d5a64a13`
**File:** `frontend/src/providers/StreamsProvider.tsx` (`setPhaseStatusForThread`)
**Change:** The `slug === ""` sentinel now scans for a genuinely-active (`running`/`retrying`) row first; only if none exists does it fall back to the last `pending`, then to the last row. A trailing `pending` skeleton is no longer preferentially marked failed when an earlier phase actually failed.

### IN-04 — DraftBlock meta contrast
**Commit:** `c3a86b53`
**File:** `frontend/src/components/panel/PendingAskCard.tsx`
**Change:** The "≈ N words · long draft" meta now uses `text-panel-muted-foreground-dim` (8.42:1 dark / 4.66:1 light) instead of the global `--muted-foreground-dim` (3.59:1 — fails on the dark panel).

### IN-05 — nested aria-live double-announce
**Commit:** `bb61762b`
**File:** `frontend/src/components/panel/PendingAskCard.tsx`
**Change:** Removed the redundant `aria-live="polite"` on the inner `<p>` of the expired card (the card root is already `role="status"`, a polite live region) so the line isn't announced twice. Conservative: the answered card's lone announcer and the pending card's assertive "Needs you" announcer are untouched. PendingAskCard axe suite re-run — 18/18 green, no violations.

## Deferred Issues (NOT fixed — out of scope per the fix brief)

### WR-05 — terminal-run timeline vanishes on revisit
**Reason:** Touches the reconcile contract (`reconcilePhases` returning `[]` for terminal/Deep runs, likely needing a backend read or persistence) and is an operator decision. Only the IN-02 index-reconcile change was in scope; `reconcilePhases` was left unchanged. Left for the operator.

### WR-03a — wiring sub_agent_* events onto individual phases
**Reason:** Deferred to SEED-053. Per-phase association of sub-stream events is explicitly out of scope; the honest children surface via the thread-scoped BatchResultList instead (WR-01). No sub-stream events were threaded onto phases.

### IN-03 — triple getThreadWorkflow fetch
**Reason:** Optimization (redundant network reads of a pure-read endpoint), not a correctness bug. Deferred.

---

_Fixed: 2026-06-05_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
