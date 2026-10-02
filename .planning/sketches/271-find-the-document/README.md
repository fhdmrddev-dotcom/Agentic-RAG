---
sketch: 271
name: find-the-document
question: "How do the Find | Ask mode switch, the structure filters (folder path, relationship, version state) and the Filing rules home compose inside the Library without a sixth tab or a rail entry?"
winner: null
tags: [phase-271, document-search, find-vs-ask, filter-builder, relationships, version-state, filing-rules, g2-sketch-gate]
---

# Sketch 271: Find the Document

G-2 sketch for Phase 271 (FIND-01, FIND-02, FIND-03, FIND-06). Decisions already locked in `271-CONTEXT.md`
(D-01..D-09): mode switch on the Documents tab, labelled field sort, verb + document picker, 3 version
states with "Latest versions" default, "Filing rules" as a Library header link, rail entry removed.
Built on 029 (chip strip), 035 (typeahead), 037 (rules surface), 270 (detail panel).

## How to View

open .planning/sketches/271-find-the-document/index.html

Top bar: **Screen** (1 Find|Ask, 2 Structure filters, 3 Filing rules home) × **Variant** (A / B).
An 18-document corpus with relationships and version rows drives every count, so filters really filter.

## Variants

| Screen | A | B |
|---|---|---|
| 1 Find \| Ask | segmented control beside the search bar | mode pill inside the search bar |
| 2 Structure filters | chip strip + popovers (029-A idiom) | stacked rows panel |
| 3 Filing rules home | "Filing rules ›" link in the Library header | "⋯" overflow menu entry |

## What to Look For

- **Screen 1:** does Ask feel like leaving the list (no passages, hands off to chat)? Is "Sorted by" + "No AI ranking" calm or noisy?
- **Screen 2:** relationship phrase reads as `<result> <verb> <picked doc>`. Try "Is superseded by" → Acme MSA 2019: the hit is an OLDER version row, so the default "Latest versions" hides it. The sketch shows "1 more match in older versions · Show them". **Open question for the operator: keep this hint, or auto-widen the version filter when a relationship is set?**
- **Screen 2:** open the detail panel; Folder and Version columns shed (SHED_COLUMNS_3_TO_5 contract). Does each filter form survive 340px less width?
- **Screen 3:** findable with no rail entry? Back path returns to Documents.
