---
sketch: 074
name: inline-citation-marker
question: "Does a per-claim inline marker read cleanly in a streamed answer AND make absence-as-signal legible, without adding chrome-noise to the calm-instrument body?"
winner: "A"
tags: [phase-153, cite-01, inline-citations, marker, absence-as-signal, streaming, set-membership, messageitem, g5-hot-file]
---

# Sketch 074: Inline Citation Marker

## Design Question

Phase 153 (CITE-01) adds **per-claim inline citation markers keyed to the run's actual retrieval set** — so a reader can tell which sentence came from which retrieved source, and a claim with **no** marker reads as the model's general knowledge (absence-as-signal, Pitfall 14: never a post-hoc LLM re-ask).

The operator fixed the **density = per-claim, sparing** (only load-bearing facts carry a marker; framing prose flows). This sketch settles the remaining "feels like" question: **what FORM does the marker take**, how does it behave **during streaming vs. settled**, and how is **absence** taught without a nagging banner?

## How to View

open .planning/sketches/074-inline-citation-marker/index.html

Then: **▶ Replay the stream** (watch the body stream calm/unmarked, then markers attach on settle) · hover a marker for the peek · click a marker to light its numbered footer row · flip A/B/C tabs.

## Variants

- **A: Superscript numeral chip** — a small raised mono `¹`-style primary chip after the claim. Minimal footprint, academic-familiar; absence = plain prose. The lightest touch on the body.
- **B: Bracketed baseline pill** — a `[1]` mono pill on the baseline, primary-dim with a border. Larger tap target (better mobile + a11y), reads more "product" than "footnote."
- **C: Grounded-span underline + end-dot** — the grounded claim's text gets a soft primary underline with a small end-dot; hover lights the whole span. Emphasizes *which span is grounded* rather than *here's a number* — the strongest absence signal (grounded spans are visually distinct) but the heaviest on the body.

## What to Look For

- **The 3-second calm read at rest** — does the marker inform without turning the answer into a footnoted term-paper? (The acceptance bar is the calm-instrument body.)
- **Absence-as-signal** — the last sentence ("In general, SaaS businesses…") carries no marker. In which form does its *unmarked-ness* read most naturally as "general knowledge"?
- **Streaming honesty** — on replay, the body streams **unmarked and calm**; markers attach only on **settle** (never speculative mid-token). Does the settle-attach feel trustworthy or jarring?
- **The seam into 075** — clicking a marker lights the matching numbered footer row. That footer is the operator's chosen restructure (numbered `[n]` References keyed to the markers); its full click-through treatment is Sketch 075.

## Build Handover (reuse vs net-new)

| Piece | Status | Real file / mechanism |
|---|---|---|
| Retrieval set, passages, filenames, chunk index, similarity | **REAL / wired** | `agent_loop.py` `unique_citations` → `citations` SSE + `source_refs`; `Citation` type (`document_id, filename, chunk_index, passage, similarity, is_full_doc, version_number`) |
| The bottom "N sources" list | **REAL** | `CitationList.tsx` → `CitationCard.tsx` (today unnumbered, collapsible) |
| Answer body render | **REAL** | `MessageItem.tsx:451` `MarkdownRenderer` (this is a **G-5 hot file** — do not regress the shared render path) |
| Marker rendered **inside** the streamed markdown | **NET-NEW** | inject `[n]` markers into the rendered answer; must not break `dedupParagraphs` / streaming-narration path |
| `[n]`→claim binding | **NET-NEW (set-membership-safe)** | the model emits `[n]` in its text against the **numbered set it was handed** (search results are already ordered) — marker `n` = `citations[n]` by construction; **never** a post-hoc re-ask. Unmarked = no `[n]` = general knowledge |
| Footer **numbering** + marker↔row link | **NET-NEW** | number `CitationList` rows `[n]`; wire marker click → scroll/flash row (full treatment: 075) |
| Absence-as-signal ⓘ | **NET-NEW** | tiered-guidance rule #13 — an ⓘ popover, non-blocking, **never a banner** |
| Streaming: markers attach on settle | **behavior decision** | markers key to the set, which is final when `search_documents` returns / at the `citations` emit (D-03/D-07 order) — render calm during token stream, attach on settle |

**Honesty flags in the mockup:** `numbering net-new` on the footer; the legend spells out real-vs-net-new. **Cross-provider (SC#10):** the marker is a pure render-layer concern over a provider-uniform citation set — it must read identically across all providers (the `citations` SSE is already provider-uniform).
