# Phase 27: Citations & Confidence — Frontend - Research

**Researched:** 2026-04-12
**Domain:** React/TypeScript frontend — SSE wiring, new UI components, type extensions
**Confidence:** HIGH

## Summary

Phase 27 is a pure frontend phase. The backend already emits `citations` and `confidence` SSE events (Phase 26 complete). The work is entirely confined to the React/TypeScript layer: extend the `Message` type, add two SSE handlers in `api.ts`, wire them in `useMessages.ts`, create three new components (`CitationCard`, `CitationList`, `ConfidenceBadge`), integrate them in `MessageItem.tsx`, update the DB-load path in `api.ts`, and retire `SourceReferences.tsx`.

All decisions are fully locked in CONTEXT.md (D-01 through D-10). No architecture exploration is needed — this is a direct implementation of the documented design. The SSE event shapes are concrete (Phase 26 is complete and verified). The integration points are known: `frontend/src/lib/api.ts`, `frontend/src/hooks/useMessages.ts`, `frontend/src/types/index.ts`, and `frontend/src/components/chat/MessageItem.tsx`.

The sole open risk is ensuring the `getMessages` DB-reload path maps `source_refs` (which now stores full citation objects per Phase 26 D-13) to `message.citations` correctly, while keeping backward compatibility for historical messages that have only `{document_id, filename}` objects in `source_refs`.

**Primary recommendation:** Implement in a single plan with four sequential tasks: (1) types + api.ts, (2) useMessages.ts wiring, (3) three new components, (4) MessageItem.tsx integration + SourceReferences.tsx retirement.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** SourceReferences.tsx is retired. Citation cards become the single source display for RAG responses. `MessageItem.tsx` no longer renders SourceReferences for RAG messages.
- **D-02:** Add `onCitations` and `onConfidence` callbacks to `streamMessage` in `api.ts`. Handle `parsed.type === "citations"` and `parsed.type === "confidence"` in the SSE parsing loop.
- **D-03:** New TypeScript types added to `types/index.ts` — `Citation`, `ConfidenceResult`. Extend `Message` with `citations?: Citation[]` and `confidence?: ConfidenceResult`.
- **D-04:** Citation cards default to **collapsed**. A single "N sources" toggle expands the full list. Each card has its own "Show more / Show less" passage toggle.
- **D-05:** Card anatomy: header (filename + chunk location or "Full document"), expandable passage (truncated to ~2 lines by default), quoted block style with left border accent + `bg-muted/30` background.
- **D-06:** Confidence badge: small coloured dot + label, `text-xs`, colours green/amber/red. Only rendered when `message.confidence` is set.
- **D-07:** Low-confidence disclaimer is inline muted italic text below the badge. Text comes verbatim from `message.confidence.disclaimer`.
- **D-08:** Rendering order in MessageItem: tool calls → skill activated → message text → confidence badge + disclaimer → "N sources" toggle + citation cards.
- **D-09:** On DB load, map `source_refs` (full citation objects from Phase 26) to `message.citations`. Confidence is NOT persisted — historical messages will not show a confidence badge.
- **D-10:** New files: `CitationCard.tsx`, `CitationList.tsx`, `ConfidenceBadge.tsx`. Retire `SourceReferences.tsx`.

### Claude's Discretion

None specified — all decisions are locked.

### Deferred Ideas (OUT OF SCOPE)

- Inline citation anchors in AI text (e.g., superscript [1] [2])
- Similarity score shown on each card
- Confidence trend across a conversation thread
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CITE-03 | Citation card text is visually distinct from the AI-generated response (quoted block style with different background) | D-05 specifies `bg-muted/30` + left border accent. The `bg-muted/30` token is confirmed in `index.css` (CSS variable `--muted` at both light/dark values). The `ghost-border` utility is also available. A left `border-l-2 border-primary/40` or `border-l-2 border-muted-foreground/30` gives the quoted-block distinction. |
</phase_requirements>

---

## Standard Stack

### Core (already in project — no new installs needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.x | Component model, `useState` for expand/collapse | Already installed |
| TypeScript | 5.x | Type safety for new interfaces | Already installed |
| Tailwind CSS | 3.x | Utility classes (`bg-muted/30`, `text-xs`, `text-green-500` etc.) | Already installed |
| shadcn/ui | — | Button, no new components needed; lucide-react icons | Already installed |
| lucide-react | — | `ChevronDown`, `ChevronRight`, `CheckCircle2` icons for expand controls | Already installed |

**No new npm packages required.** All styling tokens (`bg-muted/30`, `text-green-500`, `text-amber-500`, `text-red-500`, `text-muted-foreground`) are standard Tailwind and already functional in the project.

### Alternatives Considered

None — locked decisions specify the design language. No alternatives apply.

---

## Architecture Patterns

### Recommended Component Structure

```
frontend/src/
├── types/
│   └── index.ts              # Add Citation, ConfidenceResult; extend Message
├── lib/
│   └── api.ts                # Add onCitations + onConfidence to streamMessage
│                             # Update getMessages to map source_refs → citations
├── hooks/
│   └── useMessages.ts        # Add onCitations + onConfidence handlers in sendMessage
└── components/chat/
    ├── CitationCard.tsx       # NEW — single citation entry, expand/collapse passage
    ├── CitationList.tsx       # NEW — "N sources" toggle + CitationCard list
    ├── ConfidenceBadge.tsx    # NEW — coloured dot + label + optional disclaimer
    ├── MessageItem.tsx        # MODIFIED — add ConfidenceBadge + CitationList, remove SourceReferences
    └── SourceReferences.tsx   # RETIRED — file removed or emptied
```

### Pattern 1: Expand/Collapse with useState (CitationCard passage toggle)

The project already uses this exact pattern in `ExecuteCodeBlock.tsx`:

```typescript
// Source: frontend/src/components/chat/ExecuteCodeBlock.tsx (existing project code)
const [isExpanded, setIsExpanded] = useState(false)

<button onClick={() => setIsExpanded(!isExpanded)} className="...">
  {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
</button>
{isExpanded && <div className="...">{content}</div>}
```

The same pattern applies to both CitationList (section-level collapse) and CitationCard (passage-level expand).

### Pattern 2: Quoted-Block Visual Style

The design language uses `bg-muted/30` with a left border accent. Confirmed in use in `ExecuteCodeBlock.tsx` (`bg-muted/30`) and `ghost-border` utility in `index.css`.

```typescript
// Quoted block style — left border + muted background
<div className="border-l-2 border-muted-foreground/30 pl-3 bg-muted/30 rounded-r-md py-2 text-sm text-muted-foreground italic">
  {passage}
</div>
```

### Pattern 3: Confidence Badge — Coloured Dot + Label

```typescript
// Source: D-06 from CONTEXT.md
const colourMap = {
  high:   "text-green-500",
  medium: "text-amber-500",
  low:    "text-red-500",
}

<span className={cn("text-xs font-medium flex items-center gap-1", colourMap[level])}>
  ● {level.charAt(0).toUpperCase() + level.slice(1)} confidence
</span>
```

### Pattern 4: SSE Handler Addition in api.ts

The existing `streamMessage` function (api.ts lines 84–187) already handles 13 SSE event types as optional callbacks. The pattern is established:

```typescript
// Existing pattern — add after onSources handler
} else if (parsed.type === "citations" && onCitations) {
  onCitations((parsed.citations ?? []) as Citation[])
} else if (parsed.type === "confidence" && onConfidence) {
  onConfidence(
    parsed.level as "high" | "medium" | "low",
    parsed.avg_similarity as number,
    parsed.disclaimer as string | null,
  )
}
```

### Pattern 5: DB Load Mapping (api.ts getMessages)

Currently maps `source_refs → sources` (SourceReference[]). After Phase 27, must map `source_refs → citations` (Citation[]) because Phase 26 D-13 stores full citation objects in `source_refs`.

The existing mapping code is at `api.ts` lines 52–58:
```typescript
// Current — maps source_refs to SourceReference[]
return data.map((m) => {
  const { source_refs, ...rest } = m
  return { ...rest, sources: source_refs ?? rest.sources }
})
```

Must change to:
```typescript
// Phase 27 — map source_refs to citations (full citation objects)
return data.map((m) => {
  const { source_refs, ...rest } = m
  return { ...rest, citations: (source_refs ?? []) as Citation[] }
})
```

**Critical:** `sources` field on Message will no longer be populated by `getMessages`. Since SourceReferences.tsx is retired (D-01), this is safe. The `sources` field on Message can be kept as-is (it will just be undefined for all loaded messages) — removing it would require verifying no other code reads `message.sources`.

### Anti-Patterns to Avoid

- **Using `message.sources` for citation display after Phase 27:** The `sources` SSE event still fires (for backward compat in the backend) and sets `message.sources`. Do NOT render SourceReferences based on `message.sources` after Phase 27 — only render CitationList based on `message.citations`. The `sources` field can remain in the Message type as a legacy field but should not drive any UI.
- **Re-fetching full passage text from the server:** Phase 26 already truncates at 400 chars — that is the full payload. No server round-trip is needed for "Show more". The passage in the Citation object IS the full passage (up to 400 chars).
- **Rendering a confidence badge on non-RAG messages:** Only render when `message.confidence` is set. Phase 26 guarantees `confidence` event is absent when no `search_documents` calls occurred. Frontend enforces this by checking `message.confidence` before rendering.
- **Rendering both SourceReferences and CitationList simultaneously:** D-01 explicitly retires SourceReferences. Remove the import and render call from `MessageItem.tsx`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Text truncation display | Custom ellipsis / char-slice logic | CSS `line-clamp-2` + full text on expand | CSS approach is accessible, no JS state needed for truncation itself |
| Toggle expand state | Complex open/close manager | `useState(false)` per component | Simple local state is correct — no shared state needed |
| Colour-coded badge | Custom colour system | Tailwind `text-green-500 / text-amber-500 / text-red-500` | Already in project, consistent with design tokens |
| Icon for expand/collapse | SVG hand-roll | `ChevronDown / ChevronRight` from lucide-react | Already installed, already used in ExecuteCodeBlock |

---

## Common Pitfalls

### Pitfall 1: `message.sources` still populated by SSE but SourceReferences retired

**What goes wrong:** The `sources` SSE event still fires from the backend (Phase 26 did not remove it). `useMessages.ts` still has an `onSources` handler that sets `message.sources`. After Phase 27, `MessageItem.tsx` no longer renders `SourceReferences`, but `message.sources` will still be populated on the live message object.

**Why it happens:** Phase 26 kept the `sources` event for backward compatibility. Phase 27 only changes frontend rendering.

**How to avoid:** The `onSources` handler in `useMessages.ts` can be left as-is (it costs nothing to keep it). Simply do not render `<SourceReferences>` in `MessageItem.tsx`. No `sources` field cleanup is required unless the planner decides to explicitly remove it.

**Warning signs:** If SourceReferences still renders after Phase 27, check that the import and render call were removed from `MessageItem.tsx`.

### Pitfall 2: Historical messages — source_refs contains legacy SourceReference shape

**What goes wrong:** Messages sent before Phase 26 have `source_refs` with `{document_id, filename}` only (no `passage`, `chunk_index`, etc.). After Phase 27, `getMessages` maps `source_refs → citations`. These old objects would partially satisfy the `Citation` interface but have `undefined` for `passage`, `chunk_index`, `is_full_doc`, etc.

**Why it happens:** The DB was not back-filled; old rows still have the old shape.

**How to avoid:** CitationCard must handle `citation.passage == null` gracefully — if `passage` is null or undefined, do not render the passage expand toggle. Show filename only. This is also the same behavior as `is_full_doc: true` entries (D-05), so the null-passage branch is already required. The defensive check is: `if (citation.passage) { /* show passage */ }`.

**Warning signs:** A runtime error like "cannot read property of undefined" on `citation.is_full_doc` when loading an old thread.

### Pitfall 3: streamMessage parameter count creep

**What goes wrong:** `streamMessage` in `api.ts` already has 18 parameters. Adding `onCitations` and `onConfidence` makes 20. `useMessages.ts` calls `streamMessage` and passes positional arguments — the two new ones must be inserted at the correct position in both the function signature and the call site.

**Why it happens:** The function is positional, not object-based.

**How to avoid:** Insert `onCitations` and `onConfidence` after `onSources` (the natural position matching SSE emission order). Verify the call in `useMessages.ts` passes the new callbacks at the matching positions. TypeScript will catch mismatches at compile time.

**Warning signs:** TypeScript error "Argument of type X is not assignable to parameter of type Y" at the `streamMessage` call site in `useMessages.ts`.

### Pitfall 4: CitationList "N sources" count

**What goes wrong:** Displaying `message.citations.length` as "N sources" could be misleading if `is_full_doc` entries are mixed with chunk entries. However, per D-04, the label is simply "N sources" regardless — this is consistent with Perplexity/NotebookLM behavior.

**How to avoid:** Just use `message.citations.length` for the count. No filtering needed.

### Pitfall 5: Confidence badge renders before SSE stream completes

**What goes wrong:** If `onConfidence` fires mid-stream (before `onDone`), the badge appears while the message text is still accumulating. This is the correct/expected behavior (same as how tool calls appear mid-stream), but care must be taken that the badge does not disappear on `setMessages` state updates.

**How to avoid:** Set `message.confidence` in state exactly once via `setMessages` in `onConfidence`. Subsequent `delta` events do `m.id === assistantId ? { ...m, content: m.content + delta } : m` which preserves all other fields including `confidence`. This is the same spread pattern used for `activatedSkill` and `sources` and will work correctly.

---

## Code Examples

### CitationCard — skeleton

```typescript
// CitationCard.tsx
import { useState } from "react"
import { ChevronDown, ChevronRight, FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Citation } from "@/types"

interface Props { citation: Citation }

export function CitationCard({ citation }: Props) {
  const [expanded, setExpanded] = useState(false)
  const hasPassage = !!citation.passage

  return (
    <div className="border-l-2 border-muted-foreground/30 pl-3 bg-muted/30 rounded-r-md py-2 text-xs">
      {/* Header */}
      <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
        <FileText className="w-3 h-3 flex-shrink-0" />
        <span className="truncate">{citation.filename}</span>
        <span className="text-muted-foreground/50 shrink-0">
          {citation.is_full_doc ? "Full document" : citation.chunk_index != null ? `Chunk ${citation.chunk_index + 1}` : ""}
        </span>
      </div>
      {/* Passage */}
      {hasPassage && (
        <div className="mt-1.5">
          <p className={cn("text-muted-foreground italic leading-relaxed", !expanded && "line-clamp-2")}>
            {citation.passage}
          </p>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 mt-1 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            {expanded
              ? <><ChevronDown className="w-3 h-3" /> Show less</>
              : <><ChevronRight className="w-3 h-3" /> Show more</>
            }
          </button>
        </div>
      )}
    </div>
  )
}
```

### CitationList — skeleton

```typescript
// CitationList.tsx
import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { CitationCard } from "./CitationCard"
import type { Citation } from "@/types"

interface Props { citations: Citation[] }

export function CitationList({ citations }: Props) {
  const [open, setOpen] = useState(false)
  if (!citations.length) return null

  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {citations.length} source{citations.length !== 1 ? "s" : ""}
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-2">
          {citations.map((c, i) => (
            <CitationCard key={`${c.document_id}-${c.chunk_index ?? "full"}-${i}`} citation={c} />
          ))}
        </div>
      )}
    </div>
  )
}
```

### ConfidenceBadge — skeleton

```typescript
// ConfidenceBadge.tsx
import { cn } from "@/lib/utils"
import type { ConfidenceResult } from "@/types"

interface Props { confidence: ConfidenceResult }

const colourMap: Record<string, string> = {
  high:   "text-green-500",
  medium: "text-amber-500",
  low:    "text-red-500",
}

export function ConfidenceBadge({ confidence }: Props) {
  return (
    <div className="mt-2">
      <span className={cn("text-xs flex items-center gap-1", colourMap[confidence.level])}>
        ● {confidence.level.charAt(0).toUpperCase() + confidence.level.slice(1)} confidence
      </span>
      {confidence.disclaimer && (
        <p className="text-xs text-muted-foreground italic mt-0.5">{confidence.disclaimer}</p>
      )}
    </div>
  )
}
```

### MessageItem.tsx — modified content section (after message text)

```typescript
// After MarkdownRenderer in the content block — within the `message.content ? (` branch
{message.confidence && <ConfidenceBadge confidence={message.confidence} />}
{message.citations && message.citations.length > 0 && (
  <CitationList citations={message.citations} />
)}
// REMOVE: {message.sources && message.sources.length > 0 && <SourceReferences sources={message.sources} />}
```

### types/index.ts additions

```typescript
// Add after existing SourceReference interface
export interface Citation {
  document_id: string
  filename: string
  chunk_index: number | null
  passage: string | null
  similarity: number | null
  is_full_doc: boolean
}

export interface ConfidenceResult {
  level: "high" | "medium" | "low"
  avg_similarity: number
  disclaimer: string | null
}

// Extend Message with:
citations?: Citation[]
confidence?: ConfidenceResult
```

---

## Environment Availability

Step 2.6: SKIPPED — this phase is purely frontend code/component changes. No external tools, services, or runtimes beyond the existing Node/Vite dev server are required.

---

## Validation Architecture

`nyquist_validation` is not set in `.planning/config.json` — treat as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest + React Testing Library (standard Vite/React stack) |
| Config file | Check `frontend/vite.config.ts` or `frontend/vitest.config.ts` — likely not yet configured |
| Quick run command | `cd frontend && npm test -- --run` (if configured) |
| Full suite command | `cd frontend && npm test -- --run` |

**Note:** The project has no evidence of a configured frontend test suite in the current file structure. Backend uses pytest. Frontend tests may not exist. Visual verification via browser testing (per CLAUDE.md "Validate — Use browser testing where applicable via MCP") is the primary validation method for this phase.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CITE-03 | Citation cards visually distinct from AI prose (quoted block style, different background) | visual / browser | Browser inspection | ❌ Manual |

### Sampling Rate

- **Per task commit:** Browser smoke test — load a thread with RAG citations, verify cards render
- **Phase gate:** All 4 success criteria visually verified before `/gsd:verify-work`

### Wave 0 Gaps

- No frontend unit test infrastructure detected — validation is browser-based per CLAUDE.md dev flow

---

## Open Questions

1. **Does `message.sources` field on Message need to be removed?**
   - What we know: `sources` is set by `onSources` handler which stays active. SourceReferences.tsx is retired and no longer renders it.
   - What's unclear: Whether any other component reads `message.sources` after Phase 27.
   - Recommendation: Keep `sources?: SourceReference[]` on Message type — removing it risks breaking other code. Simply stop rendering SourceReferences. The field being populated but unused is harmless.

2. **Should SourceReferences.tsx be deleted or emptied?**
   - What we know: D-01 says "file removed or emptied to avoid import errors."
   - What's unclear: The file currently has no other importers beyond `MessageItem.tsx`. Once `MessageItem.tsx` removes the import, the file can be safely deleted.
   - Recommendation: Delete the file entirely after removing the import from `MessageItem.tsx`. A file that exports nothing but does nothing is confusing. Git history preserves it if needed.

3. **Key for CitationCard in list — document_id + chunk_index may collide if same doc retrieved twice**
   - What we know: Phase 26 deduplicates by (document_id, chunk_index) before emitting the `citations` event, so duplicates should not appear.
   - Recommendation: Use `${c.document_id}-${c.chunk_index ?? "full"}-${i}` as key (index as tie-breaker) to be safe.

---

## Sources

### Primary (HIGH confidence)

- `frontend/src/lib/api.ts` — SSE parsing loop structure, `streamMessage` signature, `getMessages` mapping
- `frontend/src/hooks/useMessages.ts` — handler wire-up pattern for all existing SSE events
- `frontend/src/components/chat/MessageItem.tsx` — rendering order and existing component slots
- `frontend/src/types/index.ts` — current Message interface, SourceReference shape
- `frontend/src/components/chat/ExecuteCodeBlock.tsx` — expand/collapse pattern, `bg-muted/30` usage
- `frontend/src/index.css` — `--muted` CSS variable confirmed, `ghost-border` utility
- `.planning/phases/26-citations-confidence-backend/26-02-SUMMARY.md` — SSE event shapes confirmed, emission order confirmed

### Secondary (MEDIUM confidence)

- CONTEXT.md D-01 through D-10 — all design decisions locked and sourced from benchmarking against Perplexity, NotebookLM, Google AI Overviews

### Tertiary (LOW confidence)

None — all findings are from primary source code inspection.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, all tokens confirmed in project source
- Architecture: HIGH — SSE patterns, component patterns all sourced from existing project code
- Pitfalls: HIGH — sourced from actual code inspection, not speculation
- Integration points: HIGH — all files read directly

**Research date:** 2026-04-12
**Valid until:** Stable — no external dependencies. Valid until codebase changes.
