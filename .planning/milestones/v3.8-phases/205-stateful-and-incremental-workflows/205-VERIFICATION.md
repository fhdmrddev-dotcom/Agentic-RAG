---
phase: 205-stateful-and-incremental-workflows
verified: 2026-08-26
status: passed_retroactively
retroactive: true
retroactive_reason: "No VERIFICATION.md existed. Written at milestone close from evidence RE-DERIVED at HEAD, never transcribed."
requirements: "STATE-01, STATE-02"
gaps_count: 3
---

# Phase 205 - Verification Report (RETROACTIVE)

> ## THIS REPORT IS RETROACTIVE, AND SAYS SO IN ITS OWN FRONTMATTER
>
> It was written on **2026-08-26**, at milestone close, because `/gsd:audit-milestone` found that
> **seven of v3.8's twelve phases had no `VERIFICATION.md` at all** - 201, 202, 203, 204, 205,
> 206 and 209. The phases shipped; the verification ARTEFACT was never written. This file closes
> the artefact gap and **must not be read as a contemporaneous verification**.
>
> **What that costs, stated plainly:** a verification written at execution time can catch a phase
> before anything is built on top of it. This one cannot - five later phases already stand on this
> work. What it can still do honestly is **re-derive the evidence at today's HEAD** rather than
> transcribe the phase's own SUMMARY, and that is what the scorecard below does. Every number in
> it was MEASURED on 2026-08-26, not copied.
>
> **`status: passed_retroactively` is deliberately NOT `passed`.** It records that the code
> satisfies its requirement on evidence re-derived today - never that the phase was verified when
> it shipped, which it was not.


**Phase Goal:** A run can read its own prior run's output - living registers and incremental deltas.

**Requirements:** STATE-01, STATE-02  
**Verified:** 2026-08-26 - **Status:** `passed_retroactively`

## Measured at HEAD on 2026-08-26

`pytest tests/unit/test_stateful_workflows.py` -> **9 passed**

## Evidence

- `205-01-SUMMARY.md` records `is_stateful` on `WorkflowDefinition` (additive, zero migration), the `get_latest_completed_workflow_run` resolver (slug-scoped, owner-scoped, **string-scalar safe**), and `{{prior_run.output}}` / `{{prior_run.id}}` / `{{prior_run.created_at}}` interpolation.
- The resolver being **string-scalar safe** is load-bearing rather than incidental: `workflow_definitions.definition` is stored as a double-encoded JSON string on 145 of 172 rows, and `workflow_phases.output` is a string scalar on **484 of 484** `completed` rows. A resolver that did not handle that would return nothing, silently.

## Gaps and honest limits

- **`REQUIREMENTS.md` still recorded STATE-01 and STATE-02 as `Planned`** - stale paperwork, corrected at this audit.
- **9 tests, and no recorded live run of a genuinely stateful workflow across two executions.** The headline promise - run 2 reads run 1's deliverable - is asserted with fixture data, never observed end to end.
- **SEED-203 is live on this surface**: the publish judge passed a golden run whose deliverable REFUSES the work, at score 100.

## Verdict

Requirement(s) **STATE-01, STATE-02** are satisfied by code whose evidence was re-derived on 2026-08-26.
The gaps above are recorded as **carried debt**, not blockers - none of them claims the shipped
behaviour is absent. **This is not a claim that the phase was verified when it shipped.**
