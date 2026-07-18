"""Phase 150 Plan 03 Task 2 (SEC-01) — decrypt-on-read seam in _build_settings_from_row.

Proves the ONE read seam (both sync + async loads funnel through
_build_settings_from_row) decrypts SECRET_COLUMNS transparently for every consumer,
operating on a COPY so the 30s cache keeps ciphertext, and fails SOFT to the existing
_val DB>env chain when a column will not decrypt (D-150-04/05):

  - test_decrypts_on_read        — enc:v1: DB value surfaces as plaintext (SC#1 read).
  - test_failsoft_to_env         — undecryptable enc:v1: (wrong key) => dropped to None
                                    => _val env fallback; NO exception (platform up, D-150-05).
  - test_env_precedence_no_key   — no key + no DB secret + env set => env value (SC#3).
  - test_db_over_env             — decryptable DB value + env value => DB (decrypted) wins.
  - test_plaintext_legacy_untouched — a non-enc:v1: legacy value is used as-is (no decrypt).

Boundary discipline (mirrors test_150_cipher / test_147): the master key is driven by
monkeypatching `app.config.settings.secrets_encryption_key`; the env-fallback value is
driven by monkeypatching the matching env attr on the SAME settings object (env_settings
in user_settings.py IS app.config.settings). Rows are constructed directly — no DB. Real
Fernet keys are generated per test; no key material is hardcoded.
"""
from cryptography.fernet import Fernet, MultiFernet

from app.config import settings
from app.models.user_settings import _build_settings_from_row
from app.security.secret_cipher import encrypt_secret, get_cipher


def _set_key(monkeypatch, value: str) -> None:
    monkeypatch.setattr(settings, "secrets_encryption_key", value)


def test_decrypts_on_read(monkeypatch):
    """A row with an enc:v1: embedding_api_key surfaces the plaintext to consumers."""
    _set_key(monkeypatch, Fernet.generate_key().decode())
    cipher = get_cipher()
    row = {"embedding_api_key": encrypt_secret("sk-xyz", cipher)}

    s = _build_settings_from_row(row)
    assert s.embedding_api_key == "sk-xyz"


def test_failsoft_to_env(monkeypatch):
    """An enc:v1: value made under a DIFFERENT key => dropped to None => env fallback.

    No exception is raised — a decrypt blip must NEVER take the platform down (D-150-05).
    """
    # A token encrypted under a foreign key the current env does NOT list.
    foreign_cipher = MultiFernet([Fernet(Fernet.generate_key().decode())])
    foreign_enc = encrypt_secret("sk-unreachable", foreign_cipher)

    _set_key(monkeypatch, Fernet.generate_key().decode())  # a DIFFERENT active key
    monkeypatch.setattr(settings, "embedding_api_key", "env-key")

    row = {"embedding_api_key": foreign_enc}
    s = _build_settings_from_row(row)  # must not raise

    assert s.embedding_api_key == "env-key", "undecryptable column must fall soft to env"


def test_env_precedence_no_key(monkeypatch):
    """No master key + no DB secret (column unset) + env set => env value (SC#3)."""
    _set_key(monkeypatch, "")
    monkeypatch.setattr(settings, "embedding_api_key", "env-key")

    s = _build_settings_from_row({})  # embedding_api_key unset in the DB row
    assert s.embedding_api_key == "env-key"


def test_db_over_env(monkeypatch):
    """A decryptable enc:v1: DB value AND an env value => the DB (decrypted) value wins."""
    _set_key(monkeypatch, Fernet.generate_key().decode())
    monkeypatch.setattr(settings, "embedding_api_key", "env-key")
    cipher = get_cipher()

    row = {"embedding_api_key": encrypt_secret("sk-db-value", cipher)}
    s = _build_settings_from_row(row)
    assert s.embedding_api_key == "sk-db-value", "DB(decrypted) must take precedence over env"


def test_plaintext_legacy_untouched(monkeypatch):
    """A non-prefixed plaintext value (legacy, pre-sweep) is used as-is — no decrypt, no drop."""
    _set_key(monkeypatch, Fernet.generate_key().decode())
    monkeypatch.setattr(settings, "embedding_api_key", "env-key")

    row = {"embedding_api_key": "sk-legacy-plaintext"}
    s = _build_settings_from_row(row)
    assert s.embedding_api_key == "sk-legacy-plaintext", "legacy plaintext must pass through as-is"
