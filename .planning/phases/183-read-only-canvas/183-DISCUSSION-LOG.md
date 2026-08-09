# Phase 183: Read-Only Canvas - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-25
**Phase:** 183-read-only-canvas
**Areas discussed:** Entry door (where the canvas lives), Click behaviour + node depth, The missing branch + broken references, Shared glyph/parse extraction (G-5)

**Pre-flight:** G-2 sketch gate SATISFIED (sketches 134-137; winners 136-B + 137-D) — the acceptance
bar was already operator-approved, so this discussion covered only what the sketches left open
(134 and 135 both closed with **no winner**). G-4 fires (user-visible UI) → operator-defined UAT
scenarios collected at the end. Reported-bugs cross-check run: 6 open `surface: Agentic-RAG`
reports, **none overlapping**; closest (BUG-260609-04, placeholder slug `phase-0`) is a live-run
reconcile-floor bug belonging to Phase 188, left open with its re-open trigger repointed.

---

## Entry door — where the canvas lives

*(Sketch 134 closed with no winner — this was the open structural question.)*

| Option | Description | Selected |
|--------|-------------|----------|
| In-Builder view toggle | `[≣ Spine] [⬡ Canvas]` on WorkflowBuilderPage's existing graph column, same push grid. No new ActiveView, no nav entry; 184 upgrades the same component in place. Cost: touches a page 181 froze; no look-without-editing door for published workflows. | ✓ |
| Own canvas view from Workflows | New ActiveView + the NAV_ITEMS entry 181 deferred to "land with the view in 183". Honours 181's promise, keeps the Builder frozen. Cost: more surface to gate; 184 then has to decide where the editable canvas lives. | |
| Both doors, one component | One `<WorkflowCanvas>` mounted twice. Maximum reach. Cost: two integration seams in a phase meant to prove the projection cheaply. | |

**User's choice:** In-Builder view toggle
**Notes:** Chosen with the preview showing the canvas replacing the spine inside the existing
`minmax(0,1fr) 400px` grid. Consequence recorded in CONTEXT: this formally **releases** Phase 181's
deferred nav-entry promise, and `revertByteIdentical.test.tsx`'s scope-freeze assertion keeps
holding rather than being deleted.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Spine stays the default | Builder opens as today; Canvas one click away. Cheapest D-14 story; canvas can't regress a mid-authoring session. | ✓ |
| Canvas becomes the default | Flag-on lands you on the canvas. Gets real usage immediately. Cost: the flag visibly changes the front door. | |
| Remember whichever you last used | Persist to localStorage, cold default Spine. Cost: adds persisted UI state to a phase that persists nothing. | |

**User's choice:** Spine stays the default
**Notes:** 184 may flip it once the canvas is the better surface. No persisted preference — session
state only.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Accept the gap, defer it | Prove the projection on drafts (edit-in-place, no side effect); the library card's existing PhaseSpine stays the read for published workflows. | ✓ |
| Add a no-fork read-only canvas door | "View canvas" on the published card without calling createWorkflowDraft. Closes the gap and adds a second real corpus. Cost: the second mount seam just declined. | |
| Nothing — Tweak's fork is fine | Accept that looking mints a draft row. | |

**User's choice:** Accept the gap, defer it
**Notes:** Raised because Tweak calls `createWorkflowDraft` (an INSERT) — so under an
in-Builder-only door, *looking* at a published workflow's canvas would mint a v(N+1) draft row.
Deferred with a re-open trigger at Phase 184 or 188.

---

| Option | Description | Selected |
|--------|-------------|----------|
| No toggle at all — vanish | Flag off ⇒ strip doesn't render, graph column byte-identical; @xyflow subtree out of the render path; DOM-absence assertion is the cheap D-14 proof. | ✓ |
| Toggle visible but disabled | Greyed tab + tooltip. Contradicts the Phase 148 vanish convention and 181's Off|On revert semantics. | |
| You decide | Planner picks, anchored to the vanish convention. | |

**User's choice:** No toggle at all — vanish
**Notes:** Applies to everyone including operators (D-181-01).

---

## Click behaviour + node depth

*(Sketch 135 closed with no winner; 137-D locked the node face, so this covered behaviour + copy.)*

| Option | Description | Selected |
|--------|-------------|----------|
| Selects and opens the existing form panel | Canvas fires the same `onSelectNode(slug)` PhaseSpineGraph already fires → shipped 400px PhaseFormPanel opens. Zero net-new panel work; proves node id == phase.slug (SC#3). | ✓ |
| Selects and blooms in place | Card expands to the full signal set — the 095 tool-card language on a canvas node (sketch 135-C). Cost: net-new expanded-node design duplicating PhaseFormPanel. | |
| Nothing — pure picture | Not clickable. Purest read-only, smallest phase. Cost: SC#3 has no user-visible proof; Canvas feels less capable than the Spine beside it. | |

**User's choice:** Selects and opens the existing form panel
**Notes:** Selection never reorders and never moves a node — read-only stays structural.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Plain-language step-type sentence | One business sentence per phase_type ("Search the knowledge base"); slug behind the ⌥ reveal. Cost: 6 strings that must read well for every workflow. | ✓ |
| Humanised slug + type sentence beneath | De-slugified author's own slug as the title. Describes THIS step. Cost: real slugs include `m1`, `probe` — de-slugified nonsense reads worse than an honest category. | |
| Keep today's fallback | Reuse "AI agent step · retrieve" verbatim. Cost: ships the technical read 137-D was chosen to eliminate. | |

**User's choice:** Plain-language step-type sentence
**Notes:** Driven by the live-data finding that only **10 of 119** phases carry a real `phase.name`,
so the fallback is the dominant case. When `phase.name` is present it still wins.

---

| Option | Description | Selected |
|--------|-------------|----------|
| "Waits for you" — human involvement | Second badge only on `llm_human_input`. Binary, most-needed-before-running, and Phase 185's action-risk checkpoint builds on that same substrate. Every other node stays at one badge. | ✓ |
| Gate count — "3 checks" | Governance density at a glance (the CANVAS-04 rails story). Cost: a number, not a meaning; overlaps the grounding badge. | |
| Deliberable — "Produces a file" | On `llm_emit`, reusing `soulDeliverable()`. Cost: the package mark + title already say it. | |

**User's choice:** "Waits for you" — human involvement
**Notes:** Slot 1 is grounding, always present, **derived** from `citation_policy` + the
`citations_required` gate (sketch 135's derivation) — 183 must not invent Phase 185's authored
`grounding_mode` field. Accessibility: grounding carries a glyph beside the words (never colour
alone).

---

| Option | Description | Selected |
|--------|-------------|----------|
| One canvas-level toggle, flips every node | How sketch 137 drove it; matches the shipped v3.3 two-audience pattern. One state, one assertion. | ✓ |
| Per-node, on hover | Lower commitment. Cost: invisible to keyboard users, untestable without pointer simulation, breaks the mode-you-choose convention. | |
| Always show both | No toggle to build. Cost: reintroduces the technical read on every face. | |

**User's choice:** One canvas-level toggle, flips every node

---

## The missing branch + broken references

*(Driven by the two live-data findings the sketch manifest flagged as MUST-reach-the-plan.)*

| Option | Description | Selected |
|--------|-------------|----------|
| Test fixture only | Hand-authored fixture table: the 4 canonical seeds + 3 PM-pack starters + both 5-phase maxima + the empty draft (all real) + ONE synthetic `branching` entry. No DB seed, no new starter. Cost: a branch edge is never seen by eye in the live app. | ✓ |
| Fixture + a dev-only definition you can open | Adds a local-dev draft row so the branch is visible during UAT. Cost: a seeding step that must never reach cloud; puts a synthetic row in the live corpus. | |
| Ship it as a starter workflow | A permanently-viewable branching example. Cost: a Starter Library / Phase 187 product decision smuggled into a projection phase. | |

**User's choice:** Test fixture only
**Notes:** `skip_to_phase` appears **zero** times across all 95 definitions / 119 phases (only
`fail_run` ×45 and `ask_user` ×2), so SC#1's branch edge is undemonstrable from real data. The
fixture table doubles as the SC#4 faithfulness harness.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Show it as a visibly broken reference | Edge renders as a stub ending in "goes to `<slug>` — no such step". Not a phantom edge (connects to no node), not a lie either. Agrees with the backend's existing `UNSATISFIABLE_SKIP`. | ✓ |
| Keep dropping it silently | Mirror PhaseSpineGraph's `slugSet.has(target)` filter. Cost: renders a broken definition as clean, and 183 doesn't call /validate so nothing surfaces it. | |
| Drop it but count it | Filter the edge, note it in the canvas footer. Cost: reported far from the node that has it. | |

**User's choice:** Show it as a visibly broken reference
**Notes:** Migration 065 dropped a real gate for exactly this reason. Confirmed during the
discussion that `reachability.py:154` already emits `UNSATISFIABLE_SKIP`, so the marker agrees with
the linter and pre-stages Phase 184's per-node badges.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Named empty state, no canvas chrome | "No steps yet" + what to do, on a plain surface; plane/grid/zoom/minimap all suppressed. | ✓ |
| Empty plane with a ghost first step | Shows what the surface becomes; pre-stages 184's add-node. Cost: implies an affordance that doesn't exist — the "broken editor" read to avoid. | |
| Empty plane, chrome intact | One code path, no special case. Cost: sketch 134 tested this and it read as a broken tool. | |

**User's choice:** Named empty state, no canvas chrome
**Notes:** **40 of 95** definitions have zero phases — the most common canvas state, too common to
look like a failure.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Pure function of the definition | `toCanvas(def)` returns fixed-pitch x / lane y, no DOM read ⇒ SC#4 becomes a snapshot test. Clipping solved in CSS (uniform width, card grows down, edges anchor to a fixed top offset). | ✓ |
| Measure the DOM, then position | What sketch 136 did; guarantees no clip. Cost: two-pass render, untestable in jsdom, SC#4 falls back to browser-only verification. | |
| Pure function now, measured pass if it clips | Pragmatic. Cost: leaves the SC#4 test story conditional on something unknown until late. | |

**User's choice:** Pure function of the definition
**Notes:** Surfaced as a genuine conflict between Pitfall 3 (deterministic computed layout) and
sketch 136's measured-height approach. `elkjs` stays deferred to Phase 191.

---

## Shared glyph/parse extraction (G-5)

*(The roadmap asked for this proactively before the 3rd consumer; scouting found the actual debt.)*

| Option | Description | Selected |
|--------|-------------|----------|
| Extract, and repoint PhaseSpineGraph too | Delete the local map, move `parseSkipTarget` + labels into one shared module, point BOTH views at `soulData.PHASE_GLYPHS` + `phaseGlyph()`. The Spine visibly gains the 3D marks. Cost: touches a shipped surface; its tests need updating. | ✓ |
| Extract, leave PhaseSpineGraph alone | Smallest diff, zero regression risk. Cost: two views one toggle apart show different icons for the same step; the stale duplicate survives. | |
| No extraction — canvas imports what exists | Nothing shared created. Cost: a THIRD copy of the parse logic; 184/185 inherit the exact drift the roadmap flagged. | |

**User's choice:** Extract, and repoint PhaseSpineGraph too
**Notes:** Scouting found that `soulData.ts`'s own header claims the `PhaseSpineGraph.tsx:24-31`
duplicate was already replaced — **it wasn't**. That file still renders the flat text glyphs
(`⚙ ✎ 🤖 ⛓ ☺ ◆`) Phase 127 retired, one toggle away from a canvas rendering 3D marks. Recorded as
an anti-drift note for the planner: treat in-code claims of prior extraction as unverified.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Stay separate — a dedicated task | 183 ships with today's robot; the compass swap goes out under its own commit with its own before/after check across the 5 affected surfaces. 183 still ships the in-scope icon-well lightening. | ✓ |
| Ride along in 183 | One less change to sequence; the canvas debuts with the chosen icon. Cost: 5 out-of-scope surfaces change inside a phase whose flag-off promise is byte-identical, and the swap isn't behind the flag. | |
| Ride along, but gated on the flag | Preserves byte-identical exactly. Cost: a flag-conditional glyph map in a deliberately shared single-source module — two icon vocabularies depending on a flag. | |

**User's choice:** Stay separate — a dedicated task
**Notes:** Asked because 183 is now editing that vocabulary anyway, which weakened the sketch's
original separation argument — but the five-shipped-surfaces blast radius (workflows-page card, run
+ publish soul headers, gauntlet stages, live step cards) held. A canvas rollback must not silently
revert an app-wide icon decision.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Client parse + a pinned parity test | Parse locally (instant render, works on an unsaved draft); a test pins the client parse against `reachability.parse_skip_target` over a shared case table. Topology derivation isn't a lint rule, so D-182-06 holds. | ✓ |
| Call the 182 seam for the edge set | Literally one parse in the system. Cost: no render without a round trip; an unsaved draft needs a POST; 183 acquires a backend dependency the roadmap says it doesn't need. | |
| Client parse, no parity test | Five lines mirroring five lines. Cost: exactly how the current duplicate started. | |

**User's choice:** Client parse + a pinned parity test
**Notes:** Case table pinned both sides: `skip_to_phase:escalate` → `escalate`;
`skip_to_phase:a:b` → `b` (the `lastIndexOf(":")` split); `skip_to_phase:` → null; whitespace
trimmed; `fail_run` / `ask_user` / `retry` → null. Backend function confirmed at
`reachability.py:89`.

---

## G-4 lived-experience UAT scenarios (operator-selected at scope time)

All four selected — every one must be driven live at phase verification:

1. **Spine ⇄ Canvas shows the same steps** — flip the toggle both ways on a real draft; same steps,
   same order, same icons. The drift the G-5 repoint exists to prevent.
2. **The 5-phase maximum reads** — `eval_coverage` (~1,600px wide per 136-B): legible titles, no
   horizontal page overflow, `○ end` cap visible.
3. **The empty draft doesn't look broken** — one of the 40 zero-phase drafts reads as "nothing here
   yet", no stray grid/zoom pills/minimap.
4. **Flag off = the Builder I had yesterday** — operator flips to Off, reloads, toggle gone and the
   graph column unchanged, including on an operator account.

## Claude's Discretion

- Exact wording of the six plain-language step-type sentences (anchored to 137-D).
- The shared vocabulary module's file name and home.
- Fixed-pitch / lane-height constants, node width, edge-anchor offset.
- React Flow chrome on a NON-empty canvas — grid opacity, docked vs reveal-on-interaction zoom
  controls, conditional minimap (the empty state is NOT discretionary).
- How read-only is *told* on a non-empty canvas (`👁 View only` badge and/or the cursor contract).
- Whether the `@xyflow/react` chunk is lazy-loaded behind the toggle.
- Wave / plan decomposition and test file split.

## Deferred Ideas

- A no-fork read-only canvas door for PUBLISHED workflows → Phase 184 or 188.
- The `NAV_ITEMS` entry tagged `visual_workflow_canvas` → released; re-open only if a standalone
  canvas ActiveView ever ships.
- The cross-cutting icon slug swaps (`llm_agent` → compass; `llm_batch_agents` → handshake) → a
  small dedicated `/gsd:quick` task.
- Flipping Canvas to the default view → Phase 184.
- Persisting the Spine/Canvas view preference → revisit if operators ask.
- `elkjs` auto-layout → Phase 191 (STRETCH).
- A branching example as a shipped starter workflow → Starter Library / Phase 187.
- `workflow_layouts` side table / migration slot 114 → Phase 184, sketch-conditional.
