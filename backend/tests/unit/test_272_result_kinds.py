"""Phase 272-04 Task 2 (D-10 / D-11 / D-12 / D-18 / D-19 / D-25) — the four result kinds, ONE audit writer.

Before 272 kinds 1-3 collapsed into ``"No relevant documents found."`` — the failure SC#2 names. Now
``search_documents`` returns exactly one of:

1. **passages** — ``result`` stays the JSON ARRAY of hits (the card's ``SearchDocumentsBody`` renders
   only ``Array.isArray``); the model-facing summary rides ``llm_content`` and names the filter, the
   matched count, the D-06 undated count, and low-similarity passages as such (D-10).
2. **no documents matched** — names the filter, cites nothing, offers nearby values from
   document-level counts (D-11). ⛔ No ``"error"`` key (``ToolCallDetails`` short-circuits on
   ``parsed.error``). Sub-reason ``not_searchable_yet`` when documents matched but nothing came back
   (D-25) — still kind 2, so the kinds stay four.
3. **invalid filter** — the valid values listed (D-04); nothing is resolved or searched.
4. **retrieval unavailable** — the pre-272 provider-error shape, unchanged.

⛔ D-18 (266 CR-01 — *a scope that stops narrowing widens to the whole KB*): an empty resolved set,
or an empty folder scope, short-circuits to kind 2 BEFORE any retrieval call. Zero calls.

⛔ D-19: the filter ANDs with the chat folder / Expert scope. The Expert-restricted channel is
``compose_expert_scope`` → ``RunContext.effective_folder_ids`` → agent_loop's override
``folder_subtree_ids = list(ctx.effective_folder_ids)`` → ``ToolContext.folder_subtree_ids``; the
case below builds the ctx exactly that way and pins the agent_loop line it mirrors.
"""
from __future__ import annotations

import inspect
import json
import pathlib
import re
from types import SimpleNamespace

import pytest

import app.services.search_documents_tool as sdt
from app.services.document_search_service import SearchTruncatedError
from app.services.document_view_resolver import ResolveError
from app.services.expert_scope import compose_expert_scope
from app.services.retrieval_scope import ScopeResult

USER = "user-1"
DEFS = [{"field_key": "legal_entity", "field_type": "enum", "options": ["Acme GmbH", "Beta Ltd"], "enabled": True}]
WHITELIST = {"title", "author", "date", "document_type", "topics", "language", "summary", "legal_entity"}

OCT = {"field": "date", "op": "between", "value": "2025-10-01", "value2": "2025-10-31"}
ACME = {"field": "legal_entity", "op": "eq", "value": "acme gmbh"}
OCT_CANON = dict(OCT)
ACME_CANON = {"field": "legal_entity", "op": "eq", "value": "Acme GmbH"}

PRE_272_KEYS = {"query_text", "document_ids", "run_id", "thread_id", "parent_run_id", "folder_ids"}


def _hit(doc, folder, sim=0.7, low=False):
    h = {
        "document_id": doc, "filename": f"{doc}.pdf", "content": f"text of {doc}", "chunk_index": 0,
        "similarity": sim, "folder_id": folder,
    }
    if low:
        h["low_similarity"] = True
    return h


class Rig:
    """Patches every edge the handler reaches, where it is USED (search_documents_tool)."""

    def __init__(self, monkeypatch, *, scope=None, hits=(), search_exc=None, resolve_exc=None,
                 nearby=None, folders=("f1",), lock=None):
        self.resolve_calls: list = []
        self.search_calls: list = []
        self.nearby_calls: list = []
        self.audits: list = []
        self.emits: list = []
        self._scope, self._hits = scope, list(hits)

        async def _resolve(*, user_id, conditions, folder_ids, supabase, **kw):
            self.resolve_calls.append({"user_id": user_id, "conditions": [dict(c) for c in conditions],
                                       "folder_ids": folder_ids})
            if resolve_exc is not None:
                raise resolve_exc
            s = self._scope
            return ScopeResult(document_ids=s.document_ids, applied=tuple(dict(c) for c in conditions),
                               undated_excluded=s.undated_excluded, date_field=s.date_field)

        async def _search(*args, **kwargs):
            self.search_calls.append((args, kwargs))
            if search_exc is not None:
                raise search_exc
            return list(self._hits), 0.7

        async def _nearby(*, user_id, conditions, field, folder_ids, supabase, limit=3):
            self.nearby_calls.append({"field": field, "folder_ids": folder_ids})
            return list(nearby or [])

        async def _defs(user_id, supabase=None):
            return list(DEFS)

        async def _meta(user_id, supabase):
            return set(WHITELIST), set()

        def _audit(**kwargs):
            self.audits.append(kwargs)
            return object()

        async def _emit(*a, **k):
            self.emits.append((a, k))

        monkeypatch.setattr(sdt, "resolve_document_scope", _resolve)
        monkeypatch.setattr(sdt, "search_documents", _search)
        monkeypatch.setattr(sdt, "nearby_values", _nearby)
        monkeypatch.setattr(sdt, "list_field_definitions", _defs)
        monkeypatch.setattr(sdt, "_build_field_meta", _meta)
        monkeypatch.setattr(sdt, "write_audit_entry", _audit)
        monkeypatch.setattr(
            "app.services.openai_service.resolve_effective_embedding_provider", lambda s: "openai"
        )
        self.ctx = SimpleNamespace(
            current_user={"id": USER}, supabase=object(), user_settings=None,
            folder_subtree_ids=None if folders is None else list(folders),
            run_id="run-1", thread_id="thread-1", parent_run_id=None,
            spawn=lambda coro: None, has_connection_retrieval=False,
            emit=_emit, redis=object(),
            empty_filter_fields_in_run=set() if lock is None else lock,
        )

    async def call(self, args):
        return await sdt.handle_search_documents(args, self.ctx)

    @property
    def audit(self) -> dict:
        assert len(self.audits) == 1, f"every arm writes exactly ONE audit row, got {len(self.audits)}"
        return self.audits[0]["metadata"]


def _scope(ids=(), undated=None, date_field=None):
    return ScopeResult(document_ids=tuple(ids), applied=(), undated_excluded=undated, date_field=date_field)


# ── unfiltered: the pre-272 path ─────────────────────────────────────────────────────────────────


async def test_an_unfiltered_call_is_the_pre_272_call(monkeypatch):
    rig = Rig(monkeypatch, scope=_scope(), hits=[])
    out = await rig.call({"query": "q"})
    assert rig.resolve_calls == []
    assert len(rig.search_calls) == 1
    args, kwargs = rig.search_calls[0]
    assert "document_ids" not in kwargs, "test_260's fixed-signature mocks would TypeError"
    assert kwargs["folder_ids"] == ["f1"] and kwargs["metadata_filter"] is None
    assert out.result == "No relevant documents found."
    meta = rig.audit
    assert PRE_272_KEYS <= set(meta) and "similarities" in meta
    assert meta["filters"] == [] and meta["result_kind"] == "passages"


# ── kind 1 ─────────────────────────────────────────────────────────────────────────────────────


async def test_kind_1_passages_restrict_both_scopes_and_name_the_filter(monkeypatch):
    rig = Rig(
        monkeypatch, scope=_scope(("d1", "d2"), undated=3, date_field="date"),
        hits=[_hit("d1", "f1", 0.81), _hit("d2", "f1", 0.12, low=True)],
    )
    out = await rig.call({"query": "revenue", "filters": [OCT, ACME]})

    assert rig.resolve_calls[0]["conditions"] == [OCT_CANON, ACME_CANON]
    assert rig.resolve_calls[0]["folder_ids"] == ["f1"]
    (_, kwargs), = rig.search_calls
    assert kwargs["document_ids"] == ("d1", "d2")
    assert kwargs["folder_ids"] == ["f1"], "D-19: the folder scope still rides the search"
    assert kwargs.get("metadata_filter") is None

    hits = json.loads(out.result)
    assert isinstance(hits, list) and [h["document_id"] for h in hits] == ["d1", "d2"]
    summary = json.loads(out.llm_content)
    assert "document date 1–31 Oct 2025" in summary["filter_applied"]
    assert "legal entity = Acme GmbH" in summary["filter_applied"]
    assert summary["matched_documents"] == 2 and summary["undated_excluded"] == 3
    low = [p for p in summary["passages"] if p.get("low_similarity")]
    assert [p["document_id"] for p in low] == ["d2"]
    assert summary.get("low_similarity_note"), "D-10: a one-line note says what the mark means"
    assert [c["document_id"] for c in out.citations] == ["d1", "d2"]

    meta = rig.audit
    assert meta["result_kind"] == "passages"
    assert meta["filters"] == [OCT_CANON, ACME_CANON]
    assert meta["matched_document_count"] == 2
    assert meta["undated_excluded"] == 3
    assert PRE_272_KEYS <= set(meta)


# ── kind 2 ─────────────────────────────────────────────────────────────────────────────────────


async def test_kind_2_an_empty_set_short_circuits_before_any_retrieval(monkeypatch):
    nearby = [{"value": "2025-09", "label": "September 2025", "documents": 4}]
    rig = Rig(monkeypatch, scope=_scope((), undated=12, date_field="date"), nearby=nearby)
    out = await rig.call({"query": "revenue", "filters": [OCT, ACME]})

    assert rig.search_calls == [], "D-18: zero retrieval calls on an empty resolved set"
    body = json.loads(out.result)
    assert "error" not in body
    assert body["status"] == "no_documents_matched" and body["reason"] == "zero_documents"
    assert "document date 1–31 Oct 2025" in body["filter"]
    assert body["undated_excluded"] == 12
    assert body["nearby"] == nearby
    assert rig.nearby_calls[0]["field"] == "date" and rig.nearby_calls[0]["folder_ids"] == ["f1"]
    assert "cite nothing" in body["instruction"].lower()
    assert "without" in body["instruction"].lower()
    assert out.citations == [] and out.source_refs == []
    meta = rig.audit
    assert meta["result_kind"] == "no_documents_matched"
    assert meta["matched_document_count"] == 0 and meta["document_ids"] == []


async def test_kind_2_matched_but_not_searchable_yet_is_a_sub_reason(monkeypatch):
    rig = Rig(monkeypatch, scope=_scope(("d1",), date_field="date"), hits=[])
    out = await rig.call({"query": "revenue", "filters": [OCT]})
    assert len(rig.search_calls) == 1
    body = json.loads(out.result)
    assert "error" not in body
    assert body["status"] == "no_documents_matched" and body["reason"] == "not_searchable_yet"
    assert "1 document" in body["message"]
    assert rig.audit["result_kind"] == "no_documents_matched"
    assert rig.audit["matched_document_count"] == 1


@pytest.mark.parametrize("filters", [None, [OCT]])
async def test_an_empty_folder_scope_never_reaches_retrieval(monkeypatch, filters):
    """Carry-forward from 272-03: both retrieval arms read ``folder_ids=[]`` as NO folder
    restriction (``folder_ids if folder_ids else None``). An empty folder scope is a restriction to
    nothing — kind 2 before any call (D-18; 266 CR-01 is this exact inversion)."""
    rig = Rig(monkeypatch, scope=_scope(("d1",)), hits=[_hit("d1", "f1")], folders=())
    args = {"query": "q"} if filters is None else {"query": "q", "filters": filters}
    out = await rig.call(args)
    assert rig.search_calls == [] and rig.resolve_calls == []
    body = json.loads(out.result)
    assert body["status"] == "no_documents_matched" and body["reason"] == "zero_documents"
    assert out.citations == []
    assert rig.audit["result_kind"] == "no_documents_matched"


# ── kind 3 ─────────────────────────────────────────────────────────────────────────────────────


async def test_kind_3_an_unknown_field_is_refused_with_the_valid_fields(monkeypatch):
    rig = Rig(monkeypatch, scope=_scope(("d1",)))
    out = await rig.call({"query": "q", "filters": [{"field": "legal_entityy", "op": "eq", "value": "Acme"}]})
    body = json.loads(out.result)
    assert body["error"] == "invalid_filter"
    assert body["field"] == "legal_entityy"
    assert "legal_entity" in body["allowed"]
    assert body["message"] and body["instruction"]
    assert rig.resolve_calls == [] and rig.search_calls == []
    assert rig.audit["result_kind"] == "invalid_filter"
    assert rig.audit["document_ids"] == []


async def test_kind_3_a_resolver_refusal_is_an_invalid_filter_too(monkeypatch):
    rig = Rig(monkeypatch, resolve_exc=ResolveError(detail="date filter: use YYYY-MM-DD"))
    out = await rig.call({"query": "q", "filters": [OCT]})
    body = json.loads(out.result)
    assert body["error"] == "invalid_filter" and "YYYY-MM-DD" in body["message"]
    assert rig.search_calls == []
    assert rig.audit["result_kind"] == "invalid_filter"


# ── kind 4 ─────────────────────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize("filters", [None, [OCT]])
async def test_kind_4_a_retrieval_failure_is_the_pre_272_result(monkeypatch, filters):
    rig = Rig(monkeypatch, scope=_scope(("d1",)), search_exc=RuntimeError("quota exhausted"))
    args = {"query": "q"} if filters is None else {"query": "q", "filters": filters}
    out = await rig.call(args)
    body = json.loads(out.result)
    assert body["error"] == "retrieval_unavailable" and body["provider"] == "openai"
    assert "NOT a result of zero matches" in body["detail"]
    assert out.retrieval_error["retrieval_status"] == "provider_error"
    meta = rig.audit
    assert meta["result_kind"] == "provider_error" and meta["retrieval_status"] == "provider_error"
    assert "similarities" not in meta
    assert "quota" not in json.dumps(meta)


async def test_kind_4_a_truncated_resolve_says_narrow_the_filter(monkeypatch):
    rig = Rig(monkeypatch, resolve_exc=SearchTruncatedError())
    out = await rig.call({"query": "q", "filters": [OCT]})
    body = json.loads(out.result)
    assert body["error"] == "retrieval_unavailable"
    assert "narrow the filter" in body["detail"]
    assert rig.search_calls == []
    meta = rig.audit
    assert meta["result_kind"] == "provider_error" and meta["retrieval_status"] == "provider_error"


# ── D-19: the Expert-restricted scope ANDs with the filter (266 CR-01) ─────────────────────────


async def test_d19_an_expert_restricted_scope_ands_with_the_filter(monkeypatch):
    expert = compose_expert_scope(
        scope_mode="restricted", thread_folder_id=None, expert_folder_ids=["fx"],
        visible_folders=[{"id": "fx", "parent_id": None, "name": "Contracts"}],
    )
    folder_subtree_ids = list(expert.effective_folder_ids)  # agent_loop's override, verbatim
    rig = Rig(
        monkeypatch, scope=_scope(("d1", "d9")), folders=folder_subtree_ids,
        hits=[_hit("d1", "fx"), _hit("d9", "fy")],  # d9 matches the filter but sits OUTSIDE fx
    )
    out = await rig.call({"query": "termination", "filters": [ACME]})

    assert rig.resolve_calls[0]["folder_ids"] == ["fx"]
    (_, kwargs), = rig.search_calls
    assert kwargs["folder_ids"] == ["fx"] and kwargs["document_ids"] == ("d1", "d9")
    assert [h["document_id"] for h in json.loads(out.result)] == ["d1"]
    assert [p["document_id"] for p in json.loads(out.llm_content)["passages"]] == ["d1"]
    assert [c["document_id"] for c in out.citations] == ["d1"]


def test_d19_the_channel_this_suite_mirrors_is_agent_loops_own():
    src = (pathlib.Path(sdt.__file__).parent / "agent_loop.py").read_text(encoding="utf-8")
    assert "folder_subtree_ids = list(ctx.effective_folder_ids)" in src


# ── ONE audit writer (D-12) ──────────────────────────────────────────────────────────────────────


def test_one_audit_writer_serves_every_arm():
    src = inspect.getsource(sdt)
    code = [ln for ln in src.splitlines() if not ln.lstrip().startswith("#")]
    sites = [i for i, ln in enumerate(code) if "write_audit_entry(" in ln]
    assert len(sites) == 1, f"exactly one write_audit_entry( call site, found {len(sites)}"
    writer = inspect.getsource(sdt._write_search_audit)
    assert "write_audit_entry(" in writer
    handler = inspect.getsource(sdt.handle_search_documents)
    assert "write_audit_entry(" not in handler
    assert len(re.findall(r"_write_search_audit\(", src)) >= 2
