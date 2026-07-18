"""Phase 148 Wave 0 (ADMIN-03 / T-148-02) — RED scaffold: enable (clear ban).

CONTROLLER-level (owner: 148-06, wave 4). Encodes ``POST /admin/users/{id}/enable``: it lifts the
ban via GoTrue ``update_user_by_id(uid, {"ban_duration": "none"})`` (GoTrue sets banned_until=NULL)
and records a ``user.enable`` operator-ledger row. Restorative + direct — no in-flight cancel.

GoTrue is patched; the operator gate is driven via the mock asyncpg pool. RED-by-design: the
endpoint does not exist yet (404 today). Turns GREEN in wave 4. Owner: 148-06.
"""
from unittest.mock import MagicMock

VICTIM_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd"


def _audit_inserts(mock_builder):
    return [
        c for c in mock_builder.insert.call_args_list
        if c.args and isinstance(c.args[0], dict)
        and "action" in c.args[0] and "label" in c.args[0]
    ]


def test_enable_clears_ban_and_records(client, auth_headers, mock_asyncpg_pool, mock_builder, monkeypatch):
    """Enable sets ban_duration='none' via GoTrue and records user.enable."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    combo = {"user_id": "op-1", "email": "victim@x.co"}
    mock_asyncpg_pool.set_fetchrow_result(combo)
    mock_asyncpg_pool.set_fetch_result([combo])

    fake_supabase = MagicMock()
    monkeypatch.setattr("app.api.admin.get_supabase", lambda: fake_supabase)

    res = client.post(f"/admin/users/{VICTIM_ID}/enable", headers=auth_headers)
    assert res.status_code in (200, 204), f"a successful enable returns 200/204; got {res.status_code}"

    call = fake_supabase.auth.admin.update_user_by_id.call_args
    assert call is not None, "enable must call GoTrue update_user_by_id"
    assert "none" in str(call), "enable lifts the ban with ban_duration='none'"

    actions = [i.args[0]["action"] for i in _audit_inserts(mock_builder)]
    assert "user.enable" in actions, "enable records a user.enable operator-ledger row"
