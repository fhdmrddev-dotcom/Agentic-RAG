"""Phase 305-02 — drive the REAL ``/mcp`` path in-process with a real minted key.

``mcp_session(monkeypatch, secret)`` builds an app with the production seams — ``register_mcp`` +
``mcp_lifespan`` (the same two names ``app.main`` uses), so the request goes through the real
``McpEdge``, the ONE resolver (``resolve_mcp_principal`` against the local Postgres, the key the
test minted), the real lowlevel server, ``dispatch`` and the three read tools — and runs its
lifespan, then posts JSON-RPC over ``httpx.ASGITransport`` with ``Authorization: Bearer <secret>``.

Why not ``app.main.app`` in-process: its lifespan starts the scheduler, the template sweep and the
other loops that CLAIM shared work in the local database the operator's own backend is using
(SEED-363). The full app is still proven end to end by the spawned-uvicorn suites
(``test_305_two_worker_stateless`` now calls ``list_documents`` through it on two workers).
In-process is what lets a test stub the query embedder (``patch_search``) — a spawned server
cannot be monkeypatched.

Stubbed here, and only here: the edge's Redis (a fake, so the per-address limiter and the
resolver's liveness cache never touch the shared Redis). The pool, the key, the RLS and every read
are real. ⛔ No role-``anon`` statement (BUG-261031-01).
"""
from __future__ import annotations

import contextlib
import json
from dataclasses import dataclass
from typing import Any

import httpx

BASE = "http://localhost:8000"
LEGACY = "2025-11-25"
_ACCEPT = "application/json, text/event-stream"
RID = 7  # every call uses the same JSON-RPC id, so two bodies can be compared byte for byte


@dataclass
class McpReply:
    status: int
    raw: bytes
    body: dict

    @property
    def result(self) -> dict:
        return self.body.get("result") or {}

    @property
    def is_error(self) -> bool:
        return bool(self.result.get("isError"))

    @property
    def text(self) -> str:
        return "".join(c.get("text", "") for c in self.result.get("content") or [])

    @property
    def structured(self) -> Any:
        return self.result.get("structuredContent")

    def without_id(self) -> dict:
        return {k: v for k, v in self.body.items() if k != "id"}


class McpCaller:
    def __init__(self, client: httpx.AsyncClient, secret: str):
        self._client = client
        self._secret = secret

    def _headers(self) -> dict:
        return {"accept": _ACCEPT, "content-type": "application/json",
                "authorization": f"Bearer {self._secret}", "mcp-protocol-version": LEGACY}

    async def post(self, payload: dict) -> McpReply:
        r = await self._client.post("/mcp", headers=self._headers(), json=payload)
        body = json.loads(r.content) if r.content else {}
        return McpReply(status=r.status_code, raw=r.content, body=body)

    async def initialize(self) -> McpReply:
        return await self.post({
            "jsonrpc": "2.0", "id": 1, "method": "initialize",
            "params": {"protocolVersion": LEGACY, "capabilities": {},
                       "clientInfo": {"name": "test-305-02", "version": "1"}},
        })

    async def list_tools(self) -> list[dict]:
        reply = await self.post({"jsonrpc": "2.0", "id": RID, "method": "tools/list", "params": {}})
        assert reply.status == 200 and "error" not in reply.body, reply.body
        return reply.result["tools"]

    async def tool(self, name: str, arguments: dict | None = None) -> McpReply:
        reply = await self.post({"jsonrpc": "2.0", "id": RID, "method": "tools/call",
                                 "params": {"name": name, "arguments": arguments or {}}})
        assert reply.status == 200, (reply.status, reply.raw[:500])
        return reply


def mcp_app():
    from starlette.applications import Starlette

    from app.mcp import mcp_lifespan, register_mcp

    @contextlib.asynccontextmanager
    async def lifespan(_app):
        async with mcp_lifespan():
            yield

    application = Starlette(routes=[], lifespan=lifespan)
    register_mcp(application)
    return application


@contextlib.asynccontextmanager
async def mcp_session(monkeypatch, secret: str):
    import app.mcp.dispatch as dispatch
    import app.mcp.edge as edge
    from app.config import settings
    from app.security import api_key_auth
    from tests.integration._271_gotrue_users import _admin
    from tests.unit.phase293_inbound_fakes import FakeRedis

    monkeypatch.setattr(settings, "backend_public_url", BASE, raising=False)
    monkeypatch.setattr(settings, "environment", "", raising=False)
    fake = FakeRedis()
    monkeypatch.setattr(edge, "get_redis", lambda: fake)
    # 305-03: the per-key buckets and the refusal throttle count on the same fake, and the audit
    # row goes to the LOCAL stack (the unit conftest points ``settings`` at a placeholder project).
    monkeypatch.setattr(dispatch, "get_redis", lambda: fake)
    monkeypatch.setattr(api_key_auth, "get_service_role_supabase", lambda org: _admin())
    application = mcp_app()
    async with application.router.lifespan_context(application):
        transport = httpx.ASGITransport(app=application)
        async with httpx.AsyncClient(transport=transport, base_url=BASE, timeout=60) as client:
            caller = McpCaller(client, secret)
            init = await caller.initialize()
            assert init.status == 200 and "result" in init.body, (init.status, init.raw[:500])
            yield caller
