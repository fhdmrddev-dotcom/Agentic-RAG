"""End-to-End Scenario Driver for Expert Authoring and Scoping (SEED-303 / PACK-07..10).

Phase 261: An Expert You Can Author.
Validates scenarios:
  - S1: Authoring CRUD (create, read, update, delete tenant bundle)
  - S2: Data-driven permission denial (HTTP 403 on missing experts:manage, role_permissions driven)
  - S4: Union scope retrieval composition (thread folder + expert folders unified)
  - S5: Strict isolation retrieval (restricted scope exclusively in expert folders)
  - S6: Additive tool floor (deliverable tools retained and enabled)
  - S8: Clone-on-customise (system templates remain immutable; tenant clone is independent)
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException, Request

from app.api.experts import require_expert_manage
from app.models.expert import ExpertBundleCreate, ExpertBundleUpdate
from app.services.expert_service import (
    ResolvedExpertBundle,
    create_expert_service,
    delete_expert_service,
    get_expert_service,
    update_expert_service,
)
from app.services.run_producer import _resolve_thread_scoping
from app.services.tool_dispatcher import EXPERT_CORE_TOOLS, EXPERT_DELIVERABLE_TOOLS


# ── Scenario S1: Authoring CRUD ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_scenario_s1_authoring_crud():
    """S1: Org-admin creates bundle, updates it, reads it, and deletes it."""
    mock_pool = MagicMock()
    org_id = uuid4()
    user_id = uuid4()
    bundle_id = uuid4()

    bundle_in = ExpertBundleCreate(
        name="Contract Reviewer",
        slug="contract-reviewer",
        description="Analyzes legal agreements",
        icon="scale",
        category="Legal",
        when_to_use="When checking NDA and MSA clauses",
        example_output="Clause risk score: Low",
        scope_mode="biased",
        tool_floor_enabled=True,
        member_skills=[],
        required_connections=[],
        knowledge_folder_ids=[],
        prompt_suggestions=[],
        visibility="org",
    )

    created_row = {
        "id": str(bundle_id),
        "org_id": str(org_id),
        "name": bundle_in.name,
        "slug": bundle_in.slug,
        "description": bundle_in.description,
        "icon": bundle_in.icon,
        "category": bundle_in.category,
        "when_to_use": bundle_in.when_to_use,
        "example_output": bundle_in.example_output,
        "scope_mode": bundle_in.scope_mode,
        "tool_floor_enabled": True,
        "visibility": "org",
        "is_system": False,
        "is_enabled": True,
    }

    with patch("app.db.experts.create_expert_bundle", AsyncMock(return_value=created_row)), \
         patch("app.db.experts.get_expert_bundle_by_id", AsyncMock(return_value=created_row)), \
         patch("app.db.experts.update_expert_bundle", AsyncMock(return_value={**created_row, "name": "Contract Reviewer Pro"})), \
         patch("app.db.experts.delete_expert_bundle", AsyncMock(return_value=True)):

        # 1. Create
        created = await create_expert_service(mock_pool, org_id, user_id, bundle_in)
        assert created["name"] == "Contract Reviewer"
        assert created["scope_mode"] == "biased"
        assert created["tool_floor_enabled"] is True

        # 2. Read
        fetched = await get_expert_service(mock_pool, bundle_id, org_id)
        assert fetched is not None
        assert fetched["id"] == str(bundle_id)

        # 3. Update
        update_in = ExpertBundleUpdate(name="Contract Reviewer Pro")
        updated = await update_expert_service(mock_pool, bundle_id, org_id, update_in)
        assert updated is not None
        assert updated["name"] == "Contract Reviewer Pro"

        # 4. Delete
        deleted = await delete_expert_service(mock_pool, bundle_id, org_id)
        assert deleted is True


# ── Scenario S2: Data-Driven Permission Denial ──────────────────────────────

@pytest.mark.asyncio
async def test_scenario_s2_permission_denial_member_without_grant():
    """S2: Member without experts:manage receives HTTP 403; permission is data-driven."""
    mock_request = MagicMock(spec=Request)
    member_user = {"id": str(uuid4()), "role": "member"}
    org_id = str(uuid4())

    with patch("app.api.experts._has_org_permission", AsyncMock(return_value=False)):
        with pytest.raises(HTTPException) as exc_info:
            await require_expert_manage(
                request=mock_request,
                current_user=member_user,
                active_org=org_id,
            )
        assert exc_info.value.status_code == 403
        assert "do not have permission to manage experts" in exc_info.value.detail


@pytest.mark.asyncio
async def test_scenario_s2_permission_allowed_with_grant():
    """S2: Caller holding experts:manage (e.g. org-admin or custom granted role) passes."""
    mock_request = MagicMock(spec=Request)
    admin_user = {"id": str(uuid4()), "role": "org-admin"}
    org_id = str(uuid4())

    with patch("app.api.experts._has_org_permission", AsyncMock(return_value=True)):
        user = await require_expert_manage(
            request=mock_request,
            current_user=admin_user,
            active_org=org_id,
        )
        assert user == admin_user


# ── Scenario S4: Union Scope Retrieval ──────────────────────────────────────

@pytest.mark.asyncio
async def test_scenario_s4_union_scope_composition():
    """S4: Chat in thread folder with expert in scope_mode='biased' unifies both folders."""
    thread_id = str(uuid4())
    expert_id = uuid4()
    thread_folder_id = str(uuid4())
    expert_folder_id = uuid4()
    user_id = str(uuid4())
    org_id = str(uuid4())

    mock_supabase = MagicMock()
    mock_t_resp = MagicMock(data={"active_expert_id": str(expert_id), "folder_id": thread_folder_id})

    all_folders = [
        {"id": thread_folder_id, "parent_id": None, "name": "Active Diligence"},
        {"id": str(expert_folder_id), "parent_id": None, "name": "GAAP Library"},
    ]

    resolved_bundle = ResolvedExpertBundle(
        bundle_id=expert_id,
        name="Accounting Expert",
        slug="accounting-expert",
        description="Accounting consultant",
        scope_mode="biased",
        is_system=False,
        org_id=UUID(org_id),
        tool_floor_enabled=True,
        effective_skills=[],
        effective_folder_ids=[expert_folder_id],
        effective_connections=[],
    )

    with patch("app.utils.db.aexec", AsyncMock(return_value=mock_t_resp)), \
         patch("app.services.expert_service.resolve_expert_bundle", AsyncMock(return_value=resolved_bundle)), \
         patch("app.utils.folder_utils.fetch_visible_folders", AsyncMock(return_value=all_folders)):

        eff_folders, eff_tools, _, scoped_path = await _resolve_thread_scoping(
            supabase=mock_supabase,
            thread_id=thread_id,
            current_user={"id": user_id, "org_id": org_id},
            pool=MagicMock(),
        )

        # Union composition: both thread folder and expert folder are present
        assert eff_folders is not None
        assert thread_folder_id in eff_folders
        assert str(expert_folder_id) in eff_folders
        assert len(eff_folders) == 2
        assert scoped_path == "/Active Diligence"


# ── Scenario S5: Strict Isolation Retrieval ─────────────────────────────────

@pytest.mark.asyncio
async def test_scenario_s5_strict_isolation():
    """S5: Expert with scope_mode='restricted' searches ONLY expert folders, excluding thread folder."""
    thread_id = str(uuid4())
    expert_id = uuid4()
    thread_folder_id = str(uuid4())
    expert_folder_id = uuid4()
    user_id = str(uuid4())
    org_id = str(uuid4())

    mock_supabase = MagicMock()
    mock_t_resp = MagicMock(data={"active_expert_id": str(expert_id), "folder_id": thread_folder_id})

    all_folders = [
        {"id": thread_folder_id, "parent_id": None, "name": "Unrelated Project"},
        {"id": str(expert_folder_id), "parent_id": None, "name": "HR Confidential Handbook"},
    ]

    resolved_bundle = ResolvedExpertBundle(
        bundle_id=expert_id,
        name="HR Compliance Officer",
        slug="hr-compliance-officer",
        description="Confidential HR specialist",
        scope_mode="restricted",
        is_system=False,
        org_id=UUID(org_id),
        tool_floor_enabled=True,
        effective_skills=[],
        effective_folder_ids=[expert_folder_id],
        effective_connections=[],
    )

    with patch("app.utils.db.aexec", AsyncMock(return_value=mock_t_resp)), \
         patch("app.services.expert_service.resolve_expert_bundle", AsyncMock(return_value=resolved_bundle)), \
         patch("app.utils.folder_utils.fetch_visible_folders", AsyncMock(return_value=all_folders)):

        eff_folders, eff_tools, _, scoped_path = await _resolve_thread_scoping(
            supabase=mock_supabase,
            thread_id=thread_id,
            current_user={"id": user_id, "org_id": org_id},
            pool=MagicMock(),
        )

        # Strict isolation: thread folder is excluded
        assert eff_folders is not None
        assert thread_folder_id not in eff_folders
        assert list(eff_folders) == [str(expert_folder_id)]
        assert scoped_path == "/HR Confidential Handbook"


# ── Scenario S6: Additive Tool Floor ────────────────────────────────────────

@pytest.mark.asyncio
async def test_scenario_s6_additive_tool_floor_deliverables():
    """S6: Deliverable tools (execute_code, workspace_write, render_template, ask_user) are retained."""
    thread_id = str(uuid4())
    expert_id = uuid4()
    user_id = str(uuid4())
    org_id = str(uuid4())

    mock_supabase = MagicMock()
    mock_t_resp = MagicMock(data={"active_expert_id": str(expert_id), "folder_id": None})

    resolved_bundle = ResolvedExpertBundle(
        bundle_id=expert_id,
        name="Data Scientist",
        slug="data-scientist",
        description="Python computation consultant",
        scope_mode="biased",
        is_system=False,
        org_id=UUID(org_id),
        tool_floor_enabled=True,
        effective_skills=[],
        effective_folder_ids=[],
        effective_connections=[],
    )

    with patch("app.utils.db.aexec", AsyncMock(return_value=mock_t_resp)), \
         patch("app.services.expert_service.resolve_expert_bundle", AsyncMock(return_value=resolved_bundle)):

        _, eff_tools, _, _ = await _resolve_thread_scoping(
            supabase=mock_supabase,
            thread_id=thread_id,
            current_user={"id": user_id, "org_id": org_id},
            pool=MagicMock(),
        )

        assert eff_tools is not None
        # All deliverable tools are preserved
        for deliv_tool in EXPERT_DELIVERABLE_TOOLS:
            assert deliv_tool in eff_tools, f"Expected {deliv_tool} in expert effective tools"
        # Core tools are preserved
        for core_tool in EXPERT_CORE_TOOLS:
            assert core_tool in eff_tools, f"Expected {core_tool} in expert effective tools"


# ── Scenario S8: Clone-On-Customise ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_scenario_s8_clone_on_customise_system_template():
    """S8: System template cannot be modified/deleted, but clones cleanly into a customizable tenant bundle."""
    mock_pool = MagicMock()
    tenant_org_id = uuid4()
    tenant_user_id = uuid4()
    system_bundle_id = uuid4()

    system_template = {
        "id": str(system_bundle_id),
        "org_id": None,
        "name": "Financial Analyzer",
        "slug": "financial-analyzer",
        "description": "Base financial modeling template",
        "icon": "chart",
        "category": "Finance",
        "when_to_use": "When analyzing financial statements",
        "example_output": "P&L Summary",
        "scope_mode": "biased",
        "tool_floor_enabled": True,
        "member_skills": ["ratio_calc"],
        "required_connections": [],
        "knowledge_folder_ids": [],
        "prompt_suggestions": [{"title": "Ratio", "prompt": "Run ratio"}],
        "visibility": "org",
        "is_system": True,
        "is_enabled": True,
    }

    # 1. Tenant attempts to update or delete the system template -> Refused (None / False)
    with patch("app.db.experts.update_expert_bundle", AsyncMock(return_value=None)), \
         patch("app.db.experts.delete_expert_bundle", AsyncMock(return_value=False)):
        updated = await update_expert_service(
            mock_pool,
            system_bundle_id,
            tenant_org_id,
            ExpertBundleUpdate(name="Hacked System"),
        )
        assert updated is None

        deleted = await delete_expert_service(mock_pool, system_bundle_id, tenant_org_id)
        assert deleted is False

    # 2. Tenant clones the system template into an editable tenant bundle
    cloned_in = ExpertBundleCreate(
        name="Custom Financial Analyzer",
        slug="custom-financial-analyzer",
        description=system_template["description"],
        icon=system_template["icon"],
        category=system_template["category"],
        when_to_use=system_template["when_to_use"],
        example_output=system_template["example_output"],
        scope_mode=system_template["scope_mode"],
        tool_floor_enabled=system_template["tool_floor_enabled"],
        member_skills=system_template["member_skills"],
        required_connections=system_template["required_connections"],
        knowledge_folder_ids=system_template["knowledge_folder_ids"],
        prompt_suggestions=system_template["prompt_suggestions"],
        visibility="org",
    )

    cloned_row = {
        "id": str(uuid4()),
        "org_id": str(tenant_org_id),
        "name": cloned_in.name,
        "slug": cloned_in.slug,
        "description": cloned_in.description,
        "is_system": False,
        "is_enabled": True,
    }

    with patch("app.db.experts.create_expert_bundle", AsyncMock(return_value=cloned_row)):
        cloned = await create_expert_service(mock_pool, tenant_org_id, tenant_user_id, cloned_in)
        assert cloned["id"] != str(system_bundle_id)
        assert cloned["org_id"] == str(tenant_org_id)
        assert cloned["is_system"] is False
        assert cloned["name"] == "Custom Financial Analyzer"


# ── Scenario PACK-10: Ungranted User Refusal on All Surfaces ─────────────────

@pytest.mark.asyncio
async def test_scenario_pack10_ungranted_user_cannot_read_or_invite_expert():
    """PACK-10 / SC#5: A user outside the grant set can neither see, read, resolve, nor invite the expert."""
    mock_pool = MagicMock()
    org_id = uuid4()
    creator_id = uuid4()
    ungranted_user_id = uuid4()
    granted_user_id = uuid4()
    bundle_id = uuid4()

    # Raw bundle in DB is readable by org, but visibility='granted'
    bundle_row = {
        "id": str(bundle_id),
        "org_id": str(org_id),
        "name": "HR Advisor",
        "slug": "hr-advisor",
        "description": "Confidential HR advice",
        "icon": "shield",
        "category": "HR",
        "when_to_use": "HR issues only",
        "example_output": "Policy memo",
        "scope_mode": "restricted",
        "tool_floor_enabled": True,
        "member_skills": [],
        "required_connections": [],
        "knowledge_folder_ids": [],
        "prompt_suggestions": [],
        "visibility": "granted",
        "created_by": str(creator_id),
        "is_system": False,
        "is_enabled": True,
    }

    # check_expert_grant_access mock: True only for granted_user_id, False for ungranted_user_id
    async def mock_check_grant(pool, bundle, caller_user_id, caller_roles=None, **kwargs):
        if caller_user_id == granted_user_id:
            return True
        return False

    with patch("app.db.experts.get_expert_bundle_by_id", AsyncMock(return_value=bundle_row)), \
         patch("app.db.experts.get_expert_bundle_by_slug", AsyncMock(return_value=bundle_row)), \
         patch("app.db.experts.check_expert_grant_access", AsyncMock(side_effect=mock_check_grant)):

        # 1. Surface 1: get_expert_service & get_expert_by_slug_service
        # Ungranted user -> must return None (refused)
        ungranted_bundle = await get_expert_service(
            mock_pool, bundle_id, org_id, caller_user_id=ungranted_user_id, caller_roles=["member"]
        )
        assert ungranted_bundle is None, "Surface 1 (get_expert_service) must refuse ungranted user"

        # Granted user -> allowed
        granted_bundle = await get_expert_service(
            mock_pool, bundle_id, org_id, caller_user_id=granted_user_id, caller_roles=["member"]
        )
        assert granted_bundle is not None
        assert granted_bundle["id"] == str(bundle_id)

        # Slug lookup (Surface 1b)
        from app.services.expert_service import get_expert_by_slug_service
        ungranted_slug = await get_expert_by_slug_service(
            mock_pool, "hr-advisor", org_id, caller_user_id=ungranted_user_id, caller_roles=["member"]
        )
        assert ungranted_slug is None, "Slug lookup must refuse ungranted user"

        granted_slug = await get_expert_by_slug_service(
            mock_pool, "hr-advisor", org_id, caller_user_id=granted_user_id, caller_roles=["member"]
        )
        assert granted_slug is not None
        assert granted_slug["slug"] == "hr-advisor"

        # 2. Surface 2: resolve_expert_bundle
        from app.services.expert_service import resolve_expert_bundle
        # Ungranted user -> must return None (refused)
        resolved_ungranted = await resolve_expert_bundle(
            pool=mock_pool,
            bundle_id=bundle_id,
            caller_org_id=org_id,
            caller_user_id=ungranted_user_id,
            caller_roles=["member"],
        )
        assert resolved_ungranted is None, "Surface 2 (resolve_expert_bundle) must refuse ungranted user"

        # Granted user -> allowed
        resolved_granted = await resolve_expert_bundle(
            pool=mock_pool,
            bundle_id=bundle_id,
            caller_org_id=org_id,
            caller_user_id=granted_user_id,
            caller_roles=["member"],
        )
        assert resolved_granted is not None
        assert resolved_granted.bundle_id == bundle_id

        # 3. Surface 3 (HTTP Endpoints): get_expert & resolve_expert
        from app.api.experts import get_expert, resolve_expert

        # Ungranted user calling GET /experts/{id} -> 404
        with pytest.raises(HTTPException) as exc_info:
            await get_expert(
                bundle_id=bundle_id,
                active_org=str(org_id),
                current_user={"id": str(ungranted_user_id), "role": "member"},
                pool=mock_pool,
            )
        assert exc_info.value.status_code == 404
        assert exc_info.value.detail == "Expert bundle not found"

        # Granted user calling GET /experts/{id} -> 200
        ok_bundle = await get_expert(
            bundle_id=bundle_id,
            active_org=str(org_id),
            current_user={"id": str(granted_user_id), "role": "member"},
            pool=mock_pool,
        )
        assert ok_bundle["id"] == str(bundle_id)

        # Ungranted user calling GET /experts/{id}/resolve -> 404
        with pytest.raises(HTTPException) as exc_info:
            await resolve_expert(
                bundle_id=bundle_id,
                active_org=str(org_id),
                current_user={"id": str(ungranted_user_id), "role": "member"},
                pool=mock_pool,
            )
        assert exc_info.value.status_code == 404

        # Granted user calling GET /experts/{id}/resolve -> 200
        ok_resolved = await resolve_expert(
            bundle_id=bundle_id,
            active_org=str(org_id),
            current_user={"id": str(granted_user_id), "role": "member"},
            pool=mock_pool,
        )
        assert ok_resolved.bundle_id == bundle_id

        # 4. Surface 4: run_producer runtime thread scoping (cannot invite / execute turn)
        mock_thread_resp = MagicMock()
        mock_thread_resp.data = {"active_expert_id": str(bundle_id), "folder_id": None}
        mock_supabase = MagicMock()
        mock_table = MagicMock()
        mock_supabase.table.return_value = mock_table
        mock_table.select.return_value = mock_table
        mock_table.eq.return_value = mock_table
        mock_table.update.return_value = mock_table

        call_count = 0
        async def mock_thread_aexec(query):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return mock_thread_resp
            return MagicMock(data=[])

        # Ungranted user executing thread -> fails closed with ValueError and resets active_expert_id
        with patch("app.utils.db.aexec", side_effect=mock_thread_aexec):
            with pytest.raises(ValueError) as val_err:
                await _resolve_thread_scoping(
                    supabase=mock_supabase,
                    thread_id="test-thread-id",
                    current_user={"id": str(ungranted_user_id), "org_id": str(org_id), "role": "member"},
                    pool=mock_pool,
                )
            assert "refusing run (fail-closed)" in str(val_err.value)
            mock_table.update.assert_called_with({"active_expert_id": None})

        # 5. Surface 5: PATCH /threads/{thread_id} active_expert_id invite
        from app.api.threads import rename_thread
        from app.models.thread import ThreadUpdate

        thread_patch = ThreadUpdate(active_expert_id=bundle_id)
        mock_req = MagicMock(spec=Request)

        with patch("app.api.threads.resolve_active_org_or_none", AsyncMock(return_value=str(org_id))), \
             patch("app.api.threads.get_pg_pool", AsyncMock(return_value=mock_pool)), \
             patch("app.services.entitlement_service.check_entitlement", AsyncMock(return_value=MagicMock(allowed=True))):

            # Ungranted user attempting to invite/set expert -> 404 HTTPException
            with pytest.raises(HTTPException) as exc_info:
                await rename_thread(
                    thread_id="test-thread-id",
                    body=thread_patch,
                    request=mock_req,
                    current_user={"id": str(ungranted_user_id), "role": "member"},
                    supabase=mock_supabase,
                )
            assert exc_info.value.status_code == 404
            assert "Expert bundle not found or access denied" in exc_info.value.detail

            # Granted user attempting to invite/set expert -> succeeds
            mock_table_select = MagicMock()
            mock_table_select.data = {"id": "test-thread-id", "active_expert_id": str(bundle_id)}
            with patch("app.api.threads.aexec", AsyncMock(return_value=mock_table_select)):
                res = await rename_thread(
                    thread_id="test-thread-id",
                    body=thread_patch,
                    request=mock_req,
                    current_user={"id": str(granted_user_id), "role": "member"},
                    supabase=mock_supabase,
                )
                assert res["active_expert_id"] == str(bundle_id)


