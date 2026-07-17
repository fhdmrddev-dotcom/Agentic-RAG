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


async def test_env_detect_returns_expected_flags(setup_store_path):
    """SC#1/D-08: env-detect returns the four light orientation flags — store_present,
    in_docker, db_reachable, redis_reachable — used to pre-fill defaults, not to auto-discover
    the whole environment."""
    result = await setup_service.detect_environment()
    for flag in ("in_docker", "store_present", "db_reachable", "redis_reachable"):
        assert flag in result, f"env-detect must report the {flag!r} flag"


async def test_env_detect_reports_store_present(setup_store_path):
    """SC#1/D-08: when a setup-store file already exists, detect reports ``store_present=True``
    (so re-entry pre-fills from the store instead of starting blank)."""
    from app.services.setup_store import write_store
    write_store({"supabase_url": "https://real.supabase.co"})
    result = await setup_service.detect_environment()
    assert result["store_present"] is True
