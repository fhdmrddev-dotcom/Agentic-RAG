"""BUG-261031-04 — LIVE: every MCP call keeps its ONE audit row under concurrency.

The 2026-10-31 burst (32 concurrent ``tools/call`` on one key, limit 30/min) answered 30 calls and
refused 2, wrote all 60 ``mcp_usage`` rows (asyncpg) and **zero** ``audit_log`` rows. The audit row
went through two threadpool hops (a fresh supabase-py client per row, then a PostgREST insert)
inside dispatch's 5 s shielded bound. Built per row, the client costs ~0.19 s of GIL-held work, so
N concurrent rows queue for ~N x 0.2-0.4 s: the bound fired before the insert hop started and the
row was cancelled with no log line (measured in-process: N=30 -> 30 bounds fired, 0 rows).

Here ``CONCURRENCY`` calls go through the REAL ``dispatch`` (limits on a fake Redis, the real
refusal throttle, the real audit seam) against the local database, with a per-row client build
exactly as production does it (``create_client`` per call) and the bound tightened (``BOUND_S``). Nothing in the
audit path is stubbed. Exactly one row per call must land: 30 ``api_key.read`` + the one refusal row
the CR-02 throttle writes (the second refusal is COUNTED, not written).

Holds the local-DB lock (it writes audit rows, deleted in teardown). ⛔ No role-``anon`` statement
(BUG-261031-01).
"""
from __future__ import annotations

import asyncio
from dataclasses import replace
from uuid import uuid4

import asyncpg
import pytest

import app.dependencies as deps
from app.models.user_settings import _build_settings_from_row
from app.security import api_key_auth
from app.services import rate_limit
from tests.integration._271_gotrue_users import _admin
from tests.integration._305_live import mcp_world
from tests.integration._rls_harness import PG_TEST_DSN, requires_pg
from tests.unit import _mcp305_harness as h
from tests.unit.phase293_inbound_fakes import FakeRedis

pytestmark = requires_pg

CONCURRENCY = 32
READS_PER_MINUTE = 30
# The rerank-loaded production burst held every call ~70 s, so its 30 audit rows all queued behind
# one another at once. Without that load the same 32-row burst queues ~6 s of serialized client
# builds, so the bound is tightened in proportion (production: 5 s) to put this burst where that one
# was: past the bound before the insert started. The asyncpg write lands in milliseconds either way.
BOUND_S = 2.0


@pytest.fixture
async def pool(monkeypatch):
    p = await asyncpg.create_pool(PG_TEST_DSN, min_size=0, max_size=10, init=deps._init_pg_connection)
    monkeypatch.setattr(deps, "_pg_pool", p)
    try:
        yield p
    finally:
        await p.close()


async def test_concurrent_calls_each_write_exactly_one_audit_row(pool, monkeypatch):
    import app.mcp.dispatch as dispatch_mod
    import app.mcp.tools as tools

    async def _knobs():
        return _build_settings_from_row({"api_key_reads_per_minute": READS_PER_MINUTE})

    async def _pii_off(org_id):
        return False

    async def ok(principal, args):
        return h.text_result("ran")

    monkeypatch.setattr(rate_limit, "load_app_settings_async", _knobs)
    monkeypatch.setattr(dispatch_mod, "_pii_on", _pii_off)
    monkeypatch.setattr(dispatch_mod, "BOOKKEEPING_DEADLINE_S", BOUND_S)
    # The production shape of the 293 writer: a NEW service-role client for every row.
    monkeypatch.setattr(api_key_auth, "get_service_role_supabase", lambda org: _admin())
    monkeypatch.setitem(tools.REGISTERED, "t_read", h.make_spec("t_read", ok))

    async with mcp_world(pool) as w:
        key_id = str(uuid4())
        principal = replace(h.PRINCIPAL, key_id=key_id, user_id=w.user, org_id=w.org,
                            label="305 concurrency", tools=("t_read",))
        redis = FakeRedis()
        outs = await asyncio.gather(*(
            dispatch_mod.dispatch(principal, "t_read", {}, redis=redis) for _ in range(CONCURRENCY)
        ))
        await asyncio.sleep(1.0)  # an abandoned thread hop gets its chance to land anyway
        rows = await pool.fetch(
            "SELECT action_type, metadata, org_id FROM public.audit_log "
            "WHERE metadata->>'api_key_id' = $1", key_id,
        )

    answered = sum(1 for o in outs if o.is_error is not True)
    refused = CONCURRENCY - answered
    assert (answered, refused) == (READS_PER_MINUTE, CONCURRENCY - READS_PER_MINUTE)
    kinds = sorted(r["action_type"] for r in rows)
    assert kinds.count("api_key.read") == READS_PER_MINUTE, (
        f"{kinds.count('api_key.read')}/{READS_PER_MINUTE} answered calls kept their audit row"
    )
    assert kinds.count("api_key.refused") == 1, kinds  # CR-02: the second refusal is counted
    assert all(str(r["org_id"]) == w.org for r in rows)
    assert all(r["metadata"]["tool"] == "t_read" and r["metadata"]["kind"] == "mcp" for r in rows)
