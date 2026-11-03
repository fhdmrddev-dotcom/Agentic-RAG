"""Phase 307 (OAUTH-05; D-45; T-307-02, T-307-08, T-307-10) — OAuth's single-use state in Redis.

| Key | Value | TTL | Consumed |
|---|---|---|---|
| ``oauth:req:{uuid4}`` | the authorize request (JSON) | 600 s | peeked by the consent page; TAKEN by approve / deny |
| ``oauth:code:{sha256(code)}`` | the code's binding (JSON) | 60 s | TAKEN once at ``/oauth/token`` |
| ``oauth:codeused:{sha256(code)}`` | the grant id | 600 s | a later miss that finds this revokes the grant |
| ``oauth:cimdfail:{sha256(client_id)}`` | ``"1"`` | 60 s | negative cache for an unreadable CIMD document |

⚠ **EVERY TAKE IS ONE ``MULTI`` GET+DEL** (``pipeline(transaction=True)``), so two concurrent takes
get exactly one value — the shape ``api_key_auth.py``'s file-token take uses. ``services/oauth_state``
(the connectors flow) does its read and its delete as two round trips; that is not reused (P-2).

⚠ **NO PLAINTEXT SECRET IS EVER A KEY OR A VALUE.** A code is keyed by its SHA-256; a request id is
a random ``uuid4`` (122 bits, never guessable, P-10) validated by a strict pattern before any read.

A Redis failure raises ``OAuthStoreUnavailable``: the caller answers 503 — fail closed.
"""
from __future__ import annotations

import hashlib
import json
import re
import uuid
from typing import Any

REQUEST_TTL_SECONDS = 600
CODE_TTL_SECONDS = 60
CODE_USED_TTL_SECONDS = 600
CIMD_FAIL_TTL_SECONDS = 60

_REQ = "oauth:req:"
_CODE = "oauth:code:"
_CODE_USED = "oauth:codeused:"
_CIMD_FAIL = "oauth:cimdfail:"

_REQUEST_ID = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}")
_DIGEST = re.compile(r"[0-9a-f]{64}")


class OAuthStoreUnavailable(Exception):
    """Redis could not be read or written. The caller refuses with 503 (fail closed)."""


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def digest_code(code: str) -> str:
    """The SHA-256 hex digest an authorization code is stored under."""
    return _sha256(code)


def _valid_request_id(rid: Any) -> bool:
    return isinstance(rid, str) and bool(_REQUEST_ID.fullmatch(rid))


def _valid_digest(digest: Any) -> bool:
    return isinstance(digest, str) and bool(_DIGEST.fullmatch(digest))


def _loads(raw: Any) -> dict | None:
    if raw is None:
        return None
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8")
    try:
        value = json.loads(raw)
    except (TypeError, ValueError):
        return None
    return value if isinstance(value, dict) else None


async def _guard(awaitable):
    try:
        return await awaitable
    except OAuthStoreUnavailable:
        raise
    except Exception as exc:  # noqa: BLE001 — RedisError, ConnectionError, TimeoutError, OSError
        raise OAuthStoreUnavailable() from exc


async def _take(redis, key: str) -> Any:
    async def run():
        async with redis.pipeline(transaction=True) as pipe:
            pipe.get(key)
            pipe.delete(key)
            value, _ = await pipe.execute()
        return value

    return await _guard(run())


# ── pending authorize requests ────────────────────────────────────────────────────────────────


async def save_request(redis, record: dict) -> str:
    """Store one authorize request for 600 s under a fresh lowercase ``uuid4``; return the id."""
    rid = str(uuid.uuid4())
    await _guard(redis.setex(_REQ + rid, REQUEST_TTL_SECONDS, json.dumps(record, separators=(",", ":"))))
    return rid


async def save_refused_request(redis, *, reason: str, host: str | None) -> str:
    """Store a REFUSED request: the reason and the parsed host only — never raw client input."""
    return await save_request(redis, {"status": "refused", "reason": reason, "host": host})


async def peek_request(redis, rid: Any) -> dict | None:
    """Read a pending request WITHOUT consuming it (the consent page). ``None`` for a malformed
    id (no Redis call), an unknown or expired one."""
    if not _valid_request_id(rid):
        return None
    return _loads(await _guard(redis.get(_REQ + rid)))


async def take_request(redis, rid: Any) -> dict | None:
    """Consume a pending request — one MULTI GET+DEL, so it can be approved or denied once."""
    if not _valid_request_id(rid):
        return None
    return _loads(await _take(redis, _REQ + rid))


# ── authorization codes ───────────────────────────────────────────────────────────────────────


async def save_code(redis, *, code_digest: str, record: dict) -> None:
    """Store a code's binding for 60 s under its digest (never the code)."""
    if not _valid_digest(code_digest):
        raise ValueError("code_digest must be a SHA-256 hex digest")
    await _guard(
        redis.setex(_CODE + code_digest, CODE_TTL_SECONDS, json.dumps(record, separators=(",", ":")))
    )


async def take_code(redis, code_digest: str) -> dict | None:
    """Consume a code — one MULTI GET+DEL. On success, mark it used (600 s, the grant id) so a
    replay is recognised as one and the grant it bought can be revoked."""
    if not _valid_digest(code_digest):
        return None
    record = _loads(await _take(redis, _CODE + code_digest))
    if record is not None:
        await _guard(
            redis.setex(_CODE_USED + code_digest, CODE_USED_TTL_SECONDS, str(record.get("grant_id") or ""))
        )
    return record


async def code_was_used(redis, code_digest: str) -> str | None:
    """The grant id a code already bought, if it was taken in the last 600 s; else ``None``."""
    if not _valid_digest(code_digest):
        return None
    value = await _guard(redis.get(_CODE_USED + code_digest))
    if isinstance(value, bytes):
        value = value.decode("utf-8")
    return value or None


# ── the CIMD negative cache ───────────────────────────────────────────────────────────────────


async def cimd_failed(redis, client_id: str) -> bool:
    """True when this CIMD URL failed in the last 60 s (do not fetch it again yet)."""
    return bool(await _guard(redis.get(_CIMD_FAIL + _sha256(client_id))))


async def mark_cimd_failed(redis, client_id: str) -> None:
    await _guard(redis.setex(_CIMD_FAIL + _sha256(client_id), CIMD_FAIL_TTL_SECONDS, "1"))
