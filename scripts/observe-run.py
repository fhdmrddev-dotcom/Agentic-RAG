"""
observe-run.py — Phase 075.5 deep observability dumper.

Given a run_id (and optional thread_id), pull a unified snapshot across:
  1. Redis run-buffer stream (run:{run_id}) — every SSE event the producer emitted
  2. Supabase Postgres — runs table row, messages for thread, any tool_calls
  3. LangSmith — trace tree filtered by run_id metadata
  4. Backend log excerpts referencing the run_id (grep'd locally)

Reads its own env from backend/.env via the same dotenv path the app uses.
Prints structured Markdown to stdout. Designed to be called by Claude Code
without ever exposing secrets to the calling context.

Usage:
  cd backend
  ./venv/Scripts/python.exe ../scripts/observe-run.py <run_id> [thread_id]
"""
from __future__ import annotations

import json
import os
import sys
import textwrap
from pathlib import Path


def _safe_str(x, max_len=400):
    if x is None:
        return ""
    s = str(x)
    if len(s) > max_len:
        return s[:max_len] + f"...[+{len(s) - max_len} more chars]"
    return s


def _load_env():
    """Load backend/.env so we get LANGSMITH_API_KEY / SUPABASE_URL / REDIS_URL."""
    try:
        from dotenv import load_dotenv
    except ImportError:
        print("ERROR: python-dotenv not installed in this Python. "
              "Run via the backend venv: backend/venv/Scripts/python.exe")
        sys.exit(1)
    env_path = Path(__file__).resolve().parent.parent / "backend" / ".env"
    if not env_path.exists():
        print(f"ERROR: backend/.env not found at {env_path}")
        sys.exit(1)
    load_dotenv(env_path)


def _redis_dump(run_id: str) -> str:
    """Dump every event in run:{run_id} stream. Truncate per-field."""
    out = ["## 1. Redis run-buffer (run:{run_id})\n".format(run_id=run_id)]
    try:
        import redis
    except ImportError:
        return out[0] + "\n_skipped: redis package not installed_\n"
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    try:
        r = redis.from_url(redis_url, decode_responses=True)
        key = f"run:{run_id}"
        length = r.xlen(key)
        out.append(f"- key=`{key}`  length=**{length}** events\n")
        if length == 0:
            out.append("- _no events in this stream (may have been trimmed by Phase 061 cleanup, or run never wrote events)_\n")
            # Diagnostic: list any current run:* keys to show buffer system works
            try:
                cursor = 0
                run_keys = []
                while True:
                    cursor, batch = r.scan(cursor=cursor, match="run:*", count=200)
                    run_keys.extend(batch)
                    if cursor == 0 or len(run_keys) >= 20:
                        break
                if run_keys:
                    out.append(f"- _active `run:*` keys in Redis right now ({len(run_keys)}): {', '.join(run_keys[:10])}{' ...' if len(run_keys) > 10 else ''}_\n")
                else:
                    out.append("- _no `run:*` keys present right now_\n")
            except Exception:
                pass
            return "".join(out)
        # All entries. Real schema: each entry is {"data": "<json-string>"}
        entries_raw = r.xrange(key, count=10_000)
        # Parse the inner JSON so we get a flat field dict per event.
        entries = []
        for entry_id, fields in entries_raw:
            payload = fields.get("data")
            if payload:
                try:
                    parsed = json.loads(payload)
                    if isinstance(parsed, dict):
                        entries.append((entry_id, parsed))
                        continue
                except Exception:
                    pass
            entries.append((entry_id, fields))
        # Count by event type
        by_type: dict[str, int] = {}
        firsts: dict[str, tuple] = {}
        lasts: dict[str, tuple] = {}
        for entry_id, fields in entries:
            etype = fields.get("type", "?")
            by_type[etype] = by_type.get(etype, 0) + 1
            if etype not in firsts:
                firsts[etype] = (entry_id, fields)
            lasts[etype] = (entry_id, fields)
        out.append("\n### Event type counts\n\n")
        out.append("| type | count |\n|---|---|\n")
        for k, v in sorted(by_type.items(), key=lambda x: -x[1]):
            out.append(f"| `{k}` | {v} |\n")
        # Show full sequence (compact) for interesting types
        interesting = {"tool_preparing", "tool_start", "tool_end",
                       "code_execution_start", "code_execution_complete",
                       "iteration_start", "iteration_end",
                       "error", "done", "cancelled", "timed_out",
                       "sources", "citations", "usage"}
        seq = [(eid, f) for (eid, f) in entries if f.get("type") in interesting]
        out.append(f"\n### Lifecycle sequence (n={len(seq)} interesting events)\n\n")
        for eid, f in seq:
            etype = f.get("type", "?")
            extras = {k: _safe_str(v, 120) for k, v in f.items() if k != "type"}
            extras_s = ", ".join(f"{k}={v!r}" for k, v in extras.items())
            out.append(f"- `{etype}` {extras_s}\n")
        # First few delta events (text streaming preview)
        deltas = [(eid, f) for (eid, f) in entries if f.get("type") == "delta"]
        if deltas:
            out.append(f"\n### Delta samples ({len(deltas)} total)\n\n")
            for eid, f in deltas[:3]:
                out.append(f"- first: `{_safe_str(f.get('content'), 200)}`\n")
            for eid, f in deltas[-3:]:
                out.append(f"- last:  `{_safe_str(f.get('content'), 200)}`\n")
    except Exception as e:
        out.append(f"\n_redis query failed: {type(e).__name__}: {e}_\n")
    return "".join(out)


def _supabase_dump(run_id: str, thread_id: str | None) -> str:
    """Query Postgres directly for runs row + messages + tool_calls."""
    out = ["\n## 2. Supabase Postgres (runs / messages / tool_calls)\n\n"]
    db_url = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")
    if not db_url:
        # Try common local Supabase default
        db_url = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
        out.append(f"_no DATABASE_URL in env; trying local Supabase default_\n")
    try:
        import psycopg2
        from psycopg2.extras import RealDictCursor
    except ImportError:
        out.append("_skipped: psycopg2 not installed_\n")
        return "".join(out)
    try:
        conn = psycopg2.connect(db_url)
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # runs row (real schema: PK=run_id, NO created_at, has input_tokens/output_tokens/error)
            cur.execute(
                "SELECT run_id, thread_id, message_id, status, model, provider, "
                "started_at, completed_at, "
                "EXTRACT(EPOCH FROM (COALESCE(completed_at, NOW()) - started_at))::int AS wall_seconds, "
                "input_tokens, output_tokens, error "
                "FROM runs WHERE run_id = %s",
                (run_id,),
            )
            row = cur.fetchone()
            assistant_message_id = None
            if row:
                out.append("### runs row\n\n")
                out.append("| field | value |\n|---|---|\n")
                for k, v in row.items():
                    out.append(f"| `{k}` | {_safe_str(v, 300)} |\n")
                if not thread_id:
                    thread_id = str(row.get("thread_id", ""))
                assistant_message_id = row.get("message_id")
            else:
                out.append(f"_no runs row found for run_id={run_id}_\n")
            # messages for this thread (most recent 12)
            # messages table has no run_id column; join via runs.message_id
            if thread_id:
                cur.execute(
                    "SELECT id, role, length(COALESCE(content,'')) AS content_len, "
                    "created_at "
                    "FROM public.messages WHERE thread_id = %s "
                    "ORDER BY created_at DESC LIMIT 12",
                    (thread_id,),
                )
                msgs = cur.fetchall()
                out.append(f"\n### public.messages (most recent 12 in thread `{thread_id}`)\n\n")
                out.append("| created_at | role | content_len | id |\n|---|---|---|---|\n")
                for m in msgs:
                    marker = "   <== THIS RUN's assistant message" if assistant_message_id and str(m['id']) == str(assistant_message_id) else ""
                    out.append(
                        f"| {m['created_at']} | {m['role']} | "
                        f"{m['content_len']} | `{_safe_str(m['id'], 36)}`{marker} |\n"
                    )
            # tool_calls table doesn't exist in this schema — skip silently.
        conn.close()
    except Exception as e:
        out.append(f"\n_postgres query failed: {type(e).__name__}: {e}_\n")
    return "".join(out)


def _langsmith_dump(run_id: str) -> str:
    """Query LangSmith for traces tagged with this run_id."""
    out = ["\n## 3. LangSmith traces\n\n"]
    api_key = os.getenv("LANGSMITH_API_KEY") or os.getenv("LANGCHAIN_API_KEY")
    project = os.getenv("LANGSMITH_PROJECT") or os.getenv("LANGCHAIN_PROJECT")
    if not api_key:
        out.append("_skipped: LANGSMITH_API_KEY not set_\n")
        return "".join(out)
    if not project:
        out.append("_skipped: LANGSMITH_PROJECT not set_\n")
        return "".join(out)
    try:
        from langsmith import Client
    except ImportError:
        out.append("_skipped: langsmith package not installed_\n")
        return "".join(out)
    try:
        client = Client(api_key=api_key)
        # Try filter by metadata.run_id first
        filter_expr = f'and(eq(metadata_key, "run_id"), eq(metadata_value, "{run_id}"))'
        runs = list(client.list_runs(
            project_name=project,
            filter=filter_expr,
            limit=20,
        ))
        if not runs:
            # Fallback: recent traces in this project, last 5 minutes
            from datetime import datetime, timedelta, timezone
            since = datetime.now(timezone.utc) - timedelta(minutes=15)
            runs = list(client.list_runs(
                project_name=project,
                start_time=since,
                limit=20,
            ))
            out.append(
                f"_no traces with metadata.run_id={run_id}; "
                f"showing last 15min of project `{project}` (n={len(runs)})_\n\n"
            )
        else:
            out.append(f"### Traces with metadata.run_id={run_id} (n={len(runs)})\n\n")
        if not runs:
            out.append("_no recent traces in project_\n")
            return "".join(out)
        out.append("| name | run_type | status | total_tokens | latency_ms | error |\n|---|---|---|---|---|---|\n")
        for r in runs:
            tokens = (r.total_tokens if hasattr(r, "total_tokens") else None) or 0
            latency = ""
            try:
                if r.start_time and r.end_time:
                    latency = f"{int((r.end_time - r.start_time).total_seconds() * 1000)}"
            except Exception:
                pass
            err = _safe_str(r.error, 80) if hasattr(r, "error") and r.error else ""
            out.append(
                f"| `{_safe_str(r.name, 40)}` | {getattr(r, 'run_type', '?')} | "
                f"{getattr(r, 'status', '?')} | {tokens} | {latency} | {err} |\n"
            )
    except Exception as e:
        out.append(f"\n_langsmith query failed: {type(e).__name__}: {e}_\n")
    return "".join(out)


def _backend_log_grep(run_id: str) -> str:
    """Grep backend logs for lines mentioning this run_id."""
    out = [f"\n## 4. Backend log lines mentioning {run_id}\n\n"]
    log_dir = Path(__file__).resolve().parent.parent / "backend"
    found_any = False
    for log_name in ("uvicorn.out.log", "uvicorn.err.log"):
        log_path = log_dir / log_name
        if not log_path.exists():
            continue
        try:
            with open(log_path, "r", encoding="utf-8", errors="replace") as f:
                lines = [ln.rstrip() for ln in f if run_id in ln]
            if lines:
                found_any = True
                out.append(f"### {log_name} ({len(lines)} lines)\n\n```\n")
                for ln in lines[-30:]:
                    out.append(ln + "\n")
                out.append("```\n\n")
        except Exception as e:
            out.append(f"_failed to read {log_name}: {e}_\n")
    if not found_any:
        out.append("_no log lines mention this run_id (run may be too fresh)_\n")
    return "".join(out)


def main():
    if len(sys.argv) < 2:
        print("usage: observe-run.py <run_id> [thread_id]")
        sys.exit(2)
    run_id = sys.argv[1].strip()
    thread_id = sys.argv[2].strip() if len(sys.argv) > 2 else None
    _load_env()
    print(f"# Run observability report: `{run_id}`\n")
    if thread_id:
        print(f"_thread: `{thread_id}`_\n")
    print(_redis_dump(run_id))
    print(_supabase_dump(run_id, thread_id))
    print(_langsmith_dump(run_id))
    print(_backend_log_grep(run_id))


if __name__ == "__main__":
    main()
