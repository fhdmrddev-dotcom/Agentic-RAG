# Phase 100 — Deferred Items

Out-of-scope discoveries logged during execution (NOT fixed — per executor scope boundary).

## Plan 100-06 (frontend panel UI)

- **`frontend/src/components/panel/__tests__/PhaseReconcile.test.tsx` — pre-existing worktree-env failure.**
  - **Symptom:** `Error: supabaseUrl is required` (suite fails to collect; 0 tests run).
  - **Root cause:** the suite imports a module that constructs the real `@supabase/supabase-js` client at top level; the parallel worktree shell lacks `VITE_SUPABASE_URL`. NOT caused by Plan 100-06 — `PhaseReconcile.test.tsx` does not import `FilesSection` (grep = 0 matches), and the failure reproduces identically in isolation against the unchanged file.
  - **Class:** the SEED-056 / worktree-env rot family noted across prior Phase 100 plan summaries (worktree shell missing env). The FilesSection suite (the Plan 100-06 deliverable) is fully green: 11 passed / 0 skipped, up from the 8-passed/3-skipped baseline.
  - **Disposition:** out of scope for Plan 100-06 (only auto-fix issues directly caused by the current task). Left untouched.
