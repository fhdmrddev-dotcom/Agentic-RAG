"""Phase 231 — the four-site visibility lockstep, driven against the real database.

⚠ WHY THIS IS AN INTEGRATION TEST AND NOT A UNIT TEST.
The visibility rule lives in RLS policies and in two ``SECURITY DEFINER`` bodies. A mock cannot
observe either. Phase 230 shipped 30/30 green unit tests over a checkpoint that was corrupt in the
database, because every test passed a dict in directly and never round-tripped through Postgres —
the same class of miss would hide a leak here.

⚠ H-1 — the four assertions below were driven **RED before the widening existed** (they fail with
``UndefinedColumnError: source_connection_id``) and are kept in the suite afterwards. A guard nobody
has seen fail is not a guard.

The four sites, all of which must answer identically:
  1. ``documents`` SELECT policy
  2. ``document_chunks`` SELECT policy
  3. ``match_document_chunks``   (SECURITY DEFINER — bypasses RLS)
  4. ``keyword_search_chunks``   (SECURITY DEFINER — bypasses RLS)
"""

from __future__ import annotations

import os
import uuid

import asyncpg
import pytest

DSN = os.getenv("TEST_PG_DSN", "postgresql://postgres:postgres@127.0.0.1:54322/postgres")

pytestmark = pytest.mark.asyncio


async def _as_user(con: asyncpg.Connection, user_id: uuid.UUID) -> None:
    """Enter the RLS session of one authenticated user.

    ``SET LOCAL`` so it unwinds with the transaction — a leaked role would make every later
    assertion in the same connection meaningless.
    """
    await con.execute("SET LOCAL ROLE authenticated")
    await con.execute(
        "SELECT set_config('request.jwt.claims', $1, true)",
        f'{{"sub":"{user_id}","role":"authenticated"}}',
    )


async def _as_superuser(con: asyncpg.Connection) -> None:
    await con.execute("RESET ROLE")


async def _visible_at_four_sites(con: asyncpg.Connection, viewer, doc_id, chunk_id) -> dict:
    """Ask all four sites the same question in one RLS session. Returns four booleans."""
    await _as_user(con, viewer)
    doc = await con.fetchval("SELECT count(*) FROM documents WHERE id = $1", doc_id)
    chunk = await con.fetchval("SELECT count(*) FROM document_chunks WHERE id = $1", chunk_id)

    # The DEFINER functions bypass RLS, which is exactly why they are the dangerous pair.
    # A zero-vector query with threshold -1 matches everything the predicate allows through.
    vec = "[" + ",".join(["0"] * 1536) + "]"
    sem = await con.fetchval(
        "SELECT count(*) FROM match_document_chunks($1::vector, $2::uuid, 100, -1.0)",
        vec,
        viewer,
    )
    kw = await con.fetchval(
        "SELECT count(*) FROM keyword_search_chunks($1, $2::uuid, 100)",
        "phase231needle",
        viewer,
    )
    return {
        "documents_policy": doc > 0,
        "chunks_policy": chunk > 0,
        "match_document_chunks": sem > 0,
        "keyword_search_chunks": kw > 0,
    }


@pytest.fixture
async def fixture_org():
    """Two users in ONE org, a connection owned by A, and a connection-placed document.

    Everything is created as superuser (RLS off) and rolled back, so the developer database is
    byte-unchanged whether the test passes or fails.
    """
    con = await asyncpg.connect(DSN)
    tx = con.transaction()
    await tx.start()
    try:
        org_id = uuid.uuid4()
        user_a = uuid.uuid4()
        user_b = uuid.uuid4()

        await con.execute(
            "INSERT INTO auth.users (id, instance_id, aud, role, email) "
            "VALUES ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2),"
            "       ($3,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$4)",
            user_a, f"a-{user_a}@t.local", user_b, f"b-{user_b}@t.local",
        )
        await con.execute(
            "INSERT INTO organizations (id, name) VALUES ($1, $2)", org_id, f"T-{org_id}"
        )
        await con.execute(
            "INSERT INTO org_members (org_id, user_id, role) VALUES ($1,$2,'org-admin'),($1,$3,'member')",
            org_id, user_a, user_b,
        )

        conn_id = uuid.uuid4()
        await con.execute(
            # ⚠ 'post_message' is used because capability only permits
            # send_email | create_ticket | post_message — all OUTBOUND writes. The connection
            # model has NO inbound/file capability yet; Phase 232 must add one. This test is
            # about visibility, not capability semantics, so any legal value serves.
            "INSERT INTO connector_connections (id, org_id, created_by, capability, name, config, service_id) "
            "VALUES ($1,$2,$3,'post_message','T-conn','{}'::jsonb,'phase231-test')",
            conn_id, org_id, user_a,
        )

        doc_id = uuid.uuid4()
        await con.execute(
            "INSERT INTO documents (id, user_id, org_id, filename, file_path, file_size, "
            "mime_type, status, source_connection_id, ingest_visibility, is_latest) "
            "VALUES ($1,$2,$3,'phase231.txt','p/phase231.txt',10,'text/plain','completed',$4,'private',true)",
            doc_id, user_a, org_id, conn_id,
        )
        chunk_id = uuid.uuid4()
        await con.execute(
            "INSERT INTO document_chunks (id, document_id, user_id, org_id, content, chunk_index, embedding) "
            "VALUES ($1,$2,$3,$4,'phase231needle body text',0,$5::vector)",
            chunk_id, doc_id, user_a, org_id, "[" + ",".join(["0.001"] * 1536) + "]",
        )

        yield {
            "con": con, "org_id": org_id, "user_a": user_a, "user_b": user_b,
            "conn_id": conn_id, "doc_id": doc_id, "chunk_id": chunk_id,
        }
    finally:
        await tx.rollback()
        await con.close()


async def test_private_connection_is_invisible_to_a_second_user_at_all_four_sites(fixture_org):
    """SC#2 — the NEGATIVE case. This is the assertion the phase exists to make true.

    A second person in the SAME organisation must not reach the document by ANY route: not the
    Library, not search, not the agent's retrieval.
    """
    f = fixture_org
    seen = await _visible_at_four_sites(f["con"], f["user_b"], f["doc_id"], f["chunk_id"])
    await _as_superuser(f["con"])

    leaking = [site for site, visible in seen.items() if visible]
    assert not leaking, (
        f"LEAK — a private connection's document reached another org member at: {leaking}. "
        f"Full four-site answer: {seen}"
    )


async def test_owner_still_sees_their_own_private_connection_document(fixture_org):
    """The negative case must not be satisfied by denying everyone — that would pass vacuously."""
    f = fixture_org
    seen = await _visible_at_four_sites(f["con"], f["user_a"], f["doc_id"], f["chunk_id"])
    await _as_superuser(f["con"])

    missing = [site for site, visible in seen.items() if not visible]
    assert not missing, f"the OWNER lost access at: {missing}. Full answer: {seen}"


async def test_widening_to_org_reaches_all_four_sites_in_lockstep(fixture_org):
    """SC#3 — the four-site lockstep, made observable.

    Widening must move the Library AND the agent's retrieval together. Either direction of
    disagreement is the failure this phase is written to prevent; the dangerous one is retrieval
    seeing what the Library hides.
    """
    f = fixture_org
    await _as_superuser(f["con"])
    await f["con"].execute(
        "UPDATE documents SET ingest_visibility = 'org' WHERE id = $1", f["doc_id"]
    )

    seen = await _visible_at_four_sites(f["con"], f["user_b"], f["doc_id"], f["chunk_id"])
    await _as_superuser(f["con"])

    assert len(set(seen.values())) == 1, (
        f"THE FOUR SITES DISAGREE after widening to org — {seen}. "
        "A Library that shows what retrieval will not quote is annoying; retrieval quoting what "
        "the Library hides is the leak."
    )
    assert all(seen.values()), f"widening to org did not reach every site: {seen}"


async def test_unrecognised_visibility_value_fails_closed(fixture_org):
    """An unrecognised state is not a pass. The resolver's ELSE arm must deny."""
    f = fixture_org
    await _as_superuser(f["con"])
    # Bypass the CHECK constraint deliberately — we are testing the PREDICATE, not the constraint.
    await f["con"].execute(
        "ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_ingest_visibility_check"
    )
    await f["con"].execute(
        "UPDATE documents SET ingest_visibility = 'everyone-lol' WHERE id = $1", f["doc_id"]
    )

    seen = await _visible_at_four_sites(f["con"], f["user_b"], f["doc_id"], f["chunk_id"])
    await _as_superuser(f["con"])

    leaking = [site for site, visible in seen.items() if visible]
    assert not leaking, f"an UNRECOGNISED visibility value failed OPEN at: {leaking}"


async def test_dept_is_inert_and_does_not_invent_a_third_access_level(fixture_org):
    """D-5 — the inert department branch.

    While no department membership exists there is no narrower answer to give, so 'dept' reads
    org-wide, which is exactly today's behaviour. This test pins that it is DERIVED from
    dept_members being empty, not hard-coded — so the branch cannot silently over-share on the
    day departments become real.
    """
    f = fixture_org
    await _as_superuser(f["con"])
    assert await f["con"].fetchval("SELECT count(*) FROM dept_members") == 0, (
        "this test's premise is that dept_members is empty; it is not, so the inert branch's "
        "behaviour has changed and Phase 231's D-5 assumption needs re-deciding"
    )

    await f["con"].execute(
        "UPDATE documents SET ingest_visibility = 'dept' WHERE id = $1", f["doc_id"]
    )
    seen = await _visible_at_four_sites(f["con"], f["user_b"], f["doc_id"], f["chunk_id"])
    await _as_superuser(f["con"])
    assert all(seen.values()), f"inert dept should read org-wide while dept_members is empty: {seen}"

    # Now prove it is DERIVED: give the org a department member and the branch must stop granting.
    dept_id = uuid.uuid4()
    await f["con"].execute(
        "INSERT INTO departments (id, org_id, name) VALUES ($1,$2,'T-dept')", dept_id, f["org_id"]
    )
    await f["con"].execute(
        "INSERT INTO dept_members (dept_id, org_id, user_id, role) VALUES ($1,$2,$3,'member')",
        dept_id, f["org_id"], f["user_a"],
    )
    seen_after = await _visible_at_four_sites(f["con"], f["user_b"], f["doc_id"], f["chunk_id"])
    await _as_superuser(f["con"])
    leaking = [s for s, v in seen_after.items() if v]
    assert not leaking, (
        f"the inert dept branch kept granting org-wide after a department became real, at "
        f"{leaking}. It must fail CLOSED on activation so departments cannot ship by accident."
    )
