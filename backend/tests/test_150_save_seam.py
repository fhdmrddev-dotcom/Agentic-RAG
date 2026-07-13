"""Phase 150 Plan 03 Task 1 (SEC-01) — encrypt-on-write seam in save_app_settings.

Proves the ONE write seam (save_app_settings) encrypts SECRET_COLUMNS values in
place after the existing sentinel/_is_valid_api_key guard and before the
parameterized UPDATE:

  - test_encrypts_on_write            — key set => value written to the pool is enc:v1:
                                        and decrypts back to the submitted plaintext (SC#1).
  - test_no_key_writes_plaintext      — no key => value written verbatim (D-150-01 passthrough).
  - test_already_encrypted_not_double_wrapped — an enc:v1: value passes through unchanged.
  - test_non_secret_column_untouched  — a non-secret update key is never encrypted.

Mocking matches the MEMORY lesson from Phase 147 (test_147_flag_failure_semantics):
drive the DATA-ACCESS layer the write seam actually uses — the asyncpg pool
(`app.dependencies._pg_pool`, whose `execute` save_app_settings calls directly). A
`_StubPool` records the args passed to `pool.execute(...)` so the test can assert the
value that landed in the SQL params. The key is toggled by monkeypatching
`app.config.settings.secrets_encryption_key` — the attribute `_load_keys()` reads
lazily. Real Fernet keys are generated per test; no key material is hardcoded.
"""
from cryptography.fernet import Fernet, MultiFernet

from app.config import settings
from app.models.user_settings import save_app_settings
from app.security.secret_cipher import decrypt_secret, encrypt_secret, get_cipher


class _StubPool:
    """Minimal asyncpg-pool stand-in the write seam calls DIRECTLY.

    `save_app_settings` does `pool.execute(sql, *vals)`. We record each call so the
    test can assert the encrypted/plaintext value landed in the SQL params. The
    UPDATE builds `vals = list(clean.values()) + ["global"]`, so for a single-column
    save the value under test is always `execute_calls[-1][1][0]`.
    """

    def __init__(self):
        self.execute_calls: list = []

    async def execute(self, sql, *args):
        self.execute_calls.append((sql, args))
        return "UPDATE 1"

    async def close(self):  # tolerated by the _reset_pg_pool_singleton teardown
        return None


def _set_key(monkeypatch, value: str) -> None:
    monkeypatch.setattr(settings, "secrets_encryption_key", value)


def _stored_value(pool: _StubPool):
    """Return the first SQL param of the last execute — the single secret column's value."""
    assert pool.execute_calls, "save_app_settings must issue an UPDATE via the pool"
    return pool.execute_calls[-1][1][0]


async def test_encrypts_on_write(monkeypatch):
    """With a key set, the value written to the pool is enc:v1: and round-trips (SC#1)."""
    _set_key(monkeypatch, Fernet.generate_key().decode())
    pool = _StubPool()
    monkeypatch.setattr("app.dependencies._pg_pool", pool)

    ok = await save_app_settings({"embedding_api_key": "sk-secret-123"})
    assert ok is True

    stored = _stored_value(pool)
    assert isinstance(stored, str)
    assert stored.startswith("enc:v1:"), "secret column must be written encrypted"
    assert "sk-secret-123" not in stored, "plaintext must not appear in the stored value"

    cipher = get_cipher()
    assert decrypt_secret(stored, cipher) == "sk-secret-123", "must decrypt back to input"


async def test_no_key_writes_plaintext(monkeypatch):
    """No master key => the same save writes the value verbatim (D-150-01 passthrough)."""
    _set_key(monkeypatch, "")
    pool = _StubPool()
    monkeypatch.setattr("app.dependencies._pg_pool", pool)

    ok = await save_app_settings({"embedding_api_key": "sk-secret-123"})
    assert ok is True

    stored = _stored_value(pool)
    assert stored == "sk-secret-123", "with no key the value is byte-identical (no enc:v1: prefix)"


async def test_already_encrypted_not_double_wrapped(monkeypatch):
    """A value already carrying enc:v1: passes through unchanged (is_encrypted guard)."""
    _set_key(monkeypatch, Fernet.generate_key().decode())
    cipher = get_cipher()
    pre_encrypted = encrypt_secret("sk-secret-123", cipher)

    pool = _StubPool()
    monkeypatch.setattr("app.dependencies._pg_pool", pool)

    ok = await save_app_settings({"embedding_api_key": pre_encrypted})
    assert ok is True

    stored = _stored_value(pool)
    assert stored == pre_encrypted, "must not double-wrap an already-encrypted value"
    # And it still decrypts to the original plaintext (single envelope, not nested).
    assert decrypt_secret(stored, cipher) == "sk-secret-123"


async def test_non_secret_column_untouched(monkeypatch):
    """A non-secret update key is written verbatim, never encrypted (SECRET_COLUMNS allowlist)."""
    _set_key(monkeypatch, Fernet.generate_key().decode())
    pool = _StubPool()
    monkeypatch.setattr("app.dependencies._pg_pool", pool)

    ok = await save_app_settings({"embedding_model": "text-embedding-3-large"})
    assert ok is True

    stored = _stored_value(pool)
    assert stored == "text-embedding-3-large", "a non-secret column must never be encrypted"
    assert not stored.startswith("enc:v1:")
