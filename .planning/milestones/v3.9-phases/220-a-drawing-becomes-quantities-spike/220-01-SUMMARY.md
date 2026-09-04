---
phase: 220-a-drawing-becomes-quantities-spike
plan: 01
subsystem: backend/extractors
tags: [dxf, cad, ezdxf, takeoff, extraction, metadata]

requires:
  - phase: 217.1-the-library-exactly-as-sketched
    provides: "The Library document ingestion and storage pipeline"
provides:
  - "`ezdxf>=1.3.0` package promotion in backend/requirements.txt and docs/SANDBOX-PACKAGES.md"
  - "`extract_dxf_takeoff` aspect in backend/app/services/extractors/aspects/dxf.py"
  - "DXF upload and metadata storage pipeline in backend/app/api/documents.py"
  - "Unit test suite in backend/tests/unit/test_dxf_takeoff_extractor.py"
affects: [220-02, 220-03, 220-04]

tech-stack:
  added:
    - "ezdxf>=1.3.0 (MIT)"
  patterns:
    - "Entity extraction for CAD drawings: INSERT blocks for discrete counts, DIMENSION for measurements, MULTILEADER/MTEXT for engineering notes"
    - "Honest unitless refusal: drawings with $INSUNITS=0 are marked refused rather than assuming millimeters"
    - "Zero-schema metadata persistence in documents.metadata['_takeoff']"

key-files:
  created:
    - backend/app/services/extractors/aspects/dxf.py
    - backend/tests/unit/test_dxf_takeoff_extractor.py
  modified:
    - backend/requirements.txt
    - docs/SANDBOX-PACKAGES.md
    - backend/app/api/documents.py

key-decisions:
  - "Accept .dxf and application/dxf in document upload routes"
  - "Extract exact block counts, dimensions, and sanitized spec annotations into documents.metadata['_takeoff']"
  - "Reject guessing millimeters when $INSUNITS=0 — return honest refusal warning"

requirements-completed: [TAKEOFF-01]

completed: 2026-08-30
---

# Phase 220 Plan 01: DXF Entity Extractor & Packaging Summary

**Promoted ezdxf, implemented the CAD modelspace entity extractor, wired DXF ingestion in documents.py, and verified with 4/4 passing unit tests.**

## Summary of Accomplishments
1. Added `ezdxf>=1.3.0` to `backend/requirements.txt` and documented it in `docs/SANDBOX-PACKAGES.md`.
2. Created `backend/app/services/extractors/aspects/dxf.py` which extracts:
   - Blocks (`INSERT`): counts of structural sections, doors, hardware.
   - Dimensions (`DIMENSION`): true CAD measurement spans.
   - Specs (`MULTILEADER`, `MTEXT`, `TEXT`): sanitized engineering notes.
   - Layer line lengths (flagged as order-of-magnitude).
   - Units (`$INSUNITS`): inch, foot, mm, cm, m, with refusal on code 0 (`unitless`).
3. Wired `.dxf` handling in `backend/app/api/documents.py` to extract text summary for search indexing and persist `_takeoff` in metadata.
4. Created `backend/tests/unit/test_dxf_takeoff_extractor.py` covering block counts, units, refusal, and MTEXT sanitization (4/4 tests green).
