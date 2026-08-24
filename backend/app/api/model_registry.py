"""Phase 196 Plan 04 (AUTH-04 / D-01) — the NON-OPERATOR model-registry read.

A workflow author must be able to see what models exist in order to pick one, and neither
shipped list is the live registry. Measured 2026-08-17: ``GET /settings``'s
``verified_models`` (the code registry) carries 61 ids and misses all 8 DB-only ones;
``GET /me/preferences``' ``allowed_models`` (the enabled overrides) carries 34 and misses 35
code-registry ids; the overlap is 26. ``allowed_models`` alone cannot offer ``gpt-5.5`` (the
model SEED-135 measured as the working judge); ``verified_models`` alone cannot offer
``gemini-3.6-flash`` (the exact id SEED-135 measured silently degrading a run to ``coerce``)
nor any local LM Studio row. A picker blind to the model that caused the seed is not a fix.

⚠ WHY THIS IS A SECOND ROUTE AND NOT A WIDENED ``/admin/models``. That route sits behind
``admin.py``'s router-level operator default-deny, which returns a byte-identical 404 to a
normal author (SC#4 / D-149-09) and has **no RLS backstop** — the test is the only wall. That
gate is correct and is NOT touched. This router is constructed with NO prefix and NO
router-level dependency, the shipped ``features.router`` / ``me_preferences.router`` posture,
and its single endpoint is guarded by ``Depends(get_current_user)`` alone. This module names
no operator dependency at all; a grep for one here must come back empty.

⚠ WHAT CROSSES THE BOUNDARY IS AN ALLOWLIST, NOT A DROP-LIST. Every row is
``model_registry.to_author_row(...)`` — six fields, enumerated in code — so a field added to
``_registry_row`` later cannot travel here by inheritance. That is the CR-01 lesson from
Phase 190, where migration 116's RLS copy leaked a secret column precisely by inheriting.

The ``{"models": [...]}`` envelope deliberately mirrors ``/admin/models`` so the client's
existing "unwrap ``.models`` HERE, never in the component" rule transfers unchanged.

No pagination and no second cache (Open Q3): ``build_model_registry_rows`` already reads the
30-second TTL override cache, the union is ~69 rows, and the client fetches it once at the
Builder page level. Revisit at ~500 rows.

The ``enabled`` semantics are ``_registry_row``'s (an absent override row means ENABLED), which
is what the RUNTIME enforcement ``_resolve_enabled_model`` agrees with — see the leaf module's
docstring for why that differs from ``/me/preferences``' 34 and why the difference is a
decision rather than a bug.

Endpoints:
- GET /models/registry — {models: [{model_id, provider, capability_source, enabled,
                         deprecated, emit_tier}], run_default_model: str | None}. Authenticated,
                         NOT operator-gated. ``run_default_model`` is resolved server-side
                         through the run's OWN chain (never app_settings.llm_model directly,
                         never a constant) — see ``_resolve_run_default_model``.
"""
import logging

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict

from app.dependencies import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(tags=["model-registry"])


class AuthorModelRow(BaseModel):
    """ONE model as a workflow author may see it — the six-field allowlist projection.

    This is deliberately a SEPARATE shape from the operator registry row, not a subset type
    of it: ``deprecated_reason`` is documented as "operator context, never shown to end
    users", and ``overridden_fields`` / ``is_locked`` / the timeouts and window sizes are
    operator-editor internals with no consumer here. ``to_author_row``'s docstring records the
    reason for each omission. ``emit_tier`` is ``None`` when untracked — the consumer reads
    that as ``coerce`` (``forced_emit.py:376``); it is NOT coalesced here, because a row that
    says ``coerce`` cannot be told apart from a row that says nothing.

    ``protected_namespaces=()`` silences Pydantic's ``model_``-prefix warning for ``model_id``
    (the same knob ``AddModelRequest`` uses).
    """

    model_config = ConfigDict(protected_namespaces=())

    model_id: str
    provider: str
    capability_source: str
    enabled: bool
    deprecated: bool
    emit_tier: str | None = None


class AuthorModelRegistryResponse(BaseModel):
    """``GET /models/registry``'s body — the union plus the honest run default."""

    models: list[AuthorModelRow]
    run_default_model: str | None = None


async def _resolve_run_default_model(request: Request, current_user: dict) -> str | None:
    """What model would a RUN actually inherit for this caller? (Open Q1 + Q4.)

    ⚠ This deliberately does NOT read ``_registry_row``'s ``is_default``, and does NOT return a
    constant. ``is_default`` is stamped from ``app_settings.llm_model``, which is a DIFFERENT
    function from the one a run uses — that mismatch IS Open Q4. And a hardcoded id would
    recreate exactly the lie AUTH-04 removes: measured at planning time, THREE different ids
    could each plausibly have been written here (the live ``app_settings.llm_model``, the
    sub-agent default, and the id most stored phases happen to carry) and no two agreed. The
    three measured values are recorded in 196-04-SUMMARY.md rather than in this docstring,
    precisely so no reader can copy one back into the code as a default.

    So it walks the same chain ``workflow_kickoff.py:485`` walks:
    ``load_app_settings_async()`` -> ``apply_user_model_default(...)`` (the caller's own
    preference, honoring the operator lock and allowed-set) -> ``resolve_workflow_ctx_model(...)``.
    An empty resolution returns ``None`` — an honest absence, never a guess.

    FAIL-SOFT by design: any failure logs and returns ``None``. An absent value degrades the
    picker's label to the bare sentence "Use the run's model", which D-06 explicitly permits;
    a 500 here would take the whole picker down over a cosmetic clause.
    """
    try:
        # Function-local (leaf-module seam; keeps the settings + resolution modules off this
        # router's import path, the admin.py Pitfall-4 discipline).
        from app.models.user_settings import load_app_settings_async  # noqa: PLC0415
        from app.services.run_model_resolution import apply_user_model_default  # noqa: PLC0415
        from app.services.sub_agent_models import resolve_workflow_ctx_model  # noqa: PLC0415

        user_settings = await load_app_settings_async()
        user_settings = await apply_user_model_default(
            request=request, current_user=current_user, user_settings=user_settings
        )
        return resolve_workflow_ctx_model(user_settings) or None
    except Exception:  # noqa: BLE001 — an honest None beats a 500 on a cosmetic clause
        logger.warning(
            "_resolve_run_default_model: chain failed; returning None so the picker "
            "falls back to its bare 'Use the run's model' label",
            exc_info=True,
        )
        return None


@router.get("/models/registry", response_model=AuthorModelRegistryResponse)
async def get_author_model_registry(
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """The live model registry as a workflow author may read it (D-01).

    Returns the FULL union — built-in ``MODEL_CAPABILITIES`` ∪ ``model_capabilities_overrides``
    ∪ DB-only rows — computed by the SAME ``build_model_registry_rows`` that serves
    ``/admin/models``, then narrowed field-by-field by ``to_author_row``. Disabled and
    deprecated rows are PRESENT and flagged, never omitted: a picker that silently drops a
    model teaches an author it never existed.

    Authenticated but NOT operator-gated (the ``/features`` + ``/me/preferences`` posture);
    ``audit_is_write=False`` marks it a read.
    """
    request.state.audit_is_write = False

    # Function-local (Pitfall 4 — keep the settings module off this router's load path).
    from app.services.model_registry import build_model_registry_rows, to_author_row  # noqa: PLC0415

    rows = await build_model_registry_rows()
    return AuthorModelRegistryResponse(
        models=[to_author_row(r) for r in rows],
        run_default_model=await _resolve_run_default_model(request, current_user),
    )
