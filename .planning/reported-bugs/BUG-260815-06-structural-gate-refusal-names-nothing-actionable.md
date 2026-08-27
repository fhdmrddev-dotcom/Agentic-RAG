---
id: BUG-260815-06
title: The publish gauntlet's structural-gate refusal says only "the golden run failed a structural gate" — the precise reason is computed, stored verbatim in harness_audit, and never shown
reported: 2026-08-15
surface: Agentic-RAG
severity: major
status: open
affected_areas: [workflows/publish-gauntlet, frontend/workflows, observability, admin/control-room]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-165]
re_open_trigger: "⚠ FIRED A SECOND TIME AND DECLINED A SECOND TIME — at /gsd:discuss-phase 214 (2026-08-28). Phase 214 DOES touch the gauntlet's refusal copy (STEP-03 adds a new refusal naming the step and the missing argument), so this trigger fired exactly as written. It was declined on the same reasoning as 197 and recorded as D-214-13: 214's OWN refusal is written correctly from birth, so the phase adds nothing to this pile, and repairing the other five stages' copy is repair on files 214 does not otherwise touch — a capability inside a phase already carrying a threat model. `status` stays `open` and `folded_into` stays null ON PURPOSE, for the second time. ⚠ TWO DECLINES IS THE SIGNAL, NOT THE ABSENCE OF ONE: the next phase that fires this trigger should weigh that this bug has now been read, understood and passed over twice, and either fold it or state why it never will be. See .planning/phases/214-a-step-names-its-service-and-its-action/214-CONTEXT.md D-214-13. ── ORIGINAL TRIGGER, PRESERVED VERBATIM ── Considered at /gsd:discuss-phase 197 (2026-08-18) and DELIBERATELY NOT FOLDED — it shares SEED-163's root but is repair on the PUBLISH surface, while 197's SC#1 asks for the author to be ASKED, not better refused. Status stays `open` and `folded_into` stays null on purpose. Re-open at: the next phase touching the publish gauntlet's refusal copy, OR a second report of an author stuck on an unexplained refusal. See .planning/phases/197-guided-authoring/197-CONTEXT.md <deferred>."
reproduces_on:
  branch: develop
  commit: 2986541f
  date: 2026-08-15
---

# BUG-260815-06: the refusal names a stage, not a cause — while the cause sits one table away

## What we observed

Three publish attempts during Phase 193.2's operator UAT (`14:01`, `14:07`, `14:10`). Every one
returned the same five server fields, rendered verbatim by the client:

```
published        false
version          null
golden_run_id    <uuid>
blocked_stage    structural_gate
named_failures   ["the golden run failed a structural gate"]
```

**`named_failures` restates `blocked_stage` in a sentence.** It carries no information the operator
did not already have from the field beside it.

**Meanwhile `harness_audit` had already stored the real reason, verbatim, on every attempt:**

```
gate_failed  {"phase": "gather-usage", "attempt": 0,
              "error": "citations_required: nothing was retrieved (0 sources) —
                        this step reads your documents and must show where its answer came from"}
```

and `workflow_phases.output._failure_reason` carried the same string, naming the phase by slug and
the attempt count. **Nothing was missing. Nothing needed to be derived. It simply was not shown.**

## Why it matters — severity `major`

**The operator hit this three times in one sitting and could not diagnose any of them.** Their own
words: *"if I do not have you how I would like to know what is the issue."* Diagnosis required an
assistant querying `workflow_phases`, `harness_audit`, `workflow_definitions`, `documents`,
`document_chunks` and finally calling the embeddings API directly. **The product's own surfaces
offer no route to the cause.**

⚠ **The refusal is honest but useless, and those are different properties.** The gauntlet's
honesty rules were built to stop it *overclaiming* — `192`'s CR-01 fixed a user-facing lie, and this
message never lies. But an accurate sentence that names only the stage it already displayed does not
let the author act. **Honesty was achieved; legibility was not.** The distinction is worth keeping
because a future fix must not trade one for the other.

⚠ **Phase 193.2 fixed the sibling of this exact defect and this path was out of scope.** `193.2-06`
rewrote the *interactive-phase* refusal into two assertive arms naming the offending step **by the
label the author can read on the canvas**, explicitly so the author would not meet a slug, a step
number, or a bare code. The *structural-gate* refusal never received that treatment. The two paths
now differ sharply in how much they tell you, for no principled reason.

⚠ **`view coming soon` is the other half.** The surface offers *"▦ Golden run that was judged ·
d8f87920… (view coming soon)"*. The one affordance that would have closed the gap — open the run and
read its failed phase — is unbuilt, and the id is displayed as an un-actionable fragment.

## Hypothesized cause

`named_failures` is populated from the publish path's own stage vocabulary rather than from the
failed run's phase records. The publish service knows *which stage refused*; the run knows *why*.
Nothing joins them, so the wire carries the coarser of the two facts.

## What a fix must do

1. **Name the failing phase and its reason**, sourced from `workflow_phases` /
   `harness_audit` for the `golden_run_id` the response already carries. The join key is present in
   the response today.
2. **Use the canvas label, not the slug** — the rule `193.2-06` already established for the
   interactive-phase arm (*the author meets the words on their canvas, never `gather-usage`*).
3. **Keep the honesty property.** The message must not imply the gate is exhaustive or promise a
   future capability — `193.2-06`'s constraints apply unchanged. ⚠ A helper docblock there already
   records that the gate is **not exhaustive** over "steps that involve a person"; a richer message
   must not accidentally start claiming otherwise.
4. **Build the run view, or stop advertising it.** *"(view coming soon)"* beside an id the operator
   cannot use is worse than no affordance — it names the missing capability without providing it.
   Either ship the link to the golden run's phase timeline or remove the tease.
5. ⚠ **Distinguish "the run failed" from "the judge refused".** `blocked_stage: structural_gate`
   covers a run that never reached the judge at all. An author reading *"fix the deliverable and
   re-publish"* — the current copy — reasonably concludes their *output* was judged and found
   wanting, when in fact **phase 1 of 5 never produced anything**. That copy is actively
   misdirecting on this path.

## Related

- `BUG-260815-05` — the outage this refusal was hiding; the two together are one diagnosis gap
- Phase `193.2-06` — the interactive-phase refusal that WAS fixed, and the constraints any fix here
  inherits
- `SEED-165` — the observability family
- Phase 192 CR-01 — the precedent that the gauntlet must not overclaim (still binding)
