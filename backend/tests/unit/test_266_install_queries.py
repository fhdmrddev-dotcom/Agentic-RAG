"""Phase 266-01 — the six ``expert_installs`` queries in ``app/db/experts.py`` (PACK-18/19).

The backend pool BYPASSES RLS, so each statement's ``org_id`` predicate IS the tenancy
boundary. These tests pin, for every function: the org predicate is present, the org id is
BOUND (never interpolated into the SQL text), and the bind order matches the numbered
placeholders. They assert SQL text and binds against an AsyncMock pool — the applied
behaviour against a real database is 266-03/266-04's business.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from app.db import experts as experts_db


def _pool(*, fetchrow=None, fetch=None) -> MagicMock:
    pool = MagicMock()
    pool.fetchrow = AsyncMock(return_value=fetchrow)
    pool.fetch = AsyncMock(return_value=fetch if fetch is not None else [])
    return pool


def _sql_and_binds(mock: AsyncMock) -> tuple[str, tuple]:
    assert mock.await_count == 1, mock.await_args_list
    call = mock.await_args
    return call.args[0], tuple(call.args[1:])


def _no_interpolation(sql: str, *values) -> None:
    for v in values:
        assert str(v) not in sql, f"{v!r} interpolated into SQL text"


@pytest.mark.asyncio
async def test_get_expert_install_binds_org_then_bundle_and_left_joins_folder():
    org_id, bundle_id, folder_id = uuid4(), uuid4(), uuid4()
    pool = _pool(fetchrow={"org_id": org_id, "expert_bundle_id": bundle_id,
                           "folder_id": folder_id, "folder_exists": True})

    row = await experts_db.get_expert_install(pool, org_id=org_id, bundle_id=bundle_id)

    sql, binds = _sql_and_binds(pool.fetchrow)
    assert "FROM public.expert_installs" in sql
    assert "LEFT JOIN public.folders" in sql
    assert "f.org_id = i.org_id" in sql, "the folder must be proved in the SAME org"
    assert "(f.id IS NOT NULL) AS folder_exists" in sql
    assert "i.org_id = $1" in sql and "i.expert_bundle_id = $2" in sql
    assert binds == (org_id, bundle_id)
    _no_interpolation(sql, org_id, bundle_id)
    assert row is not None and row["folder_exists"] is True


@pytest.mark.asyncio
async def test_get_expert_install_returns_none_when_absent():
    pool = _pool(fetchrow=None)
    assert await experts_db.get_expert_install(pool, org_id=uuid4(), bundle_id=uuid4()) is None


@pytest.mark.asyncio
async def test_list_expert_installs_for_org_binds_org_only_and_joins_bundle_name():
    org_id = uuid4()
    pool = _pool(fetch=[{"expert_bundle_id": uuid4(), "expert_name": "Financial Analyzer",
                         "expert_slug": "financial-analyzer", "folder_exists": False}])

    rows = await experts_db.list_expert_installs_for_org(pool, org_id=org_id)

    sql, binds = _sql_and_binds(pool.fetch)
    assert "i.org_id = $1" in sql
    assert "JOIN public.expert_bundles b ON b.id = i.expert_bundle_id" in sql
    assert "b.name AS expert_name" in sql and "b.slug AS expert_slug" in sql
    assert "(f.id IS NOT NULL) AS folder_exists" in sql
    assert binds == (org_id,)
    _no_interpolation(sql, org_id)
    assert isinstance(rows, list) and rows[0]["expert_slug"] == "financial-analyzer"


@pytest.mark.asyncio
async def test_claim_expert_install_is_a_guarded_upsert_that_keeps_installed_by():
    org_id, bundle_id, user_id = uuid4(), uuid4(), uuid4()
    pool = _pool(fetchrow={"org_id": org_id, "status": "installing"})

    row = await experts_db.claim_expert_install(
        pool, org_id=org_id, bundle_id=bundle_id, installed_by=user_id, corpus_version="abc123",
    )

    sql, binds = _sql_and_binds(pool.fetchrow)
    assert "INSERT INTO public.expert_installs" in sql
    assert "'installing'" in sql
    assert "ON CONFLICT (org_id, expert_bundle_id) DO UPDATE" in sql
    assert "WHERE public.expert_installs.status <> 'installing'" in sql
    assert "interval '10 minutes'" in sql, "the stale-claim recovery arm is missing"
    do_update = sql.split("DO UPDATE", 1)[1]
    assert "installed_by" not in do_update, "a re-claim must NOT overwrite installed_by"
    assert "RETURNING *" in sql
    assert binds == (org_id, bundle_id, user_id, "abc123")
    _no_interpolation(sql, org_id, bundle_id, user_id)
    assert row == {"org_id": org_id, "status": "installing"}


@pytest.mark.asyncio
async def test_claim_expert_install_returns_none_when_claim_is_lost():
    pool = _pool(fetchrow=None)
    row = await experts_db.claim_expert_install(
        pool, org_id=uuid4(), bundle_id=uuid4(), installed_by=uuid4(), corpus_version="v",
    )
    assert row is None, "a lost claim is NOT an error — it is None"


@pytest.mark.asyncio
async def test_set_expert_install_folder_binds_org_bundle_folder_user():
    org_id, bundle_id, folder_id, user_id = uuid4(), uuid4(), uuid4(), uuid4()
    pool = _pool(fetchrow={"folder_id": folder_id})

    row = await experts_db.set_expert_install_folder(
        pool, org_id=org_id, bundle_id=bundle_id, folder_id=folder_id, installed_by=user_id,
    )

    sql, binds = _sql_and_binds(pool.fetchrow)
    assert "UPDATE public.expert_installs" in sql
    assert "folder_id = $3" in sql and "installed_by = $4" in sql
    assert "org_id = $1" in sql and "expert_bundle_id = $2" in sql
    assert "RETURNING *" in sql
    assert binds == (org_id, bundle_id, folder_id, user_id)
    _no_interpolation(sql, org_id, bundle_id, folder_id, user_id)
    assert row == {"folder_id": folder_id}


@pytest.mark.asyncio
async def test_set_expert_install_status_binds_org_bundle_status_error():
    org_id, bundle_id = uuid4(), uuid4()
    pool = _pool(fetchrow={"status": "failed", "error": "boom"})

    row = await experts_db.set_expert_install_status(
        pool, org_id=org_id, bundle_id=bundle_id, status="failed", error="boom",
    )

    sql, binds = _sql_and_binds(pool.fetchrow)
    assert "UPDATE public.expert_installs" in sql
    assert "status = $3" in sql and "error = $4" in sql
    assert "org_id = $1" in sql and "expert_bundle_id = $2" in sql
    assert binds == (org_id, bundle_id, "failed", "boom")
    _no_interpolation(sql, org_id, bundle_id)
    assert row == {"status": "failed", "error": "boom"}


@pytest.mark.asyncio
async def test_set_expert_install_status_returns_none_when_no_row():
    pool = _pool(fetchrow=None)
    assert await experts_db.set_expert_install_status(
        pool, org_id=uuid4(), bundle_id=uuid4(), status="installed", error=None,
    ) is None


@pytest.mark.asyncio
async def test_list_install_corpus_documents_is_org_folder_latest_and_filename_scoped():
    org_id, folder_id = uuid4(), uuid4()
    pool = _pool(fetch=[{"id": uuid4(), "filename": "a.md", "status": "completed"}])

    rows = await experts_db.list_install_corpus_documents(
        pool, org_id=org_id, folder_ids=[folder_id], filenames=["a.md"],
    )

    sql, binds = _sql_and_binds(pool.fetch)
    assert "FROM public.documents" in sql
    assert "org_id = $1" in sql
    assert "folder_id = ANY($2::uuid[])" in sql
    assert "is_latest = true" in sql
    assert "filename = ANY($3::text[])" in sql
    for col in ("id", "folder_id", "filename", "status", "chunk_count", "error_message",
                "user_id", "file_path", "mime_type"):
        assert col in sql, col
    assert binds == (org_id, [folder_id], ["a.md"])
    _no_interpolation(sql, org_id, folder_id)
    assert rows[0]["filename"] == "a.md"
