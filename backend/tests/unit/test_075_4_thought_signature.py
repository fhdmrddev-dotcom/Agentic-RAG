"""Phase 075.4 Plan 02 Task 3 — Gemini-3 thought_signature coverage.

Closes BUG-260523-02 (Gemini-3 multi-tool agent flows return 400 INVALID_ARGUMENT
on the second tool round because Google's API requires the per-tool-call
``thought_signature`` be echoed back on every continuation call).

Covers (per 075.4-02-PLAN.md <behavior>):
  Test 1 (capture): _on_chunk_openai-style chunk with tc.extra_content.google.
          thought_signature populates tool_calls_buffer[idx]["thought_signature"]
          when active_provider_name == "google".
  Test 2 (gated capture): same shape but active_provider_name == "openai" →
          buffer entry MUST NOT contain "thought_signature" key.
  Test 3 (no false-positive): missing google key OR missing extra_content →
          no key set in the buffer.
  Test 4 (echo): _reconstruct_history with active_provider="google" and a
          row carrying thought_signature emits extra_content under tool_calls[0].
  Test 5 (echo gated): same row but active_provider="openai" → tool_calls[0]
          MUST NOT contain extra_content key.
  Test 6 (no-sig no-spread): active_provider="google" but no signature → no
          extra_content key in the emitted tool_calls entry.
  Test 7 (persistence): persisted_tool_calls.append shape with a tc dict that
          has thought_signature populated → resulting entry contains the key.
          Entries without the key produce list entries without the key
          (PATTERNS.md §S8 conditional-spread idiom).

The capture path is implemented as a closure inside ``send_message`` (private),
so Tests 1-3 reproduce the same conditional-shape inline against a synthetic
chunk — the load-bearing surface is the conditional behavior, not the closure's
location. The full chunk-handler is exercised end-to-end by Plan 075.4-06 E2E.
"""
from __future__ import annotations

import inspect
import json

from types import SimpleNamespace


# ── Helpers — synthesize the openai-python ChoiceDeltaToolCall shape ─────────


def _make_tc_with_extra(tc_id: str, name: str, args: str, signature: str | None):
    """Build a SimpleNamespace that mimics openai-python ChoiceDeltaToolCall.

    The real type has model_config={"extra": "allow"}, so ``extra_content``
    arrives as model_extra. For the synthetic chunk we attach ``extra_content``
    directly — the production capture path reads via
    ``getattr(tc, "extra_content", None) or (model_extra or {}).get("extra_content")``
    so either shape is acceptable.
    """
    function = SimpleNamespace(name=name, arguments=args)
    tc = SimpleNamespace(
        index=0,
        id=tc_id,
        function=function,
    )
    if signature is not None:
        tc.extra_content = {"google": {"thought_signature": signature}}
    return tc


# Production-shape extraction: mirrors the gated branch in
# backend/app/api/threads.py _on_chunk_openai (Plan 075.4-02 D-075.4-C2).
def _extract_into_buffer(tool_calls_buffer: dict, tc, active_provider_name: str) -> None:
    """Provider-gated thought_signature capture — kept in sync verbatim with the
    closure inside threads.py:send_message. Used by Tests 1-3 to exercise the
    conditional shape without standing up the full agent loop."""
    idx = tc.index
    if idx not in tool_calls_buffer:
        tool_calls_buffer[idx] = {"id": "", "name": "", "arguments": ""}
        if active_provider_name == "google":
            tool_calls_buffer[idx]["thought_signature"] = ""
    if tc.id:
        tool_calls_buffer[idx]["id"] = tc.id
    if tc.function and tc.function.name:
        tool_calls_buffer[idx]["name"] = tc.function.name
    if tc.function and tc.function.arguments:
        tool_calls_buffer[idx]["arguments"] += tc.function.arguments

    if active_provider_name == "google":
        extra = getattr(tc, "extra_content", None) or (
            getattr(tc, "model_extra", None) or {}
        ).get("extra_content")
        if extra:
            sig = (extra.get("google") or {}).get("thought_signature") or ""
            if sig:
                tool_calls_buffer[idx]["thought_signature"] = sig


# ── Test 1 + 2 + 3: chunk-shape extraction (provider-gated) ──────────────────


def test_capture_signature_when_google() -> None:
    """Test 1: active_provider_name == 'google' AND chunk carries signature →
    buffer[idx]['thought_signature'] is populated."""
    buf: dict = {}
    tc = _make_tc_with_extra(
        tc_id="call_abc123",
        name="search_documents",
        args="{\"query\":\"hello\"}",
        signature="CvcQAdHN2_signature_blob_xxxx",
    )
    _extract_into_buffer(buf, tc, active_provider_name="google")
    assert buf[0]["thought_signature"] == "CvcQAdHN2_signature_blob_xxxx"
    assert buf[0]["id"] == "call_abc123"
    assert buf[0]["name"] == "search_documents"


def test_capture_skipped_when_not_google() -> None:
    """Test 2: same chunk shape but active_provider_name == 'openai' → no
    thought_signature key set in the buffer entry."""
    buf: dict = {}
    tc = _make_tc_with_extra(
        tc_id="call_xyz789",
        name="search_documents",
        args="{}",
        signature="should_be_ignored",
    )
    _extract_into_buffer(buf, tc, active_provider_name="openai")
    assert "thought_signature" not in buf[0]


def test_capture_no_false_positive_when_extra_missing() -> None:
    """Test 3: google provider + chunk WITHOUT signature → buffer entry has
    the empty-string slot initialized but no false-positive value."""
    buf: dict = {}
    tc = _make_tc_with_extra(
        tc_id="call_no_sig",
        name="execute_code",
        args="{}",
        signature=None,
    )
    _extract_into_buffer(buf, tc, active_provider_name="google")
    # Slot initialised to "" per the closure shape (init-on-first-touch);
    # echo path filters by truthiness so the empty string never reaches the
    # _reconstruct_history extra_content emission.
    assert buf[0]["thought_signature"] == ""


def test_capture_no_false_positive_when_empty_string_signature() -> None:
    """Defensive: extra_content present but signature is empty string → slot stays empty."""
    buf: dict = {}
    function = SimpleNamespace(name="search", arguments="")
    tc = SimpleNamespace(
        index=0, id="call_empty_sig", function=function,
        extra_content={"google": {"thought_signature": ""}},
    )
    _extract_into_buffer(buf, tc, active_provider_name="google")
    assert buf[0]["thought_signature"] == ""


# ── Test 4 + 5 + 6: _reconstruct_history echo ────────────────────────────────


def test_reconstruct_history_echoes_signature_for_google() -> None:
    """Test 4: active_provider='google' + tc row carrying thought_signature →
    emitted tool_calls[0] contains extra_content with the google namespace."""
    from app.api.threads import _reconstruct_history

    rows = [
        {
            "role": "assistant",
            "content": None,
            "tool_calls": [
                {
                    "tool_call_id": "call_geminisig",
                    "name": "search_documents",
                    "args": {"query": "hello"},
                    "result": "ok",
                    "status": "done",
                    "thought_signature": "sig_abc_123",
                },
            ],
        },
    ]
    out = _reconstruct_history(rows, active_provider="google")
    # First message — assistant + tool_calls.
    assert out[0]["role"] == "assistant"
    tool_calls = out[0]["tool_calls"]
    assert len(tool_calls) == 1
    tc_out = tool_calls[0]
    assert tc_out["id"] == "call_geminisig"
    assert tc_out["function"]["name"] == "search_documents"
    assert json.loads(tc_out["function"]["arguments"]) == {"query": "hello"}
    assert tc_out["extra_content"] == {"google": {"thought_signature": "sig_abc_123"}}


def test_reconstruct_history_no_extra_content_for_openai() -> None:
    """Test 5: same row but active_provider='openai' → tool_calls[0] does NOT
    contain extra_content (other providers must stay byte-identical)."""
    from app.api.threads import _reconstruct_history

    rows = [
        {
            "role": "assistant",
            "content": None,
            "tool_calls": [
                {
                    "tool_call_id": "call_oai",
                    "name": "search_documents",
                    "args": {"query": "hello"},
                    "result": "ok",
                    "status": "done",
                    # Even if the row HAS a thought_signature (stale row from a
                    # previous google run), the openai active_provider gate must
                    # refuse to echo it — sending it to OpenAI's API would error.
                    "thought_signature": "sig_unused",
                },
            ],
        },
    ]
    out = _reconstruct_history(rows, active_provider="openai")
    tc_out = out[0]["tool_calls"][0]
    assert "extra_content" not in tc_out


def test_reconstruct_history_no_signature_no_spread() -> None:
    """Test 6: active_provider='google' but row has no thought_signature →
    tool_calls[0] does NOT contain extra_content (conditional spread skipped
    for falsy values)."""
    from app.api.threads import _reconstruct_history

    rows = [
        {
            "role": "assistant",
            "content": None,
            "tool_calls": [
                {
                    "tool_call_id": "call_nosig",
                    "name": "search_documents",
                    "args": {},
                    "result": "ok",
                    "status": "done",
                    # No thought_signature key OR empty string — both must skip.
                },
            ],
        },
    ]
    out = _reconstruct_history(rows, active_provider="google")
    tc_out = out[0]["tool_calls"][0]
    assert "extra_content" not in tc_out


def test_reconstruct_history_default_active_provider_is_back_compat() -> None:
    """Calling _reconstruct_history with the legacy 1-arg signature (no
    active_provider kwarg) keeps producing identical output for non-google
    flows — protects the 13 test_tool_memory.py cases that use the old signature."""
    from app.api.threads import _reconstruct_history

    rows = [
        {
            "role": "assistant",
            "content": None,
            "tool_calls": [
                {
                    "tool_call_id": "call_legacy",
                    "name": "search_documents",
                    "args": {"q": "x"},
                    "result": "ok",
                    "status": "done",
                },
            ],
        },
    ]
    out_legacy = _reconstruct_history(rows)  # no kwarg
    out_explicit = _reconstruct_history(rows, active_provider="")
    assert out_legacy == out_explicit
    # AND: no extra_content key in either path (active_provider default is "").
    assert "extra_content" not in out_legacy[0]["tool_calls"][0]


# ── Test 7: persisted_tool_calls conditional spread ──────────────────────────


def test_persisted_tool_calls_spread_with_signature() -> None:
    """Test 7 (with signature): persisted_tool_calls dict assembled via the
    PATTERNS.md §S8 conditional-spread shape carries thought_signature when
    the source tc dict has it populated."""
    tc = {"id": "call_sig", "thought_signature": "sig_xyz"}
    tool_name = "search"
    args = {"q": "x"}
    persisted_result = "ok"
    sub_agent_record = None

    entry = {
        "tool_call_id": tc["id"],
        "name": tool_name,
        "args": args,
        "result": persisted_result,
        "status": "done",
        **({"sub_agent": sub_agent_record} if sub_agent_record else {}),
        **(
            {"sub_agent_model": sub_agent_record.get("effective_model", "")}
            if sub_agent_record else {}
        ),
        **({"thought_signature": tc.get("thought_signature")} if tc.get("thought_signature") else {}),
    }
    assert entry["thought_signature"] == "sig_xyz"
    # And the sub_agent / sub_agent_model keys MUST NOT be present when None.
    assert "sub_agent" not in entry
    assert "sub_agent_model" not in entry


def test_persisted_tool_calls_spread_without_signature() -> None:
    """Test 7 (no signature): tc dict without thought_signature → resulting
    entry does NOT contain the key (conditional spread skipped — preserves
    backward compat on OpenAI / Anthropic / OpenRouter flows)."""
    tc = {"id": "call_no_sig"}  # no thought_signature key
    tool_name = "search"
    args = {}
    persisted_result = "ok"

    entry = {
        "tool_call_id": tc["id"],
        "name": tool_name,
        "args": args,
        "result": persisted_result,
        "status": "done",
        **({"thought_signature": tc.get("thought_signature")} if tc.get("thought_signature") else {}),
    }
    assert "thought_signature" not in entry


def test_persisted_tool_calls_empty_signature_skipped() -> None:
    """Empty-string signature is falsy and gets skipped by the conditional
    spread — protects against the closure-init slot leaking through if the
    chunk never carried a signature."""
    tc = {"id": "call_empty", "thought_signature": ""}
    entry = {
        "tool_call_id": tc["id"],
        "status": "done",
        **({"thought_signature": tc.get("thought_signature")} if tc.get("thought_signature") else {}),
    }
    assert "thought_signature" not in entry


# ── Audit: signature surface in threads.py is wired through all 3 stages ─────


def test_threads_module_has_thought_signature_in_three_stages() -> None:
    """The capture, echo, and persistence sites all reference thought_signature."""
    from app.api import threads as threads_mod

    src = inspect.getsource(threads_mod)
    # Capture in _on_chunk_openai (provider-gated google branch).
    assert "thought_signature" in src
    # Echo in _reconstruct_history (provider-gated google branch).
    assert "extra_content" in src
    # Persistence in persisted_tool_calls (conditional spread).
    assert "tc.get(\"thought_signature\")" in src
    # _reconstruct_history signature carries active_provider
    assert "_reconstruct_history" in src
    assert "active_provider:" in src or "active_provider =" in src or "active_provider," in src
