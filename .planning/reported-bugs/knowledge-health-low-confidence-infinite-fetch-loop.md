---
id: BUG-260516-02
title: Library Health → Stale/Low-confidence page infinite-fetches /knowledge-health/low-confidence/documents and shakes the UI
reported: 2026-05-16
surface: Agentic-RAG
severity: major
status: open
affected_areas: [frontend/library-health, frontend/data-fetching-hooks, backend/knowledge-health-endpoint]
folded_into: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: v2.5-dev
  commit: 40c2bf5
  date: 2026-05-16
---

# BUG-260516-02: Library Health → Stale/Low-confidence — infinite fetch loop + UI shake

## What we observed

Operator navigated to **Library Health** → **Stale and Low Confidence** view. The
UI began visibly "shaking" (re-rendering on a tight loop) and the backend log
streamed identical requests with no debouncing or backoff:

```
INFO:     127.0.0.1:64854 - "GET /knowledge-health/low-confidence/documents?offset=0&limit=10 HTTP/1.1" 200 OK
INFO:     127.0.0.1:64854 - "GET /knowledge-health/low-confidence/documents?offset=0&limit=10 HTTP/1.1" 200 OK
INFO:     127.0.0.1:64854 - "GET /knowledge-health/low-confidence/documents?offset=0&limit=10 HTTP/1.1" 200 OK
INFO:     127.0.0.1:64854 - "GET /knowledge-health/low-confidence/documents?offset=0&limit=10 HTTP/1.1" 200 OK
INFO:     127.0.0.1:64854 - "GET /knowledge-health/low-confidence/documents?offset=0&limit=10 HTTP/1.1" 200 OK
INFO:     127.0.0.1:64854 - "GET /knowledge-health/low-confidence/documents?offset=0&limit=10 HTTP/1.1" 200 OK
```

Same URL (same offset + limit), same source port 64854, all returning 200 OK.
The loop continues as long as the user stays on the page. Identical port across
all requests rules out a cold-start retry storm — these are sequential refires
on a persistent connection.

Expected: one request per mount / one request per pagination change. Stable UI.
Actual: a render → fetch → state-write → re-render → fetch → ... cycle with
no termination.

## Why it matters

**Major severity** — three concurrent harms:

1. **User-perceived breakage:** the page is unusable while it's shaking; users
   can't read, click, or scroll without fighting the re-render.
2. **Backend load:** every visitor to this page hammers `/knowledge-health/low-confidence/documents` 
   on a tight loop. In dev that's noise; in production it's an accidental DoS on
   a query that probably hits Postgres for confidence scores + a documents join.
3. **Cost / quota burn:** if any downstream call in that endpoint hits an LLM
   (e.g., reranking, summary generation), each loop iteration burns tokens.
   Endpoint name suggests Postgres-only, but worth verifying.

The bug is also a confidence killer for the new Phase 32.5 / Phase 076
confidence-recalibration work — the Library Health surface is the user-facing
manifestation of confidence scores. If that page is broken, the whole
confidence story looks broken.

## Hypothesized cause

Classic React useEffect dep-loop, one of the following patterns:

1. **Object/array literal in deps:**
   ```jsx
   useEffect(() => { fetch(...) }, [{ offset: 0, limit: 10 }])
   ```
   The literal is a fresh object every render — deps never match — fetch fires
   every render.

2. **State set by the fetch is in the dep array:**
   ```jsx
   useEffect(() => {
     fetch().then(setDocuments)   // setDocuments triggers a re-render
   }, [documents])                // documents changed → effect re-fires
   ```

3. **Unmemoized callback in deps:**
   ```jsx
   const onFetch = () => { /* ... */ }   // new function every render
   useEffect(() => { onFetch() }, [onFetch])
   ```

4. **React Query / SWR misuse:** if the hook uses `useQuery` and the `queryKey`
   contains an unstable reference, every render produces a new key → new fetch.

5. **Auto-refetch interval set too aggressively:** `useQuery({ refetchInterval: N })`
   with N too small, or `refetchInterval: 0` interpreted as "every render" by
   some abstraction. Less likely — usually causes timed refetches, not
   render-loop refetches.

The endpoint name (`/knowledge-health/low-confidence/documents`) is enough to
grep the frontend for the consumer. Likely entry points:

- `frontend/src/pages/library-health/` or similar
- `frontend/src/hooks/useLowConfidence*` / `useKnowledgeHealth*`
- `frontend/src/lib/api/knowledge-health.ts`

## Surface classification

`Agentic-RAG` — frontend bug in this app's Library Health page. WILL be routed
at the next `/gsd:discuss-phase` / `/gsd:new-milestone` per CLAUDE.md cross-check.

## Suggested routing

- **Fold into in-flight phase:** n/a — Phase 071.3 just shipped; no active
  decimal phase.
- **Defer to future phase / milestone:** strong candidates are **Phase 076**
  (Confidence Recalibration — owns the confidence surface this page renders)
  or **Phase 082** (Cross-cutting Verification + Extraction Telemetry — verifies
  end-to-end UX). Alternatively a small decimal phase (071.4 / 072.1) since the
  fix is almost certainly small (5-30 LOC in one file).
- **Plant as seed:** no — concrete bug with a clear repro and likely small fix.
- **External — note only:** no.

**Recommendation:** this is small and high-visibility. A 071.4 polish phase
bundling this bug + [[document-status-not-realtime-on-upload]] (BUG-260516-01)
would close two visible UX defects from Phase 071.3's testing session in one
short pass. Otherwise fold into Phase 076 since the Library Health surface
becomes its primary deliverable.

## Workarounds (prompt-side, code-side, or UI-side)

- **User workaround:** avoid the Library Health → Stale/Low-confidence page
  until fixed. There is no in-page mitigation; the loop is unconditional.
- **Code-side quick fix (before root-cause):** wrap the offending dep with
  `useMemo({ offset, limit }, [offset, limit])` or change the dep array to
  `[offset, limit]` (primitives) instead of a containing object.

## Reference / evidence links

- Backend uvicorn log snippet (above) — same URL, same port, no spacing.
- Phase 32.5 confidence recalibration ships the score pipeline this page renders
  (see `project_phase32_5_chunking_fixes` memory).
- Phase 076 (Confidence Recalibration) is the canonical home for the confidence
  surface in v2.6.
