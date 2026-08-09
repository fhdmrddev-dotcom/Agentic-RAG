"""Phase 168 (SSO-01 / D-168-02 / D-168-04) — public domain routing + domain-gated JIT + approval.

Plan 04 Task 2. Drives the REAL endpoints over the REAL local Postgres (:54322):

  * ``GET /org/sso/route`` is FULLY PUBLIC (no auth dependency): reachable with NO Authorization
    header (a 403 here would lock out ALL login via Plan 06). Returns a BARE ``{"sso": bool}``
    keyed on domain→active-config presence only — never a provider_id/org_id, never whether an
    account exists (anti-enumeration, T-168-10). active-only, case-insensitive.
  * ``POST /org/sso/provision`` resolves the org from the authenticated SSO provider
    (``auth.identities`` → ``sso_configs.provider_id`` → org), never a client claim; a password
    user (no SSO identity) is a 200 no-op; a non-active config is a fail-closed 403.
  * ``POST /admin/sso/configs/{id}/approve`` flips pending_approval → active (operator-only, D-168-05
    Control 2); a non-operator gets the byte-identical /admin 404.

Real DB, no live SAML. Modeled on test_168_sso_jit.py + the conftest two-org scaffold.
"""
from __future__ import annotations

import uuid
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest
import pytest_asyncio

from app.api import admin as admin_api
from app.api import org as org_api
from app.dependencies import authenticate_operator_request, get_current_user, get_supabase
from tests.integration._rls_harness import requires_pg

pytestmark = requires_pg


async def _table_exists(pool, table: str) -> bool:
    return bool(await pool.fetchval(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
        "WHERE table_schema='public' AND table_name=$1)",
        table,
    ))


@pytest_asyncio.fixture
async def sso_routing_env(pg_pool):
    """Seed one org with active / pending / disabled configs + SSO and password users.

    Configs (all in ``org``):
      * active.example   → provider ``P_ACTIVE``,   status='active'
      * pending.example  → provider ``P_PENDING``,  status='pending_approval'
      * disabled.example → provider ``P_DISABLED``, status='disabled'

    Users:
      * ``sso_active``  — auth.identities provider ``sso:P_ACTIVE``  (routes to the active config)
      * ``sso_pending`` — auth.identities provider ``sso:P_PENDING`` (a non-active config → 403)
      * ``password``    — NO sso identity (a password user; provision is a no-op)

    FK-safe teardown: identities + memberships by user, configs + org, personal orgs, users.
    """
    for tbl in ("organizations", "org_members", "sso_configs"):
        if not await _table_exists(pg_pool, tbl):
            pytest.skip(f"{tbl} absent — org schema (mig 104/105/113) not applied")

    org_id = uuid.uuid4()
    await pg_pool.execute(
        "INSERT INTO public.organizations (id, name) VALUES ($1, $2)",
        org_id, f"168-routing-org-{org_id}",
    )

    p_active = str(uuid.uuid4())
    p_pending = str(uuid.uuid4())
    p_disabled = str(uuid.uuid4())
    for domain, pid, st in (
        ("active.example", p_active, "active"),
        ("pending.example", p_pending, "pending_approval"),
        ("disabled.example", p_disabled, "disabled"),
    ):
        await pg_pool.execute(
            "INSERT INTO public.sso_configs (org_id, email_domain, provider_id, status) "
            "VALUES ($1, $2, $3, $4)",
            org_id, domain, pid, st,
        )

    extra_orgs: list = []

    async def _new_user(sso_provider: str | None) -> uuid.UUID:
        uid = uuid.uuid4()
        await pg_pool.execute(
            "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
            uid, f"168-routing-{uid}@corp.example",
        )
        for r in await pg_pool.fetch(
            "SELECT org_id FROM public.org_members WHERE user_id = $1", uid
        ):
            extra_orgs.append(r["org_id"])
        if sso_provider is not None:
            await pg_pool.execute(
                "INSERT INTO auth.identities (user_id, provider_id, identity_data, provider) "
                "VALUES ($1, $2, '{}'::jsonb, $3)",
                uid, str(uuid.uuid4()), f"sso:{sso_provider}",
            )
        return uid

    sso_active = await _new_user(p_active)
    sso_pending = await _new_user(p_pending)
    password = await _new_user(None)

    ctx = {
        "org_id": str(org_id),
        "p_active": p_active,
        "sso_active": {"id": str(sso_active), "email": "sso@corp.example"},
        "sso_pending": {"id": str(sso_pending), "email": "pend@corp.example"},
        "password": {"id": str(password), "email": "pw@corp.example"},
    }
    try:
        yield ctx
    finally:
        for uid in (sso_active, sso_pending, password):
            await pg_pool.execute("DELETE FROM auth.identities WHERE user_id = $1", uid)
            await pg_pool.execute("DELETE FROM public.org_members WHERE user_id = $1", uid)
        await pg_pool.execute("DELETE FROM public.sso_configs WHERE org_id = $1", org_id)
        for oid in [org_id, *extra_orgs]:
            try:
                await pg_pool.execute("DELETE FROM public.organizations WHERE id = $1", oid)
            except Exception:
                pass
        for uid in (sso_active, sso_pending, password):
            try:
                await pg_pool.execute("DELETE FROM public.profiles WHERE id = $1", uid)
            except Exception:
                pass
            await pg_pool.execute("DELETE FROM auth.users WHERE id = $1", uid)


@asynccontextmanager
async def _client(app):
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


def _org_app(current_user: dict | None = None):
    from fastapi import FastAPI

    app = FastAPI()
    app.include_router(org_api.router)
    if current_user is not None:
        app.dependency_overrides[get_current_user] = lambda: current_user
    return app


def _admin_app(operator_identity: dict):
    from fastapi import FastAPI

    app = FastAPI()
    app.include_router(admin_api.router)
    app.dependency_overrides[authenticate_operator_request] = lambda: operator_identity
    app.dependency_overrides[get_supabase] = lambda: MagicMock()
    return app


# ── /org/sso/route — fully public, boolean-only, active-only ───────────────────────

async def test_route_public_no_auth_header_200(sso_routing_env):
    """GET /org/sso/route with NO Authorization header → 200 (NEVER 403) — the login page calls
    this pre-session; a 403 here would lock out ALL login (Plan 06)."""
    app = _org_app()  # NO get_current_user override — prove there is no auth dependency
    async with _client(app) as c:
        res = await c.get("/org/sso/route", params={"domain": "active.example"})
    assert res.status_code == 200, f"the route must be public (200 anonymous); got {res.status_code}"
    body = res.json()
    assert body == {"sso": True}, f"active domain must return exactly {{'sso': True}}; got {body}"


async def test_route_active_only_and_case_insensitive(sso_routing_env):
    """Only an ACTIVE config routes; pending/disabled/unknown → false; matching is case-insensitive."""
    app = _org_app()
    async with _client(app) as c:
        for domain, expect in (
            ("active.example", True),
            ("ACTIVE.EXAMPLE", True),   # case-insensitive
            ("pending.example", False),  # pending_approval never routes
            ("disabled.example", False),
            ("nobody.example", False),   # unknown domain
        ):
            res = await c.get("/org/sso/route", params={"domain": domain})
            assert res.status_code == 200, res.text
            assert res.json() == {"sso": expect}, f"{domain} expected sso={expect}, got {res.json()}"


async def test_route_boolean_only_no_enumeration(sso_routing_env):
    """The response is STRICTLY {'sso': bool} — no provider_id/org_id, and an unknown domain
    returns the SAME shape as a configured-but-inactive one (no account-existence leak)."""
    app = _org_app()
    async with _client(app) as c:
        unknown = await c.get("/org/sso/route", params={"domain": "who.example"})
        inactive = await c.get("/org/sso/route", params={"domain": "disabled.example"})
    assert set(unknown.json().keys()) == {"sso"}, f"only the 'sso' key may be returned; got {unknown.json()}"
    assert unknown.json() == inactive.json() == {"sso": False}, "no domain-existence leak in the response"


# ── /org/sso/provision — org from the authenticated provider, member-only, idempotent ──

async def test_provision_from_provider_id(sso_routing_env, pg_pool):
    """An SSO user whose auth.identities maps to an ACTIVE config joins that config's org as
    'member'; a re-provision is an idempotent no-op."""
    app = _org_app(sso_routing_env["sso_active"])
    async with _client(app) as c:
        first = await c.post("/org/sso/provision", headers={"Authorization": "Bearer t"})
        assert first.status_code == 200, first.text
        payload = first.json()
        assert payload["org_id"] == sso_routing_env["org_id"]
        assert payload["role"] == "member"
        assert payload["joined"] is True

        second = await c.post("/org/sso/provision", headers={"Authorization": "Bearer t"})
        assert second.status_code == 200, second.text
        assert second.json()["joined"] is False, "a re-provision must be an idempotent no-op"

    cnt = await pg_pool.fetchval(
        "SELECT count(*) FROM public.org_members WHERE org_id = $1 AND user_id = $2",
        uuid.UUID(sso_routing_env["org_id"]), uuid.UUID(sso_routing_env["sso_active"]["id"]),
    )
    assert cnt == 1, f"exactly one membership must exist after provision, got {cnt}"


async def test_provision_password_user_is_noop(sso_routing_env):
    """A password user (no SSO identity) hitting provision is a 200 no-op, never an error."""
    app = _org_app(sso_routing_env["password"])
    async with _client(app) as c:
        res = await c.post("/org/sso/provision", headers={"Authorization": "Bearer t"})
    assert res.status_code == 200, res.text
    assert res.json() == {"org_id": None, "role": None, "joined": False}


async def test_provision_inactive_config_403(sso_routing_env):
    """An SSO user whose provider maps to a NON-active config is a fail-closed 403."""
    app = _org_app(sso_routing_env["sso_pending"])
    async with _client(app) as c:
        res = await c.post("/org/sso/provision", headers={"Authorization": "Bearer t"})
    assert res.status_code == 403, f"a non-active config must fail closed 403; got {res.status_code}"


# ── operator approval (D-168-05 Control 2) ─────────────────────────────────────────

async def test_operator_approve_flips_pending_to_active(sso_routing_env, pg_pool, monkeypatch):
    """An operator flips a pending_approval config to active, recording approved_by/approved_at."""
    monkeypatch.setattr("app.dependencies.is_operator", AsyncMock(return_value=True))
    operator_id = str(uuid.uuid4())

    cfg = await pg_pool.fetchrow(
        "SELECT id FROM public.sso_configs WHERE org_id = $1 AND status = 'pending_approval'",
        uuid.UUID(sso_routing_env["org_id"]),
    )
    config_id = str(cfg["id"])

    app = _admin_app({"id": operator_id, "email": "op@corp.example"})
    async with _client(app) as c:
        res = await c.post(f"/admin/sso/configs/{config_id}/approve", headers={"Authorization": "Bearer t"})
    assert res.status_code == 204, f"approve must return 204; got {res.status_code}: {res.text}"

    row = await pg_pool.fetchrow(
        "SELECT status, approved_by, approved_at FROM public.sso_configs WHERE id = $1",
        uuid.UUID(config_id),
    )
    assert row["status"] == "active", "the config must be flipped to active"
    assert str(row["approved_by"]) == operator_id, "approved_by must record the operator"
    assert row["approved_at"] is not None, "approved_at must be stamped"


async def test_non_operator_approve_404(sso_routing_env, pg_pool, monkeypatch):
    """A non-operator gets the byte-identical /admin 404 (non-discoverable) — no flip."""
    monkeypatch.setattr("app.dependencies.is_operator", AsyncMock(return_value=False))

    cfg = await pg_pool.fetchrow(
        "SELECT id FROM public.sso_configs WHERE org_id = $1 AND status = 'pending_approval'",
        uuid.UUID(sso_routing_env["org_id"]),
    )
    config_id = str(cfg["id"])

    app = _admin_app({"id": str(uuid.uuid4()), "email": "notop@corp.example"})
    async with _client(app) as c:
        res = await c.post(f"/admin/sso/configs/{config_id}/approve", headers={"Authorization": "Bearer t"})
    assert res.status_code == 404, f"a non-operator must get 404; got {res.status_code}"

    row = await pg_pool.fetchrow(
        "SELECT status FROM public.sso_configs WHERE id = $1", uuid.UUID(config_id)
    )
    assert row["status"] == "pending_approval", "a non-operator must not flip the config"
