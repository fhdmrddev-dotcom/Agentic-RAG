---
phase: 27-citations-confidence-frontend
created: 2026-04-12
status: ready
---

<domain>
Render the `citations` and `confidence` SSE events (produced by Phase 26) as visible UI elements in the chat. No backend changes. Changes are confined to frontend TypeScript/React files.

Phase 26 already emits the SSE events with the correct shapes. Phase 27 wires them into the UI.
</domain>

<decisions>
## Implementation Decisions

### D-01: Source pills replaced by citation cards
The existing `SourceReferences.tsx` pill badges are retired. Citation cards become the single source display for RAG responses. Rationale: pills were a placeholder for when only `{document_id, filename}` was available — cards already contain the filename, so both coexisting creates redundant visual noise (benchmarked against Perplexity and NotebookLM).

**SourceReferences.tsx is removed or emptied** — `MessageItem.tsx` no longer renders it for RAG messages. The citations SSE event drives all source display.

### D-02: SSE wiring — two new handlers in api.ts
Add `onCitations` and `onConfidence` callbacks to the `streamChat` function signature, alongside the existing `onSources` handler:
- `onCitations: (citations: Citation[]) => void`
- `onConfidence: (level: "high" | "medium" | "low", avgSimilarity: number, disclaimer: string | null) => void`

Handle `parsed.type === "citations"` and `parsed.type === "confidence"` in the SSE parsing loop.

### D-03: New TypeScript types
Add to `types/index.ts`:
```ts
export interface Citation {
  document_id: string
  filename: string
  chunk_index: number | null
  passage: string | null        // null for analyze_document (is_full_doc: true)
  similarity: number | null
  is_full_doc: boolean
}

export interface ConfidenceResult {
  level: "high" | "medium" | "low"
  avg_similarity: number
  disclaimer: string | null
}
```

Extend `Message` type with:
```ts
citations?: Citation[]
confidence?: ConfidenceResult
```

### D-04: Citation cards — collapsed section by default
Benchmarked against Perplexity, NotebookLM, and Google AI Overviews. The AI answer is primary; citations are for verification. Pattern:
- A single "N sources" toggle button below the confidence row collapses/expands the full card list
- Default state: **collapsed**
- When expanded, all citation cards are visible
- Each card has its own "Show more / Show less" toggle for the passage (passages are truncated to 400 chars in the SSE payload per Phase 26 D-04; that is the max — no server round-trip needed)

### D-05: Citation card anatomy
Each card shows:
- **Header (always visible):** Document filename + "Chunk N" location label (if `chunk_index` is not null). For `is_full_doc: true` entries (analyze_document), show filename only with a "Full document" label instead — no passage toggle (CITE-05).
- **Passage (expandable):** Truncated to ~2 lines by default with a "Show more" chevron. Full passage (up to 400 chars) on expand.
- **Visual style:** Quoted block style — left border accent, slightly indented, `bg-muted/30` background, distinct from AI prose. Matches existing Aether Intelligence design language (not a heavy card — lightweight with left border).

### D-06: Confidence badge placement and style
Badge sits in a slim row **between the message text and the sources section** — natural reading flow: read answer → assess reliability → dig into sources. Benchmarked against NotebookLM (grounding signal between answer and sources).

Badge anatomy:
- Small coloured dot + label: `● High confidence` / `● Medium confidence` / `● Low confidence`
- Colours: green (`text-green-500`) for high, amber (`text-amber-500`) for medium, red (`text-red-500`) for low
- Font: `text-xs`, muted weight — present but not dominant
- Only rendered when `message.confidence` is set (absent for non-RAG turns per CONF-04)

### D-07: Disclaimer — inline muted text below badge
Low-confidence disclaimer appears as a single line of small muted italic text directly below the confidence badge row. No coloured callout box (too alarming for a normal occurrence). Benchmarked against Perplexity's inline disclaimer pattern.

```
● Low confidence
This answer is based on limited or weakly-matched evidence. Please verify with the source documents.
```

The disclaimer text comes verbatim from `message.confidence.disclaimer` (set by backend).

### D-08: Rendering order in MessageItem
Final order within an assistant message:
1. Tool calls panel (existing)
2. Skill activated indicator (existing)
3. Message text (existing)
4. Confidence badge row + disclaimer (new — only when `message.confidence` is set)
5. "N sources" toggle + citation cards (new — only when `message.citations` exists and length > 0)

### D-09: Message loading from DB (source_refs → citations)
When loading a thread's message history, `source_refs` in the messages table now stores full citation objects (Phase 26 D-13). Map `source_refs` to `message.citations` on load so historical messages render citation cards correctly. The `level`/`avg_similarity`/`disclaimer` fields are NOT persisted (confidence is a live SSE signal only) — historical messages will not show a confidence badge. This is acceptable behaviour.

### D-10: New component structure
- `CitationCard.tsx` — single citation entry (header + expandable passage)
- `CitationList.tsx` — "N sources" toggle + list of CitationCard instances
- `ConfidenceBadge.tsx` — coloured dot + level label + optional disclaimer
- `SourceReferences.tsx` — retired (file removed or emptied to avoid import errors)

</decisions>

<specifics>
## Specific References
- Benchmarked against: Perplexity AI source citations, NotebookLM grounding panel, Google AI Overviews sources — all use collapsed-by-default with section-level toggle
- Disclaimer pattern: Perplexity inline muted italic (no callout box)
- Badge placement: NotebookLM (between answer and sources)
- Design language: Aether Intelligence — `bg-muted/30`, left-border accent, `text-xs`, CSS variables for colour
</specifics>

<deferred>
## Deferred Ideas
- Inline citation anchors in the AI text (e.g., superscript [1] [2]) — requires backend to inject markers into LLM output; scope creep for Phase 27
- Similarity score shown on each card — decided against (noise for non-technical users; level badge is sufficient)
- Confidence trend across a conversation thread — separate feature, not Phase 27 scope
</deferred>

<canonical_refs>
## Canonical References
- `.planning/REQUIREMENTS.md` — CITE-03 (visual distinctness), CITE-01/02 (card content), CONF-01/02/03/04 (badge behaviour)
- `.planning/ROADMAP.md` §"Phase 27: Citations & Confidence — Frontend" — Success criteria (4 items)
- `.planning/phases/26-citations-confidence-backend/26-CONTEXT.md` — D-03/D-04 (citation SSE shape), D-05 (confidence SSE shape)
- `.planning/phases/26-citations-confidence-backend/26-01-SUMMARY.md` — retrieval service changes
- `.planning/phases/26-citations-confidence-backend/26-02-SUMMARY.md` — SSE event emission details
- `frontend/src/components/chat/MessageItem.tsx` — integration point for new components
- `frontend/src/lib/api.ts` — SSE parsing loop (add onCitations, onConfidence handlers)
- `frontend/src/types/index.ts` — extend Message type with citations and confidence fields
</canonical_refs>
