"""Phase 294-01 (SC#6 / T-294-01 / RESEARCH Pitfall 1) — no provider key reaches LangSmith or a log.

A fake LangSmith client records every payload the SDK would send. A rerank through Jev and
through OpenAI Decisions, with planted keys in ``user_settings`` (OpenRouter, OpenAI, Cohere,
``llm_api_key``, ``embedding_api_key``), produces no captured payload containing any planted key,
for the runs named ``rerank-documents``, ``decision.jev`` and ``decision.openai``.

Non-vacuity: the same probe against a traced function WITHOUT ``process_inputs`` does see the key
(the defect research measured), so a green here is the redaction working, not the client deaf.
"""
from __future__ import annotations

import logging

import pytest
from langsmith import traceable

from tests.unit.decision_engine_fakes import (
    PLANTED_KEYS,
    PLANTED_OR,
    FakeLangSmithClient,
    Recorder,
    docs,
    install,
    jev_handler,
    openai_handler,
    tracing_into,
    user_settings,
)


def _module(engine):
    import importlib

    return importlib.import_module(
        {"jev": "app.services.rerank_engines.jev",
         "openai_decisions": "app.services.rerank_engines.openai_decisions"}[engine])


def test_the_probe_can_see_a_key_when_nothing_redacts():
    @traceable(name="unredacted-probe", run_type="retriever")
    def _probe(query, user_settings=None):
        return []

    client = FakeLangSmithClient()
    with tracing_into(client):
        _probe("q", user_settings=user_settings())
    assert PLANTED_OR in client.text(), "the fake client must capture inputs, or this file proves nothing"


@pytest.mark.parametrize("engine,span", [("jev", "decision.jev"), ("openai_decisions", "decision.openai")])
def test_no_planted_key_in_any_traced_payload_or_log(monkeypatch, caplog, engine, span):
    from app.services.rerank_service import rerank

    rec = Recorder()
    handler = jev_handler(rec) if engine == "jev" else openai_handler(rec)
    install(monkeypatch, _module(engine), handler)
    client = FakeLangSmithClient()
    with caplog.at_level(logging.DEBUG), tracing_into(client):
        out = rerank("q", docs(6), 3, user_settings(rerank_provider=engine))
    assert out and rec.requests, "the engine really ran"
    assert {"rerank-documents", span} <= client.names()
    text = client.text()
    for key in PLANTED_KEYS:
        assert key not in text, f"{key} reached LangSmith"
        assert key not in caplog.text, f"{key} reached a log record"
    assert "<redacted>" in text


@pytest.mark.parametrize("engine", ["jev", "openai_decisions"])
def test_a_failing_engine_leaks_no_key_either(monkeypatch, caplog, engine):
    from tests.unit.decision_engine_fakes import fault_handler

    from app.services.rerank_service import rerank

    install(monkeypatch, _module(engine), fault_handler(Recorder(), "401", engine))
    client = FakeLangSmithClient()
    with caplog.at_level(logging.DEBUG), tracing_into(client):
        rerank("q", docs(6), 3, user_settings(rerank_provider=engine))
    for key in PLANTED_KEYS:
        assert key not in client.text()
        assert key not in caplog.text
