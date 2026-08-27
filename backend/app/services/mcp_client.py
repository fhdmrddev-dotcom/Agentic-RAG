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
from starlette.concurrency import run_in_threadpool
from app.security.egress import validate_mcp_destination, PinnedDestination, EgressRefused

logger = logging.getLogger(__name__)

DEFAULT_MCP_TIMEOUT = 30.0
DEFAULT_DISCOVERY_TIMEOUT = 15.0
MAX_MCP_BODY_BYTES = 2 * 1024 * 1024  # 2MB response limit

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
    def _parse_body_from_bytes(headers: httpx.Headers, body_bytes: bytes) -> dict[str, Any] | None:
        """Decode a JSON-RPC body from bytes and response headers."""
        content_type = (headers.get("content-type") or "").lower()
        text = body_bytes.decode("utf-8", errors="replace")

        if "text/event-stream" in content_type:
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

    @classmethod
    def _parse_body(cls, response: httpx.Response) -> dict[str, Any] | None:
        """Decode a JSON-RPC body from EITHER transport the MCP spec defines."""
        return cls._parse_body_from_bytes(response.headers, response.content)

    async def _post(
        self,
        client: httpx.AsyncClient,
        server_url: str,
        headers: dict[str, str],
        payload: dict[str, Any],
        server_hostname: str | None = None,
    ) -> dict[str, Any] | None:
        """One POST, with transport errors, bounded decoding, and HTTP status handled in one place."""
        # ⚠ SNI IS TLS-LAYER AND THE `Host:` HEADER IS NOT A SUBSTITUTE FOR IT. `_send_jsonrpc`
        # rewrites the URL to the pinned IP literal (the DNS-rebinding TOCTOU fix), which points
        # certificate HOSTNAME verification at an address no certificate carries. `Host:` is sent
        # AFTER the handshake and cannot help — the TLS `ClientHello` has already gone out.
        # `egress.py:53,660-663` states the same rule for the sibling path and measures the
        # httpcore extension as present in this venv (httpx 0.28.1).
        # Driven 2026-08-27 against `https://mcp.deepwiki.com/mcp`, pinned to its real IP:
        #   without this line -> ConnectError [SSL: CERTIFICATE_VERIFY_FAILED] IP address mismatch
        #   with it           -> HTTP 200 and the real tools/list result
        # `server_hostname` was already threaded here from `_send_jsonrpc` and then went UNUSED,
        # so the plumbing existed and only the last step was missing.
        try:
            response = await client.post(
                server_url,
                json=payload,
                headers=headers,
                extensions={"sni_hostname": server_hostname} if server_hostname else {},
            )
        except httpx.RequestError as exc:
            logger.warning("mcp_client: request to %r failed: %s", server_url, exc)
            raise McpClientError(
                f"Failed to communicate with MCP server at {server_url}: {exc}"
            ) from exc

        if 300 <= response.status_code < 400:
            raise McpClientError(
                f"MCP server at {server_url} returned redirect {response.status_code} (redirects forbidden by egress security policy)"
            )

        if len(response.content) > MAX_MCP_BODY_BYTES:
            raise McpClientError(
                f"Response from MCP server at {server_url} exceeded byte cap ({MAX_MCP_BODY_BYTES} bytes)"
            )

        if response.status_code >= 400:
            logger.warning(
                "mcp_client: server %r returned HTTP %d: %s",
                server_url, response.status_code, response.text[:200],
            )
            raise McpClientError(
                f"MCP server responded with HTTP {response.status_code}: {response.text[:200]}"
            )

        session_id = response.headers.get("mcp-session-id")
        if session_id:
            headers["Mcp-Session-Id"] = session_id

        return self._parse_body(response)

    async def _handshake(
        self,
        client: httpx.AsyncClient,
        server_url: str,
        headers: dict[str, str],
        server_hostname: str | None = None,
    ) -> None:
        """Run the ``initialize`` -> ``notifications/initialized`` exchange the spec requires."""
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
            }, server_hostname=server_hostname)
        except McpClientError as exc:
            logger.info("mcp_client: initialize refused by %r (%s) - continuing", server_url, exc)
            return

        try:
            await self._post(client, server_url, headers, {
                "jsonrpc": "2.0",
                "method": "notifications/initialized",
                "params": {},
            }, server_hostname=server_hostname)
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
        # SSRF Guard (D-206-04 / T-206-01 / D-v2.5-01 / SEC-2)
        # 1. Validation runs off the asyncio event loop via threadpool
        pinned: PinnedDestination | None = await run_in_threadpool(validate_mcp_destination, server_url)

        # 2. TOCTOU DNS-rebinding fix: rewrite URL host to pinned IP literal
        parsed_target = httpx.URL(server_url)
        target_url = str(parsed_target.copy_with(host=pinned.ip)) if pinned and getattr(pinned, "ip", None) else server_url
        server_hostname = getattr(pinned, "hostname", None) or parsed_target.host

        headers = self._build_auth_headers(secret)
        if server_hostname:
            headers["Host"] = server_hostname

        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": method,
            "params": params if params is not None else {},
        }

        call_timeout = timeout or self.timeout
        # ONE client for the whole exchange: handshake, session id, and call share transport.
        # trust_env=False is a SECURITY property (SEC-2 / D-07) preventing proxy bypass.
        # follow_redirects=False flatly prevents redirect-chasing SSRF.
        async with httpx.AsyncClient(
            timeout=call_timeout,
            follow_redirects=False,
            verify=True,
            trust_env=False,
        ) as client:
            await self._handshake(client, target_url, headers, server_hostname=server_hostname)
            body = await self._post(client, target_url, headers, payload, server_hostname=server_hostname)

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

        Three further keys are forwarded ONLY when the server sent a usable value, so their
        absence stays meaningful: ``title`` (a stripped, non-empty string), ``outputSchema``
        (an object) and ``annotations`` (an object). The emitted key set is an ALLOW-LIST —
        see the comment above the dict literal below before adding to it.
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

            # Phase 211 (D-211-09) — `title`, coerced with the same discipline `name` and
            # `description` already receive rather than read bare off the item. An absent,
            # blank or non-string title contributes NO KEY AT ALL: absence is meaningful
            # here exactly as it is for `annotations`, and a fabricated `""` would claim the
            # server named this tool when it said nothing, costing the reader its fallback
            # to `name`.
            raw_title = item.get("title")
            title = str(raw_title).strip() if isinstance(raw_title, str) else ""

            # Phase 211 (D-211-09) — `outputSchema`. Forwarded only when the server sent an
            # object, and NEVER coerced to a default the way `inputSchema` is: the
            # specification makes `inputSchema` mandatory and `outputSchema` optional, so an
            # absent output schema is a fact about the server ("this tool makes no
            # structural promise about its result") and inventing `{"type": "object"}` would
            # make a promise on its behalf.
            raw_output_schema = item.get("outputSchema")

            # ⚠ WIDEN THE LIST, NEVER REMOVE IT (D-211-09). This object stays an explicit
            # per-key dict literal, built key by key. It must not become a spread of `item`
            # minus a set of unwanted names, and it must not become a comprehension over the
            # server's keys: a list of what we refuse cannot be made fail-closed (the
            # measured v3.6 finding), and the entire value of this function is that a key
            # nobody named here cannot reach the `discovered_tools` jsonb column — and from
            # there a client that will index into whatever it finds.
            sanitized_tools.append({
                "name": name,
                "description": description,
                "inputSchema": input_schema,
                **({"title": title} if title else {}),
                **({
                    "outputSchema": raw_output_schema
                } if isinstance(raw_output_schema, dict) else {}),
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
