---
phase: 220-a-drawing-becomes-quantities-spike
plan: 03
subsystem: frontend/library
tags: [takeoff, boq, ui, document-detail-panel, disambiguation, csv-export]

requires:
  - plan: 220-02
    provides: "Takeoff API routes and matching/resolution contracts"
provides:
  - "Takeoff API client in frontend/src/lib/api/takeoff.ts and re-exports in frontend/src/lib/api.ts"
  - "`TakeoffSection` component in frontend/src/components/metadata/TakeoffSection.tsx"
  - "Takeoff accordion mount in frontend/src/components/metadata/DocumentDetailPanel.tsx"
  - "Unit test suite in frontend/src/components/metadata/__tests__/TakeoffSection.test.tsx"
affects: [220-04]

tech-stack:
  added: []
  patterns:
    - "Interactive BOQ table with basis chips (READ, MATCHED, NEEDS REVIEW, UNPRICED)"
    - "Inline disambiguation dropdown on ambiguous rows with instant update"
    - "One-click CSV Bill of Quantities export"
    - "KPI Summary cards showing estimated cost, priced items, and review status"

key-files:
  created:
    - frontend/src/lib/api/takeoff.ts
    - frontend/src/components/metadata/TakeoffSection.tsx
    - frontend/src/components/metadata/__tests__/TakeoffSection.test.tsx
  modified:
    - frontend/src/lib/api.ts
    - frontend/src/components/metadata/DocumentDetailPanel.tsx

key-decisions:
  - "Mount Takeoff section automatically when viewing a DXF or takeoff-holding document in DocumentDetailPanel"
  - "Provide rate sheet picker dropdown listing available spreadsheets from the Library"
  - "Render candidate selector dropdown for ambiguous rows allowing instant operator resolution"
  - "Provide client-side CSV download formatted for spreadsheet viewers"

requirements-completed: [TAKEOFF-04]

completed: 2026-08-30
---

# Phase 220 Plan 03: Takeoff & Quantities UI in DocumentDetailPanel Summary

**Created frontend Takeoff API client, built TakeoffSection component with KPI cards, BOQ table, candidate disambiguation, CSV export, and wired into DocumentDetailPanel, verified with 3/3 passing vitest tests and 9/9 metadata suites passing.**

## Summary of Accomplishments
1. Created `frontend/src/lib/api/takeoff.ts` with `fetchDocumentTakeoff`, `matchDocumentTakeoff`, `resolveDocumentTakeoffItem`, and re-exported in `frontend/src/lib/api.ts`.
2. Created `frontend/src/components/metadata/TakeoffSection.tsx`:
   - Summary cards: Total Estimated Cost ($), items priced, ambiguity alert count, drawing units.
   - Reference Rate Sheet picker & "Match Rates" button with spinner.
   - BOQ item table with badges: `READ (EXACT)`, `MATCHED`, `NEEDS REVIEW`, `UNPRICED`.
   - Inline disambiguation dropdown for ambiguous rows.
   - "Export Takeoff (CSV)" action.
3. Mounted `TakeoffSection` in `frontend/src/components/metadata/DocumentDetailPanel.tsx` after the Details section for `.dxf` documents.
4. Created `frontend/src/components/metadata/__tests__/TakeoffSection.test.tsx` (3/3 tests green).
