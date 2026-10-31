"""Phase 306-01 (D-39, D-26) — the per-run search vocabulary is a PURE MOVE, proven.

``search_documents_tool.py`` FIRES on G-5 ("extraction FIRST next"). The vocabulary block
(``SearchVocabulary``, ``load_search_vocabulary``, the ``_vocabulary_note`` helpers,
``with_search_vocabulary`` and ``today_line``) moves to ``search_vocabulary.py`` so 306-03 can add
Seam A's one narrowing line to a YOUNG file. Nothing a run sees changes.

1. every moved binding is AST-identical to PHASE_BASE (functions, the dataclass, every constant);
2. the four public names on ``search_documents_tool`` ARE the moved objects (a re-export, never a
   copy), so ``agent_loop.py:93`` and ``task_service.py:720`` import them unedited;
3. one home per name — no moved name is still DEFINED in ``search_documents_tool.py``;
4. ``search_vocabulary.py`` binds no global name beyond the moved ones, its imports and the module
   ``logger`` (symtable / AST), and every global a body reads is bound;
5. a fresh interpreter imports ``agent_loop`` + ``task_service`` cleanly, and also imports
   ``search_vocabulary`` FIRST cleanly (the two modules import each other's names: see the
   module docstring of ``search_vocabulary.py``);
6. the importers are byte-unchanged against PHASE_BASE.

⚠ 306-03 adds Seam A's ONE narrowing line to ``with_search_vocabulary`` as a SEPARATE commit and
retires it from this fence BY NAME in ``RETIRED`` with the reason as the value (SEED-177: retire a
fence deliberately, never trip it by surprise). ``RETIRED`` is EMPTY in 306-01.
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

PHASE_BASE_SHA = "cea2df294f5d3d2ded260d2b64b9f66b54068230"

REPO_ROOT = Path(__file__).resolve().parents[3]
BACKEND_DIR = REPO_ROOT / "backend"

_TOOL_REL = "backend/app/services/search_documents_tool.py"
_VOCAB_REL = "backend/app/services/search_vocabulary.py"

MOVE_MAP: tuple[str, ...] = (
    "_MAX_VOCAB_FIELDS",
    "_MAX_VOCAB_OPTIONS",
    "_MAX_VOCAB_TYPES",
    "SearchVocabulary",
    "load_search_vocabulary",
    "_VOCAB_TOKEN_MAX",
    "_VOCAB_NOTE_MAX",
    "_VOCAB_LABEL_RE",
    "_VOCAB_KEY_RE",
    "_VOCAB_TYPES",
    "_VOCAB_FRAME",
    "_vocab_value",
    "_vocab_key",
    "_vocabulary_entry",
    "_bounded_join",
    "_vocabulary_note",
    "with_search_vocabulary",
    "today_line",
)

# Read from search_documents_tool by an importer (app) or a test → re-exported as the same object.
_REEXPORTED = (
    "SearchVocabulary", "load_search_vocabulary", "today_line", "with_search_vocabulary",
    "_VOCAB_NOTE_MAX",  # tests/unit/test_272_review_fixes.py reads sdt._VOCAB_NOTE_MAX
)

# Names the moved bodies read that stay homed in search_documents_tool.py (imported, not moved).
_BORROWED = ("DATE_WORDS", "_field_label")

_IMPORTERS = ("backend/app/services/agent_loop.py", "backend/app/services/task_service.py")

RETIRED: dict[str, str] = {}


def _blob_at_base(rel_path: str) -> str:
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


def test_move_map_shape():
    assert len(MOVE_MAP) == len(set(MOVE_MAP)) == 18
    assert set(_REEXPORTED) <= set(MOVE_MAP)
    assert not set(_BORROWED) & set(MOVE_MAP)
    assert set(RETIRED) <= set(MOVE_MAP)


def test_moved_bindings_are_ast_identical():
    base = _bindings(_blob_at_base(_TOOL_REL))
    home = _bindings(_source(_VOCAB_REL))
    compared = []
    for name in MOVE_MAP:
        if name in RETIRED:
            continue
        assert name in base, f"{name} not in {_TOOL_REL} at {PHASE_BASE_SHA}"
        assert name in home, f"{name} not found in {_VOCAB_REL}"
        assert ast.dump(home[name]) == ast.dump(base[name]), (
            f"{name} in {_VOCAB_REL} is not AST-identical to its PHASE_BASE source — a move is a cut"
        )
        compared.append(name)
    assert len(compared) == len(MOVE_MAP) - len(RETIRED)


def test_reexports_are_the_same_objects():
    tool = importlib.import_module("app.services.search_documents_tool")
    vocab = importlib.import_module("app.services.search_vocabulary")
    for name in _REEXPORTED:
        assert getattr(tool, name) is getattr(vocab, name), f"{name} is a copy, not a re-export"
    # The borrowed names are search_documents_tool's own objects, read (not copied) by the move.
    for name in _BORROWED:
        assert getattr(vocab, name) is getattr(tool, name), name


def test_each_moved_name_has_exactly_one_home():
    tool_defs = _definition_names(_source(_TOOL_REL))
    vocab_defs = _definition_names(_source(_VOCAB_REL))
    problems = []
    for name in MOVE_MAP:
        if name in tool_defs:
            problems.append(f"{name} is still DEFINED in {_TOOL_REL}")
        if vocab_defs.count(name) != 1:
            problems.append(f"{name} is defined {vocab_defs.count(name)}x in {_VOCAB_REL}")
    for name in _BORROWED:
        if name in vocab_defs:
            problems.append(f"{name} is re-defined in {_VOCAB_REL} (it stays homed in the tool)")
    assert problems == [], "\n".join(problems)


def test_search_vocabulary_binds_nothing_new():
    """Only the moved names, imports and the module ``logger`` — no narrowing line yet (306-03)."""
    src = _source(_VOCAB_REL)
    assert set(_definition_names(src)) == set(MOVE_MAP) | {"logger"}
    assert "narrow_schemas" not in src


def test_the_tool_reexports_from_one_import_statement():
    tree = ast.parse(_source(_TOOL_REL))
    imports = [
        n for n in ast.walk(tree)
        if isinstance(n, ast.ImportFrom) and n.module == "app.services.search_vocabulary"
    ]
    assert len(imports) == 1
    assert {a.name for a in imports[0].names} == set(_REEXPORTED)


@pytest.mark.parametrize("stmt", (
    "import app.services.agent_loop, app.services.task_service",
    "import app.services.search_vocabulary",
    "import app.services.search_documents_tool",
))
def test_fresh_interpreter_imports_cleanly(stmt):
    proc = subprocess.run(
        [sys.executable, "-c", stmt],
        cwd=BACKEND_DIR, capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    assert proc.returncode == 0, f"`{stmt}` failed in a fresh interpreter:\n{proc.stderr}"


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
    for scope in _child_tables(module):
        for sym in scope.get_symbols():
            if sym.is_referenced() and sym.is_global() and sym.get_name() not in allowed:
                unresolved.add(f"{scope.get_name()}:{sym.get_name()}")
    return sorted(unresolved)


@pytest.mark.parametrize("rel", (_VOCAB_REL, _TOOL_REL))
def test_every_global_a_body_reads_is_bound(rel):
    assert _unbound_globals(_source(rel), rel) == []


def test_the_importers_are_byte_unchanged():
    for rel in _IMPORTERS:
        assert _source(rel).replace("\r\n", "\n") == _blob_at_base(rel).replace("\r\n", "\n"), rel
