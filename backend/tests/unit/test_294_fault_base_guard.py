"""Phase 294-01 Task 4 (D-22 enabler / T-294-31) — the dev-only decision-engine fault path.

``DECISION_ENGINE_FAULT_BASE_URL`` redirects Jev and OpenAI Decisions to a local fault server so
the live drive can force 401 / slow / 429 / 500 / malformed / refusal / missing responses through
the real app. It must be impossible to honour anywhere but an explicit local environment with a
strictly loopback URL, and when honoured the stored key never leaves: a dummy token is sent.

* N1 environment: only an EXPLICIT local / development / dev / test (unset does NOT qualify).
* N2 URL: http/https, host exactly 127.0.0.1 / localhost (any case) / ::1, int port, plain path,
  no query / fragment / userinfo / backslash / whitespace / control char; REBUILT from parts.
* N3 dummy token: the fault server sees ``Bearer fault-server-dummy-token-294`` and never a key.
* N4 fault server: runtime ``POST /_mode/<mode>`` from loopback, every mode through rerank.
"""
from __future__ import annotations

import dataclasses
import importlib.util
import json
import logging
import pathlib
import threading
import time
import urllib.error
import urllib.request

import pytest

from tests.unit.decision_engine_fakes import PLANTED_KEYS, docs, user_settings

SCRIPT = pathlib.Path(__file__).resolve().parents[3] / "scripts" / "decision-fault-server.py"
ENV = "DECISION_ENGINE_FAULT_BASE_URL"
IGNORED = "DECISION_ENGINE_FAULT_BASE_URL ignored: needs ENVIRONMENT=local|development|dev|test and a loopback URL"


@pytest.fixture
def guard(monkeypatch):
    import app.services.rerank_engines as engines
    from app.config import settings

    monkeypatch.setattr(engines, "_fault_warned", set())

    def _set(url, environment="local"):
        if url is None:
            monkeypatch.delenv(ENV, raising=False)
        else:
            monkeypatch.setenv(ENV, url)
        monkeypatch.setattr(settings, "environment", environment)
    return _set


def _resolve(engine):
    from app.services.rerank_engines import resolve_endpoint
    from app.services.rerank_engines.registry import ENGINES

    return resolve_endpoint(ENGINES[engine])


# ── N1: the environment ───────────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("environment", ["", "   ", "production", "prod", "staging", "live", "dev-eu", "testing"])
def test_override_needs_an_explicit_local_environment(guard, caplog, environment):
    from app.services.rerank_engines.registry import JEV_DECISIONS_URL

    guard("http://127.0.0.1:8765", environment)
    with caplog.at_level(logging.WARNING):
        ep = _resolve("jev")
    assert (ep.url, ep.fault) == (JEV_DECISIONS_URL, False)
    assert IGNORED in caplog.text


@pytest.mark.parametrize("environment", ["local", "development", "dev", "test", " LOCAL ", "Test"])
def test_explicit_local_environments_are_honoured(guard, environment):
    guard("http://127.0.0.1:8765", environment)
    ep = _resolve("jev")
    assert (ep.url, ep.fault) == ("http://127.0.0.1:8765/api/alpha/decisions", True)


def test_unset_override_is_silent_and_vendor(guard, caplog):
    from app.services.rerank_engines.registry import OPENAI_DECISIONS_URL

    for value in (None, ""):
        guard(value)
        with caplog.at_level(logging.WARNING):
            ep = _resolve("openai_decisions")
        assert (ep.url, ep.fault) == (OPENAI_DECISIONS_URL, False)
    assert "DECISION_ENGINE_FAULT_BASE_URL" not in caplog.text


# ── N2: the URL ───────────────────────────────────────────────────────────────────────────────

REJECTED = [
    "http://0.0.0.0:8765", "http://127.0.0.2:8765", "http://[::ffff:127.0.0.1]:8765",
    "http://[0:0:0:0:0:0:0:1]:8765", "http://localhost.:8765", "http://127.0.0.1@evil.com",
    "http://evil.com#@127.0.0.1", "http://127.0.0.1:8765?x=1", "http://127.0.0.1:8765/#f",
    "http://127.0.0.1:8765/?", "http:\\\\127.0.0.1:8765", "http://127.0.0.1:8765\\x",
    "http://127.0.0.1:8765/a b", "http://127.0.0.1:8765/\tx", "http://127.0.0.1:8765/\x01",
    "http://127.0.0.1:99999", "http://127.0.0.1:port", "http://127.0.0.1:0",
    "http://ｌｏｃａｌｈｏｓｔ:8765", "http://xn--lcalhost-8za:8765",
    "ftp://127.0.0.1:8765", "http://:8765", "127.0.0.1:8765", "http://127.0.0.1",
    "http://user:pw@127.0.0.1:8765", "http://127.0.0.1:8765/../x", "http://127.0.0.1:8765/%2e%2e",
    " http://127.0.0.1:8765", "http://evil.com:8765", "http://[::1:8765",
]


@pytest.mark.parametrize("url", REJECTED)
def test_rejected_urls_fall_back_to_the_vendor(guard, caplog, url):
    from app.services.rerank_engines.registry import JEV_DECISIONS_URL

    guard(url)
    with caplog.at_level(logging.WARNING):
        ep = _resolve("jev")
    assert (ep.url, ep.fault) == (JEV_DECISIONS_URL, False)
    assert IGNORED in caplog.text


@pytest.mark.parametrize("url", REJECTED + ["http://127.0.0.1:8765/\x00", "http://127.0.0.1:8765/\x7f"])
def test_the_validator_rejects_every_form_directly(url):
    """An environment variable cannot hold NUL (the OS refuses it), so NUL is driven here."""
    from app.services.rerank_engines import _validated_fault_base

    assert _validated_fault_base(url) is None


@pytest.mark.parametrize("url,jev,oai", [
    ("http://127.0.0.1:8765", "http://127.0.0.1:8765/api/alpha/decisions", "http://127.0.0.1:8765/v1/decisions"),
    ("http://127.0.0.1:8765/", "http://127.0.0.1:8765/api/alpha/decisions", "http://127.0.0.1:8765/v1/decisions"),
    ("http://LOCALHOST:8765", "http://localhost:8765/api/alpha/decisions", "http://localhost:8765/v1/decisions"),
    ("http://[::1]:8765", "http://[::1]:8765/api/alpha/decisions", "http://[::1]:8765/v1/decisions"),
    ("https://127.0.0.1:9443/fault/", "https://127.0.0.1:9443/fault/api/alpha/decisions",
     "https://127.0.0.1:9443/fault/v1/decisions"),
])
def test_accepted_urls_are_rebuilt_from_their_parts(guard, url, jev, oai):
    guard(url)
    assert (_resolve("jev").url, _resolve("jev").fault) == (jev, True)
    assert (_resolve("openai_decisions").url, _resolve("openai_decisions").fault) == (oai, True)


def test_cohere_is_never_redirected(guard):
    from app.services.rerank_engines.registry import COHERE_RERANK_URL

    guard("http://127.0.0.1:8765")
    ep = _resolve("cohere")
    assert (ep.url, ep.fault) == (COHERE_RERANK_URL, False)


def test_each_warning_is_logged_once_per_process(guard, caplog):
    guard("http://127.0.0.1:8765")
    with caplog.at_level(logging.WARNING):
        for _ in range(3):
            _resolve("jev")
            _resolve("openai_decisions")
    active = [r for r in caplog.records if "is ACTIVE" in r.getMessage()]
    assert len(active) == 1 and active[0].levelno == logging.WARNING
    assert active[0].getMessage() == (
        "DECISION_ENGINE_FAULT_BASE_URL is ACTIVE: decision engines are pointed at "
        "http://127.0.0.1:8765 (dev-only)"
    )
    guard("http://0.0.0.0:8765")
    with caplog.at_level(logging.WARNING):
        for _ in range(3):
            _resolve("jev")
    assert len([r for r in caplog.records if IGNORED in r.getMessage()]) == 1


def test_the_ignore_warning_never_echoes_the_raw_value(guard, caplog):
    guard("http://127.0.0.1@evil.example:8765")
    with caplog.at_level(logging.WARNING):
        _resolve("jev")
    assert "evil.example" not in caplog.text


# ── N3 + N4: the fault server, driven through the real dispatcher ─────────────────────────────

def _load_script():
    spec = importlib.util.spec_from_file_location("decision_fault_server", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture
def fault_server():
    mod = _load_script()
    server = mod.build_server(port=0, slow_seconds=2.0)
    seen: list[tuple[dict, bytes]] = []
    server.observer = lambda headers, body: seen.append((dict(headers), body))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{server.server_address[1]}"
    try:
        yield mod, server, base, seen
    finally:
        server.shutdown()
        server.server_close()


def _http(method, url):
    req = urllib.request.Request(url, method=method, data=b"" if method == "POST" else None)
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode()


def test_the_server_binds_loopback_only(fault_server):
    _mod, server, _base, _seen = fault_server
    assert server.server_address[0] == "127.0.0.1"


def test_mode_switch_at_runtime(fault_server):
    mod, server, base, _seen = fault_server
    assert _http("GET", f"{base}/_mode") == (200, json.dumps({"mode": "ok"}))
    assert _http("POST", f"{base}/_mode/429")[0] == 200
    assert json.loads(_http("GET", f"{base}/_mode")[1]) == {"mode": "429"}
    assert _http("POST", f"{base}/_mode/bogus")[0] == 400
    assert json.loads(_http("GET", f"{base}/_mode")[1]) == {"mode": "429"}
    assert set(mod.MODES) == {"ok", "401", "slow", "429", "500", "malformed", "refusal", "missing"}


@pytest.fixture
def fast_engines(monkeypatch):
    """Shrink the engine timeouts so the slow mode costs ~1 s instead of 6-8 s."""
    import app.services.rerank_engines.registry as registry

    for eid in ("jev", "openai_decisions"):
        monkeypatch.setitem(registry.ENGINES, eid,
                            dataclasses.replace(registry.ENGINES[eid], timeout_s=0.6, connect_timeout_s=0.5))
    monkeypatch.setattr(registry, "JEV_OVERALL_TIMEOUT_S", 0.8)


@pytest.mark.parametrize("engine", ["jev", "openai_decisions"])
def test_honoured_override_sends_the_dummy_token_never_the_key(guard, fault_server, engine):
    from app.services.rerank_service import rerank

    _mod, _server, base, seen = fault_server
    guard(base)
    out = rerank("q", docs(6), 5, user_settings(rerank_provider=engine))
    assert [r["id"] for r in out] == ["c0", "c2", "c4"], "ok mode: 0.9 / 0.05 alternating, pruned"
    assert seen
    for headers, body in seen:
        auth = {k.lower(): v for k, v in headers.items()}["authorization"]
        assert auth == "Bearer fault-server-dummy-token-294"
        blob = json.dumps(headers) + body.decode("utf-8", "replace")
        for key in PLANTED_KEYS:
            assert key not in blob


@pytest.mark.parametrize("engine,providers", [
    ("jev", []), ("openai_decisions", []),
])
def test_a_missing_key_still_does_not_dispatch(guard, fault_server, engine, providers):
    from app.services.rerank_service import rerank

    _mod, _server, base, seen = fault_server
    guard(base)
    pool = docs(6)
    assert rerank("q", pool, 3, user_settings(rerank_provider=engine, providers=providers)) == pool[:3]
    assert seen == []


@pytest.mark.parametrize("engine", ["jev", "openai_decisions"])
@pytest.mark.parametrize("mode", ["401", "slow", "429", "500", "malformed", "refusal", "missing"])
def test_every_fault_mode_returns_the_off_output(guard, fault_server, fast_engines, caplog, engine, mode):
    from app.services.rerank_service import rerank

    _mod, _server, base, seen = fault_server
    guard(base)
    assert _http("POST", f"{base}/_mode/{mode}")[0] == 200
    pool = docs(8)
    started = time.monotonic()
    with caplog.at_level(logging.WARNING):
        out = rerank("q", pool, 5, user_settings(rerank_provider=engine))
    elapsed = time.monotonic() - started
    assert out == pool[:5]
    assert f"rerank engine {engine} failed (" in caplog.text
    assert elapsed < 0.8 + 1.0
    assert seen, "the request reached the fault server"
    for key in PLANTED_KEYS:
        assert key not in caplog.text
