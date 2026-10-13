"""
DEBT-09 (Phase 278, plan 278-02) — ONE home for the document-filter vocabulary.

The vocabulary is two things:
  1. Find's three timestamptz date words → their ``public.documents`` column
     (``added`` → ``created_at``, ``source_created`` → ``source_created_at``,
     ``source_modified`` → ``source_modified_at``).
  2. The "topics is a JSON list" rule (built-in metadata fields stored as an array).

Before 278 the map was typed twice and the two copies had already DIFFERED (``retrieval_scope`` had
four entries, ``document_search_service`` three), and the list rule was typed twice (a tuple and a
frozenset). The home is ``backend/app/services/document_vocabulary.py``; the three named modules
import it, and this fence fails when a copy reappears.

Six tests (``test_column_tables_cover_the_home`` added by 278-REVIEW WR-02):
  * ``test_column_tables_cover_the_home`` — the column half's two dependent tables
    (``document_search_service._TIMESTAMP_COLUMNS``, ``retrieval_scope._MONTH_SQL``) cover the home.
  * ``test_values_equal_phase_base`` — every module binding equals its PHASE_BASE literal, key order
    included, so every Find, View and agent filter returns exactly what it did (behaviour unchanged).
  * ``test_named_modules_import_the_home`` — the three named modules carry the import (source anchor).
  * ``test_runtime_identity`` — layer 1: the named modules' bindings ARE (``is``) or are derived from
    the home's objects.
  * ``test_no_literal_copy_outside_the_home`` — layer 2: an AST ban on literal copies anywhere under
    ``backend/app``.
  * ``test_allowlisted_word_lists_match`` — the two word-list copies that are deliberately NOT edited
    (``search_documents_tool.DATE_WORDS``, ``models.document_search.DateWhich``) still equal the home.
"""
from __future__ import annotations

import ast
import importlib
import os
import re
import subprocess
import typing
from pathlib import Path

import pytest

PHASE_BASE_SHA = "25b4235c540b1e21a055301ce576d1deb78d5634"
REPO_ROOT = Path(__file__).resolve().parents[3]
APP_DIR = REPO_ROOT / "backend" / "app"
HOME_REL = Path("services") / "document_vocabulary.py"
HOME_MODULE = "app.services.document_vocabulary"

_DATE_WORD_KEYS = {"added", "source_created", "source_modified"}

# The three modules DEBT-09 names, and the bindings each one owns.
NAMED_MODULES = {
    "app.services.document_search_service": "backend/app/services/document_search_service.py",
    "app.services.retrieval_scope": "backend/app/services/retrieval_scope.py",
    "app.services.view_filter_compiler": "backend/app/services/view_filter_compiler.py",
}
PINNED_BINDINGS = [
    ("app.services.document_search_service", "_DATE_COLUMN"),
    ("app.services.retrieval_scope", "_DATE_WORDS"),
    ("app.services.retrieval_scope", "_DATE_FIELD_COLUMN"),
    ("app.services.retrieval_scope", "LIST_FIELDS"),
    ("app.services.view_filter_compiler", "LIST_VALUE_FIELDS"),
]

def _blob_at_base(rel_path: str, sha: str = PHASE_BASE_SHA) -> str:
    """A tracked file's contents at PHASE_BASE."""
    # ⚠ `encoding` IS LOAD-BEARING ON WINDOWS (the test_214 / test_272_pure_move precedent): with
    # `text=True` alone the locale codec (cp1252) dies on the `⚠` / `—` in these modules' comments.
    return subprocess.run(
        ["git", "show", f"{sha}:{rel_path}"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=True,
    ).stdout


def _base_literal(rel_path: str, name: str):
    """``ast.literal_eval`` of a top-level binding's value at PHASE_BASE.

    ``frozenset({...})`` is evaluated through its literal argument and re-wrapped.
    """
    tree = ast.parse(_blob_at_base(rel_path))
    for node in tree.body:
        if isinstance(node, ast.Assign):
            targets = [t.id for t in node.targets if isinstance(t, ast.Name)]
            value = node.value
        elif isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
            targets = [node.target.id]
            value = node.value
        else:
            continue
        if name not in targets or value is None:
            continue
        if (
            isinstance(value, ast.Call)
            and isinstance(value.func, ast.Name)
            and value.func.id == "frozenset"
            and len(value.args) == 1
        ):
            return frozenset(ast.literal_eval(value.args[0]))
        return ast.literal_eval(value)
    raise AssertionError(f"{name} not found as a top-level binding in {rel_path} at {PHASE_BASE_SHA}")


def _vocab():
    # Imported per test (never at module level): while the home is missing each test fails on its
    # own, rather than as a collection error — the backend gate requires 0 collection errors.
    return importlib.import_module(HOME_MODULE)


# ── Behaviour pin ────────────────────────────────────────────────────────────────────────────────


def test_values_equal_phase_base():
    """Every binding equals its PHASE_BASE literal value — and, for maps, its key ORDER."""
    for module_name, binding in PINNED_BINDINGS:
        rel_path = NAMED_MODULES[module_name]
        runtime = getattr(importlib.import_module(module_name), binding)
        base = _base_literal(rel_path, binding)
        assert type(runtime) is type(base), (
            f"{module_name}.{binding} is a {type(runtime).__name__}; at PHASE_BASE it was a "
            f"{type(base).__name__}"
        )
        assert runtime == base, (
            f"{module_name}.{binding} = {runtime!r} differs from its PHASE_BASE value {base!r} — "
            "a filter would now return something different (DEBT-09 must be behaviour-unchanged)"
        )
        if isinstance(base, dict):
            assert list(runtime.items()) == list(base.items()), (
                f"{module_name}.{binding} key order changed: {list(runtime)} vs base {list(base)}"
            )


# ── Source anchor ────────────────────────────────────────────────────────────────────────────────


def test_named_modules_import_the_home():
    missing = []
    for module_name, rel_path in NAMED_MODULES.items():
        tree = ast.parse((REPO_ROOT / rel_path).read_text(encoding="utf-8"))
        if not any(
            isinstance(node, ast.ImportFrom) and node.module == HOME_MODULE for node in tree.body
        ):
            missing.append(rel_path)
    assert not missing, (
        f"DEBT-09: these modules do not import the vocabulary home ({HOME_MODULE}) at top level: "
        f"{missing}"
    )


# ── Layer 1: runtime identity ────────────────────────────────────────────────────────────────────


def test_runtime_identity():
    vocab = _vocab()
    dss = importlib.import_module("app.services.document_search_service")
    scope = importlib.import_module("app.services.retrieval_scope")
    vfc = importlib.import_module("app.services.view_filter_compiler")

    assert dss._DATE_COLUMN is vocab.TIMESTAMP_DATE_COLUMNS, (
        "document_search_service._DATE_COLUMN is not the home's object — it was re-typed"
    )
    assert scope.LIST_FIELDS is vocab.LIST_FIELD_NAMES, (
        "retrieval_scope.LIST_FIELDS is not the home's object — it was re-typed"
    )
    expected_field_column = {**vocab.TIMESTAMP_DATE_COLUMNS, "date": "date_typed"}
    assert scope._DATE_FIELD_COLUMN == expected_field_column
    assert list(scope._DATE_FIELD_COLUMN.items()) == list(expected_field_column.items())
    assert scope._DATE_WORDS == tuple(vocab.TIMESTAMP_DATE_COLUMNS)
    assert vfc.LIST_VALUE_FIELDS == frozenset(vocab.LIST_FIELD_NAMES)


def test_column_tables_cover_the_home():
    """278-REVIEW WR-02 — the COLUMN half of the vocabulary has two dependent tables.

    * ``document_search_service._TIMESTAMP_COLUMNS`` decides whether Find's sort parses a column as a
      datetime. It is derived from the home; this pins that it still equals the home's column set.
    * ``retrieval_scope._MONTH_SQL`` is indexed with ``_MONTH_SQL[_DATE_FIELD_COLUMN[field]]``. It must
      stay CONSTANT SQL text (no splicing a column name into SQL — ``test_no_f_string_sql``), so it
      cannot be derived; it is pinned instead. A fourth date word added to the home without its month
      statement would otherwise be a ``KeyError`` on the agent path, not a failing test.
    """
    vocab = _vocab()
    dss = importlib.import_module("app.services.document_search_service")
    scope = importlib.import_module("app.services.retrieval_scope")

    assert dss._TIMESTAMP_COLUMNS == set(vocab.TIMESTAMP_DATE_COLUMNS.values()), (
        f"document_search_service._TIMESTAMP_COLUMNS {sorted(dss._TIMESTAMP_COLUMNS)!r} differs from "
        f"the home's columns {sorted(vocab.TIMESTAMP_DATE_COLUMNS.values())!r} — Find would sort a "
        "date column as a string"
    )
    assert set(scope._MONTH_SQL) == set(scope._DATE_FIELD_COLUMN.values()), (
        f"retrieval_scope._MONTH_SQL keys {sorted(scope._MONTH_SQL)!r} differ from the date columns "
        f"{sorted(scope._DATE_FIELD_COLUMN.values())!r} — add a constant month statement per column"
    )


# ── Layer 2: AST ban on literal copies ───────────────────────────────────────────────────────────
#
# ⚠ WHY TWO LAYERS — the test_257 "PROVEN BLIND" lesson, carried forward. test_257's first single-home
# fence matched only the textual shape nobody would copy, and a verbatim second home planted beside
# it reported "1 passed". So each layer here is paired with the hole the other one leaves:
#   * An EQUAL re-typed copy inside a named module passes every equality check (it is "currently
#     equal") and fails only layer 1's ``is`` — that is what makes "one home" mechanical rather than
#     a coincidence of values.
#   * A FOURTH copy in a module this file does not name is invisible to layer 1 (it never looks
#     there) and is caught only by this walk over all of ``backend/app``.
# Both were driven RED against planted copies at 278-02 (see 278-02-SUMMARY.md).

_LIST_NAME_RE = re.compile(r"(?i)list")
_COLLECTION_CALLS = {"frozenset", "set", "tuple"}


def _is_column_value(node: ast.AST | None) -> bool:
    return (
        isinstance(node, ast.Constant)
        and isinstance(node.value, str)
        and (node.value.endswith("_at") or node.value == "date_typed")
    )


def _is_date_map(node: ast.Dict) -> bool:
    for key, value in zip(node.keys, node.values):
        if (
            isinstance(key, ast.Constant)
            and isinstance(key.value, str)
            and key.value in _DATE_WORD_KEYS
            and _is_column_value(value)
        ):
            return True
    return False


def _contains_topics_collection(value: ast.AST | None) -> bool:
    if isinstance(value, ast.Call) and isinstance(value.func, ast.Name) and value.func.id in _COLLECTION_CALLS:
        return any(_contains_topics_collection(arg) for arg in value.args)
    if isinstance(value, (ast.Tuple, ast.List, ast.Set)):
        return any(
            isinstance(elt, ast.Constant) and elt.value == "topics" for elt in value.elts
        )
    return False


def _assign_names(node: ast.AST) -> list[str]:
    if isinstance(node, ast.Assign):
        names = []
        for target in node.targets:
            if isinstance(target, ast.Name):
                names.append(target.id)
            elif isinstance(target, ast.Attribute):
                names.append(target.attr)
        return names
    if isinstance(node, ast.AnnAssign):
        if isinstance(node.target, ast.Name):
            return [node.target.id]
        if isinstance(node.target, ast.Attribute):
            return [node.target.attr]
    return []


def _is_topics_only_literal(node: ast.AST) -> bool:
    """278-REVIEW WR-03 — a tuple/list/set literal whose elements are exactly ``{"topics"}``.

    Matched WHATEVER the surrounding code is: an assignment under any name (``ARRAY_FIELDS``), the
    argument of ``frozenset(...)`` / ``set(...)`` / ``tuple(...)``, or the right side of an inline
    ``field in ("topics",)`` test. The walk visits every node, so the literal is found in all three.
    """
    return (
        isinstance(node, (ast.Tuple, ast.List, ast.Set))
        and bool(node.elts)
        and all(isinstance(elt, ast.Constant) and elt.value == "topics" for elt in node.elts)
    )


def _is_date_map_call(node: ast.AST) -> bool:
    """278-REVIEW WR-03 — ``dict(added="created_at", ...)``: the keyword-call spelling of a date map."""
    return (
        isinstance(node, ast.Call)
        and isinstance(node.func, ast.Name)
        and node.func.id == "dict"
        and any(kw.arg in _DATE_WORD_KEYS and _is_column_value(kw.value) for kw in node.keywords)
    )


def _violations_in(tree: ast.AST, rel: str) -> list[str]:
    found = []
    parents: dict[ast.AST, ast.AST] = {}
    for parent in ast.walk(tree):
        for child in ast.iter_child_nodes(parent):
            parents[child] = parent

    for node in ast.walk(tree):
        if (isinstance(node, ast.Dict) and _is_date_map(node)) or _is_date_map_call(node):
            owner = parents.get(node)
            names = _assign_names(owner) if owner is not None else []
            found.append(f"{rel}:{node.lineno} date-word->column map {names[0] if names else '<expr>'}")
        elif _is_topics_only_literal(node):
            # Name-independent (WR-03): the first fence matched only targets spelled ``*list*``, so
            # ``ARRAY_FIELDS = frozenset({"topics"})`` and ``if field in ("topics",)`` passed it.
            owner = parents.get(node)
            if isinstance(owner, ast.Call):  # frozenset({...}) — name the assignment, not the call
                owner = parents.get(owner)
            names = _assign_names(owner) if owner is not None else []
            found.append(f"{rel}:{node.lineno} list-field rule {names[0] if names else '<expr>'}")
        elif isinstance(node, (ast.Assign, ast.AnnAssign)):
            list_names = [n for n in _assign_names(node) if _LIST_NAME_RE.search(n)]
            if list_names and _contains_topics_collection(node.value):
                found.append(f"{rel}:{node.lineno} list-field rule {list_names[0]}")
    # A ``LIST_*`` target holding a topics-only literal matches both rules; report it once.
    return list(dict.fromkeys(found))


# 278-REVIEW WR-03 — files allowed to spell the vocabulary literally, each with its reason. The widened
# detector above ALSO runs over these files, and every entry must still produce at least one hit: an
# entry that matches nothing is stale (the code moved or the detector went blind) and fails the test.
# Measured when WR-03 landed: the widened detector's only hits in ``backend/app`` were in the home, so
# nothing else is listed. ⛔ Never add an entry to silence a new hit — triage it: import the home.
_LITERAL_ALLOWLIST: dict[str, str] = {
    HOME_REL.as_posix(): "the home itself: TIMESTAMP_DATE_COLUMNS and LIST_FIELD_NAMES are defined here",
}


def test_no_literal_copy_outside_the_home():
    violations: list[str] = []
    allowlisted_hits: dict[str, list[str]] = {rel: [] for rel in _LITERAL_ALLOWLIST}
    if not (APP_DIR / HOME_REL).is_file():
        violations.append(f"{HOME_REL.as_posix()} missing: there is no home to import")
    files_walked = 0
    for root, _dirs, files in os.walk(APP_DIR):
        if "__pycache__" in root:
            continue
        for name in files:
            if not name.endswith(".py"):
                continue
            path = Path(root) / name
            rel = path.relative_to(APP_DIR).as_posix()
            files_walked += 1
            # `utf-8-sig`: at least one module (email_extraction_service.py) starts with a BOM, which
            # plain `utf-8` hands to ast.parse as U+FEFF — a SyntaxError, i.e. a RED for the wrong reason.
            tree = ast.parse(path.read_text(encoding="utf-8-sig"), filename=str(path))
            hits = _violations_in(tree, rel)
            if rel in _LITERAL_ALLOWLIST:
                allowlisted_hits[rel].extend(hits)
            else:
                violations.extend(hits)

    # Non-vacuity: a walk that saw nothing proves nothing.
    assert files_walked > 100, f"walked only {files_walked} files under {APP_DIR} — the walk is broken"
    # Non-staleness, which is also the detector's self-test: the home's own definitions must be SEEN.
    stale = [rel for rel, hits in allowlisted_hits.items() if not hits]
    assert not stale, (
        f"allowlist entries that no longer match anything (stale, or the detector went blind): {stale}"
    )
    home_hits = " ".join(allowlisted_hits.get(HOME_REL.as_posix(), []))
    assert "date-word->column map" in home_hits and "list-field rule" in home_hits, (
        f"the detector no longer sees BOTH definitions in the home — it is blind: {home_hits!r}"
    )
    assert not violations, (
        "DEBT-09: the document-filter vocabulary has a literal copy outside its one home "
        f"(app/{HOME_REL.as_posix()}). Import TIMESTAMP_DATE_COLUMNS / LIST_FIELD_NAMES instead:\n  "
        + "\n  ".join(violations)
    )


# ── Allowlisted word lists (deliberately not edited: D-05, hot model file) ────────────────────────


def test_allowlisted_word_lists_match():
    vocab = _vocab()
    tool = importlib.import_module("app.services.search_documents_tool")
    models = importlib.import_module("app.models.document_search")
    words = tuple(vocab.TIMESTAMP_DATE_COLUMNS)
    assert tool.DATE_WORDS == words, (
        f"search_documents_tool.DATE_WORDS {tool.DATE_WORDS!r} drifted from the home {words!r}"
    )
    assert typing.get_args(models.DateWhich) == words, (
        f"models.document_search.DateWhich {typing.get_args(models.DateWhich)!r} drifted from the "
        f"home {words!r}"
    )
