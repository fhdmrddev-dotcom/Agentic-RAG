---
seed_id: SEED-059
title: Keyword-leg semantics + exact-identifier retrieval robustness — AND-death, RRF tie-break, and zero-hit recovery
status: planted
planted: 2026-06-06
phase_origin: assessment session 2026-06-06 (live hybrid-search UAT, thread "DOC0056 Ownership and Keywords" f23b00af)
related_seeds: [SEED-020, SEED-027, SEED-060]
relates_to:
  - "`supabase` SQL fn `keyword_search_chunks` — `plainto_tsquery('english', search_query)` ANDs every term (R1)"
  - "`backend/app/services/retrieval_service.py:74-102` — `_rrf_fuse` insertion-order tie-break favors the vector leg at equal weights (R2)"
  - "`backend/app/services/retrieval_service.py:237-305` — `search_documents` has no zero-lexical-hit recovery path (R3)"
  - "`backend/app/services/retrieval_service.py:123` — enriched `similarity` field silently mixes cosine and rrf_score units (cosmetic)"
  - ".planning/research/rag-architecture-assessment-2026-06-06.md — full forensics + live RPC reproduction"
re_open_triggers:
  - v2.9 `/gsd:new-milestone` sweep (surface as candidate REQ-ID)
  - Phase 096 discuss-phase — the eval fixture set MUST include exact-identifier rows (bare ID, ID+intent-words, row-attribute Q&A); this seed donates them
  - Any user retrieval complaint where the query contains an exact identifier (doc ID, SKU, ticket number, invoice number) and search returns unrelated chunks
  - SEED-020 retrieval-quality audit opens — R1/R2/R3 are in-scope line items there
category: B — small gap, surfaces via triggers; operator decides at trigger time (document-only directive 2026-06-07)
priority: high (cheap, provider-agnostic, measured-fix-ready once eval rows exist)
suggested_phase: |
  Two-step — both steps are CANDIDATES, never obligations (operator directive
  2026-06-07: document, don't enforce):
  1. **Phase 096 (discussion already in progress):** this seed DONATES candidate
     eval rows if the operator wants them — (a) bare-ID lookup, (b) ID+intent-words
     ("DOC0056 owner team"), (c) row-attribute answer correctness vs CSV ground
     truth. No fix; rows would pin current behavior. If 096 declines, the rows
     wait for SEED-020's audit.
  2. **Post-eval quick win (v2.9 sweep or later, operator-scheduled):** the actual
     fix — see options below — verified green against eval rows. Single
     SQL-function migration + small service-layer change; Deep/provider paths
     untouched (retrieval is shared but provider-agnostic by construction).
---

# SEED-059 — Keyword-leg semantics + exact-identifier retrieval robustness

## The live evidence (2026-06-06, all reproduced against local DB)

KB doc `rag_corpus_documents.csv` (220 chunks). Ground truth: DOC0056 row lives in
chunk 18, DOC0065 row in chunk 21. Settings: hybrid ON, rerank OFF, weights 1.0/1.0.

| Query | `keyword_search_chunks` result |
|---|---|
| `DOC0056` | ✅ chunk 18, rank 1 — **the lexical leg is the exact-match workhorse** |
| `DOC0056 department owner author` | ❌ **0 rows** |
| `DOC0065` | ✅ chunk 21, rank 1 |
| `DOC0065 n_tokens` | ❌ **0 rows** |

The agent's turn-1 bare-ID query retrieved the right chunk (answered keywords
correctly). Its turn-2/3/4 decorated queries lost the chunk entirely → wrong guess
("support area"; truth `product`), then a confident "owner team is not specified."
Full trace: `.planning/research/rag-architecture-assessment-2026-06-06.md`.

## The three mechanics

### R1 — `plainto_tsquery` AND-semantics

`tsq := plainto_tsquery('english', search_query)` → `doc0056 & department & owner
& author`. A chunk containing the identifier but not the intent words (which live
only in the CSV header chunk) is unfindable. The lexical leg dies precisely on the
query shape agents naturally produce (entity + asked-about attribute).

### R2 — RRF tie-break buries exact hits

`_rrf_fuse`: keyword-rank-1 scores `1/(60+1)`; vector-rank-1 scores the same; dict
insertion order (vector iterated first) wins the stable sort. An EXACT identifier
match — the strongest possible relevance signal — ranks below a 0.47-cosine fuzzy
neighbor. With rerank OFF (current default) nothing downstream corrects this.

### R3 — zero-hit lexical leg is silent

`search_documents` proceeds on vector-only results without any signal that the
lexical leg returned nothing, and neither tool description nor system prompt
nudges the model to retry with the bare rare token. (The model in the live test
only recovered because the user told it to re-search.)

## Fix options (bench against eval rows before choosing)

1. **`websearch_to_tsquery`** — supports `OR`, quoted phrases; still ANDs plain
   terms. Mild gain alone; best paired with (2) or (3).
2. **Two-pass lexical leg** — run AND; on 0 rows, re-run with OR
   (`to_tsquery` join `|`). One SQL-function change, fully backward-compatible.
3. **Rare-token fallback in the service** — on 0 lexical rows, extract the
   rarest/longest non-stopword token (or regex `[A-Z]{2,}\d+`-shaped identifiers)
   and re-run the lexical leg with just that.
4. **Exact-match boost** — when a keyword-leg row's content contains the query
   token verbatim (or `ts_rank` is top-decile), bump its RRF weight or short-circuit
   it into slot 1. Directly fixes R2.
5. **Tie-break by keyword rank** — trivial: on equal RRF score prefer the
   keyword-leg row. Smallest possible R2 fix.
6. **Prompt/tool-description guidance** — document in the `search_documents` tool
   description: "for IDs/codes, search the bare identifier alone." Zero-risk,
   ships any time, also improves provider-agnostic behavior (R3).

## What this is NOT

- **Not** the embedding/re-ranker/fusion-constant audit — that's SEED-020 (this
  seed feeds it three concrete line items).
- **Not** the tabular-chunk readability problem — even with perfect retrieval the
  model couldn't name `owner_team` without the header row; that's SEED-060.
- **Not** provider-specific — the entire surface is `retrieval_service.py` + one
  SQL function; no provider gateway contact.

## Vibe-coder plain summary

When you search for an exact code like "DOC0056", the keyword half of hybrid
search finds the exact right chunk — great. But the moment the AI adds helpful
words to the search ("DOC0056 owner department"), Postgres requires ALL words to
appear in the same chunk, finds nothing, and the good half of search goes dark.
On top of that, when the keyword half DOES win, the ranking math treats its
perfect match as a tie with a mediocre fuzzy match and puts the fuzzy one first.
Fix is small (one database function + a retry rule), but write the eval tests
first (Phase 096) so we can prove the fix helps and nothing regresses.
