"""Phase 276 (DOCS-04, D-03 / D-20) — the live API explorer, gated in production.

**This reverses a recorded decision, and says so.** Phase 182 (``main.py``) kept ``GET /docs``
answering 200 in every state and noted that "App-wide ``docs_url`` gating has never been a
convention in this codebase". On 2026-10-04 the operator reversed that **for production only**:
the live explorer is a complete map of every route a deployment serves, and the public docs site
now carries a static, filtered reference (``docs/public/api/openapi.public.json``) for anyone who
is not signed in. So:

* ``ENVIRONMENT`` unset, or ``local`` / ``development`` / ``dev`` / ``test`` (any case,
  surrounding spaces ignored) -> ``/docs``, ``/redoc``, ``/openapi.json`` and
  ``/docs/oauth2-redirect`` answer 200 with no token, exactly as before.
* ~~``ENVIRONMENT=production`` (or ``prod``, any case, surrounding spaces ignored)~~ **Any other
  value** — ``production``, ``staging``, ``prd``, anything (CORRECTED, 276-REVIEW A-WR-01: the
  gate is fail-closed) -> no bearer is a 401; a bearer goes through the EXISTING
  ``get_current_user`` (GoTrue validation, the 503 on an unreachable auth service, the ban
  check). No new auth code lives here.

**Why FastAPI's built-in docs routes are switched off rather than wrapped.** ``FastAPI(docs_url=
..., openapi_url=...)`` registers plain routes that take no dependencies. ``main.py`` now passes
``docs_url=None, redoc_url=None, openapi_url=None`` and this router serves the same four paths
behind one router-level dependency.

**Why an optional bearer plus an explicit 401.** The shared ``bearer_scheme`` is
``HTTPBearer(auto_error=True)``, which in the installed FastAPI (0.115.6) answers a MISSING
header with **403** — the wrong code for "you have not signed in". ``auto_error=False`` hands us
``None`` and we raise the honest 401 with ``WWW-Authenticate: Bearer`` (same precedent as
``dependencies._admin_bearer_scheme``).

**The environment is read at REQUEST time**, never captured at import, so a test (or an operator
restart with a changed env) sees the current value. ``main.py``'s lifespan logs
``API docs: GATED`` / ``API docs: OPEN`` from the same ``_docs_gated()`` helper, so a production
deploy that forgot ``ENVIRONMENT`` says so in its boot log (D-20 fail-open guard). The OPEN line
is a WARNING when the value is set to anything but ``local`` (276-REVIEW A-WR-01).

**The canvas-aware schema hook still applies.** ``/openapi.json`` returns
``request.app.openapi()``, which is ``build_canvas_aware_openapi(app)`` — the Phase 182 filter
that hides the canvas surface while it is off. ``CanvasGateMiddleware`` keys its freshness bound
on the PATH ``/openapi.json``, which is unchanged.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.openapi.docs import (
    get_redoc_html,
    get_swagger_ui_html,
    get_swagger_ui_oauth2_redirect_html,
)
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import Client

from app.config import settings
from app.dependencies import get_current_user, get_supabase

_OPENAPI_URL = "/openapi.json"
_OAUTH2_REDIRECT_URL = "/docs/oauth2-redirect"
_TITLE = "Syrel API"

_bearer_optional = HTTPBearer(auto_error=False)


# ~~Gated only for ``production`` / ``prod``.~~ CORRECTED (276-REVIEW A-WR-01): that allow-list
# of GATED values failed OPEN for ``staging``, ``prd``, ``live``, ``production-eu`` and every
# other spelling. The predicate is now inverted — FAIL-CLOSED. Only an unset value (local dev,
# D-20) or one of these explicitly local spellings opens the explorer; every other value,
# staging included, is gated.
_OPEN_ENVIRONMENTS = frozenset({"", "local", "development", "dev", "test"})
# The open values that are quiet in the boot log. An OPEN explorer under any other open value
# (``dev``/``development``/``test``) logs at WARNING, so a deployed box carrying one is loud.
_QUIET_OPEN_ENVIRONMENTS = frozenset({"", "local"})


def _environment() -> str:
    """``settings.environment`` normalised — the ONE reader of ENVIRONMENT (A-IN-11)."""
    return (settings.environment or "").strip().lower()


def is_production_environment() -> bool:
    """True for ``production`` / ``prod`` — the refusal-to-start checks in ``main.py`` use this,
    so they read the same source of truth (pydantic ``settings``, which also loads
    ``backend/.env``) as the docs gate (276-REVIEW A-IN-11)."""
    return _environment() in ("production", "prod")


def _docs_gated() -> bool:
    """True unless ENVIRONMENT is unset or explicitly local — read per call, never cached."""
    return _environment() not in _OPEN_ENVIRONMENTS


def _docs_open_is_loud() -> bool:
    """True when the explorer is OPEN under a value that is neither unset nor ``local``."""
    return not _docs_gated() and _environment() not in _QUIET_OPEN_ENVIRONMENTS


async def require_api_docs_access(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_optional),
    supabase: Client = Depends(get_supabase),
) -> None:
    """Open locally; in production, a signed-in user only (DOCS-04)."""
    if not _docs_gated():
        return None
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sign in to view the API reference.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    # The existing validator: 401 on a bad token, 503 when GoTrue is unreachable, 403 if banned.
    await get_current_user(credentials=credentials, supabase=supabase)
    return None


router = APIRouter(
    dependencies=[Depends(require_api_docs_access)],
    include_in_schema=False,
)


@router.get(_OPENAPI_URL)
async def openapi_json(request: Request) -> JSONResponse:
    return JSONResponse(request.app.openapi())


@router.get("/docs")
async def swagger_ui() -> HTMLResponse:
    return get_swagger_ui_html(
        openapi_url=_OPENAPI_URL,
        title=f"{_TITLE} - Swagger UI",
        oauth2_redirect_url=_OAUTH2_REDIRECT_URL,
    )


@router.get(_OAUTH2_REDIRECT_URL)
async def swagger_ui_redirect() -> HTMLResponse:
    return get_swagger_ui_oauth2_redirect_html()


@router.get("/redoc")
async def redoc() -> HTMLResponse:
    return get_redoc_html(openapi_url=_OPENAPI_URL, title=f"{_TITLE} - ReDoc")
