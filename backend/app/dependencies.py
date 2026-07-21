import json
import logging
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import AsyncIterator

import asyncpg
import httpx
import redis.asyncio as aioredis
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import create_client, Client, ClientOptions

from app.config import settings
from app.services.operator_service import is_operator, write_operator_audit

logger = logging.getLogger(__name__)

bearer_scheme = HTTPBearer()

_supabase: Client | None = None


def get_supabase() -> Client:
    global _supabase
    if _supabase is None:
        _supabase = create_client(settings.supabase_url, settings.supabase_service_role_key)
    return _supabase


_redis: aioredis.Redis | None = None


def get_redis() -> aioredis.Redis:
    """Return the singleton async Redis client (Phase 061 — D-061-13).

    Mirrors get_supabase(): module-level cache, lazy init, no I/O at call
    time (from_url only sets up pool config; the first awaited command
    does the TCP connect). Closed in app lifespan via await aclose().

    decode_responses=True: XREAD entries arrive as str (not bytes) so the
    consumer can json.loads(entry['data']) without a manual .decode().
    socket_timeout / socket_connect_timeout: defense against Pitfall 7
    (producer's finally hanging on a half-dead Redis socket).
    """
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
            socket_timeout=10,
            socket_connect_timeout=5,
        )
    return _redis


_pg_pool: asyncpg.Pool | None = None


async def _init_pg_connection(conn: asyncpg.Connection) -> None:
    """Register JSONB codec on every newly-created Connection (Phase 073 — D-073-06).

    D-073-06 wording references ``pool.set_type_codec`` but asyncpg has NO such
    pool-level method (Pitfall 5). Codec registration happens per Connection via
    the ``init=`` callback passed to ``create_pool``. Semantically identical: the
    codec is set once per Connection at pool init.

    Without this, asyncpg returns jsonb as ``str`` (forcing per-call json.loads)
    and accepts jsonb writes as ``str`` only (forcing per-call json.dumps).
    Registering here lets call sites pass plain Python dicts/lists for
    tool_calls / source_refs / confidence_* / runs.error.
    """
    await conn.set_type_codec(
        'jsonb',
        encoder=json.dumps,
        decoder=json.loads,
        schema='pg_catalog',
    )


async def get_pg_pool() -> asyncpg.Pool:
    """Return the singleton asyncpg pool (Phase 073 — D-073-01/02/03/06).

    Mirrors ``get_redis()``: module-level cache, lazy init at first call, no I/O
    at call time (``create_pool`` returns immediately; the first acquire does the
    TCP handshake). Closed in app lifespan via ``await pool.close()`` with a
    ``asyncio.wait_for(..., timeout=5.0)`` fallback to ``pool.terminate()``
    (Pitfall 4 — pool.close() can wedge on stuck queries).

    DSN comes from POSTGRES_DSN env var (D-073-02). Pool sized via
    POSTGRES_POOL_MIN / POSTGRES_POOL_MAX (D-073-03, default 2/10 — leaves
    headroom for Phase 079 ``--workers 2`` at effective ceiling 20 connections).

    Event-loop binding (Pitfall 1): the pool is bound to whatever event loop
    called ``create_pool``. In tests, this requires the ``_reset_pg_pool_singleton``
    autouse fixture (D-073-12, Task 4) to reset between tests.
    """
    global _pg_pool
    if _pg_pool is None:
        _pg_pool = await asyncpg.create_pool(
            settings.postgres_dsn,
            min_size=settings.postgres_pool_min,
            max_size=settings.postgres_pool_max,
            init=_init_pg_connection,
            command_timeout=30,
        )
    return _pg_pool


# ── Phase 163 (TEN-01/TEN-02) — Front-B per-request DB-context factories ───────
# THE atomic-crux seam: turn a validated request identity into an RLS-ENFORCED DB
# context. These are ADDITIVE + dead-until-wired — Wave-4 plans swap the router
# ``Depends`` seams onto them; nothing here changes app behavior yet. The existing
# ``get_supabase()`` / ``get_pg_pool()`` / ``get_current_user()`` seams stay the
# source of truth and are byte-unchanged.
#
# D-04 note: local JWKS / ES256 verification (PyJWT ``PyJWKClient``) is an OPTIONAL
# future latency optimization on ``get_current_user()``'s GoTrue round-trip — it is
# NOT wired here and is NOT a blocker. The ``SET LOCAL`` claims below come straight
# from the already-validated ``current_user["id"]``; GoTrue validation stays the
# fallback. The role swap + claims are decoupled from that optimization by design.


async def _apply_rls_user_context(conn: asyncpg.Connection, uid: str) -> None:
    """Turn RLS ON for ``uid`` on an ACQUIRED connection inside an OPEN transaction.

    THE load-bearing sequence (do not reorder):

    1. ``SET LOCAL ROLE authenticated`` FIRST — the pool DSN role is ``postgres``
       (BYPASSRLS), so setting claims WITHOUT this role swap is a silent no-op
       (Pitfall 1). This is the single line that actually turns RLS on; a
       bare-claims connection keeps ``current_user = postgres`` and sees every row.
    2. BOTH GUC forms, PARAMETERIZED (never string-interpolated — SQLi): the legacy
       per-claim ``request.jwt.claim.sub`` (local-safe) AND the JSON blob
       ``request.jwt.claims`` (cloud). Setting both makes ``auth.uid()`` resolve
       regardless of which variant THIS database's ``auth.uid()`` reads (D-02).
    3. ``is_local := true`` (the 3rd ``set_config`` arg) — MANDATORY on the shared
       pool: every ``SET LOCAL`` auto-reverts at COMMIT, so claims can never leak to
       the next pool borrower (Pitfall 3). ``false`` would leak identity across users.

    Reused verbatim by the Phase-163 test harness (``tests/integration/_rls_harness``)
    so the request factory and the leak / cluster tests can never drift on the exact
    role-first + both-GUC-forms shape.
    """
    await conn.execute("SET LOCAL ROLE authenticated")
    await conn.execute(
        "SELECT set_config('request.jwt.claim.sub', $1, true)", str(uid)
    )
    await conn.execute(
        "SELECT set_config('request.jwt.claims', $1, true)",
        json.dumps({"sub": str(uid), "role": "authenticated"}),
    )


@asynccontextmanager
async def get_user_pg_connection(
    request: Request, current_user: dict
) -> AsyncIterator[asyncpg.Connection]:
    """Acquire an RLS-enforced asyncpg connection for the current user (D-02).

    Reuses the EXISTING singleton pool (``get_pg_pool()`` — no new pool, no new DSN).
    Opens a transaction, applies the role swap + both-GUC-forms context, and yields
    the connection; the COMMIT at context exit auto-reverts every ``SET LOCAL``.

    ``request`` is accepted for the router ``Depends`` contract (Wave-4 wiring). The
    claims come SOLELY from ``current_user["id"]`` — already validated by
    ``get_current_user`` — so this is decoupled from the optional D-04 JWKS path.
    """
    uid = current_user["id"]
    pool = await get_pg_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            await _apply_rls_user_context(conn, uid)
            yield conn


_shared_httpx: httpx.Client | None = None


def _get_shared_httpx() -> httpx.Client:
    """Lazy shared SYNC httpx transport for the per-request user-JWT supabase clients.

    Reusing ONE transport across per-request clients avoids a connection-pool fanout
    under load (Pitfall 2). Mirrors the ``get_redis()`` / ``get_pg_pool()`` lazy
    singleton shape; the app lifespan closes it best-effort alongside them.
    """
    global _shared_httpx
    if _shared_httpx is None:
        _shared_httpx = httpx.Client()
    return _shared_httpx


def get_user_supabase(request: Request, current_user: dict, token: str) -> Client:
    """Build a NEW per-request supabase-py client bound to the caller's JWT (D-03).

    Uses the ANON key + an ``Authorization: Bearer <token>`` header so PostgREST runs
    as ``authenticated`` and RLS is ENFORCED. It NEVER mutates the shared
    ``get_supabase()`` singleton — mutating that singleton's PostgREST auth header
    races across concurrent requests / ``WORKER_COUNT=2`` workers and bleeds one
    user's identity into another's request (Pitfall 2). A shared httpx transport
    avoids per-request connection fanout.

    supabase-py calls still BLOCK — callers keep their ``run_in_threadpool`` wrapper
    (D-v2.5-01); do NOT remove it.
    """
    return create_client(
        settings.supabase_url,
        settings.supabase_anon_key,  # ANON key — NOT service_role (which BYPASSES RLS)
        options=ClientOptions(
            headers={"Authorization": f"Bearer {token}"},
            httpx_client=_get_shared_httpx(),
        ),
    )


def get_service_role_supabase(org_id: str) -> Client:
    """Hardened service-role (BYPASSRLS) client factory — REFUSES a missing org (D-05).

    Mirrors ``get_supabase()`` construction but RAISES when ``org_id`` is falsy: a
    BYPASSRLS client must never be built without an explicit org scope. Retained ONLY
    for the four fully-async writers (agent loop, eval runner, harness engine,
    re-embed) + legitimate cross-tenant ops, whose queries add an ``org_id``
    predicate. Mirrors the refuse-without-scope posture of ``require_operator``.
    """
    if not org_id:
        raise ValueError("get_service_role_supabase requires an explicit org_id")
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


async def _is_banned(user_id: str) -> bool:
    """Phase 148 (T-148-02 / T-148-04) — is this user disabled (banned_until in the future)?

    Reads ``auth.users.banned_until`` via the singleton asyncpg pool (~1ms). Returns True
    ONLY for a real FUTURE ``banned_until``; False for NULL / past. FAILS OPEN — any read
    exception returns False so a transient DB blip can NEVER lock out every user (the
    "no self-inflicted outage" polarity — matches the maintenance_mode default-OPEN
    posture). The stateless-JWT window is already bounded and the ban is re-enforced on
    the next successful read. Do NOT trust ``supabase.auth.get_user`` to reject a live
    token's ban — it does not (Pitfall 1); this app-layer check is the enforcement seam.
    """
    try:
        pool = await get_pg_pool()
        row = await pool.fetchrow(
            "SELECT banned_until FROM auth.users WHERE id = $1", user_id
        )
        bu = row and row["banned_until"]
        return bu is not None and bu > datetime.now(timezone.utc)
    except Exception:
        return False  # fail-OPEN — re-enforced on the next successful read


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    supabase: Client = Depends(get_supabase),
) -> dict:
    token = credentials.credentials
    try:
        response = supabase.auth.get_user(token)
        if response.user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        identity = {"id": response.user.id, "email": response.user.email}
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    # Phase 148 (ADMIN-03 / T-148-02) — app-layer ban check. AFTER the token validates
    # and OUTSIDE the auth try/except above (so this 403 is NOT folded into the 401).
    # Closes the ~1h stateless-JWT window: a banned user's live token stays valid until
    # exp, so only a per-request DB check locks them out. _is_banned fails OPEN.
    if await _is_banned(identity["id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is disabled — contact your administrator.",
        )
    return identity


# ── Phase 163 (TEN-02) — the FastAPI-injectable user-JWT client seam ───────────
# ``get_user_supabase`` (above) takes an EXPLICIT ``token`` arg (called directly by
# the Phase-163 test harness with a literal token), so it is not itself
# ``Depends()``-able — FastAPI cannot resolve a bare ``token: str``. This thin async
# adapter IS the router ``Depends()`` seam the Wave-4 chat/workspace handlers swap
# onto: it resolves the validated identity (``get_current_user``) + the raw bearer
# token (``bearer_scheme`` — the SAME token ``get_current_user`` just validated) and
# hands both to the factory. FastAPI caches ``get_current_user`` per-request, so a
# handler declaring BOTH ``current_user`` and this client still resolves
# ``get_current_user`` exactly once. run_in_threadpool still wraps the blocking
# supabase-py calls at every call site (D-v2.5-01); the client returned here is
# per-request + ANON-key+Bearer, so RLS is ENFORCED on the swapped read/write path.
async def get_user_supabase_client(
    request: Request,
    current_user: dict = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> Client:
    return get_user_supabase(request, current_user, credentials.credentials)


# ── Phase 146 (ADMIN-01) — operator gate + append-only audit floor ────────────
# Byte-identical to Starlette's unknown-route 404 (non-discoverable). Do NOT
# customize the body — the whole point is that a non-operator cannot tell an
# /admin route exists-but-forbidden vs. simply not existing (404-not-403).
_NOT_FOUND = HTTPException(status_code=404, detail="Not Found")

# WR-02: /admin gets its OWN bearer scheme with auto_error=False, used ONLY by the
# operator gate. The shared ``bearer_scheme`` (auto_error=True) raises 403 on an
# ABSENT Authorization header — so a request with no JWT to a real /admin route
# returned 403 while /admin/<unknown> returned 404, letting an anonymous scanner
# enumerate gated routes (defeating the non-discoverability claim). auto_error=False
# hands us ``None`` for absent credentials so we fold every auth failure into the
# SAME byte-identical 404. The shared get_current_user path is unchanged.
_admin_bearer_scheme = HTTPBearer(auto_error=False)

# Plain-sentence label + machine action code, keyed by /admin path. Endpoints may
# also set request.state.audit_label / audit_action explicitly; these are the
# route-derived fallbacks the floor uses when they did not.
_AUDIT_LABELS: dict[str, tuple[str, str]] = {
    "/admin/backpressure": ("Viewed system health", "health.view"),
    "/admin/audit": ("Viewed recent actions", "audit.view"),
}


# WR-03: the audit floor exists so a future /admin endpoint is audited "by
# construction" even when its author forgets the explicit request.state.audit_*
# enrichment. The route-derived fallback must therefore reflect the HTTP method:
# a mutating method (POST/PUT/PATCH/DELETE) that forgot to set state must NOT be
# recorded as a harmless ".view" read with no write mark — that under-reports
# exactly the destructive actions the floor exists to catch.
_WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def _derive_plain_label(request: Request) -> str:
    return _AUDIT_LABELS.get(request.url.path, ("Performed an operator action", ""))[0]


def _derive_action(request: Request) -> str:
    known = _AUDIT_LABELS.get(request.url.path)
    if known:
        return known[1]
    # "<area>.<verb>" fallback: last non-'admin' path segment + method-derived verb
    # (GET -> "view"; any mutating method -> "write") so the floor never labels a
    # forgotten write endpoint as a read (WR-03).
    parts = [p for p in request.url.path.split("/") if p and p != "admin"]
    area = parts[-1] if parts else "admin"
    verb = "view" if request.method == "GET" else "write"
    return f"{area}.{verb}"


async def authenticate_operator_request(
    credentials: HTTPAuthorizationCredentials | None = Depends(_admin_bearer_scheme),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Resolve the caller for the /admin surface, folding EVERY auth failure into 404.

    WR-02: the non-discoverability contract (404-not-403) must hold BEFORE auth, not
    only after. This uses the dedicated ``_admin_bearer_scheme`` (auto_error=False) so
    an ABSENT Authorization header yields ``None`` here (instead of the shared scheme's
    403), and an invalid/expired token — or any resolution error — is folded into the
    SAME byte-identical ``_NOT_FOUND``. An anonymous scanner therefore cannot tell a
    gated /admin route (404) apart from a nonexistent one (404).

    A dedicated dependency (rather than reusing ``get_current_user``) keeps the shared
    auth path untouched AND gives tests a clean override seam (conftest overrides this
    to inject a fake operator identity; the WR-02 regression pops the override to
    exercise the real pre-auth 404 path).

    WR-01 (Phase 148 review): the app-layer ban check must cover the /admin seam too.
    ``get_current_user`` enforces ``_is_banned``, but /admin authenticates HERE and never
    called it — so a disabled operator's still-valid JWT kept full /admin access until
    token expiry (and could ``POST /admin/users/{self}/enable`` to lift their own ban, or
    disable the operator who disabled them). A banned operator is folded into the SAME
    byte-identical ``_NOT_FOUND`` — NEVER a discoverable 403 — so /admin stays
    non-discoverable, and the check FAILS OPEN exactly like ``_is_banned`` (a transient DB
    blip returns False, never locking operators out). The shared ``get_current_user`` flow
    is not touched.
    """
    if credentials is None:
        raise _NOT_FOUND
    try:
        response = supabase.auth.get_user(credentials.credentials)
        user = getattr(response, "user", None)
    except Exception:
        raise _NOT_FOUND
    if user is None:
        raise _NOT_FOUND
    # WR-01: fold a banned operator into the byte-identical 404 (fail-OPEN via _is_banned).
    if await _is_banned(user.id):
        raise _NOT_FOUND
    return {"id": user.id, "email": user.email}


async def require_operator(
    request: Request,
    current_user: dict = Depends(authenticate_operator_request),
) -> dict:
    """Router-level default-deny gate for every /admin route (Pattern 1).

    ``authenticate_operator_request`` already folded an absent/invalid JWT into a
    byte-identical 404 (WR-02). On non-membership raise the same byte-identical 404
    (non-discoverable — 404-not-403). On membership, stash the operator on
    ``request.state`` for the audit floor + the ``/admin/me`` probe, and return the
    identity. The backend runs on the service-role key with NO RLS backstop, so this
    gate is the SOLE authority (Pitfall 1). Attach at the ROUTER level (never
    per-endpoint) so a future /admin endpoint cannot forget it.
    """
    if not await is_operator(current_user["id"]):
        raise _NOT_FOUND
    request.state.operator = current_user
    return current_user


async def operator_audit_floor(
    request: Request,
    supabase: Client = Depends(get_supabase),
):
    """Append-only audit floor as a yield-dependency (Pattern 2).

    Attach PER-ACTION-ENDPOINT (never at the router level) so the ``GET /admin/me``
    mount probe stays floor-EXEMPT (Pitfall 4 — probes must not spam the ledger). The
    teardown runs AFTER the response (off the latency path): it reads an enrich
    label/action/is_write from ``request.state`` (falling back to a route-derived plain
    label/action), and writes exactly ONE ``operator_audit_log`` row — no UPDATE,
    preserving immutability. Wrapped in try/except that logs and swallows — the floor
    never raises into the request.
    """
    yield
    try:
        op = getattr(request.state, "operator", None)
        if op is None:
            return  # the gate already 404'd a non-operator — nothing to record
        label = getattr(request.state, "audit_label", None) or _derive_plain_label(request)
        action = getattr(request.state, "audit_action", None) or _derive_action(request)
        # WR-03: floor is_write from the HTTP method when the endpoint didn't set it,
        # so a forgotten write endpoint isn't recorded as a read (is_write=False).
        is_write = getattr(request.state, "audit_is_write", None)
        if is_write is None:
            is_write = request.method in _WRITE_METHODS
        await write_operator_audit(
            operator_user_id=op["id"],
            action=action,
            label=label,
            is_write=is_write,
            metadata={},
            supabase=supabase,
        )
    except Exception as exc:
        logger.error("operator audit floor failed: %s", exc)  # swallow (D-05 precedent)


# ── Phase 148 (VIS-01) — per-endpoint feature-visibility gate ──────────────────
def require_visible(feature: str):
    """VIS-01 API-layer visibility gate (D-03). A dependency FACTORY.

    Returns an async dependency that is a literal NO-OP for operators AND for
    Everyone-audience features (Deep Mode / the Run + chat-model-picker carve-outs stay
    byte-identical), and raises **403 — NOT 404** for a non-operator hitting an
    Operators-only feature. The /admin surface keeps its byte-identical 404; a governed
    product feature is a deliberate 403 an end user can understand (these are features
    they may legitimately have seen before a flip). ``is_operator`` is the ONE swappable
    boundary — SEED-115 later flips it to "is in group X" with zero change here.

    Attach PER-ENDPOINT on the governed authoring/management endpoints ONLY — never at a
    router level that would gate a Run/chat carve-out (``GET /settings/providers``,
    ``GET /workflows/published|starters``, the workflow launch). ``feature_audience`` is
    lazy-imported inside the closure to avoid an import cycle (user_settings -> deps).
    """
    async def _dep(current_user: dict = Depends(get_current_user)):
        if await is_operator(current_user["id"]):
            return  # operator -> no-op
        from app.models.user_settings import feature_audience
        if feature_audience(feature) == "everyone":
            return  # Everyone-audience feature -> no-op (carve-out byte-identical)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This feature is available to administrators only.",
        )
    return _dep


# ── Phase 166 (ADMIN-01/02/04) — org authz: active-org resolution + org:manage gate ──
# The user-side mirror of require_operator, but gated on org PERMISSIONS (mig 104's
# current_user_has_permission SECDEF helper) instead of operator membership. D-166-09: no
# route called that helper before Phase 166 — this is the net-new enforcement layer.
#
# THE load-bearing security beat (D-166-06 / T-166-01): the X-Org-Id header is NEVER
# trusted. get_active_org_id validates it against the caller's org_members on a user-JWT/RLS
# connection (auth.uid() resolves to the caller) — a non-member org is a 403.
# current_user_has_permission likewise MUST run AS THE CALLER (its body reads auth.uid(),
# mig 104:197) — always on get_user_pg_connection, never the BYPASSRLS pool (T-166-04).


def _to_uuid(value: str) -> uuid.UUID | None:
    """Parse a client-supplied org id into a ``uuid.UUID`` (asyncpg-native), or None if malformed.

    asyncpg binds a ``uuid.UUID`` natively to a uuid column; a malformed string would raise a
    22P02 at the DB. Parsing here turns an invalid/untrusted X-Org-Id into a clean non-member
    403 (never a 500) — the header is untrusted input (D-166-06).
    """
    try:
        return uuid.UUID(str(value))
    except (ValueError, AttributeError, TypeError):
        return None


async def _has_org_permission(
    request: Request, current_user: dict, org_id: str, permission_key: str
) -> bool:
    """The single org-permission seam (mirrors is_operator as the one swappable boundary).

    Runs mig 104's ``current_user_has_permission(p_org_id, p_permission_key)`` SECDEF helper
    AS THE CALLER on a user-JWT connection — the helper body reads ``auth.uid()`` (mig
    104:197), so a BYPASSRLS/service-role connection (no ``auth.uid()``) would evaluate
    postgres's permissions, not the caller's (T-166-04). Parameterized ``$1/$2`` binds — never
    f-string SQL. Used by ``require_org_manage`` AND the ``/org/audit`` org:audit_view branch
    (D-166-09, ADMIN-04).
    """
    async with get_user_pg_connection(request, current_user) as conn:
        allowed = await conn.fetchval(
            "SELECT public.current_user_has_permission($1, $2)",
            _to_uuid(org_id),
            permission_key,
        )
    return bool(allowed)


async def get_active_org_id(
    request: Request, current_user: dict = Depends(get_current_user)
) -> str:
    """Resolve + validate the caller's active org (D-166-06 / T-166-01).

    Reads the ``X-Org-Id`` request header and VALIDATES it against the caller's
    ``org_members`` on a user-JWT/RLS connection (``auth.uid()`` resolves to the caller,
    never the service-role/BYPASSRLS pool) — a spoofed/non-member org is a 403, NEVER
    trusted. Header absent: resolve the caller's default org — exactly one membership uses it;
    zero → 403; 2+ → 400 (the frontend always sends the header once the switcher exists).
    Stashes ``request.state.active_org`` + ``request.state.org_role`` for the endpoints/band;
    returns the validated org_id string. Every query is a ``$1`` bind (never f-string SQL).
    """
    header_org = request.headers.get("X-Org-Id")
    async with get_user_pg_connection(request, current_user) as conn:
        if header_org:
            org_uuid = _to_uuid(header_org)
            if org_uuid is None:
                # A malformed header can never match a real membership — treat as non-member.
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You are not a member of this organization.",
                )
            row = await conn.fetchrow(
                "SELECT role FROM public.org_members WHERE org_id = $1 AND user_id = auth.uid()",
                org_uuid,
            )
            if row is None:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You are not a member of this organization.",
                )
            request.state.active_org = str(header_org)
            request.state.org_role = row["role"]
            return str(header_org)
        rows = await conn.fetch(
            "SELECT org_id, role FROM public.org_members "
            "WHERE user_id = auth.uid() ORDER BY created_at"
        )
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not belong to any organization.",
        )
    if len(rows) > 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-Org-Id header required.",
        )
    active = str(rows[0]["org_id"])
    request.state.active_org = active
    request.state.org_role = rows[0]["role"]
    return active


async def require_org_manage(
    request: Request,
    current_user: dict = Depends(get_current_user),
    active_org: str = Depends(get_active_org_id),
) -> dict:
    """org:manage gate for the manager-only /org reads (ADMIN-01 default-deny).

    Calls ``_has_org_permission(active_org, 'org:manage')`` AS THE CALLER (D-166-09). On
    False → 403 (a legitimate product feature, NOT the /admin byte-identical 404 — mirrors
    require_visible:471-474). FastAPI dedupes the shared ``get_active_org_id`` resolution, so
    an endpoint declaring both resolves + validates the active org exactly once.
    """
    if not await _has_org_permission(request, current_user, active_org, "org:manage"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to manage this organization.",
        )
    return current_user
