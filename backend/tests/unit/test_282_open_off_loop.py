"""Phase 282 Plan 01 (FIX-06, BUG-261015-02; D-05 as resolved by D-20) — the OpenAI-family stream
OPEN leaves the event loop, and the open and the drain share ONE per-call deadline.

What was wrong (BUG-261015-02, measured at research): ``dispatcher.open_stream``'s OpenAI-compat /
Responses branch called the SDK's ``create(...)`` SYNCHRONOUSLY on the event loop. The SDK does not
return until response headers arrive, so a server that withholds headers froze the whole uvicorn
worker — a 50 ms asyncio ticker stalled 3.794 s on a 3.0 s header delay. And because the per-call
``asyncio.timeout`` only started at the DRAIN, the open (connect + headers + SDK retries) ran
outside the operator's budget entirely.

The fix (D-20 option A): the dispatcher runs the open via ``asyncio.to_thread`` (contextvars
propagate, so the LangSmith parent run survives), guards it with ``asyncio.timeout_at(deadline)``,
stamps ``stream.budget_deadline = deadline`` so the drain helper honours the SAME deadline, and
closes a stream that lands after the guard fired instead of leaking it.
"""
from __future__ import annotations

import asyncio
import contextvars
import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import MagicMock

import pytest

from app.config import settings
from app.services.agent_loop import _drain_stream_with_close_on_cancel
from app.services.openai_service import CallingMode
from app.services.provider_gateway import dispatcher, openai_compat
from app.services.provider_gateway.dispatcher import GatewayRequest, open_stream


# ── A real-socket stub that withholds headers ─────────────────────────────────────────────


class _StubServer(ThreadingHTTPServer):
    daemon_threads = True
    header_delay = 0.0
    chunk_gap = 0.0
    hits = 0


class _Handler(BaseHTTPRequestHandler):
    def do_POST(self):  # noqa: N802 — http.server API
        server: _StubServer = self.server  # type: ignore[assignment]
        length = int(self.headers.get("Content-Length", 0) or 0)
        if length:
            self.rfile.read(length)
        server.hits += 1
        try:
            time.sleep(server.header_delay)
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.end_headers()
            for i, text in enumerate(["hel", "lo"]):
                if i and server.chunk_gap:
                    time.sleep(server.chunk_gap)
                chunk = {
                    "id": "c1",
                    "object": "chat.completion.chunk",
                    "created": 0,
                    "model": "stub-model",
                    "choices": [{"index": 0, "delta": {"content": text}, "finish_reason": None}],
                }
                self.wfile.write(f"data: {json.dumps(chunk)}\n\n".encode())
                self.wfile.flush()
            self.wfile.write(b"data: [DONE]\n\n")
            self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError, OSError):
            pass

    def log_message(self, *args):  # silence the stub
        pass


@pytest.fixture
def stub(monkeypatch):
    server = _StubServer(("127.0.0.1", 0), _Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    monkeypatch.setattr(settings, "llm_base_url", f"http://127.0.0.1:{server.server_address[1]}/v1")
    monkeypatch.setattr(settings, "llm_api_key", "stub-key")
    yield server
    server.shutdown()
    server.server_close()


def _req(timeout_s=None, provider="lmstudio"):
    return GatewayRequest(
        messages=[{"role": "user", "content": "hi"}],
        model="stub-model",
        active_provider_name=provider,
        tools=[],
        timeout_s=timeout_s,
    )


async def _ticker(stop: asyncio.Event, gaps: list[float]):
    last = time.perf_counter()
    while not stop.is_set():
        await asyncio.sleep(0.05)
        now = time.perf_counter()
        gaps.append(now - last)
        last = now


# ── Test 1: the loop stays responsive while headers are withheld ──────────────────────────


async def test_open_does_not_freeze_the_event_loop(stub):
    stub.header_delay = 2.0
    stop = asyncio.Event()
    gaps: list[float] = []
    tick = asyncio.create_task(_ticker(stop, gaps))
    await asyncio.sleep(0.12)
    stream, mode = await open_stream("lmstudio", _req(timeout_s=10))
    stop.set()
    await tick
    stream.close()
    max_gap = max(gaps)
    print(f"MEASURED max_tick_gap_s={max_gap:.3f} ticks={len(gaps)}")
    assert max_gap < 0.5, f"the event loop stalled {max_gap:.3f}s while the open waited for headers"


# ── Test 2: the open is inside the budget ─────────────────────────────────────────────────


async def test_open_is_inside_the_budget(stub):
    stub.header_delay = 3.0
    t0 = time.perf_counter()
    with pytest.raises(TimeoutError):
        await open_stream("lmstudio", _req(timeout_s=1))
    elapsed = time.perf_counter() - t0
    print(f"MEASURED open_timeout_elapsed_s={elapsed:.3f}")
    assert elapsed < 1.6


# ── Test 3: a stream that lands after the guard fired is closed ───────────────────────────


class _FakeStream:
    def __init__(self):
        self.closed = False

    def __iter__(self):
        return iter(())

    def close(self):
        self.closed = True


async def test_late_stream_is_closed(monkeypatch):
    fake = _FakeStream()

    def _slow_open(request):
        time.sleep(1.5)
        return fake, CallingMode.NATIVE

    monkeypatch.setattr(openai_compat, "open_openai_compat_stream", _slow_open)
    with pytest.raises(TimeoutError):
        await open_stream("lmstudio", _req(timeout_s=0.5))
    assert fake.closed is False  # the thread is still opening
    await asyncio.sleep(2.0)
    assert fake.closed is True, "a stream that arrived after the open guard fired was leaked"


# ── Test 4: the deadline is stamped on the stream (and a bare generator is tolerated) ─────


async def test_budget_deadline_is_stamped(monkeypatch):
    fake = _FakeStream()
    monkeypatch.setattr(
        openai_compat, "open_openai_compat_stream", lambda request: (fake, CallingMode.NATIVE)
    )
    loop = asyncio.get_running_loop()
    expected = loop.time() + 5
    stream, _ = await open_stream("lmstudio", _req(timeout_s=5))
    assert stream is fake
    assert abs(fake.budget_deadline - expected) < 0.2


async def test_bare_generator_stream_does_not_raise(monkeypatch):
    def _gen():
        yield {"type": "delta", "content": "x"}

    monkeypatch.setattr(
        openai_compat, "open_openai_compat_stream", lambda request: (_gen(), CallingMode.NATIVE)
    )
    stream, mode = await open_stream("lmstudio", _req(timeout_s=5))
    assert list(stream) == [{"type": "delta", "content": "x"}]


async def test_no_budget_stamps_nothing_and_still_runs_off_loop(monkeypatch):
    fake = _FakeStream()
    seen: dict = {}
    main = threading.get_ident()

    def _open(request):
        seen["thread"] = threading.get_ident()
        return fake, CallingMode.NATIVE

    monkeypatch.setattr(openai_compat, "open_openai_compat_stream", _open)
    stream, _ = await open_stream("lmstudio", _req(timeout_s=None))
    assert stream is fake
    assert not hasattr(fake, "budget_deadline")
    assert seen["thread"] != main


# ── Test 5: the drain honours the stamped deadline ────────────────────────────────────────


class _BlockingStream:
    """A producer that blocks until closed — the drain must be ended by a deadline."""

    def __init__(self):
        self._closed = threading.Event()

    def __iter__(self):
        self._closed.wait(timeout=15)
        return iter(())

    def close(self):
        self._closed.set()


async def _noop_chunk(chunk):
    return None


async def test_drain_shares_the_stamped_deadline():
    loop = asyncio.get_running_loop()
    stream = _BlockingStream()
    stream.budget_deadline = loop.time() + 0.5
    t0 = time.perf_counter()
    with pytest.raises(TimeoutError):
        await _drain_stream_with_close_on_cancel(stream, 10, _noop_chunk)
    elapsed = time.perf_counter() - t0
    assert elapsed < 2.0, f"drain ignored the shared deadline ({elapsed:.3f}s)"


async def test_drain_without_a_numeric_deadline_uses_timeout_seconds():
    plain = _BlockingStream()
    t0 = time.perf_counter()
    with pytest.raises(TimeoutError):
        await _drain_stream_with_close_on_cancel(plain, 0.4, _noop_chunk)
    assert time.perf_counter() - t0 < 2.0

    mocked = MagicMock()
    mocked.__iter__.return_value = iter(())
    # MagicMock auto-creates ``budget_deadline`` as a MagicMock — it is not a number, so the
    # helper must fall back to ``timeout_seconds`` and complete normally here.
    await _drain_stream_with_close_on_cancel(mocked, 5, _noop_chunk)


# ── Test 6: the harness callers survive an open-guard TimeoutError ────────────────────────


async def test_forced_emit_ends_the_ladder_on_an_open_guard_timeout(monkeypatch):
    import app.services.forced_emit as fe

    calls: list = []

    async def _timeout_open(provider, request):
        calls.append(request)
        raise TimeoutError

    async def _budget(model, settings_obj=None, *, provider=None):  # 282-04 D-28: provider kwarg
        return 7

    monkeypatch.setattr(fe, "open_stream", _timeout_open)
    monkeypatch.setattr(fe, "get_per_call_timeout_async", _budget)
    monkeypatch.setattr(
        fe,
        "get_model_capability",
        lambda model: {"forced_emission": True, "emit_tier": "force", "provider": "deepseek"},
    )
    res = await fe.forced_emit(
        messages=[{"role": "user", "content": "fill the template"}],
        model="deepseek-v4",
        provider="openai",
        emitter="render_template",
        tools=[{"function": {"name": "render_template", "parameters": {}}}],
        user_settings=None,
    )
    # 282-REVIEW WR-03: the `force` ladder is (non_strict_force, coerce), but a timeout is
    # TERMINAL — the second rung would re-send the prompt to a busy model and stack budgets
    # past the watchdog. One call, then the honest provider_error floor — nothing escaped.
    assert len(calls) == 1
    assert all(r.timeout_s == 7 for r in calls)
    assert res["emitted"] is None
    assert res["failure"] == "provider_error"


# ── Test 6b: contextvars reach the off-loop open ──────────────────────────────────────────

_CTX: contextvars.ContextVar[str] = contextvars.ContextVar("_282_ctx", default="unset")


async def test_contextvars_reach_the_open(monkeypatch):
    seen: dict = {}

    def _open(request):
        seen["ctx"] = _CTX.get()
        return _FakeStream(), CallingMode.NATIVE

    monkeypatch.setattr(openai_compat, "open_openai_compat_stream", _open)
    token = _CTX.set("parent-run")
    try:
        await open_stream("lmstudio", _req(timeout_s=5))
    finally:
        _CTX.reset(token)
    assert seen["ctx"] == "parent-run"


# ── Test 7: anthropic / google are untouched (lazy generators, no thread) ─────────────────


@pytest.mark.parametrize("provider, model", [("anthropic", "claude-sonnet-4-6"), ("google", "gemini-3.6-flash")])
async def test_native_providers_do_not_start_a_thread(monkeypatch, provider, model):
    called: list = []
    real = asyncio.to_thread

    async def _recorder(fn, *a, **kw):
        called.append(fn)
        return await real(fn, *a, **kw)

    monkeypatch.setattr(asyncio, "to_thread", _recorder)
    req = GatewayRequest(messages=[], model=model, active_provider_name=provider, tools=[], timeout_s=5)
    stream, mode = await open_stream(provider, req)
    assert mode == CallingMode.NATIVE
    assert called == []
    stream.close()


def test_dispatcher_never_imports_the_agent_loop():
    import inspect

    src = inspect.getsource(dispatcher)
    assert "from app.services.agent_loop" not in src and "import agent_loop" not in src
    assert "run_in_executor" not in src
