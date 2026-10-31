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
    stub_accounting(monkeypatch)
    return resolver


def stub_accounting(monkeypatch) -> list[dict]:
    """305-03: keep the REAL per-key limits and audit code running, on a fake Redis and the
    settings defaults, with the audit writer replaced by a recorder. Returns the recorded rows."""
    import app.mcp.dispatch as dispatch
    from app.models.user_settings import _build_settings_from_row
    from app.security import api_key_auth
    from app.services import rate_limit
    from tests.unit.phase293_inbound_fakes import FakeRedis

    rows: list[dict] = []
    fake = FakeRedis()

    async def _load():
        return _build_settings_from_row({})

    async def _write(user_id, action_type, metadata, org_id):
        rows.append({"action_type": action_type, "metadata": metadata, "org_id": org_id})

    async def _write_293(user_id, action_type, metadata, supabase, org_id=None):
        rows.append({"action_type": action_type, "metadata": metadata, "org_id": org_id})

    import app.mcp.audit as mcp_audit

    monkeypatch.setattr(dispatch, "get_redis", lambda: fake)
    monkeypatch.setattr(rate_limit, "load_app_settings_async", _load)
    # BUG-261031-04: dispatch's row is one asyncpg INSERT (``insert_audit_row``); the 293 writer
    # stays recorded too, for the resolver's own refusal rows.
    monkeypatch.setattr(mcp_audit, "insert_audit_row", _write)
    monkeypatch.setattr(api_key_auth, "write_audit_entry", _write_293)
    monkeypatch.setattr(api_key_auth, "get_service_role_supabase", lambda org: object())

    async def _pii_off(org_id):  # 305-04: the org's redaction switch reads OFF (its default)
        return False

    monkeypatch.setattr(dispatch, "_pii_on", _pii_off)
    stub_usage(monkeypatch)
    return rows


def stub_usage(monkeypatch) -> list[dict]:
    """305-03: record the ``mcp_usage`` rows an expensive tool would write, with no database."""
    import app.mcp.dispatch as dispatch
    from app.models.user_settings import _build_settings_from_row

    written: list[dict] = []

    async def _pool():
        return object()

    async def _insert(pool, **row):
        written.append(row)
        return "usage-id"

    monkeypatch.setattr(dispatch, "get_pg_pool", _pool)
    monkeypatch.setattr(dispatch, "insert_usage", _insert)
    monkeypatch.setattr(dispatch, "load_user_settings", lambda uid: _build_settings_from_row({}))
    return written


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
