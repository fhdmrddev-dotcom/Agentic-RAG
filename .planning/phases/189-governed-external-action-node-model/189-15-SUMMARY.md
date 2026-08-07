---
phase: 189
plan: 15
subsystem: frontend-canvas-badge-slot
tags: [wave-8, last-free-badge-slot, state-conditional-not-type-conditional, prose-correction, comment-only-fenced-edits, four-plants, d-21-built-nothing, tenth-reservation-site]
requires:
  - "189-13 — `notConnectedOf` + `PhaseNodeData.notConnected`: the projection boolean this plan renders"
  - "189-12 — `external_action` in `PhaseTypeId` / `PHASE_TYPE_ORDER` / `requiredConfigFor` (the type the badge sits on)"
  - "188.2-01 — the `@ts-expect-error` max-2 badge control, re-observed here rather than trusted"
  - "188.2-06 — the six-file card subtree and its `badges` prop, which is why this plan edits no card code"
provides:
  - "badge slot 1 SPENT — the muted, glyph-less `Not connected` word-badge, `data-testid=\"canvas-not-connected\"`"
  - "the explicit-branch `BadgeSlots` tuple in `PhaseNode.tsx` — four branches, zero spreads, slot 1 FIRST"
  - "a SOURCE fence proving the badge is gated on the projection boolean, not on the type discriminator (D-12)"
  - "the card suite's missing two-badge POSITIVE CONTROL (one-badge → one-chip was satisfiable by a card that renders at most one)"
  - "the canvas-level not-connected guard: present on `external_action`, absent on all six shipped types, roster DERIVED from `PHASE_TYPE_ORDER`"
  - "seven live reservation-prose sites flipped to past tense, three of them COMMENT-ONLY inside the fenced subtree"
  - "D-21 discharged as PROSE — the unarmed-edge docblock no longer names 189, and `FlowEdge.tsx`'s diff is EMPTY"
affects:
  - "189-16 — UAT rows U2 and U4 are the ONLY evidence for the badge's rendered legibility, occlusion and height cost. jsdom proves none of it"
  - "Phase 190 — retires this badge by DATA: `notConnectedOf`'s second line returns false, and neither `PhaseNode.tsx` nor the card is re-opened. The source fence is what keeps that true"
  - "the tree's tsc baseline: 33 -> 33, unmoved. The count gate: 2619 / 47 files -> 2627 / 47 files"
tech-stack:
  added: []
  patterns:
    - "a source fence as the ONLY witness for a claim two renderings cannot distinguish (type-conditional vs state-conditional gating, byte-identical today)"
    - "an explicit-branch tuple instead of a spread, so a max-N tuple type keeps enforcing its budget"
    - "a falsified COMMENT rewritten in place beside a still-valid ASSERTION, with the old wording quoted as the record"
    - "per-type coverage as a RECORD comparison derived from the shipped type order, so the failure names the type and the next type inherits the guard"
decisions:
  - "S4 and S5 (`PhaseNode.tsx`) were flipped in TASK 1's commit, not Task 2's — the D-20 same-commit discipline 189-13 applied. They are the two sites this plan's own diff falsified, and a commit that falsifies a claim and leaves it standing is the exact defect this phase keeps finding."
  - "The badge's per-type coverage is asserted as a RECORD (`toEqual({programmatic: false, …, external_action: true})`) rather than a loop. A loop reports `iteration 4`; a record names the offending type in the diff, and it is built from `PHASE_TYPE_ORDER` so the EIGHTH type joins the assertion automatically."
  - "⚠ THE D-12 STATE-CONDITIONAL SHAPE IS GUARDED ON SOURCE, NOT ON THE DOM, and that was MEASURED not assumed. Under PLANT 1 (a type-conditional gate) all four RENDER cases stayed GREEN and only the source fence went red — because nothing in the app can be connected to anything until 190, so the two gates render byte-identically. A DOM-only suite would have shipped the coupling D-12 exists to prevent."
  - "The card-suite budget guard was rewritten IN PLACE and given a two-badge positive control rather than replaced. Its assertion (one badge in, one chip out) was still true and is the CARD's own budget test — but on its own it was equally satisfiable by a card that renders at most one badge whatever it is handed, which is precisely the regression 189 could have caused. PLANT G proved the pair is not vacuous."
  - "The canvas-suite guard's ASSERTION was kept verbatim and only its wording changed: it selects on `[data-grounding]` SPECIFICALLY, so 189 never broke it mechanically. A misleading title on a passing test is how a guard gets deleted by someone who believes it asserts something it does not."
  - "The 189-15 canvas guard builds its own seven-type roster in the test file rather than adding an `external_action` entry to `__fixtures__/canvasFixtures.ts` — the shared corpus feeds 13 committed snapshots in `canvasModel.fixtures.test.ts`, and moving them for a one-badge claim would bury the evidence."
metrics:
  duration: "~110 min"
  completed: 2026-08-07
  tasks: 2
  commits: 2
  files_created: 0
  files_modified: 11
  tests_added: 8
---

# Phase 189 Plan 15: The Last Free Badge Slot Summary

**Badge slot 1 — the last free word-badge on the card — is spent on `Not connected`,
gated on the projection's STATE rather than on the step's TYPE, and the difference
between those two spellings is invisible in every rendered DOM this plan can produce.**
That is the finding, not a caveat: under a planted type-conditional gate all four render
assertions stayed GREEN and only the source fence went red. Four wrong fixes were planted
and every one was observed RED. Ten reservation-prose sites were re-derived by grep —
three more than any planning document lists — and every one was rewritten rather than
deleted. D-21 was discharged as what it is: a sentence, not a feature. `FlowEdge.tsx`'s
diff is empty on purpose.

## The commits

| SHA | Task | Scope |
|---|---|---|
| `4defa427` | 1 | the badge object, the explicit-branch tuple, 5 adapter cases + 1 projection case, S4/S5 flipped in the commit that falsified them |
| `c842d9dd` | 2 | seven remaining prose sites, both guards rewritten with controls, D-21 |

```
$ git diff --stat 4defa427~1..HEAD
 NodeCornerMarks.tsx        |  22 ++-        PhaseNodeCard.tsx          |  10 +-
 PhaseNode.test.tsx         | 202 +++++-     WorkflowCanvas.test.tsx    |  63 ++++++-
 PhaseNode.tsx              |  75 ++++--     canvasModel.test.ts        |  29 +++
 PhaseNodeCard.test.tsx     |  30 ++-        canvasModel.ts             |  38 ++--
 phaseNodeCardContract.ts   |  13 +-         phaseVocabulary.ts         |  16 +-
 scripts/vitest-count-gate.cjs               |  56 +++++-
 11 files changed, 507 insertions(+), 47 deletions(-)

$ git diff --stat 4defa427~1..HEAD -- FlowEdge.tsx WorkflowCanvas.tsx \
      NodeIconWell.tsx NodeRunOverlay.tsx ownProperty.ts backend/ supabase/
 (empty)

$ git diff --diff-filter=D --name-only 4defa427~1..HEAD      → (empty; nothing deleted)
```

---

## ⚠ THE MEASUREMENT THAT MATTERS: TWO GATES, ONE DOM

D-12 requires the badge to be conditional on the STATE (`data.notConnected`) and not on
the TYPE (`data.phaseType === "external_action"`), so that Phase 190 retires it by
changing DATA and never re-opens this adapter or the card.

**Those two spellings render BYTE-IDENTICALLY today.** No connection mechanism exists
anywhere in the app in 189, so `notConnectedOf` returns `true` for every `external_action`
step and `false` for everything else — exactly what a type test returns. PLANT 1 drove
that home:

```
$ # PLANT 1 — `data.phaseType === "external_action"` in place of `data.notConnected`
   ×  the tuple is built with EXPLICIT BRANCHES — no spread reaches `badges`
      → expected 'const badges: BadgeSlots = data.pha…' to match /data\.notConnected/
   1 failed | 30 passed (31)
```

**One failure, and it is the SOURCE fence.** The badge-present-on-one-type case, the
order case, the run-word case and the leaf walk all passed. A suite that only drove the
DOM would have shipped the coupling and nobody would have learned until Phase 190 had to
re-open three files.

The fence is therefore written where the difference is visible, with its needle assembled
from parts (the 187-24 lesson) and a positive control proving the needle matches the wrong
fix.

---

## ANTI-VACUITY: FOUR PLANTS, EVERY ONE RED

Every plant went into PRODUCTION source, was observed, was removed, and each restore was
verified by **md5** with `grep -c "PLANT"` → **0**.

| Plant | The wrong fix | Result | The one thing that caught it |
|---|---|---|---|
| **1** | a TYPE-conditional gate instead of a state-conditional one | **1 failed / 30 passed** | the SOURCE fence — **every render assertion stayed green** |
| **2** | the tuple written `[waitsForYou, notConnected]` (badge in slot 2) | **1 failed / 30 passed** | `is FIRST when both badges are present — the tuple is ORDERED, not a set` |
| **3** | a THIRD badge in the two-badge branch | **tsc 33 → 34** | the type system, naming the line: `Type '[] \| [BadgeSlot, BadgeSlot, BadgeSlot] \| [BadgeSlot]' is not assignable to type 'BadgeSlots'` at `PhaseNode.tsx(264,9)` |
| **G** | the card rendering only `badges[0]` (`badges.slice(0, 1)`) | **7 failed across 3 suites** | the NEW two-badge positive control, plus five shipped cases and the adapter's order case |

`PhaseNode.tsx` md5 `e43111e474262f2e844d0bfecad686e8` — identical before and after plants
1, 2 and 3. `PhaseNodeCard.tsx` md5 `b6a3b7a07c9119f06108f17a5a2a6794` — identical before
and after plant G, and `grep -c "slice(0, 1)"` → **0**.

**PLANT G's seven, named** (the 189-13 lesson — a failure count is worthless until you have
named which file produced it):

```
× PhaseNodeCard.test.tsx > renders exactly two chips for two badges, in slot order
× PhaseNodeCard.test.tsx > lands each badge's dataAttr pairs on its WRAPPER, not on the chip
× PhaseNodeCard.test.tsx > renders the decorative glyph aria-hidden, and omits it when absent
× PhaseNodeCard.test.tsx > 189-15 POSITIVE CONTROL: the same row renders TWO chips when two are passed
× PhaseNodeCard.test.tsx > MAXIMAL_RUNNING reproduces the DOM CAPTURED from the unmoved tree, byte for byte
× PhaseNodeCard.test.tsx > MAXIMAL_WAITING reproduces the DOM CAPTURED from the unmoved tree, byte for byte
× PhaseNode.test.tsx     > is FIRST when both badges are present — the tuple is ORDERED, not a set
```

---

## ⚠ THE THIRD-BADGE CONTROL, RE-OBSERVED SWINGING BOTH WAYS

The plan's action D asks for this explicitly, and it was done as a measurement rather than
a re-reading: **a guard nobody has re-run after changing its subject is a guard on trust.**
`BadgeSlots` was widened to `readonly BadgeSlot[]` in `phaseNodeCardContract.ts`, the gate
was read, and the file was restored:

| State of `BadgeSlots` | `tsc --noEmit -p tsconfig.app.json` | The extra error |
|---|---|---|
| NARROW (shipped) | **33** | — |
| WIDENED (plant) | **34** | `PhaseNodeCard.test.tsx(338,5): error TS2578: Unused '@ts-expect-error' directive.` |
| NARROW (restored) | **33** | — |

`phaseNodeCardContract.ts` md5 `ae7e99b1b8109d3dd243975980dd9710`, identical before and
after. **The control still swings both ways with slot 1 spent** — which is the claim, and
it is now a measurement taken today rather than one inherited from 188.2-01.

---

## THE TEN RESERVATION SITES — re-derived by grep, three more than any list

CONTEXT names **five**. UI-SPEC §2e names **six** (S1-S6 + two guards). 189-13 found a
**seventh** and corrected two. This plan re-derived the live set and found **ten**, of
which three appear in no planning document at all.

| # | Site | BEFORE (abridged) | AFTER |
|---|---|---|---|
| S1 | `PhaseNodeCard.tsx:39-40` ⛔fenced | *"Badge slot 1 stays EMPTY and RESERVED FOR PHASE 189 (D-12) — governance spends no colour and no word-badge."* | *"⚠ CORRECTED at 189-15 … 189 has now SPENT it — on the state-conditional 'Not connected' word-badge. **Nothing in this FILE changed to make that happen**, which is the seam working exactly as designed."* |
| S2 | `canvasModel.ts:139` | *"and both badge slots are committed to 188/189."* | *"and both badge slots are now SPENT."* + the CORRECTED paragraph extended: 188 DECLINED its claim, 189-15 spent slot 1 |
| S3a | `NodeCornerMarks.tsx:27` ⛔fenced | *"so the freed slot belongs to 188 / 189"* | *"so the freed slot went to 188 / 189"* + *"⚠ AND THE FREED SLOT IS NOW SPENT (189-15) … **THE ARGUMENT ABOVE IS UNCHANGED, AND IT IS THE HALF THAT HAD TO SURVIVE THIS EDIT:** governance still spends NO colour and NO badge slot"* |
| S3b | `NodeCornerMarks.tsx:217,223` ⛔fenced | *"188 … and 189 … may not take it back"* / *"a word-badge (both slots are committed to 188/189)"* | *"⚠ BOTH HAVE NOW SHIPPED AND NEITHER TOOK IT"* / *"both slots are now SPENT — slot 2 'Waits for you', slot 1 'Not connected' since 189-15, and a third is a typecheck error"* |
| S4 | `PhaseNode.tsx:211` | *"Slot 1 is therefore still empty and now belongs to Phase 189 alone."* | *"⚠ CORRECTED at Phase 189-15, IN THE COMMIT THAT FALSIFIED IT … Both claimants have now answered."* (**flipped in Task 1**) |
| S5 | `PhaseNode.tsx:259` | *"would spend the corner the seal claims or a badge slot 188/189 owns."* | *"… and, since 189-15, **THERE IS NO BADGE SLOT LEFT TO SPEND** … A face that wants to say more than this now has to argue for a slot, not merely find one."* (**flipped in Task 1**) |
| S6 | `phaseNodeCardContract.ts:6-7` ⛔fenced | *"189 adds a slot to a contract of this size rather than to a 797-line component."* | past tense + *"⚠ UPDATED AT 189-15, AND THE SENTENCE ABOVE IS KEPT BECAUSE IT IS THE RECORD OF WHY 188.2 CUT WHERE IT DID … the prediction has now been tested and it came in UNDER budget: 189 added NO slot at all."* |
| **S8** | `phaseVocabulary.ts:771-772` | *"(137-B allows at most two, and slot 1 is deliberately unspent)"* | ⚠ **AN EIGHTH SITE — fourteen lines below the block 189-13 corrected in the very same file.** Rewritten with the pattern recorded: every list so far has been short by at least one, so the only safe method is to re-grep |
| **S9** | `PhaseNodeCard.test.tsx:1600` | *"Slot 1 stays empty for 188 / 189; the seal is not a badge…"* | ⚠ **A NINTH SITE, in no document.** The claim (`grounded` COSTS no badge) is unaffected and kept; only the reservation clause is corrected |
| **S10** | `PhaseNode.test.tsx:320` | *"Slot 1 stays EMPTY — it belongs to 188 (run state) / 189 (external actions)."* | ⚠ **A TENTH SITE, in no document** — and it was in a file this plan's own Task 1 edited. The `toBeLessThanOrEqual(2)` ceiling below it is unaffected: 189 FILLED the ceiling, it did not raise it |

**The acceptance grep, run:**

```
$ grep -rn "still empty|still reserved|reserved for|deliberately unspent|stays EMPTY|is empty and reserved" \
      src/components/workflows/   (excluding the reserved-ID namespace and the technical-line slot)
```

**Seven hits remain, and EVERY ONE is a former wording quoted inside a "used to read"
correction.** Not one of them CLAIMS the reservation. That is the intended shape: the old
sentence is the record, and deleting it would lose why the slot existed at all.

---

## ⚠ THE FENCED SUBTREE — comment-only, verified LINE BY LINE

Three of the ten sites live inside the six-file `CARD_SUBTREE_PATHS` subtree. Every changed
line in those three files begins with comment syntax, and that is a measurement:

```
$ for f in PhaseNodeCard.tsx phaseNodeCardContract.ts NodeCornerMarks.tsx; do
    git diff -U0 -- $f | grep '^[+-]' | grep -v '^[+-][+-]' \
      | grep -vE '^[+-][[:space:]]*(\*|//|/\*)' | grep -vE '^[+-][[:space:]]*$'
  done
PhaseNodeCard.tsx        → (empty)
phaseNodeCardContract.ts → (empty)
NodeCornerMarks.tsx      → 6 lines
```

**`NodeCornerMarks.tsx`'s six are inside a JSX `{/* … */}` block**, which the 188.2 line
classifier counts as comment — and it was PROVED rather than asserted, by locating the
block's delimiters and checking containment:

```
JSX comment block: lines 225..269 (1-based)
'BOTH HAVE NOW SHIPPED'    -> [229]  inside block: True
'both slots are now SPENT' -> [236]  inside block: True
```

**No file was added to the subtree**, `CARD_SUBTREE_PATHS` still has **6** entries, and its
length pin at `PhaseNodeCard.test.tsx:553` is **unmoved**. `NodeIconWell.tsx`,
`NodeRunOverlay.tsx` and `ownProperty.ts` have a **zero-line diff** across both commits.

---

## D-21 — DISCHARGED AS PROSE, AND THE GHOST EDGE STAYED UNBUILT

`canvasModel.ts`'s edge docblock said, verbatim: *"`false` is Phase 189's state — an
external-action step whose checkpoint the author turned off."*

**189 is not that claimant and nobody is.** D-04 pins `action_risk_armed` to `true` at the
Pydantic level (189-07) and the panel's arming switch renders ON and refuses to move
(189-14). And the projection already cannot produce it — re-derived, because the pointer
had drifted:

```
$ grep -n "checkpointOnTarget" -A 3 canvasModel.ts
303:function checkpointOnTarget(phase: PhaseSpecJSON): boolean | undefined {
304-  return actionRiskArmed(phase) ? true : undefined
305-}
```

⚠ **`:303-305`, not the `:274-276` the plan and UI-SPEC both name** — an eighteenth-plus
pointer-drift catch for this phase.

The sentence naming 189 is gone; in its place is the reason (D-04), the mechanism (the
helper returns only `true` or `undefined`), and an explicit warning that **this is a prose
correction and not a work item**. `FlowEdge.tsx`'s `GhostMarks` branch stays shipped and
stays unreachable — which is the honest state for a rendering whose input no producer
emits. `git diff --stat` over `FlowEdge.tsx` across the whole plan: **empty**.

---

## What the badge actually is

| Property | Value | Why |
|---|---|---|
| Home | `PhaseNode.tsx` — the ONLY place in the tree that constructs a `BadgeSlots` tuple | the card is not edited; this is the 188.2 seam working |
| Position | **slot 1 — tuple index 0**, first in every branch that carries it | `BadgeSlots` is ORDERED; the shipped badge is documented as slot 2 in three places |
| Tone | `muted` | `primary` is the live/waiting indigo slot 2 owns; `success` would read as good news; strong tokens are banked for 188's run status |
| Glyph | **none** | `icon-convention.md` §4 — a word-badge carries no glyph |
| Test hook | `data-testid="canvas-not-connected"`, wrapper `data-not-connected="true"` | the shipped slot-2 convention, verbatim |
| Element | `<span>` inside `<span>` — no role, no tabindex, no handler | one tab stop per node |
| Gate | `data.notConnected` (projection) | retires by DATA at 190; the source fence is what keeps it that way |

**The two-badge branch is written and unreachable from real data**, and that is said in a
comment rather than left to be discovered: `external_action` and `llm_human_input` are
different phase types. It must exist anyway — the tuple type demands the case be
representable, and it is what the max-2 positive control renders.

---

## Verification

**The plan's `<verification>` block, run:**

```
$ npx vitest run src/components/workflows
  Test Files  36 passed (36)
  Tests       2203 passed (2203)        ← ZERO failures in the whole directory

$ npx tsc --noEmit -p tsconfig.app.json | grep -c "error TS"
33                                       ← THE BASELINE, unmoved

$ npx vite build
✓ built in 4.87s

$ node scripts/vitest-count-gate.cjs
  total   2627  2627  0
  count gate OK — 47/47 pinned files present, no per-file decrease, 0 failing.

$ npx eslint <the 8 changed source + test files>
  (clean, 0 problems)
```

**The count gate, COUNT columns — not the `failed` column (`D-188.2-DEF-01`), with the FILE
named at every step:**

| Point | total | pinned files | pins moved |
|---|---|---|---|
| Baseline, re-derived before any edit | **2619** | 47/47 | — |
| After Task 1 | 2625 | 47/47 | `PhaseNode.test.tsx` 26 → 31 · `canvasModel.test.ts` 51 → 52 |
| After Task 2 | **2627** | 47/47 | `PhaseNodeCard.test.tsx` 131 → 132 · `WorkflowCanvas.test.tsx` 52 → 53 |

Every moved number was read from **this script's own `actual` column**, never hand-counted.
`BASELINE_TOTAL`'s prose note moved 2619 → 2627 in the same commits; the gate itself still
reads the `reduce`.

### Re-derived, not inherited

| Claim | How | Result |
|---|---|---|
| `tsc -p tsconfig.app.json` = 33 | run before any edit | ✅ **33**, and 33 after both tasks |
| count gate **2508 / 46 files** (the plan's `<context>`) | run before any edit | ⚠ **STALE — 2619 / 47 of 47.** The **SIXTH** consecutive plan in this phase to inherit a stale gate figure |
| the plan's *"46 pinned files after 189-14"* | the gate's own header | ⚠ **47**, as 189-14's SUMMARY already recorded |
| `checkpointOnTarget` at `canvasModel.ts:274-276` (plan + UI-SPEC §11.6) | symbol search | ⚠ **`:303-305`** |
| `BadgeSlots` at `phaseNodeCardContract.ts:104` | symbol search | ✅ **exact** |
| top-right claimed for the seal at `phaseNodeCardContract.ts:196` | read | ✅ **exact**, verbatim *"188/189 may not take it"* |
| the badge trace ends at `PhaseNode.tsx:214-220`, card unchanged | read + `git diff` | ✅ **CONFIRMED** — the card's code diff is empty |
| SIX prose sites (UI-SPEC §2e) | grep | ⚠ **TEN live**, three in no document (S8, S9, S10) |
| T1 `PhaseNodeCard.test.tsx:2156` | read | ⚠ **`:2256`** — off by 100. Its ASSERTION is valid as measured; only the comment was false |
| T2 asserts the retired GROUNDING chip specifically, not any badge | read | ✅ **CONFIRMED** — it never broke mechanically |
| `CARD_SUBTREE_PATHS` pin at `:545` (UI-SPEC §1a) | grep | ⚠ **`:553`**, as 189-13 also measured |
| `ICON_TINT` / `StatusChip` `muted` tone exists | read `StatusChip.tsx:29,37` | ✅ `"primary" \| "success" \| "muted"`, `muted` = `border-border bg-muted/40 text-muted-foreground` |
| the `@ts-expect-error` control swings 33 ↔ 34 | **planted and observed, both directions** | ✅ **33 → 34 → 33** |

---

## Deviations from Plan

### 1. [Rule 2] S4 and S5 were flipped in TASK 1's commit, not Task 2's

The plan puts all six prose sites in Task 2, whose `<files>` does not include
`PhaseNode.tsx`. But S4 (*"Slot 1 is therefore still empty and now belongs to Phase 189
alone"*) and S5 (*"a badge slot 188/189 owns"*) are the two sites **Task 1's own diff
falsified**, twenty lines from the code that falsified them. Leaving them for a later
commit is the precise defect this phase keeps finding, and 189-13 set the precedent by
correcting its two sites in the commit that falsified them. Recorded here so the Task 2
commit's site count reads correctly.

### 2. [Rule 2] THREE reservation sites exist that no planning document lists

- **S8, `phaseVocabulary.ts:771-772`** — *"slot 1 is deliberately unspent"*, **fourteen
  lines below the section header 189-13 corrected in the same file**. 189-13's own note
  called its site the seventh and said neither CONTEXT nor UI-SPEC contains it; this one is
  in the same file again.
- **S9, `PhaseNodeCard.test.tsx:1600`** and **S10, `PhaseNode.test.tsx:320`** — test
  comments. Neither breaks mechanically (S9's card is handed one badge explicitly; S10's
  fixture contains no `external_action` step), so both were **reworded with the assertion
  untouched**.

**The pattern is now the finding.** CONTEXT said five, UI-SPEC said six, 189-13 found a
seventh, this plan found three more. The instruction to re-derive by grep is not
belt-and-braces — it is the only method that has ever produced the right number, and that
sentence is written into `phaseVocabulary.ts` where the next executor will meet it.

### 3. [Documented, not auto-fixed] The plan's own gate baseline was stale, for the sixth consecutive plan

The plan's `<context>` says *"count gate total 2508 / 46 pinned files after plan 189-14"*.
Measured before any edit: **2619 / 47 of 47** — which 189-14's SUMMARY already recorded,
and 189-13's before it. Recorded rather than silently corrected.

### 4. Out-of-scope, untouched

`scripts/_uat111*`, `scripts/_uat111_1/`, `scripts/pm-pack/out/`, `scripts/.sse_after_run1/`,
`backend/RUN-BACKEND.md`, `backend/scripts/115_*.json`,
`backend/settings_override.json.migrated`, `supabase/.temp/cli-latest` and the
`supabase/snippets/*.sql` edits are **pre-existing operator artifacts present in the
working tree before this plan started** (verified against the session-start `git status`).
**Not staged, not modified, not deleted.** Every file in both commits was staged
individually by path. `backend/` and `supabase/` have a **zero-line diff** from this plan,
and **`requirements.mark-complete` was NOT run — CONN-01 stays `Pending`**, with one plan
still owed (189-16).

---

## Deferred Issues

- **UAT rows U2 and U4 → 189-16, and nothing here substitutes for them.** jsdom applies no
  CSS, paints nothing and hit-tests nothing. **No row of this plan proves the muted badge is
  LEGIBLE on Deep Midnight**, that it does not occlude or get occluded by its neighbours, or
  that a card carrying it stays inside its height budget. Those are `evaluate_script` reads
  through Chrome MCP (`take_screenshot` times out in this estate), and the `llm_batch_agents`
  precedent — a present, plausible, in-band value that still disappeared on screen — is why
  the distinction is stated rather than assumed.
- **The connected half of the state test is unreachable until Phase 190.** The falsifiable
  half available today is the TYPE half, driven over all six shipped types. Said in the
  tests' own comments so a green run is never mistaken for full coverage.
- **`D-189-DEF-03` (189-11) is unchanged** — a live `external_action` run still shows
  "Complete" until reconcile. Phase 190's.
- **Cloud parity on migration 115 is still OWED** (standing queue, migs 099 onward).

## Authentication Gates

None.

## Known Stubs

**None.** The badge renders from the real projection through the real prop, on real data
`toCanvas` produces from the app's own `minimalPhaseFor`. No `TODO`, no "coming soon", no
component receiving empty or mock data, no hardcoded empty value flowing to the UI. The
unreachable two-badge branch is not a stub — it is a required case of a tuple type, it is
rendered and asserted, and its unreachability is documented at the branch and in the test.

## Threat Flags

None. This plan adds a presentational label and corrects comments. It opens no route, reads
no credential, makes no request and gains no privilege. Its own register is addressed rather
than deferred:

| Threat | Disposition | Evidence |
|---|---|---|
| **T-189-44** — Tampering: a spread silently retiring the max-2 badge typecheck guard | **mitigated** | Explicit branches only; a source fence over the tuple expression asserts no `...` with a positive control; **PLANT 3** (a third badge) observed RED at tsc 34 naming the line; the shipped `@ts-expect-error` control **re-observed swinging 33 → 34 → 33** after the slot was spent |
| **T-189-45** — EoP: a focusable control entering the card | **mitigated** | The badge is a `<span>` inside a `<span>` with no role, no tabindex, no handler; the leaf walk re-driven over the seven-type fixture INCLUDING a two-badge card; 188.2 had driven the same walk RED against a planted `<button>` |
| **T-189-30** — Tampering: the fenced card subtree losing coverage | **mitigated** | Comment-only edits verified line by line; the six JSX-comment lines PROVED inside their `{/* … */}` block by delimiter containment; `CARD_SUBTREE_PATHS` still 6, its length pin unmoved; **no file added** to the directory |
| **T-189-46** — Spoofing: a badge asserting something untrue of the step it sits on | **mitigated** | Driven ABSENT on all six shipped types as a RECORD comparison at BOTH the projection and the rendered-canvas level; the predicate keeps its type and state tests on separate lines (189-13's PLANT Z4), and **the adapter is fenced from naming the type literal at all** so 190 retires it by data |
| **T-189-38** — Repudiation: reservation claims that no longer exist | **mitigated** | **TEN** sites re-derived by grep — three beyond any document — all rewritten with before/after recorded; **both guards REWRITTEN, never deleted**, each with a positive control (**PLANT G** RED on 7 cases) |
| **T-189-47** — Tampering: building an unreachable ghost-detour edge from a stale docblock (**D-21**) | **mitigated** | The docblock is corrected and carries an explicit warning against reading it as a work item; `git diff --stat` over `FlowEdge.tsx` is **EMPTY**; `checkpointOnTarget` re-read and confirmed unable to emit `false` |
| **T-189-SC** — package installs | accept | **This plan installed NOTHING.** No npm package, no shadcn block, no registry read |
| — | Information Disclosure / Denial of Service | n/a | No new attack surface. No route, no credential, no request |

## Self-Check: PASSED

| Claim | Verified |
|---|---|
| `frontend/src/components/workflows/PhaseNode.tsx` — the badge object + the explicit-branch tuple | FOUND |
| `frontend/src/components/workflows/PhaseNode.test.tsx` — 31 green | FOUND |
| `frontend/src/components/workflows/canvasModel.test.ts` — 52 green | FOUND |
| `frontend/src/components/workflows/PhaseNodeCard.test.tsx` — 132 green | FOUND |
| `frontend/src/components/workflows/WorkflowCanvas.test.tsx` — 53 green | FOUND |
| `frontend/src/components/workflows/canvasModel.ts` — S2 + the D-21 correction | FOUND |
| `frontend/src/components/workflows/phaseVocabulary.ts` — S8 | FOUND |
| the three fenced files — comment-only hunks | FOUND, verified line by line |
| `scripts/vitest-count-gate.cjs` — four pins moved, total 2627 | FOUND |
| `.planning/phases/189-.../189-15-SUMMARY.md` | FOUND |
| commits `4defa427`, `c842d9dd` | FOUND in `git log` |
| `tsc --noEmit -p tsconfig.app.json` == 33 | **33** |
| `npx vite build` succeeds | **✓ built in 4.87s** |
| `src/components/workflows` sweep | **36 files / 2203 tests, 0 failed** |
| count gate OK, 47/47, no per-file decrease, 0 failing | **OK, 2627** |
| eslint clean on every file touched | **0 problems** |
| `CARD_SUBTREE_PATHS` still 6, pin unmoved | **`:553`, 6 entries** |
| `FlowEdge.tsx` diff empty (D-21 built nothing) | **CONFIRMED** |
| `NodeIconWell` / `NodeRunOverlay` / `ownProperty` / `WorkflowCanvas.tsx` diff empty | **CONFIRMED** |
| `backend/` and `supabase/` untouched by this plan | **zero-line diff** |
| no file deleted in either commit | **CONFIRMED** |
| no plant residue — `grep -c "PLANT"` / `grep -c "slice(0, 1)"` | **0 / 0** |
| md5 restore of every planted source | `PhaseNode` `e43111e4…` · `phaseNodeCardContract` `ae7e99b1…` · `PhaseNodeCard` `b6a3b7a0…` — identical before and after |
| CONN-01 still `Pending` in REQUIREMENTS.md | **CONFIRMED — `requirements.mark-complete` not run** |
</content>
</invoke>
