# Phase 076: Confidence Recalibration - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Re-derive `_compute_confidence` thresholds at `backend/app/api/threads.py:530-542` over the post-071.3 default-set chunk score distribution. Document before/after in PROJECT.md. Verify `pdf_extraction_runs` telemetry keeps per-extractor lineage observable so this calibration is re-litigable when the chunk population drifts.

**Does NOT include:** adding tables to `document_chunks` (SEED-027), deeper camelot precision audit (SEED-022 deferred), settings-architecture changes (Phase 081.1), or re-extraction of the corpus.

</domain>

<decisions>
## Implementation Decisions

### Calibration Corpus & Query Set
- **D-01:** Use the **real user-uploaded corpus** (already extracted under post-071.3 defaults) — no re-extraction needed. Documents are already in `document_chunks` with embeddings under `text-embedding-3-small`.
- **D-02:** Query set = all available queries from `audit_log` (action_type=`search.query`) **plus** ~20 synthetic calibration queries written to cover prose, table-referencing, image-referencing, and out-of-domain content types. The synthetic set compensates for the small corpus (~5-20 docs, handful of real queries).
- **D-03:** Calibration measures `avg_similarity` per query (the same value `_avg_cosine()` at `retrieval_service.py:159-162` returns and that `similarity_scores.append(avg_sim)` accumulates at `threads.py:2555-2556`).

### Threshold Derivation Method
- **D-04:** **Validate-or-adjust** approach. Measure the distribution first. If the median and shape haven't moved materially from the Phase 32.5 baseline (high/medium/low buckets contain sensible proportions — roughly 30%/45%/25%), **keep current 0.55/0.40**. If the distribution shifted (e.g., median dropped significantly due to camelot-generated chunk diversity, or rose due to less noise), adjust thresholds to restore meaningful bucket balance.
- **D-05:** Target is that "high" captures queries where the top-5 retrieval clearly matched, "medium" captures reasonable-but-not-definitive matches, and "low" captures out-of-domain or weak matches. Intent-level preserved from Phase 32.5, not absolute numbers.

### SEED-022 (Camelot Precision)
- **D-06:** **Deferred.** Tables don't enter `document_chunks` (per SEED-027's analysis), so false-positive tables cannot pollute the confidence calibration. Phase 071.4-01's row/col floor (214→48, 4.4x reduction) is sufficient. SEED-022 stays planted — re-opens if/when SEED-027's tables-to-chunks work ships and table content enters the retrieval path.

### knowledge_health.py Threshold Alignment
- **D-07:** Claude's Discretion. There's a minor inconsistency: `knowledge_health.py:14` has `HIGH_CONF_THRESHOLD = 0.50` while `_compute_confidence` uses 0.55 for "high." If the calibration changes the high boundary, alignment is cheap (import or share the constant). If thresholds stay unchanged, leave it for Phase 081.1 Settings Unification to sweep. Decision at planning time based on whether thresholds actually move.

### Re-litigability Artifact
- **D-08:** Commit a reusable **`scripts/calibrate_confidence.py`** that connects to Supabase, runs the synthetic + audit_log queries, collects avg_similarity per query, prints a histogram + recommended thresholds, and writes results to a JSON output file. Anyone can re-run it when the corpus changes. PROJECT.md appendix entry links to the script + shows the current run's output summary (date, sample size, before/after thresholds, distribution quartiles).
- **D-09:** The script must work against the live local Supabase instance (reads `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from `backend/.env`). No test-only harness — this runs against real data by design.

### Threshold Storage
- **D-10:** Thresholds stay as Python constants at `_compute_confidence` (same pattern as Phase 32.5). Promoting to `app_settings` is Phase 081.1's scope — no premature infra here.

### Claude's Discretion
- Plan split (2 plans) — planner decides the best cut based on dependency shape
- `pdf_extraction_runs` telemetry verification method — basic SQL assertion that `engine` column is populated for recent uploads with the composer signature is sufficient
- Test file `test_citations_confidence.py` — update threshold assertions if values change; generalize if they don't
- PROJECT.md appendix formatting — text tables + quartiles preferred over committed images

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Confidence scoring architecture
- `backend/app/api/threads.py` §530-542 — `_compute_confidence()` function (the target of recalibration)
- `backend/app/services/retrieval_service.py` §159-162 — `_avg_cosine()` (produces the input value)
- `backend/app/api/threads.py` §2530-2556 — `search_documents` call site where `avg_sim` is accumulated
- `backend/app/api/knowledge_health.py` §13-14 — `LOW_CONF_THRESHOLD` / `HIGH_CONF_THRESHOLD` (inconsistent with _compute_confidence; D-07 scope)

### Prior calibration context
- `.planning/milestones/v2.2-ROADMAP.md` §76 — Phase 32.5 entry (original calibration)
- Memory: `project_phase32_5_chunking_fixes.md` — Phase 32.5 method (from high≥0.70/medium≥0.50 → high≥0.55/medium≥0.40)
- `backend/tests/unit/test_citations_confidence.py` — existing threshold assertions

### Post-071.3 default-set context
- `supabase/migrations/047_app_settings_table_engine_default.sql` — camelot sealed as PDF table default
- `supabase/migrations/046_app_settings_disable_docling_aspects.sql` — equations=none, tables pdfplumber→camelot
- `.planning/phases/071.3-docling-demotion-table-engine-full-rip/071.3-05-SUMMARY.md` — UAT evidence + Q-v2.6-03 lock
- `.planning/seeds/SEED-022-camelot-pdf-table-precision-audit.md` — deferred (D-06)

### Schema and telemetry
- `supabase/full-schema.sql` §304-313 — `document_chunks` table (calibration target)
- `supabase/full-schema.sql` §436-447 — `pdf_extraction_runs` table (SC#4 telemetry)
- `supabase/migrations/037_messages_confidence_columns.sql` — D-v2.5-12 schema (must not change)

### Requirements
- `.planning/REQUIREMENTS.md` §21 — RAG-RECAL-01
- `.planning/PRDs/v2.6.md` §196 row "Confidence threshold recalibration" — compatibility check
- `.planning/PRDs/v2.6.md` §433 — Q-v2.6-03 detail + rationale

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `_avg_cosine()` at `retrieval_service.py:159-162` — exact function that produces the score we're calibrating against
- `search_documents()` at `retrieval_service.py:237-305` — the full retrieval path (vector-only or hybrid+RRF+rerank) that returns `avg_sim`
- `audit_log` table with `action_type='search.query'` and `metadata.document_ids` — source of real query replay data
- `backend/tests/unit/test_citations_confidence.py` — existing test harness with threshold constants in `CONFIDENCE_THRESHOLDS` dict

### Established Patterns
- Confidence is computed per search_documents call (not per chunk) — it's an avg across the top-N returned chunks
- Hybrid search takes `_avg_cosine` over the vector rows BEFORE RRF fusion (retrieval_service.py:283) — so the score reflects vector similarity, not hybrid rank
- `CONFIDENCE_DISCLAIMER` string (low-confidence advisory) lives at threads.py and flows through SSE + persist — untouched by recalibration

### Integration Points
- `_compute_confidence` is called once per run at threads.py:3487 to produce the SSE `confidence` event + persistence
- `knowledge_health.py` uses its own separate thresholds (LOW=0.40, HIGH=0.50) for the Knowledge Health dashboard "low confidence queries" metric — NOT shared with the main confidence badge
- `pdf_extraction_runs` writes happen at `backend/app/services/extraction_service.py` during upload/reextract — column `engine` captures the extractor name

</code_context>

<specifics>
## Specific Ideas

- Phase 32.5's docstring documents the calibration rationale well — preserve a similar "why these numbers" docstring in `_compute_confidence` after recalibration
- The script should output something the operator can eyeball (distribution percentiles, suggested thresholds, sample size) so it's a useful diagnostic even outside formal recalibration
- If thresholds don't move, commit that finding explicitly (PROJECT.md appendix says "validated: post-071.3 distribution matches Phase 32.5 baseline — no change needed")

</specifics>

<deferred>
## Deferred Ideas

- **SEED-022 deeper precision audit** — remaining ~9 false-positive camelot tables (post-071.4 floor) need content-density / bbox-overlap analysis. Deferred because tables don't enter `document_chunks` and can't pollute calibration. Re-opens when SEED-027 ships.
- **SEED-027 tables-to-chunks ingestion** — render document_tables rows as chunks for vector retrieval. Would change the chunk population and require another recalibration pass. Separate phase.
- **Promote thresholds to `app_settings`** — making confidence boundaries admin-tunable via Phase 081.1 Settings Unification. Not in 076 scope.
- **Embedding model evaluation** — SEED-020 (retrieval-quality audit) includes embedding model bench. Could shift score distributions fundamentally. Separate concern.

</deferred>

---

*Phase: 076-confidence-recalibration*
*Context gathered: 2026-05-24*
