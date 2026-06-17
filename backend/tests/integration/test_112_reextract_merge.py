"""Phase 112 Wave-0 — re-extract merge guard preserves human edits (META-05, Plan 02).

LIVE :54322. AC7 of SPEC + Pitfall 1/2:
  - Edit field A via PATCH (→ _source[A]='user').
  - Re-extract refreshes the metadata blob.
  - Assert: A's user value is PRESERVED, _source[A] stays 'user';
            an un-edited extracted field B IS refreshed;
            a degrade (extraction returns None) does NOT wipe the human edit.

STUB for Plan 02 — the merge guard lands in `ingest_document` (the single
metadata-write site at documents.py:~1581) in Plan 02 of this phase. Until then
this test is xfail(strict=False): the route from Plan 01 (Task 2) writes
_source='user', but nothing yet preserves it across a re-extract, so the
assertion below would fail. Marked xfail so the suite stays GREEN; Plan 02
removes the xfail and flips it to a live merge proof.

Live-DB harness copied verbatim from test_111_flat_filter_compat.py. Skips when
:54322 unreachable.
"""

import asyncio
import json
import os
from uuid import uuid4

import asyncpg
import pytest
import pytest_asyncio


_POSTGRES_TEST_DSN = os.environ.get(
    "POSTGRES_DSN",
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
)


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


PG_AVAILABLE = _check_pg_available_sync()
pytestmark = pytest.mark.skipif(
    not PG_AVAILABLE,
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 112 merge tests",
)


@pytest_asyncio.fixture
async def pg_pool():
    async def _init(conn):
        await conn.set_type_codec(
            "jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog",
        )
    pool = await asyncpg.create_pool(
        _POSTGRES_TEST_DSN, min_size=1, max_size=4, init=_init,
    )
    try:
        yield pool
    finally:
        await pool.close()


@pytest_asyncio.fixture
async def seeded_doc(pg_pool):
    """Seed a throwaway user + a documents row carrying a human-edited field A
    (with _source) plus an extracted field B. The Plan-02 merge guard reads the
    prior _source map off THIS row."""
    user_id = uuid4()
    doc_id = uuid4()
    try:
        await pg_pool.execute(
            "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
            user_id, f"phase-112-merge-{user_id}@test.local",
        )
        await pg_pool.execute(
            "INSERT INTO documents (id, user_id, filename, file_path, file_size, mime_type, status, metadata) "
            "VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
            doc_id, user_id, "merge-probe.txt", f"{user_id}/merge-probe.txt",
            123, "text/plain", "completed",
            {
                "title": "Human Edited Title",        # field A (user)
                "document_type": "report",             # field B (extracted)
                "_source": {"title": "user"},
            },
        )
    except Exception as e:
        pytest.skip(f"seeded_doc fixture setup failed: {type(e).__name__}: {e}")
    yield (user_id, doc_id)
    for sql in (
        ("DELETE FROM documents WHERE id = $1", doc_id),
        ("DELETE FROM auth.users WHERE id = $1", user_id),
    ):
        try:
            await pg_pool.execute(*sql)
        except Exception:
            pass


@pytest.mark.xfail(
    reason="re-extract merge guard lands in Plan 02 (ingest_document write site); "
           "Plan 02 removes this xfail and flips it to a live merge proof",
    strict=False,
)
@pytest.mark.asyncio
async def test_reextract_preserves_user_field_and_refreshes_extracted(pg_pool, seeded_doc):
    """AC7 — after a re-extract, the human-edited field A is preserved (value +
    _source='user') while an extracted field B is refreshed.

    Plan 02 fills the merge guard in `ingest_document`. This test models the
    contract: simulate a re-extract that would overwrite the whole blob, then
    assert the guard restored the user field.
    """
    from app.api.documents import ingest_document  # noqa: F401 — Plan 02 wires the guard here

    user_id, doc_id = seeded_doc

    # Plan 02 will exercise the real re-extract path. Until the guard exists, the
    # merge-preservation assertion below is the falsifiable contract:
    # a fresh extraction yields {title: "Re-Extracted", document_type: "memo"};
    # the guard must keep title="Human Edited Title" (source=user) while
    # document_type refreshes to "memo".
    fresh_extraction = {"title": "Re-Extracted Title", "document_type": "memo"}

    # NOTE (Plan 02): replace this stand-in write with a real re-extract trigger.
    # The merge guard must read prior _source and restore user fields BEFORE the
    # documents UPDATE. We assert the POST-guard expectation here.
    await pg_pool.execute(
        "UPDATE documents SET metadata = $2 WHERE id = $1",
        doc_id, fresh_extraction,  # deliberately NO guard applied → this test xfails until Plan 02
    )

    row = await pg_pool.fetchrow("SELECT metadata FROM documents WHERE id = $1", doc_id)
    meta = row["metadata"]
    assert meta.get("title") == "Human Edited Title", "user-edited field A must survive re-extract"
    assert meta.get("_source", {}).get("title") == "user", "_source[A]='user' must persist"
    assert meta.get("document_type") == "memo", "an un-edited extracted field B must be refreshed"


@pytest.mark.xfail(
    reason="degrade-doesn't-wipe guard lands in Plan 02 (ingest_document)",
    strict=False,
)
@pytest.mark.asyncio
async def test_reextract_degrade_does_not_wipe_user_edits(pg_pool, seeded_doc):
    """Pitfall 2 — when extraction degrades (returns None), the merge guard must
    promote None→{} and still restore the human-edited fields, never wiping them."""
    user_id, doc_id = seeded_doc

    # Simulate a degrade that wholesale-overwrites metadata to {} (the bug Plan 02 guards).
    await pg_pool.execute(
        "UPDATE documents SET metadata = $2 WHERE id = $1",
        doc_id, {},  # degrade with no guard → wipes; xfails until Plan 02
    )

    row = await pg_pool.fetchrow("SELECT metadata FROM documents WHERE id = $1", doc_id)
    meta = row["metadata"] or {}
    assert meta.get("title") == "Human Edited Title", "a degrade must NOT wipe a human edit"
    assert meta.get("_source", {}).get("title") == "user"
