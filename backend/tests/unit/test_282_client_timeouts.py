"""Phase 282 Plan 01 (FIX-06; D-01, D-02, D-03, D-09 part 1, D-19, D-23) — read the timeout and
the retry count back from EVERY built LLM client.

What was wrong (BUG-260916-01): an operator's per-model ``llm_call_timeout_seconds`` drove only the
app's own ``asyncio.timeout`` around the stream drain. No provider client was ever BUILT with it.
Every client got its SDK's defaults by omission — OpenAI-family and Anthropic 600 s read with 2
retries, google-genai NO timeout at all — so a 900 s setting on a slow local model was cut at
600 s by the SDK, then retried twice on the same GPU, and the budget the operator chose was never
the one that applied.

These tests read the values off REAL built clients (``client.timeout``, ``client.max_retries``,
genai's stored ``http_options``), never off captured kwargs alone, so a value that is passed but
dropped by a wrapper still reads red.
"""
from __future__ import annotations

import inspect
from pathlib import Path

import httpx
import pytest

import app.config as config
from app.services import anthropic_service, google_service, openai_service
from app.services.openai_service import CallingMode, get_embedding_client, get_llm_client
from app.services.provider_gateway import dispatcher
from app.services.provider_gateway import anthropic as gw_anthropic
from app.services.provider_gateway import google as gw_google
from app.services.provider_gateway import openai_compat, openai_responses
from app.services.provider_gateway.dispatcher import GatewayRequest

_BACKEND = Path(__file__).resolve().parents[2]
_REPO = _BACKEND.parent


class _Stop(Exception):
    """Raised by a recorder once it has captured its kwargs — nothing downstream runs."""


def _assert_budget(timeout: httpx.Timeout, read: float, connect: float = 5.0) -> None:
    assert isinstance(timeout, httpx.Timeout)
    assert timeout.read == read
    assert timeout.write == read
    assert timeout.pool == read
    assert timeout.connect == connect


# ── Behaviour 1: the per-model budget reaches the OpenAI-family constructor ───────────────


def test_llm_client_is_built_with_the_budget():
    client = get_llm_client(None, timeout_s=900, max_retries=0)
    _assert_budget(client.timeout, 900)
    assert client.max_retries == 0


def test_llm_client_keeps_the_budget_through_the_langsmith_wrap(monkeypatch):
    monkeypatch.setattr(openai_service.settings, "langsmith_api_key", "ls-dummy-key")
    client = get_llm_client(None, timeout_s=900, max_retries=0)
    _assert_budget(client.timeout, 900)
    assert client.max_retries == 0


# ── Behaviour 2: no-budget callers carry the NAMED constants ──────────────────────────────


def test_no_budget_llm_and_embedding_clients_read_the_named_constants():
    for client in (get_llm_client(None), get_embedding_client(None)):
        _assert_budget(client.timeout, 600)
        assert client.max_retries == 2
    for fn in (get_llm_client, get_embedding_client):
        src = inspect.getsource(fn)
        assert "NO_BUDGET_LLM_TIMEOUT_S" in src and "NO_BUDGET_LLM_MAX_RETRIES" in src, fn.__name__


# ── Behaviour 3: Anthropic ─────────────────────────────────────────────────────────────────


def test_anthropic_client_is_built_with_the_budget():
    client = anthropic_service._anthropic_client("k", 900)
    _assert_budget(client.timeout, 900)
    assert client.max_retries == 2


def test_anthropic_client_without_a_budget_reads_the_constants():
    client = anthropic_service._anthropic_client("k", None)
    _assert_budget(client.timeout, 600)
    assert client.max_retries == 2


# ── Behaviour 4: Google (genai timeout is MILLISECONDS; one attempt, explicit) ────────────


def test_google_client_is_built_with_the_budget_in_ms_and_one_attempt():
    client = google_service._google_client("k", 900)
    opts = client._api_client._http_options
    assert opts.timeout == 900_000
    assert opts.retry_options is not None and opts.retry_options.attempts == 1


def test_google_client_without_a_budget_keeps_todays_behaviour():
    client = google_service._google_client("k", None)
    assert client._api_client._http_options.timeout is None


def test_google_client_never_receives_zero():
    client = google_service._google_client("k", 0.0001)
    assert client._api_client._http_options.timeout >= 1


# ── Behaviour 5: the compat adapter forwards the budget + the provider's retry count ──────


def _compat_recorder(record: dict):
    def _fake(**kwargs):
        record.update(kwargs)
        raise _Stop

    return _fake


@pytest.mark.parametrize("provider, retries", [("lmstudio", 0), ("openrouter", 2)])
def test_compat_adapter_forwards_budget_and_retries(monkeypatch, provider, retries):
    rec: dict = {}
    monkeypatch.setattr(openai_compat, "create_adaptive_streaming_chat", _compat_recorder(rec))
    req = GatewayRequest(messages=[], model="m", active_provider_name=provider, timeout_s=900)
    with pytest.raises(_Stop):
        openai_compat.open_openai_compat_stream(req)
    assert rec["timeout_s"] == 900
    assert rec["max_retries"] == retries


def test_compat_adapter_without_budget_forwards_nothing_new(monkeypatch):
    rec: dict = {}
    monkeypatch.setattr(openai_compat, "create_adaptive_streaming_chat", _compat_recorder(rec))
    req = GatewayRequest(messages=[], model="m", active_provider_name="lmstudio")
    with pytest.raises(_Stop):
        openai_compat.open_openai_compat_stream(req)
    assert "timeout_s" not in rec and "max_retries" not in rec


def test_create_adaptive_streaming_chat_forwards_to_get_llm_client(monkeypatch):
    rec: dict = {}

    def _fake_client(user_settings=None, **kw):
        rec.update(kw)
        raise _Stop

    monkeypatch.setattr(openai_service, "get_llm_client", _fake_client)
    with pytest.raises(_Stop):
        openai_service.create_adaptive_streaming_chat(
            messages=[], model="m", timeout_s=900, max_retries=0
        )
    assert rec == {"timeout_s": 900, "max_retries": 0}

    rec.clear()
    with pytest.raises(_Stop):
        openai_service.create_adaptive_streaming_chat(messages=[], model="m")
    assert rec == {}


# ── Behaviour 6: the Responses adapter ─────────────────────────────────────────────────────


def _client_recorder(record: dict):
    def _fake(user_settings=None, **kw):
        record["called"] = True
        record.update(kw)
        raise _Stop

    return _fake


def test_responses_adapter_forwards_budget_and_cloud_retries(monkeypatch):
    rec: dict = {}
    monkeypatch.setattr(openai_responses, "get_llm_client", _client_recorder(rec))
    req = GatewayRequest(messages=[], model="gpt-5.6", active_provider_name="openai", timeout_s=900)
    with pytest.raises(_Stop):
        openai_responses.open_openai_responses_stream(req)
    assert rec["timeout_s"] == 900
    assert rec["max_retries"] == 2


def test_responses_adapter_without_budget_forwards_nothing_new(monkeypatch):
    rec: dict = {}
    monkeypatch.setattr(openai_responses, "get_llm_client", _client_recorder(rec))
    req = GatewayRequest(messages=[], model="gpt-5.6", active_provider_name="openai")
    with pytest.raises(_Stop):
        openai_responses.open_openai_responses_stream(req)
    assert rec.get("called") is True
    assert "timeout_s" not in rec and "max_retries" not in rec


# ── Behaviour 7: the native adapters forward timeout_s ────────────────────────────────────


def _stream_recorder(record: dict):
    def _fake(**kwargs):
        record.update(kwargs)
        raise _Stop

    return _fake


def test_anthropic_adapter_forwards_the_budget(monkeypatch):
    rec: dict = {}
    monkeypatch.setattr(gw_anthropic, "stream_anthropic", _stream_recorder(rec))
    req = GatewayRequest(
        messages=[], model="claude-sonnet-4-6", active_provider_name="anthropic", tools=[], timeout_s=900
    )
    with pytest.raises(_Stop):
        gw_anthropic.open_anthropic_stream(req)
    assert rec["timeout_s"] == 900


def test_google_adapter_forwards_the_budget(monkeypatch):
    rec: dict = {}
    monkeypatch.setattr(gw_google, "stream_google", _stream_recorder(rec))
    req = GatewayRequest(
        messages=[], model="gemini-3.6-flash", active_provider_name="google", tools=[], timeout_s=900
    )
    with pytest.raises(_Stop):
        gw_google.open_google_stream(req)
    assert rec["timeout_s"] == 900


# ── Behaviour 8: source fences — the budget travels from every GatewayRequest builder ─────


def test_gateway_request_timeout_defaults_to_none():
    req = GatewayRequest(messages=[], model="m", active_provider_name="openai")
    assert req.timeout_s is None
    assert "timeout_s" in {f for f in dispatcher.GatewayRequest.__dataclass_fields__}


def test_agent_loop_passes_the_budget_on_both_builds():
    src = (_BACKEND / "app/services/agent_loop.py").read_text(encoding="utf-8")
    assert src.count("timeout_s=per_call_budget") == 2


def test_forced_emit_passes_the_budget_through_its_one_builder():
    import app.services.forced_emit as fe

    src = inspect.getsource(fe.forced_emit)
    assert src.count("_build_request(") == 1
    assert "timeout_s=" in src
    assert "get_per_call_timeout_async" in src
    assert "timeout_s=timeout_s" in inspect.getsource(fe._build_request)


def test_task_service_passes_the_budget():
    src = (_BACKEND / "app/services/task_service.py").read_text(encoding="utf-8")
    assert "timeout_s=" in src
    assert "get_per_call_timeout_async" in src


# ── Behaviour 9: the help line's retry count cannot drift from the backend constant ───────


def test_help_line_retry_count_matches_the_backend_constant():
    n = config.LLM_MAX_RETRIES_CLOUD
    src = (_REPO / "frontend/src/lib/api/admin.ts").read_text(encoding="utf-8")
    assert f"up to {n} times" in src
