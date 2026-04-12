---
phase: 27-citations-confidence-frontend
plan: "01"
subsystem: frontend
tags: [citations, confidence, ux, react, typescript, sse]
dependency_graph:
  requires:
    - 26-citations-confidence-backend (SSE events: citations, confidence)
  provides:
    - CitationCard component (collapsible quoted-block citation entry)
    - CitationList component (N-sources toggle with CitationCard list)
    - ConfidenceBadge component (colour-coded dot + label + disclaimer)
    - Message.citations and Message.confidence fields (live + DB-loaded)
  affects:
    - frontend/src/components/chat/MessageItem.tsx (integration point)
    - frontend/src/lib/api.ts (SSE handlers, DB mapping)
    - frontend/src/hooks/useMessages.ts (state wiring)
    - frontend/src/types/index.ts (type definitions)
tech_stack:
  added: []
  patterns:
    - useState expand/collapse (same as ExecuteCodeBlock)
    - SSE event handler pattern (same as onSources, onSkillActivated)
    - setMessages spread update preserving in-flight fields
key_files:
  created:
    - frontend/src/components/chat/CitationCard.tsx
    - frontend/src/components/chat/CitationList.tsx
    - frontend/src/components/chat/ConfidenceBadge.tsx
    - frontend/src/__tests__/components/CitationCard.test.tsx
    - frontend/src/__tests__/components/ConfidenceBadge.test.tsx
  modified:
    - frontend/src/types/index.ts
    - frontend/src/lib/api.ts
    - frontend/src/hooks/useMessages.ts
    - frontend/src/components/chat/MessageItem.tsx
    - frontend/src/__tests__/lib/api.test.ts
  deleted:
    - frontend/src/components/chat/SourceReferences.tsx
decisions:
  - D-01: SourceReferences pill badges retired — citation cards replace them entirely; no coexistence
  - D-09: source_refs mapped to citations on DB load (not sources); confidence is live-only (not persisted)
  - Task-3 api.test.ts: updated getMessages test to reflect source_refs -> citations mapping (previous test expected sources, now expects citations: [])
metrics:
  duration: 231s
  completed: 2026-04-12
  tasks: 4
  files: 10
---

# Phase 27 Plan 01: Citations & Confidence Frontend Summary

**One-liner:** Citation cards (collapsible quoted-block style) and colour-coded confidence badge wired into chat UI via Phase 26 SSE events — answers now show retrieved evidence and reliability signal inline.

## What Was Built

Surfaced Phase 26's `citations` and `confidence` SSE events as React UI in the chat interface. Three new components handle display; updated types, api, and hook wire the data flow.

### New Components

**CitationCard** — Single citation entry with:
- Header: document filename + "Chunk N" (1-based) or "Full document" label for `is_full_doc` entries
- Passage: truncated to 2 lines via `line-clamp-2` with "Show more / Show less" toggle
- Visual style: `border-l-2 border-muted-foreground/30 pl-3 bg-muted/30 rounded-r-md` (quoted-block)
- Null passage handled gracefully (no toggle rendered) — backward compatible with old source_refs entries

**CitationList** — Section-level container:
- Default state: collapsed "N sources" toggle with ChevronRight
- Expanded: all CitationCard instances rendered in `flex flex-col gap-2`
- Returns null when citations array is empty

**ConfidenceBadge** — Reliability signal:
- Coloured dot + level label: `● High confidence` (green-500) / `● Medium confidence` (amber-500) / `● Low confidence` (red-500)
- Optional disclaimer rendered as `text-xs text-muted-foreground italic` when present
- Only renders when `message.confidence` is set (absent on non-RAG turns)

### Data Flow

- `frontend/src/types/index.ts`: Added `Citation` and `ConfidenceResult` interfaces; extended `Message` with `citations?` and `confidence?` fields
- `frontend/src/lib/api.ts`: Added `onCitations` and `onConfidence` callbacks to `streamMessage`; added `parsed.type === "citations"` and `parsed.type === "confidence"` SSE handlers; updated `getMessages` to map `source_refs → citations` (Phase 27 DB load pattern)
- `frontend/src/hooks/useMessages.ts`: Wired `onCitations` (setMessages citations) and `onConfidence` (setMessages confidence with `avg_similarity` snake_case mapping) into `streamMessage` call
- `frontend/src/components/chat/MessageItem.tsx`: Replaced `SourceReferences` with `ConfidenceBadge` + `CitationList` after message text; rendering order: message text → streaming cursor → confidence badge → citation list

### Retired

`SourceReferences.tsx` deleted — pill badges replaced by citation cards (D-01). No other importers existed.

## Test Results

- 12 new unit tests added (CitationCard x7, ConfidenceBadge x5) — all pass
- api.test.ts `getMessages` test updated to reflect new `source_refs → citations` mapping
- TypeScript compiles cleanly with `npx tsc --noEmit`
- 93 tests passing (was 81 before this plan) — 12 net new tests

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated getMessages unit test to match new source_refs → citations mapping**
- **Found during:** Task 3
- **Issue:** `api.test.ts` `getMessages > returns parsed message array` expected the old behavior where messages were returned as-is when `source_refs` was absent. After Task 1 changed `getMessages` to always add `citations: []` (mapped from `source_refs ?? []`), the test failed with a mismatch.
- **Fix:** Updated test assertion to expect `citations: []` on messages without `source_refs`, and renamed test to accurately describe the new behavior.
- **Files modified:** `frontend/src/__tests__/lib/api.test.ts`
- **Commit:** included in 8bf8b18

## Known Stubs

None — all data flows are wired. ConfidenceBadge renders from live SSE `confidence` event. CitationList renders from live SSE `citations` event (or DB-loaded `source_refs` mapped to `citations`). No hardcoded placeholder values.

## Self-Check: PASSED

Files created/verified:
- FOUND: frontend/src/components/chat/CitationCard.tsx
- FOUND: frontend/src/components/chat/CitationList.tsx
- FOUND: frontend/src/components/chat/ConfidenceBadge.tsx
- FOUND: frontend/src/__tests__/components/CitationCard.test.tsx
- FOUND: frontend/src/__tests__/components/ConfidenceBadge.test.tsx
- FOUND: frontend/src/components/chat/SourceReferences.tsx DELETED (correct)

Commits verified:
- 3392bad: test(27-01): add Wave 0 test scaffolds
- 5ffb8de: feat(27-01): add Citation/ConfidenceResult types, SSE handlers, and DB-load mapping
- 6995497: feat(27-01): create CitationCard, CitationList, and ConfidenceBadge components
- 8bf8b18: feat(27-01): integrate ConfidenceBadge and CitationList into MessageItem; retire SourceReferences
