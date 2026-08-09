---
phase: 183-read-only-canvas
scope: gap-closure-183-09
reviewed: 2026-07-26T16:05:00Z
depth: standard
diff_range: 3dc0671e^..HEAD (3dc0671e, 4e997f03, 45633371)
files_reviewed: 7
files_reviewed_list:
  - frontend/src/components/workflows/PhaseFormPanel.tsx
  - frontend/src/components/workflows/PhaseFormPanel.test.tsx
  - frontend/src/components/workflows/WorkflowCanvas.tsx
  - frontend/src/components/workflows/WorkflowCanvas.test.tsx
  - frontend/src/components/workflows/canvasModel.ts
  - frontend/src/pages/WorkflowBuilderPage.tsx
  - frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx
findings:
  critical: 0
  warning: 6
  info: 5
  total: 11
status: issues_found
---

# Phase 183 Plan 09 (Gap Closure): Code Review Report

**Reviewed:** 2026-07-26
**Depth:** standard (plus targeted cross-file tracing into `@xyflow/react@12.11.2`
internals and two executed runtime probes)
**Diff range:** `3dc0671e^..HEAD`
**Files Reviewed:** 7
**Status:** issues_found

> **This file supersedes nothing.** `183-REVIEW.md` (WR-01…WR-06, IN-01…IN-07) and
> `183-REVIEW-08.md` (WR-08-01…WR-08-04, IN-08-01…IN-08-04) remain the authoritative
> ledgers for their own scopes. This report covers ONLY the plan `183-09` diff and its
> IDs are namespaced `WR-09-*` / `IN-09-*`.

## Summary

The three gap-closure defects are genuinely closed, and I verified each against source
and against the installed library rather than against the SUMMARY:

- **GAP-1 (✕ / Escape / pane click).** `onClose` is a REQUIRED prop
  (`PhaseFormPanel.tsx:73`), the header renders exactly one announced control
  (`:460-468`), the page owns `clearSelection` (`WorkflowBuilderPage.tsx:213-215`) and
  wires it to both the panel (`:648`) and the canvas (`:509`). All three paths reach
  `setSelectedSlug(null)` and nothing else.
- **GAP-2 (`event.repeat`).** `WorkflowCanvas.tsx:234` matches the WR-08-01
  prescription; the new test at `WorkflowCanvas.test.tsx:205-221` sets `repeat: true`
  explicitly, so it is a real gate, not a synthetic tautology.
- **GAP-3 (`domAttributes`).** I confirmed in `@xyflow/react/dist/esm/index.js:2349`
  that `...node.domAttributes` is spread **after** the library's own
  `"aria-describedby"`, so `{ "aria-describedby": undefined }` genuinely removes the
  attribute. The WR-08-04 test carries a positive control on a real phase node, so it
  cannot go vacuously green.

**Things I checked and did NOT find a defect in** (recorded so a later reader does not
re-litigate them):

- *Pane click cannot be triggered by a node click.* The pane's handler is
  `wrapHandler(onClick, container)` (`index.js:1408-1415, :1630`), which bails unless
  `event.target === pane`. Nodes live inside the pane but are never the pane.
- *Pane click cannot be triggered by panning.* d3-zoom suppresses the trailing click
  once movement exceeds `paneClickDistance`.
- *Pane click actually works in a real browser.* `.react-flow__viewport` is
  `pointer-events: none` (`base.css:86-89`) and `.react-flow__background` is
  `pointer-events: none; z-index: -1` (`:61-64`), so empty-space clicks reach the pane.
  `<Controls>` renders as a SIBLING of the pane (`index.js:3736`), so its buttons cannot
  clear the selection.
- *The read-only invariant survives the new pane-click path.* `onPaneClick` also runs the
  library's `resetSelectedElements()`; `triggerNodeChanges` (`index.js:3511-3523`) is a
  verified no-op with controlled nodes and no `onNodesChange`. No write, no fetch, no
  node mutation, no drag re-enable.
- *Escape listener lifecycle.* Add/remove are symmetric, the effect is gated on
  `panelOpen`, and the handler closes over only the stable `clearSelection` — no stale
  slug capture is possible.
- *`canvasModel.toCanvas` purity.* The added `domAttributes` value is a static literal:
  no DOM read, no clock, no randomness, no input mutation. Snapshots were regenerated
  consistently (`+45` lines, one block per fixture, end-cap and stub only).
- *Toolchain.* `npx tsc -b` reports **zero** errors in any of the four changed source
  files (the repo's other pre-existing errors are untouched rot). `npx eslint` on the
  four files: **0 problems**. The three suites run **72/72 green**.

What the diff does have is a cluster of **honesty defects around the two new dismissal
paths**: the ✕ and Escape behave *differently* with respect to persistence, and the
test that claims to pin "a dismissal writes nothing" is asserted on the one path that
demonstrably writes, while the two paths that genuinely never write carry no such
assertion at all. Plus a lost-focus a11y regression on the very control added for
keyboard users, a `preventDefault` that the new repeat guard skips past, and a
three-child `justify-between` header.

---

## Narrative Findings (AI reviewer)

## Warnings

### WR-09-01: Escape and pane-click dismissal silently drop the focused field's autosave — the ✕ persists it, Escape does not

**File:** `frontend/src/pages/WorkflowBuilderPage.tsx:217-231` (the Escape effect) and
`:326` in `WorkflowCanvas.tsx` (the pane click), with
`frontend/src/components/workflows/PhaseFormPanel.tsx:183,193` (`onBlur={props.onPersist}`)

**Issue:**
The panel's ONLY implicit save trigger is a field `onBlur → onPersist`. Clicking the ✕
blurs the focused field first (mousedown moves focus), so the pending edit is PATCHed.
Pressing Escape — or clicking the canvas pane — unmounts the focused input instead, and
browsers do **not** fire `blur`/`focusout` when a focused element is removed, so
`onPersist` never runs.

I proved the asymmetry with a throwaway probe against the real page (temp suite, since
deleted), driving an identical edit through both exits:

```
ESCAPE       -> updateWorkflowDraft calls: 0
CLOSE-BUTTON -> updateWorkflowDraft calls: 1
```

So the fix ships two dismissal affordances that look interchangeable to a user and are
not: one saves the sentence you just typed, the other does not. The docblock at
`:217-223` explicitly rests its "harmless" argument on the claim *"persistence happens
on field blur, not on selection"* — that is exactly the mechanism Escape defeats.

**Not Critical** because `onPersist` PATCHes the WHOLE working definition
(`:353-372`), so any *later* blur or an explicit **Save draft** re-sends the dropped
edit. The loss window is: edit → Escape → leave the Builder with no further save. Real,
narrow, and silent — there is no dirty indicator to warn the user.

**Fix** — make the dismissal path converge on the same behavior the ✕ already has, by
blurring whatever is focused inside the panel before releasing the selection:

```ts
const clearSelection = useCallback(() => {
  // Match the ✕ path: a focused panel field must get its blur (→ onPersist) before
  // the input is unmounted, or the in-flight edit is dropped on the floor.
  const active = document.activeElement
  if (active instanceof HTMLElement && active.closest("aside[aria-label^='Refine step']")) {
    active.blur()
  }
  setSelectedSlug(null)
}, [])
```

and pin it with the probe above as a permanent test (Escape with a focused, edited
field must produce the same `updateWorkflowDraft` call count as the ✕).

---

### WR-09-02: the T-183-12 "a dismissal writes nothing" guard is asserted on the one path that DOES write, and omitted on the two that do not

**File:** `frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx:341-344, 356-358`
(assertions present) vs `:361-375` and `:377-387` (assertions absent)

**Issue:**
Both ✕ tests end with:

```ts
// T-183-12 — a dismissal must not mint a draft row or PATCH a version.
expect(mockCreate).toHaveBeenCalledTimes(0)
expect(mockUpdate).toHaveBeenCalledTimes(0)
```

That claim is **false as stated**, and the probe in WR-09-01 shows it: click the ✕ with
a panel field focused and `updateWorkflowDraft` fires once. On a FRESH build
(`draftIdRef.current === null`, `WorkflowBuilderPage.tsx:356-367`) the same blur mints a
`workflow_definitions` row via `createWorkflowDraft`. The assertion only passes because
neither test ever focuses a field — it is green by construction, i.e. the exact
"a gate that lies" failure mode this phase has now named in three separate plans.

Meanwhile the Escape tests (`:361-375`) and the pane-click test (`:377-387`) — the two
paths that provably never write — carry **no** write assertion at all. The guard is
attached to the wrong half of the contract.

**Fix:** move and re-word the assertion so it pins what is actually true, and add the
focused-field case as its own row rather than leaving it uncovered:

```ts
// Escape / pane click: the release path itself must reach setSelectedSlug and nothing else.
fireEvent.keyDown(window, { key: "Escape" })
await expectDismissed()
expect(mockCreate).toHaveBeenCalledTimes(0)
expect(mockUpdate).toHaveBeenCalledTimes(0)

// …and on the ✕, state the truth: dismissal itself writes nothing, but the blur it
// causes is the shipped autosave. Assert the blur-driven save explicitly (WR-09-01).
```

---

### WR-09-03: dismissing the panel drops keyboard focus to `<body>` — no focus restoration on the control added FOR keyboard users

**File:** `frontend/src/components/workflows/PhaseFormPanel.tsx:460-468` (the ✕) and
`frontend/src/pages/WorkflowBuilderPage.tsx:213-215` (`clearSelection`)

**Issue:**
Activating the ✕ unmounts the button that owns focus; releasing the selection unmounts
the whole form. Measured with the same probe:

```
CLOSE-BUTTON -> activeElement after dismiss: BODY (BODY)
```

A keyboard user who tabbed to the ✕ and pressed Enter is returned to the top of the
document and must re-traverse the page to get back to the step they were on. The
pre-existing (undiscoverable) exit — re-activating the same node — *preserved* focus on
that node, so this is a focus regression introduced alongside the fix. It lands on
precisely the population CR-01 (`183-REVIEW.md`) and WR-08-01 were filed to serve, and
no test in either new suite asserts anything about `document.activeElement`.

Impact is bounded (nothing is destroyed and the surface stays operable), which is why
this is a Warning rather than a Blocker.

**Fix:** hand focus back to the node the panel was anchored on. The page already knows
the slug at dismissal time, and both views expose a stable per-node hook
(`spine-node-<slug>` / `.react-flow__node[data-id="<slug>"]`):

```ts
const clearSelection = useCallback(() => {
  const slug = selectedSlugRef.current           // a ref mirror, so the callback stays stable
  setSelectedSlug(null)
  queueMicrotask(() => {
    const node =
      document.querySelector<HTMLElement>(`[data-testid="spine-node-${slug}"]`) ??
      document.querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(slug ?? "")}"]`)
    node?.focus()
  })
}, [])
```

plus one assertion per view: after dismissal, `document.activeElement` is the node, not
`document.body`.

---

### WR-09-04: the `event.repeat` guard returns before `event.preventDefault()`, so every auto-repeat of a held Space keeps the default action the line below says must be suppressed

**File:** `frontend/src/components/workflows/WorkflowCanvas.tsx:227-247`

**Issue:**

```ts
if (event.key !== "Enter" && event.key !== " ") return
if (event.repeat) return                       // ← bails out here
...
event.preventDefault()                         // "Space would otherwise scroll the pane
onSelectNode(id)                               //  (the library also reserves it as the
                                               //  pan activation key)"
```

The first keydown of a held Space is `preventDefault`ed; keydowns 2…N of the same press
are not. So the surface's stated reason for calling `preventDefault` — Space's default
action on a focusable div — is honoured for exactly one event per press and abandoned
for the rest of the hold. The repeat guard fixed the toggle-parity defect and quietly
opened a second, smaller inconsistency in the same handler.

Practical impact today is low (the Builder's grid ancestors are `overflow-hidden`, so
there is usually nothing to scroll), which is why this is a Warning. But the invariant
the comment asserts is no longer true, and a future layout that introduces a scroll
container would surface it as "holding Space on a node scrolls the page".

**Fix** — decide node-ness first, suppress the default for the whole press, then bail on
repeat:

```ts
if (event.key !== "Enter" && event.key !== " ") return

const wrapper = (event.target as HTMLElement).closest<HTMLElement>(".react-flow__node")
const id = wrapper?.dataset.id
if (!id) return
const isPhase = projection.nodes.some(
  (node) => node.id === id && node.type === CANVAS_NODE_TYPES.phase,
)
if (!isPhase) return

// Suppress the default for EVERY event of the press, repeats included…
event.preventDefault()
// …but activate the toggle only once per press.
if (event.repeat) return

onSelectNode(id)
```

---

### WR-09-05: the panel header now spreads THREE children under `justify-between` — the phase-type chip detaches from the right edge and floats mid-header

**File:** `frontend/src/components/workflows/PhaseFormPanel.tsx:447-469`

**Issue:**
The header is `flex items-center justify-between`. It previously held two children —
the step name (left) and the phase-type chip (right). The ✕ was appended as a third
flex child, and neither of the first two carries `flex-1`:

```tsx
<header className="flex items-center justify-between …">
  <span className="min-w-0 truncate …">{name}</span>   {/* content-sized */}
  <span className="ml-2 shrink-0 …">{friendlyType}</span>
  <button className="ml-1.5 … shrink-0" …>✕</button>
</header>
```

`justify-between` distributes ALL free space *between* items, so with a short step name
the "Server step" / "Deliverable" chip is pushed to roughly the centre of the 400px
header with visible gaps on both sides, instead of sitting flush with the ✕. That is a
visual change nobody asked for, on a surface this project holds to sketch-approved
layout standards, and it is invisible to the suite (the only layout assertion is
"no `absolute`/`fixed` class", `PhaseFormPanel.test.tsx:309-323`).

**Fix** — group the trailing controls so the header stays a two-part layout:

```tsx
<header className="flex items-center gap-2 border-b border-border px-3 py-2">
  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-foreground">
    {phase.name?.trim() || phase.slug}
  </span>
  <span title={pt} className="shrink-0 rounded bg-muted px-1.5 py-0.5 …">{friendlyType}</span>
  <button type="button" data-testid="phase-form-close" …>…</button>
</header>
```

---

### WR-09-06: `onClose` is required, but the panel can still render a 400px-wide column with NO close control — the "unclosable panel is not representable" claim is narrower than advertised

**File:** `frontend/src/components/workflows/PhaseFormPanel.tsx:38-42, 416-428` with
`frontend/src/pages/WorkflowBuilderPage.tsx:188, 236-239, 637`

**Issue:**
The grid track width is driven by `panelOpen = selectedSlug !== null` (`:188`, `:637`),
but the panel's *content* branch is driven by `!open || !phase` (`:416`), where `phase`
comes from `definition.phases.find(p => p.slug === selectedSlug) ?? null` (`:236-239`).
Those two inputs can disagree. When they do — a `selectedSlug` that no longer resolves to
a phase — the column is 400px wide and renders the RESTING RAIL, which by design (and by
the new test at `PhaseFormPanel.test.tsx:384-392`) contains **no** close control. The only
exits from that state are the undiscoverable Escape and, in the canvas view only, a pane
click — i.e. exactly the GAP-1 condition this plan exists to eliminate.

The docblock claims making `onClose` required means *"a panel the user cannot close is
not a representable state"* (`:38-42`). It is still representable; the type system pins
the *wiring*, not the *state*.

I could not construct a reachable path to it today (slugs are never rewritten by
`onPhaseChange`, and `onDraft` resets `selectedSlug`), so this is latent rather than
live — hence Warning, not Blocker. But it is one future feature away: any authoring
action that removes or renames a phase (Phase 184/185 territory) creates it.

**Fix** — derive the open state from the RESOLVED phase, so the two can never disagree:

```ts
const panelOpen = selectedPhase !== null
```

(with `selectedPhase` hoisted above its current position), or self-heal in the memo:

```ts
useEffect(() => {
  if (selectedSlug !== null && selectedPhase === null) setSelectedSlug(null)
}, [selectedSlug, selectedPhase])
```

---

## Info

### IN-09-01: `canvasModel.ts` now encodes a library-internal spread-order dependency its own docblock says it does not carry

**File:** `frontend/src/components/workflows/canvasModel.ts:306, 335` (comment
duplicated verbatim at both sites), against the module docblock at `:23-30`

The fix is correct and was the prescribed one (`183-REVIEW-08.md` WR-08-04). But the
module docblock still says *"Arrow markers, edge styling and node chrome belong to the
view too — only TYPES are imported from the canvas library here, so the model stays
library-agnostic at runtime."* The projection now emits a value whose meaning depends
entirely on where `@xyflow/react` spreads `...node.domAttributes` relative to its own
`aria-describedby` (`index.js:2349`) — a runtime coupling to a library internal. It is
test-pinned (the WR-08-04 DOM test would fail on a library reorder), and the a11y story
now spans two files (`ARIA_LABELS` in the view, the per-node suppression in the model)
with no cross-reference in either direction. Worth one sentence in the docblock naming
the spread-order dependency and pointing at `WorkflowCanvas.tsx:118-121`.

Related hardening note: `domAttributes` is a raw DOM-attribute passthrough. It is safe
here (a static literal, no authored data), and it must stay that way — a future
`domAttributes: { title: phase.name }` would put an authored string into an attribute
path that bypasses the file's XSS note at `WorkflowCanvas.tsx:74-76`.

### IN-09-02: the Escape handler does not check `event.defaultPrevented`

**File:** `frontend/src/pages/WorkflowBuilderPage.tsx:226-228`

The docblock accepts the "modal above the Builder eats one Escape and the panel closes
too" interaction. A cheaper mitigation than the "fragile is-a-modal-open probe" it
rejects is one line — `if (event.defaultPrevented) return` — which honours any nested
layer that has already claimed the keystroke, without knowing anything about modals.
Also note the handler fires while the user is typing in a panel field (the standard
"Escape reverts this field" expectation instead closes the whole panel, and per WR-09-01
drops the edit's autosave).

### IN-09-03: GAP-1 deliberately alters the flag-OFF surface, and nothing pins that as intentional

**File:** `frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx:131-143`
(`expectFlagOffColumn`), with `src/components/admin/revertByteIdentical.test.tsx`

The ✕ and the Escape listener ship regardless of `visual_workflow_canvas` — correct, and
documented (the defect lives on the shipped Spine). I verified the flag-off gate itself
is untouched: `expectFlagOffColumn` still asserts no strip, no `.react-flow`, and the
grid's first child IS the spine `<section>`; `revertByteIdentical.test.tsx` only pins the
nav set, which is unaffected. So there is no regression — but the D-181-01 "`off` is
byte-identical" wording now has an undocumented exception living only in a plan file.
One sentence in the revert test's docblock (or the D-181-01 record) would keep the next
reader from filing it as a violation.

### IN-09-04: clicking an EDGE does not clear the selection, while clicking the pane does

**File:** `frontend/src/components/workflows/WorkflowCanvas.tsx:326`

`onPaneClick` requires `event.target === pane` (`index.js:1408-1415`). Edge interaction
paths re-enable pointer events inside the viewport, so a click that lands on or near an
edge is a no-op while a click 5px away releases the selection. Minor and arguably
correct (an edge is not empty space), but it makes the "click empty space to dismiss"
affordance feel intermittent near dense edge runs. No action required in 183.

### IN-09-05: no test asserts the Escape listener is absent while the panel is closed

**File:** `frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx:361-375`

The `panelOpen` gate at `WorkflowBuilderPage.tsx:225` is a real design decision ("no
listener exists while the panel is closed"), and it is the mechanism that keeps the page
from accumulating handlers. Nothing tests it: a regression that hoists the listener out
of the gate (or drops the cleanup) would stay green. A one-liner — Escape with no
selection leaves the rail rendered and calls nothing — plus an unmount assertion would
close it.

---

_Reviewed: 2026-07-26_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
