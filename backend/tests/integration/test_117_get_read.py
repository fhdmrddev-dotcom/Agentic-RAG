"""Phase 117 Wave-0 — the shared get_related_documents GET-shape read proof (SC#1/SC#2).

Drives the extracted ``document_relationship_service.get_related_documents`` (Task 2 — the
read core the new GET route in Plan 02 wraps) against live :54322 and asserts the panel's
read contract:

  * Returns a dict with ``subject``, ``total``, and ``documents[]``; each row carries
    ``direction`` ("outgoing"|"incoming"), ``label`` (rel_type verbatim for outgoing, the
    inverse label for incoming), AND ``relationship_id`` (the edge id — the panel's remove
    ✕ needs it; the agent handler dropped it pre-117, A6).
  * Resolves edges over the subject's FULL ``(user_id, filename)`` version set
    (follow-to-latest): an edge keyed on v1 surfaces under v2 after a re-upload.
  * ``test_created_link_appears`` — create via ``create_relationship`` → the row appears in
    the next read; delete via ``delete_relationship`` → it disappears (the SC#2
    create/remove reflects-live contract the panel's re-fetch relies on).

Clones the live-DB harness (asyncpg pool, ``_supabase_or_skip``, FK-safe seed/teardown)
from ``test_116_version_stable.py`` / ``test_116_tool_read.py``. Imports inside the test
bodies; xfail(strict=False) until Task 2 ships the shared fn.
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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 117 get-read test",
)


async def _table_exists(pool, table: str) -> bool:
    return bool(await pool.fetchval(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
        "WHERE table_schema='public' AND table_name=$1)",
        table,
    ))


def _read_local_supabase_env():
    env_path = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
    if not os.path.exists(env_path):
        return None
    url = key = None
    try:
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k, v = k.strip(), v.strip().strip('"').strip("'")
                if k == "SUPABASE_URL":
                    url = v
                elif k == "SUPABASE_SERVICE_ROLE_KEY":
                    key = v
    except OSError:
        return None
    if not url or not key:
        return None
    return url, key


def _supabase_or_skip():
    creds = _read_local_supabase_env()
    if creds is None:
        pytest.skip("local SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not found in backend/.env")
    url, key = creds
    try:
        from supabase import create_client
        client = create_client(url, key)
    except Exception as e:  # noqa: BLE001
        pytest.skip(f"supabase service-role client unavailable: {type(e).__name__}: {e}")
    try:
        client.table("document_relationships").select("id").limit(1).execute()
    except Exception as e:  # noqa: BLE001
        pytest.skip(f"local Supabase REST gate unreachable: {type(e).__name__}: {e}")
    return client


@pytest_asyncio.fixture
async def pg_pool():
    async def _init(conn):
        await conn.set_type_codec(
            "jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog",
        )
    pool = await asyncpg.create_pool(_POSTGRES_TEST_DSN, min_size=1, max_size=4, init=_init)
    try:
        yield pool
    finally:
        await pool.close()


async def _seed_user(pool, label):
    user_id = uuid4()
    await pool.execute(
        "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
        user_id, f"phase-117-get-read-{label}-{user_id}@test.local",
    )
    return user_id


async def _seed_doc(pool, user_id, *, title, filename=None, is_latest=True, version=1):
    doc_id = uuid4()
    fname = filename or f"{title}-{doc_id}.txt"
    await pool.execute(
        "INSERT INTO documents (id, user_id, filename, file_path, file_size, mime_type, "
        "status, metadata, created_at, is_latest, version_number) "
        "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), $9, $10)",
        doc_id, user_id, fname,
        f"{user_id}/{doc_id}.txt", 100, "text/plain", "completed", {"title": title},
        is_latest, version,
    )
    return str(doc_id), fname


async def _seed_relationship(pool, owner_id, source_id, target_id, rel_type):
    rel_id = uuid4()
    await pool.execute(
        "INSERT INTO public.document_relationships "
        "(id, user_id, source_doc_id, target_doc_id, rel_type) VALUES ($1, $2, $3, $4, $5)",
        rel_id, owner_id, source_id, target_id, rel_type,
    )
    return str(rel_id)


@pytest_asyncio.fixture
async def one_user_both_directions(pg_pool):
    """One user, a SUBJECT, an OUTGOING edge (subject supersedes a doc) + an INCOMING edge
    (another doc references the subject). All three docs the user's own → all readable. The
    re-upload helper below mutates the subject in-place for the follow-to-latest test."""
    user = await _seed_user(pg_pool, "u")

    subject, subject_fname = await _seed_doc(pg_pool, user, title="subject")
    superseded, _ = await _seed_doc(pg_pool, user, title="old-version")  # outgoing target
    referer, _ = await _seed_doc(pg_pool, user, title="citing-doc")      # incoming source

    rel_out = await _seed_relationship(pg_pool, user, subject, superseded, "supersedes")
    rel_in = await _seed_relationship(pg_pool, user, referer, subject, "references")

    ctx = {
        "user": user, "subject": subject, "subject_fname": subject_fname,
        "superseded": superseded, "referer": referer,
        "rel_out": rel_out, "rel_in": rel_in,
    }
    try:
        yield ctx
    finally:
        for sql in (
            "DELETE FROM public.document_relationships WHERE user_id = $1",
            "DELETE FROM public.documents WHERE user_id = $1",
            "DELETE FROM auth.users WHERE id = $1",
        ):
            try:
                await pg_pool.execute(sql, user)
            except Exception:
                pass


@pytest.mark.xfail(
    strict=False,
    reason="Task 2 ships the shared get_related_documents; GREEN once it lands.",
)
@pytest.mark.asyncio
async def test_get_returns_both_directions_with_relationship_id(pg_pool, one_user_both_directions):
    """The shared fn returns subject/total/documents with direction + label + relationship_id
    for BOTH directions, inverse label on the incoming row (SC#1 + the A6 relationship_id)."""
    if not await _table_exists(pg_pool, "document_relationships"):
        pytest.skip("document_relationships table absent")

    from app.services import document_relationship_service as svc

    sb = _supabase_or_skip()
    ctx = one_user_both_directions

    out = await svc.get_related_documents(str(ctx["user"]), document_id=ctx["subject"], supabase=sb)

    assert out is not None, "a readable subject must return a dict, never None"
    assert out["subject"]["document_id"] == ctx["subject"]
    assert out.get("total") == 2, f"expected 1 outgoing + 1 incoming, got {out}"

    by_dir = {(r["direction"], r["label"]): r for r in out["documents"]}
    # OUTGOING keeps the verb: subject SUPERSEDES the old version.
    assert ("outgoing", "supersedes") in by_dir, f"missing outgoing supersedes edge: {out}"
    assert by_dir[("outgoing", "supersedes")]["document_id"] == ctx["superseded"]
    # INCOMING flips to the inverse: a doc REFERENCES subject → subject is "referenced_by".
    assert ("incoming", "referenced_by") in by_dir, f"missing incoming referenced_by edge: {out}"
    assert by_dir[("incoming", "referenced_by")]["document_id"] == ctx["referer"]

    # A6 — every row carries relationship_id (= the edge id) so the panel's remove ✕ works.
    assert by_dir[("outgoing", "supersedes")]["relationship_id"] == ctx["rel_out"]
    assert by_dir[("incoming", "referenced_by")]["relationship_id"] == ctx["rel_in"]
    for r in out["documents"]:
        assert r.get("relationship_id"), f"every row must carry relationship_id: {r}"


@pytest.mark.xfail(
    strict=False,
    reason="Task 2 ships the shared get_related_documents; GREEN once it lands.",
)
@pytest.mark.asyncio
async def test_get_follows_to_latest_over_version_set(pg_pool, one_user_both_directions):
    """An edge keyed on the subject's v1 id still surfaces under v2 after a re-upload (the
    follow-to-latest guarantee over the FULL (user_id, filename) version set)."""
    if not await _table_exists(pg_pool, "documents"):
        pytest.skip("documents table absent")

    from app.services import document_relationship_service as svc

    sb = _supabase_or_skip()
    ctx = one_user_both_directions

    # Re-upload the SUBJECT: flip v1 to is_latest=False, INSERT v2 (new uuid, is_latest=True),
    # same filename — the documents.py:441-486 mechanism performed directly.
    await pg_pool.execute(
        "UPDATE documents SET is_latest = false WHERE user_id = $1 AND filename = $2",
        ctx["user"], ctx["subject_fname"],
    )
    v2_id, _ = await _seed_doc(
        pg_pool, ctx["user"], title="subject", filename=ctx["subject_fname"],
        is_latest=True, version=2,
    )

    # Driving the read on the NEW v2 id must STILL surface the v1-keyed edges.
    out = await svc.get_related_documents(str(ctx["user"]), document_id=v2_id, supabase=sb)
    assert out is not None and out.get("total", 0) == 2, (
        f"the v1-keyed edges must surface under the v2 subject after re-upload; got {out}"
    )
    surfaced = {r["document_id"] for r in out["documents"]}
    assert ctx["superseded"] in surfaced and ctx["referer"] in surfaced, (
        f"both v1-keyed edges must follow forward to v2; got {surfaced}"
    )


@pytest_asyncio.fixture
async def user_with_two_docs(pg_pool):
    """A user + two own docs (subject + target), NO edge yet — for create/remove reflection."""
    user = await _seed_user(pg_pool, "cr")
    subject, _ = await _seed_doc(pg_pool, user, title="cr-subject")
    target, _ = await _seed_doc(pg_pool, user, title="cr-target")
    ctx = {"user": user, "subject": subject, "target": target}
    try:
        yield ctx
    finally:
        for sql in (
            "DELETE FROM public.document_relationships WHERE user_id = $1",
            "DELETE FROM public.documents WHERE user_id = $1",
            "DELETE FROM auth.users WHERE id = $1",
        ):
            try:
                await pg_pool.execute(sql, user)
            except Exception:
                pass


@pytest.mark.xfail(
    strict=False,
    reason="Task 2 ships the shared get_related_documents; GREEN once it lands.",
)
@pytest.mark.asyncio
async def test_created_link_appears(pg_pool, user_with_two_docs):
    """create_relationship → the row appears in the next read; delete_relationship → it
    disappears (the SC#2 create/remove reflects-live contract the panel re-fetch relies on)."""
    if not await _table_exists(pg_pool, "document_relationships"):
        pytest.skip("document_relationships table absent")

    from app.services import document_relationship_service as svc

    sb = _supabase_or_skip()
    ctx = user_with_two_docs
    caller = str(ctx["user"])

    # Empty to start.
    before = await svc.get_related_documents(caller, document_id=ctx["subject"], supabase=sb)
    assert before is not None and before.get("total", 0) == 0, f"no edges yet; got {before}"

    # Create an outgoing edge subject → target.
    edge = await svc.create_relationship(caller, ctx["subject"], ctx["target"], "references", supabase=sb)
    rel_id = edge["id"]

    # It appears in the next read, carrying its relationship_id.
    after = await svc.get_related_documents(caller, document_id=ctx["subject"], supabase=sb)
    assert after.get("total", 0) == 1, f"the created link must appear in the next read; got {after}"
    row = after["documents"][0]
    assert row["document_id"] == ctx["target"]
    assert row["direction"] == "outgoing"
    assert row["relationship_id"] == rel_id

    # Remove it → it disappears (remove-reflects).
    removed = await svc.delete_relationship(caller, rel_id, supabase=sb)
    assert removed is True
    gone = await svc.get_related_documents(caller, document_id=ctx["subject"], supabase=sb)
    assert gone.get("total", 0) == 0, f"the removed link must disappear from the read; got {gone}"
