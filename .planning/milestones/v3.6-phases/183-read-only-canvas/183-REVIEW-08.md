---
phase: 183-read-only-canvas
scope: gap-closure-183-08
reviewed: 2026-07-26T00:00:00Z
depth: deep
diff_range: 7f727940..bda98813
files_reviewed: 5
files_reviewed_list:
  - frontend/src/components/workflows/WorkflowCanvas.tsx
  - frontend/src/components/workflows/WorkflowCanvas.test.tsx
  - frontend/src/components/workflows/phaseVocabulary.ts
  - frontend/src/components/workflows/phaseVocabulary.test.ts
  - frontend/src/components/workflows/PhaseNode.tsx
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
status: issues_found
---

# Phase 183 Plan 08 (Gap Closure): Code Review Report

**Reviewed:** 2026-07-26
**Depth:** deep (cross-file — `canvasModel.ts`, `deriveTier.ts`, `soulData.ts`,
`WorkflowBuilderPage.tsx` and the installed `@xyflow/react@12.11.2` were read as
call-chain context, not as review targets)
**Diff range:** `7f727940..bda98813` (commits `94c9c642`, `9488bd05`, `bda98813`)
**Files Reviewed:** 5
**Status:** issues_found

> **This file does NOT supersede `183-REVIEW.md`.** The parent
> `.planning/phases/183-read-only-canvas/183-REVIEW.md` remains the authoritative
> ledger for this phase's open, deliberately-deferred debt — **WR-02, WR-03, WR-04
> and IN-01 … IN-07**. Nothing here closes, restates or renumbers those. This report
> covers ONLY the source changes introduced by plan `183-08`, and its finding IDs are
> namespaced `CR-08-*` / `WR-08-*` / `IN-08-*` so they cannot be confused with the
> parent's.

## Summary

The four targeted findings are genuinely closed, and I verified each against the
source rather than the SUMMARY:

- **CR-01 — closed.** `activateFromKeyboard` (`WorkflowCanvas.tsx:202-221`) is attached
  as `onKeyDown` on `<ReactFlow>`. I confirmed in `@xyflow/react/dist/esm/index.js:3736`
  that `...rest` is spread onto the wrapper `div` **before** the library's own `onScroll`,
  `style`, `ref`, `className`, `id` and `role` — so the handler is not clobbered. The
  node wrapper carries `data-id` (`index.js:2349`), and `reservedId()`
  (`canvasModel.ts:169-173`) provably prevents the cap/stub ids from ever equalling a
  real slug, so the `projection.nodes.some(... type === phase)` guard is sound: I could
  not construct an input where the end cap or the unresolved-skip stub activates.
- **Read-only survives.** The keyboard path's only outward call is `onSelectNode(id)` →
  `WorkflowBuilderPage.handleSelectNode` (`:205-207`), a pure `setSelectedSlug`. No
  `onNodesChange` was added, so the library's own `handleNodeClick` → `addSelectedNodes`
  → `triggerNodeChanges` stays a verified no-op (`index.js:3511-3522`: `hasDefaultNodes`
  is false and `onNodesChange` is undefined). No fetch, no mutation, no drag re-enable.
- **WR-05 — closed.** `npx eslint src/components/workflows/{PhaseNode.tsx,WorkflowCanvas.tsx,phaseVocabulary.ts}`
  returns **0 problems**. `renderPhaseMark` produces `createElement(mark, {className:"h-8 w-8"})`
  from the same stable module-scope map, so the rendered output is unchanged.
- **WR-01 — closed for the value it names.** `groundingFor("partial")` now returns the
  `◐` MIDDLE face. Only `canvasModel.ts:196` consumes `groundingFor`, so the semantic
  change is contained and cannot leak into another surface.

What the change did **not** get right is the *durability* of those closures. Three of
the four warnings below are the same shape: **the fix is correct, and the artifact that
is supposed to keep it correct — a type, a test, or a docblock — is weaker than the
claim it makes.** The fourth is a new behavioural gap on the net-new keyboard path that
neither the plan nor the suite models: key repeat.

There are **no Critical findings**. I looked specifically for a write path, a mutation,
a drag re-enable, an id-collision over-reach and a stale closure, and none of them is
reachable. The classification below is deliberate, not softened — see WR-08-01 for why
key repeat stopped short of Critical.

## Warnings

### WR-08-01: keyboard activation has no `event.repeat` guard — a held Enter/Space rapid-toggles the selection the mouse path can only open once

**File:** `frontend/src/components/workflows/WorkflowCanvas.tsx:202-221` (guard at `:204`),
with `frontend/src/pages/WorkflowBuilderPage.tsx:205-207`

**Issue:**
The handler admits any keydown whose `key` is `"Enter"` or `" "`:

```ts
if (event.key !== "Enter" && event.key !== " ") return
```

`keydown` **auto-repeats while a key is held** (Windows default: ~500 ms delay, then
up to ~31 events/sec). Every repeat re-runs the whole handler and calls
`onSelectNode(id)` again. The consumer is a **toggle**:

```ts
const handleSelectNode = useCallback((slug: string) => {
  setSelectedSlug((cur) => (cur === slug ? null : slug))
}, [])
```

So a keyboard user who holds Enter on a phase node for ~1 s gets roughly 15 open/close
toggles of the 400 px form panel, and the final state is decided by the **parity of the
repeat count** — press-and-hold can leave the panel *closed*, which is the exact
opposite of the affordance the new `ARIA_LABELS` string announces ("Press enter or
space to open this step's details"). The mouse path is structurally immune: a held
mouse button produces one `click`. The docblock's claim at `:22-25` — *"one selection
rule with two input devices rather than two rules that can drift"* — is therefore not
quite true; the keyboard device carries repeat semantics the shared rule does not
account for.

This matters more than a generic UX nit because the population that benefits from
CR-01's fix (keyboard-only users, switch users, users with motor impairments and
Sticky/Filter Keys enabled) is precisely the population most likely to hold a key past
the repeat threshold.

The suite cannot see it: `WorkflowCanvas.test.tsx:170-190` dispatches a single
`fireEvent.keyDown` and asserts `toHaveBeenCalledTimes(1)` — synthetic events never set
`repeat: true`, so the assertion is satisfied by construction.

**Not Critical** because a normal discrete press behaves correctly and nothing is
persisted, lost or corrupted — the damage is a visible flicker and a possibly-wrong
terminal panel state. It is the highest-priority Warning.

**Fix** — one line, and add the repeat case to the gate that was installed precisely so
this class of defect cannot ship green again:

```ts
const activateFromKeyboard = useCallback(
  (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return
    // Auto-repeat must not re-fire a TOGGLE: one press is one activation.
    if (event.repeat) return
    // …unchanged…
  },
  [projection.nodes, onSelectNode],
)
```

```tsx
it("a held key (auto-repeat) activates exactly once, never re-toggling", () => {
  const onSelectNode = vi.fn()
  const { container } = renderCanvas(researchSummarize, { onSelectNode })
  const node = container.querySelector('.react-flow__node[data-id="summarize"]')!
  fireEvent.keyDown(node, { key: "Enter" })
  fireEvent.keyDown(node, { key: "Enter", repeat: true })
  fireEvent.keyDown(node, { key: "Enter", repeat: true })
  expect(onSelectNode).toHaveBeenCalledTimes(1)
})
```

---

### WR-08-02: the new `groundingFor` docblock asserts a canvas↔soul agreement that is false in three reachable configurations, and the cross-module pin is scoped so it can never see them

**File:** `frontend/src/components/workflows/phaseVocabulary.ts:185-189` and `:208-213`
(claims), `frontend/src/components/workflows/phaseVocabulary.test.ts:200-207` (the pin)

**Issue:**
The WR-01 mapping change is right. The prose wrapped around it overshoots, and the test
that is supposed to hold the line is narrower than the prose:

```
The reuse is a BAND match, not just a glyph match: the `flag` face covers exactly
the `flag | partial` band `deriveTier` calls MIDDLE (`deriveTier.ts:112-115`), so a
phase cannot read one strictness on the canvas and a different one on the workflow
soul a click away.
```

`deriveTier` does **not** map `flag | partial` to MIDDLE unconditionally — `:115` reads
`return hasAllFloorGates ? TIERS.STRICT : TIERS.MIDDLE`, and the `draft` arm at `:118`
promotes to MIDDLE on *any* floor-raising gate. `groundingFor` models neither
promotion, and it applies a `citations_required` rule that `deriveTier` does not have
at all. Three configurations reachable from the Builder today therefore still show two
different strictness faces one click apart — the exact defect WR-01 was filed about:

| Definition (one `llm_emit` phase) | Canvas badge (`groundingFor`) | Soul badge (`tierForDefinition` → `deriveTier`) |
|---|---|---|
| `citation_policy: "draft"` + validator `citations_required` | 🔒 **Must cite its sources** | ○ **Loose** — "Draft citations" (`citations_required` is not in `FLOOR_RAISING_GATES`, `deriveTier.ts:82-86`) |
| `citation_policy: "flag"` + `output_file_valid` + `structure_check` + `freshness` | ◐ Flags uncited claims | 🔒 **Strict** (`hasAllFloorGates` promotion, `deriveTier.ts:115`) |
| `citation_policy: "draft"` + `structure_check` | ○ **No sources needed** | ◐ **Middle** (`hasAnyFloorGate` promotion, `deriveTier.ts:118`) |

Row 1 is a straight contradiction of the same magnitude as the original WR-01
("Must cite its sources" vs "Draft citations"). Row 3 is WR-01 verbatim, with `draft`
substituted for `partial`.

The pin cannot catch any of them:

```ts
for (const policy of ["flag", "partial"] as const) {
  expect(deriveTier(policy, new Set()).id).toBe("MIDDLE")
  expect(groundingFor(...).glyph).toBe(TIERS.MIDDLE.glyph)
}
```

`new Set()` is exactly the validator set that makes both promotion branches inert, and
the two policies are hardcoded, so the pin is blind to `draft`, blind to
`citations_required`, blind to every floor gate, and blind to a fifth `CitationPolicy`
value being added to `deriveTier`'s MIDDLE arm.

There is a legitimate scope difference — `tierForDefinition` (`soulData.ts:86-110`)
aggregates the strictest emit policy and the *union* of validator kinds across the
whole definition, while `groundingFor` is per-phase — but the docblock makes the strong
claim anyway, and a single-emit-phase workflow (the common shape) collapses the two
scopes so the difference is no defence in the table above. Phase 183's own
`183-CONTEXT` names the stale-in-code-claim hazard (T-183-09) as something this phase
has already tripped on twice; this is a third instance, created by the fix for the
second.

**Fix — two parts.**

1. Narrow the claim to what is true. Replace *"so a phase cannot read one strictness on
   the canvas and a different one on the workflow soul a click away"* with the honest
   version: the two modules agree on the **base** `citation_policy → tier` mapping;
   `deriveTier`'s gate-promotion arms (`:115`, `:118`) and `groundingFor`'s
   `citations_required` rule are **not** modelled by each other, so a
   gate-carrying phase can still read differently on the two surfaces. If the intent is
   full agreement, that is a Phase 185 `grounding-mode` item — say so, do not assert it.
2. Make the pin total over the enum instead of enumerating two values, so a new policy
   or a moved arm fails a test rather than silently drifting:

```ts
const POLICIES: CitationPolicy[] = ["strict", "flag", "partial", "draft"]
const GLYPH_FOR_TIER = { STRICT: "🔒", MIDDLE: "◐", LOOSE: "○" } as const

it.each(POLICIES)(
  "citation_policy %s: the canvas glyph matches deriveTier's base (no-gate) tier",
  (policy) => {
    const tier = deriveTier(policy, new Set())
    expect(groundingFor(phase({ config: { phase_type: "llm_emit", citation_policy: policy } })).glyph)
      .toBe(GLYPH_FOR_TIER[tier.id])
  },
)
```

(That version fails today on `draft` only if `groundingFor` and `deriveTier` disagree at
the base — they do not — and it will fail loudly the moment either module gains or moves
a policy, which the current pin will not.)

---

### WR-08-03: `ARIA_LABELS` is untyped, so a misspelled or library-renamed key typechecks clean and silently restores React Flow's false default

**File:** `frontend/src/components/workflows/WorkflowCanvas.tsx:118-121`

**Issue:**
The override is a bare object literal with no type relationship to the library's config:

```ts
const ARIA_LABELS = {
  "node.a11yDescription.default": "Press enter or space to open this step's details.",
  "node.a11yDescription.keyboardDisabled": "Press enter or space to open this step's details.",
}
```

`ariaLabelConfig?: Partial<AriaLabelConfig>` is a **weak type**, and `ARIA_LABELS` is
passed as an *identifier*, not a fresh literal — so TypeScript's excess-property check
does not apply. As long as **at least one** key still matches, every other key can be
wrong and the file compiles. I verified this empirically against the installed
`@xyflow/react@12.11.2` (scratch probe, `tsc --noEmit --strict`):

```ts
const ARIA_LABELS = {
  "node.a11yDescription.default": "…",          // correct
  "node.a11yDescription.keyboardDisabledd": "…", // typo
}
const accepted: Partial<AriaLabelConfig> = ARIA_LABELS   // EXIT=0 — no error
```

Consequences:

- A future `@xyflow/react` upgrade that renames either description key reverts that key
  to `defaultAriaLabelConfig` (`@xyflow/system/dist/esm/index.js:30-31`) — i.e. straight
  back to *"…use the arrow keys to move the node around. Press delete to remove it…"* —
  with a green typecheck and a green build. WR-06 un-closes itself silently.
- The `node.a11yDescription.default` half is covered by **no test at all** (see
  IN-08-04), so only the `keyboardDisabled` key has any regression signal whatsoever.

`AriaLabelConfig` is exported as a type from `@xyflow/react`
(`dist/esm/index.d.ts:37`), so this costs one import and zero runtime. Plan 183-08
explicitly instructed the executor *not* to annotate the const; that instruction is the
source of the defect, and `satisfies` satisfies both goals (no widening, full key
checking).

**Fix:**

```ts
import { /* …existing… */ type AriaLabelConfig } from "@xyflow/react"

const ARIA_LABELS = {
  "node.a11yDescription.default": "Press enter or space to open this step's details.",
  "node.a11yDescription.keyboardDisabled": "Press enter or space to open this step's details.",
} satisfies Partial<AriaLabelConfig>
```

---

### WR-08-04: the honest description is attached to the end cap and the unresolved-skip stub too — two inert nodes now promise "Press enter or space to open this step's details"

**File:** `frontend/src/components/workflows/WorkflowCanvas.tsx:118-121`, with
`frontend/src/components/workflows/canvasModel.ts:295-303` and `:324-329`

**Issue:**
React Flow renders **one** description element and points **every** node at it,
unconditionally on focusability (`@xyflow/react/dist/esm/index.js:2349`):

```js
"aria-describedby": disableKeyboardA11y ? undefined : `${ARIA_NODE_DESC_KEY}-${rfId}`
```

The `unresolvedSkip` stub and the `endCap` are created with `selectable: false,
focusable: false` (`canvasModel.ts:302-303`, `:328-329`), and the whole point of the
CR-01 guard is that they must **never** activate. They nevertheless carry
`aria-describedby` at the new string, so a screen-reader user browsing the canvas is
told that Enter or Space will "open this step's details" on the two nodes where it
provably does nothing.

Before this change the falsehood was the library's generic one and was uniformly wrong
on every node. After it, the promise is *more specific and more actionable* on nodes
that refuse it — which is the same failure mode WR-06 was filed for, on the commit that
claims to close WR-06. The new test (`WorkflowCanvas.test.tsx:346-364`) renders
`evalCoverage`, which contains neither a stub nor a broken reference, so the case is
untested.

(Impact is bounded: both nodes render with `role` undefined — `ariaRole` is not set on
them — so how consistently a given AT surfaces the description on a generic element
varies. It is still a claim the surface cannot honour, on the exact nodes the phase
went out of its way to make inert.)

**Fix:** `domAttributes` is a supported, typed `Node` field
(`@xyflow/react/dist/esm/types/nodes.d.ts:24`) and is spread **after**
`aria-describedby` at `index.js:2349`, so the reference can be cleared per node in the
model where the inertness is already declared:

```ts
// canvasModel.ts — the unresolvedSkip stub and the endCap, beside selectable/focusable:
draggable: false,
selectable: false,
focusable: false,
// Not activatable — so it must not inherit the "press enter to open" description.
domAttributes: { "aria-describedby": undefined },
```

and extend the WR-06 test to a fixture that contains a stub (`unresolvableSkip` is
already imported by the suite):

```tsx
it("the inert nodes do not inherit the activation description", () => {
  const { container } = renderCanvas(unresolvableSkip)
  const desc = container.querySelector('[id^="react-flow__node-desc"]')!
  for (const id of ["canvas-end-cap", "canvas-unresolved-skip"]) {
    const wrapper = screen.getByTestId(id).closest(".react-flow__node")!
    expect(wrapper.getAttribute("aria-describedby")).not.toBe(desc.id)
  }
})
```

## Info

### IN-08-01: the "non-phase nodes stay inert" test is vacuously green and has no positive control

**File:** `frontend/src/components/workflows/WorkflowCanvas.test.tsx:191-197`
**Issue:** The test dispatches on the inner `canvas-end-cap` / `canvas-unresolved-skip`
cards and asserts `onSelectNode` was not called. It passed at RED — before
`activateFromKeyboard` existed — and it will keep passing if `closest(".react-flow__node")`
ever resolves to `null` (a DOM-structure change in the library, a testid moved outside
the wrapper), i.e. for a reason unrelated to the guard it claims to protect. That is the
same "asserts a negative that cannot fail" shape that let CR-01 ship green in the first
place.
**Fix:** add a positive control in the *same* render so the assertion proves the guard
discriminates rather than proving the handler is absent:

```tsx
const firstPhase = container.querySelector(".react-flow__node[data-id]")! // a phase node
fireEvent.keyDown(firstPhase, { key: "Enter" })
expect(onSelectNode).toHaveBeenCalledTimes(1)   // the handler IS wired…
onSelectNode.mockClear()
fireEvent.keyDown(screen.getByTestId("canvas-end-cap"), { key: "Enter" })
expect(onSelectNode).not.toHaveBeenCalled()     // …and it still refuses the cap.
```

### IN-08-02: `renderPhaseMark`'s docblock says the mark is "resolved at MODULE scope" — only the declaration is

**File:** `frontend/src/components/workflows/PhaseNode.tsx:143-162`
**Issue:** The heading reads *"The 3D mark, resolved at MODULE scope and returned as a
`ReactNode`."* The resolution (`phaseGlyph(phaseType)`) runs on **every render** of
`PhaseNode` — `renderPhaseMark` is *declared* at module scope but *called* from the
render body at `:255`. Behaviour is unchanged and correct (`PHASE_GLYPH_MARKS` is a
stable module-scope map, `phaseGlyph.tsx:46-53`), but the sentence describes a
memoisation that does not exist, in a file whose sibling docblocks are treated as
contracts.
**Fix:** *"The 3D mark lookup, DECLARED at module scope so the component binding is
never created inside a render body (`react-hooks/static-components`); the lookup itself
still runs per render and is a cheap `Record` read."*

### IN-08-03: Space activates on `keydown` while the node advertises `ariaRole="button"`

**File:** `frontend/src/components/workflows/WorkflowCanvas.tsx:204`, with
`frontend/src/components/workflows/canvasModel.ts:237-243`
**Issue:** `canvasModel` sets `ariaRole: "button"` on phase nodes. The WAI-ARIA APG
button pattern activates **Enter on keydown and Space on keyup**; a native `<button>`
behaves the same way, which is also why a native button cannot be rapid-fired by holding
Space. This implementation activates both on keydown. The library's own
`elementSelectionKeys` uses the same keydown convention, so the code is *consistent with
xyflow* while being inconsistent with the role it declares. Combined with WR-08-01 this
is what makes a held Space maximally destructive.
**Fix:** if WR-08-01 is fixed with an `event.repeat` guard this is cosmetic; if strict
button semantics are wanted, split — Enter on `onKeyDown`, Space on `onKeyUp` with
`preventDefault()` still on the Space `keydown` to suppress page scroll.

### IN-08-04: the `node.a11yDescription.default` override is unreachable on this canvas and untested

**File:** `frontend/src/components/workflows/WorkflowCanvas.tsx:119`
**Issue:** `A11yDescriptions` renders the `default` key only when `disableKeyboardA11y`
is true (`@xyflow/react/dist/esm/index.js:93-94`), and plan 183-08's own source
assertion forbids `disableKeyboardA11y` from appearing anywhere in this file
(grep must return 0). The key can therefore never render here. Overriding it is
harmless, deliberate defence against the library's inverted mapping — but it is dead on
this surface and, per WR-08-03 above, it is the half no test can protect.
**Fix:** none required; if kept, note in the `ARIA_LABELS` docblock that the `default`
key is defensive-only and unreachable while this canvas keeps the keyboard-a11y opt-out
at its default, so a future reader does not assume it is exercised. (Mind the file's own
`?raw` prohibition greps when wording it.)

## What I checked and did NOT find

Recorded so a later reader knows these were probed, not skipped:

- **No write / network / mutation reachable from the keyboard path.** `onSelectNode` is
  the only outward call; `handleSelectNode` is a pure `setSelectedSlug`;
  `triggerNodeChanges` is inert without `onNodesChange`; `deleteKeyCode={null}`,
  `nodesDraggable={false}`, `nodesConnectable={false}`, `edgesReconnectable={false}`,
  `connectOnClick={false}`, `edgesFocusable={false}` and `showInteractive={false}` are
  all still present.
- **No id-collision over-reach.** I tried to construct an input where a non-phase node
  activates via the `.some(id && type === phase)` guard. `reservedId()`
  (`canvasModel.ts:169-173`) prepends `_` until the candidate is not in `slugSet`, so a
  reserved id can never equal a phase slug, and duplicate slugs (parent WR-03) yield two
  *phase*-typed nodes, which behave identically under both input devices. Not reachable.
- **No stale closure.** `activateFromKeyboard`'s deps (`projection.nodes`,
  `onSelectNode`) are complete; `projection` is the same memo the render reads, so the
  keyboard guard cannot see a different node set than the DOM.
- **No `preventDefault` over-reach.** It runs only after the phase-node guard, so
  Enter/Space on `<Controls>` buttons, on the pane, and on the ⌥ toggle keep their
  default behaviour.
- **No `dangerouslySetInnerHTML`, no interpolation of authored strings** into either new
  ARIA string; `renderPhaseMark` returns a build-time-bundled SVG component or a literal.
  T-183-01 holds.
- **No snapshot drift.** `groundingFor` is consumed only by `canvasModel.ts:196`, and no
  fixture declares `citation_policy: "partial"`, so the semantic change is contained.
- **Lint.** `npx eslint` on `PhaseNode.tsx`, `WorkflowCanvas.tsx` and
  `phaseVocabulary.ts` → 0 problems (WR-05 confirmed closed, and the two new
  constructs introduce none).

## Out of scope — untouched, still owned by the parent review

WR-02 (hardcoded `colorMode="dark"`), WR-03 (duplicate-slug node collapse), WR-04
(reserved-id / edge-id string collisions) and IN-01 … IN-07 were deliberately excluded by
plan 183-08 and are **not** re-reported here. They remain open in
`.planning/phases/183-read-only-canvas/183-REVIEW.md`, which stays the authoritative
ledger for this phase's deferred debt.

---

_Reviewed: 2026-07-26_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep · Scope: gap-closure-183-08_
