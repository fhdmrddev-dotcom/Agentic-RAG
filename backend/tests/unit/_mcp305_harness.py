"""Phase 305-01 — the shared harness for the ``test_305_*`` transport suites.

Every suite builds a FRESH Starlette app with ``register_mcp`` + ``mcp_lifespan`` (the SEED-363
fresh-app rule: never mutate ``app.main.app``), stubs the edge's Redis / pool / IP limiter, and
injects its own ``ToolSpec`` into ``app.mcp.tools.REGISTERED`` with ``monkeypatch.setitem`` — so
nothing here depends on the three read tools 305-02 adds.

The edge resolves through ``app.security.mcp_principal.resolve_mcp_principal`` (the one resolver
core). ``stub_edge`` replaces it with a recorder returning a fixed principal unless a suite passes
its own.
"""
from __future__ import annotations

import contextlib
from typing import Any

from pydantic import BaseModel
from starlette.applications import Starlette

from app.security.mcp_principal import McpPrincipal

BASE = "http://localhost:8000"
KEY = "srl_mcp_" + "A" * 43
KEY_ORG = "11111111-1111-4111-8111-111111111111"

PRINCIPAL = McpPrincipal(
    key_id="22222222-2222-4222-8222-222222222222",
    user_id="33333333-3333-4333-8333-333333333333",
    org_id=KEY_ORG,
    folder_ids=None,
    tools=("t_read", "t_write", "t_boom", "t_org"),
    include_external=False,
)

LEGACY = "2025-11-25"
MODERN = "2026-07-28"
_ACCEPT = "application/json, text/event-stream"


def configure(monkeypatch, *, base: str | None = BASE, env: str = "") -> None:
    from app.config import settings

    monkeypatch.setattr(settings, "backend_public_url", base, raising=False)
    monkeypatch.setattr(settings, "environment", env, raising=False)


def fresh_app() -> Starlette:
    from app.mcp import mcp_lifespan, register_mcp

    @contextlib.asynccontextmanager
    async def lifespan(_app):
        async with mcp_lifespan():
            yield

    application = Starlette(routes=[], lifespan=lifespan)
    register_mcp(application)
    return application


class Recorder:
    def __init__(self, principal: McpPrincipal | None = PRINCIPAL, exc: BaseException | None = None):
        self.principal = principal
        self.exc = exc
        self.calls: list[str] = []

    async def __call__(self, presented, *, pool, redis):
        self.calls.append(presented)
        if self.exc is not None:
            raise self.exc
        return self.principal


def stub_edge(monkeypatch, resolver=None) -> Any:
    """Stub the edge's Redis, pool and IP limiter; return the resolver in use."""
    import app.mcp.edge as edge
    from app.security import mcp_principal
    from app.services import rate_limit

    async def _pool():
        return object()

    async def _ip_ok(redis, *, client):
        return None

    monkeypatch.setattr(edge, "get_redis", lambda: object())
    monkeypatch.setattr(edge, "get_pg_pool", _pool)
    monkeypatch.setattr(rate_limit, "check_ip_limit", _ip_ok)
    resolver = resolver if resolver is not None else Recorder()
    monkeypatch.setattr(mcp_principal, "resolve_mcp_principal", resolver)
    return resolver


class NoArgs(BaseModel):
    pass


class NeedsQuery(BaseModel):
    query: str
    limit: int = 8


def make_spec(name: str, handler, *, read_only: bool = True, args_model=NoArgs):
    from mcp import types

    from app.mcp.tools import READ_ONLY, ToolSpec

    annotations = READ_ONLY if read_only else types.ToolAnnotations(
        read_only_hint=False, destructive_hint=False, idempotent_hint=False, open_world_hint=False
    )
    return ToolSpec(
        tool=types.Tool(
            name=name,
            title=f"Test tool {name}",
            description="A test-only tool.",
            input_schema=args_model.model_json_schema(),
            annotations=annotations,
        ),
        args_model=args_model,
        handler=handler,
        bucket="cheap",
    )


def text_result(text: str):
    from mcp import types

    return types.CallToolResult(content=[types.TextContent(type="text", text=text)])


def headers(*, era: str | None = None, method: str | None = None, name: str | None = None,
            key: str | None = KEY, extra: dict | None = None) -> dict:
    h = {"accept": _ACCEPT, "content-type": "application/json"}
    if key is not None:
        h["authorization"] = f"Bearer {key}"
    if era is not None:
        h["mcp-protocol-version"] = era
    if era == MODERN and method is not None:
        h["mcp-method"] = method
        if name is not None:
            h["mcp-name"] = name
    if extra:
        h.update(extra)
    return h


def initialize_body(rid: int = 1) -> dict:
    return {
        "jsonrpc": "2.0", "id": rid, "method": "initialize",
        "params": {"protocolVersion": LEGACY, "capabilities": {},
                   "clientInfo": {"name": "test-305", "version": "1"}},
    }


_MODERN_META = {
    "io.modelcontextprotocol/protocolVersion": MODERN,
    "io.modelcontextprotocol/clientInfo": {"name": "test-305", "version": "1"},
    "io.modelcontextprotocol/clientCapabilities": {},
}


def rpc(method: str, params: dict | None = None, *, rid: int = 2, era: str = LEGACY) -> dict:
    p = dict(params or {})
    if era == MODERN:
        p["_meta"] = dict(_MODERN_META)
    return {"jsonrpc": "2.0", "id": rid, "method": method, "params": p}


def call(client, name: str, arguments: dict | None = None, *, era: str = LEGACY,
         extra_headers: dict | None = None, path: str = "/mcp"):
    body = rpc("tools/call", {"name": name, "arguments": arguments or {}}, era=era)
    return client.post(path, headers=headers(era=era, method="tools/call", name=name, extra=extra_headers),
                       json=body)


def list_tools(client, *, era: str = LEGACY):
    return client.post("/mcp", headers=headers(era=era, method="tools/list"),
                       json=rpc("tools/list", era=era))
