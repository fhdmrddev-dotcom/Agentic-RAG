---
seed_id: SEED-094
title: Run-end honesty pair — Phase-120 baseline files leak into the live final_output_files emit (BUG-260626-02) + no run-end todo finalizer leaves todos visibly stuck (BUG-260626-03)
status: closed
closed: 2026-07-06
closed_by: "Phase 138 (Run-End Honesty). RUN-01a baseline-emit leak fixed in 138-01 (run-scoped content-hash accumulator) + live-verified 138-03. RUN-01b run-end todo finalizer landed in 138-02 (reconcile_open_todos_on_run_end, both clean finalizers) + live-surfaced by 138-04 (fetch-on-terminal) + re-verified live in 138-05 (Chrome MCP ×2 + psycopg2). Both original re-open triggers verified fixed live."
planted: 2026-06-26
phase_origin: "Phase 123 SC#10 Axis-2 (multi-tool/multi-run) lived-experience UAT (thread 13ae9bfe / run 89125149, 2026-06-26) — root-caused + adversarially verified via workflow wf_cf429301-479"
category: backend agent-loop run-end honesty — two additive, shared-path-safe finalizers (D-14 intact); both surfaced together, both small, both belong in one dedicated backend fix phase
related_seeds: []
related_memories: [project_123_uat_render_bugs, project_123_executed, feedback_uat_lived_experience_gap, feedback_separate_per_feature_safe_by_construction]
related_decisions:
  - "Phase 120 COLL-01/CTX-01 (commit a56ad2ea) run-scoped the sandbox-harvest baseline per-CELL — but the per-run final_output_files AGGREGATE emit was not filtered (half-closed)."
  - "Todo lifecycle is 100% model-driven (write_todos -> replace_todos -> todo_updated SSE); the system-prompt nudge is advisory only; there is NO run-end reconciler."
re_open_triggers:
  - Any phase that re-touches `agent_loop.py` final_output_files emission (~line 2239, `_emit_metas = list(_previous_files_in_run.values())`) — close BUG-260626-02 in the same change by filtering `iteration == -1` baseline seeds out of the emit while the aggregation is already open.
  - Any phase that re-touches `agent_loop.py` run termination/finalization (the clean-complete vs cancel/error/timeout/ask_user-timeout branch points) — land the BUG-260626-03 run-end todo reconciler then, while terminal-state handling is already open.
  - A user reports dead "Download unavailable" generated-file cards on a REUSED sandbox / second run in a thread (the baseline-leak symptom) — escalate BUG-260626-02.
  - A user reports todos left stuck "0/N, task 1 in progress" after a run that actually finished and delivered — escalate BUG-260626-03.
  - /gsd:new-milestone sweep of open surface:Agentic-RAG reports — promote this seed to a numbered backend run-end-honesty fix phase if not already scheduled.
priority: low
suggested_phase: A dedicated small backend run-end-honesty fix phase (candidate to schedule after CORE Phase 124, or fold into the next phase that opens agent_loop.py's emit/termination path). NOT a Phase 124 fold (124 is Workflow Studio UX / frontend). NOT a v3.1 CORE blocker — both are minor severity with honest data; the chat surface is not data-lossy.
surface: Agentic-RAG
trigger_when: unset
---

# SEED-094 — Run-end honesty pair (baseline-emit leak + todo finalizer)

Two backend `agent_loop.py` defects surfaced together during the Phase 123 SC#10
Axis-2 lived UAT (watching the RENDERED screen, not just the wire). Both are
backend-only, **additive, and shared-path-safe** (they reuse existing emit/SSE
paths — D-14 red line intact: no Deep/Harness/provider-path fork). They are
minor severity (honest data, no loss) and were **adversarially verified** to be
DISTINCT from the major frontend duplicate-key bug BUG-260626-01 (fixed
separately in commit `2a48fea4`) — do not conflate the three. Full reports:
`.planning/reported-bugs/BUG-260626-02-*.md`, `BUG-260626-03-*.md`.

## BUG-260626-02 — Phase-120 baseline files leak into the LIVE final_output_files emit (minor, latent)

Phase 120 (COLL-01, commit `a56ad2ea`) run-scoped the sandbox-harvest baseline
so a reused sandbox stops re-emitting prior-run files **per cell** — but the
**per-run aggregate** emit was not filtered. At `agent_loop.py:~2239`,
`_emit_metas = list(_previous_files_in_run.values())` aggregates the WHOLE
`_previous_files_in_run` dict, including the baseline seed entries stamped
`iteration: -1, url: None`. On a reused sandbox these dead seeds reach the live
`final_output_files` emit and render as **dead "Download unavailable" cards**.

- Phase-120 tests covered the per-cell DELTA, not the emit aggregation → COLL-01
  was half-closed. Verifier proved this does NOT cause BUG-01's url-present
  duplicate cards (different mechanism) — fix both, don't conflate.
- **Fix (additive):** filter `iteration == -1` (or `url is None`) baseline seeds
  out of `_emit_metas` before the final_output_files emit. Reuse the existing
  emit shape; add a test asserting a reused-sandbox second run emits only the
  current run's real files.

## BUG-260626-03 — No run-end todo finalizer; todos left visibly stuck (minor)

The todo lifecycle is **100% model-driven**: only the model calling `write_todos`
again advances/completes a todo (`_handle_write_todos` → `replace_todos` full-
state-replace → `todo_updated` SSE). The system-prompt nudge to "call write_todos
as you complete each step" (`agent_loop.py:~567-571`) is **advisory only**, and
there is **NO run-end reconciler**. When a model omits the completion
`write_todos` (run-to-run variance), the Workspace TODOS panel faithfully renders
the DB and shows "0/N, task 1 IN PROGRESS" forever even though the run finished
and delivered. The whole todo path is byte-for-byte unchanged across v3.1 → not
a code regression; it is model behavior + a missing finalizer.

- Two-sided proof: stuck thread `13ae9bfe` (model called `write_todos` once,
  never `completed`) vs clean run `a07c73bb` (called it twice → 2/2 COMPLETED).
- **Fix (additive, HONESTY-GUARDED):** add a run-end reconciler at the agent
  loop's existing terminal/finalization point. When a run ends **cleanly** with a
  non-terminal todo tail, re-emit the canonical list via the existing
  `replace_todos` + `todo_updated` path flagged as **"ended with open todos"**.
  **NEVER silently auto-complete** — that would falsely claim success on
  failed/Stop-cancelled/abandoned runs (the honesty risk the verifier flagged).
  Must distinguish clean-complete vs cancel/error/ask_user-timeout, be idempotent
  (once per run, no-op when all terminal), reuse full-state-replace, and touch NO
  frontend file and NOT `_handle_write_todos`/`replace_todos`/the `todo_updated`
  shape.

## Why one phase

Both live in `agent_loop.py`'s run-end region, both are additive finalizers
reusing shared emit/SSE vocabulary, and both were found in the same UAT. Bundling
them into one small backend fix phase keeps the agent-loop terminal path opened
once. Promote at the next agent_loop-touching phase or at /gsd:new-milestone.
