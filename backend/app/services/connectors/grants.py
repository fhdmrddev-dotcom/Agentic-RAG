"""Phase 213 (GRANT-01 / GRANT-02 / D-213-00 / D-213-05 / D-213-06) —
Tool grant resolution and posture evaluation.

This module is the single leaf module responsible for determining the effective approval
posture of a tool execution across all connection shapes (both native Capability and MCP).

── THE HONEST LEAF INVARIANT ──────────────────────────────────────────────────────────
This module is a strict leaf and MUST NEVER import ``phase_types`` or ``harness_engine``.
Gate 5.5 in ``phase_types.py`` delegates to this module so posture evaluation logic is
centralized and testable without inflating the harness executors.

── D-213-06: INHERITANCE AND THE DEFAULT POSTURE FLOOR ───────────────────────────────
1. If a tool has an explicit key in ``connection.tool_grants``, that grant posture is returned.
2. Otherwise (absent key), the tool INHERITS ``connection.default_approval_posture``.
3. The default posture for any new or unconfigured connection is ``"ask"`` (the safe floor).
4. Any unrecognized or invalid posture fails closed to ``"deny"``.
"""
from __future__ import annotations

import logging
from typing import Any, Literal

ToolGrantPosture = Literal["allow", "ask", "deny"]
_LEGAL_POSTURES: frozenset[str] = frozenset({"allow", "ask", "deny"})

logger = logging.getLogger(__name__)

__all__ = [
    "ToolGrantPosture",
    "_LEGAL_POSTURES",
    "resolve_effective_posture",
    "is_tool_allowed",
]


def resolve_effective_posture(
    connection: Any,
    tool_name: str | None,
) -> ToolGrantPosture:
    """Resolve the effective approval posture for a specific tool on a connection.

    Rules:
      1. If ``tool_name`` is present and exists in ``connection.tool_grants``:
         - Return the explicit posture (``"allow" | "ask" | "deny"``).
         - For backwards compatibility with legacy boolean values:
           ``True`` -> ``"allow"``, ``False`` -> ``"deny"``.
      2. If ``tool_name`` is absent or not in ``tool_grants``:
         - Inherit ``connection.default_approval_posture`` (defaults to ``"ask"``).
      3. Fail closed: Any unresolvable or illegal state returns ``"deny"``.
    """
    if connection is None or not tool_name:
        return "deny"

    # Extract tool_grants dict from connection object or dict
    if isinstance(connection, dict):
        grants = connection.get("tool_grants") or {}
        default_posture = connection.get("default_approval_posture")
    else:
        grants = getattr(connection, "tool_grants", None) or {}
        default_posture = getattr(connection, "default_approval_posture", None)

    # 1. Check explicit tool grant override
    if isinstance(grants, dict) and tool_name in grants:
        val = grants[tool_name]
        if isinstance(val, str) and val in _LEGAL_POSTURES:
            return val  # type: ignore[return-value]
        if val is True:
            return "allow"
        if val is False:
            return "deny"
        logger.warning(
            "213 GRANT: unrecognized grant value %r for tool %r on connection %r — failing to deny",
            val,
            tool_name,
            getattr(connection, "id", None) or (connection.get("id") if isinstance(connection, dict) else None),
        )
        return "deny"

    # 2. Inherit connection default posture (D-213-06)
    if isinstance(default_posture, str) and default_posture in _LEGAL_POSTURES:
        return default_posture  # type: ignore[return-value]

    # If default_posture is missing, use the default floor "ask"
    if default_posture is None:
        return "ask"

    return "deny"


def is_tool_allowed(connection: Any, tool_name: str | None) -> bool:
    """Predicate checking if a tool has an effective posture of 'allow'."""
    return resolve_effective_posture(connection, tool_name) == "allow"
