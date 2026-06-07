---
seed_id: SEED-027
title: Tables-in-retrieval + multimodal chat injection — close the "table content extracted but invisible to RAG" gap, and add vision-block injection for image-page chunks
status: planted
planted: 2026-05-18
phase_origin: 074-seed-009-seed-011-polish-bundle (user-flagged 2026-05-18 between phases — "we have images tables and tables table that are stored during ingestion, how is it actually injected into the context? are they being included in the chunks retrieved or is it being already stored as chunks?")
related_seeds: [SEED-006, SEED-020, SEED-021, SEED-059, SEED-060]
relates_to:
  - `backend/app/services/multimodal_service.py:181-242` — `extract_and_store_tables()` writes rows to `document_tables` ONLY; no `document_chunks` insert, no embedding column on `document_tables`
  - `backend/app/services/multimodal_service.py:368-521` — `extract_and_store_images()` writes rows to `document_images` AND embeds `[Image p.X]: {description}` as separate `document_chunks` rows. So images ARE in retrieval (via description text); tables are NOT
  - `backend/app/services/multimodal_service.py:546-613` — `query_tables()` LLM tool that queries `document_tables` on demand — current sole path for table content to reach the model
  - `backend/app/services/retrieval_service.py:236-305` — `search_documents()` queries `document_chunks` only; never reads `document_images` or `document_tables` directly
  - `backend/app/services/openai_service.py` + `anthropic_service.py` — build text-only content blocks; raw `b64_png` from image extraction is intentionally NOT stored (multimodal_service.py:446 comment "b64_png intentionally NOT stored")
  - `supabase/full-schema.sql` — `document_chunks` has 1536d `embedding` column; `document_images` and `document_tables` do NOT have embedding columns
  - SEED-020 (Retrieval Quality Audit) — about embedding model + re-ranker + RRF tuning. This seed is about WHAT enters the retrieval index in the first place — orthogonal but should be benched together
  - SEED-006 (Multimodal Extraction Quality) — about extraction recall. This seed picks up where extraction leaves off — once content is in the DB, this seed makes it reachable

re_open_triggers:
  - Any user retrieval-quality complaint where the relevant content is in a TABLE — e.g., "I asked about the values in figure 3.2 and the assistant didn't see them" when figure 3.2 is a stored table in `document_tables`. The agent can theoretically invoke `query_tables` but the standard vector path will miss table rows entirely.
  - When SEED-020 (Retrieval Quality Audit) opens — the bench has to include a "tables-as-chunks vs tables-as-tool" comparison or the audit is incomplete
  - When operating on a vision-capable model (Claude Opus 4.7, Sonnet 4.6, GPT-5.x, Gemini 2.5+) and a query references content stored as an image — the model should be receiving the image as a multimodal content block, not just the OCR/vision-description chunk
  - When v2.6 closes and v2.7 (Agent Workspace / Knowledge Quality) opens — retrieval correctness is the headline v2.7 concern
  - Before any production rollout where customers will judge answer quality (Phase 080 VPS runbook context) — table-blindness is a visible quality bug

priority: high
suggested_phase: |
  Two-track strategy:
  1. **Quick win — fold into Phase 075 or new Phase 076.5** — track A only: add a `tables_to_chunks` step at ingestion time that renders each `document_tables` row as a structured markdown block (`Table p.X t.Y: headers | rows...` or LLM-generated 1-2 sentence summary + headers) and inserts it as a `document_chunks` row. Mirrors the existing `[Image p.X]: {description}` pattern that already works. Low-risk lift, big retrieval-quality win for content already in the DB. Estimated 1 plan.
  2. **Full lift — dedicated v2.7 phase** — track B: multimodal chat injection. When chat is on a vision-capable model AND retrieved chunks reference image pages (via the `[Image p.X]:` prefix), look up the corresponding `document_images` row, fetch/regenerate the b64_png, and attach as an `{type: "image_url"}` content block. Requires: (a) decide whether to re-store b64_png or regenerate from source PDF on-demand, (b) cost-control for token usage on vision blocks, (c) per-model capability gate (similar to Phase 074's `max_output_tokens` registry — add a `vision: bool` field). Estimated 2-3 plans.
---

# SEED-027 — Tables-in-retrieval + multimodal chat injection

## What this seed exists to close

Phase 071.3 (camelot table engine) extracted 214 tables from the thesis
PDF. Phase 072 (Multimodal Lift) extracted images at scale. **Then both
got buried.**

Investigation 2026-05-18 (Explore agent) confirmed:

| Content | In `document_chunks` (vector-searchable)? | In retrieval at chat time? | Sent as multimodal block to vision model? |
|---|---|---|---|
| Text | ✅ Yes | ✅ Yes | n/a |
| Images | ✅ Yes — `[Image p.X]: {description}` text chunk | ✅ Yes | ❌ No — text description only |
| Tables | ❌ No — only in `document_tables` | ❌ No — only via explicit `query_tables` tool call | ❌ No |

So the standard RAG path is **blind to tables entirely** unless the agent
knows to invoke the `query_tables` tool. And images reach the model as
their text description only — even on Claude Opus 4.7 / Sonnet 4.6 / GPT-5.x
/ Gemini 2.5+, which natively accept image content blocks.

**2026-06-06 addendum (assessment session):** the inverse gap also exists —
CSV/XLSX files (which ARE tables) never reach `document_tables` at all; they
flow through `documents.py::extract_text` into flat headerless text chunks
(D-069-02), so `query_tables` can't see them either. Live evidence: the
DOC0056 thread forensics in
`.planning/research/rag-architecture-assessment-2026-06-06.md`. That side is
tracked as **SEED-060** (Track D proposes CSV/XLSX → `document_tables`, which
should ship in the same phase folder as this seed's Track A — same pipeline,
same backfill story). SEED-059 covers the retrieval-side keyword-leg mechanics
the same session surfaced.

## Scope — two tracks

### Track A — Tables → chunks at ingestion (quick win)

**Goal:** Render each `document_tables` row as a structured text chunk and
insert into `document_chunks` so vector + BM25 search picks it up the same
way image descriptions already do.

**Implementation sketch:**

1. In `multimodal_service.py::extract_and_store_tables()` (lines 181-242),
   after writing the row to `document_tables`, also build a markdown-flavored
   text representation and insert into `document_chunks`:
   ```
   [Table p.{page} t.{table_index}]: {extractor=camelot/pdfplumber/etc}
   Headers: {pipe-separated headers}
   Rows: {first N rows pipe-separated, or full table if <2KB}
   ```
2. Embed the text via the same embedding model used for image descriptions
3. Mirror the existing `[Image p.X]:` chunk prefix convention so retrieval-
   side metadata extraction stays consistent

**Backfill question:** Existing documents in production already have tables
in `document_tables` but no corresponding chunks. Should the migration:
- (a) one-shot backfill at deploy time — slow but complete
- (b) lazy backfill at next `/reingest` — naturally bounded but partial
- (c) explicit operator-driven backfill via admin endpoint — safest
Recommend (b) with operator-driven hook for explicit catch-up.

**Edge case:** Very large tables (1000+ rows). Don't embed the full table
content — embed a header + first-N-rows + LLM-generated summary, store
full table content as a fallback for `query_tables` tool use.

**Migration touch:** No schema change required — `document_chunks` already
accepts arbitrary text. New chunks naturally get a different prefix.

### Track B — Multimodal chat injection for vision-capable models

**Goal:** When chat is on a vision-capable model AND a retrieved chunk
references an image page, attach the actual image as a content block.

**Implementation sketch:**

1. Extend `MODEL_CAPABILITIES` registry (Phase 074 pattern) with `vision:
   bool` field per model — research the per-model truth as of plan time
2. At chat-time, after retrieval, inspect each chunk for the `[Image p.X]:`
   prefix → look up the corresponding `document_images` row → fetch/regenerate
   the b64_png
3. Pass image as `{type: "image_url"}` content block alongside the text
   chunks for vision-capable models
4. For text-only models: skip — text description chunk is already present
5. Decide: re-store b64_png at ingestion time (storage cost, fast retrieval)
   or regenerate on-demand from source PDF (slower, no storage bloat). The
   current "b64_png intentionally NOT stored" comment in
   `multimodal_service.py:446` predates the chat injection use case; that
   decision deserves re-evaluation here.

**Cost considerations:**

- Vision blocks consume significant input tokens per image (~1K-2K per image
  at default detail). Cap at top-N image chunks per retrieval (likely 1-3
  for default; admin-configurable)
- Per-model token budget already exists from Phase 074 — extending to
  include vision token estimates is the natural reuse

**Cross-link with SEED-020:** When SEED-020 benches embedding models +
re-rankers, it should also bench "vision-block-included vs. text-only"
retrieval quality on a held-out eval set. The two seeds will likely share a
v2.7 phase folder.

## What this is NOT

- **Not** a multimodal embedding model swap. Track A uses the existing text
  embedder on a markdown rendering of the table. CLIP-style image embeddings
  would be Track C in a future phase and should be evaluated alongside
  SEED-020's embedding model bench
- **Not** OCR enhancement — content already exists in `document_tables`/
  `document_images` post-Phase 072. This seed is purely about reachability
- **Not** a `query_tables` tool deletion. The tool stays for cases where
  the agent wants to query specific tables. Track A makes tables visible to
  vector search; the tool stays for targeted column/row lookups

## Open questions for the eventual `/gsd:discuss-phase`

1. **Track A backfill mode** — see above; (b) + operator hook recommended
2. **Track B b64_png storage decision** — re-store vs regenerate
3. **Track B vision token cap** — per-retrieval cap and admin-configurability
4. **Track A large-table handling** — header+first-N vs LLM summary vs both
5. **Should Track A inherit RLS from `document_tables`?** Yes — the chunks
   table is already RLS'd; new rows automatically respect ownership
6. **`vision: bool` registry field — research scope** — needs the same
   2026-05-XX docs-verified pass that Phase 074 ran for `max_output_tokens`

## Cross-cutting touch — Phase 074 patterns

- The `MODEL_CAPABILITIES` registry extension pattern from Phase 074 (D-074-06)
  is the natural shape for the Track B `vision: bool` field. Same TypedDict,
  same registry, same `total=False` pass-through posture
- Phase 074's clamp-gate pattern (single chokepoint over a priority resolver)
  is reusable for the Track B vision-block cap (single chokepoint where image
  content blocks are appended, applies token budget there)
