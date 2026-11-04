"""Phase 304-04 (KEY-06; D-03, D-35, D-36) — both MCP switches over HTTP.

  * The ORG switch: ``GET/PUT /org/api-keys/mcp-access``, behind ``require_org_manage`` for the
    ACTIVE org. Every flip writes ONE ``settings.update`` audit row with
    ``metadata.event = 'mcp_access'`` and an explicit ``org_id`` — no new audit literal (D-36).
    A failed write is an error status and no audit row, never a fake success.
  * The OPERATOR switch: ``mcp_enabled`` in ``_FLAG_HUMAN_NAMES`` (so ``PUT /admin/flags`` accepts
    it and the operator floor records it), read back on ``GET /settings``.

Fresh ``FastAPI()`` apps with dependency overrides — never ``app.main.app``'s lifespan (SEED-363).
"""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from app import dependencies as deps
from app.api import admin as admin_mod
from app.api import api_keys as route
from app.api import settings as settings_api
from app.models.user_settings import _build_settings_from_row

ORG = "44444444-4444-4444-8444-444444444444"
ADMIN = "66666666-6666-4666-8666-666666666666"
MEMBER = "33333333-3333-4333-8333-333333333333"

CONTRACT = json.loads(
    (Path(__file__).resolve().parents[1] / "fixtures" / "phase293" / "api_keys_contract.json")
    .read_text(encoding="utf-8")
)


class _State:
    def __init__(self):
        self.org_on = True
        self.is_admin = True
        self.caller = ADMIN
        self.writes: list[tuple[str, bool]] = []
        self.audits: list[dict] = []
        self.fail_write: Exception | None = None
        self.missing_org = False


@pytest.fixture
def st(monkeypatch):
    s = _State()
    db = route.api_keys_db

    async def mcp_switches(pool, org_id):
        if s.missing_org:
            return None
        return {"org_on": s.org_on, "deploy_on": True, "org_name": "Acme Legal"}

    async def set_org_mcp_enabled(pool, *, org_id, enabled):
        if s.fail_write is not None:
            raise s.fail_write
        if s.missing_org:
            return None
        s.writes.append((str(org_id), enabled))
        s.org_on = enabled
        return enabled

    monkeypatch.setattr(db, "mcp_switches", mcp_switches)
    monkeypatch.setattr(db, "set_org_mcp_enabled", set_org_mcp_enabled)

    async def _write(user_id, action_type, metadata, supabase, org_id=None):
        s.audits.append({"user_id": user_id, "action_type": action_type, "metadata": metadata,
                         "org_id": org_id})

    monkeypatch.setattr(route, "write_audit_entry", _write)
    monkeypatch.setattr(route, "get_service_role_supabase", lambda org_id: object())

    async def _perm(request, current_user, active_org, perm):
        return s.is_admin

    monkeypatch.setattr(deps, "_has_org_permission", _perm)
    return s


@pytest.fixture
def client(st):
    app = FastAPI()
    app.include_router(route.router)
    app.include_router(route.org_router)

    async def _user():
        return {"id": st.caller, "email": "t@example.com"}

    async def _org():
        return ORG

    async def _pool():
        return object()

    app.dependency_overrides[deps.get_current_user] = _user
    app.dependency_overrides[deps.get_active_org_id] = _org
    app.dependency_overrides[deps.get_pg_pool] = _pool
    return TestClient(app, raise_server_exceptions=False)


# ── the org switch ─────────────────────────────────────────────────────────────────────────────


def test_an_org_admin_reads_the_switch_for_the_active_org(client, st):
    r = client.get("/org/api-keys/mcp-access")
    assert r.status_code == 200, r.text
    assert r.json() == {"enabled": True}
    st.org_on = False
    assert client.get("/org/api-keys/mcp-access").json() == {"enabled": False}


def test_the_switch_payload_matches_the_contract_fixture(client, st):
    assert set(client.get("/org/api-keys/mcp-access").json()) == set(CONTRACT["OrgMcpAccess"])


def test_a_plain_member_gets_the_same_403_as_every_org_admin_route(client, st):
    st.is_admin = False
    st.caller = MEMBER
    r = client.get("/org/api-keys/mcp-access")
    assert r.status_code == 403
    assert r.json() == {"detail": "You do not have permission to manage this organization."}
    w = client.put("/org/api-keys/mcp-access", json={"enabled": False})
    assert w.status_code == 403
    assert st.writes == [] and st.audits == []


def test_a_flip_writes_the_active_org_and_one_settings_update_audit_row(client, st):
    r = client.put("/org/api-keys/mcp-access", json={"enabled": False})
    assert r.status_code == 200, r.text
    assert r.json() == {"enabled": False}
    assert st.writes == [(ORG, False)]
    (entry,) = st.audits
    assert entry == {
        "user_id": ADMIN,
        "action_type": "settings.update",
        "metadata": {"event": "mcp_access", "enabled": False},
        "org_id": ORG,
    }


def test_switching_back_on_is_audited_too(client, st):
    st.org_on = False
    r = client.put("/org/api-keys/mcp-access", json={"enabled": True})
    assert r.status_code == 200 and r.json() == {"enabled": True}
    (entry,) = st.audits
    assert entry["metadata"] == {"event": "mcp_access", "enabled": True}


def test_an_extra_body_field_is_refused_and_nothing_is_written(client, st):
    r = client.put("/org/api-keys/mcp-access", json={"enabled": False, "org_id": "x"})
    assert r.status_code == 422
    assert st.writes == [] and st.audits == []


def test_a_non_boolean_is_refused(client, st):
    assert client.put("/org/api-keys/mcp-access", json={}).status_code == 422
    assert st.writes == [] and st.audits == []


def test_a_failed_write_is_an_error_and_writes_no_audit_row(client, st):
    st.fail_write = RuntimeError("connection reset")
    r = client.put("/org/api-keys/mcp-access", json={"enabled": False})
    assert r.status_code >= 500
    assert st.audits == []


def test_a_missing_org_is_404_and_writes_no_audit_row(client, st):
    st.missing_org = True
    assert client.put("/org/api-keys/mcp-access", json={"enabled": False}).status_code == 404
    assert client.get("/org/api-keys/mcp-access").status_code == 404
    assert st.audits == []


def test_no_new_audit_literal_is_named():
    import inspect

    src = inspect.getsource(route)
    assert '"mcp_access"' in src
    assert "org.mcp" not in src            # D-36 superseded D-25's new-literal clause


# ── the operator switch ────────────────────────────────────────────────────────────────────────


def test_mcp_enabled_is_an_operator_flag_with_a_plain_name():
    assert admin_mod._FLAG_HUMAN_NAMES["mcp_enabled"] == "MCP access"
    assert "mcp_enabled" in admin_mod._FLAG_KEYS


@pytest.fixture
def admin_client(monkeypatch):
    app = FastAPI()
    app.include_router(admin_mod.router)
    recorded: list[dict] = []

    async def _operator(request: Request):
        op = {"id": "op-1", "email": "op@x.co"}
        request.state.operator = op
        return op

    async def _write_operator_audit(**kw):
        recorded.append(kw)

    app.dependency_overrides[deps.require_operator] = _operator
    app.dependency_overrides[deps.get_supabase] = lambda: object()
    monkeypatch.setattr(deps, "write_operator_audit", _write_operator_audit)
    save = AsyncMock(return_value=True)
    monkeypatch.setattr(admin_mod, "save_app_settings", save)
    return TestClient(app), save, recorded


def test_put_admin_flags_routes_mcp_enabled_and_records_the_operator_row(admin_client):
    client, save, recorded = admin_client
    r = client.put("/admin/flags", json={"key": "mcp_enabled", "value": False})
    assert r.status_code == 204, r.text
    save.assert_awaited_once_with({"mcp_enabled": False})
    (row,) = recorded
    assert row["is_write"] is True
    assert "MCP access" in row["label"]


def test_get_settings_reads_mcp_enabled_back_with_the_capability_default():
    assert _build_settings_from_row({}).mcp_enabled is True          # a stale row reads ON
    assert _build_settings_from_row({"mcp_enabled": False}).mcp_enabled is False
    assert "mcp_enabled" in settings_api.FullSettingsResponse.model_fields


async def test_the_settings_response_carries_mcp_enabled():
    resp = await settings_api._build_response(_build_settings_from_row({"mcp_enabled": False}))
    assert resp.mcp_enabled is False
    resp = await settings_api._build_response(_build_settings_from_row({}))
    assert resp.mcp_enabled is True
