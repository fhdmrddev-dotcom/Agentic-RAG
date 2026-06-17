---
sketch: 019
name: draft-refine-and-readonly-graph
question: >
  How do you refine a one-shot draft by FORM (talk available) and see it as a
  READ-ONLY graph — a linear phase_index spine plus dashed skip_to_phase
  failure-branches — without any drag-canvas or a richer DAG than the schema
  actually has?
winner: "D"
tags: [phase-103, workflow-studio, read-only-graph, refine-by-form, phase-types, llm-emit, net-new]
---

# Sketch 019 — Draft Refine + Read-Only Graph

## Design Question

After 018 drafts a whole `WorkflowDefinition` in one shot and sets the strictness
dial, how does the author **refine it by FORM** (per-phase fields conditioned on
`phase_type`, with talk available for big moves) and **see it as a READ-ONLY
graph** — a linear `phase_index` spine (solid `i→i+1` edges) plus the single
non-linear edge the schema actually supports (a dashed `skip_to_phase` parsed
from a validator `on_failure`)? No drag-canvas, no connection handles, no `+`
add-node affordance, no `depends_on` arrows or parallel lanes (they have zero
schema backing — `max_parallel_agents` is internal fan-out *within* one
`llm_batch_agents` node, not a graph branch).

## How to View

Open `index.html` in a browser (links `../themes/default.css`). Use the **sticky
tab bar** (top) to switch variants A / B / C. Use the **bottom-right toolbar** to
cycle the flow state: `draft → grey-area → resolved`. Click any node to open its
per-phase form; click `💬 talk for a big move` for the talk popover. Hover the
`ⓘ` chips for non-blocking term popovers.

## Variants

- **A — Vertical spine** — phases top-to-bottom (matches the run-time
  `PhaseTimeline` reading); clicking a node expands its form inline, beneath the
  node. Dashed `skip_to_phase` shown as an on-fail arc label under the gated node.
- **B — Horizontal flow** — left-to-right GitHub-Actions / Dagster-style node
  pills with an SVG edge overlay (solid spine + one dashed curved skip edge);
  clicking a node opens its form in a right-side inspector.
- **C — Form-hero + mini-graph rail** — the per-phase form dominates the canvas;
  a compact vertical `phase_index` rail on the left is the navigable index you
  click (or prev/next through) to jump phases.
- **D — Synthesis: spine + side-panel form ★ recommended** — the synthesis of
  **A + B**: A's full VERTICAL `phase_index` spine on the left (same node
  vocabulary, same solid `i→i+1` edges, the same one dashed `on fail →
  skip_to_phase` branch, the same "View only · no `depends_on` / no parallel
  lanes" legend — reused verbatim), but clicking a node opens THAT node's
  `phase_type`-conditioned form in a **fixed-width** (~400px) inspector on the
  right (B's `formBody` reused verbatim). The panel is **PUSH/SPLIT** — the graph
  column shrinks to make room (`grid-template-columns: minmax(0,1fr) 400px`),
  exactly like the app's existing right-side workspace panel — **never an overlay
  and never a slider**. The `minmax(0,1fr)` graph track is what guarantees the
  fixed panel + flexible graph **always fit with no horizontal scrollbar at any
  desktop width** (verified down to 1100px). At rest (no node selected) the panel
  collapses to a thin 44px rail so the resting graph reads clean (3-second test);
  the open node still glows as the selection anchor and a ✕ back-control returns
  the graph to full width. Mobile: the panel becomes a bottom-sheet (matching the
  app) — noted in CSS, not over-built.

**Winner — D (locked):** the synthesis is the pick. Operator chose **D**
(the vertical-spine + side-panel-form synthesis) over **A** (form opens *inline*
under the node, single-column, everything in one scroll). D opens the form in a
*side-panel*, push/split, so the graph stays a clean read-only spine while you
edit. `winner: "D"` — locked.

## What to Look For

- **Refine-by-FORM, conditioned on `phase_type`** — the form opens per-node on
  click (never a permanent wall of all fields). `programmatic` shows only
  `{fn, input_keys}` (no model/tools/scope); `llm_single` shows
  `{prompt, model, temperature, folder_scope, skill_ref}`; `llm_agent` adds the
  `available_tools` whitelist + `max_steps` + `wall_clock_seconds`;
  `llm_batch_agents` adds `max_parallel_agents` + `merge_strategy`;
  `llm_human_input` shows only `{prompt, options, timeout_seconds}` (no
  model/tools); `llm_emit` shows `{prompt, emitter, citation_policy,
  integrity_policy(greyed), folder_scope}` + the template placeholders.
- **All SIX real phase types in ONE graph** — `programmatic ⚙` → `llm_agent 🤖`
  → `llm_batch_agents ⛓` (violet accent) → `llm_single ✎` → `llm_human_input ☺`
  → `llm_emit ◆` (the visually-distinct deliverable terminus with the citation
  badge).
- **The read-only graph honesty** — a "View only · inspect, don't drag" label;
  solid edges are run-order `i→i+1`; the ONLY non-linear edge is the dashed
  `on fail → skip_to_phase` branch off the freshness gate on the search phase.
  No add-node `+`, no connection handles, no drag anywhere. An explicit legend
  reads "no depends_on · no parallel lanes."
- **No silent substitution** — the `grey-area` state surfaces an "I read X as Y —
  confirm before it binds" checkpoint for the one folder reference that had to be
  resolved against the real tree. Clearing it binds the real folder name + bound
  id.
- **Grounding fidelity** — every `folder_scope` renders the REAL folder name +
  bound id (`Vendor Risk — 2026 Reviews / Assessments` `fld_a8d2e0`), never a
  path/prose; `available_tools` render as real registry tool chips; the
  `llm_emit` template placeholders link back to the 018 fill-contract.
- **Honesty caveats encoded in the UI** — `NET-NEW · no graph lib` header tag
  (plain HTML/CSS + one SVG overlay); `integrity_policy` greyed with "coming with
  Phase 106"; real `citation_policy` enums only (`strict|flag|partial|draft`)
  with their true post-verdict dispositions; talk is "available for big moves"
  but the surface stays read-only.
