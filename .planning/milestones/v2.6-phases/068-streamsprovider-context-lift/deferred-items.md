# Phase 068 — Deferred Items (Out-of-Scope Discoveries)

These are pre-existing issues discovered during Plan 068-01 execution that are
NOT caused by Plan 068-01 changes. Per executor scope-boundary rule, they are
out-of-scope for this plan and logged here for later attention.

## Baseline test failures (4) — pre-existing on `worktree-agent-aa180cad60b87864e` HEAD before Plan 068-01

All four failures reproduced on baseline (verified via `git stash` of Plan
068-01 App.tsx changes, then `npm test` — identical 4-failure result).

| File                                          | Test                                              | Surface                  |
| --------------------------------------------- | ------------------------------------------------- | ------------------------ |
| `src/__tests__/components/MessageItem.test.tsx` | full file FAIL                                   | rendering (Phase 067 era) |
| `src/lib/model-info.test.ts`                  | `should have correct costTier values for known models` | model registry           |
| `src/__tests__/lib/api.test.ts`               | `listSkillFiles sends GET to …`                  | skills API client        |
| `src/__tests__/lib/api.test.ts`               | `uploadSkillFile sends POST with FormData …`     | skills API client        |
| `src/__tests__/lib/api.test.ts`               | `deleteSkillFile sends DELETE to …`              | skills API client        |

Root-cause pattern for api.test.ts failures: assertion expects
`http://localhost:8000/...` but receives `undefined/...` (API_BASE env var
unset in test environment / fetch mock not matching FormData shape).

## Baseline TypeScript build errors (30) — pre-existing

`npm run build` (`tsc -b && vite build`) fails with 30 TS errors on baseline.
Same 30 errors reproduce both WITH and WITHOUT Plan 068-01 changes — verified
via stashed diff.

Affected files (none touched by Plan 068-01):

- `src/__tests__/components/FolderNode.test.tsx` — Props missing `currentUserId`, `onToggleGlobal`
- `src/__tests__/components/FolderTree.test.tsx` — same Props gap
- `src/__tests__/components/IngestionPage.test.tsx` — `beforeEach` not imported
- `src/__tests__/hooks/useDocuments.test.ts` — Promise return-type mismatch
- `src/__tests__/hooks/useFolders.test.ts` — unused `result`
- `src/components/chat/MessageItem.tsx` — unused `allToolsDone`
- `src/components/ingestion/DocumentList.tsx` — unused `currentVersionNumber`
- `src/components/layout/NavPanel.tsx` — unused `Button` import
- `src/components/settings/MemorySection.tsx` — `.finally` on PromiseLike
- `src/components/skills/SkillFormDialog.tsx` — RefObject<HTMLInputElement | null> vs <HTMLInputElement>
- `src/pages/SettingsPage.tsx` — stale `web_search_enabled`, `tooltip` prop on label component

## Action

These should be addressed in a dedicated cleanup phase (not Phase 068). Plan
068-01 acceptance criteria for `npm run build` / `npm test` exit 0 cannot be
met until baseline is green. Per scope-boundary rule, Plan 068-01 is
considered DONE when its OWN new files compile clean (verified: 0 errors in
`stores/streamsStore.ts`, `providers/StreamsProvider.tsx`, `App.tsx`) and the
test/build error counts are unchanged from baseline.
