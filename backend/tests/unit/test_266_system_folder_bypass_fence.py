"""Phase 266-01 — D-266-10 fence: a SYSTEM_USER_ID shared folder in ANOTHER org is stripped.

Before Phase 266, ``resolve_expert_bundle`` admitted any folder owned by the seed user
``…0001`` with ``is_org_shared = true`` REGARDLESS OF ORG:

    is_system_folder = bool(f_user_id == SYSTEM_USER_ID and f_shared)

That approved scope retrieval could never read — ``match_document_chunks`` gates on
``current_user_org_ids()`` — which is SEED-304's exact shape. The bypass is deleted; a folder
is admitted only when it lives in the CALLER's org.

The bundle here is deliberately ORG-AUTHORED (``is_system`` False), so the fence exercises
the folder-admission rule alone and does not depend on the new install source for
``is_system`` bundles. It was driven RED against the pre-266 ``expert_service.py`` (1 failed)
and GREEN against the new one — recorded in 266-01-SUMMARY.md.
"""

from __future__ import annotations

import logging
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID, uuid4

import pytest

from app.services.expert_service import resolve_expert_bundle

SEED_USER = UUID("00000000-0000-0000-0000-000000000001")


@pytest.mark.asyncio
async def test_a_system_owned_shared_folder_in_another_org_is_stripped(caplog):
    org_a, org_b, user_a = uuid4(), uuid4(), uuid4()
    bundle_id = uuid4()
    foreign_system_folder = uuid4()

    bundle_row = {
        "id": bundle_id,
        "name": "Org A Expert",
        "slug": "org-a-expert",
        "description": "Org-authored bundle that names a foreign seed-user folder",
        "scope_mode": "restricted",
        "is_system": False,
        "org_id": org_a,
        "visibility": "org",
        "created_by": user_a,
        "member_skills": [],
        "knowledge_folder_ids": [foreign_system_folder],
        "required_connections": [],
        "prompt_suggestions": [],
    }

    pool = MagicMock()
    pool.fetchrow = AsyncMock(return_value=bundle_row)
    pool.fetch = AsyncMock(
        side_effect=[
            # folder_rows: owned by the seed user, shared — but in ORG B, not the caller's.
            [{"id": foreign_system_folder, "org_id": org_b, "user_id": SEED_USER,
              "is_org_shared": True}],
        ]
    )

    with caplog.at_level(logging.WARNING):
        resolved = await resolve_expert_bundle(pool, bundle_id, org_a, user_a)

    assert resolved is not None
    # RED on the pre-266 rule: `is_system_folder` admitted this folder into org A's scope.
    assert resolved.effective_folder_ids == []
    assert resolved.stripped_details == [f"folder:{foreign_system_folder}"]
    assert "EXPERT_MEMBER_CROSS_ORG_STRIPPED" in caplog.text


@pytest.mark.asyncio
async def test_positive_control_same_seed_owned_shared_folder_in_the_callers_org_is_admitted():
    """Non-vacuity: the fence above strips on ORG, not on the seed owner. The same shape in
    the caller's own org is admitted, so a resolver that stripped everything cannot pass."""
    org_a, user_a, bundle_id, folder = uuid4(), uuid4(), uuid4(), uuid4()
    bundle_row = {
        "id": bundle_id, "name": "Org A Expert", "slug": "org-a-expert", "description": "",
        "scope_mode": "restricted", "is_system": False, "org_id": org_a, "visibility": "org",
        "created_by": user_a, "member_skills": [], "knowledge_folder_ids": [folder],
        "required_connections": [], "prompt_suggestions": [],
    }
    pool = MagicMock()
    pool.fetchrow = AsyncMock(return_value=bundle_row)
    pool.fetch = AsyncMock(side_effect=[
        [{"id": folder, "org_id": org_a, "user_id": SEED_USER, "is_org_shared": True}],
    ])

    resolved = await resolve_expert_bundle(pool, bundle_id, org_a, user_a)

    assert resolved is not None
    assert resolved.effective_folder_ids == [folder]
    assert resolved.stripped_members_count == 0
