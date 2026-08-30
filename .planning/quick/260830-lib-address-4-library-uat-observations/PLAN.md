# Quick Task: Address 4 Library UAT Observations (2026-08-30)

<task_description>
Address the 4 operator UAT observations from 2026-08-30 against sketch 218:
1. Layout space in upper-right / narrow scroll: Remove trapped nested scrollbars across tabs and unify scroll container on LibraryPage.
2. Skeleton loaders instead of "Not known yet": Add proper pulse skeleton loaders during in-flight fetches across Health stat tiles, Documents stat tiles, Vector store card, Embedding model card, and Folders table.
3. Match Strength 6800%: Normalize 0-100 vs 0-1 scale in HealthTab.tsx so 68 yields 68%, not 6800%.
4. Fake Re-index selected: Add Content-Type header in kickReembed to ensure FastAPI parses folder_ids body and folder-scoped re-embed functions correctly.
</task_description>

<objective>
Restore sketch fidelity and operational correctness across the Library's Documents, Indexing, and Health tabs by fixing score scaling, API request body serialization, loading skeletons, and layout scrolling.
</objective>

<files_modified>
- frontend/src/components/library/HealthTab.tsx
- frontend/src/components/library/LibraryStatTiles.tsx
- frontend/src/components/library/indexing/VectorStoreCard.tsx
- frontend/src/components/library/indexing/EmbeddingModelCard.tsx
- frontend/src/components/library/indexing/FoldersIndexTable.tsx
- frontend/src/lib/api/settings.ts
- frontend/src/pages/LibraryPage.tsx
- frontend/src/components/library/IndexingTab.tsx
- frontend/src/components/library/__tests__/HealthTiles.test.tsx
- frontend/src/components/library/__tests__/LibraryStatTiles.test.tsx
- frontend/src/components/library/__tests__/IndexFoldersTable.test.tsx
</files_modified>

<tasks>
1. Fix Match Strength scaling in HealthTab.tsx to handle 0-100 scale correctly without multiplying 68 by 100.
2. Fix kickReembed API client in settings.ts to include Content-Type: application/json when folder_ids is provided.
3. Add skeleton loading states during in-flight fetches across HealthTab, LibraryStatTiles, VectorStoreCard, EmbeddingModelCard, FoldersIndexTable instead of flashing "Not known yet" or invalid dates.
4. Remove nested overflow-y-auto traps from documentSurface, HealthTab, IndexingTab to ensure full-width, unified page scrolling on LibraryPage.
5. Verify with automated tests in frontend.
</tasks>
