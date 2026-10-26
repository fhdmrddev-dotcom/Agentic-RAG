---
id: BUG-261020-01
title: A person's answer to a human-input step never reaches the next step
reported: 2026-10-20
surface: Agentic-RAG
severity: major
status: closed
affected_areas: [backend/harness, workflows/human-input]
folded_into: "295"
verified_closed_by: "295"
related_seeds: [SEED-360]
re_open_trigger: null
fixed_by_commit: "b23554309 (fix(295-04): the answer reaches the next step, D-10/D-11/D-46); live 295 S6 PASS (295-VERIFICATION RUN-04); closed by the 296-05 record flip"
reproduces_on:
  branch: develop
  commit: 4b37c72aa
  date: 2026-10-20
---

# BUG-261020-01: A person's answer to a human-input step never reaches the next step

## What we observed

Found during the Phase 289 live re-drive (2026-10-20, `289-VALIDATION.md` "Post-review live re-drive").

- Run A was a planted pause workflow with the steps KB, then approval (human input), then wrap. The person answered "Yes", and the last step then wrote: "I can't confirm the note was approved because no approval decision was provided."
- Run E had the same shape and its wrap said "Approved". That answer came from the model guessing, not from the stored answer.
- So Phase 289 plan 05's S5 wording ("the run completed and acted on the answer") proved completion only, never that the answer was used.

## Why it matters

A workflow that pauses to ask a person "approve?" and then ignores the reply is wrong in the way that matters most. The run looks correct (`completed`), while the decision it was waiting for had no effect.

## Where (from the live drive; not yet driven by a test)

- `backend/app/services/harness/phase_types.py:173`: `_prior_output_text` hands the next step only each prior step's `text`.
- `backend/app/services/harness/human_input.py:142`, `:188`, `:327`: `llm_human_input` returns `text = <the question>` on all three paths. The answer sits in a separate field that `_prior_output_text` never reads.
- Inherited: `_prior_output_text` dates from Phase 091-03 / 092-07 (2026-05-31). Phase 289 did not change it.

## Fix direction (not a decision)

Carry the answer into what the next step sees. Either the human step's `text` includes the answer once it is answered, or `_prior_output_text` reads the answer field. Pin it with a test where the wrap step's input contains the stored answer.

## Phase 295 record (295-07, 2026-10-21)

Addressed by 295-04 (D-10/D-11/D-46: `handoff_text` hands over the question and the answer; human outputs are skipped as the latest produced text). Live in `.planning/phases/295-runs-that-don-t-dead-end/295-VALIDATION.md` S6: the wrap step quoted `"Yes"`; S2's wrap restated the answer and the unsourced note. Not closed (verifier's call).
