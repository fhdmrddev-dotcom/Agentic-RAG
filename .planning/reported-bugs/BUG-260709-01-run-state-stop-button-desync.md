---
id: BUG-260709-01
title: Chat run-state / stop button desyncs from backend reality (both directions) — user can't trust "is it running?"
reported: 2026-07-09
surface: Agentic-RAG
severity: major
status: open
affected_areas: [frontend/streaming, backend/run-lifecycle, StreamsProvider, redis/runs-active]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-094]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 6ce1be0a
  date: 2026-07-09
---

# BUG-260709-01: Chat run-state / stop button desync

## What we observed

During cross-provider UAT (2026-07-08/09), the chat's "running / stop" state drifted from
backend reality in **both** directions, confirmed against DB + Redis:

**Direction A — backend done, UI stuck "running" + dead stop button (OpenAI thread `f308d617`):**
- DB: run `9f69ddf1` `status=completed`, `completed_at=20:22:22`. **No** runs with
  `status=streaming` anywhere. Redis `runs:active` = **empty**.
- UI: 16+ minutes later still showed the thread as running; clicking **Stop did nothing**
  (there is no active run to cancel — the backend finished long ago).
- Fix that worked: a browser refresh reconciles to "completed" (the app is supposed to
  reconcile via fetch on reconnect — D-v2.5-03 — but the live SSE path left the UI stale).

**Direction B — backend streaming, UI shows NO stop button (DeepSeek `ef317508`, MiniMax `e086075e`):**
- DB: `status=streaming`; Redis `run:{id}` streams actively growing (last events 13–37s old,
  DeepSeek xlen=4391). Genuinely running.
- Redis `runs:active` = **empty** even though these were actively streaming → the UI had no
  "active run" signal, so **no stop button appeared** for a genuinely-running (6+ min) run.

## Why it matters

Major (trust bug). The whole product depends on the user trusting "is it working / is it
still running / can I stop it?" Right now that signal is unreliable: a finished run can look
stuck and unstoppable, and a genuinely long-running one can offer no stop control. This
erodes confidence independent of how good the underlying features are — the user hit it live
and did not know whether tokens were still burning (they were not).

## Hypothesized cause

Two-part, hypothesis (needs tracing):
1. `runs:active` (Redis sorted set the UI/lifecycle relies on for "a run is active") is **empty
   even while runs are streaming** — registration into `runs:active` either never happens, is
   removed prematurely, or is swept by a cleanup/boot-reconciler while the producer continues.
   This kills the stop button for live runs (Direction B).
2. On completion, the frontend `StreamsProvider` local state isn't finalized when the terminal
   SSE event is missed/dropped, leaving a phantom "running" + dead stop (Direction A). Related
   to the run-end finalizer gaps (BUG-260626-03) and SEED-094 (run-end honesty).

NOT caused by the 2026-07-08 DeepSeek/openai_compat change — MiniMax (which does not go through
that deepseek-only code path) shows the same `runs:active`-empty behavior.

## Surface classification

`Agentic-RAG` — our frontend streaming state + backend run-lifecycle / Redis active-set.

## Suggested routing

- **Fold into in-flight phase:** n/a
- **Defer to future phase / milestone:** a run-lifecycle/honesty phase — make `runs:active`
  authoritative (register on start, remove on terminal, reconcile on reconnect) and make the
  UI stop-button + running-badge derive from it deterministically, in both directions. Pairs
  with SEED-094 (run-end honesty) and BUG-260702-02 (orphaned runs on restart).
- **Plant as seed:** covered by SEED-094; this bug is the concrete cross-provider repro.
- **External — note only:** no

## Workarounds (prompt-side, code-side, or UI-side)

- **Refresh the browser tab** — reconciles the phantom "running" state to the backend truth
  (nothing is lost; there was nothing to stop).
- Nothing to clean server-side in Direction A (backend state is already correct; only the tab
  is stale).

## Reference / evidence links

- OpenAI thread `f308d617-04a6-4c59-b4c2-30d381b64a86`, run `9f69ddf1` completed 20:22:22.
- DeepSeek `ef317508…` run `2075b364` (xlen 4391), MiniMax `e086075e…` run `3bd13487` — both
  streaming while `runs:active` empty.
- Redis key conventions: `runs:active`, `runs_by_thread:{thread_id}`, `run:{run_id}` (CLAUDE.md).
