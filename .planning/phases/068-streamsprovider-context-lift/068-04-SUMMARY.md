---
phase: 068-streamsprovider-context-lift
plan: 04
plan_id: 068-04
subsystem: frontend-streaming-provider
tags: [frontend, dev-mock, sc3-binding-gate, re-render-isolation, chrome-mcp, pending-checkpoint]

# Dependency graph
requires:
  - phase: 068-streamsprovider-context-lift
    plan: 03
    provides: "provider is sole owner of visibilitychange/focus/pageshow listeners; ChatArea listener block deleted"
provides:
  - "SC#3 automated binding gate: re-render isolation test (render-counter ref pattern, RESEARCH Finding #5)"
  - "SC#3 automated state gate: cross-surface bucket isolation test (reference-equality of bucketsBySurface.get(chat).get(T) across a (mock-eval, T) write)"
  - "DevTwoPaneMock dev-only overlay (Vite DCE in prod; verified by grep against dist/assets - 0 matches)"
  - "Plan 4 Task 3 manual Chrome MCP exercise - DEFERRED to orchestrator post-merge (Task 3 cannot run from worktree; pending-checkpoint state)"
affects:
  - "Phase 068 closure (Task 3 checkpoint must resolve before /gsd:verify-work 068)"
  - "v3.0 Skill Studio eval pane substrate readiness (gated on Task 3 approval)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "render-counter ref pattern for re-render isolation tests (RESEARCH Finding #5 / Pattern 6)"
    - "Top-of-function literal if (!import.meta.env.DEV) return null for Vite tree-shaking (RESEARCH Finding #9)"
    - "Stub JSON-dump mock pane bodies vs importing real MessageList (RESEARCH Finding #9 tradeoff - minimal coupling to chat chrome)"

key-files:
  created:
    - "frontend/src/components/dev/DevTwoPaneMock.tsx (85 LOC)"
  modified:
    - "frontend/src/__tests__/providers/streamsProvider.test.tsx (792 -> 923 LOC, +131; 2 new tests in describe Phase 068 multi-surface isolation SC3)"
    - "frontend/src/App.tsx (+2 LOC: DevTwoPaneMock import + JSX mount)"

key-decisions:
  - "Render-counter ref pattern shipped on first try; LOW #10 fallback to @testing-library/react-render-stream NOT triggered - Vitest 4.1.0 + React 19.2.x produced clean +1/+0 render counts under act() flush."
  - "Stub JSON-dump panes chosen over importing real MessageList (RESEARCH Finding #9 tradeoff - minimal bundle surface area + zero coupling to chat toolbar/composer chrome)."
  - "Task 3 (Chrome MCP manual exercise) deferred to orchestrator on main tree per worktree scope_constraint - worktree has no browser session."
  - "tsc -b fails on 30 pre-existing TS errors per deferred-items.md baseline (same as Plan 1/2/3 SUMMARYs); vite build itself exits 0 and DCE strips DevTwoPaneMock from dist."

patterns-established:
  - "SC#3 binding gate: render-counter ref pattern for atomic-selector re-render isolation assertions"
  - "DevTwoPaneMock convention: if (!import.meta.env.DEV) return null at top-of-function (literal token, not aliased) so Vite tree-shaking strips the component entirely"

requirements-completed: [STREAMS-PROVIDER-01]

# Metrics
duration: ~6min (Task 1 + Task 2 only; Task 3 pending-checkpoint)
completed: 2026-05-13
tasks_completed: 2
tasks_pending_checkpoint: 1
files_touched: 3
commits:
  - "00bdf00 test(068-04): add SC#3 multi-surface isolation tests (re-render + cross-surface bucket)"
  - "e823e0a feat(068-04): add DevTwoPaneMock dev-only overlay; mount in App.tsx for SC#3 manual exercise"
---

# Phase 068 Plan 04: SC#3 binding gate + DevTwoPaneMock substrate proof - Summary

**SC#3 automated half GREEN (2/2 new tests pass; render-counter ref pattern shipped without LOW #10 fallback); DevTwoPaneMock dev-only overlay created and mounted in App.tsx; Vite DCE verified (0 matches for mock-eval/DevTwoPaneMock in dist/assets); Task 3 Chrome MCP manual exercise pending-checkpoint - deferred to orchestrator on main tree per worktree scope_constraint.**

## Performance

- **Duration:** ~6 min (autonomous tasks only; Task 3 pending-checkpoint)
- **Started:** 2026-05-13T03:19:23Z
- **Completed (Tasks 1+2):** 2026-05-13T03:25:47Z
- **Tasks complete:** 2/3 (Task 3 pending-checkpoint:human-verify)
- **Files touched:** 3 (1 created + 2 modified)

## Accomplishments

### Task 1 (commit 00bdf00) - SC#3 binding gate tests

Added describe block "Phase 068 - multi-surface isolation (SC#3)" to streamsProvider.test.tsx with two tests:

1. **re-render isolation: write to mock-eval bucket does NOT re-render chat consumer** - render-counter ref pattern per RESEARCH Finding #5 / Pattern 6. Renders ChatConsumer threadId=thread-A + MockEvalConsumer threadId=thread-A under one StreamsProvider; captures baseline render counts; fires setMessagesForBucket(mock-eval, thread-A, [...]) inside act(); asserts renderCount.chat === baselineChat (SC#3 binding assertion) AND renderCount.mockEval === baselineEval + 1.
2. **cross-surface bucket isolation: setMessagesForBucket(mock-eval, T, msgs) does not mutate bucketsBySurface.get(chat).get(T)** - pre-seeds chat bucket; captures chatBucketBefore reference; writes to mock-eval bucket; asserts chatBucketAfter === chatBucketBefore (reference equality - RESEARCH Pattern 3 nested-Map immutable replace only touches the affected surface inner Map); asserts eval bucket has the new message.

Both tests GREEN against the existing Plans 1-3 substrate without any production code changes.

### Task 2 (commit e823e0a) - DevTwoPaneMock + App.tsx mount

- **frontend/src/components/dev/DevTwoPaneMock.tsx (85 LOC, new)** - dev-only two-pane overlay:
  - Top-of-function literal `if (!import.meta.env.DEV) return null` per RESEARCH Finding #9 + Recommendation #7 (literal token; aliased variable would defeat Vite DCE per PATTERNS.md drift gotcha).
  - PaneA subscribes to (chat, dev-thread) via useThreadMessages named hook; renders count + JSON-dump of bucket content.
  - PaneB subscribes to (mock-eval, dev-thread) via useThreadMessages; tick button calls useStreamsStore.getState().actions.setMessagesForBucket(mock-eval, dev-thread, (prev) => [...prev, {...}]).
- **frontend/src/App.tsx (+2 LOC)** - added `import { DevTwoPaneMock }` and mounted `<DevTwoPaneMock />` as sibling of ChatLayout inside TooltipProvider (inside StreamsProvider).

## Task Commits

Each task was committed atomically (Task 1 = test commit; Task 2 = feat commit; Task 3 pending-checkpoint, no commit):

1. **Task 1 (test, 068-04 binding gate):** 00bdf00 test(068-04): add SC#3 multi-surface isolation tests (re-render + cross-surface bucket)
2. **Task 2 (feat, dev-only mock):** e823e0a feat(068-04): add DevTwoPaneMock dev-only overlay; mount in App.tsx for SC#3 manual exercise
3. **Task 3 (checkpoint:human-verify):** pending-checkpoint - Chrome MCP manual exercise deferred to orchestrator on main tree

## Files Created/Modified

- **frontend/src/components/dev/DevTwoPaneMock.tsx (NEW, 85 LOC)** - dev-only overlay; Vite DCE strips it from production bundle.
- **frontend/src/__tests__/providers/streamsProvider.test.tsx (792 -> 923 LOC, +131)** - 2 new tests in describe block "Phase 068 - multi-surface isolation (SC#3)". Added render to @testing-library/react import; added Message import from @/types; added useThreadMessages to the StreamsProvider import.
- **frontend/src/App.tsx (+2 LOC)** - DevTwoPaneMock import + JSX mount.

## Acceptance criteria - Tasks 1+2 (Task 3 deferred)

| Task | Criterion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 1 | grep -c multi-surface isolation streamsProvider.test.tsx | >= 1 | 2 | PASS |
| 1 | grep -c re-render isolation streamsProvider.test.tsx | >= 1 | 2 | PASS |
| 1 | grep -c renderCount streamsProvider.test.tsx | >= 3 OR react-render-stream >= 1 | 9 (render-counter path; fallback NOT triggered) | PASS |
| 1 | grep -c mock-eval streamsProvider.test.tsx | >= 3 | 14 | PASS |
| 1 | npm test --run -t multi-surface isolation | exit 0 (both GREEN) | 2/2 GREEN | PASS |
| 1 | npm test (full suite) | exit 0 | 136/140 (4 pre-existing failures unchanged) | PASS (per Plan 3 baseline precedent - zero new failures introduced) |
| 1 | LOW #10 fallback documentation | only if triggered | NOT triggered - render-counter shipped clean | N/A |
| 2 | frontend/src/components/dev/DevTwoPaneMock.tsx exists | yes | yes | PASS |
| 2 | grep -c if !import.meta.env.DEV return null DevTwoPaneMock.tsx | 1 | 1 | PASS |
| 2 | grep -c mock-eval DevTwoPaneMock.tsx | >= 2 | 5 | PASS |
| 2 | grep -c useThreadMessages DevTwoPaneMock.tsx | >= 2 | 3 | PASS (1 import + 2 consumers) |
| 2 | grep -c import DevTwoPaneMock App.tsx | 1 | 1 | PASS |
| 2 | grep -c DevTwoPaneMock JSX mount App.tsx | 1 | 1 | PASS |
| 2 | npm run build exit 0 | yes | tsc -b fails on 30 pre-existing TS errors (unchanged from Plan 3 baseline); npx vite build itself exits 0 with built in 2.32s | DEVIATION (see below - scope-boundary per Plan 1/2/3 SUMMARY precedent) |
| 2 | Vite DCE proof: grep -l mock-eval/DevTwoPaneMock dist/assets | no matches | exit code 1 (no matches found) - component stripped from bundle | PASS |
| 2 | npm test (full suite) still GREEN | yes (vs baseline) | 136/140 unchanged | PASS |

## Vite DCE verification (Task 2 acceptance - Vite DCE proof)

After npx vite build succeeded, ran:

```
$ ls dist/assets/
index-3lT7QkSC.css  index-DqEURmRJ.js

$ grep -l mock-eval/DevTwoPaneMock/dev-two-pane-mock dist/assets/*.js
$ echo exit=$?
exit=1

$ grep -c mock-eval dist/assets/*.js
0

$ grep -c DevTwoPaneMock dist/assets/*.js
0
```

The production bundle contains zero references to the dev component identifying strings - Vite tree-shaking + the literal `if (!import.meta.env.DEV) return null` token at the top of the component function correctly eliminated all code paths.

## Manual Verification Regressions

_None observed yet - Task 3 Chrome MCP exercise has not yet executed. This section is the failure-recovery landing zone per MED #8: if any of the 8 Task 3 sub-steps deviates from expected behavior on the orchestrator main-tree run, each failure must be filed here with step number, expected vs. observed behavior, captured artifacts (screenshot + DOM snapshot + console errors), suspected substrate file, and resolution route (in-phase fix / /gsd:debug / documented deferral)._

## Decisions Made

- **Render-counter ref pattern shipped without LOW #10 fallback.** Vitest 4.1.0 + React 19.2.x under act() produced clean baseline-vs-after counts: chat consumer +0 renders after a mock-eval write, eval consumer +1 render. The @testing-library/react-render-stream fallback path remains documented in RESEARCH A4 if a future runtime swap introduces flakiness, but no swap was needed here.
- **Stub JSON-dump mock panes** over importing the real MessageList (RESEARCH Finding #9 tradeoff). Importing MessageList would couple DevTwoPaneMock to chat full toolbar/composer chrome and unnecessarily expand the dev-only import graph; even DCE-d, the resolution adds surface area to the bundle pre-tree-shake module graph.
- **Task 3 deferred to orchestrator** per the worktree scope_constraint - Chrome MCP requires a real browser session against a running dev server, which the worktree-agent cannot drive. The orchestrator on main tree (post-merge of this worktree) is responsible for running the 8-step manual exercise.

## Deviations from Plan

### 1. [Scope Boundary] tsc -b fails on 30 pre-existing TypeScript errors during npm run build

- **Found during:** Task 2 verification (npm run build).
- **Issue:** npm run build resolves to tsc -b && vite build. tsc -b aborts with 30 errors before vite runs. The acceptance criterion "cd frontend && npm run build exits 0" therefore literally fails.
- **Verification (baseline-unchanged):** All 30 errors match .planning/phases/068-streamsprovider-context-lift/deferred-items.md line-for-line (FolderNode.test.tsx, FolderTree.test.tsx, IngestionPage.test.tsx, useDocuments.test.ts, useFolders.test.ts, MessageItem.tsx, DocumentList.tsx, NavPanel.tsx, MemorySection.tsx, SkillFormDialog.tsx, SettingsPage.tsx). My new files (DevTwoPaneMock.tsx, modified App.tsx, streamsProvider.test.tsx) compile clean - absent from the error list.
- **Resolution:** Ran npx vite build directly - exits 0 with "2519 modules transformed; built in 2.32s". The vite production build itself works; only tsc pre-existing baseline errors block the chained tsc -b && vite build. Per Plan 1/2/3 SUMMARY precedent ("Plan 068-01 is considered DONE when its OWN new files compile clean and the test/build error counts are unchanged from baseline"), Plan 04 meets the same bar.
- **Files modified:** none (pre-existing, out-of-scope per executor scope-boundary rule).
- **Documented:** here in SUMMARY; not auto-fixed.

### 2. [Scope Boundary] 4 pre-existing test failures (unchanged from Plan 1/2/3 baseline)

- **Found during:** Task 1 verification (full npm test).
- **Issue:** MessageItem.test.tsx (full file), model-info.test.ts > costTier values, api.test.ts > listSkillFiles / uploadSkillFile / deleteSkillFile - total 4 failures.
- **Verification:** Same 4 failures before and after Plan 4. The two new SC#3 tests passed cleanly (2/2 GREEN). Plan 4 introduced ZERO new failures.
- **Action:** No change - already documented in deferred-items.md. Plan 04 inherits the same scope-boundary treatment as Plans 1/2/3.

---

**Total deviations:** 2 scope-boundary documented (0 Rule 1/2/3 auto-fixes).
**Impact on plan:** Zero on Tasks 1+2 end-state acceptance criteria. Task 3 acceptance is structurally pending the orchestrator manual exercise.

## Issues Encountered

- **Worktree Edit/Write tool buffering anomaly.** Early in Task 1, attempts to use the Edit and Write tools against the worktree filesystem returned success but did not persist changes to disk (tool virtual view showed edits, but git status and cat showed the original file). Confirmed by md5sum and git status --short (working tree was clean despite multiple Edit tool successes). Recovered by switching to Bash sed for in-place patches and Bash heredoc for new-file creation. All on-disk changes verified via git status + grep gates before commit. This is a tool-runtime issue, not a plan deviation - the on-disk content matches the planned content exactly.

## User Setup Required

None - DevTwoPaneMock is gated on import.meta.env.DEV and uses no external services.

## Task 3 - Pending Checkpoint (Chrome MCP manual exercise)

**Status:** pending-checkpoint:human-verify. NOT executed in this worktree (scope_constraint - worktree has no browser session; dev server runs on main tree).

**What the orchestrator must run (post-merge of worktree-agent-ab68fb9f6e548a1c8 into the main wave-collection branch):**

1. **Start dev server.** From repo root: cd frontend && npm run dev. Confirm Vite reports Local: http://localhost:5173/.
2. **Authenticate.** Visit http://localhost:5173/ in Chrome (or invoke Chrome MCP chrome-devtools__navigate_page). Log in with fhdmrd@gmail.com / 123456 (per MEMORY.md - reference_local_dev_app.md).
3. **Confirm DevTwoPaneMock overlay is visible.** Bottom-right of the chat surface. Two panes labeled "chat surface" and "mock-eval surface" with initial count 0 each.
4. **Isolation Test 1 - tick the mock-eval pane:** click "tick" in the mock-eval pane. **Expected:** mock-eval pane count 0 -> 1; chat pane count stays at 0. Tick 4 more times. **Expected:** mock-eval count = 5; chat count = 0. NO cross-contamination.
5. **Isolation Test 2 - send a real chat message:** in the main chat input (NOT DevTwoPaneMock), select any thread, type "hello from chat" and send. **Expected:** DevTwoPaneMock chat pane STAYS at count 0 (it reads dev-thread, not the real chat thread). Then run useStreamsStore.getState().actions.setViewingThread(dev-thread) in Chrome DevTools console, send a chat message. **Expected:** DevTwoPaneMock chat pane count -> 1; mock-eval pane count unchanged (still 5).
6. **Phase 067.5 5-cycle Branch D-3 spot-check.** Start streaming on Thread A -> switch view to Thread X -> switch back to Thread A -> confirm streamed content survives. Run 5 cycles. All five must show streamed content surviving the switch-back.
7. **Network panel sanity (D-068-08 / L-068-02).** Open DevTools Network panel, filter to active-runs. Switch tabs rapidly. **Expected:** ONE /active-runs request per visibility cycle, not two.
8. **Production build smoke (DCE).** Stop dev server. Run cd frontend && npm run build (or npx vite build). **Expected:** vite build succeeds; dist/assets does NOT contain DevTwoPaneMock symbols. *(Already verified at Task 2 acceptance - re-confirm here as a closing sanity gate.)*

**Pass criteria (verbatim from PLAN Task 3 acceptance):** all 8 sub-steps reach their expected outcomes. Then approve the checkpoint; Phase 068 is ready for /gsd:verify-work.

**Fail recovery (verbatim from PLAN Task 3 - failure-recovery path / MED #8):** If any step deviates from expected behavior:
1. Capture: screenshot + DOM snapshot via Chrome MCP chrome-devtools__take_snapshot; copy console errors and Network panel rows.
2. DO NOT type "approved". The checkpoint stays unresolved.
3. File the regression in this SUMMARY ## Manual Verification Regressions section above, with: step number, expected vs. observed, captured artifact paths, suspected substrate file (StreamsProvider.tsx action / streamsStore.ts bucket model / ChatArea.tsx residual code), and the resolution route taken.
4. Phase verification cannot pass until the regression is reproduced, root-caused, and resolved via one of:
   - **In-phase fix** via /gsd:revise-phase 068 (re-run the 8-step exercise from the top after the fix lands).
   - **Targeted debug** via /gsd:debug on the specific failing step.
   - **Documented deferral (LAST RESORT)** - Deferred Idea in 068-CONTEXT.md deferred section + new bug report in .planning/reported-bugs/ (filter: surface: Agentic-RAG) with concrete re_open_trigger.

## Open Q A1 Resolution (Plan 4 spec inventory check)

Per the PLAN env_notes mandatory check: ran `ls frontend/e2e 2>&1` - returns "cannot access: No such file or directory". **NO Playwright e2e specs exist in this codebase.** SC#3 "existing 063 / 063.1 / 067.x Playwright e2e regression specs stay green" clause is therefore interpreted per RESEARCH Finding #10: the Vitest unit suite + Phase 067.5 lived-experience Chrome MCP exercise (run at Task 3) are the regression gate.

## Plan 068 Closure Posture

- **SC#1 (provider owns state):** GREEN - Plans 1-3 substrate; Plan 4 binding tests confirm no leakage.
- **SC#2 (Branch D-3 preserved verbatim):** GREEN - Plan 2 it.each([chat, mock-eval]) test PLUS existing useMessages.test.ts Branch D-3 PLUS Task 3 manual 5-cycle re-run (pending).
- **SC#3 (mocked second surface renders without state collision):** AUTOMATED HALF GREEN (Plan 4 Task 1 re-render isolation + cross-surface bucket isolation); MANUAL HALF PENDING (Task 3 Chrome MCP exercise - deferred to orchestrator on main tree).
- **SC#4 (reconcileInFlightRef lock semantics):** GREEN - Plan 2 Task 1 covered.
- **L-068-01..07** all GREEN per Plan 2.
- **DevTwoPaneMock dead-code-eliminated in production** - VERIFIED (grep against dist/ -> 0 matches).
- **Manual checkpoint** - pending orchestrator; until approved (or regression filed + resolved), Phase 068 is NOT ready for /gsd:verify-work.

## Self-Check: PASSED

Files exist:
- FOUND: frontend/src/__tests__/providers/streamsProvider.test.tsx (923 LOC)
- FOUND: frontend/src/components/dev/DevTwoPaneMock.tsx (85 LOC)
- FOUND: frontend/src/App.tsx (44 LOC, +2 from baseline)

Commits exist on branch worktree-agent-ab68fb9f6e548a1c8:
- FOUND: 00bdf00 test(068-04): add SC#3 multi-surface isolation tests (re-render + cross-surface bucket)
- FOUND: e823e0a feat(068-04): add DevTwoPaneMock dev-only overlay; mount in App.tsx for SC#3 manual exercise

Test results:
- streamsProvider.test.tsx 16/16 GREEN (2 new + 14 existing)
- Full frontend suite 136/140 GREEN (4 pre-existing failures unchanged from Plan 3 baseline)
- vite build (direct) exits 0; tsc -b fails on 30 pre-existing TS errors (unchanged from baseline)
- Vite DCE: grep -l mock-eval/DevTwoPaneMock dist/assets returns no matches

Pending:
- Task 3 Chrome MCP manual exercise - orchestrator-driven, main tree, post-merge.

---
*Phase: 068-streamsprovider-context-lift*
*Plan: 04 (SC#3 binding gate + DevTwoPaneMock substrate proof)*
*Tasks 1+2 completed: 2026-05-13 - Task 3 pending-checkpoint:human-verify*
