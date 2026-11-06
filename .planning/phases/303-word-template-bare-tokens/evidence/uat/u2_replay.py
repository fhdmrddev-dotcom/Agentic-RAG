"""303 U-2 (exact half): replay a pre-303 run's own field map through TODAY's driver; compare text."""
import io
import json
import os
import subprocess
import sys
import zipfile

import psycopg2
from docx import Document

from app.services.tools.render_template import _RENDER_DRIVER_SRC

RUN = sys.argv[1]
OUT_DIR = sys.argv[2]
TEMPLATE = r"C:\Vibe Apps\Agentic RAG\scripts\pm-pack\templates\weekly-status-report.docx"
os.makedirs(OUT_DIR, exist_ok=True)

c = psycopg2.connect("postgresql://postgres:postgres@127.0.0.1:54322/postgres").cursor()
c.execute("select output from workflow_phases where workflow_run_id=%s and phase_index=1", (RUN,))
out = c.fetchone()[0]
out = json.loads(out) if isinstance(out, str) else out
fm = out["field_map"]
c.execute("select thread_id from workflow_runs where id=%s", (RUN,))
tid = c.fetchone()[0]
c.execute("select content_inline from workspace_files where thread_id=%s and path=%s", (tid, out["path"]))
old_bytes = bytes(c.fetchone()[0])
open(os.path.join(OUT_DIR, f"old-{RUN[:8]}.docx"), "wb").write(old_bytes)

driver = os.path.join(OUT_DIR, "render_driver.py")
open(driver, "w", encoding="utf-8").write(_RENDER_DRIVER_SRC)
fmp = os.path.join(OUT_DIR, f"field_map-{RUN[:8]}.json")
json.dump(fm, open(fmp, "w", encoding="utf-8"), ensure_ascii=False)
new_path = os.path.join(OUT_DIR, f"replay-{RUN[:8]}.docx")
p = subprocess.run([sys.executable, "-u", driver, "docxtpl", TEMPLATE, fmp, new_path], capture_output=True, text=True)
print("driver:", (p.stdout.strip().splitlines() or [p.stderr[-300:]])[-1])


def texts(b):
    d = Document(io.BytesIO(b))
    body = [x.text for x in d.paragraphs]
    cells = [cell.text for t in d.tables for r in t.rows for cell in r.cells]
    hdr = [x.text for s in d.sections for x in s.header.paragraphs + s.footer.paragraphs]
    return body + cells + hdr


def xml_text(b):
    z = zipfile.ZipFile(io.BytesIO(b))
    return {n: z.read(n) for n in z.namelist() if n.startswith("word/") and n.endswith(".xml")}


new_bytes = open(new_path, "rb").read()
a, b = texts(old_bytes), texts(new_bytes)
print("text lines old/new:", len(a), len(b), "| IDENTICAL TEXT" if a == b else "| TEXT DIFFERS")
for i, (x, y) in enumerate(zip(a, b)):
    if x != y:
        print("  diff line", i, repr(x[:120]), "->", repr(y[:120]))
xo, xn = xml_text(old_bytes), xml_text(new_bytes)
same = [n for n in xo if xo[n] == xn.get(n)]
print("word/*.xml parts identical:", len(same), "of", len(xo), "| differing:", sorted(set(xo) ^ set(same)))
print("record text in new:", b"source_chunk_id" in b"".join(xn.values()))
