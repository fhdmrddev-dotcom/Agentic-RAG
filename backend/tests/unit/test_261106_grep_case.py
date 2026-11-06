"""BUG-261106-05 (tester report BUG-32) — Explorer grep was case-sensitive with no option.

HR-25 ("Which documents mention probation?", production 2026-11-06) found 5 of 7 documents:
each role profile contains only "Probation", and ``grep_path`` matched with Postgres ``~``.
Grep is now case-insensitive by default (``~*``), with an explicit ``case_sensitive`` option,
and the result says which mode ran.
"""

from __future__ import annotations

import asyncio
import json
import os
from contextlib import asynccontextmanager
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

_DSN = os.environ.get("POSTGRES_DSN", "postgresql://postgres:postgres@127.0.0.1:54322/postgres")
USER = "00000000-0000-0000-0000-000000000001"


def _capture():
    seen: dict = {}

    @asynccontextmanager
    async def _cm(request, current_user):
        conn = MagicMock()

        async def _fetchval(sql, inner_sql):
            seen["sql"] = inner_sql
            return []

        conn.fetchval = _fetchval
        yield conn

    return seen, patch("app.api.kb.get_user_pg_connection", _cm)


@pytest.mark.asyncio
async def test_grep_is_case_insensitive_by_default():
    from app.api.kb import grep_path

    seen, p = _capture()
    with p:
        result = await grep_path("probation", None, USER, MagicMock())
    assert "full_markdown ~* 'probation'" in seen["sql"]
    assert result["case_sensitive"] is False


@pytest.mark.asyncio
async def test_case_sensitive_is_an_explicit_choice():
    from app.api.kb import grep_path

    seen, p = _capture()
    with p:
        result = await grep_path("Probation", None, USER, MagicMock(), case_sensitive=True)
    assert "full_markdown ~ 'Probation'" in seen["sql"]
    assert "~*" not in seen["sql"]
    assert result["case_sensitive"] is True


@pytest.mark.asyncio
async def test_HR_25_the_built_query_finds_capitalised_mentions():
    """The exact SQL grep_path builds, run against a session TEMP ``documents`` table in real
    Postgres (temp tables shadow ``public``): the three role profiles say only "Probation"."""
    import asyncpg

    from app.api.kb import grep_path

    try:
        conn = await asyncio.wait_for(asyncpg.connect(_DSN), timeout=2.0)
    except Exception:  # noqa: BLE001
        pytest.skip(f"local Postgres not reachable on {_DSN}")
    try:
        await conn.execute(
            "CREATE TEMP TABLE documents (id int, filename text, folder_id uuid, full_markdown text)"
        )
        await conn.execute(
            "INSERT INTO documents VALUES"
            " (1, 'Role Profile - HVAC Technician (G2).pdf', NULL, '| Probation | 3 months, review week 11 |'),"
            " (2, 'HR-POL-001 Employee Handbook v4.0.pdf', NULL, 'Every new employee completes a probation period'),"
            " (3, 'Aldara FM Company Profile.pdf', NULL, 'Founded in 2014')"
        )
        found = {}
        for mode in (False, True):
            seen, p = _capture()
            with p:
                await grep_path("probation", None, USER, MagicMock(), case_sensitive=mode)
            found[mode] = sorted(r["filename"] for r in await conn.fetch(seen["sql"]))
        assert found[False] == [
            "HR-POL-001 Employee Handbook v4.0.pdf",
            "Role Profile - HVAC Technician (G2).pdf",
        ]
        assert found[True] == ["HR-POL-001 Employee Handbook v4.0.pdf"]
    finally:
        await conn.close()


def test_the_agent_tool_gets_case_insensitive_search_through_the_default():
    """The agent's grep handler and its schema are pinned byte-identical by the phase-278 fences
    (test_278_pure_move / test_278_registry_pin), so the fix lives in ``grep_path``'s default:
    the unchanged handler, calling it with no case argument, now matches case-insensitively."""
    from app.services.tools import documents as td

    seen, p = _capture()
    ctx = SimpleNamespace(scoped_folder_path=None, current_user={"id": USER}, supabase=MagicMock(),
                          folder_subtree_ids=None)
    with p, patch.object(td, "_scope_set", lambda _ctx: None):
        out = asyncio.run(td._handle_grep({"pattern": "probation"}, ctx))
    assert "full_markdown ~* 'probation'" in seen["sql"]
    assert json.loads(out.result)["case_sensitive"] is False


def test_the_rest_route_reports_the_mode():
    from app.models.kb import GrepResponse

    r = GrepResponse(pattern="x", path=None, matches=[], total=0, case_sensitive=True)
    assert r.case_sensitive is True
    assert GrepResponse(pattern="x", path=None, matches=[], total=0).case_sensitive is False
