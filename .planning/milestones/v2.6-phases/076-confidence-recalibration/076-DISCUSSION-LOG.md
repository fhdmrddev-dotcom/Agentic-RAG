# Phase 076: Confidence Recalibration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-24
**Phase:** 076-confidence-recalibration
**Areas discussed:** Calibration sample, Threshold method, SEED-022 + adjacent code, Re-litigability artifact

---

## Calibration Sample

| Option | Description | Selected |
|--------|-------------|----------|
| Real corpus + audit queries | Run calibration against actual uploaded documents using real queries from audit_log. No re-extraction needed. | ✓ |
| Hybrid (real corpus + fixtures) | Use real corpus for thresholds, PLUS bake a fixture-based regression script for drift detection. | |
| Test fixtures only | Extract + embed + query the 7 small test fixtures. Reproducible but too small statistically. | |

**User's choice:** Real corpus + audit queries
**Notes:** Small corpus (~5-20 docs, handful of queries). Supplementing with ~20 synthetic calibration queries covering prose, table-referencing, image-referencing, and out-of-domain content types.

---

## Threshold Method

| Option | Description | Selected |
|--------|-------------|----------|
| Validate-or-adjust | Measure distribution first. If buckets still sensible (~30%/45%/25%), keep current 0.55/0.40. Adjust only if shifted. | ✓ |
| Percentile-locked | Define thresholds purely by percentile. Guarantees even bucket fill but changes every time corpus changes. | |
| Intent-preserving | Slide both thresholds by the same offset as the prose range shifts. Anchors to content-type behavior. | |

**User's choice:** Validate-or-adjust
**Notes:** Pragmatic approach — no change if unnecessary. Only adjust if the post-071.3 distribution materially shifted the bucket balance.

---

## SEED-022 + Adjacent Code

### SEED-022 Precision Audit

| Option | Description | Selected |
|--------|-------------|----------|
| Defer — tables don't affect calibration | Tables don't enter document_chunks, can't pollute calibration. 071.4-01 floor (4.4x reduction) sufficient. | ✓ |
| Include in Phase 076 as prerequisite | Run content-density audit on remaining ~9 false positives. Extra scope. | |
| Close SEED-022 outright | The floor is sufficient. Close without further work. | |

**User's choice:** Defer
**Notes:** SEED-022 stays planted. Re-opens when SEED-027 tables-to-chunks ships and table content actually enters the retrieval path.

### knowledge_health.py Alignment

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, align in Phase 076 | Import or reference shared threshold constants. | |
| No, defer to 081.1 | Let Settings Unification sweep pick it up. | |
| You decide | Claude picks based on scope/effort when planning. | ✓ |

**User's choice:** You decide (Claude's Discretion)
**Notes:** Decision deferred to planning time — depends on whether thresholds actually change.

---

## Re-litigability Artifact

| Option | Description | Selected |
|--------|-------------|----------|
| Committed script | `scripts/calibrate_confidence.py` — connects to Supabase, runs queries, prints histogram + recommended thresholds. | ✓ |
| PROJECT.md appendix only | Document SQL + methodology as text. Reproducible by copy-paste, not automated. | |
| Both script + appendix | Full script PLUS PROJECT.md summary of last run. Belt and suspenders. | |

**User's choice:** Committed script
**Notes:** PROJECT.md appendix will link to the script output (date, sample size, thresholds, quartiles) — but the script is the primary artifact.

---

## Claude's Discretion

- Plan split (2 plans) — planner decides
- pdf_extraction_runs telemetry verification — basic SQL assertion
- test_citations_confidence.py — update if values change
- PROJECT.md appendix formatting
- knowledge_health.py alignment (if thresholds move)

## Deferred Ideas

- SEED-022 deeper precision audit — deferred to when tables enter chunks
- SEED-027 tables-to-chunks — separate phase
- Promote thresholds to app_settings — Phase 081.1 scope
- Embedding model evaluation — SEED-020 retrieval-quality audit
