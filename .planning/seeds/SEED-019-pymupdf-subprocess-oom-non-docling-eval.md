---
seed_id: SEED-019
title: PyMuPDF subprocess OOM diagnostic + non-Docling engine evaluation
status: closed
planted: 2026-05-15
closed: 2026-05-16
closed_by: 071.3-docling-demotion-table-engine-full-rip
phase_origin: 071.2-ingestion-plumbing-docling-quality-diagnostics
related_seeds: [SEED-006, SEED-017, SEED-018, SEED-020, SEED-021]
re_open_trigger: |
  CLOSED — superseded by Phase 071.3 outcomes. Re-open is no longer applicable;
  the table-engine evaluation (Plan 01 bench), Docling rip (Plan 04), and the
  PyMuPDF subprocess fence retirement (Plan 04 Phase G PASS) all landed.
  Residual concerns are now tracked by:
  - SEED-020 (retrieval-quality audit — embedding-model + re-ranker + hybrid retrieval)
  - SEED-021 (table/image recall lift — image recall stayed at 20/59 on the thesis)
suggested_phase: closed
surface: Agentic-RAG
trigger_when: unset
---

## Why this seed exists

After Phases 070, 071, 071.1, 071.2 (5 plans), Docling has consistently failed
to deliver on its promise of higher table/image recall:

- Phase 070: Docling timed out at 4+ minutes on the thesis PDF
- Phase 071.1: stall reduced to ~125s — still too slow, still timed out
- Phase 071.2 Plan 03: chunker swapped to Docling markdown (works when Docling completes)
- Phase 071.2 Plan 05 live UAT (2026-05-15): **Docling timed out at 136s; PyMuPDF
  subprocess fallback also OOM'd with `MemoryError`**

User feedback (verbatim, 2026-05-15): *"ever since we implemented Docling,
everything was ruined, before it was working fast, no resource consumption,
the whole document was extracted... if this is a top RAG system, how it will
deal with much bigger files? I honestly not comfortable using Docling because
we did many plans and many phases and now it broke the whole system."*

Direction chosen (2026-05-15): **diagnose PyMuPDF subprocess OOM first, then
evaluate non-Docling alternatives**, before flipping migration 045 defaults.
See [[feedback-docling-skepticism]].

## Hard questions this phase must answer

### Q1: Why does PyMuPDF subprocess OOM on a < 200-page, single-digit-MB PDF?

PyMuPDF in-process is widely benchmarked as one of the fastest and lightest
PDF libraries in OSS. The subprocess fence (`backend/app/services/extractors/pymupdf_isolated.py`)
was added in SEED-006 because PyMuPDF imports conflict with httpx (Docling
dependency chain pollution) at module load time. The subprocess approach
should isolate memory, not amplify it.

Investigate:
- Is the subprocess passing the entire PDF as bytes via stdin and the child
  loading it all into RAM at once? (Would explain proportional memory growth.)
- Is the subprocess loading Docling-adjacent modules as a side effect?
- Is the Windows `wmemoryview` / WSL2 page-handling causing fragmentation?
- Is there a per-page memory leak in the iteration loop?
- Does running the same fixture against pure in-process `import fitz` (in a
  fresh Python process with NO Docling imports) succeed cleanly?

### Q2: What's the lightest reliable replacement for `docling_tf` tables?

Candidates (in rough order of expected weight / quality balance):
- **PyMuPDF Tables API** (`page.find_tables()`, added in PyMuPDF 1.23+) — in-process, fast
- **Camelot** (`camelot-py[cv]`) — opencv-based, mature, well-known
- **Tabula** (`tabula-py`) — Java/JVM dependency; high recall on bordered tables
- **Marker** (SEED-018, GPL fence + optional GPU) — strong recall, license risk
- **PyMuPDF4LLM** (SEED-017, AGPL fence) — primarily text/markdown, not tables

Benchmark each on the thesis PDF + 1-2 known-table-heavy fixtures. Measure:
recall (tables found vs ground truth), wall time, peak RSS, install footprint.

### Q3: What's the lightest reliable replacement for `pymupdf_full` (PDF images)?

If Q1 reveals the subprocess OOM is fixable, `pymupdf_full` stays the default.
If not, candidates:
- **PyMuPDF in-process** (mitigate httpx conflict — see below)
- **pdfplumber `Page.images`** (current baseline — works but Form-XObject blind)
- **pdf2image + heuristic** (rasterizes pages → finds bounding-box image regions)

### Q4: Can we eliminate the httpx conflict that forced subprocess isolation in the first place?

The subprocess fence exists because Docling pulls httpx==0.27.x and PyMuPDF (or
something in its dependency tree) wants a different version. With Docling
deprecated (per user direction), can we pin httpx however PyMuPDF wants and
delete `pymupdf_isolated.py` entirely?

### Q5: Should we keep Docling for ANY aspect?

Possible salvage paths:
- Docling equation enrichment (`docling_formula`) — the formula extraction
  pipeline runs OUT of the timeout path? If yes, keep as an opt-in for
  documents where equations matter.
- Docling DOCX backend's XPath logic was ported verbatim in Plan 05's
  `zip_xpath_docx` — we already extracted what we needed; the Docling
  dependency for DOCX images can be removed.

## Scope boundaries

This is NOT a "rip Docling out everywhere" phase. The per-aspect dispatcher
(Phase 071.2 Plan 05) preserves Docling as an OPT-IN engine — keep that
optionality. The phase deliverable is:

1. Root cause + fix for PyMuPDF subprocess OOM (or fallback to in-process
   PyMuPDF with httpx conflict resolved)
2. Benchmark report on 3+ non-Docling table extractors
3. Migration 046 flipping `extraction_table_engine_pdf` default away from
   `docling_tf` to the benchmark winner
4. Migration 046 flipping `extraction_equation_engine` default to `none`
   (Docling formula stays available, just not on by default)
5. Re-run the D-071.2-12 floor verification on the thesis PDF —
   tables ≥ 20, figures ≥ 10, chunks ≥ 200 with the new defaults.

## Cross-references

- [[feedback-docling-skepticism]] — user trust state
- [[project_docling_quality_unproven]] — Docling vs pypdf-legacy shows zero stored-count delta
- [[project_seed006_multimodal_quality]] — original SEED-006 multimodal storage gap
- [[feedback-extraction-root-cause-not-plumbing]] — investigation discipline
- [[feedback-preserve-engine-optionality]] — keep the dispatcher; flip defaults, don't rip the architecture

## Closing Note (2026-05-16)

**Closed by Phase 071.3 (`071.3-docling-demotion-table-engine-full-rip`).**

Outcomes:

- **Q1 (PyMuPDF subprocess OOM root cause):** Sidestepped, not diagnosed.
  Phase 071.3 Plan 04 Phase G ran D-071.3-11 smoke test
  (`backend/tests/integration/test_pymupdf_in_process.py`) which confirmed
  in-process `import fitz` works after the httpx unpin landed. Subprocess fence
  deleted (commit `1482f46`). The OOM was specific to the subprocess plumbing,
  not in-process PyMuPDF.

- **Q2 (lightest reliable replacement for `docling_tf` tables):** **camelot**
  won the Plan 01 bench (`.planning/research/071.3-bench-results.md`). 214
  raw tables on the user's thesis vs pdfplumber's 4 (53.5x); 15 tables on
  `friendly_real.pdf` vs pymupdf's 9 (1.67x). gmft excluded (transformers
  strict-dataclass break on TATR config). Migration 047 sealed the default.

- **Q3 (lightest reliable replacement for `pymupdf_full` PDF images):** Kept
  `pymupdf_full` (now in-process, no fence). Plan 05 UAT confirmed it works
  post-rip but image recall stayed at 20/59 on the thesis — SEED-021 owns
  the lift.

- **Q4 (eliminate the httpx conflict):** Done. `httpx<0.29` upper bound
  removed in Plan 04 Phase F (commit `5317d4b`). Effective resolved version is
  still 0.28.1 (transitive cap from supabase-py's `postgrest==2.29.0`), but
  our requirements.txt no longer carries the policy constraint.

- **Q5 (keep Docling for any aspect):** No. Full hard delete per D-071.3-09.
  Equation engine reduced to `none` (placeholder); no equation extraction is
  shipped in v2.6 — future-phase concern.

Plan 05 UAT (this seed's closing evidence):

| Fixture | Tables | Images | Chunks | Status |
|---|---|---|---|---|
| User thesis PDF | 214 | 20 | 461 | completed |
| friendly_real.pdf | 15 | 1 | 65 | completed |
| reference.docx | 1 | 1 | 2 | completed |

SC#6 ship floor (>=15 tables on thesis for camelot): cleared by 14.3x.
D-071.3-02 engine acceptance floor (>=20 tables on thesis): cleared by 10.7x.

Residual concerns split into:
- **SEED-020** (retrieval-quality audit) — planted at this seed's close
- **SEED-021** (table/image recall lift) — planted at this seed's close
  (image axis trigger: 20 < 45 on the thesis per D-071.3-16)
