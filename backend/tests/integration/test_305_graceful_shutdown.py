"""Phase 305 / D-48 / T-305-22 — an open SSE stream no longer outlives the exit signal.

sse-starlette 3.0.3 (forced by the official ``mcp`` SDK, D-01) moved its exit
event into a ContextVar, so ``AppStatus.handle_exit`` — which runs in uvicorn's
signal context — can no longer reach the event an open stream waits on
(upstream sysid/sse-starlette #149). On 2.4.1 the stream ended 0.00 s after the
signal; on 3.0.3 it stays open until something kills it.

This suite drives the REAL thing in-process (no Docker): a tiny Starlette app
with one never-ending ``EventSourceResponse``, served by ``uvicorn.Server`` as an
asyncio task. A client holds the stream open, ``server.handle_exit(SIGINT)`` is
called, and the serve task must finish within the graceful window + 3 s with the
lifespan shutdown hook having run.

The graceful window is READ FROM backend/Dockerfile's CMD, not hard-coded here:
the proof is about the value the image actually ships. With no
``--timeout-graceful-shutdown`` in the CMD, the window is ``None`` and the
first arm fails (that is how this file was driven RED).

The second arm documents the measured upstream behaviour (no timeout -> the
stream is still open 4 s after the signal). It is the regression the flag
exists for, recorded as an observation, not a failure of ours.
"""

from __future__ import annotations

import asyncio
import contextlib
import re
import signal
import socket
import time
from pathlib import Path

import httpx
import pytest
import uvicorn
from sse_starlette.sse import AppStatus, EventSourceResponse
from starlette.applications import Starlette
from starlette.routing import Route

DOCKERFILE = Path(__file__).resolve().parents[2] / "Dockerfile"


def _shipped_graceful_timeout() -> int | None:
    text = DOCKERFILE.read_text(encoding="utf-8")
    m = re.search(r"--timeout-graceful-shutdown\s+(\d+)", text)
    return int(m.group(1)) if m else None


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _build_app(state: dict) -> Starlette:
    async def endless(request):
        async def gen():
            yield {"data": "open"}
            while True:
                await asyncio.sleep(0.2)
                yield {"data": "tick"}

        return EventSourceResponse(gen())

    @contextlib.asynccontextmanager
    async def lifespan(app):
        yield
        state["lifespan_shutdown_ran"] = True

    return Starlette(routes=[Route("/stream", endless)], lifespan=lifespan)


async def _open_stream(port: int, opened: asyncio.Event, state: dict) -> None:
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            async with client.stream("GET", f"http://127.0.0.1:{port}/stream") as resp:
                async for line in resp.aiter_lines():
                    if line.startswith("data: open"):
                        opened.set()
                    state["last_line_at"] = time.monotonic()
    except Exception:  # noqa: BLE001 — the server cutting the stream is the point
        pass
    finally:
        state["stream_closed_at"] = time.monotonic()


async def _serve_and_signal(timeout_graceful_shutdown: int | None, observe_for: float):
    AppStatus.should_exit = False
    state: dict = {}
    port = _free_port()
    config = uvicorn.Config(
        _build_app(state),
        host="127.0.0.1",
        port=port,
        log_level="warning",
        timeout_graceful_shutdown=timeout_graceful_shutdown,
    )
    server = uvicorn.Server(config)
    serve_task = asyncio.create_task(server.serve())
    for _ in range(100):
        if server.started:
            break
        await asyncio.sleep(0.05)
    assert server.started, "uvicorn never started"

    opened = asyncio.Event()
    reader = asyncio.create_task(_open_stream(port, opened, state))
    await asyncio.wait_for(opened.wait(), timeout=5)

    signalled_at = time.monotonic()
    server.handle_exit(signal.SIGINT, None)
    try:
        await asyncio.wait_for(asyncio.shield(serve_task), timeout=observe_for)
        finished_after = time.monotonic() - signalled_at
    except asyncio.TimeoutError:
        finished_after = None
    stream_open_after_window = "stream_closed_at" not in state
    # Teardown, always: force the server down and drop the client.
    server.force_exit = True
    with contextlib.suppress(Exception):
        await asyncio.wait_for(serve_task, timeout=10)
    reader.cancel()
    with contextlib.suppress(BaseException):
        await reader
    AppStatus.should_exit = False
    return finished_after, stream_open_after_window, state


async def test_shipped_graceful_timeout_ends_an_open_stream():
    window = _shipped_graceful_timeout()
    assert window is not None, (
        "backend/Dockerfile's CMD carries no --timeout-graceful-shutdown; with "
        "sse-starlette 3.0.3 an open stream would hold the container until SIGKILL (D-48)"
    )
    finished_after, _, state = await _serve_and_signal(window, observe_for=window + 3)
    assert finished_after is not None, (
        f"uvicorn was still serving {window + 3}s after the exit signal with a "
        f"--timeout-graceful-shutdown {window}"
    )
    assert finished_after <= window + 3
    assert state.get("lifespan_shutdown_ran") is True, "lifespan shutdown hooks never ran"


async def test_measured_upstream_149_without_a_timeout_the_stream_outlives_the_signal():
    """Observation, not our failure: sse-starlette 3.0.3 + no graceful timeout.

    This is the regression (sysid/sse-starlette #149) the Dockerfile flag exists
    for. If this ever stops holding, upstream fixed it in a 3.0.x and the flag can
    be revisited — it does not make the flag wrong.
    """
    finished_after, stream_open, _ = await _serve_and_signal(None, observe_for=4)
    assert finished_after is None and stream_open, (
        "sse-starlette now ends open streams on the exit signal — the #149 "
        "regression no longer reproduces; revisit D-48's graceful-timeout note"
    )
