"""Phase 211 (CONN-05 / CONN-08) — LIVE-DB gate for migration 127's ``connector_connections``.

Migration 127 does four things that only a database can prove:

  * it adds ``service_id`` and BACKFILLS it onto every pre-existing row (D-211-03);
  * it backfills ``discovered_tools`` onto the pre-existing CAPABILITY rows (SC#2);
  * it DROPS ``connector_connections_shape_is_one_of_two`` — and drops it in order to permit a
    row CONN-08 needs (a service reached by neither an adapter nor an MCP server);
  * it adds two INDEPENDENT constraints in its place (D-211-11).

⚠ **THE NEGATIVE CONTROLS ARE AS LOAD-BEARING AS THE POSITIVE ONE.** A test that only asserts
the service-only INSERT is now ACCEPTED cannot tell *"the guarantee was REPLACED"* from *"the
guarantee was DELETED"* — and deleting it is precisely the failure mode migration 126's own
comment block warned about, in this same table, one migration ago. So the two replacements are
each asserted by a refusal that NAMES the constraint that fired.

── THE PRE-MIGRATION RED SAMPLE, TAKEN BEFORE THE OPERATOR APPLIED ANYTHING ─────────────────
Measured against ``127.0.0.1:54322`` on 2026-08-26, every write inside a transaction that
ROLLED BACK, and recorded here because it is the sample that CANNOT be taken afterwards:

  * the SC#4 service-only INSERT was **REFUSED**::

        CheckViolationError: new row for relation "connector_connections" violates check
        constraint "connector_connections_shape_is_one_of_two"
        sqlstate = '23514'

  * the both-shapes INSERT (``capability='post_message'`` AND
    ``mcp_server_url='https://mcp.example.com/v1/mcp'``) was **ACCEPTED**. That acceptance is
    the evidence that D-211-11's second constraint is a **NEW** guarantee rather than a
    restatement of one the table already had.

  * the row set, pinned below as ``_PRE_MIGRATION_CAPABILITY``::

        e62eed75-…  capability='post_message'   'Slack-rag-test'
        477a4074-…  capability='create_ticket'  'Jira - KAN'
        7ca5e114-…  capability=None             'DeepWiki (206.1 UAT)'   (the MCP row)

  * and the state SC#2 starts from — ``jsonb_array_length(discovered_tools)`` was **0** on BOTH
    capability rows, and 3 on the MCP row. No user action available in the shipped product
    would have given the two capability rows any.

⚠ **A GREEN SKIP IS NOT A PASSING FENCE, AND NOBODY MAY LATER READ IT AS ONE.** The DB cases
below skip on exactly two conditions, each with its own distinct reason: ``:54322`` unreachable,
and migration 127 unapplied. The applied-check reads ``information_schema.columns`` and **never
probes with an INSERT** — an INSERT probe would both write to the operator's live dev database
and conflate *"the column is absent"* with *"something else rejected the row"*.

⚠ **``test_the_sql_backfill_matches_the_python_descriptor`` CARRIES NO SKIP AT ALL.** It reads
source, not a database, so it runs and reports on every invocation. That is deliberate: it is
the fence holding the descriptor JSON spelled in ``descriptors.py`` in agreement with the copy
spelled in migration 127 §2b, and a fence that can skip is a fence that reports green in exactly
the environment where nobody is watching. **The module-level ``pytestmark`` pattern used by
``test_migration_122.py`` is therefore NOT used here** — the skip lives on each DB case instead.

**ALL DB writes occur INSIDE a transaction that ROLLS BACK** — the operator's local database is
the working environment, and CLAUDE.md forbids the Supabase CLI's push/reset subcommands.
"""

import asyncio
import json
import os
import re
from pathlib import Path

import asyncpg
import pytest
import pytest_asyncio

from app.services.connectors.descriptors import static_descriptors_for_capability


_POSTGRES_TEST_DSN = os.environ.get(
    "POSTGRES_DSN",
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
)

TABLE = "connector_connections"
IDENTITY_COLUMN = "service_id"

# The two constraints migration 127 §3 adds in place of the one it drops. Named once, used by
# every assertion, so a rename cannot make a refusal-naming test pass by accident.
IDENTITY_CONSTRAINT = "connector_connections_has_a_service_identity"
AMBIGUITY_CONSTRAINT = "connector_connections_shape_is_not_ambiguous"
DROPPED_CONSTRAINT = "connector_connections_shape_is_one_of_two"

MIGRATION_PATH = (
    Path(__file__).resolve().parents[2]
    / "supabase"
    / "migrations"
    / "127_connector_connection_service_identity.sql"
)

# ⚠ CAPTURED BEFORE THE MIGRATION RAN — this is what makes "capability is unchanged" a
# COMPARISON rather than a claim. Asserted as a per-id lookup rather than as set equality, so a
# row created by later UAT does not falsify it; the non-vacuity assertion beside it is what
# stops that leniency from emptying the case out.
_PRE_MIGRATION_CAPABILITY: dict[str, str | None] = {
    "e62eed75-9da8-48c8-9c80-6851d83f9423": "post_message",
    "477a4074-1fa4-45fd-91f5-ca305ff366fe": "create_ticket",
    "7ca5e114-c5cd-4f7f-8c08-8885278bf42d": None,
}


async def _pg_reachable(dsn: str = _POSTGRES_TEST_DSN) -> bool:
    try:
        conn = await asyncio.wait_for(asyncpg.connect(dsn), timeout=2.0)
        await conn.close()
        return True
    except Exception:
        return False


def _check_pg_available_sync() -> bool:
    import asyncio as _a

    try:
        loop = _a.new_event_loop()
        try:
            return loop.run_until_complete(_pg_reachable())
        finally:
            loop.close()
    except Exception:
        return False


# SKIP 1 of 2 — no live DB to gate against.
#
# ⚠ Applied as a DECORATOR on each DB case, NEVER as a module-level `pytestmark`. The source
# fence at the bottom of this file must run in every environment, and a module-level mark would
# silence it wherever Postgres happens to be down.
PG_AVAILABLE = _check_pg_available_sync()
requires_pg = pytest.mark.skipif(
    not PG_AVAILABLE,
    reason=(
        f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; there is no live DB to gate "
        "migration 127 against"
    ),
)


@pytest_asyncio.fixture
async def pg_pool():
    """Function-scoped real asyncpg pool against local Postgres :54322 (jsonb codec)."""

    async def _init(conn):
        await conn.set_type_codec(
            "jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog"
        )

    pool = await asyncpg.create_pool(_POSTGRES_TEST_DSN, min_size=1, max_size=4, init=_init)
    try:
        yield pool
    finally:
        await pool.close()


async def _identity_column_catalog(conn) -> dict | None:
    """``information_schema.columns`` for ``service_id``, or None when it does not exist.

    ⚠ **READ THE CATALOG, NEVER PROBE WITH AN INSERT** — see the module docstring.
    """
    row = await conn.fetchrow(
        "SELECT column_name, is_nullable, column_default, data_type "
        "FROM information_schema.columns "
        "WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2",
        TABLE,
        IDENTITY_COLUMN,
    )
    return dict(row) if row else None


def _skip_unless_applied(catalog: dict | None) -> None:
    # SKIP 2 of 2 — the migration is not applied yet.
    if catalog is None:
        pytest.skip(
            "migration 127 not applied — "
            f"public.{TABLE}.{IDENTITY_COLUMN} does not exist. Paste "
            "supabase/migrations/127_connector_connection_service_identity.sql into the "
            "Supabase SQL editor. ⚠ THIS SKIP IS NOT A PASS."
        )


async def _seed_identity(conn) -> tuple[str, str]:
    """An (org_id, created_by) pair borrowed from a REAL row.

    Both columns are FKs, so an invented uuid would be refused by the foreign key rather than by
    the constraint under test — which would make every refusal case pass for the wrong reason.
    """
    row = await conn.fetchrow(
        f"SELECT org_id, created_by FROM public.{TABLE} ORDER BY created_at LIMIT 1"
    )
    assert row is not None, (
        f"public.{TABLE} is empty, so every case in this file would be probing an FK rather "
        "than the constraint it names — this gate would be vacuous"
    )
    return str(row["org_id"]), str(row["created_by"])


@pytest.mark.asyncio
@requires_pg
async def test_the_table_is_non_vacuously_populated(pg_pool):
    """NON-VACUITY, asserted separately so no other case can read as green against nothing.

    ``test_migration_122.py``'s rule: a fence that silently talked to an empty table must not
    look the same as one that talked to a real one.
    """
    async with pg_pool.acquire() as conn:
        catalog = await _identity_column_catalog(conn)
        _skip_unless_applied(catalog)
        total = await conn.fetchval(f"SELECT count(*) FROM public.{TABLE}")
        assert total > 0, (
            f"no {TABLE} rows exist; every backfill assertion below would pass trivially"
        )


@pytest.mark.asyncio
@requires_pg
async def test_the_dropped_constraint_is_gone_and_both_replacements_are_present(pg_pool):
    """The shape of §3, read from ``pg_constraint`` rather than inferred from behaviour.

    Behaviour alone cannot distinguish *"the constraint was replaced"* from *"a different
    constraint happens to refuse the same row today"*. The catalog can.
    """
    async with pg_pool.acquire() as conn:
        catalog = await _identity_column_catalog(conn)
        _skip_unless_applied(catalog)
        names = {
            r["conname"]
            for r in await conn.fetch(
                "SELECT conname FROM pg_constraint "
                f"WHERE conrelid = 'public.{TABLE}'::regclass"
            )
        }
        assert DROPPED_CONSTRAINT not in names, (
            f"{DROPPED_CONSTRAINT} is still present — CONN-08's service-only row is still "
            f"refused. Constraints: {sorted(names)}"
        )
        assert IDENTITY_CONSTRAINT in names, sorted(names)
        assert AMBIGUITY_CONSTRAINT in names, sorted(names)


@pytest.mark.asyncio
@requires_pg
async def test_a_service_only_row_is_accepted_by_the_database(pg_pool):
    """⭐ SC#4 / CONN-08 — THE POSITIVE CASE, and the whole reason 126's CHECK was dropped.

    A connection naming a service reached by NEITHER a first-party adapter NOR a remote MCP
    server — an OAuth-authenticated service, which has neither until Phase 215. Before this
    migration the identical INSERT was refused by ``connector_connections_shape_is_one_of_two``
    (the verbatim error is in the module docstring).
    """
    async with pg_pool.acquire() as conn:
        catalog = await _identity_column_catalog(conn)
        _skip_unless_applied(catalog)
        org_id, created_by = await _seed_identity(conn)

        tx = conn.transaction()
        await tx.start()
        try:
            new_id = await conn.fetchval(
                f"INSERT INTO public.{TABLE} "
                "(org_id, created_by, capability, name, config, mcp_server_url, service_id) "
                "VALUES ($1, $2, NULL, $3, '{}'::jsonb, NULL, $4) RETURNING id",
                org_id,
                created_by,
                "gate 127 — service-only row",
                "notion",
            )
            assert new_id is not None
        finally:
            await tx.rollback()


@pytest.mark.asyncio
@requires_pg
async def test_a_row_with_no_identity_is_still_refused(pg_pool):
    """⚠ THE NEGATIVE CONTROL THAT MAKES THE CASE ABOVE MEAN SOMETHING.

    Without this, a green SC#4 proves only that a guarantee was DELETED. Both spellings of "no
    identity" are driven — NULL and whitespace — because ``btrim`` is the difference between the
    constraint this migration wrote and the naive ``<> ''`` it could have written instead.

    The raised error must NAME ``connector_connections_has_a_service_identity``: a refusal by
    some other constraint would pass a bare ``pytest.raises`` while proving nothing.
    """
    async with pg_pool.acquire() as conn:
        catalog = await _identity_column_catalog(conn)
        _skip_unless_applied(catalog)
        org_id, created_by = await _seed_identity(conn)

        for label, identity in (("NULL", None), ("whitespace", "   ")):
            tx = conn.transaction()
            await tx.start()
            try:
                with pytest.raises(asyncpg.exceptions.CheckViolationError) as excinfo:
                    await conn.execute(
                        f"INSERT INTO public.{TABLE} "
                        "(org_id, created_by, capability, name, config, mcp_server_url, "
                        "service_id) "
                        "VALUES ($1, $2, NULL, $3, '{}'::jsonb, NULL, $4)",
                        org_id,
                        created_by,
                        f"gate 127 — identity is {label}",
                        identity,
                    )
                assert excinfo.value.constraint_name == IDENTITY_CONSTRAINT, (
                    f"a {label} service_id was refused, but by "
                    f"{excinfo.value.constraint_name!r} rather than by {IDENTITY_CONSTRAINT!r} "
                    "— the refusal proves nothing about the identity guarantee"
                )
            finally:
                await tx.rollback()


@pytest.mark.asyncio
@requires_pg
async def test_a_row_wearing_both_shapes_is_refused_on_insert_and_on_update(pg_pool):
    """⭐ D-211-11 — A GUARANTEE THIS TABLE HAS NEVER HAD.

    ``phase_types.py`` branches on ``mcp_tool_name`` FIRST, so a row carrying both a
    ``capability`` and an ``mcp_server_url`` silently takes the remote-server path and its
    capability goes INERT — the connection does something other than what its own verb says.

    ⚠ **THE UPDATE ARM IS NOT REDUNDANT.** The pre-migration measurement showed the INSERT
    being ACCEPTED; an UPDATE on an already-stored row is the OTHER door into the same state,
    and it is the one a service-role writer or a future PATCH reaches.
    """
    async with pg_pool.acquire() as conn:
        catalog = await _identity_column_catalog(conn)
        _skip_unless_applied(catalog)
        org_id, created_by = await _seed_identity(conn)

        # ── INSERT arm ────────────────────────────────────────────────────────────────────
        tx = conn.transaction()
        await tx.start()
        try:
            with pytest.raises(asyncpg.exceptions.CheckViolationError) as excinfo:
                await conn.execute(
                    f"INSERT INTO public.{TABLE} "
                    "(org_id, created_by, capability, name, config, secret_ciphertext, "
                    "mcp_server_url, service_id) "
                    "VALUES ($1, $2, 'post_message', $3, "
                    "'{\"default_channel\":\"#x\"}'::jsonb, 'enc:v1:fake', "
                    "'https://mcp.example.com/v1/mcp', 'slack')",
                    org_id,
                    created_by,
                    "gate 127 — both shapes at once",
                )
            assert excinfo.value.constraint_name == AMBIGUITY_CONSTRAINT, (
                f"refused by {excinfo.value.constraint_name!r}, not {AMBIGUITY_CONSTRAINT!r}"
            )
        finally:
            await tx.rollback()

        # ── UPDATE arm ────────────────────────────────────────────────────────────────────
        tx = conn.transaction()
        await tx.start()
        try:
            target = await conn.fetchval(
                f"SELECT id FROM public.{TABLE} WHERE capability IS NOT NULL LIMIT 1"
            )
            if target is None:
                pytest.skip(
                    "no capability row exists to widen into the ambiguous shape — ⚠ NOT A PASS"
                )
            with pytest.raises(asyncpg.exceptions.CheckViolationError) as excinfo:
                await conn.execute(
                    f"UPDATE public.{TABLE} SET mcp_server_url = "
                    "'https://mcp.example.com/v1/mcp' WHERE id = $1",
                    target,
                )
            assert excinfo.value.constraint_name == AMBIGUITY_CONSTRAINT, (
                f"refused by {excinfo.value.constraint_name!r}, not {AMBIGUITY_CONSTRAINT!r}"
            )
        finally:
            await tx.rollback()


@pytest.mark.asyncio
@requires_pg
async def test_the_identity_backfill_is_total_and_capability_is_byte_unchanged(pg_pool):
    """CONN-05 / D-211-03 — every row NAMES a service, and no row's verb moved.

    The second half is the one CONN-05 actually asks for: *"the three shipped adapters keep
    working, unchanged"*. It is asserted against the ``(id, capability)`` set captured BEFORE
    the migration, so "unchanged" is a comparison and not a claim.
    """
    async with pg_pool.acquire() as conn:
        catalog = await _identity_column_catalog(conn)
        _skip_unless_applied(catalog)

        missing = await conn.fetchval(
            f"SELECT count(*) FROM public.{TABLE} "
            f"WHERE {IDENTITY_COLUMN} IS NULL OR btrim({IDENTITY_COLUMN}) = ''"
        )
        assert missing == 0, (
            f"{missing} row(s) carry no service identity — the §2 backfill is not total, and "
            f"{IDENTITY_CONSTRAINT} could not have been added if it were run again today"
        )

        live = {
            str(r["id"]): r["capability"]
            for r in await conn.fetch(f"SELECT id, capability FROM public.{TABLE}")
        }
        seen = 0
        for row_id, expected in _PRE_MIGRATION_CAPABILITY.items():
            if row_id not in live:
                continue  # deleted since the baseline was taken; not this migration's doing
            seen += 1
            assert live[row_id] == expected, (
                f"row {row_id} had capability {expected!r} before migration 127 and has "
                f"{live[row_id]!r} now — CONN-05 says the verb is UNTOUCHED"
            )
        assert seen > 0, (
            "not one of the three baseline rows is still present, so this case compared "
            "nothing — re-capture the baseline rather than reading this as a pass"
        )


@pytest.mark.asyncio
@requires_pg
async def test_every_capability_row_advertises_its_own_action(pg_pool):
    """⭐ SC#2 AGAINST THE REAL ROWS — *a legacy row presents as a SERVICE with a named action*.

    Measured at 0 on both capability rows before the migration. This is the assertion that
    would have caught the closed loop: without §2b, ``discovered_tools`` stays ``[]`` on the day
    the phase ships, the picker renders its *no actions yet* state, and the only control that
    could fill it is one nobody can reach.
    """
    async with pg_pool.acquire() as conn:
        catalog = await _identity_column_catalog(conn)
        _skip_unless_applied(catalog)

        rows = await conn.fetch(
            f"SELECT id, name, capability, jsonb_array_length(discovered_tools) AS n, "
            "discovered_tools #>> '{0,name}' AS first_tool "
            f"FROM public.{TABLE} WHERE capability IS NOT NULL ORDER BY created_at"
        )
        assert rows, (
            "no capability row exists, so this case proves nothing about SC#2 — ⚠ NOT A PASS"
        )
        for r in rows:
            assert r["n"] and r["n"] >= 1, (
                f"row {r['name']!r} ({r['capability']}) carries an EMPTY discovered_tools — its "
                "action list is blank and SC#2 is FALSE for it. Re-run §2b of migration 127"
            )
            assert r["first_tool"] == r["capability"], (
                f"row {r['name']!r} advertises {r['first_tool']!r} but its capability is "
                f"{r['capability']!r}"
            )


# ═══════════════════════════════════════════════════════════════════════════════════════════
# THE CROSS-LANGUAGE SOURCE FENCE — NO SKIP, NO DATABASE, EVERY RUN
# ═══════════════════════════════════════════════════════════════════════════════════════════
#
# Migration 127 §2b spells the descriptor JSON a SECOND time, in SQL. Duplication held by care
# is duplication that drifts, so it is held by this instead — a source-reading fence in the
# exact discipline of `ExternalActionSection.tsx`'s `?raw` fence over `harness.py`.
#
# ⚠ It reads a file and a Python function. It touches NO database and carries NO skip
# decorator, so it runs in every environment including CI. A skip here is a bug in the test.

_DESCRIPTOR_BACKFILL = re.compile(
    r"SET\s+discovered_tools\s*=\s*\$descriptor\$(?P<literal>.*?)\$descriptor\$::jsonb"
    r"\s*WHERE\s+capability\s*=\s*'(?P<capability>[a-z_]+)'",
    re.DOTALL,
)


def _extract_descriptor_backfills(sql: str) -> list[tuple[str, str]]:
    """Every ``(capability, json_literal)`` pair migration 127 §2b writes.

    The capability is taken from the statement's own ``WHERE`` clause — the thing that actually
    decides which rows receive the literal — and NOT from the ``"name"`` inside the JSON. Taking
    it from the payload would make the comparison circular: a literal filed under the wrong
    capability would be compared against itself and pass.
    """
    return [(m.group("capability"), m.group("literal")) for m in _DESCRIPTOR_BACKFILL.finditer(sql)]


def test_the_backfill_extractor_is_falsified_on_synthetic_input_first():
    """⚠ THE CONTROL. An extractor nobody falsified is a `return []` that reports green.

    Two synthetic inputs: one that MUST yield a pair, and one that MUST NOT. The negative is the
    important half — a regex loose enough to match any UPDATE would find "three literals" in a
    file that had lost §2b entirely.
    """
    must_match = (
        "UPDATE public.connector_connections\n"
        '   SET discovered_tools = $descriptor$[{"name": "x"}]$descriptor$::jsonb\n'
        " WHERE capability = 'post_message'\n"
        "   AND (discovered_tools IS NULL OR discovered_tools = '[]'::jsonb);\n"
    )
    assert _extract_descriptor_backfills(must_match) == [("post_message", '[{"name": "x"}]')]

    # A whole-column RESHAPE, and an UPDATE of a DIFFERENT column, and a bare comment mentioning
    # the words. None of the three is a §2b backfill and none may be counted as one.
    must_not_match = (
        "ALTER TABLE public.connector_connections ALTER COLUMN discovered_tools SET DEFAULT '[]';\n"
        "UPDATE public.connector_connections SET tool_grants = '{}'::jsonb "
        "WHERE capability = 'post_message';\n"
        "-- SET discovered_tools = ... WHERE capability = 'send_email'\n"
    )
    assert _extract_descriptor_backfills(must_not_match) == []


def test_the_sql_backfill_matches_the_python_descriptor():
    """⭐ THE FENCE ITSELF — the SQL spelling and the Python spelling, held equal.

    Falsifiable in the direction that matters: change one description string in
    ``descriptors.py`` without re-generating migration 127 §2b and this goes RED naming the
    capability that drifted.

    ⚠ **WHAT IT DOES NOT CATCH, STATED SO NOBODY ASSUMES OTHERWISE:** a ROW written before an
    adapter's ``INPUT_SCHEMA`` changed keeps its older copy until that row is refreshed. This
    fence compares the migration to the code; it cannot compare a stored row to either. That
    staleness window is real, is stated in the migration's own comment block, and is what the
    capability arm of ``discover_connection_tools`` exists to close in one click.
    """
    assert MIGRATION_PATH.is_file(), f"migration 127 is missing at {MIGRATION_PATH}"
    sql = MIGRATION_PATH.read_text(encoding="utf-8")

    pairs = _extract_descriptor_backfills(sql)

    # NON-VACUITY, and it is an equality rather than a `>= 1`: there are exactly three
    # capabilities, so exactly three backfill statements. Two would mean a capability ships with
    # an empty action list; four would mean one is written twice with nothing saying which wins.
    assert len(pairs) == 3, (
        f"expected exactly 3 discovered_tools backfill statements in §2b, found {len(pairs)}: "
        f"{[cap for cap, _ in pairs]}"
    )
    assert {cap for cap, _ in pairs} == {"send_email", "create_ticket", "post_message"}, (
        f"§2b covers {sorted(cap for cap, _ in pairs)} — every capability owes one statement"
    )

    for capability, literal in pairs:
        from_sql = json.loads(literal)
        from_python = static_descriptors_for_capability(capability)
        assert from_sql == from_python, (
            f"migration 127 §2b's literal for {capability!r} has drifted from "
            f"static_descriptors_for_capability({capability!r}).\n"
            f"  SQL:    {json.dumps(from_sql, sort_keys=True)}\n"
            f"  Python: {json.dumps(from_python, sort_keys=True)}\n"
            "Re-generate it — never hand-edit it."
        )


def test_the_migration_grants_select_on_the_new_column():
    """⚠ THE 503 THAT LOOKS LIKE AN OUTAGE, fenced at the source.

    Migration 118 grants ``SELECT`` on this table COLUMN BY COLUMN, so a new column is
    unreadable by default and the read that breaks is EVERY read of the table — measured
    2026-08-25. The operator checkpoint verifies the live privilege; this asserts the migration
    could not have shipped without asking for it.
    """
    sql = MIGRATION_PATH.read_text(encoding="utf-8")
    body = "\n".join(
        line for line in sql.splitlines() if not line.lstrip().startswith("--")
    )
    assert "GRANT SELECT (" in body, "migration 127 grants nothing — every read of the table 503s"
    assert IDENTITY_COLUMN in body.split("GRANT SELECT (", 1)[1].split(")", 1)[0], (
        f"the GRANT does not name {IDENTITY_COLUMN}"
    )
    # T7, restated at the migration: the secret column is never granted, in any migration.
    assert "secret_ciphertext" not in body, (
        "migration 127 names secret_ciphertext in an executable statement — 118 excludes it by "
        "omission and nothing may re-grant it"
    )
