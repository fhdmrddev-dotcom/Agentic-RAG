"""Phase 150 Plan 04 Task 2 (SEC-01 / D-150-03 / D-150-06) — eager sweep idempotence.

Live-PG integration proof (reuses the test_081_1 guard + pool + save/restore pattern) of
the boot-time ``_sweep_secret_columns`` helper against the REAL local Postgres:

  - test_sweep_encrypts_plaintext_then_idempotent:
      with a key set, seed a KNOWN plaintext secret in a real app_settings column, run the
      sweep -> the value at rest carries the enc:v1: envelope and round-trips back to the
      original plaintext; a SECOND sweep is a no-op (converged, D-150-03 idempotent) and does
      NOT rewrite the already-encrypted value.

The key is driven by monkeypatching ``app.config.settings.secrets_encryption_key`` — the
exact attribute ``secret_cipher._load_keys()`` reads lazily (test_150_cipher precedent) — so
the test is deterministic regardless of the local backend/.env. The save/restore fixture
overwrites the whole global row back at teardown, so the seeded column is repeatable.
"""
import asyncio
import json
import os

import asyncpg
import pytest
import pytest_asyncio
from cryptography.fernet import Fernet

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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping secret-sweep integration tests",
)


@pytest_asyncio.fixture
async def pg_pool():
    """Function-scoped real asyncpg pool against local Postgres :54322 (jsonb codec set so
    the whole-row restore round-trips provider_model_lists)."""
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
    """Snapshot the global app_settings row before the test, restore it after."""
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


@pytest.mark.asyncio
async def test_sweep_encrypts_plaintext_then_idempotent(
    pg_pool, save_restore_app_settings, monkeypatch
):
    from app.main import _sweep_secret_columns
    from app.security.secret_cipher import decrypt_secret, get_cipher, is_encrypted

    # A real Fernet key, driven at the boundary secret_cipher reads.
    monkeypatch.setattr(env_settings, "secrets_encryption_key", Fernet.generate_key().decode())

    # Seed a KNOWN plaintext secret in a real secret column (mig 100 added all 12).
    plaintext = "sk-test-150-sweep-PLAINTEXT"
    await pg_pool.execute(
        "UPDATE app_settings SET tavily_api_key = $1 WHERE id = 'global'", plaintext
    )

    # ── First sweep: plaintext -> enc:v1: ──────────────────────────────────────
    changed = await _sweep_secret_columns(pg_pool)
    assert "tavily_api_key" in changed, "the plaintext secret column should have been swept"

    stored = await pg_pool.fetchval(
        "SELECT tavily_api_key FROM app_settings WHERE id = 'global'"
    )
    assert is_encrypted(stored), "the value at rest must carry the enc:v1: envelope after the sweep"
    assert stored != plaintext, "plaintext must not remain at rest once a key is configured"
    # Round-trips back to the original plaintext under the active cipher (D-150-07 meaning).
    assert decrypt_secret(stored, get_cipher()) == plaintext

    # ── Second sweep: converged -> no change (idempotent, D-150-03) ────────────
    changed2 = await _sweep_secret_columns(pg_pool)
    assert changed2 == {}, "a second sweep must be a no-op once values are under the primary key"

    stored2 = await pg_pool.fetchval(
        "SELECT tavily_api_key FROM app_settings WHERE id = 'global'"
    )
    assert stored2 == stored, "an idempotent sweep must not rewrite an already-encrypted value"
