# Builder header consolidation — plan (Option A)

**Raised by:** operator, during Phase 184 live UAT — *"the canvas space is very narrow because
the header above is taking too much space… especially with the smaller screens."*
**Decision:** Option A — merge the three shared bands into one row.
**Status:** PLANNED, not executed. Awaiting go-ahead.

---

## The measurement

Taken live on the operator's window (639 px tall), canvas flag ON, a draft open on Canvas:

| Band | Owner | Height | Renders when flag is OFF? |
|---|---|---|---|
| `← Workflows` · `Edit · <title>` · `NET-NEW` | `WorkflowsPage` | 46 px | **Yes** |
| `‹ both doors` · `Author & govern` · `JUDGE ALWAYS-ON` | `WorkflowDoorSwitch` (`door-govern`) | 46 px | **Yes** |
| `<slug>` · `draft` · `Save draft` · `◆ Publish…` | `WorkflowBuilderPage` (`builder-save-state`) | 54 px | **Yes** |
| `≣ Spine` · `○ Canvas` | `WorkflowBuilderPage` | 48 px | No — flag-gated |
| `✎ Editing` + gesture hint | `WorkflowCanvas` | 42 px | No — canvas only |
| `Removed X · N steps renumbered` | `WorkflowCanvas` | 39 px | No — **already reclaimed** |

**275 px of chrome above a 288 px canvas — the flow got 45 % of the screen.**
Floating the transient notice (commit `154f2a3a`) already took the canvas to **326 px**.
The remaining prize is the **146 px** in the top three bands.

---

## The conflict this plan exists to resolve

All three target bands render **regardless of the canvas flag**. D-181-01 requires the
flag-off surface to be byte-identical for everyone, operators included. So a naive merge
changes the surface we promised not to touch.

Worse — and this is the part worth knowing — **that promise is currently untested for the
Builder header.** `revertByteIdentical.test.tsx` pins `NAV_ITEMS` and the Control-Room
radio only. `WorkflowBuilderPage.canvas.test.tsx` pins flag-off behaviours (no editing
affordance, `rails` absent, panel dismissal, empty-draft trigger) but **nothing pins the
header's structure or height.** A regression here would ship green.

### Resolution — gate the merged header on the canvas flag

Flag **off** ⇒ today's three bands, byte-identical **by construction**, not by a test that
does not exist. Flag **on** ⇒ the merged single row.

This follows the pattern already established for the Spine/Canvas toggle (D-183-03: the
affordance VANISHES when the flag is off). It costs one branch and buys back the guarantee.

**Accepted consequence:** with the flag on, the merged header also appears in the Spine
view. That is permitted — D-181-01 constrains flag-OFF only — but it must be a stated
decision, not a side effect noticed later.

---

## What ships

**One row, three groups, left → right:**

`← Workflows` │ `Edit · <title>` `<slug>` `draft` `NET-NEW` │ *(spacer)* │ `‹ both doors` `JUDGE ALWAYS-ON` `Save draft` `◆ Publish…`

- Nothing is removed. Every control, badge and label survives — this is a re-flow, not a cull.
- Target height **~56 px**, replacing 146 px. **Reclaims ~90 px → canvas ~415 px (+44 %).**
- Below 900 px viewport width the row wraps to two, which is still 56 px better than three.

**Files:**

| File | Change |
|---|---|
| `frontend/src/pages/WorkflowBuilderPage.tsx` | New `BuilderHeaderBar`, flag-gated; existing three-band path kept for flag-off |
| `frontend/src/components/workflows/WorkflowDoorSwitch.tsx` | Accept an optional `inline` prop so its control can be hosted in the merged row |
| `frontend/src/pages/WorkflowsPage.tsx` | Breadcrumb rendered into the merged row when the flag is on |

No backend, no migration, no new dependency.

---

## Tests

The point of these is that the guarantee stops being untested.

1. **NEW — flag-off header structure pin.** With the flag off, assert the Builder renders
   the three separate bands with today's testids in today's order. *Falsify by* rendering the
   merged row on the flag-off path — the test must red.
2. **NEW — flag-on merged row.** Exactly one header band; every control from all three
   bands present and reachable by accessible name.
3. **NEW — height budget.** Flag-on header measures materially less than flag-off. Guards
   against the merge silently re-growing.
4. **Existing suites unchanged.** `revertByteIdentical.test.tsx` (7) and
   `WorkflowBuilderPage.canvas.test.tsx` (22) must pass **with zero assertion edits** — if
   one has to change, the gate on flag-off was not preserved.

**Gates:** count gate 0 failing, no per-file decrease · `tsc` ≤ 33 · `npx vite build` exit 0
· canvas snapshot byte-unchanged.

---

## Risk

| Risk | Mitigation |
|---|---|
| Flag-off surface drifts silently | Flag gate + test 1, which is the first thing to ever pin it |
| Three components must cooperate | Merged row owns layout; each keeps its own controls — no logic moves |
| Two header paths to maintain | Real cost, accepted. Retire the old path when the canvas flag is retired |
| Narrow screens get worse, not better | Test 3 plus an operator look at ~900 px — the width that prompted this |

**Not doing:** Option C's full-height build mode. If A still feels cramped in real use, C
builds cleanly on top of it.

---

## Where this belongs

This is **not** one of Phase 184's twelve locked SPEC requirements — it is new scope from
UAT. Recommend `/gsd:phase --insert 184.1`. Guardrail G-1 permits it: no prior `184.x`
exists. Folding it into 184 would edit a locked SPEC after the fact.

**Estimate:** one plan, three tasks, ~1 session.
