"""Phase 282 Plan 01 (FIX-06; D-09 part 2) — SCALED real-socket proof that the operator's timeout
is the one that applies, end to end.

⚠ SCALED. The production claim is "a model that answers in 700 s completes under a 900 s setting,
where the SDK's shipped 600 s default would have cut it". Running that literally would take a
quarter of an hour, so every number is scaled down and the INEQUALITY is preserved:

    old SDK default  <  the model's answer time  <  the operator's setting
          600 s      <          700 s            <         900 s        (production)
          1 s        <          2 s              <         3 s          (this file)

The SDK default is patched to 1 s (``openai._base_client.DEFAULT_TIMEOUT``, applied when a client
is built with no ``timeout``), so a client that ignored the setting would be cut at 1 s and these
tests would fail. Everything below the patch is real: a ThreadingHTTPServer on 127.0.0.1, the real
``dispatcher.open_stream``, the real OpenAI SDK, and the real ``_drain_stream_with_close_on_cancel``.

SC#2 rides in the third case: a self-hosted model that never answers within its setting makes
EXACTLY ONE request — no SDK retry multiplies the operator's wait.
"""
from __future__ import annotations

import asyncio
import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import httpx
import pytest

from app.config import settings
from app.services.agent_loop import _drain_stream_with_close_on_cancel
from app.services.provider_gateway.dispatcher import GatewayRequest, open_stream

_SETTING_S = 3  # stands in for the operator's 900 s
_ANSWER_S = 2.0  # stands in for the model's 700 s
_SDK_DEFAULT_S = 1.0  # stands in for the SDK's shipped 600 s


class _StubServer(ThreadingHTTPServer):
    daemon_threads = True
    header_delay = 0.0
    chunk_gap = 0.0
    hits = 0


class _Handler(BaseHTTPRequestHandler):
    def do_POST(self):  # noqa: N802
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

    def log_message(self, *args):
        pass


@pytest.fixture
def stub(monkeypatch):
    # The SDK default, scaled: a client built WITHOUT the operator's timeout reads 1 s.
    monkeypatch.setattr(
        "openai._base_client.DEFAULT_TIMEOUT", httpx.Timeout(_SDK_DEFAULT_S, connect=_SDK_DEFAULT_S)
    )
    server = _StubServer(("127.0.0.1", 0), _Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    monkeypatch.setattr(settings, "llm_base_url", f"http://127.0.0.1:{server.server_address[1]}/v1")
    monkeypatch.setattr(settings, "llm_api_key", "stub-key")
    yield server
    server.shutdown()
    server.server_close()


def _req(provider="lmstudio"):
    return GatewayRequest(
        messages=[{"role": "user", "content": "hi"}],
        model="stub-model",
        active_provider_name=provider,
        tools=[],
        timeout_s=_SETTING_S,
    )


async def _run_once(provider="lmstudio") -> str:
    """The agent loop's own two steps: open under the budget, then drain under it."""
    stream, _mode = await open_stream(provider, _req(provider))
    text: list[str] = []

    async def _on_chunk(chunk):
        if isinstance(chunk, dict) and chunk.get("type") == "delta":
            text.append(chunk.get("content", ""))

    await _drain_stream_with_close_on_cancel(stream, _SETTING_S, _on_chunk, close_fn=stream.close)
    return "".join(text)


async def test_slow_headers_complete_under_the_setting(stub):
    """Headers after 2 s: cut at 1 s by the SDK default, completes under the 3 s setting."""
    stub.header_delay = _ANSWER_S
    t0 = time.perf_counter()
    content = await _run_once()
    elapsed = time.perf_counter() - t0
    print(f"MEASURED headers_case elapsed_s={elapsed:.3f} hits={stub.hits}")
    assert content == "hello"
    assert stub.hits == 1


async def test_slow_gap_between_chunks_completes_under_the_setting(stub):
    """A 2 s silence MID-STREAM: the read timeout is per read, so the setting governs it too."""
    stub.chunk_gap = _ANSWER_S
    t0 = time.perf_counter()
    content = await _run_once()
    elapsed = time.perf_counter() - t0
    print(f"MEASURED gap_case elapsed_s={elapsed:.3f} hits={stub.hits}")
    assert content == "hello"
    assert stub.hits == 1


async def test_self_hosted_timeout_is_one_request_at_the_setting(stub):
    """4 s headers on lmstudio: TimeoutError at ~3 s (the setting), and exactly ONE server hit."""
    stub.header_delay = 4.0
    t0 = time.perf_counter()
    with pytest.raises(TimeoutError):
        await _run_once("lmstudio")
    elapsed = time.perf_counter() - t0
    # Give a would-be SDK retry time to land before counting hits.
    await asyncio.sleep(2.0)
    print(f"MEASURED self_hosted_timeout elapsed_s={elapsed:.3f} hits={stub.hits}")
    assert elapsed < 3.6
    assert stub.hits == 1
