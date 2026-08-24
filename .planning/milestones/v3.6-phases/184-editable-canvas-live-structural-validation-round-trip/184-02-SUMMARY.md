---
phase: 184-editable-canvas-live-structural-validation-round-trip
plan: 02
subsystem: workflows
tags: [pure-module, definition-mutation, workflow-canvas, g5-extraction, totality, unit-tests, react-free]

# Dependency graph
requires:
  - phase: 184-01
    provides: "`scripts/vitest-count-gate.cjs` — the D-184-08 per-file count differential, pinned at 16 files / 424 tests / 0 failing and already falsified"
  - phase: 183-read-only-canvas
    provides: "`phaseVocabulary.ts` (`PhaseSpecJSON`, `parseSkipTarget`, `nodeTitle`), `canvasModel.ts`'s render-order comparator, and the 15-entry `__fixtures__/canvasFixtures.ts` corpus"
provides:
  - "`definitionOps.ts` — the ONE pure mutation home for `WorkflowDefinition.phases`: renumber / addPhase / insertPhaseAt / movePhase / removePhase / patchPhaseConfig, zero React, zero store, zero API client, zero canvas import"
  - "R10a `canRemovePhase` + R10b `allowedTypesAt` — the two cheap SHAPE refusals, provably network-free"
  - "D-184-11 `slugForType` + `minimalPhaseFor` — slug from the closed 6-member type set only; a minimal phase that emits no key the backend union does not require"
  - "D-184-10 `resolveDrop` — the drag axis split as a pure function, with separation-by-construction asserted rather than commented"
affects: [184-04, 184-05, 185, 186, 187, 188]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A pure ops module whose render-order comparator is character-for-character the shipped projection's, so a computed position and a drawn column can never name different steps"
    - "Positional `assignIndices` after a splice, never `renumber` — re-sorting by stale indices silently undoes the edit it was meant to record"
    - "A refusal returns a discriminated outcome carrying its rendered sentence, so 'silent refusal' is not a representable state"
    - "Belt-and-braces network proof: a `?raw` source fence (the module cannot name the seam) plus a whole-suite `fetch` spy (nothing it calls does), both falsified"

key-files:
  created:
    - frontend/src/components/workflows/definitionOps.ts
    - frontend/src/components/workflows/definitionOps.test.ts
  modified: []

key-decisions:
  - "The stranding boundary is strictly-AFTER the deliverable, not at-or-after: inserting AT the emit's position puts the new step BEFORE it, so the plan's boundary would refuse the most natural authoring act while stating a reason that is false about the edit it refused"
  - "The five structural ops are NET-NEW, not lifted — the page declares no add/insert/move/remove/renumber at all; only `patchPhaseConfig` mirrors shipped code, and the docblock says so rather than claiming an extraction that did not happen"
  - "`orderPhases` + `assignIndices` are private; the public `renumber` is their composition, so the load-bearing comparator exists in exactly one place in the module"
  - "The patch parameter is spelled `Readonly<Record<string, unknown>>` inline rather than importing `PhaseFormPanel`'s `PhaseConfigPatch`, so the pure module stays free of any component import while staying mutually assignable at the 184-04 seam"
  - "`minimalPhaseFor` emits only union-REQUIRED keys; every field with a backend default is deliberately absent, because a re-materialised default is exactly the drift R2's round-trip property exists to catch"

patterns-established:
  - "Positive controls for BOTH new tripwires before trusting either: the contiguity walk was falsified by flattening the planted gap, the fetch spy by planting one real call"
  - "A guard-friendly docblock: name the forbidden token's CONCEPT ('the server validation seam', 'a network call') so the `?raw` fence never forces the comment to omit what it is talking about"

requirements-completed: [CANVAS-02]

# Metrics
duration: 22min
completed: 2026-07-27
---

# Phase 184 Plan 02: definitionOps — the One Pure Mutation Home Summary

**One React-free, store-free, network-free module now owns every mutation of `WorkflowDefinition.phases` — six structural ops whose `[0..n-1]` contiguity is proven over the entire 15-fixture corpus behind a falsified planted-gap control, plus both cheap shape refusals, the closed-set slug generator, and the drag axis split that makes a purely vertical drag unable to reach the definition by construction.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-07-27T04:14:00Z
- **Completed:** 2026-07-27T04:36:00Z
- **Tasks:** 2 (both `auto`, both committed atomically)
- **Files created:** 2 · **Files modified:** 0

## Accomplishments

- **D-184-05's boundary landed exactly as drawn.** `definitionOps.ts` (461 L) exports the six ops plus the two refusals, the slug pair and the drag resolver — and imports nothing from React, zustand, the API client or `canvasModel`. Persistence stayed on `WorkflowBuilderPage.tsx` untouched (`draftIdRef` / `creatingRef` / `onPersist` / `onSaveDraft`), so Phase 186 still has a real seam to rewrite.
- **R1 is now a plain unit test with no canvas and no store.** The `describe.each` sweep runs seven property assertions per fixture across all 15 shipped fixtures — 105 assertions of "`phase_index` is exactly `[0..n-1]`, no hole, no duplicate" — plus R1's named insert-at-2 case asserted index by index on the 5-phase maximum.
- **Both tripwires were falsified before being trusted** (below). An assertion that has only ever passed is not evidence, and this plan added two brand-new ones.
- **No shipped surface can regress.** No production caller is wired here — `WorkflowBuilderPage.tsx` is repointed in 184-04 — so both commits are additive-only. `git diff --diff-filter=D` across both reports zero deletions.
- **The blast radius did not move.** Every one of the 16 pinned files reported its exact pinned count on both commits, `tsc` stayed at the 33-error `develop` baseline, the canvas snapshot is byte-unchanged, and `npx vite build` exits 0.

## Task Commits

1. **Task 1: the six pure structural ops + R1's contiguity proof** — `f6ac55f7` (feat) — `definitionOps.ts`, `definitionOps.test.ts` (127 tests)
2. **Task 2: the two shape refusals, slug generation and the drag axis split** — `d3d21abd` (feat) — the same two files (171 tests)

## Files Created

- **`frontend/src/components/workflows/definitionOps.ts`** (461 L) — the one mutation home. Exports `renumber`, `addPhase`, `insertPhaseAt`, `movePhase`, `removePhase`, `patchPhaseConfig`, `canRemovePhase`, `allowedTypesAt`, `slugForType`, `minimalPhaseFor`, `resolveDrop`, plus the `RemovalOutcome` / `TypeChoice` / `PhaseTypeId` / `DropPoint` / `DropResolution` types, the `PHASE_TYPE_ORDER` tuple and the `STRANDING_REASON` sentence.
- **`frontend/src/components/workflows/definitionOps.test.ts`** (795 L, 171 tests) — the R1 corpus sweep, the planted-gap positive control, R10a/R10b proofs, the D-184-11 slug + minimal-phase proofs, the D-184-10 axis-split proof, the TOTALITY block and the two network fences.

## (c) ZERO assertions in pre-existing test files were edited

**Stated explicitly, as `<output>` requires: this plan edited ZERO assertions in any pre-existing test file, and made ZERO import-path-only changes.**

Proof, not claim:

```
$ git diff --stat f6ac55f7~1 HEAD -- 'frontend/src/**/*.test.ts' 'frontend/src/**/*.test.tsx'
 .../src/components/workflows/definitionOps.test.ts | 795 +++++++++++++++++++++
 1 file changed, 795 insertions(+)
```

Exactly one test file appears across the whole plan, it is **net-new**, and its diff is **795 insertions / 0 deletions**. There is no pre-existing test file in the diff at all, so the enumerable set of import-path-only changes is **empty**.

The 184-01 carve-out (`soulData.test.ts`'s glyph map) remains the only permitted assertion edit in phase 184, and it stays spent — `soulData.test.ts` reported its pinned **14** on both of this plan's gate runs.

## (a) The planted-gap control falsification

R1's contiguity assertion is only worth something if it can fail. The control, run against the committed suite:

**Falsified —** the planted `[0, 1, 3]` gap (the shipped `indexGap` shape, hand-authored inline) was temporarily flattened to `[0, 1, 2]`:

```
FAIL  src/components/workflows/definitionOps.test.ts > definitionOps — the contiguity
      walk is a real control > FINDS the planted [0,1,3] hole before renumber
AssertionError: expected [] to include 3
 ❯ src/components/workflows/definitionOps.test.ts:159:40
   159|     expect(contiguityGaps(plantedGap)).toContain(3)

 Tests  1 failed | 126 passed (127)
```

→ the walk **found nothing** once the hole was removed, and said so by name. **Restored —** `phase_index` returned to `3`; 127/127 green. The walk therefore genuinely distinguishes a contiguous spine from a holed one, and the same helper backs every one of the 105 sweep assertions.

A second, independent control ships alongside it: `contiguityGaps` also fires on a planted **duplicate** `phase_index` (`[0, 1, 1]`), so a renumber that collapses two steps onto one index is caught as well as one that leaves a hole.

**The `fetch`-spy tripwire was falsified too** (R10's "consults `/validate` zero times" is the other brand-new claim in this plan):

```
FAIL  definitionOps — zero network calls across the entire suite >
      the fetch spy recorded exactly 0 calls
AssertionError: expected "spy" to not be called at all, but actually been called 1 times
Number of calls: 1
 Tests  1 failed | 170 passed (171)
```

→ one planted `globalThis.fetch("/probe")` turned it red. Removed; 171/171 green. That proves the spy is a live wrapper and not a no-op — the failure mode where `globalThis.fetch` is absent under jsdom and the assertion passes vacuously is excluded.

## (b) Count-gate result, per commit

`node scripts/vitest-count-gate.cjs` was run after each task's changes were complete and before its commit.

| Commit | Task | Result | Total | Failed | Per-file decreases | 16 pinned files |
|---|---|---|---|---|---|---|
| `f6ac55f7` | 1 | **exit 0** | 551 (+127) | 0 | **none — every delta 0** | 16/16 present |
| `d3d21abd` | 2 | **exit 0** | 595 (+171) | 0 | **none — every delta 0** | 16/16 present |

The rise is `definitionOps.test.ts` alone, reported by the gate as a `new` row (127 then 171). Every pinned file — `canvasModel.fixtures.test.ts` 100, `canvasModel.purity.test.ts` 69, `phaseVocabulary.test.ts` 42, `WorkflowCanvas.test.tsx` 31, `canvasModel.test.ts` 26, `PublishGauntlet.test.tsx` 24, `WorkflowBuilderPage.canvas.test.tsx` 22, `PhaseFormPanel.test.tsx` 19, `WorkflowBuilderPage.test.tsx` 15, `PhaseSpineGraph.test.tsx` 14, `soulData.test.ts` 14, `WorkflowDoorSwitch.test.tsx` 13, `PhaseSpine.test.tsx` 11, `deriveTier.test.ts` 9, `WorkflowSoul.test.tsx` 8, `revertByteIdentical.test.tsx` 7 — reported **delta 0** on both runs.

The gate's report was written to `C:\Users\fhdmr\AppData\Local\Temp\` on both runs (outside every reload-watched tree), and `git status` on `frontend/` was clean after each.

## Verification Results

| Gate | Required | Observed (Task 1 → Task 2) |
|---|---|---|
| `npx vitest run src/components/workflows/definitionOps.test.ts` | 0 failures | **127 passed** → **171 passed**, 0 failed |
| `node scripts/vitest-count-gate.cjs` | exit 0, no per-file decrease | **exit 0** → **exit 0**; all 16 deltas 0 |
| `npx tsc -b \| grep -c "error TS"` | ≤ 33 (D-ITEM-183-01 differential) | **33** → **33** — equal to the `develop` baseline |
| `npx vite build` | exit 0 | **exit 0**, built in 6.33 s |
| `git diff --exit-code -- 'frontend/src/**/__snapshots__/*'` | exit 0 | **exit 0** (byte-unchanged) |
| `git diff --name-only -- supabase/migrations \| wc -l` | 0 (R3 — slot 114 stays RESERVED) | **0** |
| `grep -nE 'from "(react\|zustand\|@/lib/api\|@/components/workflows/canvasModel)"' definitionOps.ts` | no matches | **no matches** |
| `grep -n 'function parseSkipTarget' definitionOps.ts` | no matches | **no matches** (it is imported) |
| `grep -nE 'fetch\(\|workflows/validate\|from "@/lib/api"' definitionOps.ts` | no matches | **no matches** |
| The `renumber` comparator vs `canvasModel.ts:221-223` | character-for-character | **identical** — diffed side by side |
| `resolveDrop({x:100,y:0},{x:100,y:64},lanes)` | `reorderTo === null`, `dy === 64` | **`{ reorderTo: null, dy: 64 }`** |
| `slugForType` output for all six types + two collision rounds | matches `/^[a-z0-9-]+$/` | **all match** |
| `allowedTypesAt` entry count | exactly 6 at every tested index | **6** at `-5, 0, 1, 2, 3, 4, 99` |
| A refused delete's `reason` | non-empty, names the referring step's plain title | **`"Write it up" sends failures to this step. Remove that fallback first.`** |
| Whole-suite `fetch` spy | exactly 0 calls | **0** |
| Deletions in either commit | none | **none** (`git diff --diff-filter=D` empty) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `allowedTypesAt`'s stranding boundary is strictly-AFTER the deliverable, not at-or-after**

- **Found during:** Task 2
- **Issue:** The plan's action text specifies the refusal fires "when the definition already carries an `llm_emit` phase and `index` is **at or after** that phase's render position". But `index` is `insertPhaseAt`'s render position, and inserting **at** position *p* places the new step **at** *p*, pushing the current occupant to *p+1*. So an insert at the emit's own position lands the new step **before** the deliverable, and the deliverable simply shifts down one and stays terminal. Under the at-or-after boundary the picker would refuse "add a step immediately before the deliverable" — the single most natural authoring act on a Starter-Library-shaped workflow — and would refuse it with the sentence *"This would come after the deliverable"*, which is factually false about the edit being refused. R10 says no refusal is silent; a refusal whose stated reason lies is strictly worse than a silent one, and it is the user-facing form of the D-ITEM-183-02 "a comment that lies" trap.
- **Fix:** the boundary is `index > lastEmitPosition`. On a definition with the emit at render position 2, indices 0, 1 and 2 offer all six types enabled; index 3 and beyond mark all six disabled with `STRANDING_REASON`. The plan's own hedge — "*(recording whatever the rule yields)*" — anticipated the executor recording the actual rule, and the acceptance criteria that do not depend on the boundary (six entries always, never an omitted type, a non-empty reason, nothing disabled without an emit) are all met verbatim.
- **Files modified:** `frontend/src/components/workflows/definitionOps.ts` (the `allowedTypesAt` docblock carries a ⚠ BOUNDARY paragraph pointing here), `definitionOps.test.ts` (the test names the slot and cross-references this deviation, so a verifier does not read it as the plan being ignored)
- **Verification:** 6 dedicated tests, including a two-`llm_emit` case proving the measurement is taken from the **last** deliverable, and a real Starter Library shape (`risk-register`, emit terminal at position 1) where index 1 is enabled and index 2 is disabled
- **Committed in:** `d3d21abd`

### Honesty corrections applied while writing (not defects — anti-drift discipline)

**2. [Rule 2 - Missing Critical] The docblock does not claim an extraction that did not happen**

- **Found during:** Task 1
- **Issue:** The plan frames the whole module as "lifting the pure ops out of `WorkflowBuilderPage.tsx`". 184-CONTEXT anti-drift note 3 says an in-code claim of a prior extraction is unverified until grepped — `soulData.ts` once asserted an extraction that had not happened. Grepping the page for `phase_index|addPhase|removePhase|renumber|slice\(|splice` returns **no matches**: the page declares no structural mutation of any kind, because the shipped canvas is read-only. Only `onPhaseChange` (`:334-345`) exists.
- **Fix:** the module's "STATE OF THE EXTRACTION" paragraph says precisely that — `patchPhaseConfig` mirrors `WorkflowBuilderPage.tsx:334-345` character for character and **the page is not yet repointed** (184-04 does that, so two copies exist on purpose right now); the other five ops are **net-new**, and claiming otherwise would be the comment that lies.
- **Files modified:** `frontend/src/components/workflows/definitionOps.ts` (docblock only)
- **Committed in:** `f6ac55f7`

**3. [Rule 3 - Blocking] `insertPhaseAt` / `movePhase` / `removePhase` assign indices positionally instead of calling `renumber`**

- **Found during:** Task 1
- **Issue:** The plan's wording for each structural op is "…and renumbers". Taken literally — splice, then call `renumber` — the op is **wrong**: `renumber` re-sorts by `phase_index`, and after a splice those values are the *stale* incoming ones. `insertPhaseAt(evalCoverage, 2, spec)` with any `spec.phase_index` would drag the new step to wherever that number happened to point, silently undoing the edit and breaking R1's named case.
- **Fix:** two private primitives — `orderPhases` (the comparator, in exactly one place) and `assignIndices` (0-based position rewrite). The exported `renumber` is their composition, so its contract is unchanged and the comparator is still character-for-character `canvasModel.ts:221-223`; the structural ops resolve render order, edit positionally, then assign. The reason is documented on `assignIndices` so nobody "simplifies" it back.
- **Files modified:** `frontend/src/components/workflows/definitionOps.ts`
- **Verification:** a dedicated test feeds `newStep()` with `phase_index: 999` through `insertPhaseAt(…, 1, …)` and asserts it lands at 1, not at the end
- **Committed in:** `f6ac55f7`

---

**Total deviations:** 3 auto-fixed (1 bug, 1 missing-critical, 1 blocking)
**Impact on plan:** none expands scope; the file set is still exactly the two in `files_modified`. Deviation 1 is the only behavioural difference from the plan text and it is strictly more correct. Deviations 2 and 3 are the plan's own intent, implemented correctly rather than literally.

## Design decisions worth carrying forward

- **Two private primitives, one public composition.** `orderPhases` holds the load-bearing comparator once; `assignIndices` holds the positional rewrite once. Every op is a three-line composition of them, so "which ops renumber" is readable at a glance and the comparator cannot drift from `canvasModel`'s.
- **The refusal carries its sentence.** `RemovalOutcome`'s refusing branch has a required `reason: string`, so a silent refusal is not a representable state. The reason names the referring step by `nodeTitle` (its plain-language title), never by slug — the slug lives behind the ⌥ Technical-names reveal.
- **`minimalPhaseFor` returns a fresh object graph per call.** A shared `available_tools: []` reference between two created steps would alias, and the test pushes into one to prove the other is untouched.
- **`resolveDrop` reads the pitch from `lanes`, not from `CANVAS_LAYOUT`.** That is what keeps the module free of a canvas import while still agreeing with the layout table — the view derives the lane centres from its own constants and passes them in.
- **The patch type is spelled inline.** `Readonly<Record<string, unknown>>` is structurally `PhaseFormPanel.tsx:48`'s `PhaseConfigPatch`; importing the real name would drag a React component into a pure module for zero benefit, and the two are mutually assignable so 184-04 needs no adapter.

## Threat Model Disposition

| Threat ID | Disposition | Status |
|---|---|---|
| T-184-02-01 (DoS — resolver totality) | mitigate | **CLOSED.** A dedicated TOTALITY block asserts every op against an empty array, an unknown slug, a missing `validators` key, an unknown `phase_type`, a malformed `on_failure` (`"skip_to_phase:"` with an empty target), a non-finite index and an out-of-range index. `clampPosition` maps NaN/±Infinity to 0; `resolveDrop` early-returns on fewer than two lanes and on a zero pitch; `requiredConfigFor`'s `default` arm is the `deriveTier.ts:119-127` runtime-safe exhaustiveness guard. Asserted, not merely documented |
| T-184-02-02 (tampering — `slugForType` → definition JSONB) | mitigate | **CLOSED.** The slug is a closed constant plus a decimal suffix. A test feeds a definition whose `name` is `<script>alert(1)</script>` and whose `prompt` is `'; DROP TABLE phases; --`, and asserts the output for all six types still matches `/^[a-z0-9-]+$/`. `minimalPhaseFor` emits only union-required keys — a test enumerates 15 default-bearing optional fields and asserts each is ABSENT, so `extra="forbid"` cannot be tripped by a re-materialised default |
| T-184-02-03 (repudiation — a client refusal mistaken for a server verdict) | mitigate | **CLOSED.** Belt: a `?raw` source fence proves `definitionOps.ts` contains no `fetch(`, no `workflows/validate`, no `@/lib/api` import, and no `XMLHttpRequest`/`EventSource`/`sendBeacon`. Braces: a whole-suite `fetch` spy recorded 0 calls, and was falsified with a planted call. Neither refusal produces a severity or a code — D-182-06 intact |
| T-184-02-SC (supply chain — npm installs) | accept | **Honoured — this plan installed nothing.** `frontend/package.json` and the lockfile are absent from both commits. `zundo` remains absent and is 184-04's job |

## Scope Fence Compliance

- **Frontend only.** Both commits touch exactly two files, both under `frontend/src/components/workflows/`. Nothing under `backend/`, `scripts/` or `supabase/`.
- **No migration.** `git diff --name-only -- supabase/migrations` returns 0 lines; slot 114 stays RESERVED.
- **No env var changed. No dependency added. No production caller wired** — `WorkflowBuilderPage.tsx` is untouched, so no shipped surface can regress from this plan.
- **`__fixtures__/canvasFixtures.ts` untouched** (D-184-17 / its acceptance guard). Every extra shape needed by the suite is hand-authored inline in the test file, including the `indexGap` mirror used by the positive control.
- **Only `--reporter=default` / the gate's own `--reporter=json`.** No watch flag committed anywhere.

## Issues Encountered

- **The plan's "…and renumbers" phrasing is a trap if taken literally.** Diagnosed and handled as Deviation 3 rather than shipped as a silent off-by-everything bug. Worth flagging to 184-04/184-05: `fromCanvas` deliberately does NOT renumber, and `renumber` is the only function in the phase that does.
- **The `allowedTypesAt` boundary is off by one in the plan text** (Deviation 1). It would have shipped a refusal whose stated reason was false. Flagged here because 184-04's `StepTypePicker` consumes this exact function and will inherit the corrected boundary.

## User Setup Required

None. No external service, no env var, no migration, no dependency.

## Next Phase Readiness

- **184-04 is unblocked and its inputs are named.** It repoints `WorkflowBuilderPage.tsx`'s `onPhaseChange` at `patchPhaseConfig` (collapsing the two copies this plan deliberately left standing), wires `StepTypePicker` to `allowedTypesAt` + `slugForType` + `minimalPhaseFor`, and wires `onNodeDragStop` to `resolveDrop`. `zundo` is still absent and is that plan's install, under its own legitimacy verdict.
- **184-05 inherits the boundary.** `canvasModel.fromCanvas` must NOT renumber — `renumber` lives here and nowhere else, or the `indexGap` fixture's round-trip identity breaks.
- **Phase 185 lands on `allowedTypesAt`'s row shape.** `TypeChoice` already has room for a per-type disabled reason; a graded-governance dial adds data to the row, not a new return shape.
- **The zero-assertion-edit gate is still armed and the carve-out is still spent.** This plan consumed none of it.

## Self-Check: PASSED

- `frontend/src/components/workflows/definitionOps.ts` — FOUND
- `frontend/src/components/workflows/definitionOps.test.ts` — FOUND
- `scripts/vitest-count-gate.cjs` (consumed, not modified) — FOUND
- Commit `f6ac55f7` — FOUND
- Commit `d3d21abd` — FOUND
- `.planning/phases/184-editable-canvas-live-structural-validation-round-trip/184-02-SUMMARY.md` — FOUND

---
*Phase: 184-editable-canvas-live-structural-validation-round-trip*
*Completed: 2026-07-27*
