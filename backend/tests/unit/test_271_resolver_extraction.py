"""Phase 271 (271-01 Task 1) — the resolver's fragment walk + validation are SHARED functions.

The document-search core (``document_search_service``) must reuse the shipped resolver's
fragment walk and validation, never fork them (D-115-6: "a fork re-opens the leak"). This
suite pins the extraction:

  * ``document_view_resolver`` exposes module-level ``apply_fragments(q, fragments,
    subtree=None)`` and ``async validate_and_compile(caller, flt, supabase)``;
  * ``resolve_filter`` no longer carries its own walk (no ``q.contains("metadata"`` in its
    source) and calls BOTH shared functions;
  * ``apply_fragments`` issues the exact builder calls (containment → one ``.contains``;
    a subtree → a trailing ``.in_("folder_id", subtree)``; no subtree → no ``.in_``);
  * ``validate_and_compile`` raises ``ResolveError`` (422) for a ``_``-prefixed field and
    for a field outside the live whitelist.

Imports are inside the test bodies so the RED state is an AttributeError / ImportError per
test, never a collection error.
"""

import inspect

import pytest


class _Recorder:
    """A chainable fake builder that logs every call in order."""

    def __init__(self):
        self.calls: list[tuple] = []

    def __getattr__(self, name):
        def _call(*args, **kwargs):
            self.calls.append((name, args, kwargs))
            return self

        return _call


def test_module_exposes_shared_walk_and_validation():
    import app.services.document_view_resolver as m

    assert callable(m.apply_fragments)
    assert inspect.iscoroutinefunction(m.validate_and_compile)
    params = list(inspect.signature(m.apply_fragments).parameters)
    assert params == ["q", "fragments", "subtree"]
    assert inspect.signature(m.apply_fragments).parameters["subtree"].default is None


def test_resolve_filter_carries_no_walk_of_its_own_and_calls_both():
    import app.services.document_view_resolver as m

    src = inspect.getsource(m.resolve_filter)
    assert 'q.contains("metadata"' not in src, "the walk must live ONLY in apply_fragments"
    assert "apply_fragments(" in src
    assert "validate_and_compile(" in src
    # The walk exists exactly once in the module (inside apply_fragments).
    module_src = inspect.getsource(m)
    assert module_src.count('q.contains("metadata"') == 1
    assert 'q.contains("metadata"' in inspect.getsource(m.apply_fragments)


def test_apply_fragments_containment_issues_exactly_one_contains():
    from app.services.document_view_resolver import apply_fragments
    from app.services.view_filter_compiler import Fragment

    q = _Recorder()
    frag = Fragment(leg="containment", field="reviewed", builder="contains", value=True)
    out = apply_fragments(q, [frag])
    assert out is q
    contains = [c for c in q.calls if c[0] == "contains"]
    assert contains == [("contains", ("metadata", {"reviewed": True}), {})]
    assert not any(c[0] == "in_" for c in q.calls), "no subtree → no .in_"


def test_apply_fragments_subtree_ends_with_folder_in():
    from app.services.document_view_resolver import apply_fragments
    from app.services.view_filter_compiler import Fragment

    q = _Recorder()
    frag = Fragment(leg="typed", field="document_type_norm", builder="eq", value="contract")
    apply_fragments(q, [frag], ["f1", "f2"])
    assert q.calls[0] == ("eq", ("document_type_norm", "contract"), {})
    assert q.calls[-1] == ("in_", ("folder_id", ["f1", "f2"]), {})


def test_apply_fragments_no_subtree_issues_no_in():
    from app.services.document_view_resolver import apply_fragments

    q = _Recorder()
    apply_fragments(q, [], None)
    assert q.calls == []


@pytest.mark.asyncio
async def test_validate_and_compile_rejects_underscore_and_unknown_fields(monkeypatch):
    import app.services.document_view_resolver as m
    from app.models.document_view import ViewCondition, ViewFilter

    async def _fake_meta(user_id, supabase):
        return {"document_type", "date", "custom_ok"}, set()

    monkeypatch.setattr(m, "_build_field_meta", _fake_meta)

    for bad in ("_confidence", "not_whitelisted"):
        flt = ViewFilter(op="and", conditions=[ViewCondition(field=bad, op="eq", value="x")])
        with pytest.raises(m.ResolveError) as ei:
            await m.validate_and_compile("00000000-0000-0000-0000-000000000001", flt, object())
        assert ei.value.status == 422

    ok = ViewFilter(op="and", conditions=[ViewCondition(field="document_type", op="eq", value="Contract")])
    frags = await m.validate_and_compile("00000000-0000-0000-0000-000000000001", ok, object())
    assert len(frags) == 1
    assert frags[0].field == "document_type_norm"
    assert frags[0].value == "contract"
