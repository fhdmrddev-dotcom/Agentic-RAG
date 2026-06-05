---
id: BUG-260605-01
title: Orphaned ask_user prompt from a failed/terminal run renders submittable but 404s silently (misleading 5:00 timer)
reported: 2026-06-05
surface: Agentic-RAG
severity: major
status: open
affected_areas: [frontend/panel-pending-askuser, backend/harness-failure-cleanup, backend/ask_user-roundtrip, HITL]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-052]
re_open_trigger: "Reviewed at Phase 095 discuss-phase (2026-06-05): a prior note tagged this 'route 095', but its surface is the side-panel pending-ask_user + backend harness-failure-cleanup + HITL round-trip, NOT the chat tool-card surface 095 owns. Routed OUT of 095 (operator did not object). Better fit: the ask_user/failure-honesty line — Phase 096 owns ask_user-restart UAT — or a dedicated HITL-cleanup fix. Stays open; re-route when that phase is scoped."
reproduces_on:
  branch: v2.5-dev
  commit: post-094 (HEAD after phase 094 completion, 2026-06-05)
  date: 2026-06-05
---

# BUG-260605-01: Orphaned ask_user prompt from a failed run renders submittable but 404s silently

## What we observed

Operator, during the Phase 094 live UAT (2026-06-05): navigating to an OLD harness thread that has a pending `ask_user` prompt, the workspace panel correctly renders the `ask_user` card — BUT:
- the countdown timer **resets to 5:00** on mount (implying the prompt is freshly live),
- clicking **Submit does nothing** (no visible change, no error),
- the backend logs `POST /runs/e0d1f740-31ef-400c-b0e7-625aac8ab62f/ask_user_response HTTP/1.1" 404 Not Found`.

**DB evidence (verified live, local Supabase, 2026-06-05):**
- `workflow_runs` `e0d1f740-31ef-400c-b0e7-625aac8ab62f` → **status = `failed`**, thread_id `cef20cdf-98d5-4087-b2bf-94d8117dd9d7`.
- `runs` row for that id → **None** (it is a workflow_run id, not a `runs` id — as designed for harness ask_user).
- `threads.active_workflow_run_id` for that thread → **`None`** (the anchor was cleared when the run failed).
- Anchor matches run_id? **False.**

## Why it matters

HITL (human-in-the-loop) reliability + trust. A workflow that **failed while paused at an `ask_user`** leaves an **orphaned pending prompt** that the panel still shows as a live, answerable card. The user tries to answer, and it **silently fails** — a first-class silent-failure / trust defect (the agent-as-colleague should never present a dead prompt as live). The misleading 5:00 timer reset compounds it (it implies the prompt is fresh). Confined to STALE/failed-run prompts on revisit — the happy path (a currently-active ask_user) is unaffected.

## Hypothesized cause

**Verified, not hypothesis.** Two coupled gaps:
1. **Backend cleanup gap:** when a harness run fails/terminates (the RC-4 failure path in `harness_engine.run_workflow` + `_shielded_finalize`), the anchor `threads.active_workflow_run_id` is cleared, but any **outstanding `ask_user` / `llm_human_input` pending prompt for that run is NOT resolved/cancelled**. So `GET /threads/{id}/pending` (panel.py) keeps returning the orphaned prompt, and `PendingAskCard` keeps rendering it as submittable.
2. **Submit correctly rejects, but the UX hides it:** `POST /runs/{run_id}/ask_user_response` (runs.py:496, the 093-04 F10 fix) does Step-1 `runs` SELECT (misses — wf-run id) → F10 `workflow_runs` fallback (finds it, owner-scoped) → **anchor-confirm `active_workflow_run_id == run_id` is False (None ≠ id) → 404** (the IDOR-safe "run not active" rejection, runs.py:559/569). The frontend receives the 404 but **surfaces no error** → "nothing happens." The `PendingAskCard` countdown is **client-derived on mount** (not from the prompt's real `created_at` or the run's liveness), so it shows a fresh 5:00 for a dead prompt.

This is the EXPECTED 404 path for a non-active anchor — the bug is that a dead prompt is shown as live + the failure is silent, NOT that the 404 logic is wrong.

## Surface classification

`Agentic-RAG` (this app). Cross-checked at GSD touchpoints. Not a 094 regression — 094 (D-06) only added draft rendering above the prompt; the `/pending` fetch + `PendingAskCard` submit + the anchor model are 087 (panel) + 093 (F10). 094's panel made the orphaned prompt slightly more prominent, which is how it was noticed.

## Suggested routing

- **Fold into in-flight phase:** Phase 095 (Chat Tool-Card Unification) — it owns the run-card / pending-prompt surface and pairs naturally with the deferred **WR-05** (terminal/failed-run revisit handling); both are "what does a terminal run's surface do on revisit" reconcile/cleanup issues. Surface + fold at `/gsd:discuss-phase 095`.
- **Defer to future phase / milestone:** n/a (next phase is the natural owner)
- **Plant as seed:** links to **SEED-052** (interactive todo-driven execution / proactive HITL) — same HITL family.
- **External — note only:** no

**Fix shape (for whoever picks it up):**
- *Backend:* on harness run failure/termination, resolve/expire any outstanding `ask_user` pending prompt for that run (so `/pending` stops returning it) AND/OR have `/pending` filter out prompts whose owning `workflow_run` is terminal (status in failed/completed/cancelled) or no longer the thread anchor.
- *Frontend:* surface the 404 as a clear, non-silent message ("This prompt has expired — the run is no longer active") and roll back the optimistic submit; do not render a fresh 5:00 countdown for a terminal-run prompt (derive from the prompt's real age, or hide the timer when the owning run is terminal).

## Workarounds (prompt-side, code-side, or UI-side)

None meaningful for the user — the run is dead, so the prompt genuinely cannot be answered. Users can ignore the stale prompt and start a new run. (The final/failure state of the dead run still persists in chat per the 094 RC-4 fix.)

## Reference / evidence links

- Backend log: `POST /runs/e0d1f740-31ef-400c-b0e7-625aac8ab62f/ask_user_response HTTP/1.1" 404 Not Found`
- `backend/app/api/runs.py:496-573` (`submit_ask_user_response` — Step-1 + F10 anchor-confirm fallback → 404 on non-anchor)
- DB (local Supabase): `workflow_runs.status='failed'`, `threads.active_workflow_run_id=NULL` for thread `cef20cdf-98d5-4087-b2bf-94d8117dd9d7`
- Related: deferred WR-05 (094-REVIEW-FIX.md) — terminal-run panel-timeline-vanishes-on-revisit (same reconcile/terminal-run family); 094-HUMAN-UAT.md G-1
