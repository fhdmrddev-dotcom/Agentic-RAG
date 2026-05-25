---
phase: 076-confidence-recalibration
plan: 02
subsystem: api
tags: [confidence, calibration, thresholds, cosine-similarity, text-embedding-3-small, statistics]

# Dependency graph
requires:
  - phase: 076-01
    provides: scripts/calibrate_confidence.py reusable CLI calibration tool
  - phase: 071.3
    provides: post-071.3 default extraction stack (camelot/pymupdf_full/legacy/none)
  - phase: 032.5
    provides: original _compute_confidence thresholds (0.55/0.40)
provides:
  - "Recalibrated _compute_confidence thresholds (0.54/0.38) based on live corpus evidence"
  - "PROJECT.md Confidence Calibration appendix with full distribution data and re-run instructions"
  - "knowledge_health.py thresholds aligned to new boundaries (D-07)"
  - "test_citations_confidence.py assertions locked to new threshold values"
affects: [081.1, 082]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Data-driven threshold adjustment: run calibration script -> analyze distribution -> apply D-04 validate-or-adjust decision"
    - "Calibration evidence documented inline in function docstring (sample size, date, bucket proportions)"

key-files:
  created: []
  modified:
    - backend/app/api/threads.py
    - backend/app/api/knowledge_health.py
    - backend/tests/unit/test_citations_confidence.py
    - .planning/PROJECT.md

key-decisions:
  - "D-04 ADJUST path taken: post-071.3 distribution shifted lower (median 0.4861 vs prior 0.55+ regime); 0.55/0.40 produced 14%/54%/32% buckets (too few 'high'); 0.54/0.38 restores ~30/45/25 target"
  - "knowledge_health.py thresholds updated per D-07 alignment mandate (LOW_CONF_THRESHOLD 0.40->0.38, HIGH_CONF_THRESHOLD 0.50->0.44)"
  - "Telemetry: pdf_extraction_runs.engine schema confirmed correct; 0 recent extraction rows in 30d window (no extraction triggered recently) -- column will populate on next /upload or /reextract"

patterns-established:
  - "Confidence recalibration workflow: run scripts/calibrate_confidence.py -> review output -> apply threshold changes -> update tests -> document in PROJECT.md appendix"

requirements-completed: [RAG-RECAL-01]

# Metrics
duration: ~15min (across two executor sessions with operator review checkpoint)
completed: 2026-05-25
---

# Phase 076 Plan 02: Apply Calibration Findings Summary

**Confidence thresholds adjusted from 0.55/0.40 to 0.54/0.38 based on 121-query calibration against post-071.3 corpus, restoring D-04 target bucket balance (30.6% high / 45.5% medium / 24.0% low); evidence documented in PROJECT.md appendix**

## Performance

- **Duration:** ~15 min (split across initial execution + operator review checkpoint + finalization)
- **Started:** 2026-05-25T00:25:00Z
- **Completed:** 2026-05-25T05:59:00Z
- **Tasks:** 3 (2 auto + 1 checkpoint:human-verify)
- **Files modified:** 4

## Accomplishments
- Ran calibration script against live Supabase (N=121 queries: 100 audit_log + 21 synthetic) and identified D-04 ADJUST path: post-071.3 distribution shifted lower (median avg_similarity 0.4861)
- Updated `_compute_confidence` thresholds from 0.55/0.40 to 0.54/0.38, restoring D-04 target bucket balance (~30%/45%/25%)
- Aligned `knowledge_health.py` thresholds per D-07 mandate (LOW_CONF_THRESHOLD 0.40->0.38, HIGH_CONF_THRESHOLD 0.50->0.44)
- Added Confidence Calibration appendix to PROJECT.md with full distribution data, percentiles, bucket proportions, verdict, and re-run instructions
- Verified messages.confidence_* schema unchanged (D-v2.5-12 contract preserved)
- All 14 test_citations_confidence.py tests passing with updated threshold assertions
- Operator reviewed and approved calibration outcome

## Task Commits

Each task was committed atomically:

1. **Task 1: Run calibration script and apply threshold decision** - `82e885c` (feat)
2. **Task 2: Document calibration in PROJECT.md and verify telemetry** - `7eaf735` (docs)
3. **Task 3: Operator review of calibration outcome** - No commit (checkpoint:human-verify -- operator approval only)

## Files Created/Modified
- `backend/app/api/threads.py` - Updated `_compute_confidence` thresholds (0.54/0.38) + Phase 076 docstring with calibration evidence
- `backend/app/api/knowledge_health.py` - Aligned LOW_CONF_THRESHOLD (0.38) and HIGH_CONF_THRESHOLD (0.44) per D-07
- `backend/tests/unit/test_citations_confidence.py` - Updated CONFIDENCE_THRESHOLDS dict + boundary assertions + docstrings
- `.planning/PROJECT.md` - Added Confidence Calibration appendix (distribution, percentiles, bucket proportions, verdict, re-run instructions)

## Decisions Made
- **D-04 ADJUST taken over VALIDATED:** Old thresholds (0.55/0.40) produced 14%/54%/32% bucket split under the post-071.3 chunk population (camelot tables + pymupdf_full images + legacy text). The shift is expected -- new extractors produce different chunk representations that score differently against text-embedding-3-small. New 0.54/0.38 thresholds restore the target ~30%/45%/25% balance.
- **D-07 alignment applied:** knowledge_health.py constants updated to match the new _compute_confidence boundaries (not left stale for Phase 081.1).
- **Telemetry disposition:** pdf_extraction_runs.engine schema confirmed correct but 0 recent rows (no extraction in 30-day window). This is expected -- column populates on next /upload or /reextract. Not a defect.

## Deviations from Plan

None -- plan executed exactly as written. The calibration script recommended ADJUST and the ADJUST path was followed per the plan's conditional logic.

## Issues Encountered

None.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness
- RAG-RECAL-01 is CLOSED -- confidence thresholds are recalibrated with documented evidence
- Q-v2.6-03 is EXECUTED -- the "re-run calibration on new defaults" path has been followed
- Phase 077 (Multi-Worker Validation Harness) can proceed -- no dependencies on 076 output
- Phase 082 (Cross-cutting Verification) can reference the new thresholds for baseline validation
- Future recalibration can be triggered by running: `cd backend && venv/Scripts/python.exe ../scripts/calibrate_confidence.py`

## Self-Check

Verified below.

---
*Phase: 076-confidence-recalibration*
*Completed: 2026-05-25*
