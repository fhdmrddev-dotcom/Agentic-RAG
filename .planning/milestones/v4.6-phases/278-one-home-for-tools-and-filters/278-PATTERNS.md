# Phase 278: One Home for Tools and Filters - Pattern Map

**Mapped:** 2026-10-13 (HEAD `82b34b6f5`; research base `25b4235c5`)
**Files analyzed:** 33 new/modified files plus about 45 retargeted tests (grouped as one row)
**Analogs found:** 31 / 33 (2 are docstring-only or prose files that need no analog)

The research (`278-RESEARCH.md`) already holds the move map, the retarget inventory and the fence inventory. This file says which existing file each new or modified file should copy from, with line numbers. It does not repeat the inventories.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `backend/app/services/tool_dispatcher.py` (MODIFY → registry only) | registry/router | request-response (dispatch) | `backend/app/services/retrieval_service.py` :1-58 (post-272 orchestrator + back-compat block) | exact (same pure-move shape) |
| `backend/app/services/tools/__init__.py` (NEW) | config (package marker) | — | none needed: docstring only, no imports | n/a |
| `backend/app/services/tools/base.py` (NEW, leaf) | model (dataclasses) | — | `backend/app/services/retrieval_rank.py` :1-10 (pure leaf header) + `tool_dispatcher.py` :97-227 (the moved bodies) | role-match |
| `tools/documents.py`, `skills.py`, `sandbox.py`, `render_template.py`, `workspace.py`, `memory.py`, `agent_control.py`, `connector.py` (NEW) | service (tool handlers) | request-response, CRUD / file-I/O | `backend/app/services/show_artifact_tool.py` :1-69 and `search_documents_tool.py` :1-55 | exact (out-of-file handler modules) |
| `backend/app/services/tools/runtime_gap.py` (NEW) | utility (pure classifier) | transform | `backend/app/services/retrieval_rank.py` :1-10 | exact (pure, no I/O) |
| `backend/tests/unit/test_278_pure_move.py` (NEW) | test (AST pin) | batch (git-show compare) | `backend/tests/unit/test_272_pure_move.py` | exact |
| `backend/tests/unit/test_278_registry_pin.py` (NEW) | test (registry pin) | — | `test_272_search_tool_move.py` :67-73 and :137-148, `test_259_closed_core_inventory.py` :38-53 | exact |
| ~45 retargeted tests (table A-D in RESEARCH) | test | — | `test_272_search_tool_move.py` :175-200 (patch-where-used pair) | exact |
| Absence-fence hardening (`test_259`, `test_261`, `test_216`, `test_222`, `test_255`, `test_264_*` ×4, `test_275_agent_wall`) | test (source fence) | — | `test_257_single_token_conversion_home.py` (walk + non-vacuity) and RESEARCH "Absence-fence anchor" | role-match |
| `scripts/check-test-retarget-only.py` (NEW, D-07) | utility (CI check) | batch (git diff) | `scripts/check-greenfield-privileges.py` (python checker, 0/1/2 exit, `main()` → `sys.exit`) | partial (no existing diff checker) |
| `scripts/check-extension-contract.cjs` (MODIFY) | config (guard list) | — | itself :41-48 `TRIGGER_PATHS` | exact |
| `.claude/hooks/extension-contract-guard.js` (MODIFY) | config (hook list) | event-driven | itself :23-30 `WATCHED_FILES` | exact |
| `scripts/uat-adversarial-sync.py` (MODIFY) | script | — | one string patch target → `tools.connector` | trivial |
| `docs/EXTENSION-CONTRACT.md` (MODIFY) | docs | — | prose at :35, :117 | n/a |
| `backend/app/services/document_vocabulary.py` (NEW, leaf) | config (constants) | — | `backend/app/services/retrieval_rank.py` :1-10 | role-match |
| `backend/app/services/retrieval_scope.py` (MODIFY) | service | transform | itself :136-146, :182 | n/a (import swap) |
| `backend/app/services/document_search_service.py` (MODIFY) | service | CRUD (read) | itself :95-101 | n/a (import swap) |
| `backend/app/services/view_filter_compiler.py` (MODIFY) | utility (compiler) | transform | itself :99-101 | n/a (import swap) |
| `backend/tests/unit/test_278_vocabulary_one_home.py` (NEW) | test (divergence fence) | — | `backend/tests/unit/test_257_single_token_conversion_home.py` | exact (single-home AST fence) |
| `CLAUDE.md`, `docs/HOT-FILE-LEDGER.md`, `.planning/seeds/SEED-224-…md` (MODIFY) | docs | — | the existing `⚠ CORRECTED … original struck through` paragraphs; scan row `HOT-FILE-LEDGER.md:11002` | exact |

---

## Pattern Assignments

### `backend/app/services/tool_dispatcher.py` (registry module, request-response)

**Analog:** `backend/app/services/retrieval_service.py` (the 272-01 pure-move result).

**Module header recording the move** (`retrieval_service.py` :1-16). Copy this shape: say what stays, list where everything went, and name the test that proves it:
```python
"""Retrieval ORCHESTRATOR — ``search_documents``: embed → arms → fuse → rerank → enrich.

Phase 272 (D-13) split this file. ...
What remains here is the orchestrator only — its decorator and body are byte-unchanged
(``tests/unit/test_272_pure_move.py``). Everything it composes now lives in:

* ``retrieval_rpc.py``       — ``_vector_literal``, ``_call_as_user``, ...
* ``retrieval_rank.py``      — ``_rrf_fuse``, ``_deduplicate_chunks``, ``_avg_cosine`` (pure)
```
Note: the current td docstring (:1-12) says *"Adding a new tool requires only: 1. Write an async _handle_<name> ... 2. Register it in _TOOL_REGISTRY"*. After the split, step 1 points at `tools/<family>.py`.

**Back-compat re-export block (D-04 template)** (`retrieval_service.py` :39-53):
```python
# ── Back-compat re-exports (Phase 272, D-13) ─────────────────────────────────────────────────
# These names moved; every measured importer still reads them from HERE, so they stay importable
# and are the SAME objects as in their new homes (pinned by test_272_pure_move::test_back_compat_names):
#   tool_dispatcher.py:47            search_documents, resolve_document_id, fetch_full_document
#   agent_loop.py:79                 _call_as_user, _vector_literal
# ⚠ A PATCH of one of these names HERE no longer reaches the code that calls it — patch the
#   module that now resolves it (patch-where-used).
from app.services.openai_service import embed_texts  # noqa: F401 — re-export only
from app.services.retrieval_documents import fetch_full_document, resolve_document_id  # noqa: F401
```
For 278 the list is exactly `ToolContext`, `ToolResult` (from `tools/base.py`), `SCRIPT_EXTS` (`app/api/skills.py:37`) and `_attachment_container_path` (`agent_loop.py:82`). Name each importer in the comment the same way. Re-export nothing else (RESEARCH Pitfall 1: an extra re-export lets a stale patch succeed and reach nothing).

**Existing out-of-file handler imports to keep as they are** (`tool_dispatcher.py` :49-52):
```python
# Phase 272 (D-15) — handler moved to search_documents_tool.py; registry/handler split still OWED (→273)
from app.services.search_documents_tool import handle_search_documents as _handle_search_documents
# Phase 273 (D-14) — show_artifact handler in its own module; registry/handler split still OWED (OV-273-02)
from app.services.show_artifact_tool import handle_show_artifact as _handle_show_artifact
```
Copy this one-import-per-handler form for the new `from app.services.tools.<family> import (_handle_…)` lines. The trailing "still OWED" comments become stale and can be updated. Comment lines are outside the AST pin, but D-07 only checks test files.

**Registry literal, kept byte-identical** (`tool_dispatcher.py` :4553-4592, header plus first entries):
```python
_TOOL_REGISTRY: dict[str, Callable] = {
    "ls": _handle_ls,
    "tree": _handle_tree,
    ...
    # Phase 273 (D-01 / D-14) — registry + get_tools BOTH; handler in show_artifact_tool.py, one line here
    "show_artifact": _handle_show_artifact,
}
```
Do not edit this block at all, comments included. `scripts/check-landing-drift.cjs:153-156`, `scripts/lib/docs-content.cjs` and two frontend docs tests regex-parse it.

**dispatch_tool stays unchanged** (`tool_dispatcher.py` :5033-5068). It resolves `_handle_connector_chat_tool` as a module global at :5066, so td must import that name from `tools/connector.py`:
```python
    handler = _TOOL_REGISTRY.get(tool_name)
    if handler is None:
        if "__" in tool_name:
            service_id, action_tool_name = tool_name.split("__", 1)
            return await _handle_connector_chat_tool(service_id, action_tool_name, args, ctx)
        return ToolResult(result=f"Unknown tool: {tool_name}")
    return await handler(args, ctx)
```

---

### `backend/app/services/tools/{documents,skills,sandbox,render_template,workspace,memory,agent_control,connector}.py` (handler modules)

**Analog:** `backend/app/services/show_artifact_tool.py` :1-69 (the 273 narrow cut). `search_documents_tool.py` :1-55 is the second example.

**Module docstring: the two binding rules every handler module states** (`show_artifact_tool.py` :34-39):
```python
⚠ PATCH-WHERE-USED: the handler resolves ``insert_artifact``, ``get_artifact_by_ref`` and
``list_thread_labels`` from THIS module. Patch ``app.services.show_artifact_tool.<name>``.

⛔ Import-cycle rule: no module-level import of ``app.services.tool_dispatcher`` here (the
dispatcher imports this module at load). ``ToolResult`` is imported inside the handler.
"""
from __future__ import annotations
```
Copy both paragraphs into each family module and list that module's own patchable names (for example `aexec`, `sandbox_manager`, `write_audit_entry`).
⚠ **Difference from the analog:** the moved bodies use `ToolResult(...)` and `ToolContext` as **module globals**, so the AST pin requires a **module-level** `from app.services.tools.base import ToolContext, ToolResult`. Do not copy the analog's `if TYPE_CHECKING:` / function-local import. That form exists only because those two modules import from `tool_dispatcher`. `tools/base.py` is a leaf, so a module-level import is cycle-safe.

**Imports layout** (`show_artifact_tool.py` :40-69): `from __future__ import annotations` first, stdlib, third-party, `app.*` by name, then `logger = logging.getLogger(__name__)`. Per-family import lists are in RESEARCH § "Module-level imports per family". Two special cases:
- `runtime_gap.py` and `render_template.py` must both keep `import re as _re_filename` (base :3239). Moved bodies reference that alias.
- `documents.py` takes the lazy-resolver sentinels plus `_ensure_resolver` verbatim (td :236-261). `g = globals()` then binds `documents`' globals, which is where `_handle_query_documents_by_view` resolves `resolve_filter`:
```python
resolve_filter = None  # type: ignore[assignment]
ResolveError = None  # type: ignore[assignment]
_build_field_meta = None  # type: ignore[assignment]

def _ensure_resolver() -> None:
    ...
    g = globals()
    if g.get("resolve_filter") is None or ...:
        from app.services.document_view_resolver import (
```

**Cross-family imports by name, never via module attribute** (RESEARCH § "Shared helpers"). For example, in skills: `from app.services.tools.documents import _fetch_owned_document_bytes`. In sandbox: `from app.services.tools.skills import _resolve_skill_visibility_or`.

**Inter-node comment blocks move with the code that follows them.** The 272 analog's header records *"moved VERBATIM"*. Same rule here: the AST pin cannot see comments, but the D-07 no-loss check can.

---

### `backend/app/services/tools/base.py` and `tools/runtime_gap.py` (leaf modules)

**Analog:** `backend/app/services/retrieval_rank.py` :1-10:
```python
"""Phase 272 (D-13) — pure ranking helpers, moved VERBATIM out of ``retrieval_service.py``.

Part of discharging the ``retrieval_service.py`` extraction that had been owed since Phase 231 (SEED-224);
``tests/unit/test_272_pure_move.py`` proves each function is AST-identical to its PHASE_BASE source.

... ⛔ **What this module is NOT:** it does no I/O — no database, no embedding, no network. A function
that needs any of those belongs in ``retrieval_rpc.py`` or ``retrieval_documents.py``, never here.
"""
from __future__ import annotations
```
`base.py` additionally carries td's `TYPE_CHECKING` block verbatim (td :97-101). `from __future__ import annotations` is mandatory, because `ToolContext` fields name TYPE_CHECKING-only types (RESEARCH Pitfall 6):
```python
if TYPE_CHECKING:
    import asyncpg
    import redis.asyncio as aioredis
    from supabase import Client
    from app.models.user_settings import UserEffectiveSettings
```

---

### `backend/tests/unit/test_278_pure_move.py` (AST pin)

**Analog:** `backend/tests/unit/test_272_pure_move.py`. Copy:

- **Module docstring** (:1-23): numbered list of what is proven, and the `MOVE_MAP` minus `RETIRED` structure.
- **Constants** (:33, :39-55, :82): `PLAN_BASE_SHA`, `REPO_ROOT = Path(__file__).resolve().parents[3]`, `_BASE_REL`, `MOVE_MAP: dict[str, str]`, `RETIRED: dict[str, str]` (empty in 278; keep the shape).
- **`_blob_at_base`** (:96-109), including the Windows encoding comment:
```python
def _blob_at_base(rel_path: str, sha: str = PLAN_BASE_SHA) -> str:
    # ⚠ `encoding` IS LOAD-BEARING ON WINDOWS (the test_214 precedent). ...
    return subprocess.run(
        ["git", "show", f"{sha}:{rel_path}"],
        cwd=REPO_ROOT, capture_output=True, text=True, encoding="utf-8", check=True,
    ).stdout
```
- **The compare loop + non-vacuity** (:140-157):
```python
def test_moved_functions_are_ast_identical():
    base_src = _blob_at_base(_BASE_REL)
    compared = []
    for name, new_home in MOVE_MAP.items():
        if name in RETIRED:
            continue
        ...
        assert base_fn is not None, f"{name} not found in {_BASE_REL} at {PLAN_BASE_SHA}"
        assert new_fn is not None, f"{name} not found in {new_home}"
        assert _dump(new_fn, ...) == _dump(base_fn, ...), (... "A pure move is a cut, never a rewrite.")
        compared.append(name)
    # Non-vacuity: every name the map promises was found in BOTH sources and compared.
    assert len(compared) == len(MOVE_MAP) - len(RETIRED)
```
Extend `_top_level_function` to the `_bindings()` helper in RESEARCH § "Code Examples". It must also cover `Assign`/`AnnAssign` and `ClassDef`, so constants like `_RENDER_DRIVER_SRC` and the dataclasses are pinned.
- **Back-compat identity** (:282-298) → the D-04 re-export check:
```python
    for name, home in homes.items():
        assert hasattr(rs, name), f"retrieval_service.{name} is gone — a measured importer reads it"
        assert getattr(rs, name) is getattr(home, name), (
            f"retrieval_service.{name} is not the object in {home.__name__} — a copy, not a re-export"
        )
```
- **Base-SHA convention:** `PHASE_BASE_SHA = "25b4235c540b1e21a055301ce576d1deb78d5634"` (RESEARCH). If HEAD has moved past it in `tool_dispatcher.py`, the planner pins the actual pre-move commit.
- New in 278 (no analog): `xfail(strict=True)` while RED at base (RESEARCH Pitfall 7), plus the fresh-subprocess import test per module.

---

### `backend/tests/unit/test_278_registry_pin.py`

**Analog 1:** `test_272_search_tool_move.py` :67-73, registry identity by `is`:
```python
def test_registry_and_reexport_are_the_moved_handler():
    td, tool = _td(), _tool()
    assert td._TOOL_REGISTRY["search_documents"] is tool.handle_search_documents
    assert td._handle_search_documents is tool.handle_search_documents
    assert len(td._TOOL_REGISTRY) == 30  # Phase 273: 29 → 30, the deliberate show_artifact
```
**Analog 2:** `test_272_search_tool_move.py` :137-148, the module-level-import ban. Reuse it for "no `tools/*.py` imports tool_dispatcher at module level":
```python
def test_no_module_level_import_of_tool_dispatcher():
    tree = ast.parse((REPO_ROOT / _TOOL_REL).read_text(encoding="utf-8"))
    offenders = []
    for node in tree.body:  # module-level statements ONLY
        if isinstance(node, ast.ImportFrom) and node.module == "app.services.tool_dispatcher":
            offenders.append(ast.dump(node))
        ...
    assert offenders == [], f"module-level tool_dispatcher import would cycle: {offenders}"
```
**Analog 3:** `test_259_closed_core_inventory.py` :38-46, the 30-count style and failure message. The static-literal, mutation-scan and schema-hash tests are specified in RESEARCH § "Registry pin". No codebase analog hashes `get_tools()` output.

---

### Retargeted tests (D-06, ~45 files)

**Analog:** `test_272_search_tool_move.py` :175-200. 272 already proved patch-where-used on this exact registry, with a positive/negative pair:
```python
def test_patch_where_used_new_target_is_hit(monkeypatch):
    td, tool = _td(), _tool()
    ...
    monkeypatch.setattr(tool, "search_documents", _rec)
    monkeypatch.setattr(tool, "write_audit_entry", AsyncMock())

def test_patch_where_used_old_target_alone_is_missed(monkeypatch):
    """Patching only ``td.search_documents`` no longer reaches the handler. ..."""
```
Retarget form (D-07-safe): change only the import or alias line, for example `from app.services.tools import sandbox as td_sandbox` (the `td_<family>` alias convention from RESEARCH § D-07 rule 4), or the module string inside `mock.patch("app.services.tools.<family>.<name>")`. Do not retarget the 4 emitter patches (`test_emitters.py` :65,99,127 and `test_llm_emit_executor.py` :569), or `test_147_flag_refuse.py` ×4.

---

### Absence-fence hardening (D-08, pre-move commit A)

**Current vacuous-after-move shape** (`test_259_closed_core_inventory.py` :48-53). It scans exactly one file and passes if that file is empty:
```python
    dispatcher_path = APP_DIR / "services" / "tool_dispatcher.py"
    tree = ast.parse(dispatcher_path.read_text(encoding="utf-8"), filename=str(dispatcher_path))
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            if node.name.startswith("_handle_expert"):
                pytest.fail(...)
```
**Target shape:** hoist to a `_HANDLER_FILES` tuple and assert an anchor per file (RESEARCH § "Absence-fence anchor"). Commit A keeps the tuple as `(…/tool_dispatcher.py,)`; commit B swaps in the `tools/*.py` paths plus `search_documents_tool.py` and `show_artifact_tool.py`.

**Single-file path inside an assert** (`test_275_agent_wall.py` :461). Hoist it to a constant in commit A so commit B edits a constant line, not an assert:
```python
    assert hits == {"services/tool_dispatcher.py": 3}, hits  # 2 resolve_filter legs + 1 relationships
```
**Module-level source handle used by many fences** (`test_264_load_skill_born_for.py` :67, read at :325, :362, :417, :452, :700):
```python
_DISPATCHER_SRC = Path(inspect.getsourcefile(td))
```
Make this a tuple and have each fence iterate or concatenate over it. These counts span skills and sandbox (RESEARCH Pitfall 5).

**Trigger list in a test** (`test_255_extension_contract_guard.py` :28-36). Append each `tools/*.py` path:
```python
TRIGGER_FILES = [
    Path("app/services/harness/phase_types.py"),
    ...
    Path("app/services/tool_dispatcher.py"),
    Path("app/services/agent_loop.py"),
]
```

---

### `scripts/check-extension-contract.cjs` and `.claude/hooks/extension-contract-guard.js`

**Analog:** the files themselves. Extend the explicit lists. Do not glob, because the files' own convention is a closed, named list:
- `check-extension-contract.cjs` :41-48 `const TRIGGER_PATHS = [ … 'backend/app/services/tool_dispatcher.py', … ];` Also update the header comment list at :21-28 ("six trigger files").
- `extension-contract-guard.js` :23-30 `const WATCHED_FILES = new Set([ … ]);` and its header at :5-11.
- `checkFile` (:98-102) already returns `File not found` as a violation, so a misspelled new path fails loudly. That is the anchor.
- The rule `/_TOOL_REGISTRY\[[^\]]+\]\s*=/` (:76-79) already bans subscript mutation. The scanner then covers the handler files too.

---

### `scripts/check-test-retarget-only.py` (D-07, NEW)

**Analog (partial):** `scripts/check-greenfield-privileges.py`. It has a long `"""` docstring naming the phase/decision and listing the ways the check could lie, `def main(argv: list[str] | None = None) -> int` (:1284), and `sys.exit(main())` (:1323). Exit codes follow the repo convention used by every `check-*.cjs`: `0` clear, `1` violation, `2` harness error. The diff rules, the `norm()` function and the RED drive are specified in RESEARCH § "D-07 mechanical test-diff check". No existing script compares diffs.

---

### `backend/app/services/document_vocabulary.py` (NEW leaf, DEBT-09)

**Analog:** `retrieval_rank.py` :1-10 header shape (phase + decision, "what this module is NOT", `from __future__ import annotations`, no app imports). The contents are spelled out in RESEARCH § "The home". The comment text to carry forward comes from the two copies being deleted:

`retrieval_scope.py` :137-146 (the 4-entry map, which keeps `"date"` as a named extension):
```python
# Find's three timestamptz dates resolve through ``FindDate`` (Pitfall 14: BEFORE the compiler, so
# a custom key spelled ``added`` can never shadow them). ``date`` — the document's own date — is NOT
# here: it is the compiler's ``date_typed`` field (D-05). Mirrors document_search_service._DATE_COLUMN.
_DATE_WORDS = ("added", "source_created", "source_modified")
_DATE_FIELD_COLUMN = {
    "added": "created_at",
    "source_created": "source_created_at",
    "source_modified": "source_modified_at",
    "date": "date_typed",
}
```
`retrieval_scope.py` :176-182, the CR-01 rationale for the list rule, which belongs in the home:
```python
# ... every other op is refused. ⛔ Tests pin this tuple to the list-typed DocumentMetadata fields.
LIST_FIELDS: tuple[str, ...] = ("topics",)
```
`document_search_service.py` :95-101 (`_DATE_COLUMN`, 3 entries) and `view_filter_compiler.py` :99-101 (`LIST_VALUE_FIELDS: frozenset[str] = frozenset({"topics"})`, comment "mirrors retrieval_scope.LIST_FIELDS"). Both "Mirrors …" comments are the drift the fence ends. Replace them with a pointer to the home.

⚠ **Names that must survive:** `retrieval_scope.LIST_FIELDS` is imported by `search_documents_tool.py:43` and pinned by `test_272_review_fixes.py` :127-131 (`assert set(rscope.LIST_FIELDS) == listy == {"topics"}`). Keep the name as a binding to the home object.

---

### `backend/tests/unit/test_278_vocabulary_one_home.py` (divergence fence)

**Analog:** `backend/tests/unit/test_257_single_token_conversion_home.py`. This is the repo's single-home AST fence, and its history is the reason the fence must be driven RED.

**Allowed-home constant + walk + collected violations** (:22-24, :119-162):
```python
ALLOWED_HOMES = {
    pathlib.Path("services") / "pricing_service.py",
}
...
def test_no_external_token_to_usd_conversion_homes():
    violations = []
    for root, _, files in os.walk(APP_DIR):
        for file in files:
            if not file.endswith(".py"):
                continue
            full_path = pathlib.Path(root) / file
            rel_path = full_path.relative_to(APP_DIR)
            if _is_allowed_file(rel_path):
                continue
            tree = ast.parse(full_path.read_text(encoding="utf-8-sig", errors="replace"), ...)
            ...
    assert not violations, "METER-02 AST single-home fence violated:\n" + "\n".join(violations)
```
**The recorded lesson to copy as a comment** (:37-55): the first detector was *"PROVEN BLIND"*. It matched only a literal, so a planted copy of the canonical function passed with 1 passed. The planted-probe RED drive is how it was found. 278's RED drives (a) through (c) in RESEARCH follow this precedent.

**278 additions not in the analog:** non-vacuity `files_walked > 100`, and the runtime `is` identity layer over the 3 named modules. An equal re-typed copy passes an equality check and fails an `is` check. Layer specs are in RESEARCH § "Divergence fence".

---

### Records (Plan 02 / 04): `CLAUDE.md`, `docs/HOT-FILE-LEDGER.md`, `SEED-224`

**Correction-beside-original pattern:** used throughout CLAUDE.md (for example the `⚠ CORRECTED 2026-09-13 (Phase 245, D-15) — REFUTED, and the original is struck through rather than deleted` bullet). FIRING-table triple form with the old value kept: `| \`…/documents.py\` | 92 / 36 / 2532 (was \`91 / 35 / 2518\`) | last touch 275-02 |`. Verdict cell ≤ 80 chars.

**New-file scan-list row precedent** (`docs/HOT-FILE-LEDGER.md:11002`, written in 273's planning commit `f76473497`):
```
| [`backend/app/services/show_artifact_tool.py`](docs/HOT-FILE-LEDGER.md#backendappservicesshowartifacttoolpy) | 1 / 1 / 607 (was `0 / 0 / 0`) | no (young) | young (273-03). ... |
```
Each of the 12 new files (`tools/*.py` ×11 + `document_vocabulary.py`) needs a row like this, plus a `### <path>` section (precedent `:18656`). They must exist **before** any PLAN.md naming them is written, or `hot-file-ledger-guard.js` fires.

---

## Shared Patterns

### Patch-where-used + import-cycle rule (docstring contract)
**Source:** `show_artifact_tool.py` :34-39, `search_documents_tool.py` :15-23
**Apply to:** every `tools/*.py` handler module
Each module states which names to patch on it, and that it never imports `app.services.tool_dispatcher` at module level. Enforced by the AST test copied from `test_272_search_tool_move.py` :137-148.

### Pure-move proof via `git show <sha>` + `ast.dump`
**Source:** `test_272_pure_move.py` :96-157
**Apply to:** `test_278_pure_move.py`, `test_278_registry_pin.py` (static-literal equality vs base)
Always use `encoding="utf-8"`, and always end with a non-vacuity count assert.

### Back-compat re-export with named importers
**Source:** `retrieval_service.py` :39-53, pinned by `test_272_pure_move.py` :282-298 (`is` identity)
**Apply to:** `tool_dispatcher.py` re-exports (4 names only)

### Closed, explicitly listed guard scope (never a glob)
**Source:** `check-extension-contract.cjs` :41-48, `extension-contract-guard.js` :23-30, `test_255_extension_contract_guard.py` :28-36, `test_257` `ALLOWED_HOMES` :22-24
**Apply to:** all three extension-contract lists, the D-08 `_HANDLER_FILES` tuples, and the vocabulary fence allowlist

### Non-vacuity anchors on every source fence
**Source:** `test_272_pure_move.py` :156-157 (`assert len(compared) == …`); `check-extension-contract.cjs` :100-101 (missing file = violation)
**Apply to:** all 8 absence-type fences, the vocabulary AST walk, and the registry mutation scan

### RED drive, then byte restore from a backup (never `git checkout`)
**Source:** `test_257` :37-55 (the planted probe that proved the first detector blind)
**Apply to:** registry pin, each D-08 anchor, the vocabulary fence (a-c) and the D-07 script. Restore md5-identical from a backup copy (autocrlf).

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `scripts/check-test-retarget-only.py` | utility | batch (git diff) | No existing checker compares test-diff hunks. Use RESEARCH § D-07 for the logic and `check-greenfield-privileges.py` only for the script skeleton and exit-code convention. |
| Schema-hash part of `test_278_registry_pin.py` | test | — | Nothing hashes `openai_service.get_tools()` output today. Use the RESEARCH § "Registry pin" spec (8 flag combos + `RENDER_TEMPLATE_TOOL`). |
| `backend/app/services/tools/__init__.py` | package marker | — | Docstring only, by design (RESEARCH anti-pattern: no imports). |

## Metadata

**Analog search scope:** `backend/app/services/` (retrieval_*, *_tool.py, tool_dispatcher.py), `backend/tests/unit/` (test_272_*, test_259/261/255/257/264/275), `scripts/` (check-*.cjs, *.py), `.claude/hooks/`, `docs/HOT-FILE-LEDGER.md`
**Files read:** 14 (plus targeted line ranges in 6 more)
**Pattern extraction date:** 2026-10-13
