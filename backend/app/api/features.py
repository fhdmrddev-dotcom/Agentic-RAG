"""Phase 148 (VIS-01 / D-04) — the per-user effective-features map endpoint.

A tiny authenticated ``GET /features`` that returns the caller's OWN feature→bool map
for the four governed products. It is the READ side of the feature-visibility contract
(148-05); the per-endpoint ``require_visible`` gates are the WRITE-side enforcement.

AUTHED, NOT OPERATOR-GATED (Pattern 5 / anti-pattern): a non-operator MUST reach this
endpoint (200, never 403/404) so the frontend (148-07) can learn which governed nav
items to hide + which page fetches to expect a 403 bounce from. Gating this with
``require_operator``/``require_visible`` would defeat its purpose (an end user could never
learn their own map). It is deliberately mounted TOP-LEVEL (a sibling of the other feature
routers), NOT under ``/admin`` (which is 404 to non-operators).

The map is derived from the SAME two seams the ``require_visible`` gate uses, so the UI
hide and the API refusal can never disagree:
  - ``is_operator(user_id)`` — the ONE swappable audience boundary (Phase 146; SEED-115
    later flips it to group membership with zero change here);
  - ``feature_audience(feature)`` — the D-06 cold-default enum resolver (148-02). An
    operator sees every governed key True; an end user sees True ONLY for the day-one
    Everyone features (``workflow_authoring`` / ``governance_health``), False for the
    Operators-only ones (``skill_studio`` / ``model_management``).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from app.config import settings
from app.dependencies import get_current_user, resolve_caller_role
from app.models.user_settings import (
    _GOVERNED_FEATURES,
    ensure_settings_fresh,
    feature_audience,
    resolve_feature_access,
)
from app.services.operator_service import is_operator

router = APIRouter(tags=["features"])


@router.get("/features")
async def get_effective_features(
    request: Request, current_user: dict = Depends(get_current_user)
) -> dict:
    """Return the caller's effective feature visibility map.

    Never operator-gated: a non-operator reaches it (200) to learn their own map.
    """
    # T-184-UAT-02 — bound this worker's view of the flags before resolving the map. Every
    # ``feature_audience`` call below reads the SYNC settings cache, which has no staleness
    # check of its own; this endpoint is what the UI polls to learn whether a surface exists,
    # so an unbounded stale read here is precisely how the Phase 184 UAT saw a flipped-off
    # canvas keep answering ``true``. TTL-checked (no DB I/O on a warm cache) and non-raising.
    await ensure_settings_fresh()
    op = await is_operator(current_user["id"])
    # Resolve the caller's role only when some governed feature is role-audience (avoid a
    # query for the common operator/everyone-only case). Fail-closed via resolve_caller_role.
    caller_role: str | None = None
    caller_groups: set[str] = set()
    if not op and any(feature_audience(f) == "role" for f in _GOVERNED_FEATURES):
        caller_role, caller_groups = await resolve_caller_role(request, current_user)
    return {
        "features": {
            f: (
                # Phase 181 (REVERT-01 / D-181-01): the "off" guard wins over the operator
                # short-circuit, so an "off" feature (visual_workflow_canvas by default) hides
                # from EVERYONE — operators included — keeping flag-off byte-identical for all.
                feature_audience(f) != "off"
                and (
                    op
                    or feature_audience(f) == "everyone"
                    or (
                        feature_audience(f) == "role"
                        and resolve_feature_access(f, caller_role, caller_groups)
                    )
                )
            )
            for f in _GOVERNED_FEATURES
        },
        "scheduler_process_enabled": bool(settings.scheduler_process_enabled),
    }
