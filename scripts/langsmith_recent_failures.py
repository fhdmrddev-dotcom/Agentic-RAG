"""One-shot diagnostic: list recent failed/timed_out runs from LangSmith.

Reads LANGCHAIN_API_KEY + LANGCHAIN_PROJECT from backend/.env via python-dotenv.
No values are echoed — only API response data.

Usage (from project root):
    backend/venv/Scripts/python.exe scripts/langsmith_recent_failures.py
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Load backend/.env first so LANGCHAIN_* vars are populated in os.environ
try:
    from dotenv import load_dotenv
except ImportError:
    print("ERROR: python-dotenv not installed in this venv.", file=sys.stderr)
    sys.exit(1)

ENV_PATH = Path(__file__).resolve().parent.parent / "backend" / ".env"
if not ENV_PATH.is_file():
    print(f"ERROR: .env not found at {ENV_PATH}", file=sys.stderr)
    sys.exit(1)
load_dotenv(ENV_PATH)

# Resolve API key — supports both LANGCHAIN_* (legacy) and LANGSMITH_* (newer) names
api_key = os.environ.get("LANGSMITH_API_KEY") or os.environ.get("LANGCHAIN_API_KEY")
project = os.environ.get("LANGSMITH_PROJECT") or os.environ.get("LANGCHAIN_PROJECT")
endpoint = (
    os.environ.get("LANGSMITH_ENDPOINT")
    or os.environ.get("LANGCHAIN_ENDPOINT")
    or "https://api.smith.langchain.com"
)

if not api_key:
    print("ERROR: No LANGSMITH_API_KEY or LANGCHAIN_API_KEY found in backend/.env", file=sys.stderr)
    sys.exit(2)
if not project:
    print("ERROR: No LANGSMITH_PROJECT or LANGCHAIN_PROJECT found in backend/.env", file=sys.stderr)
    sys.exit(2)

# Lazy import requests since it may not be needed if env load fails
try:
    import requests
except ImportError:
    print("ERROR: requests not installed in this venv.", file=sys.stderr)
    sys.exit(1)

# Step 1: resolve project name → session UUID (LangSmith API requirement)
headers = {"x-api-key": api_key, "Content-Type": "application/json"}
try:
    s_resp = requests.get(
        f"{endpoint}/sessions",
        headers=headers,
        params={"name": project},
        timeout=15,
    )
except requests.RequestException as e:
    print(f"ERROR: session lookup failed: {type(e).__name__}: {e}", file=sys.stderr)
    sys.exit(3)

if s_resp.status_code != 200:
    print(f"ERROR: session lookup HTTP {s_resp.status_code}: {s_resp.text[:300]}", file=sys.stderr)
    sys.exit(3)

sessions = s_resp.json()
session_id = None
if isinstance(sessions, list) and sessions:
    # Exact name match first; fall back to first hit
    for s in sessions:
        if s.get("name") == project:
            session_id = s.get("id")
            break
    if not session_id:
        session_id = sessions[0].get("id")

if not session_id:
    print(f"ERROR: No session found for project name '{project}'", file=sys.stderr)
    print(f"Available sessions: {[s.get('name') for s in sessions[:10]]}", file=sys.stderr)
    sys.exit(3)

# Step 2: query failed runs in that session, last 24h
start_time = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
url = f"{endpoint}/runs/query"
payload = {
    "session": [session_id],
    "is_root": True,
    "error": True,
    "start_time": start_time,
    "limit": 25,
    "select": [
        "id",
        "name",
        "start_time",
        "end_time",
        "status",
        "error",
        "extra",
        "run_type",
        "inputs",
    ],
}

try:
    resp = requests.post(url, headers=headers, json=payload, timeout=20)
except requests.RequestException as e:
    print(f"ERROR: LangSmith API request failed: {type(e).__name__}: {e}", file=sys.stderr)
    sys.exit(3)

if resp.status_code != 200:
    print(f"ERROR: LangSmith API returned HTTP {resp.status_code}", file=sys.stderr)
    print(resp.text[:500], file=sys.stderr)
    sys.exit(3)

data = resp.json()
runs = data.get("runs", []) if isinstance(data, dict) else (data if isinstance(data, list) else [])

print(f"Project: {project}")
print(f"Endpoint: {endpoint}")
print(f"Window: last 24h (since {start_time})")
print(f"Failed/error runs: {len(runs)}")
print("=" * 80)

for run in runs:
    rid = run.get("id", "")
    name = run.get("name", "")
    start = run.get("start_time", "")
    end = run.get("end_time", "")
    status = run.get("status", "")
    error = (run.get("error") or "")[:300]
    extra = run.get("extra") or {}
    metadata = extra.get("metadata") if isinstance(extra, dict) else {}
    invocation_params = (
        extra.get("invocation_params") if isinstance(extra, dict) else {}
    ) or {}
    model = (
        (metadata or {}).get("ls_model_name")
        or (metadata or {}).get("model")
        or invocation_params.get("model")
        or ""
    )
    provider = (metadata or {}).get("ls_provider") or ""
    print(f"run_id:    {rid}")
    print(f"name:      {name}")
    print(f"status:    {status}")
    print(f"provider:  {provider}")
    print(f"model:     {model}")
    print(f"started:   {start}")
    print(f"ended:     {end}")
    print(f"error:     {error}")
    print("-" * 80)

# Also pull a small histogram by error message prefix
from collections import Counter
buckets: Counter[str] = Counter()
for run in runs:
    err = (run.get("error") or "").strip()
    if not err:
        continue
    # Bucket by first 60 chars of error
    buckets[err[:60]] += 1

if buckets:
    print()
    print("Error pattern histogram (top 10):")
    for pattern, count in buckets.most_common(10):
        print(f"  {count:3d}  {pattern}")
