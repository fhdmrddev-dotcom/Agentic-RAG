---
id: BUG-260815-08
title: Workflows page header — Build Workflow button is uncoloured, the project dropdown wraps below instead of aligning, and the search box does not read as a search box
reported: 2026-08-15
surface: Agentic-RAG
severity: minor
status: open
affected_areas: [frontend/workflows, workflows/library, design-system]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-155, SEED-166]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: d3a74202
  date: 2026-08-15
---

# BUG-260815-08: the Workflows page header is visually unfinished

## What we observed

Operator, during Phase 193.2's UAT, on the Workflows library page:

> *"the header of this page — like the Build Workflow button is not coloured, not all the items
> aligned perfectly, for example the project dropdown list to the right is below the other. And the
> search bar showing a search icon or deceiving the user that it is just a placeholder for text, not
> a search box."*

Three distinct issues:

1. **`Build Workflow` button is uncoloured** — the page's primary action does not read as primary.
2. **Header items do not align** — the project dropdown on the right sits *below* the adjacent
   control instead of on the same line (a wrap, not a designed stack).
3. **The search field does not read as a search field** — it presents as a text placeholder rather
   than an affordance you can type into. ⚠ The operator's phrasing — *"deceiving the user"* — is the
   substantive part: this is a legibility complaint, not a taste one.

## Why it matters

Severity `minor` — nothing is broken and every control works. But this is the **landing surface for
the entire workflow product**, and the primary call-to-action not looking like a button is the kind
of thing that reads as unfinished to anyone seeing the product for the first time.

## ⚠ This must NOT be fixed ad hoc — G-2 fires

`CLAUDE.md` guardrail **G-2**: any scope mentioning live UI, panel render, badge, label, alignment
or "feels like" gets `/gsd:sketch` **before** `spec-phase`/`discuss-phase`, and an operator-approved
mockup is the acceptance bar.

⚠ **And this is not the only complaint on this surface.** The operator has separately and repeatedly
raised **card density** — *"the cards have a lot of information"* — which is already carried by
`SEED-155`. Phase 192.1's UAT recorded **U8 as FAILED** with 3 of its 4 complaints tracing to Phase
124/192 code. **These are one design problem on one page and should be sketched together, not
patched one control at a time.**

⚠ **`SEED-155` binds any sketch:** if a mockup depicts a surface that consumes an existing
component, it must RENDER that component, not redraw it. A sketch that hand-writes its own CSS is a
drawing, not an acceptance bar.

## Hot-file warning for whoever picks this up

`frontend/src/pages/WorkflowsPage.tsx` is on the `CLAUDE.md` hot-file ledger at **34 commits / 12
phases / 1176 L**, and `library/WorkflowCard.tsx` at **8 / 3 / 818** — **G-5 already FIRES on the
card**, so the next phase naming it owes a refactor recommendation as its FIRST option, before the
feature. The library view was extracted into `components/workflows/library/` by Phase 192, so the
header and toolbar live in `LibraryToolbar.tsx` rather than the page.

## Related

- `SEED-155` — card density; the same page, the same operator, already open
- `SEED-166` — the settings/menu information-architecture seed planted the same day
- Phase 192 / 192.1 — the library extraction and its UAT row U8 (FAILED)
