---
sketch: 289
name: run-evidence-page
question: "How should a finished run's read-only evidence page read, for someone reviewing whether it can be trusted?"
winner: null
tags: [phase-289, vis-03, run-surface, receipt, export, evidence]
phase: 289
requirements: [VIS-03]
---

# Sketch 289: Run Evidence Page

## Design Question
A finished run needs one read-only page (plus export) with four things: the definition version it ran, the
phase log, each verdict, and the cited sources. Primary reader (operator call 2026-10-19): **someone reviewing
whether the run can be trusted**, not the author.

## How to View
open .planning/sketches/289-run-evidence-page/index.html

Toggles: viewer (owner / same-org colleague / another org) and definition (unchanged / edited since run).
Buttons: ⤓ Download JSON shows the export payload; ⎙ Print previews the PDF.

## Variants
- **A: The run page, settled** — the live page frozen read-only; evidence split across panel tabs.
- **B: A report you can print (lean)** — one column, four numbered sections; print is the page itself.
- **C: Step list + detail** — master/detail; good for one step, poor for "show me everything".

## What to Look For
- Can a reviewer answer "what ran, did the checks pass, on what evidence" without clicking?
- Edited-since-run: does the page make clear it shows v7, not the current v9?
- Colleague view: owner's display name only, no email, no write controls.
- Another org: one "isn't available" page, same words for "doesn't exist" and "not yours".
- Confidence placement here is a placeholder column; sketch 289-confidence-on-a-step decides it.
