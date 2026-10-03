"""Phase 272-01 (D-13 / D-18) — the retrieval filter seam exists as DATA, and as TYPES.

Two contracts 272-03 (the resolver) and 272-04 (the handler) build on, pinned before either lands:

* **D-13 — a default predicate is DATA.** ``DEFAULT_PREDICATES`` names the three predicates the
  retrieval RPCs already hardcode. Phase 275 appends ``not_archived`` with ``enforced_in_rpc=False``
  and every search then resolves a scope — with no new branch. The source fence at the bottom
  proves ``requires_resolved_scope`` cannot be special-casing a predicate by name.
* **D-18 — "no filter" and "filter matched nothing" are different TYPES.** The caller passes
  ``None`` for no filter; an empty ``ScopeResult`` means matched nothing. There is no value that
  means "empty = unrestricted", which is the 266 CR-01 inversion this contract exists to make
  unwritable.

The module is imported LAZILY inside each test: before it exists, a module-level import would make
the whole file one collection error, and a collection error is an absence, not evidence.
"""
from __future__ import annotations

import ast
import importlib
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
_SCOPE_REL = "backend/app/services/retrieval_scope.py"


def _scope():
    return importlib.import_module("app.services.retrieval_scope")


def test_default_predicates_are_the_three_the_rpcs_hardcode():
    m = _scope()
    names = {p.name for p in m.DEFAULT_PREDICATES}
    assert names == {"latest_only", "not_source_disconnected", "caller_visibility"}
    assert len(m.DEFAULT_PREDICATES) == 3
    assert all(p.enforced_in_rpc is True for p in m.DEFAULT_PREDICATES)
    assert all(p.condition is None for p in m.DEFAULT_PREDICATES)


def test_no_conditions_and_rpc_enforced_defaults_need_no_resolved_scope():
    m = _scope()
    assert m.requires_resolved_scope([]) is False
    assert m.requires_resolved_scope([], m.DEFAULT_PREDICATES) is False


def test_a_condition_requires_a_resolved_scope():
    m = _scope()
    assert m.requires_resolved_scope([{"field": "date", "op": "between"}]) is True


def test_an_appended_non_rpc_predicate_requires_a_resolved_scope_with_no_new_branch():
    """Phase 275's archived exclusion, ridden as data: one tuple entry, no code change."""
    m = _scope()
    predicates = m.DEFAULT_PREDICATES + (
        m.RetrievalPredicate("not_archived", {"field": "archived", "op": "is_empty"}, False),
    )
    assert m.requires_resolved_scope([], predicates) is True


def test_scope_result_distinguishes_matched_nothing_by_type():
    m = _scope()
    empty = m.ScopeResult(document_ids=(), applied=(), undated_excluded=None, date_field=None)
    assert empty.is_empty is True
    one = m.ScopeResult(
        document_ids=("d1",), applied=(), undated_excluded=None, date_field=None
    )
    assert one.is_empty is False


def test_requires_resolved_scope_is_data_driven_not_name_driven():
    """Source fence: the function body contains NO string literal at all beyond its docstring —
    so it cannot be naming a predicate (``"latest_only"``, ``"not_archived"`` …) to branch on."""
    src = (REPO_ROOT / _SCOPE_REL).read_text(encoding="utf-8")
    fn = next(
        (
            n
            for n in ast.parse(src).body
            if isinstance(n, ast.FunctionDef) and n.name == "requires_resolved_scope"
        ),
        None,
    )
    assert fn is not None, "POSITIVE CONTROL FAILED — requires_resolved_scope not found"
    body = fn.body
    if (
        body
        and isinstance(body[0], ast.Expr)
        and isinstance(body[0].value, ast.Constant)
        and isinstance(body[0].value.value, str)
    ):
        body = body[1:]
    assert body, "POSITIVE CONTROL FAILED — requires_resolved_scope has no code to fence"
    literals = [
        n.value
        for stmt in body
        for n in ast.walk(stmt)
        if isinstance(n, ast.Constant) and isinstance(n.value, str)
    ]
    assert literals == [], f"requires_resolved_scope names something by string: {literals}"
