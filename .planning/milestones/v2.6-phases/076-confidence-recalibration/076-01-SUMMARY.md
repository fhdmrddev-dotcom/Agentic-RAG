---
phase: 076-confidence-recalibration
plan: 01
subsystem: scripts
tags: [calibration, psycopg2, pgvector, openai, confidence, statistics, numpy]

# Dependency graph
requires:
  - phase: 071.3
    provides: post-071.3 default extraction stack (camelot/pymupdf_full/legacy/none)
  - phase: 032.5
    provides: current _compute_confidence thresholds (0.55/0.40)
provides:
  - "Reusable scripts/calibrate_confidence.py CLI tool for confidence threshold calibration"
  - "D-08 and D-09 closure: script connects to live Supabase, runs audit_log + synthetic queries, produces report + JSON"
affects: [076-02, 081.1]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Standalone script with backend/.env loading (mirrors observe-run.py)"
    - "Production-equivalent pgvector similarity SQL via psycopg2"
    - "D-04 validate-or-adjust threshold decision logic with bucket tolerance"

key-files:
  created:
    - scripts/calibrate_confidence.py
  modified: []

key-decisions:
  - "Script uses psycopg2 direct connection (not supabase-py) for simplicity, matching observe-run.py pattern"
  - "21 synthetic queries across 4 categories (6 prose, 5 table_referencing, 4 image_referencing, 6 out_of_domain)"
  - "Auto-detect user_id from audit_log when --user-id not provided (falls back to document_chunks if no audit entries)"
  - "match_threshold defaults to 0.01 to see full score distribution (Pitfall 3 mitigation)"

patterns-established:
  - "calibrate_confidence.py: reusable pattern for data-driven threshold validation against live DB"

requirements-completed: [RAG-RECAL-01]

# Metrics
duration: 5min
completed: 2026-05-24
---

# Phase 076 Plan 01: Confidence Calibration Script Summary

**Reusable CLI calibration script connecting to live Supabase via psycopg2, replaying audit_log + 21 synthetic queries through pgvector retrieval, analyzing avg_similarity distribution with numpy, and producing human-readable Markdown report + JSON output**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-24T20:21:33Z
- **Completed:** 2026-05-24T20:27:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created `scripts/calibrate_confidence.py` (678 lines) -- standalone CLI tool per D-08/D-09
- 21 synthetic queries across 4 categories (prose, table_referencing, image_referencing, out_of_domain) for distribution coverage (D-02)
- D-04 validate-or-adjust logic with bucket tolerance analysis (VALIDATED vs ADJUST recommendation)
- pdf_extraction_runs telemetry verification built into the report (SC#4 per-extractor lineage)
- All SQL uses parameterized %s placeholders (T-076-02); no credential values printed (T-076-01)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create calibration script with full pipeline** - `65661cb` (feat)

## Files Created/Modified
- `scripts/calibrate_confidence.py` - Standalone CLI calibration script (678 lines, 10 functions)

## Decisions Made
- Used psycopg2 direct connection over supabase-py for simplicity (matches observe-run.py pattern)
- 21 synthetic queries (not 20) to ensure all 4 categories have adequate coverage
- Auto-detect user_id from audit_log when not provided via CLI; fall back to document_chunks user_id if no audit entries exist
- match_threshold defaults to 0.01 (very low) to see full score distribution per Pitfall 3 from RESEARCH.md
- numpy preferred for percentile/histogram calculations with stdlib statistics fallback

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required. Script uses existing backend/.env credentials.

## Next Phase Readiness
- Plan 02 can now consume the calibration script's JSON output to decide whether thresholds need updating
- Run the script: `cd backend && ./venv/Scripts/python.exe ../scripts/calibrate_confidence.py`
- JSON output at `calibration_results.json` drives the threshold update decision

---
*Phase: 076-confidence-recalibration*
*Completed: 2026-05-24*
