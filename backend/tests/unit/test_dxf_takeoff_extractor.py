"""Unit tests for DXF Takeoff Extractor (Phase 220, TAKEOFF-01)."""
from __future__ import annotations

import io
import pytest
import ezdxf

from app.services.extractors.aspects.dxf import (
    clean_cad_text,
    extract_dxf_takeoff,
    UNITS,
)


def _create_synthetic_dxf(
    unit_code: int = 4,  # 4 = mm
    blocks: dict[str, int] | None = None,
    specs: list[str] | None = None,
    dimensions: list[float] | None = None,
) -> bytes:
    """Create a synthetic DXF in memory for testing."""
    doc = ezdxf.new("R2010", units=unit_code)
    msp = doc.modelspace()

    # Define blocks if needed
    blocks = blocks or {}
    for name, count in blocks.items():
        if name not in doc.blocks:
            blk = doc.blocks.new(name=name)
            blk.add_line((0, 0), (10, 10))
        for _ in range(count):
            msp.add_blockref(name, (0, 0))

    # Add text annotations
    specs = specs or []
    for txt in specs:
        msp.add_mtext(txt, dxfattribs={"layer": "SPECS"})

    # Add dimensions
    dimensions = dimensions or []
    for dim_val in dimensions:
        dim = msp.add_linear_dim(
            base=(0, 10),
            p1=(0, 0),
            p2=(dim_val, 0),
            override={"dimtxt": 2.5},
        )
        dim.render()

    # Add lines
    msp.add_line((0, 0), (100, 0), dxfattribs={"layer": "WALLS"})
    msp.add_line((0, 10), (100, 10), dxfattribs={"layer": "WALLS"})

    buf = io.StringIO()
    doc.write(buf)
    return buf.getvalue().encode("utf-8")


def test_clean_cad_text_formatting_codes():
    """Verify AutoCAD MTEXT formatting tags are stripped cleanly."""
    raw = r"\A1;{\H0.8x;\S1/2;\"} GYPSUM BOARD\P\W1.15;TAPED AND FINISHED%%C"
    cleaned = clean_cad_text(raw)
    assert "GYPSUM BOARD" in cleaned
    assert "TAPED AND FINISHED" in cleaned
    assert r"\A1;" not in cleaned
    assert r"\P" not in cleaned
    assert r"\W1.15;" not in cleaned


def test_dxf_extraction_happy_path():
    """Verify blocks, dimensions, annotations, and units are extracted from valid DXF."""
    raw_dxf = _create_synthetic_dxf(
        unit_code=4,  # mm
        blocks={"W250x33": 5, "C250x23": 3, "DOOR_36x84": 2},
        specs=[
            r"\A1;1/2\" GYPSUM BOARD\PFIRE RATED",
            "EPDM ROOF MEMBRANE 60 MIL",
        ],
        dimensions=[1200.0, 3600.0],
    )

    takeoff = extract_dxf_takeoff(raw_dxf, filename="level1_plan.dxf")

    assert takeoff["units"] == "mm"
    assert takeoff["insunits_code"] == 4
    assert takeoff["to_m"] == 0.001
    assert takeoff["refused"] is False
    assert takeoff["refusal_reason"] is None

    # Blocks check
    assert takeoff["blocks"]["W250x33"] == 5
    assert takeoff["blocks"]["C250x23"] == 3
    assert takeoff["blocks"]["DOOR_36x84"] == 2

    # Specs check
    assert any("GYPSUM BOARD FIRE RATED" in s for s in takeoff["specs"])
    assert any("EPDM ROOF MEMBRANE 60 MIL" in s for s in takeoff["specs"])

    # Line lengths
    assert "WALLS" in takeoff["length_by_layer"]
    assert takeoff["length_by_layer"]["WALLS"] == pytest.approx(200.0, rel=1e-3)

    # Searchable text summary
    assert "Counted Block Items" in takeoff["text_summary"]
    assert "W250x33" in takeoff["text_summary"]


def test_dxf_unitless_refusal():
    """Verify unitless ($INSUNITS=0) DXF is refused and not assumed to be mm (G-6)."""
    raw_dxf = _create_synthetic_dxf(unit_code=0, blocks={"W250x33": 2})

    takeoff = extract_dxf_takeoff(raw_dxf, filename="unitless.dxf")

    assert takeoff["units"] == "unitless"
    assert takeoff["insunits_code"] == 0
    assert takeoff["to_m"] is None
    assert takeoff["refused"] is True
    assert "INSUNITS=0" in takeoff["refusal_reason"]
    assert "Refusing to convert lengths" in takeoff["refusal_reason"]


def test_dxf_corrupt_fails_honestly():
    """Verify invalid or corrupt DXF file raises ValueError with clear message."""
    garbage = b"NOT_A_REAL_DXF_FILE_HEADER_12345"
    with pytest.raises(ValueError, match="Failed to parse DXF file"):
        extract_dxf_takeoff(garbage, filename="corrupt.dxf")
