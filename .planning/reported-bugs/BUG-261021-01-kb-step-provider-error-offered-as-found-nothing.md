---
id: BUG-261021-01
title: A knowledge-base step whose model call fails is offered as "found nothing", and Continue keeps the raw error as the step's output
reported: 2026-10-21
surface: Agentic-RAG
severity: major
status: open
affected_areas: [backend/harness, workflow/runs, RAG/grounding]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-366]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 796c86919
  date: 2026-10-21
---

# BUG-261021-01: a KB step's provider error is offered as "found nothing"

## What we observed

Plan 295-07 drove the cross-provider roster. On the Anthropic row, the account's credit had run out, so the KB step's model call failed.

- The step's stored text is the raw provider error, "credit balance is too low".
- `retrieval_error` is null.
- The run paused with the found-nothing choices (search another folder / continue without sources / stop).
- Choosing Continue kept the error text as the step's unsourced output and passed it to the next step.

Source: `.planning/phases/295-runs-that-don-t-dead-end/295-07-SUMMARY.md` (finding 2) and `295-VALIDATION.md` (the Anthropic roster row).

## Why it matters

The person is asked a question about sources when the real problem is that the model could not be reached. Searching another folder will fail the same way. If they continue, the next step treats an error message as content, and the run can finish with that error in its output.

## Hypothesized cause

Hypothesis, not verified: the found-nothing pause added in 295-03 fires on "0 sources / 0 markers" and does not first check whether the step's model call failed. The provider failure is caught somewhere that returns the error text as the step's output instead of failing the step.

## Surface classification

Agentic-RAG. The provider error is external, but offering it as found-nothing is this app's logic.

## Suggested routing

- **Fold into in-flight phase:** n/a (295 is closing; this was found by its live proof)
- **Defer to future phase / milestone:** the next phase touching `engine_ask.py` or the citations gate
- **Plant as seed:** no
- **External — note only:** no

## Workarounds (prompt-side, code-side, or UI-side)

Choose "Stop the run" when the step output is an error message, then fix the provider key or billing and run again.
