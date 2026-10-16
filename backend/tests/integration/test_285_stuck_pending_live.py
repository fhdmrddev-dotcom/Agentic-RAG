"""Phase 285-03 (SC#3 / FIX-14 / BUG-261014-04; D-12, D-13, D-14, D-16) — LIVE.

SC#3 / D-16. When ``/documents/upload`` could not queue a document (the asyncpg insert AND the
service-role insert both raised), the row used to stay ``pending`` with no ``ingestion_jobs`` row.
The minter's in-flight leg (280 FIX-02 / D-24, folder-agnostic) treats any ``pending`` row with the
same bytes as in flight, so that stranded row absorbed EVERY later upload of the same bytes, in
EVERY folder, as ``already_in_library`` — and nothing ever read it. The fix marks the row failed in
the enqueue-failure arm (D-12) and answers ``201`` with ``status: failed`` (D-13), so the next
upload of the same bytes, here into a DIFFERENT folder, is minted afresh and queued. The minter
itself is not touched (FIX-02 still holds; ``test_280_same_bytes_live.py`` re-pins it).

D-14. Migration 209's heal block (the text between ``-- 209 HEAL BEGIN`` and ``-- 209 HEAL END``),
executed live inside a transaction that is ROLLED BACK: a stuck ``pending`` row older than 1 h
whose bytes exist is enqueued; one whose bytes are missing is marked failed with the "never read"
message; a recent (< 1 h) pending row is left alone. The rollback means no global side effect.

The route coroutine is called directly (the ``test_280_purge_bytes_live.py`` shape) with the LIVE
user-JWT client, the real service-role client (wrapped only to make its ``ingestion_jobs`` insert
raise) and the real asyncpg pool. Skip-guarded on :54322 and :54321 — a skip is a SKIP, never a
pass. Everything seeded is removed in ``finally`` and the removal is PROVEN by SQL count.
"""
from __future__ import annotations

import hashlib
import io
import pathlib
from unittest.mock import AsyncMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi import BackgroundTasks, Response, UploadFile
from starlette.datastructures import Headers

from app.api import documents as documents_api
from app.config import settings
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
EMAIL_MARK = "p285sp"
MIME = "text/plain"
MIGRATION_209 = (
    pathlib.Path(__file__).resolve().parents[3]
    / "supabase" / "migrations" / "209_watch_item_retry_and_purge_scope.sql"
)

#: Rows printed under ``-s`` and copied into 285-LIVE-EVIDENCE.md.
EVIDENCE: list[str] = []


def _record(line: str) -> None:
    EVIDENCE.append(line)
    print(f"EVIDENCE {line}")


async def _seed_folder(pool, *, uid: str, org_id: str, label: str) -> str:
    folder_id = uuid4()
    await pool.execute(
        "INSERT INTO public.folders (id, user_id, org_id, name) VALUES ($1, $2, $3, $4)",
        folder_id, UUID(uid), UUID(org_id), f"285-sp-{label}-{folder_id.hex[:6]}",
    )
    return str(folder_id)


@pytest.fixture
async def subject(pg_pool):
    require_gotrue()
    users = GoTrueUsers(pg_pool)
    org = uid = None
    try:
        org = await create_org(pg_pool, "285-sp")
        uid, tok = await users.create_signed_in_user(org, label=EMAIL_MARK)
        fa = await _seed_folder(pg_pool, uid=uid, org_id=org, label="a")
        fb = await _seed_folder(pg_pool, uid=uid, org_id=org, label="b")
        yield {"uid": uid, "tok": tok, "org": org, "fa": fa, "fb": fb}
    finally:
        if uid:
            paths = [r["name"] for r in await pg_pool.fetch(
                "SELECT name FROM storage.objects WHERE bucket_id = $1 AND name LIKE $2",
                BUCKET, f"{uid}/%",
            )]
            if paths:
                _admin().storage.from_(BUCKET).remove(paths)
            # ingestion_jobs cascade from documents (ON DELETE CASCADE, migration 153).
            await pg_pool.execute("DELETE FROM public.documents WHERE user_id = $1", UUID(uid))
            await pg_pool.execute("DELETE FROM public.folders WHERE user_id = $1", UUID(uid))
        await users.drop_all()
        await drop_org(pg_pool, org)
        if uid:
            left = await pg_pool.fetchval(
                "SELECT (SELECT count(*) FROM public.documents WHERE user_id = $1)"
                " + (SELECT count(*) FROM public.ingestion_jobs WHERE user_id = $1)"
                " + (SELECT count(*) FROM public.folders WHERE user_id = $1)"
                " + (SELECT count(*) FROM auth.users WHERE id = $1)"
                " + (SELECT count(*) FROM storage.objects WHERE bucket_id = 'documents'"
                "    AND name LIKE $2)",
                UUID(uid), f"{uid}/%",
            )
            assert left == 0, f"cleanup left {left} rows/objects behind for {uid}"


class _JobsInsertRefused:
    """The service-role client with ONLY ``table("ingestion_jobs")`` broken; everything else
    (documents, storage, ...) delegates to the real client."""

    def __init__(self, real):
        self._real = real

    def table(self, name):
        if name == "ingestion_jobs":
            return _RaisingTable()
        return self._real.table(name)

    def __getattr__(self, attr):
        return getattr(self._real, attr)


class _RaisingTable:
    def insert(self, *_a, **_k):
        return self

    def execute(self):
        raise RuntimeError("285-03 forced: service-role ingestion_jobs insert refused")


def _upload_file(raw: bytes, name: str) -> UploadFile:
    return UploadFile(file=io.BytesIO(raw), filename=name, headers=Headers({"content-type": MIME}))


async def _upload(subj: dict, raw: bytes, name: str, folder_id: str, service) -> tuple[Response, dict]:
    resp = Response()
    body = await documents_api.upload_document(
        response=resp,
        background_tasks=BackgroundTasks(),
        file=_upload_file(raw, name),
        folder_id=folder_id,
        engines=None,
        current_user={"id": subj["uid"], "email": f"{EMAIL_MARK}@test.local", "org_id": subj["org"]},
        supabase=user_client(subj["tok"]),
        service_supabase=service,
    )
    return resp, dict(body)


async def _jobs(pool, doc_id) -> int:
    return await pool.fetchval(
        "SELECT count(*) FROM public.ingestion_jobs WHERE document_id = $1", UUID(str(doc_id)),
    )


async def _doc(pool, doc_id):
    return await pool.fetchrow(
        "SELECT id, status, ingestion_step, error_message, folder_id FROM public.documents "
        "WHERE id = $1", UUID(str(doc_id)),
    )


# ---------------------------------------------------------------------------------------------
# SC#3 / D-16 — a failed enqueue must not strand a same-bytes-absorbing pending row
# ---------------------------------------------------------------------------------------------


async def test_enqueue_failure_does_not_strand_and_reupload_ingests(pg_pool, subject, monkeypatch):
    monkeypatch.setattr(settings, "ingest_worker_enabled", True)
    raw = f"phase-285 stuck-pending {uuid4().hex}".encode()
    name = f"285-sp-{uuid4().hex[:6]}.txt"
    real = _admin()

    # Upload 1, folder A: BOTH enqueue paths fail.
    with patch("app.dependencies.get_pg_pool", new=AsyncMock(return_value=pg_pool)), \
         patch("app.db.ingestion_jobs.insert_ingestion_job",
               new=AsyncMock(side_effect=RuntimeError("285-03 forced: asyncpg enqueue refused"))):
        resp1, body1 = await _upload(subject, raw, name, subject["fa"], _JobsInsertRefused(real))

    row1 = await _doc(pg_pool, body1["id"])
    jobs1 = await _jobs(pg_pool, body1["id"])
    _record(f"SC#3 upload 1 (both enqueue paths forced to fail) -> HTTP {resp1.status_code} "
            f"body.status={body1.get('status')!r} | row status={row1['status']!r} "
            f"step={row1['ingestion_step']!r} | ingestion_jobs={jobs1}")

    # Upload 2, folder B: same bytes, nothing patched.
    with patch("app.dependencies.get_pg_pool", new=AsyncMock(return_value=pg_pool)):
        resp2, body2 = await _upload(subject, raw, name, subject["fb"], real)
    row2 = await _doc(pg_pool, body2["id"])
    jobs2 = await _jobs(pg_pool, body2["id"])
    _record(f"SC#3 upload 2 (same bytes, folder B) -> HTTP {resp2.status_code} "
            f"already_in_library={body2.get('already_in_library')!r} "
            f"new_id={str(body2['id']) != str(body1['id'])} | row status={row2['status']!r} "
            f"folder_is_B={str(row2['folder_id']) == subject['fb']} | ingestion_jobs={jobs2}")

    # Upload 1 is refused visibly (D-12 / D-13), never left pending with no job.
    assert resp1.status_code == 201
    assert body1["status"] == "failed", f"upload 1 answered {body1['status']!r}"
    assert row1["status"] == "failed", f"the stranded row is {row1['status']!r} with {jobs1} job(s)"
    assert row1["ingestion_step"] == "failed"
    assert row1["error_message"] == (
        "This file could not be queued for reading. Please try uploading it again."
    )
    assert jobs1 == 0

    # Upload 2 is a NEW document in folder B, queued.
    assert not body2.get("already_in_library"), (
        "the same bytes in a different folder were absorbed by the stranded row (BUG-261014-04)"
    )
    assert str(body2["id"]) != str(body1["id"])
    assert row2["status"] != "failed"
    assert str(row2["folder_id"]) == subject["fb"]
    assert jobs2 == 1, f"the re-upload has {jobs2} ingestion_jobs row(s)"


# ---------------------------------------------------------------------------------------------
# D-14 — migration 209's heal, executed live inside a rolled-back transaction
# ---------------------------------------------------------------------------------------------


def _heal_sql() -> str:
    text = MIGRATION_209.read_text(encoding="utf-8")
    start = text.index("-- 209 HEAL BEGIN")
    end = text.index("-- 209 HEAL END")
    body = text[start:end]
    assert "INSERT INTO public.ingestion_jobs" in body and "UPDATE public.documents" in body
    return body


async def test_209_heal_enqueues_with_bytes_fails_without_and_skips_recent(pg_pool, subject):
    uid, tok, org = subject["uid"], subject["tok"], subject["org"]
    docs = {}
    for tag in ("P", "Q", "R"):
        raw = f"phase-285 heal {tag} {uuid4().hex}".encode()
        res = await async_mint_document_row(
            raw=raw, filename=f"285-heal-{tag}-{uuid4().hex[:6]}.txt", mime_type=MIME,
            user_id=uid, supabase=user_client(tok), folder_id=None, org_id=org,
        )
        assert res.is_duplicate is False
        docs[tag] = {"id": str(res.document["id"]), "path": res.document["file_path"], "raw": raw}
    # Bytes for P only.
    _admin().storage.from_(BUCKET).upload(docs["P"]["path"], docs["P"]["raw"], {"content-type": MIME})
    assert await pg_pool.fetchval(
        "SELECT count(*) FROM storage.objects WHERE bucket_id = $1 AND name = $2",
        BUCKET, docs["P"]["path"],
    ) == 1
    # P and Q are 2 h old; R stays recent. No document has a job.
    await pg_pool.execute(
        "UPDATE public.documents SET created_at = now() - interval '2 hours' WHERE id = ANY($1::uuid[])",
        [UUID(docs["P"]["id"]), UUID(docs["Q"]["id"])],
    )
    for d in docs.values():
        assert await _jobs(pg_pool, d["id"]) == 0

    heal = _heal_sql()
    async with pg_pool.acquire() as conn:
        tx = conn.transaction()
        await tx.start()
        try:
            await conn.execute(heal)
            got = {}
            for tag, d in docs.items():
                row = await conn.fetchrow(
                    "SELECT status, error_message FROM public.documents WHERE id = $1", UUID(d["id"]),
                )
                jobs = await conn.fetch(
                    "SELECT status FROM public.ingestion_jobs WHERE document_id = $1", UUID(d["id"]),
                )
                got[tag] = (row["status"], row["error_message"], [j["status"] for j in jobs])
                _record(f"D-14 heal (rolled back) {tag}: status={row['status']!r} "
                        f"jobs={[j['status'] for j in jobs]} error={row['error_message']!r}")
        finally:
            await tx.rollback()

    assert got["P"][0] == "pending" and got["P"][2] == ["pending"], got["P"]
    assert got["Q"][0] == "failed" and got["Q"][2] == [], got["Q"]
    assert got["Q"][1] == (
        "This file was never read, because its upload did not finish. Please upload it again."
    )
    assert got["R"][0] == "pending" and got["R"][2] == [], got["R"]

    # The rollback left no trace: no job for any of the three, all still pending.
    for tag, d in docs.items():
        assert await _jobs(pg_pool, d["id"]) == 0, f"{tag} kept a job after the rollback"
        assert (await _doc(pg_pool, d["id"]))["status"] == "pending", f"{tag} changed after rollback"
    _record("D-14 heal: rolled back — 0 jobs and 3 pending rows after the rollback")
