"""Phase 306-02 (GUARD-01; D-05, D-16, D-17, D-35) — admission for OUTSIDE starts, and
idempotency claims.

An outside start (an MCP ``ask_agent`` / ``run_workflow``, an ``/inbound`` workflow start) takes a
LEASE before it runs. A lease is a member of three Redis sorted sets, one per scope:

    {adm}:org:<org id>   {adm}:cred:<credential id>   {adm}:prov:<provider>

with the lease id as the member and its own expiry time as the score. One Lua script drops expired
members, checks all three counts against the operator's limits (``app_settings``
``outside_inflight_per_org`` / ``_per_key`` / ``_per_provider``) and, only when all three have room,
adds the lease to all three. So the check and the take are one atomic step across both uvicorn
workers. The ``{adm}`` hash tag keeps the three keys in one slot, so the script also runs on a
clustered Redis.

D-35: ⛔ never a counter with a refreshed TTL (``task_service``'s shape). Under load its one TTL is
pushed forward on every start, so a slot a crashed worker held never clears. Here every lease
carries its own expiry (ask 900 s, run = the inbound max duration + 60 s), so a crashed worker's
capacity comes back by itself, and ``release`` gives it back at once on a normal end.

D-17: FAIL CLOSED. Any Redis error (or settings read error) while taking a lease or claiming an
idempotency key raises ``OutsideStartUnavailable``; the caller refuses the start. Nothing in the
in-app chat or kickoff path imports this module (D-16), so in-app use never meets the check and
keeps working when Redis does not.

D-05: an idempotency claim is ``SET NX EX 86400`` on ``mcp:idem:<credential id>:<sha256(tool + NUL +
key)>``. The client's string is hashed, so it is never a Redis key name and never reaches a log
(T-306-16); the credential id is in the key, so another credential's same string is independent
(T-306-20). A failed start drops its claim, so a refusal never blocks the retry for a day.

D-PRD-12: every cross-worker fact lives in Redis. This module keeps no in-process state.

⚠ The default limits (2 per key, 4 per org, 6 per provider) and the retry hints (15 s / 30 s) are
ASSUMPTIONS, sized against the asyncpg pool (``max_size=10`` per worker). The D-21 burst re-measures
them; they are operator knobs, so tuning needs no commit.
"""
from __future__ import annotations

import hashlib
import json
import logging
import time
from dataclasses import dataclass
from typing import Literal

from app.models.user_settings import load_app_settings_async

logger = logging.getLogger(__name__)

Scope = Literal["org", "credential", "provider"]

# Lease lifetimes. RUN_LEASE_TTL_S is the inbound door's _DEFAULT_MAX_DURATION (1800) + 60; a unit
# test pins the equality, so the two cannot drift (this module never imports app.api).
ASK_LEASE_TTL_S = 900
RUN_LEASE_TTL_S = 1860
ASK_RETRY_S = 15
RUN_RETRY_S = 30
IDEM_TTL_S = 86400

# The audit reasons (D-19): one vocabulary, ``api_key.refused`` with the reason as metadata.
REASON: dict[str, str] = {
    "org": "admission:org",
    "credential": "admission:credential",
    "provider": "admission:provider",
}
UNAVAILABLE_REASON = "admission_unavailable"

# UI-SPEC §Surface 4 "Admission and switches", verbatim. ``{retry}`` is the seconds.
MCP_FULL_SENTENCE: dict[str, str] = {
    "credential": (
        "Too many questions and runs are already in progress for this key. "
        "Try again in {retry} seconds."
    ),
    "org": (
        "Too many questions and runs are already in progress in this organisation. "
        "Try again in {retry} seconds."
    ),
    "provider": "The AI provider is busy with other outside requests. Try again in {retry} seconds.",
}
INBOUND_FULL_SENTENCE: dict[str, str] = {
    "credential": "Too many runs are already in progress for this key. Try again in {retry} seconds.",
    "org": (
        "Too many runs are already in progress in this organisation. "
        "Try again in {retry} seconds."
    ),
    "provider": "The AI provider is busy with other outside requests. Try again in {retry} seconds.",
}

# KEYS: {adm}:org:<org>  {adm}:cred:<key>  {adm}:prov:<provider>
# ARGV: now, ttl, lease_id, lim_org, lim_cred, lim_prov
# Returns {0} when admitted, else {i} for the first full key (1 org, 2 credential, 3 provider).
# A key's own life is only ever EXTENDED: an ask lease (900 s) taken after a run lease (1860 s)
# must not let the key vanish while the run is still counted.
_ACQUIRE = """
for i = 1, 3 do redis.call('ZREMRANGEBYSCORE', KEYS[i], '-inf', ARGV[1]) end
for i = 1, 3 do
  if redis.call('ZCARD', KEYS[i]) >= tonumber(ARGV[3 + i]) then return {i} end
end
local life = tonumber(ARGV[2]) + 60
for i = 1, 3 do
  redis.call('ZADD', KEYS[i], tonumber(ARGV[1]) + tonumber(ARGV[2]), ARGV[3])
  if redis.call('TTL', KEYS[i]) < life then redis.call('EXPIRE', KEYS[i], life) end
end
return {0}
"""

_SCOPE_BY_INDEX: dict[int, Scope] = {1: "org", 2: "credential", 3: "provider"}


class OutsideStartUnavailable(Exception):
    """Redis (or the limits read) could not answer. The caller refuses the start: FAIL CLOSED."""


@dataclass(frozen=True)
class Admitted:
    lease_id: str


@dataclass(frozen=True)
class Full:
    scope: Scope
    retry_s: int


def _keys(org_id, credential_id, provider) -> tuple[str, str, str]:
    return (
        "{adm}:org:" + str(org_id),
        "{adm}:cred:" + str(credential_id),
        "{adm}:prov:" + str(provider or "unknown"),
    )


async def acquire(
    redis, *, org_id, credential_id, provider: str | None, lease_id: str, ttl_s: int,
    retry_s: int,
) -> Admitted | Full:
    """Take one lease in all three scopes, or name the first full one. Raises
    ``OutsideStartUnavailable`` on any Redis or settings failure (fail closed)."""
    k_org, k_cred, k_prov = _keys(org_id, credential_id, provider)
    try:
        s = await load_app_settings_async()
        lim_org = int(s.outside_inflight_per_org)
        lim_cred = int(s.outside_inflight_per_key)
        lim_prov = int(s.outside_inflight_per_provider)
        answer = await redis.eval(
            _ACQUIRE, 3, k_org, k_cred, k_prov,
            repr(time.time()), int(ttl_s), lease_id, lim_org, lim_cred, lim_prov,
        )
        index = int(answer[0])
    except Exception as exc:  # noqa: BLE001 — any failure refuses; see the module docblock
        logger.warning(
            "outside admission unavailable for credential %s; refusing the start (%s)",
            credential_id, type(exc).__name__,
        )
        raise OutsideStartUnavailable() from exc
    if index == 0:
        return Admitted(lease_id=lease_id)
    return Full(scope=_SCOPE_BY_INDEX[index], retry_s=int(retry_s))


async def release(redis, *, org_id, credential_id, provider: str | None, lease_id: str) -> None:
    """Give a lease back in all three scopes. Never raises: the lease's own expiry is the backstop."""
    for key in _keys(org_id, credential_id, provider):
        try:
            await redis.zrem(key, lease_id)
        except Exception as exc:  # noqa: BLE001 — the per-member expiry frees it later
            logger.warning(
                "outside admission release failed for credential %s (%s); the lease expires "
                "by itself", credential_id, type(exc).__name__,
            )


# ── idempotency (D-05) ──────────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class Claimed:
    """This call owns the key: start the run, then ``bind`` (or ``drop`` on a failed start)."""


@dataclass(frozen=True)
class Starting:
    """Another call with this key is starting right now."""


@dataclass(frozen=True)
class Existing:
    """This key already started a run. ``same_request`` is False when the first call asked
    something else (the caller says so and returns the first run)."""

    run_id: str
    same_request: bool


def idem_redis_key(credential_id, tool: str, idempotency_key: str) -> str:
    digest = hashlib.sha256(f"{tool}\0{idempotency_key}".encode("utf-8")).hexdigest()
    return f"mcp:idem:{credential_id}:{digest}"


def _log_ref(credential_id, tool: str, idempotency_key: str) -> str:
    """The credential id and a hash prefix: never the client's string (T-306-16)."""
    return f"credential {credential_id} idem {idem_redis_key(credential_id, tool, idempotency_key)[-64:][:12]}"


async def claim(
    redis, *, credential_id, tool: str, idempotency_key: str, request_sha: str,
) -> Claimed | Starting | Existing:
    """Claim ``idempotency_key`` for this credential and tool, or report who holds it. Raises
    ``OutsideStartUnavailable`` on any Redis failure (fail closed)."""
    key = idem_redis_key(credential_id, tool, idempotency_key)
    value = json.dumps({"state": "starting", "request_sha": request_sha})
    try:
        for _ in range(2):  # a holder that expires between SET and GET gets one more try
            if await redis.set(key, value, nx=True, ex=IDEM_TTL_S):
                return Claimed()
            raw = await redis.get(key)
            if raw is not None:
                break
        else:
            return Starting()
    except Exception as exc:  # noqa: BLE001 — any failure refuses; see the module docblock
        logger.warning("idempotency claim unavailable for %s; refusing the start (%s)",
                       _log_ref(credential_id, tool, idempotency_key), type(exc).__name__)
        raise OutsideStartUnavailable() from exc
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8", "replace")
    try:
        held = json.loads(raw)
    except (TypeError, ValueError):
        return Starting()
    run_id = held.get("run_id") if isinstance(held, dict) else None
    if not run_id:
        return Starting()
    return Existing(run_id=str(run_id), same_request=held.get("request_sha") == request_sha)


async def bind(
    redis, *, credential_id, tool: str, idempotency_key: str, run_id, request_sha: str,
) -> None:
    """Record the started run on a held claim (``SET XX``, so an expired claim is not revived).
    Never raises: the run already started. A failed bind leaves the claim reading ``starting``
    until its TTL, so it is dropped instead, letting a retry start rather than wait a day."""
    key = idem_redis_key(credential_id, tool, idempotency_key)
    value = json.dumps({"state": "started", "run_id": str(run_id), "request_sha": request_sha})
    try:
        await redis.set(key, value, xx=True, ex=IDEM_TTL_S)
    except Exception as exc:  # noqa: BLE001 — see the docstring
        logger.warning("idempotency bind failed for %s (%s); dropping the claim",
                       _log_ref(credential_id, tool, idempotency_key), type(exc).__name__)
        await drop(redis, credential_id=credential_id, tool=tool, idempotency_key=idempotency_key)


async def drop(redis, *, credential_id, tool: str, idempotency_key: str) -> None:
    """Drop a claim after a failed or refused start. Never raises."""
    try:
        await redis.delete(idem_redis_key(credential_id, tool, idempotency_key))
    except Exception as exc:  # noqa: BLE001 — the claim's TTL is the backstop
        logger.warning("idempotency drop failed for %s (%s)",
                       _log_ref(credential_id, tool, idempotency_key), type(exc).__name__)
