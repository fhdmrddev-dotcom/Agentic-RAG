# Phase 088 — Deferred / Out-of-Scope Items

Logged by the executor per the SCOPE BOUNDARY rule (only auto-fix issues directly
caused by the current task's changes; log unrelated pre-existing failures here).

## 088-01 (a11y + vitest-axe gate)

### Pre-existing `tsc -b` type errors (NOT caused by 088-01)

Discovered while running `npx tsc -b` as a sanity check after Task 2. None of these
are in files this plan touched (the plan edited only `index.css`, `setupTests.ts`,
`TodosSection.tsx`, `VersionDiff.tsx`, `FilesSection.tsx`, and the 8 panel test files
— all of which are tsc-clean). Vitest transpiles with esbuild (not tsc), so these do
not block the test suite (the actual plan gate). Left untouched — out of scope for an
a11y phase.

Affected files (pre-existing drift):
- `src/__tests__/components/FolderNode.test.tsx` — `FolderNodeProps` missing `currentUserId`/`onToggleGlobal` (test fixtures lag the component props)
- `src/__tests__/components/FolderTree.test.tsx` — same `FolderTreeProps` drift
- `src/__tests__/components/IngestionPage.test.tsx` — `Cannot find name 'beforeEach'` (missing import)
- `src/__tests__/hooks/useDocuments.test.ts` — return-type mismatch (`isDuplicate` vs `void`)
- `src/__tests__/hooks/useFolders.test.ts` — unused `result` (TS6133)
- `src/__tests__/hooks/useMessages.test.ts` — `isStreaming` not in `StreamsState`; arg-count drift
- `src/components/chat/MessageSkeleton.tsx` — `Cannot find namespace 'JSX'`
- `src/components/ingestion/DocumentList.tsx` — unused `currentVersionNumber` (TS6133)

Suggested routing: a dedicated v2.8 test/type-hygiene sweep (not a milestone-close gate item).
