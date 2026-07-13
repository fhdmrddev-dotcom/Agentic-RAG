"""Phase 150 Plan 01 Task 2 (SEC-01) — secret_cipher module unit tests.

Proves the full public contract of ``app.security.secret_cipher`` — the single
source of key material every downstream seam (Plans 03/04/05) imports:

  - test_roundtrip                        — encrypt -> enc:v1: envelope -> decrypt
  - test_malformed_key_raises             — D-150-04 fail-hard signal (ValueError)
  - test_no_key_passthrough               — D-150-01 fail-open (None + "plaintext")
  - test_rotation                         — D-150-06 MultiFernet rotate-to-primary + idempotent
  - test_sweep_encrypts_plaintext         — D-150-03 in-place encrypt + idempotent
  - test_encryption_status_error          — undecryptable ciphertext -> columns_unreadable
  - test_encryption_status_lingering_plaintext — D-150-03 swallowed-sweep honesty (columns_plaintext)

Boundary discipline (mirrors test_146_operator_seed / test_147_health_probe): the key
is driven by monkeypatching ``app.config.settings.secrets_encryption_key`` — the exact
attribute ``_load_keys()`` reads lazily. Real Fernet keys are generated per test via
``Fernet.generate_key().decode()``; no key material is hardcoded.
"""
import pytest
from cryptography.fernet import Fernet, MultiFernet

from app.config import settings
from app.security.secret_cipher import (
    SECRET_COLUMNS,
    decrypt_secret,
    encrypt_secret,
    encryption_status,
    get_cipher,
    is_encrypted,
    sweep_row,
)


def _set_key(monkeypatch, value: str) -> None:
    monkeypatch.setattr(settings, "secrets_encryption_key", value)


# ── SECRET_COLUMNS contract ─────────────────────────────────────────────────────

def test_secret_columns_matches_main_allowlist():
    """SECRET_COLUMNS is the 12-column frozenset verbatim from main.py:125-130.

    This module becomes the SINGLE source of the secret-column allowlist; Plan 04
    re-points main.py to import it. Set-equality guards against drift.
    """
    expected = frozenset({
        "openai_api_key", "anthropic_api_key", "google_api_key",
        "openrouter_api_key", "ollama_api_key", "deepseek_api_key",
        "moonshot_api_key", "minimax_api_key", "zhipu_api_key",
        "embedding_api_key", "rerank_api_key", "tavily_api_key",
    })
    assert isinstance(SECRET_COLUMNS, frozenset)
    assert SECRET_COLUMNS == expected


# ── roundtrip + envelope ────────────────────────────────────────────────────────

def test_roundtrip(monkeypatch):
    _set_key(monkeypatch, Fernet.generate_key().decode())
    cipher = get_cipher()
    assert cipher is not None

    enc = encrypt_secret("sk-abc123", cipher)
    assert enc.startswith("enc:v1:")
    assert is_encrypted(enc)
    assert decrypt_secret(enc, cipher) == "sk-abc123"


def test_is_encrypted_rejects_plaintext():
    assert is_encrypted("sk-plaintext") is False
    assert is_encrypted("") is False


# ── malformed key -> fail-hard (D-150-04) ──────────────────────────────────────

def test_malformed_key_raises(monkeypatch):
    _set_key(monkeypatch, "not-a-valid-fernet-key")
    with pytest.raises(ValueError):
        get_cipher()


# ── no key -> fail-open plaintext (D-150-01) ────────────────────────────────────

def test_no_key_passthrough(monkeypatch):
    _set_key(monkeypatch, "")
    assert get_cipher() is None
    assert encryption_status({"embedding_api_key": "sk-x"}) == {"state": "plaintext"}


# ── rotation (D-150-06) ─────────────────────────────────────────────────────────

def test_rotation(monkeypatch):
    new_key = Fernet.generate_key().decode()
    old_key = Fernet.generate_key().decode()

    # Encrypt a value under the OLD key only (as an earlier boot would have).
    old_cipher = MultiFernet([Fernet(old_key)])
    old_enc = encrypt_secret("sk-rotate", old_cipher)

    # Active env: NEW first (encrypts), OLD second (decrypt-only).
    _set_key(monkeypatch, f"{new_key},{old_key}")
    cipher = get_cipher()
    assert cipher is not None
    # The MultiFernet still decrypts the old-key token.
    assert decrypt_secret(old_enc, cipher) == "sk-rotate"

    # Sweep rotates the old-key token to the primary (NEW) key.
    changed = sweep_row({"embedding_api_key": old_enc})
    assert "embedding_api_key" in changed
    rotated = changed["embedding_api_key"]
    assert is_encrypted(rotated)

    # The rotated token is decryptable by Fernet(NEW) ALONE (proves re-wrap under primary).
    new_only = MultiFernet([Fernet(new_key)])
    assert decrypt_secret(rotated, new_only) == "sk-rotate"

    # Second sweep over the already-rotated row converges to a no-op (idempotent).
    assert sweep_row({"embedding_api_key": rotated}) == {}


# ── sweep encrypts plaintext, idempotent (D-150-03) ─────────────────────────────

def test_sweep_encrypts_plaintext(monkeypatch):
    _set_key(monkeypatch, Fernet.generate_key().decode())

    changed = sweep_row({"embedding_api_key": "plainsecret", "rerank_api_key": ""})
    # Only the non-empty column is (re)encrypted; the empty string is skipped.
    assert set(changed) == {"embedding_api_key"}
    assert changed["embedding_api_key"].startswith("enc:v1:")

    cipher = get_cipher()
    assert decrypt_secret(changed["embedding_api_key"], cipher) == "plainsecret"

    # Second call over the already-encrypted value is a no-op (idempotent).
    assert sweep_row({"embedding_api_key": changed["embedding_api_key"]}) == {}


def test_sweep_skips_undecryptable_and_continues(monkeypatch):
    """WR-01: a column no configured key can decrypt must NOT abort the whole sweep.

    A foreign-key enc:v1: token sits alongside a healthy plaintext column. Before the fix,
    cipher.rotate() on the foreign token raised InvalidToken out of sweep_row, discarding
    the plaintext column's encryption and recurring on every boot. The sweep must skip the
    poisoned column and still encrypt the healthy plaintext one — one bad column cannot
    block encrypting the rest.
    """
    foreign_key = Fernet.generate_key().decode()
    foreign_enc = encrypt_secret("sk-foreign", MultiFernet([Fernet(foreign_key)]))

    _set_key(monkeypatch, Fernet.generate_key().decode())  # a DIFFERENT active key

    # No exception is raised (the whole point) and the healthy column is still processed.
    changed = sweep_row({
        "openai_api_key": foreign_enc,       # undecryptable by ANY active key
        "embedding_api_key": "plainsecret",  # healthy plaintext — must still encrypt
    })

    assert "embedding_api_key" in changed, "the healthy column must be encrypted despite the poison"
    assert changed["embedding_api_key"].startswith("enc:v1:")
    assert "openai_api_key" not in changed, "the undecryptable column is skipped, never rotated"

    cipher = get_cipher()
    assert decrypt_secret(changed["embedding_api_key"], cipher) == "plainsecret"


# ── encryption_status: error states ─────────────────────────────────────────────

def test_encryption_status_error(monkeypatch):
    """A value encrypted under a key NOT in the current env -> columns_unreadable."""
    foreign_key = Fernet.generate_key().decode()
    foreign_cipher = MultiFernet([Fernet(foreign_key)])
    foreign_enc = encrypt_secret("sk-foreign", foreign_cipher)

    _set_key(monkeypatch, Fernet.generate_key().decode())  # a DIFFERENT env key
    assert encryption_status({"embedding_api_key": foreign_enc}) == {
        "state": "error",
        "columns_unreadable": 1,
    }


def test_encryption_status_lingering_plaintext(monkeypatch):
    """With a cipher ACTIVE, a present non-enc:v1: secret means the D-150-03 sweep
    silently failed and MUST surface honestly (never read as "encrypted"). An
    empty-string column is ignored (an unset secret is not lingering plaintext).
    """
    _set_key(monkeypatch, Fernet.generate_key().decode())
    assert encryption_status({"embedding_api_key": "plainsecret", "rerank_api_key": ""}) == {
        "state": "error",
        "columns_plaintext": 1,
    }


def test_encryption_status_encrypted(monkeypatch):
    """All secret values decrypt cleanly under the active key -> encrypted."""
    _set_key(monkeypatch, Fernet.generate_key().decode())
    cipher = get_cipher()
    row = {
        "embedding_api_key": encrypt_secret("sk-e", cipher),
        "rerank_api_key": encrypt_secret("sk-r", cipher),
    }
    assert encryption_status(row) == {"state": "encrypted"}
