---
id: SEED-046
status: dormant
planted: 2026-05-31
planted_during: v2.8 (Harness Engine & Workflow Mode — surfaced during Phase 090 operator-testing-notes triage)
trigger_when: A dashboard / observability / RAG-quality milestone is scoped, OR the operator wants richer knowledge-base insights than the current 3-source health view
scope: Medium
---

# SEED-046: Library Health Dashboard Enrichment — leverage the new data sources

## Why This Matters

The Library / Knowledge Health page "looks good" (operator, 2026-05-31), but it only taps **three** data sources today, while the platform has since accumulated a lot more signal it doesn't surface. `backend/app/api/knowledge_health.py` currently computes only:
- **most-retrieved** documents (from `audit_log` retrieval events, 30-day window),
- **never-retrieved** documents (`audit_log` ∖ `documents`),
- **low-confidence** documents (`messages.confidence_avg_similarity` + `source_refs`, threshold 0.38),
- a health **score gauge**.

Sources used: `audit_log`, `documents`, `messages`. That's it. Since those metrics were written, v2.6/v2.7 shipped a wealth of new tables that describe the *real* health of the knowledge base and the agent — none of which the dashboard reads. The operator's instinct is right: "with all the updates we made, we have a lot of sources of data we can leverage to have the best dashboard."

## When to Surface

**Trigger:** a dashboard / observability / RAG-quality milestone is scoped, OR the operator wants richer KB insights.

Present during `/gsd:new-milestone` when the milestone scope matches:
- Observability / analytics / dashboard work
- RAG-quality or ingestion-quality auditing (pairs with [[SEED-020]])
- Any "operator wants to SEE what's happening in the KB / agent" goal

## Scope Estimate

**Medium** (to Large if it grows into a full ops console). Candidate panels, each backed by a now-existing-but-unused source:
- **Extraction quality** — `pdf_extraction_runs` (extractor used, duration, pages, stored counts, failures) → per-doc + aggregate "did ingestion go well?"
- **Multimodal coverage** — `document_images` + `document_tables` (figures/tables stored per doc; vs detected) → the SEED-006/021 storage story made visible (catch the "5% of figures stored" class of problem).
- **Chunk / embedding health** — `document_chunks` (chunks per doc, embedding-model coverage/drift, context-embedding coverage) → spot docs embedded with a stale model or under-chunked.
- **Stale / orphan detection** — docs never re-ingested since an extractor/model change; orphan chunks (the SEED-021/072 orphan-free invariant) → surfaced, not silent.
- **Retrieval patterns (enrich existing)** — most/never-retrieved + per-folder breakdown + trend over time + low-confidence trend.
- **Agent usage (optional ops tab)** — `runs` (tokens, providers, durations, timeouts), `code_executions`/`sandbox_files`, `todos`/`workspace_files` → "how is the agent actually being used / where is cost going."
- **Per-folder breakdowns** across all of the above (folders already exist).

Design consideration: this may split into two views — **KB Health** (doc/extraction/retrieval/embedding focus) and a broader **Ops/Usage** tab (runs/tokens/agent activity). Keep both on the Aether / Deep-Midnight design system.

## Breadcrumbs

- `backend/app/api/knowledge_health.py` — current 3-source metrics: `_fetch_most_retrieved` (audit_log:40), `_fetch_never_retrieved` (99), `_fetch_low_confidence_documents` (messages:145); `LOW_CONF_THRESHOLD=0.38`, `WINDOW_DAYS=30`
- `frontend/src/pages/KnowledgeHealthPage.tsx` + `frontend/src/components/health/*` (HealthPanel, HealthScoreGauge, HealthStatBar, HealthDocumentRow, HealthEmptyState) — the UI to extend
- NEW unused data tables: `pdf_extraction_runs`, `document_images`, `document_tables`, `document_chunks`, `runs`, `code_executions`, `sandbox_files`, `todos`, `workspace_files`
- Related seeds: [[SEED-020]] (retrieval quality audit — feeds the retrieval panels), [[SEED-026]] (error-handling/observability lift — produces error/observability signal), [[SEED-025]] (sandbox execution telemetry — feeds the agent-usage panel), [[SEED-023]] (per-call duration telemetry — feeds runs/latency)

## Notes

This is the *consumer* of several observability seeds — SEED-020/025/023/026 produce the data; this seed turns it into the operator-facing dashboard. Worth coordinating so the dashboard is designed once against the union of those signals rather than bolted on per-seed. Knowledge-base health (ingestion/extraction/embedding/retrieval) is also a competitive-advantage surface — "show me my KB is healthy and being used well" is exactly what an operator evaluating a RAG product wants to see. Keep it on the Aether/Deep-Midnight design system; run lived-experience UI UAT.
