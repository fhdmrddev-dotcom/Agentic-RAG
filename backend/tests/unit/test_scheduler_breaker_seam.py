"""The seam between 204-03's scheduler and 204-02's circuit breaker.

⚠ WHY THIS FILE EXISTS. Phase 204 shipped two plans in parallel waves. `204-03` wrote the
per-run spend caps into ``workflow_runs.inputs``; `204-02`'s ``load_run_budget`` read them
from the TOP LEVEL of ``workflow_runs.metadata``. ``scheduler_service.py`` contained zero
occurrences of the word ``metadata``. Both plans passed their own gates, both executors
correctly reported zero new failures, and **106 tests were green** — because each side
mocked the other and nothing crossed the seam.

It was found by driving a real scheduled run: `27e00e7e` (2026-08-24) ran **3m20s against a
120-second cap** with ``metadata`` NULL. Because ``load_run_budget`` FAILS OPEN, the breaker
disarmed silently and the run behaved exactly as if Phase 204 had never shipped — the
"built, gated, green, structurally unreachable" shape (Phase 200 SC#3, Phase 118).

So these tests deliberately do NOT mock the thing under test. Each one asserts a property
of the CONTRACT BETWEEN the two modules, not of either module alone:

  1. the writer's key names are exactly the reader's key names       (the defect itself)
  2. the caps are armed BEFORE the run is driven                     (the race)
  3. the write MERGES rather than replaces                           (trip must not clobber)
  4. a plain dict is bound, never ``json.dumps``                     (the jsonb string trap)
  5. the arming failure does not stop the launch                     (fail-open asymmetry)
"""

from __future__ import annotations

import ast
import inspect
import io
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
SCHEDULER = REPO / "app" / "services" / "scheduler_service.py"
DB_WORKFLOWS = REPO / "app" / "db" / "workflows.py"


def _src(p: Path) -> str:
    return io.open(p, encoding="utf-8").read()


# ══════════════════════════════════════════════════════════════════════════════════════
# 1. THE DEFECT ITSELF — the writer's keys must be the reader's keys.
# ══════════════════════════════════════════════════════════════════════════════════════
def test_the_budget_the_scheduler_writes_is_the_budget_the_breaker_reads():
    """The exact assertion that was false for the whole of Phase 204.

    ``load_run_budget`` reads ``meta.get(<key>)``. ``arm_run_budget`` writes a dict literal.
    If those two key sets ever diverge again the breaker disarms SILENTLY — no exception,
    no red test, just an unattended run with no ceiling. So compare them as SETS, derived
    from the source rather than restated here.
    """
    from app.db.workflows import arm_run_budget, load_run_budget

    reader = inspect.getsource(load_run_budget)
    writer = inspect.getsource(arm_run_budget)

    expected = {"max_tokens_per_run", "max_duration_seconds"}

    # The reader pulls each key off `meta` by name.
    read_keys = {k for k in expected if f'meta.get("{k}")' in reader}
    # The writer emits each key as a dict literal key.
    written_keys = {k for k in expected if f'"{k}":' in writer}

    assert read_keys == expected, (
        f"load_run_budget no longer reads {expected - read_keys} off metadata"
    )
    assert written_keys == expected, (
        f"arm_run_budget no longer writes {expected - written_keys}"
    )
    assert read_keys == written_keys


def test_the_breaker_reads_metadata_and_the_scheduler_therefore_writes_metadata():
    """The column, not just the keys. `inputs` is the AUTHOR's payload; caps are not.

    A future edit that "helpfully" moves the caps back into ``inputs`` re-creates the
    original defect exactly, and this is the test that would go red.
    """
    from app.db.workflows import arm_run_budget, load_run_budget

    assert "FROM workflow_runs" in inspect.getsource(load_run_budget)
    assert "metadata" in inspect.getsource(load_run_budget)
    assert "UPDATE workflow_runs" in inspect.getsource(arm_run_budget)
    assert "metadata" in inspect.getsource(arm_run_budget)

    # And the scheduler must actually CALL it — the module was silent on `metadata` before.
    #
    # ⚠ THIS ASSERTION USED TO BE `"arm_run_budget" in sched` AND THAT WAS WRONG, caught by
    # driving the counterfactual: deleting the whole call site left the IMPORT line behind,
    # the substring still matched, and this test stayed GREEN on code with the defect fully
    # restored. That is the 187-24 trap — a source scan reading a mention as a use — landing
    # in the very file written to catch a seam defect. It is an AST CALL walk now.
    calls = {
        n.func.id
        for n in ast.walk(ast.parse(_src(SCHEDULER)))
        if isinstance(n, ast.Call) and isinstance(n.func, ast.Name)
    }
    assert "arm_run_budget" in calls, (
        "scheduler_service.py does not CALL arm_run_budget (an import is not a use) — "
        "this is the original defect"
    )


# ══════════════════════════════════════════════════════════════════════════════════════
# 2. THE RACE — arming must precede driving.
# ══════════════════════════════════════════════════════════════════════════════════════
def test_the_budget_is_armed_before_the_run_is_driven():
    """The breaker resolves its budget once, when the engine starts the run.

    Arming afterwards is a race the engine usually WINS, which is the worst kind of bug:
    it passes a test and caps nothing in production. Asserted on the AST rather than on
    source order, so a comment mentioning either name cannot satisfy it (the 187-24 trap,
    which has fired repeatedly in this repo).
    """
    tree = ast.parse(_src(SCHEDULER))

    arm_line = drive_line = None
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        name = None
        if isinstance(node.func, ast.Name):
            name = node.func.id
        elif isinstance(node.func, ast.Attribute):
            name = node.func.attr
        if name == "arm_run_budget" and arm_line is None:
            arm_line = node.lineno
        if name == "_drive_run" and drive_line is None:
            drive_line = node.lineno

    assert arm_line is not None, "no arm_run_budget CALL (a comment does not count)"
    assert drive_line is not None, "no _drive_run CALL found"
    assert arm_line < drive_line, (
        f"arm_run_budget (line {arm_line}) must precede _drive_run (line {drive_line}) — "
        "otherwise the engine may resolve an empty budget and cap nothing"
    )


# ══════════════════════════════════════════════════════════════════════════════════════
# 3. MERGE, NOT REPLACE — the trip record must not clobber the budget that armed it.
# ══════════════════════════════════════════════════════════════════════════════════════
def test_arming_merges_into_metadata_and_coalesces_the_null():
    """``NULL || anything`` is NULL in Postgres.

    Without the COALESCE this writes nothing on every pre-125 row and reports success —
    the exact failure mode ``record_circuit_breaker_trip``'s docstring records. And without
    the ``||`` merge, a later trip record would erase the budget, or arming would erase a
    trip.
    """
    from app.db.workflows import arm_run_budget, record_circuit_breaker_trip

    for fn in (arm_run_budget, record_circuit_breaker_trip):
        src = inspect.getsource(fn)
        assert "COALESCE(metadata, '{}'::jsonb) ||" in src, (
            f"{fn.__name__} must COALESCE-then-merge, never assign metadata"
        )
        assert "SET metadata = " in src
        # A bare assignment (no merge) is the thing being forbidden.
        assert "SET metadata = $2" not in src


def test_the_two_writers_use_disjoint_top_level_keys():
    """The budget lives at the top level; a trip lives under its own single key.

    If they ever collided, arming a run would look like tripping it.
    """
    from app.db.workflows import arm_run_budget
    from app.services.circuit_breaker import TRIP_METADATA_KEY

    written = inspect.getsource(arm_run_budget)
    assert f'"{TRIP_METADATA_KEY}"' not in written, (
        "arm_run_budget must not write the trip key"
    )
    assert TRIP_METADATA_KEY not in {"max_tokens_per_run", "max_duration_seconds"}


# ══════════════════════════════════════════════════════════════════════════════════════
# 4. THE JSONB STRING-SCALAR TRAP — bind a dict, never a pre-encoded string.
# ══════════════════════════════════════════════════════════════════════════════════════
def test_arming_binds_a_plain_dict_and_never_pre_encodes():
    """The pool registers a jsonb codec, so ``json.dumps`` stores a STRING SCALAR.

    That defect shipped on 484 of 484 ``workflow_phases.output`` rows and needed migration
    123 to repair. Asserted with an AST walk, NOT a substring search: this module's prose
    discusses ``json.dumps`` at length, and a regex over the source reads those mentions
    and goes red on correct code (the 187-24 trap, recorded firing more than once here).
    """
    from app.db.workflows import arm_run_budget

    fn = ast.parse(inspect.getsource(arm_run_budget).lstrip()).body[0]

    dumps_calls = [
        n
        for n in ast.walk(fn)
        if isinstance(n, ast.Call)
        and isinstance(n.func, ast.Attribute)
        and n.func.attr == "dumps"
    ]
    assert not dumps_calls, (
        "arm_run_budget pre-encodes jsonb — the bound value would become a string scalar "
        "and every later arrow read would return NULL"
    )

    # Positive control: it really does bind a dict literal, so the check above is not
    # vacuously passing on a function that binds nothing at all.
    assert any(isinstance(n, ast.Dict) for n in ast.walk(fn)), (
        "no dict literal bound — this test would pass vacuously"
    )


# ══════════════════════════════════════════════════════════════════════════════════════
# 5. FAIL-OPEN ASYMMETRY — arming must not be able to stop a launch.
# ══════════════════════════════════════════════════════════════════════════════════════
@pytest.mark.asyncio
async def test_a_failed_arming_does_not_stop_the_run_from_launching():
    """An unapplied migration 125 must cost the CAP, never the RUN.

    Failing closed here would turn a database hiccup into "no scheduled workflow runs at
    all", which is the same argument ``load_run_budget`` and ``is_run_cancelled`` each make
    for their own fail-open. Driven against a pool that raises, rather than asserted from
    the source.
    """

    class _RaisingPool:
        async def execute(self, *_a, **_k):
            raise RuntimeError('column "metadata" does not exist')

    from app.db.workflows import arm_run_budget

    with pytest.raises(RuntimeError):
        await arm_run_budget(
            _RaisingPool(),
            "00000000-0000-0000-0000-000000000001",
            max_tokens_per_run=5000,
            max_duration_seconds=120,
        )

    # ...and the CALLER is what swallows it. The scheduler wraps the call in try/except
    # and logs at exception level; assert the guard exists around the call itself.
    tree = ast.parse(_src(SCHEDULER))
    guarded = False
    for node in ast.walk(tree):
        if not isinstance(node, ast.Try):
            continue
        for sub in ast.walk(node):
            if (
                isinstance(sub, ast.Call)
                and isinstance(sub.func, ast.Name)
                and sub.func.id == "arm_run_budget"
            ):
                guarded = True
    assert guarded, (
        "arm_run_budget must be called inside a try/except — an unapplied migration must "
        "disarm the cap, not block every scheduled launch"
    )


# ══════════════════════════════════════════════════════════════════════════════════════
# 6. A HALF-SET BUDGET ARMS EXACTLY ONE AXIS.
# ══════════════════════════════════════════════════════════════════════════════════════
@pytest.mark.asyncio
async def test_one_cap_set_and_one_absent_arms_exactly_one_axis():
    """``None`` is a real answer, not a zero. ``_positive_int`` reads it as "no ceiling"."""
    captured = {}

    class _CapturingPool:
        async def execute(self, _sql, _run_id, payload):
            captured.update(payload)

    from app.db.workflows import arm_run_budget

    await arm_run_budget(
        _CapturingPool(),
        "00000000-0000-0000-0000-000000000001",
        max_tokens_per_run=5000,
        max_duration_seconds=None,
    )
    assert captured["max_tokens_per_run"] == 5000
    assert captured["max_duration_seconds"] is None
