"""Phase 206 (CONN-02 / CONN-03) — Model Context Protocol (MCP) Connector Client.

Provides async client capabilities to communicate with remote MCP servers (such as official Atlassian
and GitHub MCP servers) using JSON-RPC 2.0 over HTTP/SSE transports.

Key Security Invariants:
  - D-206-04 / T-206-01: Validates server URLs with ``app.security.egress.validate_mcp_destination``
    before making any outbound socket connection (preventing SSRF to private/loopback/cloud metadata).
  - Credentials from ``secret_ciphertext`` are handled strictly in-memory and formatted as authorization
    headers (Bearer or Basic auth).
  - Responses are capped and parsed securely.
"""

from __future__ import annotations

import base64
import json
import logging
from typing import Any

import httpx

from app.security.egress import validate_mcp_destination

logger = logging.getLogger(__name__)

DEFAULT_MCP_TIMEOUT = 30.0
DEFAULT_DISCOVERY_TIMEOUT = 15.0

#: Sent in the ``initialize`` handshake. A server may negotiate DOWN from this; it is a
#: statement of what we speak, not a demand.
MCP_PROTOCOL_VERSION = "2025-06-18"
MCP_CLIENT_NAME = "agentic-rag"
MCP_CLIENT_VERSION = "206"


class McpClientError(Exception):
    """Base exception for MCP client operations."""


class McpProtocolError(McpClientError):
    """Raised when the remote MCP server returns a JSON-RPC error or malformed payload."""

    def __init__(self, code: int | None, message: str, data: Any = None):
        super().__init__(f"MCP Error ({code}): {message}")
        self.code = code
        self.message = message
        self.data = data


class McpClient:
    """Async client for remote Model Context Protocol (MCP) servers."""

    def __init__(self, timeout: float = DEFAULT_MCP_TIMEOUT):
        self.timeout = timeout

    @staticmethod
    def _build_auth_headers(secret: str | None) -> dict[str, str]:
        """Format authentication header based on credential shape."""
        headers: dict[str, str] = {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        }
        if not secret:
            return headers

        clean_secret = secret.strip()
        if not clean_secret:
            return headers

        if clean_secret.lower().startswith("bearer "):
            headers["Authorization"] = clean_secret
        elif clean_secret.lower().startswith("basic "):
            headers["Authorization"] = clean_secret
        elif ":" in clean_secret and not clean_secret.startswith("http"):
            # Username:token basic auth pair (e.g. Jira email:api_token)
            encoded = base64.b64encode(clean_secret.encode("utf-8")).decode("ascii")
            headers["Authorization"] = f"Basic {encoded}"
        else:
            headers["Authorization"] = f"Bearer {clean_secret}"

        return headers

    @staticmethod
    def _parse_body(response: httpx.Response) -> dict[str, Any] | None:
        """Decode a JSON-RPC body from EITHER transport the MCP spec defines.

        WARNING - THIS IS THE FIX FOR THE ONE DEFECT A GREEN UNIT SUITE COULD NOT SEE. The
        first version called ``response.json()`` and nothing else, which works against a
        fixture and fails against a real server: MCP's *Streamable HTTP* transport answers a
        POST with ``Content-Type: text/event-stream`` and frames the JSON-RPC body inside SSE
        ``data:`` lines. Measured 2026-08-25 against the public ``https://mcp.deepwiki.com/mcp``,
        the server replied correctly and the client raised
        ``McpProtocolError: Invalid JSON response ... event: message / data: {...}``.

        The irony is load-bearing, and is why this belongs in the client rather than in a
        caller: ``_build_auth_headers`` ALREADY sends ``Accept: application/json,
        text/event-stream``, so the client was advertising a transport it could not read.
        Atlassian's and GitHub's official servers - the two this phase exists to reach - both
        use it, so every target was unreachable while twelve unit tests passed.

        Returns ``None`` for a body-less acknowledgement (a notification answered ``202``),
        which is a legitimate response and not an error.
        """
        content_type = (response.headers.get("content-type") or "").lower()
        text = response.text

        if "text/event-stream" in content_type:
            # An SSE stream may carry several frames; the JSON-RPC reply is the first `data:`
            # payload that parses as an object. `event:` / `id:` / comment lines are skipped
            # rather than concatenated blindly.
            for line in text.splitlines():
                if not line.startswith("data:"):
                    continue
                chunk = line[5:].strip()
                if not chunk or chunk == "[DONE]":
                    continue
                try:
                    parsed = json.loads(chunk)
                except ValueError:
                    continue
                if isinstance(parsed, dict):
                    return parsed
            raise McpProtocolError(
                None, f"No JSON-RPC frame in event-stream response: {text[:200]}"
            )

        if not text.strip():
            return None

        try:
            parsed = json.loads(text)
        except ValueError as exc:
            raise McpProtocolError(
                None, f"Invalid JSON response from MCP server: {text[:200]}"
            ) from exc
        return parsed if isinstance(parsed, dict) else {"value": parsed}

    async def _post(
        self,
        client: httpx.AsyncClient,
        server_url: str,
        headers: dict[str, str],
        payload: dict[str, Any],
    ) -> dict[str, Any] | None:
        """One POST, with transport errors and HTTP status handled in one place."""
        try:
            response = await client.post(server_url, json=payload, headers=headers)
        except httpx.RequestError as exc:
            logger.warning("mcp_client: request to %r failed: %s", server_url, exc)
            raise McpClientError(
                f"Failed to communicate with MCP server at {server_url}: {exc}"
            ) from exc

        if response.status_code >= 400:
            logger.warning(
                "mcp_client: server %r returned HTTP %d: %s",
                server_url, response.status_code, response.text[:200],
            )
            raise McpClientError(
                f"MCP server responded with HTTP {response.status_code}: {response.text[:200]}"
            )

        # The session id is issued on the `initialize` response and MUST be echoed on every
        # later request of that session. Captured here so no caller has to know it exists.
        session_id = response.headers.get("mcp-session-id")
        if session_id:
            headers["Mcp-Session-Id"] = session_id

        return self._parse_body(response)

    async def _handshake(
        self,
        client: httpx.AsyncClient,
        server_url: str,
        headers: dict[str, str],
    ) -> None:
        """Run the ``initialize`` -> ``notifications/initialized`` exchange the spec requires.

        A server is entitled to refuse every other method until this has run, which is why it
        is not optional. It is deliberately TOLERANT of a server that does not implement it
        (some minimal servers answer `tools/list` cold): a failure here is logged and the real
        call is still attempted, so a stricter handshake can never make a previously-working
        server unreachable.
        """
        try:
            await self._post(client, server_url, headers, {
                "jsonrpc": "2.0",
                "id": 0,
                "method": "initialize",
                "params": {
                    "protocolVersion": MCP_PROTOCOL_VERSION,
                    "capabilities": {},
                    "clientInfo": {"name": MCP_CLIENT_NAME, "version": MCP_CLIENT_VERSION},
                },
            })
        except McpClientError as exc:
            logger.info("mcp_client: initialize refused by %r (%s) - continuing", server_url, exc)
            return

        try:
            await self._post(client, server_url, headers, {
                "jsonrpc": "2.0",
                "method": "notifications/initialized",
                "params": {},
            })
        except McpClientError as exc:
            logger.info("mcp_client: initialized notification refused by %r (%s)", server_url, exc)

    async def _send_jsonrpc(
        self,
        server_url: str,
        method: str,
        params: dict[str, Any] | None = None,
        secret: str | None = None,
        timeout: float | None = None,
    ) -> dict[str, Any]:
        """Validate destination against SSRF and execute a JSON-RPC 2.0 call."""
        # SSRF Guard (D-206-04 / T-206-01)
        validate_mcp_destination(server_url)

        headers = self._build_auth_headers(secret)
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": method,
            "params": params if params is not None else {},
        }

        call_timeout = timeout or self.timeout
        # ONE client for the whole exchange: the handshake, the session id it returns and the
        # real call have to share a connection and a header dict, or the session is meaningless.
        async with httpx.AsyncClient(timeout=call_timeout, follow_redirects=True) as client:
            await self._handshake(client, server_url, headers)
            body = await self._post(client, server_url, headers, payload)

        if body is None:
            raise McpProtocolError(None, "MCP server returned an empty body for a request")

        if not isinstance(body, dict):
            raise McpProtocolError(None, f"Unexpected non-dict JSON-RPC response: {type(body).__name__}")

        if "error" in body and body["error"]:
            err = body["error"]
            code = err.get("code") if isinstance(err, dict) else None
            msg = err.get("message", str(err)) if isinstance(err, dict) else str(err)
            data = err.get("data") if isinstance(err, dict) else None
            raise McpProtocolError(code, msg, data)

        if "result" not in body:
            # Handle cases where response might return result fields at top-level
            return body

        result = body["result"]
        return result if isinstance(result, dict) else {"value": result}

    async def list_tools(
        self,
        server_url: str,
        secret: str | None = None,
        timeout: float = DEFAULT_DISCOVERY_TIMEOUT,
    ) -> list[dict[str, Any]]:
        """Query remote MCP server for available tools via tools/list.

        Returns a list of tool specifications:
          [{"name": "...", "description": "...", "inputSchema": {...}}, ...]
        """
        result = await self._send_jsonrpc(
            server_url,
            method="tools/list",
            params={},
            secret=secret,
            timeout=timeout,
        )

        raw_tools = result.get("tools") or []
        if not isinstance(raw_tools, list):
            return []

        sanitized_tools: list[dict[str, Any]] = []
        for item in raw_tools:
            if not isinstance(item, dict):
                continue
            name = str(item.get("name") or "").strip()
            if not name:
                continue
            description = str(item.get("description") or "").strip()
            input_schema = item.get("inputSchema")
            if not isinstance(input_schema, dict):
                input_schema = {"type": "object", "properties": {}}

            sanitized_tools.append({
                "name": name,
                "description": description,
                "inputSchema": input_schema,
                # Phase 209 (SC#2 · D-209-02) — forward annotations so `readOnlyHint`
                # reaches the frontend. The MCP spec places `readOnlyHint` inside the
                # `annotations` object on a tool entry; dropping it here is what made the
                # `ONLY READS` banner arm dead code. Only forwarded when present and a dict.
                **({
                    "annotations": item["annotations"]
                } if isinstance(item.get("annotations"), dict) else {}),
            })

        return sanitized_tools

    async def call_tool(
        self,
        server_url: str,
        tool_name: str,
        arguments: dict[str, Any],
        secret: str | None = None,
        timeout: float = DEFAULT_MCP_TIMEOUT,
    ) -> dict[str, Any]:
        """Invoke a tool on the remote MCP server via tools/call.

        Returns tool output dictionary containing text content and structured results:
          {"text": "...", "content": [...], "isError": False}
        """
        params = {
            "name": tool_name,
            "arguments": arguments if isinstance(arguments, dict) else {},
        }
        result = await self._send_jsonrpc(
            server_url,
            method="tools/call",
            params=params,
            secret=secret,
            timeout=timeout,
        )

        # MCP spec returns content: list[TextContent | ImageContent | EmbeddedResource]
        content_list = result.get("content") or []
        text_parts: list[str] = []
        if isinstance(content_list, list):
            for c in content_list:
                if isinstance(c, dict) and c.get("type") == "text":
                    text_parts.append(str(c.get("text") or ""))
                elif isinstance(c, str):
                    text_parts.append(c)

        combined_text = "\n".join(text_parts).strip() if text_parts else json.dumps(result)
        is_error = bool(result.get("isError", False))

        return {
            "text": combined_text,
            "content": content_list,
            "isError": is_error,
            "raw": result,
        }


# Default singleton instance for convenience
default_mcp_client = McpClient()


async def list_tools(server_url: str, secret: str | None = None) -> list[dict[str, Any]]:
    return await default_mcp_client.list_tools(server_url, secret=secret)


async def call_tool(
    server_url: str,
    tool_name: str,
    arguments: dict[str, Any],
    secret: str | None = None,
) -> dict[str, Any]:
    return await default_mcp_client.call_tool(server_url, tool_name, arguments, secret=secret)
