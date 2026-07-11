"""Phase 148 Wave 0 (ADMIN-03 / T-148-01, T-148-audit) — RED scaffold: recorded cross-user reads.

CONTROLLER-level (owner: 148-06, wave 4). Encodes the admin.py receipt contract:
  (i)   hitting the platform-source browse records an ``audit.view_platform`` operator-ledger
        row (floor-attached, audit_is_write=False — a read receipt, never a write);
  (ii)  a SUCCESSFUL CSV export via the export endpoint records ``audit.export`` naming the
        EXACT row count in its label;
  (iii) a REFUSED (over-cap) export records NO ``audit.export`` row (the floor teardown is
        skipped when the handler raises).

The service (query_platform_audit / export_platform_audit_csv) is mocked so no live DB is
touched — this file asserts ONLY the controller's recording behavior (the service-level
cap/exact-count lives in test_148_csv_export.py, owner 148-04). The operator gate is driven
via the asyncpg pool mock; audit rows are written through the shared supabase mock (mock_builder).

RED-by-design: ``GET /admin/platform-audit`` + ``/export`` do not exist yet (an operator hitting
them 404s today). Turns GREEN in wave 4. Owner: 148-06.
"""
from unittest.mock import AsyncMock


def _audit_inserts(mock_builder):
    """Every operator_audit_log insert (a dict carrying both 'action' and 'label')."""
    return [
        c for c in mock_builder.insert.call_args_list
        if c.args and isinstance(c.args[0], dict)
        and "action" in c.args[0] and "label" in c.args[0]
    ]


def _op(mock_asyncpg_pool, monkeypatch):
    """Force the operator-present branch of the /admin gate (asyncpg fetchrow)."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result({"user_id": "op-1"})


def test_platform_browse_records_view_platform(client, auth_headers, mock_asyncpg_pool, mock_builder, monkeypatch):
    """Switching to the platform source records audit.view_platform (a read, is_write=False)."""
    _op(mock_asyncpg_pool, monkeypatch)
    monkeypatch.setattr(
        "app.services.governance_service.query_platform_audit", AsyncMock(return_value=[])
    )

    res = client.get("/admin/platform-audit", headers=auth_headers)
    assert res.status_code == 200, f"platform browse must be reachable for an operator; got {res.status_code}"

    rows = _audit_inserts(mock_builder)
    view_rows = [r.args[0] for r in rows if r.args[0]["action"] == "audit.view_platform"]
    assert len(view_rows) == 1, "a platform-source browse records exactly one audit.view_platform row"
    assert view_rows[0].get("is_write") is False, "a cross-user read is recorded as is_write=False"


def test_successful_export_records_audit_export_with_count(client, auth_headers, mock_asyncpg_pool, mock_builder, monkeypatch):
    """A successful CSV export records audit.export naming the EXACT row count."""
    _op(mock_asyncpg_pool, monkeypatch)
    from starlette.responses import StreamingResponse

    def _gen():
        yield "id,action_type,created_at\n"

    fake = StreamingResponse(_gen(), media_type="text/csv")
    monkeypatch.setattr(
        "app.services.governance_service.export_platform_audit_csv",
        AsyncMock(return_value=(fake, 42)),
    )

    res = client.get("/admin/platform-audit/export", headers=auth_headers)
    assert res.status_code == 200, f"a successful export must stream 200; got {res.status_code}"

    export_rows = [r.args[0] for r in _audit_inserts(mock_builder) if r.args[0]["action"] == "audit.export"]
    assert len(export_rows) == 1, "a successful export records exactly one audit.export row"
    assert "42" in export_rows[0]["label"], "the audit.export label must name the exact row count"


def test_refused_export_records_nothing(client, auth_headers, mock_asyncpg_pool, mock_builder, monkeypatch):
    """A refused (over-cap) export writes NO audit.export row (floor teardown skipped)."""
    _op(mock_asyncpg_pool, monkeypatch)
    from fastapi import HTTPException

    async def _refuse(*args, **kwargs):
        # The domain refuse-error the service raises maps to 413/422; a raised HTTPException
        # surfaces as its own status regardless of how the controller wraps it.
        raise HTTPException(status_code=413, detail="Too many rows (50001) — narrow the filter")

    monkeypatch.setattr("app.services.governance_service.export_platform_audit_csv", _refuse)

    res = client.get("/admin/platform-audit/export", headers=auth_headers)
    assert res.status_code in (413, 422), f"an over-cap export must refuse 413/422; got {res.status_code}"

    actions = {r.args[0]["action"] for r in _audit_inserts(mock_builder)}
    assert "audit.export" not in actions, "a REFUSED export must record NO audit.export receipt"
