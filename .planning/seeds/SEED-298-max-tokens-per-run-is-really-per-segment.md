---
seed_id: SEED-298
title: "max_tokens_per_run is really max_tokens_per_SEGMENT, and it only exists on a SCHEDULE — a run resumed five times can spend 5x its ceiling, and no interactive run has one at all"
created: 2026-09-18
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: >
  The first operator report of a resumed or continued run exceeding its configured
  ceiling; OR any phase that touches CircuitBreaker ceiling semantics, the
  ctx.run_usage_box reset at harness_engine.py:1844, load_run_budget, or that offers
  a token ceiling on an INTERACTIVE run. Fixing it means seeding the breaker from the
  persisted workflow_runs.input_tokens on resume, which Phase 256 makes possible for
  the first time by persisting that number.
trigger_paths:
  - "backend/app/services/circuit_breaker.py"
  - "backend/app/services/harness_engine.py"
  - "backend/app/models/schedule.py"
  - "backend/app/db/schedules.py"
trigger_surfaces: [harness, workflow, admin, settings]
migration_note:
relates_to:
  - "backend/app/services/harness_engine.py:1844"
  - "backend/app/services/harness_engine.py:1818"
  - "backend/app/db/workflows.py:2514"
  - "SEED-074"
  - "256"
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-298: `max_tokens_per_run` is really `max_tokens_per_SEGMENT`

## The finding

**Two halves, both measured at Phase 256, and the second is the more surprising.**

**(a) The ceiling is per SEGMENT, not per run.** The circuit breaker's counters are folded from
`ctx.run_usage_box`, and that box is **reset on every `_resume_run`**
(`backend/app/services/harness_engine.py:1844`). So a run that is paused and resumed five times
starts each segment from zero and can spend **5× its configured ceiling** while every individual
segment reports itself compliant. The name `max_tokens_per_run` says otherwise, and an operator
tuning it is tuning something other than what they read.

**(b) ⭐ The setting exists ONLY on a SCHEDULE — no interactive run can configure one at all.**
`grep -rn "max_tokens_per_run" backend/app` resolves **every writer** to a `workflow_schedules`
path (`backend/app/models/schedule.py:147`, default `500_000`, ceiling `MAX_TOKENS_CEILING`), and
**nothing anywhere assigns `ctx.max_tokens_per_run`** outside that route. So the cap is
simultaneously (a) weaker than its name for the runs it does govern, and (b) **absent entirely** for
every run a person starts by hand.

## Why it matters

A safety cap that is off by the number of resumes is not a safety cap — it is a number that makes
people feel protected. The failure is quiet by construction: nothing trips, nothing logs, and the
per-segment accounting is internally consistent, so the first evidence is a bill or a quota.

⚠ **Half (b) is the part that bites soonest.** The surface where a person is most likely to say
*"stop after N tokens"* is an interactive run, and that control does not exist. Any future UI that
offers one must not be wired to this setting as it stands.

## When to surface

The first operator report of a resumed or continued run exceeding its ceiling; **or** any phase
touching `CircuitBreaker` ceiling semantics, the `ctx.run_usage_box` reset at
`harness_engine.py:1844`, `load_run_budget`, or one that offers a token ceiling on an interactive
run.

## Scope estimate

**Medium**, and ⛔ **NAMED, NOT FIXED — deliberately** (D-256-10, Phase 256 plan `256-02`).

**The reason, recorded rather than implied.** `max_tokens_per_run` is a **shipped safety cap that
operators have already tuned**. Changing what it counts is a live behaviour change on real
schedules: a workflow that has been running happily for weeks could begin tripping at a third of the
work it used to complete. That needs its own phase and its own UAT, not a line inside a metering
phase.

⭐ **The fix is newly POSSIBLE, which is why it is worth registering now rather than later.** Seeding
the breaker from the **persisted** `workflow_runs.input_tokens` on resume — instead of from a box
that was just zeroed — is the natural repair, and **Phase 256 is what makes that number exist in the
database for the first time**. Before this phase there was nothing to seed from.

## Breadcrumbs

- `256-RESEARCH.md` §"Register Entries Owed" → R-2, and its §Q2 arithmetic on `_enforce_budget`
  (branches 3 → 3, `await` 1 → 2, new state 0).
- `docs/HOT-FILE-LEDGER.md` → `backend/app/services/circuit_breaker.py` (row added at Phase 256)
  carries the sibling invariant: the `max(0, …)` clamp must stay on the **returned** delta, because
  the box going backwards across a reset is a normal event, not a bug.
- `SEED-074` (workflow/harness token-usage rollup) is the parent concern; Phase 256 flips it to
  `partially-answered` and this seed carries one of the arms it does **not** close.
