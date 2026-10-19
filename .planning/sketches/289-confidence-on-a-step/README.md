---
sketch: 289
name: confidence-on-a-step
question: "Where does knowledge-base confidence sit on a phase step, and what does a step without KB use show?"
winner: null
tags: [phase-289, trust-01, confidence, run-surface, receipt]
phase: 289
requirements: [TRUST-01]
extends: [028-confidence-and-edit, 022-workflow-run-in-thread]
---

# Sketch 289: Confidence on a Step

## Design Question
Each KB-derived step carries chat's retrieval confidence. Where does it go on the evidence page row and the
live spine card, and how do "weak match" and "searched, found nothing" read?

## How to View
open .planning/sketches/289-confidence-on-a-step/index.html

## Variants
- **A: Chip on the title line** — loudest; competes with the status pill.
- **B: Evidence line under the step (lean)** — "Answered from Procurement KB · 6 passages · ● Medium · 0.47".
- **C: Chip on the sources row** — ties to documents; crowds with many sources.

## Fixed in every variant
Glyph + word + raw score (028 rule), chat's retrieval buckets 0.54 / 0.38, chat's low-confidence disclaimer,
nothing at all on a non-KB step, words for "searched, found nothing".
