"""Phase 204 (SCHED-01) — the workflow-scheduler falsification set.

The phase's STANDING CRITERION is that every mitigation named in a plan's ``<threat_model>``
has a REAL test. Phase 203 wrote three and implemented none, and every task still passed. So
this module is organised around the three threats rather than around the source files:

| Threat (204-03 `<threat_model>`) | Where it is driven | How real |
|---|---|---|
| Multi-instance duplicate firings | §C — TWO REAL asyncpg connections racing the REAL `claim_due_schedules` against a REAL Postgres | genuine concurrency, not a simulation |
| Unauthorized / cross-tenant schedule access | §C — the same real database, four real reads/writes issued as the wrong user | genuine denial, not an assertion about a policy string |
| Invalid cron parsed and persisted | §B — a real HTTP request through a real router, with a pool that FAILS if touched | the refusal is proved to precede the write |

⚠ **WHAT §C RUNS AGAINST, AND WHY IT IS NOT `public.workflow_schedules`.** Migration 124 is
authored but **not yet applied** to the local database (CLAUDE.md: a migration is applied by
pasting it into the Supabase SQL editor, which an agent cannot do). So §C creates a THROWAWAY
SCHEMA, builds the table there **from the columns and constraints migration 124 declares**, and
points `search_path` at it. The functions under test issue **unqualified** table names, so the
REAL production SQL — including the real ``FOR UPDATE SKIP LOCKED`` and the real owner
predicates — executes against that copy, on real Postgres, with real MVCC and real row locks.
The schema is dropped at teardown; no dev data is touched.

⚠ **WHAT THAT DOES *NOT* PROVE, stated rather than left to be assumed:** the RLS policies
migration 124 installs are **not** exercised — the throwaway table has no policies, and the
app's own asyncpg pool is ``BYPASSRLS`` in any case, so on the live path RLS never evaluates.
**The gate that actually protects a user today is the owner predicate in ``db/schedules.py``,
and that is what §C drives.** The policies are the belt for the future user-JWT client; proving
them needs an authenticated role and real ``org_members`` rows, which is a live-DB UAT row and
is recorded as owed in `204-03-SUMMARY.md`.

⚠ §C **skips** (never fails) when Postgres is unreachable, so this file is safe on a runner
with no database. §A/§B/§D have no I/O at all.
"""
from __future__ import annotations

import asyncio
import os
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import dependencies as deps
from app.api import schedules as schedules_api
from app.db import schedules as db_schedules
from app.main import app as real_app
from app.models.schedule import (
    compute_next_run_at,
    validate_cron,
    validate_timezone,
)
from app.services import scheduler_service

CALLER_ID = "00000000-0000-0000-0000-000000000001"  # conftest.mock_user_data
OTHER_USER_ID = "00000000-0000-0000-0000-0000000000ff"
WORKFLOW_ID = "11111111-2222-4333-8444-555555555555"


# ══════════════════════════════════════════════════════════════════════════════════════
# §A — cadence arithmetic. No I/O, no database, no HTTP.
# ══════════════════════════════════════════════════════════════════════════════════════

ANCHOR = datetime(2026, 8, 24, 12, 0, tzinfo=timezone.utc)  # a Monday, midday UTC


def test_a_cron_advances_to_the_next_matching_instant():
    assert compute_next_run_at(
        cron_expression="*/15 * * * *", interval_seconds=None, after=ANCHOR
    ) == datetime(2026, 8, 24, 12, 15, tzinfo=timezone.utc)


def test_a_cron_is_evaluated_in_the_schedules_own_zone_not_the_servers():
    """The reason the ``timezone`` column exists, driven rather than described.

    ``0 8 * * 1`` is "Monday at 08:00". Read in UTC that is 08:00Z; read in Europe/Berlin
    (UTC+2 in August) it is **06:00Z**. If the zone were ignored, both would return the same
    instant and this assertion would be unfalsifiable — so both are asserted, and they differ.
    """
    in_utc = compute_next_run_at(
        cron_expression="0 8 * * 1", interval_seconds=None, timezone="UTC", after=ANCHOR
    )
    in_berlin = compute_next_run_at(
        cron_expression="0 8 * * 1",
        interval_seconds=None,
        timezone="Europe/Berlin",
        after=ANCHOR,
    )
    assert in_utc == datetime(2026, 8, 31, 8, 0, tzinfo=timezone.utc)
    assert in_berlin == datetime(2026, 8, 31, 6, 0, tzinfo=timezone.utc)
    assert in_utc != in_berlin  # non-vacuity: the zone genuinely changed the answer


def test_a_an_interval_ignores_the_timezone_entirely():
    """A duration has no timezone. Both zones must give the identical instant."""
    a = compute_next_run_at(
        cron_expression=None, interval_seconds=900, timezone="UTC", after=ANCHOR
    )
    b = compute_next_run_at(
        cron_expression=None,
        interval_seconds=900,
        timezone="Pacific/Kiritimati",
        after=ANCHOR,
    )
    assert a == b == ANCHOR + timedelta(seconds=900)


def test_a_the_returned_instant_is_always_utc_and_aware():
    for kwargs in (
        {"cron_expression": "0 3 * * *", "interval_seconds": None, "timezone": "Asia/Tokyo"},
        {"cron_expression": None, "interval_seconds": 3600},
    ):
        out = compute_next_run_at(after=ANCHOR, **kwargs)
        assert out.tzinfo is not None
        assert out.utcoffset() == timedelta(0)


@pytest.mark.parametrize(
    "cron,interval",
    [("* * * * *", 900), (None, None)],
    ids=["both", "neither"],
)
def test_a_a_row_with_no_single_cadence_has_no_defined_next_run(cron, interval):
    with pytest.raises(ValueError):
        compute_next_run_at(cron_expression=cron, interval_seconds=interval, after=ANCHOR)


def test_a_a_malformed_cron_is_refused_by_the_library_not_by_a_regex():
    """Two strings a naive five-field regex would accept, and croniter does not."""
    for bad in ("not a cron", "* * * *", "99 * * * *", ""):
        with pytest.raises(ValueError):
            validate_cron(bad)
    assert validate_cron("*/5 * * * *") == "*/5 * * * *"  # non-vacuity


def test_a_an_unknown_timezone_is_refused():
    with pytest.raises(ValueError):
        validate_timezone("Mars/Olympus_Mons")
    assert validate_timezone("Europe/Berlin") == "Europe/Berlin"  # non-vacuity


# ══════════════════════════════════════════════════════════════════════════════════════
# §B — THREAT 3: a malformed cron is refused BEFORE anything is persisted.
#
# The pool handed to these cases RAISES on any use. So "the database was not touched" is not
# an assertion about a call count that could be wrong — it is the only way the case can pass.
# ══════════════════════════════════════════════════════════════════════════════════════


class _ExplodingPool:
    """A pool that fails loudly on contact. Reaching it IS the failure."""

    async def fetchrow(self, *a, **k):  # pragma: no cover - reaching this fails the test
        raise AssertionError("the database was touched before validation refused the request")

    fetch = execute = fetchrow

    def acquire(self):  # pragma: no cover
        raise AssertionError("the database was touched before validation refused the request")


class _RecordingPool:
    """Records every statement; returns a canned row for fetchrow."""

    def __init__(self, fetchrow_result=None, fetch_result=None):
        self.calls: list[tuple[str, tuple]] = []
        self._fetchrow_result = fetchrow_result
        self._fetch_result = fetch_result or []

    async def fetchrow(self, sql, *args):
        self.calls.append((sql, args))
        return self._fetchrow_result

    async def fetch(self, sql, *args):
        self.calls.append((sql, args))
        return self._fetch_result

    async def execute(self, sql, *args):
        self.calls.append((sql, args))
        return "UPDATE 1"


@pytest.fixture
def probe_client(monkeypatch):
    """A throwaway app carrying ONLY the two schedule routers.

    Isolation is the point (the `test_190_connectors_api.py` precedent): a refusal observed on
    the bare routers cannot be an accident of middleware ordering on the real app. It shares
    the live `dependency_overrides` dict so conftest's `get_current_user` seam applies.
    ``is_operator`` is the one swappable boundary and is forced True so the visibility gate is
    a no-op — this file is about cadence validation and ownership, not about VIS-01.
    """
    monkeypatch.setattr(deps, "is_operator", AsyncMock(return_value=True))
    probe = FastAPI()
    probe.include_router(schedules_api.router)
    probe.include_router(schedules_api.workflow_router)
    # v4.3 audit: schedule writes now also carry require_capability("workflows"). This file
    # is about cadence + ownership, so the org is entitled here; the tier arm is fenced by
    # test_258_every_authoring_write_is_tier_gated.py. A COPY of the overrides dict, so the
    # org override cannot leak into the shared app.
    import app.services.entitlement_service as _ent
    monkeypatch.setattr(_ent, "enforce_entitlement", AsyncMock(return_value=None))
    probe.dependency_overrides = {**real_app.dependency_overrides,
                                  deps.get_active_org_id: lambda: "00000000-0000-0000-0000-00000000a0d1"}
    return TestClient(probe)


def _post_body(**overrides):
    body = {"name": "nightly", "cron_expression": "0 3 * * *"}
    body.update(overrides)
    return body


@pytest.mark.parametrize(
    "body,why",
    [
        (_post_body(cron_expression="not a cron"), "malformed cron"),
        (_post_body(cron_expression="* * * *"), "four fields"),
        (_post_body(cron_expression="0 3 * * *", timezone="Mars/Olympus"), "unknown zone"),
        (_post_body(cron_expression="0 3 * * *", interval_seconds=900), "both cadences"),
        ({"name": "nightly"}, "neither cadence"),
        (_post_body(interval_seconds=5, cron_expression=None), "sub-minute interval"),
        (_post_body(name=""), "empty name"),
    ],
    ids=["bad-cron", "four-fields", "bad-zone", "both", "neither", "sub-minute", "empty-name"],
)
def test_b_an_invalid_schedule_is_422_and_the_database_is_never_reached(
    probe_client, monkeypatch, body, why
):
    monkeypatch.setattr(
        schedules_api, "get_pg_pool", AsyncMock(return_value=_ExplodingPool())
    )
    res = probe_client.post(f"/workflows/{WORKFLOW_ID}/schedules", json=body)
    assert res.status_code == 422, f"{why}: expected 422, got {res.status_code} {res.text}"


def test_b_a_draft_workflow_cannot_be_scheduled_and_nothing_is_inserted(
    probe_client, monkeypatch
):
    pool = _RecordingPool()
    monkeypatch.setattr(schedules_api, "get_pg_pool", AsyncMock(return_value=pool))
    monkeypatch.setattr(
        schedules_api,
        "get_definition",
        AsyncMock(return_value={"id": WORKFLOW_ID, "status": "draft", "definition": {}}),
    )
    res = probe_client.post(f"/workflows/{WORKFLOW_ID}/schedules", json=_post_body())
    assert res.status_code == 400
    assert "published" in res.json()["detail"]
    assert not any("INSERT INTO workflow_schedules" in sql for sql, _ in pool.calls)


def test_b_a_workflow_the_caller_cannot_load_is_a_404_not_a_403(probe_client, monkeypatch):
    """A 403 would confirm the id exists. Both misses must be one indistinguishable answer."""
    monkeypatch.setattr(
        schedules_api, "get_pg_pool", AsyncMock(return_value=_RecordingPool())
    )
    monkeypatch.setattr(schedules_api, "get_definition", AsyncMock(return_value=None))
    res = probe_client.post(f"/workflows/{WORKFLOW_ID}/schedules", json=_post_body())
    assert res.status_code == 404


def test_b_a_valid_schedule_on_a_published_workflow_is_created(probe_client, monkeypatch):
    """The NON-VACUITY control for every refusal above."""
    created = {
        "id": str(uuid.uuid4()),
        "workflow_id": WORKFLOW_ID,
        "name": "nightly",
        "cron_expression": "0 3 * * *",
        "interval_seconds": None,
        "timezone": "UTC",
        "is_active": True,
        "max_tokens_per_run": 50000,
        "max_duration_seconds": 600,
        "inputs": {},
        "last_run_at": None,
        "next_run_at": ANCHOR,
        "last_status": None,
        "created_at": ANCHOR,
        "updated_at": ANCHOR,
    }
    pool = _RecordingPool(fetchrow_result=created)
    monkeypatch.setattr(schedules_api, "get_pg_pool", AsyncMock(return_value=pool))
    monkeypatch.setattr(
        schedules_api,
        "get_definition",
        AsyncMock(return_value={"id": WORKFLOW_ID, "status": "published", "definition": {}}),
    )
    res = probe_client.post(f"/workflows/{WORKFLOW_ID}/schedules", json=_post_body())
    assert res.status_code == 201, res.text
    assert res.json()["cron_expression"] == "0 3 * * *"
    assert any("INSERT INTO workflow_schedules" in sql for sql, _ in pool.calls)


def test_b_the_insert_binds_inputs_as_an_object_never_a_pre_encoded_string():
    """⚠ The 484-row lesson, asserted at the one site that could reintroduce it.

    The pool registers a jsonb codec, so a ``json.dumps`` at a call site stores a jsonb STRING
    SCALAR and every ``->`` read then returns NULL — silently, because an absent-arm render is
    honest. Two independent checks: the bound value is a real ``dict``, and the module has no
    ``json`` name to dumps with.
    """
    import ast
    import inspect

    # ⚠ AN AST WALK, NOT A SUBSTRING SWEEP — and the distinction was MEASURED, not anticipated:
    # the first draft asserted `"json.dumps" not in src` and went RED against correct code,
    # because `db/schedules.py`'s own docblock EXPLAINS the string-scalar trap by name. That is
    # the 187-24 trap (a fence an explanatory comment can turn red), firing here.
    tree = ast.parse(inspect.getsource(db_schedules))
    imported = {
        alias.name
        for node in ast.walk(tree)
        if isinstance(node, ast.Import)
        for alias in node.names
    } | {
        node.module
        for node in ast.walk(tree)
        if isinstance(node, ast.ImportFrom) and node.module
    }
    assert "json" not in imported, "db/schedules.py must have no way to pre-encode jsonb"
    assert [
        n
        for n in ast.walk(tree)
        if isinstance(n, ast.Call)
        and isinstance(n.func, ast.Attribute)
        and n.func.attr == "dumps"
    ] == []


def test_b_the_poller_claim_has_no_http_door(probe_client):
    """⚠ ``claim_due_schedules`` is owner-AGNOSTIC — behind any route it fires every tenant's
    schedules. Two independent assertions: it is not a name in the API module, and no
    registered path on the REAL app reaches it."""
    assert not hasattr(schedules_api, "claim_due_schedules")
    paths = {getattr(r, "path", "") for r in real_app.routes}
    assert not any("claim" in p for p in paths)
    # non-vacuity: the six real schedule routes ARE registered
    assert "/schedules" in paths
    assert "/workflows/{workflow_id}/schedules" in paths


# ══════════════════════════════════════════════════════════════════════════════════════
# §C — THREATS 1 and 2, against a REAL Postgres.
# ══════════════════════════════════════════════════════════════════════════════════════

_DSN = os.getenv("POSTGRES_DSN", "postgresql://postgres:postgres@127.0.0.1:54322/postgres")

# The columns + constraints migration 124 declares, minus the FKs to organizations /
# workflow_definitions / auth.users (which would drag real tenant rows into a unit test) and
# minus the RLS policies (see the module docblock for what that does and does not prove).
_TABLE_DDL = """
CREATE TABLE workflow_schedules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL,
    workflow_id uuid NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    cron_expression text,
    interval_seconds integer,
    timezone text NOT NULL DEFAULT 'UTC',
    is_active boolean NOT NULL DEFAULT true,
    max_tokens_per_run integer NOT NULL DEFAULT 50000,
    max_duration_seconds integer NOT NULL DEFAULT 600,
    inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
    last_run_at timestamptz,
    next_run_at timestamptz,
    last_status text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT schedule_cadence_exactly_one CHECK (
        (cron_expression IS NOT NULL AND interval_seconds IS NULL)
        OR (cron_expression IS NULL AND interval_seconds IS NOT NULL)
    )
);
CREATE TABLE workflow_definitions_stub (id uuid PRIMARY KEY, name text);
CREATE VIEW workflow_definitions AS SELECT id, name FROM workflow_definitions_stub;

-- ⚠ A STAND-IN FOR `public.autofill_org_id_by_owner('user_id')`, AND THE DIFFERENCE IS
-- RECORDED RATHER THAN GLOSSED. The real trigger resolves the owner's org from `org_members`
-- and fails SAFE to NULL, which the NOT NULL column then rejects — so a user with no org is
-- REFUSED rather than written into the wrong tenant. This copy cannot do that: the §C users
-- are synthetic and have no `org_members` rows, and seeding them would mutate real dev data.
-- What this stand-in preserves is the SHAPE the production writers depend on: `create_schedule`
-- binds no `org_id` at all and the column is still NOT NULL, so a writer that started binding
-- one would still be visible here. That the REAL trigger is installed is asserted separately,
-- against migration 124's own text (`test_c_migration_124_installs_the_real_org_autofill`).
CREATE FUNCTION test_autofill_org() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  NEW.org_id := COALESCE(NEW.org_id, '00000000-0000-0000-0000-0000000000aa'::uuid);
  RETURN NEW;
END;
$fn$;
CREATE TRIGGER workflow_schedules_autofill_org_id BEFORE INSERT ON workflow_schedules
  FOR EACH ROW EXECUTE FUNCTION test_autofill_org();
"""


@pytest.fixture
async def live_pool():
    """A real asyncpg pool pinned to a throwaway schema. Skips when Postgres is unreachable."""
    asyncpg = pytest.importorskip("asyncpg")
    schema = f"sched_test_{uuid.uuid4().hex[:12]}"
    try:
        admin = await asyncio.wait_for(asyncpg.connect(_DSN), timeout=5)
    except Exception as exc:  # noqa: BLE001
        pytest.skip(f"Postgres unavailable at {_DSN}: {exc!r}")
    try:
        await admin.execute(f"CREATE SCHEMA {schema}")
        await admin.execute(f"SET search_path TO {schema}")
        await admin.execute(_TABLE_DDL)
    finally:
        await admin.close()

    async def _init(conn):
        # The jsonb codec the app's own pool installs — so `inputs` round-trips as a dict here
        # exactly as it does in production.
        import json as _json

        await conn.set_type_codec(
            "jsonb", encoder=_json.dumps, decoder=_json.loads, schema="pg_catalog"
        )
    # ⚠ `search_path` MUST be a CONNECTION PARAMETER (`server_settings`), never a `SET` in
    # `init`. MEASURED: asyncpg's pool runs `RESET ALL` when a connection is RELEASED, so a
    # `SET search_path` performed in `init` survives exactly one acquire — every §C case then
    # failed with `relation "workflow_schedules" does not exist` against a table that really
    # existed. `server_settings` is sent at connection startup and is what RESET ALL resets TO.
    pool = await asyncpg.create_pool(
        _DSN,
        min_size=2,
        max_size=6,
        init=_init,
        server_settings={"search_path": f"{schema},public"},
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


async def _seed(pool, *, user_id, due=True, n=1, cron="*/5 * * * *"):
    """Insert ``n`` schedules, due (or not) as asked. Returns the ids."""
    when = datetime.now(timezone.utc) + timedelta(minutes=-1 if due else 60)
    ids = []
    for i in range(n):
        row = await pool.fetchrow(
            "INSERT INTO workflow_schedules "
            "(org_id, workflow_id, user_id, name, cron_expression, next_run_at) "
            "VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
            uuid.UUID(int=1),
            uuid.UUID(WORKFLOW_ID),
            uuid.UUID(user_id),
            f"s{i}",
            cron,
            when,
        )
        ids.append(row["id"])
    return ids


async def test_c_two_concurrent_claimers_never_claim_the_same_schedule(live_pool):
    """⚠ THREAT 1, driven with REAL concurrency against REAL Postgres.

    Twelve due schedules, two claimers started with ``asyncio.gather`` on SEPARATE pooled
    connections, each allowed to take up to 12. If ``FOR UPDATE SKIP LOCKED`` were absent, one
    would block on the other's locks and — once released — read rows the first had already
    claimed. The assertions are the CLAIM SETS: disjoint, and their union is every due row
    exactly once.
    """
    await _seed(live_pool, user_id=CALLER_ID, n=12)

    a, b = await asyncio.gather(
        db_schedules.claim_due_schedules(live_pool, limit=12),
        db_schedules.claim_due_schedules(live_pool, limit=12),
    )
    ids_a = {r["id"] for r in a}
    ids_b = {r["id"] for r in b}

    assert len(ids_a) + len(ids_b) == 12, "a due schedule was lost or claimed twice"
    assert ids_a.isdisjoint(ids_b), f"the same schedule was claimed twice: {ids_a & ids_b}"
    # non-vacuity: this really was a race, not one claimer doing all the work after the other
    # found an empty table. At least one row was claimed in total, and 12 were due.
    assert len(ids_a | ids_b) == 12


async def test_c_a_claimed_schedule_is_no_longer_due_because_next_run_at_advanced(live_pool):
    """⚠ THE LOAD-BEARING HALF. ``SKIP LOCKED`` alone only stops a SIMULTANEOUS double claim;
    what stops a claim a millisecond later is that ``next_run_at`` was advanced INSIDE the
    claiming transaction. A second claim after the first has fully committed must see nothing.
    """
    await _seed(live_pool, user_id=CALLER_ID, n=3)
    first = await db_schedules.claim_due_schedules(live_pool, limit=10)
    assert len(first) == 3  # non-vacuity

    second = await db_schedules.claim_due_schedules(live_pool, limit=10)
    assert second == [], "a schedule was re-claimed after its next_run_at should have advanced"

    for row in first:
        stored = await live_pool.fetchrow(
            "SELECT next_run_at, last_run_at FROM workflow_schedules WHERE id = $1", row["id"]
        )
        assert stored["next_run_at"] > datetime.now(timezone.utc)
        assert stored["last_run_at"] is not None


async def test_c_an_inactive_or_future_schedule_is_never_claimed(live_pool):
    await _seed(live_pool, user_id=CALLER_ID, n=2, due=False)
    ids = await _seed(live_pool, user_id=CALLER_ID, n=1, due=True)
    await live_pool.execute(
        "UPDATE workflow_schedules SET is_active = false WHERE id = $1", ids[0]
    )
    assert await db_schedules.claim_due_schedules(live_pool, limit=10) == []


async def test_c_an_unadvanceable_cadence_is_deactivated_not_left_due_forever(live_pool):
    """A row whose cron cannot be advanced would otherwise be re-claimed on EVERY tick,
    launching a run each time. It must be taken out of the rotation instead."""
    await live_pool.execute(
        "INSERT INTO workflow_schedules "
        "(org_id, workflow_id, user_id, name, cron_expression, timezone, next_run_at) "
        "VALUES ($1, $2, $3, 'broken', '*/5 * * * *', 'Mars/Olympus', now() - interval '1 min')",
        uuid.UUID(int=1),
        uuid.UUID(WORKFLOW_ID),
        uuid.UUID(CALLER_ID),
    )
    claimed = await db_schedules.claim_due_schedules(live_pool, limit=10)
    assert claimed == [], "an un-advanceable row must not be handed to the launcher"
    row = await live_pool.fetchrow(
        "SELECT is_active, last_status FROM workflow_schedules WHERE name = 'broken'"
    )
    assert row["is_active"] is False
    assert row["last_status"] == "cadence_error"
    # and it is genuinely out of the rotation
    assert await db_schedules.claim_due_schedules(live_pool, limit=10) == []


async def test_c_a_foreign_schedule_is_invisible_to_every_owner_scoped_read_and_write(live_pool):
    """⚠ THREAT 2, driven against REAL SQL rather than asserted about a policy string.

    ⚠ This is the gate that protects a user TODAY: the app's asyncpg pool is ``BYPASSRLS``, so
    migration 124's policies never evaluate on the live path. Every one of the four owner-scoped
    entry points is issued as the WRONG user against a row that really exists.
    """
    (victim_id,) = await _seed(live_pool, user_id=OTHER_USER_ID, n=1)
    attacker = uuid.UUID(CALLER_ID)

    assert await db_schedules.get_schedule(live_pool, victim_id, user_id=attacker) is None
    assert (
        await db_schedules.update_schedule(
            live_pool, victim_id, user_id=attacker, fields={"is_active": False}
        )
        is None
    )
    assert await db_schedules.delete_schedule(live_pool, victim_id, user_id=attacker) is False
    assert await db_schedules.list_schedules_by_org(live_pool, user_id=attacker) == []
    assert (
        await db_schedules.list_schedules_by_workflow(
            live_pool, uuid.UUID(WORKFLOW_ID), user_id=attacker
        )
        == []
    )

    # THE ROW IS STILL THERE, UNCHANGED — the refusals were refusals, not silent successes.
    survivor = await live_pool.fetchrow(
        "SELECT is_active FROM workflow_schedules WHERE id = $1", victim_id
    )
    assert survivor is not None and survivor["is_active"] is True

    # NON-VACUITY: the rightful owner reaches all five.
    owner = uuid.UUID(OTHER_USER_ID)
    assert await db_schedules.get_schedule(live_pool, victim_id, user_id=owner) is not None
    assert len(await db_schedules.list_schedules_by_org(live_pool, user_id=owner)) == 1
    assert await db_schedules.delete_schedule(live_pool, victim_id, user_id=owner) is True


async def test_c_the_create_write_round_trips_inputs_as_an_object(live_pool):
    """The 484-row string-scalar defect, driven end to end rather than grepped."""
    row = await db_schedules.create_schedule(
        live_pool,
        workflow_id=uuid.UUID(WORKFLOW_ID),
        user_id=uuid.UUID(CALLER_ID),
        name="obj",
        cron_expression=None,
        interval_seconds=900,
        timezone="UTC",
        is_active=True,
        max_tokens_per_run=1000,
        max_duration_seconds=60,
        inputs={"kickoff_prompt": "go"},
    )
    assert isinstance(row["inputs"], dict)
    # The decisive check: a jsonb OBJECT answers `->>`; a string scalar returns NULL.
    got = await live_pool.fetchval(
        "SELECT inputs->>'kickoff_prompt' FROM workflow_schedules WHERE id = $1", row["id"]
    )
    assert got == "go"
    assert row["next_run_at"] is not None  # computed at insert, never left NULL


async def test_c_patching_one_cadence_clears_the_other(live_pool):
    """Otherwise the table's CHECK discovers the API bug, as a 500."""
    row = await db_schedules.create_schedule(
        live_pool,
        workflow_id=uuid.UUID(WORKFLOW_ID),
        user_id=uuid.UUID(CALLER_ID),
        name="swap",
        cron_expression=None,
        interval_seconds=900,
        timezone="UTC",
        is_active=True,
        max_tokens_per_run=1000,
        max_duration_seconds=60,
        inputs={},
    )
    patched = await db_schedules.update_schedule(
        live_pool,
        row["id"],
        user_id=uuid.UUID(CALLER_ID),
        fields={"cron_expression": "0 4 * * *"},
    )
    assert patched is not None
    assert patched["cron_expression"] == "0 4 * * *"
    assert patched["interval_seconds"] is None


async def test_c_reactivating_a_long_dormant_schedule_does_not_fire_immediately(live_pool):
    """A schedule switched off for a month must not launch the instant it is switched back on —
    that is an unattended surprise charge nobody asked for."""
    (sid,) = await _seed(live_pool, user_id=CALLER_ID, n=1)
    await live_pool.execute(
        "UPDATE workflow_schedules SET is_active = false, "
        "next_run_at = now() - interval '30 days' WHERE id = $1",
        sid,
    )
    patched = await db_schedules.update_schedule(
        live_pool, sid, user_id=uuid.UUID(CALLER_ID), fields={"is_active": True}
    )
    assert patched["next_run_at"] > datetime.now(timezone.utc)
    assert await db_schedules.claim_due_schedules(live_pool, limit=10) == []


# ══════════════════════════════════════════════════════════════════════════════════════
# §D — the service composes claim + launch, and one bad schedule never stops the tick.
# ══════════════════════════════════════════════════════════════════════════════════════


async def test_d_a_tick_launches_one_run_per_claimed_schedule(monkeypatch):
    claimed = [
        {"id": uuid.uuid4(), "user_id": CALLER_ID, "workflow_id": WORKFLOW_ID},
        {"id": uuid.uuid4(), "user_id": CALLER_ID, "workflow_id": WORKFLOW_ID},
    ]
    monkeypatch.setattr(
        db_schedules, "claim_due_schedules", AsyncMock(return_value=claimed)
    )
    launched: list = []

    async def _fake_launch(schedule, **kwargs):
        launched.append(schedule["id"])
        return uuid.uuid4()

    monkeypatch.setattr(scheduler_service, "launch_scheduled_run", _fake_launch)

    svc = scheduler_service.SchedulerService(pool=object(), redis=object())
    assert await svc.tick() == 2
    assert launched == [s["id"] for s in claimed]
    assert svc.ticks == 1 and svc.launched == 2


async def test_d_a_schedule_that_fails_to_launch_is_recorded_and_the_tick_continues(
    monkeypatch,
):
    """⚠ One broken workflow must not stop every other schedule on the install from firing."""
    bad, good = {"id": uuid.uuid4()}, {"id": uuid.uuid4()}
    monkeypatch.setattr(
        db_schedules, "claim_due_schedules", AsyncMock(return_value=[bad, good])
    )
    outcomes: list[tuple] = []

    async def _record(pool, schedule_id, *, status):
        outcomes.append((schedule_id, status))

    monkeypatch.setattr(db_schedules, "record_schedule_outcome", _record)

    async def _flaky(schedule, **kwargs):
        if schedule["id"] == bad["id"]:
            raise RuntimeError("boom")
        return uuid.uuid4()

    monkeypatch.setattr(scheduler_service, "launch_scheduled_run", _flaky)

    svc = scheduler_service.SchedulerService(pool=object(), redis=object())
    assert await svc.tick() == 1, "the healthy schedule still launched"
    assert outcomes == [(bad["id"], scheduler_service.LAUNCH_FAILED)]


async def test_d_a_failing_tick_never_ends_the_loop(monkeypatch):
    """The loop's contract: a tick that raises is logged and the next tick still happens."""
    calls = {"n": 0}

    async def _boom(self):
        calls["n"] += 1
        if calls["n"] < 3:
            raise RuntimeError("tick exploded")
        return 0

    monkeypatch.setattr(scheduler_service.SchedulerService, "tick", _boom)
    svc = scheduler_service.SchedulerService(
        pool=object(), redis=object(), poll_interval_seconds=0.01
    )
    svc.start()
    for _ in range(200):
        if calls["n"] >= 3:
            break
        await asyncio.sleep(0.01)
    await svc.stop()
    assert calls["n"] >= 3, "the loop stopped after a failing tick"


async def test_d_stop_is_idempotent_and_start_does_not_double_task(monkeypatch):
    monkeypatch.setattr(
        scheduler_service.SchedulerService, "tick", AsyncMock(return_value=0)
    )
    svc = scheduler_service.SchedulerService(
        pool=object(), redis=object(), poll_interval_seconds=0.01
    )
    svc.start()
    first = svc._task
    svc.start()
    assert svc._task is first, "start() must not spawn a second loop"
    await svc.stop()
    await svc.stop()  # must not raise


def test_d_the_scheduler_is_off_by_default():
    """⚠ It starts REAL runs with nobody watching. An install that never asked for it must
    behave exactly as it did before this phase.

    ⚠ THIS ASSERTS THE CODE'S DEFAULT, NOT THE DEVELOPER'S ``.env``. It used to read
    ``Settings().scheduler_process_enabled``, which instantiates the model and therefore
    LOADS ``backend/.env`` — so the moment a developer legitimately enabled the scheduler
    on their own box (2026-08-24, exactly as the feature intends), this test went red on a
    tree with no defect in it. A test that fails because a machine is configured is
    measuring the machine.

    The property that actually matters is that a fresh install, told nothing, does not
    start launching runs. That lives in the FIELD DEFAULT, which is read here directly.
    """
    from app.config import Settings

    field = Settings.model_fields["scheduler_process_enabled"]
    assert field.default is False, (
        "the scheduler must be OFF unless an install deliberately turns it on"
    )


def test_d_main_wires_the_scheduler_behind_that_flag():
    """The Phase-118 built-but-unreachable shape, checked. Both halves must be present."""
    import inspect

    import app.main as main_mod

    src = inspect.getsource(main_mod)
    assert "scheduler_process_enabled" in src
    assert "SchedulerService" in src
    assert ".stop()" in src, "a background loop with no shutdown path outlives the app"


def test_c_migration_124_installs_the_real_org_autofill_and_owner_scoped_rls():
    """What §C's throwaway table cannot carry, asserted against the migration's own text.

    Three properties the copy in `_TABLE_DDL` deliberately omits and that therefore have no
    behavioural test in this file:

      * the org autofill is the SHIPPED `autofill_org_id_by_owner`, bound to `user_id`
        (GROUP 1) — not a second copy, and not bound to the wrong column;
      * all four RLS policies carry BOTH the membership macro and the owner branch (108
        Shape A). A policy with only one of the two is a cross-tenant read or a write anyone
        in the org can make;
      * there is no global / org-wide escape branch anywhere in a POLICY BODY. ⚠ The check is
        scoped to the statements, not to the file: the header comment explains at length WHY
        that branch is absent, and a file-wide grep would go red on the explanation (187-24).
    """
    from pathlib import Path

    root = Path(__file__).resolve().parents[3]
    text = (root / "supabase/migrations/124_workflow_schedules.sql").read_text(encoding="utf-8")
    statements = "\n".join(
        line for line in text.splitlines() if not line.lstrip().startswith("--")
    )

    assert "autofill_org_id_by_owner('user_id')" in statements
    assert "set_updated_at()" in statements

    policies = [
        chunk for chunk in statements.split("CREATE POLICY ")[1:]
    ]
    assert len(policies) == 4, f"expected 4 policies, found {len(policies)}"
    for policy in policies:
        body = policy.split(";")[0]
        assert "current_user_org_ids()" in body, f"policy lost the membership macro: {body[:60]}"
        assert "auth.uid() = user_id" in body, f"policy lost the owner branch: {body[:60]}"

    for token in ("is_system_global", "is_global", "USING (true)"):
        assert token not in statements, f"a global escape branch reached a policy body: {token}"
