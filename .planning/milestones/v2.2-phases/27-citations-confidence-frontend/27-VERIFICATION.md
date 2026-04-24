---
phase: 27-citations-confidence-frontend
verified: 2026-04-12T19:27:00Z
status: passed
score: 6/6 must-haves verified
re_verification: false
---

# Phase 27: Citations & Confidence Frontend Verification Report

**Phase Goal:** Build the Citations & Confidence Frontend — render citation cards and confidence badges in the chat UI, wired to the Phase 26 SSE streams.
**Verified:** 2026-04-12T19:27:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Citation cards appear beneath assistant message text as collapsible quoted blocks with muted background, visually distinct from AI prose | VERIFIED | `CitationCard.tsx` uses `border-l-2 border-muted-foreground/30 pl-3 bg-muted/30 rounded-r-md`; `CitationList.tsx` defaults collapsed, toggle opens card list |
| 2 | Each citation card shows document filename and chunk location label, with expandable passage text | VERIFIED | `CitationCard.tsx` renders `citation.filename`, `Chunk ${chunk_index + 1}` or `Full document`, passage with `line-clamp-2` and "Show more / Show less" toggle |
| 3 | A colour-coded confidence badge (green/amber/red dot + label) appears between message text and citations on RAG-grounded messages | VERIFIED | `ConfidenceBadge.tsx` uses `colourMap = { high: "text-green-500", medium: "text-amber-500", low: "text-red-500" }`; `MessageItem.tsx` renders `{message.confidence && <ConfidenceBadge confidence={message.confidence} />}` before `CitationList` |
| 4 | Low-confidence disclaimer renders as inline muted italic text below the badge | VERIFIED | `ConfidenceBadge.tsx` conditionally renders `<p className="text-xs text-muted-foreground italic mt-0.5">{confidence.disclaimer}</p>` |
| 5 | Confidence badge is absent on non-RAG messages (web search, code execution, skill-only) | VERIFIED | `MessageItem.tsx` renders badge only when `message.confidence` is set; `useMessages.ts` only populates `confidence` from the `confidence` SSE event, which backend emits only for RAG-grounded turns |
| 6 | Historical messages loaded from DB display citation cards from source_refs | VERIFIED | `api.ts` `getMessages` maps `source_refs` to `citations: (source_refs ?? []) as Citation[]`; MessageItem renders CitationList from `message.citations` |

**Score:** 6/6 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/types/index.ts` | Citation and ConfidenceResult interfaces, Message extended | VERIFIED | Lines 49-62: `export interface Citation`, `export interface ConfidenceResult`; lines 76-77: `citations?: Citation[]`, `confidence?: ConfidenceResult` on Message |
| `frontend/src/lib/api.ts` | onCitations and onConfidence SSE handlers, getMessages maps source_refs | VERIFIED | Lines 104-105: callback params present; lines 179-183: `parsed.type === "citations"` and `parsed.type === "confidence"` handlers; line 56: `citations: (source_refs ?? []) as Citation[]` |
| `frontend/src/hooks/useMessages.ts` | Wire onCitations and onConfidence into streamMessage | VERIFIED | Lines 197-208: both callbacks wired; confidence callback maps to `avg_similarity` snake_case correctly |
| `frontend/src/components/chat/CitationCard.tsx` | Single citation with header and expandable passage | VERIFIED | 59 lines; substantive implementation with all required visual features |
| `frontend/src/components/chat/CitationList.tsx` | N sources toggle and CitationCard list | VERIFIED | 40 lines; collapsed by default, toggle, maps citations to CitationCard |
| `frontend/src/components/chat/ConfidenceBadge.tsx` | Coloured dot + level label + optional disclaimer | VERIFIED | 34 lines; all three colour classes present, disclaimer conditional |
| `frontend/src/components/chat/MessageItem.tsx` | Integration point — ConfidenceBadge + CitationList rendered after message text | VERIFIED | Lines 6-7: imports both; lines 73-76: renders ConfidenceBadge then CitationList in correct order |
| `frontend/src/components/chat/SourceReferences.tsx` | Must NOT exist (retired) | VERIFIED | File deleted; `grep -r "SourceReferences" frontend/src` returns no results |
| `frontend/src/__tests__/components/CitationCard.test.tsx` | 7 unit tests | VERIFIED | All 7 tests pass |
| `frontend/src/__tests__/components/ConfidenceBadge.test.tsx` | 5 unit tests | VERIFIED | All 5 tests pass |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `frontend/src/lib/api.ts` | SSE stream | `parsed.type === "citations"` and `parsed.type === "confidence"` handlers | WIRED | Lines 179-183 in api.ts; both handlers present and call their respective callbacks |
| `frontend/src/hooks/useMessages.ts` | `frontend/src/lib/api.ts` | onCitations and onConfidence callbacks passed to streamMessage | WIRED | Lines 197-208 in useMessages.ts; both callbacks wired with correct setMessages spread updates |
| `frontend/src/components/chat/MessageItem.tsx` | `CitationList.tsx` | message.citations prop | WIRED | Line 75: `<CitationList citations={message.citations} />` guarded by `message.citations && message.citations.length > 0` |
| `frontend/src/components/chat/MessageItem.tsx` | `ConfidenceBadge.tsx` | message.confidence prop | WIRED | Line 73: `{message.confidence && <ConfidenceBadge confidence={message.confidence} />}` |
| `frontend/src/lib/api.ts getMessages` | `frontend/src/types/index.ts Citation` | source_refs mapped to citations on DB load | WIRED | Line 53-56 in api.ts: comment and implementation confirm `source_refs → citations` mapping |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `CitationList.tsx` | `citations` prop | `useMessages.ts` onCitations callback → `setMessages({ ...m, citations })` from SSE `citations` event; OR `getMessages` DB load mapping `source_refs → citations` | Yes — SSE event carries backend-retrieved citations; DB load maps persisted source_refs | FLOWING |
| `ConfidenceBadge.tsx` | `confidence` prop | `useMessages.ts` onConfidence callback → `setMessages({ ...m, confidence: { level, avg_similarity, disclaimer } })` from SSE `confidence` event | Yes — backend emits only for RAG turns with real similarity scores | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — Requires a running browser and live SSE stream to verify visual rendering. These checks are routed to human verification below.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CITE-03 | 27-01-PLAN.md | Citation card text is visually distinct from the AI-generated response (quoted block style with different background) | SATISFIED | `CitationCard.tsx` uses `border-l-2 border-muted-foreground/30 pl-3 bg-muted/30 rounded-r-md` — quoted block style with muted background, left border accent; visually distinct from prose which has no background treatment |

REQUIREMENTS.md confirms CITE-03 is mapped to Phase 27 and marked Complete.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `frontend/src/__tests__/components/MessageItem.test.tsx` | 53, 79, 87, 70-71 | Tests check for CSS classes (`.bg-primary.text-primary-foreground`, `.bg-muted`, `justify-start`) that don't match the current MessageItem DOM structure (component uses `gradient-primary`, no `.bg-muted` wrapper) | Info | Pre-existing test drift — MessageItem.test.tsx last modified before Phase 27 (commit `f1255ee`); Phase 27 did not introduce this drift. 4 tests fail but are unrelated to Phase 27 goals. Phase 27's own 12 tests all pass. |

No stubs, no TODO/placeholder comments, no hardcoded empty data arrays in Phase 27 artifacts. The SUMMARY correctly states "No known stubs."

---

### Human Verification Required

#### 1. Citation cards appear in live chat

**Test:** Send a document-grounded query in the chat UI (attach a document, then ask a question about it).
**Expected:** Citation cards appear as collapsible quoted blocks beneath the response, showing the document filename, chunk number, and expandable passage. A green/amber/red badge appears between message text and the sources section.
**Why human:** Requires a live browser, running backend, and real SSE stream delivery.

#### 2. Confidence badge absent on non-RAG messages

**Test:** Send a general question with no documents uploaded (web search mode or plain chat).
**Expected:** No confidence badge and no citation cards appear beneath the response.
**Why human:** Requires live browser and verifying absence of UI elements at runtime.

#### 3. Historical messages show citations

**Test:** Load a thread that previously had a RAG-grounded response (persisted in DB with source_refs).
**Expected:** Citation cards render from the DB-loaded data — collapsed by default, expandable on click.
**Why human:** Requires a populated database and live browser rendering.

---

### Gaps Summary

No gaps. All 6 observable truths are verified. All 10 artifacts exist and are substantive. All 5 key links are wired. Data flows for both CitationList and ConfidenceBadge trace to real backend data. CITE-03 is satisfied. 12 Phase 27 unit tests pass (7 CitationCard + 5 ConfidenceBadge). The 4 pre-existing MessageItem test failures are unrelated to Phase 27 — they exist because MessageItem.test.tsx was written against an earlier component design and has not been updated since "Add Module 2" commit.

---

_Verified: 2026-04-12T19:27:00Z_
_Verifier: Claude (gsd-verifier)_
