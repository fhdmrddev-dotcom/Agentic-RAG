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

## Pre-existing backend pytest failures (verified during 092-07 F6 fix)

Discovered during the F6 deviation-fix test sweep (`pytest tests/ -k "harness or
agent_loop or dual_mode or workflow"`). Verified pre-existing by `git stash`-ing the
F6 changes and re-running each in isolation — they fail IDENTICALLY on the clean
baseline. NOT caused by F6 (harness-branch-only; my new fn is `_persist_harness_message`,
not `_persist_assistant_message`).

| Test | Symptom | Root cause |
|------|---------|------------|
| `tests/unit/test_streaming_reliability.py::TestAsyncioShield::test_persist_assistant_message_is_sync` | `'def _persist_assistant_message' not in threads.py source` | Phase 089-03 (G-5 extraction) MOVED `_persist_assistant_message` into `agent_loop.py` (as `async def`); the test still greps threads.py for the obsolete sync def. Already logged in Phase 091 deferred-items. |
| `tests/test_harness_gates.py::test_bounded_retry_reaches_failed_after_3_attempts` | `_audit_failures(pool) == 0`, expected 3 | Test-ordering / shared-mock state sensitivity (the `_MockAsyncpgPool.calls` audit count depends on collection order); fails in the broad `-k` sweep, unrelated to F6. Part of the same stale-test family. |

**Routing:** defer to the backend test-hygiene pass (same family already catalogued
in `091/deferred-items.md`). F6's own surface (`test_dual_mode_wiring.py`) is 100%
green (38 passed, incl. 3 new F6 tests).
