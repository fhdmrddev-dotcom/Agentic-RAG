"""Phase 305-03 (KEY-07; D-26 / D-53; T-305-12 / T-305-29) — the one audit row per MCP call.

No new audit literal (304 D-36) and no change to ``audit_service.py``: rows go through the 293
writers in ``security/api_key_auth``.

* ``audit_answered`` — ``api_key.read`` with ``{kind: mcp, tool, outcome}``; ``outcome`` is ``ok``,
  ``error``, (305-04) ``redaction_blocked`` or (305-REVIEW WR-04) ``not_available`` — a handler's
  refusal sentence, which the client receives as ``isError``. Not throttled: answered calls are
  already bounded by the two per-key buckets, which count every granted call before its arguments
  are validated (305-REVIEW WR-01).
* ``audit_refused`` — ``api_key.refused`` with ``outcome: refused`` and a reason from the ONE reason
  vocabulary (``rate_limited:read`` / ``rate_limited:expensive`` / ``tool_not_granted`` /
  ``limiter_unavailable`` / ``maintenance``), throttled through ``refusal_audit_slot`` exactly as
  ``inbound._refused`` is (293-REVIEW CR-02): a suppressed refusal is COUNTED, and the next written
  row carries ``detail.suppressed`` — never silently dropped.

Always ``audit_key_call_now`` (awaited), never ``audit_key_call``: there is no FastAPI handler here
whose BackgroundTasks would run. Neither helper takes a query or any tool argument (T-305-29). A
failure to audit is logged and never fails the call.
"""
from __future__ import annotations

import logging
from typing import Any

from app.security.api_key_auth import audit_key_call_now, refusal_audit_slot

logger = logging.getLogger("app.mcp")


def _key(principal: Any) -> dict:
    """The audit writer's key shape, built only from the principal (never from request data)."""
    return {
        "id": principal.key_id,
        "label": getattr(principal, "label", None),
        "user_id": principal.user_id,
        "org_id": principal.org_id,
        "kind": "mcp",
    }


async def audit_answered(principal: Any, *, tool: str | None, outcome: str) -> None:
    try:
        await audit_key_call_now(_key(principal), "api_key.read", call="read", outcome=outcome, tool=tool)
    except Exception:  # noqa: BLE001 — an audit failure must never fail the call
        logger.warning("mcp audit write failed (tool=%s outcome=%s)", tool, outcome, exc_info=True)


async def audit_refused(
    principal: Any, *, tool: str | None, reason: str, redis: Any, detail: dict | None = None
) -> None:
    try:
        suppressed = await refusal_audit_slot(redis, key_id=str(principal.key_id), reason=reason)
        if suppressed is None:
            return  # counted; the next written row of this (key, reason) names it
        if suppressed:
            detail = {**(detail or {}), "suppressed": suppressed}
        await audit_key_call_now(
            _key(principal), "api_key.refused", call="read", outcome="refused",
            reason=reason, detail=detail, tool=tool,
        )
    except Exception:  # noqa: BLE001 — an audit failure must never fail the call
        logger.warning("mcp refusal audit failed (tool=%s reason=%s)", tool, reason, exc_info=True)
