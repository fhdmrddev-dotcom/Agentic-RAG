"""Phase 293 (START-02; D-02, D-03, D-04, D-11, D-16, D-17, D-18, D-19) — managing API keys.

Two routers in one module, the ``api/schedules.py`` shape; ``main.py`` mounts both:

  * ``/api-keys`` — a member's OWN keys in the active org: list (with the effective limits and
    each key's recent calls), the picker of startable workflows, create, revoke.
  * ``/org/api-keys`` — an org admin sees and revokes EVERY key in the org (D-03), behind
    ``require_org_manage``.

**Security posture.**

  * ⛔ The secret leaves the server exactly once, in the 201 of ``POST /api-keys``
    (``ApiKeyCreated`` is the only model with a ``secret`` field). It is never stored — only its
    SHA-256 digest is — and no response anywhere carries the digest (T-293-02, D-19).
  * Every workflow a key names is re-read with the caller's scope (own in the active org, or a
    published global) and must be PUBLISHED and need no file upload (T-293-04, D-02, D-11). A
    foreign id and an unknown id are refused with the SAME sentence, so the refusal never
    confirms that someone else's workflow exists.
  * A key PINS the definition row it was made for (orchestrator ruling 1 / assumption A7), as a
    schedule does: a later version is a new row and needs a new key.
  * Creating a key needs the ``workflows`` capability (assumption A5), the same gate as creating
    a schedule. Listing and revoking need none — a member can always see and stop their own keys.
  * Every miss is a 404, never a 403: a member's revoke of someone else's key reads exactly like
    a revoke of a key that does not exist (D-06).
  * All I/O is the asyncpg pool (no supabase-py inside an async handler, D-v2.5-01). Audit rows
    go through ``audit_key_call`` (fire-and-forget), naming the key id and label only.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

import asyncpg
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status

from app.db import api_keys as api_keys_db
from app.dependencies import (
    get_active_org_id,
    get_current_user,
    get_pg_pool,
    require_org_manage,
)
from app.models.api_key import (
    ApiKeyCall,
    ApiKeyCreateBody,
    ApiKeyCreated,
    ApiKeyLimits,
    ApiKeyList,
    ApiKeyRead,
    ApiKeyWorkflowRef,
    StartableField,
    StartableWorkflow,
    StartableWorkflowList,
)
from app.models.user_settings import load_app_settings_async
from app.security.api_key_auth import audit_key_call, mint_key
from app.services.entitlement_service import require_capability
from app.services.inbound_inputs import declared_fields, needs_file_upload

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api-keys", tags=["api-keys"])
org_router = APIRouter(prefix="/org/api-keys", tags=["api-keys"])

_NOT_FOUND = "API key not found."
_CALL_WINDOW = timedelta(days=30)
_CALLS_PER_KEY = 50


def _uuid(value) -> UUID:
    return value if isinstance(value, UUID) else UUID(str(value))


async def _limits() -> ApiKeyLimits:
    s = await load_app_settings_async()
    return ApiKeyLimits(
        starts_per_minute=int(s.api_key_starts_per_minute),
        reads_per_minute=int(s.api_key_reads_per_minute),
    )


def _key_state(row: dict, now: datetime) -> str:
    if row.get("revoked_at") is not None:
        return "revoked"
    exp = row.get("expires_at")
    if exp is not None and exp <= now:
        return "expired"
    return "active"


def _ref_state(found: dict | None) -> str:
    """A workflow on a key, as it stands NOW (D-17 — the card says why a call would be refused)."""
    if found is None:
        return "deleted"
    if not found.get("readable"):
        return "cannot_run"
    if found.get("status") != "published":
        return "unpublished"
    if needs_file_upload(declared_fields(found.get("definition") or {})):
        return "file_upload"
    return "startable"


def _call_from_audit(row: dict, names: dict[str, str]) -> ApiKeyCall:
    md = row.get("metadata") or {}
    action = row.get("action_type") or ""
    verb = md.get("call")
    if verb not in ("start", "read"):
        verb = "read" if action == "api_key.read" else "start"
    wf = md.get("workflow_id")
    return ApiKeyCall(
        at=row["created_at"],
        verb=verb,
        workflow_id=wf,
        workflow_name=names.get(str(wf)) if wf else None,
        run_id=md.get("run_id"),
        ok=action != "api_key.refused",
        outcome=md.get("outcome"),
        reason=md.get("reason"),
        detail=md.get("detail") if isinstance(md.get("detail"), dict) else None,
    )


async def _serialize_keys(
    pool: asyncpg.Pool, rows: list[dict], *, caller: UUID, org_id: UUID
) -> list[ApiKeyRead]:
    """Rows -> wire models, with live workflow states and recent calls.

    ⚠ ONE of the three places the projection lives (with ``db/api_keys._KEY_COLUMNS`` and
    ``ApiKeyRead``). Workflow readability is judged against each key's OWNER — that is whose
    rights a call with the key runs under.
    """
    if not rows:
        return []
    now = datetime.now(timezone.utc)

    by_owner: dict[str, set[str]] = {}
    for r in rows:
        ids = {str(w.get("id")) for w in (r.get("workflows") or []) if w.get("id")}
        by_owner.setdefault(str(r["user_id"]), set()).update(ids)
    found: dict[tuple[str, str], dict] = {}
    for owner, ids in by_owner.items():
        wf_rows = await api_keys_db.get_key_workflows(
            pool, workflow_ids=[_uuid(i) for i in ids], user_id=_uuid(owner), org_id=org_id
        )
        for w in wf_rows:
            found[(owner, str(w["id"]))] = w

    calls_by_key: dict[str, list[dict]] = {}
    audit_rows = await api_keys_db.list_key_calls(
        pool, org_id=org_id, key_ids=[str(r["id"]) for r in rows], since=now - _CALL_WINDOW
    )
    for a in audit_rows:
        kid = str((a.get("metadata") or {}).get("api_key_id"))
        calls_by_key.setdefault(kid, []).append(a)

    out: list[ApiKeyRead] = []
    for r in rows:
        owner = str(r["user_id"])
        snapshot = r.get("workflows") or []
        names = {str(w.get("id")): w.get("name") or "" for w in snapshot}
        refs = [
            ApiKeyWorkflowRef(
                id=str(w.get("id")),
                name=w.get("name") or "",
                state=_ref_state(found.get((owner, str(w.get("id"))))),
            )
            for w in snapshot
        ]
        revoked_by = r.get("revoked_by")
        out.append(
            ApiKeyRead(
                id=str(r["id"]),
                label=r["label"],
                key_prefix=r["key_prefix"],
                workflows=refs,
                state=_key_state(r, now),
                expires_at=r.get("expires_at"),
                revoked_at=r.get("revoked_at"),
                revoked_by_name=r.get("revoked_by_name"),
                revoked_by_admin=revoked_by is not None and str(revoked_by) != owner,
                last_used_at=r.get("last_used_at"),
                created_at=r["created_at"],
                owner_name=r.get("owner_name"),
                owner_is_you=owner == str(caller),
                calls=[
                    _call_from_audit(a, names)
                    for a in calls_by_key.get(str(r["id"]), [])[:_CALLS_PER_KEY]
                ],
            )
        )
    return out


def _caller(current_user: dict) -> UUID:
    return _uuid(current_user["id"])


# ── the member's own keys ───────────────────────────────────────────────────────────────────────


@router.get("", response_model=ApiKeyList)
async def list_my_keys(
    current_user: dict = Depends(get_current_user),
    active_org: str = Depends(get_active_org_id),
    pool: asyncpg.Pool = Depends(get_pg_pool),
) -> ApiKeyList:
    """The caller's keys in the active org, the effective per-key limits, and each key's calls
    in the last 30 days (D-17)."""
    caller, org = _caller(current_user), _uuid(active_org)
    rows = await api_keys_db.list_keys_for_owner(pool, org_id=org, user_id=caller)
    keys = await _serialize_keys(pool, rows, caller=caller, org_id=org)
    return ApiKeyList(keys=keys, limits=await _limits())


@router.get("/startable-workflows", response_model=StartableWorkflowList)
async def list_startable_workflows(
    current_user: dict = Depends(get_current_user),
    active_org: str = Depends(get_active_org_id),
    pool: asyncpg.Pool = Depends(get_pg_pool),
) -> StartableWorkflowList:
    """The caller's published workflows in the active org, each with its declared launch fields.
    A workflow that needs a file upload is listed but not startable; drafts are counted, not
    listed."""
    caller, org = _caller(current_user), _uuid(active_org)
    rows = await api_keys_db.list_startable_candidates(pool, user_id=caller, org_id=org)
    workflows = []
    for w in rows:
        fields = declared_fields(w.get("definition") or {})
        file_upload = needs_file_upload(fields)
        workflows.append(
            StartableWorkflow(
                id=str(w["id"]),
                name=w["name"],
                fields=[StartableField(key=f.key, label=f.label, required=f.required) for f in fields],
                startable=not file_upload,
                reason="file_upload" if file_upload else None,
            )
        )
    drafts = await api_keys_db.count_own_drafts(pool, user_id=caller, org_id=org)
    return StartableWorkflowList(workflows=workflows, drafts_hidden=drafts)


@router.post(
    "",
    response_model=ApiKeyCreated,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_capability("workflows"))],  # assumption A5
)
async def create_key(
    body: ApiKeyCreateBody,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    active_org: str = Depends(get_active_org_id),
    pool: asyncpg.Pool = Depends(get_pg_pool),
) -> ApiKeyCreated:
    """Make a key for one or more of the caller's published workflows. The response is the ONLY
    place the secret ever appears."""
    caller, org = _caller(current_user), _uuid(active_org)

    rows = await api_keys_db.get_key_workflows(
        pool, workflow_ids=list(body.workflow_ids), user_id=caller, org_id=org
    )
    by_id = {str(r["id"]): r for r in rows}
    snapshot: list[dict] = []
    for wid in body.workflow_ids:
        row = by_id.get(str(wid))
        if row is None or not row.get("readable"):
            # Unknown and not-yours read the same, so the refusal confirms nothing.
            raise HTTPException(
                status_code=422,
                detail=(
                    f"One of the picked workflows can't be found, or you can't start it: {wid}."
                ),
            )
        name = row.get("name") or ""
        if row.get("status") != "published":
            raise HTTPException(
                status_code=422,
                detail=(
                    f"{name} is a draft. Only a published workflow can be started with a key; "
                    "publish it first."
                ),
            )
        if needs_file_upload(declared_fields(row.get("definition") or {})):
            raise HTTPException(
                status_code=422,
                detail=f"{name} needs a file upload, which a key can't send yet.",
            )
        snapshot.append({"id": str(wid), "name": name})

    minted = mint_key()
    expires_at = (
        datetime.now(timezone.utc) + timedelta(days=body.expires_in_days)
        if body.expires_in_days is not None
        else None
    )
    try:
        row = await api_keys_db.create_api_key(
            pool,
            org_id=org,
            user_id=caller,
            label=body.label,
            key_prefix=minted.key_prefix,
            key_hash=minted.key_hash,
            workflows=snapshot,
            expires_at=expires_at,
        )
    except api_keys_db.DuplicateKeyLabel:
        raise HTTPException(
            status_code=409,
            detail=f"You already have an active key called {body.label}. Pick another label.",
        )

    audit_key_call(
        background_tasks,
        {"id": row["id"], "label": row["label"], "user_id": caller, "org_id": org},
        "api_key.create",
        call="manage",
    )
    (key,) = await _serialize_keys(pool, [row], caller=caller, org_id=org)
    return ApiKeyCreated(key=key, secret=minted.secret)


@router.post("/{key_id}/revoke", response_model=ApiKeyRead)
async def revoke_my_key(
    key_id: UUID,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    active_org: str = Depends(get_active_org_id),
    pool: asyncpg.Pool = Depends(get_pg_pool),
) -> ApiKeyRead:
    """Revoke one of the caller's own keys. 404 for a miss AND for someone else's key."""
    caller, org = _caller(current_user), _uuid(active_org)
    row = await api_keys_db.revoke_key(
        pool, key_id=key_id, org_id=org, owner_id=caller, revoked_by=caller
    )
    if row is None:
        raise HTTPException(status_code=404, detail=_NOT_FOUND)
    audit_key_call(
        background_tasks,
        {"id": row["id"], "label": row["label"], "user_id": caller, "org_id": org},
        "api_key.revoke",
        call="manage",
    )
    (key,) = await _serialize_keys(pool, [row], caller=caller, org_id=org)
    return key


# ── the org admin's view ────────────────────────────────────────────────────────────────────────


@org_router.get("", response_model=ApiKeyList)
async def list_org_keys(
    current_user: dict = Depends(require_org_manage),
    active_org: str = Depends(get_active_org_id),
    pool: asyncpg.Pool = Depends(get_pg_pool),
) -> ApiKeyList:
    """Every key in the active org, with its owner (D-03)."""
    caller, org = _caller(current_user), _uuid(active_org)
    rows = await api_keys_db.list_keys_for_org(pool, org_id=org)
    keys = await _serialize_keys(pool, rows, caller=caller, org_id=org)
    return ApiKeyList(keys=keys, limits=await _limits())


@org_router.post("/{key_id}/revoke", response_model=ApiKeyRead)
async def revoke_org_key(
    key_id: UUID,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_org_manage),
    active_org: str = Depends(get_active_org_id),
    pool: asyncpg.Pool = Depends(get_pg_pool),
) -> ApiKeyRead:
    """An admin revokes any key in the org. The audit row is the ADMIN's (who acted), and
    names the key's owner."""
    caller, org = _caller(current_user), _uuid(active_org)
    row = await api_keys_db.revoke_key(
        pool, key_id=key_id, org_id=org, owner_id=None, revoked_by=caller
    )
    if row is None:
        raise HTTPException(status_code=404, detail=_NOT_FOUND)
    audit_key_call(
        background_tasks,
        {"id": row["id"], "label": row["label"], "user_id": caller, "org_id": org},
        "api_key.revoke",
        call="manage",
        detail={"by_admin": True, "owner_id": str(row["user_id"])},
    )
    (key,) = await _serialize_keys(pool, [row], caller=caller, org_id=org)
    return key
