"""Phase 158 Plan 01 (SC#1 / D-08) — env-detect is LIGHT (orient, don't auto-discover).

Wave-0 Nyquist scaffold. D-08: env-detect probes a few cheap facts to inform DEFAULTS + which
steps to pre-fill — it orients the operator, it does not try to be clever. This file pins
(158-VALIDATION.md, SC#1/D-08): the detect result carries ``in_docker`` / ``store_present`` /
``db_reachable`` / ``redis_reachable`` flags.

``pytest.importorskip("app.services.setup_service")`` SKIPS the file cleanly until Wave 2.
"""
import pytest

# NEW service — skips cleanly until Wave 2 creates app/services/setup_service.py.
setup_service = pytest.importorskip("app.services.setup_service")


async def _stub_probes(monkeypatch, *, db="down", redis="down"):
    """Hermetic env-detect: stub the throwaway reachability probes so detect never opens a real
    connection (the env mandate: tests MOCK the DB/redis; no live infra required)."""
    async def _pg(dsn, *a, **k):
        return {"state": "up", "schema_present": True} if db == "up" else {"state": "down", "reason": "OSError"}

    async def _redis(url, *a, **k):
        return {"state": "up"} if redis == "up" else {"state": "down", "reason": "OSError"}

    monkeypatch.setattr(setup_service, "probe_submitted_postgres", _pg)
    monkeypatch.setattr(setup_service, "probe_submitted_redis", _redis)


async def test_env_detect_returns_expected_flags(setup_store_path, monkeypatch):
    """SC#1/D-08: env-detect returns the four light orientation flags — store_present,
    in_docker, db_reachable, redis_reachable — used to pre-fill defaults, not to auto-discover
    the whole environment."""
    await _stub_probes(monkeypatch, db="up", redis="down")
    result = await setup_service.detect_environment()
    for flag in ("in_docker", "store_present", "db_reachable", "redis_reachable"):
        assert flag in result, f"env-detect must report the {flag!r} flag"
    # the reachability flags reflect the (stubbed) probe outcomes — booleans only (light)
    assert result["db_reachable"] is True
    assert result["redis_reachable"] is False


async def test_env_detect_reports_store_present(setup_store_path, monkeypatch):
    """SC#1/D-08: when a setup-store file already exists, detect reports ``store_present=True``
    (so re-entry pre-fills from the store instead of starting blank)."""
    await _stub_probes(monkeypatch)
    from app.services.setup_store import write_store
    write_store({"supabase_url": "https://real.supabase.co"})
    result = await setup_service.detect_environment()
    assert result["store_present"] is True
