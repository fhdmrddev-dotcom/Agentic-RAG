# Phase 153: Inline Citations - Context

**Gathered:** 2026-07-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Chat answers show a small **per-claim citation marker** tied to what the agent
**actually retrieved this run**, with click-through to the source passage — and
a claim **without** a marker reads as the model's general knowledge
(absence-as-signal, the converged industry pattern). One requirement: **CITE-01**.

**The two sketches (074-A + 075-A, operator-approved) settled how it LOOKS and
FEELS. This discussion settled how it stays HONEST and WHERE it applies.** The
render/interaction is a pure layer over the already-provider-uniform `citations`
SSE — no shared-path fork (SC#10, D-14).

**In scope:** Deep-chat answers grounded in `search_documents` chunks and
full-doc / fetched-file reads; the superscript marker; the numbered `[n]`
References footer; hover-peek → pin click-through; set-membership attribution +
integrity rules.

**Out of scope (this phase):** inline markers on workflow `llm_emit` answers
(they keep their existing `citation_policy` gate); any "from your docs" explicit
label (anti-feature per REQUIREMENTS); any post-hoc LLM re-ask (Pitfall 14).

</domain>

<decisions>
## Implementation Decisions

### Attribution & integrity (set-membership — the honesty core)

- **D-01 — Set-membership is the ONLY mechanism.** Inline marker `n` = `citations[n]`
  from the run's finalized retrieval set. **Never** a post-hoc LLM re-ask (Pitfall 14).
- **D-02 — Non-member markers are STRIPPED.** The backend validates every emitted
  `[n]` against the finalized `unique_citations` set; any marker that doesn't map to
  a real retrieved source (out-of-range index, or a source absent from the final set)
  is **removed from the answer text**, so that claim then reads unmarked (general
  knowledge). Never render a broken or fabricated attribution.
- **D-03 — Survivors renumber `1..k` to match the footer.** The **backend is the
  single source of truth for numbering.** The numbered `[n]` References footer and the
  inline markers share ONE canonical numbering derived from the finalized dedup set.
- **D-04 — No backstop for false-negatives.** A grounded claim the model *forgot* to
  mark stays unmarked — we trust the model and never re-ask (Pitfall 14). Absence-as-
  signal deliberately accepts this floor; the model is instructed to mark load-bearing
  claims, but a missed marker is not "repaired."
- **D-05 — Validate/renumber at SETTLE.** This happens at the point `unique_citations`
  is finalized and the `citations` SSE fires (`agent_loop.py` ~L2781–2790, D-03/D-07
  ordering: after sources, before confidence) — which coincides exactly with sketch
  074's "markers attach on settle" behavior. The body streams calm/unmarked; validated
  markers attach when the set is known.

### Cross-provider floor (SC#10)

- **D-06 — Footer ALWAYS renders when retrieval ran.** Today's `CitationList`, now
  numbered, appears whenever there is a retrieval set — independent of whether the
  model emitted any inline markers.
- **D-07 — Inline markers render only when the model emitted valid (set-member) ones.**
  A weaker / non-compliant model degrades gracefully to **footer-only** — the reader
  still gets the sources, just not per-claim. **No provider ends up worse than today.**

### Scope & what counts as a source

- **D-08 — Deep chat only this phase.** Workflow `llm_emit` answers keep their existing
  `citation_policy` gate and are **not** retrofitted with inline markers (deferred —
  see Deferred Ideas).
- **D-09 — Both chunk and full-doc grounding cite.** `search_documents` chunk retrieval
  AND full-doc / fetched-file reads (`is_full_doc`; Phase 151 `fetch_document_file`)
  both produce citations — they already flow into the shared `citations` / `source_refs`
  set.
- **D-10 — Whole-doc peek shows "full document → Open", not a snippet.** A citation with
  `is_full_doc=true` has no chunk/similarity, so the hover-peek popover shows a "full
  document" affordance + "Open document" rather than a chunk snippet + score.

### Rollout & Deep parity

- **D-11 — Always-on, no toggle.** Inline citations are on whenever retrieval ran (the
  Glean/Beam converged pattern — no Settings switch to manage/support).
- **D-12 — Additive, retrieval-turns-only instruction.** The citation instruction is
  added **only on turns where retrieval happened**, so Deep Mode stays **byte-identical**
  on every non-retrieval turn (D-14 red line). Provider differences stay at the
  gateway/adapter boundary — no shared-path fork.

### Locked by the sketches (design contract — do NOT re-open)

- Marker **form** = superscript numeral chip (`¹`-style, mono, primary), **sparing /
  per load-bearing claim** only (074-A).
- **Absence** = plain prose = general knowledge; taught via a quiet, non-blocking ⓘ
  popover, **never a banner** (074-A; tiered-guidance rule #13).
- **Streaming** = body streams calm & unmarked; markers attach on **settle** (074).
- **Click-through** = hover-peek popover (filename · chunk · similarity · snippet +
  "Open document") → click-to-**pin** 📌; **bidirectional** marker↔row (075-A).
- **Footer** = today's `CitationList` restructured into a numbered `[n]` References
  list, **open-by-default when markers exist**, keyed 1:1 to markers (075-A).

### Claude's Discretion (researcher / planner decides)

- **Exact numbering mechanism handed to the model** (per-result IDs embedded in the
  `search_documents` tool response vs. numbering the finalized set) — the D-02/D-03
  "strip + renumber to footer" rule makes any reasonable mechanism safe, because the
  backend re-derives canonical numbers regardless of what the model emitted.
- **Backend vs. frontend split of marker parse/validate.** D-02/D-03 imply the backend
  owns the authoritative set + strip + renumber (and the persisted message must already
  be consistent), but the exact SSE contract (normalized answer text + a marker→citation
  map, vs. frontend parsing `[n]` from markdown against the `citations` array) is a
  research call. Must not break `dedupParagraphs` / the streaming-narration path.
- **Marker-density prompt wording** to achieve "load-bearing facts carry a marker,
  framing prose flows" without the term-paper effect.
- **Full-doc peek exact copy** (D-10 fixes the shape, not the words).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirement + roadmap
- `.planning/ROADMAP.md` §"Phase 153: Inline Citations" (~L307–321) — goal, 4 success
  criteria, G-2/G-5/SC#10 flags, "set-membership design must be nailed down before coding."
- `.planning/REQUIREMENTS.md` — **CITE-01** (L41) + the "Explicit 'from your docs'
  labels" Out-of-Scope row (L73, absence-of-marker IS the signal).

### Design contract (G-2 — operator-approved, mandatory acceptance bar)
- `.planning/sketches/074-inline-citation-marker/README.md` + `index.html` — winner **A**
  (superscript chip); density = per-claim/sparing; absence semantics; attach-on-settle;
  the reuse-vs-net-new build handover table.
- `.planning/sketches/075-citation-clickthrough/README.md` + `index.html` — winner **A**
  (hover-peek → pin); the numbered `[n]` References footer restructure; bidirectional
  marker↔row; the reuse-vs-net-new build handover table + a11y notes (feeds Phase 155).

### Research + design system
- `.planning/research/SUMMARY.md` — Pitfall 14 (set-membership, never post-hoc re-ask);
  the "converged industry pattern" framing (Glean/Beam study).
- `.claude/skills/sketch-findings-agentic-rag/SKILL.md` — Aether Deep Midnight tokens +
  the calm-instrument design language the markers must sit inside without adding chrome-noise.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (REAL / already wired — the citation set exists today)
- `backend/app/services/agent_loop.py`:
  - `_deduplicate_citations()` (L851) — dedup by `(document_id, chunk_index)`,
    order-preserving (D-14). Produces the ordered, de-duplicated set the footer numbers.
  - `retrieved_citations` accumulate from every tool result's `.citations`
    (L1716–1719, L2522–2525); `unique_citations[:] = _deduplicate_citations(...)`
    at L2781; **`citations` SSE emitted at L2790** (D-03/D-07: after sources, before
    confidence). SSE truncates passage at 400 chars; **full text lives in `source_refs`**
    (D-13, L1512).
  - `Citation` type fields: `document_id, filename, chunk_index, passage, similarity,
    is_full_doc, version_number`.
- Frontend citation UI: `CitationList.tsx` → `CitationCard.tsx` — today **unnumbered +
  collapsible**; this phase numbers rows `[n]` + opens-by-default when markers exist +
  wires marker↔row link (075).
- Answer body render: `MessageItem.tsx:451` `MarkdownRenderer` — where the superscript
  marker injects.

### Established Patterns
- The `citations` SSE is **provider-uniform** — every provider funnels through the same
  emit. The whole marker/click-through feature is a pure render/interaction layer over
  it (SC#10 satisfied by construction; the work is not per-provider).
- Additive-instruction-on-retrieval-turns mirrors the existing "structured-path
  pre-injection" discipline (Phase 149) — instructions injected conditionally without
  forking the shared path.

### Integration Points
- **Backend validate/renumber seam** = the `citations` finalize point in
  `agent_loop.py` (~L2781–2790), where `unique_citations` is authoritative (D-05).
- **G-5 hot files (audit-locked):** `frontend/src/components/chat/MessageItem.tsx`
  (marker injection into `MarkdownRenderer`) and `frontend/src/providers/StreamsProvider.tsx`
  (streaming/settle state). Ledger marks both **satisfied** (refactored at 075.7) — so no
  refactor-first block — but **re-run the replay/render tests; do NOT regress the shared
  render path** (`dedupParagraphs` / streaming-narration). `backend/app/api/threads.py`
  stays untouched.

</code_context>

<specifics>
## Specific Ideas

- The set-membership guarantee is the product's trust story: **a marker can only ever
  point at something the agent truly pulled this run.** Every integrity rule (D-02 strip,
  D-03 renumber-to-footer, D-04 no-repair) exists to keep that literally true rather than
  merely likely.
- "No provider worse than today" (D-06/D-07) is the explicit cross-provider floor — the
  feature is allowed to be *richer* on strong models but never *poorer* than the current
  sources list on weak ones.

</specifics>

<deferred>
## Deferred Ideas

- **Inline citations on workflow `llm_emit` answers.** Out of scope this phase (D-08).
  Workflow answers keep their existing `citation_policy` gate. Re-open trigger: a
  dedicated "workflow-output citations" phase, or user demand once Deep-chat citations
  ship and prove out. Bigger blast radius on a separate surface — deliberately not
  bundled here.
- **A user setting to disable citations.** Considered and rejected (D-11) — always-on
  matches the converged pattern and avoids a config/support surface. Re-open trigger:
  real user reports that always-on citations are unwanted in some workflow.

</deferred>

---

*Phase: 153-inline-citations*
*Context gathered: 2026-07-15*
