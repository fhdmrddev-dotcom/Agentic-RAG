"""Takeoff Rate Sheet Matcher & Grounded BOQ Engine (Phase 220, TAKEOFF-02 / TAKEOFF-03).

Matches CAD modelspace entities (blocks, dimensions, specs) against a reference rate sheet.
Enforces the Anti-Ambiguity Invariant:
- Any element matching more than one rate line is marked `status="ambiguous"` and escalated
  to a human reviewer with candidate codes, NEVER resolved silently by list position (G-6).
- Every output line carries its explicit basis: `read`, `matched`, `ambiguous`, or `unpriced`.
"""
from __future__ import annotations

import logging
from typing import Any

from app.services.multimodal_service import extract_excel_tables

log = logging.getLogger(__name__)

# Distinctive architectural / structural keywords for preliminary token filtering
DISTINCTIVE_KEYWORDS: tuple[str, ...] = (
    "c250x23", "w250x33", "w310x39", "epdm", "osb", "gypsum", "checker",
    "hss", "cable", "stair", "plywood", "framing", "concrete", "rebar",
    "drywall", "insulation", "door", "window", "beam", "column", "slab",
)


def load_rate_sheet_rows(file_bytes: bytes) -> list[dict[str, Any]]:
    """Parse an Excel rate sheet through the app's shipped `extract_excel_tables`.

    Extracts rows with normalized keys: `code`, `desc`, `unit`, `rate`.
    """
    tables = extract_excel_tables(file_bytes)
    if not tables:
        raise ValueError("No tabular data found in the provided rate sheet.")

    rates_tbl = tables[0]
    raw_headers = [str(h).strip().lower() for h in rates_tbl.get("headers", [])]

    # Map column headers flexibly
    idx_code = None
    idx_desc = None
    idx_unit = None
    idx_rate = None

    for i, h in enumerate(raw_headers):
        if any(k in h for k in ("code", "item no", "item #", "id")):
            if idx_code is None:
                idx_code = i
        elif any(k in h for k in ("desc", "item", "material", "specification")):
            if idx_desc is None:
                idx_desc = i
        elif any(k in h for k in ("unit", "uom")):
            if idx_unit is None:
                idx_unit = i
        elif any(k in h for k in ("rate", "price", "unit cost", "cost")):
            if idx_rate is None:
                idx_rate = i

    # Fallback to positional defaults if not found
    if idx_code is None and len(raw_headers) > 0:
        idx_code = 0
    if idx_desc is None and len(raw_headers) > 1:
        idx_desc = 1
    if idx_unit is None and len(raw_headers) > 2:
        idx_unit = 2
    if idx_rate is None and len(raw_headers) > 3:
        idx_rate = 3

    if idx_code is None or idx_desc is None or idx_rate is None:
        raise ValueError(
            f"Rate sheet must contain Item Code, Description, and Rate columns; found {raw_headers}"
        )

    out: list[dict[str, Any]] = []
    for row in rates_tbl.get("rows", []):
        if not row or len(row) <= max(idx_code, idx_desc, idx_rate):
            continue
        code_val = str(row[idx_code]).strip()
        desc_val = str(row[idx_desc]).strip()
        if not code_val or not desc_val:
            continue

        raw_rate = row[idx_rate]
        try:
            # Strip currency symbols and commas
            rate_str = str(raw_rate).replace("$", "").replace(",", "").strip()
            rate_val = float(rate_str)
        except (ValueError, TypeError):
            continue

        unit_val = str(row[idx_unit]).strip() if idx_unit is not None and len(row) > idx_unit else "ea"

        out.append({
            "code": code_val,
            "desc": desc_val,
            "unit": unit_val or "ea",
            "rate": rate_val,
        })

    if not out:
        raise ValueError("Rate sheet contains no valid pricing rows.")

    return out


def match_single_item(
    item_text: str,
    rates: list[dict[str, Any]],
) -> tuple[dict[str, Any] | None, list[dict[str, Any]], str]:
    """Match a drawing element text to rate lines using strict anti-ambiguity rules.

    Returns: (matched_rate_or_None, candidate_rates_list, status)
    status is one of: "matched", "ambiguous", "unpriced".
    """
    clean_text = item_text.lower().replace(".", "").replace('"', "").strip()
    hits: list[dict[str, Any]] = []

    # 1. Exact or whole-word code match
    for r in rates:
        code_clean = r["code"].lower().replace(".", "").strip()
        if code_clean and code_clean == clean_text:
            return r, [r], "matched"

    # 2. Check keyword containment
    for key in DISTINCTIVE_KEYWORDS:
        if key in clean_text:
            for r in rates:
                desc_clean = r["desc"].lower().replace(".", "")
                if key in desc_clean and r not in hits:
                    hits.append(r)

    # 3. Token-overlap fallback if keyword search produced no hits
    if not hits:
        item_words = {w for w in clean_text.split() if len(w) > 2}
        for r in rates:
            desc_words = {w for w in r["desc"].lower().split() if len(w) > 2}
            overlap = item_words.intersection(desc_words)
            if len(overlap) >= 2 and r not in hits:
                hits.append(r)

    # 4. Evaluate Hits
    if len(hits) == 1:
        return hits[0], hits, "matched"
    if len(hits) > 1:
        # Anti-Ambiguity Invariant: multiple matches MUST NOT pick the first row!
        return None, hits, "ambiguous"

    return None, [], "unpriced"


def match_takeoff_to_rates(
    takeoff_data: dict[str, Any],
    rates: list[dict[str, Any]],
) -> dict[str, Any]:
    """Produce a priced Bill of Quantities (BOQ) from CAD takeoff entities."""
    boq_items: list[dict[str, Any]] = []
    total_cost = 0.0
    counted_items_cost = 0.0
    ambiguous_count = 0
    unpriced_count = 0

    # 1. Match Counted Blocks (INSERT) — basis: 'read'
    blocks: dict[str, int] = takeoff_data.get("blocks", {})
    for bname, qty in blocks.items():
        matched_rate, candidates, status = match_single_item(bname, rates)
        item_key = f"block:{bname}"

        if status == "matched" and matched_rate:
            rate_val = matched_rate["rate"]
            amount = qty * rate_val
            total_cost += amount
            counted_items_cost += amount
            boq_items.append({
                "item_key": item_key,
                "category": "block",
                "source_text": bname,
                "quantity": qty,
                "unit": matched_rate.get("unit", "ea"),
                "rate_code": matched_rate["code"],
                "description": matched_rate["desc"],
                "rate": rate_val,
                "amount": amount,
                "basis": "read",  # Count read exactly from CAD
                "status": "matched",
                "candidates": [],
            })
        elif status == "ambiguous":
            ambiguous_count += 1
            boq_items.append({
                "item_key": item_key,
                "category": "block",
                "source_text": bname,
                "quantity": qty,
                "unit": "ea",
                "rate_code": None,
                "description": f"Block reference: {bname}",
                "rate": None,
                "amount": None,
                "basis": "ambiguous",
                "status": "ambiguous",
                "candidates": candidates,
            })
        else:
            unpriced_count += 1
            boq_items.append({
                "item_key": item_key,
                "category": "block",
                "source_text": bname,
                "quantity": qty,
                "unit": "ea",
                "rate_code": None,
                "description": f"Block reference: {bname}",
                "rate": None,
                "amount": None,
                "basis": "unpriced",
                "status": "unpriced",
                "candidates": [],
            })

    # 2. Match Specification Callouts (MULTILEADER, MTEXT) — basis: 'matched'
    specs: list[str] = takeoff_data.get("specs", [])
    for idx, spec_text in enumerate(specs):
        matched_rate, candidates, status = match_single_item(spec_text, rates)
        item_key = f"spec:{idx}"

        if status == "matched" and matched_rate:
            # Specification has no explicit quantity unless paired with dimensions
            boq_items.append({
                "item_key": item_key,
                "category": "spec",
                "source_text": spec_text,
                "quantity": 1,
                "unit": matched_rate.get("unit", "item"),
                "rate_code": matched_rate["code"],
                "description": matched_rate["desc"],
                "rate": matched_rate["rate"],
                "amount": matched_rate["rate"],
                "basis": "matched",
                "status": "matched",
                "candidates": [],
            })
            total_cost += matched_rate["rate"]
        elif status == "ambiguous":
            ambiguous_count += 1
            boq_items.append({
                "item_key": item_key,
                "category": "spec",
                "source_text": spec_text,
                "quantity": 1,
                "unit": "item",
                "rate_code": None,
                "description": spec_text,
                "rate": None,
                "amount": None,
                "basis": "ambiguous",
                "status": "ambiguous",
                "candidates": candidates,
            })
        else:
            unpriced_count += 1
            boq_items.append({
                "item_key": item_key,
                "category": "spec",
                "source_text": spec_text,
                "quantity": 1,
                "unit": "item",
                "rate_code": None,
                "description": spec_text,
                "rate": None,
                "amount": None,
                "basis": "unpriced",
                "status": "unpriced",
                "candidates": [],
            })

    return {
        "items": boq_items,
        "totals": {
            "total_estimated_cost": round(total_cost, 2),
            "counted_items_cost": round(counted_items_cost, 2),
            "total_items": len(boq_items),
            "matched_count": len([i for i in boq_items if i["status"] == "matched"]),
            "ambiguous_count": ambiguous_count,
            "unpriced_count": unpriced_count,
        },
        "refused": takeoff_data.get("refused", False),
        "refusal_reason": takeoff_data.get("refusal_reason"),
        "units": takeoff_data.get("units", "unknown"),
    }


def resolve_takeoff_item(
    boq: dict[str, Any],
    item_key: str,
    chosen_rate_code: str,
    rates: list[dict[str, Any]],
) -> dict[str, Any]:
    """Resolve an ambiguous item by assigning a chosen rate code and recalculating totals."""
    rate_lookup = {r["code"]: r for r in rates}
    chosen_rate = rate_lookup.get(chosen_rate_code)
    if not chosen_rate:
        raise ValueError(f"Rate code '{chosen_rate_code}' not found in active rate sheet.")

    items = boq.get("items", [])
    found = False

    for item in items:
        if item["item_key"] == item_key:
            found = True
            qty = item.get("quantity") or 1
            rate_val = chosen_rate["rate"]
            amount = qty * rate_val

            item["rate_code"] = chosen_rate["code"]
            item["description"] = chosen_rate["desc"]
            item["unit"] = chosen_rate["unit"]
            item["rate"] = rate_val
            item["amount"] = amount
            item["status"] = "matched"
            item["basis"] = "matched"
            item["candidates"] = []
            break

    if not found:
        raise ValueError(f"Item key '{item_key}' not found in BOQ.")

    # Recalculate totals
    total_cost = sum(i["amount"] for i in items if i["status"] == "matched" and i.get("amount") is not None)
    counted_items_cost = sum(
        i["amount"]
        for i in items
        if i["status"] == "matched" and i.get("category") == "block" and i.get("amount") is not None
    )

    boq["totals"] = {
        "total_estimated_cost": round(total_cost, 2),
        "counted_items_cost": round(counted_items_cost, 2),
        "total_items": len(items),
        "matched_count": len([i for i in items if i["status"] == "matched"]),
        "ambiguous_count": len([i for i in items if i["status"] == "ambiguous"]),
        "unpriced_count": len([i for i in items if i["status"] == "unpriced"]),
    }
    return boq
