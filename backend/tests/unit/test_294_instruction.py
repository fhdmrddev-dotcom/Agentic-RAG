"""Phase 294-01 (D-09 / D-10 / D-23 / SC#6) — the optional steering instruction, end to end.

* Schema: ONE plain-string ``instruction`` property on ``SEARCH_DOCUMENTS_TOOL``, not required, no
  anyOf / type arrays / maxLength; Anthropic and Google keep it as a plain string; still 30 tools.
* Clamp: non-string → None; control characters stripped; whitespace collapsed; ≤ 300 chars.
* Handler: the kwarg reaches ``search_documents`` ONLY when the clamped value is non-empty, on
  both call sites, so fixed-signature fakes keep working (RESEARCH Pitfall 4).
* Retrieval: ``rerank`` gets ``instruction=`` only when truthy and ``keep_documents=True`` only on
  the filtered path; the unfiltered call is otherwise unchanged.
* Trace: the ``search-documents`` run inputs carry no planted key and no supabase repr.
"""
from __future__ import annotations

import json
from types import SimpleNamespace

import pytest

from tests.unit.decision_engine_fakes import PLANTED_KEYS, FakeLangSmithClient, tracing_into, user_settings

_FORBIDDEN = {"anyOf", "oneOf", "allOf", "$ref", "maxLength"}


# ── schema ────────────────────────────────────────────────────────────────────────────────────

def _prop():
    from app.services.openai_service import SEARCH_DOCUMENTS_TOOL

    return SEARCH_DOCUMENTS_TOOL["function"]["parameters"]["properties"]["instruction"]


def test_instruction_is_one_optional_plain_string():
    from app.services.openai_service import SEARCH_DOCUMENTS_TOOL

    prop = _prop()
    assert set(prop) == {"type", "description"}
    assert prop["type"] == "string"
    assert prop["description"].strip()
    assert "instruction" not in SEARCH_DOCUMENTS_TOOL["function"]["parameters"]["required"]
    assert not (_FORBIDDEN & set(prop))


def test_instruction_description_is_truthful_about_the_prune():
    """294-REVIEW WR-01: the instruction is folded into the relevance question, and that score is
    what prune() compares against PRUNE_FLOOR, so it CAN drop a passage. The model must not be told
    it never filters."""
    from app.services.rerank_engines.prune import MIN_KEEP

    d = _prop()["description"]
    assert "never filters" not in d and "only to reorder" not in d.lower()
    assert "steers the relevance scores" in d
    assert f"at least {MIN_KEEP}" in d and "never none" in d


def test_anthropic_conversion_keeps_a_plain_string():
    from app.services.anthropic_service import _convert_tools_to_anthropic
    from app.services.openai_service import SEARCH_DOCUMENTS_TOOL

    (tool,) = _convert_tools_to_anthropic([SEARCH_DOCUMENTS_TOOL])
    assert tool["input_schema"]["properties"]["instruction"]["type"] == "string"


def test_google_sanitizer_keeps_a_plain_string_and_the_tool_constructs():
    from app.services.google_service import _convert_tools_to_google, _sanitize_schema_for_google
    from app.services.openai_service import SEARCH_DOCUMENTS_TOOL

    san = _sanitize_schema_for_google(SEARCH_DOCUMENTS_TOOL["function"]["parameters"])
    assert san["properties"]["instruction"]["type"] in ("string", "STRING")
    gtools = _convert_tools_to_google([SEARCH_DOCUMENTS_TOOL])
    assert gtools and gtools[0].function_declarations[0].name == "search_documents"


def test_the_registry_still_has_thirty_tools():
    from app.services.tool_dispatcher import _TOOL_REGISTRY

    assert len(_TOOL_REGISTRY) == 30


# ── clamp ─────────────────────────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("value,expected", [
    (None, None), (42, None), ([], None), ("", None), ("   \n\t ", None),
    ("  prefer\n\n2025\tfigures \x00", "prefer 2025 figures"),
    ("signed\x07 version\x1b only", "signed version only"),
])
def test_clamp(value, expected):
    from app.services.search_documents_tool import _clamp_instruction

    assert _clamp_instruction(value) == expected


def test_clamp_caps_at_300_characters():
    from app.services.search_documents_tool import _clamp_instruction

    out = _clamp_instruction("x" * 1000)
    assert out == "x" * 300


# ── handler: kwarg presence / absence ─────────────────────────────────────────────────────────

def _ctx():
    async def _emit(*a, **k):
        return None

    return SimpleNamespace(
        current_user={"id": "user-1"}, supabase=object(), user_settings=None,
        folder_subtree_ids=None, run_id="run-1", thread_id="thread-1", parent_run_id=None,
        spawn=lambda coro: coro.close(), has_connection_retrieval=False, emit=_emit, redis=object(),
        empty_filter_fields_in_run=set(),
    )


async def test_unfiltered_without_instruction_passes_no_kwarg_to_a_fixed_signature_fake(monkeypatch):
    import app.services.search_documents_tool as sdt

    seen = {}

    async def _fixed(query, user_id, supabase, metadata_filter=None, user_settings=None, folder_ids=None):
        seen["called"] = True
        return [], 0.0

    monkeypatch.setattr(sdt, "search_documents", _fixed)
    monkeypatch.setattr(sdt, "write_audit_entry", lambda **kw: object())
    await sdt.handle_search_documents({"query": "q"}, _ctx())
    assert seen == {"called": True}


@pytest.mark.parametrize("raw", [None, "", "   ", 7])
async def test_unfiltered_empty_or_invalid_instruction_passes_no_kwarg(monkeypatch, raw):
    import app.services.search_documents_tool as sdt

    seen = {}

    async def _rec(*args, **kwargs):
        seen.update(kwargs)
        return [], 0.0

    monkeypatch.setattr(sdt, "search_documents", _rec)
    monkeypatch.setattr(sdt, "write_audit_entry", lambda **kw: object())
    await sdt.handle_search_documents({"query": "q", "instruction": raw}, _ctx())
    assert "instruction" not in seen


async def test_unfiltered_with_instruction_passes_the_clamped_value(monkeypatch):
    import app.services.search_documents_tool as sdt

    seen = {}

    async def _rec(*args, **kwargs):
        seen.update(kwargs)
        return [], 0.0

    monkeypatch.setattr(sdt, "search_documents", _rec)
    monkeypatch.setattr(sdt, "write_audit_entry", lambda **kw: object())
    await sdt.handle_search_documents({"query": "q", "instruction": "  prefer   2025 "}, _ctx())
    assert seen["instruction"] == "prefer 2025"


@pytest.mark.parametrize("raw,expected", [("prefer 2025", "prefer 2025"), (None, None)])
async def test_filtered_call_site_carries_the_instruction_only_when_set(monkeypatch, raw, expected):
    from tests.unit.test_272_result_kinds import ACME, Rig, _hit, _scope

    rig = Rig(monkeypatch, scope=_scope(ids=["dA"]), hits=[_hit("dA", "f1")])
    args = {"query": "revenue", "filters": [ACME]}
    if raw is not None:
        args["instruction"] = raw
    await rig.call(args)
    assert len(rig.search_calls) == 1
    _args, kwargs = rig.search_calls[0]
    assert kwargs.get("document_ids") == ("dA",)
    if expected is None:
        assert "instruction" not in kwargs
    else:
        assert kwargs["instruction"] == expected


# ── retrieval_service: conditional kwargs to rerank ───────────────────────────────────────────

_ROWS = [
    {"id": f"c{i}", "document_id": f"d{i % 2}", "content": f"passage {i} " + " ".join(f"w{i}{j}" for j in range(8)),
     "chunk_index": i, "similarity": 0.9 - i / 20}
    for i in range(6)
]


@pytest.fixture
def rpc(monkeypatch):
    import app.services.retrieval_rpc as rrpc
    from app.config import settings

    async def _call(user_id, fn_sql, *args, **kwargs):
        return [dict(r) for r in _ROWS] if "match_document_chunks" in fn_sql else []

    monkeypatch.setattr(rrpc, "_call_as_user", _call)
    monkeypatch.setattr(rrpc, "embed_texts", lambda texts, **kw: [[0.25, 0.5]])
    for attr, value in {"retrieval_top_k": 3, "retrieval_match_threshold": 0.3, "hybrid_candidate_count": 20,
                        "rrf_k": 60, "vector_search_weight": 1.0, "keyword_search_weight": 1.0,
                        "rerank_top_n": 5, "rerank_enabled": True, "hybrid_search_enabled": True,
                        "hnsw_ef_search": 40, "hnsw_iterative_scan": "off"}.items():
        monkeypatch.setattr(settings, attr, value)


class _Sb:
    def table(self, name):
        class _Q:
            def select(self, *a, **k):
                return self

            def in_(self, *a, **k):
                return self

            def execute(self):
                return SimpleNamespace(data=[], count=None)
        return _Q()


def _recording_rerank(seen):
    def _fake(query, documents, top_n=None, user_settings=None, **kw):
        seen.append({"top_n": top_n, **kw})
        return list(documents)[:top_n]
    return _fake


@pytest.mark.parametrize("filtered,instruction,expected", [
    (False, None, {"top_n": 3}),
    (False, "prefer 2025", {"top_n": 3, "instruction": "prefer 2025"}),
    (True, None, {"top_n": 5, "keep_documents": True}),
    (True, "prefer 2025", {"top_n": 5, "instruction": "prefer 2025", "keep_documents": True}),
])
async def test_rerank_gets_conditional_kwargs(monkeypatch, rpc, filtered, instruction, expected):
    import app.services.retrieval_service as rs

    seen: list = []
    monkeypatch.setattr(rs, "rerank", _recording_rerank(seen))
    kw = {"instruction": instruction} if instruction else {}
    await rs.search_documents("q", "u1", _Sb(), user_settings=None,
                              document_ids=["d0", "d1"] if filtered else None, **kw)
    assert seen == [expected]


async def test_a_fixed_signature_rerank_still_works_unfiltered(monkeypatch, rpc):
    import app.services.retrieval_service as rs

    def _fixed(query, documents, top_n=None, user_settings=None):
        return list(documents)[:top_n]

    monkeypatch.setattr(rs, "rerank", _fixed)
    hits, _avg = await rs.search_documents("q", "u1", _Sb(), user_settings=None)
    assert len(hits) == 3


def test_instruction_is_keyword_only_and_document_ids_stays_last_positional():
    import inspect

    from app.services.retrieval_service import search_documents

    params = list(inspect.signature(search_documents).parameters.values())
    positional = [p for p in params if p.kind is inspect.Parameter.POSITIONAL_OR_KEYWORD]
    assert positional[-1].name == "document_ids"
    # ``config`` is added to the visible signature by langsmith's @traceable wrapper, not by us.
    (kwonly,) = [p for p in params if p.kind is inspect.Parameter.KEYWORD_ONLY and p.name != "config"]
    assert kwonly.name == "instruction" and kwonly.default is None


# ── search-documents trace redaction (SC#6) ───────────────────────────────────────────────────

class _SecretSupabase(_Sb):
    def __repr__(self):
        return "<Client Bearer sb-PLANTED-294>"


async def test_search_documents_trace_inputs_carry_no_key_or_supabase(monkeypatch, rpc):
    import app.services.retrieval_service as rs

    monkeypatch.setattr(rs, "rerank", lambda q, d, top_n=None, user_settings=None, **kw: list(d)[:top_n])
    us = user_settings(
        rerank_enabled=False, hybrid_search_enabled=True, retrieval_top_k=3, retrieval_match_threshold=0.3,
        hybrid_candidate_count=20, rrf_k=60, vector_search_weight=1.0, keyword_search_weight=1.0,
        hnsw_ef_search=40, hnsw_iterative_scan="off", embedding_model="text-embedding-3-small",
    )
    client = FakeLangSmithClient()
    with tracing_into(client):
        await rs.search_documents("q", "u1", _SecretSupabase(), user_settings=us)
    assert "search-documents" in client.names()
    text = client.text()
    for key in PLANTED_KEYS:
        assert key not in text
    assert "sb-PLANTED-294" not in text
    creates = [kw for op, _a, kw in client.calls if op == "create_run" and kw.get("name") == "search-documents"]
    inputs = creates[0]["inputs"]
    assert inputs["user_settings"] == "<redacted>" and inputs["supabase"] == "<redacted>"
    json.dumps(inputs["query"])
