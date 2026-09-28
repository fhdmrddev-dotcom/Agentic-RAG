"""Phase 268 plan 02 — the spend roll-up and the Expert breakdown (METER-08).

D-268-09  every sub-agent row now counts toward the ROOT run that started it, and toward that
          root's Expert, so org totals RISE by exactly the sub-agent spend 257 left out.
D-268-10  ``expert_breakdown`` is costed with ``cost_usd_sql()`` — the one 257 token->USD home —
          and ``No Expert`` is always a line.
D-268-21  ONE ``per_root`` CTE feeds totals, the daily series, the model donut, the breakdown,
          the window totals and the ledger, so no two regions can be two dialects. A harness
          PLACEHOLDER root (``model='unknown' AND provider='unknown'``) counts only its OWN tokens,
          because its ``run_usage_box`` already sums its sub-agents.
D-268-25  unpriced sub-agents under a rated root are named, never silently under-priced.

⚠ These tests drive MOCKED pools, so they pin the SQL SHAPE and the Python plumbing — never the
arithmetic Postgres does. The real-Postgres proof of this SQL (Σ lines = window total on a fixture
with a deleted Expert, a pre-268 row, a sub-agent and a placeholder shell) is 268-04 Task 1, run
after 268-01 has applied migration 197. A green run here says nothing about that proof.
"""

from __future__ import annotations

import re
from decimal import Decimal
from pathlib import Path
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.db.rates import SpendSummary, get_org_spend_summary, get_spend_runs
from app.services.pricing_service import cost_usd_sql

_BACKEND_APP = Path(__file__).resolve().parents[2] / "app"
_RATES_SRC = (_BACKEND_APP / "db" / "rates.py").read_text(encoding="utf-8")


def _pool() -> AsyncMock:
    pool = AsyncMock()
    pool.fetchrow = AsyncMock()
    pool.fetch = AsyncMock()
    return pool


def _totals_row(**over):
    row = {
        "total_spend_usd": Decimal("1.2500"),
        "rated_runs_count": 3,
        "unrated_runs_count": 1,
        "unmeasured_runs_count": 0,
        "total_input_tokens": 1000,
        "total_output_tokens": 500,
        "unpriced_subagents": 2,
    }
    row.update(over)
    return row


def _line(key, expert_id=None, name=None, scope_mode=None, runs=1, usd="0.1000", unrated=0,
          found=True, tin=10, tout=5):
    return {
        "line_key": key,
        "expert_id": expert_id,
        "expert_name": name,
        "scope_mode": scope_mode,
        "name_found": found,
        "run_count": runs,
        "input_tokens": tin,
        "output_tokens": tout,
        "spend_usd": None if usd is None else Decimal(usd),
        "unrated_count": unrated,
    }


def _prime_summary(pool, lines, window=None, totals=None):
    """Call order: fetchrow(totals) · fetchrow(coverage) · fetch(daily) · fetch(model) ·
    fetch(breakdown) · fetchrow(window). The last two are the 268 additions."""
    pool.fetchrow.side_effect = [
        totals or _totals_row(),
        {"incomplete_count": 0},
        window or {"window_total_usd": Decimal("1.2500"), "window_run_count": 4},
    ]
    pool.fetch.side_effect = [[], [], lines]


def _all_sql(pool) -> list[str]:
    return [c.args[0] for c in pool.fetchrow.call_args_list] + [
        c.args[0] for c in pool.fetch.call_args_list
    ]


# ─────────────────────────────────────────────────────────────────────────────
#  The ONE CTE (D-268-21) — shape
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_every_spend_query_reads_the_one_per_root_cte():
    pool = _pool()
    _prime_summary(pool, [])
    await get_org_spend_summary(pool, uuid4())

    sqls = _all_sql(pool)
    coverage = [s for s in sqls if "workflow_runs" in s and "incomplete_count" in s]
    spend = [s for s in sqls if s not in coverage]
    assert len(spend) == 5, "totals, daily, model, breakdown and window totals"
    for sql in spend:
        assert "per_root AS (" in sql
        # roots are filtered by org; MEMBERS are reached only through a root (T-268-12 /
        # Pitfall 7): a pre-268 sub-agent row may carry the trigger's org, and filtering
        # members by org would drop it.
        assert "r.parent_run_id IS NULL" in sql
        assert "m.run_id = ro.run_id OR m.parent_run_id = ro.run_id" in sql
        assert "m.org_id" not in sql
        # each member priced at ITS OWN model / provider / date, through the one USD home
        assert cost_usd_sql("m", "rate") in sql
        assert "mr.model_id = m.model" in sql
        assert "mr.org_id = m.root_org_id" in sql
        assert "mr.effective_from <= m.started_at" in sql


def test_parent_run_id_is_null_appears_only_inside_the_roots_cte():
    """The members join reads descendants; a root-only predicate anywhere else would silently
    reinstate 257's exclusion of sub-agent spend (D-268-09)."""
    hits = [ln for ln in _RATES_SRC.splitlines() if "parent_run_id IS NULL" in ln]
    assert hits, "the roots CTE must carry the root predicate"
    assert len(hits) == 1, hits


def test_the_placeholder_root_token_rule_is_in_the_cte():
    assert "(r.model = 'unknown' AND r.provider = 'unknown') AS is_box_shell" in _RATES_SRC
    assert "FILTER (WHERE is_root OR NOT is_box_shell)" in _RATES_SRC
    # USD still sums every priced member — the shell itself is unpriced, its sub-agents are not.
    assert "SUM(cost_usd) AS cost_usd" in _RATES_SRC
    assert "COUNT(*) FILTER (WHERE NOT is_root) AS subagent_count" in _RATES_SRC
    assert "unpriced_subagents" in _RATES_SRC


# ─────────────────────────────────────────────────────────────────────────────
#  The placeholder-writer SET fence (D-268-21, T-268-15)
# ─────────────────────────────────────────────────────────────────────────────

# A keyword argument `model="unknown",` — the shape an insert_run call passes. The look-behind
# keeps rates.py's own READER predicate (`r.model = 'unknown' AND …`) out of the writer set.
_PLACEHOLDER_WRITER = re.compile(r"(?<![.\w])model\s*=\s*[\"']unknown[\"']\s*,")

_EXPECTED_PLACEHOLDER_WRITERS = {
    "api/runs.py": "Harness Continue / re-drive producer shell (Facet C, 092-07)",
    "services/harness_engine.py": "startup-sweep / scheduler resume producer shell",
    "services/harness/publish_service.py": "golden-run publish validation shell",
}


def test_placeholder_root_writers_are_exactly_the_three_shells():
    """⛔ THE SET, re-derived from source every run (the 256 ``forced_emit`` fence shape).

    ``db/rates.py`` counts a root whose ``model = 'unknown' AND provider = 'unknown'`` by its
    OWN tokens only, because those three shells persist ``ctx.run_usage_box`` — which already
    sums every sub-agent under them (``phase_types._record_run_usage``). Adding the sub-agent
    rows' tokens again would double-count every harness run.

    So the literal pair IS the marker, and a fourth writer changes what it means:
      • a new shell that does NOT persist a box, written with `model="unknown"`, would have its
        sub-agents' tokens silently DROPPED from every total on /admin/spend;
      • a box-persisting shell written with a REAL model name would have them DOUBLE-COUNTED.
    Either way this set changes, and this test is where that is noticed.

    ⚠ The hazard this fence cannot see: if an operator ever registers a rate for model
    ``unknown``, the shells become PRICED and their box tokens would be charged once on the
    shell AND once on each sub-agent — shell USD would double-count. Never register a rate for
    the placeholder id.
    """
    found: set[str] = set()
    for path in sorted(_BACKEND_APP.rglob("*.py")):
        if "__pycache__" in path.parts:
            continue
        if _PLACEHOLDER_WRITER.search(path.read_text(encoding="utf-8")):
            found.add(path.relative_to(_BACKEND_APP).as_posix())
    assert found == set(_EXPECTED_PLACEHOLDER_WRITERS), (
        "the set of model=\"unknown\" placeholder-root writers changed.\n"
        f"  appeared: {sorted(found - set(_EXPECTED_PLACEHOLDER_WRITERS))}\n"
        f"  vanished: {sorted(set(_EXPECTED_PLACEHOLDER_WRITERS) - found)}\n"
        "db/rates.py's box-shell token rule reads that literal pair — decide whether the new "
        "row persists a run_usage_box before touching this set."
    )
    assert len(found) == 3


def test_the_reader_side_of_the_fence_is_not_itself_a_writer():
    assert not _PLACEHOLDER_WRITER.search(_RATES_SRC)


# ─────────────────────────────────────────────────────────────────────────────
#  The Expert filter — bound, never interpolated (D-268-08, T-268-10)
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_the_expert_value_is_only_ever_a_bound_param():
    hostile = "x'); DROP TABLE runs; --"
    pool = _pool()
    _prime_summary(pool, [])
    await get_org_spend_summary(pool, uuid4(), expert=hostile)
    for c in pool.fetchrow.call_args_list + pool.fetch.call_args_list:
        assert hostile not in c.args[0]

    pool2 = _pool()
    pool2.fetchrow.return_value = {"total": 0}
    pool2.fetch.return_value = []
    await get_spend_runs(pool2, uuid4(), expert=hostile)
    for c in pool2.fetchrow.call_args_list + pool2.fetch.call_args_list:
        assert hostile not in c.args[0]
        assert hostile in c.args[1:]


def test_the_filter_clause_compares_as_text():
    # `expert_id::text = $N`, never `$N::uuid`: Postgres does not promise OR short-circuit, so a
    # `'none'::uuid` cast could raise on the arm that was never meant to run.
    assert "r.expert_id::text = " in _RATES_SRC
    assert not re.search(r"expert_id\s*=\s*\$\d+::uuid", _RATES_SRC)
    assert "'unrecorded' AND NOT r.expert_attributed" in _RATES_SRC
    assert "'none' AND r.expert_attributed AND r.expert_id IS NULL" in _RATES_SRC


@pytest.mark.asyncio
async def test_filtered_summary_still_computes_the_breakdown_and_window_unfiltered():
    """D-268-10: the Spend by Expert table is the NAVIGATOR — it lists every line whatever is
    selected. Its query, and the window totals the recon footer compares against, must carry a
    NULL filter while the KPI/chart/donut queries carry the selection."""
    pool = _pool()
    _prime_summary(pool, [_line("none", runs=4, usd="1.2500")])
    org = uuid4()
    await get_org_spend_summary(pool, org, expert="none")

    totals_args = pool.fetchrow.call_args_list[0].args
    daily_args = pool.fetch.call_args_list[0].args
    model_args = pool.fetch.call_args_list[1].args
    breakdown_args = pool.fetch.call_args_list[2].args
    window_args = pool.fetchrow.call_args_list[2].args

    for filtered in (totals_args, daily_args, model_args):
        assert filtered[1] == org
        assert filtered[2] == "none"
    for navigator in (breakdown_args, window_args):
        assert navigator[1] == org
        assert navigator[2] is None
    assert "expert_bundles eb" in breakdown_args[0]


@pytest.mark.asyncio
async def test_coverage_count_follows_the_filter_through_the_thread():
    pool = _pool()
    _prime_summary(pool, [])
    await get_org_spend_summary(pool, uuid4(), expert="unrecorded")
    cov = pool.fetchrow.call_args_list[1].args
    assert "workflow_runs" in cov[0]
    assert cov[-1] == "unrecorded"


# ─────────────────────────────────────────────────────────────────────────────
#  expert_breakdown plumbing (D-268-04, D-268-06, D-268-10)
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_breakdown_orders_by_usd_and_always_carries_no_expert():
    a, b, gone = uuid4(), uuid4(), uuid4()
    pool = _pool()
    _prime_summary(
        pool,
        [
            _line(str(a), a, "HR Advisor", "restricted", runs=2, usd="0.2000"),
            _line("unrecorded", runs=5, usd="0.0500"),
            _line(str(b), b, "Financial Analyzer", "biased", runs=1, usd="0.9000", unrated=1),
            _line(str(gone), gone, None, None, runs=1, usd="0.1000", found=False),
        ],
    )
    s = await get_org_spend_summary(pool, uuid4())

    keys = [ln["key"] for ln in s.expert_breakdown]
    # Experts (deleted included) by USD desc, then No Expert (always), then Not recorded.
    assert keys == [str(b), str(a), str(gone), "none", "unrecorded"]

    fa = s.expert_breakdown[0]
    assert fa["name"] == "Financial Analyzer"
    assert fa["scope_mode"] == "biased"
    assert fa["spend_usd"] == "0.9000"
    assert fa["unrated_count"] == 1
    assert fa["deleted"] is False
    assert fa["expert_id"] == str(b)

    deleted = s.expert_breakdown[2]
    assert deleted["deleted"] is True
    assert deleted["name"] is None

    none_line = s.expert_breakdown[3]
    assert none_line["run_count"] == 0
    assert none_line["spend_usd"] == "0.0000"
    assert none_line["expert_id"] is None
    assert none_line["deleted"] is False


@pytest.mark.asyncio
async def test_not_recorded_is_its_own_line_only_when_non_zero():
    pool = _pool()
    _prime_summary(pool, [_line("none", runs=3, usd="1.2500")])
    s = await get_org_spend_summary(pool, uuid4())
    assert [ln["key"] for ln in s.expert_breakdown] == ["none"]
    assert s.expert_breakdown[0]["run_count"] == 3


@pytest.mark.asyncio
async def test_a_line_with_no_priced_member_reports_none_not_zero():
    """257 CR-06 carried into the breakdown: a line whose runs all lack a rate is UNPRICED, and
    must never read as a confident $0.0000."""
    e = uuid4()
    pool = _pool()
    _prime_summary(pool, [_line(str(e), e, "Local Model Expert", "biased", usd=None, unrated=2, runs=2)])
    s = await get_org_spend_summary(pool, uuid4())
    line = [ln for ln in s.expert_breakdown if ln["key"] == str(e)][0]
    assert line["spend_usd"] is None
    assert line["unrated_count"] == 2


@pytest.mark.asyncio
async def test_window_totals_and_unpriced_subagents_reach_the_dataclass():
    pool = _pool()
    _prime_summary(
        pool,
        [_line("none", runs=7, usd="3.3000")],
        window={"window_total_usd": Decimal("3.3000"), "window_run_count": 7},
        totals=_totals_row(unpriced_subagents=4),
    )
    s = await get_org_spend_summary(pool, uuid4())
    assert s.window_total_usd == Decimal("3.3000")
    assert s.window_run_count == 7
    assert s.unpriced_subagents == 4


def test_spend_summary_new_fields_default_so_old_constructors_still_work():
    s = SpendSummary(
        total_spend_usd=Decimal("0"),
        rated_runs_count=0,
        unrated_runs_count=0,
        unmeasured_runs_count=0,
        incomplete_coverage_count=0,
        total_input_tokens=0,
        total_output_tokens=0,
        daily_spend=[],
        model_breakdown=[],
    )
    assert s.expert_breakdown == []
    assert s.window_total_usd is None
    assert s.window_run_count == 0
    assert s.unpriced_subagents == 0


def test_the_name_join_is_org_constrained():
    """T-268-11: an Expert id from another org must never pull that org's Expert NAME into this
    cockpit. No join -> "Deleted Expert {id8}"."""
    assert (
        "LEFT JOIN public.expert_bundles eb ON eb.id = ro.expert_id "
        "AND (eb.is_system OR eb.org_id = ro.org_id)"
    ) in " ".join(_RATES_SRC.split())


# ─────────────────────────────────────────────────────────────────────────────
#  The ledger (get_spend_runs)
# ─────────────────────────────────────────────────────────────────────────────


def _ledger_row(**over):
    row = {
        "run_id": uuid4(),
        "thread_id": uuid4(),
        "user_id": uuid4(),
        "status": "completed",
        "model": "gpt-4o",
        "provider": "openai",
        "started_at": None,
        "completed_at": None,
        "input_tokens": 1600,
        "output_tokens": 700,
        "input_cost_per_million": Decimal("2.5"),
        "output_cost_per_million": Decimal("10"),
        "token_coverage": None,
        "cost_usd": Decimal("0.0110"),
        "expert_id": None,
        "expert_attributed": True,
        "expert_name": None,
        "expert_found": False,
        "subagent_count": 2,
    }
    row.update(over)
    return row


@pytest.mark.asyncio
async def test_ledger_rows_carry_attribution_and_the_subagent_count():
    e = uuid4()
    pool = _pool()
    pool.fetchrow.return_value = {"total": 3}
    pool.fetch.return_value = [
        _ledger_row(expert_id=e, expert_name="HR Advisor", expert_found=True),
        _ledger_row(),
        _ledger_row(expert_attributed=False, subagent_count=0),
        _ledger_row(expert_id=uuid4(), expert_found=False),
    ]
    items, total = await get_spend_runs(pool, uuid4(), expert=None)
    assert total == 3

    hr, no_expert, unrecorded, deleted = items
    assert hr["expert_id"] == str(e)
    assert hr["expert_name"] == "HR Advisor"
    assert hr["expert_deleted"] is False
    assert hr["expert_attributed"] is True
    assert hr["subagent_count"] == 2

    assert no_expert["expert_id"] is None
    assert no_expert["expert_deleted"] is False

    assert unrecorded["expert_attributed"] is False
    assert unrecorded["subagent_count"] == 0

    assert deleted["expert_deleted"] is True
    assert deleted["expert_name"] is None


@pytest.mark.asyncio
async def test_ledger_count_carries_the_same_root_and_expert_predicates():
    """The 257 LATERAL lesson: a COUNT that disagrees with its rows makes the pager lie."""
    e = str(uuid4())
    org = uuid4()
    pool = _pool()
    pool.fetchrow.return_value = {"total": 0}
    pool.fetch.return_value = []
    await get_spend_runs(pool, org, limit=50, offset=100, filter_status="rated", time_range="7d", expert=e)

    count_sql, *count_args = pool.fetchrow.call_args.args
    rows_sql, *rows_args = pool.fetch.call_args.args
    assert count_args == [org, e]
    assert rows_args == [org, e, 50, 100]
    for sql in (count_sql, rows_sql):
        assert "per_root AS (" in sql
        assert "r.parent_run_id IS NULL" in sql
        assert "r.expert_id::text = $2::text" in sql
        assert "INTERVAL '7 days'" in sql
        assert "pr.input_cost_per_million IS NOT NULL" in sql
    assert "ORDER BY ro.started_at DESC" in rows_sql
