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

# The 13 secret columns — the 12 provider/API keys verbatim from main.py:125-130
# (_API_KEY_COLUMNS) plus supabase_management_token (Phase 168 / mig 113, D-168-01). This
# module is the SINGLE source of the allowlist going forward; Plan 04 re-points main.py here.
# Adding a name here is all it takes for main.py's boot sweep_row to encrypt that
# app_settings column at rest via the same MultiFernet cipher — no bespoke crypto.
SECRET_COLUMNS: frozenset[str] = frozenset({
    "openai_api_key", "anthropic_api_key", "google_api_key",
    "openrouter_api_key", "ollama_api_key", "deepseek_api_key",
    # SEED-173 (migration 180) — self-hosted endpoints may sit behind real auth (vLLM
    # --api-key, a tunnel bearer token). Those are secrets like any other and MUST be in
    # this set, or they would be the only provider keys stored as plaintext.
    "lmstudio_api_key", "custom_api_key",
    "moonshot_api_key", "minimax_api_key", "zhipu_api_key",
    "embedding_api_key", "rerank_api_key", "tavily_api_key",
    # Phase 168 (SSO — SAML CORE, D-168-01): the Cloud Supabase Management/PAT (sbp_) token the
    # provider-CRUD proxy bears. Encrypted at rest like every other secret; read + decrypted only
    # at call time by sso_provider_service, never logged.
    "supabase_management_token",
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
      - enc:v1:, decryptable by an OLDER key         -> rotate() re-wrap under primary
      - enc:v1: and already under the primary        -> skip (idempotent no-op)
      - enc:v1: but NO configured key can decrypt    -> SKIP (WR-01) + log by name; the
        column can't be rotated, so it is left untouched and the loop CONTINUES sweeping
        the rest. This case is surfaced honestly by encryption_status (columns_unreadable);
        one poisoned column must NEVER abort the whole pass.

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
            # WR-01: guard the rotate. A token NO configured key can decrypt (a key fully
            # removed from the env, or corrupt/tampered ciphertext) makes rotate() raise
            # InvalidToken too. Without this guard that exception would propagate out of
            # sweep_row, DISCARDING every column already queued in `changed` and aborting
            # the whole pass — so the sweep could never converge and the failure recurred
            # identically on every boot, leaving other plaintext columns unencrypted at
            # rest. Record the bad column by NAME only (never the value/token) and CONTINUE
            # so the rest of the row still (re)encrypts. The lingering state is surfaced
            # honestly by encryption_status (columns_unreadable) — one poisoned column must
            # not block encrypting the rest.
            try:
                rotated = cipher.rotate(token).decode()
                changed[col] = f"{_ENVELOPE_PREFIX}{rotated}"
            except InvalidToken:
                logger.error(
                    "secret_cipher: column %s is not decryptable by any configured key; "
                    "cannot rotate -- skipping (surfaced via encryption_status)",
                    col,
                )
                continue

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
      - a key IS active but ZERO secret values are observed (an empty / None row) ->
        {"state": "unknown"} (WR-02). This is NOT green: an empty row means either a
        genuinely secret-less row OR — the dangerous case — a cold-cache / DB-outage where
        _load_settings_from_db() swallowed the error and returned {}. We cannot tell the
        two apart, so we must not claim "encrypted"; the tile renders "unknown" NEUTRAL
        (non-green), never a false-green "Encrypted" during an outage.

    Only counters that are > 0 are included. Empty-string values are ignored
    throughout (an unset secret is neither unreadable nor lingering plaintext).
    """
    cipher = get_cipher()
    if cipher is None:
        return {"state": "plaintext"}

    row = row or {}  # WR-02: tolerate a None/empty row (a cold-cache / DB-blip load).
    columns_unreadable = 0
    columns_plaintext = 0
    columns_seen = 0  # WR-02: how many present, non-empty secret values we actually observed.

    for col in SECRET_COLUMNS:
        value = row.get(col)
        if not isinstance(value, str) or not value:
            continue

        columns_seen += 1
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

    # WR-02: a key is active but we OBSERVED ZERO secret values (an empty / cold-cache
    # row). Reporting "encrypted" here is a false-green — during a DB outage the raw-row
    # load returns {} WITHOUT raising, so the tile would light green while nothing could be
    # read at all. Report the neutral, non-green "unknown" instead; only a populated row of
    # cleanly-decrypting ciphertext is genuinely "encrypted".
    if columns_seen == 0:
        return {"state": "unknown"}

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
