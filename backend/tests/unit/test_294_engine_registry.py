"""Phase 294-01 (DEC-01 / D-02 / D-03 / D-08 / D-11) — the engine table and the thin dispatcher.

* registry: four engines, only the two decision engines are probabilistic / steerable / can check
  citations; the Jev endpoint is a constant, never derived from the stored OpenRouter base_url.
* get_engine / resolve_model / resolve_credentials / citation_check_availability.
* rerank_service.rerank: dispatch on ``rerank_provider``; ANY failure returns ``documents[:n]``
  (the rerank-off output, Pitfall 3) and logs the engine id plus the exception TYPE only.
"""
from __future__ import annotations

import logging
from types import SimpleNamespace

import pytest

PLANTED_OR = "sk-or-PLANTED-294"
PLANTED_OAI = "sk-PLANTED-294"
PLANTED_COHERE = "co-PLANTED-294"


def _provider(pid: str, key: str):
    return SimpleNamespace(id=pid, name=pid, base_url=f"https://{pid}.example/api/v1", api_key=key,
                           models=[], is_active=False)


def _us(**kw):
    base = dict(
        rerank_enabled=True, rerank_provider="cohere", rerank_api_key=PLANTED_COHERE,
        rerank_model="rerank-v3.5", rerank_top_n=3,
        providers=[_provider("openrouter", PLANTED_OR), _provider("openai", PLANTED_OAI)],
    )
    base.update(kw)
    return SimpleNamespace(**base)


def _docs(n: int = 6) -> list[dict]:
    return [{"id": f"c{i}", "document_id": f"d{i % 3}", "content": f"passage {i}", "chunk_index": i}
            for i in range(n)]


# ── registry ──────────────────────────────────────────────────────────────────────────────────

def test_the_table_has_exactly_the_four_engines():
    from app.services.rerank_engines.registry import ENGINES

    assert set(ENGINES) == {"cohere", "local", "jev", "openai_decisions"}
    for eid, spec in ENGINES.items():
        assert spec.id == eid


def test_only_the_decision_engines_are_probabilistic_steerable_and_check_citations():
    from app.services.rerank_engines.registry import ENGINES

    for eid, spec in ENGINES.items():
        expected = eid in ("jev", "openai_decisions")
        assert spec.probabilistic is expected, eid
        assert spec.steering is expected, eid
        assert spec.citation_check is expected, eid


def test_accepted_ids_keep_the_legacy_api_alias():
    from app.services.rerank_engines.registry import ACCEPTED_PROVIDER_IDS, LEGACY_ALIASES

    assert "api" in ACCEPTED_PROVIDER_IDS
    assert LEGACY_ALIASES == {"api": "cohere"}
    assert set(ACCEPTED_PROVIDER_IDS) == {"api", "cohere", "local", "jev", "openai_decisions"}


def test_the_jev_endpoint_is_not_built_from_the_openrouter_base_url():
    from app.services.rerank_engines.registry import JEV_DECISIONS_URL

    assert JEV_DECISIONS_URL == "https://openrouter.ai/api/alpha/decisions"
    assert not JEV_DECISIONS_URL.startswith("https://openrouter.ai/api/v1")


def test_engine_id_literal_is_regex_readable():
    import pathlib
    import re

    import app.services.rerank_engines.registry as registry

    src = pathlib.Path(registry.__file__).read_text(encoding="utf-8")
    lines = [ln for ln in src.splitlines() if re.match(r"^EngineId = Literal\[", ln)]
    assert len(lines) == 1
    assert re.findall(r'"([a-z_]+)"', lines[0]) == ["cohere", "local", "jev", "openai_decisions"]


def test_prices_are_vendor_facts():
    from decimal import Decimal

    from app.services.rerank_engines.registry import ENGINES

    assert ENGINES["jev"].input_usd_per_million == Decimal("0.042")
    assert ENGINES["openai_decisions"].input_usd_per_million == Decimal("0.10")
    assert ENGINES["cohere"].input_usd_per_million is None
    assert ENGINES["local"].input_usd_per_million is None


# ── get_engine / resolve_model ────────────────────────────────────────────────────────────────

def test_get_engine_normalises_api_and_refuses_unknowns():
    from app.services.rerank_engines import get_engine
    from app.services.rerank_engines.registry import ENGINES

    assert get_engine("api") is ENGINES["cohere"]
    assert get_engine("jev") is ENGINES["jev"]
    assert get_engine("nope") is None
    assert get_engine(None) is None
    assert get_engine("") is None


def test_resolve_model_keeps_a_matching_name_and_defaults_a_foreign_one():
    from app.services.rerank_engines import resolve_model
    from app.services.rerank_engines.registry import ENGINES

    assert resolve_model(ENGINES["jev"], "rerank-v3.5") == "typesafe/jev-1.14"
    assert resolve_model(ENGINES["jev"], "~typesafe/jev-latest") == "~typesafe/jev-latest"
    assert resolve_model(ENGINES["local"], "cross-encoder/ms-marco-MiniLM-L-6-v2") == \
        "cross-encoder/ms-marco-MiniLM-L-6-v2"
    assert resolve_model(ENGINES["local"], "rerank-v3.5") == "BAAI/bge-reranker-v2-m3"
    assert resolve_model(ENGINES["cohere"], "rerank-v3.5") == "rerank-v3.5"
    assert resolve_model(ENGINES["openai_decisions"], None) == "gpt-6-luna"
    assert resolve_model(ENGINES["openai_decisions"], "gpt-6-luna") == "gpt-6-luna"


# ── resolve_credentials ───────────────────────────────────────────────────────────────────────

def test_credentials_come_from_the_provider_entry_by_id_never_base_url():
    from app.services.rerank_engines import resolve_credentials
    from app.services.rerank_engines.registry import ENGINES

    us = _us()
    assert resolve_credentials(ENGINES["jev"], us) == PLANTED_OR
    assert resolve_credentials(ENGINES["openai_decisions"], us) == PLANTED_OAI
    assert resolve_credentials(ENGINES["cohere"], us) == PLANTED_COHERE
    assert resolve_credentials(ENGINES["local"], us) is None


def test_credentials_fall_back_to_settings_without_user_settings(monkeypatch):
    from app.config import settings
    from app.services.rerank_engines import resolve_credentials
    from app.services.rerank_engines.registry import ENGINES

    monkeypatch.setattr(settings, "openrouter_api_key", "env-or")
    monkeypatch.setattr(settings, "openai_api_key", "env-oai")
    monkeypatch.setattr(settings, "rerank_api_key", "env-co")
    assert resolve_credentials(ENGINES["jev"], None) == "env-or"
    assert resolve_credentials(ENGINES["openai_decisions"], None) == "env-oai"
    assert resolve_credentials(ENGINES["cohere"], None) == "env-co"


def test_an_empty_key_resolves_to_none(monkeypatch):
    from app.services.rerank_engines import resolve_credentials
    from app.services.rerank_engines.registry import ENGINES

    us = _us(providers=[_provider("openrouter", ""), _provider("openai", "   ")], rerank_api_key="")
    assert resolve_credentials(ENGINES["jev"], us) is None
    assert resolve_credentials(ENGINES["openai_decisions"], us) is None
    assert resolve_credentials(ENGINES["cohere"], us) is None
    assert resolve_credentials(ENGINES["jev"], _us(providers=[])) is None


# ── citation_check_availability ───────────────────────────────────────────────────────────────

@pytest.mark.parametrize("us,expected", [
    (_us(rerank_enabled=False, rerank_provider="jev"), (False, None, "off")),
    (_us(rerank_provider="cohere"), (False, None, "engine_reorders_only")),
    (_us(rerank_provider="api"), (False, None, "engine_reorders_only")),
    (_us(rerank_provider="local"), (False, None, "engine_reorders_only")),
    (_us(rerank_provider="jev", providers=[_provider("openai", PLANTED_OAI)]), (False, "jev", "key_missing")),
    (_us(rerank_provider="openai_decisions"), (True, "openai_decisions", None)),
    (_us(rerank_provider="jev"), (True, "jev", None)),
    (_us(rerank_provider="mystery"), (False, None, "off")),
])
def test_citation_check_availability(us, expected):
    from app.services.rerank_engines import citation_check_availability

    got = citation_check_availability(us)
    assert (got.available, got.engine, got.reason) == expected


# ── the dispatcher ────────────────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("provider", ["cohere", "api"])
def test_cohere_and_api_dispatch_to_the_cohere_adapter(monkeypatch, provider):
    import app.services.rerank_engines.cohere as cohere
    from app.services.rerank_service import rerank

    seen = {}

    def _fake(query, documents, top_n, *, api_key, model, instruction=None, keep_documents=False):
        seen.update(top_n=top_n, api_key=api_key, model=model)
        return [dict(d, relevance_score=0.5) for d in documents[:top_n]]

    monkeypatch.setattr(cohere, "rerank", _fake)
    out = rerank("q", _docs(), 2, _us(rerank_provider=provider))
    assert len(out) == 2
    assert seen == {"top_n": 2, "api_key": PLANTED_COHERE, "model": "rerank-v3.5"}


def test_local_dispatches_to_the_local_adapter(monkeypatch):
    import app.services.rerank_engines.local as local
    from app.services.rerank_service import rerank

    seen = {}

    def _fake(query, documents, top_n, *, api_key=None, model, instruction=None, keep_documents=False):
        seen.update(model=model)
        return list(reversed(documents))[:top_n]

    monkeypatch.setattr(local, "rerank", _fake)
    out = rerank("q", _docs(), 3, _us(rerank_provider="local", rerank_model="cross-encoder/x"))
    assert [d["id"] for d in out] == ["c5", "c4", "c3"]
    assert seen == {"model": "cross-encoder/x"}


def test_an_unknown_provider_returns_the_off_output_and_names_it(caplog):
    from app.services.rerank_service import rerank

    docs = _docs()
    with caplog.at_level(logging.WARNING):
        out = rerank("q", docs, 2, _us(rerank_provider="mystery-engine"))
    assert out == docs[:2]
    assert "mystery-engine" in caplog.text


def test_any_engine_exception_returns_documents_n_and_logs_type_only(monkeypatch, caplog):
    import app.services.rerank_engines.cohere as cohere
    from app.services.rerank_engines.tracing import capture_engine_calls
    from app.services.rerank_service import rerank

    def _explode(*a, **k):
        raise ValueError(f"secret body {PLANTED_COHERE}")

    monkeypatch.setattr(cohere, "rerank", _explode)
    docs = _docs()
    with caplog.at_level(logging.DEBUG), capture_engine_calls() as calls:
        out = rerank("q", docs, None, _us(rerank_top_n=4))
    assert out == docs[:4], "n falls back to rerank_top_n when top_n is None"
    assert "rerank engine cohere failed (ValueError)" in caplog.text
    assert PLANTED_COHERE not in caplog.text
    assert "secret body" not in caplog.text
    assert len(calls) == 1 and calls[0].ok is False and calls[0].engine == "cohere"
    assert calls[0].reason == "ValueError"


def test_the_fallback_is_never_more_than_n():
    """Pitfall 3: the base code returned the WHOLE pool on failure."""
    from app.services.rerank_service import rerank

    docs = _docs(8)
    out = rerank("q", docs, 5, _us(rerank_provider="cohere", rerank_api_key=""))
    assert out == docs[:5]


@pytest.mark.parametrize("provider,providers", [
    ("jev", [_provider("openai", PLANTED_OAI)]),
    ("openai_decisions", [_provider("openrouter", PLANTED_OR)]),
])
def test_a_missing_key_falls_back_inside_the_try(provider, providers, caplog):
    from app.services.rerank_service import rerank

    docs = _docs()
    with caplog.at_level(logging.WARNING):
        out = rerank("q", docs, 3, _us(rerank_provider=provider, providers=providers))
    assert out == docs[:3]
    assert f"rerank engine {provider} failed" in caplog.text


def test_local_warming_is_info_not_the_failure_warning(monkeypatch, caplog):
    import app.services.rerank_engines.local as local
    from app.services.rerank_engines.tracing import capture_engine_calls
    from app.services.rerank_service import rerank

    def _warming(*a, **k):
        raise local.LocalModelWarming("BAAI/bge-reranker-v2-m3")

    monkeypatch.setattr(local, "rerank", _warming)
    docs = _docs()
    with caplog.at_level(logging.INFO), capture_engine_calls() as calls:
        out = rerank("q", docs, 2, _us(rerank_provider="local", rerank_model="BAAI/bge-reranker-v2-m3"))
    assert out == docs[:2]
    infos = [r for r in caplog.records if "still loading" in r.getMessage()]
    assert infos and all(r.levelno == logging.INFO for r in infos)
    assert "keeping the current order" in infos[0].getMessage()
    assert not [r for r in caplog.records if r.levelno >= logging.WARNING]
    assert len(calls) == 1 and calls[0].reason == "warming" and calls[0].ok is False


def test_rerank_off_returns_the_input_untouched():
    from app.services.rerank_service import rerank

    docs = _docs()
    assert rerank("q", docs, 2, _us(rerank_enabled=False)) is docs


def test_new_parameters_are_keyword_only():
    import inspect

    from app.services.rerank_service import rerank

    params = inspect.signature(rerank).parameters
    assert list(params)[:4] == ["query", "documents", "top_n", "user_settings"]
    assert params["instruction"].kind is inspect.Parameter.KEYWORD_ONLY
    assert params["keep_documents"].kind is inspect.Parameter.KEYWORD_ONLY


def test_redact_inputs_names_the_three_secret_arguments():
    from app.services.rerank_engines.tracing import redact_inputs

    out = redact_inputs({"query": "q", "user_settings": object(), "api_key": "k", "supabase": object(),
                         "documents": [1]})
    assert out["query"] == "q" and out["documents"] == [1]
    assert out["user_settings"] == out["api_key"] == out["supabase"] == "<redacted>"


def test_record_engine_call_is_a_noop_without_a_capture():
    from app.services.rerank_engines.tracing import EngineCall, capture_engine_calls, record_engine_call

    call = EngineCall(engine="jev", model="m", purpose="rerank", input_tokens=1, output_tokens=0,
                      cost_usd=None, latency_ms=1.0, ok=True, reason=None)
    record_engine_call(call)   # no capture active: must not raise
    with capture_engine_calls() as calls:
        record_engine_call(call)
    assert calls == [call]
