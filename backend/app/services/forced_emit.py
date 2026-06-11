"""Phase 101.1 (D-01 / D-05 / D-06 / D-08 layers 1-4) — the forced-emit substrate.

The SEALED single forced shot that turns the GAP-A/GAP-D 0-docx failure into either
a forced emission OR an honest failure. This module owns D-08 layers 1-4:

  - **Layer 1 (isolation):** ``forced_emit`` drives the provider gateway ONCE
    (``open_stream``) — it never invokes the open agent loop (the sub-agent runner /
    the Deep loop). The open auto-tool-choice loop is the live root cause of the
    0-docx failure (GAP-A / D-01 / Pitfall 5); the emit is a sealed single shot.
  - **Layer 2 (tiered forcing):** the tier resolves registry-first, default-SAFE
    (``get_model_capability(model).get("forced_emission", False)`` — a miss is
    TIER-COERCE, never wrongly forces). TIER-FORCE sets ``force_tool_name=<emitter>``
    on the GatewayRequest (each native adapter translates it — Plan 02 Task 1);
    TIER-COERCE keeps ``tool_choice="auto"`` + an explicit "you MUST call <emitter>
    NOW" directive, then hard-validates (D-05 — Kimi/Moonshot are genuinely
    unforceable; never a model-written-code fallback).
  - **Layer 3 (NATIVE recovery):** when the model NARRATED a fenced field-map object
    instead of committing the tool call, ``recover_narrated_emission`` parses it back
    and validates it against ``EmitFieldMap`` (D-06). An un-parseable / invalid
    narration is a clean honest failure — NEVER a silent drop, NEVER the prose
    accepted as the artifact (the GAP-D fix).
  - **Layer 4 (validation + truncation):** ``is_truncated`` rejects a
    ``stop_reason=max_tokens`` / ``finish_reason=length`` half-object BEFORE
    acceptance; the accepted emission is validated against ``EmitFieldMap``.

Layers 5-6 (bounded retry / honest-fail surface) are the executor's (Plan 03) via the
shipped ``_retry_suffix`` / ``_surface_failure_message`` — this substrate returns a
STRUCTURED result the executor consumes.

SC#3 — NO IMPORT CYCLE: imports only the gateway (``open_stream`` / ``GatewayRequest``
/ ``CallingMode``), the tool parser, the config registry, and the deterministic
template-render core — all BELOW it / sibling. NEVER imports ``agent_loop`` /
``threads.py`` / ``task_service`` (the open loop).
"""
from __future__ import annotations

import json
import logging
from typing import Any

from starlette.concurrency import run_in_threadpool

from app.config import get_model_capability
from app.services.provider_gateway import CallingMode, GatewayRequest, open_stream
from app.services.template_render_service import EmitFieldMap, is_truncated
from app.services.tool_parser import parse_structured_tool_calls

logger = logging.getLogger(__name__)

# The explicit directive prepended on a TIER-COERCE provider (Kimi/Moonshot — no
# native named/required forcing; D-05 TIER-COERCE). The hard-validate below catches a
# model that ignores it; never a code-emission fallback (D-03).
_COERCE_DIRECTIVE = (
    "\n\nYou MUST call the `{emitter}` tool NOW with the structured field-map. "
    "Do not narrate the field-map as prose — emit it as a single tool call. "
    "For every non-null value set source_chunk_id to the <doc id> it came from; "
    "if the knowledge base does not support a value, set value to null. "
    "Never invent a value or a citation."
)


def recover_narrated_emission(content: str) -> EmitFieldMap | None:
    """D-06 NATIVE narrated-JSON recovery: parse a still-narrated field-map back into a
    validated ``EmitFieldMap`` — or return ``None`` (honest failure, NEVER a silent
    drop, NEVER an empty "success" map).

    Two recovery strategies, in order:
      1. The tool-wrapped narration (``{"tool": <emitter>, "arguments": {...}}`` in a
         fenced block) — reuse the SAME ``parse_structured_tool_calls`` helper the
         STRUCTURED path uses (``agent_loop.py``/``task_service.py``), then validate
         the parsed ``arguments`` against ``EmitFieldMap``.
      2. A BARE fenced object that is DIRECTLY an ``EmitFieldMap`` (the reasoning-native
         GAP-D shape — the model narrates the field-map itself, not a tool wrapper).

    Either way the recovered object MUST ``model_validate`` as an ``EmitFieldMap`` to be
    accepted — an un-parseable / non-validating narration returns ``None`` (the run then
    fails honestly upstream).
    """
    if not content or not content.strip():
        return None

    # Strategy 1: the tool-call-wrapped narration ({"tool":...,"arguments":{...}}).
    # Pass the emitter name set so the parser accepts a render_template-shaped block
    # even though the emit tool is absent from the global get_tools() catalog.
    try:
        for call in parse_structured_tool_calls(content, known_tools=None):
            fm = _validate_args(call.function.arguments)
            if fm is not None:
                return fm
    except Exception:  # noqa: BLE001 — recovery is best-effort; fall through to strategy 2
        logger.debug("forced_emit: structured-wrapper recovery failed", exc_info=True)

    # Strategy 2: a bare fenced object that is directly an EmitFieldMap.
    for blob in _iter_fenced_json(content):
        fm = _validate_args(blob)
        if fm is not None:
            return fm
    return None


def _validate_args(raw: Any) -> EmitFieldMap | None:
    """Validate raw tool-call arguments (a JSON string or a dict) as an EmitFieldMap.
    Returns ``None`` on any parse/validation error (never raises — honest-fail path)."""
    try:
        data = json.loads(raw) if isinstance(raw, str) else raw
        if not isinstance(data, dict):
            return None
        return EmitFieldMap.model_validate(data)
    except Exception:  # noqa: BLE001 — a non-validating object is an honest failure, not a crash
        return None


def _iter_fenced_json(text: str):
    """Yield candidate JSON strings from ```json fenced blocks AND the whole-text body
    (for a model that narrated the object with no fence). Best-effort, deterministic."""
    import re

    seen: set[str] = set()
    for m in re.findall(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", text):
        if m not in seen:
            seen.add(m)
            yield m
    # The model may have narrated a bare object with no fence — try the largest
    # top-level {...} span as a fallback.
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end > start:
        cand = text[start : end + 1]
        if cand not in seen:
            yield cand


def _failure(tier: str, provider: str, *, forced: bool, truncated: bool = False) -> dict:
    """The honest-failure result shape (D-08 layer 4 boundary → executor layers 5-6)."""
    return {
        "emitted": None,
        "tier": tier,
        "provider": provider,
        "forced": forced,
        "recovered_from_narration": False,
        "truncated": truncated,
        "failure": "model_failed_to_emit",
    }


async def forced_emit(
    *,
    messages: list[dict],
    model: str,
    provider: str,
    emitter: str,
    tools: list[dict],
    user_settings: Any,
    system_prompt: str = "",
    max_tokens: int | None = None,
) -> dict:
    """Run a SEALED single forced shot and return a structured result.

    Returns a dict::

        {
          "emitted": EmitFieldMap | None,   # the validated emission, or None on failure
          "tier": "TIER-FORCE" | "TIER-COERCE",
          "provider": <provider>,
          "forced": bool,                   # was named-tool forcing applied?
          "recovered_from_narration": bool, # did the D-06 NATIVE recovery fire?
          "truncated": bool,                # was the shot cut off (D-08 layer 4)?
          "failure": None | "model_failed_to_emit",
        }

    The caller (``_exec_llm_emit``, Plan 03) runs the D-08 layers 5-6 (bounded retry /
    honest-fail surface) on a non-None ``failure``; this substrate never retries and
    never falls back to model-written code (D-03).
    """
    cap = get_model_capability(model) or {}
    forced = bool(cap.get("forced_emission", False))  # default-SAFE — a miss is coerce
    strict = bool(cap.get("strict_json_schema", False))
    tier = "TIER-FORCE" if forced else "TIER-COERCE"

    _system = system_prompt
    if forced:
        # TIER-FORCE: name the tool the model MUST call (each adapter translates the
        # force_tool_name — Plan 02 Task 1). NEVER tool_choice="auto" on a forced
        # provider (Pitfall 5 / D-01).
        req = GatewayRequest(
            messages=messages,
            model=model,
            active_provider_name=provider,
            tools=tools,
            system_prompt=_system,
            user_settings=user_settings,
            max_tokens=max_tokens,
            tool_choice="auto",  # ignored on the forced path — force_tool_name drives it
            force_tool_name=emitter,
            strict_schema=strict,
        )
    else:
        # TIER-COERCE (Kimi/Moonshot — genuinely unforceable): keep tool_choice="auto"
        # + an explicit directive, then hard-validate the result (D-05). NEVER a
        # model-written-code fallback (D-03).
        _system = (_system or "") + _COERCE_DIRECTIVE.format(emitter=emitter)
        req = GatewayRequest(
            messages=messages,
            model=model,
            active_provider_name=provider,
            tools=tools,
            system_prompt=_system,
            user_settings=user_settings,
            max_tokens=max_tokens,
            tool_choice="auto",
        )

    stream, calling_mode = await open_stream(provider, req)

    content, tool_calls, finish_reason = await run_in_threadpool(_drain, stream)

    # D-08 layer 4: reject a truncated half-object BEFORE acceptance.
    if is_truncated(finish_reason=finish_reason):
        return _failure(tier, provider, forced=forced, truncated=True)

    # Happy path: the model committed the forced tool call → validate its args.
    emitted: EmitFieldMap | None = None
    recovered = False
    for call in tool_calls:
        if call.get("name") == emitter:
            emitted = _validate_args(call.get("arguments"))
            if emitted is not None:
                break

    # D-06 NATIVE recovery: no (valid) tool call but the model narrated the field-map.
    if emitted is None and calling_mode == CallingMode.NATIVE and content.strip():
        emitted = recover_narrated_emission(content)
        if emitted is not None:
            recovered = True

    if emitted is None:
        # Honest failure — never a silent drop, never prose-as-artifact (GAP-D / D-06).
        return _failure(tier, provider, forced=forced)

    return {
        "emitted": emitted,
        "tier": tier,
        "provider": provider,
        "forced": forced,
        "recovered_from_narration": recovered,
        "truncated": False,
        "failure": None,
    }


def _drain(stream) -> tuple[str, list[dict], str | None]:
    """Drain ONE forced shot's gateway event stream into ``(content, tool_calls,
    finish_reason)``. Mirrors ``task_service._stream_one_iteration._drain`` (the
    canonical single-call drain) — but it is a SEALED single shot, never the open
    loop (D-01). Drives the bare sync generator inside a threadpool; closes it after.
    """
    content_parts: list[str] = []
    buffer: dict[int, dict] = {}
    finish_reason: str | None = None
    try:
        for event in stream:
            et = event.get("type")
            if et == "delta":
                _t = event.get("content", "")
                if _t:
                    content_parts.append(_t)
            elif et == "tool_preparing":
                idx = event.get("index", len(buffer))
                if idx not in buffer:
                    buffer[idx] = {
                        "id": event.get("id", "") or "",
                        "name": event.get("name", "") or "",
                        "arguments": "",
                    }
            elif et == "tool_args_progress":
                tidx = event["tool_index"]
                b = buffer.setdefault(tidx, {"id": "", "name": "", "arguments": ""})
                if event.get("name"):
                    b["name"] = event["name"]
                b["arguments"] = event.get("code_so_far", "")
            elif et == "tool_start":
                buffer[len(buffer)] = {
                    "id": event["id"],
                    "name": event["name"],
                    "arguments": json.dumps(event.get("args", {})),
                }
            elif et == "finish":
                finish_reason = event.get("finish_reason")
                # The native adapters (anthropic/google) carry the COMPLETE tool_calls
                # on the finish event — fold them into the buffer so a single-chunk
                # forced tool call is captured.
                for _i, _ftc in enumerate(event.get("tool_calls", []) or []):
                    _args = _ftc.get("arguments")
                    if isinstance(_args, dict):
                        _args = json.dumps(_args)
                    b = buffer.setdefault(
                        _i, {"id": "", "name": "", "arguments": ""}
                    )
                    if _ftc.get("id"):
                        b["id"] = _ftc["id"]
                    if _ftc.get("name"):
                        b["name"] = _ftc["name"]
                    if _args:
                        b["arguments"] = _args
    finally:
        close = getattr(stream, "close", None)
        if close is not None:
            try:
                close()
            except Exception:  # noqa: BLE001
                logger.debug("forced_emit: stream close failed; ignoring", exc_info=True)

    return "".join(content_parts), [buffer[i] for i in sorted(buffer)], finish_reason
