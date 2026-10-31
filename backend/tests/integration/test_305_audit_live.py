"""Phase 305-03 (KEY-07; D-26 / D-28 / D-53 / D-54; T-305-12 / T-305-28) — the audit row, live.

A real minted key on the real ``/mcp`` path in-process (``phase305_mcp_client``), against the 304
two-org world, with the local stack's service-role client handed to the audit writer (the unit
conftest points ``settings`` at a placeholder project):

* one ``list_documents`` call writes EXACTLY ONE ``audit_log`` row in the key's org:
  ``api_key.read`` with metadata ``{kind: mcp, tool: list_documents, outcome: ok}``;
* with the searches knob set to 1 THROUGH ``app_settings`` (restored in ``finally``), the second
  search is refused with the relayable sentence and writes ``api_key.refused`` with reason
  ``rate_limited:expensive`` — and the key's activity readback (``list_key_calls`` ->
  ``_call_from_audit``, the composition ``GET /api-keys`` serves) shows that call ``ok: false``
  with tool ``search_knowledge_base``.

Run with ``-rs``: a skip is NOT RUN, never a pass. Holds the local-DB lock (it writes app_settings).
⛔ No role-``anon`` statement (BUG-261031-01).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

import pytest

from app.api import api_keys as route
from app.db import api_keys as api_keys_db
from app.mcp import read_tools
from app.models.user_settings import invalidate_settings_cache
from app.security import api_key_auth
from tests.integration._271_gotrue_users import _admin
from tests.integration._rls_harness import requires_pg
from tests.integration.phase304_fixtures import (  # noqa: F401 — `world` is a fixture
    patch_search,
    search_settings,
    world,
)
from tests.integration.phase305_mcp_client import mcp_session

pytestmark = requires_pg


@pytest.fixture
def audited(world, monkeypatch):
    patch_search(monkeypatch, world)
    monkeypatch.setattr(read_tools, "load_user_settings", lambda _uid: search_settings())
    monkeypatch.setattr(api_key_auth, "get_service_role_supabase", lambda org: _admin())
    return world


async def _key_id(pool, user_id: str) -> str:
    return str(await pool.fetchval(
        "SELECT id FROM public.api_keys WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
        UUID(user_id),
    ))


async def _rows(pool, key_id: str) -> list[dict]:
    rows = await pool.fetch(
        "SELECT action_type, metadata, org_id FROM public.audit_log "
        "WHERE metadata->>'api_key_id' = $1 ORDER BY created_at",
        key_id,
    )
    return [dict(r) for r in rows]


async def test_one_list_documents_call_writes_exactly_one_read_row(audited, monkeypatch):
    w = audited
    secret = await w.mint(label="305-03 audit laptop")
    key_id = await _key_id(w.pool, w.u)
    async with mcp_session(monkeypatch, secret) as call:
        reply = await call.tool("list_documents", {})
    assert not reply.is_error, reply.text
    rows = await _rows(w.pool, key_id)
    assert len(rows) == 1, rows
    row = rows[0]
    assert row["action_type"] == "api_key.read"
    assert str(row["org_id"]) == w.x
    md = row["metadata"]
    assert {k: md.get(k) for k in ("kind", "tool", "outcome", "call", "api_key_label")} == {
        "kind": "mcp", "tool": "list_documents", "outcome": "ok", "call": "read",
        "api_key_label": "305-03 audit laptop",
    }


async def test_an_over_limit_search_is_refused_audited_and_reads_as_not_ok(audited, monkeypatch):
    w = audited
    before = await w.pool.fetchval("SELECT api_key_searches_per_minute FROM public.app_settings LIMIT 1")
    assert before is not None
    await w.pool.execute("UPDATE public.app_settings SET api_key_searches_per_minute = 1")
    invalidate_settings_cache()
    try:
        secret = await w.mint(label="305-03 limited laptop")
        key_id = await _key_id(w.pool, w.u)
        async with mcp_session(monkeypatch, secret) as call:
            first = await call.tool("search_knowledge_base", {"query": w.tok_x})
            second = await call.tool("search_knowledge_base", {"query": w.tok_x})
    finally:
        await w.pool.execute("UPDATE public.app_settings SET api_key_searches_per_minute = $1", before)
        invalidate_settings_cache()
    assert not first.is_error, first.text
    assert second.is_error
    assert second.text.startswith("This key has made too many searches in the last minute. Try again in ")

    rows = await _rows(w.pool, key_id)
    assert [r["action_type"] for r in rows] == ["api_key.read", "api_key.refused"], rows
    refused = rows[1]["metadata"]
    assert refused["reason"] == "rate_limited:expensive"
    assert refused["tool"] == "search_knowledge_base"
    assert refused["detail"] == {"limit": 1}
    assert w.tok_x not in str(rows), "query text reached the audit log"

    calls = await api_keys_db.list_key_calls(
        w.pool, org_id=UUID(w.x), key_ids=[key_id],
        since=datetime.now(timezone.utc) - timedelta(days=1),
    )
    readback = [route._call_from_audit(r, {}) for r in calls]  # newest first
    assert [(c.ok, c.tool) for c in readback] == [
        (False, "search_knowledge_base"), (True, "search_knowledge_base"),
    ]
    assert readback[0].reason == "rate_limited:expensive"
