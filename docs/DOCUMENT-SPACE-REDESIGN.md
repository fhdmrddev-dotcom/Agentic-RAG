# Document Space Redesign — Requirements Capture (assessment, 2026-08-28)

Source: Stitch project **RAG Document Manager V1** (`projects/6647337692456837497`, 12 screens).
Register entry: **SEED-224** (`.planning/seeds/SEED-224-document-space-redesign-five-tab-rag-honesty.md`),
which carries the measured findings this assessment left as assumptions — including that there is
NO `DocumentsPage` and the five-tab shell has no host today.

Goal (operator): reimagine the Documents space at the same tone / information density / UX level as
the redesign — inside the **Documents section as multi-tab**, keeping document management
**inside RAG**, and keeping it simple. This is an assessment, not a plan.

## What the redesign shows vs. what we already have

The redesign is not one screen — it is a **six-surface journey**:
upload → processing (pipeline) → management (table/folders) → indexing (vectors) →
retrieval (how the docs actually perform) → per-document detail (metadata + chunks + content).

| Redesign surface | We already have | Gap |
|---|---|---|
| Documents table + folders sidebar + detail panel (refs, V1/V2) | Phase 112 detail shell, 114 virtual folders/Views, 117 relationships, 118 classification | Retrieval facts, chunks visibility, per-file processing stage |
| Ingestion queue w/ per-file progress (03) | Manual upload + ingestion job tracking | Stage-level visibility (parse → chunk → embed) |
| Pipeline stages + token stats (07) | — | Stage progress: **v1** · token accounting: skip |
| Vector/Index management (13) | Re-embed lifecycle (Phase 111.1 confirm + progress) | Indexing tab that surfaces model + totals + re-index |
| Retrieval analytics / golden samples (09) | Eval runner (Phase 137 family), grounding audit | Per-document retrieval history; golden-sample marking |
| Chunking settings + chunk preview (15, 01) | Chunks exist in DB (count shown today) | Chunk text + vector id viewable per document |

## Proposed Documents-section tab set (simple bar, 5 tabs)

1. **Documents** — today's page, upgraded in place:
   - Table gains a per-file **processing stage** indicator (parse / chunk / embed) for in-flight files; done state unchanged.
   - Hover/row actions: **Re-index** (single-doc re-embed via existing lifecycle), **Test query**, Delete (existing).
   - Detail panel gains a **Retrieval** section (times retrieved, last query, avg relevance) and a **Chunks** list (chunk text + vector id, read-only) in the existing cross-surface shell — no new panel.
2. **Views & Collections** — today's saved-Views/folders. **No change** this pass. The redesign's "collections with search-quality score" (10) is deferred: a score needs retrieval history to be honest.
3. **Ingestion** — dropzone (existing upload flow) + queue table with 3-stage per-file progress, pause/cancel. **No connectors in this pass** — connected-drive auto-ingest is operator direction but owned by **SEED-142**; whoever ships it opens the Connectors sub-view and updates the manual-upload-only rule in CLAUDE.md in the same commit.
4. **Indexing** — embedding model + version, total vectors (live count), re-index-all (existing re-embed lifecycle), per-collection re-index. One honest health tile: **recent retrieval latency** (measured), not a decorative "98% healthy".
5. **Retrieval** — per-document retrieval stats list + **golden-sample marking** (flag a document/query as a held-out retrieval test; eval runner verifies it stays in top-k). This is the redesign's "Validation" half, wired to the existing eval system instead of a stand-alone heatmap.

## Explicitly cut (decorative or ungrounded — do not ship as drawn)

- **Embedding Quality 92% + trend chart** (V2) — no real signal behind a score like this; shipping it is a lie with a line chart.
- **Static "Semantic Match %" column** (11) — semantic match is per-query, not a stored document property.
- **Token usage pie chart / per-stage token columns** (07) — ingestion token accounting v1: skip. The pipeline reads honestly with stages alone.
- **Retrieval heatmap with section-level strength + narrative executive summary** (09) — v1 replaces with golden samples + per-doc stats. Section-level scoring can follow once retrieval events exist.
- **Faceted filter panel** (11) — keep today's filter/Views machinery; classification covers the "security tags" facet.
- **S3 / Google Drive connector cards** (08) — SEED-142, separate phase.
- **Owner column/owner filter** (12) — trivial, include only if the table gets a home for it; RLS already scopes ownership.

## Real work (schema + code)

1. **Per-document retrieval history** — the one real schema addition. Check first whether search/retrieval events are already logged anywhere (grounding audit, harness paths); if not, a minimal `retrieval_events` table (doc id, query, score, ts; RLS to owner) written on the retrieval path. Powers tabs 1 (Retrieval section), 4 (latency tile) and 5 entirely.
2. **Golden samples** — flag + linkage to the eval runner; a golden sample that drops out of top-k is a retrieval regression surfaced in Retrieval tab and evals.
3. **Chunk view** — read-only list from existing chunk storage; no new write path.
4. **Stage-level ingestion status** — surface what the ingestion job tracker already knows as 3 stages; add stage transitions if not already recorded.
5. **Tab bar + Ingestion/Retrieval/Indexing tab shells** in the Documents page (hot-file aware: `DocumentsPage`-family files need a ledger check at plan time; the panel is the cross-surface shell from the memory note — changes land in chat-side mounting).

## Verdict

The redesign's worth is **honesty about the RAG half** — retrieval frequency, golden samples,
chunk visibility, index health — not the management half, which we largely have. Everything in
the five-tab set except the schema item is implementable on existing surfaces and data; the
retrieval-events table is the only new substrate, and it's what makes three tabs non-decorative.

**Deferred (with triggers):** connectors → SEED-142; collection search-quality score → once
retrieval history has ≥ a few weeks of data; section-level retrieval heatmap → after golden samples
prove the eval wiring; ingestion token accounting → only if a real cost question appears.