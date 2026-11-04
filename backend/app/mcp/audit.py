"""Phase 305-03 (KEY-07; D-26 / D-53; T-305-12 / T-305-29) — the one audit row per MCP call.

No new audit literal (304 D-36) and no change to ``audit_service.py``: the row's metadata is built
by the 293 builder ``security/api_key_auth._audit_args`` (one shape for every ``api_key.*`` row).

* ``audit_answered`` — ``api_key.read`` with ``{kind: mcp, tool, outcome}`` (306-04: plus ``run_id``
  for an ask, the handle it answered); ``outcome`` is ``ok``,
  ``error``, (305-04) ``redaction_blocked`` or (305-REVIEW WR-04) ``not_available`` — a handler's
  refusal sentence, which the client receives as ``isError``. Not throttled: answered calls are
  already bounded by the two per-key buckets, which count every granted call before its arguments
  are validated (305-REVIEW WR-01).
* ``audit_refused`` — ``api_key.refused`` with ``outcome: refused`` and a reason from the ONE reason
  vocabulary (``rate_limited:read`` / ``rate_limited:expensive`` / ``tool_not_granted`` /
  ``limiter_unavailable`` / ``maintenance``), throttled through ``refusal_audit_slot`` exactly as
  ``inbound._refused`` is (293-REVIEW CR-02): a suppressed refusal is COUNTED, and the next written
  row carries ``detail.suppressed`` — never silently dropped.

BUG-261031-04: the row is ONE parameterized INSERT on the asyncpg pool (``insert_audit_row``), the
path ``mcp_usage`` rows take. It used to go through ``audit_key_call_now``: a NEW supabase-py client
per row (~0.19 s of GIL-held work) plus a PostgREST insert, two threadpool hops inside dispatch's
shielded bound. Under concurrency those hops serialized (30 rows ~7-25 s), the bound fired between
them, and the row was cancelled with no log line — measured: 32 concurrent calls, 0 rows. An
asyncpg insert takes milliseconds and is cancellable, so the bound really bounds it too.

``org_id`` is explicit in every row (the pool is service-role; ``BYPASSRLS``), taken from the
principal and nowhere else. Neither helper takes a query or any tool argument (T-305-29). A failure
to audit is logged (tool, key, write) and never fails the call.
"""
from __future__ import annotations

import json
import logging
from typing import Any

import anyio

from app.dependencies import get_pg_pool
from app.security.api_key_auth import (
    _audit_args,
    refusal_audit_slot,
    restore_suppressed_refusals,
)

logger = logging.getLogger("app.mcp")

#: 305-REVIEW LF-03: the most a suppressed-count restore may take once the write was cancelled.
_RESTORE_DEADLINE_S = 1.0

_INSERT = (
    "INSERT INTO public.audit_log (user_id, action_type, metadata, org_id) "
    "VALUES ($1::uuid, $2, $3::text::jsonb, $4::uuid)"
)


def _key(principal: Any) -> dict:
    """The audit writer's key shape, built only from the principal (never from request data)."""
    return {
        "id": principal.key_id,
        "label": getattr(principal, "label", None),
        "user_id": principal.user_id,
        "org_id": principal.org_id,
        "kind": "mcp",
    }


async def insert_audit_row(user_id: str, action_type: str, metadata: dict, org_id: str) -> None:
    """The ONE write: an ``audit_log`` row on the asyncpg pool. Raises on failure (callers log)."""
    pool = await get_pg_pool()
    await pool.execute(_INSERT, user_id, action_type, json.dumps(metadata), org_id)


async def _write(principal: Any, action_type: str, **fields: Any) -> None:
    user_id, metadata, org_id = _audit_args(
        _key(principal), call="read", workflow_id=None, run_id=fields.get("run_id"),
        outcome=fields.get("outcome"), reason=fields.get("reason"),
        detail=fields.get("detail"), tool=fields.get("tool"),
    )
    await insert_audit_row(user_id, action_type, metadata, org_id)


async def audit_answered(principal: Any, *, tool: str | None, outcome: str, run_id: Any = None) -> None:
    try:
        await _write(principal, "api_key.read", outcome=outcome, tool=tool, run_id=run_id)
    except Exception:  # noqa: BLE001 — an audit failure must never fail the call
        logger.error("mcp audit row NOT written (tool=%s key=%s write=api_key.read outcome=%s)",
                     tool, principal.key_id, outcome, exc_info=True)


async def audit_refused(
    principal: Any, *, tool: str | None, reason: str, redis: Any, detail: dict | None = None
) -> None:
    # 305-REVIEW LF-03: the slot hands this row the count of refusals it suppressed (and clears it
    # in Redis). If the row is then not written, that count goes BACK, so the next written row of
    # this (key, reason) still names it — on a failed INSERT and on a fired bookkeeping bound alike.
    suppressed = 0
    try:
        slot = await refusal_audit_slot(redis, key_id=str(principal.key_id), reason=reason)
        if slot is None:
            return  # counted; the next written row of this (key, reason) names it
        suppressed = slot
        if suppressed:
            detail = {**(detail or {}), "suppressed": suppressed}
        await _write(principal, "api_key.refused", outcome="refused", reason=reason,
                     detail=detail, tool=tool)
    except anyio.get_cancelled_exc_class():
        # dispatch's bound fired mid-write (it logs the lost row). Restore under a short shield of
        # its own, then let the cancellation through. (If the server had already committed the
        # row, the count is named twice — an over-count, never a silent loss.)
        with anyio.move_on_after(_RESTORE_DEADLINE_S, shield=True):
            await _restore(principal, reason, redis, suppressed)
        raise
    except Exception:  # noqa: BLE001 — an audit failure must never fail the call
        logger.error("mcp audit row NOT written (tool=%s key=%s write=api_key.refused reason=%s "
                     "suppressed=%d)", tool, principal.key_id, reason, suppressed, exc_info=True)
        await _restore(principal, reason, redis, suppressed)


async def _restore(principal: Any, reason: str, redis: Any, suppressed: int) -> None:
    if suppressed and not await restore_suppressed_refusals(
        redis, key_id=str(principal.key_id), reason=reason, count=suppressed
    ):
        logger.error("mcp refusal count LOST: %d suppressed refusal(s) (key=%s reason=%s) could not "
                     "be restored", suppressed, principal.key_id, reason)
