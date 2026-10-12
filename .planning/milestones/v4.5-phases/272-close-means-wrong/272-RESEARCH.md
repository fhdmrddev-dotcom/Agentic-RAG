# Phase 272: Close Means Wrong - Research

**Researched:** 2026-10-03
**Domain:** Structured retrieval filters for the chat agent (pgvector hybrid search, shared view-filter compiler, cross-provider tool schemas)
**Confidence:** HIGH for codebase facts (all measured at HEAD `3ed034acc`); MEDIUM for pgvector exact-scan performance (documented mechanism, threshold still to be measured); MEDIUM for per-provider emission (proven for the schema shape at Phase 115, unproven for the nested *filter* argument on 7 of 8 rows).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Who decides close-means-wrong (SEED-153 open question 2: ANSWERED)
- **D-01:** **The model decides, over a closed field list.** Whenever a question names a value of any
  field the org has, the agent must filter on it. There is **no** admin "must filter" flag, so no
  migration and no Settings control for it. Whether each provider actually emits the filter is what
  the SC#10 board measures (D-17).
- **D-02:** **The vocabulary is built per request.** The `search_documents` tool description is
  generated per request from the org's **enabled** `metadata_field_definitions`, giving key, type
  and the allowed values for `enum` fields, plus the built-ins and the Phase 270 source facts. The
  current guidance is **removed**: *"call without the filter first, don't guess values"* at
  `openai_service.py:23-47` and *"only add metadata_filter when the user explicitly asks"* at
  `agent_loop.py:703`. Both point the opposite way to this phase.
- **D-03:** **The argument shape is Find's condition list.** Add a `filters` argument, a list of
  `{field, op, value}` using the **same operator vocabulary and the same compiler** as Phase 271
  Find (`ViewCondition.op`; `document_view_resolver.validate_and_compile`). The existing
  `metadata_filter` keeps working by being **mapped onto `eq` conditions**: one compiler, never a
  second dialect. ⚠ Google strips `additionalProperties` at its boundary
  (`google_service.py:243-250`), so the schema must survive that strip. Research confirms the
  per-provider emission of a nested array-of-objects argument (provider-docs-first).
- **D-04:** **An unknown field or value is refused, with the valid ones listed.** A field outside
  the whitelist, or an enum value not in its options, gets a tool error naming the allowed values,
  so the agent can retry with a real one. This keeps *"you misspelled the entity"* separate from
  *"no such documents exist"*.

#### Which date "October" means
- **D-05:** **The default date is the document's own date** (`metadata.date` → the typed column
  `date_typed`, migration 074). The agent filters on `source_created` / `source_modified` (Phase 270,
  migration 199) or `added` (`created_at`) **only when the user says so** ("uploaded in October").
  A report period kept in a custom field (e.g. `fiscal_period`) is filtered as a **dimension**
  through D-03. ⛔ The `freshness` validator kind is **not** this (SEED-153) and must not absorb it.
- **D-06:** **Undated documents are excluded and counted.** Under a date filter, an in-scope document
  with no value for that date is excluded, and the result says how many were excluded
  (*"12 documents have no document date and could not be checked"*).
- **D-07:** **Today's date goes into the system prompt.** No current date reaches the agent today
  (measured: nothing in `agent_loop.py`). For "October" with no year, the agent resolves to the
  **most recent completed** October and **states the resolved range** in its answer
  (*"October 2025, 1–31 Oct"*).
- **D-08:** **The applied filter is shown on the search tool card** as one plain, **visible** text
  line, e.g. *"Filtered: document date 1–31 Oct 2025 · legal entity = Acme GmbH"*. ⛔ It must not be
  tooltip-only (OV-266-01: a note that lived only in a tooltip was invisible). **G-2 skip is
  recorded as a decision:** it is one text line on a shipped surface, with no new component. A G-4
  scenario covers it (see `<specifics>`).

#### How strict the empty result is (SC#2)
- **D-09:** **Structural retry lock.** Within one turn, once a filtered search has matched **zero
  documents**, the dispatcher **refuses** any later `search_documents` call that **drops that
  filter's field**, and the refusal says why. A *different value on the same field* (September
  instead of October) is allowed. A prompt rule alone is the "instruction, not filter" shape that
  SEED-153 forbids. The prompt still states the rule, but the lock is what enforces it.
- **D-10:** **Inside a matched set, return the best passages.** When documents match the filter but
  no passage clears the similarity threshold, the threshold is **relaxed inside the filter set** and
  the top passages are returned, **marked as low-similarity**. The filter already guarantees scope,
  and SC#3 forbids a false "nothing".
- **D-11:** **The empty reply names the filter and may offer nearby values.** For example: *"No
  documents matched October 2025. Reports exist for September and November — use one?"* The nearby
  values come from a **document-level count**, never from cited content. **Nothing outside the
  filter is cited.**
- **D-12:** **The tool has four distinct result kinds:** (1) passages found; (2) the filter matched
  **0 documents**, with the D-06 undated count; (3) the filter is **invalid** (D-04, valid values
  listed); (4) retrieval unavailable (**existing**, `tool_dispatcher.py:857-875`). Today kinds 1-3
  collapse into *"No relevant documents found."* (`tool_dispatcher.py:897`), which is the failure
  SC#2 names. The `search.query` audit row records **the filter as applied and which kind fired**.
  Today `metadata_filter` is **not** recorded (keys are `query_text, document_ids, similarities,
  run_id, thread_id, parent_run_id, folder_ids`), and SC#1 needs the audit row to show the filter.

#### Refactor scope (G-5) and recall
- **D-13:** **`retrieval_service.py`: the extraction goes FIRST** (locked by the ROADMAP; owed since
  231, and this is the third landing). Plan 1 is a pure move **plus** a filter seam that accepts a
  **default predicate**, so Phase 275's archived exclusion rides it as **data**, never as a new
  branch. The predicates the RPCs already hardcode (`is_latest = true`, org/visibility,
  `source_state != 'source_disconnected'`) are the shape that seam must express.
- **D-14:** **Recall uses an exact scan for small filtered sets** (SC#3 / SEED-273). A filtered
  search **first resolves the filter to a document set** through the shared 271 compiler. That one
  step gives the honest D-12 count, Find's vocabulary and the recall fix. Below a chunk-count
  threshold, that set is searched **exactly** (no HNSW index, so no cliff). Above it, the index runs
  with `hnsw.iterative_scan` on. **The global knobs for unfiltered search are unchanged.** It is
  proven by re-measuring `recall_bench` with `EXPLAIN (ANALYZE, BUFFERS)` at **every** point, per
  SEED-273's checklist. The threshold value is a measured number, not a guess (Claude's discretion
  after measurement). Passing a document set into the chunk RPCs likely needs a migration at the
  **next free number (`200`)**, applied via the SQL editor, then `full-schema.sql` regenerated and
  `get_advisors(security)` run.
- **D-15:** **`tool_dispatcher.py` gets a narrow cut.** The `search_documents` handler, its audit
  write and the D-09 retry lock move into **their own module**, and the dispatcher keeps a one-line
  registry entry. The full registry/handler split **stays OWED and is flagged for Phase 273**, which
  lands on this file next. The new module gets its ledger row **at creation**.
- **D-16:** **`agent_loop.py` is honoured by construction.** About 10 lines: today's date (D-07) and
  the rewritten filter guidance (D-02) go inside the existing `SYSTEM_PROMPT`. The prompt-assembly
  seam **stays OWED and moves to Phase 273**.
- **D-17:** **SC#10 board: 3 prompts per provider, 8 rows.** The rows are derived from
  `MODEL_CAPABILITIES` (newest registry-backed model per provider, plus OpenRouter). The prompts:
  (a) *October revenue*: the filter argument is emitted and every citation falls inside October;
  (b) a named entity dimension; (c) a period with no documents: says so, cites nothing, makes no
  unfiltered retry. ⛔ **A correct answer without the filter argument FAILS the row.** Blocked rows
  are recorded with their reason, never omitted. Cheapest honest method: per-request
  `model`/`provider` on `POST /threads/{id}/messages`, verdicts read from `audit_log`
  `search.query` rows (D-12).

#### Binding invariants (from the scout; research must keep them)
- **D-18:** ⛔ **An empty resolved document set must never mean "no restriction."** Phase 266 CR-01
  shipped exactly that inversion (an empty restricted scope meant *search everything*). An empty
  set from D-14 must short-circuit to result kind (2) **before** any RPC is called, and a test
  proves it.
- **D-19:** **The filter ANDs with the existing scopes.** It narrows the chat folder scope
  (`ctx.folder_subtree_ids`) and any Expert-restricted scope, and never replaces either. Both arms
  receive the same restriction (the failure named in the roadmap is a filter that reaches one arm
  and not the other).
- **D-20:** **Value matching must actually match stored data.** Today Python lowercases filter
  values (`retrieval_service.py:392-394`) while stored values are **not** lowercased (apart from
  `document_type`), so a mixed-case `author` can never match. The compiler path must compare
  consistently. Research picks the mechanism.

### Claude's Discretion
- The exact module boundaries of the D-13 extraction, and the name and home of the D-15 handler
  module.
- Whether D-14's document-set restriction is a new RPC parameter (e.g. `p_document_ids uuid[]`) or a
  new RPC, plus the exact-scan threshold value (from measurement).
- How the D-09 lock carries per-turn state (run context vs. dispatcher context), provided it is
  per-turn and per-field.
- The wording of the D-08 card line and the D-11 reply, within the constraints above.
- Plan count: target **3-5** (G-8). Suggested waves: (1) the extraction plus the seam; (2) filter
  resolution, schema and RPC/migration; (3) handler module, result kinds, lock, audit, prompt and
  date; (4) tool-card line; (5) recall measurement, SC#10 board and G-4 drive. Merge where adjacent.

### Deferred Ideas (OUT OF SCOPE)
- **SEED-153 workflow-input → retrieval-filter binding:** a launch-form input bound to a phase's filter. Not in FIND-07 (roadmap). The seed stays `partial: true`.
- **SEED-153 publish-gauntlet gate:** a workflow that reads a period without binding it to a filter is unpublishable. Not in FIND-07. Trigger: the next phase on the harness/publish gauntlet or recurring-report workflows.
- **SEED-153 citation post-gate:** asserting every cited source falls inside the window. In chat this holds **by construction** (only filtered passages can be cited). A separate post-gate belongs with the workflow binding above.
- **Admin "must filter" field flag:** rejected for now (D-01). Revisit if the SC#10 board shows a provider that will not emit filters reliably.
- **`tool_dispatcher.py` full registry/handler split and the `agent_loop.py` prompt-assembly seam:** both still OWED, flagged for **Phase 273** (D-15/D-16).
- **Enabling `hnsw.iterative_scan` globally for unfiltered search:** not this phase (D-14 changes filtered search only).
- Reviewed Todos (not folded): `spike-nl-workflow-authoring.md`. Out of scope.
- Reviewed reported bugs: no open `surface: Agentic-RAG` report overlaps chat retrieval (swept 2026-10-03).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FIND-07 | The agent can pass date and dimension filters into retrieval, so "October revenue" cannot return March. | §Architecture Patterns 1-6 (schema, filter→document-set resolver under RLS, RPC `p_document_ids` + exact branch, result kinds, retry lock, audit); §Common Pitfalls 1-14; §Validation Architecture (SC#1-4 test map, SC#10 board, G-4 drive). |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

| Directive | How it binds this phase |
|---|---|
| Raw SDK only; no LangChain/LangGraph | No new retrieval framework. The filter seam is plain Python + SQL. |
| Pydantic for structured LLM outputs | The `filters` tool argument is parsed by a Pydantic model before it reaches the compiler. |
| All tables need RLS | No new table. The document-set resolution must be **RLS-decided** (see Pattern 2). The RPCs stay `SECURITY DEFINER` with their in-body org/visibility gate. |
| Migrations: numbered SQL in `supabase/migrations/`, pasted into the SQL editor; never `supabase db push`/`db reset`; then `bash scripts/regenerate-full-schema.sh` (no `--reset`) | Migration **`200_*.sql`** (next free; `199_document_file_facts.sql` is the latest, measured). |
| Postgres functions are `EXECUTE`-granted to **PUBLIC** by default; `REVOKE … FROM anon` alone is a no-op | Every created/re-created RPC: `REVOKE EXECUTE … FROM PUBLIC; REVOKE … FROM anon; GRANT … TO authenticated, service_role` (the migration 181 pattern), then `get_advisors(security)`. |
| No blocking I/O in async handlers (`run_in_threadpool` / `aexec`) | Every supabase-py call rides `aexec`; asyncpg is native async. |
| Provider-docs-first for tool use | §Provider tool-argument emission below; per-provider behaviour is measured by the SC#10 board, not assumed. |
| A model's capabilities are DATA | The 8-row roster comes from the **effective** registry (`model_registry.py` over `MODEL_CAPABILITIES`), not from the config seed alone. |
| Extension Contract: tools are a closed core | Widen `search_documents`; tool count stays **29** (`_TOOL_REGISTRY`, pinned by `test_259`/`test_261`); `get_tools()` count pinned by `test_085`. |
| Settings in `user_settings`/`app_settings`; env vars for secrets/infra only | The exact-scan threshold and the filtered `iterative_scan` value should be **module constants** (the `hnsw_max_scan_tuples` precedent: hardcoded, no UI). A new env var would also trigger the deploy-artifact parity rule (`scripts/check-deploy-drift.sh`). |
| Backend unit baseline gate: `pytest tests/unit -q --continue-on-collection-errors` (or `node scripts/check-backend-unit-baseline.cjs`), ceiling **71 failed / 3497 passed / 2 xfailed / 2 xpassed**, zero headroom | Any newly-red unit test breaks the gate. **`tests/unit/test_246_hnsw_server_probe.py::test_retrieval_service_is_byte_unchanged` WILL go red** the moment Plan 1 edits `retrieval_service.py` and must be retired deliberately (Pitfall 3). |
| Vitest count gate: `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` from the repo root; no per-file decrease, 0 failing | `src/lib/__tests__/toolMeta.test.ts` is in **neither** knob (measured). A D-08 formatter tested there must be adopted into **both** `TARGETS` and `BASELINE`. |
| Frontend typecheck: `npx tsc -p tsconfig.app.json --noEmit`, measured as a **set diff** against base (67 errors at a prior base) | `npx tsc --noEmit` checks zero files and is vacuous. |
| G-5 ledger gate: `node scripts/check-hot-file-ledger.cjs <phase>` | 7 candidate files have **no scan-list row** (measured; see §Hot-file ledger). |
| G-8 plan count 3-5 | Recommended breakdown: **5 plans in 4 waves**. |
| Worktrees enabled; serialize plans whose tests mutate the local DB (rule 4) | The migration/resolver plan mutates local Postgres and must not run concurrently with another DB-mutating plan. |
| CLAUDE.md 150k-char gate, warn band 120k | **Measured 119,524 chars, 476 below the warn band.** Do **not** add ledger rows to CLAUDE.md's abridged G-5 table in this phase. Add them to `docs/HOT-FILE-LEDGER.md` § "Scan list" (the table the gate reads) plus the file's section, in the same commit. |
| Supabase MCP: reads free, writes need per-action operator approval | Applying migration 200 to production is an approval-gated write. `get_advisors(security)` is a free read. |

## Summary

All of the pieces exist. What is missing is the wiring between them, plus one index. The 271 compiler (`validate_and_compile` + `apply_fragments`) already turns a `{field, op, value}` list into bound PostgREST builder calls on `documents`. The chunk RPCs (`match_document_chunks`, `keyword_search_chunks`, latest bodies in migration 170) already carry the org/visibility/`is_latest`/`source_state` predicates. pgvector 0.8.0 on PG 17.6 (measured locally) supports `hnsw.iterative_scan`, and `retrieval_tuning.apply_hnsw_session_knobs` already applies it safely per transaction. A filtered search becomes: resolve the conditions to a document-id set, intersect it with what the caller can see, then hand both arms `p_document_ids`. The vector arm searches that set **exactly** (an `ORDER BY` *expression*, which pgvector documents as the way to keep the HNSW index out) when the set's chunk count is under a measured threshold, and through the index with `iterative_scan` above it.

Four measured facts reshape the obvious plan. **(1)** The chat run's `ctx.supabase` is a **service-role (BYPASSRLS) client** (`threads.py` hands `service_supabase` to `run_producer`). Running the compiler on it would count other tenants' documents. The resolver must therefore intersect its candidate ids under the asyncpg uid-synthesized user context (`get_user_pg_connection(None, {"id": uid})`), where the `documents` SELECT RLS policy is **identical** to the RPCs' visibility predicate (migration 154). **(2)** `document_chunks` has **no btree index on `document_id`**, in either the dev DB or `recall_bench`. Without one, the exact path is the same ~1.1 s sequential scan SEED-273 measured, so migration 200 must add it. **(3)** The chat tool-result string is truncated to 2000 chars on emit and persist (`agent_loop.py:3098,3146`), while `args` are persisted whole. The D-08 line should therefore be derived from the call's **args** on the client, not parsed from the result. **(4)** Moving the search handler out of `tool_dispatcher.py` silently breaks **8 test files** that patch `td.search_documents` / `td.write_audit_entry`, and the extraction trips two fences (`test_246` byte-unchanged, `test_241` landing cap/G-5 sentence) that must be retired or retargeted deliberately.

**Primary recommendation:** Ship in 5 plans. Wave 1 runs two parallel pure moves (retrieval split + seam, and the search-handler move) beside the frontend args-derived card line. Wave 2 is migration 200 (`p_document_ids`, an in-function exact branch keyed on a chunk-count threshold, a `document_chunks(document_id)` index, drop of the old signatures, `PUBLIC` revoke) plus the RLS-intersected resolver. Wave 3 adds the `filters` schema, result kinds, lock, audit, date and prompt. Wave 4 holds the recall ladder, the 8-row board and the G-4 drive.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Deciding *whether* to filter and with what values | LLM (provider) via tool args | API (prompt + per-request vocabulary) | D-01: the model decides over a closed list; the API supplies the list and today's date. |
| Validating fields/ops/values (D-04, D-20 canonicalisation) | API / Backend (search tool module) | Database (distinct-value lookup under RLS) | Trust boundary is the server; the whitelist is `_build_field_meta`. |
| Filter → document-id set | API / Backend (`retrieval_scope`) | Database (RLS intersect) | The compiler emits PostgREST; RLS must decide visibility. |
| Restricting both arms + exact vs index scan | Database (RPCs, migration 200) | API (sets `iterative_scan` GUC per txn) | One SQL home for retrieval predicates (the ledger's 231 lesson: a caller that never knew a rule cannot get it wrong). |
| Empty-set short-circuit (D-18), result kinds (D-12), retry lock (D-09), audit (D-12) | API / Backend (search tool module) | — | Must run before any RPC; per-turn state lives in the run. |
| Today's date + filter guidance (D-07/D-02) | API (`agent_loop` prompt assembly) | — | Prompt assembly is backend. |
| "Filtered: …" line (D-08) | Browser / Client (pure formatter over persisted `args`) | — | Args persist untruncated; no wire change needed. |
| Recall proof (SC#3) | Database (`recall_bench`) | Scripts (`recall_eval.py`, `measure-recall.py`) | Measured, not asserted. |

## Standard Stack

### Core (all already in the repo, no new dependency)
| Component | Version (measured) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PostgreSQL | 17.6 (local `:54322`) | Chunk RPCs, RLS | Existing. |
| pgvector | **0.8.0** (local) | HNSW + `hnsw.iterative_scan` (introduced 0.8.0) | [CITED: github.com/pgvector/pgvector README §Iterative Index Scans] |
| `view_filter_compiler` + `document_view_resolver.validate_and_compile`/`apply_fragments` | Phase 271 | The ONE compiler (D-03) | [VERIFIED: codebase] shared by Find, views, `query_documents_by_view`. |
| `document_search_service._apply_dates` / `_DATE_COLUMN` + `models/document_search.FindDate` | Phase 271 | The three timestamptz dates (`added`/`source_created`/`source_modified`) with day-boundary semantics | [VERIFIED: codebase] |
| `retrieval_tuning.apply_hnsw_session_knobs` | Phase 241 | Per-transaction `SET LOCAL hnsw.iterative_scan` (+ `max_scan_tuples` 20000, `scan_mem_multiplier` 1) | [VERIFIED: codebase] GUC name is a literal, value is a bind param. |
| `get_user_pg_connection(None, {"id": uid})` | Phase 163/164 | RLS-enforced asyncpg context in the run path (no token) | [VERIFIED: codebase] |
| Pydantic v2 | existing | Parse the `filters` argument | Project rule. |

### Supporting
| Component | Purpose | When to Use |
|---------|---------|-------------|
| `metadata_field_service.list_field_definitions(user_id, supabase)` | D-02 vocabulary + enum options | Once per run (own + system-global defs, explicit predicate, safe on service-role). |
| `folder_utils._resolve_caller_org_ids` | Bound the service-role candidate read to the caller's orgs | Resolver step 1. |
| `recall_eval.inspect_execution_plan` / `measure-recall.py` / `build-recall-bench.py` | SC#3 measurement | Wave 4 (and a pre-design spike in Wave 2). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New params on the existing RPCs | A new RPC pair (`match_document_chunks_in_set`) | A new pair duplicates the org/visibility predicate block a second time and leaves two homes for the retrieval predicate (the opposite of D-13). **Recommend new trailing params** + DROP of the old signatures. |
| Exact scan via `ORDER BY <expr>` in a separate plpgsql branch | `SET LOCAL enable_indexscan = off` | pgvector documents both [CITED: pgvector README §"Exact search"/"Why isn't a query using an index"]. But `enable_indexscan = off` also disables the new btree `document_id` index scan, and a GUC that leaks across the branch is harder to fence. The expression `ORDER BY` is structural, and robust to plpgsql generic plans. |
| Python decides exact vs index (needs a chunk count round trip) | RPC counts `document_chunks` by `document_id = ANY(...)` itself and branches on `p_exact_max_chunks` | **Recommend in-RPC count**: one round trip, uses the new btree index, threshold still passed from a Python constant. |
| Resolve the filter in SQL (write a Fragment→SQL renderer) | Two-step: service-role PostgREST candidates (compiler verbatim) → RLS intersect via asyncpg | A SQL renderer is a second walker, i.e. the fork D-115-6 forbids. **Recommend two-step.** |
| D-08 line from the result payload | From `tc.args` (client-side pure formatter) | Result is truncated at 2000 chars and the search body requires `Array.isArray(parsed)`. **Recommend args.** |

**Installation:** none. No new package in this phase.

## Package Legitimacy Audit

No external packages are installed by this phase (no new pip or npm dependency; pgvector 0.8.0 is already the server extension). slopcheck not required.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
user question ("October revenue for Acme GmbH")
   │
   ▼
agent_loop  ── system prompt + "Today is 2026-10-03 (UTC)" (D-07) + filter guidance (D-02)
   │          tools: search_documents schema (static `filters` arg) + per-run vocabulary
   │          (enabled custom fields + enum options) substituted into its description
   ▼
LLM (8 providers) ──emits──► search_documents{query, filters:[{field,op,value,value2,values,unit}], metadata_filter?}
   │
   ▼
dispatch_tool → search_documents_tool.handle (D-15 module)
   │
   ├─(a) parse args (Pydantic) ── metadata_filter → eq conditions (D-03)
   ├─(b) D-09 lock: field set dropped after a zero-match this run? ──yes──► REFUSED (audit kind=refused_retry)
   ├─(c) validate vs whitelist / enum options / ISO dates; canonicalise case (D-20)
   │        └─ invalid ──► KIND 3 {valid values listed} (audit)
   ├─(d) retrieval_scope.resolve_document_scope
   │        step1: service-role PostgREST, compiler fragments + FindDate + default predicates
   │               + org IN caller_orgs + folder_subtree_ids (D-19)  → candidate ids
   │        step2: asyncpg user context (RLS) SELECT id … WHERE id = ANY($1) → visible set V
   │        + undated count (D-06) under the same RLS
   │        └─ V empty ──► KIND 2 (no RPC call, D-18) + nearby values (D-11) + lock record (D-09)
   ├─(e) retrieval_service.search_documents(query, …, scope=V)
   │        SET LOCAL hnsw.iterative_scan=<filtered constant>   (filtered calls only)
   │        match_document_chunks(…, p_document_ids=V, p_exact_max_chunks=T)
   │             ├─ count(chunks in V) ≤ T → EXACT branch: ORDER BY (dist)+0  (no HNSW, no cliff)
   │             └─ else               → INDEX branch (HNSW + iterative scan)
   │        keyword_search_chunks(…, p_document_ids=V)      (same restriction, D-19)
   │        RRF → dedup → rerank → enrich
   │        └─ 0 passages over threshold but V non-empty → relaxed-threshold rows marked low (D-10)
   ├─(f) folder clip (existing 098 backstop) → citations
   └─(g) audit search.query {…existing keys, filters(applied), result_kind, matched_document_count, undated_excluded}
   ▼
ToolResult(result=JSON array of hits [UI], llm_content=JSON object w/ filter summary [model])
   ▼
frontend ToolCallPanel row ── "Filtered: document date 1–31 Oct 2025 · legal entity = Acme GmbH" (from tc.args, D-08)
```

### Recommended Project Structure (D-13 / D-15)

```
backend/app/services/
├── retrieval_service.py        # ORCHESTRATOR ONLY: search_documents() + back-compat re-exports
├── retrieval_rpc.py            # MOVED: _vector_literal, _call_as_user, _vector_search, _keyword_search (+ RPC SQL)
├── retrieval_rank.py           # MOVED (pure): _rrf_fuse, _deduplicate_chunks, _avg_cosine
├── retrieval_documents.py      # MOVED: _enrich_with_filenames, resolve_document_id, fetch_full_document
├── retrieval_scope.py          # NEW seam: RetrievalScope, DEFAULT_PREDICATES (data), resolve_document_scope()
├── retrieval_tuning.py         # UNCHANGED (241)
└── search_documents_tool.py    # NEW (D-15): handler, arg model, vocabulary/schema builder, lock, audit, result kinds
```

Names are Claude's discretion (D-13/D-15). Flat modules follow the `retrieval_tuning.py` precedent. Keep `retrieval_service.py` re-exporting `search_documents`, `resolve_document_id`, `fetch_full_document`, `_call_as_user`, `_vector_literal`, `_enrich_with_filenames`. Its importers are `tool_dispatcher.py:47`, `agent_loop.py:79`, `checked_query_service.py:22`, `multimodal_service.py:1011` (lazy), `scripts/spike-097/derive_fields.py:61`, and `tests/unit/test_retrieval_service.py:13` [VERIFIED: grep]. Then neither `agent_loop.py` nor `checked_query_service.py` needs an edit for the move.

### Pattern 1: Pure move with a provable "pure" (Plan 1)

**What:** Move the functions verbatim. Prove purity with an AST-equality test against the base commit, and keep `search_documents`' unfiltered output byte-identical.
**When:** First, before any behaviour (ROADMAP G-5 flag; D-13).
**How to prove it:** For each moved function, compare `ast.dump(ast.parse(textwrap.dedent(inspect.getsource(fn))))` with the same function parsed from `git show <base>:backend/app/services/retrieval_service.py` (the `expert_scope.py` "moved byte-for-byte, test keeps a verbatim copy" precedent). Add a characterization test that pins `search_documents(...)` call arguments to both RPCs for an unfiltered call before the move, and re-run it after.

**Monkeypatch retargets the move forces (all measured):**

| Test file | Today patches / reads | After move |
|---|---|---|
| `tests/unit/test_retrieval_service.py` (14 sites) | `patch("app.services.retrieval_service.embed_texts")` | `app.services.retrieval_rpc.embed_texts` (where `_vector_search` now looks it up) |
| `tests/unit/test_241_hnsw_knobs.py` | `rs._call_as_user`, `rs.embed_texts`, `rs.get_user_pg_connection`; `rs._vector_search(...)`/`rs._keyword_search(...)` positional calls; `inspect.getsource(rs)` HNSW-line cap ≤ 12 + positive control; G-5 sentence (`"owed"` and `"g-5"` in source) | Retarget patches to `retrieval_rpc`. **Retarget the cap fence to `retrieval_rpc`** (the logic home). **Re-drive the G-5-sentence test deliberately**: the obligation is being discharged, so the file's sentence and the test both change, with the reason written in the test body (SEED-177 "retire deliberately"). |
| `tests/unit/test_246_hnsw_server_probe.py::test_retrieval_service_is_byte_unchanged` | `git diff --name-only origin/develop -- retrieval_service.py` must be empty | **Retire deliberately** with the reason written in the test (it was a Phase-246-only fence; it would also stay red until `develop` is pushed). Otherwise the backend baseline goes to 72 failed. |

**Search-handler move (D-15) retargets, measured:** tests that patch `td.search_documents` or `td.write_audit_entry` and then drive `td._handle_search_documents`. After the move the handler resolves both names from **its own** module globals, so these patches silently miss and the tests hit the real RPC:
`tests/test_098_scope_governance.py` (`setattr(td,"search_documents")` ×2, imports `_handle_search_documents`), `tests/test_2171_search_error_audit.py` (both + `inspect.getsource(td._handle_search_documents)`), `tests/unit/test_260_financial_analyzer_conversation.py` (`patch("app.services.tool_dispatcher.search_documents")` ×2), `tests/unit/test_267_cr02_empty_biased_scope_searches.py` (×2), `tests/unit/test_268_search_audit_keys.py` (both + `getsource` counts `'"run_id": str(ctx.run_id)'` **== 2**), `tests/unit/test_retrieval_failure_honesty.py` (×3 + import), `tests/unit/test_tool_dispatcher.py` (×2 + `td._handle_search_documents`). Registry-level spies (`setitem(_TOOL_REGISTRY, "search_documents", …)` in `test_096`, `test_147`, `test_harness_whitelist`) are unaffected. **Keep `td._handle_search_documents` importable** as a re-export (it satisfies `inspect.getsource` and the imports), and retarget the patches to the new module in the same commit.
⚠ Five of these live in `backend/tests/` **top level**, which the baseline gate (`tests/unit`) never runs. Run them explicitly.

### Pattern 2: Filter → document set under RLS (the D-14 resolver)

**What:** Resolve conditions to ids with the 271 compiler verbatim, then let RLS decide visibility.
**Why two steps:** `ctx.supabase` in the run is the **service-role** client [VERIFIED: `threads.py` "Phase 163 (D-05/D-09): service-role — the agent-loop async writer path keeps BYPASSRLS"]. The compiler only emits PostgREST builder calls, and the run has **no user JWT** (the 163 red line: no token, no mid-run expiry). The asyncpg user context *does* enforce RLS, and the `documents` SELECT policy is exactly `org_id IN current_user_org_ids() AND (owner OR org-shared folder OR connection_doc_is_visible(...))` [VERIFIED: migration 154:109-119], the same predicate the RPCs apply. ⚠ Do **not** reuse Find's own/global legs as the visibility rule. They omit `connection_doc_is_visible`, so org-visible connection documents (not owned, not in a shared folder) that unfiltered search returns would vanish under a filter.

```python
# retrieval_scope.py — sketch (names are discretion). Imports of document_view_resolver /
# document_search_service MUST be function-local: tool_dispatcher → retrieval_service → here →
# document_view_resolver → harness.scope → harness/__init__ → phase_types → task_service →
# tool_dispatcher is a REAL cycle [VERIFIED: harness/__init__.py:22, phase_types.py:116,
# task_service.py:44]. tool_dispatcher already breaks it with `_ensure_resolver()`.

@dataclass(frozen=True)
class RetrievalPredicate:          # D-13: a default predicate is DATA
    name: str
    condition: "ViewCondition | None"   # None = enforced in SQL only (documented mirror)
    enforced_in_rpc: bool               # True → RPC already applies it; resolver applies it for COUNT parity

DEFAULT_PREDICATES: tuple[RetrievalPredicate, ...] = (
    RetrievalPredicate("latest_only", None, True),            # d.is_latest = true
    RetrievalPredicate("not_source_disconnected", None, True),# source_state IS NULL OR != 'source_disconnected'
    RetrievalPredicate("caller_visibility", None, True),      # org gate + PRAG-01 visibility (RLS in step 2)
)
# Phase 275 appends RetrievalPredicate("not_archived", ViewCondition(...), enforced_in_rpc=False).
# RULE (written as data, no branch): any predicate with enforced_in_rpc=False forces a resolved
# scope for EVERY search, unfiltered included. 275 then measures that cost; 272 changes nothing.

async def resolve_document_scope(*, user_id, conditions, dates, folder_ids, supabase) -> ScopeResult:
    # step 1: service-role candidates — compiler VERBATIM + FindDate + bound to caller orgs
    org_ids = await _resolve_caller_org_ids(supabase, user_id)      # fail-closed: empty → ScopeResult.empty()
    def build(count):
        q = supabase.table("documents").select("id,date_typed,source_created_at,source_modified_at,created_at",
                                                count="exact" if count else None)
        q = q.in_("org_id", sorted(org_ids)).eq("is_latest", True).or_(
            "source_state.is.null,source_state.neq.source_disconnected")
        q = apply_fragments(q, fragments)          # shared walk, no fork
        q = _apply_dates(q, req_with_dates)        # Find's timestamptz day-boundary logic
        if folder_ids is not None:                 # D-19: AND with chat/Expert scope
            q = q.in_("folder_id", list(folder_ids))   # [] here would be a bug upstream — treat as empty set
        return q
    candidates = await _fetch_all(build)          # count=exact + range walk, raises on truncation
    # step 2: RLS decides — same predicate as the RPCs
    async with get_user_pg_connection(None, {"id": user_id}) as conn:
        rows = await conn.fetch("SELECT id::text FROM public.documents WHERE id = ANY($1::uuid[])",
                                [c["id"] for c in candidates])
    return ScopeResult(document_ids=tuple(sorted(r["id"] for r in rows)), ...)
```

`ScopeResult` must make "no filter" (`None`) and "filter matched nothing" (empty tuple) **different types or explicit flags**. ⛔ Never write `x if x else None` on the document-id list (Pitfall 1).

### Pattern 3: RPC change (migration 200)

```sql
-- 200_filtered_retrieval_document_scope.sql — sketch
BEGIN;
-- (1) the btree the exact branch needs (none exists today — measured on dev + recall_bench)
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON public.document_chunks (document_id);
-- (2) drop the OLD signatures first: CREATE OR REPLACE with an added param = a NEW overload, and
--     positional callers would then hit "function … is not unique" (the 033/036 precedent)
DROP FUNCTION IF EXISTS public.match_document_chunks(vector, uuid, integer, double precision, jsonb, uuid[], text);
DROP FUNCTION IF EXISTS public.keyword_search_chunks(text, uuid, integer, jsonb, uuid[]);
CREATE FUNCTION public.match_document_chunks(
  query_embedding vector, match_user_id uuid, match_count integer DEFAULT 5,
  match_threshold double precision DEFAULT 0.3, metadata_filter jsonb DEFAULT NULL,
  p_folder_ids uuid[] DEFAULT NULL, p_embedding_model text DEFAULT NULL,
  p_document_ids uuid[] DEFAULT NULL,           -- NEW, trailing + DEFAULT NULL → existing 7-arg callers unchanged
  p_exact_max_chunks integer DEFAULT NULL       -- NEW: NULL = never exact
) RETURNS TABLE(id uuid, document_id uuid, content text, chunk_index integer, similarity double precision)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE n_chunks integer;
BEGIN
  IF p_document_ids IS NOT NULL AND cardinality(p_document_ids) = 0 THEN
    RETURN;                                       -- defence in depth for D-18: empty set = zero rows, never "all"
  END IF;
  IF p_document_ids IS NOT NULL AND p_exact_max_chunks IS NOT NULL THEN
    SELECT count(*) INTO n_chunks FROM public.document_chunks c WHERE c.document_id = ANY (p_document_ids);
  END IF;
  IF n_chunks IS NOT NULL AND n_chunks <= p_exact_max_chunks THEN
    RETURN QUERY                                  -- EXACT: the ORDER BY is an EXPRESSION → HNSW cannot serve it
    SELECT dc.id, dc.document_id, dc.content, dc.chunk_index,
           1 - (dc.embedding OPERATOR(public.<=>) query_embedding) AS similarity
    FROM public.document_chunks dc JOIN public.documents d ON d.id = dc.document_id
    WHERE dc.document_id = ANY (p_document_ids)
      AND <the SAME seven predicates as today, verbatim>
    ORDER BY (dc.embedding OPERATOR(public.<=>) query_embedding) + 0
    LIMIT match_count;
  ELSE
    RETURN QUERY  <today's body verbatim>  AND (p_document_ids IS NULL OR dc.document_id = ANY (p_document_ids));
  END IF;
END; $function$;
-- keyword_search_chunks: same DROP/CREATE with trailing p_document_ids uuid[] DEFAULT NULL
-- (3) the PUBLIC-EXECUTE trap: revoke from PUBLIC, not only anon (migration 181 pattern)
REVOKE EXECUTE ON FUNCTION public.match_document_chunks(vector, uuid, integer, double precision, jsonb, uuid[], text, uuid[], integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.match_document_chunks(vector, uuid, integer, double precision, jsonb, uuid[], text, uuid[], integer) TO authenticated, service_role;
-- … same for keyword_search_chunks(text, uuid, integer, jsonb, uuid[], uuid[])
COMMIT;
```

Source: pgvector README: *"The query needs to have an `ORDER BY` and `LIMIT`, and the `ORDER BY` must be the result of a distance operator (not an expression)"* for the index to be used; *"+ 0 needed for Postgres 17+"* in the re-sort pattern [CITED: github.com/pgvector/pgvector]. The threshold `p_exact_max_chunks` is passed from a Python constant set by the Wave-4 measurement (D-14). The in-function `match_threshold` is passed as `-1` for filtered calls (Pattern 5 / D-10).
⚠ **`scripts/full-schema-supplement.sql:636-644` hard-codes the OLD signatures in its REVOKE/GRANT lines** [VERIFIED]. Update them in the same commit, or the bootstrap artifact breaks. `recall_eval._MATCH_SQL` (7 positional args), `test_266_two_org_fence.py` (5/7 args) and `test_111_1_match_filters_stale.py` keep working **only because** the new params are trailing with defaults.

### Pattern 4: Tool schema — the shape that survives all 8 providers

```python
"filters": {
  "type": "array",
  "description": "...(static: ops, date rules, the built-in field list)...",
  "items": {
    "type": "object",
    "properties": {
      "field":  {"type": "string"},
      "op":     {"type": "string", "enum": ["eq","one_of","contains","is_empty","gte","lte",
                                             "before","after","between","within_next","older_than"]},
      "value":  {"type": "string"},          # SINGLE scalar type: no ["string","number",...] arrays
      "value2": {"type": "string"},
      "values": {"type": "array", "items": {"type": "string"}},
      "unit":   {"type": "string", "enum": ["days","weeks","months"]},
    },
    "required": ["field", "op"],
  },
},
```

Rules this shape obeys, each with evidence:
- **No `anyOf`/`oneOf`/`additionalProperties`** in the new part. Google strips them [VERIFIED: `google_service._GOOGLE_UNSUPPORTED_SCHEMA_KEYS`], and the D-115 decision records Gemini rejecting `anyOf`/`oneOf`.
- **No multi-type `type: [...]` arrays.** google-genai's Pydantic `Tool` validation rejects them, and a single rejected tool takes down **every** Gemini Deep run because Google validates the Tool as a unit. Measured live at 115 [VERIFIED: `google_service._translate_nullable_type` docstring, 115-HUMAN-UAT gaps]. The sanitizer now collapses such arrays, but plain `string` avoids depending on that collapse. The handler coerces `value` to an int for `within_next`/`older_than`, and to a number for custom `number` fields.
- **`op` enum must equal `ViewCondition.op`.** Pin it with a parity test, as in the 115 op-enum parity test (`test_115_tool_schema.py`).
- `metadata_filter` stays in the schema (`test_module7_tools.py:51-54` pins it optional). Its map idiom loses its value type on Google after the strip, which is acceptable because it is now mapped through D-03 validation.
- **OpenAI Responses surface** (the newest OpenAI rows `gpt-5.6-*` have `api_surface: "responses"` [VERIFIED: MODEL_CAPABILITIES]). *"In Responses, omitting `strict` attempts strict mode; if the schema cannot be made compatible, Responses falls back to non-strict, best-effort function calling and returns the resolved tool with `strict: false`"* [CITED: developers.openai.com/api/docs/guides/migrate-to-responses]. `openai_responses._to_responses_tools` does not set `strict` [VERIFIED]. Our schema (optional properties, no `additionalProperties:false`) is not strict-compatible, so it falls back to non-strict. Chat Completions functions are non-strict by default [CITED: same page], and the chat path never sets `strict` [VERIFIED: grep].
- **Anthropic:** `input_schema` is plain JSON Schema. The docs say *"Provide extremely detailed descriptions … by far the most important factor"*, and offer `input_examples` for nested objects (~100-200 tokens; Anthropic-only field) [CITED: platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools]. **Recommend putting examples in the description prose**, which is uniform across providers, rather than an Anthropic-only field.
- **Kimi/Moonshot:** parameters must be *"a subset of JSON Schema conforming to the MFJS specification"*, root an object [CITED: platform.kimi.ai/docs/guide/use-kimi-api-to-complete-tool-calls]. Kimi is the only `emit_tier: coerce` native family [VERIFIED].
- **In-repo cross-provider evidence:** a nested `filter.conditions[]` array-of-objects schema with the same op enum passed **8/8 providers with no 400** at Phase 115 (after the Gemini type-array fix). ⚠ But only **Kimi** was recorded actually emitting the inline condition list; the others emitted `{view: "Reports"}` [VERIFIED: 115-HUMAN-UAT.md:26-39]. Emission of the nested filter is therefore **unproven for 7 of 8**, and that is exactly what the SC#10 board measures (D-17).

**Per-request vocabulary (D-02):** `get_tools()` is synchronous and pure, and is called from `openai_service.create_streaming_chat` (`:2104`, `:2146`) whenever `tools_override is None`. Deep chat passes `active_tools=None` (`agent_loop.py:1475`). **Recommendation:** fetch `list_field_definitions` once per run. Only when the caller has ≥1 enabled custom field, substitute a description-enriched copy of `SEARCH_DOCUMENTS_TOOL` into `active_tools` with **one** agent_loop line, e.g. `active_tools = with_search_vocabulary(active_tools, user_settings, vocab)` after the connector block (`:1757` already does the same list substitution for connector tools). With no custom fields, the path stays `active_tools=None` and byte-identical. Cap the vocabulary, e.g. ≤ 20 fields and ≤ 25 options each, with "…and N more; an unknown value returns the full list" (D-04 makes the cap safe). Caching: Anthropic caches the tool block (`anthropic_service.py:139` puts `cache_control` on the last tool), so a per-user description costs one cache miss per distinct vocabulary, which is acceptable. Harness phases, sub-agents and eval keep the static schema. They still get validation and D-04's listed values.

### Pattern 5: Result kinds, D-10 relaxation, D-11 nearby values

- **Unfiltered calls stay byte-identical**, including the literal `"No relevant documents found."` asserted by `test_260` and `test_267_cr02` [VERIFIED].
- Filtered **kind 1:** `result` = JSON **array** of hits (the UI's `SearchDocumentsBody` renders only when `Array.isArray(parsed)` [VERIFIED: `ToolCallDetails.tsx:86`]), each hit possibly carrying `"low_similarity": true`. `llm_content` = a JSON object `{filter_applied, matched_documents, undated_excluded, passages:[…]}`. `ToolResult.llm_content` already exists, and `agent_loop.py:3101` sends it to the model instead of `result`.
- **D-10:** for filtered calls, pass `match_threshold = -1` to the vector RPC (the set is already scoped), then mark rows below the configured threshold as `low_similarity`. If any rows clear the threshold, return only those; otherwise return the top rows marked low. That is one RPC call, and it also stops the threshold predicate from making iterative scan walk to `max_scan_tuples`.
- **Kind 2** (zero documents, before any RPC): `{"status":"no_documents_matched","filter":"<plain label>","undated_excluded":k,"nearby":[…],"instruction":"Say no documents matched this filter. Cite nothing. Do not search without this filter."}`. Avoid an `"error"` key, because `ToolCallDetails` short-circuits on `parsed?.error` and renders only the code [VERIFIED: `ToolCallDetails.tsx:66-70`].
- **Kind 2b, worth naming:** documents matched but **no chunks** came back even with the threshold relaxed (still ingesting, or chunks embedded under a different `embedding_model`, which the D-10 stale filter excludes). This is neither "nothing matched" nor "found". Recommend a distinct `status` (e.g. `matched_documents_not_searchable`) that names the count.
- **Kind 3** (invalid): `{"error":"invalid_filter","field":…,"allowed":[…],"message":…}`.
- **D-11 nearby values:** for a date filter, re-resolve with the date condition removed and the same RLS step 2, then group `date_typed` by month and offer the nearest months with counts. For an enum dimension, list options that have documents. Document-level counts only; nothing cited.
- **D-06 undated count:** documents that pass every *non-date* condition (RLS-intersected) and have `NULL` in the filtered date column.

### Pattern 6: D-09 retry lock (per turn, per field)

A "turn" is one `run_agent_loop` invocation. **ToolContext is rebuilt every iteration** (`agent_loop.py:3019`, *"construct ToolContext once per iteration"*), so state set on `ctx` does not survive iterations. ⚠ `has_connection_retrieval` is set exactly that way (`tool_dispatcher.py:930`), so it is not a precedent to copy. Use the **by-reference run accumulator** precedent `dead_gap_tokens_in_run`: init once at `agent_loop.py:~2104`, then thread it into **both** ToolContext builds (`:2141` resume and `:3019`) [VERIFIED].

```python
# ToolContext (tool_dispatcher.py dataclass) — additive, default-off
empty_filter_fields_in_run: set | None = None   # None on harness/eval/test ctx → lock is a no-op
# handler
locked = getattr(ctx, "empty_filter_fields_in_run", None)   # getattr: tests use SimpleNamespace ctx
if locked and not locked.issubset({c.field for c in conditions}):
    return refused(...)      # names the field(s) and why; audit result_kind="refused_retry"
...
if scope.is_empty and locked is not None:
    locked.update(c.field for c in conditions)    # same field, different value → still allowed
```

Sub-agents: **share the parent's set by reference** in `task_service.py:~608`, unlike `dead_gap_tokens_in_run=set()`. A `task` sub-agent in the same turn must not become an unfiltered bypass. Record the divergence as a decision.

### Anti-Patterns to Avoid
- **`folder_ids if folder_ids else None` applied to document ids.** That is the 266 CR-01 / 267 CR-02 inversion (empty means everything).
- **Resolving the filter on `ctx.supabase` and trusting it.** It is service-role, so counts would include other tenants (an existence oracle).
- **Using Find's own/global legs as the visibility definition.** They drop connection-visible documents.
- **Module-level import of `document_view_resolver` / `document_search_service` from any module `tool_dispatcher` or `retrieval_service` imports.** That is the import cycle.
- **Putting the filter label in the result JSON.** 2000-char truncation breaks the parse on reload.
- **A new RPC pair.** That is a second home for the retrieval predicates.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Field/op validation + bound filter SQL | A new filter dialect or a Fragment→SQL renderer | `validate_and_compile` + `apply_fragments` | D-03; D-115-6 "a fork re-opens the leak". |
| Timestamptz date windows | New day-boundary math | `document_search_service._apply_dates` + `FindDate` + `_relative_window` | Pitfall 3 of 271 (whole-day `>= d AND < d+1`) is already solved. |
| ISO-date validation | Regex in the handler | `models/document_search._is_iso_day` | Rejects `2019-13-40`. |
| Visibility | Python re-derivation | RLS via `get_user_pg_connection` (step 2) | One SQL predicate (mig 154). |
| HNSW session GUCs | New `SET` code | `retrieval_tuning.apply_hnsw_session_knobs(iterative_scan=…)` | Literal GUC name, bounded values, per-knob degrade (T-241-14/17). |
| Exact-total reads past PostgREST `max-rows` | `.limit(10000)` | `document_search_service._fetch_all` | Count-exact + range walk + truncation raise. |
| Recall measurement | New script | `recall_eval.measure_layer1` / `scripts/measure-recall.py` on `recall_bench` | Exact vs ANN arms, refusal on error. |
| Caller org set in service-role context | Ad-hoc query | `folder_utils._resolve_caller_org_ids` | Fail-closed on empty. |

**Key insight:** every filter-adjacent bug this project has shipped (266 CR-01, 267 CR-02, 115's Gemini 400, 241's unseen seq scan) came from a second definition of something that already had one home.

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `audit_log.metadata` for `search.query` gains keys (`filters`, `result_kind`, `matched_document_count`, `undated_excluded`). Readers `.get()` known keys [VERIFIED: `knowledge_health.py:68,389-395`, `document_queries.py:76-101`, `api/audit.py:67`]. No CHECK change (`search.query` already allowed). | Code edit only; no data migration. ⚠ `knowledge_health._fetch_retrieval_trend` counts every non-`provider_error` row with empty `document_ids` as `found_nothing`, so kind 3 and refused rows would inflate it (Open Question 2). |
| Live service config | **Production Supabase:** the two RPC signatures and the new index exist only after migration 200 is pasted there. The backend that calls the 9-arg form must deploy **after** the migration (deploy parity). | Approval-gated cloud write; `get_advisors(security)` after. |
| Live service config | **`recall_bench` DB (local)**: 100k chunks / 3,850 docs, built from an **older** `full-schema.sql` (its `documents_dedup_idx` predates migration 196) [VERIFIED: pg_indexes]. It has neither migration 200 nor the btree index. | Rebuild via `scripts/build-recall-bench.py` after regenerating `full-schema.sql`, or apply migration 200's SQL to `recall_bench` directly (its safety guard requires DB name == `recall_bench`). |
| OS-registered state | None. Verified: no scheduler or task references retrieval. | None. |
| Secrets/env vars | None needed. **Recommend constants**, not new env vars (deploy-artifact parity rule). | None. |
| Build artifacts | `supabase/full-schema.sql` (regenerate, no `--reset`); `scripts/full-schema-supplement.sql:636-644` (signature literals); `graphify-out/` (`graphify update .`). | Regenerate / edit in the same commit as the migration. |

## Common Pitfalls

### Pitfall 1: An empty document set reaches an RPC as "no filter"
**What goes wrong:** `p_document_ids=[]` gets coerced to `NULL` (the `x if x else None` idiom in `retrieval_service.py:120-121,152-153`), and the search widens to everything.
**Why:** The idiom is already used for `folder_ids` and `metadata_filter`.
**Avoid:** Short-circuit to kind 2 in the handler **before** calling retrieval (D-18), *and* make the RPC return zero rows on an empty array (defence in depth). Test both: a spy on `search_documents` and the RPC asserts **0 calls**.
**Warning sign:** a kind-2 audit row whose run also has a `match_document_chunks` call.

### Pitfall 2: Service-role counts leak across tenants
**What goes wrong:** D-06/D-11 counts are computed on `ctx.supabase` and include other orgs' documents.
**Avoid:** Every number shown to the model comes from the RLS step 2. Integration-test it with the 266 two-org fence fixture.

### Pitfall 3: The extraction turns the baseline red
**What goes wrong:** `test_246::test_retrieval_service_is_byte_unchanged` (git-diff fence) and `test_241` (cap, G-5 sentence, `rs.*` patches) fail the moment the file changes, giving 72+ failed.
**Avoid:** Retire or retarget them in the **same commit** as the move, with the reason in the test body. Count the baseline before and after.

### Pitfall 4: Monkeypatches that silently miss after a move
**What goes wrong:** Tests patch `td.search_documents` but the handler now reads `search_documents_tool.search_documents`. The test calls the real RPC and fails, or worse, passes on a mock DB.
**Avoid:** Retarget the patch strings listed under Pattern 1. Add a positive control in one test proving the patch is hit.

### Pitfall 5: Import cycle at module load
**What goes wrong:** `ImportError: cannot import name … from partially initialized module 'app.services.tool_dispatcher'`.
**Avoid:** Function-local imports of `document_view_resolver` / `document_search_service` inside `retrieval_scope` and the tool module, or the `_ensure_resolver()` lazy-bind precedent.

### Pitfall 6: Old RPC overload left in place
**What goes wrong:** `CREATE OR REPLACE` with a new parameter creates a second function. asyncpg positional calls then fail with *"function … is not unique"* (migrations 033/036 history).
**Avoid:** `DROP FUNCTION IF EXISTS` with the exact old signature first. After apply, check that `pg_proc` has exactly one row per name (`pg_get_function_identity_arguments`).

### Pitfall 7: `PUBLIC` keeps `EXECUTE` on the recreated function
**What goes wrong:** A recreated function is granted to PUBLIC by default, so anon can call a DEFINER RPC (BUG-260911-01 class).
**Avoid:** `REVOKE … FROM PUBLIC` explicitly, run `has_function_privilege('anon', …)` checks (mig 181:158-165 has the query), and `get_advisors(security)` locally and in the cloud.

### Pitfall 8: Exact branch without the btree index
**What goes wrong:** `document_id = ANY(...)` seq-scans `document_chunks`, which measured 103,771 buffers / ~1.1 s on the bench.
**Avoid:** Migration 200 adds `idx_document_chunks_document_id`. EXPLAIN must show `Index Scan`/`Bitmap Index Scan using idx_document_chunks_document_id`.
⚠ Plain `CREATE INDEX` locks writes on `document_chunks` (ingest) for the build. Measure the prod chunk count first with a free MCP read, or use `CREATE INDEX CONCURRENTLY` as a **separate statement outside** `BEGIN/COMMIT` (CONCURRENTLY cannot run in a transaction).

### Pitfall 9: EXPLAIN that measures the wrong thing
**What goes wrong:** `EXPLAIN SELECT * FROM match_document_chunks(...)` shows only a `Function Scan`. `recall_eval.inspect_execution_plan` then falls back to the **cumulative** `pg_stat_user_indexes.idx_scan` counter (`recall_eval.py:762-771`), which reads "uses index" forever once the index has ever been used.
**Avoid:** EXPLAIN the function's **body statement** with its parameters bound, under `SET LOCAL ROLE authenticated` + claims (how 246 did it [VERIFIED: 246-VERIFICATION-DATA.md §2]). Also EXPLAIN it as a **generic plan** (`SET plan_cache_mode = force_generic_plan` + `PREPARE`), because plpgsql switches to generic plans after 5 executions and the `= ANY($ids)` estimate changes. Read the `Index Name` from the plan JSON, never the stats counter. Assert per SEED-273: node/index name and `shared read` < 1,000.

### Pitfall 10: Case mismatch (D-20) per leg
**Measured compiler behaviour:** `eq` on `document_type`/`language` → lowercased `.eq` (stored lowercase). `title`/`author`/`summary` → `ilike` (case-insensitive exact; note `%`/`_` act as wildcards inside the value). Custom string/enum → `@>` containment, which is **case-sensitive**. Custom numbers via containment with a **string** `"5"` do not match a stored number `5`.
**Mechanism (recommended):** canonicalise before compile. For enum fields, match the value case-insensitively against `options` and substitute the stored spelling, refusing with the list on no match (D-04). For free custom strings, look up distinct stored values under RLS (`SELECT DISTINCT metadata->>$1 FROM documents WHERE lower(metadata->>$1) = lower($2)`, field and value **both bind params**) and substitute the stored spelling(s); several spellings become `one_of`. For custom numbers, coerce to int/float. Drop the blanket lowercasing at `retrieval_service.py:392-394` for the mapped `metadata_filter`. ⚠ `one_of` → `.in_()` does not escape `"` inside values (271 WR-04); avoid `.in_` for stored strings that contain quotes or commas (fall back to several containment checks or `_pg_in_list`).

### Pitfall 11: `date_typed` is NULL for non-ISO dates
**What goes wrong:** `date_typed` parses only strict `YYYY-MM-DD` [VERIFIED: migration 074 `view_iso_to_date`]. A report whose metadata says `"2025-10"` or `"October 2025"` is **undated** under D-06 and excluded. Locally only **37 of 208** documents have a non-null `date_typed` [VERIFIED].
**Avoid:** Seed fixtures with ISO dates. Make the D-06 sentence prominent, since it is the honest signal. Record this as a data-quality limit, not a code bug.

### Pitfall 12: Date operands that crash PostgREST
**What goes wrong:** `{"field":"date","op":"eq","value":"October"}` → `.eq("date_typed","October")` → PostgREST 400 *invalid input syntax for type date*, which surfaces as an exception that could be reported as `retrieval_unavailable`.
**Avoid:** Validate date operands with `_is_iso_day` before compile, and refuse as kind 3 with the instruction "use between with YYYY-MM-DD". `validate_operands` does **not** check date formats [VERIFIED].

### Pitfall 13: Unfiltered fallbacks through other tools
**What goes wrong:** D-09 locks `search_documents` only. The prompt tells the agent, after zero results, to try `grep`, `query_documents` (free SQL), `read_document` or `analyze_document` (`agent_loop.py:736-748`, "Hybrid fallback — do not stop on zero results") [VERIFIED], all of which read outside the filter.
**Avoid:** Rewrite those prompt rules for the filtered-empty case ("a filtered search that matched no documents is a final answer, so do not look elsewhere"). The SC#10 row (c) verdict must inspect **all** tool calls of the run (persisted `messages.tool_calls`), not just `search.query` rows.

### Pitfall 14: Field-name collision between date words and custom keys
**What goes wrong:** `added` / `source_created` / `source_modified` are routed to `FindDate` and are **not** compiler whitelist fields. A custom field keyed `added` would be shadowed.
**Avoid:** Resolve the date words first, and refuse a custom def using one of those keys with a clear message, or document the precedence.

## Code Examples

### D-08 formatter (client, pure, from persisted args)
```ts
// frontend/src/lib/toolMeta.ts — add beside toolSummary (the ONE home for tool labels)
export function searchFilterLine(name: string, args: Record<string, unknown>): string | null {
  if (name !== "search_documents") return null
  const conds = Array.isArray(args.filters) ? args.filters : []
  const legacy = args.metadata_filter && typeof args.metadata_filter === "object"
    ? Object.entries(args.metadata_filter as Record<string, unknown>).map(([field, value]) => ({ field, op: "eq", value }))
    : []
  const parts = [...conds, ...legacy].map(formatCondition).filter(Boolean)
  return parts.length ? `Filtered: ${parts.join(" · ")}` : null
}
// formatCondition: "date" → "document date", between ISO days in one month → "1–31 Oct 2025",
// field keys "legal_entity" → "legal entity", eq → "= Acme GmbH", one_of → "in A, B".
```
Render it as one visible line under the tool row in `ToolCallPanel.tsx`, using the existing sub-agent-model-line pattern (`ml-8 mt-1 text-[10px] text-muted-foreground`), in **both** the collapsed-essence branch and the full branch. Never in a `title=` tooltip (OV-266-01). `ToolCallPanel.tsx` is G-5 DISCHARGED (227-02); this is a one-element addition. Load `Skill("sketch-findings-agentic-rag")` for the rail conventions first.

### Audit write (one helper, every kind)
```python
# search_documents_tool.py — the ONE writer; keys are additive (.get()-tolerant readers)
metadata = {
  "query_text": q, "document_ids": ids, "similarities": sims,          # existing
  "run_id": str(ctx.run_id), "thread_id": str(ctx.thread_id),            # existing (268)
  "parent_run_id": ..., "folder_ids": [...],                              # existing (268)
  "filters": applied_conditions,             # NEW: as applied (canonicalised), [] when unfiltered
  "result_kind": "passages" | "no_documents_matched" | "matched_documents_not_searchable"
                 | "invalid_filter" | "refused_retry" | "provider_error",
  "matched_document_count": n, "undated_excluded": k,                     # NEW (filtered only)
}
```
⚠ `test_268::test_both_arms_carry_the_literal_run_key` asserts the literal `'"run_id": str(ctx.run_id)'` occurs **exactly 2** times in `_handle_search_documents`' source. Centralising the write changes that count, so re-drive the test to assert "one writer, used by every arm" deliberately.

### Today's date (D-07), one line after the mode switch
```python
# agent_loop.py, after active_system_prompt is chosen (~:1475). Server UTC — the same clock
# _relative_window uses (D-114-16); no per-user timezone exists in user_settings [VERIFIED].
active_system_prompt += f"\n\nToday's date is {datetime.now(timezone.utc).date().isoformat()} (UTC)."
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Raise `hnsw.ef_search` for filtered recall | `hnsw.iterative_scan` (pgvector ≥ 0.8.0), or an exact scan on a small pre-filtered set | 0.8.0; measured here at 246 | ef ≥ 100 made the planner abandon the index for a 1.1 s seq scan [VERIFIED: commit `521f4a025`, SEED-273]. |
| `config.py:1128` comment "default raised from 40 to 200" | Code reads `hnsw_ef_search: int = 40` | Reverted at `521f4a025` (246) | **The comment is stale**: 200 "worked" by disabling the index. Fix the comment in Plan 1 or 2; do not change the value (D-14 keeps global knobs). |
| Chat Completions non-strict tools | Responses API attempts strict when `strict` is omitted | OpenAI Responses | Our schema falls back to non-strict there [CITED]. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The exact branch over ≤ T chunks stays within a chat-acceptable latency (est. tens of ms at a few thousand chunks, from the bench's ~11 µs/chunk seq-scan figure) | Pattern 3 | The threshold must be lower; measured in Wave 4 regardless. |
| A2 | `relaxed_order` vs `strict_order`: one of them restores recall > 0.90 under 20 ms above the threshold | Pattern 3 / SEED-273 | Filtered large-set recall stays degraded; fall back to a higher threshold. |
| A3 | DeepSeek, Zhipu/GLM and MiniMax accept the schema like OpenAI-compatible endpoints (115 showed no 400s) | Pattern 4 | A provider 400s on the enriched description, caught by the SC#10 board. |
| A4 | Server UTC date is acceptable for "today" | D-07 code example | Near midnight a non-UTC user sees an off-by-one "most recent October" only on Nov 1. |
| A5 | Sharing the D-09 set with sub-agents is desired | Pattern 6 | If the operator prefers sub-agent independence, use a fresh set. |
| A6 | `metadata_field_definitions` is per **user** (own + system-global), not per org | D-02 note | D-02 says "the org's"; a field another member defined is **not** in the caller's whitelist [VERIFIED: `list_field_definitions` predicate]. Behaviour matches Find; flag to the operator. |
| A7 | Production chunk count is small enough for a non-concurrent `CREATE INDEX` | Pitfall 8 | Write lock on ingest during the build; use CONCURRENTLY. |

## Open Questions

1. **Vocabulary for non-enum built-ins.** `document_type` is free text (lowercased), not an enum. Should the description list the caller's top-N distinct `document_type` values (a cheap RLS query)? Recommendation: yes, capped at 15. It is data-driven and turns "report vs reports" into a refusal-free hit.
2. **Do `invalid_filter` and `refused_retry` audit rows count as "found nothing" in the Library's Retrieval trend?** Today they would (`knowledge_health.py:395` only exempts `provider_error`). Recommendation: write `retrieval_status` for those kinds and exempt them in one reader line, honoured by construction on a G-5 file (13/6/987). Alternatively accept and record it as a characterization. Planner's call.
3. **Threshold T and the filtered `iterative_scan` value.** Measure at T ∈ {500, 1000, 2000, 5000, 10000} chunks and both scan modes at ef 40/60/80/100. Pick from data (D-14).
4. **The D-09 lock vs. `query_documents`/`grep`.** D-09 locks `search_documents` only (locked decision). The prompt rewrite plus the SC#10 all-tool-calls check is the mitigation; a structural lock on other tools is out of scope. Record it.
5. **`matched_documents_not_searchable` (kind 2b):** confirm the operator wants it distinct from kind 2.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Local Postgres (Supabase) `:54322` | migration, resolver tests, two-org fence | ✓ | PG 17.6 | — |
| pgvector | iterative scan | ✓ | 0.8.0 | — |
| `recall_bench` DB | SC#3 measurement | ✓ (stale schema) | 100k chunks / 3,850 docs | Rebuild with `scripts/build-recall-bench.py` |
| Supabase REST `:54321` | backend | ✓ | HTTP 200 | — |
| Backend `:8000` | SC#10 board, G-4 | ✓ | `/health` 200 | Operator starts it (memory: user starts backend) |
| Python venv | tests | ✓ | 3.12.6 | — |
| Node | gates | ✓ | v24.19.0 | — |
| Provider keys (8) | SC#10 | ✓ all 8 set in `backend/.env` (names only checked) | — | Blocked rows recorded, never omitted |
| `psql` CLI | — | ✗ | — | Use venv asyncpg (works) |
| Docker CLI in shell | — | denied (memory) | — | Not needed |

**Missing dependencies with no fallback:** none.

## Validation Architecture

> `workflow.nyquist_validation` is `false` in `.planning/config.json`. This section is included because the orchestrator explicitly requested it.

### Test Framework
| Property | Value |
|----------|-------|
| Backend | pytest (venv), `backend/tests/unit` (baseline gate) + `backend/tests/` top level + `backend/tests/integration` (live `:54322`, skip-guarded) |
| Frontend | vitest via `scripts/vitest-count-gate.cjs`; typecheck `npx tsc -p tsconfig.app.json --noEmit` as a set diff |
| Quick run | `cd backend && venv/Scripts/python -m pytest tests/unit/test_272_*.py -q` |
| Full suite | `node scripts/check-backend-unit-baseline.cjs` (ceiling 71) + the explicitly-listed top-level suites + `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` |

### Phase Requirements → Test Map
| Req / SC | Behavior | Test Type | Automated Command | File Exists? |
|----------|----------|-----------|-------------------|-------------|
| D-13 | Moved functions are AST-identical to base; unfiltered RPC args unchanged | unit | `pytest tests/unit/test_272_pure_move.py -x` | ❌ Wave 0 |
| D-15 | Handler moved; registry still 29; old patch targets retargeted | unit | `pytest tests/unit/test_272_search_tool_move.py tests/unit/test_259_closed_core_inventory.py tests/unit/test_261_closed_core_inventory.py tests/unit/test_085_tool_registration.py -x` | ❌ / ✅ |
| SC#1 | `filters` → doc set → both arms get the SAME `p_document_ids` (D-19) | unit (spy RPC) | `pytest tests/unit/test_272_filtered_both_arms.py -x` | ❌ |
| SC#1 | Audit row carries `filters` + `result_kind` | unit | `pytest tests/unit/test_272_audit_keys.py tests/unit/test_268_search_audit_keys.py -x` | ❌ / ✅ (re-drive) |
| SC#2 / D-18 | Empty set → kind 2, **zero** RPC calls | unit | `pytest tests/unit/test_272_empty_set_short_circuit.py -x` | ❌ |
| SC#2 / D-09 | Dropping a zero-matched field is refused; same field, new value allowed; state survives iterations | unit | `pytest tests/unit/test_272_retry_lock.py -x` | ❌ |
| D-04 / D-20 | Unknown field/enum value refused with list; mixed-case author/custom value canonicalised and matches | unit + integration | `pytest tests/unit/test_272_filter_validation.py tests/integration/test_272_case_matching.py -x` | ❌ |
| D-06 / D-11 / Pitfall 2 | Undated + nearby counts are RLS-scoped (org B not counted) | integration (two-org fixture) | `pytest tests/integration/test_272_scope_rls.py -x` | ❌ |
| SC#3 | Migration 200: exact branch has no HNSW node; empty array → 0 rows; cross-org ids → 0 rows; one signature per name; anon no EXECUTE | integration | `pytest tests/integration/test_272_rpc_document_scope.py tests/integration/test_266_two_org_fence.py -x` | ❌ / ✅ |
| SC#3 | Recall ladder on `recall_bench` with EXPLAIN at every point | measurement (manual-run script, recorded) | `backend/venv/Scripts/python scripts/measure-recall.py --dsn …/recall_bench …` (+ new filtered shape) | partial |
| Schema | `op` enum == `ViewCondition.op`; Google sanitizer keeps `filters.items.properties`; `types.Tool` constructs | unit | `pytest tests/unit/test_272_tool_schema.py tests/unit/test_075_5_google_native.py -x` | ❌ / ✅ |
| D-08 | Line renders visible text for date + dimension; null for unfiltered; survives reload (args) | vitest | `npx vitest run src/lib/__tests__/toolMeta.test.ts src/__tests__/components/ToolCallPanel.test.tsx` | ✅ (extend; adopt toolMeta into both knobs) |
| SC#4 | 8-row board × 3 prompts | live UAT (VALIDATION.md rows, not PLAN tasks) | per-request `model`/`provider` on `POST /threads/{id}/messages`; verdicts from `audit_log` `search.query` (`filters`, `result_kind`, `document_ids`) **and** `messages.tool_calls` for the run | manual |
| G-4 | Scenarios 1-3 driven in Chrome MCP | manual | — | manual |

### Sampling Rate
- **Per task commit:** the targeted `test_272_*` suites + the retargeted suites for that task.
- **Per wave merge:** the backend baseline gate + the top-level suites `tests/test_098_scope_governance.py tests/test_2171_search_error_audit.py tests/test_096_ci_workflow_regression.py tests/test_147_flag_refuse.py tests/test_harness_whitelist.py` + the vitest count gate.
- **Phase gate:** all of the above green + the SC#3 measurement recorded + the board + G-4 sign-off.

### Wave 0 Gaps
- [ ] `tests/unit/test_272_pure_move.py`: AST equality vs the base commit for every moved function.
- [ ] Characterization test pinning unfiltered `search_documents` RPC call args (before the move).
- [ ] `tests/integration/test_272_*`: reuse the 266 two-org fixture (`tests/integration/test_266_two_org_fence.py` `fence`, `open_user_conn`, `assert_auth_uid`).
- [ ] Board fixture script (local only): create a custom field def `legal_entity` (enum, options e.g. `Acme GmbH`, `Beta Ltd`) via `POST /metadata-fields`; upload ≥ 2 reports per month (e.g. Sep/Oct/Mar) with distinct revenue figures; `PATCH /documents/{id}/metadata` setting `date` (**ISO `YYYY-MM-DD`**) and `legal_entity`; confirm `date_typed` is non-null. A month with no documents (e.g. July) drives prompt (c).
- [ ] `recall_bench`: rebuild after the regenerated `full-schema.sql`, and add a filtered shape that sets ISO `metadata.date` on a small-tenant subset (bench-only writes).

### SC#10 roster (derived, measured from `MODEL_CAPABILITIES` at HEAD; re-derive from the effective registry at run time)
| Row | Provider | Newest registry-backed candidate | Note |
|---|---|---|---|
| 1 | openai | `gpt-5.6-sol` (api_surface `responses`) | Responses: strict attempted, falls back to non-strict. |
| 2 | anthropic | `claude-sonnet-5` | |
| 3 | google | `gemini-3.5-flash` | `max_tools: 16` applies on the harness path only. |
| 4 | deepseek | `deepseek-v4-pro` | |
| 5 | zhipu | `glm-5.2` | |
| 6 | minimax | `MiniMax-M3` | MiniMax arg-repair path exists. |
| 7 | moonshot | `kimi-k2.6` | `emit_tier: coerce`. |
| 8 | openrouter | e.g. `deepseek/deepseek-v4-pro` | `native_tools: False`, the non-native path. |

## Security Domain

`security_enforcement: true`.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | unchanged |
| V3 Session Management | no | unchanged |
| V4 Access Control | **yes** | RLS step 2 (`get_user_pg_connection`) for every count and id set; RPC DEFINER keeps its org/visibility gate, so `p_document_ids` can only narrow; REVOKE PUBLIC/anon on the recreated RPCs |
| V5 Input Validation | **yes** | Pydantic arg model; field whitelist (`_build_field_meta`); closed op enum; `_is_iso_day`; enum-option match; numeric coercion |
| V6 Cryptography | no | — |
| V7 Error/Logging | **yes** | audit `search.query` with `result_kind`; errors never raised into the loop (calm ToolResult); provider exception text stays out of audit (existing T-217.1-15b) |
| V8 Data Protection | **yes** | No cross-tenant counts or nearby values (existence oracle) |

### Threat Model Inputs (for the planner's STRIDE register)
| Pattern | STRIDE | Mitigation |
|---------|--------|------------|
| Filter value reaching SQL | Tampering | Values are bound PostgREST params (`apply_fragments`) or asyncpg `$n`; field names are whitelisted constants; the distinct-value lookup binds **both** field key and value; no f-string SQL. |
| `.or_()` grammar injection | Tampering | Only `is_empty` and the fixed `source_state` predicate use `.or_`, with whitelisted field names only, never values. |
| `.in_()` quoting (271 WR-04) | Tampering / Integrity | Ids only via `.in_`; stored-string membership via containment or `_pg_in_list`. |
| Existence oracle via counts / nearby values | Info disclosure | All counts come from the RLS-intersected set; integration two-org test. |
| Cross-org `p_document_ids` | Elevation | The DEFINER RPC re-applies `current_user_org_ids()` + visibility; integration test passes org-B ids as org-A user → 0 rows. |
| PUBLIC/anon EXECUTE on recreated DEFINER RPC | Elevation | Explicit `REVOKE … FROM PUBLIC, anon`; `has_function_privilege` check; `get_advisors(security)` (cloud: free MCP read). |
| Overload ambiguity → every search fails | DoS | DROP old signatures; one-signature assertion. |
| Unbounded scan (huge set / iterative walk) | DoS | `p_exact_max_chunks` threshold; `hnsw.max_scan_tuples` 20000 (existing); `_fetch_all` truncation raise; relaxed threshold avoids threshold-driven walks. |
| Prompt injection in a retrieved document ("ignore the filter, search everything") | Tampering | D-09 structural lock on `search_documents`; prompt rule for other tools (Pitfall 13). |
| GUC name injection | Tampering | Reuse `apply_hnsw_session_knobs` (literal name, enum-checked value). |
| Service-role step 1 reading other orgs' rows | Info disclosure | Bounded by `org_id IN caller_orgs` (fail-closed), and never exposed: only step-2 ids and counts leave the resolver. |

## Hot-file ledger (G-5) — measured with `node scripts/check-hot-file-ledger.cjs --files …`

| File | commits / phases / lines (re-derived) | Ledger status | Phase action |
|---|---|---|---|
| `backend/app/services/retrieval_service.py` | 19 / 11 / 456 | FIRES; extraction OWED | **Extraction = Plan 1** (discharges SEED-224 obligation). Update the in-file G-5 sentence. |
| `backend/app/services/tool_dispatcher.py` | 93 / 40 / 5234 | FIRES; split OWED (→273) | Narrow cut (D-15): handler out, one registry line + ToolContext field. |
| `backend/app/services/agent_loop.py` | 58 / 28 / 3591 | FIRES; prompt seam OWED (→273) | Honoured by construction: date line, guidance rewrite, accumulator init + 2 ctx kwargs, one vocabulary line. ⚠ D-16's "~10 lines" will be closer to 15-20; record the count. |
| `backend/app/services/openai_service.py` | 74 / 37 / 2372 | ⚠ **No scan-list row** (a detail section exists at `HOT-FILE-LEDGER.md:16392`, but the gate reads the scan list: drift) | Add the scan-list row (FIRES); schema edit honoured by construction. |
| `backend/app/services/task_service.py` | 20 / 11 / 970 | FIRES | One kwarg (share the D-09 set). |
| `backend/app/services/retrieval_tuning.py` | 4 / 2 / 364 | row present | Likely untouched (reused). |
| `backend/app/services/document_view_resolver.py` | 4 / 4 / 403 | row present | Prefer untouched (import only). |
| `backend/app/services/view_filter_compiler.py` | 5 / 4 / 288 | row present | Prefer untouched. |
| `backend/app/services/document_search_service.py` | 3 / 1 / 580 | row present | Import `_apply_dates`/`_fetch_all` only. ⚠ `test_271_no_embedding.py` forbids it importing retrieval: keep the dependency direction retrieval → find. |
| `backend/app/models/document_view.py` | 5 / 3 / 110 | ⚠ **No row** | Only if touched (prefer not). |
| `backend/app/services/metadata_field_service.py` | 2 / 2 / 127 | ⚠ **No row** | Only if touched (prefer not). |
| `backend/app/services/google_service.py` | 11 / 7 / 638 | ⚠ **No row** (FIRES at 7 phases) | Prefer untouched (the schema is designed to need no sanitizer change). |
| `backend/app/config.py` | 89 / 51 / 1695 | FIRES | Only the stale ef_search comment, if fixed. |
| `backend/app/api/knowledge_health.py` | 13 / 6 / 987 | FIRES | Only if Open Question 2 is taken. |
| `frontend/src/lib/toolMeta.ts` | 10 / 6 / 218 | FIRES | Add `searchFilterLine` (one home for labels). |
| `frontend/src/components/chat/ToolCallPanel.tsx` | 53 / 21 / 392 | G-5 DISCHARGED (227-02) | One line element. |
| `frontend/src/components/chat/StepRow.tsx` / `ToolCallDetails.tsx` / `tool-bodies/SearchDocumentsBody.tsx` | 2/1/249 · 2/1/171 · 2/2/50 | ⚠ **No rows** | Only if touched (prefer rendering in ToolCallPanel). |
| `scripts/full-schema-supplement.sql` | 15 / 10 / 690 | FIRES (`scripts/` is gate-exempt) | Signature literals. |
| **NEW** `retrieval_rpc.py`, `retrieval_rank.py`, `retrieval_documents.py`, `retrieval_scope.py`, `search_documents_tool.py` | — | — | Rows **at creation**, in `docs/HOT-FILE-LEDGER.md` only (CLAUDE.md is at the warn band). |

## Recommended Plan Breakdown (G-8: 5 plans, 4 waves)

| Plan | Wave | Scope | files_modified (expected) | Notes |
|---|---|---|---|---|
| **272-01 Extractions (pure moves + seam stub)** | 1 | D-13 split of `retrieval_service.py` + `RetrievalScope`/`DEFAULT_PREDICATES` data stub (no behaviour); D-15 handler move to `search_documents_tool.py` (byte-identical behaviour); retarget the 8+3 test files; retire `test_246` fence; retarget/re-drive `test_241` fences; ledger rows at creation | `backend/app/services/retrieval_service.py`, `retrieval_rpc.py`(new), `retrieval_rank.py`(new), `retrieval_documents.py`(new), `retrieval_scope.py`(new), `search_documents_tool.py`(new), `tool_dispatcher.py`, tests listed in Pattern 1, `docs/HOT-FILE-LEDGER.md` | TDD: AST-equality + characterization RED first. Baseline must stay at ≤ 71 failed. |
| **272-04 Tool-card filter line** | 1 (parallel) | D-08 `searchFilterLine` from args; render in ToolCallPanel; tests adopted into both count-gate knobs | `frontend/src/lib/toolMeta.ts`, `frontend/src/components/chat/ToolCallPanel.tsx`, `frontend/src/lib/__tests__/toolMeta.test.ts`, `frontend/src/__tests__/components/ToolCallPanel.test.tsx`, `scripts/vitest-count-gate.cjs`, `docs/HOT-FILE-LEDGER.md` | The args contract (Pattern 4 shape) is fixed by this research. |
| **272-02 Migration 200 + filter→scope resolver** | 2 | Pre-design spike on `recall_bench` (EXPLAIN the candidate exact SQL); migration 200; regenerate `full-schema.sql`; supplement signatures; `resolve_document_scope` (two-step RLS, undated count, nearby values, D-18/D-19/D-20 mechanics); both arms take `p_document_ids`; filtered `iterative_scan` + `p_exact_max_chunks` constants (provisional) | `supabase/migrations/200_*.sql`, `supabase/full-schema.sql`, `scripts/full-schema-supplement.sql`, `retrieval_scope.py`, `retrieval_rpc.py`, `retrieval_service.py`, `tests/integration/test_272_*.py`, `tests/unit/test_272_*` | **Serialize** (mutates local DB). Paste the migration into the SQL editor; never `db push`. |
| **272-03 Tool contract: schema, kinds, lock, audit, prompt, date** | 3 | `filters` schema + per-request vocabulary; arg model; D-04 refusal; D-20 canonicalisation; kinds 1/2/2b/3/refused; D-10 relaxation; D-11 reply; D-09 accumulator (ToolContext field, both agent_loop builds, task_service share); audit keys; D-07 date; prompt rewrite (remove `:703` and openai_service guidance; filtered-empty overrides the hybrid fallback) | `openai_service.py`, `search_documents_tool.py`, `tool_dispatcher.py` (ToolContext field), `agent_loop.py`, `task_service.py`, unit tests, `docs/HOT-FILE-LEDGER.md` | Depends on 02's resolver API. |
| **272-05 Measure, board, G-4** | 4 | Rebuild `recall_bench`; SEED-273 ladder (exact T ∈ {500..10000}; iterative strict/relaxed × ef 40/60/80/100) with body-SQL EXPLAIN (custom **and** generic plan) at every point; set T + scan mode; fix the stale config comment; SC#10 8-row × 3-prompt board; G-4 scenarios 1-3 in Chrome MCP; seed + ledger status updates (SEED-273, SEED-153 partial) | constants in `retrieval_scope.py`/`retrieval_rpc.py`, `backend/app/config.py` (comment), `272-VALIDATION.md`/UAT log, seeds | Board rows live in VALIDATION.md, not PLAN tasks (CLAUDE.md UAT recipe). |

## Sources

### Primary (HIGH confidence)
- Codebase at HEAD `3ed034acc`: `retrieval_service.py`, `tool_dispatcher.py:105-197,780-975,4719-4758,5199-5234`, `agent_loop.py:79,681-760,1468-1490,1745-1790,2096-2160,3015-3160`, `openai_service.py:16-52,100-185,1116-1170`, `google_service.py:243-340`, `provider_gateway/openai_responses.py:198-260`, `document_view_resolver.py`, `view_filter_compiler.py`, `view_operators_extra.py`, `document_search_service.py`, `models/document_search.py`, `models/document_view.py`, `expert_scope.py`, `retrieval_tuning.py`, `recall_eval.py`, `dependencies.py:20-30,155-230`, `folder_utils.py:130-294`, frontend `ToolCallPanel.tsx`, `ToolCallDetails.tsx`, `toolMeta.ts`, `StepRow.tsx`.
- Migrations 033, 036, 074, 154, 170, 181, 199; `scripts/full-schema-supplement.sql:636-644`.
- Live local DB probes (PG 17.6, pgvector 0.8.0, indexes, `recall_bench` 100k/3,850, `date_typed` 37/208).
- `node scripts/check-hot-file-ledger.cjs --files …` (7 `[no-row]`); `node scripts/check-claude-md-size.cjs` (119,524 chars).
- pgvector README: https://github.com/pgvector/pgvector (iterative scans, exact search, index-use conditions).
- `.planning/milestones/v4.1-phases/246-…/246-VERIFICATION-DATA.md`; `SEED-273`; `SEED-153`; commit `521f4a025`.
- `.planning/milestones/v3.0-phases/115-virtual-folders-agent-tool/115-HUMAN-UAT.md` (8/8 schema survival).

### Secondary (MEDIUM confidence)
- OpenAI, Migrate to Responses (strict default): https://developers.openai.com/api/docs/guides/migrate-to-responses
- Anthropic, Define tools: https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools
- Google Gemini, Function calling: https://ai.google.dev/gemini-api/docs/function-calling
- Kimi API, Tool calls: https://platform.kimi.ai/docs/guide/use-kimi-api-to-complete-tool-calls

### Tertiary (LOW confidence)
- DeepSeek / Zhipu / MiniMax per-provider schema limits: not fetched; relying on 115's live evidence (A3).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH (everything is in-repo and measured).
- Architecture: HIGH for the moves, RLS two-step and import cycle (all measured); MEDIUM for exact-vs-index threshold behaviour (mechanism documented, number unmeasured).
- Pitfalls: HIGH (each tied to a file/line or a prior incident).
- Provider emission: MEDIUM (schema survival proven at 115; nested-filter emission unproven for 7/8 → SC#10).

**Research date:** 2026-10-03
**Valid until:** 2026-10-17 (fast-moving hot files; re-derive the ledger triples and the CLAUDE.md size at plan time).
