"""Phase 150 Plan 03 Task 3 (SEC-01) — SC#1 ciphertext-at-rest integration proof.

The acceptance anchor for SC#1 ("a key saved through Settings is stored encrypted at
rest"): with a real SECRETS_ENCRYPTION_KEY set, a save through the REAL write seam
(save_app_settings) against the LIVE local Postgres must land as enc:v1: ciphertext —
proven by a RAW SQL SELECT of app_settings.embedding_api_key (NOT through
_build_settings_from_row, which would decrypt) — and that stored value must decrypt
back to the submitted plaintext (D-150-07 round-trip meaning).

Live-PG guarded (reuses the test_081_1_settings_migration harness): SKIPS when
127.0.0.1:54322 is unreachable, never fails. Targets embedding_api_key, which exists
regardless of the newer provider columns (mig 100). The global row's prior value is
restored afterward so the test is repeatable.
"""
import asyncio
import json
import os
import uuid

import asyncpg
import pytest
import pytest_asyncio
from cryptography.fernet import Fernet

from app.config import settings
from app.models.user_settings import save_app_settings
from app.security.secret_cipher import decrypt_secret, get_cipher

# ---------------------------------------------------------------------------
# PG availability guard (same pattern as test_081_1_settings_migration.py)
# ---------------------------------------------------------------------------

_POSTGRES_TEST_DSN = os.environ.get(
    "POSTGRES_DSN",
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
)


async def _pg_reachable(dsn: str = _POSTGRES_TEST_DSN) -> bool:
    """Probe local Postgres availability without raising."""
    try:
        conn = await asyncio.wait_for(asyncpg.connect(dsn), timeout=2.0)
        await conn.close()
        return True
    except Exception:
        return False


def _check_pg_available_sync() -> bool:
    """Synchronous wrapper for the async probe."""
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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping ciphertext-at-rest test",
)


@pytest_asyncio.fixture
async def raw_pool():
    """Function-scoped real asyncpg pool for the RAW read + restore.

    Separate from the app's get_pg_pool() singleton that save_app_settings uses (both
    point at the same local DB — settings.postgres_dsn == _POSTGRES_TEST_DSN), so the
    read genuinely inspects committed at-rest bytes, not the write path's state.
    """
    async def _init(conn):
        await conn.set_type_codec(
            "jsonb",
            encoder=json.dumps,
            decoder=json.loads,
            schema="pg_catalog",
        )
    pool = await asyncpg.create_pool(_POSTGRES_TEST_DSN, min_size=1, max_size=2, init=_init)
    try:
        yield pool
    finally:
        await pool.close()


async def test_ciphertext_at_rest_and_roundtrip(raw_pool, monkeypatch):
    """A save through the real seam stores enc:v1: ciphertext; it decrypts back (SC#1 + D-150-07)."""
    # (1) a real, generated Fernet key — activates encryption for this test only.
    monkeypatch.setattr(settings, "secrets_encryption_key", Fernet.generate_key().decode())

    plaintext = f"secret-XYZ-{uuid.uuid4().hex[:12]}"

    # Snapshot the prior value so the test is repeatable (restore in finally).
    original = await raw_pool.fetchval(
        "SELECT embedding_api_key FROM app_settings WHERE id = 'global'"
    )
    try:
        # (2) write through the REAL seam (uses the app's get_pg_pool() singleton, same DB).
        ok = await save_app_settings({"embedding_api_key": plaintext})
        assert ok is True, "save_app_settings must report success"

        # (3) RAW SQL read of the stored bytes — NOT via _build_settings_from_row (no decrypt).
        stored = await raw_pool.fetchval(
            "SELECT embedding_api_key FROM app_settings WHERE id = 'global'"
        )
        assert stored is not None
        assert stored.startswith("enc:v1:"), "the value at rest must carry the enc:v1: envelope"
        assert plaintext not in stored, "the plaintext must NOT appear anywhere in the stored value"

        # (4) round-trip proof — the stored ciphertext decrypts back to the submitted value.
        cipher = get_cipher()
        assert cipher is not None
        assert decrypt_secret(stored, cipher) == plaintext, "stored ciphertext must decrypt to input"
    finally:
        # Restore the column via raw SQL (bypasses encrypt-on-write) so re-runs are clean.
        await raw_pool.execute(
            "UPDATE app_settings SET embedding_api_key = $1 WHERE id = 'global'",
            original,
        )
