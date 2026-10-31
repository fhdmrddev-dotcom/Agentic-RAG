"""Phase 305-01 (D-02 / D-41(1) / D-49 / R-25) — the MCP server is stateless across TWO workers.

A real ``uvicorn --workers 2`` serves the real app (boot sweeps off, ``tests/fixtures/phase305/
serve_app.py``) with ``BACKEND_PUBLIC_URL`` set to its own loopback address and a non-production
``ENVIRONMENT``. A real MCP key is minted in the local DB through the app's own mint + insert. Then
20+ request sets, each on a FRESH ``httpx.Client`` (a new TCP connection, so the OS may hand it to
either worker): legacy ``initialize`` -> ``notifications/initialized`` (202) -> ``tools/list``, plus
6+ sets in the modern 2026-07-28 envelope (no handshake). Every response succeeds, none carries
``Mcp-Session-Id``, and the access log (``%(process)d`` per line) shows ``POST /mcp`` served by at
least TWO distinct worker processes — so no request depended on state held by one worker.

Infra: local Postgres :54322, Redis :6379 and the Supabase API (GoTrue, to create the member). A
missing piece SKIPS with the reason (``-rs``), reported NOT RUN — never a pass.

Driven RED: with ``P305_WORKERS=1`` the same suite fails on the ">= 2 PIDs" assertion.
"""
from __future__ import annotations

import os

import httpx
import pytest

from tests.integration import _305_live as live

LEGACY_SETS = 20
MODERN_SETS = 6
WORKERS = int(os.environ.get("P305_WORKERS", "2"))


@pytest.fixture(scope="module")
def server():
    with live.serve(workers=WORKERS) as srv:
        yield srv


def _legacy_set(base: str, key: str) -> list[httpx.Response]:
    with httpx.Client(base_url=base, timeout=30) as c:
        init = c.post("/mcp", headers=live.mcp_headers(key), json=live.initialize_body())
        version = init.json()["result"]["protocolVersion"] if init.status_code == 200 else live.LEGACY
        notified = c.post("/mcp", headers=live.mcp_headers(key, era=version),
                          json={"jsonrpc": "2.0", "method": "notifications/initialized"})
        listed = c.post("/mcp", headers=live.mcp_headers(key, era=version),
                        json={"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}})
    return [init, notified, listed]


def _modern_set(base: str, key: str) -> list[httpx.Response]:
    with httpx.Client(base_url=base, timeout=30) as c:
        listed = c.post(
            "/mcp", headers=live.mcp_headers(key, era=live.MODERN, method="tools/list"),
            json={"jsonrpc": "2.0", "id": 3, "method": "tools/list",
                  "params": {"_meta": dict(live.MODERN_META)}},
        )
    return [listed]


async def test_twenty_fresh_connections_are_served_by_two_workers(server, pg_pool):
    async with live.mcp_world(pg_pool) as w:
        key, _ = await w.mint()
        responses: list[httpx.Response] = []
        for _ in range(LEGACY_SETS):
            responses += _legacy_set(server.base_url, key)
        for _ in range(MODERN_SETS):
            responses += _modern_set(server.base_url, key)

    statuses = [r.status_code for r in responses]
    assert all(s in (200, 202) for s in statuses), statuses
    for r in responses:
        assert "mcp-session-id" not in {k.lower() for k in r.headers}, r.headers
        if r.status_code == 200:
            body = r.json()
            assert "error" not in body, body
    listed = [r for r in responses if r.status_code == 200 and "tools" in r.json().get("result", {})]
    assert len(listed) == LEGACY_SETS + MODERN_SETS

    import time

    time.sleep(1.0)  # let both workers flush their access lines
    pids = sorted({pid for pid, method, path, status in server.access()
                   if method == "POST" and path.split("?")[0] in ("/mcp", "/mcp/")})
    print(f"\n[305-01 two-worker proof] POST /mcp served by worker PIDs: {pids} "
          f"({len(responses)} responses over {LEGACY_SETS + MODERN_SETS} fresh connections)")
    assert len(pids) >= 2, f"only {pids} served POST /mcp — the proof needs two workers"
