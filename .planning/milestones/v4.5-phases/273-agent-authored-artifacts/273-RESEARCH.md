# Phase 273: Agent-Authored Artifacts - Research

**Researched:** 2026-10-03
**Domain:** New agent tool (`show_artifact`) + closed 3-component render registry (chart / table / metric) + persisted artifact store + cross-provider tool-schema survival + chat SSE/reload seam
**Confidence:** HIGH for code-path findings (every one measured at HEAD `ccd9372f3`), MEDIUM for two live-only behaviours flagged in Open Questions (structured-mode text leak, Gemini Continue)

<user_constraints>
## User Constraints (from 273-CONTEXT.md)

### Locked Decisions

#### How the agent emits an artifact
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

#### Follow-ups and attached rows
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

#### Where it shows, and the PNG path
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

#### Hot files (G-5)
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

#### G-4 lived-experience scenarios (operator-defined at scope time; Chrome MCP drives all four at verification)
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

#### SC#10 board
- **D-21:** **8 rows**, derived from `MODEL_CAPABILITIES` (newest registry-backed model per provider,
  plus OpenRouter), never re-typed. Each row is scored on three things: the agent called
  `show_artifact` with a valid spec, the chart rendered, and a by-reference follow-up re-encoded with
  no retrieval or code call. Blocked rows are recorded with their reason, never omitted. Cheapest
  honest method: per-request `model`/`provider` on `POST /threads/{id}/messages`, with verdicts read
  from the persisted messages and artifacts. ⚠ Moonshot/Kimi are `emit_tier: coerce`, the weakest
  emission guarantee, and are the likeliest rows to emit malformed args.

#### Binding invariants (research and planning must keep them)
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

### Deferred Ideas (OUT OF SCOPE)
- **Aggregate transforms** (sum/avg/count group-by) on by-reference follow-ups. Would let "by month" work without code. Its own small query engine, so a later artifact phase.
- **CSV download of an artifact's rows.** Offered alongside D-13 and not chosen for v1.
- **UI controls on the artifact** (a chart-type toggle with no model round-trip). Rejected for v1; the agent handles re-encoding (D-06).
- **Pie charts, and interleaving artifacts inside the answer text.** Rejected for v1 (D-05, D-10).
- **Artifacts in workflow/harness runs and sub-agents.** Chat top-level only for v1.
- **The full `tool_dispatcher.py` registry/handler split** (OV-273-02) and **the `agent_loop.py` prompt-assembly seam** (OV-273-03, SEED-192). Both still owed. Re-open trigger: the next phase whose `files_modified` names either file proposes the extraction FIRST.
- SEED-193's data-thread branch/compare half, SEED-194 image generation, and SEED-185 linkable artifacts: out of scope by roadmap.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ART-01 | Agent can emit a validated chart spec that renders as an interactive chart in chat. | Tool schema verified through the project's own Gemini sanitizer (§Code Examples 1); Pydantic union verified on pydantic 2.12.5 (§Code Examples 2); recharts 3.8.1 `hide`/`responsive`/Tooltip `content` verified in installed typings (§Standard Stack); SSE `artifact` event + one handler (§Pattern 4) |
| ART-02 | Closed registry; unknown component / malformed props render nothing but a notice, never passthrough. | Backend: discriminated union rejects `pie`, extra props, `props` bag (prototype run, §Code Examples 2) + DB `CHECK (component IN …)`. Frontend: hand-rolled guard + own-property registry read; **four shipped rail leak paths L-1..L-4 plus a structured-mode leak** (§Pitfalls 1, 2) |
| ART-03 | Rows stay attached so a follow-up re-encodes without re-running the query. | `message_artifacts` row inserted at emission (same-turn and later-turn lookup on one path); id-first tool result survives the 2,000-char cut; persisted-args redaction is safe on every provider path (§I-4 provider matrix) |
| ART-04 | Table and metric join the registry as second and third entries. | Uniform `{columns, rows}` dataset + per-component encoding (§Pattern 2); metric = exactly one row after transform |
| ART-05 | Reloads identically; works across the full native roster. | Reload attaches by artifact id parsed from the persisted `show_artifact` result (NOT tool_call_id: Gemini ids collide as `call_0`) (§Pitfall 5); emit the INSERT … RETURNING row so live == reload byte-for-byte (§Pitfall 6); 8-row board via `scripts/sc10_188_run_board.derive_roster` (§Validation) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

| Directive | How it binds this phase |
|---|---|
| Python backend in `venv`; backend unit gate `pytest tests/unit -q --continue-on-collection-errors` ceiling **71 failed**, zero headroom | Every count-pin test this phase touches must be updated in the same plan (list in §Validation). 8 currently-failing tool-count tests are INHERITED (in the 71) — do not "fix" them by accident and do not count them as new |
| No LangChain / LangGraph; raw SDK calls | Nothing here needs either |
| Pydantic for structured LLM outputs | The spec is validated by a Pydantic discriminated union (D-02) |
| All tables need RLS; users only see their own data | `message_artifacts` RLS mirrors `messages` SELECT exactly (§Code Examples 5) |
| Stream via SSE; stateless chat (we store/send history) | New `artifact` SSE event; history rewrite happens on OUR persisted copy only |
| Migrations numbered under `supabase/migrations/`, digits-only prefix, applied via SQL editor (never `db push`/`reset`), then `bash scripts/regenerate-full-schema.sh` | Migration **202** (re-run `ls` at plan time: currently ends at `201_retrieval_rpcs_force_custom_plan.sql`, measured) |
| No blocking I/O in async handlers — `run_in_threadpool` / `aexec` | Reload attach via the user supabase client must go through `aexec`; handler DB I/O via the asyncpg pool |
| Supabase MCP points at PRODUCTION; writes approval-gated | Local verification is SQL as `anon`/`authenticated` roles; `get_advisors(security)` is a deploy-parity step, not a local one |
| Provider-docs-first | §I-4 provider matrix cites Google/OpenAI docs and the adapter code |
| A model's capabilities are DATA | No new capability field is needed; the tool works on every native path |
| Extension Contract: tools are closed core | `_TOOL_REGISTRY` 29 → 30 is the recorded deliberate change; component registry is closed code (I-1) |
| Worktrees ENABLED; bootstrap first; `GSD_VITEST_MAX_WORKERS=2`; never `rm -rf` a worktree | Plan 02 (new frontend files) can run in a worktree parallel to Plan 01 |
| UAT scoreboard recipe: full 8-row native roster + OpenRouter, derived from `MODEL_CAPABILITIES`; blocked rows named | D-21 board |
| G-5 / hot-file ledger gate `node scripts/check-hot-file-ledger.cjs <phase>` | 3 rail files have **no row** today (measured, §Ledger) |
| CLAUDE.md size budget (warn band 120,000) | **Measured 119,524 chars — 476 chars under the warn band.** Any CLAUDE.md ledger-cell edit will cross the WARN band (advisory, exit 0). Put new rows in `docs/HOT-FILE-LEDGER.md`, keep CLAUDE.md edits minimal |
| G-8: 3-5 plans | §Recommended plan grouping: 4 plans |
| Frontend typecheck: `npx tsc -p tsconfig.app.json --noEmit` (NOT `npx tsc --noEmit`, which checks zero files); set-diff against base | Validation commands |

## Summary

The phase is buildable on existing seams with **no new dependency**. The backend half is a new tool module (`show_artifact_tool.py`, the 272 `search_documents_tool.py` precedent), a Pydantic spec module, a small asyncpg DB module, and a `message_artifacts` table (migration 202). The handler validates the call, resolves `from_artifact` against the store (bound to `thread_id` + `user_id`), applies the closed transforms, builds the server-derived caption from the run's earlier tool calls, **inserts the row at emission time**, emits an `artifact` SSE event carrying the inserted row, and returns an **id-first** JSON result well under 2,000 chars. `agent_loop.py` needs exactly one hook (persist-time args redaction in `_persist_assistant_message`) plus one by-reference `ToolContext` kwarg in each of its two builds (the 272 D-09 shape) so the caption can see the turn's prior calls.

The provider question (I-4) resolves cleanly: rewriting **persisted** args is safe on every path because (a) the in-turn conversation is built from the raw `tc["arguments"]` string, never the persisted dict (`agent_loop.py:2970`), so the current turn is untouched; (b) Gemini validates thought signatures **only in the current turn** [CITED: ai.google.dev thought-signatures]; (c) Anthropic runs with thinking OFF and `tool_use.input` carries no signature (`provider_gateway/anthropic.py:102`); (d) the OpenAI Responses adapter does not round-trip reasoning items and replays `arguments` as a plain string (`openai_responses.py:49-56, 137-197`); (e) OpenAI-compat providers carry no signature on args. One LOW-risk edge remains: a Continue (no new user message) puts a redacted, signed Gemini call inside the current turn; probe it on the board.

The tool schema must be a **flat object** with nullable sub-objects, because the Gemini boundary strips `anyOf/oneOf/additionalProperties` and collapses type arrays to their first member (`google_service.py:243-342`). I ran a prototype schema through the project's own `_convert_tools_to_google` and a prototype union through pydantic 2.12.5: the Gemini Tool constructs (rows → `ARRAY<ARRAY<STRING nullable>>`), and the union rejects `pie`, an extra prop, and a `props` bag. Consequence: on Gemini every cell arrives as a **string**, so number coercion **per declared column type** is a hard requirement, not a nicety. The OpenAI Responses surface (gpt-5.6 family) also matters: when `strict` is omitted, Responses "will attempt to normalize your schema into strict mode" [CITED: developers.openai.com function-calling], so every key may arrive as `null` — the models must accept null-filled calls (verified in the prototype).

The frontend half is mostly new files (registry, frame, three components, notice, guard, copy) plus the D-16 handler/mount and the UI-SPEC's four rail leak paths. The UI-SPEC (`273-UI-SPEC.md`, approved) already found L-1..L-4; this research adds two more leaks it did not cover: the **structured-mode** text path (OpenRouter rows stream the tool-call JSON as answer text) and a **refused call's rows persisting in history** unless redaction covers refusals too.

**Primary recommendation:** `message_artifacts` table written at emission; flat nullable-object tool schema with typed columns + positional rows; persist-time args redaction as the one `agent_loop` hook; reload attaches by the artifact id carried in the persisted tool result; 4 plans (backend · frontend components · frontend wiring + rail · board + G-4).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Spec validation (closed union, caps, coercion) | API / Backend (Pydantic) | Browser (guard on render) | D-02: validate on the way in; frontend re-validates stored specs (D-12, I-1) |
| By-reference transforms (filter/select/sort/top-N) | API / Backend | — | Server loads stored rows; the model never re-types them (D-06/D-07) |
| Provenance caption | API / Backend | — | D-04 "never written by the model"; derived from the run's tool calls |
| Artifact persistence + immutability | Database (`message_artifacts`, RLS) | API (asyncpg insert) | I-5 own home; immutability by no UPDATE grant/policy |
| History-args redaction (I-4) | API / Backend (persist hook) | — | Touches only our persisted copy; in-turn messages untouched |
| Live delivery | API (SSE `artifact` event) | Browser (StreamsProvider) | D-16 one event, one handler |
| Reload delivery | API (`GET /messages` + `/snapshot` attach) | Browser (`_mapMessageResponse`) | I-2 same record shape both ways |
| Rendering + interactivity (hover, legend toggle, sort) | Browser | — | recharts lazy chunk; table/metric plain React |
| "Can't be shown" notice | Browser | — | D-12 last resort; closed reason catalogue |
| Harness / sub-agent exclusion | API (grounding offer set, `_SUB_AGENT_EXCLUDED`, handler belt) | — | Chat top-level only (deferred ideas) |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pydantic | 2.12.5 (installed, measured) | Discriminated union `Field(discriminator="component")`, `ConfigDict(extra="forbid")` | Project rule; prototype verified rejection paths [VERIFIED: local venv run] |
| recharts | 3.8.1 (installed, measured `node_modules/recharts/package.json`) | Line/Bar/Area/Scatter, `hide` per series, Tooltip `content`, Bar `stackId` + `radius`, chart `responsive` prop | Already a dependency, used by `RetrievalTrendChart.tsx` / `OutcomesByTypeChart.tsx` [VERIFIED: `types/cartesian/Line.d.ts:95` `hide?`, `types/util/types.d.ts:1244` `responsive?`, `types/component/Tooltip.d.ts:65` `content?`, `types/cartesian/Bar.d.ts:69,167` `stackId`/`radius`] |
| asyncpg | (installed; pool via `app/dependencies.py:84 get_pg_pool`) | Insert/lookup of artifacts | Pool connects as `postgres` (`config.py:1201`), i.e. RLS-bypassing — every pool query MUST bind `user_id` + `thread_id` |
| google-genai | 2.6.0 | Gemini native path; `types.Schema.items` is recursive (`Optional[Schema]`) | Nested-array schema constructs client-side [VERIFIED: local run] |
| openai | 2.28.0 | Chat Completions + Responses adapters | Existing |
| anthropic | 0.97.0 | Native SDK path | Existing |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| React `lazy`/`Suspense` | React 19.2.4 | Code-split `ChartArtifact` | Precedent `HealthTab.tsx:24` (`RetrievalTrendChart`), `ExecuteCodeBody.tsx:12` |
| `Intl.NumberFormat` | platform | compact ticks / grouped tooltip values | UI-SPEC Axes row |
| vitest 4.1 + jsdom + Testing Library | installed | unit/component tests | No `ResizeObserver` polyfill in `src/setupTests.ts` — see Pitfall 9 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled frontend guard | `zod` | `zod` is **not** a direct dependency (only transitive under `@vercel/cli-config`, `package-lock.json:4568-4573`). Adding it is a new dependency for ~150 lines of guard; the backend is the authority and the guard only protects rendering. **Use the hand-rolled guard.** |
| `message_artifacts` table | JSONB `artifacts` column on `messages` | JSONB is free on reload (`GET /messages` selects `*`) and inherits RLS, BUT: `messages` is `REPLICA IDENTITY FULL` and in `supabase_realtime` (`full-schema.sql:2295, 8481`), so 100+ KB specs ride every WAL/realtime change; `messages` has an owner UPDATE policy (`full-schema.sql:7004`) so immutability (D-08) is not structural; same-turn by-reference would need a second, in-memory lookup path; it would also change `db/runs.py insert_assistant_message`, whose own tests are already in the inherited-failure set (`test_db_runs.py::test_insert_assistant_message_*`, 272-BASELINES). **Use the table.** |
| Rows as array-of-objects keyed by column | Positional arrays aligned to `columns` | Objects with dynamic keys need `additionalProperties`, which the Gemini boundary strips (`google_service.py:249-250`) → Gemini sees an object with no properties. Also Postgres `jsonb` reorders object keys. **Positional arrays.** |
| recharts `<Legend>` | Custom `<button aria-pressed>` row + series `hide` | UI-SPEC locks the custom row; recharts' default legend is not a button set. Legend `onClick` exists (`DefaultLegendContent.d.ts:91`) but the a11y contract wants real buttons |
| `ResponsiveContainer` | chart `responsive` prop (recharts ≥3.3) | Either works; `responsive` avoids the wrapper. Both need ResizeObserver in jsdom tests |

**Installation:** none. No package is added by this phase.

## Package Legitimacy Audit

No external package is installed by this phase. `recharts@3.8.1` is already in `frontend/package.json:45` and installed; every backend library is already in the venv. slopcheck was not run because there is nothing to install.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| (none new) | — | — | — | — | n/a | — |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none
⚠ If a plan proposes `zod` or any chart helper, it is a NEW dependency and must go through the gate + a `checkpoint:human-verify`. This research recommends against it.

## The I-4 Provider Matrix (provider-docs-first)

**Where the rewrite happens: persist time, in `_persist_assistant_message` (one pure call over `completed_tools`), NOT in `_reconstruct_history`.** Reasons: (1) it covers BOTH append sites — the main dispatch loop (`agent_loop.py:3152-3174`) and the Continue/resume block (`agent_loop.py:2211-2217`) — because both feed the same `persisted_tool_calls` list; (2) reload then shows the reference, never 500 rows, so the frontend `ToolArgsBlock` leak (L-2) shrinks to a placeholder; (3) DB rows stay small. Rewriting at read time would leave every row's args holding the rows forever.

**What the in-turn model sees is unaffected:** the assistant message appended for the current iteration uses the raw string `tc["arguments"]` (`agent_loop.py:2970`), and the tool message uses `llm_content or tool_result` (`:3117-3123`). Only later turns read the persisted dict through `_reconstruct_history` (`:1072-1095`, `"arguments": json.dumps(tc.get("args", {}))`).

| Path | What is replayed for a prior turn's call | Signed? | Verdict | Evidence |
|---|---|---|---|---|
| Google native (Gemini 3.x) | `Part.from_function_call(name, args_dict)` + `thought_signature` attached to the Part (`google_service.py:170-205`) | Yes, but **"Strict validation is enforced for all function calls within the current turn. (Only current turn is required; we don't validate on previous turns)"**; current turn = back to the most recent user message with text | **SAFE** for prior turns. ⚠ LOW-risk edge: a **Continue** writes no user row (`agent_loop.py:1145-1151`, D-268-27), so a paused run's signed `show_artifact` call (with redacted args) sits in the current turn. Docs require signature *presence* and say nothing about arg integrity. Probe on the board; documented fallback is the dummy signature `skip_thought_signature_validator` | [CITED: https://ai.google.dev/gemini-api/docs/generate-content/thought-signatures] |
| Anthropic native | `tool_use` block with parsed `input` (`anthropic_service.py:88-98`); no thinking blocks | No: thinking is OFF by design (`provider_gateway/anthropic.py:102`, D-05); `tool_use.input` is not signed | **SAFE** | [VERIFIED: code] |
| OpenAI Chat Completions + compat (DeepSeek, GLM, MiniMax, Moonshot, OpenRouter) | `{"function": {"arguments": json.dumps(args)}}` | No signature on arguments in any of these APIs; DeepSeek's `reasoning_content` round-trip is a separate field on the in-turn message (`agent_loop.py:2992-2998`) and is untouched | **SAFE** | [VERIFIED: code] [ASSUMED: no compat vendor signs args — none of their docs describe it] |
| OpenAI Responses (`api_surface: responses`, gpt-5.6 family) | `function_call` item with `arguments` string; **reasoning items are NOT round-tripped** (recorded known gap, `openai_responses.py:49-56`), `store=False` | No | **SAFE** | [VERIFIED: code] |
| Anthropic prompt cache | tools carry `cache_control` (`anthropic_service.py:139`); history is rebuilt from DB each turn anyway (results already cut to 2,000) | n/a | Redaction is stable once persisted → no extra cache churn | [VERIFIED: code] |

**The redaction must also cover REFUSED calls.** A call refused for 1,240 rows (D-09) still lands in `persisted_tool_calls` with status `done` and its full args (`agent_loop.py:3165-3174`); without redaction it re-sends 1,240 rows on every later turn — the exact I-4 failure. Rule: for every `show_artifact` call, `rows` becomes `"<stored in artifact a_…, N rows>"` when a row was stored, else `"<not stored: refused, N rows>"`; a non-list `rows` becomes `"<not stored>"`.

## Architecture Patterns

### System Architecture Diagram

```
 user prompt ──► POST /threads/{id}/messages ──► run_agent_loop (agent_loop.py)
                                                     │
            ┌────────────── iteration N ─────────────┤
            │ provider stream (native | responses | compat | STRUCTURED)
            │      │ tool_preparing / tool_args_progress(code_so_far = raw args JSON) ──► SSE ──► rail (L-1: must hide body)
            │      ▼
            │ tool_calls_buffer ──► messages.append(assistant, arguments=RAW STRING)   ◄── in-turn view, never rewritten
            │      │
            │      ▼ dispatch_tool("show_artifact", args, ctx)  (tool_dispatcher: 1 registry line)
            │      │
            │      ▼ show_artifact_tool.handle_show_artifact
            │        1. guard: ctx.parent_run_id / ctx.phase_whitelist set? ──► refuse (chat top-level only)
            │        2. coerce stringified JSON (Kimi/weak models) ─► Pydantic union (extra=forbid)
            │              └─ fail ─► ToolResult {"status":"refused","reason":<people>,"detail":<model>} ──► model retries (D-12)
            │        3. from_artifact? ─► db.get_artifact(id|label, thread_id, user_id) ─► transforms (filter→top_n→sort→select)
            │        4. caption ◄── ctx.turn_tool_calls (by-ref persisted_tool_calls: names, doc args, page)
            │        5. db.insert_artifact(...) RETURNING *   (message_artifacts, at EMISSION)
            │        6. ctx.emit('artifact', record=<RETURNING row>) ──► SSE ──► StreamsProvider.onArtifact ──► message.artifacts[]
            │        7. ToolResult(result = '{"artifact_id":"a_…","label":"chart 1",...}' (<2000 chars, id FIRST))
            │      ▼
            │ tool_end (result[:2000]) ──► rail essence "Show an artifact → Bar chart · 12 rows"
            │ persisted_tool_calls.append({args, result[:2000], status:"done"})
            └─────────────────────────────────────────┘
                                                     │ run end / shielded finalizer (cancel, fail)
                                                     ▼
                         _persist_assistant_message:  completed_tools = redact_artifact_args(completed_tools)   ◄── THE ONE HOOK (I-4)
                                                     ▼
                                             messages row (tool_calls with reference args + id-first result)

 reload: GET /threads/{id}/messages | /snapshot
         ─► _enrich_messages_with_runs ─► attach_artifacts(messages, user supabase client)
               (ids parsed from each show_artifact result → ONE batched RLS select → message["artifacts"] in call order)
         ─► MessageResponse.artifacts: list[dict] | None ─► _mapMessageResponse ─► message.artifacts[]
                                                                                         │
 live and reload ───────────────────────────────────────────────────────────────────────►│
                                    MessageItem: ONE <ArtifactBlock artifacts={message.artifacts}/> mount
                                          └─ per record: guard ─► closed registry (own-property read) ─► Chart(lazy) | Table | Metric
                                                               └─ fail / error boundary ─► ArtifactNotice (closed reason catalogue)

 later turn: _reconstruct_history re-sends args with "<stored in artifact a_…>" + id-first result ─► model calls show_artifact(from_artifact="a_…")
```

### Recommended Project Structure
```
backend/app/
├── models/artifact.py                    # NEW — closed Literal components, union, transforms, caps, record-out shape
├── services/show_artifact_tool.py        # NEW — handler, transforms, caption, result text (D-14 home)
├── services/artifact_history.py          # NEW — redact_artifact_args() [the loop's one hook] + attach_artifacts() [reload]
├── db/artifacts.py                       # NEW — asyncpg insert/get bound to (thread_id, user_id)
├── services/tool_dispatcher.py           # +1 registry line, +1 ToolContext field, +1 token in _SUB_AGENT_EXCLUDED
├── services/openai_service.py            # +SHOW_ARTIFACT_TOOL schema, +1 get_tools line, +CHAT_ONLY_TOOLS constant
├── services/agent_loop.py                # +1 kwarg in each ToolContext build, +1 hook line in _persist_assistant_message
├── services/harness/grounding.py         # offered set minus CHAT_ONLY_TOOLS (1 line)
├── api/threads.py                        # +1 attach call in get_messages and get_snapshot
└── models/message.py                     # MessageResponse.artifacts: list[dict] | None = None
supabase/migrations/202_message_artifacts.sql  # NEW
scripts/full-schema-supplement.sql        # mirror the ACL lines (195 precedent, :504-509)

frontend/src/
├── components/chat/artifacts/            # NEW dir — everything new lives here
│   ├── ArtifactBlock.tsx                 # the one mount's body: list, per-item boundary, Suspense
│   ├── ArtifactFrame.tsx                 # card: header, kind chip, body slot, caption
│   ├── artifactRegistry.ts               # EXACTLY 3 keys, own-property read
│   ├── artifactSpec.ts                   # types + parseArtifactRecord() guard → {ok,record}|{ok:false,reason}
│   ├── artifactCopy.ts                   # every user-visible string (UI-SPEC)
│   ├── chartModel.ts                     # pure: slots by full-series index, domains, tooltip rows, ticks
│   ├── ChartArtifact.tsx                 # lazy default export; the only recharts importer
│   ├── TableArtifact.tsx
│   ├── MetricArtifact.tsx
│   └── ArtifactNotice.tsx
├── components/chat/tool-bodies/ShowArtifactBody.tsx   # NEW — essence + expanded body (L-3/L-4)
├── components/chat/tool-bodies/index.ts  # +TOOL_BODIES/TOOL_SUMMARIES entries
├── components/chat/ToolCallDetails.tsx   # suppress ToolArgsBlock (L-2) + dispatch result (L-3/L-4)
├── components/chat/ToolCallPanel.tsx     # hideBody for show_artifact (L-1)
├── components/chat/StepRow.tsx           # `refused` amber node state (UI-D-02)
├── components/chat/MessageItem.tsx       # ONE <ArtifactBlock> mount
├── providers/StreamsProvider.tsx         # ONE onArtifact handler
├── lib/api/threads.ts                    # 'artifact' SSE branch + _mapMessageResponse destructure
├── lib/toolNames.ts / lib/toolMeta.ts    # phrase + activity string (UI-SPEC)
├── types/index.ts                        # ArtifactRecord + Message.artifacts
└── index.css                             # --chart-1..--chart-4 (none exist today, measured)
```

### Pattern 1: Flat, nullable-object tool schema (survives every provider boundary)
**What:** One object with `component` enum + `title` required; every other key optional and nullable via type arrays (`["array","null"]`, `["object","null"]`). Encodings are sibling nullable objects (`chart`, `metric`), not `oneOf` branches. Cells are `["string","number","null"]`.
**Why:** Gemini strips `oneOf/anyOf/additionalProperties` and collapses type arrays to the first non-null member + `nullable: true` (`google_service.py:243-342`). Type arrays already ship across the roster in `QUERY_DOCUMENTS_BY_VIEW_TOOL` (`openai_service.py:229-232`), which passed earlier SC#10 boards. The Responses surface normalizes to strict when omitted, so all keys may arrive (null-filled) [CITED: developers.openai.com/api/docs/guides/function-calling].
**STRUCTURED mode caveat:** `_format_tool_list` renders only TOP-LEVEL property names and types (`agent_loop.py:867-886`) — `chart (object)`, `rows (array)` — so a model on the STRUCTURED path (all OpenRouter rows are `native_tools: False`) never sees the nested shape. **The tool description must carry one compact example call.**

### Pattern 2: One dataset shape for all three components
**What:** Every artifact = `columns: [{name, type: number|string, unit?}]` + `rows: [[cell…]]` + a component encoding. `chart`: `{kind, x, y[], stacked?}` (wide format; `y` are number columns = series). `table`: no encoding (columns + transform `select` decide what shows). `metric`: `{value_column, compare_column?, label?, compare_label?}` and the dataset must have **exactly one row after transforms** (refuse otherwise: "a metric needs exactly one row; filter to it first").
**Why:** One validator, one store shape, one by-reference path; "make the Q4 revenue a metric" = `from_artifact` + `filter quarter=Q4` + `component: metric`. No aggregation needed (D-07).
**Series caps (UI-D-01):** line/bar/area ≤ 4, scatter ≤ 3 → refuse above.

### Pattern 3: Handler module with an id-first, people-safe result
**What:** `show_artifact_tool.handle_show_artifact(args, ctx) -> ToolResult` (registered as one line, like `search_documents_tool.handle_search_documents` at `tool_dispatcher.py:48-49`). Success result is compact JSON whose FIRST key is `artifact_id`, then `label`, `component`, `kind`, `row_count`, `columns` (name/type), up to ~12 distinct values per string column (so "only Q3" can be built on a later turn when the rows are gone from history), and one instruction line. Refusal result uses a structured marker the UI can read (UI-D-02): `{"status":"refused","reason":"<short, people-safe>","detail":"<model-facing: which field, how to fix>"}` — **avoid a top-level `error` key**, because `ToolResultBlock` renders `parsed.error` verbatim in destructive italic (`ToolCallDetails.tsx:67-71`, leak L-4).
**Precedent for llm_content vs result split:** `execute_code` (`tool_dispatcher.py:2586-2594`). Not needed here if the result itself is already people-safe and < 2,000 chars.

### Pattern 4: SSE event = the inserted row (I-2)
**What:** `INSERT … RETURNING *` and emit that row via `ctx.emit(ctx.redis, ctx.run_id, 'artifact', artifact=<row>)` (the `workspace_file_written` precedent, `tool_dispatcher.py` `_handle_workspace_write`). Reload returns the same row from PostgREST. Both pass through the same frontend guard and component.
**Why:** `jsonb` normalizes numbers and reorders object keys; emitting the Python object you built would differ subtly from what reload returns. Emitting the DB's own round-trip makes live == reload by construction.

### Pattern 5: By-reference ToolContext accumulator (272 D-09 shape)
**What:** `ToolContext.turn_tool_calls: list[dict] | None = None`, set to the loop's `persisted_tool_calls` list **by reference** in BOTH builds (`agent_loop.py:3035-3075` and `:2156-2186`). `None` on every harness/eval/test caller → caption degrades to "values provided by the agent".
**Why:** the caption must exist at emission time (live render), so it cannot be computed at persist time. Precedents: `dead_gap_tokens_in_run`, `empty_filter_fields_in_run` (`tool_dispatcher.py:121-138`).

### Pattern 6: Reload attach keyed by the artifact id in the persisted result
**What:** `attach_artifacts(messages, supabase)` walks each assistant message's `tool_calls`, parses `artifact_id` from every `show_artifact` result, does ONE `.in_("id", ids)` select through the user client (RLS is the enforcement; wrap in `aexec`), and sets `message["artifacts"]` in call order. A referenced id with no row → `{"id": …, "missing": true}` so the UI shows the `data-missing` notice instead of silently dropping it.
**Why not tool_call_id:** Gemini assigns `call_{idx}` when the SDK gives no id (`google_service.py:535`), which repeats every iteration and turn. **Why not run_id:** `runs.message_id` has no UNIQUE constraint and several runs can share a message (`threads.py:290-315` docstring).

### Anti-Patterns to Avoid
- **`props: dict` / passthrough anywhere** (D-02). Including inside `chart` (e.g. a free `options` object).
- **Echoing the model's string in a notice or rail reason** (UI-SPEC: `"pie"` only if in the alias table).
- **Rendering cells/titles through `MarkdownRenderer`** — data is untrusted (it may come from retrieved documents). Render as React text only.
- **Mutating the caller's `args` dict inside the handler** to get I-4 for free. It works today (the same dict object is appended at `agent_loop.py:3167`), but it is invisible coupling that a future `dict(args)` copy silently breaks. Use the explicit persist hook.
- **Map lookups with a coalesced bracket read** in the registry (prototype-key sink, `lib/toolNames.ts` docblock) — use an own-property check.
- **Chart animation** (UI-D-09) — breaks the G4-2 screenshot comparison.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Spec validation + error messages | if/else dict walking | Pydantic discriminated union, `extra="forbid"`, `field_validator(mode="before")` for stringified JSON | Prototype proved tag/extra/literal rejection paths; `e.errors()` gives `loc` to word the `detail` |
| Weak-model stringified nested args | new parser | the `write_todos` precedent: `json.loads` once if `str`, then validate (`tool_dispatcher.py:4269-4278`, BUG-260529-01) | Already proven on OpenRouter weak models |
| Charts, tooltips, hit-testing, stacking | SVG by hand | recharts 3.8.1 (`hide`, `stackId`, Tooltip `content`, `accessibilityLayer`) | Hover/crosshair/keyboard nav are the hard parts |
| Code-split | manual dynamic import plumbing | `React.lazy` + `Suspense` (`HealthTab.tsx:24` precedent) | Keeps recharts out of the chat chunk |
| Row-level visibility | app-side owner filter on reload | RLS policy mirroring `messages` + user-JWT client | I-5 "exactly the parent message's visibility" |
| Board harness | a new runner | `scripts/sc10_188_run_board.py::derive_roster` + `conc_probe` kit, as `scripts/run-272-board.py` does | Roster derived, never re-typed |
| Migration shape test | ad-hoc | `tests/unit/test_266_migration_195_shape.py` pattern (comment-stripped statement assertions + supplement mirror) | Proven in 266 |

**Key insight:** every "hard" part here already has a project precedent; the risk is in the seams (history args, rail leak paths, provider schema boundaries), not in rendering.

## Common Pitfalls

### Pitfall 1: The spec leaks onto the page through the RAIL (L-1..L-4)
**What goes wrong:** SC#2 fails with every validation passing. `tool_args_progress.code_so_far` is the raw cumulative args JSON for every tool (`agent_loop.py:2434-2443`) and `ToolArgsLivePanel` renders it unless `hideBody` (only `execute_code` today, `ToolCallPanel.tsx:370`); `ToolArgsBlock` "Show parameters" `JSON.stringify`s args (`ToolCallDetails.tsx:20-48`); `GenericBody` prints 1,500 chars of the result; `parsed.error` prints verbatim.
**How to avoid:** the four arms in `273-UI-SPEC.md` §Leak paths. Put the "args body hidden" decision in ONE set exported from `tool-bodies/index.ts` and read it in both `ToolCallPanel` and `ToolCallDetails`.
**Warning signs:** a G4-3 drive that expands the rail and finds `{"`.

### Pitfall 2: STRUCTURED-mode providers stream the tool-call JSON as answer text (new — not in the UI-SPEC)
**What goes wrong:** on the STRUCTURED path the model writes the call as a ```json block in its text; every chunk is emitted as a `delta` (`agent_loop.py:2378-2382`), then the parse clears `full_content` (`:2692-2694`) **before** the `turn_boundary` check (`:3021-3022`), so no fold event fires and the streamed JSON stays in the message body until reload. Pre-existing for every tool on this path; for `show_artifact` it is up to 500 rows of spec on screen — SC#2's exact failure. Every OpenRouter registry row is `native_tools: False` (measured), so the OpenRouter board row hits it.
**How to avoid:** measure on the board's OpenRouter row first (MEDIUM confidence until driven). If confirmed, the smallest fix is in the structured branch: emit `turn_boundary` before clearing `full_content` when `structured_calls` parsed (one line, `agent_loop.py` — note it is a second agent_loop touch). That moves the text into the narration fold; whether a fenced tool-call block inside the fold is acceptable for SC#2 is an operator call (Open Question 1).
**Warning signs:** the OpenRouter row's live screenshot shows ```json.

### Pitfall 3: Gemini (and gpt-5.6) send numbers as strings / every key as null
**What goes wrong:** cells collapse to `STRING nullable` at the Gemini boundary (prototype: `rows → ARRAY<ARRAY<STRING>>`); `transform.filter[].value` too. Responses strict-normalization sends all keys, nulls included.
**How to avoid:** coerce per declared column type in a `model_validator(mode="after")`: number column → accept int/float, or a string matching a strict numeric pattern (allow `,` thousands separators only); anything else → refusal naming the column and row ("put units in `unit`, pass bare numbers"). Accept `None` everywhere optional. Test the null-filled shape explicitly.
**Warning signs:** Gemini row renders a chart with all-zero bars, or refuses every call.

### Pitfall 4: Refused calls bloat history forever
**What goes wrong:** a refused 1,240-row call persists with full args (status `done`).
**How to avoid:** the redaction hook rewrites `rows` for EVERY `show_artifact` call, stored or not (§I-4 matrix).

### Pitfall 5: Mapping artifacts to messages by `tool_call_id`
**What goes wrong:** Gemini ids default to `call_{idx}` (`google_service.py:535`) and repeat across iterations/turns → wrong artifact on reload.
**How to avoid:** map by the `artifact_id` parsed from the persisted result (Pattern 6).

### Pitfall 6: Live ≠ reload from jsonb normalization
**What goes wrong:** `jsonb` reorders object keys and normalizes numerics; a Python-built SSE payload can differ from the reload payload.
**How to avoid:** emit the `RETURNING` row (Pattern 4); never key rows by column name; never let render logic depend on object key order.

### Pitfall 7: The empty-answer fallback mislabels an artifact-only answer
**What goes wrong:** if the model ends after `show_artifact` with no text, `if not full_content:` (`agent_loop.py:3262`) appends *"The model produced 1 tool call(s) … and never wrote an answer"* — false, the artifact was the answer.
**How to avoid:** the success result instructs the model to write one or two sentences after the call (no loop change). Verify on the board; if a provider still ends silently, the honest fix is in agent_loop (another touch) — Open Question 2.

### Pitfall 8: `show_artifact` leaks into harness authoring and sub-agents
**What goes wrong:** adding it to `get_tools()` (locked by CONTEXT) also adds it to `grounding.py:477` `schema_tool_names = {… for t in get_tools(None)}` → the workflow builder offers it; `task` sub-agents may be granted it (`tool_dispatcher.py:4143-4163`).
**How to avoid:** `CHAT_ONLY_TOOLS = frozenset({"show_artifact"})` beside the schema; `grounding.py:477` subtracts it (offered set stays 28, so `frontend/src/components/workflows/toolNames.test.ts:56` stays true); add `"show_artifact"` to `_SUB_AGENT_EXCLUDED` (`tool_dispatcher.py:4103`); handler belt refuses when `ctx.parent_run_id is not None or ctx.phase_whitelist is not None`.
**Knock-on:** UI-SPEC wants the phrase `Show an artifact` in `lib/toolNames.ts`, but `components/workflows/toolNames.test.ts:110-120` asserts the phrase-table key set **equals** the harness-offered set. Either amend that fixture to `OFFERED ∪ CHAT_ONLY` with a comment, or put the chat label in `lib/toolMeta.ts toolLabel()` (`:9-29`) instead. Decide in the plan.

### Pitfall 9: recharts in jsdom
**What goes wrong:** no `ResizeObserver` polyfill (`src/setupTests.ts` has none); `ResponsiveContainer`/`responsive` measure 0 width, render nothing, or throw.
**How to avoid:** put all data logic in pure `chartModel.ts` (unit-tested), test the legend as plain buttons whose state drives a `hidden` set, and either pass fixed `width/height` in tests or `vi.mock("recharts")` to capture `hide` props. Real hover/tooltip proof is the G-4 Chrome drive.

### Pitfall 10: Count pins and the backend gate
**What goes wrong:** 7 test files pin `_TOOL_REGISTRY == 29` or the expected key set; `test_085_tool_registration.py:280/289` pins `get_tools` 25/28. Missing one = a new failure over the 71 ceiling.
**How to avoid:** update them in the same plan as the registry line (full list in §Validation). Do NOT touch `test_module7_tools.py` (14/15) or `test_explorer_agent.py` — they are already red and in the frozen 71 (272-BASELINES).

### Pitfall 11: Pool queries bypass RLS
**What goes wrong:** the asyncpg pool connects as `postgres` (`config.py:1201`); a `from_artifact` lookup by id alone would let a prompt-injected model read another user's artifact.
**How to avoid:** `WHERE id = $1 AND thread_id = $2 AND user_id = $3`. Same-thread only. Accept a thread label alias (`"chart 1"`) resolved inside the same predicate.

### Pitfall 12: Long threads can trim the id out of context
**What goes wrong:** `trim_messages_to_fit` drops old messages on the long-message axis; the model can no longer see `a_…`.
**How to avoid:** accept the visible label (`chart 1`, stored per component per thread, UI-D-03) as a `from_artifact` alias; the error for an unknown reference lists the thread's existing labels.

### Pitfall 13: CLAUDE.md is 476 chars under the warn band
**What goes wrong:** updating stale CLAUDE.md ledger cells crosses 120,000 (WARN, exit 0) — a split becomes due.
**How to avoid:** new rows go in `docs/HOT-FILE-LEDGER.md` only; re-derive CLAUDE.md cells only for FIRING rows the phase actually edits, and keep them ≤ the 200-char cap.

## Code Examples

### 1. Tool schema (prototype — verified through `_convert_tools_to_google`)
```python
# Verified 2026-10-03: google_service._convert_tools_to_google([SHOW_ARTIFACT_TOOL]) constructs;
# rows -> ARRAY<ARRAY<STRING nullable>>, chart -> OBJECT nullable, filter.value -> STRING.
CELL = {"type": ["string", "number", "null"]}
SHOW_ARTIFACT_TOOL = {"type": "function", "function": {
  "name": "show_artifact",
  "description": (  # D-11 guidance lives HERE, not in SYSTEM_PROMPT. Keep total ≲ 3,000 chars.
    "Show an interactive chart, table or single metric to the user, below your answer. "
    "Use this for any in-chat visual. Use execute_code only when the user asks for a FILE "
    "(a PNG, 'for the deck', 'for the report'). Pass bare numbers (units go in `unit`). "
    "Max 500 rows; aggregate first if you have more. To change or filter an artifact you "
    "already showed, call again with from_artifact=<its id or label> and NO rows. "
    "After the call, write one or two sentences about what it shows. Example: "
    '{"component":"chart","title":"Revenue by quarter","columns":[{"name":"quarter","type":"string"},'
    '{"name":"revenue","type":"number","unit":"$K"}],"rows":[["Q1",120],["Q2",135]],'
    '"chart":{"kind":"bar","x":"quarter","y":["revenue"]}}'),
  "parameters": {"type": "object", "properties": {
    "component": {"type": "string", "enum": ["chart", "table", "metric"]},
    "title": {"type": "string"},
    "from_artifact": {"type": ["string", "null"]},
    "columns": {"type": ["array", "null"], "items": {"type": "object", "properties": {
        "name": {"type": "string"}, "type": {"type": "string", "enum": ["number", "string"]},
        "unit": {"type": ["string", "null"]}}, "required": ["name", "type"]}},
    "rows": {"type": ["array", "null"], "items": {"type": "array", "items": CELL}},
    "chart": {"type": ["object", "null"], "properties": {
        "kind": {"type": "string", "enum": ["line", "bar", "area", "scatter"]},
        "x": {"type": "string"}, "y": {"type": "array", "items": {"type": "string"}},
        "stacked": {"type": ["boolean", "null"]}}, "required": ["kind", "x", "y"]},
    "metric": {"type": ["object", "null"], "properties": {
        "value_column": {"type": "string"}, "compare_column": {"type": ["string", "null"]},
        "label": {"type": ["string", "null"]}, "compare_label": {"type": ["string", "null"]}},
        "required": ["value_column"]},
    "transform": {"type": ["object", "null"], "properties": {
        "filter": {"type": ["array", "null"], "items": {"type": "object", "properties": {
            "column": {"type": "string"}, "op": {"type": "string", "enum": ["eq", "in", "range"]},
            "value": CELL, "values": {"type": ["array", "null"], "items": CELL},
            "min": {"type": ["number", "null"]}, "max": {"type": ["number", "null"]}},
            "required": ["column", "op"]}},
        "select": {"type": ["array", "null"], "items": {"type": "string"}},
        "sort": {"type": ["object", "null"], "properties": {
            "column": {"type": "string"}, "direction": {"type": "string", "enum": ["asc", "desc"]}},
            "required": ["column", "direction"]},
        "top_n": {"type": ["integer", "null"]}}}},
    "required": ["component", "title"]}}}
```

### 2. Pydantic closed union (prototype — verified on pydantic 2.12.5)
```python
# Verified: "pie" -> union_tag_invalid; chart.color -> extra_forbidden; table.props -> extra_forbidden;
# Gemini/Responses null-filled table -> valid; stringified columns/rows -> decoded.
class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")

class _Base(_Strict):
    title: str = Field(min_length=1, max_length=120)
    from_artifact: str | None = None
    columns: list[Column] | None = None
    rows: list[list[str | float | int | None]] | None = None
    transform: Transform | None = None

    @field_validator("columns", "rows", "transform", mode="before")
    @classmethod
    def _decode_stringified(cls, v):          # BUG-260529-01 precedent
        return json.loads(v) if isinstance(v, str) else v

    # model_validator(mode="after"): exactly one of (from_artifact) / (columns+rows);
    # unique column names (≤ 20); every row len == len(columns); 1..500 rows (refuse >500: "aggregate first");
    # coerce number-column cells (Gemini sends strings); serialized dataset ≤ byte cap.

class ChartSpec(_Base):
    component: Literal["chart"]; chart: ChartEnc; metric: None = None
class TableSpec(_Base):
    component: Literal["table"]; chart: None = None; metric: None = None
class MetricSpec(_Base):
    component: Literal["metric"]; metric: MetricEnc; chart: None = None

ARTIFACT_COMPONENTS = ("chart", "table", "metric")   # parity-fenced against the SQL CHECK and the frontend registry
ShowArtifactArgs = Annotated[Union[ChartSpec, TableSpec, MetricSpec], Field(discriminator="component")]
```

### 3. The one agent_loop hook (persist time)
```python
# agent_loop.py, inside _persist_assistant_message, where completed_tools is built (:1976-1979)
completed_tools = [tc for tc in persisted_tool_calls if tc.get("status") == "done"]
if completed_tools:
    completed_tools = redact_artifact_args(completed_tools)   # Phase 273 (I-4) — pure, returns new dicts
    row["tool_calls"] = _strip_nul(completed_tools)

# artifact_history.py
def redact_artifact_args(tool_calls: list[dict]) -> list[dict]:
    out = []
    for tc in tool_calls:
        if tc.get("name") != "show_artifact" or "rows" not in (tc.get("args") or {}):
            out.append(tc); continue
        rows = tc["args"]["rows"]
        n = len(rows) if isinstance(rows, list) else 0
        art_id = _artifact_id_from_result(tc.get("result"))      # parses {"artifact_id": ...}
        ref = (f"<stored in artifact {art_id}, {n} rows>" if art_id
               else (f"<not stored: refused, {n} rows>" if n else "<not stored>"))
        out.append({**tc, "args": {**tc["args"], "rows": ref}})    # thought_signature carried through untouched
    return out
```

### 4. Handler skeleton
```python
async def handle_show_artifact(args: dict, ctx: ToolContext) -> ToolResult:
    if ctx.parent_run_id is not None or ctx.phase_whitelist is not None:
        return _refused("only available in chat", "show_artifact is not available here.")
    try:
        spec = _ADAPTER.validate_python(args)
    except ValidationError as e:
        return _refused(_people_reason(e), _model_detail(e))      # reason: closed catalogue; detail: loc + fix
    if spec.from_artifact:
        parent = await db_artifacts.get_by_ref(ctx.pool, ref=spec.from_artifact,
                                               thread_id=UUID(ctx.thread_id), user_id=UUID(ctx.current_user["id"]))
        if parent is None:
            return _refused(f"{spec.from_artifact} isn't in this thread", _known_labels_hint(...))
        dataset, lineage = apply_transforms(parent, spec.transform)   # filter → top_n → sort → select; ≥1 row
        caption = inherit_caption(parent, lineage)
    else:
        dataset, caption = spec.dataset(), build_caption(ctx.turn_tool_calls, row_count=len(spec.rows))
    row = await db_artifacts.insert(ctx.pool, ..., org_id=ctx.current_user.get("org_id"), run_id=ctx.run_id,
                                    tool_call_id=ctx.tool_call_id)   # RETURNING *
    await ctx.emit(ctx.redis, ctx.run_id, "artifact", artifact=_jsonable(row))
    return ToolResult(result=_id_first_result(row))    # json.dumps with artifact_id FIRST; assert len < 2000
```

### 5. Migration 202 (draft; mirror of `messages` SELECT predicate, `full-schema.sql:7185`)
```sql
-- 202 — Phase 273 (ART-01..05, I-5): public.message_artifacts. Paste in the SQL editor. Idempotent.
BEGIN;
CREATE TABLE IF NOT EXISTS public.message_artifacts (
    id           text PRIMARY KEY CHECK (id ~ '^a_[0-9a-z]{10}$'),
    thread_id    uuid NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
    user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id       uuid NOT NULL,                       -- same as messages: no FK, autofill trigger
    run_id       uuid REFERENCES public.runs(run_id) ON DELETE SET NULL,
    tool_call_id text,
    parent_id    text REFERENCES public.message_artifacts(id) ON DELETE SET NULL,
    label        text NOT NULL,                       -- "chart 1", assigned at creation (UI-D-03)
    component    text NOT NULL CHECK (component IN ('chart', 'table', 'metric')),   -- I-1 belt
    spec         jsonb NOT NULL,                      -- {columns, rows, encoding, title}
    caption      jsonb NOT NULL,                      -- server-derived segments (D-04)
    row_count    integer NOT NULL CHECK (row_count BETWEEN 1 AND 500),
    spec_version smallint NOT NULL DEFAULT 1,
    created_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT message_artifacts_spec_size CHECK (octet_length(spec::text) <= 262144)
);
CREATE INDEX IF NOT EXISTS idx_message_artifacts_thread ON public.message_artifacts (thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_message_artifacts_org ON public.message_artifacts (org_id);
DROP TRIGGER IF EXISTS message_artifacts_autofill_org_id ON public.message_artifacts;
CREATE TRIGGER message_artifacts_autofill_org_id BEFORE INSERT ON public.message_artifacts
    FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');

ALTER TABLE public.message_artifacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.message_artifacts FROM PUBLIC;          -- PUBLIC first (CLAUDE.md trap)
REVOKE ALL ON TABLE public.message_artifacts FROM anon;
REVOKE ALL ON TABLE public.message_artifacts FROM authenticated;
GRANT SELECT ON TABLE public.message_artifacts TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.message_artifacts TO service_role;   -- no UPDATE anywhere (D-08)

DROP POLICY IF EXISTS "Users can view their own message artifacts" ON public.message_artifacts;
CREATE POLICY "Users can view their own message artifacts" ON public.message_artifacts
    FOR SELECT TO authenticated
    USING (((org_id IN (SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));
-- No INSERT/UPDATE/DELETE policy: written only by the backend pool. Thread delete cascades.
COMMIT;
```
Mirror the four REVOKE/GRANT lines in `scripts/full-schema-supplement.sql` (195 precedent `:504-509`). Optional belt for D-08 against the superuser pool: a `BEFORE UPDATE` trigger that raises.

### 6. Frontend: SSE branch, handler, mapper
```ts
// lib/api/threads.ts — beside the final_output_files branch (:1036); no `return`, so the cursor advances
else if (t === "artifact" && callbacks.onArtifact)
  callbacks.onArtifact(parsed.artifact as unknown)          // validated at render by the guard, not here

// providers/StreamsProvider.tsx — beside onFinalOutputFiles (:1113); dedupe by id (replay-safe)
onArtifact: (raw: unknown) => {
  const id = (raw as { id?: unknown } | null)?.id
  setMessages((prev) => prev.map((m) => m.id !== assistantId ? m : {
    ...m, artifacts: [...(m.artifacts ?? []).filter((a) => a.id !== id), raw as ArtifactRecordWire],
  }))
},

// _mapMessageResponse (:84): destructure `artifacts` so the snake row does not leak through ...rest
artifacts: Array.isArray(artifacts) ? artifacts : undefined,
```

### 7. Closed registry with own-property read
```ts
const REGISTRY = { chart: ChartArtifactLazy, table: TableArtifact, metric: MetricArtifact } as const
export const ARTIFACT_COMPONENTS = Object.keys(REGISTRY) as Array<keyof typeof REGISTRY>   // fenced == backend Literal via ?raw
export function rendererFor(c: unknown) {
  return typeof c === "string" && Object.prototype.hasOwnProperty.call(REGISTRY, c)
    ? REGISTRY[c as keyof typeof REGISTRY] : null                                         // null → ArtifactNotice("unknown-component")
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `ResponsiveContainer` wrapper | chart-level `responsive` prop | recharts 3.x (present in 3.8.1 typings) | Either works; `responsive` uses CSS sizing |
| Chat Completions non-strict tools | Responses API normalizes to strict when `strict` omitted | OpenAI Responses | gpt-5.6 rows may send every key, nulls included — validators must accept |
| Gemini 2.x lenient signatures | Gemini 3 strict signature validation, current turn only | Gemini 3 | Prior-turn arg rewrites are safe; current-turn (Continue) is the edge |

**Deprecated/outdated:** the CONTEXT's note that I-4 needs "Anthropic `thought_signature`" checking — Anthropic has no `thought_signature`; its equivalent is a thinking-block `signature`, and thinking is OFF here, so nothing to preserve.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | No OpenAI-compat vendor (DeepSeek, GLM, MiniMax, Moonshot, OpenRouter) validates prior-turn tool-call arguments against anything | I-4 matrix | A 400 on a later turn for that provider; the board's follow-up row would catch it |
| A2 | Gemini does not check function-call arg integrity against `thought_signature` inside the current turn (Continue edge) | I-4 matrix | A Continue across a paused `show_artifact` 400s on Gemini; fallback = dummy signature |
| A3 | The Gemini API (server side) accepts array-of-array parameter schemas (client SDK constructs them — verified) | Pattern 1 | Gemini row fails at request time; fallback = rows as `array<string>` of delimited lines (worse) |
| A4 | ~12 distinct values per string column in the result is enough for later-turn filters | Pattern 3 | "only Q3" fails on a later turn when the id survived but values did not; model can still ask |
| A5 | 256 KiB per-artifact byte cap is comfortably above 500 rows × ≤20 columns of real data | Migration | Rare legitimate refusal; tune the constant |
| A6 | The structured-mode leak (Pitfall 2) reproduces live on OpenRouter | Pitfall 2 | If the frontend already hides it somewhere unmeasured, the fix is unnecessary |

## Open Questions (RESOLVED)

All five were resolved before execution (2026-10-03, plan-check revision). Each resolution is recorded inline as **RESOLVED** and is the authority the plans cite as "RESEARCH OQn (RESOLVED)".

1. **Structured-mode text leak (Pitfall 2).**
   - Known: the code path streams the JSON and never folds it (measured lines).
   - Unclear: whether it reproduces live, and whether a fold that contains the tool-call text satisfies SC#2.
   - Recommendation: drive the OpenRouter row first in Plan 04; if confirmed, a one-line structured-branch `turn_boundary` emit, and record the operator's ruling on the fold content. Otherwise record the row ⛔ with the reason.
   - **RESOLVED:** a STRUCTURED-path delta holdback (`StructuredTextHoldback`, 273-04 Task 2) — the tool-call block (a ```` ```json ```` fence or an inline `{"tool": …}`) is never emitted as a `delta`; the streamed preamble folds via `turn_boundary`; a block that does not parse as a tool call is flushed as ordinary text; NATIVE paths stay byte-identical. The operator ruling is recorded as **OV-273-04** in STATE.md, which is also the authority for the agent_loop.py holdback hunks beyond D-15. Live check: the OpenRouter board row in 273-06.
2. **Artifact-only answers vs the empty-answer fallback (Pitfall 7).**
   - Recommendation: tool-result instruction only; measure on the board; escalate to an agent_loop change only if a provider still ends silently.
   - **RESOLVED:** the success tool result's `note` instructs the model to write one or two sentences after the call (273-03); the board records, per row, whether the final content is empty or the "never wrote an answer" fallback (273-06, observation only). The "never wrote an answer" fallback in agent_loop.py is UNCHANGED in this phase.
3. **Chat rail label home (Pitfall 8 knock-on).** `lib/toolNames.ts` (UI-SPEC) vs `lib/toolMeta.ts`. Recommendation: `toolNames.ts` + amend the harness fixture to `OFFERED ∪ CHAT_ONLY` with a comment naming this phase, so the coverage fence keeps meaning "every id a person can see is named".
   - **RESOLVED:** the phrase `Show an artifact` lives in `lib/toolNames.ts` (the activity string `Showing an artifact` in `lib/toolMeta.ts`); `components/workflows/toolNames.test.ts` asserts the TOOL_PHRASES key set == OFFERED ∪ CHAT_ONLY, where CHAT_ONLY is parsed from the backend's `CHAT_ONLY_TOOLS` via `?raw` (never hand-typed) and OFFERED stays 28 (273-05 Task 2).
4. **Number leniency.** Recommendation: accept plain numeric strings and `,` thousands separators only; refuse currency/percent strings with a fix-it detail.
   - **RESOLVED:** as recommended — plain numeric strings and `,` thousands separators only; `$120`, `12%`, `12 kg`, `1.2.3` and booleans are refused with a detail naming the column and row (273-01 Task 1).
5. **Metric caption with one row.** UI-SPEC has a "metric with no attached rows" caption arm; with the uniform dataset every metric has ≥1 row. Recommendation: omit the row-count segment when `component == "metric"`.
   - **RESOLVED:** the metric caption omits the row-count segment (273-02 captionModel).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Local Postgres (Supabase) | migration 202, handler | ✓ port 54322 listening | — | — |
| Redis | SSE run buffer | ✓ port 6379 | — | — |
| Backend uvicorn | board, G-4 | ✓ `GET /health` 200 | — | operator starts it (memory) |
| Vite dev server | G-4 | ✓ `localhost:5173` 200 (IPv6) | — | — |
| Docker CLI in this shell | sandbox for D-20 PNG | ✗ denied to the agent shell (memory) | — | operator-run; D-20 needs `SANDBOX_ENABLED` true (not read — `.env` access denied) |
| Provider keys (8 rows) | SC#10 board | unknown until the board's key probe runs | — | blocked rows recorded ⛔ with reason |
| ctx7 CLI | docs lookup | ✗ | — | installed typings + official docs used instead |

**Missing dependencies with no fallback:** none blocking planning.
**Missing with fallback:** sandbox state for G4-4 — confirm with the operator before Plan 04.

## Hot-File Ledger and Gates (measured at HEAD)

| File | Triple now (commits/phases/lines) | Ledger row? | Note |
|---|---|---|---|
| `backend/app/services/tool_dispatcher.py` | 95 / 41 / 5045 | yes (FIRES) | 1 registry line + 1 ToolContext field + 1 exclusion token; OV-273-02 |
| `backend/app/services/agent_loop.py` | 59 / 29 / 3608 | yes (FIRES) | 2 kwargs + 1 hook (+1 if Pitfall 2 fix lands); OV-273-03 |
| `backend/app/services/openai_service.py` | 77 / 38 / 2442 | yes (FIRES) | schema + 1 get_tools line + constant |
| `backend/app/api/threads.py` | 263 / 88 / 2453 | yes (FIRES) | 2 attach calls in READ routes; 0 send-path branches |
| `backend/app/models/message.py` | 21 / 13 / 278 | yes | +1 optional field |
| `backend/app/services/harness/grounding.py` | 21 / 8 / 1414 | yes (FIRES) | 1-line subtraction |
| `frontend/src/providers/StreamsProvider.tsx` | 105 / 39 / 4966 | yes (FIRES) | ONE handler |
| `frontend/src/components/chat/MessageItem.tsx` | 77 / 35 / 1027 | yes (FIRES) | ONE mount |
| `frontend/src/types/index.ts` | 95 / 74 / 1520 | yes | additive types |
| `frontend/src/lib/api/threads.ts` | 18 / 10 / 1952 | yes | 1 SSE branch + mapper field |
| `frontend/src/components/chat/ToolCallPanel.tsx` | 54 / 22 / 407 | yes (discharged 227-02) | `hideBody` arm |
| `frontend/src/lib/toolMeta.ts` | 11 / 7 / 352 | yes (FIRES) | activity string |
| `frontend/src/index.css` | 30 / 15 / 1089 | yes | `--chart-1..4` |
| `frontend/src/components/chat/ToolCallDetails.tsx` | 2 / 1 / 171 | **NO** (gate: `[no-row]`) | add row in the editing commit |
| `frontend/src/components/chat/StepRow.tsx` | 2 / 1 / 249 | **NO** | add row |
| `frontend/src/components/chat/tool-bodies/index.ts` | 1 / 1 / 59 | **NO** | add row |
| `frontend/src/lib/toolNames.ts` | 2 / 1 / 128 | **NO** | add row (if edited) |
| every NEW file | — | add AT CREATION (D-14) | backend 4 modules, migration is exempt, frontend `artifacts/*`, `ShowArtifactBody.tsx` |

Command: `node scripts/check-hot-file-ledger.cjs 273` (exit 0 required) after plans list `files_modified`. Seeds sweep: `node scripts/check-seeds-register.cjs --phase 273` (could not run at discuss; run at planning).

## Validation Architecture

> `workflow.nyquist_validation` is `false` in `.planning/config.json`; this section is included because the orchestrator requested it. `tdd_mode` is `true` (RED first).

### Test Framework
| Property | Value |
|----------|-------|
| Backend framework | pytest (venv), `backend/tests/unit` |
| Frontend framework | vitest 4.1 + jsdom + Testing Library (`frontend/vitest.config.ts`, `src/setupTests.ts`) |
| Quick run (backend) | `cd backend && python -m pytest tests/unit/test_273_*.py -q -p no:cacheprovider` |
| Quick run (frontend) | `cd frontend && npx vitest run src/components/chat/artifacts src/components/chat/tool-bodies/ShowArtifactBody.test.tsx` |
| Full backend gate | `cd backend && node ../scripts/check-backend-unit-baseline.cjs` (≤ 71 failed, SET-diff vs 272-BASELINES) |
| Full frontend gate | repo root: `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` (new suites into BOTH `TARGETS` and `BASELINE`; `src/components/chat` is file-level, not a directory entry) |
| Typecheck | `cd frontend && npx tsc -p tsconfig.app.json --noEmit` — SET-diff against base (base is non-zero) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ART-01 | schema converts for Gemini (no list-typed `type` residue) and Anthropic; dual wiring (registry + get_tools); not in explorer; in `_SUB_AGENT_EXCLUDED`; not in grounding offer set; SYSTEM_PROMPT unchanged; description carries D-11 guidance | unit | `pytest tests/unit/test_273_tool_wiring.py -q` | ❌ Wave 0 |
| ART-01/02/04 | union accepts 3 components; rejects `pie`, extra props, `props` bag, >500 rows ("aggregate first"), series > 4 (scatter > 3), ragged rows, missing columns; coerces Gemini string numbers; accepts null-filled and stringified calls | unit | `pytest tests/unit/test_273_artifact_models.py -q` | ❌ Wave 0 |
| ART-01/03 | handler: valid → 1 insert + 1 `artifact` emit carrying the RETURNING row + id-first result < 2000; refusal → 0 insert, 0 emit, structured marker; from_artifact → transforms, lineage, parent series order kept, zero retrieval; cross-thread/cross-user ref refused; label alias; harness/sub-agent ctx refused; caption from `turn_tool_calls` (query_tables doc+page; none → "Values provided by the agent") | unit (fake pool/emit) | `pytest tests/unit/test_273_show_artifact_tool.py -q` | ❌ Wave 0 |
| ART-03/05 (I-3/I-4) | redaction: stored → reference, refused → not-stored reference, other tools untouched, input not mutated, `thought_signature` preserved; `_reconstruct_history` over redacted rows → id at result start; the rebuilt message converts through `_convert_messages_to_google`, `_convert_messages_to_anthropic`, `_to_responses_input` | unit | `pytest tests/unit/test_273_artifact_history.py -q` | ❌ Wave 0 |
| ART-05 (reload) | attach maps by artifact id (not tool_call_id; a `call_0` collision fixture), one batched select, order = call order, missing row → `missing: true`; `MessageResponse` accepts `artifacts` | unit | `pytest tests/unit/test_273_reload_attach.py -q` | ❌ Wave 0 |
| ART-02 (I-1/I-5) | migration text: RLS on, policy predicate == messages SELECT predicate, PUBLIC/anon/authenticated revoked, SELECT-only grant, no UPDATE, component CHECK set == Python `ARTIFACT_COMPONENTS`, supplement mirror | unit (text) | `pytest tests/unit/test_273_migration_202_shape.py -q` | ❌ Wave 0 |
| ART-02 (applied) | as `anon`: 0 rows/denied; as `authenticated` other user: 0 rows; UPDATE denied | manual SQL after paste (266-01 Task 3 precedent) | SQL in SUMMARY | manual |
| closed core | registry 30; get_tools base 26 / all 29 | unit (existing, edited) | `pytest tests/unit/test_085_tool_registration.py tests/unit/test_259_closed_core_inventory.py tests/unit/test_261_closed_core_inventory.py tests/unit/test_267_handoff.py tests/unit/test_267_tool_floor_union.py tests/unit/test_272_search_tool_move.py tests/unit/test_tool_dispatcher.py tests/unit/test_255_extension_contract_guard.py -q` | ✅ edit |
| neighbours | Google tool conversion, grounding fidelity, whitelist guards, explorer list | unit (existing) | `pytest tests/unit/test_075_5_google_native.py tests/unit/test_103_grounding_fidelity.py tests/unit/test_115_tool_wiring.py tests/unit/test_116_tool_wiring.py tests/unit/test_151_registration.py -q` | ✅ run |
| ART-02 (frontend) | guard: 3 components fenced == backend Literal (`?raw` of `backend/app/models/artifact.py`); every failure maps to a catalogue reason; page text never contains `{"` or spec keys | unit | `npx vitest run src/components/chat/artifacts/__tests__/artifactSpec.test.ts` | ❌ Wave 0 |
| ART-01/04 | ArtifactBlock: card per record in order; unknown component / malformed → notice; boundary → `render-failed`; Table sort `aria-sort` cycle, numeric sort, empty last; Metric delta glyph/percent/zero comparison; chartModel slots by full-series index, hidden never repaints, stacked Total row | component + unit | `npx vitest run src/components/chat/artifacts` | ❌ Wave 0 |
| SC#2 (rail) | `ShowArtifactBody` essence strings; refused arm reads `reason` not `detail`; ToolArgsBlock not rendered; live args panel `hideBody` | component | `npx vitest run src/components/chat/tool-bodies/ShowArtifactBody.test.tsx src/components/chat/__tests__/ToolCallPanel.showArtifact.test.tsx` | ❌ Wave 0 |
| I-2 | `threads.ts` parses `artifact`; `_mapMessageResponse` maps `artifacts`; StreamsProvider appends + dedupes; MessageItem renders identical DOM for a live and a reloaded message holding the same record; mount sits after content, before FinalOutputsPanel | unit + component | `npx vitest run src/lib/api/__tests__/threads.artifact.test.ts src/components/chat/__tests__/MessageItem.artifacts.test.tsx` | ❌ Wave 0 |
| D-17..D-20 | G4-1..G4-4 lived drives, asserting rendered CONTENT (tooltip values == source numbers; captions byte-identical across reload + backend restart; notice only; PNG vs artifact) | manual (Chrome MCP) | evidence under `.planning/phases/273-agent-authored-artifacts/evidence/` | manual |
| D-21 | 8-row board: valid call, rendered (guard passes on the persisted spec + one reload screenshot per row), by-reference follow-up with zero retrieval/code calls; OpenRouter structured-leak probe; Gemini Continue probe | script + manual | `backend/venv/Scripts/python.exe scripts/run-273-board.py --run` (new; reuse `sc10_188_run_board.derive_roster`) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the quick-run command for the files touched (targeted suites only, G-8).
- **Per wave merge:** full backend gate + full vitest count gate + tsc set-diff + `check-hot-file-ledger.cjs 273`.
- **Phase gate:** all of the above green, board recorded, G-4 evidence captured, before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `backend/tests/unit/test_273_artifact_models.py`
- [ ] `backend/tests/unit/test_273_show_artifact_tool.py`
- [ ] `backend/tests/unit/test_273_artifact_history.py`
- [ ] `backend/tests/unit/test_273_reload_attach.py`
- [ ] `backend/tests/unit/test_273_migration_202_shape.py`
- [ ] `backend/tests/unit/test_273_tool_wiring.py`
- [ ] `frontend/src/components/chat/artifacts/__tests__/*` (spec guard, block, table, metric, chartModel, chart legend)
- [ ] `frontend/src/components/chat/tool-bodies/ShowArtifactBody.test.tsx`, `ToolCallPanel.showArtifact.test.tsx`, `threads.artifact.test.ts`, `MessageItem.artifacts.test.tsx`
- [ ] `scripts/run-273-board.py`
- [ ] Count-gate knobs: every new frontend suite in `TARGETS` and pinned in `BASELINE`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (rides existing JWT) | — |
| V3 Session Management | no | — |
| V4 Access Control | **yes** | RLS SELECT policy mirroring `messages`; pool queries bind `thread_id` + `user_id`; same-thread references only; no client write grants |
| V5 Input Validation | **yes** | Pydantic union `extra="forbid"`, caps (500 rows, ≤20 columns, ≤4/3 series, string length, byte cap), DB CHECKs (component set, row_count, size, id pattern) |
| V6 Cryptography | no | — |
| V7 Error handling/logging | yes | people-safe `reason` vs model-facing `detail`; never render exception text (UI catalogue) |
| V14 Configuration | yes | REVOKE from PUBLIC first; `get_advisors(security)` at deploy parity |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt-injected `from_artifact` pointing at another user's/thread's id | Information disclosure | Lookup predicate `id AND thread_id AND user_id` (pool bypasses RLS) |
| Untrusted cell/title text (from retrieved documents) rendered as markup | Tampering / XSS | React text nodes only; never `MarkdownRenderer`/`dangerouslySetInnerHTML`; truncate in captions |
| Open props reopening the vocabulary | Tampering | `extra="forbid"` + closed Literals + DB CHECK + frontend own-property registry |
| Huge specs (row/byte flood) via SSE, DB, history | DoS | 500-row + byte caps (refuse, never truncate); history redaction; DB size CHECK |
| Default grants to `anon`/`PUBLIC` on a new table | Information disclosure | REVOKE ALL FROM PUBLIC/anon/authenticated, GRANT SELECT authenticated (BUG-260911-01 lesson) |
| Model-altered numbers presented as sourced | Repudiation | Server-derived caption; "Values provided by the agent" when no data tool ran |
| Artifact mutated after the fact | Tampering | No UPDATE grant/policy; optional BEFORE UPDATE raise trigger |

## Recommended Plan Grouping (G-8: 4 plans)

| Plan | Wave | Scope | Parallel? |
|---|---|---|---|
| 273-01 Backend | 1 | models, migration 202 (+operator paste checkpoint, regen full-schema, supplement), db module, handler module, history module (redact + attach), wiring (registry, ToolContext field, get_tools + constant, grounding subtraction, sub-agent exclusion, 2 kwargs + 1 hook in agent_loop, 2 attach calls in threads.py, MessageResponse field), every count-pin edit | starts first; mutates local DB → serialize with any DB-mutating plan |
| 273-02 Frontend components | 1 | `components/chat/artifacts/*` new files only + `--chart-*` vars, built against a fixed wire-contract fixture (the RETURNING row shape) | worktree, parallel with 01 |
| 273-03 Frontend wiring + rail | 2 | types, threads.ts SSE + mapper, StreamsProvider handler, MessageItem mount, rail arms L-1..L-4 + `refused` node, tool-bodies registration, toolNames/toolMeta, ledger rows, count-gate knobs | after 01 + 02 |
| 273-04 Board + G-4 | 3 | `run-273-board.py`, 8-row board (incl. OpenRouter structured-leak and Gemini Continue probes), Chrome MCP G4-1..G4-4, Pitfall 2/7 rulings | after 03 |

The wire contract that lets 02 run in parallel: the `artifact` SSE payload and `MessageResponse.artifacts[]` items are the same object — the `message_artifacts` row as returned by PostgREST/asyncpg (`id, label, component, spec{title, columns, rows, chart|metric}, caption{segments…}, row_count, parent_id, created_at, spec_version`). Plan 01 must freeze it in a fixture both sides import or copy.

## Sources

### Primary (HIGH confidence)
- Codebase at HEAD `ccd9372f3` — every `file:line` cited above (agent_loop, tool_dispatcher, openai_service, google_service, anthropic_service, provider_gateway/anthropic.py, openai_responses.py, threads.py, models/message.py, full-schema.sql, migration 195, frontend files listed)
- Local prototype runs (pydantic 2.12.5, google-genai 2.6.0 through `_convert_tools_to_google`) — scratchpad `proto_273.py`
- Installed recharts 3.8.1 typings (`node_modules/recharts/types/...`)
- https://ai.google.dev/gemini-api/docs/generate-content/thought-signatures — current-turn-only validation, current-turn definition, dummy signatures
- https://developers.openai.com/api/docs/guides/function-calling — Responses normalizes to strict when `strict` omitted; Chat Completions non-strict by default; strict requirements

### Secondary (MEDIUM confidence)
- `273-UI-SPEC.md` (approved design contract) and `.claude/skills/sketch-findings-agentic-rag/references/agent-authored-artifacts.md`
- `.planning/phases/272-close-means-wrong/272-BASELINES.md` (71-failure SET)

### Tertiary (LOW confidence)
- WebSearch result summaries on Gemini signature behaviour (used only to locate the official page above)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions measured from the installed tree; no new packages.
- Architecture: HIGH — every seam measured; persistence choice argued from measured schema facts (realtime publication, UPDATE policy, failing db_runs tests).
- Provider safety (I-4): HIGH for prior turns (official Google doc + code); MEDIUM for the Gemini Continue edge (undocumented arg-integrity behaviour).
- Pitfalls: HIGH for code-path pitfalls; MEDIUM for the structured-mode leak until driven live.

**Research date:** 2026-10-03
**Valid until:** 2026-10-17 (fast-moving: provider schema handling, and these hot files change every phase — re-derive triples at plan time)
