"""303 golden: render every in-repo trusted template through the REAL driver script.

usage: python golden.py <out_dir>    (run once at base, once after the fix, then compare.py)
"""
import json, os, subprocess, sys
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", ".."))
sys.path.insert(0, os.path.join(REPO, "backend"))
from docx import Document
from app.services.tools.render_template import _RENDER_DRIVER_SRC
from app.services.template_render_service import parse_docx_template_variables

out_dir = sys.argv[1]
os.makedirs(out_dir, exist_ok=True)
driver = os.path.join(out_dir, "render_driver.py")
open(driver, "w", encoding="utf-8").write(_RENDER_DRIVER_SRC)

def cited(v, i):
    return {"value": v, "source_chunk_id": "chunk-%d" % i, "source_doc": "doc.pdf", "source_page": i}

def field_map_for(path):
    parsed = parse_docx_template_variables(open(path, "rb").read()) or {}
    scalars = {k: cited("Value of %s & <x>" % k, i) for i, k in enumerate(parsed.get("scalars", []))}
    colls = {}
    for c in parsed.get("collections", []):
        cols = parsed.get("columns", {}).get(c, [])
        colls[c] = [{col: cited("%s row %d" % (col, r), r) for col in cols} for r in range(3)]
        colls[c][1][cols[0]] = cited(None, 0) if cols else None  # a declined cell renders blank
    return {"scalars": scalars, "collections": colls}

# a |default template, built deterministically
default_tpl = os.path.join(out_dir, "default-filter.docx")
d = Document(); d.add_paragraph("A: {{ a.value|default('N/A') }}"); d.add_paragraph("B: {{ b.value }}"); d.save(default_tpl)

cases = [
    ("pm-compliance", "docxtpl", os.path.join(REPO, "scripts/pm-pack/templates/compliance-gap-report.docx")),
    ("pm-risk", "docxtpl", os.path.join(REPO, "scripts/pm-pack/templates/risk-register.docx")),
    ("pm-weekly", "docxtpl", os.path.join(REPO, "scripts/pm-pack/templates/weekly-status-report.docx")),
    ("fixture-risk-score", "docxtpl", os.path.join(REPO, "backend/tests/fixtures/templates/risk-register.docx")),
    ("default-filter", "docxtpl", default_tpl),
    ("arbitrary-split", "run_replace", os.path.join(REPO, "backend/tests/fixtures/templates/arbitrary-split-token.docx")),
]
for label, engine, tpl in cases:
    if label == "default-filter":
        fm = {"scalars": {"a": cited(None, 1), "b": cited("Bee", 2)}}
    elif label == "arbitrary-split":
        fm = {"scalars": {"client_name": cited("Acme & Co", 1), "report_title": cited("Q3 <Review>", 2)}}
    else:
        fm = field_map_for(tpl)
    fmp = os.path.join(out_dir, label + ".field_map.json")
    json.dump(fm, open(fmp, "w"), indent=1, sort_keys=True)
    out = os.path.join(out_dir, label + ".docx")
    p = subprocess.run([sys.executable, "-u", driver, engine, tpl, fmp, out], capture_output=True, text=True)
    print(label, p.stdout.strip().splitlines()[-1] if p.stdout.strip() else p.stderr[-300:])
