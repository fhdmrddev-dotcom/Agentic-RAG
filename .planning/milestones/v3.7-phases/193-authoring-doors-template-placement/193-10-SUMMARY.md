---
phase: 193-authoring-doors-template-placement
plan: 10
wave: 6
subsystem: phase-paperwork
tags: [count-gate, pin-sweep, hot-file-ledger, g-5, g-4, uat, roadmap, d-07, d-09]
requires:
  - "193-01…193-09 — every suite this sweep pins, and every figure this ledger row measures"
provides:
  - "scripts/vitest-count-gate.cjs — seven pins raised from the gate's own `actual` column; BASELINE_TOTAL marker corrected (14th staleness event)"
  - "CLAUDE.md — a hot-file ledger row for WorkflowDoorSwitch.tsx, the file that escaped G-5 for six phases by being absent from the table"
  - "CLAUDE.md — the WorkflowCard.tsx row corrected on measurement; G-5 now FIRES on it, stated not softened"
  - ".planning/ROADMAP.md — 193-10 ticked, 193-11 deliberately left unticked"
  - "193-UAT.md — the eight owed G-4 rows as a drivable artifact, 0 driven / 8 owed"
  - "193-VALIDATION.md — the pointer plus a Per-Task Verification Map over all eleven plans"
affects:
  - "193-11 — drives the eight rows this plan authored"
  - "the phase AFTER 193 — inherits `11 / 7 / 426` for WorkflowDoorSwitch.tsx and `8 / 3 / 818` for library/WorkflowCard.tsx, and owes a refactor recommendation on the latter"
tech-stack:
  added: []
  patterns:
    - "read every pin off the gate's own `actual` column; hand-counting is unsound under `it.each`"
    - "state a correction BESIDE the stale figure rather than overwriting it (the ledger's own habit)"
    - "validate a line classifier against a published known-good BEFORE trusting any new number"
    - "name a grep token obliquely when the acceptance check is a raw grep (the 187-24 prose trap)"
    - "verify a check COULD fire — a pattern that returns the same answer in both states has verified nothing"
key-files:
  created:
    - .planning/phases/193-authoring-doors-template-placement/193-UAT.md
  modified:
    - scripts/vitest-count-gate.cjs
    - CLAUDE.md
    - .planning/ROADMAP.md
    - .planning/phases/193-authoring-doors-template-placement/193-VALIDATION.md
decisions:
  - "D-07 discharged: WorkflowDoorSwitch.tsx gets a ledger row with its re-derivation commands printed inside the cell"
  - "D-09 recorded: a G-5 override was offered and DECLINED — STATE.md holds no waiver for 193, verified rather than assumed"
  - "G-5 now FIRES on library/WorkflowCard.tsx (3rd phase) and the row says so plainly; the obligation is inherited forward, not discharged"
  - "The four out-of-scope drifted pins (+24) are DECLINED for the tenth consecutive plan"
  - "GSD_VITEST_MAX_WORKERS=2, not the documented 4 — measured, and recorded in 193-VALIDATION.md"
  - "No ledger row for library/RunModal.tsx or soulData.ts — a measurement, not an omission"
  - "193-11 left UNTICKED in the ROADMAP; STATE.md not touched (the orchestrator hand-edits it at phase close)"
metrics:
  duration: ~75 min
  completed: 2026-08-13
  base_sha: 294a2ac83ccc39b0c72d4a75531fe1e8e65dd197
  tasks: 3
  commits: 3
---

# Phase 193 Plan 10: Close the phase's paperwork — Summary

**The file that escaped G-5 for six consecutive phases now has a measured, re-derivable ledger row;
seven suites this phase grew stopped being deletable with the gate green; and the eight rows only a
human can answer are recorded as OWED rather than quietly dropped.**

Three of this project's most expensive recurring failures are bookkeeping, not code, and this plan
closes one instance of each: a hot file absent from the ledger is permanently invisible to its own
guardrail; a phase absent from the ROADMAP checklist is invisible to every audit that reads it; and
an unpinned suite is UNGUARDED, not lightly guarded.

## Execution provenance

| | |
|---|---|
| Tree | **the primary working tree**, not a worktree — by dispatch, because this plan edits `CLAUDE.md` and `ROADMAP.md` and the worktree merge path backs up and RESTORES `ROADMAP.md` |
| Branch / HEAD asserted | `develop` @ `294a2ac8` — **verified before any edit**, both values matched |
| `bootstrap-worktree.sh` | **not run** — nothing to bootstrap on the primary tree |
| Destructive git | **none.** No `reset`, no `stash`, no `clean`, no `git add -A`. ~404 pre-existing dirty/untracked files were left untouched; every commit staged its declared paths explicitly |
| `GSD_VITEST_MAX_WORKERS` | **`2`** — not the documented `4`; see § *The cap finding* |
| Hooks | normal `git commit`, no `--no-verify` |

## Commits

| Task | Commit | What |
|---|---|---|
| 1 | `984d3654` | `chore(193-10)`: the pin sweep — seven raised, four declined, the marker corrected |
| 2 | `67b8d049` | `docs(193-10)`: both ledger rows + the ROADMAP tick |
| 3 | `59274715` | `docs(193-10)`: `193-UAT.md` + the Per-Task Verification Map |

---

## Task 1 — The pin sweep

### Before → after, every number READ OFF THE GATE'S OWN `actual` COLUMN

| Suite | Pin | Actual | Δ | Grown by |
|---|---|---|---|---|
| `doorVocabulary.test.ts` | 9 | **39** | **+30** | `193-08` |
| `soulData.test.ts` | 17 | **33** | **+16** | `193-02` |
| `WorkflowCard.test.tsx` | 80 | **90** | **+10** | `193-06` |
| `RunModal.test.tsx` | 32 | **40** | **+8** | `193-01` + `193-07` |
| `WorkflowDoorSwitch.test.tsx` | 28 | **33** | **+5** | `193-09` |
| `DoorHeaderStrip.test.tsx` | 12 | **16** | **+4** | `193-09` |
| `RunModal.a11y.test.tsx` | 16 | **20** | **+4** | `193-07` |
| | | | **+77** | |

**Nothing was hand-counted.** A hand count of `it(` literals is not merely sloppy here, it is unsound
under `it.each` — `DoorHeaderStrip.test.tsx` runs 16 cases from fewer than 16 `it()`s.

**All seven are EXTENSIONS, none is a lowering**, so no plan-authorised deletion needs to ride along.
Verified rather than asserted: no pin decreased on any run, and the gate's `[count-decrease]` check
stayed silent throughout.

### Why each raise is not bookkeeping

A pin BELOW a file's real count is not a weaker guard — it is **no guard at all** for the cases in the
gap. Named in each entry:

- **`soulData.test.ts`** — the cases proving `unknown` is distinct from `does-not-admit` are the only
  mechanical thing stopping a later "tidy" collapsing the three-state union back to a boolean, and a
  boolean **cannot express D-20**.
- **`RunModal.test.tsx`** — `193-01`'s launch-failure case was written **before** the D-17 cut and
  driven RED. `launchError` is not template-only; its node lived *inside* the wrapper D-17 removes.
  This is the WR-03 class of defect Phase 192's gap round had to repair on this exact surface.
- **`doorVocabulary.test.ts`** — the contract-agreement case re-parses the generated acceptance bar at
  test time. It is the phase's **only** anti-drift instrument; D-02's derive-never-re-type rule is
  prose everywhere else.
- **`WorkflowDoorSwitch.test.tsx`** — the cross-component source equality is the only thing that can
  see D-22 drift, because the two bands live in two files and **never co-render**: demoting one and
  not the other typechecks clean, lints clean and renders fine.
- **`WorkflowCard.test.tsx`** — the two silent arms share ONE expected value, which is what makes them
  indistinguishable *by construction* rather than by promise (D-15).

### ⚠ The four out-of-scope drifted pins are DECLINED — the TENTH consecutive plan to do so

| Suite | Drift |
|---|---|
| `ExternalActionSection.test.tsx` | +9 |
| `builderStore.test.ts` | +6 |
| `WorkflowBuilderPage.canvas.test.tsx` | +5 |
| `PhaseTimeline.test.tsx` | +4 |
| | **+24 — 24 cases deletable with the gate green today** |

They are outside this phase's blast radius; re-pinning them here would fold unrelated drift into a
commit that did not cause it. `git diff scripts/vitest-count-gate.cjs` touches none of the four.
**Stating the decline is what keeps it a decision rather than an oversight**, and the arithmetic
closes the question: `3557 − 3533 = 24`, exactly the four.

### The `BASELINE_TOTAL` marker — corrected on measurement, twice

**The FOURTEENTH recorded staleness event, by 26.** The line read `⚠ 3430 (193-01)` while an
unmodified tree at this plan's base printed `pinned total 3456`. The 26 are this phase's own middle
waves — `193-03`'s `DoorHeaderStrip.test.tsx` 12, `193-05`'s `doorVocabulary.test.ts` 9 and its
`WorkflowDoorSwitch.test.tsx` +5 — each correctly pinned in its own commit while the reader-facing
marker was left behind. Stated beside the stale figure, not overwritten.

⚠ **A SECOND CORRECTION, AND IT IS AGAINST THIS PLAN'S OWN PLAN FILE.** `193-10-PLAN.md`
§ `<interfaces>` says the marker "reads `⚠ 3384 (192.1-06)`" and instructs this plan to record the
**thirteenth** staleness event. Both are one behind: `193-01` had already corrected the marker to
`3430` and had already recorded the thirteenth. *A figure written into a plan at planning time goes
stale on that phase's own first commit* — the identical failure the `CLAUDE.md` ledger rows correct
about themselves, now observed inside a PLAN.

### ⚠ The cap finding — `GSD_VITEST_MAX_WORKERS=2`, not the documented `4`

`CLAUDE.md` and every plan in this phase specify `=4`. That calibration was made at ~3400 gated cases
for TWO concurrent agents; **the gate now executes 3557**. Measured on the identical tree `f2c29778`
during this phase:

| Cap | Runs | `failed` |
|---|---|---|
| `4` | three | **17, then 4, then 3** |
| uncapped (~16 workers) | one | **11** |
| **`2`** | two | **0 and 0** |

Every failure was `STACK_TRACE_ERROR` — vitest's **timeout** signature, never an assertion; every
failing test lived in a file no plan had touched; and each such suite passed in isolation at full
green counts. Fewer workers reduced timeouts **monotonically**, so the binding resource is per-worker
headroom against the 5000 ms per-test limit, not core count.

**This plan reproduced the shape at cap 2 and both readings are recorded rather than the green one
kept:**

| Run | State | `total` | `failed` | `pinned total` | exit |
|---|---|---|---|---|---|
| 1 | pre-edit | 3557 | **4** | 3456 | 1 |
| 2 | post-edit | 3557 | **0** | 3533 | **0** |
| 3 | post-edit | 3557 | **0** | 3533 | **0** |

Run 1's four failures were **all `STACK_TRACE_ERROR` in `WorkflowsPage.test.tsx`** — a file no plan
in this phase touched, at 52/52 with no count decrease — and that suite then ran **`52 passed (52)`
in isolation**. Runs 2 and 3 agree on every column, including `67/67 pinned files present`. The
finding is written into `193-VALIDATION.md` beside the `=4` commands it corrects.

---

## Task 2 — The two ledger rows and the ROADMAP

### (a) D-07 discharged — `WorkflowDoorSwitch.tsx` is on the ledger

**The reason the row exists outranks every figure in it:** this file was **absent from the table
until Phase 193**. Six phases touched it — 124, 155, 184, 184.1, 186, 187, against a threshold of
three — and G-5 never fired once, because the discuss-phase audit scans PLAN.md `files_modified`
*against that table*. **A hot file missing from the table is permanently invisible to its own
guardrail.** Identical to `WorkflowsPage.tsx` escaping G-5 for ten consecutive phases.

Every figure re-derived at this HEAD, commands printed inside the cell:

| Measurement | Value | Command |
|---|---|---|
| commits | **11** | `git log --oneline -- <file> \| wc -l` |
| phases | **7** — `124 155 184 184.1 186 187 193` | `git log --format=%s -- <file> \| sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' \| sed -E 's/-.*//' \| sort -u` |
| lines now | **426** | `wc -l <file>` |
| lines pre-193 | **385** | `git show 74aff9f9:<file> \| wc -l` |

⚠ **D-07's own discuss-time figures were `8 / 6 / 385` and all three have moved.** Corrected on
measurement, not inherited.

**G-5 status: FIRED at 193, HONOURED BY CONSTRUCTION — no override, no waiver.** D-09 offered a G-5
override and it was **declined**; `.planning/STATE.md` § *Guardrail overrides* was **read** and holds
none for 193 — the absence is a measurement, not an assumption. The extraction shipped FIRST, in its
own waves, before the copy and the restack (the 192.1 order): `DoorHeaderStrip.tsx` in wave 2,
`doorVocabulary.ts` in wave 3, variant D in wave 4, the restack in wave 5.

**Proved, not asserted:** `193-01`'s six whole-`innerHTML` captures were taken on the UNMOVED tree at
`501b3c14` in commits touching no source file, and the nine-phase-old byte-exact band literal at
`WorkflowBuilderPage.header.test.tsx:304` passed the extraction with **zero edits** (`git diff
--numstat` EMPTY across all of `193-05`). The two later re-captures are declared, dated and reasoned.

**⚠ THE SUBTREE GREW: `385 → 863 L, +124.2 %` — stated rather than smoothed.**

| Column | Before | After | Δ |
|---|---|---|---|
| total | 385 | **863** | +478 (**+124.2 %**) |
| COMMENT | 147 | **548** | +401 (**83.9 % of the growth**) |
| CODE | 227 | **273** | +46 (+20.3 %) |
| BLANK | 11 | **42** | +31 |

Precedents for scale: 188.2 **+67.1 %**, 192 **+126.2 %**, 192.1 **+52.7 %**. This cut lands beside
192's. The measurement used a named blank/comment/code classifier (JSX `{/* … */}` counted as
comment) **VALIDATED against 188.2's published known-good first** —
`git show 95a4c915:frontend/src/components/workflows/PhaseNodeCard.tsx` → `797 / 518 / 249 / 30`,
reproduced **exactly** — before a single 193 number was trusted. The three per-file deltas sum to
**exactly +478**: no unattributed residual. **The dominant term is PROSE for the fourth cut running.**

What now binds the file, and the next seam (the describe door, with 197/AUTH-02 as its trigger), are
written into the cell so a later phase inherits them.

### (b) `library/WorkflowCard.tsx` corrected — and **G-5 NOW FIRES**

| | Row said | Measured |
|---|---|---|
| commits | 6 | **8** |
| phases | 2 | **3** — `192 192.1 193` |
| lines | 567 → 721 | **747 → 818** |

⚠ **The "before" column moved too, and that is the interesting half.** `721` was already stale when
it was written: `1ae9e4d2` — the `192.1-08` commit that WROTE that row — touched the file's own
docblock, so `git show 1ae9e4d2:<file> | wc -l` → **747**. *A row recording a file's line count
inside a commit that edits that file goes stale on itself.*

**G-5 fires, and the row says so without softening it.** Its own prose predicted the condition —
*"the moment a THIRD phase lands here, G-5 fires on the count"* — and the condition was met one day
later. The `G-5 does NOT fire` sentence at the head of the cell is left standing beside the new one,
so a reader can see what was believed and what measurement changed it.

**The fire is not 193's debt.** `193-06` added a mount, not a concern: **+71 L**, one plain-text
segment at index 0 of the shipped identity line, derived in-card from `row`, with no new prop, no new
component, no new colour and no chip. **The obligation is inherited forward: the NEXT phase whose
`files_modified` names this file owes a refactor recommendation as its FIRST option.**

One inherited claim corrected there too: **the 188.2 two-badge ceiling and its `@ts-expect-error`
control guard the CANVAS `PhaseNodeCard`, not this file.** There is no badge ceiling of any kind under
`library/`; D-13 stands on SEED-155 / U8 grounds and no plan may claim a typecheck enforces it.

### ⚠ No row was added for `RunModal.tsx` or `soulData.ts` — a MEASUREMENT, not an omission

| File | commits | phases | lines |
|---|---|---|---|
| `library/RunModal.tsx` | 2 | 2 (`192`, `193`) | 502 |
| `soulData.ts` | 6 | 6 (`124 127 183 184 189 193`) | 255 |

`RunModal.tsx` is nowhere near the threshold. `soulData.ts` is at six phases but is a **255-line pure
`.ts` leaf** whose whole content is small derivation functions — it has no concern to separate, which
is what G-5 is for. Padding the ledger devalues it, so neither was added; the check is stated here so
the absence reads as a measurement.

### (c) ROADMAP — verified, then ticked

- `grep -c "^#### Phase 193:"` → **1** (the heading is still a `####` heading; bold labels silently
  fail the phase lookup and broke all of v3.7 once).
- The checklist's **11** entries and the **11** `193-NN-PLAN.md` files on disk are an **IDENTICAL
  set** — `diff` of the two sorted lists is empty. **Nothing absent from its own checklist**, which is
  what happened to 188.2 at the v3.6 close and to 192.1 at its own.
- `git diff .planning/ROADMAP.md` touches **exactly one line**: `193-10` `[ ]` → `[x]`.
- **`193-11` is deliberately left `[ ]`.** Its operator checkpoint has not been driven and eight G-4
  rows are owed.
- **`STATE.md` was NOT touched** — the orchestrator hand-edits it at phase close, and the
  false-completion SDK verbs were not called (see § *Deviations*).

---

## Task 3 — `193-UAT.md`, the eight owed rows

**421 lines. `0 driven · 0 passed · 0 failed · 8 owed.`** Rows `U1 U2 U3 U3b U4 U5 U6 U7`, ported
verbatim in scope from `193-VALIDATION.md` — none invented, none renumbered, none dropped. Each has a
recipe, a named target, the observable that decides it, `fail:` conditions written **before** the
drive, and an empty verdict field.

⚠ **U4 and U5 name `ephemeral-template-fill-101uat`** — the only published row of 145 that admits
under D-21. A row picked at random cannot see the feature at all, so a scoreboard driven against one
has measured nothing. If the slug is absent, the row is recorded ⛔ with that reason, never
substituted.

**D-27 binds every row:** no row may locate its target by id, UUID, selector or element picker.
DevTools is sanctioned in exactly one place — U7, to BLOCK a request — where it breaks something
rather than finds something.

**Four residuals are written down so they are reported rather than discovered:** the one-admitting-row
cost; the deliberate card/modal fallback asymmetry (D-15 vs D-20 — *not* an inconsistency to report);
the 🔧-vs-⚡ glyph asymmetry D-23 produced, which U6 exists to judge; and ⚠ **the govern door's first
screen changed AFTER these rows were authored** (`294a2ac8`), so U1 and U2 must be driven against what
is on the screen today.

**The 4-axis cross-provider board is recorded as NOT triggered**, with the reason — UI state only, no
streaming, no agent loop, no provider routing, no backend change (D-16) — so its absence is
distinguishable from an omission.

### ⚠ Two mechanical fixes, each because a check COULD NOT HAVE FIRED

1. **The verdict labels are unformatted.** `193-11`'s emptiness check greps for the label followed by
   end-of-line; a backticked label puts a character after the colon, so the pattern would have
   returned the **same** number before and after the drive. **A check that cannot change its answer
   has verified nothing** — the 192.1 finding, where a fence swept against the empty string and passed
   green while defending nothing. Measured: **8 present / 8 empty** now; **8 present / 0 empty** once
   driven.
2. **That explanation names its own grep patterns obliquely** — the 187-24 prose trap `193-09` hit and
   worked around. Spelling them would make the sentence itself a match, and the file's acceptance
   check would count its own documentation as a row.

`193-VALIDATION.md` gains the pointer plus a **Per-Task Verification Map over all eleven plans**,
quoted from each plan's own `<automated>` blocks, with the cap correction stated beside the `=4`
commands it corrects.

---

## Verification

| Check | Required | Measured |
|---|---|---|
| count gate (cap 2), run 2 | exit 0, `failed 0`, no `[count-decrease]` | **exit 0 · total 3557 · failed 0 · pinned 3533 · 67/67** |
| count gate (cap 2), run 3 | agreeing totals | **identical — exit 0 · 3557 · 0 · 3533 · 67/67** |
| `tsc --noEmit -p tsconfig.app.json` | **33** | **33** |
| `eslint src/components/workflows/` | ≤ 10, **0** in touched files | **10**, all pre-existing — `BuilderStoreProvider` 3, `ConnectionPicker` 4, `FlowEdge` 1, `SelectedPhaseSlugContext` 1, `StepTypePicker.test` 1. **Zero** in `WorkflowDoorSwitch.tsx`, `DoorHeaderStrip.tsx`, `doorVocabulary.ts`, `soulData.ts`, `library/WorkflowCard.tsx`, `library/RunModal.tsx` |
| `grep -c "^#### Phase 193:" .planning/ROADMAP.md` | 1 | **1**, with 11 plan entries beneath it |
| `grep -c "WorkflowDoorSwitch.tsx" CLAUDE.md` | ≥ 1, in a table row | **1** — a ledger table row, not only prose |
| `grep -c "ephemeral-template-fill-101uat" …/193-UAT.md` | ≥ 2 | **7** |
| `grep -c "getElementById" …/193-UAT.md` | ≥ 1, prohibition only | **1**, inside the D-27 note |
| `node scripts/check-gap-closure-rounds.cjs 193` | exit 0 | **`G-7 clear`** — 11 plans, **0 gap-closure**, exit 0 |
| UAT rows inside PLAN files | none | **none** |

---

## Deviations from Plan

### `[Rule 3 - Blocking]` The plan's `<worktree_protocol>` was inapplicable and was not followed

The plan instructs `bash scripts/bootstrap-worktree.sh "$(pwd)"` as the FIRST action and a
`git reset --hard` to the dispatched base if the tree forked. **This plan was dispatched to run on the
primary working tree, deliberately**, because it edits `CLAUDE.md` and `.planning/ROADMAP.md` and the
worktree merge path backs up and **restores** `ROADMAP.md` — which would have silently reverted the
ledger work. There was nothing to bootstrap, and `reset --hard` on the operator's real `develop` with
~404 dirty files would have been destructive. Branch and HEAD were asserted instead (`develop` @
`294a2ac8`, both matched) and every commit staged its declared paths explicitly.

### `[Rule 3 - Blocking]` `GSD_VITEST_MAX_WORKERS=2`, against the plan's `=4`

Documented in full under § *The cap finding*. The plan's `=4` is the repo-wide default; at 3557 cases
it produces timeout-shaped failures in untouched files. Run 1 at cap 2 still produced 4 such failures
and runs 2 and 3 produced none — recorded rather than smoothed, with the isolation run as evidence.

### `[Rule 2 - Missing correctness]` The UAT file's own emptiness check could not fire

`193-11`'s two greps would have returned identical numbers before and after the drive against a
backticked label. Fixed at authoring time and verified in both directions. This is the 192.1 finding
applied to this plan's own output rather than quoted at someone else's.

### Corrections on measurement (three, all stated rather than absorbed)

1. **`193-10-PLAN.md` § `<interfaces>` was one behind on two counts** — the `BASELINE_TOTAL` marker
   and the staleness-event number. `193-01` had already corrected both.
2. **D-07's `8 / 6 / 385`** moved to `11 / 7 / 426`.
3. **The `WorkflowCard.tsx` row's `721`** was already stale when written — the true pre-193 figure is
   **747**, because the commit that wrote the row also edited the file.

### `193-08`'s deferred item is CLOSED, not owed

`193-08` found a **second, ungoverned copy** of the describe screen's words in
`WorkflowBuilderPage.tsx` and deferred it with a re-open trigger. **The operator chose fix-now**, and
it shipped in commit **`294a2ac8`** — this plan's base. FOUR strings were predicted and **FIVE** were
found (`DESCRIBE_H1` was duplicated too, caught only by a programmatic sweep against all 21 governed
values). It redded **24 cases across five suites** — a red `193-08` had **predicted in writing** in
`WorkflowBuilderPage.describe.test.tsx`'s docblock, which is why the reds could be trusted as the fix
working. ⚠ **A literal-only sweep cannot see a regex query**: the first sweep missed two sites in
`WorkflowBuilderPage.session.test.tsx` querying `/draft the workflow/i`. **Recorded here as CLOSED
with its commit, so no later reader inherits it as an open deferral.**

### The forbidden SDK verbs were NOT called

No `gsd-sdk query state.*`, no `requirements.mark-complete`, no `roadmap.update-plan-progress`. Seven
of those write FALSE records and have corrupted `STATE.md` repeatedly in this project while reporting
success — and `roadmap.update-plan-progress` has no notion of an unrun checkpoint and would have
ticked `193-11`. ROADMAP.md was edited **by hand**, one line; `STATE.md` was **read but not written**.

### Worktree base drift — recorded for the phase, not observed here

Seven of seven executor agents in this phase spawned on `fda79214` (merge-base `3781a3fe`), never the
dispatched base; every one caught and corrected it with its HEAD assertion. **This plan did not run in
a worktree and so did not encounter it** — noted so the phase's 7-of-7 figure is not silently read as
8-of-8.

---

## Known Stubs

**None.** This plan writes documentation and one config map. Zero packages installed; zero source
files under `frontend/src` or `backend/` modified.

---

## What the next phase inherits

| Item | Value |
|---|---|
| `WorkflowDoorSwitch.tsx` | **11 commits / 7 phases / 426 L** · G-5 fired at 193, honoured by construction, no waiver |
| `library/WorkflowCard.tsx` | **8 commits / 3 phases / 818 L** · **G-5 FIRES — a refactor recommendation is owed FIRST by whoever touches it next** |
| Count gate | pinned total **3533** / 67 files · the standing **+24** gap is four inherited drifts, owed as its own edit (T-9) |
| Cap | **`GSD_VITEST_MAX_WORKERS=2`** for the full gate at 3557 cases |
| G-4 rows | **8 owed, 0 driven** — `193-11` is the drive; `193-UAT.md` is the artifact |
| G-7 | **clear** — 11 plans, 0 gap-closure rounds |

---

## Self-Check: PASSED

All six declared artifacts exist on disk (`193-UAT.md`, this SUMMARY,
`scripts/vitest-count-gate.cjs`, `CLAUDE.md`, `.planning/ROADMAP.md`,
`193-VALIDATION.md`) and all three commit hashes resolve in `git log`
(`984d3654`, `67b8d049`, `59274715`). Nothing claimed above is unverified.
