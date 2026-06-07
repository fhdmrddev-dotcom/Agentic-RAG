"""Phase 096 Plan 02 — D-01 part 1: the CI structural workflow-regression gate.

Drives a FULL multi-phase workflow through the REAL harness engine
(``harness_engine.run_workflow``) with a scripted fake provider injected at the
gateway seam (``task_service.open_stream`` — patched where it is CONSUMED, the
test_085 precedent). "CI proves structure; operator proves providers": this file
is deterministic, offline (no provider keys, no network), and never flaky — a
push that breaks phase sequencing, gate retry, whitelist enforcement, or the
resume 2-phase writes turns CI red.

093 mock-blind-spot lesson: NEVER patch ``_stream_one_iteration`` and
NEVER patch ``run_task_sub_agent`` (the executor seam) — the REAL engine, the REAL
task_service drain loop, and the REAL ``dispatch_tool`` whitelist guard MUST
execute. The ONLY faked seams are infrastructure boundaries:

  - ``task_service.open_stream``        → the provider network boundary (the point
                                          of D-01: a scripted GatewayEvent stream)
  - ``task_service.get_pg_pool``        → the asyncpg pool (conftest mock recorder)
  - ``app.config.get_model_capability_async`` → the registry DB tier (offline,
                                          the test_085 precedent)
  - ``phase_types.subscribe_for_response``    → the ask_user block (Pitfall-5
                                          determinism — pre-published answer; the
                                          REAL pub/sub path is covered by the
                                          operator restart smoke)
  - ``_TOOL_REGISTRY["search_documents"]``    → the leaf tool handler (Supabase
                                          RPC network boundary); ``dispatch_tool``
                                          itself (routing + whitelist guard) is REAL.

CI infra: ``.github/workflows/backend-tests.yml`` already triggers on
``backend/**`` and runs ``pytest tests -q`` — this file is picked up with ZERO
workflow YAML edits (PATTERNS.md, verified).
"""
from __future__ import annotations

import asyncio
import json
import uuid
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from app.services.tool_dispatcher import _TOOL_REGISTRY, ToolResult


# ───────────────────────────────────────────────────────────────────────────────
# The scripted fake gateway (generalizes test_085_task_service._make_open_stream_stub)
# ───────────────────────────────────────────────────────────────────────────────

class _SyncEventStream:
    """A bare SYNC generator-like stream (the IN-05 shape the gateway adapters
    return): iterable + a sync ``.close()``. The task_service drain MUST drive it
    with ``for event in stream:`` inside a threadpool (never ``async for``).

    ``raises`` (optional) is raised AFTER the scripted events are exhausted — the
    mid-phase crash lever for the resume leg (the stream dies between the engine's
    ``mark_phase_active`` and ``complete_phase`` writes).
    """

    def __init__(self, events, raises: BaseException | None = None):
        self._events = list(events)
        self._raises = raises
        self.closed = False

    def __iter__(self):
        yield from self._events
        if self._raises is not None:
            raise self._raises

    def close(self):
        self.closed = True


class ScriptedGateway:
    """Scripted fake provider at the gateway ``open_stream`` seam (D-01).

    Generalizes the test_085 stub from one stream to a multi-call workflow: each
    ``open_stream(provider, request)`` resolves its event script through a
    CONTENT-AWARE router (keyed on the request's system prompt + whether a tool
    result has been fed back), so a multi-phase workflow — including
    nondeterministically-interleaved parallel batch branches — always receives
    the phase-appropriate stream. Events byte-match the canonical GatewayEvent
    schema (``provider_gateway/events.py``: delta / tool_start / finish).

    Captures every call (provider, request, and the mock pool's call-count at
    call time) so tests can assert tool-result round-trips and interleave the
    LLM-call timeline against the pool's SQL write timeline.
    """

    def __init__(self, route, *, pool=None, calling_mode=None):
        from app.services.openai_service import CallingMode

        self._route = route
        self._calling_mode = calling_mode or CallingMode.NATIVE
        self._pool = pool
        self.calls: list[dict] = []
        self.streams: list[_SyncEventStream] = []

    async def open_stream(self, provider, request):
        routed = self._route(request)
        if isinstance(routed, tuple):
            events, raises = routed
        else:
            events, raises = routed, None
        stream = _SyncEventStream(events, raises=raises)
        self.streams.append(stream)
        self.calls.append(
            {
                "provider": provider,
                "request": request,
                # SNAPSHOT the messages at call time — the sub-agent loop appends
                # to the SAME list across iterations, so the live reference would
                # alias post-call state into earlier captures.
                "messages": [dict(m) for m in request.messages],
                "system_prompt": request.system_prompt,
                "pool_calls_len": (
                    len(self._pool.calls) if self._pool is not None else None
                ),
            }
        )
        return stream, self._calling_mode


def _final_events(text: str) -> list[dict]:
    """A converged turn: one text delta + a stop finish (GatewayEvent shapes)."""
    return [
        {"type": "delta", "content": text},
        {"type": "finish", "finish_reason": "stop", "tool_calls": []},
    ]


def _tool_call_events(name: str, args: dict, call_id: str) -> list[dict]:
    """A tool-firing turn: delta + tool_start (complete args) + finish."""
    return [
        {"type": "delta", "content": "Working on it."},
        {"type": "tool_start", "id": call_id, "name": name, "args": args},
        {"type": "finish", "finish_reason": "tool_calls", "tool_calls": []},
    ]


def _has_tool_result(request) -> bool:
    """True when a prior tool result has been fed back on this request (route-time
    check against the LIVE request)."""
    return any(m.get("role") == "tool" for m in request.messages)


def _call_has_tool_result(call: dict) -> bool:
    """The capture-time equivalent — reads the call's messages SNAPSHOT (the live
    list is mutated in place by the sub-agent loop after the call)."""
    return any(m.get("role") == "tool" for m in call["messages"])


# ───────────────────────────────────────────────────────────────────────────────
# Shared offline stubs (infrastructure boundaries only — the engine stays REAL)
# ───────────────────────────────────────────────────────────────────────────────

async def _fake_capability(model):
    """Offline registry stand-in (test_085 precedent) — keeps the openai-compat
    adapter-provider derivation off the DB tier."""
    return {"provider": "openai"}


_SEARCH_RESULT_MARKER = "CI-SEARCH-RESULT"


async def _fake_search_documents(args, ctx) -> ToolResult:
    """Deterministic leaf handler for ``search_documents`` (the Supabase/embedding
    network boundary). ``dispatch_tool`` — including the phase-whitelist guard —
    runs for REAL; only this leaf is substituted."""
    return ToolResult(
        result=json.dumps(
            {
                "results": [
                    {
                        "content": f"{_SEARCH_RESULT_MARKER}: relevant passage for "
                        f"{args.get('query', '')!r}",
                        "document": "ci-fixture.md",
                    }
                ]
            }
        )
    )


def _make_workflow_ctx(*, run_id, pool, redis, inputs, spawned, thread_id=None):
    """The live-kickoff-shaped harness ctx bag (mirrors _build_resume_context's
    surface). ``producer_run_id`` is mandatory — _build_phase_tool_context is
    fail-closed without it. ``spawn`` collects fire-and-forget audit tasks so
    tests can flush them before asserting on pool.calls."""
    from app.services import harness_engine

    def _spawn(coro):
        task = asyncio.create_task(coro)
        spawned.append(task)
        return task

    return SimpleNamespace(
        run_id=run_id,
        producer_run_id=uuid.uuid4(),
        thread_id=thread_id or str(uuid.uuid4()),
        user_settings=None,
        model="",
        inputs=inputs,
        current_user={"id": str(uuid.uuid4())},
        redis=redis,
        pool=pool,
        emit=harness_engine._emit,
        retry_feedback=None,
        supabase=None,  # llm_human_input's best-effort prompt-row insert no-ops
        folder_subtree_ids=None,
        scoped_folder_path=None,
        spawn=_spawn,
        per_run_task_semaphore=asyncio.Semaphore(3),
    )


def _make_get_pool(pool):
    """Async stand-in for task_service.get_pg_pool → the conftest mock recorder."""

    async def _get_pool():
        return pool

    return _get_pool


@pytest.fixture(autouse=True)
def _ensure_real_executors():
    """Re-register the 5 REAL phase executors before each test.

    Other test modules (test_harness_resume.py) pop entries out of
    PHASE_TYPE_REGISTRY in their cleanup — under whole-suite ordering that would
    strand this file with a missing executor. register_all() is an idempotent
    dict.update, so this is free when the registry is already intact.
    """
    from app.services.harness import phase_types

    phase_types.register_all()
    yield


# ───────────────────────────────────────────────────────────────────────────────
# pool.calls SQL-timeline assertion helpers (the 2-phase-write proof mechanism)
# ───────────────────────────────────────────────────────────────────────────────

def _phase_write_indices(calls, phase_id):
    """(active-update indices, completed-update indices) for one phase id."""
    active, completed = [], []
    for i, (sql, args) in enumerate(calls):
        if not isinstance(sql, str) or not args:
            continue
        if args[0] != phase_id:
            continue
        if "UPDATE workflow_phases SET status='active'" in sql:
            active.append(i)
        elif "UPDATE workflow_phases SET status='completed'" in sql:
            completed.append(i)
    return active, completed


def _audit_indices(calls, event_type):
    """Indices of harness_audit INSERTs carrying ``event_type``."""
    return [
        i
        for i, (sql, args) in enumerate(calls)
        if isinstance(sql, str)
        and "INSERT INTO harness_audit" in sql
        and len(args) >= 3
        and args[2] == event_type
    ]


def _run_terminal_status(calls, run_id):
    """The terminal workflow_runs status written for ``run_id`` (or None)."""
    status = None
    for sql, args in calls:
        if (
            isinstance(sql, str)
            and "UPDATE workflow_runs SET status" in sql
            and args
            and args[0] == run_id
        ):
            status = args[1]
    return status


# ───────────────────────────────────────────────────────────────────────────────
# Test 1 — the happy-path full-workflow journey (all 5 phase types, REAL engine)
# ───────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_096_ci_workflow_regression_happy_path(
    mock_asyncpg_pool, fake_redis, build_workflow_definition, monkeypatch
):
    """The D-01 journey: programmatic → llm_batch_agents → llm_agent(+gate) →
    llm_human_input → llm_single through the REAL engine with the fake provider
    at the gateway seam. Asserts phase sequencing (2-phase writes in
    phase_index order), the search_documents tool round-trip, and a completed
    terminal."""
    from app.services import harness_engine, task_service
    from app.services.harness import phase_types

    pool = mock_asyncpg_pool

    # The in-process 5-type definition (the four_seed_defs builder shape — the
    # CI test does NOT need migration 066; it builds its definition in-process).
    wf = build_workflow_definition(
        [
            {"slug": "split", "phase_index": 0,
             "config": {"phase_type": "programmatic", "fn": "split_topic",
                        "input_keys": ["topic"]}},
            {"slug": "review", "phase_index": 1,
             "config": {"phase_type": "llm_batch_agents",
                        "prompt": "CI-REVIEW: research the sub-question against "
                                  "the corpus.",
                        "available_tools": ["search_documents"],
                        "max_parallel_agents": 5,
                        "merge_strategy": "concat_numbered"}},
            {"slug": "verify", "phase_index": 2,
             "config": {"phase_type": "llm_agent",
                        "prompt": "CI-VERIFY: check the review and answer.",
                        "available_tools": ["search_documents"]},
             # 061 seed 2's exact validator shape (plan_execute_verify gate).
             "validators": [
                 {"kind": "regex_match",
                  "config": {"pattern": "VERIFIED"},
                  "on_failure": "retry",
                  "max_retries": 2}
             ]},
            {"slug": "confirm", "phase_index": 3,
             "config": {"phase_type": "llm_human_input",
                        "prompt": "CI-CONFIRM: does the verified review look "
                                  "right?",
                        "options": ["Looks good", "Needs changes"]}},
            {"slug": "finalize", "phase_index": 4,
             "config": {"phase_type": "llm_single",
                        "prompt": "CI-FINALIZE: write the final answer."}},
        ],
        slug="ci_coverage",
        name="CI coverage journey",
    )

    run_id = uuid.uuid4()
    slugs = ["split", "review", "verify", "confirm", "finalize"]
    phase_ids = {slug: uuid.uuid4() for slug in slugs}
    pool.set_fetch_result(
        [
            {"id": phase_ids[s], "slug": s, "phase_index": i,
             "status": "pending", "output": {}}
            for i, s in enumerate(slugs)
        ]
    )

    # Content-aware routing — deterministic regardless of the parallel batch
    # branches' threadpool interleave (each branch's SECOND call carries the
    # fed-back tool result, so per-call ordering never matters).
    call_seq = {"n": 0}

    def route(request):
        sys_prompt = request.system_prompt
        if "CI-REVIEW" in sys_prompt:
            if _has_tool_result(request):
                return _final_events("Reviewed: found the relevant docs.")
            call_seq["n"] += 1
            return _tool_call_events(
                "search_documents",
                {"query": "ci coverage"},
                f"call_search_{call_seq['n']}",
            )
        if "CI-VERIFY" in sys_prompt:
            # Gate passes FIRST TRY in this test (retry is test 2's leg).
            return _final_events("All checks done. VERIFIED.")
        if "CI-FINALIZE" in sys_prompt:
            return _final_events("Final answer: ci journey complete.")
        raise AssertionError(f"unexpected LLM call: {sys_prompt[:80]!r}")

    gw = ScriptedGateway(route, pool=pool)

    async def _fake_subscribe(redis, sub_run_id, tool_call_id, timeout_seconds):
        # Pitfall-5 determinism: the ONE seam where determinism beats realism —
        # the pre-published answer; the real pub/sub path is covered by the
        # operator restart smoke.
        return {"kind": "response", "response_text": "Looks good",
                "choice_index": 0}

    spawned: list[asyncio.Task] = []
    ctx = _make_workflow_ctx(
        run_id=run_id, pool=pool, redis=fake_redis,
        inputs={"topic": "alpha; beta",
                "kickoff_prompt": "CI kickoff: cover alpha and beta."},
        spawned=spawned,
    )

    monkeypatch.setitem(_TOOL_REGISTRY, "search_documents", _fake_search_documents)

    with patch.object(task_service, "open_stream", gw.open_stream), \
         patch.object(task_service, "get_pg_pool", _make_get_pool(pool)), \
         patch("app.config.get_model_capability_async", _fake_capability), \
         patch.object(phase_types, "subscribe_for_response", _fake_subscribe):
        await asyncio.wait_for(
            harness_engine.run_workflow(
                run_id, wf, ctx, pool=pool, redis=fake_redis
            ),
            timeout=30,
        )
    if spawned:
        await asyncio.wait_for(asyncio.gather(*spawned), timeout=30)

    # ── Phase sequencing: 2-phase write per phase, activations in index order ──
    first_actives = []
    for slug in slugs:
        active, completed = _phase_write_indices(pool.calls, phase_ids[slug])
        assert active, f"phase {slug!r}: no status='active' UPDATE recorded"
        assert completed, f"phase {slug!r}: no status='completed' UPDATE recorded"
        assert active[0] < completed[0], (
            f"phase {slug!r}: active must be written BEFORE completed"
        )
        first_actives.append(active[0])
    assert first_actives == sorted(first_actives), (
        "phases must activate in phase_index order 0→4"
    )

    # ── Tool round-trip: the search result is fed back on each branch's
    #    FOLLOWING call (captured by the fake at the gateway seam) ──────────────
    review_calls = [c for c in gw.calls if "CI-REVIEW" in c["system_prompt"]]
    followups = [c for c in review_calls if _call_has_tool_result(c)]
    assert len(review_calls) == 4, (
        "2 batch branches × (tool call + follow-up) = 4 CI-REVIEW gateway calls"
    )
    assert len(followups) == 2, "each branch feeds its tool result back once"
    for call in followups:
        tool_msgs = [m for m in call["messages"] if m.get("role") == "tool"]
        assert tool_msgs, "follow-up call must carry a tool-role message"
        assert any(_SEARCH_RESULT_MARKER in m.get("content", "") for m in tool_msgs), (
            "the search_documents result must be fed back to the model"
        )

    # ── Run terminal + journey shape ──────────────────────────────────────────
    assert _run_terminal_status(pool.calls, run_id) == "completed"
    assert len(gw.calls) == 6, (
        "expected exactly 6 LLM calls: 4 (batch: 2 branches × 2) + 1 (verify) "
        "+ 1 (finalize)"
    )
    assert all(s.closed for s in gw.streams), (
        "every scripted stream must be closed by the drain (resource cleanup)"
    )
    # The human-input pause surfaced on the producer stream (ask_user_prompt).
    assert any(
        "ask_user_prompt" in (fields.get("data") or "")
        for _stream, fields in fake_redis.xadds
    ), "the llm_human_input phase must emit its ask_user_prompt"
    # The gate that guards 'verify' passed (regex VERIFIED matched, audited).
    assert _audit_indices(pool.calls, "gate_passed"), (
        "the verify phase's regex gate must record gate_passed"
    )


# ───────────────────────────────────────────────────────────────────────────────
# Test 2 — gate retry is BOUNDED and audited (HARNESS-04 structural lock)
# ───────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_096_gate_retry_bounded(
    mock_asyncpg_pool, fake_redis, build_workflow_definition, monkeypatch
):
    """The llm_agent gate phase fails its regex first, passes on the retry.

    Asserts exactly 2 LLM calls for the phase (bounded retry honored —
    max_retries=2 never exceeded), a gate_failed audit write lands BETWEEN the
    two calls on the pool timeline, and the phase ultimately completes."""
    from app.services import harness_engine, task_service

    pool = mock_asyncpg_pool
    wf = build_workflow_definition(
        [
            {"slug": "gated", "phase_index": 0,
             "config": {"phase_type": "llm_agent",
                        "prompt": "CI-GATED: produce the verified answer.",
                        "available_tools": ["search_documents"]},
             "validators": [
                 {"kind": "regex_match",
                  "config": {"pattern": "VERIFIED"},
                  "on_failure": "retry",
                  "max_retries": 2}
             ]},
        ],
        slug="ci_gate_retry",
        name="CI gate retry",
    )
    run_id = uuid.uuid4()
    phase_id = uuid.uuid4()
    pool.set_fetch_result(
        [{"id": phase_id, "slug": "gated", "phase_index": 0,
          "status": "pending", "output": {}}]
    )

    def route(request):
        sys_prompt = request.system_prompt
        if "CI-GATED" not in sys_prompt:
            raise AssertionError(f"unexpected LLM call: {sys_prompt[:80]!r}")
        if "failed validation" in sys_prompt:
            # The retry attempt — ctx.retry_feedback was appended to the prompt
            # (the producer/consumer round-trip), so the model can now comply.
            return _final_events("Corrected answer. VERIFIED.")
        # First attempt: deliberately misses the regex (no marker token).
        return _final_events("Draft answer: checks still pending.")

    gw = ScriptedGateway(route, pool=pool)
    spawned: list[asyncio.Task] = []
    ctx = _make_workflow_ctx(
        run_id=run_id, pool=pool, redis=fake_redis,
        inputs={"kickoff_prompt": "CI gate retry kickoff."},
        spawned=spawned,
    )
    monkeypatch.setitem(_TOOL_REGISTRY, "search_documents", _fake_search_documents)

    with patch.object(task_service, "open_stream", gw.open_stream), \
         patch.object(task_service, "get_pg_pool", _make_get_pool(pool)), \
         patch("app.config.get_model_capability_async", _fake_capability):
        await asyncio.wait_for(
            harness_engine.run_workflow(
                run_id, wf, ctx, pool=pool, redis=fake_redis
            ),
            timeout=30,
        )
    if spawned:
        await asyncio.wait_for(asyncio.gather(*spawned), timeout=30)

    # ── Bounded retry: exactly 2 LLM calls (attempt 0 fails, attempt 1 passes;
    #    max_retries=2 would allow a 3rd — it must never be needed or exceeded) ──
    assert len(gw.calls) == 2, (
        f"expected exactly 2 LLM calls for the gated phase, got {len(gw.calls)}"
    )
    retry_calls = [c for c in gw.calls if "failed validation" in c["system_prompt"]]
    assert len(retry_calls) == 1, (
        "exactly ONE retry attempt carries the gate-failure feedback"
    )

    # ── The gate-failure audit write lands BETWEEN the two LLM calls ──────────
    gate_failed = _audit_indices(pool.calls, "gate_failed")
    assert len(gate_failed) == 1, "exactly one gate_failed audit for the one miss"
    assert gw.calls[0]["pool_calls_len"] <= gate_failed[0] < gw.calls[1]["pool_calls_len"], (
        "the gate_failed audit must land after attempt 1 and before attempt 2"
    )
    # The pass after the retry is audited too.
    gate_passed = _audit_indices(pool.calls, "gate_passed")
    assert gate_passed and gate_failed[0] < gate_passed[0]

    # ── The phase ultimately completes; the run terminalizes completed ────────
    active, completed = _phase_write_indices(pool.calls, phase_id)
    assert active and completed and active[0] < completed[0]
    assert _run_terminal_status(pool.calls, run_id) == "completed"


# ───────────────────────────────────────────────────────────────────────────────
# Test 3 — the REAL dispatch_tool whitelist guard refuses a non-whitelisted tool
# ───────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_096_whitelist_refusal(
    mock_asyncpg_pool, fake_redis, build_workflow_definition, monkeypatch
):
    """A batch sub-agent calls ``execute_code`` while the phase whitelist is
    ``["search_documents"]``. The REAL dispatch_tool guard refuses it (the
    refusal-shaped tool_result is fed back to the model), the phase does NOT
    crash, and no execute_code side-effect write reaches the pool."""
    from app.services import harness_engine, task_service

    pool = mock_asyncpg_pool
    wf = build_workflow_definition(
        [
            {"slug": "fanout", "phase_index": 0,
             "config": {"phase_type": "llm_batch_agents",
                        "prompt": "CI-WHITELIST: research with the allowed "
                                  "tools only.",
                        "available_tools": ["search_documents"],
                        "max_parallel_agents": 5,
                        "merge_strategy": "concat"}},
        ],
        slug="ci_whitelist",
        name="CI whitelist refusal",
    )
    run_id = uuid.uuid4()
    phase_id = uuid.uuid4()
    pool.set_fetch_result(
        [{"id": phase_id, "slug": "fanout", "phase_index": 0,
          "status": "pending", "output": {}}]
    )

    def route(request):
        sys_prompt = request.system_prompt
        if "CI-WHITELIST" not in sys_prompt:
            raise AssertionError(f"unexpected LLM call: {sys_prompt[:80]!r}")
        if _has_tool_result(request):
            return _final_events("Understood — staying inside the whitelist.")
        # The model hallucinates a NON-whitelisted tool.
        return _tool_call_events(
            "execute_code", {"code": "print('nope')"}, "call_exec_1"
        )

    gw = ScriptedGateway(route, pool=pool)

    # Sentinel: if the guard ever lets the call through to the registry handler,
    # the test fails loudly (the refusal must happen BEFORE handler lookup).
    handler_reached = {"n": 0}

    async def _sentinel_execute_code(args, ctx) -> ToolResult:
        handler_reached["n"] += 1
        raise AssertionError(
            "dispatch_tool let a non-whitelisted execute_code through the guard"
        )

    monkeypatch.setitem(_TOOL_REGISTRY, "execute_code", _sentinel_execute_code)
    monkeypatch.setitem(_TOOL_REGISTRY, "search_documents", _fake_search_documents)

    spawned: list[asyncio.Task] = []
    ctx = _make_workflow_ctx(
        run_id=run_id, pool=pool, redis=fake_redis,
        inputs={"kickoff_prompt": "CI whitelist kickoff."},
        spawned=spawned,
    )

    with patch.object(task_service, "open_stream", gw.open_stream), \
         patch.object(task_service, "get_pg_pool", _make_get_pool(pool)), \
         patch("app.config.get_model_capability_async", _fake_capability):
        await asyncio.wait_for(
            harness_engine.run_workflow(
                run_id, wf, ctx, pool=pool, redis=fake_redis
            ),
            timeout=30,
        )
    if spawned:
        await asyncio.wait_for(asyncio.gather(*spawned), timeout=30)

    # ── The refusal-shaped tool_result was fed back to the model ──────────────
    followups = [c for c in gw.calls if _call_has_tool_result(c)]
    assert followups, "the refusal must be fed back on a follow-up call"
    refusal_msgs = [
        m
        for c in followups
        for m in c["messages"]
        if m.get("role") == "tool"
    ]
    assert any(
        "tool_not_available_in_phase" in (m.get("content") or "")
        for m in refusal_msgs
    ), "the refusal tool_result must carry the dispatch_tool marker"
    assert any(
        "execute_code" in (m.get("content") or "") for m in refusal_msgs
    ), "the refusal must name the refused tool"

    # ── The guard fired BEFORE the registry handler (sentinel untouched) ──────
    assert handler_reached["n"] == 0, "the real handler must NEVER be reached"
    # ...and the refusal is audited (D-06 tool_refused, fire-and-forget flushed).
    refused = _audit_indices(pool.calls, "tool_refused")
    assert refused, "a tool_refused harness_audit row must be written"

    # ── No execute_code side-effect write: the ONLY pool rows mentioning the
    #    tool are the tool_refused audit INSERTs themselves ─────────────────────
    for sql, args in pool.calls:
        if not isinstance(sql, str):
            continue
        if any("execute_code" in str(a) for a in args):
            assert "INSERT INTO harness_audit" in sql, (
                f"unexpected execute_code side-effect write: {sql[:80]!r}"
            )

    # ── The phase did NOT crash — it completed and the run terminalized ───────
    active, completed = _phase_write_indices(pool.calls, phase_id)
    assert active and completed and active[0] < completed[0]
    assert _run_terminal_status(pool.calls, run_id) == "completed"


# ───────────────────────────────────────────────────────────────────────────────
# Test 4 — resume 2-phase writes: crash-leaves-active, sweep re-runs from the top
# ───────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_096_resume_two_phase_writes(
    mock_asyncpg_pool, fake_redis, build_workflow_definition, monkeypatch
):
    """Interrupt a run BETWEEN a phase's mark_phase_active and complete_phase
    (the fake's stream dies mid-phase after the active write), then sweep with
    the REAL ``resume_stranded_workflows``. Asserts: a SECOND mark_phase_active
    for the same phase (re-run from the top), no phase skipped, and the CAS
    claim write precedes the re-run (the test_harness_resume :417-476 claim
    contract)."""
    from app.services import harness_engine, task_service

    pool = mock_asyncpg_pool
    wf = build_workflow_definition(
        [
            {"slug": "one", "phase_index": 0,
             "config": {"phase_type": "llm_single",
                        "prompt": "CI-RESUME-ONE: do step one."}},
            {"slug": "two", "phase_index": 1,
             "config": {"phase_type": "llm_single",
                        "prompt": "CI-RESUME-TWO: do step two."}},
        ],
        slug="ci_resume",
        name="CI resume",
    )
    run_id = uuid.uuid4()
    p_one, p_two = uuid.uuid4(), uuid.uuid4()
    thread_id = uuid.uuid4()
    user_id = uuid.uuid4()

    state = {"crash_step_two": True}

    def route(request):
        sys_prompt = request.system_prompt
        if "CI-RESUME-ONE" in sys_prompt:
            return _final_events("step one done.")
        if "CI-RESUME-TWO" in sys_prompt:
            if state["crash_step_two"]:
                # Dies AFTER the engine's mark_phase_active write and BEFORE any
                # durable output — the exact crash-leaves-active window
                # (test_crash_leaves_phase_active_not_completed's contract).
                return (
                    [{"type": "delta", "content": "partial step two"}],
                    RuntimeError("simulated mid-phase crash"),
                )
            return _final_events("step two done after resume.")
        raise AssertionError(f"unexpected LLM call: {sys_prompt[:80]!r}")

    gw = ScriptedGateway(route, pool=pool)

    # SQL-aware fetch/fetchrow routing on the recording mock connection: the
    # sweep's reads (find_resumable_runs / claim_run / get_active_phase /
    # _load_run_definition) and the engine's load_run_phases share one pool, so
    # the sticky single-result fixture surface is not enough here.
    phase_rows = [
        {"id": p_one, "slug": "one", "phase_index": 0,
         "status": "pending", "output": {}},
        {"id": p_two, "slug": "two", "phase_index": 1,
         "status": "pending", "output": {}},
    ]
    run_rows: list[dict] = []

    async def _routed_fetch(sql, *args):
        pool.calls.append((sql, args))
        if "FROM workflow_runs wr" in sql:
            return [dict(r) for r in run_rows]
        if "FROM workflow_phases" in sql:
            return [dict(r) for r in phase_rows]
        return []

    async def _routed_fetchrow(sql, *args):
        pool.calls.append((sql, args))
        if "SET claimed_at = now()" in sql:
            return {"id": run_id}  # the lease CAS wins
        if "FROM workflow_phases" in sql and "status = 'active'" in sql:
            return dict(phase_rows[1])
        if "SELECT wd.definition" in sql:
            return {"definition": wf.model_dump(mode="json")}
        return None

    pool._conn.fetch = _routed_fetch
    pool._conn.fetchrow = _routed_fetchrow

    spawned: list[asyncio.Task] = []
    ctx = _make_workflow_ctx(
        run_id=run_id, pool=pool, redis=fake_redis,
        inputs={"kickoff_prompt": "CI resume kickoff."},
        spawned=spawned,
        thread_id=str(thread_id),
    )

    with patch.object(task_service, "open_stream", gw.open_stream), \
         patch.object(task_service, "get_pg_pool", _make_get_pool(pool)), \
         patch("app.config.get_model_capability_async", _fake_capability):
        # ── Part A: the crash — interrupted between p_two's active write and
        #    its complete write ────────────────────────────────────────────────
        with pytest.raises(RuntimeError, match="simulated mid-phase crash"):
            await asyncio.wait_for(
                harness_engine.run_workflow(
                    run_id, wf, ctx, pool=pool, redis=fake_redis
                ),
                timeout=30,
            )

        one_active, one_completed = _phase_write_indices(pool.calls, p_one)
        two_active, two_completed = _phase_write_indices(pool.calls, p_two)
        assert one_active and one_completed and one_active[0] < one_completed[0]
        assert len(two_active) == 1, "phase two was marked active before the work"
        assert not two_completed, (
            "a crashed phase must NEVER be marked completed (2-phase write)"
        )

        # ── Part B: seed the stranded state the sweep expects, heal the script,
        #    then run the REAL startup sweep against the same pool timeline ─────
        state["crash_step_two"] = False
        phase_rows[0] = {"id": p_one, "slug": "one", "phase_index": 0,
                         "status": "completed", "output": {"text": "step one done."}}
        phase_rows[1] = {"id": p_two, "slug": "two", "phase_index": 1,
                         "status": "active", "output": {}}
        run_rows.append(
            {"run_id": run_id, "thread_id": thread_id,
             "current_phase_id": p_two,
             "inputs": {"kickoff_prompt": "CI resume kickoff."},
             "user_id": user_id}
        )

        resumed = await asyncio.wait_for(
            harness_engine.resume_stranded_workflows(pool=pool, redis=fake_redis),
            timeout=30,
        )

    if spawned:
        await asyncio.wait_for(asyncio.gather(*spawned), timeout=30)

    assert resumed == 1, "the sweep must claim + re-run exactly this one run"

    # ── A SECOND mark_phase_active for the SAME phase: re-run from the top ────
    two_active, two_completed = _phase_write_indices(pool.calls, p_two)
    assert len(two_active) == 2, (
        "the swept run must re-mark the stranded phase active (re-run from top)"
    )
    assert two_completed and two_active[1] < two_completed[0], (
        "the re-run completes AFTER its second active write (2-phase order)"
    )

    # ── No phase skipped; the completed phase is NOT re-executed ──────────────
    assert not any(
        isinstance(sql, str) and "status='skipped'" in sql
        for sql, _args in pool.calls
    ), "resume must never skip a phase"
    step_one_calls = [
        c for c in gw.calls if "CI-RESUME-ONE" in c["system_prompt"]
    ]
    assert len(step_one_calls) == 1, (
        "the already-completed phase must NOT re-run (idempotent resume)"
    )

    # ── The CAS claim write precedes the re-run (lease CAS, not a status
    #    self-transition — the :417-476 claim contract) ────────────────────────
    claim_idx = [
        i for i, (sql, _args) in enumerate(pool.calls)
        if isinstance(sql, str) and "SET claimed_at = now()" in sql
    ]
    assert claim_idx, "no CAS claim write recorded"
    claim_sql = pool.calls[claim_idx[0]][0]
    assert "claimed_at IS NULL OR claimed_at <" in claim_sql, (
        "the claim must be the lease-expiry CAS predicate"
    )
    assert "SET status = 'active'" not in claim_sql, (
        "the claim must stamp the lease, not a no-op status self-transition"
    )
    assert claim_idx[0] < two_active[1], (
        "the CAS claim must precede the re-run's mark_phase_active"
    )

    # ── The resumed run terminalizes completed ────────────────────────────────
    assert _run_terminal_status(pool.calls, run_id) == "completed"
