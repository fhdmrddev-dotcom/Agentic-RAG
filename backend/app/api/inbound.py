"""Phase 293 (START-02; D-01, D-02, D-05..D-14, D-16; A1, A2, A3) — the inbound door.

An outside system (n8n, Zapier, a cron script) starts a PUBLISHED workflow with an API key and
reads it back. Three routes and nothing else:

  * ``POST /inbound/workflows/{workflow_id}/runs`` — start. 201 ``{run_id, status}``; the
    caller polls.
  * ``GET /inbound/runs/{run_id}`` — status, final text, steps, end reason, file links.
  * ``GET /inbound/files/{token}`` — one file, once, through a 300 s link (A2).

**Access posture — the primary deliverable of this module.**

  * A KEY, never a session. Every route depends only on ``resolve_api_key`` (the file route on
    its one-time token); the browser's session resolver is never consulted, so a key sent here
    is never forwarded to GoTrue.
  * ONE answer for every miss (D-06). A workflow not on the key, outside the key's org, unknown
    or malformed, and a run this key did not start, all answer the byte-identical
    ``404 {"detail": "Not found."}``. Refusals that reveal nothing about existence (403 the owner
    can no longer run it, 409 unpublished, 422 inputs) are only reached after the key has
    proved the workflow is on its own list.
  * A run is read by the KEY that started it (D-12): ``origin_kind = 'key' AND origin_ref =
    <this key> AND user_id = <its owner>`` in the single access query. The same person's other
    key gets the same 404 as a stranger.
  * The run is the OWNER's (D-07): it starts as the key's owner, in the key's org, in its own
    new thread in the owner's history, through the scheduler's shared unattended core
    (``services/unattended_launch.py``, D-09) with the scheduler's default caps (A1).
  * Untrusted input (D-13). Tools, grants, steps, model and folder scope come ONLY from the
    published definition snapshot the core hands ``create_workflow_run`` (``model=None``,
    exactly as a schedule passes it): **the structure is the enforcement.** Inputs are the
    declared launch fields as text (``validate_inbound_inputs``; every ``_``-prefixed and
    reserved key is refused), ``kickoff_prompt`` is server-composed, and the run carries the
    TRUST-03 flag, so the text a model reads from them arrives inside the untrusted envelope:
    **the envelope is the mitigation.**
  * A paused run is answered in the app, never through a key (D-10). The read names WHO it is
    waiting on and withholds the question.
  * Every start and read is rate-limited per key BEFORE any other work (D-14), and every start,
    read and refusal by a known key writes one audit row with the key id + label and the run
    where there is one (D-16). An audit followed by an error response is AWAITED
    (``audit_key_call_now``): a BackgroundTask added before a raise is discarded.

Not canvas-gated (orchestrator ruling 3): ``/inbound`` is not a canvas surface.
"""
from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone
from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute
from pydantic import BaseModel, ConfigDict, Field, WithJsonSchema

from app.db import api_keys as api_keys_db
from app.dependencies import get_pg_pool, get_redis
from app.security.api_key_auth import (
    ResolvedKey,
    audit_key_call,
    audit_key_call_now,
    refusal_audit_slot,
    resolve_api_key,
)
from app.services.inbound_inputs import (
    BODY_TOO_LARGE_DETAIL,
    INBOUND_MAX_BODY_BYTES,
    UNTRUSTED_FLAG,
    inbound_kickoff,
)
# 306-01 (D-39, D-12): the read shape, its wire models and the link constants moved to
# key_run_read.py; re-exported here as the SAME objects (public OpenAPI names unchanged).
from app.services.key_run_read import (  # noqa: F401 — re-export (306-01, D-39)
    _DOWNLOAD_PREFIX,
    _DOWNLOAD_TTL,
    InboundFile,
    InboundRunRead,
    InboundStep,
    InboundWaitingOn,
    read_key_run,
)
# 306-01 (D-39, D-11): the start validation order moved to key_run_start.py.
from app.services.key_run_start import KeyStartRefusal, validate_key_start
from app.services.rate_limit import enforce_ip_limit, enforce_key_limit

logger = logging.getLogger(__name__)



class _BodyCapRoute(APIRoute):
    """296-06 (293-IN-03): refuse an oversize body with 413 from its ``Content-Length`` header,
    BEFORE FastAPI reads and parses it (a dependency or the handler would run after the read).
    The cap is ``INBOUND_MAX_BODY_BYTES``, derived from the per-field caps. A request with no
    body (every GET here) carries no length and passes untouched."""

    def get_route_handler(self):
        handler = super().get_route_handler()

        async def capped(request: Request):
            size = request.headers.get("content-length", "")
            if size.isdigit() and int(size) > INBOUND_MAX_BODY_BYTES:
                return JSONResponse(status_code=413, content={"detail": BODY_TOO_LARGE_DETAIL})
            # 296 SECURITY AR-05: no length (a chunked body) → count it as it streams and stop
            # at the cap; production's API has no proxy body limit in front of it.
            if not size.isdigit() and request.method in ("POST", "PUT", "PATCH"):
                chunks, total = [], 0
                async for chunk in request.stream():
                    total += len(chunk)
                    if total > INBOUND_MAX_BODY_BYTES:
                        return JSONResponse(status_code=413, content={"detail": BODY_TOO_LARGE_DETAIL})
                    chunks.append(chunk)
                request._body = b"".join(chunks)  # Starlette's cache: .body()/.json() read it back
            return await handler(request)

        return capped


router = APIRouter(prefix="/inbound", tags=["inbound"], route_class=_BodyCapRoute)

# A1 — the scheduler's defaults: an inbound run is equally unattended.
_DEFAULT_MAX_TOKENS = 500_000
_DEFAULT_MAX_DURATION = 1_800
# A2 — the one-time link's TTL and key prefix live with the read (key_run_read.py).
_TOKEN_RE = re.compile(r"[A-Za-z0-9_-]{16,64}")

CANNOT_RUN_DETAIL = "The key's owner can no longer run this workflow."
UNPUBLISHED_DETAIL = (
    "This workflow is no longer published, so it can't be started. Publish it again in the app."
)


# ── wire models ─────────────────────────────────────────────────────────────────────────────

# Declared as text in the public spec. Validation is the server's own, so a non-text value is
# refused with the house sentence (and audited) rather than with a framework error.
_TextInputs = Annotated[
    dict[str, Any],
    WithJsonSchema({"type": "object", "additionalProperties": {"type": "string"}}),
]


class InboundStartBody(BaseModel):
    """The declared launch fields, as text. Nothing else is accepted."""

    model_config = ConfigDict(extra="forbid")

    inputs: _TextInputs = Field(default_factory=dict)


class InboundStartResult(BaseModel):
    run_id: str
    status: str


# InboundStep / InboundFile / InboundWaitingOn / InboundRunRead: defined in key_run_read.py,
# re-exported above (306-01).


# ── SQL (explicit columns, explicit owner / org predicates — the pool bypasses RLS) ──────────

# The scoped existence read (`_SCOPE_SQL`) lives with the start validation (key_run_start.py).

# THE access query (D-12). id, origin and owner travel together, so every miss is one miss.
_RUN_ACCESS_SQL = (
    "SELECT id, thread_id, status, user_id, org_id, definition_snapshot FROM workflow_runs "
    "WHERE id = $1 AND origin_kind = 'key' AND origin_ref = $2 AND user_id = $3"
)

_RUN_THREAD_SQL = (
    "SELECT thread_id FROM workflow_runs "
    "WHERE id = $1 AND origin_kind = 'key' AND origin_ref = $2 AND user_id = $3"
)

# The read's phase / end-reason / display-name / files SQL live with it (key_run_read.py).

# The link's key, by id. Owner-agnostic BY DESIGN, like `get_key_for_auth`: the one-time token
# is the credential, and every live check runs on the row this returns.
_LINK_KEY_SQL = (
    "SELECT id, org_id, user_id, label, revoked_at, expires_at FROM api_keys WHERE id = $1"
)


def _not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found.")


def _as_uuid(value: Any) -> UUID | None:
    try:
        return value if isinstance(value, UUID) else UUID(str(value))
    except (ValueError, TypeError, AttributeError):
        return None


async def _refused(
    key: ResolvedKey | dict, *, call: str, reason: str, exc: HTTPException, redis,
    workflow_id: str | None = None, run_id: str | None = None, detail: dict | None = None,
) -> HTTPException:
    """Audit one refusal NOW (an error response discards background tasks), return ``exc``.

    293-REVIEW CR-02: at most one row per key, reason and minute (``refusal_audit_slot``); the
    rest are counted and the next written row names how many as ``detail.suppressed``.
    """
    key_id = key.id if isinstance(key, ResolvedKey) else key.get("id")
    suppressed = await refusal_audit_slot(redis, key_id=str(key_id), reason=reason)
    if suppressed is None:
        return exc
    if suppressed:
        detail = {**(detail or {}), "suppressed": suppressed}
    await audit_key_call_now(
        key, "api_key.refused", call=call, workflow_id=workflow_id, run_id=run_id,
        outcome="refused", reason=reason, detail=detail,
    )
    return exc


async def _client_limit(request: Request, redis=Depends(get_redis)) -> None:
    """293-REVIEW CR-02: the per-client limit, on every /inbound route, BEFORE the key is read."""
    await enforce_ip_limit(redis, client=(request.client.host if request.client else "unknown"))


async def _limit(redis, key: ResolvedKey, kind: str, *, workflow_id: str | None = None,
                 run_id: str | None = None) -> None:
    """The per-key limiter, first. Its 429 (with ``Retry-After``) or 503 is audited, then raised."""
    try:
        await enforce_key_limit(redis, key_id=key.id, kind=kind)
    except HTTPException as exc:
        reason = "over_limit" if exc.status_code == 429 else "limiter_unavailable"
        raise await _refused(key, redis=redis, call=kind, reason=reason, exc=exc,
                             workflow_id=workflow_id, run_id=run_id)


# ── start ───────────────────────────────────────────────────────────────────────────────────


@router.post(
    "/workflows/{workflow_id}/runs",
    status_code=status.HTTP_201_CREATED,
    response_model=InboundStartResult,
    dependencies=[Depends(_client_limit)],
)
async def start_workflow_run(
    workflow_id: str,
    background_tasks: BackgroundTasks,
    body: InboundStartBody | None = None,
    key: ResolvedKey = Depends(resolve_api_key),
    pool: asyncpg.Pool = Depends(get_pg_pool),
    redis=Depends(get_redis),
) -> InboundStartResult:
    """Start one listed, published workflow as the key's owner. The caller polls the run."""
    await _limit(redis, key, "start", workflow_id=workflow_id)

    from app.services import unattended_launch  # noqa: PLC0415

    # 306-01 (D-11): kill switch -> listed -> org scope -> readable -> published -> entitled ->
    # parses -> template -> foreign folder -> inputs, in that order, in key_run_start.py.
    checked = await validate_key_start(
        pool,
        workflow_id=workflow_id,
        listed_ids={str(w.get("id")) for w in key.workflows if isinstance(w, dict)},
        org_id=UUID(key.org_id),
        owner_id=UUID(key.user_id),
        inputs=(body.inputs if body is not None else {}),
        log_ref=f"key {key.id}",
    )
    if isinstance(checked, KeyStartRefusal):
        raise await _refused(
            key, redis=redis, call="start", reason=checked.reason,
            workflow_id=checked.workflow_ref, detail=checked.extra,
            exc=checked.exc if checked.exc is not None else (
                _not_found() if checked.http_status == status.HTTP_404_NOT_FOUND
                else HTTPException(status_code=checked.http_status, detail=checked.detail)
            ),
        )
    org_id, owner_id = UUID(key.org_id), UUID(key.user_id)
    wid, definition, values = checked.wid, checked.definition, checked.values

    name = checked.name
    try:
        run_id = await unattended_launch.launch_unattended_run(
            owner_id=owner_id,
            org_id=org_id,
            workflow_id=wid,
            definition=definition,
            # Validated declared fields, then the two server-set keys; nothing else reaches the run.
            # 293-05 F-1: the kickoff carries the values, each in the untrusted envelope.
            inputs={
                **values, "kickoff_prompt": inbound_kickoff(name, values),
                UNTRUSTED_FLAG: True,
            },
            title=f"{name} · via key {key.label}",
            max_tokens=_DEFAULT_MAX_TOKENS,
            max_duration=_DEFAULT_MAX_DURATION,
            pool=pool,
            redis=redis,
            run_label="key-started",
            log_ref=f"key {key.id}",
            origin_kind="key",
            origin_label=key.label,
            origin_ref=UUID(key.id),
        )
    except unattended_launch.UnattendedLaunchDisabled as off:  # flipped off mid-request
        raise await _refused(
            key, redis=redis, call="start", reason="workflows_disabled", workflow_id=str(wid),
            exc=HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(off)),
        )
    audit_key_call(
        background_tasks, key, "api_key.start", call="start", workflow_id=str(wid),
        run_id=str(run_id), outcome="ok",
    )
    return InboundStartResult(run_id=str(run_id), status="running")


# ── status read ─────────────────────────────────────────────────────────────────────────────


_FWD_HOST_RE = re.compile(r"[A-Za-z0-9.-]+(:[0-9]{1,5})?|\[[0-9A-Fa-f:.]+\](:[0-9]{1,5})?")
_FWD_PREFIX_RE = re.compile(r"(/[A-Za-z0-9._~-]+)+")
_LOOPBACK_HOSTS = {"localhost", "127.0.0.1", "::1"}


def _first(value: str | None) -> str:
    return (value or "").split(",")[0].strip()


def _is_loopback(base: str) -> bool:
    from urllib.parse import urlsplit  # noqa: PLC0415

    return (urlsplit(base).hostname or "").lower() in _LOOPBACK_HOSTS


def _request_base(request: Request) -> str:
    """The base this caller reached the API at: forwarded proto / host / prefix when present and
    well-formed, else what the request itself says (the ASGI ``root_path`` is the prefix)."""
    proto = _first(request.headers.get("x-forwarded-proto")).lower()
    if proto not in ("http", "https"):
        proto = request.url.scheme
    host = _first(request.headers.get("x-forwarded-host"))
    if not _FWD_HOST_RE.fullmatch(host):
        host = request.headers.get("host") or request.url.netloc
    prefix = _first(request.headers.get("x-forwarded-prefix")).rstrip("/")
    if not _FWD_PREFIX_RE.fullmatch(prefix):
        prefix = str(request.scope.get("root_path") or "").rstrip("/")
    return f"{proto}://{host}{prefix}"


def _public_api_base(request: Request) -> str:
    """293-REVIEW WR-01 — the absolute base a file link is built on.

    ``BACKEND_PUBLIC_URL`` (the app's one "where a third party reaches this API" setting, also the
    OAuth redirect base), unless it is still a loopback address while this caller reached us
    somewhere else: then the request's own base, so an unset setting never hands out a
    ``localhost`` link. Behind the onebox nginx that is ``X-Forwarded-Prefix: /api``.
    """
    from app.config import settings  # noqa: PLC0415

    configured = str(getattr(settings, "backend_public_url", "") or "").strip().rstrip("/")
    seen = _request_base(request)
    if configured and not (_is_loopback(configured) and not _is_loopback(seen)):
        return configured
    return seen


@router.get("/runs/{run_id}", response_model=InboundRunRead, dependencies=[Depends(_client_limit)])
async def read_inbound_run(
    run_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    key: ResolvedKey = Depends(resolve_api_key),
    pool: asyncpg.Pool = Depends(get_pg_pool),
    redis=Depends(get_redis),
) -> InboundRunRead:
    """PURE READ of a run THIS key started. A paused run is answered in the app (D-10)."""
    await _limit(redis, key, "read", run_id=run_id)

    rid = _as_uuid(run_id)
    run = (
        await pool.fetchrow(_RUN_ACCESS_SQL, rid, UUID(key.id), UUID(key.user_id))
        if rid is not None else None
    )
    if run is None:
        raise await _refused(
            key, redis=redis, call="read", reason="run_not_found", exc=_not_found(),
            run_id=run_id)
    run = dict(run)

    # 306-01 (D-12): the read shape lives in key_run_read.py; the access query above stays here.
    result = await read_key_run(
        pool, redis, run=run, key=key, files_base=_public_api_base(request),
    )
    audit_key_call(
        background_tasks, key, "api_key.read", call="read", run_id=str(run["id"]),
        outcome=result.status,
    )
    return result


# ── one-time file link ──────────────────────────────────────────────────────────────────────


@router.get(
    "/files/{token}",
    response_class=Response,
    dependencies=[Depends(_client_limit)],
    responses={200: {"content": {"application/octet-stream": {}},
                     "description": "The file's exact bytes, as an attachment."}},
)
async def download_inbound_file(
    token: str,
    background_tasks: BackgroundTasks,
    pool: asyncpg.Pool = Depends(get_pg_pool),
    redis=Depends(get_redis),
) -> Response:
    """One file, once. The link is the credential, so it is re-checked against live state:
    the key still live and its owner still a member, the run still this key's, the file still
    that run's own (T-293-16)."""
    if not _TOKEN_RE.fullmatch(token or ""):
        raise _not_found()
    # 296-06 (293-IN-01): PEEK at the token here; it is consumed only after the per-key limiter
    # passed, so a 429/503 (or a live-check refusal) never burns a valid link.
    raw = await redis.get(f"{_DOWNLOAD_PREFIX}{token}")
    if not raw:
        raise _not_found()
    try:
        link = json.loads(raw)
        key_id, run_id, file_id = (UUID(str(link[k])) for k in ("key_id", "run_id", "file_id"))
    except (ValueError, TypeError, KeyError):
        raise _not_found() from None

    key_row = await pool.fetchrow(_LINK_KEY_SQL, key_id)
    if key_row is None:
        raise _not_found()
    key_row = dict(key_row)
    expires_at = key_row.get("expires_at")
    if key_row.get("revoked_at") is not None or (
        expires_at is not None and expires_at <= datetime.now(timezone.utc)
    ):
        raise await _refused(key_row, redis=redis, call="read", reason=(
            "revoked" if key_row.get("revoked_at") is not None else "expired"
        ), exc=_not_found(), run_id=str(run_id), detail={"file": True})

    from app import dependencies as deps  # noqa: PLC0415

    if not await api_keys_db.is_org_member(
        pool, org_id=key_row["org_id"], user_id=key_row["user_id"]
    ) or await deps._is_banned(str(key_row["user_id"])):
        raise await _refused(
            key_row, redis=redis, call="read", reason="not_member", exc=_not_found(),
            run_id=str(run_id), detail={"file": True})

    key = ResolvedKey(
        id=str(key_row["id"]), org_id=str(key_row["org_id"]), user_id=str(key_row["user_id"]),
        label=key_row["label"], workflows=[], expires_at=expires_at,
    )
    await _limit(redis, key, "read", run_id=str(run_id))
    async with redis.pipeline(transaction=True) as pipe:  # GET + DEL in one MULTI: one use
        pipe.get(f"{_DOWNLOAD_PREFIX}{token}")
        pipe.delete(f"{_DOWNLOAD_PREFIX}{token}")
        consumed, _deleted = await pipe.execute()
    if consumed != raw:  # another request used it between the peek and here
        raise _not_found()

    run = await pool.fetchrow(_RUN_THREAD_SQL, run_id, key_id, UUID(key.user_id))
    from app.db import workspace as workspace_db  # noqa: PLC0415

    file_row = await workspace_db.get_file_by_id(pool, file_id) if run is not None else None
    if (
        run is None
        or file_row is None
        or str(file_row.get("thread_id")) != str(dict(run)["thread_id"])
        or file_row.get("is_expired")
        or file_row.get("kind") == "template_input"
    ):
        raise await _refused(
            key, redis=redis, call="read", reason="run_not_found", exc=_not_found(),
            run_id=str(run_id), detail={"file": True})

    from app.api.workspace import _safe_download_filename  # noqa: PLC0415
    from app.services.workspace_service import WorkspaceError, _get_file_content  # noqa: PLC0415

    try:
        content = await _get_file_content(
            pool, deps.get_service_role_supabase(key.org_id), file_row
        )
    except WorkspaceError:
        raise await _refused(
            key, redis=redis, call="read", reason="run_not_found", exc=_not_found(),
            run_id=str(run_id), detail={"file": True}) from None

    audit_key_call(
        background_tasks, key, "api_key.read", call="file", run_id=str(run_id), outcome="ok",
        detail={"file_id": str(file_id)},
    )
    filename = _safe_download_filename(str(file_row.get("path") or "download"))
    return Response(
        content=bytes(content),
        media_type=file_row.get("mime_type") or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
