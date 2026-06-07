---
seed_id: SEED-064
title: Stop control missing for backgrounded / capped-out in-flight runs — user can't reach the working cancel path
status: planted
planted: 2026-06-07
phase_origin: Phase 096 live UAT (Test 3 stream-cap storm) — operator-run, DB-verified
category: B — real defect (frontend UX), slated for the same dedicated fix phase as SEED-063 (operator-approved 2026-06-07)
severity: major
related_seeds: [SEED-063]
related_findings: [SEED-063 (execute_code timeout — same incident), SEED-065 (load degradation — same incident)]
relates_to:
  - "`backend/app/api/runs.py:1014-1102` — `DELETE /runs/{id}` cancel verb WORKS (owner-scoped, task.cancel() reaches RUN_TASKS, 204 idempotent). The backend stop path is fine."
  - "frontend run-status strip / ToolCallPanel / StreamsProvider — Stop affordance is tied to the live stream subscription; runs outside the LRU-3 stream pool (Phase 096 SC#5 cap) render no Stop button"
  - "Phase 095/095.1 never-vanishes run-status strip — the natural home for an always-present Stop control"
re_open_triggers:
  - The dedicated fix phase for the 096-UAT findings is planned (line item alongside SEED-063)
  - Any phase touching the run-status strip, StreamsProvider stream-pool, or ToolCallPanel controls
  - Stream-cap / LRU-3 pool behavior is revisited
priority: high (pairs with SEED-063 — together they were the "stuck with no way out" incident)
suggested_phase: same small dedicated fix phase as SEED-063
---

# SEED-064 — Stop button for backgrounded runs

## What happened (Phase 096 live UAT, 2026-06-07)

During the ≥6-run stream-cap storm, two runs wedged inside `execute_code`
(SEED-063). The operator reported: **"I do not have the stop button to stop
it."** The only recovery was killing Docker containers + restarting the backend.

## Root cause

The backend `DELETE /runs/{id}` cancel path is healthy and owner-scoped. The
gap is purely UI: the Stop affordance is bound to the live stream subscription,
so a run that has scrolled out of the LRU-3 stream pool (the Phase 096 SC#5
connection cap — exactly the backgrounded runs most likely to wedge) renders no
Stop control. The user cannot reach a cancel path that already works.

## Fix direction (for the fix phase)

1. Surface a Stop control for ANY in-flight run regardless of stream-pool
   membership — the Phase 095/095.1 never-vanishes run-status strip should offer
   Stop for backgrounded runs (it already shows their "running" pulse honestly
   per D-11a).
2. Stop → `DELETE /runs/{id}` (existing endpoint, no backend change needed).
3. Reconcile after cancel via fetch (D-v2.5-03) — the run flips to cancelled;
   the strip updates.
4. Provider-uniform (UI is provider-agnostic — one UX, N adapters).
5. G-2 sketch-before-build may apply (touches live run UI) — confirm the
   placement against the sketch-findings-agentic-rag skill before coding.

## Vibe-coder plain summary

When a chat is running but isn't the one you're currently watching, there was no
Stop button — so a stuck run couldn't be stopped from the app at all. The
backend can stop it fine; the button just isn't shown for background chats. The
fix: always show a Stop button for any running chat, even backgrounded ones.
