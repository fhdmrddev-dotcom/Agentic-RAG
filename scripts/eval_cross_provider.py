"""
eval_cross_provider.py — Phase 088 (D-02) cross-provider tool-use eval engine.

The MVP SEED of the v2.8 eval harness (D-08) — small, repeatable, operator-runnable
on demand. NOT a productized harness: no config framework, no plugin system, no
DB-backed result store (those are v2.8).

Purpose
-------
Per (provider x canonical-prompt) it drives the LIVE agent loop via the REAL HTTP
route POST /threads/{id}/messages against the running local backend (Pitfall 2 —
driving the service layer directly would bypass threads.py's active_system_prompt
assembly, so a SEED-034 prompt change wouldn't be measured; the fold-gate is about
the shared prompt — measure it). It then asserts three things against durable truth:
  (a) tool-invocation happened     — messages.tool_calls[].name
  (b) arg-shape conformance        — e.g. write_todos args["todos"] is a list, not a JSON string
  (c) DB persistence               — todos / workspace_files row counts

Output is a greppable per-row PASS/FAIL scoreboard so Plan 04's SEED-034 fold-gate
(D-05) can diff before/after runs.

Modeled on scripts/observe-run.py — REUSE its env-load (:36-48) and psycopg2 /
RealDictCursor query (:151-194) patterns; DO NOT hand-roll new plumbing
(RESEARCH §Pattern 1 / Don't Hand-Roll).

Security
--------
- Reads backend/.env via dotenv (observe-run.py path); prints env-var PRESENCE/ABSENCE
  ONLY — NEVER key VALUES (project rule + feedback_env_secrets_handling).
- LOCALHOST HARD-GATE (replicates frontend/tests/e2e/fixtures/db-teardown.fixture.ts:18-29):
  refuses any non-localhost SUPABASE_URL; this script must NEVER point at cloud.
- Operates ONLY on the test user's own threads (V4 RLS); never a service-role
  cross-user read. DB table access is a fixed allowlist {todos, workspace_files};
  thread_id is always a parameterized %s value (never f-string interpolated).

Usage
-----
  # Operator starts the backend uvicorn in a visible terminal first, then:
  backend/venv/Scripts/python.exe scripts/eval_cross_provider.py            # full 4x4 matrix
  backend/venv/Scripts/python.exe scripts/eval_cross_provider.py --provider google
  backend/venv/Scripts/python.exe scripts/eval_cross_provider.py --provider anthropic --prompt multi-tool
  backend/venv/Scripts/python.exe scripts/eval_cross_provider.py --help
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

# ─────────────────────────────────────────────────────────────────────────────
# Configuration — constants an operator can edit per new-model onboarding (D-08 seed).
# These are NOT a config framework; they are plain module constants on purpose.
# ─────────────────────────────────────────────────────────────────────────────

# Representative model per provider (D-01 / D-03). Google MUST be 3.x+ (gemini-2.5
# is known-degraded — narrates a todo list without emitting the tool call — D-03);
# it is recorded as a data point if an operator passes it, never gated.
PROVIDERS: list[tuple[str, str]] = [
    ("openai", "gpt-5.4-mini"),
    ("anthropic", "claude-haiku-4-5"),
    ("google", "gemini-3.5-flash"),   # 3.x+ — NOT gemini-2.5 (D-03)
    ("openrouter", "z-ai/glm-5.1"),
]

# Backend base URL — local uvicorn. Overridable via EVAL_BASE_URL for an operator
# running uvicorn on a non-default port. Default mirrors the app's local default.
DEFAULT_BASE_URL = "http://127.0.0.1:8000"

# Local Postgres default (Supabase CLI exposes direct Postgres on :54322).
DEFAULT_DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

# Test user — env-driven with the documented local dev defaults
# (reference_local_dev_app: fhdmrd@gmail.com / 123456). NEVER a production login.
DEFAULT_TEST_EMAIL = "fhdmrd@gmail.com"
DEFAULT_TEST_PASSWORD = "123456"

# Fixed per-table COUNT queries the persistence assertions may run. Mapping full
# constant query strings (NOT interpolating a table name) closes the SQL-injection
# / arbitrary-table vector entirely (T-088-02-04): the only dynamic value is the
# parameterized %s thread_id. messages is read via dedicated helpers, not count_rows.
_COUNT_QUERIES: dict[str, str] = {
    "todos": "SELECT count(*) AS n FROM todos WHERE thread_id = %s",
    "workspace_files": "SELECT count(*) AS n FROM workspace_files WHERE thread_id = %s",
}

LOCALHOST_RE = re.compile(r"(localhost|127\.0\.0\.1)")


# ─────────────────────────────────────────────────────────────────────────────
# Env loading — observe-run.py:36-48 pattern (DO NOT hand-roll).
# ─────────────────────────────────────────────────────────────────────────────

def load_env() -> None:
    """Load backend/.env so we get SUPABASE_URL / DATABASE_URL / SUPABASE_ANON_KEY
    / provider keys via the same dotenv path the app + observe-run.py use."""
    try:
        from dotenv import load_dotenv
    except ImportError:
        print(
            "ERROR: python-dotenv not installed in this Python. "
            "Run via the backend venv: backend/venv/Scripts/python.exe"
        )
        sys.exit(1)
    env_path = Path(__file__).resolve().parent.parent / "backend" / ".env"
    if not env_path.exists():
        print(f"ERROR: backend/.env not found at {env_path}")
        sys.exit(1)
    load_dotenv(env_path)


def report_env_presence() -> None:
    """Print PRESENCE/ABSENCE of each env var the eval needs — NEVER the value
    (project secrets rule + feedback_env_secrets_handling). observe-run.py does
    the same: callers learn what is configured without ever seeing a secret."""
    # Mark which vars are secrets so a future reader can SEE that values are never
    # printed for them. The loop below prints only "set"/"MISSING" for every var.
    checks = [
        ("SUPABASE_URL", False),
        ("DATABASE_URL", False),         # falls back to the local default if unset
        ("SUPABASE_ANON_KEY", True),     # used to mint the test-user bearer token
        ("LANGSMITH_API_KEY", True),     # optional supplementary trace evidence
        ("REDIS_URL", False),            # optional supplementary run-buffer evidence
        ("OPENAI_API_KEY", True),
        ("ANTHROPIC_API_KEY", True),
        ("GOOGLE_API_KEY", True),
        ("OPENROUTER_API_KEY", True),
    ]
    print("## Environment (presence only — secret VALUES are never printed)\n")
    for name, _is_secret in checks:
        present = bool(os.getenv(name))
        # Intentionally print ONLY presence/absence — no value, no prefix, no length.
        print(f"  - {name}: {'set' if present else 'MISSING'}")
    print()


# ─────────────────────────────────────────────────────────────────────────────
# Localhost hard-gate — replicates db-teardown.fixture.ts:18-29 in Python
# (T-088-02-01). Called at the top of main() BEFORE any DB connection or any
# agent-loop call. This script must NEVER run against cloud.
# ─────────────────────────────────────────────────────────────────────────────

def assert_localhost_only() -> None:
    """Refuse to run unless SUPABASE_URL points at localhost / 127.0.0.1.

    Mirrors the Playwright db-teardown hard-gate: a misconfigured SUPABASE_URL
    pointing at a real project would trigger live agent runs that WRITE
    todos/workspace_files/messages against production data. Fail closed.
    """
    url = os.getenv("SUPABASE_URL", "")
    if not LOCALHOST_RE.search(url):
        shown = (url[:40] + "...") if url else "(unset)"
        print(
            "REFUSING TO RUN: SUPABASE_URL must contain 'localhost' or '127.0.0.1'.\n"
            f"  Got: {shown}\n"
            "  This guard prevents the eval script from driving live agent runs "
            "(which WRITE todos/workspace_files/messages) against a production "
            "database. Point backend/.env at your LOCAL Supabase and retry."
        )
        sys.exit(1)


# ─────────────────────────────────────────────────────────────────────────────
# DB assertion helpers — psycopg2 + RealDictCursor (observe-run.py:151-194 pattern).
# Three assertion families: (a) invocation, (b) arg-shape, (c) persistence.
# ─────────────────────────────────────────────────────────────────────────────

def connect_db():
    """Open a psycopg2 connection to the local Postgres (observe-run.py:152)."""
    try:
        import psycopg2
    except ImportError:
        print(
            "ERROR: psycopg2 not installed in this Python. "
            "Run via the backend venv: backend/venv/Scripts/python.exe"
        )
        sys.exit(1)
    db_url = os.getenv("DATABASE_URL") or os.getenv("POSTGRES_DSN") or DEFAULT_DB_URL
    return psycopg2.connect(db_url)


def get_tool_calls(conn, thread_id: str) -> list[dict]:
    """Flatten messages.tool_calls JSONB arrays for a thread into one list of
    tool-call dicts.

    messages.tool_calls is a JSONB COLUMN, NOT a table (migration 013; .kind
    values documented in migration 055 — Pitfall 3). Each element looks like
    {tool_call_id, name, args, result, status, kind?, sub_agent?, thought_signature?}.

    thread_id is passed as a parameterized %s value — never f-string interpolated
    (T-088-02-04). We read the test user's own thread only (V4 RLS posture).
    """
    from psycopg2.extras import RealDictCursor

    calls: list[dict] = []
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            "SELECT tool_calls FROM messages "
            "WHERE thread_id = %s AND role = 'assistant' AND tool_calls IS NOT NULL "
            "ORDER BY created_at DESC LIMIT 5",
            (thread_id,),
        )
        for row in cur.fetchall():
            tc = row.get("tool_calls")
            # psycopg2 returns JSONB as already-parsed Python objects.
            if isinstance(tc, list):
                for el in tc:
                    if isinstance(el, dict):
                        calls.append(el)
    return calls


def assert_tool_invoked(calls: list[dict], name: str) -> bool:
    """(a) invocation — did the model emit a tool call with this name?"""
    return any(tc.get("name") == name for tc in calls)


def assert_sub_agent_present(calls: list[dict]) -> bool:
    """(a) invocation — did the `task` tool spawn a sub-agent? tool_calls[].sub_agent
    is populated for sub-agent runs (threads.py:2725)."""
    return any(tc.get("sub_agent") for tc in calls)


def assert_arg_shape(calls: list[dict], name: str, key: str, expected_type: type) -> bool:
    """(b) arg-shape conformance — find the named call and assert its args[key] is
    of expected_type.

    The canonical case: write_todos args["todos"] MUST be a `list`, NOT a JSON
    string (the BUG-260529-01 arg-shape regression — weak/OpenRouter models
    sometimes stringify the array). Returns False if the call is absent or the
    arg is the wrong shape.
    """
    for tc in calls:
        if tc.get("name") != name:
            continue
        args = tc.get("args")
        if not isinstance(args, dict) or key not in args:
            return False
        return isinstance(args[key], expected_type)
    return False


def count_rows(conn, table: str, thread_id: str) -> int:
    """(c) persistence — count rows for a thread in an allowlisted table.

    `table` selects one of a fixed set of FULL constant query strings
    (_COUNT_QUERIES) — nothing is interpolated into SQL, so this is injection-safe
    by construction (T-088-02-04). The only dynamic value is the parameterized %s
    thread_id. Proves write_todos / workspace_write actually wrote rows for the
    test user's own thread (V4 RLS posture).
    """
    query = _COUNT_QUERIES.get(table)
    if query is None:
        raise ValueError(
            f"count_rows: table {table!r} is not in the allowlist {sorted(_COUNT_QUERIES)}"
        )
    from psycopg2.extras import RealDictCursor

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(query, (thread_id,))
        row = cur.fetchone()
        return int(row["n"]) if row else 0


def assert_ask_user(conn, thread_id: str) -> bool:
    """(a) invocation — did the agent call ask_user? Uses the JSONB containment
    query (panel.py:128): tool_calls @> '[{"kind":"ask_user_prompt"}]'.

    thread_id is parameterized; the containment literal is a constant.
    """
    from psycopg2.extras import RealDictCursor

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            "SELECT count(*) AS n FROM messages "
            "WHERE thread_id = %s AND tool_calls @> %s::jsonb",
            (thread_id, '[{"kind":"ask_user_prompt"}]'),
        )
        row = cur.fetchone()
        return bool(row and int(row["n"]) > 0)


# ─────────────────────────────────────────────────────────────────────────────
# Entry point — Task 1 scaffold stub. Task 2 wires the live agent-loop driver +
# the 4-prompt x 4-provider matrix + the PASS/FAIL scoreboard onto these helpers.
# ─────────────────────────────────────────────────────────────────────────────

def main(argv: list[str] | None = None) -> int:
    load_env()
    # HARD-GATE first — before any DB connection or agent-loop call.
    assert_localhost_only()
    report_env_presence()
    print(
        "scaffold ready: env loaded, localhost gate passed, DB assertion helpers "
        "defined. The live driver + matrix loop are wired in Task 2."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
