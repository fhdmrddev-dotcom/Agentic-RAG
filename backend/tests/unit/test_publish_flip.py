"""Phase 102 (QUAL-01) — the live-DB draft->published flip trigger behavior.

Wave 0 stub (Plan 01 Task 1). This is the ONE live-DB row of the Phase-102 unit set:
it asserts the ``workflow_definitions_block_published_update`` immutability trigger
ALLOWS a draft->published UPDATE (the publish flip, D-07) and STILL blocks a
published->edit (the 056/067 immutability guarantee).

Kept ``@pytest.mark.xfail(strict=False)`` until Plan 05 + the live migration apply
(Plan 02). A module-level skip-if-no-DB guard (psycopg2 :54322) makes it skip cleanly
(never error) when the local stack is down — so the unit suite exits 0 today.

CONVENTION: imports INSIDE the test body; the DB connect is guarded.
"""

from __future__ import annotations

import os

import pytest

_DSN = os.environ.get(
    "POSTGRES_DSN",
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
)


def _pg_reachable(dsn: str = _DSN) -> bool:
    """Probe local Postgres availability without raising (skipif guard)."""
    try:
        import psycopg2

        conn = psycopg2.connect(dsn, connect_timeout=2)
        conn.close()
        return True
    except Exception:
        return False


PG_AVAILABLE = _pg_reachable()


@pytest.mark.xfail(strict=False, reason="Plan 05 + live migration apply (Plan 02) not yet landed")
@pytest.mark.skipif(
    not PG_AVAILABLE,
    reason=f"Local Postgres on {_DSN} not reachable; skipping live publish-flip integration test",
)
def test_draft_to_published_flip_allowed():
    """The immutability trigger ALLOWS a draft->published UPDATE (the publish flip) and
    STILL blocks a published->edit. Live behavior — proven against :54322 once Plan 05
    lands the publish path and Plan 02 applies migration 070."""
    import psycopg2

    conn = psycopg2.connect(_DSN, connect_timeout=5)
    try:
        cur = conn.cursor()
        # The actual flip + re-edit-block assertions are Plan 05's to satisfy against
        # a seeded draft definition. Here the contract is: the trigger permits the
        # draft->published transition but forbids editing a published row.
        cur.execute(
            "SELECT 1 FROM information_schema.triggers "
            "WHERE event_object_table = 'workflow_definitions'"
        )
        _ = cur.fetchall()
        # Plan 05 replaces this stub body with the real flip + re-edit-block round-trip.
        raise AssertionError("publish-flip round-trip not yet implemented (Plan 05)")
    finally:
        conn.close()
