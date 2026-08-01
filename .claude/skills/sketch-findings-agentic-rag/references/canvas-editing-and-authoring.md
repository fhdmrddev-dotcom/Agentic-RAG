# Canvas Editing & the Authoring Session (Phase 184 / CANVAS-02, 03, 04, VALID-02, VALID-03)

How you add, move and delete a step; how server verdicts read while the flow is half-built; where
you configure a step; and whether it all composes into a session a person can sit inside.

Synthesized from sketches **138** (winner C-local), **139** (winner A), **140** (winner A),
**141** (winner B).

---

## Decision 1 — order is the SPINE; free wiring is a nudge only (138-C, "C-local")

**Winner: hybrid spine + free nudge, in its C-local form** (operator, 2026-07-26).

- **Order stays the spine and cannot be rewired.** The harness engine runs a linear sequence; a
  canvas that let you draw arbitrary edges would be promising something the runtime cannot honour.
- **The nudge is a per-user BROWSER preference — browser-persisted, ZERO migration.** Moving a node
  cosmetically must never mint a schema change or a definition write.

This is the shape that lets the canvas feel like a canvas without becoming a second execution model
(red line D-14: no second runtime).

---

## Decision 2 — validation = mark on the node + a problems tray (139-A)

The question was how server verdicts read **while the flow is half-built**, so that "you cannot draw
an invalid workflow" holds without punishing someone for not being finished.

- **Severity split is load-bearing: INCOMPLETE ≠ ERROR.** A step you have not filled in yet is not a
  mistake. Only genuine errors get the error treatment.
- The verdict renders as a **mark on the node** (transient, card's left edge) plus a **problems
  tray** listing them — so a problem is both locatable and enumerable.
- **Prevent at source** where possible rather than reporting after the fact.
- `grounding-unavailable` is its own honest state, not an error.

**Fail-open is the trap here.** A sibling defect found in Phase 186: `PublishGauntlet` painted an
unknown `blocked_stage` as 8/8 GREEN because `findIndex` returned `-1`. Any verdict surface must
treat "I don't recognise this" as *not passing*, never as passing.

---

## Decision 3 — the step inspector EXTENDS the shipped 400px panel (140-A)

**Winner: extend the shipped `PhaseFormPanel`**, do not build a new surface.

- Governance appears as **rails you can see but cannot wire around** — the tool whitelist, the
  grounding bundle, locked gates.
- **The panel is where you SET; the canvas is where you SEE.** This is the rule that keeps the card
  free of controls (one tab stop per node) and puts both governance dials together in one place.
- Phase 185 later added its grounding dial and armed-checkpoint switch here, in their own
  `GovernanceSection.tsx` file — **not** by growing the panel's render body. That is the pattern to
  repeat: *the next surface that needs the panel gets its own component and one gated line.*

---

## Decision 4 — chrome lives on a canvas toolbar + page header (141-B)

The composition test: does empty draft → first step → a mistake → undo → autosave → publish compose
into a session a person can sit inside?

- **Canvas toolbar + page header** carry the chrome (undo/redo, view controls, the ⌥ Technical-names
  toggle, the publish handoff).
- **Undo/redo** via `zundo`, gated on the canvas being the active view.
- **Autosave honesty: "saved" ≠ "published".** The distinction must be visible — a saved draft is
  not a live workflow. Autosave writes **in place** and must never mint a version or re-arm the
  publish gauntlet (the version-explosion trap, CONCUR-01).
- The **publish handoff** leaves the Builder; per the three-homes contract (#19) a draft cannot be
  run directly — the publish gauntlet's golden-run *is* the trial run.

---

## CSS / HTML Patterns

```css
/* editing affordances are deliberately QUIETER than the node itself */
.acts        { opacity: 0; transition: opacity .15s ease; }
.node:hover .acts, .node.sel .acts, .acts:focus-within { opacity: 1; }

/* ✕ and ＋ live on the LANE, never inside the card — one tab stop per node */
/*   ＋ sits in the gap between cards;  ✕ straddles the card's bottom edge     */

/* validation states — severity split, never one "invalid" look */
.node.v-error      { border-color: hsl(0 72% 55% / .55) !important; }
.node.v-incomplete { border-style: dashed; }          /* not-finished ≠ wrong */

/* selection */
.node.sel { border-color: hsl(239 100% 82% / .55);
            box-shadow: 0 0 44px -8px hsl(239 100% 82% / .4); }
.node:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 3px; }
```

---

## Hard-won implementation notes

- **`@xyflow/react` controlled-nodes blink.** Rebuilding node objects drops `measured`, producing a
  hidden frame and a visible blink. **Echo `dimensions` back.**
- **The ESM cycle is real.** `WorkflowCanvas` imports `FlowEdge`'s *value* at module scope for the
  `edgeTypes` map, so anything extracted out of `WorkflowCanvas` must not import back into it.
- **`WorkflowCanvas.tsx` is a G-5 hot file** (1574 lines, 9 plans across 3 phases). Extraction is
  due; `185-10` named the seam — lift `PlaneEditingLayer` + the exported `EDIT_AFFORDANCE` table out.

---

## What to Avoid

- **Never let cosmetic movement write to the definition** or mint a version.
- **Never allow order rewiring.** The spine is the contract with the engine.
- **Never collapse INCOMPLETE into ERROR.** Half-built is not wrong.
- **Never let a verdict surface fail open** — an unrecognised state is not a pass.
- **Never grow `PhaseFormPanel`'s render body** for a new feature; give it its own component and one
  gated line.
- **Never build a new inspector surface** when the shipped 400px panel can be extended.
- **Never present "saved" as "published."**

---

## Origin

Synthesized from sketches: **138** (winner C-local — spine + browser-persisted nudge, zero
migration), **139** (winner A — node mark + problems tray), **140** (winner A — extend the shipped
`PhaseFormPanel`), **141** (winner B — canvas toolbar + page header). Operator 2026-07-26.
Source files: `sources/138-growing-the-flow/`, `sources/139-validation-while-building/`,
`sources/140-step-inspector-and-rails/`, `sources/141-the-authoring-session/`
