---
sketch: 029
name: filter-builder-bar
question: "What does the inline no-DSL condition builder occupy on the Documents page — ANDed field→op→value rows, the live 'N match' count, and the 'Save as view' moment — without breaking push/split?"
winner: "A"
tags: [phase-114, document-management, virtual-folders, filter-builder, live-count, save-as-view, no-dsl]
---

# Sketch 029: Filter Builder Bar

## Design Question

Phase 114 D-114-1/2/3: the builder is an **inline condition surface on the Documents page** (not a modal, not a separate page). The user composes rows (`field → type-aware operator → value`, all ANDed), the list filters **live with a debounced "N documents match" count**, and **"Save as view"** persists the current filter as a named view in the sidebar. Selecting a saved view loads its filter back into the same bar. *Ad-hoc filtering and saved views are the same mental model* — ad-hoc filtering is a free byproduct.

What **form** does that bar take so it reads in 3 seconds at rest, holds date/range controls, and never collides with the right-side detail panel (027/#20 "push, never overlay")?

## How to View

open .planning/sketches/029-filter-builder-bar/index.html

All three variants share **one** condition model and a real 36-doc synthetic corpus, so the live count is genuinely computed (and case-INSENSITIVE per D-114-10 — the corpus deliberately mixes "Invoice"/"invoice" and the count still resolves). Add/edit/remove conditions; watch the count; the count turns **amber at zero**. Click **Save as view** → name it → it pops into the sidebar **Views** group.

## Variants

- **A — Chip bar (one strip)** ★ recommended starting point — a slim `Where [chip] [chip] ＋condition … N match | Save as view` strip above the list. Densest; the "3-second read at rest"; conditions edit in a popover. Path of least resistance (Linear/Notion filter-bar idiom).
- **B — Stacked rows panel** — a `⛛ Filter` toggle reveals a panel of full rows (`field | operator | value | ✕`) with a footer count + Save/Clear. Most room for date/range/relative controls inline; costs vertical space; collapses away when unused.
- **C — Sentence grammar (sticky)** — reads as a sentence: *"Documents where [type is invoice] and [date within next 90 days] ＋add"*, sticky on scroll, count + Save in the tail. Most legible for non-technical users; can get long with many conditions.

## What to Look For

- **At rest (no/one filter):** which reads calmest and most obviously *optional*?
- **Adding a date/relative condition:** B shows the control inline; A/C use a popover. Which feels right for "within next N days"? (030 explores that control in depth.)
- **The live count:** placement (right of bar vs in the crumb vs panel footer) and the **zero-state amber** honesty.
- **Save-as-view seam:** does it read as "persist what I'm already looking at" rather than a separate authoring act? Watch the saved view land in the sidebar.
- **Coexistence:** imagine the 430px detail panel open on the right (see 032) — which bar survives the width crunch?
