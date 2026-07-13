"""Phase 150 Plan 01 (SEC-01) — at-rest secret cipher (Fernet/MultiFernet wrapper).

The SINGLE source of key material and the encrypt/decrypt/detect/sweep/status
helpers every downstream seam imports (Plans 03/04/05). No ``Fernet(...)`` is
constructed anywhere else in the app — all key parsing and cipher construction
live here so there is exactly one place that reads ``SECRETS_ENCRYPTION_KEY``.

Failure polarity (D-150-04, intent-based):
  - No key configured      -> get_cipher() returns None (D-150-01 fail-open plaintext).
  - Key present but MALFORMED -> Fernet(...) raises ValueError, propagated here so the
    boot caller (Plan 04) can re-raise and REFUSE TO START (fail-hard).
  - Key valid but a stored value WON'T DECRYPT -> InvalidToken at decrypt; callers treat
    the column as unset so the existing env-fallback chain takes over (fail-soft, D-150-05).

Envelope (D-150-Discretion / RESEARCH Pattern 2): ciphertext is stored as
``enc:v1:<fernet-token>``. Classification is by the explicit prefix, NEVER by
attempting a decrypt (a plaintext value and a wrong-key ciphertext both raise
InvalidToken — Pitfall 1), which keeps the sweep idempotent and the fail-soft
signal honest, and leaves an ``enc:v2:`` upgrade path.

Rotation (D-150-06): ``SECRETS_ENCRYPTION_KEY`` is a comma-separated list — the
FIRST key encrypts, all keys decrypt. ``sweep_row`` re-wraps any value not already
under the primary key via ``MultiFernet.rotate`` (Pitfall 3 — never blind-rotate
every value every boot).

Secret-logging discipline (T-081.1-04): every log line emits column NAMES + counts
only — NEVER a plaintext value or a ciphertext token (mirrors main.py:219-223).

Analog composition (150-PATTERNS): module-header + lazy-config-import + ``__all__``
shape mirror ``app/services/health_probe.py``; the lazy ``from app.config import
settings`` idiom lets tests monkeypatch the key at the boundary (test_146 precedent).
"""
from __future__ import annotations

import logging

from cryptography.fernet import Fernet, InvalidToken, MultiFernet

logger = logging.getLogger(__name__)

# Explicit, versionable ciphertext marker. Classification is by this prefix — never
# by a blind decrypt (Pitfall 1).
_ENVELOPE_PREFIX = "enc:v1:"

# The 12 secret columns, verbatim from main.py:125-130 (_API_KEY_COLUMNS). This module
# is the SINGLE source of the allowlist going forward; Plan 04 re-points main.py here.
SECRET_COLUMNS: frozenset[str] = frozenset({
    "openai_api_key", "anthropic_api_key", "google_api_key",
    "openrouter_api_key", "ollama_api_key", "deepseek_api_key",
    "moonshot_api_key", "minimax_api_key", "zhipu_api_key",
    "embedding_api_key", "rerank_api_key", "tavily_api_key",
})


def _load_keys() -> list[str]:
    """Parse SECRETS_ENCRYPTION_KEY lazily so tests can monkeypatch the boundary.

    Returns the comma-split key list (blanks dropped). FIRST element encrypts; all
    elements decrypt (MultiFernet). Empty list => no key configured (D-150-01).
    """
    from app.config import settings as env_settings  # lazy -- avoid an import cycle

    raw = (getattr(env_settings, "secrets_encryption_key", "") or "").strip()
    return [k.strip() for k in raw.split(",") if k.strip()]


def get_cipher() -> MultiFernet | None:
    """Return a MultiFernet, or None when no key is configured (D-150-01 plaintext mode).

    Raises ValueError (propagated) when a key is present but malformed — the boot
    caller RE-RAISES to refuse startup (D-150-04). ``Fernet(k)`` is what raises it.
    """
    keys = _load_keys()
    if not keys:
        return None
    return MultiFernet([Fernet(k) for k in keys])  # ValueError here on a bad key


def is_encrypted(value: object) -> bool:
    """True iff ``value`` carries the enc:v1: envelope (a non-empty ciphertext)."""
    return isinstance(value, str) and value.startswith(_ENVELOPE_PREFIX)


def encrypt_secret(plaintext: str, cipher: MultiFernet) -> str:
    """Encrypt ``plaintext`` under the cipher's PRIMARY key; return ``enc:v1:<token>``."""
    token = cipher.encrypt(plaintext.encode()).decode()
    return f"{_ENVELOPE_PREFIX}{token}"


def decrypt_secret(value: str, cipher: MultiFernet) -> str:
    """Strip the enc:v1: envelope and decrypt (NO ttl — Pitfall 4).

    Raises InvalidToken if the value won't decrypt under any listed key (the caller
    drops the column so env fallback engages — D-150-04/05 fail-soft).
    """
    token = value[len(_ENVELOPE_PREFIX):]
    return cipher.decrypt(token.encode()).decode()


def sweep_row(row: dict) -> dict[str, str]:
    """Idempotent (re)encryption of the secret columns in ``row`` (D-150-03/06).

    For each present, non-empty string value in SECRET_COLUMNS:
      - not enc:v1:                                  -> encrypt under the primary key
      - enc:v1: but NOT decryptable by the primary   -> rotate() re-wrap under primary
      - enc:v1: and already under the primary        -> skip (idempotent no-op)

    Returns only the CHANGED ``{col: enc_value}`` — an empty dict means converged.
    """
    cipher = get_cipher()
    if cipher is None:
        return {}

    keys = _load_keys()
    primary = Fernet(keys[0])  # the key the row must converge onto
    changed: dict[str, str] = {}

    for col in SECRET_COLUMNS:
        value = row.get(col)
        if not isinstance(value, str) or not value:
            continue  # unset secret — nothing to sweep

        if not is_encrypted(value):
            changed[col] = encrypt_secret(value, cipher)
            continue

        token = value[len(_ENVELOPE_PREFIX):].encode()
        try:
            primary.decrypt(token)  # already under the primary key?
        except InvalidToken:
            # Decryptable by an OLDER key -> rotate to the primary (never blind-rotate).
            rotated = cipher.rotate(token).decode()
            changed[col] = f"{_ENVELOPE_PREFIX}{rotated}"

    if changed:
        logger.info(
            "secret_cipher: sweep re-encrypted %d secret column(s): %s",
            len(changed), sorted(changed.keys()),
        )
    return changed


def encryption_status(row: dict) -> dict:
    """Report the at-rest encryption state of ``row`` for the operator Control Plane.

      - no key configured                       -> {"state": "plaintext"}
      - all present secrets decrypt cleanly      -> {"state": "encrypted"}
      - any secret is undecryptable ciphertext   -> "error" + columns_unreadable
      - any present secret lacks the enc:v1:     -> "error" + columns_plaintext
        envelope while a cipher is ACTIVE (a swallowed D-150-03 sweep — MUST surface
        honestly, NEVER be read as "encrypted")

    Only counters that are > 0 are included. Empty-string values are ignored
    throughout (an unset secret is neither unreadable nor lingering plaintext).
    """
    cipher = get_cipher()
    if cipher is None:
        return {"state": "plaintext"}

    columns_unreadable = 0
    columns_plaintext = 0

    for col in SECRET_COLUMNS:
        value = row.get(col)
        if not isinstance(value, str) or not value:
            continue

        if is_encrypted(value):
            try:
                decrypt_secret(value, cipher)
            except InvalidToken:
                columns_unreadable += 1
        else:
            columns_plaintext += 1

    if columns_unreadable or columns_plaintext:
        if columns_unreadable:
            logger.error(
                "secret_cipher: %d secret column(s) failed to decrypt (D-150-04 fail-soft)",
                columns_unreadable,
            )
        if columns_plaintext:
            logger.error(
                "secret_cipher: %d secret column(s) are still plaintext while a key is "
                "active (D-150-03 sweep did not converge)",
                columns_plaintext,
            )
        result: dict = {"state": "error"}
        if columns_unreadable:
            result["columns_unreadable"] = columns_unreadable
        if columns_plaintext:
            result["columns_plaintext"] = columns_plaintext
        return result

    return {"state": "encrypted"}


__all__ = [
    "SECRET_COLUMNS",
    "get_cipher",
    "is_encrypted",
    "encrypt_secret",
    "decrypt_secret",
    "sweep_row",
    "encryption_status",
]
