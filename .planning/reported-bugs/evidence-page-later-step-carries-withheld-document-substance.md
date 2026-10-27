---
id: BUG-261020-02
title: Evidence page shows a colleague a later step's output that restates a withheld document
reported: 2026-10-20
surface: Agentic-RAG
severity: major
status: closed
affected_areas: [backend/run-evidence, privacy]
folded_into: "296"
verified_closed_by: "296"
related_seeds: [SEED-364]
re_open_trigger: null
fixed_by_commit: "296-01: RED 8939b5522, GREEN 70fefa6f4 (D-05: once an upstream step is withheld, every later step is withheld for a non-owner, WITHHELD_UPSTREAM_SENTENCE)"
reproduces_on:
  branch: develop
  commit: 4b37c72aa
  date: 2026-10-20
---

# BUG-261020-02: Evidence page shows a colleague a later step's output that restates a withheld document

## What we observed

Phase 289 review fix CR-01 withholds `output_text` from a same-org non-owner on any step that **cited** a document masked for them. It was driven live on 2026-10-20 and passed: no private titles leaked, with 0 hits in the colleague's JSON and DOM.

A later step that cites nothing is not withheld, though. In run `a052667d-…`, step 2 restated the substance of the owner-private documents: project status and people's hiring and departures. That text showed in full on the colleague's evidence page. The same applies to the step after a withheld human answer.

## Why it matters

The masking promise ("a document you don't have access to") holds for titles but not for content. CLAUDE.md says users only see their own data, and the operator never ratified sharing derived content of owner-private documents.

## Where

`backend/app/services/run_evidence.py`: the CR-01 withholding is per citing step. It does not carry forward to steps that consume a withheld step's output (`_prior_output_text` chaining).

## Fix direction (not a decision)

Withhold for a non-owner every step downstream of a withheld step, or every step after the first masked citation. Alternatively, get explicit operator ratification of the residual as an accepted risk. Pin it with the two-step fixture from the live drive.

## Closed 2026-10-27 (296)

Verified closed by G-4 scenario 2 in `.planning/phases/296-close-v4-7-debt/296-HUMAN-UAT.md` (PASS with evidence under `evidence/g4/`). Status was `folded`.
