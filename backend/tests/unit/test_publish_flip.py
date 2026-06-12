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


@pytest.mark.skipif(
    not PG_AVAILABLE,
    reason=f"Local Postgres on {_DSN} not reachable; skipping live publish-flip integration test",
)
def test_draft_to_published_flip_allowed():
    """The immutability trigger ALLOWS a draft->published UPDATE (the publish flip) and
    STILL blocks a published->edit. Live behavior — proven against :54322 (Plan 05 lands
    the publish path; Plan 02 applied migration 070).

    Round-trip (the exact ``publish_definition`` flip + the 056/067 immutability guard):
      1. seed a DRAFT definition row
      2. UPDATE status='published' WHERE status='draft'  -> ALLOWED (the publish flip)
      3. UPDATE definition (a published->edit)            -> BLOCKED (check_violation)
    """
    import psycopg2
    from psycopg2.errors import CheckViolation

    conn = psycopg2.connect(_DSN, connect_timeout=5)
    conn.autocommit = False
    try:
        cur = conn.cursor()
        # A user the FK accepts (the seed user present on every local stack).
        cur.execute("SELECT id FROM auth.users LIMIT 1")
        owner = cur.fetchone()
        if owner is None:
            pytest.skip("no auth.users row on the local stack to own the seeded draft")
        owner_id = owner[0]

        # ── 1. seed a DRAFT ──────────────────────────────────────────────────────
        cur.execute(
            "INSERT INTO workflow_definitions (slug, version, name, status, definition, created_by) "
            "VALUES (%s, 1, %s, 'draft', %s::jsonb, %s) RETURNING id",
            (
                f"publish-flip-test-{os.getpid()}",
                "Publish Flip Test",
                '{"phases": []}',
                owner_id,
            ),
        )
        def_id = cur.fetchone()[0]

        # ── 2. the draft->published flip (publish_definition's exact UPDATE) — ALLOWED ──
        cur.execute(
            "UPDATE workflow_definitions SET status = 'published' "
            "WHERE id = %s AND status = 'draft' RETURNING version",
            (def_id,),
        )
        flipped = cur.fetchone()
        assert flipped is not None and flipped[0] == 1, "the draft->published flip must be allowed"

        # ── 3. a published->edit — BLOCKED by the immutability trigger ───────────
        with pytest.raises(CheckViolation):
            cur.execute(
                "UPDATE workflow_definitions SET definition = %s::jsonb WHERE id = %s",
                ('{"phases": [{"slug": "x"}]}', def_id),
            )
        conn.rollback()  # clear the aborted transaction + drop the seeded row
    finally:
        conn.close()
