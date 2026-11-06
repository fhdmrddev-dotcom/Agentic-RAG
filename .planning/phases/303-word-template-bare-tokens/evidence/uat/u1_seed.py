"""303 U-1: seed a bare-token library template + a published fill workflow (local DB only)."""
import importlib.util
import sys
from pathlib import Path

REPO = Path(r"C:\Vibe Apps\Agentic RAG")
spec = importlib.util.spec_from_file_location("seed", REPO / "scripts" / "seed-pm-pack.py")
seed = importlib.util.module_from_spec(spec)
spec.loader.exec_module(seed)

from docx import Document  # noqa: E402
import psycopg2  # noqa: E402

OUT = Path(sys.argv[1])
DEF_ID = "00000000-0000-0000-0000-0000003030a1"
SLUG = "u1-303-bare-tokens"

d = Document()
d.sections[0].header.paragraphs[0].text = "Status report: {{ project_name }}"
d.add_paragraph("Period: {{ reporting_period }}")
d.add_paragraph("Overall: {{ overall_rag_status }}")
d.add_paragraph("Summary: {{ summary }}")
outer = d.add_table(rows=1, cols=1)
outer.cell(0, 0).paragraphs[0].text = "Outer cell"
inner = outer.cell(0, 0).add_table(rows=1, cols=1)
inner.cell(0, 0).paragraphs[0].text = "Milestones: {{ milestones }}"
d.add_paragraph("Done: {{ accomplishments }}")
d.save(OUT)

sb = seed.get_supabase()
conn = psycopg2.connect(seed._db_dsn())
seed.assert_demo_uid(conn)
folder_id = "1564da7e-2348-4237-b7a1-ec17c5ea8f4b"  # pm_pack_ids.json demo folder

path = f"{seed.DEMO_USER_ID}/_library/{SLUG}.docx"
data = OUT.read_bytes()
st = sb.storage.from_(seed.BUCKET)
st.upload(path, data, {"content-type": seed.MIME, "upsert": "true"})
assert len(st.download(path)) == len(data)

dd = seed._build_def(
    def_id=DEF_ID, slug=SLUG, name="303 U-1 bare tokens", folder_id=folder_id,
    asset_path=path, asset_filename=f"{SLUG}.docx",
    business_requirement="Produce a cited weekly status report from the project KB; every value grounded, null where unsupported.",
    retrieve_prompt="Search the project KB for the latest status: project name, reporting period, overall RAG status, summary, accomplishments and milestones. Gather the supporting passages.",
    emit_prompt="Fill the template from the retrieved KB evidence. Cite every non-null value; null where unsupported.",
)
seed._validate_def(dd)
import json  # noqa: E402
with conn.cursor() as cur:
    cur.execute("DELETE FROM public.workflow_definitions WHERE id = %s", (DEF_ID,))
    cur.execute(
        "INSERT INTO public.workflow_definitions (id, slug, version, name, status, definition, created_by, org_id) "
        "SELECT %s, %s, 1, %s, 'published', %s::jsonb, created_by, org_id "
        "FROM public.workflow_definitions WHERE id = '00000000-0000-0000-0000-0000001040a0'",
        (DEF_ID, SLUG, dd["name"], json.dumps(dd)),
    )
    assert cur.rowcount == 1
conn.commit()
print("def", DEF_ID, "folder", folder_id, "asset", path)
