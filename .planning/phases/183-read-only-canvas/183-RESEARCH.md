# Phase 183: Read-Only Canvas - Research

**Researched:** 2026-07-25
**Domain:** React node-graph rendering (`@xyflow/react` v12) as a pure client-side projection of a governed workflow definition
**Confidence:** HIGH (stack + codebase verified this session) / MEDIUM (a few xyflow behaviours confirmed from source rather than prose docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Entry door — where the canvas lives**

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
  glyph-dot `PhaseSpine` remains the at-a-glance read for published workflows.

**Node model — click behaviour and depth**

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

**Faithfulness — the missing branch, broken references, empty state, layout**

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

**G-5 — shared glyph/parse vocabulary**

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
  Topology derivation is not a lint rule, so D-182-06 ("one lint copy, zero client-side
  re-implementation") is not breached — the parity test is what prevents the Pitfall 3 drift.
  **The canvas does NOT call `POST /workflows/validate` in 183** (that dependency arrives with
  Phase 184's VALID-02/03).

> ⚠ **RESEARCH CORRECTION to D-183-15** — see §Correction C-1. The backend does **not** use a
> `lastIndexOf(":")` split. `"skip_to_phase:a:b"` → `"a:b"` on the backend, not `"b"`. The locked
> *intent* ("pin the client parse against the backend") is honoured only if the client is changed
> to the backend's `slice(prefix.length)` semantics and the case-table row is corrected.

**G-4 — lived-experience UAT scenarios (operator-defined at scope time)**

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

**G-6 — How we'd know this failed**

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

### Deferred Ideas (OUT OF SCOPE)

- **A no-fork read-only canvas door for PUBLISHED workflows** — *Re-open trigger:* Phase 184 or 188.
- **The `NAV_ITEMS` entry tagged `visual_workflow_canvas`** — released by D-183-01. *Re-open trigger:*
  only if a standalone canvas `ActiveView` ever ships.
- **The cross-cutting icon slug swaps** — `llm_agent` Robot → 🧭 `compass`, `llm_batch_agents`
  `busts-in-silhouette` → `handshake`. Own dedicated task (`/gsd:quick` / `/gsd:fast`), NOT 183 (D-183-14).
- **Flipping Canvas to the default view** — Phase 184 (D-183-02).
- **Persisting the Spine/Canvas view preference** — session-only in 183.
- **`elkjs` auto-layout** — Phase 191 (STRETCH).
- **A branching example as a shipped starter workflow** — Starter Library / Phase 187 (D-183-09).
- **`workflow_layouts` side table / migration slot 114** — Phase 184 (OPEN-05). 183 persists nothing.

*Reported bugs reviewed and NOT folded:* BUG-260609-04 (re-check at Phase 188), BUG-260609-02,
BUG-260718-02/-03/-04, BUG-260722-02. None overlap a static definition projection.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **CANVAS-01** | *"A user can view an existing workflow as a visual node canvas — a read-only projection of its `WorkflowDefinition` (nodes = phases, edges = flow + `skip_to_phase` branches), rendered via `@xyflow/react`."* (`.planning/REQUIREMENTS.md:27`) | §Standard Stack (verified `@xyflow/react@12.11.2`, MIT, React-19 peer-compatible) · §Architecture Patterns (the `toCanvas` pure-projection recipe + the read-only prop set) · §Correction C-2 (the edge set MUST be `phase_index+1` lookup, not sorted-array adjacency, or SC#4 breaks) · §Fixture Corpus (the checked-in artifacts SC#4 is graded against) · §Testing (the official jsdom mock recipe) |

Requirement→phase map: `.planning/REQUIREMENTS.md:105` (`| CANVAS-01 | Phase 183 | Pending |`) — CANVAS-01 maps to Phase 183 and to no other phase.
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

Directives the plan must comply with. Verified present in `C:\Vibe Apps\Agentic RAG\CLAUDE.md`.

| # | Directive | Bearing on Phase 183 |
|---|-----------|----------------------|
| P-1 | Frontend is React + Vite + Tailwind + shadcn/ui, **Aether Intelligence design system, Deep Midnight theme** | Canvas chrome + node cards must be themed via existing CSS vars, not xyflow's default light palette. `colorMode` defaults to `'light'` in xyflow — see Pitfall 6. |
| P-2 | **No LangChain, no LangGraph — raw SDK calls only** | Not applicable (no LLM path). `@xyflow/react` is a rendering library, not a runtime — consistent with the D-14 red line. |
| P-3 | Schema changes ship as numbered SQL migrations | **No migration in 183.** The plan must not add one. |
| P-4 | **Workflow guardrails G-1..G-6 + the hot-file ledger** | G-2 SATISFIED (sketches 134-137, 137-D locked). G-5 fires proactively via D-183-13. `WorkflowBuilderPage.tsx` is NOT on the hot-file ledger (the ledger lists `threads.py`, `anthropic_service.py`, `ToolCallPanel.tsx`, `MessageItem.tsx`, `StreamsProvider.tsx`, `useMessages.ts`) — no G-5 block on the mount site. |
| P-5 | **UAT scoreboard recipe (4-axis)** applies to phases touching *streaming, agent loop, provider routing, or UI state* | 183 touches none of those — the ROADMAP explicitly flags **"no SC#10 (static projection)"**. Do **not** author cross-provider UAT rows. The G-4 rows (U-1..U-4) replace them. |
| P-6 | Settings live in `user_settings` / `app_settings`; env vars for secrets/infra only | The flag already lives at `backend/app/models/user_settings.py:1092` — 183 consumes it, does not extend it. |
| P-7 | Provider-docs-first (evidence-based) | Applied to `@xyflow/react`: every stack claim below cites reactflow.dev or the xyflow GitHub source, never memory. |
| P-8 | Reported-bugs cross-check at `/gsd:plan-phase` | Zero reports carry `folded_into: 183` (CONTEXT `<deferred>` routed all six to open/Phase-188). Planner must verify no plan task is required to close one. |

---

## Summary

Phase 183 introduces exactly one net-new dependency (`@xyflow/react@12.11.2`, MIT, 58.75 KB gzip) and
writes nothing to the database. The engineering content is small — a pure function
(`canvasModel.toCanvas`), a custom node component, a `<ReactFlow>` wrapper configured for read-only,
and a session-state view toggle gated on an already-shipped feature flag. The *risk* is concentrated
in three places that are easy to get wrong and expensive to discover late: (1) the edge-derivation
rule, where the obvious implementation produces a phantom edge that violates SC#4; (2) the xyflow
read-only prop set, where every interaction flag defaults **true** and one default-on `<Controls>`
button can silently re-enable dragging; and (3) the jsdom test environment, which cannot render
xyflow at all without four specific global mocks.

Codebase verification this session confirmed the CONTEXT's central anti-drift warning and found a
second, more consequential instance of the same failure mode. `soulData.ts:19-21` claims the
`PhaseSpineGraph.tsx:24-31` glyph duplicate was already extracted — it was not (verified: the local
map is still there, still carrying the flat glyphs Phase 127 retired). And `PhaseSpineGraph.tsx:74-76`
claims its `parseSkipTarget` "mirrors the backend `parse_skip_target`… split on the LAST ':'" — the
backend does no such thing; it splits on the *prefix length*, and the two functions return different
answers for any target containing a colon. That false claim was copied verbatim into
`PhaseSpineGraph.test.tsx:110-111` and again into the D-183-15 case table. Fixing it is cheap now and
becomes a correctness bug the moment Phase 184 round-trips edges back into a definition.

Live-corpus counts quoted in CONTEXT and in sketches 134-136 do not reproduce against the local
database today (2026-07-25, same day): 51 phases not 119, 71 zero-phase definitions not 40, one
5-phase definition not two, zero named phases not ten. The *directional* findings all hold and several
get stronger — but the numbers are not reproducible, which is precisely why the SC#4 fixture table
must be transcribed from checked-in migrations (061 / 066 / 094) and `scripts/seed-pm-pack.py`, not
from a live read.

**Primary recommendation:** Build `canvasModel.toCanvas` as a pure, DOM-free function whose sequential
edge set is derived by `phase_index + 1` *lookup* (mirroring `reachability.py:164`), snapshot-test it
against a hand-transcribed fixture table sourced from the checked-in seed migrations, and render it
through a `<ReactFlow>` locked down with the explicit six-flag read-only prop set plus
`<Controls showInteractive={false}>`. Keep DOM assertions thin; the projection is where the phase's
truth lives.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Definition → nodes/edges projection | **Browser / Client** (pure module) | — | D-183-12 locks it as a pure function of the definition; no DOM read, no network. Testable as a snapshot. |
| Node/edge rendering + pan/zoom | **Browser / Client** (`@xyflow/react`) | — | Presentation only. Never touches the definition. |
| `skip_to_phase` parse | **Browser / Client** (mirrored) | API (`reachability.py` is authoritative) | D-183-15: local parse for instant render on an unsaved draft; a parity test pins it to the backend. Topology derivation is not a lint rule, so D-182-06 is not breached. |
| Layout / positions | **Browser / Client** (computed at render) | ✗ **never** Database | Pitfall 3 — layout in the definition JSONB would 422 against `extra="forbid"` or force relaxing it. 183 persists nothing. |
| Structural validation verdicts | **API** (`POST /workflows/validate`) | — | **Not consumed in 183.** Arrives with Phase 184 (VALID-02/03). The canvas must draw with zero network calls. |
| Feature-flag gating (render) | **Browser / Client** (`useEffectiveFeatures`) | **API** (`require_visible` / `CanvasGateMiddleware`) | Client hide is render-only and fail-closed; the backend gate is the security wall. 183 adds no new route, so only the client half applies. |
| Node detail / config | **Browser / Client** (`PhaseFormPanel`, already shipped) | — | D-183-05 reuses it verbatim via the existing `selectedSlug` contract. Zero net-new panel work. |
| Phase-type glyph vocabulary | **Browser / Client** (one shared module) | — | D-183-13 — one home consumed by both views. |

**Tier sanity check:** no capability in this phase belongs to the API, the database, or the CDN. The
phase is correctly scoped frontend-only, and any plan task proposing a route, a migration, or a
server read is a tier misassignment.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@xyflow/react` | **12.11.2** (published 2026-07-06) | The node canvas: `<ReactFlow>`, custom `nodeTypes`, `<Background>`, `<Controls>`, `<MiniMap>`, `<Handle>`, pan/zoom, `fitView` | MIT. `peerDependencies: { react: ">=17" }` — React 19.2.4 in range. Nodes/edges are ordinary React components, so a Deep-Midnight frosted card is plain Tailwind JSX, not a foreign rendering model. `.planning/research/STACK.md:33` records it as the milestone pick; `.planning/REQUIREMENTS.md` names it in CANVAS-01 itself. [VERIFIED: npm registry + reactflow.dev] |

**Registry facts, verified this session** (`npm view @xyflow/react`, 2026-07-25):

```
version      = 12.11.2          published 2026-07-06T12:42:54.957Z
license      = MIT
peerDeps     = { react: ">=17", react-dom: ">=17",
                 "@types/react": ">=17", "@types/react-dom": ">=17" }
dependencies = { classcat: "^5.0.3", zustand: "^4.4.0", "@xyflow/system": "0.0.79" }
scripts.postinstall = (none)
exports      = { ".", "./dist/style.css", "./dist/base.css" }
```

Recent release cadence (from `npm view … time`): 12.10.0 (2025-12-04) → 12.10.1 (2026-02-19) →
12.10.2 (2026-03-27) → 12.11.0 (2026-06-01) → 12.11.1 (2026-06-22) → **12.11.2 (2026-07-06)**.
Actively maintained; 19 days old at research time. [VERIFIED: npm registry]

**Bundle cost** (bundlephobia, `@xyflow/react@12.11.2`): **184,433 B min / 58,753 B gzip**,
3 direct dependencies, transitively pulling `d3-drag`, `d3-selection`, `d3-zoom`, `d3-interpolate`,
`d3-transition`, `d3-color`, `d3-timer`, `d3-ease`, `d3-dispatch`, `use-sync-external-store`.
`hasSideEffects: ["*.css"]`. [CITED: bundlephobia.com/api/size?package=@xyflow/react@12.11.2]

> **~59 KB gzip is a real number for a surface that is off by default and one click deep.** The
> discretionary `React.lazy` split (CONTEXT: Claude's discretion) is **recommended**: with
> `visual_workflow_canvas` cold-defaulting to `"off"` for everyone (`user_settings.py:1092`),
> today's shipped users would otherwise pay 59 KB for a subtree that never renders. A dynamic
> `import()` behind the toggle also makes D-183-03's "the `@xyflow` subtree stays out of the render
> path entirely" a *build-level* guarantee rather than a render-branch claim.

### Supporting (already installed — no new dependency)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `unplugin-icons` + `@iconify-json/fluent-emoji` | 23.0.1 / 1.2.7 | Build-time bundling of the 3D phase marks | Already wired in `vite.config.ts:9` and `vitest.config.ts:7`. `phaseGlyph.tsx` consumes it. The canvas needs **no new icon infrastructure**. [VERIFIED: frontend/package.json:52,78 + vite.config.ts:9] |
| `tailwindcss` | 3.4.19 | Node card styling | Note: this is Tailwind **3**, not 4. The Tailwind-4-specific CSS-import-ordering caveat in the xyflow quickstart does not apply, but importing the stylesheet from `index.css` rather than a component file is still the documented-safe placement. [VERIFIED: frontend/package.json:75] |

### Alternatives Considered

Already settled at milestone level (`.planning/research/STACK.md:81-99`) — recorded here so the
planner does not re-open them.

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@xyflow/react` | **`reactflow`** (v11 name) | ⛔ **Never.** Same library, frozen old name. Web recipes older than mid-2024 use it; copying one silently gets a v11 API. Called out in the ROADMAP flags and STACK.md:81/98. |
| `@xyflow/react` | tldraw | ⛔ Non-MIT SDK licence + production watermark. Explicitly listed under REQUIREMENTS "Out of Scope". |
| hand-rolled layout | `elkjs` / `dagre` | Deferred to Phase 191 (STRETCH). `dagre` is unmaintained. D-183-12 locks a pure fixed-pitch function — no layout library. |
| — | `zundo` | Phase 184 (undo/redo). **Not this phase**, and see Correction C-5: it cannot wrap xyflow's internal store. |

**Installation:**

```bash
cd frontend && npm install @xyflow/react
```

---

## Package Legitimacy Audit

Ran the Package Legitimacy Gate protocol this session.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@xyflow/react` | npm | 12.11.2 published 2026-07-06 (19 days); package line active since the v12 rename | ~109K/week (per STACK.md; not independently re-measured this session) | `github.com/xyflow/xyflow` (declared in package metadata; source files fetched successfully this session) | **[OK]** | **Approved** |

**Verification trail:**

1. `slopcheck install @xyflow/react` → **false-positive `[SLOP]`**: slopcheck auto-detected the
   project ecosystem as **PyPI** (the repo root has a Python backend) and reported
   *"Package '@xyflow/react' does not exist on pypi."* This is the documented cross-ecosystem
   confusion mode, not a real finding.
2. Re-ran with the correct ecosystem forced from `frontend/`:
   `slopcheck install --ecosystem npm @xyflow/react` → **`[OK]` · 1 OK · 0 SLOP**. (The subsequent
   `npm install` sub-process failed with `WinError 2` because slopcheck could not resolve `npm` on
   PATH from its Python subprocess — the *verification* completed; only the install shell-out
   failed, which is fine since we did not want it installed at research time.)
3. `npm view @xyflow/react scripts.postinstall` → **empty**. No postinstall script. No network or
   out-of-tree filesystem access at install time.
4. Independent authoritative confirmation: the package name is used verbatim in the official
   migration guide's import statements (`import { ReactFlow } from '@xyflow/react';`) and in the
   official installation page's CSS import — i.e. discovered from official docs, not from a search
   result. [CITED: reactflow.dev/learn/troubleshooting/migrate-to-v12,
   reactflow.dev/learn/getting-started/installation-and-requirements]

**Packages removed due to slopcheck [SLOP] verdict:** none (the one `[SLOP]` was a wrong-ecosystem
artifact, resolved by re-running against npm).
**Packages flagged as suspicious [SUS]:** none.

**Transitive dependencies** (informational — not separately slopchecked; all are long-established):
`classcat@5.0.5` (MIT, 5.2 KB), `@xyflow/system@0.0.79` (MIT, first-party), `zustand@^4.4.0`
(see Correction C-5), plus the `d3-*` family via `@xyflow/system`.

---

## Verified Codebase Inventory

Every row below was opened and read this session. Line numbers are exact.

### Donor / repoint target — `frontend/src/components/workflows/PhaseSpineGraph.tsx` (239 lines)

| Symbol | Line(s) | CONTEXT claim | Verified? | Notes |
|---|---|---|---|---|
| local `PHASE_GLYPHS` (flat unicode) | **24-31** | `:24-31` | ✅ exact | Values: `⚙ ✎ 🤖 ⛓ ☺ ◆`. The retired Phase-127 set. |
| `PHASE_TYPE_LABELS` | **34-41** | `:34` | ✅ | `Server step / AI write step / AI agent step / Parallel agents / Needs you / Deliverable` — the technical read 137-D replaces. |
| `READ_ONLY_LEGEND` (exported) | **44-46** | `:44` | ✅ | Exported const; grep found **no importer outside this file** — safe to move or leave. |
| `ValidatorJSON` (exported) | **50-54** | `:50-71` | ✅ | `{ kind?, on_failure?, [k]: unknown }`. |
| `PhaseConfigJSON` (exported) | **57-60** | `:50-71` | ✅ | `{ phase_type: string, [k]: unknown }`. |
| `PhaseSpecJSON` (exported) | **65-71** | `:50-71` | ✅ | `{ slug, phase_index, name?, config, validators? }`. |
| `parseSkipTarget` (exported) | **78-83** | `:78` | ✅ | ⚠ See Correction C-1 — its docblock (74-76) makes a **false** backend-parity claim. |
| `nodeTitle` (module-private) | **86-91** | `:86` | ✅ | `` `${label} · ${slug}` `` fallback. **Not exported** — the move is free. |
| `PhaseSpineGraphProps.onSelectNode` | **98** | `:98` | ✅ exact | `(slug: string) => void`. |
| sort by `phase_index` | **103** | — | ✅ | `[...phases].sort((a,b)=>a.phase_index-b.phase_index)`. |
| `slugSet` filter (silent edge drop) | **104**, **114** | D-183-10 | ✅ | `slugSet.has(target)` — this is the silent drop D-183-10 replaces. |
| skip-edge resolution loop | **110-118** | `:110-118` | ✅ exact | |
| structural drag-free invariant | 181-214 | — | ✅ | Every node is a `<button type="button">` with `aria-pressed`, `aria-label`; no `draggable`, no drag handler. |

**Every importer of a symbol from `PhaseSpineGraph.tsx`** — exhaustive grep across `frontend/`. A missed
importer is a build break; there are exactly **four**:

| File | Line | Imports | Impact of the D-183-13 type move |
|---|---|---|---|
| `frontend/src/pages/WorkflowBuilderPage.tsx` | **31** | `{ PhaseSpineGraph, type PhaseSpecJSON }` | Must keep resolving. This file is also the mount site. |
| `frontend/src/components/workflows/PhaseFormPanel.tsx` | **39** | `type { PhaseSpecJSON }` | CONTEXT-named. ✅ verified. |
| `frontend/src/components/workflows/PhaseFormPanel.test.tsx` | **25** | `type { PhaseSpecJSON }` | ⚠ **NOT named in CONTEXT.** A second importer of the same type. |
| `frontend/src/components/workflows/PhaseSpineGraph.test.tsx` | **18-19** | `./PhaseSpineGraph?raw` + `{ PhaseSpineGraph, type PhaseSpecJSON }` | The `?raw` source-grep import is why the source-text guards at :153-159 are load-bearing. |

> Safest mechanical shape: move the three interfaces + `parseSkipTarget` + `nodeTitle` into the new
> shared module, then **re-export the types from `PhaseSpineGraph.tsx`** (`export type { PhaseSpecJSON } from "…"`).
> All four importers keep building with zero edits, and Phase 184 can migrate them at leisure.
> If the planner prefers a hard cut, all four call sites must change in the same commit.

### The single glyph source — `frontend/src/components/workflows/soulData.ts` (142 lines)

| Symbol | Line(s) | CONTEXT claim | Verified? |
|---|---|---|---|
| the false extraction claim | **19-21** | "*claims… it was not*" | ✅ **CONFIRMED FALSE.** The comment reads *"previously duplicated by value in WorkflowsPage.tsx:44-51 and PhaseSpineGraph.tsx:24-31"* — but `PhaseSpineGraph.tsx:24-31` still holds a live local map. |
| `PHASE_GLYPHS` (fluent-emoji slugs) | **28-35** | `:28` | ✅ exact — `gear / memo / robot / busts-in-silhouette / raised-hand / package` |
| `DefShape` | **38-52** | `:38` | ✅ exact |
| `tierForDefinition` | **81-104** | `:81` | ✅ exact |
| `soulDeliverable` | **131-141** | `:131` | ✅ exact |
| `ALL_VALIDATOR_KINDS` | 54-60 | — | ✅ narrows to 5 of the backend's 9 kinds (see C-8) |

### The glyph resolver — `frontend/src/lib/phaseGlyph.tsx` (66 lines)

- `PHASE_GLYPH_MARKS` at **46-53**; `phaseGlyph(phaseType)` exported at **63-66**, returns
  `PhaseMark | null` (total over any key).
- Deep-subpath bundling rule at **28-33**: `import Gear from "~icons/fluent-emoji/gear"` etc.
  Docblock **17-18** states the verify-or-bundle discipline: *"A missing slug fails the build."*
- ✅ All CONTEXT claims verified.

### The canonical render pattern — `frontend/src/components/workflows/PhaseSpine.tsx`

- **Line 88**: `{Glyph ? <Glyph /> : (PHASE_GLYPHS[type] ?? "•")}` — ✅ exact match to CONTEXT.
- Imports at **19-20**: `PHASE_GLYPHS` from `soulData`, `phaseGlyph` from `@/lib/phaseGlyph`.
- Empty state at **42-48**: `data-testid="soul-spine-empty"` → *"No phases yet"*. A shipped
  precedent for the D-183-11 empty copy.

### The mount site — `frontend/src/pages/WorkflowBuilderPage.tsx`

| Symbol | Line | CONTEXT claim | Verified? |
|---|---|---|---|
| `BuilderDefinition` | **36** | `:36` | ✅ exact |
| `BuilderInitial` | **48** | `:48` | ✅ exact |
| `BuilderState` union | **53-57** | `:53` | ✅ exact — `empty \| composing \| drafted \| error` |
| `const [selectedSlug, …]` | **100** | `:100` | ✅ exact |
| `panelOpen = selectedSlug !== null` | **131** | — | ✅ |
| `selectedPhase` useMemo | **136** | — | ✅ |
| `data-testid="builder-grid"` | **447** | — | ✅ |
| push grid `minmax(0,1fr) <400px\|44px>` | **449** | `minmax(0,1fr) <44px\|400px>` | ✅ (order in code is `panelOpen ? "400px" : "44px"`) |
| `<PhaseSpineGraph …>` mount | **451-455** | `:451` | ✅ exact |

The graph column is the **first grid child** at 451; swapping it for `<WorkflowCanvas>` under a toggle
is a single-child substitution — no grid change, exactly as D-183-01 assumes.

### Flag plumbing (inherited — do not redesign)

| Artifact | Line | Verified content |
|---|---|---|
| `frontend/src/lib/api.ts` | **73** | `\| "visual_workflow_canvas"` in the `GovernedFeature` union |
| `frontend/src/lib/api.ts` | **77** | `EffectiveFeatures = Partial<Record<GovernedFeature, boolean>>` |
| `frontend/src/hooks/useEffectiveFeatures.ts` | **39-86** | One-shot per-user fetch; **fails CLOSED to `{}`** on any error AND before first resolve (40, 65, 74); returns `{ features, loading, refetch }` |
| `frontend/src/lib/nav-items.ts` | **30-59** | `NAV_ITEMS` — ✅ **no entry tagged `visual_workflow_canvas`** |
| `frontend/src/lib/nav-items.ts` | **71-73** | `visibleNavItems` — the VANISH convention: `filter(item => !item.feature \|\| features[item.feature] === true)` |
| `frontend/src/components/admin/FeatureVisibility.tsx` | **146-152** | The `visual_workflow_canvas` card row (`key`, `name`, `desc`, `livesOn: "Workflows"`, `glyph: Workflow`) |
| `frontend/src/components/admin/ControlRoomPage.tsx` | **196** | `visual_workflow_canvas: "off"` cold default |
| `backend/app/models/user_settings.py` | **1092** | `"visual_workflow_canvas": "off"` — the ONE authoritative cold default; no migration needed |

> **`useEffectiveFeatures` returns `loading`.** During the pre-resolve window `features` is `{}`, so
> the toggle correctly does not render. The planner should decide whether the toggle strip *appears*
> on resolve (a small layout shift in the graph-column header) or whether the header reserves space.
> Either is acceptable under D-183-03; a flash-then-vanish is not.

### The 181 acceptance gate — `frontend/src/components/admin/revertByteIdentical.test.tsx` (155 lines)

| Assertion | Line(s) | Status under D-183-01 |
|---|---|---|
| `visual_workflow_canvas:false` leaves `visibleNavItems` byte-identical | 43-50 | ✅ **keeps passing** (no nav entry added) |
| `visual_workflow_canvas:true` ALSO changes nothing | 52-60 | ✅ **keeps passing** |
| **scope-freeze**: no `NAV_ITEMS` entry tagged `visual_workflow_canvas` | **62-64** | ✅ **keeps passing — MUST NOT be deleted or weakened** |
| Off\|On two-radio control (not the triad) | 86-102 | ✅ untouched |
| Off checked at cold default / On writes `"everyone"` / Off writes `"off"` | 104-153 | ✅ untouched |

⚠ **Two stale prose comments** (assertions unaffected, but a future reader is misled):
- **Line 9**: *"(that entry lands WITH the view in 183)"* — released by D-183-01.
- **Line 58**: *"The canvas nav entry lands in 183 — until then, ON reveals nothing"* — no longer true.

⚠ **The deferred `ChatLayout` render-guard** described at **lines 16-20** (*"a stale canvas `activeView`
must return the fallback… It lands WITH the first canvas `ActiveView` render branch in Phase 182/183"*)
**does not apply under D-183-01** — there is no canvas `ActiveView`. Its 183 analogue is a *different*
assertion shape: with the flag off, the toggle strip is absent from the Builder DOM and no `.react-flow`
root exists. The planner should record this explicitly so a reviewer does not read it as an unmet
inherited obligation.

### Existing test guards the phase perturbs

| File:line | Guard | Impact |
|---|---|---|
| `PhaseSpine.test.tsx:104` | `expect(phaseSpineSource).not.toMatch(/const PHASE_GLYPHS/)` | ✅ verified exact. D-183-13 says extend the same guard to `PhaseSpineGraph` (which needs a `?raw` import — already present at `PhaseSpineGraph.test.tsx:18`). |
| `PhaseSpineGraph.test.tsx:94-96` | `within(gather).getByText("🤖")`, `within(emit).getByText("◆")` | ⛔ **These three assertions BREAK** when D-183-13 repoints onto the 3D marks. `PhaseSpine.test.tsx:38-39` documents the migration pattern verbatim: *"Migrated from literal unicode assertions to data-attribute hooks (durable after 3D swap)"* → assert `data-phase-type` instead. |
| `PhaseSpineGraph.test.tsx:158` | `expect(src).not.toMatch(/react-flow\|reactflow\|\bd3\b\|dagre/)` | ⚠ The regex **does not match `@xyflow/react`**. It stays green whether or not xyflow leaks into `PhaseSpineGraph.tsx`. Extend to `\|xyflow` to keep the guard meaningful. |
| `PhaseSpineGraph.test.tsx:110-112` | comment: *"resolves its target the parse_skip_target way (split on the last ':')"* | ⚠ False (C-1). The fixture `"skip_to_phase:human-confirm"` is single-colon so it passes under **both** semantics — the test cannot catch the divergence. |
| `soulData.test.ts:121-132` | `expect(PHASE_GLYPHS).toMatchObject({ programmatic: "⚙", … })` | ⛔ **Already RED at HEAD** — asserts the flat glyphs against the fluent-emoji slug map Phase 127 shipped. Pre-existing rot in exactly the territory D-183-13 touches; fix it in-phase (a one-line honest correction) or record it explicitly as accepted baseline rot. |

### Backend parse (read-only reference — no backend change in 183)

`backend/app/services/harness/reachability.py`:

| Symbol | Line(s) | CONTEXT claim | Verified? |
|---|---|---|---|
| `UNSATISFIABLE_SKIP` docstring | **9-10** | `:9` | ✅ |
| `LINT_CODES` frozenset | 54-62 | — | ✅ includes `"unsatisfiable_skip"` |
| `parse_skip_target` | **89-98** | `:89` | ✅ line exact — ⚠ **semantics differ from the CONTEXT description** (C-1) |
| `_skip_targets` collector | **101-108** | `:102` | ✅ (function opens at 101, body at 102) |
| `unsatisfiable_skip` emit | **147-156** | `:154` | ✅ (`LintError("unsatisfiable_skip", …)` at 152, message at 154) |
| **sequential-edge construction** | **162-169** | — | ⚠ **Critical — see C-2** |
| zero-phase → `no_terminal` | 118-120 | — | ✅ a definition with no phases is a **lint error** today |

`backend/app/models/harness.py`:

| Symbol | Line(s) | Content |
|---|---|---|
| `_StrictBase` | **30** | `model_config = ConfigDict(extra="forbid")` — the G-6 tripwire |
| `LlmEmitPhaseConfig` | **123** | the ONLY config class carrying `citation_policy` |
| `citation_policy` | **153** | `Literal["strict","flag","partial","draft"] = "strict"` |
| `ValidatorSpec.kind` | **178-183** | 9 kinds: `json_schema, regex_match, workspace_file_exists, programmatic, citations_required, freshness, structure_check, output_file_valid, llm_judge_rubric` |
| `ValidatorSpec.on_failure` | **184** | `str = "fail_run"` — **free-form string, not a Literal**; `# fail_run \| retry \| skip_to_phase:<slug> \| ask_user` |
| `PhaseSpec` | 189-194 | `slug, phase_index, config, validators=[], name: str \| None = None` |

---

## Corrections to CONTEXT.md and Prior Artifacts

CONTEXT's own anti-drift note asks for exactly this section: *"Treat in-code claims of prior extraction
as unverified — grep before believing."* Every item below was verified this session with the evidence
shown. **None of these overturn a locked decision** — they correct the *facts* those decisions cite.

### C-1 — ⛔ BLOCKING: `parse_skip_target` semantics diverge; D-183-15's case table is wrong

**Backend** (`reachability.py:89-98`) — splits on the **prefix length**:

```python
def parse_skip_target(on_failure: str) -> str | None:
    prefix = "skip_to_phase:"
    if isinstance(on_failure, str) and on_failure.startswith(prefix):
        target = on_failure[len(prefix):].strip()      # ← everything after the FIRST prefix
        return target or None
    return None
```

**Frontend** (`PhaseSpineGraph.tsx:78-83`) — splits on the **last colon**:

```ts
export function parseSkipTarget(onFailure: string | undefined | null): string | null {
  if (!onFailure || !onFailure.startsWith("skip_to_phase:")) return null
  const idx = onFailure.lastIndexOf(":")                // ← lastIndexOf, NOT prefix length
  const slug = onFailure.slice(idx + 1).trim()
  return slug.length > 0 ? slug : null
}
```

Divergence table (traced by hand against both implementations):

| Input | Backend returns | Frontend returns | Agree? |
|---|---|---|---|
| `"skip_to_phase:escalate"` | `"escalate"` | `"escalate"` | ✅ |
| `"skip_to_phase:  escalate  "` | `"escalate"` | `"escalate"` | ✅ |
| `"skip_to_phase:"` | `None` | `null` | ✅ |
| `"skip_to_phase"` (no colon) | `None` | `null` | ✅ |
| `"fail_run"` / `"ask_user"` / `"retry"` | `None` | `null` | ✅ |
| `"SKIP_TO_PHASE:x"` (case) | `None` | `null` | ✅ |
| `null` / `undefined` / `""` | `None` | `null` | ✅ |
| **`"skip_to_phase:a:b"`** | **`"a:b"`** | **`"b"`** | ⛔ **DIVERGE** |
| **`"skip_to_phase: a : b "`** | **`"a : b"`** | **`"b"`** | ⛔ **DIVERGE** |

The frontend docblock at `PhaseSpineGraph.tsx:74-76` explicitly asserts parity — *"mirroring the
backend `parse_skip_target` (reachability.py): split on the LAST ':'"* — and that false claim
propagated into `PhaseSpineGraph.test.tsx:110-111` and then verbatim into D-183-15's case table
(*"`"skip_to_phase:a:b"` → `b` (the `lastIndexOf(":")` split)"*).

**Why it matters even though slugs "shouldn't" contain colons:** `ValidatorSpec.on_failure` is a bare
`str` (`harness.py:184`), not a `Literal` — nothing validates the target's character set. A colon-bearing
value is accepted by Pydantic today. And Phase 184 round-trips edges *back* into a definition: if the
canvas resolves an edge to `b` and the engine resolves it to `a:b`, the canvas draws a flow the runtime
does not execute — a silent, structural lie.

**Planner action:**
1. Implement the shared `parseSkipTarget` with the **backend's** semantics
   (`onFailure.slice("skip_to_phase:".length).trim() || null`).
2. Correct the D-183-15 case table row to `"skip_to_phase:a:b"` → **`"a:b"`**, and add
   `"skip_to_phase: a : b "` → `"a : b"` as the second multi-colon case.
3. Delete the false parity comments at `PhaseSpineGraph.tsx:74-76` and `PhaseSpineGraph.test.tsx:110-111`.
4. Behaviour change to a shipped surface is **zero-risk in practice**: live `skip_to_phase` usage is
   **0** (verified — see §Live Corpus), so no rendered edge changes.

Confidence: **HIGH** — both implementations read in full this session.

### C-2 — ⛔ BLOCKING: the sequential edge must be a `phase_index + 1` LOOKUP, not sorted-array adjacency

`reachability.py:162-169`:

```python
adjacency: dict[str, set[str]] = {p.slug: set() for p in phases}
for p in phases:
    successor = by_index_value.get(p.phase_index + 1)   # ← INDEX LOOKUP
    if successor is not None:
        adjacency[p.slug].add(successor.slug)
    for target in _skip_targets(p):
        if target in by_slug:
            adjacency[p.slug].add(target)
```

with the comment at **159-161**: *"When indices are non-contiguous (a gap), the sequential walk CANNOT
bridge the gap → the phase after the gap is genuinely unreachable (an orphan)."*

`PhaseSpineGraph.tsx` does the opposite: it sorts (`:103`) then draws a gutter edge between **consecutive
array positions** (`:146-147`, `:158`). For `phase_index = [0, 1, 3]`:

| | Edges drawn |
|---|---|
| `reachability.py` adjacency | `0→1` only; phase `3` is an **ORPHAN** |
| naive sorted-array walk | `0→1`, `1→3` ← **a phantom edge** |

Pitfall 3 states the requirement directly: *"Nodes/edges the canvas shows are derived from `phases[]` +
the `phase_index` sequential edges + parsed `skip_to_phase:<slug>` edges (**exactly the edge set
`reachability.py` already builds — reuse that adjacency logic so the canvas and the linter agree on what
an edge IS**)"* (`.planning/research/PITFALLS.md:70`). And G-6 names it as a failure condition:
*"an edge to a node that exists (a phantom edge)"*.

`lint_workflow` rejects non-contiguous indices with `bad_index` (`:131-139`), so a *published*
definition cannot have a gap. But the Builder projects **unsaved drafts** and **draft rows** —
neither is lint-gated — and `plan_execute_verify`-style hand edits, the NL generator, and Phase 184's
delete-a-node are all gap-producers.

**Planner action:** `canvasModel.toCanvas` builds `bySlug` and `byIndexValue` maps and emits the
sequential edge as `byIndexValue.get(p.phase_index + 1)`, mirroring `reachability.py:164` line-for-line.
Add a fixture with `phase_index = [0, 1, 3]` and assert **exactly one** sequential edge plus an
orphan-marked node. This is the cheapest possible SC#4 "no phantom edge" proof.

Confidence: **HIGH** — both implementations read in full.

### C-3 — Live-corpus counts in CONTEXT and sketches 134-136 do not reproduce

Read live 2026-07-25 via `psycopg2` against `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
(superuser, RLS-bypassing — sees every org).

| Metric | CONTEXT / sketch claim | Live read 2026-07-25 | Verdict |
|---|---|---|---|
| `workflow_definitions` rows | 95 | **95** | ✅ agrees |
| total phases across definitions | 119 | **51** | ⛔ diverges |
| zero-phase definitions | 40 of 95 | **71 of 95** (27 draft + 44 published) | ⛔ diverges — **and the decision gets stronger** |
| modal non-empty definition | 2 phases | **2 phases** (15 definitions) | ✅ agrees |
| `eval_coverage` is a 5-phase definition | yes | **yes — and the ONLY one ≥5** | ✅ |
| "**both** 5-phase maxima" | two | **one** | ⛔ diverges (see C-4) |
| phases carrying a real `phase.name` | 10 of 119 | **0 of 51** | ⛔ diverges — **decision gets stronger** |
| `skip_to_phase` occurrences | **0** | **0** | ✅ **agrees — the load-bearing finding holds** |
| `on_failure: fail_run` | ×45 | **×15** | ⛔ diverges |
| `on_failure: ask_user` | ×2 | **×1** | ⛔ diverges |
| phase-type histogram | — | `llm_agent` 23 · `llm_single` 13 · `llm_emit` 8 · `llm_human_input` 3 · `programmatic` 2 · `llm_batch_agents` 2 | new |

Phase-count histogram: `{0: 71, 1: 4, 2: 15, 3: 4, 5: 1}` — 24 non-empty definitions total.

**Interpretation.** Every *direction* holds; several strengthen. The empty projection is **75%** of the
corpus, not 42% — D-183-11 is even more load-bearing than CONTEXT argues. Named phases are **absent
entirely**, not merely rare — D-183-06's fallback is the *only* case, not the dominant one. And
`skip_to_phase = 0` — D-183-09's entire justification — reproduces exactly.

**The actionable conclusion is about method, not numbers:** two reads on the *same day* disagree, so the
live database is not a reproducible fixture source. See §Fixture Corpus — transcribe from the checked-in
migrations.

Confidence: **HIGH** on my read (single query, reproducible command recorded); **the source of the
divergence is UNKNOWN** — possibly a cloud-vs-local read, an RLS-scoped client, or intervening deletes.

### C-4 — There is only ONE 5-phase definition, and `dba-research…` now has zero phases

Sketch 136's Grounding section names *"both 5-phase maxima (`eval_coverage`, `dba-research…`)"*.
Live read: `dba-research-stat-summary-docx-23c55e77` is a **draft with 0 phases**. `eval_coverage`
(published, 5 phases) is the only definition with ≥5 phases in the entire table.

`eval_coverage` (migration `supabase/migrations/066_eval_coverage_seed.sql:64`), read live:

| idx | slug | phase_type | name | citation_policy | validators |
|---|---|---|---|---|---|
| 0 | `split` | `programmatic` | — | — | none |
| 1 | `fanout` | `llm_batch_agents` | — | — | none |
| 2 | `deep_dive` | `llm_agent` | — | — | none |
| 3 | `confirm` | `llm_human_input` | — | — | none |
| 4 | `summarize` | `llm_single` | — | — | none |

**Planner action:** amend D-183-09's fixture list from "both 5-phase maxima" to "the single 5-phase
maximum (`eval_coverage`)". U-2's UAT scenario is unaffected — it already names `eval_coverage`
specifically. Note `eval_coverage` has **zero named phases and zero validators**, so it exercises the
plain-language fallback (D-183-06) on all five step types and the "no grounding gate" badge state
(D-183-07) — it is the single most valuable UAT fixture in the corpus.

### C-5 — `@xyflow/react` bundles its OWN zustand v4; STACK.md's "same store" claim is wrong

`.planning/research/STACK.md:137` states: *"React Flow uses zustand internally; no version conflict.
Coherent with the app's existing store."* And STACK.md:13 calls it *"the exact store the app already
ships (`zustand@5.0.13`)"*.

Registry truth: `npm view @xyflow/react dependencies` → `{ classcat: "^5.0.3", zustand: "^4.4.0",
"@xyflow/system": "0.0.79" }`. The app has `zustand@^5.0.13` (`frontend/package.json:48`). `^4.4.0`
excludes 5.x, so npm installs a **second, nested zustand v4** under `node_modules/@xyflow/react/`.

**Consequences:**
- **Not a breakage for 183.** xyflow's store is fully internal and never shared; the app's own zustand
  stores are untouched. Two copies coexist safely.
- **Bundle:** ~4 KB of duplicated zustand (bundlephobia lists `zustand` at ~4,144 B within the xyflow
  dependency tree). Included in the 58.75 KB gzip figure.
- **Forward warning for Phase 184:** `zundo` is a *zustand middleware*. It **cannot** be applied to
  xyflow's internal store (different zustand instance, and the store is not exported). Phase 184's
  undo/redo must wrap an *app-owned* store holding the canvas model, with xyflow driven as a
  controlled component. STACK.md:39 implies a glove fit; it is not one.

**Planner action:** record the correction (this section is sufficient) and do **not** attempt to share
a store with xyflow in 183. No task change otherwise.

Confidence: **HIGH** — direct registry read.

### C-6 — "the 3 PM-pack starters" are the Starter Library (migration 094), not the PM pack

Two distinct artifacts have been conflated across CONTEXT and the sketches:

| Artifact | Where | Slugs | Count | Shape |
|---|---|---|---|---|
| **PM pack** (operator-private, opt-in script) | `scripts/seed-pm-pack.py:106,111,405,433` | `pm-weekly-status-report`, `pm-risk-register` | **2** | `llm_agent`(search_documents) → `llm_emit`(render_template) |
| **Starter Workflow Library** (Phase 143 / WF-01) | `supabase/migrations/094_starter_workflows.sql:9-11` | `risk-register`, `weekly-status-report`, `compliance-gap-report` | **3** | same 2-phase shape, `definition.category = 'starter'` |

`backend/tests/integration/test_seed_pm_pack.py:47` pins `PM_SLUGS = ("pm-weekly-status-report",
"pm-risk-register")` and asserts *"exactly 2 PM def rows"*. Sketch 136's Grounding section calls
`risk-register / weekly-status-report / compliance-gap-report` "the 3 PM-pack starters" — those are
migration 094's Starter Library rows. Sketch 137 calls `risk-register` "the PM-pack starter".

All five rows are the **same 2-phase topology**, so the projection coverage is identical either way —
this is a naming correction, not a coverage gap. But the planner must point tasks at the right file.

Live-verified shapes (`risk-register` and `pm-risk-register` are byte-identical in topology):

| idx | slug | phase_type | citation_policy | validators |
|---|---|---|---|---|
| 0 | `retrieve` | `llm_agent` | — | none |
| 1 | `emit` | `llm_emit` | **`strict`** | `citations_required` → `fail_run`; `output_file_valid` → `fail_run` |

This is the **only** shape in the whole corpus that exercises the D-183-07 "Must cite its sources"
grounding badge — it hits **both** derivation inputs (`citation_policy: strict` AND a
`citations_required` gate).

### C-7 — `PhaseSpineGraph.tsx` is KEPT, never deleted (accessibility contract)

`.planning/sketches/MANIFEST.md:552` states: *"The shipped `PhaseSpineGraph` is **kept** as the
keyboard/screen-reader fallback, never deleted."*

This is a locked constraint not restated in CONTEXT's `<decisions>`. It reinforces D-183-01/02 (Spine
stays the default, both views coexist) and it means the canvas's own keyboard story is allowed to be
*good* rather than *the only* accessible path — but the Spine must keep working, which is exactly what
D-183-13's repoint puts at risk if `PhaseSpineGraph`'s tests are weakened rather than migrated.

### C-8 — `citation_policy` exists ONLY on `llm_emit` configs

`backend/app/models/harness.py:123,153` — `citation_policy` is a field of `LlmEmitPhaseConfig` and of
no other config class. `soulData.ts:89-90` reads it only from `phase_type === "llm_emit"`.
`deriveTier.ts:20` documents the same (*"citation_policy: harness.py `LlmEmitPhaseConfig.citation_policy`"*).

**Bearing on D-183-07.** For 5 of the 6 phase types the grounding derivation has **only one** input —
the presence of a `citations_required` validator. Verified against the live corpus: `citations_required`
appears **only** on `llm_emit` phases. Therefore, with today's data, the "Must cite its sources" badge
renders on `llm_emit` nodes and nowhere else; every `llm_agent` / `llm_single` / `programmatic` /
`llm_batch_agents` / `llm_human_input` node shows the "No sources needed" state.

This is **honest and correct** — it is exactly the white-space Phase 185's authored `grounding_mode`
fills — but the planner should expect the UAT screenshot to show one grounded node per workflow at most,
and should not treat a uniformly-open row of agent nodes as a derivation bug. Sketch 135's
`ground` rule is reproduced faithfully: `strict` = `citation_policy: strict` **or** a `citations_required`
gate; `flag` = `citation_policy: flag`; `open` = neither.

Also note: `deriveTier.ts:28-33` narrows `ValidatorKind` to **5** kinds; the backend
(`harness.py:178-183`) has **9**. `soulData.ts:54-60` filters unknown kinds out. A canvas gate-chip
render must be total over all 9 (or explicitly ignore the 4 extras), not crash on `regex_match` —
which is exactly what `plan_execute_verify` carries (`conftest.py:885-889`).

### C-9 — zero-phase definitions are a **lint error** today

`reachability.py:118-120`: a definition with no phases emits `LintError("no_terminal", None,
"definition has no phases")` and returns immediately. 71 of 95 live rows are in that state.

183 does not call `/validate`, so this has no runtime effect on the phase. It is recorded because
(a) it confirms the empty state is a genuinely common, genuinely unfinished condition — supporting
D-183-11's "No steps yet" copy over anything implying validity — and (b) Phase 184, which *does* wire
`/validate`, will surface a `no_terminal` verdict on three-quarters of the corpus the moment it opens
one. Worth a `<deferred>` note for 184's discuss pass.

---

## Live Corpus (read 2026-07-25)

Reproducible command:

```bash
cd "C:/Vibe Apps/Agentic RAG/backend" && ./venv/Scripts/python.exe -c "
import psycopg2
c = psycopg2.connect('postgresql://postgres:postgres@127.0.0.1:54322/postgres', connect_timeout=3)
cur = c.cursor()
cur.execute(\"select slug, version, status, jsonb_array_length(coalesce(definition->'phases','[]'::jsonb)) n \
             from workflow_definitions order by n desc, slug\")
for r in cur.fetchall(): print(r)
"
```

All 24 non-empty definitions:

| n | slugs |
|---|---|
| **5** | `eval_coverage` |
| **3** | `doc_qa_human`, `doc_qa_scoped_098uat`, `literature_review`, `plan_execute_verify` |
| **2** | `compliance-gap-report`, `ephemeral-template-fill-101uat`, `meridian-risk-summary-bad-b01f6db0`, `meridian-risk-summary-bad-nv-6f171475`, `meridian-risk-summary-good-07aedc33`, `meridian-risk-summary-good-39762ae3`, `meridian-risk-summary-good-58b60ed3`, `meridian-risk-summary-good-cc99c1b7`, `multitool-risk-fill-db50b21c`, `pm-risk-register`, `pm-weekly-status-report`, `research_summarize`, `risk-register`, `risk-register-fill-101uat`, `weekly-status-report` |
| **1** | `fresh-pause-102uat-20a89243`, `multitool_scope_098uat`, `readonly_refusal_098uat`, `skill_compose_099uat` |
| **0** | 71 rows |

---

## Fixture Corpus for SC#4 (D-183-09)

**Recommendation: transcribe from checked-in artifacts, never from a live DB read.** Per C-3, two reads
on the same day disagree; per C-4, a definition that was 5-phase at sketch time is 0-phase now. A
snapshot test whose input drifts is not a gate.

### Where each shape actually lives

| Fixture | Authoritative source (checked in) | Shape |
|---|---|---|
| **4 canonical seeds** | `supabase/migrations/061_harness_seed_templates.sql:48-236` (the shipped JSONB) — Python mirror at `backend/tests/conftest.py:838-936` (`_four_seed_defs`, docstring at 838 declares it *"SINGLE SOURCE OF TRUTH for the definition JSONB shipped as migration 061"*) | `research_summarize` (2: `llm_agent`→`llm_single`) · `plan_execute_verify` (3: `llm_single`→`llm_agent`→`llm_single` + `regex_match`/`retry` gate) · `literature_review` (3: `programmatic`→`llm_batch_agents`→`llm_single`) · `doc_qa_human` (3: `llm_agent`→`llm_human_input`→`llm_single`). Union = all 5 non-emit phase types. |
| **Starter Library ×3** ("the 3 PM-pack starters", C-6) | `supabase/migrations/094_starter_workflows.sql:9-11` | `risk-register` · `weekly-status-report` · `compliance-gap-report` — each 2-phase `llm_agent`(search_documents)→`llm_emit`(render_template), emit carrying `citation_policy: strict` + `citations_required`(fail_run) + `output_file_valid`(fail_run) (:30-32) |
| **PM pack ×2** (the operator-private originals) | `scripts/seed-pm-pack.py:106,111,405,433`; phase shape at `:358,369` | `pm-weekly-status-report` · `pm-risk-register` — topologically identical to the Starter Library rows |
| **5-phase maximum ×1** (C-4) | `supabase/migrations/066_eval_coverage_seed.sql:64-…` | `eval_coverage` — `programmatic`→`llm_batch_agents`→`llm_agent`→`llm_human_input`→`llm_single`, zero names, zero validators |
| **empty draft** | synthesise: `{ phases: [] }` | D-183-11 |
| **synthetic branching** | hand-authored **in the test file only** | `gather → assess ⇢(on fail) escalate`, skipping `draft` (sketch 136). **No DB row, no starter ships.** |
| **unresolvable skip** (D-183-10) | hand-authored | a validator with `on_failure: "skip_to_phase:nonexistent"` → the honest broken-reference stub |
| **non-contiguous index** (C-2) | hand-authored | `phase_index = [0, 1, 3]` → exactly one sequential edge, no phantom |
| **multi-colon parse cases** (C-1) | hand-authored | the 9-row divergence table above |

### Coverage check against SC#4

Union of phase types across the fixture set: `programmatic` ✅ · `llm_single` ✅ · `llm_agent` ✅ ·
`llm_batch_agents` ✅ · `llm_human_input` ✅ · `llm_emit` ✅ — **all six**. Node counts 0/1?/2/3/5 ✅.
Both grounding states ✅. `llm_batch_agents` present in two fixtures, so the "renders as ONE node,
never N fan-out lanes" assertion (G-6) has two witnesses.

> **Add a 1-phase fixture.** The live corpus has 4 single-phase definitions and the layout maths
> (edge-anchor offset, `○ end` cap with no preceding edge, `fitView` on a single node) has its own
> degenerate case there. It is not in D-183-09's list but it is cheap and it is real data.

### Transcription discipline

The 4 canonical seeds exist in Python (`conftest.py`) and SQL (mig 061) but **nowhere in TypeScript**.
The frontend fixture must be hand-transcribed. Recommend a single `canvasFixtures.ts` holding the
definition objects, plus a comment on each naming its source file:line, so a future reader can re-verify
without a database. If the planner wants a machine check, a small test asserting the TS fixture's
`(slug, phase_index, phase_type)` triples match the SQL is possible — but it would need to parse SQL,
which is more machinery than the risk justifies. A source-citing comment is the right cost.

---

## Architecture Patterns

### System Architecture Diagram

```
                     ┌─────────────────────────────────────────────┐
   user opens a      │  WorkflowBuilderPage  (state: "drafted")    │
   draft workflow ──▶│  BuilderDefinition.phases: PhaseSpecJSON[]  │
                     └───────────────┬─────────────────────────────┘
                                     │
                    useEffectiveFeatures(userId)  ──▶ features.visual_workflow_canvas
                                     │                        │
                     ┌───────────────┴──────────┐             │
                     │  flag === true ?         │◀────────────┘   (fails CLOSED to {} —
                     └────┬────────────────┬────┘                  pre-resolve AND on error)
                          │ NO             │ YES
                          ▼                ▼
              ┌────────────────┐   ┌───────────────────────────────┐
              │ (nothing)      │   │ [≣ Spine] [⬡ Canvas] strip    │  session useState
              │ toggle absent  │   │  default = "spine" (D-183-02) │  no persistence
              │ NO .react-flow │   └────┬──────────────────┬───────┘
              └────────────────┘        │ spine            │ canvas
                                        ▼                  ▼
                          ┌──────────────────┐   ┌──────────────────────────────┐
                          │ PhaseSpineGraph  │   │ canvasModel.toCanvas(def)    │
                          │ (shipped, KEPT   │   │  PURE · no DOM · no network  │
                          │  as a11y fallbk) │   │  ┌────────────────────────┐  │
                          └────────┬─────────┘   │  │ sort by phase_index    │  │
                                   │             │  │ byIndexValue map       │  │
                                   │             │  │ seq edge = idx+1 LOOKUP│  │◀── C-2
                                   │             │  │ skip edge = parseSkip  │  │◀── C-1
                                   │             │  │ unresolved → stub node │  │◀── D-183-10
                                   │             │  │ fixed-pitch x, lane y  │  │
                                   │             │  └───────────┬────────────┘  │
                                   │             │              │ {nodes,edges} │
                                   │             │    phases===0 ?              │
                                   │             │      ├─ YES ─▶ EmptyState    │  ← NO <ReactFlow>
                                   │             │      │         (no plane,    │     mounted at all
                                   │             │      │          no grid,     │     (D-183-11)
                                   │             │      │          no controls, │
                                   │             │      │          no minimap)  │
                                   │             │      └─ NO  ─▶               │
                                   │             │        ┌──────────────────┐  │
                                   │             │        │ <ReactFlow>      │  │
                                   │             │        │  READ-ONLY props │  │
                                   │             │        │  nodeTypes:      │  │
                                   │             │        │   { phase: … }   │  │
                                   │             │        │  <Background>    │  │
                                   │             │        │  <Controls       │  │
                                   │             │        │   showInteractive│  │
                                   │             │        │   ={false}/>     │  │◀── Pitfall 1
                                   │             │        └────────┬─────────┘  │
                                   │             │                 │ PhaseNode  │
                                   │             │        ┌────────▼─────────┐  │
                                   │             │        │ 3D glyph (float) │  │
                                   │             │        │ plain-lang title │  │
                                   │             │        │ ≤2 word badges   │  │
                                   │             │        │ <Handle> ×2      │  │
                                   │             │        └────────┬─────────┘  │
                                   │             └─────────────────┼────────────┘
                                   │                               │
                                   │  onSelectNode(slug)           │ onNodeClick(_, node)
                                   └───────────────┬───────────────┘ → node.id === phase.slug
                                                   ▼
                                    setSelectedSlug(slug === cur ? null : slug)
                                                   │
                                                   ▼
                                    ┌──────────────────────────────┐
                                    │ PhaseFormPanel (400px push)  │  ← shipped, verbatim reuse
                                    │ panelOpen = selectedSlug!==null│    (D-183-05)
                                    └──────────────────────────────┘

  ✗ NO network call anywhere on this path.  ✗ NO write to workflow_definitions.
  ✗ NO position/x/y/layout key ever leaves the client.
```

### Recommended Project Structure

```
frontend/src/components/workflows/
├── phaseVocabulary.ts        # NEW — the ONE shared module (D-183-13):
│                             #   parseSkipTarget (backend semantics, C-1)
│                             #   PHASE_TYPE_SENTENCES  (plain-language, D-183-06)
│                             #   nodeTitle(phase)      (name ?? sentence)
│                             #   PHASE_TYPE_LABELS     (⌥ Technical names, D-183-08)
│                             #   PhaseSpecJSON / PhaseConfigJSON / ValidatorJSON (moved)
│                             #   groundingFor(phase)   (D-183-07 derivation)
│                             # re-exports soulData.PHASE_GLYPHS — does NOT re-declare it
├── canvasModel.ts            # NEW — toCanvas(definition) → { nodes, edges }. PURE.
├── WorkflowCanvas.tsx        # NEW — <ReactFlow> wrapper + empty state + chrome
├── PhaseNode.tsx             # NEW — the custom node (nodeTypes value)
├── canvasFixtures.ts         # NEW (test-only) — the D-183-09 corpus, each entry citing its source
├── PhaseSpineGraph.tsx       # REPOINTED — local map + parse + types deleted; re-exports types
├── soulData.ts               # unchanged (already the glyph source of truth)
├── PhaseSpine.tsx            # unchanged
├── PhaseFormPanel.tsx        # unchanged (its :39 import must keep resolving)
└── deriveTier.ts             # unchanged
```

> **Module-home recommendation (Claude's discretion in CONTEXT):** a **separate `phaseVocabulary.ts`**,
> not a fold into `soulData.ts`. Reasons: (a) `soulData.ts`'s docblock scopes it to *"the workflow
> 'soul' data… the three soul sizes"* — parse/title/grounding are a different concern; (b) it already
> carries a demonstrably-stale claim about owning the glyph map (C-3/D-183-13), so growing it invites
> the same drift; (c) the existing split (`soulData` / `deriveTier` / `phaseGlyph`) is one-file-per-concern
> and a fourth file matches it; (d) a separate file makes `PhaseSpine.test.tsx:104`'s
> `not.toMatch(/const PHASE_GLYPHS/)` guard trivially extensible to three files.

### Pattern 1 — The read-only `<ReactFlow>` prop set

**What:** Every xyflow interaction flag defaults to `true`. Read-only is opt-out, not opt-in.

**Verified defaults** (from `packages/react/src/store/initialState.ts` and
`packages/react/src/container/ReactFlow/index.tsx` on `main`):

| Prop | Default | Set to (183) | Why |
|---|---|---|---|
| `nodesDraggable` | **`true`** | `false` | SC#3 "nodes not draggable" |
| `nodesConnectable` | **`true`** | `false` | No authoring in 183 |
| `edgesReconnectable` | **`true`** | `false` | No authoring in 183 |
| `connectOnClick` | **`true`** | `false` | A click must only select |
| `elementsSelectable` | **`true`** | keep `true` | Enables the built-in Enter/Space selection; `onNodeClick` fires either way (Pattern 2) |
| `nodesFocusable` | **`true`** | keep `true` | ⚠ `false` removes `tabIndex` entirely — see Pattern 3 |
| `edgesFocusable` | **`true`** | `false` | An edge is not a target in 183; halves the tab stops |
| `deleteKeyCode` | **`'Backspace'`** | `null` | Backspace on a focused node would fire a delete intent |
| `panOnDrag` | **`true`** | keep `true` | Sketch 134-C's cursor contract: *the plane pans, nodes don't move* |
| `zoomOnScroll` | **`true`** | Claude's discretion | `preventScrolling` (default `true`) means the page won't scroll behind it |
| `zoomOnDoubleClick` | **`true`** | consider `false` | A double-click on a node is a plausible mis-click |
| `minZoom` / `maxZoom` | **`0.5` / `2`** | see Pitfall 5 | A 1,600px 5-phase flow in a ~900px column needs ~0.55× — inside the floor but tight |
| `onlyRenderVisibleElements` | **`false`** | leave `false` | Max 5 nodes. STRETCH Phase 191 territory. |
| `disableKeyboardA11y` | **`false`** | leave `false` | Keeps Tab/Enter/Escape working |
| `elevateNodesOnSelect` | **`true`** | leave | z-index only |
| `nodeOrigin` | `[0, 0]` (top-left) | leave | Makes the fixed-offset edge anchor arithmetic trivial |
| `colorMode` | **`'light'`** | see Pitfall 6 | Deep Midnight needs `'dark'` or a full CSS-var override |

[VERIFIED: github.com/xyflow/xyflow — `packages/react/src/store/initialState.ts`,
`packages/react/src/container/ReactFlow/index.tsx`]

### Pattern 2 — `onNodeClick` fires regardless of `elementsSelectable`

From `packages/react/src/components/NodeWrapper/index.tsx`:

```js
const onSelectNodeHandler = (event) => {
  const { selectNodesOnDrag, nodeDragThreshold } = store.getState();
  if (isSelectable && (!selectNodesOnDrag || !isDraggable || nodeDragThreshold > 0)) {
    handleNodeClick({ id, store, nodeRef });     // internal selection state
  }
  if (onClick) {
    onClick(event, { ...internals.userNode });   // ← YOUR onNodeClick — OUTSIDE the guard
  }
};
```

`isSelectable = !!(node.selectable || (elementsSelectable && typeof node.selectable === 'undefined'))`.

**Implication:** D-183-05 works under any `elementsSelectable` value — the callback is unconditional.
Use `onNodeClick={(_, node) => onSelectNode(node.id)}` and let `node.id === phase.slug` carry SC#3.
Keeping `elementsSelectable={true}` is still recommended because it drives the built-in
Enter/Space-to-select keyboard path and the `.selected` class the visual selection ring can hang off.

[VERIFIED: github.com/xyflow/xyflow — `packages/react/src/components/NodeWrapper/index.tsx`]

### Pattern 3 — Keyboard reachability: pick exactly ONE tab stop per node

From the same source:

```jsx
onKeyDown={isFocusable ? onKeyDown : undefined}
tabIndex={isFocusable ? 0 : undefined}
onFocus={isFocusable ? onFocus : undefined}
role={node.ariaRole ?? (isFocusable ? 'group' : undefined)}
aria-describedby={disableKeyboardA11y ? undefined : `${ARIA_NODE_DESC_KEY}-${rfId}`}
```

with `isFocusable = !!(node.focusable || (nodesFocusable && typeof node.focusable === 'undefined'))`.

What xyflow gives free (official accessibility docs): Tab moves focus through focusable nodes/edges;
Enter/Space selects the focused element; Escape clears selection; focusing a node auto-pans it into
view; a `role` and an `aria-describedby` live-region hook are applied. Arrow-key node *movement* only
happens when **both** `nodesDraggable` and `nodesFocusable` are true — with `nodesDraggable={false}` it
is already off, so `disableKeyboardA11y` can stay `false` and keep Tab/Enter working.

What the phase must add: `node.ariaLabel` (xyflow supplies no meaningful label), a visible focus ring
(the CSS is yours), and a decision on where the tab stop lives.

**Two valid designs — choose one, never both:**

| | Option A — wrapper is the control | Option B — inner `<button>` |
|---|---|---|
| Config | `nodesFocusable={true}`, node `ariaRole: "button"`, node `ariaLabel: "…"` | `nodesFocusable={false}`, a real `<button>` inside `PhaseNode` |
| Tab stops per node | 1 | 1 |
| Enter/Space | xyflow built-in | native button |
| Matches `PhaseSpineGraph`? | no (`div[role=button]`) | **yes** — `PhaseSpineGraph.tsx:181-196` uses a real `<button aria-pressed>` |
| Test query | `getByRole("button", { name })` works for both | ditto |

**Recommendation: Option A.** It keeps xyflow's focus auto-panning (a node scrolled off a 1,600px plane
still comes into view on Tab), uses the v12-native `ariaRole`/`ariaLabel`/`domAttributes` node fields
rather than fighting the wrapper, and leaves `PhaseNode` free of interactive elements — which matters
in Phase 184 when config controls land *inside* the node. The official docs support this:
*"Custom interactive elements within nodes need appropriate ARIA roles applied directly to those
elements, not the node wrapper."*

⛔ **Do not do both.** `nodesFocusable={true}` **plus** an inner `<button>` produces two tab stops per
node — 10 tab presses to traverse `eval_coverage`, and a screen reader announcing each step twice.

[VERIFIED: reactflow.dev/learn/advanced-use/accessibility + xyflow `NodeWrapper` source]

### Pattern 4 — `nodeTypes` must be module-level

```ts
// module scope — NEVER inside the component
const nodeTypes = { phase: PhaseNode } as const
const edgeTypes = { flow: FlowEdge, skip: SkipEdge } as const
```

React Flow emits *"It looks like you have created a new nodeTypes or edgeTypes object"* and re-renders
every node on each parent render otherwise. Documented fix: define outside the component or `useMemo`.
[CITED: reactflow.dev/learn/troubleshooting/common-errors · reactflow.dev/learn/customization/custom-nodes]

### Pattern 5 — The empty state does not mount `<ReactFlow>` at all

D-183-11 requires the plane, grid, zoom controls and minimap all suppressed. The cleanest implementation
is a branch **above** `<ReactFlow>`:

```tsx
if (nodes.length === 0) {
  return <CanvasEmptyState />          // one honest line, plain surface
}
return <div style={{ height: "100%" }}><ReactFlow …/></div>
```

Three wins: (a) it makes the suppression structural rather than five separate `false` props; (b) it
sidesteps the *"parent container needs a width and a height"* warning path entirely for the 75%-of-corpus
case; (c) the D-183-11 test is a one-liner — `expect(container.querySelector(".react-flow")).toBeNull()`
— which is also **exactly the D-183-03 flag-off assertion**, so one helper serves both.

### Anti-Patterns to Avoid

- **Sorting the array and drawing `i→i+1` across it.** Produces a phantom edge on non-contiguous
  `phase_index`. Use the `phase_index + 1` lookup (C-2).
- **Copying a v11 (`reactflow`) recipe.** Most blog content predates the rename. In v11 the default
  export was the component (`import ReactFlow from 'reactflow'`); v12 is a **named** export from
  `@xyflow/react`, `node.parentNode` → `node.parentId`, `xPos`/`yPos` → `positionAbsoluteX`/`positionAbsoluteY`,
  measured size moved to `node.measured.{width,height}`, and `nodeInternals` → `nodeLookup`.
  [CITED: reactflow.dev/learn/troubleshooting/migrate-to-v12]
- **Rendering `<Controls>` with defaults.** See Pitfall 1 — it ships a lock button that re-enables dragging.
- **Reading DOM heights to compute layout.** D-183-12 forbids it; solve tall gate-heavy cards with a
  fixed node width + a fixed edge-anchor offset from the node top (Handles positioned with CSS `top`,
  not `50%`), so a taller card never moves the edge baseline.
- **Drawing `llm_batch_agents` as N lanes.** Fan-out is runtime, not topology; `reachability.py`'s
  adjacency has one successor. G-6 names this as a failure.
- **Persisting the view preference.** D-183-02 — session state only.
- **A ghost/placeholder first node in the empty state.** D-183-11 — implies an affordance that does not exist.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Node canvas: pan, zoom, viewport transform, edge path geometry, marker defs | A CSS/SVG graph from scratch | `@xyflow/react` | CANVAS-01 names it. Bezier/smoothstep path maths, viewport transform composition, and pointer-capture panning are each a day of subtle bugs. |
| Phase-type → 3D icon | A new icon map | `phaseGlyph()` + `soulData.PHASE_GLYPHS` | Already shipped and already consumed by `PhaseSpine.tsx:88`. A third copy is a named G-6 failure. |
| Node detail / config panel | A canvas-specific inspector | `PhaseFormPanel` via the `selectedSlug` contract | D-183-05 — verbatim reuse, zero net-new panel work. `WorkflowBuilderPage.tsx:131,136,456-463` already wire it. |
| `skip_to_phase` parsing | A regex | Port `reachability.py:89-98` **exactly**, pinned by the parity test | C-1 — the existing "port" already drifted. |
| Grounding / strictness derivation | New logic | `deriveTier` / `soulData` inputs (`citation_policy` + validator kinds) | D-183-07 explicitly derives from existing fields; Phase 185 replaces the derivation with an authored field. |
| Feature-flag gating | A new hook | `useEffectiveFeatures` | Shipped, fail-closed, per-user keyed. 183 consumes it. |
| Auto-layout | dagre/elk integration | Fixed-pitch pure function | D-183-12; `elkjs` deferred to Phase 191. |
| jsdom canvas measurement shims | Bespoke mocks | The **official** `mockReactFlow()` recipe (§Testing) | xyflow publishes the exact four mocks; a partial hand-rolled version fails in confusing ways. |

**Key insight:** this phase's only genuinely new code is a ~60-line pure function and a presentational
component. Every other need already has a shipped, tested home in this repo. The failure mode is not
"too little library" — it is re-implementing `parseSkipTarget` / the glyph map / the panel for a third
time, which is what G-5 and G-6 both explicitly forbid.

---

## Common Pitfalls

### Pitfall 1 — ⛔ `<Controls>` ships a lock button that RE-ENABLES dragging

**What goes wrong:** `<Controls />` renders four buttons by default; the fourth is an interactivity lock.
Clicking it on a read-only canvas turns dragging and connecting back **on**, silently defeating SC#3.

**Evidence** — `packages/react/src/additional-components/Controls/Controls.tsx`:

```js
// showZoom = true, showFitView = true, showInteractive = true   ← all default ON
const isInteractive = s.nodesDraggable || s.nodesConnectable || s.elementsSelectable;

const onToggleInteractivity = () => {
  store.setState({
    nodesDraggable:     !isInteractive,
    nodesConnectable:   !isInteractive,
    elementsSelectable: !isInteractive,
  });
};
```

With the 183 prop set, `nodesDraggable=false` and `nodesConnectable=false` but `elementsSelectable=true`
→ `isInteractive === true` → **one click sets all three to `false`** (selection dies, and D-183-05's
click contract still works because `onNodeClick` is unconditional). Click **again**: `isInteractive`
is now `false` → all three flip to **`true`** → **nodes become draggable and connectable**. Two clicks
from a shipped read-only canvas to a broken one.

**How to avoid:** `<Controls showInteractive={false} />`. Add a DOM assertion that no
`.react-flow__controls-interactive` button exists.

**Warning signs:** a padlock icon in the control cluster; a user reporting they "unlocked" the canvas.

Confidence: **HIGH** — source read this session.

### Pitfall 2 — ⛔ The stylesheet import is mandatory and easy to put in the wrong file

Without `import '@xyflow/react/dist/style.css'` the canvas renders as unpositioned stacked divs. React
Flow detects it and warns *"It seems that you haven't loaded the styles."*

**How to avoid:** import once, in `frontend/src/index.css` (or the app entry), not in a component file.
The official guidance is explicit: *"you should always import the styles in your `global.css` file (or
`index.css` file)"* and *"against importing styles in `App.tsx` or dependent files."* Note the package's
`hasSideEffects: ["*.css"]` — the CSS will not be tree-shaken away, but it also will not be
code-split with a `React.lazy` component. **If the canvas is lazy-loaded, the stylesheet still loads
eagerly from `index.css`** — that is the correct trade (the CSS is small; the 59 KB JS is the part
worth deferring). Alternatively import the CSS *inside* the lazily-imported module to defer both;
verify the Deep-Midnight overrides still win the cascade if you do.

[CITED: reactflow.dev/learn/getting-started/installation-and-requirements ·
reactflow.dev/learn/troubleshooting/common-errors]

### Pitfall 3 — The parent container MUST have an explicit width and height

*"The `<ReactFlow />` component must have a parent element with a width and height."* Otherwise React
Flow logs *"The React Flow parent container needs a width and a height to render the graph."*

The Builder grid child at `WorkflowBuilderPage.tsx:445-450` is `min-h-0 min-w-0 flex-1 overflow-hidden`
with `gridTemplateColumns` — the graph column gets a computed width from the grid, but the canvas
wrapper needs an explicit `h-full` (and the grid needs a bounded height, which `min-h-0 flex-1` on the
`<div>` provides). Verify in the browser, not only in jsdom (where dimensions are mocked anyway).

[CITED: reactflow.dev/learn/troubleshooting/common-errors]

### Pitfall 4 — A custom node without `<Handle>` may render no edges

Custom nodes replace the default node entirely, including its handles. The official custom-node guide
says: *"To enable your custom node to connect with other nodes, check out the Handles page to learn how
to add source and target handles"*, and the Handle reference describes it as *"used in your custom nodes
to define connection points."*

**How to avoid:** render `<Handle type="target" position={Position.Left} />` and
`<Handle type="source" position={Position.Right} />` in `PhaseNode`. With `nodesConnectable={false}`
they are non-interactive; hide them visually (`opacity: 0` / `!w-0 !h-0 !border-0`) per sketch 134's
finding that visible connection handles read as a broken editor. **Position them with CSS `top: <offset>`
rather than the default `50%`** — that is exactly D-183-12's "edges anchor to a fixed offset from the
node top" requirement, and it makes a gate-heavy tall card leave the edge baseline unmoved.

Confidence: **MEDIUM** — the docs assert handles define connection points but do not state the
"no handle ⇒ no edge rendered" consequence in as many words. **Verify in a Wave-0 spike**: render one
2-node fixture with and without handles and check `.react-flow__edge` count.

### Pitfall 5 — `fitView` + the `minZoom: 0.5` floor on the 5-phase maximum

Sketch 136-B measured a 5-phase horizontal flow at **~1,600px**. In the Builder's graph column
(viewport width minus the 400px panel, so roughly 800-1,000px on a 1440px screen) `fitView` needs
~0.55×-0.62×. The default `minZoom` is **`0.5`**, so it fits — but with almost no margin once
`fitViewOptions.padding` is applied, and it breaks on a narrower window or if node width grows.

**How to avoid:** set `fitViewOptions={{ padding: 0.1, minZoom: 0.3 }}` (FitViewOptions carries its own
`minZoom`/`maxZoom` that scope the fit calculation) and/or lower the component `minZoom`. U-2 explicitly
tests this scenario — *"titles not truncated to nonsense, no horizontal page overflow, the `○ end` cap
visible"* — so pick constants that make U-2 pass by construction, not by luck.

Also: the `fitView` **prop** fits once on init. If the definition changes (a phase added in the panel),
call `useReactFlow().fitView()` from an effect, or accept the viewport staying put. In 183 the
definition can change via `PhaseFormPanel` edits — decide and assert the behaviour rather than leaving
it accidental.

[VERIFIED defaults: xyflow `ReactFlow/index.tsx` (`minZoom = 0.5`, `maxZoom = 2`) · CITED:
reactflow.dev/api-reference/types/fit-view-options]

### Pitfall 6 — `colorMode` defaults to `'light'`; Deep Midnight needs an explicit choice

`colorMode = 'light'` is the destructured default. The bundled `style.css` themes the plane, minimap,
controls, edges and handles for a light background. Dropping it into Deep Midnight unstyled produces
white control pills and pale grey edges.

**How to avoid:** either pass `colorMode="dark"` (React Flow ships dark variables) or override the
`--xy-*` CSS custom properties from the app's theme layer. Sketch 137-D's frosted-glass language will
want the override path for the node cards regardless, but the *chrome* (Controls, Background, MiniMap)
is cheapest via `colorMode="dark"`. Check both against the shipped Deep Midnight tokens at UAT — this
is a G-4 "does it look deliberate" surface.

[VERIFIED: xyflow `ReactFlow/index.tsx` — `colorMode = 'light'`]

### Pitfall 7 — jsdom cannot render React Flow without four global mocks

React Flow measures real DOM to place edges. jsdom reports every element as 0×0 and has no
`ResizeObserver` or `DOMMatrixReadOnly`. `frontend/src/setupTests.ts` currently loads only
`@testing-library/jest-dom` and `vitest-axe/matchers` — **no ResizeObserver shim exists anywhere in
`frontend/src`** (verified by grep: the only `getBoundingClientRect` reference in the whole tree is
`CitedMarkdown.tsx:176`).

Full recipe in §Testing. Without it: `ReferenceError: ResizeObserver is not defined` at render.

[CITED: reactflow.dev/learn/advanced-use/testing]

### Pitfall 8 — Copying a v11 recipe from the web

Search results for "react flow read only" are dominated by v11-era content. The tells: a default import
(`import ReactFlow from 'reactflow'`), `reactflow/dist/style.css`, `node.parentNode`, `xPos`/`yPos` in
custom-node props, `node.width`/`node.height` as *measured* values, `nodeInternals` in store selectors.
All are wrong for v12. The ROADMAP flags this explicitly: *"NEVER the frozen `reactflow` v11 package name."*

[CITED: reactflow.dev/learn/troubleshooting/migrate-to-v12]

---

## Code Examples

### The read-only `<WorkflowCanvas>` skeleton

```tsx
// Source: prop names + defaults verified against
//   github.com/xyflow/xyflow packages/react/src/{store/initialState.ts,container/ReactFlow/index.tsx}
//   reactflow.dev/learn/advanced-use/accessibility
import { ReactFlow, Background, Controls, Position, type Node, type Edge } from "@xyflow/react"
// stylesheet imported ONCE from src/index.css — see Pitfall 2
import { PhaseNode } from "./PhaseNode"

// module scope — Pitfall / common-error "new nodeTypes object"
const nodeTypes = { phase: PhaseNode }

export function WorkflowCanvas({ phases, selectedSlug, onSelectNode, technical }: Props) {
  const { nodes, edges } = useMemo(() => toCanvas(phases, { selectedSlug, technical }), [phases, selectedSlug, technical])

  if (nodes.length === 0) return <CanvasEmptyState />   // D-183-11 — no <ReactFlow> at all

  return (
    <div className="h-full w-full min-w-0">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => onSelectNode(node.id)}   // node.id === phase.slug (SC#3)

        /* ── read-only: every one of these defaults to TRUE ── */
        nodesDraggable={false}
        nodesConnectable={false}
        edgesReconnectable={false}
        connectOnClick={false}
        edgesFocusable={false}
        deleteKeyCode={null}

        /* ── keep: keyboard + the cursor contract ── */
        elementsSelectable                                  /* Enter/Space select */
        nodesFocusable                                      /* tabIndex=0 on the wrapper */
        panOnDrag                                           /* plane pans, nodes don't move */

        fitView
        fitViewOptions={{ padding: 0.1, minZoom: 0.3 }}     /* Pitfall 5 */
        colorMode="dark"                                    /* Pitfall 6 */
        proOptions={{ hideAttribution: false }}             /* MIT — attribution stays */
      >
        <Background />
        <Controls showInteractive={false} />                {/* ⛔ Pitfall 1 */}
      </ReactFlow>
    </div>
  )
}
```

> **Attribution note.** React Flow renders a small "React Flow" attribution link by default;
> `proOptions={{ hideAttribution: true }}` removes it. The MIT licence permits removal only under a
> Pro subscription per xyflow's stated terms. **Recommendation: leave the attribution visible** in 183
> and raise removal as a separate licensing decision if the operator objects at UAT. *(Confidence:
> MEDIUM — the `proOptions.hideAttribution` mechanism is documented; I did not fetch xyflow's
> licensing FAQ this session to confirm the current subscription requirement.)*

### The node (one tab stop, aria on the wrapper)

```tsx
// Source: node fields ariaRole / ariaLabel / domAttributes verified at
//   reactflow.dev/api-reference/types/node  (ariaRole defaults to "group")
import { Handle, Position, type NodeProps } from "@xyflow/react"

export function PhaseNode({ data, selected }: NodeProps) {
  const Glyph = phaseGlyph(data.phaseType)
  return (
    <>
      {/* invisible, non-interactive; CSS `top` = the FIXED edge anchor (D-183-12) */}
      <Handle type="target" position={Position.Left}  style={{ top: 28, opacity: 0 }} />
      <div className="phase-card /* frosted, neutral; type colour = tint behind the icon only */">
        <span className="phase-card__mark" aria-hidden="true">
          {Glyph ? <Glyph /> : (PHASE_GLYPHS[data.phaseType] ?? "•")}   {/* PhaseSpine.tsx:88 pattern */}
        </span>
        <span className="phase-card__title">{data.title}</span>
        <span className="phase-card__sub">{data.subtitle}</span>
        <span className="phase-card__badge">{data.groundingGlyph} {data.groundingWords}</span>
        {data.waitsForYou && <span className="phase-card__badge">Waits for you</span>}
      </div>
      <Handle type="source" position={Position.Right} style={{ top: 28, opacity: 0 }} />
    </>
  )
}
```

The node **object** (not the component) carries the a11y fields — built in `canvasModel`:

```ts
{
  id: phase.slug,                 // SC#3
  type: "phase",
  position: { x, y },             // REQUIRED by the Node type; computed, never persisted
  data: { … },
  draggable: false,
  ariaRole: "button",             // overrides the default "group"
  ariaLabel: `Step ${phase.phase_index + 1}: ${title}`,
}
```

### `parseSkipTarget` — corrected to backend semantics (C-1)

```ts
/**
 * Port of backend `parse_skip_target` (reachability.py:89-98) — EXACT semantics:
 * slice off the literal prefix, trim, empty ⇒ null. NOT a lastIndexOf(":") split.
 * Pinned by the D-183-15 parity case table.
 */
const SKIP_PREFIX = "skip_to_phase:"

export function parseSkipTarget(onFailure: string | null | undefined): string | null {
  if (typeof onFailure !== "string" || !onFailure.startsWith(SKIP_PREFIX)) return null
  const target = onFailure.slice(SKIP_PREFIX.length).trim()
  return target || null
}
```

### `toCanvas` — the edge set that agrees with the linter (C-2)

```ts
/**
 * PURE (D-183-12): no DOM read, no network, no Date.now, no Math.random.
 * Same definition in ⇒ byte-identical nodes/edges out.
 * Sequential edges mirror reachability.py:162-169 — an INDEX LOOKUP, never sorted-array adjacency.
 */
export function toCanvas(phases: PhaseSpecJSON[]): { nodes: Node[]; edges: Edge[] } {
  const ordered      = [...phases].sort((a, b) => a.phase_index - b.phase_index)
  const bySlug       = new Map(ordered.map((p) => [p.slug, p]))
  const byIndexValue = new Map(ordered.map((p) => [p.phase_index, p]))

  const nodes: Node[] = ordered.map((p, lane) => ({
    id: p.slug,                                   // SC#3
    type: "phase",
    position: { x: lane * PITCH_X, y: LANE_Y },    // fixed pitch — computed, never persisted
    data: buildNodeData(p),
    draggable: false,
    ariaRole: "button",
    ariaLabel: ariaLabelFor(p),
  }))

  const edges: Edge[] = []

  for (const p of ordered) {
    // ── sequential: the phase whose phase_index is EXACTLY +1 (reachability.py:164) ──
    const successor = byIndexValue.get(p.phase_index + 1)
    if (successor) edges.push({ id: `seq:${p.slug}->${successor.slug}`, source: p.slug, target: successor.slug, type: "flow" })

    // ── skip: one per validator declaring skip_to_phase ──
    for (const v of p.validators ?? []) {
      const target = parseSkipTarget(v.on_failure)
      if (!target) continue
      if (bySlug.has(target)) {
        edges.push({ id: `skip:${p.slug}->${target}`, source: p.slug, target, type: "skip" })
      } else {
        // D-183-10 — an HONEST broken reference, not a silent drop and not a phantom edge.
        // Agrees with reachability.py's UNSATISFIABLE_SKIP (:152-156).
        const stubId = `unresolved:${p.slug}:${target}`
        nodes.push({ id: stubId, type: "unresolvedSkip", position: stubPositionFor(p),
                     data: { declaredTarget: target, fromSlug: p.slug }, draggable: false, selectable: false })
        edges.push({ id: `skip:${p.slug}->?${target}`, source: p.slug, target: stubId, type: "skip" })
      }
    }
  }

  // explicit ○ end cap on the terminal node (sketch 136) — never a dangling stub
  …
  return { nodes, edges }
}
```

> **Note on the `○ end` cap and the stub node.** Both are *rendered* nodes that do not correspond to a
> `phase`. The SC#4 assertion must therefore be `nodes.filter(n => n.type === "phase").length ===
> definition.phases.length`, not a bare `nodes.length` comparison — otherwise the cap looks like a
> dropped/extra phase. Pin this in the test helper so it cannot drift.

### The official jsdom mock (verbatim from the React Flow testing guide)

```ts
// Source: reactflow.dev/learn/advanced-use/testing
class ResizeObserver {
  callback: globalThis.ResizeObserverCallback;
  constructor(callback: globalThis.ResizeObserverCallback) { this.callback = callback; }
  observe(target: Element) {
    setTimeout(() => { this.callback([{ target } as globalThis.ResizeObserverEntry], this); }, 0);
  }
  unobserve() {}
  disconnect() {}
}

class DOMMatrixReadOnly {
  m22: number;
  constructor(transform: string) {
    const scale = transform?.match(/scale\(([1-9.])\)/)?.[1];
    this.m22 = scale !== undefined ? +scale : 1;
  }
}

let init = false;
export const mockReactFlow = () => {
  if (init) return;
  init = true;
  global.ResizeObserver = ResizeObserver;
  global.DOMMatrixReadOnly = DOMMatrixReadOnly;
  Object.defineProperties(global.HTMLElement.prototype, {
    offsetHeight: { get() { return parseFloat(this.style.height) || 1; } },
    offsetWidth:  { get() { return parseFloat(this.style.width)  || 1; } },
  });
  (global.SVGElement as any).prototype.getBBox = () => ({ x: 0, y: 0, width: 0, height: 0 });
};
```

Asserting edges needs `waitFor` (the mocked `ResizeObserver` fires on a `setTimeout(…, 0)`):

```ts
// Source: reactflow.dev/learn/advanced-use/testing
await waitFor(() => {
  const edgeCount = container.querySelectorAll('.react-flow__edge').length;
  expect(edgeCount).toBeGreaterThan(0);
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| `import ReactFlow from 'reactflow'` (default export) | `import { ReactFlow } from '@xyflow/react'` (named) | v12 | Every pre-v12 recipe is wrong |
| `import 'reactflow/dist/style.css'` | `import '@xyflow/react/dist/style.css'` | v12 | Blank canvas if missed |
| `node.width` / `node.height` = measured | `node.measured.{width,height}`; `width`/`height` are now *inline style* hints | v12 | Reading `node.width` returns your style value, not the measurement |
| `node.parentNode` | `node.parentId` | v12 | Sub-flows only — N/A here |
| `xPos` / `yPos` in custom-node props | `positionAbsoluteX` / `positionAbsoluteY` | v12 | Custom-node signature |
| store `nodeInternals` | store `nodeLookup` | v12 | Store selectors |
| `Node<Data>` single generic | `Node<Data, Type>` + a discriminated union of node types | v12 | `type AppNode = PhaseNode \| EndCapNode \| UnresolvedSkipNode` |
| flat unicode `⚙ ✎ 🤖 ⛓ ☺ ◆` phase glyphs | fluent-emoji slugs resolved by `phaseGlyph()` to bundled 3D SVGs | Phase 127 (in-repo) | `PhaseSpineGraph` never migrated (C-3/D-183-13); `soulData.test.ts:121` still asserts the old set and is RED |

**Deprecated/outdated:**
- `reactflow` (v11 package name) — frozen; `@xyflow/react` is the live line.
- `dagre` / `@dagrejs/dagre` — effectively unmaintained (`.planning/research/STACK.md:87,99`); `elkjs`
  is the maintained alternative, and neither is needed in 183.

---

## Testing Approach

### Existing infrastructure (verified)

| Property | Value |
|---|---|
| Runner | **Vitest 4.1.0** (`frontend/package.json:80`) |
| Config | `frontend/vitest.config.ts` |
| Environment | **jsdom** (`vitest.config.ts:9`), `jsdom@^29.0.0` |
| `globals` | `true` (`vitest.config.ts:11`) |
| Setup file | `frontend/src/setupTests.ts` — `@testing-library/jest-dom` + `vitest-axe/matchers` **only** |
| Plugins in test | `@vitejs/plugin-react` + `unplugin-icons` (`vitest.config.ts:7`) — so `~icons/fluent-emoji/*` resolves in tests |
| Alias | `@` → `./src` (`vitest.config.ts:19`) |
| Excluded | `node_modules/**`, `dist/**`, `tests/e2e/**` (`vitest.config.ts:15`) |
| Testing Library | `@testing-library/react@^16.3.2`, `/dom@10.4.1`, `/user-event@^14.6.1`, `/jest-dom@^6.9.1` |
| a11y | `vitest-axe@^0.1.0`, `toHaveNoViolations` globally extended (`setupTests.ts:6-8`) |
| Commands | `npm test` → `vitest run` · `npm run test:watch` · `npm run lint:a11y` → `eslint . -c eslint.a11y.config.js` |
| Source-grep idiom | `import src from "./Component?raw"` (Vite `?raw`) — used at `PhaseSpineGraph.test.tsx:18`, `PhaseSpine.test.tsx:15` |

### ⚠ Baseline rot — measured this session

Three full runs of `npx vitest run` in `frontend/`:

```
Test Files  10 failed | 195 passed (205)
Tests       33 failed | 1844 passed (1877)
Duration    ~268s
```

Observed failure counts across the three runs: **28, 33, 35** — the baseline is **FLAKY**, dominated by
5-10 s timeouts in `PublishGauntlet.test.tsx` and `IngestionPage.test.tsx`.

Failing files at HEAD (pre-existing, unrelated to 183 except where noted):

| File | Notes |
|---|---|
| `src/components/workflows/PublishGauntlet.test.tsx` | ~7-13 tests; timeout-flaky, count varies run to run |
| `src/__tests__/providers/streamsProvider.test.tsx` | 7 tests (SEED-056 / known rot) |
| `src/__tests__/providers/StreamsProvider.dedup.test.ts` | 2 |
| `src/__tests__/providers/streamsProvider_075_9_clientkey.test.tsx` | 1 |
| `src/__tests__/components/IngestionPage.test.tsx` | 4 |
| `src/__tests__/hooks/useMessages.test.ts` | 1 |
| `src/__tests__/components/MessageItem.test.tsx` | 1 |
| `src/__tests__/components/Plan04.frontend.test.tsx` | 1 |
| `src/lib/model-info.test.ts` | 1 |
| **`src/components/workflows/soulData.test.ts`** | **1 — IN 183's BLAST RADIUS.** `:121-132` asserts `PHASE_GLYPHS` maps to `⚙✎🤖⛓☺◆`; the map has held fluent-emoji slugs since Phase 127. Fix in-phase or record as accepted rot. |

**Planner instruction:** grade on a **differential**, never an absolute count. Capture the failing-test
*names* before the first commit and after the last, and require the set to shrink or stay equal.
Per the Phase 177 lesson recorded in memory, also guard the test **COUNT** — a net-new file that
replaces an existing suite hides coverage loss that a failures-only differential cannot see.
Budget ~4.5 min per full run.

### How to test an `@xyflow/react` canvas

**Layer 1 — pure `toCanvas` snapshots (the bulk of the value).** D-183-12 makes the projection a pure
function, so SC#2 and SC#4 are provable with zero DOM. No mocks, no `ResizeObserver`, no timers,
millisecond-fast, and completely deterministic. Cover:
- every fixture in §Fixture Corpus → `{nodes, edges}` snapshot
- `phaseNodes.length === definition.phases.length` (SC#4 "no dropped phase")
- every edge's `source`/`target` resolves to an emitted node id (SC#4 "no phantom edge")
- `phase_index = [0,1,3]` → exactly one sequential edge (C-2)
- every `node.id === phase.slug` (SC#3)
- **purity:** `JSON.stringify(toCanvas(d)) === JSON.stringify(toCanvas(d))` and no `position`/`x`/`y`/
  `layout` key present in a deep-clone of the input after the call (G-6 tripwire)
- `llm_batch_agents` → exactly one node (G-6)

**Layer 2 — thin DOM tests.** Needs the official mock. Add it as a **helper imported by canvas test
files**, not to the global `setupTests.ts` — `Object.defineProperties` on `HTMLElement.prototype` is a
global mutation that would affect all 205 test files, and the existing baseline is already flaky enough.
The official recipe's `if (init) return` guard makes per-file import idempotent.

Assert only what DOM proves and the pure function cannot:
- `.react-flow` root exists on a non-empty definition; **absent** on a zero-phase definition (D-183-11)
- **absent** when `visual_workflow_canvas` is false, and the `[≣ Spine] [⬡ Canvas]` strip is absent (D-183-03)
- `getAllByRole("button")` count and accessible names on nodes (Pattern 3 — and it catches the
  double-tab-stop mistake immediately)
- a click on a node calls `onSelectNode` with the slug (D-183-05)
- **no** `.react-flow__controls-interactive` button (Pitfall 1)
- no `[draggable="true"]`, no drag handlers — mirror `PhaseSpineGraph.test.tsx:129-145`'s existing
  static drag-free assertion block
- edge count via `waitFor(() => container.querySelectorAll('.react-flow__edge'))`
- `toHaveNoViolations()` on a rendered canvas (the axe matcher is already global)

**Layer 3 — source-text guards** (`?raw`, the shipped idiom):
- `PhaseSpineGraph?raw` **not** `/const PHASE_GLYPHS/` (extend `PhaseSpine.test.tsx:104`)
- `PhaseSpineGraph?raw` **not** `/lastIndexOf/` and not a second `parseSkipTarget` declaration
- extend `PhaseSpineGraph.test.tsx:158`'s no-graph-lib regex with `|xyflow`
- `canvasModel?raw` **not** `/getBoundingClientRect|offsetHeight|offsetWidth|document\.|window\./`
  — the machine-checkable form of D-183-12's "no DOM measurement"
- exactly one `parseSkipTarget` declaration across `frontend/src` (G-6: "a third copy exists at phase end")

**Layer 4 — the C-1 parity table.** Put the case table in one shared JSON/TS array and have the
TypeScript test read it. A Python-side counterpart importing the same JSON and asserting
`reachability.parse_skip_target` gives identical answers is the strongest form and is cheap
(`backend/tests/unit/test_183_skip_parse_parity.py` reading
`frontend/src/components/workflows/__fixtures__/skipParseCases.json`). Without it, the parity claim is
prose, and prose is exactly what drifted (C-1).

**Playwright:** `frontend/tests/e2e/` exists but the suite is documented-rotted (memory: SEED-049,
16/17 failing). Do **not** add an E2E for this phase; the G-4 rows are the live gate.

---

## Validation Architecture

`workflow.nyquist_validation` is **`true`** (`.planning/config.json:8`) — this section is required.

### Test Framework

| Property | Value |
|---|---|
| Framework | Vitest 4.1.0 + @testing-library/react 16.3.2, jsdom 29 |
| Config file | `frontend/vitest.config.ts` |
| Quick run command | `cd frontend && npx vitest run src/components/workflows` |
| Full suite command | `cd frontend && npm test` (≈ 268 s) |
| Baseline (2026-07-25) | 33 failed / 1844 passed of 1877; 10 failed files of 205; **flaky, 28-35 range** |

### Phase Requirements → Test Map

| Req / SC | Behaviour | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| **SC#1** | Nodes = phases; edges = `phase_index` flow + parsed `skip_to_phase`, rendered via `@xyflow/react` | unit (pure) + component | `npx vitest run src/components/workflows/canvasModel.test.ts -t "edges"` | ❌ Wave 0 |
| **SC#1** (branch edge) | A `skip_to_phase` fixture yields one skip edge to the resolved node | unit (pure) | `npx vitest run src/components/workflows/canvasModel.test.ts -t "skip"` | ❌ Wave 0 |
| **SC#2** | Pure projection; positions computed, never persisted | unit (purity + source-grep) | `npx vitest run src/components/workflows/canvasModel.purity.test.ts` | ❌ Wave 0 |
| **SC#3a** | Nodes not draggable | component (DOM) | `npx vitest run src/components/workflows/WorkflowCanvas.test.tsx -t "drag-free"` | ❌ Wave 0 |
| **SC#3b** | `node.id === phase.slug` | unit (pure) | `npx vitest run src/components/workflows/canvasModel.test.ts -t "node id"` | ❌ Wave 0 |
| **SC#4** | 4 canonical seeds + Starter Library + `eval_coverage` + empty + branching + broken-ref + gap ⇒ no dropped phase, no phantom edge | unit (snapshot over fixtures) | `npx vitest run src/components/workflows/canvasModel.fixtures.test.ts` | ❌ Wave 0 |
| **D-183-03** | Flag off ⇒ toggle absent + no `.react-flow` root | component (DOM) | `npx vitest run src/pages/WorkflowBuilderPage.canvas.test.tsx -t "flag off"` | ❌ Wave 0 |
| **D-183-05** | Node click fires `onSelectNode(slug)` | component | `… -t "onSelectNode"` | ❌ Wave 0 |
| **D-183-06** | Fallback title is a plain-language sentence; slug never on the face by default | unit | `npx vitest run src/components/workflows/phaseVocabulary.test.ts` | ❌ Wave 0 |
| **D-183-07** | Grounding badge derivation (strict/flag/open) + `llm_human_input` second badge only | unit | `… -t "grounding"` | ❌ Wave 0 |
| **D-183-08** | One canvas-level ⌥ toggle flips every node | component | `… -t "technical names"` | ❌ Wave 0 |
| **D-183-10** | Unresolvable skip renders an honest broken-reference stub, connected to no phase node | unit + component | `… -t "unresolvable"` | ❌ Wave 0 |
| **D-183-11** | Zero-phase ⇒ named empty state, **no** `.react-flow`, no grid/controls/minimap, no ghost node | component | `… -t "empty"` | ❌ Wave 0 |
| **D-183-12** | Same definition ⇒ byte-identical positions; source contains no DOM-read call | unit + source-grep | `npx vitest run src/components/workflows/canvasModel.purity.test.ts` | ❌ Wave 0 |
| **D-183-13** | One glyph map, one `parseSkipTarget` in the tree; `PhaseSpineGraph` renders 3D marks | source-grep + component | `npx vitest run src/components/workflows/PhaseSpine.test.tsx src/components/workflows/PhaseSpineGraph.test.tsx` | ⚠ **exists, will need updating** (`PhaseSpineGraph.test.tsx:94-96` breaks) |
| **D-183-15 / C-1** | Client parse ≡ `reachability.parse_skip_target` over the shared case table | unit ×2 (TS + Python) | `npx vitest run … -t "parity"` **and** `cd backend && ./venv/Scripts/python.exe -m pytest tests/unit/test_183_skip_parse_parity.py` | ❌ Wave 0 |
| **C-2** | Non-contiguous `phase_index` ⇒ exactly one sequential edge (no phantom) | unit | `npx vitest run … -t "non-contiguous"` | ❌ Wave 0 |
| **Pitfall 1** | No interactivity-lock button in the controls | component | `… -t "showInteractive"` | ❌ Wave 0 |
| **181 gate** | `revertByteIdentical.test.tsx` scope-freeze assertions still pass | regression | `npx vitest run src/components/admin/revertByteIdentical.test.tsx` | ✅ exists — must stay green **unmodified** |
| **a11y** | Rendered canvas has no axe violations; one tab stop per node | component | `… -t "accessib"` + `npm run lint:a11y` | ❌ Wave 0 |
| **G-6** | No `position`/`x`/`y`/`layout` key reaches a definition object | unit | in `canvasModel.purity.test.ts` | ❌ Wave 0 |

### Manual-only (G-4 lived-experience — operator-defined, MUST be driven live)

These are **not** automatable and must appear in VALIDATION.md as manual UAT rows, not as plan-task
assertions. Chrome MCP or operator-clicks; wire format and screenshots are explicitly insufficient.

| ID | Scenario | Observable pass condition | Why not automated |
|---|---|---|---|
| **U-1** | Open a real draft, flip `[≣ Spine] ⇄ [⬡ Canvas]` both ways | Both views name the same steps, in the same order, with the same icons. No step in one and not the other. | Cross-view visual agreement of rendered 3D SVG marks — a DOM test can compare slugs but not that they *look* the same |
| **U-2** | Open `eval_coverage` (the only 5-phase definition) on Canvas | Legible at the default zoom; titles not truncated to nonsense; **no horizontal page overflow**; the `○ end` cap visible | Legibility and truncation are perceptual; jsdom has no layout |
| **U-3** | Open one of the 71 zero-phase drafts on Canvas | Reads as "nothing here yet". No stray grid, zoom pills, or minimap floating in space | "Doesn't look broken" is a judgement, not an assertion |
| **U-4** | Operator flips `visual_workflow_canvas` → Off in the Control Room, reloads | Toggle gone; graph column exactly as before — **including on an operator account** (D-181-01) | Requires a real operator session + a live `app_settings` write; the vitest analogue proves the render branch, not the end-to-end flag path |

### Sampling Rate

- **Per task commit:** `cd frontend && npx vitest run src/components/workflows` (the phase's own files —
  seconds, not minutes)
- **Per wave merge:** `cd frontend && npm test` + `cd frontend && npx tsc -b` — capture the failing-test
  **name set** and the **total count**, diff against the recorded baseline (33 failed / 1877 total).
  ⚠ Per the memory lesson: `tsc -b` ≠ `tsc --noEmit`; `npm run build` runs `tsc -b && vite build`.
- **Phase gate:** full suite differential green (no new failures, no test-count regression) **plus** all
  four G-4 rows driven live, **before** `/gsd:verify-work`.

### Wave 0 Gaps

- [ ] `frontend/src/components/workflows/__fixtures__/canvasFixtures.ts` — the D-183-09 corpus,
      transcribed from mig 061 / 066 / 094 + `seed-pm-pack.py`, each entry citing its source file:line
- [ ] `frontend/src/components/workflows/__fixtures__/skipParseCases.json` — the C-1 parity table,
      read by both the TS and the Python suite
- [ ] `frontend/src/test-utils/mockReactFlow.ts` — the official four-mock helper (**file-local import,
      NOT `setupTests.ts`**)
- [ ] `frontend/src/components/workflows/canvasModel.test.ts` — SC#1/#3b/#4, C-2, D-183-10
- [ ] `frontend/src/components/workflows/canvasModel.purity.test.ts` — SC#2, D-183-12, G-6
- [ ] `frontend/src/components/workflows/canvasModel.fixtures.test.ts` — the SC#4 snapshot sweep
- [ ] `frontend/src/components/workflows/phaseVocabulary.test.ts` — D-183-06/07, C-1 parity (TS half)
- [ ] `frontend/src/components/workflows/WorkflowCanvas.test.tsx` — SC#3a, D-183-08/10/11, Pitfall 1, a11y
- [ ] `frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx` — D-183-03 (flag off ⇒ vanish), D-183-05
- [ ] `backend/tests/unit/test_183_skip_parse_parity.py` — the C-1 parity Python half
- [ ] **Update** `frontend/src/components/workflows/PhaseSpineGraph.test.tsx` — migrate `:94-96` from
      literal `🤖`/`◆` to `data-phase-type` hooks (pattern: `PhaseSpine.test.tsx:38-39`); extend `:158`
      with `|xyflow`; delete the false parity comment at `:110-111`
- [ ] **Update** `frontend/src/components/workflows/PhaseSpine.test.tsx:104` — extend the
      `not.toMatch(/const PHASE_GLYPHS/)` guard to cover `PhaseSpineGraph?raw` (D-183-13)
- [ ] **Decide + record**: fix or accept `soulData.test.ts:121-132` (already RED at HEAD)
- [ ] Framework install: **none** — Vitest, jsdom, Testing Library, and vitest-axe are all installed

---

## Security Domain

`security_enforcement` is absent from `.planning/config.json` ⇒ treated as enabled. The ROADMAP flags
Phase 183 as **"no threat model"**, and this research concurs: the phase adds **no route, no migration,
no authz decision, no new data path, and no external input surface**. It is a client-side rendering
change over data the user already has in memory.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | **no** | No auth surface. The Builder is already behind the app's session. |
| V3 Session Management | **no** | The view toggle is React `useState`; nothing is stored, not even `localStorage` (D-183-02). |
| V4 Access Control | **partially — inherited, not extended** | `useEffectiveFeatures` hides the toggle render-only and fails closed to `{}`; the real wall is the backend `require_visible` / `CanvasGateMiddleware` from Phases 148/181/182. 183 adds no gated route, so there is nothing new to enforce. **A plan task that adds a route breaks this assessment.** |
| V5 Input Validation | **yes** | The definition JSONB is already Pydantic-validated server-side (`_StrictBase`, `extra="forbid"`, `harness.py:30`). The client read shapes (`PhaseSpecJSON` et al.) are loose by design; the canvas must be **total** over unexpected values — an unknown `phase_type` falls back (`phaseGlyph` returns `null`, `PHASE_GLYPHS[type] ?? "•"`), an unknown `validator.kind` is ignored, a malformed `on_failure` returns `null`, a missing `validators` array defaults to `[]`. |
| V6 Cryptography | **no** | None involved. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation | Status in 183 |
|---|---|---|---|
| XSS via an authored `phase.name` / slug rendered into the node | Tampering | Render as a plain React text child or an attribute value; never `dangerouslySetInnerHTML` | Follow the shipped precedent — `PhaseSpine.tsx:13-14` documents this exact control (T-124-01), `phaseGlyph.tsx:10-14` documents the SVG-as-component control. `PhaseNode` must do the same. |
| SVG injection via a phase-type-derived icon path | Tampering | Build-time bundled deep-subpath imports only; a missing slug fails the build | Already enforced by `phaseGlyph.tsx:25-33` + `unplugin-icons`. 183 adds no new slug. |
| Supply-chain: a malicious transitive dep in a net-new package | Tampering | slopcheck + registry verification + postinstall inspection | Done — see §Package Legitimacy Audit. `[OK]`, no postinstall. |
| Client-side authorization bypass (reading the flag as the security boundary) | Elevation of Privilege | Client hide is cosmetic; server gate is authoritative | Correct by construction — no new route to bypass. Documented at `useEffectiveFeatures.ts:8` and `:33-35`. |
| Data exfiltration via a canvas-persisted layout leaking into the definition | Information Disclosure / Tampering | Persist nothing | D-183-12 + G-6 tripwire; enforced by the purity test. |

**No `<threat_model>` block is required for this phase.** If the plan grows a backend touch, that
conclusion is void and `/gsd:secure-phase` applies.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| Node.js + npm | install + build + test | ✓ | npm resolves `@xyflow/react` fine | — |
| `@xyflow/react` | CANVAS-01 | ✗ **not yet installed** | 12.11.2 available on npm, MIT, `[OK]` | none — it is the requirement |
| Vitest 4.1.0 + jsdom 29 | all automated tests | ✓ | installed | — |
| `@testing-library/react` 16.3.2 | component tests | ✓ | installed | — |
| `vitest-axe` + axe-core | a11y assertion | ✓ | installed, globally extended | — |
| `unplugin-icons` + `@iconify-json/fluent-emoji` | 3D glyphs in app AND tests | ✓ | 23.0.1 / 1.2.7, wired in both vite and vitest configs | — |
| Local Supabase (`:54322`) | corpus verification only | ✓ | reachable this session | Fixtures are transcribed from checked-in migrations — the DB is **not** required to run the tests |
| `backend/venv` Python | the C-1 parity test (Python half) | ✓ | `backend/venv/Scripts/python.exe` works | TS-only parity table if the Python half is descoped (weaker) |
| Chrome MCP | the four G-4 UAT rows | ⚠ known to hang (memory: `chrome_mcp_dropdown_wedge`) | — | Operator-clicks with named steps — the documented fallback |
| Playwright E2E | — | ✓ installed but **rotted** (16/17 failing, SEED-049) | 1.60.0 | Not used — do not add an E2E for this phase |
| `slopcheck` | package audit | ✓ (its `npm` shell-out fails on Windows; verification itself works) | — | `npm view` + official-docs cross-check |

**Missing dependencies with no fallback:** `@xyflow/react` — it *is* the phase. Install is a Wave-0 task.
**Missing dependencies with fallback:** Chrome MCP → operator-driven clicks.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | A custom node with **no** `<Handle>` renders no edges | Pitfall 4 | Wasted effort adding hidden handles, or (worse) invisible edges discovered at UAT. **Mitigation: 5-minute Wave-0 spike** — render a 2-node fixture with/without handles, count `.react-flow__edge`. |
| A2 | `proOptions.hideAttribution: true` requires a Pro subscription under xyflow's terms | Code Examples | If wrong, we leave a visible third-party link on a business surface unnecessarily. Low cost either way; raise at UAT rather than deciding silently. |
| A3 | The CONTEXT/sketch corpus counts (119 phases / 40 zero-phase / 10 named / ×45 fail_run) came from a different or since-changed data source | C-3 | If they came from **production**, the empty-state and named-phase distributions differ in the cloud from local, and UAT expectations should reference the cloud numbers. **Mitigation: the fixture corpus is transcribed from checked-in migrations, so the tests are unaffected regardless.** |
| A4 | `@xyflow/react` v12 builds cleanly under **Vite 8** | Standard Stack | A build failure at install time. Package is ESM-first with a standard `exports` map and no build-tool-specific config; the risk is low but I found **no explicit Vite-8 statement** in the official docs. **Mitigation: Wave 0 installs and runs `npx tsc -b && npx vite build` before any component work.** |
| A5 | ~109K weekly downloads (quoted from `.planning/research/STACK.md:33`) | Standard Stack | None material — the licence, maintenance cadence, and slopcheck verdict are the load-bearing signals and all were independently verified this session. |
| A6 | `React.lazy` code-splitting the canvas yields a real first-load saving | Standard Stack | If the bundler hoists it anyway, the saving is zero and the lazy boundary is pure complexity. **Mitigation: measure with `vite build` chunk output before and after; if the chunk is not separate, drop the split.** |
| A7 | Keeping `elementsSelectable={true}` while `nodesDraggable={false}` is the right read-only balance | Pattern 1 | A user could rubber-band-select nodes (`selectionOnDrag` defaults `false`, so this needs a modifier key) with no visible effect. Cosmetic at worst; confirm at U-1. |

---

## Open Questions (RESOLVED)

1. **Does `PhaseSpineGraph` need `<Handle>`-free edges verified before `PhaseNode` is written?**
   - What we know: custom nodes replace the default node including its handles; the docs point to the
     Handles page for connectivity.
   - What's unclear: whether an edge to a handle-less node silently renders nothing, renders to the
     node centre, or logs a warning.
   - Recommendation: a Wave-0 spike task, 5 minutes, before `PhaseNode`'s shape is locked (A1).
   - **RESOLVED — plan `183-01` Task 3.** The spike ships as a committed test,
     `frontend/src/test-utils/handleSpike.test.tsx`, gated by that task's `<automated>` command; its
     verdict is recorded in `183-01-SUMMARY.md` and read by plan `183-06` Task 1 before `PhaseNode`'s
     handles are written.

2. **Which `soulData.test.ts:121` disposition does the operator want?**
   - What we know: the assertion has been RED since Phase 127 and asserts a retired glyph set.
   - What's unclear: whether fixing it inside 183 counts as scope creep on a shipped surface.
   - Recommendation: **fix it.** It is a one-line honest correction in the exact module D-183-13 makes
     canonical, and leaving a RED assertion about `PHASE_GLYPHS` while declaring `PHASE_GLYPHS` the
     single source of truth is self-contradictory. Record it in the plan so it is visible, not silent.
   - **RESOLVED — plan `183-04` Task 3.** Disposition is an explicit in-phase **FIX**, recorded in
     `183-VALIDATION.md` §Wave 0 Requirements. The expected mapping is corrected to the six shipped
     fluent-emoji slugs, the exact 6-key key-set assertion is kept, and the failing-name differential
     must SHRINK by exactly that one name.

3. **Where does the `○ end` cap live in the model?**
   - What we know: sketch 136 requires *"every flow ends in an explicit `○ end` cap, never a dangling
     edge stub"*; `reachability.py` has no terminal node concept.
   - What's unclear: whether it is a real xyflow node (simplest, but inflates `nodes.length`) or a CSS
     decoration on the last node (keeps `nodes.length === phases.length`).
   - Recommendation: a real node with `type: "endCap"`, and make the SC#4 assertion count
     `nodes.filter(n => n.type === "phase")`. It generalises to Phase 188's run-viz, which will want a
     paintable terminal.
   - **RESOLVED — plan `183-05` Task 1 (model) + plan `183-06` Task 1 (render).** A real node with
     `type: "endCap"`: the model emits EXACTLY ONE `endCap` node plus one edge from the
     maximum-`phase_index` phase, SC#4 counts `nodes.filter(n => n.type === "phase")`, and
     `EndCapNode` renders it.

4. **Does the toggle strip appear or shift layout when `useEffectiveFeatures` resolves?**
   - What we know: `features` is `{}` until the fetch resolves (`useEffectiveFeatures.ts:40,65`), and
     `loading` is exposed.
   - What's unclear: whether the operator finds a strip appearing ~200 ms after load acceptable.
   - Recommendation: gate on `!loading && features.visual_workflow_canvas === true` and reserve no
     space — a flag-off user must see **byte-identical** output (D-183-03), which forbids a reserved
     placeholder. Confirm at U-4.
   - **RESOLVED — plan `183-07` Task 1.** The gate is
     `featuresCtx !== null && !featuresCtx.loading && featuresCtx.features.visual_workflow_canvas === true`
     with no reserved space, asserted across five render variants (absent / false / operator-like /
     no provider / loading) in plan `183-07` Task 2.

5. **Should the C-1 parity test have a Python half?**
   - What we know: a TS-only test pins the client against a *table*, not against the backend function.
   - What's unclear: whether cross-language fixture sharing is worth the plumbing for one function.
   - Recommendation: **yes** — it is one small pytest reading one JSON file, and C-1 exists precisely
     because a prose parity claim was trusted for three phases. This is the control that would have
     caught it.
   - **RESOLVED — plan `183-02` Task 3.** `backend/tests/unit/test_183_skip_parse_parity.py` is the
     ONLY backend file in the phase and is parametrized over the same `skipParseCases.json` table the
     vitest half reads, so neither language can be weakened alone.

---

## Sources

### Primary (HIGH confidence)

**Official React Flow documentation** (reactflow.dev, fetched 2026-07-25):
- `/learn/troubleshooting/migrate-to-v12` — v11→v12 breaking changes; verbatim import statements; `measured`, `parentId`, `positionAbsoluteX/Y`, `nodeLookup`, node generics
- `/learn/troubleshooting/common-errors` — the 7 documented errors + fixes (ReactFlowProvider, nodeTypes recreation, container dimensions, missing styles, node type not found)
- `/learn/getting-started/installation-and-requirements` — the mandatory `@xyflow/react/dist/style.css` import + placement guidance + the parent-dimensions requirement
- `/learn/advanced-use/testing` — **the verbatim jsdom mock recipe** (`ResizeObserver`, `DOMMatrixReadOnly`, `offsetHeight`/`offsetWidth`, `SVGElement.getBBox`) + the `waitFor` edge-assertion pattern
- `/learn/advanced-use/accessibility` — Tab/Enter/Space/Escape, auto-pan on focus, `role="group"` default, `ariaRole`/`domAttributes`/`ariaLabelConfig`, `disableKeyboardA11y`, arrow-key movement requiring `nodesDraggable && nodesFocusable`
- `/learn/customization/custom-nodes` — nodeTypes defined outside the component; handles needed for connections
- `/api-reference/types/node` — required vs optional fields; **`position` REQUIRED**; `ariaRole` defaults `"group"`
- `/api-reference/components/background`, `/api-reference/components/controls`, `/api-reference/components/handle`, `/api-reference/types/fit-view-options`

**xyflow GitHub source** (raw.githubusercontent.com/xyflow/xyflow/main, fetched 2026-07-25):
- `packages/react/src/container/ReactFlow/index.tsx` — destructured prop defaults
- `packages/react/src/store/initialState.ts` — store defaults (`nodesDraggable/Connectable/Focusable`, `edgesFocusable/Reconnectable`, `elementsSelectable`, `connectOnClick` all `true`)
- `packages/react/src/components/NodeWrapper/index.tsx` — `onNodeClick` fires outside the `isSelectable` guard; `tabIndex`/`role`/`aria-describedby` conditional on `isFocusable`; class-name construction
- `packages/react/src/additional-components/Controls/Controls.tsx` — **`showInteractive = true` and the lock handler setting all three interaction flags**

**npm registry** (`npm view`, 2026-07-25): `@xyflow/react` 12.11.2 / MIT / peerDeps / dependencies / publish times / exports / no postinstall; `@xyflow/system` 0.0.79; `classcat` 5.0.5

**This repository** (read in full or at cited lines, 2026-07-25): `frontend/package.json`,
`vite.config.ts`, `vitest.config.ts`, `src/setupTests.ts`; `src/components/workflows/{PhaseSpineGraph.tsx,
PhaseSpineGraph.test.tsx, PhaseSpine.tsx, PhaseSpine.test.tsx, soulData.ts, soulData.test.ts,
deriveTier.ts}`; `src/lib/{phaseGlyph.tsx, nav-items.ts, api.ts}`; `src/hooks/useEffectiveFeatures.ts`;
`src/pages/WorkflowBuilderPage.tsx`; `src/components/admin/{revertByteIdentical.test.tsx,
FeatureVisibility.tsx, ControlRoomPage.tsx}`; `backend/app/services/harness/reachability.py`;
`backend/app/models/{harness.py, user_settings.py}`; `backend/tests/conftest.py`;
`backend/tests/integration/test_seed_pm_pack.py`; `scripts/seed-pm-pack.py`;
`supabase/migrations/{061,066,094}_*.sql`

**Live database** (psycopg2 → `127.0.0.1:54322`, 2026-07-25) — corpus counts, phase-type histogram,
`on_failure` histogram, per-definition phase shapes (commands recorded in §Live Corpus)

**Planning artifacts:** `.planning/{REQUIREMENTS.md, ROADMAP.md, config.json}`,
`.planning/research/{STACK.md, PITFALLS.md}`, `.planning/sketches/MANIFEST.md`,
`.planning/sketches/13{4,5,6,7}-*/README.md`, `CLAUDE.md`

### Secondary (MEDIUM confidence)

- **bundlephobia.com** `/api/size?package=@xyflow/react@12.11.2` — 184,433 B min / 58,753 B gzip,
  dependency size breakdown. Cross-checked against `npm view dist.unpackedSize` (1,208,222 B, 516 files
  — consistent with a package shipping esm + umd + types + 2 stylesheets).
- **slopcheck** (npm ecosystem) — `[OK]`. Cross-verified against official docs using the package name
  verbatim, so the name's provenance is authoritative, not search-derived.

### Tertiary (LOW confidence — flagged for validation)

- Weekly-download figures (~109K) quoted from `.planning/research/STACK.md:33`, not re-measured (A5).
- The Pro-subscription requirement for `hideAttribution` (A2) — mechanism documented, terms not
  re-verified this session.
- The "no `<Handle>` ⇒ no edge" consequence (A1) — inferred from docs, not stated; Wave-0 spike.
- Vite 8 compatibility (A4) — inferred from a standard ESM `exports` map; no explicit statement found.

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|---|---|---|
| Standard stack (version / licence / peer deps / size) | **HIGH** | npm registry read directly + slopcheck `[OK]` + package name confirmed from official docs |
| xyflow read-only prop set + defaults | **HIGH** | Read from the library's own `initialState.ts` and `ReactFlow/index.tsx` on `main`, not from prose |
| `<Controls>` lock-button hazard (Pitfall 1) | **HIGH** | `Controls.tsx` handler read verbatim |
| jsdom test recipe | **HIGH** | Official testing guide, quoted verbatim |
| Codebase inventory (all file:line) | **HIGH** | Every file opened this session; every line number re-derived, not copied from CONTEXT |
| C-1 parse divergence | **HIGH** | Both implementations read in full; divergence traced by hand across 9 inputs |
| C-2 phantom-edge risk | **HIGH** | `reachability.py:162-169` and `PhaseSpineGraph.tsx:103,146,158` both read; Pitfall 3 corroborates the requirement |
| C-3 live-corpus divergence | **HIGH** on my read; **UNKNOWN** on the cause | Single reproducible query recorded; the origin of CONTEXT's numbers could not be reconstructed |
| Fixture corpus locations | **HIGH** | Every source file located and its shape confirmed against the live DB |
| Accessibility (what xyflow gives vs what to add) | **HIGH** | Official a11y docs + `NodeWrapper` source agree |
| Bundle size / lazy-load value | **MEDIUM** | bundlephobia is authoritative for the raw number; the *saving* from splitting is unmeasured (A6) |
| Handle-required-for-edges | **MEDIUM** | Docs imply, do not state (A1) |
| Vite 8 compatibility | **MEDIUM** | Inferred from the exports map; no explicit doc statement (A4) |

**Research date:** 2026-07-25
**Valid until:** 2026-08-24 (30 days). `@xyflow/react` ships roughly monthly (12.11.0 → 12.11.2 in five
weeks); re-run `npm view @xyflow/react version` at plan time. Codebase claims are valid until
`PhaseSpineGraph.tsx`, `soulData.ts`, `WorkflowBuilderPage.tsx`, or `reachability.py` next change.
The live-corpus numbers (§Live Corpus) are valid for **today only** — they are recorded as evidence for
C-3/C-4, not as a fixture source.
