---
phase: 183-read-only-canvas
plan: 06
subsystem: frontend
tags: [workflows, canvas, xyflow, read-only, node-render, accessibility, technical-names, sketch-137-D]

# Dependency graph
requires:
  - phase: 183-read-only-canvas
    plan: 01
    provides: "`@xyflow/react@12.11.2` + `src/test-utils/mockReactFlow.ts` + the A1 handle verdict + the 33-signature `tsc -b` differential baseline"
  - phase: 183-read-only-canvas
    plan: 02
    provides: "`phaseVocabulary.ts` — `Grounding`, `PhaseSpecJSON`, the plain-language sentences and the two badge signals"
  - phase: 183-read-only-canvas
    plan: 04
    provides: "the hard cut that made `useTechnicalNamesOptional()?.showTechnical ?? false` the ONE reveal expression both graph views spend"
  - phase: 183-read-only-canvas
    plan: 05
    provides: "`canvasModel.toCanvas`, `CANVAS_LAYOUT`, `CANVAS_NODE_TYPES`, `CANVAS_EDGE_KINDS`, the 15-fixture corpus"
  - phase: 177-org-surface-polish
    provides: "`components/org/StatusChip.tsx` — the shared badge primitive this plan reuses with a canvas-domain tone mapping"
  - phase: 154-plain-language
    provides: "`TechnicalNamesProvider` — the app-wide ⌥ reveal state, and `admin/TechnicalNamesToggle` the prop-controlled control"
provides:
  - "`frontend/src/components/workflows/PhaseNode.tsx` — `PhaseNode`, `UnresolvedSkipNode`, `EndCapNode` (the `nodeTypes` values)"
  - "`frontend/src/components/workflows/WorkflowCanvas.tsx` — `WorkflowCanvas`, the read-only `<ReactFlow>` shell + the D-183-11 empty state + the ⌥ control"
  - "`frontend/src/components/workflows/WorkflowCanvas.test.tsx` — 25 DOM assertions, both mutation-checked"
affects: [183-07, 184-editable-canvas, 185-graded-governance, 188-run-observability]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "read-only is asserted, not assumed: every library flag that defaults to true is turned off explicitly, and the interactivity padlock is proven absent from the DOM"
    - "the ⌥ reveal is threaded DOWN as a `data` field so the node stays a context-free leaf and the app can only ever hold one reveal state"
    - "the empty state is a STRUCTURAL early return above the canvas, so 'no chrome' is one absence assertion instead of five false props"
    - "a shared badge COMPONENT with a per-domain tone MAPPING — the documented StatusChip reuse shape, not a third inline pill"

key-files:
  created:
    - frontend/src/components/workflows/PhaseNode.tsx
    - frontend/src/components/workflows/WorkflowCanvas.tsx
    - frontend/src/components/workflows/WorkflowCanvas.test.tsx
  modified: []

key-decisions:
  - "Node clicks are driven by `fireEvent.click`, not `user-event`: a user-event click inside the plane also dispatches mousedown, reaching d3-zoom, and d3-drag dereferences a null `event.view` under jsdom — 25 green assertions and exit code 1"
  - "Both hidden handles are rendered on ALL THREE node types (not just the phase card), so a stub or the cap can never be the node that silently drops an edge"
  - "The grounding tone mapping is canvas-local (strict=success / flag=primary / open=muted) — the shared component, a domain-specific mapper, exactly as StatusChip's docblock prescribes"
  - "The `👁 View only` header renders on BOTH branches, so the empty state still reads as a deliberate mode rather than a dead panel"
  - "'Waits for you' takes the primary tone, not amber: amber is spent on the broken-reference marker here and is reserved for Phase 188's waiting-for-you run state"

patterns-established:
  - "a grep guard that would bind its own file's prose is anchored on the JSX PROP FORM (`identifier=`), and the reason is stated inline so the next reader does not 'fix' it back"
  - "a canvas suite calls the file-local jsdom helper itself; setupTests.ts stays byte-unchanged"

requirements-completed: [CANVAS-01]

# Metrics
duration: 27min
completed: 2026-07-25
---

# Phase 183 Plan 06: PhaseNode + WorkflowCanvas Summary

**The projection now paints: a frosted, neutral phase card with the 3D mark floating over a lightened
icon well, an honest broken-reference marker, an explicit end cap, and a `<ReactFlow>` shell where
read-only is opt-OUT rather than assumed — every default-true interaction flag turned off explicitly,
the interactivity padlock proven absent from the DOM, and the zero-phase case mounting no `.react-flow`
root at all — with 25 DOM assertions whose two most load-bearing controls were each mutated red and
reverted.**

## Performance

- **Duration:** ~27 min
- **Started:** 2026-07-25T21:31:58Z
- **Completed:** 2026-07-25T21:59:24Z
- **Tasks:** 3 of 3
- **Files created:** 3 (0 modified)

## The contract plan 183-07 lazy-imports (verbatim)

```ts
// frontend/src/components/workflows/WorkflowCanvas.tsx
export interface WorkflowCanvasProps {
  phases: PhaseSpecJSON[]
  selectedSlug: string | null
  onSelectNode: (slug: string) => void
}
export function WorkflowCanvas(props: WorkflowCanvasProps): JSX.Element
export default WorkflowCanvas
```

- **Module path:** `@/components/workflows/WorkflowCanvas`
- **Named export:** `WorkflowCanvas`. A `default` export is ALSO provided (mirroring
  `PhaseSpineGraph.tsx:215`), so `React.lazy(() => import("@/components/workflows/WorkflowCanvas"))`
  works without a `.then(m => ({ default: m.WorkflowCanvas }))` shim.
- The prop set is **byte-identical in shape** to `PhaseSpineGraphProps` (`PhaseSpineGraph.tsx:55-61`),
  so the Builder's mount site swaps one child for the other and keeps owning the
  toggle-off-on-reclick selection semantics.

## Accomplishments

- **Read-only is now a proven property, not a claim.** Six default-`true` flags
  (`nodesDraggable`, `nodesConnectable`, `edgesReconnectable`, `connectOnClick`, `edgesFocusable`,
  `deleteKeyCode`) are off explicitly; `elementsSelectable`, `nodesFocusable` and `panOnDrag` stay on
  deliberately. `<Controls showInteractive={false} />` removes the padlock whose handler sets
  `nodesDraggable` / `nodesConnectable` / `elementsSelectable` to `!isInteractive` — and **removing
  that one prop turns the suite red**, which was confirmed by doing it.
- **A1 was honoured, and it mattered.** Every one of the three node components renders a hidden
  target + source `<Handle>` anchored at `CANVAS_LAYOUT.EDGE_ANCHOR_Y` (28px from the node TOP, never
  50%). Edges paint: `researchSummarize` renders exactly its model edge count in jsdom.
- **The empty state mounts nothing.** `container.querySelector(".react-flow")` is `null` on a
  zero-phase definition, along with no controls, no background, no minimap, and zero
  `canvas-node-*` elements. That is the same one-liner plan 183-07 will use for the D-183-03
  flag-off proof.
- **Exactly one tab stop per node, asserted from both sides.** `.react-flow__node[tabindex="0"]`
  count equals the phase count, AND no `button` / `a` / `[tabindex]` element exists inside any node —
  and **planting a pressable element inside `PhaseNode` turns that assertion red**, which was
  confirmed by doing it.
- **The ⌥ reveal is one state, app-wide.** The canvas reads `useTechnicalNamesOptional()`, renders the
  shipped `TechnicalNamesToggle` only when the context is present, and threads the boolean down onto
  each node's `data`. One click flips three separate nodes at once in the test; without a provider the
  canvas renders plain language, shows no control, and does not throw.
- **The broken reference is visible.** The unresolvable-skip fixture renders a marker naming
  `nonexistent` in `font-mono` with the bare-English "no such step", and every rendered edge's source
  AND target were resolved back to an actual `.react-flow__node[data-id]` in the DOM — the machine
  form of "no phantom edge".
- **Zero new failing test names in the full suite**, and `axe` reports no violations on either branch.

## Task Commits

| # | Task | Commit | Type |
|---|---|---|---|
| 1 | The three canvas node faces (sketch 137-D) | `b58af996` | feat |
| 2 | The read-only `WorkflowCanvas` shell | `1e761cc8` | feat |
| 3 | The DOM assertions + both mutation checks | `199d3090` | test |

## Files Created

- **`PhaseNode.tsx` — 303 lines.** Docblock (A1, the one-tab-stop rule, the 137-D look, the D-183-14
  fence, the T-124-01 XSS clause), `HIDDEN_HANDLE_STYLE` + `EdgeAnchors`, `ICON_TINT`,
  `GROUNDING_TONE`, and the three exported components.
- **`WorkflowCanvas.tsx` — 245 lines.** Docblock (the opt-out argument, the padlock argument, D-183-08,
  D-183-11, T-183-04, the scope fences), the module-scope `nodeTypes` map, `DEFAULT_EDGE_OPTIONS`,
  `EDGE_STYLE`, `WorkflowCanvasProps`, `WorkflowCanvas`.
- **`WorkflowCanvas.test.tsx` — 308 lines / 25 tests** across 9 describe blocks.

## Decisions Made

- **`fireEvent.click` for node clicks, `user-event` for the ⌥ control.** The shipped spine's suite
  drives selection with `user-event`, but inside the canvas plane a `user-event` click also dispatches
  a real `mousedown`, which reaches d3-zoom's pan handler; `d3-drag/nodrag.js:5` then dereferences
  `event.view.document`, and jsdom's synthetic MouseEvent carries a null `view`. The first run of this
  suite reported **25 passed and exit code 1**, with three unhandled `TypeError`s fired from outside
  the test bodies — exactly the "gate that lies" failure plan 183-01 documented. `fireEvent.click`
  dispatches only the click, which is precisely the event `onNodeClick` listens to, so the selection
  contract is tested without driving the pan gesture. The reason is recorded inline above the describe
  block so nobody "modernises" it back.
- **Both handles on all three node types.** A1 only proved the phase-card case, but the cost of
  omitting a handle is a silently-missing edge with no warning. The stub and the cap each terminate an
  edge, so they get anchors too — one shared `<EdgeAnchors />` atom rather than three variants of the
  same reasoning.
- **The ⌥ boolean rides on `data`, not on a context read inside the node.** Keeps `PhaseNode` a pure
  presentational leaf that renders in isolation, and makes a second reveal state structurally
  impossible rather than merely discouraged.
- **The header renders on the empty branch too.** D-183-11 suppresses the CANVAS chrome — the plane,
  grid, controls, minimap and any ghost node. It does not ask for the panel to lose its identity: an
  empty panel with no `👁 View only` badge and no ⌥ control would read as a dead region rather than an
  empty workflow.
- **`GROUNDING_TONE` is canvas-local.** `StatusChip`'s docblock is explicit that the cohesion win is
  the shared COMPONENT while the tone MAPPING stays domain-specific (`statusChipMeta` for the
  invitation/SSO lifecycle, `adoptionChip` for the roster). This is the third documented domain, not a
  fork.
- **"Waits for you" is `primary`, not amber.** Amber is spent here on the broken-reference marker
  (matching the shipped skip-branch vocabulary), and Phase 188 needs amber free for the
  waiting-for-you RUN state. The word carries the meaning either way.

## Deviations from Plan

### Acceptance criteria executed with a stated adjustment

**1. `cd frontend && npx tsc -b` exits 0 → executed as the plan-01 differential (inherited, unchanged
from plans 01-05).** Per D-ITEM-183-01 this is unachievable at baseline: `develop` is red with 33
pre-existing signatures across ~20 unrelated files, and `npm run build` is `tsc -b && vite build`, so
the scripted build was already red before this phase started. After all three tasks the count is
**still exactly 33**, and `grep -cE "PhaseNode|WorkflowCanvas"` over the full `tsc -b` output is **0**.
`npx vite build` is the hard gate and **exits 0** after every task.

**2. `grep -c "dangerouslySetInnerHTML" PhaseNode.tsx` returns 0 → executed as the CALL-FORM
differential, because the criterion as written contradicts its sibling.** The same task requires the
docblock to carry the T-124-01 XSS clause **verbatim**, and that clause contains the identifier. This
is the fourth instance in this phase of a guard binding a prefix or a comment rather than the real
call (183-02 hit it with `grounding_mode`, 183-04 with `PHASE_GLYPHS`, 183-05 with the migrations
path). Resolved by anchoring on the JSX prop form:

| Form | `PhaseNode.tsx` | whole `components/workflows/` |
|---|---|---|
| `dangerouslySetInnerHTML\s*=` (the actual injection) | **0** ✅ | **0** ✅ |
| bare identifier (prose included) | 1 (the verbatim clause) | 4 (ours + the 3 shipped files) |

The `<verification>` block's `grep -rn "dangerouslySetInnerHTML" frontend/src/components/workflows`
returns **3 hits at baseline** — `PhaseSpine.tsx:14`, `WorkflowSoul.tsx:24`,
`WorkflowDoorSwitch.tsx:30` — all of them the same house clause. That gate has never been satisfiable
in its literal form. The reason is stated inline in `PhaseNode.tsx`'s docblock so it is not silently
"fixed" back.

**3. `grep -c "showInteractive={false}"` returns 1 and `grep -c "useTechnicalNamesOptional"` returns
1.** The docblock originally explained both by name, which made the counts 3 and 2. The prose was
reworded so the `showInteractive={false}` literal appears **exactly once**, in the JSX
(count = **1** ✅). `useTechnicalNamesOptional` stands at **2** — the import statement plus the single
call site, which is the minimum possible for a used import; the criterion's intent (the app-wide
accessor is what the canvas reads, and there is no second reveal state) holds, and
`grep -c "useState"` is **0**.

**4. `git status --porcelain backend supabase scripts` empty → executed as a differential.** The
working tree carries ~400 files of pre-existing unrelated dirt (documented in the execution brief).
The verifiable form — *this plan touched no backend source, no migration, no seed script* — passes:
`git diff --name-only b58af996~1..HEAD` lists **three files, all under
`frontend/src/components/workflows/`**.

### Auto-fixed Issues

**1. [Rule 1 - Bug] The suite reported 25 passed and exited 1**

- **Found during:** Task 3, first run
- **Issue:** Three unhandled `TypeError: Cannot read properties of null (reading 'document')` from
  `d3-drag/src/nodrag.js:5`, fired by `d3-zoom`'s `mousedowned` handler after each `user-event` node
  click. Every assertion passed; vitest still exited 1. This is the identical failure shape plan
  183-01 hit with the `ResizeObserver` recipe, and the identical lesson: check the exit code, not the
  summary line.
- **Fix:** the three node-click tests now use `fireEvent.click` (which dispatches only the click —
  the event `onNodeClick` actually listens to) instead of `user-event`. The ⌥ control sits outside the
  plane and keeps `user-event`.
- **Files modified:** `frontend/src/components/workflows/WorkflowCanvas.test.tsx`
- **Verification:** 25 passed, **exit 0**, 0 unhandled errors.
- **Committed in:** `199d3090` (Task 3 commit)

**2. [Rule 3 - Blocking] `Grounding` is not re-exported by `canvasModel`**

- **Found during:** Task 1
- **Issue:** the plan's read-first list implies `canvasModel` is the home for the node data shapes,
  but `Grounding` lives in `phaseVocabulary` and `canvasModel` imports it as a type without
  re-exporting. Importing it from `canvasModel` would not compile.
- **Fix:** `import type { Grounding } from "@/components/workflows/phaseVocabulary"` — the single
  home, no re-export shim added (a shim is exactly what plan 183-04's hard cut refused to leave
  behind).
- **Files modified:** `frontend/src/components/workflows/PhaseNode.tsx`
- **Verification:** `npx tsc -b` differential unchanged at 33, `npx vite build` exit 0.
- **Committed in:** `b58af996` (Task 1 commit)

**Total deviations:** 2 auto-fixed (1 Rule 1, 1 Rule 3, both inside this plan's own new files) +
4 acceptance criteria executed with stated, evidenced adjustments. No scope creep; no file outside the
plan's `files_modified` list was touched.

## Issues Encountered

- **The `dangerouslySetInnerHTML` grep is unsatisfiable as literally written, and has been since
  Phase 124.** Three shipped files in `components/workflows/` carry the house XSS clause in prose. Any
  future plan that copies this criterion verbatim will "fail" a gate that has never passed. Recorded
  here and in `deferred-items.md` so the pattern stops recurring — the call form is the guard that
  means something.
- **The bundle figures have NOT moved, and that is expected.** `dist/assets/index-*.js` is
  **1,727.32 kB / 434.40 kB gzip** against the 183-01 pre-canvas baseline of 1,726.81 / 434.24, and
  there is still **no chunk whose name contains `xyflow`**. Nothing imports `WorkflowCanvas` yet, so
  the xyflow JS is not in the module graph at all. Plan 183-07's A6 measurement only becomes meaningful
  once the Builder actually mounts it — measuring today would produce a false "the split works".
- **Nothing else.** No snapshot instability, no toolchain surprise.

## Verification Results

| Gate | Result |
|---|---|
| `npx vitest run …/WorkflowCanvas.test.tsx` | **25 passed / 25, exit 0** ✅ |
| `npx vitest run src/components/workflows` | **370 passed / 0 failed**, 13 files ✅ (baseline 345/0 → +25, no new failing name) |
| full `npx vitest run` | 212 files, 2,158 tests, **31 failed** ⚠️ — the SAME 10 pre-existing suites (PublishGauntlet, the streaming family, IngestionPage, model-info, useMessages, …). **Zero failures in `src/components/workflows`.** Baseline was 34 failures over the identical suite set; the count varies with concurrency (SEED-056 rot) |
| `npx tsc -b` | 33 signatures — **identical to the 183-01 baseline, 0 new, 0 from our files** ⚠️ D-ITEM-183-01 |
| `npx vite build` | **exit 0** ✅ (run after every task) |
| Mutation: remove `showInteractive={false}` | **2 failed** (the DOM padlock assertion + the source guard) → reverted, 25/25, `git status` clean ✅ |
| Mutation: plant a pressable element inside `PhaseNode` | **2 failed** (the one-tab-stop assertion + the drag-free sweep) → reverted, 25/25, `git status` clean ✅ |
| `axe(container)` non-empty canvas | **no violations** ✅ |
| `axe(container)` empty state | **no violations** ✅ |
| `grep -cE "dangerouslySetInnerHTML\s*=" PhaseNode.tsx` | **0** ✅ (call form — see Deviation 2) |
| `grep -c "const PHASE_GLYPHS" PhaseNode.tsx` / `grep -c soulData` | **0 / 2** ✅ |
| `grep -cE "<button\|tabIndex\|role=\"button\"" PhaseNode.tsx` | **0** ✅ |
| `grep -c "panel-status" PhaseNode.tsx` | **0** ✅ |
| `grep -cE "compass\|handshake" PhaseNode.tsx` | **0** ✅ (D-183-14 fence) |
| `grep -c "StatusChip" PhaseNode.tsx` | **7** ✅ (≥ 1 required) |
| `grep -cE "data-phase-type\|data-grounding\|data-slug\|data-testid" PhaseNode.tsx` | **6** ✅ (≥ 4 required) |
| `grep -c "const nodeTypes" WorkflowCanvas.tsx` | **1** ✅, at module scope (line 87, above the component at line 132) |
| `grep -c "showInteractive={false}"` | **1** ✅ |
| the six read-only flags | **6** ✅ |
| `grep -c 'colorMode="dark"'` | **1** ✅ |
| `grep -c "MiniMap"` / `grep -c "hideAttribution"` | **0 / 0** ✅ |
| `grep -c "useTechnicalNamesOptional"` / `grep -c "useState"` | **2 (import + call) / 0** ✅ |
| `grep -cE "workflows/validate\|grounding_mode\|zundo\|elkjs\|reactflow"` | **0** ✅ |
| empty-state branch above `<ReactFlow>` | ✅ `canvas-empty` at line 188, `<ReactFlow` at line 208 |
| `grep -c "mockReactFlow"` test / `setupTests.ts` | **2 / 0** ✅ (setupTests byte-unchanged) |
| `grep -c "canvasFixtures"` in the test | **2** ✅ |
| `git diff --name-only` for this plan | **3 files, all `frontend/src/components/workflows/`** ✅ |

## Threat Model Compliance

- **T-183-01 (XSS via an authored `phase.name` / slug / declared skip target):** mitigated. Every
  authored string is a plain React text child; the call-form guard returns **0** in both new files and
  across the whole `components/workflows/` directory. The verbatim T-124-01 clause is carried in both
  docblocks.
- **T-183-08 (SVG injection via a phase-type-derived icon path):** mitigated, and untouched. No new
  slug is referenced; `phaseGlyph` is called with the definition's `phase_type` exactly as
  `PhaseSpine.tsx:87-89` does, and the `PHASE_GLYPHS[type] ?? "•"` fallback is imported, never
  re-declared. `grep -cE "compass|handshake"` is 0 (D-183-14).
- **T-183-11 (read-only defeated at runtime by the `<Controls>` interactivity lock):** mitigated AND
  proven. `.react-flow__controls-interactive` is asserted absent while `.react-flow__controls` is
  asserted present, and the mutation check confirmed the assertion actually fires.
- **T-183-04 (layout leaking into the definition):** mitigated. Selection and the ⌥ boolean are applied
  to a memoized COPY (`{ ...node, selected, data: { ...node.data, technical } }`); no code path writes
  to `phases` or to any definition object. Plan 183-05's purity suite remains the upstream tripwire and
  is still green.
- **T-183-06 (an unknown `phase_type` or malformed definition crashing the render):** mitigated. The
  glyph falls back through `phaseGlyph → PHASE_GLYPHS → "•"`, the icon tint falls back to
  `DEFAULT_TINT`, an empty subtitle renders nothing, and the edge style falls back to the flow style.
  Exercised across the fixture corpus.
- **ASVS conclusion INTACT.** Frontend-only: zero backend files, zero routes, zero migrations. The
  "this conclusion is VOID" condition did **not** trigger.

## Known Stubs

None. All three node components and the shell are fully implemented and every branch is exercised by a
green assertion. `WorkflowCanvas` has **no mount site yet by design** — plan 183-07 owns the Builder
toggle, the flag gate and the lazy split.

## User Setup Required

None — no dependency, no env var, no migration, no cloud parity owed.

## Next Phase Readiness

**Ready.** Hand-offs, explicitly:

- **183-07 (the toggle + the flag gate + the lazy split)** — import
  `React.lazy(() => import("@/components/workflows/WorkflowCanvas"))` (the default export exists) or
  the named `WorkflowCanvas`. Feed it the same `phases` / `selectedSlug` / `onSelectNode` the Builder
  already feeds `PhaseSpineGraph`. **Measure A6 only AFTER the mount site exists**: today the main
  entry is 1,727.32 kB / 434.40 kB gzip with **zero xyflow JS** in it, because nothing imports the
  canvas — a measurement taken now would falsely read as "the split works". The D-183-03 flag-off
  proof is the same one-liner this plan already uses for D-183-11: no `.react-flow` element in the
  container.
- **184 (editable canvas)** — the read-only prop set in `WorkflowCanvas.tsx` is the exact list to
  reverse, one flag at a time, and `showInteractive` must STAY false even then (an editable canvas
  still should not offer a lock that silently disables selection). The `EdgeAnchors` atom is where a
  real, visible connection handle would land.
- **185 (graded governance)** — `GROUNDING_TONE` and the `data-grounding` hook are the seam a graded
  dial replaces; `PhaseNodeData.grounding` already widens cleanly.
- **188 (run observability)** — the colour budget is INTACT: the card body is neutral, per-type colour
  is confined to `ICON_TINT` behind the mark, and the node is completely still. Run state gets the
  border, the glow and the motion.
- **All 183 plans** — `tsc -b` remains a differential against 33; `vite build` remains exit-0; the
  `dangerouslySetInnerHTML` gate must be read in its call form.

No blockers.

## Self-Check: PASSED

Files verified present on disk:

- FOUND: `frontend/src/components/workflows/PhaseNode.tsx`
- FOUND: `frontend/src/components/workflows/WorkflowCanvas.tsx`
- FOUND: `frontend/src/components/workflows/WorkflowCanvas.test.tsx`

Commits verified in `git log`:

- FOUND: `b58af996` — feat(183-06): add the three canvas node faces (sketch 137-D)
- FOUND: `1e761cc8` — feat(183-06): add the read-only WorkflowCanvas shell
- FOUND: `199d3090` — test(183-06): add the canvas DOM assertions the pure model cannot make

---
*Phase: 183-read-only-canvas*
*Completed: 2026-07-25*
