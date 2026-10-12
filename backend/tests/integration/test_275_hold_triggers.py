"""Phase 275-01 (RET-02 / D-05 / D-14 / D-15 / D-16 / D-17 / D-19) — a legal hold is refused BY THE
DATABASE, on every delete path, on the LIVE local database (migration 204).

What this proves, and how it refuses to prove it vacuously:

* **Every path, not only the app's.** A held document's DELETE is refused with SQLSTATE ``PT409``
  as its ``authenticated`` owner, through the superuser/service pool, through the
  ``auth.users`` -> ``documents`` FK cascade (``documents_user_id_fkey ON DELETE CASCADE``, measured
  to fire the row trigger at depth 2, RESEARCH M-3), through the ``folders.parent_id`` cascade, and by
  ``TRUNCATE``. Every refusal is asserted by SQLSTATE, never by message text.
* **Coverage is evaluated at check time (D-05).** A folder hold placed BEFORE a document lands in a
  grandchild folder still covers it.
* **A hold stops deletion only (D-16).** Metadata UPDATE on a held document succeeds; deleting ANY
  version row of a held family is refused; moving a held document or folder out of the held subtree
  succeeds and leaves it held (sticky coverage).
* **No matter name in a refusal (D-17).** The PT409 message names the document id and NOT the matter.
* **Archive state is the service's (D-19).** An owner UPDATE of ``archived_at`` /
  ``archived_policy_name`` is refused; the service role may change them.
* **Positive controls everywhere.** An unheld sibling deletes; a released hold stops refusing; a hold
  in org A never refuses a delete in org B — so "refused" can never mean "every delete is broken".

⛔ Cleanup RELEASES every hold first, then deletes the hold rows, then the documents and folders. A
cleanup that deleted documents first would be refused by the very trigger under test and would leak
rows into the dev database. Skip-guarded on :54322 — a skipped run is a SKIP, never a pass.
"""
from __future__ import annotations

from uuid import UUID, uuid4

import asyncpg
import pytest

from tests.integration._rls_harness import assert_auth_uid, open_user_conn, requires_pg
from tests.integration.test_163_rls_documents import _add_comember, _drop_user

pytestmark = requires_pg

MATTER = "Halden v. Crane — privileged matter"


# ── seed helpers (shared by the other test_275_* live suites) ───────────────────────────────

async def _folder(pool, *, owner, org, name, parent=None, shared=True):
    fid = uuid4()
    await pool.execute(
        "INSERT INTO public.folders (id, user_id, org_id, name, parent_id, is_org_shared) "
        "VALUES ($1,$2,$3,$4,$5,$6)",
        fid, UUID(str(owner)), UUID(str(org)), name, parent, shared,
    )
    return fid


async def _doc(pool, *, owner, org, folder=None, name=None, latest=True, version=1, metadata=None):
    did = uuid4()
    await pool.execute(
        "INSERT INTO public.documents (id, user_id, org_id, folder_id, filename, file_path, file_size, "
        "mime_type, status, is_latest, version_number, chunk_count, metadata) "
        "VALUES ($1,$2,$3,$4,$5,$6,100,'text/markdown','completed',$7,$8,1,$9::jsonb)",
        did, UUID(str(owner)), UUID(str(org)), folder, name or f"275-{did}.md",
        f"{owner}/{did}.md", latest, version, metadata or {},
    )
    return did


async def _hold(pool, *, org, name=MATTER, reason="Litigation hold — preserve everything"):
    hid = uuid4()
    await pool.execute(
        "INSERT INTO public.legal_holds (id, org_id, name, reason) VALUES ($1,$2,$3,$4)",
        hid, UUID(str(org)), name, reason,
    )
    return hid


async def _cover_doc(pool, *, hold, doc, org):
    await pool.execute(
        "INSERT INTO public.legal_hold_documents (hold_id, document_id, org_id) VALUES ($1,$2,$3)",
        hold, doc, UUID(str(org)),
    )


async def _cover_folder(pool, *, hold, folder, org):
    await pool.execute(
        "INSERT INTO public.legal_hold_folders (hold_id, folder_id, org_id) VALUES ($1,$2,$3)",
        hold, folder, UUID(str(org)),
    )


async def _purge(pool, *, orgs, docs=(), folders=()):
    """Release holds FIRST, then remove every retention row, then documents, then folders."""
    org_ids = [UUID(str(o)) for o in orgs]
    for sql in (
        "UPDATE public.legal_holds SET released_at = now() WHERE org_id = ANY($1::uuid[]) AND released_at IS NULL",
        "DELETE FROM public.retention_receipts WHERE org_id = ANY($1::uuid[])",
        "DELETE FROM public.retention_queue WHERE org_id = ANY($1::uuid[])",
        "DELETE FROM public.retention_skips WHERE org_id = ANY($1::uuid[])",
        "DELETE FROM public.retention_previews WHERE org_id = ANY($1::uuid[])",
        "DELETE FROM public.retention_sweeps WHERE org_id = ANY($1::uuid[])",
        "DELETE FROM public.legal_holds WHERE org_id = ANY($1::uuid[])",
    ):
        try:
            await pool.execute(sql, org_ids)
        except Exception:
            pass
    for did in docs:
        try:
            await pool.execute("DELETE FROM public.document_chunks WHERE document_id = $1", did)
            await pool.execute("DELETE FROM public.documents WHERE id = $1", did)
        except Exception:
            pass
    try:
        await pool.execute("DELETE FROM public.retention_policies WHERE org_id = ANY($1::uuid[])", org_ids)
    except Exception:
        pass
    for fid in reversed(list(folders)):
        try:
            await pool.execute("DELETE FROM public.folders WHERE id = $1", fid)
        except Exception:
            pass


async def _held(pool, doc) -> bool:
    rows = await pool.fetch("SELECT document_id FROM public.retention_held_documents($1::uuid[])", [doc])
    return any(r["document_id"] == doc for r in rows)


async def _exists(pool, doc) -> bool:
    return bool(await pool.fetchval("SELECT EXISTS (SELECT 1 FROM public.documents WHERE id = $1)", doc))


async def _expect_pt409(coro):
    with pytest.raises(asyncpg.PostgresError) as exc:
        await coro
    assert exc.value.sqlstate == "PT409", f"expected PT409, got {exc.value.sqlstate}: {exc.value}"
    return exc.value


@pytest.fixture
async def world(pg_pool, two_orgs_two_users):
    a, b = two_orgs_two_users["a"], two_orgs_two_users["b"]
    m = uuid4().hex[:8]
    docs: list = []
    folders: list = []
    try:
        top = await _folder(pg_pool, owner=a["uid"], org=a["org_id"], name=f"275-top-{m}")
        held_f = await _folder(pg_pool, owner=a["uid"], org=a["org_id"], name=f"275-held-{m}", parent=top)
        child = await _folder(pg_pool, owner=a["uid"], org=a["org_id"], name=f"275-child-{m}", parent=held_f)
        grandchild = await _folder(pg_pool, owner=a["uid"], org=a["org_id"], name=f"275-gc-{m}", parent=child)
        free = await _folder(pg_pool, owner=a["uid"], org=a["org_id"], name=f"275-free-{m}")
        b_folder = await _folder(pg_pool, owner=b["uid"], org=b["org_id"], name=f"275-b-{m}")
        folders += [top, held_f, child, grandchild, free, b_folder]

        held_doc = await _doc(pg_pool, owner=a["uid"], org=a["org_id"], folder=free, name=f"held-{m}.md")
        sibling = await _doc(pg_pool, owner=a["uid"], org=a["org_id"], folder=free, name=f"sib-{m}.md")
        b_doc = await _doc(pg_pool, owner=b["uid"], org=b["org_id"], folder=b_folder, name=f"b-{m}.md")
        docs += [held_doc, sibling, b_doc]
        yield {
            "a": a, "b": b, "m": m, "docs": docs, "folders": folders,
            "top": top, "held_f": held_f, "child": child, "grandchild": grandchild, "free": free,
            "b_folder": b_folder, "held_doc": held_doc, "sibling": sibling, "b_doc": b_doc,
        }
    finally:
        await _purge(pg_pool, orgs=[a["org_id"], b["org_id"]], docs=docs, folders=folders)


# ── direct document hold ────────────────────────────────────────────────────────────────────

async def test_owner_delete_of_a_held_document_is_refused_and_an_unheld_sibling_deletes(pg_pool, world):
    a = world["a"]
    hold = await _hold(pg_pool, org=a["org_id"])
    await _cover_doc(pg_pool, hold=hold, doc=world["held_doc"], org=a["org_id"])
    async with pg_pool.acquire() as conn:
        tr = conn.transaction()
        await tr.start()
        try:
            from app.dependencies import _apply_rls_user_context
            await _apply_rls_user_context(conn, a["uid"])
            await assert_auth_uid(conn, a["uid"])
            err = await _expect_pt409(conn.execute("DELETE FROM public.documents WHERE id = $1", world["held_doc"]))
        finally:
            await tr.rollback()
    assert str(world["held_doc"]) in str(err), "D-17: the refusal names the document id"
    assert MATTER not in str(err) and "Halden" not in str(err), "D-17: a matter name leaked into the refusal"
    # positive control: the same owner, the same statement, an unheld sibling
    async with open_user_conn(pg_pool, a["uid"]) as conn:
        status = await conn.execute("DELETE FROM public.documents WHERE id = $1", world["sibling"])
    assert status == "DELETE 1", status
    assert await _exists(pg_pool, world["held_doc"])


async def test_service_pool_delete_of_a_held_document_is_refused(pg_pool, world):
    a = world["a"]
    hold = await _hold(pg_pool, org=a["org_id"])
    await _cover_doc(pg_pool, hold=hold, doc=world["held_doc"], org=a["org_id"])
    # The superuser pool (BYPASSRLS) — row triggers fire regardless of RLS bypass.
    await _expect_pt409(pg_pool.execute("DELETE FROM public.documents WHERE id = $1", world["held_doc"]))
    # And as the service_role role itself (what the API's service client runs as).
    async with pg_pool.acquire() as conn:
        tr = conn.transaction()
        await tr.start()
        try:
            await conn.execute("SET LOCAL ROLE service_role")
            await _expect_pt409(conn.execute("DELETE FROM public.documents WHERE id = $1", world["held_doc"]))
        finally:
            await tr.rollback()
    assert await _exists(pg_pool, world["held_doc"])


async def test_deleting_the_owner_from_auth_users_is_refused_through_the_fk_cascade(pg_pool, world):
    a = world["a"]
    hold = await _hold(pg_pool, org=a["org_id"])
    await _cover_doc(pg_pool, hold=hold, doc=world["held_doc"], org=a["org_id"])
    async with pg_pool.acquire() as conn:
        tr = conn.transaction()
        await tr.start()
        try:
            await _expect_pt409(conn.execute("DELETE FROM auth.users WHERE id = $1", UUID(a["uid"])))
        finally:
            await tr.rollback()
    assert await _exists(pg_pool, world["held_doc"]), "the cascade removed a held document"


async def test_release_ends_the_refusal(pg_pool, world):
    a = world["a"]
    hold = await _hold(pg_pool, org=a["org_id"])
    await _cover_doc(pg_pool, hold=hold, doc=world["held_doc"], org=a["org_id"])
    await _expect_pt409(pg_pool.execute("DELETE FROM public.documents WHERE id = $1", world["held_doc"]))
    await pg_pool.execute("UPDATE public.legal_holds SET released_at = now() WHERE id = $1", hold)
    assert not await _held(pg_pool, world["held_doc"])
    status = await pg_pool.execute("DELETE FROM public.documents WHERE id = $1", world["held_doc"])
    assert status == "DELETE 1", status


async def test_a_hold_in_org_a_never_refuses_a_delete_in_org_b(pg_pool, world):
    a = world["a"]
    hold = await _hold(pg_pool, org=a["org_id"])
    await _cover_doc(pg_pool, hold=hold, doc=world["held_doc"], org=a["org_id"])
    assert await _held(pg_pool, world["held_doc"]), "control: org A's document IS held"
    assert not await _held(pg_pool, world["b_doc"])
    status = await pg_pool.execute("DELETE FROM public.documents WHERE id = $1", world["b_doc"])
    assert status == "DELETE 1", status


async def test_coverage_cannot_reference_another_orgs_document(pg_pool, world):
    """D-35: a hold of org A cannot cover a document of org B (refused for every role)."""
    a = world["a"]
    hold = await _hold(pg_pool, org=a["org_id"])
    with pytest.raises(asyncpg.PostgresError):
        await _cover_doc(pg_pool, hold=hold, doc=world["b_doc"], org=a["org_id"])
    with pytest.raises(asyncpg.PostgresError):
        await _cover_doc(pg_pool, hold=hold, doc=world["b_doc"], org=world["b"]["org_id"])
    # positive control: the same hold covers its own org's document
    await _cover_doc(pg_pool, hold=hold, doc=world["held_doc"], org=a["org_id"])
    assert await _held(pg_pool, world["held_doc"])


# ── folder holds: added later, cascades ─────────────────────────────────────────────────────

async def test_a_folder_hold_covers_a_document_added_later_in_a_grandchild(pg_pool, world):
    a = world["a"]
    hold = await _hold(pg_pool, org=a["org_id"])
    await _cover_folder(pg_pool, hold=hold, folder=world["held_f"], org=a["org_id"])
    later = await _doc(pg_pool, owner=a["uid"], org=a["org_id"], folder=world["grandchild"], name=f"later-{world['m']}.md")
    world["docs"].append(later)
    assert await _held(pg_pool, later), "D-05: coverage must be evaluated at check time"
    await _expect_pt409(pg_pool.execute("DELETE FROM public.documents WHERE id = $1", later))
    # positive control: a document in the unheld folder is not held
    assert not await _held(pg_pool, world["sibling"])


async def test_deleting_the_held_folders_parent_is_refused_through_the_child_cascade(pg_pool, world):
    a = world["a"]
    hold = await _hold(pg_pool, org=a["org_id"])
    await _cover_folder(pg_pool, hold=hold, folder=world["held_f"], org=a["org_id"])
    err = await _expect_pt409(pg_pool.execute("DELETE FROM public.folders WHERE id = $1", world["top"]))
    assert MATTER not in str(err) and "Halden" not in str(err)
    assert await pg_pool.fetchval("SELECT EXISTS (SELECT 1 FROM public.folders WHERE id = $1)", world["held_f"])
    # the held folder itself, as its owner
    async with pg_pool.acquire() as conn:
        tr = conn.transaction()
        await tr.start()
        try:
            from app.dependencies import _apply_rls_user_context
            await _apply_rls_user_context(conn, a["uid"])
            await _expect_pt409(conn.execute("DELETE FROM public.folders WHERE id = $1", world["held_f"]))
        finally:
            await tr.rollback()
    # positive control: an unheld, empty folder deletes
    status = await pg_pool.execute("DELETE FROM public.folders WHERE id = $1", world["b_folder"])
    assert status == "DELETE 1", status


async def test_a_folder_directly_holding_a_held_document_cannot_be_deleted(pg_pool, world):
    """The SET NULL that would strip a held document out of its folder never happens (D-15)."""
    a = world["a"]
    hold = await _hold(pg_pool, org=a["org_id"])
    await _cover_doc(pg_pool, hold=hold, doc=world["held_doc"], org=a["org_id"])
    await _expect_pt409(pg_pool.execute("DELETE FROM public.folders WHERE id = $1", world["free"]))
    folder = await pg_pool.fetchval("SELECT folder_id FROM public.documents WHERE id = $1", world["held_doc"])
    assert folder == world["free"]


# ── versions + D-16 ─────────────────────────────────────────────────────────────────────────

async def test_any_version_of_a_held_family_is_refused_and_metadata_still_updates(pg_pool, world):
    a = world["a"]
    name = f"family-{world['m']}.md"
    old = await _doc(pg_pool, owner=a["uid"], org=a["org_id"], folder=world["free"], name=name, latest=False, version=1)
    new = await _doc(pg_pool, owner=a["uid"], org=a["org_id"], folder=world["free"], name=name, latest=True, version=2)
    world["docs"] += [old, new]
    hold = await _hold(pg_pool, org=a["org_id"])
    await _cover_doc(pg_pool, hold=hold, doc=new, org=a["org_id"])
    await _expect_pt409(pg_pool.execute("DELETE FROM public.documents WHERE id = $1", old))
    # D-16: a hold stops deletion only — the owner's metadata edit on the held latest row works.
    async with open_user_conn(pg_pool, a["uid"]) as conn:
        status = await conn.execute(
            "UPDATE public.documents SET metadata = $2::jsonb WHERE id = $1", new, {"document_type": "Contract"},
        )
    assert status == "UPDATE 1", status


# ── sticky coverage ─────────────────────────────────────────────────────────────────────────

async def test_moving_a_folder_held_document_out_keeps_it_held(pg_pool, world):
    a = world["a"]
    moved = await _doc(pg_pool, owner=a["uid"], org=a["org_id"], folder=world["child"], name=f"mv-{world['m']}.md")
    world["docs"].append(moved)
    hold = await _hold(pg_pool, org=a["org_id"])
    await _cover_folder(pg_pool, hold=hold, folder=world["held_f"], org=a["org_id"])
    assert await _held(pg_pool, moved)
    async with open_user_conn(pg_pool, a["uid"]) as conn:
        status = await conn.execute("UPDATE public.documents SET folder_id = $2 WHERE id = $1", moved, world["free"])
    assert status == "UPDATE 1", "D-16: a hold must not block a move"
    n = await pg_pool.fetchval(
        "SELECT count(*) FROM public.legal_hold_documents WHERE document_id = $1 AND hold_id = $2", moved, hold,
    )
    assert n == 1, "sticky coverage: the move must leave a direct coverage row"
    assert await _held(pg_pool, moved)
    await _expect_pt409(pg_pool.execute("DELETE FROM public.documents WHERE id = $1", moved))


async def test_moving_a_covered_subfolder_out_keeps_its_contents_held(pg_pool, world):
    a = world["a"]
    inner = await _doc(pg_pool, owner=a["uid"], org=a["org_id"], folder=world["grandchild"], name=f"in-{world['m']}.md")
    world["docs"].append(inner)
    hold = await _hold(pg_pool, org=a["org_id"])
    await _cover_folder(pg_pool, hold=hold, folder=world["held_f"], org=a["org_id"])
    await pg_pool.execute("UPDATE public.folders SET parent_id = NULL WHERE id = $1", world["child"])
    n = await pg_pool.fetchval(
        "SELECT count(*) FROM public.legal_hold_folders WHERE folder_id = $1 AND hold_id = $2", world["child"], hold,
    )
    assert n == 1, "sticky coverage: the moved folder must carry a direct coverage row"
    assert await _held(pg_pool, inner)


# ── TRUNCATE ────────────────────────────────────────────────────────────────────────────────

async def test_truncate_is_refused_while_a_hold_is_active_and_authenticated_cannot_truncate(pg_pool, world):
    a = world["a"]
    hold = await _hold(pg_pool, org=a["org_id"])
    await _cover_doc(pg_pool, hold=hold, doc=world["held_doc"], org=a["org_id"])
    for table in ("public.documents", "public.folders"):
        async with pg_pool.acquire() as conn:
            tr = conn.transaction()
            await tr.start()
            try:
                await conn.execute("SET LOCAL lock_timeout = '5s'")
                # CASCADE: without it the FK check (0A000) would refuse first and prove nothing.
                await _expect_pt409(conn.execute(f"TRUNCATE {table} CASCADE"))
            finally:
                await tr.rollback()
    for role in ("authenticated", "anon"):
        for table in ("public.documents", "public.folders"):
            assert await pg_pool.fetchval("SELECT has_table_privilege($1, $2, 'TRUNCATE')", role, table) is False, (
                f"{role} still holds TRUNCATE on {table}"
            )
    assert await _exists(pg_pool, world["held_doc"])


# ── D-19: archive state ─────────────────────────────────────────────────────────────────────

async def test_owner_cannot_change_archive_state_and_the_service_can(pg_pool, world):
    a = world["a"]
    doc = world["sibling"]
    for sql, arg in (
        ("UPDATE public.documents SET archived_at = now() WHERE id = $1", None),
        ("UPDATE public.documents SET archived_policy_name = $2 WHERE id = $1", "7-year contracts"),
    ):
        async with pg_pool.acquire() as conn:
            tr = conn.transaction()
            await tr.start()
            try:
                from app.dependencies import _apply_rls_user_context
                await _apply_rls_user_context(conn, a["uid"])
                with pytest.raises(asyncpg.PostgresError) as exc:
                    if arg is None:
                        await conn.execute(sql, doc)
                    else:
                        await conn.execute(sql, doc, arg)
                assert exc.value.sqlstate == "42501", exc.value
            finally:
                await tr.rollback()
    # positive control: the service role archives, then un-archives
    async with pg_pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute("SET LOCAL ROLE service_role")
            status = await conn.execute(
                "UPDATE public.documents SET archived_at = now(), archived_policy_name = 'p' WHERE id = $1", doc,
            )
    assert status == "UPDATE 1", status
    assert await pg_pool.fetchval("SELECT archived_at IS NOT NULL FROM public.documents WHERE id = $1", doc)
    # and an owner un-archive of an archived document is refused too
    async with pg_pool.acquire() as conn:
        tr = conn.transaction()
        await tr.start()
        try:
            from app.dependencies import _apply_rls_user_context
            await _apply_rls_user_context(conn, a["uid"])
            with pytest.raises(asyncpg.PostgresError) as exc:
                await conn.execute("UPDATE public.documents SET archived_at = NULL WHERE id = $1", doc)
            assert exc.value.sqlstate == "42501"
        finally:
            await tr.rollback()


async def test_a_member_cannot_delete_another_members_document_regardless(pg_pool, world):
    """Sanity control for the suite: a co-member's DELETE of the admin's document affects 0 rows
    (RLS, not the hold) — so the PT409 cases above are the TRIGGER, not owner RLS."""
    c = await _add_comember(pg_pool, world["a"]["org_id"])
    try:
        async with open_user_conn(pg_pool, c) as conn:
            status = await conn.execute("DELETE FROM public.documents WHERE id = $1", world["sibling"])
        assert status == "DELETE 0", status
    finally:
        await _drop_user(pg_pool, c)
