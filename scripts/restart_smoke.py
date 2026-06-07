"""
restart_smoke.py — Phase 096 (D-08 / EVAL-02 / SC#2+#4) operator-driven restart smoke.

THE HUMAN IS THE RESTART MECHANISM. This script NEVER touches the backend
process — it never starts, stops, or restarts uvicorn. The robot owns:
  1. seeding the right workflow run (eval_coverage by default — all 5 phase types,
     with eval_slow_step's ~20s mid-`programmatic` kill window, migration 066),
  2. the unmistakable KILL-NOW banner exactly when the target phase is active,
  3. post-restart DB-truth assertions (HARNESS-03 resumability verified, not rebuilt):
       - no skipped phases (every workflow_phases row reached 'completed')
       - no double-applied side effects (harness_audit HAVING count(*) > 1 detector)
       - no duplicate sub-agent fan-out (batch sub_run_ids == split sub_questions)
       - ask_user leg: prompt re-emitted post-restart + the answer POST reaches the
         engine and the run completes — this IS the BUG-260605-01 live verification.

The three kill points (--kill-at):
  programmatic : phase 0 `split` runs eval_slow_step (~20s sleep) — a humanly
                 possible kill window inside a programmatic phase (SC#4, never faked)
  llm_agent    : the `deep_dive` phase (a real streaming sub-agent mid-flight)
  ask_user     : the `confirm` llm_human_input phase with a PENDING prompt — the
                 resume path must re-subscribe + re-emit (resume_pending_prompt)

What is being VERIFIED (never rebuilt): harness_engine.resume_stranded_workflows —
the startup sweep that claims stranded runs (CAS), re-runs the active phase from the
top (idempotent — an active phase's output was never durable), re-emits a pending
ask_user prompt, and always terminalizes the minted producer shell.

Plumbing is the eval_cross_provider.py five-piece kit, copied verbatim (the
established self-contained-script pattern — observe-run.py / 096-PATTERNS.md
Assignment 5): load_env -> assert_localhost_only FIRST -> report_env_presence
(presence-only, never values) -> get_bearer_token -> connect_db. Constant-string
allowlisted SQL, %s params only (T-096-07-04). LOCALHOST HARD-GATE (T-096-07-01).

Usage
-----
  # Operator starts the backend uvicorn in a visible terminal first, then:
  backend/venv/Scripts/python.exe scripts/restart_smoke.py --kill-at programmatic
  backend/venv/Scripts/python.exe scripts/restart_smoke.py --kill-at llm_agent
  backend/venv/Scripts/python.exe scripts/restart_smoke.py --kill-at ask_user
  # When the SMOKE_KILL banner prints: Ctrl+C the uvicorn terminal, then start it
  # again. The script detects DOWN/UP via GET /health and runs the assertions.

Greppable markers: SMOKE_KILL / SMOKE_DOWN / SMOKE_UP / SMOKE_ASSERT / SMOKE_RESULT.
"""
from __future__ import annotations

import argparse
import os
import re
import sys
import time
from pathlib import Path

# ─────────────────────────────────────────────────────────────────────────────
# Configuration — plain module constants (not a config framework), mirroring
# eval_cross_provider.py's discipline.
# ─────────────────────────────────────────────────────────────────────────────

DEFAULT_BASE_URL = "http://127.0.0.1:8000"
DEFAULT_DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
DEFAULT_TEST_EMAIL = "fhdmrd@gmail.com"
DEFAULT_TEST_PASSWORD = "123456"

# Representative model per provider (copied from eval_cross_provider.py PROVIDERS —
# the smoke is a resumability proof, not a model eval; --model overrides).
DEFAULT_MODELS: dict[str, str] = {
    "openai": "gpt-5.4-mini",
    "anthropic": "claude-haiku-4-5",
    "google": "gemini-3.5-flash",
    "openrouter": "z-ai/glm-5.1",
    "deepseek": "deepseek-v4-flash",
    "moonshot": "kimi-k2.6",
    "zhipu": "glm-4.6",
    "minimax": "MiniMax-M2.5-highspeed",
}

# Kill point -> the phase_type whose FIRST phase in the definition is the target.
# Slugs are resolved at runtime from the definition JSONB (never hardcoded) so a
# reseeded workflow with different slugs still maps correctly.
KILL_AT_PHASE_TYPE: dict[str, str] = {
    "programmatic": "programmatic",
    "llm_agent": "llm_agent",
    "ask_user": "llm_human_input",
}

# 3-subtopic kickoff (2 semicolons -> 3 branches through split_topic/eval_slow_step;
# clauses avoid ' and ' / ' vs ' / newlines so the clause-split is exactly 3).
KICKOFF_PROMPT = (
    "retrieval quality in RAG systems; "
    "document ingestion pipeline design; "
    "cross-provider model routing"
)

PHASE_POLL_INTERVAL_S = 0.5
HEALTH_POLL_INTERVAL_S = 0.5
WAIT_BOUND_S = 600           # 10 min bound per operator wait (down / up / phase-active)
DEFAULT_RUN_TIMEOUT_S = 900  # post-restart wait for workflow terminal (override: SMOKE_RUN_TIMEOUT_S)

# Terminal workflow_runs statuses (threads.py:815 _TERMINAL_WORKFLOW + the
# workflow_runs_status_check CHECK constraint).
_TERMINAL_WORKFLOW_STATES = frozenset({"completed", "failed", "cancelled"})

LOCALHOST_RE = re.compile(r"(localhost|127\.0\.0\.1)")

# ─────────────────────────────────────────────────────────────────────────────
# Allowlisted constant SQL (T-096-07-04): FULL constant query strings — nothing is
# ever interpolated into SQL; the only dynamic values are parameterized %s ids.
# ─────────────────────────────────────────────────────────────────────────────

_SQL_DEFINITION_BY_SLUG = (
    "SELECT id::text AS id, definition FROM workflow_definitions "
    "WHERE slug = %s AND status = 'published' "
    "ORDER BY version DESC LIMIT 1"
)
_SQL_THREAD_ANCHOR = (
    "SELECT active_workflow_run_id::text AS wf_id FROM threads WHERE id = %s"
)
_SQL_WF_STATUS = "SELECT status FROM workflow_runs WHERE id = %s"
_SQL_PHASES = (
    "SELECT phase_index, slug, status, output FROM workflow_phases "
    "WHERE workflow_run_id = %s ORDER BY phase_index"
)
# Double-execution detector — harness_audit is INSERT-only (HARNESS-06), so a
# re-applied side effect HAS to show up as a second phase_completed row.
# Any row returned = a double-applied side effect.
_SQL_DOUBLE_COMPLETION = (
    "SELECT metadata->>'phase' AS slug, count(*) AS n FROM harness_audit "
    "WHERE run_id = %s AND event_type = 'phase_completed' "
    "GROUP BY 1 HAVING count(*) > 1"
)
# Pending ask_user prompt rows for a thread (the panel.py /pending containment
# shape): prompt rows with NO matching response row (paired on tool_call_id).
_SQL_PENDING_PROMPTS = (
    "SELECT m.id::text AS message_id, m.tool_calls FROM messages m "
    "WHERE m.thread_id = %s AND m.role = 'system' "
    "AND m.tool_calls @> '[{\"kind\": \"ask_user_prompt\"}]'::jsonb "
    "AND NOT EXISTS ("
    " SELECT 1 FROM messages r "
    " WHERE r.thread_id = m.thread_id AND r.role = 'system' "
    " AND r.tool_calls @> '[{\"kind\": \"ask_user_response\"}]'::jsonb "
    " AND r.tool_calls->0->>'tool_call_id' = m.tool_calls->0->>'tool_call_id'"
    ") ORDER BY m.created_at DESC"
)
# Supporting evidence for the resume sweep: the minted producer shell runs row
# (harness_engine._build_resume_context inserts model='unknown'/provider='unknown';
# the shell never makes an LLM call). Informational detail only — never gating.
_SQL_RESUME_SHELL = (
    "SELECT count(*) AS n FROM runs "
    "WHERE thread_id = %s AND provider = 'unknown' AND model = 'unknown'"
)


# ─────────────────────────────────────────────────────────────────────────────
# Five-piece plumbing kit — copied VERBATIM from eval_cross_provider.py
# (096-PATTERNS.md Assignment 5: copy, do not hand-roll, do not cross-import).
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
    """Print PRESENCE/ABSENCE of each env var the smoke needs — NEVER the value
    (project secrets rule + feedback_env_secrets_handling)."""
    checks = [
        ("SUPABASE_URL", False),
        ("DATABASE_URL", False),         # falls back to the local default if unset
        ("SUPABASE_ANON_KEY", True),     # used to mint the test-user bearer token
        ("REDIS_URL", False),            # optional supplementary run-buffer evidence
        ("OPENAI_API_KEY", True),
        ("ANTHROPIC_API_KEY", True),
        ("GOOGLE_API_KEY", True),
        ("OPENROUTER_API_KEY", True),
        ("ZHIPU_API_KEY", True),
        ("MINIMAX_API_KEY", True),
    ]
    print("## Environment (presence only — secret VALUES are never printed)\n")
    for name, _is_secret in checks:
        present = bool(os.getenv(name))
        # Intentionally print ONLY presence/absence — no value, no prefix, no length.
        print(f"  - {name}: {'set' if present else 'MISSING'}")
    print()


def assert_localhost_only() -> None:
    """Refuse to run unless SUPABASE_URL points at localhost / 127.0.0.1.

    Mirrors the Playwright db-teardown hard-gate: a misconfigured SUPABASE_URL
    pointing at a real project would trigger live agent runs that WRITE
    messages/workflow_runs against production data. Fail closed (T-096-07-01).
    """
    url = os.getenv("SUPABASE_URL", "")
    if not LOCALHOST_RE.search(url):
        shown = (url[:40] + "...") if url else "(unset)"
        print(
            "REFUSING TO RUN: SUPABASE_URL must contain 'localhost' or '127.0.0.1'.\n"
            f"  Got: {shown}\n"
            "  This guard prevents the restart smoke from driving live workflow runs "
            "(which WRITE messages/workflow_runs/harness_audit) against a production "
            "database. Point backend/.env at your LOCAL Supabase and retry."
        )
        sys.exit(1)


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


def kickoff_workflow(token: str, thread_id: str, prompt: str, provider: str,
                     model: str, definition_id: str) -> str:
    """POST /threads/{id}/messages with workflow_definition_id — the REAL kickoff
    route (threads.py:835 resolves+parses the published definition under the
    user's RLS; create_workflow_run sets threads.active_workflow_run_id
    atomically). Returns the producer run_id (the workflow_run id is resolved
    separately from the thread anchor)."""
    requests = _requests()
    try:
        resp = requests.post(
            f"{base_url()}/threads/{thread_id}/messages",
            headers=_auth_headers(token),
            json={
                "content": prompt,
                "provider": provider,
                "model": model,
                "workflow_definition_id": definition_id,
            },
            timeout=30,
        )
    except Exception as e:
        raise BackendUnavailable(
            f"Could not reach the backend at {base_url()} ({type(e).__name__})."
        ) from e
    if resp.status_code not in (200, 201):
        raise BackendUnavailable(
            f"workflow kickoff failed (HTTP {resp.status_code}) for {provider}/{model}. "
            "A 409 means the thread is workflow-locked (should not happen on a fresh thread)."
        )
    return resp.json()["run_id"]


# ─────────────────────────────────────────────────────────────────────────────
# DB helpers — RealDictCursor + rollback-per-poll (the wait_for_run pattern:
# fresh snapshot in a long-lived psycopg2 connection).
# ─────────────────────────────────────────────────────────────────────────────

def _fetchall(conn, sql: str, params: tuple) -> list[dict]:
    from psycopg2.extras import RealDictCursor

    conn.rollback()  # fresh snapshot per poll (psycopg2 default isolation)
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(sql, params)
        return [dict(r) for r in cur.fetchall()]


def _fetchone(conn, sql: str, params: tuple) -> dict | None:
    rows = _fetchall(conn, sql, params)
    return rows[0] if rows else None


def resolve_definition(conn, slug: str) -> tuple[str, dict]:
    """Resolve the published definition by slug (max version). Returns
    (definition_id, definition_jsonb). The definition JSONB is the runtime
    source of truth for phase slugs/types — never hardcoded."""
    row = _fetchone(conn, _SQL_DEFINITION_BY_SLUG, (slug,))
    if not row:
        print(
            f"CANNOT RUN: no published workflow_definitions row with slug '{slug}'. "
            "Apply migration 066 (eval_coverage seed) via the Supabase SQL editor first."
        )
        sys.exit(1)
    definition = row["definition"]
    if isinstance(definition, str):
        import json
        definition = json.loads(definition)
    return row["id"], definition


def find_phase_by_type(definition: dict, phase_type: str) -> dict:
    """First phase in the definition whose config.phase_type matches. The slug is
    read from the definition JSONB at runtime (plan requirement — no hardcoding)."""
    for phase in definition.get("phases", []):
        if (phase.get("config") or {}).get("phase_type") == phase_type:
            return phase
    print(
        f"CANNOT RUN: workflow '{definition.get('slug')}' has no phase of type "
        f"'{phase_type}' — pick a workflow that exercises this kill point "
        "(default eval_coverage covers all 5 phase types)."
    )
    sys.exit(1)


def resolve_workflow_run_id(conn, thread_id: str, bound_s: int = 60) -> str:
    """Poll threads.active_workflow_run_id (set atomically by create_workflow_run
    inside the kickoff POST) until non-null."""
    deadline = time.time() + bound_s
    while time.time() < deadline:
        row = _fetchone(conn, _SQL_THREAD_ANCHOR, (thread_id,))
        if row and row.get("wf_id"):
            return row["wf_id"]
        time.sleep(0.25)
    print("CANNOT RUN: threads.active_workflow_run_id never appeared after kickoff.")
    sys.exit(1)


def workflow_status(conn, workflow_run_id: str) -> str | None:
    row = _fetchone(conn, _SQL_WF_STATUS, (workflow_run_id,))
    return row["status"] if row else None


def pending_prompt_for_run(conn, thread_id: str, workflow_run_id: str) -> dict | None:
    """Newest pending (unanswered) ask_user prompt row whose payload run_id is this
    workflow run. Returns the tool_calls[0] payload dict or None."""
    for row in _fetchall(conn, _SQL_PENDING_PROMPTS, (thread_id,)):
        tcs = row.get("tool_calls") or []
        payload = tcs[0] if tcs and isinstance(tcs[0], dict) else {}
        if str(payload.get("run_id")) == str(workflow_run_id):
            return payload
    return None


# ─────────────────────────────────────────────────────────────────────────────
# Health polling — the kill/restart detector. GET /health (main.py:343).
# The script only OBSERVES the backend process state; the operator drives it.
# ─────────────────────────────────────────────────────────────────────────────

def _health_ok() -> bool:
    requests = _requests()
    try:
        return requests.get(f"{base_url()}/health", timeout=3).status_code == 200
    except Exception:
        return False


def wait_for_backend_down(conn, workflow_run_id: str, bound_s: int = WAIT_BOUND_S) -> bool:
    """Poll GET /health until it stops answering (the operator killed uvicorn).

    Also watches the workflow status: if the run reaches terminal before the kill
    lands, the kill window was missed — diagnostic exit (re-run the leg)."""
    deadline = time.time() + bound_s
    while time.time() < deadline:
        if not _health_ok():
            print("SMOKE_DOWN detected — backend is down (operator kill confirmed)")
            return True
        status = workflow_status(conn, workflow_run_id)
        if status in _TERMINAL_WORKFLOW_STATES:
            print(
                f"DIAGNOSTIC: workflow reached terminal status '{status}' before the "
                "kill landed — the kill window was missed. Re-run this leg."
            )
            return False
        time.sleep(HEALTH_POLL_INTERVAL_S)
    print(f"DIAGNOSTIC: backend never went down within {bound_s}s — no kill detected.")
    return False


def wait_for_backend_up(bound_s: int = WAIT_BOUND_S) -> bool:
    """Poll GET /health until it answers again (the operator restarted uvicorn)."""
    deadline = time.time() + bound_s
    while time.time() < deadline:
        if _health_ok():
            print(
                "SMOKE_UP detected — backend restarted. The startup sweep "
                "(resume_stranded_workflows) runs on boot and re-claims the stranded run."
            )
            return True
        time.sleep(HEALTH_POLL_INTERVAL_S)
    print(f"DIAGNOSTIC: backend never came back within {bound_s}s.")
    return False


def wait_for_workflow_terminal(conn, workflow_run_id: str, timeout_s: int) -> str:
    """Poll workflow_runs.status until terminal (completed/failed/cancelled)."""
    deadline = time.time() + timeout_s
    last = "unknown"
    while time.time() < deadline:
        status = workflow_status(conn, workflow_run_id)
        if status:
            last = status
            if status in _TERMINAL_WORKFLOW_STATES:
                return status
        time.sleep(1.0)
    return f"timeout (last={last})"


# ─────────────────────────────────────────────────────────────────────────────
# Assertions — each printed as `SMOKE_ASSERT <name> PASS|FAIL <detail>` (greppable).
# ─────────────────────────────────────────────────────────────────────────────

def _print_assert(name: str, ok: bool, detail: str) -> bool:
    print(f"SMOKE_ASSERT {name} {'PASS' if ok else 'FAIL'} {detail}")
    return ok


def assert_no_skipped_phases(conn, workflow_run_id: str) -> bool:
    """Every workflow_phases row reached 'completed' — none skipped, none stuck."""
    rows = _fetchall(conn, _SQL_PHASES, (workflow_run_id,))
    if not rows:
        return _print_assert("no_skipped_phases", False, "no workflow_phases rows found")
    statuses = {r["slug"]: r["status"] for r in rows}
    ok = all(s == "completed" for s in statuses.values())
    detail = ", ".join(f"{slug}={st}" for slug, st in statuses.items())
    return _print_assert("no_skipped_phases", ok, detail)


def assert_single_completion_audit(conn, workflow_run_id: str) -> bool:
    """The HAVING count(*)>1 detector returns ZERO rows — no phase completed twice
    (harness_audit is INSERT-only, so double side effects cannot hide)."""
    rows = _fetchall(conn, _SQL_DOUBLE_COMPLETION, (workflow_run_id,))
    ok = len(rows) == 0
    detail = (
        "zero double-completion rows"
        if ok
        else "; ".join(f"phase '{r['slug']}' completed {r['n']}x" for r in rows)
    )
    return _print_assert("single_completion_audit", ok, detail)


def assert_no_duplicate_subagents(conn, workflow_run_id: str, definition: dict) -> bool:
    """Batch-phase sub-agent runs count == number of sub_questions (no double
    fan-out). Durable truth: the programmatic phase's output.sub_questions vs the
    llm_batch_agents phase's output.sub_run_ids (written once at phase completion)."""
    split_phase = None
    batch_phase = None
    for phase in definition.get("phases", []):
        ptype = (phase.get("config") or {}).get("phase_type")
        if ptype == "programmatic" and split_phase is None:
            split_phase = phase
        if ptype == "llm_batch_agents" and batch_phase is None:
            batch_phase = phase
    if split_phase is None or batch_phase is None:
        return _print_assert(
            "no_duplicate_subagents", False,
            "definition lacks a programmatic and/or llm_batch_agents phase",
        )

    rows = _fetchall(conn, _SQL_PHASES, (workflow_run_id,))
    outputs = {r["slug"]: (r.get("output") or {}) for r in rows}
    split_out = outputs.get(split_phase.get("slug"), {})
    batch_out = outputs.get(batch_phase.get("slug"), {})
    if isinstance(split_out, str):
        import json
        split_out = json.loads(split_out)
    if isinstance(batch_out, str):
        import json
        batch_out = json.loads(batch_out)

    sub_questions = split_out.get("sub_questions") or []
    sub_run_ids = batch_out.get("sub_run_ids") or []
    distinct = len(set(sub_run_ids)) == len(sub_run_ids)
    ok = bool(sub_questions) and len(sub_run_ids) == len(sub_questions) and distinct
    detail = (
        f"sub_questions={len(sub_questions)} sub_run_ids={len(sub_run_ids)} "
        f"distinct={'yes' if distinct else 'NO'}"
    )
    return _print_assert("no_duplicate_subagents", ok, detail)


def assert_prompt_reemitted(conn, token: str, thread_id: str,
                            workflow_run_id: str, bound_s: int = 300) -> dict | None:
    """ask_user leg only — post-restart, the pending prompt must be SERVED again.

    Two-part evidence, both post-restart:
      1. GET /threads/{tid}/ask_user/pending (panel.py — runs the D-06 liveness
         filter) returns a prompt whose run_id is this workflow run. A resumed run
         is non-terminal AND still the thread anchor, so the filter passes — a dead
         run's prompt would be filtered out. This is the prompt-re-render surface
         BUG-260605-01 broke.
      2. The durable prompt row has NO matching ask_user_response (DB containment).

    Supporting (informational) evidence: the resume sweep mints a producer shell
    runs row with model/provider='unknown' (harness_engine._build_resume_context).

    Returns the prompt payload dict (with tool_call_id) on PASS, None on FAIL.
    """
    requests = _requests()
    deadline = time.time() + bound_s
    served = None
    while time.time() < deadline:
        try:
            resp = requests.get(
                f"{base_url()}/threads/{thread_id}/ask_user/pending",
                headers=_auth_headers(token),
                timeout=10,
            )
            if resp.status_code == 200:
                for entry in resp.json():
                    if str(entry.get("run_id")) == str(workflow_run_id):
                        served = entry
                        break
        except Exception:
            pass  # backend may still be warming — keep polling
        if served:
            break
        time.sleep(1.0)

    if not served:
        _print_assert(
            "prompt_reemitted", False,
            f"/ask_user/pending never served the prompt for run {workflow_run_id} "
            f"within {bound_s}s post-restart",
        )
        return None

    # The durable row must still be unanswered at serve time.
    payload = pending_prompt_for_run(conn, thread_id, workflow_run_id)
    unanswered = payload is not None
    shell = _fetchone(conn, _SQL_RESUME_SHELL, (thread_id,))
    shell_n = int(shell["n"]) if shell else 0
    ok = unanswered and bool(served.get("tool_call_id"))
    _print_assert(
        "prompt_reemitted", ok,
        f"served post-restart (tool_call_id={served.get('tool_call_id')}), "
        f"unanswered={'yes' if unanswered else 'NO'}, "
        f"resume_shell_runs={shell_n} (informational)",
    )
    return served if ok else None


def post_ask_user_answer(token: str, workflow_run_id: str, tool_call_id: str) -> bool:
    """POST the answer via /runs/{workflow_run_id}/ask_user_response — the F10
    workflow_run-id fallback (runs.py:521-567, owner-scoped + thread-anchor
    confirm) resolves it. This POST reaching the resumed engine and completing the
    run IS the BUG-260605-01 live fix verification."""
    requests = _requests()
    try:
        resp = requests.post(
            f"{base_url()}/runs/{workflow_run_id}/ask_user_response",
            headers=_auth_headers(token),
            json={
                "tool_call_id": tool_call_id,
                "response_text": "Approve",
                "choice_index": 0,
            },
            timeout=15,
        )
    except Exception as e:
        print(f"  answer POST failed to send: {type(e).__name__}")
        return False
    if resp.status_code != 200:
        print(f"  answer POST returned HTTP {resp.status_code} (expected 200)")
        return False
    return True


# ─────────────────────────────────────────────────────────────────────────────
# Entry point — seed, banner, observe kill/restart, assert DB truth.
# ─────────────────────────────────────────────────────────────────────────────

def _parse_args(argv: list[str] | None):
    parser = argparse.ArgumentParser(
        prog="restart_smoke.py",
        description=(
            "Operator-driven restart smoke (Phase 096 D-08). Seeds an eval_coverage "
            "workflow run, prints a KILL-NOW banner exactly when the --kill-at target "
            "phase is active, detects the operator's uvicorn kill+restart via GET "
            "/health, then asserts DB truth: no skipped phases, no double-applied "
            "side effects, no duplicate sub-agent fan-out — and for --kill-at "
            "ask_user, that the prompt is re-emitted post-restart and the answer "
            "POST completes the run (the BUG-260605-01 live verification). THE HUMAN "
            "IS THE RESTART MECHANISM — this script never touches the backend "
            "process. Localhost only (hard-gated)."
        ),
    )
    parser.add_argument(
        "--kill-at",
        required=True,
        choices=["programmatic", "llm_agent", "ask_user"],
        help=(
            "Which phase type to kill the backend inside: programmatic "
            "(eval_slow_step's ~20s window), llm_agent (mid streaming sub-agent), "
            "or ask_user (llm_human_input with a pending prompt)."
        ),
    )
    parser.add_argument(
        "--provider",
        default="openai",
        choices=sorted(DEFAULT_MODELS),
        help="Provider for the kickoff (default: openai).",
    )
    parser.add_argument(
        "--model",
        help="Override the representative model for the selected --provider.",
    )
    parser.add_argument(
        "--workflow-slug",
        default="eval_coverage",
        help=(
            "Workflow definition slug to seed (default: eval_coverage — the 5-type "
            "coverage seed from migration 066 with the eval_slow_step kill window)."
        ),
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    load_env()
    # HARD-GATE first — before any DB connection or HTTP call (T-096-07-01).
    assert_localhost_only()
    report_env_presence()

    kill_at = args.kill_at
    model = args.model or DEFAULT_MODELS[args.provider]
    run_timeout_s = int(os.getenv("SMOKE_RUN_TIMEOUT_S", DEFAULT_RUN_TIMEOUT_S))

    print(
        f"Restart smoke: kill-at={kill_at} workflow={args.workflow_slug} "
        f"provider={args.provider}/{model} against {base_url()}\n"
        "The HUMAN restarts the backend — this script only seeds, signals, and asserts.\n"
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

    try:
        # ── Seed ────────────────────────────────────────────────────────────
        definition_id, definition = resolve_definition(conn, args.workflow_slug)
        target_phase = find_phase_by_type(definition, KILL_AT_PHASE_TYPE[kill_at])
        target_slug = target_phase.get("slug")
        print(f"Target phase for kill-at={kill_at}: '{target_slug}' "
              f"(resolved from the definition JSONB at runtime)\n")

        thread_id = create_thread(token, f"restart-smoke {kill_at}")
        kickoff_workflow(
            token, thread_id, KICKOFF_PROMPT, args.provider, model, definition_id
        )
        workflow_run_id = resolve_workflow_run_id(conn, thread_id)
        print(f"Seeded: thread={thread_id} workflow_run={workflow_run_id}\n"
              f"Watching workflow_phases every {PHASE_POLL_INTERVAL_S}s for "
              f"'{target_slug}' to go active...\n")

        # ── Phase watch → KILL banner ──────────────────────────────────────
        deadline = time.time() + WAIT_BOUND_S
        banner_printed = False
        while time.time() < deadline:
            status = workflow_status(conn, workflow_run_id)
            if status in _TERMINAL_WORKFLOW_STATES:
                print(
                    f"DIAGNOSTIC: workflow reached terminal '{status}' before phase "
                    f"'{target_slug}' went active — cannot land this kill point."
                )
                print(f"SMOKE_RESULT {kill_at} FAIL (kill window never opened)")
                return 1
            rows = _fetchall(conn, _SQL_PHASES, (workflow_run_id,))
            target_row = next((r for r in rows if r["slug"] == target_slug), None)
            if target_row and target_row["status"] == "active":
                if kill_at == "ask_user":
                    # The kill must land with a PENDING prompt — wait for the durable
                    # prompt row (JSONB containment, no matching response) too.
                    if pending_prompt_for_run(conn, thread_id, workflow_run_id) is None:
                        time.sleep(PHASE_POLL_INTERVAL_S)
                        continue
                print(
                    f"SMOKE_KILL >>> PHASE '{target_slug}' IS NOW ACTIVE — KILL THE "
                    "BACKEND NOW (Ctrl+C in the uvicorn terminal) <<<"
                )
                banner_printed = True
                break
            if target_row and target_row["status"] == "completed":
                print(
                    f"DIAGNOSTIC: phase '{target_slug}' already completed before a "
                    "kill window opened (polling missed it). Re-run this leg."
                )
                print(f"SMOKE_RESULT {kill_at} FAIL (kill window missed)")
                return 1
            time.sleep(PHASE_POLL_INTERVAL_S)
        if not banner_printed:
            print(f"DIAGNOSTIC: phase '{target_slug}' never went active within "
                  f"{WAIT_BOUND_S}s.")
            print(f"SMOKE_RESULT {kill_at} FAIL (kill window never opened)")
            return 1

        # ── Observe the operator's kill + restart ──────────────────────────
        if not wait_for_backend_down(conn, workflow_run_id):
            print(f"SMOKE_RESULT {kill_at} FAIL (kill not detected)")
            return 1
        if not wait_for_backend_up():
            print(f"SMOKE_RESULT {kill_at} FAIL (restart not detected)")
            return 1

        # ── Post-restart: ask_user leg answers the re-emitted prompt FIRST ─
        results: list[bool] = []
        if kill_at == "ask_user":
            served = assert_prompt_reemitted(conn, token, thread_id, workflow_run_id)
            results.append(served is not None)
            if served is not None:
                answered = post_ask_user_answer(
                    token, workflow_run_id, served["tool_call_id"]
                )
                if not answered:
                    results.append(_print_assert(
                        "answer_reached_engine", False, "answer POST did not return 200"
                    ))
                else:
                    final = wait_for_workflow_terminal(conn, workflow_run_id, run_timeout_s)
                    results.append(_print_assert(
                        "answer_reached_engine", final == "completed",
                        f"workflow_runs.status={final} after the answer POST",
                    ))
            else:
                results.append(_print_assert(
                    "answer_reached_engine", False,
                    "skipped — prompt was never re-emitted",
                ))
        else:
            final = wait_for_workflow_terminal(conn, workflow_run_id, run_timeout_s)
            print(f"Workflow terminal: {final}\n")
            if final != "completed":
                results.append(_print_assert(
                    "run_completed", False, f"workflow_runs.status={final}"
                ))

        # ── DB-truth assertions (all legs) ─────────────────────────────────
        results.append(assert_no_skipped_phases(conn, workflow_run_id))
        results.append(assert_single_completion_audit(conn, workflow_run_id))
        results.append(assert_no_duplicate_subagents(conn, workflow_run_id, definition))

        ok = all(results)
        print(f"\nSMOKE_RESULT {kill_at} {'PASS' if ok else 'FAIL'}")
        return 0 if ok else 2
    except BackendUnavailable as e:
        print(f"\nCANNOT CONTINUE: {e}")
        print(f"SMOKE_RESULT {kill_at} FAIL (backend unavailable)")
        return 1
    finally:
        try:
            conn.close()
        except Exception:
            pass


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
