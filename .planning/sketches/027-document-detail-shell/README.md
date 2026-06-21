---
sketch: 027
name: document-detail-shell
question: "What form does the document-detail surface take — the shared shell that 112 (metadata), 117 (relationships), and 118 (classification) all inhabit?"
winner: A
tags: [document-management, detail-panel, shell, phase-112, metadata, confidence]
---

# Sketch 027: Document Detail Shell

## Design Question
Phase 112 establishes a **net-new document detail surface**. Today metadata is a read-only
inline expand-row in the documents table (`DocumentList.tsx → MetadataPanel`) — flat, no
confidence, no edit. 112 must SHOW each metadata field + its per-field confidence and let the
user CORRECT any value inline (persists to `documents.metadata` + writes a `metadata.update`
audit row). Critically, the G-2 spec says this is a **shared shell**: Relationships (Phase 117)
and Classification suggestions (Phase 118) will inhabit the *same* container later.

**So the question is the form of the shell — not the contents.** (The confidence chip + inline
edit interaction is sketched in depth in 028; here the inner content is held constant so the
comparison is purely about *form*.)

## How to View
```
open .planning/sketches/027-document-detail-shell/index.html
```
Click any document row to open its detail. Hover a field row → ✎ to edit (Enter saves,
Esc cancels). Toggle the Relationships / Classification / Versions sections to feel how the
shared shell grows.

## Variants
- **A: Right-side push/split panel ★ (recommended)** — list shrinks, panel slides in from the
  right (`minmax(0,1fr) 430px`). Stacked-accordion sections (your proven 004-B pattern) host
  Metadata + the 117/118 placeholders. Keeps the list visible for the scan→fix→next correction
  loop. Mobile → bottom-sheet (noted, not built).
- **B: Full-page detail view** — click a doc → its own full "profile" page (a `useState`
  view-switch, no router, per your IA contract). Most room; clearest hierarchy; metadata as a
  big card beside Relationships/Classification cards. Costs a navigation away from the list.
- **C: Centered modal (foil)** — overlay that dims the list. Fast in/out, but breaks
  "push, never overlay" and gets cramped once REL + CLASS pile in. Opens on the Risk Register
  (the doc with the most fields) so you can feel the squeeze. Built to show *why* overlay loses.

> Considered & set aside: **enriched expand-in-place** (level up today's inline row). Lowest
> friction but too tight inside a table row and awkward to grow into REL/CLASS. Can build it if
> you want to feel it.

## What to Look For
- **The correction loop.** Imagine fixing low-confidence fields across several docs in a row.
  Which form keeps you moving? (A keeps the list in view; B/C interrupt.)
- **Does the shared shell breathe?** Expand Relationships + Classification + Versions in each
  form. Where does it stay calm, where does it get cramped?
- **Confidence legibility** (preview of 028): chips carry **tier word + glyph + score**, never
  colour alone (WCAG). Low-confidence values render *tentative* (italic + dashed underline).
  Empty fields show "— not extracted" (honours `exclude_none` — not coerced to `""`). Editing a
  field flips its chip to **"✎ Edited · you"** (authoritative, no longer a model score).
- **Custom fields** (◆ violet dot) sit beside standard fields — the Phase 111 `metadata_field_definitions`.
