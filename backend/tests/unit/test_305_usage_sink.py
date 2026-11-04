"""Phase 305-03 (GUARD-02; D-29 / D-55; T-305-14) — the usage sink and the ``embed_texts`` hook.

``services/usage_sink`` is a LEAF ContextVar collector. ``collecting()`` opens a list for the
current context; ``record()`` appends ``{model, provider, prompt_tokens}`` to it, and outside a
``collecting()`` block it is a no-op. It never raises: a usage miss must never fail a call.

A4 (305-RESEARCH): the query embedding runs in ``run_in_threadpool`` (``retrieval_rpc``), which
COPIES the context — so a value recorded inside the threadpool must be visible after it. The list
object is shared by the copy; this test is the proof that the assumption holds.

``openai_service.embed_texts`` records ``response.usage.prompt_tokens`` and ``response.model``
after each ``embeddings.create`` — one guarded call, nothing else changed.
"""
from __future__ import annotations

import re
from pathlib import Path
from types import SimpleNamespace

import pytest
from starlette.concurrency import run_in_threadpool

from app.services import usage_sink

_SRC = (Path(__file__).resolve().parents[2] / "app" / "services" / "usage_sink.py")


def test_record_outside_collecting_is_a_no_op():
    usage_sink.record("m", 3, provider="p")  # never raises, records nowhere


def test_entries_append_in_order_inside_collecting():
    with usage_sink.collecting() as entries:
        usage_sink.record("a", 1, provider="openai")
        usage_sink.record("b", None)
    assert entries == [
        {"model": "a", "provider": "openai", "prompt_tokens": 1},
        {"model": "b", "provider": None, "prompt_tokens": None},
    ]


def test_collecting_resets_on_exit_and_on_an_exception():
    with usage_sink.collecting() as first:
        pass
    usage_sink.record("after", 1)
    assert first == []
    with pytest.raises(RuntimeError):
        with usage_sink.collecting() as second:
            raise RuntimeError("boom")
    usage_sink.record("after", 1)
    assert second == []


def test_nested_collecting_restores_the_outer_list():
    with usage_sink.collecting() as outer:
        with usage_sink.collecting() as inner:
            usage_sink.record("in", 1)
        usage_sink.record("out", 2)
    assert [e["model"] for e in inner] == ["in"]
    assert [e["model"] for e in outer] == ["out"]


def test_non_integer_tokens_and_non_string_models_are_recorded_as_none():
    with usage_sink.collecting() as entries:
        usage_sink.record(object(), "7")  # type: ignore[arg-type]
        usage_sink.record("m", True)      # a bool is not a token count
    assert entries == [
        {"model": None, "provider": None, "prompt_tokens": None},
        {"model": "m", "provider": None, "prompt_tokens": None},
    ]


async def test_a_value_recorded_inside_run_in_threadpool_is_visible_after_it():
    """A4: anyio copies the context into the worker thread; the copied var points at the SAME
    list, so the record lands in the caller's collection."""
    with usage_sink.collecting() as entries:
        await run_in_threadpool(usage_sink.record, "text-embedding-3-small", 11, provider="openai")
    assert entries == [{"model": "text-embedding-3-small", "provider": "openai", "prompt_tokens": 11}]


def test_the_sink_is_a_leaf():
    code = _SRC.read_text(encoding="utf-8")
    assert not re.search(r"^\s*(from|import)\s+app\b", code, re.MULTILINE)


# ── the embed_texts hook ─────────────────────────────────────────────────────────────────────


class _Embeddings:
    def __init__(self, response):
        self.response = response
        self.calls = 0

    def create(self, *, model, input):
        self.calls += 1
        return self.response(model, input)


def _client(response):
    return SimpleNamespace(embeddings=_Embeddings(response))


def _resp(usage):
    def build(model, batch):
        return SimpleNamespace(
            data=[SimpleNamespace(embedding=[0.0, 1.0]) for _ in batch],
            model="text-embedding-3-small",
            usage=usage,
        )
    return build


def test_embed_texts_records_measured_tokens(monkeypatch):
    from app.services import openai_service

    monkeypatch.setattr(openai_service, "get_embedding_client",
                        lambda s=None: _client(_resp(SimpleNamespace(prompt_tokens=7))))
    with usage_sink.collecting() as entries:
        out = openai_service.embed_texts(["hello"])
    assert out == [[0.0, 1.0]]
    assert entries == [{"model": "text-embedding-3-small", "provider": None, "prompt_tokens": 7}]


def test_embed_texts_without_usage_records_none(monkeypatch):
    from app.services import openai_service

    monkeypatch.setattr(openai_service, "get_embedding_client", lambda s=None: _client(_resp(None)))
    with usage_sink.collecting() as entries:
        openai_service.embed_texts(["hello"])
    assert entries == [{"model": "text-embedding-3-small", "provider": None, "prompt_tokens": None}]


def test_a_raising_record_never_fails_the_embedding(monkeypatch):
    from app.services import openai_service

    def _boom(*a, **k):
        raise RuntimeError("sink broke")

    monkeypatch.setattr(usage_sink, "_append", _boom)
    monkeypatch.setattr(openai_service, "get_embedding_client",
                        lambda s=None: _client(_resp(SimpleNamespace(prompt_tokens=7))))
    with usage_sink.collecting():
        assert openai_service.embed_texts(["hello"]) == [[0.0, 1.0]]


def test_embed_texts_carries_exactly_one_record_call():
    src = (Path(__file__).resolve().parents[2] / "app" / "services" / "openai_service.py").read_text(
        encoding="utf-8"
    )
    assert src.count("usage_sink.record(") == 1


# ── dispatch: the expensive tool's usage becomes mcp_usage rows (305-03 D-55) ─────────────────


@pytest.fixture
def usage_world(monkeypatch):
    from dataclasses import replace

    import app.mcp.tools as tools
    from tests.unit import _mcp305_harness as h

    h.stub_accounting(monkeypatch)
    written = h.stub_usage(monkeypatch)
    state = {"tokens": [7]}

    async def search(principal, args):
        for t in state["tokens"]:
            usage_sink.record("text-embedding-3-small", t, provider="openai")
        return h.text_result("found")

    async def boom(principal, args):
        usage_sink.record("text-embedding-3-small", 3, provider="openai")
        raise RuntimeError("search broke")

    async def cheap(principal, args):
        usage_sink.record("text-embedding-3-small", 1, provider="openai")
        return h.text_result("listed")

    for name, handler, bucket in (("t_s", search, "expensive"), ("t_boom", boom, "expensive"),
                                  ("t_cheap", cheap, "cheap")):
        monkeypatch.setitem(tools.REGISTERED, name, replace(h.make_spec(name, handler), bucket=bucket))
    principal = replace(h.PRINCIPAL, tools=("t_s", "t_boom", "t_cheap"))
    return {"written": written, "state": state, "principal": principal}


async def test_an_expensive_call_writes_one_row_per_measured_entry(usage_world):
    from app.mcp.dispatch import dispatch

    usage_world["state"]["tokens"] = [7, 4]
    await dispatch(usage_world["principal"], "t_s", {})
    rows = usage_world["written"]
    assert [(r["input_tokens"], r["status"], r["tool"]) for r in rows] == [
        (7, "completed", "t_s"), (4, "completed", "t_s")]
    p = usage_world["principal"]
    assert all((r["org_id"], r["user_id"], r["api_key_id"]) == (p.org_id, p.user_id, p.key_id) for r in rows)


async def test_a_search_that_measured_nothing_writes_one_null_token_row(usage_world):
    from app.mcp.dispatch import dispatch

    usage_world["state"]["tokens"] = []
    await dispatch(usage_world["principal"], "t_s", {})
    (row,) = usage_world["written"]
    assert row["input_tokens"] is None
    assert row["model"] == "text-embedding-3-small" and row["provider"]


async def test_a_raising_search_writes_its_usage_as_failed(usage_world):
    from app.mcp.dispatch import dispatch

    with pytest.raises(RuntimeError):
        await dispatch(usage_world["principal"], "t_boom", {})
    (row,) = usage_world["written"]
    assert (row["status"], row["input_tokens"]) == ("failed", 3)


async def test_a_cheap_call_writes_no_usage(usage_world):
    from app.mcp.dispatch import dispatch

    await dispatch(usage_world["principal"], "t_cheap", {})
    assert usage_world["written"] == []


async def test_a_usage_write_failure_never_fails_the_call(usage_world, monkeypatch):
    import app.mcp.dispatch as dispatch_mod

    async def _down(pool, **row):
        raise ConnectionError("db down")

    monkeypatch.setattr(dispatch_mod, "insert_usage", _down)
    out = await dispatch_mod.dispatch(usage_world["principal"], "t_s", {})
    assert out.is_error is not True
