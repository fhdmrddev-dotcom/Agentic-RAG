---
sketch: 075
name: citation-clickthrough
question: "When you click an inline marker, what surfaces the source passage — and what does today's bottom 'N sources' list become once markers exist?"
winner: "A"
tags: [phase-153, cite-01, inline-citations, click-through, references-footer, hover-popover, workspace-panel, citationlist, g5-hot-file]
---

# Sketch 075: Citation Click-through

## Design Question

Sketch 074 settled the marker **form** (superscript chip) and its **absence** semantics. This sketch settles the other half of CITE-01: **click-through** — what surfaces when a reader uses a marker — and confirms the operator's chosen restructure of the existing sources list into a **numbered `[n]` References footer keyed 1:1 to the markers**.

The footer restructure is fixed (present in all three variants). The variant axis is the **primary click target**.

## How to View

open .planning/sketches/075-citation-clickthrough/index.html

Switch A/B/C to feel each click target on the **same** superscript marker. Clicking a footer row mirrors the interaction (the seam feels bidirectional).

## Variants

- **A: Hover-peek → click-to-pin** — hovering a marker peeks the passage in a small popover (filename · chunk · similarity · snippet + "Open document"); clicking **pins** it (📌) so it persists. Peek-without-leaving-your-place. The Perplexity / Claude.ai-cited feel.
- **B: Scroll + flash the References footer** — clicking a marker smooth-scrolls to the matching numbered footer row and blooms it. **One canonical home** for every passage; no floating chrome. Simpler, but you leave your reading spot.
- **C: Open in the workspace panel** — clicking a marker slides the source into the app's existing **right-side push/split panel** (chat shrinks; reuses the 004-B shell), with `[1][2][3]` source tabs to compare and "Open full document." Best for deep source inspection; the heaviest (panel-open reshapes the layout), arguably overkill for a quick peek.

## What to Look For

- **Reading-flow cost** — A keeps you in place; B and C move you (footer / panel). For a chat answer, which respects the reading flow best?
- **The numbered footer** — does `[1] board_minutes_q3.md · Chunk 4 · 0.63` keyed to the inline `¹` read as one coherent "works cited"? (This is the operator's chosen restructure of today's unnumbered `CitationList`.)
- **Peek vs. commit** — A's peek is low-commitment; C's panel is high-commitment. Does the answer's density (usually 1–4 sources) justify a whole panel, or is a popover enough with the footer as the durable home?
- **Bidirectionality** — clicking a footer row also highlights its marker. Does that two-way link make the set-membership feel tangible?

## Build Handover (reuse vs net-new)

| Piece | Status | Real file / mechanism |
|---|---|---|
| Passages, filename, chunk index, similarity | **REAL / wired** | `citations` SSE + `source_refs`; `Citation` type |
| The footer itself | **REAL, restructured** | `CitationList.tsx` / `CitationCard.tsx` — **net-new:** `[n]` numbering + marker↔row link + open-by-default when markers exist |
| Superscript marker | from **Sketch 074** | net-new render into `MarkdownRenderer` (G-5 hot file `MessageItem.tsx`) |
| "Open document" deep-link | **REAL** | existing document-detail route |
| **A** hover-popover | **NET-NEW** | positioned peek card; pin-on-click state |
| **B** scroll+flash | **NET-NEW (cheap)** | `scrollIntoView` + a flash class on the numbered row |
| **C** workspace panel | **shell REAL, content net-new** | reuses the shipped push/split panel (004-B / document-detail shell); net-new: source-tabs + passage view driven by the citation set |
| Marker→citation binding | **set-membership-safe** | marker `n` = `citations[n]` (074) — click just indexes the real set; **no re-ask**, read-only, mutation-free |

**Cross-provider (SC#10):** the click-through is a pure render/interaction layer over the provider-uniform `citations` set — identical across all providers. **G-5:** the marker injection touches `MessageItem.tsx` (hot file) — re-run the replay/render tests; do not regress the shared render path. **A11y (feeds Phase 155):** markers + footer rows must be keyboard-reachable (`role`/focus), the popover needs focus management, panel open/close announced.
