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
_ALL_UP = {k: "up" for k in _CHECK_KEYS}


def _stub_probes(monkeypatch, states):
    """Hermetically stub the five sub-probes ``run_smoke_checks`` fans out to, so the smoke
    checklist never opens a real connection (the env mandate: tests MOCK the DB/supabase/redis).
    ``states`` maps each check-id to ``'up'``/``'down'``; the checklist is server-truth-only, so
    a check is green ONLY when its stubbed sub-probe reports up."""
    async def _supabase(url, key):
        return {"state": states["supabase_auth"]}

    async def _postgres(dsn):
        # postgres_schema is green only when reachable AND the schema sentinel is present
        if states["postgres_schema"] == "up":
            return {"state": "up", "schema_present": True}
        return {"state": "down", "reason": "OSError"}

    async def _redis(url):
        return {"state": states["redis_ping"]}

    async def _provider(provider, key):
        return {"state": states["provider_key"]}

    async def _operator(dsn):
        return {"state": states["operator_row"]}

    monkeypatch.setattr(setup_service, "probe_submitted_supabase", _supabase)
    monkeypatch.setattr(setup_service, "probe_submitted_postgres", _postgres)
    monkeypatch.setattr(setup_service, "probe_submitted_redis", _redis)
    monkeypatch.setattr(setup_service, "_probe_provider_key", _provider)
    monkeypatch.setattr(setup_service, "_probe_operator_row", _operator)


async def test_smoke_reports_all_five_checks(monkeypatch):
    """SC#1/D-13: the smoke result carries all five named checks (Supabase auth / Postgres+schema
    / Redis PING / provider key / operator row) — the OPERATOR.md verification checklist made
    server-side + machine-readable."""
    _stub_probes(monkeypatch, _ALL_UP)
    result = await setup_service.run_smoke_checks()
    for key in _CHECK_KEYS:
        assert key in result["checks"], f"smoke must report the {key!r} check"


async def test_smoke_all_green_enables_finalize(monkeypatch):
    """SC#1/D-13: when every check is green → ``all_green:true`` (Finalize is unlocked — the
    smoke IS the finalize gate)."""
    _stub_probes(monkeypatch, _ALL_UP)
    result = await setup_service.run_smoke_checks()
    all_up = all(v.get("state") == "up" for v in result["checks"].values())
    assert all_up is True, "the all-green fixture must report every row up"
    assert result["all_green"] is all_up


async def test_smoke_any_red_blocks_finalize(monkeypatch):
    """SC#1/D-13: any single red check ⇒ ``all_green:false`` (Finalize stays disabled with a
    plain-language fix). Force ONE check (Redis) down; the other four stay up — all_green flips
    false and the red row is honestly reported down (never optimistically green)."""
    states = {**_ALL_UP, "redis_ping": "down"}
    _stub_probes(monkeypatch, states)
    result = await setup_service.run_smoke_checks()
    assert result["all_green"] is False, "a single red check must block Finalize"
    assert result["checks"]["redis_ping"]["state"] == "down"
    # the other four remain honestly green
    for key in ("supabase_auth", "postgres_schema", "provider_key", "operator_row"):
        assert result["checks"][key]["state"] == "up"


async def test_smoke_unrun_provider_is_neutral_not_optimistic(monkeypatch):
    """SC#1/D-13 (honesty): with NO provider key supplied the provider_key row is ``down``
    (not-configured) — a not-yet-verified row is NEVER optimistically green. Exercises the real
    ``_probe_provider_key`` no-key short-circuit (no network)."""
    # stub only the connection probes; let the real _probe_provider_key run with an empty key
    async def _supabase(url, key):
        return {"state": "up"}

    async def _postgres(dsn):
        return {"state": "up", "schema_present": True}

    async def _redis(url):
        return {"state": "up"}

    async def _operator(dsn):
        return {"state": "up"}

    monkeypatch.setattr(setup_service, "probe_submitted_supabase", _supabase)
    monkeypatch.setattr(setup_service, "probe_submitted_postgres", _postgres)
    monkeypatch.setattr(setup_service, "probe_submitted_redis", _redis)
    monkeypatch.setattr(setup_service, "_probe_operator_row", _operator)

    result = await setup_service.run_smoke_checks(cfg={"provider": "openai", "provider_key": ""})
    assert result["checks"]["provider_key"]["state"] == "down"
    assert result["checks"]["provider_key"]["reason"] == "not_configured"
    assert result["all_green"] is False
