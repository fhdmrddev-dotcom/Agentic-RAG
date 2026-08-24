---
id: BUG-260808-01
title: A phase slugged with an Object.prototype member name gets NO node transform and renders stacked on phase 1 — a seventh, unguarded WR-04 sink in the node-position lookup
reported: 2026-08-08
surface: Agentic-RAG
severity: minor
status: folded
affected_areas: [frontend/workflow-canvas, frontend/canvas-model, security/WR-04]
folded_into: 200
verified_closed_by: null
related_seeds: []
re_open_trigger: >
  Folded at /gsd:discuss-phase 200 (2026-08-19), together with BUG-260807-01 (same shape, both tagged security/WR-04). Correctness under the canvas plan 200-05 rebuilds. WARNING: this is NOT a checklist row under D-01 -- it widens 200-05 beyond the element inventory deliberately.
reproduces_on:
  branch: develop
  commit: HEAD at the 189-16 owed-rows UAT session (post 690ead48)
  date: 2026-08-08
---

# BUG-260808-01: the node-position lookup is a seventh unguarded WR-04 sink

> Found by DRIVING, while running the row `BUG-260807-01` was deliberately left open for. That
> report's closing condition said a green unit suite may not close it, because *"only the driven row
> can confirm no other path produces the same rendered symptom."* **This is that other path.**
> Every number below was executed against the live app, with a control observed swinging both ways.

## What we observed

A workflow whose middle phase is slugged `constructor` renders that node with **no transform at
all**, so it paints at the canvas origin, stacked on top of phase 1.

Read off the live DOM, three nodes, same canvas:

| Node slug | `node.style.transform` | computed |
|---|---|---|
| `retrieve` | `translate(0px, 0px)` | `matrix(1, 0, 0, 1, 0, 0)` |
| **`constructor`** | **`(empty)`** | **`none`** |
| `emit` | `translate(640px, 0px)` | `matrix(1, 0, 0, 1, 640, 0)` |

Bounding rects confirm the collision — `retrieve` at `58,176 260x115` and `constructor` at
`58,176 260x148`: **identical x/y**. The lane-1 slot (`translate(320px, 0px)`) is simply never
written.

## The control, observed swinging BOTH ways

The same fixture, same canvas, only the slug changed:

| slug | inline transform | verdict |
|---|---|---|
| `constructor` | `(empty)` | ⛔ stacked at origin |
| `ordinaryslug` | `translate(320px, 0px)` | ✅ correct lane |

So this is slug-specific, not a layout or fixture artifact.

## Why it matters, and how it differs from `BUG-260807-01`

`BUG-260807-01` was the SAME rendered symptom (a dropped transform) reached through a DIFFERENT
mechanism: `verticalOffsetFor` returned **`NaN`**, and a `NaN` term invalidates the whole
`translate()` declaration. That sink was guarded with `own()` and the guard **holds** — this session
measured `transformHasNaN: false` on every affordance and every node, including the `constructor`
one. Nothing regressed.

Here the transform is not *invalid*, it is **absent**: the position lookup keyed by phase slug
resolves the inherited `Object.prototype.constructor` (a function, never nullish, so every
`!== undefined` / `?? fallback` guard passes) instead of an `{x, y}`, and the writer then produces
nothing. Same class (WR-04 prototype pollution), same visible outcome, different sink.

Blast radius is a mispositioned, overlapping card on the canvas — no privilege escalation, nothing
leaks. It needs an author to name a phase such that its slug is one of a small set of
`Object.prototype` member names, which is unlikely by accident and trivial on purpose. Hence
**minor**, stated the same way `BUG-260807-01` stated it.

⚠ **The slug is still unconstrained end to end** — `backend/app/models/harness.py:202` declares a
bare `slug: str` with no pattern, no enum and no reserved-word list, and
`supabase/migrations/058_workflow_phases.sql:18` is `text NOT NULL`. That is the root enabler for
this whole class, and guarding sinks one at a time has now cost three reports
(`BUG-260806-01`, `BUG-260807-01`, this one).

## Hypothesized cause

*(Finding for the symptom, hypothesis for the exact line.)* The symptom is measured. The precise
sink was not isolated in this session — the candidates are the slug-keyed position/overlay maps
consumed when building React Flow nodes (`canvasModel.ts`'s node builder and the nudge/overlay
lookups in `editAffordance.ts`, of which `verticalOffsetFor` was only the one already guarded).
Whoever fixes this should locate the exact read rather than trust this paragraph.

## Fix sketch

- Route the position/overlay lookup through `own()` from the zero-import leaf
  `frontend/src/components/workflows/ownProperty.ts`, exactly as `verticalOffsetFor` now does.
- ⚠ **Then stop fixing these one at a time.** Three reports in three days is the signal. Either
  constrain the slug at the boundary (a pattern on `slug: str` in `harness.py` plus a CHECK, rejecting
  `Object.prototype` member names), or switch these maps to `Map`/`Object.create(null)` so the whole
  class cannot recur. `188.2-DEFERRED.md` D-188.2-DEF-02 already defers consolidating four inline
  `hasOwnProperty` guards; that consolidation and this fix want the same owner.
- A property-style test — *"every slug-keyed lookup is total over `Object.prototype` member names"* —
  would catch the next sink without anyone having to think of it.

⚠ **jsdom cannot see this.** It applies no CSS and computes no layout, so a node with no transform
looks identical to a correctly-placed one in a unit test. The regression check is a driven read of
`node.style.transform` with the slug control swung both ways, exactly as above.

## Reproducing it

The UI cannot author this slug — `D-184-11` is explicit that there is no slug field, and the caller
derives the slug from the phase type. So seed a fixture directly (all `workflow_definitions` rows in
this project are test data, free to create and delete):

```python
# copy any 3-phase draft, rename the middle phase's slug, insert, open the Canvas tab
d['phases'][1]['slug'] = 'constructor'
```

Then read `document.querySelector('.react-flow__node[data-id="constructor"]').style.transform`.

## Surface classification

`Agentic-RAG` — this app's own frontend. Routes at the four GSD touchpoints.

## Suggested routing

- **Fold into in-flight phase:** no — Phase 189 is at its close gate and this is not a 189 regression
  (it predates the phase; 189 neither introduced nor touched the position lookup).
- **Defer to future phase / milestone:** yes — pair it with the WR-04 consolidation
  (`D-188.2-DEF-02`) and with constraining the slug at the boundary, so the class is closed once.
- **Plant as seed:** the *class* deserves one if the boundary fix is not taken.
- **External — note only:** no

## CODE FIX LANDED 2026-08-08 (`/gsd:fast`) — the sink is ISOLATED and guarded; `status` stays `open`

**The report told whoever fixed this to locate the exact read rather than trust its hypothesis
paragraph. That was done, and the paragraph was half right.** The sink is NOT in `canvasModel.ts` —
that module keys everything through `Map`, so it was never exposed. It is in `WorkflowCanvas.tsx`,
in the two-memo split, at **three** bare-index sites:

| Site | Lookup | Effect for a slug named `constructor` |
|---|---|---|
| `WorkflowCanvas.tsx:674` (overlay memo) | `dragOverlay[node.id]` | **THE MEASURED ONE.** Resolves the inherited function; `!== undefined` passes; the node's `position` BECOMES that function, with no `.x`/`.y` → the library writes no transform at all |
| `:639` (settled memo) | `nudges?.[node.id] ?? 0` | the function is not nullish, so `?? 0` passes it through and it is ADDED to `position.y` |
| `:866` (`onNodeDragStop`) | `nudges?.[node.id] ?? 0` | same, on the commit path |

`:674` is the one that reproduces the exact reported symptom, and it fires on **every render** —
`dragOverlay` is `useState({})`, so nothing needs to be dragged for the sink to be live.

**What shipped:** all three route through `own()` from the zero-import leaf `ownProperty.ts`.

**Driven RED before green, and the RED reproduced this report's own measurement.** Two rows in
`WorkflowCanvas.editing.test.tsx` were run against the pre-fix body with the source stashed:

```
AssertionError: slug "constructor" got position function Object() { [native code] }:
                expected 'function' to be 'object'
AssertionError: slug "constructor" y=undefined: expected false to be true
```

⚠ **This report claimed jsdom cannot see this. That is HALF WRONG and the correction matters** — it
is true of the *computed style* and false of the *cause*. The `nodes` array is a captured prop, so
the position the library is handed is directly assertable, and the guard sits there. Both rows carry
positive controls (an ordinary slug still lands on the lane-1 pitch; an OWN nudge is still applied),
so a rewrite that positions nothing cannot pass. Count-gate pin extended 63 → 65.

One source fence was re-spelled, not weakened: `WorkflowCanvas.test.tsx:968`'s positive control
anchored on the literal `dragOverlay[node.id]` and now anchors on `own(dragOverlay, node.id)`.
Both canvas suites green at 118/118.

**THE ONE THING OWED — the driven row**, and `status` stays `open` for it deliberately. This report's
own regression check is *"a driven read of `node.style.transform` with the slug control swung both
ways."* The unit guard closes the CAUSE; only the driven row confirms the rendered symptom is gone,
and relaxing that condition on the strength of the evidence it names as insufficient is exactly what
`BUG-260807-01` was held open to avoid. Requires a seeded `workflow_definitions` fixture (the UI
cannot author this slug — `D-184-11`).

**Flip BOTH this and `BUG-260807-01` to `closed` when that row passes.** Cheapest moment: any live
canvas session — the fixture is 3 lines of Python and free to delete.

⚠ **The CLASS is still open, and the fix count is now seven.** Both this report and `BUG-260807-01`
say stop guarding sinks one at a time. This run did not take the class fix, because constraining
`slug` at the boundary touches `harness.py` + a CHECK constraint (schema + API surface — outside
`/gsd:fast` under G-3). It remains the right fix, and this report's own routing said *"plant as seed
if the boundary fix is not taken"* — so it is planted: **`SEED-143`**.

## Reference / evidence links

- `frontend/src/components/workflows/canvasModel.ts` — the node builder (slug-keyed)
- `frontend/src/components/workflows/editAffordance.ts` — sibling slug-keyed lookups; `verticalOffsetFor` is the already-guarded one
- `frontend/src/components/workflows/ownProperty.ts` — the WR-04 guard this should use
- `backend/app/models/harness.py:202` — `slug: str`, unconstrained
- `BUG-260807-01` — same rendered symptom, different sink (NaN); its guard is intact and was re-measured this session
- `BUG-260806-01` — the occlusion fix whose `zIndex: AFFORDANCE_Z` raises the cost of any mispositioned canvas element
