---
sketch: 032
name: documents-page-full-composition
question: "Does the 4-column Documents page hold when sidebar (Folders + Views) + filter bar + filtered list + an open Phase-112 detail panel are all present — and how is the width crunch (D-1) resolved at desktop and mobile?"
winner: "A"
tags: [phase-114, document-management, consistency, layout, push-split, detail-panel, mobile, d-1]
---

# Sketch 032: Documents Page Full Composition (consistency)

## Design Question

A consistency check, not a new surface. The Documents page has never been seen with **all the pieces at once**: the sidebar (Folders **+** the new 031 Views group), the 029 filter bar, the filtered list, **and** an open Phase-112 detail panel (027/#20) pushing from the right. At a real width, `230px sidebar + list + 430px panel` is tight. Phase 112 left this as open note **D-1** (panel width on the 4-column page → collapse the folder tree when the panel opens). What resolves the crunch while honoring **"push, never overlay"**?

## How to View

open .planning/sketches/032-documents-page-full-composition/index.html

A document opens by default so the composition reads immediately. Click rows to open/close the panel (✕ closes). Toggle **📱 Mobile: off→on** (top-right) to see the responsive collapse. The list **drops its Date/Author columns** as it narrows (each variant shows the push behavior).

## Variants

- **A — Sidebar collapses to an icon rail when the panel opens** ★ recommended (the D-1 answer) — selecting a document shrinks the `230px` sidebar to a `50px` rail (folder/view icons only, `»` to re-expand) so the list keeps real width beside the 430px panel. Restores on close. The list keeps the most useful columns; nothing overlays.
- **B — Keep the sidebar, collapse the filter bar to a summary chip** — sidebar stays; when the panel opens the filter bar folds to `⛛ 2 filters · 3 ▾` to reclaim vertical+horizontal room and the list compresses. Filtering context stays one tap away; the sidebar stays fully legible.
- **C — Overlay drawer (foil, rejected)** — the panel slides in over the list with a scrim. Shown explicitly to make the rejection legible: it violates the locked "push, never overlay" rule (#20), loses list context, and re-introduces the modal pattern 027 deliberately ruled out.

## What to Look For

- **Does anything important get crushed** with the panel open? Compare A (rail) vs B (full sidebar, compressed list).
- **D-1 resolution:** is auto-collapsing the folder tree (A) the right reflex, or too magical? Should it be user-pinnable?
- **Mobile:** sidebar → drawer, detail → **bottom-sheet**, filter → summary. Does the bottom-sheet match the workspace-panel mobile pattern (004-B)?
- **Column shedding:** dropping Date/Author as the list narrows — acceptable, or should the list switch to a denser single-line card?
- **The honesty of C as a foil** — it should feel *worse*, confirming push/split is right even under pressure.

## Audit-driven notes (2026-06-19, workflow `wf_dc339594-8bb`)

- **D-1 resolution:** recommend **A (collapse sidebar → icon rail when the panel opens) as the default, but user-pinnable** and persisted for the session — auto-collapse on first panel-open, respect a manual re-expand (mirrors the workspace-panel collapse-to-rail precedent, decision #4). Pure auto-collapse risks fighting the scan→fix→next loop.
- **Shared-shell inheritance:** whatever 114 picks here becomes the default for **Phases 117 (relationships) and 118 (classification)**, which open the *same* Phase-112 panel. The choice must degrade gracefully for non-metadata panel content — record it as a shared-shell decision in 114's CONTEXT/PLAN, not an implicit 114-only call.
- **`DocumentList` is a static 7-column table** with no responsive column logic today — the column-shedding shown here is **net-new responsive work**, not reuse. Flag for plan-phase.
- Copy fixes applied: phase-number badges → "Coming soon"; placeholders plain; ConfidenceChip → locked order (`✓ High · 96%`); dropped "chunks" from the title sub-line; corrected the foil citation.
