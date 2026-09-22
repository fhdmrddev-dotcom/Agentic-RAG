"""Unit tests for the operator spend API sub-router (/admin/spend).

Phase 257 (METER-01, METER-02, METER-07).
"""

from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.db.rates import SpendSummary
from app.dependencies import require_operator
from app.main import app
from app.services.pricing_service import ModelRate


@pytest.fixture
def operator_user():
    return {"id": str(uuid4()), "email": "operator@example.com"}


def test_spend_routes_404_for_unauthenticated_or_non_operator(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """Non-operator gets byte-identical 404 on /admin/spend routes (ADMIN-01 inheritance)."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result(None)

    for path in ("/admin/spend/summary", "/admin/spend/runs", "/admin/spend/rates"):
        res = client.get(path, headers=auth_headers)
        assert res.status_code == 404
        assert res.json() == {"detail": "Not Found"}


def test_get_spend_summary_honesty(client, operator_user, monkeypatch):
    """GET /admin/spend/summary returns spend, unrated count footnote data, and coverage blind spots."""
    app.dependency_overrides[require_operator] = lambda: operator_user
    org_id = uuid4()

    mock_summary = SpendSummary(
        total_spend_usd=Decimal("48.2050"),
        rated_runs_count=92,
        unrated_runs_count=8,
        # CR-06: 92 runs HAVE a rate; 12 of them recorded nothing, so 80 actually priced.
        unmeasured_runs_count=12,
        incomplete_coverage_count=5,
        total_input_tokens=1500000,
        total_output_tokens=400000,
        daily_spend=[
            {"date": "2026-09-18", "spend_usd": "24.1025", "rated_runs": 46, "unrated_runs": 4},
            {"date": "2026-09-19", "spend_usd": "24.1025", "rated_runs": 46, "unrated_runs": 4},
        ],
        model_breakdown=[
            {
                "model_name": "gpt-4o",
                "provider": "openai",
                "spend_usd": "48.2050",
                "input_tokens": 1500000,
                "output_tokens": 400000,
                "total_tokens": 1900000,
                "run_count": 92,
                "rated_count": 92,
                "unrated_count": 0,
                "is_rated": True,
            },
            {
                "model_name": "qwen-2.5-72b",
                "provider": "together",
                "spend_usd": None,
                "input_tokens": 200000,
                "output_tokens": 50000,
                "total_tokens": 250000,
                "run_count": 8,
                "rated_count": 0,
                "unrated_count": 8,
                "is_rated": False,
            },
        ],
    )

    with patch("app.api.admin_spend._resolve_operator_org_id", AsyncMock(return_value=org_id)), \
         patch("app.api.admin_spend.get_org_spend_summary", AsyncMock(return_value=mock_summary)), \
         patch("app.dependencies.get_pg_pool", AsyncMock()):

        res = client.get(f"/admin/spend/summary?org_id={org_id}")

        assert res.status_code == 200
        data = res.json()
        assert data["org_id"] == str(org_id)
        assert data["total_spend_usd"] == "48.2050"
        assert data["rated_runs_count"] == 92
        assert data["unrated_runs_count"] == 8
        # CR-06: the third state must REACH THE WIRE, not merely exist on the dataclass.
        # This phase has now shipped the declared-but-never-emitted bug twice (SC#4's dead
        # badge, and the response_model that drops undeclared keys silently), so the count
        # that distinguishes "no rate" from "no tokens" is pinned at the boundary.
        assert data["unmeasured_runs_count"] == 12
        assert data["incomplete_coverage_count"] == 5
        assert data["has_unrated_runs"] is True
        assert data["has_incomplete_coverage"] is True
        assert len(data["daily_spend"]) == 2
        assert len(data["model_breakdown"]) == 2

        # Verify unrated model in breakdown does NOT display $0.00
        unrated_item = [m for m in data["model_breakdown"] if m["model_name"] == "qwen-2.5-72b"][0]
        assert unrated_item["spend_usd"] is None
        assert unrated_item["is_rated"] is False

    app.dependency_overrides.clear()


def test_get_spend_runs_list(client, operator_user):
    """GET /admin/spend/runs returns attributable runs with cost and coverage."""
    app.dependency_overrides[require_operator] = lambda: operator_user
    org_id = uuid4()
    run_id = uuid4()

    mock_runs = [
        {
            "run_id": str(run_id),
            "thread_id": str(uuid4()),
            "status": "completed",
            "model": "gpt-4o",
            "provider": "openai",
            "started_at": "2026-09-19T12:00:00Z",
            "completed_at": "2026-09-19T12:00:05Z",
            "input_tokens": 1000,
            "output_tokens": 500,
            "cost_usd": "0.0075",
            "is_rated": True,
            "token_coverage": ["agent", "single", "batch", "emit"],
            "is_coverage_complete": True,
        }
    ]

    with patch("app.api.admin_spend._resolve_operator_org_id", AsyncMock(return_value=org_id)), \
         patch("app.api.admin_spend.get_spend_runs", AsyncMock(return_value=(mock_runs, 1))), \
         patch("app.dependencies.get_pg_pool", AsyncMock()):

        res = client.get(f"/admin/spend/runs?org_id={org_id}&filter_status=rated&time_range=7d")

        assert res.status_code == 200
        data = res.json()
        assert data["total_count"] == 1
        assert len(data["runs"]) == 1
        assert data["runs"][0]["run_id"] == str(run_id)
        assert data["runs"][0]["cost_usd"] == "0.0075"
        assert data["runs"][0]["is_rated"] is True
        assert data["runs"][0]["is_coverage_complete"] is True

    app.dependency_overrides.clear()


def test_get_and_post_rates(client, operator_user):
    """GET /admin/spend/rates and POST /admin/spend/rates reprice model."""
    app.dependency_overrides[require_operator] = lambda: operator_user
    org_id = uuid4()
    now = datetime(2026, 9, 19, 12, 0, tzinfo=timezone.utc)

    mock_rate = ModelRate(
        id=uuid4(),
        model_id="gpt-4o",
        provider="openai",
        input_cost_per_million=Decimal("2.500000"),
        output_cost_per_million=Decimal("10.000000"),
        effective_from=now,
    )

    with patch("app.api.admin_spend.list_model_rates", AsyncMock(return_value=[{
        "id": str(mock_rate.id),
        "model_name": "gpt-4o",
        "provider": "openai",
        "input_cost_per_million": "2.500000",
        "output_cost_per_million": "10.000000",
        "effective_from": now.isoformat(),
        "effective_to": None,
        "org_id": None,
        "created_at": now.isoformat(),
    }])), \
         patch("app.api.admin_spend.reprice_model", AsyncMock(return_value=mock_rate)), \
         patch("app.dependencies.get_pg_pool", AsyncMock()), \
         patch("app.dependencies.operator_audit_floor", AsyncMock()):

        # 1. GET /rates
        res_get = client.get("/admin/spend/rates")
        assert res_get.status_code == 200
        rates = res_get.json()["rates"]
        assert len(rates) == 1
        assert rates[0]["model_name"] == "gpt-4o"

        # 2. POST /rates
        payload = {
            "model_id": "gpt-4o",
            "input_cost_per_million": "2.500000",
            "output_cost_per_million": "10.000000",
            "provider": "openai",
        }
        res_post = client.post("/admin/spend/rates", json=payload)
        assert res_post.status_code == 200
        post_data = res_post.json()
        assert post_data["status"] == "created"
        assert post_data["rate"]["model_id"] == "gpt-4o"
        assert post_data["rate"]["input_cost_per_million"] == "2.500000"

        # 3. Invalid payload (negative cost)
        bad_payload = {
            "model_id": "gpt-4o",
            "input_cost_per_million": "-1.000000",
            "output_cost_per_million": "10.000000",
        }
        res_bad = client.post("/admin/spend/rates", json=bad_payload)
        assert res_bad.status_code == 422

    app.dependency_overrides.clear()


def test_reprice_duplicate_answers_409_with_the_reason_not_500(client, operator_user):
    """CR-05 at the HTTP boundary: the refusal must SURVIVE the route, as a 409 whose body
    carries the reason verbatim.

    ⚠ The DB-layer test proves the exception is raised; it says nothing about what the
    operator sees. An unhandled raise here is a 500 with a generic body, and the frontend
    renders `err.detail` — so if the detail is not the sentence, the modal shows nothing
    useful. That gap is exactly how this phase shipped a dead badge: a thing that existed at
    one layer and never reached the next.
    """
    from app.db.rates import RateAlreadyEffectiveError

    app.dependency_overrides[require_operator] = lambda: operator_user

    reason = (
        "A rate for gpt-4o already takes effect at 2026-09-19T12:00:00+00:00. "
        "Rates are append-only, so an existing effective date cannot be overwritten - "
        "choose a different effective date."
    )

    with patch(
        "app.api.admin_spend.reprice_model",
        AsyncMock(side_effect=RateAlreadyEffectiveError(reason)),
    ), patch("app.dependencies.get_pg_pool", AsyncMock()),          patch("app.dependencies.operator_audit_floor", AsyncMock()):
        res = client.post(
            "/admin/spend/rates",
            json={
                "model_id": "gpt-4o",
                "input_cost_per_million": "3.000000",
                "output_cost_per_million": "12.000000",
                "provider": "openai",
            },
        )

    assert res.status_code == 409, f"expected a refusal, got {res.status_code}"
    assert res.json()["detail"] == reason

    app.dependency_overrides.clear()
