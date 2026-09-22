from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID, uuid4
from datetime import datetime, timezone

import asyncpg
import pytest
from pydantic import ValidationError

from app.db.experts import (
    add_expert_grant,
    bulk_set_expert_grants,
    check_expert_grant_access,
    create_expert_bundle,
    delete_expert_bundle,
    get_expert_bundle_by_id,
    get_expert_grants,
    list_expert_bundles,
    list_expert_bundles_for_caller,
    remove_expert_grant,
    update_expert_bundle,
)
from app.models.expert import (
    ExpertBundle,
    ExpertBundleCreate,
    ExpertBundleUpdate,
    ExpertGrant,
    ExpertGrantCreate,
    PromptSuggestion,
)


# --- 1. Pydantic Model Tests ---

def test_pydantic_expert_grant_models():
    # Valid user grant
    user_grant_in = ExpertGrantCreate(grantee_type="user", grantee_id=str(uuid4()))
    assert user_grant_in.grantee_type == "user"

    # Valid role grant
    role_grant_in = ExpertGrantCreate(grantee_type="role", grantee_id="hr-manager")
    assert role_grant_in.grantee_type == "role"
    assert role_grant_in.grantee_id == "hr-manager"

    # Invalid grantee_type
    with pytest.raises(ValidationError):
        ExpertGrantCreate(grantee_type="group", grantee_id="marketing")  # type: ignore[arg-type]

    # Full ExpertGrant model
    grant_id = uuid4()
    expert_id = uuid4()
    now = datetime.now(timezone.utc)
    grant_obj = ExpertGrant(
        id=grant_id,
        expert_id=expert_id,
        grantee_type="role",
        grantee_id="finance",
        created_at=now,
    )
    assert grant_obj.id == grant_id
    assert grant_obj.expert_id == expert_id
    assert grant_obj.grantee_type == "role"


def test_pydantic_expert_presentation_fields():
    bundle_data = {
        "name": "HR Specialist",
        "slug": "hr-specialist",
        "icon": "shield",
        "category": "Human Resources",
        "when_to_use": "When reviewing workplace compliance and leave policies.",
        "example_output": "Policy section 4.2 dictates 15 days paid leave.",
        "description": "HR consultant",
        "scope_mode": "biased",
        "tool_floor_enabled": True,
        "member_skills": ["policy_review"],
        "required_connections": [],
        "knowledge_folder_ids": [uuid4()],
        "prompt_suggestions": [{"title": "Check Leave", "prompt": "What is leave policy?"}],
        "visibility": "granted",
        "is_enabled": True,
    }
    create_model = ExpertBundleCreate(**bundle_data)
    assert create_model.icon == "shield"
    assert create_model.category == "Human Resources"
    assert create_model.when_to_use == "When reviewing workplace compliance and leave policies."
    assert create_model.example_output == "Policy section 4.2 dictates 15 days paid leave."
    assert create_model.visibility == "granted"
    assert create_model.tool_floor_enabled is True

    # Invalid visibility
    with pytest.raises(ValidationError):
        ExpertBundleCreate(**dict(bundle_data, visibility="secret"))

    # Update model
    update_model = ExpertBundleUpdate(
        icon="briefcase",
        category="Legal",
        tool_floor_enabled=False,
    )
    assert update_model.icon == "briefcase"
    assert update_model.category == "Legal"
    assert update_model.tool_floor_enabled is False


# --- 2. Database Access Layer Unit Tests (Mocked asyncpg Pool) ---

@pytest.mark.asyncio
async def test_create_expert_bundle_includes_presentation_fields():
    mock_pool = MagicMock()
    org_id = uuid4()
    created_by = uuid4()
    bundle_id = uuid4()

    db_row = {
        "id": bundle_id,
        "org_id": org_id,
        "created_by": created_by,
        "name": "Tax Advisor",
        "slug": "tax-advisor",
        "description": "Tax consultant",
        "scope_mode": "restricted",
        "member_skills": [],
        "required_connections": [],
        "knowledge_folder_ids": [],
        "prompt_suggestions": "[]",
        "visibility": "granted",
        "is_system": False,
        "is_enabled": True,
        "icon": "scale",
        "category": "Tax & Compliance",
        "when_to_use": "Tax questions",
        "example_output": "Form 1040 schedule C breakdown",
        "tool_floor_enabled": True,
    }
    mock_pool.fetchrow = AsyncMock(return_value=db_row)

    res = await create_expert_bundle(
        pool=mock_pool,
        org_id=org_id,
        created_by=created_by,
        name="Tax Advisor",
        slug="tax-advisor",
        description="Tax consultant",
        icon="scale",
        category="Tax & Compliance",
        when_to_use="Tax questions",
        example_output="Form 1040 schedule C breakdown",
        tool_floor_enabled=True,
        visibility="granted",
    )
    assert res["id"] == bundle_id
    assert res["icon"] == "scale"
    assert res["category"] == "Tax & Compliance"
    assert res["tool_floor_enabled"] is True

    # Assert SQL contains all new columns
    call_sql = mock_pool.fetchrow.call_args[0][0]
    assert "icon" in call_sql
    assert "category" in call_sql
    assert "when_to_use" in call_sql
    assert "example_output" in call_sql
    assert "tool_floor_enabled" in call_sql


@pytest.mark.asyncio
async def test_update_expert_bundle_presentation_fields():
    mock_pool = MagicMock()
    org_id = uuid4()
    bundle_id = uuid4()

    existing = {
        "id": bundle_id,
        "org_id": org_id,
        "is_system": False,
        "name": "Advisor",
        "icon": "chart",
        "category": "General",
    }
    mock_pool.fetchrow = AsyncMock(side_effect=[
        existing,  # for get_expert_bundle_by_id
        {**existing, "icon": "truck", "category": "Logistics", "tool_floor_enabled": False},  # for update
    ])

    updated = await update_expert_bundle(
        pool=mock_pool,
        bundle_id=bundle_id,
        caller_org_id=org_id,
        icon="truck",
        category="Logistics",
        tool_floor_enabled=False,
    )
    assert updated is not None
    assert updated["icon"] == "truck"
    assert updated["category"] == "Logistics"


@pytest.mark.asyncio
async def test_expert_grants_db_functions():
    mock_pool = MagicMock()
    expert_id = uuid4()
    grant_id = uuid4()
    user_id = str(uuid4())

    # 1. add_expert_grant
    grant_row = {
        "id": grant_id,
        "expert_id": expert_id,
        "grantee_type": "user",
        "grantee_id": user_id,
        "created_at": datetime.now(timezone.utc),
    }
    mock_pool.fetchrow = AsyncMock(return_value=grant_row)

    added = await add_expert_grant(mock_pool, expert_id, "user", user_id)
    assert added["id"] == grant_id
    assert added["grantee_type"] == "user"
    assert added["grantee_id"] == user_id

    # 2. get_expert_grants
    mock_pool.fetch = AsyncMock(return_value=[grant_row])
    grants = await get_expert_grants(mock_pool, expert_id)
    assert len(grants) == 1
    assert grants[0]["id"] == grant_id

    # 3. remove_expert_grant
    mock_pool.execute = AsyncMock(return_value="DELETE 1")
    removed = await remove_expert_grant(mock_pool, grant_id, expert_id)
    assert removed is True


@pytest.mark.asyncio
async def test_check_expert_grant_access_scenarios():
    mock_pool = MagicMock()
    bundle_id = uuid4()
    creator_id = uuid4()
    other_user_id = uuid4()

    # System bundle -> always True
    sys_bundle = {"id": bundle_id, "is_system": True, "visibility": "public"}
    assert await check_expert_grant_access(mock_pool, sys_bundle, other_user_id) is True

    # Org / Public bundle -> always True
    org_bundle = {"id": bundle_id, "is_system": False, "visibility": "org", "created_by": creator_id}
    assert await check_expert_grant_access(mock_pool, org_bundle, other_user_id) is True

    # Private bundle -> True for creator, False for other
    priv_bundle = {"id": bundle_id, "is_system": False, "visibility": "private", "created_by": creator_id}
    assert await check_expert_grant_access(mock_pool, priv_bundle, creator_id) is True
    assert await check_expert_grant_access(mock_pool, priv_bundle, other_user_id) is False

    # Granted bundle -> True for creator without DB check
    restr_bundle = {"id": bundle_id, "is_system": False, "visibility": "granted", "created_by": creator_id}
    assert await check_expert_grant_access(mock_pool, restr_bundle, creator_id) is True

    # Restricted bundle -> True when grant found in DB
    mock_pool.fetchrow = AsyncMock(return_value={"?column?": 1})
    assert await check_expert_grant_access(mock_pool, restr_bundle, other_user_id, ["member"]) is True

    # Restricted bundle -> False when no grant in DB
    mock_pool.fetchrow = AsyncMock(return_value=None)
    assert await check_expert_grant_access(mock_pool, restr_bundle, other_user_id, ["member"]) is False


# --- 3. Live PostgreSQL Integration Tests (:54322) ---

@pytest.mark.asyncio
async def test_live_db_presentation_columns_and_analyzer():
    """Verify Migration 189 presentation fields on Financial Analyzer in local Postgres."""
    try:
        conn = await asyncpg.connect("postgresql://postgres:postgres@127.0.0.1:54322/postgres", timeout=2)
    except Exception:
        pytest.skip("Local PostgreSQL not reachable on 127.0.0.1:54322")

    try:
        row = await conn.fetchrow("""
            SELECT icon, category, when_to_use, example_output, tool_floor_enabled, visibility
            FROM public.expert_bundles
            WHERE slug = 'financial-analyzer' AND is_system = true;
        """)
        assert row is not None
        assert row["icon"] == "chart"
        assert row["category"] == "Finance"
        assert "10-K" in row["when_to_use"]
        assert "EBITDA Margin" in row["example_output"]
        assert row["tool_floor_enabled"] is True
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_live_db_expert_grants_crud_and_access():
    """Verify expert_grants table, uniqueness constraint, and grant evaluation on :54322."""
    try:
        conn = await asyncpg.connect("postgresql://postgres:postgres@127.0.0.1:54322/postgres", timeout=2)
    except Exception:
        pytest.skip("Local PostgreSQL not reachable on 127.0.0.1:54322")

    org_id = uuid4()
    creator_id = uuid4()
    user_a = uuid4()
    user_b = uuid4()
    slug = f"test-grant-{uuid4().hex[:8]}"

    try:
        # Create test org
        await conn.execute("INSERT INTO public.organizations (id, name, slug) VALUES ($1, $2, $3);", org_id, "Grant Test Org", slug)

        # 1. Create a granted expert bundle
        bundle = await create_expert_bundle(
            pool=conn,
            org_id=org_id,
            created_by=creator_id,
            name="Confidential HR",
            slug=slug,
            description="Granted HR Expert",
            visibility="granted",
            icon="shield",
            category="HR",
        )
        expert_id = bundle["id"]
        assert bundle["visibility"] == "granted"

        # 2. Add grant for user_a
        g1 = await add_expert_grant(conn, expert_id, "user", str(user_a))
        assert g1["grantee_type"] == "user"
        assert g1["grantee_id"] == str(user_a)

        # 3. Add duplicate grant -> idempotent check (same grant returned, no error)
        g1_dup = await add_expert_grant(conn, expert_id, "user", str(user_a))
        assert g1_dup["id"] == g1["id"]

        # 4. Add role grant for 'hr-role'
        g2 = await add_expert_grant(conn, expert_id, "role", "hr-role")
        assert g2["grantee_type"] == "role"
        assert g2["grantee_id"] == "hr-role"

        # 5. List grants
        all_grants = await get_expert_grants(conn, expert_id)
        assert len(all_grants) == 2

        # 6. Verify check_expert_grant_access
        # Creator has access
        assert await check_expert_grant_access(conn, bundle, creator_id) is True
        # user_a has user grant -> True
        assert await check_expert_grant_access(conn, bundle, user_a, ["member"]) is True
        # user_b with 'member' role only -> False
        assert await check_expert_grant_access(conn, bundle, user_b, ["member"]) is False
        # user_b with 'hr-role' -> True
        assert await check_expert_grant_access(conn, bundle, user_b, ["member", "hr-role"]) is True

        # 7. Verify list_expert_bundles_for_caller
        # user_a sees it
        list_a = await list_expert_bundles_for_caller(conn, org_id, user_a, ["member"], include_system=False)
        assert any(b["id"] == expert_id for b in list_a)

        # user_b (plain member) does NOT see it
        list_b = await list_expert_bundles_for_caller(conn, org_id, user_b, ["member"], include_system=False)
        assert not any(b["id"] == expert_id for b in list_b)

        # user_b (with hr-role) sees it
        list_b_hr = await list_expert_bundles_for_caller(conn, org_id, user_b, ["member", "hr-role"], include_system=False)
        assert any(b["id"] == expert_id for b in list_b_hr)

        # 8. Remove user grant
        removed = await remove_expert_grant(conn, g1["id"], expert_id)
        assert removed is True
        grants_after = await get_expert_grants(conn, expert_id)
        assert len(grants_after) == 1

        # user_a no longer has access
        assert await check_expert_grant_access(conn, bundle, user_a, ["member"]) is False

    finally:
        # Cleanup
        await conn.execute("DELETE FROM public.expert_bundles WHERE org_id = $1;", org_id)
        await conn.execute("DELETE FROM public.organizations WHERE id = $1;", org_id)
        await conn.close()


@pytest.mark.asyncio
async def test_live_db_role_permissions_experts_manage():
    """Verify Migration 189 seeds experts:manage into public.role_permissions."""
    try:
        conn = await asyncpg.connect("postgresql://postgres:postgres@127.0.0.1:54322/postgres", timeout=2)
    except Exception:
        pytest.skip("Local PostgreSQL not reachable on 127.0.0.1:54322")

    try:
        rows = await conn.fetch("""
            SELECT role, permission_key
            FROM public.role_permissions
            WHERE permission_key = 'experts:manage';
        """)
        roles = {r["role"] for r in rows}
        assert "super-admin" in roles
        assert "org-admin" in roles
        assert "member" not in roles
    finally:
        await conn.close()
