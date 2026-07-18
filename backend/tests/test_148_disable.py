"""Phase 148 Wave 0 (ADMIN-03 / T-148-02, T-148-04) — RED scaffold: disable a user.

CONTROLLER-level (owner: 148-06, wave 4). Encodes ``POST /admin/users/{id}/disable``:
  - bans via GoTrue ``update_user_by_id(uid, {"ban_duration": "876600h"})`` (the ~100y indefinite
    literal — Go time.ParseDuration's largest unit is HOURS; day/year units are rejected, Pitfall 2);
  - cancels the victim's in-flight runs by delegating to the SHARED
    ``run_lifecycle._cancel_run_internals`` (reuse the 147 kill discipline, never re-implement);
  - records a ``user.disable`` operator-ledger row naming the victim;
  - REFUSES a self-target server-side with 409 BEFORE any mutation (Pitfall 7 self-lockout) —
    this self-guard assertion is OWNED here (moved from the grant test per the wave-ownership split;
    the guard lives in the admin.py endpoint, an 148-06 surface).

The operator gate + victim lookups are driven via the mock asyncpg pool; GoTrue + Redis + the
shared cancel helper are patched so no live services are touched.

RED-by-design: the endpoint does not exist yet (an operator hitting it 404s today). Turns GREEN
in wave 4. Owner: 148-06.
"""
from unittest.mock import AsyncMock, MagicMock

# The conftest operator identity (authenticate_operator_request override) — used for the
# self-target guard: disabling THIS id must be refused 409.
ACTING_OPERATOR_ID = "00000000-0000-0000-0000-000000000001"
VICTIM_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd"
RUN_ID = "11111111-1111-1111-1111-111111111111"
THREAD_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"


class _FakeRedis:
    """Async Redis stand-in — best-effort ops return empty/truthy so nothing raises."""

    async def set(self, *a, **k):
        return True

    async def exists(self, *a, **k):
        return 0

    async def expire(self, *a, **k):
        return True

    async def zrem(self, *a, **k):
        return 1

    async def zrange(self, *a, **k):
        return []

    async def zrangebyscore(self, *a, **k):
        return []

    async def smembers(self, *a, **k):
        return set()

    async def publish(self, *a, **k):
        return 1


def _audit_inserts(mock_builder):
    return [
        c for c in mock_builder.insert.call_args_list
        if c.args and isinstance(c.args[0], dict)
        and "action" in c.args[0] and "label" in c.args[0]
    ]


def test_self_disable_refused_409_before_mutation(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """An operator targeting their OWN id is refused 409 BEFORE any GoTrue mutation (Pitfall 7)."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result({"user_id": "op-1"})  # operator gate passes

    fake_supabase = MagicMock()
    monkeypatch.setattr("app.api.admin.get_supabase", lambda: fake_supabase)

    res = client.post(f"/admin/users/{ACTING_OPERATOR_ID}/disable", headers=auth_headers)
    assert res.status_code == 409, f"self-target disable must be refused 409; got {res.status_code}"
    fake_supabase.auth.admin.update_user_by_id.assert_not_called(), \
        "the self-guard must precede any ban write (no mutation on refusal)"


def test_disable_bans_cancels_and_records(client, auth_headers, mock_asyncpg_pool, mock_builder, monkeypatch):
    """Disable bans with 876600h, cancels the in-flight run via the shared helper, records user.disable."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    # One combo row satisfies BOTH the operator-gate fetchrow AND the victim email / active-run
    # lookups regardless of the exact query order the 148-06 controller chooses.
    combo = {
        "user_id": "op-1", "email": "victim@x.co",
        "run_id": RUN_ID, "status": "streaming", "thread_id": THREAD_ID,
        "model": "gpt-5", "provider": "openai",
    }
    mock_asyncpg_pool.set_fetchrow_result(combo)
    mock_asyncpg_pool.set_fetch_result([combo])

    fake_supabase = MagicMock()
    monkeypatch.setattr("app.api.admin.get_supabase", lambda: fake_supabase)
    monkeypatch.setattr("app.api.admin.get_redis", lambda: _FakeRedis())
    cancel_mock = AsyncMock(return_value="cancelled")
    # admin.py lazy-imports _cancel_run_internals from run_lifecycle at call time.
    monkeypatch.setattr("app.services.run_lifecycle._cancel_run_internals", cancel_mock)

    res = client.post(f"/admin/users/{VICTIM_ID}/disable", headers=auth_headers)
    assert res.status_code in (200, 204), f"a successful disable returns 200/204; got {res.status_code}"

    ban_call = fake_supabase.auth.admin.update_user_by_id.call_args
    assert ban_call is not None, "disable must call GoTrue update_user_by_id"
    assert "876600h" in str(ban_call), "the indefinite ban literal must be exactly '876600h' (Pitfall 2)"

    assert cancel_mock.await_count >= 1, "the victim's in-flight run must be cancelled via _cancel_run_internals"

    actions = [i.args[0]["action"] for i in _audit_inserts(mock_builder)]
    assert "user.disable" in actions, "disable records a user.disable operator-ledger row"
