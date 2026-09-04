---
phase: 226-the-public-landing-page
plan: 02
subsystem: testing
tags: [drift-guard, facts, living-page, post-tool-use]

requires:
  - 226-01
provides:
  - "Single source of truth manifest in frontend/src/landing/facts.ts"
  - "Automated drift guard in scripts/check-landing-drift.cjs"
  - "Silent PostToolUse hook in .claude/hooks/landing-drift-guard.js"
  - "JSX text-node fence test in frontend/src/landing/__tests__/facts.test.ts"
affects: [226-03, 226-04, 226-05]

tech-stack:
  added: []
  patterns: [source-of-truth derivation guard, AST/regex static extraction]

key-files:
  created:
    - frontend/src/landing/facts.ts
    - scripts/check-landing-drift.cjs
    - .claude/hooks/landing-drift-guard.js
    - frontend/src/landing/__tests__/facts.test.ts
  modified:
    - .claude/settings.json

key-decisions:
  - "F-2: Facts measured at HEAD: 8 model providers, 2 local runtimes, 11 ingest formats, 10 gauntlet stages, 29 tools, 13 connector services"
  - "F-2: Drift guard uses house exit codes: 0 clean, 1 drift, 2 harness error (missing file); zero hardcoded provider workarounds"
  - "F-5: Registered landing-drift-guard.js in .claude/settings.json under PostToolUse (silent on exit 0)"
  - "A-2: Facts test fences JSX text nodes against bare hardcoded claim numbers"

requirements-completed:
  - D-226-04
  - D-226-05
  - D-226-06
  - SC#3
  - SEED-241

duration: 15min
completed: 2026-09-03
---

# Phase 226 Plan 02 Summary

**Typed fact manifest (`facts.ts`), static drift guard (`check-landing-drift.cjs`), and silent PostToolUse hook established.**

## Performance
- **Tasks:** 3 completed
- **Test suites:** `src/landing/__tests__/facts.test.ts` (5/5 passing)
- **Drift guard exit code:** `0` (clean)
- **OWED pin for vitest-count-gate.cjs:** `src/landing/__tests__/facts.test.ts` (5 tests)

## Accomplishments
- Authored `frontend/src/landing/facts.ts` exporting strictly typed and frozen data structures for all quantitative claims, tabs, quotes, and capabilities.
- Authored `scripts/check-landing-drift.cjs` extracting ground truth directly from `backend/app/config.py`, `frontend/src/components/ingestion/acceptedFormats.ts`, `frontend/src/components/workflows/PublishGauntlet.tsx`, `backend/app/services/tool_dispatcher.py`, `frontend/src/components/settings/servicesCatalog.ts`, and tab definitions.
- Created and registered `.claude/hooks/landing-drift-guard.js` in `.claude/settings.json` under `hooks.PostToolUse`, executing silently on clean changes.
- Authored `frontend/src/landing/__tests__/facts.test.ts` verifying exact counts, verbatim quotes, and fencing JSX text nodes against bare un-facted claim numbers.
