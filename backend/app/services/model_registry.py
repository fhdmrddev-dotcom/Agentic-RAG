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


__all__ = [
    "_registry_row",
    "build_model_registry_rows",
    "to_author_row",
]
