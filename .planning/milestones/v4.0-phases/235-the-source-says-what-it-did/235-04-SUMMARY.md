---
phase: 235-the-source-says-what-it-did
plan: 04
subsystem: source-health-client
tags: [api-client, hook, pure-fold, tdd, surf-02, surf-03]
status: complete
requires:
  - frontend/src/lib/api/_core.ts (API_BASE, ApiError, getAuthHeaders)
  - frontend/src/components/sources/sourceHealthVocabulary.ts (plan 02)
  - frontend/src/components/sources/__generated__/sourceComposition.json (plan 03)
  - frontend/src/components/workflows/library/relativeChanged.ts (relativeBand)
  - GET /sources/health + GET /sources/watches/{id}/runs (plans 06 and 07 — NOT YET BUILT)
provides:
  - SyncRun / StoppedSource / SourceHealth wire types
  - listSyncRuns(watchId, signal?) + getSourceHealth(signal?)
  - ConnectorWatch widened with degraded / degraded_reason / next_check_within_seconds (all optional)
  - useSourceAttention() — the ONE polled client reader of the server's verdict
  - runHistoryFold.ts — isQuiet + foldRuns, a pure strict leaf
  - RunHistoryList.tsx — the history / run / quiet-fold / fail-reason blocks
affects:
  - frontend/src/lib/api/sources.ts
tech-stack:
  added: []
  patterns:
    - "listWatches:80-87's fetch / res.ok / ApiError shape, copied structurally for both new calls"
    - "poll + AbortController + fetch-reconcile (D-v2.5-03), loading exposed (SEED-248)"
    - "strict leaf + ?raw source fence (librarySelection.ts / sourceHealthVocabulary.ts shape)"
    - "relativeBand reused — NO fourth relative-time formatter (fileRowUtils.ts:148's recorded rule)"
key-files:
  created:
    - frontend/src/hooks/useSourceAttention.ts
    - frontend/src/hooks/__tests__/useSourceAttention.test.tsx
    - frontend/src/components/sources/runHistoryFold.ts
    - frontend/src/components/sources/runHistoryFold.test.ts
    - frontend/src/components/sources/RunHistoryList.tsx
    - frontend/src/components/sources/RunHistoryList.test.tsx
  modified:
    - frontend/src/lib/api/sources.ts
decisions:
  - "next_run_at was CHECKED before being added and is pre-existing at sources.ts:36 — left untouched, exactly as the plan warned"
  - "The vocabulary is CLOSED at 26 keys: sourceHealthVocabulary.test.ts:138 pins Object.keys(COPY).toHaveLength(26), so the incomplete-listing note could not go there and lives in RunHistoryList as its one owned string"
  - "foldRuns returns 4 ROWS collapsed (3 kind:run + 1 kind:quiet-fold), not 3 — the generated contract's runCollapsed:3 counts `run` BLOCKS. The plan's prose said 3 rows; the contract wins"
  - "RunHistoryList takes an optional `now` prop (P-1: one hoisted instant per render) — additive, so plan 10's mount is unaffected"
  - "Two docblocks were reworded so the acceptance greps pass over the RAW file (Pitfall 8), and both greps were then made executable as suite cases"
metrics:
  duration: ~35 min
  tasks_complete: 3 of 3
  completed: 2026-09-06
---

# Phase 235 Plan 04: The Three Client Leaves — Summary

The client can now ask what a source did (`listSyncRuns`) and what needs attention
(`getSourceHealth`), read the verdict through exactly **one** polled hook that derives nothing,
and collapse 17 stored ticks into 3 rendered lines with a pure, total fold.

All three tasks complete. **48 cases across three suites, 0 failing.**

---

## Measured numbers — RECORD THESE, PLAN 12 PINS THEM

⛔ **`scripts/vitest-count-gate.cjs` was NOT modified.** `git diff --name-only 86da3f703..HEAD`
names seven files and none of them is the gate.

### Per-suite pass counts, verbatim from their own runs

| suite | cases | verdict |
|---|---|---|
| `src/hooks/__tests__/useSourceAttention.test.tsx` | **13** | `1 passed (1)` · `13 passed (13)` |
| `src/components/sources/runHistoryFold.test.ts` | **17** | `1 passed (1)` · `17 passed (17)` |
| `src/components/sources/RunHistoryList.test.tsx` | **18** | `1 passed (1)` · `18 passed (18)` |
| **all three together** | **48** | `Test Files 3 passed (3)` · `Tests 48 passed (48)` |

Command, from `frontend/`:

```
npx vitest run src/components/sources/runHistoryFold.test.ts \
               src/components/sources/RunHistoryList.test.tsx \
               src/hooks/__tests__/useSourceAttention.test.tsx --maxWorkers=2
```

⚠ **All three suites are in NEITHER gate knob, and that was MEASURED rather than assumed.**
`src/components/sources` is not a `TARGETS` directory entry (that directory is pinned one file at
a time — `SourceFolderPicker` · `previewVocabulary` · `SourcePreviewPanel` ·
`WatchedFoldersSection`), and **`src/hooks` has no directory entry anywhere in the script either**
— the gate's own comments at `:138`, `:778`, `:4199` say so. So these suites do not even RUN in
the gate until plan 12 adds both a `TARGETS` line and a `BASELINE` pin for each, **in one commit**
(P-4: a pin without a target errors at exit 2 rather than failing).

### `tsc -p tsconfig.app.json --noEmit`

| when | errors |
|---|---|
| pre-plan baseline (measured on `86da3f703`) | **66** |
| after Task 1 | **66** |
| after Task 2 | **66** |
| after Task 3 (final) | **66** |

⚠ **CLAUDE.md quotes 68 for this figure and it is STALE — the measured baseline is 66.**
Re-derived rather than quoted, exactly as the acceptance criterion demanded. **Unchanged across
all three tasks**, so nothing in this plan added a type error.

### The composition fence — UNCHANGED, and that is the correct result

```
Test Files  1 failed (1)
     Tests  37 failed | 12 passed (49)
```

**Byte-identical to `235-BASELINE.md` §1's recorded RED run.** This plan turned **zero** of its
cases green, and that is right: the baseline assigns `history` · `run` · `quiet-fold` ·
`fail-reason` and the `toggle-quiet` control to **Plan 10**, which owns the MOUNT. This plan built
the component those hooks will come from; a component nobody renders emits no `data-testid`.
**Plan 10 should turn five of those reds green by mounting `RunHistoryList`, and it needs nothing
further from this plan to do it.**

---

## What was built

### Task 1 — `frontend/src/lib/api/sources.ts` (+106 lines)

`SyncRun`, `StoppedSource` and `SourceHealth` in `ConnectorWatch`'s own in-file style, plus
`listSyncRuns(watchId, signal?)` → `GET /sources/watches/{id}/runs` and `getSourceHealth(signal?)`
→ `GET /sources/health`, both structurally copying `listWatches:80-87`.

`ConnectorWatch` gained `degraded?`, `degraded_reason?` and `next_check_within_seconds?` — all
**optional**, so every surface that mounts today keeps compiling before plan 07 lands the server
half.

⭐ **`next_run_at` was checked and NOT added.** It is pre-existing at `sources.ts:36` from Phase
234, exactly as the plan warned. The check took one grep; listing a shipped field as net-new is
how a plan talks an executor into a redundant edit.

**Acceptance, measured:**

| criterion | result |
|---|---|
| `grep -c "export async function"` increases by exactly 2 | 7 → **9** ✅ |
| `grep -n "getSourceHealth\|listSyncRuns" src/lib/api.ts` returns nothing | **0 lines** ✅ |
| `tsc` error count unchanged | 66 → **66** ✅ |

### Task 2 — `useSourceAttention` (TDD: RED `2f2c64b82` → GREEN `ae2608069`)

The RED run is recorded rather than claimed: the suite could not resolve `../useSourceAttention`
and reported `Test Files 1 failed (1)` · `Tests no tests`.

Polls `getSourceHealth` on the cadence **the server names** (`poll_interval_seconds`), with a 60 s
fallback before the first response has named one. Clears its interval on unmount. Aborts the
in-flight fetch it replaces. A rejected probe **keeps the previous verdict**, settles `loading`,
and never throws — a health probe is not allowed to blank the app shell.

`loading` is part of the contract, not an afterthought: `SEED-248` names `useDocuments.ts`'s
missing flag, and without it "no sources need attention" and "we have not asked yet" render
identically while meaning opposite things.

**Acceptance, measured:** `grep -c "stopped.filter\|consecutive\|threshold"
src/hooks/useSourceAttention.ts` → **0** ✅ · unmount case asserts both `clearInterval` was called
and `vi.getTimerCount()` is `0` ✅ · **13 cases**, exit 0 (criterion asked ≥ 6) ✅.

### Task 3 — the fold and its renderer (TDD: RED `b45f6f774` → GREEN `a663924fc`)

`runHistoryFold.ts` is a strict leaf — no React, no vocabulary, no formatting, no `Date`.
`isQuiet` requires **success AND a complete listing AND six zero counts**. `foldRuns` folds only
CONSECUTIVE quiet ticks, treats a fold of one as an ordinary row, preserves order, returns `[]`
for `[]`, and never mutates its input (asserted).

`RunHistoryList.tsx` emits `sources-history` once, one `sources-run` per run row, one
`sources-quiet-fold` per fold, a nested `sources-fail-reason` inside any non-success run, and the
`sources-toggle-quiet` control whose accessible name is `COPY.showEvery` / `COPY.hideQuiet`.

**Acceptance, measured:**

| criterion | result |
|---|---|
| no capitalised sentence literal in the component | `grep -cE "\"[A-Z][a-z]+ .*\"\|'[A-Z][a-z]+ .*'"` → **0** ✅ |
| `last_error` only as an argument to `sourceFailureSentence` | 3 hits: `:8` and `:10` are docblock prose, **`:152` is the sole code hit and it is the argument** ✅ |
| `grep -n "color-danger"` returns nothing | **no output** ✅ |
| 17 → 3 collapsed and 17 → 17 expanded, non-vacuity control first | ✅ |
| both suites exit 0 with 0 failed | 17 + 18 ✅ |

---

## Deviations from Plan

### 1. `[Rule 1 — contract conflict] "3 rows collapsed" is 3 `run` BLOCKS, and the row total is 4`

- **Found during:** Task 3, writing the fold's numbers.
- **Issue:** The plan's behaviour bullet says `foldRuns(...)` collapsed *"returns **3** rows, one
  of which is `{ kind: "quiet-fold", count: 14 }`"*. The sketch's own fixture
  (`index.html:432-448`) is **17 runs of which 14 are quiet and consecutive**, so 17 − 14 + 1 = **4
  rows**: three `run` and one `quiet-fold`. Three rows would require 15 quiet runs.
- **Resolution:** The **generated** contract wins over the plan's prose — `sourceComposition.json`
  emits `runCollapsed: 3`, and that field counts `data-block="run"` **blocks**, not rows; the fold
  is a `quiet-fold` block beside them. The baseline's own §5 case is worded the same way: *"a
  collapsed history shows 3 `run` rows; expanded shows all 17"*. The suite therefore pins **both**
  numbers — `runRows(rows)` is 3 **and** `rows` is 4 — so neither reading can drift silently, and
  it imports `CONTRACT.counts` rather than typing `3`.
- **Files:** `runHistoryFold.test.ts`, `runHistoryFold.ts`
- **Commit:** `a663924fc`

### 2. `[Rule 3 — blocked] The vocabulary is CLOSED at 26 keys, so the incomplete-listing note could not go in it`

- **Found during:** Task 3.
- **Issue:** The plan says *"No sentence is written in this component; every string comes from the
  vocabulary leaf"*. But `listing_complete` is a **RESEARCH finding (§1.1 / P-2), not something the
  sketch ever drew** — there is no key for it among the 28 the contract emits, and the behaviour
  bullet nonetheless requires *"a distinct sentence rather than `0 missing`"*.
- **Why the obvious fix is forbidden:** `sourceHealthVocabulary.test.ts:138` asserts
  `expect(Object.keys(COPY)).toHaveLength(26)`. Adding a 27th key would **redden a green fence in
  a file this plan does not own**, in a wave with a live sibling agent.
- **Fix:** `RunHistoryList.tsx` exports **one** string, `LISTING_INCOMPLETE_NOTE = "could not tell
  what was removed"` — a lowercase FRAGMENT in the register the sketch itself uses for row details
  (`no changes`, `missing at source`, `could not be read`), so the acceptance grep (which forbids
  *capitalised* sentence literals) still reads 0. Every actual **sentence** still resolves through
  the vocabulary. The docblock names the pin as the reason and asks whichever plan re-baselines it
  to hoist the note.
- **Files:** `RunHistoryList.tsx`
- **Commit:** `a663924fc`

### 3. `[Rule 2 — missing critical functionality] An optional `now` prop, for P-1`

- **Issue:** The plan pins the props at `{ runs, connectionName, expanded, onToggleExpanded }`. A
  relative time needs an instant, and `relativeChanged.ts`'s own docblock records P-1: **one
  hoisted `Date.now()` per render**, so two rows in a render cannot straddle a band boundary, and
  a suite can inject a fixed instant instead of mocking a clock.
- **Fix:** `now?: number`, defaulting to `Date.now()`. **Additive and optional** — plan 10's mount
  compiles unchanged.
- **Commit:** `a663924fc`

### 4. `[Rule 1 — self-inflicted red] Two docblocks were reworded because the acceptance greps read the RAW file`

- **Found during:** Tasks 2 and 3, both times as a real failing check rather than a hypothetical.
- **Issue:** `grep -c "…consecutive|threshold" useSourceAttention.ts` returned **1** and the
  `color-danger` fence in `RunHistoryList.test.tsx` **failed**, in both cases because the docblock
  *explaining the prohibition* spelled the forbidden token. This is Pitfall 8 exactly — a literal
  inside a docblock is still a literal, the same trap the em dash falls into one file over.
- **Fix:** both docblocks say the same thing without spelling the token, **and both greps are now
  executable suite cases** rather than one-off command-line checks, so they survive the next edit.
- **Commits:** `ae2608069`, `a663924fc`

---

## ⛔ Things the Wave-4 surface plans must not lose an hour to

1. **`frontend/src/lib/api/sources.ts` is NOT in the `@/lib/api` barrel.** `vi.mock("@/lib/api")`
   alone intercepts **nothing** from it. Every suite that mounts a consumer must
   `vi.mock("@/lib/api/sources", …)` **separately**, in its own call — the shipped template is
   `WatchedFoldersSection.test.tsx:20-31`. This is written into the new block's own comment in
   `sources.ts` so it is discoverable from the file rather than only from here.

2. **Every `vi.mock("@/lib/api/sources")` factory must now declare `listSyncRuns` AND
   `getSourceHealth`.** A factory missing an export makes the consuming suite throw **at mount**
   about a missing export rather than about the thing under test — Phase 196-08's nine-suite,
   249-case failure mode. **`WatchedFoldersSection.test.tsx:20-31` has NOT been updated by this
   plan** (it is not in this plan's `files_modified`); it is green today because it mounts nothing
   that calls the new functions, but **plan 10 owns adding both to that factory** and should do it
   in the commit that mounts `RunHistoryList`.

3. **`RunHistoryList` needs `connectionName`.** The fail-reason sentence is
   `sourceFailureSentence(run.last_error, connectionName)` and `token_revoked` interpolates the
   name into *"Access to {name} was withdrawn…"*. A mount that passes `""` gets the vocabulary's
   honest stand-in (`the connection`), never an empty gap — but it also never gets the useful
   version, so pass the real `connection_name` from the watch.

4. **`count_missing = 0` on a run whose `listing_complete` is false is BY DESIGN.**
   `watch_service.py:415-420` suppresses missing-transitions on an incomplete listing (the H-5 /
   SRC-06 guard). Such a run is **never folded as quiet** and renders the incomplete-listing note
   instead — three suite cases hold that, including one proving two consecutive incomplete ticks
   stay two rows rather than becoming a fold.

---

## Threat Flags

None. This plan adds no network endpoint, no auth path, no file access and no schema. It **removes**
surface: `T-235-12`'s raw-`last_error` path is closed by construction here and asserted by a fence
that counts occurrences in the component's own source.

`T-235-13` (poll amplification) is mitigated as the register asked — **one** hook, **one** timer,
cleared on unmount, on the interval the server itself names. `T-235-14` (a client re-deriving the
verdict) is mitigated by a grep assertion over the hook's source rather than by a claim.
`T-235-SC`: **no package was installed by this plan.**

---

## Known Stubs

None in this plan's own files. **One honest incompleteness, stated rather than hidden:** both new
API calls target endpoints that **do not exist yet** — `GET /sources/health` and
`GET /sources/watches/{id}/runs` are built by plans 06 and 07. Until they land, `useSourceAttention`
will catch a 404, keep its (empty) verdict and report `loading: false`, which is the designed
fail-quiet behaviour and not a stub. Nothing in the product mounts either module yet, so no user
sees a placeholder.

---

## Commits

| hash | message |
|---|---|
| `c2445321c` | `feat(235-04): the sources client can ask what a source did and what needs attention` |
| `2f2c64b82` | `test(235-04): add failing suite for useSourceAttention — one polled reader that derives nothing` |
| `ae2608069` | `feat(235-04): useSourceAttention — one polled reader of the server's verdict` |
| `b45f6f774` | `test(235-04): add failing suites for the quiet-run fold and the history it renders` |
| `a663924fc` | `feat(235-04): the quiet-run fold, and the history that renders it` |

## Self-Check: PASSED

All seven source/test files resolve on disk (`[ -f ]` per path) and all five commit hashes above
resolve in `git log`. Nothing claimed here is unverified.

## TDD Gate Compliance

Both TDD tasks show the full RED → GREEN sequence in `git log`, in order, with the RED run's own
output recorded above rather than asserted. No REFACTOR commit was needed — neither implementation
was rewritten after going green.
