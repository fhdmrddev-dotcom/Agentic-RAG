# Throwaway 101.1-06 live smoke driver (lives outside backend/ so uvicorn --reload
# never sees it). Kicks off the seeded D-13 llm_emit workflow on the EXACT model
# that failed live (gpt-5.4-mini) and monitors receipts + run state.
#
# 101.1 review WR-07: login credentials come from the SMOKE_EMAIL / SMOKE_PASSWORD
# env vars (the local-dev test account) — NEVER hardcoded in the tree.
#   PowerShell:  $env:SMOKE_EMAIL="..."; $env:SMOKE_PASSWORD="..."; python scripts\smoke_101_1_06.py
#   bash:        SMOKE_EMAIL=... SMOKE_PASSWORD=... python scripts/smoke_101_1_06.py
import json
import os
import sys
import time
import urllib.request

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFN = "00000000-0000-0000-0000-0000000101a0"
API = "http://localhost:8000"
AUTH = "http://127.0.0.1:54321/auth/v1/token?grant_type=password"


def _env(path, *names):
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                for n in names:
                    if line.startswith(n + "="):
                        return line.split("=", 1)[1].strip().strip('"').strip("'")
    except OSError:
        pass
    return None


def _req(url, payload=None, headers=None, method=None):
    data = json.dumps(payload).encode() if payload is not None else None
    r = urllib.request.Request(url, data=data, method=method or ("POST" if data else "GET"))
    r.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items():
        r.add_header(k, v)
    with urllib.request.urlopen(r, timeout=60) as resp:
        return json.loads(resp.read().decode())


anon = (
    _env(os.path.join(REPO, "frontend", ".env"), "VITE_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY")
    or _env(os.path.join(REPO, "backend", ".env"), "SUPABASE_ANON_KEY", "SUPABASE_KEY")
)
if not anon:
    sys.exit("no anon key found in frontend/.env or backend/.env")

# WR-07: never a hardcoded credential pair — fail fast with a clear message.
SMOKE_EMAIL = os.environ.get("SMOKE_EMAIL")
SMOKE_PASSWORD = os.environ.get("SMOKE_PASSWORD")
if not SMOKE_EMAIL or not SMOKE_PASSWORD:
    sys.exit(
        "smoke_101_1_06: set the SMOKE_EMAIL and SMOKE_PASSWORD env vars (the "
        "local-dev test login) before running — credentials are never hardcoded."
    )

tok = _req(AUTH, {"email": SMOKE_EMAIL, "password": SMOKE_PASSWORD}, {"apikey": anon})["access_token"]
H = {"Authorization": f"Bearer {tok}"}
print("login OK")

thread = _req(f"{API}/threads", {"title": "101.1-06 smoke (orchestrator)"}, H)
tid = thread["id"]
print("thread =", tid)

_req(
    f"{API}/threads/{tid}/messages",
    {
        "content": "start workflow",
        "model": "gpt-5.4-mini",
        "provider": "openai",
        "workflow_definition_id": DEFN,
    },
    H,
)
print("kickoff sent (gpt-5.4-mini / openai — the exact pair that failed in run a12ee906)")

import psycopg2  # backend venv

conn = psycopg2.connect("postgresql://postgres:postgres@127.0.0.1:54322/postgres")
conn.autocommit = True
cur = conn.cursor()

run_id, status = None, None
deadline = time.time() + 240
while time.time() < deadline:
    cur.execute(
        "SELECT id, status FROM workflow_runs WHERE thread_id=%s ORDER BY created_at DESC LIMIT 1",
        (tid,),
    )
    row = cur.fetchone()
    if row:
        run_id, status = str(row[0]), row[1]
        if status in ("completed", "failed"):
            break
    time.sleep(4)
print(f"run = {run_id}  status = {status}")

cur.execute(
    "SELECT event_type, created_at, metadata FROM harness_audit WHERE run_id=%s ORDER BY created_at",
    (run_id,),
)
events = cur.fetchall()
print(f"\n=== {len(events)} receipts ===")
for ev, ts, md in events:
    if isinstance(md, str):
        try:
            md = json.loads(md)
        except ValueError:
            md = {}
    print(f"[{ts}] {ev}" + (f"  attempt={md.get('attempt')}" if isinstance(md, dict) and md.get("attempt") else ""))
    if ev in ("emit_validated", "emit_rejected", "emit_rendered", "emit_failed", "emit_integrity_failed"):
        gv = (md or {}).get("gate_verdict")
        if gv:
            print("   gate_verdict:", json.dumps(gv))
        of = (md or {}).get("output_file")
        if of:
            print("   output_file:", json.dumps(of))

print("\n=== workspace files in thread ===")
cur.execute(
    "SELECT id, path, kind, size_bytes FROM workspace_files WHERE thread_id=%s ORDER BY created_at DESC",
    (tid,),
)
for r in cur.fetchall():
    print("  ", r)

print("\nthread_id =", tid)
print("run_id =", run_id)
