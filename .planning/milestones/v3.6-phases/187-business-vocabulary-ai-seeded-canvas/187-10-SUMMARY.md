---
phase: 187-business-vocabulary-ai-seeded-canvas
plan: 10
subsystem: frontend/workflow-definition-ops
tags: [vocab-01, vocab-02, vocab-03, d-187-07, d-187-08, d-187-10, copy-lock, tdd]
requires:
  - "PhaseSpecJSON.name_seeded_by_ai — declared in phaseVocabulary.ts by plan 187-04, read by no resolver there"
  - "PhaseSpec.name_seeded_by_ai — the server-side stamp from plan 187-02 (identical spelling both sides)"
  - "derivedFace / derivedFaceOf / the 4-tier nodeTitle(phase, ctx?) — plan 187-04"
  - "GroundingCause — the Phase 185 one-client-grounding-derivation type"
  - "GOVERNANCE_SEAL_LABEL — the Req 7 binding phrase, shipped Phase 185"
  - "the STRANDING_REASON / GovernanceSection copy-constant idiom (a component authors no sentence of its own)"
provides:
  - "IDENTITY_BEARING_CONFIG_KEYS — the ONE exported source of truth for D-187-07's demote trigger"
  - "patchPhaseConfig's demote: an identity-bearing config edit clears BOTH `name` and `name_seeded_by_ai`"
  - "SEED_RECEIPT_* — the seed receipt's 7 exported sentences/formatters (Req 5)"
  - "STARTER_DOOR_* + starterSeedSentence + StarterChoiceJSON — the template door's 4 exports (Req 6)"
affects:
  - "187-13 (the seed receipt component) — imports every SEED_RECEIPT_* export; authors no sentence of its own"
  - "187-14 (the template picker) — imports every STARTER_DOOR_* export; StarterChoiceJSON accepts a raw listStarterWorkflows row"
  - "187-12 / any surface rendering a seeded name — a config edit on skill_ref / folder_scope / available_tools now changes the face"
tech-stack:
  added: []
  patterns:
    - "the trigger is a PROPERTY of the edit (a readonly key set), not a hand-copied list in a branch"
    - "`delete` over `= undefined` — a phase that carried no name comes back with no name KEY (extra=forbid round trip)"
    - "copy constants composed from the shipped locked phrase, never re-typed"
    - "a formatter RENDERS the cause it is handed and classifies nothing (the one-derivation rule)"
    - "banned-word and unshipped-glyph guards assembled from string parts so the guard is not what a source grep finds"
key-files:
  created: []
  modified:
    - frontend/src/components/workflows/definitionOps.ts
    - frontend/src/components/workflows/definitionOps.test.ts
decisions:
  - "D-187-07 implemented as ONE exported readonly key set with its justification in-source; `available_tools` is included deliberately and its non-membership in `derivedFace` is stated rather than glossed"
  - "The demote is gated on a seeded name that actually EXISTS — a marker with nothing to describe is not a state the server's stamp can produce"
  - "Zero grounded steps yields an EMPTY grounding lead (D-187-10), so the caller renders the paragraph only when non-empty"
  - "The dismiss label and the ✕ mark are SEPARATE exports (the 185-09 GOVERNANCE_SEAL_LABEL precedent)"
  - "StarterChoiceJSON is spelled structurally, and a type-only PublishedWorkflow assignment in the test pins the 187-14 contract at compile time"
metrics:
  duration: ~40 min
  tasks: 2
  commits: 2
  completed: 2026-08-02
---

# Phase 187 Plan 10: The demote rule + the two new surfaces' copy — Summary

A generator-seeded name now falls back to the derived tier the moment a config edit could
invalidate it, a hand-typed one never does, and both new 187 surfaces have their sentences in the
one copy home where drift is a failing test rather than a review comment.

## What Was Built

**Task 1 — the demote (`fcd94282`).** `IDENTITY_BEARING_CONFIG_KEYS` is one exported
`ReadonlySet<string>` (`definitionOps.ts:220`) carrying `skill_ref`, `folder_scope` and
`available_tools`, with a docblock that states D-187-07's justification — *a config edit clears a
generator-seeded name precisely when it could change what the step's face says about that step* —
so a future tier is added by asking the question, not by copying a list. `patchPhaseConfig` reads
the trigger off the PATCH's keys once, before the walk (the rule is a property of the edit), and on
the named slug clears **both** `name` and `name_seeded_by_ai` with `delete` rather than
`= undefined`. The demote lives in the one config-edit home (`builderStore.ts:519` ←
`WorkflowBuilderPage`'s `onPhaseChange`); `setPhaseGovernance` is untouched, so widening it into a
general `PhaseSpec` writer is still a typecheck error (T-185-06-02).

**Task 2 — the copy (`4f0f9787`).** Eleven new exports beside the shipped governance block, in the
same register:

| Family | Exports |
|---|---|
| `SEED_RECEIPT_*` (Req 5) | `seedReceiptHeading(n)`, `seedReceiptGroundingLead(n)`, `SEED_RECEIPT_ONE_WAY_RULE`, `seedReceiptStepReason(cause, tool?)`, `SEED_RECEIPT_NOTHING_COMMITTED`, `SEED_RECEIPT_DISMISS_LABEL`, `SEED_RECEIPT_DISMISS_GLYPH` |
| `STARTER_DOOR_*` (Req 6) | `STARTER_DOOR_LINE`, `STARTER_DOOR_HEADING`, `STARTER_DOOR_NOTE`, `starterSeedSentence(starter)` + `StarterChoiceJSON` |

Three properties are load-bearing rather than stylistic:

- **The binding phrase is composed, not re-typed.** The grounding lead ends
  `…so I set them to ${GOVERNANCE_SEAL_LABEL.toLowerCase()}.` — Req 7's vocabulary is a lock and two
  copies of a locked word in two places can drift. A test asserts the containment for 1, 2 and 7.
- **`seedReceiptStepReason` classifies nothing.** It takes a `GroundingCause` and the intersecting
  tool as INPUTS and renders a line naming the actual tool (`it reads your documents
  (search_documents)`). Classification stays in `groundingCauseOf` over the server's `kb_tools`
  (D-187-08 / T-187-10-04), so this module cannot become a second grounding derivation. An absent
  or blank tool falls through to the unqualified sentence — never fabricate.
- **Zero grounded steps returns `""`** (D-187-10): the receipt still appears with its orientation
  half and its nothing-committed half; only the grounding paragraph is conditional, and an empty or
  invented grounded list is what Req 5 forbids.

## Measured Baselines (captured at HEAD, per the acceptance criteria)

| Measurement | HEAD | After Task 1 | After Task 2 |
|---|---|---|---|
| `definitionOps.test.ts` count | **189** | **203** | **222** |
| `grep -n IDENTITY_BEARING_CONFIG_KEYS` (declarations) | 0 | **1** (`:220`) | 1 |
| `grep -n name_seeded_by_ai` in `definitionOps.ts` | 0 | **5** (2 doc, 3 code) | 5 |
| `git diff -U0 … \| grep -c PhaseGovernancePatch` | — | **0** | **0** |
| `grep -cE '^export (const\|function) SEED_RECEIPT\|^export function seedReceipt'` | 0 | 0 | **7** (bar ≥ 5) |
| `grep -cE '^export (const\|function) STARTER_DOOR\|^export function starter'` | 0 | 0 | **4** (bar ≥ 3) |
| `grep -cE '✦\|✓'` in `definitionOps.ts` | 0 | 0 | **0** |
| `npx tsc -b` error count / errors in `components/workflows` | **33 / 0** | 33 / 0 | **33 / 0** |
| Zero `assets` references in `frontend/src` (the dormant template arm) | **0** | — | 0 |

## TDD Gate Compliance

Both tasks observed RED before GREEN.

- **Task 1 RED:** 6 failed / 197 passed. The other 8 net-new tests were green on both sides *by
  design* — they pin the NO-demote half (a prompt edit, a hand-typed name, an unknown slug), which
  is shipped behaviour. A regression guard that fails before its feature exists would be testing the
  wrong thing.
- **Task 2 RED:** a collection error — the module exports nothing the new block imports, so the file
  could not load at all. That is the strongest possible RED for a pure-export task.

Commits are `feat(...)` rather than a split `test(...)` → `feat(...)` pair; the RED observations
recorded above are the gate, matching plan 187-02's shape in this phase.

## Deviations from Plan

### 1. [Rule 2 — honesty about a stated justification] `available_tools` is not read by `derivedFace`

- **Found during:** Task 1, writing the `IDENTITY_BEARING_CONFIG_KEYS` docblock.
- **Issue:** the plan asks for the trigger to be expressed as *"the fields the derived tier READS"*
  and simultaneously names `available_tools` as a member. `derivedFace` (187-04) reads `skill_ref`,
  `folder_scope`, `phase_type` and the injected `templateFilename` — **not** `available_tools`.
  Writing the docblock as literally instructed would have made it a comment that lies.
- **Resolution:** the rule is stated one notch wider and still justified rather than enumerated —
  *"a config edit clears a generator-seeded name precisely when it could change what the step's face
  says about that step"* — and `available_tools`' membership is justified explicitly on its own
  terms: it decides whether the step reads your documents at all (`groundingCauseOf`'s `detected`
  branch), so a seeded name written for a step that searched your files no longer describes it once
  those tools are switched off. D-187-07's member list is unchanged; only the sentence justifying it
  is accurate now.
- **Commit:** `fcd94282`.

### 2. [Rule 2 — a measured absence, recorded] `phase_type` is deliberately NOT a member

- The set could plausibly have carried `phase_type` (it gates `derivedFace` tiers 2 and 4). Measured
  rather than assumed: `PhaseFormPanel` only ever READS `phase_type` (`:719`) — the type is chosen
  once at add time and the slug is derived from it, so no patch through this seam can carry it. The
  docblock records the measurement so a later reader does not re-litigate it from taste.

### 3. [Rule 2 — a compile-time contract for the next plan] a type-only `PublishedWorkflow` pin

- `StarterChoiceJSON` is spelled structurally so the pure module names no API client. Nothing
  enforced that it still *accepts* a real `listStarterWorkflows` row, which is exactly the seam
  187-14 depends on. Added one test that assigns a `PublishedWorkflow`-typed literal and passes it
  to `starterSeedSentence`. The import is `import type` — erased at compile — so the module's `?raw`
  purity fence is untouched and the suite gains a guard that breaks *here* rather than in 187-14.

**No deviation from the plan's stated behaviours.** All seven Task-1 behaviours and all four Task-2
properties are implemented and tested as written.

## Threat Model Compliance

| Threat ID | Disposition | Evidence |
|---|---|---|
| T-187-10-01 (Tampering — a hand-typed author name) | mitigated | The demote is gated on `name_seeded_by_ai === true`. Two tests: a marker-absent name survives all three identity-bearing patches (asserted through `nodeTitle`, not a field read), and an explicit `name_seeded_by_ai: false` survives too. |
| T-187-10-02 (Tampering — a stale face) | mitigated | Both keys are cleared together, so the face falls to `derivedFaceOf` and resumes tracking. The named test asserts the user-visible consequence: `"Check supplier pricing"` → `"Run the pricing policy check"`. No stale-name marker and no new card corner. |
| T-187-10-03 (Tampering — scope creep of the PhaseSpec writer) | mitigated | `git diff -U0 -- definitionOps.ts \| grep -c 'PhaseGovernancePatch'` returns **0** across both commits — `setPhaseGovernance` and its narrow patch type were not touched. |
| T-187-10-04 (Spoofing — an invented grounding reason) | mitigated | `seedReceiptStepReason` is a `switch` over an input `GroundingCause` with no predicate of its own; a `null` cause yields `""`. The tool name is rendered, never derived. |
| T-187-10-05 (Repudiation — governance vocabulary drift) | mitigated | Every new sentence is an exported identifier asserted character-identically; a control-backed test forbids `safe` / `approved` / `proven` on word boundaries across all 17 renderable strings, and a second guard proves no unshipped canvas glyph appears in the copy **or anywhere in the module source**. |

## Known Stubs

None. Every export is fully implemented and exercised.

Two exported surfaces are intentionally **unwired** — that is the plan's shape, not a stub:
`SEED_RECEIPT_*` has no renderer until 187-13 and `STARTER_DOOR_*` none until 187-14. The demote
itself is wired end-to-end through `builderStore.patchConfig`.

**One arm of the demote rule is dormant and must not be claimed as reachable.** `derivedFace`'s
template tier reads a DEFINITION-level `assets[]` filename, which is not a phase config key —
measured this session, `frontend/src` contains **zero** `assets` references outside docblocks, so no
builder surface can edit it today. The rule is implemented and tested at the pure-function level
only.

## Threat Flags

None. No new network surface, auth path, file access or schema. Both tasks are pure functions and
string constants inside a module whose `?raw` purity fence and whole-suite `fetch` tripwire both
still pass.

## Verification

```
npx vitest run definitionOps.test.ts                                    → 222 passed (HEAD 189)
npx vitest run definitionOps + phaseVocabulary + governanceVocabulary
                             + GovernanceSection.test.tsx               → 366 passed, 0 failed
npx vitest run WorkflowCanvas + PublishGauntlet + WorkflowBuilderPage.canvas
                             + ProblemsTray + definitionOps             → 417 passed, 0 failed (bar ≥ 381)
npx vitest run builderStore + canvasModel.roundtrip/.fixtures/.purity   → 812 passed, 0 failed
npx tsc -b                                                              → 33 errors, 0 in components/workflows
                                                                          (identical before and after — D-ITEM-01)
```

`PublishGauntlet.test.tsx` was **100% green in isolation** here, consistent with 187-CONTEXT's
correction of the project-memory rot figure.

## For the Next Plans — the exported contract (187-13 / 187-14 depend on this)

```ts
// frontend/src/components/workflows/definitionOps.ts

// D-187-07 — the demote (already wired through builderStore.patchConfig)
export const IDENTITY_BEARING_CONFIG_KEYS: ReadonlySet<string>   // skill_ref, folder_scope, available_tools

// Req 5 — the seed receipt (187-13). The component AUTHORS NO SENTENCE OF ITS OWN.
export function seedReceiptHeading(stepCount: number): string
export function seedReceiptGroundingLead(groundedCount: number): string   // "" when 0 — render nothing
export const SEED_RECEIPT_ONE_WAY_RULE: string
export function seedReceiptStepReason(cause: GroundingCause, tool?: string | null): string
export const SEED_RECEIPT_NOTHING_COMMITTED: string
export const SEED_RECEIPT_DISMISS_LABEL: string   // "Dismiss" — the accessible label, glyph-free
export const SEED_RECEIPT_DISMISS_GLYPH: string   // "✕" — render aria-hidden

// Req 6 — the template door (187-14)
export interface StarterChoiceJSON { name: string; definition?: Readonly<Record<string, unknown>> | null }
export const STARTER_DOOR_LINE: string      // the ONE quiet line at rest under the describe box
export const STARTER_DOOR_HEADING: string
export const STARTER_DOOR_NOTE: string
export function starterSeedSentence(starter: StarterChoiceJSON): string
```

- **187-13:** call `seedReceiptGroundingLead` FIRST and render the paragraph + the step list only
  when it is non-empty — that is D-187-10's zero case, and it is the whole of the conditional. Get
  each step's `cause` from `groundingCauseOf(phase, kbTools)` and the `tool` from the actual
  intersection (`phase.config.available_tools ∩ kbTools`) — do **not** hardcode
  `"search_documents"`. Dismissal is in-memory per draft (D-187-09); a reload re-showing the receipt
  is correct.
- **187-14:** a raw `listStarterWorkflows` row is accepted with no adapter — the compile-time pin is
  in `definitionOps.test.ts`. A starter is identified by its phase SPINE, never a phase-type glyph
  (icon-convention §4, finding #36); nothing here exports a category icon because there is no such
  vocabulary. The picker sets `initialDescribe`; it never forks to a canvas.
- **Both:** if you need a new sentence, add it here — a sentence inside a component is a sentence
  nobody can test for drift, and the guard forbidding `safe` / `approved` / `proven` only sees what
  this module exports.
- **Do not gate acceptance on `tsc -b` exiting 0** — `deferred-items.md` D-ITEM-01; read it as *no
  new error, none in the touched files*.

## Self-Check: PASSED

- `frontend/src/components/workflows/definitionOps.ts` — FOUND (modified)
- `frontend/src/components/workflows/definitionOps.test.ts` — FOUND (modified)
- commits `fcd94282`, `4f0f9787` — both FOUND in `git log`
- `git diff --diff-filter=D HEAD~2 HEAD` — empty; no file was deleted by either commit
