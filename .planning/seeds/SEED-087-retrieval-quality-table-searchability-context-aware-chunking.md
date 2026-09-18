---
seed_id: SEED-087
title: Retrieval quality & table searchability — embed extracted tables + context-aware chunking/retrieval upgrades
status: planted
planted: 2026-06-15
phase_origin: "Phase 111 plan-phase conversation — ingestion/chunking assessment (5-agent workflow wf_9146d744-2f2, 2026-06-15)"
category: RAG retrieval quality — ingestion/chunking + retrieval-side context; an ADDITIVE correctness+quality seam on the shared document_chunks path, NOT a re-platform
related_seeds: [SEED-020, SEED-076, SEED-048, SEED-069, SEED-005]
related_memories: [feedback_preserve_engine_optionality, feedback_investigate_with_tools_first, feedback_extraction_root_cause_not_plumbing, project_embeddings_openai_spof, feedback_no_cross_provider_regressions]
related_decisions:
  - "Phase 111.1 (Configurable / Multi-Provider Embeddings, INSERTED 2026-06-15) — the re-embed-on-change lifecycle this seed should piggyback on (any chunking/embedding change forces re-embedding existing docs — the same landmine)"
  - "chunk_text recursive splitter (embedding_service.py:10-91) — the existing boundary-aware splitter is SOUND; this seed does NOT replace it"
re_open_triggers:
  - A table-heavy PDF/DOCX is queried and the answer MISSES a known table figure (e.g. 'what was Q3 revenue' fails to surface a table cell) — the table-searchability gap is now biting in practice
  - The agent fires read_document / analyze_document immediately after search_documents more than occasionally (a signal that chunk boundaries are severing context and retrieval isn't reassembling it)
  - A re-embedding / re-ingest pass is scheduled (e.g. Phase 111.1 ships, or an embedding-model change) — at which point fold in table-embedding + optional neighbor-expansion so old docs get backfilled in the same sweep
  - Ingestion starts taking long, multi-section structured/Markdown docs where answers on later sections degrade
  - A retrieval-quality audit (SEED-020) or eval shows recall/grounding leaving measurable accuracy on the table on table/section-heavy corpora
priority: MEDIUM-HIGH for the table-searchability gap (a genuine functional hole — extracted PDF/DOCX tables are invisible to the main search surface, worst on the financial/compliance docs where citation accuracy matters most); MEDIUM/defer for the broader context-aware-chunking upgrades (the existing recursive splitter already captures ~90% of the achievable win)
suggested_phase: a "Retrieval Quality" deliverable, OR fold the cheap/additive items (table-embed + neighbor/parent-document expansion) into the Phase 111.1 re-embed pass. NOT now — assessed-and-deferred per operator ("works great, don't break it; not needed now").
surface: Agentic-RAG
trigger_when: unset
---

# SEED-087 — Retrieval quality & table searchability

## What was assessed (and the verdict)

A 5-agent read-only investigation (workflow `wf_9146d744-2f2`, 2026-06-15) pressure-tested the ingestion/chunking pipeline against the operator's question: *is it solid, are extracted tables/images re-ingested as searchable chunks, and is chunking blind or context-aware?*

**Headline:** the chunker is **solid and NOT blind** — a hand-rolled recursive, boundary-aware splitter. The one genuine gap is that **PDF/DOCX-extracted tables are never embedded → invisible to the main search surface.** Images are fine.

## The chunker is sound (do not replace it)

`chunk_text()` (`embedding_service.py:10-91`) is a recursive hierarchical-separator splitter (same family as LangChain's `RecursiveCharacterTextSplitter`, hand-rolled per the no-LangChain rule):

```python
# embedding_service.py:27
SEPARATORS = ["\n## ", "\n### ", "\n\n", "\n", ". ", "! ", "? ", " ", ""]
```

Markdown H2/H3 → paragraph → line → sentence → space → bare char. Engineering signs, not naivety: sentence separators require a trailing space so it doesn't split `$284,500.00` or `1. Item` (`:25-26`); a lonely heading is merged+recursed with its body (`:60-68`, replacing an earlier 1-char sliding bug); ~200-char overlap is carried forward (`:79-84`); and each chunk gets a prepended `[Document: <file> | Title: … | Date: … | Type: …]` header before embedding while the **raw** chunk is stored for clean citations (`documents.py:1386-1413`) — a lightweight static cousin of **Anthropic Contextual Retrieval**. Defaults 1000 chars / 200 overlap (`config.py:785-786`, char-based, env-configurable, not in the Settings UI). It already satisfies 3 of the 4 strategies the operator named (document-based via headers, recursive via paragraph/sentence, neighbor-overlap); only **semantic** chunking is absent — and the research says that one is the least worth doing (can *hurt* end-to-end via over-fragmentation).

## The real gap: PDF/DOCX tables are not searchable

| Aspect | Extracted? | Embedded → searchable? | Where it lives | Verdict |
|---|---|---|---|---|
| **PDF/DOCX tables** | Yes | **NO** | `document_tables` only | **GAP — orphaned from main search** |
| PDF/DOCX images (captions) | Yes | **YES** | `document_chunks` + `document_images` | Fine |
| XLSX / CSV tabular data | Yes (as text) | **YES** | `document_chunks` | Fine |
| Standalone image upload | Rejected (422) | n/a | not allowed | By design |
| Equations | Yes | **NO** | computed then dropped | Minor orphan (low stakes) |

`extract_and_store_tables` (`multimodal_service.py:181-241`) writes tables to `document_tables` and **stops** — no `chunk_text`, no `embed_texts`, no `document_chunks` insert. Both search RPCs read **only** `FROM public.document_chunks` (`full-schema.sql:103,127`), so a semantic query will not surface a PDF/DOCX table cell via `search_documents`. Tables are reachable **only** if the agent independently calls the separate `query_tables` tool AND already knows the document name (`multimodal_service.py:546`) — i.e. **stored but invisible to the primary search surface**. The image path right next to it (`:458-507`) *does* embed-and-store its captions, so **the fix is already written for images** — the table path is the only aspect missing that block.

## Retrieval is strong but does NOT heal chunk boundaries

Retrieval has hybrid (vector + keyword + RRF), near-dup removal (Jaccard ≥0.85), optional rerank (off by default), a `≥0.38` honesty gate, and confidence buckets. **But** the search RPCs return only the single matched chunk (`full-schema.sql:120-137`) — **no neighbor expansion, no parent-document expansion, no section breadcrumb**; there is no `chunk_index ± 1` fetch anywhere. A fact split across a boundary is not reassembled; the only recovery is a manual `read_document` call, which the system prompt actively discourages (`agent_loop.py:482,526`). Mitigating it: `chunk_index` is stored, ordered, and gapless (`documents.py:1415`), so **neighbor-expansion can be added later at retrieval-time with ZERO schema change and ZERO re-embedding** — the safest possible upgrade.

## Likely shape if promoted (ROI-ordered, cheap/additive first)

| Priority | Move | Cost | Notes |
|---|---|---|---|
| **1 (do regardless, but additive)** | **Embed PDF/DOCX tables as chunks** | Cheap, additive | Serialize each table to markdown (headers+rows), `embed_texts`, insert offset-`chunk_index` rows into `document_chunks` — mirror the image block at `multimodal_service.py:458-507`. New rows only, no schema change, no shared-path change. Affects new docs immediately; old docs need a backfill. |
| **2 (best first upgrade)** | **Neighbor / parent-document expansion at retrieval** | Cheap-moderate, additive | ~15-25% answer-accuracy gain reported; **retrieval-time only — touches no existing data**; `chunk_index` already supports it. The exception to the re-embed landmine. |
| **3** | Markdown-header breadcrumb in chunk metadata | Cheap | Section context per chunk; small migration. |
| **4 (quality play)** | Full Anthropic Contextual Retrieval (LLM blurb per chunk) | Expensive one-time | Anthropic-native SDK + hybrid+rerank already in place; the LLM-generated upgrade to the static header we already prepend. |
| **5 (skip)** | Semantic chunking | Expensive recurring | Documented to *hurt* end-to-end accuracy via over-fragmentation. |
| **— (watch)** | Late chunking | Needs embedder swap | Non-additive (model change); least proven. |

## The landmine + how to not break things

Any change to **how chunks are produced or embedded** (priorities 1, 3, 4) makes existing documents inconsistent with new ones and forces a **RE-EMBED** to benefit — the **same landmine** as the embedding work in **Phase 111.1**. So these should **piggyback on a re-embedding / re-ingest pass**, never ship standalone. Priority 2 (neighbor expansion) is the safe exception (retrieval-only). The table-embed fix (priority 1) is safe to ship additively for new docs at any time, but old table-heavy docs only benefit after a backfill — so it's best bundled with the re-embed pass too.

## Deliberately NOT in scope

Replacing the recursive splitter (it's sound); semantic chunking (research says skip); re-platforming off pgvector; the embeddings provider/SPOF work (that's **Phase 111.1** / SEED-048); the filtered-HNSW recall-at-scale concern (SEED-076); embedding-model/reranker quality (SEED-020). This seed is specifically: **(a) close the table-searchability functional hole, (b) optionally add retrieval-time context reassembly, (c) the optional LLM-contextual-retrieval quality upgrade** — all on top of the existing, sound chunker.

## Relationship to sibling seeds

- **SEED-020** (retrieval quality audit — embedding model / reranker / hybrid) — the parent quality theme; this seed is the chunking+table-searchability slice of it.
- **SEED-076** (filtered-vector recall at scale) — orthogonal *index/recall* concern; this seed is *content coverage* (are the right things even embedded) + *boundary context*, the layer above.
- **SEED-048 → Phase 111.1** (embeddings provider flexibility) — the re-embed lifecycle this seed piggybacks on; both touch the embed path and share the re-embed landmine.
- **SEED-069** (living-document workflow output reingestion) — adjacent reingestion theme.
- **SEED-005 → v3.0 Document Management** (the active milestone) — richer metadata + virtual folders make retrieval the primary surface, raising the value of closing the table gap.

## Links

`backend/app/services/embedding_service.py:10-91` (recursive splitter) ·
`backend/app/services/multimodal_service.py:181-241` (tables — extract-then-stop), `:368-521,458-507` (images — extract-embed-store, the template for the table fix), `:546` (query_tables) ·
`backend/app/api/documents.py:1378,1386-1417,1415,1469-1477` (chunk call site, context-header enrichment, gapless chunk_index) ·
`backend/app/services/retrieval_service.py:25-320` (hybrid retrieval, no neighbor expansion) ·
`backend/app/services/agent_loop.py:482,526,664-694` (read_document discouraged; thresholds) ·
`backend/app/config.py:785-786` (chunk defaults) · `supabase/full-schema.sql:103,120-137,388-397` (search RPCs read only document_chunks) ·
investigation: workflow `wf_9146d744-2f2`

---
*Planted 2026-06-15 during the Phase 111 plan-phase conversation. A 5-agent read-only assessment confirmed the recursive chunker is sound and images are searchable, but found PDF/DOCX-extracted tables are written to `document_tables` and never embedded → invisible to `search_documents` (the operator's exact worry). Deferred per the operator's no-break / not-now posture; the table fix and neighbor-expansion are the cheap/additive first moves to fold into the next re-embed pass (Phase 111.1).*
