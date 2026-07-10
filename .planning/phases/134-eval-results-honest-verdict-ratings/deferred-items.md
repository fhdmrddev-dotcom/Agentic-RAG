# Phase 134 — Deferred Items (out-of-scope discoveries)

Logged per the executor SCOPE BOUNDARY: issues encountered during execution that are NOT
directly caused by this phase's changes are recorded here and left unfixed.

## Pre-existing backend unit-test rot (discovered during Plan 134-03 full-suite run)

**Discovered:** 2026-07-01 (Plan 134-03 execution, running the success-criteria full suite)
**Status:** pre-existing — NOT a regression from Plan 134-03
**Disposition:** out of scope (do NOT fix in 134); candidate for a dedicated backend test-rot
cleanup pass (sibling to the frontend vitest rot SEED-056 / E2E rot SEED-049).

`cd backend && venv/Scripts/python -m pytest tests/ --ignore=tests/integration -q` reports
**70 failed, 1461 passed** (86s). The full `pytest tests/ -q` (including the live-service
`tests/integration/` folder, which needs a running Redis + local Supabase :54322) reports
**125 failed, 1985 passed, 1 error** (~12 min) — the extra failures are integration tests
gated on live services this run did not have.

**Proof these are pre-existing, not caused by 134-03:** Plan 134-03's entire footprint is
`backend/app/api/evals.py` (+117/-1) + `backend/app/models/eval_run.py` (+18) + the new
`backend/tests/test_evals_router.py`. Every failing test file below — and its
system-under-test module — is byte-identical between baseline (`HEAD~1`) and now
(`git diff --stat HEAD~1..HEAD` shows only the two eval files). Therefore their pass/fail
status is unchanged by this plan. The eval-domain slice is fully green
(`test_eval_runner.py` 11 + `test_evals_router.py` 2 = 13 passed), and all 1461
app.main-importing hermetic tests pass, so the additive eval router/model change imports and
wires cleanly.

**Failing files (hermetic, 70 total) — all unrelated to the eval domain:**

| File | # | Failure class (sampled) |
|------|---|-------------------------|
| `tests/unit/test_retrieval_service.py` | 15 | mock drift — `Expected 'embed_texts' to be called once. Called 0 times.` |
| `tests/unit/test_sql_service.py` | 12 | mock/API drift on `query_documents` validation + RPC |
| `tests/unit/test_multimodal_query.py` | 5 | `TypeError` on query-tables signature |
| `tests/unit/test_sandbox_service.py` | 3 | `harvest_output_files` upload/insert mock drift |
| `tests/unit/test_module7_tools.py` | 2 | tool-surface drift |
| `tests/unit/test_phase56_iteration_start.py` | 1 | threads.py iteration-start source assertion |
| `tests/unit/test_streaming_reliability.py` | 1 | `persist_assistant_message` sync-shape assertion |

These are the classic conftest-mock / API-signature drift rot (same class as the documented
frontend vitest rot and Playwright E2E rot). None touch `evals.py`, `eval_run.py`,
`eval_runner_service.py`, or any eval test. No action taken in 134-03.

## Pre-existing frontend `tsc -b` rot (discovered during Plan 134-04 build gate)

**Discovered:** 2026-07-01 (Plan 134-04 execution, running the plan's `cd frontend && npm run build` gate)
**Status:** pre-existing — NOT a regression from Plan 134-04
**Disposition:** out of scope (do NOT fix in 134); frontend analog of the backend test-rot above
(sibling to the frontend vitest rot SEED-056 / E2E rot SEED-049). Deploy is unaffected — the
production Vercel build runs `vite build` only (skips `tsc`, per the documented vercel.json note).

`npm run build` is `tsc -b && vite build`. At **HEAD (before any 134-04 change)** `tsc -b`
already exits **2** with **29 errors** across unrelated files/tests; `vite build` exits **0**.

**Proof these are pre-existing, not caused by 134-04:** captured the full `tsc -b` error set
(a) with my three files reverted to HEAD and (b) with my changes applied — **both sets contain
exactly 29 errors**, and `comm -23` of the two sets is empty except for ONE cosmetic message-text
drift: the pre-existing `src/lib/api.test.ts(131,5)` `StreamCallbacks` mismatch (a rotted test
file) shifted its counter from "…42 more" → "…43 more" purely because I added one *optional*
`onEvalVerdict` callback to `SubscribeCallbacks`. **Zero** errors reference my actual source files
(`api.ts`, `types/index.ts`, `SkillEvalSection.tsx`). My changes are type-clean.

**Gate substitution used for 134-04 (documented in 134-04-SUMMARY):** because the `tsc -b`
baseline is pre-existing-broken, the plan's "`npm run build` exits 0" gate is met in its
verifiable intent by (1) the error-set diff proving **zero new `tsc` errors** from my files and
(2) `vite build` (the real deploy gate) exiting **0**. No unrelated rot was fixed (SCOPE BOUNDARY).

**Failing files (29 `tsc` errors, all unrelated to the eval domain):** `src/__tests__/**`
(IngestionPage / useDocuments / useFolders / useMessages), `components/chat/__tests__/ChatAreaMode`,
`components/chat/MessageSkeleton.tsx` (`JSX` namespace), `components/layout/__tests__/ChatLayoutLaunch`,
`components/layout/NavPanel.tsx` (unused `Button`), `components/panel/__tests__/FilesSection`,
`components/panel/FilePreview.test.tsx`, `components/settings/MemorySection.tsx`,
`components/skills/SkillFormDialog.tsx` (`RefObject` nullability), `lib/api.test.ts`,
`pages/SettingsPage.tsx`, `providers/StreamsProvider.tsx` (unused `getActiveRuns`),
`stores/streamsStore.ts` (zustand `StateCreator` variance). No action taken in 134-04.
