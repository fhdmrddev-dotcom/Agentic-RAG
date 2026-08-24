---
phase: 200-the-workflow-journey
plan: 04
subsystem: workflow-authoring-ui
tags: [DES-02, step-panel, WR-04, prototype-pollution, acceptance-checklist, hot-file-ledger]
requires:
  - "200-01 (the acceptance checklist §1 and its §6 baselines)"
  - "frontend/src/components/workflows/ownProperty.ts (the own() guard leaf)"
  - "frontend/src/components/workflows/modelFitness.ts, GovernanceSection.tsx, ModelField.tsx (composed, not rebuilt)"
provides:
  - "frontend/src/components/workflows/toolNames.ts — the ONE tool-id → human-phrase home, read through own()"
  - "frontend/src/components/workflows/StepCardSection.tsx + stepCardSectionContext.ts — sheet c4's card shell and its vocabulary"
  - "a step-panel MUST NOT RENDER fence PROVED able to fire against planted violations"
affects:
  - "frontend/src/components/workflows/PhaseFormPanel.tsx (the sole mount: WorkflowBuilderPage.tsx:2656)"
tech-stack:
  added: []
  patterns:
    - "component + sibling-leaf split for shared non-component exports (react-refresh/only-export-components; the FieldGuidance.tsx precedent, applied a second time)"
    - "role-SET + text-node DOM scan for MUST NOT RENDER, never a ?raw source regex"
    - "own() for every keyed presentation lookup; never a coalesced bracket read"
key-files:
  created:
    - frontend/src/components/workflows/toolNames.ts
    - frontend/src/components/workflows/toolNames.test.ts
    - frontend/src/components/workflows/StepCardSection.tsx
    - frontend/src/components/workflows/stepCardSectionContext.ts
  modified:
    - frontend/src/components/workflows/PhaseFormPanel.tsx
    - frontend/src/components/workflows/PhaseFormPanel.test.tsx
    - scripts/vitest-count-gate.cjs
    - CLAUDE.md
    - docs/HOT-FILE-LEDGER.md
decisions:
  - "SP-MR-03's per-folder lock state is NAMED AS A MISS, not faked — it is not on the wire"
  - "SP-MR-06 is satisfied in SUBSTANCE, not verbatim — the sketch's lock literal is not shipped copy"
  - "The three 199-06 density literals were overwritten LOUDLY, with the prior reading preserved and asserted against"
metrics:
  duration: ~75 min
  completed: 2026-08-19
  base_sha: eaebd66064bed56ee5bbb97e669673e0065d36af
---

# Phase 200 Plan 04: The Step Panel Summary

Sheet c4's `MODEL` / `WHAT IT CAN REACH` / `WHAT IT CHANGES OUTSIDE THIS WORKFLOW` cards composed from
parts that already shipped, human-named tool phrases replacing raw `snake_case` ids, and the **eighth
live WR-04 prototype-key sink** in this tree closed RED-first through `own()`.

## `step-panel: 13/14 atoms` — the miss is NAMED

`200-CHECKLIST.md` §1 carries **14** atoms (7 MUST RENDER + 7 MUST NOT RENDER). Thirteen are met.

| id | verdict | outcome |
|---|---|---|
| `SP-MR-01` | BUILD | ✅ tool list reads as phrases; coverage widened **3 → 28** offered ids |
| `SP-MR-02` | BUILD | ✅ `MODEL` card on all four model-bearing types, fitness on `llm_emit` only |
| `SP-MR-03` | BUILD | ⚠ **PARTIAL — the miss, named below** |
| `SP-MR-04` | BUILD | ✅ `WHAT IT CHANGES OUTSIDE` card + `NEEDS ARMING` + the sentence |
| `SP-MR-05` | VERIFY | ✅ driven on all four types, not grepped |
| `SP-MR-06` | VERIFY | ✅ in substance — see the wording note below |
| `SP-MR-07` | VERIFY | ✅ driven at the COLLAPSED reading |
| `SP-MNR-01` | BUILD | ✅ **fence driven RED by a plant** |
| `SP-MNR-02` | BUILD | ✅ **fence driven RED by a plant** |
| `SP-MNR-03` | BUILD | ✅ **fence driven RED by a plant** |
| `SP-MNR-04` | VERIFY | ✅ AUTH-04 re-asserted from inside the new card frame |
| `SP-MNR-05` | REPORT | ✅ recorded with trigger + its own needle control |
| `SP-MNR-06` | REPORT | ✅ recorded with trigger + its own needle control |
| `SP-MNR-07` | BUILD | ✅ both dead entries **deleted**, and which is said |

### ⚠ THE MISS — `SP-MR-03`'s per-folder lock state is NOT ON THE WIRE, and was not faked

The atom reads *"the folders it can read, **each with its lock state**"*. The card ships and the folders
render as NAMES (never a path). **The per-folder half does not, because no such fact exists**: `folder_scope`
is a bare `string[]` of ids and the only lock this product has is the STEP's grounding lock (`SP-MR-06`),
which is a property of the step, not of a folder. The sketch draws its per-folder locks as the Material
Symbols ligatures `Lock` / `lock` — which **N-5 forbids as visible text anyway**, so building the drawn form
would have promoted a known sketch defect to a criterion.

Inventing a per-folder padlock would have been a fabricated claim on a governance surface — the exact class
`199-05` refused and `SP-MNR-06` exists to prevent. **Reported rather than built.**
**⚠ Trigger:** *a phase that scopes per-folder access control (a lock fact carried per `folder_scope` entry
on the wire).*

### ⚠ A CHECKLIST WORDING DISAGREEMENT, STATED RATHER THAN GLOSSED — `SP-MR-06`

The atom names the literal `Locked — only the person who locked it can release it` and its source column says
it *"ships via 199-06's one-way grounding dial."* **Measured: that literal does not exist in `frontend/src`
at all** (`grep -rn "only the person who locked it"` → 0 hits). What ships is `GROUNDING_LOCK_REFUSAL` in
`definitionOps.ts` — a person-less lock statement in the product's own locked vocabulary.

The atom's substance (per N-7: the lock is stated **without naming a person**) is therefore satisfied, and
that is what the case asserts, positively (the refusal renders) and negatively (no `Locked by`, no
`Firstname L.` shape). **Authoring the sketch's literal was declined**: it would be a fifth spelling inside a
vocabulary that is a LOCK, which is how a lock stops meaning anything.

## The eighth WR-04 sink — the RED observation, verbatim, and it was WORSE than predicted

Driven against the **shipped** panel before `toolNames.ts` existed, with `available_tools: ["constructor"]` —
a value the author really can produce, because the non-rails variant's tool field is a **free-text comma
field** (`PhaseFormPanel.rails.test.tsx:90`):

```
stderr | Functions are not valid as a React child. ... <span>{Object}</span>
stdout | RENDERED CHIP TEXT >>> "ⓘ"
AssertionError: expected 'ⓘ' to contain 'constructor'
```

⚠ **The register predicted a FUNCTION returned into JSX. What actually happens is that React REFUSES the
child, so the chip's label renders as NOTHING AT ALL** — a tool the step really names vanishes from the list
of what that step can do. `[Function Object]` would at least have been visible. The correction is recorded in
`toolNames.ts`'s docblock and in the ledger rather than left as the prediction.

**Also measured and corrected:** `friendlyToolName` had **5** entries, of which only **3** name an id
`get_tools(None)` ever offers. `fetch_url` and `list_folders` are **deleted** (`SP-MNR-07`) — a phrase for an
id nothing offers is invisible until somebody counts. Coverage is now asserted as a **set difference** against
all 28 offered ids, so a tool added server-side fails a test rather than reaching a business user as a schema
token. The inherited *"3 of 27"* is stale and is not quoted anywhere in the output.

## The fence was DRIVEN RED against real plants, then restored byte-exactly

Wave 3 found a fence that was VACUOUS — reached, and still writing nothing. `199-03` measured a `?raw` source
regex **and** a `queryAllByRole("button")` filter both green against a live planted violation. So this fence
reads the **rendered DOM** (text nodes + a seven-role control set), and it was planted before it was trusted:

| plant | file | result |
|---|---|---|
| `<span>chevron_right</span>`, `<span>lock</span>`, `GPT-4o` | `StepCardSection.tsx` | `llm_single: expected [ …(3) ] to deeply equal []` — **3 violations, one per class** |
| tool rail rendering `{t}` instead of `{toolName(t)}` | `PhaseFormPanel.tsx` | `expected [ 'search_documents', …(3) ] to not include 'search_documents'` |

Both files restored via `git checkout --` (byte-exact from HEAD; `git status` clean on each), **116/116 green
after restore.** Two non-vacuity controls are committed permanently: a planted-violation case that must find
all three classes, and a deliberate-absence case proving the predicate does **not** fire on honest copy
(`Order is locked`, `Folders it can read`) — so nobody ever has to delete a true sentence to go green.

⚠ **Scope is what makes the needles honest, and both scopes are argued in the block's docblock.** `SP-MNR-01`
is scoped to the TOOL LIST because the ⓘ carries the exact technical term in `title`/`aria-label` **by design**
(Phase 103-ux) — a whole-panel scan would be red on shipped behaviour and its "fix" would be deleting a true
affordance. Half the Material Symbols vocabulary is ordinary English (`lock`, `add`, `search`, `folder`), so
those fire **only** when a text node's entire content IS the ligature; the underscored names are matched as
substrings.

## D-11 — the ABSOLUTE-ZERO hook pin passed UNEDITED, and it is MEASURED

```
$ diff <(git show <parent>:…/PhaseFormPanel.test.tsx | sed -n '/196-08 picker mounts/,/^})$/p') \
       <(sed -n '/196-08 picker mounts/,/^})$/p' …/PhaseFormPanel.test.tsx)
PIN BLOCK BYTE-IDENTICAL   (220 lines)

$ grep -cE 'use(State|Memo|Effect)\(' …/PhaseFormPanel.tsx     → 0
$ git diff -U0 -- …/PhaseFormPanel.test.tsx | grep -c '^-.*ABSOLUTE zero'  → 0
```

Honoured **by EXTRACTION**: `StepCardSection.tsx` + `stepCardSectionContext.ts` are the `199-06` /
`FieldGuidance.tsx` precedent applied a second time. **The cards hold no state at all** — and the reason is
SEED-184 rule 3 rather than economy: two of the three carry DECISIONS (`What it can reach`, `What it changes
outside this workflow`), and a decision may never be folded behind a click. Leaf sprawl is the accepted,
stated cost (D-11).

**Every deletion in the pin file, all four, listed:**

```
-import { fireEvent, render, screen } from "@testing-library/react"     (widened with `within`)
-      agent: { helpLines: 0, helpChars: 0, proseChars: 1381 },
-      emit:  { helpLines: 0, helpChars: 0, proseChars: 1363 },
-    expect(open).toEqual({ helpLines: 5, helpChars: 234, proseChars: 1618 })
```

Task 3's own diff on that file is **`+292 / −0`** — no assertion deleted.

## Deviations from Plan

### 1. [Rule 2 — correctness] The three 199-06 density literals moved, and were overwritten LOUDLY

- **Found during:** Task 2, the moment the card titles rendered.
- **Issue:** `PhaseFormPanel.test.tsx` pins `proseChars` by exact equality. A phase that composes named card
  sections and then reports its prose volume unchanged has either not built them or has silently deleted
  something else to pay for them.
- **Fix:** `1381 → 1403`, `1363 → 1385`, `1618 → 1640`. The 199-06 reading is preserved as
  `DENSITY_AT_199_06` **and asserted against**, so *"still quieter than the panel that shipped"* stays a
  COMPUTED claim rather than an inherited one.
- ⚠ **The delta accounts for itself with NO RESIDUAL on all three readings:** `+22` = `"Model"` (5) +
  `"What it can reach"` (17), pinned in the test as `CARD_TITLE_CHARS` and asserted as an exact difference.
  **`helpLines` and `helpChars` are UNMOVED at `0 / 0`** — so 199-06's actual claim, the SUBTRACTION, is
  untouched and is re-asserted explicitly.
- **Commit:** `91286ab9`

### 2. [Rule 3 — blocking] `--reporter=basic` does not exist in this vitest

- The plan's three `<verify>` blocks all pass `--reporter=basic`. On vitest `4.1.0` that is a **startup
  error**, not a formatting nicety: `Failed to load custom Reporter from basic → Failed to load url basic`.
  Every verify command was run without the flag. **Later plans in this phase should drop it.**

### 3. [scope] `stepCardSectionContext.ts` holds a VOCABULARY, not a React context

- The plan named the file for the `FieldGuidance` split and expected disclosure state. No disclosure state
  exists (see D-11 above — SEED-184 rule 3 forbids it here), so the leaf carries the section vocabulary and
  `outsideChangeSentence()` instead. **The naming constraint still bound and is why the suffix stayed:** a
  leaf differing from its component sibling only in case is a hard TS1149/TS1261 on this box.

### 4. [observation] The wrong-base fork fired again — a fourth consecutive wave

`git merge-base HEAD eaebd660` returned `3781a3fe`, not the dispatched base. The startup assertion corrected
it with `git reset --hard`. **Four for four across this phase's waves.**

### 5. [observation] `PhaseFormPanel.rails.test.tsx:484` was measured, and it does NOT constrain new leaves

Its fence asserts `phaseFormPanelSource` contains none of the three capability names, and the
`import.meta.glob` scan at `:526` forbids any OTHER module exporting a `PhaseForm*` / `PhaseConfigForm*` /
`StepForm*` component. `StepCardSection` and `toolNames` clear both. The capability sentences reach the card
by **import** from `phaseVocabulary`, never re-spelled.

## Threat Flags

None. No new network endpoint, auth path, file access pattern or schema change. Every threat in the register
is mitigated as specified:

| Threat | Status |
|---|---|
| `T-200-04-01` prototype-key sink in `friendlyToolName` | ✅ closed through `own()`, **observed RED first** |
| `T-200-04-02` any new keyed lookup | ✅ `outsideChangeSentence` routes through `own()`; no coalesced bracket read added (`grep -cE '\]\s*\?\?'` on the new leaves → 0) |
| `T-200-04-03` fabricated consequence copy | ✅ `SP-5` REPORTED; a fence asserts no grouped-thousands figure, no `overwrite N`, no `N records` — with a control proving the needles fire on the sketch's own literal |
| `T-200-04-04` absent-registry arm | ✅ AUTH-04 re-asserted from **inside** the new card frame, on all four types |
| `T-200-04-05` a re-baselined pin | ✅ the pin block diffs BYTE-IDENTICAL; the density literals that did move are preserved beside their replacements and asserted against |
| `T-200-04-SC` package installs | ✅ none; no `package.json` or lockfile touched |

## Verification — measured, with the baseline beside each figure

| Check | `200-CHECKLIST.md` §6 baseline | measured now |
|---|---|---|
| `node scripts/vitest-count-gate.cjs` (repo root, cap 2) | `4970 · failed 0 · pinned 4543 · 96/96` | **`count gate OK — total 5000 · failed 0 · pinned total 4589 · 97/97`**, first run |
| `tsc -p tsconfig.app.json --noEmit` | `33 errors / 19 files` | **33 / 19**, none of them this phase's files |
| `src/components/workflows` (whole dir) | — | **65 files / 3792 tests, 0 failing** |
| `WorkflowBuilderPage.*` (5 suites) | — | **290 / 290** |
| `PhaseFormPanel.test.tsx` + `.rails` + `toolNames` | — | **116 / 116** |
| `node scripts/check-claude-md-size.cjs` | — | **OK — 87,853 chars, 58.6% of limit** |

⚠ **The gate's growth closes with NO RESIDUAL, which is what distinguishes growth from drift:**
pinned `4543 → 4589` is `+46` = `toolNames.test.ts` **+10** (an ADD) and `PhaseFormPanel.test.tsx`
**38 → 74 = +36** (a RAISE). Grand `4970 → 5000` is `+30` = the same file's actual `54 → 74` (+20) plus the
new suite's 10.

⚠ **The pin-file deletion count is EXACTLY 1, and the asymmetry is why:** ADDING a pin is `+n / −0`; RAISING
one necessarily deletes a line. `git diff -U0 -- scripts/vitest-count-gate.cjs | grep -c '^-[^-]'` → `1`.

**SEED-171 was never entered** — the cap held at `2` on every invocation and nothing red ever appeared. Two of
its five named flaky suites (`WorkflowBuilderPage.session.test.tsx`, `WorkflowBuilderPage.canvas.test.tsx`)
are adjacent to this plan's blast radius and were green on the first run of every invocation. **Recorded as an
observation, not as proof of innocence.**

**D-12 honoured:** `git diff --numstat eaebd660 HEAD | grep -c WorkflowDoorSwitch` → **0**. The doors screen is
deferred; its byte-for-byte pin was never approached.

## Self-Check: PASSED

```
FOUND: frontend/src/components/workflows/toolNames.ts
FOUND: frontend/src/components/workflows/toolNames.test.ts
FOUND: frontend/src/components/workflows/StepCardSection.tsx
FOUND: frontend/src/components/workflows/stepCardSectionContext.ts
FOUND: e342b044  feat(200-04): tool phrases get ONE home, and the EIGHTH WR-04 sink is closed RED-first
FOUND: 91286ab9  feat(200-04): sheet c4's card sections, composed from parts that already ship
FOUND: dec1223a  test(200-04): the step-panel MUST NOT RENDER fence, DRIVEN RED against real plants
```

## Known Stubs

None. Every card section renders from a fact that already arrives; nothing is wired to a hardcoded empty
value, and the two facts that are genuinely absent (`SP-MR-03`'s per-folder lock, `SP-5`'s row count) render
**nothing at all** rather than a placeholder — asserted in both directions.
