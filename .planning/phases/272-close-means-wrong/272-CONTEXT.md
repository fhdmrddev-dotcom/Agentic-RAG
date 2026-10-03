# Phase 272: Close Means Wrong - Context

**Gathered:** 2026-10-03
**Status:** Ready for planning

<domain>
## Phase Boundary

When a chat question names a **period** or a **dimension value** (legal entity, document type, any
field in the org's field list), the agent's `search_documents` call carries that as a **structured
filter**, and both retrieval arms (vector and keyword) honour it. When the filter matches nothing,
the agent **says so**, cites nothing from outside it, and **cannot** fall back to an unfiltered
search in the same turn. A filter that matches documents returns them, measured against the
SEED-273 recall cliff. The behaviour holds across the 8-row SC#10 board.

Requirement: **FIND-07** only. ⛔ Out of scope by roadmap: SEED-153's workflow-input → filter binding
and the publish-gauntlet gate (see `<deferred>`). The tool count stays **29**: widen
`search_documents`, never add a tool.

</domain>

<decisions>
## Implementation Decisions

### Who decides close-means-wrong (SEED-153 open question 2: ANSWERED)
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

### Which date "October" means
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

### How strict the empty result is (SC#2)
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

### Refactor scope (G-5) and recall
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

### Binding invariants (from the scout; research must keep them)
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

### Resolved at planning (272-RESEARCH.md open questions; operator delegated, 2026-10-03)
- **D-21:** **The document set is resolved in two steps** (research finding 1). In a chat run
  `ctx.supabase` uses the service role, which skips row-level security.
  1. The 271 compiler reads candidate ids **limited to the caller's organisations**.
  2. Those ids are **re-read through the per-user connection** (`get_user_pg_connection`), where
     the `documents` RLS policy (migration 154) decides what is visible.

  A count or document set computed through the service role alone is a cross-org leak and is
  forbidden. ⛔ Do **not** use Find's own/global-folder visibility rule for this: it drops
  connection documents that are shared with the organisation.
- **D-22:** **The prompt rewrite covers the other retrieval tools**, and the board checks every tool
  call. The D-09 lock refuses only `search_documents`, and today's *"do not stop on zero results"*
  rules send the agent on to `grep` / `query_documents` / `read_document`. Those rules are rewritten
  for the filtered-empty case, so the agent does not reach for another retrieval tool to answer
  outside the filter. Board prompt (c) fails a row if **any** tool call in that run retrieves
  content from outside the filter, not only a `search_documents` call. This is accepted as a known
  limit of D-09 (`grep`/`query_documents` are not structurally locked) and recorded, not hidden.
- **D-23:** **The per-request vocabulary lists the caller's top `document_type` values**, capped at
  15, beside the field list (D-02).
- **D-24:** **The Library trend no longer counts refused searches as "found nothing."** Result kinds
  (3) invalid filter and lock-refused calls are excluded from `knowledge_health.py`'s "found
  nothing" count (a one-line, honoured-by-construction change). Kind (2), matched 0 documents, still
  counts.
- **D-25:** **"Matched, but nothing searchable yet" is a sub-reason of kind (2), not a fifth kind.**
  Documents matched the filter but have no chunks yet (still ingesting). The result says so in its
  reason string, and the four kinds of D-12 stay four.
- **D-26:** **D-02's "the org's fields" is clarified.** Field definitions are visible **per user
  (their own plus system-global)**, not per organisation. The vocabulary uses that existing
  visibility rule unchanged, and no new organisation-level scoping is added in this phase.

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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirement and roadmap
- `.planning/ROADMAP.md` §"Phase 272: Close Means Wrong": goal, SC#1-4, "How we'd know this failed", Flags
- `.planning/REQUIREMENTS.md`: FIND-07

### Seeds
- `.planning/seeds/SEED-153-close-means-wrong-dimensions-must-be-filters.md`: the contract (structured filter, fail-closed, freshness is NOT this). Folded, partial.
- `.planning/seeds/SEED-273-hnsw-iterative-scan-cost-inflection-and-recall-cliff.md`: the recall cliff and the mandatory EXPLAIN checklist. Folded.
- `.planning/seeds/SEED-076-filtered-vector-search-recall-pgvector-index-scale.md`: prior recall levers (partially shipped at 241); lever 4 is still deferred
- `.planning/milestones/v4.0-phases/241-recall-at-corpus-scale/241-VALIDATION.md`: the measurements that SEED-273 says are suspect
- `.planning/phases/246-the-recall-cliff-and-the-screen-that-describes-it/246-VERIFICATION-DATA.md`: the empirical ladder (the path may sit under `.planning/milestones/` after archiving)

### Prior phase decisions
- `.planning/phases/271-find-the-document/271-CONTEXT.md`: Find's vocabulary, the shared compiler, the typed columns
- `.planning/phases/271-find-the-document/271-RESEARCH.md`: how `validate_and_compile` / `apply_fragments` were extracted

### Guardrails and contracts
- `docs/HOT-FILE-LEDGER.md` §`backend/app/services/retrieval_service.py`: the owed extraction, and why the 241 landing stayed three lines
- `docs/HOT-FILE-LEDGER.md` §`backend/app/services/tool_dispatcher.py`, §`backend/app/services/agent_loop.py`: owed seams (D-15/D-16)
- `docs/EXTENSION-CONTRACT.md`: tools are a closed core; widen arguments, never add a tool
- `.planning/seeds/SEED-034-system-prompt-cross-provider-tool-use.md`: provider-docs-first for tool use
- `CLAUDE.md` §"UAT scoreboard recipe": the 8-row roster rule (D-17)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/services/document_view_resolver.py`: `validate_and_compile:170` (whitelist = built-ins ∪ source facts ∪ enabled custom defs, via `_build_field_meta:144`), `apply_fragments:216`, `_relative_window:78`. **Already shared by Find and `query_documents_by_view`.** It emits PostgREST builder calls on `documents`, which is exactly the D-14 "resolve to a document set" step.
- `backend/app/services/view_filter_compiler.py`: `compile_filter:186`, `validate_operands:225`, `validate_fields:274`, `OPERATOR_REGISTRY:133`, `PROMOTED_TYPED_COLUMNS:68`.
- `backend/app/models/document_view.py:42-54`: the `ViewCondition.op` vocabulary (eq, gte, lte, one_of, contains, is_empty, within_next, older_than, before, after, between).
- `backend/app/models/document_search.py:65-171`: `FindDate` (`which` ∈ added/source_created/source_modified), and the `_DATE_COLUMN` map at `document_search_service.py:97-101`.
- `backend/app/services/retrieval_tuning.py:188-282`: `apply_hnsw_session_knobs` (the GUC name is a literal, the value is a bind parameter; each GUC sits in its own `try`).
- `backend/app/services/metadata_field_service.py:34`: `list_field_definitions` feeds the D-02 per-request vocabulary.

### Established Patterns
- The tool schema is `SEARCH_DOCUMENTS_TOOL` at `openai_service.py:16-52` (first entry in `get_tools()`, about `:1116`). Dispatch is at `tool_dispatcher.py:780-788`.
- Hybrid retrieval: vector (`match_document_chunks`) then keyword (`keyword_search_chunks`), **sequential**, then RRF, dedup, optional rerank and enrich (`retrieval_service.py:384-456`). The latest RPC SQL is `supabase/migrations/170_documents_source_state.sql:48-120`; both take `metadata_filter jsonb` (`@>`) and `p_folder_ids uuid[]`, and **neither takes a date**.
- HNSW knobs apply on the vector arm only (`_call_as_user`, `retrieval_service.py:72-76`). ⚠ `config.py:1128`'s comment says ef_search was raised to 200, but the code at `:1130` reads `40`. Research must reconcile that before measuring.
- Audit: `write_audit_entry` → `audit_log` `action_type="search.query"` (`tool_dispatcher.py:951-968` success, `:837-851` provider error). Readers: `knowledge_health.py`, `document_queries.py`, `api/audit.py`. **Adding keys must not break those readers.**
- Tool count is **29** (`_TOOL_REGISTRY`, `tool_dispatcher.py:4721-4758`), pinned by `test_259_closed_core_inventory.py:40,113` and `test_261_closed_core_inventory.py:41`. The `get_tools()` count is pinned at `test_085_tool_registration.py:280,289`. All of them stay green unchanged.

### Integration Points
- The frontend tool-card line (D-08): `frontend/src/lib/toolMeta.ts` (the `search_documents` labels at `:10, :62, :201`) and the card that renders tool args (`ToolCallPanel.tsx`, G-5 DISCHARGED at 227-02). Load `Skill("sketch-findings-agentic-rag")` before touching the card.
- Migration `200` (if D-14 needs RPC changes) must ship to production **before** the backend (deploy parity).

</code_context>

<specifics>
## Specific Ideas

### G-4 lived-experience scenarios (drafted at scope time; the operator edits before planning closes)
1. **"October revenue" with October and March reports in the KB:** the answer states *October 2025*, every citation chip opens an October document, and the tool card shows *"Filtered: document date 1–31 Oct 2025"* as visible text. **I'd recognise failure if** a March figure appears, or the card shows no filter line.
2. **"Revenue for Acme GmbH in July" where July has no documents:** the agent says nothing matched July for Acme GmbH, may name the months that exist, and shows **no** citations. **I'd recognise failure if** it answers with any number, or a second search card appears without the filter.
3. **"Revenue for Acme Gmbh" (wrong case or spelling):** the agent corrects itself to the real value and answers, or asks which entity was meant. **I'd recognise failure if** it says "no documents" for an entity that exists.

### Reply shape
- *"No documents matched October 2025. Reports exist for September and November — use one?"* (D-11)

</specifics>

<deferred>
## Deferred Ideas

- **SEED-153 workflow-input → retrieval-filter binding:** a launch-form input bound to a phase's filter. Not in FIND-07 (roadmap). The seed stays `partial: true`.
- **SEED-153 publish-gauntlet gate:** a workflow that reads a period without binding it to a filter is unpublishable. Not in FIND-07. Trigger: the next phase on the harness/publish gauntlet or recurring-report workflows.
- **SEED-153 citation post-gate:** asserting every cited source falls inside the window. In chat this holds **by construction** (only filtered passages can be cited). A separate post-gate belongs with the workflow binding above.
- **Admin "must filter" field flag:** rejected for now (D-01). Revisit if the SC#10 board shows a provider that will not emit filters reliably.
- **`tool_dispatcher.py` full registry/handler split and the `agent_loop.py` prompt-assembly seam:** both still OWED, flagged for **Phase 273** (D-15/D-16).
- **Enabling `hnsw.iterative_scan` globally for unfiltered search:** not this phase (D-14 changes filtered search only).

### Reviewed Todos (not folded)
- `spike-nl-workflow-authoring.md` (score 0.6): matched on generic keywords (date, schema); it is about NL workflow authoring, not retrieval filters. Out of scope.

### Reviewed reported bugs
- No open `surface: Agentic-RAG` report has `affected_areas` overlapping chat retrieval (swept 2026-10-03).

</deferred>

---

*Phase: 272-close-means-wrong*
*Context gathered: 2026-10-03*
