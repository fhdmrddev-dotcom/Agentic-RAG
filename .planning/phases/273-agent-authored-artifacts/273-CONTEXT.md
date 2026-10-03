# Phase 273: Agent-Authored Artifacts - Context

**Gathered:** 2026-10-03
**Status:** Ready for sketch (G-2: `/gsd:sketch` is REQUIRED before `/gsd:plan-phase 273`, see OV-273-01)

<domain>
## Phase Boundary

In a **chat** answer, the agent can show an **interactive chart, table or metric** built from a
**closed registry of exactly three of our components**, instead of a matplotlib PNG or free markup.
The artifact keeps its rows so a follow-up ("make it a bar chart", "only Q3") re-encodes the same data
with **no retrieval or code-execution call**, it renders **identically after reload**, and it works on
the full 8-row native-provider roster.

Requirements: **ART-01..05**. ⛔ Out of scope by roadmap: SEED-193's data-thread branch/compare half,
SEED-194 image generation, and making artifacts linkable (SEED-185, no URL router — accepted, not
solved). Workflow/harness runs are out of scope: this is the chat agent only.

**Closed-core change, recorded at discuss (roadmap red line):** this phase ADDS ONE AGENT TOOL,
`show_artifact`. `_TOOL_REGISTRY` goes **29 → 30**; the chat-advertised maximum in
`openai_service.get_tools()` goes **28 → 29**. 7 phase types / 1 emitter are unchanged. Re-count at
close against the base commit; count, do not substring-match.

</domain>

<decisions>
## Implementation Decisions

### How the agent emits an artifact
- **D-01:** **A new agent tool, `show_artifact`, is the only emission channel.** Its arguments are
  the spec. No spec ever travels in the answer text: the chat has no cross-provider structured-output
  path (`response_format` exists only for harness forced-emit), and a fenced-JSON-in-text design is
  exactly the roadmap's "one provider emits the spec as prose" failure mode.
- **D-02:** **Pydantic validates on the way in, as a discriminated union on `component`**
  (`chart` | `table` | `metric`), every model `extra="forbid"`. A component outside the three, or any
  unknown or malformed prop, is a **validation failure, never a render**. ⛔ No passthrough field,
  no `props: dict`, no "extra options" bag: an open props shape reopens the closed vocabulary (the
  roadmap's first failure mode).
- **D-03:** **Rows are passed inline in the call** (first emission). This works for every data
  source: `query_tables` rows, SQL results, and numbers the agent computed with `execute_code`.
  A by-reference-to-a-prior-tool-result design was rejected because only `query_tables` returns
  parseable rows today (`query_documents` returns markdown or capped JSON; `execute_code` returns
  free stdout).
- **D-04:** **Every artifact carries a quiet, server-derived provenance caption**, for example
  *"Data: query_tables · Q3-report.pdf p.4 · 12 rows"*. It is built by the server from the tool
  calls made earlier in the same turn, **never written by the model**. If no data-bearing tool ran
  in the turn, the caption says the values were provided by the agent (wording at the sketch). This
  is the mitigation for D-03's risk that the model alters a number while copying it.
- **D-05:** **The chart component's closed kinds are `line`, `bar` (grouped or stacked), `area`,
  `scatter`.** No pie. It must be interactive: hovering shows values, and clicking a legend entry
  toggles a series (SC#1). It is built on `recharts`, which is already a dependency (no new chart
  dependency).

### Follow-ups and attached rows
- **D-06:** **A re-encode is a by-reference re-call:** `show_artifact(from_artifact=<id>, …)`. The
  server loads the stored rows. The model never re-types them, so the numbers cannot drift and no
  retrieval or code call is needed (SC#3 holds by construction). The artifact id must be **visible to
  the model on later turns** (see binding invariant I-3).
- **D-07:** **A by-reference call may change only:** the component and its encoding (kind, x/y,
  series, stacking), a row filter on a column (`eq` / `in` / `range`), column selection, sort, and
  top-N. These are closed operations with **no new math**. ⛔ No aggregation (deferred).
- **D-08:** **Every artifact is immutable.** A follow-up creates a **new** artifact in the new
  answer; the earlier one is untouched. This keeps "reloads identically" trivially true.
- **D-09:** **Row cap: 500 rows. Above it, refuse.** The tool returns an error to the model
  ("aggregate first") and nothing renders. ⛔ No silent truncation: a truncated chart misleads.
  A per-artifact byte cap alongside the row cap is the planner's call (Claude's discretion).

### Where it shows, and the PNG path
- **D-10:** **The artifact renders as a full-width block after the answer text**, in emission order,
  above output files. The tool rail keeps a one-line essence such as
  *"show_artifact → Bar chart · 12 rows"*. There are no position placeholders in the streamed text.
- **D-11:** **matplotlib/PNG is used only when a file is asked for.** Guidance: an in-chat visual
  goes through `show_artifact`; "give me a PNG", "put it in the deck" or "for the report" goes through
  `execute_code` as today. Nothing is removed. The guidance lives in the **tool description**
  (D-15), not in `SYSTEM_PROMPT`.
- **D-12:** **The model gets the first chance to fix a bad spec; the notice is the last resort.** A
  validation error is returned to the model in-turn as a tool error naming what was wrong, so it can
  retry. Anything that still cannot render (a stored spec that fails frontend validation on reload,
  an unknown component reaching the client) shows **"This artifact can't be shown"** plus one
  plain-language reason. ⛔ Never JSON, never markup, never the raw spec (SC#2). The rest of the
  answer renders normally.
- **D-13:** **Table: click-to-sort columns, sticky header, scrolls past about 15 rows. Metric:
  value, label, unit, and an optional delta against a comparison value.** These are the registry's
  second and third entries, and the registry holds exactly three (SC#4).

### Hot files (G-5)
- **D-14:** **`tool_dispatcher.py` gets a narrow cut (the 272 D-15 pattern).** The `show_artifact`
  handler lives in **its own new module**, and the dispatcher gains one registry line. The full
  registry/handler split is **deferred a second time**, recorded as **OV-273-02** with a named
  re-open trigger. The new module gets its ledger row **at creation**.
- **D-15:** **`agent_loop.py` gets one hook.** Artifact persistence and validation live in a new
  module that the loop calls once. The "prefer `show_artifact` over PNG" guidance goes in the
  `show_artifact` tool description in `openai_service.py`, so **`SYSTEM_PROMPT` is untouched**. The
  prompt-assembly seam stays owed, recorded as **OV-273-03**.
- **D-16:** **Frontend: one new SSE event, one mount.** A dedicated `artifact` event carries the
  validated spec, because `tool_end` results are cut at 2,000 characters and a 500-row spec will not
  fit. `StreamsProvider.tsx` gains **one** handler, and `MessageItem.tsx` gains **one**
  `<ArtifactBlock>` mount. Everything else (the registry, the three components, the notice, and
  frontend validation) lives in **new files**. `openai_service.py` (FIRES, 36 phases) gains the one
  tool schema and its `get_tools()` line, and is honoured by construction.

### G-4 lived-experience scenarios (operator-defined at scope time; Chrome MCP drives all four at verification)
- **D-17 / G4-1: Chart, then "make it bar", then "only Q3".** Ask for a chart of a real table.
  Hovering shows values and the legend toggles a series. Each of the two follow-ups renders a **new**
  chart with **zero** retrieval or code steps in the rail, and the plotted numbers **match the
  source** (assert the rendered values, not the presence of an element).
- **D-18 / G4-2: Reload is identical.** Reload the thread mid-session and again after a backend
  restart. Every chart, table and metric renders the same (screenshot comparison), the caption is
  intact, and no raw JSON appears.
- **D-19 / G4-3: A broken spec shows the notice.** Force an unknown component and bad props (a dev
  hook or a crafted row). Only the "can't be shown" notice appears, never JSON or markup, and the
  rest of the answer renders.
- **D-20 / G4-4: PNG still works when asked.** "Give me this as a PNG file" produces a matplotlib
  output-file card, not an artifact. "Show me a chart" produces an artifact, not a PNG.

### SC#10 board
- **D-21:** **8 rows**, derived from `MODEL_CAPABILITIES` (newest registry-backed model per provider,
  plus OpenRouter), never re-typed. Each row is scored on three things: the agent called
  `show_artifact` with a valid spec, the chart rendered, and a by-reference follow-up re-encoded with
  no retrieval or code call. Blocked rows are recorded with their reason, never omitted. Cheapest
  honest method: per-request `model`/`provider` on `POST /threads/{id}/messages`, with verdicts read
  from the persisted messages and artifacts. ⚠ Moonshot/Kimi are `emit_tier: coerce`, the weakest
  emission guarantee, and are the likeliest rows to emit malformed args.

### Binding invariants (research and planning must keep them)
- **I-1:** The registry is **closed code**. Adding a component is a code change; no prompt, setting
  or DB row can add one at runtime. Frontend and backend each reject anything outside the three.
- **I-2:** **Live and reload render from the same persisted spec through the same component code.**
  The live render must not depend on SSE-only state that is never persisted (the roadmap's "reload
  differs" failure mode). Precedent: output files re-parse persisted data on reload
  (`threads.ts:149-174`), and `is_hero` is re-stamped so live and reload match
  (`agent_loop.py:3218-3245`).
- **I-3:** **The artifact id must survive history reconstruction.** Persisted tool results are cut
  at 2,000 characters (`agent_loop.py:3163`) and `_reconstruct_history` re-sends only that, so the
  id must sit at the **start** of the result the model sees.
- **I-4:** **Rows must not bloat every later turn.** `_reconstruct_history` re-sends each persisted
  tool call's `args`. If the inline rows (up to 500) stay in the persisted args, every later turn
  re-pays them. The persisted args should carry a reference (for example
  `rows: "<stored in artifact a_…, 120 rows>"`) while the rows live in the artifact store. ⚠
  Research must confirm, per provider, that rewriting historical tool-call args is safe (Anthropic
  `thought_signature` / Gemini signatures). This is provider-docs-first.
- **I-5:** The persisted spec (with rows) needs its **own home**, not the capped `tool_calls.result`.
  Every new table needs RLS with exactly the parent message's visibility (mirror `messages` RLS, never wider) plus
  `get_advisors(security)`. The migration takes the **next free number: `202`**, measured at this
  discuss (`ls supabase/migrations | tail` ends at `201_retrieval_rpcs_force_custom_plan.sql`).
  Re-run `ls` at planning. Apply it via the SQL editor, then regenerate `full-schema.sql`.

### Claude's Discretion
- The persistence shape: a new `message_artifacts` table, or a JSONB column on `messages`, within
  I-2, I-4 and I-5.
- The exact `show_artifact` argument schema. It must survive Gemini's schema handling (no `type`
  arrays, `additionalProperties` stripped at `google_service.py:243-250`), so typed columns plus
  string or number cells is one candidate. Research settles this per provider.
- Whether `show_artifact` is offered in Explorer mode (6 tools) and to sub-agents (`task`).
  Recommended: **top-level chat agent only** for v1.
- The byte cap alongside the 500-row cap, and the exact error and notice wording (the sketch settles
  the visual wording).
- How frontend validation is written (a hand-rolled guard or a schema library already in the tree,
  with no new dependency unless research justifies one).
- Plan count: target **3-5** (G-8). Suggested waves: (1) backend: spec models, tool, handler module,
  persistence and migration, history-arg rewrite; (2) frontend: registry, three components, notice,
  SSE handler, mount, reload mapping; (3) SC#10 board plus the G-4 drive. Merge where adjacent.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirements
- `.planning/ROADMAP.md` §"Phase 273: Agent-Authored Artifacts": goal, 5 SCs, failure modes, flags
- `.planning/REQUIREMENTS.md`: ART-01..05
- `.planning/seeds/SEED-193-agent-authored-interactive-artifacts-closed-component-vocabulary.md`: the closed-vocabulary rationale; "never fall back to raw text passthrough"; slice-1 shape
- `.planning/seeds/SEED-185-the-app-has-no-router-twelve-views-zero-addressable.md`: artifacts are not linkable (accepted)
- `.planning/seeds/SEED-194-image-generation-as-a-tool-any-endpoint.md`: rides this rail later; do not pre-empt it

### Contracts and guardrails
- `docs/EXTENSION-CONTRACT.md`: tools are closed core; a component is closed code (I-1)
- `docs/HOT-FILE-LEDGER.md` §§ `tool_dispatcher.py`, `agent_loop.py`, `openai_service.py`, `StreamsProvider.tsx`, `MessageItem.tsx`, `OutputFileCard.tsx`, `models/message.py`, `types/index.ts`, `api/threads.py`: named seams and invariants (D-14..D-16)
- `.planning/phases/272-close-means-wrong/272-CONTEXT.md` D-15/D-16: the seams handed to this phase
- `CLAUDE.md` §"UAT scoreboard recipe": the 8-row roster rule (D-21)
- `.planning/seeds/SEED-034-system-prompt-cross-provider-tool-use.md`: provider-docs-first for tool use

### Design (G-2)
- `.claude/skills/sketch-findings-agentic-rag/SKILL.md` and `references/chat-tool-card-unification.md`: the build-once inventory, the tool rail essence line, and the output-file card (note the hero/working reversal banner: the hero split is RETIRED)
- `.claude/skills/sketch-findings-agentic-rag/sources/095-grounding/CONSISTENCY.md`: do not re-fork rail or file-card components

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `recharts ^3.8.1` (`frontend/package.json:45`): already used in `components/health/RetrievalTrendChart.tsx` and `components/library/OutcomesByTypeChart.tsx`. ⚠ `FoundPerWeekSparkline.tsx:3` deliberately avoids it to keep one code-split, so lazy-load the chart component.
- Tool-body registry `frontend/src/components/chat/tool-bodies/index.ts` (`TOOL_BODIES`), with `GenericBody` fallback at `ToolCallDetails.tsx:93`: the home for `show_artifact`'s rail essence and expanded body.
- `OutputFileCard` / `FinalOutputsPanel` (`MessageItem.tsx:998-999`): the closest precedent for a structured block that renders identically live and on reload.
- Pydantic models in `backend/app/models/`; the forced-emit structured path (`openai_compat.py:520`) is harness-only and is NOT the channel here.

### Established Patterns
- Tool results persist in `messages.tool_calls` JSONB as `{tool_call_id, name, args, result[:2000], status}` (`agent_loop.py:3152-3174`), written once at run end by `_persist_assistant_message` (`agent_loop.py:1970-2010`).
- The same-turn model receives the full result or a tool-set `llm_content` (`agent_loop.py:3117-3123`). `execute_code` uses `llm_content` to strip signed URLs (`tool_dispatcher.py:2508-2516`), which is the pattern for returning the artifact id first (I-3).
- Reload mapping: `threads.ts:84 _mapMessageResponse` maps rows into the same `ToolCall`/message types the live stream builds.
- SSE event vocabulary is parsed in `frontend/src/lib/api/threads.ts:~920-1100`. A new `artifact` event lands there plus one `StreamsProvider` handler.

### Integration Points
- Backend: `_TOOL_REGISTRY` (`tool_dispatcher.py:4532-4569`, one line); tool schema plus a `get_tools()` line (`openai_service.py:1186-1240`); one persistence hook in `agent_loop.py`; history-arg rewrite in `_reconstruct_history` (`agent_loop.py:1018-1134`) or at persist time (I-4).
- Frontend: one handler in `StreamsProvider.tsx`, one `<ArtifactBlock>` mount in `MessageItem.tsx`, the `artifact` SSE parse in `lib/api/threads.ts`, and additive types in `types/index.ts`.
- DB: migration `202` (I-5).

</code_context>

<specifics>
## Specific Ideas

- Rail essence: *"show_artifact → Bar chart · 12 rows"*.
- Caption: *"Data: query_tables · Q3-report.pdf p.4 · 12 rows"*.
- Notice: *"This artifact can't be shown"* plus one plain reason.
- Over-cap error to the model: aggregate first, then call again.

</specifics>

<deferred>
## Deferred Ideas

- **Aggregate transforms** (sum/avg/count group-by) on by-reference follow-ups. Would let "by month" work without code. Its own small query engine, so a later artifact phase.
- **CSV download of an artifact's rows.** Offered alongside D-13 and not chosen for v1.
- **UI controls on the artifact** (a chart-type toggle with no model round-trip). Rejected for v1; the agent handles re-encoding (D-06).
- **Pie charts, and interleaving artifacts inside the answer text.** Rejected for v1 (D-05, D-10).
- **Artifacts in workflow/harness runs and sub-agents.** Chat top-level only for v1.
- **The full `tool_dispatcher.py` registry/handler split** (OV-273-02) and **the `agent_loop.py` prompt-assembly seam** (OV-273-03, SEED-192). Both still owed. Re-open trigger: the next phase whose `files_modified` names either file proposes the extraction FIRST.
- SEED-193's data-thread branch/compare half, SEED-194 image generation, and SEED-185 linkable artifacts: out of scope by roadmap.

### Reviewed Todos (not folded)
- `spike-nl-workflow-authoring.md` (score 0.6): matched on generic keywords ("first", "before"). It is about NL workflow authoring, not artifacts. Out of scope.

### Seeds
- **SEED-193: FOLDED** into 273 (slice 1 plus the table and metric entries). The data-thread half stays deferred. The seed's frontmatter is updated.
- The `check-seeds-register.cjs --phase 273` sweep **could not run at discuss** (no phase directory and no plans existed, so it printed FATAL). Re-run it at planning against the plans' `files_modified`, as 272 did.

### Reviewed reported bugs
- No open `surface: Agentic-RAG` report overlaps artifact rendering. Swept 2026-10-03. The nearest are BUG-260718-03 (the write_todos card in chat) and BUG-260918-01 (ask_user inputs). Both are unrelated and left.

</deferred>

---

*Phase: 273-agent-authored-artifacts*
*Context gathered: 2026-10-03*
