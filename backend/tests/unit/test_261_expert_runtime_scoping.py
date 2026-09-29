from __future__ import annotations

import ast
import pathlib
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest

from app.services.expert_service import ResolvedExpertBundle
from app.services.run_producer import ThreadScoping, _resolve_thread_scoping


APP_DIR = pathlib.Path(__file__).resolve().parent.parent.parent / "app"


@pytest.mark.asyncio
async def test_union_scope_composition_default_biased():
    """D-v4.3-01 / SEED-303 S4: In biased mode, thread folder + expert folder are unified."""
    thread_id = str(uuid4())
    expert_id = uuid4()
    thread_folder_id = str(uuid4())
    subfolder_id = str(uuid4())
    expert_folder_id = uuid4()
    user_id = str(uuid4())
    org_id = str(uuid4())

    mock_supabase = MagicMock()
    mock_t_query = MagicMock()
    mock_t_resp = MagicMock(data={"active_expert_id": str(expert_id), "folder_id": thread_folder_id})
    mock_t_query.select.return_value.eq.return_value.maybe_single.return_value = mock_t_resp
    mock_supabase.table.return_value = mock_t_query

    all_folders = [
        {"id": thread_folder_id, "parent_id": None, "name": "Clients"},
        {"id": subfolder_id, "parent_id": thread_folder_id, "name": "Acme"},
        {"id": str(expert_folder_id), "parent_id": None, "name": "Accounting Standards"},
    ]

    resolved_bundle = ResolvedExpertBundle(
        bundle_id=expert_id,
        name="Accounting Standards",
        slug="accounting-standards",
        description="Accounting consultant",
        scope_mode="biased",
        is_system=False,
        org_id=UUID(org_id),
        tool_floor_enabled=True,
        effective_skills=["gaap_eval"],
        effective_folder_ids=[expert_folder_id],
        effective_connections=["slack_bot"],
    )

    with patch("app.utils.db.aexec", AsyncMock(return_value=mock_t_resp)), \
         patch("app.services.expert_service.resolve_expert_bundle", AsyncMock(return_value=resolved_bundle)), \
         patch("app.utils.folder_utils.fetch_visible_folders", AsyncMock(return_value=all_folders)):

        # Phase 267: a ThreadScoping NamedTuple, read by attribute (the field order changed).
        scoping = await _resolve_thread_scoping(
            supabase=mock_supabase,
            thread_id=thread_id,
            current_user={"id": user_id, "org_id": org_id},
            pool=MagicMock(),
        )
        eff_folders, scoped_path, born_for = (
            scoping.effective_folder_ids, scoping.scoped_folder_path, scoping.born_for_bundle_id,
        )

        # Phase 264 (PACK-17 / T-264-01) - the fifth element is the ACCESS-CHECKED
        # ResolvedExpertBundle.bundle_id, never the thread row's raw active_expert_id.
        assert born_for == expert_id

        assert eff_folders is not None
        # Must contain both thread subfolders AND expert folder
        assert thread_folder_id in eff_folders
        assert subfolder_id in eff_folders
        assert str(expert_folder_id) in eff_folders
        assert len(eff_folders) == 3

        # Scoped path reflects the thread's workspace folder
        assert scoped_path == "/Clients"


@pytest.mark.asyncio
async def test_strict_isolation_restricted_mode():
    """D-v4.3-01 / SEED-303 S5: In restricted mode, retrieval is strictly exclusive to expert folders."""
    thread_id = str(uuid4())
    expert_id = uuid4()
    thread_folder_id = str(uuid4())
    expert_folder_id = uuid4()
    user_id = str(uuid4())
    org_id = str(uuid4())

    mock_supabase = MagicMock()
    mock_t_resp = MagicMock(data={"active_expert_id": str(expert_id), "folder_id": thread_folder_id})

    all_folders = [
        {"id": thread_folder_id, "parent_id": None, "name": "Engineering"},
        {"id": str(expert_folder_id), "parent_id": None, "name": "HR Policies"},
    ]

    resolved_bundle = ResolvedExpertBundle(
        bundle_id=expert_id,
        name="HR Advisor",
        slug="hr-advisor",
        description="Strictly confidential HR advisor",
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

        # Phase 267: a ThreadScoping NamedTuple, read by attribute (the field order changed).
        scoping = await _resolve_thread_scoping(
            supabase=mock_supabase,
            thread_id=thread_id,
            current_user={"id": user_id, "org_id": org_id},
            pool=MagicMock(),
        )
        eff_folders, scoped_path, born_for = (
            scoping.effective_folder_ids, scoping.scoped_folder_path, scoping.born_for_bundle_id,
        )

        # Phase 264 (PACK-17 / T-264-01) - the fifth element is the ACCESS-CHECKED
        # ResolvedExpertBundle.bundle_id, never the thread row's raw active_expert_id.
        assert born_for == expert_id

        assert eff_folders is not None
        # Thread folder is strictly EXCLUDED
        assert thread_folder_id not in eff_folders
        assert eff_folders == (str(expert_folder_id),)

        # Scoped path is synchronized to expert's folder, preventing prompt desync (BUG-260920-01)
        assert scoped_path == "/HR Policies"


@pytest.mark.asyncio
async def test_tool_floor_enabled_has_no_effect_and_no_tool_list_is_computed():
    """Phase 267 (D-267-01 / D-267-02) — RE-DRIVEN from "D-v4.3-02 / SEED-303 S6: deliverable tools
    are preserved as an additive floor (and REMOVED when tool_floor_enabled is False)".

    The original intent was "an Expert must not lose the tools that produce deliverables". 267
    delivers the stronger form: an Expert computes NO tool list at all, so it loses NOTHING — and
    `tool_floor_enabled=False` can no longer remove anything either. Both flag values hand the
    loop the same data, with no tool slot, and the Expert's approved connection is carried as
    an ADDITIVE key (D-267-29) instead of being mixed into a tool whitelist.
    """
    thread_id = str(uuid4())
    expert_id = uuid4()
    user_id = str(uuid4())
    org_id = str(uuid4())

    mock_supabase = MagicMock()
    mock_t_resp = MagicMock(data={"active_expert_id": str(expert_id), "folder_id": None})

    results = {}
    for floor in (True, False):
        resolved = ResolvedExpertBundle(
            bundle_id=expert_id,
            name="RFP Responder",
            slug="rfp-responder",
            description="Produces RFP proposals",
            scope_mode="biased",
            is_system=False,
            org_id=UUID(org_id),
            tool_floor_enabled=floor,
            effective_skills=[],
            effective_folder_ids=[],
            effective_connections=["hubspot"],
        )
        with patch("app.utils.db.aexec", AsyncMock(return_value=mock_t_resp)), \
             patch("app.services.expert_service.resolve_expert_bundle", AsyncMock(return_value=resolved)):
            results[floor] = await _resolve_thread_scoping(
                supabase=mock_supabase,
                thread_id=thread_id,
                current_user={"id": user_id, "org_id": org_id},
                pool=MagicMock(),
            )

    for scoping in results.values():
        assert isinstance(scoping, ThreadScoping)
        # Phase 264 (PACK-17 / T-264-01) - the ACCESS-CHECKED bundle id, never the raw thread value.
        assert scoping.born_for_bundle_id == expert_id
        assert not hasattr(scoping, "effective_tools"), "a tool list is being computed again"
        # The Expert's connection ADDS (D-267-29), it is not a whitelist entry
        assert scoping.scoped_connection_keys == ("hubspot",)

    # The flag changes nothing the run receives.
    assert results[True] == results[False]


def test_agent_loop_contains_zero_expert_branches():
    """PACK-01 / EXT-01 / D-260-05: agent_loop.py contains strictly zero 'if expert:' branches."""
    loop_path = APP_DIR / "services" / "agent_loop.py"
    content = loop_path.read_text(encoding="utf-8")
    tree = ast.parse(content, filename=str(loop_path))

    for node in ast.walk(tree):
        if isinstance(node, ast.If):
            # Check test expression for expert mentions
            test_src = ast.unparse(node.test).lower()
            assert "expert" not in test_src, (
                f"Expert branch detected in agent_loop.py:{node.lineno}: 'if {test_src}' — "
                "scoping must be passed purely as RunContext data."
            )
