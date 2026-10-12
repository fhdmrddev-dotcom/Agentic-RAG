"""Phase 275-01 (RET-01 / D-13 / D-15 / D-17 / D-28 / D-35; revisions B-1, W-2, W-2b, W-4, W-5b) —
the retention tables' walls on the LIVE local database (migration 204).

What this proves, and how it refuses to prove it vacuously:

* **Members read nothing (D-17).** A member's direct SELECT of ``legal_holds``,
  ``legal_hold_documents``, ``retention_receipts`` and ``retention_policies`` returns ZERO rows, while
  the org admin (``org:manage``) reads the SAME seeded rows — the positive control.
* **Nobody but the service writes a policy (W-2b).** A member's AND an org admin's JWT INSERT /
  UPDATE of ``retention_policies`` is refused by privilege; an admin's JWT UPDATE of ``legal_holds``
  is refused; an admin's JWT INSERT of a hold and of its coverage SUCCEEDS (positive control).
* **The backstop holds without the REVOKE (W-2).** Inside one rolled-back transaction the UPDATE
  grant is temporarily restored and the protected columns are STILL refused — by the trigger.
* **Cross-org writes are refused (D-28).** An admin of org A cannot write a hold for org B.
* **Receipts outlive people and are immutable (D-13).** Deleting the actor's ``auth.users`` row
  leaves the receipt with ``actor_id NULL`` and ``actor_name`` intact; no role may UPDATE/DELETE one;
  a disposition receipt without a policy name is refused (W-4).
* **The predicate functions are the service's (W-5b).** ``authenticated`` cannot call
  ``retention_held_documents`` / ``retention_held_folders``; ``service_role`` can, and the
  ``authenticated`` owner's delete of a held document STILL raises PT409 (the DEFINER trigger).
* **Folder hold reach (B-1).** ``retention_held_folders`` reports a held EMPTY folder, a folder held
  only through an ancestor, and a folder holding ANOTHER user's held document; never an unheld one,
  and never a name.

Everything seeded is removed in ``finally`` (holds released first). Skip-guarded on :54322.
"""
from __future__ import annotations

from uuid import UUID, uuid4

import asyncpg
import pytest

from app.dependencies import _apply_rls_user_context
from tests.integration._rls_harness import assert_auth_uid, open_user_conn, requires_pg
from tests.integration.test_163_rls_documents import _add_comember, _drop_user
from tests.integration.test_275_hold_triggers import (
    MATTER,
    _cover_doc,
    _cover_folder,
    _doc,
    _expect_pt409,
    _folder,
    _hold,
    _purge,
)

pytestmark = requires_pg

NEW_TABLES = (
    "retention_policies", "retention_previews", "legal_holds", "legal_hold_documents",
    "legal_hold_folders", "retention_queue", "retention_skips", "retention_receipts", "retention_sweeps",
)


async def _policy(pool, *, org, folder):
    pid = uuid4()
    await pool.execute(
        "INSERT INTO public.retention_policies (id, org_id, name, scope_kind, folder_id, clock, "
        "stage1_value, stage1_unit, stage1_action) "
        "VALUES ($1,$2,'Contracts — 7 years','folder',$3,'date_added',7,'years','archive')",
        pid, UUID(str(org)), folder,
    )
    return pid


async def _receipt(pool, *, org, action="hold_placed", policy_name=None, actor=None, actor_name=None):
    rid = uuid4()
    await pool.execute(
        "INSERT INTO public.retention_receipts (id, org_id, action, document_name, policy_name, "
        "hold_name, actor_id, actor_name) VALUES ($1,$2,$3,'contract.pdf',$4,$5,$6,$7)",
        rid, UUID(str(org)), action, policy_name, MATTER, actor, actor_name,
    )
    return rid


@pytest.fixture
async def world(pg_pool, two_orgs_two_users):
    a, b = two_orgs_two_users["a"], two_orgs_two_users["b"]
    m = uuid4().hex[:8]
    docs: list = []
    folders: list = []
    member = None
    try:
        member = await _add_comember(pg_pool, a["org_id"])
        f = await _folder(pg_pool, owner=a["uid"], org=a["org_id"], name=f"275-rls-{m}")
        folders.append(f)
        doc = await _doc(pg_pool, owner=a["uid"], org=a["org_id"], folder=f, name=f"rls-{m}.md")
        docs.append(doc)
        policy = await _policy(pg_pool, org=a["org_id"], folder=f)
        hold = await _hold(pg_pool, org=a["org_id"])
        await _cover_doc(pg_pool, hold=hold, doc=doc, org=a["org_id"])
        receipt = await _receipt(pg_pool, org=a["org_id"])
        yield {
            "a": a, "b": b, "m": m, "member": member, "folder": f, "doc": doc,
            "policy": policy, "hold": hold, "receipt": receipt, "docs": docs, "folders": folders,
        }
    finally:
        await _purge(pg_pool, orgs=[a["org_id"], b["org_id"]], docs=docs, folders=folders)
        if member:
            await _drop_user(pg_pool, member)


# ── D-17 read wall ──────────────────────────────────────────────────────────────────────────

READS = (
    "SELECT count(*) FROM public.legal_holds",
    "SELECT count(*) FROM public.legal_hold_documents",
    "SELECT count(*) FROM public.retention_receipts",
    "SELECT count(*) FROM public.retention_policies",
)


async def test_a_member_reads_nothing_and_the_admin_reads_the_seeded_rows(pg_pool, world):
    for sql in READS:
        async with open_user_conn(pg_pool, world["member"]) as conn:
            await assert_auth_uid(conn, world["member"])
            member_n = await conn.fetchval(sql)
        async with open_user_conn(pg_pool, world["a"]["uid"]) as conn:
            await assert_auth_uid(conn, world["a"]["uid"])
            admin_n = await conn.fetchval(sql)
        assert member_n == 0, f"D-17 leak: a member read {member_n} rows from `{sql}`"
        assert admin_n >= 1, f"positive control: the org admin read nothing from `{sql}`"


async def test_rls_is_enabled_and_anon_holds_nothing_on_every_new_table(pg_pool):
    for t in NEW_TABLES:
        rls = await pg_pool.fetchval(
            "SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace "
            "WHERE n.nspname = 'public' AND c.relname = $1", t,
        )
        assert rls is True, f"RLS is not enabled on {t}"
        for priv in ("SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE"):
            assert await pg_pool.fetchval(
                "SELECT has_table_privilege('anon', $1, $2)", f"public.{t}", priv,
            ) is False, f"anon holds {priv} on {t}"


# ── W-2b: nobody writes a policy through a JWT ──────────────────────────────────────────────

async def _jwt_refused(pool, uid, sql, *args, sqlstate="42501"):
    async with pool.acquire() as conn:
        tr = conn.transaction()
        await tr.start()
        try:
            await _apply_rls_user_context(conn, uid)
            with pytest.raises(asyncpg.PostgresError) as exc:
                await conn.execute(sql, *args)
            assert exc.value.sqlstate == sqlstate, f"{sql}: {exc.value.sqlstate} {exc.value}"
        finally:
            await tr.rollback()


async def test_member_and_admin_cannot_write_a_policy_through_the_jwt(pg_pool, world):
    for uid in (world["member"], world["a"]["uid"]):
        await _jwt_refused(pg_pool, uid, "UPDATE public.retention_policies SET stage1_value = 1 WHERE id = $1", world["policy"])
        await _jwt_refused(
            pg_pool, uid,
            "INSERT INTO public.retention_policies (org_id, name, scope_kind, document_type_norm, clock, "
            "stage1_value, stage1_unit, stage1_action) VALUES ($1,'x','class','invoice','date_added',1,'days','delete')",
            UUID(world["a"]["org_id"]),
        )
    assert await pg_pool.fetchval("SELECT stage1_value FROM public.retention_policies WHERE id = $1", world["policy"]) == 7


async def test_admin_cannot_update_a_hold_through_the_jwt_but_can_create_one(pg_pool, world):
    a = world["a"]
    await _jwt_refused(pg_pool, a["uid"], "UPDATE public.legal_holds SET name = 'renamed' WHERE id = $1", world["hold"])
    # positive control: the admin's JWT creates a hold and covers a document of its own org
    async with open_user_conn(pg_pool, a["uid"]) as conn:
        await assert_auth_uid(conn, a["uid"])
        hid = await conn.fetchval(
            "INSERT INTO public.legal_holds (org_id, name, reason) VALUES ($1, 'Second matter', 'r') RETURNING id",
            UUID(a["org_id"]),
        )
        other = await _doc(conn, owner=a["uid"], org=a["org_id"], folder=world["folder"], name=f"o-{world['m']}.md")
        world["docs"].append(other)
        status = await conn.execute(
            "INSERT INTO public.legal_hold_documents (hold_id, document_id, org_id) VALUES ($1,$2,$3)",
            hid, other, UUID(a["org_id"]),
        )
    assert hid is not None and status == "INSERT 0 1"


async def test_a_member_cannot_create_a_hold(pg_pool, world):
    await _jwt_refused(
        pg_pool, world["member"],
        "INSERT INTO public.legal_holds (org_id, name) VALUES ($1, 'member matter')", UUID(world["a"]["org_id"]),
    )


async def test_an_admin_of_org_a_cannot_write_a_hold_for_org_b(pg_pool, world):
    await _jwt_refused(
        pg_pool, world["a"]["uid"],
        "INSERT INTO public.legal_holds (org_id, name) VALUES ($1, 'cross-org')", UUID(world["b"]["org_id"]),
    )
    # positive control: org B's own admin can
    async with open_user_conn(pg_pool, world["b"]["uid"]) as conn:
        hid = await conn.fetchval(
            "INSERT INTO public.legal_holds (org_id, name) VALUES ($1, 'own org') RETURNING id",
            UUID(world["b"]["org_id"]),
        )
    assert hid is not None


# ── W-2: the protected-column trigger is a backstop independent of the REVOKE ───────────────

async def test_protected_columns_are_refused_by_the_trigger_even_with_a_grant(pg_pool, world):
    a = world["a"]
    for sql in (
        "UPDATE public.retention_policies SET previewed_revision = 1 WHERE id = $1",
        "UPDATE public.retention_policies SET revision = 2 WHERE id = $1",
    ):
        await _with_temp_grant_refused(pg_pool, a["uid"], sql, world["policy"])
    for sql in (
        "UPDATE public.legal_holds SET released_at = now() WHERE id = $1",
        "UPDATE public.legal_holds SET release_note = 'done' WHERE id = $1",
    ):
        await _with_temp_grant_refused(pg_pool, a["uid"], sql, world["hold"])
    # positive control: the service role writes the same columns (rolled back)
    async with pg_pool.acquire() as conn:
        tr = conn.transaction()
        await tr.start()
        try:
            await conn.execute("SET LOCAL ROLE service_role")
            s1 = await conn.execute(
                "UPDATE public.retention_policies SET previewed_revision = revision WHERE id = $1", world["policy"],
            )
            s2 = await conn.execute("UPDATE public.legal_holds SET released_at = now() WHERE id = $1", world["hold"])
        finally:
            await tr.rollback()
    assert s1 == "UPDATE 1" and s2 == "UPDATE 1"
    # no grant survived the rolled-back transactions
    for t in ("public.retention_policies", "public.legal_holds"):
        assert await pg_pool.fetchval("SELECT has_table_privilege('authenticated', $1, 'UPDATE')", t) is False


async def _with_temp_grant_refused(pool, uid, sql, arg):
    async with pool.acquire() as conn:
        tr = conn.transaction()
        await tr.start()
        try:
            await conn.execute("GRANT UPDATE ON public.retention_policies, public.legal_holds TO authenticated")
            await _apply_rls_user_context(conn, uid)
            with pytest.raises(asyncpg.PostgresError) as exc:
                await conn.execute(sql, arg)
            assert exc.value.sqlstate == "42501", f"{sql}: {exc.value.sqlstate} {exc.value}"
            assert "row-level security" not in str(exc.value), "refused by RLS, not by the trigger"
        finally:
            await tr.rollback()


async def test_an_insert_cannot_set_protected_columns(pg_pool, world):
    a = world["a"]
    await _jwt_refused(
        pg_pool, a["uid"],
        "INSERT INTO public.legal_holds (org_id, name, released_at) VALUES ($1, 'pre-released', now())",
        UUID(a["org_id"]),
    )


# ── D-13 / W-4: receipts ────────────────────────────────────────────────────────────────────

async def test_a_receipt_outlives_its_actor(pg_pool, world):
    actor = await _add_comember(pg_pool, world["a"]["org_id"])
    rid = await _receipt(pg_pool, org=world["a"]["org_id"], actor=UUID(actor), actor_name="Ada Admin")
    await _drop_user(pg_pool, actor)
    row = await pg_pool.fetchrow("SELECT actor_id, actor_name FROM public.retention_receipts WHERE id = $1", rid)
    assert row is not None, "D-13: deleting the actor deleted the receipt"
    assert row["actor_id"] is None and row["actor_name"] == "Ada Admin"


async def test_receipts_are_immutable_for_every_role(pg_pool, world):
    for role in ("authenticated", "service_role"):
        for priv in ("UPDATE", "DELETE"):
            assert await pg_pool.fetchval(
                "SELECT has_table_privilege($1, 'public.retention_receipts', $2)", role, priv,
            ) is False, f"{role} holds {priv} on retention_receipts"
    async with pg_pool.acquire() as conn:
        tr = conn.transaction()
        await tr.start()
        try:
            await conn.execute("SET LOCAL ROLE service_role")
            with pytest.raises(asyncpg.PostgresError) as exc:
                await conn.execute("DELETE FROM public.retention_receipts WHERE id = $1", world["receipt"])
            assert exc.value.sqlstate == "42501"
        finally:
            await tr.rollback()
    # positive control: the service role CAN insert one
    async with pg_pool.acquire() as conn:
        tr = conn.transaction()
        await tr.start()
        try:
            await conn.execute("SET LOCAL ROLE service_role")
            status = await conn.execute(
                "INSERT INTO public.retention_receipts (org_id, action, hold_name) VALUES ($1, 'hold_placed', 'm')",
                UUID(world["a"]["org_id"]),
            )
        finally:
            await tr.rollback()
    assert status == "INSERT 0 1"


async def test_a_disposition_receipt_must_name_its_policy(pg_pool, world):
    for action in ("deleted", "archived", "queued_delete", "did_not_delete", "kept", "unarchived", "queued_review"):
        with pytest.raises(asyncpg.PostgresError) as exc:
            await _receipt(pg_pool, org=world["a"]["org_id"], action=action, policy_name=None)
        assert exc.value.sqlstate == "23514", f"{action}: {exc.value}"
    # positive controls: a hold receipt needs no policy; a disposition with one is accepted
    await _receipt(pg_pool, org=world["a"]["org_id"], action="hold_placed", policy_name=None)
    await _receipt(pg_pool, org=world["a"]["org_id"], action="deleted", policy_name="Contracts — 7 years")


# ── W-5b + B-1: the two predicate functions ─────────────────────────────────────────────────

PREDICATES = (
    "public.retention_held_documents(uuid[])",
    "public.retention_held_folders(uuid[])",
)


async def test_only_the_service_role_executes_the_predicates(pg_pool, world):
    for sig in PREDICATES:
        for role in ("anon", "authenticated"):
            assert await pg_pool.fetchval("SELECT has_function_privilege($1, $2, 'EXECUTE')", role, sig) is False, (
                f"{role} can EXECUTE {sig}"
            )
        assert await pg_pool.fetchval("SELECT has_function_privilege('service_role', $1, 'EXECUTE')", sig) is True
    for fn in ("retention_held_documents", "retention_held_folders"):
        async with pg_pool.acquire() as conn:
            tr = conn.transaction()
            await tr.start()
            try:
                await _apply_rls_user_context(conn, world["a"]["uid"])
                with pytest.raises(asyncpg.PostgresError) as exc:
                    await conn.fetch(f"SELECT * FROM public.{fn}($1::uuid[])", [world["doc"]])
                assert exc.value.sqlstate == "42501", exc.value
            finally:
                await tr.rollback()
    # positive control: the authenticated owner's delete STILL hits the DEFINER trigger
    async with pg_pool.acquire() as conn:
        tr = conn.transaction()
        await tr.start()
        try:
            await _apply_rls_user_context(conn, world["a"]["uid"])
            await _expect_pt409(conn.execute("DELETE FROM public.documents WHERE id = $1", world["doc"]))
        finally:
            await tr.rollback()


async def test_held_folders_reports_empty_ancestor_and_foreign_content_and_never_a_name(pg_pool, world):
    a = world["a"]
    m = world["m"]
    other = await _add_comember(pg_pool, a["org_id"])
    try:
        parent = await _folder(pg_pool, owner=a["uid"], org=a["org_id"], name=f"275-p-{m}")
        empty_held = await _folder(pg_pool, owner=a["uid"], org=a["org_id"], name=f"275-e-{m}", parent=parent)
        anc = await _folder(pg_pool, owner=a["uid"], org=a["org_id"], name=f"275-anc-{m}")
        below = await _folder(pg_pool, owner=a["uid"], org=a["org_id"], name=f"275-below-{m}", parent=anc)
        foreign = await _folder(pg_pool, owner=a["uid"], org=a["org_id"], name=f"275-x-{m}")
        unheld = await _folder(pg_pool, owner=a["uid"], org=a["org_id"], name=f"275-u-{m}")
        world["folders"] += [parent, empty_held, anc, below, foreign, unheld]
        theirs = await _doc(pg_pool, owner=other, org=a["org_id"], folder=foreign, name=f"theirs-{m}.md")
        world["docs"].append(theirs)
        hold = await _hold(pg_pool, org=a["org_id"])
        await _cover_folder(pg_pool, hold=hold, folder=empty_held, org=a["org_id"])
        await _cover_folder(pg_pool, hold=hold, folder=anc, org=a["org_id"])
        await _cover_doc(pg_pool, hold=hold, doc=theirs, org=a["org_id"])

        async with pg_pool.acquire() as conn:
            tr = conn.transaction()
            await tr.start()
            try:
                await conn.execute("SET LOCAL ROLE service_role")
                rows = await conn.fetch(
                    "SELECT * FROM public.retention_held_folders($1::uuid[])",
                    [parent, empty_held, below, foreign, unheld],
                )
            finally:
                await tr.rollback()
        got = {r["folder_id"] for r in rows}
        assert got == {empty_held, below, foreign}, got
        assert unheld not in got and parent not in got, "positive control: unheld folders are not reported"
        assert rows and set(rows[0].keys()) == {"folder_id"}, "B-1: the result carries no name or reason"
    finally:
        await pg_pool.execute(
            "UPDATE public.legal_holds SET released_at = now() WHERE org_id = $1 AND released_at IS NULL",
            UUID(a["org_id"]),
        )
        await pg_pool.execute("DELETE FROM public.documents WHERE user_id = $1", UUID(other))
        await _drop_user(pg_pool, other)
