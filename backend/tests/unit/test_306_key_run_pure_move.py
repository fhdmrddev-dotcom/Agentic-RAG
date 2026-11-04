"""Phase 306-01 (D-39, D-12, D-11) — the two ``inbound.py`` seams are a PURE MOVE, proven.

``api/inbound.py`` FIRES on G-5. Its run READ shape moves to ``services/key_run_read.py`` and its
START validation order moves to ``services/key_run_start.py``, so 306-05's MCP workflow tools call
them instead of copying them. Nothing an outside caller sees changes.

Fences (all against ``PHASE_BASE_SHA``, the commit this plan started from):

A. every moved binding (functions, classes, SQL constants, the read wire models and the download
   link constants) is AST-identical in its new home, and every moved SQL string is byte-identical;
B. the body of ``read_key_run`` IS the moved slice of the base ``read_inbound_run`` — with exactly
   two named substitutions: the audit call stays in the route, and ``_public_api_base(request)``
   is computed by the route and handed in as ``files_base``;
C. the ORDER of the start checks inside ``validate_key_start`` equals the order inside the base
   ``start_workflow_run`` between ``_limit(`` and ``launch_unattended_run(`` (an AST call walk in
   source order, never a substring — a comment naming a function is not a call of it);
D. one home per name; ``inbound.py`` still defines the access SQL, ``_refused``, ``_limit`` and the
   start wire models, keeps the patch surfaces tests set, and re-exports the read wire models as
   the SAME objects (public OpenAPI names unchanged);
E. ``key_run_start.py`` imports nothing from fastapi — it RETURNS a refusal value and the route
   builds the HTTPException exactly as before.

Plus: both new modules import first in a fresh interpreter, and every global a body reads is bound.

⚠ Structured like ``test_278_pure_move.py`` so a later phase (306-05 adds the MCP file arm) can
retire ONE name BY NAME in ``RETIRED`` with the reason as the value — never trip it by surprise.
"""
from __future__ import annotations

import ast
import builtins
import importlib
import subprocess
import symtable
import sys
from dataclasses import is_dataclass
from pathlib import Path

import pytest

PHASE_BASE_SHA = "c3a5ea8888ac606f932dd5121a34ce82fea94541"

REPO_ROOT = Path(__file__).resolve().parents[3]
BACKEND_DIR = REPO_ROOT / "backend"

_INBOUND_REL = "backend/app/api/inbound.py"
_READ_REL = "backend/app/services/key_run_read.py"
_START_REL = "backend/app/services/key_run_start.py"

MOVE_MAP: dict[str, str] = {
    # the read shape (D-12)
    "_PHASES_SQL": _READ_REL,
    "_END_REASON_AUDIT_SQL": _READ_REL,
    "_DISPLAY_NAME_SQL": _READ_REL,
    "_FILES_SQL": _READ_REL,
    "_optional": _READ_REL,
    "_step_position": _READ_REL,
    "_file_links": _READ_REL,
    # the read wire models + link constants, moved WITH the read and re-exported (same objects)
    "InboundStep": _READ_REL,
    "InboundFile": _READ_REL,
    "InboundWaitingOn": _READ_REL,
    "InboundRunRead": _READ_REL,
    "_DOWNLOAD_TTL": _READ_REL,
    "_DOWNLOAD_PREFIX": _READ_REL,
    # the start validation (D-11)
    "_SCOPE_SQL": _START_REL,
    "_raw_definition": _START_REL,
}

# Re-exported from inbound.py as the same object (the download route and the public spec read them).
_REEXPORTED = (
    "InboundStep", "InboundFile", "InboundWaitingOn", "InboundRunRead",
    "_DOWNLOAD_TTL", "_DOWNLOAD_PREFIX",
)

_STAYS_DEFINED_IN_INBOUND = (
    "_RUN_ACCESS_SQL", "_RUN_THREAD_SQL", "_refused", "_limit", "_not_found", "_as_uuid",
    "InboundStartBody", "InboundStartResult", "CANNOT_RUN_DETAIL", "UNPUBLISHED_DETAIL",
    "_public_api_base", "start_workflow_run", "read_inbound_run", "download_inbound_file",
)

_PATCH_SURFACES = ("enforce_key_limit", "audit_key_call_now", "audit_key_call", "_limit")

# The start checks, in order (the interfaces block of 306-01-PLAN.md).
_START_CALLS = (
    "workflows_disabled", "fetchrow", "get_key_workflows", "enforce_entitlement",
    "_raw_definition", "parse_definition_row", "template_refusal", "foreign_binding_refusal",
    "validate_inbound_inputs",
)

# name -> why it is no longer compared. EMPTY in 306-01: a pure move changes nothing on purpose.
RETIRED: dict[str, str] = {
    # 306-05 (D-12 / Pitfall 13): the MCP file arm. ``base=None`` returns file NAMES and mints no
    # one-time link (``/inbound/files`` serves key-origin runs only); the base-given path is the
    # moved body unchanged, and the 293 file-link suites still pin it.
    "_file_links": "306-05 adds the files_base=None MCP arm (names only, no link)",
}


def _blob_at_base(rel_path: str) -> str:
    # `encoding` is load-bearing on Windows (the test_278 precedent): the locale codec dies on `—`.
    return subprocess.run(
        ["git", "show", f"{PHASE_BASE_SHA}:{rel_path}"],
        cwd=REPO_ROOT, capture_output=True, text=True, encoding="utf-8", check=True,
    ).stdout


def _source(rel_path: str) -> str:
    path = REPO_ROOT / rel_path
    assert path.is_file(), f"{rel_path} does not exist"
    return path.read_text(encoding="utf-8")


def _bindings(src: str) -> dict[str, ast.AST]:
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
    names: list[str] = []
    for node in ast.parse(src).body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            names.append(node.name)
        elif isinstance(node, (ast.Assign, ast.AnnAssign)):
            for target in node.targets if isinstance(node, ast.Assign) else [node.target]:
                if isinstance(target, ast.Name):
                    names.append(target.id)
    return names


def _call_name(node: ast.Call) -> str | None:
    if isinstance(node.func, ast.Name):
        return node.func.id
    if isinstance(node.func, ast.Attribute):
        return node.func.attr
    return None


def _function(src: str, name: str):
    found = [
        n for n in ast.parse(src).body
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name == name
    ]
    assert len(found) == 1, f"{name}: {len(found)} top-level definitions"
    return found[0]


def _calls_in_order(node: ast.AST) -> list[ast.Call]:
    return sorted(
        (n for n in ast.walk(node) if isinstance(n, ast.Call)),
        key=lambda c: (c.lineno, c.col_offset),
    )


# ── 0. the map itself ────────────────────────────────────────────────────────────────────────


def test_move_map_shape():
    assert len(MOVE_MAP) == 15
    assert set(_REEXPORTED) <= set(MOVE_MAP)
    assert not set(MOVE_MAP) & set(_STAYS_DEFINED_IN_INBOUND)
    assert set(RETIRED) <= set(MOVE_MAP)


def test_every_moved_name_existed_at_base():
    base = _bindings(_blob_at_base(_INBOUND_REL))
    missing = [n for n in MOVE_MAP if n not in base]
    assert missing == [], f"not in {_INBOUND_REL} at {PHASE_BASE_SHA}: {missing}"


# ── A. AST identity of every moved binding; SQL byte-identical ──────────────────────────────


def test_moved_bindings_are_ast_identical():
    base = _bindings(_blob_at_base(_INBOUND_REL))
    homes = {rel: _bindings(_source(rel)) for rel in set(MOVE_MAP.values())}
    compared = []
    for name, rel in MOVE_MAP.items():
        if name in RETIRED:
            continue
        assert name in homes[rel], f"{name} not found in {rel}"
        assert ast.dump(homes[rel][name]) == ast.dump(base[name]), (
            f"{name} in {rel} is not AST-identical to its PHASE_BASE source — a move is a cut"
        )
        compared.append(name)
    assert len(compared) == len(MOVE_MAP) - len(RETIRED)


def test_moved_sql_text_is_byte_identical():
    """The 293 fakes answer by SQL FRAGMENT, so the runtime string must be the base string."""
    base = _bindings(_blob_at_base(_INBOUND_REL))
    read = importlib.import_module("app.services.key_run_read")
    start = importlib.import_module("app.services.key_run_start")
    sql = {
        "_PHASES_SQL": read, "_END_REASON_AUDIT_SQL": read, "_DISPLAY_NAME_SQL": read,
        "_FILES_SQL": read, "_SCOPE_SQL": start,
    }
    for name, mod in sql.items():
        expected = ast.literal_eval(base[name].value)
        assert getattr(mod, name) == expected, name


# ── B. read_key_run's body IS the moved slice of the base read_inbound_run ──────────────────


class _Substitute(ast.NodeTransformer):
    """The ONE expression the route keeps: ``_public_api_base(request)`` becomes ``files_base``."""

    def visit_Call(self, node: ast.Call):
        self.generic_visit(node)
        if _call_name(node) == "_public_api_base":
            return ast.Name(id="files_base", ctx=ast.Load())
        return node


def _is_audit_stmt(stmt: ast.stmt) -> bool:
    return (
        isinstance(stmt, ast.Expr) and isinstance(stmt.value, ast.Call)
        and _call_name(stmt.value) == "audit_key_call"
    )


def _strip_docstring(body: list[ast.stmt]) -> list[ast.stmt]:
    if body and isinstance(body[0], ast.Expr) and isinstance(body[0].value, ast.Constant) \
            and isinstance(body[0].value.value, str):
        return body[1:]
    return body


def test_read_key_run_body_is_the_moved_slice():
    base_fn = _function(_blob_at_base(_INBOUND_REL), "read_inbound_run")
    start = next(
        i for i, s in enumerate(base_fn.body)
        if isinstance(s, ast.ImportFrom) and s.module == "app.db"
    )
    base_slice = [s for s in base_fn.body[start:] if not _is_audit_stmt(s)]
    assert len(base_slice) == len(base_fn.body[start:]) - 1, "exactly one audit statement leaves"
    base_slice = [_Substitute().visit(s) for s in base_slice]

    moved = _function(_source(_READ_REL), "read_key_run")
    assert isinstance(moved, ast.AsyncFunctionDef)
    moved_body = _strip_docstring(moved.body)
    assert [ast.dump(s) for s in moved_body] == [ast.dump(s) for s in base_slice], (
        "read_key_run is not the base read_inbound_run slice (beyond the two named substitutions)"
    )
    kwonly = [a.arg for a in moved.args.kwonlyargs]
    assert [a.arg for a in moved.args.args] == ["pool", "redis"]
    assert kwonly == ["run", "key", "files_base"]


# ── C. the start check ORDER is the base order ──────────────────────────────────────────────


def test_validate_key_start_runs_the_base_checks_in_the_base_order():
    base_fn = _function(_blob_at_base(_INBOUND_REL), "start_workflow_run")
    calls = _calls_in_order(base_fn)
    lo = next(c.lineno for c in calls if _call_name(c) == "_limit")
    hi = next(c.lineno for c in calls if _call_name(c) == "launch_unattended_run")
    base_order = [
        _call_name(c) for c in calls
        if lo < c.lineno < hi and _call_name(c) in _START_CALLS
    ]
    assert base_order == list(_START_CALLS), base_order  # non-vacuity: the base really did this

    moved = _function(_source(_START_REL), "validate_key_start")
    moved_order = [_call_name(c) for c in _calls_in_order(moved) if _call_name(c) in _START_CALLS]
    assert moved_order == base_order, moved_order


def test_the_route_calls_each_seam_once_and_no_moved_check_itself():
    src = _source(_INBOUND_REL)
    start = [_call_name(c) for c in _calls_in_order(_function(src, "start_workflow_run"))]
    read = [_call_name(c) for c in _calls_in_order(_function(src, "read_inbound_run"))]
    assert start.count("validate_key_start") == 1
    assert read.count("read_key_run") == 1
    for name in _START_CALLS:
        assert name not in start, f"start_workflow_run still calls {name} itself"
    # The launch is the route's, after the validation (D-11: share, not copy).
    assert start.index("validate_key_start") < start.index("launch_unattended_run")
    assert start.index("_limit") < start.index("validate_key_start")
    assert read.index("_limit") < read.index("fetchrow") < read.index("read_key_run")


# ── D. one home per name; what stays, stays; re-exports are the same objects ────────────────


def test_each_moved_name_has_exactly_one_home():
    files = {rel: _source(rel) for rel in (_INBOUND_REL, _READ_REL, _START_REL)}
    defined: dict[str, list[str]] = {}
    for rel, src in files.items():
        for name in _definition_names(src):
            defined.setdefault(name, []).append(rel)
    problems = [
        f"{name}: defined in {defined.get(name) or 'NOWHERE'}, expected exactly [{home}]"
        for name, home in MOVE_MAP.items() if defined.get(name, []) != [home]
    ]
    problems += [
        f"{name}: defined in {defined.get(name)}, expected only in {_INBOUND_REL}"
        for name in _STAYS_DEFINED_IN_INBOUND if defined.get(name, []) != [_INBOUND_REL]
    ]
    assert problems == [], "\n".join(problems)


def test_inbound_keeps_its_patch_surfaces_and_reexports_the_same_objects():
    inbound = importlib.import_module("app.api.inbound")
    read = importlib.import_module("app.services.key_run_read")
    for name in _PATCH_SURFACES:
        assert hasattr(inbound, name), f"app.api.inbound.{name} is a patch surface tests set"
    for name in _REEXPORTED:
        assert getattr(inbound, name) is getattr(read, name), f"{name} is a copy, not a re-export"
    # The sentences are the route module's and are imported, never retyped.
    start_src = _source(_START_REL)
    for sentence in (inbound.CANNOT_RUN_DETAIL, inbound.UNPUBLISHED_DETAIL):
        assert sentence not in start_src


# ── E. the start module is transport-neutral ────────────────────────────────────────────────


def test_key_run_start_imports_nothing_from_fastapi():
    tree = ast.parse(_source(_START_REL))
    offenders = []
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and (node.module or "").split(".")[0] == "fastapi":
            offenders.append(node.lineno)
        if isinstance(node, ast.Import) and any(a.name.split(".")[0] == "fastapi" for a in node.names):
            offenders.append(node.lineno)
    assert offenders == [], f"key_run_start.py imports fastapi at lines {offenders}"


def test_key_run_start_returns_values_not_exceptions():
    start = importlib.import_module("app.services.key_run_start")
    assert is_dataclass(start.KeyStartRefusal) and is_dataclass(start.KeyStartOk)
    assert start.KeyStartRefusal.__dataclass_params__.frozen
    assert start.KeyStartOk.__dataclass_params__.frozen
    fields = set(start.KeyStartRefusal.__dataclass_fields__)
    assert {"reason", "http_status", "detail", "extra"} <= fields
    assert {"wid", "raw", "row", "definition", "values", "name"} <= set(
        start.KeyStartOk.__dataclass_fields__
    )
    fn = _function(_source(_START_REL), "validate_key_start")
    raises = [n for n in ast.walk(fn) if isinstance(n, ast.Raise)]
    assert raises == [], "validate_key_start must RETURN a refusal, never raise one"


# ── fresh interpreter + every global a body reads is bound ──────────────────────────────────

_MODULES = ("app.services.key_run_read", "app.services.key_run_start", "app.api.inbound")


@pytest.mark.parametrize("mod", _MODULES)
def test_each_module_imports_first_in_a_fresh_interpreter(mod):
    proc = subprocess.run(
        [sys.executable, "-c", f"import {mod}"],
        cwd=BACKEND_DIR, capture_output=True, text=True, encoding="utf-8", errors="replace",
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


@pytest.mark.parametrize("rel", (_READ_REL, _START_REL, _INBOUND_REL))
def test_every_global_a_body_reads_is_bound(rel):
    unresolved = _unbound_globals(_source(rel), rel)
    assert unresolved == [], f"{rel}: names read as globals but bound nowhere: {unresolved}"
