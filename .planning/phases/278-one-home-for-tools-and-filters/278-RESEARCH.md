# Phase 278: One Home for Tools and Filters - Research

**Researched:** 2026-10-13
**Domain:** Behaviour-preserving Python module extraction (G-5), test patch-target retargeting, import-cycle safety, single-source vocabulary + divergence fences
**Confidence:** HIGH (every claim below was measured at `25b4235c5` with AST scripts, greps, fresh-interpreter import probes and real pytest runs; no external libraries are involved)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Dispatcher split shape (SEAM-03)
- **D-01:** Handlers move into a new package **`backend/app/services/tools/`**, grouped **by family**: documents/KB browse (ls, tree, grep, glob, read_document, fetch_document_file, query_documents, query_documents_by_view, get_related_documents, analyze_document, web_search), skills (load_skill, save_skill, read_skill_file, attach_skill_file), sandbox (execute_code + hydration + runtime-gap classification + autoheal, ≈1,400 L), render_template (driver source + handler, ≈760 L), workspace (5 tools), memory/tables (remember, recall, query_tables), agent-control (task, write_todos, ask_user), connector chat tool. About 8 modules. The exact module boundaries and helper placement are the planner's call, within "by family".
- **D-02:** **Everything moves in this phase.** All 30 handlers and their private helpers leave `tool_dispatcher.py`. This is the third time the split is proposed (OV-273-02 deferred it twice). A partial move is not acceptable.
- **D-03:** **`tool_dispatcher.py` stays the registry module.** After the split it holds the static `_TOOL_REGISTRY` dict literal (30 entries, same order), the capability gate (`_CAPABILITY_FLAG_TOOLS` / `_capability_disabled_message`), refusal audit, and `dispatch_tool`. Importers keep importing from the same module. No separate `tool_registry.py`.
- **D-04:** `ToolContext` / `ToolResult` (imported by ~39 sites) move to a leaf module the handlers can import without a cycle, and are **re-exported from `tool_dispatcher.py`** so every existing importer keeps working. Same re-export pattern as 272-01 (`retrieval_service.py` back-compat block).
- **D-05 (Extension Contract):** the registry stays a **static dict literal**, never built by mutation, decorator registration or import-time side effects. Its order must not depend on import order. `search_documents_tool.py` (measured **1,506 lines**, not the roadmap's 1,163) and `show_artifact_tool.py` stay where they are and gain no logic.

#### Tests during the move
- **D-06:** Test edits are allowed **only to retarget patch targets and imports**, in the same commit as the move. Re-exports cannot keep string patches working: patching `app.services.tool_dispatcher.aexec` no longer reaches a handler that resolves `aexec` from `tools/sandbox.py` (patch-where-used). Measured: **68 string patch targets in 13 test files** (top: `sandbox_manager` ×10, `aexec` ×9, `write_audit_entry` ×4), plus any `monkeypatch.setattr(td, ...)` object forms the researcher must count.
- **D-07:** A **mechanical diff check** proves D-06: over the move commit(s), every changed test line is a patch-target string or an import line, and **zero `assert` lines change**. This answers the roadmap failure mode *"a moved handler changes behaviour and a test edited in the same commit hides it"*.
- **D-08:** The **19 tests that read `tool_dispatcher.py` source text** (AST/source fences) are **repointed to the specific file the code now lives in**, and each must first **assert it found its anchor** (function name or string) before asserting anything else. A fence scanning a file that no longer holds its code must fail, never pass vacuously. Scanning the whole package was rejected: a fence meant for one handler would pass if any file matched.

#### Pure-move proof (planner detail, decided here)
- Pins land **first, RED-proof, before the move** (TDD pin-first, roadmap Flags):
  - **Registry pin:** tool names, order and full schema text taken at PHASE_BASE, compared identical after. Schema text comes from `openai_service.get_tools()` (not modified by this phase).
  - **AST pin:** every moved function/class is AST-identical to its PHASE_BASE source (the `test_272_pure_move.py::test_moved_functions_are_ast_identical` pattern, `git show <base>:<path>`).
  - `test_259_closed_core_inventory.py` stays the 30-tool count (len of the dict, not a substring match). Its source-scan for expert handlers must be repointed per D-08 so it still scans every handler file.

#### Retrieval seam verdict (SEAM-02)
- **D-09:** **Confirm discharge only; no code change.** Measured at this discuss (2026-10-13): `retrieval_service.py` is **174 lines**, one function (`search_documents`, the orchestrator), and its header records the 272-01 pure move into `retrieval_rpc.py` (242 L) / `retrieval_rank.py` (161 L) / `retrieval_documents.py` (206 L), with filtered retrieval in `retrieval_scope.py` (464 L). Proof is `test_272_pure_move.py` run green at the phase base.
- **D-10:** The **7 back-compat re-exports stay.** Retiring them would repoint 6 importers including `agent_loop.py` (FIRING, 31 phases) for no behaviour gain.
- **D-11:** Correct the stale records **beside their originals** (strike through, never delete): the CLAUDE.md row (`retrieval_service.py … ⛔ extraction still OWED (SEED-224, since 231)`), its `docs/HOT-FILE-LEDGER.md` section in the same commit, and SEED-224's G-5 table row (`17 / 9 / 362 FIRES`, section 4). SEED-224 routing is recorded now (folded, partial) and flipped to `partially-answered` when 278 ships; the five-tab redesign half stays open.

#### Vocabulary home + divergence fence (DEBT-09)
- **D-12:** Measured drift: the date map exists **twice and already differs**. `retrieval_scope.py:141` `_DATE_FIELD_COLUMN` has 4 entries (adds `"date": "date_typed"`); `document_search_service.py:97` `_DATE_COLUMN` has 3. The topics rule exists twice: `retrieval_scope.LIST_FIELDS` (tuple, `:182`) and `view_filter_compiler.LIST_VALUE_FIELDS` (frozenset, `:101`). The home holds the **3 timestamptz words** (`added`, `source_created`, `source_modified`) and the list-field set. `retrieval_scope.py` keeps its `date → date_typed` entry as an explicit, named extension of the imported map, so each module's behaviour is byte-for-byte unchanged.
- **D-13:** The home is a **new leaf module** with no app imports (name is the planner's call, e.g. `backend/app/services/document_vocabulary.py`). Not a fourth copy: the old definitions are **deleted** and replaced by imports in the same commit.
- **D-14:** The fence covers the **3 backend files** DEBT-09 names, plus any other backend module that redefines the map or the list-field set. It is **driven RED against a planted divergent copy, then restored** (SC#3). The frontend (`frontend/src/pages/findState.ts`) holds only the 3-word TypeScript type (the wire contract), not a word→column map, and is out of scope.

### Claude's Discretion
- **SC#5 live smoke:** one two-tool chat turn (`search_documents` + `execute_code`) on **Anthropic** (native SDK), checking `search.query` audit rows carry `run_id`. One provider row is proportionate for a pure move whose registry pin is identical (SC#10 decision recorded in the roadmap Flags). The operator starts the backend.
- Vocabulary module name and exact handler-module boundaries within D-01.
- **Plan count 3-4** (G-8): (1) registry pin + AST pin + split, (2) retrieval seam confirm + record corrections, (3) vocabulary home + divergence fence, (4) merged-tree gates + live smoke. Plans 2 and 3 do not touch `tool_dispatcher.py` and can run in parallel worktrees.

### Deferred Ideas (OUT OF SCOPE)
- **SEED-336** (relative-date condition on a custom date field filters on the document date): its trigger fires on `view_filter_compiler.py` / `document_search_service.py`. **Deferred.** Fixing it changes what existing saved Views return, which breaks SC#4. Re-open: the first phase allowed to change Find/Views results. The single vocabulary home makes that fix a one-place change.
- **Retiring `retrieval_service.py`'s 7 back-compat re-exports:** rejected for this phase (D-10). Natural moment: the next phase that already modifies `agent_loop.py`'s imports.
- **Cross-language vocabulary fence** (backend home ↔ `findState.ts` word type): out of DEBT-09's wording.
- **SEED-224 five-tab redesign:** stays open; only its extraction half is in 278.
- Reviewed todo `spike-nl-workflow-authoring.md` — not folded (keyword-only match).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEAM-02 | `retrieval_service.py` is extracted along its named seam (SEED-224, owed since Phase 231). | Measured at `25b4235c5`: **23 / 12 / 174**, exactly one top-level def (`search_documents`, :62). `test_272_pure_move.py` = **9 passed** at base. Stale records located: CLAUDE.md:526, `docs/HOT-FILE-LEDGER.md:7935` section (the scan-list row at :11250 already says DISCHARGED), SEED-224 section-4 table row at line 97. §"SEAM-02" |
| SEAM-03 | `tool_dispatcher.py` is split into registry and handlers (OV-273-02); the closed core stays at 30 tools and the registry is pinned identical before and after. | Full 105-binding move map, cycle probe (0 handler-module imports pull `tool_dispatcher`), retarget inventory (38 string + 65 object patches + 34 imports + 27 attribute reads), 18 source fences (8 absence-type), registry/AST/static-literal pin designs, D-07 checker spec. §"Architecture Patterns", §"Test Retarget Inventory", §"Source-Fence Inventory", §"Pin Design" |
| DEBT-09 | Date-word→column map and topics-is-a-list rule each have one home, imported by `retrieval_scope.py`, `document_search_service.py`, `view_filter_compiler.py`; a test fails if they diverge. | Every backend copy enumerated (2 maps, 2 list-field sets, 4 word lists). Home contents, byte-identical import forms, two-layer fence (runtime identity + AST ban), RED-drive plants. §"DEBT-09" |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Python backend runs in `backend/venv`. Backend gate: `pytest tests/unit -q --continue-on-collection-errors` in `backend/` ≤ **71 failed, 0 collection errors** (zero headroom). Never weaken without operator authorisation.
- No LangChain/LangGraph; raw SDKs only (not touched here).
- Do not run blocking I/O directly in async handlers (`run_in_threadpool`) — moved handlers keep their existing wrappers byte-for-byte.
- **Extension Contract (Phase 255 / SEED-291):** the tool registry is closed and statically declared; never dynamically registered. `docs/EXTENSION-CONTRACT.md`.
- **G-5:** `tool_dispatcher.py` FIRES (98/43/5068). This phase IS the extraction. Every non-test source file in a plan's `files_modified` needs a scan-list row in `docs/HOT-FILE-LEDGER.md` (`node scripts/check-hot-file-ledger.cjs <phase-dir>`; `.claude/hooks/hot-file-ledger-guard.js` runs it when a PLAN.md is written). **New files need rows too** — the gate has no existence check (precedent: 273 added the `show_artifact_tool.py` row in its "create phase plan" commit `f76473497`).
- **Same-commit sync rule:** a CLAUDE.md FIRING-table row and its `docs/HOT-FILE-LEDGER.md` section change in the same commit. FIRING-table verdict cell ≤ **80** chars; scan-list disposition ≤ **200** chars. `node scripts/check-claude-md-size.cjs` (currently **89,480** chars, 59.7%, OK).
- **G-8:** 3-5 plans; never cut verifier / TDD RED drives / security review / migration discipline. Targeted suites per task, full gates once per wave.
- Worktrees: bootstrap first (`bash scripts/bootstrap-worktree.sh "$(pwd)"`), `GSD_VITEST_MAX_WORKERS=2`, teardown only via `scripts/teardown-worktree.sh`, serialize DB-mutating plans, dispatch worktree agents one message at a time.
- Local-DB lock file (`C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-localdb.lock`, noclobber) before a full backend baseline.
- `git checkout -- <dir>` is NOT a byte-restore on this box (autocrlf) — restore planted files from a backup copy and prove md5-identical.
- Corrections are written **beside** the original (strike-through), never by deletion.
- Frontend typecheck is `npx tsc -p tsconfig.app.json --noEmit` (not touched here). Vitest count gate: `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` from repo root.

## Summary

The dispatcher split is mechanically large but conceptually simple, and the measurements remove the main risks. All 105 top-level bindings of `tool_dispatcher.py` map cleanly onto 10 family modules plus the registry module (table below). A fresh-interpreter probe of **every** module the handlers import at module level shows **none** of them pulls `tool_dispatcher` in (only `document_view_resolver`, `task_service` and `document_search_service` do, and all three are already imported lazily inside functions). So the handler modules can import their dependencies at module level, and any of them can be imported first (as `mock.patch("app.services.tools.sandbox.X")` will do) without a partial-initialisation cycle. The one hard rule: no `tools/*.py` module may import `app.services.tool_dispatcher` at module level; they import `ToolContext`/`ToolResult` from the leaf module.

The test work is bigger than the discuss figures. Measured: **38** literal string patch targets in 12 files (not 68 in 13), **65** object-form patches (`monkeypatch.setattr(td, …)` / `patch.object(tool_dispatcher, …)`) in 14 files, **34** `from app.services.tool_dispatcher import <moved helper>` occurrences and **27** `td.<moved helper>` attribute reads. **98** test files mention `tool_dispatcher`, but the registry module keeps every handler name, so most need no edit. The key design move: `tool_dispatcher.py` must **stop importing** `aexec`, `sandbox_manager`, `write_audit_entry` etc. (it no longer uses them). Then every un-retargeted patch fails **loudly** with `AttributeError` instead of silently no-oping. Most retargets are **import-line-only**, because aliases are imported per test function and can be swapped to the family module. A few tests must **not** be retargeted: `test_emitters.py` ×3 and `test_llm_emit_executor.py:569` patch `td._handle_render_template`, which `harness/emitters.py` reads from `tool_dispatcher` at call time.

D-07 and D-08 collide unless sequenced. D-08's anchor asserts and the multi-file restructuring of fences are new `assert` lines, and D-07 forbids `assert` changes in the move commit. So they must land in a **pre-move hardening commit**, green at base and still pointing at `tool_dispatcher.py`. The move commit then changes only paths, module strings, aliases and import lines. Eight fences are **absence-type** and would pass vacuously after the move: `test_216`, `test_222`, `test_255`, `test_259`, `test_261`, `test_264_born_for_carrier`, `test_264_one_home`, and `test_275:483`. Four fences span **two** families (`test_264_load_skill_born_for` counts 4 resolver calls: 3 in skills, 1 in sandbox; `test_264_unchanged_sites_fenced`; `test_275:212`), so they need a file *tuple*, not a single repoint.

DEBT-09 is small. Two maps, two list-field sets and four word-list copies were found. A leaf `document_vocabulary.py` holding the 3-entry timestamptz map and `("topics",)` replaces both maps and both sets with byte-identical bindings. A two-layer fence then catches drift: a runtime identity/equality check in the 3 named modules, plus an AST ban on new literal copies anywhere in `backend/app`. SEAM-02 needs no code. The 272 pin is green at base (9 passed), and three records need dated corrections beside their originals.

**Primary recommendation:** Run Plan 01 as three ordered commits. (A) pins and fence hardening, green at base and driven RED. (B) one atomic move commit, with tests changed only by imports, patch targets and paths, proven by a D-07 script. (C) guard-list and docs updates. Run Plans 02 (records) and 03 (vocabulary) in parallel worktrees. Plan 04 runs the merged-tree gates, writes the ledger cells last, and does the Anthropic smoke.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tool registry + capability gate + whitelist refusal + dispatch | API / Backend (`services/tool_dispatcher.py`) | — | D-03; the one closed-core manifest the Extension Contract names |
| Tool handler logic (30 tools) | API / Backend (`services/tools/*.py`) | Database (Supabase/asyncpg via `aexec`, `ctx.pool`), Sandbox (Docker) | Pure move; handlers keep their existing I/O seams |
| Tool schemas advertised to the model | API / Backend (`openai_service.get_tools()`) | — | Not modified; pinned by hash |
| Filter vocabulary (date word→column, list fields) | API / Backend (`services/document_vocabulary.py`, leaf) | Database (column names) | DEBT-09 one home; leaf so the Find/Views/agent stacks import it without cycles |
| Retrieval orchestrator | API / Backend (`retrieval_service.py`) | Database (RPCs) | SEAM-02: confirm only |

## Standard Stack

No new dependencies. The phase uses the Python 3.12.6 stdlib (`ast`, `inspect`, `importlib`, `subprocess`, `difflib`, `tokenize`, `hashlib`, `json`) and the existing pytest setup. [VERIFIED: `backend/venv/Scripts/python.exe --version` → 3.12.6]

| Tool | Purpose | Why |
|------|---------|-----|
| `ast.dump` equality vs `git show <sha>:<path>` | Pure-move proof | Ignores line numbers and comments; the project precedent (`test_272_pure_move.py`) [VERIFIED: codebase] |
| `subprocess` fresh `python -c "import …"` | Import-order / cycle proof | `sys.modules` caching makes in-process import tests lie [VERIFIED: probe, 1.9 s per import] |
| `difflib` + `tokenize` | D-07 test-diff check | Line-pair token comparison; no third-party diff lib needed |

## Package Legitimacy Audit

No external packages are installed by this phase. Nothing needs slopcheck or registry verification.

## Architecture Patterns

### System Architecture Diagram

```
 agent_loop / threads / task_service / phase_types / models.harness
                │  (import ToolContext, ToolResult, dispatch_tool — UNCHANGED)
                ▼
 ┌──────────────────────────── services/tool_dispatcher.py (registry module) ─────────────────────────────┐
 │ re-exports: ToolContext, ToolResult (from tools.base); SCRIPT_EXTS; _attachment_container_path          │
 │ imports every handler BY NAME from tools.* (+ search_documents_tool, show_artifact_tool as today)       │
 │ _TOOL_REGISTRY = { static dict literal, 30 keys, byte-identical to base }                              │
 │ dispatch_tool(name,args,ctx): phase_whitelist refusal → _capability_disabled_message(load_app_settings) │
 │        → _TOOL_REGISTRY.get(name) → handler(args, ctx)                                                 │
 │        → unknown & "__" in name → _handle_connector_chat_tool (td global, from tools.connector)        │
 └────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                │ (calls)
   ┌────────────┼──────────────┬──────────────┬──────────────┬────────────┬──────────┬──────────────┬───────────┐
   ▼            ▼              ▼              ▼              ▼            ▼          ▼              ▼           ▼
 tools/      tools/         tools/         tools/         tools/       tools/     tools/         tools/      tools/
 documents   skills ──────▶ sandbox ─────▶ runtime_gap    render_      workspace  memory         agent_      connector
 (+resolver  (imports       (imports       (pure leaf,    template                               control     (lazy MCP/
  sentinels,  _fetch_owned_  _resolve_      re as          (driver src,  ▲                       (lazy        service
  folder      document_bytes skill_visib.   _re_filename)  SandboxedEnv) │                        task_service imports)
  wall)       from documents) from skills)                               └ documents imports _normalize_optional_int
   │                                                                     ▲ emitters.py lazily imports
   └──────── all import ToolContext/ToolResult from tools/base.py (leaf: stdlib + TYPE_CHECKING only)
                                                                         _handle_render_template FROM tool_dispatcher
```

### Recommended Project Structure

```
backend/app/services/
├── tool_dispatcher.py        # registry module: imports, re-exports, _TOOL_REGISTRY, gate, dispatch_tool (~260 L)
└── tools/
    ├── __init__.py           # docstring ONLY — no imports, no re-exports, no side effects
    ├── base.py               # ToolContext, ToolResult (+ the TYPE_CHECKING block) — leaf (~125 L)
    ├── documents.py          # KB browse + query + relationships + web_search + analyze + folder wall + resolver sentinels (~690 L)
    ├── skills.py             # load/save/read_skill_file/attach + _resolve_skill_visibility_or (~700 L)
    ├── sandbox.py            # execute_code, bounded sandbox, hydration, autoheal, repeat-guard (~1,185 L)
    ├── runtime_gap.py        # Phase 142 pure classifier + allowlists + SCRIPT_EXTS (~260 L)
    ├── render_template.py    # _RENDER_DRIVER_SRC + filename guard + handler (~750 L)
    ├── workspace.py          # 5 workspace handlers + _normalize_optional* (~190 L)
    ├── memory.py             # remember, recall, query_tables (~95 L)
    ├── agent_control.py      # task, write_todos, ask_user + _SUB_AGENT_* (~450 L)
    └── connector.py          # _APPROVAL_TIMEOUT_SECONDS + _handle_connector_chat_tool (~375 L)
```
`ToolContext`/`ToolResult` file name: recommend `tools/base.py` (planner may choose `context.py`). Names avoid every existing module (`app/services/tools*` measured absent).

### Move map — every top-level binding at `25b4235c5` (105 total, all accounted for)

[VERIFIED: AST walk of `tool_dispatcher.py`; `unmapped top-level names: []`]

| Destination | # | Bindings (base line ranges) |
|---|---|---|
| `tools/base.py` | 2 | `ToolContext` :111-215, `ToolResult` :219-227 (+ the `if TYPE_CHECKING:` block :97-101) |
| `tools/documents.py` | 21 | `resolve_filter` :236, `ResolveError` :237, `_build_field_meta` :238, `_ensure_resolver` :241-261, `_OUT_OF_SCOPE` :277, `_scope_set` :280-282, `_document_folder_ids` :285-292, `_doc_out_of_scope` :295-302, `_prune_tree` :305-311, `_handle_ls` :314-323, `_handle_tree` :326-332, `_handle_grep` :335-342, `_handle_glob` :345-354, `_handle_read_document` :357-372, `_fetch_owned_document_bytes` :378-482, `_handle_fetch_document_file` :485-549, `_handle_query_documents` :803-808, `_handle_query_documents_by_view` :811-978, `_handle_get_related_documents` :981-1074, `_handle_web_search` :1077-1079, `_handle_analyze_document` :1082-1168 |
| `tools/skills.py` | 11 | `_ATTACH_INLINE_MAX_BYTES` :560, `_resolve_attach_source_bytes` :563-669, `_handle_attach_skill_file` :672-800, `_SKILL_RUNTIME_NOTE` :1175-1179, `_skill_runtime_note` :1182-1196, `_resolve_skill_visibility_or` :1219-1262, `_handle_load_skill` :1265-1404, `_handle_save_skill` :1407-1486, `_SCRIPT_REF_CAVEAT` :1494-1497, `_decode_skill_file_bytes` :1500-1550, `_handle_read_skill_file` :1553-1619 |
| `tools/sandbox.py` | 25 | `_pip_install` :1629-1643, `_SandboxCommandTimeout` :1646-1653, `_run_bounded_sandbox` :1656-1688, `_install_declared_libraries` :1691-1723, `_EXEC_ERROR_MARKERS` :1730-1744, `_derive_actual_exit_code` :1747-1756, `_ATTACHMENTS_DIR` :1770, `_ATTACHMENT_HYDRATION_MAX_FILES` :1776, `_ATTACHMENT_NAME_MAX` :1783, `_hydrated_files` :1814, `_hydration_failures` :1835, `_ATTACHMENT_HYDRATION_MAX_ATTEMPTS` :1841, `_session_hydration_records` :1844-1864, `_attachment_container_path` :1867-1893, `_hydrate_thread_attachments` :1896-2034, `_handle_execute_code` :2037-2619, `_PREINSTALLED_HINT_LIBS` :3531-3534, `_HEAL_BOUND_TTL_S` :3535, `_extract_missing_module` :3538-3544, `_install_failed_detail` :3547-3559, `_heal_bound_seen` :3562-3575, `_heal_bound_record` :3578-3592, `_autoheal_missing_module` :3595-3673, `_REPEAT_BLOCKED_NOTE` :3676-3680, `_repeat_blocked_result` :3683-3703 |
| `tools/runtime_gap.py` | 17 | `KNOWN_MISSING_BINARIES` :3292-3295, `KNOWN_MISSING_MODULES` :3296, `JS_TOKENS` :3301-3302, `_SKILL_BUNDLE_DIRS` :3309, `SCRIPT_EXTS` :3314-3317, `_MSG_SOFFICE` :3322-3324, `_MSG_NODE` :3325-3327, `GAP_MESSAGES` :3328-3348, `GAP_MESSAGES_JS` :3350, `GAP_MESSAGES_MISSING_FILE` :3351-3354, `_NO_MODULE_RE` :3359, `_MISSING_PATH_RE` :3360-3362, `_BINARY_GAP_RES` :3371-3378, `_strip_py_line_comments` :3381-3409, `_classify_runtime_gap` :3412-3488, `_message_for_dead_token` :3495-3500, `_code_references_dead_token` :3513-3518 |
| `tools/render_template.py` | 5 | `_RENDER_DRIVER_SRC` :2934-3230, `_SAFE_OUT_FILENAME_RE` :3241, `_VALID_RENDER_ENGINES` :3244, `_safe_out_filename` :3247-3260, `_handle_render_template` :3706-4099 |
| `tools/workspace.py` | 8 | `_NULL_STRINGS` :2728, `_normalize_optional` :2731-2735, `_normalize_optional_int` :2738-2752, `_handle_workspace_write` :2755-2794, `_handle_workspace_read` :2797-2830, `_handle_workspace_list` :2833-2859, `_handle_workspace_delete` :2862-2877, `_handle_workspace_diff` :2880-2904 |
| `tools/memory.py` | 3 | `_handle_remember` :2622-2662, `_handle_recall` :2665-2707, `_handle_query_tables` :2710-2714 |
| `tools/agent_control.py` | 5 | `_SUB_AGENT_DEFAULT_READ_ONLY` :4110-4115, `_SUB_AGENT_EXCLUDED` :4124, `_handle_task` :4127-4275, `_handle_write_todos` :4278-4344, `_handle_ask_user` :4347-4546 |
| `tools/connector.py` | 2 | `_APPROVAL_TIMEOUT_SECONDS` :32, `_handle_connector_chat_tool` :4690-5030 |
| **stays** `tool_dispatcher.py` | 6 | `logger` :103, `_TOOL_REGISTRY` :4553-4592, `_spawn_tool_refused_audit` :4604-4633, `_CAPABILITY_FLAG_TOOLS` :4650-4663, `_capability_disabled_message` :4666-4687, `dispatch_tool` :5033-5068 |

Placement notes (planner's call within D-01):
- `_repeat_blocked_result` / `_REPEAT_BLOCKED_NOTE` are pure Phase-142 helpers. They can live in `runtime_gap.py` instead of `sandbox.py`. Either way `sandbox.py` imports them by name.
- `_normalize_optional*` and `_NULL_STRINGS` sit under the base file's "Workspace tool handlers (Phase 084)" header. Keep them in `workspace.py`; `documents.py` then does `from app.services.tools.workspace import _normalize_optional_int` (used by `_handle_query_documents_by_view`).
- `_handle_web_search` and `_handle_analyze_document` go in `documents.py` per D-01's list.
- **Inter-node comment blocks move with the code that follows them.** Examples: the 262-UAT folder-wall block :264-276, the SEED-125 block :1198-1217, the Phase-142 design-law block :3262-3290, the 244 hydration WHY blocks :1758-1835, the render-template contract block :2906-2933. Comments are not in the AST, so the AST pin cannot see a dropped comment; the no-loss line check below can.

### Shared helpers and cross-family imports (measured)

| Name | Defined in | Used by | Import form |
|---|---|---|---|
| `_fetch_owned_document_bytes` | documents | documents (`_handle_fetch_document_file`), **skills** (`_resolve_attach_source_bytes`) | skills: `from app.services.tools.documents import _fetch_owned_document_bytes` |
| `_resolve_skill_visibility_or` | skills | skills (3 calls), **sandbox** (`_handle_execute_code`, 1 call) | sandbox: `from app.services.tools.skills import _resolve_skill_visibility_or` |
| `SCRIPT_EXTS` | runtime_gap | skills (`_skill_runtime_note`, `_decode_skill_file_bytes`); `app/api/skills.py:37` via `tool_dispatcher` | skills imports from runtime_gap; **td re-exports** |
| `_classify_runtime_gap`, `_code_references_dead_token`, `_message_for_dead_token`, `KNOWN_MISSING_MODULES`, `_NO_MODULE_RE` | runtime_gap | sandbox | by name |
| `_normalize_optional_int` | workspace | workspace, **documents** | by name |
| `_attachment_container_path` | sandbox | sandbox; `agent_loop.py:82` via `tool_dispatcher` | **td re-exports** |
| `import re as _re_filename` (module-level, base :3239) | — | runtime_gap (`_NO_MODULE_RE`, `_MISSING_PATH_RE`, `_BINARY_GAP_RES`, `_code_references_dead_token`) and render_template (`_SAFE_OUT_FILENAME_RE`) | **both modules must keep the alias `_re_filename`** or the moved bodies stop being AST-identical |

Module-level imports per family (from the AST "names used" walk):
- **base:** `dataclass, field`, `Any, Awaitable, Callable`, `UUID`, the TYPE_CHECKING block (`asyncpg`, `redis.asyncio as aioredis`, `supabase.Client`, `UserEffectiveSettings`).
- **documents:** `json`, `run_in_threadpool`, `aexec`, `ls_path, tree_path, grep_path, glob_path, read_path`, `get_globally_visible_folder_ids`, `resolve_document_id, fetch_full_document` (from `retrieval_service`, keep the same source so the 272 re-export stays load-bearing), `not_retrievable_result, unretrievable`, `web_search`, `run_sub_agent`, `write_audit_entry`, `sandbox_manager`, `settings, _SUB_AGENT_MODEL_DEFAULTS`, `query_documents`, `ViewFilter`, `document_view_service`, `document_relationship_service`.
- **skills:** `io, json, os`, `UUID`, `run_in_threadpool`, `aexec`, `_resolve_caller_org_ids`, `build_skill_visibility_or`, `write_audit_entry`, `sandbox_manager`, `lint_description`, `_get_file_content, get_file_by_path, guess_mime_type`.
- **sandbox:** `asyncio, base64, json, os, shlex, time as time_mod, weakref`, `UUID`, `run_in_threadpool`, `aexec`, `write_audit_entry`, `sandbox_manager, harvest_output_files, snapshot_output_baseline`, `settings`, `WorkspaceError, _get_file_content, get_file_by_path, ws_list_files`.
- **render_template:** `import re as _re_filename`, `UUID`, `run_in_threadpool`, `sandbox_manager`, `settings`, `WorkspaceError, ws_write_file`.
- **workspace:** `json`, `UUID`, `WorkspaceError, ws_write_file, ws_read_file, ws_list_files, ws_delete_file, ws_get_diff`.
- **memory:** `json`, `aexec`, `write_audit_entry`.
- **agent_control:** `asyncio, json`, `UUID`, `aexec`, `settings`.
- **connector:** `asyncio, json`, `datetime, timezone, timedelta`, `write_audit_entry`.
- **Unused at base (do not carry):** `metadata_field_service`, `search_documents` (the handler moved to `search_documents_tool.py` in 272). `tool_dispatcher.py` itself keeps only `json`, `logging`, `Callable`, `load_app_settings`, the handler imports and the re-exports.
- Each module gets its own `logger = logging.getLogger(__name__)` (see Runtime State Inventory: log record names change).

### Import-cycle analysis (measured)

[VERIFIED: fresh-interpreter probe, one subprocess per module, `tool_dispatcher_loaded` checked in `sys.modules` after import]
- Pulls `tool_dispatcher` in: `document_view_resolver`, `task_service`, `document_search_service`. All are imported **lazily** today (`_ensure_resolver` :251, `_handle_task` :4226, and none in td respectively). They stay lazy.
- Does NOT pull `tool_dispatcher` in (safe at module level in any `tools/*.py`): all 22 module-level dependencies above, plus `template_render_service`, `template_asset_service`, `todos_service`, `multimodal_service`, `connector_service`, `mcp_client`.
- `_handle_task` lazily imports `task_service`, which imports `ToolContext, ToolResult, dispatch_tool` from `tool_dispatcher` at module level. That runs at call time, after everything is loaded. **No cycle**, and moving `_handle_task` to `tools/agent_control.py` changes nothing.
- `_handle_execute_code` lazily imports `app.api.threads.drain_step` (threads imports td at module level). Call-time only, so no cycle.
- `search_documents_tool.py:53` / `show_artifact_tool.py:67` import `ToolContext, ToolResult` from `app.services.tool_dispatcher` under TYPE_CHECKING or function-locally. **Leave them untouched** (D-05). `test_272_search_tool_move.py::_normalised_handler` *asserts* the handler's function-local import is `from app.services.tool_dispatcher import …` at HEAD, so retargeting it to `tools.base` would turn that test RED.
- `_ensure_resolver` uses `globals()`. Moved verbatim into `documents.py`, it binds `documents`' globals, which is exactly where `_handle_query_documents_by_view` resolves `resolve_filter`. The AST is identical and the semantics move with it. Tests that `monkeypatch.setattr(td, "resolve_filter", spy)` must retarget to `tools.documents` (`test_115_handler_modes.py:81,101`, `test_275_agent_wall.py:363`).
- `ToolContext.__module__` changes. Nothing reads it: a grep for `__module__`/`__qualname__` finds only `api/setup.py:148`, unrelated. `dataclasses.fields(ToolContext)` users (`test_099:214`, `test_264_born_for_carrier:97`, `test_273_db_artifacts:286`) are unaffected.

### Pattern 1: The registry module after the split

```python
# backend/app/services/tool_dispatcher.py — shape only
from __future__ import annotations

import json
import logging
from typing import Callable

from app.models.user_settings import load_app_settings
# Leaf types + back-compat re-exports (D-04). ⚠ A PATCH of a moved name HERE no longer reaches the
# handler that calls it — patch the tools/<family> module that resolves it (patch-where-used).
from app.services.tools.base import ToolContext, ToolResult  # noqa: F401 — re-export
from app.services.tools.runtime_gap import SCRIPT_EXTS  # noqa: F401 — app/api/skills.py:37
from app.services.tools.sandbox import _attachment_container_path  # noqa: F401 — agent_loop.py:82
# Handlers, imported BY NAME so the dict literal below is byte-identical to PHASE_BASE.
from app.services.tools.documents import (_handle_ls, _handle_tree, ...)
...
from app.services.search_documents_tool import handle_search_documents as _handle_search_documents  # unchanged
from app.services.show_artifact_tool import handle_show_artifact as _handle_show_artifact            # unchanged
from app.services.tools.connector import _handle_connector_chat_tool  # dispatch_tool resolves it as a td global

logger = logging.getLogger(__name__)

_TOOL_REGISTRY: dict[str, Callable] = {   # ⛔ BYTE-IDENTICAL to base :4553-4592, comments included
    "ls": _handle_ls,
    ...
}
# _spawn_tool_refused_audit, _CAPABILITY_FLAG_TOOLS, _capability_disabled_message, dispatch_tool — unchanged
```
Keep the `_TOOL_REGISTRY: dict[str, Callable] = {` header and its body **byte-identical**. `scripts/check-landing-drift.cjs:153-156`, `scripts/lib/docs-content.cjs`, and `frontend/src/docs/__tests__/docsContent.test.ts` / `docsCoverageGate.test.ts` all regex-parse that exact block out of `tool_dispatcher.py`. [VERIFIED: codebase]

### Anti-Patterns to Avoid
- **Re-exporting every moved helper from `tool_dispatcher.py`.** A re-export makes `monkeypatch.setattr(td, "aexec", …)` succeed silently and reach nothing. Re-export only `ToolContext`, `ToolResult`, `SCRIPT_EXTS` and `_attachment_container_path`, plus the handlers the registry imports anyway. Let stale patches fail with `AttributeError`.
- **Rewriting a moved body to call `skills._resolve_skill_visibility_or(...)` through a module attribute** to make patching easier. That breaks AST identity. Import by name and patch where used.
- **Putting imports in `tools/__init__.py`.** It creates an import-order dependency and a cycle surface. Leave it docstring-only.
- **Building the registry from per-module dicts** (`{**documents.TOOLS, **skills.TOOLS}`). That is order-by-import and violates D-05.
- **Retargeting `search_documents_tool.py`'s / `show_artifact_tool.py`'s td imports** (see the cycle analysis above).
- **Omitting `from __future__ import annotations` in any new module.** `ToolContext`'s field annotations name TYPE_CHECKING-only types (`asyncpg.Pool`, `aioredis.Redis`, `Client`); without PEP 563 they are evaluated at class creation and raise `NameError`.

## Test Retarget Inventory (D-06)

Measured at `25b4235c5` by an AST classifier over all of `backend/tests/` (98 files mention `tool_dispatcher`). Destination modules assume the move map above.

### A. Literal string patch targets: 38 sites in 12 files (33 retarget, 5 stay)

| File:line(s) | Target today | Handler exercised | New target |
|---|---|---|---|
| `tests/integration/test_085_ask_user_handler.py:369,419,460,502,535,568,591` | `…tool_dispatcher.aexec` ×7 | `_handle_ask_user` | `app.services.tools.agent_control.aexec` |
| `tests/integration/test_085_lifespan_shutdown.py:186` | `.aexec` | `_handle_ask_user` | `tools.agent_control.aexec` |
| `tests/unit/test_260_financial_analyzer_conversation.py:169` | `.aexec` | `_handle_load_skill` | `tools.skills.aexec` |
| `tests/unit/test_151_attach_handler.py:97,99` | `.get_file_by_path`, `._get_file_content` | `_resolve_attach_source_bytes` | `tools.skills.*` |
| `tests/unit/test_151_attach_handler.py:129,157,178` | `.sandbox_manager` ×3 | attach (skills) | `tools.skills.sandbox_manager` |
| `tests/unit/test_151_attach_handler.py:242,259` | `._fetch_owned_document_bytes` ×2 | **`_resolve_attach_source_bytes` (skills)** | `tools.skills._fetch_owned_document_bytes` ⚠ cross-family: patch where USED, not where defined |
| `tests/unit/test_151_fetch_handler.py:77,96,116,136,159,182,256` | `.sandbox_manager` ×7 | fetch (documents) | `tools.documents.sandbox_manager` |
| `tests/unit/test_151_fetch_handler.py:180` | `.get_globally_visible_folder_ids` | `_fetch_owned_document_bytes` | `tools.documents.*` |
| `tests/test_224_approval_deadline.py:71,166` | `.write_audit_entry` ×2 | connector (via `dispatch_tool`) | `tools.connector.write_audit_entry` |
| `tests/unit/security/test_adversarial_corpus.py:114` | `.write_audit_entry` | connector | `tools.connector.write_audit_entry` |
| `tests/unit/services/test_tool_dispatcher_trifecta_fence.py:66` | `.write_audit_entry` | connector | `tools.connector.write_audit_entry` |
| `tests/test_workspace_template.py:209` | `.ws_read_file` | `_handle_workspace_read` | `tools.workspace.ws_read_file` |
| `tests/unit/test_tool_dispatcher.py:261` | `.ws_list_files` | `_handle_workspace_list` | `tools.workspace.ws_list_files` (⚠ sandbox also imports it; this test is workspace) |
| `tests/unit/test_tool_dispatcher.py:296` | `.ws_read_file` | `_handle_workspace_read` | `tools.workspace.ws_read_file` |
| `tests/unit/test_273_show_artifact_tool.py:428` | `.search_documents` | none (already vacuous at base: td imports it but nothing in td calls it) | `app.services.search_documents_tool.search_documents` (the module that calls it; recommended) |
| `tests/unit/test_273_show_artifact_tool.py:429` | `.query_documents` | guard | `tools.documents.query_documents` |
| **STAY** `tests/unit/test_273_show_artifact_tool.py:430,431` | `._handle_execute_code`, `._handle_query_tables` | guard | unchanged. td still binds both (registry imports), semantics identical to base |
| **STAY** `tests/unit/test_emitters.py:65,99,127` | `._handle_render_template` | `emitters._render_template_post` lazily imports it **from `tool_dispatcher`** (`harness/emitters.py:116`) | **unchanged. Retargeting would break them** |

### B. Object-form patches: 65 sites in 14 files

| File | Sites | Strategy |
|---|---|---|
| `tests/test_147_flag_refuse.py:41,70,92,119` | `setattr(td,'load_app_settings')` ×4 | **STAY.** `load_app_settings` remains used by `_capability_disabled_message` in td |
| `tests/unit/test_llm_emit_executor.py:569` | `setattr(td,'_handle_render_template')` | **STAY** (emitter call-time read from td) |
| `tests/test_223_dispatcher_audit.py:71,124,185,262,321` | `write_audit_entry` ×5 + `td._handle_connector_chat_tool` | swap the per-function alias import (`:51,104,165,227,287,347`) to `from app.services.tools import connector as td` → import-line-only |
| `tests/unit/test_115_handler_modes.py:81,101` | `resolve_filter` | alias swap at `:68,95` → `tools.documents` |
| `tests/unit/test_142_load_skill_flag.py:156` (+ reads `:176,180,181`) | `_skill_runtime_note` | alias swap at `:35` → `tools.skills` (the file also imports `SCRIPT_EXTS, ToolContext, _handle_load_skill` — all exist on skills) |
| `tests/unit/test_142_repeat_guard.py:121-126,259` | `run_in_threadpool, sandbox_manager, snapshot_output_baseline, harvest_output_files, aexec, write_audit_entry, _classify_runtime_gap` | module-level alias `:33` → `from app.services.tools import sandbox as tool_dispatcher` (or rename). `_classify_runtime_gap` is patched where `_handle_execute_code` resolves it (sandbox). Line `:34` imports `GAP_MESSAGES` → `tools.runtime_gap` |
| `tests/unit/test_151_attach_handler.py:149` (+ read `:225`) | `_ATTACH_INLINE_MAX_BYTES` | alias swap at `:148,222` → `tools.skills`. ⚠ patch and read must target the **same** module |
| `tests/unit/test_244_attachment_hydration.py:151-159,472,637` (+ reads `:305,612`) | 11 sandbox names | module-level alias `:44` → `tools.sandbox` |
| `tests/unit/test_262_folder_scope_wall.py` (15 sites) | `_document_folder_ids`, `grep_path`, `ls_path`, `tree_path`, `read_path`, `resolve_document_id`, `fetch_full_document` | module-level alias `:24` → `tools.documents` (every handler it calls is a documents handler) |
| `tests/unit/test_264_load_skill_born_for.py:680` | `_resolve_skill_visibility_or` | ⚠ module-level `td` (`:37`) also feeds `_DISPATCHER_SRC` (`:67`). Needs the pre-move tuple restructure (see fences), then patch on a `tools.skills` alias |
| `tests/unit/test_264_unchanged_sites_fenced.py:324,327,328` | `sandbox_manager, snapshot_output_baseline, _hydrate_thread_attachments` | ⚠ module-level `td` (`:45`) also drives `_APP = Path(getsourcefile(td)).parents[1]` (`:62`). Keep `td`; add a `tools.sandbox` alias and change the patch target's first argument |
| `tests/unit/test_275_agent_wall.py:183,236,237,363` | `read_path, resolve_document_id, fetch_full_document, resolve_filter` | per-function aliases (`:175,198,225,305,313,323,333,353,371,384,438`) → `tools.documents` |
| `tests/unit/test_template_render.py` (8 sites, + reads `td.settings`, `td.sandbox_manager`) | `run_in_threadpool, ws_write_file` | per-function aliases (`:501,542,818,899,989`) → `tools.render_template` |
| `tests/unit/test_tool_dispatcher.py:657,684` (+ reads `:603-687`) | `_run_bounded_sandbox` | per-function aliases (`:599,628,649,679`) → `tools.sandbox`. Leave `:742,772` (registry/search) |

### C. `from app.services.tool_dispatcher import <name>` that will no longer resolve: 34 occurrences

Retarget the import line to the family module. Split mixed lines.
- `tests/unit/test_tool_dispatcher.py:196,203,210,217,227` (`_normalize_optional*` → workspace), `:329,349,366,383,409,422,437,464,491,521,550,569` (`_pip_install`, `_install_declared_libraries`, `_extract_missing_module`, `_install_failed_detail`, `_autoheal_missing_module` → sandbox)
- `tests/unit/test_142_runtime_gap.py:21` (6 names → runtime_gap) · `tests/unit/test_142_repeat_guard.py:34` (`GAP_MESSAGES`) · `tests/unit/test_142_read_skill_file.py:31` (`_decode_skill_file_bytes` → skills; `SCRIPT_EXTS` may stay on td)
- `tests/unit/test_151_fetch_handler.py:39`, `tests/unit/test_151_registration.py:65` (`_fetch_owned_document_bytes` → documents)
- `tests/unit/test_264_load_skill_born_for.py:38` (`_resolve_skill_visibility_or` → skills)
- `tests/unit/test_273_tool_wiring.py:83` (`_SUB_AGENT_EXCLUDED` → agent_control)
- `tests/unit/test_template_render.py:607,1060` (`_RENDER_DRIVER_SRC` → render_template)
- `tests/test_224_approval_deadline.py:17` (`_APPROVAL_TIMEOUT_SECONDS` → connector; keep `dispatch_tool, ToolContext` on td)
- `tests/test_2171_search_error_audit.py:130` (`write_audit_entry` → `app.services.audit_service`)

Imports that keep working unchanged: every `_handle_*`, `ToolContext`, `ToolResult`, `dispatch_tool`, `_TOOL_REGISTRY`, `_CAPABILITY_FLAG_TOOLS`, `SCRIPT_EXTS`, `_attachment_container_path`, `_handle_search_documents`, `_handle_connector_chat_tool`.

### D. `td.<moved helper>` attribute reads: 27
All are covered by the alias swaps in table B (`test_142_load_skill_flag`, `test_151_attach_handler`, `test_244_attachment_hydration`, `test_262_folder_scope_wall`, `test_264_load_skill_born_for`, `test_275_agent_wall`, `test_template_render`, `test_tool_dispatcher`). `td._handle_search_documents` reads (7) stay.

### E. Non-test consumers that break or go stale

| File | Issue | Action |
|---|---|---|
| `scripts/uat-adversarial-sync.py:156` | string patch `app.services.tool_dispatcher.write_audit_entry` → `AttributeError` | retarget to `tools.connector` |
| `scripts/check-extension-contract.cjs:41-48` + `.claude/hooks/extension-contract-guard.js:28` | TRIGGER_PATHS cover td only; handler code leaves the scanned set | add each `tools/*.py` explicitly (the scanner passes today on the same code, so no new violations) |
| `docs/EXTENSION-CONTRACT.md:35,117` | names `tool_dispatcher.py` as the tools home / six trigger paths | text update |
| `scripts/run-defense-mutations.sh:27`, `tests/unit/security/adversarial_corpus.py:42,56` | `target_module` labels (report metadata only, never opened as files) | optional label update |
| `tests/unit/security/conftest.py:21` DEFENSE_TARGETS | patches `td._handle_connector_chat_tool` + the test module's binding (`_patch_symbol`) | **no change needed** (td still binds it; `dispatch_tool` resolves it as a td global) |
| `check-landing-drift.cjs`, `docs-content.cjs`, docs-coverage frontend tests, landing/docs hooks | parse the `_TOOL_REGISTRY` block in td | no change if the block stays byte-identical |

## Source-Fence Inventory (D-08)

18 tests read `tool_dispatcher` source/AST. "Absence" = passes vacuously if the code leaves the scanned file.

| # | Test:line | Reads / asserts | Kind | New target | Pre-move hardening (commit A) |
|---|---|---|---|---|---|
| 1 | `test_075_1_observability.py:239` | regex `sub_agent_record = {…"effective_model":` | presence | `tools/documents.py` | add anchor `"_handle_analyze_document" in text` |
| 2 | `test_190_connector_source_fence.py:622` | exact sorted list of function-local importers of `connectors.registry` | presence (exact list) | `"app/services/tools/connector.py"` (sorts into the same slot) | none (exact list) |
| 3 | `test_190_ssti_fence.py:71` | `_SANDBOXED_SITES` must construct `SandboxedEnvironment(autoescape=True)` (inside `_RENDER_DRIVER_SRC`) | presence | `tools/render_template.py` | none |
| 4 | `test_216_connector_wiring_reachable.py:146` | each `list_connections` call has no `user_id` kwarg | **ABSENCE** | `AGENT_LOOP.parent / "tools" / "connector.py"` | `sites = _call_sites(...); assert sites` |
| 5 | `test_221_application_grouping.py:330` | `getsource(module)` contains `tool_facet`, `application=`, `is_write=` | presence | `("app.services.tools.connector", "tool_facet")` | none |
| 6 | `test_222_auth_scheme.py:116-120` | each `list_tools`/`call_tool` call passes `auth_scheme` (td has 1 at :4919) | **ABSENCE** for td | `tools.connector` module | per-module `assert calls_seen >= 1` |
| 7 | `test_244_attachment_hydration.py:305` | `getsource(tool_dispatcher._hydrate_thread_attachments)` | presence | via alias swap → sandbox | none |
| 8 | `test_255_extension_contract_guard.py:35` | no `importlib`/`eval`/`exec` in TRIGGER_FILES | **ABSENCE** | keep td, **add every `tools/*.py`** | existing "File not found" violation is the anchor; optionally assert list length |
| 9 | `test_259_closed_core_inventory.py:47-53` | no `_handle_expert*` def in td | **ABSENCE** | every handler file (tools/*.py + `search_documents_tool.py` + `show_artifact_tool.py`) | hoist to `_HANDLER_FILES` tuple + assert each file has ≥1 handler def |
| 10 | `test_261_closed_core_inventory.py:49-66` | same + no module-level `*expert*tool*` name | **ABSENCE** | same | same |
| 11 | `test_264_born_for_carrier.py:243` | no `if`/ternary tests `born_for_bundle_id` | **ABSENCE** | add `tools/*.py` | anchor: each path exists and parses to ≥1 def |
| 12 | `test_264_one_home_born_for_predicate.py:430` | `_MUST_BE_SILENT` carries no `born_for_expert_bundle_id` DSL | **ABSENCE** | add `tools/*.py` | anchor: each path exists |
| 13 | `test_264_load_skill_born_for.py:67,325,362,417,452,700` | 4 resolver calls (3 opt in), 1 `getattr` read inside the resolver, the `_sibling_filter` comment window, 7 `.or_()` applications (4 `_skill_filter` + 1 `_sibling_filter` in skills; 2 `_sf_filter` in sandbox), the load_skill miss branch | presence/count, **spans skills+sandbox** | `(tools/skills.py, tools/sandbox.py)` | **restructure** `_DISPATCHER_SRC` → `_HANDLER_SRCS = (Path(getsourcefile(td)),)` and make every fence iterate/concatenate; anchor = resolver def found exactly once |
| 14 | `test_264_unchanged_sites_fenced.py:251` | `_handle_read_skill_file` (skills) + `_handle_execute_code` (sandbox) carry no `.eq("is_enabled")` | presence via `next()`, **spans 2 files** | `(skills.py, sandbox.py)` | restructure to iterate a tuple; anchor = each fn found exactly once |
| 15 | `test_275_agent_wall.py:212` | `_fetch_owned_document_bytes` has ≥2 callers (fetch + attach resolver) | count, **spans documents+skills** | `(documents.py, skills.py)` | restructure to a tuple |
| 15b | `test_275_agent_wall.py:461` | `assert hits == {"services/tool_dispatcher.py": 3}` — **path inside an assert line** | presence | `{"services/tools/documents.py": 3}` | **hoist** to `_AGENT_WALL_FILE = "services/tool_dispatcher.py"` so the move edits a constant line, not an assert |
| 15c | `test_275_agent_wall.py:483` | `'"retrievable"' not in` td text | **ABSENCE** | `services/tools/documents.py` | anchor `"unretrievable" in text` |
| 16 | `test_tool_approval_always.py:136` | `"tool_approval_required"` emit carries `connection_id=` | presence (`src.index` raises) | `tools/connector.py` | none |
| 17 | `test_268_search_audit_keys.py:128` | `getsource(td._handle_search_documents)` | presence | **unchanged** | none |
| 18 | `test_272_search_tool_move.py` | `git show` at fixed SHAs + registry identity | n/a | **unchanged** | none |

Also: `test_259`/`test_261`/`test_267_tool_floor_union.py:376-377` check `not hasattr(tool_dispatcher, "EXPERT_CORE_TOOLS")`. That stays true trivially; widening it to the tools modules is optional and cheap.

**Why the hardening must be a separate pre-move commit:** D-08 adds `assert` lines, D-07 forbids `assert` changes in the move commit, and 15b embeds the path inside an `assert`. Commit A (green at base, every fence still on `tool_dispatcher.py`) adds anchors, tuples and hoisted constants. Commit B then changes only path strings, module strings, alias names and import lines. Drive each new anchor RED once in commit A, for example by pointing the tuple at a file without the anchor, then restore.

## Pin Design

### Registry pin (`tests/unit/test_278_registry_pin.py`, green at base, commit A)

```python
PHASE_BASE_SHA = "25b4235c540b1e21a055301ce576d1deb78d5634"
_TD_REL = "backend/app/services/tool_dispatcher.py"

def _registry_node(src):            # the ONE top-level binding of _TOOL_REGISTRY
    hits = [n for n in ast.parse(src).body
            if isinstance(n, (ast.Assign, ast.AnnAssign))
            and "_TOOL_REGISTRY" in {getattr(t, "id", None) for t in (n.targets if isinstance(n, ast.Assign) else [n.target])}]
    assert len(hits) == 1, f"_TOOL_REGISTRY bound {len(hits)} times"
    assert isinstance(hits[0].value, ast.Dict), "registry is no longer a static dict literal"
    return hits[0]

def test_registry_names_order_and_bindings_match_base():
    base = _registry_node(_blob_at(PHASE_BASE_SHA, _TD_REL)).value
    keys = [k.value for k in base.keys]; names = [v.id for v in base.values]
    td = importlib.import_module("app.services.tool_dispatcher")
    assert len(keys) == 30 and list(td._TOOL_REGISTRY) == keys
    for k, n in zip(keys, names):
        assert td._TOOL_REGISTRY[k] is getattr(td, n), k   # same object the base name bound

def test_registry_is_the_same_static_literal():          # D-05: not built by mutation / import order
    assert ast.dump(_registry_node(_read(_TD_REL))) == ast.dump(_registry_node(_blob_at(PHASE_BASE_SHA, _TD_REL)))

def test_nothing_mutates_the_registry():
    # walk backend/app/**/*.py: fail on Subscript(Store) of Name _TOOL_REGISTRY, on
    # _TOOL_REGISTRY.update/setdefault/pop/clear/__setitem__ calls, and on any binding of
    # _TOOL_REGISTRY outside tool_dispatcher.py. Non-vacuity: assert files_walked > 100.

SCHEMA_SHA256 = {  # captured at PHASE_BASE in commit A — one entry per flag combo + render_template
    (True, True, True): "<sha256>", ...  # 8 combos of (web_search, sandbox, self_improve)
    "RENDER_TEMPLATE_TOOL": "<sha256>",
}
@pytest.mark.parametrize("combo", list(itertools.product([True, False], repeat=3)))
def test_schema_text_is_byte_identical(combo):
    w, s, i = combo
    tools = get_tools(SimpleNamespace(web_search_enabled=w, sandbox_enabled=s, self_improve_enabled=i))
    text = json.dumps(tools, ensure_ascii=False)          # insertion order preserved = full text
    assert hashlib.sha256(text.encode()).hexdigest() == SCHEMA_SHA256[combo]
```
- `get_tools` (`openai_service.py:1310-1367`) gates exactly 5 tools on 3 flags: `self_improve` → `save_skill` + `attach_skill_file`; `web_search` → `web_search`; `sandbox` → `execute_code` + `fetch_document_file`. `render_template` is **not** in `get_tools` (harness-only, `RENDER_TEMPLATE_TOOL`, `openai_service.py:880`, consumed at `phase_types.py:555`), so pin it separately. Pass an explicit `SimpleNamespace`; `get_tools(None)` reads the DB-backed `self_improve_enabled()` cache.
- **RED drive:** swap two registry lines in a backup-protected copy, observe `test_registry_names_order…` and `test_registry_is_the_same_static_literal` fail, then restore md5-identical from the backup (not `git checkout`).

### AST pure-move pin (`tests/unit/test_278_pure_move.py`)

Mirror `test_272_pure_move.py` (`_blob_at_base` with `encoding="utf-8"`, which is load-bearing on Windows):
- `MOVE_MAP: dict[str, str]` holds all 99 moved names → `backend/app/services/tools/<family>.py`. `UNMOVED = (_TOOL_REGISTRY, _spawn_tool_refused_audit, _CAPABILITY_FLAG_TOOLS, _capability_disabled_message, dispatch_tool)` is compared in `tool_dispatcher.py`. `PER_MODULE = {"logger"}` is excluded.
- `test_every_base_binding_is_accounted_for`: the top-level names at base == `MOVE_MAP ∪ UNMOVED ∪ PER_MODULE` (catches a silently dropped constant).
- `test_moved_bindings_are_ast_identical`: compare `ast.dump` for FunctionDef/AsyncFunctionDef/ClassDef **and** Assign/AnnAssign (so the 297-line `_RENDER_DRIVER_SRC`, the allowlists and the regexes are pinned). Non-vacuity: `len(compared) == len(MOVE_MAP)`. Keep the 272 `RETIRED: dict[name, reason]` shape for future deliberate changes.
- `test_each_name_has_exactly_one_home`: scan td + `tools/*.py` top-level *definitions* (not ImportFrom bindings). Each MOVE_MAP name is defined in exactly one file, its home. This catches a "copy, not move".
- `test_tools_modules_use_future_annotations` and `test_no_tools_module_imports_tool_dispatcher_at_module_level` (AST).
- `test_each_module_imports_first_in_a_fresh_interpreter[mod]`: one `subprocess.run([sys.executable, "-c", f"import {mod}"])` per module (td + 10 tools modules). ~1.9 s each [VERIFIED], ~21 s total. This catches partial-init cycles that in-process tests cannot see.
- TDD shape: this file cannot be green at base (the homes do not exist). Land it in commit A as `@pytest.mark.xfail(strict=True, reason="RED until the 278 move")`. xfails do not count against the ≤71 failed ceiling, and `strict` makes an accidental pass fail. Commit B removes the marker. **Do not commit a plain failing test**: the gate has zero headroom (base = exactly 71).

### D-07 mechanical test-diff check (script, e.g. `scripts/check-test-retarget-only.py <pre_move_sha> <move_sha>`)

Scope: test files that existed at PHASE_BASE (exclude `test_278_*`), plus `scripts/uat-adversarial-sync.py`. Rules per file, using `difflib.SequenceMatcher` over lines:
1. **No changed line** (+ or −) matches `\bassert\b|pytest\.(fail|raises)|\.assert_\w+\(`.
2. `replace` hunks with equal line counts: compare pairwise after `norm()`. Allowed if `norm(old) == norm(new)`, or both lines are import lines.
3. `insert`/`delete` hunks: every line must be an import statement, a parenthesised-import continuation, or a path-only literal line (`^\s*["'][^"']*(tools/|tool_dispatcher)[^"']*["'],?\s*$`).
4. `norm(s)`: `app\.services\.tools\.\w+` → `app.services.tool_dispatcher`; `app.services.search_documents_tool` → same (for the test_273 retarget); `tools/\w+\.py` and `"tools" / "\w+\.py"` → `tool_dispatcher.py`; alias names `\btd_\w+\b` → `td`. **Convention for executors:** any new alias is named `td_<family>`.
5. Exit 1 listing offending lines. **Drive RED** by running it against a scratch commit that edits one `assert` in a retargeted file, then discard.

Companion **no-loss source check** (same script, or a second mode): every non-blank, non-import line removed from `tool_dispatcher.py` in the move commit (stripped) appears among the lines added to `tools/*.py`. This proves comments and docstrings moved, which the AST pin cannot see. This mirrors 277's "removed-lines minus added-lines = ∅".

## DEBT-09: One Home for the Filter Vocabulary

### Every backend copy, measured [VERIFIED: grep + read]

| Copy | Location | Kind | Disposition |
|---|---|---|---|
| `_DATE_COLUMN` (3 entries) | `document_search_service.py:97-101` | word→column map | **replace by import** |
| `_DATE_FIELD_COLUMN` (4 entries, + `"date": "date_typed"`) | `retrieval_scope.py:141-146` | word→column map | **replace with `{**HOME, "date": "date_typed"}`** (D-12) |
| `_DATE_WORDS` tuple | `retrieval_scope.py:140` (used :307, :309) | word list | derive: `tuple(HOME)` (named file, edited anyway) |
| `LIST_FIELDS: tuple = ("topics",)` | `retrieval_scope.py:182` (also imported by `search_documents_tool.py:43`, used :180, :367; pinned by `test_272_review_fixes.py:127`) | list rule | **replace by import; the name must keep existing** |
| `LIST_VALUE_FIELDS: frozenset = frozenset({"topics"})` | `view_filter_compiler.py:101` (used :174) | list rule | `frozenset(HOME_LIST)` |
| `DATE_WORDS` tuple | `search_documents_tool.py:76` (used 7×) | word list | **leave (D-05: gains no logic)**; equality-fence it |
| `DateWhich = Literal[...]` | `models/document_search.py:65` | wire type | leave (hot file, 3/3/174); equality-fence via `typing.get_args` |
| `_DATE_LABELS` | `search_documents_tool.py:714-719` | word→**label** map | not the vocabulary; must not trip the fence |
| `_SORT` | `document_search_service.py:104` | sort key→column (`added_desc`…) | not the vocabulary |
| `metadata_field._BUILTINS` | `models/metadata_field.py:17` | builtin set containing `topics` | not the list rule |
| `_DATE_WORDS` | `tests/unit/test_272_tool_schema.py:27` | test constant | out of scope (test) |

### The home (`backend/app/services/document_vocabulary.py`, leaf, no app imports)

```python
"""DEBT-09 (Phase 278) — the ONE home of the document-filter vocabulary. ..."""
from __future__ import annotations

# Find's three timestamptz date words -> their public.documents column. "date" (the document's
# own date, date_typed) is deliberately NOT here: it is a compiler field (D-05 / Pitfall 14).
TIMESTAMP_DATE_COLUMNS: dict[str, str] = {
    "added": "created_at",
    "source_created": "source_created_at",
    "source_modified": "source_modified_at",
}
# Built-in metadata fields stored as a JSON ARRAY (DocumentMetadata.topics: list[str]).
LIST_FIELD_NAMES: tuple[str, ...] = ("topics",)
```
Byte-identical bindings in the 3 named files (keep each **name**, since other modules import `retrieval_scope.LIST_FIELDS`):
- `document_search_service.py`: `from app.services.document_vocabulary import TIMESTAMP_DATE_COLUMNS as _DATE_COLUMN` (same object; `:198` `_DATE_COLUMN[d.which]` unchanged).
- `retrieval_scope.py`: `_DATE_WORDS = tuple(TIMESTAMP_DATE_COLUMNS)`; `_DATE_FIELD_COLUMN = {**TIMESTAMP_DATE_COLUMNS, "date": "date_typed"}` (same key order: added, source_created, source_modified, date); `LIST_FIELDS: tuple[str, ...] = LIST_FIELD_NAMES`. The leaf import at module level does not trip `test_272_scope_resolver.py::test_find_modules_are_imported_function_locally_only`, which forbids only 4 named modules.
- `view_filter_compiler.py`: `LIST_VALUE_FIELDS: frozenset[str] = frozenset(LIST_FIELD_NAMES)`.
- Cycle safety: `document_search_service` already pulls `tool_dispatcher` in transitively, and `view_filter_compiler` imports only `app.models.document_view`. A leaf home adds no edge into either graph.

### Divergence fence (`tests/unit/test_278_vocabulary_one_home.py`)

Two layers, because each catches what the other cannot:
1. **Runtime identity/equality (the 3 named modules):** `document_search_service._DATE_COLUMN is vocab.TIMESTAMP_DATE_COLUMNS`; `retrieval_scope._DATE_FIELD_COLUMN == {**vocab.TIMESTAMP_DATE_COLUMNS, "date": "date_typed"}` with `list(...)` order checked; `retrieval_scope._DATE_WORDS == tuple(vocab.TIMESTAMP_DATE_COLUMNS)`; `retrieval_scope.LIST_FIELDS is vocab.LIST_FIELD_NAMES`; `view_filter_compiler.LIST_VALUE_FIELDS == frozenset(vocab.LIST_FIELD_NAMES)`. An **equal** re-typed copy fails the `is` checks, which is what makes "one home" mechanical rather than "currently equal". Add a source anchor: each of the 3 files contains `ImportFrom(module="app.services.document_vocabulary")`.
2. **AST ban across `backend/app/**/*.py` except the home** (non-vacuity: walked > 100 files):
   - any `ast.Dict` entry whose key is a str Constant in `{"added","source_created","source_modified"}` and whose value is a str Constant that is a column (`endswith("_at")` or `== "date_typed"`). `_DATE_LABELS` (values like `"created in file"`) and `_SORT` (keys `added_desc`) do not match.
   - any Tuple/List/Set literal, or `frozenset`/`set`/`tuple` call on one, whose string elements include `"topics"`, assigned to a name matching `(?i)list`. `_BUILTINS` does not match.
3. **Word-list equality (allowlisted copies, not edited):** `search_documents_tool.DATE_WORDS == tuple(vocab.TIMESTAMP_DATE_COLUMNS)`; `typing.get_args(models.document_search.DateWhich) == tuple(vocab.TIMESTAMP_DATE_COLUMNS)`.

**RED drives (SC#3, each restored md5-identical from a backup):**
- (a) In `document_search_service.py`, replace the import with a divergent literal `_DATE_COLUMN = {"added": "created_at", "source_created": "source_created_at"}`. Layer 1 (`is`) and layer 2 (AST dict) both go RED.
- (b) Plant a fourth-module copy `LIST_FIELDS = ("topics", "keywords")` in a scratch file under `backend/app/services/`, then delete it. Layer 2 goes RED.
- (c) Optional: `retrieval_scope._DATE_FIELD_COLUMN = {**TIMESTAMP_DATE_COLUMNS, "source_modified": "updated_at", "date": "date_typed"}`. Layer 1 goes RED.

Existing suites that pin behaviour around these names (run them targeted): `test_272_review_fixes.py`, `test_272_g1_topics_eq_compiler.py`, `test_272_scope_resolver.py`, `test_272_scope_seam.py`, `test_272_filter_validation.py`, `test_272_tool_schema.py`, `test_113_view_filter_compiler.py`, `test_271_*`, `test_275_find_archived.py`, `test_275_periods.py`.

## SEAM-02: Measured and Closed

- **Measurement (re-derived, not quoted):** `retrieval_service.py` = **23 commits / 12 phases / 174 lines**, exactly one top-level def (`search_documents`, :62); header :1-15 records the 272 split; re-export block :38-53. `python -m pytest tests/unit/test_272_pure_move.py` at `25b4235c5` → **9 passed** [VERIFIED].
- **Stale records to correct beside their originals:**
  - `CLAUDE.md:526`: `| \`backend/app/services/retrieval_service.py\` | 19 / 11 / 456 | ⛔ extraction still OWED (SEED-224, since 231) |`. Suggested (verdict 75 chars ≤ 80): `| … | 23 / 12 / 174 (was \`19 / 11 / 456\`) | ~~⛔ extraction still OWED (SEED-224, since 231)~~ ✅ DISCHARGED 272-01 (278) |`
  - `docs/HOT-FILE-LEDGER.md:7935` section `### backend/app/services/retrieval_service.py`. Its prose still reads *"THE EXTRACTION IS STILL OWED"* and *"Do not edit this row to say the obligation was met."* Add a dated `⚠ CORRECTED 2026-10-1x (Phase 278, SEAM-02)` paragraph **after** it, with the measurement and the 272 pin result. Leave the original intact (the 272 subsections at :18540/:18608/:18612 already record the move; cross-link them). The scan-list row at `:11250` already reads `✅ extraction DISCHARGED (272-01)`; only its triple may need a refresh.
  - `.planning/seeds/SEED-224-…md:97`: table row `| retrieval_service.py | 17 / 9 / 362 | **FIRES** | ⚠ none |`. Strike the cells and add a correction line under the table (measured 23/12/174, discharged by 272-01, ledger row exists). Frontmatter is already `status: folded`, `partial: true`, `folded_into: "278"` (done at discuss); flip to `partially-answered` at ship (Plan 04).
- **Optional, recommended:** `retrieval_service.py:42`'s re-export importer comment names `tool_dispatcher.py:47`. After the split that importer line lives in `tools/documents.py`. A **comment-only** fix keeps the record true. Prove "no code change" with whole-module AST identity: `ast.dump(ast.parse(base)) == ast.dump(ast.parse(head))`. It adds a phase to a FIRING file's count, so it is the planner's call; if skipped, record the stale pointer in the ledger section.

## Ledger / Docs Obligations

| File | Where | Change | Plan |
|---|---|---|---|
| `tool_dispatcher.py` | CLAUDE.md:533 + ledger section :8284 (+ "moved by 277" block :8434) + scan row :11266 | new triple (re-derive at close), verdict e.g. `✅ G-5 DISCHARGED (278): registry only; handlers in services/tools/` (≤80) | 04 (cells last) |
| `retrieval_service.py` | CLAUDE.md:526 + ledger :7935 + SEED-224:97 | SEAM-02 corrections | 02 |
| `retrieval_scope.py`, `document_search_service.py` | scan rows :10993, :11018 + sections :18526/:19590, :18244/:19696 | +1 phase each (4/2 → 3 phases: **both cross G-5 at 278**); "honoured by construction (vocabulary import)" | 04 |
| `view_filter_compiler.py` | scan row :11321 + section :10241 | FIRES (6/5/300); honoured by construction | 04 |
| **New:** `tools/__init__.py`, `base.py`, `documents.py`, `skills.py`, `sandbox.py`, `runtime_gap.py`, `render_template.py`, `workspace.py`, `memory.py`, `agent_control.py`, `connector.py`, `document_vocabulary.py` | scan list (12 rows, "young (created 278)") + a short section each | **must exist when the PLAN.md naming them is written**, or the ledger hook fires (precedent 273 `f76473497`) | planning commit, then triples in 04 |
| `docs/EXTENSION-CONTRACT.md` | :35, :117 | name the `tools/` package; trigger paths | 01 |

CLAUDE.md is at **89,480** chars (warn band 120,000). Two or three cell edits cost < 300 chars. No new CLAUDE.md rows are needed for young files (the FIRING table holds firing files only).

## Runtime State Inventory

| Category | Items Found | Action Required |
|---|---|---|
| Stored data | None. No DB row, Redis key or audit `action_type` stores a module path; `audit_log.action_type` values (`search.query`, `code.execute`, …) come from string literals inside the moved bodies and are AST-pinned unchanged [VERIFIED: full-schema.sql CHECK list; grep] | none |
| Live service config | None found in git. **Log record names change**: handler logs move from `app.services.tool_dispatcher` to `app.services.tools.<family>`. No test filters on that name (grep of `caplog`/`logger=` finds none) and no logging config names it [VERIFIED]. Any operator log search or alert in Coolify/LangSmith keyed on the old logger name would need widening [ASSUMED: none exists] | record in the SUMMARY as the one observable difference; no code action |
| OS-registered state | None (no task scheduler / pm2 entry names the module) | none |
| Secrets / env vars | None (no env var names the module) | none |
| Build artifacts | Stale `__pycache__/*.pyc` for td in several dirs (matched by grep) are harmless; the bootstrap junctions venv, no package metadata names the module | none |

## Common Pitfalls

### Pitfall 1: Silent no-op patches after the move
**What goes wrong:** `monkeypatch.setattr(td, "aexec", fake)` still succeeds if td still has an `aexec` attribute, but the handler in `tools/sandbox.py` resolves its own global. The test then either fails confusingly or passes vacuously.
**How to avoid:** td must not import any name it does not use. Re-export only the 4 app-consumed names + handlers. An un-retargeted patch then raises `AttributeError` (`mock.patch` and `monkeypatch.setattr` both require the attribute to exist).
**Warning signs:** a re-export block that grows beyond `ToolContext, ToolResult, SCRIPT_EXTS, _attachment_container_path`.

### Pitfall 2: Retargeting the emitter patches
`test_emitters.py` ×3 and `test_llm_emit_executor.py:569` must keep patching `app.services.tool_dispatcher._handle_render_template`, because `harness/emitters.py:116` imports it from td at call time. Moving them to `tools.render_template` makes the patch miss.

### Pitfall 3: Cross-family patch targets
`_fetch_owned_document_bytes` (documents, used by skills) and `_resolve_skill_visibility_or` (skills, used by sandbox) are imported by name into the calling module. Patch the **caller's** module (`tools.skills._fetch_owned_document_bytes` for attach tests). The same applies to `aexec`/`sandbox_manager`/`write_audit_entry`/`run_in_threadpool`/`ws_list_files`/`get_file_by_path`/`_get_file_content`, which live in 2-5 modules each. No measured test drives two families with one patch: every patched file exercises a single family (verified per file).

### Pitfall 4: Absence fences passing vacuously
The 8 absence-type fences (table above) must be widened and anchored **before** the move. Otherwise they report green against an empty `tool_dispatcher.py`.

### Pitfall 5: Single-file repoint of a two-family fence
`test_264_load_skill_born_for` counts 4 resolver call sites and 7 `.or_()` applications across skills **and** sandbox. Repointing it to `skills.py` alone fails with 3/5. Those numbers are not wrong; they would just be counting half the code. Use a file tuple.

### Pitfall 6: Dropped `_re_filename` alias or future import
Two moved bodies reference `_re_filename`. Without `import re as _re_filename` the module raises `NameError` at import (`_NO_MODULE_RE`) or at call time. Without `from __future__ import annotations`, `ToolContext` fails at class creation.

### Pitfall 7: Committing a RED pin
The backend gate sits at exactly 71 failed at base (zero headroom). A pre-move AST pin must be `xfail(strict=True)`, never a plain failure.

### Pitfall 8: Restoring planted files with `git checkout`
autocrlf on this box makes `git checkout -- <file>` not byte-identical. Copy to a backup before planting; restore from it; compare md5.

### Pitfall 9: Inherited failures mistaken for regressions
These fail **at base** and must fail identically after:
- Unit: the 71-test set below, which includes `test_chat_tool_approval.py::test_tool_approval_ask_emits_event_and_pauses` (`KeyError: 'call_id'`, a `_handle_connector_chat_tool` test) and `test_module7_tools.py::TestGetTools` ×2 (`get_tools`).
- Non-unit: `tests/test_223_dispatcher_audit.py::test_execution_failure_audited` and `::test_success_audited` (TypeError), and `tests/test_098_scope_governance.py::test_run_start_resolution` (ValueError).

Compare failure **sets**, not counts (`feedback_capture_the_set_never_a_tail`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Pure-move proof | eyeball diffs | `ast.dump` vs `git show <sha>:<path>` (272 precedent) | ignores comments/line numbers, catches any retyped token |
| Import-cycle proof | in-process `importlib.import_module` | fresh `subprocess` per module | `sys.modules` caching hides partial-init cycles |
| Test-diff "retarget only" | manual review | the D-07 `difflib`+normalise script | 45+ files; reviewers miss one changed `assert` |
| Registry order/static proof | substring/regex on source | AST node equality vs base + mutation scan | regexes pass over a dict built by `update()` |

## Code Examples

### Moved-binding AST comparison (extends the 272 helper to constants)
```python
# Source pattern: backend/tests/unit/test_272_pure_move.py (_blob_at_base, encoding="utf-8")
def _bindings(src: str) -> dict[str, ast.AST]:
    out = {}
    for n in ast.parse(src).body:
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            out[n.name] = n
        elif isinstance(n, (ast.Assign, ast.AnnAssign)):
            for t in (n.targets if isinstance(n, ast.Assign) else [n.target]):
                if isinstance(t, ast.Name):
                    out[t.id] = n
    return out

def test_moved_bindings_are_ast_identical():
    base = _bindings(_blob_at_base(_TD_REL))
    homes = {rel: _bindings(_module_source(rel)) for rel in set(MOVE_MAP.values())}
    compared = []
    for name, rel in MOVE_MAP.items():
        assert name in base, f"{name} not at {PHASE_BASE_SHA}"
        assert name in homes[rel], f"{name} not found in {rel}"
        assert ast.dump(homes[rel][name]) == ast.dump(base[name]), f"{name} retyped in {rel}"
        compared.append(name)
    assert len(compared) == len(MOVE_MAP)
```

### Absence-fence anchor (pre-move commit A shape)
```python
_HANDLER_FILES = (APP_DIR / "services" / "tool_dispatcher.py",)   # commit B swaps in tools/*.py
def test_no_expert_handler_in_any_handler_file():
    seen = 0
    for path in _HANDLER_FILES:
        tree = ast.parse(path.read_text(encoding="utf-8"))
        defs = [n.name for n in ast.walk(tree) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))]
        assert any(d.startswith(("_handle_", "handle_")) for d in defs), f"ANCHOR: no handler in {path.name}"
        seen += 1
        assert not [d for d in defs if d.startswith("_handle_expert")]
    assert seen == len(_HANDLER_FILES)
```

## State of the Art

| Old | Current | When | Impact |
|---|---|---|---|
| Handlers + registry in one 5,068-line file | registry module + `tools/` family package | 278 | G-5 discharged; each family is under ~1,200 L |
| Two divergent date maps + two list-field sets | one leaf home + identity fence | 278 | SEED-336 becomes a one-place fix later |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | No operator log search/alert in Coolify or LangSmith keys on the logger name `app.services.tool_dispatcher` | Runtime State Inventory | An alert or saved search silently stops matching handler logs; fix is to widen the search |
| A2 | `tests/integration/test_085_*` suites do not mutate the local DB (they passed in 12.9 s alongside unit-style suites at base) | Plan shape / worktree rule 4 | If they do, Plan 01's integration runs must not overlap another DB-touching run |
| A3 | The planner prefers per-function alias swaps (import-line-only) over editing call lines | Retarget inventory | More body-line edits, so the D-07 normaliser needs the `td_<family>` alias rule |

## Open Questions

1. **Comment-only fix to `retrieval_service.py:42`** (stale importer path after the split).
   - Known: the comment names `tool_dispatcher.py:47`; after the split, the importer is `tools/documents.py`.
   - Unclear: whether D-09's "no code change" admits a comment edit on a FIRING file.
   - Recommendation: do it in Plan 04 with the whole-module AST-identity proof; otherwise record the stale pointer in the ledger section.
2. **Logger names** (`__name__` vs keeping `"app.services.tool_dispatcher"`).
   - Recommendation: use `__name__` (convention; nothing depends on the old name). Record the change.
3. **Where `_repeat_blocked_result` lives** (sandbox vs runtime_gap). Either is AST-safe; recommend runtime_gap (all Phase-142 pure helpers together).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| Python venv | all backend work | ✓ | 3.12.6 | — |
| git | AST pins (`git show`) | ✓ | — | — |
| Node | ledger/size/extension-contract gates | ✓ | — | — |
| Local Supabase + Redis | full backend gate (some unit tests), integration suites, SC#5 smoke | ✓ (baseline ran) | — | — |
| Backend server + Anthropic key | SC#5 live smoke | operator-started | — | ⛔ row with reason if unavailable (never omitted) |

## Validation Architecture

(`nyquist_validation: false`, so this section is kept short and limited to what the planner needs.)

**Baseline at `25b4235c5` (measured 2026-10-13, under the local-DB lock):** `pytest tests/unit -q --continue-on-collection-errors` → **71 failed, 7162 passed, 1 skipped, 2 xfailed, 2 xpassed, 0 collection errors** in 366.7 s. That is exactly at the ceiling. The CLAUDE.md "3497 passed" figure is the older locked line; only `failed ≤ 71` and `0 collection errors` gate. Failing set by file: `test_retrieval_service.py` 15, `test_sql_service.py` 12, `test_explorer_agent.py` 6, `test_multimodal_query.py` 5, `test_111_1_reembed_kickoff.py` 4, `test_sandbox_service.py` 3, `test_lifespan.py` 3, `test_db_runs.py` 3, `test_module7_tools.py` 2, `test_extraction_service.py` 2, `test_cross_worker_cancellation.py` 2, `test_071_1_threadpool_sweep.py` 2, and 1 each in `test_streaming_reliability`, `test_published_workflow_ownership`, `test_phase56_iteration_start`, `test_per_format_ingestion`, `test_get_model_capability_inference`, `test_forced_emit`, `test_chat_tool_approval`, `test_200_1_phase_output_shape`, `test_190_review_fix_data_layer`, `test_182_validate`, `test_075_4_unknown_provider_error`, `test_061_consumer`. **Re-capture the full node-id set at base in Plan 04** (`grep ^FAILED`) and diff sets.

**Targeted suites per plan:**
- Plan 01: `test_278_registry_pin.py`, `test_278_pure_move.py`, plus every file in the retarget and fence tables (≈45 files), `test_272_search_tool_move.py`, `test_085_tool_registration.py`, `test_151_registration.py`, `test_115/116_tool_wiring.py`, `test_189_no_egress.py`. Also the non-unit set: `tests/test_224…`, `test_223…`, `test_147…`, `test_workspace_template.py`, `tests/integration/test_085_ask_user_handler.py`, `test_085_lifespan_shutdown.py`, `test_2171…`, `test_098…`, `test_099…`, `test_harness_whitelist.py` (base: 90 passed / 3 failed, inherited). Plus `node scripts/check-extension-contract.cjs`, `node scripts/check-landing-drift.cjs`.
- Plan 03: `test_278_vocabulary_one_home.py` + the DEBT-09 list above.
- Plan 04: full backend gate (with lock), vitest count gate (`GSD_VITEST_MAX_WORKERS=2`; frontend is untouched, so expect no per-file decrease), `test_272_pure_move.py::test_unfiltered_rpc_calls_are_pinned`, `test_275_*`, `check-hot-file-ledger.cjs 278`, `check-claude-md-size.cjs`.

**SC#5 smoke query (read-only, local):** `SELECT action_type, metadata->>'run_id' AS run_id, created_at FROM public.audit_log WHERE action_type IN ('search.query','code.execute') AND created_at > now() - interval '15 minutes' ORDER BY created_at DESC;`. Both rows must be present with a non-null `run_id` (`search_documents_tool.py:838` writes it).

## Recommended Plan Shape (G-8: 4 plans)

| Plan | Wave | Scope | Files (non-test) | Parallel-safe? |
|---|---|---|---|---|
| **01 Split** | 1 | **Commit A:** registry pin (green, RED-driven), AST pin (`xfail strict`), fence hardening (anchors, tuples, hoisted constants; green at base, each anchor driven RED). **Commit B:** atomic move + test retargets + `uat-adversarial-sync.py`; D-07 script + no-loss check run on A..B. **Commit C:** extension-contract trigger lists (cjs + hook + test_255), `docs/EXTENSION-CONTRACT.md` | `tool_dispatcher.py`, `tools/*.py` (11 new), scripts, hook, docs | yes, no overlap with 02/03 |
| **02 SEAM-02 records** | 1 | 272 pin run recorded; CLAUDE.md:526 + ledger :7935 + SEED-224:97 corrections (same commit) | docs only | yes |
| **03 Vocabulary** | 1 | home module, 3 import edits, fence (RED-driven ×2-3, restored md5-identical) | `document_vocabulary.py` (new), `retrieval_scope.py`, `document_search_service.py`, `view_filter_compiler.py` | yes, unit-only, no DB |
| **04 Merged-tree gates + smoke** | 2 | full backend gate (failure **set** = base), vitest gate, all guard scripts, ledger cells written LAST (tool_dispatcher, 3 vocab files, 12 new rows' triples), SEED-224 → `partially-answered`, optional retrieval_service comment fix, SC#5 Anthropic smoke (`checkpoint:human-action`: operator starts the backend) | docs, CLAUDE.md, seeds | after wave 1 merge |

Worktree rule 4: no wave-1 plan mutates the local DB in its targeted suites. Run only one full backend gate at a time (Plan 04, under the lock file). Plan 01's commit B is ~5,000 moved lines plus ~45 test files; keep it **one commit** so D-07 has one range to check.

## Security Domain

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | **yes**: folder wall (`_doc_out_of_scope`), skill org gate (`_resolve_skill_visibility_or`), retention wall (`unretrievable`), connector trifecta/approval, phase whitelist refusal, capability kill-switch | preserved byte-for-byte by the AST pin; fences 4/6/9-15 widened, not dropped |
| V5 Input Validation | yes: `_safe_out_filename`, `_attachment_container_path` traversal reductions, `_normalize_optional*` | AST-pinned |
| V6 Cryptography | no | — |

| Threat | STRIDE | Mitigation |
|---|---|---|
| A move silently drops a security wall or audit write | Tampering / Repudiation | AST identity for all 99 moved bindings + "exactly one home" + the no-loss line check |
| A security test turns vacuous (its patch no longer reaches the code) | Elevation of privilege (undetected) | td stops importing unused names, so stale patches raise; absence fences are anchored |
| The registry gains a dynamically registered tool | Elevation of privilege | static-literal AST equality + mutation scan + extension-contract scanner extended to `tools/*.py` |
| SSTI containment site moves out of the scanned set | Tampering | `test_190_ssti_fence` `_SANDBOXED_SITES` repointed to `tools/render_template.py` (presence fence, loud) |

## Sources

### Primary (HIGH confidence, all measured in this session at `25b4235c5`)
- `backend/app/services/tool_dispatcher.py`: full AST walk (bindings, line ranges, name-use per def, lazy imports, `globals()` use)
- Fresh-interpreter import probe of 33 modules (`tool_dispatcher_loaded` per module)
- AST classifier over `backend/tests/**` (string/object patches, imports, attribute reads, source reads) → 535 classified references
- `backend/tests/unit/test_272_pure_move.py` (pattern; 9 passed at base), `test_259/261/255/264*/275/190*/216/221/222/075_1/tool_approval_always` (fence bodies read)
- `backend/app/services/openai_service.py:1310-1367` (`get_tools` flags), `:880` (`RENDER_TEMPLATE_TOOL`)
- `retrieval_scope.py:138-183`, `document_search_service.py:95-111`, `view_filter_compiler.py:97-101`, `search_documents_tool.py:41-76,714-719`, `models/document_search.py:65`
- `scripts/check-hot-file-ledger.cjs`, `scripts/check-claude-md-size.cjs` (run: 89,480 chars OK), `scripts/check-extension-contract.cjs` (run: OK), `scripts/check-landing-drift.cjs:152-164`
- Backend unit baseline run (366.7 s) and non-unit retarget-suite run (12.9 s)
- `supabase/full-schema.sql:1398-1406` (`audit_log` columns + action_type CHECK)

### Secondary / Tertiary
- None. No external documentation was needed for a pure Python move.

## Metadata

**Confidence breakdown:**
- Move map / cycles: HIGH. Mechanical AST + fresh-interpreter probes.
- Test inventory: HIGH for counts and locations. The per-file strategy is a recommendation (A3).
- DEBT-09: HIGH. Every copy was grepped and every consumer read.
- SEAM-02: HIGH. Re-derived triple and pin run.

**Research date:** 2026-10-13
**Valid until:** the next commit that touches `tool_dispatcher.py` or any test in the inventory. Re-run the classifier if HEAD moves past `25b4235c5` before execution.
