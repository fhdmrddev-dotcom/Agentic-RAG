"""Phase 158 Plan 01 (SC#1 / D-12) — provider key encrypt-on-write through the reused seam.

Wave-0 Nyquist scaffold. The wizard collects the default provider key and persists it via the
EXISTING Phase-150 ``save_app_settings`` seam — it inherits ``SECRET_COLUMNS`` encrypt-on-write
for free (D-12), never a second encrypt path (RESEARCH "Don't Hand-Roll"). This file copies the
``test_150_save_seam.py::test_encrypts_on_write`` intent VERBATIM (same seam): with a key set,
the value written to the pool is an ``enc:v1:`` envelope and round-trips back to the plaintext.

The data-access layer the seam actually uses is the asyncpg pool (``app.dependencies._pg_pool``,
whose ``execute`` ``save_app_settings`` calls directly) — a ``_StubPool`` records the SQL params
so the test asserts the value that landed. The key is toggled via
``monkeypatch.setattr(settings, "secrets_encryption_key", ...)``; real Fernet keys per test, no
key material hardcoded.

``pytest.importorskip("app.services.setup_service")`` SKIPS the file cleanly until Wave 2 (the
wizard's provider step is orchestrated by the service). Wave 2 wires the exact persist call.
"""
import pytest


class _StubPool:
    """Minimal asyncpg-pool stand-in the write seam calls DIRECTLY (copied from test_150).

    ``save_app_settings`` does ``pool.execute(sql, *vals)``; we record each call so the test
    asserts the encrypted value landed in the SQL params. For a single-column save the value
    under test is ``execute_calls[-1][1][0]``.
    """

    def __init__(self):
        self.execute_calls: list = []

    async def execute(self, sql, *args):
        self.execute_calls.append((sql, args))
        return "UPDATE 1"

    async def close(self):  # tolerated by the _reset_pg_pool_singleton teardown
        return None


# NEW service — skips cleanly until Wave 2 creates app/services/setup_service.py.
setup_service = pytest.importorskip("app.services.setup_service")


async def test_provider_key_encrypts_on_write(setup_store_path, monkeypatch):
    """SC#1/D-12: a provider key the wizard collects routes through ``save_app_settings`` and
    lands as an ``enc:v1:`` envelope (encrypt-on-write via SECRET_COLUMNS), decrypting back to
    the submitted plaintext. Copies test_150 ``test_encrypts_on_write`` intent — SAME seam, no
    second encrypt path."""
    from cryptography.fernet import Fernet

    from app.config import settings
    from app.security.secret_cipher import decrypt_secret, get_cipher

    monkeypatch.setattr(settings, "secrets_encryption_key", Fernet.generate_key().decode())
    pool = _StubPool()
    monkeypatch.setattr("app.dependencies._pg_pool", pool)

    # the wizard's provider step persists through save_app_settings (via the service)
    await setup_service.persist_provider_key("openai", "sk-secret-123")

    assert pool.execute_calls, "the provider step must issue a save through the pool"
    stored = pool.execute_calls[-1][1][0]
    assert isinstance(stored, str) and stored.startswith("enc:v1:"), "provider key must be written encrypted"
    assert "sk-secret-123" not in stored, "plaintext must not appear in the stored value"
    assert decrypt_secret(stored, get_cipher()) == "sk-secret-123", "must decrypt back to the input"


async def test_provider_key_plaintext_when_no_master_key(setup_store_path, monkeypatch):
    """SC#1/D-12 (fail-open): with NO ``secrets_encryption_key`` the same save writes the value
    verbatim (Phase-150 D-150-01 passthrough) + a boot warning surfaces in the wizard — the
    wizard must not silently drop the key when encryption is unconfigured."""
    from app.config import settings

    monkeypatch.setattr(settings, "secrets_encryption_key", "")
    pool = _StubPool()
    monkeypatch.setattr("app.dependencies._pg_pool", pool)

    await setup_service.persist_provider_key("openai", "sk-secret-123")

    stored = pool.execute_calls[-1][1][0]
    assert stored == "sk-secret-123", "with no key the value is byte-identical (no enc:v1: prefix)"
