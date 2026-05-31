# Deferred items — Phase 092

Out-of-scope discoveries logged during execution (NOT fixed — they predate this
phase and are unrelated to the dual-mode/Continue surface). Per the GSD SCOPE
BOUNDARY rule: only auto-fix issues DIRECTLY caused by the current task's changes.

## Pre-existing `tsc -b` (frontend `npm run build` typecheck) failures — 54 errors

Discovered during Plan 092-04 Task 3 (`cd frontend && npm run build` → `tsc -b && vite build`).
Verified pre-existing by temporarily restoring the pre-092-04 baseline versions of
all five files this plan touches (api.ts, streamsStore.ts, StreamsProvider.tsx,
useMessages.ts) and re-running `npx tsc -b --force`: **54 errors at baseline, 54
with all of Plan 092-04's changes — ZERO net new.**

The project's `tsc -b` gate has been RED at baseline; the app ships via `vite build`
(esbuild — type-error-tolerant), which I confirmed succeeds cleanly (only pre-existing
chunk-size + dynamic-import warnings, no errors). The 54 errors are accumulated
test/lint debt across files this plan never touched. Representative clusters:

| Cluster | Symptom |
|---------|---------|
| `src/__tests__/components/FolderNode.test.tsx` / `FolderTree.test.tsx` (≈19) | `FolderNodeProps`/`FolderTreeProps` gained `currentUserId` + `onToggleGlobal`; the test fixtures were never updated |
| `src/components/panel/__tests__/*.test.tsx` (`toHaveNoViolations`, ≈14) | vitest-axe matcher type not augmented in those test files (Phase 088 wired the matcher but the `Assertion` augmentation is missing in these specs) |
| `src/__tests__/hooks/useMessages.test.ts` (≈5) | stale `isStreaming` store-shape + `sendMessage` arity drift (predate the 075.4 per-thread lift) |
| `src/components/chat/MessageSkeleton.tsx` | `Cannot find namespace 'JSX'` (React 19 JSX-namespace change, unrelated file) |
| `src/__tests__/components/IngestionPage.test.tsx` | `Cannot find name 'beforeEach'` (missing vitest import in the test) |
| `src/components/settings/*`, `src/pages/SettingsPage.tsx`, `src/components/skills/SkillFormDialog.tsx` | misc unrelated type drift (`finally` on PromiseLike, `RefObject<T \| null>`, unknown settings keys) |
| `src/providers/StreamsProvider.tsx(72)` | `getActiveRuns` imported but referenced only in comments — pre-existing dead import (NOT introduced here; merely shifted line number) |
| `src/stores/streamsStore.ts` | Zustand-v5 `create<StreamsState>()` literal-inference fallback (`viewedThreadId: 'string \| null' not assignable to 'null'`) — a long-standing store-factory typing quirk; line number shifted from 169→217 because Plan 092-04 added the `workflowLockByThread` field above it, but the error itself is pre-existing |

**Routing:** these belong to a dedicated frontend type-debt sweep (candidate `/gsd:quick`
or a v2.8/v2.9 cleanup phase), NOT this wiring phase. Plan 092-04's own surface is
type-clean: `vite build` succeeds and no NEW `tsc -b` error was introduced.
