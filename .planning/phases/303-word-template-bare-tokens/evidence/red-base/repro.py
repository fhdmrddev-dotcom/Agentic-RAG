"""303 repro: run the REAL _RENDER_DRIVER_SRC as a script, exactly as the sandbox does."""
import json, os, subprocess, sys
sys.path.insert(0, r"C:\Vibe Apps\Agentic RAG\backend")
from docx import Document
from app.services.tools.render_template import _RENDER_DRIVER_SRC

out_dir = sys.argv[1]
os.makedirs(out_dir, exist_ok=True)
driver = os.path.join(out_dir, "render_driver.py")
open(driver, "w", encoding="utf-8").write(_RENDER_DRIVER_SRC)

def build(path, body_tok, header_tok, footer_tok, cell_tok, nested_tok, loop=True):
    d = Document()
    d.add_paragraph("Body: " + body_tok)
    sec = d.sections[0]
    sec.header.paragraphs[0].text = "Header: " + header_tok
    sec.footer.paragraphs[0].text = "Footer: " + footer_tok
    t = d.add_table(rows=1, cols=1)
    t.cell(0, 0).text = "Cell: " + cell_tok
    inner = t.cell(0, 0).add_table(rows=1, cols=1)
    inner.cell(0, 0).text = "Nested: " + nested_tok
    if loop:
        lt = d.add_table(rows=3, cols=2)
        lt.cell(0, 0).text = "{%tr for r in rows %}"
        lt.cell(1, 0).text = "{{ r.cause }}"
        lt.cell(1, 1).text = "{{ r.score }}"
        lt.cell(2, 0).text = "{%tr endfor %}"
    d.save(path)

def texts(path):
    d = Document(path)
    out = {"body": [p.text for p in d.paragraphs if p.text]}
    out["header"] = [p.text for p in d.sections[0].header.paragraphs]
    out["footer"] = [p.text for p in d.sections[0].footer.paragraphs]
    cells = []
    for t in d.tables:
        for row in t.rows:
            for c in row.cells:
                cells.append(c.text)
                for it in c.tables:
                    for r2 in it.rows:
                        for c2 in r2.cells:
                            cells.append("NESTED>" + c2.text)
    out["cells"] = cells
    return out

fm = {"scalars": {"name": {"value": "Ann", "source_chunk_id": "c1", "source_doc": "d.pdf", "source_page": 2}},
      "collections": {"rows": [{"cause": {"value": "Late vendor", "source_chunk_id": "c2", "source_doc": None, "source_page": None}}]}}
fmp = os.path.join(out_dir, "field_map.json"); json.dump(fm, open(fmp, "w"))

cases = {
  "docxtpl_bare": ("docxtpl", ("{{ name }}",) * 5, True),
  "docxtpl_value": ("docxtpl", ("{{ name.value }}",) * 5, False),
  "docxtpl_default": ("docxtpl", ("{{ name.value|default('N/A') }}",) * 5, False),
  "run_replace_bare_spaced": ("run_replace", ("{{ name }}",) * 5, False),
  "run_replace_bare_tight": ("run_replace", ("{{name}}",) * 5, False),
  "run_replace_value": ("run_replace", ("{{ name.value }}",) * 5, False),
}
for label, (engine, toks, loop) in cases.items():
    tpl = os.path.join(out_dir, label + "_template.docx")
    out = os.path.join(out_dir, label + "_out.docx")
    build(tpl, *toks, loop=loop)
    p = subprocess.run([sys.executable, "-u", driver, engine, tpl, fmp, out], capture_output=True, text=True)
    verdict = p.stdout.strip().splitlines()[-1] if p.stdout.strip() else p.stderr[-400:]
    print("==", label, "verdict:", verdict)
    if os.path.exists(out):
        print("   ", json.dumps(texts(out)))
