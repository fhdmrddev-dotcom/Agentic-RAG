"""End-to-End Integration tests for CAD Takeoff Spike (Phase 220, TAKEOFF-01..04)."""
from __future__ import annotations

import io
import ezdxf
import openpyxl
import pytest
from unittest.mock import MagicMock, patch

from app.services.extractors.aspects.dxf import extract_dxf_takeoff
from app.services.takeoff.matcher import (
    load_rate_sheet_rows,
    match_takeoff_to_rates,
    resolve_takeoff_item,
)


def _build_dxf(unit_code: int = 4) -> bytes:
    doc = ezdxf.new("R2010", units=unit_code)
    msp = doc.modelspace()
    blk = doc.blocks.new("W250x33")
    blk.add_line((0, 0), (1, 1))

    for _ in range(5):
        msp.add_blockref("W250x33", (0, 0))

    msp.add_mtext(r'\A1;1/2" GYPSUM BOARD\PFIRE RATED', dxfattribs={"layer": "SPECS"})

    buf = io.StringIO()
    doc.write(buf)
    return buf.getvalue().encode("utf-8")


def _build_rates() -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Master Rates"
    ws.append(["Item Code", "Description", "Unit", "Rate"])
    ws.append(["ST-W250", "Wide flange beam W250x33", "m", 120.00])
    ws.append(["CL-GYP", "Suspended gypsum ceiling", "m2", 31.00])
    ws.append(["GB-12", "Gypsum board, taped", "m2", 18.75])
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_takeoff_e2e_extraction_matching_and_resolution():
    """Verify end-to-end extraction -> matching -> ambiguity escalation -> operator resolution."""
    # 1. Extract CAD Drawing
    raw_dxf = _build_dxf(unit_code=4)
    takeoff = extract_dxf_takeoff(raw_dxf, filename="level1_plan.dxf")

    assert takeoff["units"] == "mm"
    assert takeoff["refused"] is False
    assert takeoff["blocks"]["W250x33"] == 5
    assert len(takeoff["specs"]) == 1

    # 2. Extract Rate Sheet
    raw_rates = _build_rates()
    rates = load_rate_sheet_rows(raw_rates)
    assert len(rates) == 3

    # 3. Match Takeoff to Rates (Initial Pass)
    boq = match_takeoff_to_rates(takeoff, rates)

    # Invariant: Counted block is exact (5 * 120 = 600 USD)
    assert boq["totals"]["counted_items_cost"] == 600.00
    assert boq["totals"]["total_estimated_cost"] == 600.00

    # Invariant: Ambiguous item is NOT silently priced (G-6 protection against 65% overprice)
    assert boq["totals"]["ambiguous_count"] == 1
    ambiguous_item = [i for i in boq["items"] if i["status"] == "ambiguous"][0]
    assert ambiguous_item["rate_code"] is None
    assert ambiguous_item["amount"] is None
    candidate_codes = [c["code"] for c in ambiguous_item["candidates"]]
    assert "CL-GYP" in candidate_codes
    assert "GB-12" in candidate_codes

    # 4. Operator Resolves Ambiguity to GB-12 ($18.75)
    updated_boq = resolve_takeoff_item(boq, ambiguous_item["item_key"], "GB-12", rates)

    assert updated_boq["totals"]["ambiguous_count"] == 0
    assert updated_boq["totals"]["total_estimated_cost"] == pytest.approx(600.00 + 18.75)
    resolved_item = [i for i in updated_boq["items"] if i["item_key"] == ambiguous_item["item_key"]][0]
    assert resolved_item["status"] == "matched"
    assert resolved_item["rate_code"] == "GB-12"
    assert resolved_item["amount"] == 18.75


def test_takeoff_e2e_unitless_refusal():
    """Verify unitless ($INSUNITS=0) drawing produces honest refusal."""
    raw_dxf = _build_dxf(unit_code=0)
    takeoff = extract_dxf_takeoff(raw_dxf, filename="unitless_plan.dxf")

    assert takeoff["units"] == "unitless"
    assert takeoff["refused"] is True
    assert "INSUNITS=0" in takeoff["refusal_reason"]

    rates = load_rate_sheet_rows(_build_rates())
    boq = match_takeoff_to_rates(takeoff, rates)

    assert boq["refused"] is True
    assert "INSUNITS=0" in boq["refusal_reason"]
