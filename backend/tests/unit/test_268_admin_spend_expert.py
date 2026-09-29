"""Phase 268 plan 02 — the ONE `expert` filter on both spend routes (D-268-08, T-268-10).

The 257 "two dialects" defect was a filter that reached one of two endpoints. The Expert filter
is therefore the SAME param, with the SAME validation, on /summary and /runs — and a value that
is not `none`, `unrecorded` or a uuid never reaches the SQL layer at all (422 before the call).
"""

from __future__ import annotations

from decimal import Decimal
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.db.rates import SpendSummary
from app.dependencies import require_operator
from app.main import app

_257_SUMMARY_KEYS = {
    "org_id",
    "total_spend_usd",
    "rated_runs_count",
    "unrated_runs_count",
    "unmeasured_runs_count",
    "incomplete_coverage_count",
    "total_input_tokens",
    "total_output_tokens",
    "daily_spend",
    "model_breakdown",
    "has_unrated_runs",
    "has_incomplete_coverage",
}


@pytest.fixture
def operator():
    app.dependency_overrides[require_operator] = lambda: {"id": str(uuid4()), "email": "op@x.io"}
    yield
    app.dependency_overrides.clear()


def _summary(**over) -> SpendSummary:
    kw = dict(
        total_spend_usd=Decimal("1.2500"),
        rated_runs_count=3,
        unrated_runs_count=1,
        unmeasured_runs_count=0,
        incomplete_coverage_count=0,
        total_input_tokens=100,
        total_output_tokens=50,
        daily_spend=[],
        model_breakdown=[],
        expert_breakdown=[
            dict(
                key="none", expert_id=None, name=None, deleted=False, scope_mode=None,
                run_count=4, input_tokens=100, output_tokens=50, spend_usd="1.2500",
                unrated_count=1,
            )
        ],
        window_total_usd=Decimal("1.2500"),
        window_run_count=4,
        unpriced_subagents=2,
    )
    kw.update(over)
    return SpendSummary(**kw)


def _patches(summary_mock=None, runs_mock=None):
    org = uuid4()
    return org, (
        patch("app.api.admin_spend._resolve_operator_org_id", AsyncMock(return_value=org)),
        patch("app.api.admin_spend.get_org_spend_summary", summary_mock or AsyncMock(return_value=_summary())),
        patch("app.api.admin_spend.get_spend_runs", runs_mock or AsyncMock(return_value=([], 0))),
        patch("app.dependencies.get_pg_pool", AsyncMock()),
    )


@pytest.mark.parametrize(
    "query,expected",
    [
        ("", None),
        ("?expert=none", "none"),
        ("?expert=unrecorded", "unrecorded"),
        ("?expert=3F2504E0-4F89-11D3-9A0C-0305E82C3301", "3f2504e0-4f89-11d3-9a0c-0305e82c3301"),
    ],
)
def test_summary_forwards_the_expert_filter(client, operator, query, expected):
    summary_mock = AsyncMock(return_value=_summary())
    _, ps = _patches(summary_mock=summary_mock)
    with ps[0], ps[1], ps[2], ps[3]:
        res = client.get(f"/admin/spend/summary{query}")
    assert res.status_code == 200, res.text
    assert summary_mock.await_args.kwargs["expert"] == expected


@pytest.mark.parametrize(
    "query,expected",
    [
        ("", None),
        ("?expert=none&offset=50", "none"),
        ("?expert=unrecorded&time_range=7d", "unrecorded"),
        ("?expert=3f2504e0-4f89-11d3-9a0c-0305e82c3301", "3f2504e0-4f89-11d3-9a0c-0305e82c3301"),
    ],
)
def test_runs_forwards_the_same_filter(client, operator, query, expected):
    runs_mock = AsyncMock(return_value=([], 0))
    _, ps = _patches(runs_mock=runs_mock)
    with ps[0], ps[1], ps[2], ps[3]:
        res = client.get(f"/admin/spend/runs{query}")
    assert res.status_code == 200, res.text
    assert runs_mock.await_args.kwargs["expert"] == expected


@pytest.mark.parametrize(
    "bad",
    [
        "garbage",
        "NONE' OR 1=1",
        "none;",
        "3f2504e0-4f89-11d3-9a0c-0305e82c330",  # 35 chars
        "3f2504e0-4f89-11d3-9a0c-0305e82c3301x",
    ],
)
@pytest.mark.parametrize("route", ["/admin/spend/summary", "/admin/spend/runs"])
def test_a_malformed_expert_is_422_and_never_reaches_the_query(client, operator, route, bad):
    summary_mock = AsyncMock(return_value=_summary())
    runs_mock = AsyncMock(return_value=([], 0))
    _, ps = _patches(summary_mock=summary_mock, runs_mock=runs_mock)
    with ps[0], ps[1], ps[2], ps[3]:
        res = client.get(route, params={"expert": bad})
    assert res.status_code == 422, res.text
    summary_mock.assert_not_awaited()
    runs_mock.assert_not_awaited()


def test_summary_carries_the_breakdown_and_window_and_keeps_every_257_key(client, operator):
    _, ps = _patches()
    with ps[0], ps[1], ps[2], ps[3]:
        res = client.get("/admin/spend/summary")
    assert res.status_code == 200
    data = res.json()
    assert _257_SUMMARY_KEYS <= set(data), _257_SUMMARY_KEYS - set(data)
    assert data["expert_breakdown"][0]["key"] == "none"
    assert data["expert_breakdown"][0]["spend_usd"] == "1.2500"
    # String, like total_spend_usd: a Decimal must never round-trip through a float.
    assert data["window_total_usd"] == "1.2500"
    assert data["window_run_count"] == 4
    assert data["unpriced_subagents"] == 2


def test_window_total_is_null_when_the_window_was_never_measured(client, operator):
    summary_mock = AsyncMock(return_value=_summary(window_total_usd=None))
    _, ps = _patches(summary_mock=summary_mock)
    with ps[0], ps[1], ps[2], ps[3]:
        res = client.get("/admin/spend/summary")
    assert res.json()["window_total_usd"] is None


def test_WR05_the_summary_payload_carries_partly_priced_harness_runs(client, operator):
    """D-268-28: the disclosure's N travels on the wire beside the 268 fields."""
    _, ps = _patches(summary_mock=AsyncMock(return_value=_summary(partly_priced_harness_runs=2)))
    with ps[0], ps[1], ps[2], ps[3]:
        res = client.get("/admin/spend/summary")
    assert res.status_code == 200
    assert res.json()["partly_priced_harness_runs"] == 2
