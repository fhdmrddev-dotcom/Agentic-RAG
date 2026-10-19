"""Phase 294-01 (D-06 / D-07 / D-11 / D-19 / D-24) — the Jev and OpenAI Decisions adapters.

Driven through ``rerank_service.rerank`` with an ``httpx.MockTransport`` behind each adapter's
``_http_client`` factory. Every forced failure (401, 429, 500, connect / read timeout, non-JSON,
no answers, refusal, missing answer, probability 1.7) returns EXACTLY the rerank-off output
``documents[:n]``, logs the engine id and the exception type, and logs neither a key nor any
response body text. A 429 or a timeout is ONE request per batch: there is no retry loop.
"""
from __future__ import annotations

import json
import logging
from decimal import Decimal

import pytest

from tests.unit.decision_engine_fakes import (
    BODY_MARKER,
    JEV_USAGE,
    OPENAI_USAGE,
    PLANTED_KEYS,
    PLANTED_OAI,
    PLANTED_OR,
    FakeLangSmithClient,
    Recorder,
    docs,
    fault_handler,
    install,
    jev_handler,
    openai_handler,
    tracing_into,
    user_settings,
)

ENGINE_MODULES = {"jev": "app.services.rerank_engines.jev",
                  "openai_decisions": "app.services.rerank_engines.openai_decisions"}


def _module(engine):
    import importlib

    return importlib.import_module(ENGINE_MODULES[engine])


def _assert_clean(caplog):
    for key in PLANTED_KEYS:
        assert key not in caplog.text
    assert BODY_MARKER not in caplog.text


# ── forced failures == off ────────────────────────────────────────────────────────────────────

FAULTS = {
    "jev": ["401", "429", "500", "connect_timeout", "read_timeout", "non_json", "no_answers",
            "missing", "out_of_range"],
    "openai_decisions": ["401", "429", "500", "connect_timeout", "read_timeout", "non_json",
                         "no_answers", "refusal", "out_of_range"],
}
CASES = [(e, f) for e, fs in FAULTS.items() for f in fs]


@pytest.mark.parametrize("engine,fault", CASES, ids=[f"{e}-{f}" for e, f in CASES])
def test_every_forced_failure_returns_the_off_output(monkeypatch, caplog, engine, fault):
    from app.services.rerank_engines.tracing import capture_engine_calls
    from app.services.rerank_service import rerank

    rec = Recorder()
    install(monkeypatch, _module(engine), fault_handler(rec, fault, engine))
    pool = docs(12)
    with caplog.at_level(logging.DEBUG), capture_engine_calls() as calls:
        out = rerank("q", pool, 5, user_settings(rerank_provider=engine))
    assert out == pool[:5]
    assert f"rerank engine {engine} failed (" in caplog.text
    _assert_clean(caplog)
    assert len(rec.requests) == 1, "one request per batch: no retry"
    failed = [c for c in calls if not c.ok]
    assert len(failed) == 1 and failed[0].engine == engine and failed[0].reason


@pytest.mark.parametrize("engine,fault,type_name", [
    ("jev", "429", "HTTPStatusError"), ("openai_decisions", "401", "HTTPStatusError"),
    ("jev", "read_timeout", "ReadTimeout"), ("openai_decisions", "connect_timeout", "ConnectTimeout"),
])
def test_the_log_names_the_exception_type(monkeypatch, caplog, engine, fault, type_name):
    from app.services.rerank_service import rerank

    install(monkeypatch, _module(engine), fault_handler(Recorder(), fault, engine))
    with caplog.at_level(logging.WARNING):
        rerank("q", docs(6), 3, user_settings(rerank_provider=engine))
    assert f"rerank engine {engine} failed ({type_name}" in caplog.text


def test_a_429_on_one_jev_batch_is_one_request_per_batch(monkeypatch):
    from app.services.rerank_service import rerank

    rec = Recorder()
    install(monkeypatch, _module("jev"), fault_handler(rec, "429", "jev"))
    pool = docs(31)
    assert rerank("q", pool, 5, user_settings(rerank_provider="jev")) == pool[:5]
    assert len(rec.requests) == 2, "two batches, one request each — never a retry"


def test_jev_overall_timeout_falls_back(monkeypatch, caplog):
    import app.services.rerank_engines.registry as registry
    from app.services.rerank_service import rerank

    monkeypatch.setattr(registry, "JEV_OVERALL_TIMEOUT_S", 0.2)
    install(monkeypatch, _module("jev"), jev_handler(Recorder(), delay=1.0))
    pool = docs(6)
    with caplog.at_level(logging.WARNING):
        out = rerank("q", pool, 3, user_settings(rerank_provider="jev"))
    assert out == pool[:3]
    assert "rerank engine jev failed (" in caplog.text


# ── Jev request shape, batching and concurrency ──────────────────────────────────────────────

def test_jev_request_shape(monkeypatch):
    from app.services.rerank_engines.registry import JEV_DECISIONS_URL
    from app.services.rerank_service import rerank

    rec = Recorder()
    install(monkeypatch, _module("jev"), jev_handler(rec))
    pool = docs(4)
    rerank("what changed", pool, 4, user_settings(rerank_provider="jev"), instruction="prefer 2025")
    (req,), (body,) = rec.requests, rec.bodies
    assert str(req.url) == JEV_DECISIONS_URL
    assert req.headers["authorization"] == f"Bearer {PLANTED_OR}"
    assert body["model"] == "typesafe/jev-1.14", "rerank-v3.5 belongs to Cohere → Jev's default"
    assert body["state"]["query"] == "what changed"
    assert body["state"]["searcher_preference"] == "prefer 2025"
    assert body["state"]["passages"] == {f"P{i:02d}": pool[i]["content"] for i in range(4)}
    assert set(body["questions"]) == {"P00", "P01", "P02", "P03"}
    for q in body["questions"].values():
        assert q["type"] == "noul"
        assert set(q["criteria"]) == {"true", "false"}
        assert isinstance(q["instructions"], str) and q["instructions"]


def test_jev_without_instruction_sends_an_empty_preference(monkeypatch):
    from app.services.rerank_service import rerank

    rec = Recorder()
    install(monkeypatch, _module("jev"), jev_handler(rec))
    rerank("q", docs(2), 2, user_settings(rerank_provider="jev"))
    assert rec.bodies[0]["state"]["searcher_preference"] == ""


def test_jev_31_passages_is_two_calls(monkeypatch):
    from app.services.rerank_engines.registry import JEV_MAX_PASSAGES_PER_CALL
    from app.services.rerank_service import rerank

    rec = Recorder()
    install(monkeypatch, _module("jev"), jev_handler(rec))
    rerank("q", docs(31), 5, user_settings(rerank_provider="jev"))
    sizes = sorted(len(b["questions"]) for b in rec.bodies)
    assert sizes == [1, JEV_MAX_PASSAGES_PER_CALL]
    names = sorted(n for b in rec.bodies for n in b["questions"])
    assert names == sorted(f"P{i:02d}" for i in range(31)), "every passage scored exactly once"


def test_jev_splits_by_state_bytes(monkeypatch):
    from app.services.rerank_engines.registry import JEV_MAX_STATE_BYTES
    from app.services.rerank_service import rerank

    rec = Recorder()
    install(monkeypatch, _module("jev"), jev_handler(rec))
    rerank("q", docs(10, size=6000), 5, user_settings(rerank_provider="jev"))
    assert len(rec.bodies) >= 3
    for body in rec.bodies:
        assert len(json.dumps(body["state"]).encode("utf-8")) <= JEV_MAX_STATE_BYTES


def test_jev_keeps_at_most_four_calls_in_flight(monkeypatch):
    from app.services.rerank_engines.registry import JEV_MAX_IN_FLIGHT
    from app.services.rerank_service import rerank

    rec = Recorder()
    install(monkeypatch, _module("jev"), jev_handler(rec, delay=0.05))
    rerank("q", docs(180, size=10), 5, user_settings(rerank_provider="jev"))
    assert len(rec.bodies) == 6
    assert 1 < rec.max_in_flight <= JEV_MAX_IN_FLIGHT


def test_jev_scores_then_prunes(monkeypatch):
    from app.services.rerank_service import rerank

    install(monkeypatch, _module("jev"), jev_handler(Recorder(), prob=lambda i: [0.2, 0.95, 0.05, 0.6, 0.01][i]))
    pool = docs(5)
    out = rerank("q", pool, 5, user_settings(rerank_provider="jev"))
    assert [r["id"] for r in out] == ["c1", "c3", "c0"], "below 0.1 dropped, probability order"
    assert [r["relevance_score"] for r in out] == [0.95, 0.6, 0.2]


def test_jev_keep_documents_reaches_the_prune(monkeypatch):
    from app.services.rerank_service import rerank

    install(monkeypatch, _module("jev"), jev_handler(Recorder(), prob=lambda i: [0.9, 0.8, 0.7, 0.02][i]))
    pool = docs(4, doc_of=lambda i: "dB" if i == 3 else "dA")
    out = rerank("q", pool, 4, user_settings(rerank_provider="jev"), keep_documents=True)
    assert {r["document_id"] for r in out} == {"dA", "dB"}


# ── OpenAI request shape ──────────────────────────────────────────────────────────────────────

def test_openai_request_shape(monkeypatch):
    from app.services.rerank_engines.registry import OPENAI_DECISIONS_URL
    from app.services.rerank_service import rerank

    rec = Recorder()
    install(monkeypatch, _module("openai_decisions"), openai_handler(rec))
    pool = docs(12)
    rerank("q", pool, 5, user_settings(rerank_provider="openai_decisions"), instruction="signed only")
    (req,), (body,) = rec.requests, rec.bodies
    assert str(req.url) == OPENAI_DECISIONS_URL
    assert req.headers["authorization"] == f"Bearer {PLANTED_OAI}"
    assert body["model"] == "gpt-6-luna"
    data = json.loads(body["input"])
    assert data == {"query": "q", "searcher_preference": "signed only",
                    "passages": {f"P{i:02d}": pool[i]["content"] for i in range(12)}}
    assert [q["name"] for q in body["questions"]] == [f"P{i:02d}" for i in range(12)]
    assert all(q["type"] == "predicate" and q["instructions"] for q in body["questions"])


def test_openai_scores_then_prunes(monkeypatch):
    from app.services.rerank_service import rerank

    install(monkeypatch, _module("openai_decisions"), openai_handler(Recorder()))
    pool = docs(10)
    out = rerank("q", pool, 3, user_settings(rerank_provider="openai_decisions"))
    assert [r["id"] for r in out] == ["c0", "c2", "c4"], "0.9s kept in pre-rerank order, top_n 3"


# ── accounting: EngineCall + LangSmith span outputs (D-19) ───────────────────────────────────

def test_jev_records_vendor_cost_per_call(monkeypatch):
    from app.services.rerank_engines.tracing import capture_engine_calls
    from app.services.rerank_service import rerank

    install(monkeypatch, _module("jev"), jev_handler(Recorder()))
    with capture_engine_calls() as calls:
        rerank("q", docs(31), 5, user_settings(rerank_provider="jev"))
    assert len(calls) == 2
    for c in calls:
        assert c.engine == "jev" and c.ok is True and c.purpose == "rerank"
        assert c.cost_usd == Decimal(str(JEV_USAGE["cost"]))
        assert c.input_tokens == JEV_USAGE["input_tokens"] and c.output_tokens == 0
        assert c.latency_ms > 0


def test_openai_cost_comes_from_the_pricing_helper(monkeypatch):
    from app.services.rerank_engines.tracing import capture_engine_calls
    from app.services.rerank_service import rerank

    install(monkeypatch, _module("openai_decisions"), openai_handler(Recorder()))
    with capture_engine_calls() as calls:
        rerank("q", docs(4), 3, user_settings(rerank_provider="openai_decisions"))
    (c,) = calls
    assert c.engine == "openai_decisions" and c.ok is True
    assert c.cost_usd == Decimal("0.0001234"), "1234 tokens × $0.10/M, unquantised"
    assert c.latency_ms > 0


@pytest.mark.parametrize("engine,span", [("jev", "decision.jev"), ("openai_decisions", "decision.openai")])
def test_llm_span_outputs_carry_usage_cost_and_latency(monkeypatch, engine, span):
    from app.services.rerank_service import rerank

    handler = jev_handler(Recorder()) if engine == "jev" else openai_handler(Recorder())
    install(monkeypatch, _module(engine), handler)
    client = FakeLangSmithClient()
    with tracing_into(client):
        rerank("q", docs(4), 3, user_settings(rerank_provider=engine))
    assert span in client.names()
    outs = client.outputs_of(span)
    assert outs, client.calls
    out = outs[0]
    usage = OPENAI_USAGE if engine == "openai_decisions" else JEV_USAGE
    assert out["usage_metadata"]["input_tokens"] == usage["input_tokens"]
    assert out["usage_metadata"]["total_tokens"] == usage["input_tokens"] + usage["output_tokens"]
    assert out["usage_metadata"]["total_cost"] > 0
    assert out["cost_usd"] is not None and out["latency_ms"] > 0


def test_post_decisions_is_exported_by_both_adapters():
    for engine in ENGINE_MODULES:
        mod = _module(engine)
        assert callable(mod.post_decisions) and callable(mod.rerank)
