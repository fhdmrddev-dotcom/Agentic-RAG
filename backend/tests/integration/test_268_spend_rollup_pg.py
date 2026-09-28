"""Phase 268 (METER-08 / D-268-09 / D-268-10 / D-268-20 / D-268-21 / D-268-08) — the spend SQL on REAL Postgres.

268-02's unit tests pin the SHAPE of the one ``per_root`` CTE in ``db/rates.py`` against mocked pools.
This file proves the ARITHMETIC on the real database, with every awkward row shape present at once,
against the REAL ``get_org_spend_summary`` / ``get_spend_runs`` (nothing about the query is mocked —
the fixture is data, the functions are the product).

Fixture — a FRESH org with its own ``model_rates`` rows (model ids unique to this run, so no global
rate can leak in; ``uq_model_rates_identity`` has no org column):

  R1  E1  model A  (1000 / 500)  + S1 sub-agent model B (2000 / 300) — priced at ITS OWN rate
  R9  E1  model A  (130 / 50)    a CONTINUED root: the persisted, already-accumulated sum (D-268-20)
  R2  E2  model A  (400 / 100)
  R8  E3  model 'unknown'/'unknown' PLACEHOLDER SHELL (100 / 40) + S8 rated sub-agent (60 / 24)
          — the shell's box already sums its sub-agent, so the line reads 100, never 160 (D-268-21);
            its USD is the sub-agent's price only (the shell has no rate)
  R3  a bundle id that does not exist                → "Deleted Expert"
  R4  another org's bundle id (name "268-FOREIGN-…") → still "Deleted Expert": the name join is
      org-constrained (T-268-11), so the foreign name must never appear
  R5  No Expert (attributed, expert_id NULL) model B (300 / 30)
  R6  No Expert model A (100 / 100) + S6 UNRATED sub-agent (50 / 50) → unpriced_subagents = 1
  R7  pre-268 (expert_attributed false) model A (200 / 20) → "Not recorded (before 268)"

Expected money is computed INDEPENDENTLY in Python with ``compute_token_cost_usd`` at each row's own
rate (T-268-33: never a number compared with itself) and every comparison is in INTEGER
TEN-THOUSANDTHS — no float equality anywhere.

Everything seeded is deleted in ``finally``. Skip-guarded on the local Postgres :54322 — run with
``-rs``; a skip is a SKIP, never a pass.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID, uuid4

import pytest

from app.db.rates import get_org_spend_summary, get_spend_runs
from app.services.pricing_service import ModelRate, compute_token_cost_usd
from tests.integration._rls_harness import requires_pg
from tests.integration.test_163_rls_documents import _drop_user

pytestmark = requires_pg

TEN_THOUSANDTHS = Decimal("10000")

RATES = {
    # model key -> (input $/M, output $/M); U has NO rate on purpose.
    "A": (Decimal("2.00"), Decimal("8.00")),
    "B": (Decimal("0.50"), Decimal("1.50")),
}


def _t(value) -> int:
    """A money value as integer ten-thousandths. None -> 0 (an unpriced member adds nothing)."""
    if value is None:
        return 0
    d = Decimal(str(value)) * TEN_THOUSANDTHS
    assert d == d.to_integral_value(), f"{value} is not a 4-place figure"
    return int(d)


@pytest.fixture
async def spend_org(pg_pool):
    uid = uuid4()
    tag = uuid4().hex[:8]
    models = {"A": f"268it-a-{tag}", "B": f"268it-b-{tag}", "U": f"268it-unrated-{tag}"}
    created_orgs: list[UUID] = []
    try:
        await pg_pool.execute(
            "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
            uid, f"phase-268-spend-{uid}@test.local",
        )
        # handle_new_user may provision a personal org; track it so teardown removes it.
        for r in await pg_pool.fetch("SELECT org_id FROM public.org_members WHERE user_id = $1", uid):
            created_orgs.append(r["org_id"])

        org = uuid4()
        other = uuid4()
        for o, name in ((org, f"268-spend-{tag}"), (other, f"268-spend-other-{tag}")):
            await pg_pool.execute(
                "INSERT INTO public.organizations (id, name) VALUES ($1, $2)", o, name,
            )
            created_orgs.append(o)
        await pg_pool.execute(
            "INSERT INTO public.org_members (org_id, user_id, role) VALUES ($1, $2, 'member')",
            org, uid,
        )

        eff = datetime.now(timezone.utc) - timedelta(days=30)
        for key, (i, o) in RATES.items():
            await pg_pool.execute(
                "INSERT INTO public.model_rates (model_id, provider, input_cost_per_million, "
                "output_cost_per_million, effective_from, org_id) VALUES ($1, 'openai', $2, $3, $4, $5)",
                models[key], i, o, eff, org,
            )

        e1, e2, e3 = uuid4(), uuid4(), uuid4()
        e_deleted = uuid4()  # never inserted anywhere
        e_foreign = uuid4()  # a real bundle — in ANOTHER org
        for eid, bundle_org, name in (
            (e1, org, f"268-E1-{tag}"),
            (e2, org, f"268-E2-{tag}"),
            (e3, org, f"268-E3-shell-{tag}"),
            (e_foreign, other, f"268-FOREIGN-{tag}"),
        ):
            await pg_pool.execute(
                "INSERT INTO public.expert_bundles (id, org_id, created_by, name, slug, scope_mode) "
                "VALUES ($1, $2, $3, $4, $5, 'biased')",
                eid, bundle_org, uid, name, f"{name.lower()}",
            )

        thread_id = await pg_pool.fetchval(
            "INSERT INTO public.threads (user_id, title, org_id) VALUES ($1, '268 spend', $2) RETURNING id",
            uid, org,
        )

        started = datetime.now(timezone.utc) - timedelta(hours=1)
        runs: dict[str, dict] = {}

        async def run(name, *, model, tin, tout, expert=None, attributed=True, parent=None,
                      provider="openai", continues=0):
            rid = uuid4()
            await pg_pool.execute(
                "INSERT INTO public.runs (run_id, thread_id, user_id, status, model, provider, "
                "started_at, completed_at, input_tokens, output_tokens, parent_run_id, org_id, "
                "expert_id, expert_attributed, continues_used) "
                "VALUES ($1, $2, $3, 'completed', $4, $5, $6, $6, $7, $8, $9, $10, $11, $12, $13)",
                rid, thread_id, uid, model, provider, started, tin, tout,
                runs[parent]["id"] if parent else None, org, expert, attributed, continues,
            )
            runs[name] = {"id": rid, "model": model, "provider": provider, "in": tin, "out": tout,
                          "rate_key": next((k for k, m in models.items() if m == model), None)}

        await run("R1", model=models["A"], tin=1000, tout=500, expert=e1)
        await run("S1", model=models["B"], tin=2000, tout=300, expert=e1, parent="R1")
        await run("R9", model=models["A"], tin=130, tout=50, expert=e1, continues=1)
        await run("R2", model=models["A"], tin=400, tout=100, expert=e2)
        await run("R8", model="unknown", provider="unknown", tin=100, tout=40, expert=e3)
        await run("S8", model=models["B"], tin=60, tout=24, expert=e3, parent="R8")
        await run("R3", model=models["B"], tin=700, tout=70, expert=e_deleted)
        await run("R4", model=models["A"], tin=10, tout=10, expert=e_foreign)
        await run("R5", model=models["B"], tin=300, tout=30)
        await run("R6", model=models["A"], tin=100, tout=100)
        await run("S6", model=models["U"], tin=50, tout=50, parent="R6")
        await run("R7", model=models["A"], tin=200, tout=20, attributed=False)

        yield {
            "org": org, "uid": uid, "tag": tag, "models": models, "runs": runs,
            "e1": e1, "e2": e2, "e3": e3, "e_deleted": e_deleted, "e_foreign": e_foreign,
        }
    finally:
        for sql in (
            "DELETE FROM public.runs WHERE user_id = $1 AND parent_run_id IS NOT NULL",
            "DELETE FROM public.runs WHERE user_id = $1",
            "DELETE FROM public.threads WHERE user_id = $1",
            "DELETE FROM public.expert_bundles WHERE created_by = $1",
        ):
            try:
                await pg_pool.execute(sql, uid)
            except Exception:
                pass
        for model in models.values():
            try:
                await pg_pool.execute("DELETE FROM public.model_rates WHERE model_id = $1", model)
            except Exception:
                pass
        await _drop_user(pg_pool, uid)
        for o in created_orgs:
            try:
                await pg_pool.execute("DELETE FROM public.organizations WHERE id = $1", o)
            except Exception:
                pass


def _price(row: dict) -> Decimal | None:
    """The independent Python price of ONE run row at its OWN rate."""
    key = row["rate_key"]
    if key not in RATES:
        return None
    i, o = RATES[key]
    rate = ModelRate(model_id=row["model"], input_cost_per_million=i, output_cost_per_million=o,
                     effective_from=datetime.now(timezone.utc))
    return compute_token_cost_usd(row["in"], row["out"], rate).cost_usd


def _expected(runs: dict, roots: list[str], subs: dict[str, str]) -> dict:
    """Expected line figures: USD = every member at its own rate; tokens honour the shell rule."""
    usd = 0
    tin = tout = 0
    for r in roots:
        members = [r] + [s for s, p in subs.items() if p == r]
        is_shell = runs[r]["model"] == "unknown" and runs[r]["provider"] == "unknown"
        for m in members:
            usd += _t(_price(runs[m]))
            if m == r or not is_shell:
                tin += runs[m]["in"]
                tout += runs[m]["out"]
    return {"usd": usd, "in": tin, "out": tout, "runs": len(roots)}


SUBS = {"S1": "R1", "S8": "R8", "S6": "R6"}
LINES = {
    "e1": ["R1", "R9"],
    "e2": ["R2"],
    "e3": ["R8"],
    "e_deleted": ["R3"],
    "e_foreign": ["R4"],
    "none": ["R5", "R6"],
    "unrecorded": ["R7"],
}


def _line_key(s, name: str) -> str:
    return name if name in ("none", "unrecorded") else str(s[name])


@pytest.mark.asyncio
async def test_every_expert_line_reconciles_to_the_window_in_ten_thousandths(pg_pool, spend_org):
    s = spend_org
    summary = await get_org_spend_summary(pg_pool, s["org"])
    lines = {ln["key"]: ln for ln in summary.expert_breakdown}

    # Non-vacuity: every line shape is present in the real result.
    for name in LINES:
        assert _line_key(s, name) in lines, f"line {name} missing from {sorted(lines)}"
    assert len(lines) == len(LINES), f"unexpected extra lines: {sorted(lines)}"

    # Σ lines == window, in integer ten-thousandths and in runs.
    assert sum(_t(ln["spend_usd"]) for ln in lines.values()) == _t(summary.window_total_usd)
    assert sum(ln["run_count"] for ln in lines.values()) == summary.window_run_count == 9

    # Each line == the independent Python price of its roots + sub-agents at their own rates.
    grand = 0
    for name, roots in LINES.items():
        want = _expected(s["runs"], roots, SUBS)
        got = lines[_line_key(s, name)]
        assert _t(got["spend_usd"]) == want["usd"], (name, got["spend_usd"], want["usd"])
        assert got["input_tokens"] == want["in"], (name, got["input_tokens"], want["in"])
        assert got["output_tokens"] == want["out"], (name, got["output_tokens"], want["out"])
        assert got["run_count"] == want["runs"], name
        grand += want["usd"]
    assert grand == _t(summary.window_total_usd), "independent grand total != window_total_usd"


@pytest.mark.asyncio
async def test_the_placeholder_shell_counts_its_box_once_and_prices_only_its_sub_agent(pg_pool, spend_org):
    s = spend_org
    summary = await get_org_spend_summary(pg_pool, s["org"])
    shell = next(ln for ln in summary.expert_breakdown if ln["key"] == str(s["e3"]))
    # 100, never 160: the shell's run_usage_box already includes its sub-agent (D-268-21).
    assert shell["input_tokens"] == 100, f"shell line double-counted: {shell['input_tokens']} (want 100)"
    assert shell["output_tokens"] == 40
    # USD = the sub-agent's own price only (the shell model has no rate).
    assert _t(shell["spend_usd"]) == _t(_price(s["runs"]["S8"])) > 0


@pytest.mark.asyncio
async def test_e1_prices_the_sub_agent_at_its_own_rate_and_the_continued_root_at_its_accumulated_sum(
    pg_pool, spend_org,
):
    s = spend_org
    r = s["runs"]
    summary = await get_org_spend_summary(pg_pool, s["org"])
    e1 = next(ln for ln in summary.expert_breakdown if ln["key"] == str(s["e1"]))
    want = _t(_price(r["R1"])) + _t(_price(r["S1"])) + _t(_price(r["R9"]))
    assert _t(e1["spend_usd"]) == want
    # Non-vacuity: pricing S1 at the ROOT's model would give a different number.
    s1_at_root_rate = dict(r["S1"], rate_key="A")
    assert _t(_price(s1_at_root_rate)) != _t(_price(r["S1"]))
    # The continued root's tokens are the persisted accumulated sum (130 / 50), not a segment.
    assert e1["input_tokens"] == 1000 + 2000 + 130
    assert e1["output_tokens"] == 500 + 300 + 50


@pytest.mark.asyncio
async def test_none_unrecorded_and_deleted_lines_read_as_themselves_and_no_foreign_name_leaks(
    pg_pool, spend_org,
):
    s = spend_org
    summary = await get_org_spend_summary(pg_pool, s["org"])
    lines = {ln["key"]: ln for ln in summary.expert_breakdown}
    assert lines["none"]["run_count"] == 2 and lines["none"]["expert_id"] is None
    assert lines["unrecorded"]["run_count"] == 1
    for name in ("e_deleted", "e_foreign"):
        ln = lines[str(s[name])]
        assert ln["deleted"] is True and ln["name"] is None, (name, ln)
    names = {ln["name"] for ln in summary.expert_breakdown}
    assert f"268-FOREIGN-{s['tag']}" not in names, "another org's Expert name leaked into this cockpit"
    assert lines[str(s["e1"])]["name"] == f"268-E1-{s['tag']}" and lines[str(s["e1"])]["deleted"] is False
    # Order: Experts, then none, then unrecorded (D-268-10).
    keys = [ln["key"] for ln in summary.expert_breakdown]
    assert keys[-2:] == ["none", "unrecorded"]
    # The unrated sub-agent under a rated root is named, not silently dropped (D-268-25).
    assert summary.unpriced_subagents == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("which", ["e1", "none", "unrecorded", "e3"])
async def test_each_filter_value_narrows_every_card_to_the_same_root_set(pg_pool, spend_org, which):
    s = spend_org
    value = _line_key(s, which)
    unfiltered = await get_org_spend_summary(pg_pool, s["org"])
    line = next(ln for ln in unfiltered.expert_breakdown if ln["key"] == value)
    want_usd = _t(line["spend_usd"])
    assert want_usd > 0, "non-vacuity: a zero line proves nothing about narrowing"

    f = await get_org_spend_summary(pg_pool, s["org"], expert=value)
    assert _t(f.total_spend_usd) == want_usd, "KPI 1"
    assert sum(_t(d["spend_usd"]) for d in f.daily_spend) == want_usd, "daily chart"
    assert sum(_t(m["spend_usd"]) for m in f.model_breakdown) == want_usd, "model donut"
    assert f.total_input_tokens == line["input_tokens"]
    assert sum(m["input_tokens"] for m in f.model_breakdown) == line["input_tokens"]
    # The navigator stays unfiltered while a filter is on (D-268-10).
    assert _t(f.window_total_usd) == _t(unfiltered.window_total_usd)
    assert len(f.expert_breakdown) == len(unfiltered.expert_breakdown)

    # The ledger, paged small so the Σ really crosses pages.
    ledger_sum, seen, offset = 0, 0, 0
    first_total = None
    while True:
        items, total = await get_spend_runs(pg_pool, s["org"], limit=1, offset=offset, expert=value)
        first_total = total if first_total is None else first_total
        if not items:
            break
        ledger_sum += sum(_t(i["cost_usd"]) for i in items)
        seen += len(items)
        offset += len(items)
    assert first_total == line["run_count"] == seen, "ledger COUNT and rows"
    assert ledger_sum == want_usd, "ledger Σ cost"


@pytest.mark.asyncio
async def test_the_unfiltered_ledger_count_equals_the_window_run_count(pg_pool, spend_org):
    s = spend_org
    summary = await get_org_spend_summary(pg_pool, s["org"])
    items, total = await get_spend_runs(pg_pool, s["org"], limit=50)
    assert total == len(items) == summary.window_run_count
    assert sum(_t(i["cost_usd"]) for i in items) == _t(summary.window_total_usd)
    by_id = {i["run_id"]: i for i in items}
    r1 = by_id[str(s["runs"]["R1"]["id"])]
    assert r1["subagent_count"] == 1 and r1["expert_id"] == str(s["e1"])
    r7 = by_id[str(s["runs"]["R7"]["id"])]
    assert r7["expert_attributed"] is False
