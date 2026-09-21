"""OpenAI ``/v1/responses`` provider-gateway adapter (Phase 262).

WHY THIS MODULE EXISTS, in one sentence: the ``gpt-5.6`` reasoning family
(``sol`` / ``terra`` / ``luna``) **cannot do native tool calling on
``chat.completions`` at all**, and this is the surface where it can.

OpenAI hard-400s a ``chat.completions`` call that carries BOTH a native ``tools``
param AND reasoning::

    Function tools with reasoning_effort are not supported with this model.
    Use /v1/responses or set reasoning_effort to 'none'.

⚠ **That error names TWO doors and Phase 175 (XPROV-01) took NEITHER.** It routed the
family to ``CallingMode.STRUCTURED`` — tools injected as XML into the system prompt —
which avoids the 400 by surrendering the thing the 400 was about. The cost was paid
silently and continuously: no native ``tool_calls``, no ``parallel_tool_calls``, tool
invocations parsed back out of prose, and a Model Registry row still reading
``native_tools: True`` over a toggle that could not fire (the gate sat ABOVE the
``db_native`` read, on purpose). This module takes the FIRST door — reasoning and native
tools are served together here, so nothing is surrendered.

⛔ **THE STRUCTURED DOWNGRADE IS NOT DELETED, AND MUST NOT BE.** It remains correct for
every ``reasoning_first`` model NOT on this surface — an OpenRouter-served or self-hosted
copy of the same id still hits the 400 and still has no other answer. The gate is
``openai_service.uses_responses_api``, which checks the RESOLVED provider and not the
registry flag alone. See its docstring.

WHAT THIS ADAPTER OWES THE CONSUMER
-----------------------------------
The same canonical ``GatewayEvent`` vocabulary every other adapter emits (``events.py``),
and the same ``(stream, calling_mode)`` tuple ``open_stream`` returns — ``calling_mode``
rides ALONGSIDE the stream, never as an event (Pitfall 3 / L-3). It returns
``CallingMode.NATIVE``, because on this surface that is finally true.

Concretely, ``agent_loop`` builds ``tool_calls_buffer`` from ``tool_preparing``
(id + name + index) plus ``tool_args_progress`` (full cumulative ``code_so_far``), exactly
as it does for ``openai_compat`` — so this adapter emits NO synthetic ``tool_start``. The
5KB SSE boundary (``emit_sse``) is mirrored from ``openai_compat`` so the WIRE CADENCE the
browser sees is unchanged across both OpenAI surfaces.

⛔ THE ID WE EMIT IS ``call_id``, NEVER ``item.id``.
   The Responses API gives a function call two identifiers. ``id`` names the OUTPUT ITEM;
   ``call_id`` is what a later ``function_call_output`` must reference. Our loop stores the
   emitted id as ``messages.tool_calls[].tool_call_id`` and echoes it back on the next turn
   — so emitting ``item.id`` would round-trip an identifier the API does not recognise and
   every multi-tool turn would fail on round 2. ``_to_responses_input`` below is the other
   half of that contract.

⚠ KNOWN GAP, RECORDED RATHER THAN HIDDEN — reasoning items are NOT round-tripped.
   With ``store=False`` (the project's stateless-chat rule) OpenAI can return reasoning as
   ``reasoning.encrypted_content``, which a later turn may pass back so the model resumes
   its own chain of thought across a tool call. We do not: our history is persisted in
   chat-completions shape (``messages.tool_calls`` jsonb) and carrying an opaque per-turn
   blob through ``_reconstruct_history`` is a schema-and-round-trip change, not an adapter
   change. The loop is CORRECT without it — each turn simply reasons afresh. Re-open when a
   measured multi-tool-turn quality gap justifies the schema work.

SC — NO IMPORT CYCLE: imports ``openai_service`` (BELOW the gateway) and ``.events`` only.
It MUST NEVER import ``agent_loop`` / ``threads.py``.
"""
from __future__ import annotations

from typing import TYPE_CHECKING, Any, Generator

from app.config import settings
from app.models.user_settings import tool_args_progress_emit_boundary_bytes
from app.services.openai_service import (
    CallingMode,
    _resolve_db_max_output_cap,
    _resolve_max_tokens,
    get_llm_client,
    get_tools,
)

if TYPE_CHECKING:  # pragma: no cover - typing only
    from .dispatcher import GatewayRequest


# ── Request translation ───────────────────────────────────────────────────────
#
# The consumer speaks chat-completions shape everywhere: in the DB rows, in
# ``_reconstruct_history``, and in the in-loop ``messages.append``. Translating HERE —
# at the service boundary — is the project's standing rule (keep provider-specific
# handling at the boundary, never break the shared path). Nothing upstream of this
# module knows the Responses API exists.


def _text_of(content: Any) -> str:
    """Flatten a chat ``content`` value to plain text.

    Accepts ``None`` (a tool-calling assistant message often has no content at all), a bare
    string, or the multimodal block list. Only text is taken — an image block is handled by
    ``_user_content`` on the input side, and an ASSISTANT turn never carries one.
    """
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                parts.append(block.get("text") or "")
            elif isinstance(block, str):
                parts.append(block)
        return "".join(parts)
    return str(content)


def _user_content(content: Any) -> Any:
    """Translate a USER message's content, preserving images.

    Chat blocks (``text`` / ``image_url``) become Responses blocks (``input_text`` /
    ``input_image``). A bare string passes through as a string — the API accepts both, and
    the simpler shape keeps the common case readable in a LangSmith trace.
    """
    if not isinstance(content, list):
        return content if isinstance(content, str) else _text_of(content)
    out: list[dict] = []
    for block in content:
        if not isinstance(block, dict):
            out.append({"type": "input_text", "text": str(block)})
            continue
        btype = block.get("type")
        if btype == "text":
            out.append({"type": "input_text", "text": block.get("text") or ""})
        elif btype == "image_url":
            img = block.get("image_url") or {}
            url = img.get("url") if isinstance(img, dict) else img
            item: dict[str, Any] = {"type": "input_image", "image_url": url}
            if isinstance(img, dict) and img.get("detail"):
                item["detail"] = img["detail"]
            out.append(item)
    return out or ""


def _to_responses_input(messages: list[dict]) -> list[dict]:
    """chat-completions ``messages`` -> Responses ``input`` items.

    The four cases, and the one that carries the whole tool loop:

    - ``system`` / ``developer`` -> a role message, kept INLINE rather than hoisted into
      the top-level ``instructions`` field. ⛔ Load-bearing: the agent loop MUTATES
      ``messages[0]`` mid-run (structured-tool injection, recovery prompts), and the
      system entry's POSITION relative to the rest is part of that behaviour. Hoisting it
      would silently reorder the conversation.
    - ``user`` -> a role message, images preserved.
    - ``assistant`` WITH ``tool_calls`` -> the narration text (when present) as one
      assistant message, then ONE ``function_call`` item per call, keyed by ``call_id``.
    - ``tool`` -> a ``function_call_output`` referencing that same ``call_id``.

    ⚠ Unknown and internal keys are DROPPED by construction — this builds new dicts rather
    than filtering old ones. That subsumes ``create_adaptive_streaming_chat``'s
    ``_``-prefixed marker strip (``_pinned_skill``) and the ``thought_signature`` echo (a
    Google-only field this surface has no use for).
    """
    items: list[dict] = []
    for m in messages:
        role = m.get("role")
        if role in ("system", "developer"):
            items.append({"role": "system", "content": _text_of(m.get("content"))})
        elif role == "user":
            items.append({"role": "user", "content": _user_content(m.get("content"))})
        elif role == "tool":
            items.append(
                {
                    "type": "function_call_output",
                    "call_id": m.get("tool_call_id") or "",
                    "output": _text_of(m.get("content")),
                }
            )
        elif role == "assistant":
            tool_calls = m.get("tool_calls") or []
            text = _text_of(m.get("content"))
            if text:
                items.append(
                    {
                        "role": "assistant",
                        "content": [{"type": "output_text", "text": text}],
                    }
                )
            for tc in tool_calls:
                fn = tc.get("function") or {}
                items.append(
                    {
                        "type": "function_call",
                        "call_id": tc.get("id") or "",
                        "name": fn.get("name") or "",
                        "arguments": fn.get("arguments") or "{}",
                    }
                )
            if not text and not tool_calls:
                # An empty assistant turn still occupies a position in the history.
                items.append(
                    {"role": "assistant", "content": [{"type": "output_text", "text": ""}]}
                )
    return items


def _to_responses_tools(chat_tools: list[dict] | None) -> list[dict]:
    """chat ``{"type":"function","function":{...}}`` -> Responses FLAT function tools.

    The Responses API lifts ``name`` / ``description`` / ``parameters`` to the top level of
    the tool object instead of nesting them under ``function``. A tool already in flat
    shape passes through, so this is safe to call twice.
    """
    out: list[dict] = []
    for t in chat_tools or []:
        if not isinstance(t, dict):
            continue
        fn = t.get("function")
        if isinstance(fn, dict):
            out.append(
                {
                    "type": "function",
                    "name": fn.get("name"),
                    "description": fn.get("description") or "",
                    "parameters": fn.get("parameters")
                    or {"type": "object", "properties": {}},
                }
            )
        elif t.get("type") == "function" and t.get("name"):
            out.append(t)
    return out


def _schema_is_strict_ready(schema: Any) -> bool:
    """True when a JSON schema already satisfies OpenAI's STRICT function-tool rules.

    ⛔ This check is why ``strict`` is not simply switched on. Strict mode requires
    ``additionalProperties: false`` AND every declared property listed in ``required`` — at
    every object level. A schema that violates either is rejected at REQUEST time with a
    400, which would turn a quality upgrade into a hard outage on the forced-emission path.

    So strict is requested only where it is already TRUE of the schema, and the tier
    degrades honestly to plain forcing everywhere else. ⚠ That means a model whose registry
    row reads ``emit_tier: "force_strict"`` may be served ``force`` here. That is a
    deliberate, measured downgrade — never assume the strict guarantee holds on this
    surface without reading this function.
    """
    if not isinstance(schema, dict):
        return False
    if schema.get("type") != "object":
        return True
    if schema.get("additionalProperties") is not False:
        return False
    props = schema.get("properties") or {}
    required = schema.get("required") or []
    if set(props.keys()) != set(required):
        return False
    for value in props.values():
        if isinstance(value, dict) and value.get("type") == "object":
            if not _schema_is_strict_ready(value):
                return False
    return True


# ── Streaming adapter ─────────────────────────────────────────────────────────


class _ClosableResponsesStream:
    """SYNC canonical-event stream over a raw ``responses.create(stream=True)`` stream.

    Mirrors ``openai_compat._ClosableEventStream`` deliberately, down to the ``.close``
    delegation: the consumer's ``_drain_stream_with_close_on_cancel`` drives this in a
    threadpool and calls ``close_fn`` on timeout, so the cancel path must close the SAME
    underlying httpx response it does on every other OpenAI call.
    """

    def __init__(self, raw_stream, active_provider_name: str):
        self._raw = raw_stream
        self._provider = active_provider_name
        # Parity with the compat adapter's attribute so the consumer's getattr-defaulted
        # post-drain read is uniform. A Responses stream has no DSML leak path (tool calls
        # arrive as typed items, never as markup in the text channel) — so it stays False,
        # which is the honest value here, not a stub.
        self.dsml_leaked = False
        self._gen = self._normalize()

    def __iter__(self):
        return self._gen

    def close(self):
        _close = getattr(self._raw, "close", None)
        if callable(_close):
            return _close()
        return None

    def _normalize(self) -> Generator[dict, None, None]:
        """Per-stream state lives here — one stream, one tracker."""
        # Index assignment: the consumer keys ``tool_calls_buffer`` by a DENSE 0-based
        # ordinal, so map each Responses item_id to its ARRIVAL ORDER rather than reusing
        # ``output_index`` (which also counts reasoning and message items, so it is not
        # dense over tool calls).
        _index_by_item: dict[str, int] = {}
        _call_id_by_item: dict[str, str] = {}
        _name_by_item: dict[str, str] = {}
        _args_by_item: dict[str, str] = {}
        _announced: set[int] = set()

        _emit_boundary: dict[int, int] = {}
        _emit_boundary_bytes = tool_args_progress_emit_boundary_bytes()
        _emit_tail_bytes = max(5120, _emit_boundary_bytes * 4)

        input_tokens_total: int | None = None
        output_tokens_total: int | None = None
        reasoning_tokens_total: int | None = None
        finish_reason = "stop"

        for event in self._raw:
            etype = getattr(event, "type", None)

            if etype == "response.output_text.delta":
                delta = getattr(event, "delta", "") or ""
                if delta:
                    yield {"type": "delta", "content": delta}

            elif etype in (
                "response.reasoning_summary_text.delta",
                "response.reasoning_text.delta",
            ):
                # ⭐ Reasoning becomes VISIBLE on this surface. chat.completions never
                # exposed a gpt-5 reasoning channel at all, so this is new signal — routed
                # to the same ``reasoning_delta`` event the UI already renders.
                delta = getattr(event, "delta", "") or ""
                if delta:
                    yield {"type": "reasoning_delta", "content": delta}

            elif etype == "response.output_item.added":
                item = getattr(event, "item", None)
                if getattr(item, "type", None) == "function_call":
                    item_id = getattr(item, "id", "") or ""
                    idx = _index_by_item.setdefault(item_id, len(_index_by_item))
                    # ⛔ call_id, never item.id — see the module docstring.
                    _call_id_by_item[item_id] = getattr(item, "call_id", "") or ""
                    _name_by_item[item_id] = getattr(item, "name", "") or ""
                    _args_by_item.setdefault(item_id, "")
                    if idx not in _announced:
                        _announced.add(idx)
                        yield {
                            "type": "tool_preparing",
                            "id": _call_id_by_item[item_id],
                            "name": _name_by_item[item_id],
                            "index": idx,
                        }

            elif etype == "response.function_call_arguments.delta":
                item_id = getattr(event, "item_id", "") or ""
                delta = getattr(event, "delta", "") or ""
                if item_id not in _index_by_item:
                    # Defensive: args before the item-added event. Register it so no tool
                    # call is ever dropped; the name arrives on the done event below.
                    _index_by_item[item_id] = len(_index_by_item)
                    _args_by_item.setdefault(item_id, "")
                idx = _index_by_item[item_id]
                _args_by_item[item_id] = _args_by_item.get(item_id, "") + delta
                cumulative = _args_by_item[item_id]

                # Boundary logic mirrored from ``openai_compat`` so the SSE cadence the
                # browser sees is identical across both OpenAI surfaces. A progress event
                # is yielded on EVERY args-bearing delta (the consumer's buffer must always
                # hold complete args — there is no synthetic ``tool_start``); the boundary
                # gates only the wire emit.
                total_bytes = len(cumulative.encode("utf-8"))
                new_boundary = total_bytes // _emit_boundary_bytes
                crossed = new_boundary > _emit_boundary.get(idx, 0)
                if crossed:
                    _emit_boundary[idx] = new_boundary
                tail = cumulative.encode("utf-8")[-_emit_tail_bytes:]
                yield {
                    "type": "tool_args_progress",
                    "tool_index": idx,
                    "name": _name_by_item.get(item_id, ""),
                    "args_so_far": tail.decode("utf-8", errors="ignore"),
                    "total_args_bytes_so_far": total_bytes,
                    "code_so_far": cumulative,
                    "emit_sse": crossed,
                }

            elif etype == "response.output_item.done":
                item = getattr(event, "item", None)
                if getattr(item, "type", None) == "function_call":
                    item_id = getattr(item, "id", "") or ""
                    if item_id in _index_by_item:
                        # The done event carries the AUTHORITATIVE final arguments string.
                        # Prefer it over the accumulation — a dropped delta would otherwise
                        # ship malformed JSON to the tool dispatcher.
                        final_args = getattr(item, "arguments", None)
                        if final_args is not None:
                            _args_by_item[item_id] = final_args
                        if not _name_by_item.get(item_id):
                            _name_by_item[item_id] = getattr(item, "name", "") or ""
                        if not _call_id_by_item.get(item_id):
                            _call_id_by_item[item_id] = getattr(item, "call_id", "") or ""
                        idx = _index_by_item[item_id]
                        cumulative = _args_by_item[item_id]
                        total_bytes = len(cumulative.encode("utf-8"))
                        tail = cumulative.encode("utf-8")[-_emit_tail_bytes:]
                        # Final progress yield — carries the authoritative args into the
                        # consumer's buffer. ``emit_sse`` False: the wire already saw the
                        # boundary-gated cadence and a duplicate tail adds nothing.
                        yield {
                            "type": "tool_args_progress",
                            "tool_index": idx,
                            "name": _name_by_item.get(item_id, ""),
                            "args_so_far": tail.decode("utf-8", errors="ignore"),
                            "total_args_bytes_so_far": total_bytes,
                            "code_so_far": cumulative,
                            "emit_sse": False,
                        }

            elif etype in ("response.completed", "response.incomplete"):
                response = getattr(event, "response", None)
                usage = getattr(response, "usage", None)
                if usage is not None:
                    input_tokens_total = getattr(usage, "input_tokens", 0) or 0
                    output_tokens_total = getattr(usage, "output_tokens", 0) or 0
                    details = getattr(usage, "output_tokens_details", None)
                    reasoning_tokens_total = getattr(details, "reasoning_tokens", 0) or 0
                if etype == "response.incomplete":
                    # ⚠ Name the truncation honestly. ``incomplete`` with
                    # ``max_output_tokens`` is the Responses equivalent of chat's
                    # ``finish_reason: "length"``, and the loop's truncation-recovery path
                    # keys on that exact word.
                    reason = getattr(
                        getattr(response, "incomplete_details", None), "reason", None
                    )
                    finish_reason = "length" if reason == "max_output_tokens" else "stop"
                elif _index_by_item:
                    finish_reason = "tool_calls"

            elif etype in ("response.failed", "error"):
                # ⛔ RAISE, never finish quietly. A failed response that ends the turn as
                # ``stop`` is indistinguishable from a complete answer, and a silently
                # truncated turn is the failure mode this project pays for repeatedly.
                # Raising puts it on the consumer's existing provider-error path.
                response = getattr(event, "response", None)
                err = getattr(response, "error", None) or getattr(event, "message", None)
                message = getattr(err, "message", None) or str(err or "unknown error")
                raise RuntimeError(f"OpenAI Responses stream failed: {message}")

        if input_tokens_total is not None or output_tokens_total is not None:
            yield {
                "type": "usage",
                "input_tokens": input_tokens_total or 0,
                "output_tokens": output_tokens_total or 0,
                "reasoning_tokens": reasoning_tokens_total or 0,
            }

        if finish_reason == "stop" and _index_by_item:
            # A stream that produced function calls but never reported completion still
            # ends as a tool turn — the calls are real and the loop must execute them.
            finish_reason = "tool_calls"

        yield {
            "type": "finish",
            "finish_reason": finish_reason,
            "tool_calls": [
                {
                    "id": _call_id_by_item.get(item_id, ""),
                    "name": _name_by_item.get(item_id, ""),
                    "arguments": _args_by_item.get(item_id, ""),
                }
                for item_id, _ in sorted(_index_by_item.items(), key=lambda kv: kv[1])
            ],
        }


def _build_kwargs(request: "GatewayRequest") -> dict:
    """Assemble the ``responses.create`` payload. Pure — unit-testable without a client."""
    user_settings = request.user_settings
    effective_model = (
        request.model
        or (user_settings.llm_model if user_settings else None)
        or settings.llm_model
    )
    resolved_tokens = _resolve_max_tokens(
        None,
        user_settings,
        effective_model=effective_model,
        db_max_output_cap=_resolve_db_max_output_cap(effective_model),
    )

    kwargs: dict[str, Any] = {
        "model": effective_model,
        "input": _to_responses_input(request.messages),
        "stream": True,
        "max_output_tokens": resolved_tokens,
        # ⛔ The project's stateless-chat rule expressed on this surface: we store and send
        # the history ourselves and never hold provider-side thread state. Without
        # ``store=False`` OpenAI retains the response server-side.
        "store": False,
    }

    chat_tools = request.tools if request.tools is not None else get_tools(user_settings)

    if request.force_tool_name is not None:
        forced = _to_responses_tools(chat_tools)
        if request.strict_schema:
            for tool in forced:
                if tool.get("name") == request.force_tool_name and _schema_is_strict_ready(
                    tool.get("parameters")
                ):
                    tool["strict"] = True
        kwargs["tools"] = forced
        kwargs["tool_choice"] = {"type": "function", "name": request.force_tool_name}
    elif request.tool_choice == "auto" and not request.force_no_tools:
        kwargs["tools"] = _to_responses_tools(chat_tools)
        kwargs["tool_choice"] = "auto"
        # ⭐ Restored on this surface. The structured path had no such concept — tools were
        # prose, one at a time. Kept False to match the chat path's long-standing choice so
        # the loop's one-tool-per-iteration execution semantics are unchanged.
        kwargs["parallel_tool_calls"] = False

    return kwargs


def _is_reasoning_summary_refusal(exc: Exception) -> bool:
    """True only for a 400 that names the ``reasoning`` summary parameter.

    Read from the STRUCTURED body where one exists, with a message-text fallback — the same
    shape as ``openai_service._is_no_endpoint_404``. Deliberately narrow: anything broader
    would swallow a real configuration error and retry it into a second failure.
    """
    if getattr(exc, "status_code", None) != 400:
        return False
    body = getattr(exc, "body", None)
    message = ""
    if isinstance(body, dict):
        err = body.get("error")
        if isinstance(err, dict):
            param = err.get("param") or ""
            if isinstance(param, str) and param.startswith("reasoning"):
                return True
            message = err.get("message") or ""
    if not message:
        message = str(exc)
    low = message.lower()
    return "summary" in low and "reasoning" in low


def open_openai_responses_stream(
    request: "GatewayRequest",
) -> tuple[_ClosableResponsesStream, CallingMode]:
    """Open a ``/v1/responses`` stream and return it as canonical events + NATIVE mode.

    ⚠ The reasoning-summary request is made with a NARROW one-shot fallback. Summaries are
    gated on organisation verification for some accounts, and a 400 there would take out
    tool calling — which is the whole point of this module — over a display nicety. So the
    call is retried ONCE without the ``reasoning`` field, and only when the refusal names
    it. Every other error propagates untouched.
    """
    client = get_llm_client(request.user_settings)
    kwargs = _build_kwargs(request)

    try:
        raw = client.responses.create(**kwargs, reasoning={"summary": "auto"})
    except Exception as exc:  # noqa: BLE001 — narrowed by the predicate below
        if not _is_reasoning_summary_refusal(exc):
            raise
        raw = client.responses.create(**kwargs)

    return _ClosableResponsesStream(raw, request.active_provider_name), CallingMode.NATIVE
