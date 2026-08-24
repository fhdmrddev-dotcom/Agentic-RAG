---
seed_id: SEED-197
title: embed_texts sends every chunk of a document in ONE request with no batching — pre-existing, and Phase 202's table chunks are the first path that can plausibly exceed the provider cap
created: 2026-08-24
planted_during: Post-execution review of Phases 202 and 203 (unattended, operator away)
status: planted
folded_into: null
surface: Agentic-RAG
severity: minor            # No known live failure. This is a CEILING, not a defect.
relates_to:
  - `backend/app/services/openai_service.py:1932` — `embed_texts`, the single embedding call.
  - `backend/app/services/embedding_service.py:112` — `embed_chunks`, which delegates to it.
  - `backend/app/services/multimodal_service.py:322` — `embed_and_store_table_chunks` (Phase 202),
    the new caller that changes the arithmetic.
  - Phase 201 — CSV/Excel table extraction, which is what makes a very wide table population real.
trigger_when: >
  A document ingestion fails at the embedding step with a provider 400 mentioning an input/array
  limit, OR any phase adds a second high-fan-out embedding caller, OR a real CSV/Excel upload in
  this product is measured to produce more than ~1,500 table chunks. Whichever comes first.
---

# SEED-197: `embed_texts` has no batching, and Phase 202 is the first caller that can reach the ceiling

## What was measured

`embed_texts` (`openai_service.py:1932-1943`) is nine lines and passes its whole `texts` list
straight into one `client.embeddings.create(input=texts)` call. There is no chunking of the request,
no cap, and no retry-on-too-large.

```python
response = client.embeddings.create(
    model=effective_model,
    input=texts,           # <- the ENTIRE list, however long
)
```

## ⚠ This is PRE-EXISTING and Phase 202 did not introduce it — that distinction is the point

The main text path has always used it (`embed_chunks` → `embed_texts`), so every large document
already carried this exposure. **Phase 202 is not a regression and must not be recorded as one.**

What 202 changes is the *arithmetic*, and only in combination with Phase 201:

- `TABLE_CHUNK_MAX_ROWS` batches a table into chunks of 25 rows.
- 201 made CSV and Excel files produce `document_tables` rows for the first time.
- A spreadsheet is the one document type whose row count is unbounded by prose length. A CSV of
  50,000 rows becomes ~2,000 table chunks in a single `embed_and_store_table_chunks` call.
- OpenAI's embeddings endpoint accepts at most **2048 inputs per request**. So the ceiling is
  reachable by an ordinary large spreadsheet, where before it needed an implausibly large document.

## Why it was NOT fixed on the spot

Batching `embed_texts` changes the shared ingestion path for **every** document type in the product,
which is well outside the scope of a review of two phases — and the review was running unattended.
It is also not urgent: no live failure is known, and the failure mode when it does arrive is a loud
provider 400 at the embedding step, not silent data loss.

⚠ **The one thing that WOULD make it silent** is worth recording next to it, because the two would
compound. `embed_and_store_table_chunks` ends with:

```python
for i, (chunk_text, embedding) in enumerate(zip(all_table_chunks, embeddings))
```

`zip` stops at the shorter sequence. If a provider ever returned fewer embeddings than inputs, the
surplus chunks would be **dropped without an error** and the document would look fully ingested.
Today nothing produces that state, so this is a latent pairing, not a bug — but a `len()` assertion
before the `zip` is a one-line insurance policy for whoever takes this seed.

## What "taking this seed" looks like

1. Batch inside `embed_texts` (e.g. 512 inputs per request), so every caller inherits the fix and no
   call site has to know the provider's limit. **One home for the concern** — the same reason
   Phase 203's attachment bounds were put in the service rather than at the call site.
2. Assert `len(embeddings) == len(texts)` before pairing, in `embed_and_store_table_chunks` and in
   any sibling that zips the two.
3. Bound the table-chunk count per document, or record deliberately that it is unbounded.

## Related

- `SEED-149` / `SEED-060` — the tabular ingestion seeds 201 and 202 answered.
- `docs/HOT-FILE-LEDGER.md` — `backend/app/services/multimodal_service.py` has no row and is now
  carrying two phases' worth of new surface (201 + 202). Worth a row at its next edit.
