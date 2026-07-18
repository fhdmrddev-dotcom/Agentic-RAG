"""Phase 150 Plan 04 Task 2 (SEC-01 / D-150-01 / D-150-04 / SC#4) — fail-open boot polarity.

Proves the intent-based boot polarity of the master-key gate + the no-re-entry guarantee
(SC#4 — an existing deployment boots UNCHANGED; encryption is one env var away):

  - test_missing_key_warns_no_raise:
      no SECRETS_ENCRYPTION_KEY -> _validate_and_report_cipher() returns None and logs ONE
      loud WARNING naming SECRETS_ENCRYPTION_KEY (D-150-01). No exception.
  - test_malformed_key_refuses_startup:
      a malformed key -> _validate_and_report_cipher() RE-RAISES ValueError (D-150-04
      fail-hard, T-150-05 — the wiring is NOT swallowed by a best-effort try/except).
  - test_no_key_load_path_unchanged (live-PG):
      with no key, a plaintext secret already at rest stays byte-for-byte unchanged after a
      sweep attempt (the sweep is a no-op with no cipher) — nothing is encrypted, nothing is
      lost (SC#4).

Key is driven by monkeypatching ``app.config.settings.secrets_encryption_key`` (the exact
attribute secret_cipher reads lazily — test_150_cipher precedent), so the test is
deterministic regardless of the local backend/.env.
"""
import asyncio
import json
import logging
import os

import asyncpg
import pytest
import pytest_asyncio

from app.config import settings as env_settings

# ── PG availability guard (same pattern as test_081_1_settings_migration.py) ────

_POSTGRES_TEST_DSN = os.environ.get(
    "POSTGRES_DSN",
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
)


async def _pg_reachable(dsn: str = _POSTGRES_TEST_DSN) -> bool:
    try:
        conn = await asyncio.wait_for(asyncpg.connect(dsn), timeout=2.0)
        await conn.close()
        return True
    except Exception:
        return False


def _check_pg_available_sync() -> bool:
    try:
        loop = asyncio.new_event_loop()
        try:
            return loop.run_until_complete(_pg_reachable())
        finally:
            loop.close()
    except Exception:
        return False


PG_AVAILABLE = _check_pg_available_sync()
pytestmark = pytest.mark.skipif(
    not PG_AVAILABLE,
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping fail-open integration tests",
)


@pytest_asyncio.fixture
async def pg_pool():
    async def _init(conn):
        await conn.set_type_codec(
            "jsonb",
            encoder=json.dumps,
            decoder=json.loads,
            schema="pg_catalog",
        )
    pool = await asyncpg.create_pool(_POSTGRES_TEST_DSN, min_size=1, max_size=4, init=_init)
    try:
        yield pool
    finally:
        await pool.close()


@pytest_asyncio.fixture
async def save_restore_app_settings(pg_pool):
    row = await pg_pool.fetchrow("SELECT * FROM app_settings WHERE id = 'global'")
    yield row
    if row is not None:
        cols = [k for k in dict(row).keys() if k != "id"]
        vals = [row[k] for k in cols]
        set_clause = ", ".join(f"{col} = ${i + 1}" for i, col in enumerate(cols))
        vals.append("global")
        await pg_pool.execute(
            f"UPDATE app_settings SET {set_clause} WHERE id = ${len(vals)}",
            *vals,
        )


def test_missing_key_warns_no_raise(monkeypatch, caplog):
    """No key -> None + a loud WARNING naming SECRETS_ENCRYPTION_KEY, no raise (D-150-01)."""
    from app.main import _validate_and_report_cipher

    monkeypatch.setattr(env_settings, "secrets_encryption_key", "")
    caplog.set_level(logging.WARNING, logger="app.main")

    cipher = _validate_and_report_cipher()

    assert cipher is None, "a missing key must fail-open (None), never raise"
    warnings = [r.getMessage() for r in caplog.records if r.levelno == logging.WARNING]
    assert any("SECRETS_ENCRYPTION_KEY" in m for m in warnings), (
        f"expected a plaintext warning naming SECRETS_ENCRYPTION_KEY; got {warnings!r}"
    )


def test_malformed_key_refuses_startup(monkeypatch):
    """A malformed key -> ValueError propagates UN-wrapped (D-150-04 fail-hard, T-150-05)."""
    from app.main import _validate_and_report_cipher

    monkeypatch.setattr(env_settings, "secrets_encryption_key", "not-a-valid-fernet-key")

    with pytest.raises(ValueError):
        _validate_and_report_cipher()


@pytest.mark.asyncio
async def test_no_key_load_path_unchanged(pg_pool, save_restore_app_settings, monkeypatch):
    """With no key, a plaintext secret at rest is left byte-for-byte unchanged (SC#4).

    The sweep is a no-op when no cipher is configured (sweep_row returns {}), so an existing
    deployment boots unchanged — nothing is encrypted, nothing is lost, no re-entry needed.
    """
    from app.main import _sweep_secret_columns

    monkeypatch.setattr(env_settings, "secrets_encryption_key", "")

    plaintext = "sk-test-150-failopen-PLAINTEXT"
    await pg_pool.execute(
        "UPDATE app_settings SET tavily_api_key = $1 WHERE id = 'global'", plaintext
    )

    swept = await _sweep_secret_columns(pg_pool)
    assert swept == {}, "no key configured -> the sweep must be a pure no-op (no encryption)"

    stored = await pg_pool.fetchval(
        "SELECT tavily_api_key FROM app_settings WHERE id = 'global'"
    )
    assert stored == plaintext, "with no key, the stored secret must remain unchanged plaintext"
