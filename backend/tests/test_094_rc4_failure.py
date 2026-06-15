"""Phase 094 Plan 04 — INV-3a: the BACKEND half of the RC-4 honesty contract.

Before this plan, a harness run that fails emitted ``run_failed`` and returned
from ``run_workflow`` WITHOUT persisting any assistant ``messages`` row — so a
later reconcile read a terminal run with empty content and rendered it as a
silent "done" card instead of a failure-with-a-reason (the RC-4 trust bug).

Plan 04 adds ``_surface_failure_message(ctx, run_id, reason, pool)`` (a strict
subset of ``_surface_final_answer``'s persist block), called from BOTH of
``run_workflow``'s harness-only failure-return sites:

  site #1  ``fail_run`` outcome                         (before ``return``)
  site #2  ``skip_to_phase`` missing-target runtime guard (before ``return``)

The invariants (driving ``run_workflow`` to each failure-return site via the
shared harness conftest fixtures — ``build_workflow_definition``,
``mock_asyncpg_pool``, ``fake_redis``, ``make_run_context``):

  INV-3a-1  a ``fail_run`` outcome persists an assistant ``messages`` row whose
            content IS the failure reason (NOT empty, NOT a ``done`` card).
  INV-3a-2  the missing-skip-target runtime guard ALSO persists a failure row
            (the second return site the CONTEXT's single "~699-709" anchor
            misses — both sites need the fix).
  INV-3a-3  the empty-reason case (``reason == ""``) persists the
            ``reason_unknown`` sentinel content, never an empty assistant row.
  INV-3a-4  ``_shielded_finalize`` is NOT in the call path of the new helper —
            the helper lives inside ``harness_engine.py`` and is called ONLY
            from the two harness-only failure branches, so the shared
            Deep+harness terminal path stays byte-identical (D-14 / Pitfall 2).

The persist is owner-scoped (``ctx.current_user["id"]`` + ``ctx.thread_id``,
identical to the proven ``_surface_final_answer`` success path) — no IDOR.
"""
from __future__ import annotations

import uuid as _uuid
from contextlib import contextmanager

import pytest

# The reason_unknown sentinel — verbatim from the UI-SPEC Copywriting Contract.
SENTINEL = (
    "Failure reason not captured by the backend — surfaced explicitly so the "
    "run is never shown as an empty success."
)


# ── helpers (mirror the gate-test harness in test_harness_gates.py) ──────────


@contextmanager
def _registry(**executors):
    """Temporarily install stub executors into the engine PHASE_TYPE_REGISTRY.

    Pollution-safe: ``import app.services.harness`` (idempotent — module-cached)
    triggers ``register_all()`` so the 5 REAL executors are present BEFORE we
    snapshot. Restoring the snapshot on exit therefore puts the real executors
    back — a later ``test_phase_dispatch_routes_each_of_5_types`` (which asserts
    the registry holds exactly the 5 real types) is not clobbered by this test.
    """
    import app.services.harness  # noqa: F401 — ensure register_all() ran first
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
    """Build phase rows the way load_run_phases returns them."""
    out = []
    for i, (slug, status) in enumerate(specs):
        out.append(
            {"id": _uuid.uuid4(), "slug": slug, "phase_index": i, "status": status, "output": None}
        )
    return out


def _inserted_messages(pool):
    """Every ``INSERT INTO messages`` call recorded on the mock pool, as (sql, args)."""
    return [
        (sql, args)
        for sql, args in pool.calls
        if "INSERT INTO messages" in sql
    ]


def _message_contents(pool):
    """The ``content`` ($3) of each persisted assistant messages row, in order.

    ``insert_assistant_message`` issues ``INSERT INTO messages (... content ...)
    VALUES ($1, $2, 'assistant', $3, ...)`` → args[2] is the content.
    """
    return [args[2] for sql, args in _inserted_messages(pool)]


# ── INV-3a-1: fail_run persists a failure message = the reason ───────────────


@pytest.mark.asyncio
async def test_rc4_fail_run_persists_failure_message(
    mock_asyncpg_pool, fake_redis, make_run_context, single_phase
):
    """INV-3a-1: a fail_run outcome persists an assistant messages row = the reason."""
    from app.services.harness_engine import run_workflow

    run_id = _uuid.uuid4()
    mock_asyncpg_pool.set_fetch_result(_rows(("p0", "pending")))

    async def _exec(phase, accumulated, ctx):
        return {"text": "bad output"}

    # A regex gate that can never match → fail_run with a plain reason.
    defn = single_phase(
        {"phase_type": "llm_single", "prompt": "x"},
        validators=[
            {"kind": "regex_match", "config": {"pattern": r"NEVER_MATCHES_ZZZ"},
             "on_failure": "fail_run", "max_retries": 0}
        ],
    )
    # current_user is what the owner-scoped persist reads (ctx.current_user["id"]).
    ctx = make_run_context(
        current_user={"id": "00000000-0000-0000-0000-000000000001"},
        retry_feedback=None,
        final_output=None,
    )

    with _registry(llm_single=_exec):
        await run_workflow(run_id, defn, ctx, pool=mock_asyncpg_pool, redis=fake_redis)

    contents = _message_contents(mock_asyncpg_pool)
    assert len(contents) == 1, "exactly one assistant failure message persisted"
    # The persisted content IS the failure reason — not empty, not a done card.
    assert contents[0]
    assert "gate failed" in contents[0]
    assert contents[0] != ""


# ── INV-3a-2: the missing-skip-target runtime guard ALSO persists ────────────


@pytest.mark.asyncio
async def test_rc4_missing_skip_target_persists_failure_message(
    mock_asyncpg_pool, fake_redis, make_run_context, build_workflow_definition
):
    """INV-3a-2: the skip_to_phase missing-target guard ALSO persists a failure row."""
    from app.services.harness_engine import run_workflow

    run_id = _uuid.uuid4()
    # Single phase p0 whose gate fails and routes skip_to_phase:<does-not-exist>.
    mock_asyncpg_pool.set_fetch_result(_rows(("p0", "pending")))

    async def _exec(phase, accumulated, ctx):
        return {"text": "MATCHME"}

    defn = build_workflow_definition(
        [
            {"slug": "p0", "phase_index": 0,
             "config": {"phase_type": "llm_single", "prompt": "a"},
             "validators": [
                 {"kind": "regex_match", "config": {"pattern": r"NEVER_ZZZ"},
                  "on_failure": "skip_to_phase:ghost_phase", "max_retries": 0}
             ]},
        ]
    )
    ctx = make_run_context(
        current_user={"id": "00000000-0000-0000-0000-000000000001"},
        retry_feedback=None,
        final_output=None,
    )

    with _registry(llm_single=_exec):
        await run_workflow(run_id, defn, ctx, pool=mock_asyncpg_pool, redis=fake_redis)

    contents = _message_contents(mock_asyncpg_pool)
    assert len(contents) == 1, "the missing-skip-target guard persists a failure row too"
    assert "ghost_phase" in contents[0], "the persisted content names the missing skip target"
    assert "does not exist" in contents[0]


# ── INV-3a-3: empty reason → the reason_unknown sentinel (never empty) ───────


@pytest.mark.asyncio
async def test_rc4_empty_reason_persists_sentinel(
    mock_asyncpg_pool, fake_redis, make_run_context, single_phase, monkeypatch
):
    """INV-3a-3: an empty failure reason persists the reason_unknown sentinel."""
    import app.services.harness_engine as eng
    from app.services.harness_engine import run_workflow

    run_id = _uuid.uuid4()
    mock_asyncpg_pool.set_fetch_result(_rows(("p0", "pending")))

    async def _exec(phase, accumulated, ctx):
        return {"text": "bad"}

    # Force the fail_run outcome to carry an EMPTY reason: stub the phase runner
    # so the gate path yields a fail_run with reason == "".
    from app.services.harness_engine import PhaseOutcome

    async def _fake_run_phase_with_gates(*args, **kwargs):
        return PhaseOutcome("fail_run", None, None, "")

    monkeypatch.setattr(eng, "_run_phase_with_gates", _fake_run_phase_with_gates)

    defn = single_phase({"phase_type": "llm_single", "prompt": "x"})
    ctx = make_run_context(
        current_user={"id": "00000000-0000-0000-0000-000000000001"},
        retry_feedback=None,
        final_output=None,
    )

    with _registry(llm_single=_exec):
        await run_workflow(run_id, defn, ctx, pool=mock_asyncpg_pool, redis=fake_redis)

    contents = _message_contents(mock_asyncpg_pool)
    assert len(contents) == 1, "an empty reason still persists exactly one row"
    assert contents[0] == SENTINEL, "the reason_unknown sentinel, never empty content"
    assert contents[0] != ""


# ── INV-3a-4: the helper is NOT in the _shielded_finalize call path (D-14) ───


@pytest.mark.asyncio
async def test_rc4_helper_does_not_touch_shielded_finalize(
    mock_asyncpg_pool, fake_redis, make_run_context, single_phase
):
    """INV-3a-4: the failure helper is NOT in the _shielded_finalize call path (D-14).

    The shared Deep+harness terminal path (``_shielded_finalize`` — a closure in
    ``app.api.threads`` driven by the agent runner) must stay byte-identical: the
    new ``_surface_failure_message`` is invoked ONLY from ``run_workflow``'s two
    harness-only failure branches, never the shared finalize.

    We prove it three ways:
      (a) ``run_workflow`` (driven directly here, NOT via the threads.py agent
          runner) persists the failure message itself — exactly one row — so the
          persist owner is ``run_workflow``, not the shared finalize;
      (b) the helper's own source never references ``_shielded_finalize``;
      (c) the helper is a module-level symbol in ``harness_engine`` (the
          harness-only home), not anything in the shared terminal path.
    """
    import inspect

    import app.services.harness_engine as eng
    from app.services.harness_engine import run_workflow

    # (c) The helper exists, in the harness-only module.
    assert hasattr(eng, "_surface_failure_message"), (
        "the failure helper lives in harness_engine.py (harness-only home)"
    )

    run_id = _uuid.uuid4()
    mock_asyncpg_pool.set_fetch_result(_rows(("p0", "pending")))

    async def _exec(phase, accumulated, ctx):
        return {"text": "bad output"}

    defn = single_phase(
        {"phase_type": "llm_single", "prompt": "x"},
        validators=[
            {"kind": "regex_match", "config": {"pattern": r"NEVER_MATCHES_ZZZ"},
             "on_failure": "fail_run", "max_retries": 0}
        ],
    )
    ctx = make_run_context(
        current_user={"id": "00000000-0000-0000-0000-000000000001"},
        retry_feedback=None,
        final_output=None,
    )

    with _registry(llm_single=_exec):
        await run_workflow(run_id, defn, ctx, pool=mock_asyncpg_pool, redis=fake_redis)

    # (a) run_workflow persisted the failure itself (one row) — no shared finalize.
    assert len(_message_contents(mock_asyncpg_pool)) == 1

    # (b) The helper's CODE never references the shared terminal path. We AST-parse
    #     the helper, drop the docstring node (which legitimately NAMES
    #     _shielded_finalize in its guard note), and assert NO executable
    #     Name/Attribute node references it (a call/route would show up as one).
    import ast
    import textwrap

    tree = ast.parse(textwrap.dedent(inspect.getsource(eng._surface_failure_message)))
    fn = tree.body[0]
    # Strip the leading docstring statement so its prose doesn't count as code.
    if (
        fn.body
        and isinstance(fn.body[0], ast.Expr)
        and isinstance(getattr(fn.body[0], "value", None), ast.Constant)
        and isinstance(fn.body[0].value.value, str)
    ):
        code_nodes = fn.body[1:]
    else:
        code_nodes = fn.body
    referenced = {
        n.id
        for stmt in code_nodes
        for n in ast.walk(stmt)
        if isinstance(n, ast.Name)
    } | {
        n.attr
        for stmt in code_nodes
        for n in ast.walk(stmt)
        if isinstance(n, ast.Attribute)
    }
    assert "_shielded_finalize" not in referenced, (
        "the helper's code must not call/route through the shared _shielded_finalize"
    )
