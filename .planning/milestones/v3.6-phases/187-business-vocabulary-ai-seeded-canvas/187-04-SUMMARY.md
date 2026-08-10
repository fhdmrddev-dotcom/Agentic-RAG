---
phase: 187-business-vocabulary-ai-seeded-canvas
plan: 04
subsystem: frontend/workflow-vocabulary
tags: [vocab-01, d-187-04, d-187-05, canvas-01, node-face, pure-derivation, tdd]
requires:
  - "phaseVocabulary.ts — THE ONE shared phase-vocabulary module (Phase 183-02/183-04, the hard cut)"
  - "the flat-core + phase-adapter pair shape of groundingCause / groundingCauseOf (Phase 185)"
  - "canvasModel.ts NO_KB_TOOLS — the frozen module-scope safe-default idiom (D-185-09)"
  - "the CANVAS-01 totality contract and the module's purity contract (no API-client import)"
provides:
  - "NameContext — the injected, OPTIONAL folder/skill id→name maps + the definition template filename"
  - "NO_NAME_CONTEXT — the frozen module-scope empty context every omitted call shares"
  - "DerivedFaceInputs + derivedFace — the pure core with the D-187-04 most-specific-first precedence"
  - "derivedFaceOf — the phase-shaped adapter with defensive reads over the LOOSE definition JSONB"
  - "the FOUR-tier nodeTitle(phase, ctx?) — stored name > derived face > type sentence > raw type"
  - "PhaseSpecJSON.name_seeded_by_ai — the additive-optional provenance marker (read by definitionOps, not here)"
affects:
  - "187-08 / 187-15 — must resolve the definition's assets[] template filename and thread NameContext through toCanvas"
  - "187-09 / 187-10 / 187-12 — consume nodeTitle's exported surface; the second parameter is a contract"
  - "187-05 (definitionOps demote rule) — reads name_seeded_by_ai, declared here"
  - "any surface rendering an unnamed llm_human_input step — its face changed (see Deviations)"
tech-stack:
  added: []
  patterns:
    - "flat pure core + phase-shaped adapter — the adapter declares NO branch of its own"
    - "injected optional lookup context with a frozen module-scope default (the kbTools precedent)"
    - "derive, never store — the face is computed at render and written nowhere"
    - "never fabricate — an unresolved id falls THROUGH; an id-shaped face is worse than a generic one"
    - "numbered branch-order comments where the ORDER is the decision"
key-files:
  created: []
  modified:
    - frontend/src/components/workflows/phaseVocabulary.ts
    - frontend/src/components/workflows/phaseVocabulary.test.ts
    - frontend/src/components/workflows/WorkflowCanvas.test.tsx
    - frontend/src/components/workflows/__snapshots__/canvasModel.fixtures.test.ts.snap
    - .planning/phases/187-business-vocabulary-ai-seeded-canvas/deferred-items.md
decisions:
  - "D-187-04 implemented as numbered branches (1)..(5) in derivedFace — SPEC Req 1's folder-first order is recorded in-source as the overridden drafting slip"
  - "The template tier is GATED on llm_emit inside the CORE, so both callers inherit the gate and neither can render a definition-level filename on every step"
  - "Two or more folder_scope ids fall through — a count is not a name"
  - "The plan's 'an empty NameContext returns null for EVERY phase' contradicts its own 'llm_human_input renders Wait for your approval'; resolved in favour of the D-187-04 tier ORDER — tier 4 reads no lookup and resolves uncontextualised. Pinned by a named test, not hidden."
  - "HUMAN_INPUT_PHASE_TYPE extracted so the literal has one home; waitsForYou reads it too"
  - "The refuted figure is NOT restated in the corrected docblock, so a grep can prove it is gone"
metrics:
  duration: ~35 min
  tasks: 2
  commits: 4
  completed: 2026-08-02
---

# Phase 187 Plan 04: The config-derived node face — Summary

`nodeTitle()` gained a config-derived tier between the stored name and the type sentence, so a step
says what **that** step does — read from config it already has, computed at render, stored nowhere.

## What Was Built

**Task 1 — the derived tier (`8e86ee50` RED → `59b37865` GREEN).** Three exports and one private
constant, added below the Phase-185 grounding section so the file keeps its one-vocabulary shape:

- **`NameContext`** — three optional members (`folderNames`, `skillNames`, `templateFilename`), each
  documenting its source and stating that absent or missing means the tier misses. This is D-187-05:
  `folder_scope` and `skill_ref` store resolved UUIDs, never names, and the template is
  definition-level, so the derivation *cannot* be a pure function of the phase alone. It is a pure
  function of *(phase, injected context)* instead — the purity contract is untouched, the inputs are
  made explicit.
- **`NO_NAME_CONTEXT = Object.freeze({})`** at module scope — the `canvasModel.ts` `NO_KB_TOOLS`
  idiom, so an omitted context hands the same reference on every call and the projection stays
  deterministic to the byte (the snapshot tripwire depends on that).
- **`derivedFace(inputs)`** — the pure core, with the precedence numbered `(1)`..`(5)` in the source
  because the **order is the decision**: bound skill → template (`llm_emit` only) → folder scope →
  human input → `null`. Each branch carries its own justification, including the in-source record
  that SPEC Req 1's *"folder scope → bound skill → template"* is a drafting slip overridden by
  D-187-04.
- **`derivedFaceOf(phase, ctx?)`** — the phase-shaped adapter. It declares no branch of its own; it
  reads defensively off the LOOSE JSONB (`typeof === "string"` for `skill_ref`, `Array.isArray` +
  length-1 + string for `folder_scope`) and delegates. `assets` is deliberately **not** read here —
  the definition-level lookup belongs to the caller that holds the definition (187-08 / 187-15).

**The `llm_emit` gate lives in the core, not the adapter.** That is the load-bearing choice: the
template is a *definition* asset, so an ungated tier would paint the same filename on every phase
that reached it and make distinct steps identical — reproducing the exact failure the phase exists
to kill.

**Task 2 — the four-tier ladder (`dd12bb2f` RED → `f5ed99ac` GREEN).** `nodeTitle` became
`nodeTitle(phase, ctx: NameContext = NO_NAME_CONTEXT)` with `derivedFaceOf` inserted between the
stored name and the type sentence. `technicalTitle` is untouched. Three further edits rode along:

- The `PHASE_TYPE_SENTENCES` docblock's refuted name-count is replaced by the measured **0 of 57
  phases across the 27 well-formed `workflow_definitions` rows** (`:54322`, 2026-08-02), with the
  double-encoding explained and the note that the correction *strengthens* the docblock's own
  conclusion — at 0 of 57 the type sentence was not merely dominant, it was the only face the
  shipped ladder ever reached. The old figure is **not restated**, so `grep -c "10 of 119"` is 0.
- `PhaseSpecJSON.name_seeded_by_ai?: boolean` — additive-optional in the same register as
  `grounding_escalated` / `action_risk_armed`, documented as **provenance, not display**, read only
  by 187-05's demote rule in `definitionOps.ts`. It appears exactly once in the file and no resolver
  here reads it.
- `nodeTitle`'s docblock now describes four tiers and restates both floors it carries: the slug
  never appears, and a name is never fabricated.

## Verification

| Gate | Result |
|---|---|
| `phaseVocabulary.test.ts` | **72 passed** (HEAD baseline 33 — +39 net-new) |
| Frontend 8-file vocabulary/canvas set | **902 passed, 0 failed** (bar: ≥ 863) |
| Frontend 5-file consumer set | **381 passed, 0 failed** (bar: ≥ 381) |
| `?raw` source guards (`PhaseSpineGraph.test.tsx` / `PhaseSpine.test.tsx`) | green — exactly one copy of the vocabulary |
| `grep -c "deriveTier" phaseVocabulary.ts` | **0** — no collision with the Phase-103 strictness resolver |
| `grep -cE "@/lib/api\|fetch\(" phaseVocabulary.ts` | **0** — the purity contract holds |
| `grep -c "10 of 119"` / `grep -c "0 of 57"` | **0** / **3** |
| `npx tsc -b` | 33 errors, **0 in `components/workflows`**, count unchanged before and after this plan — see Deviations |

Tests pin every behaviour the plan named, including all five totality shapes (absent `config`,
unknown `phase_type`, `folder_scope` as a string, `folder_scope` carrying a non-string, `skill_ref`
as a number) and the never-fabricate floor asserted twice — once as `null`, once as
`expect(face).not.toContain(SKILL_ID)` when a lower tier resolves.

## Deviations from Plan

### Contradiction inside the plan, resolved in the open

**1. [Rule 1 — spec conflict] `derivedFace` tier 4 resolves with an empty context.**

- **Found during:** Task 1.
- **Issue:** the plan's `<behavior>` block asserts both *"An `llm_human_input` phase with nothing
  bound renders `Wait for your approval`"* and *"An empty `NameContext` (`{}`) makes every tier miss
  and returns `null` for every phase."* Tier 4 reads no lookup, so these cannot both hold.
- **Resolution:** the tier **order** is what D-187-04 locks, and sketch 148-C's derivation table
  lists `human input → "Wait for your approval"` unconditionally. Gating tier 4 on the presence of a
  context would be arbitrary and would make `derivedFaceOf(p)` disagree with `derivedFaceOf(p, {})`
  for no reason. So "every tier misses" is implemented as true for the **three lookup tiers**, and
  the exception is pinned by a named test and stated in `nodeTitle`'s docblock rather than left to
  be discovered.
- **Consequence, and it is a real product change:** an unnamed `llm_human_input` step now reads
  **"Wait for your approval"** instead of **"Check with you"**, even for callers that pass no
  context. This is D-187-04's intent and D-187-06 already records the resulting subtitle redundancy
  ("Pauses here until you answer") as an accepted cost.
- **Commit:** `59b37865` / `f5ed99ac`.

**2. [Rule 3 — blocking] Two files outside `files_modified` had to be updated for the plan's own
verification gate to pass.**

- **Found during:** Task 2, by the drift tripwire doing exactly its job.
- **What changed:** `__snapshots__/canvasModel.fixtures.test.ts.snap` (**6 lines across 3 fixtures**
  — `doc_qa_human`, `eval_coverage`, `branching`; every one of them the `llm_human_input` `title` +
  `ariaLabel`) and one assertion in `WorkflowCanvas.test.tsx:302`. The full snapshot diff was read
  line by line before updating: nothing but the intended face changed — no position, no id, no
  grounding signal, no edge.
- **Why not a defect:** the shipped `WorkflowCanvas` assertion's stated intent ("plain-language
  titles by default and no slug on any node face") is preserved; only the literal moved. A comment
  at the call site records why.
- **Commit:** `f5ed99ac`.

**3. [Rule 1 — refuted inherited claim] `npx tsc -b` does not exit 0 at HEAD.**

- **Found during:** Task 1 acceptance checks.
- **Issue:** every 187 plan carries *"`npx tsc -b` exits 0"* from `187-RESEARCH.md:1769`. Measured:
  it exits **2** with **33 `error TS` lines**, none of them in `src/components/workflows/`. Owners
  are `SettingsPage`, `OrgProvider.test`, `StreamsProvider` and `streamsStore`.
- **Action:** out of scope — logged to `deferred-items.md` (`D-ITEM-01`) with the recommended
  reading of the criterion (*no NEW error, and none in the touched files*) and a re-open trigger.
  The count was measured before and after this plan's edits and is **identical (33 → 33)**, so this
  plan's delta is provably zero.

### Minor, in-scope

**4. [Rule 2 — one home per literal] `HUMAN_INPUT_PHASE_TYPE` extracted.** `derivedFace` needed the
`"llm_human_input"` literal that `waitsForYou` already carried. Rather than typing it twice, it is a
module-scope const both read. `waitsForYou`'s shipped test still pins its behaviour.

## Known Stubs

None. Every export is fully implemented and exercised.

The one intentionally-unwired member is `PhaseSpecJSON.name_seeded_by_ai` — declared here because
this module owns the read shape, but **read by no function in this file**. Its consumer is 187-05's
demote rule in `definitionOps.ts`. A test asserts it appears exactly once, which is what keeps that
separation honest.

## Threat Flags

None. No new network surface, auth path, file access or schema. The two boundaries the plan's threat
model named are both mitigated and asserted: malformed JSONB cannot crash the projection
(T-187-04-01, five shapes), and an unresolved id cannot reach the face (T-187-04-02, asserted as
`null` and as `not.toContain(id)`).

## For the Next Plan

- **`nodeTitle`'s second parameter is now the contract** (187-08 / 187-09 / 187-10 / 187-12). It is
  optional; omitting it is byte-identical to HEAD for every lookup-dependent shape.
- **187-08 / 187-15 owe the template resolution.** `derivedFaceOf` does not read `assets` — the
  caller holding the `WorkflowDefinition` must find the `assets[]` entry where `kind === "template"`
  and pass its `filename` as `ctx.templateFilename`.
- **The maps already exist** at `PhaseFormPanel.tsx:126-128` (`folderNames` / `skillNames`, Phase
  103-ux). Reuse that source; do not fetch again.
- **If you pass a context to a surface that renders `llm_human_input`**, remember the face is
  already "Wait for your approval" with or without it.
- **Do not gate your acceptance on `tsc -b` exiting 0** — see `deferred-items.md` D-ITEM-01.

## Self-Check: PASSED

- `frontend/src/components/workflows/phaseVocabulary.ts` — FOUND (modified)
- `frontend/src/components/workflows/phaseVocabulary.test.ts` — FOUND (modified)
- `frontend/src/components/workflows/WorkflowCanvas.test.tsx` — FOUND (modified)
- `frontend/src/components/workflows/__snapshots__/canvasModel.fixtures.test.ts.snap` — FOUND (modified)
- `.planning/phases/187-business-vocabulary-ai-seeded-canvas/deferred-items.md` — FOUND (created)
- commits `8e86ee50`, `59b37865`, `dd12bb2f`, `f5ed99ac` — all FOUND in `git log`
