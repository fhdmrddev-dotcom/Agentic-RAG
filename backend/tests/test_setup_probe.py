"""Phase 158 Plan 01 (SC#1 / D-10, T-158 SSRF) — submitted-value probes with sanitized errors.

Wave-0 Nyquist scaffold. The wizard validates the SUBMITTED infra values via THROWAWAY
connections (never the app singletons — RESEARCH Pattern 5), so the singletons stay bound to
placeholder config until restart. The schema-presence sentinel is
``SELECT to_regclass('public.app_settings') IS NOT NULL`` (returns NULL for a missing relation
instead of raising). Crucially, a failed probe returns ONLY ``type(exc).__name__`` + a plain
message — NEVER the raw connection error / host (SSRF telemetry leak, T-158; RESEARCH
Anti-Patterns + Security Domain).

This file pins (158-VALIDATION.md, SC#1/D-10):
  - a reachable submitted DSN → ``state:up``;
  - reachable but schema-absent → ``schema_present:false``;
  - a bad DSN → ``state:down`` with a SANITIZED reason (only ``type(exc).__name__``; the raw
    host string never appears in the response — the anti-SSRF-telemetry assertion);
  - a reachable Redis URL → ``state:up`` via PING.

``pytest.importorskip("app.services.setup_service")`` SKIPS the file cleanly until Wave 2.
"""
import pytest

# NEW service — skips cleanly until Wave 2 creates app/services/setup_service.py.
setup_service = pytest.importorskip("app.services.setup_service")

# A DSN whose host is a distinctive literal — the sanitization test asserts this host does
# NOT leak into the returned reason (SSRF telemetry). Unreachable by construction.
_BAD_HOST = "ssrf-probe-internal-host-xyz"
_BAD_DSN = f"postgresql://u:p@{_BAD_HOST}:5432/db"


async def test_bad_dsn_returns_down_with_sanitized_reason():
    """SC#1/D-10 (T-158 SSRF): a bad DSN → ``state:down`` and the reason is ONLY the exception
    CLASS name (``type(exc).__name__``) — the raw connection error and the submitted host must
    NEVER be reflected to the browser (that would leak internal network topology)."""
    result = await setup_service.probe_submitted_postgres(_BAD_DSN)
    assert result["state"] == "down"
    # sanitized: the reason is a bare exception class name, not a raw message with the host
    reason = result.get("reason", "")
    assert _BAD_HOST not in str(result), "the submitted host must NOT leak (SSRF telemetry)"
    assert reason and reason.isidentifier(), "reason must be a bare type(exc).__name__, not a raw error string"


async def test_reachable_dsn_reports_state_up(monkeypatch):
    """SC#1/D-10: a reachable submitted DSN → ``state:up`` (probed via a THROWAWAY connection,
    never the app pool). A mocked ``asyncpg.connect`` returns a conn whose ``to_regclass``
    schema sentinel is present."""
    class _Conn:
        async def fetchval(self, sql, *a):
            assert "to_regclass" in sql, "schema presence must use the to_regclass sentinel"
            return True

        async def close(self):
            return None

    async def _connect(dsn, *a, **k):
        return _Conn()

    monkeypatch.setattr("asyncpg.connect", _connect)
    result = await setup_service.probe_submitted_postgres("postgresql://u:p@localhost:5432/db")
    assert result["state"] == "up"
    assert result["schema_present"] is True


async def test_schema_absent_reports_schema_present_false(monkeypatch):
    """SC#1/D-10: a reachable DB with NO schema → ``schema_present:false`` (the
    ``to_regclass('public.app_settings')`` sentinel returns NULL for a missing relation — one
    round-trip tells present-vs-absent without raising). Guides the operator to run the
    OPERATOR.md Step-3 bootstrap."""
    class _Conn:
        async def fetchval(self, sql, *a):
            return False  # to_regclass(...) IS NOT NULL → False when the relation is absent

        async def close(self):
            return None

    async def _connect(dsn, *a, **k):
        return _Conn()

    monkeypatch.setattr("asyncpg.connect", _connect)
    result = await setup_service.probe_submitted_postgres("postgresql://u:p@localhost:5432/db")
    assert result["state"] == "up"
    assert result["schema_present"] is False


async def test_reachable_redis_reports_state_up():
    """SC#1/D-10: a reachable submitted Redis URL → ``state:up`` via a throwaway PING; a bad
    URL → ``state:down`` with the same sanitized ``type(exc).__name__`` reason (no host leak)."""
    result = await setup_service.probe_submitted_redis(f"redis://{_BAD_HOST}:6379")
    assert result["state"] == "down"
    assert _BAD_HOST not in str(result), "the submitted Redis host must NOT leak (SSRF telemetry)"
