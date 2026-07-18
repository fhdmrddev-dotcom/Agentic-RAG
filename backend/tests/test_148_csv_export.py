"""Phase 148 Wave 0 (ADMIN-03 / T-148-01) — RED scaffold: CSV export, service-level ONLY.

SERVICE-level (owner: 148-04, wave 3). Encodes that ``governance_service.export_platform_audit_csv``:
  - streams EXACTLY the filtered set and returns the EXACT row count (as (StreamingResponse, count));
  - when the count exceeds the cap (``_CSV_MAX_ROWS`` = 50000) it REFUSES (raises the domain
    refuse-error with a "narrow the filter" message) instead of silently truncating.

DELIBERATELY holds NO ledger-receipt assertion: the controller-level export-recorded /
refused-writes-nothing behavior is 148-06's job and lives in the controller test file (wave 4).
This wave-ownership split lets 148-04's <verify> pass in wave 3 with no controller code.

The COUNT-first probe is fed via the mock pool's fetchval/fetchrow; the filtered rows via
set_fetch_result. RED-by-design: imported inside the body; turns GREEN in wave 3. Owner: 148-04.
"""
import pytest


async def test_over_cap_refuses_not_truncates(mock_asyncpg_pool, monkeypatch):
    """A filtered set over the 50000-row cap REFUSES ('narrow the filter'), never truncates."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    from app.services.governance_service import export_platform_audit_csv, _CSV_MAX_ROWS  # RED until 148-04

    assert _CSV_MAX_ROWS == 50000, "the documented cap is 50000 rows"
    over = _CSV_MAX_ROWS + 1
    # COUNT-first probe returns over-cap regardless of whether the impl uses fetchval or fetchrow.
    mock_asyncpg_pool.set_fetchval_result(over)
    mock_asyncpg_pool.set_fetchrow_result({"count": over, "n": over})

    with pytest.raises(Exception) as ei:
        await export_platform_audit_csv(
            user_id=None, action_types=None, since=None, until=None
        )
    assert "narrow" in str(ei.value).lower(), \
        "an over-cap export must refuse with a 'narrow the filter' message, not truncate"


async def test_returns_exact_filtered_row_count(mock_asyncpg_pool, monkeypatch):
    """An under-cap export returns (StreamingResponse, count) with the EXACT filtered count."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    from app.services.governance_service import export_platform_audit_csv  # RED until 148-04

    rows = [
        {"id": "1", "user_id": "u", "action_type": "chat.send", "metadata": {}, "created_at": "2026-01-01T00:00:00Z"},
        {"id": "2", "user_id": "u", "action_type": "chat.send", "metadata": {}, "created_at": "2026-01-02T00:00:00Z"},
        {"id": "3", "user_id": "u", "action_type": "chat.send", "metadata": {}, "created_at": "2026-01-03T00:00:00Z"},
    ]
    mock_asyncpg_pool.set_fetchval_result(len(rows))          # COUNT under cap
    mock_asyncpg_pool.set_fetchrow_result({"count": len(rows), "n": len(rows)})
    mock_asyncpg_pool.set_fetch_result(rows)                  # the filtered rows

    result = await export_platform_audit_csv(
        user_id=None, action_types=["chat.send"], since=None, until=None
    )
    assert isinstance(result, tuple) and len(result) == 2, "returns (StreamingResponse, count)"
    _stream, count = result
    assert count == len(rows), "export reports the EXACT filtered row count"
