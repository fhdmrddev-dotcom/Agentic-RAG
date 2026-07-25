"""Phase 182 (VALID-01 / D-182-R2-01) — the canvas off-switch's request-path gate.

REVERT-01 / REVERT-02 (operator HARD gate #1) promise that, with
``visual_workflow_canvas`` off, the product is byte-identical to one where the canvas was
never built. ``Depends(require_canvas())`` (dependencies.py) delivers most of that, but
one channel sits structurally OUTSIDE the dependency-injection layer and leaked the gated
routes' existence to an anonymous caller: **the request path itself.**

FastAPI decodes the request body in ``get_request_handler`` BEFORE ``solve_dependencies``
runs, so a MALFORMED body 422'd ahead of the gate's 404 (``POST /workflows/validate``
carrying ``b"{"`` -> 422 ``json_invalid``). Starlette's router likewise answers a
wrong-method probe with 405 and a trailing-slash probe with a 307 redirect — both BEFORE
any dependency runs. No rewrite of ``require_canvas`` can fix that; the flag decision has
to happen before routing. So it happens here.

Design decisions baked in here:

* **Pure ASGI — deliberately NOT built on Starlette's ``BaseHTTP`` middleware base class**
  (mirrors ``MaintenanceMiddleware``, whose module docstring names that base class and its
  hazard in full). The app streams every chat/workflow response over SSE (CLAUDE.md); that
  base class wraps the response body through an anyio memory stream and would sit in front
  of every SSE stream in the app. A plain-class ASGI middleware either short-circuits with a
  plain 404 or passes the scope through **untouched**.
* **Fail-CLOSED on a cold/blip read (D-181-02)** — deliberately the OPPOSITE polarity to
  the ``MaintenanceMiddleware`` analog. See ``_read_canvas_is_off``.
* **``Depends(require_canvas())`` STAYS on both routes** (D-182-05, defense in depth).
  This middleware owns ONLY the master off-switch; caller resolution and the
  operator / everyone / role audience decision stay in the dependency, so a future mount
  under a different prefix still meets the route-level gate.
"""
from __future__ import annotations

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

# THE ONE source of canvas-gated absolute paths for the whole app. When Phase 183+ mounts a
# new canvas route, add its absolute path HERE in the SAME commit that mounts it — that
# single edit is what makes the route non-discoverable while off. (Router prefix is
# "/workflows", hence the absolute form.)
CANVAS_GATED_PATHS: frozenset[str] = frozenset(
    {
        "/workflows/validate",
        "/workflows/grounding-bundle",
    }
)


def _read_canvas_is_off() -> bool:
    """True when ``visual_workflow_canvas`` is off — the master revert switch.

    Reads the per-worker 30s TTL settings cache through ``feature_audience`` — a pure
    in-memory read (NO per-request DB call of any kind, D-v2.5-01), so it never blocks the
    event loop. ``feature_audience`` is documented never to raise (a cold cache / DB blip /
    missing key resolves to the hardcoded default, which for this key is ``"off"``).

    FAIL-CLOSED (``True`` = gate ON) on ANY read failure — the DELIBERATE OPPOSITE of the
    ``MaintenanceMiddleware`` analog this file otherwise mirrors. Maintenance fails OPEN
    (D-Q4) because a settings blip must never wedge the whole platform read-only; the canvas
    fails CLOSED (D-181-02) because a settings blip must never REVEAL a gated route. Same
    shape, opposite polarity, for opposite reasons.

    ``feature_audience`` is lazy-imported inside the function to avoid the
    user_settings -> middleware import cycle (matches ``require_canvas``'s lazy import).
    """
    try:
        from app.models.user_settings import feature_audience

        return feature_audience("visual_workflow_canvas") == "off"
    except Exception:  # noqa: BLE001 — defensive: any read failure => gated (D-181-02)
        return True


def _is_canvas_path(path: str) -> bool:
    """True if ``path`` is a canvas-gated route, normalizing ONE trailing slash first.

    The normalization closes the trailing-slash escape. Starlette's ``redirect_slashes``
    issues a 307 for ``/workflows/validate/`` ONLY because the slash-stripped path DOES
    match a mounted route — so without normalization the redirect itself (and the 422 that
    follows it) would advertise the route's existence.
    """
    if len(path) > 1 and path.endswith("/"):
        path = path[:-1]
    return path in CANVAS_GATED_PATHS


class CanvasGateMiddleware:
    """Pure-ASGI 404 gate for the canvas paths while ``visual_workflow_canvas`` is off."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        # Only guard HTTP requests — websocket / lifespan scopes pass through untouched.
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")

        # Gate on PATH ONLY — NEVER on method. A path that was never built answers the SAME
        # way for every method, so restricting the gate to POST/GET would leave the
        # wrong-method probe advertising the surface: ``GET /workflows/validate`` returns
        # 405 "Method Not Allowed" today, which admits a POST handler is declared at exactly
        # that path. Path-only matching folds that into the same 404.
        if _is_canvas_path(path) and _read_canvas_is_off():
            # Byte-identity with an unbuilt path IS the contract: exactly the payload
            # ``dependencies._NOT_FOUND`` produces through FastAPI's http_exception_handler
            # and exactly the payload Starlette's unmatched-route 404 produces. No custom
            # message, no extra headers, no WWW-Authenticate.
            response = JSONResponse(status_code=404, content={"detail": "Not Found"})
            await response(scope, receive, send)
            return

        await self.app(scope, receive, send)
