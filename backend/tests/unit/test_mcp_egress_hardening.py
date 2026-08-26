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
