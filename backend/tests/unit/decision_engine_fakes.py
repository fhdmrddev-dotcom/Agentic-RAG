"""Shared fakes for the Phase 294 decision-engine tests (not a test module).

Import as ``from tests.unit.decision_engine_fakes import ...`` (the ``test_240_thread_key``
precedent). Response shapes follow the vendor docs fetched 2026-10-20 (294-RESEARCH §1):

* Jev   → ``{"answers": {"P00": {"type": "noul", "noul": 0.93}}, "usage": {"input_tokens",
  "output_tokens", "cost"}}``
* OpenAI → ``{"answers": [{"type": "predicate", "name": "P00", "probability": 0.92} |
  {"type": "refusal", "name": "P00"}], "usage": {"input_tokens", "output_tokens", "total_tokens"}}``
"""
from __future__ import annotations

import json
import threading
import time
from contextlib import contextmanager
from types import SimpleNamespace
from typing import Callable, Iterator

import httpx

PLANTED_OR = "sk-or-PLANTED-294"
PLANTED_OAI = "sk-PLANTED-294"
PLANTED_COHERE = "co-PLANTED-294"
PLANTED_KEYS = (PLANTED_OR, PLANTED_OAI, PLANTED_COHERE)
BODY_MARKER = "BODY-MARKER-294-never-logged"

JEV_USAGE = {"input_tokens": 120, "output_tokens": 0, "cost": 0.00000504}
OPENAI_USAGE = {"input_tokens": 1234, "output_tokens": 0, "total_tokens": 1234}


def provider(pid: str, key: str):
    return SimpleNamespace(id=pid, name=pid, base_url=f"https://{pid}.example/api/v1", api_key=key,
                           models=[], is_active=False)


def user_settings(**kw):
    base = dict(
        rerank_enabled=True, rerank_provider="jev", rerank_api_key=PLANTED_COHERE,
        rerank_model="rerank-v3.5", rerank_top_n=5,
        providers=[provider("openrouter", PLANTED_OR), provider("openai", PLANTED_OAI)],
        llm_api_key=PLANTED_OAI, embedding_api_key=PLANTED_OAI,
    )
    base.update(kw)
    return SimpleNamespace(**base)


def docs(n: int, *, size: int = 40, doc_of=lambda i: f"d{i % 4}") -> list[dict]:
    return [{"id": f"c{i}", "document_id": doc_of(i), "chunk_index": i,
             "content": f"passage {i} " + ("x" * size), "similarity": 0.5} for i in range(n)]


def alternating(i: int) -> float:
    """0.9 / 0.05 alternating — half the pool clears the D-07 floor."""
    return 0.9 if i % 2 == 0 else 0.05


class Recorder:
    """Every request the MockTransport saw, plus the peak number in flight."""

    def __init__(self):
        self.requests: list[httpx.Request] = []
        self.bodies: list[dict] = []
        self._lock = threading.Lock()
        self._in_flight = 0
        self.max_in_flight = 0

    def enter(self, request: httpx.Request) -> dict:
        body = json.loads(request.content.decode("utf-8"))
        with self._lock:
            self.requests.append(request)
            self.bodies.append(body)
            self._in_flight += 1
            self.max_in_flight = max(self.max_in_flight, self._in_flight)
        return body

    def leave(self) -> None:
        with self._lock:
            self._in_flight -= 1


def jev_handler(rec: Recorder, prob: Callable[[int], float] = alternating, *, delay: float = 0.0,
                usage: dict | None = None):
    def handle(request: httpx.Request) -> httpx.Response:
        body = rec.enter(request)
        try:
            if delay:
                time.sleep(delay)
            answers = {name: {"type": "noul", "noul": prob(int(name[1:]))} for name in body["questions"]}
            return httpx.Response(200, json={"id": "gen-1", "model": body["model"], "provider": "TypeSafe",
                                             "answers": answers, "usage": usage or JEV_USAGE})
        finally:
            rec.leave()
    return handle


def openai_handler(rec: Recorder, prob: Callable[[int], float] = alternating, *, usage: dict | None = None):
    def handle(request: httpx.Request) -> httpx.Response:
        body = rec.enter(request)
        try:
            answers = [{"type": "predicate", "name": q["name"], "probability": prob(int(q["name"][1:]))}
                       for q in body["questions"]]
            return httpx.Response(200, json={"id": "dec_1", "answers": answers, "usage": usage or OPENAI_USAGE})
        finally:
            rec.leave()
    return handle


def fault_handler(rec: Recorder, fault: str, engine: str):
    """One forced failure. Every body carries BODY_MARKER so a leak into a log is detectable."""
    def handle(request: httpx.Request) -> httpx.Response:
        body = rec.enter(request)
        try:
            if fault in ("401", "429", "500"):
                return httpx.Response(int(fault), json={"error": {"code": int(fault), "message": BODY_MARKER}})
            if fault == "connect_timeout":
                raise httpx.ConnectTimeout(f"connect timeout {BODY_MARKER}", request=request)
            if fault == "read_timeout":
                raise httpx.ReadTimeout(f"read timeout {BODY_MARKER}", request=request)
            if fault == "non_json":
                return httpx.Response(200, content=f"<html>{BODY_MARKER}</html>".encode())
            if fault == "no_answers":
                return httpx.Response(200, json={"note": BODY_MARKER})
            names = list(body["questions"]) if engine == "jev" else [q["name"] for q in body["questions"]]
            if fault == "refusal":   # OpenAI only
                answers = [{"type": "refusal", "name": n} for n in names]
                return httpx.Response(200, json={"answers": answers, "usage": OPENAI_USAGE, "x": BODY_MARKER})
            if fault == "missing":   # Jev: the only "can't tell" signal is a missing answer
                answers = {n: {"type": "noul", "noul": 0.5} for n in names[1:]}
                return httpx.Response(200, json={"answers": answers, "usage": JEV_USAGE, "x": BODY_MARKER})
            if fault == "out_of_range":
                if engine == "jev":
                    answers = {n: {"type": "noul", "noul": 1.7} for n in names}
                    return httpx.Response(200, json={"answers": answers, "usage": JEV_USAGE})
                answers = [{"type": "predicate", "name": n, "probability": 1.7} for n in names]
                return httpx.Response(200, json={"answers": answers, "usage": OPENAI_USAGE})
            raise AssertionError(fault)
        finally:
            rec.leave()
    return handle


def install(monkeypatch, module, handler) -> None:
    """Route ``module._http_client`` through a MockTransport, keeping the adapter's timeout."""
    def _client(timeout):
        return httpx.Client(transport=httpx.MockTransport(handler), timeout=timeout)
    monkeypatch.setattr(module, "_http_client", _client)


class FakeLangSmithClient:
    """Records every payload LangSmith would have sent (create_run / update_run / anything)."""

    def __init__(self):
        self.calls: list[tuple[str, tuple, dict]] = []

    def create_run(self, *a, **kw):
        self.calls.append(("create_run", a, kw))

    def update_run(self, *a, **kw):
        self.calls.append(("update_run", a, kw))

    def __getattr__(self, name):
        def _any(*a, **kw):
            self.calls.append((name, a, kw))
        return _any

    def names(self) -> set[str]:
        return {kw.get("name") for op, _a, kw in self.calls if op == "create_run"}

    def text(self) -> str:
        return repr(self.calls)

    def outputs_of(self, name: str) -> list[dict]:
        ids = {kw.get("id") for op, _a, kw in self.calls if op == "create_run" and kw.get("name") == name}
        out = []
        for op, a, kw in self.calls:
            if op == "update_run" and (a[0] if a else kw.get("run_id")) in ids and kw.get("outputs"):
                out.append(kw["outputs"])
        return out


@contextmanager
def tracing_into(client: FakeLangSmithClient) -> Iterator[FakeLangSmithClient]:
    from langsmith.run_helpers import tracing_context

    with tracing_context(enabled=True, client=client):
        yield client
