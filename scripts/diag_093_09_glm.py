"""
Phase 093-09 GLM diagnosis tool (read-only).

Reads the live local Supabase for a harness GLM run's full tree:
  workflow_runs -> workflow_phases -> producer runs row -> sub-agent runs rows -> messages(.tool_calls)

Usage (from repo root, backend venv):
  backend/venv/Scripts/python.exe scripts/diag_093_09_glm.py <thread_id>

Does NOT live under backend/ (uvicorn --reload watches backend/ only).
"""
import os
import sys
import json

from dotenv import load_dotenv

# Load the REAL local creds from backend/.env (bypass any conftest fake-cloud URL).
HERE = os.path.dirname(os.path.abspath(__file__))
ENV = os.path.join(HERE, "..", "backend", ".env")
load_dotenv(ENV)

URL = os.environ.get("SUPABASE_URL")
KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
print(f"[diag] SUPABASE_URL={URL}")
if not URL or not KEY:
    print("[diag] MISSING creds — abort")
    sys.exit(2)

from supabase import create_client  # noqa: E402

sb = create_client(URL, KEY)

thread_id = sys.argv[1] if len(sys.argv) > 1 else None
if not thread_id:
    print("[diag] usage: diag_093_09_glm.py <thread_id>")
    sys.exit(2)

def show(title, rows, keys):
    print(f"\n===== {title} ({len(rows)} rows) =====")
    for r in rows:
        line = {k: r.get(k) for k in keys}
        print(json.dumps(line, default=str))

# 1. workflow_runs for this thread
wfr = sb.table("workflow_runs").select("*").eq("thread_id", thread_id).order("created_at").execute().data
show("workflow_runs", wfr, ["id", "status", "model", "current_phase_index", "user_id", "created_at", "updated_at"])
for r in wfr:
    if r.get("inputs"):
        print(f"  inputs[{r['id'][:8]}]: {json.dumps(r['inputs'], default=str)[:300]}")
    if r.get("error"):
        print(f"  error[{r['id'][:8]}]: {str(r['error'])[:300]}")

wf_ids = [r["id"] for r in wfr]

# 2. workflow_phases per workflow_run
for wid in wf_ids:
    ph = sb.table("workflow_phases").select("*").eq("workflow_run_id", wid).order("phase_index").execute().data
    show(f"workflow_phases for {wid[:8]}", ph, ["phase_index", "phase_type", "slug", "status", "updated_at"])
    for p in ph:
        out = p.get("output")
        if out is not None:
            print(f"  phase[{p.get('phase_index')}] output: {str(out)[:400]}")

# 3. runs rows for this thread (producer + sub-agents)
runs = sb.table("runs").select("*").eq("thread_id", thread_id).execute().data
if runs:
    print(f"\n[diag] runs columns: {sorted(runs[0].keys())}")
show("runs", runs, ["id", "parent_run_id", "status", "model", "input_tokens", "output_tokens"])
for r in runs:
    if r.get("error"):
        print(f"  run-error[{r['id'][:8]}]: {str(r['error'])[:300]}")

# 4. messages with tool_calls (the loop)
msgs = sb.table("messages").select("*").eq("thread_id", thread_id).order("created_at").execute().data
print(f"\n===== messages ({len(msgs)} rows) =====")
for m in msgs:
    tc = m.get("tool_calls")
    tcsum = None
    if tc:
        try:
            arr = tc if isinstance(tc, list) else json.loads(tc)
            tcsum = [ (t.get("function", {}) or {}).get("name") or t.get("name") for t in arr ]
        except Exception:
            tcsum = f"<unparsed:{str(tc)[:80]}>"
    content = (m.get("content") or "")
    print(json.dumps({
        "role": m.get("role"),
        "run_id": (m.get("run_id") or "")[:8],
        "tool_calls": tcsum,
        "content_len": len(content),
        "content_head": content[:160],
    }, default=str))

print("\n[diag] done")
