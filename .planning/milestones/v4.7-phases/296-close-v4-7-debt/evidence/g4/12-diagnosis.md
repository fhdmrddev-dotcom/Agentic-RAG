---
status: diagnosed
trigger: "296 G-4 drive 2026-10-27 — in an EXISTING thread, Run a workflow → 1-step published workflow '293 board: deepseek'; run completes server-side in ~4 s, the answer row is persisted, but the chat column ends at the user bubble; the status line disappears; reopen renders the answer"
created: 2026-10-27
updated: 2026-10-27
red_test: frontend/src/__tests__/providers/streamsProvider_296_g4_12_in_thread_start_no_answer.test.tsx
---

# 12 — In-thread workflow start: the answer never renders until a reopen

## Resolution (root cause)

**sendMessage follows a fresh in-thread kickoff with its OWN follow, and that follow's terminal never
re-reads the thread.** A harness kickoff deliberately inserts zero assistant nodes (194.1 R5,
`5a3654202`). So nothing the follow does can show the answer:

- the live `delta` that carries the answer is written onto `assistantId`, a row that does not exist;
- the terminal's getMessages "content patch" only **edits** rows that already have `m.runId === rid`,
  and it never **inserts**;
- there is no `actions.reconcile(threadId)` on this path.

296-04's reconcile and G-4 S3's `run_completed` end both live in `subscribeProducerStream`, and this
path never reaches it. So the answer stays persisted but unrendered until a thread switch or reload,
because only `setViewingThread`'s reconcile adds it.

**The line vanishing is by decision, not the bug.** ThreadRunLine is silent on `completed` (D-16)
because the RunCard or answer is meant to carry the outcome, and here nothing arrives to carry it.

**The wrong reading `1 phase done… · Step 1 of 1 · 1m 57s` is a separate defect.** Every part of it
describes the PREVIOUS run of the same thread:

- the phase slice still holds that run's `say: done`;
- the frame was read before this run's row existed.

## Answers with file:line (HEAD 2e9461b25, `frontend/src/providers/StreamsProvider.tsx` unless named)

### (a) Which path follows the stream
sendMessage's own kickoff follow, not `subscribeProducerStream`.

- `useStartWorkflowInThread.ts:92-96` calls `sendMessage(threadId, "Run <name>", {workflowDefinitionId, inputs, surfaceId:"chat"})` without awaiting it.
- `:2918` POST. `:2979-2985` reserves `subscriptionsRef[run_id]`. `:3031` `makeStreamCallbacks({assistantId, …})`. `:3039-3223` is the terminal wrapper. `:3236` `await subscribeToRun(run_id, "0", callbacks, …)`. That is the `GET /runs/<id>/stream?since=0` seen in Network.
- `subscribeProducerStream` (`:1856-1938`) has only three callers: the reconcile frame arm (`:2709-2713`), the settle path (`:3962-3963`) and the producer-resubscribe signal (`:4380`). None of them fires on a fresh kickoff. It would also no-op on `subscriptionsRef.has(run_id)` (`:1859`).
- RED test case 1 pins this: one subscribe, to the producer id, from `"0"`.

### (b) Does its terminal reconcile? Why does nothing render?
**No reconcile runs at all.** So no preserve-guard, `sendingThreadsRef`, `pendingSendThreadsRef` or
`reconcileInFlightRef` is involved: nothing reaches them.

What the path does instead:

- `:2866-2882` is the R5 gate. A harness kickoff inserts the user bubble and `harnessKickoffThreads`, and **no assistant node**.
- `:573-585` (`applyPendingDeltas`) maps the answer `delta` onto `m.id === assistantId`, which is absent, so it is dropped.
- `:3114-3125`: the runStatus flip over the same absent id is a no-op.
- `:3170-3196`: `getMessages`, then `prev.map(m => m.runId === rid && m.role === "assistant" ? …)`. This is patch-only. No bucket row carries that runId, and a harness answer comes back with `runId` undefined anyway (`:2341-2342`, `:2353-2355`). So it is a double no-op.
- `:3209-3214` clears the workflow lock. `:3222` calls `originalOnTerminal`, the no-op base (`:676-684`). There is no reconcile.

If a reconcile WERE added here, the guards would not block it:

- `subscribeToRun` calls `onTerminal("reader_done")` without awaiting it (`lib/api/threads.ts:1302`) and then returns. The wrapper awaits `_isTransientStreamEnd`'s snapshot probe first (`:283-295`), so the `finally` (`:3355-3367`) has already cleared `sendingThreadsRef` / `pendingSendThreadsRef` / `streamingThreads`.
- The user temp was re-id'd to the real `message_id` at `:3006-3007`, so it is no longer a `temp-` row and its persisted twin replaces it (`:2315-2381`).
- `reconcileInFlightRef` (`:2168`) only drops it if another reconcile of this thread is in flight at that instant, for example from a focus or visibility event. That is a blind spot, below.

The resumed-run case renders because it goes through `subscribeProducerStream`, whose terminal reconciles (`:1912-1916`).

### (c) Why the status line vanishes
1. The wire ends with `done`. The SSE route breaks on it: `TERMINAL_TYPES` (`backend/app/services/run_transport.py:70`, `backend/app/api/runs.py:196`).
2. The client runs `onDone`, then the reader closes and it runs `onTerminal("reader_done")` (`lib/api/threads.ts:1117-1121`, `:1302`).
3. The `finally` deletes `streamingThreads` (`:3363-3367`). Effect #1b (`:4213-4231`) then clears `harnessKickoffThreads`.
4. The wrapper clears the lock (`:3213`). `useHarnessLiveForThread` (`:5217-5223`) goes false.
5. `ThreadRunLine` re-reads the frame on the isLive transition (`components/chat/ThreadRunLine.tsx:221-243`), sees `last_run_status: "completed"` and returns null (`:282`, D-16).

Every step is correct. The outcome is simply never rendered.

### (d) The wrong reading `1 phase done… · Step 1 of 1 · 1m 57s` at ~2 s
- **Step / word.** The panel's reconcile on thread open left the previous run's slice `[say: done]` in `phasesByThread`. At kickoff the live line counts that slice (`ThreadRunLine.tsx:260-277`, through `harnessBannerProgress`), so it reads `1 phase done…` / `Step 1 of 1` before this run has started. This run's `phase_started(say)` then hits `appendPhaseForThread`'s slug-idempotence (`:3997`) and is dropped, so the slice keeps describing the old run.
- **Elapsed.**
  - The live mark is set synchronously before the POST (`:2879-2881`). ThreadRunLine's effect keys only on `[threadId, isLive]` (`ThreadRunLine.tsx:243`), so its one frame read races the POST and reads the PREVIOUS run's `last_run_created_at`.
  - The lock's run id arriving later does not change `isLive`, which was already true, so nothing re-reads the frame.
  - Measured (local DB, thread `14555c45…`): `workflow_runs` `2e0fe262` was created at 03:41:07 and `13cbbd01` at 03:43:03, a 116 s gap. The RED test renders exactly `1m 57s`.
  - "Started in the app" is the previous run's origin by the same mechanism.

## Evidence

- **Local DB, read-only.** Thread `14555c45-ff3d-4073-8fde-2bc0ba079401`:
  - user "Run 293 board: deepseek" at 03:43:03.040, assistant at 03:43:06.572;
  - `runs` `d0fe345e…` ran 03:43:03 → 03:43:06 and is `completed`; `runs.message_id` is NULL;
  - the previous run of the same workflow was at 03:41:07 (`814b19b2` / `2e0fe262`).
- **Local Redis, read-only.** `run:d0fe345e-d8da-4ec6-ad41-88703b4c6fac`, 5 entries: `phase_started(say,0)` · `phase_completed(say,0)` · `delta` (the answer) · `run_completed(completed)` · `done`. There is no `stream_end`; the harness never writes one, only `agent_loop.py:3737` does. The two earlier runs carry the same shape.
- **RED at HEAD** (`npx vitest run <file> --maxWorkers=2`): 3 failed, 2 passed.
  - THE DEFECT: the bucket is `[m-prev-user, m-prev-answer, m-new-user]` and the answer is missing.
  - (d) step: the word is `"1 phase done…"`.
  - (d) elapsed: `"1m 57s"`.
  - The two passing cases are characterization: the follow is sendMessage's own from `"0"`, and the instrument leaves on terminal.
- **GREEN with the proposed diff.** Applied in a throwaway worktree (`.claude/worktrees/dbg-g4-12`, since torn down; this tree is untouched): 5/5.
  - The 31 adjacent suites read 416 passed / 0 failed both at base and with the fix, with an identical per-file set. They cover ThreadRunLineKickoff, MessageList ×3, StreamsProvider stopping ×2, streamsProvider*, 244 settle, 295-10, 296 G-4 S3, 296 follow-up files, phaseHooks, PhaseReconcile, PhaseCard 296, useStartWorkflowInThread, ThreadWorkflowPicker, StopControl, ComposerStopHarness, the cap-paused / deep-continue / typed-continue / inputs provider suites, 403, lock lockstep, ChatLayout launch ×2 and ActiveRunsTray.
  - `tsc -p tsconfig.app.json` reports no errors in the two changed files.
- **Bisect consistency.** The no-node gate is from `5a3654202` (194.1-03, 2026-08-16). The Workflows-page launch posts directly (`ChatLayout.tsx:433`) and lands on the run surface, so the chat-thread path is the one that never re-reads. This matches "same on 07e2e4ba8".

## Eliminated

- `subscribeProducerStream` follows the kickoff. Refuted: one subscribe, by sendMessage, from `"0"` (test case 1, and callers listed in (a)).
- A preserve-guard (`sendingThreadsRef` / `pendingSendThreadsRef`) or `reconcileInFlightRef` swallows a reconcile. Refuted: no reconcile is issued on this path, and the guards are already clear by the time one could run.
- The stream never ends (S3-style missing sentinel). Refuted: the fresh producer writes `done` and the server closes on it. The terminal fires; it just does not reconcile.

## Proposed fix (minimal; the diff is in the debugger's hand-back)

1. **The defect.** In sendMessage's terminal wrapper, after `originalOnTerminal`, add one guarded reconcile for a harness kickoff on the viewed thread, the same shape as `:1912-1916`.
2. **(d) step.** In the R5 harness arm, drop the thread's `phasesByThread` entry in the same `setState` that marks `harnessKickoffThreads`.
3. **(d) elapsed and origin.**
   - ThreadRunLine also re-reads the frame when the lock's run id arrives.
   - The live arm omits the elapsed and origin of a frame whose `last_run_status` is finished, because that frame describes the previous run.

## Blind spots

- If a focus or visibility reconcile of the same thread is mid-flight at the terminal, `reconcileInFlightRef` drops the new one. The in-flight one may have read its snapshot before the answer was persisted. The 296-04 path shares this. A reopen still heals it.
- The reconcile is gated on `viewedThreadId === threadId`. A start in thread A followed by a switch to B before the end leaves A to heal on re-entry, which is the shipped behaviour.
- Fix 2 empties the panel's step list for one RTT at kickoff, until `phase_started`. This is honest (a new run) but visible; not driven in Chrome.
- None of this has been driven live (G-4 row 12 re-drive owed).
