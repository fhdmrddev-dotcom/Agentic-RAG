"""Phase 306-01 (D-39, D-11) — the start validation of a key-started run, moved out of ``api/inbound.py``.

Pure move (306-01, D-39): the checks ``start_workflow_run`` ran between its per-key limiter and the
launch, in the SAME order, so 306-05's MCP ``run_workflow`` and ``/inbound`` cannot drift (the
``unattended_launch`` "share, not copy" rule):

  kill switch → listed on the key → in the key's org → readable by the owner → published →
  entitled → the definition parses → template bound → no foreign folder → declared inputs.

It RETURNS a value and never raises: ``KeyStartRefusal`` names the audit reason, the HTTP status,
the response detail, the audit ``extra`` and the workflow reference the audit row carries; the
route builds the ``HTTPException`` exactly as before. ``KeyStartOk`` carries what the launch needs.
Nothing here imports fastapi — the entitlement exception is caught by its Starlette base class,
which ``fastapi.HTTPException`` (and therefore both entitlement exceptions) subclass.

The refusal sentences stay where they are defined (``api/inbound.py``, ``unattended_launch``) and
are imported at call time, never retyped. Collaborators are reached by MODULE ATTRIBUTE at call
time (``api_keys_db.get_key_workflows``, ``unattended_launch.X``,
``entitlement_service.enforce_entitlement``), so the 293/296/298 suites' patches still land.

Pinned by ``tests/unit/test_306_key_run_pure_move.py`` (Fence C: the call order equals the base).
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from starlette.exceptions import HTTPException as _HTTPException

from app.db import api_keys as api_keys_db
from app.services.foreign_folder_refusal import foreign_binding_refusal  # 298 ORG-05 (D-30)
from app.services.inbound_inputs import InboundInputRefused, validate_inbound_inputs

# The scoped existence read: a row outside the key's org (and not system-global) reads exactly
# like a row that does not exist (D-06).
_SCOPE_SQL = (
    "SELECT id FROM workflow_definitions "
    "WHERE id = $1 AND (org_id = $2 OR is_system_global = true)"
)

@dataclass(frozen=True)
class KeyStartRefusal:
    """One refusal: ``reason`` is the audit reason, ``http_status``/``detail`` the response,
    ``extra`` the audit detail, ``workflow_ref`` the workflow id the audit row names, and ``exc``
    the exception received when a collaborator raised one (entitlement) — re-raised as-is.

    A 404 carries ``detail=None``: every miss is ONE answer (D-06), the caller's own not-found."""

    reason: str
    http_status: int
    detail: Any
    extra: dict | None
    workflow_ref: str | None = None
    exc: Any = None


@dataclass(frozen=True)
class KeyStartOk:
    wid: UUID
    raw: dict
    row: dict
    definition: Any
    values: dict
    name: str


def _raw_definition(value: Any) -> dict | None:
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except (ValueError, TypeError):
            return None
    return value if isinstance(value, dict) else None


async def validate_key_start(
    pool,
    *,
    workflow_id: str,
    listed_ids: set[str],
    org_id: UUID,
    owner_id: UUID,
    inputs: dict,
    log_ref: str,
) -> KeyStartOk | KeyStartRefusal:
    """Every check a key start runs before the launch, in order. Never raises a refusal."""
    from app.api.inbound import CANNOT_RUN_DETAIL, UNPUBLISHED_DETAIL, _as_uuid  # noqa: PLC0415
    from app.services import entitlement_service, unattended_launch  # noqa: PLC0415

    # 293-REVIEW CR-01: the operator's workflows kill switch stops this door too, before any
    # other read, in the in-app kickoff's own 403 sentence.
    if unattended_launch.workflows_disabled():
        return KeyStartRefusal("workflows_disabled", 403, unattended_launch.WORKFLOWS_DISABLED_DETAIL,
                               None, workflow_id)

    wid = _as_uuid(workflow_id)
    if wid is None or str(wid) not in listed_ids:
        return KeyStartRefusal("not_on_key", 404, None, None, workflow_id)

    if await pool.fetchrow(_SCOPE_SQL, wid, org_id) is None:
        return KeyStartRefusal("not_on_key", 404, None, {"deleted": True}, str(wid))

    rows = await api_keys_db.get_key_workflows(
        pool, workflow_ids=[wid], user_id=owner_id, org_id=org_id
    )
    row = next((r for r in rows if str(r.get("id")) == str(wid)), None)
    if row is None or not row.get("readable"):
        return KeyStartRefusal("cannot_run", 403, CANNOT_RUN_DETAIL, None, str(wid))
    if row.get("status") != "published":
        return KeyStartRefusal("unpublished", 409, UNPUBLISHED_DETAIL, None, str(wid))

    try:
        await entitlement_service.enforce_entitlement(pool, org_id, "workflows")
    except _HTTPException as exc:
        return KeyStartRefusal("entitlement", exc.status_code, exc.detail, None, str(wid), exc)

    raw = _raw_definition(row.get("definition"))
    definition = (
        unattended_launch.parse_definition_row({"definition": raw}, log_ref=log_ref)
        if raw is not None else None
    )
    if definition is None:
        return KeyStartRefusal("cannot_run", 403, CANNOT_RUN_DETAIL, None, str(wid))

    sentence = unattended_launch.template_refusal(definition)
    if sentence is not None:
        return KeyStartRefusal("no_template", 422, sentence, None, str(wid))
    # 298 (D-13/D-30): a folder outside the definition's org (read from the row) → plain-string 422.
    sentence = await foreign_binding_refusal(definition, definition_id=wid, pool=pool, user_id=owner_id)
    if sentence is not None:
        return KeyStartRefusal("foreign_folder", 422, sentence, None, str(wid))

    try:
        values = validate_inbound_inputs(raw, inputs)
    except InboundInputRefused as refusal:
        return KeyStartRefusal(
            refusal.code, 422, refusal.detail,
            {"names": refusal.names} if refusal.names else None, str(wid),
        )

    name = definition.name or row.get("name") or "workflow"
    return KeyStartOk(wid=wid, raw=raw, row=row, definition=definition, values=values, name=name)
