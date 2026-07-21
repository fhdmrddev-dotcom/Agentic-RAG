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

from fastapi import APIRouter, Depends, Query, Request
from starlette.concurrency import run_in_threadpool
from supabase import Client

import app.dependencies as deps
from app.dependencies import (
    get_active_org_id,
    get_current_user,
    get_service_role_supabase,
    get_user_pg_connection,
    require_org_manage,
    resolve_active_org_soft,
)

logger = logging.getLogger(__name__)

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
        }
        for r in rows
    ]
    return {
        "members": members,
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
