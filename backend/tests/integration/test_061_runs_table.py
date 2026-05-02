"""SC#5 + SC#5b: runs row INSERT/UPDATE shape and RLS policy presence.

Phase 061 (D-061-05..09 lifecycle columns + D-061-08 RLS policy).
"""
import re
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

import httpx
import pytest
from httpx import ASGITransport

from app.dependencies import get_supabase
from app.main import app
from app.services.openai_service import CallingMode

# IN-01 (D-061.1-11): import shared helpers directly from _run_helpers.
from tests.integration._run_helpers import (  # noqa: E402
    _build_mock_supabase,
    _fast_chunks,
    await_producer_finalized,
)
from tests.integration.test_059_disconnect import (  # noqa: E402
    _reset_sse_starlette_app_status,
)

THREAD_A = str(uuid4())


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_runs_lifecycle_row():
    """SC#5: runs row INSERT (status='streaming') + UPDATE (status terminal)."""
    mock_supabase = _build_mock_supabase()
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        with patch(
            "app.api.threads.create_adaptive_streaming_chat",
            return_value=(iter(_fast_chunks()), CallingMode.NATIVE),
        ), patch(
            "app.services.suggestion_service.generate_suggestions",
            return_value=([], None),
        ), patch(
            "app.api.threads.generate_thread_title",
            return_value=("T", None),
        ):
            async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                async with c.stream(
                    "POST",
                    f"/threads/{THREAD_A}/messages",
                    json={"content": "hello"},
                    headers={"Authorization": "Bearer test-token"},
                    timeout=30.0,
                ) as r:
                    async for _line in r.aiter_lines():
                        pass

            # D-061.1-01: deterministic await for _shielded_finalize completion
            await await_producer_finalized(mock_supabase)

            runs_builder = mock_supabase.table("runs")

            # Exactly one INSERT with status='streaming'
            insert_calls = runs_builder.insert.call_args_list
            assert len(insert_calls) >= 1, (
                f"Expected ≥1 runs INSERT; got {len(insert_calls)}"
            )
            insert_payload = (
                insert_calls[0].args[0]
                if insert_calls[0].args
                else insert_calls[0].kwargs.get("data", {})
            )
            assert insert_payload.get("status") == "streaming", insert_payload

            # At least one UPDATE with terminal status
            update_calls = runs_builder.update.call_args_list
            terminal = {"completed", "failed", "cancelled"}
            terminal_updates = [
                c for c in update_calls
                if (
                    c.args
                    and isinstance(c.args[0], dict)
                    and c.args[0].get("status") in terminal
                )
            ]
            assert terminal_updates, (
                f"Expected ≥1 terminal-status UPDATE; got {update_calls}"
            )
    finally:
        app.dependency_overrides.pop(get_supabase, None)


def test_rls_policy_present_in_full_schema():
    """SC#5b (deviation): RLS policy DDL is present in supabase/full-schema.sql.

    PATTERNS.md No-Analog table line 1120 + this plan's deviation note:
    Plan 05 does not introduce a real-Supabase dual-user test substrate.
    Instead we verify the RLS policy DDL is present in the regenerated
    bootstrap artifact (Plan 02 Task 2 ran the regen). RLS enforcement
    itself is also verified live by Plan 02's [BLOCKING] schema-push
    check (queries pg_policies after push).
    """
    repo_root = Path(__file__).parents[3]   # backend/tests/integration -> repo
    full_schema = (repo_root / "supabase" / "full-schema.sql").read_text(encoding="utf-8")
    assert "CREATE POLICY runs_select_own" in full_schema, (
        "D-061-08 RLS policy missing from supabase/full-schema.sql — "
        "did Plan 02 run `bash scripts/regenerate-full-schema.sh`?"
    )
    assert "auth.uid() = user_id" in full_schema, "RLS USING clause missing"
    # Defense-in-depth: assert no INSERT/UPDATE/DELETE policies exist for runs
    # (D-061-08: SELECT-only; service-role bypasses for writes)
    bad_policies = re.findall(
        r"CREATE POLICY\s+\w+\s+ON\s+(?:public\.)?runs\s+FOR\s+(INSERT|UPDATE|DELETE)",
        full_schema,
        re.IGNORECASE,
    )
    assert not bad_policies, (
        f"Unexpected INSERT/UPDATE/DELETE policies on runs: {bad_policies}"
    )
