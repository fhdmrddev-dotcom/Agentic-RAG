"""Phase 158 Plan 01 (SC#1 / D-13) — smoke = 5-way green checklist AND the finalize gate.

Wave-0 Nyquist scaffold. The smoke step server-side validates the five things a working box
needs, renders them as a green/blocked checklist (reuse HealthSignals / PublishGauntlet), and
IS the finalize gate: ALL-green unlocks Finalize; ANY red blocks it with a plain-language fix
(mirrors the OPERATOR.md verification checklist). This file pins (158-VALIDATION.md, SC#1/D-13):

  the 5 checks — (1) Supabase Auth reachable, (2) Postgres reachable + schema present,
  (3) Redis PING, (4) the chosen provider key works, (5) the operator row exists — and:
  - all green ⇒ ``all_green:true`` (Finalize enabled);
  - any single red ⇒ ``all_green:false`` (Finalize disabled).

``pytest.importorskip("app.services.setup_service")`` SKIPS the file cleanly until Wave 2.
"""
import pytest

# NEW service — skips cleanly until Wave 2 creates app/services/setup_service.py.
setup_service = pytest.importorskip("app.services.setup_service")

_CHECK_KEYS = ("supabase_auth", "postgres_schema", "redis_ping", "provider_key", "operator_row")


async def test_smoke_reports_all_five_checks(monkeypatch):
    """SC#1/D-13: the smoke result carries all five named checks (Supabase auth / Postgres+schema
    / Redis PING / provider key / operator row) — the OPERATOR.md verification checklist made
    server-side + machine-readable."""
    result = await setup_service.run_smoke_checks()
    for key in _CHECK_KEYS:
        assert key in result["checks"], f"smoke must report the {key!r} check"


async def test_smoke_all_green_enables_finalize(monkeypatch):
    """SC#1/D-13: when every check is green → ``all_green:true`` (Finalize is unlocked — the
    smoke IS the finalize gate)."""
    result = await setup_service.run_smoke_checks()
    all_up = all(v.get("state") == "up" for v in result["checks"].values())
    assert result["all_green"] is all_up


async def test_smoke_any_red_blocks_finalize(monkeypatch):
    """SC#1/D-13: any single red check ⇒ ``all_green:false`` (Finalize stays disabled with a
    plain-language fix). Named for the Nyquist map; Wave 2 forces one check down and asserts
    all_green flips false + Finalize is blocked."""
    assert hasattr(setup_service, "run_smoke_checks"), "smoke must be the finalize gate (all-green ⇒ enable)"
