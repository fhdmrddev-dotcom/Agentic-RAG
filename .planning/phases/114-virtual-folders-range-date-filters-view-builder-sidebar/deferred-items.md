# Phase 114 — Deferred / Out-of-Scope Items

Discovered during execution. NOT fixed (out of scope per the SCOPE BOUNDARY — these
are pre-existing failures in files unrelated to this plan's tasks).

## Pre-existing `tsc -b` build errors (Plan 04, 2026-06-19)

`cd frontend && npm run build` runs `tsc -b && vite build`. The `tsc -b` step fails
on PRE-EXISTING type errors in files this plan never touched. Verified present at base
commit `1c0caf55` (parent of the first Plan-04 commit `8a388653`) — NOT introduced by
Plan 04. None of Plan 04's touched files (NavRow / FolderNode / FolderTree /
DocumentList / IngestionPage) produce any type error (`npx tsc --noEmit` is clean for
them).

| File | Error |
|------|-------|
| `src/components/skills/SkillFormDialog.tsx:392` | TS2322 `RefObject<HTMLInputElement \| null>` not assignable to `RefObject<HTMLInputElement>` |
| `src/lib/api.test.ts:131` | TS2322 `onDelta?` optional not assignable to required `StreamCallbacks.onDelta` |
| `src/pages/SettingsPage.tsx:730` | TS2561 `web_search_enabled` not in `SettingsUpdate` |
| `src/pages/SettingsPage.tsx:965` | TS2322 `tooltip` prop does not exist on the labeled component |
| `src/providers/StreamsProvider.tsx:74` | TS6133 `getActiveRuns` declared but never read |
| `src/stores/streamsStore.ts:288` | TS2345 `StateCreator` viewedThreadId `string \| null` vs `null` |

These belong to Skills, Settings, and the streaming/StreamsProvider surfaces — out of
the Documents/virtual-folders domain. Route to the owning phase or a frontend
type-debt cleanup. Plan 04 verification relies on `npx tsc --noEmit` (clean for touched
files) + `vitest` (green) rather than the blocked `tsc -b` whole-project build.
