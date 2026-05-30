"""Phase 075.1 Plan 04 Task 1 — observability bundle tests.

Covers:
- Test 1 (B-260519-02): GET /threads/{tid}/snapshot short-circuits on
  active_runs == [] without calling Redis xinfo_stream.
- Test 2 (B-260519-02 regression): snapshot still calls xinfo_stream when at
  least one active run exists.
- Test 3 (B-260519-05): run_sub_agent emits exactly one structured info log
  line matching the documented format ("sub-agent invoked tool=...
  main_model=... sub_model=... reason=cost_default") per invocation.
- Test 4 (B-260519-05): sub_agent_record carries an "effective_model" key
  the agent loop can spread into the persisted_tool_calls entry's
  sub_agent_model field.
- Test 5 (B-260519-04 Anthropic half): stream_anthropic is wrapped with a
  langsmith @traceable decorator naming the run "ChatAnthropic".
- Test 6 (B-260519-04 provider tagging): get_llm_client passes a per-provider
  chat_name to wrap_openai (Chat{Provider.title()}) so OpenRouter / Ollama
  show up distinctly from native OpenAI in LangSmith traces.
"""
from __future__ import annotations

import asyncio
import inspect
import logging
import re
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest


# ── Tests 1 + 2: snapshot endpoint short-circuit ─────────────────────────────


@pytest.mark.asyncio
async def test_snapshot_short_circuits_on_empty_active_runs() -> None:
    """get_snapshot returns 200 + empty since_cursors WITHOUT calling Redis
    xinfo_stream when active_runs is empty (B-260519-02)."""
    from app.api import threads as threads_mod

    thread_id = uuid4()
    user_id = "u-1"

    # Supabase mock — thread owned, no messages, no active runs.
    class _Resp:
        def __init__(self, data):
            self.data = data

    def _build_supabase():
        sb = MagicMock()
        # ownership SELECT
        sb.table.return_value.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value = _Resp({"id": str(thread_id)})
        return sb

    sb = _build_supabase()

    # aexec returns whatever the underlying mock returns
    async def _aexec(q):
        # Each call walks the supabase chain — the maybe_single, select(*), etc.
        # We just return a coherent shape per call by inspecting the chain via .table call args.
        # Simpler: just return canned envelopes by call-order.
        return q

    # Patch aexec to return the right shape per call (ownership, messages,
    # active_runs).
    call_responses = [
        _Resp({"id": str(thread_id)}),  # ownership
        _Resp([]),  # messages (empty)
        _Resp([]),  # active runs (empty)
    ]
    call_idx = {"i": 0}

    async def _fake_aexec(_q):
        i = call_idx["i"]
        call_idx["i"] = i + 1
        return call_responses[i]

    redis = MagicMock()
    redis.xinfo_stream = MagicMock(side_effect=AssertionError(
        "xinfo_stream MUST NOT be called when active_runs is empty (B-260519-02)"
    ))

    with patch.object(threads_mod, "aexec", _fake_aexec), patch.object(
        threads_mod, "_enrich_messages_with_runs", lambda messages, **kw: asyncio.sleep(0, result=messages)
    ):
        result = await threads_mod.get_snapshot(
            thread_id=thread_id,
            current_user={"id": user_id},
            supabase=sb,
            redis=redis,
        )

    assert result == {
        "messages": [],
        "active_runs": [],
        "since_cursors": {},
    }
    # xinfo_stream MUST NOT have been called
    assert redis.xinfo_stream.call_count == 0


@pytest.mark.asyncio
async def test_snapshot_calls_xinfo_stream_when_active_runs_exist() -> None:
    """Regression: get_snapshot still queries Redis when an active run exists.

    Plan 04's short-circuit must NOT regress the happy path (B-260519-02
    fix is strictly additive)."""
    from app.api import threads as threads_mod

    thread_id = uuid4()
    user_id = "u-1"
    active_run = {"run_id": str(uuid4()), "started_at": "2026-05-20T00:00:00Z", "status": "streaming"}

    class _Resp:
        def __init__(self, data):
            self.data = data

    call_responses = [
        _Resp({"id": str(thread_id)}),  # ownership
        _Resp([]),  # messages
        _Resp([active_run]),  # active runs (one!)
    ]
    call_idx = {"i": 0}

    async def _fake_aexec(_q):
        i = call_idx["i"]
        call_idx["i"] = i + 1
        return call_responses[i]

    sb = MagicMock()
    redis = MagicMock()

    async def _xinfo(_key):
        return {"first-entry": ("123-0", {})}

    redis.xinfo_stream = MagicMock(side_effect=_xinfo)

    with patch.object(threads_mod, "aexec", _fake_aexec), patch.object(
        threads_mod, "_enrich_messages_with_runs", lambda messages, **kw: asyncio.sleep(0, result=messages)
    ):
        result = await threads_mod.get_snapshot(
            thread_id=thread_id,
            current_user={"id": user_id},
            supabase=sb,
            redis=redis,
        )

    assert result["active_runs"] == [active_run]
    assert result["since_cursors"] == {active_run["run_id"]: "123-0"}
    assert redis.xinfo_stream.call_count == 1


# ── Test 3: sub-agent invocation log ─────────────────────────────────────────


def test_sub_agent_logs_invocation_with_identifier_only_fields(caplog) -> None:
    """run_sub_agent emits exactly one info log per call matching the
    documented format. Identifier-only fields (D-073-04 / D-074-03) —
    no prompt content (B-260519-05)."""
    from app.services import sub_agent_service

    # Mock the OpenAI client + the stream — return one chunk + finish.
    class _DeltaObj:
        def __init__(self, content):
            self.content = content

    class _ChoiceObj:
        def __init__(self, content):
            self.delta = _DeltaObj(content)

    class _Chunk:
        def __init__(self, content):
            self.choices = [_ChoiceObj(content)]

    class _FakeClient:
        class chat:  # noqa: N801
            class completions:  # noqa: N801
                @staticmethod
                def create(**kwargs):
                    return iter([_Chunk("hello")])

    fake_user_settings = MagicMock()
    fake_user_settings.sub_agent_model = ""
    fake_user_settings.llm_model = "claude-sonnet-4-6"
    fake_user_settings.active_provider = "anthropic"

    with caplog.at_level(logging.INFO, logger="app.services.sub_agent_service"):
        with patch.object(sub_agent_service, "get_llm_client", return_value=_FakeClient()):
            chunks = list(sub_agent_service.run_sub_agent(
                document_content="...",
                document_filename="doc.txt",
                task="summarize",
                user_settings=fake_user_settings,
            ))

    assert chunks == ["hello"]

    # Find the structured invocation log
    invocation_lines = [r for r in caplog.records if "sub-agent invoked" in r.getMessage()]
    assert len(invocation_lines) == 1, f"Expected exactly 1 sub-agent invoked log, found {len(invocation_lines)}: {[r.getMessage() for r in invocation_lines]}"

    msg = invocation_lines[0].getMessage()
    # Documented format check
    assert re.match(
        r"^sub-agent invoked tool=\S+ main_model=\S+ sub_model=\S+ reason=\S+$",
        msg,
    ), f"Log line shape wrong: {msg!r}"
    # The reason for this caller is cost_default (no user override, no env override)
    assert "reason=cost_default" in msg
    # tool field is the literal "analyze_document" (current only sub-agent tool)
    assert "tool=analyze_document" in msg
    # Resolved sub_model for anthropic provider default
    assert "sub_model=claude-haiku-4-5-20251001" in msg


# ── Test 4: sub_agent_model surfaces in tool_call_result payload ──────────


def test_persisted_tool_calls_carry_sub_agent_model_when_sub_agent_record_present() -> None:
    """The sub_agent_record dict construction site MUST carry an
    'effective_model' key so the agent loop's persisted_tool_calls.append
    spread (`**({"sub_agent_model": sub_agent_record.get("effective_model")} ...)`)
    surfaces the model id to the frontend.

    This test exercises the construction-site convention: reading the
    tool_dispatcher.py source for the sub_agent_record assignment + the
    threads.py persisted_tool_calls.append site, asserting both halves of
    the contract.

    Phase 083: sub_agent_record construction moved from threads.py to
    tool_dispatcher.py during the G-5 mandated extraction."""
    from pathlib import Path

    # Phase 083: sub_agent_record construction is now in tool_dispatcher.py
    dispatcher_src = Path(__file__).parent.parent.parent / "app" / "services" / "tool_dispatcher.py"
    dispatcher_text = dispatcher_src.read_text(encoding="utf-8")

    # Phase 089-03 (G-5 verbatim move): the persisted_tool_calls.append site
    # (the agent-loop tool-dispatch round) moved from threads.py into
    # agent_loop.py::run_agent_loop — grep the spread there.
    threads_src = Path(__file__).parent.parent.parent / "app" / "services" / "agent_loop.py"
    threads_text = threads_src.read_text(encoding="utf-8")

    # Construction site must include effective_model (now in tool_dispatcher.py)
    assert re.search(
        r'sub_agent_record\s*=\s*\{[^}]*"effective_model"\s*:',
        dispatcher_text,
        re.DOTALL,
    ), (
        "sub_agent_record dict must include 'effective_model' key so the "
        "spread in persisted_tool_calls.append can read it (B-260519-05 backend payload)."
    )

    # persisted_tool_calls.append must spread sub_agent_model from the record (still in threads.py)
    assert re.search(
        r'sub_agent_model.*sub_agent_record\.get\("effective_model"',
        threads_text,
    ), (
        "persisted_tool_calls.append must spread sub_agent_model from "
        "sub_agent_record.get('effective_model', ...) (B-260519-05 frontend metadata)."
    )


# ── Test 5: Anthropic LangSmith wrap (@traceable) ────────────────────────────


def test_stream_anthropic_has_langsmith_traceable_decorator() -> None:
    """stream_anthropic must be wrapped with @traceable(name="ChatAnthropic",
    run_type="llm") so Anthropic main-loop calls appear in LangSmith with a
    distinguishable trace name (B-260519-04 first half).

    Since wrap_anthropic is NOT available in the installed langsmith version
    (verified at plan-time), Atom D's fallback path is @traceable on the
    function directly."""
    from pathlib import Path
    src = Path(__file__).parent.parent.parent / "app" / "services" / "anthropic_service.py"
    text = src.read_text(encoding="utf-8")

    # One of:
    #   1) @traceable decorator with name="ChatAnthropic"
    #   2) wrap_anthropic call (in case it becomes available later)
    has_traceable = bool(re.search(
        r'@traceable\s*\(\s*name\s*=\s*["\']ChatAnthropic["\']',
        text,
    ))
    has_wrap = "wrap_anthropic" in text
    assert has_traceable or has_wrap, (
        "stream_anthropic must be wrapped with either "
        '@traceable(name="ChatAnthropic", run_type="llm") '
        "or langsmith.wrappers.wrap_anthropic to surface Anthropic main-loop "
        "calls in LangSmith with a distinguishable trace name (B-260519-04)."
    )


# ── Test 6: per-provider chat_name passed to wrap_openai ─────────────────────


def test_get_llm_client_passes_per_provider_chat_name_to_wrap_openai() -> None:
    """get_llm_client must pass a per-provider chat_name kwarg to wrap_openai
    (e.g., Chat{Provider.title()} → ChatOpenrouter / ChatOllama / ChatOpenai)
    so OpenRouter / Ollama show up distinctly from native OpenAI in LangSmith
    traces (B-260519-04 second half)."""
    from pathlib import Path
    src = Path(__file__).parent.parent.parent / "app" / "services" / "openai_service.py"
    text = src.read_text(encoding="utf-8")

    # The wrap_openai call must include a chat_name kwarg derived from the provider
    # (e.g. `chat_name=f"Chat{provider.title()}"` or a similar per-provider construction).
    assert re.search(
        r'wrap_openai\s*\(\s*client\s*,\s*[^)]*chat_name\s*=',
        text,
        re.DOTALL,
    ), (
        "wrap_openai must be called with a per-provider chat_name kwarg so "
        "OpenRouter/Ollama appear distinctly from OpenAI in LangSmith traces "
        "(B-260519-04 provider tagging)."
    )
