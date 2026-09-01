"""Phase 212 (CONN-06 / D-v2.5-01 / SEC-1 / SEC-2) — Unit Tests for MCP Egress Hardening.

Covers:
  - Off-event-loop destination validation via run_in_threadpool
  - TOCTOU DNS-rebinding prevention with IP literal pinning and SNI/Host restoration
  - Transport security invariants: follow_redirects=False, trust_env=False
  - Bounded response stream decoding (MAX_MCP_BODY_BYTES cap)
  - Pre-save tool discovery route POST /api/connectors/discover-tools with live_connectors gate
"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from starlette.concurrency import run_in_threadpool

from app.security.egress import EgressRefused, PinnedDestination
from app.services.mcp_client import (
    MAX_MCP_BODY_BYTES,
    McpClient,
    McpClientError,
    McpProtocolError,
)


@pytest.mark.asyncio
async def test_mcp_destination_validation_runs_off_event_loop(monkeypatch):
    """mcp_client._send_jsonrpc invokes validate_mcp_destination via run_in_threadpool (D-v2.5-01)."""
    client = McpClient()
    called_in_threadpool = False

    orig_threadpool = run_in_threadpool

    def mock_validator(url: str) -> PinnedDestination:
        return PinnedDestination(ip="93.184.216.34", hostname="mcp.example.com", port=443, scheme="https")

    async def tracking_threadpool(func, *args, **kwargs):
        nonlocal called_in_threadpool
        if func == mock_validator:
            called_in_threadpool = True
        return await orig_threadpool(func, *args, **kwargs)

    monkeypatch.setattr("app.services.mcp_client.run_in_threadpool", tracking_threadpool)
    monkeypatch.setattr("app.services.mcp_client.validate_mcp_destination", mock_validator)

    async def mock_post(self, http_client, server_url, headers, payload, server_hostname=None):
        return {"jsonrpc": "2.0", "id": 1, "result": {"tools": []}}

    monkeypatch.setattr(McpClient, "_post", mock_post)
    monkeypatch.setattr(McpClient, "_handshake", AsyncMock())

    await client._send_jsonrpc("https://mcp.example.com/v1/mcp", "tools/list")
    assert called_in_threadpool is True, "validate_mcp_destination must be called via run_in_threadpool"


@pytest.mark.asyncio
async def test_mcp_pinned_ip_rewrites_transport_and_preserves_host(monkeypatch):
    """mcp_client rewrites target host to pinned IP literal while setting Host header and SNI."""
    client = McpClient()

    pinned_mock = PinnedDestination(
        ip="93.184.216.34",
        hostname="mcp.atlassian.com",
        port=443,
        scheme="https",
    )
    monkeypatch.setattr("app.services.mcp_client.validate_mcp_destination", lambda url: pinned_mock)

    captured_url: str | None = None
    captured_headers: dict[str, str] = {}
    captured_hostname: str | None = None

    async def mock_post(self, http_client, server_url, headers, payload, server_hostname=None):
        nonlocal captured_url, captured_headers, captured_hostname
        captured_url = server_url
        captured_headers = dict(headers)
        captured_hostname = server_hostname
        return {"jsonrpc": "2.0", "id": 1, "result": {"status": "ok"}}

    monkeypatch.setattr(McpClient, "_post", mock_post)
    monkeypatch.setattr(McpClient, "_handshake", AsyncMock())

    await client._send_jsonrpc(
        "https://mcp.atlassian.com/v1/mcp",
        "tools/list",
        secret="Bearer secret_token_123",
    )

    assert captured_url is not None
    assert "93.184.216.34" in captured_url, "URL host must be rewritten to pinned IP literal"
    assert captured_headers.get("Host") == "mcp.atlassian.com", "Host header must preserve original hostname"
    assert captured_hostname == "mcp.atlassian.com", "SNI server_hostname must preserve original hostname"


@pytest.mark.asyncio
async def test_mcp_response_byte_cap_exceeded_raises_cleanly():
    """A response exceeding MAX_MCP_BODY_BYTES raises McpClientError."""
    client = McpClient()

    large_content = b"X" * (MAX_MCP_BODY_BYTES + 1024)
    mock_resp = httpx.Response(
        200,
        content=large_content,
        headers={"content-type": "application/json"},
        request=httpx.Request("POST", "https://93.184.216.34/mcp"),
    )

    mock_http_client = AsyncMock()
    mock_http_client.post.return_value = mock_resp

    with pytest.raises(McpClientError) as exc_info:
        await client._post(
            mock_http_client,
            "https://93.184.216.34/mcp",
            headers={"Host": "mcp.example.com"},
            payload={"jsonrpc": "2.0", "method": "tools/list"},
            server_hostname="mcp.example.com",
        )

    assert "exceeded byte cap" in str(exc_info.value)


@pytest.mark.asyncio
async def test_mcp_redirect_raises_egress_refusal():
    """A 3xx redirect from remote MCP server raises McpClientError (redirects forbidden by policy)."""
    client = McpClient()

    mock_resp = httpx.Response(
        302,
        headers={"location": "https://internal.metadata/secret"},
        request=httpx.Request("POST", "https://93.184.216.34/mcp"),
    )

    mock_http_client = AsyncMock()
    mock_http_client.post.return_value = mock_resp

    with pytest.raises(McpClientError) as exc_info:
        await client._post(
            mock_http_client,
            "https://93.184.216.34/mcp",
            headers={"Host": "mcp.example.com"},
            payload={"jsonrpc": "2.0", "method": "tools/list"},
            server_hostname="mcp.example.com",
        )

    assert "redirects forbidden" in str(exc_info.value)


@pytest.mark.asyncio
async def test_mcp_sets_sni_hostname_on_the_actual_request(monkeypatch):
    """⚠ REGRESSION PIN — the pinned request must carry `sni_hostname`, ON THE WIRE.

    Phase 212 shipped the IP-literal pin without it and BROKE ALL MCP DISCOVERY, including
    Phase 206's already-shipped `/connections/{id}/discover`. Driven 2026-08-27 against the
    real `https://mcp.deepwiki.com/mcp`:
        before -> ConnectError [SSL: CERTIFICATE_VERIFY_FAILED] IP address mismatch
        after  -> HTTP 200, 3 tools
    A `Host:` header is NOT a substitute: SNI rides the TLS ClientHello, which is sent before
    any header exists.

    ⚠ WHY THE EXISTING PIN ABOVE DID NOT CATCH IT: `test_mcp_pinned_ip_rewrites_transport_and
    _preserves_host` monkeypatches `_post` AWAY and asserts only that `server_hostname` was
    HANDED to it. `_post` then never used it, and the assertion still passed — its docstring
    says "and SNI" while nothing reads the wire. This test therefore asserts on the real
    `httpx.Request` via a MockTransport, so the effect is pinned rather than the plumbing.
    """
    client = McpClient()

    pinned_mock = PinnedDestination(
        ip="93.184.216.34",
        hostname="mcp.atlassian.com",
        port=443,
        scheme="https",
    )
    monkeypatch.setattr("app.services.mcp_client.validate_mcp_destination", lambda url: pinned_mock)

    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json={"jsonrpc": "2.0", "id": 1, "result": {"tools": []}})

    real_init = httpx.AsyncClient.__init__

    def patched_init(self, *args, **kwargs):
        kwargs["transport"] = httpx.MockTransport(handler)
        real_init(self, *args, **kwargs)

    monkeypatch.setattr(httpx.AsyncClient, "__init__", patched_init)
    # `_post` passes `extensions=` to `client.post`, so MockTransport sees the real Request.

    await client._send_jsonrpc("https://mcp.atlassian.com/v1/mcp", "tools/list")

    assert seen, "no request reached the transport"
    for request in seen:
        assert request.extensions.get("sni_hostname") == "mcp.atlassian.com", (
            "every pinned request must carry sni_hostname, or TLS verification targets the IP "
            "literal and every real HTTPS MCP server fails CERTIFICATE_VERIFY_FAILED"
        )
        assert "93.184.216.34" in str(request.url), "URL must still be pinned to the IP literal"
        assert request.headers.get("Host") == "mcp.atlassian.com"


def test_module_list_tools_accepts_the_exact_keywords_the_route_passes():
    """⚠ SIGNATURE PIN — the route calls `list_tools(server_url=, secret=, timeout=)`.

    `connectors.py:760` passes all three BY KEYWORD. The module wrapper omitted `timeout`
    until 2026-08-27, so `POST /connectors/discover-tools` raised
    `TypeError: list_tools() got an unexpected keyword argument 'timeout'` on every call and
    that route had NEVER succeeded — observed in the operator's own uvicorn traceback.

    ⚠ `test_212_discover_seam.py` did not catch it: it monkeypatches `list_tools` away with a
    stub declaring `timeout=None`, a parameter the real function did not have. This test
    therefore inspects the REAL signature instead of trusting a stub — no mocking, no network.
    """
    import inspect
    from app.services import mcp_client as mod

    sig = inspect.signature(mod.list_tools)
    for kw in ("server_url", "secret", "timeout"):
        assert kw in sig.parameters, (
            f"list_tools must accept {kw!r} by keyword — connectors.py:760 passes it"
        )
    # binding with the route's exact call shape must not raise
    sig.bind(server_url="https://mcp.example.com/mcp", secret=None, timeout=15.0)


# ── the refusal handler · found 2026-09-01 while building Phase 222 ───────────────────


def test_egress_refused_carries_no_detail_attribute_so_the_handler_must_not_read_one():
    """⚠ THIS PINS A REAL DEFECT THAT SHIPPED, and it is a STATIC pin on purpose.

    `discover_tools_from_url` read `exc.detail` inside its `except EgressRefused` handler.
    `EgressRefused.__init__` (`egress.py:190-210`) assigns `reason_code`, `host`,
    `capability` and `ip` — and NOTHING else, deliberately: its own docstring says D-08 is
    *"enforced by the signature, not by discipline"* so that no request body, response body
    or resolved secret can be smuggled onto it.

    So the handler raised `AttributeError` INSIDE the `except`, and FastAPI turned a clean
    422 *"we would not go there"* into a 500. **The security message a person most needs to
    see was the one that broke** — and only on the SSRF path, which is why nothing caught it.

    Driven: constructing the exception and reading `.detail` raises. Asserted against the
    real class rather than a mock, so adding a `detail` field later makes this test fail
    loudly rather than letting the assumption drift back in.
    """
    exc = EgressRefused(reason_code="address_not_public", host="h.example.com", capability="mcp")
    assert exc.reason_code == "address_not_public"
    with pytest.raises(AttributeError):
        _ = exc.detail


def test_the_discover_tools_refusal_handler_reads_only_attributes_that_exist():
    """A source fence over the handler, because the runtime path needs live DNS to reach.

    Every attribute the `except EgressRefused` block reads must be one the class assigns.
    """
    import ast
    import inspect

    from app.api import connectors as conn_module

    source = inspect.getsource(conn_module.discover_tools_from_url)
    tree = ast.parse(source.lstrip())

    assigned = {"reason_code", "host", "capability", "ip", "args"}
    read: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.ExceptHandler) and node.type is not None:
            names = [node.type.id] if isinstance(node.type, ast.Name) else []
            if "EgressRefused" not in names or not node.name:
                continue
            for inner in ast.walk(node):
                if isinstance(inner, ast.Attribute) and isinstance(inner.value, ast.Name):
                    if inner.value.id == node.name:
                        read.add(inner.attr)

    assert read, "the EgressRefused handler was not found — has the route been renamed?"
    assert read <= assigned, (
        f"the handler reads {sorted(read - assigned)} which EgressRefused never assigns; "
        f"that raises AttributeError inside the except and turns a 422 into a 500"
    )
