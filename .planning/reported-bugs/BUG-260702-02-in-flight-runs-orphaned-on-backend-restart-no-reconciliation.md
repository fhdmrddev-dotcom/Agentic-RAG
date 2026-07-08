---
id: BUG-260702-02
title: In-flight eval/chat runs are orphaned on backend restart — stuck non-terminal forever (no reconciliation)
reported: 2026-07-02
surface: Agentic-RAG
severity: major
status: folded
affected_areas: [backend/eval-runner, backend/run-lifecycle, backend/threads, frontend/run-status]
folded_into: "137.1"
verified_closed_by: null
related_seeds: [SEED-100]
re_open_trigger: "Reviewed at /gsd:discuss-phase 137 (2026-07-03) — NOT folded: backend reconciliation stays SEED-100. 137 owes only the DISPLAY half per the 055-B sketch contract: an interrupted eval run renders an honest banner + re-run affordance in the Studio run history (never a silent failure / stuck 'running'). || Folded at /gsd:discuss-phase 137.1 (2026-07-04): boot-time reconciliation sweep (eval->interrupted, chat->failed, stale streams dropped) is CONTEXT D-09/D-10. || Extended at /gsd:discuss-phase 145 (2026-07-09): 137.1 shipped the BOOT sweep; 145 adds the LIVE half — a periodic stream-age staleness sweep (D-145-06) so a dead-producer run self-heals WHILE the app is up, not only on next boot. The 137.1 orphan predicate ('absent from runs:active') is also being replaced by stream-age, since 145 demotes runs:active to a derived mirror (D-145-02). Re-open if a restart/crash-orphaned run stays non-terminal with the app running after 145 ships."
reproduces_on:
  branch: develop
  commit: 34834433
  date: 2026-07-02
---

# BUG-260702-02: In-flight runs orphaned on backend restart, no reconciliation

## What we observed

During Phase 134 UAT the user started an eval (OpenAI `gpt-5.4-mini`, docx skill) and it "ran"
for **>22 minutes without finishing**. Investigated live:

- `eval_runs` row `d89f75df` stuck `status='running'`, **age 22.7 min, `completed_at` NULL, zero
  `eval_results` rows** — no arm ever persisted.
- Redis: `runs:active` = **0**, `runs_by_thread:eval:<skill>` = **empty**, and the run's stream
  `run:d89f75df…` had **xlen=1, last entry ~1414 s (23.5 min) ago** — one event, then silence.
- The user had **restarted the backend** mid-run. The eval job is an asyncio task in the old
  process; the restart killed it. Nothing flips the DB row back to a terminal status.
- Same class visible in `runs`: **15 chat runs stranded in `streaming`/`cap_paused`** (oldest
  ~104 min), all with `runs:active` empty → all dead orphans.

Manual cleanup applied 2026-07-02: `eval_runs` orphan → `interrupted`; 15 `runs` orphans →
`failed`; stale Redis stream deleted. (`eval_runs.status` CHECK already allows `interrupted`.)

## Why it matters

- **User sees a run "running" forever** — no error, no timeout, no recovery. The eval panel /
  run status spins indefinitely; the user cannot tell a hung run from a slow one.
- **Not just dev.** Every production deploy / container restart / crash strands whatever was
  in-flight in exactly this state. At org scale this accumulates silently and erodes trust in
  the eval verdict + run surfaces.
- Correlates with existing run-lifecycle reports (`thread-switch-hang-stream-connection-saturation`,
  `timer-disappears-long-runs`) — stranded `streaming` rows also invite reconnect churn.

## Hypothesized cause

No startup reconciliation and no heartbeat/stale-run detector. A run's terminal transition is
written only by the live asyncio task (eval finalizer / agent-loop finalizer). If the process
dies, the row is never finalized. On boot nothing sweeps rows that are non-terminal in Postgres
but absent from `runs:active` in Redis (the authoritative "actually streaming" set), so they
stay `running`/`streaming` permanently.

## Surface classification

`Agentic-RAG` — our own run-lifecycle. Routing candidate.

## Suggested routing

- **Fold into in-flight phase:** n/a (surfaced during 134.1; that phase is scoped to the sidebar
  hide-filter, not run recovery).
- **Defer to future phase / milestone:** dedicated run-reconciliation phase — on startup (and/or a
  periodic sweep) mark any `eval_runs`/`runs` non-terminal in PG but not in `runs:active` as
  `interrupted`/`failed`; consider a `last_heartbeat` + stale timeout so long-hung (not just
  restarted) runs also self-heal.
- **Plant as seed:** fold into **SEED-100** (production-clean eval) or a broader run-lifecycle seed.
- **External — note only:** no.

## Workarounds (prompt-side, code-side, or UI-side)

- Manual DB sweep (what was done): set orphaned `eval_runs`→`interrupted`, `runs`→`failed`, and
  delete their stale `run:*` Redis streams. Not user-facing; needs code to be self-healing.

## Reference / evidence links

- `backend/app/services/eval_runner_service.py` (eval finalizer writes terminal status only from
  the live task); `runs:active` sorted set = authoritative "currently streaming" (CLAUDE.md
  run-buffer key conventions).
- Live evidence 2026-07-02: eval_run `d89f75df` running 22.7 min / 0 results; 15 `runs` orphaned
  `streaming`; Redis stream 1 event / 23.5 min stale; `runs:active` empty.
