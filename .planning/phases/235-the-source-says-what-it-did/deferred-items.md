# Phase 235 — deferred items (out-of-scope discoveries)

## From plan 235-08 (2026-09-06)

### `src/pages/__tests__/SettingsPage.a11y.test.tsx` — 4 failing, INHERITED

Measured while running the plan's own `src/pages/__tests__` verification:
`Test Files 1 failed | 7 passed (8) · Tests 4 failed | 172 passed (176)`.

The four failures:

- `no aXe structural violations — the 'Show technical names' toggle row`
- `no aXe structural violations — the relabeled tablist`
- `the reveal control is a named toggle BUTTON exposing aria-pressed (real contract, not role=switch)`
- `the tabs render as a tablist with named tabs (Search is the plain default of the relabel)`

**Why it is inherited and not caused by 235-08, argued from the import graph rather than
from a colour.** `git diff 86da3f703 HEAD --name-only` for this plan is exactly five files:
`App.tsx`, `ChatLayout.tsx`, `LibraryPage.tsx`, `LibraryPage.initialTab.test.tsx`,
`librarySelection.test.ts`. The failing suite imports `../SettingsPage`,
`@/providers/TechnicalNamesProvider` and a fully-mocked `@/lib/api` — and
`grep "LibraryPage\|ChatLayout\|@/App\|librarySelection" frontend/src/pages/SettingsPage.tsx`
returns NOTHING. None of the five edited files is reachable from that suite's module graph,
so it could not have been reddened by this plan.

**Not fixed here** (executor scope boundary: only issues directly caused by this task's
changes are auto-fixed). Owner: whichever plan next touches `SettingsPage.tsx` or the
Settings a11y contract — or plan 12, which adopts count-gate knobs and will meet this red if
`src/pages/__tests__` is a directory TARGETS entry.
