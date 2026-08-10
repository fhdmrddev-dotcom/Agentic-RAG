---
phase: 183-read-only-canvas
reviewed: 2026-07-25T22:43:52Z
depth: standard
files_reviewed: 32
files_reviewed_list:
  - backend/tests/unit/test_183_skip_parse_parity.py
  - frontend/package.json
  - frontend/src/App.tsx
  - frontend/src/components/admin/revertByteIdentical.test.tsx
  - frontend/src/components/workflows/PhaseFormPanel.test.tsx
  - frontend/src/components/workflows/PhaseFormPanel.tsx
  - frontend/src/components/workflows/PhaseNode.tsx
  - frontend/src/components/workflows/PhaseSpine.test.tsx
  - frontend/src/components/workflows/PhaseSpineGraph.test.tsx
  - frontend/src/components/workflows/PhaseSpineGraph.tsx
  - frontend/src/components/workflows/WorkflowCanvas.test.tsx
  - frontend/src/components/workflows/WorkflowCanvas.tsx
  - frontend/src/components/workflows/__fixtures__/canvasFixtures.ts
  - frontend/src/components/workflows/__fixtures__/skipParseCases.json
  - frontend/src/components/workflows/__snapshots__/canvasModel.fixtures.test.ts.snap
  - frontend/src/components/workflows/canvasModel.fixtures.test.ts
  - frontend/src/components/workflows/canvasModel.purity.test.ts
  - frontend/src/components/workflows/canvasModel.test.ts
  - frontend/src/components/workflows/canvasModel.ts
  - frontend/src/components/workflows/phaseVocabulary.test.ts
  - frontend/src/components/workflows/phaseVocabulary.ts
  - frontend/src/components/workflows/soulData.test.ts
  - frontend/src/components/workflows/soulData.ts
  - frontend/src/index.css
  - frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx
  - frontend/src/pages/WorkflowBuilderPage.tsx
  - frontend/src/providers/EffectiveFeaturesProvider.test.tsx
  - frontend/src/providers/EffectiveFeaturesProvider.tsx
  - frontend/src/test-utils/handleSpike.test.tsx
  - frontend/src/test-utils/mockReactFlow.ts
  - frontend/tsconfig.app.json
findings:
  critical: 1
  warning: 6
  info: 7
  total: 14
status: issues_found
---

# Phase 183: Code Review Report

**Reviewed:** 2026-07-25T22:43:52Z
**Depth:** standard
**Files Reviewed:** 32
**Status:** issues_found

## Summary

Phase 183 adds a read-only `@xyflow/react` canvas view to the Workflow Builder behind the
default-off `visual_workflow_canvas` flag. I verified the phase's five load-bearing
invariants against the source (not the prose), and four of them hold:

- **Fail-closed flag gate** — `WorkflowBuilderPage.tsx:193-201` uses the optional accessor,
  `!loading`, and a strict `=== true`. Confirmed against `EffectiveFeaturesProvider.tsx`
  (no default, no fallback value). No truthy check anywhere.
- **Flag-off byte-identity** — `graphColumn = graphChild` with the flag off, so
  `PhaseSpineGraph` remains the grid's first child with no wrapper. Verified in source and
  by the five-variant suite.
- **One vocabulary** — grep across `frontend/src` confirms exactly one `parseSkipTarget`
  (`phaseVocabulary.ts:94`) and one `PHASE_GLYPHS` (`soulData.ts:35`); the only remaining
  `PhaseSpineGraph` importers are its own test and the Builder page.
- **Cross-language parse parity** — `parseSkipTarget` is a prefix-length slice matching
  `reachability.py:89-98` byte-for-byte, and both suites read the same JSON table. Verified
  by reading `reachability.py` directly.
- **Purity / no mutation / handles** — `toCanvas` mutates nothing (verified by reading, and
  `adoptUserNodes` in `@xyflow/system` does not write back onto user nodes either);
  `PhaseNode`/`UnresolvedSkipNode`/`EndCapNode` all render `EdgeAnchors`.

Executable checks I ran: 4 model/vocabulary suites (235 tests) and 4 DOM suites (58 tests)
are green; `tsc --noEmit -p tsconfig.app.json` reports exactly the 33 pre-existing errors,
none in phase files; the CI-gated `eslint -c eslint.a11y.config.js` is clean on the new
files.

The defect the suites cannot see is the one that matters: **the canvas's only interaction —
click a node to open the form panel — is mouse-only.** Every test drives selection with
`fireEvent.click`, and React Flow's keyboard path provably never reaches `onNodeClick`. The
remaining findings are a governance-label honesty problem (`partial` → "No sources needed"),
a hardcoded dark color mode in an app that ships a light theme, two id-collision classes on
unconstrained slugs, and new (non-CI-gated) lint errors.

## Critical Issues

### CR-01: Canvas nodes are keyboard-focusable but not keyboard-operable — Enter/Space does nothing

**File:** `frontend/src/components/workflows/WorkflowCanvas.tsx:231-233` (with
`frontend/src/components/workflows/canvasModel.ts:240-243`,
`frontend/src/components/workflows/PhaseNode.tsx:17-23`)

**Issue:**
Selection is wired exclusively through `onNodeClick`:

```tsx
onNodeClick={(_, node) => {
  if (node.type === CANVAS_NODE_TYPES.phase) onSelectNode(node.id)
}}
```

React Flow's node wrapper handles `onClick` and `onKeyDown` on **separate paths**
(`@xyflow/react/dist/esm/index.js:2260-2296`): the mouse path calls `handleNodeClick(...)`
**and then** the user's `onClick`; the keyboard path (`Enter`/`Space`/`Escape`) calls
`handleNodeClick(...)` **only** — the user's `onClick` is never invoked. Worse, because this
canvas passes a controlled `nodes` array with **no `onNodesChange`**, `handleNodeClick` →
`addSelectedNodes` → `triggerNodeChanges` is a no-op (`index.js:3511-3522`: `hasDefaultNodes`
is false and `onNodesChange` is undefined). So pressing Enter or Space on a focused canvas
node produces **no state change, no panel, and no visual change at all**.

This is not cosmetic:

- The model deliberately advertises the node as an activatable control
  (`ariaRole: "button"` + `ariaLabel`, `canvasModel.ts:241-242`) and the shell deliberately
  keeps `nodesFocusable` at its `true` default "to preserve keyboard reachability"
  (`WorkflowCanvas.tsx:9-16`). The promise is made and not kept — WCAG 2.1.1 (Keyboard) for
  the surface's sole affordance.
- `PhaseNode` is contractually free of any inner focusable control ("Pattern 3 Option A",
  `PhaseNode.tsx:17-23`), so there is no alternative activation target inside the node either.
- The DOM suite only ever uses `fireEvent.click` (`WorkflowCanvas.test.tsx:110-150`,
  `WorkflowBuilderPage.canvas.test.tsx:21-31`), and the "one tab stop per node" test asserts
  reachability but never activation — so the gate passes while the behaviour is broken.

**Fix:** wire a keyboard activation path and cover it with a test. `<ReactFlow>` spreads
unknown props onto its wrapper `div` (`index.js:3736`, `...rest`), so a bubbling handler is
the smallest correct change:

```tsx
// WorkflowCanvas.tsx
const activateFromKeyboard = (e: React.KeyboardEvent<HTMLDivElement>) => {
  if (e.key !== "Enter" && e.key !== " ") return
  const el = (e.target as HTMLElement).closest<HTMLElement>(".react-flow__node")
  const id = el?.dataset.id
  if (!id) return
  // only phase nodes carry a slug id; stubs/cap are not selectable/focusable
  if (!projection.nodes.some((n) => n.id === id && n.type === CANVAS_NODE_TYPES.phase)) return
  e.preventDefault()
  onSelectNode(id)
}

<ReactFlow
  /* …existing props… */
  onKeyDown={activateFromKeyboard}
>
```

Add to `WorkflowCanvas.test.tsx`:

```tsx
it("Enter on a focused node fires onSelectNode (keyboard parity with click)", () => {
  const onSelectNode = vi.fn()
  const { container } = renderCanvas(researchSummarize, { onSelectNode })
  const node = container.querySelector('.react-flow__node[data-id="summarize"]')!
  fireEvent.keyDown(node, { key: "Enter" })
  expect(onSelectNode).toHaveBeenCalledWith("summarize")
})
```

(See also WR-06 — the screen-reader description that promises this keystroke must be
corrected in the same change.)

## Warnings

### WR-01: `groundingFor` labels `citation_policy: "partial"` as "No sources needed", contradicting the shipped tier derivation

**File:** `frontend/src/components/workflows/phaseVocabulary.ts:210-217` (words at `:185-189`)

**Issue:** `groundingFor` returns `GROUNDINGS.open` — glyph `○`, words **"No sources
needed"** — for every policy that is not `"strict"`/`"flag"`, and the docblock names
`"partial"` explicitly as included. But `partial` is a real enforcement level:
`deriveTier.ts:109-118` maps `"flag" | "partial"` to **MIDDLE** with the description
`"Citations flagged or partial; core gates enforced."`, and `soulData.POLICY_ORDER`
(`soulData.ts:74`) ranks `partial` above `draft`.

Result: for an `llm_emit` phase with `citation_policy: "partial"`, the workflow soul badge
says `◐ Middle — citations flagged or partial` while the canvas node one click away says
`○ No sources needed`. The canvas statement is factually wrong about a governance control,
on the surface v3.6 is building specifically to make governance legible. Totality does not
require this: an *unknown* policy can safely fall through to `open` while a *known* one is
mapped honestly.

**Fix:**

```ts
if (policy === "strict" || hasCitationGate) return GROUNDINGS.strict
if (policy === "flag" || policy === "partial") return GROUNDINGS.flag
return GROUNDINGS.open
```

If the operator wants `partial` visually distinct from `flag`, add a fourth face rather than
folding it into `open`. Update `phaseVocabulary.test.ts:181-186` (which currently pins the
wrong behaviour) and re-record the canvas snapshot.

### WR-02: `colorMode="dark"` is hardcoded — the canvas paints a black plane inside the light theme

**File:** `frontend/src/components/workflows/WorkflowCanvas.tsx:226`

**Issue:** The app ships a real light theme: `index.html:13-20` restores a saved
`localStorage.theme` / `prefers-color-scheme`, `tailwind.config.js` uses `darkMode: ["class"]`,
`index.css:17` defines the full light token set, and `ProfileMenu.tsx:48,173-178` renders a
user-facing Light/Dark toggle. `colorMode="dark"` unconditionally adds `.dark` to the React
Flow root (`index.js:3730,3736`), which activates `.react-flow.dark` in
`@xyflow/react/dist/style.css:53-92`: `--xy-background-color-default: #141414`,
`--xy-controls-button-background-color-default: #2b2b2b`, dark edge strokes. A light-theme
user opening the Canvas view gets a `#141414` rectangle with dark control buttons inside a
light page — while `PhaseNode`'s own `dark:` Tailwind variants (`PhaseNode.tsx:269`) key off
the `<html>` class and stay in *light* mode. The two halves of the same card disagree.

**Fix:** derive the mode instead of asserting it — either lift the theme the layout already
owns down as a prop, or read the same class the theme script sets:

```tsx
const colorMode: ColorMode =
  typeof document !== "undefined" && document.documentElement.classList.contains("dark")
    ? "dark"
    : "light"
// …
<ReactFlow colorMode={colorMode} … />
```

(`colorMode="system"` is *not* equivalent — it follows `prefers-color-scheme`, not the saved
`localStorage.theme` the app honours.)

### WR-03: duplicate phase slugs in an unsaved draft collapse silently into one canvas node

**File:** `frontend/src/components/workflows/canvasModel.ts:225-244`

**Issue:** `bySlug`, `columnOf` and the node `id` are all keyed on `phase.slug`, and
`nodes.push({ id: phase.slug, … })` runs once per phase. Two phases sharing a slug therefore
emit **two nodes with the same id**; React Flow's `nodeLookup` is a `Map` keyed by id, so the
second silently overwrites the first and one phase vanishes from the picture, while
`columnOf`/`bySlug` resolve last-wins and can place edges on the wrong column. Backend lint
rejects duplicate slugs (`reachability.py:123-129`, `bad_index`), **but the Builder projects
unsaved LLM-generated drafts and draft rows, neither of which is lint-gated** — exactly the
argument `canvasFixtures.ts:260-264` makes for the `phase_index` gap case, which *was*
handled. `PhaseSpec.slug` is an unconstrained `str` (`backend/app/models/harness.py:190`).

The whole point of the C-2 work is that the canvas must not lie about what will run; a
dropped phase is a bigger lie than a phantom edge.

**Fix:** make node identity total, or make the collision visible. Minimal version — dedupe
deterministically and keep every phase drawn:

```ts
const seen = new Set<string>()
for (const [col, phase] of ordered.entries()) {
  let id = phase.slug
  while (seen.has(id)) id = `${id}~dup`   // deterministic, no counter/randomness
  seen.add(id)
  // …push node with `id`, and record `idOf.set(phase, id)` for the edge pass
}
```

and resolve edge endpoints through `idOf` rather than `phase.slug`. Add a fixture
(`duplicate slug`) to `ALL_FIXTURES` so the sweep's `no duplicate node id` assertion actually
exercises it — today no fixture can trip it.

### WR-04: reserved-id and edge-id string concatenation can collide on slugs containing `:` or `->`

**File:** `frontend/src/components/workflows/canvasModel.ts:261,289,307,332`

**Issue:** The module correctly defends against a slug that *spells* the reserved prefix
(`reservedId`, `:170-174`) but builds every other id by raw concatenation over the same
unconstrained slugs:

- `__canvas__unresolved:${fromSlug}:${target}` — phase `a` skipping to `b:c` and phase `a:b`
  skipping to `c` both produce `__canvas__unresolved:a:b:c`. `emittedStubIds` then suppresses
  the second stub, so one broken reference is rendered with **another phase's**
  `declaredTarget`/`fromSlug` (the stub is the D-183-10 honesty feature — mislabelling it
  defeats its purpose).
- `seq:${a}->${b}` / `skip:${a}->${b}` — a slug containing `->` can make two distinct edges
  share an id, and `pushEdge` (`:248-252`) then **silently drops** the second real edge.

`skip_to_phase:a:b` resolving to the literal target `a:b` is exactly the case correction C-1
made canonical, so colon-bearing targets are a modelled input, not a hypothetical.

**Fix:** use a delimiter-safe key:

```ts
const key = (...parts: string[]) => parts.map(encodeURIComponent).join(":")
const stubId = reservedId(key("unresolved", phase.slug, target), slugSet)
pushEdge({ id: key("seq", phase.slug, successor.slug), … })
```

Add a fixture with a colon-bearing slug/target to `ALL_FIXTURES`.

### WR-05: the phase introduces new ESLint errors

**File:** `frontend/src/components/workflows/PhaseNode.tsx:159,238,289`

**Issue:** `npx eslint` on the new sources reports:

- `PhaseNode.tsx:159/238` — `react-hooks/static-components`: *"Cannot create components during
  render"* for `const Glyph = phaseGlyph(data.phaseType)` used as `<Glyph … />`. Behaviourally
  benign (the resolver returns a stable module-scope component from
  `phaseGlyph.tsx:46-53`), but it is a **new** error: the analogous shipped call sites
  (`PhaseSpineGraph.tsx:121`, `PhaseSpine.tsx:88`) sit inside a `.map` callback and do not
  trip the rule. Left as-is it trains the team to ignore the rule.
- `PhaseNode.tsx:289` — `@typescript-eslint/no-unused-vars` for `_props`; the project config
  has no `^_` ignore pattern, so the underscore convention does not apply here.

`EffectiveFeaturesProvider.tsx:77,93` also raise `react-refresh/only-export-components`, but
that exactly mirrors the shipped `TechnicalNamesProvider.tsx:90,104` — pre-existing house
pattern, noted for completeness. Repo-wide `eslint .` is already at 191 errors and is **not**
CI-gated (`frontend-tests.yml:45-57` runs only the a11y-scoped config, which is clean here),
so this is quality debt, not a build break.

**Fix:**

```tsx
export function EndCapNode() {           // drop the unused parameter entirely
```

and for the glyph, either hoist the lookup into a tiny presentational leaf
(`<PhaseGlyphMark type={data.phaseType} />` declared at module scope) or add a scoped
`// eslint-disable-next-line react-hooks/static-components` with the reason (stable
module-scope map) so the suppression is auditable.

### WR-06: screen readers are told "Press enter or space to select… press delete to remove it" on a read-only canvas

**File:** `frontend/src/components/workflows/WorkflowCanvas.tsx:208-234`

**Issue:** React Flow attaches a default node description
(`@xyflow/system` `defaultAriaLabelConfig`):
`"Press enter or space to select a node. Press delete to remove it and escape to cancel."`
Neither half is true here: Enter/Space is inert (CR-01) and `deleteKeyCode={null}` disables
deletion. A screen-reader user is instructed to perform two actions the surface refuses,
which is a worse experience than an unlabelled node and directly contradicts the "read-only
is TRUE rather than assumed" claim in the file's own docblock.

**Fix:** override the config alongside the CR-01 keyboard wiring:

```tsx
const ARIA_LABELS = {
  "node.a11yDescription.default": "Press enter or space to open this step's details.",
  "node.a11yDescription.keyboardDisabled": "Press enter or space to open this step's details.",
} as const

<ReactFlow ariaLabelConfig={ARIA_LABELS} … />
```

## Info

### IN-01: the phase-glyph fallback is unreachable by construction

**File:** `frontend/src/components/workflows/PhaseNode.tsx:160,238`
**Issue:** `PHASE_GLYPHS` (`soulData.ts:35-42`) and `PHASE_GLYPH_MARKS`
(`phaseGlyph.tsx:46-53`) have identical key sets, so `Glyph === null` implies
`PHASE_GLYPHS[type] === undefined`; `glyphFallback` is therefore **always** `"•"`. The
`PHASE_GLYPHS` import in this file exists only to compute a constant.
**Fix:** `const glyphFallback = "•"` and drop the import (or keep it and state in the comment
that the lookup is defensive only). Same latent redundancy exists in the shipped spines — fix
here, don't propagate.

### IN-02: node titles truncate with no tooltip and no reveal

**File:** `frontend/src/components/workflows/PhaseNode.tsx:186-188`
**Issue:** The title uses `truncate` inside a fixed 260px card and renders no `title=`
attribute — so an authored `phase.name` longer than the card is unreadable, with no hover,
no expand and no other place on the canvas to see it. The file's own docblock (`:57-58`)
claims authored strings are rendered "as a plain React text child / `title=` attribute
value"; the `title=` half does not exist.
**Fix:** `<p title={title} className="truncate …">` (safe — an attribute value, not HTML) and
align the docblock with the code.

### IN-03: the jsdom `DOMMatrixReadOnly` mock only parses single-character scales

**File:** `frontend/src/test-utils/mockReactFlow.ts:73`
**Issue:** `transform?.match(/scale\(([1-9.])\)/)` captures exactly one character, so
`scale(0.5)`, `scale(1.25)` and `scale(0.35)` all fail to match and `m22` falls back to `1`.
The canvas runs `fitView` with `minZoom: 0.3`, so fractional zoom is the normal case and edge
geometry is measured at the wrong scale in tests. (This is faithful to the upstream React
Flow testing guide, which has the same bug.)
**Fix:** `transform?.match(/scale\(([\d.]+)\)/)`.

### IN-04: the backend parity test passes `None` to a parameter annotated `str`

**File:** `backend/tests/unit/test_183_skip_parse_parity.py:58-64` (with
`backend/app/services/harness/reachability.py:89`)
**Issue:** The shared table's `{"on_failure": null}` row arrives as `None`, which the test
feeds to `parse_skip_target(on_failure: str)`. Runtime is safe (`isinstance` guard), but the
annotation is now provably wrong and any future type-check pass will flag the call.
**Fix:** widen the source signature to `on_failure: str | None` — it documents the guard the
function already implements.

### IN-05: five of the fifteen canvas fixtures are byte-identical

**File:** `frontend/src/components/workflows/__fixtures__/canvasFixtures.ts:92-191`
**Issue:** `riskRegister`, `weeklyStatusReport`, `complianceGapReport`, `pmWeeklyStatusReport`
and `pmRiskRegister` have identical `phases` arrays (same slugs, indices, configs,
validators), so they produce five identical projections and five near-identical snapshot
blocks. The "15-fixture corpus" therefore covers 11 distinct shapes; the sweep count
overstates coverage and the snapshot file carries ~300 redundant lines.
**Fix:** keep one representative plus a comment naming the four provenance twins, or
differentiate them (e.g. give one a non-strict `citation_policy`) so the extra entries buy
coverage.

### IN-06: the view toggle uses `role="tab"` without a tabpanel, `aria-controls`, or roving tabindex

**File:** `frontend/src/pages/WorkflowBuilderPage.tsx:503-545`
**Issue:** The strip declares `role="tablist"`/`role="tab"` but the graph column it swaps is
not `role="tabpanel"`, there is no `aria-controls`, and both tabs are natural tab stops
(the ARIA pattern expects arrow-key navigation with `tabindex="-1"` on the unselected tab).
Consistent with the house pattern at `SkillStudioPage.tsx:191-211`, so this is a codebase-wide
gap rather than a regression.
**Fix:** add `aria-controls` + `role="tabpanel"`/`id` on the graph column and roving tabindex
with `ArrowLeft`/`ArrowRight` handling — ideally once, as a shared `SegmentedTabs` primitive
used by both call sites.

### IN-07: the backend test suite now depends on the frontend tree existing

**File:** `backend/tests/unit/test_183_skip_parse_parity.py:28-50`
**Issue:** `_load_cases()` resolves `parents[3]/frontend/src/...` at **import time** and
`assert`s the file exists, so the whole module errors out in any checkout/image that does not
carry `frontend/` (backend-only container, sparse checkout). Full-repo CI is unaffected.
**Fix:** `pytest.skip("shared fixture table not present in this checkout",
allow_module_level=True)` when the path is missing, keeping the hard failure only when the
file exists but is malformed — the control still cannot be silently deleted, because deleting
it fails the TypeScript half's truncation guard.

---

_Reviewed: 2026-07-25T22:43:52Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
