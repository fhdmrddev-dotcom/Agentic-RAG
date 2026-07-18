"""Phase 147 (FLAG-01 / D-06) — maintenance / read-only write-block middleware.

A SINGLE cross-cutting seam that rejects mutating requests while the platform is in
maintenance mode, so a future endpoint can never silently escape the write-block (the
alternative — a per-route dependency — would be forgotten on the next new route).

Design decisions baked in here:

* **Pure ASGI, NOT ``BaseHTTPMiddleware``.** The app streams every chat/workflow
  response over SSE (CLAUDE.md). ``BaseHTTPMiddleware`` wraps the response body through
  an anyio memory stream and can interfere with / buffer streaming responses. A pure
  ASGI middleware either short-circuits a blocked request with a plain 503 or passes the
  scope through **untouched**, so it is byte-transparent to the SSE hot path.

* **Off-switch-safe allowlist (Pitfall 4 — MUST be exactly right).** If the write-block
  blocked its own off-switch, maintenance would be a one-way trap. The allowlist keeps
  reachable, even under maintenance: any ``/auth/*`` (login), **ALL** ``/admin/*`` (the
  operator flag-write ``PUT /admin/flags`` that turns maintenance back OFF), and
  ``DELETE /runs/{id}`` (users self-cancelling their own in-flight run). Reads
  (``GET``/``HEAD``) and CORS preflight (``OPTIONS``) always pass.

* **Fail-OPEN on a cold/blip read (D-Q4).** The flag is read from the per-worker 30s TTL
  settings cache via the plan-01 ``maintenance_mode()`` helper — a pure in-memory read
  (NO per-request supabase/DB call, D-v2.5-01), so it never blocks the event loop. Any
  read failure / cold cache resolves to ``False`` (platform OPEN): a transient
  settings-read failure must never wedge the whole platform read-only.

Placement (``main.py``): registered BEFORE CORS so CORS ends up OUTERMOST (Starlette
applies ``add_middleware`` in reverse registration order). CORS-outermost keeps preflight
answerable in maintenance AND ensures a 503 write-block still carries CORS headers (so a
browser can READ the 503 instead of surfacing an opaque CORS error).
"""
from __future__ import annotations

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

# Reads + CORS preflight — always pass, maintenance on or off.
_PASSTHROUGH_METHODS: frozenset[str] = frozenset({"GET", "HEAD", "OPTIONS"})
# Only these mutating methods can ever be blocked.
_BLOCKED_METHODS: frozenset[str] = frozenset({"POST", "PUT", "PATCH", "DELETE"})
# Path prefixes that ALWAYS pass, even under maintenance:
#   /auth  -> login/session (an operator must be able to log in to reach the off-switch)
#   /admin -> ALL operator routes, incl. PUT /admin/flags (the off-switch itself)
_ALLOWLIST_PREFIXES: tuple[str, ...] = ("/auth", "/admin")


def _read_maintenance() -> bool:
    """Return the current maintenance flag via the per-worker TTL-cached settings.

    Reads the in-memory settings cache through the plan-01 ``maintenance_mode()``
    helper — a pure in-memory read (NO per-request DB / supabase call, D-v2.5-01), so it
    never blocks the event loop. Fail-OPEN (``False``) on ANY read failure / cold cache
    (D-Q4): a settings blip must never wedge the whole platform read-only.
    """
    try:
        from app.models.user_settings import maintenance_mode

        return maintenance_mode()
    except Exception:  # noqa: BLE001 — defensive: cold cache / read failure => OPEN (D-Q4)
        return False


def _is_allowlisted(method: str, path: str) -> bool:
    """True if ``method``+``path`` must pass even under maintenance (Pitfall 4)."""
    # Reads + CORS preflight always pass.
    if method in _PASSTHROUGH_METHODS:
        return True
    # Login + ALL /admin/* (the off-switch) stay reachable. Match on a path-segment
    # boundary so a sibling like ``/administrate`` is NOT falsely allowlisted.
    for prefix in _ALLOWLIST_PREFIXES:
        if path == prefix or path.startswith(prefix + "/"):
            return True
    # Users self-cancelling their own in-flight run (DELETE /runs/{id}).
    if method == "DELETE" and path.startswith("/runs/"):
        return True
    return False


class MaintenanceMiddleware:
    """Pure-ASGI write-block for D-06 maintenance/read-only mode."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        # Only guard HTTP requests — websocket / lifespan scopes pass through untouched.
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return

        method = str(scope.get("method", "GET")).upper()
        path = scope.get("path", "")

        # Block ONLY a mutating, non-allowlisted request while maintenance is ON.
        # The allowlist check runs first (cheap, in-memory) so allowlisted/GET traffic
        # never even reads the flag.
        if (
            method in _BLOCKED_METHODS
            and not _is_allowlisted(method, path)
            and _read_maintenance()
        ):
            response = JSONResponse(
                status_code=503,
                content={
                    "error": "maintenance",
                    "message": "maintenance mode — read-only",
                },
            )
            await response(scope, receive, send)
            return

        await self.app(scope, receive, send)
