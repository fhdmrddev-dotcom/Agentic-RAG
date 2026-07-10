"""Phase 133 Plan 02 (EVAL-02) — RunContext.skill_catalog_override regression guard.

The honest eval A/B (WITH-skill vs WITHOUT-skill) needs ONE additive, default-off
input on the shared Deep/agent-loop path: ``RunContext.skill_catalog_override``.
Modeled byte-for-byte on the Phase 092 ``resume_dropped_tool_calls`` precedent, it
controls the data source of the skill-catalog injection block (agent_loop.py:1174-1195):

  * ``None``     → query the DB exactly as today (Deep Mode byte-identical, SC#4 / D-14).
  * ``()``       → inject NOTHING (WITHOUT arm, D-04 — the ``if enabled_skills:`` guard
                   short-circuits, so no ``## Available Skills`` note is appended).
  * ``(skill,)`` → inject EXACTLY those skills (WITH arm, D-03), no DB query.

This is a G-5 hot-file touch, so it ships RED-first: these tests FAIL today because
``RunContext`` has no ``skill_catalog_override`` field (constructing it raises
TypeError). After Task 2 lands the additive field + the single read-site branch,
all three go GREEN — ``test_deep_mode_unchanged`` is the SC#4 truth.

Pattern mirrors tests/integration/test_089_agent_loop_result_seam.py: drive
``run_agent_loop`` directly with a constructed ``RunContext`` and a mocked LLM,
capturing the system prompt via the ``create_adaptive_streaming_chat`` patch.
"""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.services.agent_loop import RunContext, run_agent_loop
from app.services.openai_service import CallingMode

from tests.integration._run_helpers import (
    _build_mock_supabase,
    _make_result,
    _make_table_builder,
)

THREAD_ID = str(uuid4())
USER_ID = "00000000-0000-0000-0000-000000000001"


# ---------------------------------------------------------------------------
# Helpers (mirror test_089_agent_loop_result_seam.py)
# ---------------------------------------------------------------------------

def _clean_sse_chunk(content, finish_reason=None):
    chunk = MagicMock()
    chunk.usage = None
    chunk.choices = [MagicMock()]
    chunk.choices[0].finish_reason = finish_reason
    delta = MagicMock()
    delta.content = content
    delta.tool_calls = None
    delta.reasoning_content = None
    chunk.choices[0].delta = delta
    return chunk


def _clean_chunks():
    for token in ("a", "b", "c"):
        yield _clean_sse_chunk(token)
    yield _clean_sse_chunk(None, finish_reason="stop")


def _make_user_settings() -> MagicMock:
    s = MagicMock()
    s.active_provider = "openai"
    s.llm_model = "gpt-5.4-mini"
    s.llm_api_key = "sk-test"
    s.llm_base_url = "https://api.openai.com/v1"
    s.openrouter_tool_strategy = "quality"
    s.web_search_enabled = True
    s.sandbox_enabled = True
    s.task_per_run_concurrency = 3
    # Phase 140: a MagicMock's ``skill_catalog_max_tokens`` would coerce via ``int()`` to
    # 1 and spuriously trip the over-budget pre-filter path in the D-06 seam tests. Pin a
    # REAL 0 (the inject-all kill switch) so the override=None seam stays byte-identical to
    # pre-140 Deep Mode with ZERO embed — the pre-filter budget tests set their own value.
    s.skill_catalog_max_tokens = 0
    s.embedding_model = "text-embedding-3-small"
    return s


def _make_body() -> MagicMock:
    b = MagicMock()
    b.model = "gpt-5.4-mini"
    b.provider = None
    b.agent_mode = "general"  # != "explorer" → skill-injection block runs
    b.content = "catalog override test prompt"
    return b


def _make_redis_mock() -> MagicMock:
    redis_mock = MagicMock()
    redis_mock.xadd = AsyncMock(return_value=b"1-0")
    redis_mock.expire = AsyncMock(return_value=True)
    redis_mock.zadd = AsyncMock(return_value=1)
    redis_mock.zrem = AsyncMock(return_value=1)
    redis_mock.aclose = AsyncMock(return_value=None)
    return redis_mock


def _supabase_with_tracked_skills(skills_rows):
    """Build a mock supabase whose ``skills`` table returns ``skills_rows`` and
    records every ``.execute()`` so a test can assert the DB query path was
    (or was NOT) taken. ``user_memory`` returns [] so no memory note is appended.
    """
    sb = _build_mock_supabase()
    # threads folder SELECT → no folder scope (keeps the system prompt clean)
    sb.table("threads").execute.side_effect = (
        lambda *a, **k: _make_result({"id": THREAD_ID, "folder_id": None})
    )

    skills_calls: list = []

    def _skills_execute(*a, **k):
        skills_calls.append((a, k))
        return _make_result(list(skills_rows))

    skills_builder = _make_table_builder(_skills_execute)

    _orig_side = sb.table.side_effect

    def _route(name):
        if name == "skills":
            return skills_builder
        return _orig_side(name)

    sb.table.side_effect = _route
    return sb, skills_calls


async def _capture_system_prompt(ctx: RunContext) -> str:
    """Drive run_agent_loop with a mocked LLM and return the system-prompt
    content from the FIRST create_adaptive_streaming_chat call."""
    captured: dict = {}

    def _fake_chat(messages, *a, **k):
        if "messages" not in captured:
            captured["messages"] = list(messages)
        return iter(_clean_chunks()), CallingMode.NATIVE

    _emit = AsyncMock(return_value=None)
    _emit_terminal = AsyncMock(return_value=None)

    def _spawn(coro):
        return asyncio.ensure_future(coro)

    with patch(
        "app.services.provider_gateway.openai_compat.create_adaptive_streaming_chat",
        side_effect=_fake_chat,
    ), patch(
        "app.services.agent_loop.get_pg_pool",
        new=AsyncMock(return_value=MagicMock()),
    ), patch(
        "app.services.agent_loop.insert_assistant_message",
        new=AsyncMock(return_value=uuid4()),
    ), patch(
        "app.services.suggestion_service.generate_suggestions",
        return_value=([], None),
    ):
        await run_agent_loop(
            ctx,
            emit=_emit,
            emit_terminal=_emit_terminal,
            spawn=_spawn,
            result_sink={},
        )

    system_msgs = [m for m in captured.get("messages", []) if m.get("role") == "system"]
    assert len(system_msgs) == 1, f"expected one system message, got {len(system_msgs)}"
    return system_msgs[0]["content"]


def _make_ctx(supabase, *, skill_catalog_override, user_settings=None) -> RunContext:
    return RunContext(
        run_id=uuid4(),
        thread_id=THREAD_ID,
        current_user={"id": USER_ID},
        user_settings=user_settings or _make_user_settings(),
        body=_make_body(),
        redis=_make_redis_mock(),
        supabase=supabase,
        resolved_model="gpt-5.4-mini",
        resolved_provider="openai",
        skill_catalog_override=skill_catalog_override,
    )


# ---------------------------------------------------------------------------
# 1. None → DB query path UNCHANGED (SC#4 / D-14 Deep Mode byte-identical)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@pytest.mark.timeout(20)
async def test_deep_mode_unchanged():
    """With skill_catalog_override=None the injection block issues the existing
    skills DB query AND builds the `## Available Skills` note from the query
    results — byte-identical to the pre-field behavior (SC#4)."""
    rows = [
        {"name": "Alpha", "description": "alpha skill"},
        {"name": "Beta", "description": "beta skill"},
    ]
    sb, skills_calls = _supabase_with_tracked_skills(rows)
    ctx = _make_ctx(sb, skill_catalog_override=None)

    prompt = await _capture_system_prompt(ctx)

    # The DB query path WAS taken (default behavior preserved).
    assert len(skills_calls) >= 1, "skills DB query must be issued when override is None"
    # The catalog note is built from the query results.
    assert "## Available Skills" in prompt
    assert "- **Alpha**: alpha skill" in prompt
    assert "- **Beta**: beta skill" in prompt


# ---------------------------------------------------------------------------
# 2. (skill,) → inject ONLY that skill, no DB query (WITH arm, D-03)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@pytest.mark.timeout(20)
async def test_with_arm_injects_only_target():
    """With skill_catalog_override=({"name":"X",...},) NO skills DB query is
    issued and the catalog note contains exactly skill X and no other."""
    # The DB would return decoy rows; the override must shadow them entirely.
    decoy = [{"name": "Decoy", "description": "must not appear"}]
    sb, skills_calls = _supabase_with_tracked_skills(decoy)
    ctx = _make_ctx(
        sb,
        skill_catalog_override=({"name": "X", "description": "target skill"},),
    )

    prompt = await _capture_system_prompt(ctx)

    assert len(skills_calls) == 0, "no skills DB query when override is a tuple"
    assert "## Available Skills" in prompt
    assert "- **X**: target skill" in prompt
    assert "Decoy" not in prompt


# ---------------------------------------------------------------------------
# 3. () → inject NOTHING (WITHOUT arm, D-04)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@pytest.mark.timeout(20)
async def test_without_arm_injects_nothing():
    """With skill_catalog_override=() NO skills DB query is issued and NO
    `## Available Skills` note is appended (the `if enabled_skills:` guard
    short-circuits)."""
    decoy = [{"name": "Decoy", "description": "must not appear"}]
    sb, skills_calls = _supabase_with_tracked_skills(decoy)
    ctx = _make_ctx(sb, skill_catalog_override=())

    prompt = await _capture_system_prompt(ctx)

    assert len(skills_calls) == 0, "no skills DB query when override is ()"
    assert "## Available Skills" not in prompt
    assert "Decoy" not in prompt


# ===========================================================================
# Phase 140 (TRIG-02) — smart-dispatch relevance pre-filter, wired STRICTLY
# inside the ``skill_catalog_override is None`` branch (D-06). These extend the
# D-06 seam harness above: fits-budget byte-identical fast path (ZERO embed),
# over-budget trim via mocked match_skills, D-05 fail-open, Blocker-1 self-heal
# kick, and the eval-tuple branch NEVER embedding/ranking/kicking.
# ===========================================================================

from app.services.context_window import estimate_tokens  # noqa: E402
from app.services.skill_lint import LOAD_SKILL_POLICY  # noqa: E402

# chars/4 heuristic → deterministic, tiktoken-independent budget math (mirrors
# tests/test_140_catalog_trim.py). The wiring passes ``user_settings.llm_model`` to
# estimate_tokens, so the pre-filter settings below set ``llm_model=""`` to match.
_PF_MODEL = ""
_PF_HEADER = f"\n\n## Available Skills\nThe following skills are available. {LOAD_SKILL_POLICY}\n"


def _pf_skill(sid: str, name: str, desc_len: int = 300) -> dict:
    """A skill row shaped like the ``.select('id, name, description')`` result."""
    return {"id": sid, "name": name, "description": name[0] * desc_len}


def _pf_line(s: dict) -> str:
    return f"- **{s['name']}**: {s['description']}"


def _pf_today_block(enabled: list[dict]) -> str:
    """The EXACT byte-identical catalog note today would emit (name-sorted)."""
    lines = "\n".join(_pf_line(s) for s in sorted(enabled, key=lambda s: s["name"]))
    return _PF_HEADER + lines


def _make_prefilter_settings(budget: int, *, embedding_model="text-embedding-3-small"):
    """A user_settings whose ``skill_catalog_max_tokens`` is a REAL int (a MagicMock
    would make ``resolve_skill_catalog_budget`` clamp to 0 = inject-all) and whose
    ``llm_model=''`` forces the chars/4 estimator for deterministic budget math."""
    s = _make_user_settings()
    s.llm_model = _PF_MODEL
    s.skill_catalog_max_tokens = budget
    s.embedding_model = embedding_model
    return s


def _supabase_with_prefilter(skills_rows, ranked_rows=None):
    """Extend ``_supabase_with_tracked_skills`` with a ``match_skills`` RPC that returns
    ``ranked_rows`` and records every rpc call, so a test can assert the RPC path was (or
    was NOT) taken and drive the similarity map the trim consumes."""
    sb, skills_calls = _supabase_with_tracked_skills(skills_rows)
    rpc_calls: list = []

    def _rpc(name, params=None):
        rpc_calls.append((name, params))
        rows = list(ranked_rows or []) if name == "match_skills" else []
        return _make_table_builder(lambda *a, **k: _make_result(rows))

    sb.rpc.side_effect = _rpc
    return sb, skills_calls, rpc_calls


# ---------------------------------------------------------------------------
# 4. Fits budget → byte-identical fast path, ZERO embed/RPC/kick (Pitfall 1)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@pytest.mark.timeout(20)
async def test_prefilter_fits_budget_byte_identical_no_embed():
    """Under budget with override=None → the ## Available Skills block is BYTE-IDENTICAL
    to today, and NO embed_texts / match_skills / kick_skill_backfill is invoked (D-03)."""
    rows = [_pf_skill("a", "Alpha", 40), _pf_skill("b", "Bravo", 40)]
    sb, _skills_calls, rpc_calls = _supabase_with_prefilter(rows, ranked_rows=[])
    ctx = _make_ctx(
        sb, skill_catalog_override=None, user_settings=_make_prefilter_settings(100_000)
    )

    mock_embed = MagicMock(return_value=[[0.1, 0.2, 0.3]])
    mock_kick = MagicMock(return_value=None)
    with patch("app.services.agent_loop.embed_texts", mock_embed), patch(
        "app.services.agent_loop.kick_skill_backfill", mock_kick
    ):
        prompt = await _capture_system_prompt(ctx)

    assert prompt.endswith(_pf_today_block(rows)), "fits path must be byte-identical to today"
    assert mock_embed.call_count == 0, "fast path must NOT embed (Pitfall 1)"
    assert not any(n == "match_skills" for n, _ in rpc_calls), "fast path must NOT rank"
    assert mock_kick.call_count == 0, "fast path must NOT self-heal kick"
    assert "additional skill(s) exist" not in prompt, "no trim marker on the fast path"


# ---------------------------------------------------------------------------
# 5. Over budget → embed + match_skills rank → least-relevant cut, marker
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@pytest.mark.timeout(20)
async def test_prefilter_over_budget_trims_least_relevant():
    """Over budget with override=None → embed_texts runs (via run_in_threadpool),
    match_skills is called with p_embedding_model, the lowest-similarity non-pinned
    skill is omitted, and the honest trim marker is appended (SC#1 + SC#3)."""
    skills = [
        _pf_skill("a", "Alpha"),
        _pf_skill("b", "Bravo"),
        _pf_skill("c", "Charlie"),
        _pf_skill("d", "Delta"),
        _pf_skill("e", "Echo"),
    ]
    ranked = [
        {"id": "a", "similarity": 0.90},
        {"id": "b", "similarity": 0.80},
        {"id": "c", "similarity": 0.70},
        {"id": "d", "similarity": 0.60},
        {"id": "e", "similarity": 0.05},  # Echo clearly least relevant → cut first
    ]
    two_keep = _PF_HEADER + _pf_line(skills[0]) + "\n" + _pf_line(skills[1])
    budget = estimate_tokens(two_keep, _PF_MODEL) + 40  # ~2 lines + marker, not all 5
    sb, _skills_calls, rpc_calls = _supabase_with_prefilter(skills, ranked_rows=ranked)
    ctx = _make_ctx(
        sb, skill_catalog_override=None, user_settings=_make_prefilter_settings(budget)
    )

    mock_embed = MagicMock(return_value=[[0.1, 0.2, 0.3]])
    mock_kick = MagicMock(return_value=None)
    with patch("app.services.agent_loop.embed_texts", mock_embed), patch(
        "app.services.agent_loop.kick_skill_backfill", mock_kick
    ):
        prompt = await _capture_system_prompt(ctx)

    assert mock_embed.call_count == 1, "over-budget path must embed the turn once"
    match_calls = [(n, p) for n, p in rpc_calls if n == "match_skills"]
    assert len(match_calls) == 1, "match_skills must be called once"
    _name, params = match_calls[0]
    assert params["p_embedding_model"] == "text-embedding-3-small", "D-10 model tag passed"
    assert params["match_user_id"] == USER_ID, "V4 owner scope passed to the RPC"
    assert "Echo" not in prompt, "lowest-similarity skill cut first (SC#1)"
    assert "Alpha" in prompt, "highest-similarity skill retained"
    assert "additional skill(s) exist" in prompt, "honest trim marker appended (SC#3)"
    # All-real similarities → no NULL-sim skill → no self-heal kick.
    assert mock_kick.call_count == 0, "no kick when every in-scope skill has a real sim"


# ---------------------------------------------------------------------------
# 6. Fail-open: embed raises → catalog still emitted, no crash (D-05)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@pytest.mark.timeout(20)
async def test_prefilter_fail_open_on_embed_error():
    """Over budget with embed_texts RAISING → the turn does not crash, a catalog is still
    injected (inject-all-up-to-budget by name), and no kick fires (D-05 fail-open)."""
    skills = [
        _pf_skill("a", "Alpha"),
        _pf_skill("b", "Bravo"),
        _pf_skill("c", "Charlie"),
        _pf_skill("d", "Delta"),
        _pf_skill("e", "Echo"),
    ]
    two_keep = _PF_HEADER + _pf_line(skills[0]) + "\n" + _pf_line(skills[1])
    budget = estimate_tokens(two_keep, _PF_MODEL) + 40
    sb, _skills_calls, _rpc_calls = _supabase_with_prefilter(skills, ranked_rows=[])
    ctx = _make_ctx(
        sb, skill_catalog_override=None, user_settings=_make_prefilter_settings(budget)
    )

    mock_embed = MagicMock(side_effect=RuntimeError("embedder down"))
    mock_kick = MagicMock(return_value=None)
    with patch("app.services.agent_loop.embed_texts", mock_embed), patch(
        "app.services.agent_loop.kick_skill_backfill", mock_kick
    ):
        prompt = await _capture_system_prompt(ctx)  # must NOT raise

    assert "## Available Skills" in prompt, "fail-open still injects a catalog"
    assert "Alpha" in prompt, "name-first kept under fail-open"
    assert "additional skill(s) exist" in prompt, "still honest about trimming"
    assert mock_kick.call_count == 0, "embed failed before ranking → no kick"


# ---------------------------------------------------------------------------
# 7. Self-heal kick (Blocker-1): NULL-sim in-scope skill → fire-and-forget
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@pytest.mark.timeout(20)
async def test_prefilter_self_heal_kick_for_null_sim():
    """Over budget where match_skills returns an in-scope skill with similarity=None
    (missing vector) → kick_skill_backfill is called ONCE with those NULL-sim ids
    (Blocker-1), fire-and-forget; the turn completes normally."""
    skills = [
        _pf_skill("a", "Alpha"),
        _pf_skill("b", "Bravo"),
        _pf_skill("c", "Charlie"),
        _pf_skill("d", "Delta"),
        _pf_skill("e", "Echo"),
    ]
    ranked = [
        {"id": "a", "similarity": 0.90},
        {"id": "b", "similarity": 0.80},
        {"id": "c", "similarity": 0.70},
        {"id": "d", "similarity": None},   # missing/NULL vector → self-heal target
        {"id": "e", "similarity": None},   # missing/NULL vector → self-heal target
    ]
    two_keep = _PF_HEADER + _pf_line(skills[0]) + "\n" + _pf_line(skills[1])
    budget = estimate_tokens(two_keep, _PF_MODEL) + 40
    sb, _skills_calls, _rpc_calls = _supabase_with_prefilter(skills, ranked_rows=ranked)
    ctx = _make_ctx(
        sb, skill_catalog_override=None, user_settings=_make_prefilter_settings(budget)
    )

    mock_embed = MagicMock(return_value=[[0.1, 0.2, 0.3]])
    mock_kick = MagicMock(return_value=None)
    with patch("app.services.agent_loop.embed_texts", mock_embed), patch(
        "app.services.agent_loop.kick_skill_backfill", mock_kick
    ):
        await _capture_system_prompt(ctx)

    assert mock_kick.call_count == 1, "exactly one self-heal kick for the NULL-sim skills"
    _args, kwargs = mock_kick.call_args
    assert set(kwargs["only_skill_ids"]) == {"d", "e"}, "kick targets exactly the NULL-sim ids"


@pytest.mark.asyncio
@pytest.mark.timeout(20)
async def test_prefilter_self_heal_kick_failure_does_not_propagate():
    """A kick_skill_backfill that RAISES must not propagate (it is inside the pre-filter
    fail-open try/except) — the turn still completes and a catalog is injected (D-05)."""
    skills = [
        _pf_skill("a", "Alpha"),
        _pf_skill("b", "Bravo"),
        _pf_skill("c", "Charlie"),
        _pf_skill("d", "Delta"),
        _pf_skill("e", "Echo"),
    ]
    ranked = [
        {"id": "a", "similarity": 0.90},
        {"id": "b", "similarity": 0.80},
        {"id": "c", "similarity": 0.70},
        {"id": "d", "similarity": 0.60},
        {"id": "e", "similarity": None},   # NULL-sim → triggers the (raising) kick
    ]
    two_keep = _PF_HEADER + _pf_line(skills[0]) + "\n" + _pf_line(skills[1])
    budget = estimate_tokens(two_keep, _PF_MODEL) + 40
    sb, _skills_calls, _rpc_calls = _supabase_with_prefilter(skills, ranked_rows=ranked)
    ctx = _make_ctx(
        sb, skill_catalog_override=None, user_settings=_make_prefilter_settings(budget)
    )

    mock_embed = MagicMock(return_value=[[0.1, 0.2, 0.3]])
    mock_kick = MagicMock(side_effect=RuntimeError("kick spawn failed"))
    with patch("app.services.agent_loop.embed_texts", mock_embed), patch(
        "app.services.agent_loop.kick_skill_backfill", mock_kick
    ):
        prompt = await _capture_system_prompt(ctx)  # must NOT raise

    assert mock_kick.call_count == 1, "the kick was attempted"
    assert "## Available Skills" in prompt, "a raising kick fails open — catalog still emitted"


# ---------------------------------------------------------------------------
# 8. Eval-tuple branch NEVER embeds, ranks, or kicks (D-06 hard boundary)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@pytest.mark.timeout(20)
async def test_prefilter_tuple_branch_never_embeds_or_kicks():
    """With a tuple override the pre-filter path is skipped entirely: no embed_texts, no
    match_skills RPC, no kick — even with a budget set low enough that the None branch
    WOULD have trimmed (D-06 eval seam / Deep Mode byte-identical)."""
    override = (
        {"name": "X", "description": "x" * 400},
        {"name": "Y", "description": "y" * 400},
    )
    sb, skills_calls, rpc_calls = _supabase_with_prefilter([], ranked_rows=[])
    ctx = _make_ctx(
        sb,
        skill_catalog_override=override,
        user_settings=_make_prefilter_settings(10),  # tiny budget the None path would trim on
    )

    mock_embed = MagicMock(return_value=[[0.1, 0.2, 0.3]])
    mock_kick = MagicMock(return_value=None)
    with patch("app.services.agent_loop.embed_texts", mock_embed), patch(
        "app.services.agent_loop.kick_skill_backfill", mock_kick
    ):
        prompt = await _capture_system_prompt(ctx)

    assert len(skills_calls) == 0, "no skills DB query for a tuple override"
    assert mock_embed.call_count == 0, "tuple branch never embeds"
    assert not any(n == "match_skills" for n, _ in rpc_calls), "tuple branch never ranks"
    assert mock_kick.call_count == 0, "tuple branch never kicks"
    # Byte-identical to today's tuple injection (both skills present, no trim marker).
    assert "- **X**: " + ("x" * 400) in prompt
    assert "- **Y**: " + ("y" * 400) in prompt
    assert "additional skill(s) exist" not in prompt, "tuple branch never trims"
