---
phase: 295-runs-that-don-t-dead-end
plan: 08
gap_closure: true
gap_closure_round: 1
subsystem: chat-thread ask card (panel + chat homes), phase reconcile, answer client
tags: [gap-closure, seed-361, wr-04, s1, pending-ask, tdd]
requires:
  - "295-07 (S1 measured FAIL in the chat-panel home; SEED-361 re-opened)"
  - "295-REVIEW.md WR-04 (bc4a31d54 on develop)"
provides:
  - "A paused workflow run's pending ask is answerable in the chat thread's Workspace panel and chat column"
  - "An engine ask (engine_pause) is answered by its offered choices only; no free-text box"
  - "A refused answer shows the server's own sentence instead of the bare status"
affects: [SEED-361, 295-VALIDATION.md S1, 295-REVIEW.md WR-04]
tech-stack:
  added: []
  patterns:
    - "One ephemeral store field + one module-level writer (the recordExpertReading pattern), fed by a read the provider already makes"
key-files:
  created:
    - frontend/src/components/panel/__tests__/PendingAskStack.pausedRun.test.tsx
  modified:
    - frontend/src/stores/streamsStore.ts
    - frontend/src/providers/StreamsProvider.tsx
    - frontend/src/components/panel/PendingAskCard.tsx
    - frontend/src/lib/api/threads.ts
    - frontend/src/components/panel/__tests__/PhaseReconcile.test.tsx
    - frontend/src/components/panel/__tests__/PendingAskCard.retired.baseline.test.tsx
    - frontend/src/lib/api/__tests__/threads.engineAsk.test.ts
    - scripts/vitest-count-gate.cjs
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
    - .planning/seeds/SEED-361-chat-panel-ask-stack-cannot-see-a-paused-run.md
decisions:
  - "The run status is carried from reconcilePhases' own getThreadWorkflow read into ONE store field; PendingAskStack reads it through useStreamsStore (never useStreamActions) and fetches nothing"
  - "Only `paused` un-retires an ask. A cancelled run, an anchor that is gone (run_status null) and a thread the store has never heard of all still retire, as before"
  - "Server lock semantics (threads.py F2 backstop) left unchanged, per the brief; the composer consequence is recorded below as a finding"
  - "WR-04 reuses the file's existing throwThreadRefusal helper rather than adding a new body reader"
metrics:
  duration: "~30 min"
  completed: 2026-10-21
  tasks: 2
  files: 12
---

# Phase 295 Plan 08: A paused run's ask stays answerable in the chat thread (gap round 1)

**What was wrong.** In the chat thread's Workspace panel, a paused workflow run's question showed as "RETIRED · The run was stopped, so this question no longer needs an answer", with Send disabled. This hit both kinds of question a run now pauses on: a search that found nothing, and an armed approval. The run page showed the same question correctly.

**Why.** A paused run has no live producer. So `GET /threads/{id}/workflow` reports the lock as stale, and the client never sets a workflow lock for the thread. The stack's rule `runIsOver = lock == null && phases.length > 0` then read "over" for a run that was waiting on the person.

**The fix.** The provider's phase reconcile already reads `getThreadWorkflow`, and that answer carries `run_status`. That status now goes into one store field. The stack reads it, treats `paused` as not over, and passes `paused` to the card. This turns on the card's 289 behaviour: no countdown expiry, plus the line "The answer window has passed. The run is paused and still waiting for your answer." No new fetch was added anywhere.

**WR-04, added by the coordinator mid-task.** On a question that offers only the server's choices, the card still showed a free-text box. The server refuses every typed answer to such a question with 422, and the card then showed only "refused (422)". The box and its "or" divider are now hidden for these questions. When any answer is refused with a server sentence, the card shows that sentence.

## Commits

| Gate | Commit | What |
|---|---|---|
| RED (SEED-361) | `14ffe7c2f` | `PendingAskStack.pausedRun.test.tsx` (7 cases) + 2 cases in `PhaseReconcile.test.tsx` |
| GREEN (SEED-361) | `a2866c3ea` | store field + writer, one call in `reconcilePhases`, `paused` in the stack; gate, ledger, CLAUDE.md rows |
| RED (WR-04) | `3629c7d9d` | 4 cases in `PendingAskStack.pausedRun.test.tsx` + 2 in `threads.engineAsk.test.ts` |
| GREEN (WR-04) | `3ad8f8ee4` | `!enginePause` on the box and divider; 4xx arm shows the server's words; `answerAskUser` uses `throwThreadRefusal` |

## Tests

**RED, observed before any source change:**
- `PendingAskStack.pausedRun`: 3 failed, 4 passed. The 3 failures are the defect: the panel card read "Retired", the found-nothing card read "Retired", and the chat pointer was missing. The 4 passes are the guard cases, which already held at base.
- `PhaseReconcile`: 2 failed (`expected undefined to be 'paused'`, `expected 'paused' to be null`), 26 passed.
- WR-04 RED: 4 failed, 11 passed. The failures were the free-text box present on an engine ask, the server sentence not shown, and `answerAskUser` keeping the constant twice.

**GREEN.** `PendingAskStack.pausedRun.test.tsx`, 11/11:
- panel home: no lock + phases + run paused → not retired, Send enabled after a choice, the 289 paused line shows
- chat home: the found-nothing pause shows its three choices. Picking "Search another folder" shows "Folder to search". Send waits for a folder, then enables.
- chat pointer: with a panel home mounted, a paused run's question still gets its pointer, and the page has exactly one Send Answer
- guard: run cancelled → retired with the stop sentence, Send dead on both axes, no chips
- guard: run status null (anchor gone) → retired
- guard: the store has never heard of the thread → retired (the old default)
- guard: Deep thread (no phases) → never retired, and no paused line
- WR-04: an engine ask draws no textbox, no "Reason" label, no "or"
- WR-04 guard: an ordinary ask with choices keeps its Reason box
- WR-04: a 422 carrying a server sentence shows that sentence, without "(422)", and the card stays answerable
- WR-04 guard: a 4xx with only the client constant still reads "Your answer was refused (422). It has not been saved."

**GREEN, other suites:**
- `PhaseReconcile.test.tsx` 28/28. reconcilePhases records `paused` for a paused frame, and null for a stopped frame (this overwrites a leftover `paused`). The two-literal key-set fence is still green.
- `threads.engineAsk.test.ts` 4/4. A 422 `detail` becomes the `ApiError` message, and the status is kept. An unreadable body keeps `ASK_ANSWER_FAILED`.

**Targeted run after both GREENs.** 94 files, 1347 passed, 0 failed (read from the run's own JSON report). The run covered:
- `src/components/panel` (all)
- `src/__tests__/providers` (all, incl. `workflowLockWriters.lockstep`, `streamsProvider_244_settle_ask`, the stopping suites)
- `src/__tests__/integration/streamsStore_per_thread`
- `src/__tests__/components/chat/MessageList*`
- `src/components/chat/__tests__/ChatArea*`, `MessageItem*`, `StopControl*`
- `src/pages/WorkflowRunPage.test.tsx`, `WorkflowRunPage.seam286.pin`
- `src/providers`, `src/lib/api`

An earlier run after the first GREEN alone (48 files, 790 tests) was also all green.

**Count gate.** The full gate was not run.
- `PendingAskStack.pausedRun.test.tsx` was adopted in both knobs: a file-level TARGETS entry and a BASELINE pin of 11.
- `threads.engineAsk.test.ts` pin went 2 → 4.
- `PhaseReconcile.test.tsx` pin went 19 → 28. It had been running 26 under a pin of 19.
- `PendingAskCard.retired.baseline.test.tsx` has a `?raw` line pin. It was re-baselined 1081 → 1087 → 1096, with a dated note for each step, and its retirement fences are untouched.

## Typecheck

`npx tsc -p tsconfig.app.json --noEmit` from `frontend/` reads **63 errors at base and 63 at HEAD.**
- The base set was measured by checking out the base versions of the touched files.
- After line-number normalisation, the set diff has one line in each direction, and it is the same inherited error: `src/stores/streamsStore.ts` TS2345, `StateCreator<…>` is not assignable. Only its abridged text changed, from `... 14 more ...` to `... 15 more ...`, because the new field adds one to the state's key count. No new error.
- An interim TS2352 in the new test (wrong `engine_pause.kind` literal) was fixed before the GREEN commit.

## Finding (measured from code, not fixed): on a paused run the composer is unlocked, but the server refuses the send

This is the server-side half of the same disagreement:
- Because the lock is reported stale, the client unlocks the composer on a paused run (`StreamsProvider.tsx` ~2589 "Stale / terminal / Deep → unlock").
- `POST /threads/{id}/messages` runs `preflight_workflow_kickoff` (`backend/app/services/workflow_kickoff.py:147-182`). It reads `workflow_runs.status` for the thread's anchor. `paused` is not in `("completed", "failed", "cancelled")`, so the send is **refused with 409**: "Thread is workflow-locked — cancel the active workflow to switch back to Deep mode."
- So a person who types into the composer while a run is paused gets a refusal. The client rolls back the optimistic message on that 409.
- Root cause: the F2 backstop (`backend/app/api/threads.py` ~2153-2175) marks the lock stale whenever the producer `runs` row is terminal. The send-path lock check reads only `workflow_runs.status`. The two server paths disagree about a paused run.
- Not changed here, per the brief. A follow-up should choose one of two fixes: make the F2 backstop exempt `paused` (the composer would then stay locked, and the client's lock seed would need to treat it like the cap pause), or keep the composer unlocked and word the 409 for a paused run.

## WR-04 (295-REVIEW.md, committed on develop at bc4a31d54)

- **Fixed (frontend only):**
  - `PendingAskCard.tsx` hides the free-text box and the "or" divider when `engine_pause` is present.
  - The generic 4xx arm shows the server's sentence when one was sent, else the shipped status line.
  - `answerAskUser` (`lib/api/threads.ts`) now throws through the existing `throwThreadRefusal`, so a string `detail` reaches the card. With no readable body, the message is the exported constant `ASK_ANSWER_FAILED` (the same literal it always threw).
- **Unchanged:** the 404, 409 and 5xx arms keep their own words. The 409 arm's comment now records that `err.message` can carry the server's sentence.
- **Not touched:** `backend/app/services/harness/engine_ask.py` (the review's third file), since backend findings belong to a separate fixer.

## Deviations from the brief

1. **[Rule 2] Two extra passthrough tests in `PhaseReconcile.test.tsx`.** These prove that the real `reconcilePhases` writes the field. Without them, the stack test would only show that the stack reads a field nothing writes.
2. **[Coordinator addition] WR-04 was added mid-task** with its own RED and GREEN commits. It needed `frontend/src/lib/api/threads.ts`, a FIRING file not in the original list. Its row and section were updated in the same commit.
3. **[Rule 3] The line-pin re-baselines** in `PendingAskCard.retired.baseline.test.tsx` were required by any edit to the card.

## Known limits

- **The status updates only when the phase reconcile runs.** That happens on thread open or switch, when a harness kickoff's stream ends (`harnessKickoffThreads`), after a Stop, and through the answered-settle path. A run that pauses during a stream this tab did not kick off has to be checked live (see below).
- **No request ordering on the writer.** Unlike `recordExpertReading`, two overlapping reconciles of one thread can land out of order. The next reconcile corrects it.

## What the live re-drive of S1 must check after merge

The `:8000` backend and the Vite dev server serve the operator's develop checkout, so none of this is visible until merged.
1. **Found-nothing, panel open.** Start a KB step that finds nothing, from the chat thread with the Workspace panel open, and let it pause. Check that the panel card reads "Needs you", not "Retired", with the three worded choices and no free-text box.
2. **Search another folder.** Pick "Search another folder" and check that "Folder to search" lists the server's folders. Send stays disabled until a folder is chosen. Send it, and check that the run resumes and completes cited.
3. **Reload and Stop.** Reload while paused and check that the card is still answerable. Then Stop a paused run and check that the card turns Retired with the stop sentence.
4. **Armed approval.** Open a run paused on an armed approval (one with a deadline). Check that the card shows "The answer window has passed. The run is paused and still waiting for your answer." where the clock was, and that the answer resumes the run.
5. **Live arrival.** Check the case where the pause lands while the thread is already open (no reload). Note whether the card is answerable as it arrives, or only after a thread switch. This is the reconcile-trigger limit above.
6. **Chat column.** With the panel closed, check the same full card in the chat column. With the panel open, check that the chat column shows the one-line pointer.
7. **Composer.** Type into the composer while paused and record the 409 (the finding above).

## Threat flags

None. No new endpoint, auth path or schema. The store field holds a status string the client already received.

## Self-Check: PASSED

- `frontend/src/components/panel/__tests__/PendingAskStack.pausedRun.test.tsx`: FOUND
- Commits `14ffe7c2f`, `a2866c3ea`, `3629c7d9d`, `3ad8f8ee4`: FOUND in `git log`
- `node scripts/check-claude-md-size.cjs`: exit 0 (97,396 chars)
- `node scripts/check-hot-file-ledger.cjs .planning/phases/295-runs-that-don-t-dead-end`: `ledger gate OK`
- `node scripts/check-seeds-register.cjs`: `seeds register gate OK` (SEED-361 `status: folded`, `folded_into: "295"`)
