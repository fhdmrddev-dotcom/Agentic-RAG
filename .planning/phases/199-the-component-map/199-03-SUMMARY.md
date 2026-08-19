---
phase: 199-the-component-map
plan: 03
subsystem: ui
tags: [react, tailwind, vitest, publish-gauntlet, workflow-soul, design-system, stitch, characterization-testing]

# Dependency graph
requires:
  - phase: 124
    provides: the locked 046-A five-atom WorkflowSoul + PhaseSpine + deriveTier
  - phase: 127
    provides: the energized gauntlet pip/energy-spine, the worded verdict, the raw-on-demand disclosure
  - phase: 186
    provides: verdictModel.blockedSentence — the ONE home for every word a surface says about a check
  - phase: 192.2
    provides: the library card's D-03 subtraction (the removal this plan's own plan mis-generalised)
provides:
  - a gauntlet strip that FITS the modal body (624px against a 640px budget) instead of scrolling past Judge and Commit
  - the duplicated "◆ Publish this workflow" section heading subtracted, proved by inversion
  - the first RENDERED guard that the running gauntlet claims no determinate progress
  - a no-override scan widened from `<button>`+two-words to the whole interactive role set over the WHOLE judge-failure state
  - a pre-change resting inventory of both surfaces, pinned PRESENT so any later removal is proved by inversion
  - two new stable DOM hooks on the spine (`spine-stage`, `spine-conn`)
  - a mechanically-pinned record of the soul's cross-surface DOM coupling, and the plan-claim it refutes
affects: [199-08, workflow-soul, publish-gauntlet, WorkflowDoorSwitch, any future soul re-tone]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inventory-then-invert: pin resting atoms PRESENT, then prove a subtraction by flipping the polarity of the same assertion — never by deleting it"
    - "Geometry budgets checked by arithmetic over RENDERED class strings, with a non-vacuity guard, instead of a number written twice"
    - "Absence scans matched over an interactive ROLE SET, with permanent positive controls for each arm"

key-files:
  created: []
  modified:
    - frontend/src/components/workflows/PublishGauntlet.tsx
    - frontend/src/components/workflows/PublishGauntlet.test.tsx
    - frontend/src/components/workflows/WorkflowSoul.test.tsx

key-decisions:
  - "The sheet's UNDETERMINED third arm is REFUSED — our third band is MIDDLE, a real derived band, and claiming uncertainty over a value the code CAN tell is a false claim about our own certainty"
  - "The sheet's in-progress strip (3 of 8 segments filled) is REFUSED — a determinate stage count the wire cannot supply"
  - "The sheet's amber mechanical-failure tone is REFUSED — amber is the locked RUNNING tone in the very same strip"
  - "The soul tier-chip weighting was BUILT then WITHDRAWN rather than re-baseline a characterization pin on a third surface"
  - "The count-gate pins were left slack rather than edit a G-5-firing shared guard file mid-wave"

patterns-established:
  - "A plan's own key_links / planner_correction is a claim to VERIFY: this plan's was measured FALSE and the original is preserved beside the correction"
  - "A blunt banned-word sweep is honoured by rewording your own prose, never by exempting the fence"

requirements-completed: [DES-01]

# Metrics
duration: 33min
completed: 2026-08-19
---

# Phase 199 Plan 03: The Gauntlet & The Soul Summary

**The gauntlet strip now fits the modal instead of scrolling past its own Judge and Commit nodes, its "no override" claim is guarded over the whole rendered state for the first time (both prior guards were measured blind to a live override link), and the soul's re-tone was withdrawn rather than re-baseline a byte-for-byte pin on a third surface the plan said did not exist.**

## Performance

- **Duration:** ~33 min
- **Started:** 2026-08-19T04:49Z
- **Completed:** 2026-08-19T05:22Z
- **Tasks:** 2/2 (plus one in-plan withdrawal, committed separately)
- **Files modified:** 3

## ⚠ Worktree base correction FIRED

The dispatched base was **not** an ancestor of the worktree's HEAD:

```
HEAD                                  fda792141b0129de7b15dd40ddc1082e76f95a2a
git merge-base HEAD 9a0379ba…         3781a3fe4690a9619e619f4cc412bd37a7dafc52   ← ≠ 9a0379ba
```

`git reset --hard 9a0379ba` applied, verified. This is the same measured hazard the prompt named on `199-01`; the assertion is what caught it. All measurements below are against `9a0379ba`.

## The reconciliation table — sheet `c7-gauntlet-soul` vs the shipped surface

Every element of the sheet carries a verdict. **None is silently dropped (SC#1).**

### §1 The publish gauntlet

| # | Sheet element | Shipped | Verdict |
|---|---|---|---|
| G1 | AT REST: a card with 8 neutral segments | at rest the whole gauntlet is a single `◆ Publish…` button; the strip exists only inside the modal | **ALREADY SUBTRACTED** — ours renders strictly less. No change. |
| G2 | "one compact strip" | one strip, but **856px inside a 640px body** → horizontal scrollbar with Judge + Commit off-screen | ✅ **BUILT** — subtraction only. 624 ≤ 640. |
| G3 | IN PROGRESS is indeterminate | honest already: zero passed nodes while running, only the golden-run node pulses | **ALREADY HONEST**, but **UNGUARDED** → ✅ **BUILT (test)**. ⚠ And **the sheet is the one that is wrong** — see CE-1. |
| G4 | judge FATAL vs mechanical RECOVERABLE, distinguishable | separated in words *and* glyph (⚖️ / ⛔) via `verdictModel` | **ALREADY SATISFIED** — pinned against the imported vocabulary. |
| G5 | mechanical failure drawn **amber** | every block is destructive/red; amber is the locked RUNNING tone | ⛔ **REFUSED** — see CE-2. |
| G6 | judge wall carries NO override | no override; the absence is rendered struck-through | **ALREADY SATISFIED in the code**, ⚠ **NOT in the guards** → ✅ **BUILT (test)**. See "the RED drive". |
| G7 | "View Details" raw-on-demand | `<details data-testid="raw-verdict">`, closed by default | **ALREADY SATISFIED** — pinned as the ONLY disclosure so a second cannot be built beside it. The sheet's `<a href="#">` is a dead affordance; ours is real. |
| G8 | the sheet's own sentences | `blockedSentence()` from the pure verdict module | ⛔ **REFUSED** — words are imported, never re-spelled in a component. |
| G9 | per-state card tinting | success/destructive tinting already on the verdict card | **ALREADY SATISFIED.** |
| G10 | the duplicated section heading (implicit — the sheet has no chrome at all) | title bar + form heading said the same four words two lines apart | ✅ **BUILT** — cut, proved by inversion. |

### §2 The workflow soul

| # | Sheet element | Shipped | Verdict |
|---|---|---|---|
| S1 | a one-line row: doc glyph + **NAME** + tier chip right-aligned | five atoms, purpose-led, stacked; `name` is **not an atom** | ⛔ **REFUSED** — see CE-3. |
| S2 | STRICT / LOOSE arms | 🔒 STRICT / ○ LOOSE, glyph + WORD | **ALREADY SATISFIED.** |
| S3 | `UNDETERMINED` third arm | `MIDDLE` — a real derived band | ⛔ **REFUSED** — the headline decision, below. |
| S4 | dashed border on the third arm | one solid chip at every tier | ⛔ **REFUSED** — follows S3; a "we are uncertain" tone over a certain value is the same false claim, in tone instead of words. |
| S5 | `lock` / `lock_open` / `help` Material Symbols | glyphs from `TIERS` in `deriveTier.ts` | ⛔ **REFUSED** — Material Symbols are not in the shipped icon convention, and the glyph has ONE home. |
| S6 | the three arms carry **different weights** | all three render one identical treatment | ⚠ **BUILT, THEN WITHDRAWN** — see CE-4. This is the plan's headline finding. |

## The `UNDETERMINED`-vs-`MIDDLE` decision (recorded, with its reason)

The sheet's third strictness arm is captioned with a *we-could-not-tell* word, drawn with a `help` glyph and a dashed border. **It is not adopted.**

Our third band is `MIDDLE`, and `deriveTier.ts` derives it on **every render** from real enums: a `flag`/`partial` `citation_policy` that does **not** carry the full floor-raising gate set, or a `draft` policy that carries any of them. It is a *band*, not an *unknown*. Printing a we-could-not-tell word over it would claim uncertainty about a value the code can compute exactly — the same class of dishonesty this project forbids everywhere else, pointed inward.

Pinned three ways: all three arms are asserted to be real distinct derived bands; the `MIDDLE` chip is asserted to say its own word, its own glyph and its own description; and the sheet's word is swept out of **the whole soul chain** (`WorkflowSoul.tsx` + `soulData.ts` + `deriveTier.ts`) behind a positive control.

⚠ **The sweep fired on this plan's own docblock prose, and the prose was reworded rather than the fence exempted.** That follows the `verdictModel.ts` `not-run` precedent verbatim: the sweep is blunt on purpose, because the way a banned word actually reaches a user is somebody lifting it out of nearby prose.

## ⚠ The RED drive — and both pre-existing guards were measured BLIND

The plan required the no-override assertion be driven RED against a planted control. It was, physically, against the shipped component, and then restored (`numstat` empty).

Plant, inside `HardWall`: `<a href="/publish?force=1">Proceed to publish anyway</a>`

| Guard | Result with the plant live |
|---|---|
| **NEW** — `forwardControlsIn(modal)` over the whole judge-failure state | ⛔ **RED**: `AssertionError: expected [ <a href="/publish?force=1"></a> ] to have a length of +0 but got 1` |
| shipped `?raw` source regex — *"the override is ONLY rendered struck-through"* | ✅ **GREEN** |
| shipped rendered scan — `queryAllByRole("button")` filtered on `/publish anyway\|override/i` | ✅ **GREEN** |

**Both shipped guards passed green with a live, clickable override link rendered inside the judge hard wall.** The source regex cannot see a control whose label is composed from a variable; the button scan cannot see a link (role `link`), a menu item, or a control worded any other way. The new scan matches `button, a[href], [role=button|link|menuitem], input[type=submit|button]` against label, `aria-label` and `title`, over the **entire modal** including the header, the spine and the soul block, and again with the disclosure forced open — and it carries **three permanent positive controls** (one per role arm) plus a negative control proving it does *not* fire on the deliberate `no override · <s>publish anyway</s>` text, so the honest absence never has to be deleted to go green.

## CANNOT-EXPRESS reports (three parts each, as required)

### CE-1 · The sheet's IN PROGRESS strip draws progress we cannot know

- **What the sheet asks for:** an eight-segment strip with **three segments filled**, a fourth pulsing and four empty — i.e. "stage 4 of 8 is running".
- **What the component can do:** nothing of the kind. Publish is **one synchronous HTTP call** whose only answer is the final verdict; there is no per-stage event stream. The shipped spine paints **zero** passed nodes while running and pulses only the golden-run node, which is the one stage a user actually waits on.
- **The gap:** the sheet's own README names this failure mode on sheet 3 (`Processing liability caps section (4/12)` — *"a determinate count and exactly the class of fabricated precision this project forbids"*) and then commits it again here. **Refused.** Closing it would need a backend progress channel — a capability, not a presentation change. It is now guarded: no percentage, no `n of 10`, no valued `progressbar`, no `stage N`, no green node, no ✓ badge, no reached connector, and no `remaining`/`estimated`/`eta`. The elapsed clock is the only number and it is *measured*, not predicted.

### CE-2 · The sheet's amber mechanical-failure tone collides with RUNNING

- **What the sheet asks for:** mechanical (recoverable) failure rendered in amber `#f59e0b`, distinct from the red judge failure.
- **What the component can do:** it can tint a verdict card any token colour — but **amber is already spoken for**. `publish-gauntlet.md` locks the colour language: *amber = running / the golden-run wait; red = blocked / judge-fail*, and the running node in the **same strip** is `border-amber-500`.
- **The gap:** adopting it would put two different meanings on one colour inside one component. The shipped language wins. The distinction the sheet wanted is already carried more strongly — in **words** (`hard wall` vs `Fix the cause and re-publish`) and in **glyph** (⚖️ vs ⛔), neither of which is colour-alone.

### CE-3 · The sheet's soul row is a different component

- **What the sheet asks for:** a one-line row — document glyph, workflow **NAME**, tier chip right-aligned.
- **What the component can do:** render five locked atoms in a locked order with **purpose as the hero at every size**. `name` is not one of them (it reaches the soul only *inside* `soulDeliverable`'s derived label).
- **The gap:** that row is the **library card's identity line**, not the soul. Adopting it would delete four atoms including the hero and would introduce a sixth. The atom order is now read off the rendered DOM and asserted as a list, so a future reorder is a failure rather than a diff nobody reads.

### CE-4 · The soul's tier weighting cannot ship inside this plan's scope

- **What the sheet asks for:** the three arms should not weigh the same — STRICT filled and bordered, LOOSE transparent and muted.
- **What the component can do:** exactly that, and it was built: a `TIER_TONE: Record<TierId, string>` keyed on the tier (total by construction), shipped tokens only, glyph + WORD preserved on every arm so WCAG 1.4.1 never depends on the tone.
- **The gap:** **the chip's class string is inside a DOM that a third surface pins byte-for-byte.** The count gate went red on two cases in `WorkflowDoorSwitch.baseline.test.tsx`; the mechanism, checked before anything was re-run, is `WorkflowDoorSwitch.tsx:451` → `<WorkflowSoul scale="card" />`. Keeping the change required re-baselining a characterization pin, which the plan forbids in terms, on a file outside this plan's scope. **Withdrawn.** `WorkflowSoul.tsx` is byte-identical to the base. A plan that carries `WorkflowDoorSwitch` in its scope can ship it in one edit and invert the pinned case.

## ⚠ A plan claim measured FALSE

`199-03-PLAN.md`'s `<planner_correction>` states:

> *"`PhaseSpine` no longer renders at `scale="card"` on the library card — Phase 192.2 removed `<WorkflowSoul scale="card" />` from `WorkflowCard.tsx` as its D-03 subtraction. Its live consumers are `scale="run"` and `scale="pub"` only. **Verify this before assuming a card regression is possible.**"*

Verified, and the last sentence is the reason it matters: **it is false of the tree.** 192.2 removed the **library card's mount**, not the **card scale**. `WorkflowDoorSwitch.tsx:451` still mounts `<WorkflowSoul scale="card" />` on the describe door. The plan generalised *one mount removed* into *the scale is dead*, and that inference is exactly what made CE-4's regression look impossible until the gate proved otherwise.

It is now pinned mechanically rather than left as prose: the card-scale mount is asserted present in `WorkflowDoorSwitch` source, and `soul-tier` is asserted present **inside the baseline's captured DOM string** (matched with its escaped quotes, so a mention in prose cannot satisfy it), both behind non-vacuity length guards. The original claim is preserved beside the correction in the suite's own comment rather than overwritten.

## `key_links` verification (claims, not facts)

| Claim | Verdict |
|---|---|
| `WorkflowSoul.tsx` → `PhaseSpine.tsx` via *atom 3, the glyph-dot spine*, pattern `PhaseSpine` | ✅ **TRUE** — a direct runtime import. |
| `WorkflowSoul.tsx` → `deriveTier.ts` via `tierForDefinition`, pattern `tierForDefinition\|deriveTier` | ⚠ **PATTERN TRUE, EDGE INDIRECT.** `tierForDefinition` is in `WorkflowSoul.tsx`, so the pattern matches — but it is imported from **`soulData.ts`**, which is what imports `deriveTier`. The indirection is deliberate (`soulData` is the ONE shared home), and **no derivation was moved to make the sentence literally true.** The withdrawn change would have added a type-only `TierId` import; it went out with the rest. |

## The BUILT rows, as shipped

**BUILT-1 — the strip fits.** The shape was already right; it did not fit. Ten 64px columns + nine 16/24px connectors = **856px** against a modal body of **640px** (`max-w-2xl` 672 − `px-4` twice), so the strip that exists to show every check at a glance ended in a scrollbar with Judge and Commit off-screen. Column 64→48, node 40→36, icon 20→16, connector 16/24→12/16, `py-4`→`py-3`. **10 × 48 + 9 × 16 = 624 ≤ 640.** Nothing removed from the strip; no stage folded away; `overflow-x-auto` kept as the narrow-viewport valve. The arithmetic is **checked, not asserted** — the suite reads the widths back off the rendered `spine-stage` / `spine-conn` class strings and does the sum, with a non-vacuity guard so a class rename cannot pass silently.

**BUILT-2 — the duplicated heading is cut.** `◆ Publish this workflow` in the form said the same four words the dialog's title bar says two lines above. *Text is noise — cut it, but the purpose must survive the cut*: the title bar still carries it, and the paragraph naming what publishing **costs** (a real golden run, an independent judge, "it can honestly block") is deliberately kept and asserted.

⚠ **One precision correction to this plan's own Task-1 commit message**, which claimed Task 2 would invert *two* counts. Only one moved. `getAllByText("Publish this workflow")` is an **exact** match and therefore never counted the `◆`-prefixed heading — it read `1` before and after, and that is the *"purpose survives"* guard, not an inversion. The inversion is the second line: `toHaveLength(1)` → `not.toBeInTheDocument()`. Stated in the suite so the next reader is not misled.

**BUILT-3 (soul tone)** — withdrawn, see CE-4.

## Measurements

| Gate | Baseline (prompt) | Measured | Verdict |
|---|---|---|---|
| `tsc --noEmit -p tsconfig.app.json` | 33 | **33** | unmoved; **0** under `components/workflows/` |
| count gate | OK · 96/96 · failed 0 · total 4724 · pinned 4543 | **OK · 96/96 · failed 0 · total 4746 · pinned 4543** | +22, fully attributed |
| `git diff --stat -- backend supabase` | empty | **empty** at every task | scope fence holds |
| eslint (changed files) | — | clean | |

**The +22 closes with no residual:** `PublishGauntlet.test.tsx` 50 → 62 (+12: 11 inventory/guard cases, 1 geometry case) and `WorkflowSoul.test.tsx` 8 → 18 (+10). `PhaseSpine.test.tsx` 11, `deriveTier.test.ts` 9, `soulData.test.ts` 49 and `WorkflowDoorSwitch.baseline.test.tsx` 17 all unchanged. **Zero deletions in any test file against the base** (`--numstat` reads `330 0` and `209 0`); the only deletions in the whole plan are the **7** in `PublishGauntlet.tsx`, which are the subtraction itself.

⚠ **The gate was RED once, and it was REAL, not a flake.** Procedure followed as written: failing filenames read from the gate's own persisted JSON **before** any re-run, each checked against `git diff --numstat`, cap left at 2. Neither failure was in SEED-171's five-suite set, and the mechanism was traced to a live import chain. **Red is not always a flake** — this is the `196-08` case, not the `195-02` one.

## Files this plan did NOT modify, and why

The plan's `files_modified` lists seven; **four needed no change**, which is stated rather than left silent:

- **`WorkflowSoul.tsx`** — byte-identical to base after CE-4's withdrawal (`--numstat` against `9a0379ba` is empty).
- **`PhaseSpine.tsx`** and **`PhaseSpine.test.tsx`** — measured, not modified. The sheet says nothing about the spine, and the atom is unchanged.
- **`soulData.ts`** — measured, not modified. No derivation moved, no vocabulary added; the `UNDETERMINED` sweep now covers it.

## For plan 199-08 (documented ordering dependency)

**No shared constant or vocabulary entry was exported.** Nothing in this plan adds a module-level export anywhere, so there is nothing for `199-08` to import by name.

What it **does** add, and may rely on, are **two new stable DOM hooks** on the shipped gauntlet spine in `frontend/src/components/workflows/PublishGauntlet.tsx`:

| Hook | Element | Count |
|---|---|---|
| `data-testid="spine-stage"` | the per-stage column (carries the `w-[48px]` budget) | 10 |
| `data-testid="spine-conn"` | the connector between two nodes (carries `w-[12px] sm:w-[16px]`) | 9 |

The test-only helpers `FORWARD_CONTROL_SELECTOR`, `OVERRIDE_NEEDLE` and `forwardControlsIn` are **local to `PublishGauntlet.test.tsx` and are not exported**. If `199-08` wants the same absence scan, it should copy the shape or a later plan should promote them to a shared test util — this plan deliberately did not create one for a single consumer.

## Deviations from Plan

### Auto-fixed / self-corrected

**1. [Rule 1 — Bug] The count gate went red on `WorkflowDoorSwitch.baseline.test.tsx` (2 cases)**
- **Found during:** Task 2 gate run
- **Issue:** BUILT-3's tier-chip re-tone changed a DOM pinned byte-for-byte by a third surface.
- **Fix:** the change was **withdrawn**, not re-baselined — the plan forbids re-baselining a characterization pin, and the pin's file is outside this plan's scope. Replaced by two tests that pin the coupling and today's state.
- **Files:** `WorkflowSoul.tsx` (reverted to base), `WorkflowSoul.test.tsx`
- **Commit:** `924b26f4`

**2. [Rule 1 — Bug] The `UNDETERMINED` sweep fired on this plan's own docblock prose**
- **Found during:** Task 2
- **Fix:** the prose was reworded; the fence was **not** exempted (`verdictModel.ts` `not-run` precedent).
- **Commit:** `724d0c60` (the withdrawn docblock went out with `924b26f4`)

**3. [Rule 1 — Bug] A Task-1 comment claimed `scale="card"` had no live consumer**
- **Issue:** inherited from the plan's `<planner_controls>`; measured false.
- **Fix:** corrected in place with the original preserved beside it, and pinned mechanically.
- **Commit:** `924b26f4`

### Deliberate declines

**4. The count-gate pins were left SLACK rather than raised.**
`PublishGauntlet.test.tsx` is pinned at **46** and actually ran **50** at the base — a pre-existing slack of 4, now 62. `WorkflowSoul.test.tsx` is pinned at 8, now 18. Pins are **floors** (`[count-decrease]` fires on `got < pinned`), so the gate is green and nothing is hidden. `scripts/vitest-count-gate.cjs` is a **G-5-firing shared guard file** and a sibling agent is active in this wave; `197-10` is the precedent for declining to edit a shared artifact mid-wave. **Exact values for a later single re-pin: `PublishGauntlet.test.tsx: 62`, `WorkflowSoul.test.tsx: 18`.**

## Out-of-scope observations (logged, not fixed)

- **`.vite-cache/` is untracked and NOT gitignored.** `scripts/bootstrap-worktree.sh:114` creates it in every worktree, and no rule in `.gitignore` covers it, so every worktree agent sees a permanent `?? .vite-cache/`. Not fixed here: editing the shared `.gitignore` mid-wave races the sibling agent for the same one-line addition. It was never staged (files are staged individually).
- **`RunLink` still renders "view coming soon"** (`IR-02`, deferred to D-103-A) although `WorkflowRunPage.tsx` now exists. Making it navigable is a **capability**, not a presentation change — out of this plan's fence, and not a sheet element.
- **A pre-existing `stash@{0}` exists on the shared stash stack.** Observed via `git stash list`, untouched — no `git stash` subcommand was run at any point (`refs/stash` is shared across worktrees, #3542).

## Known Stubs

None. No hardcoded empty value, placeholder string or unwired component was introduced; the only source deletions are the duplicated heading and the width literals it replaced.

## Threat Flags

None. No network endpoint, auth path, file access pattern or schema was touched. The plan's three registered threats are all **strengthened**, not weakened:

| Threat | Status |
|---|---|
| `T-199-03-01` elevation of privilege — no override past the judge wall | ✅ **strengthened.** The absence is now asserted over the whole rendered state across the full interactive role set, driven RED against a real plant, with permanent positive controls. Both prior guards were measured blind. |
| `T-199-03-02` tampering — authored strings stay plain React text children | ✅ **unchanged.** `WorkflowSoul.tsx` is byte-identical to base; no `dangerouslySetInnerHTML` was added anywhere. |
| `T-199-03-03` repudiation — the tier stays derived per render | ✅ **unchanged.** No stored or re-labelled strictness value exists; the sheet's re-label was refused and the derivation was not touched. |

## Success criteria

- **SC#1** every element of sheet c7 carries a verdict, none silently dropped — ✅ 16 rows above.
- **SC#2** no backend, migration, endpoint or wire model modified — ✅ `git diff --stat -- backend supabase` empty at every task.
- **SC#3** neither surface renders more at rest than before, proved against a pre-change inventory — ✅ the gauntlet renders strictly **less** (one heading cut, everything else retuned smaller); the soul is byte-identical.
- **SC#4** the mechanism is not printed to the user — ✅ no stage token, code or count reaches a headline; refusals are sentences from `verdictModel`.
- **SC#5** gates hold — ✅ tsc 33, count gate OK / failed 0, eslint clean.

## Self-Check: PASSED

Files claimed, verified on disk:

- `FOUND: frontend/src/components/workflows/PublishGauntlet.tsx`
- `FOUND: frontend/src/components/workflows/PublishGauntlet.test.tsx`
- `FOUND: frontend/src/components/workflows/WorkflowSoul.test.tsx`
- `FOUND: .planning/phases/199-the-component-map/199-03-SUMMARY.md`

Commits claimed, verified in `git log`:

- `FOUND: 5d5ebb02` — test(199-03): pin the gauntlet + soul resting inventory and the three unguarded sheet claims
- `FOUND: 724d0c60` — refactor(199-03): re-present the gauntlet strip and weight the soul's tier chip
- `FOUND: 924b26f4` — revert(199-03): withdraw the soul tier-chip weighting — it is a CANNOT-EXPRESS

No modification to `STATE.md` or `ROADMAP.md` (owned by the orchestrator).
