"""Unit tests for Folder Watches & Source Sync API endpoints (Phase 234 / LIB-08 / SURF-01 / VIS-05)."""
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID, uuid4
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import dependencies as deps
from app.api import sources
from app.main import app as real_app

USER_ID = "00000000-0000-0000-0000-000000000001"
OTHER_USER_ID = "00000000-0000-0000-0000-000000000099"
ORG_ID = "11111111-1111-1111-1111-111111111111"
CONN_ID = "22222222-2222-2222-2222-222222222222"
WATCH_ID = "33333333-3333-3333-3333-333333333333"


@pytest.fixture
def client():
    probe = FastAPI()
    probe.include_router(sources.router)
    probe.include_router(sources.router, prefix="/api")
    probe.dependency_overrides = real_app.dependency_overrides
    return TestClient(probe)


def _auth_headers():
    return {"Authorization": "Bearer test-token", "X-Org-Id": ORG_ID}


def _mock_watch_row(
    watch_id: str = WATCH_ID,
    user_id: str = USER_ID,
    conn_id: str = CONN_ID,
    is_active: bool = True,
    interval_minutes: int = 30,
):
    return {
        "id": UUID(watch_id),
        "org_id": UUID(ORG_ID),
        "user_id": UUID(user_id),
        "connection_id": UUID(conn_id),
        "source_folder_id": "folder-123",
        "source_folder_name": "Finance Reports",
        "source_drive_id": None,
        "library_folder_id": None,
        "interval_minutes": interval_minutes,
        "next_run_at": None,
        "leased_until": None,
        "is_active": is_active,
        "last_run_at": None,
        "last_status": "pending",
        "last_error": None,
        "created_at": None,
        "updated_at": None,
    }


def test_create_folder_watch_success(monkeypatch, client):
    """POST /sources/watches creates a new folder watch when connection exists."""
    conn_builder = MagicMock()
    conn_builder.select.return_value = conn_builder
    conn_builder.eq.return_value = conn_builder
    conn_builder.maybe_single.return_value = conn_builder
    conn_builder.execute.return_value = MagicMock(
        data={"id": CONN_ID, "name": "Team Drive", "service_id": "google", "org_id": ORG_ID}
    )

    sb_mock = MagicMock()
    sb_mock.table.return_value = conn_builder
    real_app.dependency_overrides[deps.get_user_supabase_client] = lambda: sb_mock

    watch_row = _mock_watch_row()
    create_mock = AsyncMock(return_value=watch_row)
    monkeypatch.setattr("app.api.sources.create_watch", create_mock)

    payload = {
        "connection_id": CONN_ID,
        "source_folder_id": "folder-123",
        "source_folder_name": "Finance Reports",
        "interval_minutes": 30,
    }

    res = client.post("/sources/watches", json=payload, headers=_auth_headers())
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["id"] == WATCH_ID
    assert data["source_folder_name"] == "Finance Reports"
    assert data["connection_name"] == "Team Drive"
    assert data["service_id"] == "google"
    assert data["item_count"] == 0

    create_mock.assert_awaited_once()


def test_create_folder_watch_connection_not_found(client):
    """POST /sources/watches fails with 404 when connection does not exist."""
    conn_builder = MagicMock()
    conn_builder.select.return_value = conn_builder
    conn_builder.eq.return_value = conn_builder
    conn_builder.maybe_single.return_value = conn_builder
    conn_builder.execute.return_value = MagicMock(data=None)

    sb_mock = MagicMock()
    sb_mock.table.return_value = conn_builder
    real_app.dependency_overrides[deps.get_user_supabase_client] = lambda: sb_mock

    payload = {
        "connection_id": CONN_ID,
        "source_folder_id": "folder-123",
        "source_folder_name": "Finance Reports",
    }

    res = client.post("/sources/watches", json=payload, headers=_auth_headers())
    assert res.status_code == 404


def test_list_folder_watches(monkeypatch, client):
    """GET /sources/watches returns enriched watch list."""
    watch_row = _mock_watch_row()
    monkeypatch.setattr("app.api.sources.list_watches", AsyncMock(return_value=[watch_row]))

    # Mock enrichment helper
    async def _fake_enrich(pool, rows):
        out = []
        for r in rows:
            rec = dict(r)
            rec["item_count"] = 5
            rec["connection_name"] = "Team Drive"
            rec["service_id"] = "google"
            out.append(rec)
        return out

    monkeypatch.setattr("app.api.sources._enrich_watch_rows", _fake_enrich)

    res = client.get("/sources/watches", headers=_auth_headers())
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["id"] == WATCH_ID
    assert data[0]["item_count"] == 5
    assert data[0]["connection_name"] == "Team Drive"


def test_get_folder_watch_detail_with_items(monkeypatch, client):
    """GET /sources/watches/{id} returns watch details with tracked mirror items."""
    watch_row = _mock_watch_row()
    monkeypatch.setattr("app.api.sources.get_watch", AsyncMock(return_value=watch_row))

    items = [
        {
            "id": uuid4(),
            "watch_id": UUID(WATCH_ID),
            "external_id": "file-1",
            "name": "Q3_Report.pdf",
            "path_hint": "Reports/Q3_Report.pdf",
            "source_version": "v1",
            "source_modified_at": None,
            "content_hash": "hash1",
            "document_id": uuid4(),
            "state": "present",
            "first_seen_at": None,
            "last_seen_at": None,
            "missing_since": None,
            "last_error": None,
            "created_at": None,
            "updated_at": None,
        }
    ]
    monkeypatch.setattr("app.api.sources.get_watch_items", AsyncMock(return_value=items))

    async def _fake_enrich(pool, rows):
        return [dict(r, item_count=1, connection_name="Team Drive", service_id="google") for r in rows]

    monkeypatch.setattr("app.api.sources._enrich_watch_rows", _fake_enrich)

    res = client.get(f"/sources/watches/{WATCH_ID}", headers=_auth_headers())
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == WATCH_ID
    assert len(data["items"]) == 1
    assert data["items"][0]["name"] == "Q3_Report.pdf"


def test_update_folder_watch(monkeypatch, client):
    """PATCH /sources/watches/{id} updates cadence or active state."""
    updated_row = _mock_watch_row(interval_minutes=60, is_active=False)
    monkeypatch.setattr("app.api.sources.update_watch", AsyncMock(return_value=updated_row))

    async def _fake_enrich(pool, rows):
        return [dict(r, item_count=0, connection_name="Team Drive") for r in rows]

    monkeypatch.setattr("app.api.sources._enrich_watch_rows", _fake_enrich)

    res = client.patch(
        f"/sources/watches/{WATCH_ID}",
        json={"interval_minutes": 60, "is_active": False},
        headers=_auth_headers(),
    )
    assert res.status_code == 200
    data = res.json()
    assert data["interval_minutes"] == 60
    assert data["is_active"] is False


def test_delete_folder_watch_and_purge(monkeypatch, client):
    """DELETE /sources/watches/{id} deletes watch and purges documents when requested."""
    watch_row = _mock_watch_row()
    monkeypatch.setattr("app.api.sources.get_watch", AsyncMock(return_value=watch_row))
    monkeypatch.setattr("app.api.sources.delete_watch", AsyncMock(return_value=True))

    doc_id = str(uuid4())
    items = [{"document_id": doc_id}]
    monkeypatch.setattr("app.api.sources.get_watch_items", AsyncMock(return_value=items))

    doc_deleted = []
    doc_builder = MagicMock()
    doc_builder.delete.return_value = doc_builder
    def _in(col, vals):
        doc_deleted.extend(vals)
        return doc_builder
    doc_builder.in_.side_effect = _in
    doc_builder.execute.return_value = MagicMock(data=[])

    sb_mock = MagicMock()
    sb_mock.table.return_value = doc_builder
    real_app.dependency_overrides[deps.get_user_supabase_client] = lambda: sb_mock

    res = client.delete(
        f"/sources/watches/{WATCH_ID}?purge_documents=true",
        headers=_auth_headers(),
    )
    assert res.status_code == 204
    assert doc_id in doc_deleted


def test_trigger_watch_sync(mock_asyncpg_pool, monkeypatch, client):
    """POST /sources/watches/{id}/sync resets next_run_at to now() for immediate check."""
    watch_row = _mock_watch_row()
    monkeypatch.setattr("app.api.sources.get_watch", AsyncMock(return_value=watch_row))
    real_app.dependency_overrides[deps.get_pg_pool] = lambda: mock_asyncpg_pool

    res = client.post(f"/sources/watches/{WATCH_ID}/sync", headers=_auth_headers())
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "scheduled"
    assert WATCH_ID in data["message"]

    sync_calls = [
        c for c in mock_asyncpg_pool.calls
        if "next_run_at = now()" in c[0]
    ]
    assert len(sync_calls) == 1


def test_purge_missing_watch_documents(monkeypatch, client):
    """POST /sources/watches/{id}/purge removes missing/disconnected documents and items."""
    watch_row = _mock_watch_row()
    monkeypatch.setattr("app.api.sources.get_watch", AsyncMock(return_value=watch_row))

    doc_id = str(uuid4())
    item_id = uuid4()

    mock_pool = MagicMock()
    mock_con = AsyncMock()
    mock_con.fetch.return_value = [{"id": item_id, "document_id": doc_id}]
    mock_con.execute.return_value = "DELETE 1"
    mock_pool.acquire.return_value.__aenter__.return_value = mock_con
    real_app.dependency_overrides[deps.get_pg_pool] = lambda: mock_pool

    doc_builder = MagicMock()
    doc_builder.delete.return_value = doc_builder
    doc_builder.in_.return_value = doc_builder
    doc_builder.execute.return_value = MagicMock(data=[])

    sb_mock = MagicMock()
    sb_mock.table.return_value = doc_builder
    real_app.dependency_overrides[deps.get_user_supabase_client] = lambda: sb_mock

    res = client.post(f"/sources/watches/{WATCH_ID}/purge", headers=_auth_headers())
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["purged_count"] == 1


def test_tenant_isolation_other_user_watch_returns_404(monkeypatch, client):
    """Accessing another user's watch returns 404 on all endpoints (absence over refusal)."""
    # get_watch returns None when caller's user_id does not own the watch
    monkeypatch.setattr("app.api.sources.get_watch", AsyncMock(return_value=None))
    monkeypatch.setattr("app.api.sources.update_watch", AsyncMock(return_value=None))
    monkeypatch.setattr("app.api.sources.delete_watch", AsyncMock(return_value=False))

    other_watch_id = str(uuid4())

    # GET details
    res_get = client.get(f"/sources/watches/{other_watch_id}", headers=_auth_headers())
    assert res_get.status_code == 404

    # PATCH
    res_patch = client.patch(
        f"/sources/watches/{other_watch_id}",
        json={"interval_minutes": 15},
        headers=_auth_headers(),
    )
    assert res_patch.status_code == 404

    # DELETE
    res_del = client.delete(f"/sources/watches/{other_watch_id}", headers=_auth_headers())
    assert res_del.status_code == 404

    # POST sync
    res_sync = client.post(f"/sources/watches/{other_watch_id}/sync", headers=_auth_headers())
    assert res_sync.status_code == 404

    # POST purge
    res_purge = client.post(f"/sources/watches/{other_watch_id}/purge", headers=_auth_headers())
    assert res_purge.status_code == 404


def test_api_sources_alias_path(monkeypatch, client):
    """Endpoints are accessible via /api/sources prefix as well."""
    watch_row = _mock_watch_row()
    monkeypatch.setattr("app.api.sources.list_watches", AsyncMock(return_value=[watch_row]))

    async def _fake_enrich(pool, rows):
        return [dict(r, item_count=0) for r in rows]

    monkeypatch.setattr("app.api.sources._enrich_watch_rows", _fake_enrich)

    res = client.get("/api/sources/watches", headers=_auth_headers())
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["id"] == WATCH_ID
