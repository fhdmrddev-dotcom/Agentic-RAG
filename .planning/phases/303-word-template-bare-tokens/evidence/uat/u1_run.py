"""303 U-1: start the bare-token workflow through the API and wait for it to finish."""
import os
import sys
import time
from pathlib import Path

import httpx
import psycopg2
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(Path(r"C:\Vibe Apps\Agentic RAG\backend\.env"))
DEF_ID = sys.argv[1] if len(sys.argv) > 1 else "00000000-0000-0000-0000-0000003030a1"
ORG = "22f9c615-0eec-440a-8804-ed4784d6f57f"
API = "http://127.0.0.1:8000"

anon = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_ANON_KEY"])
tok = anon.auth.sign_in_with_password({"email": os.environ["DEV_LOGIN_EMAIL"], "password": os.environ["DEV_LOGIN_PASSWORD"]}).session.access_token
h = {"Authorization": f"Bearer {tok}", "X-Org-Id": ORG}

with httpx.Client(timeout=60) as c:
    r = c.post(f"{API}/threads", json={"title": "303 U-1/U-2"}, headers=h)
    print("thread", r.status_code, r.text[:200])
    tid = r.json()["id"]
    r = c.post(f"{API}/threads/{tid}/messages", headers=h, json={
        "content": "Fill this week's status report for the PM demo project.",
        "workflow_definition_id": DEF_ID, "model": "deepseek-v4-flash", "provider": "deepseek",
    })
    print("send", r.status_code, r.text[:300])

db = psycopg2.connect("postgresql://postgres:postgres@127.0.0.1:54322/postgres")
db.autocommit = True
cur = db.cursor()
run_id = None
for _ in range(110):
    cur.execute("select id,status from workflow_runs where thread_id=%s order by created_at desc limit 1", (tid,))
    row = cur.fetchone()
    if row:
        run_id, st = row
        if st not in ("pending", "running", "queued", "active"):
            break
    time.sleep(5)
print("thread", tid, "run", run_id, "status", st)
cur.execute("select phase_index,status,left(coalesce(output::text,''),1500) from workflow_phases where workflow_run_id=%s order by phase_index", (run_id,))
for r in cur.fetchall():
    print("phase", r)
