# Phase 292: More Ways to Show It - Research

**Researched:** 2026-10-24
**Domain:** Closed-registry agent-authored artifacts (pydantic union + tool schema + Postgres CHECK + hand-rolled TS guard + React SVG/DOM renderers)
**Confidence:** HIGH for every code-path finding (measured at HEAD `552f7b73c`); MEDIUM for two live-only behaviours (Gemini server-side acceptance of one more nesting level; coerce-tier nested stringification), both of which the board measures.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**The closed set (SC#1, chosen at the sketch, operator 2026-10-24)**
- **D-01: The set is exactly `diagram`, `comparison`, `timeline`.** Why each one earns its place:
  - **diagram** explains how things connect (a process, a dependency, an approval chain). Today the agent falls back to prose or a PNG for this.
  - **comparison** answers "compare A and B" with a per-cell verdict and a visible "not stated". A table cannot show a verdict or the absence of a term.
  - **timeline** shows dated events that have no number to chart (contract history, deadlines). A line chart needs a y-value these events do not have.
- **D-02: Rejected at the sketch, with reasons kept on the sketch page:** `steps` (a markdown list gets close), code block and rich document (markdown already renders them), pie/donut and KPI grid (decided in 273 D-05/D-13), image (SEED-194), map, sandboxed HTML (SEED-337 B). ⛔ None of these is added in this phase, however easy.

**Data contracts (what the model sends)**
- **D-03: Each new type gets its own typed fields, not the `columns`/`rows` dataset.** The sketch contracts are node/edge, option/term/cell and event lists, and forcing them into tabular rows would lose node kinds and cell verdicts. Each is a new arm of the discriminated union on `component`, every model `extra="forbid"` (273 D-02 holds: no `props: dict`, no passthrough).
- **D-04: diagram:** `nodes[{id, label, kind?}]` and `edges[{from, to, label?}]`.
  - At most **25 nodes** and **40 edges**.
  - ⛔ The model sends no coordinates, no SVG, no Mermaid text. Layout is our code.
  - `kind` is a closed small enum (Claude's discretion on the literals, e.g. `step | decision | start | end | actor`), never a free colour or style.
  - An edge naming an unknown node id, a duplicate node id, or a self-loop with no label is a worded refusal.
  - Back edges (cycles) are allowed and are drawn dashed on the right (sketch 2A).
  - Above 25 nodes the refusal tells the model to group nodes (sketch Screen 5 "too many nodes then grouped").
- **D-05: comparison:** `options[]` (column headers) and `terms[{name, cells[{verdict, text?}]}]`, one cell per option, in option order.
  - `verdict` is the closed enum `y | n | m | q` (yes / no / partly / not stated). ✓ ✗ – ? glyphs; the glyph SHAPE carries the verdict, not colour alone.
  - `q` renders as italic "Not stated", never a blank cell.
  - Caps: **2-5 options**, **1-20 terms**, cell text at most the existing `MAX_CELL_CHARS` (200).
  - A term whose cell count differs from the option count is a worded refusal.
- **D-06: timeline:** `events[{date, title, detail?, category?, deadline?}]`.
  - `date` is ISO `YYYY-MM-DD` or `YYYY-MM`; anything else is a worded refusal.
  - At most **40 events**. `deadline` is a boolean.
  - Events are sorted by our code, not trusted in model order.
  - ⛔ "Today" is computed by our code at render time, never supplied by the model.
- **D-07: Per-element source, optional.** A node, a comparison cell and a timeline event may carry a `source` handle that points at a result retrieved **earlier in the same turn**. The server resolves it to `{document, page, excerpt}` and stores the resolved value in the spec.
  - ⛔ The model never writes a document name, page or clause text into the spec. The hover clause is the server-resolved excerpt.
  - An unresolvable handle is a worded refusal (273 D-12: the model gets the first chance to fix it).
  - With no retrieval in the turn, elements carry no source and the caption says "Values provided by the agent", as in 273.
  - The handle format (citation index, chunk id, or other) is for research to settle from what `search_documents` / `query_documents` already show the model. It must survive history reconstruction's 2,000-char cut.
- **D-08: No by-reference re-encode for the new types.** `from_artifact` and `transform` (273 D-06/D-07) stay chart/table/metric only. A `from_artifact` call naming a diagram, comparison or timeline, or turning a tabular artifact into one, is a worded refusal ("send the data again"). This keeps D-07's closed transforms tabular and avoids a new conversion matrix.

**Tool, schema and prompt (SC#4)**
- **D-09: `show_artifact` is extended by registry entries only.** The `component` enum gains the three names. The schema gains the new optional fields (`diagram`, `comparison`, `timeline` objects, or flat arrays; research picks the Gemini-safe shape: no `type` arrays, `additionalProperties` stripped at `google_service.py`). **No new tool. Tool count stays 30**, pinned by the existing closed-core inventory tests.
- **D-10: Guidance lives in the `show_artifact` tool description** (273 D-11/D-15 precedent): when to pick each of the six, and "use a table for anything else". ⛔ `SYSTEM_PROMPT` is untouched.
- **D-11: History bloat (273 I-4).** If the new payloads are re-sent in persisted tool-call args on every later turn, extend 273's args rewrite so they are replaced by the stored-artifact placeholder the same way `rows` are. Research measures the size first; the new caps keep each payload to a few KB, so this is a consistency call rather than a cost emergency.

**Persistence and migration**
- **D-12: One migration, the next free number (`213`, measured today: `ls supabase/migrations` ends at `212_app_settings_harness_authoring_model.sql`; re-run `ls` at planning).** It widens:
  - the `component IN (…)` CHECK to the six names;
  - the `label` regex to `(chart|table|metric|diagram|comparison|timeline) N`;
  - nothing else. `row_count` keeps `BETWEEN 1 AND 500` and means nodes / terms / events for the new types.
  - Apply via the local SQL editor, regenerate `full-schema.sql`, run `get_advisors(security)` against local. Cloud apply is the deploy step, never this phase.
  - No new table, no new function. RLS is unchanged.
- **D-13: Labels are `diagram N`, `comparison N`, `timeline N`,** assigned per component per thread by the existing advisory-locked path (273 UI-D-03). The backend and frontend label regexes change in the same commit as the migration.
- **D-14: The persisted spec gets one new arm per type** in `StoredArtifactSpec`, versioned by the existing `spec_version`. Live and reload render from the same persisted spec through the same component (273 I-2).

**Rendering (sketch winners, operator 2026-10-24)**
- **D-15: All three live inside the shipped 273 frame:** the framed card, the kind chip, the `name N` chip, the server-derived caption, the amber refusal step in the rail, then the dashed notice.
- **D-16: diagram = 2A, top-down flow.**
  - Our own layered layout: rank by longest path; back edges drawn dashed on the right.
  - Rendered as React SVG elements. ⛔ No `dangerouslySetInnerHTML`, no Mermaid or other layout dependency.
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
  - "Same on reload" (SC#3) means the same persisted spec and the same events. The Today row and "in N days" are computed from the viewer's clock, so they move with the date by design.
- **D-19: No new frontend dependency.** The guard stays hand-rolled in `artifactSpec.ts` (273 precedent), with one arm per new type. The registry lookup stays behind `own()`.

**Refusals (SC#2)**
- **D-20: The 273 refusal rules carry over unchanged.** A type outside the six, or bad props, is a worded tool error the model can retry; only after that does the dashed "This artifact can't be shown" notice appear. ⛔ Never JSON, a spec key, or markup in the notice. The answer text still renders. Every new refusal reason gets plain words in `artifactCopy.ts` and in the backend `_R` table.

**G-4 lived-experience scenarios (Chrome MCP drives each at verification; assert rendered content)**
- **D-21 / G4-1: Diagram.** "How does our invoice approval work?" against a real KB document. A top-down diagram renders, node labels match the document, hovering a node lights its edges, and no sideways scroll at a phone-width viewport.
- **D-22 / G4-2: Comparison.** "Compare these two contracts on termination, liability and renewal." A matrix renders with a verdict glyph per cell, at least one "Not stated" in italics, and the "Only terms that differ" toggle hides the identical rows.
- **D-23 / G4-3: Timeline.** "Show the history and upcoming deadlines of this contract." A vertical rail renders with a Today row, hollow future dots, and an amber deadline with "in N days".
- **D-24 / G4-4: Unknown type is refused.** Force a component outside the six (dev hook or crafted stored row). The model gets a worded refusal; a bad stored row shows only the notice, never JSON.
- **D-25 / G4-5: Reload is identical.** Reload each thread above. The same artifacts render from the persisted spec, with the caption intact, checked on **at least two native providers** (SC#3).

**SC#10 board**
- **D-26: 8 rows, derived from `MODEL_CAPABILITIES`** (newest registry-backed model per provider plus OpenRouter), never re-typed. Each row runs **one** real turn that asks for a diagram, a comparison and a timeline (the multi-tool axis). Each row is scored on whether each of the three types was emitted with a valid spec and rendered. Blocked rows are recorded ⛔ with the reason, never omitted. Method: per-request `model`/`provider` on `POST /threads/{id}/messages`, with verdicts read from `message_artifacts`. The parallel-thread and long-message axes reuse one row each.
  - ⚠ Moonshot/Kimi are `emit_tier: coerce`, the likeliest rows to emit malformed nested args.

**Binding invariants (research and planning keep them)**
- **I-1 (from 273): the registry is closed code.** Backend `ComponentName`, the migration CHECK, the frontend `ComponentName` and `REGISTRY` change together, fenced by the existing `?raw` parity test (`frontend/src/components/chat/__tests__/artifactParity.fence.test.ts`), which must now pin six.
- **I-2 (from 273): live and reload share one persisted spec and one renderer.**
- **I-3: model-supplied strings render as text only.** Labels, titles, cell text and event detail go through React text nodes, never HTML. The spec guard rejects anything the renderer would not draw, so a component never receives an unvalidated prop. (This is the roadmap's first failure mode.)
- **I-4: tool count 30.** Any test that pins the tool inventory must still read 30.

### Claude's Discretion
- The exact nested-vs-flat field shape of the new args, within Gemini's schema limits.
- The `kind` literals for diagram nodes, and their visual treatment within the sketch.
- The per-element `source` handle format (D-07), chosen by research.
- Whether the I-4 args rewrite is extended (D-11), decided from the measured size.
- Byte caps per new payload, inside the existing `MAX_SPEC_BYTES`.
- Exact refusal and caption wording, within the sketch's tone.
- Plan count: target **3** (G-8). Suggested waves:
  1. backend: models, validation, source resolution, tool schema and description, migration 213, label regex;
  2. frontend: guard arms, three renderers, registry, copy, parity fence (parallel with wave 1, since the contracts are locked here);
  3. live: SC#10 board plus the G-4 drive and reload proof.

### Folded seeds
- **SEED-337** (direction A only). Phase 292 is the "next phase after 273 that touches the artifact registry" its trigger names. Direction B stays planted with its own trigger (an operator decision).

### Deferred Ideas (OUT OF SCOPE)
- **SEED-337 direction B, sandboxed agent-authored HTML/React.** Needs its own operator decision (origin isolation, CSP, postMessage contract). Stays planted.
- **`steps` component.** Rejected at the sketch; re-open only if users ask for per-step sources that a markdown list cannot carry.
- **Swimlane diagram (sketch 2B) and true-time horizontal timeline (sketch 4B).** Lost to 2A/4A; re-open if a real user needs owners per lane or true spacing for dense contract history.
- **By-reference re-encode for the new types** (D-08). Re-open if users ask to "filter that timeline" or "turn that table into a comparison".
- **Image (SEED-194), map, KPI grid, pie/donut.** Unchanged; each keeps its own seed or 273 decision.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VIS-02 | The agent can show more artifact types beyond chart, table and metric; the new set is chosen at sketch time from a closed registry only. — `SEED-337` | §Standard Stack (no new deps); §Pattern 1 (one flat `ComponentName` Literal of six, derived everywhere); §Pattern 2 (nested sibling encodings, Gemini-converted and measured); §Pattern 3 (source handle = the citation manifest number); §Pattern 4 (separate stored-spec models, tabular dump byte-unchanged); §Migration 213; §Every enumeration site; §Validation Architecture (a test per SC) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Backend in `venv`; raw SDK calls only (no LangChain/LangGraph); Pydantic for structured LLM outputs.
- **Backend baseline gate: ≤ 71 failed, 0 collection errors, zero headroom.** `node scripts/check-backend-unit-baseline.cjs` (count-based: any new red test breaks it).
- **Frontend count gate:** `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` from repo root. Contract: no per-file decrease, 0 failing. A NEW suite is adopted in **both knobs** (`BASELINE` filename pin + `TARGETS` path) in the **same commit** that creates it.
- Frontend typecheck: `npx tsc -p tsconfig.app.json --noEmit` with a **set diff** against base (`npx tsc --noEmit` checks zero files).
- Schema changes: numbered `supabase/migrations/<digits>_name.sql`; **paste into the local SQL editor, never `supabase db push`/`db reset`**; then `bash scripts/regenerate-full-schema.sh` (no `--reset`); never hand-edit `full-schema.sql`.
- All tables RLS (unchanged here); blocking I/O wrapped in `run_in_threadpool` (none added).
- Stream via SSE (the existing `artifact` event is reused, unchanged).
- **Provider-docs-first** for any change to tool schemas; keep provider-specific handling at the service boundary (`google_service._sanitize_schema_for_google`), never in the shared schema.
- **A model's capabilities are data** — no per-model branch is needed or allowed here.
- **Extension Contract:** the registry is closed engine code; adding a component is a code change, never a row/setting/prompt. Sandboxed HTML is out (SEED-337 B).
- Worktrees: bootstrap first (`bash scripts/bootstrap-worktree.sh "$(pwd)"`), teardown with `scripts/teardown-worktree.sh`, never `rm -rf`. Serialize plans that mutate the local DB (only Plan 01 applies the migration; Plan 03's board writes threads).
- **G-5 / hot-file ledger:** `node scripts/check-hot-file-ledger.cjs <phase-dir>` fails when `files_modified` names a `backend/app/**` or `frontend/src/**` non-test file with no ledger row — **including brand-new files**. The PostToolUse hook runs it when a PLAN.md is written, so young rows for new files are added **at planning**, and every row + its `docs/HOT-FILE-LEDGER.md` section move in the same commit. Disposition cell ≤ 200 chars (docs scan list); CLAUDE.md FIRING-table cell ≤ 80 chars.
- **G-4:** Chrome MCP drives D-21..D-25, asserting rendered CONTENT (presence assertions cannot see content drift).
- **G-8:** 3 plans; never cut the verifier, TDD RED drives, security review or migration discipline; targeted suites per task, full gates once per wave.
- **SC#10 roster rule:** full native roster (8 rows) derived from `MODEL_CAPABILITIES`, blocked rows recorded ⛔, never omitted. UAT rows go in VALIDATION.md, not PLAN tasks.
- Supabase MCP points at **production**: reads free, every write needs per-action operator approval.
- `CLAUDE.md` must stay < 150,000 chars (`node scripts/check-claude-md-size.cjs`).

## Summary

Phase 273 already built every mechanism this phase needs, and the extension is mostly "one more arm at each fence". The non-obvious findings are where the arms are **not** symmetrical with chart/table/metric:

1. **The source handle should be the citation manifest number the model already uses.** On every retrieval turn `apply_citation_instruction` (`citation_markers.py:153-185`, called at `agent_loop.py:2350-2353`) puts a numbered list `[n] filename · chunk k` into the system prompt, built from `_deduplicate_citations(retrieved_citations)`. The model is already told to cite with `[n]`. A `source: n` integer resolves to `unique_citations[n-1]` = `{filename, passage, chunk_index, is_full_doc}`. Resolving from `turn_tool_calls` instead does **not** work: those are `persisted_tool_calls` whose `result` is cut to 2,000 chars (`agent_loop.py:3248`), and a `search_documents` result is `json.dumps(hits)` with full chunk text, so the cut keeps roughly one hit. The handler therefore needs the run's `retrieved_citations` list by reference: **one new `ToolContext` field + one kwarg in each of the two `agent_loop` ToolContext builds** (the exact `turn_tool_calls` precedent at `agent_loop.py:2221/3136`). Chunks have **no page column** (`full-schema.sql:1961-1974`), so `page` is null for every search hit today; the excerpt comes from the stored passage.
2. **Keep separate stored-spec models.** `StoredArtifactSpec` requires `columns` (min 1) and `rows` (min 1), and `test_273_artifact_models.py:481-482` asserts `StoredArtifactSpec.model_validate(spec).model_dump() == fixture spec`. Adding optional `diagram/comparison/timeline` keys to it would add three `None` keys to every tabular dump and break that round-trip. Use one stored model per new type, chosen by `component` in the handler, so chart/table/metric specs stay byte-identical (CONTEXT: "any change to chart/table/metric behaviour" is out of scope).
3. **The tabular arms must accept null-filled new keys.** OpenAI Responses normalises a non-strict schema to strict, so every key may arrive with `null` (273-RESEARCH Pitfall 3). With `extra="forbid"`, a chart call carrying `"diagram": null` is `extra_forbidden` → refused. `ChartArgs`/`TableArgs`/`MetricArgs` each need `diagram: None = None`, `comparison: None = None`, `timeline: None = None`, exactly like `TableArgs.chart: None = None` today.
4. **Several tests that pin "three" must change, and the ones that pin "30" must not.** Measured list in §Tests below. One non-obvious one: `test_278_pure_move.py::test_moved_bindings_are_ast_identical` AST-compares `ToolContext` against the Phase-278 base, so adding a field needs a `RETIRED["ToolContext"]` entry with its reason (the mechanism exists; `_handle_ask_user` and `_handle_query_documents_by_view` already use it).
5. **Extend the history rewrite (D-11), and the reason is correctness, not only size.** Measured at caps the new payloads are 10.9 KB (diagram), 27.0 KB (comparison) and 18.2 KB (timeline), against 3.8 KB for a 50×5 table. More importantly, a persisted `source: 3` refers to **that turn's** manifest; left in history, a model that copies an old diagram into a later turn with a different retrieval would silently resolve `3` to a different document. Replacing the whole `diagram`/`comparison`/`timeline` object with the stored-artifact placeholder removes those stale handles.

**Primary recommendation:** extend the 273 vocabulary with nested sibling encodings (`diagram`, `comparison`, `timeline`, nullable objects), resolve `source: n` against the run's deduplicated citation list, store one typed spec per new type, widen two CHECKs in migration 213, and mirror every backend rule in the frontend guard through a shared adversarial fixture (the 273 CR-01 lesson).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Closed vocabulary + caps + worded refusals | API / Backend (`models/artifact.py`) | Browser (guard mirrors it) | The model talks to the backend; the backend decides "shown" vs "refused" (D-12/D-20) |
| Source handle → `{document, page, excerpt}` | API / Backend (`show_artifact_tool` + new pure `artifact_sources.py`) | — | Only the server holds the run's retrieved citations; the model never writes provenance (D-07) |
| Event sort, date validation | API / Backend | Browser (guard asserts order) | "Sorted by our code" must be the stored order so live == reload (I-2) |
| Persistence + labels | Database (`message_artifacts`, CHECKs, advisory lock) | API (`db/artifacts.py`) | CHECK is the belt; label numbering is transactional |
| History bloat / stale handles | API (`artifact_history.redact_artifact_args`, persist time) | — | One persist hook covers both append sites (273 D-15) |
| Tool schema per provider | API (`openai_service` shared schema; `google_service` sanitizer at the boundary) | — | Provider-specific handling stays at the service boundary |
| Diagram layout, Today row, "in N days", gap rows, "only terms that differ" | Browser (pure `*Model.ts`) | — | Viewer clock and container width are client facts (D-16/D-18) |
| Render (text-only model strings) | Browser (React DOM/SVG) | — | I-3 |

## Standard Stack

### Core (all already installed; nothing new — D-19)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pydantic | 2.12.5 [VERIFIED: venv import] | Discriminated union on `component`, `extra="forbid"` arms | 273's vocabulary is built on it |
| google-genai | 2.6.0 [CITED: 273-RESEARCH §Standard Stack] | Gemini `FunctionDeclaration`; the nested prototype schema constructs client-side [VERIFIED: local run, this session] | Existing native path |
| React | ^19.2.4 [VERIFIED: frontend/package.json] | Renderers as React DOM + SVG elements | Existing |
| Tailwind tokens `success` / `warning` / `destructive` / `primary` | in `tailwind.config.js:81-95`, `index.css:25-48` [VERIFIED: grep] | Verdict glyph and deadline-ring colours | No `index.css` edit needed (it FIRES at 35/19) |
| lucide-react | installed (used by `ArtifactFrame.tsx:12`) | Icons in the frame (unchanged) | Existing |

### Supporting
| Asset | Where | Use |
|-------|-------|-----|
| `own()` | `components/workflows/ownProperty.ts` | Registry and every closed-table lookup (kind, verdict glyph) |
| `ResizeObserver` guard pattern | `components/workflows/TeamPicture.tsx:416-420` (`typeof ResizeObserver === "undefined"` → measure once) | Diagram container width; jsdom has no ResizeObserver |
| `_js_len` / `_check_js_len` | `models/artifact.py:181-194` | Every new string cap, UTF-16 units like the browser |
| `_strip_nul_deep` | `models/artifact.py:744-759` | Already applied before validation; also apply to resolved excerpts |
| `_deduplicate_citations` | `services/citation_markers.py:70-84` (pure, imports nothing from `app`) | The ONE numbering the model saw; import it, never re-implement |
| `derive_roster` + board skeleton | `scripts/run-273-board.py` (612 lines; `_drive_turn`, `_reload`, `_artifacts`, `_leak`) | Plan 03's `run-292-board.py` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Nested sibling encodings (`diagram: {nodes, edges}`) | Flat top-level `nodes`, `edges`, `options`, `terms`, `events` | Flat is one level shallower and STRUCTURED mode's `_format_tool_list` shows more top-level names (`agent_loop.py:880+`). But it needs five `None` fields on all six arms, puts generic names (`options`) beside `columns`/`rows`, and breaks the `chart`/`metric` precedent. The nested shape converts for Gemini with no type-array residue (measured), so the depth cost is small. **Use nested.** |
| Handle = citation number `n` | `{document_id, chunk_index}` from the search JSON | The model sees both, but copying a 36-char UUID per element is error-prone and long; the number is what `CITATION_INSTRUCTION` already trains it to emit. **Use `n`.** |
| Handle resolved from `turn_tool_calls` | (no ToolContext change) | Results are cut at 2,000 chars → ~1 hit survives. **Does not work.** |
| Radix `Tooltip` for the hover excerpt | One artifact-local excerpt popover driven by hover/focus state | Radix needs a `TooltipProvider` ancestor (`App.tsx:349`; tests must wrap it, `LibraryHeaderBar.tsx:201` precedent) and portals; 100 comparison cells means 100 roots. A single local popover is testable in jsdom and works with keyboard focus and tap. **Use one local popover component.** |

**Installation:** none.

## Package Legitimacy Audit

No external packages are installed by this phase (D-19: no new frontend dependency; the backend adds no import outside the standard library and `app.*`). slopcheck was not run because there is nothing to check.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| (none) | — | — | — | — | — | — |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
 user prompt ──► agent loop (Deep / chat top level)
                   │
                   ├─ search_documents / analyze_document ──► ToolResult.citations ──► retrieved_citations (run list)
                   │                                                              │
                   │      apply_citation_instruction: "[n] file · chunk k" manifest in system prompt (every iteration)
                   │
                   └─ show_artifact(args)  ── args reach the handler raw
                          │
                          ▼
              validate_args (models/artifact.py)
                 strip NUL → lower component → decode stringified nested JSON once per level
                 → discriminated union: chart | table | metric | diagram | comparison | timeline
                 ├─ unknown component ──► worded refusal {status, reason, detail} ──► model retries (amber rail step)
                 ├─ bad props / caps ───► worded refusal
                 └─ ok ──┐
                         ▼
        tabular arms ──► 273 path unchanged (from_artifact transforms, validate_dataset)
        new arms ──────► from_artifact set? ──► refusal "send the data again" (D-08)
                         │
                         ▼
               resolve_sources(items, dedup(ctx.turn_citations))
                 source n ∉ 1..k or no retrieval ──► worded refusal
                 else {document: filename, page: null, excerpt: best sentence window ≤ 280}
                         │
                         ▼
               Stored{Diagram|Comparison|Timeline}Spec (events sorted) ── size ≤ MAX_SPEC_BYTES − reserve
               build_caption(turn_tool_calls, count)      (unchanged tool-level sources)
                         │
                         ▼
               insert_artifact ── advisory lock ── label "diagram N" ── CHECKs (mig 213)
                         │
                         ├─► SSE `artifact` event (RETURNING row) ──► StreamsProvider ──► MessageItem ──► ArtifactBlock
                         └─► id-first result < 2000 chars ──► model writes 1-2 sentences
                         │
   persist time: redact_artifact_args → rows / diagram / comparison / timeline replaced by placeholder
                         │
   reload: GET /messages → attach_artifacts (by parsed artifact id) → same row → same ArtifactBlock
                         │
                         ▼
   ArtifactBlock: parseArtifactRecord (guard) ──► rendererFor (own(REGISTRY)) ──► ArtifactFrame ──► body
       body: DiagramArtifact(layoutDiagram(spec, width)) | ComparisonArtifact | TimelineArtifact(today = viewer clock)
       any failure ──► ArtifactNotice (closed reason, no JSON)
```

### Recommended file layout

```
backend/app/models/artifact.py          # Literals, caps, _R, arms, stored specs (extend)
backend/app/services/artifact_sources.py   # NEW, pure: resolve_sources(), excerpt_for()
backend/app/services/show_artifact_tool.py # handler branch for the new arms, per-type note
backend/app/services/artifact_history.py   # redact the three new keys too
backend/app/services/openai_service.py     # SHOW_ARTIFACT_TOOL schema + description only
backend/app/services/tools/base.py         # ToolContext.turn_citations (+1 field)
backend/app/services/agent_loop.py         # turn_citations=retrieved_citations (×2 builds)
supabase/migrations/213_message_artifacts_more_components.sql
frontend/src/components/chat/artifacts/
  artifactSpec.ts       # types + guard arms (extend)
  artifactRegistry.ts   # six entries (extend)
  artifactCopy.ts       # chips, notices, count phrases, glyph words, timeline words (extend)
  captionModel.ts       # per-type count phrase + comparison note line (extend)
  ArtifactFrame.tsx     # render the optional caption note line (small)
  diagramModel.ts       # NEW pure layout
  DiagramArtifact.tsx   # NEW
  comparisonModel.ts    # NEW pure (same-row detection, glyph table)
  ComparisonArtifact.tsx# NEW
  timelineModel.ts      # NEW pure (date parse, sort check, gaps, Today, days-until)
  TimelineArtifact.tsx  # NEW
  ArtifactExcerpt.tsx   # NEW shared hover/focus excerpt popover
frontend/src/components/chat/tool-bodies/ShowArtifactBody.tsx  # COMPONENTS + count noun
```

### Pattern 1: One flat Literal of six, derived everywhere

```python
# backend/app/models/artifact.py — keep ComponentName ONE flat Literal: the frontend fence
# reads it with /^ComponentName\s*=\s*Literal\[([^\]]*)\]/m (artifactParity.fence.test.ts:21-25).
ComponentName = Literal["chart", "table", "metric", "diagram", "comparison", "timeline"]
TabularComponent = Literal["chart", "table", "metric"]          # D-08: by-reference set
NodeKind = Literal["start", "step", "decision", "end"]
Verdict = Literal["y", "n", "m", "q"]

ARTIFACT_COMPONENTS = get_args(ComponentName)
TABULAR_COMPONENTS = get_args(TabularComponent)
NODE_KINDS = get_args(NodeKind)
VERDICTS = get_args(Verdict)
ARTIFACT_LABEL_RE = re.compile(r"^(" + "|".join(ARTIFACT_COMPONENTS) + r") [1-9][0-9]*$")
```

⛔ Never write `ComponentName = Union[TabularComponent, ...]`: the fence regex would read zero names and its NON-VACUITY case fails.

**Kind literals (discretion):** `start | step | decision | end`, the four shapes the approved sketch draws (`index.html:363-364`: decision = hexagon, start/end = terminal pill, step = box). `actor` is left out: the sketch never drew it, and lanes (the only place owners appeared) lost at 2B. Absent `kind` is stored as `step`.

### Pattern 2: Nested sibling encodings in the tool schema (Gemini-safe)

```python
_SRC = {"type": ["integer", "null"],
        "description": "The [n] number of a source retrieved this turn. Omit if none."}
"diagram": {
    "type": ["object", "null"],
    "properties": {
        "nodes": {"type": "array", "items": {"type": "object", "properties": {
            "id": {"type": "string"}, "label": {"type": "string"},
            "kind": {"type": "string", "enum": list(NODE_KINDS)},   # NOT ["string","null"]
            "source": _SRC}, "required": ["id", "label"]}},
        "edges": {"type": "array", "items": {"type": "object", "properties": {
            "from": {"type": "string"}, "to": {"type": "string"},
            "label": {"type": ["string", "null"]}}, "required": ["from", "to"]}},
    },
    "required": ["nodes", "edges"],
},
"comparison": {... "options": {"type": "array", "items": {"type": "string"}},
               "terms": {"type": "array", "items": {"type": "object", "properties": {
                   "name": {"type": "string"},
                   "cells": {"type": "array", "items": {"type": "object", "properties": {
                       "verdict": {"type": "string", "enum": list(VERDICTS)},
                       "text": {"type": ["string", "null"]}, "source": _SRC},
                       "required": ["verdict"]}}}, "required": ["name", "cells"]}}},
"timeline": {... "events": {"type": "array", "items": {"type": "object", "properties": {
                   "date": {"type": "string", "description": "YYYY-MM-DD or YYYY-MM"},
                   "title": {"type": "string"}, "detail": {"type": ["string", "null"]},
                   "category": {"type": ["string", "null"]},
                   "deadline": {"type": ["boolean", "null"]}, "source": _SRC},
                   "required": ["date", "title"]}}},
```

**Measured this session** (prototype run through the project's own `_convert_tools_to_google` and `_convert_tools_to_anthropic`): the Gemini Tool constructs; zero list-typed `type` residue; `comparison.terms.items.cells.items` becomes `{verdict: STRING enum, text: STRING nullable, source: INTEGER nullable}`; the property named `from` survives (none of the new property names is in `_GOOGLE_UNSUPPORTED_SCHEMA_KEYS`, which strips a property literally named `not`/`if`/`then`/`else`/`examples`); Anthropic's enum carries the six. Parameters JSON grows 2,114 → 3,649 chars.

Depth: the deepest new path is `parameters → comparison → terms[] → {} → cells[] → {} → verdict`, one level deeper than the shipped `transform.filter[].values[]`. Gemini's docs say "the API may reject very large or deeply nested schemas" [CITED: ai.google.dev/gemini-api/docs/function-calling]. Client-side construction is verified; server-side acceptance is not, and a Gemini schema rejection fails the WHOLE tool list (every Gemini Deep turn, the Phase 115 precedent at `google_service.py:279-291`). **Plan 01 must send one real Gemini request with the new `get_tools()` before merge**, not wait for the board.

**Enum + null:** do not use `{"type": ["string","null"], "enum": [...]}` for `kind`/`verdict` — under JSON Schema a `null` is invalid unless `null` is in the enum, and Responses' strict normalisation makes every key required. A plain non-nullable enum mirrors `chart.kind` today.

**The description (D-10):** today 1,615 chars; `test_273_tool_wiring.py:179` caps it at 3,000 and `:182-185` decodes the FIRST `{"component"` example and requires it to validate, so keep the chart example first. Add ≈ 600-900 chars, e.g.:
```
diagram {nodes:[{id,label,kind?:start|step|decision|end,source?}],edges:[{from,to,label?}]}: how steps
connect; max 25 nodes, 40 edges; no coordinates. comparison {options:[2-5 names],terms:[{name,cells:[
{verdict:y|n|m|q,text?,source?}] one per option, in option order]}}: y yes, n no, m partly, q not stated.
timeline {events:[{date:YYYY-MM-DD|YYYY-MM,title,detail?,category?,deadline?,source?}]}: dated events
with no number to chart; max 40. source = the [n] of a source retrieved this turn; omit it otherwise.
These three are never redrawn with from_artifact: send the data again. Use a table for anything else.
```
STRUCTURED-mode models (all OpenRouter rows, `native_tools: False`) see only top-level names via `_format_tool_list` (273-RESEARCH Pattern 1 caveat), so these shapes in the description are load-bearing.

### Pattern 3: The source handle and its resolution

```python
# backend/app/services/tools/base.py — ToolContext, after turn_tool_calls:
turn_citations: list[dict] | None = None   # BY REFERENCE to agent_loop's retrieved_citations

# backend/app/services/agent_loop.py — both builds (≈2221 resume, ≈3136 main), beside turn_tool_calls:
turn_citations=retrieved_citations,  # 292 (D-07) — source handles resolve against the manifest the model saw

# backend/app/services/artifact_sources.py (NEW, pure, no I/O)
from app.services.citation_markers import _deduplicate_citations

EXCERPT_MAX_CHARS = 280   # UTF-16 units, as the browser counts

def resolve_sources(handles: list[int | None], citations: list[dict] | None, texts: list[str]
                    ) -> list[dict | None] | ArtifactRefusal:
    unique = _deduplicate_citations(citations or [])
    if any(h is not None for h in handles) and not unique:
        return _refusal("source_no_retrieval", "...nothing was retrieved this turn; omit `source`...")
    out = []
    for h, text in zip(handles, texts):
        if h is None:
            out.append(None); continue
        if not 1 <= h <= len(unique):
            return _refusal("source_unknown", f"source {h} is not in this turn's list (1-{len(unique)}).", n=h)
        c = unique[h - 1]
        out.append({"document": _clean_document(c.get("filename")), "page": None,
                    "excerpt": excerpt_for(c.get("passage"), text)})
    return out
```

Why this works, with evidence:
- The model sees `[n] {filename} · chunk {k}` in the system prompt on every retrieval iteration (`citation_markers.py:120-138`, `agent_loop.py:2350-2353`), and the instruction already says "A marker is the number only" (`citation_markers.py:35-38`). Numbering = first-occurrence dedup order, and the list only grows within a run, so `n` stays stable from the moment the model saw it to the moment `show_artifact` runs.
- The handle lives in the call's **args**, which persist uncut; the resolved value lives in the **stored spec**. Neither depends on the 2,000-char result cut (D-07's survival requirement).
- `page` is always `null` for search hits: `document_chunks` has no page column (`full-schema.sql:1961-1974`) and hits carry none (`retrieval_documents.py:61-75`). Full-document citations (`analyze_document`, `is_full_doc: True`, `passage: None`, `tools/documents.py:695-704`) resolve to a document with no excerpt.
- **Excerpt rule (discretion, recommended):** the stored passage is a whole chunk (often 1-2 K chars), so its head rarely contains the clause. Pick the passage sentence with the highest overlap of lowercase word tokens (≥ 3 letters) with the element's own label/text, widen to neighbouring sentences up to 280 UTF-16 units, fall back to the chunk head. The excerpt is still document text chosen by our code; model text only steers the selection. Strip NUL and control characters.
- Coercion: accept an int ≥ 1, a digit string, or `"[3]"`; **refuse a bool before pydantic sees it** — measured this session, pydantic 2.12.5 lax mode turns `True` into `1`, which would silently cite source 1.
- Continue runs start with an empty `retrieved_citations` (IN-01 class), so a handle there refuses with "nothing was retrieved this turn"; the model retries without `source` and the caption reads "Values provided by the agent". Test this explicitly.

### Pattern 4: Arms, stored specs and the D-08 refusal

```python
class _Encoded(_Strict):            # base of the three new arms
    title: str = Field(min_length=1)          # reuse _ArgsBase's _title_len validator
    from_artifact: str | None = Field(default=None, max_length=64)
    columns: None = None; rows: None = None; transform: None = None
    chart: None = None; metric: None = None
    diagram: None = None; comparison: None = None; timeline: None = None   # overridden per arm

    @model_validator(mode="before")
    @classmethod
    def _no_reference_no_dataset(cls, data):  # worded, BEFORE field errors
        # placeholder string in diagram/comparison/timeline -> "placeholder_encoded" refusal
        # non-blank from_artifact -> "not_by_reference" ("send the data again", D-08)
        # non-null columns/rows/transform -> worded "a diagram takes `diagram`, not rows"
        ...

class DiagramArgs(_Encoded):
    component: Literal["diagram"]
    diagram: DiagramEnc                     # nodes/edges with decode-once 'before' validators

class Edge(_Strict):
    from_: str = Field(alias="from")        # NO populate_by_name: measured, it makes "from_" valid input
    to: str
    label: str | None = None

ChartArgs/TableArgs/MetricArgs: add  diagram: None = None; comparison: None = None; timeline: None = None

ShowArtifactArgs = Annotated[Union[ChartArgs, TableArgs, MetricArgs,
                                   DiagramArgs, ComparisonArgs, TimelineArgs],
                             Field(discriminator="component")]

# Stored specs — one per new type; StoredArtifactSpec (tabular) is UNCHANGED
class StoredDiagramSpec(_Strict):    title; diagram: {nodes:[{id,label,kind,source}], edges:[{from,to,label}]}
class StoredComparisonSpec(_Strict): title; comparison: {options, terms:[{name, cells:[{verdict,text,source}]}]}
class StoredTimelineSpec(_Strict):   title; timeline: {events:[{date,title,detail,category,deadline,source}]}   # sorted
StoredSource = {document: str|None, page: int|None, excerpt: str|None}
# dump with model_dump(by_alias=True) so the edge key is "from"
```

Rules every arm enforces in the backend AND the frontend guard (shared fixture, §Validation):

| Type | Rule | Refusal key (new `_R` entry, people-safe, ≤ 120 chars) |
|------|------|------|
| diagram | 1-25 nodes | `too_many_nodes` "{n} steps (max 25); group related steps first" (sketch wording) / `no_items` |
| diagram | ≤ 40 edges | `too_many_edges` "{n} links (max 40)" |
| diagram | node id `^[A-Za-z0-9_.-]{1,40}$`, unique | `duplicate_node` "two steps share an id" |
| diagram | edge `from`/`to` must name a node | `unknown_node` "a link names a step that isn't in it" (name the id only if `_safe`) |
| diagram | self-loop needs a label | `self_loop` "a step links to itself without a label" |
| diagram | an identical (from, to, label) twice | `duplicate_edge` "a link is listed twice" (discretion; never silently deduplicated, D-09 no-truncation) |
| diagram | label ≤ 80, edge label ≤ 40 UTF-16 | `fallback` with the field named in `detail` |
| comparison | 2-5 options, unique, ≤ 60 each | `options_count` "{n} options (2 to 5)" |
| comparison | 1-20 terms, name ≤ 80 | `too_many_terms` "{n} terms (max 20)" |
| comparison | cells per term == options | `cell_count` "term {i} has {got} cells for {n} options" |
| comparison | cell text ≤ 200 (`MAX_CELL_CHARS`) | `cell_too_long` (existing wording pattern) |
| timeline | 1-40 events | `too_many_events` "{n} events (max 40)" |
| timeline | date `YYYY-MM-DD` (a real calendar day) or `YYYY-MM` | `bad_date` "a date isn't YYYY-MM-DD or YYYY-MM" |
| timeline | `deadline: true` needs a full day (discretion: "in N days" needs a day) | `deadline_needs_day` |
| timeline | title ≤ 120, detail ≤ 200, category ≤ 32 | `fallback` |
| all new | `source` resolvable | `source_unknown` / `source_no_retrieval` |
| all new | no `from_artifact` | `not_by_reference` "a {noun} can't be redrawn from an earlier one; send the data again" |
| tabular | `from_artifact` names a new-type artifact | handler: `not_by_reference` (check `parent["component"] in TABULAR_COMPONENTS` before `apply_transforms`) |
| any | unknown component | `unknown_component` → reword without enumerating, e.g. "a kind of artifact we can't show"; name a word only via a closed `COMPONENT_ALIASES` table (`mindmap`, `steps`, `gantt`, `map`, `image`, `kanban` …), exactly as `KIND_ALIASES` works (T-273-07: "sunburst" is never echoed). The model-facing `detail` lists `ARTIFACT_COMPONENTS` derived, never retyped. |

Timeline sort: key = (year, month, day or 0), stable on input index, so `2024-02` sorts before `2024-02-09`. The stored order is the render order; the frontend guard refuses an unsorted stored list instead of re-sorting (I-2).

Size: measure the **whole stored spec** (with resolved excerpts) against `MAX_SPEC_BYTES - _SPEC_RESERVE_BYTES` (258,048). Worst case measured: a capped comparison is 27 KB of args, plus up to 100 resolved sources × ~540 B ≈ 81 KB stored. Well inside the cap; the check is a belt.

`build_result` for the new types: same keys as `RESULT_KEY_ORDER` (`row_count` = nodes / terms / events; `kind`, `columns`, `values` null/empty). The `_note` must not tell the model to use `from_artifact` for these: use a per-type note ("…To change it, call show_artifact again with the full data.").

### Pattern 5: Diagram layout (port of the sketch, `index.html:321-378`)

The sketch's algorithm is a working, dependency-free start and was driven in Chrome (8 nodes, 9 edges, 3 hover edges, 0 console errors). Port it to a pure `layoutDiagram(spec, width): Layout` in `diagramModel.ts` and fix the four things the sketch did not have to handle:

```ts
// 1. Back edges: iterative DFS (no recursion — 25 nodes is fine either way, but iterative never overflows),
//    roots = nodes with in-degree 0 in INPUT order, then any unvisited node in input order.
//    An edge to a node ON the stack is a back edge. Deterministic for a given spec (I-2).
// 2. Rank = longest path over forward edges, computed in topological order (Kahn) — O(N+E),
//    replacing the sketch's N × E relaxation loop.
// 3. Width fit (D-16 "never scrolls sideways"): usable = width − gutter, gutter = 0 if no back edge,
//    else 28 + 10 × (backEdgeCount − 1) capped at 64. perRow = max(1, floor((usable + gap) / (minNodeW + gap))),
//    minNodeW = 96. A rank with more nodes than perRow wraps into sub-rows (stacked under the rank).
//    nodeW = clamp((usable − gap × (k − 1)) / k, 96, 190) for the k nodes on that sub-row.
// 4. Height without measuring DOM (jsdom has none): lines = min(3, ceil(label.length × 6.6 / (nodeW − 20))),
//    nodeH = 20 + 16 × lines; sub-row height = max nodeH in it; row gap 36. Labels use line-clamp-3.
// Optional, cheap: one barycenter sweep (order each rank by mean x of its predecessors) to cut crossings.
// Forward edge: cubic from bottom-centre of `from` to top-centre of `to` (sketch td branch).
// Back edge: from right-middle of `from` out to x = min(width − 6, max(fromRight, toRight) + offset_i),
//    back to right-middle of `to`, stroke-dasharray "4 4" (sketch .e.back).
export interface Layout { width: number; height: number; nodes: PlacedNode[]; edges: PlacedEdge[] }
```

Render: an SVG layer (edges, arrowheads, edge labels as `<text>`) under absolutely positioned React node boxes inside one `position: relative` container, exactly the sketch's structure, so labels wrap natively. Every node is a focusable element (`tabIndex=0`); hover OR focus sets one `active` id that lights its edges and opens `ArtifactExcerpt`. ⚠ The arrowhead `<marker>` id must come from `useId()` (the sketch's fixed `id="ah"` collides when two diagrams are on one page). Model ids are never used as DOM `id`/`href`/`url(#…)` values; use array indices for keys and attributes.

### Pattern 6: Timeline model (pure, clock injected)

```ts
// timelineModel.ts
export function parseDay(s: string): { y: number; m: number; d: number | null } | null
// Parse by hand. ⛔ never `new Date("2026-10-24")`: that is UTC midnight, which is the PREVIOUS day in
// any negative-offset timezone (the sketch's dt() has exactly this bug).
export function buildRail(events: TimelineEvent[], today: { y: number; m: number; d: number }): RailRow[]
// rows: event | gap (≥ 6 whole months between consecutive events; label "N months") | today
// an event on today's date counts as past (solid dot); "upcoming" = strictly after today
// Today row sits before the first upcoming event; all past → last row; all future → first row
// no gap row is drawn across the Today row (sketch rule, index.html:410)
// daysUntil(event, today) uses Date.UTC(y, m-1, d) on BOTH sides, so DST cannot shift it
```
`TimelineArtifact` reads `today` from `new Date()` once per render (local fields); tests pass a fixed `today`.

### Pattern 7: Comparison model

"Only terms that differ": a term is identical when every cell has the same `verdict` AND the same text after trim + case-fold (the sketch compared text only, `index.html:386`; including the verdict is stricter and matches what a reader sees). Hide the toggle's effect when no term is identical (keep the button, show nothing hidden). Glyph table through `own()`: `y → ✓`, `n → ✗`, `m → –`, `q → ?`; `q` cell text renders italic "Not stated" when the model gave no text. Shape carries meaning; colour (success / destructive / muted / muted) supports it. Narrow viewports: wrap the matrix in `overflow-x-auto` with a sticky first column (TableArtifact precedent) — D-16's no-sideways-scroll rule is the diagram's, not the matrix's.

### Anti-Patterns to Avoid
- **Adding optional new keys to `StoredArtifactSpec`** — changes every tabular dump; breaks `test_273_artifact_models.py:481-482`.
- **Resolving `source` from `turn_tool_calls` results** — 2,000-char cut.
- **`populate_by_name=True` on the edge model** — measured: it accepts `from_` as input, a second spelling the guard does not know.
- **`new Date(isoDay)` for timeline dates** — off-by-one in negative timezones.
- **A fixed SVG marker id** — collides across artifacts.
- **Echoing a model's unknown component word** in a reason — only closed aliases (T-273-07).
- **Letting the frontend re-sort events** — the stored order must be the render order.
- **`dangerouslySetInnerHTML` / `innerHTML` / Mermaid** — forbidden (D-16); fence it with a source test.
- **Editing `agent_loop.SYSTEM_PROMPT`** (guidance goes in the tool description) — D-10; `test_273_tool_wiring.py:195-203` pins it byte-identical.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Citation numbering | A second dedup/numbering | `citation_markers._deduplicate_citations` | It is the numbering the model saw and the footer uses |
| UTF-16 length | `len()` | `_js_len` / `_check_js_len` | 273 CR-01 #4 |
| Stringified nested JSON | Recursive "decode until it parses" | `_decode_once` per field level | "Decode once, never twice" (BUG-260529-01) |
| NUL in document text | Per-field replace | `_strip_nul_deep` (already applied in `validate_args`) + strip in `excerpt_for` | WR-02 |
| Prototype-safe lookups | `REGISTRY[name] ?? …` | `own()` | `__proto__`/`constructor` |
| Refusal size | Ad-hoc truncation | `_refusal_text` (re-measures after every cut) | WR-07 |
| Roster | A typed provider list | `derive_roster` (`scripts/run-273-board.py:197`) | CLAUDE.md roster rule |
| Layout engine | dagre / elkjs / Mermaid | the ~150-line pure port above | D-16/D-19 |

**Key insight:** the risk in this phase is not any one renderer; it is a rule present in one validator and missing in the other (CR-01). Every rule in the table above needs a `bad` case in ONE shared fixture read by both stacks.

## Migration 213

Measured constraint names (auto-named by 202's inline CHECKs, `full-schema.sql:2972-2974`): `message_artifacts_component_check`, `message_artifacts_label_check`. Nothing else in the schema hardcodes the three names: `message_artifacts_immutable()` reads no component (`202:125-141`); no other function references the table's labels; `_NEXT_ORDINAL_SQL` (`db/artifacts.py:45-49`) is generic per component. `scripts/full-schema-supplement.sql` mirrors ACL statements only (`:515-522`, `:768-772`); 213 changes no grant, so the supplement does not change.

```sql
-- 213 — Phase 292 (VIS-02, D-12/D-13): widen message_artifacts to six components.
-- Widens the component CHECK and the label regex. Nothing else: no table, function, grant or policy.
BEGIN;
ALTER TABLE public.message_artifacts DROP CONSTRAINT IF EXISTS message_artifacts_component_check;
ALTER TABLE public.message_artifacts ADD CONSTRAINT message_artifacts_component_check
    CHECK (component IN ('chart', 'table', 'metric', 'diagram', 'comparison', 'timeline'));
ALTER TABLE public.message_artifacts DROP CONSTRAINT IF EXISTS message_artifacts_label_check;
ALTER TABLE public.message_artifacts ADD CONSTRAINT message_artifacts_label_check
    CHECK (label ~ '^(chart|table|metric|diagram|comparison|timeline) [1-9][0-9]*$');
COMMENT ON TABLE public.message_artifacts IS '… (chart | table | metric | diagram | comparison | timeline) …';
COMMENT ON COLUMN public.message_artifacts.label IS '… diagram N / comparison N / timeline N …';
COMMENT ON COLUMN public.message_artifacts.component IS '… (6) …';
COMMENT ON COLUMN public.message_artifacts.spec IS '… tabular: title, columns, rows, chart|metric; diagram|comparison|timeline: title + its encoding …';
COMMENT ON COLUMN public.message_artifacts.row_count IS '… rows; nodes / terms / events for the new types …';
COMMIT;
-- VERIFY: exactly ONE CHECK on component, and it names 'diagram'; exactly ONE on label, and it names
-- 'timeline'; no CHECK without them (a differently-named old CHECK would survive DROP IF EXISTS and
-- silently keep refusing every new row):
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conrelid = 'public.message_artifacts'::regclass and contype = 'c';
```

Notes:
- `ADD CONSTRAINT … CHECK` validates existing rows (they all pass) and does not fire the BEFORE UPDATE immutability trigger.
- Idempotent: safe to paste twice.
- **Deploy ordering:** cloud must get 213 **before** the backend that emits a diagram deploys; otherwise every new-type insert fails the CHECK and the model is told "couldn't save the artifact; try again" (a retry that fails identically). Record it as a deploy-parity item. 213 seeds nothing, so `scripts/check-deploy-drift.sh` artifacts do not change.
- `get_advisors(security)`: the Supabase MCP is configured against **production** (CLAUDE.md), so "against local" is not what that tool does. 213 adds no table, function, grant or policy, so the advisor delta is nil by construction; run the read-only `get_advisors(security)` against prod at the deploy step.

## Every place that enumerates the three components

### Backend (must change)
| File:line | What | Change |
|-----------|------|--------|
| `models/artifact.py:52` | `ComponentName` | six (flat Literal) |
| `models/artifact.py:99` | `ARTIFACT_LABEL_RE` | derive from `ARTIFACT_COMPONENTS` |
| `models/artifact.py:113` | `_R["unknown_component"]` | reword (no enumeration) + alias form |
| `models/artifact.py:369` | `_decode_nested` field list | add `diagram`, `comparison`, `timeline` |
| `models/artifact.py:414-433` | arms + `ShowArtifactArgs` union | three new arms; tabular arms gain three `None` keys |
| `models/artifact.py:717-721` | unknown-component `detail` | `", ".join(ARTIFACT_COMPONENTS)` |
| `models/artifact.py:762` | `validate_args` return annotation | widen |
| `db/artifacts.py:131-132` | `ValueError` text | derive (logic already reads `ARTIFACT_COMPONENTS`) |
| `services/show_artifact_tool.py:443-449` | `_note` (redraw via from_artifact) | per-type note |
| `services/show_artifact_tool.py:574-631` | handler dataset branch | new-type branch; tabular `from_artifact` refuses a new-type parent |
| `services/artifact_history.py:75-94` | `redact_artifact_args` (rows only) | also `diagram` / `comparison` / `timeline` |
| `services/openai_service.py:1175-1280` | schema + description | three nested objects; enum derives automatically (`:1207`) |

Unchanged by construction: `show_artifact_tool._echoable_ref` and `db/artifacts._normalise_ref` (they read `ARTIFACT_LABEL_RE`), `_loc_path` (reads `ARTIFACT_COMPONENTS`), `attach_artifacts` (by id, component-agnostic), `build_caption`, `tool_dispatcher` registry line, `CHAT_ONLY_TOOLS`.

### Frontend (must change)
| File:line | What | Change |
|-----------|------|--------|
| `artifactSpec.ts:30,34,35` | `ComponentName`, `COMPONENT_TABLE`, `ARTIFACT_COMPONENT_NAMES` | six |
| `artifactSpec.ts:47` | `LABEL_RE` | derive from the six (used at `:371` lineage and `:392` label) |
| `artifactSpec.ts:75-81` | `ArtifactSpec` | add `diagram`, `comparison`, `timeline` (null for tabular); `columns: []`, `rows: []` for the new types (mirrors `chart`/`metric: null`) |
| `artifactSpec.ts:137-147,149-157` | `NoticeReason`, `NoticeContext` | add the few reasons the sketch shows (e.g. `missing-step` "its saved data links to a step that isn't in it (“X”)", `too-many-items`); `noun` widens automatically |
| `artifactSpec.ts:385-440` | `parseRecord` | branch on component BEFORE `parseColumns` (it requires ≥ 1 column today, `:231`) |
| `artifactRegistry.ts:42-46` | `REGISTRY` | six (eager imports; plain DOM/SVG) |
| `artifactCopy.ts:197-222` | `kindChipLabel` | "Flow diagram" (sketch `index.html:503`), "Comparison" (`:460`), "Timeline" |
| `artifactCopy.ts:255` | unknown-component notice | reword without enumerating |
| `artifactCopy.ts` (new) | count phrases | `8 steps · 9 links`, `3 options × 7 terms`, `9 events` (sketch captions `:247,263,280`); verdict words; "Not stated"; "Only terms that differ"; "Today"; "{N} months"; "in {N} days"; comparison note "Verdicts are the agent's reading of the documents." |
| `captionModel.ts:70` | `rowsPhrase` for non-metric | per-type count phrase (spec array lengths are validated numbers, not model text) + optional `note` line |
| `ArtifactFrame.tsx:49-58` | caption footer | render `caption.note` on a second line when present |
| `tool-bodies/ShowArtifactBody.tsx:39` | `COMPONENTS` | six (else every new-type result reads "Show an artifact" in the rail) |
| `tool-bodies/ShowArtifactBody.tsx:128-138,184-185` | essence `· N rows` | per-type count noun |

Unchanged by construction: `ArtifactBlock.tsx` (registry-driven), `MessageItem.tsx` mount, `StreamsProvider` handler, `lib/api/threads.ts:118-146,562-564,1053-1056` (records are opaque `unknown`), `types/index.ts` (type re-export), `toolMeta.ts`, `tool-bodies/index.ts` `ARGS_HIDDEN` (already hides `show_artifact` args).

## Tests: what must change, and what must not

### Must change (each asserts the old three, or reads a structure this phase extends)
| Test | Line | Why |
|------|------|-----|
| `backend/tests/unit/test_273_artifact_models.py` | 120 | `ARTIFACT_COMPONENTS == ("chart","table","metric")` |
| same | 137, 140 | unknown-component reason text |
| `backend/tests/unit/test_273_migration_202_shape.py` | 110 | 202's CHECK == `ARTIFACT_COMPONENTS` → compare to the frozen historical three; the "equals the Literal" assertion moves to a new 213 shape test. Line 124 (202's label regex text) stays true. |
| `backend/tests/unit/test_273_tool_wiring.py` | 168 | Anthropic enum hard-coded `["chart","table","metric"]` |
| `backend/tests/unit/test_278_pure_move.py` | `RETIRED` (188-) | add `"ToolContext": "Phase 292 (D-07): deliberate post-move edit — turn_citations field …"` |
| `frontend/.../artifacts/__tests__/artifactSpec.test.ts` | 73, 250 | three-name list; unknown-component notice text |
| `frontend/.../artifacts/__tests__/ArtifactBlock.test.tsx` | 48-56, 143 | "closed to exactly three"; notice text |

### Must NOT change (they prove SC#4 / I-4 and must stay green as-is)
`test_259_closed_core_inventory.py:56,137` and `test_261_closed_core_inventory.py:73` (`len(_TOOL_REGISTRY) == 30`); `test_273_tool_wiring.py:50` (30), `:88-91` (`CHAT_ONLY_TOOLS`), `:128-134` (no anyOf/oneOf/allOf/additionalProperties — the new schema must pass it), `:137-146` (enums derived; `required == ["component","title"]`), `:149-159` (Gemini, no list-typed `type`), `:174-185` (≤ 3,000 chars, first example valid), `:195-203` (SYSTEM_PROMPT byte-identical); `test_267_tool_floor_union.py:408` (30); `test_085_tool_registration.py:280-290` (26 / 29 `get_tools`); `test_255_extension_contract_guard.py:105-106`; `artifactParity.fence.test.ts` (passes unchanged once BOTH stacks list six — do not edit it); the 273 bad-spec fixture (`artifact_bad_specs_v1.json`) and its two readers.

## Runtime State Inventory

Not a rename/migration of existing data; the only stored-state change is additive.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `message_artifacts` rows (all chart/table/metric) — still valid under the widened CHECKs | none |
| Live service config | none — no app_settings / user_settings key | none |
| OS-registered state | none | none |
| Secrets/env vars | none | none |
| Build artifacts | none (no sandbox image, no package) | none |

## Common Pitfalls

### Pitfall 1: Null-filled calls refused on the tabular arms
**What goes wrong:** gpt-5.6 (Responses) sends `"diagram": null` on a chart call → `extra_forbidden` → every chart refused.
**How to avoid:** `diagram/comparison/timeline: None = None` on the three tabular arms; a test sends a fully null-filled chart, table, metric and each new type.
**Warning signs:** OpenAI row passes 273's board but fails 292's on chart cells.

### Pitfall 2: Stale source numbers
**What goes wrong:** a later turn re-uses `source: 3` from history against a different manifest → wrong document, silently.
**How to avoid:** redact the three encodings at persist time (D-11); refuse handles when nothing was retrieved this turn.

### Pitfall 3: `source: true` cites source 1
**What goes wrong:** pydantic lax int accepts `True` as `1` (measured).
**How to avoid:** a `mode="before"` validator that refuses bool and accepts int / digit string / `"[n]"`.

### Pitfall 4: Gemini rejects the deeper schema server-side
**What goes wrong:** every Gemini Deep turn 400s (the whole tool list is one unit).
**How to avoid:** one live Gemini request with the new `get_tools()` inside Plan 01; fallback if refused: move `comparison.terms` cells to a flat `cells: [verdict…]` + `texts: [text…]` pair (one level shallower) — decided only on evidence.

### Pitfall 5: Coerce-tier (Kimi) stringifies at an inner level
**What goes wrong:** `"diagram": {"nodes": "[{...}]"}` → "must be an array".
**How to avoid:** `_decode_once` on each list field (`nodes`, `edges`, `options`, `terms`, `cells`, `events`) as well as on the encoding object; never decode twice.

### Pitfall 6: Validator drift between stacks (CR-01)
**What goes wrong:** the model is told "Shown" and the user sees the notice.
**How to avoid:** `artifact_bad_specs_292.json` (≥ 20 bad, ≥ 6 good, same `$repeat` expansion as v1) read by a backend test through `validate_args` and by a frontend fence through `parseArtifactRecord`; plus `artifact_record_292.json` (one stored record per new type) validated by the new `Stored*Spec` models and the frontend guard.

### Pitfall 7: Timezone off-by-one
**What goes wrong:** `new Date("2026-12-31")` renders 30 Dec west of UTC; "in N days" is one short.
**How to avoid:** hand-parse; `Date.UTC` both sides; tests run with an injected `today` and one case under a negative offset (`process.env.TZ` is not reliable in vitest workers — test the pure functions with explicit components instead).

### Pitfall 8: The migration's DROP misses a differently named CHECK
**What goes wrong:** `DROP CONSTRAINT IF EXISTS` no-ops, the old 3-value CHECK stays, every new insert fails.
**How to avoid:** the VERIFY query above (count = 1 per column, contains the new names) on local now and on cloud at deploy.

### Pitfall 9: Rail says "Show an artifact" for every new type
**What goes wrong:** `ShowArtifactBody.tsx:39` closed table rejects the new components.
**How to avoid:** extend it, and add one rail test per new type.

### Pitfall 10: Description over 3,000 chars, or the example moved
**What goes wrong:** `test_273_tool_wiring.py:179/182` fails.
**How to avoid:** keep the chart example first; measure the description in the test run.

### Pitfall 11: Hover-only excerpts on touch devices
**What goes wrong:** phone users can never see the clause.
**How to avoid:** focus (tap) opens the same excerpt; elements are focusable.

## Code Examples

### History redaction, extended (artifact_history.py)
```python
_ENCODED_KEYS = ("diagram", "comparison", "timeline")

def redact_artifact_args(tool_calls):
    out = []
    for tc in tool_calls:
        args = tc.get("args") if isinstance(tc, dict) else None
        if not isinstance(tc, dict) or tc.get("name") != TOOL_NAME or not isinstance(args, dict):
            out.append(tc); continue
        new = dict(args); changed = False
        if args.get("rows") is not None:
            new["rows"] = _placeholder(args["rows"], tc.get("result")); changed = True
        for key in _ENCODED_KEYS:
            if args.get(key) is not None:
                new[key] = _encoded_placeholder(key, args[key], tc.get("result")); changed = True
        out.append({**tc, "args": new} if changed else tc)   # untouched entries stay the SAME object
    return out
# _encoded_placeholder builds "<stored in artifact a_x, diagram of 8 steps>" / "<not stored: refused, …>"
# from ROWS_PLACEHOLDER_STORED / ROWS_PLACEHOLDER_NOT_STORED, so the validator's placeholder check
# (extended to these keys) recognises an echo and refuses with "send the data again" (D-08).
```

### Guard arm shape (artifactSpec.ts)
```ts
function parseDiagram(raw: unknown): DiagramEncoding {
  const noun: ComponentName = "diagram"
  if (!isObj(raw) || !Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) invalid(noun)
  if (raw.nodes.length < 1) throw new Refusal("no-rows", { noun })
  if (raw.nodes.length > MAX_NODES || raw.edges.length > MAX_EDGES) throw new Refusal("too-many-items", { noun })
  const ids = new Set<string>()
  const nodes = raw.nodes.map((n) => {
    if (!isObj(n) || !isStr(n.id, 1, 40) || !NODE_ID_RE.test(n.id) || ids.has(n.id)) invalid(noun)
    if (!isStr(n.label, 1, 80) || typeof n.kind !== "string" || !own(NODE_KIND_TABLE, n.kind)) invalid(noun)
    ids.add(n.id as string)
    return { id: n.id as string, label: n.label as string, kind: own(NODE_KIND_TABLE, n.kind)!, source: parseSource(n.source, noun) }
  })
  const edges = raw.edges.map((e) => {
    if (!isObj(e) || typeof e.from !== "string" || typeof e.to !== "string") invalid(noun)
    if (!ids.has(e.from)) throw new Refusal("missing-step", { noun, column: truncateValue(e.from) })
    if (!ids.has(e.to)) throw new Refusal("missing-step", { noun, column: truncateValue(e.to) })
    if (!isNullish(e.label) && !isStr(e.label, 1, 40)) invalid(noun)
    if (e.from === e.to && isNullish(e.label)) invalid(noun)
    return { from: e.from, to: e.to, label: (e.label as string | null | undefined) ?? null }
  })
  return { nodes, edges }
}
```

### Source fence (new frontend test, I-3 / D-16)
```ts
import diagramSrc from "../DiagramArtifact.tsx?raw"   // same for Comparison, Timeline, Excerpt, models
for (const banned of ["dangerouslySetInnerHTML", "innerHTML", "mermaid", "new Function", "eval("])
  expect(src).not.toContain(banned)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| OpenAI strict: 100 properties / 5 levels | "up to 5000 object properties total, with up to 10 levels of nesting" | current docs [CITED: developers.openai.com/api/docs/guides/structured-outputs] | the new depth (≈ 7) is inside the strict limits if a forced path ever enables strict |
| Gemini type arrays | collapsed to first member + `nullable` at our boundary | Phase 115 | already handled by `_translate_nullable_type` |
| Anthropic: description-only guidance | `input_examples` field for "complex tools with nested objects" [CITED: platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools] | current docs | an Anthropic-boundary option; NOT needed here (the description example works on every provider). Deferred unless the Anthropic row underperforms. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Gemini's server accepts the one-level-deeper nested schema (client-side construction verified) | Pattern 2 / Pitfall 4 | Every Gemini Deep turn fails; mitigated by the Plan 01 live probe and the flatter cell fallback |
| A2 | DeepSeek, GLM, MiniMax, Moonshot accept nested arrays of objects in OpenAI-compatible function schemas | Pattern 2 | A row refuses or emits malformed args; the board records it ⛔/FAIL. 273's board passed all of them with `chart` + `transform.filter[]` nesting (273-UAT-LOG:287-296), which is supporting but not identical evidence |
| A3 | Coerce-tier models stringify at most once per level | Pitfall 5 | Kimi rows refuse; the decode-once-per-level rule keeps it a worded retry, never a crash |
| A4 | The best-overlap sentence excerpt is closer to "the clause" than the chunk head | Pattern 3 | G4-1/G4-2 hover shows a less relevant sentence; cosmetic, not provenance-wrong |
| A5 | A matrix that scrolls sideways inside its card is acceptable (D-16's no-sideways rule is the diagram's) | Pattern 7 | Operator may want a stacked phone layout; cheap to add |

## Open Questions

1. **Verdict words: favourability or yes/no?**
   - What we know: D-05 (locked) says `y | n | m | q` = yes / no / partly / not stated. The approved sketch's key and fixture read them as favourable / unfavourable / neutral / not stated (`index.html:381`; e.g. "Auto-renewal: None — must re-sign" is `y`).
   - What's unclear: whether the operator approved the words or only the visuals.
   - Recommendation: implement D-05's words (it is the locked decision) in aria-labels, the key and the tool description; note the sketch difference in the plan so G4-2 is judged against D-05.
2. **Node boxes: HTML over SVG, or pure SVG?**
   - What we know: D-16 says "React SVG elements"; its ⛔ is innerHTML/Mermaid. The sketch (approved) is HTML node boxes over an SVG edge layer, which wraps labels natively.
   - Recommendation: the sketch structure, rendered entirely as React elements; record in the plan that this satisfies D-16's ⛔. If the planner reads D-16 strictly, use `<foreignObject>` per node (same React text, more SVG plumbing).
3. **G4-4 "force a component outside the six".**
   - What we know: the DB CHECK makes an unknown-component stored row impossible; a crafted bad row must be a valid component with a bad spec (e.g. a diagram edge to a missing node, inserted in the local SQL editor).
   - Recommendation: drive the model-side refusal with a direct handler call from a board/dev script (`component: "mindmap"`), and the stored-row half with a crafted diagram row; the frontend unknown-component notice stays a unit test.
4. **KB documents for the board and G-4.**
   - What we know: 273's board needed none (inline CSV); D-21..D-23 need a process document and two contracts so `source` handles resolve.
   - Recommendation: Plan 03's `seed()` uploads three small fixture documents (generated text, no real data) for the test user and waits for `status = completed`; requires a working local embedding provider.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python venv | backend tests | ✓ | 3.12.6 | — |
| pydantic | models | ✓ | 2.12.5 | — |
| Node | vitest, gates | ✓ | 24.19.0 | — |
| Local Supabase Postgres :54322 | migration apply, board | ✓ (TCP accepts) | — | — |
| Backend :8000 | board, G-4 | ✓ (something is listening; CLAUDE memory: check for a stale uvicorn first) | — | operator starts it |
| Provider keys (8 rows) | SC#10 | unknown until the board runs | — | rows recorded ⛔ with reason |
| Docker CLI from the agent shell | — | not needed (memory: docker is denied in Git Bash) | — | — |

**Missing dependencies with no fallback:** none known.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Backend | pytest (venv), `backend/tests/unit` |
| Frontend | vitest ^4.1.0, jsdom, `frontend/vitest.config.*`, `src/setupTests.ts` |
| Quick run (backend) | `cd backend && venv/Scripts/python.exe -m pytest tests/unit/test_292_*.py tests/unit/test_273_*.py tests/unit/test_278_pure_move.py -q` |
| Quick run (frontend) | `cd frontend && GSD_VITEST_MAX_WORKERS=2 npx vitest run src/components/chat/artifacts src/components/chat/tool-bodies/ShowArtifactBody.test.tsx src/components/chat/__tests__/artifactParity.fence.test.ts` |
| Full suites (once per wave) | `node scripts/check-backend-unit-baseline.cjs`; `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`; `cd frontend && npx tsc -p tsconfig.app.json --noEmit` (set diff vs base) |

### Phase Requirements → Test Map
| SC | Behavior | Type | Command / evidence | File exists? |
|----|----------|------|--------------------|--------------|
| SC#1 | The set is exactly six, derived, closed | unit | `test_292_artifact_models.py::test_components_are_exactly_six`; `artifactSpec.test.ts` (six); `artifactParity.fence.test.ts` (unchanged, green) | ❌ / edit / ✅ |
| SC#2 | Each new type validates, stores, emits, returns id-first | unit | `test_292_show_artifact_new_types.py` (fake pool, the 273 test_273_show_artifact_tool pattern) | ❌ |
| SC#2 | Every new rule refused with a worded reason; both stacks agree | unit ×2 | `test_292_artifact_parity.py` + `artifactParity292.fence.test.ts` over `artifact_bad_specs_292.json` | ❌ |
| SC#2 | Unknown component refused (alias named only from the closed table) | unit | `test_292_artifact_models.py::test_unknown_component_*` | ❌ |
| SC#2 | Source handle resolves to the manifest row; bool / out-of-range / no-retrieval refused; Continue edge | unit | `test_292_artifact_sources.py` | ❌ |
| SC#2 | Renders (diagram layout fits width, back edge dashed, hover/focus lights edges; matrix glyphs, italic Not stated, toggle; rail Today, hollow future, amber deadline + in N days, gaps) | unit | `diagramModel.test.ts`, `DiagramArtifact.test.tsx`, `comparisonModel.test.ts`, `ComparisonArtifact.test.tsx`, `timelineModel.test.ts`, `TimelineArtifact.test.tsx` | ❌ |
| SC#2 | Model strings never reach HTML | unit (source fence) | `artifactRenderers.fence.test.ts` (no innerHTML / Mermaid / eval) | ❌ |
| SC#2 | Rail line per new type | unit | `ShowArtifactBody.test.tsx` (+3 cases) | edit |
| SC#2/3 | Real turn on the roster renders all three; reload identical on ≥ 2 natives | live | `backend/venv/Scripts/python.exe scripts/run-292-board.py --run` (8 rows) + Chrome MCP G4-1..G4-5 | ❌ |
| SC#3 | Reload attaches the same row (component-agnostic) | unit | `test_273_reload_attach.py` stays green + one diagram case in `test_292_*`; `MessageItem.artifacts.test.tsx` (+1 live == reload DOM case per new type) | ✅ / edit |
| SC#3 | History redaction of the three encodings; untouched entries keep identity; placeholder echo refused | unit | `test_292_artifact_history.py` | ❌ |
| SC#4 | Tool count 30; schema provider-safe; description ≤ 3,000 with a valid first example; SYSTEM_PROMPT unchanged | unit | the unchanged list in §Tests (259/261/267/273_tool_wiring/085) | ✅ |
| D-12 | 213 widens exactly two CHECKs and nothing else; full-schema shows six | unit | `test_292_migration_213_shape.py` | ❌ |

### Sampling Rate
- **Per task commit:** the quick runs above (targeted).
- **Per wave merge:** backend baseline gate, frontend count gate, tsc set diff.
- **Phase gate:** all green, board recorded, G-4 rows signed in VALIDATION.md.

### Wave 0 Gaps
- [ ] `backend/tests/unit/fixtures/artifact_record_292.json`, `artifact_bad_specs_292.json` (Plan 01 owns; Plan 03 adds the frontend reader).
- [ ] Count-gate adoption of every new frontend suite, both knobs, same commit (`BASELINE` keys are bare filenames: measured no collision for the names above).
- [ ] TDD: each new test file lands RED first against the unchanged code (G-8: TDD RED drives are never cut).

## Recommended plan split (G-8: 3 plans)

**Plan 292-01 — Backend contract + migration (wave 1).** Mutates the local DB (applies 213), so it is the only DB-mutating plan in wave 1.
`files_modified`:
- `backend/app/models/artifact.py`
- `backend/app/services/artifact_sources.py` (NEW)
- `backend/app/services/show_artifact_tool.py`
- `backend/app/services/artifact_history.py`
- `backend/app/db/artifacts.py` (one message line)
- `backend/app/services/openai_service.py` (`SHOW_ARTIFACT_TOOL` only)
- `backend/app/services/tools/base.py` (+1 field)
- `backend/app/services/agent_loop.py` (+2 kwargs, nothing else)
- `supabase/migrations/213_message_artifacts_more_components.sql` (NEW), `supabase/full-schema.sql` (regenerated)
- `backend/tests/unit/fixtures/artifact_record_292.json`, `artifact_bad_specs_292.json` (NEW)
- `backend/tests/unit/test_292_artifact_models.py`, `test_292_show_artifact_new_types.py`, `test_292_artifact_sources.py`, `test_292_artifact_history.py`, `test_292_artifact_parity.py`, `test_292_migration_213_shape.py` (NEW)
- edits: `test_273_artifact_models.py`, `test_273_migration_202_shape.py`, `test_273_tool_wiring.py`, `test_278_pure_move.py`
Includes: one live Gemini request with the new tool list (Pitfall 4).

**Plan 292-02 — Frontend guard, renderers, copy, rail (wave 1, parallel).**
`files_modified`:
- `frontend/src/components/chat/artifacts/artifactSpec.ts`, `artifactRegistry.ts`, `artifactCopy.ts`, `captionModel.ts`, `ArtifactFrame.tsx`
- NEW: `diagramModel.ts`, `DiagramArtifact.tsx`, `comparisonModel.ts`, `ComparisonArtifact.tsx`, `timelineModel.ts`, `TimelineArtifact.tsx`, `ArtifactExcerpt.tsx`
- `frontend/src/components/chat/tool-bodies/ShowArtifactBody.tsx`
- tests NEW: `diagramModel.test.ts`, `DiagramArtifact.test.tsx`, `comparisonModel.test.ts`, `ComparisonArtifact.test.tsx`, `timelineModel.test.ts`, `TimelineArtifact.test.tsx`, `artifactRenderers.fence.test.ts`; edits: `artifactSpec.test.ts`, `ArtifactBlock.test.tsx`, `captionModel.test.ts`, `fixtures.ts`, `ShowArtifactBody.test.tsx`, `MessageItem.artifacts.test.tsx`
- `scripts/vitest-count-gate.cjs` (the only wave-1 plan that edits it)
⚠ **Known in-worktree red, by construction:** `artifactParity.fence.test.ts` › "ComponentName == ARTIFACT_COMPONENTS (as sets)" reads `backend/app/models/artifact.py?raw`, which still lists three inside this worktree. It turns green when Plan 01 merges. Plan 02 must not edit that fence, must exclude it from its targeted runs while saying so, and the wave-1 merge's full count gate must show it green. If that is unacceptable, run 02 as wave 2 after 01 (cost ≈ the backend plan's duration).

**Plan 292-03 — Cross-stack fence, board, G-4, close-out (wave 2, after both merge).**
`files_modified`:
- `frontend/src/components/chat/__tests__/artifactParity292.fence.test.ts` (NEW; reads the 292 fixtures + the Literal via `?raw`), `scripts/vitest-count-gate.cjs` (adopt it)
- `scripts/run-292-board.py` (NEW; reuse `run-273-board.py`'s `derive_roster`, `_drive_turn`, `_reload`, `_artifacts`; seed three KB fixture docs)
- `.planning/phases/292-more-ways-to-show-it/292-VALIDATION.md` (UAT rows: 8-row board, parallel-thread, long-message, G4-1..G4-5), evidence
- `.planning/seeds/SEED-337-*.md` (record direction A answered by 292; B stays planted)
- `docs/HOT-FILE-LEDGER.md`, `CLAUDE.md` (re-derived triples + verdicts for every modified file, same commit)

### Hot-file ledger status of the candidate files (grep of `docs/HOT-FILE-LEDGER.md`, git log on HEAD)
| File | Row? | commits | G-5 | Note |
|------|------|---------|-----|------|
| `backend/app/models/artifact.py` | ✓ | 3 | no (273 only) | ⛔ `extra=forbid`; `ARTIFACT_COMPONENTS == CHECK` (now mig 213) |
| `backend/app/services/show_artifact_tool.py` | ✓ | 3 | no | ⛔ no `error` key; no retrieval import (the new module imports `citation_markers`, not retrieval) |
| `backend/app/services/artifact_history.py` | ✓ | 1 | no | the ONE persist hook |
| `backend/app/db/artifacts.py` | ✓ | 1 | no | ⛔ every read binds thread + user |
| `backend/app/services/tools/base.py` | ✓ | 1 | no | ⛔ leaf, stdlib only (a `list[dict] | None` field keeps it so) |
| `backend/app/services/openai_service.py` | ✓ | 82 | **FIRES** | honoured by construction: schema dict + description only (294-01 precedent) |
| `backend/app/services/agent_loop.py` | ✓ | 70 | **FIRES** | honoured by construction: 2 kwargs, 0 branches (273/282-04 precedent); ⛔ prompt-assembly seam OWED — do not touch it |
| `frontend/src/components/chat/artifacts/*` (6 existing) | ✓ | 1-4 | no | young (273-02) |
| `frontend/src/components/chat/tool-bodies/ShowArtifactBody.tsx` | ✓ | 1 | no | ⛔ reads `reason`, never `detail`/`values` |
| `backend/app/services/citation_markers.py` | ✗ | 3 | — | **imported, not modified** — keep it out of `files_modified` |
| `backend/app/services/artifact_sources.py` + the 7 new frontend files | ✗ (new) | 0 | young | **add young rows AT PLANNING** (the hook fires when a PLAN.md names them; 278 precedent) |
| `frontend/src/index.css` | ✓ | 35 | FIRES | **not needed** — use existing Tailwind tokens; keep it out |

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (unchanged) | — |
| V3 Session Management | no | — |
| V4 Access Control | yes (unchanged) | reads bind thread_id + user_id (`db/artifacts.py`); RLS SELECT policy = messages'; source resolution uses only this run's citations, already scope-clipped by `search_documents` |
| V5 Input Validation | yes | pydantic arms `extra="forbid"` + hand-rolled guard, shared adversarial fixture |
| V6 Cryptography | no | — |
| V7 Error handling | yes | closed refusal catalogue; never JSON/spec keys/exception text in the notice (D-20) |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS through labels / cell text / event detail from a prompt-injected document | Tampering | React text nodes only; source fence bans `dangerouslySetInnerHTML`/`innerHTML`/Mermaid/`eval` in the new files |
| Forged provenance (model writes a document name or clause) | Spoofing | `source` is an integer handle; document and excerpt come from the server's citation list (D-07) |
| Misattribution via a stale handle | Repudiation | per-turn resolution + history redaction of the encodings |
| Prototype keys as component/kind/verdict (`__proto__`, `constructor`) | Tampering | `own()` lookups on closed tables |
| DOM id / `url(#…)` injection via node ids | Tampering | ids never used as DOM ids; marker id from `useId()` |
| Oversized payload / layout DoS | DoS | caps refused (25/40/5/20/40), O(N+E) layout, spec byte cap + DB CHECK |
| Echoed unknown words in people-facing reasons | Info disclosure / spoofing | closed `COMPONENT_ALIASES`, `_safe` names only (T-273-07) |
| NUL / control chars in excerpts | Tampering (jsonb insert failure) | `_strip_nul_deep` + control-char strip in `excerpt_for` |

## Sources

### Primary (HIGH confidence — measured in this session)
- `backend/app/models/artifact.py` (whole file), `backend/app/services/show_artifact_tool.py` (whole), `backend/app/services/artifact_history.py` (whole), `backend/app/db/artifacts.py:30-195`, `backend/app/services/tools/base.py` (whole)
- `backend/app/services/openai_service.py:1167-1285,1340-1354`; `backend/app/services/google_service.py:242-342`; `backend/app/services/anthropic_service.py:131-148`
- `backend/app/services/citation_markers.py` (whole); `backend/app/services/agent_loop.py:1967,2210-2260,2340-2353,3180-3259,3520-3543`
- `backend/app/services/search_documents_tool.py:1094-1198`; `backend/app/services/retrieval_documents.py:25-79`; `backend/app/services/tools/documents.py:681-765`
- `supabase/migrations/202_message_artifacts.sql`; `supabase/full-schema.sql:1961-1974,2954-3082`; `scripts/full-schema-supplement.sql:515-522,768-772`
- `frontend/src/components/chat/artifacts/{artifactSpec,artifactRegistry,artifactCopy,ArtifactBlock,ArtifactFrame,captionModel}.ts(x)`; `frontend/src/components/chat/tool-bodies/ShowArtifactBody.tsx`; `frontend/src/components/chat/__tests__/artifactParity.fence.test.ts`
- Tests: `test_273_artifact_models.py`, `test_273_migration_202_shape.py`, `test_273_tool_wiring.py`, `test_278_pure_move.py`, `test_259/261_closed_core_inventory.py`, `test_085_tool_registration.py`, `test_267_tool_floor_union.py`; frontend `artifactSpec.test.ts`, `ArtifactBlock.test.tsx`, `ShowArtifactBody.test.tsx`
- `scripts/vitest-count-gate.cjs:4254-4273,6315-6331`; `scripts/check-hot-file-ledger.cjs:40-72`; `scripts/check-backend-unit-baseline.cjs`
- `.planning/sketches/292-more-ways-to-show-it/index.html:225-520` (data, layout, refusal copy)
- Local prototype runs: Gemini/Anthropic conversion of the nested schema; pydantic lax coercion of `True`/`"3"`/`"[3]"`; `from` alias with and without `populate_by_name`; payload sizes at caps

### Secondary (MEDIUM — official docs)
- https://developers.openai.com/api/docs/guides/structured-outputs — "up to 5000 object properties total, with up to 10 levels of nesting"; `additionalProperties: false`; all fields required in strict
- https://ai.google.dev/gemini-api/docs/function-calling — "Only a subset of the OpenAPI schema is supported"; "the API may reject very large or deeply nested schemas"; "Keep active set to 10-20 tools maximum"
- https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools — `input_schema` is JSON Schema; detailed descriptions; `input_examples` for nested inputs
- `.planning/milestones/v4.5-phases/273-agent-authored-artifacts/273-RESEARCH.md` (Responses strict normalisation, history-arg safety matrix), `273-REVIEW.md` (CR-01, WR-02, WR-07, IN-01), `273-UAT-LOG.md:287-296` (8-row board result)

### Tertiary (LOW)
- None relied upon.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependency; versions read from the tree.
- Architecture: HIGH — every seam measured; the source-handle path traced end to end.
- Pitfalls: HIGH for code-path ones (measured); MEDIUM for Gemini server-side depth and coerce-tier behaviour (the board decides).

**Research date:** 2026-10-24
**Valid until:** 2026-11-23 (stable code paths; re-check `ls supabase/migrations` and the ledger triples at planning)
