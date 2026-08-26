---
id: BUG-260826-07
title: The default scheduled-run token budget (50k) cancels any workflow with a retrieval phase — measured 3.6x over on the FIRST phase
reported: 2026-08-26
surface: Agentic-RAG
severity: major
status: open
affected_areas: [backend/scheduler, frontend/workflows, backend/harness, automations]
folded_into: 210
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: production
  commit: 386b5a4
  date: 2026-08-26
---

# BUG-260826-07: The default scheduled-run token budget guarantees cancellation

## What we observed

A scheduled run of a 3-phase workflow (RAG agent → synthesis → `external_action`) was cancelled
**61 seconds in, at the end of its first phase**, with the caps left at their defaults. Measured
from `workflow_runs.metadata` on run `81cee4be-6b37-4d46-a3c4-d6650dfb5dd2`:

```json
{"reason": "token_budget_exceeded", "max_tokens": 50000,
 "observed_by": "phase_completed", "input_tokens": 174946, "output_tokens": 6946,
 "cumulative_tokens": 181892, "elapsed_seconds": 61.695, "max_duration_seconds": 600}
```

**181,892 tokens against a 50,000 cap — 3.6x over, from ONE phase**, a `gather-status` agent step
reading ~20-30 knowledge-base sources. The phase itself completed successfully; the breaker then
cancelled the run at the phase boundary, so phases 1 and 2 never started.

The value is not a deployment mistake. It is the shipped default in two places:

- `backend/app/models/schedule.py:147` — `max_tokens_per_run: int = Field(default=50_000, …)`
- `frontend/src/components/workflows/WorkflowScheduleModal.tsx:110` — `useState(50000)`

against a ceiling of `MAX_TOKENS_CEILING = 2_000_000` (`schedule.py:45`) — so the default sits at
**2.5% of what the system permits**, and below what a single realistic retrieval phase consumes.

The wall-clock default (`600` seconds) was NOT the binding constraint here — the run died in 61
seconds — but it is worth noting it must also cover the human approval wait for any workflow
containing an armed `external_action` step, since the breaker is wall-clock anchored to
`claimed_at`/`created_at` (`db/workflows.py:2493-2511`).

## Why it matters

Major. A user who schedules any workflow that reads its knowledge base — the product's core
capability — and accepts the defaults gets a run that is cancelled before it produces anything,
having already spent ~180k tokens. The default does not protect them from cost; it spends the money
and then throws the result away.

It is also **hard to diagnose from the product**. The run reads `cancelled`; the reason,
the observed token counts and the cap all live in `workflow_runs.metadata.circuit_breaker`, which
required a hand-written SQL query to find. A user without database access sees a workflow that
"just stops".

Compounding: on this install this path is the only launcher that can carry per-run arguments to a
`send_email` step (BUG-260826-01), so the unrealistic default also blocks the only workaround for
the blocking bug.

## Hypothesized cause

**Hypothesis.** 50,000 reads like a placeholder chosen for a conservative first cut of Phase 204's
circuit breaker, never calibrated against a real workflow's consumption. The breaker itself works
exactly as designed — it observed at a phase boundary, recorded its evidence in full, and failed in
the safe direction. Only the number is wrong.

## Surface classification

`Agentic-RAG`.

## Suggested routing

- **Fold into in-flight phase:** n/a
- **Defer to future phase / milestone:** small; natural companion to BUG-260826-03/06 as one
  scheduler-honesty change
- **Plant as seed:** n/a
- **External — note only:** no

Suggested shape:

1. **Recalibrate the default** against a measured real workflow rather than a round number. One
   retrieval phase measured 181,892 tokens; a 3-phase workflow of this shape plausibly needs
   400k-600k. Whatever is chosen, record the measurement beside it so the constant cannot rot
   silently.
2. **Keep the model default and the modal default in lockstep** — they are two literals in two
   files today, which is how they drift.
3. **Surface the cancellation reason in the product.** `metadata.circuit_breaker` already carries
   everything needed (reason, cap, observed totals, elapsed); a cancelled run should say *"stopped:
   token budget exceeded — used 181,892 of 50,000"* rather than only `cancelled`.
4. **Consider whether the wall-clock default can accommodate an approval wait** for workflows
   containing an armed `external_action` step, or whether the human wait should be excluded from
   the duration measure.

## Workarounds (prompt-side, code-side, or UI-side)

Raise the caps on the schedule before triggering (ceiling 2,000,000 tokens / 24h):

```sql
UPDATE workflow_schedules
SET max_tokens_per_run = 1000000, max_duration_seconds = 3600
WHERE id = '<schedule id>';
```

Each re-attempt re-runs the workflow from phase 0, at full token cost — there is no resume from the
cancelled point.

## Reference / evidence links

- Run `81cee4be-6b37-4d46-a3c4-d6650dfb5dd2`, `workflow_runs.metadata.circuit_breaker`, 2026-08-26
- `backend/app/models/schedule.py:45, 147-150` — ceilings and defaults
- `frontend/src/components/workflows/WorkflowScheduleModal.tsx:110` — the duplicated UI default
- `backend/app/db/workflows.py:2437-2511` — `arm_run_budget` / `load_run_budget`, the wall-clock anchor
- `backend/app/services/scheduler_service.py:125-137` — the `_schedule_*` caps written into run inputs
