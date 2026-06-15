# Spike Manifest

## Idea

**image-recall-union** — measure whether mixing free OSS PDF figure-detection engines can close the 20/59 figure-recall gap on the operator's thesis at $0 cost (no vision-LLM-per-page). Feeds the SEED-021 spike-first re-open trigger that was locked into Phase 072 CONTEXT.md on 2026-05-16 when `vision_sweep` (~$3-5/extract) was deferred.

The spike answers two paired questions:
- **(a)** Which OSS engine — `pymupdf_full` (baseline), `page.get_drawings()` clustering, `pdfplumber.figures`, or Marker (CPU) — performs best on the thesis at $0 cost?
- **(b)** Does the marginal recall lift from $0 engines actually improve retrieval quality on figure-grounded queries against the existing strong pipeline (hybrid search + reranker + 15+ tools)?

Both must come back positive to justify a future v3.x phase. Either negative closes SEED-021 (or downgrades next attempt to vision_sweep with a separate cost gate).

## Spikes

| # | Name | Validates | Verdict | Tags |
|---|------|-----------|---------|------|
| 001 | pymupdf-full-baseline | pymupdf_full extracts N figures on the operator's thesis (anchor) | **SURPRISE: 67 figures (NOT 20)** — storage cap was the real bottleneck | seed-021, baseline, pymupdf, storage-cap-finding |
| 002 | get-drawings-vector-cluster | vector clustering adds ≥15 figures (target union 20 → 35+) | INVALIDATED (but harmless) — thesis only has 68 vector primitives total; +2 figures | seed-021, pymupdf, vector-clustering, thesis-is-raster-heavy |
| 003 | pdfplumber-figures | pdfplumber.images is a viable drop-in (target ≥30) | VALIDATED — 61 figures, comparable to pymupdf_full (engines walk same xref graph) | seed-021, pdfplumber, drop-in-alternative |
| 004 | marker-cpu-smoke | Marker recall on CPU (conditional on 002+003 union <40) | SKIPPED — conditional gate not triggered (union = 69) | seed-021, marker, gpl, skipped |
| 005 | retrieval-value-smoke | 5-10 figure-grounded queries: cap=20 baseline vs cap=100 lifted | NOT RUN — operator closed SEED-021 on (a) alone (2026-05-16) | seed-021, retrieval, leg-b, human-judgment, not-run |
| 006 | deterministic-workspace-panel | smart gate + activity-derivation fills panel cross-provider (incl. no-write_todos), keeps simple chats clean | **VALIDATED (7/7)** — Anthropic-derived panel ≈ OpenAI write_todos plan; simple Q&A stays clean | phase-095, pre-096, cross-provider, workspace-panel, deterministic, smart-gate |
| 007 | execcode-label-fallback | description-less execute_code still gets a meaningful label via code heuristic | **VALIDATED (6/6)** — label chain write_todos > description > code-inferred > "Run code" | phase-095, pre-096, cross-provider, fallback, deterministic |

## Topline finding (2026-05-16)

**The "20 figures stored = 34% recall" baseline was a storage-layer cap, not an extraction problem.** Spike 001 ran the same `pymupdf_full` extractor used in production and found 67 unique figures on the operator's thesis. The DB confirmed the diagnosis: `app_settings.multimodal_max_vision_calls = 100` is already populated correctly (per migration 044), but `backend/app/services/multimodal_service.py:_MAX_VISION_CALLS = 20` hardcodes the consumer side. The vision-LLM successfully describes 20 of 20 it tries (current state: `empty=0`); the other 47 figures are silently dropped before any LLM call is made.

**Implication for Phase 072:** Plan 01 (D-072-08 — replace the hardcode with the `app_settings` read) becomes the **sole load-bearing change** for the recall lift, not the entire vision_sweep engine that was deferred. The deferral was even more correct than originally argued.

**Open question:** does going from 20 → 67 stored figures actually improve answers on figure-grounded queries against the live pipeline? Spike 005 was set up to measure this. **Operator opted not to run it (2026-05-16)** — the (a)-leg finding (storage cap, not extraction) is conclusive on its own; the (b)-leg question can be observed post-Plan-01 in real use without a blocking gate. The Spike 005 manual procedure remains runnable if the question resurfaces.

## Status: COMPLETE (2026-05-16)

SEED-021's image-axis re-open trigger is RESOLVED via the (a) findings alone. The seed's table-axis trigger (#1 in its frontmatter — "user uploads a new academic PDF + reports specific tables/figures that didn't surface") stays open as a separate concern; this spike series doesn't address tables.

## Related artifacts

- **SEED-021**: `.planning/seeds/SEED-021-table-image-recall-lift.md` — the re-open trigger this spike fills
- **Phase 072 CONTEXT.md** `<deferred>` block: documents the vision_sweep retraction and points here
- **Reference fixture**: `backend/tests/fixtures/extraction/friendly_real.pdf` (arXiv 2605.15184v1, CC-BY 4.0, ~59 visible figures ground truth)
- **Project memory**: `[[feedback-extraction-root-cause-not-plumbing]]`, `[[feedback-research-landscape-completeness]]`, `[[feedback-preserve-engine-optionality]]`, `[[feedback-docling-skepticism]]`

---

## Idea — Deterministic workspace-panel population (2026-06-06, spikes 006-007)

**Pre-096 cross-provider concern.** Live UAT proved `write_todos` compliance is
inconsistent across (and within) providers — so the workspace todos/tasks panel
filled only for OpenAI. Operator direction: fill it by a DETERMINISTIC mechanism
(smart + natural, NOT mandatory, NOT prompt-instructed), provider-independent,
honoring the per-provider gateway separation (092.5).

**Question:** can a deterministic smart-gate + activity-derivation fill the panel
consistently for all providers, keep simple chats clean, and stay semantically
meaningful — without depending on the model calling write_todos?

## Topline finding (2026-06-06)

**YES — approach (A) activity-derivation + smart gate is a complete, deterministic,
cross-provider mechanism.** Validated on REAL captured runs:
- `execute_code` already carries a model-written `description` → derived panels are
  semantically rich (Anthropic's derived panel ≈ OpenAI's write_todos plan).
- Smart gate is implicit in activity: 0-tool Q&A / 1-tool lookup → clean; ≥2
  meaningful steps OR an explicit write_todos → populate. Never forced.
- Label-source precedence: `write_todos` > `execute_code.description` >
  code-inferred (spike 007) > `"Run code"`. Degrades gracefully.
- A dedicated planner sub-agent (B) is OPTIONAL (upfront-plan UX only), NOT required
  for correctness → keeps cost/latency at zero for the common case.

**Signal for the build (pre-096 phase "Cross-Provider Run Honesty & Workspace
Parity"):** implement the panel as a shared activity-derived projection with the
smart gate + label-precedence chain; keep it on the provider-agnostic SSE layer
(no per-model rules). Verify live across all 8 providers.

## Status: COMPLETE (2026-06-06) — feeds the pre-096 phase
