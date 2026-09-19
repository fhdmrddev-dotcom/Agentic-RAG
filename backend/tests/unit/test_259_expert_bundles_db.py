from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID, uuid4

import asyncpg
import pytest
from pydantic import ValidationError

from app.db.experts import (
    create_expert_bundle,
    delete_expert_bundle,
    get_expert_bundle_by_id,
    get_expert_bundle_by_slug,
    list_expert_bundles,
    update_expert_bundle,
)
from app.models.expert import (
    ExpertBundle,
    ExpertBundleCreate,
    ExpertBundleUpdate,
    PromptSuggestion,
)


# --- 1. Pydantic Model Tests ---

def test_pydantic_prompt_suggestion_validation():
    suggestion = PromptSuggestion(title="Test Title", prompt="Test prompt text")
    assert suggestion.title == "Test Title"
    assert suggestion.prompt == "Test prompt text"

    with pytest.raises(ValidationError):
        PromptSuggestion(title="Missing prompt")  # type: ignore[call-arg]


def test_pydantic_expert_bundle_create_validation():
    bundle_data = {
        "name": "Finance Pro",
        "slug": "finance-pro",
        "description": "Financial domain expert",
        "scope_mode": "restricted",
        "member_skills": ["summarize_10k", "ebitda_calc"],
        "required_connections": ["sec_edgar"],
        "knowledge_folder_ids": [uuid4()],
        "prompt_suggestions": [{"title": "Risks", "prompt": "Extract risks"}],
        "visibility": "org",
        "is_enabled": True,
    }
    create_model = ExpertBundleCreate(**bundle_data)
    assert create_model.name == "Finance Pro"
    assert create_model.scope_mode == "restricted"
    assert create_model.visibility == "org"

    # Invalid scope_mode
    invalid_data = dict(bundle_data, scope_mode="unlimited")
    with pytest.raises(ValidationError):
        ExpertBundleCreate(**invalid_data)

    # Invalid visibility
    invalid_vis = dict(bundle_data, visibility="global")
    with pytest.raises(ValidationError):
        ExpertBundleCreate(**invalid_vis)


# --- 2. Database Access Layer Unit Tests (Mocked asyncpg Pool) ---

@pytest.mark.asyncio
async def test_create_expert_bundle():
    mock_pool = MagicMock()
    org_id = uuid4()
    created_by = uuid4()
    bundle_id = uuid4()

    db_row = {
        "id": bundle_id,
        "org_id": org_id,
        "created_by": created_by,
        "name": "Custom Expert",
        "slug": "custom-expert",
        "description": "A custom bundle",
        "scope_mode": "restricted",
        "member_skills": ["skill_a"],
        "required_connections": [],
        "knowledge_folder_ids": [],
        "prompt_suggestions": '[{"title": "Ask", "prompt": "Help"}]',
        "visibility": "private",
        "is_system": False,
        "is_enabled": True,
    }
    mock_pool.fetchrow = AsyncMock(return_value=db_row)

    result = await create_expert_bundle(
        pool=mock_pool,
        org_id=org_id,
        created_by=created_by,
        name="Custom Expert",
        slug="custom-expert",
        description="A custom bundle",
        scope_mode="restricted",
        member_skills=["skill_a"],
        prompt_suggestions=[{"title": "Ask", "prompt": "Help"}],
    )

    assert result["id"] == bundle_id
    assert result["name"] == "Custom Expert"
    assert result["is_system"] is False
    assert result["prompt_suggestions"] == [{"title": "Ask", "prompt": "Help"}]
    mock_pool.fetchrow.assert_awaited_once()


@pytest.mark.asyncio
async def test_get_expert_bundle_by_id():
    mock_pool = MagicMock()
    bundle_id = uuid4()
    caller_org_id = uuid4()

    # Case A: Bundle found
    db_row = {
        "id": bundle_id,
        "org_id": caller_org_id,
        "created_by": uuid4(),
        "name": "My Expert",
        "slug": "my-expert",
        "scope_mode": "biased",
        "prompt_suggestions": [],
        "is_system": False,
    }
    mock_pool.fetchrow = AsyncMock(return_value=db_row)

    res = await get_expert_bundle_by_id(mock_pool, bundle_id, caller_org_id)
    assert res is not None
    assert res["id"] == bundle_id
    assert res["scope_mode"] == "biased"

    # Case B: Bundle not found or cross-org refused by DB query
    mock_pool.fetchrow = AsyncMock(return_value=None)
    res_none = await get_expert_bundle_by_id(mock_pool, bundle_id, uuid4())
    assert res_none is None


@pytest.mark.asyncio
async def test_get_expert_bundle_by_slug():
    mock_pool = MagicMock()
    caller_org_id = uuid4()

    db_row = {
        "id": uuid4(),
        "org_id": None,
        "created_by": uuid4(),
        "name": "Financial Analyzer",
        "slug": "financial-analyzer",
        "is_system": True,
        "prompt_suggestions": [],
    }
    mock_pool.fetchrow = AsyncMock(return_value=db_row)

    res = await get_expert_bundle_by_slug(mock_pool, "financial-analyzer", caller_org_id)
    assert res is not None
    assert res["slug"] == "financial-analyzer"
    assert res["is_system"] is True


@pytest.mark.asyncio
async def test_list_expert_bundles():
    mock_pool = MagicMock()
    caller_org_id = uuid4()

    system_bundle = {
        "id": uuid4(),
        "name": "System Template",
        "slug": "system-template",
        "is_system": True,
        "prompt_suggestions": [],
    }
    org_bundle = {
        "id": uuid4(),
        "name": "Org Expert",
        "slug": "org-expert",
        "is_system": False,
        "prompt_suggestions": [],
    }
    mock_pool.fetch = AsyncMock(return_value=[system_bundle, org_bundle])

    res = await list_expert_bundles(mock_pool, caller_org_id, include_system=True)
    assert len(res) == 2
    assert res[0]["name"] == "System Template"
    assert res[1]["name"] == "Org Expert"


@pytest.mark.asyncio
async def test_update_expert_bundle_tenant_success():
    mock_pool = MagicMock()
    bundle_id = uuid4()
    caller_org_id = uuid4()

    # Step 1: get_expert_bundle_by_id returns existing tenant bundle
    existing = {
        "id": bundle_id,
        "org_id": caller_org_id,
        "is_system": False,
        "name": "Old Name",
        "prompt_suggestions": [],
    }
    updated = {
        "id": bundle_id,
        "org_id": caller_org_id,
        "is_system": False,
        "name": "New Name",
        "description": "Updated desc",
        "prompt_suggestions": [],
    }
    mock_pool.fetchrow = AsyncMock(side_effect=[existing, updated])

    res = await update_expert_bundle(
        mock_pool,
        bundle_id,
        caller_org_id,
        name="New Name",
        description="Updated desc",
    )
    assert res is not None
    assert res["name"] == "New Name"
    assert res["description"] == "Updated desc"


@pytest.mark.asyncio
async def test_update_expert_bundle_refuses_system_bundle():
    mock_pool = MagicMock()
    bundle_id = uuid4()
    caller_org_id = uuid4()

    # Existing bundle is a system template
    system_bundle = {
        "id": bundle_id,
        "org_id": None,
        "is_system": True,
        "name": "Financial Analyzer",
        "prompt_suggestions": [],
    }
    mock_pool.fetchrow = AsyncMock(return_value=system_bundle)

    res = await update_expert_bundle(
        mock_pool,
        bundle_id,
        caller_org_id,
        name="Hacked System Template",
    )
    assert res is None  # Refused


@pytest.mark.asyncio
async def test_delete_expert_bundle_tenant_success():
    mock_pool = MagicMock()
    bundle_id = uuid4()
    caller_org_id = uuid4()

    existing = {
        "id": bundle_id,
        "org_id": caller_org_id,
        "is_system": False,
        "prompt_suggestions": [],
    }
    mock_pool.fetchrow = AsyncMock(return_value=existing)
    mock_pool.execute = AsyncMock(return_value="DELETE 1")

    deleted = await delete_expert_bundle(mock_pool, bundle_id, caller_org_id)
    assert deleted is True


@pytest.mark.asyncio
async def test_delete_expert_bundle_refuses_system_bundle():
    mock_pool = MagicMock()
    bundle_id = uuid4()
    caller_org_id = uuid4()

    system_bundle = {
        "id": bundle_id,
        "org_id": None,
        "is_system": True,
        "prompt_suggestions": [],
    }
    mock_pool.fetchrow = AsyncMock(return_value=system_bundle)

    deleted = await delete_expert_bundle(mock_pool, bundle_id, caller_org_id)
    assert deleted is False  # Refused


# --- 3. Live PostgreSQL Integration Tests (if local Postgres is reachable) ---

@pytest.mark.asyncio
async def test_live_postgres_seed_bundle():
    """Verify Migration 187 seed row exists in local PostgreSQL on port 54322."""
    try:
        conn = await asyncpg.connect("postgresql://postgres:postgres@127.0.0.1:54322/postgres", timeout=2)
    except Exception:
        pytest.skip("Local PostgreSQL not reachable on 127.0.0.1:54322")

    try:
        bundle = await get_expert_bundle_by_slug(conn, "financial-analyzer", None)
        assert bundle is not None
        assert bundle["slug"] == "financial-analyzer"
        assert bundle["name"] == "Financial Analyzer"
        assert bundle["is_system"] is True
        assert bundle["scope_mode"] == "restricted"
        assert bundle["visibility"] == "public"
        assert len(bundle["prompt_suggestions"]) == 3
        assert bundle["prompt_suggestions"][0]["title"] == "Summarize 10-K Risks"
    finally:
        await conn.close()
