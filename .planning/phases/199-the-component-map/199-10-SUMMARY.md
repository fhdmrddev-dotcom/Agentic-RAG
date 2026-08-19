---
phase: 199-the-component-map
plan: 10
subsystem: ui
tags: [react, tailwind, workflows-library, toolbar, run-dialog, fork-dialog, delete-sheet, graded-action-guards, design-system, stitch, characterization-pin, derived-baseline]

requires:
  - phase: 178-stitch-component-map (sketch)
    provides: "sheet c6-library-dialogs — the toolbar on one shared baseline, the card system (already built), the run dialog, the fork dialog, the delete sheet"
  - phase: 192 / 192.1 / 192.2
    provides: "the four shipped surfaces this plan re-presents (LibraryToolbar, RunModal, ForkNameDialog, WorkflowDeleteSheet), their one vocabulary home, and the card half of sheet c6 which 192.2 already built"
  - phase: 146-148
    provides: "the graded action-guards rule (victim-naming sheet / arm-to-confirm / direct flip) this plan turns from prose into an assertion"
provides:
  - "A verdict for every element of sheet c6 — BUILT, ALREADY-SHIPPED, ALREADY-BUILT, REFUSED, DECLINED or CANNOT-EXPRESS, none silently dropped"
  - "Two removals and zero additions on the two surfaces this plan changed: the create control's mechanism-naming sub-line, and the run dialog's decorative page glyph"
  - "The graded action-guard ladder as a LIVE ASSERTION — delete scores 4/4 guard atoms, fork 0/4, ordering strict. Nothing in the repository compared the two surfaces before"
  - "A pre-change resting inventory of the toolbar and the run dialog, as literals, so 'renders no more at rest' is measured rather than claimed"
  - "The two refused sheet elements (Target nodes / Estimated time) as live rendered-DOM fences with positive controls, not as notes in a summary"
  - "A DERIVED-BASELINE technique for characterization pins: delete one substring named in advance from the committed captures, then let the suite refute the derivation"
affects: [workflows-library, workflow-launch, 199-verification]

tech-stack:
  added: []
  patterns:
    - "A characterization pin updated by DERIVATION, not re-capture: the delta is specified in advance and applied to the committed strings, so the suite can REFUTE it. Strictly stronger than 193-07's measured re-capture, which reads the new output and writes it down"
    - "Guard GRADE as a number: four detector functions, scored over rendered markup for two surfaces, with a strict ordering assertion. A cross-surface invariant that neither surface's own suite could hold"
    - "Where jsdom cannot measure (no layout), assert a STATED class-level surrogate — no reversing flex direction, no order-* utility — and name the real check as an owed G-4 row"

key-files:
  created:
    - .planning/phases/199-the-component-map/199-10-SUMMARY.md
  modified:
    - frontend/src/components/workflows/library/LibraryToolbar.tsx
    - frontend/src/components/workflows/library/RunModal.tsx
    - frontend/src/components/workflows/library/LibraryToolbar.test.tsx
    - frontend/src/components/workflows/library/ForkNameDialog.test.tsx
    - frontend/src/pages/__tests__/RunModal.test.tsx
    - frontend/src/pages/__tests__/PublishedCardDelete.test.tsx

key-decisions:
  - "DEC-199-10-A — sheet c6's `Target nodes: production-cluster` and `Estimated time: ~45s` are REFUSED, and the refusals SHIP AS FENCES rather than as sentences in this file. A refusal recorded only in a summary is one a later plan re-adopts by reading the sheet and not the summary. Both detectors run over the rendered modal in all six captured states, each with a positive control that fires on the sheet's own strings."
  - "DEC-199-10-B — the create control's sub-line (`Describe it in plain English → AI drafts it`) is CUT. It named the mechanism, which is the third of the three rules sketch 178 put into the design system's designMd, and the purpose survives the cut in `Build a workflow` alone. Proved by inverting the Task-1 pin from present to absent, never by deleting it."
  - "DEC-199-10-C — the create control is re-skinned to the toolbar's ONE affirmative treatment on the search field's `h-9` baseline (sheet c6's 'one shared baseline'), and the sheet's PLACEMENT is refused: c6 puts create last behind an `ml-auto`, D-02 says it leads, and a visual demotion that left DOM order intact would be a keyboard regression in the other direction. Both orders are now asserted."
  - "DEC-199-10-D — the run dialog's `aria-hidden` page glyph is CUT. It reached nobody using a screen reader by its own attribute, and it said `document` about a workflow, which is the invented-category-glyph drift icon-convention §4 forbids. Same reasoning 199-07 applied to the empty panel's Inbox mark."
  - "DEC-199-10-E — the six whole-innerHTML captures were updated by DERIVATION, not re-capture. The rule (delete exactly `<span aria-hidden=\"true\">📄</span>`) was specified before the edit; the script REFUSED to run unless that substring occurred in exactly six committed captures; the suite then re-rendered and compared byte for byte. A re-capture ratifies whatever the edit did — a derivation is a claim the tests can refute."
  - "DEC-199-10-F — the delete sheet and the fork dialog are BYTE-UNCHANGED. Sheet c6's drawings of both are POORER than what ships, and its one genuinely different move is refused (see DEC-199-10-G). The deliverable on this pair is therefore the COMPARISON, which nothing in the repository had ever made."
  - "DEC-199-10-G — the sheet's victim-in-the-title (`Delete Daily Summary Extraction?` against the shipped `Delete this workflow?`) is REFUSED on a mechanical reason, not an aesthetic one. The title renders BEFORE the preview resolves, so it could only be fed from `wf.name` — the list feed's cached copy — while the consequence line is fed from `preview.name`, fetched at open. Adopting it would put two sources for one victim's name on one surface, with the earlier, larger and more prominent one being the stale one."
  - "DEC-199-10-H — the project select's visible `PROJECT` micro-label is CONSIDERED AND DECLINED, stated rather than silently kept. The sheet's selects carry no external label because their resting option self-labels (`All Projects`), and the shipped resting option does too — but the SELECTED state renders a bare folder name (`Risk`) which does not. The sheet draws only the resting state, so it has no answer for the case that would break."

patterns-established:
  - "Pattern: a NEW fence can be vacuous in a way its positive control does not catch. `wearsDestructiveWeight` passed against a plant that stripped the resting `bg-destructive`, because `hover:bg-destructive/90` survived on the same element. The plant is what found it; the control alone would not have."
  - "Pattern: a plan's own must_have wording is a claim to VERIFY. Two of this plan's were measured false — a name-check state that does not exist, and a typecheck criterion that was already false at the dispatched base."

requirements-completed: [DES-01]

duration: ~45min
completed: 2026-08-19
---

# Phase 199 Plan 10: The Library Toolbar and its Three Dialogs (sheet c6) Summary

**Sheet `c6-library-dialogs` reconciled element by element against the four shipped surfaces a person passes through to launch, copy or destroy a workflow — with two removals shipped and nothing added, the sheet's infrastructure identifier and fabricated estimate refused as live rendered-DOM fences rather than as notes, and the graded action-guard ladder that D-15 and D-18 have been arguing in prose since Phase 192 turned into a strict numeric ordering the repository can now refute.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 3 / 3
- **Files modified:** 6 (2 source, 4 test) — `+781 / −18`
- **Commits:** 3

| Commit | What |
|---|---|
| `1bb1d931` | `test(199-10)` — the toolbar and run-dialog resting inventories pinned as literals, before any source byte moved |
| `1198cf42` | `fix(199-10)` — the sub-line and the page glyph removed; both Task-1 pins inverted; the six captures derived |
| `410c589a` | `test(199-10)` — the guard grade asserted; both source files byte-unchanged |

## ⚠ The base-drift hazard fired again — SEVEN for seven

`git merge-base HEAD 4b8efd7d` returned **`3781a3fe`**, the same tree that predated the dispatched base on all six prior runs of this phase and contains none of Waves 1–2's work. The prompt's assertion caught it; `git reset --hard 4b8efd7d` corrected it, and the corrected HEAD was verified before Task 1 began. **This is the DEFAULT behaviour of this dispatch path, not an intermittent fault.**

---

## The reconciliation table — every element of sheet c6, one verdict

### 1 · The toolbar → `library/LibraryToolbar.tsx`

| # | Sheet element | Verdict | Reason / evidence |
|---|---|---|---|
| 1 | Search field with a leading magnifier, on the row's shared baseline | **ALREADY-SHIPPED · baseline ADOPTED** | the field is always-on (D-06) at `h-9`. The magnifier is DECLINED — an added mark on a control whose placeholder already says what it is |
| 2 | **The create affordance as the row's one filled, affirmative control** | ✅ **BUILT** — DEC-199-10-C | was a two-line DASHED box, the skin of the build-CARD it replaced; now one line, `h-9`, `bg-primary`. Colour chain fenced (see below) |
| 3 | Create placed LAST, behind an `ml-auto` | ⚠ **REFUSED** | D-02's structural fix for SC#4 says create LEADS. A visual demotion that left DOM order intact is a different regression from a DOM demotion that leaves the visual intact — **both** are now asserted |
| 4 | The create control's sub-line | ✅ **BUILT — by REMOVAL** — DEC-199-10-B | *"Describe it in plain English → AI drafts it"* named the mechanism. The sheet draws no sub-line either |
| 5 | An `Any Status` select | ⚠ **REFUSED — the shipped instrument is stronger** | six independently-toggleable counted chips (D-03), including a chip whose count is **0** and still renders. A single-select cannot express two simultaneous narrowings, and it cannot answer *"are there any?"* |
| 6 | `285 ITEMS`, mono, right-aligned | ⚠ **REFUSED** | an addition at rest, and a WORSE number: the chips already carry six honest counts computed over the rows actually rendered. One grand total replaces six specific answers with one vague one |
| 7 | `All Projects` select | **ALREADY-SHIPPED** | plus the D-17 sentence the sheet has no concept of (*starters aren't tied to a project*), wired by `aria-describedby` as real DOM text |
| 8 | *(not drawn)* the visible `PROJECT` micro-label | ⚠ **CONSIDERED AND DECLINED** — DEC-199-10-H | removing it is defensible at rest and wrong when selected: the select then reads a bare `Risk`. The sheet draws only the resting state |
| 9 | *(not drawn)* the quiet `updating…` marker, the way out of an over-filtered list, the D-08 search hint | **FLAGGED, KEPT** | three honest atoms the sheet has no vocabulary for. **A sheet drawing fewer states is not an argument for shipping fewer** |

### 2 · The workflow card system → `library/WorkflowCard.tsx`

| # | Sheet element | Verdict | Reason / evidence |
|---|---|---|---|
| 10 | Empty name · failed run on the card · three identical titles adjacent · running · unbound · starter · hover-to-Run | **ALREADY-BUILT (Phase 192.2)** | the card renders sketch 179 variant C — the run gutter, the NAME leading line 1, the run truth then the state in business words. **`WorkflowCard.tsx` and `WorkflowsPage.tsx` were NOT modified** (`git diff --numstat` → empty), and `WorkflowCard.baseline.test.tsx` is byte-unchanged and still passes unedited |

### 3 · The run dialog → `library/RunModal.tsx`

| # | Sheet element | Verdict | Reason / evidence |
|---|---|---|---|
| 11 | **`Target nodes: production-cluster`** | ⚠ **REFUSED — and FENCED** — DEC-199-10-A | infrastructure vocabulary printed to a business reader. DES-01's own clause: *the mechanism is never printed to the user* |
| 12 | **`Estimated time: ~45s`** | ⚠ **REFUSED — and FENCED** — DEC-199-10-A | a determinate estimate nothing in this system computes; the same class of fabricated precision as sheet c3's `(4/12)`, which the sketch's own README names as the batch's one fabricated-progress defect |
| 13 | `Sequence length: 3 phases` | ⚠ **DECLINED** | the client HAS the number, so this is a real option — but it is an ADDITION at rest on a surface this phase is removing from, and the dialog's job is to collect the run's inputs, not to describe the workflow the person just chose |
| 14 | Header reading `Execute {name}` | ⚠ **REFUSED (the verb)** | this product's word for this action is **Run**, and it is already the button's word. `Execute` is the machine's |
| 15 | The header's decorative page glyph | ✅ **BUILT — by REMOVAL** — DEC-199-10-D | `aria-hidden`, so it reached nobody using a screen reader; and it said *document* about a workflow |
| 16 | The mono "spec" block as a shape | ⚠ **REFUSED** | mono is this product's typeface for machine identifiers. A block of facts about the run, set in it, is the mechanism wearing a face |
| 17 | Cancel + a filled primary in the footer | **ALREADY-SHIPPED** | and the shipped primary is `▶ Run workflow` |
| 18 | *(not drawn)* the KB-scope select, the staged template upload, the kickoff textarea, the provenance line, the honest destination line | **ALREADY-SHIPPED, and the sheet has no concept of any of them** | the destination line in particular reads the SAME canvas gate the launch reads, so the copy cannot drift from the behaviour |

### 4 · The fork dialog → `library/ForkNameDialog.tsx`

| # | Sheet element | Verdict | Reason / evidence |
|---|---|---|---|
| 19 | A name field | **ALREADY-SHIPPED** | |
| 20 | **PREFILLED with `Invoice OCR Processing (Copy)`** | ⚠ **REFUSED** | D-19 clause 1: the field opens EMPTY. **A prefilled name is a confirmation wearing an input's clothes**, and the whole reason it is legal to interrupt a harmless action with this prompt is that it collects something the system cannot know |
| 21 | `Name available`, green, with a check mark | ⚠ **REFUSED — the shipped state is stronger** | the shipped hint says the state in WORDS. Now PROVEN: the three states stay mutually distinct with every `class` **and** `style` attribute stripped off the rendered DOM |
| 22 | A `Fork Workflow` title and button | ⚠ **REFUSED** | `fork` is the machine's word. The shipped pair is `Name your copy` / `Create my copy` |
| 23 | *(implied by "availability check")* a **still-checking** state | ⚠ **CANNOT-EXPRESS** — see below | |
| 24 | *(not drawn)* the consequence sentence, the clash WARNING that never blocks | **ALREADY-SHIPPED** | |

### 5 · The delete sheet → `library/WorkflowDeleteSheet.tsx`

| # | Sheet element | Verdict | Reason / evidence |
|---|---|---|---|
| 25 | `This will permanently remove 12 historical runs and 5 configured phases.` | **ALREADY-SHIPPED, and HEAVIER than the drawing** | shipped splits **Removed** from **KEPT**, states exact server counts for both, and adds the `✎` audit receipt the drawing has no concept of |
| 26 | **The victim named in the TITLE** | ⚠ **REFUSED — mechanically** — DEC-199-10-G | the title renders before the preview resolves, so it could only come from the list feed's cached `wf.name`. Two sources for one victim, the more prominent one stale. Asserted: while the preview is in flight the sheet **names no victim at all**, and once loaded the name appears **exactly once**, inside the Removed group |
| 27 | A red wash over the whole panel | ⚠ **REFUSED** | the graded rule spends danger colour on the ACTION, not on the notice — which is also why the in-flight banner is amber and never red |
| 28 | Cancel + a destructive primary | **ALREADY-SHIPPED** | `Keep it` / `Delete forever` |
| 29 | *(not drawn)* the amber cancel-first banner, the in-place lifecycle, the audit receipt, the no-optimistic-vanish rule | **ALREADY-SHIPPED · now GRADED** | all four guard properties re-asserted after the phase, and the ladder itself asserted |

---

## The delete guard's four properties, re-asserted after the change

`WorkflowDeleteSheet.tsx` is **byte-unchanged** (`git diff --numstat` → empty), and each property is asserted individually so a failure names which one went:

| # | Property | How it is now asserted |
|---|---|---|
| 1 | Exact server counts fetched BEFORE the destructive action is offered | the **loading** state offers no `delete-forever` and shows no `N versions` / `N run records`; the loaded state does offer it — so the absence is ORDERING, not a dead control |
| 2 | The victim is named | `Permanently removed` and the row's name, in that order, in the loaded capture — once, from the preview |
| 3 | The amber cancel-first banner rises ONLY when a run is live | absent on `loadedZeroThreads`, present on `loadedInFlight`, and **amber not red** |
| 4 | No optimistic vanish, no undo | the behavioural halves were already driven in this file; ADDED is the negative a re-presentation could introduce without touching behaviour — no `Undo` / `Restore` on the terminal state |

**And the ladder itself, which nothing in the repository had ever asserted:**

| Surface | guard atoms scored | |
|---|---|---|
| delete sheet | **4 / 4** | exact counts · victim named · destructive weight at rest · audit receipt |
| fork dialog | **0 / 4** | and it offers exactly two controls, with `onCreate` reached on the FIRST click |
| ordering | `heavy − light === 4`, strict | a *"both are heavy"* reading would be satisfied by exactly the drift D-15 forbids |

---

## CANNOT-EXPRESS — the fork's "still checking" state

**What the sheet asks for.** c6 draws the fork's name field with an *availability check* — `✓ Name available` — which is the visual language of a lookup that can be in flight. This plan's own task list asks that *available · taken · **still checking*** stay mutually distinguishable and that *"still checking must never read as either verdict."*

**What the component can do.** `isClash` is a **synchronous** `(name: string) => boolean`, passed IN by the page (D-21) and evaluated over the caller's own already-loaded rows during render. It has no pending arm, no promise, and nothing to await. The three states that exist are **empty · clash · free**, and each carries its own imported sentence.

**The gap.** A real availability check is a server round trip against a name index. That is a backend change **and** a new user-facing capability, both fenced out of this presentation-only phase. Faking it — a spinner over a synchronous predicate — would be a determinate claim about a lookup that never happens, which is the same defect class as the `~45s` this plan refused two surfaces earlier.

**What shipped instead.** The three real states are asserted mutually distinct with all paint stripped, and a fourth assertion pins the synchronous contract at the boundary a later plan would cross: `isClash` is **not called at all** on an empty field, and if it were ever made asynchronous a returned promise would coerce truthy and silently read as CLASH for every name. That is where the change will be noticed.

---

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 — Bug] My own re-presentation comment RED a fence that had nothing to do with paint**

- **Found during:** Task 2, on the first full verification run.
- **Issue:** `librarySubtree.fences.test.ts`'s **F6 scoping control** is a RAW `source.includes(...)` over the swept modules, and its subject word is a substring of the obvious plural synonym for *colour names*. A comment explaining that the create control's colours resolve therefore added `./LibraryToolbar.tsx` to a measured list about a **draft's opaque field**: `expected [ './LibraryToolbar.tsx', …(4) ] to deeply equal [ './WorkflowCard.tsx', …(3) ]`.
- **Fix:** the PROSE was reworded, and the fence's measured list was **NOT** widened. Widening it would have put a paint comment into a record about data handling — a false positive inside a security-adjacent measurement is worse than an awkward sentence. The reason is now recorded in the comment itself, so the next author does not rediscover it.
- **Files modified:** `frontend/src/components/workflows/library/LibraryToolbar.tsx` (`grep -c token` → **0**).
- **Commit:** `1198cf42`. The 187-24 trap, which this subtree has now recorded a **fifth** time.

**2. [Rule 1 — Bug] A brand-new fence of mine passed against the exact plant it was written to catch**

- **Found during:** Task 3, driving the guard-grade fence RED.
- **Issue:** `wearsDestructiveWeight` was a bare `/bg-destructive/`. Planted defect: strip the resting `bg-destructive` off the `Delete forever` control. **The characterization captures went red and my new fence did not** — because `hover:bg-destructive/90` survived on the same element and satisfied the substring.
- **Why it matters beyond the test:** a guard whose danger colour exists **only on hover** is no guard at all on a touch device — D-14's rule, arriving from an unexpected direction.
- **Fix:** the detector now requires the utility at a class boundary with no variant prefix, and gained a control asserting that a hover-only danger colour scores **false** while the shipped both-arms shape scores **true**. Re-driven against the same plant: the grade fence and the ordering assertion both went red.
- **Commit:** `410c589a`.

### Measured refutations of this plan's own claims

**1. The fork has no "still checking" state and cannot have one in this phase.** Reported in full above rather than quietly satisfied by asserting only the two states that suit.

**2. Task 2's typecheck criterion was ALREADY FALSE at the dispatched base.** It reads *"reports 33, ZERO under `components/workflows/library/` or `pages/`."* Measured at the base and unchanged at HEAD: **33 errors**, **0** under `components/workflows/library/` — but **3 under `src/pages/`**, all pre-existing in `SettingsPage.tsx` / `SettingsPage.test.tsx` and part of the inherited 33. The criterion is satisfied in the sense that matters (this plan added no error and moved no count); the wording was not checkable as written.

### Deferred, with a named re-open trigger

**The run dialog's `run-hint` line** renders declared `input_keys` as raw machine identifiers in a mono face — `This workflow expects: kickoff_prompt`. That is the mechanism printed to the user, on the same surface where two sheet elements were refused for exactly that. It is **not** cut here because, unlike the glyph, it is the only place the dialog says what the workflow needs, and replacing it needs a words decision nobody has taken. **Re-open trigger: the next plan that touches `RunModal.tsx`'s body, or any phase that gives input keys an authored label.**

---

## Threat model — dispositions discharged

| Threat ID | Disposition | Evidence |
|---|---|---|
| T-199-10-01 (EoP · the delete sheet) | **mitigated** | four guard properties asserted individually before and after; the grade ordering asserted strictly; both fences driven RED against a real plant and restored by md5 (`89e8ee46…`, `1a794c31…`). The sheet is byte-unchanged |
| T-199-10-02 (Spoofing · the run dialog) | **mitigated** | no fabricated estimate and no infrastructure identifier ship — asserted over the rendered modal in all six captured states, with positive controls firing on the sheet's own two strings |
| T-199-10-03 (Tampering · the `library/` subtree) | **not applicable, stated** | **no new module was created**, so `LIBRARY_SUBTREE_PATHS` needed no entry. Confirmed by `git status` across all three commits: six modified files, zero added |

**Threat surface scan:** no new network endpoint, auth path, file access or schema surface. `git diff --stat -- backend supabase` is **EMPTY** at every task.

---

## Gates

| Gate | Base | HEAD |
|---|---|---|
| `tsc --noEmit -p tsconfig.app.json` | 33 errors | **33 errors** — unmoved; 0 under `components/workflows/library/` |
| count gate (repo root, `GSD_VITEST_MAX_WORKERS=2`) | OK · 96/96 · failed 0 · total 4888 · pinned 4543 | **`count gate OK` — 96/96 pinned files present, no per-file decrease, 0 failing · total 4923 · pinned total 4543** |
| `git diff --stat -- backend supabase` | — | **empty** |
| `WorkflowCard.tsx` / `WorkflowsPage.tsx` / `WorkflowCard.baseline.test.tsx` | — | **byte-unchanged** (`git diff --numstat` → empty) |
| `.planning/STATE.md` / `.planning/ROADMAP.md` | — | **untouched** |
| assertion deletions vs the dispatched base | — | **0** (the four `expect(` lines removed in `1198cf42` are this plan's OWN Task-1 pins, each replaced by its inversion one commit later) |

⚠ **SEED-171 observation, recorded rather than rounded off.** Two of the five known-flaky suites — `library/WorkflowCard.test.tsx` and `pages/WorkflowsPage.test.tsx` — sit in this plan's blast radius. Both are **provably unmodified** (`git diff --numstat` → empty) and both were green on the first run of every invocation. The cap was held at `2` throughout and never adjusted. **The one red run of this plan was REAL, not a flake, and so was the second** — both were found by procedure (read the failing filenames, check them against the diff) rather than by re-running.

---

## Owed — a G-4 lived-experience UAT row

**jsdom runs no layout**, so `getBoundingClientRect()` returns zeroes for every node and a geometric "create is leftmost" check would read `0 <= 0` and pass on a reversed row. What is asserted instead is a **stated class-level surrogate**: the toolbar declares no `flex-*-reverse` and no `order-*` utility anywhere in its subtree, so DOM order IS paint order by construction.

**Owed row:** open the Workflows library at a narrow viewport and confirm by eye that the filled `Build a workflow` control is the first thing on the row and stays on the search field's baseline as the row wraps — the one thing this plan changed that no automated check in this repository can see.

## Self-Check: PASSED

- `.planning/phases/199-the-component-map/199-10-SUMMARY.md` — FOUND
- `frontend/src/components/workflows/library/LibraryToolbar.tsx` — FOUND
- `frontend/src/components/workflows/library/RunModal.tsx` — FOUND
- `frontend/src/components/workflows/library/LibraryToolbar.test.tsx` — FOUND
- `frontend/src/components/workflows/library/ForkNameDialog.test.tsx` — FOUND
- `frontend/src/pages/__tests__/RunModal.test.tsx` — FOUND
- `frontend/src/pages/__tests__/PublishedCardDelete.test.tsx` — FOUND
- commit `1bb1d931` — FOUND
- commit `1198cf42` — FOUND
- commit `410c589a` — FOUND
