"""Phase 275 (RET-01..04; D-02, D-03, D-05, D-10, D-17, D-19, D-28, D-29, D-34, D-35) — /retention.

Org admin → Retention: policies with a server-recorded Preview gate, legal holds, the "Waiting for
you" batches with a typed-count confirm, History, run-now, and the Library's batched
document-states read.

⛔ GATES ARE PER ROUTE (the org.py WR-01 rule). Every route depends on ``require_org_manage`` EXCEPT
``POST /retention/document-states``, which any member of the active org may call — and whose payload
carries matter names, reasons and placers ONLY when the caller holds ``org:manage`` (D-17), decided
AS THE CALLER through ``_has_org_permission``.

⛔ WHERE EACH WRITE RUNS (revision W-2, W-3b).
  * Policy create / update / delete and hold release run on the SERVICE pool in one transaction
    (``app.db.retention``), only after ``require_org_manage`` and explicit checks in code: the row's
    org is the active org; a policy folder's org is the active org (else 422 "That folder is not in
    this organization." — there is NO org-shared requirement, D-34 is the evaluator's job); a fresh
    preview of exactly this draft exists (D-02). Migration 204 makes ``revision`` /
    ``previewed_revision`` / ``released_*`` service-role-only, so a JWT write of them is refused.
  * Hold create / extend write through the caller's user-JWT connection, so RLS ``WITH CHECK`` is a
    second wall; the ids are first READ through that same RLS connection (D-35: what the admin cannot
    read cannot be held).
  * Preview, confirm, keep, un-archive, run-now and document-states compute on the service pool with
    an explicit ``org_id = $active_org`` on every statement (T-275-20).
Every write leaves a ``retention_receipts`` row and an ``audit_log`` row with an EXPLICIT org id.
"""
from __future__ import annotations

import hashlib
import json
import logging
from datetime import date, datetime, timezone
from typing import Any, Optional
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from supabase import Client

import app.dependencies as deps
from app.config import settings
from app.db import retention as rdb
from app.dependencies import (
    get_active_org_id,
    get_current_user,
    get_supabase,
    get_user_pg_connection,
    require_org_manage,
)
from app.models.retention import (
    ConfirmBatch,
    ConfirmOut,
    DocumentSection,
    DocumentState,
    DocumentStatesOut,
    DocumentStatesRequest,
    DocumentTypeOut,
    FolderPolicyLine,
    FolderState,
    HistoryPage,
    HistoryRow,
    HoldCount,
    HoldCountOut,
    HoldCoverageAdd,
    HoldCreate,
    HoldList,
    HoldOut,
    HoldRelease,
    PolicyDeletedOut,
    PolicyDraft,
    PolicyList,
    PolicyOut,
    PolicyTonight,
    PreviewOut,
    PreviewRequest,
    QueueBatch,
    QueueList,
    QueueRow,
    RetentionSummary,
    SkippedNote,
    SweepRunOut,
    UnarchiveOut,
)
from app.services.audit_service import write_audit_entry
from app.services.retention import disposition
from app.services.retention import load as retention_load
from app.services.retention.evaluate import (
    DISPOSE_KINDS,
    UNDECIDABLE_KINDS,
    Decision,
    evaluate,
    folder_policy_for,
    kept_for_text,
    rule_text,
    scope_text,
)
from app.services.retention.hold_guard import hold_line_for
from app.services.retention.load import IncompleteEvaluation, OrgSnapshot, policy_facts

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/retention", tags=["retention"])

PREVIEW_AGAIN = "Preview again before saving."
PREVIEW_INCOMPLETE = "Preview couldn't finish, so this policy can't be saved yet. Nothing was changed."
LOAD_INCOMPLETE = "Couldn't read every document in this organization, so nothing can be decided right now. Nothing was changed."
FOLDER_NOT_IN_ORG = "That folder is not in this organization."
SWEEPS_OFF = "Scheduled sweeps are off (RETENTION_SWEEP_ENABLED). Preview still works; nothing is archived or queued until they are turned on."
SWEEP_BUSY = "A sweep is already running for this organization."
HOLD_IDS_REFUSED = "Some of the picked documents or folders are not in this organization or not visible to you. Nothing was held."
FORMER_MEMBER = "a former member"
SCOPE_TAKEN = "Another policy already covers this folder or document type. Edit that policy instead."

_NOT_FOUND = {
    "policy": "Policy not found.",
    "hold": "Hold not found.",
}


# ── helpers ─────────────────────────────────────────────────────────────────────────────────

def _org(request: Request) -> UUID:
    org = deps._to_uuid(getattr(request.state, "active_org", None))
    if org is None:  # require_org_manage / get_active_org_id always set it; fail closed if not
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No active organization.")
    return org


def _actor_name(user: dict) -> str:
    meta = user.get("user_metadata") or {}
    return str(meta.get("full_name") or meta.get("name") or user.get("email") or "an org admin")


async def _service_pool():
    return await deps.get_pg_pool()


async def _snapshot(org_id) -> OrgSnapshot:
    """The whole org, read fail-closed through the service pool (raises IncompleteEvaluation)."""
    return await retention_load.load_snapshot(await _service_pool(), org_id)


def draft_hash(draft: PolicyDraft, org_id, policy_id) -> str:
    """The canonical draft identity for the D-02 gate: sorted-key JSON of the normalized draft + org
    + the policy being edited (None for a new policy)."""
    payload = {"draft": draft.to_row(), "org_id": str(org_id), "policy_id": str(policy_id) if policy_id else None}
    return hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode()).hexdigest()


async def _check_folder_in_org(pool, draft: PolicyDraft, org: UUID) -> None:
    if draft.folder_id is None:
        return
    folder_org = await rdb.folder_org(pool, draft.folder_id)
    if folder_org is None or str(folder_org) != str(org):
        raise HTTPException(status_code=422, detail=FOLDER_NOT_IN_ORG)


async def _audit(user: dict, action: str, metadata: dict, supabase: Client, org: UUID) -> None:
    await write_audit_entry(
        user_id=user["id"], action_type=action, metadata=metadata, supabase=supabase, org_id=str(org),
    )


def _policy_out(row: dict, *, folder_path: Optional[str] = None, tonight: Optional[PolicyTonight] = None) -> PolicyOut:
    facts = policy_facts(row)
    return PolicyOut(
        id=row["id"], name=row["name"], scope_kind=row["scope_kind"], folder_id=row.get("folder_id"),
        folder_path=folder_path, include_subfolders=bool(row.get("include_subfolders", True)),
        document_type_norm=row.get("document_type_norm"), clock=row["clock"],
        stage1_value=row["stage1_value"], stage1_unit=row["stage1_unit"], stage1_action=row["stage1_action"],
        stage2_value=row.get("stage2_value"), stage2_unit=row.get("stage2_unit"), stage2_action=row.get("stage2_action"),
        revision=row["revision"], previewed_revision=row.get("previewed_revision"),
        created_by_name=row.get("created_by_name"), updated_by_name=row.get("updated_by_name"),
        created_at=row.get("created_at"), updated_at=row.get("updated_at"),
        scope_text=scope_text(facts, folder_path=folder_path), kept_for_text=kept_for_text(facts),
        rule_text=rule_text(facts), tonight=tonight,
    )


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ── summary ─────────────────────────────────────────────────────────────────────────────────

@router.get("/summary", response_model=RetentionSummary)
async def get_summary(request: Request, _m: dict = Depends(require_org_manage)):
    org = _org(request)
    pool = await _service_pool()
    row = await rdb.read_sweep_row(pool, org)
    counts = await rdb.count_policies_and_holds(pool, org)
    return RetentionSummary(
        sweep_enabled=bool(settings.retention_sweep_enabled), sweep_hour_utc=rdb.SWEEP_HOUR_UTC,
        last_run_at=(row or {}).get("last_run_at"), last_status=(row or {}).get("last_status"),
        last_error=(row or {}).get("last_error"), next_run_at=(row or {}).get("next_run_at"), counts=counts,
    )


# ── policies ────────────────────────────────────────────────────────────────────────────────

@router.get("/policies", response_model=PolicyList)
async def list_policies(request: Request, _m: dict = Depends(require_org_manage)):
    org = _org(request)
    pool = await _service_pool()
    rows = [dict(r) for r in await pool.fetch(
        "SELECT * FROM public.retention_policies WHERE org_id = $1 ORDER BY created_at, id", org,
    )]
    try:
        snap = await _snapshot(org)
    except IncompleteEvaluation:
        snap = None
    tonight: dict[str, PolicyTonight] = {}
    if snap is not None:
        at = _now()
        tally: dict[str, dict] = {str(r["id"]): {"due_now": 0, "undecidable": 0, "next_due": None} for r in rows}
        for fam in snap.families:
            d = evaluate(fam, snap.ctx, at)
            if d.kind in DISPOSE_KINDS or d.kind == "pending":
                if d.policy_id in tally:
                    tally[d.policy_id]["due_now"] += 1
            elif d.kind in UNDECIDABLE_KINDS:
                for pid in d.policy_ids:
                    if pid in tally:
                        tally[pid]["undecidable"] += 1
            elif d.kind == "not_due" and d.policy_id in tally and d.due_at is not None:
                cur = tally[d.policy_id]["next_due"]
                tally[d.policy_id]["next_due"] = d.due_at if cur is None or d.due_at < cur else cur
        tonight = {pid: PolicyTonight(**t) for pid, t in tally.items()}
    paths = snap.folder_paths if snap is not None else {}
    return PolicyList(
        policies=[
            _policy_out(r, folder_path=paths.get(str(r["folder_id"])) if r.get("folder_id") else None,
                        tonight=tonight.get(str(r["id"])))
            for r in rows
        ],
        evaluation_incomplete=snap is None,
    )


@router.post("/policies/preview", response_model=PreviewOut)
async def preview_policy(
    request: Request,
    body: PreviewRequest,
    current_user: dict = Depends(require_org_manage),
):
    org = _org(request)
    pool = await _service_pool()
    draft = body.draft
    await _check_folder_in_org(pool, draft, org)
    if body.policy_id is not None and await rdb.get_policy(pool, org, body.policy_id) is None:
        raise HTTPException(status_code=404, detail=_NOT_FOUND["policy"])
    try:
        result = await disposition.preview_draft(
            pool, org, draft.to_row(), editing_policy_id=str(body.policy_id) if body.policy_id else None, now=_now(),
        )
    except IncompleteEvaluation:
        raise HTTPException(status_code=503, detail=PREVIEW_INCOMPLETE)
    except disposition.DispositionError as exc:
        raise HTTPException(status_code=exc.status, detail=exc.message)
    h = draft_hash(draft, org, body.policy_id)
    await rdb.record_preview(pool, org, policy_id=body.policy_id, draft_hash=h, created_by=current_user["id"], counts=result["counts"])
    try:
        await rdb.insert_receipt(
            pool, org, "dry_run", policy_id=body.policy_id, policy_name=draft.name,
            actor_id=current_user["id"], actor_name=_actor_name(current_user),
            detail={"counts": result["counts"], "action": result["action"]},
        )
    except Exception:  # a dry run is a read; its History row is best-effort
        logger.warning("retention: dry_run receipt failed for org %s", org)
    return PreviewOut(
        draft_hash=h, action=result["action"], has_stage2=result["has_stage2"], buckets=result["buckets"],
        counts=result["counts"], private_not_covered=result["private_not_covered"],
    )


@router.post("/policies", response_model=PolicyOut, status_code=status.HTTP_201_CREATED)
async def create_policy(
    request: Request,
    draft: PolicyDraft,
    current_user: dict = Depends(require_org_manage),
    supabase: Client = Depends(get_supabase),
):
    org = _org(request)
    pool = await _service_pool()
    await _check_folder_in_org(pool, draft, org)
    if not await rdb.fresh_preview_exists(pool, org, draft_hash(draft, org, None)):
        raise HTTPException(status_code=409, detail=PREVIEW_AGAIN)
    try:
        row = await rdb.insert_policy(pool, org, draft.to_row(), actor_id=current_user["id"], actor_name=_actor_name(current_user))
    except asyncpg.UniqueViolationError:
        raise HTTPException(status_code=409, detail=SCOPE_TAKEN)
    await _audit(current_user, "retention.policy.create",
                 {"event": "retention.policy.create", "policy_id": str(row["id"]), "name": row["name"]}, supabase, org)
    return _policy_out(row)


@router.put("/policies/{policy_id}", response_model=PolicyOut)
async def update_policy(
    request: Request,
    policy_id: UUID,
    draft: PolicyDraft,
    current_user: dict = Depends(require_org_manage),
    supabase: Client = Depends(get_supabase),
):
    org = _org(request)
    pool = await _service_pool()
    stored = await rdb.get_policy(pool, org, policy_id)
    if stored is None:
        raise HTTPException(status_code=404, detail=_NOT_FOUND["policy"])
    await _check_folder_in_org(pool, draft, org)
    if not await rdb.fresh_preview_exists(pool, org, draft_hash(draft, org, policy_id)):
        raise HTTPException(status_code=409, detail=PREVIEW_AGAIN)
    new_row = draft.to_row()
    try:
        row = await rdb.update_policy(
            pool, org, policy_id, new_row, rule_changed=disposition.rule_changed(stored, new_row),
            actor_id=current_user["id"], actor_name=_actor_name(current_user),
        )
    except asyncpg.UniqueViolationError:
        raise HTTPException(status_code=409, detail=SCOPE_TAKEN)
    if row is None:
        raise HTTPException(status_code=404, detail=_NOT_FOUND["policy"])
    await _audit(current_user, "retention.policy.update",
                 {"event": "retention.policy.update", "policy_id": str(row["id"]), "revision": row["revision"]}, supabase, org)
    return _policy_out(row)


@router.delete("/policies/{policy_id}", response_model=PolicyDeletedOut)
async def delete_policy(
    request: Request,
    policy_id: UUID,
    current_user: dict = Depends(require_org_manage),
    supabase: Client = Depends(get_supabase),
):
    org = _org(request)
    pool = await _service_pool()
    row = await rdb.delete_policy(pool, org, policy_id, actor_id=current_user["id"], actor_name=_actor_name(current_user))
    if row is None:
        raise HTTPException(status_code=404, detail=_NOT_FOUND["policy"])
    await _audit(current_user, "retention.policy.delete",
                 {"event": "retention.policy.delete", "policy_id": str(row["id"]), "name": row["name"]}, supabase, org)
    return PolicyDeletedOut(id=row["id"], name=row["name"])


async def _document_types(request: Request, user: dict, org: UUID) -> list[DocumentTypeOut]:
    """The org's live type distribution as the admin sees it (RLS) — the editor picks, never types."""
    async with get_user_pg_connection(request, user) as conn:
        rows = await conn.fetch(
            "SELECT document_type_norm AS v, count(*) AS n FROM public.documents "
            "WHERE org_id = $1 AND is_latest AND document_type_norm IS NOT NULL "
            "GROUP BY document_type_norm ORDER BY n DESC, v LIMIT 50",
            org,
        )
    return [DocumentTypeOut(value=r["v"], count=int(r["n"])) for r in rows]


@router.get("/document-types", response_model=list[DocumentTypeOut])
async def list_document_types(request: Request, current_user: dict = Depends(require_org_manage)):
    return await _document_types(request, current_user, _org(request))


# ── holds ───────────────────────────────────────────────────────────────────────────────────

async def _readable_ids(conn, org: UUID, document_ids, folder_ids) -> tuple[set[str], set[str]]:
    """D-35: the ids the CALLER can read through RLS, in the active org."""
    docs: set[str] = set()
    folders: set[str] = set()
    if document_ids:
        rows = await conn.fetch(
            "SELECT id FROM public.documents WHERE id = ANY($1::uuid[]) AND org_id = $2",
            [UUID(str(d)) for d in document_ids], org,
        )
        docs = {str(r["id"]) for r in rows}
    if folder_ids:
        rows = await conn.fetch(
            "SELECT id FROM public.folders WHERE id = ANY($1::uuid[]) AND org_id = $2",
            [UUID(str(f)) for f in folder_ids], org,
        )
        folders = {str(r["id"]) for r in rows}
    return docs, folders


async def _write_hold(conn, org: UUID, body: HoldCreate, *, user: dict) -> dict:
    """Hold + coverage through the user-JWT connection (RLS WITH CHECK is the second wall)."""
    row = await conn.fetchrow(
        "INSERT INTO public.legal_holds (org_id, name, reason, created_by, created_by_name) "
        "VALUES ($1,$2,$3,$4,$5) RETURNING id, name, reason, created_by_name, created_at",
        org, body.name, body.reason, UUID(str(user["id"])), _actor_name(user),
    )
    await _write_coverage(conn, org, row["id"], body.document_ids, body.folder_ids, user=user)
    return dict(row)


async def _write_coverage(conn, org: UUID, hold_id, document_ids, folder_ids, *, user: dict) -> None:
    uid = UUID(str(user["id"]))
    for d in document_ids:
        await conn.execute(
            "INSERT INTO public.legal_hold_documents (hold_id, document_id, org_id, added_by) VALUES ($1,$2,$3,$4) "
            "ON CONFLICT (hold_id, document_id) DO NOTHING",
            hold_id, UUID(str(d)), org, uid,
        )
    for f in folder_ids:
        await conn.execute(
            "INSERT INTO public.legal_hold_folders (hold_id, folder_id, org_id, added_by) VALUES ($1,$2,$3,$4) "
            "ON CONFLICT (hold_id, folder_id) DO NOTHING",
            hold_id, UUID(str(f)), org, uid,
        )


async def _count_held(conn, org: UUID, document_ids, folder_ids) -> int:
    """Latest documents a hold over these ids would hold today: the picked documents' version
    families plus everything under the picked folders (subtree, cycle-safe through UNION)."""
    return int(await conn.fetchval(
        """
        WITH RECURSIVE sub(id) AS (
            SELECT f.id FROM public.folders f WHERE f.id = ANY($2::uuid[]) AND f.org_id = $1
            UNION
            SELECT c.id FROM public.folders c JOIN sub ON c.parent_id = sub.id WHERE c.org_id = $1
        )
        SELECT count(*) FROM public.documents d
        WHERE d.org_id = $1 AND d.is_latest
          AND (d.folder_id IN (SELECT id FROM sub)
               OR EXISTS (SELECT 1 FROM public.documents x
                          WHERE x.id = ANY($3::uuid[]) AND x.org_id = d.org_id
                            AND x.user_id = d.user_id AND x.filename = d.filename))
        """,
        org, [UUID(str(f)) for f in folder_ids], [UUID(str(d)) for d in document_ids],
    ) or 0)


def _hold_out(row: dict, snap: Optional[OrgSnapshot]) -> HoldOut:
    hid = str(row["id"])
    folder_ids = [str(f) for f in (row.get("folder_ids") or [])]
    held_today = None
    if snap is not None and row.get("released_at") is None:
        held_today = sum(1 for hs in snap.family_holds.values() if hid in hs)
    return HoldOut(
        id=row["id"], name=row["name"], reason=row.get("reason"), created_by_name=row.get("created_by_name"),
        created_at=row.get("created_at"), released_at=row.get("released_at"),
        released_by_name=row.get("released_by_name"), release_note=row.get("release_note"),
        active=row.get("released_at") is None, document_count=int(row.get("document_count") or 0),
        folder_ids=folder_ids,
        folder_paths=[snap.folder_paths[f] for f in folder_ids if snap is not None and f in snap.folder_paths],
        held_today=held_today,
    )


@router.get("/holds", response_model=HoldList)
async def list_holds(request: Request, _m: dict = Depends(require_org_manage)):
    org = _org(request)
    rows = await rdb.list_holds(await _service_pool(), org)
    try:
        snap = await _snapshot(org)
    except IncompleteEvaluation:
        snap = None
    out = [_hold_out(r, snap) for r in rows]
    return HoldList(active=[h for h in out if h.active], released=[h for h in out if not h.active])


@router.post("/holds", response_model=HoldOut, status_code=status.HTTP_201_CREATED)
async def create_hold(
    request: Request,
    body: HoldCreate,
    current_user: dict = Depends(require_org_manage),
    supabase: Client = Depends(get_supabase),
):
    org = _org(request)
    async with get_user_pg_connection(request, current_user) as conn:
        docs, folders = await _readable_ids(conn, org, body.document_ids, body.folder_ids)
        if docs != {str(d) for d in body.document_ids} or folders != {str(f) for f in body.folder_ids}:
            raise HTTPException(status_code=422, detail=HOLD_IDS_REFUSED)
        row = await _write_hold(conn, org, body, user=current_user)
    pool = await _service_pool()
    await rdb.insert_receipt(
        pool, org, "hold_placed", hold_id=row["id"], hold_name=row["name"], actor_id=current_user["id"],
        actor_name=_actor_name(current_user),
        detail={"documents": len(body.document_ids), "folders": len(body.folder_ids)},
    )
    await _audit(current_user, "retention.hold.create",
                 {"event": "retention.hold.create", "hold_id": str(row["id"]),
                  "documents": len(body.document_ids), "folders": len(body.folder_ids)}, supabase, org)
    return HoldOut(
        id=row["id"], name=row["name"], reason=row.get("reason"), created_by_name=row.get("created_by_name"),
        created_at=row.get("created_at"), active=True, document_count=len(body.document_ids),
        folder_ids=list(body.folder_ids),
    )


@router.post("/holds/{hold_id}/coverage", response_model=HoldOut)
async def extend_hold(
    request: Request,
    hold_id: UUID,
    body: HoldCoverageAdd,
    current_user: dict = Depends(require_org_manage),
    supabase: Client = Depends(get_supabase),
):
    org = _org(request)
    pool = await _service_pool()
    hold = await rdb.get_hold(pool, org, hold_id)
    if hold is None:
        raise HTTPException(status_code=404, detail=_NOT_FOUND["hold"])
    if hold.get("released_at") is not None:
        raise HTTPException(status_code=409, detail="This hold has been released. Place a new hold instead.")
    async with get_user_pg_connection(request, current_user) as conn:
        docs, folders = await _readable_ids(conn, org, body.document_ids, body.folder_ids)
        if docs != {str(d) for d in body.document_ids} or folders != {str(f) for f in body.folder_ids}:
            raise HTTPException(status_code=422, detail=HOLD_IDS_REFUSED)
        await _write_coverage(conn, org, hold_id, body.document_ids, body.folder_ids, user=current_user)
    await rdb.insert_receipt(
        pool, org, "hold_extended", hold_id=hold_id, hold_name=hold["name"], actor_id=current_user["id"],
        actor_name=_actor_name(current_user),
        detail={"documents": len(body.document_ids), "folders": len(body.folder_ids)},
    )
    await _audit(current_user, "retention.hold.update",
                 {"event": "retention.hold.update", "hold_id": str(hold_id),
                  "documents": len(body.document_ids), "folders": len(body.folder_ids)}, supabase, org)
    rows = [r for r in await rdb.list_holds(pool, org) if str(r["id"]) == str(hold_id)]
    return _hold_out(rows[0] if rows else {**hold, "folder_ids": []}, None)


async def _count_released(org: UUID, hold_id) -> int:
    """Documents (families) that would stop being protected: held by THIS hold and no other."""
    try:
        snap = await _snapshot(org)
    except IncompleteEvaluation:
        return 0
    hid = str(hold_id)
    return sum(1 for hs in snap.family_holds.values() if hid in hs and len(hs) == 1)


@router.post("/holds/{hold_id}/release", response_model=HoldOut)
async def release_hold(
    request: Request,
    hold_id: UUID,
    body: HoldRelease,
    current_user: dict = Depends(require_org_manage),
    supabase: Client = Depends(get_supabase),
):
    org = _org(request)
    pool = await _service_pool()
    hold = await rdb.get_hold(pool, org, hold_id)
    if hold is None:
        raise HTTPException(status_code=404, detail=_NOT_FOUND["hold"])
    if hold.get("released_at") is not None:
        raise HTTPException(status_code=409, detail="This hold is already released.")
    released = await _count_released(org, hold_id)
    row = await rdb.release_hold(
        pool, org, hold_id, actor_id=current_user["id"], actor_name=_actor_name(current_user),
        note=body.note, released_count=released,
    )
    if row is None:
        raise HTTPException(status_code=409, detail="This hold is already released.")
    await _audit(current_user, "retention.hold.release",
                 {"event": "retention.hold.release", "hold_id": str(hold_id), "released_count": released}, supabase, org)
    return HoldOut(
        id=hold_id, name=row["name"], reason=hold.get("reason"), created_by_name=hold.get("created_by_name"),
        created_at=hold.get("created_at"), released_at=row["released_at"],
        released_by_name=_actor_name(current_user), release_note=body.note, active=False,
    )


@router.post("/holds/count", response_model=HoldCountOut)
async def count_hold(request: Request, body: HoldCount, current_user: dict = Depends(require_org_manage)):
    org = _org(request)
    async with get_user_pg_connection(request, current_user) as conn:
        docs, folders = await _readable_ids(conn, org, body.document_ids, body.folder_ids)
        n = await _count_held(conn, org, sorted(docs), sorted(folders))
    return HoldCountOut(count=n)


# ── the waiting list ────────────────────────────────────────────────────────────────────────

@router.get("/queue", response_model=QueueList)
async def get_queue(request: Request, _m: dict = Depends(require_org_manage)):
    org = _org(request)
    try:
        snap = await _snapshot(org)
    except IncompleteEvaluation:
        raise HTTPException(status_code=503, detail=LOAD_INCOMPLETE)
    at = _now()
    decisions = {f.family_key: evaluate(f, snap.ctx, at) for f in snap.families}
    groups: dict[tuple[str, str], list[dict]] = {}
    for q in snap.queue_rows:
        groups.setdefault((str(q["policy_id"]), str(q["kind"])), []).append(q)
    batches: list[QueueBatch] = []
    for (pid, kind), rows in groups.items():
        p = snap.policies.get(pid)
        if p is None:
            continue
        out_rows = []
        for q in rows:
            fam = snap.family(str(q["family_key"]))
            if fam is None:
                continue
            d = decisions.get(fam.family_key)
            out_rows.append(QueueRow(
                document_id=fam.latest_id, name=fam.name,
                folder_path=snap.folder_paths.get(fam.folder_id) if fam.folder_id else None,
                document_date=fam.date_typed, due_since=d.due_at if d else None, kind=kind, found_at=q.get("found_at"),
            ))
        held, undecidable = [], []
        for fam in snap.families:
            d = decisions[fam.family_key]
            if pid not in d.policy_ids:
                continue
            if d.kind == "held":
                names = [snap.holds[h]["name"] for h in snap.family_holds.get(fam.family_key, []) if h in snap.holds]
                held.append(SkippedNote(name=fam.name, why=names[0] if names else "on legal hold"))
            elif d.kind in UNDECIDABLE_KINDS:
                undecidable.append(SkippedNote(name=fam.name, why=d.why))
        out_rows.sort(key=lambda r: (r.due_since or date.max, r.name.lower()))
        batches.append(QueueBatch(
            policy_id=pid, policy_name=p.name, kind=kind,
            scope_text=scope_text(p, folder_path=snap.folder_paths.get(p.folder_id) if p.folder_id else None),
            kept_for_text=kept_for_text(p), found_at=max((q.get("found_at") for q in rows if q.get("found_at")), default=None),
            rows=out_rows, held=held, undecidable=undecidable,
        ))
    batches.sort(key=lambda b: b.found_at or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    return QueueList(batches=batches, total=sum(len(b.rows) for b in batches))


@router.post("/queue/{policy_id}/confirm", response_model=ConfirmOut)
async def confirm_queue(
    request: Request,
    policy_id: UUID,
    body: ConfirmBatch,
    current_user: dict = Depends(require_org_manage),
    supabase: Client = Depends(get_supabase),
):
    org = _org(request)
    try:
        out = await disposition.confirm_batch(
            await _service_pool(), org, policy_id,
            delete_ids=[str(x) for x in body.delete_ids], keep_ids=[str(x) for x in body.keep_ids],
            archive_ids=[str(x) for x in body.archive_ids], typed_count=body.typed_count,
            actor_id=current_user["id"], actor_name=_actor_name(current_user), storage=supabase,
        )
    except IncompleteEvaluation:
        raise HTTPException(status_code=503, detail=LOAD_INCOMPLETE)
    except disposition.DispositionError as exc:
        raise HTTPException(status_code=exc.status, detail=exc.message)
    counts = {k: len(out.get(k) or []) for k in ("deleted", "did_not_delete", "kept", "archived", "not_found", "skipped", "failed")}
    await _audit(current_user, "retention.disposition.confirm",
                 {"event": "retention.disposition.confirm", "policy_id": str(policy_id), **counts}, supabase, org)
    if counts["kept"] and not counts["deleted"] and not counts["archived"]:
        await _audit(current_user, "retention.document.keep",
                     {"event": "retention.document.keep", "policy_id": str(policy_id), "kept": counts["kept"]}, supabase, org)
    return ConfirmOut(**{k: out.get(k) or [] for k in (
        "deleted", "did_not_delete", "kept", "archived", "not_found", "skipped", "failed", "bytes_not_removed",
    )})


@router.post("/documents/{document_id}/unarchive", response_model=UnarchiveOut)
async def unarchive_document(
    request: Request,
    document_id: UUID,
    current_user: dict = Depends(require_org_manage),
    supabase: Client = Depends(get_supabase),
):
    org = _org(request)
    try:
        res = await disposition.unarchive_family(
            await _service_pool(), org, document_id, actor_id=current_user["id"], actor_name=_actor_name(current_user),
        )
    except disposition.DispositionError as exc:
        raise HTTPException(status_code=exc.status, detail=exc.message)
    await _audit(current_user, "retention.document.unarchive",
                 {"event": "retention.document.unarchive", "document_id": str(document_id),
                  "policy_name": res["policy_name"]}, supabase, org)
    return UnarchiveOut(**res)


# ── history ─────────────────────────────────────────────────────────────────────────────────

_READ_ACTIONS = {"dry_run"}


@router.get("/history", response_model=HistoryPage)
async def get_history(
    request: Request,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    _m: dict = Depends(require_org_manage),
):
    org = _org(request)
    rows = await rdb.list_receipts(await _service_pool(), org, offset=offset, limit=limit + 1)
    page = rows[:limit]
    out = []
    for r in page:
        actor = r.get("actor_name") or FORMER_MEMBER
        detail = r.get("detail") or {}
        if isinstance(detail, str):
            try:
                detail = json.loads(detail)
            except ValueError:
                detail = {}
        out.append(HistoryRow(
            id=r["id"], action=r["action"], written=r["action"] not in _READ_ACTIONS,
            document_id=r.get("document_id"), document_name=r.get("document_name"), policy_name=r.get("policy_name"),
            hold_name=r.get("hold_name"), actor_name=actor, detail=detail if isinstance(detail, dict) else {},
            created_at=r["created_at"],
        ))
    return HistoryPage(rows=out, offset=offset, has_more=len(rows) > limit)


# ── run now ─────────────────────────────────────────────────────────────────────────────────

@router.post("/sweep/run", response_model=SweepRunOut)
async def run_sweep_now(request: Request, _m: dict = Depends(require_org_manage)):
    if not settings.retention_sweep_enabled:
        raise HTTPException(status_code=409, detail=SWEEPS_OFF)
    org = _org(request)
    pool = await _service_pool()
    if not await rdb.claim_org_sweep_now(pool, org):
        raise HTTPException(status_code=409, detail=SWEEP_BUSY)
    try:
        result = await disposition.run_org_sweep(pool, org, now=_now())
    except Exception as exc:
        await rdb.release_retention_sweep(pool, org, status="failed", error=f"{type(exc).__name__}: {exc}"[:500])
        raise HTTPException(status_code=500, detail="The sweep failed. Nothing was changed.")
    await rdb.release_retention_sweep(pool, org, status=result.status, error=result.error, counts=result.counts)
    return SweepRunOut(status=result.status, counts=result.counts, error=result.error)


# ── document-states (member-readable; names for org admins only, D-17) ──────────────────────

_SOURCE_CHIPS = {
    "missing_at_source": "deleted_at_source",
    "unauthorized_at_source": "no_longer_shared",
    "source_disconnected": "source_disconnected",
}


def _document_state(snap: OrgSnapshot, doc_id: str, *, can_manage: bool, at: datetime) -> Optional[DocumentState]:
    key = snap.doc_family.get(doc_id)
    fam = snap.family(key) if key else None
    if fam is None:
        return None
    d: Decision = evaluate(fam, snap.ctx, at)
    names = {p.id: p.name for p in snap.policies.values()}
    hold_ids = snap.family_holds.get(fam.family_key, [])
    holds = [snap.holds[h] for h in hold_ids if h in snap.holds]
    held = fam.family_key in snap.ctx.held
    first = holds[0] if holds else {}
    hold_line = hold_line_for(
        can_manage=can_manage, matter=first.get("name"), placed_by=first.get("created_by_name"),
        placed_at=first.get("created_at"),
    ) if held else None
    archived = fam.archived_at is not None
    pname = names.get(d.policy_id or "")

    if held:
        section = DocumentSection(kind="hold")
        chip = "on_hold"
    elif archived:
        section = DocumentSection(kind="archived", policy_name=fam.archived_policy_name, archived_at=fam.archived_at)
        chip = "archived"
    elif d.kind in ("queue_delete", "archive_and_queue_delete") or (d.kind == "pending" and d.queue_kind == "delete"):
        section = DocumentSection(kind="delete_pending", policy_name=pname, due_at=d.due_at)
        chip = "delete_pending"
    elif d.kind == "archive":
        section = DocumentSection(kind="archives_tonight", policy_name=pname, due_at=d.due_at)
        chip = "archives_tonight"
    elif d.kind == "queue_review" or (d.kind == "pending" and d.queue_kind == "review"):
        section = DocumentSection(kind="in_review", policy_name=pname, due_at=d.due_at)
        chip = "in_review"
    elif d.kind == "collision":
        other = next((names.get(x) for x in d.policy_ids[1:]), None)
        section = DocumentSection(kind="disagree", policy_name=pname, other_policy_name=other)
        chip = "policies_disagree"
    elif d.kind == "no_date":
        section = DocumentSection(kind="no_date", policy_name=pname)
        chip = "no_date"
    elif d.kind in ("kept", "unarchived"):
        section = DocumentSection(
            kind=d.kind, policy_name=pname, kept_by=d.skip.actor_name if d.skip else None,
            kept_at=d.skip.created_at if d.skip else None,
        )
        chip = None
    elif d.kind == "not_due":
        section = DocumentSection(kind="not_due", policy_name=pname, due_at=d.due_at, rule_text=d.rule_text)
        chip = None
    else:  # private / no_policy / not_previewed / already_archived
        section = DocumentSection(kind="none")
        chip = None

    return DocumentState(
        document_id=doc_id, chip=chip, source_chip=_SOURCE_CHIPS.get(fam.source_state or ""), held=held,
        hold_line=hold_line, hold_names=[h["name"] for h in holds] if (can_manage and held) else None,
        archived=archived, can_unarchive=bool(can_manage and archived), section=section,
    )


def _folder_state(snap: OrgSnapshot, folder_id: str, *, can_manage: bool) -> Optional[FolderState]:
    if folder_id not in snap.folders:
        return None
    line = None
    p = folder_policy_for(folder_id, snap.ctx)
    if p is not None:
        own = p.folder_id == folder_id
        line = FolderPolicyLine(
            kind="own" if own else "inherited", policy_id=p.id, policy_name=p.name, action=p.stage1.action,
            kept_for_text=kept_for_text(p), rule_text=rule_text(p),
            from_folder_path=None if own else snap.folder_paths.get(p.folder_id or ""),
        )
    hold_ids: list[str] = []
    cur: Optional[str] = folder_id
    seen: set[str] = set()
    while cur is not None and cur not in seen:
        seen.add(cur)
        hold_ids += [h for h in snap.folder_holds.get(cur, []) if h in snap.holds and h not in hold_ids]
        cur = snap.ctx.folder_parent.get(cur)
    held = bool(hold_ids)
    return FolderState(
        folder_id=folder_id, policy=line, held=held,
        hold_names=[snap.holds[h]["name"] for h in hold_ids] if (can_manage and held) else None,
    )


@router.post("/document-states", response_model=DocumentStatesOut, response_model_exclude_none=True)
async def document_states(
    request: Request,
    body: DocumentStatesRequest,
    current_user: dict = Depends(get_current_user),
    active_org: str = Depends(get_active_org_id),
):
    """Any member of the active org. RLS-reads the requested ids AS THE CALLER first, then computes on
    the service pool for that readable subset only; hold names / placers only for org admins (D-17)."""
    org = _org(request)
    async with get_user_pg_connection(request, current_user) as conn:
        docs, folders = await _readable_ids(conn, org, body.document_ids, body.folder_ids)
    can_manage = bool(await deps._has_org_permission(request, current_user, active_org, "org:manage"))
    if not docs and not folders:
        return DocumentStatesOut(documents=[], folders=[], can_manage=can_manage)
    try:
        snap = await _snapshot(org)
    except IncompleteEvaluation:
        raise HTTPException(status_code=503, detail=LOAD_INCOMPLETE)
    at = _now()
    out_docs = [s for d in body.document_ids if str(d) in docs and (s := _document_state(snap, str(d), can_manage=can_manage, at=at))]
    out_folders = [s for f in body.folder_ids if str(f) in folders and (s := _folder_state(snap, str(f), can_manage=can_manage))]
    return DocumentStatesOut(documents=out_docs, folders=out_folders, can_manage=can_manage)
