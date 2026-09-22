---
seed_id: SEED-300
title: "Three token holes that survive Phase 256: forced_emit's failed-rung spend is not broken out, the eval WITHOUT arm's return is ignored, and an eval run's judge shot is not counted at all"
created: 2026-09-18
surface: Agentic-RAG
status: partially-answered
partial: true
status_note: >
  Hole #2 (the eval WITHOUT arm's discarded return) was CLOSED by plan 256-03 —
  VERIFIED IN SOURCE at plan 256-05's base, not inherited: eval_runner_service.py:971
  now passes `usage_acc=usage_acc` with the comment "you were billed for this arm too",
  and :888 declares `usage_acc: dict = {}` above the loop with keys deliberately ABSENT
  until something is measured (D-256-06). Holes #1 (no per-rung attribution, deferred at
  D-256-12) and #3 (the eval judge shot counted nowhere, covered by NO D-256-nn
  decision) remain OPEN with their triggers intact. Plan 256-05 (gap-closure round 1)
  then added THREE new residuals to the body — the raised `forced_emit` rung, the
  crashed/cancelled harness phase, and the pre-round-1 local-dev rows — each with its
  own concrete trigger.
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
  # ⚠ PINS CORRECTED at plan 256-05 (gap-closure round 1), and every original is kept
  #    BESIDE its correction rather than over it (S-5) — a stale pin sends the next
  #    reader to the wrong line with full confidence, which is worse than no pin.
  - "backend/app/services/forced_emit.py:318"
  - "backend/app/services/eval_runner_service.py:289"   # the judge shot (`_judge_eval_answer`) — was ":648", measured :289
  - "backend/app/services/eval_runner_service.py:344"   # its `forced_emit` call — NEW pin, the line hole #3 is actually about
  - "backend/app/services/eval_runner_service.py:971"   # the WITHOUT arm's `usage_acc=usage_acc` (hole #2, CLOSED by 256-03) — was ":901"
  - "backend/app/services/eval_runner_service.py:888"   # the accumulator declared above the loop (256-03)
  - "backend/app/services/harness/publish_service.py"   # the raised-rung residual added in round 1 (IN-03)
  - "backend/app/services/harness_engine.py"            # the crashed/cancelled-phase residual added in round 1
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

### 2. ✅ **CLOSED by plan 256-03** — the eval WITHOUT arm's return is no longer discarded

⭐ **VERIFIED IN SOURCE at plan 256-05's base commit, not inherited from a SUMMARY.** Measured:
`eval_runner_service.py:971` now passes `usage_acc=usage_acc` with the comment *"Phase 256
(METER-05) — you were billed for this arm too"*, and `:888` declares `usage_acc: dict = {}` ABOVE
the arm loop with the note that *"Keys stay ABSENT until something is measured, so an unmeasured job
reaches the column as NULL rather than 0 (D-256-06)"*. The spend rollup and the verdict rollup are
now explicitly different rollups, which is exactly the decision the scope estimate below asked for.

⚠ **The original finding is preserved verbatim below rather than deleted**, because what the hole
WAS is the only thing that makes the fix legible to a later reader.

### 2 (as originally written). The eval **WITHOUT** arm was paid for and its return is deliberately discarded

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

---

## Residuals ADDED by plan 256-05 (gap-closure round 1)

⚠ These are **named residuals of a round that closed two criteria**, not new findings discovered
elsewhere. They are recorded here, with concrete triggers, because the alternative is a sentence in
a SUMMARY nobody re-reads — which is the failure mode this whole register exists to end.

### 4. A `forced_emit` shot that RAISES returns no dict, so its billed tokens are unreachable (IN-03)

`publish_service.py`'s judge loop catches `except Exception … continue` around the `forced_emit`
call. When it fires, `forced_emit` returned **no dict at all** — so there is nothing to read, and
the tokens the provider may already have billed for the partial shot are unreachable from that
scope. Round 1 counted every shot that was SERVED AND RETURNED (all three attempts, failed ones
included) and **declined to manufacture a number** for the raised one.

⛔ **Do not "fix" this by estimating.** The honest options are a usage channel on `forced_emit`'s
raise path, or accepting it.

**Trigger:** *any phase that gives `forced_emit` a raise-path usage channel, or any per-rung cost
breakdown* (which is hole #1's trigger too — they close together or not at all).

### 5. A harness phase that CRASHES or is CANCELLED mid-work still loses its delta

Round 1's flush (`harness_engine._flush_run_usage`, called once per loop iteration above every
outcome arm) covers the three ORDINARY returns CR-01 named — a human-gate pause, `fail_run`, and a
dangling `skip_to` target. It does **not** cover an exception escaping the phase `try`, because a
`try`/`finally` around the `while` loop was **explicitly REJECTED** with its reason written into the
source: a `finally` also runs on `asyncio.CancelledError`, where an unshielded `await` is itself
cancelled — that would change which exception leaves the engine on a user Stop, which is precisely
what `_enforce_budget`'s docstring and the Phase-194 `cancel_phase` single-call-site fence exist to
protect.

⚠ So a user Stop or a mid-phase crash loses that phase's spend from `workflow_runs`. That is
outside CR-01's three ordinary returns and outside SC#1's *"after the process restarts"* wording,
and it is a real gap rather than a technicality.

**Trigger:** *any phase that makes mid-phase spend durable, or that touches the escape handler's
shielded cleanup.*

### 6. Local-dev rows persisted between plan 256-04 and round 1 carry a 4-leg marker over uncounted judge spend

Any `workflow_runs` row written in that window claims four-leg coverage while the two judge shots
were uncounted — the exact over-claim CR-02 found.

⭐ **MEASURED, and it is why no retro-marking migration is proposed:** migration 182 is in
**neither `origin/master` nor `origin/production`** (`git log --oneline origin/production --
supabase/migrations/182_*.sql` → empty; same for master), so **no production row is in this state**
and the affected rows are local dev rows from a single day. The residual is real and named; it is
not a production correctness debt.

**Trigger:** *migration 182 reaching a deploy branch with pre-round-1 rows still present.*

---

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
