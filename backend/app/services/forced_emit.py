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
  - **Layer 6 (substrate half — gap 1b / Phase 101.1-07):** a provider call that
    RAISES (a 400, a mid-stream decode error) is caught and converted to an honest
    ``failure="provider_error"`` result — NEVER a silent escape to threads.py
    agent_runner (G-5 frozen). The executor (Plan 03 / Plan 07 Task 3) owns the
    executor half of layer 6 (render/persist raises → honest receipt).

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

from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from app.config import get_model_capability, settings
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


def _coerce_schema_block(emitter: str, tools: list[dict]) -> str:
    """101.1 review WR-04: the emitter schema inlined into the COERCE system prompt.

    A STRUCTURED calling-mode model (registry ``native_tools: False`` / OpenRouter
    ``xml`` strategy) never receives the ``tools`` param — the openai_compat path
    deliberately omits it, and the consumer-side schema injection lives in the open
    agent loop this substrate bypasses (D-01). Without this block, a coerce-tier
    STRUCTURED model is asked to call a tool whose schema it has NEVER seen — every
    ``llm_emit`` phase fails state (a) while the message blames the model. Inlining
    the schema makes the request honest for EVERY coerce model (harmless duplication
    for a NATIVE coerce model — its tools param already carries it) and pairs with
    the STRUCTURED-mode recovery below (``recover_narrated_emission`` already parses
    the tool-wrapped narration shape via ``parse_structured_tool_calls``)."""
    for t in tools or []:
        fn = t.get("function") if isinstance(t, dict) else None
        if fn and fn.get("name") == emitter:
            try:
                schema = json.dumps(fn.get("parameters"))
            except (TypeError, ValueError):
                return ""
            return (
                f"\n\nThe `{emitter}` tool's arguments MUST validate against this "
                f"JSON schema:\n{schema}\n"
                "If you cannot call tools natively, emit EXACTLY ONE fenced ```json "
                f'block of the shape {{"tool": "{emitter}", "arguments": {{...}}}} '
                "and nothing else."
            )
    return ""


def recover_narrated_emission(
    content: str, schema_model: type[BaseModel] | None = None
) -> BaseModel | None:
    """D-06 NATIVE narrated-JSON recovery: parse a still-narrated field-map back into a
    validated model (``schema_model or EmitFieldMap``) — or return ``None`` (honest
    failure, NEVER a silent drop, NEVER an empty "success" map).

    Two recovery strategies, in order:
      1. The tool-wrapped narration (``{"tool": <emitter>, "arguments": {...}}`` in a
         fenced block) — reuse the SAME ``parse_structured_tool_calls`` helper the
         STRUCTURED path uses (``agent_loop.py``/``task_service.py``), then validate
         the parsed ``arguments`` against the model.
      2. A BARE fenced object that is DIRECTLY a valid model instance (the
         reasoning-native GAP-D shape — the model narrates the field-map itself, not a
         tool wrapper).

    Either way the recovered object MUST ``model_validate`` against ``schema_model`` (or
    ``EmitFieldMap`` by default — CR-01 additive seam) to be accepted; an un-parseable /
    non-validating narration returns ``None`` (the run then fails honestly upstream).
    """
    if not content or not content.strip():
        return None

    # Strategy 1: the tool-call-wrapped narration ({"tool":...,"arguments":{...}}).
    # Pass the emitter name set so the parser accepts a render_template-shaped block
    # even though the emit tool is absent from the global get_tools() catalog.
    try:
        for call in parse_structured_tool_calls(content, known_tools=None):
            fm = _validate_args(call.function.arguments, schema_model)
            if fm is not None:
                return fm
    except Exception:  # noqa: BLE001 — recovery is best-effort; fall through to strategy 2
        logger.debug("forced_emit: structured-wrapper recovery failed", exc_info=True)

    # Strategy 2: a bare fenced object that is directly a valid model instance.
    for blob in _iter_fenced_json(content):
        fm = _validate_args(blob, schema_model)
        if fm is not None:
            return fm
    return None


def _validate_args(
    raw: Any, schema_model: type[BaseModel] | None = None
) -> BaseModel | None:
    """Validate raw tool-call arguments (a JSON string or a dict) against the emission
    model. CR-01 additive seam: ``_model = schema_model or EmitFieldMap`` — the default
    (``schema_model=None``) preserves the byte-identical ``EmitFieldMap`` validation
    every existing emit caller relies on; the judge callers pass
    ``schema_model=JudgeVerdict`` to validate a verdict shot. Returns ``None`` on any
    parse/validation error (never raises — honest-fail path)."""
    _model = schema_model or EmitFieldMap
    try:
        data = json.loads(raw) if isinstance(raw, str) else raw
        if not isinstance(data, dict):
            return None
        return _model.model_validate(data)
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


def _failure(
    tier: str,
    provider: str,
    *,
    forced: bool,
    truncated: bool = False,
    failure_override: str | None = None,
) -> dict:
    """The honest-failure result shape (D-08 layer 4 boundary → executor layers 5-6).

    ``failure_override`` (Phase 101.1-07, gap 1b) lets the RAISED-exception backstop
    distinguish a provider call that *threw* (``"provider_error"``) from a model that
    simply failed to emit (``"model_failed_to_emit"``) — the happy-failure values
    (model_failed_to_emit / truncated) are unchanged.
    """
    return {
        "emitted": None,
        "tier": tier,
        "provider": provider,
        "forced": forced,
        "recovered_from_narration": False,
        "truncated": truncated,
        "failure": failure_override or "model_failed_to_emit",
        "emit_rung": None,  # Phase 122 (MP-01): no rung won — the honest-fail floor.
    }


# Phase 122 (MP-01 / D-122-02): the ordered recovery ladder, keyed by ``emit_tier``.
# Each rung is an already-known-good mode ``forced_emit`` already builds — the loop
# just CHAINS them so a strict-400 recovers via a lower rung instead of going dark
# (BUG-260615-01). Rung tuple = (name, forced, strict_schema):
#   force_strict → strict-force → non-strict-force → coerce  (then honest fail)
#   force        → non-strict-force → coerce                  (no token-level strict)
#   coerce       → coerce                                     (genuinely unforceable)
# The list is TIER-SCOPED so a coerce-tier model NEVER runs the strict/non-strict
# rung (it would 400 every Kimi — RESEARCH anti-pattern). Pure runtime recovery: the
# ladder logs the winning rung but NEVER mutates the registry (D-122-03).
_RUNGS_BY_TIER: dict[str, list[tuple[str, bool, bool]]] = {
    "force_strict": [
        ("strict_force", True, True),
        ("non_strict_force", True, False),
        ("coerce", False, False),
    ],
    "force": [
        ("non_strict_force", True, False),
        ("coerce", False, False),
    ],
    "coerce": [
        ("coerce", False, False),
    ],
}


def _build_request(
    *,
    messages: list[dict],
    model: str,
    provider: str,
    emitter: str,
    tools: list[dict],
    user_settings: Any,
    system_prompt: str,
    max_tokens: int | None,
    forced: bool,
    strict_schema: bool,
) -> GatewayRequest:
    """Assemble the per-rung ``GatewayRequest`` — the EXISTING FORCE/COERCE request
    assembly (live ``:294-330``), parameterized by the rung. ``forced=True`` names the
    tool the model MUST call (each adapter translates ``force_tool_name`` — Pitfall 5 /
    D-01) with ``strict_schema`` toggled per rung; ``forced=False`` (the coerce rung)
    keeps ``tool_choice="auto"`` + the directive + the inlined emitter schema so a
    STRUCTURED-mode model still sees the schema it must emit (101.1 review WR-04)."""
    if forced:
        return GatewayRequest(
            messages=messages,
            model=model,
            active_provider_name=provider,
            tools=tools,
            system_prompt=system_prompt,
            user_settings=user_settings,
            max_tokens=max_tokens,
            tool_choice="auto",  # ignored on the forced path — force_tool_name drives it
            force_tool_name=emitter,
            strict_schema=strict_schema,
        )
    # TIER-COERCE rung (Kimi/Moonshot — genuinely unforceable): keep tool_choice="auto"
    # + an explicit directive, then hard-validate (D-05). NEVER a model-written-code
    # fallback (D-03). WR-04: inline the emitter schema so a STRUCTURED calling-mode
    # model (which never receives the tools param) still sees the schema it must emit.
    _system = (
        (system_prompt or "")
        + _COERCE_DIRECTIVE.format(emitter=emitter)
        + _coerce_schema_block(emitter, tools)
    )
    return GatewayRequest(
        messages=messages,
        model=model,
        active_provider_name=provider,
        tools=tools,
        system_prompt=_system,
        user_settings=user_settings,
        max_tokens=max_tokens,
        tool_choice="auto",
    )


def _extract_or_recover(
    tool_calls: list[dict],
    content: str,
    calling_mode: "CallingMode",
    emitter: str,
    schema_model: type[BaseModel] | None,
) -> tuple[BaseModel | None, bool]:
    """Extract the emitter's validated args from the committed tool call, OR recover a
    still-narrated field-map (D-06). Returns ``(emitted_or_None, recovered_from_narration)``.

    Happy path: the model committed the forced tool call → validate its args against
    ``schema_model or EmitFieldMap`` (CR-01). D-06 narration recovery: no (valid) tool
    call but the model narrated the field-map (NATIVE reasoning-native shape AND — 101.1
    WR-04 — STRUCTURED mode, which can ONLY answer in content). Either pure piece is
    reused VERBATIM from the pre-122 body (no behavior change per rung)."""
    emitted: BaseModel | None = None
    for call in tool_calls:
        if call.get("name") == emitter:
            emitted = _validate_args(call.get("arguments"), schema_model)
            if emitted is not None:
                return emitted, False

    if (
        emitted is None
        and calling_mode in (CallingMode.NATIVE, CallingMode.STRUCTURED)
        and content.strip()
    ):
        emitted = recover_narrated_emission(content, schema_model)
        if emitted is not None:
            return emitted, True
    return None, False


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
    schema_model: type[BaseModel] | None = None,
    strict: bool | None = None,
) -> dict:
    """Run the forced-emit RECOVERY LADDER and return a structured result.

    Phase 122 (MP-01 / D-122-02): the SEALED shot is now an ORDERED rung ladder resolved
    from the model's ``emit_tier`` (D-122-04). A strict-400 RECOVERS via a lower rung
    instead of degrading to a silent ``None`` (BUG-260615-01). The ladder re-drives the
    gateway per rung (it does NOT fork the shared path — D-14); it logs the winning rung
    but NEVER mutates the registry (pure runtime recovery, D-122-03).

    Rung order by ``emit_tier`` (tier-scoped — a coerce-tier model NEVER runs the
    strict/non-strict rung):

      - ``force_strict`` → [strict_force, non_strict_force, coerce] → fail
      - ``force``        → [non_strict_force, coerce]               → fail
      - ``coerce``       → [coerce]                                 → fail

    Returns a dict::

        {
          "emitted": EmitFieldMap | None,   # the validated emission, or None on failure
          "tier": "force_strict" | "force" | "coerce",   # the resolved emit_tier
          "emit_rung": str | None,          # the WINNING rung name (None on honest fail)
          "provider": <provider>,
          "forced": bool,                   # did the winning rung force the named tool?
          "recovered_from_narration": bool, # did the D-06 narration recovery fire?
                                            # (NATIVE or — WR-04 — STRUCTURED mode)
          "truncated": bool,                # was the last rung cut off (D-08 layer 4)?
          "failure": None | "model_failed_to_emit" | "provider_error",
        }

    The caller (``_exec_llm_emit``, Plan 03) runs the D-08 layers 5-6 (bounded retry /
    honest-fail surface) on a non-None ``failure``; this substrate never falls back to
    model-written code (D-03).

    ``strict`` (Phase 103 / REQ-2 / Pitfall 1) is an ADDITIVE override for the gateway's
    ``strict_schema`` flag. ``None`` (the default) preserves the registry-derived
    ``cap.get("strict_json_schema")`` behavior BYTE-IDENTICALLY for every existing caller
    (the emit deliverable + the judge). An explicit ``False`` forces strict OFF — the
    forcing-without-strict path the authoring shot uses so an optional-heavy
    ``WorkflowDefinition`` does NOT 400 on OpenAI/DeepSeek (strict mode requires every
    property in ``required``). ``True`` is reserved (not used by 103).
    """
    cap = get_model_capability(model) or {}
    # Phase 122 (MP-02 / D-122-04/05): ``emit_tier`` is the single source of truth — a
    # registry miss SAFELY degrades to "coerce" (default-SAFE, never wrongly forces).
    # This REPLACES the pre-122 two-bool guess (forced_emission + strict_json_schema).
    emit_tier = cap.get("emit_tier", "coerce")
    if emit_tier not in _RUNGS_BY_TIER:  # boundary guard — an unknown value is coerce-safe
        emit_tier = "coerce"
    # Phase 103 (REQ-2 / Pitfall 1): the ``strict`` override is for the authoring shot —
    # an explicit ``strict=False`` forces strict OFF so an optional-heavy
    # WorkflowDefinition does not 400 (OpenAI/DeepSeek strict requires every property in
    # ``required``). The ladder honors it by DEMOTING the strict_force rung to
    # non-strict-force when the caller passed ``strict=False`` (the force-without-strict
    # path) — see the rung loop below. ``strict=True`` (reserved) forces it ON.

    # Cross-provider key resolution (102-UAT-02). A forced shot may TARGET a provider that
    # is NOT the caller's active provider — the judge (D-03 independent model) is the first
    # such caller. The gateway adapters resolve api_key from the SINGLE active-provider
    # ``user_settings.llm_api_key`` (provider_gateway/anthropic.py:59 / google.py / openai),
    # so a cross-provider shot would be handed the WRONG provider's key → 401 → provider_error.
    # Resolve the TARGET provider's per-provider key here and inject it on a COPY of the
    # caller's settings. Fires ONLY when (a) the target provider differs from the active
    # provider AND (b) the caller passed a real settings model AND (c) the env carries that
    # provider's key — so the active-provider path (Deep emit) is byte-identical (no copy).
    _active_provider = (getattr(user_settings, "active_provider", "") or settings.llm_provider or "")
    if provider and provider != _active_provider and hasattr(user_settings, "model_copy"):
        # D-09 #2 (BUG-260616-01 / EMBED-01): local providers (lmstudio/ollama) have NO
        # ``<provider>_api_key`` env field, so the cloud branch below would no-op
        # (``_target_key == ""``) and the forced shot would fall through to the WRONG
        # active (cloud) provider — shipping document text off-box. Inject the local
        # dummy key + local base_url here, MIRRORING ``resolve_llm_provider`` exactly
        # (Ollama appends ``/v1``; LM Studio's URL already ends ``/v1`` → AS-IS, no
        # double-append; dummy keys ``"ollama"`` / ``"lm-studio"``). A forced local shot
        # now resolves the local endpoint and stays local.
        if provider in ("ollama", "lmstudio"):
            _updates = {"llm_api_key": "lm-studio" if provider == "lmstudio" else "ollama"}
            _updates["llm_base_url"] = (
                settings.lmstudio_base_url.rstrip("/") if provider == "lmstudio"
                else f"{settings.ollama_base_url.rstrip('/')}/v1"
            )
            user_settings = user_settings.model_copy(update=_updates)
        else:
            _target_key = getattr(settings, f"{provider}_api_key", "")
            if _target_key:
                _updates = {"llm_api_key": _target_key}
                # FINDING-05 (102-UAT): the openai-compat path (openai/openrouter/deepseek/
                # moonshot/minimax/zhipu) resolves the ENDPOINT from ``llm_base_url`` — the
                # active provider's by default. A cross-provider shot must ALSO carry the
                # TARGET provider's base_url, else the right key is sent to the wrong endpoint
                # (e.g. an openrouter key → api.openai.com → 401). Native adapters (anthropic/
                # google) ignore llm_base_url (fixed SDK endpoints), so this is harmless there;
                # "" (openai target) → the SDK's own default endpoint.
                from app.config import _PROVIDER_BASE_URLS  # function-local
                if provider in _PROVIDER_BASE_URLS:
                    _updates["llm_base_url"] = _PROVIDER_BASE_URLS[provider]
                user_settings = user_settings.model_copy(update=_updates)

    # Phase 122 (MP-01 / D-122-02): the ORDERED recovery ladder. Loop over the
    # tier-scoped rung list; the FIRST rung that yields a validated emission wins. On a
    # provider raise (e.g. a strict 400) / truncation / no-emit, DESCEND to the next
    # rung instead of going dark (BUG-260615-01). After the last rung, return the
    # existing honest ``_failure`` floor (emitted=None — never silent, never fabricated).
    last_failure: str | None = None
    last_truncated = False
    for rung_name, forced, rung_strict in _RUNGS_BY_TIER[emit_tier]:
        # Phase 103 strict override: an explicit ``strict=False`` demotes the
        # strict_force rung (skip it — it would be a redundant non-strict duplicate);
        # otherwise the override (True/False) wins over the rung's declared strict, and
        # ``strict=None`` (the default) honors the rung's declared strict byte-identically.
        if strict is False and rung_name == "strict_force":
            continue
        effective_strict = rung_strict if strict is None else bool(strict)

        req = _build_request(
            messages=messages,
            model=model,
            provider=provider,
            emitter=emitter,
            tools=tools,
            user_settings=user_settings,
            system_prompt=system_prompt,
            max_tokens=max_tokens,
            forced=forced,
            strict_schema=effective_strict,
        )

        # Phase 101.1-07 (gap 1b / D-08 layer 6 — the substrate half): a provider call
        # that RAISES (a 400, a mid-stream decode error) is an HONEST failure — but with
        # the ladder it DESCENDS to the next rung rather than short-circuiting to None.
        # Only the provider call sites are wrapped; the truncation guard / extract /
        # recover stay outside so they run on the SUCCESS path only. Log identifier-only
        # (T-073-04 — never the message/args content).
        try:
            stream, calling_mode = await open_stream(provider, req)
            content, tool_calls, finish_reason = await run_in_threadpool(_drain, stream)
        except Exception:  # noqa: BLE001 — a provider raise → descend to the next rung
            logger.info(
                "forced_emit: rung=%s raised; descending emit_tier=%s provider=%s",
                rung_name, emit_tier, provider,
            )
            last_failure = "provider_error"
            last_truncated = False
            continue

        # D-08 layer 4: a truncated half-object is rejected — descend to the next rung.
        if is_truncated(finish_reason=finish_reason):
            last_failure = "model_failed_to_emit"
            last_truncated = True
            continue

        emitted, recovered = _extract_or_recover(
            tool_calls, content, calling_mode, emitter, schema_model
        )
        if emitted is not None:
            # D-122-03 telemetry: which rung won — logged identifier-only, NEVER written
            # to the registry (pure runtime recovery; no auto-demotion).
            logger.info(
                "forced_emit: emit_rung=%s emit_tier=%s provider=%s",
                rung_name, emit_tier, provider,
            )
            return {
                "emitted": emitted,
                "tier": emit_tier,
                "provider": provider,
                "forced": forced,
                "recovered_from_narration": recovered,
                "truncated": False,
                "failure": None,
                "emit_rung": rung_name,
            }
        last_failure = "model_failed_to_emit"
        last_truncated = False

    # All rungs exhausted → the existing honest-fail floor (never silent, never
    # fabricated — GAP-D / D-06 / Spoofing mitigation). ``forced=False`` on the floor
    # mirrors the pre-122 shape (no rung committed).
    return _failure(
        emit_tier,
        provider,
        forced=False,
        truncated=last_truncated,
        failure_override=last_failure,
    )


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
