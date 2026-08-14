---
id: SEED-159
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

⚠ **NOT yet observed live.** The 2026-08-14 end-to-end run
(`26b5a898-c0ca-4fbb-ae35-ed488bbf2eb2`) filled **8 of 8** fields with no nulls, so the blank path
did not execute. The defect is read off the code and the docstring, not off a failing run. **First
action when this seed is picked up: force a null** (run against a KB folder lacking one field's
evidence) and capture what the produced document actually shows.

Related: [[SEED-157]], [[BUG-260814-01]] (the same run, a different defect).
