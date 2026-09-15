---
seed_id: SEED-159
title: A field with no evidence renders as an EMPTY CELL — "nothing happened" and "we never looked" are indistinguishable
status: open
planted: 2026-08-14
planted_by: Quick task 260814-q5r — operator question during the end-to-end UAT
surface: Agentic-RAG
severity: medium
affected_areas: [templates, template_render_service, workflow-runs, honesty, run-surface]
requirements: [AUTH-03, RUN-02]
re_open_trigger: >
  A run producing a deliverable with any null leaf (check `null_leaf_count > 0` on the emit
  phase output), OR any phase touching `build_context` / `_cell` / the emit render path, OR the
  first customer-facing deliverable produced by this product. Whichever comes first.
trigger_when: unset
---

# An unfound field renders as a blank, and the blank lies

## The operator's question (2026-08-14)

> *"And if it did not find [it] maybe it should say that Nothing to report or whatever."*

Correct instinct. Measured, the system does the opposite of this — and it already knows better.

## Measured

- `build_context` (`template_render_service.py:571-610`) documents it plainly:
  **"None leaves are blanked to `''` for clean cells."** `_cell()` turns a null value into an
  empty string, and `_build_row` does the same per collection cell.
- Meanwhile `check_coverage` (`:416-460`) **computes exactly the information being thrown away**:
  `null_rate`, `null_leaf_count`, `covered_keys`, `covers_template`, `uncited_value_count`,
  `citation_coverage_pct`.

So the honesty signal is calculated, recorded on the phase output — and then discarded at the last
step, where the document gets a blank cell.

## Why it matters

In a weekly status report, an empty **Risks** section means one of three completely different
things and the reader cannot tell which:

1. there genuinely were no risks this period *(good news)*
2. the knowledge base had nothing to say *(the KB is stale — act on it)*
3. retrieval failed or the model omitted the field *(a defect — nobody will notice)*

A human author writes *"No new risks this period."* A blank cell is read as (1) by default, which
means (2) and (3) are silently laundered into good news. **This is the identical defect class the
`260814-q5r` quick task fixed one layer up** — where "we could not read this template" rendered as
"this template has no fields". Same lie, different layer.

## The shape (proposal, not a decision)

The render context already knows which leaves are null. Options, cheapest first:

1. **A per-field fallback string** the author sets at authoring time (*"No new risks this
   period."* / *"Not reported."*), defaulting to something explicitly non-committal.
2. **A run-surface honesty line** beside the produced file: *"3 of 8 fields had no supporting
   evidence"* — reuses `null_leaf_count`, which already exists, and changes no bytes in the
   document.
3. **Both.** (1) makes the document honest; (2) makes the *run* honest. They answer different
   questions and neither substitutes for the other.

⚠ **Do not fix this by writing "Nothing to report" into the cell unconditionally** — that asserts
fact (1) when the truth may be (2) or (3), which is the same failure wearing a friendlier word. The
distinction the system must preserve is *"we looked and found nothing"* vs *"we could not look"*,
exactly as `resolve_template_placeholders` now does with its `read: "ok" | "unreadable"` three-state
(`grounding.py:245-330`) — that function is the shape to copy.

## Status of evidence

⚠ ~~**NOT yet observed live.** The 2026-08-14 end-to-end run
(`26b5a898-c0ca-4fbb-ae35-ed488bbf2eb2`) filled **8 of 8** fields with no nulls, so the blank path
did not execute. The defect is read off the code and the docstring, not off a failing run. **First
action when this seed is picked up: force a null** (run against a KB folder lacking one field's
evidence) and capture what the produced document actually shows.~~

## ⚠ TRIGGER FIRED — observed live 2026-08-15, and the seed's PREDICTION WAS WRONG

**The trigger that fired is this seed's own third clause — *"the first customer-facing deliverable
produced by this product."*** Phase 193.2's operator UAT, run `b021c7b0`, produced
`/Northwind-QBR-Template.docx` (39,698 B) from the 10-field Northwind QBR template. Verified against
a screenshot of the rendered document, not just the field map.

**What was predicted:** a null leaf blanked to `''` by `_cell()`, producing an empty cell that reads
as "nothing to report".

**What actually shipped, and it is worse:** the field was never null. The model **supplied a string**
— so `build_context` / `_cell()`'s None-blanking path *never executed at all* — and the string it
supplied was:

> `account_owner` = *"**Not explicitly stated in the KB.** Commercial & renewal ownership: Priya
> Raghunathan; technical delivery: Tomas Lindqvist; support: Aoife Brennan."*

That rendered **in the navy header block, second line, on the front page**, in a document whose own
footer band reads *"Commercial in confidence · Prepared for Northwind Logistics."* **A client-facing
QBR announces in its header that something was not found in an internal knowledge base.**

**Three corrections to this seed, all stated beside the original rather than over it:**

1. **The mechanism is not the render path.** `_cell()` is innocent here; the disclaimer arrives from
   the *model*, upstream, as a legitimate field value. A fix confined to `build_context` / `_cell`
   would not have caught this at all. **The seed's named first action — "force a null" — would have
   measured the wrong path.**
2. **The failure mode inverted.** The seed feared a *silent* blank; what shipped is a *verbose*
   internal disclaimer. Both are wrong for the same underlying reason, but they need different
   fixes, and only one of them is in the render layer.
3. **The model's behaviour was CORRECT and should not be "fixed" at the prompt.** Declining to
   invent an account owner is exactly right, and it volunteered genuinely useful adjacent evidence
   (three real named owners) immediately after. **The defect is that a deliverable surface has no
   register distinct from an internal answer.** Suppressing the honesty would be the wrong repair.

**The open question this sharpens:** *what should "no evidence for this field" look like in an
artefact the customer reads?* Candidates, none chosen here — omit the label entirely; render an
em-dash or "—"; render a neutral "Not recorded"; or surface the gap to the AUTHOR at run time and
keep it out of the document. ⚠ The last is the only one that preserves the honesty signal without
printing it to the customer, and it connects this seed to `BUG-260815-05`/`-06`'s theme (the system
knows things it does not tell the author) rather than to the render layer.

**Evidence:** run `b021c7b0` (definition `93a86e21`), emit phase `field_map.scalars.account_owner`,
`output_file.residual_clean: True`, 10 of 10 fields filled, 0 residual `{{ }}`, 0 literal `None`.
Branding intact (Georgia, navy, amber, teal, shaded blocks). **This deliverable is otherwise a
pass** — the finding is one line in an otherwise correct document, which is precisely why it would
have shipped unnoticed.

Related: [[SEED-157]], [[SEED-162]] (the same run — a produced report citing a PRIOR report).

Note: an earlier draft of this seed pointed at `BUG-260814-01` as "the same run, a different
defect". That report was **refuted** the same day — the analysis had used the wrong
`definition_id`, selecting a workflow by display name when two rows share it. [[SEED-162]] is what
survived the refutation.
