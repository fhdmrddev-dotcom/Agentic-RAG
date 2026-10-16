"""Phase 278 (SEAM-03, D-01 / D-02 / D-04) — the dispatcher split is a PURE MOVE, proven.

``tool_dispatcher.py`` (5,068 lines at PHASE_BASE) is split in 278-03 into the registry module and a
``app/services/tools/`` family package. This suite is landed FIRST (278-01, TDD pin-first) and is
the proof that the split moves code and rewrites none of it:

1. **Every base binding is accounted for.** The top-level names bound in ``tool_dispatcher.py`` at
   PHASE_BASE equal ``MOVE_MAP ∪ UNMOVED ∪ PER_MODULE`` exactly — a silently dropped constant, or a
   name the map forgot, fails here. GREEN at base (it reads only the base blob).
2. **The registry half is untouched.** The 5 ``UNMOVED`` bindings (the registry literal, the refusal
   audit, the capability gate and ``dispatch_tool``) in ``tool_dispatcher.py`` at HEAD are
   AST-identical to base. GREEN at base and after.
3. **AST equality of every moved binding.** Functions, classes AND constants (Assign/AnnAssign, so
   the 297-line ``_RENDER_DRIVER_SRC``, the allowlists and the regexes are pinned too), parsed from
   ``git show PHASE_BASE_SHA:backend/app/services/tool_dispatcher.py``, dump to the same AST as the
   binding in its ``tools/<family>.py`` home. ``ast.dump`` ignores comments and line numbers, so a
   verbatim cut passes and a retyped token does not.
4. **One home per name.** Each moved name is DEFINED in exactly one file across ``tool_dispatcher.py``
   and ``tools/*.py`` (an ImportFrom binding is not a definition) — a copy-not-move fails.
5. **Module hygiene.** Every ``tools/*.py`` has ``from __future__ import annotations`` (``ToolContext``
   annotates TYPE_CHECKING-only types); none imports ``tool_dispatcher`` at module level (cycle);
   ``tools/__init__.py`` is docstring-only (no import-order surface).
6. **Back-compat re-exports are the same objects (D-04).** ``ToolContext``, ``ToolResult``,
   ``SCRIPT_EXTS`` and ``_attachment_container_path`` on ``tool_dispatcher`` ``is`` the ``tools/``
   object, and every handler the registry binds is the object in its home.
7. **Each module imports FIRST in a fresh interpreter** (``sys.modules`` caching hides partial-init
   cycles in-process), and **every global a function body reads is bound** in its module (stdlib
   ``symtable`` — a missing import inside a moved body only fails at CALL time, so an import probe
   cannot see it; no linter exists in the venv).

⚠ LANDED PIN-FIRST (278-01), GATE-NEUTRAL BY CONSTRUCTION. ``app/services/tools/`` did not exist at
PHASE_BASE, so every test that reads it was marked as a strict expected failure PER TEST and PER
PARAMETRIZE ID (never module level: tests 1, 2 and the ``tool_dispatcher`` params of 7 passed at
base). 278-03 removed those markers IN the move commit, so every test here now runs plain — the
backend gate has ZERO headroom (71 failed at base), and a plain failing test is never committed.

⚠ Structured like ``test_272_pure_move.py`` so a later phase can retire ONE case BY NAME, with the
reason as the dict value (SEED-177: retire a fence deliberately, never trip it by surprise).
``RETIRED`` is EMPTY in 278 — a pure move changes nothing on purpose.
"""
from __future__ import annotations

import ast
import builtins
import importlib
import subprocess
import symtable
import sys
from pathlib import Path

import pytest

PHASE_BASE_SHA = "25b4235c540b1e21a055301ce576d1deb78d5634"

REPO_ROOT = Path(__file__).resolve().parents[3]
BACKEND_DIR = REPO_ROOT / "backend"

_BASE_REL = "backend/app/services/tool_dispatcher.py"
_TOOLS_REL = "backend/app/services/tools"

# name → the module it lives in after the move (relative to the repo root). 99 names.
MOVE_MAP: dict[str, str] = {
    # tools/base.py (2) — the leaf types (D-04), re-exported from tool_dispatcher
    "ToolContext": "backend/app/services/tools/base.py",
    "ToolResult": "backend/app/services/tools/base.py",
    # tools/documents.py (21) — KB browse + documents + web search
    "resolve_filter": "backend/app/services/tools/documents.py",
    "ResolveError": "backend/app/services/tools/documents.py",
    "_build_field_meta": "backend/app/services/tools/documents.py",
    "_ensure_resolver": "backend/app/services/tools/documents.py",
    "_OUT_OF_SCOPE": "backend/app/services/tools/documents.py",
    "_scope_set": "backend/app/services/tools/documents.py",
    "_document_folder_ids": "backend/app/services/tools/documents.py",
    "_doc_out_of_scope": "backend/app/services/tools/documents.py",
    "_prune_tree": "backend/app/services/tools/documents.py",
    "_handle_ls": "backend/app/services/tools/documents.py",
    "_handle_tree": "backend/app/services/tools/documents.py",
    "_handle_grep": "backend/app/services/tools/documents.py",
    "_handle_glob": "backend/app/services/tools/documents.py",
    "_handle_read_document": "backend/app/services/tools/documents.py",
    "_fetch_owned_document_bytes": "backend/app/services/tools/documents.py",
    "_handle_fetch_document_file": "backend/app/services/tools/documents.py",
    "_handle_query_documents": "backend/app/services/tools/documents.py",
    "_handle_query_documents_by_view": "backend/app/services/tools/documents.py",
    "_handle_get_related_documents": "backend/app/services/tools/documents.py",
    "_handle_web_search": "backend/app/services/tools/documents.py",
    "_handle_analyze_document": "backend/app/services/tools/documents.py",
    # tools/skills.py (11)
    "_ATTACH_INLINE_MAX_BYTES": "backend/app/services/tools/skills.py",
    "_resolve_attach_source_bytes": "backend/app/services/tools/skills.py",
    "_handle_attach_skill_file": "backend/app/services/tools/skills.py",
    "_SKILL_RUNTIME_NOTE": "backend/app/services/tools/skills.py",
    "_skill_runtime_note": "backend/app/services/tools/skills.py",
    "_resolve_skill_visibility_or": "backend/app/services/tools/skills.py",
    "_handle_load_skill": "backend/app/services/tools/skills.py",
    "_handle_save_skill": "backend/app/services/tools/skills.py",
    "_SCRIPT_REF_CAVEAT": "backend/app/services/tools/skills.py",
    "_decode_skill_file_bytes": "backend/app/services/tools/skills.py",
    "_handle_read_skill_file": "backend/app/services/tools/skills.py",
    # tools/sandbox.py (23) — execute_code + hydration + autoheal
    "_pip_install": "backend/app/services/tools/sandbox.py",
    "_SandboxCommandTimeout": "backend/app/services/tools/sandbox.py",
    "_run_bounded_sandbox": "backend/app/services/tools/sandbox.py",
    "_install_declared_libraries": "backend/app/services/tools/sandbox.py",
    "_EXEC_ERROR_MARKERS": "backend/app/services/tools/sandbox.py",
    "_derive_actual_exit_code": "backend/app/services/tools/sandbox.py",
    "_ATTACHMENTS_DIR": "backend/app/services/tools/sandbox.py",
    "_ATTACHMENT_HYDRATION_MAX_FILES": "backend/app/services/tools/sandbox.py",
    "_ATTACHMENT_NAME_MAX": "backend/app/services/tools/sandbox.py",
    "_hydrated_files": "backend/app/services/tools/sandbox.py",
    "_hydration_failures": "backend/app/services/tools/sandbox.py",
    "_ATTACHMENT_HYDRATION_MAX_ATTEMPTS": "backend/app/services/tools/sandbox.py",
    "_session_hydration_records": "backend/app/services/tools/sandbox.py",
    "_attachment_container_path": "backend/app/services/tools/sandbox.py",
    "_hydrate_thread_attachments": "backend/app/services/tools/sandbox.py",
    "_handle_execute_code": "backend/app/services/tools/sandbox.py",
    "_PREINSTALLED_HINT_LIBS": "backend/app/services/tools/sandbox.py",
    "_HEAL_BOUND_TTL_S": "backend/app/services/tools/sandbox.py",
    "_extract_missing_module": "backend/app/services/tools/sandbox.py",
    "_install_failed_detail": "backend/app/services/tools/sandbox.py",
    "_heal_bound_seen": "backend/app/services/tools/sandbox.py",
    "_heal_bound_record": "backend/app/services/tools/sandbox.py",
    "_autoheal_missing_module": "backend/app/services/tools/sandbox.py",
    # tools/runtime_gap.py (19) — Phase-142 pure helpers. Planner decision: _REPEAT_BLOCKED_NOTE /
    # _repeat_blocked_result live HERE, not in sandbox.py (pure helpers, no external user).
    "KNOWN_MISSING_BINARIES": "backend/app/services/tools/runtime_gap.py",
    "KNOWN_MISSING_MODULES": "backend/app/services/tools/runtime_gap.py",
    "JS_TOKENS": "backend/app/services/tools/runtime_gap.py",
    "_SKILL_BUNDLE_DIRS": "backend/app/services/tools/runtime_gap.py",
    "SCRIPT_EXTS": "backend/app/services/tools/runtime_gap.py",
    "_MSG_SOFFICE": "backend/app/services/tools/runtime_gap.py",
    "_MSG_NODE": "backend/app/services/tools/runtime_gap.py",
    "GAP_MESSAGES": "backend/app/services/tools/runtime_gap.py",
    "GAP_MESSAGES_JS": "backend/app/services/tools/runtime_gap.py",
    "GAP_MESSAGES_MISSING_FILE": "backend/app/services/tools/runtime_gap.py",
    "_NO_MODULE_RE": "backend/app/services/tools/runtime_gap.py",
    "_MISSING_PATH_RE": "backend/app/services/tools/runtime_gap.py",
    "_BINARY_GAP_RES": "backend/app/services/tools/runtime_gap.py",
    "_strip_py_line_comments": "backend/app/services/tools/runtime_gap.py",
    "_classify_runtime_gap": "backend/app/services/tools/runtime_gap.py",
    "_message_for_dead_token": "backend/app/services/tools/runtime_gap.py",
    "_code_references_dead_token": "backend/app/services/tools/runtime_gap.py",
    "_REPEAT_BLOCKED_NOTE": "backend/app/services/tools/runtime_gap.py",
    "_repeat_blocked_result": "backend/app/services/tools/runtime_gap.py",
    # tools/render_template.py (5)
    "_RENDER_DRIVER_SRC": "backend/app/services/tools/render_template.py",
    "_SAFE_OUT_FILENAME_RE": "backend/app/services/tools/render_template.py",
    "_VALID_RENDER_ENGINES": "backend/app/services/tools/render_template.py",
    "_safe_out_filename": "backend/app/services/tools/render_template.py",
    "_handle_render_template": "backend/app/services/tools/render_template.py",
    # tools/workspace.py (8)
    "_NULL_STRINGS": "backend/app/services/tools/workspace.py",
    "_normalize_optional": "backend/app/services/tools/workspace.py",
    "_normalize_optional_int": "backend/app/services/tools/workspace.py",
    "_handle_workspace_write": "backend/app/services/tools/workspace.py",
    "_handle_workspace_read": "backend/app/services/tools/workspace.py",
    "_handle_workspace_list": "backend/app/services/tools/workspace.py",
    "_handle_workspace_delete": "backend/app/services/tools/workspace.py",
    "_handle_workspace_diff": "backend/app/services/tools/workspace.py",
    # tools/memory.py (3)
    "_handle_remember": "backend/app/services/tools/memory.py",
    "_handle_recall": "backend/app/services/tools/memory.py",
    "_handle_query_tables": "backend/app/services/tools/memory.py",
    # tools/agent_control.py (5)
    "_SUB_AGENT_DEFAULT_READ_ONLY": "backend/app/services/tools/agent_control.py",
    "_SUB_AGENT_EXCLUDED": "backend/app/services/tools/agent_control.py",
    "_handle_task": "backend/app/services/tools/agent_control.py",
    "_handle_write_todos": "backend/app/services/tools/agent_control.py",
    "_handle_ask_user": "backend/app/services/tools/agent_control.py",
    # tools/connector.py (2)
    "_APPROVAL_TIMEOUT_SECONDS": "backend/app/services/tools/connector.py",
    "_handle_connector_chat_tool": "backend/app/services/tools/connector.py",
}

# Stays in tool_dispatcher.py, compared there (D-03: the registry module).
UNMOVED: tuple[str, ...] = (
    "_TOOL_REGISTRY",
    "_spawn_tool_refused_audit",
    "_CAPABILITY_FLAG_TOOLS",
    "_capability_disabled_message",
    "dispatch_tool",
)

# Re-created per module (each module gets its own `logger = logging.getLogger(__name__)`).
PER_MODULE: frozenset[str] = frozenset({"logger"})

# name → the reason it is no longer compared. EMPTY in 278 — a pure move changes nothing on purpose.
RETIRED: dict[str, str] = {
    "_handle_ask_user": (
        "BUG-261015-03 (2026-10-15): deliberate post-move edit. The wait clamp moved into "
        "_resolve_ask_timeout with a 300 s floor; pinned by test_bug_261015_03_ask_user_floor.py."
    ),
    "_handle_query_documents_by_view": (
        "Phase 284 (284-04, R-02, 2026-10-16): deliberate post-move edit. The full resolve passes "
        "via_view=False + limit (the service role reads 0 rows from library_documents) instead of "
        "slicing a whole list; its JSON output is pinned BYTE-IDENTICAL to the pre-284 algorithm by "
        "test_284_view_resolve.py::test_the_agent_answer_is_byte_identical_to_pre_284."
    ),
}

_EXPECTED_FAMILY_COUNTS = {
    "base.py": 2,
    "documents.py": 21,
    "skills.py": 11,
    "sandbox.py": 23,
    "runtime_gap.py": 19,
    "render_template.py": 5,
    "workspace.py": 8,
    "memory.py": 3,
    "agent_control.py": 5,
    "connector.py": 2,
}

# Exactly the files tools/ must hold: the 10 family modules + a docstring-only __init__.py.
_EXPECTED_TOOLS_FILES = frozenset({"__init__.py", *_EXPECTED_FAMILY_COUNTS})

# D-04 back-compat re-exports an app module reads from tool_dispatcher → its home.
_BACK_COMPAT = {
    "ToolContext": "app.services.tools.base",
    "ToolResult": "app.services.tools.base",
    "SCRIPT_EXTS": "app.services.tools.runtime_gap",  # app/api/skills.py
    "_attachment_container_path": "app.services.tools.sandbox",  # agent_loop.py
}

_TOOLS_MODULES = ("app.services.tools", *(
    f"app.services.tools.{f[:-3]}" for f in sorted(_EXPECTED_FAMILY_COUNTS)
))


def _blob_at_base(rel_path: str, sha: str = PHASE_BASE_SHA) -> str:
    """A tracked file's contents at the phase base commit (or at ``sha``)."""
    # ⚠ `encoding` IS LOAD-BEARING ON WINDOWS (the test_214 / test_272 precedent). `text=True` alone
    # decodes with the locale codec (cp1252 here), and these modules carry `⚠` / `—` in their
    # comments — so the reader thread dies with a `UnicodeDecodeError`, `.stdout` comes back `None`,
    # and the fence fails with an `AttributeError` that looks nothing like the property it pins.
    return subprocess.run(
        ["git", "show", f"{sha}:{rel_path}"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=True,
    ).stdout


def _module_source(rel_path: str) -> str:
    return (REPO_ROOT / rel_path).read_text(encoding="utf-8")


def _bindings(src: str) -> dict[str, ast.AST]:
    """Top-level DEFINITIONS: def / async def / class, and Assign / AnnAssign to a plain Name."""
    out: dict[str, ast.AST] = {}
    for node in ast.parse(src).body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            out[node.name] = node
        elif isinstance(node, (ast.Assign, ast.AnnAssign)):
            for target in node.targets if isinstance(node, ast.Assign) else [node.target]:
                if isinstance(target, ast.Name):
                    out[target.id] = node
    return out


def _definition_names(src: str) -> list[str]:
    """Like ``_bindings`` but as a list, so a name defined TWICE in one file is visible."""
    names: list[str] = []
    for node in ast.parse(src).body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            names.append(node.name)
        elif isinstance(node, (ast.Assign, ast.AnnAssign)):
            for target in node.targets if isinstance(node, ast.Assign) else [node.target]:
                if isinstance(target, ast.Name):
                    names.append(target.id)
    return names


def _tools_files() -> dict[str, Path]:
    """Every ``tools/*.py`` — asserted to be EXACTLY the expected 11 (non-vacuity; also what makes
    every tools-reading test fail, never pass vacuously, before the move)."""
    tools_dir = REPO_ROOT / _TOOLS_REL
    found = {p.name: p for p in sorted(tools_dir.glob("*.py"))} if tools_dir.is_dir() else {}
    assert set(found) == _EXPECTED_TOOLS_FILES, (
        f"{_TOOLS_REL}/ holds {sorted(found)}; expected exactly {sorted(_EXPECTED_TOOLS_FILES)}"
    )
    return found


def _module_file(mod: str) -> Path:
    rel = mod.replace(".", "/")
    pkg_init = BACKEND_DIR / rel / "__init__.py"
    return pkg_init if pkg_init.is_file() else BACKEND_DIR / f"{rel}.py"


def _module_params():
    params = [pytest.param("app.services.tool_dispatcher", id="tool_dispatcher")]
    for mod in _TOOLS_MODULES:
        params.append(pytest.param(mod, id=mod.rsplit(".", 1)[-1] if mod != "app.services.tools"
                                   else "tools_init"))
    return params


# ── 0. the map itself ────────────────────────────────────────────────────────────────────────


def test_move_map_shape():
    """The map holds 99 names, family counts as planned, and no name is both moved and unmoved."""
    assert len(MOVE_MAP) == 99
    counts: dict[str, int] = {}
    for rel in MOVE_MAP.values():
        assert rel.startswith(_TOOLS_REL + "/"), rel
        counts[rel.rsplit("/", 1)[-1]] = counts.get(rel.rsplit("/", 1)[-1], 0) + 1
    assert counts == _EXPECTED_FAMILY_COUNTS
    assert not (set(MOVE_MAP) & set(UNMOVED)) and not (set(MOVE_MAP) & PER_MODULE)
    assert set(RETIRED) <= set(MOVE_MAP)


# ── 1. accounting (GREEN at base) ────────────────────────────────────────────────────────────


def test_every_base_binding_is_accounted_for():
    base_names = _definition_names(_blob_at_base(_BASE_REL))
    assert len(base_names) == len(set(base_names)), "a name is bound twice at top level at base"
    expected = set(MOVE_MAP) | set(UNMOVED) | set(PER_MODULE)
    assert set(base_names) == expected, (
        f"unmapped at base: {sorted(set(base_names) - expected)}; "
        f"mapped but absent at base: {sorted(expected - set(base_names))}"
    )
    assert len(base_names) == 105


# ── 2. the registry half is untouched (GREEN at base and after) ─────────────────────────────


def test_unmoved_bindings_are_ast_identical():
    base = _bindings(_blob_at_base(_BASE_REL))
    head = _bindings(_module_source(_BASE_REL))
    compared = []
    for name in UNMOVED:
        assert name in base, f"{name} not at {PHASE_BASE_SHA}"
        assert name in head, f"{name} is no longer in {_BASE_REL} — D-03 keeps it in the registry module"
        assert ast.dump(head[name]) == ast.dump(base[name]), (
            f"{name} in {_BASE_REL} is not AST-identical to PHASE_BASE"
        )
        compared.append(name)
    assert len(compared) == len(UNMOVED) == 5


# ── 3. AST equality of every moved binding ───────────────────────────────────────────────────


def test_moved_bindings_are_ast_identical():
    _tools_files()
    base = _bindings(_blob_at_base(_BASE_REL))
    homes = {rel: _bindings(_module_source(rel)) for rel in set(MOVE_MAP.values())}
    compared = []
    for name, rel in MOVE_MAP.items():
        if name in RETIRED:
            continue
        assert name in base, f"{name} not found in {_BASE_REL} at {PHASE_BASE_SHA}"
        assert name in homes[rel], f"{name} not found in {rel}"
        assert ast.dump(homes[rel][name]) == ast.dump(base[name]), (
            f"{name} in {rel} is not AST-identical to its PHASE_BASE source — the move retyped it. "
            "A pure move is a cut, never a rewrite."
        )
        compared.append(name)
    # Non-vacuity: every name the map promises was found in BOTH sources and compared.
    assert len(compared) == len(MOVE_MAP) - len(RETIRED)


# ── 4. one home per name ─────────────────────────────────────────────────────────────────────


def test_each_name_has_exactly_one_home():
    files = {f"{_TOOLS_REL}/{name}": path for name, path in _tools_files().items()}
    files[_BASE_REL] = REPO_ROOT / _BASE_REL
    defined: dict[str, list[str]] = {}
    for rel, path in files.items():
        for name in _definition_names(path.read_text(encoding="utf-8")):
            defined.setdefault(name, []).append(rel)
    problems = []
    for name, home in MOVE_MAP.items():
        where = defined.get(name, [])
        if where != [home]:
            problems.append(f"{name}: defined in {where or 'NOWHERE'}, expected exactly [{home}]")
    for name in UNMOVED:
        if defined.get(name, []) != [_BASE_REL]:
            problems.append(f"{name}: defined in {defined.get(name)}, expected only in {_BASE_REL}")
    assert problems == [], "copy-not-move or lost definition:\n" + "\n".join(problems)


# ── 5. module hygiene ────────────────────────────────────────────────────────────────────────


def _has_future_annotations(tree: ast.Module) -> bool:
    return any(
        isinstance(n, ast.ImportFrom) and n.module == "__future__"
        and any(a.name == "annotations" for a in n.names)
        for n in tree.body
    )


def test_tools_modules_use_future_annotations():
    missing = []
    for name, path in _tools_files().items():
        if name == "__init__.py":
            continue
        if not _has_future_annotations(ast.parse(path.read_text(encoding="utf-8"))):
            missing.append(name)
    assert missing == [], f"no `from __future__ import annotations` in: {missing}"


def _module_level_statements(body: list[ast.stmt]):
    """Every statement NOT inside a function or class body (descends into if / try / with)."""
    for node in body:
        yield node
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            continue
        for field in ("body", "orelse", "finalbody"):
            yield from _module_level_statements(getattr(node, field, []) or [])
        for handler in getattr(node, "handlers", []) or []:
            yield from _module_level_statements(handler.body)


def test_no_tools_module_imports_tool_dispatcher_at_module_level():
    offenders = []
    for name, path in _tools_files().items():
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in _module_level_statements(tree.body):
            if isinstance(node, ast.ImportFrom) and node.module and "tool_dispatcher" in node.module:
                offenders.append(f"{name}:{node.lineno}")
            elif isinstance(node, ast.Import) and any("tool_dispatcher" in a.name for a in node.names):
                offenders.append(f"{name}:{node.lineno}")
            elif (
                isinstance(node, ast.ImportFrom) and node.module == "app.services"
                and any(a.name == "tool_dispatcher" for a in node.names)
            ):
                offenders.append(f"{name}:{node.lineno}")
    assert offenders == [], f"module-level import of tool_dispatcher (cycle surface): {offenders}"


def test_tools_init_is_docstring_only():
    tree = ast.parse(_tools_files()["__init__.py"].read_text(encoding="utf-8"))
    assert len(tree.body) == 1, f"tools/__init__.py holds {len(tree.body)} statements, expected 1"
    only = tree.body[0]
    assert isinstance(only, ast.Expr) and isinstance(only.value, ast.Constant) and isinstance(
        only.value.value, str
    ), "tools/__init__.py must be a docstring only (no import-order or cycle surface)"


# ── 6. back-compat re-exports are the same objects (D-04) ───────────────────────────────────


def test_back_compat_reexports_are_the_same_objects():
    td = importlib.import_module("app.services.tool_dispatcher")
    checked = 0
    for name, home_mod in _BACK_COMPAT.items():
        home = importlib.import_module(home_mod)
        assert hasattr(td, name), f"tool_dispatcher.{name} is gone — a measured importer reads it"
        assert getattr(td, name) is getattr(home, name), (
            f"tool_dispatcher.{name} is not the object in {home_mod} — a copy, not a re-export"
        )
        checked += 1
    # Every registry handler that moved is the object in its home.
    for key, handler in td._TOOL_REGISTRY.items():
        name = getattr(handler, "__name__", None)
        if name in MOVE_MAP:
            home_mod = MOVE_MAP[name][len("backend/"):-len(".py")].replace("/", ".")
            assert handler is getattr(importlib.import_module(home_mod), name), (
                f"registry entry {key!r} does not bind {home_mod}.{name}"
            )
            checked += 1
    assert checked == len(_BACK_COMPAT) + 28  # 30 registry entries minus the 2 that never moved


# ── 7. fresh-interpreter import + every global a body reads is bound ─────────────────────────


@pytest.mark.parametrize("mod", _module_params())
def test_each_module_imports_first_in_a_fresh_interpreter(mod):
    if mod != "app.services.tool_dispatcher":
        _tools_files()
    proc = subprocess.run(
        [sys.executable, "-c", f"import {mod}"],
        cwd=BACKEND_DIR,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    assert proc.returncode == 0, f"`import {mod}` failed in a fresh interpreter:\n{proc.stderr}"


_MODULE_DUNDERS = frozenset({
    "__name__", "__file__", "__doc__", "__spec__", "__package__", "__loader__", "__builtins__",
    "__path__", "__annotations__", "__dict__",
})


def _child_tables(table: symtable.SymbolTable):
    for child in table.get_children():
        yield child
        yield from _child_tables(child)


def _unbound_globals(source: str, filename: str) -> list[str]:
    module = symtable.symtable(source, filename, "exec")
    bound = {
        s.get_name() for s in module.get_symbols()
        if s.is_assigned() or s.is_imported() or s.is_namespace()
    }
    allowed = bound | set(dir(builtins)) | _MODULE_DUNDERS
    unresolved: set[str] = set()
    for sym in module.get_symbols():
        if sym.is_referenced() and sym.get_name() not in allowed:
            unresolved.add(f"<module>:{sym.get_name()}")
    for scope in _child_tables(module):
        for sym in scope.get_symbols():
            if sym.is_referenced() and sym.is_global() and sym.get_name() not in allowed:
                unresolved.add(f"{scope.get_name()}:{sym.get_name()}")
    return sorted(unresolved)


@pytest.mark.parametrize("mod", _module_params())
def test_every_global_a_body_reads_is_bound(mod):
    if mod != "app.services.tool_dispatcher":
        _tools_files()
    path = _module_file(mod)
    assert path.is_file(), f"{mod}: no source at {path}"
    unresolved = _unbound_globals(path.read_text(encoding="utf-8"), str(path))
    assert unresolved == [], (
        f"{mod}: names read as globals but bound nowhere in the module (a dropped import — this "
        f"only fails at CALL time): {unresolved}"
    )
