---
plan: 071.3-01
chose_at: 2026-05-16T03:15:00Z
winner: camelot
rationale: |
  Camelot recommended per bench data. User requested thesis numbers first
  and ran the thesis fixture on pymupdf + camelot only because gmft is
  structurally broken at bench time (transformers/huggingface_hub strict-
  dataclass break on TATR config field 'dilation' — see Install Notes
  section of bench-results.md for root cause).
  Camelot found 15 tables on friendly_real vs pymupdf's 9 (1.67x). On the
  4 MB thesis camelot found 214 raw candidates vs pymupdf's 188 (1.14x).
  Both engines clear the D-071.3-02 acceptance floor of >=20 by orders of
  magnitude on raw counts; the relevant ship-floor question (ROADMAP SC#6
  ≥15/≥12 distinct tables in rendered output) is Plan 05's UAT scoreboard,
  not Plan 01's bench.
thesis_tables: 214
thesis_recall_pct: 611.4
friendly_tables: 15
floor_cleared: true
thesis_wall_seconds: 21.10
thesis_peak_rss_mb: 387.4
---

# Plan 071.3-01 Winner: camelot

## Operator's choice

> "camelot — recommended per bench data; user wanted thesis numbers first;
> ran thesis on pymupdf + camelot only since gmft is broken at bench time."

## Bench numbers (from `.planning/research/071.3-bench-results.md`)

| Engine | Fixture | Tables Found | Median Wall (s) | Peak RSS (MB) | Status |
|---|---|---|---|---|---|
| **camelot** | **friendly_real** | **15** | **1.27** | **292.4** | **success** |
| **camelot** | **thesis** | **214** | **21.10** | **387.4** | **success** |
| pymupdf | friendly_real | 9 | 3.56 | 384.4 | success |
| pymupdf | thesis | 188 | 19.86 | 63.9 | success |
| gmft | friendly_real | 0 | — | — | failed (StrictDataclassFieldValidationError) |
| gmft | thesis | — | — | — | not_run (skipped after friendly crash) |

## Floor cleared, but the floor isn't the ship gate

D-071.3-02 sets the **engine acceptance floor** at ≥20 tables on the thesis.
Camelot (214) clears that by 10x and pymupdf (188) clears it by ~9x — so the
floor is met on raw detector counts.

**This is NOT the same as the ROADMAP SC#6 ship floor**, which requires
≥15 distinct tables in the **rendered chat output** of a thesis-document
query and ≥12 for friendly_real. The raw bench counts contain false
positives (both engines over-count by ~6x vs the 35-table ground truth) and
must be filtered down through structural fidelity + extractor wiring before
they can be compared against SC#6. Plan 05 (UAT scoreboard) is the gate
where SC#6 pass/fail is decided.

Recording **both** here so the distinction is durable:

| Floor | Source | Camelot status |
|---|---|---|
| D-071.3-02 engine acceptance (≥20 raw tables on thesis) | This plan (071.3-01) | **cleared (214)** |
| ROADMAP SC#6 ship floor (≥15 / ≥12 rendered tables) | Plan 071.3-05 | **TBD by Plan 05** |

## Why gmft was excluded

gmft 0.4.3 cannot construct `TableTransformerForObjectDetection.from_pretrained`
under `transformers==5.7.0` + `huggingface_hub==1.13.0` because the strict
dataclass validation of `PretrainedConfig` rejects the published TATR
config's `dilation=None` value (declared as `bool` in the dataclass).

Shipping gmft would require either:
- pinning `transformers<5` in production `requirements.txt` (adds
  cross-feature dep-discipline burden),
- waiting for an unreleased gmft fix (no patch on PyPI as of 2026-05-16), or
- pinning the TATR model to an older revision SHA (fragile).

Per the operator memory `feedback_docling_skepticism`, tools that "break
the fast/light system" are not acceptable defaults. gmft's dep chain is
materially worse than Docling's (which was just demoted in Phase 071.2),
and its lazy ~120 MB TATR weight download adds another fragility surface.
Net: gmft is out.

## Next dependency

Plan 02 reads the `winner:` field from this file's frontmatter and:
- Wires `camelot` as the `tables` aspect engine in the per-aspect
  dispatcher (preserves engine optionality per
  `feedback_preserve_engine_optionality` — text/images/equations still
  swappable independently).
- Adds `camelot-py[base]>=1.0.0,<2.0.0` to `backend/requirements.txt`
  (production install, not bench-only).
- Removes pdfplumber from the `tables` slot.
