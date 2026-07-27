---
phase: 184-editable-canvas-live-structural-validation-round-trip
plan: 04
subsystem: workflows
tags: [zustand, zundo, undo-redo, state-home-refactor, g5-extraction, per-mount-store, react-19, wave-0-complete]

# Dependency graph
requires:
  - phase: 184-01
    provides: "`scripts/vitest-count-gate.cjs` — the D-184-08 per-file count differential, pinned at 16 files / 424 tests / 0 failing"
  - phase: 184-02
    provides: "`definitionOps.ts` — the six pure structural ops, `slugForType` / `minimalPhaseFor`, and the corrected `allowedTypesAt` boundary every store action delegates to"
  - phase: 184-03
    provides: "`PhaseNodeCard` + the `PhaseNode` adapter — the stable face the editing surface renders (consumed later; untouched by this plan)"
provides:
  - "`zundo@2.3.0` — the phase's ONE net-new dependency, installed under a re-verified `[OK]` legitimacy verdict"
  - "`builderStore.ts` — the per-Builder-mount `createBuilderStore()` factory: TrackedSlice/untracked split, verdict-safe `partialize`, 50-entry cap, and the D-184-02 selective `handleSet` flush"
  - "`BuilderStoreProvider.tsx` — per-mount store context with an OPTIONAL accessor plus `useBuilderTemporal`, the React-19-safe temporal selector"
  - "`builderStore.test.ts` — 33 store-unit assertions that DISCHARGE research assumption A3 by falsification"
  - "`WorkflowBuilderPage.tsx` repointed: the definition lives in the store; persistence, composition, selection and the flag gate are unchanged"
affects: [184-05, 184-07, 184-08, 184-10, 184-11, 184-12, 184-13, 185, 186, 188]

# Tech tracking
tech-stack:
  added:
    - "zundo@2.3.0 (MIT · 336k downloads/wk · no postinstall · peer-clean against the already-direct zustand@5.0.13)"
  patterns:
    - "A per-mount store FACTORY where the app's only other store is a module singleton — because an undo stack that outlives its document is a defect, not a feature"
    - "A `partialize` justified as a VERDICT guard rather than a nudge guard: the cosmetic field is absent from the store by construction, so the filter's job is to keep SERVER state out of the undo stack"
    - "A debounce whose pending entry is the FIRST of a run, not the last — 'one typed sentence is one undo' is a claim about what undo RESTORES, not about how many entries exist"
    - "A research assumption discharged by making the test fail on purpose, with both observations recorded"

key-files:
  created:
    - frontend/src/components/workflows/builderStore.ts
    - frontend/src/components/workflows/BuilderStoreProvider.tsx
    - frontend/src/components/workflows/builderStore.test.ts
  modified:
    - frontend/package.json
    - frontend/package-lock.json
    - frontend/src/pages/WorkflowBuilderPage.tsx

key-decisions:
  - "The pending args of a coalescing run are the FIRST, not the last — the research pattern's overwrite would have made ⌘Z step back one keystroke instead of one sentence, silently satisfying every length assertion"
  - "A document-replacing transition (`setDrafted` / `setComposing`) CLEARS the temporal history and does not mark the draft dirty — undoing a fresh generate back into the previous workflow is not a save-boundary crossing, it is data loss"
  - "`Omit<BuilderDefinition, 'phases'>` collapses to `{}` because the interface carries an index signature; the meta type is a key-remapped mapped type so the field list is DECLARED once, in the page, and cannot drift"
  - "`selectDefinition` takes only the two halves it reads, so a React caller feeds it selector values instead of reaching for `getState()` in a rendered value"
  - "`requirements.mark-complete` was deliberately NOT run — see the Requirements section"

patterns-established:
  - "Falsify a debounce by short-circuiting it: replacing the coalescing branch with an immediate push turned exactly the six coalescing assertions red and left the other 27 green, which is what makes those six evidence"
  - "Check a new lint finding against the shipped analog before treating it as a defect — `react-refresh/only-export-components` fires identically on both shipped providers"

requirements-completed: []  # CANVAS-02 and CANVAS-03 are this plan's frontmatter requirements and NEITHER is complete. This plan ships the state substrate with zero user-observable canvas editing. REQUIREMENTS.md deliberately left Pending — see "Requirements" below.

# Metrics
duration: 40min
completed: 2026-07-27
---

# Phase 184 Plan 04: The Per-Mount Temporal Builder Store Summary

**The working definition now lives in ONE per-Builder-mount `zustand` + `zundo` store whose history behaves as designed and was PROVEN to before anything was built on it — a structural edit pushes one entry synchronously, a run of config edits coalesces into one entry that restores the state before the sentence began, a server verdict can never enter the stack, and the cosmetic nudge is structurally absent — with `WorkflowBuilderPage.tsx` repointed onto it while persistence, composition, selection and the flag gate stayed exactly where D-184-05 says they belong, and all 44 shipped assertions across the three gating suites passing UNMODIFIED.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-07-27T05:02:00Z
- **Completed:** 2026-07-27T05:41:00Z
- **Tasks:** 3 (all `auto`, all committed atomically)
- **Files created:** 3 · **Files modified:** 3 (two of them `package.json` + the lockfile)

## Task Commits

1. **Task 1: install `zundo` + the per-mount store and its provider** — `5ff18388` (feat) — `package.json`, `package-lock.json`, `builderStore.ts` (new), `BuilderStoreProvider.tsx` (new)
2. **Task 2: falsify research assumption A3** — `873ca76c` (test) — `builderStore.test.ts` (new, 33 tests)
3. **Task 3: repoint the page — persistence untouched** — `45e687a8` (refactor) — `WorkflowBuilderPage.tsx`, `builderStore.ts`

## (a) The A3 falsification — both observations

184-RESEARCH.md's assumptions log carries **A3 at MEDIUM confidence**: zundo's `handleSet` *call signature* is verified from upstream source, but *the debounce-with-flush composition built on it* is copied from no shipped example. Its own discharge instruction is to prove it with a store unit test **before** building the toolbar on it. A suite that has only ever passed does not discharge anything, so the coalescing branch was deliberately short-circuited.

**The probe** — inserted at the top of `handleSet`'s config arm, so every edit pushes immediately:

```ts
// A3 FALSIFICATION PROBE — TEMPORARY, REMOVED IMMEDIATELY BELOW.
push(...args)
return
```

**Falsified — 6 failed / 27 passed (33):**

```
× two patchConfig calls inside 500 ms produce ONE entry, and none before the flush
    AssertionError: expected [ { …(3) }, { …(3) } ] to have a length of +0 but got 2
× a third patchConfig AFTER the flush starts a new run and produces a second entry
    AssertionError: expected [ { …(3) }, { …(3) } ] to have a length of 1 but got 2
× the entry a coalesced run records is the state BEFORE the run began
    AssertionError: expected [ { slug: 'search', …(2) }, …(2) ]
                    to be [ { slug: 'search', …(2) }, …(2) ] // Object.is equality
× flushHistory() commits a coalescing run early — the field-blur path
× records [config-run, structural] in that order
× undoing twice steps back through the structural act and then the whole sentence
```

Two typed keystrokes produced **two** undo entries instead of one, and the entry the third assertion inspects was the wrong object *by identity* — exactly the failure D-184-02 exists to prevent, named by the assertions rather than inferred.

The **27 that stayed green** are as informative as the 6 that went red: every structural, `partialize`, nudge-absence, limit-eviction, dirty and `selectDefinition` assertion is independent of the coalescing branch, so the probe isolated precisely the claim A3 doubted.

**Restored —** probe removed (`grep -c "FALSIFICATION PROBE" builderStore.ts` → **0**), **33/33 green**, and `git diff` against the Task-1 commit shows `builderStore.ts` byte-identical apart from the Task-3 type fixes below.

**A3 is discharged.** The composition works as written, with one correction the falsification itself surfaced — see Deviation 1.

## (b) The `onPersist` diff hunk, verbatim

D-184-05's whole point is that this block does not move. `git diff -U6` on it, quoted in full:

```diff
   const onPersist = useCallback(async (): Promise<boolean> => {
-    if (state.phase !== "drafted") return false
-    const def = state.definition as unknown as Record<string, unknown>
+    const snapshot = store.getState()
+    if (snapshot.builderPhase !== "drafted") return false
+    const def = selectDefinition(snapshot) as unknown as Record<string, unknown>
     if (draftIdRef.current === null) {
       // First save: create EXACTLY ONCE. If a create is already in flight,
       // skip — re-running it would collide on UNIQUE(slug, version) → 500.
       if (creatingRef.current) return false
       creatingRef.current = true
       try {
```

**The create-once-then-PATCH guard is untouched.** `draftIdRef`, `creatingRef`, the in-flight skip, the `finally` reset, the `updateWorkflowDraft` branch and the `return true` are all byte-identical; the only other edit in the whole callback is its dependency list (`[state]` → `[store]`), which is what makes it referentially stable for the first time. `onSaveDraft`, the transient-timer cleanup and every `savedTimerRef` line are entirely absent from the diff. Phase 186 still has the exact seam it was promised.

## (c) Every import-path-only change in Wave 0 (184-01 → 184-04), enumerated

D-184-08 permits import-path-only changes and requires **every one** to be listed. Across all four Wave-0 plans there are **ten**, in **three files**.

### 184-01 (`ffb3e9cf`) — 2, in `frontend/src/lib/phaseGlyph.tsx`

| # | Change | Why |
|---|---|---|
| 1 | `import Robot from "~icons/fluent-emoji/robot"` → `import Compass from "~icons/fluent-emoji/compass"` | D-184-07's `llm_agent` glyph swap; the deep-subpath import IS the icon binding, so the path is the change |
| 2 | `import BustsInSilhouette from "~icons/fluent-emoji/busts-in-silhouette"` → `import Handshake from "~icons/fluent-emoji/handshake"` | D-184-07's `llm_batch_agents` swap (the luminance-34.5 outlier) |

### 184-02 (`f6ac55f7`, `d3d21abd`) — 0

Both commits are net-new files. `git diff --stat` restricted to test files shows one file, 795 insertions / 0 deletions. **The enumerable set is empty.**

### 184-03 (`c3100c36`, `b7603244`) — 8, all in `frontend/src/components/workflows/PhaseNode.tsx`

| # | Change | Why |
|---|---|---|
| 3 | **Removed** `import { createElement, type ReactNode } from "react"` | Both bindings existed only for `renderPhaseMark`, which moved |
| 4 | **Removed** `import { PHASE_GLYPHS } from "@/components/workflows/soulData"` | Used only by `renderPhaseMark` |
| 5 | **Removed** `import { phaseGlyph } from "@/lib/phaseGlyph"` | Used only by `renderPhaseMark` |
| 6 | **Removed** `import type { Grounding } from "@/components/workflows/phaseVocabulary"` | Used only to type `GROUNDING_TONE` |
| 7 | **Narrowed** `import { StatusChip, type ChipTone } from "@/components/org/StatusChip"` → `import { StatusChip } from …` | `ChipTone` typed `GROUNDING_TONE` only |
| 8 | **Added** `import { DEFAULT_TINT, GROUNDING_TONE, ICON_TINT, renderPhaseMark } from "@/components/workflows/nodePresentation"` | The four moved declarations |
| 9 | **Removed** `import { StatusChip } from "@/components/org/StatusChip"` | The chips are rendered by the card now; the adapter only builds `BadgeSlot` objects |
| 10 | **Added** `import { PhaseNodeCard, type BadgeSlot, type BadgeSlots } from "@/components/workflows/PhaseNodeCard"` | The card and its slot types |

### 184-04 (this plan) — 0 import-path-only changes; 3 net-new imports in one file

`WorkflowBuilderPage.tsx` gains three import STATEMENTS (`useStore` from `zustand`; `createBuilderStore` + `selectDefinition`; `BuilderStoreProvider`) and removes none. Those are net-new dependencies of net-new code, not re-pointings of an existing binding, so they are not import-path-only changes in D-184-08's sense — they are enumerated here anyway so the Wave-0 accounting is complete. **The regex-pinned lazy import at `:86` is byte-identical** (`git diff` contains no hunk touching it) and the whole `@/lib/api` import line is unchanged.

### Assertion edits across Wave 0

**One, and it is the 184-01 carve-out** (`soulData.test.ts`'s glyph map, a deliberate vocabulary decision with its own revert story). **184-02, 184-03 and 184-04 each edited ZERO assertions in any pre-existing test file.** Proof for this plan:

```
$ git diff --stat 5ff18388~1 HEAD -- 'frontend/src/**/*.test.ts' 'frontend/src/**/*.test.tsx'
 .../src/components/workflows/builderStore.test.ts | 455 ++++++++++++++++++
 1 file changed, 455 insertions(+)
```

One test file, **net-new**, 455 insertions / 0 deletions. No pre-existing test file appears in the diff at all. `soulData.test.ts` reported its pinned **14** on every gate run of this plan.

## (d) The Wave-0 gate report

### Per-file counts — every pinned file at delta 0 on every commit of this plan

`node scripts/vitest-count-gate.cjs` was run after each task's changes were complete and before its commit.

| Commit | Task | Result | Total | Failed | Per-file decreases | 16 pinned files |
|---|---|---|---|---|---|---|
| `5ff18388` | 1 | **exit 0** | 625 | 0 | **none — every delta 0** | 16/16 present |
| `873ca76c` | 2 | **exit 0** | 658 (+33) | 0 | **none — every delta 0** | 16/16 present |
| `45e687a8` | 3 | **exit 0** | 658 | 0 | **none — every delta 0** | 16/16 present |

The pinned table on the final run, in full: `canvasModel.fixtures.test.ts` 100 · `canvasModel.purity.test.ts` 69 · `phaseVocabulary.test.ts` 42 · `WorkflowCanvas.test.tsx` 31 · `canvasModel.test.ts` 26 · `PublishGauntlet.test.tsx` 24 · `WorkflowBuilderPage.canvas.test.tsx` 22 · `PhaseFormPanel.test.tsx` 19 · `WorkflowBuilderPage.test.tsx` 15 · `PhaseSpineGraph.test.tsx` 14 · `soulData.test.ts` 14 · `WorkflowDoorSwitch.test.tsx` 13 · `PhaseSpine.test.tsx` 11 · `deriveTier.test.ts` 9 · `WorkflowSoul.test.tsx` 8 · `revertByteIdentical.test.tsx` 7 — **all delta 0**. The three `new` rows are `definitionOps.test.ts` 171, `builderStore.test.ts` 33, `PhaseNodeCard.test.tsx` 30.

The gate's JSON report was written under the OS temp dir on every run (never inside a reload-watched tree).

### The other three halves of D-184-08

| Gate | Required | Observed |
|---|---|---|
| `npx tsc -b \| grep -c "error TS"` | ≤ 33 (the `develop` differential) | **33** on every task — equal to baseline, and **zero** of the 33 names a file this plan touched |
| `git diff --exit-code -- 'frontend/src/**/__snapshots__/*'` | exit 0 | **exit 0 — byte-unchanged** |
| `revertByteIdentical.test.tsx` | green at its pinned 7 | **7/7 passing, unmodified** |

### The three gating suites, unmodified

```
npx vitest run src/pages/WorkflowBuilderPage.test.tsx \
               src/pages/WorkflowBuilderPage.canvas.test.tsx \
               src/components/admin/revertByteIdentical.test.tsx
→ Test Files 3 passed (3) · Tests 44 passed (44)
```

15 + 22 + 7 = 44, every one of them passing with **zero edits**. Adding `builderStore.test.ts` to the run gives **77 passed (77)**.

## Verification Results

| Gate | Required | Observed |
|---|---|---|
| `npm ls zundo` | `2.3.0`, no unmet peer | **`zundo@2.3.0`**, no peer warning against `zustand@5.0.13` (`peerDependencies: {"zustand":"^4.3.0 \|\| ^5.0.0"}`) |
| `node -e "…zundo/package.json.scripts"` | no `postinstall` | **`{"build","dev","format","size","test","test:ci"}`** — no `postinstall` |
| `git diff --stat frontend/package.json` | a single added line | **`1 file changed, 1 insertion(+)`** — `"zundo": "^2.3.0"` |
| `builderStore.ts` exports | `createBuilderStore`, `TrackedSlice`, `HISTORY_LIMIT` (50), `CONFIG_COALESCE_MS` (500), `selectDefinition` | **all present**, plus `BuilderStoreState`, `BuilderStore`, `DefinitionMeta`, `ServerVerdict`, `DegradedCause`, `BuilderPhase`, `SaveState`, `EditKind` |
| `grep -n 'partialize' builderStore.ts` | returns exactly `phases`, `lastEditKind`, `editSeq` | **`partialize: (s): TrackedSlice => ({ phases, lastEditKind, editSeq })`**; a suite assertion pins the snapshot key set to exactly those three |
| `grep -nE 'fetch\(\|from "@/lib/api"' builderStore.ts` | no matches | **no matches** (exit 1) — plus a `?raw` fence with planted-literal controls and a whole-suite 0-call `fetch` spy |
| `grep -n 'commitCanvasNodes' builderStore.ts` | no matches | **no matches** — it lands in 184-10 |
| `useBuilderStoreOptional` outside a provider | `null` | **`useContext` → null**, the `useTechnicalNamesOptional` idiom |
| `useBuilderTemporal` | `useStore(store.temporal, selector)` + names issue #207 | **both** (`:80` and `:65`) |
| `npx vitest run builderStore.test.ts` | 0 failures | **33 passed** |
| `grep -cE 'localStorage\|sessionStorage\|aria-pressed\|reactflow' WorkflowBuilderPage.tsx` | 0 | **0** |
| `grep -c 'visual_workflow_canvas === true' WorkflowBuilderPage.tsx` | ≥ 1 | **1** |
| The lazy import at `:86` | byte-identical | **untouched** — no diff hunk contains it |
| `grep -n 'createBuilderStore' WorkflowBuilderPage.tsx` | inside the component body | **`:170`**, inside `WorkflowBuilderPage(...)` (`:99` is the import statement) |
| `grep -n 'config: { ...p.config' WorkflowBuilderPage.tsx` | no matches | **no matches** — the inline merge is gone; `definitionOps.patchPhaseConfig` is the one home |
| `npx vite build` | exit 0 | **exit 0**, built in 6.36 s |
| `git diff --name-only -- supabase/migrations backend/ \| wc -l` | 0 | **0** — slot 114 stays RESERVED, frontend-only |
| Deletions in any commit | none | **none** (`git diff --diff-filter=D` empty across all three) |
| REQUIREMENTS.md | untouched, all 5 phase REQ-IDs Pending | **untouched** |

### Full frontend suite — no NEW failures

```
npm test → Test Files 9 failed | 207 passed (216)
                Tests 23 failed | 2401 passed (2424)
```

Every failing file is named, and **none is attributable to this plan**:

| File | Verdict |
|---|---|
| `__tests__/components/IngestionPage.test.tsx` · `MessageItem.test.tsx` · `Plan04.frontend.test.tsx` · `__tests__/hooks/useMessages.test.ts` · `__tests__/providers/StreamsProvider.dedup.test.ts` · `streamsProvider.test.tsx` · `streamsProvider_075_9_clientkey.test.tsx` · `lib/model-info.test.ts` | **Pre-existing SEED-056 vitest rot** — chat / streaming / ingestion / model-info. None imports anything this plan touched |
| `components/workflows/PublishGauntlet.test.tsx` | **A load-dependent timeout flake, not a regression.** It passes **24/24 in isolation** (16.4 s; its heaviest test alone takes 2.5 s) and the count gate reports it at its pinned **24 with 0 failing** on every run. Under the fully-parallel `npm test` it reports `Error: Test timed out in 5000ms`. It renders `PublishGauntlet` DIRECTLY — `grep` confirms it does not import `WorkflowBuilderPage` at all — so no edit in this plan can reach it |

Nothing was fixed in either category: SEED-049 (Playwright) and SEED-056 (vitest rot) are named here rather than repaired, per the scope-boundary rule.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A coalescing run keeps the FIRST pending args, not the last**

- **Found during:** Task 1, confirmed by the Task 2 falsification
- **Issue:** 184-RESEARCH.md Pattern 2's example writes `pending = args` — i.e. each config edit OVERWRITES the pending entry. `push(pastState)` records the state *before* that edit, so with overwrite the entry finally flushed is the state before the **last** keystroke of the run. `⌘Z` would then step back exactly one character while every length-based assertion still passed, because the number of entries is identical either way. D-184-02's actual claim is *"one typed sentence is one undo rather than forty"* — a claim about what undo RESTORES, not about how many entries exist.
- **Fix:** `if (pending === null) pending = args` — the first args of a run win, the timer still restarts on every keystroke. A dedicated assertion pins it by identity: after two `patchConfig` calls and a flush, `pastStates[0].phases` **is** (`toBe`) the pre-run array, and `undo()` returns the store to that exact reference.
- **Files modified:** `frontend/src/components/workflows/builderStore.ts`, `builderStore.test.ts`
- **Verification:** the falsification above turned that assertion red with an `Object.is` failure — the only one of the six whose message names identity rather than length, which is precisely the defect class a length-only test cannot see
- **Committed in:** `5ff18388` (implementation), `873ca76c` (proof)

---

**2. [Rule 2 - Missing Critical] A document-replacing transition clears the history and does not mark the draft dirty**

- **Found during:** Task 1
- **Issue:** The plan lists `setDrafted(definition)` and `setComposing()` without history semantics, and D-184-03 says "history is session-long; a save is not a barrier". Implemented literally, generating a NEW workflow leaves the previous document's entries in the stack, so the user's first `⌘Z` on a freshly generated draft **wipes the workflow they just asked for** and restores the previous one. D-184-03's "a save is not a barrier" is about the SAVE boundary; a generate is a DOCUMENT boundary and the two are not the same event. Separately, the dirty subscription would have read "the phases reference changed" on load and marked a just-opened draft dirty before the user touched anything.
- **Fix:** both actions run under a `suppressDirty` flag and call `temporal.getState().clear()` after their `set`. `setErrorState` does neither (it changes no phases).
- **Files modified:** `frontend/src/components/workflows/builderStore.ts`, `builderStore.test.ts`
- **Verification:** two dedicated assertions — *"opening a definition does NOT mark the draft dirty"* and *"a replaced DOCUMENT is not undoable back into the previous one"* (`pastStates` and `futureStates` both 0 after `setDrafted`)
- **Committed in:** `5ff18388`

---

**3. [Rule 3 - Blocking] `Omit<BuilderDefinition, "phases">` collapses to `{}`**

- **Found during:** Task 3, the moment the page read `meta.slug`
- **Issue:** `BuilderDefinition` carries `[k: string]: unknown`, so `keyof` it is `string | number` and `Exclude<string | number, "phases">` subtracts nothing — `Omit` yields `{}`. Two real `tsc` errors resulted (`TS2538: Type '{}' cannot be used as an index type` at the folder-name lookup, `TS2322: Type '{}' is not assignable to type 'ReactNode'` at the header slug). Hand-copying the five declared fields into a local meta interface would have "fixed" it while creating exactly the second, driftable copy of the definition shape that Wave 0's G-5 discipline exists to remove.
- **Fix:** `DefinitionMeta` as a key-remapped mapped type — `{ [K in keyof BuilderDefinition as K extends "phases" ? never : K]: BuilderDefinition[K] }` — which subtracts the literal key while keeping both the declared fields and the index signature. The shape stays declared in exactly one place. The reason is written on the type so nobody "simplifies" it back to `Omit`.
- **Files modified:** `frontend/src/components/workflows/builderStore.ts`
- **Verification:** `tsc` back to the 33 baseline with zero errors naming a phase file
- **Committed in:** `45e687a8`

---

**4. [Rule 1 - Bug] `selectDefinition` narrowed to the two halves it reads**

- **Found during:** Task 3
- **Issue:** As first written the page computed `definition` with `selectDefinition(store.getState())` inside a `useMemo` keyed on the selector values. That works, but it reads `getState()` to produce a RENDERED value — the exact shape the plan's own selector rule (and zundo #207) warns against — and `react-hooks/exhaustive-deps` correctly flagged `meta` and `phases` as unnecessary dependencies, i.e. the lint rule could not see that the memo depends on them at all.
- **Fix:** `selectDefinition(state: Pick<BuilderStoreState, "meta" | "phases">)`. The page now calls `selectDefinition({ meta, phases })` from the two selector values; `onPersist` still passes a whole `getState()` snapshot, which satisfies the narrowed parameter structurally. There is still exactly ONE recombination point, and no rendered value reaches for `getState()`.
- **Files modified:** `frontend/src/components/workflows/builderStore.ts`, `WorkflowBuilderPage.tsx`
- **Verification:** `npx eslint` on all four touched files reports **zero** problems for the page, the store and the suite
- **Committed in:** `45e687a8`

---

**5. [Rule 1 - Bug] `renderPublish` is guarded on a non-null definition**

- **Found during:** Task 3
- **Issue:** `{renderPublish && <div>{renderPublish(state.definition, draftId)}</div>}` relied on the state union narrowing `state.definition` to non-null past the early return. `definition` is now a `useMemo` result that TypeScript cannot narrow the same way.
- **Fix:** `{renderPublish && definition && …}`. In this branch `builderPhase === "drafted"`, so `definition` is always non-null and the rendered output is unchanged — a `?? {}` fallback or a non-null assertion would have been the dishonest alternatives.
- **Files modified:** `WorkflowBuilderPage.tsx`
- **Verification:** the 24 `PublishGauntlet.test.tsx` assertions and both Builder suites pass unmodified; snapshot byte-unchanged
- **Committed in:** `45e687a8`

---

**6. [Rule 1 - Bug] `requirements.mark-complete` was NOT run**

- **Found during:** Post-plan state updates
- **Issue:** This plan's frontmatter names `requirements: [CANVAS-02, CANVAS-03]`. Running the verb flips both to **Complete**, as it did in 184-01 (reverted) and was avoided in 184-02 and 184-03. CANVAS-02 is *"a user can add, move, connect and delete phase-nodes…"* and CANVAS-03 is the canvas node inspector. **This plan delivers neither**: it ships the state substrate, and no canvas editing affordance renders anywhere.
- **Fix:** the verb was not invoked. `.planning/REQUIREMENTS.md` is untouched — all five phase REQ-IDs (`VALID-02`, `VALID-03`, `CANVAS-02`, `CANVAS-03`, `CANVAS-04`) remain Pending. The orchestrator marks them at phase end when the behaviour is observable (Phase 182's VALID-01 precedent).
- **Files modified:** none

### Honesty corrections applied while writing (not defects — anti-drift discipline)

**7. [Rule 2 - Missing Critical] The page's own docblock was rewritten rather than left claiming it owns the definition**

- **Found during:** Task 3
- **Issue:** `WorkflowBuilderPage.tsx`'s header docblock described a page that owns a `useState` state union and refines a definition in place. After the repoint that is false, and D-ITEM-183-02 (the "a comment that lies" trap, six-plus instances in this project) says a stale comment shipped alongside the change that falsified it is the defect.
- **Fix:** a new `Phase 184-04 (D-184-01 / D-184-05) — where the definition lives now` section states plainly what moved, why (the shared `PhaseFormPanel`), and **what deliberately did not** (persistence, and selection). The `onPersist` docblock gained a paragraph naming the single edit inside it. The `onPhaseChange` comment now names `definitionOps.patchPhaseConfig` as the one mutation home instead of describing an inline merge that no longer exists. None is an assertion.
- **Files modified:** `WorkflowBuilderPage.tsx` (comments only)
- **Committed in:** `45e687a8`

---

**Total deviations:** 7 (3 bugs, 2 missing-critical, 1 blocking, 1 lint-driven correctness fix counted as a bug)
**Impact on plan:** none expands scope. The file set is exactly the six in `files_modified`. Deviations 1 and 2 are the only behavioural differences from the plan's literal text and both are strictly more correct — 1 is what the falsification was for. Deviations 3–5 are the plan's intent implemented correctly rather than literally. Deviation 6 prevents a false completion claim in a planning artifact.

## Design decisions worth carrying forward

- **The store's untracked half is the interesting half.** `partialize` is not a nudge filter — the nudge is not a field of this store at all. Its job is to keep SERVER state (`verdicts`, `checking`, `degraded`) out of a user-facing undo stack. `equality: (past, next) => past.phases === next.phases` is the belt to that braces: an untracked setter never even reaches `handleSet`. Both are asserted, four setters each.
- **Absence beats a filter.** The nudge-absence assertion walks `Object.keys(store.getState())` against `/dy|nudge|offset|position/i` and has a planted-key positive control. A filter can be misconfigured; a field that does not exist cannot be.
- **The dirty re-arm knows nothing about undo.** A single `store.subscribe` on the `phases` reference makes D-184-03 true for undo, redo and every future edit path at once, because zundo's `undo()` writes through the store's raw `set`. No action needed a special case, and no action can write to the server.
- **`flushHistory()` is the blur seam.** 184-11's field-blur commit and 184-13's view change already have their hook; neither needs to reach into `handleSet`.
- **Declared-but-unwired slots, named as such.** `saveState`, `setSaveState`, `markSaved`, `verdicts`, `checking` and `degraded` exist and are unread today — the page keeps its OWN shipped `saveState` for the header Save button, because D-184-05 leaves persistence untouched. Each carries a docblock saying so, so a reader does not mistake an unwired slot for a duplicate home.
- **A new lint finding is checked against the shipped analog first.** `react-refresh/only-export-components` fires 3× on `BuilderStoreProvider.tsx` — and 2× each on the shipped `TechnicalNamesProvider.tsx` and `EffectiveFeaturesProvider.tsx`. It is the house provider shape's standing cost, not a defect introduced here. Everything else lints clean.

## Requirements

**Neither CANVAS-02 nor CANVAS-03 is complete, and REQUIREMENTS.md was deliberately left untouched.**

- **CANVAS-02** — the store the editing actions will be dispatched through exists, with `addPhaseOfType` / `insertPhaseOfTypeAt` / `reorderPhase` / `removePhaseBySlug` implemented and unit-proven. **No affordance calls any of them.** The canvas is still read-only.
- **CANVAS-03** — `PhaseFormPanel`'s change path now flows through the store instead of page state, which is the plumbing CANVAS-03 needs. The panel's behaviour is byte-identical (19 assertions, unmodified) and nothing about the canvas-as-inspector ships here.

## Threat Model Disposition

| Threat ID | Disposition | Status |
|---|---|---|
| T-184-04-SC (tampering — `npm install zundo`) | mitigate | **CLOSED.** Re-verified at install: `2.3.0`, MIT, peer `^4.3.0 \|\| ^5.0.0` clean against the installed `zustand@5.0.13`, `scripts` contains **no `postinstall`**, `package.json` gained exactly one line. 184-RESEARCH.md's audit (5 yr 4 mo old, 336,208 downloads/wk, listed in zustand's OWN third-party docs, `slopcheck` `[OK]`) stands. No `[ASSUMED]`/`[SUS]` gate was required and none was skipped |
| T-184-04-01 (tampering — outgoing draft payload) | mitigate | **CLOSED.** `selectDefinition` is the ONE recombination point and adds no key; a suite assertion shows its output key SET equals the input definition's, and another proves no `x`/`y`/`position`/`layout`/`dy` key can appear. The store holds no positional field at all, so a layout key cannot reach the payload by construction |
| T-184-04-02 (repudiation — undo crossing the save boundary) | mitigate | **CLOSED.** Belt: a `?raw` fence proves `builderStore.ts` contains no `fetch(`, no `@/lib/api` import and no `XMLHttpRequest`/`EventSource`/`sendBeacon`, each with a planted-literal positive control. Braces: a whole-suite `fetch` spy recorded **0** calls across 33 tests including every undo and redo. `dirty` re-arms instead |
| T-184-04-03 (EoP — flag-off surface drift) | mitigate | **CLOSED.** 44 shipped assertions across the three gating suites pass unmodified, `revertByteIdentical.test.tsx` is green at its pinned 7, the canvas snapshot is byte-unchanged, and `BuilderStoreProvider` emits **no DOM element** so the flag-off branch still renders `graphChild` as the grid's first child |
| T-184-04-04 (info disclosure — per-mount store lifetime) | mitigate | **CLOSED.** Asserted, not merely designed: *"an edit in one store leaves the other's history empty"* constructs two stores and proves their `pastStates` are independent. One workflow's edit history cannot appear inside another workflow's session on a shared browser |

## Scope Fence Compliance

- **Frontend only.** `git diff --name-only -- supabase/migrations backend/` returns **0** lines across all three commits. Slot 114 stays RESERVED.
- **No env var. No cloud parity owed.** The one dependency is a build-time package; `npm install` after pulling is the only operator action.
- **`zundo` is the ONLY net-new dependency.** No debounce library (the timer is a closure, following the shipped `lib/throttle.ts` house answer), no property-test library.
- **`__fixtures__/canvasFixtures.ts` untouched** (D-184-17 / its acceptance guard). `builderStore.test.ts` hand-authors its own three-step draft inline.
- **Only `--reporter=default` / the gate's own `--reporter=json`.** No watch flag committed anywhere. No scratch file written inside `frontend/` or `backend/`.

## Issues Encountered

- **`Omit` silently collapsing against an index signature** (Deviation 3) is worth flagging to every later plan in this phase: `BuilderDefinition` is `[k: string]: unknown`, so ANY `Omit<BuilderDefinition, K>` yields `{}` and the failure surfaces as a confusing `Type '{}' cannot be used as an index type` far from the cause. Use `DefinitionMeta` or the same remap idiom.
- **The plan's Task-2 assertion list can be satisfied by a wrong implementation.** Assertion 2 counts entries, and the overwrite bug produces the right count with the wrong entry. Recorded because it is the same class as the Phase-177 lesson the count gate exists for: a differential that measures the wrong dimension is green on a real defect. The identity assertion (`toBe` on the pre-run array) is what actually catches it.
- **Two React `act(...)` warnings** appear on stderr in `WorkflowBuilderPage.test.tsx`'s two synchronous empty-screen tests. They come from the shipped `listFolders`/`listSkills` mount effect resolving after the test body — untouched by this plan, no assertion involved, both tests green.
- **`PublishGauntlet.test.tsx` flakes under the fully-parallel `npm test`** with a 5 s test timeout while passing 24/24 in isolation. Named, not fixed — it is a harness-load artifact, and the count gate (which runs the Wave-0 targets only) reports it green on every commit.

## User Setup Required

**One:** run `npm install` in `frontend/` after pulling, so `zundo@2.3.0` lands in `node_modules`. No external service, no env var, no migration, no cloud step.

## Next Phase Readiness

- **Wave 0 is COMPLETE.** All four Wave-0 commits passed D-184-08's gate: zero assertion edits outside the single enumerated 184-01 carve-out, every pinned per-file count at delta 0, `tsc` at the 33 baseline throughout, the canvas snapshot byte-unchanged, and `revertByteIdentical.test.tsx` green. **Feature code may now land.**
- **184-05 (`fromCanvas`) is unblocked** and inherits the rule 184-02 set: `renumber` lives in `definitionOps` and nowhere else; `fromCanvas` must NOT renumber or the `indexGap` round-trip identity breaks.
- **184-07 (`canvasNudge`) has its boundary enforced structurally.** The store has no positional field and an assertion fails the moment one appears, so the nudge module cannot leak into history by accident.
- **184-10 adds `commitCanvasNodes`** to this store — deliberately absent today because it depends on `fromCanvas`. A grep asserts its absence so the sequencing is visible.
- **184-11 / 184-13 land on the toolbar and the live loop.** `flushHistory()` is the blur seam; `setVerdicts` / `setChecking` / `setDegraded` are the live-validation seams, all proven untracked. `useBuilderTemporal` is the ONLY correct way to render an undo/redo enabled state — `getState()` in a rendered value is non-reactive under React 19 (issue #207) and the hook's docblock says so.
- **Phase 186 still has its seam.** `draftIdRef`, `creatingRef`, `onPersist` and `onSaveDraft` are unchanged on the page; the diff hunk above is the evidence.
- **Carried forward from 184-01:** the live in-app five-surface icon sweep remains a phase-verification G-4 row (needs Docker up).

## Self-Check: PASSED

- `frontend/src/components/workflows/builderStore.ts` — FOUND
- `frontend/src/components/workflows/BuilderStoreProvider.tsx` — FOUND
- `frontend/src/components/workflows/builderStore.test.ts` — FOUND
- `frontend/src/pages/WorkflowBuilderPage.tsx` — FOUND
- `frontend/node_modules/zundo/package.json` (v2.3.0) — FOUND
- Commit `5ff18388` — FOUND
- Commit `873ca76c` — FOUND
- Commit `45e687a8` — FOUND

---
*Phase: 184-editable-canvas-live-structural-validation-round-trip*
*Completed: 2026-07-27*
