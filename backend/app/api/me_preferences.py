"""Phase 167 VIS-02 (D-167-04) — the FIRST per-user preference under the SEED-116
two-layer pattern: a user picks a default AI model WITHIN the operator/org-allowed
ENABLED set, honoring the operator lock. Revives the dead ``user_settings.preferences``
column (mig 011) — ZERO migration.

This is the INVERSE of the global ``app_settings`` writers (user_settings.py:8-18): the
preference is PER-USER data, so the write runs on the caller's user-JWT/RLS connection
(``get_user_pg_connection``) with a JSONB ``||`` merge keyed on ``auth.uid()`` — NOT the
service-role settings writer. The allowed-set + lock are re-validated SERVER-SIDE:
- ``PUT`` refuses a ``default_model`` outside the enabled allowed-set (400);
- ``compose_effective_model_default`` re-checks membership + honors the lock at read time
  (defense-in-depth, T-167-13/14) so a later-disabled or locked model falls back cleanly.

Endpoints:
- GET  /me/preferences — {default_model, effective_model, locked, allowed_models}
                         (the picker + always-on 🔒 footer data for Plan 07).
- PUT  /me/preferences — body {default_model: str | None}: set (validated ∈ allowed-set)
                         or clear (null) the caller's own model default.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from app.dependencies import get_current_user, get_user_pg_connection
from app.models.user_settings import (
    compose_effective_model_default,
    enabled_model_allowed_set,
    load_app_settings_async,
    load_user_model_default,
    operator_model_default_locked,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["preferences"])


class ModelDefaultBody(BaseModel):
    """PUT /me/preferences body. ``default_model=None`` CLEARS the override."""
    default_model: str | None = None


@router.get("/me/preferences")
async def get_my_preferences(
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """Return the caller's per-user model default + the two-layer context.

    ``default_model`` is the caller's raw stored preference (may be null); ``effective_model``
    is what the chat send path would actually default to under the SEED-116 compose (operator
    default when unset / locked / out-of-set); ``locked`` surfaces the operator lock for the
    🔒 footer; ``allowed_models`` is the operator/org ENABLED allowed-set the picker offers.
    """
    user_id = current_user["id"]
    effective = await load_app_settings_async()
    allowed = await enabled_model_allowed_set()
    locked = await operator_model_default_locked()
    pref = await load_user_model_default(user_id)
    effective_model = compose_effective_model_default(pref, effective, allowed, locked)
    return {
        "default_model": pref,
        "effective_model": effective_model,
        "locked": locked,
        "allowed_models": sorted(allowed),
    }


@router.put("/me/preferences")
async def put_my_preferences(
    body: ModelDefaultBody,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """Set or clear the caller's own default model.

    Validates a non-null ``default_model`` ∈ the enabled allowed-set (400 otherwise —
    T-167-13, a user can never pick outside the operator/org-permitted set). The write is a
    PER-USER RLS-scoped JSONB ``||`` merge keyed on ``auth.uid()`` (the inverse of the global
    service-role settings writer). A ``null`` ``default_model`` REMOVES the key (clears the
    override → the operator default flows). Upsert because a user may have no ``user_settings``
    row yet (the org_id BEFORE-INSERT autofill trigger fills org_id).
    """
    desired = (body.default_model or "").strip() or None

    if desired is not None:
        allowed = await enabled_model_allowed_set()
        if desired not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "That model is not in your organization's enabled set. "
                    "Pick a model your administrator has enabled."
                ),
            )

    async with get_user_pg_connection(request, current_user) as conn:
        if desired is not None:
            # Set: merge {"default_model": <id>} into the caller's own preferences.
            await conn.execute(
                "INSERT INTO public.user_settings (user_id, preferences) "
                "VALUES (auth.uid(), $1::jsonb) "
                "ON CONFLICT (user_id) DO UPDATE "
                "SET preferences = coalesce(public.user_settings.preferences, '{}'::jsonb) || $1::jsonb, "
                "    updated_at = now()",
                {"default_model": desired},
            )
        else:
            # Clear: strip the default_model key (idempotent on a fresh/absent row).
            await conn.execute(
                "INSERT INTO public.user_settings (user_id, preferences) "
                "VALUES (auth.uid(), '{}'::jsonb) "
                "ON CONFLICT (user_id) DO UPDATE "
                "SET preferences = coalesce(public.user_settings.preferences, '{}'::jsonb) - 'default_model', "
                "    updated_at = now()",
            )

    # Return the fresh two-layer view so the client stays server-derived (never optimistic).
    return await get_my_preferences(request=request, current_user=current_user)
