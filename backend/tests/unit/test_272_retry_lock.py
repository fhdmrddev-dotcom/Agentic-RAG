"""Phase 272-04 Task 2 (D-09) — the structural retry lock: an empty filtered result cannot be widened.

SC#2 / SEED-153: a prompt rule alone is the "instruction, not filter" shape. So, within one turn,
once a filtered ``search_documents`` call has matched ZERO documents, any later ``search_documents``
call that DROPS one of that filter's fields is REFUSED, with the reason. A different VALUE on the
same field (September instead of October) is allowed.

The state is ``ToolContext.empty_filter_fields_in_run`` — a by-reference run accumulator (the
``dead_gap_tokens_in_run`` precedent): initialised ONCE in agent_loop, threaded into BOTH ToolContext
builds, and SHARED with task sub-agents by reference (deliberately unlike ``dead_gap_tokens_in_run``,
so a sub-agent cannot become an unfiltered bypass). ``None`` / absent on every unwired caller
(harness / eval / tests) makes the lock a no-op.
"""
from __future__ import annotations

import json
from types import SimpleNamespace

import pytest

import app.services.search_documents_tool as sdt
from app.services.retrieval_scope import ScopeResult

DEFS = [{"field_key": "legal_entity", "field_type": "enum", "options": ["Acme GmbH", "Beta Ltd"], "enabled": True}]
WHITELIST = {"title", "author", "date", "document_type", "topics", "language", "summary", "legal_entity"}

OCT = {"field": "date", "op": "between", "value": "2025-10-01", "value2": "2025-10-31"}
SEP = {"field": "date", "op": "between", "value": "2025-09-01", "value2": "2025-09-30"}
ACME = {"field": "legal_entity", "op": "eq", "value": "Acme GmbH"}


class Edges:
    def __init__(self, monkeypatch):
        self.scope_ids: tuple = ()
        self.hits: list = []
        self.resolve_calls = 0
        self.search_calls = 0
        self.audits: list = []

        async def _resolve(*, user_id, conditions, folder_ids, supabase, **kw):
            self.resolve_calls += 1
            return ScopeResult(document_ids=self.scope_ids, applied=tuple(conditions),
                               undated_excluded=None, date_field=None)

        async def _search(*a, **k):
            self.search_calls += 1
            return list(self.hits), 0.7

        async def _nearby(**kw):
            return []

        async def _defs(user_id, supabase=None):
            return list(DEFS)

        async def _meta(user_id, supabase):
            return set(WHITELIST), set()

        def _audit(**kw):
            self.audits.append(kw["metadata"])
            return object()

        monkeypatch.setattr(sdt, "resolve_document_scope", _resolve)
        monkeypatch.setattr(sdt, "search_documents", _search)
        monkeypatch.setattr(sdt, "nearby_values", _nearby)
        monkeypatch.setattr(sdt, "list_field_definitions", _defs)
        monkeypatch.setattr(sdt, "_build_field_meta", _meta)
        monkeypatch.setattr(sdt, "write_audit_entry", _audit)


def _ctx(lock="fresh"):
    ns = SimpleNamespace(
        current_user={"id": "user-1"}, supabase=object(), user_settings=None, folder_subtree_ids=None,
        run_id="run-1", thread_id="thread-1", parent_run_id=None, spawn=lambda c: None,
        has_connection_retrieval=False,
    )
    if lock == "fresh":
        ns.empty_filter_fields_in_run = set()
    elif lock is not None:
        ns.empty_filter_fields_in_run = lock
    return ns


async def _empty_match(edges, ctx):
    edges.scope_ids = ()
    out = await sdt.handle_search_documents({"query": "revenue", "filters": [OCT, ACME]}, ctx)
    assert json.loads(out.result)["status"] == "no_documents_matched"
    return out


async def test_a_zero_match_locks_its_fields(monkeypatch):
    edges, ctx = Edges(monkeypatch), _ctx()
    await _empty_match(edges, ctx)
    assert ctx.empty_filter_fields_in_run == {"date", "legal_entity"}


async def test_an_unfiltered_retry_is_refused_with_the_reason(monkeypatch):
    edges, ctx = Edges(monkeypatch), _ctx()
    await _empty_match(edges, ctx)
    edges.resolve_calls = edges.search_calls = 0
    edges.audits.clear()

    out = await sdt.handle_search_documents({"query": "revenue"}, ctx)
    body = json.loads(out.result)
    assert body["error"] == "refused_retry"
    assert set(body["locked_fields"]) == {"date", "legal_entity"}
    assert "matched no documents" in body["message"]
    assert edges.resolve_calls == 0 and edges.search_calls == 0
    assert out.citations == []
    assert [a["result_kind"] for a in edges.audits] == ["refused_retry"]


async def test_dropping_one_field_is_refused(monkeypatch):
    edges, ctx = Edges(monkeypatch), _ctx()
    await _empty_match(edges, ctx)
    edges.resolve_calls = edges.search_calls = 0
    out = await sdt.handle_search_documents({"query": "revenue", "filters": [OCT]}, ctx)
    assert json.loads(out.result)["error"] == "refused_retry"
    assert edges.resolve_calls == 0 and edges.search_calls == 0


async def test_a_different_value_on_the_same_fields_is_allowed(monkeypatch):
    edges, ctx = Edges(monkeypatch), _ctx()
    await _empty_match(edges, ctx)
    edges.scope_ids = ("d1",)
    edges.hits = [{"document_id": "d1", "filename": "d1.pdf", "content": "x", "similarity": 0.8}]
    out = await sdt.handle_search_documents({"query": "revenue", "filters": [SEP, ACME]}, ctx)
    assert isinstance(json.loads(out.result), list)
    assert edges.resolve_calls == 2 and edges.search_calls == 1


async def test_kind_1_and_kind_3_never_lock(monkeypatch):
    edges, ctx = Edges(monkeypatch), _ctx()
    edges.scope_ids = ("d1",)
    edges.hits = [{"document_id": "d1", "filename": "d1.pdf", "content": "x", "similarity": 0.8}]
    await sdt.handle_search_documents({"query": "q", "filters": [OCT]}, ctx)
    await sdt.handle_search_documents({"query": "q", "filters": [{"field": "nope", "op": "eq", "value": "x"}]}, ctx)
    assert ctx.empty_filter_fields_in_run == set()


async def test_kind_2_not_searchable_yet_locks_too(monkeypatch):
    edges, ctx = Edges(monkeypatch), _ctx()
    edges.scope_ids = ("d1",)
    edges.hits = []
    out = await sdt.handle_search_documents({"query": "q", "filters": [OCT]}, ctx)
    assert json.loads(out.result)["reason"] == "not_searchable_yet"
    assert ctx.empty_filter_fields_in_run == {"date"}


@pytest.mark.parametrize("lock", [None, "absent"])
async def test_an_unwired_caller_has_no_lock(monkeypatch, lock):
    edges = Edges(monkeypatch)
    ctx = _ctx(lock=None)
    if lock is None:
        ctx.empty_filter_fields_in_run = None
    await _empty_match(edges, ctx)
    edges.hits = []
    out = await sdt.handle_search_documents({"query": "revenue"}, ctx)
    assert out.result == "No relevant documents found."
    assert edges.search_calls == 1


async def test_the_same_set_carries_the_lock_across_contexts(monkeypatch):
    """Two loop iterations build two ToolContexts; a sub-agent builds a third. One set, by reference."""
    edges = Edges(monkeypatch)
    shared: set = set()
    iteration_1, iteration_2, sub_agent = _ctx(shared), _ctx(shared), _ctx(shared)
    await _empty_match(edges, iteration_1)
    for ctx in (iteration_2, sub_agent):
        out = await sdt.handle_search_documents({"query": "revenue"}, ctx)
        assert json.loads(out.result)["error"] == "refused_retry"
    assert edges.search_calls == 0
