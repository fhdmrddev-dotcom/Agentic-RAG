"""Phase 211-05 Task 2(a) — ⭐ THE CROSS-PLAN SEAM, DRIVEN WITH NOTHING MOCKED.

``AGENTS.md`` §3.1: *a split phase owes an integration test that mocks NEITHER side, and that
test is a blocking gate.* Phase 211's backend (211-01 / 211-02) and its frontend (211-03 /
211-04) shipped in different waves, each green on its own — which is the exact shape of this
project's last two escaped defects.

── WHAT IS IN THE PATH, AND WHAT IS NOT (say it, do not imply it) ───────────────────────────
Every case below drives the REAL route handler in ``app.api.connectors``, the REAL
``connector_service``, the REAL Pydantic models and the REAL local Postgres on ``:54322``.
**No fake is installed on either half.**

⚠ **The ASGI dependency stack is NOT in the path**, deliberately and by name:
``require_org_manage``, ``require_visible("live_connectors")`` and ``get_user_supabase_client``
are resolved by FastAPI at request time, and this file calls the handlers as functions with
real values supplied. Two consequences, both handled rather than hidden:

  1. **Authorization is proved elsewhere and is not this file's claim.** The org-admin gate has
     its own suites (`test_190_connectors_api.py`, `test_190_secret_column_privilege.py`).
  2. ⭐ **The COLUMN GRANT would be invisible to a service-role client, so it is measured with
     the only instrument that can see it** — a real Postgres session running as
     ``authenticated`` (§6). Migration 118 grants SELECT **column by column**, so a column
     added by migration 127 is unreadable by default and the failure presents as a **503 /
     "Could not load connections"** on rows that were fine yesterday. Asserting a 200 through a
     service-role client would have proved nothing at all about it: service_role bypasses both
     the grant and RLS.

── ⚠ THE HALF THIS FILE CANNOT COVER ────────────────────────────────────────────────────────
**A BACKEND TEST CANNOT SEE A RENDER GATE.** The render half of this seam is
``frontend/src/components/workflows/__tests__/connectionCardReachability.test.tsx``, which
mounts the production chain and asserts what the card DOES for each of the four real row
shapes — including a legacy row whose ``discovered_tools`` is EMPTY. Revision iteration 1 of
this phase caught a proposed render gate that would have made every pre-existing row
unreachable through the UI, and no case in this file could have seen it. That file names this
one; this docstring names that one. **Neither is the whole seam.**
SC#3's absence is a third property again, proved in
``frontend/src/components/settings/__tests__/connectionVerbFence.test.ts``.

── DATABASE HYGIENE ─────────────────────────────────────────────────────────────────────────
The operator's local database IS the working environment. Every row this file creates is
deleted in a fixture teardown that runs even on failure, and every raw-SQL probe runs inside a
transaction that ROLLS BACK. Nothing pre-existing is written, updated or deleted — §5 asserts
that the three shipped rows are byte-unchanged, which is also the check that would catch this
file misbehaving.

⚠ **SERIALIZE THIS FILE.** Worktrees isolate files, not Postgres (CLAUDE.md parallel-execution
rule 4). Two agents running it concurrently share one database.

── SKIPS ────────────────────────────────────────────────────────────────────────────────────
A skip is declared with its REASON and **a green skip is not a passing fence** — the plan's
summary must say which it was. Two skip conditions only: Postgres unreachable, or migration 127
not applied.
"""

from __future__ import annotations

import asyncio
import os
import uuid
from typing import Any

import asyncpg
import pytest
import pytest_asyncio

import app.dependencies as app_dependencies
from app.api import connectors as connectors_api
from app.dependencies import get_supabase
from app.models.connector import ConnectorConnectionCreate
from app.services import connector_service
from app.services.connectors.descriptors import static_descriptors_for_capability
from app.services.connectors.registry import get_adapter

_DSN = os.environ.get(
    "POSTGRES_DSN", "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
)

TABLE = "connector_connections"
IDENTITY_COLUMN = "service_id"
ACTIONS_COLUMN = "discovered_tools"
AMBIGUITY_CONSTRAINT = "connector_connections_shape_is_not_ambiguous"

# 23514 — check_violation. Asserted by CODE, never by message text: the wording of a
# constraint violation is a Postgres implementation detail, and a fence that reads prose rots.
_CHECK_VIOLATION = "23514"

# A tag no shipped row carries, so teardown can find exactly what this file made and nothing
# else. Deliberately not a uuid alone — a human reading the table mid-run should be able to
# tell instantly that these rows are a test's and are about to be removed.
_TAG = "211-05-seam"


def _pg_reachable() -> bool:
    async def _probe() -> bool:
        try:
            conn = await asyncio.wait_for(asyncpg.connect(_DSN), timeout=2.0)
            await conn.close()
            return True
        except Exception:  # noqa: BLE001 — no live DB is a SKIP, not a failure
            return False

    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(_probe())
    finally:
        loop.close()


PG_AVAILABLE = _pg_reachable()

requires_pg = pytest.mark.skipif(
    not PG_AVAILABLE,
    reason=(
        f"Local Postgres on {_DSN} not reachable; there is no live database to drive the "
        "seam against. ⚠ THIS SKIP IS NOT A PASS."
    ),
)


# ═══════════════════════════════════════════════════════════════════════════════════════════
# ⚠ POINTING THE APP'S OWN CLIENT AT THE REAL LOCAL SUPABASE — AND WHY THAT IS NOT A MOCK
# ═══════════════════════════════════════════════════════════════════════════════════════════
# `backend/tests/conftest.py:10` does `os.environ.setdefault("SUPABASE_URL",
# "https://test.supabase.co")` before ANY app import, so that a unit suite with no local stack
# can still instantiate `pydantic-settings`. A real env var beats `.env`, so under pytest the
# app's singleton client is built against a hostname that does not resolve — measured here as
# `httpx.ConnectError: [Errno 11001] getaddrinfo failed` on the first five cases of this file.
#
# ⭐ THE REPLACEMENT BELOW IS A **REAL** SUPABASE CLIENT AT THE **REAL** LOCAL URL, read from
# the operator's own `backend/.env`. It installs no fake, stubs no method and intercepts no
# call: it undoes a TEST-HARNESS default so that the app's own code path reaches the app's own
# database. `connector_service._fetch_connection_row` uses `_client(None)` — the singleton —
# so passing a good client into the handlers alone would NOT have been enough; the resolver
# would still have gone to the unresolvable host.
#
# The singleton is restored in teardown, so no other suite inherits it.
_ENV = None


def _real_supabase_settings() -> tuple[str, str] | None:
    global _ENV
    if _ENV is None:
        from pathlib import Path

        from dotenv import dotenv_values

        _ENV = dotenv_values(Path(__file__).resolve().parents[2] / ".env")
    url = _ENV.get("SUPABASE_URL")
    key = _ENV.get("SUPABASE_SERVICE_ROLE_KEY")
    return (url, key) if url and key else None


@pytest.fixture(autouse=True)
def real_supabase_singleton():
    creds = _real_supabase_settings()
    if creds is None:
        pytest.skip(
            "backend/.env carries no SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, so the real "
            "wire path cannot be driven. ⚠ THIS SKIP IS NOT A PASS."
        )
    from supabase import create_client

    previous = app_dependencies._supabase
    app_dependencies._supabase = create_client(creds[0], creds[1])
    try:
        yield
    finally:
        app_dependencies._supabase = previous


@pytest_asyncio.fixture
async def pool():
    if not PG_AVAILABLE:
        pytest.skip(f"Local Postgres on {_DSN} not reachable")
    p = await asyncpg.create_pool(_DSN, min_size=1, max_size=4)
    try:
        yield p
    finally:
        await p.close()


@pytest_asyncio.fixture
async def migration_applied(pool):
    """Skip 2 of 2 — the migration is not applied. READ THE CATALOG, never probe by INSERT."""
    async with pool.acquire() as conn:
        present = await conn.fetchval(
            "SELECT EXISTS (SELECT 1 FROM information_schema.columns "
            "WHERE table_schema='public' AND table_name=$1 AND column_name=$2)",
            TABLE,
            IDENTITY_COLUMN,
        )
    if not present:
        pytest.skip(
            f"migration 127 not applied — public.{TABLE}.{IDENTITY_COLUMN} does not exist. "
            "Paste supabase/migrations/127_connector_connection_service_identity.sql into the "
            "Supabase SQL editor. ⚠ THIS SKIP IS NOT A PASS."
        )
    return True


@pytest_asyncio.fixture
async def tenancy(pool, migration_applied):
    """An (org_id, created_by) pair borrowed from a REAL row.

    Both columns are FKs, so an invented uuid would be refused by the foreign key rather than
    by the thing under test — which would make every case pass for the wrong reason.
    """
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            f"SELECT org_id, created_by FROM public.{TABLE} ORDER BY created_at LIMIT 1"
        )
    assert row is not None, (
        f"public.{TABLE} is empty, so every case in this file would be probing an FK rather "
        "than the property it names — this gate would be vacuous"
    )
    return str(row["org_id"]), str(row["created_by"])


@pytest_asyncio.fixture
async def created_rows(pool):
    """Ids this test created. Deleted in teardown, ALWAYS — including on failure."""
    ids: list[str] = []
    try:
        yield ids
    finally:
        if ids:
            async with pool.acquire() as conn:
                await conn.execute(
                    f"DELETE FROM public.{TABLE} WHERE id = ANY($1::uuid[])",
                    [uuid.UUID(i) for i in ids],
                )


async def _create_through_the_real_handler(
    body: ConnectorConnectionCreate, org_id: str, user_id: str
) -> Any:
    """The REAL ``POST /connectors/connections`` handler, called as a function.

    Every dependency is supplied as a real value: the service-role Supabase client the app
    itself builds, the caller's org, the caller's id.
    """
    return await connectors_api.create_connection(
        body=body,
        current_user={"id": user_id},
        active_org=org_id,
        supabase=get_supabase(),
    )


async def _list_through_the_real_handler(org_id: str) -> Any:
    return await connectors_api.list_connections(
        capability=None,
        current_user={"id": "unused-by-this-handler"},
        active_org=org_id,
        supabase=get_supabase(),
    )


# ═══════════════════════════════════════════════════════════════════════════════════════════
# 1 · ⭐ THE SERVICE-ONLY ROW (CONN-08) — created and read back through the real path
# ═══════════════════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
@requires_pg
async def test_a_service_only_row_is_created_and_read_back_carrying_its_identity(
    tenancy, created_rows
):
    """One call crosses 211-02's model arm, its row dict AND migration 127's two constraints.

    Before this phase such a row could not exist at all: migration 126's
    ``shape_is_one_of_two`` required a capability or an endpoint, and
    ``_validate_connection_shape`` refused the body. Both halves changed, in different plans.
    """
    org_id, user_id = tenancy

    created = await _create_through_the_real_handler(
        ConnectorConnectionCreate(
            service_id="notion",
            name=f"{_TAG} service-only",
            config={},
        ),
        org_id,
        user_id,
    )
    created_rows.append(str(created.id))

    assert created.service_id == "notion"
    assert created.capability is None
    assert created.mcp_server_url is None
    # ⭐ The shape the render gate must survive — an EMPTY action list on a brand-new row.
    assert created.discovered_tools == []

    # …and it comes back out of the REAL read, carrying the column migration 127 added.
    rows = await _list_through_the_real_handler(org_id)
    mine = [r for r in rows if str(r.id) == str(created.id)]
    assert len(mine) == 1, "the service-only row did not come back through the real read"
    assert mine[0].service_id == "notion"
    assert mine[0].discovered_tools == []


@pytest.mark.asyncio
@requires_pg
async def test_a_blank_service_identity_is_still_refused(tenancy, created_rows):
    """⚠ THE NEGATIVE CONTROL. Without it, the case above proves only that the OLD guarantee
    was DELETED rather than that a NEW one replaced it."""
    org_id, user_id = tenancy
    with pytest.raises(Exception):
        await _create_through_the_real_handler(
            ConnectorConnectionCreate(service_id="   ", name=f"{_TAG} blank", config={}),
            org_id,
            user_id,
        )


# ═══════════════════════════════════════════════════════════════════════════════════════════
# 2 · A CAPABILITY ROW ADVERTISES ITS OWN ACTION, DERIVED FROM THE ADAPTER
# ═══════════════════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
@requires_pg
@pytest.mark.parametrize(
    "capability, config",
    [
        ("post_message", {"default_channel": "ops-alerts"}),
        (
            "create_ticket",
            {
                "base_url": "https://example.atlassian.net",
                "project_key": "KAN",
                # The basic-auth USERNAME half — a NON-secret fact (D-03 / R12), which is why
                # `CreateTicketConfig` carries it and `secret` carries only the API token.
                "account_email": "nobody@example.com",
            },
        ),
    ],
)
async def test_a_capability_row_advertises_exactly_its_own_action(
    tenancy, created_rows, capability, config
):
    """The descriptor's ``required`` is COMPARED AGAINST THE ADAPTER, never against a literal.

    A literal here would be an eighth spelling of the same fact with nothing holding it in
    agreement — which is the thing ``descriptors.py`` exists to make impossible.
    """
    org_id, user_id = tenancy

    created = await _create_through_the_real_handler(
        ConnectorConnectionCreate(
            service_id=f"{_TAG}-{capability}",
            name=f"{_TAG} {capability}",
            capability=capability,
            config=config,
            secret="a-credential-that-goes-nowhere",
        ),
        org_id,
        user_id,
    )
    created_rows.append(str(created.id))

    assert len(created.discovered_tools) == 1
    tool = created.discovered_tools[0]
    # The descriptor's NAME **is** the capability — an action nobody can grant would be a lie.
    assert tool["name"] == capability
    # …and its required arguments are the ADAPTER's own, imported here rather than retyped.
    adapter = get_adapter(capability)
    assert tool["inputSchema"]["required"] == list(adapter.INPUT_SCHEMA["required"])
    # Non-vacuity: the adapter really declares required arguments.
    assert len(adapter.INPUT_SCHEMA["required"]) >= 1


# ═══════════════════════════════════════════════════════════════════════════════════════════
# 3 · THE AMBIGUOUS SHAPE IS REFUSED TWICE — at the model AND at the database
# ═══════════════════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
@requires_pg
async def test_the_ambiguous_body_is_refused_by_the_model(tenancy):
    """A body wearing BOTH shapes. This is the API half."""
    with pytest.raises(Exception):
        ConnectorConnectionCreate(
            service_id="ambiguous",
            name=f"{_TAG} ambiguous",
            capability="post_message",
            mcp_server_url="https://mcp.example.com/mcp",
            config={"default_channel": "x"},
            secret="x",
        )


@pytest.mark.asyncio
@requires_pg
async def test_the_ambiguous_row_is_refused_by_the_database_too(pool, tenancy):
    """⚠ TWO SEPARATE ASSERTIONS, BECAUSE ONE PASSING DOES NOT IMPLY THE OTHER.

    The model is the API's gate; the CHECK constraint is the gate for every writer that is not
    the API — a migration, a script, a hand-edit in the SQL editor. The one above proves
    nothing about this one.
    """
    org_id, user_id = tenancy
    async with pool.acquire() as conn:
        tx = conn.transaction()
        await tx.start()
        try:
            with pytest.raises(asyncpg.PostgresError) as caught:
                await conn.execute(
                    f"INSERT INTO public.{TABLE} "
                    "(org_id, created_by, service_id, name, capability, mcp_server_url, config) "
                    "VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, '{}'::jsonb)",
                    org_id,
                    user_id,
                    "ambiguous",
                    f"{_TAG} ambiguous direct",
                    "post_message",
                    "https://mcp.example.com/mcp",
                )
            assert caught.value.sqlstate == _CHECK_VIOLATION
            assert AMBIGUITY_CONSTRAINT in str(caught.value)
        finally:
            await tx.rollback()


# ═══════════════════════════════════════════════════════════════════════════════════════════
# 4 · ⭐ THE §2b BACKFILL, READ FROM THE LIVE ROWS
# ═══════════════════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
@requires_pg
async def test_every_live_capability_row_advertises_its_own_capability(pool, migration_applied):
    """SC#2's DATA half. ⚠ The RENDER half is
    ``frontend/src/components/workflows/__tests__/connectionCardReachability.test.tsx`` — a
    backend test cannot see a render gate, so this case proves the SHAPE and stops there.

    Without the §2b backfill, SC#2 is FALSE for every row that already exists: a legacy
    connection would present with an empty action list until somebody pressed Refresh, and
    *"presents as a service with named actions"* would mean *"after you press something"*.
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"SELECT id, capability, jsonb_array_length({ACTIONS_COLUMN}) AS n, "
            f"{ACTIONS_COLUMN}->0->>'name' AS first_name "
            f"FROM public.{TABLE} WHERE capability IS NOT NULL"
        )
    # NON-VACUITY FIRST — an empty result makes every assertion below free.
    assert len(rows) >= 2, (
        "there are fewer than two capability rows on this box, so this case is not measuring "
        "the backfill it names"
    )
    for row in rows:
        assert row["n"] == 1, f"row {row['id']} carries {row['n']} action(s), expected exactly 1"
        assert row["first_name"] == row["capability"], (
            f"row {row['id']} advertises {row['first_name']!r} but its capability is "
            f"{row['capability']!r} — an action nobody can grant"
        )


@pytest.mark.asyncio
@requires_pg
async def test_the_two_shipped_capability_rows_are_byte_unchanged(pool, migration_applied):
    """CONN-05. Per-id, never set equality, so a row created by later UAT cannot falsify it —
    and the non-vacuity assertion beside it is what stops that leniency emptying the case."""
    expected = {
        "e62eed75-9da8-48c8-9c80-6851d83f9423": "post_message",
        "477a4074-1fa4-45fd-91f5-ca305ff366fe": "create_ticket",
        "7ca5e114-c5cd-4f7f-8c08-8885278bf42d": None,
    }
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"SELECT id, capability FROM public.{TABLE} WHERE id = ANY($1::uuid[])",
            [uuid.UUID(k) for k in expected],
        )
    assert len(rows) == len(expected), "a pre-existing row is missing — this file must not delete one"
    for row in rows:
        assert row["capability"] == expected[str(row["id"])]


# ═══════════════════════════════════════════════════════════════════════════════════════════
# 5 · THE SELF-HEAL PATH — the capability arm of POST /connections/{id}/discover
# ═══════════════════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
@requires_pg
async def test_the_capability_arm_of_discover_refreshes_without_any_network_call(
    tenancy, created_rows, pool, monkeypatch
):
    """⚠ ITS ONLY CALLER IN THE PRODUCT IS 211-04's Refresh control, so this is the ONLY
    automated exercise this arm gets.

    ⭐ The *no network call* half is asserted MECHANICALLY, not promised: ``mcp_client`` is the
    module the remote arm reaches for, and this case fails outright if it is touched.
    """
    org_id, user_id = tenancy
    created = await _create_through_the_real_handler(
        ConnectorConnectionCreate(
            service_id=f"{_TAG}-selfheal",
            name=f"{_TAG} self-heal",
            capability="post_message",
            config={"default_channel": "ops-alerts"},
            secret="a-credential-that-goes-nowhere",
        ),
        org_id,
        user_id,
    )
    created_rows.append(str(created.id))

    # Empty the action list the way a failed descriptor write would leave it.
    async with pool.acquire() as conn:
        await conn.execute(
            f"UPDATE public.{TABLE} SET {ACTIONS_COLUMN} = '[]'::jsonb WHERE id = $1::uuid",
            str(created.id),
        )

    from app.services import mcp_client

    async def _forbidden(*_a, **_k):
        raise AssertionError(
            "the capability arm of discover contacted a remote server — it must not"
        )

    monkeypatch.setattr(mcp_client, "list_tools", _forbidden)

    tools = await connectors_api.discover_tools(
        connection_id=str(created.id),
        active_org=org_id,
        user={"id": user_id},
        supabase=get_supabase(),
    )

    assert [t["name"] for t in tools] == ["post_message"]
    assert tools == static_descriptors_for_capability("post_message")

    # …and it was WRITTEN, not merely returned. A refresh that returns the right list and
    # caches nothing self-heals for exactly one render.
    async with pool.acquire() as conn:
        n = await conn.fetchval(
            f"SELECT jsonb_array_length({ACTIONS_COLUMN}) FROM public.{TABLE} WHERE id = $1::uuid",
            str(created.id),
        )
    assert n == 1


@pytest.mark.asyncio
@requires_pg
async def test_a_service_only_row_has_nothing_to_discover_and_says_so(
    tenancy, created_rows
):
    """The third arm, named rather than swallowed. ``ConnectorNothingToDiscover`` IS a
    ``ConnectorError``, so an arm ordered below the generic clause would never run."""
    org_id, user_id = tenancy
    created = await _create_through_the_real_handler(
        ConnectorConnectionCreate(
            service_id=f"{_TAG}-nothing",
            name=f"{_TAG} nothing to discover",
            config={},
        ),
        org_id,
        user_id,
    )
    created_rows.append(str(created.id))

    with pytest.raises(connector_service.ConnectorNothingToDiscover):
        await connector_service.discover_connection_tools(
            str(created.id), org_id=org_id, supabase=get_supabase()
        )


# ═══════════════════════════════════════════════════════════════════════════════════════════
# 6 · ⭐ THE COLUMN GRANT — the only instrument that can see it
# ═══════════════════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
@requires_pg
async def test_the_new_columns_are_readable_by_the_authenticated_role(pool, migration_applied):
    """⚠ A 503 / *"Could not load connections"* on a PRE-EXISTING row is this, not an outage.

    Migration 118 revoked the blanket grants and re-granted SELECT **column by column**, so a
    column added later is unreadable by default and every read of the table fails — for every
    member of every org, on rows that were fine the day before. A service-role client cannot
    observe it (service_role bypasses both the grant and RLS), so this case opens a real
    session and takes the role.
    """
    async with pool.acquire() as conn:
        tx = conn.transaction()
        await tx.start()
        try:
            await conn.execute("SET LOCAL ROLE authenticated")
            # RLS will return zero rows for a session with no JWT — that is fine and is not
            # what is under test. A missing COLUMN GRANT raises 42501 before RLS is consulted.
            await conn.fetch(
                f"SELECT id, {IDENTITY_COLUMN}, {ACTIONS_COLUMN} FROM public.{TABLE} LIMIT 1"
            )
        finally:
            await tx.rollback()


# ═══════════════════════════════════════════════════════════════════════════════════════════
# 7 · ⭐⭐ THE CROSS-PLAN SEAM DEFECT — FIXED 2026-08-27, AND THIS SECTION IS ITS GREEN
# ═══════════════════════════════════════════════════════════════════════════════════════════
#
# ⚠ **THIS SECTION USED TO PIN THE DEFECT, INCLUDING THE WRONG SENTENCE, ON PURPOSE.** It was
# written as the follow-up fix's RED: *"when `phase_types.py:2460` is corrected, THESE CASES GO
# RED and are updated in that commit, which is what makes the fix provable."* That is exactly
# what happened — `test_the_inaccurate_sentence_is_the_one_the_shipped_source_composes` went RED
# on the source pin, and this section is updated in the SAME commit as the fix. The original
# wording of the pin is preserved in the git history of this file and in
# `.planning/reported-bugs/BUG-260827-01-service-only-connection-records-a-false-capability-mismatch.md`.
#
# THE CHAIN, and it was a SEAM — each plan was correct on its own:
#   1. `ConnectionFormPanel.tsx` (211-03) emits `{name, config, service_id}` for an
#      unrecognised service — no `capability` key at all. A service-only row is CREATABLE.
#   2. `ConnectionPicker.tsx` (211-04) reads unscoped and unfiltered. That row is LISTED and
#      BINDABLE.
#   3. `phase_types.py` read `getattr(connection, "capability", capability) != capability`.
#      The `getattr` DEFAULT fires only when the attribute is MISSING — never when its value
#      is `None`. A service-only row has it present-and-`None`, so the step was recorded with
#      a sentence claiming a DIFFERENT capability. It is not a different capability; it is NO
#      capability.
#   Migration 127's `shape_is_not_ambiguous` forbids BOTH being set and PERMITS both being
#   NULL, by design (CONN-08). Before Phase 211 the row could neither exist nor be listed;
#   both halves arrived in that phase.
#
# ⚠ WHAT THE FIX DELIBERATELY DID **NOT** DO: it did not widen the guard. The genuinely
# mismatched case is still refused — a fix that simply let `None` through would have deleted a
# real protection while closing a wording bug, and the case below is what holds that line.


def _capability_gate_reason(capability: str | None, connection: Any) -> str | None:
    """The shipped capability gate, re-expressed EXACTLY as the lines read it.

    Returns the `_record` reason the gate produces, or `None` when the gate lets the step
    through.

    ⚠ It is re-expressed rather than imported because the gate is an inline branch inside a
    600-line async executor with eight gates ahead of it, and reaching it for real needs a full
    run context. §7 therefore pins the CONDITION and the SENTENCES separately, and the case
    below asserts the sentences are the ones the shipped source really composes — so a change
    to either one alone cannot leave this section green.
    """
    if getattr(connection, "mcp_server_url", None):
        return None
    bound_capability = getattr(connection, "capability", capability)
    if bound_capability is None:
        return "the bound connection names a service but no way to reach it yet"
    if bound_capability != capability:
        return "the bound connection is for a different capability"
    return None


class _Row:
    """A resolved connection, exactly as `resolve_connection` returns one."""

    def __init__(self, capability: str | None, mcp_server_url: str | None) -> None:
        self.capability = capability
        self.mcp_server_url = mcp_server_url


class _RowWithNoCapabilityAttribute:
    """⚠ A connection object that does not carry a `capability` ATTRIBUTE AT ALL.

    The fix KEPT `getattr`'s default rather than replacing it with `None`, so this object still
    passes the gate exactly as it did before. Pinned because swapping the default to `None`
    reads as a harmless tidy-up and would silently start refusing every such caller.
    """

    def __init__(self, mcp_server_url: str | None = None) -> None:
        self.mcp_server_url = mcp_server_url


def test_a_service_only_connection_is_no_capability_not_a_different_one():
    """⭐ BUG-260827-01, CLOSED. The step still declines to act — only the words changed."""
    # ⭐ THE FIX. A SERVICE-ONLY row — `capability` present-and-`None`, no `mcp_server_url` —
    # gets its own honest sentence, the same "not yet" the refresh path carries one module over
    # as `connector_service.ConnectorNothingToDiscover`.
    assert (
        _capability_gate_reason("post_message", _Row(None, None))
        == "the bound connection names a service but no way to reach it yet"
    )
    # ⚠ AND THE GUARD WAS NOT WIDENED. A genuinely MISMATCHED row is still refused, with the
    # sentence it was written for. This is the protection a careless fix would have deleted.
    assert (
        _capability_gate_reason("post_message", _Row("create_ticket", None))
        == "the bound connection is for a different capability"
    )
    # A matching capability row still passes the gate — the branch is not simply always true.
    assert _capability_gate_reason("post_message", _Row("post_message", None)) is None
    # A remote-server row still skips the branch entirely — the first arm, untouched.
    assert (
        _capability_gate_reason("post_message", _Row(None, "https://mcp.example.com/mcp"))
        is None
    )
    # ⚠ The `getattr` DEFAULT is preserved: no `capability` attribute at all still passes.
    assert _capability_gate_reason("post_message", _RowWithNoCapabilityAttribute()) is None


def test_both_sentences_are_the_ones_the_shipped_source_composes():
    """⚠ Pins the WORDS, so a change to the condition without the sentences — or the sentences
    without the condition — cannot leave the case above green on its own."""
    from pathlib import Path

    source = (
        Path(__file__).resolve().parents[2]
        / "app"
        / "services"
        / "harness"
        / "phase_types.py"
    ).read_text(encoding="utf-8")
    # The condition, split into its two arms.
    assert 'bound_capability = getattr(connection, "capability", capability)' in source
    assert "if bound_capability is None:" in source
    assert "if bound_capability != capability:" in source
    # ⚠ THE DEFECTIVE ONE-LINER IS GONE, and this is what actually went RED when the fix landed.
    assert 'getattr(connection, "capability", capability) != capability' not in source
    # Both sentences, each still owned by the one composer.
    assert (
        '"the bound connection names a service but no way to reach it yet"' in source
    )
    assert '_record("the bound connection is for a different capability")' in source


def test_the_ui_reachable_service_only_binding_hits_a_DIFFERENT_arm_first():
    """⚠ MEASURED, AND IT REFINES THE REPORT RATHER THAN CONFIRMING IT UNCHECKED.

    Through the SHIPPED UI, binding a connection CLEARS the step's `capability`
    (`ConnectionPicker.bind`), and a service-only row advertises no action to choose — so the
    step reaches the executor with `capability=None` and `tool_name=None` and is refused by the
    CLOSED-SET guard (a `KeyError`) long before the capability gate. That gate's sentence is
    reached when a step names a VALID capability alongside a service-only connection, which the
    definition/API surface permits and cross-checks nowhere.

    ⚠ BOTH ARMS ARE STILL REAL AND THEY ARE STILL DIFFERENT FAILURES. BUG-260827-01 named and
    fixed the SECOND — the words. **Arm 1 is untouched and remains a stack-trace-shaped
    failure**, recorded here so it is not mistaken for closed by this commit.
    """
    from app.services.harness.grounding import EXTERNAL_ACTION_CAPABILITIES

    # Arm 1 — the UI-reachable state. Refused by the closed-set guard, not by the gate below.
    assert None not in EXTERNAL_ACTION_CAPABILITIES
    # Arm 2 — the definition/API-reachable state, which IS the gate this bug was about.
    assert "post_message" in EXTERNAL_ACTION_CAPABILITIES
    assert (
        _capability_gate_reason("post_message", _Row(None, None))
        == "the bound connection names a service but no way to reach it yet"
    )
