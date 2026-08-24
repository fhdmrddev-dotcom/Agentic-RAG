---
phase: 187-business-vocabulary-ai-seeded-canvas
plan: 16
subsystem: frontend/workflow-builder
tags: [vocab-02, cr-01, cr-02, d-187-08, d-187-10, d-185-07, d-185-09, gap-closure, tdd, blocker-fix]
requires:
  - "phaseVocabulary.groundingCauseOf(phase, kbTools) — the ONE client grounding derivation, Phase 185 + 187-04"
  - "definitionOps seed-receipt copy block (heading / lead / one-way rule / per-step reason) — plan 187-10"
  - "SeedReceipt { phases, kbTools, nameContext?, open, onDismiss } — plan 187-13"
  - "backend LlmEmitPhaseConfig.citation_policy: Literal[strict|flag|partial|draft] = strict"
provides:
  - "seedReceiptCarriedLead(carriedCount) — the sibling sentence for already-set + escalated, claiming no authorship"
  - "seedReceiptGroundingLead re-specified: its parameter is the DETECTED count, never the sealed one"
  - "SeedReceipt data-cause per row + data-detected-count on the section — two facts, two numbers"
  - "the authorship word-class fence with a positive control — CR-01 as a permanent regression class"
affects:
  - "any future consumer reading data-grounded-count — it still means the SEALED total (the number of canvas seals), unchanged"
tech-stack:
  added: []
  patterns:
    - "a fixture-representability guard: every test literal checked against the backend Literal that produces it"
    - "one sentence per cause instead of one filtered list — the seal stays explained AND the claim stays true"
    - "a word-class fence over rendered textContent, with a POSITIVE control so it cannot pass vacuously"
key-files:
  created:
    - ".planning/phases/187-business-vocabulary-ai-seeded-canvas/187-16-SUMMARY.md"
  modified:
    - frontend/src/components/workflows/SeedReceipt.test.tsx
    - frontend/src/components/workflows/SeedReceipt.tsx
    - frontend/src/components/workflows/definitionOps.ts
    - frontend/src/components/workflows/definitionOps.test.ts
    - .planning/phases/187-business-vocabulary-ai-seeded-canvas/deferred-items.md
decisions:
  - "Took the reviewer's SECOND fix (a sentence per cause), not the minimal `if (cause !== \"detected\") continue` — filtering the list would have left the typical draft's deliverable wearing an unexplained seal, trading a false sentence for the exact SC#3 hole the receipt exists to close. Verified live: canvasModel.isGrounded is `groundingCauseOf(...) !== null`, so the card seals for all three causes."
  - "SEED_RECEIPT_ONE_WAY_RULE moved with the detected lead rather than staying with the list. It is the DETECTED lock (D-185-07); over an already-set or escalated step it is the same false claim in different words."
  - "The carried sentence is PASSIVE and names the step's own settings, not the user and not the AI — on a generated draft the `strict` default came from the generator, on an authored one from the author, and a sentence that picked either would be false half the time."
  - "data-grounded-count keeps meaning the SEALED total (the count of ⛨ marks the canvas draws); data-detected-count is added beside it rather than redefining a shipped attribute."
  - "The zero case keeps `citation_policy: \"draft\"` — `strict` would seal the deliverable and make the D-187-10 fixture non-empty, so the only honest zero case uses a different representable member."
metrics:
  duration: ~55 min
  tasks: 2
  commits: 2
  completed: 2026-08-02
---

# Phase 187 Plan 16: The receipt stops claiming credit it has not earned — Summary

The seed receipt told users the AI had set their deliverable to *must prove it* on the majority of
generated drafts. It had not — the deliverable's own `citation_policy` default did. Each sentence
now counts exactly the steps it is true of, every sealed step is still named, and the suite that
should have caught this can finally see it move.

## What Was Built

**Task 1 — the falsification (commit `77668751`, `test(...)` RED gate)**

The suite's `llm_emit` fixtures carried a `citation_policy` value that is **not a member** of
`LlmEmitPhaseConfig.citation_policy` in `backend/app/models/harness.py`, re-read at live HEAD:

```python
citation_policy: Literal["strict", "flag", "partial", "draft"] = "strict"
```

No `model_validate()`-passing row can carry the value the fixtures used, so no `/generate` response
ever did. `groundingCauseOf` therefore returned `null` for a step that in production is **always**
`already-set` — the branch carrying the defect was switched off inside the only suite that guards
the receipt. That is CR-02: green over an unrepresentable fixture is not coverage.

Repaired: the grounded fixture's deliverable now carries the **shipped default** `"strict"`; the
D-187-10 zero-case fixture uses `"draft"` (the default would seal it and make the zero case
non-empty), with a comment block above both naming the backend symbol as the source of the member
set. The unrepresentable value is assembled from parts so a grep of the guard file cannot satisfy
its own fence.

**Task 2 — one honest sentence per cause (commit `5c613bf4`, GREEN)**

- `seedReceiptGroundingLead` re-specified: its parameter is the **detected** count. The returned
  strings are byte-unchanged — they were always true of `detected` steps and only of those.
- New `seedReceiptCarriedLead(n)` for `already-set` + `escalated`: `""` at zero (same arrival shape
  as its sibling, D-187-10), passive with no first-person application verb, self-contained so it can
  render first or alone, and promising no one-way lock.
- `SeedReceipt` reads the cause instead of flattening it: `cause` rides on `GroundedRow`, renders as
  `data-cause` per `<li>`, and the two counts are derived at the point of use. `data-detected-count`
  joins `data-grounded-count` on the section.
- **Every sealed step is still listed.** The list renders whenever `rows` is non-empty, so the
  sketch's *"never let the seal arrive unexplained — that is the whole of SC#3"* rule survives the
  fix rather than being traded for it.

## The RED, recorded verbatim

Run before any component edit, `cd frontend && npx vitest run src/components/workflows/SeedReceipt.test.tsx`
— **12 failed | 34 passed (46)**. The load-bearing pairs:

```
FAIL  SeedReceipt — the copy is the copy module's > renders each sentence identically to its definitionOps export
AssertionError: expected '3 steps read your documents, so I set…' to be '2 steps read your documents, so I set…'
  Expected: "2 steps read your documents, so I set them to must prove it."
  Received: "3 steps read your documents, so I set them to must prove it."
```

```
FAIL  SeedReceipt — it never claims an application it did not make > says nothing of the sort over a draft the AI grounded nothing in
AssertionError: expected 'Here\'s what I built — 3 steps✕1 step…' not to contain 'so I set'
  Expected: "so I set"
  Received: "Here's what I built — 3 steps✕1 step reads your documents, so I set it to must prove it.
             You can't turn that off — but you can see exactly where it applies.⛨Must prove it
             Produce the renewal pack — it already has to cite its sourcesEverything else is yours
             to change. Nothing is saved or published yet."
```

That second block is CR-01 in one string: a draft where the AI grounded **nothing** announced that
it had grounded one step, and then stated the one-way lock over a step whose own policy dial holds
it. Also red, from the same run:

```
FAIL  > the DETECTED subset is exactly the two steps that read the documents
AssertionError: expected [] to deeply equal [ 'contracts', 'policy_check' ]
FAIL  > each listed row carries the cause the ONE derivation returns for its phase
AssertionError: expected [ [ 'contracts', null ], …(2) ] to deeply equal [ [ 'contracts', 'detected' ], …(2) ]
FAIL  > an escalated step > renders NO detected lead and NO one-way rule for it — the author did that
AssertionError: expected <span …(1)></span> to be null
```

The `emit` membership evidence the plan asked for arrived in a different failure than predicted —
see Deviation 1 below; the received DOM printed by the empty-palette red shows the row verbatim:

```
Received: <ul data-testid="seed-receipt-grounded-list">
            <li data-slug="emit" data-testid="seed-receipt-step-emit"> … it already has to cite its sources
```

## Measurements

| Gate | Before | After |
|---|---|---|
| `SeedReceipt.test.tsx` | 33 passed | **47 passed** (+14) |
| `definitionOps.test.ts` | 223 passed | **227 passed** (+4) |
| both files together | 256 | **274, 0 failed** |
| 5-file consumer set, isolated | — | **447 passed, 0 failed** |
| `npx tsc -b` total `error TS` | 33 | **33** (zero delta) |
| `npx tsc -b` errors in `src/components/workflows/` | 0 | **0** |
| `npx vite build` | — | **exit 0** |

Source fences on `SeedReceipt.tsx`, measured after the edit: `data-cause` 1, `data-detected-count`
1, API-client/fetch/EventSource **0**, scheduler + timing-offset names **0**, the word *delay* in
code or prose **0**, any KB tool id **0**, `dangerouslySetInnerHTML` **0**.
`git status --porcelain frontend/src/pages/WorkflowBuilderPage.tsx supabase/migrations` → empty
(the D-187-14 mount cap is untouched; no migration exists to touch).

## Deviations from Plan

**1. [Rule 1 — plan prediction corrected] The `listedSlugs()` RED named `emit` in a different assertion than predicted**

- **Found during:** Task 1, at the RED run.
- **Issue:** The plan's acceptance criterion asked the SUMMARY to record a `listedSlugs()` membership
  failure naming `emit`. The plan's own `<action>` for the same task instructs the split of that
  assertion into a SEALED membership case and a DETECTED subset case *in the same edit* as the
  fixture repair — so by the time the suite ran, the sealed expectation already included `emit` and
  that case was green. The falsification is real and was observed; it simply surfaced through the
  three assertions quoted above (the DETECTED subset returning `[]`, every row's `data-cause`
  reading `null`, and the empty-palette red whose received DOM prints the `emit` row).
- **Fix:** none needed in code. Recorded here rather than manufacturing a throwaway intermediate
  commit whose only purpose would be to make a predicted string appear.
- **Files modified:** none.

**2. [Rule 1 — re-derivation] A THIRD shipped assertion was legitimately invalidated by the repair**

- **Found during:** Task 1, at the RED run.
- **Issue:** `renders with an EMPTY server tool list — an unread palette marks nothing` asserted that
  no list renders at all. That was only true while the deliverable carried an unrepresentable
  policy. `kbTools: []` suppresses **detection**; it must not un-mark a step held by its own
  `citation_policy` — `phaseVocabulary.GroundingInputs.kbTools` says exactly this ("an unread palette
  must not un-mark a locked step, and it must not invent one either"). The plan named two
  re-derivations; this is a third.
- **Fix:** split into two cases — `an EMPTY server tool list DETECTS nothing — and un-marks nothing
  either` (zero detected, no lead, the deliverable still explained) and `an empty palette over a
  draft with no deliverable lists nothing at all` (the original claim, over a fixture where it is
  actually true). Strictly stronger than what it replaced; the re-derivation and its reason are
  written into the case body.
- **Files modified:** `frontend/src/components/workflows/SeedReceipt.test.tsx`
- **Commit:** `77668751`

**3. [Scope boundary — logged, not fixed] `scripts/vitest-count-gate.cjs` reports 7–8 failures across the whole workflows glob**

- **Found during:** post-Task-2 verification.
- **Issue:** The count gate runs a wider glob than this plan's verification block. It reports
  `PublishGauntlet.test.tsx` (5) and `WorkflowCanvas.test.tsx` axe cases (2) failing — and a
  *different count on consecutive runs* (8, then 7), which is the signature of concurrency flake,
  not a deterministic break.
- **Not caused by this plan:** both files pass in isolation, both pass when run together, and both
  pass when run together **with** `SeedReceipt.test.tsx` (128 passed). The 5-file consumer set this
  plan is accountable for is 447 passed / 0 failed. The plan's own verification block says to run
  that set ISOLATED precisely because the wider suite is measured flaky.
- **Action:** logged as `D-ITEM-02` in the phase's `deferred-items.md`. Not fixed — out of scope.

No architectural changes were needed; no Rule 4 checkpoint was reached.

## Threat Model Coverage

| Threat ID | Disposition | How it was discharged |
|---|---|---|
| T-187-16-01 | mitigate | The lead counts `cause === "detected"` only; the one-way rule renders inside that paragraph. The word-class fence asserts the "so I set" construction is absent over both a zero-detected draft and an author-escalated draft, with a positive control proving it IS present when the AI really did apply it. |
| T-187-16-02 | accept | Display-only, unchanged (D-185-09). No run-time gate was touched. |
| T-187-16-03 | mitigate | `groundingCauseOf` remains the only classifier; `data-cause` is its output carried through. No KB tool id and no cause branch was added to the component — source greps return 0. |
| T-187-16-04 | mitigate | Every generated string still renders as a plain React text child; `dangerouslySetInnerHTML` count 0. |
| T-187-16-05 | mitigate | Every `citation_policy` literal in the suite is `strict` (×2) or `draft` (×1), checked against the backend Literal at live HEAD, plus a runtime case asserting fixture membership and that the default is exercised. |
| T-187-16-06 | mitigate | No scheduler call, frame callback, index-derived offset or the word *delay* appears in the component — the no-staging source fence still passes. |

## Known Stubs

None. No placeholder value, empty-data path or unwired component was introduced.

## Threat Flags

None. No network endpoint, auth path, file access pattern or schema shape was added or moved.

## Self-Check: PASSED

- `frontend/src/components/workflows/SeedReceipt.tsx` — FOUND
- `frontend/src/components/workflows/SeedReceipt.test.tsx` — FOUND
- `frontend/src/components/workflows/definitionOps.ts` — FOUND
- `frontend/src/components/workflows/definitionOps.test.ts` — FOUND
- `.planning/phases/187-business-vocabulary-ai-seeded-canvas/187-16-SUMMARY.md` — FOUND
- commit `77668751` — FOUND
- commit `5c613bf4` — FOUND
