"""Phase 307-05 (D-08, D-51; T-307-29, T-307-30, T-307-28) — the operator's redirect-host allowlist.

``/admin/mcp-sign-in-hosts``: the hosts an AI tool may send a member back to after sign-in
(``app_settings('global').mcp_oauth_redirect_hosts``, migration 224). Loopback is always allowed
and never listed. Control Room → Controls renders it (``McpSignInHostsCard``).

* **Operator only.** The router-level ``require_operator`` is the sole authority (a non-operator
  reads the byte-identical admin 404), the ``api/admin.py`` shape — but this module is its own
  router so ``admin.py`` stays untouched (D-40). ``register_mcp`` includes it, BEFORE the
  refuse-mount guard: it is deployment policy, editable before ``BACKEND_PUBLIC_URL`` is set.
* **Read and written LIVE** through asyncpg (``db/oauth.py``), never the cached settings loader —
  its 30 s cache would let a removed host keep working.
* **The server validates, the client never rewrites** (T-307-29). A scheme, a path, a port, ``*``,
  whitespace, uppercase, an IP literal, loopback and a duplicate are each refused with a sentence
  the Control Room shows verbatim; nothing is silently lowercased or stripped.
* **One SQL statement per write** (no lost update between two operators) and **one operator
  ledger row per write** (``operator_audit_floor``: ``settings.mcp_sign_in_hosts.add`` /
  ``.remove``, a label naming the host). A refused write raises before the label is set, and the
  floor records nothing for a request that raised.
* **D-51:** removing a host stops NEW sign-ins only. ``/oauth/token`` never reads this list, so
  apps already connected keep working — which is why the Control Room can say so.
"""
from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

from app.db import oauth as oauth_db
from app.dependencies import get_pg_pool, operator_audit_floor, require_operator

router = APIRouter(
    prefix="/admin/mcp-sign-in-hosts",
    tags=["admin"],
    dependencies=[Depends(require_operator)],
    include_in_schema=False,
)

_LABEL = re.compile(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?")
_IPV4 = re.compile(r"[0-9]{1,3}(?:\.[0-9]{1,3}){3}")
_LOOPBACK = frozenset({"localhost", "127.0.0.1", "[::1]", "::1"})

EMPTY = "Type a host name, like claude.ai."
SCHEME = "Type the host name only, without https://."
SPACES = "A host name can't contain spaces."
WILDCARD = "Wildcards aren't allowed. Add each host name on its own."
PATH = "Type the host name only, without a path."
PORT = "Type the host name only, without a port."
UPPER = "Type the host name in lowercase letters."
LOOPBACK = "Apps on a person's own computer (localhost) are always allowed, so it isn't listed."
IP = "Type a host name, not an IP address."
INVALID = "That isn't a valid host name. Use a name like claude.ai."
STORE_FAILED = "The setting couldn't be saved. Try again in a moment."


def validate_redirect_host(raw: object) -> tuple[str | None, str | None]:
    """``(host, None)`` for a valid lowercase hostname, else ``(None, sentence)``. Never rewrites.

    Valid: IDNA ASCII labels of 1..63 characters (letters, digits, inner hyphens), at least one
    dot, at most 253 characters. Checked in an order that names the most specific mistake.
    """
    if not isinstance(raw, str) or raw == "":
        return None, EMPTY
    if "://" in raw:
        return None, SCHEME
    if any(ch.isspace() for ch in raw):
        return None, SPACES
    if raw.strip().lower() in _LOOPBACK:
        return None, LOOPBACK
    if "*" in raw:
        return None, WILDCARD
    if "/" in raw or "?" in raw or "#" in raw:
        return None, PATH
    if raw.startswith("[") or raw.count(":") > 1:
        return None, IP
    if ":" in raw:
        return None, PORT
    if raw != raw.lower():
        return None, UPPER
    if _IPV4.fullmatch(raw):
        return None, IP
    if len(raw) > 253 or "." not in raw or not raw.isascii():
        return None, INVALID
    if not all(_LABEL.fullmatch(label) for label in raw.split(".")):
        return None, INVALID
    return raw, None


class HostBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    host: str = Field(max_length=300)


class SignInHost(BaseModel):
    host: str
    built_in: bool
    added_by_name: str | None = None
    added_at: str | None = None


class SignInHostList(BaseModel):
    hosts: list[SignInHost]


def _wire(entries: list[dict]) -> SignInHostList:
    out = []
    for e in entries:
        host = e.get("host")
        if not isinstance(host, str):
            continue
        added_at = e.get("added_at")
        if isinstance(added_at, str) and added_at.endswith("+00:00"):
            added_at = added_at[: -len("+00:00")] + "Z"
        out.append(SignInHost(
            host=host,
            # an entry without ``added_by`` is one of the seeded hosts (migration 224 comment)
            built_in=e.get("added_by") is None,
            added_by_name=e.get("added_by_name") if isinstance(e.get("added_by_name"), str) else None,
            added_at=added_at if isinstance(added_at, str) else None,
        ))
    return SignInHostList(hosts=out)


@router.get("", response_model=SignInHostList)
async def list_sign_in_hosts(pool=Depends(get_pg_pool)) -> SignInHostList:
    """The allowlist in stored order, read live."""
    return _wire(await oauth_db.get_redirect_hosts(pool))


@router.post("", response_model=SignInHostList, dependencies=[Depends(operator_audit_floor)])
async def allow_sign_in_host(body: HostBody, request: Request, pool=Depends(get_pg_pool)) -> SignInHostList:
    """Add one host (direct, reversible: the 066 graded guard). Returns the list the server stored."""
    host, refusal = validate_redirect_host(body.host)
    if refusal is not None:
        raise HTTPException(status_code=422, detail=refusal)
    operator = getattr(request.state, "operator", None) or {}
    stored = await oauth_db.add_redirect_host(
        pool, host=host, added_by=str(operator.get("id")), added_by_name=operator.get("email"),
    )
    if stored is None:
        current = await oauth_db.get_redirect_hosts(pool)
        if any(isinstance(e.get("host"), str) and e["host"].lower() == host for e in current):
            raise HTTPException(status_code=422, detail=f"{host} is already on the list.")
        raise HTTPException(status_code=503, detail=STORE_FAILED)
    request.state.audit_action = "settings.mcp_sign_in_hosts.add"
    request.state.audit_label = f"Allowed AI tool sign-in to return to {host}"
    request.state.audit_is_write = True
    return _wire(stored)


@router.post("/remove", response_model=SignInHostList, dependencies=[Depends(operator_audit_floor)])
async def remove_sign_in_host(body: HostBody, request: Request, pool=Depends(get_pg_pool)) -> SignInHostList:
    """Remove one host (arm-to-confirm in the UI: a global effect). Apps already connected keep
    working (D-51). A built-in host may be removed; the empty list is allowed."""
    host = body.host.strip().lower()
    stored = await oauth_db.remove_redirect_host(pool, host=host)
    if stored is None:
        raise HTTPException(status_code=404, detail=f"{host} isn't on the list.")
    request.state.audit_action = "settings.mcp_sign_in_hosts.remove"
    request.state.audit_label = f"Stopped AI tool sign-in returning to {host}"
    request.state.audit_is_write = True
    return _wire(stored)
