"""
conc_probe.py — Phase 096 (CONC-01 / SC#3) fan-out overlap + latency + backpressure probe.

One command drives an N=10 fan-out through the seeded `literature_review` workflow
(programmatic split -> llm_batch_agents -> llm_single — no human input, the
canonical fan-out target) and proves three things with greppable evidence:

  1. fanout_bounded     : the 091 semaphore is LIVE — max pairwise overlap of the
                          batch phase's sub-agent runs' (started_at, completed_at)
                          windows is <= 5 (Semaphore(max_parallel_agents),
                          phase_types.py:347) AND total sub-runs == 10
                          (split_topic has no N cap — 10 semicolon clauses ->
                          10 branches, programmatic.py:97-114).
  2. cross_tab_latency  : while the fan-out is streaming, an IDLE second thread
                          stays responsive — p95 wall-clock of GET
                          /threads/{idle}/snapshot AND GET /threads (the list
                          endpoint exercises the supabase-py threadpool path;
                          /snapshot of an idle thread short-circuits before Redis
                          at threads.py:418-423, so BOTH endpoints are needed for
                          a representative reading) is < 50ms.
  3. anyio_budget       : the live AnyIO threadpool budget reading —
                          `PROBE_BUDGET total=<n> peak_borrowed=<n>` from
                          GET /admin/backpressure's anyio_threadpool_depth
                          (admin.py:52-99; expected AnyIO default total=40). This
                          documented reading IS the SC#3 "verified before sizing
                          defaults" deliverable.

ANTI-PATTERN GUARD: this is a DIRECT HTTP client, never a browser — measuring
cross-tab latency from a browser conflates the browser's 6-connection cap (the
thing the stream pool fixes) with backend starvation.

WORKER_COUNT=2 note: the probe records `per_worker_run_count` alongside every
backpressure sample — the probe requests and the workflow may land on DIFFERENT
workers, so readings are only interpretable with the per-worker count attached.

Plumbing is the eval_cross_provider.py five-piece kit, copied verbatim
(096-PATTERNS.md Assignment 6): load_env -> assert_localhost_only FIRST ->
report_env_presence (presence-only, never values) -> get_bearer_token ->
connect_db. Constant-string allowlisted SQL, %s params only (T-096-07-04).
LOCALHOST HARD-GATE (T-096-07-01).

Usage
-----
  # Operator starts the backend uvicorn in a visible terminal first, then:
  backend/venv/Scripts/python.exe scripts/conc_probe.py
  backend/venv/Scripts/python.exe scripts/conc_probe.py --provider anthropic
  backend/venv/Scripts/python.exe scripts/conc_probe.py --help

Greppable markers: PROBE_ASSERT / PROBE_BUDGET / PROBE_PEAKS / PROBE_RESULT.
"""
from __future__ import annotations

import argparse
import os
import re
import sys
import threading
import time
from datetime import datetime, timezone
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
# the probe measures concurrency, not model quality; --model overrides).
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

# EXACTLY 10 semicolon-separated sub-topics (9 ';') — split_topic has no cap, so
# 10 clauses -> N=10 branches into Semaphore(max_parallel_agents=5). Clauses avoid
# ' and ' / ' vs ' / newlines / commas so the clause-split regex yields exactly 10.
KICKOFF_PROMPT_10 = (
    "renewable energy storage; "
    "solar panel efficiency; "
    "wind turbine maintenance; "
    "battery recycling methods; "
    "grid load balancing; "
    "hydrogen fuel production; "
    "geothermal heating systems; "
    "tidal power generation; "
    "biomass conversion techniques; "
    "carbon capture technology"
)
EXPECTED_FANOUT = 10
MAX_ALLOWED_OVERLAP = 5            # Semaphore(max_parallel_agents) default — phase_types.py:347
LATENCY_P95_BUDGET_MS = 50.0       # SC#3 cross-tab GET p95 budget

BACKPRESSURE_INTERVAL_S = 1.0      # GET /admin/backpressure cadence
LATENCY_INTERVAL_S = 0.5           # idle-thread GET cadence (separate thread)
DEFAULT_RUN_TIMEOUT_S = 900        # fan-out wall-clock bound (override: CONC_RUN_TIMEOUT_S)

# Terminal workflow_runs statuses (threads.py:815 _TERMINAL_WORKFLOW + the
# workflow_runs_status_check CHECK constraint).
_TERMINAL_WORKFLOW_STATES = frozenset({"completed", "failed", "cancelled"})

LOCALHOST_RE = re.compile(r"(localhost|127\.0\.0\.1)")

# ─────────────────────────────────────────────────────────────────────────────
# Allowlisted constant SQL (T-096-07-04): FULL constant query strings — nothing is
# ever interpolated into SQL; the only dynamic values are parameterized %s values.
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
# Sub-agent run windows for the overlap analysis — the only dynamic value is the
# parameterized uuid[] list of sub_run_ids read from the batch phase's output.
_SQL_SUB_RUN_WINDOWS = (
    "SELECT run_id::text AS run_id, started_at, completed_at "
    "FROM runs WHERE run_id = ANY(%s::uuid[])"
)


# ─────────────────────────────────────────────────────────────────────────────
# Five-piece plumbing kit — copied VERBATIM from eval_cross_provider.py
# (096-PATTERNS.md Assignment 6: copy, do not hand-roll, do not cross-import).
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
    """Print PRESENCE/ABSENCE of each env var the probe needs — NEVER the value
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
    pointing at a real project would trigger live workflow runs that WRITE
    messages/workflow_runs against production data. Fail closed (T-096-07-01).
    """
    url = os.getenv("SUPABASE_URL", "")
    if not LOCALHOST_RE.search(url):
        shown = (url[:40] + "...") if url else "(unset)"
        print(
            "REFUSING TO RUN: SUPABASE_URL must contain 'localhost' or '127.0.0.1'.\n"
            f"  Got: {shown}\n"
            "  This guard prevents the concurrency probe from driving a live N=10 "
            "fan-out (which WRITES messages/workflow_runs/runs) against a "
            "production database. Point backend/.env at your LOCAL Supabase and retry."
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
    route (threads.py:835; create_workflow_run sets threads.active_workflow_run_id
    atomically). Returns the producer run_id."""
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
            f"workflow kickoff failed (HTTP {resp.status_code}) for {provider}/{model}."
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
    (definition_id, definition_jsonb)."""
    row = _fetchone(conn, _SQL_DEFINITION_BY_SLUG, (slug,))
    if not row:
        print(
            f"CANNOT RUN: no published workflow_definitions row with slug '{slug}'. "
            "The literature_review seed ships in migration 061 (fixed by 065)."
        )
        sys.exit(1)
    definition = row["definition"]
    if isinstance(definition, str):
        import json
        definition = json.loads(definition)
    return row["id"], definition


def find_batch_phase(definition: dict) -> dict:
    """First llm_batch_agents phase — the fan-out under measurement."""
    for phase in definition.get("phases", []):
        if (phase.get("config") or {}).get("phase_type") == "llm_batch_agents":
            return phase
    print(
        f"CANNOT RUN: workflow '{definition.get('slug')}' has no llm_batch_agents "
        "phase — the probe needs a fan-out target (default literature_review)."
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


# ─────────────────────────────────────────────────────────────────────────────
# Latency sampler — separate threading.Thread probing the IDLE thread every
# ~500ms while the fan-out streams. DIRECT HTTP client (anti-pattern guard:
# never a browser — the 6-connection cap would pollute the reading). Times TWO
# endpoints because /snapshot of an idle thread short-circuits before Redis
# (threads.py:418-423) while GET /threads (the list endpoint) exercises the
# supabase-py run_in_threadpool path — both are needed to be representative.
# ─────────────────────────────────────────────────────────────────────────────

class LatencySampler(threading.Thread):
    def __init__(self, token: str, idle_thread_id: str):
        super().__init__(daemon=True)
        self._token = token
        self._idle_thread_id = idle_thread_id
        self.stop_event = threading.Event()
        # endpoint label -> list of wall-clock ms for HTTP-200 samples
        self.samples: dict[str, list[float]] = {"snapshot": [], "list": []}
        self.errors: dict[str, int] = {"snapshot": 0, "list": 0}

    def run(self) -> None:
        requests = _requests()
        session = requests.Session()  # keep-alive — comparable to a live app client
        # GET /threads/{idle}/snapshot (idle short-circuit path) +
        # GET /threads (list — supabase-py threadpool path).
        targets = [
            ("snapshot", f"{base_url()}/threads/{self._idle_thread_id}/snapshot"),
            ("list", f"{base_url()}/threads"),
        ]
        headers = _auth_headers(self._token)
        while not self.stop_event.is_set():
            for label, url in targets:
                t0 = time.perf_counter()
                try:
                    resp = session.get(url, headers=headers, timeout=10)
                    elapsed_ms = (time.perf_counter() - t0) * 1000.0
                    if resp.status_code == 200:
                        self.samples[label].append(elapsed_ms)
                    else:
                        self.errors[label] += 1
                except Exception:
                    self.errors[label] += 1
            self.stop_event.wait(LATENCY_INTERVAL_S)
        session.close()


def percentile(values: list[float], q: float) -> float:
    """Nearest-rank percentile (no numpy dependency in the script)."""
    if not values:
        return float("nan")
    ordered = sorted(values)
    import math
    idx = max(0, math.ceil((q / 100.0) * len(ordered)) - 1)
    return ordered[idx]


# ─────────────────────────────────────────────────────────────────────────────
# Backpressure sampling — GET /admin/backpressure (admin.py:52-99; dev/local
# fail-open for any authenticated user). Records the FULL signal set per sample:
# anyio_threadpool_depth.{borrowed,total}, redis_active_runs,
# postgres_pool_in_use, per_worker_run_count (WORKER_COUNT=2 — the probe and the
# workflow may land on different workers; per_worker makes readings interpretable).
# ─────────────────────────────────────────────────────────────────────────────

def sample_backpressure(session, token: str) -> dict | None:
    try:
        resp = session.get(
            f"{base_url()}/admin/backpressure",
            headers=_auth_headers(token),
            timeout=10,
        )
        if resp.status_code != 200:
            return None
        bp = resp.json()
        depth = bp.get("anyio_threadpool_depth") or {}
        return {
            "borrowed": int(depth.get("borrowed", 0)),
            "total": int(depth.get("total", 0)),
            "redis_active_runs": int(bp.get("redis_active_runs", 0)),
            "postgres_pool_in_use": int(bp.get("postgres_pool_in_use", 0)),
            "per_worker_run_count": int(bp.get("per_worker_run_count", 0)),
        }
    except Exception:
        return None


# ─────────────────────────────────────────────────────────────────────────────
# Overlap analysis — sweep-line over sorted start/end events of the sub-agent
# runs' (started_at, completed_at) windows. Window truth: the runs row is
# INSERTed AFTER the branch acquires the Semaphore slot (phase_types.py:355-373
# `async with sem:` wraps run_task_sub_agent entirely), so windows reflect
# actual concurrency, not queue membership.
# ─────────────────────────────────────────────────────────────────────────────

def max_pairwise_overlap(windows: list[tuple]) -> int:
    """Max number of simultaneously-open (start, end) windows.

    Ends sort BEFORE starts at the same instant (delta -1 < +1): a semaphore
    release+acquire at the same timestamp is sequential, never concurrent."""
    events: list[tuple] = []
    for start, end in windows:
        events.append((start, 1))
        events.append((end, -1))
    events.sort(key=lambda e: (e[0], e[1]))
    current = peak = 0
    for _, delta in events:
        current += delta
        peak = max(peak, current)
    return peak


def fetch_sub_run_windows(conn, workflow_run_id: str, batch_slug: str) -> list[tuple]:
    """(started_at, completed_at) per sub-agent run of the batch phase — ids read
    from the durable workflow_phases.output.sub_run_ids (written once at phase
    completion). A NULL completed_at (defensive) is treated as open-until-now."""
    rows = _fetchall(conn, _SQL_PHASES, (workflow_run_id,))
    batch_out = next((r.get("output") or {} for r in rows if r["slug"] == batch_slug), {})
    if isinstance(batch_out, str):
        import json
        batch_out = json.loads(batch_out)
    sub_run_ids = [str(x) for x in (batch_out.get("sub_run_ids") or [])]
    if not sub_run_ids:
        return []
    windows = []
    now = datetime.now(timezone.utc)
    for r in _fetchall(conn, _SQL_SUB_RUN_WINDOWS, (sub_run_ids,)):
        start = r["started_at"]
        end = r["completed_at"] or now
        windows.append((start, end))
    return windows


# ─────────────────────────────────────────────────────────────────────────────
# Greppable output — PROBE_ASSERT / PROBE_BUDGET / PROBE_PEAKS / PROBE_RESULT.
# ─────────────────────────────────────────────────────────────────────────────

def _print_assert(name: str, ok: bool, detail: str) -> bool:
    print(f"PROBE_ASSERT {name} {'PASS' if ok else 'FAIL'} {detail}")
    return ok


# ─────────────────────────────────────────────────────────────────────────────
# Entry point.
# ─────────────────────────────────────────────────────────────────────────────

def _parse_args(argv: list[str] | None):
    parser = argparse.ArgumentParser(
        prog="conc_probe.py",
        description=(
            "Fan-out overlap + cross-tab latency + AnyIO backpressure probe "
            "(Phase 096 CONC-01 / SC#3). Drives an N=10 fan-out through the "
            "literature_review seed workflow and proves: <=5 concurrent sub-agents "
            "(DB interval-overlap), idle-thread GET p95 < 50ms (direct HTTP client, "
            "never a browser), and the live AnyIO threadpool budget reading. "
            "Operator must start the backend uvicorn first; runs against LOCALHOST "
            "only (hard-gated)."
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
        default="literature_review",
        help=(
            "Workflow definition slug to drive (default: literature_review — "
            "programmatic split -> llm_batch_agents -> llm_single, no human input; "
            "the canonical fan-out target)."
        ),
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    load_env()
    # HARD-GATE first — before any DB connection or HTTP call (T-096-07-01).
    assert_localhost_only()
    report_env_presence()

    # Defensive self-check on the constant: exactly 10 clauses (9 ';').
    if KICKOFF_PROMPT_10.count(";") != EXPECTED_FANOUT - 1:
        print("INTERNAL ERROR: KICKOFF_PROMPT_10 must contain exactly 10 clauses.")
        return 1

    model = args.model or DEFAULT_MODELS[args.provider]
    run_timeout_s = int(os.getenv("CONC_RUN_TIMEOUT_S", DEFAULT_RUN_TIMEOUT_S))

    print(
        f"Concurrency probe: workflow={args.workflow_slug} N={EXPECTED_FANOUT} "
        f"provider={args.provider}/{model} against {base_url()} "
        f"(run timeout {run_timeout_s}s).\n"
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

    sampler = None
    try:
        definition_id, definition = resolve_definition(conn, args.workflow_slug)
        batch_phase = find_batch_phase(definition)
        batch_slug = batch_phase.get("slug")
        max_parallel = (batch_phase.get("config") or {}).get("max_parallel_agents", 5)
        print(f"Fan-out phase: '{batch_slug}' (max_parallel_agents={max_parallel})\n")

        # IDLE second thread FIRST — the cross-tab probe target.
        idle_thread_id = create_thread(token, "conc-probe idle target")
        run_thread_id = create_thread(token, "conc-probe fan-out")
        kickoff_workflow(
            token, run_thread_id, KICKOFF_PROMPT_10, args.provider, model, definition_id
        )
        workflow_run_id = resolve_workflow_run_id(conn, run_thread_id)
        print(f"Seeded: run_thread={run_thread_id} idle_thread={idle_thread_id} "
              f"workflow_run={workflow_run_id}\n")

        # Start the cross-tab latency sampler (separate thread, ~500ms cadence).
        sampler = LatencySampler(token, idle_thread_id)
        sampler.start()

        # Main loop: sample /admin/backpressure every ~1s until workflow terminal.
        requests = _requests()
        bp_session = requests.Session()
        bp_samples: list[dict] = []
        bp_errors = 0
        deadline = time.time() + run_timeout_s
        final_status = "timeout"
        while time.time() < deadline:
            sample = sample_backpressure(bp_session, token)
            if sample is not None:
                bp_samples.append(sample)
            else:
                bp_errors += 1
            status = workflow_status(conn, workflow_run_id)
            if status in _TERMINAL_WORKFLOW_STATES:
                final_status = status
                break
            time.sleep(BACKPRESSURE_INTERVAL_S)
        bp_session.close()

        sampler.stop_event.set()
        sampler.join(timeout=10)

        print(f"Workflow terminal: {final_status} "
              f"({len(bp_samples)} backpressure samples, {bp_errors} sample errors)\n")

        results: list[bool] = []

        # ── 1. fanout_bounded — DB interval-overlap analysis ────────────────
        windows = fetch_sub_run_windows(conn, workflow_run_id, batch_slug)
        if not windows:
            results.append(_print_assert(
                "fanout_bounded", False,
                f"no sub-agent run windows found for phase '{batch_slug}' "
                f"(workflow terminal={final_status})",
            ))
        else:
            overlap = max_pairwise_overlap(windows)
            ok = overlap <= MAX_ALLOWED_OVERLAP and len(windows) == EXPECTED_FANOUT
            results.append(_print_assert(
                "fanout_bounded", ok,
                f"sub_runs={len(windows)} (expected {EXPECTED_FANOUT}) "
                f"max_overlap={overlap} (allowed <= {MAX_ALLOWED_OVERLAP})",
            ))

        # ── 2. cross_tab_latency — p50/p95/max per probed endpoint ─────────
        lat_ok = True
        details = []
        for label in ("snapshot", "list"):
            vals = sampler.samples[label]
            errs = sampler.errors[label]
            if not vals:
                lat_ok = False
                details.append(f"{label}: NO 200 samples ({errs} errors)")
                continue
            p50 = percentile(vals, 50)
            p95 = percentile(vals, 95)
            mx = max(vals)
            if p95 >= LATENCY_P95_BUDGET_MS:
                lat_ok = False
            details.append(
                f"{label}: n={len(vals)} p50={p50:.1f}ms p95={p95:.1f}ms "
                f"max={mx:.1f}ms errors={errs}"
            )
        results.append(_print_assert(
            "cross_tab_latency", lat_ok,
            f"budget p95<{LATENCY_P95_BUDGET_MS:.0f}ms — " + " | ".join(details),
        ))

        # ── 3. anyio_budget — the SC#3 documented reading (informational) ──
        if bp_samples:
            total = max(s["total"] for s in bp_samples)
            peak_borrowed = max(s["borrowed"] for s in bp_samples)
            print(f"PROBE_BUDGET total={total} peak_borrowed={peak_borrowed} "
                  "(anyio_threadpool_depth — expected AnyIO default total=40)")
            print(
                "PROBE_PEAKS "
                f"redis_active_runs={max(s['redis_active_runs'] for s in bp_samples)} "
                f"postgres_pool_in_use={max(s['postgres_pool_in_use'] for s in bp_samples)} "
                f"per_worker_run_count={max(s['per_worker_run_count'] for s in bp_samples)} "
                "(per-worker — WORKER_COUNT=2; probe and workflow may land on "
                "different workers)"
            )
        else:
            print("PROBE_BUDGET total=? peak_borrowed=? "
                  "(no /admin/backpressure samples — endpoint unreachable?)")

        ok = all(results)
        print(f"\nPROBE_RESULT {'PASS' if ok else 'FAIL'}")
        return 0 if ok else 2
    except BackendUnavailable as e:
        print(f"\nCANNOT CONTINUE: {e}")
        print("PROBE_RESULT FAIL (backend unavailable)")
        return 1
    finally:
        if sampler is not None:
            sampler.stop_event.set()
        try:
            conn.close()
        except Exception:
            pass


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
