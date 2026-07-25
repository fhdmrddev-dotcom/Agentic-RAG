# Phase 183: Read-Only Canvas - Context

**Gathered:** 2026-07-25
**Status:** Ready for planning

<domain>
## Phase Boundary

A user can view an existing `WorkflowDefinition` as an `@xyflow/react` node canvas — a faithful
read-only projection: nodes = phases, edges = the `phase_index` sequence + parsed
`skip_to_phase` branches. Layout is computed deterministically at render and NEVER persisted
(Pitfall 3). Nodes are not draggable; node id == `phase.slug` (the identity Phase 188's run-viz
paints onto). CANVAS-01, SC# 4.

This phase proves the projection model cheaply. It does NOT edit, serialize back, persist layout,
validate live, grade governance, or show run state — those are Phases 184 / 185 / 188.

</domain>

<decisions>
## Implementation Decisions

### Entry door — where the canvas lives

- **D-183-01: The canvas is an in-Builder view toggle, not a new page.** A `[≣ Spine] [⬡ Canvas]`
  switch on `WorkflowBuilderPage`'s existing graph column, inside the same
  `gridTemplateColumns: minmax(0,1fr) <44px|400px>` push grid. **No new `ActiveView`, no new
  `NAV_ITEMS` entry, no router** (the app has none — navigation is a `useState<ActiveView>`
  switch). Phase 184 upgrades the SAME component in place from read-only to editable.
  - This **formally releases** Phase 181's deferred promise that "the NAV_ITEMS entry tagged
    `visual_workflow_canvas` lands WITH the view in 183." No nav entry is needed under this
    decision. `revertByteIdentical.test.tsx`'s scope-freeze assertion (no NAV_ITEMS entry tagged
    `visual_workflow_canvas`) therefore **continues to hold** — planner MUST NOT delete or weaken
    it, and MUST NOT add a nav entry to satisfy a stale reading of the 181 note.
  - D-181-08 froze `WorkflowBuilderPage.tsx` **for Phase 181 only**. 183 unfreezes it by design;
    that freeze does not carry forward.

- **D-183-02: Spine stays the default view.** The Builder opens exactly as it does today; Canvas
  is one click away. This is the cheapest D-14 story (flag-on vs flag-off are near-indistinguishable
  at rest) and it means the canvas cannot regress a mid-authoring session. Phase 184 may flip the
  default once the canvas is the better surface. **No persisted view preference** — the toggle is
  session state, cold-starts on Spine.

- **D-183-03: Flag OFF ⇒ the toggle VANISHES.** With `visual_workflow_canvas` off the
  `[≣ Spine] [⬡ Canvas]` strip does not render and the graph column is byte-identical to today's
  shipped Builder — for EVERYONE including operators (D-181-01). Matches the Phase 148 vanish
  convention (`visibleNavItems` drops governed entries rather than showing a locked placeholder)
  and the 181 Off|On revert semantics. The `@xyflow` subtree stays out of the render path entirely;
  a DOM-absence assertion (toggle absent + no `.react-flow` root) is the cheap D-14 proof.

- **D-183-04: The published-workflow canvas door is DEFERRED, not built.** 183 proves the
  projection on DRAFTS, where the Builder already opens edit-in-place with no side effect. Viewing
  a PUBLISHED workflow's canvas would require Tweak, which calls `createWorkflowDraft` (an INSERT —
  looking would mint a v(N+1) draft row); that is an accepted gap. The library card's existing
  glyph-dot `PhaseSpine` remains the at-a-glance read for published workflows. See `<deferred>`.

### Node model — click behaviour and depth

- **D-183-05: Clicking a node fires the EXISTING `onSelectNode(slug)` contract.** The canvas emits
  the same callback `PhaseSpineGraph` already emits, so the shipped 400px `PhaseFormPanel` opens on
  the clicked phase. Zero net-new panel work, and it proves node-id-equals-`phase.slug` end to end
  (SC#3). Canvas becomes a drop-in peer of the Spine view rather than a dead-end picture.
  Selection NEVER reorders and NEVER moves a node (read-only is structural).

- **D-183-06: Fallback titles are plain-language step-type sentences.** Only **10 of 119** live
  phases carry a real `phase.name`, so the fallback is the DOMINANT case, not the edge case.
  Today's `PhaseSpineGraph` fallback (`"AI agent step · retrieve"` — type label · slug) is the
  technical read sketch 137-D was chosen to eliminate. Replace with one business sentence per
  `phase_type` (e.g. "Search the knowledge base", "Write a section", "Work out how to do it",
  "Run several agents", "Wait for you", "Produce the deliverable" — exact wording is Claude's
  discretion, anchored to 137-D). **The slug never appears on the node face by default** — it
  lives behind the ⌥ Technical names reveal. When `phase.name` IS present it wins, as today.

- **D-183-07: Two badge slots, spent deliberately.** 137-D allows at most two word-badges.
  - Slot 1 = **grounding**, always present, said in words ("Must cite its sources" / "No sources
    needed"), **derived from what exists today** — `citation_policy` + the presence of a
    `citations_required` validator (sketch 135's derivation: `strict` = `citation_policy: strict`
    or a `citations_required` gate; `flag` = `citation_policy: flag`; `open` = neither). Phase 185
    later replaces this derivation with an authored `grounding_mode` field — 183 must NOT invent
    that field.
  - Slot 2 = **"Waits for you"**, shown ONLY on `llm_human_input` phases. It is the signal a
    business user most needs before running something, it is binary, and Phase 185's action-risk /
    approval checkpoint builds on exactly this `llm_human_input` substrate — so the slot is already
    reserved for the right concept. **Every other node face stays at ONE badge.**
  - Per the house accessibility rule (never colour alone — WCAG 1.4.1) the grounding state carries
    a glyph beside the words so it survives a colour-blind read at rest.

- **D-183-08: One canvas-level ⌥ Technical names toggle, flipping every node at once.** Matches how
  sketch 137 drove it and the shipped v3.3 two-audience pattern. NOT per-node hover (invisible to
  keyboard users, untestable without pointer simulation, and it breaks the mode-you-choose
  convention). One state, one assertion.

### Faithfulness — the missing branch, broken references, empty state, layout

- **D-183-09: The `skip_to_phase` fixture is TEST-ONLY.** `skip_to_phase` appears **zero times**
  across all 95 live definitions / 119 phases — the only production `on_failure` values are
  `fail_run` (×45) and `ask_user` (×2), so SC#1's branch edge cannot be demonstrated from the
  existing corpus. A hand-authored fixture table drives both SC#1 and SC#4: the 4 canonical seed
  shapes + the 3 PM-pack starters + both 5-phase maxima + the empty draft (all real, read live
  2026-07-25) plus **one synthetic `branching` entry** — `gather → assess ⇢(on fail) escalate`,
  skipping `draft` (sketch 136's proposed shape). **No synthetic row is seeded into the DB and no
  new starter workflow ships** — shipping a starter is a product decision belonging to the Starter
  Library / Phase 187, not a projection phase. Accepted cost: a branch edge is never seen by eye
  in the live app during UAT.

- **D-183-10: An unresolvable `skip_to_phase` target renders as a VISIBLY BROKEN REFERENCE.**
  Today `PhaseSpineGraph` drops such an edge silently (`slugSet.has(target)` filter) — migration
  065 dropped a real gate for exactly this reason. SC#4 says "no phantom edge", but a silently
  dropped edge hides a real defect. The edge renders as a stub terminating in an honest
  "goes to `<slug>` — no such step" marker: it connects to no node (not a phantom edge) and it does
  not lie about what the definition declares. This **agrees with the backend**, which already emits
  `UNSATISFIABLE_SKIP` for exactly this case (`reachability.py:154`), and pre-stages Phase 184's
  per-node badges which will report that code.

- **D-183-11: Zero-phase definitions get a named empty state with ALL canvas chrome suppressed.**
  **40 of 95** live definitions have zero phases — the empty projection is the single most common
  canvas state. Show one honest line ("No steps yet" + what to do about it) on a plain surface;
  the plane, grid, zoom controls and any minimap are suppressed entirely. Sketch 134's finding:
  chrome around an empty plane reads as a broken tool. **No ghost/placeholder first node** — a
  ghost node on a read-only canvas implies an affordance that does not exist yet, which is the
  "broken editor" read 183 must avoid.

- **D-183-12: Layout is a PURE FUNCTION of the definition — no DOM measurement.**
  `canvasModel.toCanvas(definition)` returns nodes/edges with fixed-pitch x and lane-assigned y;
  same definition in ⇒ byte-identical positions out, no DOM read, no two-pass render. This makes
  SC#4's faithfulness bar ("every canonical seed + PM pack, no dropped phase, no phantom edge") a
  plain snapshot test over the D-183-09 fixture table. Sketch 136 measured DOM heights to avoid
  clipping on gate-heavy nodes; solve that in **CSS instead** — uniform node width, the card grows
  downward, and edges anchor to a fixed offset from the node top rather than its centre, so a
  taller card never moves the edge baseline. `elkjs` stays deferred to Phase 191.

### G-5 — shared glyph/parse vocabulary

- **D-183-13: Extract ONE shared vocabulary module and repoint `PhaseSpineGraph` onto it.**
  `soulData.ts` claims to be the single glyph source and its comment says the
  `PhaseSpineGraph.tsx:24-31` duplicate was replaced — **it was not**. That file still carries a
  local `PHASE_GLYPHS` with the flat text glyphs Phase 127 retired (`⚙ ✎ 🤖 ⛓ ☺ ◆`), plus its own
  `parseSkipTarget` (:78) and `PHASE_TYPE_LABELS` (:34). 183 deletes the local map, moves
  `parseSkipTarget` + the plain-language sentences + the node-title resolution into one shared
  module, and points BOTH views at `soulData.PHASE_GLYPHS` + `phaseGlyph()`. **The Spine visibly
  gains the 3D marks** — finishing the migration Phase 127 started. Rationale: two views one
  toggle apart must not disagree about what a step looks like, and doing it now means Phases 184
  and 185 inherit one module instead of a third copy (the roadmap's proactive
  refactor-before-3rd-consumer ask). Accepted cost: a shipped surface is touched, so
  `PhaseSpineGraph`'s own tests need updating — including `PhaseSpine.test.tsx:104`'s
  `not.toMatch(/const PHASE_GLYPHS/)` guard, which should now also cover `PhaseSpineGraph`.

- **D-183-14: The cross-cutting icon SLUG swaps stay a separate dedicated task.** The operator
  chose 🧭 `compass` for `llm_agent` (robot reads as generic) and `handshake` is the open candidate
  for the too-dark `llm_batch_agents` `busts-in-silhouette` (luminance 34.5 vs the set's 135-185).
  `PHASE_GLYPHS` is deliberately shared, so a one-line map swap also changes the workflows-page
  card, the run + publish soul headers, the gauntlet stages and the live step cards — five shipped
  surfaces. Those go out under their own commit with their own before/after check (`/gsd:quick` or
  `/gsd:fast`), NOT as a side effect of the canvas phase, so a canvas rollback cannot silently
  revert an app-wide icon decision. **183 DOES ship the in-scope fix**: lightening the icon well /
  adding a soft light disc behind the floating mark, which is canvas-local styling and touches
  nothing already shipped.

- **D-183-15: Client-side parse + a pinned parity test.** `canvasModel` parses `skip_to_phase`
  locally (no network — the canvas renders instantly and works on an unsaved draft; the roadmap
  confirms the 182 seam is not strictly needed for read-only). A test pins the client parse against
  `backend/app/services/harness/reachability.py:89 parse_skip_target` over a shared case table:
  `"skip_to_phase:escalate"` → `escalate`; `"skip_to_phase:a:b"` → `b` (the `lastIndexOf(":")`
  split); `"skip_to_phase:"` → null; whitespace trimmed; `fail_run` / `ask_user` / `retry` → null.

  > **AMENDMENT (2026-07-25, operator-approved during `/gsd:plan-phase`) — correction C-1.**
  > The case table above is WRONG on one row, and the decision's own premise was false. Research
  > verified that the two parsers **do not agree today**: the backend
  > (`reachability.py:89-98`) slices off the literal prefix
  > (`on_failure[len("skip_to_phase:"):].strip()`), so `"skip_to_phase:a:b"` → **`"a:b"`**. The
  > frontend (`PhaseSpineGraph.tsx:78-83`) splits on `lastIndexOf(":")` → `"b"`. The frontend's
  > docblock at `:74-76` falsely asserts parity, and that false claim propagated into
  > `PhaseSpineGraph.test.tsx:110-111` and then verbatim into this decision.
  >
  > **Resolution: align the client to the backend.** The backend is authoritative (consistent with
  > D-182-06 "one lint copy"). The corrected shared case table is
  > `"skip_to_phase:a:b"` → **`"a:b"`**; every other row stands. The plan therefore also rewrites
  > the shared `parseSkipTarget`, fixes the false docblock, and updates
  > `PhaseSpineGraph.test.tsx:110-111`. Zero live definitions use `skip_to_phase` (verified across
  > the whole corpus), so this changes no shipped behaviour today — but left alone it becomes a
  > real correctness bug the moment Phase 184 round-trips edges.
  >
  > D-183-15's **intent** (parity, no drift, the parity test as the Pitfall-3 tripwire) is
  > unchanged and is what the plan must satisfy; only its stated example was wrong.
  Topology derivation is not a lint rule, so D-182-06 ("one lint copy, zero client-side
  re-implementation") is not breached — the parity test is what prevents the Pitfall 3 drift.
  **The canvas does NOT call `POST /workflows/validate` in 183** (that dependency arrives with
  Phase 184's VALID-02/03).

### G-4 — lived-experience UAT scenarios (operator-defined at scope time)

All four are operator-named "I'd recognise failure here" scenarios and MUST be driven live
(Chrome MCP or operator-clicks) at phase verification. Wire format + screenshots are insufficient.

- **U-1 Spine ⇄ Canvas agree.** Open a real draft, flip the toggle both ways; both views name the
  same steps in the same order with the same icons — no step in one view and not the other. This is
  the drift D-183-13 exists to prevent.
- **U-2 The 5-phase maximum reads.** `eval_coverage` is the only 5-phase definition and covers all
  five step types; 136-B measured a 5-phase horizontal flow at ~1,600px. Confirm it is legible —
  titles not truncated to nonsense, **no horizontal page overflow**, the `○ end` cap visible.
- **U-3 The empty draft doesn't look broken.** Open one of the 40 zero-phase drafts on Canvas:
  reads as "nothing here yet", with no stray grid, zoom pills, or minimap floating in space.
- **U-4 Flag off = yesterday's Builder.** Operator flips `visual_workflow_canvas` to Off in the
  Control Room, reloads, and confirms the toggle is gone and the graph column is exactly as before
  — **including on an operator account** (D-181-01).

### G-6 — How we'd know this failed

- A `position`, `x`, `y`, or `layout` key appears anywhere inside `workflow_definitions.definition`.
- Opening the Canvas view mints a `workflow_definitions` row or bumps a version.
- `extra="forbid"` is relaxed on any harness model to make a canvas save pass.
- Flag off and the Builder is not byte-identical, or the toggle is visible-but-disabled.
- A definition renders with fewer nodes than it has phases, or with an edge to a node that exists
  (a phantom edge), or `llm_batch_agents` drawn as N fan-out lanes instead of one node.
- Spine and Canvas disagree on a step's icon, title, or order.
- A third copy of `parseSkipTarget` or the glyph map exists at phase end.
- The canvas needs a network round trip before it can draw.

### Claude's Discretion

- Exact wording of the six plain-language step-type sentences (anchored to sketch 137-D).
- The shared vocabulary module's file name and home (a `phaseVocabulary.ts` beside `soulData.ts`
  vs folding into `soulData.ts` itself) — one home, whichever reads better against the existing
  `soulData` / `deriveTier` / `phaseGlyph` split.
- Fixed-pitch / lane-height constants, node width, and edge-anchor offset.
- React Flow chrome specifics on a NON-empty canvas — dot-grid opacity, whether zoom controls dock
  or reveal on interaction, whether a minimap appears only when the graph outgrows the viewport.
  Anchor to 137-D (frosted glass, Alive-by-default ambient motion with a Calm setting) and sketch
  134's "quiet-until-touched" finding. The empty state is NOT discretionary — D-183-11 locks it.
- How read-only is *told* on a non-empty canvas (a `👁 View only` badge and/or the cursor contract:
  the plane pans, nodes don't move). Read-only must read as a deliberate MODE, never a broken editor.
- Whether the `@xyflow/react` chunk is lazy-loaded / code-split behind the toggle.
- Wave / plan decomposition (shared-vocabulary extraction → `canvasModel` + fixtures → node/canvas
  render → toggle wiring + flag-off proof).
- Test file split and whether the parity case table lives in one shared JSON both suites read.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope + requirements
- `.planning/ROADMAP.md` — Phase 183 section (goal, SC#1-4, flags); Phase 184/185/188 sections for
  what this phase must NOT pre-empt.
- `.planning/REQUIREMENTS.md` — CANVAS-01 (:27), the requirement→phase map (:105).
- `.planning/research/PITFALLS.md` — **Pitfall 3** (layout NEVER in the definition JSONB; the
  canvas edge set IS `reachability.py`'s adjacency; deterministic auto-layout when no layout
  exists; round-trip as a gate). Pitfall 1 (anti-drift) and Pitfall 4 (run honesty) for context.

### The G-2 sketch gate — the locked acceptance bar
- `.planning/sketches/MANIFEST.md` — the session decision block locking the v3.6 canvas visual
  language (136-B + 137-D), the colour budget rule, the two build rules, and the two live-data
  findings that MUST reach this plan.
- `.planning/sketches/137-agentic-canvas-look/README.md` — **winner D**; the acceptance bar. The
  colour-budget argument, the icon luminance table, the motion-keys-off-run-state build rule.
- `.planning/sketches/136-flow-shape-and-branches/README.md` — **winner B** (horizontal L→R); the
  topology findings (batch = ONE node, gates on the node not the edge, explicit `○ end` cap, the
  zero-`skip_to_phase` finding).
- `.planning/sketches/135-phase-node-anatomy/README.md` — no winner; the node-content inventory,
  the 10-of-119-named-phases finding, the grounding derivation (`citation_policy` +
  `citations_required`), the forward slots for Phases 189-190, the never-colour-alone rule.
- `.planning/sketches/134-canvas-frame-and-read-only/README.md` — no winner; the canvas-frame
  inventory, the 2-node problem, the empty-state finding, the read-only-as-mode framing.
- `.planning/sketches/themes/phase-icons-3d.js` — the verified 3D fluent-emoji marks. **NEVER text
  glyphs.**
- `.claude/get-shit-done/references/icon-convention.md` — the Phase 127 icon convention
  (phase-type icons = the shared `PHASE_GLYPHS` map; provider logos = `@lobehub/icons`).

### Inherited locked decisions
- `.planning/phases/181-revert-foundation/181-CONTEXT.md` — **D-181-01** (flag-off byte-identical
  for everyone incl. operators), **D-181-02** (404 not 403), **D-181-03** (Off|On toggle),
  **D-181-07** (byte-identical defined OBSERVABLY), **D-181-08** (the 181-only freeze list — does
  NOT carry into 183). Its `<deferred>` note about the nav entry is released by D-183-01.
- `.planning/phases/182-server-validation-seam/182-CONTEXT.md` — **D-182-06** (one lint copy, zero
  client-side re-implementation) and the `/validate` verdict shape 184 will consume.
- `.planning/phases/182-server-validation-seam/182-DECISION-NOTES.md` — the accepted SC#3
  uniform-404 risk, explicitly noting the routes go public in 183/184.

### The code to mirror / repoint (frontend)
- `frontend/src/components/workflows/PhaseSpineGraph.tsx` — the donor and the repoint target. Local
  `PHASE_GLYPHS` (:24-31, stale flat glyphs), `PHASE_TYPE_LABELS` (:34), `READ_ONLY_LEGEND` (:44),
  `PhaseSpecJSON` / `PhaseConfigJSON` / `ValidatorJSON` (:50-71), `parseSkipTarget` (:78),
  `nodeTitle` (:86), the skip-edge resolution loop (:110-118), the `onSelectNode` contract (:98).
- `frontend/src/components/workflows/soulData.ts` — `PHASE_GLYPHS` (:28, phase_type → verified
  fluent-emoji SLUG), `DefShape` (:38), `tierForDefinition` (:81), `soulDeliverable` (:131). The
  single glyph source of truth.
- `frontend/src/lib/phaseGlyph.tsx` — `phaseGlyph(phaseType)` → bundled 3D SVG component; the
  deep-subpath `~icons/fluent-emoji/<slug>` bundling rule and the verify-or-bundle discipline.
- `frontend/src/components/workflows/PhaseSpine.tsx:88` — the canonical render pattern
  `{Glyph ? <Glyph /> : (PHASE_GLYPHS[type] ?? "•")}` (3D component first, text as fallback).
- `frontend/src/pages/WorkflowBuilderPage.tsx` — the mount site. `BuilderDefinition` (:36),
  `BuilderInitial` (:48), `BuilderState` (:53), `selectedSlug` (:100), the `PhaseSpineGraph` mount
  (:451) and the `minmax(0,1fr) <44px|400px>` push grid.
- `frontend/src/components/workflows/PhaseFormPanel.tsx` — the 400px panel the click opens; it
  already imports `PhaseSpecJSON` from `PhaseSpineGraph` (:39), so the type move must keep it building.
- `frontend/src/components/workflows/deriveTier.ts` — `CitationPolicy` / `ValidatorKind`, the
  grounding derivation inputs.

### Flag plumbing (inherited, do not redesign)
- `frontend/src/hooks/useEffectiveFeatures.ts` — fail-closed per-session effective-map fetch.
- `frontend/src/lib/nav-items.ts` — `NAV_ITEMS` + `visibleNavItems`; the VANISH convention. **No
  new entry** (D-183-01).
- `frontend/src/components/admin/revertByteIdentical.test.tsx` — the 181 acceptance gate; its
  scope-freeze assertions must keep passing.
- `frontend/src/components/admin/FeatureVisibility.tsx:147` + `ControlRoomPage.tsx:196` — the
  existing Off|On operator card row.
- `backend/app/models/user_settings.py:1086-1092` — `visual_workflow_canvas: "off"` cold default.

### The backend parse to pin against
- `backend/app/services/harness/reachability.py` — `parse_skip_target` (:89), the skip-target
  collector (:102), `UNSATISFIABLE_SKIP` (:9, :154 — the verdict the broken-reference marker must
  agree with).

### Stack
- `@xyflow/react` v12 (^12.11.2, MIT, React-19-compatible, zustand-internal) — the net-new
  dependency introduced in this phase. **Never** the frozen `reactflow` v11 package name.
  `frontend/package.json` — React 19.2.4, Vite 8.
- `.planning/research/STACK.md` — the dependency rationale.

### Competitor evidence backing the constrained-spine bet
- `.planning/research/deep-dive/` — Glean scopes drag-and-drop to reordering steps not free wiring;
  Beam's July-2026 redesign moved toward sidebar config; n8n's DAG has a documented complexity
  cliff (20-30 nodes before non-technical readers lose the thread).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`PhaseSpineGraph.tsx`** — the closest analog and the donor for nearly everything: the read
  shapes (`PhaseSpecJSON`/`PhaseConfigJSON`/`ValidatorJSON`), `parseSkipTarget`, the
  `phase_index`-sort + skip-edge resolution, the `onSelectNode` selection-only contract, and the
  structural drag-free invariant (every node a `<button>`; no `draggable`, no drag handler, no
  connection handle, no add-node control).
- **`phaseGlyph()` + `soulData.PHASE_GLYPHS`** — the shared 3D icon resolver and slug map already
  exist and are already consumed by `PhaseSpine.tsx`. The canvas needs no new icon infrastructure.
- **`PhaseFormPanel`** — the 400px node-detail panel already exists and is already driven by
  `selectedSlug`. D-183-05 reuses it verbatim; zero net-new panel work.
- **`deriveTier` / `soulDeliverable`** — the grounding/deliverable derivations the badges read.
- **`useEffectiveFeatures` + the `visual_workflow_canvas` Off|On card** — the whole flag plumbing
  is shipped from Phase 181. 183 consumes it; it does not extend it.

### Established Patterns
- **No router.** Navigation is a `useState<ActiveView>` switch in `App.tsx` (the three-homes
  contract, sketch 023-A). Any "new page" is state, not a route — which is a large part of why the
  in-Builder toggle is cheaper than a standalone view.
- **VANISH, never a locked placeholder.** `visibleNavItems` drops governed entries entirely;
  fail-closed on a map blip. D-183-03 follows this.
- **Two-audience reveal.** Plain language by default with a ⌥ Technical names mode — shipped in
  v3.3 and on the operator band. D-183-08 follows it.
- **Derive, never fetch, never invent.** `soulData` is pure client-side over existing definition
  fields; the grounding badge follows the same rule (D-183-07).
- **Push grid, not overlay.** `gridTemplateColumns: minmax(0,1fr) <44px|400px>` is the app's
  panel idiom; the canvas inherits the Builder's existing grid unchanged.
- **Immutability lives at publish.** Draft edits PATCH one row; versions mint only at publish;
  Tweak forks a fresh v(N+1) draft. 183 writes NOTHING — it must not perturb this.

### Integration Points
- `WorkflowBuilderPage.tsx` — the toggle strip + swapping the graph-column child between
  `PhaseSpineGraph` and the new `WorkflowCanvas` (both fed the same `phases` + `selectedSlug` +
  `onSelectNode`).
- The new shared vocabulary module — consumed by BOTH `PhaseSpineGraph` (repointed) and the canvas;
  `PhaseFormPanel`'s `PhaseSpecJSON` import must keep resolving.
- `frontend/package.json` — the one net-new dependency.
- `useEffectiveFeatures` at the Builder — gating the toggle's existence.
- **Nothing backend.** No route, no migration, no threat model, no cloud parity owed.

### Anti-drift note for the planner
`soulData.ts`'s own header comment asserts the `PhaseSpineGraph.tsx:24-31` duplicate was already
extracted. It was not. Treat in-code claims of prior extraction as unverified — grep before
believing.

</code_context>

<specifics>
## Specific Ideas

- The toggle reads `[≣ Spine] [⬡ Canvas]` — the same two-view shape sketch 134-A/C drew.
- Node face at rest: 3D mark floating at the LEFT edge with its own contact shadow, one
  plain-language title, one supporting line, at most two word-badges. Frosted-glass card, neutral —
  per-step-type colour is a **tint behind the icon only**.
- **The colour budget is load-bearing.** Strong colour belongs to Phase 188's run status
  (running / done / waiting-for-you / failed). Variant C was rejected for spending its colour on
  step type. Any later phase that wants to colour a node by *type* must justify it against this rule.
- **Motion keys off RUN STATE, never off selection** — the defect found in sketch 137 review. 183
  has no run state, so its motion is ambient only (backdrop drift in Alive, completely still in
  Calm); a selected node must NOT be the thing that animates.
- Every flow ends in an explicit `○ end` cap — never a dangling edge stub.
- `llm_batch_agents` renders as **ONE** node. The ×5 fan-out is runtime, not topology; drawing 5
  lanes would be a phantom edge and would disagree with `reachability.py`'s adjacency.
- Gates (`citations_required`, `output_file_valid`, `llm_judge_rubric`) are properties of a PHASE,
  so they are node-borne. **Only `skip_to_phase` becomes an edge.**
- Real slugs in the corpus include cryptic ones (`m1`, `probe`) — part of why the plain-language
  step-type sentence beat the de-slugified title.
- Live corpus shape (read 2026-07-25): 95 definitions / 119 phases; 40 definitions with zero
  phases; the modal non-empty definition has 2 phases; `eval_coverage` is the only 5-phase one.

</specifics>

<deferred>
## Deferred Ideas

- **A no-fork read-only canvas door for PUBLISHED workflows** — view a published definition's
  canvas without `createWorkflowDraft` minting a v(N+1) row. *Re-open trigger:* Phase 184 (if the
  editable canvas needs a view-only sibling for published versions) or Phase 188 (when a run view
  needs to open a canvas nobody can edit). Today the library card's glyph-dot `PhaseSpine` covers
  the at-a-glance need.
- **The `NAV_ITEMS` entry tagged `visual_workflow_canvas`** that Phase 181 deferred to "land with
  the view in 183" — released by D-183-01, not needed under the in-Builder-toggle shape.
  *Re-open trigger:* only if a standalone canvas `ActiveView` ever ships.
- **The cross-cutting icon slug swaps** — `llm_agent` Robot → 🧭 `compass` (operator-chosen) and
  `llm_batch_agents` `busts-in-silhouette` → `handshake` (still open). One additive
  `phaseGlyph.tsx` map change, five shipped surfaces. Carry as a small dedicated task
  (`/gsd:quick` / `/gsd:fast`), NOT inside 183 (D-183-14).
- **Flipping Canvas to the default view** — deferred to Phase 184 once the canvas is the better
  surface (D-183-02).
- **Persisting the Spine/Canvas view preference** — 183 keeps it session-only; revisit if operators
  ask.
- **`elkjs` auto-layout** — Phase 191 (STRETCH), and only if run-viz must depict
  `llm_batch_agents` fan-out as branching.
- **A branching example as a shipped starter workflow** — a Starter Library / Phase 187 product
  decision, not a projection phase's to make (D-183-09).
- **`workflow_layouts` side table / migration slot 114** — Phase 184, and only if that phase's
  sketch confirms persisted layout is needed (OPEN-05). 183 persists nothing.

### Reported bugs reviewed (not folded)

- **BUG-260609-04** (phase card shows placeholder slug `phase-0` instead of the real slug) — **left
  OPEN, not folded.** It is a live-run reconcile-floor clobber in the workspace panel's phase card;
  183 projects a STATIC definition and reads `phase.slug` directly from it, so the bug cannot
  manifest here. *Re-open trigger updated:* re-check at **Phase 188** (Non-Technical Run
  Observability), where `CanvasRunView` reads the same live `usePhases(threadId)` slice the buggy
  card reads.
- **BUG-260609-02** (SUB-RESULTS "Sub-task" loses description on nav) — harness sub-agent run
  honesty; not this phase's domain. Left open for Phase 188.
- **BUG-260718-02 / -03 / -04, BUG-260722-02** — chat/streaming/citations, workspace panel, model
  selection, and the OpenAI agent-loop. No overlap with a static definition projection. Left open.

</deferred>

---

*Phase: 183-read-only-canvas*
*Context gathered: 2026-07-25*
