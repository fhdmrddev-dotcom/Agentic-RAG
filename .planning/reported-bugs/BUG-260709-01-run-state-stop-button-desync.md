---
id: BUG-260709-01
title: Chat run-state / stop button desyncs from backend reality (both directions) — user can't trust "is it running?"
reported: 2026-07-09
surface: Agentic-RAG
severity: major
status: folded
affected_areas: [frontend/streaming, backend/run-lifecycle, StreamsProvider, redis/runs-active]
folded_into: "145"
verified_closed_by: null
related_seeds: [SEED-094]
re_open_trigger: "Folded at /gsd:discuss-phase 145 (2026-07-09). Fix model: Postgres runs.status authoritative (D-145-01); runs:active demoted to derived mirror written atomically by the extracted owner (D-145-02); Direction A = client inactivity watchdog + silent finalize (D-145-03/04); Direction B = periodic+boot stream-age staleness sweep (D-145-06). Re-open if either direction still reproduces after 145 ships."
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

## Root-cause trace (static, 2026-07-09 — CORRECTS the earlier hypothesis)

A static trace of the run-active plumbing (for Phase 145 scoping) found **three separate
representations of "is this run streaming?" that can drift apart** — and that the frontend does
**NOT** read the Redis set the original hypothesis blamed:

1. **StreamsProvider LOCAL state (SSE-driven)** — the in-session running/Stop signal
   (`frontend/src/providers/StreamsProvider.tsx`). This is what the user sees live.
2. **Postgres `runs.status='streaming'`** — the RECONCILE source of truth. `get_snapshot`
   (`backend/app/api/threads.py:364`, Step 3 ~:413-423) SELECTs `runs WHERE status='streaming'`;
   `StreamsProvider` derives `isStreaming = snapshot.active_runs.some(...)` (line ~232) from it
   on every mount / thread-switch / onTerminal reconcile. **A browser refresh fixes Direction A
   precisely because this SELECT returns `[]` once the run is `completed`.**
3. **Redis `runs:active`** — used ONLY by the boot orphan reconciler
   (`run_reconciler.py`, liveness oracle) and admin backpressure `ZCARD` (`api/admin.py:72`).
   **The frontend never reads it** (it is server-side). ZADD on start (threads.py:1125), ZREM on
   spawn-failure (:1138) / terminal (:1721 / :2209).

So the two observed directions have DIFFERENT root causes, and neither is "the UI reads an empty
`runs:active`":

- **Direction A (phantom running + dead Stop, backend done):** purely FRONTEND. The terminal SSE
  event failed to finalize `StreamsProvider`'s local streaming state AND no reconcile fetch fired
  to self-heal. The backend DB was already correct (`status=completed`; all ZREMs ran). Lives near
  the onTerminal transient-close probe (StreamsProvider ~:161-235) + the reconcile trigger — NOT
  the backend finalizer.
- **Direction B (no Stop on a live run; `runs:active` empty):** the empty `runs:active` is a REAL
  but SEPARATE inconsistency (reconciler / backpressure accuracy) — it is NOT why the Stop button
  was missing, because the UI does not read `runs:active`. The missing Stop is a local-state /
  broken-SSE issue: the run's last stream events were **13–37s STALE (not growing)**, consistent
  with the **backend having restarted mid-stream** (the operator noted the app "is being booted
  somehow" — uvicorn `--reload` recycles on file writes). A restart kills the in-process producer
  task; the DB can still read `streaming` until the NEXT boot's reconciler flips it, and the
  browser's SSE silently broke with no local Stop affordance + no reconcile.

**Still needs a LIVE repro to CONFIRM** (operator drives; verify via DB+Redis) — a Phase 145
discuss/plan task: (i) why `runs:active` was empty during Direction B (restart-swept vs ZADD race
vs reconciler `_drop_stream`); (ii) whether Direction A reproduces WITHOUT a restart (pure
missed-terminal-SSE) or only after one.

**Fix implication (reshapes Phase 145):** the fix is NOT merely "make `runs:active` authoritative"
— the frontend does not consume it. It is (a) pick ONE authoritative streaming signal (Postgres
`runs.status` is already the reconcile truth) and make `runs:active` + the reconciler +
backpressure derive from / agree with it; (b) guarantee the frontend self-heals a missed terminal
(reconcile safety-net) so Direction A cannot persist; (c) detect a broken SSE / restarted producer
and reconcile (ties BUG-260702-02). The G-5 extraction of the run-lifecycle out of `threads.py` is
the vehicle to centralize (a).

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
