---
phase: 286-seams-before-features
plan: 02
subsystem: frontend / workflow Builder
tags: [g5-extraction, pure-move, pin-first, frontend, builder]
requirements: [REG-07]
dependency_graph:
  requires: []
  provides:
    - "useBuilderNameMaps() — the Builder's id-to-name lookup values and their one mount read"
    - "builderCopy.ts — leaf module of the Builder's copy constants"
  affects:
    - frontend/src/pages/WorkflowBuilderPage.tsx (smaller ahead of 288's draft-persistence work)
tech_stack:
  added: []
  patterns:
    - "pin-first characterization (export set, request counts, faces, DOM snapshots) before a pure move"
    - "page re-exports moved constants so every import and ?raw fence still resolves"
key_files:
  created:
    - frontend/src/components/workflows/useBuilderNameMaps.ts
    - frontend/src/components/workflows/builderCopy.ts
    - frontend/src/pages/__tests__/WorkflowBuilderPage.seam286.pin.test.tsx
    - frontend/src/pages/__tests__/__snapshots__/WorkflowBuilderPage.seam286.pin.test.tsx.snap
    - .planning/phases/286-seams-before-features/286-02-BASE.md
  modified:
    - frontend/src/pages/WorkflowBuilderPage.tsx
    - frontend/src/components/workflows/toolReadOnlyMap.test.ts
    - frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx
decisions:
  - "useBuilderNameMaps is called at the old state-block position; its mount effect now registers before the page's other mount effects (the one accepted ordering deviation)"
  - "UNNAMED_KB_OPTION is exported from builderCopy only so the page can import it; the page does not re-export it, so the page's export set is unchanged"
  - "Both location fences were retargeted in a test-only commit at unchanged strength; neither was relaxed"
metrics:
  duration: "~75 min"
  completed: 2026-10-18
  tasks: 2
  files: 8
---

# Phase 286 Plan 02: Builder name maps and copy constants extracted Summary

The Builder's id-to-name lookup cluster (six values and one mount read) moved verbatim into
`useBuilderNameMaps`, and its eight copy constants moved verbatim into the leaf `builderCopy.ts`. The page
re-exports seven of them. `WorkflowBuilderPage.tsx` went from **2993 to 2803 lines**. Its exports, requests and
rendered DOM are the same as at base, apart from one mount-order change described below.

## What was done

| Task | Commit | What |
|---|---|---|
| 1 | `fe3da3d7f` | An 11-case characterization pin on the UNMOVED page, plus `286-02-BASE.md` (consumer inventory, base tsc set, hooks-rules verdict) |
| 2a (move) | `5b52b1e0e` | `useBuilderNameMaps.ts`, `builderCopy.ts`, page rewired. Production files only, no test file |
| 2b (retarget) | `756505396` | Test-only. The two location fences follow the code |

**Verbatim proof.** A script compared the moved text with the base page line by line (`base-page.tsx` read from
`git show d45bef9e2:…`). `builderCopy.ts` matches base lines 341-486 (146 lines). The one change is that
`const UNNAMED_KB_OPTION` became `export const`. `useBuilderNameMaps.ts` matches base lines 785-807 plus 1590-1650
(85 lines, comments included). Both printed `true`.

## Line counts

| File | Before | After |
|---|---|---|
| `frontend/src/pages/WorkflowBuilderPage.tsx` | 2993 | **2803** (-190) |
| `frontend/src/components/workflows/useBuilderNameMaps.ts` | — | 141 |
| `frontend/src/components/workflows/builderCopy.ts` | — | 174 |

## Acceptance checks (measured)

- `grep -c "useState<IdNameMap>" WorkflowBuilderPage.tsx` → **0**. `grep -c "useBuilderNameMaps()"` → **1**.
- `grep -cE "^export const (…8 names…)" builderCopy.ts` → **8**.
- `useBuilderNameMaps.ts` imports the three list functions from `"@/lib/api"` (the page's own specifier). It
  imports nothing from `@/lib/api/` subpaths.
- Pin numstat from the pin's own commit to HEAD:
  `git diff --numstat fe3da3d7f HEAD -- frontend/src/pages/__tests__/WorkflowBuilderPage.seam286.pin.test.tsx frontend/src/pages/__tests__/__snapshots__/`
  printed **nothing**. Against `<base>` the same command prints only the pin's own addition
  (`334 0` / `9 0`), because the base is older than the pin.
- tsc (`npx tsc -p tsconfig.app.json --noEmit`): **the set diff against BASE.md is empty.** 63 errors before,
  the same 63 after, none of them in the page.
- `node scripts/check-react-hooks-rules.cjs` → `OK — no NEW react-hooks/rules-of-hooks violation` (the same two
  known `ToolCallPanel.tsx` entries as at base).

## Suites run (targeted, `--maxWorkers=2`)

- **Move commit, before the retarget:** the whole `src/components/workflows` directory gave **103 files / 4823
  tests, 1 failed**. That failure is `toolReadOnlyMap.test.ts` "THE JOIN", which was predicted. The named page
  suites gave **11 files / 597 tests, 2 failed**. One is `canvas.test` "no second fetch", which was predicted. The
  other is `canvas.test` "clicking Canvas flips aria-selected…", which timed out after 6.4 s on a lazy-chunk wait.
  That case **passed when run alone and passed in a full re-run of the canvas file** with the move still in place.
  It is a load flake while another executor shares the box, not a regression: the move touches nothing on the
  canvas toggle path. The named page suites were `WorkflowBuilderPage.test`, `.canvas`, `.header`, `.describe`,
  `.session`, `.preDraft.baseline`, `.declaredInputs`, `WorkflowRunPage.test`, `WorkflowsPage.test`, the seam286
  pin and `connectionVerbFence`.
- **So the only deterministic reds were the two the plan predicted.** No other consumer in BASE.md's inventory
  went red.
- **After the retarget:** the plan's verify set (the pin, `toolReadOnlyMap`, `.canvas`, `.header`,
  `governanceVocabulary`, `decisionsVocabulary`) gave **6 files / 295 tests, all passed**.
- Full gates (vitest count gate, backend baseline) are plan 05's job under G-8. They were not run here.

## Every test edited (D-13)

| Test | Commit | Edit | Why |
|---|---|---|---|
| `toolReadOnlyMap.test.ts` "THE JOIN" | `756505396` | The `import { buildToolReadOnlyMap }` and `setToolReadOnly(buildToolReadOnlyMap(connections))` needles now read `useBuilderNameMaps?raw`, with a length guard (>1000) and an identity guard (contains `useBuilderNameMaps`) checked first. The page keeps `^\s+toolReadOnly,$`. **Added** the hop the move created: the page must match `/useBuilderNameMaps\(\)/` | Both needles moved verbatim into the hook (D-10a). Every original assertion survives, and one more was added. |
| `WorkflowBuilderPage.canvas.test.tsx` "no second fetch was added for the maps" | `756505396` | The count runs over `builderSource + nameMapsSource`. The expected value **stays 3** | The two calls moved to the hook, and the page keeps the one `listFolders()` comment. The strength is unchanged: an empty hook source would make the count 1 and red the test. |

Both retargets were **driven red**. A planted `setToolReadOnly({})` in the hook made "THE JOIN" fail, and also
two pin cases (the `ONLY READS` arm and the flag-on DOM snapshot). Reverting the plant left the hook byte-identical
to its committed state. **The seam286 pin itself was never edited after its own commit.**

## Deviations from Plan

### The one accepted ordering deviation (stated in the plan, recorded here)

The page calls `useBuilderNameMaps()` where the state block used to be (old :787), so the hook's mount effect now
**registers before** the effects declared between that point and the old effect site (:1593). Those are
`useTemplateFirstDraft`, `useTemplatePlaceholders`, `useLiveValidation`, `useDraftPersistence`,
`useGroundingBundle` and `useModelRegistry`. The three name-map GETs (`listFolders`, `listSkills`,
`listConnectorConnections`) therefore fire before those mount reads in the same commit phase. Every one of them is
an independent best-effort read, and the faces already "settle when the mount fetch resolves" (PITFALL 1, accepted
in the page's own comment). No Builder suite asserts the call order across mocks. The hook cannot be called any
later, because `nameContext` reads its values and two callbacks list `nameContext` in their dependencies. **No
request was added or removed.** The pin asserts exactly one call per read.

### Auto-fixed

**1. [Rule 3 - Blocking] Removed the page's now-unused `type IdNameMap` import**
- **Found during:** Task 2 move
- **Issue:** After the six `useState<IdNameMap>` lines left the page, nothing there referenced `IdNameMap`. Under
  the project's unused-locals setting that would add a new tsc error.
- **Fix:** Dropped `type IdNameMap,` from the page's `PhaseFormPanel` import. The hook imports the type from the
  same module (`@/components/workflows/PhaseFormPanel`). The tsc set diff is empty.
- **Commit:** `5b52b1e0e`

### Pin authoring finding (not a product defect)

On the spine an author `name` comes first in the face ladder, so a phase that has a `name` never shows the
resolved folder/skill/connection name. The pin's phases therefore carry no `name`. An external step with a tool
renders `<connection> · <tool>`. Without the connection map it renders `<tool>` alone, not "Posts a message". The
pin asserts what actually renders.

### Housekeeping

The `src/components/workflows` directory run rewrote
`__snapshots__/canvasModel.fixtures.test.ts.snap` with LF endings only (an autocrlf artefact; `git diff` showed no
content change). It was restored with `git checkout -- <that one file>` and never staged.

## Threat model

| Threat | Disposition | How it was met |
|---|---|---|
| T-286-08 (connection fields reaching the DOM) | mitigated | The effect body is verbatim (it reads `c.id`, `c.name`, `c.mcp_server_url`, plus the explicit `readOnlyHint` via `buildToolReadOnlyMap`). The DOM snapshot would show any new field. |
| T-286-09 (read-only banner) | mitigated | The pin drives both arms (annotated → `ONLY READS`; silent → `CHANGES SOMETHING OUTSIDE`). The join fence was retargeted, not deleted, and gained the page → hook hop. |
| T-286-10 (guard coverage) | mitigated | Both new modules sit in `components/workflows`, so `governanceVocabulary`'s `./*.{ts,tsx}` sweep and `connectionVerbFence`'s `/src/components/workflows/**` sweep both see the moved text. Both suites are green. |
| T-286-11 (doubled mount request) | mitigated | The pin asserts `toHaveBeenCalledTimes(1)` for each of the three reads. |

No new network endpoint, auth path or schema surface. No threat flags.

## Known Stubs

None. The `= {}` / `= []` initial states in `useBuilderNameMaps.ts` are the shipped empty maps from base, moved
verbatim. An empty map is the documented SHIPPED state (destination-free faces), not a stub.

## Owed to plan 05 (not done here, by design)

- Hot-file ledger rows (D-15). The two new modules need rows in `CLAUDE.md` and `docs/HOT-FILE-LEDGER.md`
  (`node scripts/check-hot-file-ledger.cjs 286` will name them). The `WorkflowBuilderPage.tsx` row's triple needs
  re-deriving.
- The full vitest count gate and the backend baseline (SC#3 / D-14). The new pin file adds 11 cases and
  `toolReadOnlyMap.test.ts` gains no case (the assertions sit inside the existing one), so no per-file decrease is
  expected.
- `graphify update .` was not run inside the worktree, to avoid racing the parallel executor on `graphify-out/`.

## Self-Check: PASSED

- FOUND: `frontend/src/components/workflows/useBuilderNameMaps.ts`
- FOUND: `frontend/src/components/workflows/builderCopy.ts`
- FOUND: `frontend/src/pages/__tests__/WorkflowBuilderPage.seam286.pin.test.tsx` and its `.snap`
- FOUND: `.planning/phases/286-seams-before-features/286-02-BASE.md`
- FOUND commits: `fe3da3d7f`, `5b52b1e0e`, `756505396`
