"""Phase 305 (MCP-01; D-05 / D-49 / R-07) — which Host and Origin the transport accepts.

The SDK's ``TransportSecuritySettings`` does the DNS-rebinding check (a present ``Origin`` outside
the allowlist is 403, a foreign ``Host`` is 421). It is ALWAYS passed explicitly: left unset with
the default ``host="127.0.0.1"`` the SDK auto-enables a loopback-only allowlist, which answers 421
to every request in production (305-RESEARCH Pitfall 5).

* allowed hosts: the public base's hostname, bare and with any port (one-box nginx sends
  ``Host $host`` with no port) — plus the three loopback forms ONLY outside production.
* allowed origins: none. Claude Code and Cursor are not browsers and send no ``Origin``; any
  ``Origin`` present is a browser, which this key-only endpoint never serves.

The base comes from ``mcp_tool_catalogue.mcp_public_base()`` — the same predicate that decides
whether ``/mcp`` is mounted at all, so the allowlist and the mount can never disagree.
"""
from __future__ import annotations

from urllib.parse import urlsplit

from mcp.server.transport_security import TransportSecuritySettings

from app.services.mcp_tool_catalogue import MCP_PATH, mcp_public_base

MCP_ROUTE_PATHS: tuple[str, str] = (MCP_PATH, MCP_PATH + "/")
_LOOPBACK_FORMS = ["127.0.0.1:*", "localhost:*", "[::1]:*"]


def _is_production() -> bool:
    from app.api.api_docs import is_production_environment  # noqa: PLC0415

    return is_production_environment()


def allowed_hosts() -> list[str]:
    base = mcp_public_base()
    hosts: list[str] = []
    if base is not None:
        host = (urlsplit(base).hostname or "").lower()
        if host:
            if ":" in host:  # an IPv6 literal is written in brackets in a Host header
                host = f"[{host}]"
            hosts = [host, f"{host}:*"]
    if not _is_production():
        hosts += [h for h in _LOOPBACK_FORMS if h not in hosts]
    return hosts


def transport_security() -> TransportSecuritySettings:
    return TransportSecuritySettings(
        enable_dns_rebinding_protection=True,
        allowed_hosts=allowed_hosts(),
        allowed_origins=[],
    )
