---
phase: 199-the-component-map
plan: 04
subsystem: ui
tags: [draft-arrival, decisions-list, design-system, sketch-178, characterization-pin, tailwind, vitest, seed-184, seed-155]

requires:
  - phase: 197
    provides: the one-card `DraftArrivalCard`, the five-row `DecisionsList`, the `decisionsVocabulary` true leaf, and the D-20 three-arm readiness contract this plan reconciles the sheet against
  - phase: 187
    provides: `SeedReceipt` and its zero-insertion / zero-deletion diff criterion, which this plan inherits and never puts under pressure
provides:
  - a resting-atom characterization pin for the whole arrival cluster — the card collapsed, each fold open, both open, and all five decision rows in each of the readiness read's three arms
  - a declared-vertical-box surrogate metric with its own non-vacuity plant, pinned collapsed and fully-open, and an explicit statement of what jsdom structurally cannot measure
  - a machine-checked refusal of sheet c5's status-badge and lifecycle vocabulary on both surfaces, driven RED against two plants
  - a new arithmetic fence tying the row-3 verdict indent to the label width plus the row gap
  - the sheet-c5 ROW WASH, built — the one element the shipped cluster could express and did not
  - a ten-row CAN-EXPRESS / CANNOT-EXPRESS reconciliation for every element of sheet `c5-draft-arrival`
affects: [199-09 builder-page wiring, any future draft-arrival or decisions work, sketch-178 step-3 follow-on]

tech-stack:
  added: []
  patterns:
    - "Colour-token resolution fence: a colour utility is asserted to name a key that actually exists in `tailwind.config.js`, with a POSITIVE CONTROL that the lookup would MISS the sheet's own palette — the `bg-warning` failure 192.2 shipped unguarded"
    - "Arm-identity pin: two readiness arms asserted ATOM-FOR-ATOM identical across ALL rows, which is strictly stronger than asserting neither says anything affirmative"
    - "Declared-box surrogate: when jsdom cannot measure height, sum the DECLARED spacing and type instead, publish the number, and state in the same breath that it is not a pixel"

key-files:
  created: []
  modified:
    - frontend/src/components/workflows/DecisionsList.tsx
    - frontend/src/components/workflows/DecisionsList.test.tsx
    - frontend/src/components/workflows/DraftArrivalCard.test.tsx

key-decisions:
  - "The sheet's per-row status badge is REFUSED, not adapted. An affirmative badge on a PRESENT readiness makes the present arm distinguishable from the ABSENT arm, and the whole argument for a third arm is that the two are indistinguishable to the author"
  - "The sketch README's claim that this sheet reproduces the shipped decisionsVocabulary contract is MEASURED FALSE on three counts — a claim in a document is a claim to VERIFY, not a fact"
  - "The row wash is applied only where a control exists, derived from what the render already produced (`action !== null || key === \"name\"`) rather than re-decided — the 199-01 run-mode argument applied to a row"
  - "The wash emits fill only: no padding, margin, radius or transform, so the declared vertical box is byte-identical before and after. The height delta is 0 and that is the intended outcome, not an under-delivery"
  - "`DraftArrivalCard.tsx` and `SeedReceipt.tsx` are byte-unmodified by this plan. Nine of the sheet's ten elements build nothing"

patterns-established:
  - "Sheet-vocabulary refusal fence: spell the SHEET's words as literals in the suite and assert them ABSENT from the rendered DOM — legal because nothing greps a source, and it makes a documented refusal checkable rather than asserted"

requirements-completed: [DES-01]

duration: 42min
completed: 2026-08-19
---

# Phase 199 Plan 04: The Draft Arrival Cluster Summary

**Reconciled the shipped 197 arrival cluster against every element of sketch 178's sheet `c5-draft-arrival`, pinned its resting atoms and both fold states as literals with a declared-box surrogate for the height jsdom cannot measure, refused the sheet's status-badge vocabulary as a direct breach of the D-20 three-arm contract, and built the one element the cluster could express and did not — a row wash that lands only where there is something for the cursor to reach.**

## Performance

- **Duration:** ~42 min
- **Tasks:** 2/2
- **Files modified:** 3 (one source, two suites)
- **Test cases added:** +29 (`DecisionsList.test.tsx` 57 → 73, `DraftArrivalCard.test.tsx` 35 → 48)

## Commits

| Task | Commit | What |
|---|---|---|
| 1 | `88ec6016` | `test(199-04)`: the resting inventory, the declared box, the sheet-c5 refusal fences — test-file-only |
| 2 | `68d7185c` | `feat(199-04)`: the row wash + its five fences + the docblock record of every refusal |

## ⚠ THE WORKTREE FORKED FROM THE WRONG BASE, AND THE ASSERTION CAUGHT IT

Reported because it is a measured hazard and not a footnote. The worktree was created at
`fda79214` — *"Merge develop into master"* — whose merge base with the dispatched
`9a0379ba` is `3781a3fe`. Both sibling plans 199-01 and 199-02 were **absent** from that
tree. The `<worktree_branch_check>` assertion fired, `git reset --hard 9a0379ba` corrected
it, and HEAD was re-verified before a single file was read. Every figure in this document
is measured on the corrected base.

---

## THE RECONCILIATION — all ten elements of sheet `c5-draft-arrival`

Sheet 178 is **direction, not an acceptance bar** — its own README says so and its
frontmatter carries `acceptance_bar: false`. It renders **zero** shipped components. Every
verdict below is taken against that fact, and against the standing rule that where the
sheet and the shipped locked language disagree, **the shipped language wins and the
disagreement is reported**.

| § | Element | Verdict | One-line reason |
|---|---|---|---|
| A1 | Card state A — *Freshly Arrived* chip | **CANNOT-EXPRESS** | The card has no lifecycle concept, and the chip PRINTS THE MECHANISM — the rule sketch 178's own `designMd` added |
| A2 | Card state B — *Returned-to* chip | **CANNOT-EXPRESS** | Same; dismissal is deliberately not persisted (197 declined it with a re-open trigger) |
| A3 | The editable workflow NAME as the card headline | **ALREADY-SHIPPED, ELSEWHERE** | It is row 4's inline field (D-17). A second one here is *"a second, different answer to one question"* |
| A4 | The describe-text echo + *View full* | **CANNOT-EXPRESS** | No describe prop exists; adding one widens a props contract 199-09 owns |
| A5 | *Publish* + *Open in builder* buttons | **CANNOT-EXPRESS** | Publish has one home (the gauntlet, sheet c7); a second door here is a new capability, which the scope fence forbids outright |
| B1 | Five decision rows | **ALREADY-SHIPPED — and the sheet's five are NOT ours** | See the drift report below |
| B2 | The *Satisfied* / *Needs You* / *Unknown* status badges | ⚠ **CANNOT-EXPRESS — REFUSED, and this is the headline** | It breaks the D-20 three-arm invariant outright. See below |
| B3 | Per-row leading icons | **CANNOT-EXPRESS** | The icon convention is single-source; none of the five decision subjects maps to a shipped mark, and the sheet's are flat Material Symbols |
| B4 | The row hover wash | ✅ **BUILT** | Measured absent; see below |
| C | The seed receipt, active + *absent when nothing to report* | **ALREADY-SHIPPED** (active state CANNOT-EXPRESS) | The absence is now pinned; the sheet's *"Applied Decisions / Model / Schedule"* content is not this receipt and `Schedule` is not a concept this app has |

**No element was silently dropped.** One built, three already-shipped, six cannot-express.

---

## ⚠ THE SKETCH README MAKES A CLAIM ABOUT THIS SHEET THAT IS MEASURED FALSE

`.planning/sketches/178-stitch-component-map/README.md` § *"Sheets 4–9"* says:

> The draft arrival cluster **reproduces our shipped `decisionsVocabulary` contract**: three
> arms per row, an explicit *not reported*, and only the grounding row claiming a publish
> requirement.

**A `key_links`-style claim in a document is a claim to VERIFY, not a fact** — 199-01
measured one of its own plan's `key_links` false of the tree and correctly refused to move
code to make the sentence true. The same discipline applies here, and the claim fails on
**three** counts, each read off the sheet's own markup:

1. **"three arms per row" — FALSE in the way that matters.** The sheet's three arms are
   *Satisfied* (green tick + green badge), *Needs You* (red mark + red badge) and
   *Unknown / Not reported* (grey badge). The shipped three arms are `readiness` **ABSENT**
   → nothing, status **present** → nothing, status **missing** → the server's sentence. The
   shipped invariant is that **absent and present are INDISTINGUISHABLE**, so an absence can
   never be read as a pass. The sheet's arms are *distinguishable by construction* — a
   present readiness paints an affirmative green badge — which re-introduces exactly the
   *"unknown reads as satisfied"* failure the third arm exists to prevent. It also breaks
   **D-16**: the card may say *a model made this choice*, never *this choice is good*.
2. **"an explicit *not reported*" — a NEW breach, not a reproduction.** Rendering a visible
   *Not reported* caption is what MAKES absence distinguishable from present. The shipped
   contract renders nothing in both arms precisely so the two cannot be told apart.
3. **"only the grounding row claiming a publish requirement" — the claim is about the WRONG
   ROW.** D-20 permits exactly **row 3, the requirement row**, to borrow the gate's register,
   because `business_requirement_missing` is the only definition-level predicate there is.
   The sheet puts its publish sentence (*"Publishing requires grounding satisfaction"*) on a
   row titled **Knowledge-Grounding** with a database glyph — the knowledge-base row. **D-20
   is explicit that nothing anywhere refuses a publish for a missing knowledge-base
   binding**, so the sheet's one publish claim is on the one row that must never make it.

Additionally, the sheet's five row subjects — *Data Source · Vendor Identification ·
Contract Duration · Knowledge-Grounding · Risk Assessment Logic* — are **model-invented and
none is one of the app's five decisions**. Three of them are properties of one example
workflow, not decisions the generator makes on any author's behalf.

**Nothing in the code was changed to make the README's sentence true.** The refusal is now
machine-checked on both surfaces, driven RED against a plant.

---

## ⚠ THE SHEET'S ENTIRE COLOUR PALETTE COMPILES TO NOTHING — MEASURED, 15 OF 18

The plan required verifying that every colour token the sheet asks for **resolves** in
`frontend/tailwind.config.js`. Measured by extracting every colour-bearing utility from the
sheet's `<body>` (its own `<script>` block declares a private Material-3 palette that the
app does not have) and checking each against the shipped config:

```
TOTAL 18  ·  resolves 3  ·  ABSENT 15
```

And the "3" is generous — two of them (`primary-container`, `primary-fixed`) matched only a
`primary`-prefix heuristic and are **also absent**, confirmed independently:

```
grep -c "primary-container\|primary-fixed\|\"tertiary\"\|on-surface"
  frontend/tailwind.config.js  →  0
  frontend/src/index.css       →  0
```

So of the sheet's colour vocabulary, only `primary` (and Tailwind's built-in `transparent`)
exists. `surface-container-lowest`, `surface-container`, `surface-variant`, `on-surface`,
`on-surface-variant`, `outline-variant`, `tertiary`, `on-primary` and the two arbitrary
hexes `#93000a` / `#ffb4ab` all compile to **nothing**.

⚠ **This is not a cosmetic finding.** It is the `bg-warning` failure `192.2` shipped
unguarded: a utility naming a missing key is a **silent no-op** that no `data-` attribute
assertion can see. The built row therefore carries its own config-resolution fence, with a
positive control asserting the lookup would **miss** three of the sheet's own tokens.

---

## ✅ BUILT · the row wash

`grep -n "hover:"` over `DecisionsList.tsx` returned **exactly one line** before this plan,
and it was the action control's own `text` change. **The row itself carried no response at
all** — on a list whose every control is an 11.5 px dotted-underline word sitting beside a
long answer, which is a small target and gives a reader no signal about which row the
control belongs to.

What shipped, in `DecisionsList.tsx` (+31 lines, of which 24 are the account):

```
const ROW_HOVER_CLASS = "transition-colors duration-150 hover:bg-accent/30"
```

Four decisions, each an inherited invariant rather than a preference:

1. **FILL ONLY, AND NO GEOMETRY.** It emits no padding, margin, radius or transform, so the
   cluster's declared vertical box is byte-identical before and after. Guarded by a source
   fence with a positive control on `hover:px-2`. `SEED-184`'s complaint is about
   *hierarchy*; answering it by growing the surface answers a different question.
2. **IT LANDS ONLY WHERE THERE IS SOMETHING TO REACH.** Rows 2 and 5 render **no** jump when
   there is no producing step, and a row that lit up under the cursor there would promise an
   interaction that does not exist — the `199-01` argument for suppressing the canvas node's
   hover in run mode, applied to a row. Guarded over all five rows in **both** step states.
3. **DERIVED, NEVER RE-DECIDED.** `action !== null || key === "name"` — computed from what
   the switch already produced. The second term is not an oversight: **D-17 makes row 4's
   FIELD its action**, so it carries no sibling control for the first term to see. Published
   as `data-row-interactive` so the rule is checkable from the DOM rather than from a
   class-string grep — which is the exact blind spot that let `bg-warning` ship.
4. **A TOKEN THAT RESOLVES.** `accent` is the shipped Deep Midnight token, already used at
   this opacity by `DraftArrivalCard.tsx:246`, `BuilderSaveRegion.tsx:169/250` and
   `GovernanceSection.tsx:378`. The sheet's `surface-variant` was checked and rejected.

---

## THE MEASURED HEIGHTS, AND WHAT jsdom STRUCTURALLY CANNOT GIVE

### ⚠ CANNOT-MEASURE — the plan asked for pixels and the environment cannot produce them

- **What the plan asks for:** the collapsed and fully-open **heights**, *"as the `SEED-184`
  measurement did"* — that measurement being **147 px collapsed / 398 px both folds open**.
- **What the environment can do:** nothing of the kind. **jsdom applies no CSS and reports
  `clientHeight` 0** — the fact `editAffordance.test.ts:564` records at length in its own
  *"REFUSES TO MOVE an unmeasured panel"* case. Asserting `SEED-184`'s figures here would be
  a fabricated measurement.
- **The gap, and what was built instead:** a **declared vertical box** surrogate — the sum of
  every vertical padding/margin utility the subtree emits, plus the declared type on every
  text-bearing element. It is **not a pixel** and must never be compared with `SEED-184`'s
  numbers, but it **moves whenever spacing or type changes**, which is the property that
  makes *"the card got quieter"* falsifiable rather than a feeling. The real px reading stays
  **OWED to a G-4 row**, exactly as the receipt suppression's appearance already is.

| Reading | boxPx | linePx | totalPx |
|---|---|---|---|
| Collapsed — before | 76 | 39 | **115** |
| Collapsed — after | 76 | 39 | **115** |
| Both folds open — before | 217 | 231.925 | **448.925** |
| Both folds open — after | 217 | 231.925 | **448.925** |
| **DELTA** | **0** | **0** | **0** |

**The delta is zero and that is the intended outcome.** The cluster renders no more at rest
than before — one class was added and nothing an author reads moved, which the Task-1 atom
pins prove by continuing to pass **unedited** across the Task-2 commit.

⚠ **`linePx` deliberately under-counts, and saying so is the difference between a surrogate
and a lie.** A text-bearing element that inherits its type from an ancestor contributes
nothing: the two fold lines declare `text-[12.5px]` on the **button** and paint their words
in child spans, so neither is counted. Attributing an ancestor's type to each of its
descendants instead would double-count every nested span, which is the worse error.

---

## THE RED DRIVES — every new fence observed failing before it was believed

Two plants were applied to the shipped components, the suites run, and both reverted with
`git checkout --` on the named files.

**Plant 1** — a status word on every row (`<span>Satisfied</span>`), the verdict indent
moved to `pl-[140px]`, and `Open in builder` appended to the card's closing line. **10 cases
failed across the two suites**, including every new fence:

| Fence | Fired |
|---|---|
| the resting inventory, both files | ✅ |
| the sheet-c5 status-vocabulary sweep | ✅ |
| the sheet-c5 lifecycle/door sweep | ✅ |
| the label-width / verdict-indent arithmetic | ✅ |

⚠ **The arm-identity pin did NOT fire on plant 1, and that is recorded rather than
smoothed.** The plant added its word to *every* row in *every* arm, so the two arms stayed
identical — the fence detects **divergence**, not affirmativeness, and the affirmative
detector plus the sheet-word sweep are what caught it. That is three independent fences
covering one property by three different mechanisms, which is why the gap was visible.

**Plant 2** — a verdict node rendered on **row 1** whenever `readiness` is defined. **9 cases
failed**, and this time both new arm fences fired:

- `ARM 1 (absent) and ARM 2 (present) are ATOM-FOR-ATOM identical on ALL FIVE rows` ✅
- `ARM 3 (missing) differs from the other two on ROW 3 ALONE` ✅

---

## A LATENT DEFECT FOUND BY THE INVENTORY RATHER THAN BY A FAILURE

Row 3's server verdict is indented by a hard-coded `pl-[136px]` which must equal the label
cell's `w-[128px]` plus the row's `gap-2` (8 px). **Nothing connected the three numbers**, so
any future spacing change would have silently misaligned the one sentence on this surface
that is not ours. Tailwind's JIT needs each arbitrary value as a static literal, so the three
cannot be computed from one constant at runtime — they are now tied together in the suite by
reading all three back out of the component's own source and checking the arithmetic, with
non-vacuity asserted on each regex first and a positive control on the sum. That is stronger
than a comment and required no source change.

---

## Gates

| Gate | Result |
|---|---|
| `DraftArrivalCard` + `DecisionsList` + `decisionsVocabulary` + `SeedReceipt` | **211 passed, 0 failed** (was 182) |
| `WorkflowBuilderPage.canvas.test.tsx` (the only other suite touching the cluster) | **154 passed, 0 failed** |
| `npx tsc --noEmit -p tsconfig.app.json` | **33 errors — the baseline, unmoved. ZERO under `components/workflows/`** |
| `node scripts/vitest-count-gate.cjs` (repo root, `GSD_VITEST_MAX_WORKERS=2`) | `count gate OK — 96/96 pinned files present, no per-file decrease, 0 failing` · **total 4753 · pinned total 4543** |
| `git diff --stat -- backend supabase` | **EMPTY** |
| `git diff --numstat -- .../SeedReceipt.tsx` | **EMPTY** — the 197 zero-diff criterion holds |
| `git diff --numstat -- .../DraftArrivalCard.tsx` | **EMPTY** — the card's source is byte-unmodified; only its suite grew |

### ⚠ THE COUNT-GATE ARITHMETIC CLOSES WITH NO RESIDUAL — and the check found a stale pin

The dispatched baseline was **total 4724**; the gate now reads **4753**, a delta of **+29**.
The gate's per-file column reads `+19` and `+13`, which sums to **+32** — a 3-case residual,
and an unexplained `+n` is precisely the thing this project's own rule says to worry about.

It was closed by **measurement, not argument**: the three files were checked out at the base
SHA, the four suites run, and the pre-change total read **182** (against 211 after). So the
true contribution is **+29** and the arithmetic closes exactly.

**The residual was a STALE PIN, and the gate behaving correctly.** `DecisionsList.test.tsx`
was pinned at **54** while its actual pre-change count was **57** — a pin is a **floor**, and
the gate's contract is *no per-file DECREASE*, never an exact match. `DraftArrivalCard.test.tsx`
was exactly at its pin (35). No pin was raised and `scripts/vitest-count-gate.cjs` is
byte-untouched by this plan.

Every increment is attributed so none can be quoted as another:
**182** (base) → **195** (`+13` `DraftArrivalCard`, Task 1) → **204** (`+9` `DecisionsList`
inventory + sheet fences, Task 1) → **211** (`+7` `DecisionsList` row-wash fences, Task 2).

---

## Deviations from Plan

**None in substance — the plan executed as written.** Two things are recorded because
silence would read as agreement:

1. **The worktree base correction** (above), which the plan's own assertion block anticipated.
2. **The plan's must_have reads *"Only the grounding row claims a publish requirement"***,
   which is the SHEET's phrasing. The shipped rule is **only ROW 3, the requirement row** —
   the plan's own `read_first` says so verbatim. The two agree because row 3's verdict is the
   one sourced from `grounding.py`; but the sheet uses "grounding" to mean the
   **knowledge-base** row, which is why the drift report above is worded around the row
   INDEX rather than around the word. Nothing was built either way.

## Known Stubs

None. No hardcoded empty value, placeholder string or unwired component was introduced.

## Threat Flags

None. No network endpoint, auth path, file access pattern or schema was touched; the whole
diff is one Tailwind class, one derived boolean, one `data-` attribute and two test files.

The plan's three registered threats are each still mitigated, and two are now more strongly
so:

- **T-199-04-01** (Spoofing, `DecisionsList.tsx`) — three-arm rendering held, and now
  additionally guarded by an **atom-for-atom arm-identity pin over all five rows**, which is
  strictly stronger than the shipped "nothing affirmative" sweep and was driven RED.
- **T-199-04-02** (Repudiation, `decisionsVocabulary.ts`) — D-20 held; the module is
  byte-untouched, and its placement is now asserted across all five rows in all three arms.
- **T-199-04-03** (Tampering, `DraftArrivalCard.tsx`) — the file is byte-unmodified, so the
  receipt's own locked-string audit is untouched by construction rather than by care.

## Owed

- **G-4 row U1 (appearance)** — jsdom applies no CSS, so the wash's *look* is unproved. The
  structure, the reachability rule, the fill-only property and the token's resolution are all
  machine-checked; **only LOOKING proves appearance**. Owed alongside the pre-existing U1 debt
  on the receipt suppression, which this plan inherits and does not discharge.
- **The real pixel heights.** The declared-box surrogate is not a page height and must never
  be quoted as one.
- **The nine cannot-express / already-shipped rows** are verdicts, not deferrals — none is
  owed work. Where a future phase disagrees, the re-open trigger is a sketch that RENDERS the
  shipped components (SEED-155), not another sheet drawn from scratch.
