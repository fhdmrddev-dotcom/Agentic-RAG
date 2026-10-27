"""296 review BE-WR-04 — the reconciler treats a ``skipped`` step as finished.

A ``skip_to_phase`` route marks a step ``skipped``; the engine treats that as done. The
reconciler's "every step completed → the run ends ``completed``" check (295-IN-02 / 296-02)
counted only ``completed`` / ``recorded_not_sent``, so a branched run whose worker died after its
last step still ended ``failed`` with a ``run_failed`` audit, although the deliverable existed.

The pin evaluates the SQL's own ``all_completed`` expression (cut out of the query the sweep
sends) against an in-memory sqlite table, so the test reads the real predicate, not a copy:

  * completed + skipped                → completed
  * completed + recorded_not_sent      → completed (unchanged)
  * every step skipped                 → NOT completed (no deliverable)
  * completed + failed / + cancelled   → NOT completed (failed / cancelled stay unfinished)
"""
from __future__ import annotations

import re
import sqlite3

import pytest

from tests.unit.test_295_truthful_run_ends import _ReconcilePool, _reconcile


def _all_completed_expr() -> str:
    pool = _ReconcilePool([])
    _reconcile(pool)
    sql = next(s for s, _a in pool.calls if "FROM workflow_runs wr" in s)
    m = re.search(r"last_phase_status,\s*(.*?)\s+AS all_completed", sql, re.S)
    assert m, "the ended-steps query no longer carries an all_completed expression"
    return m.group(1)


def _evaluate(statuses: list[str]) -> bool:
    con = sqlite3.connect(":memory:")
    con.execute("CREATE TABLE workflow_runs (id TEXT)")
    con.execute("CREATE TABLE workflow_phases (workflow_run_id TEXT, phase_index INT, status TEXT)")
    con.execute("INSERT INTO workflow_runs VALUES ('r')")
    con.executemany(
        "INSERT INTO workflow_phases VALUES ('r', ?, ?)",
        list(enumerate(statuses)),
    )
    (value,) = con.execute(
        f"SELECT {_all_completed_expr()} AS all_completed FROM workflow_runs wr WHERE wr.id = 'r'"
    ).fetchone()
    return bool(value)


@pytest.mark.parametrize("statuses, expected", [
    (["completed", "skipped", "completed"], True),
    (["completed", "skipped"], True),
    (["completed", "recorded_not_sent"], True),
    (["completed", "completed"], True),
    (["skipped", "skipped"], False),
    (["completed", "skipped", "failed"], False),
    (["completed", "cancelled"], False),
    (["completed", "failed"], False),
])
def test_all_completed_treats_skipped_as_finished_but_not_failed_or_cancelled(statuses, expected):
    assert _evaluate(statuses) is expected
