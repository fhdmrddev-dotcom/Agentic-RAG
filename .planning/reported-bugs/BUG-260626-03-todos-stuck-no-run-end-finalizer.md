---
id: BUG-260626-03
title: Workspace TODOS left visibly stuck when the model omits a completion write_todos (no run-end finalizer)
reported: 2026-06-26
surface: Agentic-RAG
severity: minor
status: deferred
affected_areas: [backend/agent-loop, frontend/panel]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-094]
re_open_trigger: "Any phase re-touching agent_loop.py run termination/finalization, OR a user reports todos stuck '0/N, task 1 in progress' after a run that finished and delivered. Promote via SEED-094 at /gsd:new-milestone."
trigger_fired: >
  2026-09-13, at /gsd:new-milestone — the OPERATOR, unprompted: "sometimes the task is completed
  perfectly but the To Do List is not updated so it looks like it's unfinished job". That is arm 2
  of re_open_trigger, verbatim, reported as lived friction rather than found by a sweep.
  ⛔ This report is NOT re-opened, and the reason is recorded rather than assumed: the code it was
  deferred against HAS since changed — Phase 138 shipped `reconcile_open_todos_on_run_end`
  (todos_service.py:117, called from run_producer.py:146) and SEED-094 closed on it. The new
  sighting is therefore filed fresh as BUG-260913-02, which names the ONE measurement that
  separates "the 138 reconciler did not fire" (a defect) from "it fired and its honesty marker
  reads as a failure verdict" (a scoping decision). Route through that report, not this one.
reproduces_on:
  branch: develop
  commit: 06ae19dc
  date: 2026-06-26
---

# BUG-260626-03: Todos left stuck at "0/N, task 1 in progress" after a run completes

## What we observed

After a run completed and produced its deliverable, the Workspace TODOS panel still read "0/4 — task 1 IN PROGRESS, rest PENDING" (thread `13ae9bfe`).

**Two-sided check decisively isolates it:**
- Stuck thread `13ae9bfe`: the model called `write_todos` exactly ONCE per turn (initial plan only: `[in_progress, pending, …]`) and **never** called it again to flip statuses to `completed`. The DB `todos` table = byte-for-byte what the panel showed.
- Clean single run `a07c73bb`: the model called `write_todos` twice — initial `[in_progress, pending]` then **final `[completed, completed]`** — and the panel correctly showed **2/2 COMPLETED**.

So the panel **faithfully renders the DB**; there is no dropped SSE event and no UI reconciliation failure.

## Why it matters

The todo plan looks permanently stuck/abandoned even when the run actually finished and delivered — an honesty/clarity gap on the workspace surface. Minor (cosmetic; correct data), but it erodes trust in the run-status surface and was noticed immediately in lived use.

## Hypothesized cause

**FINDING — adversarially verified.** This is **agent/model behavior, not a UI or code regression.** The todo lifecycle is 100% model-driven: the only thing that advances/completes a todo is the model calling `write_todos` again (`_handle_write_todos` → `replace_todos` full-state-replace → `todo_updated` SSE). The system-prompt nudge to "call write_todos again as you complete each step" (`agent_loop.py:~567-571`) is **advisory only**, and there is **no run-end finalizer** that reconciles todos when a run terminates. The entire todo path (TodosSection, StreamsProvider todo handlers, `replace_todos`, `_handle_write_todos`, the prompt text) is **byte-for-byte unchanged** across the v3.1 window vs the v3.0 baseline → not a code regression.

"It used to work" = run-to-run model variance (some runs emit the completion `write_todos`, some don't). Secondary suspect to RULE OUT (uncertain, no direct evidence): v3.1 context changes — CTX-03 trim-pin (Phase 123) and CTX-01 origin-filter (Phase 120) — could drop the earlier todo turn from the model's working context, making it less likely to re-issue `write_todos`. Confirm via a LangSmith trace (did the model's context still contain its plan at run-end?).

## Surface classification

`Agentic-RAG` — agent orchestration + panel. Routing candidate.

## Suggested routing

- **Fold into in-flight phase:** candidate for a small backend orchestration fix.
- **Defer:** acceptable — it is honest (shows real state), low severity.
- **Plant as seed:** n/a
- **External — note only:** no

## Proposed fix (backend, additive, shared-path-safe — reuses the shared todo_updated SSE)

Add a **run-end todo reconciler** at the agent loop's existing terminal/finalization point: when a run ends **cleanly** and todos have a non-terminal tail, emit a synthetic full-state `write_todos`-equivalent via the existing `replace_todos` + `todo_updated` path. **HONESTY guardrail (per verifier):** do NOT silently auto-complete — that would falsely claim success on failed/Stop-cancelled/abandoned runs. Prefer flagging the plan as "ended with open todos" (or completing only the genuinely-finished in_progress item) over fabricating done. Must: distinguish clean-complete vs cancel/error/ask_user-timeout; reuse full-state-replace; re-emit the full canonical list; be idempotent (once per run, no-op when all terminal). Do NOT modify `_handle_write_todos`, `replace_todos`, the `todo_updated` shape, or any frontend file.

## Workarounds

None UI-side; the data is honest. A prompt nudge ("mark each todo complete as you finish") can help per-run.

## Reference / evidence links

- Root-cause workflow `wf_cf429301-479` (locate:todos + verify:todos, both agree, high confidence; verifier parsed every tool_call — zero `completed` ever sent in the stuck thread).
- DB: `todos` table for `13ae9bfe` = [(t1,in_progress),(t2,pending),(t3,pending),(t4,pending)]; clean-run `a07c73bb` got `[completed, completed]`.
