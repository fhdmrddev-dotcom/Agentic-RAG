"""DXF -> quantities -> priced BOQ. The SEED-226 L3 spike.

    cd backend && PYTHONUTF8=1 ./venv/Scripts/python.exe scripts/probe_dxf_takeoff.py \
        <drawing.dxf> <rates.xlsx>

Answers one question with numbers instead of argument: how much of a bill of quantities
can be read straight out of a DXF, and how much still needs a quantity surveyor?

⚠ IT SEPARATES WHAT IT *READ* FROM WHAT IT *INFERRED*, and that separation is the point.
A takeoff that prints one confident total is worth nothing here; the operator's own
business case dies on a plausible wrong number. Every line carries its basis.

⚠ THE HONEST LIMIT, STATED IN CODE RATHER THAN A FOOTNOTE: summing LINE lengths on a layer
is NOT a quantity. A wall in section is drawn as two or more parallel lines, so raw length
over-measures by roughly the number of lines per element. Counts (INSERT) and DIMENSION
values are exact; lengths are ORDER-OF-MAGNITUDE and are labelled as such throughout.

⚠ ezdxf is an EVALUATION dependency here, not a committed one — see SEED-226.
"""
from __future__ import annotations

import math
import os
import re
import sys
from collections import Counter, defaultdict

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# ezdxf `$INSUNITS`. 0 means UNITLESS, which is a REFUSAL case, not a default.
UNITS = {0: ("unitless", None), 1: ("inches", 0.0254), 2: ("feet", 0.3048),
         4: ("mm", 0.001), 5: ("cm", 0.01), 6: ("m", 1.0)}

# CAD inline formatting: \A1;  \W1.15;  \H0.7x;  \P  \S1/2;  {...}  %%C
_FMT = re.compile(r"\\[A-Za-z]\d*(?:\.\d+)?[x;]?|\\P|\\S[^;]*;|[{}]|%%[cCdDpP]")


def clean(t: str) -> str:
    return " ".join(_FMT.sub(" ", t or "").split())


def load_rates(xlsx: str) -> list[dict]:
    """Read the rate sheet through the APP'S OWN extractor, not openpyxl directly.

    If the app cannot read the operator's sheet, the takeoff must fail here rather than
    succeed against a private parser the product does not ship.
    """
    from app.services.multimodal_service import extract_excel_tables
    tables = extract_excel_tables(open(xlsx, "rb").read())
    if not tables:
        raise SystemExit(f"the app's extractor found no tables in {xlsx}")
    rates_tbl = tables[0]
    hdr = [h.strip().lower() for h in rates_tbl["headers"]]
    idx = {name: hdr.index(name) for name in
           ("item code", "description", "unit", "rate") if name in hdr}
    if len(idx) < 4:
        raise SystemExit(f"rate sheet is missing columns; found {hdr}")
    out = []
    for row in rates_tbl["rows"]:
        if len(row) <= max(idx.values()) or not row[idx["item code"]].strip():
            continue
        try:
            rate = float(row[idx["rate"]])
        except (ValueError, TypeError):
            continue
        out.append({
            "code": row[idx["item code"]].strip(),
            "desc": row[idx["description"]].strip(),
            "unit": row[idx["unit"]].strip(),
            "rate": rate,
        })
    return out


def read_dxf(path: str) -> dict:
    import ezdxf
    d = ezdxf.readfile(path)
    msp = d.modelspace()

    unit_name, to_m = UNITS.get(d.units, (f"code {d.units}", None))

    dims = []
    for e in msp.query("DIMENSION"):
        try:
            m = e.get_measurement()
        except Exception:
            continue
        if isinstance(m, (int, float)):
            dims.append(float(m))

    blocks = Counter(e.dxf.name for e in msp.query("INSERT"))

    length_by_layer: dict[str, float] = defaultdict(float)
    lines_by_layer: Counter = Counter()
    for e in msp.query("LINE"):
        s, t = e.dxf.start, e.dxf.end
        length_by_layer[e.dxf.layer] += math.dist((s.x, s.y), (t.x, t.y))
        lines_by_layer[e.dxf.layer] += 1

    specs = []
    for e in msp.query("MULTILEADER"):
        txt = None
        try:
            if getattr(e, "context", None) and e.context.mtext:
                txt = e.context.mtext.default_content
        except Exception:
            pass
        if txt:
            c = clean(txt)
            if c:
                specs.append(c)
    for e in msp.query("MTEXT"):
        c = clean(e.text)
        if c:
            specs.append(c)

    return {
        "units": unit_name, "to_m": to_m,
        "dims": dims, "blocks": blocks,
        "length_by_layer": dict(length_by_layer), "lines_by_layer": lines_by_layer,
        "specs": specs,
        "entity_total": len(msp),
    }


DISTINCTIVE = ("c250x23", "w250x33", "epdm", "osb", "gypsum", "checker",
               "hss", "cable", "stair", "plywood", "framing")


def match_rate(text: str, rates: list[dict]) -> tuple[dict | None, str]:
    """Match a drawing string to a rate line, or REFUSE and say why.

    Returns (rate_or_None, status) where status is "matched", "ambiguous" or "none".

    ⚠ THIS FUNCTION WAS REWRITTEN AFTER IT PRODUCED A WRONG PRICE, AND THE ORIGINAL
    DEFECT IS THE MOST USEFUL THING THIS SPIKE FOUND. The first version picked the FIRST
    rate line containing a shared token, so:

        `1/2"[12.5] GYPSUM BOARD`  ->  CL-GYP "Suspended gypsum ceiling"  @ 31.00/m2
                          correct  ->  GB-12  "Gypsum board, taped"       @ 18.75/m2

    A 65% overprice, printed with a confident item code beside it and nothing to mark it
    as a guess. Both lines legitimately contain "gypsum"; the drawing says BOARD and the
    matcher chose CEILING. **Nothing downstream could have caught it** — the arithmetic
    was right, the code existed, the sheet was real.

    So the rule is now: a token matching MORE THAN ONE rate line is AMBIGUOUS and is
    escalated to a human, never resolved by position in the sheet. Refusing to price is a
    cost; pricing wrongly is a liability, and on a tender it is the whole business case.
    """
    t = text.lower().replace(".", "")
    hits: list[dict] = []
    for key in DISTINCTIVE:
        if key not in t:
            continue
        for r in rates:
            if key in r["desc"].lower().replace(".", "") and r not in hits:
                hits.append(r)
    if len(hits) == 1:
        return hits[0], "matched"
    if len(hits) > 1:
        return None, "ambiguous:" + "/".join(h["code"] for h in hits)
    return None, "none"


def main(dxf_path: str, rates_path: str) -> None:
    rates = load_rates(rates_path)
    d = read_dxf(dxf_path)

    print("=" * 78)
    print(f"DXF TAKEOFF — {os.path.basename(dxf_path)}")
    print("=" * 78)
    print(f"units: {d['units']}   entities: {d['entity_total']}   "
          f"rate lines available: {len(rates)}")
    if d["to_m"] is None:
        print("\n⚠ REFUSING to convert lengths: this drawing declares NO units ($INSUNITS=0).")

    # ---- READ EXACTLY: block counts ----------------------------------------
    print("\n" + "-" * 78)
    print("A. COUNTED ITEMS — read exactly from INSERT block references")
    print("-" * 78)
    counted_total = 0.0
    for name, n in d["blocks"].most_common():
        r, status = match_rate(name, rates)
        if r:
            amt = n * r["rate"]
            counted_total += amt
            print(f"  {r['code']:<10} {r['desc'][:44]:<44} {n:>4} {r['unit']:<4}"
                  f" @ {r['rate']:>9,.2f} = {amt:>11,.2f}")
        else:
            why = "AMBIGUOUS " + status.split(":", 1)[1] if status.startswith(
                "ambiguous") else "UNPRICED"
            print(f"  {'— ':<10} {('block ' + name)[:44]:<44} {n:>4} no    {why}")
    print(f"  {'':<60} counted subtotal: {counted_total:>11,.2f} USD")

    # ---- READ EXACTLY: dimensions ------------------------------------------
    print("\n" + "-" * 78)
    print("B. MEASURED DIMENSIONS — computed by the CAD software, not inferred")
    print("-" * 78)
    if d["dims"]:
        ds = sorted(d["dims"])
        print(f"  {len(ds)} dimensions   min {ds[0]:,.2f}   max {ds[-1]:,.2f}   "
              f"sum {sum(ds):,.2f} ({d['units']})")
        print(f"  values: {', '.join(f'{v:g}' for v in ds[:16])}"
              f"{' …' if len(ds) > 16 else ''}")
        print("  ⚠ These are TRUE lengths. Turning them into areas needs the drawing's")
        print("    intent (which dimension bounds which element) — a QS decision.")
    else:
        print("  none")

    # ---- SPECIFICATIONS the engineer already wrote --------------------------
    print("\n" + "-" * 78)
    print("C. SPECIFICATIONS — lifted from the drawing's own annotation")
    print("-" * 78)
    seen, matched_specs, ambiguous = set(), 0, 0
    for s in d["specs"]:
        if s in seen or len(s) < 6:
            continue
        seen.add(s)
        r, status = match_rate(s, rates)
        if r:
            matched_specs += 1
            print(f"  ✓ {r['code']:<9} {s[:52]:<52} -> {r['rate']:>9,.2f}/{r['unit']}")
        elif status.startswith("ambiguous"):
            ambiguous += 1
            print(f"  ⚠ {'AMBIG':<9} {s[:52]:<52}    {status.split(':', 1)[1]}"
                  f" — a human must choose")
        else:
            print(f"  ? {'':<9} {s[:52]:<52}    unmatched")
    print(f"\n  {matched_specs} matched  ·  {ambiguous} AMBIGUOUS (escalated, never guessed)  ·  {len(seen)-matched_specs-ambiguous} unmatched   of {len(seen)} distinct.")

    # ---- INFERRED, and labelled as such ------------------------------------
    print("\n" + "-" * 78)
    print("D. LENGTHS BY LAYER — ⚠ ORDER-OF-MAGNITUDE ONLY, NOT A QUANTITY")
    print("-" * 78)
    print("  A wall in section is 2+ parallel lines, so raw length OVER-MEASURES.")
    print("  Shown to prove the geometry is classified and reachable — never to price.\n")
    for lay, ln in sorted(d["length_by_layer"].items(), key=lambda kv: -kv[1])[:8]:
        conv = f"  ≈ {ln * d['to_m']:>10,.1f} m" if d["to_m"] else ""
        print(f"  {lay:<34}{d['lines_by_layer'][lay]:>5} lines{ln:>12,.1f} {d['units']}{conv}")

    # ---- The verdict --------------------------------------------------------
    print("\n" + "=" * 78)
    print("VERDICT")
    print("=" * 78)
    print(f"  Priced from exact counts        : {counted_total:>11,.2f} USD")
    print(f"  Specifications matched to rates : {matched_specs}")
    print(f"  Escalated as ambiguous          : {ambiguous}  (never silently priced)")
    print(f"  Dimensions available as truth   : {len(d['dims'])}")
    print("\n  ⚠ NOT A BILL OF QUANTITIES. It is the machine-readable HALF of one:")
    print("    counts and specs are exact; areas and volumes still need a QS to say")
    print("    which dimension bounds which element, and what height a wall is.")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
