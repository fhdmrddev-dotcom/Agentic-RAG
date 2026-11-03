"""Phase 307-03 (OAUTH-04; D-12, D-13, D-14, D-15, D-16, D-28, D-36, D-49, D-50) — the consent API.

``GET /oauth/authorize`` (307-02) validates the client and its redirect, stores the request in Redis
for 600 s and sends the browser to Syrel's consent page with only the opaque id. That page reads and
answers the request here, on the MEMBER's session:

  * ``GET  /oauth/requests/{id}``          — what the page shows (never consumes the request)
  * ``POST /oauth/requests/{id}/approve``  — a narrowed GRANT + a single-use 60 s code + the redirect
  * ``POST /oauth/requests/{id}/deny``     — the redirect with ``error=access_denied``

**Security posture.**

  * The Bearer session is REQUIRED on all three (401 without one). A header, not a cookie, so a
    cross-site form cannot answer for the member (T-307-06); the request is single-use.
  * ⛔ The grant's org is the approve BODY's ``org_id``, re-validated by membership and by the live
    switches — never the active-org header (P-6 / T-307-13). The header is read on ``GET`` only to
    pre-select a radio row, a display hint with no authority.
  * The tools and folders are judged by ``validate_mcp_narrowing`` — the SAME call the key create
    makes (T-307-25). No tier capability is checked (D-36).
  * The redirect is built server-side from the STORED request, never from the body (T-307-01); a
    refused, expired or used request is 410 and never a redirect (D-14).
  * Approve never revokes or replaces an earlier grant, even from the same client (D-50).
  * The grant's secret is minted and discarded: only its digest is stored, nobody is shown it
    (D-15). The audit row is ``api_key.create`` with ``detail.credential = "oauth"`` (D-28: no new
    literal).

All I/O is async (asyncpg, redis.asyncio); nothing here calls supabase-py inside the handler (the
audit write runs in a background task, built off the loop by ``audit_key_call``).
"""
from __future__ import annotations

import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated, Any
from urllib.parse import urlencode
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

from app.db import api_keys as api_keys_db
from app.db import oauth as oauth_db
from app.dependencies import get_current_user, get_pg_pool, get_redis
from app.mcp import oauth_metadata, oauth_store
from app.models.api_key import MCP_EMPTY_FOLDERS_SENTENCE
from app.security.api_key_auth import audit_key_call, mint_key
from app.security.oauth_tokens import GRANT_TTL_DAYS
from app.security.principal_liveness import MCP_OFF_DEPLOYMENT_SENTENCE
from app.services.mcp_narrowing import NarrowingRefusal, validate_mcp_narrowing
from app.services.mcp_tool_catalogue import MCP_TOOLS

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/oauth/requests", tags=["oauth"], include_in_schema=False)

LABEL_MAX = 60
LABEL_FALLBACK = "Connected app"
# The built-in allowlist hosts (migration 224's default): the "registered itself" why-line on the
# consent page reads differently for them (UI-SPEC §1a), never their trust.
SEEDED_HOSTS = frozenset({"claude.ai", "claude.com"})

_NO_SESSION = "Sign in to continue."
_NOT_MEMBER = "You aren't a member of that organisation, so the app can't act there."
_STORE_DOWN = "Couldn't reach the sign-in request store. Try again in a moment."
_GONE = "This sign-in request has expired or was already used. Go back to the app and connect again."

_session_bearer = HTTPBearer(auto_error=False)


async def _require_session(
    credentials: HTTPAuthorizationCredentials | None = Depends(_session_bearer),
) -> None:
    """401 (not FastAPI's default 403) when no Bearer session is presented at all."""
    if credentials is None or not credentials.credentials:
        raise HTTPException(status_code=401, detail=_NO_SESSION, headers={"WWW-Authenticate": "Bearer"})


_NO_STORE = {"Cache-Control": "no-store"}


class ConsentApprove(BaseModel):
    """The member's pick. ``folder_ids``: ``None`` = every folder they can see in the org; an EMPTY
    list is refused, never read as "all" (304 D-08). No expiry, label or user: the server sets them."""

    model_config = ConfigDict(extra="forbid")

    org_id: UUID
    tools: list[Annotated[str, StringConstraints(max_length=64)]] = Field(max_length=32)
    folder_ids: list[UUID] | None = Field(default=None, max_length=500)
    include_external: bool = False

    @field_validator("folder_ids")
    @classmethod
    def _folders(cls, v: list[UUID] | None) -> list[UUID] | None:
        if v is None:
            return None
        if not v:
            raise ValueError(MCP_EMPTY_FOLDERS_SENTENCE)
        return list(dict.fromkeys(v))


def client_label(name: Any) -> str:
    """The client's self-chosen name as Syrel stores and shows it: trimmed, capped at 60, or
    ``Connected app``. It is a CLAIM (D-12) — the host beside it is the fact."""
    text = " ".join(str(name).split()) if isinstance(name, str) else ""
    return text[:LABEL_MAX].strip() or LABEL_FALLBACK


def _catalogue() -> list[dict]:
    return [
        {"name": t.name, "group": t.group, "label": t.label, "travels_with": t.travels_with}
        for t in MCP_TOOLS
    ]


def _back_to(redirect_uri: str, params: dict[str, str]) -> str:
    """The STORED redirect (with its loopback port and any registered query) plus ``params``."""
    separator = "&" if "?" in redirect_uri else "?"
    return f"{redirect_uri}{separator}{urlencode(params)}"


def _store_down(exc: Exception) -> HTTPException:
    logger.warning("oauth consent: the request store is unavailable (%s)", type(exc).__name__)
    return HTTPException(status_code=503, detail=_STORE_DOWN)


def _gone() -> HTTPException:
    return HTTPException(status_code=410, detail=_GONE)


# ── GET ───────────────────────────────────────────────────────────────────────────────────────


@router.get("/{request_id}", dependencies=[Depends(_require_session)])
async def read_request(
    request_id: str,
    request: Request,
    response: Response,
    current_user: dict = Depends(get_current_user),
    pool=Depends(get_pg_pool),
    redis=Depends(get_redis),
) -> dict:
    """What the consent page renders. Reading never consumes the request."""
    response.headers.update(_NO_STORE)
    try:
        record = await oauth_store.peek_request(redis, request_id)
    except oauth_store.OAuthStoreUnavailable as exc:
        raise _store_down(exc)
    if record is None:
        return {"status": "expired"}
    status = record.get("status")
    if status == "refused":
        # The reason and the parsed host only — a refused request never names a client.
        return {"status": "refused", "reason": record.get("reason"), "host": record.get("host")}
    if status == "deployment_off":
        return {"status": "deployment_off", "host": record.get("redirect_host")}
    if status != "ready":
        return {"status": "expired"}
    if not await oauth_db.deployment_mcp_on(pool):   # switched off since authorize (live read)
        return {"status": "deployment_off", "host": record.get("redirect_host")}

    # Display hint only: which radio row starts selected. Approve trusts the BODY's org.
    hinted = (request.headers.get("x-org-id") or "").strip().lower()
    orgs = [
        {
            "id": str(o["id"]),
            "name": o["name"],
            "mcp_off": None if o.get("org_on") is True else "org",
            "active": str(o["id"]).lower() == hinted,
        }
        for o in await oauth_db.member_orgs(pool, current_user["id"])
    ]
    redirect_host = record.get("redirect_host")
    redirect_kind = record.get("redirect_kind")
    return {
        "status": "ready",
        "client": {
            "name": client_label(record.get("client_name")),
            "name_source": "cimd" if record.get("name_source") == "cimd" else "dcr",
            "published_host": record.get("published_host"),
            "redirect_host": redirect_host,
            "redirect_kind": redirect_kind,
            "host_seeded": redirect_kind == "web" and redirect_host in SEEDED_HOSTS,
        },
        "account": {"email": current_user.get("email")},
        "orgs": orgs,
        "tools": _catalogue(),
    }


# ── approve ───────────────────────────────────────────────────────────────────────────────────


@router.post("/{request_id}/approve", dependencies=[Depends(_require_session)])
async def approve_request(
    request_id: str,
    body: ConsentApprove,
    background_tasks: BackgroundTasks,
    response: Response,
    current_user: dict = Depends(get_current_user),
    pool=Depends(get_pg_pool),
    redis=Depends(get_redis),
) -> dict:
    """Validate, then consume, then grant: a refused pick leaves the request approvable."""
    response.headers.update(_NO_STORE)
    caller = UUID(str(current_user["id"]))
    org = body.org_id
    try:
        record = await oauth_store.peek_request(redis, request_id)
        if record is None or record.get("status") == "refused":
            raise _gone()
        if record.get("status") == "deployment_off":
            raise HTTPException(status_code=403, detail=MCP_OFF_DEPLOYMENT_SENTENCE)
        if record.get("status") != "ready":
            raise _gone()
        if not await api_keys_db.is_org_member(pool, org_id=org, user_id=caller):
            raise HTTPException(status_code=403, detail=_NOT_MEMBER)
        verdict = await validate_mcp_narrowing(
            pool, caller=caller, org=org, tools=body.tools, folder_ids=body.folder_ids,
        )
        if isinstance(verdict, NarrowingRefusal):
            raise HTTPException(status_code=verdict.status, detail=verdict.detail)

        record = await oauth_store.take_request(redis, request_id)   # the single-use consume
        if record is None or record.get("status") != "ready":
            raise _gone()

        name = client_label(record.get("client_name"))
        client_row_id = UUID(str(record["client_row_id"]))
        minted = mint_key(kind="mcp")   # its secret is discarded here: nobody is ever shown it
        row = await api_keys_db.create_api_key(
            pool,
            org_id=org,
            user_id=caller,
            label=name,
            key_prefix=minted.key_prefix,
            key_hash=minted.key_hash,
            workflows=[],
            expires_at=datetime.now(timezone.utc) + timedelta(days=GRANT_TTL_DAYS),
            kind="mcp",
            folder_ids=verdict.folder_ids,
            tools=list(verdict.tools),
            include_external=body.include_external,
            oauth_client_id=client_row_id,
        )
        await oauth_db.mark_client_granted(pool, client_row_id)

        code = secrets.token_urlsafe(32)
        await oauth_store.save_code(redis, code_digest=oauth_store.digest_code(code), record={
            "grant_id": str(row["id"]),
            "org_id": str(org),
            "client_id": record["client_id"],
            "client_row_id": str(client_row_id),
            "redirect_uri": record["redirect_uri"],
            "code_challenge": record["code_challenge"],
            "resource": record["resource"],
        })
    except oauth_store.OAuthStoreUnavailable as exc:
        raise _store_down(exc)

    audit_key_call(
        background_tasks,
        {"id": row["id"], "label": row["label"], "user_id": caller, "org_id": org, "kind": "mcp"},
        "api_key.create",
        call="manage",
        detail={
            "credential": "oauth",
            "client_name": name,
            "redirect_host": record.get("redirect_host"),
        },
    )
    return {"redirect_url": _back_to(record["redirect_uri"], {
        "code": code, "state": record["state"], "iss": oauth_metadata.issuer() or "",
    })}


# ── deny ──────────────────────────────────────────────────────────────────────────────────────


@router.post("/{request_id}/deny", dependencies=[Depends(_require_session)])
async def deny_request(
    request_id: str,
    response: Response,
    current_user: dict = Depends(get_current_user),
    redis=Depends(get_redis),
) -> dict:
    """Consume the request and send the browser back with ``access_denied`` (D-14). Nothing is
    written. A refused request has no proven redirect, so it is 410 and never followed."""
    response.headers.update(_NO_STORE)
    try:
        record = await oauth_store.take_request(redis, request_id)
    except oauth_store.OAuthStoreUnavailable as exc:
        raise _store_down(exc)
    if record is None or record.get("status") not in ("ready", "deployment_off"):
        raise _gone()
    params = {"error": "access_denied"}
    if record.get("state"):
        params["state"] = record["state"]
    params["iss"] = oauth_metadata.issuer() or ""
    return {"redirect_url": _back_to(record["redirect_uri"], params)}
