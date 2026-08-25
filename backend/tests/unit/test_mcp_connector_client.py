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


# ══════════════════════════════════════════════════════════════════════════════════════════
# ⚠ ADDED, NEVER RE-BASELINED — every case above this banner is untouched by 206.2
# ══════════════════════════════════════════════════════════════════════════════════════════
#
# 5 · PHASE 206.2 · D-206.2-16 / D-206.2-19 — THE GRANT WRITE, COVERED FOR THE FIRST TIME
#
# ⚠ MEASURED AT THIS PLAN'S BASE: `grep -rn "update_connection_grants|update_grants|/grants"
# backend/tests` returned **ZERO**. `PATCH /connectors/connections/{id}/grants` and
# `connector_service.update_connection_grants` shipped in Phase 206 with no coverage in any
# tier, and Phase 206.2 is about to make the FIRST production call to them from the workflow
# builder. This block adds the coverage rather than inheriting the gap.
#
# ⚠ THE HEADLINE IS THAT THE ENDPOINT IS A WHOLE-COLUMN **REPLACE**, NOT A MERGE.
# `connector_service.py` does `.update({"tool_grants": sanitized_grants})`, so a naive
# per-tool toggle sending `{[tool]: next}` **WIPES EVERY OTHER GRANT ON THE CONNECTION** —
# and because a missing key DENIES at `phase_types.py` GATE 6, the wipe is a silent
# revocation, not a visible error. D-206.2-16's obligation on the UI (send the FULL MERGED
# MAP, derived from the server-owned value) is a CONSEQUENCE OF THIS MEASUREMENT, asserted
# here at the tier that owns it, so the UI's rule rests on a drive rather than on a reading
# of the source.
#
# ⚠ NO VERSION COLUMN, NO OPTIMISTIC LOCK, NO MIGRATION. `tool_grants` carries no version and
# adding one is a migration this phase forbids. The honest mitigation is the UI's scope
# sentence in wave 4 ("grants are per-connection and org-wide — this changes what EVERY
# workflow bound to this connection may do"), not a lock invented here.
#
# ⚠ THE FAKE RECORDS AND IS ASSERTED NON-EMPTY BEFORE ITS CONTENTS ARE READ. A fake whose
# `.update()` silently discards its payload is exactly the trap recorded in
# `backend/app/api/workflow_runs.py`'s hot-file section — a forgotten projection passed GREEN
# under an old fake, and the fix was to make the fake faithful AND to prove it recorded.

_GRANTS_CONN_ID = "7ca5e114-0000-4000-8000-00000000000a"
_GRANTS_ORG_ID = "11111111-1111-1111-1111-111111111111"


def _grants_row(**overrides) -> dict:
    """A row shaped like `_SELECTABLE_COLUMNS` — every response field present.

    `_to_response` reads `row.get(key)` for each response field and coalesces only
    `tool_grants` / `discovered_tools` / `config`, so `is_enabled` MUST be a real bool here
    or the projection fails validation for a reason that has nothing to do with grants.
    """
    row = {
        "id": _GRANTS_CONN_ID,
        "org_id": _GRANTS_ORG_ID,
        "capability": None,
        "name": "DeepWiki (MCP)",
        "config": {"headers": {}},
        "mcp_server_url": "https://mcp.deepwiki.com/mcp",
        "tool_grants": {},
        "discovered_tools": [],
        "is_enabled": True,
        "last_checked_at": None,
        "last_check_verdict": "ok",
        "created_at": None,
        "updated_at": None,
    }
    row.update(overrides)
    return row


class _GrantsRecorder:
    """What the fake saw: the table, the update payloads, the ordered `.eq()` filters."""

    def __init__(self) -> None:
        self.tables: list[str] = []
        self.updates: list[dict] = []
        self.eqs: list[tuple[str, object]] = []


class _FakeParams(dict):
    """`postgrest`'s `QueryParams` surface, to the extent `_project` touches it."""

    def set(self, key, value):
        nxt = _FakeParams(self)
        nxt[key] = value
        return nxt


class _FakeGrantsBuilder:
    """The exact chain `update_connection_grants` builds: `.update(...).eq(...).eq(...)`.

    `execute()` APPLIES the recorded payload to the seeded row rather than returning the row
    untouched — i.e. it behaves like PostgREST's `return=representation`. A fake that
    returned the stale row would let a write that never happened look like a success.
    """

    def __init__(self, rec: "_GrantsRecorder", rows: list[dict]) -> None:
        self._rec = rec
        self._rows = rows
        self._payload: dict = {}
        self.request = SimpleNamespace(params=_FakeParams())

    def update(self, payload):
        self._rec.updates.append(payload)
        self._payload = payload
        return self

    def eq(self, column, value):
        self._rec.eqs.append((column, value))
        return self

    def execute(self):
        return SimpleNamespace(
            data=[{**row, **self._payload} for row in self._rows]
        )


class _FakeGrantsClient:
    def __init__(self, rec: "_GrantsRecorder", rows: list[dict]) -> None:
        self._rec = rec
        self._rows = rows

    def table(self, name):
        self._rec.tables.append(name)
        return _FakeGrantsBuilder(self._rec, self._rows)


async def _drive_grant_write(sent: dict, *, rows: list[dict] | None = None):
    """Really run `update_connection_grants` against the recording fake.

    `update_connection_grants` itself is NEVER monkeypatched — the function under test must
    actually run, or the drive measures nothing. Returns `(result, recorder)`, and asserts
    the NON-VACUITY control (the fake recorded an update at all) before any caller reads the
    recording's contents.
    """
    from app.services import connector_service

    rec = _GrantsRecorder()
    client = _FakeGrantsClient(rec, [_grants_row()] if rows is None else rows)
    result = await connector_service.update_connection_grants(
        _GRANTS_CONN_ID, _GRANTS_ORG_ID, sent, supabase=client
    )
    assert rec.updates, (
        "NON-VACUITY: the fake recorded no `.update()` call at all, so every assertion "
        "below would be reading an empty list and passing for the wrong reason"
    )
    assert rec.tables == ["connector_connections"], rec.tables
    return result, rec


@pytest.mark.asyncio
async def test_update_connection_grants_REPLACES_the_whole_tool_grants_column():
    """D-206.2-16 — **the headline. The endpoint REPLACES; it does not merge.**

    Seeded with a stored `{"a": True}` and sent `{"b": True}`, the payload handed to
    `.update()` carries `tool_grants` == `{"b": True}` — **`"a"` IS GONE**. Asserted by SET
    EQUALITY on the payload's keys, so a partial fix that happened to keep one key cannot
    pass.

    This is the measurement the UI's obligation rests on: a per-tool toggle that sends
    `{[tool]: next}` alone silently revokes every other tool on the connection, and because
    `phase_types.py` GATE 6 reads `grants.get(tool_name) is True` — a MISSING KEY DENIES —
    the revocation surfaces later as a `tool_refused` on a workflow nobody edited.
    """
    result, rec = await _drive_grant_write(
        {"b": True}, rows=[_grants_row(tool_grants={"a": True})]
    )
    payload = rec.updates[0]

    assert set(payload["tool_grants"].keys()) == {"b"}, (
        f"D-206.2-16: the grant write is a whole-column REPLACE and the payload is "
        f"{payload['tool_grants']!r}. A `{{[tool]: next}}` payload from the UI WIPES every "
        f"other grant on the connection — the stored {{'a': True}} is not merged, it is "
        f"gone. The UI must send the FULL MERGED MAP derived from the server-owned value."
    )
    # And the response the UI would refresh from carries the replaced column, not the old one.
    assert result.tool_grants == {"b": True}, result.tool_grants


@pytest.mark.asyncio
async def test_update_connection_grants_coerces_every_value_to_a_real_boolean():
    """F-1 — `bool(v)` on the way in, asserted with `is True` / `is False`, never truthiness.

    This matters because the two ends of the grant disagree about what "granted" means:
    `phase_types.py` GATE 6 requires `grants.get(tool_name) is True`, while the client's
    `isToolGranted` (`McpToolPicker.tsx`) accepts any truthy value. **The sanitizer is what
    makes them agree** — without it, a stored `1` or `"yes"` reads GRANTED in the UI and
    DENIED at run time, which is the worst of both.

    All three coercions in ONE drive, as a table, so a partial fix cannot pass.
    """
    _, rec = await _drive_grant_write({"t_int": 1, "t_str": "yes", "t_zero": 0})
    grants = rec.updates[0]["tool_grants"]

    for tool, expected in (("t_int", True), ("t_str", True), ("t_zero", False)):
        value = grants[tool]
        assert value is expected, (
            f"F-1: {tool!r} reached the column as {value!r} ({type(value).__name__}), not "
            f"the boolean {expected!r}. GATE 6 compares with `is True`, so a truthy "
            f"non-boolean reads GRANTED in the UI and DENIED at run time."
        )
    assert set(grants) == {"t_int", "t_str", "t_zero"}, grants


@pytest.mark.asyncio
async def test_update_connection_grants_is_scoped_by_both_id_and_org_id():
    """D-15 — the write is filtered by `id` AND `org_id`. A write scoped by id alone is a
    CROSS-ORG write.

    Asserted by COLUMN NAME off the recording fake, not by counting `.eq()` calls: two
    filters on the same column would satisfy a count and would still be a cross-org write.
    RLS is the second layer and is deliberately NOT simulated here — a test that mocked the
    policy would prove the mock.
    """
    _, rec = await _drive_grant_write({"ask_question": True})
    columns = [column for column, _ in rec.eqs]

    assert "id" in columns and "org_id" in columns, (
        f"the grant write is not scoped by both id and org_id — filters applied: {rec.eqs!r}. "
        f"Scoped by id alone this is a cross-org write, and the service-role path would not "
        f"be stopped by anything else."
    )
    assert dict(rec.eqs)["id"] == str(_GRANTS_CONN_ID)
    assert dict(rec.eqs)["org_id"] == str(_GRANTS_ORG_ID)


@pytest.mark.asyncio
async def test_update_connection_grants_raises_connector_not_found_when_nothing_matched():
    """An empty `result.data` is ABSENCE, and absence raises `ConnectorNotFound` naming the id.

    That is what turns a cross-org id (filtered out by the `org_id` predicate above) into a
    404 at the route rather than a silent success on zero rows — the router's own
    `except connector_service.ConnectorNotFound: raise _NOT_FOUND`.
    """
    from app.services import connector_service

    rec = _GrantsRecorder()
    client = _FakeGrantsClient(rec, [])

    with pytest.raises(connector_service.ConnectorNotFound) as exc_info:
        await connector_service.update_connection_grants(
            _GRANTS_CONN_ID, _GRANTS_ORG_ID, {"ask_question": True}, supabase=client
        )

    assert rec.updates, (
        "NON-VACUITY: the refusal fired without the write ever being attempted, so this "
        "case would pass against a function that raised unconditionally"
    )
    assert _GRANTS_CONN_ID in str(exc_info.value), str(exc_info.value)


def test_grant_and_discover_are_org_admin_only_while_the_list_read_is_not():
    """D-206.2-13 — **the authorization ASYMMETRY, both halves in one case.**

    `require_org_manage` gates `PATCH …/grants` and `POST …/discover` (→ 403 for a plain
    member) while `GET /connectors/connections` is deliberately ungated org-wide (U-02:
    read and bind are org-wide). **Any member may BIND a connection; only an org admin may
    DISCOVER or GRANT** — and wave 4's three-arm audience render is built on exactly that
    asymmetry, so asserting only the positive half would not measure it.

    Asserted by INSPECTING the registered route's dependency callables, never by grepping
    the decorator's source text: a source grep passes against a commented-out decorator.
    """
    from app.api import connectors as connectors_api
    from app.dependencies import require_org_manage

    def _deps_of(path: str, method: str):
        for route in connectors_api.router.routes:
            if getattr(route, "path", None) == path and method in (
                getattr(route, "methods", None) or set()
            ):
                return [
                    getattr(d, "dependency", None)
                    for d in (getattr(route, "dependencies", None) or [])
                ]
        raise AssertionError(
            f"no {method} route registered at {path!r} — the surface this phase's UI calls "
            f"does not exist, which every assertion below would otherwise hide"
        )

    # The router carries the `/connectors` prefix at declaration, so these are the paths the
    # route table really holds.
    grants = _deps_of("/connectors/connections/{connection_id}/grants", "PATCH")
    discover = _deps_of("/connectors/connections/{connection_id}/discover", "POST")
    listing = _deps_of("/connectors/connections", "GET")

    assert require_org_manage in grants, (
        f"PATCH …/grants lost its org-admin gate — dependencies: {grants!r}. A rendered "
        f"grant control the API no longer refuses is the 069-A defect: the UI would be the "
        f"only barrier."
    )
    assert require_org_manage in discover, (
        f"POST …/discover lost its org-admin gate — dependencies: {discover!r}"
    )
    assert require_org_manage not in listing, (
        f"GET /connectors/connections gained an org-admin gate — dependencies: {listing!r}. "
        f"U-02 says read and bind are org-wide; gating the list would lock a plain member "
        f"out of BINDING a connection, which is the half of this surface they are allowed."
    )
