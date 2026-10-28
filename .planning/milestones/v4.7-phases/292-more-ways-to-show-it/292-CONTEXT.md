# Phase 292: More Ways to Show It - Context

**Gathered:** 2026-10-24
**Status:** Ready for planning
**Mode:** autonomous (operator: "continue by yourself end to end"). The visual and set decisions were
made by the operator at the G-2 sketch on 2026-10-24 (`.planning/sketches/292-more-ways-to-show-it/`);
everything else below is Claude's call, taken as the recommended default and logged in
`292-DISCUSSION-LOG.md`.

<domain>
## Phase Boundary

The chat agent can show three more kinds of interactive artifact, `diagram`, `comparison` and
`timeline`, through the existing `show_artifact` tool. Each comes from the same closed, reviewed
registry Phase 273 shipped (`chart`, `table`, `metric`), so the registry goes from **3 to 6**
components. The tool count stays **30**.

In scope: the three components end to end (backend validation, persistence, tool schema and
description, frontend guard, renderer, notice, reload), plus a migration that widens the
`message_artifacts` CHECK literals.

Out of scope: sandboxed agent-authored HTML/React (SEED-337 direction B; needs its own operator
decision), `steps` (rejected at the sketch), and any change to chart/table/metric behaviour.

</domain>

<decisions>
## Implementation Decisions

### The closed set (SC#1, chosen at the sketch, operator 2026-10-24)
- **D-01: The set is exactly `diagram`, `comparison`, `timeline`.** Why each one earns its place:
  - **diagram** explains how things connect (a process, a dependency, an approval chain). Today the
    agent falls back to prose or a PNG for this.
  - **comparison** answers "compare A and B" with a per-cell verdict and a visible "not stated".
    A table cannot show a verdict or the absence of a term.
  - **timeline** shows dated events that have no number to chart (contract history, deadlines).
    A line chart needs a y-value these events do not have.
- **D-02: Rejected at the sketch, with reasons kept on the sketch page:** `steps` (a markdown list
  gets close), code block and rich document (markdown already renders them), pie/donut and KPI grid
  (decided in 273 D-05/D-13), image (SEED-194), map, sandboxed HTML (SEED-337 B). ⛔ None of these is
  added in this phase, however easy.

### Data contracts (what the model sends)
- **D-03: Each new type gets its own typed fields, not the `columns`/`rows` dataset.** The sketch
  contracts are node/edge, option/term/cell and event lists, and forcing them into tabular rows would
  lose node kinds and cell verdicts. Each is a new arm of the discriminated union on `component`, every
  model `extra="forbid"` (273 D-02 holds: no `props: dict`, no passthrough).
- **D-04: diagram:** `nodes[{id, label, kind?}]` and `edges[{from, to, label?}]`.
  - At most **25 nodes** and **40 edges**.
  - ⛔ The model sends no coordinates, no SVG, no Mermaid text. Layout is our code.
  - `kind` is a closed small enum (Claude's discretion on the literals, e.g. `step | decision | start
    | end | actor`), never a free colour or style.
  - An edge naming an unknown node id, a duplicate node id, or a self-loop with no label is a worded
    refusal.
  - Back edges (cycles) are allowed and are drawn dashed on the right (sketch 2A).
  - Above 25 nodes the refusal tells the model to group nodes (sketch Screen 5 "too many nodes then
    grouped").
- **D-05: comparison:** `options[]` (column headers) and `terms[{name, cells[{verdict, text?}]}]`,
  one cell per option, in option order.
  - `verdict` is the closed enum `y | n | m | q`: **favourable / unfavourable / neutral / not
    stated in the document**, the approved sketch's key (`index.html` `GL` table). ✓ ✗ – ? glyphs;
    the glyph SHAPE carries the verdict, not colour alone. The `show_artifact` description defines
    the four the same way. (Corrected at UI-SPEC, 2026-10-24: the first draft of this line said
    "yes / no / partly", which contradicted the sketch.)
  - `q` renders as italic "Not stated", never a blank cell.
  - Caps: **2-5 options**, **1-20 terms**, cell text at most the existing `MAX_CELL_CHARS` (200).
  - A term whose cell count differs from the option count is a worded refusal.
- **D-06: timeline:** `events[{date, title, detail?, category?, deadline?}]`.
  - `date` is ISO `YYYY-MM-DD` or `YYYY-MM`; anything else is a worded refusal.
  - At most **40 events**. `deadline` is a boolean.
  - Events are sorted by our code, not trusted in model order.
  - ⛔ "Today" is computed by our code at render time, never supplied by the model.
- **D-07: Per-element source, optional.** A node, a comparison cell and a timeline event may carry a
  `source` handle that points at a result retrieved **earlier in the same turn**. The server resolves
  it to `{document, page, excerpt}` and stores the resolved value in the spec.
  - ⛔ The model never writes a document name, page or clause text into the spec. The hover clause is
    the server-resolved excerpt.
  - An unresolvable handle is a worded refusal (273 D-12: the model gets the first chance to fix it).
  - With no retrieval in the turn, elements carry no source and the caption says "Values provided by
    the agent", as in 273.
  - The handle format (citation index, chunk id, or other) is for research to settle from what
    `search_documents` / `query_documents` already show the model. It must survive history
    reconstruction's 2,000-char cut.
- **D-08: No by-reference re-encode for the new types.** `from_artifact` and `transform` (273
  D-06/D-07) stay chart/table/metric only. A `from_artifact` call naming a diagram, comparison or
  timeline, or turning a tabular artifact into one, is a worded refusal ("send the data again").
  This keeps D-07's closed transforms tabular and avoids a new conversion matrix.

### Tool, schema and prompt (SC#4)
- **D-09: `show_artifact` is extended by registry entries only.** The `component` enum gains the
  three names. The schema gains the new optional fields (`diagram`, `comparison`, `timeline` objects,
  or flat arrays; research picks the Gemini-safe shape: no `type` arrays, `additionalProperties`
  stripped at `google_service.py`). **No new tool. Tool count stays 30**, pinned by the existing
  closed-core inventory tests.
- **D-10: Guidance lives in the `show_artifact` tool description** (273 D-11/D-15 precedent): when to
  pick each of the six, and "use a table for anything else". ⛔ `SYSTEM_PROMPT` is untouched.
- **D-11: History bloat (273 I-4).** If the new payloads are re-sent in persisted tool-call args on
  every later turn, extend 273's args rewrite so they are replaced by the stored-artifact placeholder
  the same way `rows` are. Research measures the size first; the new caps keep each payload to a few
  KB, so this is a consistency call rather than a cost emergency.

### Persistence and migration
- **D-12: One migration, the next free number (`213`, measured today: `ls supabase/migrations`
  ends at `212_app_settings_harness_authoring_model.sql`; re-run `ls` at planning).** It widens:
  - the `component IN (…)` CHECK to the six names;
  - the `label` regex to `(chart|table|metric|diagram|comparison|timeline) N`;
  - nothing else. `row_count` keeps `BETWEEN 1 AND 500` and means nodes / terms / events for the new
    types.
  - Apply via the local SQL editor, regenerate `full-schema.sql`, run `get_advisors(security)`
    against local. Cloud apply is the deploy step, never this phase.
  - No new table, no new function. RLS is unchanged.
- **D-13: Labels are `diagram N`, `comparison N`, `timeline N`,** assigned per component per thread
  by the existing advisory-locked path (273 UI-D-03). The backend and frontend label regexes change
  in the same commit as the migration.
- **D-14: The persisted spec gets one new arm per type** in `StoredArtifactSpec`, versioned by the
  existing `spec_version`. Live and reload render from the same persisted spec through the same
  component (273 I-2).

### Rendering (sketch winners, operator 2026-10-24)
- **D-15: All three live inside the shipped 273 frame:** the framed card, the kind chip, the `name N`
  chip, the server-derived caption, the amber refusal step in the rail, then the dashed notice.
- **D-16: diagram = 2A, top-down flow.**
  - Our own layered layout: rank by longest path; back edges drawn dashed on the right.
  - Rendered as React SVG elements. ⛔ No `dangerouslySetInnerHTML`, no Mermaid or other layout
    dependency.
  - Fits the chat column at every viewport; never scrolls sideways.
  - Hovering a node lights its edges and shows the source excerpt.
- **D-17: comparison = 3A, matrix.**
  - Options as columns, terms as rows, an "Only terms that differ" toggle.
  - Every cell shows the glyph plus its short text; the excerpt on hover.
  - The caption's second line says the verdicts are the agent's reading.
- **D-18: timeline = 4A, vertical rail.**
  - Gaps of 6 months or more show as a labelled dashed segment.
  - Our code inserts a **Today** row that splits past from upcoming.
  - Upcoming dots are hollow. A deadline gets an amber ring and an "in N days" pill.
  - "Same on reload" (SC#3) means the same persisted spec and the same events. The Today row and
    "in N days" are computed from the viewer's clock, so they move with the date by design.
- **D-19: No new frontend dependency.** The guard stays hand-rolled in `artifactSpec.ts` (273
  precedent), with one arm per new type. The registry lookup stays behind `own()`.

### Refusals (SC#2)
- **D-20: The 273 refusal rules carry over unchanged.** A type outside the six, or bad props, is a
  worded tool error the model can retry; only after that does the dashed "This artifact can't be
  shown" notice appear. ⛔ Never JSON, a spec key, or markup in the notice. The answer text still
  renders. Every new refusal reason gets plain words in `artifactCopy.ts` and in the backend `_R`
  table.

### G-4 lived-experience scenarios (Chrome MCP drives each at verification; assert rendered content)
- **D-21 / G4-1: Diagram.** "How does our invoice approval work?" against a real KB document. A
  top-down diagram renders, node labels match the document, hovering a node lights its edges, and no
  sideways scroll at a phone-width viewport.
- **D-22 / G4-2: Comparison.** "Compare these two contracts on termination, liability and renewal."
  A matrix renders with a verdict glyph per cell, at least one "Not stated" in italics, and the
  "Only terms that differ" toggle hides the identical rows.
- **D-23 / G4-3: Timeline.** "Show the history and upcoming deadlines of this contract." A vertical
  rail renders with a Today row, hollow future dots, and an amber deadline with "in N days".
- **D-24 / G4-4: Unknown type is refused.** Force a component outside the six (dev hook or crafted
  stored row). The model gets a worded refusal; a bad stored row shows only the notice, never JSON.
- **D-25 / G4-5: Reload is identical.** Reload each thread above. The same artifacts render from the
  persisted spec, with the caption intact, checked on **at least two native providers** (SC#3).

### SC#10 board
- **D-26: 8 rows, derived from `MODEL_CAPABILITIES`** (newest registry-backed model per provider plus
  OpenRouter), never re-typed. Each row runs **one** real turn that asks for a diagram, a comparison
  and a timeline (the multi-tool axis). Each row is scored on whether each of the three types was
  emitted with a valid spec and rendered. Blocked rows are recorded ⛔ with the reason, never omitted.
  Method: per-request `model`/`provider` on `POST /threads/{id}/messages`, with verdicts read from
  `message_artifacts`. The parallel-thread and long-message axes reuse one row each.
  - ⚠ Moonshot/Kimi are `emit_tier: coerce`, the likeliest rows to emit malformed nested args.

### Binding invariants (research and planning keep them)
- **I-1 (from 273): the registry is closed code.** Backend `ComponentName`, the migration CHECK, the
  frontend `ComponentName` and `REGISTRY` change together, fenced by the existing `?raw` parity test
  (`frontend/src/components/chat/__tests__/artifactParity.fence.test.ts`), which must now pin six.
- **I-2 (from 273): live and reload share one persisted spec and one renderer.**
- **I-3: model-supplied strings render as text only.** Labels, titles, cell text and event detail
  go through React text nodes, never HTML. The spec guard rejects anything the renderer would not
  draw, so a component never receives an unvalidated prop. (This is the roadmap's first failure mode.)
- **I-4: tool count 30.** Any test that pins the tool inventory must still read 30.

### Claude's Discretion
- The exact nested-vs-flat field shape of the new args, within Gemini's schema limits.
- The `kind` literals for diagram nodes, and their visual treatment within the sketch.
- The per-element `source` handle format (D-07), chosen by research.
- Whether the I-4 args rewrite is extended (D-11), decided from the measured size.
- Byte caps per new payload, inside the existing `MAX_SPEC_BYTES`.
- Exact refusal and caption wording, within the sketch's tone.
- Plan count: target **3** (G-8). Suggested waves:
  1. backend: models, validation, source resolution, tool schema and description, migration 213,
     label regex;
  2. frontend: guard arms, three renderers, registry, copy, parity fence (parallel with wave 1,
     since the contracts are locked here);
  3. live: SC#10 board plus the G-4 drive and reload proof.

### Folded seeds
- **SEED-337** (direction A only). Phase 292 is the "next phase after 273 that touches the artifact
  registry" its trigger names. Direction B stays planted with its own trigger (an operator decision).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The decision for this phase
- `.planning/sketches/292-more-ways-to-show-it/README.md` — the operator's winners (set, 2A, 3A, 4A,
  refusals) and the data contracts.
- `.planning/sketches/292-more-ways-to-show-it/index.html` — the approved visuals; screens 2-5 are the
  acceptance bar for the renderers.
- `.planning/seeds/SEED-337-artifact-vocabulary-v2-more-closed-components-then-sandboxed-html.md` —
  A vs B, and why B is a separate decision.

### The contract this extends (Phase 273)
- `.planning/milestones/v4.5-phases/273-agent-authored-artifacts/273-CONTEXT.md` — D-01..D-21 and
  I-1..I-5; every one still binds the original three.
- `.planning/milestones/v4.5-phases/273-agent-authored-artifacts/273-UI-SPEC.md` — the frame, chips,
  caption, rail step and notice (UI-D-01..10).
- `.planning/milestones/v4.5-phases/273-agent-authored-artifacts/273-RESEARCH.md` — the per-provider
  schema findings (Gemini, history-arg rewrite safety).
- `.planning/milestones/v4.5-phases/273-agent-authored-artifacts/273-REVIEW.md` — the defects found
  last time (CR-01 infinite bounds, WR-07 label phrasing): do not reintroduce them.

### Code to extend
- `backend/app/models/artifact.py` — the union, caps, refusal table `_R`, `StoredArtifactSpec`.
- `backend/app/services/show_artifact_tool.py` — the handler, `build_caption`, label assignment.
- `backend/app/services/openai_service.py` §`show_artifact` (around line 1167) — the tool schema and
  description; enums derive from the Literals.
- `backend/app/services/google_service.py` — Gemini schema stripping (around lines 243-250).
- `supabase/migrations/202_message_artifacts.sql` — the CHECKs migration 213 widens.
- `frontend/src/components/chat/artifacts/` — `artifactSpec.ts`, `artifactRegistry.ts`,
  `artifactCopy.ts`, `ArtifactFrame.tsx`, `ArtifactBlock.tsx`, `captionModel.ts`.
- `frontend/src/components/chat/__tests__/artifactParity.fence.test.ts` — the backend/frontend parity
  fence.

### Project rules
- `CLAUDE.md` — migration discipline, UAT scoreboard recipe (SC#10), G-4, G-8, provider-docs-first.
- `.claude/skills/sketch-findings-agentic-rag/SKILL.md` — icon convention and chat-surface rules.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`ArtifactFrame` / `ArtifactBlock` / `ArtifactNotice` / `ArtifactErrorBoundary`**: the whole
  frame, chips, caption slot and notice. A new type adds a body renderer only.
- **`build_caption(turn_tool_calls, row_count)`**: already resolves this turn's data-bearing calls
  to `{tool, document, page}`. D-07's per-element source resolution should reuse the same walk over
  `turn_tool_calls`.
- **`own()` (`components/workflows/ownProperty.ts`)**: the prototype-safe registry lookup.
- **`_R` refusal table + `ArtifactRefusal` + `_raise`**: the worded-refusal mechanism; new reasons
  are new entries.
- **`_check_js_len` / `_js_len`**: UTF-16 length checks that match the browser; reuse for every new
  string cap.

### Established Patterns
- Discriminated union on `component`, `extra="forbid"`, `_decode_once` for providers that send
  nested JSON as strings (`_decode_nested`). The new nested fields need the same decode.
- Tool-schema enums are derived from the Python Literals, so widening `ComponentName` widens the
  schema enum.
- Recharts is lazy-loaded so it stays out of the chat chunk. The new renderers are plain SVG/DOM and
  can load eagerly, unless the bundle check says otherwise.

### Integration Points
- `message_artifacts` (migration 202): `component` CHECK, `label` regex, `row_count` 1-500,
  `octet_length(spec) <= 262144`, immutable trigger.
- The `artifact` SSE event and the one `<ArtifactBlock>` mount in `MessageItem.tsx`: unchanged; the
  new types ride the same event.
- Reload mapping in `frontend/src/lib/api/threads.ts`: unchanged if the spec stays one JSON blob.

### Hot files (G-5)
- `artifact.py` and `show_artifact_tool.py` are young (3 commits, Phase 273 only) and already have
  ledger rows. `openai_service.py` FIRES (41 phases) and is touched only in the `show_artifact`
  description and enum, honoured by construction. Run `node scripts/check-hot-file-ledger.cjs` at
  planning.

</code_context>

<specifics>
## Specific Ideas

- The sketch fixtures (invoice approval flow with 8 nodes / 9 edges, 3 contracts × 7 terms, a
  contract history with 9 events) are good fixture sources for unit tests and the G-4 prompts.
- Verdict glyphs: ✓ yes · ✗ no · – partly · ? not stated. Shape carries meaning, colour supports it.
- "Today" row and "in N days" pill come from the viewer's clock.

</specifics>

<deferred>
## Deferred Ideas

- **SEED-337 direction B, sandboxed agent-authored HTML/React.** Needs its own operator decision
  (origin isolation, CSP, postMessage contract). Stays planted.
- **`steps` component.** Rejected at the sketch; re-open only if users ask for per-step sources that a
  markdown list cannot carry.
- **Swimlane diagram (sketch 2B) and true-time horizontal timeline (sketch 4B).** Lost to 2A/4A;
  re-open if a real user needs owners per lane or true spacing for dense contract history.
- **By-reference re-encode for the new types** (D-08). Re-open if users ask to "filter that timeline"
  or "turn that table into a comparison".
- **Image (SEED-194), map, KPI grid, pie/donut.** Unchanged; each keeps its own seed or 273 decision.

</deferred>

---

*Phase: 292-more-ways-to-show-it*
*Context gathered: 2026-10-24*
