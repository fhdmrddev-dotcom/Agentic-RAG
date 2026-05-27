# Phase 082: Cross-cutting Verification + Extraction Telemetry - Context

**Gathered:** 2026-05-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Milestone-close verification gate for v2.6. Prove the three workstreams (RAG quality lift, multi-worker readiness, StreamsProvider pre-emptive lift) don't regress each other under the full combined stack. Populate extraction telemetry for admin observability. Audit all v2.6 REQ-IDs and dispose carry-forward seeds.

This phase builds nothing new — it verifies what was built.

</domain>

<decisions>
## Implementation Decisions

### Dependency Gate
- **D-01:** Decouple Phase 082.5 (Error Handler Foundation) from Phase 082's dependency list. 082.5 is independent infrastructure (global error handler + structured logging + `app_errors` table) that doesn't affect any of Phase 082's three verification checks. 082 proceeds now; 082.5 ships in parallel or after.

### Extraction Baseline Verification (SC#1)
- **D-02:** Fresh re-extract — call `/reextract` on the thesis PDF + DOCX pair to prove the full extraction pipeline runs end-to-end under the v2.6 stack (multi-worker, new settings architecture from 081.1, etc). Query-existing is insufficient.
- **D-03:** Baseline is the **current live numbers** (post-071.4 precision floor + post-072 multimodal lift), NOT the stale 071.3 raw output:
  - **PDF:** 48 tables / 67 images / 441 chunks
  - **DOCX:** 39 tables / 58 images / 404 chunks
  - **Pass condition:** re-extract produces counts within ±20% of these numbers. Lower bounds: PDF ≥38t/≥54i/≥353c, DOCX ≥31t/≥46i/≥323c. Upper bounds also checked (no unexpected inflation beyond +20%).

### 067.5 Regression Verification (SC#3)
- **D-04:** Thread-switch stress test protocol. 5 consecutive cycles: start a stream on Thread A, switch to Thread B mid-stream, switch back to Thread A. Pass = messages visible immediately on switch-back, no blank-until-refresh on any cycle. This is the original 067.5 protocol that proved the Branch D-3 `clearMessages` guard.

### Verification Ownership Split
- **D-05:** Claude drives SC#1 (extraction re-extract via API), SC#2 (pytest CONCUR-01), and SC#4 (telemetry query) autonomously. User drives SC#3 (Chrome MCP lived-experience browser cycles) since it requires real browser interaction with human judgment.

### Milestone-Close Audit (SC#5)
- **D-06:** Audit delivered as a `082-VERIFICATION.md` table: REQ-ID × Phase × Status × Evidence. Plus a seed disposition section. Standard GSD verification format.
- **D-07:** Seed sweep scoped to the 7 named seeds in the ROADMAP: SEED-001 (partial downgrade), SEED-006/007/008/009/010/011 (fully consumed → close). Other seeds (012–033) stay as-is for next milestone triage.

### Claude's Discretion
- Plan splitting (how many plans, which SCs per plan) left to planner
- Exact API call sequence for `/reextract` and telemetry queries
- pytest invocation flags and worker configuration
- Verification report format within the GSD standard
- ROADMAP progress table reconciliation (currently stale)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Extraction Baseline
- `.planning/phases/071.3-docling-demotion-table-engine-full-rip/071.3-VERIFICATION.md` — 071.3 verification report with original baseline (214t/20i/461c pre-precision-floor)
- `.planning/phases/071.3-docling-demotion-table-engine-full-rip/071.3-HUMAN-UAT.md` — Live UAT record with thesis PDF extraction counts

### Multi-Worker
- `backend/tests/integration/test_058_concurrency.py` — CONCUR-01 binding gate (pytest)
- `.planning/prd-reset/DECISIONS.md` — D-PRD-12 ADR (multi-worker audit checklist)

### StreamsProvider / 067.5
- `frontend/src/providers/StreamsProvider.tsx` — Streams store + provider
- `frontend/src/hooks/useMessages.ts` — Branch D-3 `clearMessages` guard

### Extraction Pipeline
- `backend/app/services/extraction_service.py` — `PdfExtractor` ABC + dispatcher
- `backend/app/services/extractors/aspects/` — Per-aspect engines (tables, images, text, equations)

### Requirements & Seeds
- `.planning/REQUIREMENTS.md` — 24 REQ-IDs with traceability
- `.planning/seeds/SEED-001-scale-readiness.md` through `SEED-011-test-059-fixture-teardown.md` — Seeds to disposition

### ROADMAP
- `.planning/ROADMAP.md` — Phase 082 success criteria (lines 954–964)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/calibrate_confidence.py` — Reusable calibration script (pattern for corpus-wide verification scripts)
- `backend/tests/integration/test_058_concurrency.py` — CONCUR-01 gate test, runnable as-is under multi-worker
- `backend/app/api/documents.py` — `/reextract` endpoint for triggering extraction

### Established Patterns
- Phase verification reports follow the GSD VERIFICATION.md template (frontmatter + Observable Truths table + Deferred Items + Required Artifacts)
- Chrome MCP UAT uses the thread-switch cycle protocol established in Phase 067.5
- Seed disposition follows the `status: closed` / `closed_by:` frontmatter pattern

### Integration Points
- `/reextract` endpoint triggers extraction + populates `pdf_extraction_runs` telemetry
- `document_tables`, `document_images`, `document_chunks` tables hold the extraction output
- Vitest suite for Branch D-3 guard: existing tests from Phase 068 Plan 02 (L-068-01..07)

</code_context>

<specifics>
## Specific Ideas

- The ROADMAP progress table (lines 1050–1071) is very stale — several phases show "Not started" when they shipped days ago. The verification pass should reconcile this as part of the milestone-close audit.
- Current live extraction counts (provided by user): PDF 48t/67i/441c, DOCX 39t/58i/404c — these are the authoritative baseline, not the 071.3 raw numbers.

</specifics>

<deferred>
## Deferred Ideas

- Phase 082.5 (Error Handler Foundation) — decoupled from 082 dependency, ships independently
- Full seed sweep (SEED-012 through SEED-033) — deferred to `/gsd:new-milestone` triage
- ROADMAP progress table full reconciliation — could be part of `/gsd:complete-milestone` rather than 082

</deferred>

---

*Phase: 082-cross-cutting-verification-extraction-telemetry*
*Context gathered: 2026-05-27*
