"""Phase 280 (FIX-02 / SC#1 / BUG-261005-01) — same bytes in flight, against the LIVE local stack.

What this proves, on the real arbiters (``documents_dedup_idx`` and
``documents_completed_hash_unique_idx`` at :54322, reached through PostgREST at :54321):

  * A second mint of the same bytes while the first copy is still ``pending`` returns THAT copy as
    a duplicate. It never answers 409 and it never retires the in-flight copy (the BUG-261005-01
    failure: the retire UPDATE ran BEFORE the INSERT, then the insert hit 23505).
  * The same bytes into a DIFFERENT folder while the first copy is pending are also a duplicate of
    it (D-24: the in-flight leg is folder-agnostic, because the completed-hash index has no folder
    column — a second copy would only fail later, at completion).
  * Two concurrent mints of the same bytes (``asyncio.gather``, two SEPARATE user clients — Pitfall
    4) leave exactly one non-failed row, ``is_latest = true``, and both results carry its id.
  * Every one of the 7 minter callers' parameter sets (D-04) gets the same answer.
  * A real new version (same filename, different bytes) still versions, and two concurrent new
    versions never leave ZERO latest rows (D-25) — nor two (280-REVIEW WR-02: exactly one).

Every client is built from ``backend/.env`` via ``_local_env()`` (Pitfall 6 — ``tests/conftest.py``
points ``settings`` at a placeholder). Users, orgs, folders and documents are deleted in ``finally``
and the cleanup is asserted by SQL. Skip-guarded on :54322 and :54321 — a skip is a SKIP, not a pass.
"""
from __future__ import annotations

import asyncio
from uuid import UUID, uuid4

import pytest
from starlette.concurrency import run_in_threadpool

from app.services.ingest_splice import async_mint_document_row, mint_document_row
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

#: Marker carried by every e-mail this file creates, so cleanup can be proven by SQL.
EMAIL_MARK = "p280sb"
MIME = "text/plain"


async def _seed_folder(pool, *, uid: str, org_id: str, label: str) -> str:
    folder_id = uuid4()
    await pool.execute(
        "INSERT INTO public.folders (id, user_id, org_id, name) VALUES ($1, $2, $3, $4)",
        folder_id, UUID(uid), UUID(org_id), f"280-sb-{label}-{folder_id.hex[:6]}",
    )
    got = await pool.fetchval("SELECT org_id FROM public.folders WHERE id = $1", folder_id)
    assert str(got) == org_id, "the seeded folder's org did not land"
    return str(folder_id)


@pytest.fixture
async def subject(pg_pool):
    require_gotrue()
    users = GoTrueUsers(pg_pool)
    org_id = uid = None
    try:
        org_id = await create_org(pg_pool, "280-sb")
        uid, tok = await users.create_signed_in_user(org_id, label=EMAIL_MARK)
        f1 = await _seed_folder(pg_pool, uid=uid, org_id=org_id, label="f1")
        f2 = await _seed_folder(pg_pool, uid=uid, org_id=org_id, label="f2")
        yield {"uid": uid, "tok": tok, "org": org_id, "f1": f1, "f2": f2}
    finally:
        if uid:
            paths = [
                r["file_path"] for r in await pg_pool.fetch(
                    "SELECT file_path FROM public.documents WHERE user_id = $1", UUID(uid)
                )
            ]
            if paths:
                try:  # the minter writes no bytes; this is belt-and-braces for a future caller
                    _admin().storage.from_("documents").remove(paths)
                except Exception:
                    pass
            await pg_pool.execute("DELETE FROM public.documents WHERE user_id = $1", UUID(uid))
            await pg_pool.execute("DELETE FROM public.folders WHERE user_id = $1", UUID(uid))
        await users.drop_all()
        await drop_org(pg_pool, org_id)
        if uid:
            left = await pg_pool.fetchval(
                "SELECT (SELECT count(*) FROM public.documents WHERE user_id = $1)"
                " + (SELECT count(*) FROM public.folders WHERE user_id = $1)"
                " + (SELECT count(*) FROM auth.users WHERE id = $1)"
                " + (SELECT count(*) FROM storage.objects WHERE name LIKE $2)",
                UUID(uid), f"{uid}/%",
            )
            assert left == 0, f"cleanup left {left} rows behind for {uid}"


def _raw(tag: str) -> bytes:
    return f"phase-280 same-bytes {tag} {uuid4().hex}".encode()


async def _state(pool, uid: str, raw: bytes) -> list[dict]:
    import hashlib

    rows = await pool.fetch(
        "SELECT id, status, is_latest, version_number, org_id, folder_id FROM public.documents "
        "WHERE user_id = $1 AND content_hash = $2 ORDER BY created_at",
        UUID(uid), hashlib.sha256(raw).hexdigest(),
    )
    return [dict(r) for r in rows]


def _live(rows: list[dict]) -> list[dict]:
    return [r for r in rows if r["status"] != "failed"]


# ---------------------------------------------------------------------------------------------
# Sequential: the second mint while the first is pending (the /upload shape)
# ---------------------------------------------------------------------------------------------


async def test_same_bytes_while_pending_returns_the_inflight_copy(pg_pool, subject):
    uid, tok = subject["uid"], subject["tok"]
    raw, name = _raw("seq"), f"280-seq-{uuid4().hex[:6]}.txt"

    a = await async_mint_document_row(
        raw=raw, filename=name, mime_type=MIME, user_id=uid, supabase=user_client(tok),
    )
    assert a.is_duplicate is False
    b = await async_mint_document_row(
        raw=raw, filename=name, mime_type=MIME, user_id=uid, supabase=user_client(tok),
    )

    assert b.is_duplicate is True, "the second same-bytes mint was not reported as a duplicate"
    assert str(b.document["id"]) == str(a.document["id"])
    rows = _live(await _state(pg_pool, uid, raw))
    assert len(rows) == 1, f"expected one non-failed copy, got {rows}"
    assert rows[0]["is_latest"] is True, "the in-flight copy was retired"


async def test_same_bytes_into_another_folder_while_pending_is_the_same_copy(pg_pool, subject):
    """D-24: folder-agnostic in-flight leg. Under a folder-scoped check the second insert passes
    (dedup index is per folder), retires the first copy by filename, then fails at completion on
    the completed-hash index, which has no folder column."""
    uid, tok = subject["uid"], subject["tok"]
    raw, name = _raw("xfolder"), f"280-xf-{uuid4().hex[:6]}.txt"

    a = await async_mint_document_row(
        raw=raw, filename=name, mime_type=MIME, user_id=uid, supabase=user_client(tok),
        folder_id=subject["f1"],
    )
    b = await async_mint_document_row(
        raw=raw, filename=name, mime_type=MIME, user_id=uid, supabase=user_client(tok),
        folder_id=subject["f2"],
    )

    assert b.is_duplicate is True
    assert str(b.document["id"]) == str(a.document["id"])
    rows = _live(await _state(pg_pool, uid, raw))
    assert len(rows) == 1, f"expected one non-failed copy, got {rows}"
    assert rows[0]["is_latest"] is True, "the in-flight copy in the first folder was retired"


# ---------------------------------------------------------------------------------------------
# Concurrent: the double-click / two-tab race (SC#1)
# ---------------------------------------------------------------------------------------------


@pytest.mark.parametrize("round_no", range(5))
async def test_two_concurrent_same_bytes_mints_leave_exactly_one_copy(pg_pool, subject, round_no):
    uid, tok = subject["uid"], subject["tok"]
    raw, name = _raw(f"race-{round_no}"), f"280-race-{round_no}-{uuid4().hex[:6]}.txt"

    results = await asyncio.gather(
        async_mint_document_row(
            raw=raw, filename=name, mime_type=MIME, user_id=uid, supabase=user_client(tok),
        ),
        async_mint_document_row(
            raw=raw, filename=name, mime_type=MIME, user_id=uid, supabase=user_client(tok),
        ),
        return_exceptions=True,
    )
    errors = [r for r in results if isinstance(r, BaseException)]
    assert not errors, f"a concurrent same-bytes mint raised: {errors!r}"
    ids = {str(r.document["id"]) for r in results}
    assert len(ids) == 1, f"the two mints returned different documents: {ids}"
    rows = _live(await _state(pg_pool, uid, raw))
    assert len(rows) == 1, f"expected exactly one non-failed row, got {rows}"
    assert rows[0]["is_latest"] is True
    assert str(rows[0]["id"]) in ids


# ---------------------------------------------------------------------------------------------
# All 7 callers' parameter sets (D-04) — RESEARCH Pattern 1's caller matrix
# ---------------------------------------------------------------------------------------------

# (name, client, pass_org, on_conflict, version_scope, use_folder, sync)
CALLERS = [
    ("upload", "user", False, "raise", "user", False, False),
    ("watch_new", "service", True, "link", "user", True, False),
    ("watch_modified", "service", True, "link", "user", True, False),
    ("source_import", "user", True, "raise", "user", True, False),
    ("workspace_promote", "user", True, "link", "folder", True, False),
    ("expert_install", "service", True, "link", "folder", True, False),
    ("email_attachment", "service", True, "link", "user", False, True),
]


@pytest.mark.parametrize(
    "caller,client_kind,pass_org,on_conflict,version_scope,use_folder,sync",
    CALLERS,
    ids=[c[0] for c in CALLERS],
)
async def test_every_caller_gets_the_inflight_copy(
    pg_pool, subject, caller, client_kind, pass_org, on_conflict, version_scope, use_folder, sync,
):
    uid, tok = subject["uid"], subject["tok"]
    raw, name = _raw(caller), f"280-{caller}-{uuid4().hex[:6]}.txt"

    def client():
        return user_client(tok) if client_kind == "user" else _admin()

    kw = dict(
        raw=raw, filename=name, mime_type=MIME, user_id=uid,
        folder_id=subject["f1"] if use_folder else None,
        org_id=subject["org"] if pass_org else None,
        on_conflict=on_conflict, version_scope=version_scope,
    )

    async def mint():
        if sync:  # email_attachments calls the SYNC minter from a worker thread
            return await run_in_threadpool(lambda: mint_document_row(supabase=client(), **kw))
        return await async_mint_document_row(supabase=client(), **kw)

    first = await mint()
    assert first.is_duplicate is False
    second = await mint()

    assert second.is_duplicate is True, f"{caller}: second same-bytes mint was not a duplicate"
    assert str(second.document["id"]) == str(first.document["id"])
    rows = _live(await _state(pg_pool, uid, raw))
    assert len(rows) == 1, f"{caller}: expected one non-failed copy, got {rows}"
    assert rows[0]["is_latest"] is True, f"{caller}: the in-flight copy was retired"


# ---------------------------------------------------------------------------------------------
# Versioning still versions (D-03 / D-25)
# ---------------------------------------------------------------------------------------------


async def _latest_for(pool, uid: str, name: str) -> list[dict]:
    rows = await pool.fetch(
        "SELECT id, version_number, is_latest FROM public.documents "
        "WHERE user_id = $1 AND filename = $2 ORDER BY version_number, created_at",
        UUID(uid), name,
    )
    return [dict(r) for r in rows]


async def test_a_new_version_retires_the_old_one_after_inserting(pg_pool, subject):
    uid, tok = subject["uid"], subject["tok"]
    name = f"280-ver-{uuid4().hex[:6]}.txt"

    v1 = await async_mint_document_row(
        raw=_raw("v1"), filename=name, mime_type=MIME, user_id=uid, supabase=user_client(tok),
    )
    v2 = await async_mint_document_row(
        raw=_raw("v2"), filename=name, mime_type=MIME, user_id=uid, supabase=user_client(tok),
    )

    assert v2.is_duplicate is False
    assert v2.version_number == 2
    rows = {str(r["id"]): r for r in await _latest_for(pg_pool, uid, name)}
    assert rows[str(v1.document["id"])]["is_latest"] is False
    assert rows[str(v2.document["id"])]["is_latest"] is True
    assert sum(1 for r in rows.values() if r["is_latest"]) == 1


@pytest.mark.parametrize("round_no", range(3))
async def test_two_concurrent_new_versions_settle_to_exactly_one_latest(pg_pool, subject, round_no):
    """D-25 / T-280-14: two concurrent v2 mints must never retire each other — and (280-REVIEW
    WR-02) must not BOTH stay latest either. This test used to assert only "not zero", which the
    two-latest end state passed; the settle step makes the exact contract hold."""
    uid, tok = subject["uid"], subject["tok"]
    name = f"280-v2race-{round_no}-{uuid4().hex[:6]}.txt"

    v1 = await async_mint_document_row(
        raw=_raw("v1"), filename=name, mime_type=MIME, user_id=uid, supabase=user_client(tok),
    )
    results = await asyncio.gather(
        async_mint_document_row(
            raw=_raw("v2a"), filename=name, mime_type=MIME, user_id=uid, supabase=user_client(tok),
        ),
        async_mint_document_row(
            raw=_raw("v2b"), filename=name, mime_type=MIME, user_id=uid, supabase=user_client(tok),
        ),
        return_exceptions=True,
    )
    assert not [r for r in results if isinstance(r, BaseException)], results
    rows = await _latest_for(pg_pool, uid, name)
    latest = [r for r in rows if r["is_latest"]]
    assert latest, f"two concurrent new versions left ZERO latest rows: {rows}"
    assert len(latest) == 1, f"two concurrent new versions left {len(latest)} latest rows: {rows}"
    assert next(r for r in rows if str(r["id"]) == str(v1.document["id"]))["is_latest"] is False


@pytest.mark.parametrize("round_no", range(3))
async def test_two_concurrent_first_uploads_of_one_name_settle_to_exactly_one_latest(pg_pool, subject, round_no):
    """280-REVIEW WR-02: the same race with no prior version — both mints read no versions and both
    insert v1. Before the settle step no retire ran on that path at all."""
    uid, tok = subject["uid"], subject["tok"]
    name = f"280-v1race-{round_no}-{uuid4().hex[:6]}.txt"

    results = await asyncio.gather(
        async_mint_document_row(
            raw=_raw("v1a"), filename=name, mime_type=MIME, user_id=uid, supabase=user_client(tok),
        ),
        async_mint_document_row(
            raw=_raw("v1b"), filename=name, mime_type=MIME, user_id=uid, supabase=user_client(tok),
        ),
        return_exceptions=True,
    )
    assert not [r for r in results if isinstance(r, BaseException)], results
    rows = await _latest_for(pg_pool, uid, name)
    assert len(rows) == 2, rows
    assert len([r for r in rows if r["is_latest"]]) == 1, f"expected exactly one latest row: {rows}"
