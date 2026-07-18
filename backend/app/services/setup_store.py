"""Phase 158 (DEPLOY-02, Plan 03) — the first-run setup-store file authority.

The blip-proof infra-tier persistence for the install wizard (D-01/D-02/D-05/D-15):

* ``/data/setup.json`` (0600, atomic ``tmp + os.replace``) holds the infra tier + the
  finalize marker + the first-boot setup token + ``OPERATOR_EMAILS``.
* ``setup_finalized()`` is the GATE AUTHORITY — a monotonic sticky-True latch backed by
  the local FILE marker, NEVER a live DB read (a DB blip must never bounce live users back
  into the wizard, D-05).
* the setup token is a 256-bit ``secrets`` CSPRNG value, constant-time verified with
  ``hmac`` (D-15), and NEVER logged beyond the single boot announcement
  (``announce_token_if_unfinalized``).

The store path is read LAZILY from ``SETUP_STORE_PATH`` (default ``/data/setup.json``) on
every access — mirroring ``secret_cipher._load_keys`` (:55) — so tests can monkeypatch the
boundary (the ``setup_store_path`` conftest fixture) without an import-order trap. This is
also why the store contents are never cached: only the finalize marker is latched, because
it is monotonic (a box never un-finalizes via the wizard).
"""
from __future__ import annotations

import hmac
import json
import logging
import os
import tempfile
import secrets
from pathlib import Path

logger = logging.getLogger(__name__)

# D-01 infra tier — the ONLY keys the config overlay sources from the store. App-level keys
# (provider API keys, ``operator_emails`` as an app read, model pins, retrieval knobs) live
# in ``app_settings`` and are NEVER overridden by the store.
INFRA_KEYS: tuple[str, ...] = (
    "supabase_url",
    "supabase_anon_key",
    "supabase_service_role_key",
    "supabase_publishable_key",
    "supabase_secret_key",
    "postgres_dsn",
    "redis_url",
    "secrets_encryption_key",
)

_DEFAULT_STORE_PATH = "/data/setup.json"

# Monotonic finalized latch (D-05 / RESEARCH Pattern 4): once the FILE marker reads
# ``finalized:true``, cache True in this per-process global and never touch the file again —
# a box never un-finalizes via the wizard, so the byte-identical hot path is one bool.
_finalized_latch = False


def _store_path() -> Path:
    """Resolve the store path LAZILY from the env on every call (tests monkeypatch it)."""
    return Path(os.getenv("SETUP_STORE_PATH", _DEFAULT_STORE_PATH))


def read_store() -> dict:
    """Return the parsed setup-store, or ``{}`` on ANY read/parse error (a fresh box).

    A missing file, a corrupt/partial JSON, or an unreadable path all resolve to an empty
    store — the config overlay + entry check treat "no store" as "unconfigured", never a
    hard error (setup-mode tolerance, D-03).
    """
    try:
        return json.loads(_store_path().read_text())
    except Exception:  # noqa: BLE001 — missing / corrupt / unreadable store => treat as empty
        return {}


def write_store(data: dict) -> None:
    """Persist ``data`` atomically (tmp + ``os.replace``) with 0600 perms — never a partial file.

    The temp file is created in the store's OWN directory so ``os.replace`` is an atomic
    same-filesystem rename; 0600 is applied to the temp file BEFORE the rename so the final
    path is never briefly world-readable (T-158-09). A failure cleans up the temp file so a
    0600 fragment is never leaked.
    """
    path = _store_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=str(path.parent))
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(data, f)
        os.chmod(tmp, 0o600)
        os.replace(tmp, path)  # atomic rename — 0600, never a partial read
    except Exception:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def _is_placeholder(v: str | None) -> bool:
    """True for an empty value or an onebox ``<project-ref>``-style bracketed placeholder."""
    return (not v) or ("<" in v and ">" in v)


def setup_finalized() -> bool:
    """The blip-proof GATE AUTHORITY: has first-run setup been finalized?

    Returns the store ``finalized == True`` and latches sticky-True in a per-process global
    — once True it NEVER reads the file again (monotonic; a box does not un-finalize via the
    wizard). Reads ONLY the local FILE marker, NEVER the DB (D-05): a transient DB outage
    must never bounce a live box's users back into the wizard.
    """
    global _finalized_latch
    if _finalized_latch:
        return True
    if read_store().get("finalized") is True:
        _finalized_latch = True
    return _finalized_latch


def get_or_create_token() -> str:
    """Return the persisted first-boot setup token, minting + persisting one on first call.

    A 256-bit ``secrets``-module CSPRNG value (see the call below). Idempotent — a second
    call returns the SAME token (the operator reads it once from the logs; the finalize
    lock, not token rotation, is the real security boundary — D-15).

    WR-02 (WORKER_COUNT=2): after minting, RE-READ the store and return the PERSISTED value.
    If two workers boot together and both mint (the read-modify-write is not cross-process
    atomic), the re-read makes each worker converge on the same last-persisted token, so the
    logs announce a token that ``verify_token`` will actually accept — instead of one worker
    announcing a stale candidate that 401s. (A full OS-level file lock / ``O_EXCL`` sentinel
    would close the residual write-write window entirely — a noted follow-up; the finalize
    lock stays the real security boundary, so this is a UX/robustness improvement.)
    """
    store = read_store()
    tok = store.get("setup_token")
    if tok:
        return tok
    candidate = secrets.token_urlsafe(32)
    store["setup_token"] = candidate
    write_store(store)
    return read_store().get("setup_token") or candidate  # honor the race winner


def announce_token_if_unfinalized() -> None:
    """Log the setup token ONCE per unfinalized boot — the ONLY place the token is logged.

    Called from the lifespan when in setup mode. Surfaced by ``docker compose logs
    backend`` (the n8n/Jupyter idiom): the operator reads it and supplies it on every
    ``/setup/*`` write. NEVER log the token — or any store secret — anywhere else
    (D-15 / T-158-04). A finalized box announces nothing.
    """
    if setup_finalized():
        return
    logger.warning("FIRST-RUN SETUP TOKEN (needed at /setup): %s", get_or_create_token())


def verify_token(supplied: str | None) -> bool:
    """Constant-time compare ``supplied`` against the persisted token (D-15).

    A constant-time ``hmac`` comparison defeats a timing side-channel (T-158-08
    brute-force); a missing/empty token is rejected without a compare.
    """
    if not supplied:
        return False
    return hmac.compare_digest(supplied, get_or_create_token())


def finalize(payload: dict) -> None:
    """Merge the infra tier + ``operator_emails`` + ``finalized:true`` into the store, atomically.

    The file half of the dual finalize marker (D-05) — used by the finalize endpoint
    (158-06). Preserves the existing store (the token, any prior values) and overlays: the
    enumerated ``INFRA_KEYS`` present + truthy in ``payload``, an optional
    ``operator_emails`` (so a later boot's ``seed_operators_from_env`` can re-seed), and the
    ``finalized`` marker (the blip-proof gate authority). NEVER logs the merged secrets.
    """
    store = read_store()
    for k in INFRA_KEYS:
        if payload.get(k):
            store[k] = payload[k]
    if payload.get("operator_emails"):
        store["operator_emails"] = payload["operator_emails"]
    store["finalized"] = True
    write_store(store)
