"""Phase 298 (ORG-05) — a workflow may not point at a folder in another organization.

THE RULE (D-13): every folder a workflow definition binds lives in **the definition's org**.

THE SET (D-34): every folder the definition names, in definition order, de-duplicated —
``project_folder_id``, each phase ``config.folder_scope``, each ``inputs[].folder_scope`` (kb_auto)
and ``output_target_folder``.

THE DEFINITION'S ORG ALWAYS COMES FROM THE ROW, never from the viewer's ``X-Org-Id`` (T-298-09). The
one exception is ``create_draft``, where the row does not exist yet and the org is the validated
active org the INSERT stamps on it — the same value the row will carry. System-global definitions
belong to no user's org and are never checked (D-01); ``definition_org_id`` reads them as ``None``.

A FOLDER THAT NO LONGER EXISTS IS NOT AN ORG OFFENDER — today's launch behaviour for a deleted
binding is kept (the audit measured 0 such rows).

THE WORDS (D-14 / UI-SPEC §3), authored here so every surface shows them unchanged:

  * a folder the caller can see —
    *"“Q3 Contracts” is in Acme Legal, not in this workflow's organization (Personal). Pick a folder
    from Personal."* — naming the folder's org leaks nothing: the caller can see the folder, so it
    is theirs or shared to them in an org they belong to;
  * a folder the caller cannot see —
    *"This workflow points at a folder you can't open. Pick a folder from this workflow's
    organization (Personal)."* — the folder's org is never named (T-298-10);
  * more offenders — the first in definition order is named, then
    *" 2 other folders this workflow uses are outside Personal too."*

PARITY WITH PUBLISH (D-13 rule reuse). For an offender in the project / phase-scope arms, when a
supabase client is given, the offence is confirmed with ``harness.scope.folder_scope_violations(...,
restrict_org_ids={definition_org})`` — the publish stage 2.6 rule, unchanged — so a door that holds a
client can never refuse a binding publish accepts. The kb_auto and output arms are not part of that
rule, so they rest on the pool read alone. A door with no client (the two save routes, the scheduler,
the API-key start) rests on the pool read alone for every arm; visibility there is "the caller owns
the folder".

ONE IMPLEMENTATION, FIVE CALLERS (D-30): ``create_draft`` and ``update_draft`` (coded 422, D-36),
``preflight_workflow_kickoff`` (coded 422), ``scheduler_service.launch_scheduled_run`` (a recorded
schedule outcome) and ``inbound.start_workflow_run`` (a plain-string 422).

⛔ No caller passes ``restrict_org_ids=set()`` from here: the visible set is read UNRESTRICTED and the
publish-parity confirm receives a one-element set (T-298-12).
"""
from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status

from app.api.workflow_wire import _coerce_definition
from app.services.harness.scope import folder_scope_violations
from app.utils.folder_utils import fetch_visible_folders

logger = logging.getLogger(__name__)

#: The machine code on the attended 422s. THE CLIENT BRANCHES ON THIS, NEVER ON THE PROSE.
FOLDER_IN_OTHER_ORG = "folder_in_other_org"

_FOLDERS_SQL = "SELECT f.id, f.name, f.org_id, f.user_id FROM folders f WHERE f.id = ANY($1::uuid[])"
_ORG_NAMES_SQL = "SELECT id, name FROM organizations WHERE id = ANY($1::uuid[])"
# The publish gate's own definition-org read, copied (never imported), plus the D-01 skip.
_DEFINITION_ORG_SQL = (
    "SELECT org_id FROM workflow_definitions WHERE id = $1 AND NOT is_system_global"
)
# 298-review WR-06: the org the mig-106 trigger stamps on a header-less INSERT — the trigger's own
# statement (``autofill_org_id_by_owner``), so the check and the stamp read the same membership.
_OWNER_DEFAULT_ORG_SQL = (
    "SELECT om.org_id FROM public.org_members om WHERE om.user_id = $1 LIMIT 1"
)
_STORED_SQL = (
    "SELECT org_id, definition, is_system_global FROM workflow_definitions "
    "WHERE id = $1 AND created_by = $2"
)


def _as_dict(definition: Any) -> dict | None:
    if definition is None:
        return None
    if hasattr(definition, "model_dump"):
        return definition.model_dump(mode="json")
    if isinstance(definition, str):
        # SEED-154: some stored rows are double-encoded — decode until a dict or give up.
        decoded = _coerce_definition(definition)
        if isinstance(decoded, str):
            decoded = _coerce_definition(decoded)
        return decoded if isinstance(decoded, dict) else None
    return _coerce_definition(definition)


def _uuid_str(value: Any) -> str | None:
    if value is None:
        return None
    try:
        return str(UUID(str(value)))
    except (ValueError, TypeError, AttributeError):
        return None


def _arms(definition: Any) -> tuple[list[str], set[str], set[str]]:
    """(the D-34 set in definition order, the project / phase-scope arm ids, the kb_auto / output
    arm ids). One id may sit in both arms."""
    d = _as_dict(definition) or {}
    ordered: list[str] = []
    publish_arm: set[str] = set()
    other_arm: set[str] = set()

    def _add(value: Any, arm: set[str]) -> None:
        fid = _uuid_str(value)
        if fid is None:
            return
        if fid not in ordered:
            ordered.append(fid)
        arm.add(fid)

    _add(d.get("project_folder_id"), publish_arm)
    for phase in d.get("phases") or []:
        config = phase.get("config") if isinstance(phase, dict) else None
        for fid in (config or {}).get("folder_scope") or []:
            _add(fid, publish_arm)
    for spec in d.get("inputs") or []:
        if isinstance(spec, dict):
            for fid in spec.get("folder_scope") or []:
                _add(fid, other_arm)
    _add(d.get("output_target_folder"), other_arm)
    return ordered, publish_arm, other_arm


def bound_folder_ids(definition: Any) -> list[str]:
    """Every folder the definition names (D-34), in definition order, de-duplicated, as strings.

    Accepts a ``WorkflowDefinition``, a dict, or a JSON string (SEED-154). Nulls and anything
    that is not a UUID are ignored.
    """
    return _arms(definition)[0]


async def definition_org_id(pool, definition_id: Any) -> str | None:
    """``workflow_definitions.org_id`` for a non-system-global row, else ``None`` (D-01)."""
    org = await pool.fetchval(_DEFINITION_ORG_SQL, UUID(str(definition_id)))
    return str(org) if org is not None else None


def _plural_tail(others: int, org_label: str) -> str:
    if others <= 0:
        return ""
    if others == 1:
        return f" 1 other folder this workflow uses is outside {org_label} too."
    return f" {others} other folders this workflow uses are outside {org_label} too."


async def _publish_rule_confirms(definition: Any, *, supabase, user_id: str, definition_org: str) -> bool:
    """True when publish stage 2.6's rule, scoped to the definition's org, reports a violation."""
    from app.models.harness import WorkflowDefinition  # function-local: models import nothing here

    model = definition
    if not isinstance(definition, WorkflowDefinition):
        try:
            model = WorkflowDefinition.model_validate(_as_dict(definition))
        except Exception:  # noqa: BLE001 — publish would refuse an invalid definition too
            return True
    violations = await folder_scope_violations(
        model, supabase=supabase, user_id=str(user_id), restrict_org_ids={str(definition_org)}
    )
    return bool(violations)


async def foreign_binding_refusal(
    definition: Any,
    *,
    pool,
    user_id: Any,
    definition_org: Any = None,
    definition_id: Any = None,
    supabase=None,
    candidates: list[str] | None = None,
    owner_default: bool = False,
) -> str | None:
    """The refusal sentence when the definition binds a folder outside its org, else ``None``.

    ``owner_default`` (298-review WR-06, the header-less create): with no ``definition_org`` and no
    ``definition_id``, compare against the org the mig-106 trigger will stamp (the owner's
    ``LIMIT 1`` membership, the trigger's own statement) instead of skipping the check.

    ``candidates`` ``None`` checks the whole bound set (create, launch); a list checks only those
    ids (update: the ids the request adds or changes). ``definition_org`` may be omitted when
    ``definition_id`` is given — the org is then read from the row, and only when there is
    something to check, so an unbound definition costs no query at all.
    """
    ordered, publish_arm, other_arm = _arms(definition)
    if candidates is not None:
        wanted = {_uuid_str(c) for c in candidates}
        ordered = [fid for fid in ordered if fid in wanted]
    if not ordered:
        return None
    org = _uuid_str(definition_org)
    if org is None and definition_id is not None:
        org = await definition_org_id(pool, definition_id)
    if org is None and definition_id is None and owner_default:
        org = _uuid_str(await pool.fetchval(_OWNER_DEFAULT_ORG_SQL, UUID(str(user_id))))
    if org is None:
        return None  # system-global, or no org to compare against: never refuse, never widen

    rows = await pool.fetch(_FOLDERS_SQL, [UUID(fid) for fid in ordered])
    by_id = {str(r["id"]): dict(r) for r in rows}
    offenders = [
        by_id[fid] for fid in ordered
        if fid in by_id and str(by_id[fid].get("org_id")) != org
    ]
    if supabase is not None and any(str(o["id"]) in publish_arm for o in offenders):
        # Publish parity: an offence in the project / phase-scope arms stands only when publish
        # stage 2.6's rule, scoped to the definition's org, reports one too.
        if not await _publish_rule_confirms(
            definition, supabase=supabase, user_id=str(user_id), definition_org=org
        ):
            offenders = [o for o in offenders if str(o["id"]) in other_arm]
    if not offenders:
        return None

    first = offenders[0]
    if supabase is not None:
        visible_ids = {str(f["id"]) for f in await fetch_visible_folders(supabase, str(user_id))}
        visible = str(first["id"]) in visible_ids
    else:
        visible = str(first.get("user_id")) == str(user_id)

    name_ids = [UUID(org)] + ([UUID(str(first["org_id"]))] if visible else [])
    names = {str(r["id"]): r["name"] for r in await pool.fetch(_ORG_NAMES_SQL, name_ids)}
    def_name = names.get(org)
    def_label = def_name or "this workflow's organization"
    tail = _plural_tail(len(offenders) - 1, def_label)
    if not visible:
        where = f" ({def_name})" if def_name else ""
        return (
            "This workflow points at a folder you can't open. "
            f"Pick a folder from this workflow's organization{where}." + tail
        )
    folder_org = names.get(str(first["org_id"])) or "another organization"
    folder_name = first.get("name") or "Untitled folder"
    inside = f" ({def_name})" if def_name else ""
    return (
        f"“{folder_name}” is in {folder_org}, not in this workflow's organization{inside}. "
        f"Pick a folder from {def_label}." + tail
    )


async def raise_if_foreign(definition: Any, **kwargs) -> None:
    """``foreign_binding_refusal``, raised as the coded 422 the attended doors return (D-36)."""
    sentence = await foreign_binding_refusal(definition, **kwargs)
    if sentence is not None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": FOLDER_IN_OTHER_ORG, "message": sentence},
        )


async def changed_binding_refusal(
    pool, definition_id: Any, user_id: Any, new_definition: Any, supabase=None
) -> str | None:
    """The save check for ``update_draft``: only the ids the request ADDS or CHANGES (D-13).

    Reads the stored row only when the new definition binds anything (an unbound autosave costs
    nothing). A row the caller does not own reads ``None`` and the route's own write answers its
    byte-identical 404 (T-196-ORACLE / T-298-13). An unchanged stored foreign binding saves
    through: it is preserved, never stripped.
    """
    new_ids = bound_folder_ids(new_definition)
    if not new_ids:
        return None
    row = await pool.fetchrow(_STORED_SQL, UUID(str(definition_id)), UUID(str(user_id)))
    if row is None or row.get("is_system_global"):
        return None
    stored_ids = set(bound_folder_ids(row.get("definition")))
    return await foreign_binding_refusal(
        new_definition,
        pool=pool,
        user_id=user_id,
        definition_org=row.get("org_id"),
        supabase=supabase,
        candidates=[fid for fid in new_ids if fid not in stored_ids],
    )


async def raise_if_foreign_change(
    pool, definition_id: Any, user_id: Any, new_definition: Any, supabase=None
) -> None:
    """``changed_binding_refusal``, raised as the coded 422 (D-36)."""
    sentence = await changed_binding_refusal(pool, definition_id, user_id, new_definition, supabase)
    if sentence is not None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": FOLDER_IN_OTHER_ORG, "message": sentence},
        )


__all__ = [
    "FOLDER_IN_OTHER_ORG",
    "bound_folder_ids",
    "changed_binding_refusal",
    "definition_org_id",
    "foreign_binding_refusal",
    "raise_if_foreign",
    "raise_if_foreign_change",
]
