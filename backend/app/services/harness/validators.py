"""Validation gates for the workflow harness (Phase 091 / HARNESS-04).

A workflow phase may carry one or more :class:`ValidatorSpec` gates (harness.py).
After a phase produces its output, the engine runs the gates IN ORDER; the first
failure drives the bounded-retry / ``on_failure`` routing (the engine owns that
loop — see ``harness_engine``). This module owns the 4 validator KINDS and the
``run_gates`` fan-in.

Four kinds (``ValidatorSpec.kind`` literal, firm in harness.py):
    | kind                  | implementation                                      |
    |-----------------------|-----------------------------------------------------|
    | json_schema           | jsonschema.validate (declarative — no eval)         |
    | regex_match           | re.search(config["pattern"], output text)           |
    | workspace_file_exists | get_file_by_path(pool, thread_id, config["path"])   |
    | programmatic          | a CLOSED registry fn (unknown raises — never eval'd)|

The registry mirrors ``tool_dispatcher._TOOL_REGISTRY`` and
``PROGRAMMATIC_PHASE_REGISTRY``: a closed dict + a ``register_validator`` decorator.

SECURITY (threat register, Plan 05):
  - T-091-17: ``json_schema`` uses ``jsonschema.validate`` (declarative, no eval);
    the ``programmatic`` kind resolves a CLOSED ``PROGRAMMATIC_VALIDATOR_REGISTRY``
    (an unknown ``fn`` name raises, never dynamically imported/eval'd).
  - A malformed phase output must FAIL the gate, never crash the run — every kind
    fails closed with a descriptive ``error_message``.
"""

from __future__ import annotations

import re
from collections import namedtuple
from typing import Awaitable, Callable

import jsonschema

__all__ = [
    "GateResult",
    "VALIDATOR_REGISTRY",
    "PROGRAMMATIC_VALIDATOR_REGISTRY",
    "register_validator",
    "register_programmatic_validator",
    "run_gates",
]


# A gate result: ``passed`` bool + ``error_message`` (None when passed). The
# error_message is fed back into the retry prompt by the engine (D-08 visible
# self-correction).
GateResult = namedtuple("GateResult", ["passed", "error_message"])


# ── registries (mirror _TOOL_REGISTRY / PROGRAMMATIC_PHASE_REGISTRY) ──────────
# kind -> async validator(output, config, ctx) -> GateResult
VALIDATOR_REGISTRY: dict[
    str, Callable[[dict, dict, object], Awaitable[GateResult]]
] = {}

# CLOSED registry for the ``programmatic`` validator kind. A name not present
# here raises in the validator — never resolved dynamically / eval'd (T-091-17).
PROGRAMMATIC_VALIDATOR_REGISTRY: dict[
    str, Callable[[dict, dict, object], Awaitable[GateResult]]
] = {}


def register_validator(kind: str) -> Callable[
    [Callable[[dict, dict, object], Awaitable[GateResult]]],
    Callable[[dict, dict, object], Awaitable[GateResult]],
]:
    """Decorator: register a validator under ``kind`` in :data:`VALIDATOR_REGISTRY`."""

    def deco(
        fn: Callable[[dict, dict, object], Awaitable[GateResult]],
    ) -> Callable[[dict, dict, object], Awaitable[GateResult]]:
        VALIDATOR_REGISTRY[kind] = fn
        return fn

    return deco


def register_programmatic_validator(name: str) -> Callable[
    [Callable[[dict, dict, object], Awaitable[GateResult]]],
    Callable[[dict, dict, object], Awaitable[GateResult]],
]:
    """Decorator: register a fn under ``name`` in the CLOSED programmatic registry.

    The ``programmatic`` validator kind resolves ``config["fn"]`` against this
    closed dict — an unknown name raises (T-091-17), it is never imported/eval'd.
    """

    def deco(
        fn: Callable[[dict, dict, object], Awaitable[GateResult]],
    ) -> Callable[[dict, dict, object], Awaitable[GateResult]]:
        PROGRAMMATIC_VALIDATOR_REGISTRY[name] = fn
        return fn

    return deco


# ── helpers ──────────────────────────────────────────────────────────────────
def _output_payload(output: dict) -> dict:
    """The structured payload a json_schema gate validates.

    A phase output is a dict (the executors return ``{"text": ...}`` plus any
    structured fields). Prefer an explicit ``payload`` key when present; else fall
    back to ``{"text": <text>}`` so a plain text phase can still be schema-checked.
    """
    if not isinstance(output, dict):
        return {"text": str(output)}
    if isinstance(output.get("payload"), dict):
        return output["payload"]
    return {"text": output.get("text", "")}


def _output_text(output: dict) -> str:
    """The chat-ready text a regex_match gate searches."""
    if isinstance(output, dict):
        return output.get("text") or ""
    return str(output or "")


# ── the 4 validator kinds ────────────────────────────────────────────────────
@register_validator("json_schema")
async def _validate_json_schema(output: dict, config: dict, ctx) -> GateResult:
    """Validate the phase output payload against an author-supplied JSON Schema.

    Uses ``jsonschema.validate`` (4.26.0) — declarative, NO eval (T-091-17). On a
    ``ValidationError`` the gate fails with the validator's descriptive message.
    A missing/malformed ``schema`` config fails closed (never crashes the run).
    """
    schema = config.get("schema")
    if schema is None:
        return GateResult(False, "json_schema validator: config.schema is missing")
    try:
        jsonschema.validate(_output_payload(output), schema)
        return GateResult(True, None)
    except jsonschema.ValidationError as e:
        return GateResult(False, str(e.message))
    except jsonschema.SchemaError as e:  # author-supplied schema is itself invalid
        return GateResult(False, f"invalid json_schema: {e.message}")


@register_validator("regex_match")
async def _validate_regex_match(output: dict, config: dict, ctx) -> GateResult:
    """Pass iff ``re.search(config["pattern"], output_text)`` matches."""
    pattern = config.get("pattern")
    if pattern is None:
        return GateResult(False, "regex_match validator: config.pattern is missing")
    try:
        matched = re.search(pattern, _output_text(output)) is not None
    except re.error as e:
        return GateResult(False, f"invalid regex /{pattern}/: {e}")
    return GateResult(
        matched, None if matched else f"output did not match /{pattern}/"
    )


@register_validator("workspace_file_exists")
async def _validate_workspace_file_exists(output: dict, config: dict, ctx) -> GateResult:
    """Pass iff the workspace file at ``config["path"]`` exists for the run's thread.

    Looks the file up via ``db/workspace.get_file_by_path(pool, thread_id, path)``
    (the existing typed asyncpg helper) — mock-friendly in unit tests (the ctx
    carries the mock pool + thread_id). Missing pool/thread/path fail closed.
    """
    path = config.get("path")
    if not path:
        return GateResult(
            False, "workspace_file_exists validator: config.path is missing"
        )
    pool = getattr(ctx, "pool", None)
    thread_id = getattr(ctx, "thread_id", None)
    if pool is None or not thread_id:
        return GateResult(
            False,
            "workspace_file_exists validator: no workspace context (pool/thread_id)",
        )
    from app.db.workspace import get_file_by_path

    row = await get_file_by_path(pool, thread_id, path)
    if row is not None:
        return GateResult(True, None)
    return GateResult(False, f"workspace file {path!r} does not exist")


@register_validator("programmatic")
async def _validate_programmatic(output: dict, config: dict, ctx) -> GateResult:
    """Resolve a registered validator fn from the CLOSED registry and run it.

    ``config["fn"]`` is looked up in :data:`PROGRAMMATIC_VALIDATOR_REGISTRY` — an
    unknown name raises ``KeyError`` (T-091-17 — never eval'd / dynamically
    imported). The fn returns its own :class:`GateResult`.
    """
    fn_name = config.get("fn")
    if not fn_name:
        return GateResult(False, "programmatic validator: config.fn is missing")
    fn = PROGRAMMATIC_VALIDATOR_REGISTRY.get(fn_name)
    if fn is None:
        raise KeyError(
            f"programmatic validator fn {fn_name!r} is not registered in "
            f"PROGRAMMATIC_VALIDATOR_REGISTRY (closed dict — register it explicitly)"
        )
    return await fn(output, config, ctx)


# ── fan-in ───────────────────────────────────────────────────────────────────
async def run_gates(phase, output: dict, ctx) -> GateResult:
    """Run every ``phase.validators`` gate in order; return the FIRST failure.

    Returns ``GateResult(True, None)`` when all gates pass (or the phase has no
    validators). The engine's bounded-retry loop consumes the returned
    ``error_message`` (feeds it back into the retry prompt, audits + emits it).
    """
    for spec in getattr(phase, "validators", None) or []:
        validator = VALIDATOR_REGISTRY.get(spec.kind)
        if validator is None:
            # A kind not in the registry is a definition/runtime error — fail
            # closed rather than silently pass an unenforced gate.
            return GateResult(
                False, f"unknown validator kind {spec.kind!r} (no registered validator)"
            )
        result = await validator(output, spec.config, ctx)
        if not result.passed:
            return result
    return GateResult(True, None)
