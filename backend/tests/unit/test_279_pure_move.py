"""Phase 279 (SEAM-01, D-01 / D-02 / D-03) — the expert_scope split is a PURE MOVE, proven.

``expert_scope.py`` (632 lines at PHASE_BASE, G-5 FIRING since 275-01) is split in 279-01 along its
ledger seam into three modules:

* ``expert_scope.py`` — the PURE part only (``ExpertScope``, ``compose_expert_scope``,
  ``folder_path``), with no ``app.`` import at all;
* ``expert_scope_statement.py`` — the async statement reads (``describe_expert_scope``,
  ``describe_scope_change``, ``_count_kb_documents``, ``ScopeStatement``, ``scope_preview`` and the
  private helpers they read, including ``_scope_ref``);
* ``expert_scope_events.py`` — the transcript wording plus its ONE writer
  (``insert_expert_changed_row``). It imports the statement module; never the reverse (D-01).

This suite is landed FIRST (279-01 Task 1, TDD pin-first, the 278 kit) and is the proof that the split
moves code and rewrites none of it:

1. **Every base binding is accounted for.** The top-level names bound in ``expert_scope.py`` at
   PHASE_BASE equal ``MOVE_MAP ∪ UNMOVED ∪ PER_MODULE`` exactly (26). GREEN at base.
2. **The pure half is untouched.** The 3 ``UNMOVED`` bindings in ``expert_scope.py`` at HEAD are
   AST-identical to base. GREEN at base and after.
3. **AST equality of every moved binding** (functions, classes AND constants) against
   ``git show PHASE_BASE_SHA:backend/app/services/expert_scope.py``. ``ast.dump`` ignores comments
   and line numbers, so a verbatim cut passes and a retyped token does not.
4. **One home per name.** Each name is DEFINED in exactly one of the three files (an ImportFrom
   binding is not a definition) — a copy-not-move fails.
5. **Module hygiene + import direction.** Both new modules carry ``from __future__ import
   annotations``; ``expert_scope_statement.py`` has no module-level import of
   ``expert_scope_events`` (the only legal direction is events → statement → pure); and
   ``expert_scope.py`` imports nothing from ``app.`` (it fails if someone re-adds ``aexec``).
6. **No re-export shim (D-02).** ``expert_scope.py`` binds NO ``MOVE_MAP`` name, by definition OR
   by import — a string patch on the old module would otherwise silently reach nothing (278 D-06).
   This INVERTS 278's back-compat re-export test: 278 kept a shim on purpose, 279 forbids one.
7. **Each module imports FIRST in a fresh interpreter** and **every global a function body reads is
   bound** in its module (stdlib ``symtable``; a dropped import inside a moved body only fails at
   CALL time).

⚠ LANDED PIN-FIRST (279-01 Task 1), GATE-NEUTRAL BY CONSTRUCTION. The two new modules did not exist
at PHASE_BASE, so every test that reads them is marked as a strict expected failure PER TEST and PER
PARAMETRIZE ID (never module level: tests 1, 2 and the ``expert_scope`` params of 7 pass at base).
The markers are removed IN the move commit (279-01 Task 3) — the backend gate has ZERO headroom (71
failed at base), and a plain failing test is never committed.

⚠ ``RETIRED`` lets a later commit retire ONE case BY NAME, with the reason as the dict value
(SEED-177: retire a fence deliberately, never trip it by surprise). It is EMPTY in 279-01.
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

PHASE_BASE_SHA = "a5a94ba676a63a595f0c2408c7ce17b2ddfe5ada"

REPO_ROOT = Path(__file__).resolve().parents[3]
BACKEND_DIR = REPO_ROOT / "backend"

_BASE_REL = "backend/app/services/expert_scope.py"
_STATEMENT_REL = "backend/app/services/expert_scope_statement.py"
_EVENTS_REL = "backend/app/services/expert_scope_events.py"

# name → the module it lives in after the move (relative to the repo root). 22 names.
MOVE_MAP: dict[str, str] = {
    # expert_scope_statement.py (8) — the async reads and the one object they build
    "_NAMED_LIMIT": "backend/app/services/expert_scope_statement.py",
    "_mode": "backend/app/services/expert_scope_statement.py",
    "_count_kb_documents": "backend/app/services/expert_scope_statement.py",
    "ScopeStatement": "backend/app/services/expert_scope_statement.py",
    "describe_expert_scope": "backend/app/services/expert_scope_statement.py",
    # _scope_ref is read by describe_scope_change AND events._scope_line; it lives in statement
    # because events may import statement, never the reverse (D-01).
    "_scope_ref": "backend/app/services/expert_scope_statement.py",
    "describe_scope_change": "backend/app/services/expert_scope_statement.py",
    "scope_preview": "backend/app/services/expert_scope_statement.py",
    # expert_scope_events.py (14) — the transcript wording plus its ONE writer
    "_UNNAMEABLE_FOLDER": "backend/app/services/expert_scope_events.py",
    "_ALL_DOCUMENTS": "backend/app/services/expert_scope_events.py",
    "_NOTHING": "backend/app/services/expert_scope_events.py",
    "_dropped_line": "backend/app/services/expert_scope_events.py",
    "build_expert_changed_event": "backend/app/services/expert_scope_events.py",
    # async DB write; it sits beside event_sentence so statement never has to import events.
    "insert_expert_changed_row": "backend/app/services/expert_scope_events.py",
    "_line_items": "backend/app/services/expert_scope_events.py",
    "event_sentence": "backend/app/services/expert_scope_events.py",
    "_ALL_OTHER_DOCUMENTS": "backend/app/services/expert_scope_events.py",
    "_scope_line": "backend/app/services/expert_scope_events.py",
    "build_scope_effect": "backend/app/services/expert_scope_events.py",
    "build_scope_changed_event": "backend/app/services/expert_scope_events.py",
    "_folder_label": "backend/app/services/expert_scope_events.py",
    "scope_event_sentence": "backend/app/services/expert_scope_events.py",
}

# Stays in expert_scope.py, compared there (D-01: the pure part).
UNMOVED: tuple[str, ...] = ("ExpertScope", "compose_expert_scope", "folder_path")

# Re-created per module (each module that logs gets its own `logger = logging.getLogger(__name__)`).
PER_MODULE: frozenset[str] = frozenset({"logger"})

# name → the reason it is no longer compared. EMPTY in 279-01 — a pure move changes nothing on
# purpose. 279-02 retires `build_expert_changed_event` (D-07, restricted→restricted exclusion) and
# `ExpertScope` / `compose_expert_scope` (WR-08, scoped_folder_paths) BY NAME, with the reason as
# the value, IN the commit that changes them (SEED-177). UNMOVED names may be retired too.
RETIRED: dict[str, str] = {}

_EXPECTED_HOME_COUNTS = {"expert_scope_statement.py": 8, "expert_scope_events.py": 14}

_NEW_MODULES = (_STATEMENT_REL, _EVENTS_REL)

_PENDING = "RED until the 279-01 move commit creates expert_scope_statement.py / expert_scope_events.py"


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


def _new_module_files() -> dict[str, Path]:
    """The two new homes — asserted to EXIST (non-vacuity; also what makes every test that reads
    them fail, never pass vacuously, before the move)."""
    found = {rel: REPO_ROOT / rel for rel in _NEW_MODULES}
    missing = [rel for rel, p in found.items() if not p.is_file()]
    assert missing == [], f"the move homes do not exist yet: {missing}"
    return found


def _module_file(mod: str) -> Path:
    rel = mod.replace(".", "/")
    pkg_init = BACKEND_DIR / rel / "__init__.py"
    return pkg_init if pkg_init.is_file() else BACKEND_DIR / f"{rel}.py"


def _module_params():
    return [
        pytest.param("app.services.expert_scope", id="expert_scope"),
        pytest.param(
            "app.services.expert_scope_statement",
            id="expert_scope_statement",
            marks=pytest.mark.xfail(strict=True, reason=_PENDING),
        ),
        pytest.param(
            "app.services.expert_scope_events",
            id="expert_scope_events",
            marks=pytest.mark.xfail(strict=True, reason=_PENDING),
        ),
    ]


# ── 0. the map itself ────────────────────────────────────────────────────────────────────────


def test_move_map_shape():
    """The map holds 22 names (8 statement / 14 events), and no name is both moved and unmoved."""
    assert len(MOVE_MAP) == 22
    counts: dict[str, int] = {}
    for rel in MOVE_MAP.values():
        assert rel in _NEW_MODULES, rel
        counts[rel.rsplit("/", 1)[-1]] = counts.get(rel.rsplit("/", 1)[-1], 0) + 1
    assert counts == _EXPECTED_HOME_COUNTS
    assert not (set(MOVE_MAP) & set(UNMOVED)) and not (set(MOVE_MAP) & PER_MODULE)
    assert not (set(UNMOVED) & PER_MODULE)
    # ⚠ Widened from 278 (`<= set(MOVE_MAP)`): 279-02's WR-08 retires UNMOVED names too.
    assert set(RETIRED) <= set(MOVE_MAP) | set(UNMOVED)


# ── 1. accounting (GREEN at base) ────────────────────────────────────────────────────────────


def test_every_base_binding_is_accounted_for():
    base_names = _definition_names(_blob_at_base(_BASE_REL))
    assert len(base_names) == len(set(base_names)), "a name is bound twice at top level at base"
    expected = set(MOVE_MAP) | set(UNMOVED) | set(PER_MODULE)
    assert set(base_names) == expected, (
        f"unmapped at base: {sorted(set(base_names) - expected)}; "
        f"mapped but absent at base: {sorted(expected - set(base_names))}"
    )
    assert len(base_names) == 26


# ── 2. the pure half is untouched (GREEN at base and after) ─────────────────────────────────


def test_unmoved_bindings_are_ast_identical():
    base = _bindings(_blob_at_base(_BASE_REL))
    head = _bindings(_module_source(_BASE_REL))
    compared = []
    for name in UNMOVED:
        if name in RETIRED:
            continue
        assert name in base, f"{name} not at {PHASE_BASE_SHA}"
        assert name in head, f"{name} is no longer in {_BASE_REL} — D-01 keeps it in the pure module"
        assert ast.dump(head[name]) == ast.dump(base[name]), (
            f"{name} in {_BASE_REL} is not AST-identical to PHASE_BASE"
        )
        compared.append(name)
    # Non-vacuity: every unmoved name not retired was found in BOTH sources and compared.
    assert len(compared) == len(UNMOVED) - len(set(RETIRED) & set(UNMOVED))
    assert len(UNMOVED) == 3


# ── 3. AST equality of every moved binding ───────────────────────────────────────────────────


@pytest.mark.xfail(strict=True, reason=_PENDING)
def test_moved_bindings_are_ast_identical():
    _new_module_files()
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
    assert len(compared) == len(MOVE_MAP) - len(set(RETIRED) & set(MOVE_MAP))


# ── 4. one home per name ─────────────────────────────────────────────────────────────────────


@pytest.mark.xfail(strict=True, reason=_PENDING)
def test_each_name_has_exactly_one_home():
    files = dict(_new_module_files())
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


# ── 5. module hygiene + import direction ─────────────────────────────────────────────────────


def _has_future_annotations(tree: ast.Module) -> bool:
    return any(
        isinstance(n, ast.ImportFrom) and n.module == "__future__"
        and any(a.name == "annotations" for a in n.names)
        for n in tree.body
    )


@pytest.mark.xfail(strict=True, reason=_PENDING)
def test_new_modules_use_future_annotations():
    missing = []
    for rel, path in _new_module_files().items():
        if not _has_future_annotations(ast.parse(path.read_text(encoding="utf-8"))):
            missing.append(rel)
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


def _imported_modules(node: ast.stmt) -> list[str]:
    """Every dotted module name an import statement names (``from app.services import x`` → both
    ``app.services`` and ``app.services.x``)."""
    if isinstance(node, ast.Import):
        return [a.name for a in node.names]
    if isinstance(node, ast.ImportFrom) and node.module:
        return [node.module, *(f"{node.module}.{a.name}" for a in node.names)]
    return []


@pytest.mark.xfail(strict=True, reason=_PENDING)
def test_import_direction():
    """D-01: events → statement → pure, never the reverse; the pure module imports nothing from app."""
    files = _new_module_files()
    offenders = []
    stmt_tree = ast.parse(files[_STATEMENT_REL].read_text(encoding="utf-8"))
    for node in _module_level_statements(stmt_tree.body):
        if any("expert_scope_events" in m for m in _imported_modules(node)):
            offenders.append(f"{_STATEMENT_REL}:{node.lineno} imports expert_scope_events (cycle)")
    pure_tree = ast.parse(_module_source(_BASE_REL))
    for node in ast.walk(pure_tree):
        if any(m == "app" or m.startswith("app.") for m in _imported_modules(node)):
            offenders.append(f"{_BASE_REL}:{node.lineno} imports from app. (the pure module is a leaf)")
    # Non-vacuity: the legal direction actually exists (events reads statement's names).
    ev_tree = ast.parse(files[_EVENTS_REL].read_text(encoding="utf-8"))
    assert any(
        "app.services.expert_scope_statement" in _imported_modules(n)
        for n in _module_level_statements(ev_tree.body)
    ), "expert_scope_events.py does not import expert_scope_statement — the planned direction is absent"
    assert offenders == [], "import-direction violations:\n" + "\n".join(offenders)


# ── 6. no re-export shim (D-02) ──────────────────────────────────────────────────────────────


@pytest.mark.xfail(strict=True, reason=_PENDING)
def test_no_reexport_shim():
    """``expert_scope.py`` binds no MOVE_MAP name — not by definition, not by import (D-02)."""
    tree = ast.parse(_module_source(_BASE_REL))
    bound: set[str] = set(_definition_names(_module_source(_BASE_REL)))
    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            for a in node.names:
                bound.add((a.asname or a.name).split(".")[0])
    shimmed = sorted(bound & set(MOVE_MAP))
    assert shimmed == [], (
        f"{_BASE_REL} still binds moved names {shimmed} — a re-export shim (D-02 forbids one: a "
        "string patch on the old module would silently reach nothing)"
    )
    mod = importlib.import_module("app.services.expert_scope")
    assert [n for n in MOVE_MAP if hasattr(mod, n)] == []


# ── 7. fresh-interpreter import + every global a body reads is bound ─────────────────────────


@pytest.mark.parametrize("mod", _module_params())
def test_each_module_imports_first_in_a_fresh_interpreter(mod):
    if mod != "app.services.expert_scope":
        _new_module_files()
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
    if mod != "app.services.expert_scope":
        _new_module_files()
    path = _module_file(mod)
    assert path.is_file(), f"{mod}: no source at {path}"
    unresolved = _unbound_globals(path.read_text(encoding="utf-8"), str(path))
    assert unresolved == [], (
        f"{mod}: names read as globals but bound nowhere in the module (a dropped import — this "
        f"only fails at CALL time): {unresolved}"
    )
