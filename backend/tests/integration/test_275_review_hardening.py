"""Phase 275 code-review fix pass (275-REVIEW-backend.md) — migration 206 against the LIVE local DB.

Each case is the reviewer's reproduction, driven, with a positive control so "refused" can never
mean "every write is broken":

* **B-CR-01** — an owner can no longer take a document out of its hold. A rename of any version is
  allowed (D-16) but the hold follows it, so the renamed version AND the versions it left behind are
  still refused on delete. Moving a held document's ``org_id`` (the dev account is in two orgs) is
  refused outright; so is moving a held folder's ``org_id``. An unheld document still moves.
* **B-CR-02** — through the REAL Storage API with a GoTrue-issued user JWT: a file that still backs a
  ``documents`` row cannot be deleted by its owner; an unreferenced file can; once the row is gone
  (the app doors' order, D-38) the same file deletes.
* **B-CR-03** — deleting an auth user who once extended a since-released hold succeeds, and the
  coverage row keeps its place with ``added_by`` NULL.
* **B-WR-01 (DB half)** — a folder policy cannot name another org's folder, for any role.
  **(evaluator half)** — one document in another org's folder, or a policy whose folder left the
  org, no longer makes the WHOLE org's read incomplete.
* **B-WR-02** — a new version inserted into an archived family is archived on insert, so it is not
  ``retrievable``.
* **B-WR-03** — ``delete_folder_tree`` is all-or-nothing: a held subfolder refuses the call and the
  caller's own unheld document in the parent survives; an unheld folder deletes with its documents.

⛔ Cleanup RELEASES holds first (275-01's pattern). Run with the local-DB lock held. Skip-guarded on
:54322 (and :54321 for the Storage case) — a skip is a SKIP, never a pass.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import asyncpg
import pytest

from tests.integration._rls_harness import open_user_conn, requires_pg
from tests.integration.test_163_rls_documents import _add_comember, _drop_user
from tests.integration.test_275_hold_triggers import (
    _cover_doc,
    _cover_folder,
    _doc,
    _expect_pt409,
    _exists,
    _folder,
    _held,
    _hold,
    _purge,
)

pytestmark = requires_pg


async def _function_exists(pool, signature: str) -> bool:
    return bool(await pool.fetchval("SELECT to_regprocedure($1) IS NOT NULL", signature))


@pytest.fixture
async def world(pg_pool, two_orgs_two_users):
    a, b = two_orgs_two_users["a"], two_orgs_two_users["b"]
    m = uuid4().hex[:8]
    docs: list = []
    folders: list = []
    extra_orgs: list = []
    try:
        top = await _folder(pg_pool, owner=a["uid"], org=a["org_id"], name=f"206-top-{m}")
        sub = await _folder(pg_pool, owner=a["uid"], org=a["org_id"], name=f"206-sub-{m}", parent=top)
        free = await _folder(pg_pool, owner=a["uid"], org=a["org_id"], name=f"206-free-{m}")
        b_folder = await _folder(pg_pool, owner=b["uid"], org=b["org_id"], name=f"206-b-{m}")
        folders += [top, sub, free, b_folder]
        yield {
            "a": a, "b": b, "m": m, "docs": docs, "folders": folders, "extra_orgs": extra_orgs,
            "top": top, "sub": sub, "free": free, "b_folder": b_folder,
        }
    finally:
        await _purge(pg_pool, orgs=[a["org_id"], b["org_id"], *extra_orgs], docs=docs, folders=folders)
        for org in extra_orgs:
            try:
                await pg_pool.execute("DELETE FROM public.org_members WHERE org_id = $1", UUID(str(org)))
                await pg_pool.execute("DELETE FROM public.organizations WHERE id = $1", UUID(str(org)))
            except Exception:
                pass


async def _second_org_for(pool, world, uid) -> str:
    """Give ``uid`` a membership in a fresh second org (the dev account is in two orgs)."""
    org = uuid4()
    await pool.execute(
        "INSERT INTO public.organizations (id, name) VALUES ($1, $2)", org, f"206-second-{world['m']}",
    )
    await pool.execute(
        "INSERT INTO public.org_members (org_id, user_id, role) VALUES ($1, $2, 'member')", org, UUID(uid),
    )
    world["extra_orgs"].append(str(org))
    return str(org)


# ── B-CR-01 ─────────────────────────────────────────────────────────────────────────────────

async def test_cr01_renaming_an_older_version_keeps_it_held(pg_pool, world):
    a = world["a"]
    name = f"family-{world['m']}.md"
    v1 = await _doc(pg_pool, owner=a["uid"], org=a["org_id"], folder=world["free"], name=name, latest=False, version=1)
    v2 = await _doc(pg_pool, owner=a["uid"], org=a["org_id"], folder=world["free"], name=name, latest=True, version=2)
    world["docs"] += [v1, v2]
    hold = await _hold(pg_pool, org=a["org_id"])
    await _cover_doc(pg_pool, hold=hold, doc=v2, org=a["org_id"])
    assert await _held(pg_pool, v1), "control: v1 is held through its family before the rename"

    # The reviewer's path 1, as the owner through RLS: rename v1 out of the family.
    async with open_user_conn(pg_pool, a["uid"]) as conn:
        status = await conn.execute("UPDATE public.documents SET filename = $2 WHERE id = $1", v1, f"x-{world['m']}.md")
    assert status == "UPDATE 1", "D-16: a rename of a held document still works"
    assert await _held(pg_pool, v1), "B-CR-01: the rename took v1 out of the hold"
    await _expect_pt409(pg_pool.execute("DELETE FROM public.documents WHERE id = $1", v1))
    assert await _exists(pg_pool, v1)


async def test_cr01_renaming_the_covered_version_keeps_the_versions_it_leaves_behind_held(pg_pool, world):
    a = world["a"]
    name = f"family2-{world['m']}.md"
    v1 = await _doc(pg_pool, owner=a["uid"], org=a["org_id"], folder=world["free"], name=name, latest=False, version=1)
    v2 = await _doc(pg_pool, owner=a["uid"], org=a["org_id"], folder=world["free"], name=name, latest=True, version=2)
    world["docs"] += [v1, v2]
    hold = await _hold(pg_pool, org=a["org_id"])
    await _cover_doc(pg_pool, hold=hold, doc=v2, org=a["org_id"])
    async with open_user_conn(pg_pool, a["uid"]) as conn:
        await conn.execute("UPDATE public.documents SET filename = $2 WHERE id = $1", v2, f"y-{world['m']}.md")
    assert await _held(pg_pool, v2)
    assert await _held(pg_pool, v1), "B-CR-01: renaming the covered version left v1 unheld"
    await _expect_pt409(pg_pool.execute("DELETE FROM public.documents WHERE id = $1", v1))


async def test_cr01_moving_a_held_documents_org_is_refused_and_an_unheld_one_moves(pg_pool, world):
    a = world["a"]
    org2 = await _second_org_for(pg_pool, world, a["uid"])
    held = await _doc(pg_pool, owner=a["uid"], org=a["org_id"], folder=world["free"], name=f"h-{world['m']}.md")
    folder_held = await _doc(pg_pool, owner=a["uid"], org=a["org_id"], folder=world["sub"], name=f"fh-{world['m']}.md")
    free = await _doc(pg_pool, owner=a["uid"], org=a["org_id"], folder=None, name=f"f-{world['m']}.md")
    world["docs"] += [held, folder_held, free]
    hold = await _hold(pg_pool, org=a["org_id"])
    await _cover_doc(pg_pool, hold=hold, doc=held, org=a["org_id"])
    await _cover_folder(pg_pool, hold=hold, folder=world["top"], org=a["org_id"])

    for doc in (held, folder_held):
        async with pg_pool.acquire() as conn:
            tr = conn.transaction()
            await tr.start()
            try:
                from app.dependencies import _apply_rls_user_context
                await _apply_rls_user_context(conn, a["uid"])
                err = await _expect_pt409(
                    conn.execute("UPDATE public.documents SET org_id = $2 WHERE id = $1", doc, UUID(org2))
                )
            finally:
                await tr.rollback()
        assert "Halden" not in str(err), "D-17: a matter name leaked into the refusal"
        assert await pg_pool.fetchval("SELECT org_id FROM public.documents WHERE id = $1", doc) == UUID(a["org_id"])
        await _expect_pt409(pg_pool.execute("DELETE FROM public.documents WHERE id = $1", doc))

    # positive control: the same owner, the same statement, an unheld document
    async with open_user_conn(pg_pool, a["uid"]) as conn:
        status = await conn.execute("UPDATE public.documents SET org_id = $2 WHERE id = $1", free, UUID(org2))
    assert status == "UPDATE 1", status


async def test_cr01_a_held_folders_org_cannot_move(pg_pool, world):
    a = world["a"]
    org2 = await _second_org_for(pg_pool, world, a["uid"])
    hold = await _hold(pg_pool, org=a["org_id"])
    await _cover_folder(pg_pool, hold=hold, folder=world["top"], org=a["org_id"])
    await _expect_pt409(pg_pool.execute("UPDATE public.folders SET org_id = $2 WHERE id = $1", world["sub"], UUID(org2)))
    # positive control: an unheld folder's org moves
    status = await pg_pool.execute("UPDATE public.folders SET org_id = $2 WHERE id = $1", world["free"], UUID(org2))
    assert status == "UPDATE 1", status
    await pg_pool.execute("UPDATE public.folders SET org_id = $2 WHERE id = $1", world["free"], UUID(a["org_id"]))


# ── B-CR-02 (the real Storage API, a real user JWT) ─────────────────────────────────────────

async def test_cr02_a_user_jwt_cannot_delete_a_file_that_still_backs_a_document(pg_pool, world):
    from tests.integration._271_gotrue_users import GoTrueUsers, _admin, require_gotrue, user_client

    require_gotrue()
    users = GoTrueUsers(pg_pool)
    paths: list[str] = []
    doc = None
    try:
        uid, token = await users.create_signed_in_user(world["a"]["org_id"], label="206-cr02")
        client = user_client(token)
        bucket = client.storage.from_("documents")
        doc = uuid4()
        backed = f"{uid}/{doc}/evidence.md"
        loose = f"{uid}/{uuid4()}/scratch.md"
        paths += [backed, loose]
        for p in paths:
            bucket.upload(p, b"275 evidence bytes", {"content-type": "text/markdown"})
        await pg_pool.execute(
            "INSERT INTO public.documents (id, user_id, org_id, filename, file_path, file_size, mime_type, status, "
            "is_latest, version_number) VALUES ($1,$2,$3,'evidence.md',$4,18,'text/markdown','completed',true,1)",
            doc, UUID(uid), UUID(world["a"]["org_id"]), backed,
        )

        async def _object_exists(p):
            return bool(await pg_pool.fetchval(
                "SELECT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'documents' AND name = $1)", p,
            ))

        assert await _object_exists(backed) and await _object_exists(loose), "vacuous: the upload did not land"

        try:
            bucket.remove([backed])
        except Exception:
            pass  # a refusal may surface as an error or as an empty result; the bytes are the assertion
        assert await _object_exists(backed), "B-CR-02: the owner deleted the bytes of a document row"

        # positive control: an unreferenced file of the same owner deletes
        bucket.remove([loose])
        assert not await _object_exists(loose), "control: an unreferenced file must still delete"

        # the app doors' order (D-38): row first, then the bytes
        await pg_pool.execute("DELETE FROM public.documents WHERE id = $1", doc)
        doc = None
        bucket.remove([backed])
        assert not await _object_exists(backed), "row-first delete must still remove the bytes"
    finally:
        if doc is not None:
            await pg_pool.execute("DELETE FROM public.documents WHERE id = $1", doc)
        try:
            _admin().storage.from_("documents").remove(paths)
        except Exception:
            pass
        await users.drop_all()


# ── B-CR-03 ─────────────────────────────────────────────────────────────────────────────────

async def test_cr03_deleting_a_user_who_extended_a_released_hold_succeeds(pg_pool, world):
    a = world["a"]
    admin = await _add_comember(pg_pool, a["org_id"])
    try:
        doc = await _doc(pg_pool, owner=a["uid"], org=a["org_id"], folder=world["free"], name=f"c3-{world['m']}.md")
        world["docs"].append(doc)
        hold = await _hold(pg_pool, org=a["org_id"])
        await pg_pool.execute(
            "INSERT INTO public.legal_hold_documents (hold_id, document_id, org_id, added_by) VALUES ($1,$2,$3,$4)",
            hold, doc, UUID(a["org_id"]), UUID(admin),
        )
        await pg_pool.execute(
            "INSERT INTO public.legal_hold_folders (hold_id, folder_id, org_id, added_by) VALUES ($1,$2,$3,$4)",
            hold, world["top"], UUID(a["org_id"]), UUID(admin),
        )
        await pg_pool.execute("UPDATE public.legal_holds SET released_at = now() WHERE id = $1", hold)

        status = await pg_pool.execute("DELETE FROM auth.users WHERE id = $1", UUID(admin))
        assert status == "DELETE 1", status
        row = await pg_pool.fetchrow(
            "SELECT added_by FROM public.legal_hold_documents WHERE hold_id = $1 AND document_id = $2", hold, doc,
        )
        assert row is not None and row["added_by"] is None
        assert await pg_pool.fetchval(
            "SELECT added_by IS NULL FROM public.legal_hold_folders WHERE hold_id = $1 AND folder_id = $2",
            hold, world["top"],
        )
    finally:
        await _drop_user(pg_pool, admin)


async def test_cr03_coverage_still_cannot_be_added_to_a_released_hold(pg_pool, world):
    """The column list must not weaken D-35: an INSERT is still checked."""
    a = world["a"]
    doc = await _doc(pg_pool, owner=a["uid"], org=a["org_id"], folder=world["free"], name=f"c3b-{world['m']}.md")
    world["docs"].append(doc)
    hold = await _hold(pg_pool, org=a["org_id"])
    await pg_pool.execute("UPDATE public.legal_holds SET released_at = now() WHERE id = $1", hold)
    with pytest.raises(asyncpg.PostgresError) as exc:
        await _cover_doc(pg_pool, hold=hold, doc=doc, org=a["org_id"])
    assert exc.value.sqlstate == "23514", exc.value


# ── B-WR-01 ─────────────────────────────────────────────────────────────────────────────────

async def _policy(pool, *, org, name, folder=None, type_norm=None, s1=(1, "days", "archive")):
    pid = uuid4()
    await pool.execute(
        "INSERT INTO public.retention_policies (id, org_id, name, scope_kind, folder_id, document_type_norm, clock, "
        "stage1_value, stage1_unit, stage1_action, revision, previewed_revision) "
        "VALUES ($1,$2,$3,$4,$5,$6,'date_added',$7,$8,$9,1,1)",
        pid, UUID(str(org)), name, "folder" if folder else "class", folder, type_norm, s1[0], s1[1], s1[2],
    )
    return pid


async def test_wr01_a_policy_cannot_name_another_orgs_folder(pg_pool, world):
    a = world["a"]
    with pytest.raises(asyncpg.PostgresError) as exc:
        await _policy(pg_pool, org=a["org_id"], name=f"cross-{world['m']}", folder=world["b_folder"])
    assert exc.value.sqlstate == "23514", exc.value
    # positive control: its own folder
    await _policy(pg_pool, org=a["org_id"], name=f"own-{world['m']}", folder=world["free"])


async def test_wr01_one_out_of_org_folder_never_makes_the_whole_org_incomplete(pg_pool, world):
    from app.services.retention import disposition
    from app.services.retention.load import load_snapshot

    a = world["a"]
    org2 = await _second_org_for(pg_pool, world, a["uid"])
    old = datetime.now(timezone.utc) - timedelta(days=10)
    due = await _doc(pg_pool, owner=a["uid"], org=a["org_id"], folder=world["free"], name=f"due-{world['m']}.md")
    stray = await _doc(pg_pool, owner=a["uid"], org=a["org_id"], folder=world["b_folder"], name=f"stray-{world['m']}.md")
    world["docs"] += [due, stray]
    await pg_pool.execute("UPDATE public.documents SET created_at = $2 WHERE id = ANY($1::uuid[])", [due, stray], old)
    await _policy(pg_pool, org=a["org_id"], name=f"free-{world['m']}", folder=world["free"])
    # a policy whose folder then LEAVES the org (an unheld folder's org may move)
    gone = await _folder(pg_pool, owner=a["uid"], org=a["org_id"], name=f"206-gone-{world['m']}")
    world["folders"].append(gone)
    await _policy(pg_pool, org=a["org_id"], name=f"gone-{world['m']}", folder=gone)
    await pg_pool.execute("UPDATE public.folders SET org_id = $2 WHERE id = $1", gone, UUID(org2))

    snap = await load_snapshot(pg_pool, a["org_id"])  # B-WR-01: this raised IncompleteEvaluation
    assert str(stray) in snap.doc_family
    result = await disposition.run_org_sweep(pg_pool, a["org_id"])
    assert result.status == "ok", result
    assert str(due) in result.archived, "control: the rest of the org is still swept"
    assert await pg_pool.fetchval("SELECT archived_at IS NULL FROM public.documents WHERE id = $1", stray)
    await pg_pool.execute("UPDATE public.folders SET org_id = $2 WHERE id = $1", gone, UUID(a["org_id"]))


# ── B-WR-02 ─────────────────────────────────────────────────────────────────────────────────

async def test_wr02_a_new_version_of_an_archived_family_is_archived_on_insert(pg_pool, world):
    a = world["a"]
    name = f"arch-{world['m']}.md"
    v1 = await _doc(pg_pool, owner=a["uid"], org=a["org_id"], folder=world["free"], name=name, latest=True, version=1)
    world["docs"].append(v1)
    await pg_pool.execute(
        "UPDATE public.documents SET archived_at = now(), archived_policy_name = '7-year contracts' WHERE id = $1", v1,
    )
    await pg_pool.execute("UPDATE public.documents SET is_latest = false WHERE id = $1", v1)
    v2 = await _doc(pg_pool, owner=a["uid"], org=a["org_id"], folder=world["free"], name=name, latest=True, version=2)
    other = await _doc(pg_pool, owner=a["uid"], org=a["org_id"], folder=world["free"], name=f"other-{world['m']}.md")
    world["docs"] += [v2, other]
    row = await pg_pool.fetchrow(
        "SELECT archived_at, archived_policy_name, retrievable FROM public.documents WHERE id = $1", v2,
    )
    assert row["archived_at"] is not None, "B-WR-02: the new version escaped the family's archive"
    assert row["archived_policy_name"] == "7-year contracts"
    assert row["retrievable"] is False
    assert await pg_pool.fetchval("SELECT retrievable FROM public.documents WHERE id = $1", other) is True


# ── B-WR-03 ─────────────────────────────────────────────────────────────────────────────────

async def test_wr03_delete_folder_tree_is_all_or_nothing(pg_pool, world):
    a = world["a"]
    assert await _function_exists(pg_pool, "public.delete_folder_tree(uuid)"), "B-WR-03: delete_folder_tree is missing"
    mine = await _doc(pg_pool, owner=a["uid"], org=a["org_id"], folder=world["top"], name=f"mine-{world['m']}.md")
    world["docs"].append(mine)
    hold = await _hold(pg_pool, org=a["org_id"])
    await _cover_folder(pg_pool, hold=hold, folder=world["sub"], org=a["org_id"])

    async with pg_pool.acquire() as conn:
        tr = conn.transaction()
        await tr.start()
        try:
            from app.dependencies import _apply_rls_user_context
            await _apply_rls_user_context(conn, a["uid"])
            await _expect_pt409(conn.fetch("SELECT * FROM public.delete_folder_tree($1)", world["top"]))
        finally:
            await tr.rollback()
    assert await _exists(pg_pool, mine), "the folder was refused but its document was deleted"

    # positive control: an unheld folder deletes with its documents, and the paths come back
    gone = await _doc(pg_pool, owner=a["uid"], org=a["org_id"], folder=world["free"], name=f"gone-{world['m']}.md")
    world["docs"].append(gone)
    async with open_user_conn(pg_pool, a["uid"]) as conn:
        rows = await conn.fetch("SELECT * FROM public.delete_folder_tree($1)", world["free"])
    assert [(r["document_id"], r["file_path"]) for r in rows] == [(gone, f"{a['uid']}/{gone}.md")]
    assert not await _exists(pg_pool, gone)
    assert not await pg_pool.fetchval("SELECT EXISTS (SELECT 1 FROM public.folders WHERE id = $1)", world["free"])
