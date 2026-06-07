# RAG Architecture Assessment — Hybrid-Search Live UAT vs. Target Frameworks

**Date:** 2026-06-06 (forensics) / updated 2026-06-07 (second source + categorization)
**Type:** Assessment / enhancement documentation — **explicitly NOT an architecture mandate** (see §6 governance)
**Evidence base:** Live thread `f23b00af-8fbd-40a3-a749-43f3c63a5e2e` ("DOC0056 Ownership and Keywords") forensically traced against the local Supabase DB + retrieval code path + live RPC reproduction.
**Reference frameworks (2):**
1. Operator's published architecture — *"Architectural Framework for Scalable, Robust RAG"* (Fahed Mrad, LinkedIn): <https://www.linkedin.com/pulse/architectural-framework-scalable-robust-generation-rag-fahed-mrad-0it7f/>
2. Operator-curated synthesis — *"The Modular Agent: Architectures for Skill and Context Engineering"* (NotebookLM, 29 sources, 2026-06-03/04) — covers ingestion, contextual retrieval, advanced retrieval, agentic patterns, context engineering, security/sandboxing, frameworks.

**Governance directive (operator, 2026-06-07):** document and categorize only. No new architecture is to be built from this assessment pre-production. Big-change items are *post-production planned updates*; small gaps surface at the right phase via seed triggers and GSD touchpoints. Phase 096 discussion is already in progress — items below are *candidates* for that discussion, never obligations.

**Outputs:** SEED-059 (retrieval), SEED-060 (ingestion/chunking), SEED-061 (context engineering), SEED-062 (sandbox/agent security), SEED-020 update (trigger FIRED), SEED-027 update (cross-links).

---

## 1. The test

KB contains `rag_corpus_documents.csv` (document `0d6827af`, 220 chunks) — one row per synthetic document (DOC0001…), 19 columns including `owner_team`, `n_tokens`, `top_keywords`. User asked the agent (OpenAI-family model, Deep mode):

1. "who owns DOC0056 and what are they keywords"
2. "whihc department own this" / "I mean which owner team"
3. "how many n_tokens in this DOC0065"
4. "Can you search for DOC0065 by title or keywords instead of document ID?"

**Settings at test time (live `app_settings`):** `hybrid_search_enabled=True`, `rerank_enabled=False`, `vector_search_weight=1.0`, `keyword_search_weight=1.0`, `retrieval_top_k=5`, `hybrid_candidate_count=20`, `retrieval_match_threshold=0.3`, embeddings `text-embedding-3-small`.

**Ground truth (chunk contents, verified):**

| Entity | Lives in | Truth |
|---|---|---|
| DOC0056 | chunk 18 | title "How to steps — internal support article (AMER, 2021)", owner_team=**product**, keywords troubleshooting/steps/ticket/reset, security_tier=highly_restricted |
| DOC0065 | chunk 21 | title "Business performance review — Q3 2019", **n_tokens=1844**, owner_team=engineering, keywords segment/margin/revenue/cost |
| CSV header row | chunk 0 only | `doc_id  domain  title … owner_team  search_index  top_keywords` |

## 2. Turn-by-turn verdict

| Turn | Query the model issued | Keyword leg (reproduced live) | Outcome |
|---|---|---|---|
| 1 | `search_documents("DOC0056")` | **HIT — chunk 18, rank 1** | Right chunk retrieved (2nd after RRF). Model read title+keywords correctly but said owner "not exposed" — the value `product` was in context, **uninterpretable without the header row** |
| 2 | `search_documents("DOC0056 department owner author")` | **0 rows** (`plainto_tsquery` ANDs all terms) | Right chunk lost. Model guessed "support area" — **wrong** (truth: product) |
| 3 | `query_documents` SQL over `documents.metadata` | n/a — doc-level metadata can't see CSV rows | "Owner team not specified" — confidently wrong about data that exists |
| 4 | `search_documents("DOC0065 n_tokens")` | **0 rows** (AND semantics again) | "Can't find DOC0065". Vector leg *did* return chunk 0 (header row) — schema entered context |
| 5 | `search_documents("DOC0065")` (after user nudge) | **HIT — chunk 21, rank 1** | **Fully correct answer** (1844 / engineering / 4 keywords) — model could now map columns because chunk 0 (header) arrived in turn 4 |

**Verdict:** Hybrid search per se works — the lexical leg nails exact-ID lookups when the query is the bare token. The failures are (a) FTS AND-semantics killing the lexical leg the moment the model decorates the query with intent words, and (b) headerless tabular chunks making retrieved rows semantically unreadable. The model did NOT "search metadata only and give up" — its tool sequencing was reasonable; its sins were not retrying with the bare token and overclaiming "not specified."

## 3. Findings registry

### Retrieval gaps → SEED-059

- **R1 — `plainto_tsquery` AND-semantics brittleness.** `keyword_search_chunks` (SQL fn) builds `plainto_tsquery('english', q)`: every term ANDed. Any multi-word query mixing a rare identifier with intent words returns 0 lexical rows. Reproduced live: `'DOC0056'` → chunk 18; `'DOC0056 department owner author'` → ∅.
- **R2 — RRF tie disadvantages exact lexical hits.** With weights 1.0/1.0, keyword-rank-1 (the *exact* chunk) ties vector-rank-1 (a generic chunk at cosine 0.47); `_rrf_fuse` insertion order puts the vector row first. An exact-identifier match carries no boost over fuzzy semantic neighbors.
- **R3 — no recovery strategy.** Neither the tool layer nor the prompt guides a fallback (re-query with the rarest token / OR semantics) when the lexical leg returns 0. The model declared absence instead of degrading gracefully.

### Ingestion / structure-aware chunking gaps → SEED-060

- **I1 — headerless tabular chunks.** CSV extraction (`documents.py:296-299`) flattens to TSV text; XLSX (`:279-294`) same shape; generic `chunk_text()` slices it. Only chunk 0 carries the column header → every other chunk is N anonymous values per row. The model literally cannot know "column 17 = owner_team."
- **I2 — context enrichment is doc-level and embed-only.** `documents.py:1386-1401` prepends `[Document | Title | Date | Type]` to chunks **for embedding only**; stored content stays raw. No per-chunk structural context (column schema, section path), and even what exists never reaches the LLM's eyes at answer time.
- **I3 — overlap slices mid-row.** `chunk_text`'s overlap carry-over (`embedding_service.py:83`) is character-based, so tabular chunks can *start* mid-row (observed: chunk 18 opens with the tail of DOC0054's row) — despite the docstring claim "table rows are not split mid-row."
- **I4 — structured files never reach `document_tables`.** The PDF pipeline extracts tables into `document_tables` (SEED-027 territory); CSV/XLSX — *files that are 100% table* — flow through `extract_text` into text chunks only (D-069-02), so `query_tables` can't see them and no row-level relational querying exists.

### What worked (keep)

- **P1** — Hybrid fusion surfaced the right chunk for bare-ID queries; the keyword leg is precisely the exact-match workhorse it should be.
- **P2** — Two-tool strategy (`query_documents` SQL + `search_documents`) is the right shape; the doc-level metadata SQL tool just can't see *inside* structured files.
- **P3** — Final answers were grounded when the right chunks were in context (turn 5 exactly matches ground truth — zero hallucination of values).
- **P4** — Confidence scoring tracked reality (medium 0.46 → low 0.36 on the worst turn).

## 4. Cross-check vs. Source 1 (published framework pillars)

| Article pillar | Our state (2026-06-06) | Gap | Tracked in |
|---|---|---|---|
| **Restructuring layer** (parse semantic structures before processing) | PDF: per-aspect dispatcher + camelot (071.3). CSV/XLSX: flatten-to-text, structure discarded | Tabular structure lost at ingest (I1, I4) | SEED-060 |
| **Structure-aware chunking** (never sever semantic units; 256–512 tok) | `chunk_text` hierarchical separators — good for prose; blind to tabular/row semantics (I3) | Tabular chunker missing | SEED-060 |
| **Metadata creation** (per-chunk summaries, keywords, hypothetical questions, Q-to-Q matching) | Doc-level LLM metadata only; embed-only context header (I2). No per-chunk metadata, no hypothetical questions | Biggest article-vs-app delta; heavy lift, needs eval first | SEED-060 Track C (Cat C) |
| **Hybrid DB layer** (vector + relational synergy, pgvector) | ✅ Exactly our stack — pgvector + RRF + `query_documents` SQL tool | FTS semantics (R1), exact-match boost (R2), row-level relational access for structured files (I4) | SEED-059, SEED-060 |
| **Reasoning engine / planner / multi-agent** | ✅ v2.8 harness engine: locked phases, 5 phase types, `llm_batch_agents` fan-out, gates — shipped 089–095.1 | Largely AHEAD of the article | — (shipped) |
| **Validation & guardrails** (Gatekeeper / Auditor / Strategist) | Harness validation gates (091) for workflows; confidence scoring + disclaimers in chat. No groundedness "Auditor" on Deep-mode answers — turn-2's wrong "support area" guess is exactly what an Auditor catches | Answer-level groundedness check absent | Cat C (v3.0 eval tables era) |
| **Evaluation, stress testing, observability** | LangSmith wired; cross-provider eval harness exists for SSE/loop behavior; **no retrieval-quality eval set** | Retrieval eval fixtures missing — this session hand-produced what an eval should automate | Phase 096 candidates + SEED-020 |

## 5. Cross-check vs. Source 2 (Modular Agent synthesis, 7 topic areas)

| Synthesis topic | Our state (verified in code 2026-06-07) | Verdict | Tracked in |
|---|---|---|---|
| **1. Ingestion & parsing** (PDF→markdown, OCR/VLM for complex layouts) | Markdown-first extraction (Phase 069 dispatcher, `full_markdown` stored); multimodal image descriptions (072); table extraction camelot (071.3). VLM-grade figure recall still ~5% (SEED-006) | Mostly covered; known extraction-recall seeds remain | SEED-006 / 021 / 022 (existing) |
| **1b. Chunking strategies** (recursive / semantic / document-based) | `chunk_text` = recursive with markdown-header priority (recursive + document-based hybrid). Semantic chunking: not implemented. Tabular: gap I1/I3 | Prose chunking adequate; tabular gap is the live-proven hole | SEED-060 |
| **2. Contextual retrieval** (per-chunk LLM-generated context prepended before embedding; −35% retrieval failures, −49% w/ contextual BM25, −67% w/ rerank; prompt caching to afford it) | Static doc-level header, embed-only (I2). No per-chunk LLM context, no contextual BM25 (the `search_vector` indexes raw content), no prompt-cache ingestion path | **Largest Source-2 delta.** Big change: re-embed + re-index entire KB, LLM cost per chunk at ingest | SEED-060 Track C — **Cat C, post-production** |
| **3a. Hybrid search** (vector + BM25 for exact terms/IDs) | ✅ Shipped. Live test proved the keyword leg IS the exact-ID workhorse — and pinned its two mechanical bugs | Works; R1/R2/R3 are tuning, not architecture | SEED-059 |
| **3b. Metadata filtering** ("biggest lever for retrieval quality") | ✅ EXISTS — `search_documents(metadata_filter=...)` with case-normalization; `match_document_chunks`/`keyword_search_chunks` both accept `metadata_filter` | Capability shipped but unmeasured/underused — candidate *existing-capability audit*, not new build | SEED-020 bench slice |
| **3c. Reranking** (wide-net 50–150 → cross-encoder → top-N; −67% combined) | ✅ EXISTS (`rerank_service.py`, Cohere rerank-v3.5 config) but `rerank_enabled=False` default, never benched; candidate pool is 20 (vs 50–150 suggested) | Bench + decide default — measurement, not architecture | SEED-020 |
| **3d. Query expansion & multi-hop** | Multi-hop ✅ inherent to the agent loop (it re-searches across iterations; turn-5 recovery proves it). Query *expansion/rewriting* as a pipeline stage: not implemented; R3 zero-hit recovery is the cheap subset | Agentic multi-hop covered; pipeline-level expansion = optional future bench arm | SEED-059 (R3) / SEED-020 |
| **4. Agentic RAG & orchestration** (planning, tool calling, reflection, router/multi-agent/hierarchical/corrective) | ✅✅ v2.8 harness = locked plans + gates (corrective pattern!), `llm_batch_agents` fan-out, validation-gate retry-with-feedback ≈ reflection; 8-provider tool calling via gateway | **Ahead of the synthesis** — the harness implements its "hierarchical & corrective" endgame | — (shipped) |
| **5. Context engineering** (context rot; poisoning/confusion/clash; summarize-old-history; JIT retrieval; progressive disclosure; limited tool sets) | Partial — and better than expected: `trim_messages_to_fit` + `context_window_reserve_recent` ✅ (trim, not summarize); **progressive disclosure ✅ shipped** (skills inject as catalog, `load_skill` on demand — SKIL-09, `agent_loop.py:1036`); TOOL-05 `max_tools` budget ✅ (091); JIT retrieval ✅ (tools fetch on demand). Missing: history *summarization* (trim drops, doesn't compress), poisoning/clash defenses, context-quality telemetry | Solid foundation; remaining items are post-production polish anchored to the existing CONTEXT-MANAGEMENT.md options doc | **SEED-061 (new, Cat C)** |
| **6. Security & sandboxing** (indirect prompt injection; CBSE; MicroVM/gVisor vs Docker; default-deny egress; workspace-only writes; community-skill verification) | Baseline: Docker `llm-sandbox` per-thread, `SANDBOX_ENABLED` gate, RLS everywhere, manual-upload-only ingestion (shrinks injection surface), per-thread container labels. **No egress restriction** (`runtime_configs` sets name+labels only), shared-kernel Docker, no CBSE audit, no skill-import verification (skills are user/global-scope today) | Real posture gaps vs the synthesis — correctly *post-production* concerns for a local single-operator dev app; become load-bearing at multi-user/production (v3.1+) and community skills (v3.5+ marketplace) | **SEED-062 (new, Cat C)** |
| **7. Frameworks** (LangChain/LlamaIndex/LangGraph/CrewAI/Haystack…) | Deliberate NO-framework rule (raw SDKs, CLAUDE.md) — and v2.8 proved we could build the orchestration layer ourselves | By-design divergence; informational only | — (no action) |

## 6. Categorization & governance (the operative section)

Per the operator's 2026-06-07 directive, every finding is binned. **Nothing in this assessment mandates building anything.** The bins control *when* an item is allowed to surface:

### Category A — Already covered / shipped (no gap, no action)

Hybrid search; metadata-filter capability; multi-hop via agent loop; planning/multi-agent/corrective patterns (harness); progressive skill disclosure (SKIL-09); context trimming; TOOL-05 tool budget; JIT retrieval; markdown-first extraction; no-framework rule; RLS + manual-ingestion injection posture; confidence scoring.

### Category B — Small gaps, surface-at-phase via existing GSD mechanics (operator decides at trigger time)

| Item | Surfaces at | Mechanism |
|---|---|---|
| Retrieval eval fixture rows (bare-ID / ID+intent / tabular-attribute) | **discuss-096 (in progress)** — as CANDIDATES only | This doc + SEED-059/060 re_open_triggers |
| R1/R2/R3 keyword-leg fixes (one SQL fn + service tweak) | post-eval, v2.9 sweep | SEED-059 trigger |
| Tabular header propagation + CSV/XLSX→`document_tables` | v2.9 `/gsd:new-milestone` sweep, paired w/ SEED-027 | SEED-060 Tracks A/B/D triggers |
| Reranker bench + metadata-filter usage audit + candidate-pool tuning | SEED-020 audit when it opens | SEED-020 (trigger already FIRED, audit still operator-scheduled) |

### Category C — Big changes: POST-PRODUCTION planned updates (document-only now; do not build pre-production)

| Item | Why it waits | Earliest sensible window |
|---|---|---|
| **Contextual retrieval** (per-chunk LLM context + contextual BM25 + prompt-cached ingestion) | Re-embeds/re-indexes the whole KB; per-chunk LLM cost; needs eval infra to prove the −35/49/67% transfers to our corpus | v3.0+ (eval tables exist) / post-production |
| **Per-chunk metadata & hypothetical questions** (Source-1 pillar 3) | Same shape as above — ingest-time LLM spend, unproven delta on our data | v3.0+ |
| **Answer-groundedness Auditor node** (Gatekeeper/Auditor/Strategist) | New chat-path architecture; belongs with the eval milestone that can measure it | v3.0 |
| **History summarization + poisoning/clash defenses** (context engineering) | Touches the shared agent-loop path (red line); trim already mitigates worst case | SEED-061 triggers (post-production / long-thread complaints) |
| **Sandbox hardening** (default-deny egress, MicroVM/gVisor eval, CBSE audit, skill-import verification) | Zero exposure today (local, single operator, manual ingestion); load-bearing only at multi-user/production/marketplace | SEED-062 triggers (production deploy / v3.1+ / community skills) |
| Embedding-model swap / semantic chunking | SEED-020 bench arms — measurement first | SEED-020 |

### Surfacing guarantees (how this stays alive without enforcement)

1. **Seed triggers** — SEED-059/060/061/062 each carry concrete `re_open_triggers`; the `/gsd:new-milestone` sweep and discuss-phase bug/seed cross-check (CLAUDE.md mandatory touchpoints) read them automatically.
2. **SEED-020 trigger is formally FIRED** — recorded in its frontmatter; whenever the retrieval audit opens, R1–R3 + bench slices are pre-scoped.
3. **This document** lives in `.planning/research/` alongside the milestone-shaping docs that feed `/gsd:new-milestone`.
4. **Memory** — the assessment + categorization is in Claude's project memory, so future sessions recall the governance posture (document-only, post-production for Cat C).

## 7. What this session deliberately did NOT do

No code, no migrations, no settings changes, no new requirements injected into Phase 096 (discussion already in progress — items are candidates there at the operator's discretion). The G-3 temptation (one-line `plainto_tsquery` → `websearch_to_tsquery` swap) is explicitly resisted: retrieval behavior changes without an eval set are how regressions ship silently. Eval rows first, then any fix is a measured, reversible quick win — *when the operator schedules it*.
