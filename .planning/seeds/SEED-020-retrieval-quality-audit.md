---
seed_id: SEED-020
title: Retrieval Quality Audit — embedding model + re-ranker + hybrid retrieval
status: planted
planted: 2026-05-16
phase_origin: 071.3-docling-demotion-table-engine-full-rip
related_seeds: [SEED-006, SEED-019, SEED-021]
re_open_trigger: |
  Either of these (whichever fires first) per D-071.3-14:
  1. User reports a retrieval-quality complaint — e.g., chat returns wrong or
     irrelevant chunks for a clear query, verifiable via specific failing
     query examples. Concrete signal: a `query_documents` / hybrid-search call
     returns top-N chunks that demonstrably miss the obviously-relevant
     section of an ingested document.
  2. v2.7 milestone opens (proactive audit before next major milestone —
     regardless of complaints).
suggested_phase: post-v2.6 (likely early v2.7 — paired with Agent Workspace
  or as a dedicated retrieval phase)
---

## Why this seed exists

Phase 071.3 fixed the **extraction-quality bottleneck** (4 tables → 214 raw on
the thesis after the camelot swap; chunks landed at 461 vs the pre-046
baseline of ~443). Once raw text + tables + images are in the database, the
**next quality bottleneck is RETRIEVAL** — choosing which chunks to surface
to the LLM for a given user query.

The current retrieval stack (as of Phase 071.3 close):

- **Embedding model:** `text-embedding-3-small` (OpenAI) by default — read at
  runtime from `app_settings.embedding_model_name` / `user_settings`
- **Re-ranker:** none. The hybrid search (vector + BM25) returns top-N by
  RRF fusion, no cross-encoder or LLM re-rank pass
- **Hybrid retrieval:** BM25 (Postgres `tsvector`) + dense vector (pgvector
  cosine), fused via RRF (Reciprocal Rank Fusion) — wired in
  `backend/app/services/retrieval/hybrid_search.py`

This is fine for current scale but never empirically benchmarked against
alternatives. With Phase 071.3 putting much more high-quality content into
the index (per-aspect dispatcher + camelot + zip_xpath), the retrieval layer
becomes the next visible bottleneck for chat answer quality.

### D-071.3-15 audit scope

#### 1. Embedding model bench

Compare the current default vs:

- **BGE-M3** (BAAI) — multilingual, multi-functionality (dense + sparse +
  multi-vector in one model); open-weight, runs locally on CPU or GPU
- **voyage-2 / voyage-3** (Voyage AI) — commercial, strong domain
  retrieval benchmarks
- **nomic-embed-text** (Nomic) — fully open + local-OK, MIT license,
  Matryoshka-trained for variable dimension
- **Cohere embed-v3** (Cohere) — commercial, multilingual, strong on
  zero-shot retrieval benchmarks

Benchmark methodology:

- Fixed query set of ~30-50 representative chat queries against the user's
  KB (academic theses, technical PDFs, DOCX notes)
- Golden top-N chunks labeled by human review for each query
- Metrics: top-1 hit rate, top-3 hit rate, top-5 hit rate, MRR (mean
  reciprocal rank), NDCG@10
- Cost: API spend per 1M tokens for embedding + storage delta (different
  dimensions → different `document_chunks.embedding` size)

#### 2. Re-ranker integration

Evaluate adding a re-rank stage between retrieval and LLM context injection:

- **Cross-encoder** (sentence-transformers/ms-marco-MiniLM-L-6-v2,
  ms-marco-MiniLM-L-12-v2, bge-reranker-large) — open-weight,
  runs locally on CPU, ~50-200ms per 100 candidates
- **Cohere Rerank** (commercial) — high quality, ~$1/1k requests,
  ~100-300ms per request
- **Voyage Rerank** (commercial) — similar shape to Cohere

Benchmark methodology:

- Retrieve top-50 candidates with current hybrid search
- Re-rank to top-10
- Compare LLM answer quality (BLEU / ROUGE / LLM-judge on a fixed eval set)
  with and without the re-rank step

#### 3. Hybrid retrieval architecture tuning

Current stack: BM25 sparse + dense vector, fused via RRF (k=60).

Investigate:

- **RRF k parameter tuning** — k=60 is the conventional default, but
  problem-specific tuning (k in [10, 100]) sometimes moves the needle
- **Weighted score fusion** vs RRF — sparse-weight α in [0.1, 0.9],
  benchmarked on the same query set
- **Hybrid retrieval with table-aware boost** — boost chunks adjacent to
  `document_tables` rows for queries that look table-shaped (numeric
  filters, "where X is", "what is the value of")
- **Chunking strategy interaction** — Phase 32.5 chunking shipped a
  semantic chunker; measure retrieval recall against camelot-extracted
  tables specifically (do table-row queries miss the markdown body or the
  table itself?)

## Future-phase success criteria template

- [ ] At least 2 retrieval configs benched on a fixed query set + golden
      answers
- [ ] Best config beats the current baseline by >= 15% on top-3 hit rate
      (or >= 0.05 MRR delta)
- [ ] Production deployment with rollback path (admin UI / settings toggle
      to revert to the prior config without DB migration)
- [ ] Cost analysis (embedding API spend, re-ranker latency, storage delta
      from different embedding dimensions)
- [ ] User-facing answer-quality delta validated on a fixed query set
      (LLM-judge or manual review)

## Related work

- **Phase 071.3** (this phase): extraction quality lift — closed 2026-05-16
- **SEED-006**: multimodal extraction quality (planted) — image recall gap
  feeds into retrieval recall on figure-bearing questions
- **SEED-019**: PyMuPDF subprocess OOM + non-Docling engine eval — closed
  2026-05-16 (superseded by Phase 071.3)
- **SEED-021**: table/image recall lift (planted at 071.3 close) — addresses
  the remaining recall gap on the *extraction* side; SEED-020 addresses
  the *retrieval* side downstream

## Vibe-coder plain summary

Phase 071.3 fixed how the system pulls tables and images OUT of documents.
What it didn't touch: when you ask a question in chat, how does the system
*choose* which chunks of those documents to feed the AI as context? That's
retrieval. The current setup mixes keyword search (BM25) and AI-vector
similarity (pgvector) into a top-N list — solid baseline but never
A/B-tested against alternatives. SEED-020 is the reminder that *next time
chat starts returning irrelevant answers*, the fix probably lives in this
retrieval layer (embedding model, re-ranker, fusion tuning), not in the
extraction layer. Don't conflate the two.
