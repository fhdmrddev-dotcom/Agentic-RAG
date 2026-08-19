"""Phase 194 Plan 06 Task 1 — the two ``cancelled`` phase writers, at the WRITER level.

`finish_run` writes the `workflow_runs` row plus the thread anchor and NOTHING ELSE, so
the in-flight `workflow_phases` row on a stopped run stays `active` FOREVER. This suite
covers the two writers that fix that, and it covers them where they live: the composed
SQL string and the bind arguments handed to a MOCKED pool. **Nothing here touches a live
database** — so this file is parallel-safe under CLAUDE.md parallel-execution rule 4, and
it is deliberately kept that way. The live-DB gate for the constraint itself is
`test_migration_119.py`, which runs in the serialized wave.

⚠ MIGRATION 119 IS AUTHORED BUT NOT APPLIED at the time this suite was written. That is
irrelevant HERE and the reason is worth stating rather than assuming: not one case below
writes a row. Every assertion is about the SQL this module composes and the arguments it
binds, which are true of the source whether or not any database has seen the literal yet.

⚠ WHY THERE ARE TWO WRITERS, since a reader's first instinct is to collapse them:
`cancel_phase` is PHASE-KEYED and serves the ENGINE arm, which holds `phase_id` in the
same loop iteration and is therefore the only home that can distinguish *"the phase the
user interrupted"* from *"some phase row that happens to be `active`"*.
`cancel_active_phases` is RUN-KEYED and serves the engineless zombie / no-producer arm,
which has no engine, no loop and no `phase_id` at all — there the row must be FOUND.

⚠ SCOPE DISCIPLINE (the 194-02 / 194-03 lesson, tripped three times in this phase today).
A bare source grep matches THIS FILE'S OWN PROSE and the production docblocks that quote
the same symbols. So every negative sweep below runs over the **SQL string literal
extracted by AST from the function body with the docstring removed**, never over raw file
text — with the single, deliberate exception of the one-line-predicate case, which is a
property OF the raw text and says so.
"""
import ast
import re
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from app.db import workflows as wf

_MODULE_PATH = Path(wf.__file__)
_REPO_ROOT = Path(__file__).resolve().parents[2]
_MIGRATION_119 = _REPO_ROOT / "supabase" / "migrations" / "119_workflow_phases_cancelled.sql"

#: The two writers this plan adds. Every sweep below is scoped to these names.
_TARGETS = ("cancel_phase", "cancel_active_phases")

#: The four statuses neither writer may ever WRITE (D-07 / D-13 — completed phases'
#: outputs are already durable and are left untouched; `failed`/`skipped` were OFFERED
#: AND REJECTED by D-04 in a phase whose entire requirement is honesty).
_FORBIDDEN_WRITTEN = ("failed", "skipped", "completed", "recorded_not_sent")


# ── AST helpers: locate the two functions and read their SQL, docstring EXCLUDED ──


def _function_nodes() -> dict[str, ast.AST]:
    tree = ast.parse(_MODULE_PATH.read_text(encoding="utf-8"))
    return {
        node.name: node
        for node in ast.walk(tree)
        if isinstance(node, (ast.AsyncFunctionDef, ast.FunctionDef)) and node.name in _TARGETS
    }


def _body_without_docstring(node: ast.AST) -> list[ast.stmt]:
    body = list(node.body)
    if (
        body
        and isinstance(body[0], ast.Expr)
        and isinstance(body[0].value, ast.Constant)
        and isinstance(body[0].value.value, str)
    ):
        body = body[1:]
    return body


def _one_sql(name: str) -> str:
    """The single UPDATE string the named function composes, docstring excluded."""
    node = _function_nodes()[name]
    sqls = [
        sub.value
        for stmt in _body_without_docstring(node)
        for sub in ast.walk(stmt)
        if isinstance(sub, ast.Constant) and isinstance(sub.value, str) and "UPDATE" in sub.value
    ]
    assert len(sqls) == 1, f"{name}: expected exactly ONE UPDATE statement, found {len(sqls)}"
    return sqls[0]


def _set_clause(sql: str) -> str:
    """Everything before ` WHERE ` — the part that WRITES."""
    return sql.partition(" WHERE ")[0]


def _all_written_phase_slugs() -> list[str]:
    """Every slug written by every ``UPDATE workflow_phases SET status='…'`` in the module."""
    return re.findall(
        r"UPDATE workflow_phases SET status='([a-z_]+)'",
        _MODULE_PATH.read_text(encoding="utf-8"),
    )


def _mock_pool(execute_result: str = "UPDATE 1") -> MagicMock:
    """A pool whose only usable verb is ``execute``.

    Every READ verb is armed to raise: these writers are SET-PREDICATE writes and must
    never become read-then-update-by-id, so a read is a test failure rather than a
    silently-tolerated extra call.
    """
    pool = MagicMock()
    pool.execute = AsyncMock(return_value=execute_result)
    for read_verb in ("fetch", "fetchrow", "fetchval"):
        setattr(
            pool,
            read_verb,
            AsyncMock(side_effect=AssertionError(f"read-then-update: pool.{read_verb} was awaited")),
        )
    return pool


# ── 0. THE BLINDNESS GUARD — runs first, on purpose ──────────────────────────────


def test_both_writers_are_locatable_and_each_carries_exactly_one_update():
    """FIRST: every absence sweep below is BLIND if this case fails.

    Each negative assertion in this file is scoped to the two functions located BY AST
    NAME. If a rename — or a typo in ``_TARGETS`` — made that lookup return nothing, the
    sweeps would pass over the empty set and read as green. That is the 194-03 lesson
    verbatim: an empty-sweep control left clauses GREEN with a third of the union
    invisible, and **absence assertions cannot detect their own blindness**. So the
    matched COUNT is asserted here, in its own case, before anything else runs.

    ⚠ CORRECTED (Phase 194 Plan 06, on measurement). The paragraph above is kept
    verbatim because it is the reason this case was written, but it OVERSTATES what
    this case defends, and crediting a fence with a rule it cannot see is the exact
    193.1 defect. A real harness plant — ``_TARGETS`` misspelled to
    ``cancel_active_phasez`` — was driven, and the sweeps did NOT go silently green:
    **five cases went RED (this one plus all four ``_TARGETS``-scoped sweeps) and nine
    passed**, because ``_one_sql`` / ``_function_nodes()[name]`` raise ``KeyError`` on a
    lookup miss rather than iterating an empty set. So the sweeps here fail LOUDLY on
    their own blindness, and this case is a cheap DEFENCE-IN-DEPTH plus a readable
    statement of the file's scope — **not** the thing standing between this suite and a
    vacuous pass. Two cases here are deliberately outside ``_TARGETS`` and would survive
    such a typo: ``test_the_run_keyed_predicate_lives_on_one_source_line`` (raw text)
    and the two migration-vocabulary cases (raw regex over both files).
    """
    nodes = _function_nodes()
    assert sorted(nodes) == sorted(_TARGETS), (
        f"expected to locate exactly {sorted(_TARGETS)}; located {sorted(nodes)} — "
        "every sweep in this file is scoped to that set and is vacuous without it"
    )
    for name in _TARGETS:
        assert _one_sql(name).startswith("UPDATE workflow_phases SET "), name
    assert callable(getattr(wf, "cancel_phase"))
    assert callable(getattr(wf, "cancel_active_phases"))


# ── 1. cancel_phase — PHASE-KEYED, the engine arm ────────────────────────────────


async def test_cancel_phase_issues_one_phase_keyed_update():
    """ONE UPDATE, ``WHERE id = $1``, the phase id passed as a BIND."""
    pool = _mock_pool()
    phase_id = uuid4()

    assert await wf.cancel_phase(pool, phase_id) is None

    assert pool.execute.await_count == 1
    sql, *binds = pool.execute.await_args.args
    assert "WHERE id = $1" in sql, sql
    assert binds == [phase_id]
    assert str(phase_id) not in sql, "the id must be a $N bind, never interpolated into SQL"


def test_cancel_phase_is_not_run_keyed():
    """The phase-keyed writer must NOT carry the run-keyed predicate.

    Independent of the case above: collapsing the two writers into one run-keyed
    function would leave the engine arm unable to say WHICH phase was interrupted.
    """
    sql = _one_sql("cancel_phase")
    assert "workflow_run_id" not in sql, sql


# ── 2. cancel_active_phases — RUN-KEYED set-predicate, the engineless arm ────────
#
# ⚠ The predicate has TWO clauses and they are asserted in TWO separate cases ON
# PURPOSE. 194-03 shipped four REQUIRED plants that all red on the SAME clause, which
# would have left a second clause inert and indistinguishable from live. Splitting them
# means a plant that breaks the key reds only the first, and a plant that widens the
# status filter reds only the second.


async def test_cancel_active_phases_is_keyed_on_workflow_run_id():
    """CLAUSE 1 — ``WHERE workflow_run_id = $1``, the run id passed as a BIND.

    ⚠ The column is ``workflow_run_id``. ``workflow_phases`` has NO plain ``run_id``
    column; naming one raises Postgres 42703 — the trap ``get_active_phase``'s own
    docstring records, whose predicate this writer applies as a WRITE.
    """
    pool = _mock_pool()
    run_id = uuid4()

    assert await wf.cancel_active_phases(pool, run_id) is None

    assert pool.execute.await_count == 1
    sql, *binds = pool.execute.await_args.args
    assert "WHERE workflow_run_id = $1" in sql, sql
    assert binds == [run_id]
    assert str(run_id) not in sql, "the id must be a $N bind, never interpolated into SQL"


def test_cancel_active_phases_only_reaches_rows_that_are_active():
    """CLAUSE 2 — ``AND status = 'active'`` is THE MECHANISM, not a convention.

    It is the only thing standing between this writer and a bulk terminalize. Widening
    it to a set — or dropping it — would rewrite ``completed`` rows whose outputs are
    already durable, which D-07 / D-13 forbid outright.
    """
    sql = _one_sql("cancel_active_phases")
    _, _, where_clause = sql.partition(" WHERE ")
    assert "AND status = 'active'" in where_clause, sql
    matched_statuses = re.findall(r"status\s*=\s*'([a-z_]+)'", where_clause)
    assert matched_statuses == ["active"], (
        f"the predicate may match ONE status and it must be 'active'; matched {matched_statuses}"
    )


def test_the_run_keyed_predicate_lives_on_one_source_line():
    """A property of the RAW TEXT, which the AST cases above structurally cannot see.

    Python joins adjacent string literals at parse time, so a predicate split across two
    source lines is byte-identical to the AST and invisible to every other case here.
    193.2-08 measured a rule written WRAPPED failing its own literal ``grep -q`` and
    reading as *"already fixed"*; the same trap bit 193.2's `publish_service.py` fix on
    the same day. This file's acceptance criterion is a literal grep, so the one-line
    shape is pinned as its own property.

    ⚠ THE NEEDLE ALONE IS VACUOUS AND THAT WAS MEASURED, NOT REASONED. Written as a bare
    file-wide search this case PASSED against a tree where neither writer existed —
    ``get_active_phase`` (``db/workflows.py``, shipped long before Phase 194) already
    carries the byte-identical predicate on one line as a **READ**. A fence that a
    nine-phase-old SELECT satisfies is not a fence. So the line must ALSO carry the
    cancelled UPDATE: it is the WRITE's predicate being pinned, never the read's.
    """
    needle = "WHERE workflow_run_id = $1 AND status = 'active'"
    write_marker = "UPDATE workflow_phases SET status='cancelled'"
    source_lines = _MODULE_PATH.read_text(encoding="utf-8").splitlines()
    hits = [ln for ln in source_lines if needle in ln and write_marker in ln]
    assert hits, (
        f"no single source line carries BOTH {write_marker!r} and {needle!r} — "
        "a grep for the write's predicate would find nothing (or would find the READ)"
    )


@pytest.mark.parametrize("rowcount_tag", ["UPDATE 0", "UPDATE 1", "UPDATE 3"])
async def test_cancel_active_phases_is_correct_for_zero_one_or_many_rows(rowcount_tag):
    """A SET-PREDICATE is correct for 0, 1 or N and raises on none of the three.

    Exactly one ``active`` row per run is TYPICAL, NOT GUARANTEED (measured: 3 runs with
    exactly 1, 0 runs with more; ``get_active_phase`` itself hedges with ``ORDER BY
    phase_index LIMIT 1``). The pool's READ verbs are armed to raise, so a
    read-then-update-by-id regression fails here rather than passing quietly.
    """
    pool = _mock_pool(execute_result=rowcount_tag)

    assert await wf.cancel_active_phases(pool, uuid4()) is None

    assert pool.execute.await_count == 1
    pool.fetch.assert_not_awaited()
    pool.fetchrow.assert_not_awaited()
    pool.fetchval.assert_not_awaited()


# ── 3. What neither writer may do ────────────────────────────────────────────────


def test_neither_writer_writes_any_other_phase_status_slug():
    """D-07 / D-13 / D-04: the SET clause writes ``cancelled`` and nothing else.

    ⚠ MADE PRECISE 2026-08-19 (Phase 200 / D-05), AND THE ORIGINAL IS QUOTED HERE RATHER
    THAN SILENTLY REPLACED, because the change narrows a fence and that must be auditable.
    The backstop loop read, verbatim:

        for forbidden in _FORBIDDEN_WRITTEN:
            assert forbidden not in set_clause

    — a BARE SUBSTRING search. Phase 200 adds a ``completed_at`` COLUMN to five of the seven
    ``workflow_phases`` status writers (migration 121 / D-05), and ``completed_at`` contains
    the substring ``completed``, so the loop fired on ``cancel_phase`` for writing a COLUMN
    NAME while the SQL's only status literal was still ``'cancelled'``.

    **The narrowing is to the fence's own stated subject: a status SLUG.** A slug reaches
    this column exclusively as a QUOTED SQL LITERAL — that is what
    ``workflow_phases_status_check`` admits and what every one of the seven writers emits —
    so the quoted form is what "writes the forbidden slug" has always meant. A column
    identifier is a different lexical class and was never the target.

    ⚠ **NOTHING THIS FENCE DEFENDS IS GIVEN UP, and it was PLANTED rather than reasoned
    about**: with ``status='completed'`` spliced into ``cancel_phase``'s SET clause the
    quoted form still goes RED (measured, Phase 200 Task 3). The precise first assertion —
    the ``status\s*=\s*'...'`` regex, which must equal exactly ``["cancelled"]`` — is
    untouched and remains the primary control; this loop is the backstop that also catches a
    forbidden literal parked somewhere else in the SET clause.
    """
    for name in _TARGETS:
        set_clause = _set_clause(_one_sql(name))
        written = re.findall(r"status\s*=\s*'([a-z_]+)'", set_clause)
        assert written == ["cancelled"], f"{name} writes {written}"
        for forbidden in _FORBIDDEN_WRITTEN:
            # The QUOTED form: a status slug is always a SQL string literal. A bare
            # substring test also matches the ``completed_at`` COLUMN (Phase 200 / D-05).
            assert f"'{forbidden}'" not in set_clause, (
                f"{name} writes the forbidden slug {forbidden!r}"
            )


def test_neither_sql_names_a_bare_run_id_column():
    """Postgres 42703: ``workflow_phases`` has no ``run_id`` and no ``wp.run_id``.

    Scoped to the extracted SQL literal, NOT to the file — both docblocks legitimately
    quote the trap by name, and a raw grep would match the prose that documents it.
    """
    for name in _TARGETS:
        sql = _one_sql(name)
        assert "wp.run_id" not in sql, name
        assert not re.search(r"(?<!workflow_)run_id\s*=", sql), f"{name}: bare run_id predicate"


def test_no_fstring_percent_format_or_dot_format_reaches_the_sql():
    """T-194-06-01 — ``$N`` binds only (T-152-05-05, T-091-03).

    Walked over the function BODY with the docstring stripped, so prose is out of scope.
    """
    nodes = _function_nodes()
    for name in _TARGETS:
        for stmt in _body_without_docstring(nodes[name]):
            for sub in ast.walk(stmt):
                assert not isinstance(sub, ast.JoinedStr), f"{name}: f-string reaches SQL"
                assert not (
                    isinstance(sub, ast.BinOp) and isinstance(sub.op, ast.Mod)
                ), f"{name}: %-format reaches SQL"
                assert not (
                    isinstance(sub, ast.Attribute) and sub.attr == "format"
                ), f"{name}: .format( reaches SQL"


# ── 4. The slug and the constraint agree — compared by grep, never by eye ────────


def test_the_written_slug_is_byte_identical_to_migration_119s_vocabulary():
    """The module's phase-status vocabulary == migration 119's ARRAY, exactly.

    Both sides are DERIVED — the writers' slugs by scanning every
    ``UPDATE workflow_phases SET status='…'`` in the module, the constraint's by
    scanning the migration's ``'…'::text`` literals below ``BEGIN;`` (the header prose
    quotes literals too, and it is excluded on purpose). ``pending`` is the column
    DEFAULT set at INSERT and is written by no writer, so it is the one literal added on
    the module side.

    This is a two-way fence: a MISSPELLED slug in either new writer fails it, and so
    does a re-typed ``ARRAY[…]`` that silently drops a shipped literal (mig 119 header
    rule 4 — the failure mode that would orphan every existing row using it).

    ⚠ It asserts the SOURCE agreement only. It cannot and does not claim the constraint
    has been APPLIED to any database: migration 119 is authored, not applied, and the
    live gate is `test_migration_119.py`.
    """
    migration_body = _MIGRATION_119.read_text(encoding="utf-8").split("BEGIN;", 1)[1]
    constraint_literals = set(re.findall(r"'([a-z_]+)'::text", migration_body))
    written = set(_all_written_phase_slugs())

    assert "cancelled" in written, "no writer in the module writes 'cancelled'"
    assert constraint_literals == written | {"pending"}, (
        f"constraint admits {sorted(constraint_literals)}; "
        f"writers write {sorted(written)} (+ 'pending' by DEFAULT)"
    )


def test_the_five_shipped_writers_still_write_their_own_slugs():
    """The sixth writer is ADDITIVE — no shipped writer moved (a plan non-goal).

    Derived from the module rather than typed: the seven UPDATEs must be the five
    shipped slugs plus ``cancelled`` twice (the phase-keyed and run-keyed homes).
    """
    written = _all_written_phase_slugs()
    assert written.count("cancelled") == 2, written
    for shipped in ("active", "completed", "failed", "skipped", "recorded_not_sent"):
        assert written.count(shipped) == 1, f"{shipped}: {written}"
