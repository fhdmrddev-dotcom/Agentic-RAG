"""Unit tests for Takeoff Rate Sheet Matcher and Anti-Ambiguity Engine (Phase 220, TAKEOFF-02 / TAKEOFF-03)."""
from __future__ import annotations

import io
import openpyxl
import pytest

from app.services.takeoff.matcher import (
    load_rate_sheet_rows,
    match_takeoff_to_rates,
    resolve_takeoff_item,
)


def _create_synthetic_rate_sheet() -> bytes:
    """Create an in-memory .xlsx rate sheet for testing."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Master Rates"
    ws.append(["Item Code", "Description", "Unit", "Rate (USD)"])
    ws.append(["ST-W250", "Wide flange steel beam W250x33", "m", 120.00])
    ws.append(["ST-C250", "Channel section C250x23", "m", 85.50])
    ws.append(["CL-GYP", "Suspended gypsum ceiling 12.5mm", "m2", 31.00])
    ws.append(["GB-12", "Gypsum board, taped and finished", "m2", 18.75])
    ws.append(["RF-EPDM", "EPDM roof membrane 60 mil", "m2", 42.00])
    ws.append(["DR-3684", "Hollow metal door 36x84 with frame", "ea", 450.00])

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_load_rate_sheet_rows_success():
    """Verify Excel rate sheet rows are loaded with normalized keys."""
    raw_excel = _create_synthetic_rate_sheet()
    rates = load_rate_sheet_rows(raw_excel)

    assert len(rates) == 6
    code_map = {r["code"]: r for r in rates}
    assert "ST-W250" in code_map
    assert code_map["ST-W250"]["rate"] == 120.00
    assert code_map["ST-W250"]["unit"] == "m"
    assert code_map["GB-12"]["rate"] == 18.75


def test_unambiguous_block_matching_exact():
    """Verify unambiguous CAD blocks match single rate lines with basis='read'."""
    rates = load_rate_sheet_rows(_create_synthetic_rate_sheet())
    takeoff_data = {
        "units": "mm",
        "to_m": 0.001,
        "refused": False,
        "blocks": {"W250x33": 5, "C250x23": 4},
        "specs": [],
    }

    boq = match_takeoff_to_rates(takeoff_data, rates)

    assert boq["totals"]["total_estimated_cost"] == pytest.approx(5 * 120.00 + 4 * 85.50)
    assert boq["totals"]["counted_items_cost"] == pytest.approx(5 * 120.00 + 4 * 85.50)
    assert boq["totals"]["ambiguous_count"] == 0

    items_by_src = {i["source_text"]: i for i in boq["items"]}
    assert items_by_src["W250x33"]["basis"] == "read"
    assert items_by_src["W250x33"]["rate_code"] == "ST-W250"
    assert items_by_src["W250x33"]["amount"] == 600.00


def test_anti_ambiguity_rule_gypsum_board_escalates_to_human():
    """Invariant (G-6): '1/2\" GYPSUM BOARD' matching both ceiling & wall board MUST NOT price silently."""
    rates = load_rate_sheet_rows(_create_synthetic_rate_sheet())
    takeoff_data = {
        "units": "mm",
        "to_m": 0.001,
        "refused": False,
        "blocks": {},
        "specs": [r'1/2" GYPSUM BOARD'],
    }

    boq = match_takeoff_to_rates(takeoff_data, rates)

    # 1. Total cost must NOT include the ambiguous item
    assert boq["totals"]["total_estimated_cost"] == 0.0
    assert boq["totals"]["ambiguous_count"] == 1

    # 2. Ambiguous line carries candidate options for reviewer
    item = boq["items"][0]
    assert item["status"] == "ambiguous"
    assert item["basis"] == "ambiguous"
    assert item["rate_code"] is None
    assert item["amount"] is None

    candidate_codes = [c["code"] for c in item["candidates"]]
    assert "CL-GYP" in candidate_codes
    assert "GB-12" in candidate_codes


def test_resolve_ambiguous_item_updates_boq_and_totals():
    """Verify operator disambiguating an item updates the rate and recalculates totals."""
    rates = load_rate_sheet_rows(_create_synthetic_rate_sheet())
    takeoff_data = {
        "units": "mm",
        "to_m": 0.001,
        "refused": False,
        "blocks": {"W250x33": 2},  # 2 * 120 = 240
        "specs": [r'1/2" GYPSUM BOARD'],  # Ambiguous
    }

    boq = match_takeoff_to_rates(takeoff_data, rates)
    assert boq["totals"]["total_estimated_cost"] == 240.00
    assert boq["totals"]["ambiguous_count"] == 1

    # Resolve ambiguous item to GB-12 ($18.75)
    updated_boq = resolve_takeoff_item(boq, "spec:0", "GB-12", rates)

    assert updated_boq["totals"]["ambiguous_count"] == 0
    assert updated_boq["totals"]["total_estimated_cost"] == pytest.approx(240.00 + 18.75)

    resolved_spec = [i for i in updated_boq["items"] if i["item_key"] == "spec:0"][0]
    assert resolved_spec["status"] == "matched"
    assert resolved_spec["rate_code"] == "GB-12"
    assert resolved_spec["amount"] == 18.75


def test_unpriced_item_does_not_break_matcher():
    """Verify unpriced items are marked status='unpriced' without crashing."""
    rates = load_rate_sheet_rows(_create_synthetic_rate_sheet())
    takeoff_data = {
        "units": "mm",
        "to_m": 0.001,
        "refused": False,
        "blocks": {"UNKNOWN_SPECIAL_FIXTURE_XYZ": 1},
        "specs": [],
    }

    boq = match_takeoff_to_rates(takeoff_data, rates)
    assert boq["totals"]["unpriced_count"] == 1
    assert boq["totals"]["total_estimated_cost"] == 0.0
    item = boq["items"][0]
    assert item["status"] == "unpriced"
    assert item["basis"] == "unpriced"


def test_malformed_rate_sheet_raises_valueerror():
    """Verify empty or missing column spreadsheet raises ValueError."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["Wrong Column 1", "Wrong Column 2"])
    ws.append(["A", "B"])
    buf = io.BytesIO()
    wb.save(buf)

    with pytest.raises(ValueError, match="Rate sheet must contain Item Code, Description, and Rate"):
        load_rate_sheet_rows(buf.getvalue())
