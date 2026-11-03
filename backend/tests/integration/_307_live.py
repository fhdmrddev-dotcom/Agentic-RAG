"""Phase 307-02 — the shared harness for the LIVE OAuth suites.

On top of ``_305_live`` (a spawned real ``uvicorn``, one GoTrue member in one org):

* ``GrantWorld.mint_grant()`` — an OAuth client row, a GRANT (an ``api_keys`` row of kind ``mcp``
  naming the client, created through the app's own ``create_api_key(oauth_client_id=...)``) and a
  token pair through ``oauth_db.issue_token_pair``: the state a finished sign-in leaves, without
  the HTTP flow. Returns ``(access, refresh, grant_id)``.
* ``approve_for_test(request_id)`` — exactly what 307-03's approve route will do with a ready
  request: TAKE it from Redis, create the grant, mark the client granted, save a 60 s code bound to
  the client, the redirect as sent, the PKCE challenge, the resource, the grant and its org. Returns
  the redirect URL with ``code``, ``state`` and ``iss``.
* ``cleanup()`` — ``oauth_tokens`` go with their grants (cascade), then every grant this world
  made, then the ``oauth_clients`` it made (RESTRICT order), then the 305 cleanup.

⚠ The CODE RECORD SHAPE written here is the contract ``/oauth/token`` reads:
``{grant_id, org_id, client_id, client_row_id, redirect_uri, code_challenge, resource}``.
⛔ No role-``anon`` statement (BUG-261031-01). Take the local-DB lock before every live run.
"""
from __future__ import annotations

import base64
import contextlib
import hashlib
import secrets

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlencode, urlsplit
from uuid import UUID, uuid4

import httpx

from tests.integration import _305_live as live

CLAUDE_REDIRECT = "https://claude.ai/api/mcp/auth_callback"
VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"           # RFC 7636 appendix B
CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"          # its S256 (307-01 SUMMARY)


def s256(verifier: str) -> str:
    return base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()


def query_of(url: str) -> dict[str, str]:
    return {k: v[0] for k, v in parse_qs(urlsplit(url).query).items()}


def redis_client():
    import redis.asyncio as aioredis

    from app.config import settings

    return aioredis.from_url(settings.redis_url, encoding="utf-8", decode_responses=True)


@dataclass
class GrantWorld:
    w: live.McpWorld
    clients: list[UUID] = field(default_factory=list)
    grants: list[UUID] = field(default_factory=list)
    last_client_id: str = ""  # the PUBLIC client_id of the last minted grant's client

    @property
    def pool(self):
        return self.w.pool

    async def make_client(self, *, kind: str = "dcr", redirect_uris=(CLAUDE_REDIRECT,),
                          name: str = "Claude (307 live)") -> dict:
        from app.db import oauth as oauth_db

        if kind == "dcr":
            row = await oauth_db.insert_dcr_client(
                self.pool, client_id=f"p307-{uuid4().hex}", client_name=name, client_uri=None,
                redirect_uris=list(redirect_uris),
            )
        else:
            now = datetime.now(timezone.utc)
            row = await oauth_db.upsert_cimd_client(
                self.pool, client_id=f"https://claude.ai/oauth/test-307-{uuid4().hex[:12]}",
                client_name=name, client_uri="https://claude.ai", redirect_uris=list(redirect_uris),
                fetched_at=now, expires_at=now + timedelta(hours=1),
            )
        self.clients.append(row["id"])
        return row

    async def create_grant(self, client_row_id: UUID, *, label: str = "Claude (307 live)",
                           expires_in_days: int = 90) -> UUID:
        from app.db import api_keys as api_keys_db
        from app.security import api_key_auth
        from app.services.mcp_tool_catalogue import PRESETS

        minted = api_key_auth.mint_key("mcp")  # its secret is never shown or kept
        row = await api_keys_db.create_api_key(
            self.pool,
            org_id=UUID(self.w.org),
            user_id=UUID(self.w.user),
            label=f"{label} {uuid4().hex[:6]}",
            key_prefix=minted.key_prefix,
            key_hash=minted.key_hash,
            workflows=[],
            expires_at=datetime.now(timezone.utc) + timedelta(days=expires_in_days),
            kind="mcp",
            tools=list(PRESETS["read"].tools),
            oauth_client_id=client_row_id,
        )
        self.grants.append(row["id"])
        self.w.keys.append(str(row["id"]))
        return row["id"]

    async def mint_grant(self, *, resource: str) -> tuple[str, str, UUID]:
        """A finished sign-in without the HTTP flow: ``(access, refresh, grant_id)``."""
        from app.db import oauth as oauth_db
        from app.security.oauth_tokens import digest_token, mint_token

        client = await self.make_client()
        self.last_client_id = client["client_id"]
        grant_id = await self.create_grant(client["id"])
        access, refresh = mint_token("access"), mint_token("refresh")
        async with self.pool.acquire() as conn, conn.transaction():
            await oauth_db.issue_token_pair(
                conn, grant_id=grant_id, access_hash=digest_token(access, "access"),
                refresh_hash=digest_token(refresh, "refresh"), resource=resource,
                refresh_expires_at=datetime.now(timezone.utc) + timedelta(days=90),
            )
            await oauth_db.mark_client_granted(conn, client["id"])
        return access, refresh, grant_id

    async def approve_for_test(self, redis, request_id: str) -> str:
        """307-03's approve, minus the member session: take, grant, code. Returns the redirect."""
        from app.db import oauth as oauth_db
        from app.mcp import oauth_store

        record = await oauth_store.take_request(redis, request_id)
        assert record is not None and record["status"] == "ready", record
        grant_id = await self.create_grant(UUID(record["client_row_id"]),
                                           label=record.get("client_name") or "Connected app")
        async with self.pool.acquire() as conn:
            await oauth_db.mark_client_granted(conn, UUID(record["client_row_id"]))
        code = secrets.token_urlsafe(32)
        await oauth_store.save_code(redis, code_digest=oauth_store.digest_code(code), record={
            "grant_id": str(grant_id),
            "org_id": self.w.org,
            "client_id": record["client_id"],
            "client_row_id": record["client_row_id"],
            "redirect_uri": record["redirect_uri"],
            "code_challenge": record["code_challenge"],
            "resource": record["resource"],
        })
        params = {"code": code, "state": record["state"], "iss": oauth_metadata_issuer(record)}
        separator = "&" if "?" in record["redirect_uri"] else "?"
        return f"{record['redirect_uri']}{separator}{urlencode(params)}"

    async def cleanup(self) -> None:
        p = self.pool
        with contextlib.suppress(Exception):
            await p.execute("DELETE FROM public.oauth_tokens WHERE grant_id = ANY($1::uuid[])", self.grants)
        with contextlib.suppress(Exception):
            await p.execute("DELETE FROM public.audit_log WHERE metadata->>'api_key_id' = ANY($1::text[])",
                            [str(g) for g in self.grants])
        with contextlib.suppress(Exception):
            await p.execute("DELETE FROM public.api_keys WHERE id = ANY($1::uuid[])", self.grants)
        # Grants created by the server for clients this world registered over HTTP are owned by
        # this world's user; the 305 cleanup deletes them, so drop them first to free the clients.
        if self.w.user:
            with contextlib.suppress(Exception):
                await p.execute("DELETE FROM public.api_keys WHERE user_id = $1", UUID(self.w.user))
        with contextlib.suppress(Exception):
            await p.execute("DELETE FROM public.oauth_clients WHERE id = ANY($1::uuid[])", self.clients)


def oauth_metadata_issuer(record: dict) -> str:
    """The issuer is the resource minus ``/mcp`` — the live server's own base."""
    resource = record["resource"]
    return resource[: -len("/mcp")] if resource.endswith("/mcp") else resource


@contextlib.asynccontextmanager
async def grant_world(pool):
    async with live.mcp_world(pool) as w:
        gw = GrantWorld(w)
        try:
            yield gw
        finally:
            await gw.cleanup()


async def clients_registered_over_http(pool, client_ids: list[str]) -> list[UUID]:
    """Row ids of clients a test registered through ``/oauth/register`` (for cleanup)."""
    rows = await pool.fetch("SELECT id FROM public.oauth_clients WHERE client_id = ANY($1::text[])", client_ids)
    return [r["id"] for r in rows]


# ── the wire ─────────────────────────────────────────────────────────────────────────────────


def mcp_post(base: str, token: str | None, body: dict, *, path: str = "/mcp") -> httpx.Response:
    with httpx.Client(base_url=base, timeout=30) as c:
        return c.post(path, headers=live.mcp_headers(token), json=body)


def tools_list_body(rid: int = 2) -> dict:
    return {"jsonrpc": "2.0", "id": rid, "method": "tools/list", "params": {}}


def tool_call_body(name: str, arguments: dict | None = None, rid: int = 3) -> dict:
    return {"jsonrpc": "2.0", "id": rid, "method": "tools/call",
            "params": {"name": name, "arguments": arguments or {}}}


def token_post(base: str, form: dict) -> httpx.Response:
    with httpx.Client(base_url=base, timeout=30) as c:
        return c.post("/oauth/token", data=form)


def refresh(base: str, refresh_token: str, client_id: str, **extra) -> httpx.Response:
    return token_post(base, {"grant_type": "refresh_token", "refresh_token": refresh_token,
                             "client_id": client_id, **extra})
