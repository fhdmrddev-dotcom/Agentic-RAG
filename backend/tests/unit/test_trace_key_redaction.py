"""Provider keys never reach a LangSmith trace (found live at 291 UAT S1, 2026-10-23).

LangSmith serialises a traced function's arguments. ``stream_anthropic``, ``stream_google`` and
``web_search`` take an ``api_key`` argument and ``run_sub_agent`` takes ``user_settings`` (every
provider key), and none of them bound ``process_inputs=redact_inputs`` — so a live
``ChatAnthropic`` trace carried the operator's Anthropic key in its inputs. Phase 294 fenced only
the modules it owned; this sweep covers every traced function under ``app/``.
"""
from __future__ import annotations

import ast
from pathlib import Path

import httpx
import pytest

from tests.unit.decision_engine_fakes import FakeLangSmithClient, tracing_into

APP = Path(__file__).resolve().parents[2] / "app"
PLANTED = "sk-planted-0123456789abcdef"
_TRACE_NAMES = {"traceable", "_ls_traceable"}


def _traced():
    for path in sorted(APP.rglob("*.py")):
        tree = ast.parse(path.read_text(encoding="utf-8-sig"))
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                for dec in node.decorator_list:
                    target = dec.func if isinstance(dec, ast.Call) else dec
                    name = target.attr if isinstance(target, ast.Attribute) else getattr(target, "id", None)
                    if name in _TRACE_NAMES:
                        yield path.relative_to(APP).as_posix(), node.name, dec


def test_every_traced_function_in_app_redacts_its_inputs():
    found = list(_traced())
    names = {f"{p}:{fn}" for p, fn, _ in found}
    # non-vacuity: the four that leaked are in the walk
    for must in ("services/anthropic_service.py:stream_anthropic", "services/google_service.py:stream_google",
                 "services/web_search_service.py:web_search", "services/sub_agent_service.py:run_sub_agent"):
        assert must in names, sorted(names)
    bad = []
    for path, fn, dec in found:
        kw = {k.arg: k.value for k in dec.keywords} if isinstance(dec, ast.Call) else {}
        pi = kw.get("process_inputs")
        if not (isinstance(pi, ast.Name) and pi.id == "redact_inputs"):
            bad.append(f"{path}:{fn}")
    assert not bad, f"traced without process_inputs=redact_inputs: {bad}"


def test_web_search_key_never_reaches_the_trace(monkeypatch):
    from app.services import web_search_service

    def handle(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"results": []})

    real = httpx.Client
    monkeypatch.setattr(web_search_service.httpx, "Client",
                        lambda **kw: real(transport=httpx.MockTransport(handle), **kw))
    with tracing_into(FakeLangSmithClient()) as client:
        web_search_service.web_search("q", PLANTED)
    assert "web_search" in client.names()
    assert PLANTED not in client.text()


def test_anthropic_key_never_reaches_the_trace(monkeypatch):
    from app.services import anthropic_service

    def boom(*_a, **_k):
        raise RuntimeError("no network in unit tests")

    monkeypatch.setattr(anthropic_service, "_anthropic_client", boom)
    with tracing_into(FakeLangSmithClient()) as client:
        with pytest.raises(RuntimeError):
            list(anthropic_service.stream_anthropic(
                messages=[{"role": "user", "content": "hi"}], tools=[], system_prompt="s",
                model="claude-x", api_key=PLANTED, max_tokens=10,
            ))
    assert "ChatAnthropic" in client.names()
    assert PLANTED not in client.text()
