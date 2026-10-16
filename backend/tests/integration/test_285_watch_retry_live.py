"""Phase 285-01 (SC#1 / FIX-12 / BUG-261014-02; D-01..D-05, orchestrator ruling 3) — LIVE.

A watched file whose first download fails with an empty-message ``httpx.ConnectError`` must:
  * sync 1 — land ``connector_watch_items.state = 'failed'``, ``failed_attempts = 1``,
    ``last_error = 'ConnectError'`` (the type survives, D-04); the run row reads
    ``status = 'success'``, ``count_errors = 1`` and a ``last_error`` naming the file with its type
    (D-02 / D-03); ``connector_watches.last_error`` stays NULL (orchestrator ruling 3);
  * sync 2 — be read AGAIN and land: ``state = 'present'``, ``failed_attempts = 0``,
    ``minted = true``, a non-failed document with an ``ingestion_jobs`` row and its bytes in
    ``storage.objects`` (D-01 / D-05).

Against the real local DB (:54322), the real service-role client and real storage (:54321). Only
``SourceRegistry.get_adapter`` is patched — to a stub adapter whose ``read_file`` raises once.
No product test knob (280 D-14). Skip-guarded (a skip is a SKIP, never a pass). Everything seeded
is removed in ``finally`` and the removal is PROVEN by count.
"""
from __future__ import annotations

from unittest.mock import patch
from uuid import UUID, uuid4

import httpx
import pytest

from app.services.sources.base import FilePage, SourceFile
from app.services.watch_service import WatchService
from tests.integration._271_gotrue_users import (
    GoTrueUsers,
    _admin,
    create_org,
    drop_org,
    require_gotrue,
)
from tests.integration._rls_harness import requires_pg

pytestmark = requires_pg

BUCKET = "documents"
EMAIL_MARK = "p285wr"


class FlakyAdapter:
    """Lists one file; ``read_file`` raises an empty-message ConnectError on the FIRST call only."""

    def __init__(self, ext_id: str, name: str, raw: bytes):
        self.ext_id, self.name, self.raw = ext_id, name, raw
        self.reads = 0

    async def list_files(self, conn, *, folder_id=None, recursive=False, page_token=None):
        return FilePage(
            files=[SourceFile(id=self.ext_id, name=self.name, mime_type="text/plain",
                              modified_at="2026-10-16T00:00:00Z")],
            next_page_token=None,
        )

    async def read_file(self, conn, file_id):
        self.reads += 1
        if self.reads == 1:
            raise httpx.ConnectError("")
        return self.name, self.raw, "text/plain"


@pytest.fixture
async def seeded(pg_pool):
    require_gotrue()
    users = GoTrueUsers(pg_pool)
    org = uid = None
    try:
        org = await create_org(pg_pool, "285-wr")
        uid, _tok = await users.create_signed_in_user(org, label=EMAIL_MARK)
        conn_id, watch_id = uuid4(), uuid4()
        await pg_pool.execute(
            "INSERT INTO public.connector_connections (id, org_id, created_by, name, service_id) "
            "VALUES ($1, $2, $3, $4, 'p285-test')",
            conn_id, UUID(org), UUID(uid), "285 watch-retry connection",
        )
        await pg_pool.execute(
            "INSERT INTO public.connector_watches (id, org_id, user_id, connection_id, "
            "source_folder_id, source_folder_name, interval_minutes, is_active) "
            "VALUES ($1, $2, $3, $4, $5, $6, 60, false)",
            watch_id, UUID(org), UUID(uid), conn_id, f"p285-src-{watch_id.hex[:6]}",
            "285 watch-retry source",
        )
        watch = {
            "id": watch_id, "connection_id": conn_id, "user_id": UUID(uid), "org_id": UUID(org),
            "library_folder_id": None, "source_folder_id": f"p285-src-{watch_id.hex[:6]}",
        }
        yield {"watch": watch, "uid": uid, "org": org}
    finally:
        if uid:
            paths = [r["file_path"] for r in await pg_pool.fetch(
                "SELECT file_path FROM public.documents WHERE user_id = $1", UUID(uid))]
            if paths:
                _admin().storage.from_(BUCKET).remove(paths)
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


async def _item(pool, watch_id):
    return await pool.fetchrow(
        "SELECT state, failed_attempts, minted, last_error, document_id "
        "FROM public.connector_watch_items WHERE watch_id = $1", watch_id,
    )


async def _latest_run(pool, watch_id):
    return await pool.fetchrow(
        "SELECT status, count_errors, count_new, last_error FROM public.connector_sync_runs "
        "WHERE watch_id = $1 ORDER BY started_at DESC LIMIT 1", watch_id,
    )


@pytest.mark.asyncio
async def test_failed_watch_download_is_read_again_and_lands(pg_pool, seeded):
    watch = seeded["watch"]
    name = f"285-team-note-{uuid4().hex[:6]}.txt"
    adapter = FlakyAdapter(f"ext-{uuid4().hex[:8]}", name, f"phase-285 retry {uuid4().hex}".encode())
    svc = WatchService(pool=pg_pool, supabase=_admin())

    with patch("app.services.sources.base.SourceRegistry.get_adapter", return_value=adapter):
        # ── sync 1: the download fails ───────────────────────────────────────────────────
        res1 = await svc.sync_watch(watch)
        assert res1["status"] == "success"
        it = await _item(pg_pool, watch["id"])
        assert it["state"] == "failed"
        assert it["failed_attempts"] == 1
        assert it["last_error"] == "ConnectError"
        run = await _latest_run(pg_pool, watch["id"])
        assert run["status"] == "success"
        assert run["count_errors"] == 1
        assert run["last_error"] is not None
        assert name in run["last_error"] and "(ConnectError)" in run["last_error"]
        assert await pg_pool.fetchval(
            "SELECT last_error FROM public.connector_watches WHERE id = $1", watch["id"]
        ) is None
        print(f"EVIDENCE sync1 item={dict(it)} run={dict(run)}")

        # ── sync 2: read again, lands ────────────────────────────────────────────────────
        res2 = await svc.sync_watch(watch)
        assert res2["status"] == "success"
        assert adapter.reads == 2
        it = await _item(pg_pool, watch["id"])
        assert it["state"] == "present"
        assert it["failed_attempts"] == 0
        assert it["minted"] is True
        assert it["document_id"] is not None
        doc = await pg_pool.fetchrow(
            "SELECT status, file_path FROM public.documents WHERE id = $1", it["document_id"])
        assert doc["status"] != "failed"
        assert await pg_pool.fetchval(
            "SELECT count(*) FROM public.ingestion_jobs WHERE document_id = $1", it["document_id"]
        ) >= 1
        assert await pg_pool.fetchval(
            "SELECT count(*) FROM storage.objects WHERE bucket_id = 'documents' AND name = $1",
            doc["file_path"],
        ) == 1
        run = await _latest_run(pg_pool, watch["id"])
        assert run["status"] == "success"
        assert run["count_errors"] == 0
        assert run["count_new"] == 1
        assert run["last_error"] is None
        print(f"EVIDENCE sync2 item={dict(it)} doc_status={doc['status']} run={dict(run)}")
