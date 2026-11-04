"""Phase 306-03 (D-26 / D-02 fail-closed gate) — what an outside run OFFERS, on the wire, per provider.

Drives the REAL ``agent_loop.run_agent_loop`` through the REAL gateway (``provider_gateway.open_stream``
and each adapter) inside ``outside_run_context(ASK_TOOL_ALLOWLIST)``, and captures what reaches the
provider SDK boundary:

  · OpenAI-compatible (native tools) — the ``tools`` kwarg the OpenAI client's ``create`` receives;
  · Anthropic — the ``tools`` handed to ``stream_anthropic``;
  · Google — the ``tools`` handed to ``stream_google``;
  · STRUCTURED (``native_tools=False``, an OpenRouter row on the ``xml`` tool strategy, which is
    what routes it STRUCTURED) — no ``tools`` kwarg; the tool list is prose in the system message,
    so the offered set is read from that prose.

Each branch must offer EXACTLY the allow-list. If any branch cannot, ``ask_agent`` does not ship
(D-02). A run outside the context offers the full list on the same branch (non-vacuity), and the
two process caches (``tool_parser._KNOWN_TOOLS``, ``context_window._TOOL_SCHEMA_TOKENS``) are the
same after an outside run as before it (Pitfall 1).
"""
from __future__ import annotations

import asyncio
import re
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.config import MODEL_CAPABILITIES
from app.models.message import MessageCreate
from app.services import agent_loop as _loop_mod
from app.services import context_window, tool_parser
from app.services.agent_loop import RunContext
from app.services.openai_service import get_tools
from app.services.outside_run_scope import ASK_TOOL_ALLOWLIST, outside_run_context

ANSWER = "The policy allows remote work two days a week."


def _model_for(provider: str, *, native: bool) -> str:
    for model_id, cap in MODEL_CAPABILITIES.items():
        if cap.get("provider") == provider and bool(cap.get("native_tools")) is native and not cap.get("api_surface"):
            return model_id
    raise AssertionError(f"no registry model for {provider} native={native}")


BRANCHES = {
    "openai": ("openai", _model_for("openai", native=True)),
    "anthropic": ("anthropic", _model_for("anthropic", native=True)),
    "google": ("google", _model_for("google", native=True)),
    "structured": ("openrouter", _model_for("openrouter", native=False)),
}


def _settings(provider: str, model: str) -> SimpleNamespace:
    return SimpleNamespace(
        web_search_enabled=True,
        sandbox_enabled=True,
        self_improve_enabled=True,
        llm_model=model,
        active_provider=provider,
        embedding_model="text-embedding-3-small",
        llm_api_key="test-key",
        # OpenRouter's STRUCTURED route: tools as prose in the system prompt, no native param.
        openrouter_tool_strategy="xml" if provider == "openrouter" else "quality",
    )


class _Stream:
    def __init__(self, events):
        self._events = list(events)

    def __iter__(self):
        return iter(self._events)

    def close(self):
        pass


class _Query:
    def __init__(self, table: str):
        self.table = table

    def __getattr__(self, _name):
        return lambda *a, **k: self


def _openai_chunk(content=None, finish_reason=None):
    delta = SimpleNamespace(content=content, reasoning_content=None, tool_calls=None)
    return SimpleNamespace(choices=[SimpleNamespace(delta=delta, finish_reason=finish_reason)], usage=None)


_CANONICAL = [{"type": "delta", "content": ANSWER}, {"type": "finish", "finish_reason": "stop"}]
_STRUCT_LINE = re.compile(r"^- \*\*([A-Za-z0-9_]+)\*\*: ", re.MULTILINE)


async def _drive(branch: str) -> dict:
    """One real run on ``branch``; returns what the provider SDK boundary received."""
    provider, model = BRANCHES[branch]
    user_settings = _settings(provider, model)
    tables = {"threads": {"folder_id": None}, "messages": [], "skills": [], "user_memory": []}

    async def _fake_aexec(q):
        return SimpleNamespace(data=tables.get(getattr(q, "table", None)))

    supabase = MagicMock()
    supabase.table.side_effect = _Query
    captured: dict = {}

    def _fake_stream_anthropic(**kwargs):
        captured.setdefault("calls", []).append({"tools": kwargs.get("tools"), "system": kwargs.get("system_prompt")})
        return _Stream(_CANONICAL)

    def _fake_stream_google(**kwargs):
        captured.setdefault("calls", []).append({"tools": kwargs.get("tools"), "system": kwargs.get("system_prompt")})
        return _Stream(_CANONICAL)

    class _Completions:
        def create(self, **kwargs):
            system = next((m.get("content") for m in kwargs.get("messages", []) if m.get("role") == "system"), "")
            captured.setdefault("calls", []).append({"tools": kwargs.get("tools"), "system": system})
            return iter([_openai_chunk(content=ANSWER), _openai_chunk(finish_reason="stop")])

    class _Client:
        chat = SimpleNamespace(completions=_Completions())

    cap = dict(MODEL_CAPABILITIES[model])
    body = MessageCreate(content="What is the remote work policy?", agent_mode="default")
    ctx = RunContext(
        run_id=uuid4(),
        thread_id=str(uuid4()),
        current_user={"id": str(uuid4()), "org_id": str(uuid4())},
        user_settings=user_settings,
        body=body,
        redis=MagicMock(),
        supabase=supabase,
        resolved_model=model,
        resolved_provider=provider,
    )

    def _no_embed(*_a, **_k):
        raise RuntimeError("no embedding in unit tests")

    with patch.object(_loop_mod, "aexec", _fake_aexec), \
         patch.object(_loop_mod, "get_pg_pool", AsyncMock(return_value=MagicMock())), \
         patch.object(_loop_mod, "resolve_skill_catalog_budget", lambda _s: 0), \
         patch.object(_loop_mod, "embed_texts", _no_embed), \
         patch.object(_loop_mod, "insert_assistant_message", AsyncMock(return_value=uuid4())), \
         patch.object(_loop_mod, "get_per_call_timeout_async", AsyncMock(return_value=30)), \
         patch.object(_loop_mod, "get_model_capability_async", AsyncMock(return_value=cap)), \
         patch("app.services.provider_gateway.anthropic.stream_anthropic", _fake_stream_anthropic), \
         patch("app.services.provider_gateway.google.stream_google", _fake_stream_google), \
         patch("app.services.openai_service.get_llm_client", lambda *a, **k: _Client()), \
         patch("app.services.connector_service.list_connections", AsyncMock(return_value=[])), \
         patch("app.db.workspace.list_files_in_thread", AsyncMock(return_value=[])), \
         patch("app.services.suggestion_service.generate_suggestions", return_value=([], None)):
        result = await _loop_mod.run_agent_loop(ctx, emit=AsyncMock(), emit_terminal=AsyncMock(), spawn=MagicMock())
        await result.persist()

    assert captured.get("calls"), f"{branch}: the provider SDK boundary was never reached"
    return captured["calls"][0]


def _offered(branch: str, call: dict) -> set[str]:
    if branch == "structured":
        assert call["tools"] is None, "the STRUCTURED branch must carry no native tools param"
        return set(_STRUCT_LINE.findall(call["system"] or ""))
    assert call["tools"] is not None
    return {t["function"]["name"] for t in call["tools"]}


async def _outside(branch: str) -> dict:
    return await asyncio.create_task(_drive(branch), context=outside_run_context(ASK_TOOL_ALLOWLIST))


@pytest.fixture
def warm_caches():
    """Warm both process caches the way the first in-app run of a worker does, and snapshot them."""
    tool_parser._get_known_tools()
    context_window._tool_schema_tokens()
    before = (set(tool_parser._KNOWN_TOOLS or ()), context_window._TOOL_SCHEMA_TOKENS)
    yield before
    after = (set(tool_parser._KNOWN_TOOLS or ()), context_window._TOOL_SCHEMA_TOKENS)
    assert after == before, "an outside run changed a process-wide tool cache (Pitfall 1)"


@pytest.mark.asyncio
@pytest.mark.parametrize("branch", list(BRANCHES))
async def test_an_outside_run_offers_exactly_the_allowlist(branch, warm_caches):
    call = await _outside(branch)
    offered = _offered(branch, call)
    assert offered == set(ASK_TOOL_ALLOWLIST), (
        f"{branch} ({BRANCHES[branch][1]}) offered {sorted(offered)}"
    )
    assert not [n for n in offered if "__" in n], "no connector schema on an ask"


@pytest.mark.asyncio
@pytest.mark.parametrize("branch", list(BRANCHES))
async def test_an_in_app_run_offers_the_full_list(branch, warm_caches):
    call = await _drive(branch)
    offered = _offered(branch, call)
    full = {t["function"]["name"] for t in get_tools(_settings(*BRANCHES[branch]))}
    assert offered == full
    assert offered > set(ASK_TOOL_ALLOWLIST)
    assert {"execute_code", "web_search", "remember"} <= offered


def test_the_branches_are_four_distinct_provider_paths():
    assert {p for p, _ in BRANCHES.values()} == {"openai", "anthropic", "google", "openrouter"}
    assert MODEL_CAPABILITIES[BRANCHES["structured"][1]].get("native_tools") is False


@pytest.mark.asyncio
async def test_get_tools_is_unfiltered_after_an_outside_run(warm_caches):
    await _outside("openai")
    names = {t["function"]["name"] for t in get_tools(_settings(*BRANCHES["openai"]))}
    assert names > set(ASK_TOOL_ALLOWLIST)
    assert len(names) >= 20
