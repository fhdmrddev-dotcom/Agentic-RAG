"""Unit tests for VIS-05 / D-4 Disconnect Freeze Policy on DELETE /connectors/connections/{connection_id} (Phase 234)."""
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID, uuid4
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import dependencies as deps
from app.api import connectors
from app.main import app as real_app
from app.services import connector_service

ACTIVE_ORG = "11111111-1111-1111-1111-111111111111"
CONNECTION_ID = "33333333-3333-3333-3333-333333333333"


@pytest.fixture
def router_client():
    probe = FastAPI()
    probe.include_router(connectors.router)
    probe.dependency_overrides = real_app.dependency_overrides
    return TestClient(probe)


def _org_headers():
    return {"Authorization": "Bearer test-token", "X-Org-Id": ACTIVE_ORG}


def _install_perms(monkeypatch, perms: dict):
    async def _fake(request, current_user, org_id, permission_key):
        return perms.get(permission_key, False)
    monkeypatch.setattr("app.dependencies._has_org_permission", _fake)


def _install_feature(monkeypatch, audience: str = "everyone"):
    monkeypatch.setattr(deps, "is_operator", AsyncMock(return_value=False))
    monkeypatch.setattr("app.models.user_settings.feature_audience", lambda feature: audience)


def _as_org_member(monkeypatch, mock_asyncpg_pool, role: str = "admin"):
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result({"role": role})


def test_disconnect_freeze_deactivates_watches_and_freezes_documents(
    mock_asyncpg_pool, monkeypatch, router_client
):
    """VIS-05 / D-4: Disconnecting a connection deactivates its watches and marks documents source_disconnected."""
    _as_org_member(monkeypatch, mock_asyncpg_pool, role="admin")
    _install_feature(monkeypatch, "everyone")
    _install_perms(monkeypatch, {"org:manage": True})

    monkeypatch.setattr("app.dependencies.get_pg_pool", AsyncMock(return_value=mock_asyncpg_pool))

    # Track table updates via a bespoke Supabase mock
    doc_updates = []
    doc_builder = MagicMock()
    def _doc_update(payload):
        doc_updates.append(payload)
        return doc_builder
    doc_builder.update.side_effect = _doc_update
    doc_builder.eq.return_value = doc_builder
    doc_builder.execute.return_value = MagicMock(data=[])

    conn_builder = MagicMock()
    conn_builder.select.return_value = conn_builder
    conn_builder.eq.return_value = conn_builder
    conn_builder.maybe_single.return_value = conn_builder
    conn_builder.execute.return_value = MagicMock(data={"id": CONNECTION_ID, "org_id": ACTIVE_ORG})

    sb_mock = MagicMock()
    def _table_router(table_name):
        if table_name == "connector_connections":
            return conn_builder
        if table_name == "documents":
            return doc_builder
        return MagicMock()

    sb_mock.table.side_effect = _table_router

    real_app.dependency_overrides[deps.get_user_supabase_client] = lambda: sb_mock
    real_app.dependency_overrides[deps.get_supabase] = lambda: sb_mock

    delete_mock = AsyncMock(return_value=True)
    monkeypatch.setattr("app.services.connector_service.delete_connection", delete_mock)

    res = router_client.delete(
        f"/connectors/connections/{CONNECTION_ID}",
        headers=_org_headers(),
    )

    assert res.status_code == 204, f"Expected 204, got {res.status_code}: {res.text}"

    # 1. Verify connector_watches deactivated in pool
    watch_updates = [
        c for c in mock_asyncpg_pool.calls
        if "UPDATE connector_watches SET is_active = false" in c[0]
    ]
    assert len(watch_updates) == 1, f"Expected watch deactivation query, got: {mock_asyncpg_pool.calls}"
    assert watch_updates[0][1] == (UUID(CONNECTION_ID),)

    # 2. Verify documents marked source_disconnected
    assert len(doc_updates) == 1, f"Expected 1 document update, got {doc_updates}"
    assert doc_updates[0] == {"source_state": "source_disconnected"}

    # 3. Verify delete_connection invoked
    delete_mock.assert_awaited_once()
    assert delete_mock.call_args[0][0] == CONNECTION_ID
    assert delete_mock.call_args[1]["org_id"] == ACTIVE_ORG


def test_disconnect_freeze_404_when_connection_not_found(
    mock_asyncpg_pool, monkeypatch, router_client
):
    """VIS-05: Missing or cross-org connection 404s without attempting freeze or delete."""
    _as_org_member(monkeypatch, mock_asyncpg_pool, role="admin")
    _install_feature(monkeypatch, "everyone")
    _install_perms(monkeypatch, {"org:manage": True})

    conn_builder = MagicMock()
    conn_builder.select.return_value = conn_builder
    conn_builder.eq.return_value = conn_builder
    conn_builder.maybe_single.return_value = conn_builder
    conn_builder.execute.return_value = MagicMock(data=None)  # Connection absent from org

    sb_mock = MagicMock()
    sb_mock.table.return_value = conn_builder

    real_app.dependency_overrides[deps.get_user_supabase_client] = lambda: sb_mock
    real_app.dependency_overrides[deps.get_supabase] = lambda: sb_mock

    delete_mock = AsyncMock()
    monkeypatch.setattr("app.services.connector_service.delete_connection", delete_mock)

    res = router_client.delete(
        f"/connectors/connections/{CONNECTION_ID}",
        headers=_org_headers(),
    )

    assert res.status_code == 404
    delete_mock.assert_not_called()


def test_disconnect_freeze_forbidden_without_org_manage(
    mock_asyncpg_pool, monkeypatch, router_client
):
    """VIS-05: Caller without org:manage permission is 403 refused."""
    _as_org_member(monkeypatch, mock_asyncpg_pool, role="member")
    _install_feature(monkeypatch, "everyone")
    _install_perms(monkeypatch, {"org:manage": False})

    delete_mock = AsyncMock()
    monkeypatch.setattr("app.services.connector_service.delete_connection", delete_mock)

    res = router_client.delete(
        f"/connectors/connections/{CONNECTION_ID}",
        headers=_org_headers(),
    )

    assert res.status_code == 403
    delete_mock.assert_not_called()
