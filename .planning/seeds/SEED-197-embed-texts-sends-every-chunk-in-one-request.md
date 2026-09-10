---
seed_id: SEED-197
title: embed_texts sends every chunk of a document in ONE request with no batching — pre-existing, and Phase 202's table chunks are the first path that can plausibly exceed the provider cap
created: 2026-08-24
planted_during: Post-execution review of Phases 202 and 203 (unattended, operator away)
status: planted            # ⛔ DELIBERATELY still `planted` — Phase 241 REMOVED an exposure, it did not fix the ceiling. See the 2026-09-10 note at the end of this file.
folded_into: 241           # folded by the ROADMAP; the fold was answered by REMOVING the new exposure (D-08), not by batching embed_texts
answered: 2026-09-10
answered_by: "Phase 241 (QUEUE-06) — D-08: the bench corpus perturbs real embeddings, so no bench path calls embed_texts at all"
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

---

## ⚠ ANSWERED 2026-09-10 — Phase 241 REMOVED THE EXPOSURE. IT DID NOT FIX THE CEILING.

**`status:` stays `planted` on purpose, and reading it as closed would be the mistake this note
exists to prevent.** The ROADMAP folded this seed into Phase 241 because that phase builds a
synthetic corpus at scale, and a naive builder would embed hundreds of thousands of strings —
the single highest-fan-out `embed_texts` caller this product would ever have had.

**Phase 241 removed that exposure by construction rather than by fixing the batching** (D-08):

- The bench corpus is built by **perturbing the 7,959 real embeddings already in the database**,
  never by embedding anything. Verified in the shipped builder:
  `grep -v '^\s*#' scripts/build-recall-bench.py | grep -c "embed_texts"` → **0**, and the
  build report records **`provider_calls: 0`**.
- The measurement harness's ONE embedding call is the ten evaluation probe strings, made **once**
  and cached at `.planning/phases/241-recall-at-corpus-scale/reports/probe-vectors.json` — reused
  by all 26 runs of the phase. Ten inputs is four orders of magnitude below the 2048-input cap.

⛔ **`embed_texts` still has no batching, no cap and no retry-on-too-large.** Nothing about
`openai_service.py` or `embedding_service.py` changed. **This seed's own trigger is intact and
unmodified:** a document ingestion failing at the embedding step with a provider 400 mentioning an
input/array limit, OR any phase adding a second high-fan-out embedding caller, OR a real CSV/Excel
upload measured to produce more than ~1,500 table chunks.

⭐ **Removing an exposure is a legitimate answer to a fold and it is cheaper than fixing a ceiling
nobody has hit — but it must be written down as what it is.** A seed marked closed because the
phase that folded it decided not to go near it is a deletion wearing a decision's clothes.

⚠ **One thing Phase 241 makes MORE likely, not less.** Its verdict recommends raising
`hnsw.ef_search`, which is a *query*-side setting and touches nothing here. But the same phase
measured the per-chunk storage basis (≈24.6 KB/chunk) that makes large-corpus onboarding
concretely sizeable — and bulk onboarding is exactly the path that would add the second
high-fan-out embedding caller this seed's trigger names.
