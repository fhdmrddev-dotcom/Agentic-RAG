---
phase: 244-the-chat-shell-and-the-composer
plan: 04
subsystem: app-shell / library navigation
tags: [SHELL-05, BUG-260911-03, attention-registry, library-tabs, D-235-03, D-235-05, C-5]
requires:
  - "frontend/src/components/layout/attentionConditions.ts (Phase 235 plan 09 — the registry)"
  - "frontend/src/lib/libraryTabHandoff.ts (Phase 235 plan 15 — the one-shot lifetime rule)"
  - "frontend/src/pages/librarySelection.ts (D-217-12 — the five-member LibraryTab union)"
  - "244-01 (merged — ChatLayout.tsx's min-h-0 chain)"
provides:
  - "AttentionCondition.tab?: LibraryTab — set by the one existing producer"
  - "attentionCountByTab() — a strict leaf bucketing conditions per tab"
  - "LibraryHeaderBar attention prop — a per-tab aria-hidden count on the segmented control"
  - "LibraryPage attentionConditions prop — the shell's verdict, threaded as data"
affects:
  - "the Library's five-tab segmented control (visual — one new mark)"
  - "244-VALIDATION.md rows for D-244-15(a) and (b) — both still OWED"
tech-stack:
  added: []
  patterns:
    - "optional field on an existing interface, set by the existing producer (C-5)"
    - "thread a resolved verdict DOWN as data rather than adding a second reader"
    - "aria-hidden count badge — decorate a control's name, never rename it"
key-files:
  created:
    - frontend/src/components/layout/__tests__/attentionTab.test.ts
    - frontend/src/pages/__tests__/LibraryPage.tabAttention.test.tsx
  modified:
    - frontend/src/components/layout/attentionConditions.ts
    - frontend/src/components/library/LibraryHeaderBar.tsx
    - frontend/src/pages/LibraryPage.tsx
    - frontend/src/components/layout/ChatLayout.tsx
    - scripts/vitest-count-gate.cjs
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
    - .planning/reported-bugs/BUG-260911-03-library-badge-does-not-say-which-tab-needs-attention.md
  deliberately-unmodified:
    - frontend/src/App.tsx
    - frontend/src/components/layout/AttentionPopover.tsx
decisions:
  - "D-244-15 discretion taken: a COUNT, not a dot — the shell already earned a number"
  - "the mark is rendered by LibraryHeaderBar.tsx, not LibraryPage.tsx (the triggers moved at sketch 231-A)"
  - "SEED-231 considered and NOT taken — the registry keeps exactly one tenant"
  - "arm 1 of the registry's re-open trigger fired-and-not-taken; cross-referenced with 244-03"
  - "BUG-260911-03 stays `folded`; verified_closed_by is the VALIDATION row, never a green unit test"
metrics:
  tasks: 2
  commits: 4
  cases-added: 25
  completed: 2026-09-12
---

# Phase 244 Plan 04: The badge's count, attributed to a tab — Summary

One optional `tab?: LibraryTab` on `AttentionCondition`, set by the one producer that already
existed, threaded to the Library as data and drawn as an `aria-hidden` count on the owning tab —
closing the half of `BUG-260911-03` that is buildable, while stating in writing that `SHELL-05`
does **not** close here.

## What shipped

| Task | What | Commits |
|---|---|---|
| 1 | The condition learns its tab — one field, one producer, one count | `dc253eb45` (RED) · `b741ed609` (GREEN) |
| 2 | The tab says WHERE — carried through the one-shot hand-off | `efa8a73e5` (RED) · `7849275ba` (GREEN) |

**The change, in full:** `AttentionCondition` gains `tab?: LibraryTab`;
`useStoppedSourceConditions` sets `tab: "health"`; a strict leaf `attentionCountByTab()` buckets a
condition list per tab; `ChatLayout` passes its ALREADY-RESOLVED `attentionConditions` into the
`<LibraryPage>` mount it already renders; `LibraryPage` memoises the count map and hands it to
`LibraryHeaderBar`, which renders one `aria-hidden` count per marked trigger.

## ⭐ The report's own guess was refuted — and the report asked for exactly that

`BUG-260911-03` said: *"the likely shape is that `attentionConditions` already knows what KIND each
condition is … **Verify that before building anything** — this report asserts the symptom, not the
cause."*

**Verified from source, and it does not.** `AttentionCondition` shipped **four** fields
(`id` / `title` / `detail` / `onOpen`) and carried no kind at all. The kind lives one level up on
`AttentionProducer.key`, and on `StoppedSource.cause` — which the producer **consumes and discards**
into the `detail` sentence. So the cheapest honest route is one optional field set by the producer
that already exists, which is what `C-5` ruled and what shipped. A plan that had trusted the guess
would have gone looking for a field to read.

## The three prohibitions the attribution could have been bought with — and was not

Each is a named rule with a measured defect behind it. **All three are now fenced, not merely
honoured.**

1. **No second producer (D-235-03).** `ATTENTION_PRODUCERS.length === 1` and its key is
   `stopped-sources`, asserted in this plan's OWN suite as well as `NavPanel.badge.test.tsx` — so
   the constraint travels with the file that changed rather than living only in a neighbour's.
   ⛔ **`SEED-231` (nobody is told an approval is waiting) was considered and deliberately NOT
   taken.** `SHELL-03` made it topical, which is exactly when a seam gets filled in by accident.
2. **No third `useSourceAttention()` reader.** The attribution travels as DATA. A `?raw` inventory
   in both suites pins the call sites BY FILE.
3. **No second writer of `libraryTab`.** `App.tsx` is **byte-unchanged**; `setLibraryTab(` is still
   called exactly twice, counted over STRIPPED code (a raw-text count would be satisfiable by a
   comment — the 187-24 lesson `App.tsx:96-106` already records once).

## ⚠ Arm 1 of the registry's re-open trigger: FIRED-AND-NOT-TAKEN, and it must be triggered ONCE

`attentionConditions.ts`'s own three-part re-open trigger names **a third concurrent reader** as arm
1. This plan is the first change since Phase 235 that had a reason to add one — and declined, because
firing a file's documented deferral to save a single prop is the trade that deferral exists to refuse.

⚠ **`244-03` independently fires arm 1's SHAPE for `useAskUserPrompt`** — a different hook, the same
trigger shape. **The hoist should be triggered once, on both data points, rather than twice by
halves.** Recorded here and in the file's own docblock so the next reader sees both.

## ⚠ Measured corrections to this plan's own brief

**1. The plan's Task 1 Test 5 asks for "exactly TWO `useSourceAttention()` call sites in `src/`".
There are THREE, and that was true before this plan touched anything.**

Measured at base `310b91e83`: `components/layout/attentionConditions.ts`,
`components/library/IngestionTab.tsx`, `components/library/SourcesAttentionSection.tsx` — which is
exactly the set the shipped fence in `ChatLayout.badge.test.tsx:385-390` already pins. **TWO is the
count of CONCURRENT readers** (the shell, plus whichever Library tab body is mounted; the last two
are mutually exclusive by tab because `tabs.tsx` has no `forceMount`). The plan conflated call sites
with concurrent readers. **Pinning the plan's number would have been RED on an untouched tree** —
a fence that fails on the shipped world is not a fence, it is a false alarm shipped as a guard. The
fence asserts the measured set of three and says why, in the suite body.

*Consequence for the plan's acceptance criterion* — *"`grep -rc 'useSourceAttention()' … returns 2.
⛔ 3 fails this criterion outright"*: **the criterion is unsatisfiable as written**, at base or at
HEAD. The property it was reaching for — *no NEW reader* — holds and is fenced.

**2. The mark is rendered by `LibraryHeaderBar.tsx`, not `LibraryPage.tsx` (deviation, Rule 3).**

The plan says *"`LibraryPage.tsx`: render the per-tab mark on the segmented control"*. **The five
triggers moved out of that file at sketch 231-A.** `LibraryPage.tsx:794` carries a comment recording
why keeping a second copy there is a defect, not a convenience: the first cut kept a hidden
`TabsList` "to preserve the `<screen>-tabslist` hook", which put a SECOND element with `role="tab"`
and the same accessible name in the tree and broke **41 cases** with
`getMultipleElementsFoundError`. **A hidden duplicate of an interactive control is not a preserved
contract, it is a second control.** So the page composes (`attentionCountByTab` + a `useMemo`) and
the header row draws. The `LIBRARY_TABS`-derived-from-`TAB_LABELS` rule is untouched — `D-217-15`
holds, and the suite asserts the rendered `data-tab` order and the rendered labels both equal it.

⚠ **That deviation pulled `LibraryHeaderBar.tsx` into the blast radius, and it had NO LEDGER ROW.**
`2 / 1 / 162` at base — below G-5's threshold, but **an absent row is invisible to G-5 at any
count**. A row + section were added at its SECOND touch (the `settingsSearchPayload.ts` precedent).
⚠ **No `244` plan named this file**, so `check-hot-file-ledger.cjs` could never have asked for it:
the gate only sees files a plan NAMES, which is the `App.tsx` 23-phase hole in miniature.

## ⚠ A fixture bug of mine, recorded because of WHEN it surfaced

`stoppedConditions(n, tab)` first took `tab: LibraryTab | undefined = "health"`, so the case meaning
to build a **tab-less** condition passed `undefined` and got the DEFAULT back. **It read GREEN in the
RED run** — nothing rendered at all yet — **and only went red once the feature worked**, which is the
worst possible order to discover a fixture bug in: a passing negative case during RED is exactly what
a red-washed test looks like. Fixed to `LibraryTab | null`, with the reason written into the helper.
**A default parameter cannot express "explicitly absent"; `null` can.**

## RED evidence — every fence driven, two against planted defects

**Task 1** (`attentionTab.test.ts`, 10 cases — **2 RED**, 8 green controls):

```
AssertionError: expected undefined to be 'health'   // condition.tab
AssertionError: expected Set{ undefined } to deeply equal Set{ 'health' }
```

The 8 controls were green BEFORE the edit and their job is to prove nothing else moved: harness
non-vacuity, `ATTENTION_PRODUCERS.length === 1`, the five cause sentences asserted on their WORDS,
and the `?raw` reader inventory.

**Task 2** (`LibraryPage.tabAttention.test.tsx`, 15 cases — **8 RED**):

```
AssertionError: expected null to be '1'          // no tab carries a mark
AssertionError: expected null to be '3'
TypeError: attentionCountByTab is not a function
AssertionError: expected false to be true        // the ChatLayout key-link fence
```

⭐ **The two hand-off fences were GREEN on the shipped tree, so they were driven RED against PLANTED
defects and both files restored md5-identical.** A guard nobody has seen fire is not a guard.

| Planted defect | File | RED output | Restored |
|---|---|---|---|
| a third `setLibraryTab(` writer | `frontend/src/App.tsx` | `expected 3 to be 2` | `901cea479e896807e3a4b6ea006c61b6` ✅ |
| `libraryTabAfterNavigate` returns `pending` unconditionally | `frontend/src/lib/libraryTabHandoff.ts` | `expected 'health' to be undefined` | `300e3b9e1d58ced61fd65da2c882e026` ✅ |

## ⚠ Presence assertions cannot see content drift — so nothing here asserts presence

Every mark assertion reads **rendered text** (`markOn(tab)` returns `textContent`, or `null` when the
element is absent) and every label assertion reads the **accessible name**
(`getByRole("tab", { name })`). A `data-testid`-exists assertion would have passed over a badge that
lit the wrong tab, printed a zero, or renamed its control.

⛔ **The `aria-hidden` on the count is load-bearing, not decoration.** `IngestionTab.tsx:176-188`
records this project's own measurement: an unhidden count turned a tab's accessible name into
*"In progress 3"* and broke six `getByRole` cases. There are 41+ such cases against THIS control.
The suite asserts the five accessible names are still exactly `TAB_LABELS`' values **while a mark is
rendered** — which is the assertion that can tell the two worlds apart.

## The draw: a COUNT, not a dot (D-244-15 discretion, with its reason)

The shell has **already earned a number**, and the operator's own complaint is that *"the cost scales
the wrong way"* — the badge is most useful exactly when several things need attention. A dot would
discard that number at the moment it starts being worth having. The warning tone, the pill shape and
the `-top-1 -right-1` placement are the **shipped rail-badge vocabulary**; `D-244-18` forbids
re-designing this operator-approved surface, so **no new mark was invented**.

⚠ **Empty ⇒ render nothing.** No zero badge, no reserved space, no dimmed dot — and the rule lives in
the leaf (`attentionCountByTab` OMITS empty tabs rather than emitting zeroes) instead of being
re-decided by every caller. A resting Library is byte-identical to before this plan.

## ⛔ D-244-18: this surface was deliberately NOT sketched, and that is stated rather than assumed

`SHELL-05`'s signal **shipped at Phase 235 plan 09** and its design was operator-approved (finding
`F-1`). Sketching it would be re-designing live UI. The one net-new mark rides the existing rail-badge
vocabulary rather than proposing a new one, which is the whole reason a sketch is not owed.

## ⛔ OWED AT PHASE CLOSE — a stale register entry that contradicts a locked decision

`.planning/REQUIREMENTS.md:207` reads:

```
| SHELL-05 | 244 — Chat shell + composer | Pending — ⚠ G-2 sketch owed (net-new surface) |
```

**That contradicts locked `D-244-18` and finding `F-1`.** `SHELL-05`'s signal is not a net-new
surface; it shipped at Phase 235 with operator-approved design. ⛔ **This plan deliberately did NOT
edit it** — it is outside this plan set, and `/gsd:verify-work` can strike the phrase in one edit.

⭐ **Record it as a correction BESIDE the entry, never as a silent overwrite.** A register quietly
edited to agree with the build is how this project loses the evidence that it was ever wrong — and
`REQUIREMENTS.md` has now been stale for **four milestones running**.

## ⛔ SHELL-05 DOES NOT CLOSE HERE

Stated plainly, because `SURF-03` was ticked on a code reading for a whole milestone and closed
UNTICKED. **Both halves of `D-244-15` are DRIVEN rows in `244-VALIDATION.md` and neither has been
driven:**

- **(a)** a genuinely stopped watch raises the badge while the operator is doing something else —
  **and a HEALTHY source raises nothing.** The negative is the ROADMAP's named failure mode: *a
  signal nobody trusts after the first false one.* ⛔ **Nobody has ever driven this end to end.**
- **(b)** the badge's count is attributed to the owning tab — built here, unit-fenced here, **not
  yet seen by a person.**

`BUG-260911-03` therefore stays `status: folded` with `verified_closed_by: null`. **Set it to the
VALIDATION row id, never to a commit hash.** A green unit test has never been this project's
definition of closed.

## ⚠ An INHERITED red, established against base rather than assumed

Running `LibraryPage.initialTab.test.tsx` **in the same invocation as**
`ChatLayout.badge.test.tsx` + `renameFence.test.ts` reds two cases:

```
LibraryPage.initialTab.test.tsx > lands on Documents with NO prop
  Error: Test timed out in 5000ms.
LibraryPage.initialTab.test.tsx > ⭐ lands on Health when the CALLER asks for it
  TestingLibraryElementError: Found multiple elements with the role "tab" and name "Health"
```

The second is a **cascade** of the first: the timed-out case leaves its DOM mounted, so the next
case sees two tablists.

**Procedure followed, in this order:** filenames captured from the failing run BEFORE any re-run →
`git diff --numstat 310b91e83 HEAD -- <suite>` returned **empty** (the suite file is **provably
unmodified**) → three samples at HEAD → four source files checked out at base `310b91e83` → three
samples at base → sources restored from HEAD and re-verified by grep. **The cap was never touched.**

| | HEAD (this plan) | base `310b91e83` |
|---|---|---|
| sample 1 | 2 failed / 38 passed | **1 failed** / 39 passed |
| sample 2 | 2 failed / 38 passed | **2 failed** / 38 passed |
| sample 3 | 2 failed / 38 passed | **2 failed** / 38 passed |

⛔ **INHERITED.** Base reds on 3 of 3 samples with the plan's sources reverted. ⚠ **The single green
base run I saw earlier was LUCK, and it nearly led me to attribute this to my own change** — which is
SEED-171's own warning that one sample proves nothing, met from the opposite direction.

⚠ **The suite passes 15/15 ALONE** at HEAD, and the full in-scope set (5 files, 65 cases) passes
together. It is the specific three-file combination that trips. `LibraryPage.initialTab.test.tsx`
registers **no `afterEach(cleanup)`**, which is why a timeout there cascades instead of failing
alone — worth naming for whoever picks this up. **Not attributable to `244-04`; not fixed here**,
because it is out of scope under the executor's scope boundary. Logged for the phase.

## Deviations from Plan

### Auto-fixed / decided

**1. [Rule 3 - Blocking] The segmented control had moved out of `LibraryPage.tsx`**
- **Found during:** Task 2
- **Issue:** the plan directs the mark to be rendered in `LibraryPage.tsx`; the five triggers live in
  `LibraryHeaderBar.tsx` since sketch 231-A, and a second copy in the page is the measured 41-case
  `getMultipleElementsFoundError` defect the page's own comment warns about.
- **Fix:** `LibraryHeaderBar` gains one optional `attention` prop and renders the mark; the page
  composes the map and passes it. No second control.
- **Files:** `frontend/src/components/library/LibraryHeaderBar.tsx`, `frontend/src/pages/LibraryPage.tsx`
- **Commit:** `7849275ba`

**2. [Rule 2 - Missing critical] `LibraryHeaderBar.tsx` had no hot-file ledger row**
- **Found during:** Task 2, as a consequence of deviation 1
- **Issue:** the file entered the blast radius and was in neither registry; no `244` plan names it,
  so the ledger gate could never have asked for it.
- **Fix:** row + section added at its second touch, triple re-derived with `--follow`.
- **Commit:** `7849275ba`

**3. [Rule 1 - Bug] The plan's "TWO call sites" figure is wrong at base**
- **Fix:** the fence pins the measured set of three and records why TWO is the concurrent-reader
  count, not the call-site count. See *Measured corrections* above.
- **Commit:** `dc253eb45`

**4. [fixture] `undefined` default-parameter bug in this plan's own test helper**
- Caught at GREEN, not at RED. See its own section above.
- **Commit:** `7849275ba`

### Not taken, deliberately

- **`AttentionPopover.tsx`** — named in `files_modified`, left **byte-unchanged**. The plan permitted
  a tab hint on each row and it was declined: this component **writes no copy at all**
  (`sourceHealthVocabulary` owns every string), and the tab attribution's job is to say WHERE in the
  Library — a thing the Library says. Repeating it in the popover puts a second author of the same
  fact on the far side of the door. The new field passes through it untouched.
- **`App.tsx`** — named in `files_modified`, left **byte-unchanged**, and that is the deliverable:
  the plan named it so its writer count could be FENCED, not edited.
- **`SEED-231`** — the registry's intended second tenant. Not taken; re-openable only by a deliberate
  override with the count argued against `D-235-03`.

## Verification

| Check | Result |
|---|---|
| `attentionTab.test.ts` (alone) | **10 / 10 passed** |
| `LibraryPage.tabAttention.test.tsx` (alone) | **15 / 15 passed** |
| in-scope set, 5 files together | **65 / 65 passed** |
| `NavPanel.badge.test.tsx` | **15** passed (pinned BASELINE **14**) |
| `ChatLayout.badge.test.tsx` | **10** passed (pinned BASELINE **5**) |
| `useSourceAttention.test.tsx` | **13** passed (pinned BASELINE **13**) |
| `LibraryPage.initialTab.test.tsx` (alone) | **15 / 15 passed** |
| `renameFence.test.ts` | passed — the 120-char mount window survived |
| `npx tsc -p tsconfig.app.json --noEmit` | **67 errors — SET IDENTICAL to base: 0 new, 0 gone** |
| `node scripts/check-claude-md-size.cjs` | **OK** — CLAUDE.md `93,627` chars, 62.4%, headroom 56,373 |
| `node scripts/check-hot-file-ledger.cjs 244` | **4 files still owed rows — ALL `244-05`/`244-06`'s**, none this plan's |
| `node scripts/vitest-count-gate.cjs` | see *Full count gate* below |

⚠ **The typecheck SET diff is published, not the count** — the app config reports 67 errors at base,
so *"zero errors"* is not a reachable criterion here. `comm -13` and `comm -23` against the base set
both return **empty**. The three errors naming this plan's files are pre-existing
(`LibraryPage.tsx:45` `TabsList`/`TabsTrigger` unused, and a `ChatLayoutLaunch.test.tsx` props error).

### Full count gate — VERDICT VERBATIM, and it is RED

Run from the **repo root**, `GSD_VITEST_MAX_WORKERS=2`, **with the sibling `244-03` agent active**:

```
  total                                      7360    8096    +736
  total 8096  ·  failed 3  ·  pinned total 7360
--------------------------------------------------------------
RESULT: COUNT GATE VIOLATED (2 reason(s))
  FAIL  [failing-tests] 3 test(s) failed — the gate requires 0.
  FAIL  [missing-file] TemplateNameCheck.test.tsx — pinned at 29 tests but did NOT run
```

**Pinned total arithmetic closes with NO residual, which is what separates growth from drift.** The
prompt's wave-1 reading was `pinned total 7335`; this plan adds exactly `10 + 15 = 25`, and
**`7335 + 25 = 7360`** — the figure printed. ⚠ The GRAND total is not comparable to wave 1's `8105`
on this run, because 3 cases failed and a 29-case file did not execute at all.

**Triage — filenames taken from the gate's OWN persisted JSON BEFORE any re-run, cap never touched:**

| Named by the gate | In `git diff --numstat 310b91e83 HEAD`? | Measured at base `310b91e83` | Verdict |
|---|---|---|---|
| `LibraryPage.initialTab.test.tsx` (2 cases) | **no — provably unmodified** | 3 samples: 1, 2, 2 failed | ⛔ **INHERITED** |
| `ChatHistoryColumn.rowIdentity.test.tsx` (1 case) | **no — provably unmodified** | red ALONE: 1 failed / 6 passed | ⛔ **INHERITED** (it is `244-01`'s own suite) |
| `TemplateNameCheck.test.tsx` (`[missing-file]`) | **no — provably unmodified** | file PRESENT on disk; passes when named directly (29/29 in a 41-case pair run) | ⛔ runner did not execute it — **not a deletion** |

⚠ **`[missing-file]` is exactly the failure mode D-184-08 pins per-FILE counts for** (the Phase-177
lesson: a failures-only differential cannot see a DELETED test). Here the file exists and runs when
asked, so this is a RUNNER miss under concurrency, not a lost suite — but it is recorded as a
finding rather than waved through, because the two states look identical in the verdict line.

⚠ **Consequence, and it is the CLAUDE.md rule rather than an excuse:** `count gate OK` is **not
reliably reachable on demand** — a plan whose acceptance criterion is *"the gate is green"* has
written a criterion that can fail for reasons no plan controls. This plan's deterministic evidence is
the per-file deltas and the explicitly-run in-scope suites above, all green. ⛔ **The cap was never
adjusted**; the rule says the cap is measured NOT to fix these, and reaching for it would have
produced a number nobody could trust.

⛔ **NOTHING RED IS ATTRIBUTABLE TO `244-04`.** ⚠ Say *"provably unmodified"*, never *"fine"* — one
green sample of a flaky suite proves nothing, and two of these three were established against BASE
with this plan's four source files reverted and then restored, not by re-running until green.

## Registry files — hand re-application list for the orchestrator

⛔ **`244-03` merges first; these hunks are `244-04`'s and must be re-applied by hand. Do not accept
an automatic resolution on these three files.**

| File | This plan's hunks |
|---|---|
| `scripts/vitest-count-gate.cjs` | **BASELINE:** `"attentionTab.test.ts": 10` and `"LibraryPage.tabAttention.test.tsx": 15`, each under its own `── Phase 244 (244-04 …)` banner, appended at the END of the `BASELINE` object. **TARGETS:** `"src/components/layout/__tests__/attentionTab.test.ts"` and `"src/pages/__tests__/LibraryPage.tabAttention.test.tsx"`, each under its own `244-04` banner, appended at the END of the array. |
| `docs/HOT-FILE-LEDGER.md` | **(a)** a new top-level region at the END of the file: `# Phase 244 plan 04 (SHELL-05 · BUG-260911-03)` with three sections (`ChatLayout.tsx — 244-04`, `LibraryHeaderBar.tsx — row added 244-04`, `attentionConditions.ts — 244-04 Task 2 addendum`). **(b)** four IN-PLACE section edits: `AttentionPopover.tsx`, `attentionConditions.ts`, `useSourceAttention.ts`, `App.tsx`, `LibraryPage.tsx`. **(c)** four scan-list ROW edits: `attentionConditions.ts` → `3 / 2 / 200`; `ChatLayout.tsx` → `51 / 26 / 1010`; `LibraryPage.tsx` → `45 / 14 / 955`; `App.tsx` → `32 / 23 / 374`; plus ONE new row `LibraryHeaderBar.tsx` → `2 / 1 / 204`. |
| `CLAUDE.md` | three G-5 scan-table ROW edits (`ChatLayout.tsx` → `51 / 26 / 1010`, `LibraryPage.tsx` → `45 / 14 / 955`, `App.tsx` → `32 / 23 / 374`) and ONE new row (`LibraryHeaderBar.tsx` → `2 / 1 / 204`, inserted directly after `App.tsx`). |

⚠ **Disposition cells are capped at 200 chars and `check-claude-md-size.cjs` FAILS above it** — two
of this plan's cells tripped `[disposition-too-long]` on first write and were trimmed. Re-run the gate
after re-applying, from the repo root.

⚠ **`ChatLayout.tsx`'s ledger row and CLAUDE.md row were LAST WRITTEN BY `244-01`.** `244-04`
supersedes the disposition (`min-h-0` tokens → the attention prop) and bumps `50 / 26 / 1005` →
`51 / 26 / 1010`. ⛔ **Keep `244-01`'s narrative section** (`### ChatLayout.tsx — 244-01`) — the
`min-h-0` chain reasoning is still true and still load-bearing; `244-04` adds a SIBLING section.

## Ledger triples — re-derived with `--follow` at base `310b91e83`

| File | Row read | **Measured at base** | With this plan's commit |
|---|---|---|---|
| `attentionConditions.ts` | `1 / 1 / 102` ⚠ STALE | `2 / 1 / 148` | **`3 / 2 / 200`** |
| `AttentionPopover.tsx` | `1 / 1 / 109` | `1 / 1 / 109` ✅ current | unchanged (byte-untouched) |
| `useSourceAttention.ts` | `2 / 1 / 131` | `2 / 1 / 131` ✅ current | unchanged (byte-untouched) |
| `ChatLayout.tsx` | `50 / 26 / 1005` | `50 / 26 / 1005` ✅ current | **`51 / 26 / 1010`** |
| `App.tsx` | `31 / 23 / 351` ⚠ STALE | `32 / 23 / 374` | unchanged (byte-untouched) |
| `LibraryPage.tsx` | `44 / 14 / 922` ⚠ STALE | `45 / 14 / 923` | **`45 / 14 / 955`** |
| `LibraryHeaderBar.tsx` | ⛔ **NO ROW** | `2 / 1 / 162` | **`2 / 1 / 204`** |

⚠ `LibraryPage.tsx` **must** be derived with `git log --follow` or it reads `1` — it was `git mv`'d at
Phase 217. ⭐ Two rows were re-derived and found **CURRENT**, and that is recorded rather than left
silent: an audit that only writes when a number moves cannot tell *checked* from *not looked at*.

## Known Stubs

None. No hardcoded empty value, placeholder string or unwired component ships in this plan. The one
optional prop absent by default (`attentionConditions`) renders **nothing**, which is the designed
resting state and is asserted by a case, not assumed.

## Threat Flags

None. No new network endpoint, auth path, file access pattern or schema change. The one new field is
a `LibraryTab` union member and cannot carry free text (`T-244-04-02`); the tab is set from the
producer's key, never from a client heuristic (`T-244-04-01` / `D-235-05`); no package was installed
(`T-244-04-SC`).

## Self-Check: PASSED

**Files — all 6 present on disk:**

```
FOUND: frontend/src/components/layout/__tests__/attentionTab.test.ts
FOUND: frontend/src/pages/__tests__/LibraryPage.tabAttention.test.tsx
FOUND: frontend/src/components/layout/attentionConditions.ts
FOUND: frontend/src/components/library/LibraryHeaderBar.tsx
FOUND: frontend/src/pages/LibraryPage.tsx
FOUND: frontend/src/components/layout/ChatLayout.tsx
```

**Commits — all 4 resolve in `git log --all`:** `dc253eb45` · `b741ed609` · `efa8a73e5` ·
`7849275ba`.

**Working tree clean** against `HEAD` after the base-comparison round trips; the four source files
were restored from `HEAD` and re-verified by grep (`attentionCountByTab` present,
`library-tab-attention` present, `attentionConditions={attentionConditions}` present, `attentionByTab`
present) rather than assumed.

⛔ **`STATE.md` and `ROADMAP.md` were NOT modified** — the orchestrator owns those writes after the
wave completes.
