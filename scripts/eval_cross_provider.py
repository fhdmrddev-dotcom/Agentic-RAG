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

Operator live-gate ritual (Phase 096 / D-01 part 2)
---------------------------------------------------
MANDATORY GATE for phase closure on any provider-touching phase (same standing
as the 4-axis UAT recipe): run `--workflow` against the native-7, grep-diff
`EVAL_ROW` lines vs the prior capability table, attach the scoreboard to the
phase's VALIDATION evidence. Localhost-only by design; provider keys never
leave backend/.env; no CI secrets (D-01). CI proves structure with a fake
gateway — ONLY the operator's live eval proves providers. Each full
`--workflow` run persists the versioned D-04 capability table (JSON + Markdown)
under `.planning/eval/` — see `.planning/eval/README.md` for the artifact
format and the grep ritual.

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
  backend/venv/Scripts/python.exe scripts/eval_cross_provider.py --workflow              # EVAL-01: eval_coverage per provider
  backend/venv/Scripts/python.exe scripts/eval_cross_provider.py --workflow --provider openai
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
    ("anthropic", "claude-haiku-4-5-20251001"),  # dated ID — undated alias not served by live /models (096 D-05 curation 2026-06-07)
    ("google", "gemini-3.5-flash"),   # 3.x+ — NOT gemini-2.5 (D-03)
    ("openrouter", "z-ai/glm-5.1"),
    ("deepseek", "deepseek-v4-flash"),   # native weak-model — SEED-034 fold-gate target
    ("moonshot", "kimi-k2.6"),           # native weak-model — SEED-034 fold-gate target
    # --- ADD (Phase 089 D-089-09 — native-7 baseline; _PROVIDER_BASE_URLS source of truth;
    #     provider-class representatives, full pinning pass is Phase 096 EVAL-01) ---
    ("zhipu", "glm-5.1"),                # GLM int'l z.ai latest flagship from live /models (096 D-05 curation 2026-06-07 — supersedes glm-4.6)
    ("minimax", "MiniMax-M2.7-highspeed"),  # MiniMax int'l fast flagship tier, PascalCase (096 D-05 curation 2026-06-07 — supersedes M2.5-highspeed)
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
# Workflow row type configuration — Phase 096 / EVAL-01 (D-02, D-02a, D-03, D-04).
# `--workflow` drives the eval_coverage 5-phase-type workflow end-to-end per
# provider via the REAL kickoff route (POST /threads/{id}/messages +
# workflow_definition_id — threads.py:835), polls DB truth, robot-answers the
# llm_human_input prompt (D-02a — the round-trip that broke twice: F10,
# BUG-260605-01), and asserts the locked phase sequence + tool round-trips.
# ─────────────────────────────────────────────────────────────────────────────

# Resolved at runtime by SLUG — NEVER hardcode the seed uuid (migration 066's
# fixed id is an implementation detail; resolve_workflow_def looks it up live).
WORKFLOW_SLUG = "eval_coverage"

# D-03: native-7 is the hard pass/fail bar. openrouter is recorded best-effort,
# NEVER gating (experimental tier — feedback_openrouter_is_experimental).
NATIVE_7: tuple[str, ...] = (
    "openai", "anthropic", "google", "deepseek", "moonshot", "zhipu", "minimax",
)

# Provider -> API-key env var. Used for PRESENCE-only checks (values are never
# printed — project secrets rule). A missing key marks the row MISSING and the
# matrix continues (never blocks other providers).
_PROVIDER_KEY_ENV: dict[str, str] = {
    "openai": "OPENAI_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
    "google": "GOOGLE_API_KEY",
    "openrouter": "OPENROUTER_API_KEY",
    "deepseek": "DEEPSEEK_API_KEY",
    "moonshot": "MOONSHOT_API_KEY",
    "zhipu": "ZHIPU_API_KEY",
    "minimax": "MINIMAX_API_KEY",
}

# Kickoff content: exactly 3 semicolon-separated sub-topics so the seed's
# `eval_slow_step` (split_topic semantics — programmatic.py _CLAUSE_SPLIT_RE
# splits on ';'/newlines/' and '/' vs ') fans out N=3 (cheap but real). Avoid
# ' and ' / ' vs ' inside sub-topics — they are ALSO split boundaries.
WORKFLOW_KICKOFF_PROMPT = (
    "Compare what my knowledge base says about the ingestion pipeline; "
    "retrieval quality; sandbox security"
)

# Generous per-workflow-run wall clock: 5 phases including the ~20s
# eval_slow_step, a 3-agent fanout, a deep-dive agent, the robot-answered
# human-input pause, and a final synthesis. Overridable via EVAL_WORKFLOW_TIMEOUT_S.
DEFAULT_WORKFLOW_TIMEOUT_S = 900
WORKFLOW_POLL_INTERVAL_S = 3.0

# Terminal workflow_runs states (threads.py:815 _TERMINAL_WORKFLOW + the
# workflow_runs_status_check CHECK constraint; 'active'/'paused' are live).
_TERMINAL_WORKFLOW_STATES = frozenset({"completed", "failed", "cancelled"})

# D-02a robot answer for the confirm phase — matches the seed's options[0].
WORKFLOW_ASK_USER_ANSWER = "Approve"

# Fixed allowlist of FULL constant query strings for the workflow assertions —
# extends the _COUNT_QUERIES posture (T-088-02-04 / T-096-06-03): nothing is
# ever interpolated into SQL; the ONLY dynamic value is ONE parameterized %s id.
# Each key documents which id its query expects.
_WORKFLOW_QUERIES: dict[str, str] = {
    # %s = slug (the runtime definition lookup — never the hardcoded uuid)
    "definition_by_slug": (
        "SELECT id, definition FROM workflow_definitions "
        "WHERE slug = %s AND status = 'published' "
        "ORDER BY version DESC LIMIT 1"
    ),
    # %s = thread_id — the kickoff sets this anchor atomically BEFORE the
    # producer spawns (threads.py create_workflow_run), so it is the primary
    # workflow_run-id resolution path.
    "thread_anchor": (
        "SELECT active_workflow_run_id FROM threads WHERE id = %s"
    ),
    # %s = thread_id — fallback resolution when the anchor is not yet visible.
    "latest_workflow_run_by_thread": (
        "SELECT id FROM workflow_runs WHERE thread_id = %s "
        "ORDER BY created_at DESC LIMIT 1"
    ),
    # %s = workflow_run_id
    "workflow_run_status": (
        "SELECT status FROM workflow_runs WHERE id = %s"
    ),
    # %s = workflow_run_id — the locked phase sequence in phase_index order.
    "workflow_phases": (
        "SELECT phase_index, slug, status FROM workflow_phases "
        "WHERE workflow_run_id = %s ORDER BY phase_index ASC"
    ),
    # %s = thread_id — pending ask_user prompts: the panel.py /pending
    # containment + NOT-EXISTS shape (a prompt row without a matching
    # response row, correlated on tool_calls->0->>'tool_call_id').
    "pending_ask_user": (
        "SELECT m.tool_calls FROM messages m "
        "WHERE m.thread_id = %s "
        "  AND m.role = 'system' "
        "  AND m.tool_calls @> '[{\"kind\": \"ask_user_prompt\"}]'::jsonb "
        "  AND NOT EXISTS ( "
        "    SELECT 1 FROM messages r "
        "    WHERE r.thread_id = m.thread_id "
        "      AND r.role = 'system' "
        "      AND r.tool_calls @> '[{\"kind\": \"ask_user_response\"}]'::jsonb "
        "      AND r.tool_calls->0->>'tool_call_id' = m.tool_calls->0->>'tool_call_id' "
        "  ) "
        "ORDER BY m.created_at ASC"
    ),
    # NOTE on the CASE jsonb_typeof(...) wrappers below: the LIVE writer stores
    # harness_audit.metadata / workflow_phases.output as jsonb STRINGS containing
    # JSON (double-encoded — verified live 2026-06-07: 386/386 audit rows,
    # 95/99 phase outputs are jsonb_typeof = 'string'). `->` on a jsonb string
    # returns NULL, so each query normalizes BOTH shapes: a string unwraps via
    # `#>> '{}'` then re-parses with `::jsonb`; an object passes through. The
    # eval keeps working if the backend writer is ever fixed to store objects.
    #
    # %s = workflow_run_id — double-execution detector (harness_audit is
    # INSERT-only per HARNESS-06): ANY returned row = a double-applied phase.
    "duplicate_phase_completed": (
        "SELECT (CASE WHEN jsonb_typeof(metadata) = 'string' "
        "THEN (metadata #>> '{}')::jsonb ELSE metadata END)->>'phase' AS slug, "
        "count(*) AS n FROM harness_audit "
        "WHERE run_id = %s AND event_type = 'phase_completed' "
        "GROUP BY 1 HAVING count(*) > 1"
    ),
    # %s = workflow_run_id — coverage half of 'EXACTLY one per phase'.
    "phase_completed_slugs": (
        "SELECT DISTINCT (CASE WHEN jsonb_typeof(metadata) = 'string' "
        "THEN (metadata #>> '{}')::jsonb ELSE metadata END)->>'phase' AS slug "
        "FROM harness_audit "
        "WHERE run_id = %s AND event_type = 'phase_completed'"
    ),
    # %s = workflow_run_id — gate-failure diagnostics (measurement only).
    "gate_failed_count": (
        "SELECT count(*) AS n FROM harness_audit "
        "WHERE run_id = %s AND event_type = 'gate_failed'"
    ),
    # %s = workflow_run_id — retry proxy: gate_failed audit rows beyond the
    # first attempt (metadata.attempt > 1) = retry attempts that executed and
    # failed again. A retry that PASSES leaves no gate_failed row, so this
    # under-counts pass-after-retry — documented measurement-only proxy.
    "retry_attempt_count": (
        "SELECT count(*) AS n FROM harness_audit "
        "WHERE run_id = %s AND event_type = 'gate_failed' "
        "AND COALESCE(((CASE WHEN jsonb_typeof(metadata) = 'string' "
        "THEN (metadata #>> '{}')::jsonb ELSE metadata END)->>'attempt')::int, 1) > 1"
    ),
    # %s = thread_id — Pitfall 1: body.model does NOT steer harness phases.
    # The EFFECTIVE model is what the sub-agent runs rows actually recorded
    # (parent_run_id IS NOT NULL = the fanout/deep-dive sub-agents).
    "sub_agent_models": (
        "SELECT DISTINCT model FROM runs "
        "WHERE thread_id = %s AND model IS NOT NULL "
        "AND parent_run_id IS NOT NULL ORDER BY model"
    ),
    # %s = thread_id — fallback when no sub-agent rows exist (early failure).
    "thread_models": (
        "SELECT DISTINCT model FROM runs "
        "WHERE thread_id = %s AND model IS NOT NULL ORDER BY model"
    ),
    # %s = workflow_run_id — durable tool round-trip proof: harness sub-agent
    # transcripts are in-memory (the final assistant message persists prose
    # with NO tool_calls — harness_engine.py:383), so grounding harvested from
    # search_documents ToolResults into workflow_phases.output.source_refs
    # (F7, 092-07) is the DB truth that the tool round-tripped with results.
    # Same double-encoding normalization as the audit queries above.
    "grounded_phase_outputs": (
        "SELECT count(*) AS n FROM workflow_phases "
        "WHERE workflow_run_id = %s "
        "AND jsonb_array_length(COALESCE((CASE WHEN jsonb_typeof(output) = 'string' "
        "THEN (output #>> '{}')::jsonb ELSE output END)->'source_refs', "
        "'[]'::jsonb)) > 0"
    ),
}

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
# Workflow row type — Phase 096 / EVAL-01. Per provider: kick off eval_coverage,
# poll DB truth (status + pending ask_user TOGETHER — Pitfall 2), robot-answer
# the llm_human_input prompt via the panel's own endpoint (D-02a), then assert
# the locked phase sequence / single-completion audit / tool round-trip /
# effective model (Pitfall 1) against the durable rows.
# ─────────────────────────────────────────────────────────────────────────────

def workflow_fetch(conn, key: str, param: str) -> list[dict]:
    """Run one allowlisted constant workflow query with its single %s param.

    `key` selects a FULL constant query string from _WORKFLOW_QUERIES — nothing
    is interpolated into SQL (T-096-06-03, the _COUNT_QUERIES pattern extended).
    Raises ValueError for any key outside the allowlist.
    """
    query = _WORKFLOW_QUERIES.get(key)
    if query is None:
        raise ValueError(
            f"workflow_fetch: query {key!r} is not in the allowlist "
            f"{sorted(_WORKFLOW_QUERIES)}"
        )
    from psycopg2.extras import RealDictCursor

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(query, (param,))
        return [dict(r) for r in cur.fetchall()]


def resolve_workflow_def(conn) -> tuple[str, dict]:
    """Resolve the eval_coverage definition (id + parsed JSONB) by SLUG at runtime.

    NEVER hardcodes the seed uuid — migration 066's fixed id is an implementation
    detail. Exits with a clean apply-the-migration message when absent.
    """
    rows = workflow_fetch(conn, "definition_by_slug", WORKFLOW_SLUG)
    if not rows:
        print(
            f"ERROR: no published workflow_definitions row with slug "
            f"'{WORKFLOW_SLUG}'. Apply migration 066 "
            "(supabase/migrations/066_eval_coverage_seed.sql) to the local DB "
            "first — paste it into the Supabase SQL editor (never db push/reset)."
        )
        sys.exit(1)
    definition = rows[0]["definition"]
    if isinstance(definition, str):
        import json

        definition = json.loads(definition)
    return str(rows[0]["id"]), definition


def run_workflow_kickoff(token: str, thread_id: str, provider: str, def_id: str) -> str:
    """POST /threads/{id}/messages with workflow_definition_id + the per-request
    provider override (threads.py:835) — NEVER mutates global settings (the
    anti-pattern). Returns the producer run_id.

    Deliberately sends NO "model" field: body.model does not steer harness
    phases (Pitfall 1 — resolve_workflow_ctx_model ignores it); the per-provider
    defaults table (config.py _SUB_AGENT_MODEL_DEFAULTS) decides, and the
    scoreboard reports the EFFECTIVE model from sub-agent runs.model rows.
    """
    requests = _requests()
    try:
        resp = requests.post(
            f"{base_url()}/threads/{thread_id}/messages",
            headers=_auth_headers(token),
            json={
                "content": WORKFLOW_KICKOFF_PROMPT,
                "provider": provider,
                "workflow_definition_id": def_id,
            },
            timeout=30,
        )
    except Exception as e:
        raise BackendUnavailable(
            f"Could not reach the backend at {base_url()} ({type(e).__name__})."
        ) from e
    if resp.status_code not in (200, 201):
        # Provider-scoped HTTP failure (quota, 4xx, ...) — a ROW failure, not a
        # backend-down condition: raise a plain error so run_workflow_cell's
        # per-cell capture keeps the matrix going (one bad cell never aborts).
        raise RuntimeError(
            f"workflow kickoff failed (HTTP {resp.status_code}) for {provider}"
        )
    return resp.json()["run_id"]


def resolve_workflow_run_id(conn, thread_id: str, wait_s: float = 30.0) -> str | None:
    """Resolve the workflow_run id for a freshly kicked-off thread.

    Primary: threads.active_workflow_run_id (set atomically BEFORE the producer
    spawns — threads.py create_workflow_run), with a short poll + a fallback to
    the latest workflow_runs row for the thread. Both parameterized constants.
    """
    deadline = time.time() + wait_s
    while time.time() < deadline:
        conn.rollback()  # fresh snapshot (wait_for_run pattern)
        rows = workflow_fetch(conn, "thread_anchor", thread_id)
        if rows and rows[0].get("active_workflow_run_id"):
            return str(rows[0]["active_workflow_run_id"])
        rows = workflow_fetch(conn, "latest_workflow_run_by_thread", thread_id)
        if rows:
            return str(rows[0]["id"])
        time.sleep(1.0)
    return None


def post_ask_user_answer(token: str, workflow_run_id: str, tool_call_id: str) -> bool:
    """D-02a robot answer — POST the panel's OWN endpoint.

    The F10 workflow_run-id fallback resolves this at runs.py:521-567
    (owner-scoped + thread-anchor confirm, 404-never-403) — the script adds no
    bypass (T-096-06-04); it submits exactly what the panel submits.
    """
    requests = _requests()
    try:
        resp = requests.post(
            f"{base_url()}/runs/{workflow_run_id}/ask_user_response",
            headers=_auth_headers(token),
            json={
                "tool_call_id": tool_call_id,
                "response_text": WORKFLOW_ASK_USER_ANSWER,
                "choice_index": 0,
            },
            timeout=15,
        )
    except Exception:
        return False  # transient — the poll loop retries on the next tick
    return resp.status_code == 200


def run_workflow_cell(token: str, conn, provider: str, model: str,
                      def_id: str, definition: dict, timeout_s: int) -> dict:
    """Drive ONE provider's eval_coverage workflow end-to-end + assert DB truth.

    Mirrors run_cell's error capture: one bad provider never aborts the matrix.
    Distinct diagnostic outcomes (never collapsed into a generic FAIL):
      - missing_api_key        — provider key absent (presence-only check)
      - no_workflow_run        — kickoff accepted but no workflow_runs row appeared
      - timeout                — no terminal status within timeout_s
      - terminal_before_answer — the run terminalized BEFORE the robot answer
                                 landed (Pitfall 2 — the F10/BUG-260605-01 race)
    """
    expected = sorted(
        (
            (int(p["phase_index"]), p["slug"], p["config"]["phase_type"])
            for p in definition.get("phases", [])
        ),
        key=lambda t: t[0],
    )
    human_slugs = {slug for _, slug, ptype in expected if ptype == "llm_human_input"}
    result = {
        "provider": provider,
        "model_requested": model,   # NEVER reported as effective (Pitfall 1)
        "model_effective": "",
        "workflow_run_id": "",
        "run_status": "",
        "outcome": "",
        "workflow_completed": None,
        "phases_ok": None,
        "audit_single_completion": None,
        "tools_ok": None,
        "ask_user_roundtrip_ok": None,
        "retries": 0,
        "gate_failures": 0,
        "wall_clock_s": 0.0,
        "phase_results": {},
        "phase_type_results": {},
        "gated": provider in NATIVE_7,  # D-03: openrouter best-effort, never gating
        "ok": False,
        "note": "",
    }

    key_env = _PROVIDER_KEY_ENV.get(provider)
    if key_env and not os.getenv(key_env):
        result["outcome"] = "missing_api_key"
        result["note"] = f"{key_env} MISSING - row skipped, never blocks others"
        return result

    started = time.time()
    try:
        thread_id = create_thread(token, f"eval workflow {provider}")
        run_workflow_kickoff(token, thread_id, provider, def_id)
        workflow_run_id = resolve_workflow_run_id(conn, thread_id)
        if not workflow_run_id:
            result["outcome"] = "no_workflow_run"
            result["note"] = "kickoff accepted but no workflow_runs row appeared"
            result["wall_clock_s"] = round(time.time() - started, 1)
            return result
        result["workflow_run_id"] = workflow_run_id

        # ── Concurrent poll loop (Pitfall 2): status AND pending prompt together ──
        answered = False
        status = "unknown"
        deadline = time.time() + timeout_s
        while time.time() < deadline:
            conn.rollback()  # fresh snapshot per poll (wait_for_run pattern)
            rows = workflow_fetch(conn, "workflow_run_status", workflow_run_id)
            status = rows[0]["status"] if rows else "unknown"
            if not answered and status not in _TERMINAL_WORKFLOW_STATES:
                for prow in workflow_fetch(conn, "pending_ask_user", thread_id):
                    tcs = prow.get("tool_calls") or []
                    payload = tcs[0] if isinstance(tcs, list) and tcs else {}
                    tcid = payload.get("tool_call_id")
                    if not tcid:
                        continue
                    # panel.py:144-155 payload field names: the prompt row's
                    # run_id IS the workflow_run id for harness prompts.
                    prompt_run_id = payload.get("run_id") or workflow_run_id
                    answered = post_ask_user_answer(token, str(prompt_run_id), str(tcid))
                    break
            if status in _TERMINAL_WORKFLOW_STATES:
                break
            time.sleep(WORKFLOW_POLL_INTERVAL_S)

        result["wall_clock_s"] = round(time.time() - started, 1)
        result["run_status"] = status

        if status not in _TERMINAL_WORKFLOW_STATES:
            result["outcome"] = "timeout"
            result["note"] = f"workflow_runs.status still {status!r} after {timeout_s}s"
            return result

        # Pitfall 2: terminal BEFORE the robot answer landed is a DISTINCT
        # diagnostic outcome — not a generic FAIL.
        result["outcome"] = status if answered else "terminal_before_answer"

        # ── Terminal DB-truth assertions ────────────────────────────────────
        conn.rollback()

        # (i) the workflow run completed
        result["workflow_completed"] = status == "completed"

        # (ii) every phase reached 'completed' in phase_index order — and the
        # sequence matches the published definition (no 'skipped': eval_coverage
        # routes none).
        phase_rows = workflow_fetch(conn, "workflow_phases", workflow_run_id)
        actual = [(int(r["phase_index"]), r["slug"], r["status"]) for r in phase_rows]
        result["phase_results"] = {slug: st for _, slug, st in actual}
        result["phase_type_results"] = {
            ptype: result["phase_results"].get(slug, "missing")
            for _, slug, ptype in expected
        }
        result["phases_ok"] = (
            [(i, s) for i, s, _ in actual] == [(i, s) for i, s, _ in expected]
            and bool(actual)
            and all(st == "completed" for _, _, st in actual)
        )

        # (iii) EXACTLY one phase_completed audit event per phase: the
        # HAVING-count detector returns ZERO rows (no duplicates) AND the
        # distinct completed slugs cover the full definition.
        dup_rows = workflow_fetch(conn, "duplicate_phase_completed", workflow_run_id)
        completed_slugs = {
            r["slug"]
            for r in workflow_fetch(conn, "phase_completed_slugs", workflow_run_id)
        }
        result["audit_single_completion"] = (
            not dup_rows and completed_slugs == {slug for _, slug, _ in expected}
        )

        # (iv) tool round-trip: >=1 search_documents call. Primary: thread
        # messages tool_calls (get_tool_calls/assert_tool_invoked — the Deep
        # shape). Fallback: harness sub-agent transcripts are in-memory and the
        # engine's final message persists NO tool_calls (harness_engine.py:383),
        # so the durable proof is grounding harvested from search_documents
        # ToolResults into workflow_phases.output.source_refs (F7).
        calls = get_tool_calls(conn, thread_id)
        grounded = workflow_fetch(conn, "grounded_phase_outputs", workflow_run_id)
        grounded_n = int(grounded[0]["n"]) if grounded else 0
        result["tools_ok"] = bool(
            assert_tool_invoked(calls, "search_documents") or grounded_n > 0
        )

        # (v) ask_user round-trip: the robot answer was POSTed (200) AND the
        # run proceeded past the confirm phase (human-input phase completed).
        result["ask_user_roundtrip_ok"] = bool(
            answered
            and human_slugs
            and all(result["phase_results"].get(s) == "completed" for s in human_slugs)
        )

        # Effective model (Pitfall 1): report what the SUB-AGENT runs rows
        # actually recorded — never the requested PROVIDERS-constant model.
        sub_models = [
            r["model"] for r in workflow_fetch(conn, "sub_agent_models", thread_id)
        ]
        all_models = [
            r["model"] for r in workflow_fetch(conn, "thread_models", thread_id)
        ]
        result["model_effective"] = "+".join(sub_models or all_models)

        # Diagnostics (measurement only — harness_audit event counts).
        gf = workflow_fetch(conn, "gate_failed_count", workflow_run_id)
        result["gate_failures"] = int(gf[0]["n"]) if gf else 0
        rc = workflow_fetch(conn, "retry_attempt_count", workflow_run_id)
        result["retries"] = int(rc[0]["n"]) if rc else 0

        result["ok"] = all(
            bool(v)
            for v in (
                result["workflow_completed"],
                result["phases_ok"],
                result["audit_single_completion"],
                result["tools_ok"],
                result["ask_user_roundtrip_ok"],
            )
        )
    except BackendUnavailable:
        raise  # backend/auth down — main() prints the clean message
    except Exception as e:  # one provider's failure never aborts the matrix
        result["note"] = f"{type(e).__name__}: {e}"
        result["wall_clock_s"] = round(time.time() - started, 1)
    return result


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


def print_workflow_scoreboard(rows: list[dict]) -> None:
    """Workflow rows keep the EVAL_ROW / EVAL_SUMMARY greppable markers (the
    phase-closure diff ritual greps them) with the EVAL-01 column set:
    provider, model_effective, workflow_completed, phases_ok,
    audit_single_completion, tools_ok, ask_user_roundtrip_ok, retries,
    wall_clock_s. D-03: only native-7 rows count toward the pass/fail tally;
    openrouter prints BEST-EFFORT; missing keys print MISSING.
    """
    print(f"\n## Cross-provider WORKFLOW scoreboard ({WORKFLOW_SLUG} 5-type — EVAL-01)\n")
    header = (
        f"{'provider':<11} {'model_effective':<30} "
        f"{'wf_done':<8}{'phases':<8}{'audit1':<8}{'tools':<8}{'ask_user':<9}"
        f"{'retries':<8}{'wall_s':<9}{'outcome':<24} RESULT"
    )
    print(header)
    print("-" * len(header))
    passed = gated_run = missing = 0
    for r in rows:
        if r["outcome"] == "missing_api_key":
            verdict = "MISSING"
            missing += 1
        elif not r["gated"]:
            verdict = "BEST-EFFORT-" + ("PASS" if r["ok"] else "FAIL")
        else:
            gated_run += 1
            verdict = "PASS" if r["ok"] else "FAIL"
            if r["ok"]:
                passed += 1
        line = (
            f"{r['provider']:<11} {(r['model_effective'] or '-'):<30} "
            f"{_cell(r['workflow_completed']):<8}{_cell(r['phases_ok']):<8}"
            f"{_cell(r['audit_single_completion']):<8}{_cell(r['tools_ok']):<8}"
            f"{_cell(r['ask_user_roundtrip_ok']):<9}"
            f"{r['retries']:<8}{r['wall_clock_s']:<9}{(r['outcome'] or '-'):<24} {verdict}"
        )
        if r["note"]:
            line += f"   ({r['note']})"
        print(f"EVAL_ROW workflow {line}")
    print("-" * len(header))
    print(
        f"EVAL_SUMMARY workflow {passed}/{gated_run} native-7 rows PASS "
        f"({missing} MISSING; openrouter best-effort, never gating — D-03)"
    )


def _eval_artifact_dir() -> Path:
    """`.planning/eval/` at the repo root — the D-04 capability-table home."""
    return Path(__file__).resolve().parent.parent / ".planning" / "eval"


def emit_capability_table(rows: list[dict], *, full_matrix: bool) -> None:
    """D-04: persist the per-provider capability table as a versioned JSON +
    Markdown twin under .planning/eval/ (git-versioned, diffable across runs).

    MEASUREMENT ONLY — feature-fit routing changes are deferred to the v2.9
    decision pass (D-04 locked; this function adds no routing logic).

    Emitted only for FULL --workflow runs (no --provider filter) so a one-off
    single-provider re-run never clobbers a full table from the same day. The
    artifact contains model NAMES + metrics only — never key material
    (T-096-06-02; no GitHub secrets — D-01).
    """
    if not full_matrix:
        print(
            "\n(capability table NOT written — partial run; the D-04 artifact "
            "requires a full --workflow run with no --provider filter)"
        )
        return
    import json
    from datetime import date

    out_dir = _eval_artifact_dir()
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = date.today().isoformat()

    entries = []
    for r in rows:
        entries.append({
            "provider": r["provider"],
            "model_effective": r["model_effective"],
            "workflow_completed": bool(r["workflow_completed"]),
            # phase-type -> workflow_phases.status, derived from the published
            # definition at runtime (eval_coverage covers all 5 types).
            "phase_type_results": r["phase_type_results"],
            # Durable proof of the search_documents round-trip (messages
            # tool_calls OR phase-output grounding).
            "tool_invocation_fidelity": bool(r["tools_ok"]),
            # NOT measurable for workflow rows in v2.8: harness sub-agent
            # transcripts are in-memory (args never persisted). Kept null for
            # schema stability; the Deep-mode matrix measures arg shape.
            "arg_shape_ok": None,
            "retry_count": int(r["retries"]),
            "gate_failures": int(r["gate_failures"]),
            "wall_clock_s": float(r["wall_clock_s"]),
            "ask_user_roundtrip_ok": bool(r["ask_user_roundtrip_ok"]),
            # Diagnostic extras (additive to the D-04 schema):
            "outcome": r["outcome"],  # completed/failed/timeout/missing_api_key/terminal_before_answer
            "gated": r["gated"],      # D-03: openrouter rows are best-effort
        })

    json_path = out_dir / f"capability-table-{stamp}.json"
    json_path.write_text(json.dumps(entries, indent=2) + "\n", encoding="utf-8")

    md_lines = [
        f"# Capability table — {stamp} (eval_coverage workflow, D-04)",
        "",
        "Measurement only — the v2.9 feature-fit routing pass consumes these "
        "diffs (D-04). Generated by `scripts/eval_cross_provider.py --workflow`.",
        "",
        "| provider | model_effective | wf_done | programmatic | llm_batch_agents "
        "| llm_agent | llm_human_input | llm_single | tools | ask_user | retries "
        "| gate_failures | wall_s | outcome |",
        "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    ]
    for e in entries:
        ptr = e["phase_type_results"] or {}
        md_lines.append(
            "| {provider} | {model} | {done} | {prog} | {batch} | {agent} "
            "| {human} | {single} | {tools} | {ask} | {ret} | {gf} | {wall} "
            "| {outcome} |".format(
                provider=e["provider"],
                model=e["model_effective"] or "-",
                done="yes" if e["workflow_completed"] else "no",
                prog=ptr.get("programmatic", "-"),
                batch=ptr.get("llm_batch_agents", "-"),
                agent=ptr.get("llm_agent", "-"),
                human=ptr.get("llm_human_input", "-"),
                single=ptr.get("llm_single", "-"),
                tools="yes" if e["tool_invocation_fidelity"] else "no",
                ask="yes" if e["ask_user_roundtrip_ok"] else "no",
                ret=e["retry_count"],
                gf=e["gate_failures"],
                wall=e["wall_clock_s"],
                outcome=e["outcome"] or "-",
            )
        )
    md_path = out_dir / f"capability-table-{stamp}.md"
    md_path.write_text("\n".join(md_lines) + "\n", encoding="utf-8")
    print(f"\nCapability table written: {json_path}")
    print(f"Capability table written: {md_path}")


def _run_workflow_matrix(args, token: str, conn, providers: list[tuple[str, str]],
                         timeout_s: int) -> int:
    """The --workflow entry: one eval_coverage row per selected provider.

    Exit code: 0 = every native-7 row that RAN passed; 2 = a native-7 row
    failed; 1 = nothing ran (all keys missing / no rows). openrouter never
    flips the exit code (D-03); MISSING rows never block others.
    """
    rows: list[dict] = []
    try:
        def_id, definition = resolve_workflow_def(conn)
        for provider, model in providers:
            print(f"  -> {provider} :: workflow {WORKFLOW_SLUG} ...")
            rows.append(
                run_workflow_cell(
                    token, conn, provider, model, def_id, definition, timeout_s,
                )
            )
    except BackendUnavailable as e:
        print(f"\nCANNOT CONTINUE: {e}")
        if rows:
            print_workflow_scoreboard(rows)
        return 1
    finally:
        try:
            conn.close()
        except Exception:
            pass

    print_workflow_scoreboard(rows)
    # D-04: persist the versioned capability table (full runs only — a partial
    # --provider re-run never clobbers a full table from the same day).
    emit_capability_table(rows, full_matrix=args.provider is None)
    driven = [
        r for r in rows if r["gated"] and r["outcome"] != "missing_api_key"
    ]
    if not driven:
        print("\nNo native-7 workflow row ran (all keys missing?) — nothing proven.")
        return 1
    return 0 if all(r["ok"] for r in driven) else 2


# ─────────────────────────────────────────────────────────────────────────────
# Forced-emit matrix — Phase 122 / MP-03 (D-122-06, D-122-07, SC#3).
#
# Provider becomes a FIRST-CLASS eval axis: per (provider x schema_difficulty) the
# DIRECT-CALL harness drives the REAL forced_emit recovery ladder (Plan 122-02) and
# scores the 4 axes (trigger / force / recovery / honest_fail) as PASS/FAIL/DOCUMENTED.
#
# Why direct-call (RESEARCH Open Q2 -> A3 / Pitfall 6): forced_emit resolves its tier
# + rung ladder from the model's emit_tier (config registry), and the *requested* model
# steers the shot directly — unlike harness phases, where body.model does NOT steer the
# sub-agent (Pitfall 6). So we import forced_emit and call it per representative model.
#
# The HARD schema (optional-heavy + an additionalProperties confidence object) is the
# LIVE trip-wire (Pitfall 1) that 400s the OpenAI-schema family on the strict rung —
# it is what makes the `recovery` axis non-vacuous (a clean schema would always win on
# the top rung, so recovery could never be exercised).
#
# This mode is localhost-gated (the gate fired in main() before any work), needs NO DB
# connection and NO bearer token (it never WRITES), and the artifact carries model NAMES
# + verdicts ONLY — never key material (Security: Information Disclosure).
# ─────────────────────────────────────────────────────────────────────────────

# The 4 axes (D-122-07). A cell verdict per axis is PASS / FAIL / DOCUMENTED.
FORCED_EMIT_AXES: tuple[str, ...] = ("trigger", "force", "recovery", "honest_fail")

# Per-difficulty schema_model + tool-parameter schema for the forced_emit shot. The
# EASY schema is clean required-only; the HARD schema is optional-heavy and carries an
# `additionalProperties` confidence object (the strict-rung trip-wire — Pitfall 1).
# Built lazily inside the matrix so importing this module never imports the backend
# (the structure-only test imports the scorer/writer without pulling pydantic in).


def _forced_emit_schemas() -> dict[str, dict]:
    """Return ``{difficulty: {"schema_model": <pydantic type>, "tools": [<tool def>]}}``.

    EASY  — clean required-only fields (every model should win on its top rung).
    HARD  — optional-heavy + an ``additionalProperties`` confidence object: the live
            trip-wire that 400s the OpenAI-schema family on the STRICT rung (strict
            mode requires every property in ``required`` AND forbids
            ``additionalProperties``), forcing a descent to a lower rung. This is what
            makes the ``recovery`` axis non-vacuous (Pitfall 1).

    Imported lazily so this module stays import-light for the structure-only test.
    """
    from pydantic import BaseModel, ConfigDict, Field

    class _EasyEmit(BaseModel):
        model_config = ConfigDict(extra="forbid")
        title: str
        summary: str

    class _HardConfidence(BaseModel):
        # An open object — `additionalProperties` is True here, which the OpenAI strict
        # rung forbids; this is the deliberate strict-rung trip-wire (Pitfall 1).
        model_config = ConfigDict(extra="allow")
        value: float | None = None

    class _HardEmit(BaseModel):
        # Optional-heavy: most fields nullable -> NOT all in `required` -> the OpenAI
        # strict rung 400s, the ladder descends to non-strict-force / coerce.
        model_config = ConfigDict(extra="allow")
        title: str
        summary: str | None = None
        tags: list[str] | None = None
        confidence: _HardConfidence | None = None
        notes: dict | None = Field(default=None)

    easy_tool = {
        "function": {
            "name": "emit_easy",
            "description": "Emit the structured easy field-map.",
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "required": ["title", "summary"],
                "properties": {
                    "title": {"type": "string"},
                    "summary": {"type": "string"},
                },
            },
        }
    }
    hard_tool = {
        "function": {
            "name": "emit_hard",
            "description": "Emit the structured hard field-map (optional-heavy).",
            "parameters": {
                "type": "object",
                # The live trip-wire: an additionalProperties confidence object +
                # optional fields NOT all in `required` (Pitfall 1).
                "additionalProperties": True,
                "required": ["title"],
                "properties": {
                    "title": {"type": "string"},
                    "summary": {"type": "string"},
                    "tags": {"type": "array", "items": {"type": "string"}},
                    "confidence": {
                        "type": "object",
                        "additionalProperties": True,
                        "properties": {"value": {"type": "number"}},
                    },
                    "notes": {"type": "object", "additionalProperties": True},
                },
            },
        }
    }
    return {
        "easy": {"schema_model": _EasyEmit, "emitter": "emit_easy", "tools": [easy_tool]},
        "hard": {"schema_model": _HardEmit, "emitter": "emit_hard", "tools": [hard_tool]},
    }


# The single user message the forced shot must answer (cheap, deterministic; the point
# is the EMISSION mechanics per provider, not the content quality).
_FORCED_EMIT_PROMPT = (
    "Produce a one-line title and a short summary describing a quarterly status "
    "report. Emit the structured field-map via the tool."
)


def score_forced_emit_axes(result: dict, declared_emit_tier: str) -> dict[str, str]:
    """Score the 4 axes (D-122-07) from a forced_emit RESULT dict (the ladder's output:
    ``emitted`` / ``emit_rung`` / ``forced`` / ``failure`` / ``recovered_from_narration``).

    Pure — no I/O, no provider call. This is the function the structure-only test drives
    with a synthetic result (no live keys). Each axis returns "PASS" / "FAIL" (a
    DOCUMENTED override is applied by the caller, not here):

      trigger     — did the shot attempt the forced/coerced emission at all (a non-None
                    emission OR a recovered narration OR an honest model-level failure —
                    i.e. NOT a provider_error/transport failure that means the model was
                    never actually reached)?
      force       — did the model win on the DECLARED TOP rung (its emit_tier's first
                    rung — strict_force for force_strict, non_strict_force for force,
                    coerce for coerce)?
      recovery    — did a 400/no-emit on a higher rung recover via a LOWER rung (the
                    winning rung is below the tier's top rung)? PASS if a real descent
                    won; FAIL only if nothing won at all (a top-rung win is N/A here —
                    represented as PASS because the ladder never NEEDED to recover).
      honest_fail — when nothing succeeds, did the ladder return a clean ``_failure``
                    (emitted is None AND a non-None failure reason) rather than a silent
                    drop or a fabricated emission?
    """
    emitted = result.get("emitted")
    emit_rung = result.get("emit_rung")
    failure = result.get("failure")
    won = emitted is not None

    # The tier's ordered rung names (top rung first) — mirrors forced_emit._RUNGS_BY_TIER.
    _rung_order_by_tier = {
        "force_strict": ["strict_force", "non_strict_force", "coerce"],
        "force": ["non_strict_force", "coerce"],
        "coerce": ["coerce"],
    }
    rung_order = _rung_order_by_tier.get(declared_emit_tier, ["coerce"])
    top_rung = rung_order[0]

    axes: dict[str, str] = {}

    # trigger: the model was actually reached and produced an emission OR an honest
    # model-level failure (model_failed_to_emit). A provider_error means the shot never
    # got a real answer from the model (transport/400 on EVERY rung) — that is a FAIL on
    # trigger (the model never attempted) but is still honest_fail PASS below.
    if won:
        axes["trigger"] = "PASS"
    elif failure == "model_failed_to_emit":
        axes["trigger"] = "PASS"  # the model was reached; it declined/failed to emit
    else:
        axes["trigger"] = "FAIL"  # provider_error on every rung — never reached

    # force: won on the tier's TOP rung.
    axes["force"] = "PASS" if (won and emit_rung == top_rung) else "FAIL"

    # recovery: either a top-rung win (no recovery NEEDED -> PASS) or a win on a lower
    # rung after a higher one failed (recovery DID fire -> PASS). FAIL only when nothing
    # won (the ladder went all the way to the honest-fail floor).
    if won:
        axes["recovery"] = "PASS"  # won somewhere on the ladder (top OR a lower rung)
    else:
        axes["recovery"] = "FAIL"

    # honest_fail: when nothing won, a clean _failure (emitted None + a failure reason)
    # is a PASS (never silent, never fabricated). When something won, the floor was not
    # reached — represent as PASS (the honest-fail contract was not violated).
    if won:
        axes["honest_fail"] = "PASS"
    else:
        axes["honest_fail"] = "PASS" if (emitted is None and failure) else "FAIL"

    return axes


def _build_forced_emit_cell(
    provider: str,
    model: str,
    difficulty: str,
    result: dict,
    declared_emit_tier: str,
    *,
    gated: bool,
    documented: list[dict] | None = None,
    outcome: str = "completed",
) -> dict:
    """Assemble one scoreboard cell (mirrors the RESEARCH "MP-03 scoreboard artifact
    shape"). A DOCUMENTED entry is a known-limitation row: its presence clears the gate
    for that axis (D-122-07) — the declared ``emit_tier`` already reflects that reality.
    """
    axes = score_forced_emit_axes(result, declared_emit_tier)
    documented = documented or []
    # A DOCUMENTED axis overrides its PASS/FAIL with "DOCUMENTED" — a known-limitation
    # row inside the artifact that clears the gate (the declared tier reflects reality).
    for d in documented:
        ax = d.get("axis")
        if ax in axes:
            axes[ax] = "DOCUMENTED"
    return {
        "schema_difficulty": difficulty,
        "provider": provider,
        "model_effective": model,
        "declared_emit_tier": declared_emit_tier,
        "winning_rung": result.get("emit_rung"),
        "axes": axes,
        "documented": documented,
        "outcome": outcome,  # completed / missing_api_key / provider_error
        "gated": gated,      # D-122-07: native-7 gates; openrouter is best-effort
    }


def _cell_gate_ok(cell: dict) -> bool:
    """A cell clears the gate when every axis is PASS or DOCUMENTED (a DOCUMENTED axis
    is a known-limitation row whose declared emit_tier already reflects reality —
    D-122-07). A single FAIL on any axis fails the cell."""
    return all(v in ("PASS", "DOCUMENTED") for v in cell["axes"].values())


async def _drive_forced_emit_cell(
    provider: str, model: str, difficulty: str, spec: dict, *, gated: bool
) -> dict:
    """Drive ONE real forced_emit shot for (provider, model, difficulty) and score it.

    Imports forced_emit + the config registry lazily (so module import stays light).
    A provider with NO key is reported MISSING and never blocks the matrix.
    """
    from app.config import get_model_capability
    from app.models.user_settings import (
        load_app_settings_async,
        override_provider,
    )
    from app.services.forced_emit import forced_emit

    cap = get_model_capability(model) or {}
    declared_emit_tier = cap.get("emit_tier", "coerce")

    # Presence-only: a missing provider key -> MISSING row (never key VALUES printed).
    key_env = _PROVIDER_KEY_ENV.get(provider, "")
    if key_env and not os.getenv(key_env):
        return _build_forced_emit_cell(
            provider, model, difficulty,
            {"emitted": None, "emit_rung": None, "failure": None, "forced": False},
            declared_emit_tier, gated=gated, outcome="missing_api_key",
        )

    # Resolve a real settings object switched to the TARGET provider so forced_emit's
    # adapters find the right key/base_url (the SAME override_provider helper the app
    # uses; forced_emit's own cross-provider injection block is the second line of
    # defense). If settings can't be loaded, pass None — forced_emit degrades honestly.
    try:
        base_settings = await load_app_settings_async()
        user_settings = override_provider(base_settings, provider)
    except Exception:
        user_settings = None

    try:
        result = await forced_emit(
            messages=[{"role": "user", "content": _FORCED_EMIT_PROMPT}],
            model=model,
            provider=provider,
            emitter=spec["emitter"],
            tools=spec["tools"],
            user_settings=user_settings,
            system_prompt="",
            schema_model=spec["schema_model"],
        )
    except Exception as e:  # noqa: BLE001 — an unexpected raise is an honest provider_error cell
        # Identifier-only: NEVER the message content (could carry request/arg material).
        print(f"    ! {provider}/{difficulty}: forced_emit raised {type(e).__name__}")
        result = {"emitted": None, "emit_rung": None, "failure": "provider_error", "forced": False}
        return _build_forced_emit_cell(
            provider, model, difficulty, result, declared_emit_tier,
            gated=gated, outcome="provider_error",
        )

    return _build_forced_emit_cell(
        provider, model, difficulty, result, declared_emit_tier, gated=gated,
    )


def print_forced_emit_scoreboard(cells: list[dict]) -> None:
    """Greppable per-cell scoreboard (EVAL_ROW / EVAL_SUMMARY markers — the phase-closure
    diff ritual greps them). Native-7 cells gate; openrouter prints BEST-EFFORT; missing
    keys print MISSING."""
    print("\n## Cross-provider FORCED-EMIT scoreboard (real forced_emit ladder — MP-03)\n")
    header = (
        f"{'provider':<11} {'difficulty':<10} {'tier':<13} "
        f"{'trigger':<9}{'force':<9}{'recovery':<10}{'honest':<9}"
        f"{'rung':<18}{'gated':<6} RESULT"
    )
    print(header)
    print("-" * len(header))
    passed = gated_run = missing = 0
    for c in cells:
        ax = c["axes"]
        if c["outcome"] == "missing_api_key":
            verdict = "MISSING"
            missing += 1
        elif not c["gated"]:
            verdict = "BEST-EFFORT-" + ("PASS" if _cell_gate_ok(c) else "FAIL")
        else:
            gated_run += 1
            if _cell_gate_ok(c):
                verdict = "PASS"
                passed += 1
            else:
                verdict = "FAIL"
        line = (
            f"{c['provider']:<11} {c['schema_difficulty']:<10} "
            f"{c['declared_emit_tier']:<13} "
            f"{ax['trigger']:<9}{ax['force']:<9}{ax['recovery']:<10}{ax['honest_fail']:<9}"
            f"{(c['winning_rung'] or '-'):<18}{('yes' if c['gated'] else 'no'):<6} {verdict}"
        )
        print(f"EVAL_ROW forced-emit {line}")
    print("-" * len(header))
    print(
        f"EVAL_SUMMARY forced-emit {passed}/{gated_run} native-7 cells PASS "
        f"({missing} MISSING; openrouter best-effort, never gating — D-122-07)"
    )


def emit_forced_emit_scoreboard(cells: list[dict], *, full_matrix: bool) -> None:
    """Persist the per-cell forced-emit scoreboard as a versioned JSON + Markdown twin
    under .planning/eval/ (D-122-06). MIRRORS ``emit_capability_table``: ``_eval_artifact_dir()``
    + ``date.today().isoformat()`` stamp + a ``.json`` writer + an ``md_lines`` twin + the
    two ``print(... written: ...)`` lines.

    Emitted only for FULL runs (no --provider filter) so a one-off single-provider re-run
    never clobbers a full scoreboard from the same day. The artifact carries model NAMES +
    verdicts ONLY — never key material (Security: Information Disclosure).
    """
    if not full_matrix:
        print(
            "\n(forced-emit scoreboard NOT written — partial run; the MP-03 artifact "
            "requires a full --forced-emit run with no --provider filter)"
        )
        return
    import json
    from datetime import date

    out_dir = _eval_artifact_dir()
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = date.today().isoformat()

    json_path = out_dir / f"forced-emit-scoreboard-{stamp}.json"
    json_path.write_text(json.dumps(cells, indent=2) + "\n", encoding="utf-8")

    md_lines = [
        f"# Forced-emit scoreboard — {stamp} (real forced_emit ladder, MP-03)",
        "",
        "Provider as a first-class axis (D-122-06). Each cell drives the REAL "
        "`forced_emit` recovery ladder per (provider x EASY/HARD schema) and scores "
        "trigger / force / recovery / honest_fail as PASS / FAIL / DOCUMENTED. "
        "A DOCUMENTED axis is a known-limitation row whose declared `emit_tier` already "
        "reflects that reality — it CLEARS the gate. Generated by "
        "`scripts/eval_cross_provider.py --forced-emit`. Operator greps this before "
        "flipping any `emit_tier` (the tier-change gate).",
        "",
        "| provider | difficulty | tier | trigger | force | recovery | honest_fail "
        "| rung | gated |",
        "|---|---|---|---|---|---|---|---|---|",
    ]
    for c in cells:
        ax = c["axes"]
        md_lines.append(
            "| {provider} | {diff} | {tier} | {trigger} | {force} | {recovery} "
            "| {honest} | {rung} | {gated} |".format(
                provider=c["provider"],
                diff=c["schema_difficulty"],
                tier=c["declared_emit_tier"],
                trigger=ax["trigger"],
                force=ax["force"],
                recovery=ax["recovery"],
                honest=ax["honest_fail"],
                rung=c["winning_rung"] or "-",
                gated="yes" if c["gated"] else "no",
            )
        )
    # A documented-notes appendix (the known-limitation evidence rows).
    documented_cells = [c for c in cells if c.get("documented")]
    if documented_cells:
        md_lines += ["", "## Documented (known-limitation) rows", ""]
        for c in documented_cells:
            for d in c["documented"]:
                md_lines.append(
                    f"- **{c['provider']} / {c['schema_difficulty']} / "
                    f"{d.get('axis', '-')}** — {d.get('note', '')} "
                    f"(evidence: {d.get('evidence', '-')})"
                )
    md_path = out_dir / f"forced-emit-scoreboard-{stamp}.md"
    md_path.write_text("\n".join(md_lines) + "\n", encoding="utf-8")
    print(f"\nForced-emit scoreboard written: {json_path}")
    print(f"Forced-emit scoreboard written: {md_path}")


def run_forced_emit_matrix(args, providers: list[tuple[str, str]]) -> int:
    """The --forced-emit entry (Phase 122 / MP-03): per (provider x {EASY, HARD} schema)
    drive the REAL forced_emit ladder directly and score the 4 axes.

    Direct-call harness — NO bearer token, NO DB connection, NO agent run (it never
    WRITES). The localhost gate already fired in main(). Exit code: 0 = every native-7
    cell that RAN cleared the gate; 2 = a native-7 cell failed; 1 = nothing ran (all
    keys missing). openrouter never flips the exit code (D-122-07).
    """
    import asyncio

    schemas = _forced_emit_schemas()
    cells: list[dict] = []
    for provider, model in providers:
        gated = provider in NATIVE_7
        for difficulty in ("easy", "hard"):
            spec = schemas[difficulty]
            print(f"  -> {provider}/{model} :: forced_emit [{difficulty}] ...")
            cell = asyncio.run(
                _drive_forced_emit_cell(provider, model, difficulty, spec, gated=gated)
            )
            cells.append(cell)

    print_forced_emit_scoreboard(cells)
    # D-122-06: persist the versioned scoreboard (full runs only — a partial --provider
    # re-run never clobbers a full scoreboard from the same day).
    emit_forced_emit_scoreboard(cells, full_matrix=args.provider is None)

    driven = [c for c in cells if c["gated"] and c["outcome"] != "missing_api_key"]
    if not driven:
        print("\nNo native-7 forced-emit cell ran (all keys missing?) — nothing proven.")
        return 1
    return 0 if all(_cell_gate_ok(c) for c in driven) else 2


# ─────────────────────────────────────────────────────────────────────────────
# Entry point — the 4-prompt x 4-provider matrix loop. Optional --provider /
# --prompt run a single cell (lightweight re-run for the fold-gate). A no-backend
# invocation exits cleanly with a connection message (no traceback / no values).
# --workflow switches to the EVAL-01 workflow row type (one eval_coverage run
# per provider) instead of the Deep-mode prompt matrix.
# --forced-emit switches to the MP-03 forced-emit row type (direct-call harness
# driving the real forced_emit ladder per provider x EASY/HARD schema).
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
             "(new-model onboarding — D-08 seed). NOTE: ignored by --workflow "
             "rows — body.model does not steer harness phases (Pitfall 1); the "
             "scoreboard reports the effective sub-agent runs.model instead.",
    )
    parser.add_argument(
        "--workflow",
        action="store_true",
        help="Run the WORKFLOW row type (Phase 096 EVAL-01) instead of the "
             "Deep-mode prompt matrix: per provider, drive the 'eval_coverage' "
             "5-phase-type workflow end-to-end (kickoff via "
             "workflow_definition_id, DB-truth polling, robot-answered ask_user "
             "— D-02a) and assert the locked phase sequence. Combinable with "
             "--provider; --prompt is ignored in workflow mode. Native-7 rows "
             "are pass/fail; openrouter is best-effort, never gating (D-03).",
    )
    parser.add_argument(
        "--forced-emit",
        dest="forced_emit",
        action="store_true",
        help="Run the FORCED-EMIT row type (Phase 122 MP-03) instead of the "
             "Deep-mode prompt matrix: per provider x {EASY, HARD} schema, drive "
             "the REAL forced_emit recovery ladder (Plan 122-02) directly (NOT via "
             "body.model — Pitfall 6) and score the 4 axes "
             "(trigger/force/recovery/honest_fail) PASS/FAIL/DOCUMENTED. The HARD "
             "schema (optional-heavy + an additionalProperties confidence object) "
             "is the live trip-wire (Pitfall 1) that makes the recovery axis "
             "non-vacuous. Writes a dated forced-emit-scoreboard-<date>.{json,md} "
             "artifact. Combinable with --provider; --prompt/--workflow are ignored. "
             "Native-7 rows gate; openrouter is best-effort, never gating (D-03).",
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
    wf_timeout_s = int(os.getenv("EVAL_WORKFLOW_TIMEOUT_S", DEFAULT_WORKFLOW_TIMEOUT_S))

    # Phase 122 (MP-03): the forced-emit matrix is a DIRECT-CALL harness — it imports
    # forced_emit and drives it per (provider x schema) with NO bearer token / no DB
    # connection / no agent run (it never WRITES anything). The localhost gate above
    # has already fired; jump straight to the matrix. Native-7 gates; openrouter is
    # best-effort (D-122-07). --prompt / --workflow are ignored in this mode.
    if args.forced_emit:
        print(
            f"Running FORCED-EMIT rows (real forced_emit ladder, EASY+HARD schema): "
            f"{len(providers)} provider(s) — direct-call (no backend HTTP / no DB writes).\n"
        )
        return run_forced_emit_matrix(args, providers)

    if args.workflow:
        print(
            f"Running WORKFLOW rows ('{WORKFLOW_SLUG}' 5-type): "
            f"{len(providers)} provider(s) against {base_url()} "
            f"(per-run timeout {wf_timeout_s}s).\n"
        )
    else:
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

    if args.workflow:
        # EVAL-01 workflow row type — Deep-mode matrix below stays untouched.
        return _run_workflow_matrix(args, token, conn, providers, wf_timeout_s)

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
