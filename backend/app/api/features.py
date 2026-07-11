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

from fastapi import APIRouter, Depends

from app.dependencies import get_current_user
from app.models.user_settings import _GOVERNED_FEATURES, feature_audience
from app.services.operator_service import is_operator

router = APIRouter(tags=["features"])


@router.get("/features")
async def get_effective_features(current_user: dict = Depends(get_current_user)) -> dict:
    """Return the caller's effective feature→bool map (authed, per-user — Pattern 5).

    ``{"features": {feature: (operator OR audience=="everyone")}}`` over the four governed
    features. Operator → all True; end user → True only for the Everyone-audience features.
    Never operator-gated: a non-operator reaches it (200) to learn their own map.
    """
    op = await is_operator(current_user["id"])
    return {
        "features": {
            f: (op or feature_audience(f) == "everyone")
            for f in _GOVERNED_FEATURES
        }
    }
