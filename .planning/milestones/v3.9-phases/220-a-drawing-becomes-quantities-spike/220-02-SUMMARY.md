---
phase: 220-a-drawing-becomes-quantities-spike
plan: 02
subsystem: backend/takeoff
tags: [takeoff, rate-sheet, boq, matcher, anti-ambiguity, pricing]

requires:
  - plan: 220-01
    provides: "DXF entity extraction and takeoff metadata payload"
provides:
  - "`load_rate_sheet_rows` in backend/app/services/takeoff/matcher.py"
  - "`match_takeoff_to_rates` with anti-ambiguity rule in backend/app/services/takeoff/matcher.py"
  - "`resolve_takeoff_item` in backend/app/services/takeoff/matcher.py"
  - "Takeoff API routes in backend/app/api/takeoff.py"
  - "Unit test suite in backend/tests/unit/test_takeoff_matcher.py"
affects: [220-03, 220-04]

tech-stack:
  added: []
  patterns:
    - "Anti-Ambiguity Invariant (G-6 / TAKEOFF-03): ambiguous spec matches are escalated to human review, never silently priced by list position"
    - "Basis provenance: every line carries explicit basis ('read', 'matched', 'ambiguous', 'unpriced')"
    - "Dynamic item resolution: operator can choose a candidate rate code to immediately recalculate BOQ totals"

key-files:
  created:
    - backend/app/services/takeoff/matcher.py
    - backend/app/api/takeoff.py
    - backend/tests/unit/test_takeoff_matcher.py
  modified:
    - backend/app/main.py

key-decisions:
  - "When a drawing spec matches more than one rate line (e.g. Gypsum Board matching both ceiling and wall board), status is set to 'ambiguous' and amount is left None until resolved by a person"
  - "Counted items from exact CAD blocks are priced with basis='read'"
  - "Mounted POST /documents/{id}/takeoff/match and PATCH /documents/{id}/takeoff/resolve endpoints"

requirements-completed: [TAKEOFF-02, TAKEOFF-03]

completed: 2026-08-30
---

# Phase 220 Plan 02: Rate Sheet Matcher & Anti-Ambiguity Engine Summary

**Implemented rate sheet extraction via extract_excel_tables, anti-ambiguity matching engine, operator resolution logic, and REST API endpoints, verified with 6/6 passing unit tests.**

## Summary of Accomplishments
1. Created `backend/app/services/takeoff/matcher.py`:
   - `load_rate_sheet_rows()`: Parses `.xlsx`/`.csv` rate tables into normalized `{code, desc, unit, rate}` records.
   - `match_single_item()`: Enforces G-6 anti-ambiguity rule — returns `ambiguous` with candidate list if >1 rate line matches.
   - `match_takeoff_to_rates()`: Computes priced BOQ, subtotaling counted blocks and unpriced/ambiguous lines.
   - `resolve_takeoff_item()`: Applies human-selected rate code to resolve an ambiguous line and recalculate total cost.
2. Created `backend/app/api/takeoff.py` and registered router in `backend/app/main.py`:
   - `POST /documents/{id}/takeoff/match`
   - `PATCH /documents/{id}/takeoff/resolve`
   - `GET /documents/{id}/takeoff`
3. Created `backend/tests/unit/test_takeoff_matcher.py` (6/6 tests green).
