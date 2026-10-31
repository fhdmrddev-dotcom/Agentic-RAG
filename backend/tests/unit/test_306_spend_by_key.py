"""Phase 306-05 (GUARD-01; D-18 / D-34; T-306-33) — MCP asks and runs in operator spend, by key.

An ask (306-04) and an MCP-started workflow run (306-05) are ordinary ``runs`` rows whose THREAD
carries ``origin_kind = 'mcp'`` and ``origin_ref = <key>`` (migration 223). They enter spend through
the ONE ``per_root`` CTE's runs arm, unchanged, except that the arm now reads the key from the
thread's origin:

* ``t.origin_ref AS api_key_id`` from ``LEFT JOIN public.threads t ON t.id = r.thread_id AND
  t.origin_kind = 'mcp'`` (a primary-key join: at most one row, so no run is multiplied);
* ``'run'::text AS source`` stays EXACTLY as it was, because ``members`` joins runs only
  ``WHERE ro.source = 'run'`` (Pitfall 9: changing it would zero every MCP run's tokens);
* the tool is ``'run_workflow'`` when the thread carries a workflow run, else ``'ask_agent'``;
* the Python ledger builder reads a run row whose ``api_key_id`` is set as source ``'mcp'``, so
  305's ``LedgerExpertCell`` MCP arm names the key. A plain run row stays ("run", None, None, None).

Static pins over mocked pools; the real-Postgres proof is ``tests/integration/test_306_spend_live.py``.
"""
from __future__ import annotations

import re
import subprocess
from pathlib import Path
from uuid import uuid4

from app.db.rates import get_spend_runs
from tests.unit.test_305_spend_cte import _flat, _ledger_row, _ledger_sqls, _pool, _summary_sqls

_REPO = Path(__file__).resolve().parents[3]
_RATES_REL = "backend/app/db/rates.py"
_RATES_SRC = (_REPO / _RATES_REL).read_text(encoding="utf-8")
PLAN_BASE = "78030de069cb40ad4eb80b02c69cce5d8ebfee36"

JOIN = "LEFT JOIN public.threads t ON t.id = r.thread_id AND t.origin_kind = 'mcp'"


def _base_src() -> str:
    return subprocess.run(["git", "show", f"{PLAN_BASE}:{_RATES_REL}"], cwd=_REPO, capture_output=True,
                          text=True, encoding="utf-8", check=True).stdout


async def _all_sqls() -> list[str]:
    return await _summary_sqls() + list(await _ledger_sqls())


async def test_the_runs_arm_reads_the_key_from_the_threads_mcp_origin():
    sqls = await _all_sqls()
    assert len(sqls) == 7
    for sql in sqls:
        flat = _flat(sql)
        runs_arm = flat.split("WITH roots AS (", 1)[1].split("UNION ALL", 1)[0]
        assert "t.origin_ref AS api_key_id" in runs_arm
        assert JOIN in runs_arm
        assert "NULL::uuid AS api_key_id" not in runs_arm
        assert "'run_workflow'" in runs_arm and "'ask_agent'" in runs_arm
        assert "'run'::text AS source" in runs_arm


async def test_source_and_the_members_join_are_unchanged():
    sqls = await _all_sqls()
    for sql in sqls:
        flat = _flat(sql)
        assert "WHERE ro.source = 'run'" in flat
        assert "m.run_id = ro.run_id OR m.parent_run_id = ro.run_id" in flat
        assert "m.org_id" not in flat


def test_the_counts_of_the_pinned_texts_equal_the_plan_base():
    base = _base_src()
    for text in ("'run'::text AS source", "WHERE ro.source = 'run'"):
        assert _RATES_SRC.count(text) == base.count(text), text
    assert len([ln for ln in _RATES_SRC.splitlines() if "parent_run_id IS NULL" in ln]) == 1
    assert "m.org_id" not in _RATES_SRC
    assert _RATES_SRC.count(JOIN) == 1, "one join, in the one CTE"


def test_the_join_is_on_the_primary_key_so_no_run_is_multiplied():
    assert re.search(r"LEFT JOIN public\.threads t ON t\.id = r\.thread_id", _RATES_SRC)


async def test_a_run_row_with_a_key_reads_as_mcp_with_its_tool():
    key = uuid4()
    pool = _pool()
    pool.fetchrow.return_value = {"total": 3}
    pool.fetch.return_value = [
        _ledger_row(source="run", api_key_id=key, api_key_label="Laptop", mcp_tool="ask_agent",
                    thread_id=uuid4(), model="gpt-x", input_tokens=10, output_tokens=5),
        _ledger_row(source="run", api_key_id=key, api_key_label="Laptop", mcp_tool="run_workflow",
                    thread_id=uuid4()),
        _ledger_row(source="run", api_key_id=None, api_key_label=None, mcp_tool=None, thread_id=uuid4()),
    ]
    items, _ = await get_spend_runs(pool, uuid4())
    ask, run, plain = items
    assert (ask["source"], ask["api_key_id"], ask["api_key_label"], ask["mcp_tool"]) == (
        "mcp", str(key), "Laptop", "ask_agent")
    assert ask["thread_id"] is not None and ask["input_tokens"] == 10   # the run's own values
    assert (run["source"], run["mcp_tool"]) == ("mcp", "run_workflow")
    assert (plain["source"], plain["api_key_id"], plain["api_key_label"], plain["mcp_tool"]) == (
        "run", None, None, None)


async def test_a_removed_keys_run_still_reads_as_mcp():
    # ON DELETE of a key leaves the thread's origin_ref: the label join finds nothing, and 305's
    # cell reads "MCP · removed key" (source mcp, label None) — never "No Expert".
    pool = _pool()
    pool.fetchrow.return_value = {"total": 1}
    pool.fetch.return_value = [_ledger_row(source="run", api_key_id=uuid4(), api_key_label=None,
                                           mcp_tool="ask_agent", thread_id=uuid4())]
    (item,), _ = await get_spend_runs(pool, uuid4())
    assert item["source"] == "mcp" and item["api_key_label"] is None
