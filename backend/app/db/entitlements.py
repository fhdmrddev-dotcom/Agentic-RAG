from __future__ import annotations

import json
import logging
from typing import Any
from uuid import UUID

import asyncpg

logger = logging.getLogger(__name__)

TIER_ORDER = {
    "standard": 1,
    "pro": 2,
    "enterprise": 3,
}


async def get_tier_capabilities(
    pool: asyncpg.Pool, tier: str
) -> set[str]:
    """Return all active capability keys enabled for a given subscription tier.

    Reads from public.tier_capabilities where enabled = true.
    """
    normalized_tier = (tier or "").strip().lower()
    if not normalized_tier:
        return set()

    query = """
        SELECT capability
        FROM public.tier_capabilities
        WHERE tier = $1 AND enabled = true;
    """
    rows = await pool.fetch(query, normalized_tier)
    return {r["capability"] for r in rows}


async def is_capability_enabled_for_tier(
    pool: asyncpg.Pool, tier: str, capability: str
) -> bool:
    """Check if a specific capability is enabled for a given subscription tier.

    Returns True if an enabled row exists in public.tier_capabilities.
    """
    normalized_tier = (tier or "").strip().lower()
    normalized_cap = (capability or "").strip().lower()
    if not normalized_tier or not normalized_cap:
        return False

    query = """
        SELECT 1
        FROM public.tier_capabilities
        WHERE tier = $1 AND capability = $2 AND enabled = true
        LIMIT 1;
    """
    val = await pool.fetchval(query, normalized_tier, normalized_cap)
    return val is not None


async def get_minimum_tier_for_capability(
    pool: asyncpg.Pool, capability: str
) -> str | None:
    """Return the lowest subscription tier that enables the requested capability.

    Ordered by standard -> pro -> enterprise.
    """
    normalized_cap = (capability or "").strip().lower()
    if not normalized_cap:
        return None

    query = """
        SELECT tier
        FROM public.tier_capabilities
        WHERE capability = $1 AND enabled = true
        ORDER BY
            CASE tier
                WHEN 'standard' THEN 1
                WHEN 'pro' THEN 2
                WHEN 'enterprise' THEN 3
                ELSE 4
            END ASC
        LIMIT 1;
    """
    val = await pool.fetchval(query, normalized_cap)
    return val


def _has_addon_capability(add_ons: Any, capability: str) -> bool:
    """Inspect add_ons jsonb (dict or list) for capability grant."""
    if not add_ons:
        return False

    data = add_ons
    if isinstance(data, str):
        try:
            data = json.loads(data)
        except Exception:
            return False

    if isinstance(data, list):
        return capability in data

    if isinstance(data, dict):
        val = data.get(capability)
        return bool(val)

    return False


async def resolve_org_entitlement(
    pool: asyncpg.Pool, org_id: str | UUID, capability: str
) -> tuple[bool, str | None, str | None, str | None]:
    """Resolve whether an organization is entitled to a capability.

    Returns:
        (is_entitled, current_tier, required_tier, reason)

    Guarantees:
        - Strict fail-closed: unresolvable org, missing row, or database exception
          returns (False, None, None, error_detail).
        - Additive override: organizations.add_ons grants access even if base tier
          does not include the capability (D-258-08).
        - Dynamic repackaging: queries public.tier_capabilities as data without
          hardcoded branches (TIER-02).
    """
    normalized_cap = (capability or "").strip().lower()
    if not normalized_cap:
        return False, None, None, "Invalid capability"

    # Coerce org_id to UUID
    try:
        org_uuid = org_id if isinstance(org_id, UUID) else UUID(str(org_id))
    except (ValueError, TypeError) as err:
        logger.warning("Invalid org_id '%s' for entitlement check: %s", org_id, err)
        return False, None, None, "Invalid organization ID"

    try:
        query = """
            SELECT subscription_tier, add_ons
            FROM public.organizations
            WHERE id = $1;
        """
        row = await pool.fetchrow(query, org_uuid)
        if not row:
            return False, None, None, "Organization not found"

        raw_tier = row["subscription_tier"]
        current_tier = (raw_tier or "").strip().lower() or "standard"
        add_ons = row["add_ons"]

        # Check additive add-ons override first (D-258-08)
        if _has_addon_capability(add_ons, normalized_cap):
            return True, current_tier, None, "Granted via add_on override"

        # Check base tier capabilities from relational table (TIER-02)
        is_enabled = await is_capability_enabled_for_tier(pool, current_tier, normalized_cap)
        if is_enabled:
            return True, current_tier, None, None

        # Resolve lowest required tier for upgrade guidance (TIER-03)
        required_tier = await get_minimum_tier_for_capability(pool, normalized_cap)
        return False, current_tier, required_tier or "enterprise", "Capability not enabled for tier"

    except Exception as err:
        logger.exception("Database error during entitlement resolution for org %s: %s", org_id, err)
        return False, None, None, f"Database error: {err}"
