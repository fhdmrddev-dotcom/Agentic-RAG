# Inline Citations (Phase 153)

Per-claim inline citation markers keyed to the run's **actual retrieval set** — a reader can tell which sentence came from which retrieved source, and an unmarked claim reads as the model's general knowledge (absence-as-signal). The honesty crux: marker `n` = `citations[n]` **by construction** (the model emits `[n]` against the numbered, already-ordered set it was handed) — never a post-hoc LLM re-ask (Pitfall 14). G-5 hot file: the marker renders inside `MessageItem.tsx`'s `MarkdownRenderer`.

## Design Decisions

### D1 — Marker = superscript numeral chip, attach-on-settle (074 winner A)
The marker is a small raised mono `¹`-style primary chip after a load-bearing claim — the **lightest touch on the calm-instrument body**, academic-familiar; absence = plain prose. **Density = per-claim, sparing** (operator-fixed): only load-bearing facts carry a marker; framing prose flows unmarked so absence reads cleanly.

- **Won over B (bracketed baseline `[1]` pill):** larger tap target (better mobile/a11y) but reads more "product" than "footnote"; documented as the a11y-forward alternative.
- **Won over C (grounded-span underline + end-dot):** strongest absence signal (grounded spans visually distinct) but the heaviest on the body — rejected as too much chrome for the calm read.

### D2 — Streaming honesty: markers attach on SETTLE, never speculative mid-token (074)
On replay the answer body streams **unmarked and calm**; markers attach only when the answer **settles** (the citation set is final at the `search_documents` return / `citations` SSE emit — D-03/D-07 order). Never render a marker mid-token against an incomplete set.

### D3 — Absence-as-signal is taught by an ⓘ, never a banner (074)
The unmarked claim reading as "general knowledge" is taught via a **non-blocking ⓘ popover** (tiered-guidance rule #13), never a nagging banner on the calm screen.

### D4 — Click-through = hover-peek → click-to-pin (075 winner A)
Hovering a marker peeks the passage in a small popover (filename · chunk · similarity · snippet + "Open document"); clicking **pins** it (📌) so it persists. Peek-without-leaving-your-place — the Perplexity / Claude.ai-cited feel. Best respects the reading flow for the common 1–4-source answer.

- **Won over B (scroll + flash the References footer):** one canonical home, no floating chrome, but you leave your reading spot — documented as the lowest-risk one-home alternative.
- **Won over C (open in the workspace panel):** best for deep source inspection but the heaviest (panel-open reshapes the layout) — overkill for a quick peek; the shell is REAL (004-B) if deep inspection is ever wanted.

### D5 — The bottom "N sources" list becomes a numbered `[n]` References footer keyed 1:1 to the markers (074/075)
The operator's chosen restructure (fixed across all variants): today's unnumbered collapsible `CitationList` becomes a **numbered References footer** (`[1] board_minutes_q3.md · Chunk 4 · 0.63`) keyed 1:1 to the inline markers, **open by default when markers exist**. Clicking a footer row also lights its marker — the two-way link makes set-membership tangible.

### D6 — The binding is set-membership-safe, read-only, mutation-free (074/075)
Every interaction (marker click, footer click) just **indexes the real `citations` set** — no re-ask, no LLM round-trip, no mutation. "Open document" reuses the existing document-detail route.

## What to Avoid

- **A post-hoc LLM re-ask to attribute claims** — the marker is `citations[n]` by construction; re-asking is the Pitfall-14 dishonesty the whole design forbids (D1/D6).
- **Markers mid-stream** — attach on settle against the final set, never speculatively (D2).
- **A banner teaching absence-as-signal** — an ⓘ popover only (D3).
- **Footnoting every sentence** — per-claim sparing; framing prose stays unmarked so absence is legible (D1).
- **A whole panel for a 1–4-source answer** — hover-peek + the footer as the durable home is enough (D4).
- **Regressing the shared render path** — marker injection touches `MessageItem.tsx` (G-5); re-run replay/render tests, don't break `dedupParagraphs` / streaming-narration (build handover in the READMEs).

## Origin

Synthesized from sketches **074-inline-citation-marker** (winner A — superscript numeral chip, attach-on-settle) and **075-citation-clickthrough** (winner A — hover-peek → click-to-pin + numbered References footer). Source files: `sources/074-inline-citation-marker/`, `sources/075-citation-clickthrough/`. Session 2026-07-15 (Phase 153, CITE-01). Real wire: `agent_loop.py` `unique_citations` → `citations` SSE + `source_refs`; `Citation` type (`document_id, filename, chunk_index, passage, similarity, is_full_doc, version_number`); body render `MessageItem.tsx:451` `MarkdownRenderer`. SC#10: the marker is a pure render layer over a provider-uniform `citations` set — identical across all providers. Feeds Phase 155 a11y (keyboard-reachable markers/rows + popover focus mgmt). Seeds planted: SEED-119 (citation footer = retrieval superset — make cited-vs-retrieved legible → v3.5 Phase 178 POLISH-03).
