# Phase 132 — Deferred / Out-of-Scope Items

## Pre-existing backend test rot (NOT introduced by Plan 02)

The full backend suite (`venv/Scripts/python -m pytest tests/ -q`) reports **124 failed, 1970 passed, 7 skipped, 5 xfailed, 9 xpassed** as of Plan 02 execution (2026-06-30). These failures are pre-existing rot in subsystems **unrelated** to the Plan 02 net-new router:

- `tests/integration/test_threads_skills.py` — `AssertionError: Expected exactly 22 tools in base; got 24` (agent-loop tool registry). Driven by the **pre-existing working-tree modifications** to `backend/app/api/threads.py` + `backend/app/models/thread.py` (present at session start, NOT touched by Plan 02), which add two tools beyond the test's hardcoded `22` expectation.
- `tests/unit/test_sql_service.py` — `query_documents` coroutine-never-awaited / RPC-mock failures.
- `tests/unit/test_sandbox_service.py::TestHarvestOutputFiles` — storage-path / empty-output expectations.
- `tests/unit/test_retrieval_service.py` — document chunk `version_number` enrichment (document versioning, NOT skill versioning).
- `tests/unit/test_streaming_reliability.py` — `_persist_assistant_message` sync assertion.
- `tests/integration/test_077_cross_cancel.py` — zombie-heal collection error.

**Rationale for deferral (SCOPE BOUNDARY rule):** Plan 02 is purely additive — one new module (`backend/app/api/skill_test_cases.py`) + two registration lines in `main.py`. The app boots cleanly (1970 tests pass, including all Plan 02 + adjacent skill-router tests), and none of the 124 failures reference `skill_test_cases` or `skill_versions`. These are tracked under the project's existing rot ledger (`075.4-TEST-TRIAGE.md` ~98 backend failures, SEED-056 frontend rot) and the in-flight working-tree edits to `threads.py`. They are NOT Plan 02 regressions and are out of this plan's scope to fix.

**Plan 02 evidence of green where it counts:**
`pytest tests/integration/test_132_test_cases.py tests/integration/test_skill_tuner_routes.py tests/integration/test_132_skill_versions.py -q` → **51 passed**.

## Pre-existing frontend build rot (NOT introduced by Plan 03)

`npm run build` (`tsc -b && vite build`) reports **29 pre-existing `tsc -b` errors** across 16 unrelated files as of Plan 03 execution (2026-06-30). Verified pre-existing by stashing the Plan 03 changes and re-running the build at HEAD — the error count is **identical (29) with and without Plan 03's changes**, and Plan 03's own files add **zero** new errors:

- `src/stores/streamsStore.ts` — zustand `StateCreator` / `viewedThreadId: string | null` vs `null` typing mismatch (root rot).
- `src/components/skills/SkillFormDialog.tsx(369/520)` — `fileInputRef` `RefObject<HTMLInputElement | null>` vs `RefObject<HTMLInputElement>` (React 19 / `@types/react` ref-typing). On the EXISTING `fileInputRef={fileInputRef}` prop lines (the Phase 123 `useRef<HTMLInputElement>(null)` pattern) — NOT the Plan 03 mount block.
- Plus pre-existing errors in `src/pages/SettingsPage.tsx`, `src/components/layout/NavPanel.tsx`, `src/components/chat/MessageSkeleton.tsx`, `src/components/settings/MemorySection.tsx`, `src/providers/StreamsProvider.tsx`, and ~9 `__tests__`/`*.test.ts(x)` files.

**Rationale for deferral (SCOPE BOUNDARY rule):** Plan 03 is purely additive — one new component (`SkillTestCasesSection.tsx`), four client funcs + four types, and a 7-line mount block in `SkillFormDialog.tsx`. Plan 03's own files typecheck clean: Task 1 `npx tsc --noEmit` (root config) passed with no output, and the `tsc -b` build error count is unchanged at 29 with Plan 03's changes stashed vs applied. This matches the project's `CLAUDE.md` note that `vercel.json`'s `vite build` deliberately skips `tsc` because local `tsc -b` is known-red (SEED-056 frontend rot). These errors are NOT Plan 03 regressions and are out of this plan's scope to fix.
