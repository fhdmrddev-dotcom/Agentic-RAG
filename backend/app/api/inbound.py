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
import posixpath
import re
import secrets
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
    InboundInputRefused,
    inbound_kickoff,
    validate_inbound_inputs,
)
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
# A2 — a file link lives 300 s and works once; a fresh one comes with every status read.
_DOWNLOAD_TTL = 300
_DOWNLOAD_PREFIX = "apikey:dl:"
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


class InboundStep(BaseModel):
    name: str
    state: str


class InboundFile(BaseModel):
    name: str
    size_bytes: int | None = None
    url: str = Field(description=(
        "An absolute, one-time link to the file. Fetch it with no header; it works once and "
        "for `expires_in` seconds."
    ))
    expires_in: int


class InboundWaitingOn(BaseModel):
    who: str


class InboundRunRead(BaseModel):
    run_id: str
    status: str
    step_index: int | None = None
    step_total: int | None = None
    waiting_on: InboundWaitingOn | None = None
    output_text: str | None = None
    end_reason: str | None = None
    steps: list[InboundStep] = Field(default_factory=list)
    files: list[InboundFile] = Field(default_factory=list)


# ── SQL (explicit columns, explicit owner / org predicates — the pool bypasses RLS) ──────────

# The scoped existence read: a row outside the key's org (and not system-global) reads exactly
# like a row that does not exist (D-06).
_SCOPE_SQL = (
    "SELECT id FROM workflow_definitions "
    "WHERE id = $1 AND (org_id = $2 OR is_system_global = true)"
)

# THE access query (D-12). id, origin and owner travel together, so every miss is one miss.
_RUN_ACCESS_SQL = (
    "SELECT id, thread_id, status, user_id, org_id, definition_snapshot FROM workflow_runs "
    "WHERE id = $1 AND origin_kind = 'key' AND origin_ref = $2 AND user_id = $3"
)

_RUN_THREAD_SQL = (
    "SELECT thread_id FROM workflow_runs "
    "WHERE id = $1 AND origin_kind = 'key' AND origin_ref = $2 AND user_id = $3"
)

# The evidence read's phase shape (api/workflow_run_evidence.py `_PHASES_SQL`).
_PHASES_SQL = (
    "SELECT slug, phase_index, status, started_at, completed_at, output "
    "FROM workflow_phases WHERE workflow_run_id = $1 ORDER BY phase_index"
)

_END_REASON_AUDIT_SQL = (
    "SELECT event_type, metadata, created_at FROM harness_audit "
    "WHERE run_id = $1 AND event_type = ANY($2::text[]) ORDER BY created_at, id"
)

_DISPLAY_NAME_SQL = "SELECT display_name FROM profiles WHERE id = $1"

# The run's own thread (one thread per run, D-09). `IS DISTINCT FROM`, never `<>`: a NULL kind
# (every ordinary produced file) must be listed, and `NULL <> 'x'` is NULL.
_FILES_SQL = (
    "SELECT id, path, size_bytes FROM workspace_files "
    "WHERE thread_id = $1 AND kind IS DISTINCT FROM 'template_input' "
    "AND (expires_at IS NULL OR expires_at > now()) ORDER BY created_at, path"
)

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


def _raw_definition(value: Any) -> dict | None:
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except (ValueError, TypeError):
            return None
    return value if isinstance(value, dict) else None


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

    # 293-REVIEW CR-01: the operator's workflows kill switch stops this door too, before any
    # other read, in the in-app kickoff's own 403 sentence.
    if unattended_launch.workflows_disabled():
        raise await _refused(
            key, redis=redis, call="start", reason="workflows_disabled", workflow_id=workflow_id,
            exc=HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                              detail=unattended_launch.WORKFLOWS_DISABLED_DETAIL),
        )

    listed ={str(w.get("id")) for w in key.workflows if isinstance(w, dict)}
    wid = _as_uuid(workflow_id)
    if wid is None or str(wid) not in listed:
        raise await _refused(key, redis=redis, call="start", reason="not_on_key", exc=_not_found(),
                             workflow_id=workflow_id)

    org_id, owner_id = UUID(key.org_id), UUID(key.user_id)
    if await pool.fetchrow(_SCOPE_SQL, wid, org_id) is None:
        raise await _refused(key, redis=redis, call="start", reason="not_on_key", exc=_not_found(),
                             workflow_id=str(wid), detail={"deleted": True})

    rows = await api_keys_db.get_key_workflows(
        pool, workflow_ids=[wid], user_id=owner_id, org_id=org_id
    )
    row = next((r for r in rows if str(r.get("id")) == str(wid)), None)
    if row is None or not row.get("readable"):
        raise await _refused(
            key, redis=redis, call="start", reason="cannot_run", workflow_id=str(wid),
            exc=HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=CANNOT_RUN_DETAIL),
        )
    if row.get("status") != "published":
        raise await _refused(
            key, redis=redis, call="start", reason="unpublished", workflow_id=str(wid),
            exc=HTTPException(status_code=status.HTTP_409_CONFLICT, detail=UNPUBLISHED_DETAIL),
        )

    from app.services import entitlement_service  # noqa: PLC0415

    try:
        await entitlement_service.enforce_entitlement(pool, org_id, "workflows")
    except HTTPException as exc:
        raise await _refused(key, redis=redis, call="start", reason="entitlement", exc=exc,
                             workflow_id=str(wid))

    raw = _raw_definition(row.get("definition"))
    definition = (
        unattended_launch.parse_definition_row({"definition": raw}, log_ref=f"key {key.id}")
        if raw is not None else None
    )
    if definition is None:
        raise await _refused(
            key, redis=redis, call="start", reason="cannot_run", workflow_id=str(wid),
            exc=HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=CANNOT_RUN_DETAIL),
        )

    sentence = unattended_launch.template_refusal(definition)
    if sentence is not None:
        raise await _refused(
            key, redis=redis, call="start", reason="no_template", workflow_id=str(wid),
            exc=HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=sentence),
        )

    try:
        values = validate_inbound_inputs(raw, (body.inputs if body is not None else {}))
    except InboundInputRefused as refusal:
        raise await _refused(
            key, redis=redis, call="start", reason=refusal.code, workflow_id=str(wid),
            detail={"names": refusal.names} if refusal.names else None,
            exc=HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=refusal.detail
            ),
        )

    name = definition.name or row.get("name") or "workflow"
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


async def _optional(label: str, run_id: Any, awaitable: Any) -> Any:
    """An affordance read: on failure, log the run id and degrade to None (never 500)."""
    try:
        return await awaitable
    except Exception:  # noqa: BLE001 — a status read never fails over an additional fact
        logger.warning("inbound %s read failed for run %s", label, run_id, exc_info=True)
        return None


def _step_position(phase_rows: list[dict]) -> int | None:
    """1-based position of the step running now, else of the next step to run."""
    for i, r in enumerate(phase_rows, start=1):
        if r.get("status") == "active":
            return i
    done = sum(1 for r in phase_rows if r.get("status") == "completed")
    return min(done + 1, len(phase_rows)) if phase_rows else None


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


async def _file_links(
    pool, redis, *, key: ResolvedKey, run: dict, base: str
) -> list[InboundFile]:
    rows = await pool.fetch(_FILES_SQL, run["thread_id"])
    files: list[InboundFile] = []
    for r in rows or []:
        token = secrets.token_urlsafe(24)
        await redis.set(
            f"{_DOWNLOAD_PREFIX}{token}",
            json.dumps({"key_id": key.id, "run_id": str(run["id"]), "file_id": str(r["id"])}),
            ex=_DOWNLOAD_TTL,
        )
        path = str(r.get("path") or "")
        files.append(InboundFile(
            name=posixpath.basename(path.replace("\\", "/")) or "file",
            size_bytes=r.get("size_bytes"),
            url=f"{base}/inbound/files/{token}",
            expires_in=_DOWNLOAD_TTL,
        ))
    return files


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

    from app.db import workflows as workflows_db  # noqa: PLC0415
    from app.models.thread import phase_output_object  # noqa: PLC0415
    from app.services import run_evidence as ev  # noqa: PLC0415
    from app.services.harness.run_read_wire import (  # noqa: PLC0415
        END_REASON_AUDIT_KINDS,
        resolve_end_reason,
    )
    from app.services.harness.run_read_words import waiting_who  # noqa: PLC0415

    phase_rows = sorted(
        (dict(r) for r in (await pool.fetch(_PHASES_SQL, run["id"]) or [])),
        key=lambda r: r.get("phase_index") if isinstance(r.get("phase_index"), int) else 1 << 30,
    )
    names = {p["slug"]: p["name"] for p in ev.compose_definition(
        run.get("definition_snapshot"), None
    )["phases"]}
    steps = [
        InboundStep(name=names.get(r.get("slug")) or str(r.get("slug") or ""),
                    state=str(r.get("status") or ""))
        for r in phase_rows
    ]

    db_status = run.get("status")
    wire_status = "running" if db_status == "active" else str(db_status)
    waiting_on = None
    if db_status in ("paused", "cap_paused"):
        wire_status = "paused"
    # 293-05: a human-input STEP keeps the run `active` while its question is open (only an
    # engine pause flips it to `paused`), so the open question is read for both, exactly as the
    # run page's `_read_waiting_on` does.
    if db_status in ("active", "paused"):
        prompt = await _optional(
            "waiting", run["id"], workflows_db.get_unanswered_ask_user(pool, run["id"])
        )
        if prompt:
            wire_status = "waiting_for_person"
            display = await _optional(
                "profile", run["id"], pool.fetchval(_DISPLAY_NAME_SQL, run["user_id"])
            )
            # The name only: a non-owner reader never gets the question (T-293-19).
            waiting_on = InboundWaitingOn(
                who=waiting_who(is_owner=False, display_name=display, viewer_email=None)
            )

    failed_reasons = []
    for r in phase_rows:
        if r.get("status") == "failed":
            obj = phase_output_object(r.get("output"))
            failed_reasons.append(obj.get("_failure_reason") if isinstance(obj, dict) else None)
    end_reason = resolve_end_reason(db_status, failed_reasons, [])
    if end_reason is None and db_status in ("failed", "cancelled"):
        audit_rows = await _optional(
            "end reason", run["id"],
            pool.fetch(_END_REASON_AUDIT_SQL, run["id"], list(END_REASON_AUDIT_KINDS)),
        )
        end_reason = resolve_end_reason(
            db_status, failed_reasons, [dict(r) for r in (audit_rows or [])]
        )

    files = await _optional("files", run["id"], _file_links(
        pool, redis, key=key, run=run, base=_public_api_base(request),
    ))

    audit_key_call(
        background_tasks, key, "api_key.read", call="read", run_id=str(run["id"]),
        outcome=wire_status,
    )
    return InboundRunRead(
        run_id=str(run["id"]),
        status=wire_status,
        step_index=_step_position(phase_rows) if db_status == "active" else None,
        step_total=len(phase_rows) if db_status == "active" else None,
        waiting_on=waiting_on,
        output_text=ev.final_output_text(phase_rows),
        end_reason=end_reason,
        steps=steps,
        files=files or [],
    )


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
