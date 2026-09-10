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


## From plan 235-12 (2026-09-06) — the phase's closing record

### ⛔ THE FENCE IS STILL IN NEITHER KNOB, BY DECISION — and this is the item with a live trigger

`frontend/src/components/sources/sourceComposition.test.tsx` closes Phase 235 at
**16 failed / 33 passed (49)** and is therefore in **neither** `TARGETS` nor `BASELINE` of
`scripts/vitest-count-gate.cjs`. Plan 12 refused to pin it, refused to pin it with an allowance, and
refused to repair all sixteen at a phase's final commit. The full option table, the trajectory
(`37/12` → `26/23` → `22/27` → `16/33`) and the per-red owner table are in `235-BASELINE.md` §7.

**trigger_when — TWO independent conditions, so the item cannot be orphaned by whichever arrives
first:**

1. **The next plan that edits `sourceComposition.test.tsx`'s fixtures or harness.** Fourteen of the
   sixteen reds are fixture/harness defects, each provable against a suite Phase 235 has now PINNED
   (`IngestionTab.readerOff.test.tsx`, `RunHistoryList.test.tsx`, `runHistoryFold.test.ts`,
   `WatchedFoldersSection.test.tsx`, `NavPanel.badge.test.tsx`). That plan must finish the job and
   set BOTH knobs in its own commit.
2. **OR the next plan that edits `frontend/src/pages/LibraryPage.tsx`'s `TabsTrigger`s.** The two
   remaining reds (`sources-tab-ingestion`, `sources-tab-health`) need a `data-testid` on shipped
   product markup — a two-attribute change no closeout plan may make, but a trivial one for any plan
   already in that file.

⚠ **This is NOT a "someday" note.** A deferral with no re-open trigger is a deletion that looks like
a decision, and a design-contract fence that runs in no gate is precisely the sketch-218 failure this
phase was built to prevent. **The fence has already earned its keep** — twenty-one of its cases went
green by the surfaces being BUILT — but until it is in both knobs, nothing stops those surfaces
regressing.

### `release_watch` swallows its INSERT — nothing yet proves a run row was STORED

Carried forward as the phase's largest OWED item. The first honest check is a **non-zero
`count(*)` on `connector_sync_runs` after a real watch tick** — which is a **G-4 UAT row against the
live local database, not a unit test**, because the swallow is in the write path and every unit test
stubs it.

**trigger_when:** the next `/gsd:verify-work` on any watch-loop phase, or the first operator report
of an empty run history on a source that has demonstrably synced.

### Migration 172's grant narrowing, still owed

The narrowing waits on **measuring which role the asyncpg pool actually connects as** — an
environment measurement, not a code change, and one nobody has taken.
**trigger_when:** the next migration that touches `connector_sync_runs`, or any cloud-parity pass
that enumerates grants.

### The prune bound is not proven against live rows

The retention prune's bounds are exercised against fixtures only. **trigger_when:** the first tick
that produces more rows than the retention window, or `SEED-250`'s `app_settings` retention knob
being built — whichever comes first.

### Five suites the gate RUNS but does not GUARD, named rather than left anonymous

Not this phase's, and deliberately not adopted by it (adopting a stranger's suite at a closeout
commit pins a number nobody has reviewed): `PromptVariableChips.test.tsx` (3),
`RunHero.test.tsx` (18), `automationFacts.test.ts` (11), `nodeEffectBanner.test.ts` (8),
`toolReadOnlyMap.test.ts` (7). **trigger_when:** the next phase whose blast radius contains any of
the five — pin it in that phase's own close, at the gate's own printed figure.

### `src/pages/__tests__/SettingsPage.a11y.test.tsx` — STILL 4 failing, STILL inherited

⚠ Re-confirmed at plan 12 by a different route than plans 08 and 11 used: **the suite is in neither
gate knob**, so it never ran in any of this plan's three gate invocations, and the gate's green
verdict says nothing about it either way. Unchanged owner: whichever plan next touches
`SettingsPage.tsx` or the Settings a11y contract.

## 235-15 (gap-closure round 1) — three UNGATED suites are red at the base commit

Measured while running plan 235-15's acceptance command
`npx vitest run src/pages/__tests__ src/lib --maxWorkers=2` → **6 failed | 672 passed (678)**.

| Suite | Failing cases | Status |
|---|---|---|
| `src/lib/model-info.test.ts` | 1 — `costTier` values for known models | pre-existing |
| `src/lib/__tests__/termMap.test.tsx` | 1 — "exactly the mapped keys the contract table covers" | pre-existing |
| `src/pages/__tests__/SettingsPage.a11y.test.tsx` | 4 — tablist roles / `aria-pressed` reveal control | pre-existing |

**Why they are out of 235-15's scope, proven rather than asserted:**

1. **Provably unmodified.** `git diff --numstat d790f3d6f HEAD -- <the three files>` and
   `git diff --numstat -- <the three files>` are BOTH empty.
2. **Structurally unreachable from this plan's diff.** The plan's only non-test source changes are
   `App.tsx` and the brand-new leaf `lib/libraryTabHandoff.ts`. None of the three suites references
   `App` (`grep -n "App\b\|@/App"` over all three returns nothing), and nothing but
   `LibraryPage.initialTab.test.tsx` imports the new leaf.
3. ⚠ **They are UNGATED, which is why the plan's `count gate OK … failed 0` baseline is consistent
   with them being red.** None of the three appears in `vitest-count-gate.cjs`'s TARGETS or BASELINE
   (the file's only textual match is a comment on line 3773). `src/lib` and `src/pages` are pinned
   **per file** in this gate, not as directories — so the gate has never run these three at all.

⛔ **Consequence for a future plan author:** the acceptance criterion
*"`npx vitest run src/pages/__tests__ src/lib` — 0 failed"* was **unmeetable at plan 235-15's base
commit** and is not a property any plan in that scope can deliver. Either the three suites are
repaired (a phase, not a closure round) or the criterion is scoped to the explicitly-run in-scope
suites, which are deterministic.
