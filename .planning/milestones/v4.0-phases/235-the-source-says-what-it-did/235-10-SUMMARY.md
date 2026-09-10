---
phase: 235-the-source-says-what-it-did
plan: 10
subsystem: source-surfaces
tags: [react, variant-b, tdd, surf-02, lib-10, source-fence, bug-260906-02]
status: complete
requires:
  - frontend/src/components/sources/sourceHealthVocabulary.ts (plan 02 — COPY, SENTENCE_FOR_CAUSE, CONTROL_FOR_CAUSE)
  - frontend/src/components/sources/RunHistoryList.tsx + runHistoryFold.ts (plan 04)
  - frontend/src/hooks/useSourceAttention.ts (plan 04)
  - frontend/src/lib/api/sources.ts — listSyncRuns / getSourceHealth / ConnectorWatch.degraded (plan 04)
  - GET /sources/health + /sources/watches/{id}/runs (plan 06), POST /sync's asked|refused reply (plan 07)
provides:
  - "the variant-B source surface: sources-source-line / sources-source-card"
  - "sources-outcome / sources-stopped-sentence / sources-fix / sources-sync-now / sources-toggle-history"
  - "sources-report-source + the named degraded row (SEED-239 / D-235-13)"
  - "sources-history / run / quiet-fold / fail-reason / toggle-quiet — mounted from RunHistoryList"
  - "sources-instance-statement + sources-body-ingestion in IngestionTab (D-235-12)"
  - "SourceReaderStatement — exported from WatchedFoldersSection, mounted once by IngestionTab"
  - "WatchSyncResponse widened with next_run_at / next_check_within_seconds / reader_running"
affects:
  - frontend/src/lib/api/sources.ts
  - frontend/src/pages/__tests__/LibraryPage.initialTab.test.tsx
tech-stack:
  added: []
  patterns:
    - "variant-B disclosure fork: one collapsible line for a healthy row, a full card for one that needs a person"
    - "table-driven control resolution (CONTROL_FOR_CAUSE) — asserted as a LOOP over the table, never four hand-written cases"
    - "?raw source fences over the live component, each paired with its own non-vacuity anchor"
    - "one polled hook mounted at the tab, threaded down as props — twelve cards, one poller"
key-files:
  created:
    - frontend/src/components/sources/WatchedFoldersSection.history.test.tsx
    - frontend/src/components/library/__tests__/IngestionTab.readerOff.test.tsx
  modified:
    - frontend/src/components/sources/WatchedFoldersSection.tsx
    - frontend/src/components/sources/WatchedFoldersSection.test.tsx
    - frontend/src/components/library/IngestionTab.tsx
    - frontend/src/lib/api/sources.ts
    - frontend/src/pages/__tests__/LibraryPage.initialTab.test.tsx
decisions:
  - "`paused` joins stopped and degraded as a NEVER-COLLAPSED card — a paused source is not reading, so it is not the one-line case, and the contract's third card in a 9+3 fixture is exactly that row"
  - "the stopped sentence resolves through TWO vocabulary entry points, not one: the server's cause takes SENTENCE_FOR_CAUSE verbatim, and a row with no server cause goes through sourceFailureSentence, which is strictly safer for the `unknown` arm"
  - "readerRunning and stoppedSources are PROPS, not a second useSourceAttention mount — one poller for the tab (T-235-13)"
  - "the composition fence was NOT edited, though it carries a real defect this plan measured — plan 09 is live in the same file this wave"
metrics:
  duration: ~2h
  tasks_complete: 3 of 3
  completed: 2026-09-06
---

# Phase 235 Plan 10: The Source Card Variant B Ships — Summary

**A healthy source is now one line, a stopped one says what happened and offers the single control
that fixes THAT cause, and every run a source has made is one click away on the source itself — and
the Sync button reports the outcome instead of the request.**

All three tasks complete. **49 cases across three suites, 0 failing.** The frontend count gate reads
`count gate OK` and `tsc` is unchanged at its measured baseline.

---

## Measured numbers — RECORD THESE, PLAN 12 PINS THEM

⛔ **`scripts/vitest-count-gate.cjs` was NOT modified.** `git diff --name-only 845a90b62..HEAD` names
seven files and none of them is the gate. **STATE.md and ROADMAP.md were not modified either.**

### Per-suite pass counts, verbatim from their own runs

| suite | before | after | verdict |
|---|---|---|---|
| `src/components/sources/WatchedFoldersSection.test.tsx` | **6** (pinned) | **27** | `1 passed (1)` · `27 passed (27)` |
| `src/components/sources/WatchedFoldersSection.history.test.tsx` | — (new) | **17** | `1 passed (1)` · `17 passed (17)` |
| `src/components/library/__tests__/IngestionTab.readerOff.test.tsx` | — (new) | **5** | included in the library run below |
| `src/components/library` (whole directory) | **202** | **207** | `14 passed (14)` · `207 passed (207)` |
| `src/pages/__tests__/LibraryPage.test.tsx` + `LibraryPage.initialTab.test.tsx` | 22 | **22** | `2 passed (2)` · `22 passed (22)` |

⚠ **The `202 → 202` before/after for `src/components/library` was measured on BOTH sides**, with the
`IngestionTab` change reverted and then restored, so the `207` is `202` unchanged plus this plan's five
new cases and nothing else. `IngestionTab.test.tsx` itself is byte-unchanged and still reads **40** in
the gate's own per-file table.

### ⭐ The three figures plan 12 needs for the gate knobs

| file | TARGETS today | BASELINE today | plan 12 must |
|---|---|---|---|
| `src/components/sources/WatchedFoldersSection.test.tsx` | ✅ pinned as a file | **6** | **RE-PIN at 27** — the gate printed `WatchedFoldersSection.test.tsx  6  27  +21` |
| `src/components/sources/WatchedFoldersSection.history.test.tsx` | ⛔ absent | ⛔ absent | add BOTH knobs, pin at **17** |
| `src/components/library/__tests__/IngestionTab.readerOff.test.tsx` | ⛔ absent | ⛔ absent | add BOTH knobs, pin at **5** |

⚠ **Measured rather than assumed:** `src/components/sources` is not a `TARGETS` directory entry (that
directory is pinned one file at a time), and `src/components/library/__tests__` is likewise pinned file
by file — so **neither new suite RUNS in the gate today**, and neither could have leaked into anyone
else's verification. `IngestionTab.readerOff.test.tsx` sits beside eleven individually-pinned siblings
in the same directory and is in none of them. P-4 still applies: a pin without a target exits 2, so both
knobs go in ONE commit.

### The frontend count gate — run from the repo root, verdict line verbatim

```
  WatchedFoldersSection.test.tsx                6      27     +21
  total                                      6814    7565    +751
  total 7565  ·  failed 0  ·  pinned total 6814
count gate OK — 227/227 pinned files present, no per-file decrease, 0 failing.
```

⚠ The `+751` is **unpinned suites the gate RUNS but does not GUARD** (`PromptVariableChips`,
`RunHero`, `automationFacts`, `nodeEffectBanner`, `toolReadOnlyMap` are printed as `new`), not new
cases from this plan. The only per-file delta this plan caused is the `+21` on its own suite, and the
gate's contract — *no per-file decrease, zero failing* — holds.

⚠ **235-BASELINE §5 recorded `7544 / 6814 / 227` on 2026-09-06 in the research session. The pinned
total and the pinned-file count are UNCHANGED at `6814 / 227`**; the grand total moved `7544 → 7565`
as Wave-3 and Wave-4 work landed. A growing grand total is the gate working.

### `tsc -p tsconfig.app.json --noEmit`

| when | errors |
|---|---|
| pre-plan (measured on `845a90b62`, this worktree) | **66** |
| after Task 1 | **66** |
| after Task 3 (final) | **66** |

⚠ **CLAUDE.md's figure for this is stale; plan 04 measured 66 and so does this plan.** Zero of the 66
name any file this plan wrote — checked with `grep -E "sources/|IngestionTab|api/sources"`, whose eight
hits are all pre-existing errors in `IngestionTab.test.tsx` and `sketchComposition.test.tsx` that were
present on the merge base.

**No backend file was touched**, so the backend unit baseline is not re-measured here.

---

## ⭐ The composition fence — the delta, and which reds are the FENCE and which are UNBUILT

```
BASELINE (235-BASELINE.md §1)   Test Files 1 failed (1)   Tests 37 failed | 12 passed (49)
after this plan                 Test Files 1 failed (1)   Tests 27 failed | 22 passed (49)
```

**Ten cases moved from red to green. Nine of them are this plan's; one is not, and that is stated
rather than claimed:** §6's *"the word appears in `api/sources.py`"* case reads a backend file this
plan never touched — plan 07 reworded the docstring that held it, so it was already green on this
plan's merge base.

### The nine this plan turned green

| # | case | was it a MISSING HOOK or a MISSING SURFACE? |
|---|---|---|
| 1 | §3 `body-ingestion` → `sources-body-ingestion` | **missing hook** — the Ingestion tab body existed; it carried no contract hook |
| 2 | §4 `fix` → `sources-fix` | **missing surface** — there was no per-cause control at all, only one hard-wired Reconnect banner |
| 3 | §4 `sync-now` → `sources-sync-now` | **missing hook** — the Sync now button shipped in 234 with no hook |
| 4 | §4 `toggle-history` → `sources-toggle-history` | **missing surface** — no history existed anywhere on the card |
| 5 | §5 collapses every healthy source to a line — 9 `source-line` | **missing surface** — variant B did not exist; every source was a full card |
| 6 | §5 ⛔ NEVER collapses a stopped or unreadable source — 3 `source-card` | **missing surface** |
| 7 | §5 accounts for every source exactly once | **missing surface** |
| 8 | §6 ⛔ the request-timetable word is not in `WatchedFoldersSection.tsx` | **a live shipped defect**, at `:78` |
| 9 | §6 ⛔ the alarm token is never applied to a source state | **a live shipped defect**, at `:274-275` |

### ⚠ FOUR of the remaining 27 reds are a DEFECT IN THE FENCE, not an unbuilt surface

The coordinator flagged this mid-flight and it is confirmed by measurement here. `sourceComposition.test.tsx`
§3 asserts every block kind with **`getByTestId` — a SINGLE-match query** — while §5 of the same file
asserts that several of those kinds appear **9, 3, 17 and 2 times**. The two sections contradict each
other, and §4 of the same file already uses `getAllByTestId(...).length`, which is the shape §3 needs.

**Grouped failure messages, verbatim from the run's own output:**

```
1 TestingLibraryElementError: Found multiple elements by: [data-testid="sources-source-line"]
1 TestingLibraryElementError: Found multiple elements by: [data-testid="sources-source-card"]
1 TestingLibraryElementError: Found multiple elements by: [data-testid="sources-outcome"]
1 TestingLibraryElementError: Found multiple elements by: [data-testid="sources-stopped-sentence"]
```

⭐ **`Found multiple elements` is the opposite verdict from `Unable to find an element`.** Those four
blocks ARE BUILT and are rendering at the contract's own counts — §5's `9 source-line` / `3 source-card` /
*"every source exactly once"* cases all pass in the same run against the same DOM. **The surface is
right and the assertion is wrong.**

⛔ **The surface was NOT deformed to satisfy the single-match query.** Rendering one `source-line`
would turn §3 green and break §5, the variant-B fork the operator chose, and the whole point of the
9-vs-3 fixture.

⛔ **The fence was NOT edited by this plan, and that is a decision rather than an omission.** Plan 09
is running concurrently in this same wave and hit the identical defect on `rail-rail-item`; two agents
editing one fence file in one wave is a merge conflict, and the fence is in neither of this plan's
`files_modified` nor its brief's permitted set. **The exact repair is one line per case
(`getByTestId(x)` → `getAllByTestId(x).length >= 1`), and whoever owns the fence must drive it RED
against a planted absence first** — a relaxed assertion that can no longer name a MISSING block is
precisely what sketch 218 shipped.

### The remaining 23 reds, each attributed

| red | owner | why |
|---|---|---|
| §3 `instance-statement` · §5 `instance-statement appears exactly once` (2) | **fence fixture** | The fence primes `getSourceHealth` with **`reader_running: true`**, and D-235-12 says the statement renders ONLY when the reader is off. **The statement is BUILT and proven** by `IngestionTab.readerOff.test.tsx`'s exactly-once case; the fence's own fixture makes its assertion unreachable. |
| §3 `history` · `run` · `quiet-fold` · `fail-reason` · §4 `toggle-quiet` (5) | **fence timing** | All five live inside `RunHistoryList`, which mounts on first expansion. §3 and §4 assert at MOUNT, with no click, while §5 of the same file clicks `toggle-history` first. **The blocks are BUILT and proven** by the history suite's own 3-vs-17 case. |
| §5 `a collapsed history shows 3 run rows; expanded shows all 17` (1) | **fence fixture** | `AssertionError: expected [ … ] to have a length of 3 but got 17`. The fence's `SAMPLE_RUNS` objects carry `{id, quiet, added, updated, started_at}` and **none of `status`, `listing_complete` or the six `count_*` fields**, so `isQuiet` returns false for every one and nothing folds. The same 17-tick fixture in `SyncRun` shape folds to exactly 3 + 1 in this plan's own suite. |
| §4 `report-source` (1) | **fence fixture** | The fence's third card row is `last_status: "paused", is_active: false` and carries **no `degraded: true`**. The degraded row and its report control are BUILT and proven by two cases in `WatchedFoldersSection.test.tsx`. |
| §3 `tab-ingestion` · `tab-health` (2) | **plan 08** | Library tab triggers. Not this plan's. |
| §3 `body-health` · `attention-list` · `attention-row` · §4 `go-to-source` · §5 `2 attention-row` (5) | **plan 11** | The Health tab section. |
| §3 `rail-item` · `rail-item-library` · `badge` · `popover` · `pop-item` · §4 `badge` · `open-health` (7) | **plan 09** | The rail signal. |

**23 + 4 = 27.** Every remaining red is accounted for.

---

## The RED drives, recorded rather than claimed

### Task 1 — the whole variant-B suite, driven RED against the shipped component

The implementation was removed with `git checkout --` on the three source files, the rewritten suite
run against the Phase-234 component, and its output recorded before a line of the new component was
committed:

```
Failed Tests 24
Tests  24 failed | 3 passed (27)
```

All 24 named cases are listed in the commit body of `4a59337c4`. **The 3 that passed are the ones that
must**: the `?raw` non-vacuity control, the SURF-01 cadence case (a Phase-234 invariant that must
survive untouched), and the *"the table it loops over is non-empty and carries all four causes"*
control — without which the four per-cause cases would be a loop over nothing.

### Task 2 — the request-timetable fence, driven RED against a planted defect

A single line was planted back into `handleSyncNow` — the Phase-234 feedback string, verbatim — and the
fence fired, **naming the file and the word**:

```
FAIL src/components/sources/WatchedFoldersSection.history.test.tsx > WatchedFoldersSection — the history,
     and what Sync now says > the words this file may never say > ⛔ the request-timetable word appears
     nowhere in the component
AssertionError: expected '/**\n * phase 235 plan 10 (surf-02 / …' not to contain 'scheduled'
Tests  1 failed | 16 passed (17)
```

The plant was removed and the suite returned to `17 passed (17)`. ⚠ **The other 16 stayed green under
the plant**, which is what proves the fence is scoped to the word and is not a blanket tripwire.

### ⚠ Pitfall 8 caught this plan TWICE, both times as a real failing check

Plan 04's SUMMARY warned that a literal inside a docblock is still a literal. It happened anyway, twice:

1. The component's own docblock explaining what was deleted spelled `window.location`, the timetable
   word, the present-tense progress claim, and both SURF-01 push words. Caught by a grep before the
   first commit.
2. **The colour-rule docblock spelled the comparison expression the alarm-token fence greps for**, and
   named a legal `destructive` Delete button within 200 characters of it — so the fence's regex matched
   the DOCUMENTATION OF THE PROHIBITION. That one was caught by the suite, not by a grep:
   `AssertionError: expected '/**\n * Phase 235 plan 10 (SURF-02 / …' not to match /last_status\s*===\s*"failed"[\s\S]{0,…/`,
   at `26 passed | 1 failed`.

Both docblocks now say the same thing without spelling the token, and **both say so explicitly**, so
the next author reaches for the rewording rather than for the literal.

---

## What was built

### Task 1 — variant B, the one control per cause, the degraded row (`4a59337c4` RED → `34bcabe9b` GREEN)

`WatchedFoldersSection.tsx` went from 393 to ~880 lines and the `watches.map` body became a `WatchRow`
child holding its own disclosure, history and quiet-fold state.

- **The fork.** `classifyWatch` returns one of five states from a single function; `COLLAPSIBLE_STATES`
  is `["healthy", "waiting"]` and everything else is a card, always. `STATE_PRESENTATION` is ONE lookup
  replacing the two parallel five-arm ternaries — a sixth state adds a row and edits nothing.
- **The cause.** `isDisconnected`'s substring sniff of `last_error` is gone. The server's
  `stopped[].cause` decides (D-235-05), with the vocabulary leaf's `classifySourceFailure` as the
  fallback for a row written before the classifier landed.
- **The one control.** `runFix` reads `CONTROL_FOR_CAUSE[cause].action` and dispatches on THAT — there
  is no per-cause `if` in the card. The suite asserts it as `for (const cause of Object.keys(CONTROL_FOR_CAUSE))`,
  with a non-empty check first, so a fifth cause needs a table row and no edit here.
- **The page load is deleted.** `grep -c "window.location"` returns **0**. With no `onNavigateToConnections`
  the Reconnect control renders as ABSENT, asserted by its own case — a dead click was the alternative
  and it is worse than an honest gap.
- **The colour.** `grep -c "color-danger"` returns 0 and the alarm token is nowhere near a source state.
  Every non-healthy tone is amber, and every state reads as glyph + label + colour.
- **`watch-card-{id}` is on ONE line as both `id` and `data-testid`**, so plan 08's
  `getElementById` scroll target resolves and Phase 234's hook survives. `grep -c 'id={\`watch-card-'`
  returns **1** — deliberately on one line, because the pattern also matches `data-testid={\`watch-card-`
  and two lines would read 2.

### Task 2 — the history on the card, and the Sync button's honesty (`1c3c3310f`)

- `RunHistoryList` is MOUNTED, not re-implemented; `runHistoryFold` is not re-implemented either.
- **Fetched on first expansion, once.** A case asserts `listSyncRuns` is not called before the click,
  is called exactly once after it, and is still at one after a close-and-reopen. Twelve cards do not
  fire twelve requests.
- **SEED-248** — `sources-history-loading` renders while the fetch is in flight, with a case that
  holds the promise open, asserts the element and its non-empty text, then releases it.
- **The pending state.** `status: "asked"` sets `COPY.asked(withinPhrase(next_check_within_seconds))`;
  `status: "refused"` sets a separate `sources-refusal` element and explicitly clears any pending ask.
  The pending sentence is replaced by the real outcome **only once `last_run_at` advances past the
  click** — a case proves the flip and then asserts the word `Asked` is gone.
- **The outcome has two arms**, asserted separately, plus a third for a source that has never ticked
  (which says `COPY.neverRead` rather than inventing a time — `relativeBand`'s own recorded rule).

### Task 3 — the instance statement, once, above the sub-tabs (`3fc66eb35`)

`IngestionTab.tsx` gained **`+26 / −1`**: one import pair, one `useSourceAttention()` call, one
`SourceReaderStatement` mount, two props threaded into `WatchedFoldersSection`, and one wrapper `div`
carrying `data-testid="sources-body-ingestion"`.

- `grep -c "WATCH_PROCESS_ENABLED"` returns **0** — the literal lives in the vocabulary leaf.
- `git diff | grep '^+' | grep -c useState` returns **0**; `lazy`/`Suspense` likewise **0**.
- The exactly-once case uses `getAllByTestId(...).length === 1`, **because the failure being guarded
  against is TWO, not zero**.
- A negative case asserts that with the reader off across three healthy watches, **zero**
  `sources-stopped-sentence` and **zero** `sources-source-card` render — no source is accused of being
  broken because the server is switched off (D-235-12).

---

## Deviations from Plan

### 1. `[Rule 3 — blocking] `frontend/src/lib/api/sources.ts` had to be widened, and it is not in `files_modified``

- **Found during:** Task 1.
- **Issue:** 235-07-SUMMARY recorded it explicitly — *"a Wave-4 surface reading
  `res.next_check_within_seconds` will not compile until then. Plan 10 (or whichever plan first renders
  the pending state) must widen it."* `WatchSyncResponse` was still `{ status, message }`.
- **Fix:** the three plan-07 reply fields added as **optional** (a refusal carries neither timing field),
  with a docblock stating that `"asked"` and `"refused"` are the two new `status` values and that
  `"pending"` is deliberately not one of them.
- **Commit:** `34bcabe9b`

### 2. `[Rule 3 — blocking] `LibraryPage.initialTab.test.tsx`'s mock factory had to declare the two new exports`

- **Found during:** Task 3 planning, before it could break anything.
- **Issue:** `IngestionTab` now mounts `useSourceAttention`, which imports `getSourceHealth` from
  `@/lib/api/sources`. That suite FULLY mocks the module and declared neither `getSourceHealth` nor
  `listSyncRuns`, so it would have thrown **at mount** about a missing export — Phase 196-08's
  nine-suite failure mode, and precisely the landmine `sources.ts`'s own comment block warns about.
- **Fix:** two entries added to the factory, with a comment naming why. **No assertion and no case
  count changed** — the file still reads 12 of the 22 `LibraryPage` cases.
- **Why not left alone:** the file is owned by plan 08, which has already SHIPPED and is in this plan's
  merge base (`da2b69d74`), so there is no concurrent editor. Leaving it would have handed the phase a
  red suite that this plan caused.
- **Commit:** `4a59337c4`

### 3. `[Rule 2 — missing critical functionality] `readerRunning` / `stoppedSources` are PROPS, not a second hook mount`

- **Issue:** the plan's Task 1 asks for a `readerOffRow` arm in the card's status lookup, and Task 3
  asks `IngestionTab` to gate the statement on `useSourceAttention().readerRunning`. The obvious reading
  is two mounts of the hook — which is two pollers of `/sources/health` on one tab.
- **Fix:** `IngestionTab` calls the hook ONCE and threads `readerRunning` + `stopped` down.
  `readerRunning` defaults to `true` so a mount that cannot know does not accuse every source of
  waiting. This mitigates T-235-13 (poll amplification) rather than doubling it, and it keeps the
  key-link the plan asked for — `readerRunning` appears in `IngestionTab` — intact.
- **Commit:** `3fc66eb35`

### 4. `[Rule 1 — plan/contract gap] `paused` is a CARD, and the plan does not say so`

- **Issue:** the plan names *stopped* and *degraded* as never-collapsed. The generated contract requires
  **3** `source-card` in a fixture whose third non-healthy row is `last_status: "paused", is_active: false`
  with no `degraded` flag. On the plan's literal wording that row would be a line, giving 10 + 2.
- **Resolution:** a paused source is **not reading**, so it is not the healthy one-line case the
  disclosure exists for. It renders as a card with its own state word and no collapse control. This
  makes the contract's 9 + 3 hold on the fence's own fixture, and it is asserted by its own case
  (*"⛔ NEVER collapses a paused source either — it is not reading"*).
- **Commit:** `34bcabe9b`

### 5. `[Rule 1 — acceptance criterion vs. the safer implementation] `last_error` reaches TWO vocabulary entry points, not one`

- **Issue:** Task 1's acceptance says `grep -n "last_error"` should show it *"only as an argument to
  `sourceFailureSentence`"*. The implementation has **two** code hits:
  `classifySourceFailure(watch.last_error)` and `sourceFailureSentence(watch.last_error, connectionName)`.
- **Why:** the card needs the CAUSE (to look up the one control) *and* the SENTENCE. Both are entry
  points of the same strict leaf and neither returns the raw string. Using only `sourceFailureSentence`
  would leave no cause for `CONTROL_FOR_CAUSE`; using only `SENTENCE_FOR_CAUSE[classify(...)]` would
  lose the leaf's honest pass-through for the backend's own authored prose on the `unknown` arm.
- **Resolution:** the criterion's SPIRIT — *the raw column never reaches JSX* — is enforced by an
  executable fence rather than by a one-off grep: `⛔ the raw last_error is only ever handed to the
  vocabulary leaf` reads the component's own source, filters out docblock lines, asserts the remaining
  set is non-empty, and requires **every** one to match
  `/(classifySourceFailure|sourceFailureSentence)\(\s*watch\.last_error/`. A future edit that renders it
  directly fails by name.
- **Commit:** `34bcabe9b`

### 6. `[Rule 2] Four short state labels are written in this component, not in the vocabulary leaf`

- **Issue:** `Reading` · `Paused` · `Stopped` · `Unreadable here` have no key in `COPY`.
- **Why not added there:** `sourceHealthVocabulary.test.ts:138` pins `Object.keys(COPY)` at exactly
  **26**. Adding four keys would redden a green fence in a file this plan does not own, in a wave with a
  live sibling agent — the identical constraint plan 04 recorded for `LISTING_INCOMPLETE_NOTE`.
- **Resolution:** they are one- or two-word STATE LABELS, not sentences; every actual sentence on this
  surface still resolves through the leaf. `COPY.readerOffRow` IS used for the waiting state, because
  that one exists. Whichever plan re-baselines the 26-key pin should hoist the other four.

### 7. `[recorded, not fixed] The composition fence's §3 single-match defect`

See the fence section above. Measured, recorded verbatim, and deliberately **not** repaired here because
plan 09 is live in the same file this wave.

---

## Threat Flags

None. This plan adds no network endpoint, no auth path, no file access pattern and no schema change.
It **removes** surface, and every removal is asserted rather than asserted-about:

| threat | disposition | evidence |
|---|---|---|
| T-235-33 — a provider stack frame or token reaching the card | **mitigated** | the raw column reaches only the vocabulary leaf's two entry points; enforced by a `?raw` fence over the component's own source, not by a claim |
| T-235-34 — the member sentence naming operator configuration | **mitigated** | `grep -c "WATCH_PROCESS_ENABLED" IngestionTab.tsx` → **0**; the marked operator half is a separately addressable element |
| T-235-35 — a card claiming a source is individually broken when the instance reader is off | **mitigated** | two negative cases, one per surface: zero `sources-source-card` and zero `sources-stopped-sentence` across three healthy watches with `reader_running: false` |
| T-235-36 — a navigation control performing a full page reload onto an unrouted path | **mitigated** | `grep -c "window.location"` → **0**, and a suite case fences it over the live file |
| T-235-SC — package installs | **n/a** | **no package was installed by this plan.** `package.json` is byte-unchanged |

---

## Known Stubs

**One, stated rather than hidden.** The `report-source` control (`COPY.degradedAction`) has **no report
endpoint to call** — none exists in the product. Rather than wire a control that goes nowhere (the exact
defect sketch 233's own variant C had to fix), it reveals the server's **machine-safe** reference token
(`projection_failed:<ExceptionClass>` — plan 07 proved by test that it carries no frame, no exception
text and no table name) so a person can quote it verbatim when reporting. This is documented at the call
site. A real reporting channel is a product decision, not a gap in this plan.

---

## ⛔ Things the remaining Wave-4 plans must not lose an hour to

1. **`sourceComposition.test.tsx` §3 uses `getByTestId` and §5 asserts multiplicity.** Four `sources-*`
   blocks fail there with `Found multiple elements`, which is the OPPOSITE verdict from
   `Unable to find an element` and means the surface is built. **Do not build one of anything to make
   §3 green.**
2. **The fence primes `getSourceHealth` with `reader_running: true`**, so its own `instance-statement`
   cases can never pass while D-235-12 holds. Fixing that is a one-word fixture change in the fence.
3. **The fence's `SAMPLE_RUNS` are not `SyncRun`-shaped** — no `status`, no `listing_complete`, no
   `count_*` — so `isQuiet` is false for all 17 and its own 3-vs-17 case cannot pass. Also a fixture fix.
4. **`WatchedFoldersSection` now takes `readerRunning` and `stoppedSources` as OPTIONAL props.** Any new
   mount that does not pass them gets `readerRunning: true` and an empty verdict, which is the
   accuse-nobody default. Pass them from a surface that already holds the hook rather than mounting a
   second poller.
5. **`SourceReaderStatement` is exported from `WatchedFoldersSection.tsx`.** It renders `null` when the
   reader is running. It is deliberately not a new file: this plan's `files_modified` did not include one.

---

## Self-Check: PASSED

Every file claimed above resolves on disk, and every commit hash resolves in `git log`:

```
FOUND: frontend/src/components/sources/WatchedFoldersSection.tsx
FOUND: frontend/src/components/sources/WatchedFoldersSection.test.tsx
FOUND: frontend/src/components/sources/WatchedFoldersSection.history.test.tsx
FOUND: frontend/src/components/library/IngestionTab.tsx
FOUND: frontend/src/components/library/__tests__/IngestionTab.readerOff.test.tsx
FOUND: frontend/src/lib/api/sources.ts
FOUND: frontend/src/pages/__tests__/LibraryPage.initialTab.test.tsx
FOUND: 4a59337c4  FOUND: 34bcabe9b  FOUND: 1c3c3310f  FOUND: 3fc66eb35
```

⛔ `.planning/STATE.md`, `.planning/ROADMAP.md`, `scripts/vitest-count-gate.cjs`,
`frontend/src/components/layout/NavPanel.tsx`, `frontend/src/components/layout/ChatLayout.tsx` and
`frontend/src/components/chat/ChatArea.tsx` are **not** in `git diff --name-only 845a90b62..HEAD`.

## TDD Gate Compliance

Task 1 shows the full RED → GREEN sequence in `git log`, in order, with the RED run's own output
recorded above rather than asserted (`test(235-10)` `4a59337c4` → `feat(235-10)` `34bcabe9b`).

⚠ **Tasks 2 and 3 do NOT show a separate RED commit, and that is stated rather than papered over.**
Both surfaces live inside the same two components as Task 1 and were authored as one file, so their
implementations landed in Task 1's GREEN commit; their suites went green on first run. **The RED
obligation Task 2 actually specifies — *"restore the forbidden string, confirm the source fence fails
naming the file and the word, remove it again, record the message verbatim"* — was performed and is
recorded above in full.** Task 3's suite was likewise verified against a real before/after measurement
of its directory (202 → 202 with the change reverted, 207 with it restored), so its five cases are
provably additive.

## Commits

| hash | message |
|---|---|
| `4a59337c4` | `test(235-10): variant B, the one control per cause, and the named degraded row — failing` |
| `34bcabe9b` | `feat(235-10): a healthy source is one line; a stopped one says what happened and offers the fix` |
| `1c3c3310f` | `test(235-10): the history on the card, and what the Sync button is allowed to say` |
| `3fc66eb35` | `feat(235-10): the reader-off statement, once, above the sub-tabs` |
