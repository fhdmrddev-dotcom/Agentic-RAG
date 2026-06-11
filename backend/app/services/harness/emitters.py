"""Emitter registry (Phase 101.1 / D-04 — the ``llm_emit`` emitter dispatch).

A ``llm_emit`` workflow phase FORCES the model to emit cited DATA against a strict
schema, then a PINNED deterministic driver (NO model-written code, D-02) renders that
data into the deliverable. The emitter resolves the (schema, driver) pair by NAME
against the :data:`EMITTER_REGISTRY` — a **closed dict** mirroring
``PROGRAMMATIC_PHASE_REGISTRY`` (``programmatic.py``) and ``tool_dispatcher._TOOL_REGISTRY``.

THE SECURITY LINE (T-101.1-01-02, the T-091-12 pattern): an unknown emitter name
RAISES in the executor — it is NEVER ``eval``'d, ``getattr``'d, or imported
dynamically. A published workflow definition can only NAME an emitter the server
already registered here; it cannot smuggle code through the ``emitter`` field.

``render_template`` is the FIRST and only v1 entry (D-04 — ``render_template`` is
DEMOTED from a bespoke tool to the first emitter). Its ``schema_builder`` is the
Pitfall-4-safe ``build_field_map_tool_schema`` (Pydantic ``model_json_schema()`` only
— NO heavy-lib import); its ``post_processor`` is ``None`` for now (the downstream
executor plan wires the deterministic render-dispatch — Plan 03's hardened
``_handle_render_template`` is reused there, one render code path).
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Callable, Optional

from app.services.template_render_service import build_field_map_tool_schema

# NOTE (Pitfall 4): NO ``import docxtpl`` at module top — render is sandbox-only. The
# post_processor RE-DISPATCHES the hardened ``_handle_render_template`` (which ships the
# heavy libs into the SEALED sandbox via ``_RENDER_DRIVER_SRC``); this module never
# imports the heavy render libs nor renders in-process — there is exactly ONE render path.

__all__ = [
    "EmitterEntry",
    "EMITTER_REGISTRY",
    "register_emitter",
    "resolve_emitter",
]


@dataclass(frozen=True)
class EmitterEntry:
    """The (schema + deterministic driver) pair an emitter resolves to (D-04).

    ``schema_builder`` returns the strict tool/input schema the forced emit targets
    (the model emits cited DATA against it). ``post_processor`` is the deterministic,
    no-model-code driver that renders the validated data into the deliverable; ``None``
    until the executor plan wires the render-dispatch (the hardened
    ``_handle_render_template`` is reused there).
    """

    schema_builder: Callable[..., dict]
    post_processor: Optional[Callable[..., dict]] = None


# Closed registry (T-101.1-01-02 / T-091-12). A name not present here RAISES in the
# executor (see ``resolve_emitter``) — never resolved dynamically / eval'd / imported.
EMITTER_REGISTRY: dict[str, EmitterEntry] = {}


def register_emitter(
    name: str,
) -> Callable[[EmitterEntry], EmitterEntry]:
    """Decorator-style registrar: bind ``entry`` under ``name`` in the closed registry.

    Usable as a decorator on a factory OR called directly. Re-registering an existing
    name overwrites it (the module is imported once at process start; duplicate names
    are a developer bug, not a runtime input path — same contract as
    ``register_programmatic``).
    """

    def deco(entry: EmitterEntry) -> EmitterEntry:
        EMITTER_REGISTRY[name] = entry
        return entry

    return deco


def resolve_emitter(name: str) -> EmitterEntry:
    """Return the :class:`EmitterEntry` registered under ``name``, or RAISE.

    The closed-dict guarantee: an unknown name (a definition naming an emitter the
    server never registered) raises ``ValueError`` — NEVER eval'd / getattr'd /
    imported (T-101.1-01-02). The executor calls this to dispatch the forced emit.
    """
    try:
        return EMITTER_REGISTRY[name]
    except KeyError:
        raise ValueError(
            f"unknown emitter {name!r}; must be one of the registered emitters: "
            f"{sorted(EMITTER_REGISTRY)}"
        ) from None


async def _render_template_post(
    validated_map: dict, resolved_template: dict, ctx: Any
) -> dict:
    """The ``render_template`` deterministic driver (D-04 / A2) — RE-DISPATCH the EXISTING
    hardened ``_handle_render_template`` with the validated field-map + the server-resolved
    template. ONE render code path: the CR-01 shell-safety (``_safe_out_filename`` allow-list
    + ``shlex.quote``), the truncation guard, the citation gate, the integrity gate, and the
    sealed-sandbox plumbing are ALL inherited — this function re-implements NONE of them.

    ``_handle_render_template`` is imported LAZILY inside the function to avoid an import
    cycle (emitters → tool_dispatcher → ...). It re-resolves the SAME trusted library
    template from the ``asset`` arg (the server-resolved ``AssetRef`` — the model never
    selects it, D-10) so there is no second resolution path either.

    Returns the handler's parsed verdict dict (``{status, path, ...}``) — the executor
    maps ``status`` to the D-08 success / state-c / state-d branches + the audit receipt.
    """
    # Lazy import (break the emitters → tool_dispatcher cycle; mirrors phase_types).
    from app.services.tool_dispatcher import _handle_render_template

    asset_ref = resolved_template.get("asset_ref")
    # The hardened handler validates+re-resolves from the asset DICT (AssetRef.model_validate).
    asset_dict = None
    if asset_ref is not None:
        asset_dict = {
            "asset_id": getattr(asset_ref, "asset_id", None),
            "filename": getattr(asset_ref, "filename", None),
            "kind": getattr(asset_ref, "kind", None),
            "mime": getattr(asset_ref, "mime", None),
        }

    # out_filename: a sensible basename derived from the template filename; the handler's
    # own _safe_out_filename (CR-01) coerces a bad name to a safe default — do NOT pre-sanitize.
    out_filename = resolved_template.get("filename") or "deliverable.docx"

    args = {
        "field_map": validated_map,
        "retrieved_ids": list(resolved_template.get("retrieved_ids") or []),
        "out_filename": out_filename,
        "asset": asset_dict,  # None => the handler takes the ephemeral-upload branch
        # Truncation was already guarded by forced_emit (D-08 layer 4) before the gate;
        # pass empty meta so the handler's re-check is a no-op (never re-rejects a clean shot).
        "emission_meta": {},
    }

    result = await _handle_render_template(args, ctx)
    # _handle_render_template returns a ToolResult whose .result is a JSON string.
    raw = getattr(result, "result", None)
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except (ValueError, TypeError):
            return {"status": "error", "reason": "bad_verdict", "message": raw}
    if isinstance(raw, dict):
        return raw
    return {"status": "error", "reason": "no_verdict", "message": "render produced no verdict"}


# ── v1 entry: render_template (D-04 — render_template demoted to the first emitter) ──
# schema_builder = the Pitfall-4-safe field-map tool schema (Pydantic only, no docxtpl).
# post_processor = _render_template_post — re-dispatches the hardened _handle_render_template
# (one render code path; CR-01/WR-02/WR-03/WR-04 hardening + the two D-08 gates inherited).
register_emitter("render_template")(
    EmitterEntry(
        schema_builder=build_field_map_tool_schema,
        post_processor=_render_template_post,
    )
)
