"""Citation check routes (Phase 294-03, DEC-03, D-13..D-17).

  GET  /citation-checks?message_ids=a,b   stored checks the caller may see + engine availability
  POST /citation-checks/{message_id}       run (or re-run) the check for one settled answer

D-13: this is an API route the user triggers, never a tool — nothing runs it automatically and
the tool registry is unchanged.

* Every read goes through the per-request user-JWT client, so RLS decides: a message the caller
  cannot see and a message that does not exist answer the SAME 404 body (T-294-13).
* The claims are derived server-side from the stored message; the request carries nothing to
  judge, and ``message_id`` / ``thread_id`` / ``user_id`` / ``org_id`` are bound from the message
  row the user-JWT read returned, never from the request (T-294-14 / T-294-15).
* A per-message Redis claim (``citation_check:{id}``, SET NX EX 60) refuses a second check while
  one is in flight (409), and is released in ``finally`` only while still owned (T-294-19).
* With the engine off, Cohere / Local, or no key, GET reports ``available: false`` with the
  reason and POST answers 409 with it. There is no chat-model fallback (D-16).
* Responses are the declared Pydantic models: no key and no base URL can appear (T-294-20).
* Blocking supabase-py calls go through ``aexec`` (D-v2.5-01); the engine run (sync, threaded)
  goes through ``run_in_threadpool``.
"""
from __future__ import annotations

import json
import logging
import secrets
from uuid import UUID

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, Query, status
from starlette.concurrency import run_in_threadpool
from supabase import Client

from app.dependencies import get_current_user, get_pg_pool, get_redis, get_user_supabase_client
from app.models.citation_check import (
    CitationCheckAvailabilityOut,
    CitationCheckResult,
    CitationChecksResponse,
)
from app.models.user_settings import load_app_settings_async
from app.services.citation_check_service import (
    CitationCheckUnavailable,
    load_checks,
    run_citation_check,
    upsert_check,
)
from app.services.citation_claims import extract_claims
from app.services.rerank_engines import citation_check_availability
from app.utils.db import aexec, maybe_row

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/citation-checks", tags=["citation-checks"])

MAX_IDS_PER_GET = 100
_INFLIGHT_TTL_S = 60
_MESSAGE_COLUMNS = "id, thread_id, user_id, org_id, role, content, source_refs"

# Compare-and-delete: release the claim only while it still holds OUR token.
_RELEASE_IF_OWNED = """
if redis.call('get', KEYS[1]) == ARGV[1] then
    return redis.call('del', KEYS[1])
end
return 0
"""


def _inflight_key(message_id: str) -> str:
    return f"citation_check:{message_id}"


def _not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")


def _availability_out(user_settings) -> CitationCheckAvailabilityOut:
    a = citation_check_availability(user_settings)
    return CitationCheckAvailabilityOut(available=a.available, engine=a.engine, reason=a.reason)


def _parse_ids(raw: str) -> list[str]:
    ids = [part.strip() for part in raw.split(",") if part.strip()]
    if len(ids) > MAX_IDS_PER_GET:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail=f"At most {MAX_IDS_PER_GET} message ids per request")
    out: list[str] = []
    for part in ids:
        try:
            canonical = str(UUID(part))
        except ValueError:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                                detail="message_ids must be uuids") from None
        if canonical not in out:
            out.append(canonical)
    return out


def _has_passage(refs) -> bool:
    if isinstance(refs, str):
        try:
            refs = json.loads(refs)
        except ValueError:
            return False
    if not isinstance(refs, list):
        return False
    return any(isinstance(r, dict) and isinstance(r.get("passage"), str) and r["passage"].strip() for r in refs)


@router.get("", response_model=CitationChecksResponse)
async def get_citation_checks(
    message_ids: str = Query(..., description="Comma-separated assistant message ids (at most 100)"),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
) -> CitationChecksResponse:
    ids = _parse_ids(message_ids)
    availability = _availability_out(await load_app_settings_async())
    checks = await load_checks(supabase, ids)
    return CitationChecksResponse(availability=availability, checks=checks)


@router.post("/{message_id}", response_model=CitationCheckResult)
async def post_citation_check(
    message_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
    pool=Depends(get_pg_pool),
    redis: aioredis.Redis = Depends(get_redis),
) -> CitationCheckResult:
    try:
        message_id = str(UUID(message_id))
    except ValueError:
        raise _not_found() from None

    resp = await aexec(
        supabase.table("messages").select(_MESSAGE_COLUMNS).eq("id", message_id).maybe_single()
    )
    row = maybe_row(resp)
    if not row:
        raise _not_found()
    if row.get("role") != "assistant":
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="Only an assistant answer can be checked")
    if not _has_passage(row.get("source_refs")):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="This answer has no citation passages to check")
    refs = row.get("source_refs")
    if isinstance(refs, str):
        refs = json.loads(refs)
    if not extract_claims(row.get("content") or "", refs):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="This answer has no cited claims to check")

    user_settings = await load_app_settings_async()
    availability = citation_check_availability(user_settings)
    if not availability.available:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"reason": availability.reason})

    token = secrets.token_hex(16)
    key = _inflight_key(message_id)
    claimed = await redis.set(key, token, nx=True, ex=_INFLIGHT_TTL_S)
    if not claimed:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"reason": "in_flight"})
    try:
        try:
            result = await run_in_threadpool(run_citation_check, row, user_settings)
        except CitationCheckUnavailable as exc:   # settings changed between the check and the run
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"reason": exc.reason}) from None
        stored = await upsert_check(pool, row, result)
        return CitationCheckResult.model_validate(stored["result"])
    finally:
        try:
            await redis.eval(_RELEASE_IF_OWNED, 1, key, token)
        except Exception as exc:  # noqa: BLE001 — the 60 s TTL is the backstop
            logger.warning("citation check in-flight release failed for message %s (%s)",
                           message_id, type(exc).__name__)
