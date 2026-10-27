---
status: diagnosed
trigger: "296 G-4 scenario 3 FAILED live 2026-10-27: a followed run's end never shows its answer or the Unsourced mark in the open thread"
created: 2026-10-27
updated: 2026-10-27
---

# G-4 S3 — diagnosis: the re-drive's stream has no terminal sentinel

## Root cause (confirmed by measurement)

The 296-04 fix runs inside `subscribeProducerStream`'s `onTerminal` wrapper
(`frontend/src/providers/StreamsProvider.tsx:1888-1914`). **On a re-driven run, `onTerminal` never
fires**, because the backend never writes a terminal sentinel to the re-drive producer's stream.

- The re-drive comes from `api/runs.py::_redrive_paused_workflow_run` → `_wake` (`runs.py:821-887`).
  Its `finally` only calls `finalize_run(...)` on the shell row (`runs.py:873-882`). It never calls
  `_emit_terminal`, and it never sets an EXPIRE.
- Compare the kickoff producer: `run_producer.py:291-297` writes `_emit_terminal(...)` after
  finalize.
- The engine's success tail writes these events, in this order: `finish_run` → `_surface_final_answer`
  (`delta`, then the answer row INSERT) → `run_completed` (`harness_engine.py:2314-2327`).
  `run_completed` is not a terminal type on either side:
  - The server's `TERMINAL_TYPES = {done, error, cancelled, timed_out}` (`run_transport.py:70`).
  - The client calls `onRunCompleted` for it, not `onTerminal` (`lib/api/threads.py:1224-1225`).
- So `replay_tail_consumer` keeps BLOCK-tailing until `consumer_timeout_seconds = 610`
  (`config.py:1341`, `runs.py:206-209`), and `subscribeToRun` never reaches a terminal branch.

**Measured, read-only, in local Redis** (`run:4d313e4c-ef72-4844-b12e-16d030b1b039`): `TTL -1`, 7 entries.

```
phase_started(research) · phase_completed(research) · phase_transition · phase_started(wrap)
· phase_completed(wrap) · delta · run_completed(status=completed)        <- last entry, no sentinel
```

Across every `run:*` buffer in local Redis, **8 streams end in `run_completed` with TTL -1**. This is
systemic for re-drives, not a one-off.

### Why each lived observation follows

| Observed | Mechanism |
|---|---|
| Panel reaches `Phase 2/2 wrap — Complete` | `run_completed` → `onRunCompleted` → `finalizeAllPhasesForThread` (`StreamsProvider.tsx:1375-1386`). These are live events, not the terminal. |
| No answer in chat after 25 s | The `delta` targets `assistantId = producerRunId` (`:1879`), which matches no message, so it is dropped. The only path that hydrates the persisted row is the 296-04 reconcile in `onTerminal`, and that never runs. |
| No `◌ Unsourced` | Live phase events carry no `unsourced`. The step re-read (`refreshPhaseSpineAfterStop`) is also called only from `onTerminal`. |
| Thread switch fixes both | `setViewingThread` → `reconcile` → snapshot + workflow read. |
| 296-04 unit test green | It calls `onTerminal("done")` by hand (`streamsProvider_295_10_follow_after_answer.test.tsx:383`), which the live wire never does. |

## Hypotheses

- **(a) ELIMINATED: another path opens the stream.** The answer chain is `PendingAskStack.settleAnswered`
  (`PendingAskCard.tsx:993-997`) → `releaseSettledWorkflowLock`. Recorded status `paused` lets it
  through (`StreamsProvider.tsx:3906-3913`). It reads `latest_producer_run_id` and calls
  `subscribeProducerStreamRef.current` (`:3950-3951`) → `subscribeToRun(id, lastSeenOffset ?? "0")`
  (`:1915-1917`). This matches the observed `?since=0`. No snapshot reconcile runs at answer time, so
  the `active_runs` attach loop (`:2417-2655`) is not the opener.
- **(b) ELIMINATED: reconcile runs but is neutered.** It is never invoked. In the RED test,
  `getSnapshot` is not called after `run_completed`.
- **(c) CONFIRMED, in a different form: the terminal is never delivered.** It is not a `paused`/`done`
  kind mismatch, and not a `since=0` replay of an old terminal. **No terminal exists in the buffer
  at all.**

## RED test

`frontend/src/__tests__/providers/streamsProvider_296_g4_3_redrive_no_sentinel.test.tsx` replays the
measured wire exactly, ending with `run_completed` and no `onTerminal`.

Run: `npx vitest run src/__tests__/providers/streamsProvider_296_g4_3_redrive_no_sentinel.test.tsx --maxWorkers=2`.

Result: **3 failed | 1 passed (4)**.
- Passes (the control): the panel reaches done/done.
- Fails: the answer id is not in the chat bucket.
- Fails: the step-1 `unsourced` is `undefined`.
- Fails: the follow still holds its pool slot and the signal is not aborted.

## Fix direction (product source NOT edited)

1. **Backend, the root cause.** In `_wake`'s `finally`, after `finalize_run`, emit the terminal
   sentinel mapped from the shell status, then EXPIRE 60. This mirrors `run_producer.py:291-297`.
   Then the shipped 296-04 wrapper fires as designed. The order is finalize → sentinel, so the
   follow-up snapshot no longer lists the shell as active. A pytest is owed. Check the same gap on the
   boot-sweep resume and the Continue re-drive.
2. **Frontend belt (this is what turns the RED vitest green).** In `subscribeProducerStream`, treat
   `run_completed` as the segment's end: call the wrapped `onTerminal("done")` once, then abort the
   controller. Precedent: `subscribeContinuationStream` already ends its segment on `cap_paused`
   because "a re-pause writes no terminal sentinel" (`:1992-1998`).
   - Verified out-of-tree against a patched copy: new file 4/4, `296_followup_files` 1/1,
     `244_settle_ask` 16/16.
   - `295_10_follow_after_answer` goes 9/10: "the panel's phases reach the terminal state" fails.
     That fixture fires `onRunCompleted` while the mocked server still reports the run `active`, with
     phases active and pending. The real server has already run `finish_run` and `complete_phase`
     before it emits `run_completed`. The fixture must set the completed frame before
     `onRunCompleted`.
   - ⚠ Belt alone has a ~1-6 ms race. The shell row stays `streaming` until `_wake` finalizes it.
     Measured: `run_completed` XADD at `...169515`, row completed at `.516`. If the snapshot lands in
     that window, reconcile re-attaches the shell, and with no sentinel that ghost placeholder lives
     610 s. **Ship 1 with 2.**

## Blind spots

- Not driven live after a fix.
- Why ThreadRunLine's `Starting workflow… Step 1 of 2` cleared mid-follow is not traced. It is not on
  the failure path: the answer and the mark depend only on the missing terminal.
- `run_failed` on a re-drive stream likely has the same no-sentinel gap. Its persist-vs-emit order
  was not checked, so the belt above handles only `run_completed`.
