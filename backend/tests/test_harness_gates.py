"""Phase 091 — HARNESS-04 validation-gate contracts (Wave-0 skeleton).

All gate execution (4 validator kinds, bounded retry, short-circuit,
skip_to_phase routing, step/wall-clock caps, fail_run-keeps-partial) is owned by
Plan 05. Each skip names Plan 05. One live assert pins the ValidatorSpec shape.
"""
from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest

from app.models.harness import ValidatorSpec


def test_gates_validator_spec_shape_is_live():
    """LIVE anchor — the 4 validator kinds parse and on_failure defaults to fail_run."""
    spec = ValidatorSpec.model_validate({"kind": "json_schema", "config": {"type": "object"}})
    assert spec.kind == "json_schema"
    assert spec.on_failure == "fail_run"
    assert spec.max_retries == 2
    for kind in ("json_schema", "regex_match", "workspace_file_exists", "programmatic"):
        assert ValidatorSpec.model_validate({"kind": kind}).kind == kind


def _phase_with(validators):
    """A minimal duck-typed phase carrying validators (run_gates reads .validators)."""
    specs = [ValidatorSpec.model_validate(v) for v in validators]
    return SimpleNamespace(slug="p0", validators=specs)


@pytest.mark.asyncio
async def test_each_of_4_validator_kinds_pass_and_fail(mock_asyncpg_pool):
    """json_schema / regex_match / workspace_file_exists / programmatic each pass + fail."""
    from app.services.harness.validators import (
        VALIDATOR_REGISTRY,
        GateResult,
        register_programmatic_validator,
        run_gates,
    )

    # All 4 kinds are registered.
    assert {"json_schema", "regex_match", "workspace_file_exists", "programmatic"} <= set(
        VALIDATOR_REGISTRY
    )

    ctx = SimpleNamespace(pool=mock_asyncpg_pool, thread_id="11111111-1111-1111-1111-111111111111")

    # ── json_schema ──────────────────────────────────────────────────────────
    schema = {"type": "object", "properties": {"text": {"type": "string", "minLength": 1}}, "required": ["text"]}
    js_pass = await run_gates(_phase_with([{"kind": "json_schema", "config": {"schema": schema}}]), {"text": "hello"}, ctx)
    assert js_pass.passed and js_pass.error_message is None
    js_fail = await run_gates(_phase_with([{"kind": "json_schema", "config": {"schema": schema}}]), {"text": ""}, ctx)
    assert js_fail.passed is False and js_fail.error_message  # descriptive jsonschema message

    # ── regex_match ──────────────────────────────────────────────────────────
    rx_pass = await run_gates(_phase_with([{"kind": "regex_match", "config": {"pattern": r"DONE"}}]), {"text": "all DONE here"}, ctx)
    assert rx_pass.passed
    rx_fail = await run_gates(_phase_with([{"kind": "regex_match", "config": {"pattern": r"DONE"}}]), {"text": "still going"}, ctx)
    assert rx_fail.passed is False and "did not match" in rx_fail.error_message

    # ── workspace_file_exists (mocked DB lookup via the recording pool) ──────
    mock_asyncpg_pool.set_fetchrow_result({"id": "f", "path": "report.md"})
    wf_pass = await run_gates(_phase_with([{"kind": "workspace_file_exists", "config": {"path": "report.md"}}]), {"text": "x"}, ctx)
    assert wf_pass.passed
    mock_asyncpg_pool.set_fetchrow_result(None)
    wf_fail = await run_gates(_phase_with([{"kind": "workspace_file_exists", "config": {"path": "missing.md"}}]), {"text": "x"}, ctx)
    assert wf_fail.passed is False and "does not exist" in wf_fail.error_message

    # ── programmatic (closed registry; unknown fn raises) ────────────────────
    @register_programmatic_validator("_test_nonempty")
    async def _nonempty(output, config, ctx):  # noqa: ARG001
        ok = bool((output.get("text") or "").strip())
        return GateResult(ok, None if ok else "output text is empty")

    pg_pass = await run_gates(_phase_with([{"kind": "programmatic", "config": {"fn": "_test_nonempty"}}]), {"text": "ok"}, ctx)
    assert pg_pass.passed
    pg_fail = await run_gates(_phase_with([{"kind": "programmatic", "config": {"fn": "_test_nonempty"}}]), {"text": "  "}, ctx)
    assert pg_fail.passed is False and pg_fail.error_message == "output text is empty"

    with pytest.raises(KeyError):
        await run_gates(_phase_with([{"kind": "programmatic", "config": {"fn": "_never_registered"}}]), {"text": "x"}, ctx)


@pytest.mark.asyncio
async def test_run_gates_returns_first_failure(mock_asyncpg_pool):
    """run_gates returns the FIRST failing GateResult; passes only if all pass."""
    from app.services.harness.validators import run_gates

    ctx = SimpleNamespace(pool=mock_asyncpg_pool, thread_id="t")
    # First gate passes, second fails → the second's failure is returned.
    phase = _phase_with(
        [
            {"kind": "regex_match", "config": {"pattern": r"a"}},
            {"kind": "regex_match", "config": {"pattern": r"ZZZ"}},
        ]
    )
    result = await run_gates(phase, {"text": "a b c"}, ctx)
    assert result.passed is False and "ZZZ" in result.error_message

    # No validators → pass.
    empty = await run_gates(SimpleNamespace(slug="p", validators=[]), {"text": "x"}, ctx)
    assert empty.passed and empty.error_message is None


# ════════════════════════════════════════════════════════════════════════════
# Bounded retry loop + on_failure routing + caps (engine integration, Plan 05)
# ════════════════════════════════════════════════════════════════════════════
import uuid as _uuid  # noqa: E402

from contextlib import contextmanager  # noqa: E402


@contextmanager
def _registry(**executors):
    """Temporarily install stub executors into the engine PHASE_TYPE_REGISTRY.

    The real executors call LLMs; these stubs return deterministic outputs so the
    gate/retry/routing control flow is tested in isolation. Restores the registry
    on exit so the live executors (Plan 03) aren't clobbered for other tests.
    """
    import app.services.harness_engine as eng

    saved = dict(eng.PHASE_TYPE_REGISTRY)
    eng.PHASE_TYPE_REGISTRY.clear()
    eng.PHASE_TYPE_REGISTRY.update(executors)
    try:
        yield eng
    finally:
        eng.PHASE_TYPE_REGISTRY.clear()
        eng.PHASE_TYPE_REGISTRY.update(saved)


def _rows(*specs):
    """Build phase rows the way load_run_phases returns them (status='pending')."""
    out = []
    for i, (slug, status) in enumerate(specs):
        out.append({"id": _uuid.uuid4(), "slug": slug, "phase_index": i, "status": status, "output": None})
    return out


def _audit_failures(pool):
    """Count gate_failed audit rows recorded on the mock pool."""
    return sum(
        1 for sql, args in pool.calls
        if "INSERT INTO harness_audit" in sql and len(args) >= 2 and args[1] == "gate_failed"
    )


def _emitted(redis, event_type):
    """All emitted SSE events of a given type (decoded)."""
    import json as _json
    out = []
    for stream, fields in redis.xadds:
        data = _json.loads(fields["data"])
        if data.get("type") == event_type:
            out.append(data)
    return out


@pytest.mark.asyncio
async def test_bounded_retry_reaches_failed_after_3_attempts(
    mock_asyncpg_pool, fake_redis, make_run_context, single_phase
):
    """An always-failing gate (max_retries=2) terminates in exactly 3 attempts — never loops."""
    from app.services.harness_engine import run_workflow

    run_id = _uuid.uuid4()
    rows = _rows(("p0", "pending"))
    mock_asyncpg_pool.set_fetch_result(rows)

    calls = {"n": 0}

    async def _failing_exec(phase, accumulated, ctx):
        calls["n"] += 1
        # Distinct output each call so the consecutive-identical SC does NOT fire
        # — we want to prove the HARD bound (3 attempts) independently.
        return {"text": f"attempt {calls['n']}"}

    # A regex gate that can never match → deterministically failing.
    defn = single_phase(
        {"phase_type": "llm_single", "prompt": "x"},
        validators=[{"kind": "regex_match", "config": {"pattern": r"NEVER_MATCHES_ZZZ"}, "on_failure": "fail_run"}],
    )
    ctx = make_run_context(retry_feedback=None, final_output=None)

    with _registry(llm_single=_failing_exec):
        await run_workflow(run_id, defn, ctx, pool=mock_asyncpg_pool, redis=fake_redis)

    assert calls["n"] == 3, "max_retries=2 → exactly 3 total attempts (HARD bound)"
    assert _audit_failures(mock_asyncpg_pool) == 3  # every attempt audited (D-08)
    assert len(_emitted(fake_redis, "gate_failed")) == 3  # every attempt emitted (D-08)
    # Terminal: the run is failed with a plain reason (D-07).
    run_failed = _emitted(fake_redis, "run_failed")
    assert len(run_failed) == 1 and "gate failed" in run_failed[0]["reason"]


@pytest.mark.asyncio
async def test_consecutive_identical_short_circuits(
    mock_asyncpg_pool, fake_redis, make_run_context, single_phase
):
    """Identical consecutive output short-circuits the retry loop (faster than the bound)."""
    from app.services.harness_engine import run_workflow

    run_id = _uuid.uuid4()
    mock_asyncpg_pool.set_fetch_result(_rows(("p0", "pending")))

    calls = {"n": 0}

    async def _identical_exec(phase, accumulated, ctx):
        calls["n"] += 1
        return {"text": "SAME OUTPUT"}  # identical every time

    defn = single_phase(
        {"phase_type": "llm_single", "prompt": "x"},
        validators=[{"kind": "regex_match", "config": {"pattern": r"ZZZ"}, "on_failure": "fail_run"}],
    )
    ctx = make_run_context(retry_feedback=None, final_output=None)

    with _registry(llm_single=_identical_exec):
        await run_workflow(run_id, defn, ctx, pool=mock_asyncpg_pool, redis=fake_redis)

    # First attempt fails; second attempt produces the SAME output → short-circuit
    # (retrying won't help). Two executions, not three.
    assert calls["n"] == 2
    assert len(_emitted(fake_redis, "run_failed")) == 1


@pytest.mark.asyncio
async def test_retry_feeds_error_into_prompt(
    mock_asyncpg_pool, fake_redis, make_run_context, single_phase
):
    """The validator error is fed back via ctx.retry_feedback (PRODUCER side, D-08)."""
    from app.services.harness_engine import run_workflow

    run_id = _uuid.uuid4()
    mock_asyncpg_pool.set_fetch_result(_rows(("p0", "pending")))

    seen_feedback = []

    async def _exec(phase, accumulated, ctx):
        # Capture what the PRODUCER set on ctx before each attempt (CONSUMER read).
        seen_feedback.append(getattr(ctx, "retry_feedback", None))
        return {"text": "still bad"}

    defn = single_phase(
        {"phase_type": "llm_single", "prompt": "x"},
        validators=[{"kind": "regex_match", "config": {"pattern": r"GOODGOOD"}, "on_failure": "fail_run"}],
    )
    ctx = make_run_context(retry_feedback=None, final_output=None)

    with _registry(llm_single=_exec):
        await run_workflow(run_id, defn, ctx, pool=mock_asyncpg_pool, redis=fake_redis)

    # First attempt: no feedback. Retry attempts: the validator error fed back.
    assert seen_feedback[0] is None
    assert any(
        f and "failed validation" in f for f in seen_feedback[1:]
    ), "validator error fed into ctx.retry_feedback on retry"


@pytest.mark.asyncio
async def test_skip_to_phase_routing(
    mock_asyncpg_pool, fake_redis, make_run_context, build_workflow_definition
):
    """on_failure='skip_to_phase:<slug>' routes to the named phase (D-9)."""
    from app.services.harness_engine import run_workflow

    run_id = _uuid.uuid4()
    # 3 phases: p0 (gate fails → skip to p2), p1 (should be SKIPPED), p2 (runs).
    rows = _rows(("p0", "pending"), ("p1", "pending"), ("p2", "pending"))
    mock_asyncpg_pool.set_fetch_result(rows)

    ran = []

    async def _exec(phase, accumulated, ctx):
        ran.append(phase.slug)
        return {"text": phase.slug}

    defn = build_workflow_definition(
        [
            {"slug": "p0", "phase_index": 0, "config": {"phase_type": "llm_single", "prompt": "a"},
             "validators": [{"kind": "regex_match", "config": {"pattern": r"ZZZ"},
                             "on_failure": "skip_to_phase:p2", "max_retries": 0}]},
            {"slug": "p1", "phase_index": 1, "config": {"phase_type": "llm_single", "prompt": "b"}},
            {"slug": "p2", "phase_index": 2, "config": {"phase_type": "llm_single", "prompt": "c"}},
        ]
    )
    ctx = make_run_context(retry_feedback=None, final_output=None)

    with _registry(llm_single=_exec):
        await run_workflow(run_id, defn, ctx, pool=mock_asyncpg_pool, redis=fake_redis)

    # p0 ran (and gate-failed), p1 was SKIPPED (never executed), p2 ran.
    assert "p0" in ran and "p1" not in ran and "p2" in ran
    # A skip_to_phase transition was emitted.
    transitions = _emitted(fake_redis, "phase_transition")
    assert any(t.get("via") == "skip_to_phase" and t.get("to_phase") == "p2" for t in transitions)
    # The run completed (the skip recovered it), not failed.
    assert len(_emitted(fake_redis, "run_completed")) == 1
    assert len(_emitted(fake_redis, "run_failed")) == 0


@pytest.mark.asyncio
async def test_caps_step_and_wall_clock(
    mock_asyncpg_pool, fake_redis, make_run_context, single_phase
):
    """Per-phase wall-clock cap (asyncio.wait_for) fails a hanging phase → on_failure (D-12)."""
    from app.services.harness_engine import run_workflow, _DEFAULT_PHASE_MAX_STEPS

    # The step cap default is sourced from Settings (Explorer=8) and enforced
    # inside the executor — assert the engine surfaces it (both caps present).
    assert _DEFAULT_PHASE_MAX_STEPS == 8

    run_id = _uuid.uuid4()
    mock_asyncpg_pool.set_fetch_result(_rows(("p0", "pending")))

    async def _hanging_exec(phase, accumulated, ctx):
        await asyncio.sleep(10)  # would hang far past the 0.05s wall-clock cap
        return {"text": "never"}

    # A tiny per-phase wall_clock_seconds override so the timeout fires instantly.
    defn = single_phase(
        {"phase_type": "llm_agent", "prompt": "x", "available_tools": [], "wall_clock_seconds": 1},
        validators=[{"kind": "regex_match", "config": {"pattern": r"ok"}, "on_failure": "fail_run"}],
    )
    # Patch the wall_clock to a sub-second value via a config attribute mutation is
    # not possible (frozen extra=forbid), so drive the timeout with a real sleep
    # against the 1s override — but to keep the test fast we shrink it by monkeypatch.
    import app.services.harness_engine as eng
    orig_wait_for = asyncio.wait_for

    async def _fast_wait_for(coro, timeout):
        return await orig_wait_for(coro, timeout=0.05)

    ctx = make_run_context(retry_feedback=None, final_output=None)
    with _registry(llm_agent=_hanging_exec):
        eng.asyncio.wait_for = _fast_wait_for
        try:
            await run_workflow(run_id, defn, ctx, pool=mock_asyncpg_pool, redis=fake_redis)
        finally:
            eng.asyncio.wait_for = orig_wait_for

    # The hanging phase timed out → gate_failed(wall_clock_timeout) → fail_run.
    gate_failed = _emitted(fake_redis, "gate_failed")
    assert any("wall_clock_timeout" in g.get("error", "") for g in gate_failed)
    assert len(_emitted(fake_redis, "run_failed")) == 1


@pytest.mark.asyncio
async def test_fail_run_keeps_partial_outputs(
    mock_asyncpg_pool, fake_redis, make_run_context, build_workflow_definition
):
    """fail_run keeps completed phases' outputs + a plain-language chat reason (D-07)."""
    from app.services.harness_engine import run_workflow

    run_id = _uuid.uuid4()
    rows = _rows(("p0", "pending"), ("p1", "pending"))
    mock_asyncpg_pool.set_fetch_result(rows)

    async def _exec(phase, accumulated, ctx):
        return {"text": phase.slug}

    # p0 has no gates (completes); p1's gate always fails → fail_run.
    defn = build_workflow_definition(
        [
            {"slug": "p0", "phase_index": 0, "config": {"phase_type": "llm_single", "prompt": "a"}},
            {"slug": "p1", "phase_index": 1, "config": {"phase_type": "llm_single", "prompt": "b"},
             "validators": [{"kind": "regex_match", "config": {"pattern": r"ZZZ"}, "on_failure": "fail_run", "max_retries": 0}]},
        ]
    )
    ctx = make_run_context(retry_feedback=None, final_output=None)

    with _registry(llm_single=_exec):
        await run_workflow(run_id, defn, ctx, pool=mock_asyncpg_pool, redis=fake_redis)

    # p0 was completed (its output durably written) BEFORE p1 failed the run — the
    # engine never deletes/rewrites completed-phase output on fail_run (D-07).
    completed = [
        args for sql, args in mock_asyncpg_pool.calls
        if "SET status='completed'" in sql
    ]
    assert len(completed) == 1, "p0 completed durably and is kept on fail_run"
    # finish_run('failed') + run_failed audit + emit with a plain reason.
    run_failed = _emitted(fake_redis, "run_failed")
    assert len(run_failed) == 1
    reason = run_failed[0]["reason"]
    assert "p1" in reason and "gate failed" in reason  # plain-language, names the phase
    # No run_completed (the run stopped at the failure).
    assert len(_emitted(fake_redis, "run_completed")) == 0


# ════════════════════════════════════════════════════════════════════════════
# WR-03 (091-08) — retry bound AND route derive from the SAME failing validator
# ════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_run_gates_threads_failing_validator_index():
    """run_gates stamps GateResult.validator_index with the FAILING validator's index."""
    from app.services.harness.validators import run_gates

    ctx = SimpleNamespace(pool=None, thread_id="t")
    # validator[0] passes (matches), validator[1] fails → index 1 is threaded back.
    phase = _phase_with(
        [
            {"kind": "regex_match", "config": {"pattern": r"a"}},
            {"kind": "regex_match", "config": {"pattern": r"ZZZ"}},
        ]
    )
    result = await run_gates(phase, {"text": "a only"}, ctx)
    assert result.passed is False
    assert result.validator_index == 1, "the SECOND (failing) validator's index"

    # All pass → validator_index is None.
    ok = await run_gates(
        _phase_with([{"kind": "regex_match", "config": {"pattern": r"a"}}]),
        {"text": "a"}, ctx,
    )
    assert ok.passed and ok.validator_index is None


@pytest.mark.asyncio
async def test_retry_bound_and_route_from_same_failing_validator(
    mock_asyncpg_pool, fake_redis, make_run_context, build_workflow_definition
):
    """A 2-validator phase: validator[0] (max_retries=2, fail_run) PASSES; validator[1]
    (max_retries=0, skip_to_phase:p2) FAILS → BOTH the bound (0 → no retries) AND the
    route (skip_to_phase) come from validator[1] — WR-03. Previously the bound came
    from validator[0] (2 retries) while the route came from validator[1]."""
    from app.services.harness_engine import run_workflow

    run_id = _uuid.uuid4()
    rows = _rows(("p0", "pending"), ("p1", "pending"), ("p2", "pending"))
    mock_asyncpg_pool.set_fetch_result(rows)

    runs = {"p0": 0}

    async def _exec(phase, accumulated, ctx):
        runs[phase.slug] = runs.get(phase.slug, 0) + 1
        return {"text": "MATCHME"}  # matches validator[0] /MATCHME/, fails validator[1]

    defn = build_workflow_definition(
        [
            {"slug": "p0", "phase_index": 0, "config": {"phase_type": "llm_single", "prompt": "a"},
             "validators": [
                 # validator[0]: PASSES (matches MATCHME), bound 2, would-be fail_run
                 {"kind": "regex_match", "config": {"pattern": r"MATCHME"},
                  "on_failure": "fail_run", "max_retries": 2},
                 # validator[1]: FAILS, bound 0 (no retries), routes skip_to_phase:p2
                 {"kind": "regex_match", "config": {"pattern": r"NEVER_ZZZ"},
                  "on_failure": "skip_to_phase:p2", "max_retries": 0},
             ]},
            {"slug": "p1", "phase_index": 1, "config": {"phase_type": "llm_single", "prompt": "b"}},
            {"slug": "p2", "phase_index": 2, "config": {"phase_type": "llm_single", "prompt": "c"}},
        ]
    )
    ctx = make_run_context(retry_feedback=None, final_output=None)

    with _registry(llm_single=_exec):
        await run_workflow(run_id, defn, ctx, pool=mock_asyncpg_pool, redis=fake_redis)

    # Bound from validator[1] (max_retries=0) → p0 ran exactly ONCE (no retries),
    # NOT 3 times (which validator[0]'s bound of 2 would have allowed).
    assert runs["p0"] == 1, "retry bound must come from the FAILING validator (0 retries)"
    # Route from validator[1] (skip_to_phase:p2): p1 skipped, p2 ran.
    assert "p1" not in runs and runs.get("p2") == 1
    transitions = _emitted(fake_redis, "phase_transition")
    assert any(t.get("via") == "skip_to_phase" and t.get("to_phase") == "p2" for t in transitions)
    assert len(_emitted(fake_redis, "run_completed")) == 1  # skip recovered the run
