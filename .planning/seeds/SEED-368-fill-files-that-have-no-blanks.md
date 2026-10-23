---
seed_id: SEED-368
title: Fill documents that have no blanks to fill (a finished example, a scan, slides and sheets)
created: 2026-10-22
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: "Phase 291 verifies (D-25/D-26 shipped), OR an operator brings a real case of 'use last time's document as the template' or a scanned form that must come back filled"
trigger_paths: ["backend/app/services/template_render_service.py", "backend/app/services/tools/render_template.py", "frontend/src/components/workflows/DescribeTemplateRow.tsx"]
trigger_surfaces: []
migration_note:
relates_to: ["291", "SEED-051", "SEED-157", ".planning/phases/291-describe-it-from-your-own-files/291-CONTEXT.md"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-368: Fill documents that have no blanks to fill

## The finding

The fill engine writes only into `{{name}}` tokens (`template_render_service.py:665` docxtpl, `:757` run-replace), and its output is limited to docx, pptx and xlsx (`tools/render_template.py:372`). On 2026-10-22 the operator brought two cases into Phase 291 (291-CONTEXT D-25..D-29):

- a fillable PDF filled through its own fields;
- a Word document's blanks turned into a fillable copy while authoring.

Four real business cases are still not served:

1. **A finished example: "use last time's one".** Last quarter's report or the contract sent to Acme has real values and no blanks. Today 291's D-02 calls it "reference only". The case: the AI spots the values that change ("Acme Corp", "€42,000", "1 March"), suggests a field for each, and the author ticks yes or no on each. Then the same server-inserts-the-tag path as 291 D-26 applies.
2. **A scanned or flat PDF that must come back filled**, such as a printed government or bank form. A scan has nowhere to write into. The options are an answer sheet, honestly labelled, or placing text at fixed positions on the page (this breaks easily, because positions drift between form versions).
3. **Blanks in PowerPoint or Excel**, for example an empty cell next to a label in a budget sheet. The same anchor-and-insert rule as D-26 applies, with each format's own spots.
4. **No document at all.** A step already writes a document freely. A "house style" template generated from the description would be new.

## Why it matters

Case 1 is the most common way people actually reuse a document ("send me the one we did last time"). Until it ships, the describe door handles it as reference only, and the author has to make a template by hand, which is the friction AUTH-02 exists to remove.

## When to surface

When Phase 291 verifies, or at the next `/gsd:new-milestone` sweep. Case 1 rides 291's D-26 path directly, so sequence it first.

## Scope estimate

- Case 1: Medium. It reuses 291's insert-and-confirm path, plus value detection and a confirmation list.
- Case 3: Small to Medium per format.
- Case 2: Medium to Large if text is placed on the page; Small for an answer sheet only.
- Case 4: Large. It is a separate capability.

## Rule that carries over (291 D-26)

The AI decides **where** an answer goes once, while authoring, with the author watching. Runs fill deterministically, and the AI never writes the file's bytes.
