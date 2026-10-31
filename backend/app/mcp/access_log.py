"""Phase 305 (D-11 / D-57 / R-24 / T-305-07) — no query string of an MCP request reaches the log.

uvicorn's access line carries the full path, so a client that put its key in the URL
(``POST /mcp?key=srl_mcp_...``) would write the secret into every log sink. The key is never READ
from the query (``edge._bearer`` reads the header only), and this filter makes sure it is never
WRITTEN either: on a ``uvicorn.access`` record whose path is ``MCP_PATH`` (or under it), the part
after ``?`` is dropped. Every other path is untouched. It rewrites, never drops — always ``True``
(the ``logging_sink._RedactingFilter`` shape).

``install()`` adds it to ``uvicorn.access`` once; calling it again (``register_mcp`` per app, per
lifespan, per test) adds nothing.
"""
from __future__ import annotations

import logging

from app.services.mcp_tool_catalogue import MCP_PATH

ACCESS_LOGGER = "uvicorn.access"


def _is_mcp_path(path: str) -> bool:
    return path == MCP_PATH or path.startswith(MCP_PATH + "/")


class McpQueryStripFilter(logging.Filter):
    """Drop the query string from MCP_PATH access lines (uvicorn's 5-tuple args)."""

    def filter(self, record: logging.LogRecord) -> bool:  # noqa: A003 — logging API
        try:
            args = record.args
            if isinstance(args, tuple) and len(args) == 5 and isinstance(args[2], str):
                full_path = args[2]
                path, sep, _query = full_path.partition("?")
                if sep and _is_mcp_path(path):
                    record.args = (args[0], args[1], path, args[3], args[4])
        except Exception:  # noqa: BLE001 — a log filter must never drop a line
            pass
        return True


def install() -> None:
    access = logging.getLogger(ACCESS_LOGGER)
    if not any(isinstance(f, McpQueryStripFilter) for f in access.filters):
        access.addFilter(McpQueryStripFilter())
