# Phase 278: One Home for Tools and Filters - Context

**Gathered:** 2026-10-13
**Status:** Ready for planning

<domain>
## Phase Boundary

A **behaviour-preserving G-5 extraction phase** with three parts:

1. **SEAM-03:** split `backend/app/services/tool_dispatcher.py` (98 commits / 43 phases / 5,068 lines, FIRES) into a registry module and handler modules. The closed core stays at **30 tools**.
2. **SEAM-02:** measure `backend/app/services/retrieval_service.py`'s seam and close the record. It was measured at this discuss as **already discharged** (see D-09).
3. **DEBT-09:** give the date-word → column map and the topics-is-a-list rule **one home** each, imported by `retrieval_scope.py`, `document_search_service.py` and `view_filter_compiler.py`, with a divergence fence driven RED.

Every tool, search and filter behaves exactly as before. No new capability, no schema change, no migration.
Roadmap success criteria SC#1-SC#5 are the acceptance bar and are not restated here.

</domain>

<decisions>
## Implementation Decisions

### Dispatcher split shape (SEAM-03)
- **D-01:** Handlers move into a new package **`backend/app/services/tools/`**, grouped **by family**: documents/KB browse (ls, tree, grep, glob, read_document, fetch_document_file, query_documents, query_documents_by_view, get_related_documents, analyze_document, web_search), skills (load_skill, save_skill, read_skill_file, attach_skill_file), sandbox (execute_code + hydration + runtime-gap classification + autoheal, ≈1,400 L), render_template (driver source + handler, ≈760 L), workspace (5 tools), memory/tables (remember, recall, query_tables), agent-control (task, write_todos, ask_user), connector chat tool. About 8 modules. The exact module boundaries and helper placement are the planner's call, within "by family".
- **D-02:** **Everything moves in this phase.** All 30 handlers and their private helpers leave `tool_dispatcher.py`. This is the third time the split is proposed (OV-273-02 deferred it twice). A partial move is not acceptable.
- **D-03:** **`tool_dispatcher.py` stays the registry module.** After the split it holds the static `_TOOL_REGISTRY` dict literal (30 entries, same order), the capability gate (`_CAPABILITY_FLAG_TOOLS` / `_capability_disabled_message`), refusal audit, and `dispatch_tool`. Importers keep importing from the same module. No separate `tool_registry.py`.
- **D-04:** `ToolContext` / `ToolResult` (imported by ~39 sites) move to a leaf module the handlers can import without a cycle, and are **re-exported from `tool_dispatcher.py`** so every existing importer keeps working. Same re-export pattern as 272-01 (`retrieval_service.py` back-compat block).
- **D-05 (Extension Contract):** the registry stays a **static dict literal**, never built by mutation, decorator registration or import-time side effects. Its order must not depend on import order. `search_documents_tool.py` (measured **1,506 lines**, not the roadmap's 1,163) and `show_artifact_tool.py` stay where they are and gain no logic.

### Tests during the move
- **D-06:** Test edits are allowed **only to retarget patch targets and imports**, in the same commit as the move. Re-exports cannot keep string patches working: patching `app.services.tool_dispatcher.aexec` no longer reaches a handler that resolves `aexec` from `tools/sandbox.py` (patch-where-used). Measured: **68 string patch targets in 13 test files** (top: `sandbox_manager` ×10, `aexec` ×9, `write_audit_entry` ×4), plus any `monkeypatch.setattr(td, ...)` object forms the researcher must count.
- **D-07:** A **mechanical diff check** proves D-06: over the move commit(s), every changed test line is a patch-target string or an import line, and **zero `assert` lines change**. This answers the roadmap failure mode *"a moved handler changes behaviour and a test edited in the same commit hides it"*.
- **D-08:** The **19 tests that read `tool_dispatcher.py` source text** (AST/source fences) are **repointed to the specific file the code now lives in**, and each must first **assert it found its anchor** (function name or string) before asserting anything else. A fence scanning a file that no longer holds its code must fail, never pass vacuously. Scanning the whole package was rejected: a fence meant for one handler would pass if any file matched.

### Pure-move proof (planner detail, decided here)
- Pins land **first, RED-proof, before the move** (TDD pin-first, roadmap Flags):
  - **Registry pin:** tool names, order and full schema text taken at PHASE_BASE, compared identical after. Schema text comes from `openai_service.get_tools()` (not modified by this phase).
  - **AST pin:** every moved function/class is AST-identical to its PHASE_BASE source (the `test_272_pure_move.py::test_moved_functions_are_ast_identical` pattern, `git show <base>:<path>`).
  - `test_259_closed_core_inventory.py` stays the 30-tool count (len of the dict, not a substring match). Its source-scan for expert handlers must be repointed per D-08 so it still scans every handler file.

### Retrieval seam verdict (SEAM-02)
- **D-09:** **Confirm discharge only; no code change.** Measured at this discuss (2026-10-13): `retrieval_service.py` is **174 lines**, one function (`search_documents`, the orchestrator), and its header records the 272-01 pure move into `retrieval_rpc.py` (242 L) / `retrieval_rank.py` (161 L) / `retrieval_documents.py` (206 L), with filtered retrieval in `retrieval_scope.py` (464 L). Proof is `test_272_pure_move.py` run green at the phase base.
- **D-10:** The **7 back-compat re-exports stay.** Retiring them would repoint 6 importers including `agent_loop.py` (FIRING, 31 phases) for no behaviour gain.
- **D-11:** Correct the stale records **beside their originals** (strike through, never delete): the CLAUDE.md row (`retrieval_service.py … ⛔ extraction still OWED (SEED-224, since 231)`), its `docs/HOT-FILE-LEDGER.md` section in the same commit, and SEED-224's G-5 table row (`17 / 9 / 362 FIRES`, section 4). SEED-224 routing is recorded now (folded, partial) and flipped to `partially-answered` when 278 ships; the five-tab redesign half stays open.

### Vocabulary home + divergence fence (DEBT-09)
- **D-12:** Measured drift: the date map exists **twice and already differs**. `retrieval_scope.py:141` `_DATE_FIELD_COLUMN` has 4 entries (adds `"date": "date_typed"`); `document_search_service.py:97` `_DATE_COLUMN` has 3. The topics rule exists twice: `retrieval_scope.LIST_FIELDS` (tuple, `:182`) and `view_filter_compiler.LIST_VALUE_FIELDS` (frozenset, `:101`). The home holds the **3 timestamptz words** (`added`, `source_created`, `source_modified`) and the list-field set. `retrieval_scope.py` keeps its `date → date_typed` entry as an explicit, named extension of the imported map, so each module's behaviour is byte-for-byte unchanged.
- **D-13:** The home is a **new leaf module** with no app imports (name is the planner's call, e.g. `backend/app/services/document_vocabulary.py`). Not a fourth copy: the old definitions are **deleted** and replaced by imports in the same commit.
- **D-14:** The fence covers the **3 backend files** DEBT-09 names, plus any other backend module that redefines the map or the list-field set. It is **driven RED against a planted divergent copy, then restored** (SC#3). The frontend (`frontend/src/pages/findState.ts`) holds only the 3-word TypeScript type (the wire contract), not a word→column map, and is out of scope.

### Claude's Discretion
- **SC#5 live smoke:** one two-tool chat turn (`search_documents` + `execute_code`) on **Anthropic** (native SDK), checking `search.query` audit rows carry `run_id`. One provider row is proportionate for a pure move whose registry pin is identical (SC#10 decision recorded in the roadmap Flags). The operator starts the backend.
- Vocabulary module name and exact handler-module boundaries within D-01.
- **Plan count 3-4** (G-8): (1) registry pin + AST pin + split, (2) retrieval seam confirm + record corrections, (3) vocabulary home + divergence fence, (4) merged-tree gates + live smoke. Plans 2 and 3 do not touch `tool_dispatcher.py` and can run in parallel worktrees.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope
- `.planning/ROADMAP.md` § "Phase 278: One Home for Tools and Filters": SC#1-SC#5, failure conditions, Flags
- `.planning/REQUIREMENTS.md`: SEAM-02, SEAM-03, DEBT-09 (W-3)
- `.planning/milestones/v4.5-STATE-at-close.md` row OV-273-02: the two prior deferrals of the split

### Contracts the split must honour
- `docs/EXTENSION-CONTRACT.md`: the registry is closed and statically declared, never dynamically registered
- `docs/HOT-FILE-LEDGER.md` sections for `backend/app/services/tool_dispatcher.py`, `backend/app/services/retrieval_service.py`, `backend/app/services/agent_loop.py`: named seams, binding invariants. Same-commit sync rule with the CLAUDE.md scan table
- `CLAUDE.md` § Workflow guardrails (G-5, G-8) and § hot-file ledger FIRING table (80-char cell cap)

### Precedent and pins
- `backend/tests/unit/test_272_pure_move.py`: the AST-identical pure-move pattern, the back-compat-names pin, `test_unfiltered_rpc_calls_are_pinned`
- `backend/tests/unit/test_259_closed_core_inventory.py`: the 30-tool closed-core count
- `.planning/milestones/v4.5-phases/272-*/`: the 272-01 split record (D-13)
- `.planning/milestones/v4.5-phases/273-*/273-CONTEXT.md` D-14: the narrow `show_artifact_tool.py` cut

### Seeds
- `.planning/seeds/SEED-224-document-space-redesign-five-tab-rag-honesty.md`: extraction half folded here (section 4 G-5 table is the stale record)
- `.planning/seeds/SEED-336-find-and-views-relative-dates-narrow-the-document-date.md`: deferred (see deferred)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `test_272_pure_move.py`: copy its `git show <base>:<path>` → AST compare shape for the dispatcher pin.
- `retrieval_service.py` back-compat re-export block: the template for D-04's `ToolContext`/`ToolResult` re-exports and its "a PATCH here no longer reaches the caller" warning comment.
- `search_documents_tool.py` / `show_artifact_tool.py`: existing out-of-file handlers that the registry already imports; they show the import direction the new package must follow.

### Established Patterns
- `_TOOL_REGISTRY` (`tool_dispatcher.py:4553`) is already a **static dict literal**. The split must keep it one.
- Schemas are not in the dispatcher: `openai_service.get_tools()` (`openai_service.py:1310`) builds them. The registry pin reads both.
- Mirrors of the closed-registry pattern (`harness/programmatic.py`, `harness/validators.py`, `harness/emitters.py`) cite `tool_dispatcher._TOOL_REGISTRY` by name in docstrings. The name and module must not change (D-03).
- Importer counts (measured): `ToolResult` 39, `ToolContext` 37, `dispatch_tool` 15, `_TOOL_REGISTRY` 13, `_handle_task` 13, `_handle_ask_user` 12, `_handle_query_documents_by_view` 11. Private handler names imported by tests also need re-exports or retargeting under D-06.

### Integration Points
- `dispatch_tool` is referenced by `api/threads.py`, `services/agent_loop.py`, `services/harness/phase_types.py`, `services/task_service.py` and `models/harness.py` (measured). All are hot files and must not be modified.
- The vocabulary home is imported by `retrieval_scope.py` (`retrieval_scope` lives under 272's seam), `document_search_service.py` (Find, Phase 271) and `view_filter_compiler.py` (saved Views, Phase 114).

</code_context>

<specifics>
## Specific Ideas

- **Measured, not quoted:** `search_documents_tool.py` is 1,506 lines today. The roadmap's 1,163 is stale. Re-derive every triple before editing a ledger row.
- The divergence fence must fail on a **planted** copy. A fence that passes against a planted divergence is the roadmap's named failure.

</specifics>

<deferred>
## Deferred Ideas

- **SEED-336** (relative-date condition on a custom date field filters on the document date): its trigger fires on `view_filter_compiler.py` / `document_search_service.py`. **Deferred.** Fixing it changes what existing saved Views return, which breaks SC#4. Re-open: the first phase allowed to change Find/Views results. The single vocabulary home makes that fix a one-place change.
- **Retiring `retrieval_service.py`'s 7 back-compat re-exports:** rejected for this phase (D-10). Natural moment: the next phase that already modifies `agent_loop.py`'s imports.
- **Cross-language vocabulary fence** (backend home ↔ `findState.ts` word type): out of DEBT-09's wording.
- **SEED-224 five-tab redesign:** stays open; only its extraction half is in 278.

### Reviewed Todos (not folded)
- `spike-nl-workflow-authoring.md` (NL→workflow authoring spike): matched on generic keywords only (run, date, first, move, before). Unrelated to the dispatcher or filter vocabulary.

</deferred>

---

*Phase: 278-one-home-for-tools-and-filters*
*Context gathered: 2026-10-13*
