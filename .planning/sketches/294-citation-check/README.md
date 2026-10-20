---
sketch: 294
name: citation-check
question: "Where does 'Check citations' live, and how does each cited sentence's verdict read without breaking the calm chat body?"
winner: "A — the marker carries the verdict (operator, 2026-10-20)"
tags: [phase-294, dec-03, citations, chat, message-item]
phase: 294
requirements: [DEC-03]
extends: [074-inline-citation-marker, 075-citation-clickthrough, 028-confidence-and-edit]
---

# Sketch 294: Citation Check

## Design Question
A settled cited answer can be checked on demand. Each cited sentence then carries a verdict (supported ·
partly supported · not supported · contradicted · couldn't check) and a confidence. Where does the verdict
sit, and where is the action?

## How to View
open .planning/sketches/294-citation-check/index.html

## Variants
- **A: The marker carries the verdict** — the existing superscript chip gains a glyph and the verdict's colour.
- **B: Sentence underline + end glyph** — the sentence is underlined in the verdict's style; a glyph follows the marker.
- **C: Margin gutter** — the text is untouched; glyphs sit in a column beside each paragraph.

The action ("Check citations · Jev", then a verdict summary + Re-check) is in the References footer header in
all three, so only the marks differ.

## State buttons
Not checked yet · Checking… · Checked · Engine = Cohere / local (hidden with reason) · Reranking off.

## Fixed in every variant
Glyph + word + raw confidence, never colour alone (028); a refusal is "couldn't check", never supported
(D-17); on demand (D-13); saved with the answer (D-15); Jev or OpenAI only (D-16); hover-peek → click-to-pin
(075); unmarked sentences stay plain (074 D3). The planted contradiction is sentence 4 (CC6.1 exception).

## What to Look For
- Does the contradicted sentence stand out enough without making the whole answer look broken?
- Can you tell which sentence a verdict belongs to when a paragraph has two claims on the same source?
- Does "couldn't check" read as honest absence rather than as a failure?
