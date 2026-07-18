"""Phase 147 Plan 02 Task 1 (ADMIN-02) — dependency-health probe suite.

Proves:
  - probe_redis / probe_supabase / probe_sandbox return the ``{state, latency_ms}``
    contract, degrading to ``down`` (never raising) on a boundary failure;
  - probe_sandbox reports the THREE honest states — ``off`` when
    ``settings.sandbox_enabled`` is false (NEVER ``down`` for a deliberate config),
    ``up`` on a Docker ping, ``down`` when an ENABLED sandbox's daemon is unreachable
    (Pitfall 6);
  - ``GET /admin/backpressure`` returns a SUPERSET of the four original signals plus
    the additive ``dependencies`` block (D-078-08 additive-only);
  - ``GET /admin/backpressure`` is now floor-EXEMPT (D-07): it writes ZERO
    ``operator_audit_log`` rows on a poll (the ``/admin/me`` no-floor precedent).

Boundary mocking discipline (Pitfall 6, mirrors test_146): the operator branch of the
gate is driven via ``app.dependencies._pg_pool`` -> ``mock_asyncpg_pool``
(``set_fetchrow_result({...})``); the probes are stubbed at the exact boundary they
call (``app.dependencies.get_redis`` / ``get_supabase`` / ``docker.from_env``).
"""
from unittest.mock import MagicMock

from app.config import settings


# ── probe_redis ───────────────────────────────────────────────────────────────

async def test_probe_redis_up(monkeypatch):
    class _FakeRedis:
        async def ping(self):
            return True

    monkeypatch.setattr("app.dependencies.get_redis", lambda: _FakeRedis())
    from app.services.health_probe import probe_redis

    r = await probe_redis()
    assert r["state"] == "up"
    assert isinstance(r["latency_ms"], int)


async def test_probe_redis_down(monkeypatch):
    class _FakeRedis:
        async def ping(self):
            raise ConnectionError("redis unreachable")

    monkeypatch.setattr("app.dependencies.get_redis", lambda: _FakeRedis())
    from app.services.health_probe import probe_redis

    r = await probe_redis()
    assert r["state"] == "down"
    assert r["latency_ms"] is None


# ── probe_supabase ────────────────────────────────────────────────────────────

async def test_probe_supabase_up(monkeypatch):
    sb = MagicMock()
    # trivial SELECT chain resolves to a data result
    sb.table.return_value.select.return_value.limit.return_value.execute.return_value = (
        MagicMock(data=[{"id": 1}])
    )
    monkeypatch.setattr("app.dependencies.get_supabase", lambda: sb)
    from app.services.health_probe import probe_supabase

    r = await probe_supabase()
    assert r["state"] == "up"
    assert isinstance(r["latency_ms"], int)


async def test_probe_supabase_down(monkeypatch):
    sb = MagicMock()
    sb.table.side_effect = RuntimeError("postgres down")
    monkeypatch.setattr("app.dependencies.get_supabase", lambda: sb)
    from app.services.health_probe import probe_supabase

    r = await probe_supabase()
    assert r["state"] == "down"
    assert r["latency_ms"] is None


# ── probe_sandbox (THREE states — Pitfall 6) ──────────────────────────────────

async def test_probe_sandbox_off_by_config(monkeypatch):
    """A disabled sandbox is ``off`` (neutral) — NEVER ``down`` — and pings nothing."""
    monkeypatch.setattr(settings, "sandbox_enabled", False)
    import docker

    def _should_not_be_called():
        raise AssertionError("docker.from_env must NOT be called when sandbox is off")

    monkeypatch.setattr(docker, "from_env", _should_not_be_called)
    from app.services.health_probe import probe_sandbox

    r = await probe_sandbox()
    assert r["state"] == "off"
    assert r["latency_ms"] is None


async def test_probe_sandbox_up(monkeypatch):
    monkeypatch.setattr(settings, "sandbox_enabled", True)
    import docker

    fake_client = MagicMock()
    fake_client.ping.return_value = True
    monkeypatch.setattr(docker, "from_env", lambda: fake_client)
    from app.services.health_probe import probe_sandbox

    r = await probe_sandbox()
    assert r["state"] == "up"
    assert isinstance(r["latency_ms"], int)


async def test_probe_sandbox_down_when_enabled_but_unreachable(monkeypatch):
    monkeypatch.setattr(settings, "sandbox_enabled", True)
    import docker

    def _boom():
        raise RuntimeError("docker daemon unreachable")

    monkeypatch.setattr(docker, "from_env", _boom)
    from app.services.health_probe import probe_sandbox

    r = await probe_sandbox()
    assert r["state"] == "down"
    assert r["latency_ms"] is None


# ── /admin/backpressure — additive dependencies + floor-exempt ────────────────

def _fake_probe_dependencies_factory():
    async def _fake():
        return {
            "redis": {"state": "up", "latency_ms": 2},
            "supabase": {"state": "up", "latency_ms": 5},
            "sandbox": {"state": "off", "latency_ms": None},
        }

    return _fake


def test_backpressure_superset_with_dependencies(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """The four original keys stay present; ``dependencies.{redis,supabase,sandbox}`` are additive."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result({"user_id": "op-1"})  # operator present
    monkeypatch.setattr(
        "app.services.health_probe.probe_dependencies", _fake_probe_dependencies_factory()
    )

    res = client.get("/admin/backpressure", headers=auth_headers)
    assert res.status_code == 200
    body = res.json()

    # the four original signals are a SUBSET (byte-identical keys — D-078-08)
    for key in (
        "anyio_threadpool_depth",
        "redis_active_runs",
        "postgres_pool_in_use",
        "per_worker_run_count",
    ):
        assert key in body, f"original backpressure key {key!r} was dropped"

    # the additive dependency-health block
    assert body["dependencies"]["redis"]["state"] == "up"
    assert body["dependencies"]["supabase"]["state"] == "up"
    assert body["dependencies"]["sandbox"]["state"] == "off"
    assert "latency_ms" in body["dependencies"]["redis"]


def test_backpressure_is_floor_exempt(client, auth_headers, mock_asyncpg_pool, mock_builder, monkeypatch):
    """D-07: the poll GET writes ZERO operator_audit_log rows (floor removed)."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result({"user_id": "op-1"})  # operator present
    monkeypatch.setattr(
        "app.services.health_probe.probe_dependencies", _fake_probe_dependencies_factory()
    )

    res = client.get("/admin/backpressure", headers=auth_headers)
    assert res.status_code == 200

    op_inserts = [
        c
        for c in mock_builder.insert.call_args_list
        if c.args and isinstance(c.args[0], dict) and "action" in c.args[0] and "label" in c.args[0]
    ]
    assert len(op_inserts) == 0, (
        "floor-exempt: /admin/backpressure must not write an operator_audit_log row on a poll"
    )
