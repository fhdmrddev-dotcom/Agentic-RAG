# Phase 123.1 — Deferred Items (out-of-scope discoveries)

## 123.1-05 execution

- **vitest cannot run in this environment (pre-existing, env-only).** `node node_modules/vitest/vitest.mjs run`
  fails with `Cannot find module './rolldown-binding.win32-x64-msvc.node'` — the `rolldown` native
  binding `.node` file is absent from the local `node_modules` install (and `node_modules/.bin/` has no
  symlinks). This is an install/platform artifact, NOT a code defect. The Task 2/3 verify commands
  anticipate this with the `|| npx tsc --noEmit` fallback; `tsc --noEmit` (run via
  `node node_modules/typescript/bin/tsc`) is the authoritative frontend gate and passes clean.
  The tuner vitest suites (CaseEditor / ProviderScoreboard / CandidateCard) were NOT re-run here.
  Re-run them once the rolldown binding is reinstalled (`npm rebuild rolldown` / fresh `npm install`).
