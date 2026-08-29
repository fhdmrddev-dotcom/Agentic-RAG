---
id: SEED-231
title: The BLOCKING decision-coverage gate is structurally blind to every decision id this repo has ever written
status: planted
planted: 2026-08-29
planted_by: Claude, 2026-08-29, during `/gsd:plan-phase 217` — the gate returned `skipped, total 0` on a CONTEXT.md holding 24 decisions
surface: Agentic-RAG
severity: major
category: tooling / planning guardrail
priority: high
scope: >
  Make `check.decision-coverage-plan` recognise this project's `D-<phase>-<nn>` decision ids, and
  then re-run it over every phase that has already "passed" it, because a gate that skipped is
  indistinguishable in the record from a gate that checked.
affected_areas: [gsd-sdk, planning-workflow, decision-coverage-gate]
relates_to:
  - reference_decision_coverage_plan_gate_needs_literal_dnn (the memory that already recorded the literal-`D-NN` requirement — this seed is that memory turning out to have teeth)
  - SEED-171 (the other case where a green signal was not evidence)
  - "CLAUDE.md § Workflow guardrails — the family of guards that fire on what is PRESENT and are silent on what is ABSENT"
trigger_when: >
  Immediately, or at the next `/gsd:plan-phase` on any phase — the gate is BLOCKING and currently
  passes every phase for free, so every plan-phase run until it is fixed inherits the same blind spot.
---

# The gate that refuses to mark a phase planned — and has never once looked

## What was measured

During `/gsd:plan-phase 217`, at workflow step **13a (Decision Coverage Gate)**:

```
$ gsd-sdk query check.decision-coverage-plan \
    ".planning/phases/217-the-library-one-home-for-documents" \
    ".planning/phases/217-the-library-one-home-for-documents/217-CONTEXT.md"

{
  "passed": true,
  "skipped": true,
  "reason": "no trackable decisions",
  "total": 0,
  "covered": 0,
  "uncovered": [],
  "message": "No trackable decisions in CONTEXT.md."
}
```

`217-CONTEXT.md` contains **24** decisions, `D-217-01` through `D-217-24`, each in a bolded
`- **D-217-NN — …**` bullet under `<decisions>`. The gate reported **total 0**.

## Why it is blind

The handler matches a **literal two-segment `D-NN`**. This project has never used that form. Every
decision id in this repository is **three-segment and phase-qualified**:

- `D-217-01` … `D-217-24` (phase 217)
- `D-114-1`, `D-075.4-H1`, `D-v2.5-01`, `D-v2.5-03`, `D-v3.6-01`, `D-PRD-12`, `D-122-04`, `D-16`, `D-22`

So the gate finds nothing, sets `total: 0`, and takes the **`skipped: true` → `passed: true`** branch.

## Why that is worse than a gate that fails

The workflow comments on this gate say, verbatim:

> **Why this gate blocks:** failing here is cheap. The plans are the contract between discuss-phase
> and execute-phase; if a decision isn't visible in any plan, no executor will implement it.
> Catching that now beats discovering it after thousands of dollars of execution.

That reasoning is correct, and **it has never been applied.** The `passed: true` it emits is
consumed by an `jq -e '.data.passed == true'` check that cannot distinguish *"all decisions are
covered"* from *"I could not see any decisions."* The transcript line an orchestrator prints —
`✓ Decision coverage: (skipped — no decisions)` — is easy to read as benign.

⚠ **This is the exact family the hot-file ledger keeps rediscovering: a guard that fires on what is
PRESENT and is silent on what is ABSENT.** A row that is present and wrong answers the auditor and
stops the audit. A gate that skips does the same thing, and is cheaper to miss because it prints a
tick.

## What it would have cost here — measured, not assumed

Phase 217's coverage was re-derived by hand after the gate skipped:

```
D-217-01 -> 04,06,08,09,10,11,12      D-217-13 -> 09
D-217-02 -> 04,06,08,12               D-217-14 -> 05,09
D-217-03 -> 04,12                     D-217-15 -> 09,12
D-217-04 -> 02,10,11                  D-217-16 -> 09
D-217-05 -> 02,10                     D-217-17 -> 07,09
D-217-06 -> 03,11                     D-217-18 -> 01,07
D-217-07 -> 03                        D-217-19 -> 07,08,09
D-217-08 -> 01,02,10                  D-217-20 -> 06,09
D-217-09 -> 08                        D-217-21 -> 06
D-217-10 -> 01,08,12                  D-217-22 -> 07,09
D-217-11 -> 04,06,08,12               D-217-23 -> 01,04,08
D-217-12 -> 05,09                     D-217-24 -> 01,08
=== uncovered: 0 / 24 ===
```

**24 / 24 covered — so on this phase the gate's verdict was accidentally right.** That is precisely
what makes it dangerous: a blind gate that happens to agree with reality teaches everyone to trust
it. ⚠ **Six decisions here are carried by exactly ONE plan** (`D-217-07`, `-09`, `-13`, `-16`, `-21`,
and `D-217-03` by two). Cut any one of those plans for time and a locked decision leaves the phase
silently — which is the specific event this gate exists to refuse.

## The fix

1. **Widen the pattern** to `D-<segment>-<segment>` where a segment may be digits, a decimal
   (`075.4`), or a version-ish token (`v2.5`, `PRD`) — i.e. match the ids the repo actually writes,
   derived from `.planning/` rather than invented. Keep the two-segment form working.
2. ⚠ **Do not silently start passing.** The first run after the fix will surface real uncovered
   decisions on phases that "passed" before. That backlog is the finding, not a regression.
3. **Make `skipped` visually distinct from `passed` at the call site.** The orchestrator should be
   unable to print a tick for a gate that examined nothing — `total: 0` on a CONTEXT.md that is
   non-empty should be an ERROR, not a skip. **A gate cannot be allowed to report success for
   finding nothing to check.**
4. **Re-run it across shipped phases.** Every phase from the introduction of this gate onward has an
   unverified translation step. Report the count of phases whose CONTEXT.md had decisions the gate
   scored as zero.

## The same blindness probably exists in its sibling

`/gsd:verify-work` has a non-blocking counterpart of this gate (review finding **F15** deliberately
omits the `exit 1` there). It reads the same CONTEXT.md with, presumably, the same pattern —
**so both ends of the translation contract are likely blind, and neither has ever said so.** Check
it in the same change.

## Non-vacuity control for the fix itself

⚠ **Do not accept the fix on a green run.** Plant a decision id in a scratch CONTEXT.md that no plan
cites and require the gate to name it. This project's standing finding is that *a fence nobody has
seen fire is not a fence* — Phase 190 shipped five that could not fire, Phase 192.1 found three more,
and this seed is the ninth.
