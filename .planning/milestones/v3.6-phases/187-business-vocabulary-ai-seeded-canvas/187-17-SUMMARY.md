---
phase: 187-business-vocabulary-ai-seeded-canvas
plan: 17
subsystem: frontend/workflow-builder
tags: [vocab-01, wr-02, d-187-04, d-187-05, d-185-15, gap-closure, tdd]
requires:
  - "phaseVocabulary.GROUNDING_DIAL_TYPES — the shipped two-member dial constant, Phase 185 / D-185-15"
  - "phaseVocabulary.derivedFace five-tier ladder — plan 187-04"
  - "__fixtures__/canvasFixtures.ALL_FIXTURES — the SC#5 corpus, plans 183-05 + 187-12"
provides:
  - "derivedFace tier (3) gated on GROUNDING_DIAL_TYPES — the folder face states no capability the step lacks"
  - "a TYPE-SPACE SWEEP that derives its expectation from the constant, so the suite guards the RULE not a snapshot"
  - "materialConfigKey mirrors BOTH gated tiers — check 2 keeps biting instead of being loosened"
  - "a page-level WR-02 negative witness (an llm_emit step with a resolvable sole folder_scope)"
affects:
  - "any caller of nodeTitle on a non-retrieval step with a bound folder — the face is now the plain type sentence"
  - "the SC#5 falsification control: non-contiguous drops out because its pair stopped being materially different"
tech-stack:
  added: []
  patterns:
    - "a type-space sweep whose expectation is DERIVED from the constant under test, plus non-vacuity assertions on both halves"
    - "a source fence counting identifier reads AND array literals, so a gate cannot be re-typed instead of reused"
    - "a corpus self-check asserting a witness on BOTH sides of a gate — one-sided coverage is green before and after"
key-files:
  created:
    - ".planning/phases/187-business-vocabulary-ai-seeded-canvas/187-17-SUMMARY.md"
  modified:
    - frontend/src/components/workflows/phaseVocabulary.ts
    - frontend/src/components/workflows/phaseVocabulary.test.ts
    - frontend/src/components/workflows/phaseVocabulary.corpus.test.ts
    - frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx
decisions:
  - "llm_emit stays OUT of the gate, against its own field docblock. LlmEmitPhaseConfig.folder_scope claims to be 'load-bearing in the executor plan — bound-scope retrieval + skill composition feeding the emit'; re-read at live HEAD, `_exec_llm_emit` (phase_types.py:1151-1601) contains ZERO reads of folder_scope, folder_subtree_ids, ToolContext or _build_phase_tool_context. The claim is plan-era and the shipped executor refutes it — recorded in-source so the next reader cannot re-inherit it."
  - "The gate REUSES GROUNDING_DIAL_TYPES rather than declaring a third list, because grounding_cause declines to read folder_scope for the identical stated reason ('it exists on all five LLM config members … so reading it would auto-lock steps that read nothing'). Same question, same answer. The constant's declaration is byte-unchanged in the diff (D-185-15 red line)."
  - "materialConfigKey was REPAIRED, not check 2 loosened. Its own docblock says it carries 'exactly the fields the derived tier READS', and a gated tier does not read its field outside the gate — the template half already worked this way, so the folder half now asks the same question the resolver asks."
  - "The corpus falsification control drops from two members to one, and that reduction is asserted as a MEASUREMENT rather than left as prose: a new case proves non-contiguous's pair now has EQUAL material keys, so its disappearance is the D-187-15 narrowing working, not a weakened control."
  - "The page fixture's folder witness moved from llm_single to llm_batch_agents (the previously unmeasured half of the gated set) and a NEGATIVE witness was added to the existing llm_emit phase — no phase added, so no other row of that 113-test suite moved."
  - "STATE.md was NOT written by this executor. The orchestrator owns STATE/ROADMAP writes; its in-flight edit was left untouched and unstaged."
metrics:
  duration: ~35 min
  tasks: 2
  commits: 2
  completed: 2026-08-02
---

# Phase 187 Plan 17: The node face stops claiming a capability the step does not have — Summary

An `llm_single` step with a bound folder rendered **"Search Supplier Contracts"** for a step that
performs no retrieval at all. `derivedFace`'s own never-fabricate floor was written about NAMES;
this closes it over CAPABILITIES, using the constant the grounding derivation already answers the
same question with.

## What Was Built

**Task 1 — the falsification (commit `7bc9fff2`, `test(...)` RED gate)**

Tier (3) was ungated while tier (2) was gated with a stated rationale. Every folder-tier case in
the shipped suite used `phase_type: "llm_agent"` — re-verified at live HEAD, that claim held, and
it is exactly why the suite was green before AND after the defect. 20 net-new cases:

- the five types beyond `llm_agent`: `llm_single`, `programmatic`, `llm_emit` (with and without a
  template, so tier (2)'s precedence is proved undisturbed), `llm_human_input`, `llm_batch_agents`;
- **a TYPE-SPACE SWEEP** over `Object.keys(PHASE_TYPE_SENTENCES)` whose expectation is
  `GROUNDING_DIAL_TYPES.includes(phaseType)` — derived from the imported constant, never re-typed —
  plus non-vacuity assertions that the gated set is neither empty nor the whole type space;
- the phase-shaped path real callers use (`derivedFaceOf` + `nodeTitle`), including "a stored name
  still wins over the gated-out tier, on every type";
- source fences for T-187-17-02: `GROUNDING_DIAL_TYPES` is read ≥ 3 times, its two members appear
  in **exactly one** array literal, and the constant is asserted NOT widened.

Corpus half: a self-check asserting a folder-bearing phase exists on **both sides** of the gate
(`pm-*.retrieve` inside, `non-contiguous.stranded` + `pm-*.emit` outside), and a WR-02 witness that
proves `stranded`'s binding is real and resolvable before asserting its face states no search.

**Task 2 — the gate (commit `a1684e72`, GREEN)**

```ts
if (inputs.folderName && GROUNDING_DIAL_TYPES.includes(inputs.phaseType)) {
  return `Search ${inputs.folderName}`
}
```

Tier (3)'s comment was rewritten in tier (2)'s register with four measured paragraphs — why gated,
why *this* constant and not a new one, why `llm_emit` is not a member (with the docblock refutation
recorded), and D-187-04's unchanged most-specific-last reason, which the gate is additive to.
`DerivedFaceInputs.phaseType` ("gates tiers 2 and 4" → "2, 3 and 4"), `folderName` and
`derivedFace`'s function docblock ("`null` when nothing is bound" → "nothing USABLE is bound") were
all corrected — a comment that misdescribes the code is this phase's own IN-02 defect class.

## The RED, recorded verbatim

`cd frontend && npx vitest run …phaseVocabulary.test.ts …phaseVocabulary.corpus.test.ts` on HEAD,
before any edit to `phaseVocabulary.ts` — **13 failed | 122 passed (135)**. The two the plan named:

```
FAIL  phaseVocabulary — WR-02 on the PHASE-SHAPED path real callers use
      > nodeTitle: an llm_single step with a bound folder renders the plain type sentence
AssertionError: expected 'Search Supplier Contracts' to be 'Write it up'
  Expected: "Write it up"
  Received: "Search Supplier Contracts"
```

```
FAIL  phaseVocabulary.derivedFace — the folder tier reaches only retrieval types (WR-02)
      > llm_human_input with a bound folder waits for you — the second over-claim, removed
AssertionError: expected 'Search Board Papers' to be 'Wait for your approval'
  Expected: "Wait for your approval"
  Received: "Search Board Papers"
```

The flat-core form of the first, and the sweep that shows the whole shape of the defect in one
frame:

```
FAIL  > llm_single with a bound folder states NO search — folder_scope is inert there
AssertionError: expected 'Search Supplier Contracts' to be null

FAIL  > TYPE-SPACE SWEEP: a sole bound folder faces iff the type is in GROUNDING_DIAL_TYPES
AssertionError: expected [ [ 'programmatic', true ], …(5) ] to deeply equal [ [ 'programmatic', false ], …(5) ]
- Expected  + Received
    [ "programmatic",  - false  + true  ],
    [ "llm_single",    - false  + true  ],
    [ "llm_agent",       true         ],
    [ "llm_batch_agents", true        ],
    [ "llm_human_input", - false + true ],
    [ "llm_emit",        - false + true ],
```

Four of the six types over-claimed. Also red, from the same run: the corpus witness
(`expected 'Search Supplier Contracts' to be 'Write it up'` at
`phaseVocabulary.corpus.test.ts:459`), the `programmatic` and `llm_emit` flat cases, the unknown-type
case, `derivedFaceOf` on `llm_single`, and the source fence
(`expected 2 to be greater than or equal to 3` — the gate did not yet name the constant).

## Evidence for the `llm_emit` exclusion, re-derived not inherited

The plan asked me not to trust its own quotation. Both were re-read at live HEAD:

| Source | What it says | Verdict |
|---|---|---|
| `LlmSinglePhaseConfig.folder_scope`, `backend/app/models/harness.py` | *"Load-bearing on llm_agent + llm_batch_agents; inert on llm_single (no tools). Carried here for shape symmetry across the family."* | **Confirmed verbatim** — the field documents its own inertness |
| `LlmEmitPhaseConfig.folder_scope`, same file | *"Shape-symmetry optionals (mirror the other LLM members; load-bearing in the executor plan — bound-scope retrieval + skill composition feeding the emit)."* | **Confirmed verbatim, and REFUTED below** |
| `_exec_llm_emit`, `backend/app/services/harness/phase_types.py:1151-1601` | grep for `folder_scope` / `folder_subtree` / `ToolContext` / `_build_phase_tool_context` across the whole body | **One hit, and it is a comment** (`# run_id IS workflow_runs.id (verified _build_phase_tool_context:354…)`). Zero functional reads. |
| `grounding.grounding_cause`, `backend/app/services/harness/grounding.py:826-830` | *"`folder_scope` is deliberately NOT an input. It exists on all five LLM config members (including `llm_single`, which has no tools at all), so reading it would auto-lock steps that read nothing"* | **Confirmed verbatim** — the same reasoning, which is why the same constant is the honest predicate |

The only run-time consumer of a phase's `folder_scope` is the narrowing inside
`_build_phase_tool_context` (`phase_types.py:386-408`), reached from the two sub-agent paths.

## Measurements

| Gate | Before | After |
|---|---|---|
| 9-file vocabulary/canvas set, isolated | 1022 passed | **1043 passed, 0 failed** (+21) |
| `phaseVocabulary.test.ts` + `.corpus.test.ts` | 114 | **135, 0 failed** |
| consumer set (`WorkflowCanvas`, `ProblemsTray`, `WorkflowBuilderPage.canvas`, `PhaseNode`) | 187 (1 failed mid-fix) | **187 passed, 0 failed** |
| `npx tsc -b` total `error TS` | 33 | **33** (zero delta) |
| `npx tsc -b` errors in `src/components/workflows/` or `WorkflowBuilderPage` | 0 | **0** |
| `npx vite build` | — | **exit 0** |
| `canvasModel.fixtures.test.ts` snapshot | — | **byte-unchanged** (`git status` on `__snapshots__/` empty) |

Acceptance guards, measured after the fix:
`git diff -- frontend/src/components/workflows/phaseVocabulary.ts | grep '^[-+].*GROUNDING_DIAL_TYPES'`
returns four lines and **none of them is the declaration** — the constant is read, never edited.
`git status --porcelain frontend/src/pages/WorkflowBuilderPage.tsx` → empty (the D-187-14 mount cap
is untouched). `git diff --stat -- supabase/migrations` → empty.

**Why the snapshot did not move:** `canvasModel.fixtures.test.ts` calls `toCanvas(phases)` with no
`nameContext`, so the folder tier never resolved there in the first place. The plan's
"if the snapshot moves, inspect it" branch was not reached.

## Deviations from Plan

**1. [Rule 1 — blocking failure outside the plan's file list] `WorkflowBuilderPage.canvas.test.tsx`'s 187-15 fixture asserted the over-claim**

- **Found during:** Task 2 verification (the plan's own `<verification>` block names this file).
- **Issue:** `vocabularyPhases.scan` was
  `{ phase_type: "llm_single", folder_scope: [CORPUS_FOLDER_ID] }`, and the test *"a single scoped
  folder names its step on both views"* asserted it renders `Search Supplier Contracts` on the
  canvas AND the spine. That is the WR-02 over-claim, pinned at the page. The plan's `<files>` did
  not list this file, but its verification block requires the suite green, so the failure was
  blocking.
- **Fix:** the fixture was re-derived rather than the assertion deleted. `scan` was retyped
  `llm_single` → **`llm_batch_agents`**, which keeps the page's folder-tier positive control AND
  covers the half of `GROUNDING_DIAL_TYPES` that had no page coverage anywhere. `brief`
  (`llm_emit`) gained the same `folder_scope` binding as the page-level **negative** witness — a
  type outside the gate, where the four malformed-`assets` rows make tier (2) miss, so the gate is
  the only thing between the user and a false claim. Three assertions were added there
  (`toContain(PHASE_TYPE_SENTENCES.llm_emit)`, no `Search {folder}`, no raw id). **No phase was
  added**, so no other row of that 113-test suite moved.
- **Files modified:** `frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx`
- **Commit:** `a1684e72`

**2. [Rule 1 — re-derivation] Two shipped assertions were legitimately invalidated, and are re-derived in place**

- **Found during:** Task 1.
- `phaseVocabulary.test.ts` — *"(3) a folder resolves last of the three config tiers, and beats
  human input"* proved tier (3) sits above tier (4) using `llm_human_input` + a folder ⇒
  `"Search Board Papers"`. The **ordering** claim is still true and still pinned; the **subject**
  was the over-claim itself. It is now proved on `llm_agent`, with the reason written beside it and
  the human-input case relocated to the WR-02 block where it asserts `"Wait for your approval"`.
- `phaseVocabulary.corpus.test.ts` — *"names the bound skill, the scoped folder and the bound
  template"* asserted `faceOf("non-contiguous", "stranded") === "Search Supplier Contracts"` on an
  `llm_single` step. The folder witness moved to the **real transcribed** PM-pack `retrieve`
  (`llm_agent`), and `pm-risk-register` was added beside it — strictly better evidence than a
  synthetic edge case. `stranded` became the WR-02 witness.
- Nothing was deleted or loosened; both replacements are stronger than what they replaced.

**3. [Rule 1 — the plan's own predicted fallout, handled as instructed] `materialConfigKey` repaired; the falsification control re-derived with its reason asserted**

- **Found during:** Task 1 (the plan predicted this under Task 2's acceptance criteria).
- **Issue:** After the gate, `non-contiguous`'s `second` and `stranded` render one face while their
  unrepaired material keys still differ ⇒ SC#5 check 2 reds.
- **Fix:** the plan's prescribed repair — `materialConfigKey` now mirrors **both** gated tiers,
  reading `GROUNDING_DIAL_TYPES` rather than re-typing it. Check 2 was **not** loosened and the gate
  was **not** reverted.
- **The fallout the plan did not predict, handled honestly:** with the key repaired, the
  falsification control *"FAILS on the pre-187 resolution for exactly the two same-type bound
  pairs"* drops to **one** member — `non-contiguous`'s pair is no longer materially different, so
  `preDerivedFace` no longer violates over it. Rather than silently editing the expected array, a
  **new case** asserts the reason as a measurement: `stranded`'s `folder_scope` is still present and
  still `[CORPUS_FOLDER_ID]`, `second` still has none, and their material keys are now **equal**.
  The control still bites (`branching`'s skill witness), and its reduction is now falsifiable rather
  than assumed.

**4. [Scope boundary — not fixed, already logged] the wider-glob axe flake**

`scripts/vitest-count-gate.cjs` over the whole workflows glob still reports the non-deterministic
`PublishGauntlet.test.tsx` / `WorkflowCanvas.test.tsx` axe failures recorded by plan 187-16 as
**D-ITEM-02**. Both files pass in isolation here (`WorkflowCanvas.test.tsx` is in this plan's
consumer set, 187 passed / 0 failed). Not caused by this plan, not chased.

No architectural change was needed; no Rule 4 checkpoint was reached. **No backend file, no
migration and no runtime source outside `phaseVocabulary.ts` was modified.**

## Threat Model Coverage

| Threat ID | Disposition | How it was discharged |
|---|---|---|
| T-187-17-01 | mitigate | Tier (3)'s predicate is the shipped `GROUNDING_DIAL_TYPES`. The TYPE-SPACE SWEEP derives its expectation from the constant and asserts an exact `toEqual` over all six types, with non-vacuity assertions on both halves of the partition. This is WR-02 itself. |
| T-187-17-02 | mitigate | The constant is read, never re-typed and never widened. Measured in the diff: the declaration line is absent from `git diff`. Three source fences pin it — identifier reads ≥ 3, the two members in exactly ONE array literal, and `[...GROUNDING_DIAL_TYPES]` asserted equal to the two backend dial types. |
| T-187-17-03 | mitigate | Every tier still returns; `derivedFaceOf`'s defensive reads are untouched and all six shipped TOTALITY cases stay green (absent config, unknown type, string `folder_scope`, non-string array member, numeric `skill_ref`, malformed `assets`). |
| T-187-17-04 | mitigate | The gated-out path falls through to the type sentence. Asserted at the flat core, at `derivedFaceOf`, at `nodeTitle` (`not.toContain` the folder display name AND the raw id, on `llm_single` and `programmatic`), in the corpus, and at the page. |
| T-187-17-05 | mitigate | Tier (3)'s comment carries the measured evidence including the `LlmEmitPhaseConfig` refutation; three stale doc statements (`phaseType` "gates tiers 2 and 4", `folderName`, and `derivedFace`'s "`null` when nothing is bound") were corrected in the same commit. |

## Known Stubs

None. No placeholder value, empty-data path or unwired component was introduced.

## Threat Flags

None. No network endpoint, auth path, file-access pattern or schema shape was added or moved.

## Self-Check: PASSED

- `frontend/src/components/workflows/phaseVocabulary.ts` — FOUND
- `frontend/src/components/workflows/phaseVocabulary.test.ts` — FOUND
- `frontend/src/components/workflows/phaseVocabulary.corpus.test.ts` — FOUND
- `frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx` — FOUND
- `.planning/phases/187-business-vocabulary-ai-seeded-canvas/187-17-SUMMARY.md` — FOUND
- commit `7bc9fff2` — FOUND
- commit `a1684e72` — FOUND
