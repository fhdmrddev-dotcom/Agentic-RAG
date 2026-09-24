"""Phase 266-01 — D-266-09: a first-party Expert's folders come from the CALLER ORG's install.

For an ``is_system`` bundle, ``resolve_expert_bundle`` takes its knowledge folders ONLY from
``experts_db.get_expert_install(pool, org_id=<caller org>, bundle_id=<bundle>)``. No install →
no folders; the bundle's global ``knowledge_folder_ids`` is IGNORED for a system bundle, which
is what retires SEED-304's shape (a global id every org was approved for and none could read).

Install-sourced ids still run through the existing strict caller-org loop (defence in depth,
T-266-04), and org-authored bundles are evaluated exactly as before (D-266-11).

``get_expert_install`` is patched with ``create=True`` so that, against the pre-266 tree, the
cases fail on BEHAVIOUR (the old source / the old bypass) rather than on a missing attribute.
"""

from __future__ import annotations

import logging
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest

from app.services import expert_service
from app.services.expert_service import resolve_expert_bundle

SEED_USER = UUID("00000000-0000-0000-0000-000000000001")
RETIRED_SEED_FOLDER = UUID("00000000-0000-0000-0000-000000000260")


def _bundle(bundle_id: UUID, *, is_system: bool, org_id: UUID | None,
            created_by: UUID | None, folder_ids: list[UUID]) -> dict:
    return {
        "id": bundle_id,
        "name": "Financial Analyzer" if is_system else "Org Expert",
        "slug": "financial-analyzer" if is_system else "org-expert",
        "description": "",
        "scope_mode": "restricted",
        "is_system": is_system,
        "org_id": org_id,
        "visibility": "org",
        "created_by": created_by,
        "member_skills": [],
        "knowledge_folder_ids": folder_ids,
        "required_connections": [],
        "prompt_suggestions": [],
    }


def _pool(bundle_row: dict, folder_rows: list[dict] | None = None) -> MagicMock:
    pool = MagicMock()
    pool.fetchrow = AsyncMock(return_value=bundle_row)
    pool.fetch = AsyncMock(side_effect=[folder_rows] if folder_rows is not None else [])
    return pool


def _folder_query_awaited(pool: MagicMock) -> bool:
    return any("FROM public.folders" in c.args[0] for c in pool.fetch.await_args_list)


@pytest.mark.asyncio
async def test_a_system_bundle_takes_its_folder_from_the_callers_install():
    caller_org, caller_user, other_user = uuid4(), uuid4(), uuid4()
    bundle_id, installed_folder = uuid4(), uuid4()
    pool = _pool(
        _bundle(bundle_id, is_system=True, org_id=None, created_by=None, folder_ids=[]),
        [{"id": installed_folder, "org_id": caller_org, "user_id": other_user, "is_org_shared": True}],
    )
    get_install = AsyncMock(return_value={"folder_id": installed_folder, "folder_exists": True})

    with patch.object(expert_service.experts_db, "get_expert_install", get_install, create=True):
        resolved = await resolve_expert_bundle(pool, bundle_id, caller_org, caller_user)

    assert resolved is not None
    assert resolved.effective_folder_ids == [installed_folder]
    get_install.assert_awaited_once()
    assert get_install.await_args.kwargs == {"org_id": caller_org, "bundle_id": bundle_id}


@pytest.mark.asyncio
async def test_b_system_bundle_with_no_install_has_no_folders_and_reads_none():
    caller_org, caller_user, bundle_id = uuid4(), uuid4(), uuid4()
    pool = _pool(_bundle(bundle_id, is_system=True, org_id=None, created_by=None, folder_ids=[]))
    get_install = AsyncMock(return_value=None)

    with patch.object(expert_service.experts_db, "get_expert_install", get_install, create=True):
        resolved = await resolve_expert_bundle(pool, bundle_id, caller_org, caller_user)

    assert resolved is not None
    assert resolved.effective_folder_ids == []
    get_install.assert_awaited_once()
    assert not _folder_query_awaited(pool)


@pytest.mark.asyncio
async def test_c_pre_195_global_folder_id_is_ignored_for_a_system_bundle(caplog):
    """RED on base: the bundle still names 188's …0260 (pre-195 DB state) and the old bypass
    admitted a seed-user shared folder in a foreign org. Now the global id is not even read."""
    caller_org, seed_org, caller_user, bundle_id = uuid4(), uuid4(), uuid4(), uuid4()
    pool = _pool(
        _bundle(bundle_id, is_system=True, org_id=None, created_by=None,
                folder_ids=[RETIRED_SEED_FOLDER]),
        [{"id": RETIRED_SEED_FOLDER, "org_id": seed_org, "user_id": SEED_USER, "is_org_shared": True}],
    )
    get_install = AsyncMock(return_value=None)

    with patch.object(expert_service.experts_db, "get_expert_install", get_install, create=True):
        resolved = await resolve_expert_bundle(pool, bundle_id, caller_org, caller_user)

    assert resolved is not None
    assert resolved.effective_folder_ids == []
    assert RETIRED_SEED_FOLDER not in resolved.effective_folder_ids


@pytest.mark.asyncio
async def test_d_install_sourced_folder_in_another_org_is_still_stripped(caplog):
    """Defence in depth (T-266-04): an install row can only name the caller org's folder, but
    if one ever pointed elsewhere the strict loop still refuses it and logs the strip."""
    caller_org, other_org, caller_user, bundle_id, foreign = uuid4(), uuid4(), uuid4(), uuid4(), uuid4()
    pool = _pool(
        _bundle(bundle_id, is_system=True, org_id=None, created_by=None, folder_ids=[]),
        [{"id": foreign, "org_id": other_org, "user_id": SEED_USER, "is_org_shared": True}],
    )
    get_install = AsyncMock(return_value={"folder_id": foreign, "folder_exists": True})

    with caplog.at_level(logging.WARNING):
        with patch.object(expert_service.experts_db, "get_expert_install", get_install, create=True):
            resolved = await resolve_expert_bundle(pool, bundle_id, caller_org, caller_user)

    assert resolved is not None
    assert resolved.effective_folder_ids == []
    assert resolved.stripped_details == [f"folder:{foreign}"]
    assert "EXPERT_MEMBER_CROSS_ORG_STRIPPED" in caplog.text


@pytest.mark.asyncio
async def test_e_org_authored_bundle_is_unchanged_and_never_reads_installs():
    org_a, user_a, bundle_id, folder_a = uuid4(), uuid4(), uuid4(), uuid4()
    pool = _pool(
        _bundle(bundle_id, is_system=False, org_id=org_a, created_by=user_a, folder_ids=[folder_a]),
        [{"id": folder_a, "org_id": org_a, "user_id": user_a, "is_org_shared": False}],
    )
    get_install = AsyncMock(return_value={"folder_id": uuid4(), "folder_exists": True})

    with patch.object(expert_service.experts_db, "get_expert_install", get_install, create=True):
        resolved = await resolve_expert_bundle(pool, bundle_id, org_a, user_a)

    assert resolved is not None
    assert resolved.effective_folder_ids == [folder_a]
    get_install.assert_not_awaited()
    folder_call = next(c for c in pool.fetch.await_args_list if "FROM public.folders" in c.args[0])
    assert folder_call.args[1] == [folder_a]


@pytest.mark.asyncio
async def test_f_no_caller_org_means_no_install_read_and_no_folders():
    caller_user, bundle_id = uuid4(), uuid4()
    pool = _pool(_bundle(bundle_id, is_system=True, org_id=None, created_by=None,
                         folder_ids=[RETIRED_SEED_FOLDER]))
    get_install = AsyncMock(return_value={"folder_id": uuid4(), "folder_exists": True})

    with patch.object(expert_service.experts_db, "get_expert_install", get_install, create=True):
        resolved = await resolve_expert_bundle(pool, bundle_id, None, caller_user)

    assert resolved is not None
    assert resolved.effective_folder_ids == []
    get_install.assert_not_awaited()
    assert not _folder_query_awaited(pool)
