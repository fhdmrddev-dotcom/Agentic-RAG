---
sketch: 291
name: describe-files
question: "How does the describe door's one-file row grow to hold 1 template or form plus up to 5 references, each with its own reading?"
winner: B
tags: [phase-291, auth-02, describe-door, seed-155, real-door-dom]
---

# Sketch 291: Describe Door With Files

## Design Question
Phase 291 D-01..D-05, D-08, D-22: the describe door accepts **1 template or form + up to 5
reference documents**. The fields found are listed before the author drafts (D-04). A file with no
fields says so and is used as a reference (D-02). An unreadable scan says "Couldn't read this scan"
and stays attached (D-08). A long file says it was cut short. What shape holds all of that?

## Why this is a real acceptance bar (SEED-155's rule)
The whole page is the **real `door-describe` DOM** (`WorkflowDoorSwitch.tsx`, the loose door),
captured as `outerHTML` from the running app on 2026-10-22, styled by the app's own CSS (`app.css`,
read from the live page's `document.styleSheets`). Only the `describe-template-row` section is
swapped for each variant, and it reuses `DescribeTemplateRow.tsx`'s exact classes and its shipped
words (`DESCRIBE_ATTACH_PROMPT`, `ATTACH_NOTE`, `SPEC_FILENAME_LEAD`, `footingFields`,
`DESCRIBE_TEMPLATE_CLEAR_LABEL`). `data.js` is generated; re-capture it rather than hand-editing.

## How to View
Serve `.planning/sketches` (`python -m http.server 8765`), open
`http://127.0.0.1:8765/291-describe-files/index.html`, then press **↓ Jump to files**.
The top bar switches the form slot's state, adds a 3rd (cut-short) reference, dark mode and phone width.

## Variants
- **A: One row, extended.** Today's row, with "Anything it should read first?" as a sub-block inside
  the same box. Least new code: `DescribeTemplateRow` grows a second list.
- **B: Two questions.** Today's row unchanged (now accepting forms), then the page's own rule, then a
  new peer section for references. One question per section, as sketch 200 lays out the column.
- **C: One tray with roles.** One picker for everything. Each file is a row with a
  **Fill in / Reference** switch; only one may fill in. A field-less file falls back to Reference.

## States to toggle
- **PDF form**: 7 fields, types carried over (D-11). Added: *"Answers go into this form's own fields. Each run hands back … filled in."* (D-25).
- **Word with blanks · where each answer goes** (D-26..D-28, added 2026-10-22 after the operator put cases 1+2 in 291):
  - Each field is the document's own line with the blank marked, tagged **suggested**, with a tick.
  - Unticking leaves that blank empty, and the footer count drops.
  - One blank could not be placed and says so in words.
  - A line states that the original is not changed.
- No fields found (D-02) · still reading · nothing attached · 3rd reference cut short.

## What to Look For
1. With 1 form + 2 references, which one reads in 3 seconds (decision 12, "3-second read at rest")?
2. Does the scan line ("Couldn't read this scan…") read as a fact, not an alarm? No amber, no badge (D-17).
3. Is the "Files can shape the steps. Only your description and the services you tick can add
   actions." line right to show **before** drafting? It is a structural claim, not "this file is safe".
4. C's role switch: useful, or one more decision before the first draft?
5. Phone width: does the field list (name + type) still scan?
6. Word slot: can you tell **where each answer lands** in 3 seconds? Does unticking read as "this stays blank", not as "this question is deleted"? Does the "Couldn't place" line read as a fact?

## Copy is draft
New sentences here are sketch copy. The meaning is fixed by 291-CONTEXT; the words are refined at UI-SPEC.
