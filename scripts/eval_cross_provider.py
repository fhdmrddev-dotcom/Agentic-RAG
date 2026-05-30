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

import argparse
import os
import re
import sys
import time
from pathlib import Path

# ─────────────────────────────────────────────────────────────────────────────
# Configuration — constants an operator can edit per new-model onboarding (D-08 seed).
# These are NOT a config framework; they are plain module constants on purpose.
# ─────────────────────────────────────────────────────────────────────────────

# Representative model per provider (D-01 / D-03). Google MUST be 3.x+ (gemini-2.5
# is known-degraded — narrates a todo list without emitting the tool call — D-03);
# it is recorded as a data point if an operator passes it, never gated.
#
# Operator-approved (2026-05-30): extended 4 -> 6 by appending the two NATIVE
# weak-model providers the SEED-034 fold-gate is specifically meant to catch
# (narrate-instead-of-call / answer-from-training). The 4-axis recipe FLOOR
# (OpenAI/Anthropic/Google/OpenRouter) is still fully met; deepseek + moonshot
# are a superset that only strengthens the gate's zero-regression condition.
# Additive only — no assertion/gate/localhost/override/prompt/schema change.
PROVIDERS: list[tuple[str, str]] = [
    ("openai", "gpt-5.4-mini"),
    ("anthropic", "claude-haiku-4-5"),
    ("google", "gemini-3.5-flash"),   # 3.x+ — NOT gemini-2.5 (D-03)
    ("openrouter", "z-ai/glm-5.1"),
    ("deepseek", "deepseek-v4-flash"),   # native weak-model — SEED-034 fold-gate target
    ("moonshot", "kimi-k2.6"),           # native weak-model — SEED-034 fold-gate target
    # --- ADD (Phase 089 D-089-09 — native-7 baseline; _PROVIDER_BASE_URLS source of truth;
    #     provider-class representatives, full pinning pass is Phase 096 EVAL-01) ---
    ("zhipu", "glm-4-flash"),            # GLM — _SUB_AGENT_MODEL_DEFAULTS["zhipu"] (config.py:555); provider-class rep, full pinning = Phase 096 EVAL-01
    ("minimax", "minimax-m2.7"),         # _SUB_AGENT_MODEL_DEFAULTS["minimax"] (config.py:554); provider-class rep
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

# How long to wait for one (provider x prompt) agent run to reach a terminal
# status before marking the cell a timeout. Generous — multi-tool runs do real
# LLM + sandbox work. Overridable via EVAL_RUN_TIMEOUT_S.
DEFAULT_RUN_TIMEOUT_S = 240
RUN_POLL_INTERVAL_S = 3.0

# Terminal run states in public.runs.status (migration 035/038 CHECK constraint).
_TERMINAL_RUN_STATES = frozenset({"completed", "failed", "cancelled", "timed_out"})

# ─────────────────────────────────────────────────────────────────────────────
# Canonical prompt set N=4 (RESEARCH §Code Examples, D-02). Each entry is
# (prompt_id, prompt_text, assertion-fn). The assertion fn receives
# (conn, calls, thread_id) and returns {invoked, arg_shape, persisted} bools —
# the three assertion families. A field set to None means "not applicable for
# this prompt" (rendered as a dash in the scoreboard).
# ─────────────────────────────────────────────────────────────────────────────

def _assert_factual_doc_search(conn, calls: list[dict], thread_id: str) -> dict:
    # search_documents (or query_tables for tabular) must be invoked — never
    # answered from the model's training data (the SEED-034 weak-model failure).
    invoked = assert_tool_invoked(calls, "search_documents") or assert_tool_invoked(
        calls, "query_tables"
    )
    return {"invoked": invoked, "arg_shape": None, "persisted": None}


def _assert_multi_tool(conn, calls: list[dict], thread_id: str) -> dict:
    # 2+ tools in one prompt: write_todos (rows in todos) AND workspace_write
    # (rows in workspace_files). Arg-shape: write_todos args["todos"] is a list
    # (NOT a stringified array — BUG-260529-01).
    todos_invoked = assert_tool_invoked(calls, "write_todos")
    file_invoked = assert_tool_invoked(calls, "workspace_write")
    invoked = todos_invoked and file_invoked
    arg_shape = assert_arg_shape(calls, "write_todos", "todos", list)
    persisted = (
        count_rows(conn, "todos", thread_id) > 0
        and count_rows(conn, "workspace_files", thread_id) > 0
    )
    return {"invoked": invoked, "arg_shape": arg_shape, "persisted": persisted}


def _assert_task_sub_agent(conn, calls: list[dict], thread_id: str) -> dict:
    # The `task` tool must spawn a sub-agent — tool_calls[].sub_agent present.
    return {"invoked": assert_sub_agent_present(calls), "arg_shape": None, "persisted": None}


def _assert_ask_user_prompt(conn, calls: list[dict], thread_id: str) -> dict:
    # ask_user must be invoked — JSONB containment on the durable message rows.
    return {"invoked": assert_ask_user(conn, thread_id), "arg_shape": None, "persisted": None}


# (prompt_id, prompt_text, assertion_fn)
CANONICAL_PROMPTS: list[tuple[str, str, object]] = [
    (
        "factual-doc-search",
        "What does my dissertation say about its main research question? "
        "Search my documents before answering.",
        _assert_factual_doc_search,
    ),
    (
        "multi-tool",
        "Plan a 3-step analysis of my Q3 data and write the summary to a file "
        "called q3_summary.md in my workspace.",
        _assert_multi_tool,
    ),
    (
        "task",
        "Find every mention of methodology across all my documents and "
        "summarize them for me.",
        _assert_task_sub_agent,
    ),
    (
        "ask_user",
        "Overwrite my existing report file with a new version — but confirm "
        "with me first before you overwrite it.",
        _assert_ask_user_prompt,
    ),
]

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
        ("ZHIPU_API_KEY", True),       # ADD — Phase 089 D-089-09 (config.py:580, .env.example:100)
        ("MINIMAX_API_KEY", True),     # ADD — Phase 089 D-089-09 (config.py:581, .env.example:101)
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
# Live agent-loop driver — drives the REAL HTTP route POST /threads/{id}/messages
# against the running local backend (Pitfall 2). Provider is switched per-request
# via the MessageCreate.provider/model override (threads.py:1285 override_provider),
# which still assembles the REAL active_system_prompt (threads.py:336 SYSTEM_PROMPT
# + get_tools() descriptions) — exactly the shared path the SEED-034 fold-gate
# must measure. This avoids mutating global user_settings (no shared state, no
# cross-test bleed) while measuring the identical effective prompt.
# ─────────────────────────────────────────────────────────────────────────────

class BackendUnavailable(RuntimeError):
    """Raised when the backend / Supabase auth is not reachable. Caught in main()
    so a no-backend invocation exits with a clean connection message — NEVER a
    traceback that could surface env values."""


def _requests():
    try:
        import requests  # noqa: PLC0415 — local import keeps --help fast
    except ImportError:
        print(
            "ERROR: requests not installed in this Python. "
            "Run via the backend venv: backend/venv/Scripts/python.exe"
        )
        sys.exit(1)
    return requests


def base_url() -> str:
    return os.getenv("EVAL_BASE_URL", DEFAULT_BASE_URL).rstrip("/")


def get_bearer_token() -> str:
    """Mint a bearer token for the test user via the Supabase password grant
    (the same auth the app uses; verified server-side by get_current_user →
    supabase.auth.get_user). Reads SUPABASE_URL + SUPABASE_ANON_KEY from env;
    NEVER prints either value. Credentials are the documented LOCAL test user.
    """
    requests = _requests()
    supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    anon_key = os.getenv("SUPABASE_ANON_KEY") or os.getenv("SUPABASE_PUBLISHABLE_KEY")
    if not supabase_url or not anon_key:
        raise BackendUnavailable(
            "SUPABASE_URL and SUPABASE_ANON_KEY must be set in backend/.env to "
            "authenticate the test user (presence-checked above)."
        )
    email = os.getenv("EVAL_TEST_EMAIL", DEFAULT_TEST_EMAIL)
    password = os.getenv("EVAL_TEST_PASSWORD", DEFAULT_TEST_PASSWORD)
    try:
        resp = requests.post(
            f"{supabase_url}/auth/v1/token",
            params={"grant_type": "password"},
            headers={"apikey": anon_key, "Content-Type": "application/json"},
            json={"email": email, "password": password},
            timeout=15,
        )
    except Exception as e:  # connection refused / DNS / timeout
        raise BackendUnavailable(
            f"Could not reach Supabase auth at {supabase_url} ({type(e).__name__}). "
            "Is local Supabase running (`supabase start`)?"
        ) from e
    if resp.status_code != 200:
        # Do NOT echo the response body verbatim (could contain token material).
        raise BackendUnavailable(
            f"Test-user sign-in failed (HTTP {resp.status_code}). Check the test "
            "user exists in local Supabase and EVAL_TEST_EMAIL/PASSWORD are correct."
        )
    token = resp.json().get("access_token")
    if not token:
        raise BackendUnavailable("Supabase auth returned no access_token.")
    return token


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def create_thread(token: str, title: str) -> str:
    """POST /threads → returns the new thread id (the test user's own thread)."""
    requests = _requests()
    try:
        resp = requests.post(
            f"{base_url()}/threads",
            headers=_auth_headers(token),
            json={"title": title},
            timeout=15,
        )
    except Exception as e:
        raise BackendUnavailable(
            f"Could not reach the backend at {base_url()} ({type(e).__name__}). "
            "Start uvicorn in a visible terminal first (operator runs the backend)."
        ) from e
    if resp.status_code not in (200, 201):
        raise BackendUnavailable(
            f"create_thread failed (HTTP {resp.status_code}) against {base_url()}."
        )
    return resp.json()["id"]


def run_prompt(token: str, thread_id: str, prompt: str, provider: str, model: str) -> str:
    """POST /threads/{id}/messages with the per-request provider+model override —
    the REAL route that builds active_system_prompt (Pitfall 2). Returns run_id."""
    requests = _requests()
    try:
        resp = requests.post(
            f"{base_url()}/threads/{thread_id}/messages",
            headers=_auth_headers(token),
            json={"content": prompt, "provider": provider, "model": model},
            timeout=30,
        )
    except Exception as e:
        raise BackendUnavailable(
            f"Could not reach the backend at {base_url()} ({type(e).__name__})."
        ) from e
    if resp.status_code not in (200, 201):
        raise BackendUnavailable(
            f"send_message failed (HTTP {resp.status_code}) for {provider}/{model}."
        )
    return resp.json()["run_id"]


def wait_for_run(conn, run_id: str, timeout_s: int) -> str:
    """Poll public.runs.status until terminal (completed/failed/cancelled/timed_out)
    or the timeout elapses. Reads the durable runs row directly (psycopg2) —
    run_id is a parameterized %s value. Returns the final status string (or
    'timeout' if the deadline passes while still streaming)."""
    from psycopg2.extras import RealDictCursor

    deadline = time.time() + timeout_s
    last = "unknown"
    while time.time() < deadline:
        # Fresh cursor each poll; commit to avoid a stale snapshot in the
        # script's long-lived connection (psycopg2 default isolation).
        conn.rollback()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT status FROM runs WHERE run_id = %s", (run_id,))
            row = cur.fetchone()
        if row:
            last = row["status"]
            if last in _TERMINAL_RUN_STATES:
                return last
        time.sleep(RUN_POLL_INTERVAL_S)
    return "timeout"


# ─────────────────────────────────────────────────────────────────────────────
# Scoreboard — greppable per-row PASS/FAIL so Plan 04's fold-gate can diff
# before/after runs. One row per (provider x prompt).
# ─────────────────────────────────────────────────────────────────────────────

def _cell(val) -> str:
    if val is None:
        return "  -  "
    return "PASS " if val else "FAIL "


def run_cell(token: str, conn, provider: str, model: str, prompt_id: str,
             prompt_text: str, assertion_fn, timeout_s: int) -> dict:
    """Drive one (provider x prompt) cell end-to-end and run the 3 assertion
    families. Returns a result dict for the scoreboard. Any per-cell error is
    captured (not raised) so one bad cell never aborts the whole matrix."""
    result = {
        "provider": provider, "model": model, "prompt_id": prompt_id,
        "invoked": None, "arg_shape": None, "persisted": None,
        "run_status": "", "ok": False, "note": "",
    }
    try:
        thread_id = create_thread(token, f"eval {provider} {prompt_id}")
        run_id = run_prompt(token, thread_id, prompt_text, provider, model)
        run_status = wait_for_run(conn, run_id, timeout_s)
        result["run_status"] = run_status
        calls = get_tool_calls(conn, thread_id)
        asserted = assertion_fn(conn, calls, thread_id)
        result.update(asserted)
        # A cell PASSES when every APPLICABLE (non-None) assertion is True.
        applicable = [v for v in (asserted.get("invoked"), asserted.get("arg_shape"),
                                  asserted.get("persisted")) if v is not None]
        result["ok"] = bool(applicable) and all(applicable)
    except BackendUnavailable:
        raise  # let main() handle the clean connection message
    except Exception as e:  # one cell's failure must not abort the matrix
        result["note"] = f"{type(e).__name__}: {e}"
    return result


def print_scoreboard(rows: list[dict]) -> None:
    print("\n## Cross-provider tool-use scoreboard\n")
    header = (
        f"{'provider':<11} {'prompt_id':<19} "
        f"{'invoked':<6}{'arg_shape':<10}{'persisted':<10}"
        f"{'run_status':<11} RESULT"
    )
    print(header)
    print("-" * len(header))
    passed = 0
    for r in rows:
        result = "PASS" if r["ok"] else "FAIL"
        if r["ok"]:
            passed += 1
        # Greppable single-token RESULT at the end of each row.
        line = (
            f"{r['provider']:<11} {r['prompt_id']:<19} "
            f"{_cell(r['invoked'])} {_cell(r['arg_shape'])} {_cell(r['persisted'])}"
            f"{r['run_status']:<11} {result}"
        )
        if r["note"]:
            line += f"   ({r['note']})"
        # Machine-greppable marker prefix so `grep 'EVAL_ROW'` extracts the matrix.
        print(f"EVAL_ROW {line}")
    print("-" * len(header))
    print(f"EVAL_SUMMARY {passed}/{len(rows)} cells PASS")


# ─────────────────────────────────────────────────────────────────────────────
# Entry point — the 4-prompt x 4-provider matrix loop. Optional --provider /
# --prompt run a single cell (lightweight re-run for the fold-gate). A no-backend
# invocation exits cleanly with a connection message (no traceback / no values).
# ─────────────────────────────────────────────────────────────────────────────

def _parse_args(argv: list[str] | None):
    parser = argparse.ArgumentParser(
        prog="eval_cross_provider.py",
        description=(
            "Cross-provider tool-use eval engine (Phase 088 D-02). Drives the REAL "
            "POST /threads/{id}/messages route per (provider x canonical-prompt) "
            "and asserts tool-invocation + arg-shape + DB persistence. MVP seed of "
            "the v2.8 harness. Operator must start the backend uvicorn first; "
            "runs against LOCALHOST only (hard-gated)."
        ),
    )
    parser.add_argument(
        "--provider",
        choices=[p for p, _ in PROVIDERS] + ["google-2.5"],
        help="Run only this provider (default: all 4). 'google-2.5' is a "
             "known-degraded data point (D-03) — recorded, never gated.",
    )
    parser.add_argument(
        "--prompt",
        choices=[pid for pid, _, _ in CANONICAL_PROMPTS],
        help="Run only this canonical prompt (default: all 4).",
    )
    parser.add_argument(
        "--model",
        help="Override the representative model for the selected --provider "
             "(new-model onboarding — D-08 seed).",
    )
    return parser.parse_args(argv)


def _selected_providers(args) -> list[tuple[str, str]]:
    if args.provider == "google-2.5":
        # Known-degraded data point — recorded, never gated (D-03).
        return [("google", args.model or "gemini-2.5-flash")]
    if args.provider:
        model = args.model or next(m for p, m in PROVIDERS if p == args.provider)
        return [(args.provider, model)]
    return list(PROVIDERS)


def _selected_prompts(args) -> list[tuple[str, str, object]]:
    if args.prompt:
        return [p for p in CANONICAL_PROMPTS if p[0] == args.prompt]
    return list(CANONICAL_PROMPTS)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    load_env()
    # HARD-GATE first — before any DB connection or agent-loop call (T-088-02-01).
    assert_localhost_only()
    report_env_presence()

    providers = _selected_providers(args)
    prompts = _selected_prompts(args)
    timeout_s = int(os.getenv("EVAL_RUN_TIMEOUT_S", DEFAULT_RUN_TIMEOUT_S))

    print(
        f"Running {len(providers)} provider(s) x {len(prompts)} prompt(s) "
        f"= {len(providers) * len(prompts)} cell(s) against {base_url()} "
        f"(run timeout {timeout_s}s).\n"
    )

    try:
        token = get_bearer_token()
        conn = connect_db()
    except BackendUnavailable as e:
        # Clean exit — NO traceback (which could surface env values).
        print(f"\nCANNOT RUN: {e}")
        print(
            "This script needs (1) local Supabase up and (2) the backend uvicorn "
            "running in a visible terminal. Start them, then re-run."
        )
        return 1

    rows: list[dict] = []
    try:
        for provider, model in providers:
            for prompt_id, prompt_text, assertion_fn in prompts:
                print(f"  -> {provider}/{model} :: {prompt_id} ...")
                row = run_cell(
                    token, conn, provider, model, prompt_id, prompt_text,
                    assertion_fn, timeout_s,
                )
                rows.append(row)
    except BackendUnavailable as e:
        print(f"\nCANNOT CONTINUE: {e}")
        if rows:
            print_scoreboard(rows)
        return 1
    finally:
        try:
            conn.close()
        except Exception:
            pass

    print_scoreboard(rows)
    # Exit non-zero if any gated cell failed, so an operator / Plan 04 can branch
    # on the exit code. (google-2.5 is run via a separate flag and is not in the
    # default matrix, so it never flips this gate — D-03.)
    return 0 if all(r["ok"] for r in rows) else 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
