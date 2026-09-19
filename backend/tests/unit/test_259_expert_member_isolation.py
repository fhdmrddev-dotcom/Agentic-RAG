from __future__ import annotations

import logging
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID, uuid4

import pytest

from app.models.expert import ExpertBundleCreate, ExpertBundleUpdate
from app.services.expert_service import (
    ResolvedExpertBundle,
    create_expert_service,
    delete_expert_service,
    get_expert_service,
    list_experts_service,
    resolve_expert_bundle,
    update_expert_service,
)


@pytest.mark.asyncio
async def test_resolve_legitimate_bundle_all_members_admitted():
    """Org A user resolves a bundle whose skills, folders, and connections belong to Org A or system."""
    mock_pool = MagicMock()
    org_a = uuid4()
    user_a = uuid4()
    bundle_id = uuid4()
    folder_a = uuid4()

    bundle_row = {
        "id": bundle_id,
        "name": "Legit Expert",
        "slug": "legit-expert",
        "description": "Legitimate org bundle",
        "scope_mode": "restricted",
        "is_system": False,
        "org_id": org_a,
        "member_skills": ["system_calc", "org_a_tool"],
        "knowledge_folder_ids": [folder_a],
        "required_connections": ["slack"],
        "prompt_suggestions": [{"title": "Hi", "prompt": "Hello"}],
    }

    # 1. Fetch bundle
    # 2. Fetch skills
    # 3. Fetch folders
    # 4. Fetch connections
    mock_pool.fetchrow = AsyncMock(return_value=bundle_row)

    mock_pool.fetch = AsyncMock(
        side_effect=[
            # skill_rows: system_calc is system, org_a_tool belongs to org_a
            [
                {"name": "system_calc", "is_system": True, "org_id": None, "user_id": None, "is_org_shared": True, "is_enabled": True},
                {"name": "org_a_tool", "is_system": False, "org_id": org_a, "user_id": user_a, "is_org_shared": False, "is_enabled": True},
            ],
            # folder_rows: folder_a belongs to org_a and caller user_a
            [
                {"id": folder_a, "org_id": org_a, "user_id": user_a, "is_org_shared": False},
            ],
            # conn_rows: slack active in org_a
            [
                {"service_id": "slack", "capability": "post_message"},
            ],
        ]
    )

    resolved = await resolve_expert_bundle(mock_pool, bundle_id, org_a, user_a)
    assert resolved is not None
    assert resolved.name == "Legit Expert"
    assert resolved.effective_skills == ["system_calc", "org_a_tool"]
    assert resolved.effective_folder_ids == [folder_a]
    assert resolved.effective_connections == ["slack"]
    assert resolved.stripped_members_count == 0
    assert resolved.stripped_details == []


@pytest.mark.asyncio
async def test_resolve_strips_foreign_skill_seed_125(caplog):
    """PACK-04 / SEED-125: Bundle references a skill belonging to Org B.

    Must be stripped from effective_skills with an EXPERT_MEMBER_CROSS_ORG_STRIPPED warning.
    """
    mock_pool = MagicMock()
    org_a = uuid4()
    org_b = uuid4()
    user_a = uuid4()
    bundle_id = uuid4()

    bundle_row = {
        "id": bundle_id,
        "name": "Infiltrator Expert",
        "slug": "infiltrator-expert",
        "description": "Bundle attempting cross-org skill leak",
        "scope_mode": "restricted",
        "is_system": False,
        "org_id": org_a,
        "member_skills": ["org_b_secret_skill", "org_a_safe_skill"],
        "knowledge_folder_ids": [],
        "required_connections": [],
        "prompt_suggestions": [],
    }

    mock_pool.fetchrow = AsyncMock(return_value=bundle_row)

    mock_pool.fetch = AsyncMock(
        side_effect=[
            # skill_rows: org_b_secret_skill belongs to Org B (foreign!), org_a_safe_skill belongs to Org A
            [
                {"name": "org_b_secret_skill", "is_system": False, "org_id": org_b, "user_id": uuid4(), "is_org_shared": True, "is_enabled": True},
                {"name": "org_a_safe_skill", "is_system": False, "org_id": org_a, "user_id": user_a, "is_org_shared": True, "is_enabled": True},
            ],
        ]
    )

    with caplog.at_level(logging.WARNING):
        resolved = await resolve_expert_bundle(mock_pool, bundle_id, org_a, user_a)

    assert resolved is not None
    # Crucial assertion: Org B skill stripped!
    assert resolved.effective_skills == ["org_a_safe_skill"]
    assert "org_b_secret_skill" not in resolved.effective_skills
    assert resolved.stripped_members_count == 1
    assert "skill:org_b_secret_skill" in resolved.stripped_details
    assert "EXPERT_MEMBER_CROSS_ORG_STRIPPED" in caplog.text


@pytest.mark.asyncio
async def test_resolve_strips_foreign_knowledge_folder(caplog):
    """PACK-04: Bundle references a folder belonging to Org B.

    Must be stripped from effective_folder_ids with an audit warning.
    """
    mock_pool = MagicMock()
    org_a = uuid4()
    org_b = uuid4()
    user_a = uuid4()
    bundle_id = uuid4()
    folder_a = uuid4()
    folder_b = uuid4()

    bundle_row = {
        "id": bundle_id,
        "name": "Folder Leak Expert",
        "slug": "folder-leak",
        "description": "Bundle attempting cross-org folder leak",
        "scope_mode": "restricted",
        "is_system": False,
        "org_id": org_a,
        "member_skills": [],
        "knowledge_folder_ids": [folder_a, folder_b],
        "required_connections": [],
        "prompt_suggestions": [],
    }

    mock_pool.fetchrow = AsyncMock(return_value=bundle_row)

    mock_pool.fetch = AsyncMock(
        side_effect=[
            # folder_rows: folder_a is org_a (caller user_a), folder_b is org_b
            [
                {"id": folder_a, "org_id": org_a, "user_id": user_a, "is_org_shared": False},
                {"id": folder_b, "org_id": org_b, "user_id": user_a, "is_org_shared": True},
            ],
        ]
    )

    with caplog.at_level(logging.WARNING):
        resolved = await resolve_expert_bundle(mock_pool, bundle_id, org_a, user_a)

    assert resolved is not None
    # Crucial assertion: Org B folder stripped!
    assert resolved.effective_folder_ids == [folder_a]
    assert folder_b not in resolved.effective_folder_ids
    assert resolved.stripped_members_count == 1
    assert f"folder:{folder_b}" in resolved.stripped_details
    assert "EXPERT_MEMBER_CROSS_ORG_STRIPPED" in caplog.text


@pytest.mark.asyncio
async def test_resolve_strips_unconfigured_connection(caplog):
    """PACK-04: Bundle requires a connection that is not active in Org A."""
    mock_pool = MagicMock()
    org_a = uuid4()
    user_a = uuid4()
    bundle_id = uuid4()

    bundle_row = {
        "id": bundle_id,
        "name": "Conn Expert",
        "slug": "conn-expert",
        "description": "Requires salesforce and slack",
        "scope_mode": "restricted",
        "is_system": False,
        "org_id": org_a,
        "member_skills": [],
        "knowledge_folder_ids": [],
        "required_connections": ["salesforce", "slack"],
        "prompt_suggestions": [],
    }

    mock_pool.fetchrow = AsyncMock(return_value=bundle_row)

    mock_pool.fetch = AsyncMock(
        side_effect=[
            # Only slack is active in Org A
            [
                {"service_id": "slack", "capability": "post_message"},
            ],
        ]
    )

    with caplog.at_level(logging.WARNING):
        resolved = await resolve_expert_bundle(mock_pool, bundle_id, org_a, user_a)

    assert resolved is not None
    assert resolved.effective_connections == ["slack"]
    assert "salesforce" not in resolved.effective_connections
    assert resolved.stripped_members_count == 1
    assert "connection:salesforce" in resolved.stripped_details


@pytest.mark.asyncio
async def test_resolve_returns_none_if_bundle_not_accessible():
    """Phase 1 check: returns None if bundle does not exist or belongs to foreign org."""
    mock_pool = MagicMock()
    mock_pool.fetchrow = AsyncMock(return_value=None)

    resolved = await resolve_expert_bundle(mock_pool, uuid4(), uuid4(), uuid4())
    assert resolved is None


@pytest.mark.asyncio
async def test_crud_service_wrappers():
    """Verify CRUD service functions dispatch to db layer properly."""
    mock_pool = MagicMock()
    org_id = uuid4()
    user_id = uuid4()
    bundle_id = uuid4()

    # Create
    create_payload = ExpertBundleCreate(
        name="New Expert",
        slug="new-expert",
        description="Desc",
    )
    mock_pool.fetchrow = AsyncMock(
        return_value={
            "id": bundle_id,
            "org_id": org_id,
            "name": "New Expert",
            "slug": "new-expert",
            "prompt_suggestions": [],
        }
    )
    created = await create_expert_service(mock_pool, org_id, user_id, create_payload)
    assert created["id"] == bundle_id

    # Get
    mock_pool.fetchrow = AsyncMock(
        return_value={"id": bundle_id, "name": "New Expert", "prompt_suggestions": []}
    )
    fetched = await get_expert_service(mock_pool, bundle_id, org_id)
    assert fetched is not None
    assert fetched["name"] == "New Expert"

    # List
    mock_pool.fetch = AsyncMock(
        return_value=[{"id": bundle_id, "name": "New Expert", "prompt_suggestions": []}]
    )
    listed = await list_experts_service(mock_pool, org_id)
    assert len(listed) == 1

    # Update
    mock_pool.fetchrow = AsyncMock(
        side_effect=[
            {"id": bundle_id, "org_id": org_id, "is_system": False, "prompt_suggestions": []},
            {"id": bundle_id, "org_id": org_id, "is_system": False, "name": "Updated Name", "prompt_suggestions": []},
        ]
    )
    updated = await update_expert_service(
        mock_pool, bundle_id, org_id, ExpertBundleUpdate(name="Updated Name")
    )
    assert updated is not None
    assert updated["name"] == "Updated Name"

    # Delete
    mock_pool.fetchrow = AsyncMock(
        return_value={"id": bundle_id, "org_id": org_id, "is_system": False, "prompt_suggestions": []}
    )
    mock_pool.execute = AsyncMock(return_value="DELETE 1")
    deleted = await delete_expert_service(mock_pool, bundle_id, org_id)
    assert deleted is True


@pytest.mark.asyncio
async def test_resolve_strips_unshared_same_org_foreign_user_folder(caplog):
    """F-1: In same org, another user's private unshared folder must be stripped.

    Verifies:
      - caller-owned private folder: admitted
      - other user's org-shared folder: admitted
      - other user's private unshared folder: stripped with EXPERT_MEMBER_CROSS_ORG_STRIPPED
      - cross-org folder: stripped
    """
    mock_pool = MagicMock()
    org_a = uuid4()
    org_b = uuid4()
    user_a = uuid4()
    user_b = uuid4()
    bundle_id = uuid4()

    folder_owned = uuid4()
    folder_shared = uuid4()
    folder_private = uuid4()
    folder_cross_org = uuid4()

    bundle_row = {
        "id": bundle_id,
        "name": "Folder Test Expert",
        "slug": "folder-test-expert",
        "description": "Bundle testing folder tenancy boundaries",
        "scope_mode": "restricted",
        "is_system": False,
        "org_id": org_a,
        "member_skills": [],
        "knowledge_folder_ids": [folder_owned, folder_shared, folder_private, folder_cross_org],
        "required_connections": [],
        "prompt_suggestions": [],
    }

    mock_pool.fetchrow = AsyncMock(return_value=bundle_row)
    mock_pool.fetch = AsyncMock(
        side_effect=[
            # folder_rows
            [
                {"id": folder_owned, "org_id": org_a, "user_id": user_a, "is_org_shared": False},
                {"id": folder_shared, "org_id": org_a, "user_id": user_b, "is_org_shared": True},
                {"id": folder_private, "org_id": org_a, "user_id": user_b, "is_org_shared": False},
                {"id": folder_cross_org, "org_id": org_b, "user_id": user_b, "is_org_shared": True},
            ],
        ]
    )

    with caplog.at_level(logging.WARNING):
        resolved = await resolve_expert_bundle(mock_pool, bundle_id, org_a, user_a)

    assert resolved is not None
    assert resolved.effective_folder_ids == [folder_owned, folder_shared]
    assert resolved.stripped_members_count == 2
    assert f"folder:{folder_private}" in resolved.stripped_details
    assert f"folder:{folder_cross_org}" in resolved.stripped_details
    assert any("EXPERT_MEMBER_CROSS_ORG_STRIPPED" in record.message for record in caplog.records)
