"""Phase 143 (WF-01, STRETCH) — Wave 0 RED backstops for the Starters shelf DB layer.

These pin the two DB-layer acceptance behaviors BEFORE Plan 02 implements them, so
each has a failing target to turn green:

  • SC-a — ``list_starter_workflows(pool)`` returns ONLY curated globals
    (``is_global=true AND definition->>'category'='starter'``) and EXCLUDES the 5
    mig-061 dev scaffolds (they lack the ``category`` marker). D-143-2 / D-143-2a.
  • SC-b — ``list_published_workflows(..., owned_only=True)`` narrows to
    ``created_by=me`` (no global double-render); ``owned_only=False`` (the DEFAULT
    the composer picker / WorkspacePanel / threads.py rely on) STILL returns the
    global row. D-143-2b / Pitfall 3 — the narrows-not-widens symmetry guard.

RED by construction: ``list_starter_workflows`` and the ``owned_only`` param do NOT
exist until Plan 02, so these fail at RUNTIME on ImportError / an unexpected-kwarg
TypeError — never on a syntax or fixture error (imports are INSIDE the test bodies,
Phase 102 posture, so ``--collect-only`` stays clean).

Live :54322 via asyncpg (a module-level skip-guard makes the file skip cleanly when
the local stack is down — never error). Seeded rows are cleaned up in ``finally``
(the test_103_draft_crud.py rollback precedent).
"""

from __future__ import annotations

import os

import pytest

_DSN = os.environ.get(
    "POSTGRES_DSN",
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
)

# The 5 mig-061 dev scaffolds — is_global published, but WITHOUT the category marker,
# so they must NOT appear in the Starters shelf (D-143-2a).
_SCAFFOLD_SLUGS = (
    "research_summarize",
    "plan_execute_verify",
    "literature_review",
    "doc_qa_human",
    "eval_coverage",
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

pytestmark = pytest.mark.skipif(
    not PG_AVAILABLE,
    reason=f"Local Postgres on {_DSN} not reachable; skipping live Starters-shelf tests",
)


def _starter_definition(slug: str) -> dict:
    """A minimal curated-starter definition body carrying the D-143-2 marker."""
    return {
        "slug": slug,
        "version": 1,
        "name": "RED Starter Test",
        "status": "published",
        "category": "starter",
        "phases": [],
    }


def _published_definition(slug: str, *, category: str | None = None) -> dict:
    """A minimal published definition body (optionally with a category marker)."""
    body: dict = {
        "slug": slug,
        "version": 1,
        "name": "RED Published Test",
        "status": "published",
        "phases": [],
    }
    if category is not None:
        body["category"] = category
    return body


async def _insert_definition(
    con, *, slug: str, name: str, definition: dict, created_by, is_global: bool
):
    """Direct is_global-capable INSERT (service role bypasses RLS). Returns the new id."""
    import json
    import uuid

    new_id = uuid.uuid4()
    await con.execute(
        "INSERT INTO workflow_definitions "
        "(id, slug, version, name, status, definition, created_by, is_global) "
        "VALUES ($1, $2, 1, $3, 'published', $4::jsonb, $5, $6)",
        new_id,
        slug,
        name,
        json.dumps(definition),
        created_by,
        is_global,
    )
    return new_id


# ── SC-a — the Starters query returns curated globals, excludes the scaffolds ──
@pytest.mark.asyncio
async def test_starters_query_excludes_scaffolds():
    """``list_starter_workflows`` returns the seeded ``category='starter'`` global row
    and does NOT return any of the 5 mig-061 dev scaffolds (they lack the marker)."""
    import asyncpg

    # RED: imported INSIDE the body — raises ImportError until Plan 02 adds the fn.
    from app.db.workflows import list_starter_workflows

    pool = await asyncpg.create_pool(dsn=_DSN, min_size=1, max_size=1)
    starter_slug = f"red-starter-{os.getpid()}"
    try:
        async with pool.acquire() as con:
            owner = await con.fetchval("SELECT id FROM auth.users ORDER BY id LIMIT 1")
            await _insert_definition(
                con,
                slug=starter_slug,
                name="RED Starter Test",
                definition=_starter_definition(starter_slug),
                created_by=owner,
                is_global=True,
            )
        try:
            rows = await list_starter_workflows(pool)
            slugs = {r["slug"] for r in rows}
            assert starter_slug in slugs  # the curated starter IS on the shelf
            # None of the 5 dev scaffolds appear (they carry no category marker):
            for scaffold in _SCAFFOLD_SLUGS:
                assert scaffold not in slugs, f"scaffold {scaffold} leaked into the Starters shelf"
        finally:
            async with pool.acquire() as con:
                await con.execute(
                    "DELETE FROM workflow_definitions WHERE slug = $1", starter_slug
                )
    finally:
        await pool.close()


# ── SC-b — owned_only narrows to mine; default keeps globals (Pitfall 3 guard) ─
@pytest.mark.asyncio
async def test_published_owned_only_and_default():
    """``list_published_workflows(owned_only=True)`` returns ONLY the caller's rows
    (no global double-render); ``owned_only=False`` (the DEFAULT the picker / run-soul
    / threads.py rely on) STILL returns the global row — the narrows-not-widens guard."""
    import asyncpg

    from app.db.workflows import list_published_workflows

    pool = await asyncpg.create_pool(dsn=_DSN, min_size=1, max_size=1)
    own_slug = f"red-owned-{os.getpid()}"
    global_slug = f"red-global-{os.getpid()}"
    try:
        async with pool.acquire() as con:
            user_rows = await con.fetch("SELECT id FROM auth.users ORDER BY id LIMIT 2")
        if len(user_rows) < 2:
            pytest.skip("need >=2 auth.users rows for the owned-vs-global symmetry test")
        owner, other = user_rows[0]["id"], user_rows[1]["id"]
        try:
            async with pool.acquire() as con:
                await _insert_definition(
                    con,
                    slug=own_slug,
                    name="RED Owned Test",
                    definition=_published_definition(own_slug),
                    created_by=owner,
                    is_global=False,
                )
                await _insert_definition(
                    con,
                    slug=global_slug,
                    name="RED Global Test",
                    definition=_published_definition(global_slug),
                    created_by=other,
                    is_global=True,
                )

            # RED: the owned_only kwarg does NOT exist until Plan 02 → TypeError.
            owned = await list_published_workflows(pool, user_id=owner, owned_only=True)
            owned_slugs = {r["slug"] for r in owned}
            assert own_slug in owned_slugs  # my own published row is present
            assert global_slug not in owned_slugs  # the global row is NOT double-rendered

            # The DEFAULT path (what the picker / run-soul / threads.py call) still
            # sees the global row — narrows-not-widens is scoped, not blanket.
            default = await list_published_workflows(pool, user_id=owner)
            default_slugs = {r["slug"] for r in default}
            assert own_slug in default_slugs
            assert global_slug in default_slugs  # global still visible by default
        finally:
            async with pool.acquire() as con:
                await con.execute(
                    "DELETE FROM workflow_definitions WHERE slug = ANY($1::text[])",
                    [own_slug, global_slug],
                )
    finally:
        await pool.close()
