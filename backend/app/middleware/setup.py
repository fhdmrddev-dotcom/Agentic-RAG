"""Phase 158 (DEPLOY-02, Plan 03 / D-04) — SetupMiddleware: the pure-ASGI first-run gate.

Mirrors ``MaintenanceMiddleware`` (``middleware/maintenance.py:80``) EXACTLY — a pure-ASGI
middleware (a response-body-buffering middleware class would break the SSE hot path, which
is the whole reason maintenance.py is pure-ASGI too) — with the polarity INVERTED:
maintenance blocks only mutating, non-allowlisted requests; setup blocks EVERYTHING except
the allowlist until finalized, then LATCHES to a literal no-op.

The byte-identical invariant (D-17 / G-6(a)): once ``setup_finalized()`` reads True, the
per-worker ``_finalized_latch`` caches True and every subsequent request is a single
``if _is_finalized(): passthrough`` — one bool check, zero I/O. A configured box behaves
exactly as if this middleware were absent (proven by ``test_configured_box_noop``).

Gate authority is the FILE marker (via ``setup_store.setup_finalized()``), NEVER the
auditable DB flag — a DB blip must never bounce live users into the wizard (D-05).

Allowlist (backend sees UNPREFIXED paths — nginx ``rewrite ^/api/(.*)$ /$1 break`` strips
``/api``): exact ``/health``, exact ``/public-config``; prefix ``/setup`` (covering
``/setup/status``, ``/setup/validate``, …) matched on a path-segment boundary so a sibling
like ``/setupx`` is NOT falsely allowlisted (mirrors maintenance's ``/administrate`` proof).

Placement (``main.py``): registered BEFORE CORS so CORS stays OUTERMOST — a 503
``setup_required`` still carries CORS headers so the browser can READ it.
"""
from __future__ import annotations

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

# Exact-match allowlist — public liveness + the browser's Supabase creds (D-07).
_ALLOW_EXACT: frozenset[str] = frozenset({"/health", "/public-config"})
# Prefix allowlist — the wizard's own pre-auth API (segment-boundary matched below).
_ALLOW_PREFIX: tuple[str, ...] = ("/setup",)

# Monotonic finalized latch (per worker): once True, stays True — the byte-identical hot
# path (D-17). Kept distinct from ``setup_store._finalized_latch`` so the middleware's read
# seam is independently monkeypatchable (``test_setup_gate`` patches this module's
# ``_is_finalized``, exactly as ``test_147`` patches maintenance's ``_read_maintenance``).
_finalized_latch = False

# Monotonic "already configured via env" latch (per worker): once True, stays True. A box
# configured the pre-158 way (real ``supabase_url`` in env/`.env`, never ran the wizard) must
# NEVER be gated — the gate is for a GENUINELY-fresh box (placeholder infra) only. This is the
# second half of the D-05 first-run signal (``needs_setup`` = marker-absent AND
# infra-still-placeholder); the finalize latch alone over-gated every env-configured deploy.
_configured_latch = False


def _is_finalized() -> bool:
    """Return the sticky finalized state — the byte-identical hot path.

    Returns the cached ``True`` immediately once latched (one bool, zero I/O). Otherwise
    reads the blip-proof FILE marker via ``setup_store.setup_finalized()`` and latches on
    True. NEVER reads the auditable DB flag (D-05 — the file marker is the sole gate
    authority; a DB blip must never re-trigger the wizard on a live box).
    """
    global _finalized_latch
    if _finalized_latch:
        return True
    from app.services.setup_store import setup_finalized

    if setup_finalized():
        _finalized_latch = True
    return _finalized_latch


def _is_configured_via_env() -> bool:
    """True when the box is already configured via env/`.env` — a REAL ``supabase_url`` (not
    the onebox placeholder), even without a wizard finalize marker.

    A box configured the pre-158 way (env vars, never ran the wizard — every existing deploy
    and every local dev box) reads True here and is NEVER gated. Only a genuinely-fresh box
    (placeholder ``supabase_url`` AND no marker) is gated. Latches sticky-True (env cannot
    change at runtime), keeping the hot path a single bool. Independently monkeypatchable so
    ``test_setup_gate`` can drive the fresh-vs-configured distinction.
    """
    global _configured_latch
    if _configured_latch:
        return True
    from app.config import settings
    from app.services.setup_store import _is_placeholder

    if not _is_placeholder(getattr(settings, "supabase_url", "")):
        _configured_latch = True
    return _configured_latch


def _is_allowlisted(path: str) -> bool:
    """True if ``path`` must reach routing even before finalize.

    Exact ``/health`` / ``/public-config``; the ``/setup`` prefix matched on a path-segment
    boundary (``path == prefix or path.startswith(prefix + "/")``) so ``/setupx`` — a
    DIFFERENT resource that merely starts with the token — is NOT allowlisted.
    """
    if path in _ALLOW_EXACT:
        return True
    for prefix in _ALLOW_PREFIX:
        if path == prefix or path.startswith(prefix + "/"):
            return True
    return False


class SetupMiddleware:
    """Pure-ASGI first-run gate for D-04 setup mode — a literal no-op once finalized."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        # Only guard HTTP requests — websocket / lifespan scopes pass through untouched.
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return

        # Byte-identical hot path (D-17): a box that is finalized OR already configured via
        # env (real supabase_url, no wizard marker — every pre-158 / hand-filled deploy and
        # every local dev box) is a single bool check, zero I/O, ZERO scope mutation — the
        # router sees the request exactly as if we weren't here. Only a GENUINELY-fresh box
        # (placeholder infra AND no marker) falls through to the gate below.
        if _is_finalized() or _is_configured_via_env():
            await self.app(scope, receive, send)
            return

        # Pre-finalize: only allowlisted routes reach routing; everything else is gated.
        path = scope.get("path", "")
        if _is_allowlisted(path):
            await self.app(scope, receive, send)
            return

        response = JSONResponse(
            status_code=503,
            content={
                "error": "setup_required",
                "message": "first-run setup not complete — open /setup",
            },
        )
        await response(scope, receive, send)
