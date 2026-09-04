# Quick Task Summary: Address 4 Library UAT Observations (2026-08-30)

**Date:** 2026-08-30  
**Status:** Complete  
**Verification:** Vitest count gate OK (171/171 pinned files, 0 failing, 6,928 total tests)

## Overview

Addressed the 4 operator UAT observations from 2026-08-30 against sketch 218:

1. **Match Strength 6800% (HealthTab.tsx)**:
   - Fixed similarity percentage scaling in `HealthTab.tsx`'s `toStatTiles`. Backend returns `health_score` on a 0–100 scale (e.g. `68`); previously it was multiplied by 100 yielding `6800%`. Normalized to handle both `>1` (0–100) and `≤1` (fractional) inputs so `68` renders as `68%`.

2. **Fake "Re-index selected" (FoldersIndexTable.tsx & settings.ts)**:
   - Fixed `kickReembed` in `frontend/src/lib/api/settings.ts` to include `Content-Type: application/json` header when serializing `{ folder_ids }`. FastAPI requires `application/json` to parse `ReembedKickBody`.
   - Updated `FoldersIndexTable.tsx` to handle in-flight state with button disabled and "Re-indexing..." text, returning actionable feedback upon completion.

3. **Loader instead of "Not known yet" (HealthTab.tsx, LibraryStatTiles.tsx, indexing cards)**:
   - `HealthTab.tsx`: Checked queries tile renders animated skeleton bars while `checkedCount === null` instead of flashing "Not known yet".
   - `LibraryStatTiles.tsx`: While in-flight (`vectors.value === null && !vectors.error`), renders loading state rather than "Not known yet", reserving "Not known yet" exclusively for unreachable/error states.
   - `VectorStoreCard.tsx`, `EmbeddingModelCard.tsx`, `FoldersIndexTable.tsx`: Added pulse skeletons for fact rows and table rows during initial fetch when `summary === null`.

4. **Space in upper-right / narrow scroll (LibraryPage.tsx, HealthTab.tsx, IndexingTab.tsx)**:
   - Removed redundant nested `overflow-y-auto` traps from `documentSurface` inner column in `LibraryPage.tsx`, root div of `HealthTab.tsx`, and section in `IndexingTab.tsx`.
   - Unified vertical scrolling on the outer `LibraryPage` container (`flex flex-col h-full overflow-y-auto p-8`), eliminating cramped mid-column scrollbars and restoring full-viewport scroll ergonomics.

## Files Modified

- `frontend/src/components/library/HealthTab.tsx`
- `frontend/src/components/library/LibraryStatTiles.tsx`
- `frontend/src/components/library/indexing/VectorStoreCard.tsx`
- `frontend/src/components/library/indexing/EmbeddingModelCard.tsx`
- `frontend/src/components/library/indexing/FoldersIndexTable.tsx`
- `frontend/src/lib/api/settings.ts`
- `frontend/src/pages/LibraryPage.tsx`
- `frontend/src/components/library/IndexingTab.tsx`
- `frontend/src/components/library/__tests__/IndexFoldersTable.test.tsx`
- `.planning/quick/260830-lib-address-4-library-uat-observations/PLAN.md`
- `.planning/quick/260830-lib-address-4-library-uat-observations/SUMMARY.md`

## Verification

- `npx vitest run src/components/library/`: 182 passed across 12 test files.
- `node scripts/vitest-count-gate.cjs`: Passed with 171/171 pinned files present, 0 failing, 6,928 total tests.
