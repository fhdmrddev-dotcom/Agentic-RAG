---
phase: 270-the-document-as-an-object
plan: 05
subsystem: registers / live proof
tags: [uat, hot-file-ledger, seed, prod-parity]
requirements: [FIND-04, FIND-05]
key-files:
  created:
    - .planning/phases/270-the-document-as-an-object/270-PROD-PARITY.md
    - .planning/seeds/SEED-329-document-download-audit-trail.md
  modified:
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
---
# Phase 270 Plan 05: Live proof and registers Summary

Tasks 1 and 2 (gates on the merged tree, SC#1-4 and G4-1..G4-5 live drive, fixes F-1 and F-2, cleanup) are
recorded in `270-UAT-LOG.md`; the orchestrator owns the final gate figures. This file covers Task 3 only.

## Task 3: registers for the whole phase

- **Ledger (P-07).** Fifteen files had their triple re-derived after the last source edit (`96d59b622`) and
  refreshed in place, in the scan-list row, a dated "Phase 270" section at the end of `docs/HOT-FILE-LEDGER.md`,
  and the CLAUDE.md G-5-FIRING row, in one commit. `LibraryPage.tsx` was derived with `git log --follow`.
  Six-digit quick-task buckets were subtracted.

| File | Was | Now |
|---|---|---|
| `backend/app/models/document.py` | 10 / 7 / 183 | 11 / 8 / 207 |
| `frontend/src/components/ingestion/DocumentRow.tsx` | 5 / 2 / 469 | 7 / 3 / 476 (now FIRES) |
| `backend/app/services/file_facts.py` | 0 / 0 / 0 | 1 / 1 / 163 |
| `frontend/src/lib/documentDownload.ts` | 0 / 0 / 0 | 2 / 1 / 63 |
| `frontend/src/components/metadata/DocumentDownloadButton.tsx` | 0 / 0 / 0 | 1 / 1 / 146 |
| `frontend/src/components/metadata/DocumentFileFacts.tsx` | 0 / 0 / 0 | 2 / 1 / 113 |
| `frontend/src/lib/api/documents.ts` | 2 / 2 / 389 | 5 / 5 / 450 (now FIRES) |
| `frontend/src/lib/api.ts` | 205 / 122 / 516 | 207 / 123 / 519 |
| `frontend/src/types/index.ts` | 93 / 72 / 1443 | 94 / 73 / 1459 |
| `backend/app/api/documents.py` | 87 / 34 / 2414 (CLAUDE.md 85 / 33 / 2437) | 91 / 35 / 2518 |
| `scripts/vitest-count-gate.cjs` | 259 / 58 / 6196 | 263 / 59 / 6211 |
| `backend/app/models/user_settings.py` | 55 / 34 / 1723 | 57 / 35 / 1742 |
| `frontend/src/pages/LibraryPage.tsx` | 48 / 16 / 993 | 50 / 17 / 994 |
| `frontend/src/components/metadata/DocumentDetailPanel.tsx` | 12 / 7 / 596 (CLAUDE.md 9 / 6 / 496) | 14 / 9 / 614 |
| `backend/app/services/ingest_splice.py` | 15 / 6 / 877 | 19 / 7 / 930 |

  CLAUDE.md gained two rows (`DocumentRow.tsx`, `lib/api/documents.ts`) because both crossed into FIRES.
  The LibraryPage, DocumentRow and DocumentFileFacts paragraphs record the two live-found defects: F-1 (the
  column shed reached the nested version-history table) and F-2 (`Added by` tested the current user before the
  connection). Gate verdicts: `claude-md size gate OK`, `ledger gate OK — every watched file has a row`.
- **Seed (P-03).** `SEED-329-document-download-audit-trail.md`, `status: planted`, non-empty `trigger_paths`.
  329 was free (the max is 330, which reserved 329 for this plan). `seeds register gate OK — 337/337 parsed,
  0 duplicate ids`.
- **Production parity.** `270-PROD-PARITY.md`: migration 199 (operator-approved paste) before the backend
  deploy, read-only verification of five columns and TTL 60, then backend, then frontend; no env var / onebox /
  compose change (`check-deploy-drift.sh`: `RESULT: PASS — the one-box deploy artifacts are in sync`);
  the cloud half of the Wave-0 spike is OWED at deploy; the production advisor baseline (19 findings) is quoted
  verbatim with the instruction to re-run after the cloud apply. `docs/OPERATOR.md` needed no change (199 is
  schema, no Step-3 entry, already stated there). No Supabase write was performed by this plan.
- **graphify update .** Run (AST-only). `graphify-out/` already carried uncommitted operator changes before
  this plan and was NOT staged; `.mcp.json` likewise.

## Deviations from Plan

None. All fifteen triples were re-derivable.

## Self-Check: PASSED
