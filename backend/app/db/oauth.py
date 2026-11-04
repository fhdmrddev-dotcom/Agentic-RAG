"""Phase 307 (OAUTH-05, OAUTH-06; D-01, D-08, D-15, D-16, D-17, D-19, D-46, D-47) — every read and
write of ``oauth_clients`` and ``oauth_tokens``, plus the grant-row writes OAuth needs.

The ONE data-access home for OAuth. Nothing outside this module writes either table (migration 224
makes both deny-all to every client role), and the API layer never composes SQL.

A GRANT is an ``api_keys`` row of kind ``'mcp'`` whose ``oauth_client_id`` names the client it was
approved for (D-15). Its ``key_hash`` is the digest of a random secret nobody is ever shown, so it
can never be presented as a key. Tokens hang off the grant (``oauth_tokens.grant_id``, cascade).

⚠ **THE OWNER PREDICATE RULE, AND ITS DOCUMENTED EXCEPTIONS.** These queries run on the
**service-role asyncpg pool** (``BYPASSRLS``). ``db/api_keys.py``'s rule — an owner predicate in
every statement — holds here with these exceptions, each written in its docstring:

* ``get_access_token_for_auth`` and ``get_token_by_digest`` are digest lookups run BEFORE anyone is
  known (the presented token IS the identity), owner-agnostic exactly like
  ``api_keys.get_key_for_auth``.
* the statements keyed by a SERVER-DERIVED id — a token row found by its digest, a grant id read
  back from a server-side store (Redis) — never by an id taken from request input:
  ``issue_token_pair``, ``rotate_refresh``, ``revoke_grant``, ``revoke_access_token``,
  ``mark_client_granted``. A route that holds a member's id from a request must scope by owner
  BEFORE it reaches these (the connected-apps routes use ``db/api_keys.revoke_key``).
* the ``oauth_clients`` statements: a client row belongs to no member (it is the app, not a person).

⚠ **jsonb IS BOUND AS A PLAIN ``list``.** The pool registers a jsonb codec
(``dependencies.py:_init_pg_connection``); ``json.dumps`` at a call site would store a jsonb string
scalar (the migration 123 defect). There is no ``json`` import in this module.

⚠ **A TOKEN NEVER APPEARS HERE, ONLY ITS DIGEST** (D-17). Callers mint and digest
(``security/oauth_tokens``) and pass the digests in; nothing here logs a digest either, and no
function returns a stored secret (there is none to return).

⚠ **MEMBER LIVENESS IS NOT CHECKED HERE.** ``rotate_refresh`` checks only what it must decide under
its lock: the grant row's ``revoked_at`` / ``expires_at`` and the token's own state. Whether the
member is still in the org or banned is ``api_key_auth.grant_still_live_for_refresh``'s question
(D-48), asked by the ``/oauth/token`` handler first.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Literal
from uuid import UUID

import asyncpg

from app.db.api_keys import _AUTH_COLUMNS
from app.security.oauth_tokens import (
    ACCESS_TTL_SECONDS,
    GRANT_TTL_DAYS,
    REFRESH_GRACE_SECONDS,
    canonical_resource,
)

logger = logging.getLogger(__name__)

_CLIENT_COLUMNS = (
    "id, client_id, kind, client_name, client_uri, redirect_uris, metadata_fetched_at, "
    "metadata_expires_at, created_at, last_grant_at"
)

# The grant columns, ``k.``-qualified, for the token JOINs below. The token's own columns are
# ALIASED (token_id, token_kind, token_expires_at, ...) so the grant's ``id`` / ``kind`` /
# ``expires_at`` / ``revoked_at`` stay exactly what the admission tail reads on a key row.
_K_AUTH_COLUMNS = ", ".join(f"k.{c.strip()}" for c in _AUTH_COLUMNS.split(","))
_T_COLUMNS = (
    "t.id AS token_id, t.kind AS token_kind, t.token_hash, t.resource, "
    "t.expires_at AS token_expires_at, t.created_at AS token_created_at, "
    "t.used_at AS token_used_at, t.replaced_by AS token_replaced_by, "
    "t.revoked_at AS token_revoked_at"
)

# Lazy pruning, per grant, at each refresh (307-RESEARCH §Token lifecycle). A used refresh row is
# kept 30 days so reuse is still recognised (and still kills the family) inside that window.
_PRUNE_ACCESS_AFTER = "interval '1 day'"
_PRUNE_USED_REFRESH_AFTER = "interval '30 days'"


def _status_count(status: str | None) -> int:
    """The row count from an asyncpg status tag (``"UPDATE 1"``, ``"DELETE 3"``)."""
    try:
        return int(str(status or "").strip().rsplit(" ", 1)[-1])
    except ValueError:
        return 0


# ── the redirect-host allowlist (D-08) ───────────────────────────────────────────────────────


async def get_redirect_hosts(pool: asyncpg.Pool) -> list[dict]:
    """``app_settings('global').mcp_oauth_redirect_hosts``, read LIVE every call.

    Never through ``load_app_settings()`` (its 30 s per-worker cache would let a removed host keep
    working — the ``api_keys.mcp_switches`` rule). A missing row reads as an empty list, which
    refuses every https redirect (fail closed).
    """
    value = await pool.fetchval(
        "SELECT mcp_oauth_redirect_hosts FROM public.app_settings WHERE id = 'global'"
    )
    return [dict(e) for e in (value or []) if isinstance(e, dict)]


def _host_list(value: Any) -> list[dict] | None:
    return None if value is None else [dict(e) for e in value if isinstance(e, dict)]


async def add_redirect_host(
    pool: asyncpg.Pool, *, host: str, added_by: str, added_by_name: str | None
) -> list[dict] | None:
    """307-05 (D-08): append ``host`` to the allowlist in ONE statement and return the new list;
    ``None`` when it is already there (or the global row is missing). One UPDATE whose WHERE
    re-checks the array under the row lock, so two operators adding at once cannot lose a write or
    add a host twice. ``host`` is already validated by the route; it is stored as given."""
    value = await pool.fetchval(
        "UPDATE public.app_settings SET mcp_oauth_redirect_hosts = mcp_oauth_redirect_hosts || "
        "jsonb_build_array(jsonb_build_object('host', $1::text, 'added_by', $2::text, "
        "'added_by_name', $3::text, 'added_at', now())) "
        "WHERE id = 'global' AND NOT EXISTS ("
        "SELECT 1 FROM jsonb_array_elements(mcp_oauth_redirect_hosts) e WHERE lower(e->>'host') = $1) "
        "RETURNING mcp_oauth_redirect_hosts",
        host,
        added_by,
        added_by_name,
    )
    return _host_list(value)


async def remove_redirect_host(pool: asyncpg.Pool, *, host: str) -> list[dict] | None:
    """307-05 (D-08): drop ``host`` from the allowlist in ONE statement (order kept) and return the
    new list; ``None`` when it was not there. A built-in host may be removed; the empty list is
    allowed (only loopback sign-ins then work). Existing grants are not touched (D-51)."""
    value = await pool.fetchval(
        "UPDATE public.app_settings SET mcp_oauth_redirect_hosts = COALESCE(("
        "SELECT jsonb_agg(x.e ORDER BY x.o) FROM jsonb_array_elements(mcp_oauth_redirect_hosts) "
        "WITH ORDINALITY AS x(e, o) WHERE lower(x.e->>'host') IS DISTINCT FROM $1), '[]'::jsonb) "
        "WHERE id = 'global' AND EXISTS ("
        "SELECT 1 FROM jsonb_array_elements(mcp_oauth_redirect_hosts) e WHERE lower(e->>'host') = $1) "
        "RETURNING mcp_oauth_redirect_hosts",
        host,
    )
    return _host_list(value)


async def deployment_mcp_on(pool: asyncpg.Pool) -> bool:
    """``app_settings('global').mcp_enabled``, read LIVE (307-02, D-10: an authorize while the
    deployment switch is off stores a ``deployment_off`` request). The ``api_keys.mcp_switches``
    rule: anything but ``True`` — a missing row, NULL — reads as off (fail closed). No org is known
    yet at authorize, so this is the deployment half of that statement on its own."""
    value = await pool.fetchval("SELECT mcp_enabled FROM public.app_settings WHERE id = 'global'")
    return value is True


async def member_orgs(pool: asyncpg.Pool, user_id: UUID | str) -> list[dict]:
    """307-03 (D-13): every org the member belongs to, by name, with its MCP switch — the consent
    page's org list. Display only: approve re-validates membership and the switches live
    (``api_keys.is_org_member`` + ``mcp_narrowing``). Owner predicate on the member's id."""
    rows = await pool.fetch(
        "SELECT o.id, o.name, o.mcp_enabled AS org_on "
        "FROM public.org_members m JOIN public.organizations o ON o.id = m.org_id "
        "WHERE m.user_id = $1 ORDER BY o.name, o.id",
        user_id if isinstance(user_id, UUID) else UUID(str(user_id)),
    )
    return [dict(r) for r in rows]


# ── clients ──────────────────────────────────────────────────────────────────────────────────


async def insert_dcr_client(
    pool: asyncpg.Pool,
    *,
    client_id: str,
    client_name: str | None,
    client_uri: str | None,
    redirect_uris: list[str],
) -> dict:
    """Register one Dynamic Client Registration client. ``client_id`` is minted by the caller."""
    row = await pool.fetchrow(
        f"INSERT INTO public.oauth_clients (client_id, kind, client_name, client_uri, redirect_uris) "
        f"VALUES ($1, 'dcr', $2, $3, $4) RETURNING {_CLIENT_COLUMNS}",
        client_id,
        client_name,
        client_uri,
        list(redirect_uris),  # plain list — the pool's jsonb codec encodes it
    )
    return dict(row)


async def get_client(pool: asyncpg.Pool, client_id: str) -> dict | None:
    """One client by its PUBLIC ``client_id`` (the DCR id or the CIMD URL), or ``None``."""
    row = await pool.fetchrow(
        f"SELECT {_CLIENT_COLUMNS} FROM public.oauth_clients WHERE client_id = $1", client_id
    )
    return dict(row) if row is not None else None


async def upsert_cimd_client(
    pool: asyncpg.Pool,
    *,
    client_id: str,
    client_name: str | None,
    client_uri: str | None,
    redirect_uris: list[str],
    fetched_at: datetime,
    expires_at: datetime,
) -> dict:
    """Insert or refresh a Client ID Metadata Document client (``client_id`` = its https URL).

    Only a ``cimd`` row is ever updated: a DCR row that somehow holds the same ``client_id`` is
    left alone and this raises ``ValueError`` rather than overwrite it.
    """
    row = await pool.fetchrow(
        f"INSERT INTO public.oauth_clients "
        f"(client_id, kind, client_name, client_uri, redirect_uris, metadata_fetched_at, metadata_expires_at) "
        f"VALUES ($1, 'cimd', $2, $3, $4, $5, $6) "
        f"ON CONFLICT (client_id) DO UPDATE SET client_name = EXCLUDED.client_name, "
        f"client_uri = EXCLUDED.client_uri, redirect_uris = EXCLUDED.redirect_uris, "
        f"metadata_fetched_at = EXCLUDED.metadata_fetched_at, "
        f"metadata_expires_at = EXCLUDED.metadata_expires_at "
        f"WHERE public.oauth_clients.kind = 'cimd' "
        f"RETURNING {_CLIENT_COLUMNS}",
        client_id,
        client_name,
        client_uri,
        list(redirect_uris),
        fetched_at,
        expires_at,
    )
    if row is None:
        raise ValueError("a non-CIMD client already holds this client_id")
    return dict(row)


async def delete_unused_dcr_clients(
    pool: asyncpg.Pool, *, older_than_hours: int = 24, limit: int = 500
) -> int:
    """Prune DCR registrations nobody ever approved: ``kind='dcr'``, never granted, older than
    ``older_than_hours``, and named by no ``api_keys`` row (RESTRICT would refuse those anyway).
    Bounded by ``limit`` per call. Returns how many rows went."""
    status = await pool.execute(
        "DELETE FROM public.oauth_clients WHERE id IN ("
        "SELECT c.id FROM public.oauth_clients c "
        "WHERE c.kind = 'dcr' AND c.last_grant_at IS NULL "
        "AND c.created_at < now() - make_interval(hours => $1) "
        "AND NOT EXISTS (SELECT 1 FROM public.api_keys k WHERE k.oauth_client_id = c.id) "
        "LIMIT $2)",
        int(older_than_hours),
        int(limit),
    )
    return _status_count(status)


async def delete_unused_cimd_clients(
    pool: asyncpg.Pool, *, older_than_hours: int = 24, limit: int = 500
) -> int:
    """307 WR-04 — the CIMD twin of ``delete_unused_dcr_clients``. Every ``/oauth/authorize`` with a
    fresh https ``client_id`` serving a valid document writes a ``cimd`` row before its redirect is
    proven, with no session, so without this an anonymous caller grows the table without bound.
    Prunes ``kind='cimd'`` rows never granted, whose document was last fetched (or, never fetched,
    created) more than ``older_than_hours`` ago, named by no ``api_keys`` row. A row still in use is
    re-fetched (its ``metadata_fetched_at`` moves), so it is never a candidate. Bounded by ``limit``
    per call. Returns how many rows went."""
    status = await pool.execute(
        "DELETE FROM public.oauth_clients WHERE id IN ("
        "SELECT c.id FROM public.oauth_clients c "
        "WHERE c.kind = 'cimd' AND c.last_grant_at IS NULL "
        "AND COALESCE(c.metadata_fetched_at, c.created_at) < now() - make_interval(hours => $1) "
        "AND NOT EXISTS (SELECT 1 FROM public.api_keys k WHERE k.oauth_client_id = c.id) "
        "LIMIT $2)",
        int(older_than_hours),
        int(limit),
    )
    return _status_count(status)


async def mark_client_granted(conn: Any, client_row_id: UUID) -> None:
    """Stamp ``last_grant_at`` on the client a member just approved (keeps it out of the prune).
    Takes a connection so it joins the caller's grant transaction. Server-derived id."""
    await conn.execute(
        "UPDATE public.oauth_clients SET last_grant_at = now() WHERE id = $1", client_row_id
    )


# ── tokens ───────────────────────────────────────────────────────────────────────────────────


async def issue_token_pair(
    conn: Any,
    *,
    grant_id: UUID,
    access_hash: str,
    refresh_hash: str,
    resource: str,
    refresh_expires_at: datetime,
) -> tuple[UUID, UUID]:
    """Insert one access + refresh pair for a grant; returns ``(access_id, refresh_id)``.

    ONE statement, so both rows carry the same ``created_at`` (the transaction's ``now()``): that is
    how ``rotate_refresh``'s grace finds the access token issued beside a refresh token. The access
    token lives ``ACCESS_TTL_SECONDS``; the refresh token until ``refresh_expires_at`` (the grant's
    expiry, D-16). Takes a connection so it joins the caller's transaction. Server-derived id.
    """
    rows = await conn.fetch(
        "INSERT INTO public.oauth_tokens (grant_id, kind, token_hash, resource, expires_at) "
        "VALUES ($1, 'access', $2, $4, now() + make_interval(secs => $6)), "
        "($1, 'refresh', $3, $4, $5) "
        "RETURNING id, kind",
        grant_id,
        access_hash,
        refresh_hash,
        resource,
        refresh_expires_at,
        float(ACCESS_TTL_SECONDS),
    )
    by_kind = {r["kind"]: r["id"] for r in rows}
    return by_kind["access"], by_kind["refresh"]


async def get_access_token_for_auth(pool: asyncpg.Pool, digest: str) -> dict | None:
    """The resolver's lookup for an ACCESS token, by digest. ⚠ OWNER-AGNOSTIC BY DESIGN.

    ONE statement: the token row JOINed to its grant's ``_AUTH_COLUMNS`` (``id`` is the GRANT's id,
    ``kind`` the grant's kind, and so on — exactly the key row the admission tail reads), plus the
    token's own columns under ``token_*`` aliases and ``resource``. ``None`` for an unknown digest
    or a refresh token. Every live-state check happens in ``security/api_key_auth``.
    """
    row = await pool.fetchrow(
        f"SELECT {_K_AUTH_COLUMNS}, {_T_COLUMNS} "
        f"FROM public.oauth_tokens t JOIN public.api_keys k ON k.id = t.grant_id "
        f"WHERE t.token_hash = $1 AND t.kind = 'access'",
        digest,
    )
    return dict(row) if row is not None else None


async def get_token_by_digest(pool: asyncpg.Pool, digest: str) -> dict | None:
    """Either kind of token by digest, JOINed to its grant (the ``get_access_token_for_auth``
    shape; ``token_kind`` says which). For ``/oauth/revoke`` and the refresh pre-check.
    ⚠ OWNER-AGNOSTIC BY DESIGN, like the access lookup."""
    row = await pool.fetchrow(
        f"SELECT {_K_AUTH_COLUMNS}, {_T_COLUMNS} "
        f"FROM public.oauth_tokens t JOIN public.api_keys k ON k.id = t.grant_id "
        f"WHERE t.token_hash = $1",
        digest,
    )
    return dict(row) if row is not None else None


async def revoke_access_token(pool: asyncpg.Pool, token_id: UUID) -> None:
    """Revoke ONE access token (RFC 7009 for an access token). The grant and its refresh token
    are untouched. Server-derived id (found by digest)."""
    await pool.execute(
        "UPDATE public.oauth_tokens SET revoked_at = now() "
        "WHERE id = $1 AND kind = 'access' AND revoked_at IS NULL",
        token_id,
    )


async def revoke_grant(pool_or_conn: Any, grant_id: UUID, *, revoked_by: UUID | None = None) -> bool:
    """Revoke a whole grant (the token family). ``True`` only when THIS call revoked it — the
    ``revoke_key`` ``revoked_now`` semantics, so a caller audits once. Matches grant rows only
    (``oauth_client_id IS NOT NULL``): this can never revoke a personal key. Server-derived id."""
    status = await pool_or_conn.execute(
        "UPDATE public.api_keys SET revoked_at = now(), revoked_by = $2 "
        "WHERE id = $1 AND oauth_client_id IS NOT NULL AND revoked_at IS NULL",
        grant_id,
        revoked_by,
    )
    return _status_count(status) == 1


# ── refresh rotation (D-19, D-46, D-16, D-47) ────────────────────────────────────────────────

RotationKind = Literal["rotated", "grace_rotated", "reuse_revoked", "dead", "wrong_resource"]


@dataclass(frozen=True)
class RotationOutcome:
    """What one refresh did.

    * ``rotated`` — a live unused token: marked used, a new pair issued, the grant slid 90 days.
    * ``grace_rotated`` — a token used <= 60 s ago whose successor is unused and unrevoked: the
      successor pair is revoked and a fresh pair issued from the same parent (D-46).
    * ``reuse_revoked`` — any other reuse (including presenting a successor the grace revoked):
      the whole grant is revoked (D-19). The caller audits ``api_key.refused`` ``refresh_reuse``.
    * ``dead`` — unknown digest, an access token, an expired token, or a revoked / expired grant.
      Nothing written.
    * ``wrong_resource`` — a ``resource`` that is not the grant's recorded one (D-47). Nothing
      written.

    ``grant_row`` is the grant's ``_AUTH_COLUMNS`` row (after the slide, on the two issuing paths).
    """

    kind: RotationKind
    grant_id: UUID | None = None
    grant_row: dict | None = None


async def rotate_refresh(
    pool: asyncpg.Pool,
    *,
    refresh_hash: str,
    new_access_hash: str,
    new_refresh_hash: str,
    resource: str | None,
    now: datetime | None = None,
) -> RotationOutcome:
    """Spend one refresh token, in ONE transaction serialised per grant.

    Lock order: the grant (``api_keys ... FOR UPDATE``) first, then the refresh row — so two
    concurrent refreshes of one grant run one after the other, and at most one live refresh token
    exists per grant at any time. That invariant is what makes the 60 s grace safe: a thief racing
    inside the window revokes the legitimate successor, the legitimate client then presents that
    revoked successor, and THAT is reuse — the family dies, the thief's pair with it
    (307-RESEARCH §Token lifecycle).

    ``now`` overrides the comparison clock (tests); writes always use the database's ``now()``.
    The new digests are minted by the caller, so no stored secret is ever returned (D-46).
    """
    async with pool.acquire() as conn, conn.transaction():
        found = await conn.fetchrow(
            "SELECT id, grant_id FROM public.oauth_tokens WHERE token_hash = $1 AND kind = 'refresh'",
            refresh_hash,
        )
        if found is None:
            return RotationOutcome("dead")
        grant_id = found["grant_id"]
        grant = await conn.fetchrow(
            f"SELECT {_AUTH_COLUMNS} FROM public.api_keys WHERE id = $1 FOR UPDATE", grant_id
        )
        token = await conn.fetchrow(
            "SELECT id, resource, expires_at, used_at, replaced_by, revoked_at "
            "FROM public.oauth_tokens WHERE id = $1 FOR UPDATE",
            found["id"],
        )
        clock = now or await conn.fetchval("SELECT now()")
        if grant is None or token is None or grant.get("oauth_client_id") is None:
            return RotationOutcome("dead", grant_id)
        if grant["revoked_at"] is not None or (
            grant["expires_at"] is not None and grant["expires_at"] <= clock
        ):
            return RotationOutcome("dead", grant_id)
        if token["expires_at"] <= clock:
            return RotationOutcome("dead", grant_id)

        grace = False
        if token["revoked_at"] is not None:
            # Only the grace path revokes a single refresh row on a live grant: presenting one is
            # the race the grace's safety argument relies on catching.
            return await _revoke_family(conn, grant_id)
        if token["used_at"] is not None:
            successor = None
            if token["replaced_by"] is not None:
                successor = await conn.fetchrow(
                    "SELECT id, created_at, used_at, revoked_at FROM public.oauth_tokens "
                    "WHERE id = $1 FOR UPDATE",
                    token["replaced_by"],
                )
            within = clock - token["used_at"] <= timedelta(seconds=REFRESH_GRACE_SECONDS)
            if not (
                within
                and successor is not None
                and successor["used_at"] is None
                and successor["revoked_at"] is None
            ):
                return await _revoke_family(conn, grant_id)
            grace = True

        recorded = token["resource"]
        if resource is not None and canonical_resource(resource) != canonical_resource(recorded):
            return RotationOutcome("wrong_resource", grant_id)

        if grace:
            # Revoke the unused successor PAIR: the refresh row and the access row issued beside
            # it (same grant, same created_at — issue_token_pair writes both in one statement).
            await conn.execute(
                "UPDATE public.oauth_tokens SET revoked_at = now() "
                "WHERE grant_id = $1 AND created_at = $2 AND revoked_at IS NULL",
                grant_id,
                successor["created_at"],
            )
        else:
            await conn.execute(
                "UPDATE public.oauth_tokens SET used_at = now() WHERE id = $1", token["id"]
            )

        slid = await conn.fetchrow(
            f"UPDATE public.api_keys SET expires_at = now() + make_interval(days => $2) "
            f"WHERE id = $1 RETURNING {_AUTH_COLUMNS}",
            grant_id,
            GRANT_TTL_DAYS,
        )
        _access_id, refresh_id = await issue_token_pair(
            conn,
            grant_id=grant_id,
            access_hash=new_access_hash,
            refresh_hash=new_refresh_hash,
            resource=recorded,
            refresh_expires_at=slid["expires_at"],
        )
        await conn.execute(
            "UPDATE public.oauth_tokens SET replaced_by = $2 WHERE id = $1", token["id"], refresh_id
        )
        await conn.execute(
            f"DELETE FROM public.oauth_tokens WHERE grant_id = $1 AND ("
            f"(kind = 'access' AND expires_at < now() - {_PRUNE_ACCESS_AFTER}) OR "
            f"(kind = 'refresh' AND used_at IS NOT NULL AND used_at < now() - {_PRUNE_USED_REFRESH_AFTER}))",
            grant_id,
        )
        return RotationOutcome("grace_rotated" if grace else "rotated", grant_id, dict(slid))


async def _revoke_family(conn: Any, grant_id: UUID) -> RotationOutcome:
    """D-19: a reused refresh token revokes the WHOLE grant and every token it holds."""
    await conn.execute(
        "UPDATE public.api_keys SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL", grant_id
    )
    await conn.execute(
        "UPDATE public.oauth_tokens SET revoked_at = now() WHERE grant_id = $1 AND revoked_at IS NULL",
        grant_id,
    )
    logger.warning("oauth refresh reuse: grant %s revoked with its whole family", grant_id)
    return RotationOutcome("reuse_revoked", grant_id)
