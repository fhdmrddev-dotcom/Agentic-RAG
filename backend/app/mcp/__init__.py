"""Phase 305 (MCP-01; D-02 / D-04 / D-49 / R-04 / R-05) — the MCP server's two seams into the app.

``main.py`` imports exactly these two names (D-04: one import line, one ``register_mcp(app)`` line
beside the router block, one ``async with mcp_lifespan():`` around the lifespan's single yield).

``register_mcp(app)`` appends ``Route("/mcp")`` AND ``Route("/mcp/")`` to the app's router, both to
the same pure-ASGI ``McpEdge`` — never a Starlette ``Mount``, which redirect-slashes ``/mcp`` to an
``http://`` Location behind TLS and drops the key (T-305-19). When ``mcp_public_base()`` refuses
this deployment (production with ``BACKEND_PUBLIC_URL`` unset, loopback or not https) it mounts
NOTHING and logs CRITICAL, so ``/mcp`` is a 404 and ``mcp_url()`` shows no address (T-305-20).
It also installs the access-log query filter (D-57).

``mcp_lifespan()`` builds a FRESH stateless session manager on every lifespan entry
(``StreamableHTTPSessionManager.run()`` is once per instance, and many test modules enter
``TestClient`` lifespans on one app object) and runs it for the lifespan's duration. Stateless,
JSON responses (D-02): no ``Mcp-Session-Id`` is issued, so any uvicorn worker answers any request.
A mounted sub-app's lifespan never runs — which is why this is a context manager the app's own
lifespan enters, and not a mounted sub-app.
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from mcp.server.streamable_http_manager import StreamableHTTPASGIApp
from starlette.routing import Route

from app.mcp import access_log, edge, oauth_metadata, oauth_server, transport
from app.mcp.server import server
from app.services.mcp_tool_catalogue import MCP_PATH, mcp_public_base

logger = logging.getLogger("app.mcp")

__all__ = ["register_mcp", "mcp_lifespan"]


def register_mcp(app) -> None:
    """Register ``/mcp`` and ``/mcp/`` (no redirect) — or nothing, loudly, when the base is refused."""
    base = mcp_public_base()
    if base is None:
        logger.critical(
            "MCP: NOT MOUNTED — BACKEND_PUBLIC_URL must be an https, non-loopback public address in "
            "production (it is unset, loopback or http here). /mcp answers 404 and the key screen "
            "shows no connection address until it is set."
        )
        return
    mcp_edge = edge.McpEdge()
    # methods=["POST"]: the router answers any other method 405 + ``Allow: POST`` before the edge
    # (which refuses non-POST itself as well), and the route carries a real method set — code that
    # walks ``app.routes`` reading ``route.methods`` must never meet ``None`` (test_284).
    for path in (MCP_PATH, MCP_PATH + "/"):
        app.router.routes.append(
            Route(path, endpoint=mcp_edge, methods=["POST"], include_in_schema=False)
        )
    # Phase 307 (OAUTH-05; D-02 / D-03): the authorization server's routes, AFTER the refuse-mount
    # guard — with no public base none of them exists. Literal paths derived from the base (the
    # one-box proxy passes the origin-root .well-known paths through unchanged). Hidden from the
    # public OpenAPI document like /mcp; main.py is not edited.
    paths = oauth_metadata.well_known_paths()
    app.router.routes.append(Route(
        paths["prm_suffixed"], endpoint=oauth_server.well_known_prm, methods=["GET"],
        include_in_schema=False,
    ))
    app.router.routes.append(Route(
        paths["prm_root"], endpoint=oauth_server.well_known_prm, methods=["GET"],
        include_in_schema=False,
    ))
    app.router.routes.append(Route(
        paths["as_metadata"], endpoint=oauth_server.well_known_as, methods=["GET"],
        include_in_schema=False,
    ))
    app.router.routes.append(Route(
        "/oauth/register", endpoint=oauth_server.register, methods=["POST"], include_in_schema=False,
    ))
    app.router.routes.append(Route(
        "/oauth/authorize", endpoint=oauth_server.authorize, methods=["GET"], include_in_schema=False,
    ))
    # Phase 307 (D-22): the one 401 names this base's protected-resource document.
    edge.configure_challenge(oauth_metadata.prm_url())
    access_log.install()


@asynccontextmanager
async def mcp_lifespan():
    """Run a fresh stateless session manager for one app lifespan (none when MCP is not mounted)."""
    if mcp_public_base() is None:
        yield
        return
    server.streamable_http_app(
        stateless_http=True,
        json_response=True,
        transport_security=transport.transport_security(),
    )
    manager = server.session_manager
    async with manager.run():
        previous = edge.set_live_app(StreamableHTTPASGIApp(manager))
        try:
            yield
        finally:
            edge.set_live_app(previous)
