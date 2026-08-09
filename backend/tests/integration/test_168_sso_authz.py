"""Phase 168 (SSO-01 / D-168-01) — the org-admin SSO provider-CRUD authz + blocklist gate.

Plan 04 Task 1. Drives the REAL `/org/sso/providers` endpoints over the REAL local Postgres
(:54322) so the security wall is a MEASURED property, not a claim:

  * mig-113 grant (org-admin holds `sso:manage`) lets an org-admin through; a plain member is 403
    (`-k sso_permission`) — `require_sso_manage` + the mig-104 `sso_configs_insert` RLS.
  * A spoofed / non-member active org (`X-Org-Id`) is 403 (`get_active_org_id` is the wall).
  * A public/free email domain (gmail.com) is rejected 422 BEFORE any provider call — NO row.
  * DELETE calls `sso_provider_service.delete_provider` BEFORE deleting the `sso_configs` row.
  * `/org/me` exposes `can_manage_sso` (true for org-admin, false for a member).

The provider-CRUD HTTP calls are mocked (`sso_provider_service.create_provider/delete_provider`);
the DB is REAL. Every write lands on the caller's user-JWT connection so mig-104 RLS is the wall.
Modeled on `test_168_sso_jit.py` (real DB, `pg_pool` fixture) + the conftest two-org scaffold.
"""
from __future__ import annotations

import uuid
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest
import pytest_asyncio

import app.services.sso_provider_service as sso_svc
from app.api import org as org_api
from app.dependencies import get_current_user, get_user_supabase_client
from tests.integration._rls_harness import requires_pg

pytestmark = requires_pg


async def _table_exists(pool, table: str) -> bool:
    return bool(await pool.fetchval(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
        "WHERE table_schema='public' AND table_name=$1)",
        table,
    ))


@pytest_asyncio.fixture
async def sso_authz_env(pg_pool):
    """Seed two disjoint orgs + an org-admin and a plain member of org X.

    * ``org_x`` / ``org_y`` — two standalone orgs (org_y is the cross-org target the admin is
      NOT a member of).
    * ``user_admin`` — an ``org-admin`` of org X (holds ``sso:manage`` after mig 113).
    * ``user_member`` — a plain ``member`` of org X (does NOT hold ``sso:manage``).

    The mig-105 ``handle_new_user`` trigger also gives each user a personal org; those are
    captured for FK-safe teardown. Every SSO write is cleaned up by ``org_id``.
    """
    for tbl in ("organizations", "org_members", "sso_configs"):
        if not await _table_exists(pg_pool, tbl):
            pytest.skip(f"{tbl} absent — org schema (mig 104/105/113) not applied")

    org_x = uuid.uuid4()
    org_y = uuid.uuid4()
    await pg_pool.execute(
        "INSERT INTO public.organizations (id, name) VALUES ($1, $2), ($3, $4)",
        org_x, f"168-authz-orgX-{org_x}", org_y, f"168-authz-orgY-{org_y}",
    )

    extra_orgs: list = []

    async def _new_user(role: str, org_id) -> uuid.UUID:
        uid = uuid.uuid4()
        await pg_pool.execute(
            "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
            uid, f"168-authz-{role}-{uid}@corp.example",
        )
        # Capture any personal org the mig-105 trigger auto-created (for teardown).
        for r in await pg_pool.fetch(
            "SELECT org_id FROM public.org_members WHERE user_id = $1", uid
        ):
            extra_orgs.append(r["org_id"])
        # Explicit membership of org X with the requested role.
        await pg_pool.execute(
            "INSERT INTO public.org_members (org_id, user_id, role) VALUES ($1, $2, $3) "
            "ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role",
            org_id, uid, role,
        )
        return uid

    user_admin = await _new_user("org-admin", org_x)
    user_member = await _new_user("member", org_x)

    ctx = {
        "org_x": str(org_x),
        "org_y": str(org_y),
        "admin": {"id": str(user_admin), "email": "admin@corp.example"},
        "member": {"id": str(user_member), "email": "member@corp.example"},
    }
    try:
        yield ctx
    finally:
        for oid in (org_x, org_y):
            await pg_pool.execute("DELETE FROM public.sso_configs WHERE org_id = $1", oid)
        for uid in (user_admin, user_member):
            await pg_pool.execute("DELETE FROM public.org_members WHERE user_id = $1", uid)
        for oid in [org_x, org_y, *extra_orgs]:
            try:
                await pg_pool.execute("DELETE FROM public.organizations WHERE id = $1", oid)
            except Exception:
                pass
        for uid in (user_admin, user_member):
            try:
                await pg_pool.execute("DELETE FROM public.profiles WHERE id = $1", uid)
            except Exception:
                pass
            await pg_pool.execute("DELETE FROM auth.users WHERE id = $1", uid)


def _org_app(current_user: dict | None):
    """A minimal app mounting ONLY the org router, with get_current_user pinned to ``current_user``
    and the audit user-JWT client stubbed (audit writes are best-effort no-ops in the suite)."""
    from fastapi import FastAPI

    app = FastAPI()
    app.include_router(org_api.router)
    if current_user is not None:
        app.dependency_overrides[get_current_user] = lambda: current_user
    app.dependency_overrides[get_user_supabase_client] = lambda: MagicMock()
    return app


@asynccontextmanager
async def _client(app):
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


# ── the mig-113 grant: org-admin through, member 403 (`-k sso_permission`) ─────────

async def test_sso_permission_grant_admin_through_member_403(sso_authz_env, pg_pool, monkeypatch):
    """The mig-113 ('org-admin','sso:manage') grant lets an org-admin create a connection; a
    plain member is 403 (require_sso_manage + mig-104 RLS). One test, both arms."""
    create = AsyncMock(return_value="prov-" + uuid.uuid4().hex[:8])
    monkeypatch.setattr(sso_svc, "create_provider", create)

    body = {"metadata_url": "https://idp.example/metadata", "email_domain": "acme.com"}

    # Org-admin → 200, a row lands.
    app = _org_app(sso_authz_env["admin"])
    async with _client(app) as c:
        res = await c.post(
            "/org/sso/providers", json=body,
            headers={"X-Org-Id": sso_authz_env["org_x"], "Authorization": "Bearer t"},
        )
    assert res.status_code == 200, f"org-admin must be allowed (mig-113 grant); got {res.status_code}: {res.text}"

    # Plain member → 403, NO extra provider call, NO row for the member's attempt.
    create.reset_mock()
    app = _org_app(sso_authz_env["member"])
    async with _client(app) as c:
        res = await c.post(
            "/org/sso/providers", json=body,
            headers={"X-Org-Id": sso_authz_env["org_x"], "Authorization": "Bearer t"},
        )
    assert res.status_code == 403, f"a plain member must be 403; got {res.status_code}: {res.text}"
    assert create.await_count == 0, "no provider call may fire for a forbidden member"


async def test_create_lands_pending_and_lowercases_domain(sso_authz_env, pg_pool, monkeypatch):
    """A successful create lands a row: provider_id set, status='pending_approval', domain lowercased."""
    provider_id = "prov-" + uuid.uuid4().hex[:8]
    monkeypatch.setattr(sso_svc, "create_provider", AsyncMock(return_value=provider_id))

    app = _org_app(sso_authz_env["admin"])
    async with _client(app) as c:
        res = await c.post(
            "/org/sso/providers",
            json={"metadata_url": "https://idp.example/metadata", "email_domain": "AcMe.COM"},
            headers={"X-Org-Id": sso_authz_env["org_x"], "Authorization": "Bearer t"},
        )
    assert res.status_code == 200, res.text
    payload = res.json()
    assert payload["status"] == "pending_approval"
    assert payload["provider_id"] == provider_id
    assert payload["email_domain"] == "acme.com"

    row = await pg_pool.fetchrow(
        "SELECT email_domain, provider_id, status FROM public.sso_configs "
        "WHERE org_id = $1 AND provider_id = $2",
        uuid.UUID(sso_authz_env["org_x"]), provider_id,
    )
    assert row is not None, "the sso_configs row must exist"
    assert row["email_domain"] == "acme.com"
    assert row["status"] == "pending_approval"


async def test_cross_org_forbidden(sso_authz_env, monkeypatch):
    """An org-admin of org X cannot create a connection for org Y (a non-member org) — 403."""
    monkeypatch.setattr(sso_svc, "create_provider", AsyncMock(return_value="prov-x"))
    app = _org_app(sso_authz_env["admin"])
    async with _client(app) as c:
        res = await c.post(
            "/org/sso/providers",
            json={"metadata_url": "https://idp.example/metadata", "email_domain": "acme.com"},
            headers={"X-Org-Id": sso_authz_env["org_y"], "Authorization": "Bearer t"},
        )
    assert res.status_code == 403, f"a cross-org (non-member) X-Org-Id must be 403; got {res.status_code}"


async def test_public_domain_rejected_no_provider_call_no_row(sso_authz_env, pg_pool, monkeypatch):
    """A public/free email domain (gmail.com) is 422 BEFORE any provider call — NO row written."""
    create = AsyncMock(return_value="prov-should-not-happen")
    monkeypatch.setattr(sso_svc, "create_provider", create)

    app = _org_app(sso_authz_env["admin"])
    async with _client(app) as c:
        res = await c.post(
            "/org/sso/providers",
            json={"metadata_url": "https://idp.example/metadata", "email_domain": "Gmail.com"},
            headers={"X-Org-Id": sso_authz_env["org_x"], "Authorization": "Bearer t"},
        )
    assert res.status_code == 422, f"a public domain must be 422; got {res.status_code}: {res.text}"
    assert create.await_count == 0, "the public-domain check must run BEFORE create_provider"

    cnt = await pg_pool.fetchval(
        "SELECT count(*) FROM public.sso_configs WHERE org_id = $1 AND lower(email_domain) = 'gmail.com'",
        uuid.UUID(sso_authz_env["org_x"]),
    )
    assert cnt == 0, "no sso_configs row may be written for a rejected public domain"


async def test_service_error_maps_to_422_no_row(sso_authz_env, pg_pool, monkeypatch):
    """A provider-CRUD failure → 422 and NO sso_configs row (fail-closed, T-168-05a)."""
    monkeypatch.setattr(
        sso_svc, "create_provider",
        AsyncMock(side_effect=sso_svc.SsoProviderError("metadata unreachable", status_code=400)),
    )
    app = _org_app(sso_authz_env["admin"])
    async with _client(app) as c:
        res = await c.post(
            "/org/sso/providers",
            json={"metadata_url": "https://idp.example/bad", "email_domain": "widget.example"},
            headers={"X-Org-Id": sso_authz_env["org_x"], "Authorization": "Bearer t"},
        )
    assert res.status_code == 422, f"a provider error must map to 422; got {res.status_code}"
    cnt = await pg_pool.fetchval(
        "SELECT count(*) FROM public.sso_configs WHERE org_id = $1 AND lower(email_domain) = 'widget.example'",
        uuid.UUID(sso_authz_env["org_x"]),
    )
    assert cnt == 0, "no row may be written when the provider call fails"


async def test_list_scoped_and_delete_calls_provider_first(sso_authz_env, pg_pool, monkeypatch):
    """GET lists the active org's configs; DELETE calls delete_provider BEFORE the row delete."""
    provider_id = "prov-" + uuid.uuid4().hex[:8]
    monkeypatch.setattr(sso_svc, "create_provider", AsyncMock(return_value=provider_id))

    app = _org_app(sso_authz_env["admin"])
    async with _client(app) as c:
        created = await c.post(
            "/org/sso/providers",
            json={"metadata_url": "https://idp.example/metadata", "email_domain": "widget.example"},
            headers={"X-Org-Id": sso_authz_env["org_x"], "Authorization": "Bearer t"},
        )
        assert created.status_code == 200, created.text
        config_id = created.json()["id"]

        listed = await c.get(
            "/org/sso/providers",
            headers={"X-Org-Id": sso_authz_env["org_x"], "Authorization": "Bearer t"},
        )
        assert listed.status_code == 200, listed.text
        provider_ids = [p["provider_id"] for p in listed.json()["providers"]]
        assert provider_id in provider_ids, "GET must list the created config"

        # DELETE — delete_provider MUST fire while the row is still present (before-order proof).
        async def _delete_side_effect(pid):
            cnt = await pg_pool.fetchval(
                "SELECT count(*) FROM public.sso_configs WHERE id = $1", uuid.UUID(config_id)
            )
            assert cnt == 1, "the sso_configs row must still exist WHEN delete_provider is called"
            return None

        delete = AsyncMock(side_effect=_delete_side_effect)
        monkeypatch.setattr(sso_svc, "delete_provider", delete)

        deleted = await c.request(
            "DELETE", f"/org/sso/providers/{config_id}",
            headers={"X-Org-Id": sso_authz_env["org_x"], "Authorization": "Bearer t"},
        )
    assert deleted.status_code == 204, f"DELETE must return 204; got {deleted.status_code}: {deleted.text}"
    delete.assert_awaited_once_with(provider_id)
    gone = await pg_pool.fetchval(
        "SELECT count(*) FROM public.sso_configs WHERE id = $1", uuid.UUID(config_id)
    )
    assert gone == 0, "the sso_configs row must be deleted after the provider delete"


async def test_org_me_exposes_can_manage_sso(sso_authz_env):
    """GET /org/me includes can_manage_sso: true for an org-admin, false for a member."""
    app = _org_app(sso_authz_env["admin"])
    async with _client(app) as c:
        res = await c.get(
            "/org/me", headers={"X-Org-Id": sso_authz_env["org_x"], "Authorization": "Bearer t"}
        )
    assert res.status_code == 200, res.text
    assert res.json()["can_manage_sso"] is True

    app = _org_app(sso_authz_env["member"])
    async with _client(app) as c:
        res = await c.get(
            "/org/me", headers={"X-Org-Id": sso_authz_env["org_x"], "Authorization": "Bearer t"}
        )
    assert res.status_code == 200, res.text
    assert res.json()["can_manage_sso"] is False
