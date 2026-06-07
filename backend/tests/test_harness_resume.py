"""Phase 091 — HARNESS-03 resumability contracts.

2-phase write order + crash-leaves-active are flipped LIVE by Plan 02 (this
file); the startup sweep / claim / ask_user re-subscribe contracts by Plan 04.
Each remaining skip names its owning plan. One live structural assert keeps the
module non-trivial.
"""
from __future__ import annotations

import uuid

import pytest

from app.models.harness import WorkflowDefinition


def test_resume_module_uses_real_definition_shape(build_workflow_definition):
    """LIVE structural anchor — a resumable run is a real parsed WorkflowDefinition."""
    wf = build_workflow_definition.single_phase(
        {"phase_type": "llm_agent", "prompt": "x", "available_tools": ["search_documents"]}
    )
    assert isinstance(wf, WorkflowDefinition)
    assert wf.phases[0].phase_index == 0


def _active_completed_indices(calls):
    """Return (first active-UPDATE index, first completed-UPDATE index) over calls."""
    active_idx = completed_idx = None
    for i, (sql, _args) in enumerate(calls):
        if "status='active'" in sql and active_idx is None:
            active_idx = i
        if "status='completed'" in sql and completed_idx is None:
            completed_idx = i
    return active_idx, completed_idx


# ── HARNESS-03 2-phase write (Plan 02 — LIVE) ───────────────────────────────

@pytest.mark.asyncio
async def test_two_phase_write_active_before_completed(
    mock_asyncpg_pool, build_workflow_definition
):
    """active-UPDATE index < completed-UPDATE index in mock_asyncpg_pool.calls.

    Drives one phase through the engine with a stubbed executor and asserts the
    helper's two ordered atomic UPDATEs land in the right order on the pool.
    """
    from app.services import harness_engine

    wf = build_workflow_definition.single_phase(
        {"phase_type": "llm_single", "prompt": "Summarize."}
    )
    run_id = uuid.uuid4()
    phase_id = uuid.uuid4()
    # load_run_phases reads via pool.fetch → seed one pending phase row.
    mock_asyncpg_pool.set_fetch_result(
        [{"id": phase_id, "slug": "p0", "phase_index": 0, "status": "pending", "output": {}}]
    )

    async def _stub(phase, accumulated, ctx):
        return {"text": "done"}

    harness_engine.PHASE_TYPE_REGISTRY["llm_single"] = _stub
    try:
        ctx = type("C", (), {})()
        await harness_engine.run_workflow(
            run_id, wf, ctx, pool=mock_asyncpg_pool, redis=_NoopRedis()
        )
    finally:
        harness_engine.PHASE_TYPE_REGISTRY.pop("llm_single", None)

    active_idx, completed_idx = _active_completed_indices(mock_asyncpg_pool.calls)
    assert active_idx is not None, "no status='active' UPDATE recorded"
    assert completed_idx is not None, "no status='completed' UPDATE recorded"
    assert active_idx < completed_idx, "active must be written BEFORE completed"


@pytest.mark.asyncio
async def test_crash_leaves_phase_active_not_completed(
    mock_asyncpg_pool, build_workflow_definition
):
    """execute raising mid-phase → NO status='completed' UPDATE for that phase."""
    from app.services import harness_engine

    wf = build_workflow_definition.single_phase(
        {"phase_type": "llm_single", "prompt": "Summarize."}
    )
    run_id = uuid.uuid4()
    phase_id = uuid.uuid4()
    mock_asyncpg_pool.set_fetch_result(
        [{"id": phase_id, "slug": "p0", "phase_index": 0, "status": "pending", "output": {}}]
    )

    async def _boom(phase, accumulated, ctx):
        raise RuntimeError("phase blew up mid-work")

    harness_engine.PHASE_TYPE_REGISTRY["llm_single"] = _boom
    try:
        ctx = type("C", (), {})()
        with pytest.raises(RuntimeError):
            await harness_engine.run_workflow(
                run_id, wf, ctx, pool=mock_asyncpg_pool, redis=_NoopRedis()
            )
    finally:
        harness_engine.PHASE_TYPE_REGISTRY.pop("llm_single", None)

    active_idx, completed_idx = _active_completed_indices(mock_asyncpg_pool.calls)
    assert active_idx is not None, "phase should have been marked active first"
    assert completed_idx is None, "a crashed phase must NEVER be marked completed"


class _NoopRedis:
    """Minimal redis stand-in for the engine's _emit XADD (records nothing)."""

    async def xadd(self, *args, **kwargs):
        return "0-0"


# ── HARNESS-03 Plan 04 Task 1 — db/workflows resume queries (LIVE) ───────────

def _sql_for(calls, needle):
    """Return the first recorded SQL containing ``needle`` (or None)."""
    for sql, _args in calls:
        if needle in sql:
            return sql
    return None


@pytest.mark.asyncio
async def test_find_resumable_runs_anchors_on_thread_and_workflow_run_id(
    mock_asyncpg_pool,
):
    """find_resumable_runs uses the per-thread anchor + the workflow_run_id column.

    Asserts the SQL keys workflow_phases by ``workflow_run_id`` (NOT a bare
    ``run_id`` — Postgres 42703) and anchors on ``threads.active_workflow_run_id``.
    """
    from app.db import workflows

    run_id = uuid.uuid4()
    mock_asyncpg_pool.set_fetch_result(
        [{"run_id": run_id, "thread_id": uuid.uuid4(), "current_phase_id": None, "user_id": "u"}]
    )
    rows = await workflows.find_resumable_runs(mock_asyncpg_pool)
    assert rows and rows[0]["run_id"] == run_id

    sql = _sql_for(mock_asyncpg_pool.calls, "FROM workflow_runs wr")
    assert sql is not None
    assert "active_workflow_run_id = wr.id" in sql, "must anchor on the per-thread run"
    assert "wp.workflow_run_id = wr.id" in sql, "EXISTS join must use workflow_run_id"
    # No bare run_id predicate against workflow_phases (would raise 42703).
    assert "wp.run_id" not in sql


@pytest.mark.asyncio
async def test_get_active_phase_is_run_keyed_on_workflow_run_id(mock_asyncpg_pool):
    """get_active_phase reads workflow_phases keyed by workflow_run_id, status='active'."""
    from app.db import workflows

    phase_id = uuid.uuid4()
    mock_asyncpg_pool.set_fetchrow_result(
        {"id": phase_id, "slug": "p0", "phase_index": 0, "status": "active", "output": {}}
    )
    row = await workflows.get_active_phase(mock_asyncpg_pool, uuid.uuid4())
    assert row["id"] == phase_id and row["status"] == "active"

    sql = _sql_for(mock_asyncpg_pool.calls, "FROM workflow_phases")
    assert sql is not None
    assert "workflow_run_id = $1" in sql
    assert "status = 'active'" in sql


@pytest.mark.asyncio
async def test_ask_user_answered_vs_pending_query(mock_asyncpg_pool):
    """ask_user_response_exists scans role='system' RESPONSE rows by tool_call_id.

    answered → True (skip re-ask); pending → False (re-ask). Asserts the query
    distinguishes via the ask_user_response kind + tool_call_id, the /pending way.
    """
    from app.db import workflows

    run_id = uuid.uuid4()
    # Answered: EXISTS returns True.
    mock_asyncpg_pool.set_fetchval_result(True)
    assert await workflows.ask_user_response_exists(mock_asyncpg_pool, run_id, "tc1") is True
    # Pending: EXISTS returns False.
    mock_asyncpg_pool.set_fetchval_result(False)
    assert await workflows.ask_user_response_exists(mock_asyncpg_pool, run_id, "tc2") is False

    sql = _sql_for(mock_asyncpg_pool.calls, "ask_user_response")
    assert sql is not None
    assert "role = 'system'" in sql, "must scan system rows directly (NOT /snapshot)"
    assert "tool_call_id" in sql, "must key the response by tool_call_id"
    # WR-06 (091-08): run-scoped via a matching PROMPT row carrying run_id (the
    # response row stores no run_id) so a multi-run thread can't false-positive.
    assert "ask_user_prompt" in sql, "must join the prompt row that carries run_id"
    assert "->>'run_id' = $1::text" in sql, "must scope the prompt by THIS run_id"


@pytest.mark.asyncio
async def test_get_pending_ask_user_returns_prompt_payload(mock_asyncpg_pool):
    """get_pending_ask_user returns the durable prompt's payload for re-emit."""
    from app.db import workflows

    mock_asyncpg_pool.set_fetchrow_result(
        {
            "tool_calls": [
                {
                    "kind": "ask_user_prompt",
                    "tool_call_id": "tc9",
                    "prompt": "Pick one",
                    "options": ["a", "b"],
                    "timeout_seconds": 60,
                }
            ]
        }
    )
    payload = await workflows.get_pending_ask_user(mock_asyncpg_pool, uuid.uuid4())
    assert payload["tool_call_id"] == "tc9"
    assert payload["prompt"] == "Pick one"
    assert payload["options"] == ["a", "b"]
    assert payload["timeout_seconds"] == 60

    # WR-05 (091-08): the prompt query is run-scoped on the stored run_id so a
    # thread with multiple runs re-emits THIS run's prompt, not the newest one.
    sql = _sql_for(mock_asyncpg_pool.calls, "ask_user_prompt")
    assert sql is not None
    assert "->>'run_id' = $1::text" in sql, "prompt must be scoped by THIS run_id (WR-05)"


# ── HARNESS-03 Plan 04 Task 2 — resume_pending_prompt (LIVE) ─────────────────

@pytest.mark.asyncio
async def test_ask_user_pending_resubscribes_and_reemits(fake_redis):
    """Pending ask_user: re-SUBSCRIBE precedes re-emit XADD in fake_redis.events (Pitfall 2).

    Drives resume_pending_prompt with a fake_redis whose answer is enqueued, then
    asserts the unified event log shows subscribe → sadd → the ask_user_prompt
    XADD in that order (subscribe-before-emit — a fast answer can't be lost).
    """
    from app.services.ask_user_service import resume_pending_prompt

    run_id = uuid.uuid4()
    tcid = "tc-resume"
    # Enqueue the answer so the block returns instead of timing out.
    fake_redis.push_message(
        {"type": "message", "data": __import__("json").dumps(
            {"kind": "response", "response_text": "yes", "choice_index": None}
        )}
    )

    payload = await resume_pending_prompt(
        fake_redis, run_id, tcid, prompt="Continue?", options=["yes", "no"],
        timeout_seconds=5,
    )
    assert payload and payload.get("response_text") == "yes"

    # Pitfall 2: subscribe event index < the ask_user_prompt xadd event index.
    sub_idx = next(
        i for i, e in enumerate(fake_redis.events) if e[0] == "subscribe"
    )
    emit_idx = next(
        i for i, e in enumerate(fake_redis.events)
        if e[0] == "xadd" and "ask_user_prompt" in (e[2].get("data") or "")
    )
    assert sub_idx < emit_idx, "subscribe MUST precede the re-emit (Pitfall 2)"
    # The channels set is re-advertised (re-sadd) for cancel/shutdown sweeps.
    assert any(e[0] == "sadd" for e in fake_redis.events)


# ── HARNESS-03 Plan 04 Task 3 — startup sweep + answered-not-reasked (LIVE) ──

@pytest.mark.asyncio
async def test_sweep_reruns_active_phase(monkeypatch, fake_redis, mock_asyncpg_pool):
    """Startup sweep claims each stranded run, then re-runs it (idempotent claim).

    Stubs find_resumable_runs + claim_run + get_active_phase + run_workflow so the
    deterministic proof is offline: assert claim happens BEFORE the re-run, and a
    run whose claim LOSES (False) is never re-run (2-worker safety).

    092-07: the sweep now mints + terminalizes a producer-shell `runs` row per
    resumed run (Facet C) — so the run dicts carry valid UUID user_id and the
    sweep runs against the recording mock pool (insert_run/finalize_run execute).
    """
    from app.services import harness_engine

    order: list[str] = []
    won = uuid.uuid4()
    lost = uuid.uuid4()

    async def _find(pool):
        return [
            {"run_id": won, "thread_id": uuid.uuid4(), "current_phase_id": None, "user_id": uuid.uuid4()},
            {"run_id": lost, "thread_id": uuid.uuid4(), "current_phase_id": None, "user_id": uuid.uuid4()},
        ]

    async def _claim(pool, run_id, lease_seconds):
        order.append(f"claim:{run_id}")
        return run_id == won  # the loser worker's claim fails

    async def _active(pool, run_id):
        # A non-ask_user phase (no llm_human_input branch).
        return {"id": uuid.uuid4(), "slug": "p0", "phase_index": 0,
                "status": "active", "output": {}}

    async def _run(run_id, definition, ctx, *, pool, redis):
        order.append(f"run:{run_id}")

    monkeypatch.setattr(harness_engine, "find_resumable_runs", _find)
    monkeypatch.setattr(harness_engine, "claim_run", _claim)
    monkeypatch.setattr(harness_engine, "get_active_phase", _active)
    monkeypatch.setattr(harness_engine, "_resume_run", _run)

    async def _load_def(pool, run_id):
        # Truthy sentinel — the stubbed _resume_run ignores the definition, but
        # it must be non-None or the sweep's WR-02 missing-definition guard
        # skips the run before the redrive.
        return object()

    monkeypatch.setattr(harness_engine, "_load_run_definition", _load_def, raising=False)

    count = await harness_engine.resume_stranded_workflows(
        pool=mock_asyncpg_pool, redis=fake_redis
    )

    # Only the won run is re-run; the lost claim is skipped.
    assert count == 1
    assert f"claim:{won}" in order and f"run:{won}" in order
    assert f"run:{lost}" not in order
    # claim precedes run for the winner.
    assert order.index(f"claim:{won}") < order.index(f"run:{won}")


@pytest.mark.asyncio
async def test_ask_user_answered_not_reasked(monkeypatch, fake_redis, mock_asyncpg_pool):
    """A durably-answered ask_user prompt is NOT re-emitted on resume."""
    from app.services import harness_engine
    from app.models.harness import LlmHumanInputPhaseConfig  # noqa: F401  (shape doc)

    run_id = uuid.uuid4()

    async def _find(pool):
        return [{"run_id": run_id, "thread_id": uuid.uuid4(),
                 "current_phase_id": None, "user_id": uuid.uuid4()}]

    async def _claim(pool, run_id, lease_seconds):
        return True

    async def _active(pool, run_id):
        return {"id": uuid.uuid4(), "slug": "ask", "phase_index": 0,
                "status": "active", "output": {"tool_call_id": "tc-answered"},
                "config": {"phase_type": "llm_human_input"}}

    resume_called = {"n": 0}

    async def _resume_prompt(*a, **k):
        resume_called["n"] += 1
        return None

    async def _answered(pool, run_id, tool_call_id):
        return True  # durably answered

    async def _run(run_id, definition, ctx, *, pool, redis):
        return None

    monkeypatch.setattr(harness_engine, "find_resumable_runs", _find)
    monkeypatch.setattr(harness_engine, "claim_run", _claim)
    monkeypatch.setattr(harness_engine, "get_active_phase", _active)
    monkeypatch.setattr(harness_engine, "ask_user_response_exists", _answered)
    monkeypatch.setattr(harness_engine, "resume_pending_prompt", _resume_prompt)
    monkeypatch.setattr(harness_engine, "_resume_run", _run)

    async def _load_def(pool, run_id):
        # Truthy sentinel (see test_sweep_reruns_active_phase) — keeps the
        # sweep's WR-02 missing-definition guard from skipping the run.
        return object()

    monkeypatch.setattr(harness_engine, "_load_run_definition", _load_def, raising=False)

    await harness_engine.resume_stranded_workflows(
        pool=mock_asyncpg_pool, redis=fake_redis
    )
    assert resume_called["n"] == 0, "answered prompt must NOT be re-asked"


# ── CR-01 (091-08) — claim_run lease CAS: exactly-one-winner + expiry ─────────

class _LeasePool:
    """A fake pool that MODELS the claim_run lease CAS WHERE predicate.

    Holds a single ``workflow_runs`` row's (status, claimed_at) and applies the
    real CR-01 CAS semantics on ``fetchrow``: the UPDATE matches only when status
    is claimable AND (claimed_at is NULL OR older than the lease). The winner
    stamps ``now()``; a racing loser sees the fresh stamp and matches 0 rows.
    ``now`` is injectable so the expiry branch is deterministic (no real sleep).
    """

    def __init__(self, status="active", claimed_at=None, now=0.0):
        self.status = status
        self.claimed_at = claimed_at  # float epoch or None
        self._now = now

    def set_now(self, now):
        self._now = now

    async def fetchrow(self, sql, run_id, lease_seconds):
        # Model: WHERE status IN (active,paused) AND (claimed_at IS NULL OR
        #        claimed_at < now() - lease) ; SET claimed_at = now() RETURNING id.
        if self.status not in ("active", "paused"):
            return None
        expired = (
            self.claimed_at is None
            or self.claimed_at < (self._now - lease_seconds)
        )
        if not expired:
            return None
        self.claimed_at = self._now  # winner stamps the lease
        return {"id": run_id}


@pytest.mark.asyncio
async def test_claim_run_exactly_one_winner_under_concurrency():
    """Two claims racing the SAME stranded run → exactly ONE True (CR-01)."""
    from app.db.workflows import claim_run

    pool = _LeasePool(status="active", claimed_at=None, now=1000.0)
    run_id = uuid.uuid4()
    # Two workers race the same run with a 300s lease.
    first = await claim_run(pool, run_id, 300)
    second = await claim_run(pool, run_id, 300)
    assert first is True, "the first worker wins the claim"
    assert second is False, "the racing loser sees the fresh lease → 0 rows"
    assert (first, second).count(True) == 1, "exactly one winner"


@pytest.mark.asyncio
async def test_claim_run_reclaimable_after_lease_expires():
    """A crash-mid-resume run is re-claimable once the lease window passes (CR-01)."""
    from app.db.workflows import claim_run

    run_id = uuid.uuid4()
    pool = _LeasePool(status="active", claimed_at=None, now=1000.0)
    # Worker A claims (and then "crashes" — never finishes, status stays active).
    assert await claim_run(pool, run_id, 300) is True
    # A sibling racing immediately loses (lease still fresh).
    assert await claim_run(pool, run_id, 300) is False
    # Lease expires (now advances past claimed_at + 300s); the run re-claims.
    pool.set_now(1000.0 + 301)
    assert await claim_run(pool, run_id, 300) is True, (
        "an expired lease must be re-claimable (no permanent stranding)"
    )


@pytest.mark.asyncio
async def test_claim_run_sql_is_lease_cas_not_status_self_transition(mock_asyncpg_pool):
    """The claim SQL stamps claimed_at (lease CAS), NOT a no-op status self-transition."""
    from app.db.workflows import claim_run

    mock_asyncpg_pool.set_fetchrow_result({"id": uuid.uuid4()})
    await claim_run(mock_asyncpg_pool, uuid.uuid4(), 300)
    sql = _sql_for(mock_asyncpg_pool.calls, "UPDATE workflow_runs")
    assert sql is not None
    assert "SET claimed_at = now()" in sql, "must stamp the lease, not status"
    assert "claimed_at IS NULL OR claimed_at <" in sql, "lease-expiry predicate present"
    # The old no-op self-transition must be GONE.
    assert "SET status = 'active'" not in sql


# ── 092-07 — resume-ctx current_user["id"] is a str (asyncpg UUID coercion) ───
#
# REGRESSION (startup-sweep crash): on the LIVE path wf_ctx.current_user["id"]
# is the auth-dict STRING, so task_service.py:268 UUID(parent_ctx.current_user
# ["id"]) works. On the RESUME path the run dict's user_id is an asyncpg
# pgproto.UUID OBJECT — UUID(<UUID object>) raises AttributeError ('UUID' has
# no attr 'replace'). _build_resume_context MUST coerce to str so the resumed
# sub-agent insert (which re-wraps with UUID(...)) matches the live contract.
# This was invisible to the mock-pool tests above (their run dicts already use
# uuid.uuid4() objects but never round-tripped current_user["id"] through
# UUID() the way task_service does on the insert path).


@pytest.mark.asyncio
async def test_build_resume_context_current_user_id_is_str(mock_asyncpg_pool, fake_redis):
    """_build_resume_context coerces an asyncpg-UUID user_id to a str ctx field.

    Feeds a run whose user_id is a real UUID OBJECT (as asyncpg returns) and
    asserts the returned ctx.current_user["id"] is a `str` AND that
    UUID(ctx.current_user["id"]) succeeds — exactly the call task_service makes
    on the sub-agent insert (task_service.py:268). Guards the startup-sweep
    crash from silently regressing.
    """
    from app.services import harness_engine

    user_uuid_obj = uuid.uuid4()  # asyncpg returns pgproto.UUID *objects*, not str
    run = {
        "run_id": uuid.uuid4(),
        "thread_id": uuid.uuid4(),
        "user_id": user_uuid_obj,
        "current_phase_id": None,
    }

    ctx = await harness_engine._build_resume_context(run, fake_redis, mock_asyncpg_pool)

    assert isinstance(ctx.current_user["id"], str), (
        "resume ctx current_user['id'] MUST be a str (task_service re-wraps it "
        "with UUID(...) — UUID(<UUID object>) raises AttributeError)"
    )
    # The exact call task_service.py:268 makes — must not raise.
    assert uuid.UUID(ctx.current_user["id"]) == user_uuid_obj
    # thread_id is likewise a str (already coerced pre-092-07) — confirm no regress.
    assert isinstance(ctx.thread_id, str)
    assert uuid.UUID(ctx.thread_id) == run["thread_id"]


def test_continuation_ctx_sources_current_user_from_auth_dict_not_row():
    """/continue _harness_continuation uses the request auth dict (id already str).

    Confirms the continuation builder's `current_user` is sourced from the
    request `current_user` (FastAPI Depends(get_current_user) — id is a str),
    NOT from an asyncpg row, so it needs no str() coercion (unlike the resume
    path). A static-source assertion: the builder assigns `current_user=
    current_user` (the request param), and the only row-sourced UUID — the
    producer-shell insert — already guards `isinstance(current_user["id"], str)`.
    """
    import inspect
    from app.api import runs as runs_mod

    src = inspect.getsource(runs_mod.continue_run)
    # The continuation ctx reuses the request auth dict verbatim (str id).
    assert "current_user=current_user" in src, (
        "continuation ctx must reuse the request auth dict (id is already a str)"
    )
    # The one row-target UUID (producer-shell insert) defends against a UUID obj.
    assert 'isinstance(current_user["id"], str)' in src, (
        "producer-shell insert must guard the str-vs-UUID-object boundary"
    )
