"""Org-admin surface — the user-side mirror of the operator Control Room (Phase 166).

Every route inherits the router-level ``get_active_org_id`` gate (ADMIN-01/02): a caller
whose validated membership can't be resolved never reaches an endpoint — the active org is
server-validated against ``org_members`` on a user-JWT/RLS connection (D-166-06, never trust
the client's ``X-Org-Id``). The manager-only reads (/org/members, /org/audit) add
``require_org_manage`` (org:manage — mig 104's current_user_has_permission SECDEF helper,
D-166-09). There is NO RLS backstop on the audit read (LANDMINE 1 — the audit_log table has
NO authenticated SELECT policy), so its app-code authz IS the gate.

Endpoints:
- GET /org/me      — membership-reachable probe backing useOrgPermissionsProbe + the org
                     switcher: {org_id, role, can_manage, can_audit_view, memberships[]}.
                     Floor-exempt (probes fire on every mount — mirror admin.py:606).
- GET /org/members — manager-only read-only roster over org_members (+ auth.users email),
                     scoped to the active org. Invite/role editing is Phase 167.
- GET /org/audit   — manager-only org-scoped audit read over the general per-user audit_log
                     ONLY (never the workflow-internal or operator-only audit tables).
                     org:audit_view -> all org rows; else own-only + scope="own" (RLS-honest,
                     never a silent empty list — ADMIN-04 / D-166-04). No CSV (lighter cut).
"""
import logging
from datetime import datetime, timedelta, timezone

import re

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, field_validator
from starlette.concurrency import run_in_threadpool
from supabase import Client

import app.dependencies as deps
from app.dependencies import (
    get_active_org_id,
    get_current_user,
    get_service_role_supabase,
    get_user_pg_connection,
    get_user_supabase_client,
    require_org_invite,
    require_org_manage,
    resolve_active_org_soft,
)
from app.services import invitation_service
from app.services.audit_service import write_audit_entry
from app.services.email_provider import compose_invite_link, get_email_provider

logger = logging.getLogger(__name__)

# ── invitation surface (Phase 167 INV-01/INV-02) ───────────────────────────────
# Roles an invite may grant this phase: member (default) + org-admin. dept-admin is
# schema-valid (mig 104 CHECK) but greyed until Phase 169; super-admin is refused
# server-side (D-167-03). Validated BEFORE any mint/insert.
_INVITE_ROLES = frozenset({"member", "org-admin"})

# Every invitation lifecycle event records an audit row that must land on the org's
# /org/audit tab. It REUSES the existing valid 'settings.update' action_type (org
# administration) rather than a new 'invitation.*' type: the audit_log action_type CHECK
# (mig 071) admits only 19 values and this phase authors NO migration (167-CONTEXT: "NO
# migration is expected"); an unlisted type would silently drop (23514 is swallowed by
# write_audit_entry). The specific event lives in metadata.event. T-167-23: every row
# carries an EXPLICIT org_id (never the ORDER-BY-less mig-106 autofill guess).
_INVITE_AUDIT_ACTION = "settings.update"

# Lightweight email shape check. Deliberately NOT pydantic ``EmailStr`` — that pulls the
# ``email-validator`` package, and this phase adds NO new dependency (threat T-167-SC / the
# offline-safe default). A single-@ / dotted-domain check is sufficient at this trust boundary;
# the invite is a bearer capability, not an identity assertion.
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class SendInvitationBody(BaseModel):
    """POST /org/invitations body — a validated email + the invited role."""

    email: str
    role: str = "member"

    @field_validator("email")
    @classmethod
    def _validate_email(cls, v: str) -> str:
        v = (v or "").strip()
        if not _EMAIL_RE.match(v):
            raise ValueError("A valid email address is required.")
        return v


class AcceptInvitationBody(BaseModel):
    """POST /org/invitations/accept body — the raw invite token from the link."""

    token: str

# Default-deny is enforced PER GUARDED ROUTE, not at the router level (WR-01). The
# manager-only reads (/org/members, /org/audit) each declare require_org_manage, which
# Depends on the STRICT get_active_org_id (spoof → 403; absent-header-with-2+-memberships →
# 400) + the org:manage permission — that gate is UNCHANGED (a HARD invariant). Only the
# bootstrap probe /org/me uses the soft resolver (resolve_active_org_soft): it keeps
# spoof→403 but never 400s a member out of their own switcher-seeding read (D-166-06).
# A router-level get_active_org_id CANNOT stay here — it would 400 /org/me for a fresh
# 2+-org session, the exact circular deadlock WR-01 fixes.
router = APIRouter(
    prefix="/org",
    tags=["org"],
)


# ── audit query-builder helpers (audit.py:27-46 shape + an org predicate) ──────
def _since_to_dt(since: str | None) -> datetime | None:
    """Convert the since chip (7d/30d/90d) to a UTC cutoff (audit.py:27-35 shape)."""
    if since == "7d":
        return datetime.now(timezone.utc) - timedelta(days=7)
    if since == "30d":
        return datetime.now(timezone.utc) - timedelta(days=30)
    if since == "90d":
        return datetime.now(timezone.utc) - timedelta(days=90)
    return None


def _apply_org_audit_filters(query, active_org, own_user_id, since, action_type):
    """Apply the org predicate (ALWAYS) + optional own-scope / since / action filters.

    ``active_org`` is ALWAYS applied — never a cross-org read. ``own_user_id`` is applied
    ONLY on the own-only degrade branch (caller lacks org:audit_view) — the load-bearing
    ADMIN-04 filter that keeps a non-viewer from ever seeing another member's rows.
    """
    query = query.eq("org_id", active_org)
    if own_user_id is not None:
        query = query.eq("user_id", own_user_id)
    dt = _since_to_dt(since)
    if dt is not None:
        query = query.gte("created_at", dt.isoformat())
    if action_type:
        query = query.eq("action_type", action_type)
    return query


def _get_org_audit_supabase(active_org: str = Depends(get_active_org_id)) -> Client:
    # service-role: audit_log has NO authenticated SELECT policy — a user-JWT read returns
    # empty (LANDMINE 1); the org:audit_view app-code authz below is the ONLY gate. Scoped by
    # the server-validated active_org (get_service_role_supabase REFUSES a falsy org).
    return get_service_role_supabase(active_org)


@router.get("/me")
async def get_org_me(
    request: Request,
    current_user: dict = Depends(get_current_user),
    active_org: str | None = Depends(resolve_active_org_soft),
):
    """Membership-reachable probe for useOrgPermissionsProbe + the org switcher (ADMIN-02).

    Floor-exempt (the frontend probes this on every mount — mirror admin.py:606). Uses the
    SOFT resolver (resolve_active_org_soft, WR-01) so a fresh 2+-org session with NO X-Org-Id
    header can still bootstrap the switcher: a present header is validated (spoof → 403), an
    absent header resolves the caller's default org, and a caller with no membership resolves
    to None (empty memberships[], never a 400). Computes can_manage / can_audit_view for the
    RESOLVED org AS THE CALLER (D-166-09), and returns the caller's memberships[] (org_members
    JOIN organizations) on a user-JWT/RLS connection so the switcher has its data.
    """
    role = request.state.org_role or "member"
    if active_org:
        can_manage = await deps._has_org_permission(
            request, current_user, active_org, "org:manage"
        )
        can_audit_view = await deps._has_org_permission(
            request, current_user, active_org, "org:audit_view"
        )
    else:
        # No resolved org (0-membership caller): fail-closed booleans, still return the
        # (empty) memberships[] so the client renders a switcher-less identity, not an error.
        can_manage = False
        can_audit_view = False

    async with get_user_pg_connection(request, current_user) as conn:
        rows = await conn.fetch(
            "SELECT m.org_id, o.name, m.role "
            "FROM public.org_members m "
            "JOIN public.organizations o ON o.id = m.org_id "
            "WHERE m.user_id = auth.uid() "
            "ORDER BY o.name"
        )
    memberships = [
        {"org_id": str(r["org_id"]), "name": r["name"], "role": r["role"]} for r in rows
    ]
    return {
        "org_id": str(active_org) if active_org else None,
        "role": role,
        "can_manage": bool(can_manage),
        "can_audit_view": bool(can_audit_view),
        "memberships": memberships,
    }


@router.get("/members")
async def get_org_members(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    _manage: dict = Depends(require_org_manage),
):
    """Read-only member roster for the active org (ADMIN-01; manager-only).

    require_org_manage gates it (org:manage). Reads org_members JOIN auth.users (email)
    scoped to the server-validated active_org via the singleton pool — a cross-member read
    behind the manage gate with NO RLS backstop (the list_users_roster precedent). The
    auth.users email join needs the postgres role, so this is NOT a user-JWT read. 1-based
    pagination, page_size clamp <= 100. Invite/role editing is Phase 167 — read-only here.
    """
    active_org = deps._to_uuid(request.state.active_org)
    offset = (max(1, page) - 1) * page_size

    pool = await deps.get_pg_pool()  # service-role (BYPASSRLS): org-scoped roster behind require_org_manage; auth.users email join needs the postgres role
    count_row = await pool.fetchrow(
        "SELECT count(*) AS n FROM public.org_members WHERE org_id = $1", active_org
    )
    total = count_row["n"] if count_row else 0
    rows = await pool.fetch(
        "SELECT m.user_id, u.email, m.role, m.created_at AS joined_at "
        "FROM public.org_members m "
        "JOIN auth.users u ON u.id = m.user_id "
        "WHERE m.org_id = $1 "
        "ORDER BY m.created_at "
        "LIMIT $2 OFFSET $3",
        active_org,
        page_size,
        offset,
    )
    members = [
        {
            "user_id": str(r["user_id"]),
            "email": r["email"],
            "role": r["role"],
            "joined_at": r["joined_at"].isoformat() if r["joined_at"] else None,
            # Adoption state is server-derived (never a client flag): a membership row → active.
            "state": invitation_service.derive_adoption_state(None, has_membership=True),
        }
        for r in rows
    ]

    # Adoption chips (INV-01): surface the org's still-PENDING invitees (no membership yet) so
    # the roster renders not-yet-invited / pending / active from server truth. Scoped to the
    # server-validated active_org, behind the same require_org_manage gate (service-role read —
    # org_invitations has email directly, no auth.users join; the list_users_roster precedent).
    # WR-03: dedupe against ALL org members (org-scoped, pagination-INDEPENDENT) — never just
    # the current page's `members`. A pending invite whose email already belongs to a member on
    # ANOTHER page (a re-invite, or any member beyond page_size) must NOT render a false
    # 'pending' chip; the page-scoped set made the chip state page-dependent and inconsistent.
    all_member_rows = await pool.fetch(
        "SELECT u.email FROM public.org_members m "
        "JOIN auth.users u ON u.id = m.user_id "
        "WHERE m.org_id = $1",
        active_org,
    )
    member_emails = {r["email"] for r in all_member_rows if r["email"]}
    invite_rows = await pool.fetch(
        "SELECT id, email, role, status, created_at, expires_at "
        "FROM public.org_invitations "
        "WHERE org_id = $1 AND status = 'pending' AND expires_at > now() "
        "ORDER BY created_at DESC",
        active_org,
    )
    pending_invitations = [
        {
            "id": str(r["id"]),
            "email": r["email"],
            "role": r["role"],
            "status": r["status"],
            # A pending invite whose email is NOT yet a member → the 'pending' adoption chip.
            "state": invitation_service.derive_adoption_state(
                r["status"], has_membership=False
            ),
            "invited_at": r["created_at"].isoformat() if r["created_at"] else None,
            "expires_at": r["expires_at"].isoformat() if r["expires_at"] else None,
        }
        for r in invite_rows
        if r["email"] not in member_emails  # already a member → shows as active, not pending
    ]

    return {
        "members": members,
        "pending_invitations": pending_invitations,
        "page": max(1, page),
        "page_size": page_size,
        "total": total,
    }


@router.get("/audit")
async def get_org_audit(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    since: str | None = Query(None),
    action_type: str | None = Query(None),
    current_user: dict = Depends(get_current_user),
    _manage: dict = Depends(require_org_manage),
    supabase: Client = Depends(_get_org_audit_supabase),  # service-role: audit_log has NO authenticated SELECT policy — app-code authz is the only gate
):
    """Org-scoped audit read (ADMIN-04 / LANDMINE 1; manager-only + org:audit_view degrade).

    Source is the general per-user audit_log ONLY (never the workflow-internal or
    operator-only audit tables). The read is service-role + app-code authz (audit_log has NO
    authenticated SELECT policy, so a user-JWT read is RLS-denied -> empty). ALWAYS scoped
    .eq("org_id", active_org). Branch on org:audit_view: True -> all org rows (scope="all");
    False -> own-only .eq("user_id", caller) (scope="own") — an RLS-honest degrade the
    frontend banners, NEVER a silent empty list (D-166-04). CSV + multi-source are deferred.
    """
    active_org = request.state.active_org
    can_audit_view = await deps._has_org_permission(
        request, current_user, active_org, "org:audit_view"
    )
    scope = "all" if can_audit_view else "own"
    own_user_id = None if can_audit_view else current_user["id"]

    offset = (max(1, page) - 1) * page_size

    count_q = supabase.table("audit_log").select("id", count="exact")
    count_q = _apply_org_audit_filters(count_q, active_org, own_user_id, since, action_type)
    count_res = await run_in_threadpool(lambda: count_q.execute())
    total = (
        count_res.count
        if getattr(count_res, "count", None) is not None
        else len(count_res.data)
    )

    data_q = supabase.table("audit_log").select(
        "id, user_id, action_type, metadata, created_at, org_id"
    )
    data_q = _apply_org_audit_filters(data_q, active_org, own_user_id, since, action_type)
    data_q = data_q.order("created_at", desc=True).range(offset, offset + page_size - 1)
    data_res = await run_in_threadpool(lambda: data_q.execute())

    return {
        "entries": data_res.data,
        "total": total,
        "page": max(1, page),
        "page_size": page_size,
        "scope": scope,
    }


# ── invitations (INV-01) — send + list, org:invite-gated on the user-JWT connection ─────
@router.post("/invitations")
async def send_org_invitation(
    request: Request,
    body: SendInvitationBody,
    current_user: dict = Depends(require_org_invite),
    audit_supabase: Client = Depends(get_user_supabase_client),
):
    """Send an org invitation (INV-01; org:invite-gated, default-deny 403).

    Mints a one-way-hashed token (invitation_service), INSERTs the pending invite on the
    CALLER'S user-JWT/RLS connection so the mig-104 ``org_invitations_insert WITH CHECK
    (org:invite AND org_id ∈ current_user_org_ids)`` policy is the real wall (Pitfall 6) —
    org_id is server-pinned to ``request.state.active_org``, NEVER client-supplied. Returns
    the copy/share LINK (the raw token lives ONLY there, T-161-04); token_hash is never
    selected or returned. Delivery is link-first: the env-switched provider (default none-log)
    best-effort emails the link, but a delivery failure never fails the invite. The audit row
    carries an EXPLICIT org_id=active_org (T-167-23 — never the mig-106 autofill guess).
    """
    active_org = deps._to_uuid(request.state.active_org)
    email = str(body.email)
    role = body.role
    if role not in _INVITE_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invitations may grant only the member or org-admin role.",
        )

    raw, token_hash = invitation_service.mint_invite_token()
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)  # A1 default — 7d

    async with get_user_pg_connection(request, current_user) as conn:
        # Dedup (IN-02): if a still-pending invite already exists for this (org, email),
        # REFRESH it (new token + role + 7-day expiry) instead of inserting a duplicate —
        # i.e. re-inviting behaves as a resend, so the invitations list never doubles up.
        # Case-insensitive on email; the mig-104 org_invitations_update WITH CHECK (org:invite)
        # RLS admits the caller (who holds org:invite via require_org_invite).
        inv_row = await conn.fetchrow(
            "UPDATE public.org_invitations "
            "SET role = $3, token_hash = $4, expires_at = $5, updated_at = now() "
            "WHERE org_id = $1 AND lower(email) = lower($2) AND status = 'pending' "
            "RETURNING id, email, role, status, expires_at",
            active_org, email, role, token_hash, expires_at,
        )
        if inv_row is None:
            inv_row = await conn.fetchrow(
                "INSERT INTO public.org_invitations "
                "(org_id, email, role, token_hash, status, expires_at, invited_by) "
                "VALUES ($1, $2, $3, $4, 'pending', $5, auth.uid()) "
                "RETURNING id, email, role, status, expires_at",
                active_org, email, role, token_hash, expires_at,
            )
        org_row = await conn.fetchrow(
            "SELECT name FROM public.organizations WHERE id = $1", active_org
        )

    org_name = org_row["name"] if org_row else "your organization"
    link = compose_invite_link(raw)
    try:
        # WR-01 (D-v2.5-01): send_invite is a BLOCKING HTTP call on the resend path — never
        # run it directly on the event loop. run_in_threadpool keeps the async handler free.
        await run_in_threadpool(get_email_provider().send_invite, email, link, org_name)
    except Exception as exc:  # link-first: delivery never fails the invite
        logger.error("invite email delivery failed for %s: %s", email, exc)

    await write_audit_entry(
        user_id=current_user["id"],
        action_type=_INVITE_AUDIT_ACTION,
        metadata={
            "event": "invitation.send",
            "invitation_id": str(inv_row["id"]),
            "email": email,
            "role": role,
        },
        supabase=audit_supabase,
        org_id=str(request.state.active_org),  # EXPLICIT active_org (T-167-23)
    )

    return {
        "link": link,
        "invitation": {
            "id": str(inv_row["id"]),
            "email": inv_row["email"],
            "role": inv_row["role"],
            "status": inv_row["status"],
            "expires_at": (
                inv_row["expires_at"].isoformat() if inv_row["expires_at"] else None
            ),
        },
    }


@router.get("/invitations")
async def list_org_invitations(
    request: Request,
    status_filter: str | None = Query(None, alias="status"),
    current_user: dict = Depends(require_org_invite),
):
    """List the active org's invitations (INV-01; org:invite-gated).

    Reads ``org_invitations`` for the server-validated active org on the user-JWT connection
    (the mig-104 ``org_invitations_select`` RLS admits members). token_hash is NEVER in the
    select list (T-161-04) — only id/email/role/status/expires_at/invited_by/created_at. An
    optional ``?status=`` chip filters by lifecycle state.
    """
    active_org = deps._to_uuid(request.state.active_org)
    cols = (
        "SELECT id, email, role, status, expires_at, invited_by, created_at "
        "FROM public.org_invitations WHERE org_id = $1"
    )
    async with get_user_pg_connection(request, current_user) as conn:
        if status_filter:
            rows = await conn.fetch(
                cols + " AND status = $2 ORDER BY created_at DESC",
                active_org, status_filter,
            )
        else:
            rows = await conn.fetch(cols + " ORDER BY created_at DESC", active_org)

    return {
        "invitations": [
            {
                "id": str(r["id"]),
                "email": r["email"],
                "role": r["role"],
                "status": r["status"],
                "expires_at": r["expires_at"].isoformat() if r["expires_at"] else None,
                "invited_by": str(r["invited_by"]) if r["invited_by"] else None,
                "created_at": r["created_at"].isoformat() if r["created_at"] else None,
            }
            for r in rows
        ]
    }


@router.post("/invitations/{invite_id}/resend")
async def resend_org_invitation(
    request: Request,
    invite_id: str,
    current_user: dict = Depends(require_org_invite),
    audit_supabase: Client = Depends(get_user_supabase_client),
):
    """Re-mint a fresh token + expiry for a pending invite (INV-01; org:invite-gated).

    UPDATEs the pending invite's token_hash + expires_at on the user-JWT connection (the
    mig-104 ``org_invitations_update`` RLS ``WITH CHECK (org:invite)`` backstops the app gate),
    pinned to ``id AND org_id=active_org AND status='pending'`` — a non-pending / cross-org id
    matches no row → 404. Returns the FRESH link, re-issues the email, and audits with an
    EXPLICIT org_id=active_org.
    """
    active_org = deps._to_uuid(request.state.active_org)
    inv_uuid = deps._to_uuid(invite_id)
    if inv_uuid is None:
        raise HTTPException(status_code=404, detail="Invitation not found")

    raw, token_hash = invitation_service.mint_invite_token()
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)

    async with get_user_pg_connection(request, current_user) as conn:
        row = await conn.fetchrow(
            "UPDATE public.org_invitations "
            "SET token_hash = $1, expires_at = $2, updated_at = now() "
            "WHERE id = $3 AND org_id = $4 AND status = 'pending' "
            "RETURNING id, email, role",
            token_hash, expires_at, inv_uuid, active_org,
        )
        org_row = (
            await conn.fetchrow(
                "SELECT name FROM public.organizations WHERE id = $1", active_org
            )
            if row is not None
            else None
        )

    if row is None:
        raise HTTPException(status_code=404, detail="Invitation not found")

    org_name = org_row["name"] if org_row else "your organization"
    link = compose_invite_link(raw)
    try:
        # WR-01 (D-v2.5-01): blocking HTTP on the resend path — wrap so the async handler
        # never stalls the event loop while Resend responds.
        await run_in_threadpool(get_email_provider().send_invite, row["email"], link, org_name)
    except Exception as exc:  # link-first: delivery never fails the resend
        logger.error("invite email re-delivery failed for %s: %s", row["email"], exc)

    await write_audit_entry(
        user_id=current_user["id"],
        action_type=_INVITE_AUDIT_ACTION,
        metadata={
            "event": "invitation.resend",
            "invitation_id": str(row["id"]),
            "email": row["email"],
            "role": row["role"],
        },
        supabase=audit_supabase,
        org_id=str(request.state.active_org),  # EXPLICIT active_org (T-167-23)
    )

    return {
        "link": link,
        "invitation": {"id": str(row["id"]), "email": row["email"], "role": row["role"]},
    }


@router.delete("/invitations/{invite_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_org_invitation(
    request: Request,
    invite_id: str,
    current_user: dict = Depends(require_org_invite),
    audit_supabase: Client = Depends(get_user_supabase_client),
):
    """Revoke a pending invite (INV-01; org:invite-gated).

    Sets ``status='revoked'`` (a soft state flip, NOT a hard DELETE — keeps the audit trail;
    the mig-104 ``org_invitations_update`` RLS gates it) pinned to ``id AND org_id=active_org
    AND status='pending'`` — a non-pending / cross-org id matches no row → 404. Records an
    EXPLICIT org_id=active_org audit row, then returns 204.
    """
    active_org = deps._to_uuid(request.state.active_org)
    inv_uuid = deps._to_uuid(invite_id)
    if inv_uuid is None:
        raise HTTPException(status_code=404, detail="Invitation not found")

    async with get_user_pg_connection(request, current_user) as conn:
        row = await conn.fetchrow(
            "UPDATE public.org_invitations SET status = 'revoked', updated_at = now() "
            "WHERE id = $1 AND org_id = $2 AND status = 'pending' "
            "RETURNING id, email",
            inv_uuid, active_org,
        )

    if row is None:
        raise HTTPException(status_code=404, detail="Invitation not found")

    await write_audit_entry(
        user_id=current_user["id"],
        action_type=_INVITE_AUDIT_ACTION,
        metadata={
            "event": "invitation.revoke",
            "invitation_id": str(row["id"]),
            "email": row["email"],
        },
        supabase=audit_supabase,
        org_id=str(request.state.active_org),  # EXPLICIT active_org (T-167-23)
    )
    return None


@router.post("/invitations/accept")
async def accept_org_invitation(
    body: AcceptInvitationBody,
    current_user: dict = Depends(get_current_user),
    audit_supabase: Client = Depends(get_user_supabase_client),
):
    """Accept an invitation via its token (INV-02 — the JIT seam; token-gated).

    Depends on ``get_current_user`` ONLY — NO ``require_org_invite`` / NO ``X-Org-Id``: the
    invitee is not yet a member, so the org comes from the VALIDATED token, never the client
    (Pitfall 2). ``accept_invitation`` (Plan 01) runs the whole check → advisory-lock →
    ``INSERT … org_members … ON CONFLICT DO NOTHING`` → guarded status flip on the singleton
    pool (the token-authorized service-role/BYPASSRLS path the user-JWT RLS cannot take). It is
    idempotent + re-runnable, so the Plan-06 landing can safely call it on the FIRST
    authenticated session regardless of email-confirm timing (RESEARCH OQ1), and join-additive
    (D-167-01 — the invitee KEEPS their personal org).

    On a fresh successful join the audit row carries the INVITATION's org_id (the org joined),
    NEVER the ORDER-BY-less mig-106 autofill — which, for a 2+-org invitee, would tag the wrong
    org (T-167-23). Status mapping: unknown token → 404; expired / revoked → 409; a valid
    accept (or an idempotent already-accepted re-accept) → 200.
    """
    token_hash = invitation_service.hash_token(body.token)
    pool = await deps.get_pg_pool()
    result = await invitation_service.accept_invitation(
        pool, token_hash, current_user["id"]
    )

    reason = result.get("reason")
    if reason == "not_found":
        raise HTTPException(status_code=404, detail="This invitation is no longer valid.")
    # already_accepted is an idempotent no-op (200) — only a genuinely unclaimable invite
    # (expired / revoked) is rejected.
    if not result["claimable"] and reason != "already_accepted":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"This invitation cannot be accepted ({reason}).",
        )

    # Audit ONLY the FIRST successful join (claimable) — carrying the org the invitee JOINED
    # (result["org_id"]), never active_org (the accept path resolves none) nor the autofill.
    if result["claimable"]:
        await write_audit_entry(
            user_id=current_user["id"],
            action_type=_INVITE_AUDIT_ACTION,
            metadata={"event": "invitation.accept", "role": result["role"]},
            supabase=audit_supabase,
            org_id=result["org_id"],  # the INVITATION's org (T-167-23)
        )

    return {
        "org_id": result["org_id"],
        "role": result["role"],
        "joined": result["joined"],
    }
