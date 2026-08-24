"""Phase 206 (CONN-02 / CONN-03) — Unit & Integration Test Suite for MCP Connectors.

Covers:
  - SSRF Destination Validation (T-206-01 / D-206-04)
  - MCP Client Operations (tools/list, tools/call, JSON-RPC 2.0, Auth headers)
  - Tool Discovery & Grant Management (F-1 / D-206-05 / D-206-06)
  - Workflow Engine Execution with Per-Tool Permission Grants & Audit Logging (F-3)
"""

from __future__ import annotations

import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.models.connector import (
    ConnectorConnectionCreate,
    ConnectorConnectionResponse,
    ConnectorConnectionUpdate,
    McpConfig,
)
from app.models.harness import ExternalActionPhaseConfig
from app.security.egress import EgressRefused, validate_mcp_destination
from app.services.connector_service import ResolvedConnection
from app.services.harness.phase_types import _exec_external_action
from app.services.mcp_client import (
    McpClient,
    McpClientError,
    McpProtocolError,
)

# ══════════════════════════════════════════════════════════════════════════════════════════
# 1 · SSRF EGRESS DEFENSE TESTS (T-206-01 / D-206-04)
# ══════════════════════════════════════════════════════════════════════════════════════════


def test_mcp_egress_allows_public_https_destination():
    """Valid public HTTPS destinations pass egress validation."""
    dest = validate_mcp_destination(
        "https://mcp.atlassian.com/v1/mcp",
        resolver=lambda host, port: ["93.184.216.34"],
    )
    assert dest.hostname == "mcp.atlassian.com"
    assert dest.ip == "93.184.216.34"
    assert dest.scheme == "https"
    assert dest.port == 443


def test_mcp_egress_refuses_loopback():
    """Loopback addresses (127.0.0.1, ::1) are strictly refused."""
    with pytest.raises(EgressRefused) as exc_info:
        validate_mcp_destination(
            "https://localhost/mcp",
            resolver=lambda host, port: ["127.0.0.1"],
        )
    assert exc_info.value.reason_code == "address_not_public"


def test_mcp_egress_refuses_private_subnets():
    """RFC1918 subnets (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16) are refused."""
    for private_ip in ("10.0.1.5", "172.16.0.10", "192.168.1.1"):
        with pytest.raises(EgressRefused) as exc_info:
            validate_mcp_destination(
                "https://internal.corp/mcp",
                resolver=lambda host, port: [private_ip],
            )
        assert exc_info.value.reason_code == "address_not_public"


def test_mcp_egress_refuses_cloud_metadata():
    """AWS/GCP cloud metadata IP (169.254.169.254) is refused."""
    with pytest.raises(EgressRefused) as exc_info:
        validate_mcp_destination(
            "https://metadata.google.internal/computeMetadata/v1",
            resolver=lambda host, port: ["169.254.169.254"],
        )
    assert exc_info.value.reason_code == "address_not_public"


def test_mcp_egress_refuses_unresolvable_host():
    """A host that fails DNS resolution raises unresolvable EgressRefused."""
    with pytest.raises(EgressRefused) as exc_info:
        validate_mcp_destination(
            "https://does-not-exist-at-all-xyz123.com/mcp",
            resolver=lambda host, port: [],
        )
    assert exc_info.value.reason_code == "unresolvable"


# ══════════════════════════════════════════════════════════════════════════════════════════
# 2 · MCP CLIENT PROTOCOL TESTS (app.services.mcp_client)
# ══════════════════════════════════════════════════════════════════════════════════════════


def test_mcp_client_auth_headers():
    """Builds appropriate Authorization headers from secret."""
    # Bearer token
    headers_bearer = McpClient._build_auth_headers("ghp_SecretGitHubToken123")
    assert headers_bearer["Authorization"] == "Bearer ghp_SecretGitHubToken123"

    # Basic auth username:token (e.g. Jira email:token)
    headers_basic = McpClient._build_auth_headers("user@example.com:api_token_xyz")
    assert headers_basic["Authorization"].startswith("Basic ")

    # Empty secret
    headers_empty = McpClient._build_auth_headers("")
    assert "Authorization" not in headers_empty


@pytest.mark.asyncio
async def test_mcp_client_list_tools(monkeypatch):
    """list_tools issues tools/list JSON-RPC call and parses tool schemas."""
    # Bypass DNS resolution for unit test
    monkeypatch.setattr("app.services.mcp_client.validate_mcp_destination", lambda url: None)

    mock_tools_response = {
        "jsonrpc": "2.0",
        "id": 1,
        "result": {
            "tools": [
                {
                    "name": "jira_create_issue",
                    "description": "Create a new Jira issue",
                    "inputSchema": {
                        "type": "object",
                        "properties": {"summary": {"type": "string"}},
                    },
                },
                {
                    "name": "github_create_pr",
                    "description": "Create a pull request",
                },
            ]
        },
    }

    seen_methods: list[str] = []

    async def mock_post(url, json=None, headers=None):
        seen_methods.append(json["method"])
        if json["method"] == "initialize":
            return httpx.Response(
                200,
                json={"jsonrpc": "2.0", "id": 0, "result": {"protocolVersion": "2025-06-18"}},
                headers={"Mcp-Session-Id": "sess-abc"},
                request=httpx.Request("POST", url),
            )
        if json["method"].startswith("notifications/"):
            return httpx.Response(202, request=httpx.Request("POST", url))
        # Every post after `initialize` must echo the session id the server issued.
        assert headers.get("Mcp-Session-Id") == "sess-abc", (
            f"the session id was not carried onto {json['method']!r}: {headers!r}"
        )
        return httpx.Response(200, json=mock_tools_response, request=httpx.Request("POST", url))

    client = McpClient()
    with patch("httpx.AsyncClient.post", side_effect=mock_post):
        tools = await client.list_tools("https://mcp.atlassian.com/v1", secret="test-token")

    assert seen_methods == ["initialize", "notifications/initialized", "tools/list"], (
        f"the spec's handshake must precede the call, in order: {seen_methods!r}"
    )

    assert len(tools) == 2
    assert tools[0]["name"] == "jira_create_issue"
    assert tools[0]["description"] == "Create a new Jira issue"
    assert tools[0]["inputSchema"]["type"] == "object"
    assert tools[1]["name"] == "github_create_pr"


@pytest.mark.asyncio
async def test_mcp_client_call_tool(monkeypatch):
    """call_tool issues tools/call JSON-RPC call and parses results."""
    monkeypatch.setattr("app.services.mcp_client.validate_mcp_destination", lambda url: None)

    mock_call_response = {
        "jsonrpc": "2.0",
        "id": 1,
        "result": {
            "content": [
                {"type": "text", "text": "Created issue PROJ-1234 successfully."}
            ],
            "isError": False,
        },
    }

    async def mock_post(url, json=None, headers=None):
        # WARNING - THIS ASSERTED `json["method"] == "tools/call"` ON EVERY POST, WHICH IS
        # WHY ADDING THE SPEC-REQUIRED HANDSHAKE TURNED IT RED. The fixture modelled a server
        # that needs no `initialize`; no such MCP server exists. Routing by method is what
        # makes the fixture a server rather than an echo.
        if json["method"] == "initialize":
            return httpx.Response(
                200,
                json={"jsonrpc": "2.0", "id": 0, "result": {}},
                request=httpx.Request("POST", url),
            )
        if json["method"].startswith("notifications/"):
            return httpx.Response(202, request=httpx.Request("POST", url))
        assert json["method"] == "tools/call"
        assert json["params"]["name"] == "jira_create_issue"
        assert json["params"]["arguments"] == {"summary": "Fix login crash"}
        return httpx.Response(200, json=mock_call_response, request=httpx.Request("POST", url))

    client = McpClient()
    with patch("httpx.AsyncClient.post", side_effect=mock_post):
        result = await client.call_tool(
            "https://mcp.atlassian.com/v1",
            tool_name="jira_create_issue",
            arguments={"summary": "Fix login crash"},
            secret="test-token",
        )

    assert result["text"] == "Created issue PROJ-1234 successfully."
    assert result["isError"] is False


@pytest.mark.asyncio
async def test_mcp_client_protocol_error(monkeypatch):
    """Remote JSON-RPC errors raise McpProtocolError."""
    monkeypatch.setattr("app.services.mcp_client.validate_mcp_destination", lambda url: None)

    mock_err_response = {
        "jsonrpc": "2.0",
        "id": 1,
        "error": {
            "code": -32601,
            "message": "Method not found",
        },
    }

    async def mock_post(url, json=None, headers=None):
        if json["method"] == "initialize":
            return httpx.Response(
                200, json={"jsonrpc": "2.0", "id": 0, "result": {}},
                request=httpx.Request("POST", url),
            )
        if json["method"].startswith("notifications/"):
            return httpx.Response(202, request=httpx.Request("POST", url))
        return httpx.Response(200, json=mock_err_response, request=httpx.Request("POST", url))

    client = McpClient()
    with patch("httpx.AsyncClient.post", side_effect=mock_post):
        with pytest.raises(McpProtocolError) as exc_info:
            await client.call_tool("https://mcp.atlassian.com/v1", "unknown_tool", {})
        assert exc_info.value.code == -32601




@pytest.mark.asyncio
async def test_mcp_client_reads_the_streamable_http_sse_transport(monkeypatch):
    """THE REGRESSION TEST FOR THE ONE DEFECT TWELVE GREEN UNIT TESTS COULD NOT SEE.

    Every fixture above hands the client `application/json`. A real MCP server does not:
    the *Streamable HTTP* transport answers a POST with `Content-Type: text/event-stream`
    and frames the JSON-RPC body in SSE `data:` lines. The first version of the client
    called `response.json()` and nothing else, so it raised
    `McpProtocolError: Invalid JSON response ... event: message / data: {...}` against
    `https://mcp.deepwiki.com/mcp` on 2026-08-25 while this whole file was green.

    The tell was in the client's own headers all along: it already sent
    `Accept: application/json, text/event-stream`, i.e. it ASKED for a transport it could
    not read. Atlassian's and GitHub's official servers - the two this phase exists to
    reach - both use it.

    The frame below is deliberately awkward in the ways a real stream is: a comment line,
    an `event:` line, a retry line and a trailing blank. A parser that merely strips a
    fixed prefix off `response.text` passes a tidy fixture and fails a real one.
    """
    monkeypatch.setattr("app.services.mcp_client.validate_mcp_destination", lambda url: None)

    sse_body = (
        ": keep-alive\n"
        "retry: 3000\n"
        "event: message\n"
        'data: {"jsonrpc":"2.0","id":1,"result":{"tools":['
        '{"name":"ask_question","description":"Ask a question",'
        '"inputSchema":{"type":"object","properties":{}}}]}}\n'
        "\n"
    )

    async def mock_post(url, json=None, headers=None):
        assert "text/event-stream" in headers.get("Accept", ""), (
            "the client must ASK for the transport it can read"
        )
        if json["method"] == "initialize":
            return httpx.Response(
                200, json={"jsonrpc": "2.0", "id": 0, "result": {}},
                request=httpx.Request("POST", url),
            )
        if json["method"].startswith("notifications/"):
            return httpx.Response(202, request=httpx.Request("POST", url))
        return httpx.Response(
            200,
            content=sse_body.encode("utf-8"),
            headers={"Content-Type": "text/event-stream; charset=utf-8"},
            request=httpx.Request("POST", url),
        )

    client = McpClient()
    with patch("httpx.AsyncClient.post", side_effect=mock_post):
        tools = await client.list_tools("https://mcp.example.com/mcp")

    assert [t["name"] for t in tools] == ["ask_question"], (
        f"the SSE-framed tool list was not decoded: {tools!r}"
    )


@pytest.mark.asyncio
async def test_mcp_client_refuses_an_event_stream_with_no_json_frame(monkeypatch):
    """Anti-vacuity for the test above: an event-stream carrying NO JSON-RPC frame is an
    error, not an empty success. Without this, a parser that returned `{}` for any
    `text/event-stream` body would pass the SSE test and silently report zero tools for
    every real server."""
    monkeypatch.setattr("app.services.mcp_client.validate_mcp_destination", lambda url: None)

    async def mock_post(url, json=None, headers=None):
        if json["method"] == "initialize":
            return httpx.Response(
                200, json={"jsonrpc": "2.0", "id": 0, "result": {}},
                request=httpx.Request("POST", url),
            )
        if json["method"].startswith("notifications/"):
            return httpx.Response(202, request=httpx.Request("POST", url))
        return httpx.Response(
            200,
            content=b": keep-alive\nevent: ping\n\n",
            headers={"Content-Type": "text/event-stream"},
            request=httpx.Request("POST", url),
        )

    client = McpClient()
    with patch("httpx.AsyncClient.post", side_effect=mock_post):
        with pytest.raises(McpProtocolError):
            await client.list_tools("https://mcp.example.com/mcp")

# ══════════════════════════════════════════════════════════════════════════════════════════
# 3 · MODEL VALIDATION & PERMISSION GRANTS (F-1 / D-206-06)
# ══════════════════════════════════════════════════════════════════════════════════════════


def test_connector_connection_create_mcp_model():
    """ConnectorConnectionCreate accepts mcp_server_url and tool_grants."""
    req = ConnectorConnectionCreate(
        name="GitHub MCP",
        mcp_server_url="https://api.github.com/mcp",
        tool_grants={"github_create_issue": True, "github_delete_repo": False},
        secret="ghp_test123",
    )
    assert req.mcp_server_url == "https://api.github.com/mcp"
    assert req.tool_grants["github_create_issue"] is True
    assert req.tool_grants["github_delete_repo"] is False


def test_external_action_phase_config_mcp_fields():
    """ExternalActionPhaseConfig carries tool_name and tool_args."""
    config = ExternalActionPhaseConfig(
        phase_type="external_action",
        connection_id="conn-uuid-1",
        tool_name="jira_create_issue",
        tool_args={"summary": "Automated ticket"},
    )
    assert config.tool_name == "jira_create_issue"
    assert config.tool_args == {"summary": "Automated ticket"}
    assert config.available_tools == ["jira_create_issue"]


# ══════════════════════════════════════════════════════════════════════════════════════════
# 4 · WORKFLOW ENGINE MCP DISPATCH & AUDIT LOGGING (F-1 / F-3 / D-206-06)
# ══════════════════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_exec_external_action_mcp_granted(monkeypatch):
    """When tool is granted, _exec_external_action calls mcp_client and succeeds."""
    org_id = "00000000-0000-0000-0000-000000000001"
    connection_id = "11111111-1111-1111-1111-111111111111"

    resolved = ResolvedConnection(
        connection_id=connection_id,
        org_id=org_id,
        capability=None,
        name="Atlassian Provider",
        config={},
        secret_ciphertext="enc:v1:fake",
        mcp_server_url="https://mcp.atlassian.com/v1",
        tool_grants={"jira_create_issue": True},
    )

    monkeypatch.setattr(
        "app.services.harness.phase_types.resolve_connection",
        AsyncMock(return_value=resolved),
    )
    monkeypatch.setattr(
        "app.services.harness.phase_types.ensure_settings_fresh",
        AsyncMock(return_value=None),
    )
    monkeypatch.setattr(
        "app.services.harness.phase_types.feature_audience",
        lambda feat: "everyone",
    )
    monkeypatch.setattr(
        "app.services.harness.phase_types._write_send_receipt",
        AsyncMock(),
    )

    # Mock mcp_client.call_tool
    mock_call = AsyncMock(return_value={"text": "Ticket PROJ-99 created", "isError": False})
    monkeypatch.setattr("app.services.mcp_client.call_tool", mock_call)
    monkeypatch.setattr(
        ResolvedConnection, "secret", property(lambda self: "decrypted_token")
    )

    phase = SimpleNamespace(
        slug="create-jira",
        config=ExternalActionPhaseConfig(
            phase_type="external_action",
            connection_id=connection_id,
            tool_name="jira_create_issue",
            tool_args={"summary": "Deploy failed"},
        ),
    )
    ctx = SimpleNamespace(
        org_id=org_id,
        run_id="run-1",
        workflow_id="wf-1",
        is_golden_run=False,
    )

    result = await _exec_external_action(phase, {}, ctx)
    assert result["text"] == "Ticket PROJ-99 created"
    assert "failure" not in result


@pytest.mark.asyncio
async def test_exec_external_action_mcp_permission_denied_emits_audit(monkeypatch):
    """When tool is NOT granted, _exec_external_action refuses and emits tool_refused audit event."""
    org_id = "00000000-0000-0000-0000-000000000001"
    connection_id = "11111111-1111-1111-1111-111111111111"

    resolved = ResolvedConnection(
        connection_id=connection_id,
        org_id=org_id,
        capability=None,
        name="Atlassian Provider",
        config={},
        secret_ciphertext="enc:v1:fake",
        mcp_server_url="https://mcp.atlassian.com/v1",
        tool_grants={"jira_create_issue": False},  # Denied (F-1)
    )

    monkeypatch.setattr(
        "app.services.harness.phase_types.resolve_connection",
        AsyncMock(return_value=resolved),
    )
    monkeypatch.setattr(
        "app.services.harness.phase_types.ensure_settings_fresh",
        AsyncMock(return_value=None),
    )
    monkeypatch.setattr(
        "app.services.harness.phase_types.feature_audience",
        lambda feat: "everyone",
    )

    mock_audit = AsyncMock()
    monkeypatch.setattr("app.services.harness.phase_types.write_audit", mock_audit)

    phase = SimpleNamespace(
        slug="create-jira",
        config=ExternalActionPhaseConfig(
            phase_type="external_action",
            connection_id=connection_id,
            tool_name="jira_create_issue",
            tool_args={"summary": "Deploy failed"},
        ),
    )
    ctx = SimpleNamespace(
        org_id=org_id,
        run_id="run-1",
        workflow_id="wf-1",
        is_golden_run=False,
        pool=object(),
        current_user={"id": "user-uuid-1"},
    )

    result = await _exec_external_action(phase, {}, ctx)
    assert "failure" in result
    assert "refused: permission not granted" in result["failure"]

    # Verify F-3: Outbound permission refusal emitted tool_refused audit event
    assert mock_audit.called
    call_kwargs = mock_audit.call_args.kwargs
    assert call_kwargs["event_type"] == "tool_refused"
    assert call_kwargs["metadata"]["tool_name"] == "jira_create_issue"
    assert call_kwargs["metadata"]["reason"] == "permission_denied"
