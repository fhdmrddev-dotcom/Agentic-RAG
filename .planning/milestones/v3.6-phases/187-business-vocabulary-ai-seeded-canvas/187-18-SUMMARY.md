---
phase: 187-business-vocabulary-ai-seeded-canvas
plan: 18
subsystem: frontend/workflow-builder
tags: [vocab-01, wr-03, d-183-06, d-187-04, d-187-05, d-184-11, gap-closure, tdd]
requires:
  - "phaseVocabulary.nodeTitle — THE one title resolution, plans 183-02 + 187-04"
  - "definitionOps.minimalPhaseFor / PHASE_TYPE_ORDER — the caller's own phase builder, plan 184-07"
  - "phaseVocabulary.derivedFace tier (4) — the human-input face, plan 187-04 / D-187-04"
provides:
  - "a ＋ menu row that is a PREVIEW of the card it creates, not a description of it"
  - "a row↔card agreement test that measures against the resolver instead of against a string"
  - "a five-type blast-radius control derived by filtering PHASE_TYPE_ORDER"
  - "a source fence pinning zero sentence-map reads in the picker, with two positive controls"
affects:
  - "nothing downstream — five of the six rows are byte-identical to HEAD and the sixth now matches the card that already shipped"
tech-stack:
  added: []
  patterns:
    - "a preview surface resolved over the object the caller will really build, not over a hand-written literal"
    - "a blast-radius control that asserts what did NOT change, derived by filtering the shipped order"
    - "a whole-frame toEqual over all six types, so a failure prints the shape of the disagreement"
key-files:
  created:
    - ".planning/phases/187-business-vocabulary-ai-seeded-canvas/187-18-SUMMARY.md"
  modified:
    - frontend/src/components/workflows/StepTypePicker.test.tsx
    - frontend/src/components/workflows/StepTypePicker.tsx
decisions:
  - "Took the reviewer's fix (a) — the picker asks `nodeTitle` — and REJECTED (b), editing `PHASE_TYPE_SENTENCES.llm_human_input` and deleting `derivedFace` tier (4). Re-checked at live HEAD against the design contract: `references/node-vocabulary-and-reveal.md` lists the ladder as `bound skill → template → folder → human input → \"Wait for your approval\" → null`, i.e. the human-input sentence is a DERIVATION TIER, and the type sentence is the honest floor beneath it. Fix (b) would edit a locked D-183-06 value AND delete a tier the contract names — changing the design to hide a consumer bug."
  - "The preview is built with `minimalPhaseFor`, not a hand-written literal. The picker's own D-184-11 docblock states the caller derives the slug with `slugForType` and builds the phase with `minimalPhaseFor` after `onChoose`, so the row now previews the REAL card rather than an approximation. No new module edge: the picker already imported from `definitionOps`."
  - "No `?? choice.type` floor was kept. `nodeTitle` already echoes an unknown type honestly (`PHASE_TYPE_SENTENCES[type] ?? type`), and a second fallback in the consumer is the same defect class this plan removes — a second answer free to disagree."
  - "`PREVIEW_SLUG` is the empty string and the preview passes the real `index`. Both are inert to `nodeTitle` (never-print-a-slug floor), and that inertness is ASSERTED rather than assumed by a case that resolves the same types over a different slug and index."
  - "The five unchanged types are derived by `PHASE_TYPE_ORDER.filter(...)`, never hand-typed, and the filter's length is asserted to be 5 — so a seventh type cannot leave the blast-radius control silently under-covering."
  - "STATE.md was NOT written by this executor. The orchestrator owns STATE/ROADMAP writes; its in-flight edit was left untouched and unstaged, along with the unrelated `.claude/` tooling modifications."
metrics:
  duration: ~25 min
  tasks: 2
  commits: 2
  completed: 2026-08-02
---

# Phase 187 Plan 18: The ＋ menu stops contradicting the card it creates — Summary

The author read **"Check with you"** in the menu, clicked it, and the card that landed said
**"Wait for your approval"** — two sentences for one choice, one click apart, both sourced from the
module whose whole premise is that title resolution has ONE home. The row now asks the resolver the
card asks, so the two agree by construction rather than by coincidence.

## What Was Built

**Task 1 — the falsification (commit `c85eb14d`, `test(...)` RED gate)**

The shipped case *"labels every row with its D-183-06 plain-language sentence"* expected
`PHASE_TYPE_SENTENCES[type]`, read straight out of the vocabulary map. That expectation was the
defect wearing a test's clothes: it asserted the picker agreed with the map, when the question that
matters is whether the picker agrees with the **card**. It was re-derived, not deleted — the
expectation is now `nodeTitle(minimalPhaseFor(type, …))`.

Seven net-new cases (36 → 43):

- **the agreement, as one frame** — `PHASE_TYPE_ORDER.map(type => [type, rowTitle(type)])`
  compared by `toEqual` against the same map over `cardFaceFor`, so a failure prints the whole shape
  of the disagreement rather than only its first member;
- **slug/index independence** — `nodeTitle(minimalPhaseFor(type, "zz-some-other-slug", 3))` equals
  the preview, closing the gap between the placeholder this suite invents and whatever the component
  picks;
- **the blast-radius control** — for the five types other than `llm_human_input`, the row title is
  still byte-identical to `PHASE_TYPE_SENTENCES[type]`. The five-member list is derived by
  `PHASE_TYPE_ORDER.filter(...)` with its length asserted, never hand-typed;
- **the named defect, both halves** — the human-input row equals the derived face AND does not equal
  the type sentence AND its text does not contain it, plus a **non-vacuity** assertion that the two
  strings really do differ, so `not.toBe` cannot silently become a tautology;
- **a row-shape guard** — for all six types, `row.textContent === title + PHASE_TYPE_SUBTITLES[type]`,
  which is what licenses the `rowTitle()` helper to read the title by structure (the title carries no
  testid of its own);
- **the subtitle is untouched** — still `PHASE_TYPE_SUBTITLES`, still beaten by the refusal reason,
  and the TITLE still previews the card on a refused row;
- **the source fence** — zero occurrences of the sentence-map identifier in the picker source, with
  positive controls for `nodeTitle` and `minimalPhaseFor` and a negative for any local
  `const *SENTENCE*` table. The forbidden identifier is assembled from parts
  (`["PHASE","TYPE","SENTENCES"].join("_")`), because this guard file imports the map for its own
  byte-identity control.

The whole-suite `fetchSpy` tripwire is untouched and still declared before every new case.

**Task 2 — the one-line fix, and the docblock that stopped being true (commit `a56b42cd`, GREEN)**

```ts
const sentence = nodeTitle(minimalPhaseFor(choice.type, PREVIEW_SLUG, index))
```

`PHASE_TYPE_SENTENCES` was dropped from the imports; `PHASE_TYPE_SUBTITLES` stayed. No name context
is passed — nothing is bound yet, and an omitted context is the shipped safe direction (D-187-05:
absent ⇒ fall through, never fabricate). No `??` floor was added: `nodeTitle` already echoes an
unknown type honestly, and a second fallback is the very defect class being removed.

The docblock section *"── It speaks the D-183-06 plain-language vocabulary ──"*, whose first line
read *"Each row is `PHASE_TYPE_SENTENCES[type]`"*, became false the moment the edit landed — this
phase's own IN-02 defect class. It is replaced by *"── Each row is a PREVIEW OF THE CARD, not a
description of it (187-18 / WR-03) ──"*, which records the two sentences, names why the drift
survived a phase built to prevent it (**semantic, not lexical** — both strings were imported
identifiers, so every `?raw` fence stayed green), and restates that the raw `phase_type` still
appears only behind the ⌥ reveal.

The mark, tint, refusal, `aria-describedby`, escape/outside-press handlers and the capture-phase
listener comment were not touched.

## The RED, recorded verbatim

`cd frontend && npx vitest run src/components/workflows/StepTypePicker.test.tsx` on HEAD, **before
any edit to `StepTypePicker.tsx`** — **4 failed | 39 passed (43)**. Both sentences, as vitest prints
them:

```
FAIL  StepTypePicker — the six choices > labels every row with what the card it creates will say (WR-03)
Error: expect(element).toHaveTextContent()

Expected element to have text content:
  Wait for your approval
Received:
  Check with youPauses here until you answer
```

```
FAIL  StepTypePicker — WR-03: the row is a preview of the card it creates
      > the human-input row waits for your approval, and no longer says 'Check with you'
AssertionError: expected 'Check with you' to be 'Wait for your approval' // Object.is equality
```

The whole-frame case shows the blast radius in a single diff — **exactly one of the six rows moves**:

```
FAIL  > every row's title IS nodeTitle over the phase the caller will build
AssertionError: expected [ [ 'programmatic', …(1) ], …(5) ] to deeply equal [ … ]

- Expected  + Received
      [ "llm_batch_agents", "Work on the parts together" ],
      [ "llm_human_input",
-       "Wait for your approval",
+       "Check with you",
      ],
      [ "llm_emit", "Produce the deliverable" ],
```

The fourth failure is the fence pre-stating Task 2's contract:

```
FAIL  > reads NO sentence map of its own — the row title comes from the one resolver
AssertionError: expected 3 to be +0 // Object.is equality
```

**The other five rows were GREEN at RED time.** The blast-radius control *"leaves the other five rows
byte-identical to their D-183-06 type sentence"* passed on HEAD, as did the row-shape guard, the
subtitle case and the slug/index-independence case — which is the evidence that the change is one
row and not six, observed rather than argued.

## Why fix (a), re-derived at live HEAD

The reviewer named two acceptable fixes. Both sides of the choice were re-checked against live code
rather than inherited from the plan:

| Claim | Where checked | Verdict |
|---|---|---|
| the human-input sentence is a **tier**, not a replacement | `.claude/skills/sketch-findings-agentic-rag/references/node-vocabulary-and-reveal.md` §"The derivation" | **Confirmed** — the ladder reads `bound skill → template → folder → human input → "Wait for your approval" → otherwise null (fall through to the type sentence)`. Both strings are load-bearing and both stay. |
| `nodeTitle` over a bare phase reaches tier (4) for `llm_human_input` only | `phaseVocabulary.ts` `derivedFace` at HEAD | **Confirmed** — tier (1) needs `skillName`, (2) needs `llm_emit` + `templateFilename`, (3) needs a `folderName` **and** membership of `GROUNDING_DIAL_TYPES` (187-17's gate), (4) is `phaseType === "llm_human_input"`. |
| `minimalPhaseFor` binds nothing that could resolve a tier | `definitionOps.ts:807-844` | **Confirmed** — `requiredConfigFor` emits only `fn` / `prompt` / `available_tools: []`; no `skill_ref`, no `folder_scope`, and `assets` is definition-level so `templateFilename` is absent with no context. |

Plan 187-17 is directly upstream and its gate was checked for interference: it narrows tier (3),
which the preview phase can never reach (no `folder_scope`), so it neither widens nor narrows this
plan's one-row blast radius. The measured RED confirms that rather than assuming it.

Fix (b) — editing `PHASE_TYPE_SENTENCES.llm_human_input` and deleting tier (4) — would have edited a
locked D-183-06 vocabulary value and removed a tier the design contract names, i.e. changed the
design to hide a consumer bug. Fix (a) leaves both strings exactly where the sketch puts them and
repairs the actual defect: a consumer reading the map directly instead of asking the resolver.

## Measurements

| Gate | Before | After |
|---|---|---|
| `StepTypePicker.test.tsx` | 36 passed | **43 passed, 0 failed** (+7) |
| `StepTypePicker` + `WorkflowCanvas` | — | **78 passed, 0 failed** |
| 6-file set (picker, canvas, canvas-editing, definitionOps, phaseVocabulary, WorkflowBuilderPage.canvas) | — | **565 passed, 0 failed** |
| `npx tsc -b` total `error TS` | 33 | **33** (zero delta) |
| `npx tsc -b` errors in `src/components/workflows/` | 0 | **0** |
| `npx vite build` | — | **exit 0** |

Acceptance greps on `StepTypePicker.tsx`, measured after the fix:
`PHASE_TYPE_SENTENCES` → **0**, `nodeTitle` → **6**, `minimalPhaseFor` → **4**.
`git status --porcelain frontend/src/components/workflows/phaseVocabulary.ts` → **empty** (no
vocabulary value and no tier changed). `git status --porcelain
frontend/src/pages/WorkflowBuilderPage.tsx` → **empty** (the D-187-14 mount cap untouched).
`git diff --stat -- supabase/migrations` → **empty**.

## Deviations from Plan

None. Both tasks executed exactly as written; no auto-fix rule fired and no Rule 4 checkpoint was
reached.

Two notes that are observations rather than deviations:

**1. [Scope boundary — logged, not fixed] the wider-glob axe flake.** `scripts/vitest-count-gate.cjs`
over the whole workflows glob still reports the non-deterministic `PublishGauntlet.test.tsx` /
`WorkflowCanvas.test.tsx` axe failures recorded by plan 187-16 as **D-ITEM-02**. `WorkflowCanvas.test.tsx`
is in this plan's own verification set and is green there (35 passed, twice). Not caused by this
plan, not chased.

**2. [Pre-existing, out of scope] the `fetchSpy` tripwire is not the last DECLARED describe.** Section
9's *"zero network calls across the entire suite"* is followed by two dismissal describes added by a
later plan, so vitest runs it before them. That ordering is inherited from HEAD; every case added by
this plan was placed **before** section 9, so the tripwire's position relative to this plan's work is
unchanged. Left alone — reordering a shipped suite is outside this plan's scope.

## Threat Model Coverage

| Threat ID | Disposition | How it was discharged |
|---|---|---|
| T-187-18-01 | mitigate | The row resolves `nodeTitle(minimalPhaseFor(choice.type, …))`, so it cannot promise a step other than the one the caller builds. Asserted as a whole-frame `toEqual` across all six types, plus a slug/index-independence case proving the preview does not depend on the placeholder. |
| T-187-18-02 | mitigate | Source fence: zero sentence-map reads in the picker (assembled identifier, count `toBe(0)`), positive controls for `nodeTitle` and `minimalPhaseFor`, and a negative for any local `const *SENTENCE*` table. No local map, no second resolver — `nodeTitle` is still the one title resolution in the codebase. |
| T-187-18-03 | mitigate | The docblock line naming the map read was rewritten in the same commit; `grep -c PHASE_TYPE_SENTENCES` on the picker returns 0, so no prose survives describing the deleted read. |
| T-187-18-04 | accept | `PREVIEW_SLUG` is the empty string and is never rendered; `nodeTitle`'s never-print-a-slug floor is asserted by the independence case. The raw `phase_type` still appears only behind the ⌥ reveal — the shipped "renders no phase slug" and "no raw type in the menu text" cases are unchanged and green. |
| T-187-18-05 | accept | `minimalPhaseFor` is a plain object-literal builder over at most six rows in a transient menu. No memo added; the 43-case suite runs in ~2.9 s, unchanged from HEAD. |

## Known Stubs

None. No placeholder value, empty-data path or unwired component was introduced.

## Threat Flags

None. No network endpoint, auth path, file-access pattern or schema shape was added or moved. The
whole-suite `fetch` tripwire recorded 0 calls.

## Self-Check: PASSED

- `frontend/src/components/workflows/StepTypePicker.tsx` — FOUND
- `frontend/src/components/workflows/StepTypePicker.test.tsx` — FOUND
- `.planning/phases/187-business-vocabulary-ai-seeded-canvas/187-18-SUMMARY.md` — FOUND
- commit `c85eb14d` — FOUND
- commit `a56b42cd` — FOUND
