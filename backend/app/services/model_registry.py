r"""Phase 196 Plan 04 (AUTH-04 / D-01 / D-02) — the model-registry union composition.

Behavior-preserving extraction: ``_registry_row`` and the DEF-plus-DB-only union loop move
VERBATIM out of ``backend/app/api/admin.py`` into this leaf module, so that BOTH the
operator route (``GET /admin/models``) and the new non-operator author route
(``GET /models/registry``) compute the union with the SAME function. Zero
"while-I'm-in-here" edits — the bodies are copied unchanged (bugs included). This is the
``run_model_resolution.py`` / ``run_lifecycle.py`` extraction discipline: docstring-states-
invariant, additive-then-repoint, function-local imports to break the ``admin.py`` <->
service cycle.

The ONE deliberate addition to the moved body is D-14's ``emit_tier``, applied through the
same ``_eff`` helper the function already uses, and therefore under the same WR-04 rule the
function already documents: return the RAW effective value or ``None``, never a coalesced
false default. The read-time ``coerce`` default is applied by the CONSUMER
(``forced_emit.py:376`` reads ``cap.get("emit_tier", "coerce")``) — it is deliberately NOT
baked into the row, because a row that says ``coerce`` cannot be distinguished from a row
that says nothing.

WHERE THE TWO TRAVELLING MODULE-SCOPE NAMES LIVE, and why (D-02 asks for this decision to be
recorded rather than left to be re-derived):

- ``_infer_provider_for`` — lives in ``app.config`` and always did; ``admin.py`` only
  imports it. This module imports it from ``app.config`` at module scope, exactly as
  ``admin.py`` does. No move, no second definition.
- ``_MODEL_CAP_COLUMNS`` — STAYS in ``app.api.admin`` and is imported here, FUNCTION-LOCALLY
  (inside ``_registry_row``) so the ``admin.py`` -> service -> ``admin.py`` import cycle
  never has to resolve at module-import time. It stays there because it is the PATCH
  allowlist ``set_model_capability`` interpolates into the upsert's column list (T-149-11,
  the SQLi boundary), and plan 196-01 has just taken it from seven members to eight; moving
  it would put the SQLi allowlist a hop away from the writer that enforces it. There is
  exactly ONE definition — this module never re-declares it, so the two can never diverge.

PATCH SURFACE (the acceptance bar):

- ``grep -rn "_registry_row\|get_model_registry\|_infer_provider_for" backend/tests/``
  returns NO importing test (measured at execution time; the single hit is an unrelated test
  FUNCTION NAME, ``test_gpt_5_6_registry_rows_carry_reasoning_first``). The patch surface is
  therefore EMPTY and nothing is re-imported at module scope back into ``admin.py``. If a
  later test starts importing ``_registry_row`` from ``app.api.admin``, re-import it there at
  module scope and amend this section — do not add a second definition.

THE ``enabled`` SEMANTICS THIS MODULE ADOPTS, stated because a reviewer WILL compare counts:

  ``_registry_row`` treats an ABSENT override row as ``enabled: true`` (measured: 66 of 69
  rows enabled). The allowed-set helper in ``app.models.user_settings`` that backs
  ``/me/preferences`` treats an absent row as NOT offerable (34). Both ship today; they are
  incompatible. ``_resolve_enabled_model`` — the
  RUNTIME enforcement in ``run_model_resolution.py`` — agrees with ``_registry_row``: it
  falls back only when an override row carries ``enabled=false``. This module therefore keeps
  ``_registry_row``'s semantics, so the picker and the harness cannot disagree about the same
  model. A picker NARROWER than the engine is a different lie from the one AUTH-04 removes,
  not an absence of one. Anyone diffing this route's enabled count against
  ``/me/preferences``' ``allowed_models`` is looking at a DECISION, not a bug.

NO PAGINATION AND NO SECOND CACHE (Open Q3). ``build_model_registry_rows`` reads the existing
30-second TTL override cache (``load_all_model_overrides``); a cache layer here would create a
staleness window nobody can reason about. The union is ~69 rows and the client fetches it once
at the Builder page level. Revisit pagination at ~500 rows.
"""
from __future__ import annotations

import logging
from typing import Any

from fastapi import HTTPException, status

from app.config import MODEL_CAPABILITIES, _infer_provider_for

logger = logging.getLogger(__name__)


# The ONLY fields the non-operator author projection may carry (D-02 / T-196-LEAK). This is
# an ALLOWLIST, never a drop-list: a drop-list silently ships any field a future edit adds to
# ``_registry_row``, which is exactly how migration 116's RLS copy leaked a secret column in
# Phase 190 (CR-01). Ordered for readability; membership is what is enforced.
_AUTHOR_ROW_FIELDS = (
    "model_id",
    "provider",
    "capability_source",
    "enabled",
    "deprecated",
    "emit_tier",
)


def _registry_row(model_id, cap, ovr, default_model, model_locked):
    """Build one union registry row: OVR (DB-stored) values win over DEF (built-in) values,
    with BOTH discernible via ``overridden_fields`` so the editor can render Reset (D-149-03).

    ``cap`` is the built-in MODEL_CAPABILITIES entry (or None for a DB-only model); ``ovr``
    is the model_capabilities_overrides row (or None for a pure DEF row). An OVR column is
    applied only when NON-None (null-clears-to-DEF — the same overlay rule as
    get_model_capability_async), so an operator's cleared field falls back to the built-in.
    """
    # Function-local (the admin.py <-> service cycle): _MODEL_CAP_COLUMNS is the PATCH/SQLi
    # allowlist and stays defined in app.api.admin — see this module's docstring.
    from app.api.admin import _MODEL_CAP_COLUMNS  # noqa: PLC0415 — cycle break, see docstring

    cap = cap or {}
    ovr = ovr or {}

    def _eff(col, default=None):
        v = ovr.get(col)
        if v is not None:
            return v
        return cap.get(col, default)

    provider = ovr.get("provider") or cap.get("provider") or _infer_provider_for(model_id)
    # DB-only OR any model carrying a stored override row → db_override; else the built-in.
    source = "db_override" if ovr else "registry"
    # Which editable columns are actually STORED (non-None) in the DB — the editor renders
    # Reset only for fields that are overridden vs inherited from the built-in DEF.
    overridden_fields = sorted(c for c in _MODEL_CAP_COLUMNS if ovr.get(c) is not None)

    _enabled = ovr.get("enabled")
    _deprecated = ovr.get("deprecated")
    return {
        "model_id": model_id,  # verbatim casing (Pitfall 6)
        "provider": provider,
        "capability_source": source,
        "enabled": bool(_enabled) if _enabled is not None else True,
        "deprecated": bool(_deprecated) if _deprecated is not None else False,
        # IN-02: surface the stored deprecation reason so re-editing a deprecated model seeds
        # the input from the current note (not blank) — a blur/enter no longer clobbers it.
        "deprecated_reason": ovr.get("deprecated_reason"),
        # WR-04: distinguish "not tracked in the registry" from a real 0. No built-in
        # MODEL_CAPABILITIES entry carries context_window_tokens, so coalescing absent→0 made
        # the tab read "Context 0 · DEF" for essentially every registry row (false — the value
        # is simply not tracked, not zero). Return the RAW effective value or None; the tab
        # renders None as "—" (not a concrete 0). Same for the sibling numeric fields.
        "context_window_tokens": _eff("context_window_tokens"),
        "max_output_tokens": _eff("max_output_tokens"),
        "native_tools": bool(_eff("native_tools", False)),
        "llm_call_timeout_seconds": _eff("llm_call_timeout_seconds"),
        # Phase 196 (D-14): the forced-emission tier, under the SAME WR-04 rule as the numeric
        # fields above — the RAW effective value or None, never a coalesced "coerce". The
        # read-time default belongs to the consumer (forced_emit.py:376), not to the row.
        "emit_tier": _eff("emit_tier"),
        "is_default": model_id == default_model,
        "is_locked": bool(model_locked) and model_id == default_model,
        # Additive (Plan 07 extends the ModelRegistryRow type): per-field OVR-vs-DEF for Reset.
        "overridden_fields": overridden_fields,
    }


async def build_model_registry_rows() -> list[dict]:
    """Compose the FULL union of the live model registry (D-149-03 / D-01) — ONE function,
    two callers.

    Every built-in ``MODEL_CAPABILITIES`` model becomes a DEF row
    (``capability_source="registry"``), overlaid with its override row when one exists
    (``capability_source="db_override"``); every DB-only model (present in
    ``model_capabilities_overrides``, absent from the built-in registry) becomes a DB-only
    row. Reads the ALL-ROWS override cache (``load_all_model_overrides`` — disabled rows
    INCLUDED, Pitfall 1) so an operator editor can re-enable what was disabled and so the
    author picker can show a model as present-but-disabled rather than silently missing.
    ``is_default`` / ``is_locked`` are stamped from the app_settings row (``llm_model`` +
    ``llm_model_locked``).

    ⚠ ``is_default`` answers "is this ``app_settings.llm_model``?", which is NOT the same
    question as "what model would a run inherit?" — the run chain is
    ``load_app_settings_async`` -> ``apply_user_model_default`` -> ``resolve_workflow_ctx_model``
    (``workflow_kickoff.py:485``). The author route computes ``run_default_model`` through
    that chain instead; do not substitute ``is_default`` for it (Open Q4).

    Returns the raw thirteen-plus-one-field rows. Narrowing for a non-operator audience is
    ``to_author_row``'s job, never this function's.
    """
    # Function-local imports (Pitfall 4 — keep the settings module off admin's load path;
    # this mirrors admin.py:1167-1168, the line this loop was moved from).
    from app.models.user_settings import (  # noqa: PLC0415
        _load_settings_from_db,
        load_all_model_overrides,
    )

    settings_row = await _load_settings_from_db()
    default_model = settings_row.get("llm_model") or ""
    model_locked = bool(settings_row.get("llm_model_locked"))

    overrides = await load_all_model_overrides()

    rows = []
    seen = set()
    # DEF rows (built-in registry) overlaid with any OVR.
    for model_id, cap in MODEL_CAPABILITIES.items():
        rows.append(_registry_row(model_id, cap, overrides.get(model_id), default_model, model_locked))
        seen.add(model_id)
    # DB-only rows (in overrides, not in the built-in registry) — discovery-confirmed models.
    for model_id, ovr in overrides.items():
        if model_id in seen:
            continue
        rows.append(_registry_row(model_id, None, ovr, default_model, model_locked))

    return rows


def to_author_row(row: dict) -> dict:
    """Narrow ONE union row to the six fields a non-operator workflow author may see.

    An explicit ALLOWLIST (``_AUTHOR_ROW_FIELDS``), never a ``del`` of unwanted keys. A
    drop-list ships every field a future edit adds to ``_registry_row``; this is precisely how
    migration 116's RLS copy leaked a secret column in Phase 190 (CR-01). The allowlist habit
    is the shipped ``_MODEL_CAP_COLUMNS`` one.

    WHAT TRAVELS: ``model_id`` (the pick), ``provider`` (the logo + the grouping),
    ``capability_source`` (registry vs db_override — the honesty about where the row came
    from), ``enabled`` (the picker must show a disabled model as disabled, not omit it),
    ``deprecated`` (same), ``emit_tier`` (D-13 — the whole point of the phase; ``None`` means
    "not tracked", which the consumer reads as ``coerce``).

    WHAT IS OMITTED, each with its reason — so a later reader adds a field deliberately or not
    at all:

    - ``deprecated_reason`` — ``frontend/src/lib/api.ts`` documents it in so many words as
      "operator context, never shown to end users". It is free operator prose and can name
      internal decisions, vendors or incidents.
    - ``overridden_fields`` and ``is_locked`` — operator-EDITOR internals. ``overridden_fields``
      exists to render the Reset affordance; ``is_locked`` describes an operator lock on the
      operator's own default. Neither has any meaning on an authoring surface.
    - ``llm_call_timeout_seconds``, ``context_window_tokens``, ``max_output_tokens`` — no
      consumer on this surface, and SEED-172 measured that a stale ``context_window_tokens``
      on a local (LM Studio) row is a REAL hazard: the advertised max is not the loaded
      context. Shipping a number nobody validates invites an author to trust it.
    - ``is_default`` — deliberately omitted rather than forgotten. It answers "is this
      ``app_settings.llm_model``?"; the author needs "what would a run actually use?", which
      the route computes as ``run_default_model`` through the run's own chain (Open Q1/Q4).
    """
    return {k: row.get(k) for k in _AUTHOR_ROW_FIELDS}


# ── Phase 196 Plan 06 (AUTH-04 / SC#2 / D-09 / D-08) — the SAVE-PATH refusal ──────────
#
# ``config.model`` is validated by NOTHING today: not on save, not at publish, not at run.
# A client-only picker list would reduce SC#2 to "cannot be selected through the FORM",
# which any direct API call bypasses. The disable is courtesy; the server is the wall.
#
# THIS LIVES IN THE LEAF, NOT IN A PYDANTIC VALIDATOR, for three measured reasons:
#   1. the check is ASYNC (it reads the 30s override cache); Pydantic v2 validators are sync;
#   2. ``app/models/harness.py`` records that file's own standing rule — the draft save path
#      persists ``model_dump(mode="json")``, so a derivation living in the model would be
#      BAKED into the JSONB;
#   3. D-08 requires an ALREADY-STORED unregistered value to stay saveable, which a
#      parse-level invariant makes impossible — the day a registry row is retired, every
#      stored definition naming it would stop parsing.


def _phase_model_pairs(definition: Any) -> list[tuple[str, str]]:
    """``[(phase_slug, model), ...]`` for every phase carrying a NON-EMPTY ``config.model``.

    Accepts BOTH a parsed ``WorkflowDefinition`` (the request body) and a raw JSONB dict
    (the stored row) — the grandfather comparison below has one of each in its hands, and
    normalising here is what lets ONE comparison serve both. A blank/absent model, a phase
    with no config, and a definition with no phases are all no-ops.
    """
    if definition is None:
        return []
    phases = definition.get("phases") if isinstance(definition, dict) else getattr(definition, "phases", None)
    pairs: list[tuple[str, str]] = []
    for phase in phases or []:
        if isinstance(phase, dict):
            slug = phase.get("slug") or ""
            config = phase.get("config") or {}
            model = config.get("model") if isinstance(config, dict) else None
        else:
            slug = getattr(phase, "slug", "") or ""
            config = getattr(phase, "config", None)
            model = getattr(config, "model", None) if config is not None else None
        if isinstance(model, str) and model.strip():
            pairs.append((str(slug), model))
    return pairs


async def registered_model_ids() -> set[str]:
    """Every ``model_id`` the registry KNOWS — MEMBERSHIP, never availability.

    ⚠ DERIVED FROM ``build_model_registry_rows`` — the SAME union the author picker reads —
    and deliberately NOT from the narrower allowed-set helper in ``app.models.user_settings``
    that backs ``/me/preferences``. Two incompatible ``enabled`` semantics ship today: an
    ABSENT override row reads *enabled* to ``_registry_row`` (and to the RUNTIME
    enforcement in ``run_model_resolution.py``) and *not offerable* to that other helper.
    Using the narrower one here would refuse a SAVE for ~32 models the engine happily runs,
    which is a different lie from the one AUTH-04 removes, not an absence of one. A grep for
    that helper's name in this module must come back EMPTY.

    ⚠ MEMBERSHIP, NOT AVAILABILITY — the set deliberately INCLUDES disabled and deprecated
    rows. A disabled model is a RUN-time concern (D-10: the run falls back and says so);
    making it a save-time refusal would mean disabling a model retroactively breaks every
    stored workflow that names it, which is exactly the brittleness D-08 forbids.
    """
    rows = await build_model_registry_rows()
    return {r["model_id"] for r in rows if r.get("model_id")}


async def unregistered_phase_models(definition: Any) -> list[dict]:
    """``[{"phase_slug", "model"}, ...]`` for phases naming a model the registry does not know.

    Separated from the raise so a CALLER can ask the cheap question first — "is there any
    offender at all?" — and only then pay for the owner-scoped read that ``previous`` needs.
    That laziness is what keeps the ordinary autosave (measured: 239 of 257 stored phases
    carry no model) at zero extra queries, and it is what lets the update door resolve
    OWNERSHIP before it decides to refuse.
    """
    known = await registered_model_ids()
    return [
        {"phase_slug": slug, "model": model}
        for slug, model in _phase_model_pairs(definition)
        if model not in known
    ]


async def assert_phase_models_registered(definition: Any, *, previous: Any = None) -> None:
    """Refuse a NEWLY-INTRODUCED unregistered ``config.model`` with an object-shaped 400.

    THE DETAIL IS AN OBJECT, NOT PROSE. ``api/workflows.py``'s own refusal register states
    the rule in so many words — *the client branches on ``code``, never on this prose* — so
    this joins that register (``code="unknown_model"``) rather than sitting above it as a
    bare sentence. ``phase_slug`` and ``model`` ride along so the Builder can focus the
    offending field instead of guessing which node is wrong. The ``message`` follows the
    ``api/me_preferences.py`` prose register: name the model, name the remedy.

    ``previous`` IS D-08's GRANDFATHER, and it is the whole reason this is route-level
    policy. When supplied (the UPDATE door), a phase whose STORED counterpart — matched by
    phase slug — already carries the identical value is SKIPPED: an operator retiring a
    registry row must never make an existing workflow unsaveable. D-09 (refuse) and D-08
    (do not brick) are both true exactly because the refusal is scoped to values the caller
    is INTRODUCING.

    ⚠ MEASURED BLAST RADIUS, 2026-08-18, live local DB: 270 definitions / 257 phases / 239
    blank / 18 ``gpt-5.4`` (registry-known AND enabled) / **0 phases in the unknown state**.
    The grandfather branch is therefore DEAD CODE today. It exists so that D-08's promise is
    true the day it stops being dead, not because anything currently needs it.

    Raises on the FIRST offender: the picker fixes one field at a time, and naming one
    phase is more actionable than a list nobody reads.
    """
    offenders = await unregistered_phase_models(definition)
    if not offenders:
        return
    # dict(...) — last wins on a duplicate slug. Slugs are the natural key of a phase and
    # the canvas mints them unique; a duplicate would grandfather off the later phase,
    # which is the same answer the stored row would give a re-save.
    grandfathered = dict(_phase_model_pairs(previous)) if previous is not None else {}
    for offender in offenders:
        if grandfathered.get(offender["phase_slug"]) == offender["model"]:
            continue
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "unknown_model",
                "message": (
                    f"'{offender['model']}' is not a model this deployment knows. "
                    "Pick a model from the list, or leave it blank to use the run's model."
                ),
                "phase_slug": offender["phase_slug"],
                "model": offender["model"],
            },
        )


__all__ = [
    "_registry_row",
    "assert_phase_models_registered",
    "build_model_registry_rows",
    "registered_model_ids",
    "to_author_row",
    "unregistered_phase_models",
]
