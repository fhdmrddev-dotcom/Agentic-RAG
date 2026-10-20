"""Phase 294-03 (SC#6, T-294-32) — the citation check leaves no provider key in LangSmith or logs.

Two halves:
  * an AST walk over ``citation_check_service.py`` and ``api/citation_checks.py``: every
    ``traceable(...)`` decorator binds ``process_inputs=redact_inputs`` (with a NON-VACUITY count,
    so a walk that finds nothing cannot pass);
  * a real ``run_citation_check`` with planted keys in ``user_settings``, traced into 294-01's
    fake LangSmith client: no captured payload carries a key, while the payloads DO carry the
    claim text (proof the fake client sees the inputs at all).
"""

from __future__ import annotations

import ast
import logging
from pathlib import Path

import httpx
import pytest

from app.api import citation_checks as route
from app.services import citation_check_service as svc
from app.services.rerank_engines import jev, openai_decisions
from tests.unit.decision_engine_fakes import (
    PLANTED_KEYS,
    FakeLangSmithClient,
    Recorder,
    install,
    tracing_into,
    user_settings,
)

CONTENT = "Revenue rose to five million dollars in 2024 [1]. Costs fell by twelve percent over the year [2]."


def _row() -> dict:
    return {
        "id": "11111111-1111-4111-8111-111111111111", "thread_id": "22222222-2222-4222-8222-222222222222",
        "user_id": "33333333-3333-4333-8333-333333333333", "org_id": "44444444-4444-4444-8444-444444444444",
        "role": "assistant", "content": CONTENT,
        "source_refs": [{"document_id": "d1", "passage": "Revenue was $5M."},
                        {"document_id": "d2", "passage": "Costs rose."}],
    }


def _traceable_decorators(path: Path) -> list[ast.Call]:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    found = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            for dec in node.decorator_list:
                target = dec.func if isinstance(dec, ast.Call) else dec
                name = target.attr if isinstance(target, ast.Attribute) else getattr(target, "id", None)
                if name == "traceable":
                    found.append(dec)
    return found


@pytest.mark.parametrize("module,expected", [(svc, 1), (route, 0)])
def test_every_traceable_redacts_inputs(module, expected):
    decs = _traceable_decorators(Path(module.__file__))
    assert len(decs) == expected, [ast.unparse(d) for d in decs]   # non-vacuity: the walk sees them
    for dec in decs:
        assert isinstance(dec, ast.Call), ast.unparse(dec)
        kw = {k.arg: k.value for k in dec.keywords}
        assert "process_inputs" in kw, ast.unparse(dec)
        assert isinstance(kw["process_inputs"], ast.Name) and kw["process_inputs"].id == "redact_inputs"


def _jev_ok(rec):
    def handle(request):
        body = rec.enter(request)
        try:
            return httpx.Response(200, json={"answers": {n: {"type": "choice", "choice": "supported", "confidence": 0.9}
                                                         for n in body["questions"]},
                                             "usage": {"input_tokens": 10, "cost": 0.000001}})
        finally:
            rec.leave()
    return handle


def _oai_ok(rec):
    def handle(request):
        body = rec.enter(request)
        try:
            return httpx.Response(200, json={"answers": [{"type": "choice", "name": q["name"], "choice": "supported",
                                                          "confidence": 0.9, "probabilities": []}
                                                         for q in body["questions"]],
                                             "usage": {"input_tokens": 10}})
        finally:
            rec.leave()
    return handle


@pytest.mark.parametrize("engine,module,handler,span", [
    ("jev", jev, _jev_ok, "decision.jev"),
    ("openai_decisions", openai_decisions, _oai_ok, "decision.openai"),
])
def test_planted_keys_never_reach_a_langsmith_payload_or_a_log(monkeypatch, caplog, engine, module, handler, span):
    rec = Recorder()
    install(monkeypatch, module, handler(rec))
    caplog.set_level(logging.DEBUG)
    with tracing_into(FakeLangSmithClient()) as client:
        result = svc.run_citation_check(_row(), user_settings(rerank_provider=engine, rerank_model=""))
    assert result.counts.supported == 2
    names = client.names()
    assert "citation-check" in names and span in names, names
    text = client.text()
    assert "Revenue rose to five million dollars" in text     # non-vacuity: inputs ARE captured
    for key in PLANTED_KEYS:
        assert key not in text, key
        assert key not in caplog.text, key


def test_a_failing_source_logs_no_key_and_no_body(monkeypatch, caplog):
    rec = Recorder()

    def handle(request):
        rec.enter(request)
        try:
            return httpx.Response(401, json={"error": {"message": "BODY-MARKER-294 sk-or-PLANTED-294"}})
        finally:
            rec.leave()

    install(monkeypatch, jev, handle)
    caplog.set_level(logging.DEBUG)
    result = svc.run_citation_check(_row(), user_settings(rerank_provider="jev", rerank_model=""))
    assert result.counts.couldnt_check == 2
    assert "BODY-MARKER-294" not in caplog.text
    for key in PLANTED_KEYS:
        assert key not in caplog.text
    assert "HTTPStatusError:401" in caplog.text
