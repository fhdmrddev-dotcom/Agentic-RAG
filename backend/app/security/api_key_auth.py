"""Phase 293 (START-02; D-01, D-05, D-06, D-16, D-19; T-293-01, T-293-07, T-293-08) — API keys.

A key is ``srl_live_`` + 256 bits of ``secrets.token_urlsafe``. It is stored ONLY as a SHA-256
digest: a key never needs reading back, so this is a one-way digest and deliberately NOT the
reversible cipher used for connector tokens. The secret exists in exactly one place,
the create response (D-19).

``resolve_api_key`` is the inbound door's only authentication, and it re-checks LIVE state on
every call, in this order (D-05):

    no key -> digest -> lookup -> constant-time compare -> revoked -> expired -> still a member
    of the key's org -> owner not banned

Every failure answers ONE byte-identical 401 body, so a caller cannot tell a revoked key from one
that never existed (D-06). Failures we can attribute (a real key row) also write an
``api_key.refused`` audit row naming the reason, the key id and the label — never the secret or
its digest. An unknown key has no owner to attribute (``audit_log.user_id`` is NOT NULL), so it
is LOGGED with a 12-character fingerprint and nothing else (T-293-08 / T-293-09).

⚠ ``_is_banned`` fails OPEN by design. It is safe here only because the membership check above it
does not — never make the ban the only gate (RESEARCH pitfall 11).

This is a separate module from ``dependencies.py`` (a G-5-firing hot file) on purpose: the inbound
door shares no code path with the browser's Supabase-session authentication.
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import re
import secrets
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Literal

import asyncpg
from fastapi import BackgroundTasks, Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app import dependencies as deps
from app.db import api_keys as api_keys_db
from app.dependencies import get_pg_pool, get_redis, get_service_role_supabase
from app.services.audit_service import write_audit_entry

logger = logging.getLogger(__name__)

KEY_PREFIX = "srl_live_"
_MAX_PRESENTED_LEN = 128
_KEY_BODY = re.compile(r"[A-Za-z0-9_-]+")

NO_KEY_DETAIL = "This call has no API key. Send one as `Authorization: Bearer <key>`."
INVALID_KEY_DETAIL = "This API key is not valid. It may have been revoked or have expired."

# The named scheme is how the public spec documents key auth: FastAPI emits it under
# components.securitySchemes.ApiKey and on every operation that depends on it.
# auto_error=False: an absent header must reach our own sentence, not FastAPI's default 403.
_key_bearer_scheme = HTTPBearer(
    auto_error=False,
    scheme_name="ApiKey",
    description=(
        "An API key made in Settings → API keys (`srl_live_…`), sent as "
        "`Authorization: Bearer <key>`. Starts only the published workflows it lists; runs as "
        "the member who made it."
    ),
)


@dataclass(frozen=True)
class MintedKey:
    secret: str
    key_hash: str
    key_prefix: str


@dataclass(frozen=True)
class ResolvedKey:
    id: str
    org_id: str
    user_id: str
    label: str
    workflows: list
    expires_at: datetime | None


def mint_key() -> MintedKey:
    """A new key: the secret (shown once), its SHA-256 hex digest (stored) and its display
    prefix (``srl_live_`` + 4 characters)."""
    secret = KEY_PREFIX + secrets.token_urlsafe(32)
    return MintedKey(
        secret=secret,
        key_hash=hashlib.sha256(secret.encode()).hexdigest(),
        key_prefix=secret[:13],
    )


def digest_key(presented: str) -> str | None:
    """The digest of a presented key, or ``None`` if it cannot be one of ours.

    A malformed string is refused here, before any database read: wrong prefix, longer than 128
    characters, or anything outside the urlsafe alphabet ``token_urlsafe`` produces.
    """
    if not presented or len(presented) > _MAX_PRESENTED_LEN:
        return None
    if not presented.startswith(KEY_PREFIX):
        return None
    if not _KEY_BODY.fullmatch(presented[len(KEY_PREFIX):]):
        return None
    return hashlib.sha256(presented.encode()).hexdigest()


def _invalid() -> HTTPException:
    return HTTPException(status_code=401, detail=INVALID_KEY_DETAIL)


def _call_kind(request: Request) -> Literal["start", "read"]:
    """A POST to the inbound door starts a run; anything else reads one."""
    return "start" if request.method.upper() == "POST" else "read"


def _audit_args(
    key: ResolvedKey | dict,
    *,
    call: str,
    workflow_id: str | None,
    run_id: str | None,
    outcome: str | None,
    reason: str | None,
    detail: dict | None,
) -> tuple[str, dict[str, Any], str]:
    """(user_id, metadata, org_id) for one ``api_key.*`` row. Reads ONLY id, label, owner and org
    from ``key`` — never the secret (it is never handed one) and never ``key_hash``."""
    if isinstance(key, ResolvedKey):
        key_id, label, user_id, org_id = key.id, key.label, key.user_id, key.org_id
    else:
        key_id, label = key.get("id"), key.get("label")
        user_id, org_id = key.get("user_id"), key.get("org_id")
    metadata: dict[str, Any] = {
        "api_key_id": str(key_id) if key_id is not None else None,
        "api_key_label": label,
        "call": call,
        "workflow_id": str(workflow_id) if workflow_id is not None else None,
        "run_id": str(run_id) if run_id is not None else None,
        "outcome": outcome,
        "reason": reason,
        "detail": detail,
    }
    return str(user_id), {k: v for k, v in metadata.items() if v is not None}, str(org_id)


def audit_key_call(
    background_tasks: BackgroundTasks,
    key: ResolvedKey | dict,
    action_type: str,
    *,
    call: str,
    workflow_id: str | None = None,
    run_id: str | None = None,
    outcome: str | None = None,
    reason: str | None = None,
    detail: dict | None = None,
) -> None:
    """Schedule one ``api_key.*`` audit row, attributed to the key's owner in the key's org.

    ``org_id`` is passed EXPLICITLY (a member of two orgs would otherwise be misattributed by
    the autofill trigger).

    ⚠ ONLY FOR A PATH THAT RETURNS NORMALLY. A BackgroundTask added by a handler or dependency
    that then RAISES is discarded with the error response and never runs — measured by
    ``test_293_key_auth.py``, whose refusal-audit cases were RED against exactly that. A path that
    audits and then raises uses ``audit_key_call_now``.
    """
    user_id, metadata, org = _audit_args(
        key, call=call, workflow_id=workflow_id, run_id=run_id,
        outcome=outcome, reason=reason, detail=detail,
    )
    background_tasks.add_task(
        write_audit_entry, user_id, action_type, metadata,
        get_service_role_supabase(org), org_id=org,
    )


async def audit_key_call_now(
    key: ResolvedKey | dict,
    action_type: str,
    *,
    call: str,
    workflow_id: str | None = None,
    run_id: str | None = None,
    outcome: str | None = None,
    reason: str | None = None,
    detail: dict | None = None,
) -> None:
    """Write one ``api_key.*`` audit row BEFORE an error response (see ``audit_key_call``).

    ``write_audit_entry`` swallows and logs its own failures, so awaiting it can delay a refusal
    but can never turn one into a 500.
    """
    user_id, metadata, org = _audit_args(
        key, call=call, workflow_id=workflow_id, run_id=run_id,
        outcome=outcome, reason=reason, detail=detail,
    )
    await write_audit_entry(
        user_id, action_type, metadata, get_service_role_supabase(org), org_id=org
    )


# ── 293-REVIEW CR-02 — refusal audits are counted, then written at most once a minute ───────
# Every refusal by a known key used to await one ``audit_log`` insert, so a replayed revoked key
# (refused before the limiter) or an over-limit flood turned the limiter into a write amplifier.
# Now the FIRST refusal of a (key, reason) in a minute writes its row; the rest are counted in
# ``apikey:refaudit:sup:{key}:{reason}`` and the next written row carries that count as
# ``detail.suppressed``, so the ledger stays honest about how many there were.
#
# Fail-safe: with Redis down it falls back to an in-process window, so each worker still writes at
# most one row per (key, reason, minute) — a CAP, never unbounded and never silent. The fallback
# map is bounded; overflowing it clears it, which can cost one extra row per pair, never a flood.
# It lives HERE, beside the audit writers, and not in ``services/rate_limit.py``: the limiter's
# counts must never be process-local (two workers would admit twice the limit), while this window
# can only ever WITHHOLD an audit row, never admit a call.
_REFUSAL_WINDOW_PREFIX = "apikey:refaudit:"
_SUPPRESSED_PREFIX = "apikey:refaudit:sup:"
_SUPPRESSED_TTL = 30 * 24 * 3600  # the activity window (D-17)
_LOCAL_MAX = 4_096
_local_windows: dict[tuple[str, str], list[int]] = {}


def _local_slot(key_id: str, reason: str, minute: int) -> int | None:
    if len(_local_windows) >= _LOCAL_MAX:
        _local_windows.clear()
    entry = _local_windows.get((key_id, reason))
    if entry is not None and entry[0] == minute:
        entry[1] += 1
        return None
    _local_windows[(key_id, reason)] = [minute, 0]
    return entry[1] if entry is not None else 0


async def refusal_audit_slot(redis, *, key_id: str, reason: str) -> int | None:
    """May this refusal write its audit row? ``None``: no, it was counted. An int: yes, and the
    int is how many refusals of this (key, reason) were suppressed since the last written row."""
    minute = int(time.time()) // 60
    window = f"{_REFUSAL_WINDOW_PREFIX}{key_id}:{reason}:{minute}"
    pending = f"{_SUPPRESSED_PREFIX}{key_id}:{reason}"
    try:
        async with redis.pipeline(transaction=True) as pipe:
            pipe.incr(window)
            pipe.expire(window, 120)
            count, _ = await pipe.execute()
        if count > 1:
            async with redis.pipeline(transaction=True) as pipe:
                pipe.incr(pending)
                pipe.expire(pending, _SUPPRESSED_TTL)
                await pipe.execute()
            return None
        async with redis.pipeline(transaction=True) as pipe:  # GET + DEL in one MULTI (Redis 5+)
            pipe.get(pending)
            pipe.delete(pending)
            suppressed, _ = await pipe.execute()
        return int(suppressed or 0)
    except Exception:  # noqa: BLE001 — Redis down: the per-worker window still caps the writes
        logger.warning("refusal-audit throttle fell back to the in-process window", exc_info=True)
        return _local_slot(key_id, reason, minute)


async def _refuse(row: dict, *, call: str, reason: str, redis) -> HTTPException:
    """Audit one refusal (at most one row per key, reason and minute; 293-REVIEW CR-02), then
    return the one 401. A suppressed refusal is counted and named on the next row it writes."""
    suppressed = await refusal_audit_slot(redis, key_id=str(row.get("id")), reason=reason)
    if suppressed is not None:
        await audit_key_call_now(
            row, "api_key.refused", call=call, reason=reason,
            detail={"suppressed": suppressed} if suppressed else None,
        )
    return _invalid()


async def resolve_api_key(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_key_bearer_scheme),
    pool: asyncpg.Pool = Depends(get_pg_pool),
    redis=Depends(get_redis),
) -> ResolvedKey:
    """Authenticate one inbound call by its API key. Re-checks live state every call (D-05)."""
    if credentials is None or not credentials.credentials:
        raise HTTPException(status_code=401, detail=NO_KEY_DETAIL)
    presented = credentials.credentials
    digest = digest_key(presented)
    if digest is None:
        raise _invalid()

    row = await api_keys_db.get_key_for_auth(pool, digest)
    if row is None:
        # No owner to attribute, so no audit row. The fingerprint names WHICH string a client is
        # retrying without putting the string (or its full digest) in a log.
        logger.info(
            "api key refused: unknown key fp=%s",
            hashlib.sha256(presented.encode()).hexdigest()[:12],
        )
        raise _invalid()
    if not hmac.compare_digest(str(row.get("key_hash", "")), digest):
        raise _invalid()

    call = _call_kind(request)
    if row.get("revoked_at") is not None:
        raise await _refuse(row, call=call, reason="revoked", redis=redis)
    expires_at = row.get("expires_at")
    if expires_at is not None and expires_at <= datetime.now(timezone.utc):
        raise await _refuse(row, call=call, reason="expired", redis=redis)
    if not await api_keys_db.is_org_member(pool, org_id=row["org_id"], user_id=row["user_id"]):
        raise await _refuse(row, call=call, reason="not_member", redis=redis)
    if await deps._is_banned(str(row["user_id"])):
        raise await _refuse(row, call=call, reason="banned", redis=redis)

    try:
        await api_keys_db.touch_last_used(pool, row["id"], org_id=row["org_id"])
    except Exception:  # noqa: BLE001 — a last-used timestamp must never refuse a valid call
        logger.warning("api key last_used_at update failed for key %s", row["id"], exc_info=True)

    return ResolvedKey(
        id=str(row["id"]),
        org_id=str(row["org_id"]),
        user_id=str(row["user_id"]),
        label=row["label"],
        workflows=list(row.get("workflows") or []),
        expires_at=expires_at,
    )
