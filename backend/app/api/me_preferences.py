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

Phase 300-05 (NOTE-04 / D-09) — the member's own "Email me when a run is waiting on me":
- GET  /me/preferences also carries notification_email_enabled (true when unset — the drainer's
  ``coalesce(..., 'true') <> 'false'`` rule), notification_email_delay_words (the operator's
  delay in the email's own floor words) and email_configured (EMAIL_PROVIDER is not ``none``).
- PUT  /me/preferences/notification-email — body {enabled: bool}. ⛔ ITS OWN ROUTE, ON PURPOSE:
  the PUT above reads a missing ``default_model`` as "clear it", so a switch saved through it
  would wipe the member's default chat model. This one runs ONE RLS-scoped ``||`` merge and
  touches nothing else. No ``require_visible`` — every signed-in member reaches their own row.
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
from app.services.email_provider import configured_provider
from app.services.run_waiting_email import duration_words

logger = logging.getLogger(__name__)

router = APIRouter(tags=["preferences"])


class ModelDefaultBody(BaseModel):
    """PUT /me/preferences body. ``default_model=None`` CLEARS the override."""
    default_model: str | None = None


class NotificationEmailBody(BaseModel):
    """PUT /me/preferences/notification-email body. No user id: the row is the caller's own."""
    enabled: bool


async def load_user_notification_email_enabled(user_id: str) -> bool:
    """The caller's own opt-out, read the way ``load_user_model_default`` reads its key.

    Only a stored ``false`` is off — the same rule the drainer's SQL applies, so the switch and
    the sender can never disagree. Unset, no row, or a read blip → on (the D-09 default).
    """
    if not user_id:
        return True
    try:
        from app.dependencies import get_pg_pool
        pool = await get_pg_pool()
        val = await pool.fetchval(
            "SELECT preferences->>'notification_email_enabled' FROM public.user_settings "
            "WHERE user_id = $1",
            user_id,
        )
    except Exception:  # noqa: BLE001 — a read blip shows the default, it never breaks the GET
        logger.warning("load_user_notification_email_enabled: read failed; showing on", exc_info=True)
        return True
    return str(val).strip().lower() != "false" if val is not None else True


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
    email_enabled = await load_user_notification_email_enabled(user_id)
    return {
        "default_model": pref,
        "effective_model": effective_model,
        "locked": locked,
        "allowed_models": sorted(allowed),
        # 300-05 (D-09) — the switch, its sentence's delay words (the server owns the words; the
        # client never formats seconds), and whether this install sends email at all.
        "notification_email_enabled": email_enabled,
        "notification_email_delay_words": duration_words(
            getattr(effective, "notification_email_delay_seconds", 120)
        ),
        "email_configured": configured_provider() != "none",
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


@router.put("/me/preferences/notification-email")
async def put_my_notification_email(
    body: NotificationEmailBody,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """Turn the caller's own run-waiting email on or off (D-09).

    ONE statement: the RLS-scoped JSONB ``||`` merge keyed on ``auth.uid()`` (the shape the
    default-model PUT uses), so ``default_model`` and every other key are left exactly as they
    were. Returns the fresh GET view, so the switch shows the server's value, never the click.
    """
    async with get_user_pg_connection(request, current_user) as conn:
        await conn.execute(
            "INSERT INTO public.user_settings (user_id, preferences) "
            "VALUES (auth.uid(), $1::jsonb) "
            "ON CONFLICT (user_id) DO UPDATE "
            "SET preferences = coalesce(public.user_settings.preferences, '{}'::jsonb) || $1::jsonb, "
            "    updated_at = now()",
            {"notification_email_enabled": bool(body.enabled)},
        )
    return await get_my_preferences(request=request, current_user=current_user)
