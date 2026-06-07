---
seed_id: SEED-060
title: Structure-aware chunking for tabular/structured files — header propagation, readable chunk context, and a row-level query path for CSV/XLSX
status: planted
planted: 2026-06-06
phase_origin: assessment session 2026-06-06 (live hybrid-search UAT, thread "DOC0056 Ownership and Keywords" f23b00af)
category: Tracks A/B/D = B (small gap, surfaces via triggers, operator decides); Track C = C (post-production planned update — operator directive 2026-06-07)
related_seeds: [SEED-027, SEED-020, SEED-059, SEED-021, SEED-006]
relates_to:
  - "`backend/app/api/documents.py:296-299` — CSV → flat TSV text, structure discarded (I1)"
  - "`backend/app/api/documents.py:279-294` — XLSX → same flatten shape (I1)"
  - "`backend/app/services/embedding_service.py:10-91` — `chunk_text` prose separators; character-based overlap can START a chunk mid-row (I3) despite the docstring claim"
  - "`backend/app/api/documents.py:1386-1401` — context header is doc-level only (filename/title/date/type) and EMBED-ONLY; stored content stays raw, so the LLM never sees even that (I2)"
  - "`backend/app/services/multimodal_service.py` — `document_tables` pipeline is PDF-born; CSV/XLSX (100%-table files) never reach it, so `query_tables` is blind to them (I4, D-069-02)"
  - ".planning/research/rag-architecture-assessment-2026-06-06.md — full forensics; article pillar map"
re_open_triggers:
  - v2.9 `/gsd:new-milestone` sweep (surface as candidate REQ-ID)
  - Any user complaint about Q&A over a CSV/XLSX/structured file — wrong column attribution, "field not specified" answers about data that exists, or row lookups that fail
  - SEED-027 opens (tables→chunks Track A) — Track D below should ship in the same phase folder
  - SEED-020 retrieval-quality audit opens — tabular-query slice must be in the bench
priority: high
suggested_phase: |
  v2.9 sweep candidate — natural pairing with SEED-027 Track A as one
  "structured-content reachability" phase. Tracks A+B are small ingestion lifts;
  Track C (per-chunk metadata / hypothetical questions) is gated on SEED-020
  bench infra (measure before building — it's the heaviest article pillar).
  Re-ingestion note: fixes apply to NEW uploads; existing docs need /reingest
  (lazy backfill per SEED-027's recommendation).
---

# SEED-060 — Structure-aware chunking for tabular/structured files

## The live evidence (2026-06-06)

`rag_corpus_documents.csv` ingested → 220 chunks. The agent retrieved the EXACT
chunk holding DOC0056's row (turn 1) and still couldn't answer "who owns it":
the row reads `…internal_doc  en  5  188  2  94.0  …  highly_restricted
text-embedding-3-small  product  product_index_v2  troubleshooting, steps…` —
19 anonymous tab-separated values. `owner_team=product` was IN CONTEXT and
unreadable, because the column header row exists only in chunk 0. One turn later
the model declared the owner "not specified" — a confidently-wrong answer about
data the system had already retrieved.

Counter-proof that headers fix it: in the DOC0065 exchange, chunk 0 (the header
row) happened to enter context via an unrelated vector hit, and the model then
mapped every column correctly (n_tokens=1844, owner=engineering — exact ground
truth, zero hallucination).

## The four mechanics

- **I1 — headerless tabular chunks.** CSV/XLSX flatten to TSV text; the generic
  chunker slices it; chunks 1..N carry no schema. Data becomes write-only.
- **I2 — context enrichment is doc-level + embed-only.** The
  `[Document | Title | Date | Type]` header is prepended only to the text being
  EMBEDDED; the stored `content` the LLM reads is raw. Even a perfect schema
  header added here would be invisible at answer time. Any fix must enrich the
  STORED content (or inject context at retrieval time).
- **I3 — overlap slices mid-row.** Character-based overlap carry-over means a
  tabular chunk can open with the tail of the previous row (observed: chunk 18
  starts mid-DOC0054). The `chunk_text` docstring claims rows aren't split
  mid-row — true for the split step, false after overlap.
- **I4 — no row-level query path.** PDF tables get `document_tables` +
  `query_tables`; CSV/XLSX — files that ARE tables — get neither. The agent's
  `query_documents` SQL tool sees only doc-level metadata, so its sensible
  "look up the owner column" instinct had nothing to query.

## Tracks

### Track A — Header propagation for tabular chunks (quick win)

At ingest, when MIME is CSV/XLSX: detect the header row and prepend it (plus
`[File: x.csv | Sheet: y | rows N–M]`) to EVERY stored chunk. Row-aligned chunk
boundaries (split on row count, never characters; no mid-row overlap — overlap
by repeating the last K rows if needed). Fixes I1+I2+I3 for tabular files in one
move. No schema change; new uploads only + `/reingest` backfill.

### Track B — Rows as records (alternative/complement to A)

Render each row as a compact record (`doc_id: DOC0056 | owner_team: product |
top_keywords: …`) — markdown or key:value lines — batching ~10-30 rows per chunk.
Self-describing chunks; better lexical hits on column names; slightly larger
storage. Bench A vs B on retrieval + answer accuracy before choosing.

### Track C — Per-chunk metadata / contextual retrieval (Category C — POST-PRODUCTION planned update)

The published framework's "Metadata Creation" layer (per-chunk summaries,
keywords, hypothetical questions + question-to-question matching) AND the
Modular-Agent synthesis's **Contextual Retrieval** variant: pass parent doc +
chunk to an LLM at ingest, prepend the generated context to the chunk before
embedding AND before FTS indexing (contextual BM25). Published numbers:
−35% retrieval failures (contextual embeddings), −49% (+ contextual BM25),
−67% (+ reranking); prompt caching makes ingest cost viable (~90% token
savings on the repeated parent doc).

Why it waits (operator directive 2026-06-07): re-embeds + re-indexes the
entire KB, adds per-chunk LLM spend at ingest, and the published deltas are
unproven on OUR corpus. DO NOT build pre-production; requires SEED-020 bench
infra / v3.0 eval tables to measure first. Note Tracks A/B are the cheap
deterministic subset of this idea for tabular files specifically (a static
header IS the chunk context for a CSV row — no LLM needed).

### Track D — CSV/XLSX → `document_tables` (row-level relational path)

Ingest spreadsheet sheets/CSVs into `document_tables` so `query_tables` covers
them — giving the agent the relational query the article's Hybrid-DB pillar
prescribes ("precise relational filtering"). Ships naturally with SEED-027
Track A (same pipeline, same backfill story).

## What this is NOT

- **Not** the retrieval-ranking problem — even perfect ranking returns unreadable
  rows without this seed; that's SEED-059 (the two seeds are independent and
  compounding: the live test needed BOTH to fail to produce the wrong answer).
- **Not** PDF table extraction quality — that's SEED-021/SEED-022 upstream.
- **Not** an embedding-model change — SEED-020.

## Vibe-coder plain summary

The CSV got chopped into 220 pieces, but only piece #0 contains the column
names. So when the AI fetched the exact right piece with the answer in it, it
saw a row of naked values — like reading a spreadsheet row with the header
hidden — and couldn't tell which value meant "owner team." It even told you the
owner "isn't specified" while the answer sat in its context. Fix: when we ingest
spreadsheet-like files, stamp the column names onto every piece (and/or store
each row as labeled "field: value" records), and let the agent's table-query
tool see CSVs too. Cheap, no schema change, applies on re-upload.
