"""293-REVIEW WR-02 — each key's recent calls are its OWN most recent N, not a share of 600.

``list_key_calls`` used to apply ``ORDER BY created_at DESC LIMIT 600`` across every key in the
list, and only then did the route cut each key to 50. One integration polling twice a second
fills 600 rows in about five minutes, after which every other key in the member's list (or the
admin's org list) showed no recent calls at all, refusals included.

Driven against real Postgres in a throwaway schema (no tenant table is touched; skipped when
Postgres is unreachable): a busy key with 650 newer rows and a quiet key with 2 older ones.
"""
from __future__ import annotations

import asyncio
import json
import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.db import api_keys as db

_DSN = os.getenv("POSTGRES_DSN", "postgresql://postgres:postgres@127.0.0.1:54322/postgres")
ORG = uuid.UUID("44444444-4444-4444-8444-444444444444")
BUSY = str(uuid.UUID("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"))
QUIET = str(uuid.UUID("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"))

_DDL = """
CREATE TABLE audit_log (
    id bigserial PRIMARY KEY,
    org_id uuid NOT NULL,
    action_type text NOT NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);
"""


@pytest.fixture
async def live_pool():
    asyncpg = pytest.importorskip("asyncpg")
    schema = f"wr02_test_{uuid.uuid4().hex[:12]}"
    try:
        admin = await asyncio.wait_for(asyncpg.connect(_DSN), timeout=5)
    except Exception as exc:  # noqa: BLE001
        pytest.skip(f"Postgres unavailable at {_DSN}: {exc!r}")
    try:
        await admin.execute(f"CREATE SCHEMA {schema}")
        await admin.execute(f"SET search_path TO {schema}")
        await admin.execute(_DDL)
    finally:
        await admin.close()

    async def _init(conn):
        await conn.set_type_codec(
            "jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog"
        )

    pool = await asyncpg.create_pool(
        _DSN, min_size=1, max_size=2, init=_init, server_settings={"search_path": schema},
    )
    try:
        yield pool
    finally:
        await pool.close()
        cleanup = await asyncpg.connect(_DSN)
        try:
            await cleanup.execute(f"DROP SCHEMA {schema} CASCADE")
        finally:
            await cleanup.close()


async def _seed(pool, key_id: str, n: int, *, newest: datetime) -> None:
    await pool.execute(
        "INSERT INTO audit_log (org_id, action_type, metadata, created_at) "
        "SELECT $1, 'api_key.read', jsonb_build_object('api_key_id', $2::text, 'call', 'read'), "
        "$3::timestamptz - make_interval(secs => g) FROM generate_series(1, $4) AS g",
        ORG, key_id, newest, n,
    )


async def test_a_busy_key_never_hides_a_quiet_keys_calls(live_pool):
    now = datetime.now(timezone.utc)
    await _seed(live_pool, QUIET, 2, newest=now - timedelta(hours=2))
    await _seed(live_pool, BUSY, 650, newest=now)

    rows = await db.list_key_calls(
        live_pool, org_id=ORG, key_ids=[BUSY, QUIET], since=now - timedelta(days=30)
    )
    by_key: dict[str, int] = {}
    for r in rows:
        kid = r["metadata"]["api_key_id"]
        by_key[kid] = by_key.get(kid, 0) + 1
    assert by_key.get(QUIET) == 2, by_key
    assert by_key.get(BUSY) == 50, by_key
    # still newest first across the whole answer
    stamps = [r["created_at"] for r in rows]
    assert stamps == sorted(stamps, reverse=True)
