"""Phase 067.2 Plan 06 UAT driver — orchestrator-driven test of rows 9 + 11.

Reads SUPABASE_URL and SUPABASE_ANON_KEY from backend/.env (name-only access — values
stay in process memory, never logged), acquires a password-grant access token for
fhdmrd@gmail.com, submits a long-form prompt to the local backend, polls the runs
table, and reports the run_id + final status. The orchestrator then queries
LangSmith via MCP for the trace exception column.

Usage:
    python _uat_driver.py acquire-token
    python _uat_driver.py submit-prompt --model claude-sonnet-4-6 --prompt "..."
    python _uat_driver.py poll-run --run-id <uuid>
"""
import argparse
import json
import os
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path


def load_env(path: Path) -> dict:
    env = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def supabase_login(supabase_url: str, anon_key: str, email: str, password: str) -> dict:
    url = supabase_url.rstrip("/") + "/auth/v1/token?grant_type=password"
    body = json.dumps({"email": email, "password": password}).encode()
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={"apikey": anon_key, "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read())


def post_message(backend: str, token: str, thread_id: str, content: str, model: str, provider: str | None = None) -> dict:
    url = f"{backend}/threads/{thread_id}/messages"
    payload = {"content": content, "model": model, "agent_mode": "default"}
    if provider:
        payload["provider"] = provider
    body = json.dumps(payload).encode()
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return {"error": e.code, "body": e.read().decode("utf-8", errors="replace")}


def create_thread(backend: str, token: str, title: str) -> dict:
    url = f"{backend}/threads"
    body = json.dumps({"title": title}).encode()
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read())


def get_run(supabase_rest: str, anon_key: str, token: str, run_id: str) -> dict:
    url = f"{supabase_rest.rstrip('/')}/runs?run_id=eq.{run_id}&select=run_id,status,model,error,created_at,completed_at"
    req = urllib.request.Request(
        url,
        method="GET",
        headers={
            "apikey": anon_key,
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        rows = json.loads(r.read())
        return rows[0] if rows else {}


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("acquire-token")

    sp_create = sub.add_parser("create-thread")
    sp_create.add_argument("--title", default="UAT row test")

    sp_send = sub.add_parser("submit-prompt")
    sp_send.add_argument("--thread-id", required=True)
    sp_send.add_argument("--model", required=True)
    sp_send.add_argument("--prompt", required=True)
    sp_send.add_argument("--provider", default=None)

    sp_poll = sub.add_parser("poll-run")
    sp_poll.add_argument("--run-id", required=True)
    sp_poll.add_argument("--timeout", type=int, default=60)

    args = parser.parse_args()

    env_path = Path("C:/Vibe Apps/Agentic RAG/backend/.env")
    env = load_env(env_path)
    supabase_url = env.get("SUPABASE_URL", "")
    anon_key = env.get("SUPABASE_ANON_KEY", "")
    rest_url = env.get("SUPABASE_REST_URL") or (supabase_url.rstrip("/") + "/rest/v1")
    backend = "http://localhost:8000"

    if not supabase_url or not anon_key:
        print("ERROR: SUPABASE_URL or SUPABASE_ANON_KEY missing from .env", file=sys.stderr)
        sys.exit(2)

    if args.cmd == "acquire-token":
        data = supabase_login(supabase_url, anon_key, "fhdmrd@gmail.com", "123456")
        # Print only the access token to stdout; user_id to stderr (not logged)
        print(data["access_token"])
        return

    # All other commands need a token
    auth = supabase_login(supabase_url, anon_key, "fhdmrd@gmail.com", "123456")
    token = auth["access_token"]

    if args.cmd == "create-thread":
        result = create_thread(backend, token, args.title)
        print(json.dumps({"thread_id": result.get("id"), "title": result.get("title")}))
        return

    if args.cmd == "submit-prompt":
        result = post_message(backend, token, args.thread_id, args.prompt, args.model, args.provider)
        print(json.dumps({
            "run_id": result.get("run_id"),
            "message_id": result.get("message_id"),
            "raw": result if "error" in result else None,
        }, default=str))
        return

    if args.cmd == "poll-run":
        deadline = time.time() + args.timeout
        last = None
        while time.time() < deadline:
            row = get_run(rest_url, anon_key, token, args.run_id)
            last = row
            status = row.get("status")
            if status in ("completed", "timed_out", "cancelled", "failed", "errored"):
                break
            time.sleep(1.5)
        print(json.dumps(last, default=str))
        return


if __name__ == "__main__":
    main()
