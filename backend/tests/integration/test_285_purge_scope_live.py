"""Phase 285-02 (SC#2 / FIX-13 / BUG-261014-03; D-06, D-08, D-09, D-11) — LIVE, PER-PATH evidence.

⛔ THE DEFECT. Both watch purge doors (``DELETE /sources/watches/{id}?purge_documents=true`` and
``POST /sources/watches/{id}/purge``) deleted EVERY document a watch item pointed at. A watch whose
listing carried the same bytes as a person's hand upload only DEDUP-LINKED to that upload — and a
purge then took the hand upload's row AND its stored bytes.

⭐ THE CONTRACT, per path, against live local storage (``storage.objects``, never a mock):
  * a hand upload the watch only linked survives BOTH doors — row present, object count 1;
  * a document the watch MINTED, referenced by nothing else, is still purged with its bytes
    (positive control: the fix narrows the set, it does not disable purge — DEBT-10 holds);
  * D-08: a minted document still referenced by an item OUTSIDE the purge scope (another watch, or
    a present sibling item of the same watch) is kept;
  * D-09: door 2 reports ``purged_count`` = rows actually deleted and ``kept_count`` = docs left.

LINK METHOD (recorded for 285-LIVE-EVIDENCE.md): the hand upload's link is made by DRIVING
``WatchService.sync_watch`` with a stub adapter whose one listed file carries the hand upload's
exact bytes — the real minter dedups to the hand upload and the real watch arm writes the item.
The item row is never seeded, so the minted column is never named for it (valid before and after
migration 209). Only the documents the WATCH minted are seeded with an explicit ``minted = true``.

The route coroutines are called directly (the ``test_280_purge_bytes_live.py`` shape) with the LIVE
user-JWT client, a service-role client for the hold predicates and a real asyncpg pool. Watches are
created ``is_active = false`` so no worker claims them. Skip-guarded on :54322 and :54321 (a skip
is a SKIP, never a pass). Everything seeded is removed in ``finally`` and the removal is PROVEN.
"""
from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import patch
from uuid import UUID, uuid4

import pytest

from app.api import sources
from app.services.ingest_splice import async_mint_document_row
from app.services.sources.base import FilePage, SourceFile
from app.services.watch_service import WatchService
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
EMAIL_MARK = "p285ps"
MIME = "text/plain"

#: Rows printed under ``-s`` and copied into 285-LIVE-EVIDENCE.md.
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


class _OneFileAdapter:
    """Lists ONE file carrying the given bytes; ``read_file`` returns them."""

    def __init__(self, ext_id: str, name: str, raw: bytes):
        self.ext_id, self.name, self.raw = ext_id, name, raw

    async def list_files(self, conn, *, folder_id=None, recursive=False, page_token=None):
        return FilePage(
            files=[SourceFile(id=self.ext_id, name=self.name, mime_type=MIME,
                              modified_at="2026-10-16T00:00:00Z")],
            next_page_token=None,
        )

    async def read_file(self, conn, file_id):
        return self.name, self.raw, MIME


class Subject:
    """One signed-in GoTrue user in one org, with a connection to hang watches on."""

    def __init__(self, pool, uid: str, tok: str, org: str, conn_id: str):
        self.pool, self.uid, self.tok, self.org, self.conn_id = pool, uid, tok, org, conn_id
        self.client = user_client(tok)
        self.paths: list[str] = []

    @property
    def current_user(self) -> dict:
        return {"id": self.uid, "email": f"{EMAIL_MARK}@test.local"}

    async def hand_upload(self, tag: str) -> dict:
        """A document the person uploaded by hand: minted with THEIR client, bytes uploaded."""
        raw = f"phase-285 purge-scope {tag} {uuid4().hex}".encode()
        res = await async_mint_document_row(
            raw=raw, filename=f"285-ps-{tag}-{uuid4().hex[:6]}.txt", mime_type=MIME,
            user_id=self.uid, supabase=self.client, folder_id=None, org_id=self.org,
        )
        assert res.is_duplicate is False
        doc = res.document
        path = doc["file_path"]
        assert path.startswith(f"{self.uid}/"), path
        self.client.storage.from_(BUCKET).upload(path, raw, {"content-type": MIME})
        self.paths.append(path)
        assert await _object_count(self.pool, path) == 1, f"the upload of {path} did not land"
        return {"id": str(doc["id"]), "path": path, "raw": raw}

    async def watch(self, tag: str) -> dict:
        watch_id = uuid4()
        folder = f"p285-src-{tag}-{watch_id.hex[:6]}"
        await self.pool.execute(
            "INSERT INTO public.connector_watches (id, org_id, user_id, connection_id, "
            "source_folder_id, source_folder_name, interval_minutes, is_active) "
            "VALUES ($1, $2, $3, $4, $5, $6, 60, false)",
            watch_id, UUID(self.org), UUID(self.uid), UUID(self.conn_id), folder,
            f"285 purge-scope source {tag}",
        )
        return {
            "id": watch_id, "connection_id": UUID(self.conn_id), "user_id": UUID(self.uid),
            "org_id": UUID(self.org), "library_folder_id": None, "source_folder_id": folder,
        }

    async def link_by_sync(self, watch: dict, hand: dict) -> UUID:
        """Drive the REAL watch sync over a listing carrying the hand upload's exact bytes.

        The minter dedups to the hand upload and the watch arm writes the linked item. Returns the
        item id; asserts the item points at the hand upload and is NOT marked minted.
        """
        ext_id = f"ext-link-{uuid4().hex[:8]}"
        adapter = _OneFileAdapter(ext_id, f"285-ps-copy-{uuid4().hex[:6]}.txt", hand["raw"])
        svc = WatchService(pool=self.pool, supabase=_admin())
        with patch("app.services.sources.base.SourceRegistry.get_adapter", return_value=adapter):
            res = await svc.sync_watch(watch)
        assert res["status"] == "success", res
        it = await self.pool.fetchrow(
            "SELECT id, document_id, minted FROM public.connector_watch_items "
            "WHERE watch_id = $1 AND external_id = $2", watch["id"], ext_id,
        )
        assert it is not None, "sync_watch wrote no item for the listed file"
        assert str(it["document_id"]) == hand["id"], (
            f"the watch did not dedup-link to the hand upload: item -> {it['document_id']}"
        )
        assert it["minted"] is False, "a dedup link was marked minted"
        return it["id"]

    async def minted_item(self, watch: dict, doc: dict, *, state: str) -> UUID:
        """An item for a document the WATCH minted (explicit ``minted = true``)."""
        item_id = uuid4()
        await self.pool.execute(
            "INSERT INTO public.connector_watch_items (id, org_id, watch_id, user_id, external_id, "
            "name, document_id, state, minted) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)",
            item_id, UUID(self.org), watch["id"], UUID(self.uid), f"ext-m-{uuid4().hex[:8]}",
            "minted-item", UUID(doc["id"]), state,
        )
        return item_id

    async def plain_item(self, watch: dict, doc: dict, *, state: str) -> UUID:
        """Another item referencing ``doc`` — the minted column is NOT named (default)."""
        item_id = uuid4()
        await self.pool.execute(
            "INSERT INTO public.connector_watch_items (id, org_id, watch_id, user_id, external_id, "
            "name, document_id, state) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
            item_id, UUID(self.org), watch["id"], UUID(self.uid), f"ext-p-{uuid4().hex[:8]}",
            "plain-item", UUID(doc["id"]), state,
        )
        return item_id


@pytest.fixture
async def subject(pg_pool):
    require_gotrue()
    users = GoTrueUsers(pg_pool)
    org = uid = None
    s: Subject | None = None
    try:
        org = await create_org(pg_pool, "285-ps")
        uid, tok = await users.create_signed_in_user(org, label=EMAIL_MARK)
        conn_id = uuid4()
        await pg_pool.execute(
            "INSERT INTO public.connector_connections (id, org_id, created_by, name, service_id) "
            "VALUES ($1, $2, $3, $4, 'p285-test')",
            conn_id, UUID(org), UUID(uid), "285 purge-scope connection",
        )
        s = Subject(pg_pool, uid, tok, org, str(conn_id))
        yield s
    finally:
        if uid:
            paths = [r["file_path"] for r in await pg_pool.fetch(
                "SELECT file_path FROM public.documents WHERE user_id = $1", UUID(uid))]
            paths += list(s.paths) if s is not None else []
            if paths:
                _admin().storage.from_(BUCKET).remove(sorted(set(p for p in paths if p)))
            await pg_pool.execute("DELETE FROM public.connector_watches WHERE user_id = $1", UUID(uid))
            await pg_pool.execute(
                "DELETE FROM public.connector_connections WHERE created_by = $1", UUID(uid))
            await pg_pool.execute("DELETE FROM public.documents WHERE user_id = $1", UUID(uid))
        await users.drop_all()
        await drop_org(pg_pool, org)
        if uid:
            left = await pg_pool.fetchval(
                "SELECT (SELECT count(*) FROM public.documents WHERE user_id = $1)"
                " + (SELECT count(*) FROM public.ingestion_jobs WHERE user_id = $1)"
                " + (SELECT count(*) FROM public.connector_watches WHERE user_id = $1)"
                " + (SELECT count(*) FROM public.connector_watch_items WHERE user_id = $1)"
                " + (SELECT count(*) FROM public.connector_sync_runs WHERE user_id = $1)"
                " + (SELECT count(*) FROM public.connector_connections WHERE created_by = $1)"
                " + (SELECT count(*) FROM auth.users WHERE id = $1)"
                " + (SELECT count(*) FROM storage.objects WHERE bucket_id = 'documents'"
                "    AND name LIKE $2)",
                UUID(uid), f"{uid}/%",
            )
            assert left == 0, f"cleanup left {left} rows/objects behind for {uid}"


def _door1(s: Subject, watch_id: UUID):
    return sources.delete_folder_watch(
        watch_id=watch_id, request=_request(), purge_documents=True,
        current_user=s.current_user, supabase=s.client, service_supabase=_admin(), pool=s.pool,
    )


def _door2(s: Subject, watch_id: UUID):
    return sources.purge_missing_watch_documents(
        watch_id=watch_id, request=_request(),
        current_user=s.current_user, supabase=s.client, service_supabase=_admin(), pool=s.pool,
    )


async def _state(pool, doc: dict) -> tuple[int, bool]:
    return await _object_count(pool, doc["path"]), await _row_exists(pool, doc["id"])


def _record(arm: str, role: str, doc: dict, before: int, after: int, row_after: bool) -> None:
    line = (f"{arm} | {role} | {doc['path']} | storage.objects {before} -> {after} | "
            f"documents row after: {'present' if row_after else 'gone'}")
    EVIDENCE.append(line)
    print(f"EVIDENCE {line}")


async def _item_exists(pool, item_id: UUID) -> bool:
    return bool(await pool.fetchval(
        "SELECT EXISTS (SELECT 1 FROM public.connector_watch_items WHERE id = $1)", item_id,
    ))


# ---------------------------------------------------------------------------------------------


async def test_door1_keeps_linked_hand_upload(pg_pool, subject):
    s = subject
    hand = await s.hand_upload("d1-hand")
    w = await s.watch("d1")
    await s.link_by_sync(w, hand)
    mine = await s.hand_upload("d1-minted")       # bytes landed; the WATCH is recorded as its minter
    await s.minted_item(w, mine, state="present")

    await _door1(s, w["id"])

    h_after, h_row = await _state(pg_pool, hand)
    m_after, m_row = await _state(pg_pool, mine)
    arm = "door 1 (DELETE watch, purge_documents=true)"
    _record(arm, "hand upload, dedup-linked", hand, 1, h_after, h_row)
    _record(arm, "watch-minted, unshared", mine, 1, m_after, m_row)
    assert h_row, "door 1 deleted the documents row of a hand upload the watch only linked (FIX-13)"
    assert h_after == 1, f"door 1 deleted the stored file {hand['path']} of a linked hand upload"
    assert not m_row, "door 1 left the row of a document the watch minted (DEBT-10 positive control)"
    assert m_after == 0, f"door 1 left the stored file {mine['path']} of a minted document"
    assert not await pg_pool.fetchval(
        "SELECT EXISTS (SELECT 1 FROM public.connector_watches WHERE id = $1)", w["id"]
    ), "the watch survived its own delete"


async def test_door2_keeps_linked_hand_upload(pg_pool, subject):
    s = subject
    hand = await s.hand_upload("d2-hand")
    w = await s.watch("d2")
    linked_item = await s.link_by_sync(w, hand)
    # The source dropped the file: the linked item is now missing (the purge door's input state).
    await pg_pool.execute(
        "UPDATE public.connector_watch_items SET state = 'missing' WHERE id = $1", linked_item,
    )
    mine = await s.hand_upload("d2-minted")
    minted_item = await s.minted_item(w, mine, state="missing")

    resp = await _door2(s, w["id"])

    h_after, h_row = await _state(pg_pool, hand)
    m_after, m_row = await _state(pg_pool, mine)
    arm = "door 2 (POST watch purge, state=missing)"
    _record(arm, "hand upload, dedup-linked", hand, 1, h_after, h_row)
    _record(arm, "watch-minted, unshared", mine, 1, m_after, m_row)
    line = (f"{arm} | receipt | purged_count={resp.purged_count} "
            f"kept_count={getattr(resp, 'kept_count', '<absent>')} | message={resp.message!r}")
    EVIDENCE.append(line)
    print(f"EVIDENCE {line}")
    assert h_row, "door 2 deleted the documents row of a hand upload the watch only linked (FIX-13)"
    assert h_after == 1, f"door 2 deleted the stored file {hand['path']} of a linked hand upload"
    assert not m_row, "door 2 left the row of a document the watch minted (DEBT-10 positive control)"
    assert m_after == 0, f"door 2 left the stored file {mine['path']} of a minted document"
    assert resp.purged_count == 1
    assert resp.kept_count == 1
    assert not await _item_exists(pg_pool, linked_item), "door 2 kept the linked item row (unlinking is not deleting)"
    assert not await _item_exists(pg_pool, minted_item), "door 2 kept the purged item row"


async def test_door2_keeps_minted_doc_shared_with_other_watch(pg_pool, subject):
    s = subject
    shared = await s.hand_upload("shared")          # bytes landed; W1 is recorded as its minter
    w1 = await s.watch("w1")
    w2 = await s.watch("w2")
    w1_item = await s.minted_item(w1, shared, state="missing")
    w2_item = await s.plain_item(w2, shared, state="present")

    resp = await _door2(s, w1["id"])

    after, row = await _state(pg_pool, shared)
    arm = "door 2 on W1 (D-08: also referenced by W2)"
    _record(arm, "W1-minted, W2 still references it", shared, 1, after, row)
    assert row, "door 2 deleted a minted document another watch still references (D-08)"
    assert after == 1, f"door 2 deleted the stored file {shared['path']} another watch still uses"
    assert resp.purged_count == 0
    assert resp.kept_count == 1
    assert not await _item_exists(pg_pool, w1_item), "W1's in-scope item row was not deleted"
    assert str(await pg_pool.fetchval(
        "SELECT document_id FROM public.connector_watch_items WHERE id = $1", w2_item,
    )) == shared["id"], "W2's item no longer points at the shared document"


async def test_door2_keeps_minted_doc_with_present_sibling(pg_pool, subject):
    s = subject
    doc = await s.hand_upload("sibling")
    w = await s.watch("sib")
    a = await s.minted_item(w, doc, state="missing")
    b = await s.plain_item(w, doc, state="present")

    resp = await _door2(s, w["id"])

    after, row = await _state(pg_pool, doc)
    arm = "door 2 (D-08: a PRESENT sibling item of the same watch)"
    _record(arm, "minted by item A (missing), linked by item B (present)", doc, 1, after, row)
    assert row, "door 2 deleted a document a present sibling item of the same watch still uses (D-08)"
    assert after == 1, f"door 2 deleted the stored file {doc['path']} a present sibling still uses"
    assert resp.purged_count == 0
    assert resp.kept_count == 1
    assert not await _item_exists(pg_pool, a), "the missing item A was not deleted"
    assert await _item_exists(pg_pool, b), "door 2 deleted a PRESENT item"
