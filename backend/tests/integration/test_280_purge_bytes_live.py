"""Phase 280 (SC#3 / SC#4; DEBT-10, DEBT-11; D-09, D-13, D-31) — live, PER-PATH evidence.

SC#3: both watch purge doors (``DELETE /sources/watches/{id}?purge_documents=true`` and
``POST /sources/watches/{id}/purge``) must leave NO ``storage.objects`` row for each purged
document. ⚠ The assertion is PER PATH, never a global orphan count: the local DB already carries
pre-existing orphans (35 measured at planning), so a global count could neither prove nor refute
anything this phase did (D-13).

A held document refuses with 409 on both doors and keeps BOTH its row and its object (T-280-19).

⭐ THE POSITIVE CONTROL (T-280-20): with ``document_purge.remove_document_bytes`` planted as a no-op,
the same per-path check must SEE the orphan. A per-path check that cannot fail is not evidence.

SC#4: ``delete_document`` through real postgrest 2.29, as a real signed-in user, for a document
owned by ANOTHER user and for a random id — both the identical ``404 "Document not found"``
(D-09 / T-280-21: no existence oracle).

The route coroutines are called directly (the ``test_275_delete_paths.py`` shape) with the LIVE
user-JWT client, a service-role client for the hold predicates, and a real asyncpg pool.
Skip-guarded on :54322 and :54321 (a skip is a SKIP, never a pass). Everything seeded — rows,
holds, receipts, storage objects (by path), users, orgs — is removed in ``finally`` and proven.
"""
from __future__ import annotations

from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from fastapi import BackgroundTasks, HTTPException

from app.api import documents as documents_api
from app.api import sources
from app.services import document_purge
from app.services.ingest_splice import async_mint_document_row
from tests.integration._271_gotrue_users import (
    GoTrueUsers,
    _admin,
    create_org,
    drop_org,
    require_gotrue,
    user_client,
)
from tests.integration._rls_harness import requires_pg

pytestmark = requires_pg

BUCKET = "documents"
EMAIL_MARK = "p280pb"
MIME = "text/plain"

#: Rows printed under ``-s`` and copied into 280-LIVE-EVIDENCE.md.
EVIDENCE: list[str] = []


def _request():
    return SimpleNamespace(state=SimpleNamespace(), app=SimpleNamespace(state=SimpleNamespace()))


async def _object_count(pool, path: str) -> int:
    return await pool.fetchval(
        "SELECT count(*) FROM storage.objects WHERE bucket_id = $1 AND name = $2", BUCKET, path,
    )


async def _row_exists(pool, doc_id: str) -> bool:
    return bool(await pool.fetchval(
        "SELECT EXISTS (SELECT 1 FROM public.documents WHERE id = $1)", UUID(doc_id),
    ))


class Subject:
    """One signed-in GoTrue user in one org, with a connection to hang watches on."""

    def __init__(self, pool, uid: str, tok: str, org: str, conn_id: str):
        self.pool, self.uid, self.tok, self.org, self.conn_id = pool, uid, tok, org, conn_id
        self.client = user_client(tok)
        self.paths: list[str] = []      # every object this test uploaded, for cleanup by path
        self.holds: list[str] = []

    @property
    def current_user(self) -> dict:
        return {"id": self.uid, "email": f"{EMAIL_MARK}@test.local"}

    async def mint_with_bytes(self, tag: str) -> dict:
        raw = f"phase-280 purge-bytes {tag} {uuid4().hex}".encode()
        res = await async_mint_document_row(
            raw=raw, filename=f"280-pb-{tag}-{uuid4().hex[:6]}.txt", mime_type=MIME,
            user_id=self.uid, supabase=self.client, folder_id=None, org_id=self.org,
        )
        doc = res.document
        path = doc["file_path"]
        assert path.startswith(f"{self.uid}/"), path
        self.client.storage.from_(BUCKET).upload(path, raw, {"content-type": MIME})
        self.paths.append(path)
        assert await _object_count(self.pool, path) == 1, f"the upload of {path} did not land"
        return {"id": str(doc["id"]), "path": path}

    async def watch_with(self, docs: list[dict], *, state: str = "present") -> str:
        watch_id = uuid4()
        await self.pool.execute(
            "INSERT INTO public.connector_watches (id, org_id, user_id, connection_id, "
            "source_folder_id, source_folder_name, interval_minutes, is_active) "
            "VALUES ($1, $2, $3, $4, $5, $6, 60, false)",
            watch_id, UUID(self.org), UUID(self.uid), UUID(self.conn_id),
            f"p280-src-{watch_id.hex[:6]}", "280 purge-bytes source",
        )
        for i, d in enumerate(docs):
            await self.pool.execute(
                "INSERT INTO public.connector_watch_items (org_id, watch_id, user_id, external_id, "
                "name, document_id, state) VALUES ($1, $2, $3, $4, $5, $6, $7)",
                UUID(self.org), watch_id, UUID(self.uid), f"ext-{i}-{uuid4().hex[:6]}",
                f"item-{i}", UUID(d["id"]), state,
            )
        return str(watch_id)

    async def hold(self, doc: dict) -> str:
        hold_id = uuid4()
        await self.pool.execute(
            "INSERT INTO public.legal_holds (id, org_id, name, created_by) VALUES ($1, $2, $3, $4)",
            hold_id, UUID(self.org), f"280 purge-bytes matter {hold_id.hex[:6]}", UUID(self.uid),
        )
        self.holds.append(str(hold_id))
        await self.pool.execute(
            "INSERT INTO public.legal_hold_documents (hold_id, document_id, org_id) VALUES ($1, $2, $3)",
            hold_id, UUID(doc["id"]), UUID(self.org),
        )
        return str(hold_id)


@pytest.fixture
async def subject(pg_pool):
    require_gotrue()
    users = GoTrueUsers(pg_pool)
    org = uid = None
    s: Subject | None = None
    try:
        org = await create_org(pg_pool, "280-pb")
        uid, tok = await users.create_signed_in_user(org, label=EMAIL_MARK)
        conn_id = uuid4()
        await pg_pool.execute(
            "INSERT INTO public.connector_connections (id, org_id, created_by, name, service_id) "
            "VALUES ($1, $2, $3, $4, 'p280-test')",
            conn_id, UUID(org), UUID(uid), "280 purge-bytes connection",
        )
        s = Subject(pg_pool, uid, tok, org, str(conn_id))
        s.users = users  # type: ignore[attr-defined]
        yield s
    finally:
        if s is not None:
            # Holds first: the documents BEFORE DELETE trigger refuses a held row (coverage cascades).
            for h in s.holds:
                await pg_pool.execute("DELETE FROM public.legal_holds WHERE id = $1", UUID(h))
            if s.paths:
                _admin().storage.from_(BUCKET).remove(list(s.paths))
        if org:
            await pg_pool.execute("DELETE FROM public.retention_receipts WHERE org_id = $1", UUID(org))
        if uid:
            await pg_pool.execute("DELETE FROM public.connector_watches WHERE user_id = $1", UUID(uid))
            await pg_pool.execute("DELETE FROM public.connector_connections WHERE created_by = $1", UUID(uid))
            await pg_pool.execute("DELETE FROM public.documents WHERE user_id = $1", UUID(uid))
        await users.drop_all()
        await drop_org(pg_pool, org)
        if uid:
            left = await pg_pool.fetchval(
                "SELECT (SELECT count(*) FROM public.documents WHERE user_id = $1)"
                " + (SELECT count(*) FROM public.connector_watches WHERE user_id = $1)"
                " + (SELECT count(*) FROM public.connector_connections WHERE created_by = $1)"
                " + (SELECT count(*) FROM auth.users WHERE id = $1)"
                " + (SELECT count(*) FROM storage.objects WHERE bucket_id = 'documents'"
                "    AND name LIKE $2)",
                UUID(uid), f"{uid}/%",
            )
            assert left == 0, f"cleanup left {left} rows/objects behind for {uid}"
        if org:
            assert await pg_pool.fetchval(
                "SELECT count(*) FROM public.legal_holds WHERE org_id = $1", UUID(org)
            ) == 0


def _door1(s: Subject, watch_id: str):
    return sources.delete_folder_watch(
        watch_id=UUID(watch_id), request=_request(), purge_documents=True,
        current_user=s.current_user, supabase=s.client, service_supabase=_admin(), pool=s.pool,
    )


def _door2(s: Subject, watch_id: str):
    return sources.purge_missing_watch_documents(
        watch_id=UUID(watch_id), request=_request(),
        current_user=s.current_user, supabase=s.client, service_supabase=_admin(), pool=s.pool,
    )


def _record(arm: str, doc: dict, before: int, after: int, row_after: bool) -> None:
    line = (f"{arm} | {doc['path']} | storage.objects {before} -> {after} | "
            f"documents row after: {'present' if row_after else 'gone'}")
    EVIDENCE.append(line)
    print(f"EVIDENCE {line}")


# ---------------------------------------------------------------------------------------------


async def test_door1_watch_delete_with_purge_removes_each_object(pg_pool, subject):
    s = subject
    docs = [await s.mint_with_bytes(f"d1-{i}") for i in range(2)]
    watch_id = await s.watch_with(docs)
    before = {d["id"]: await _object_count(pg_pool, d["path"]) for d in docs}
    assert set(before.values()) == {1}

    await _door1(s, watch_id)

    for d in docs:
        after = await _object_count(pg_pool, d["path"])
        row = await _row_exists(pg_pool, d["id"])
        _record("door 1 (DELETE watch, purge_documents=true)", d, before[d["id"]], after, row)
        assert not row, f"door 1 left the documents row {d['id']}"
        assert after == 0, f"door 1 left the stored file {d['path']} behind (DEBT-10)"
    assert not await pg_pool.fetchval(
        "SELECT EXISTS (SELECT 1 FROM public.connector_watches WHERE id = $1)", UUID(watch_id)
    ), "the watch survived its own delete"


async def test_door2_purge_missing_removes_each_object(pg_pool, subject):
    s = subject
    docs = [await s.mint_with_bytes(f"d2-{i}") for i in range(2)]
    keep = await s.mint_with_bytes("d2-present")
    watch_id = await s.watch_with(docs, state="missing")
    # A PRESENT item in the same watch must be left alone (the door purges missing/unauthorized only).
    await pg_pool.execute(
        "INSERT INTO public.connector_watch_items (org_id, watch_id, user_id, external_id, name, "
        "document_id, state) VALUES ($1, $2, $3, 'ext-keep', 'item-keep', $4, 'present')",
        UUID(s.org), UUID(watch_id), UUID(s.uid), UUID(keep["id"]),
    )
    before = {d["id"]: await _object_count(pg_pool, d["path"]) for d in docs}
    assert set(before.values()) == {1}

    resp = await _door2(s, watch_id)
    assert resp.purged_count == 2

    for d in docs:
        after = await _object_count(pg_pool, d["path"])
        row = await _row_exists(pg_pool, d["id"])
        _record("door 2 (POST watch purge, state=missing)", d, before[d["id"]], after, row)
        assert not row, f"door 2 left the documents row {d['id']}"
        assert after == 0, f"door 2 left the stored file {d['path']} behind (DEBT-10)"
    assert await _row_exists(pg_pool, keep["id"]) and await _object_count(pg_pool, keep["path"]) == 1, (
        "door 2 touched a PRESENT item's document"
    )


@pytest.mark.parametrize("door", ["door1", "door2"])
async def test_a_held_document_refuses_and_keeps_its_row_and_its_object(pg_pool, subject, door):
    s = subject
    held = await s.mint_with_bytes(f"held-{door}")
    other = await s.mint_with_bytes(f"held-sibling-{door}")
    watch_id = await s.watch_with([held, other], state="missing")
    await s.hold(held)

    with pytest.raises(HTTPException) as exc:
        await (_door1(s, watch_id) if door == "door1" else _door2(s, watch_id))
    assert exc.value.status_code == 409, exc.value.detail
    assert exc.value.detail["code"] == "legal_hold"

    label = "held, door 1" if door == "door1" else "held, door 2"
    for d in (held, other):
        after = await _object_count(pg_pool, d["path"])
        row = await _row_exists(pg_pool, d["id"])
        _record(f"{label} ({'held' if d is held else 'unheld sibling'}) -> 409", d, 1, after, row)
        assert row, f"a refused purge deleted the row {d['id']}"
        assert after == 1, f"a refused purge cost the stored file {d['path']}"
    assert await pg_pool.fetchval(
        "SELECT EXISTS (SELECT 1 FROM public.connector_watches WHERE id = $1)", UUID(watch_id)
    ), "a refused purge still deleted the watch"


async def test_positive_control_a_noop_bytes_step_leaves_a_visible_orphan(pg_pool, subject, monkeypatch):
    """Plant the defect DEBT-10 fixed: the per-path check must SEE the orphan it leaves."""
    s = subject
    doc = await s.mint_with_bytes("control")
    watch_id = await s.watch_with([doc], state="missing")

    async def _noop(storage, paths, removed, not_removed):
        return None

    monkeypatch.setattr(document_purge, "remove_document_bytes", _noop)
    resp = await _door2(s, watch_id)
    assert resp.purged_count == 1

    after = await _object_count(pg_pool, doc["path"])
    row = await _row_exists(pg_pool, doc["id"])
    _record("CONTROL (bytes step planted as a no-op), door 2", doc, 1, after, row)
    assert not row
    assert after == 1, "the per-path check could not see an orphan it was handed — it proves nothing"
    # The fixture removes this object by path in its finally.


async def test_delete_document_foreign_and_random_ids_answer_the_identical_404(pg_pool, subject):
    s = subject
    users: GoTrueUsers = s.users  # type: ignore[attr-defined]
    other_org = await create_org(pg_pool, "280-pb-other")
    try:
        other_uid, other_tok = await users.create_signed_in_user(other_org, label=f"{EMAIL_MARK}o")
        foreign = await async_mint_document_row(
            raw=f"phase-280 foreign {uuid4().hex}".encode(),
            filename=f"280-pb-foreign-{uuid4().hex[:6]}.txt", mime_type=MIME,
            user_id=other_uid, supabase=user_client(other_tok), folder_id=None, org_id=other_org,
        )
        foreign_id = str(foreign.document["id"])
        assert await _row_exists(pg_pool, foreign_id)

        async def _delete(doc_id: str) -> HTTPException:
            with pytest.raises(HTTPException) as exc:
                await documents_api.delete_document(
                    document_id=doc_id, request=_request(), background_tasks=BackgroundTasks(),
                    scope="version", current_user=s.current_user, supabase=s.client,
                    service_supabase=_admin(),
                )
            return exc.value

        got_foreign = await _delete(foreign_id)
        got_random = await _delete(str(uuid4()))
        for kind, got in (("foreign id", got_foreign), ("random id", got_random)):
            line = f"SC#4 delete_document {kind} -> {got.status_code} {got.detail!r}"
            EVIDENCE.append(line)
            print(f"EVIDENCE {line}")
        assert (got_foreign.status_code, got_foreign.detail) == (404, "Document not found")
        assert (got_foreign.status_code, got_foreign.detail, got_foreign.headers) == (
            got_random.status_code, got_random.detail, got_random.headers
        ), "a foreign id and a random id are distinguishable — an existence oracle"
        assert await _row_exists(pg_pool, foreign_id), "the foreign document was deleted"
    finally:
        await pg_pool.execute(
            "DELETE FROM public.documents WHERE user_id IN "
            "(SELECT user_id FROM public.org_members WHERE org_id = $1)", UUID(other_org),
        )
        await drop_org(pg_pool, other_org)
