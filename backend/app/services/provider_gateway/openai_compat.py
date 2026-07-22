"""OpenAI-compat provider-gateway adapter (Phase 092.5 Wave 4, GATEWAY-01 / D-04).

🔴 HIGH-RISK — this is the ONE genuinely entangled unit (D-04). It is the surface
that re-opened the 075.x cross-provider cascade. Extracted VERBATIM from
``agent_loop.py``'s OpenAI/OpenRouter/Ollama ``else``-branch (``:1577-1894`` in the
pre-extraction loop) + ``_on_chunk_openai`` (``:1682-1844``) + the pure helper
``_accumulate_chunk_usage`` (``:688-730``). NO "while-I'm-in-here" cleanup — a
careless edit re-opens the cascade (agent_loop.py module docstring warns this).

WHAT MOVES IN (verbatim → EMITTED as canonical events):
  - the ``<think>`` state machine (provider-gated moonshot/deepseek/minimax/zhipu)
    → EMITS ``delta`` (visible) + ``reasoning_delta`` (reasoning); the gating set is
    kept EXACT (BUG-260526-02 / D-06).
  - ``reasoning_content`` (DeepSeek separate field) → EMITS ``reasoning_delta``.
  - ``_accumulate_chunk_usage`` (provider-aware: Google-cumulative-overwrite vs
    OpenAI-``+=``) → the adapter accumulates PER-STREAM totals then EMITS a single
    ``usage`` event (the consumer SUMs it across iterations, byte-identical to the
    pre-extraction per-chunk nonlocal accumulation for the OpenAI-path ``+=`` case).
    BOTH branches of the fn are kept byte-for-byte even though this is the OpenAI
    path — the I8 unit test exercises both, and re-deriving the Google branch would
    2-3× over-count Google billing.
  - native ``delta.tool_calls`` → EMITS ``tool_preparing`` (id+name+index, when name
    first known) + ``tool_args_progress`` (per args-bearing delta, carrying the full
    cumulative ``code_so_far``). NO synthetic ``tool_start`` (Open Q2 — it would add
    a skeleton token the OpenAI native path lacks). The consumer builds
    ``tool_calls_buffer`` from ``tool_preparing`` + ``tool_args_progress``.
  - the per-provider 5KB ``tool_args_progress`` boundary dicts (OpenAI-native vs
    OpenRouter INDEPENDENT — L-4 / 075.6 SPEC). The boundary gates the SSE-emit
    cadence ONLY (carried as ``emit_sse`` on the event); the buffer-update always
    fires so sub-boundary tool args are never lost. ``emit_sse`` is additive — the
    Anthropic/Google adapters omit it and the consumer defaults it True (their
    boundary walk is already internal, so they only yield on boundary).
  - ``normalize_finish_reason`` — canonicalize finish_reason before emitting
    ``finish``.

WHAT STAYS CONSUMER-SIDE (NOT here — they mutate consumer accumulators):
  - STRUCTURED ``messages`` injection (pre + fallback) — L-1.
  - ``parse_structured_tool_calls(full_content)`` post-parse — L-3 (reads the
    consumer's ``full_content`` AFTER the drain). The adapter SURFACES ``calling_mode``
    so the consumer knows to run it (Pitfall 3 — dropping calling_mode is the exact
    bug that made the harness OpenAI-only).
  - provider-error retry (``except APIError``) + TPM 429 msg append — L-5.

Sync-generator boundary (byte-identical RED LINE): ``create_adaptive_streaming_chat``
returns a SYNC ``Stream`` (``client.chat.completions.create(stream=True)``). This
adapter returns a SYNC generator that wraps it and yields canonical event dicts —
mirroring ``stream_anthropic`` / ``stream_google`` (which the anthropic/google
adapters pass through bare). The consumer's ``_drain_stream_with_close_on_cancel``
drives it with ``for chunk in stream:`` in a threadpool and closes it via
``close_fn=stream.close`` on timeout — BYTE-IDENTICAL to the pre-extraction drain.
The adapter exposes a ``.close`` that delegates to the raw stream's ``.close`` so
``close_fn=stream.close`` binds to the SAME underlying close.

SC#3 — NO IMPORT CYCLE: imports only from ``openai_service`` / ``user_settings``
model (BELOW the gateway in the dep graph) + the dispatcher's ``GatewayRequest``.
NEVER imports ``agent_loop`` / ``threads.py``.

``create_adaptive_streaming_chat`` is imported into THIS module's namespace so the
seam + ~30 integration tests patch it HERE
(``app.services.provider_gateway.openai_compat.create_adaptive_streaming_chat``) —
the monkeypatch-target repoint off ``app.services.agent_loop.create_adaptive_streaming_chat``
(Task 3).
"""
from __future__ import annotations

from typing import TYPE_CHECKING, Generator

# The raw-SDK boundary this adapter WRAPS (does not reimplement). Imported into
# this namespace so the seam + integration tests patch it HERE (Task 3 repoint).
from app.services.openai_service import (
    CallingMode,
    create_adaptive_streaming_chat,
    get_tools,
    normalize_finish_reason,
)

# Narrow runtime import (mirrors agent_loop.py:1637) — avoids module-load-time
# cycle; the boundary-bytes config read MOVES IN with the boundary dicts.
from app.models.user_settings import tool_args_progress_emit_boundary_bytes

if TYPE_CHECKING:  # pragma: no cover
    from .dispatcher import GatewayRequest


def _accumulate_chunk_usage(
    chunk,
    provider: str,
    input_total: int | None,
    output_total: int | None,
) -> tuple[int | None, int | None]:
    """Provider-aware usage accumulator for OpenAI-compat streaming chunks.

    Phase 075.3 D-075.3-03 + D-075.3-01-probe-locked (2026-05-22, verdict =
    CUMULATIVE, pinned in 075.3-01-PLAN.md ``<probe_result>``).

    - **Google** (OpenAI-compat) emits ``chunk.usage`` with **cumulative
      running totals** on every chunk (alongside ``delta.content`` /
      ``delta.tool_calls``). The Google branch **overwrites** the running
      total each chunk (last-wins). Summing via ``+=`` would over-count
      by 2-3× (silent billing-accounting corruption).
    - **OpenAI** emits ``chunk.usage`` only on the final chunk with empty
      ``choices=[]`` (Phase 073 D-073-08). The OpenAI branch sums via
      ``+=`` (initialised from None on first usage chunk).
    - **OpenRouter** is forward-compatible per Pitfall 8 (deprecation 2026
      — always returns usage now). Same ``+=`` branch — if a stray
      mid-stream usage chunk ever appears alongside the final emission,
      the sum is correct.
    - Unknown / ollama / empty / anthropic-via-compat / made-up provider
      names fall through to ``+=`` (safe default matching OpenAI shape).

    Pure function: no I/O, no closure capture. Trivially unit-testable;
    see ``backend/tests/unit/test_chunk_handler_provider_aware.py``.

    VERBATIM MOVE from agent_loop.py:688-730 (Phase 092.5 Wave 4 / D-04). BOTH
    branches kept byte-for-byte even though this module is the OpenAI path — the
    unit test exercises both; re-deriving the Google branch would 2-3× over-count
    Google billing.
    """
    u = getattr(chunk, "usage", None)
    if u is None:
        return input_total, output_total
    _i = getattr(u, "prompt_tokens", 0) or 0
    _o = getattr(u, "completion_tokens", 0) or 0
    if provider == "google":
        # D-075.3-01 probe-locked: cumulative running totals → overwrite-last-wins.
        # Re-flip to the ``+=`` branch ONLY if the probe verdict in
        # 075.3-01-PLAN.md <probe_result> changes to DELTA on a future re-run.
        return _i, _o
    # OpenAI / OpenRouter / Ollama / Anthropic-via-compat / unknown → += sum.
    if input_total is None:
        return _i, _o
    return input_total + _i, (output_total or 0) + _o


# The char DeepSeek uses in its native tool-call markup is the fullwidth vertical
# bar U+FF5C (｜), NOT the ASCII pipe (this file is UTF-8). The opener below begins
# a "<｜｜DSML｜｜tool_calls>" block that DeepSeek can leak into visible content.
_DSML_OPENER = "<｜｜DSML｜｜"


def _strip_deepseek_tool_markup(
    text: str, pending: str, leaking: bool
) -> tuple[str, str, bool]:
    """Suppress DeepSeek native tool-call markup that leaked into VISIBLE content.

    DeepSeek sometimes emits a tool call as plain text using its
    ``<｜｜DSML｜｜tool_calls>…`` markup instead of the structured ``tool_calls``
    delta (observed on long tool-chains — thread 5a86a9fd, 2026-07-08, where ~16 KB
    of raw markup rendered in the chat). Our normalizer treats ``delta.content`` as
    visible assistant text, so the markup leaked verbatim. Once the opener appears we
    drop everything from it onward; any prose BEFORE it is preserved untouched.

    This ONLY stops the dirty content — it does NOT re-parse the markup into a real
    tool call, so the leaked tool does not execute (re-parse is a tracked follow-up).
    Provider-scoped: the caller invokes this for ``deepseek`` only, so every other
    provider's visible content stays byte-identical.

    Returns ``(visible_out, new_pending, new_leaking)``. ``pending`` carries a short
    trailing fragment that could be the opener split across streaming chunks.
    Pure/side-effect-free — see ``test_openai_compat_dsml_strip.py``.
    """
    if leaking:
        return "", "", True
    buf = pending + text
    idx = buf.find(_DSML_OPENER)
    if idx != -1:
        return buf[:idx], "", True
    # No full opener yet — hold back the longest tail that is a prefix of the opener
    # (it may arrive split across chunks). Everything before that tail is emitted.
    max_tail = min(len(_DSML_OPENER) - 1, len(buf))
    for k in range(max_tail, 0, -1):
        if _DSML_OPENER.startswith(buf[-k:]):
            return buf[:-k], buf[-k:], False
    return buf, "", False


class _ClosableEventStream:
    """A SYNC iterator of canonical ``GatewayEvent`` dicts wrapping the raw OpenAI
    ``Stream``, with a ``.close`` that delegates to the underlying stream.

    Mirrors the bare ``stream_anthropic`` / ``stream_google`` generators (the
    anthropic/google adapters pass those through verbatim) so the consumer's
    ``_drain_stream_with_close_on_cancel`` drives + closes this byte-identically:
    ``for chunk in stream:`` in a threadpool + ``close_fn=stream.close`` on timeout.
    The ``.close`` delegates to the raw ``Stream.close`` (openai 2.x sync,
    idempotent) so the cancel path closes the SAME underlying httpx response it
    does today.
    """

    def __init__(self, raw_stream, active_provider_name: str, calling_mode: CallingMode):
        self._raw = raw_stream
        self._provider = active_provider_name
        self._calling_mode = calling_mode
        self._gen = self._normalize()

    def __iter__(self):
        return self._gen

    def close(self):
        # Delegate to the raw SDK stream's sync, idempotent close (openai 2.x
        # Stream.close() closes the underlying httpx response). Same binding the
        # pre-extraction loop used (close_fn=stream.close). Defensive: a fake
        # stream in tests may lack .close — no-op then.
        _close = getattr(self._raw, "close", None)
        if callable(_close):
            return _close()
        return None

    def _normalize(self) -> Generator[dict, None, None]:
        """The verbatim ``_on_chunk_openai`` body (agent_loop.py:1682-1844) turned
        into a per-chunk EMITTER. Per-stream state (``_in_think_block``, the two
        boundary dicts, the token totals) lives here (one stream = one tracker)."""
        active_provider_name = self._provider
        calling_mode = self._calling_mode

        # Per-stream usage totals — accumulated via _accumulate_chunk_usage exactly
        # as the pre-extraction per-chunk nonlocal accumulation did, then emitted as
        # ONE 'usage' event at stream end so the consumer SUMs across iterations.
        input_tokens_total: int | None = None
        output_tokens_total: int | None = None

        # BUG-260526-02: Kimi/Moonshot <think> tag state machine — adapter-local
        # stream state (one stream = one think-block tracker).
        _in_think_block: bool = False
        # DeepSeek native tool-call markup can leak into the VISIBLE content channel
        # on long tool-chains (thread 5a86a9fd, 2026-07-08). Per-stream state for
        # suppressing it — see _strip_deepseek_tool_markup. deepseek-only; inert
        # for every other provider (the caller gates on active_provider_name).
        _dsml_leaking: bool = False
        _dsml_pending: str = ""
        _announced_tools: set[int] = set()
        # Phase 075.6 Plan 01 / Req #3 / RESEARCH L1 / L-4: OpenAI-native and
        # OpenRouter share this normalizer (both go through the OpenAI Python SDK
        # with different base_url) but MUST maintain INDEPENDENT 5KB-boundary state
        # per 075.6 SPEC §Constraints. A dedicated OpenRouter service module does
        # NOT exist — independence is achieved via per-provider boundary dicts
        # branched on active_provider_name.
        _emit_boundary_openai_native: dict[int, int] = {}
        _emit_boundary_openrouter: dict[int, int] = {}
        # Phase 075.10: config-backed boundary (default 256). Resolved ONCE per
        # stream so the per-chunk path reads a local int. Defensive fallback to
        # pre-075.10 5120 lives in the helper. Tail slice widens proportionally.
        _emit_boundary_bytes = tool_args_progress_emit_boundary_bytes()
        _emit_tail_bytes = max(5120, _emit_boundary_bytes * 4)

        # Per-stream tool-arg accumulator (the adapter sees every chunk; it builds
        # the cumulative args internally to compute the boundary + carry the full
        # code_so_far — it does NOT need the consumer's tool_calls_buffer, L-4).
        _tool_args: dict[int, dict] = {}

        for chunk in self._raw:
            # Phase 075.3 D-075.3-03 + D-075.3-04: defensive provider-aware
            # accumulator. Google emits ``usage`` on EVERY chunk alongside
            # ``delta.content`` / ``delta.tool_calls``. OpenAI/OpenRouter/
            # Anthropic-via-compat emit ``usage`` only on the final ``choices=[]``
            # chunk. Branch inside ``_accumulate_chunk_usage``; DO NOT early-return
            # on ``chunk.usage`` — chunks with both ``usage`` and ``delta.content``
            # must flow through to delta processing below (Google's shape).
            input_tokens_total, output_tokens_total = _accumulate_chunk_usage(
                chunk,
                active_provider_name,
                input_tokens_total,
                output_tokens_total,
            )
            if not chunk.choices:
                continue
            choice = chunk.choices[0]
            delta = choice.delta

            if choice.finish_reason:
                _finish_reason = normalize_finish_reason(choice.finish_reason)
            else:
                _finish_reason = None

            if delta.content:
                _content = delta.content
                # BUG-260526-02 (D-06): Kimi/Moonshot thinking content filter.
                # Kimi wraps chain-of-thought reasoning inside <think>...</think>
                # tags in delta.content (unlike DeepSeek which uses a separate
                # reasoning_content field). Strip thinking tags from visible
                # content and route to reasoning instead. DeepSeek included for
                # defense-in-depth. minimax + zhipu added 2026-05-30 (MiniMax M2
                # emits <think> inline by default; GLM-4.6+ can too). No-op when
                # the provider instead uses a separate reasoning_content field.
                if active_provider_name in ("moonshot", "deepseek", "minimax", "zhipu"):
                    _visible = ""
                    _reasoning = ""
                    _remaining = _content
                    while _remaining:
                        if _in_think_block:
                            end_idx = _remaining.find("</think>")
                            if end_idx != -1:
                                _reasoning += _remaining[:end_idx]
                                _remaining = _remaining[end_idx + len("</think>"):]
                                _in_think_block = False
                            else:
                                _reasoning += _remaining
                                _remaining = ""
                        else:
                            start_idx = _remaining.find("<think>")
                            if start_idx != -1:
                                _visible += _remaining[:start_idx]
                                _remaining = _remaining[start_idx + len("<think>"):]
                                _in_think_block = True
                            else:
                                _visible += _remaining
                                _remaining = ""
                    if _reasoning:
                        yield {"type": "reasoning_delta", "content": _reasoning}
                    # DeepSeek-only: suppress native tool-call markup that leaked
                    # into the visible channel (never re-render a raw <｜｜DSML｜｜…>
                    # block). No-op for moonshot/minimax/zhipu — their markup differs
                    # and this opener will simply never match.
                    if active_provider_name == "deepseek":
                        _visible, _dsml_pending, _dsml_leaking = (
                            _strip_deepseek_tool_markup(
                                _visible, _dsml_pending, _dsml_leaking
                            )
                        )
                    if _visible:
                        yield {"type": "delta", "content": _visible}
                else:
                    yield {"type": "delta", "content": _content}

            # DeepSeek thinking mode: accumulate reasoning_content + emit SSE
            _rc = getattr(delta, "reasoning_content", None)
            if _rc:
                yield {"type": "reasoning_delta", "content": _rc}

            if delta.tool_calls:
                for tc in delta.tool_calls:
                    idx = tc.index
                    if idx not in _tool_args:
                        _tool_args[idx] = {"id": "", "name": "", "arguments": ""}
                    if tc.id:
                        _tool_args[idx]["id"] = tc.id
                    if tc.function and tc.function.name:
                        _tool_args[idx]["name"] = tc.function.name
                        # D-01 (Phase 56.1): emit tool_preparing as soon as name is
                        # known, before arguments finish streaming. Fires exactly
                        # once per tool index. Carries id+name+index so the consumer
                        # can build tool_calls_buffer (the SSE _emit drops id — wire
                        # byte-identical).
                        if idx not in _announced_tools:
                            _announced_tools.add(idx)
                            yield {
                                "type": "tool_preparing",
                                "id": _tool_args[idx]["id"],
                                "name": tc.function.name,
                                "index": idx,
                            }
                    # Phase 075.5 D-075.5-03: the OpenAI-compat
                    # extra_content.google.thought_signature capture is REMOVED.
                    # Google goes through the native SDK path — this branch only
                    # handles OpenAI / OpenRouter / Ollama (no thought_signature).
                    if tc.function and tc.function.arguments:
                        _tool_args[idx]["arguments"] += tc.function.arguments
                        # Phase 075 D-075-09/10/11: emit tool_args_progress on every
                        # 5KB cumulative-byte boundary. STRUCTURED mode is still
                        # skipped (args arrive at finish_reason parse time, not
                        # progressively). Phase 075.6 Plan 01 / Req #2: the prior
                        # execute_code-tool-name skip filter is REMOVED.
                        _tool_name = _tool_args[idx]["name"]
                        if _tool_name and calling_mode != CallingMode.STRUCTURED:
                            # Phase 075.6 Plan 01 / Req #3 / L-4: per-provider
                            # boundary dict so OpenRouter cadence cannot be polluted
                            # by OpenAI native boundary state and vice versa.
                            _emit_boundary = (
                                _emit_boundary_openrouter
                                if active_provider_name == "openrouter"
                                else _emit_boundary_openai_native
                            )
                            _bytes_total = len(
                                _tool_args[idx]["arguments"].encode("utf-8")
                            )
                            # Phase 075.10: config-backed boundary (default 256).
                            _new_boundary = _bytes_total // _emit_boundary_bytes
                            _last_boundary = _emit_boundary.get(idx, 0)
                            _crossed = _new_boundary > _last_boundary
                            if _crossed:
                                _emit_boundary[idx] = _new_boundary
                            # D-075-09 + Phase 075.10: args_so_far is the LAST
                            # _emit_tail_bytes of the cumulative accumulator
                            # (sliding-window tail). UTF-8-aware byte slice + decode
                            # errors="ignore" drops any invalid trailing codepoint.
                            _tail_bytes = _tool_args[idx]["arguments"].encode("utf-8")[-_emit_tail_bytes:]
                            _args_so_far = _tail_bytes.decode("utf-8", errors="ignore")
                            # Open Q2 / L-4: yield a tool_args_progress on EVERY
                            # args-bearing delta so the consumer's buffer always
                            # holds the complete cumulative args (sub-boundary tools
                            # are never lost — there is NO synthetic tool_start). The
                            # 5KB boundary gates ONLY the SSE _emit (emit_sse) — the
                            # wire cadence stays byte-identical to the pre-extraction
                            # boundary-gated emit. emit_sse is additive; the
                            # anthropic/google adapters omit it and the consumer
                            # defaults it True.
                            yield {
                                "type": "tool_args_progress",
                                "tool_index": idx,
                                "name": _tool_name,
                                "args_so_far": _args_so_far,
                                "total_args_bytes_so_far": _bytes_total,
                                # Phase 075.6 Plan 01 / Req #1: full cumulative
                                # concatenated args (not the 5 KB tail) — additive.
                                "code_so_far": _tool_args[idx]["arguments"],
                                "emit_sse": _crossed,
                            }

            # finish event — canonical terminal carrier (SSE-silent in the consumer;
            # carries finish_reason + the complete tool_calls so the consumer's
            # finish branch can finalize / hydrate). For the OpenAI path tool_calls
            # carry no thought_signature (native SDK Google path owns that).
            if _finish_reason is not None:
                _fin_tcs = [
                    {
                        "id": _tool_args[i]["id"],
                        "name": _tool_args[i]["name"],
                        "arguments": _tool_args[i]["arguments"],
                    }
                    for i in sorted(_tool_args)
                ]
                yield {
                    "type": "finish",
                    "finish_reason": _finish_reason,
                    "tool_calls": _fin_tcs,
                }

        # Stream-end DSML flush (XPROV-02a / Phase 175). The deepseek strip holds a
        # short trailing fragment in _dsml_pending when a chunk ends in a partial
        # OPENER prefix (it may be the opener split across chunks). If the stream ends
        # while that fragment is still held AND we are NOT leaking, the fragment is
        # real content — flush it as a final delta so a deepseek turn ending mid-prefix
        # doesn't silently swallow it. Reachable ONLY on the deepseek path (only the
        # deepseek-gated strip populates _dsml_pending) → every other provider is
        # byte-identical. If we ARE leaking at stream end, flush nothing (the markup
        # stays suppressed — the SC#2 no-dirty-render floor holds).
        if _dsml_pending and not _dsml_leaking:
            yield {"type": "delta", "content": _dsml_pending}

        # Stream end — emit the accumulated usage so the consumer SUMs it across
        # iterations (byte-identical to the pre-extraction per-chunk += for the
        # OpenAI-path providers). Only emit when a usage payload was seen.
        if input_tokens_total is not None or output_tokens_total is not None:
            yield {
                "type": "usage",
                "input_tokens": input_tokens_total or 0,
                "output_tokens": output_tokens_total or 0,
            }


def open_openai_compat_stream(
    request: "GatewayRequest",
) -> tuple[_ClosableEventStream, CallingMode]:
    """Wrap ``create_adaptive_streaming_chat`` and SURFACE ``calling_mode``.

    The body is the stream-construction lifted from agent_loop.py:1579-1585
    VERBATIM. Returns a SYNC canonical-event stream + the ``calling_mode`` the
    consumer needs post-drain (Pitfall 3 — dropping it makes the harness
    OpenAI-only). The STRUCTURED ``messages`` injection (L-1) + the
    ``parse_structured_tool_calls`` post-parse (L-3) STAY consumer-side.
    """
    # Phase 101.1 (D-05 — TIER-FORCE): translate the gateway forcing decision into the
    # OpenAI-compat request. ADDITIVE — when ``force_tool_name`` is None the auto path
    # is byte-identical (force_tool_name=None / strict_response_format=False are the
    # constructor defaults). Self-contained at this adapter; the shared chunk handler
    # (``_ClosableEventStream._normalize``) is NOT branched (the D-14 RED LINE).
    stream, calling_mode = create_adaptive_streaming_chat(
        messages=request.messages,
        model=request.model,
        user_settings=request.user_settings,
        tool_choice=request.tool_choice,
        tools_override=request.tools,
        force_tool_name=request.force_tool_name,
        strict_response_format=request.strict_schema,
    )
    return (
        _ClosableEventStream(stream, request.active_provider_name, calling_mode),
        calling_mode,
    )
