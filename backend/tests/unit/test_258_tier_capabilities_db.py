from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from app.db.entitlements import (
    get_minimum_tier_for_capability,
    get_tier_capabilities,
    is_capability_enabled_for_tier,
    resolve_org_entitlement,
)


@pytest.mark.asyncio
async def test_get_tier_capabilities():
    mock_pool = MagicMock()
    mock_pool.fetch = AsyncMock(
        return_value=[
            {"capability": "basic_rag"},
            {"capability": "chat"},
        ]
    )

    caps = await get_tier_capabilities(mock_pool, "standard")
    assert caps == {"basic_rag", "chat"}
    mock_pool.fetch.assert_awaited_once()

    # Empty tier returns empty set immediately
    empty_caps = await get_tier_capabilities(mock_pool, "")
    assert empty_caps == set()


@pytest.mark.asyncio
async def test_is_capability_enabled_for_tier():
    mock_pool = MagicMock()
    mock_pool.fetchval = AsyncMock(return_value=1)

    enabled = await is_capability_enabled_for_tier(mock_pool, "enterprise", "workflows")
    assert enabled is True

    mock_pool.fetchval = AsyncMock(return_value=None)
    disabled = await is_capability_enabled_for_tier(mock_pool, "standard", "workflows")
    assert disabled is False

    # Empty inputs return False
    assert await is_capability_enabled_for_tier(mock_pool, "", "workflows") is False
    assert await is_capability_enabled_for_tier(mock_pool, "standard", "") is False


@pytest.mark.asyncio
async def test_get_minimum_tier_for_capability():
    mock_pool = MagicMock()
    # Returns rows with multiple tiers; TIER_ORDER selects pro over enterprise
    mock_pool.fetch = AsyncMock(
        return_value=[{"tier": "enterprise"}, {"tier": "pro"}]
    )

    min_tier = await get_minimum_tier_for_capability(mock_pool, "skills")
    assert min_tier == "pro"

    mock_pool.fetch = AsyncMock(return_value=[])
    assert await get_minimum_tier_for_capability(mock_pool, "unknown_cap") is None
    assert await get_minimum_tier_for_capability(mock_pool, "") is None


@pytest.mark.asyncio
async def test_resolve_org_entitlement_granted_by_tier():
    mock_pool = MagicMock()
    org_id = uuid4()

    # Org row has enterprise tier and empty add_ons
    mock_pool.fetchrow = AsyncMock(
        return_value={
            "subscription_tier": "enterprise",
            "add_ons": {},
        }
    )
    # is_capability_enabled_for_tier -> 1
    mock_pool.fetchval = AsyncMock(return_value=1)

    allowed, current_tier, req_tier, reason = await resolve_org_entitlement(
        mock_pool, org_id, "workflows"
    )
    assert allowed is True
    assert current_tier == "enterprise"
    assert req_tier is None
    assert reason is None


@pytest.mark.asyncio
async def test_resolve_org_entitlement_denied_insufficient_tier():
    mock_pool = MagicMock()
    org_id = uuid4()

    # Org is standard, empty add-ons
    mock_pool.fetchrow = AsyncMock(
        return_value={
            "subscription_tier": "standard",
            "add_ons": {},
        }
    )

    # is_capability_enabled_for_tier -> None
    mock_pool.fetchval = AsyncMock(return_value=None)
    # get_minimum_tier_for_capability -> 'enterprise'
    mock_pool.fetch = AsyncMock(return_value=[{"tier": "enterprise"}])

    allowed, current_tier, req_tier, reason = await resolve_org_entitlement(
        mock_pool, org_id, "workflows"
    )
    assert allowed is False
    assert current_tier == "standard"
    assert req_tier == "enterprise"
    assert reason == "Capability not enabled for tier"


@pytest.mark.asyncio
async def test_resolve_org_entitlement_refused_on_null_tier():
    """F-1 / TIER-05 / D-258-06: Strict fail-closed refusal when subscription_tier is NULL."""
    mock_pool = MagicMock()
    org_id = uuid4()

    # Production condition: org has NULL subscription_tier and no add-on override
    mock_pool.fetchrow = AsyncMock(
        return_value={
            "subscription_tier": None,
            "add_ons": None,
        }
    )
    mock_pool.fetch = AsyncMock(return_value=[{"tier": "enterprise"}])

    allowed, current_tier, req_tier, reason = await resolve_org_entitlement(
        mock_pool, org_id, "workflows"
    )
    assert allowed is False
    assert current_tier is None
    assert req_tier == "enterprise"
    assert "no subscription tier assigned" in (reason or "")


@pytest.mark.asyncio
async def test_resolve_org_entitlement_refused_on_empty_whitespace_tier():
    """F-1: Empty or whitespace subscription_tier refuses access without fallback to standard."""
    mock_pool = MagicMock()
    org_id = uuid4()

    mock_pool.fetchrow = AsyncMock(
        return_value={
            "subscription_tier": "   ",
            "add_ons": {},
        }
    )
    mock_pool.fetch = AsyncMock(return_value=[{"tier": "enterprise"}])

    allowed, current_tier, req_tier, reason = await resolve_org_entitlement(
        mock_pool, org_id, "workflows"
    )
    assert allowed is False
    assert current_tier is None
    assert req_tier == "enterprise"
    assert "no subscription tier assigned" in (reason or "")


@pytest.mark.asyncio
async def test_resolve_org_entitlement_null_tier_with_addon_override():
    """D-258-08: NULL tier org still gets access if specific capability is explicitly in add_ons."""
    mock_pool = MagicMock()
    org_id = uuid4()

    mock_pool.fetchrow = AsyncMock(
        return_value={
            "subscription_tier": None,
            "add_ons": {"workflows": True},
        }
    )

    allowed, current_tier, req_tier, reason = await resolve_org_entitlement(
        mock_pool, org_id, "workflows"
    )
    assert allowed is True
    assert current_tier is None
    assert req_tier is None
    assert reason == "Granted via add_on override"


@pytest.mark.asyncio
async def test_resolve_org_entitlement_granted_by_addon_dict_override():
    mock_pool = MagicMock()
    org_id = uuid4()

    # Org is standard, but has additive add_ons dict {"workflows": True}
    mock_pool.fetchrow = AsyncMock(
        return_value={
            "subscription_tier": "standard",
            "add_ons": {"workflows": True},
        }
    )

    allowed, current_tier, req_tier, reason = await resolve_org_entitlement(
        mock_pool, org_id, "workflows"
    )
    assert allowed is True
    assert current_tier == "standard"
    assert req_tier is None
    assert reason == "Granted via add_on override"


@pytest.mark.asyncio
async def test_resolve_org_entitlement_granted_by_addon_list_override():
    mock_pool = MagicMock()
    org_id = uuid4()

    # Org is standard, add_ons is JSON string list '["workflows", "connectors"]'
    mock_pool.fetchrow = AsyncMock(
        return_value={
            "subscription_tier": "standard",
            "add_ons": json.dumps(["workflows", "connectors"]),
        }
    )

    allowed, current_tier, req_tier, reason = await resolve_org_entitlement(
        mock_pool, org_id, "workflows"
    )
    assert allowed is True
    assert current_tier == "standard"
    assert req_tier is None
    assert reason == "Granted via add_on override"


@pytest.mark.asyncio
async def test_resolve_org_entitlement_fail_closed_on_missing_org():
    mock_pool = MagicMock()
    org_id = uuid4()

    mock_pool.fetchrow = AsyncMock(return_value=None)

    allowed, current_tier, req_tier, reason = await resolve_org_entitlement(
        mock_pool, org_id, "workflows"
    )
    assert allowed is False
    assert current_tier is None
    assert req_tier is None
    assert reason == "Organization not found"


@pytest.mark.asyncio
async def test_resolve_org_entitlement_fail_closed_on_db_exception():
    mock_pool = MagicMock()
    org_id = uuid4()

    # Simulate database connection / query timeout
    mock_pool.fetchrow = AsyncMock(side_effect=RuntimeError("connection dropped"))

    allowed, current_tier, req_tier, reason = await resolve_org_entitlement(
        mock_pool, org_id, "workflows"
    )
    assert allowed is False
    assert current_tier is None
    assert req_tier is None
    assert "Database error" in (reason or "")


@pytest.mark.asyncio
async def test_resolve_org_entitlement_invalid_inputs():
    mock_pool = MagicMock()

    # Invalid capability
    allowed, _, _, reason = await resolve_org_entitlement(mock_pool, uuid4(), "")
    assert allowed is False
    assert reason == "Invalid capability"

    # Invalid org_id
    allowed, _, _, reason = await resolve_org_entitlement(mock_pool, "not-a-uuid", "workflows")
    assert allowed is False
    assert reason == "Invalid organization ID"
