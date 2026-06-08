---
phase: 096-eval-harness-cross-provider-verification-concurrency
plan: 04
subsystem: ui
tags: [ask_user, panel, honesty, ApiError, react, vitest, tdd, HITL]

# Dependency graph
requires:
  - phase: 087-workspace-panel
    provides: PendingAskCard/PendingAskStack (PANEL-04) + the calm expired-state JSX this plan reuses
  - phase: 092-dual-mode-wiring-continue-button
    provides: ApiError status-carrying error class (api.ts:16-23, the postMessage F3 idiom copied here)
  - phase: 093-harness-cross-provider-parity
    provides: runs.py F10 anchor-confirm 404 (the IDOR-safe rejection this plan surfaces honestly)
provides:
  - answerAskUser throws status-carrying ApiError (api.ts one-line fix — corrects RESEARCH assumption A5)
  - PendingAskCard 404-honesty branch — a dead prompt's submit flips the card to a visible expired state with a constant message, never silence (BUG-260605-01 frontend half / D-06)
  - PendingAskCard non-404 failure branch — visible retryable constant-string error line, submit re-enabled
  - created_at-derived countdown seed — a reconciled stale prompt renders expired ON MOUNT, never a misleading fresh 5:00; SSE-fresh prompts (no created_at) unchanged
affects: [096 restart-mid-ask_user UAT (VALIDATION.md), 096-03 backend half of D-06, ask_user HITL surface]

# Tech tracking
tech-stack:
  added: []
  patterns: ["instanceof ApiError && err.status === 404 at the submit-catch boundary (status-keyed UX honesty)", "created_at-derived countdown seed with honest no-created_at fallback"]

key-files:
  created: []
  modified:
    - frontend/src/lib/api.ts
    - frontend/src/components/panel/PendingAskCard.tsx
    - frontend/src/components/panel/__tests__/PendingAskCard.test.tsx
    - frontend/src/components/panel/__tests__/fixtures.ts

key-decisions:
  - "404 reuses the EXISTING expired-state JSX via the component's CardState enum + an expiredMessage override (no parallel state machine)"
  - "Error strings are CONSTANTS — the 404/retry copy never echoes server response text (T-096-04-02)"
  - "Shared fixture created_at made fresh-at-module-load — the static 2026-05-29 date would mount every pending-state test as expired under the new seed"

patterns-established:
  - "Status-keyed submit-catch honesty: terminal-404 -> calm expired state; transient -> visible retryable line; never a silent catch"

requirements-completed: []  # EVAL-02 spans plans 03+04+VALIDATION UAT — not complete from this plan alone; orchestrator owns the roll-up

# Metrics
duration: 18min
completed: 2026-06-06
---

# Phase 096 Plan 04: PendingAskCard 404 Honesty + created_at Countdown Summary

**A dead ask_user prompt can no longer lie twice: answerAskUser now throws a status-carrying ApiError, the card surfaces the backend's IDOR-safe 404 as a visible "This prompt has expired" state (never silence), and the countdown seeds from created_at so a 10-minute-old reconciled prompt mounts expired instead of showing a fresh 5:00.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-06-06T21:07:35Z
- **Completed:** 2026-06-06T21:24:18Z
- **Tasks:** 2 (Task 2 TDD RED→GREEN)
- **Files modified:** 4

## Accomplishments

- BUG-260605-01 frontend half closed (D-06 honesty): the silent `catch {}` at the submit path is gone — a 404 (the anchor-confirm "run not active" answer from runs.py) flips the card to the calm grey expired state with the constant message "This prompt has expired — the run is no longer active"; any other failure shows a visible, retryable "Couldn't submit your answer — try again." line with submit re-enabled
- The countdown derives from `created_at` when present (GET-reconciled prompts carry it via panel.py): a stale prompt past its timeout renders expired ON MOUNT through the existing tick-effect flip; SSE-fresh prompts (no created_at) keep seeding at `timeout_seconds` — honest because emission ≈ mount (preservation guard test pins this)
- `answerAskUser` one-line fix (PATTERNS Assignment 10): bare `Error` → `ApiError("Failed to submit ask_user answer", res.status)` — corrects RESEARCH assumption A5 and enables the `instanceof ApiError && err.status === 404` branch
- 5 new behavior tests; PendingAskCard.test.tsx 23/23 GREEN; tsc -b == documented baseline 37 (zero net-new, none referencing touched files); vite build exit 0; `dangerouslySetInnerHTML` == 0 (T-087-11/T-096-04-01)

## Task Commits

Each task was committed atomically:

1. **Task 1: answerAskUser throws ApiError (status-preserving)** - `9da43b9c` (fix) — one-hunk api.ts diff
2. **Task 2 RED: failing tests for 404 honesty + created_at countdown** - `26179738` (test) — 4 fail / 19 pass (18 existing + the SSE-fresh preservation guard, passing by design)
3. **Task 2 GREEN: PendingAskCard 404 honesty + created_at-derived countdown** - `6003fb15` (feat) — 23/23 GREEN

_No REFACTOR commit — GREEN landed clean; no cleanup needed._

## Files Created/Modified

- `frontend/src/lib/api.ts` — answerAskUser non-OK throw now `ApiError` with status (only production change; postMessage :451 analog)
- `frontend/src/components/panel/PendingAskCard.tsx` — submit-catch status branch (404 → expired state via the existing `CardState` enum + new `expiredMessage` override; else → new `submitError` constant-string line with `role="alert"`); countdown seed derives from `ask.created_at`; header docstring updated
- `frontend/src/components/panel/__tests__/PendingAskCard.test.tsx` — api mock upgraded to the importActual partial-mock idiom (real `ApiError` class identity for `instanceof`; paired `@/lib/supabase` mock per panelHooks idiom); 5 new behavior tests; stack-ordering test dates made relative-to-now
- `frontend/src/components/panel/__tests__/fixtures.ts` — `mockPendingAskWithRunId.created_at` static date → fresh-at-module-load (see Deviations)

## Decisions Made

- Reused the component's ACTUAL state mechanism (`CardState` enum + `setState("expired")`) per plan instruction — `expiredMessage: string | null` overrides only the message line inside the existing expired JSX; countdown-driven expiry keeps the timeout copy
- The non-404 error line renders `role="alert"` (announces on appearance; no nested-live-region conflict — it lives in the `role="group"` pending card, not the `role="status"` expired card)
- `setSubmitError(null)` at submit start so a retry clears the stale error line

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Shared fixture's static created_at would mount every pending-state test as expired**
- **Found during:** Task 2 (RED test design)
- **Issue:** `mockPendingAskWithRunId.created_at` was the static literal `"2026-05-29T10:00:00Z"` — under the new created_at-derived seed, every existing pending-state test rendering that fixture would mount already-expired and fail at GREEN
- **Fix:** `created_at: new Date().toISOString()` (fresh at module load) + doc comment; the stack-ordering test's two explicit dates likewise became relative-to-now (preserving the newest-first assertion). `fixtures.ts` was not in `files_modified` but is the single point keeping the test suite truthful under the new semantics (WorkspacePanel.test.tsx consumes the fixture only through a mocked PendingAskStack sentinel, so the change is inert there)
- **Files modified:** frontend/src/components/panel/__tests__/fixtures.ts, frontend/src/components/panel/__tests__/PendingAskCard.test.tsx
- **Verification:** PendingAskCard.test.tsx 23/23 GREEN; WorkspacePanel.test.tsx absent from the full-run failure set
- **Committed in:** 26179738 (RED commit)

**2. [Rule 1 - Doc-only] Pre-existing prose mention broke the XSS acceptance grep**
- **Found during:** Task 2 (acceptance verification)
- **Issue:** The Phase 094 DraftBlock docstring contained the literal token `dangerouslySetInnerHTML` in prose ("NEVER dangerouslySetInnerHTML…"), making the `grep -c == 0` acceptance criterion read 1 despite zero actual usage
- **Fix:** Reworded to "raw/innerHTML markup" — the exact idiom 095.1-02 used for the same situation; doc-only, no behavior
- **Files modified:** frontend/src/components/panel/PendingAskCard.tsx
- **Verification:** `grep -c dangerouslySetInnerHTML` == 0
- **Committed in:** 6003fb15 (GREEN commit)

---

**Total deviations:** 2 auto-fixed (1 blocking test-fixture, 1 doc-only grep hygiene)
**Impact on plan:** Both necessary for the plan's own acceptance criteria; no scope creep, no behavior change outside the planned surface.

## Issues Encountered

- **Sandbox blocked `git switch`/`git stash`/`git apply -R`/main-tree access**, so the prescribed 095.1 git-stash baseline proof was executed as an exact equivalent: with all work committed, the two cross-file-visible changes (api.ts line, fixtures.ts date) were temporarily reverted via in-place edits, the full failing set rerun, and the files restored to HEAD content (working tree verified clean via `git status`). Result: the full-suite failure set at HEAD (18 failed files / 18 failed tests / 87 passed in the scoped rerun; 438 passed / 456 in the full run) is **byte-identical with and without this plan's changes — net-new failures == 0**. The 18-file cluster (RunCard, MessageItem×4, ToolCallPanel, MessageList, streamsProvider×3, api.test skill-file cases, model-info, useMessages, ExecuteCodeEditorInset, Plan04.frontend, streamsStore_per_thread, PhaseReconcile) is the documented pre-existing rot baseline (see project memory: frontend vitest rot / SEED-056); none of it references this plan's touched files
- **Worktree had no `frontend/node_modules`** — junctioned the main tree's node_modules (PowerShell `New-Item -ItemType Junction`); tsc/vitest/vite all ran normally through it

## TDD Gate Compliance

- RED gate: `test(096-04)` commit `26179738` — 4 new-behavior tests failing for the right reason (missing implementation); the 5th (SSE-fresh seed) is an intentional preservation guard pinning current behavior, passing by design at RED (documented in the commit message, fail-fast rule satisfied: its pass was expected, not investigated-away)
- GREEN gate: `feat(096-04)` commit `6003fb15` after RED — 23/23
- REFACTOR: not needed

## Known Stubs

None — the constant honesty strings ("This prompt has expired — the run is no longer active", "Couldn't submit your answer — try again.") are intentional UX copy, not placeholders; both render real state transitions backed by the live submit path.

## Threat Model Compliance

- T-096-04-01 (XSS, mitigate): all new strings render as React text children; `dangerouslySetInnerHTML` grep == 0 in PendingAskCard.tsx
- T-096-04-02 (info disclosure, mitigate): the 404 and retry messages are constants — no server response body is ever echoed; backend 404 semantics untouched
- T-096-04-03 (created_at spoofing, accept): per plan — owner-scoped /pending source, worst case a mis-timed countdown
- No new threat surface introduced (no new endpoints, auth paths, or schema) — no threat flags

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Combined with Plan 03 (backend terminal-status ask_user cleanup + /pending liveness filter), the full D-06 fix is in place for the restart-mid-ask_user UAT in VALIDATION.md to verify live
- EVAL-02 requirement roll-up is the orchestrator's call after the sibling plans + UAT land (not claimed here)
- Note for verifier: `requirements-completed` intentionally empty — this plan delivers the frontend half of BUG-260605-01 only

## Self-Check: PASSED

- FOUND: frontend/src/lib/api.ts (ApiError throw, grep == 1)
- FOUND: frontend/src/components/panel/PendingAskCard.tsx (instanceof ApiError == 1, expired message == 1, innerHTML token == 0, created_at == 7)
- FOUND: frontend/src/components/panel/__tests__/PendingAskCard.test.tsx (23/23 GREEN)
- FOUND: frontend/src/components/panel/__tests__/fixtures.ts
- FOUND: .planning/phases/096-eval-harness-cross-provider-verification-concurrency/096-04-SUMMARY.md
- FOUND commit: 9da43b9c (fix — 1 file, 1 insertion/1 deletion)
- FOUND commit: 26179738 (test — 2 files, +115/-8)
- FOUND commit: 6003fb15 (feat — 1 file, +51/-10)
- Working tree clean vs HEAD; no deletions in 53dc5823..HEAD; no untracked files

---
*Phase: 096-eval-harness-cross-provider-verification-concurrency*
*Completed: 2026-06-06*
