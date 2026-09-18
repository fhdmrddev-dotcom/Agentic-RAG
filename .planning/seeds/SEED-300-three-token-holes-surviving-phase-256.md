---
seed_id: SEED-300
title: "Three token holes that survive Phase 256: forced_emit's failed-rung spend is not broken out, the eval WITHOUT arm's return is ignored, and an eval run's judge shot is not counted at all"
created: 2026-09-18
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: >
  Phase 257's METER-07 "what it cannot see" view is built and an operator asks WHY a
  retry-heavy workflow costs what it costs; OR any phase that adds a per-rung or
  per-call cost breakdown; OR any phase that makes an eval run's cost operator-visible
  (the judge shot is billed and counted nowhere, so an eval total is low by one call
  per graded arm).
trigger_paths:
  - "backend/app/services/forced_emit.py"
  - "backend/app/services/eval_runner_service.py"
  - "backend/app/services/harness/phase_types.py"
trigger_surfaces: [harness, workflow, provider, skills]
migration_note:
relates_to:
  - "backend/app/services/forced_emit.py:318"
  - "backend/app/services/eval_runner_service.py:648"
  - "backend/app/services/eval_runner_service.py:901"
  - "256"
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-300: Three token holes that survive Phase 256

Phase 256 makes a run's spend persistent and countable. **These three things remain uncounted or
unattributable after it ships**, and they are recorded in one entry because they share a consumer:
the first person who asks *"why did that cost that?"*

## The finding

### 1. `forced_emit`'s failed-rung spend is counted but NOT broken out (D-256-12)

`forced_emit` retries across rungs. Phase 256's `_drain` mirror accumulates **across** rungs, so a
multi-rung emit's tokens **do** reach the run total — including rungs that FAILED. That is the
correct answer for a **spend** rollup: a failed provider call is billed exactly like a successful
one, and pretending otherwise would under-count.

⚠ **What is missing is the ATTRIBUTION, not the arithmetic.** Nothing records *how much of this
run's cost was retries*. An operator looking at a retry-heavy workflow sees a large number with no
way to learn that most of it was the same emit attempted four times. Deferred deliberately at
D-256-12 — a per-rung breakdown is a schema and a UI, not a line in a drain loop.

### 2. The eval **WITHOUT** arm was paid for and its return is deliberately discarded

`backend/app/services/eval_runner_service.py:852-855` ignores the WITHOUT arm's return value. ⭐ That
is **correct for a VERDICT rollup** — the WITHOUT arm exists to establish a baseline, and folding its
verdict into the result would corrupt the comparison it exists to make.

⛔ **It is wrong for a SPEND rollup.** The arm was a real provider call against a real key. The
tokens were bought. Discarding the return discards the cost with the verdict, so an eval run's
recorded spend is low by one full arm.

### 3. ⭐ The eval **JUDGE** shot is counted NOWHERE — a hole no decision covers

`backend/app/services/eval_runner_service.py:648 _judge_eval_answer` is a **third paid provider
call** per graded arm, and its usage is measured **nowhere at all** — not in `eval_results`, not in
the run box, not in any rollup. This was found by Phase 256's own research (§Q1) and **is not
covered by any D-256-nn decision**, which is exactly why it is registered rather than left as a
footnote in a research document nobody re-reads.

⇒ **After Phase 256, an eval run's total is still incomplete by at least one call per graded arm**,
and (unlike holes 1 and 2) nothing in the codebase currently marks it as incomplete.

## Why it matters

The first two are attribution problems: the money is counted, but not explicably. The third is a
**counting** problem, and it is the dangerous one, because a number that is wrong but confident
beats a number that is absent at being believed.

⛔ **The concrete obligation this entry places on Phase 257:** the `METER-07` *"what it cannot see"*
view must **name the judge shot**. A coverage marker that omits a known-missing call is not a
coverage marker.

## When to surface

`METER-07` being built and an operator asking why a retry-heavy workflow costs what it costs; **or**
any phase adding a per-rung / per-call cost breakdown; **or** any phase making an eval run's cost
operator-visible.

## Scope estimate

**Small** for hole 2 (stop discarding a return that is already computed — but decide, explicitly,
that a spend rollup and a verdict rollup are different rollups). **Small** for hole 3 (one more
usage read on an existing call). **Medium** for hole 1, which needs somewhere to PUT a per-rung
breakdown before it can record one.

## Breadcrumbs

- `256-RESEARCH.md` §Q1 (the judge shot, found there) and §"Register Entries Owed" → R-4.
- D-256-12 is the decision deferring the failed-rung breakdown; ⛔ **no decision covers hole 3**,
  which is the reason this seed exists rather than a SUMMARY sentence.
- `backend/app/services/forced_emit.py` gets its ledger row in plan `256-04`, per O-6's same-commit
  rule — deliberately NOT in `256-02`, which does not touch the file.
