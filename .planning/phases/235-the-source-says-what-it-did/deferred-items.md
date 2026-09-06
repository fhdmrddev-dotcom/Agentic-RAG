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

⚠ **STILL RED AT PLAN 11, AND STILL INHERITED — re-measured, not assumed.** The same four cases,
and `grep -c "LibraryPage\|HealthTab\|useSourceAttention\|SourcesAttentionSection"
frontend/src/pages/SettingsPage.tsx` returns **0**, so none of plan 11's seven files is reachable
from that suite's module graph either.

## From plan 235-11 (2026-09-06)

### `COPY.roster(total, need)` is authored, pinned by the vocabulary suite, and rendered by NOTHING

`grep -rn "COPY.roster" frontend/src` returns only `sourceHealthVocabulary.test.ts` (twice). Plan 11
did not render it in Health because it needs the **total** watch count, which `useSourceAttention`
does not carry and which would be a second fetch (forbidden by D-235-05's one-reader rule). In the
sketch it belongs to the **Ingestion** body — `Watched sources · 12 connected, 2 need you` — beside
the roster heading, where `WatchedFoldersSection` already holds the full watch list.

**Owner:** whichever plan next edits `IngestionTab.tsx` or `WatchedFoldersSection.tsx`'s section
heading. It is a one-line render at a surface that already holds both numbers.

### `sourceComposition.test.tsx` — 16 reds remain, and the file is in NEITHER count-gate knob

Every red is attributed by cause and owner in `235-11-SUMMARY.md`. Two classes need someone with
authority over the fence's fixtures and harness:

- **fixtures (4 reds):** `primeMocks` sets `reader_running: true`, which makes both
  `instance-statement` cases unreachable while D-235-12 holds; `SAMPLE_RUNS` is not `SyncRun`-shaped
  (no `status`, no `listing_complete`, no `count_*`) so `isQuiet` is false for all 17 and nothing
  folds; the third card row carries no `degraded: true`, so `report-source` cannot render.
- **harness (10 reds):** §3 and §4 assert the history blocks at MOUNT while they live behind a
  click, and `mountScreen("rail")` mounts `NavPanel` with no conditions, no navigator and no health
  mock — which by plan 09's own contract renders silence rather than a dead control.

⚠ **And `grep "sourceComposition" scripts/vitest-count-gate.cjs` returns nothing** — the phase's
contract fence runs in no gate at all, which is why the gate reads `0 failing` beside these 16.

**Owner:** plan 12 (the knobs) and phase verification (the fixtures and the harness).

### The 26-key `COPY` pin now has four plans' worth of orphaned labels waiting on it

`sourceHealthVocabulary.test.ts:138` pins `Object.keys(COPY)` at exactly **26**, so no plan in a
live wave can add a key without reddening a fence it does not own. Waiting: plan 04's
`LISTING_INCOMPLETE_NOTE`, plan 10's four state labels (`Reading` / `Paused` / `Stopped` /
`Unreadable here`) and its inline history-loading sentence, and plan 11's `STILL_ASKING` /
`COULD_NOT_ASK`. **Owner:** whichever plan re-baselines the pin — it should hoist all of them in
one move rather than one at a time.
