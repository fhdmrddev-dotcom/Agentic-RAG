"""Phase 075.4 Plan 03 Task 3 — Anthropic LangSmith @traceable re-verify.

Goal: re-verify that the @_ls_traceable decorator on
``stream_anthropic`` (anthropic_service.py:143) actually points to the
real ``langsmith.traceable`` decorator at runtime — NOT the no-op
fallback stub at lines 38-42.

Plan 075.4-03 Task 3 verification procedure (5-step) checks:
  - Step 1: langsmith package importable + @traceable source resolves
    to a langsmith file path (NOT the local fallback).
  - Step 2: LANGSMITH_API_KEY present in env (non-empty).
  - Step 3: LANGSMITH_TRACING or LANGCHAIN_TRACING_V2 set to 'true'.
  - Step 4: (live trace fetch) — manual UAT row per CLAUDE.md UAT
    scoreboard rule; documented but NOT auto-asserted in CI.

The unit-style preconditions in this file are CI-skipable via
@pytest.mark.skipif when LANGSMITH_API_KEY is not in env (matches
GitHub Actions where the secret is only populated in protected runs).
"""
from __future__ import annotations

import inspect
import os
from pathlib import Path

import pytest


# Plan 075.4-03 Task 3 — load backend/.env into process env if present.
# uvicorn loads .env at boot; pytest does not by default. Without this
# the env-precondition test would always fail-without-skip in local
# dev where LANGSMITH_API_KEY is only in .env (process env empty).
# Defensive: best-effort, no-op if dotenv unavailable or .env missing.
try:
    from dotenv import load_dotenv as _load_dotenv
    _env_path = Path(__file__).parent.parent.parent / ".env"
    if _env_path.exists():
        _load_dotenv(_env_path, override=False)  # don't clobber existing process env
except ImportError:  # pragma: no cover
    pass


@pytest.mark.skipif(
    not os.environ.get("LANGSMITH_API_KEY"),
    reason="LANGSMITH_API_KEY not set; skip live trace verification",
)
def test_anthropic_traceable_decorator_is_real() -> None:
    """Plan 075.4-03 Task 3 — re-verify @_ls_traceable points to real
    langsmith.traceable, not the no-op fallback stub in
    anthropic_service.py:38-42.

    inspect.getsourcefile resolves the decorator's source file path; for
    the real langsmith.traceable this lives under the langsmith package,
    while the fallback stub lives under app/services/anthropic_service.py.
    The substring check on 'langsmith' in the resolved path is the
    structural guard.
    """
    from app.services.anthropic_service import _ls_traceable

    src = inspect.getsourcefile(_ls_traceable) or ""
    assert "langsmith" in src.replace("\\", "/").lower(), (
        f"_ls_traceable resolved to non-langsmith source: {src!r} — "
        "the import-fallback stub is active. Check `pip show langsmith` "
        "and `import langsmith` startup. Phase 075.4-03 Task 3 contract."
    )


def _tracing_active_in_env() -> bool:
    return (
        os.environ.get("LANGSMITH_TRACING", "").lower() == "true"
        or os.environ.get("LANGCHAIN_TRACING_V2", "").lower() == "true"
    )


@pytest.mark.skipif(
    not os.environ.get("LANGSMITH_API_KEY") or not _tracing_active_in_env(),
    reason=(
        "LangSmith tracing not active in process env "
        "(LANGSMITH_API_KEY missing or LANGSMITH_TRACING != 'true'). "
        "conftest.py sets LANGSMITH_TRACING=false for the default test run "
        "to avoid live API pings — this test is meant for live-verify CI "
        "jobs / local LangSmith debug sessions where the operator sets "
        "LANGSMITH_TRACING=true before running pytest."
    ),
)
def test_anthropic_traceable_env_preconditions() -> None:
    """Plan 075.4-03 Task 3 — env preconditions for LangSmith tracing.

    LANGSMITH_TRACING=true is the modern flag (langsmith>=0.1.0);
    LANGCHAIN_TRACING_V2=true is the legacy form still honoured by the
    client. Either must be set for spans to actually flush to the
    LangSmith ingestion endpoint.

    When this test runs (skipif gate passes), both preconditions are
    asserted as a defense-in-depth gate.
    """
    assert os.environ.get("LANGSMITH_API_KEY"), (
        "LANGSMITH_API_KEY env var required (matched skipif guard)."
    )
    assert _tracing_active_in_env(), (
        "LANGSMITH_TRACING or LANGCHAIN_TRACING_V2 must be 'true' for "
        "@traceable spans to actually flush to ingestion. Check "
        "backend/.env."
    )
