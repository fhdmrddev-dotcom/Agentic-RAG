"""Phase 204 (SCHED-01 / D-204-08 / D-204-09) — every read and write of ``workflow_schedules``.

The ONE data-access home for schedules. Nothing outside this module writes the table, and the
API layer never composes SQL.

⚠ **THE OWNER PREDICATE IS IN EVERY STATEMENT, INCLUDING THE ONES THAT ALREADY HAVE AN ID.**
These queries run on the **service-role asyncpg pool**, which is ``BYPASSRLS`` — the migration's
policies are the belt, and *this file is the braces*. A ``WHERE id = $1`` with no
``AND user_id = $2`` is a cross-tenant read of somebody else's schedule, and it would look
perfectly ordinary in review. The single exception is ``claim_due_schedules``, which is the
POLLER's read: it has no caller identity by construction (nobody is logged in at 03:00) and is
therefore deliberately owner-agnostic. It is the only function here without the predicate, and
that is why it is the only one whose docstring says so.

⚠ **``inputs`` IS BOUND AS A PLAIN ``dict``.** The pool registers a jsonb codec
(``dependencies.py:_init_pg_connection``), so ``json.dumps`` at a call site produces a jsonb
**string scalar** — the defect that shipped on 484 of 484 ``workflow_phases.output`` rows and
needed migration 123 to repair. There is no ``json`` import in this module and there must not
be one.

⚠ **THE THREE-PLACE LOCKSTEP.** ``_SCHEDULE_COLUMNS`` below, ``WorkflowScheduleRead`` in
``models/schedule.py`` and the API's serializer move in ONE commit. ``response_model`` drops
undeclared keys **silently**, so a column added to two of the three produces a green DB test
beside an unchanged UI.
"""
from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

import asyncpg

from app.models.schedule import compute_next_run_at

logger = logging.getLogger(__name__)

# The client-facing projection. NEVER `select *` — see the module docblock's lockstep note.
_SCHEDULE_COLUMNS = (
    "id, workflow_id, name, cron_expression, interval_seconds, timezone, is_active, "
    "max_tokens_per_run, max_duration_seconds, inputs, last_run_at, next_run_at, "
    "last_status, created_at, updated_at"
)

# The poller's projection. It carries the identity columns the client projection deliberately
# omits, because launching a run needs the owner and the org and rendering a list does not.
_CLAIM_COLUMNS = (
    "id, org_id, user_id, workflow_id, name, cron_expression, interval_seconds, timezone, "
    "max_tokens_per_run, max_duration_seconds, inputs, next_run_at"
)


async def create_schedule(
    pool: asyncpg.Pool,
    *,
    workflow_id: UUID,
    user_id: UUID,
    name: str,
    cron_expression: str | None,
    interval_seconds: int | None,
    timezone: str,
    is_active: bool,
    max_tokens_per_run: int,
    max_duration_seconds: int,
    inputs: dict[str, Any],
) -> dict:
    """Insert one schedule and return it, with ``next_run_at`` ALREADY COMPUTED.

    ⚠ The first ``next_run_at`` is written here rather than left for the poller to fill in,
    because a NULL ``next_run_at`` is invisible to the poller's predicate — a schedule created
    without one would sit in the list looking active and would never fire. The column comment
    on the table says the same thing from the other side.

    ``org_id`` is NOT bound: the ``autofill_org_id_by_owner('user_id')`` trigger resolves it
    from the owner, and the column is ``NOT NULL``, so a user with no org is REFUSED rather
    than silently written into the wrong tenant.
    """
    next_run_at = compute_next_run_at(
        cron_expression=cron_expression,
        interval_seconds=interval_seconds,
        timezone=timezone,
    )
    row = await pool.fetchrow(
        f"INSERT INTO workflow_schedules "
        f"(workflow_id, user_id, name, cron_expression, interval_seconds, timezone, "
        f" is_active, max_tokens_per_run, max_duration_seconds, inputs, next_run_at) "
        f"VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) "
        f"RETURNING {_SCHEDULE_COLUMNS}",
        workflow_id,
        user_id,
        name,
        cron_expression,
        interval_seconds,
        timezone,
        is_active,
        max_tokens_per_run,
        max_duration_seconds,
        inputs,  # plain dict — the pool's jsonb codec encodes it (see the module docblock)
        next_run_at,
    )
    return dict(row)


async def get_schedule(
    pool: asyncpg.Pool, schedule_id: UUID, *, user_id: UUID
) -> dict | None:
    """One schedule, OWNER-SCOPED. ``None`` for a miss AND for someone else's row.

    The two cases are deliberately indistinguishable so the route can collapse both into one
    404 — a 403 on a foreign id confirms the id exists.
    """
    row = await pool.fetchrow(
        f"SELECT {_SCHEDULE_COLUMNS} FROM workflow_schedules "
        f"WHERE id = $1 AND user_id = $2",
        schedule_id,
        user_id,
    )
    return dict(row) if row is not None else None


async def get_schedule_for_launch(pool: asyncpg.Pool, schedule_id: UUID) -> dict | None:
    """One schedule with its identity columns — the manual-trigger and poller read.

    ⚠ Owner-AGNOSTIC by design, exactly like ``claim_due_schedules``. Every caller must have
    ALREADY established the caller's right to this row (the trigger route does so with
    ``get_schedule`` above, one statement earlier) or must have no caller at all (the poller).
    """
    row = await pool.fetchrow(
        f"SELECT {_CLAIM_COLUMNS} FROM workflow_schedules WHERE id = $1",
        schedule_id,
    )
    return dict(row) if row is not None else None


async def list_schedules_by_workflow(
    pool: asyncpg.Pool, workflow_id: UUID, *, user_id: UUID
) -> list[dict]:
    """Every schedule this user owns on one workflow, soonest-due first."""
    rows = await pool.fetch(
        f"SELECT {_SCHEDULE_COLUMNS} FROM workflow_schedules "
        f"WHERE workflow_id = $1 AND user_id = $2 "
        f"ORDER BY next_run_at NULLS LAST, created_at",
        workflow_id,
        user_id,
    )
    return [dict(r) for r in rows]


async def list_schedules_by_org(
    pool: asyncpg.Pool, *, user_id: UUID, limit: int = 200
) -> list[dict]:
    """Every schedule this user owns, across every workflow, with the workflow's NAME.

    ⚠ The name comes from a JOIN rather than from a denormalised column: a workflow can be
    renamed, and a schedule list that showed the name as of creation would be quietly wrong.
    The join is ``LEFT`` so a schedule whose definition row has gone still lists (its
    ``ON DELETE CASCADE`` should have taken it, and if it somehow did not, hiding the row is
    the worse failure — it would keep firing while being invisible).

    The name is the ONLY joined column. This is not the door to widening the projection with
    definition fields: `workflow_name` exists because a list of uuids cannot be read by a
    person, and any further field owes the three-place lockstep of its own.
    """
    rows = await pool.fetch(
        f"SELECT {', '.join('s.' + c.strip() for c in _SCHEDULE_COLUMNS.split(','))}, "
        f"d.name AS workflow_name "
        f"FROM workflow_schedules s "
        f"LEFT JOIN workflow_definitions d ON d.id = s.workflow_id "
        f"WHERE s.user_id = $1 "
        f"ORDER BY s.next_run_at NULLS LAST, s.created_at "
        f"LIMIT $2",
        user_id,
        limit,
    )
    return [dict(r) for r in rows]


async def update_schedule(
    pool: asyncpg.Pool,
    schedule_id: UUID,
    *,
    user_id: UUID,
    fields: dict[str, Any],
) -> dict | None:
    """Patch a schedule OWNER-SCOPED, recomputing ``next_run_at`` when the cadence moved.

    ⚠ **CHANGING ONE CADENCE FIELD CLEARS THE OTHER, HERE AND NOWHERE ELSE.** A row that
    already has an ``interval_seconds`` and is PATCHed with a ``cron_expression`` would
    otherwise carry both and be rejected by ``schedule_cadence_exactly_one`` — i.e. the table's
    invariant would be discovering an API bug at write time, as a 500. The clearing is done
    once, here, because the request model cannot see the row's current state and the route
    should not be composing column updates.

    ⚠ **``next_run_at`` IS RECOMPUTED WHENEVER THE CADENCE, THE ZONE, OR ``is_active`` MOVES.**
    Re-activating a schedule that has been off for a month must not fire immediately against a
    ``next_run_at`` a month in the past — that is a surprise charge, unattended, and the person
    who flipped the switch would have no reason to expect it.

    The column allow-list is a literal tuple. Field names reach an SQL string here, so nothing
    may reach it that this module did not spell itself.
    """
    _ALLOWED = (
        "name",
        "cron_expression",
        "interval_seconds",
        "timezone",
        "is_active",
        "max_tokens_per_run",
        "max_duration_seconds",
        "inputs",
    )
    patch = {k: v for k, v in fields.items() if k in _ALLOWED}
    if not patch:
        return await get_schedule(pool, schedule_id, user_id=user_id)

    current = await get_schedule(pool, schedule_id, user_id=user_id)
    if current is None:
        return None

    # One cadence field supplied ⇒ the other is cleared (see the docstring).
    if "cron_expression" in patch and patch["cron_expression"] is not None:
        patch["interval_seconds"] = None
    elif "interval_seconds" in patch and patch["interval_seconds"] is not None:
        patch["cron_expression"] = None

    merged = {**current, **patch}
    cadence_moved = any(
        k in patch for k in ("cron_expression", "interval_seconds", "timezone", "is_active")
    )
    if cadence_moved:
        patch["next_run_at"] = compute_next_run_at(
            cron_expression=merged.get("cron_expression"),
            interval_seconds=merged.get("interval_seconds"),
            timezone=merged.get("timezone") or "UTC",
        )

    columns = list(patch.keys())
    assignments = ", ".join(f"{c} = ${i + 3}" for i, c in enumerate(columns))
    row = await pool.fetchrow(
        f"UPDATE workflow_schedules SET {assignments} "
        f"WHERE id = $1 AND user_id = $2 "
        f"RETURNING {_SCHEDULE_COLUMNS}",
        schedule_id,
        user_id,
        *[patch[c] for c in columns],
    )
    return dict(row) if row is not None else None


async def delete_schedule(
    pool: asyncpg.Pool, schedule_id: UUID, *, user_id: UUID
) -> bool:
    """Delete one schedule OWNER-SCOPED. ``False`` for a miss and for a foreign row alike."""
    result = await pool.execute(
        "DELETE FROM workflow_schedules WHERE id = $1 AND user_id = $2",
        schedule_id,
        user_id,
    )
    # asyncpg returns the command tag, e.g. "DELETE 1".
    return result.rsplit(" ", 1)[-1] != "0"


async def claim_due_schedules(
    pool: asyncpg.Pool, *, limit: int = 10, now: Any = None
) -> list[dict]:
    """Atomically CLAIM every schedule that is due, advancing each one's ``next_run_at``.

    ⚠ **THIS FUNCTION IS THE ENTIRE DUPLICATE-FIRING MITIGATION (D-204-09), AND THE PROPERTY
    COMES FROM THE TRANSACTION, NOT FROM THE `SKIP LOCKED` KEYWORDS ALONE.** The sequence is:

      1. ``SELECT … FOR UPDATE SKIP LOCKED`` inside an explicit transaction. The row locks are
         held for the whole ``async with`` block. A second worker running this same statement
         **skips** the locked rows instead of waiting for them, so it neither blocks nor sees
         them.
      2. ``next_run_at`` is advanced **inside that same transaction**, before it commits.
      3. On commit, the rows the second worker will next see already have a FUTURE
         ``next_run_at`` and no longer satisfy the predicate.

    ⚠ **STEP 2 IS THE LOAD-BEARING ONE.** ``SKIP LOCKED`` alone only guarantees the two workers
    do not claim a row *simultaneously*; without the in-transaction advance, worker B running
    a millisecond after worker A commits would find the same row still due and fire it again.
    Do not "simplify" this into a select followed by a separate update.

    ⚠ **OWNER-AGNOSTIC BY DESIGN.** There is no caller identity at 03:00. The owner travels ON
    the claimed row (``user_id``), and every run this launches is stamped with it.

    ⚠ **A ROW WHOSE CADENCE CANNOT BE ADVANCED IS DEACTIVATED, NEVER LEFT DUE.** If
    ``compute_next_run_at`` raises (a cron that somehow reached the table malformed, an
    unresolvable zone after a tzdata change), the row is set ``is_active = false`` with
    ``last_status = 'cadence_error'`` rather than skipped — a row that is due and cannot be
    advanced would otherwise be re-claimed on every single tick, forever, launching a run each
    time. The claim is then not returned to the caller.

    Returns the claimed rows (``_CLAIM_COLUMNS``), which the caller launches. An empty list is
    the ordinary case.
    """
    claimed: list[dict] = []
    async with pool.acquire() as con:
        async with con.transaction():
            due = await con.fetch(
                f"SELECT {_CLAIM_COLUMNS} FROM workflow_schedules "
                f"WHERE is_active "
                f"  AND next_run_at IS NOT NULL "
                f"  AND next_run_at <= COALESCE($2::timestamptz, now()) "
                f"ORDER BY next_run_at "
                f"LIMIT $1 "
                f"FOR UPDATE SKIP LOCKED",
                limit,
                now,
            )
            for row in due:
                record = dict(row)
                try:
                    nxt = compute_next_run_at(
                        cron_expression=record.get("cron_expression"),
                        interval_seconds=record.get("interval_seconds"),
                        timezone=record.get("timezone") or "UTC",
                    )
                except Exception:  # noqa: BLE001 — see the docstring: never leave it due
                    logger.exception(
                        "schedule %s has an un-advanceable cadence; deactivating",
                        record["id"],
                    )
                    await con.execute(
                        "UPDATE workflow_schedules "
                        "SET is_active = false, last_status = 'cadence_error' "
                        "WHERE id = $1",
                        record["id"],
                    )
                    continue
                await con.execute(
                    "UPDATE workflow_schedules "
                    "SET next_run_at = $2, last_run_at = now() "
                    "WHERE id = $1",
                    record["id"],
                    nxt,
                )
                record["next_run_at"] = nxt
                claimed.append(record)
    return claimed


async def record_schedule_outcome(
    pool: asyncpg.Pool, schedule_id: UUID, *, status: str
) -> None:
    """Write the launch outcome hint onto the schedule.

    ⚠ ``last_status`` is a HINT and never a control input — nothing reads it to decide whether
    to fire. A failed write here must not take down the run that already launched, so this is
    the one function in the module that swallows its own exception.
    """
    try:
        await pool.execute(
            "UPDATE workflow_schedules SET last_status = $2 WHERE id = $1",
            schedule_id,
            status,
        )
    except Exception:  # noqa: BLE001
        logger.exception("record_schedule_outcome failed for %s (run is unaffected)", schedule_id)
