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
  * Creating a WORKFLOW key needs the ``workflows`` capability (assumption A5), the same gate as
    creating a schedule. Listing and revoking need none — a member can always see and stop their
    own keys. ⚠ Phase 304 D-41: an MCP key needs NO tier capability (the org and deployment
    switches are its controls); the check runs inside ``create_key`` for ``kind='workflow'`` only.
    Owed: operator confirmation before 304+305 deploy (TIER-02, a pricing one-way door).

**Phase 304 — MCP keys on the same routes (D-25), never a parallel family.**

  * ``kind="mcp"`` is refused, before anything is minted, when the deployment or the org switch
    is off (403, the ``principal_liveness`` sentences), and with a plain 422 sentence for an
    empty / unknown / orphaned tool selection (``normalise_tool_selection``), an empty folder list
    (D-08: empty never means "all") or a folder the member cannot see in the active org.
  * ⛔ Folders are judged on the member's OWN acting visibility — ``acting_member_connection`` +
    ``list_acting_folders`` (RLS + the acting-org GUC) — never the service role. A foreign, a
    deleted and an unknown folder read the same, so the refusal confirms nothing.
  * The tool catalogue, the MCP URL and the switch state are served on every list (``mcp``), so
    the client never retypes them. The org switch (``/org/api-keys/mcp-access``) is behind
    ``require_org_manage`` and audited as ``settings.update`` + ``metadata.event='mcp_access'``
    (D-36: no new audit literal).
  * Every miss is a 404, never a 403: a member's revoke of someone else's key reads exactly like
    a revoke of a key that does not exist (D-06).
  * All I/O is the asyncpg pool (no supabase-py inside an async handler, D-v2.5-01). Audit rows
    go through ``audit_key_call`` (fire-and-forget), naming the key id and label only.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, BackgroundTasks, Body, Depends, HTTPException, status
from starlette.concurrency import run_in_threadpool

from app.db import api_keys as api_keys_db
from app.db import outbound_policy
from app.dependencies import (
    get_active_org_id,
    get_current_user,
    get_pg_pool,
    get_service_role_supabase,
    require_org_manage,
)
from app.models.api_key import (
    ApiKeyCall,
    ApiKeyCreateBody,
    ApiKeyCreated,
    ApiKeyCreateRequest,
    ApiKeyFolderRef,
    ApiKeyLimits,
    ApiKeyList,
    ApiKeyRead,
    ApiKeyWorkflowRef,
    McpAvailability,
    McpKeyCreateBody,
    McpToolRef,
    OrgMcpAccess,
    OrgMcpAccessUpdate,
    OrgPiiRedaction,
    OrgPiiRedactionUpdate,
    PickableFolder,
    PickableFolderList,
    StartableField,
    StartableWorkflow,
    StartableWorkflowList,
)
from app.models.user_settings import load_app_settings_async
from app.security.acting_member import acting_member_connection
from app.security.api_key_auth import audit_key_call, mint_key
from app.services.acting_member_reads import list_acting_folders
from app.services.audit_service import write_audit_entry
from app.services.entitlement_service import enforce_entitlement
from app.services.inbound_inputs import declared_fields, needs_file_upload, needs_typed_task
from app.services.key_scope import EXTERNAL_SQL
from app.services.mcp_narrowing import (
    _FOLDER_NOT_VISIBLE,  # noqa: F401 — re-exported, the same object (307-03 move fence)
    MCP_STATE_UNKNOWN_SENTENCE,  # noqa: F401 — re-exported, the same object
    NarrowingRefusal,
    mcp_off,
    validate_mcp_narrowing,
)
from app.services.mcp_tool_catalogue import MCP_TOOLS, mcp_url
from app.services.sources.mail.mailbox import FOLDER_PREFIX, MAIL_MIME, MAIL_ROOT_ID

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api-keys", tags=["api-keys"])
org_router = APIRouter(prefix="/org/api-keys", tags=["api-keys"])

_NOT_FOUND = "API key not found."
_CALL_WINDOW = timedelta(days=30)
_CALLS_PER_KEY = 50

# Phase 304 — a foreign, a deleted and an unknown folder all read ``_FOLDER_NOT_VISIBLE`` (T-304-28).
# 307-03: it moved to ``services/mcp_narrowing.py`` with the checks that say it; the name imported
# above is the SAME object (``test_307_narrowing_move``).

# The catalogue as served to the client, in catalogue order (D-11; never retyped there).
_MCP_CATALOGUE = [
    McpToolRef(name=t.name, group=t.group, label=t.label, travels_with=t.travels_with)
    for t in MCP_TOOLS
]

# D-40: a UI hint only — which pickable folders are fed by a connector. ONE statement on the
# member's acting connection (RLS decides what it sees): a folder a watch writes into, or one that
# holds a connector-fed document (``EXTERNAL_SQL``, the KeyScope module's one predicate home).
# ``is_mail`` is a watch on a mail label / the mailbox root, or a connector-fed mail message.
_SOURCE_HINT_SQL = (
    "SELECT s.folder_id, bool_or(s.is_mail) AS is_mail FROM ("
    "SELECT library_folder_id AS folder_id, "
    "(source_folder_id = $1 OR starts_with(source_folder_id, $2)) AS is_mail "
    "FROM public.connector_watches WHERE library_folder_id IS NOT NULL "
    "UNION ALL "
    "SELECT folder_id, (mime_type = $3) AS is_mail "
    f"FROM public.documents WHERE folder_id IS NOT NULL AND {EXTERNAL_SQL}"
    ") s GROUP BY s.folder_id"
)

_UNREAD = object()   # ``_serialize_keys``: the switches have not been read yet

# 304-REVIEW WR-02 (``MCP_STATE_UNKNOWN_SENTENCE``) and the switch order (``_mcp_off``) moved to
# ``services/mcp_narrowing.py`` in 307-03; both names here are the SAME objects, re-exported.
_mcp_off = mcp_off


async def _read_switches(pool: asyncpg.Pool, org: UUID) -> dict | None:
    """The switch state for a LIST (display only). A failed read is ``None`` -> ``"unknown"``
    (fail closed: the MCP choice is hidden, and no switch is named) and the keys still list —
    e.g. a backend booted before migration 221 reached its database. The create path reads the
    switches WITHOUT this guard, so a failed read there is an error, never a mint."""
    try:
        return await api_keys_db.mcp_switches(pool, org)
    except Exception as exc:  # noqa: BLE001 — display-only, fail closed, logged
        logger.warning("could not read the MCP switches for org %s (%s)", org, type(exc).__name__)
        return None


def _mcp_block(switches: dict | None) -> McpAvailability:
    off = _mcp_off(switches)
    return McpAvailability(
        available=off not in ("deployment", "unknown"), off=off, url=mcp_url(), tools=_MCP_CATALOGUE
    )


def _uuid(value) -> UUID:
    return value if isinstance(value, UUID) else UUID(str(value))


async def _limits() -> ApiKeyLimits:
    s = await load_app_settings_async()
    return ApiKeyLimits(
        starts_per_minute=int(s.api_key_starts_per_minute),
        reads_per_minute=int(s.api_key_reads_per_minute),
        searches_per_minute=int(s.api_key_searches_per_minute),
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
    fields = declared_fields(found.get("definition") or {})
    if needs_file_upload(fields):
        return "file_upload"
    if needs_typed_task(fields):  # 296-06 (293-IN-06)
        return "needs_task"
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
        # 305-03 (D-53 / T-305-28): ONE rule — a refusal, or an MCP read whose outcome is anything
        # but ok, is never OK (a withheld, failed or limited call must not read as a success).
        ok=action != "api_key.refused" and not (md.get("kind") == "mcp" and md.get("outcome") not in (None, "ok")),
        outcome=md.get("outcome"),
        reason=md.get("reason"),
        detail=md.get("detail") if isinstance(md.get("detail"), dict) else None,
        tool=md.get("tool"),
    )


async def _serialize_keys(
    pool: asyncpg.Pool,
    rows: list[dict],
    *,
    caller: UUID,
    org_id: UUID,
    switches: dict | None | object = _UNREAD,
) -> list[ApiKeyRead]:
    """Rows -> wire models, with live workflow states and recent calls.

    ⚠ ONE of the three places the projection lives (with ``db/api_keys._KEY_COLUMNS`` and
    ``ApiKeyRead``). Workflow readability is judged against each key's OWNER — that is whose
    rights a call with the key runs under.

    Phase 304: an MCP key also carries its tools, its ticked folders (named in ONE read; a folder
    since deleted drops out), its org's name and which switch is off. ``switches`` is the list's
    one ``mcp_switches`` read; when not passed it is read here, and only if an MCP row is present.
    """
    if not rows:
        return []
    now = datetime.now(timezone.utc)

    mcp_rows = [r for r in rows if r.get("kind") == "mcp"]
    if mcp_rows and switches is _UNREAD:
        switches = await _read_switches(pool, org_id)
    sw = switches if isinstance(switches, dict) else None
    ticked = sorted({str(f) for r in mcp_rows for f in (r.get("folder_ids") or [])})
    folder_name: dict[str, str] = {}
    if ticked:
        for f in await api_keys_db.folder_names(pool, org_id=org_id, folder_ids=ticked):
            folder_name[str(f["id"])] = f["name"]

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
        pool, org_id=org_id, key_ids=[str(r["id"]) for r in rows], since=now - _CALL_WINDOW,
        per_key=_CALLS_PER_KEY,
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
        is_mcp = r.get("kind") == "mcp"
        mcp_fields: dict = {}
        if is_mcp:
            picked = r.get("folder_ids")
            mcp_fields = {
                "kind": "mcp",
                "tools": [str(t) for t in (r.get("tools") or [])],
                "folders": None if picked is None else [
                    ApiKeyFolderRef(id=str(f), name=folder_name[str(f)])
                    for f in picked if str(f) in folder_name
                ],
                "include_external": bool(r.get("include_external")),
                "org_name": sw.get("org_name") if sw else None,
                "mcp_off": _mcp_off(sw),
            }
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
                **mcp_fields,
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
    in the last 30 days (D-17). Phase 304: plus the ``mcp`` block (catalogue, URL, switches)."""
    caller, org = _caller(current_user), _uuid(active_org)
    rows = await api_keys_db.list_keys_for_owner(pool, org_id=org, user_id=caller)
    switches = await _read_switches(pool, org)
    keys = await _serialize_keys(pool, rows, caller=caller, org_id=org, switches=switches)
    return ApiKeyList(keys=keys, limits=await _limits(), mcp=_mcp_block(switches))


@router.get("/folders", response_model=PickableFolderList)
async def list_pickable_folders(
    current_user: dict = Depends(get_current_user),
    active_org: str = Depends(get_active_org_id),
) -> PickableFolderList:
    """The folders the caller can tick on an MCP key in the active org — read on their OWN acting
    connection (RLS + the acting-org GUC), never the service role. ``shared`` is a folder the
    caller does not own (or an org-shared one); ``source`` is the D-40 UI hint."""
    caller, org = str(_caller(current_user)), str(_uuid(active_org))
    async with acting_member_connection(user_id=caller, org_id=org) as conn:
        rows = await list_acting_folders(conn)
        hints = (
            await conn.fetch(_SOURCE_HINT_SQL, MAIL_ROOT_ID, FOLDER_PREFIX, MAIL_MIME)
            if rows else []
        )
    source = {str(h["folder_id"]): ("mail" if h["is_mail"] else "synced") for h in hints}
    return PickableFolderList(
        folders=[
            PickableFolder(
                id=f["id"],
                name=f["name"],
                parent_id=f.get("parent_id"),
                shared=bool(f.get("is_org_shared")) or f.get("user_id") != caller,
                source=source.get(f["id"]),
            )
            for f in rows
        ]
    )


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
        # 296-06 (293-IN-06): the same classification a key's card reads (``_ref_state``).
        reason = "file_upload" if needs_file_upload(fields) else (
            "needs_task" if needs_typed_task(fields) else None
        )
        workflows.append(
            StartableWorkflow(
                id=str(w["id"]),
                name=w["name"],
                fields=[StartableField(key=f.key, label=f.label, required=f.required) for f in fields],
                startable=reason is None,
                reason=reason,
            )
        )
    drafts = await api_keys_db.count_own_drafts(pool, user_id=caller, org_id=org)
    return StartableWorkflowList(workflows=workflows, drafts_hidden=drafts)


def _label_taken(label: str) -> HTTPException:
    # The active-label index spans BOTH kinds, so the sentence names neither.
    return HTTPException(
        status_code=409,
        detail=f"You already have an active key called {label}. Pick another label.",
    )


@router.post("", response_model=ApiKeyCreated, status_code=status.HTTP_201_CREATED)
async def create_key(
    body: Annotated[ApiKeyCreateRequest, Body()],
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    active_org: str = Depends(get_active_org_id),
    pool: asyncpg.Pool = Depends(get_pg_pool),
) -> ApiKeyCreated:
    """Make a key. A body without ``kind`` (or ``kind="workflow"``) is the 293 workflow key; a
    ``kind="mcp"`` body is a personal MCP key. The response is the ONLY place the secret ever
    appears."""
    if isinstance(body, McpKeyCreateBody):
        return await _create_mcp_key(
            body, background_tasks, caller=_caller(current_user), org=_uuid(active_org), pool=pool
        )
    # D-41: the tier gate (assumption A5) moved inside the handler, for workflow keys only —
    # same exception, same 403 as the old route dependency.
    await enforce_entitlement(pool, active_org, "workflows")
    return await _create_workflow_key(
        body, background_tasks, caller=_caller(current_user), org=_uuid(active_org), pool=pool
    )


async def _visible_folder_ids(user_id: str, org_id: str) -> set[str]:
    """The member's visible folder ids in ``org_id`` through THIS module's acting seams (the ones
    ``list_pickable_folders`` uses), handed to ``validate_mcp_narrowing`` (307-03)."""
    async with acting_member_connection(user_id=user_id, org_id=org_id) as conn:
        return {f["id"] for f in await list_acting_folders(conn)}


async def _create_mcp_key(
    body: McpKeyCreateBody,
    background_tasks: BackgroundTasks,
    *,
    caller: UUID,
    org: UUID,
    pool: asyncpg.Pool,
) -> ApiKeyCreated:
    """KEY-01/03/04/05: refuse before minting — switches (403), tools and folders (422).

    307-03 (D-13 / T-307-25): the checks live in ``services/mcp_narrowing.py``, which the consent
    approve calls too; a refusal is raised here with the SAME status and sentence as before."""
    verdict = await validate_mcp_narrowing(
        pool, caller=caller, org=org, tools=body.tools, folder_ids=body.folder_ids,
        visible_folders=_visible_folder_ids,
    )
    if isinstance(verdict, NarrowingRefusal):
        raise HTTPException(status_code=verdict.status, detail=verdict.detail)
    switches, folder_ids = verdict.switches, verdict.folder_ids

    minted = mint_key(kind="mcp")
    expires_at = datetime.now(timezone.utc) + timedelta(days=body.expires_in_days)
    try:
        row = await api_keys_db.create_api_key(
            pool,
            org_id=org,
            user_id=caller,
            label=body.label,
            key_prefix=minted.key_prefix,
            key_hash=minted.key_hash,
            workflows=[],
            expires_at=expires_at,
            kind="mcp",
            folder_ids=folder_ids,
            tools=list(verdict.tools),
            include_external=body.include_external,
        )
    except api_keys_db.DuplicateKeyLabel:
        raise _label_taken(body.label)

    audit_key_call(
        background_tasks,
        {"id": row["id"], "label": row["label"], "user_id": caller, "org_id": org, "kind": "mcp"},
        "api_key.create",
        call="manage",
    )
    (key,) = await _serialize_keys(pool, [row], caller=caller, org_id=org, switches=switches)
    return ApiKeyCreated(key=key, secret=minted.secret)


async def _create_workflow_key(
    body: ApiKeyCreateBody,
    background_tasks: BackgroundTasks,
    *,
    caller: UUID,
    org: UUID,
    pool: asyncpg.Pool,
) -> ApiKeyCreated:
    """Make a key for one or more of the caller's published workflows (the 293 path)."""
    rows = await api_keys_db.get_key_workflows(
        pool, workflow_ids=list(body.workflow_ids), user_id=caller, org_id=org
    )
    by_id = {str(r["id"]): r for r in rows}
    # 296-06 (293-IN-06): a key may name only what the picker offers — the caller's own published
    # workflows in this org (``list_startable_candidates``, the picker's own query). A published
    # global is readable but never offered, so it is refused here too.
    offered = {
        str(w["id"])
        for w in await api_keys_db.list_startable_candidates(pool, user_id=caller, org_id=org)
    }
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
        fields = declared_fields(row.get("definition") or {})
        if needs_file_upload(fields):
            raise HTTPException(
                status_code=422,
                detail=f"{name} needs a file upload, which a key can't send yet.",
            )
        if str(wid) not in offered:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"{name} isn't one of your published workflows in this organization, "
                    "so a key can't start it."
                ),
            )
        if needs_typed_task(fields):
            raise HTTPException(
                status_code=422,
                detail=f"{name} starts from a typed task, which a key can't send yet.",
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
        raise _label_taken(body.label)

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
    if row.get("revoked_now"):  # 296-06 (293-IN-08): a repeat revoke writes no second row
        audit_key_call(
            background_tasks,
            {"id": row["id"], "label": row["label"], "user_id": caller, "org_id": org,
             "kind": row.get("kind")},
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
    """Every key in the active org, with its owner (D-03). Phase 304: plus the same ``mcp``
    block, so the admin surface can say when MCP is switched off."""
    caller, org = _caller(current_user), _uuid(active_org)
    rows = await api_keys_db.list_keys_for_org(pool, org_id=org)
    switches = await _read_switches(pool, org)
    keys = await _serialize_keys(pool, rows, caller=caller, org_id=org, switches=switches)
    return ApiKeyList(keys=keys, limits=await _limits(), mcp=_mcp_block(switches))


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
    if row.get("revoked_now"):  # 296-06 (293-IN-08): a repeat revoke writes no second row
        audit_key_call(
            background_tasks,
            {"id": row["id"], "label": row["label"], "user_id": caller, "org_id": org,
             "kind": row.get("kind")},
            "api_key.revoke",
            call="manage",
            detail={"by_admin": True, "owner_id": str(row["user_id"])},
        )
    (key,) = await _serialize_keys(pool, [row], caller=caller, org_id=org)
    return key


# ── the org's MCP switch (Phase 304; KEY-06, D-02, D-35, D-36) ─────────────────────────────────
#
# A dedicated column (``organizations.mcp_enabled``, mig 220) outside the ``authenticated`` column
# grant, so this audited route is its ONLY writer. No new audit literal (D-36): every flip is
# ``settings.update`` with ``metadata.event = 'mcp_access'`` and an EXPLICIT org_id (the
# ``api/org.py`` invite / SSO precedent, T-167-23).

_MCP_ACCESS_AUDIT_ACTION = "settings.update"
_ORG_NOT_FOUND = "Organization not found."


@org_router.get("/mcp-access", response_model=OrgMcpAccess)
async def get_org_mcp_access(
    current_user: dict = Depends(require_org_manage),
    active_org: str = Depends(get_active_org_id),
    pool: asyncpg.Pool = Depends(get_pg_pool),
) -> OrgMcpAccess:
    """The active org's MCP switch, read live (never the settings cache)."""
    switches = await api_keys_db.mcp_switches(pool, _uuid(active_org))
    if switches is None:
        raise HTTPException(status_code=404, detail=_ORG_NOT_FOUND)
    return OrgMcpAccess(enabled=switches.get("org_on") is True)


@org_router.put("/mcp-access", response_model=OrgMcpAccess)
async def set_org_mcp_access(
    body: OrgMcpAccessUpdate,
    current_user: dict = Depends(require_org_manage),
    active_org: str = Depends(get_active_org_id),
    pool: asyncpg.Pool = Depends(get_pg_pool),
) -> OrgMcpAccess:
    """Flip the active org's MCP switch. The audit row is written only AFTER the write returned;
    a failed write raises (an error status and no audit row), never a fake success."""
    org = _uuid(active_org)
    stored = await api_keys_db.set_org_mcp_enabled(pool, org_id=org, enabled=body.enabled)
    if stored is None:
        raise HTTPException(status_code=404, detail=_ORG_NOT_FOUND)
    # supabase-py client construction off the event loop (D-v2.5-01); the insert itself is
    # already threadpooled inside write_audit_entry.
    audit_supabase = await run_in_threadpool(get_service_role_supabase, str(org))
    await write_audit_entry(
        user_id=str(current_user["id"]),
        action_type=_MCP_ACCESS_AUDIT_ACTION,
        metadata={"event": "mcp_access", "enabled": bool(stored)},
        supabase=audit_supabase,
        org_id=str(org),
    )
    return OrgMcpAccess(enabled=bool(stored))


# ── the org's PII redaction switch (Phase 305-04; GUARD-03, D-36, D-56) ──────────────────────
#
# ``organizations.pii_redaction_enabled`` (mig 222, off by default) is outside the
# ``authenticated`` column grant, so these two routes on the EXISTING ``org_router`` (no new
# include_router, D-04) are its only door. The helpers live in ``db/outbound_policy`` (imported as
# a module so tests can monkeypatch). No new audit literal: ``settings.update`` +
# ``metadata.event = 'pii_redaction'``, written AFTER the write returned (the mcp-access shape).


@org_router.get("/pii-redaction", response_model=OrgPiiRedaction)
async def get_org_pii_redaction(
    current_user: dict = Depends(require_org_manage),
    active_org: str = Depends(get_active_org_id),
    pool: asyncpg.Pool = Depends(get_pg_pool),
) -> OrgPiiRedaction:
    """The active org's redaction switch, read live."""
    enabled = await outbound_policy.pii_redaction_enabled(pool, _uuid(active_org))
    if enabled is None:
        raise HTTPException(status_code=404, detail=_ORG_NOT_FOUND)
    return OrgPiiRedaction(enabled=enabled is True)


@org_router.put("/pii-redaction", response_model=OrgPiiRedaction)
async def set_org_pii_redaction(
    body: OrgPiiRedactionUpdate,
    current_user: dict = Depends(require_org_manage),
    active_org: str = Depends(get_active_org_id),
    pool: asyncpg.Pool = Depends(get_pg_pool),
) -> OrgPiiRedaction:
    """Flip the active org's redaction switch; audited after the write, never on a failed one."""
    org = _uuid(active_org)
    stored = await outbound_policy.set_pii_redaction_enabled(pool, org_id=org, enabled=body.enabled)
    if stored is None:
        raise HTTPException(status_code=404, detail=_ORG_NOT_FOUND)
    audit_supabase = await run_in_threadpool(get_service_role_supabase, str(org))
    await write_audit_entry(
        user_id=str(current_user["id"]),
        action_type=_MCP_ACCESS_AUDIT_ACTION,
        metadata={"event": "pii_redaction", "enabled": bool(stored)},
        supabase=audit_supabase,
        org_id=str(org),
    )
    return OrgPiiRedaction(enabled=bool(stored))
