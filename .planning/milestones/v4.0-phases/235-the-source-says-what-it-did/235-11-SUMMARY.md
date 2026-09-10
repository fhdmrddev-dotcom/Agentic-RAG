---
phase: 235-the-source-says-what-it-did
plan: 11
subsystem: ui
tags: [react, tdd, surf-03, lib-10, health-tab, source-fence, seed-248]
status: complete
requires:
  - "frontend/src/hooks/useSourceAttention.ts (plan 04) — the ONE polled reader of the server verdict"
  - "frontend/src/components/sources/sourceHealthVocabulary.ts (plan 02) — COPY, SENTENCE_FOR_CAUSE, CONTROL_FOR_CAUSE"
  - "GET /sources/health (plan 06) — stopped[] with cause / stopped_since / last_good_at"
  - "LibraryPage.handleGoToSource + initialTab (plan 08) — the Health→Ingestion hop and the external door"
  - "WatchedFoldersSection's `id={`watch-card-${id}`}` anchor (plan 10) — what the hop scrolls to"
provides:
  - "SourcesAttentionSection — health-body-health / health-attention-list / health-attention-row / health-go-to-source"
  - "the three honest states: health-attention-loading / health-attention-unknown / health-attention-empty"
  - "HealthTab.onGoToSource — declared and forwarded, one mount, zero branches"
  - "useSourceAttention.verdictKnown — the flag that separates 'nothing is wrong' from 'we could not ask'"
  - "sourceComposition.test.tsx §3 repaired — single-match query replaced on a multi-instance contract"
affects:
  - "235-12 (owes count-gate knobs for SourcesAttentionSection.test.tsx, LibraryPage.initialTab.test.tsx AND sourceComposition.test.tsx — the fence is in NEITHER knob)"
  - "whoever owns the fence fixtures — 16 reds remain, every one attributed below"
tech-stack:
  added: []
  patterns:
    - "three named states for one fetch — loading / could-not-ask / answered-and-empty, because they are three different facts (SEED-248, T-235-39)"
    - "a section that fails quiet: it renders its own wrapper unconditionally, so a dead probe cannot blank the tab"
    - "a relaxed fence assertion is driven RED against a planted absence BEFORE it is accepted"
key-files:
  created:
    - frontend/src/components/library/SourcesAttentionSection.tsx
    - frontend/src/components/library/__tests__/SourcesAttentionSection.test.tsx
  modified:
    - frontend/src/components/library/HealthTab.tsx
    - frontend/src/pages/LibraryPage.tsx
    - frontend/src/pages/__tests__/LibraryPage.initialTab.test.tsx
    - frontend/src/hooks/useSourceAttention.ts
    - frontend/src/components/sources/sourceComposition.test.tsx
decisions:
  - "`health-body-health` is emitted by SourcesAttentionSection, NOT by HealthTab's root div — the sketch's body-health region is roster + title + list, which is exactly this section; putting it on the shipped Health tab would claim the ring, the tiles, the chips and the bars are part of the contract"
  - "`verdictKnown` added to useSourceAttention rather than a second fetch — after a rejected probe `loading:false` + `stopped:[]` is byte-identical to the server saying nothing is wrong, and the section would have printed an all-clear it never received"
  - "COPY.roster is NOT rendered here — it needs the TOTAL watch count, which would be a second fetch; in the sketch it lives in the INGESTION body, not Health"
  - "the composition fence's §3 WAS repaired here (plans 09 and 10 could not, with a sibling executor live in the file) — one step, `queryAllByTestId(...).length >= 1`, driven RED against a planted absence first"
requirements-completed: [SURF-03, LIB-10]
metrics:
  duration: ~75min
  tasks_complete: 2 of 2
  completed: 2026-09-06
---

# Phase 235 Plan 11: The Health tab lists only what is wrong — Summary

**The Library's Health tab now lists ONLY the sources that need attention, one row each, naming
the folder and what is true of it, with a single control that is a DOOR back to the card that can
fix it — and when nothing is wrong it says so in words rather than rendering an empty list.**

Both tasks complete. **19 cases across two suites, 0 failing.** `tsc` unchanged at 66. The frontend
count gate reads `count gate OK`. The composition fence went **26 failed → 16 failed**, and every
one of the 16 survivors is attributed below with its owner.

---

## What was built

### Task 1 — the section (`6c8626853` RED → `bd48356c8` GREEN)

`SourcesAttentionSection.tsx` consumes `useSourceAttention()` — **the same hook the rail badge
uses**, never a second fetch and never a client-side re-derivation, because D-235-05 puts the
debounce threshold on the server precisely so the badge, this list and the source card cannot
disagree (T-235-37).

- **Only what is wrong.** One `health-attention-row` per entry in the server's `stopped[]`. A case
  asserts **zero** `sources-history`, `sources-run`, `sources-toggle-history` and
  `sources-source-card` render here — **D-235-17 is asserted, not merely written down.**
- **A door, never a repair.** Each row's one control is `COPY.goToSource`, calling
  `onGoToSource(watch_id)` once. The negative case loops **`CONTROL_FOR_CAUSE`'s own labels**
  (with a non-empty check first) rather than re-typing three strings, so a reworded repair label
  cannot slip past it.
- **No handler ⇒ no control.** A dead click was the alternative and it is worse than an honest gap.
- **The cause sentence, never the raw column.** Rows render `SENTENCE_FOR_CAUSE[cause](connection)`,
  with `SENTENCE_FOR_CAUSE.unknown` as the fallback for a cause the table does not know — never a
  guess (T-235-38). `last_error` is not read on this surface at all.
- **The name is never invented.** Folder → connection → *nothing*. When neither is present the row
  still renders and the sentence still says what is true.

### Task 2 — the mount and the wiring (`f88d0652a`)

`HealthTab` gained **one import, one optional prop, one mount** and no branch —
`git diff | grep '^+' | grep -cE "useState|useEffect"` reads **0**. `LibraryPage` passes
`onGoToSource={handleGoToSource}` straight through, and **plan 08's `HealthTabSlot` is deleted**.

⚠ **The tombstone comment deliberately does not spell the deleted identifier.** A grep proving the
wrapper is gone must not be answerable by a comment — the 187-24 lesson, which this phase has now
recorded three times (235-08, 235-10, here). `grep -c "HealthTabSlot" LibraryPage.tsx` reads **0**.

### The scroll anchor plan 08 recorded as OWED has landed

`grep -c 'id={\`watch-card-'` on `WatchedFoldersSection.tsx` reads **1** (deliberately one line —
the pattern also matches `data-testid={\`watch-card-`). `handleGoToSource`'s docblock still claimed
the scroll was a no-op; **that claim was measured false and corrected in this plan's commit.**

---

## ⭐ The one measured surprise, and it is a Rule-2 fix

**`useSourceAttention` swallows a rejected probe, so a failed fetch was indistinguishable from an
all-clear.** The hook's contract is *"a rejected fetch keeps the previous verdict, settles
`loading`, and never throws"* — correct, and it means that after a rejected FIRST probe the
consumer sees `loading: false` and `stopped: []`, which is **byte-identical to the server saying
nothing is wrong**. Rendering `Every source is reading.` there is an all-clear nobody was told:
exactly the repudiation T-235-39 names, and exactly what SEED-248 says a surface must not do.

**Fix:** the hook now returns `verdictKnown`, derived from state it already held —
`verdictKnown: verdict !== null`. **No new `useState`, no new effect, no second fetch.** The
section reads it and renders three distinct, separately-named states:

| state | element | what it means |
|---|---|---|
| `loading` | `health-attention-loading` | we have not looked yet |
| `!loading && !verdictKnown` | `health-attention-unknown` | we could not ask |
| answered, `stopped` empty | `health-attention-empty` | `Every source is reading.` |

Each has its own case. The loading case holds the promise open, asserts the element AND that
`COPY.attentionEmpty` is **not** on screen, then releases it.

⚠ `useSourceAttention.ts` is **not** in this plan's `files_modified`. It is edited anyway because
the property the plan asks for (*"a rejected fetch renders the same honest not-yet-known state"*)
is **unreachable through the hook's existing surface**. Plan 04 has shipped and there is no
concurrent editor; its suite is unchanged at **13 passed** and pins no key set.

---

## ⭐ The composition fence — 26 → 16, and every survivor is named

### The RED baseline, at this plan's own merge base (`39b61ff88`), read verbatim

```
Test Files  1 failed (1)
     Tests  26 failed | 23 passed (49)
```

⚠ **That is NOT `235-BASELINE.md`'s `37 failed | 12 passed`.** Plans 09 and 10 both landed before
this plan's base; `26 / 23` is the correct current figure and is recorded rather than the stale one.

### After the section was built (before the fence was touched): `22 failed | 27 passed`

Four cases turned green from building, and **all four are mine**:

| case | was it a MISSING HOOK or a MISSING SURFACE? |
|---|---|
| §3 `body-health` → `health-body-health` | **missing surface** — the Health tab had no attention region at all |
| §3 `attention-list` → `health-attention-list` | **missing surface** |
| §4 `health · go-to-source` | **missing surface** — nothing on this tab hopped anywhere |
| §5 *"Health lists one `attention-row` per stopped source — 2, never all 12"* | **missing surface** |

⚠ And §3's `attention-row` case flipped from `Unable to find an element` to
**`Found multiple elements`** — which is the OPPOSITE verdict, and is proof the surface is right.
Plan 09 predicted this for `health-attention-row` by name, one wave early.

### The §3 repair — done here, driven RED first

`§3` asserted every block kind with **`getByTestId`, a single-match query**, while `§5` of the same
file asserts several of those kinds appear **9, 3, 17 and 2** times. The two sections contradicted
each other, and `§4` of the same file already used the correct shape. Plans 09 and 10 each measured
this and each declined to edit the file because a sibling executor was live in it; **both are merged
into this plan's base, so there is no concurrent editor now.**

**The relaxation is exactly one step and no more:** `getByTestId(x)` →
`queryAllByTestId(x).length >= 1`. ⛔ It deliberately asserts **no count** — §5 owns the counts,
from the contract's own numbers, and duplicating them in §3 would give two places to disagree
about one design.

⭐ **Driven RED against a planted absence before being accepted.** `data-testid="health-attention-list"`
was renamed in the live component and the relaxed case failed **by name**:

```
FAIL src/components/sources/sourceComposition.test.tsx > §3 every block the sketch draws > health >
     renders the `attention-list` block as [data-testid="health-attention-list"]
AssertionError: expected 0 to be greater than or equal to 1
Tests  1 failed | 48 skipped (49)
```

The plant was removed and `git diff --stat` on the component is **empty** — byte-identical.
A relaxed guard nobody has seen fire is not a guard; that is what sketch 218 shipped.

⛔ **The surface was NOT deformed to satisfy the old query.** Building one `attention-row` would
have turned §3 green and broken §5 and the contract's own `attentionRow: 2`.

**The repair turned six more cases green** — `sources-source-line`, `sources-source-card`,
`sources-outcome`, `sources-stopped-sentence`, `rail-rail-item` and `health-attention-row`. Every
one of the six was already BUILT (by plans 09 and 10); none is a new surface.

### The 16 that remain, each attributed. **ZERO are plan 11's.**

| # | red | cause class | owner |
|---|---|---|---|
| 2 | §3 `instance-statement` · §5 *appears exactly once* | **fence fixture** — `primeMocks` primes `getSourceHealth` with `reader_running: true`, and D-235-12 renders the statement ONLY when the reader is off. The statement is BUILT and proven by `IngestionTab.readerOff.test.tsx`. A one-word fixture change. | fence fixtures |
| 5 | §3 `history` · `run` · `quiet-fold` · `fail-reason` · §4 `toggle-quiet` | **behind a click** — all five live inside `RunHistoryList`, which mounts on first expansion; §3/§4 assert at MOUNT while §5 clicks `toggle-history` first. Proven live by the history suite's own 3-vs-17 case. | fence harness |
| 1 | §5 *collapsed 3 / expanded 17* | **fence fixture** — `SAMPLE_RUNS` objects carry `{id, quiet, added, updated, started_at}` and none of `status` / `listing_complete` / the six `count_*` fields, so `isQuiet` is false for all 17 and nothing folds. | fence fixtures |
| 1 | §4 `report-source` | **fence fixture** — the third card row is `last_status: "paused", is_active: false` with no `degraded: true`. Proven live by two cases in `WatchedFoldersSection.test.tsx`. | fence fixtures |
| 5 | §3 `rail-badge` · `rail-popover` · `rail-pop-item` · §4 `rail-badge` · `rail-open-health` | **fence harness** — `mountScreen("rail")` mounts `<NavPanel>` with no `attentionConditions`, no `onOpenLibraryHealth` and no health mock, and plan 09's contract is that an unwired caller gets SILENCE rather than a dead control. Proven live by `NavPanel.badge.test.tsx`. | fence harness (a three-line widen) |
| 2 | §3 `tab-ingestion` · `tab-health` | **hook never tagged** — the Library tab triggers exist; nobody put a contract hook on them. | plan 08's surface / plan 12 |

**2 + 5 + 1 + 1 + 5 + 2 = 16.** Every remaining red is accounted for, and none of them is a
surface this plan owed.

⚠ **I fixed the ASSERTION defect and deliberately stopped there.** The fixture and harness repairs
above are a wider change than this plan was authorised to make, and each of them would silently
change what the fence measures. They are named with their owners instead.

⛔ **AND THE FENCE IS IN NEITHER COUNT-GATE KNOB.** `grep "sourceComposition" scripts/vitest-count-gate.cjs`
returns **nothing**, which is why the gate reads `0 failing` while this file has 16 reds. **The
composition fence for this entire phase runs in no gate at all** — plan 12 should weigh that
before adopting anything else.

---

## Measured numbers — RECORD THESE, PLAN 12 PINS THEM

⛔ `scripts/vitest-count-gate.cjs`, `.planning/STATE.md` and `.planning/ROADMAP.md` are **NOT** in
`git diff --name-only 39b61ff88 HEAD` — that diff names exactly seven files, listed in the
frontmatter.

### Per-suite counts, each measured by running the file ALONE

| suite | before | after | knob status |
|---|---|---|---|
| `src/components/library/__tests__/SourcesAttentionSection.test.tsx` | — (new) | **13** passed | ⛔ in NEITHER knob |
| `src/pages/__tests__/LibraryPage.initialTab.test.tsx` | 5 | **6** passed | ⛔ in NEITHER knob (plan 08 created it unpinned) |
| `src/components/library` (whole directory) | **207** (plan 10) → **220** with my suite present | **220** passed / 15 files, 0 failed | pinned file-by-file; my file is not among them |
| `src/components/sources/sourceComposition.test.tsx` | 26 failed / 23 passed | **16 failed / 33 passed** (49) | ⛔ **runs in no gate at all** |
| `src/hooks/__tests__/useSourceAttention.test.tsx` | 13 | **13** passed (unchanged) | — |
| `src/components/library` + `src/components/sources` + `src/hooks/__tests__` + `src/components/layout/__tests__` | — | **549 passed / 16 failed (565)** — every failure is the fence | — |

⚠ **`src/components/library` is a FILE-LEVEL knob, not a directory entry** — measured, and the
gate's own comment at `vitest-count-gate.cjs:3187` says so explicitly (*"`src/components/library`
IS a directory entry so the file already runs". **It is not.**"*). **Plan 12 must add
`SourcesAttentionSection.test.tsx` to BOTH knobs**, and should pin at the gate's own printed
`— N new` figure rather than at the **13** above.

### The frontend count gate — run from the repo root, verdict line verbatim

```
  total                                      6814    7565    +751
  total 7565  ·  failed 0  ·  pinned total 6814
count gate OK — 227/227 pinned files present, no per-file decrease, 0 failing.
```

**Identical to plan 10's and plan 09's readings** — `7565 / 6814 / 227`. That identity is itself the
evidence that none of this plan's five touched suites is in the gate today: had any been, the total
would have moved. ⚠ The `+751` is unpinned suites the gate RUNS but does not GUARD, not new cases
from this plan.

⚠ **The cap held at `GSD_VITEST_MAX_WORKERS=2` throughout and was never adjusted. The gate was
green on the first run and no SEED-171 suite went red.**

### `tsc -p tsconfig.app.json --noEmit`

| when | errors |
|---|---|
| pre-plan (plan 10's close, same worktree lineage) | **66** |
| after both tasks | **66** — unchanged |

**No backend file was touched**, so the backend unit baseline is not re-measured here.

---

## The RED drives, recorded rather than claimed

### Task 1 — the whole suite, RED before a line of the component was written

The first RED was a **load failure** (`Failed to resolve import "../SourcesAttentionSection"`),
which proves only that the file is absent. So a stub rendering `null` was committed WITH the suite,
and the real RED read:

```
Tests  12 failed | 1 passed (13)
```

**The one pass is the §0 non-vacuity control** — the fixture carries ≥ 2 stopped sources and ≥ 2
distinct causes, and both are keys of `SENTENCE_FOR_CAUSE`. Deliberate: a run in which every case
is red is indistinguishable from a broken harness.

**GREEN after task 1: `12 passed | 1 failed`** — and the ONE red was named at the time rather than
discovered later: *"⛔ a rejected probe does not take the rest of the Health tab down with it"*
mounts `HealthTab`, whose mount is **task 2's** file. Task 2 turned it green: **13 passed**.

### The fence repair — RED against a planted absence

Recorded verbatim above. Component restored byte-identical (`git diff --stat` empty).

---

## Deviations from Plan

### 1. [Rule 2 — missing critical functionality] `useSourceAttention` gained `verdictKnown`

Full argument above. One derived field, no new state, no new effect, no second fetch. The hook is
not in `files_modified`; the plan's own required behaviour was unreachable without it.

### 2. [Rule 1 — plan/contract gap] `health-body-health` is emitted by the SECTION, not by `HealthTab`

The plan's `artifacts` block assigns all three blocks to `SourcesAttentionSection.tsx`, and its
Task-2 acceptance holds `HealthTab` to exactly one import + one prop + one mount. Both are honoured
by putting the wrapper hook on the section.

**And it is the more honest reading.** The sketch's `body-health` region contains the roster chips,
the attention title and the attention list — **that is this section**. The shipped Health tab also
carries a coverage ring, five stat tiles, seven signal chips, per-document bars and the checked-queries
table, none of which is in the contract; tagging the tab's root div would claim they were.

⚠ It also makes the block assertable from a suite that mounts the section ALONE, which is what
`SourcesAttentionSection.test.tsx` does.

### 3. [acceptance criterion vs. a pinned fence] TWO short labels are written in this component

`grep -cE '"[A-Z][a-z]+ [a-z]'` returns **2**, against a criterion asking for 0. The two are
`STILL_ASKING` and `COULD_NOT_ASK` — the loading and could-not-ask sentences.

**They cannot go in the vocabulary leaf:** `sourceHealthVocabulary.test.ts:138` pins
`Object.keys(COPY)` at exactly **26**, so adding keys reddens a green fence in a file this plan does
not own. This is the identical constraint **plan 10** recorded for its four state labels and for its
inline `sources-history-loading` sentence, and **plan 04** for `LISTING_INCOMPLETE_NOTE`.

Both are hoisted to named constants at the top of the file with the reason written beside them, so
whichever plan re-baselines the 26-key pin can hoist them in one move. ⛔ Neither is a claim about a
source — they describe **this section's own knowledge**, which is precisely SEED-248's distinction.

The criterion's SPIRIT holds: every sentence *about a source* resolves through the vocabulary leaf.

### 4. `COPY.roster(total, need)` is NOT rendered here

The plan lists it under consumed interfaces. Rendering it needs the **total** watch count, which
`useSourceAttention` does not carry and which would require a second fetch — forbidden by the plan's
own `⛔ never a second fetch`. In the sketch, the roster line lives in the **Ingestion** body
(`Watched sources · 12 connected, 2 need you`), not in Health. Logged to `deferred-items.md`.

### 5. `LibraryPage.initialTab.test.tsx` gained a case and a hoisted mock handle

Its `getSourceHealth` factory entry was a fixed `vi.fn().mockResolvedValue(...)`, so no case could
override it. It is now a hoisted mock with the same default set in `beforeEach`. **No existing
assertion changed**; the file moved 5 → 6 cases. Plan 08 owns the file, has shipped, and has no
concurrent editor.

### 6. [recorded, not fixed] The fence's fixture and harness defects

Sixteen reds, all attributed above with owners. Repairing them is a wider change than this plan was
authorised to make, and each would change what the fence measures.

---

## Deferred / out-of-scope

**`src/pages/__tests__/SettingsPage.a11y.test.tsx` — 4 failing, INHERITED.** The **same four cases**
plan 08 logged to `deferred-items.md`. Argued from the import graph, not from a colour:
`grep -c "LibraryPage\|HealthTab\|useSourceAttention\|SourcesAttentionSection" src/pages/SettingsPage.tsx`
returns **0**, so none of this plan's seven files is reachable from that suite's module graph. Not
fixed — executor scope boundary.

---

## Known Stubs

**None.** Every element this plan renders is wired to real data or to a real absence of it. The
`health-attention-unknown` state is not a stub — it is the honest rendering of a probe that did not
answer, and it has its own case.

---

## Threat Flags

No new network endpoint, auth path, file access pattern or schema change. This plan adds one
component that reads an already-shipped endpoint through an already-shipped hook.

| threat | disposition | evidence |
|---|---|---|
| T-235-37 — the Health row and the rail badge disagreeing | **mitigated** | both call `useSourceAttention`; this section filters, counts and derives nothing. `grep -c "getSourceHealth\|listSyncRuns"` on the component returns **0** |
| T-235-38 — a cause sentence exposing provider internals | **mitigated** | rows render `SENTENCE_FOR_CAUSE`, never `last_error` — which this component does not read at all |
| T-235-39 — an empty list reading as "all clear" while the fetch has not returned | **mitigated** | three separately-named states with three separately-named cases; the loading case asserts `COPY.attentionEmpty` is ABSENT while the promise is held open |
| T-235-SC — package installs | **n/a** | **no package was installed.** `package.json` is byte-unchanged |

---

## Guardrails

- **G-5:** `frontend/src/pages/LibraryPage.tsx` (40 / 12 / 825) is a G-5-firing ledger row.
  **Honoured by construction, by arithmetic:** it NET SHRANK — one component wrapper deleted, one
  prop forwarded, one stale docblock corrected (`9 / 19` on `--numstat`). No branch, no state, no
  effect added. `HealthTab.tsx` has no ledger row; it gained one import, one prop and one mount.
- **G-2 (sketch before UX):** satisfied upstream — sketch 233 drew this list, its row and its one
  control, and `BUILD-CONTRACT.generated.md` is what every hook is named from.

---

## ⛔ Things plan 12 must not lose an hour to

1. **`sourceComposition.test.tsx` IS IN NEITHER GATE KNOB.** The whole phase's contract fence runs
   nowhere. That is a bigger finding than any individual pin.
2. **Sixteen fence reds remain and none is a missing surface built by plans 09–11.** The table
   above says which are fixtures, which are behind-a-click, and which two are untagged hooks.
3. **`src/components/library` is a FILE-LEVEL knob** — the gate's own comment at `:3187` says so and
   corrects an earlier belief. `SourcesAttentionSection.test.tsx` needs BOTH knobs.
4. **`LibraryPage.initialTab.test.tsx` now reads 6, not 5.** Pin from the gate's printed figure.
5. **`useSourceAttention` returns a sixth field, `verdictKnown`.** A consumer that reads only
   `loading` + `stopped` will print an all-clear it never received.
6. **The 26-key `COPY` pin now has FOUR files' worth of orphaned labels waiting on it** (plan 04's
   note, plan 10's four state labels + its history-loading sentence, and this plan's two). Whoever
   re-baselines it should hoist all of them in one move.

---

## Self-Check

Files claimed created — verified present on disk:

```
FOUND: frontend/src/components/library/SourcesAttentionSection.tsx
FOUND: frontend/src/components/library/__tests__/SourcesAttentionSection.test.tsx
```

Commits claimed — verified in `git log 39b61ff88..HEAD`:

```
FOUND: 6c8626853  test(235-11): the Health attention section — failing, and it names each behaviour
FOUND: bd48356c8  feat(235-11): Health lists only what is wrong, and hands you back to the fix
FOUND: f88d0652a  feat(235-11): the badge's destination exists, and following it lands on the fix
FOUND: 632ef0c0b  fix(235-11): §3 of the composition fence asserted single-match on multi-instance blocks
```

Plan-forbidden writes — verified NOT in `git diff --name-only 39b61ff88 HEAD`:

```
NOT PRESENT: .planning/STATE.md
NOT PRESENT: .planning/ROADMAP.md
NOT PRESENT: scripts/vitest-count-gate.cjs
```

Deletions check — `git diff --diff-filter=D --name-only 39b61ff88 HEAD` is **empty**. The one thing
this plan deleted is a function inside `LibraryPage.tsx`, not a file.

## Self-Check: PASSED

## TDD Gate Compliance

`git log` shows the required sequence for Task 1, in order, with the RED run's own output recorded
above rather than asserted: `test(235-11)` `6c8626853` → `feat(235-11)` `bd48356c8`.

⚠ **Task 2 has no separate RED commit, and that is stated rather than papered over.** Its own case
(*"a rejected probe does not take the rest of the Health tab down with it"*) was authored in Task 1's
RED commit, failed through Task 1's GREEN, and turned green only in Task 2's commit — so the RED→GREEN
transition for Task 2's surface is visible in the measured `12 passed | 1 failed` → `13 passed`
recorded above. The SURF-03 end-to-end case in `LibraryPage.initialTab.test.tsx` was written after the
wiring and went green on first run; that is stated, not claimed as a drive.

## Commits

| hash | message |
|---|---|
| `6c8626853` | `test(235-11): the Health attention section — failing, and it names each behaviour` |
| `bd48356c8` | `feat(235-11): Health lists only what is wrong, and hands you back to the fix` |
| `f88d0652a` | `feat(235-11): the badge's destination exists, and following it lands on the fix` |
| `632ef0c0b` | `fix(235-11): §3 of the composition fence asserted single-match on multi-instance blocks` |
