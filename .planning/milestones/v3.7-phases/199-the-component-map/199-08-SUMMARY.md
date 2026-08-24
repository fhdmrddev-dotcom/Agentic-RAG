---
phase: 199-the-component-map
plan: 08
subsystem: ui
tags: [react, tailwind, vitest, workflow-doors, describe-box, design-system, stitch, characterization-testing, a11y]

# Dependency graph
requires:
  - phase: 124
    provides: the two-door authoring fork, its trimmed-length CTA gate, and the soul preview
  - phase: 187
    provides: DescribeKbPicker and D-187-14 — the fast door gains a MOUNT, not a SURFACE
  - phase: 193
    provides: doorVocabulary.ts (D-10/D-11/D-24(a)), DoorHeaderStrip.tsx (D-04's restack), and the byte-for-byte WorkflowDoorSwitch.baseline pin
  - phase: 193.1
    provides: DescribeTemplateRow, templateFirstVocabulary, TemplateNameCheck
  - plan: 199-03
    provides: the ordering dependency — the soul this door mounts at `scale="card"`, landed first
provides:
  - a describe box that REFUSES OUT LOUD, in a state absent from every resting capture
  - DESCRIBE_REFUSAL — the 23rd governed door id, and the constant 199-09 imports in wave 3
  - a pre-change resting inventory of the whole door surface, pinned as LITERALS
  - the measured verdict that 15 of sheet c9's 17 colour tokens compile to nothing here
  - four CANNOT-EXPRESS reports, each in three parts, each pinned mechanically
  - a refutation of this plan's own claim about TemplateNameCheck.tsx
affects: [199-09, WorkflowDoorSwitch, doorVocabulary, the Builder's pre-draft describe box]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inventory-then-invert: pin an absence PRESENT in commit N, flip its polarity in commit N+1, never delete the query"
    - "A conditional class list spelled as a CONCATENATION so the unconditional arm is character-identical to what shipped (the `ml-auto` idiom)"
    - "A spread-conditional attribute so the resting markup carries no `aria-*=\"false\"`"
    - "Class-free readings: compare what a PERSON reads (text + chosen row + control count), never innerHTML, when a `<select>` is in the picture"

key-files:
  created: []
  modified:
    - frontend/src/components/workflows/WorkflowDoorSwitch.tsx
    - frontend/src/components/workflows/doorVocabulary.ts
    - frontend/src/components/workflows/WorkflowDoorSwitch.test.tsx
    - frontend/src/components/workflows/doorVocabulary.test.ts
    - frontend/src/components/workflows/DoorHeaderStrip.test.tsx
    - frontend/src/components/workflows/DescribeKbPicker.test.tsx
    - frontend/src/components/workflows/DescribeTemplateRow.test.tsx
    - frontend/src/components/workflows/TemplateNameCheck.test.tsx

key-decisions:
  - "The sheet's VAGUENESS verdict is REFUSED — no predicate in this product reads an input for vagueness, so that caption would print a verdict nothing computes"
  - "The refusal renders only on a NON-EMPTY refused input, so it never greets anyone and the resting DOM stays byte-identical"
  - "The picker's third reading is REFUSED on three independent grounds, one of them mechanical (the byte-for-byte pin)"
  - "Sheet §5 is a DIFFERENT COMPONENT — starter-workflow pills, not the document-to-fill-in row"
  - "Sheet §6 is unbuildable without a backend capability — no name-availability seam exists in the client at all"
  - "The hot-file ledger was NOT edited mid-wave; the re-derived triples are recorded here with exact values"

patterns-established:
  - "A plan claim about which component ships which states is a claim to VERIFY — this one matched on a NAME and was false"
  - "A CANNOT-EXPRESS is stronger when the absence is swept over the api client with non-vacuity than when it is asserted in prose"

requirements-completed: [DES-01]

# Metrics
duration: 42min
completed: 2026-08-19
---

# Phase 199 Plan 08: The Doors & The Describe Surface Summary

**The describe box now says out loud what it has silently refused since Phase 124, in a state that appears on no resting capture — and the other five sheet elements came back as one ALREADY-SHIPPED, one already-honest, and four CANNOT-EXPRESS reports, including one that refutes this plan's own claim about which component ships the sheet's name check.**

## Performance

- **Duration:** ~42 min
- **Tasks:** 3/3
- **Files modified:** 8 (2 source, 6 test)
- **Source deletions across the whole plan:** **1** — the textarea's single class-list line, replaced by its concatenated form

## ⚠ Worktree base correction FIRED — six for six in this phase

The dispatched base was **not** an ancestor of the worktree's HEAD:

```
git merge-base HEAD c6371d9b…   →   3781a3fe4690a9619e619f4cc412bd37a7dafc52   ← ≠ c6371d9b
```

`git reset --hard c6371d9b` applied and verified (`git rev-parse HEAD` → `c6371d9b…`). This is the identical `3781a3fe` the prompt named, and the identical value `199-03` recorded. **The assertion is the only thing that catches it.** All measurements below are against `c6371d9b`.

## The reconciliation table — sheet `c9-doors-describe` vs the shipped surface

Every element of the sheet carries a verdict. **None is silently dropped (SC#1).**

### §1 The door switch

| # | Sheet element | Shipped | Verdict |
|---|---|---|---|
| D1 | two cards at rest | two cards, each with a tier line, a name, a description, an `Open ›` and an italic footnote | **ALREADY SATISFIED** — ours says strictly more per card, and every word is governed. Inventory-pinned as eight literals. |
| D2 | "left chosen" / "right chosen": both cards stay on screen, the unpicked one dimmed to `opacity-60` and `cursor-not-allowed` | picking a door REPLACES the chooser with that door's surface, plus a header strip naming the door you are in | ⛔ **REFUSED — a different interaction model.** The sheet keeps a chooser on screen forever; ours spends the whole width on the work. Adopting it would add resting surface (against this plan's own must_have #4) and would move a DOM pinned byte for byte. **And the sheet's dimmed card reads as DISABLED (`cursor-not-allowed`) when it is in fact still reachable** — a false claim about our own affordance. Our answer to "which door am I in?" is §2's strip, which is stronger: it is text. |
| D3 | door names *Describe it* / *Build it*, subtitles *What do you want to achieve?* / *Architect from zero* | column D of `doors-copy.generated.md`, settled by Phase 193 after a whole phase on this exact question (SEED-147) | ⛔ **REFUSED** — words are imported, never re-spelled, and re-opening a governed literal is what D-13 and the 166-C precedent already declined. |
| D4 | Material Symbols glyphs (`auto_awesome`, `account_tree`) | ⚡ / 🔧, matching the strips and the switch row | ⛔ **REFUSED** — Material Symbols are not in the shipped icon convention. `199-03` refused the identical substitution one sheet earlier. |

### §2 The door header strip

| # | Sheet element | Shipped | Verdict |
|---|---|---|---|
| S1 | a return control, then the current method | exactly that, plus the locked-judge badge at the far edge | ✅ **ALREADY SHIPPED (Phase 193, D-04's restack).** Verified, not rebuilt — 4 new cases; **`DoorHeaderStrip.tsx` is byte-unmodified**, asserted mechanically (this phase's tag appears nowhere in it). |
| S2 | the label is a PROGRESS word — *"Describing workflow…"*, *"Manual composition…"* | the door's own NAME, echoed back (D-23) | ⛔ **REFUSED** — that caption asserts an activity in flight on a strip that renders while nothing is running. Same class as `199-03`'s determinate-progress refusal. Swept: the shipped label ends in no ellipsis and carries no `-ing`, with a positive control on both sheet captions. |
| S3 | an ICON-ONLY return button whose only name is a `title` | a worded control | ⛔ **REFUSED** — a `title` is not a name a keyboard user can read without hovering. Pinned: the control's accessible text is non-empty. |

### §3 The describe box

| # | Sheet element | Shipped | Verdict |
|---|---|---|---|
| B1 | EMPTY: a bordered box with a placeholder | exactly that | **ALREADY SATISFIED** — inventory-pinned. |
| B2 | FILLED | exactly that | **ALREADY SATISFIED.** |
| B3 | **REFUSAL — the box SAYS why, instead of only disabling a button** | the CTA has been gated since Phase 124 and **said nothing at all** | ✅ **BUILT** — the plan's headline row. See below. |
| B4 | the refusal's caption is a VAGUENESS verdict (*"Request too vague · Needs a goal and a source"*) over the real sentence *"Automate my emails."* | no predicate in this product reads an input for vagueness | ⛔ **REFUSED** — see CE-1. |
| B5 | the refusal is drawn in `error` tone | `destructive`, the shipped token | ✅ **BUILT, re-toned** — the sheet's `error`/`error-container` compile to nothing here. Tone is the SECOND carrier; the sentence is the first (WCAG 1.4.1). |

### §4 The knowledge picker

| # | Sheet element | Shipped | Verdict |
|---|---|---|---|
| K1 | NONE CHOSEN | the opt-out row selected in a labelled `<select>` | **ALREADY SATISFIED** — pinned as a class-free reading. |
| K2 | ONE CHOSEN | the folder's name selected | **ALREADY SATISFIED** — pinned. |
| K3 | the chosen chip states a DOCUMENT COUNT (`1,284 docs`) | the wire's `Folder` row carries id / user_id / name / parent_id / is_org_shared / two timestamps | ⛔ **CANNOT-EXPRESS** — see CE-2. |
| K4 | **NONE AVAILABLE — a chip that SAYS so, ending in an upload control** | renders nothing at all; the reason lives in a `hidden`+`aria-hidden` marker | ⛔ **REFUSED on three grounds** — see CE-3. **And the honest cost is pinned, not described.** |
| K5 | a `×` to clear the chosen folder | the opt-out row is the first option | **ALREADY SATISFIED** by a different affordance. |

### §5 The template row

| # | Sheet element | Shipped | Verdict |
|---|---|---|---|
| T1 | a rail of starter-WORKFLOW pills (`Invoice Audit · 4 phases`) | `DescribeTemplateRow` attaches **the document this workflow will fill in** | ⛔ **CANNOT-EXPRESS — a different noun** — see CE-4. |
| T2 | the arms must read apart | five arms, each with its own testid and its own sentence | ✅ **VERIFIED** — proved distinct with every `class` stripped, positive control included. ⚠ This is the pair that *may never merge* (`none` = "we opened it, it has no fields" vs `unavailable` = "we never opened it"), and a class-free comparison is the only one that proves they are told apart by **words**. |

### §6 The name check

| # | Sheet element | Shipped | Verdict |
|---|---|---|---|
| N1 | available / already taken / still checking, on the workflow's own name | `TemplateNameCheck` buckets the **template document's field names** | ⛔ **CANNOT-EXPRESS**, and **the plan's claim about this file is FALSE** — see CE-5. |
| N2 | the three states must be distinguishable | three worded bucket labels | ✅ **VERIFIED without colour** — no colour utility carries meaning anywhere in the rendered tree. |

## THE BUILT ROW — the refusal, said out loud

**The finding Task 1 was written to settle: does a gating predicate already exist?** It does, and it is measured two ways rather than assumed — `describe.trim().length > 0` read off the source, and driven (`""` refuses · `"   \n\t  "` refuses · real text passes). So **saying so out loud is presentation and was BUILT**; had no predicate existed, inventing one would have been behaviour and the row would have been a report.

`DESCRIBE_REFUSAL` — *"There is nothing here to draft from yet — describe the work in a sentence."* — lands in `doorVocabulary.ts` as the **23rd governed id** and the **second post-contract one**. Four properties, each mechanical:

1. **It changes no rule.** `canDraft` is untouched and never consults the new expression. Pinned across five inputs, enablement byte-for-byte the shipped predicate on every arm.
2. **It never greets anyone.** The trigger carries a `length > 0` term *as well as* the trim, so an untouched empty box — refused by the same rule — stays silent. Without that term the refusal would appear on the first screen an author meets, and would change a DOM three suites pin.
3. **The resting class list is character-for-character the shipped one.** The conditional is spelled as a **concatenation**, the `DoorHeaderStrip.tsx` `ml-auto` idiom copied in kind: three slots move and the token count does not. Asserted against the literal shipped string.
4. **`aria-invalid` is ABSENT at rest, not `"false"`** — a spread-conditional, this file's own idiom.

⚠ **It covers only the FIRST term of `canDraft`, deliberately.** The second (`templateRead.kind !== "loading"`) already speaks: the attach row renders its own in-flight line. A second sentence here would be a second home for one fact. Pinned in Task 1 so the row covers both terms rather than the one the sheet drew.

## The RED drive — the widened copy fence, driven against a real plant

Adding a 23rd needle widens the D-24(a) sweep, so it was driven RED before being trusted. Plant: a comment carrying the refusal literal, inside `WorkflowDoorSwitch.tsx`.

```
FAIL  ./WorkflowDoorSwitch.tsx carries none of the 22 governed words, in either spelling
AssertionError: expected [ 'DESCRIBE_REFUSAL/plain' ] to deeply equal []
```

Restored; `grep -c "PLANT:"` → `0`. The `22` in that failure line was itself the reason to touch it: the case title is a hand-typed count, and it moved to `23` in the same commit as `GOVERNED_ID_COUNT` and the needle-set size — **three spellings of one fact, all moved together**, because a count that moves on its own is a table nobody checked.

## CANNOT-EXPRESS reports (three parts each, as required)

### CE-1 · The sheet's refusal caption prints a verdict nothing computes

- **What the sheet asks for:** the refusing box captioned *"Request too vague · Needs a goal and a source"*, over the real, grammatical sentence *"Automate my emails."*
- **What the component can do:** refuse an input that is blank once its whitespace comes off. That is the whole of the shipped rule.
- **The gap:** no predicate anywhere in this product reads an input for vagueness, or for having "a goal and a source". Shipping that caption would claim a judgement nothing makes — the same class of dishonesty `199-03` refused one sheet earlier for the sheet's `UNDETERMINED` tier. Building the predicate would be **new behaviour**, outside the fence. **Guarded rather than promised:** the shipped string is swept for `vague|too short|too long|invalid|unclear|error|quality|specific enough`, with a positive control that fires on the sheet's own caption.

### CE-2 · The chosen-folder chip states a count the wire never carries

- **What the sheet asks for:** `📁 Legal · 1,284 docs`.
- **What the component can do:** render the folder's name. The live `Folder` row is `id / user_id / name / parent_id / is_org_shared / created_at / updated_at`.
- **The gap:** there is no count to render, so the figure could only be fabricated — fabricated precision beside a real name is exactly what this project refuses everywhere else. Closing it needs a server-side count on the folder list: a **wire-model change**, outside the fence. Pinned by walking the fixture's own keys for anything count-shaped, plus a sweep of the rendered text for `N docs`.

### CE-3 · The picker's "none available" reading, refused on three grounds

- **What the sheet asks for:** a visible chip reading *"No knowledge bases"* with an **Upload Knowledge** control beside it.
- **What the component can do:** it already holds "there are none" and "we could not ask" apart as distinct states — through a `hidden` + `aria-hidden` marker that reaches a test and never a person.
- **The gap, and it is three independent gaps:**
  1. **A recorded ruling already governs it.** Phase 187 (D-187-14 / SC#4) settled that the fast door gains a **mount, not a surface**: with nothing to offer, this control renders nothing, and ignoring it gives today's behaviour exactly. Where the sheet and a shipped locked decision disagree, the shipped one wins.
  2. **Mechanical, and decisive on its own.** The zero-folder arm sits inside all six `WorkflowDoorSwitch.baseline.test.tsx` captures. A visible row here reds a characterization pin, and re-baselining one to make a red go green is forbidden in terms.
  3. **The sheet's chip ends in an ACTION.** *Upload Knowledge* is a navigation capability, not a sentence — outside a presentation phase.
- ⚠ **AND THE COST IS PINNED RATHER THAN DESCRIBED.** A new case measures that the third and fourth states are **distinct to a machine and identical to a person** (`unavailableReading` deep-equals `noneReading`; both texts are `""`). A later plan that closes this gap must **flip that assertion**, which is the difference between a recorded gap and a rediscovered one.

### CE-4 · Sheet §5 is a different noun

- **What the sheet asks for:** a horizontal rail of starter-WORKFLOW pills — a name and a phase count, pressed to open one.
- **What the component can do:** attach **the document this workflow will fill in**, and render what that document asks for. Not a missing feature — a different noun that happens to share the word *template*.
- **The gap:** our nearest analogue to the sheet's rail is the starter-workflow door on the **Builder's** pre-draft screen (a quiet worded trigger opening a list, not a rail of pills), and that surface lives in **`199-09`'s file**, which this plan may not touch. Adopting the sheet's shape *here* would build a second, contradicting meaning for "template" two inches from the first — the exact collision **D-21 already ruled on for this screen's own label**.

### CE-5 · Sheet §6 is a backend capability — and the plan's claim about this file is FALSE

- ⚠ **THE PLAN SAYS:** *"`TemplateNameCheck.tsx` already ships all three states; verify rather than rebuild."* **Verified, and it is false of the tree.** The plan matched on the component's NAME:

  | | sheet c9 §6 | `TemplateNameCheck.tsx` |
  |---|---|---|
  | subject | the WORKFLOW's own name / slug | the TEMPLATE DOCUMENT's field names |
  | states | available · already taken · still checking | produced · run-input · named nowhere |
  | nature | a uniqueness VERDICT from the server | a local HEURISTIC over names |
  | control | an editable text input | no input at all — read-only output |

- **What the sheet asks for:** a name field that says, live, whether a name is free, taken, or still being checked.
- **What the component can do:** nothing adjacent. And the shortfall is not this component's: **no name-availability check exists anywhere in the client** — swept over `@/lib/api?raw` for `checkWorkflowName` / `isNameAvailable` / `nameAvailable` / `checkSlugAvailable`, all absent, behind a non-vacuity guard so the four negatives are not `"".includes`.
- **The gap:** closing it needs a server endpoint answering *"is this name taken?"* — a **backend capability**, outside the fence. The third state is additionally unbuildable without it: a spinner over a request nobody makes is theatre.

## Sheet c9's colour palette — measured before any of it was copied

⚠ **FIFTEEN of the sheet's SEVENTEEN colour tokens compile to NOTHING against `frontend/tailwind.config.js`.** Only `background` and `primary` resolve; `error`, `error-container`, `on-surface`, `on-surface-variant`, `outline`, `outline-variant`, `surface`, `surface-variant`, `surface-container-{low,lowest,high}`, `on-background`, `primary-container`, `primary-fixed` and `tertiary-fixed-dim` are declared in neither `tailwind.config.js` nor `index.css`. A class that compiles to nothing renders **identically to an arm nobody painted** — the `bg-warning` silent no-op that shipped unguarded in 192.2.

This is now a fence rather than a paragraph: the config is read through `vi.importActual("node:fs")` (not `?raw`), non-vacuity is asserted first, and the detector carries a positive **and** a negative control. Every token this plan spends — `destructive`, `border`, `muted`, `foreground`, `primary`, `card` — is asserted to resolve.

## Measurements

| Gate | Baseline (prompt) | Measured | Verdict |
|---|---|---|---|
| `tsc --noEmit -p tsconfig.app.json` | 33 | **33** | unmoved; **0** under `components/workflows/` |
| count gate (repo root, `GSD_VITEST_MAX_WORKERS=2`) | OK · 96/96 · failed 0 · total 4836 · pinned 4543 | **OK · 96/96 · failed 0 · total 4876 · pinned 4543** | **+40, fully attributed** |
| `git diff --stat -- backend supabase` | empty | **empty** at every task | scope fence holds |
| eslint (all 8 changed files) | — | clean | |

**The +40 closes with no residual:** `WorkflowDoorSwitch.test.tsx` 44 → 67 (**+23**: 16 inventory/reconciliation, 7 refusal) · `DoorHeaderStrip.test.tsx` 16 → 20 (**+4**) · `doorVocabulary.test.ts` 41 → 42 (**+1**, the per-id exact-match loop gaining its 23rd row) · `DescribeKbPicker.test.tsx` 37 → 41 (**+4**) · `DescribeTemplateRow.test.tsx` 42 → 45 (**+3**) · `TemplateNameCheck.test.tsx` 29 → 34 (**+5**). `WorkflowDoorSwitch.baseline.test.tsx` **17, unchanged**, and `templateNameBuckets.test.ts` unchanged.

⚠ **The gate never went red, on any run, at any point in this plan.** SEED-171's triage procedure was never entered and the cap was left at `2` throughout. Recorded as an observation, not as proof of innocence — no suite in SEED-171's five-file set was edited by this plan.

**Count-gate pins were left SLACK rather than raised**, following `199-03`'s decision in the same phase: `scripts/vitest-count-gate.cjs` is a G-5-firing shared guard file and a sibling agent is active in this wave (`197-10` precedent). Pins are floors, so nothing is hidden. **Exact values for a later single re-pin:** `WorkflowDoorSwitch.test.tsx: 67` · `DoorHeaderStrip.test.tsx: 20` · `doorVocabulary.test.ts: 42` · `DescribeKbPicker.test.tsx: 41` · `DescribeTemplateRow.test.tsx: 45` · `TemplateNameCheck.test.tsx: 34`.

## ⚠ `WorkflowDoorSwitch.baseline.test.tsx` — NOT re-baselined, and it never went red

The pin holds all six resting door states **byte for byte**, including this door's textarea and the zero-folder picker arm. It is **absent from `git diff --numstat` against the base**, which is the mechanical form of "byte-unchanged", and its 17 cases passed on every run.

Two design choices exist *because* of it, and both are better designs on their own terms: the refusal renders only on a non-empty refused input (so it never greets anyone), and the class list is a concatenation (so the unconditional arm is the shipped string). **Neither was a compromise made to keep a test green** — but the pin is what forced them to be stated rather than assumed.

## Hot-file ledger — re-derived, and NOT edited (stated, not silent)

| File | ledger says | **re-derived at HEAD** | note |
|---|---|---|---|
| `frontend/src/components/workflows/WorkflowDoorSwitch.tsx` | `12 / 8 / 522` · FIRES · honoured by construction (193 / 193.1) | **`13 / 9 / 575`** | stale by 1 commit / 1 phase / 53 L — **this plan's own delta**. G-5 still FIRES; **honoured by construction** here (one new expression, one new import, one concatenated class list, one gated `<p>`; no second concern introduced). |
| `frontend/src/components/workflows/doorVocabulary.ts` | ⚠ **NO ROW AT ALL** | **`4 / 3 / 341`** | ⚠ **FIRES — EXACTLY AT THRESHOLD, and it is ABSENT from the scan list**: the `libraryRow.ts` state, where a missing row costs most. **No seam proposed** — a vocabulary doing one thing 23 times is the right shape — but the audit could not *ask*, which is the cost. |

**The ledger and `CLAUDE.md` were NOT edited.** Both are shared artifacts and a sibling agent is active in this wave; `197-10` and `199-03` are the precedents for declining mid-wave. The same-commit sync rule means a row and its `docs/HOT-FILE-LEDGER.md` section must move together, which is a two-file edit on the two hottest shared documents in the repo. **Owed, with exact values above so the edit is transcription rather than re-derivation.**

## For plan 199-09 (the downstream obligation)

**The constant, named exactly as asked:**

| | |
|---|---|
| **Export name** | `DESCRIBE_REFUSAL` |
| **Module path** | `frontend/src/components/workflows/doorVocabulary.ts` |
| **Import specifier** | `@/components/workflows/doorVocabulary` (or `./doorVocabulary` from within `components/workflows/`) |
| **New or pre-existing** | **NEW** — created by this plan, `199-08` |
| **Value** | `"There is nothing here to draft from yet — describe the work in a sentence."` (em dash U+2014) |
| **Rendered by** | `WorkflowDoorSwitch.tsx` only, at `data-testid="describe-refusal"` |

**Three obligations that come with importing it, all mechanical:**

1. ⚠ **`WorkflowBuilderPage.tsx` IS ALREADY A SWEPT SOURCE of the D-24(a) copy fence.** Spelling the sentence there instead of importing it turns that fence red — which is the fence working. A second spelling of a governed string is how a governed string stops being governed.
2. **Two counts move together with any 24th id:** `GOVERNED_ID_COUNT` in `doorVocabulary.test.ts` **and** the needle-set size + case title in `WorkflowDoorSwitch.test.tsx`. All three are one fact read from two files.
3. ⚠ **The Builder's pre-draft box is NOT gated the way this door's is — verify before assuming.** This plan pinned only that `WorkflowBuilderPage.tsx` contains no `DESCRIBE_REFUSAL` today and that its box carries the same placeholder but **no `data-testid="describe-box"`**. Whether its CTA carries an equivalent trimmed-length predicate is **not measured here**, and `199-09` must measure it: if it does, the sentence is presentation there too; **if it does not, adding one is behaviour and belongs in a report, not a build.**

**Coupling found and NOT acted on:** `WorkflowBuilderPage.tsx:1917` renders the second pre-draft describe box (`placeholder="Describe the goal in plain language…"`, `data-testid="describe-hint"`). That duplication is what sheet c9's header strip designs out, it is **shipped**, and this phase neither introduces nor closes it. The file was not touched — absent from this plan's diff.

## The 199-03 ordering dependency — read, and its warnings confirmed

- **No shared constant or vocabulary export exists in `199-03`.** Confirmed in its SUMMARY and by this plan's own reading: nothing was imported from it by name, and nothing was created to make a sentence true.
- **`WorkflowDoorSwitch.tsx:451` still mounts `<WorkflowSoul scale="card" />`** and `WorkflowDoorSwitch.baseline.test.tsx` still pins that DOM byte for byte. Confirmed live: the pin is unmodified and green, and the soul block appears verbatim inside two of the six captures.
- `199-03`'s two new DOM hooks (`spine-stage`, `spine-conn`) are on the publish gauntlet and were **not needed** here; no absence scan was copied.

## Deviations from Plan

### Auto-fixed / self-corrected

**1. [Rule 1 — Bug] The D-24(a) case TITLE carried a hand-typed count that would have read false**
- **Found during:** Task 2, from the RED drive's own failure line (`carries none of the 22 governed words`)
- **Fix:** moved to `23` in the same commit as the two other spellings of that number.
- **Commit:** `756805ef`

### Deliberate declines

**2. The hot-file ledger and `CLAUDE.md` were not edited mid-wave.** Shared artifacts, sibling agent active; exact re-derived values recorded above (`197-10` / `199-03` precedent).

**3. The count-gate pins were left slack rather than raised.** Same file, same reason; pins are floors, exact values published above.

**4. `WorkflowBuilderPage.tsx` was not touched** — owned by `199-09`, per the plan's own file-ownership seam. The plan's Task-1 instruction to *record* the second describe box as owned-by-199-09 was honoured by pinning it in the suite rather than by editing it.

## Out-of-scope observations (logged, not fixed)

- **`.vite-cache/` is untracked and NOT gitignored** — `scripts/bootstrap-worktree.sh` creates it in every worktree. Already logged by `199-03`; still true, still not fixed for the same reason (editing the shared `.gitignore` mid-wave races the sibling agent for a one-line addition). It was never staged; files are staged individually.
- **A pre-existing `stash@{0}` exists on the shared stash stack.** Untouched — **no `git stash` subcommand was run at any point** (`refs/stash` is shared across worktrees, #3542).
- **`DoorHeaderStrip.tsx` still carries its pre-extraction indentation** (a deliberate 193-03 non-tidy). Left alone; re-indenting is the one change that would make an otherwise-empty diff non-empty.

## Known Stubs

None. No hardcoded empty value, placeholder string or unwired component was introduced. The one new rendered node is gated on a real, driven predicate and reaches its words by import.

## Threat Flags

None. No network endpoint, auth path, file access pattern or schema was touched — the plan's three registered threats are all **held or strengthened**:

| Threat | Status |
|---|---|
| `T-199-08-01` tampering — describe text and soul strings stay plain React text children | ✅ **held.** The one new node renders an imported constant as a text child; no `dangerouslySetInnerHTML` anywhere in the diff. |
| `T-199-08-02` elevation — the shell adds no API call and no tier re-derivation | ✅ **held.** The shipped red-line tests pass unmodified; the diff adds one boolean expression, one import and one `<p>`. Zero api symbols added anywhere. |
| `T-199-08-03` spoofing — "none available" and "none chosen" render distinct readings | ⚠ **held for the pair the threat names, and the WEAKNESS BESIDE IT IS NOW MEASURED rather than assumed.** *None-chosen* and *none-available* are pairwise distinct with every class stripped, so nobody can believe they grounded against a source never offered. But *none-available* and *we-could-not-ask* are distinct only to a machine — pinned, so a later plan flips an assertion instead of rediscovering the gap. |

## Success criteria

- **SC#1** every element of sheet c9 carries a verdict, none silently dropped — ✅ **20 rows** across six sections.
- **SC#2** no backend, migration, endpoint or wire model modified — ✅ `git diff --stat -- backend supabase` empty at every task.
- **SC#3** the door surface renders no more at rest than before, proved against a pre-change inventory — ✅ the resting DOM is **byte-identical** (the baseline pin is absent from the diff); the one new node cannot render at rest by construction.
- **SC#4** the mechanism is not printed to the user — ✅ the refusal names what is missing and what to do; no predicate, no threshold, no token reaches a headline.
- **SC#5** gates hold — ✅ tsc 33 (0 under `components/workflows/`), count gate OK / failed 0 / no per-file decrease, eslint clean.

## Self-Check: PASSED

Files claimed, verified on disk:

- `FOUND: frontend/src/components/workflows/WorkflowDoorSwitch.tsx`
- `FOUND: frontend/src/components/workflows/doorVocabulary.ts`
- `FOUND: frontend/src/components/workflows/WorkflowDoorSwitch.test.tsx`
- `FOUND: frontend/src/components/workflows/doorVocabulary.test.ts`
- `FOUND: frontend/src/components/workflows/DoorHeaderStrip.test.tsx`
- `FOUND: frontend/src/components/workflows/DescribeKbPicker.test.tsx`
- `FOUND: frontend/src/components/workflows/DescribeTemplateRow.test.tsx`
- `FOUND: frontend/src/components/workflows/TemplateNameCheck.test.tsx`
- `FOUND: .planning/phases/199-the-component-map/199-08-SUMMARY.md`

Commits claimed, verified in `git log`:

- `FOUND: 3fef5b40` — test(199-08): pin the doors' resting inventory and the sheet c9 reconciliation
- `FOUND: 756805ef` — feat(199-08): the describe box refuses OUT LOUD, and adds no rule doing it
- `FOUND: bf413cc1` — test(199-08): reconcile the picker, the template row and the name check against sheet c9

No modification to `STATE.md` or `ROADMAP.md` (owned by the orchestrator).
