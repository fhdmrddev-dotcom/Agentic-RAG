---
seed_id: SEED-022
title: Camelot PDF table-precision audit — false-positive overcount on academic PDFs
status: planted
planted: 2026-05-16
phase_origin: 071.3-docling-demotion-table-engine-full-rip
related_seeds: [SEED-019, SEED-020, SEED-021]
re_open_trigger: |
  Either fires (whichever first):
  1. Before Phase 076 (Confidence Recalibration) starts — Phase 076 will learn
     score distributions over the `document_tables` population, and that population
     is currently inflated 5.5x by camelot false positives. Recalibrating against
     a noisy population means the new confidence scores are also noisy. SEED-022
     MUST be addressed before Phase 076 plan-phase, OR Phase 076 must explicitly
     scope-include a precision filter as a prerequisite task.
  2. When user reports false-positive tables in retrieval (concrete query:
     user asks "show me tables about X" and the agent surfaces non-table fragments
     like formula blocks, reference list entries, or captions).
  3. When the Library Health → Tables view (if/when shipped) shows tables that
     are visually obviously not tables (paragraphs, captions, formulas).
suggested_phase: 076 or 082 (whichever lands first); could also support a small
  decimal phase (e.g., 075.1 or 076.1) if the user wants precision fixed in
  isolation before recalibration runs
priority: medium-high
---

# SEED-022 — Camelot PDF Table-Precision Audit

## What we observed

Phase 071.3 Plan 05 live UAT on the user's reference thesis recorded **214 tables**
in `document_tables` via the camelot path. The same thesis content, extracted via
the DOCX path (`inline_shapes_tables` walking `<w:tbl>` elements), returned
**39 tables** — which the operator identified as the true count.

**Camelot was overcounting tables by ~5.5x on academic PDFs.**

The DOCX path has perfect precision because it reads structural XML markup
(`<w:tbl>` is a table by definition). The PDF path uses camelot at
`flavor=stream`, which is a layout-region detector — it flags any text block
with column-aligned content as a "table." False-positive candidates include:

- Multi-column body text
- Aligned formula variables
- Reference list entries with consistent indentation
- Figure captions with numerical data
- Bulleted lists with column-like spacing
- Section header + body combinations that happen to align

## Plan 071.4-01 mitigation — much better than predicted

**Row/col precision floor landed in commit `46987c4`** (071.4-01): reject any
camelot Table where `len(df) < 2 OR len(df.columns) < 2`. After the
[[reingest-endpoint-does-not-delete-prior-tables-and-images]] BUG-260516-04
fix unmasked the real per-extract count, the mitigated thesis PDF count is:

| | Pre-floor (214) | Post-floor | Reduction |
|---|---|---|---|
| Thesis PDF tables | 214 | **48** | **4.4x** (78%) |
| Ground truth (DOCX) | 39 | 39 | reference |
| Remaining overcount | 175 | **9** | 95% closed |

**This is much better than the predicted 80-120 range** — most of camelot's
false positives ARE single-row or single-column shapes (header bands without
data, aligned bulleted lists). Only ~9 false positives remain that have a
≥2×2 shape — likely formula blocks or multi-row aligned text paragraphs.

The remaining 9 require the content-density / figure-bbox-overlap audit
originally scoped for the Phase 076 prerequisite. Whether that audit is
still worth running before 076 is now an open question (down from "must
address" to "nice-to-have") — surface to operator at /gsd:discuss-phase 076.

## Why it matters

The 5.5x inflation isn't cosmetic. It compounds three ways:

1. **Retrieval pollution.** Every false-positive row sits in `document_tables`,
   gets embedded, and is returnable via "show me tables about X" queries. Users
   get non-table fragments labeled as tables — eroding trust in the tables
   surface specifically and confidence scores generally.

2. **Phase 076 confidence recalibration learns from noise.** Phase 076's goal
   is to re-derive chunk score distributions on the post-071.3 default-set.
   If 175 of the 214 thesis "tables" are false positives, the distribution
   the recalibration learns is dominated by non-tables — and the resulting
   confidence scores will reflect that.

3. **Storage and embedding cost.** Each false-positive row consumes embedding
   tokens and Postgres rows. On a large library, this is real money.

## Hypothesized causes & fix candidates

Need an audit pass on the 214 regions before committing to a fix direction.
Per the `feedback_extraction_root_cause_not_plumbing` rule: investigate the
detection ceiling first (what is camelot actually seeing on this thesis?)
before assuming any specific filter shape.

Likely fix candidates (in order of cost):

1. **Camelot config tuning.** Increase `edge_tol`, `row_tol`, or set
   `split_text=True`. May reduce false positives but also risk dropping real
   borderless tables. Cheap to try; needs A/B against the 39-table ground truth.

2. **Post-extraction precision filter in `aspects/tables.py`.** Reject regions
   where (a) row count < 2, (b) cell-text density is paragraph-like, (c) first
   row doesn't look header-ish (Bonferroni-ish on row length variance), (d) the
   region overlaps a known figure/equation bbox. Low risk; transparent rule set.

3. **Hybrid: camelot detection → lightweight classifier.** Train a small
   classifier on "real table" vs "false-positive region" features. Higher
   investment but generalizes across documents.

4. **Switch engines or add a second pass.** If camelot's precision ceiling is
   inherent to `flavor=stream`, try `flavor=lattice` (works on ruled tables
   only — would underperform on academic borderless tables) or add gmft as a
   second-pass validator if/when the transformers strict-dataclass break is
   resolved upstream (intersects [[SEED-021]]).

## Suggested routing

- **MUST address before Phase 076 plan-phase**, OR Phase 076 must include
  a precision filter as a scoped prerequisite task. Phase 076 building on a
  5.5x-inflated table population means the confidence recalibration itself
  is partially measuring noise.
- **Phase 082** (Cross-cutting Verification) would catch this during baseline
  validation (35 tables / 59 figures ground truth) — but waiting for 082 means
  Phase 076 ships on broken ground.
- **Earliest path:** insert a small decimal phase (075.1 or 076.1) bundling
  the audit + filter implementation, scheduled immediately before 076.

## Workarounds

- **None for end users today** — the inflation is in stored data; no UI
  control to filter it out without code change.
- **Code-side quick mitigation** (before audit): set a hardcoded row-count
  floor (e.g., `len(rows) >= 2` and `len(cols) >= 2` on the camelot Table
  object) in `aspects/tables.py::camelot_tables`. Probably drops the 214
  to ~80-120 immediately without losing real tables. Not a real fix —
  just damage control before the proper audit runs.

## Reference / evidence links

- Plan 01 bench: `.planning/research/071.3-bench-results.md` shows camelot
  found 214 raw tables on the thesis vs pymupdf's 188.
- Plan 05 UAT: `071.3-HUMAN-UAT.md` records the 214 vs DOCX's 39 split.
- Operator confirmation 2026-05-16: "DOCX identified 39 tables (this is the
  actual table count) but PDF identified 214."
- Phase 082 ROADMAP entry cites baseline of "35 tables / 59 figures on user
  thesis" — 35 is in the same neighborhood as the operator's 39 (different
  versions of the document, or different counting methodology — both consistent
  with camelot's 214 being a precision problem, not a recall problem).
