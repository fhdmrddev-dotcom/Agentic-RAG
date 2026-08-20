"""Phase 200.1 / plan 01 — the `workflow_phases.output` shape contract.

WHY THIS FILE EXISTS. `declared_phase_measure` opened with
`if not isinstance(raw, dict): return None, None`, and the column it reads is a jsonb
**STRING SCALAR** on 484 of 484 `completed` rows (measured against the live local DB on
2026-08-20 — 527 of 588 non-null values overall). The declared per-step count was built,
gated, green and reached NOBODY, because the degradation is silent and the absent-arm
render is HONEST. A green suite is exactly the evidence that was already available when
the defect shipped, so this file's job is to hold the two halves of the repair:

  1. the read-side unwrap contract, INCLUDING a driven counterfactual that reproduces the
     old behaviour after the source is fixed — a fence that was never driven RED is a
     fence that could not fire; and
  2. the writer fence (Task 2), which proves new rows land as jsonb OBJECTS and that the
     SQL literals moved not one byte.

⚠ THE COUNTERFACTUAL IS A LOCAL RE-STATEMENT OF THE OLD GUARD, never an import of it.
Asserting against the shipped function post-fix would assert the fix against itself.
"""

import ast
import asyncio
import inspect
import json
import os
import re
import subprocess
import textwrap
from pathlib import Path

import asyncpg
import pytest
import pytest_asyncio

from app.db.workflows import complete_phase, create_workflow_run, fail_phase, record_phase_not_sent
from app.dependencies import _init_pg_connection
from app.models.thread import declared_phase_measure, phase_output_object

# The commit this plan was dispatched against. The SQL byte-identity fences below diff the
# shipped literals against THIS revision, so "only the parameter moved" is proved rather
# than claimed.
PLAN_BASE_SHA = "4ffae459cb853ed6330ad02b9deb898484fe3ea9"

REPO_ROOT = Path(__file__).resolve().parents[3]


def _blob_at_base(rel_path: str) -> str:
    """A tracked file's contents at the plan's base commit."""
    return subprocess.run(
        ["git", "show", f"{PLAN_BASE_SHA}:{rel_path}"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=True,
    ).stdout


# ── the fixture the whole plan turns on ────────────────────────────────────────────────
# A real `_measure` payload, in the shape the executors write it, encoded exactly the way
# the double-encoding defect encodes it: a JSON *string* whose text is the JSON object.
MEASURE_OBJECT = {"_measure": {"count": 15, "noun": "sources"}, "text": "…"}
MEASURE_STRING_SCALAR = json.dumps(MEASURE_OBJECT)


# ═══════════════════════════════════════════════════════════════════════════════════════
# 1. THE UNWRAP CONTRACT
# ═══════════════════════════════════════════════════════════════════════════════════════

def test_dict_passes_through_unchanged():
    """The 61 `pending`/`cancelled`/`skipped` rows already carry objects. Identity, not a copy."""
    assert phase_output_object(MEASURE_OBJECT) is MEASURE_OBJECT


def test_string_scalar_is_parsed_to_its_object():
    assert phase_output_object(MEASURE_STRING_SCALAR) == MEASURE_OBJECT


def test_none_yields_none():
    assert phase_output_object(None) is None


# ⚠ FOUR MALFORMED INPUTS, ASSERTED INDIVIDUALLY (T-200.1-01). This function is a PARSER on
# a boundary that previously carried only an `isinstance` test, and it reads content a model
# influenced. A parser that raises here 500s the run page for that run's owner.
def test_unparseable_string_degrades_to_none():
    assert phase_output_object("not json") is None


def test_json_array_is_not_an_object():
    assert phase_output_object(json.dumps([1, 2])) is None


def test_json_string_is_not_an_object():
    """A doubly-encoded string scalar whose payload is itself a bare string."""
    assert phase_output_object(json.dumps("a string")) is None


def test_non_str_non_dict_yields_none():
    assert phase_output_object(12) is None


@pytest.mark.parametrize(
    "malformed",
    ["not json", json.dumps([1, 2]), json.dumps("a string"), json.dumps(None), 12, 3.5, True, b"{}"],
)
def test_never_raises_on_anything(malformed):
    """No `pytest.raises` anywhere in this file — the contract is that it CANNOT raise."""
    assert phase_output_object(malformed) is None


# ═══════════════════════════════════════════════════════════════════════════════════════
# 2. THE REPAIR, AND THE DRIVEN COUNTERFACTUAL
# ═══════════════════════════════════════════════════════════════════════════════════════

def test_declared_measure_now_reads_a_string_scalar_row():
    """THE REPAIR. This is the assertion the whole plan exists for."""
    assert declared_phase_measure(MEASURE_STRING_SCALAR) == (15, "sources")


def _shipped_pre_change_guard(raw: object) -> tuple[int | None, str | None]:
    """The SHIPPED pre-change predicate, re-stated locally so it keeps reproducing.

    Verbatim from `models/thread.py` at the plan's base commit:

        if not isinstance(raw, dict):
            return None, None

    ⚠ It is re-stated rather than imported BECAUSE the source is now fixed. A counterfactual
    that calls the repaired function would assert the fix against itself and pass forever.
    """
    if not isinstance(raw, dict):
        return None, None
    measure = raw.get("_measure")
    if not isinstance(measure, dict):
        return None, None
    count = measure.get("count")
    noun = measure.get("noun")
    if not isinstance(count, int) or isinstance(count, bool):
        return None, None
    if not isinstance(noun, str) or not noun:
        return None, None
    return count, noun


def test_counterfactual_the_old_guard_loses_the_measure_silently():
    """⚠ THE DEFECT, DRIVEN. Same input, old guard: `(None, None)` — AND NO EXCEPTION.

    The silence is the whole finding. Nothing logged, nothing raised, and D-07's absent arm
    renders honestly, so no test and no eye could catch it.
    """
    assert _shipped_pre_change_guard(MEASURE_STRING_SCALAR) == (None, None)


def test_counterfactual_agrees_with_the_repair_on_the_object_shape():
    """POSITIVE CONTROL for the counterfactual: it is the real old guard, not a stub that
    always returns `(None, None)`. On the object shape the two agree exactly."""
    assert _shipped_pre_change_guard(MEASURE_OBJECT) == (15, "sources")
    assert declared_phase_measure(MEASURE_OBJECT) == (15, "sources")


# ═══════════════════════════════════════════════════════════════════════════════════════
# 3. WHAT MUST NOT HAVE MOVED
# ═══════════════════════════════════════════════════════════════════════════════════════

def test_the_honest_zero_survives_the_unwrap():
    """`0` is a real measurement of nothing; `None` is "this type declares no count"."""
    raw = json.dumps({"_measure": {"count": 0, "noun": "sources"}})
    assert declared_phase_measure(raw) == (0, "sources")


def test_bool_is_still_excluded_through_the_unwrap():
    """`bool` subclasses `int`; a stray `{"count": true}` would otherwise serialize as `1`."""
    raw = json.dumps({"_measure": {"count": True, "noun": "sources"}})
    assert declared_phase_measure(raw) == (None, None)


def test_empty_noun_is_still_rejected_through_the_unwrap():
    raw = json.dumps({"_measure": {"count": 3, "noun": ""}})
    assert declared_phase_measure(raw) == (None, None)


def test_missing_measure_key_still_yields_the_pair_of_nones():
    assert declared_phase_measure(json.dumps({"text": "no measure here"})) == (None, None)


def test_the_dict_path_is_unregressed():
    """The 61 object-shaped rows must be entirely unaffected by this change."""
    assert declared_phase_measure(MEASURE_OBJECT) == (15, "sources")
    assert declared_phase_measure({"_measure": {"count": 0, "noun": "fields"}}) == (0, "fields")
    assert declared_phase_measure({}) == (None, None)


def test_declared_phase_measure_tail_is_byte_identical_to_the_base_commit():
    """⚠ ASSERTED, NOT CLAIMED. Everything from the `_measure` dict guard downward — the
    `isinstance(count, int) and not isinstance(count, bool)` test, the non-empty `noun` test
    and the `(0, "sources")` vs `(None, None)` distinction — is unchanged byte for byte.
    Only the opening guard became an unwrap.
    """
    anchor = "    if not isinstance(measure, dict):"

    def tail(source: str) -> str:
        body = source[source.index("def declared_phase_measure"):]
        # stop at the next top-level definition
        end = body.index("\nclass ")
        return body[body.index(anchor):end]

    base = _blob_at_base("backend/app/models/thread.py")
    now = (REPO_ROOT / "backend/app/models/thread.py").read_text(encoding="utf-8")

    assert anchor in base, "positive control: the anchor must exist at the base commit"
    # ⚠ NON-VACUITY BEFORE CONTENTS. Two empty slices compare equal and prove nothing; this
    # repo has shipped exactly that fence before. Measured: 312 chars on both sides.
    assert len(tail(base)) > 200, "the base tail must be a real slice, not an empty one"
    assert tail(now) == tail(base)


def test_the_old_guard_literal_is_gone_from_the_function():
    """The repair landed in the shipped source, not only in this file's expectations."""
    src = inspect.getsource(declared_phase_measure)
    assert "phase_output_object(" in src
    # ⚠ COMMENT/DOCSTRING-STRIPPED: the docblock legitimately QUOTES the old guard while
    # explaining it, and a naive `in` check would read that quotation as the live code.
    code = src[src.index('"""', src.index('"""') + 3) + 3:]
    assert "if not isinstance(raw, dict)" not in code


def test_the_module_does_not_spell_the_forbidden_form_in_its_own_prose():
    """⚠ THE 187-24 TRAP, GUARDED. A NAIVE grep over the whole module must read ZERO.

    `toolNames.ts` read `3` where its guard required `0` — every hit a comment. A docblock that
    QUOTES the pre-change predicate makes the acceptance grep count the module's own prose and
    report a fix that landed as a fix that did not. `models/thread.py` therefore DESCRIBES the
    old guard and never spells it; the verbatim form lives here, in `_shipped_pre_change_guard`.
    """
    source = (REPO_ROOT / "backend/app/models/thread.py").read_text(encoding="utf-8")
    assert source.count("if not isinstance(raw, dict)") == 0
    # POSITIVE CONTROL: the pattern is a real one that DID appear — proved against the base blob,
    # so a typo in the needle cannot make this fence pass vacuously.
    assert _blob_at_base("backend/app/models/thread.py").count("if not isinstance(raw, dict)") == 1


def test_there_is_exactly_one_read_side_home():
    """One `phase_output_object`, defined once, in the module that already owns the read."""
    source = (REPO_ROOT / "backend/app/models/thread.py").read_text(encoding="utf-8")
    assert len(re.findall(r"^def phase_output_object", source, re.M)) == 1


def test_the_decision_is_recorded_in_the_source():
    """A decision that lives only in a plan file is a decision that was deleted."""
    doc = phase_output_object.__doc__ or ""
    assert "D-200.1-01" in doc
    # the sibling deferral, honoured in writing with its re-open trigger
    assert "workflow_runs.inputs" in doc
    assert "workflow_definitions.definition" in doc
    assert "WRITE path" in doc
    # the no-migration decision and ITS re-open trigger
    assert "queryable IN SQL" in doc


# ═══════════════════════════════════════════════════════════════════════════════════════
# 4. THE WRITER FENCE (Task 2) — the three terminal `workflow_phases` writers
# ═══════════════════════════════════════════════════════════════════════════════════════
#
# `db/workflows.py`'s terminal phase writers bound `json.dumps(...)` into a `$2::jsonb`
# parameter on a pool that ALREADY registers a jsonb codec with `encoder=json.dumps`. The
# fix is to STOP PRE-ENCODING, never to add a cast — `create_workflow_run`'s own docstring
# proves the pattern for `definition_snapshot`, one column over. These fences hold three
# separate properties: the fix landed, the SQL did not move, the siblings were left alone.

TERMINAL_PHASE_WRITERS = (complete_phase, fail_phase, record_phase_not_sent)

DB_WORKFLOWS = "backend/app/db/workflows.py"


def _json_dumps_calls(func) -> int:
    """Count REAL `json.dumps(...)` calls in a function — comments and docstrings excluded.

    ⚠ AST, NOT A REGEX STRIPPER. These docstrings legitimately DISCUSS `json.dumps` at
    length (that discussion IS the recorded root cause), and a naive `src.count(...)` reads
    that prose as live code — the 187-24 trap, which this repo has recorded firing three
    times. An `ast` walk cannot see a comment or a docstring at all, so the exclusion is
    structural rather than a stripper that has to be trusted.
    """
    tree = ast.parse(textwrap.dedent(inspect.getsource(func)))
    return sum(
        1
        for node in ast.walk(tree)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and node.func.attr == "dumps"
        and isinstance(node.func.value, ast.Name)
        and node.func.value.id == "json"
    )


@pytest.mark.parametrize("writer", TERMINAL_PHASE_WRITERS, ids=lambda f: f.__name__)
def test_terminal_writers_hand_the_codec_a_plain_dict(writer):
    """THE FIX. Zero pre-encodes; the pool's jsonb codec performs the ONE encode."""
    assert _json_dumps_calls(writer) == 0


def test_positive_control_the_ast_counter_still_finds_a_real_call():
    """⚠ WITHOUT THIS, THE THREE ZEROES ABOVE PROVE NOTHING.

    A counter that always returns 0 — a typo'd attribute name, a walk over the wrong tree —
    passes every assertion above. `create_workflow_run` still pre-encodes `inputs` (the
    honoured sibling deferral), so it is the natural LIVE control.
    """
    assert _json_dumps_calls(create_workflow_run) >= 1


def _sql_literals(source: str, func_name: str) -> list[str]:
    """Every string constant naming an UPDATE on `workflow_phases` inside one function."""
    module = ast.parse(source)
    for node in ast.walk(module):
        if isinstance(node, (ast.AsyncFunctionDef, ast.FunctionDef)) and node.name == func_name:
            return [
                c.value
                for c in ast.walk(node)
                if isinstance(c, ast.Constant)
                and isinstance(c.value, str)
                and c.value.startswith("UPDATE workflow_phases")
            ]
    raise AssertionError(f"{func_name} not found")


@pytest.mark.parametrize("writer", TERMINAL_PHASE_WRITERS, ids=lambda f: f.__name__)
def test_the_sql_literal_is_byte_identical_to_the_base_commit(writer):
    """⚠ ONLY THE PARAMETER MOVED — asserted against `git show`, never claimed.

    The `IS DISTINCT FROM 'cancelled'` fence is SECURITY-BEARING (T-200.1-03): these writers
    run on a service-role pool that BYPASSES RLS, so the `WHERE` predicate IS the access
    boundary. `RETURNING completed_at`, `updated_at=now()` and `completed_at = now()` are
    each load-bearing contracts of their own. None of them may drift on a parameter change.
    """
    now = (REPO_ROOT / DB_WORKFLOWS).read_text(encoding="utf-8")
    base = _blob_at_base(DB_WORKFLOWS)

    now_sql = _sql_literals(now, writer.__name__)
    base_sql = _sql_literals(base, writer.__name__)

    # non-vacuity BEFORE contents — two empty lists compare equal and prove nothing
    assert len(base_sql) == 1, f"expected one UPDATE literal at base, got {len(base_sql)}"
    assert now_sql == base_sql


@pytest.mark.parametrize("writer", TERMINAL_PHASE_WRITERS, ids=lambda f: f.__name__)
def test_the_cast_and_the_cancelled_fence_both_survived(writer):
    """The cast was never what was wrong; the fence is the access boundary."""
    (sql,) = _sql_literals((REPO_ROOT / DB_WORKFLOWS).read_text(encoding="utf-8"), writer.__name__)
    assert "output=$2::jsonb" in sql
    assert "status IS DISTINCT FROM 'cancelled'" in sql


def test_complete_phase_still_returns_the_timestamp_the_database_wrote():
    """`RETURNING completed_at` composes with the fence: refused write ⇒ no row ⇒ `None`."""
    (sql,) = _sql_literals((REPO_ROOT / DB_WORKFLOWS).read_text(encoding="utf-8"), "complete_phase")
    assert sql.endswith("RETURNING completed_at")


# ── the honoured sibling deferral, proved rather than promised ──────────────────────────

def test_the_inputs_column_was_left_alone():
    """`workflow_runs.inputs` is 230-of-230 string and stays that way — D-200.1-01."""
    assert "json.dumps(inputs)" in inspect.getsource(create_workflow_run)


def test_the_definition_writes_were_left_alone():
    """The `definition` writes keep the old shape; the count must not have moved."""
    needle = "json.dumps(definition.model_dump"
    now = (REPO_ROOT / DB_WORKFLOWS).read_text(encoding="utf-8")
    base = _blob_at_base(DB_WORKFLOWS)
    assert base.count(needle) > 0, "positive control: the needle must match at the base commit"
    assert now.count(needle) == base.count(needle)


def test_this_plan_wrote_no_migration():
    """D-200.1-01 chose the read repair over a data migration, and proves it."""
    migrations = sorted(p.name for p in (REPO_ROOT / "supabase/migrations").glob("*.sql"))
    listing = subprocess.run(
        ["git", "ls-tree", "--name-only", PLAN_BASE_SHA, "supabase/migrations/"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=True,
    ).stdout.split()
    base_names = sorted(Path(p).name for p in listing if p.endswith(".sql"))
    assert base_names, "positive control: the base commit must list migrations"
    assert migrations == base_names


# ── the resume-path finding is RECORDED, not silently fixed and not dropped ─────────────

def test_the_resume_path_finding_is_recorded_with_a_trigger():
    """A finding that lives nowhere is a finding that was deleted.

    `load_run_phases` SELECTs `output`; `harness_engine.py`'s F7 resume re-fold reads
    `r.get("output") or {}` into a `dict[str, dict]`. On a string-scalar row the codec hands
    back a Python `str`, so the resumed run's grounding re-fold has been folding STRINGS —
    the same degradation in a THIRD consumer. (b) repairs NEW rows only; the 527 historical
    ones are outside RUN-04's scope.
    """
    doc = complete_phase.__doc__ or ""
    assert "resume" in doc.lower()
    assert "527" in doc
    assert "Re-open trigger" in doc


# ═══════════════════════════════════════════════════════════════════════════════════════
# 5. THE WRITER, DRIVEN AGAINST A REAL DATABASE — with its counterfactual beside it
# ═══════════════════════════════════════════════════════════════════════════════════════
#
# ⚠ EVERYTHING BELOW RUNS INSIDE A TRANSACTION THAT IS ROLLED BACK. Nothing is committed to
# the operator's local database (CLAUDE.md rule 4 — worktrees isolate files, not Postgres).
# The throwaway run borrows an EXISTING thread/definition/org by SELECT purely to satisfy the
# foreign keys; the INSERTs never survive the rollback.
#
# ⚠ A `Connection` IS PASSED WHERE A `Pool` IS ANNOTATED, DELIBERATELY. Each writer's whole
# body is one `fetchval`/`execute` call, which `Connection` provides with the same signature —
# so this drives the SHIPPED function verbatim while keeping the write inside a transaction a
# pool cannot give us. A re-typed copy of the UPDATE would prove nothing about the writer.

_POSTGRES_TEST_DSN = os.environ.get(
    "POSTGRES_DSN", "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
)


def _pg_available() -> bool:
    async def _probe() -> bool:
        try:
            conn = await asyncio.wait_for(asyncpg.connect(_POSTGRES_TEST_DSN), timeout=2.0)
            await conn.close()
            return True
        except Exception:
            return False

    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(_probe())
    except Exception:
        return False
    finally:
        loop.close()


PG_AVAILABLE = _pg_available()

live_db = pytest.mark.skipif(
    not PG_AVAILABLE,
    reason=(
        f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable — no live DB to drive the "
        "writer against. ⚠ A GREEN SKIP IS NOT A PASSING FENCE."
    ),
)


@pytest_asyncio.fixture
async def live_conn():
    """A real connection carrying the SHIPPED `_init_pg_connection` codec.

    ⚠ The codec is IMPORTED, never re-typed. A locally re-declared `set_type_codec` would
    test a COPY of the encoder and could not detect the shipped one drifting — and the
    shipped encoder is the entire mechanism under test here.
    """
    conn = await asyncpg.connect(_POSTGRES_TEST_DSN)
    await _init_pg_connection(conn)
    try:
        yield conn
    finally:
        await conn.close()


@live_db
@pytest.mark.asyncio
async def test_complete_phase_stores_an_object_and_the_counterfactual_stores_a_string(live_conn):
    """⚠ THE REPAIR AND THE DEFECT, BOTH DRIVEN, ON ONE CONNECTION, IN ONE TRANSACTION.

    The counterfactual is the load-bearing half: the pre-encoded write stores a jsonb STRING
    SCALAR and `output -> '_measure'` then returns SQL **NULL without erroring**, which is
    exactly why this defect stayed invisible for four months.
    """
    tr = live_conn.transaction()
    await tr.start()
    try:
        anchor = await live_conn.fetchrow(
            "SELECT thread_id, definition_id, org_id FROM workflow_runs LIMIT 1"
        )
        assert anchor is not None, "positive control: the local DB must hold at least one run"

        run_id = await live_conn.fetchval(
            "INSERT INTO workflow_runs (thread_id, definition_id, org_id) "
            "VALUES ($1, $2, $3) RETURNING id",
            anchor["thread_id"],
            anchor["definition_id"],
            anchor["org_id"],
        )

        async def _throwaway_phase(slug: str):
            return await live_conn.fetchval(
                "INSERT INTO workflow_phases (workflow_run_id, phase_index, slug, org_id) "
                "VALUES ($1, 0, $2, $3) RETURNING id",
                run_id,
                slug,
                anchor["org_id"],
            )

        payload = {"_measure": {"count": 15, "noun": "sources"}, "text": "…"}

        # ── THE REPAIR: the SHIPPED writer, handed a plain dict ──────────────────────
        repaired = await _throwaway_phase("200-1-repaired")
        completed_at = await complete_phase(live_conn, repaired, payload)
        assert completed_at is not None, "the RETURNING contract still yields the DB's timestamp"

        shape, noun, count = await live_conn.fetchrow(
            "SELECT jsonb_typeof(output), output -> '_measure' ->> 'noun', "
            "output -> '_measure' ->> 'count' FROM workflow_phases WHERE id = $1",
            repaired,
        )
        assert shape == "object"
        assert noun == "sources"
        assert count == "15"

        # ── THE COUNTERFACTUAL: the same write, pre-encoded, exactly as it shipped ───
        broken = await _throwaway_phase("200-1-counterfactual")
        await live_conn.execute(
            "UPDATE workflow_phases SET status='completed', output=$2::jsonb, updated_at=now(), "
            "completed_at = now() WHERE id = $1 AND status IS DISTINCT FROM 'cancelled'",
            broken,
            json.dumps(payload),  # ⚠ the defect, on purpose
        )
        bad_shape, bad_measure = await live_conn.fetchrow(
            "SELECT jsonb_typeof(output), output -> '_measure' FROM workflow_phases WHERE id = $1",
            broken,
        )
        assert bad_shape == "string"
        # ⚠ SQL NULL, AND NO ERROR. The silence is the finding.
        assert bad_measure is None

        # ── and the READ side reaches through it anyway, which is (a) ────────────────
        raw = await live_conn.fetchval("SELECT output FROM workflow_phases WHERE id = $1", broken)
        assert isinstance(raw, str), "the codec decodes a string scalar to a Python str"
        assert declared_phase_measure(raw) == (15, "sources")
    finally:
        await tr.rollback()


@live_db
@pytest.mark.asyncio
async def test_the_rollback_left_nothing_behind(live_conn):
    """⚠ THE TEST ABOVE MUTATES A REAL DATABASE. This proves the rollback held."""
    leaked = await live_conn.fetchval(
        "SELECT count(*) FROM workflow_phases WHERE slug LIKE '200-1-%'"
    )
    assert leaked == 0
