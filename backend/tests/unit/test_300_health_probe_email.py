"""Phase 300-04 (D-12 / T-300-33 / T-300-34) — the Control Room Email probe.

``GET /admin/backpressure`` spreads ``probe_dependencies()``, so the new ``email`` key reaches the
operator with no edit to ``admin.py``. The contract this file pins:

    dependencies.email = {state: up|down|off, mode: off|held_back|test|live,
                          provider: none|resend|smtp, last_sent_at, last_failure_at,
                          last_failure_reason, latency_ms: null}

Off and held back are NEUTRAL (``state: off``), never ``down``; only a failure newer than the
newest send (or a probe that could not read the record) is ``down``; the probe never raises.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from app.services import health_probe as hp

T = datetime(2026, 10, 29, 9, 0, tzinfo=timezone.utc)
KEYS = {"state", "mode", "provider", "last_sent_at", "last_failure_at", "last_failure_reason", "latency_ms"}


@pytest.fixture
def knobs(monkeypatch):
    state = {
        "provider": "resend",
        "production": True,
        "redirect": None,
        "facts": {"last_sent_at": None, "last_failure_at": None, "last_failure_reason": None},
        "facts_error": None,
        "fact_calls": 0,
    }

    async def latest_delivery_facts(pool):
        state["fact_calls"] += 1
        if state["facts_error"] == "timeout":
            await asyncio.sleep(5)
        if state["facts_error"]:
            raise RuntimeError("db is down")
        return state["facts"]

    async def get_pg_pool():
        return object()

    monkeypatch.setattr(hp, "configured_provider", lambda: state["provider"])
    monkeypatch.setattr(hp, "is_production_environment", lambda: state["production"])
    monkeypatch.setattr(hp, "load_app_settings",
                        lambda: SimpleNamespace(email_dev_redirect_address=state["redirect"]))
    monkeypatch.setattr(hp, "latest_delivery_facts", latest_delivery_facts)
    monkeypatch.setattr("app.dependencies.get_pg_pool", get_pg_pool)
    monkeypatch.setattr(hp, "_PROBE_TIMEOUT_S", 0.2)
    return state


async def test_provider_none_is_off_and_reads_nothing(knobs):
    knobs["provider"] = "none"
    out = await hp.probe_email()
    assert set(out) == KEYS
    assert out["state"] == "off" and out["mode"] == "off" and out["provider"] == "none"
    assert out["latency_ms"] is None and out["last_sent_at"] is None
    assert knobs["fact_calls"] == 0


async def test_not_production_without_a_test_address_is_held_back_neutral(knobs):
    knobs.update(production=False, redirect="  ")
    out = await hp.probe_email()
    assert out["state"] == "off" and out["mode"] == "held_back" and out["provider"] == "resend"


async def test_not_production_with_a_test_address_is_test_mode(knobs):
    knobs.update(production=False, redirect="qa@example.com")
    out = await hp.probe_email()
    assert out["mode"] == "test" and out["state"] == "up"
    assert "qa@example.com" not in repr(out), "the probe never carries an address"


async def test_production_with_nothing_attempted_is_up_with_no_timestamps(knobs):
    out = await hp.probe_email()
    assert out["mode"] == "live" and out["state"] == "up"
    assert out["last_sent_at"] is None and out["last_failure_at"] is None


async def test_a_failure_newer_than_the_newest_send_is_down_with_its_reason(knobs):
    knobs["provider"] = "smtp"
    knobs["facts"] = {"last_sent_at": T, "last_failure_at": T + timedelta(minutes=5),
                      "last_failure_reason": "The mail server refused the sign-in."}
    out = await hp.probe_email()
    assert out["state"] == "down" and out["provider"] == "smtp"
    assert out["last_failure_reason"] == "The mail server refused the sign-in."
    assert out["last_failure_at"] == (T + timedelta(minutes=5)).isoformat()
    assert out["last_sent_at"] == T.isoformat()


async def test_a_failure_with_no_send_yet_is_down(knobs):
    knobs["facts"] = {"last_sent_at": None, "last_failure_at": T, "last_failure_reason": "Resend is busy."}
    assert (await hp.probe_email())["state"] == "down"


async def test_a_send_newer_than_the_newest_failure_is_up(knobs):
    knobs["facts"] = {"last_sent_at": T + timedelta(minutes=5), "last_failure_at": T,
                      "last_failure_reason": "Resend is busy."}
    out = await hp.probe_email()
    assert out["state"] == "up" and out["last_sent_at"] == (T + timedelta(minutes=5)).isoformat()


@pytest.mark.parametrize("error", ["raise", "timeout"])
async def test_a_db_error_or_timeout_is_down_with_a_sentence_never_a_raise(knobs, error):
    knobs["facts_error"] = error
    out = await hp.probe_email()
    assert out["state"] == "down" and out["mode"] == "live"
    assert isinstance(out["last_failure_reason"], str) and out["last_failure_reason"].endswith(".")
    assert "db is down" not in out["last_failure_reason"], "the raw error never reaches the tile"


async def test_probe_dependencies_carries_email_and_keeps_the_three_shipped_keys(monkeypatch):
    async def fake(name):
        return {"state": "up", "latency_ms": 1, "name": name}

    monkeypatch.setattr(hp, "probe_redis", lambda: fake("redis"))
    monkeypatch.setattr(hp, "probe_supabase", lambda: fake("supabase"))
    monkeypatch.setattr(hp, "probe_sandbox", lambda: fake("sandbox"))
    monkeypatch.setattr(hp, "probe_email", lambda: fake("email"))
    out = await hp.probe_dependencies()
    assert list(out) == ["redis", "supabase", "sandbox", "email"]
    assert out["redis"]["name"] == "redis" and out["email"]["name"] == "email"
    assert "probe_email" in hp.__all__
