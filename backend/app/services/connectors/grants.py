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

── Phase 221 (D-221-05 / D-221-06): THE APPLICATION RUNG ─────────────────────────────
A connection can hold more than one APPLICATION — Google Workspace is ONE connection and
ONE token covering Drive, Gmail, Sheets, Docs, Calendar and Contacts. So the ladder gained
a middle rung and is now three deep:

    action grant  →  ``app:<key>`` grant  →  connection default  →  deny

⚠ **NO MIGRATION.** An application grant lives in the SAME ``tool_grants`` jsonb under the
``app:`` prefix. A tool can never collide with it: a tool name is an identifier and cannot
contain a colon.

⚠ **AND THE RUNG IS ASYMMETRIC ON PURPOSE (D-221-06). AN APPLICATION-LEVEL ``allow`` NEVER
REACHES A WRITE.** *"Allow everything Drive does"* is a sentence people say about reading;
it is not consent to create, overwrite or delete, and a person who set it was not shown the
write they would be arming. So on a write the application rung may resolve ``ask`` or
``deny`` and never ``allow`` — only an explicit per-action grant can allow a write.

Built and tested BEFORE the first write tool exists, against a planted spec, because
retrofitting it onto a shipped ``allow`` that already cascades means silently revoking
consent people believe they gave.
"""
from __future__ import annotations

import logging
from typing import Any, Literal

ToolGrantPosture = Literal["allow", "ask", "deny"]
_LEGAL_POSTURES: frozenset[str] = frozenset({"allow", "ask", "deny"})

logger = logging.getLogger(__name__)

#: Phase 221 (D-221-05) — the ONE spelling of the application-grant key namespace.
#:
#: ⚠ Declared here rather than inlined, so widening it is ONE edit: this constant, the
#: sanitizer's key-shape check and the client's `toolGroups.ts` are the three places that
#: must agree, and a second spelling is how they stop agreeing.
APPLICATION_GRANT_PREFIX = "app:"

__all__ = [
    "ToolGrantPosture",
    "_LEGAL_POSTURES",
    "APPLICATION_GRANT_PREFIX",
    "application_grant_key",
    "resolve_effective_posture",
    "is_tool_allowed",
]


def application_grant_key(application: str) -> str:
    """The ``tool_grants`` key an application's posture is stored under."""
    return f"{APPLICATION_GRANT_PREFIX}{application}"


def _posture_of(value: Any) -> ToolGrantPosture | None:
    """One grant VALUE -> a legal posture, or ``None`` when it is not one.

    ⚠ The legacy boolean arm is kept because rows written before Phase 213 still carry
    ``True`` / ``False``. ``_sanitize_tool_grants`` refuses those on the way IN, which does
    nothing about what is already stored.
    """
    if isinstance(value, str) and value in _LEGAL_POSTURES:
        return value  # type: ignore[return-value]
    if value is True:
        return "allow"
    if value is False:
        return "deny"
    return None


def resolve_effective_posture(
    connection: Any,
    tool_name: str | None,
    *,
    application: str | None = None,
    is_write: bool = False,
) -> ToolGrantPosture:
    """Resolve the effective approval posture for a specific tool on a connection.

    Rules, in order — and every arm fails closed:
      1. An explicit ``tool_grants[tool_name]`` wins outright, for reads and writes alike.
         Legacy booleans still read: ``True`` -> ``"allow"``, ``False`` -> ``"deny"``.
      2. Phase 221 (D-221-05): otherwise an explicit ``tool_grants["app:<application>"]``.
         ⚠ D-221-06 — on a WRITE this rung is CAPPED AT ``"ask"``: an application-level
         ``allow`` may not arm a write, though an application-level ``deny`` still denies
         one. The cap tightens; it never loosens.
      3. Otherwise inherit ``connection.default_approval_posture`` (floor ``"ask"``).
      4. Anything unresolvable or illegal returns ``"deny"``.

    ``application`` and ``is_write`` are KEYWORD-ONLY and both default to the pre-221
    behaviour, so every existing two-argument caller resolves exactly as it did before.
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

    if not isinstance(grants, dict):
        grants = {}

    def _connection_id() -> Any:
        if isinstance(connection, dict):
            return connection.get("id")
        return getattr(connection, "id", None)

    # 1. Explicit per-action grant — the most specific thing a person said.
    if tool_name in grants:
        posture = _posture_of(grants[tool_name])
        if posture is not None:
            return posture
        logger.warning(
            "213 GRANT: unrecognized grant value %r for tool %r on connection %r — failing to deny",
            grants[tool_name],
            tool_name,
            _connection_id(),
        )
        return "deny"

    # 2. The application rung (D-221-05).
    if application:
        app_key = application_grant_key(application)
        if app_key in grants:
            posture = _posture_of(grants[app_key])
            if posture is None:
                logger.warning(
                    "221 GRANT: unrecognized grant value %r for application %r on connection %r "
                    "— failing to deny",
                    grants[app_key],
                    application,
                    _connection_id(),
                )
                return "deny"
            # ⚠ D-221-06 — THE ASYMMETRY. An application `allow` is consent to READ.
            # It is not consent to create, overwrite or delete, and the person who set it
            # was never shown the write it would arm. `deny` still travels: the cap only
            # ever tightens.
            if is_write and posture == "allow":
                return "ask"
            return posture

    # 3. Inherit the connection default posture (D-213-06)
    if isinstance(default_posture, str) and default_posture in _LEGAL_POSTURES:
        return default_posture  # type: ignore[return-value]

    # If default_posture is missing, use the default floor "ask"
    if default_posture is None:
        return "ask"

    return "deny"


def is_tool_allowed(
    connection: Any,
    tool_name: str | None,
    *,
    application: str | None = None,
    is_write: bool = False,
) -> bool:
    """Predicate checking if a tool has an effective posture of 'allow'."""
    return (
        resolve_effective_posture(
            connection, tool_name, application=application, is_write=is_write
        )
        == "allow"
    )
