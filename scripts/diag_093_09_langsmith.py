"""
Phase 093-09 GLM diagnosis — LangSmith trace reader (read-only).

Pulls the sub-agent LLM-call sequence for the GLM literature_review run so we can
see, per iteration, what GLM emitted (tool call vs answer) and WHICH search query
each turn used — the discriminator between "cap too low / progressive" (branch B)
and "stuck repetitive loop / deep" (branch D).

Usage (repo root, backend venv):
  backend/venv/Scripts/python.exe scripts/diag_093_09_langsmith.py
"""
import os
import json
from datetime import datetime, timezone, timedelta

from dotenv import load_dotenv

HERE = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(HERE, "..", "backend", ".env"))

PROJECT = os.environ.get("LANGSMITH_PROJECT") or os.environ.get("LANGCHAIN_PROJECT") or "agentic-rag-module2"
print(f"[ls] project={PROJECT}  key_set={bool(os.environ.get('LANGSMITH_API_KEY') or os.environ.get('LANGCHAIN_API_KEY'))}")

from langsmith import Client  # noqa: E402

client = Client()

# The run happened ~2026-06-02 21:12-21:16 UTC. Window generously.
start = datetime(2026, 6, 2, 21, 8, tzinfo=timezone.utc)
runs = list(client.list_runs(project_name=PROJECT, start_time=start, limit=400))
print(f"[ls] fetched {len(runs)} runs since {start.isoformat()}")

# Keep LLM/chat runs mentioning glm / z.ai / chat.completions
def is_glm(r):
    blob = json.dumps({"name": r.name, "extra": getattr(r, "extra", None)}, default=str).lower()
    return "glm" in blob or "z.ai" in blob or "zhipu" in blob

cand = [r for r in runs if is_glm(r)]
print(f"[ls] glm-related runs: {len(cand)}")

# Sort by start_time
cand.sort(key=lambda r: r.start_time or start)

for i, r in enumerate(cand):
    inp = r.inputs or {}
    out = r.outputs or {}
    # Extract the last message / tool calls from outputs
    out_msg = json.dumps(out, default=str)
    # number of input messages = proxy for iteration depth
    msgs = inp.get("messages") or inp.get("input") or []
    n_in_msgs = len(msgs) if isinstance(msgs, list) else "?"
    # Find tool_calls in the output
    tc_names = []
    try:
        s = out_msg
        # crude: look for "search_documents" and tool call names
        for name in ["search_documents", "query_documents", "grep", "read_document", "list_documents"]:
            c = s.count(name)
            if c:
                tc_names.append(f"{name}x{c}")
    except Exception:
        pass
    print(f"\n--- [{i}] {r.name}  start={r.start_time}  in_msgs={n_in_msgs} ---")
    print(f"    run_type={r.run_type}  tokens(in/out)={getattr(r,'prompt_tokens',None)}/{getattr(r,'completion_tokens',None)}")
    if tc_names:
        print(f"    tool-mentions in output: {tc_names}")
    # Print a slice of the FINAL output content to see if it's a tool call or prose answer
    print(f"    out_head: {out_msg[:500]}")
    # If inputs carry the tool/query args, surface the search query for this turn
    try:
        last_user = None
        if isinstance(msgs, list):
            for m in msgs:
                if isinstance(m, dict) and m.get("role") in ("tool", "user"):
                    last_user = m
        if last_user:
            print(f"    last_in_role={last_user.get('role')} content_head={str(last_user.get('content'))[:160]}")
    except Exception:
        pass

print("\n[ls] done")
