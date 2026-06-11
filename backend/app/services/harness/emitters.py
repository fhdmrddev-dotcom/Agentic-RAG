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

from dataclasses import dataclass
from typing import Callable, Optional

from app.services.template_render_service import build_field_map_tool_schema

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


# ── v1 entry: render_template (D-04 — render_template demoted to the first emitter) ──
# schema_builder = the Pitfall-4-safe field-map tool schema (Pydantic only, no docxtpl).
# post_processor = None for now; the executor plan wires the deterministic render
# dispatch (reusing the hardened _handle_render_template — one render code path).
register_emitter("render_template")(
    EmitterEntry(schema_builder=build_field_map_tool_schema, post_processor=None)
)
