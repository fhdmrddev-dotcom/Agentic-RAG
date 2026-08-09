"""Unit test for generate_thread_title warning log (Phase 078, CQ-TITLE-01, D-078-10).

Verifies that title-generation failures emit logger.warning('title_generation_failed: ...')
with exc_info=True, while preserving the fallback return behavior.

Phase 175 Plan 04 (XPROV-03 D-03/D-04) EXTENSION — the cross-provider utility-model
guard at the title-gen + suggestion sites: a stale ``sub_agent_model`` that infers to a
DIFFERENT provider than the active one is DROPPED before the call (no 404 → no
``fallback_model`` emit → no misleading banner), while a same-provider override is kept
byte-identical and a GENUINE same-provider 404 still emits ``fallback_model`` honestly.
"""
import logging
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import httpx
import openai
import pytest


# ---------------------------------------------------------------------------
# Phase 175 Plan 04 helpers (XPROV-03) — recording mock client + fake settings
# ---------------------------------------------------------------------------
def _make_completion(text: str):
    resp = MagicMock()
    resp.choices[0].message.content = text
    return resp


def _make_client(text: str = "A Real Title", side_effect=None):
    """A mock LLM client whose ``chat.completions.create`` records its kwargs.

    Pass ``side_effect`` (list) to raise/return per call for the 404 fallback path;
    otherwise every call returns a completion carrying ``text``.
    """
    client = MagicMock()
    if side_effect is not None:
        client.chat.completions.create.side_effect = side_effect
    else:
        client.chat.completions.create.return_value = _make_completion(text)
    return client


def _not_found_error() -> openai.NotFoundError:
    req = httpx.Request("POST", "http://test/v1/chat/completions")
    resp = httpx.Response(status_code=404, request=req)
    return openai.NotFoundError("model not found", response=resp, body=None)


def _settings(provider, sub_agent_model="", llm_model="fallback-llm", available_models=None):
    return SimpleNamespace(
        active_provider=provider,
        sub_agent_model=sub_agent_model,
        llm_model=llm_model,
        available_models=available_models or [],
    )


def _created_model(client) -> str:
    return client.chat.completions.create.call_args.kwargs["model"]


def test_title_gen_logs_warning_on_failure(caplog):
    """generate_thread_title logs 'title_generation_failed' on LLM error (D-078-10)."""
    from app.api.threads import generate_thread_title

    # Mock get_llm_client to raise, triggering the generic except Exception path.
    with patch("app.api.threads.get_llm_client", side_effect=RuntimeError("test LLM unavailable")):
        with caplog.at_level(logging.WARNING, logger="app.api.threads"):
            title, fallback_info = generate_thread_title(
                first_user_message="Hello world",
            )

    # Fallback title preserved (first 40 chars of first user message)
    assert title == "Hello world"
    assert fallback_info is None
    # Warning must fire with the exact string from D-078-10
    assert any(
        "title_generation_failed" in record.message
        for record in caplog.records
    ), f"Expected 'title_generation_failed' warning in logs, got: {[r.message for r in caplog.records]}"


# ===========================================================================
# Phase 175 Plan 04 — XPROV-03 (D-03/D-04): cross-provider utility-model guard
# ===========================================================================
def test_cross_provider_override_dropped_no_fallback_banner():
    """Active provider openai + a stale sub_agent_model that infers to google →
    the override is DROPPED before the call, generate_thread_title falls through
    to the openai provider default, NO 404 runs, and fallback_info is None (no
    misleading fallback banner) (D-03/D-04 suppress-when-fine)."""
    from app.services.thread_title import generate_thread_title

    client = _make_client("Ship It Fast")
    us = _settings(provider="openai", sub_agent_model="gemini-2.5-flash")  # infers google != openai
    with patch("app.api.threads.get_llm_client", return_value=client):
        title, fallback_info = generate_thread_title("How do I deploy?", us)

    assert fallback_info is None  # no fallback_model emit → no banner
    # Cross-provider override dropped → the openai provider default is used.
    assert _created_model(client) == "gpt-5.4-mini"


def test_same_provider_override_preserved_byte_identical():
    """Active provider openai + a same-provider sub_agent_model override (infers
    openai) → the override is used UNCHANGED (D-14 byte-identical), no fallback."""
    from app.services.thread_title import generate_thread_title

    client = _make_client("Deploy Guide")
    us = _settings(provider="openai", sub_agent_model="gpt-4o")  # infers openai == openai
    with patch("app.api.threads.get_llm_client", return_value=client):
        title, fallback_info = generate_thread_title("How do I deploy?", us)

    assert fallback_info is None
    assert _created_model(client) == "gpt-4o"  # override kept, not the provider default


def test_genuine_same_provider_fallback_still_emits_fallback_model():
    """A GENUINE same-provider 404 (the override survives the guard, then the
    provider actually 404s) STILL emits fallback_model honestly (D-04 keep-the-
    honest-case) — the guard only suppresses the FALSE cross-provider banner."""
    from app.services.thread_title import generate_thread_title

    client = _make_client(side_effect=[_not_found_error(), _make_completion("Recovered Title")])
    us = _settings(provider="openai", sub_agent_model="gpt-4o")  # same-provider → kept, then 404s
    with patch("app.api.threads.get_llm_client", return_value=client):
        title, fallback_info = generate_thread_title("How do I deploy?", us)

    assert fallback_info is not None
    assert fallback_info["original_model"] == "gpt-4o"
    assert fallback_info["fallback_model"] == "gpt-5.4-mini"


def test_suggestion_cross_provider_override_dropped():
    """suggestion_service applies the SAME guard: a stale cross-provider
    sub_agent_model is dropped → the active provider's default is used, never the
    cross-provider id (XPROV-03 twin site)."""
    from app.services.suggestion_service import generate_suggestions

    client = _make_client("q1\nq2\nq3")
    us = _settings(provider="openai", sub_agent_model="gemini-2.5-flash")  # infers google != openai
    with patch("app.services.suggestion_service.get_llm_client", return_value=client):
        questions, fallback_info = generate_suggestions("How ship?", "Promote develop.", us)

    assert _created_model(client) == "gpt-5.4-mini"  # provider default, not the cross-provider override


def test_suggestion_same_provider_override_preserved():
    """suggestion_service keeps a SAME-provider override unchanged (byte-identical)."""
    from app.services.suggestion_service import generate_suggestions

    client = _make_client("q1\nq2\nq3")
    us = _settings(provider="openai", sub_agent_model="gpt-4o")  # infers openai == openai
    with patch("app.services.suggestion_service.get_llm_client", return_value=client):
        questions, fallback_info = generate_suggestions("How ship?", "Promote develop.", us)

    assert _created_model(client) == "gpt-4o"
