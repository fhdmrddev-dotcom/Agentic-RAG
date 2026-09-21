"""Phase 263 (PACK-16 precondition / PACK-17) — the born-for-Expert skill provenance arm.

WHY THIS FILE EXISTS. Before Phase 263 an Expert authored for an org was HOLLOW for every
org member except the person who happened to create its skills: ``resolve_expert_bundle``'s
phase-2 skill predicate admitted a non-system skill only when
``user_id == caller OR is_org_shared``, so a private skill written while authoring an Expert
resolved for its author and for nobody else. Migration 191 adds
``public.skills.born_for_expert_bundle_id`` and this suite drives the THIRD disjunct that
reads it (D-263-06).

THE NARROWNESS IS THE POINT (D-263-07). The marker is not a capability — it is a scope. A
skill born for Expert A must resolve through Expert A and through NOTHING else:

  * a DIFFERENT bundle's marker  -> stripped
  * a NULL marker (abandoned draft, or any ordinary library skill) -> stripped
  * a FOREIGN ORG's row, even carrying the maximally-privileged combination
    (``born_for_expert_bundle_id == this bundle`` AND ``is_org_shared = True``) -> stripped

That last case is PACK-17 driven against the NEW arm rather than against the old predicate,
because widening an isolation predicate is exactly how ``SEED-125`` would recur. The arm
lands INSIDE the existing ``s_org_id == caller_org_id and s_enabled`` parenthesis, so the org
fence is above it BY CONSTRUCTION; ``test_red_drive_placement`` in 263-01's SUMMARY records
the planted top-level-``elif`` that turns this case RED.

THE ``None == None`` TRAP (T-263-02). ``filter_visible_skill_names`` is also the save-time
fence 263-03 calls, and at save time no bundle exists yet, so it is called with
``bundle_id=None``. Every unstamped skill row carries ``born_for_expert_bundle_id = None``.
A bare ``==`` would then evaluate ``None == None`` to True and admit EVERY OTHER USER'S
PRIVATE SKILL in the org — a privilege widening the save-time fence would ship silently.
``test_bundle_id_none_does_not_admit_unstamped_foreign_row`` is that trap's drive.

Mock-pool scaffolding (``MagicMock`` pool, ``fetchrow`` returning the bundle row, ``fetch``
with an ORDERED ``side_effect`` list) is copied from
``test_259_expert_member_isolation.py``. The ordering matters: omitting the folder/connection
lists fails inside ``resolve_expert_bundle`` rather than at the assertion.
"""

from __future__ import annotations

import logging
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from app.db.experts import stamp_skills_born_for_bundle
from app.services.expert_service import (
    filter_visible_skill_names,
    resolve_expert_bundle,
)


def _bundle_row(bundle_id, org_id, user_id, member_skills):
    """A production-shaped expert_bundles row (Phase 261 F-1: visibility + created_by are NOT NULL)."""
    return {
        "id": bundle_id,
        "name": "Born-For Expert",
        "slug": "born-for-expert",
        "description": "Bundle whose skills were authored for it",
        "scope_mode": "restricted",
        "is_system": False,
        "org_id": org_id,
        "visibility": "org",
        "created_by": user_id,
        "member_skills": member_skills,
        "knowledge_folder_ids": [],
        "required_connections": [],
        "prompt_suggestions": [],
    }


@pytest.mark.asyncio
async def test_born_for_skill_resolves_for_another_org_member():
    """D-263-06: a private skill born for THIS bundle resolves for any member of the same org.

    The row is owned by ANOTHER user and is NOT org-shared — under the pre-263 predicate it
    was stripped, which is the hollowness this phase closes.
    """
    mock_pool = MagicMock()
    org_a = uuid4()
    user_a = uuid4()   # the caller — a second member of org A
    user_b = uuid4()   # the Expert's author
    bundle_id = uuid4()

    mock_pool.fetchrow = AsyncMock(
        return_value=_bundle_row(bundle_id, org_a, user_b, ["born_for_this_expert"])
    )
    mock_pool.fetch = AsyncMock(
        side_effect=[
            [
                {
                    "name": "born_for_this_expert",
                    "is_system": False,
                    "org_id": org_a,
                    "user_id": user_b,
                    "is_org_shared": False,
                    "is_enabled": True,
                    "born_for_expert_bundle_id": bundle_id,
                },
            ],
        ]
    )

    resolved = await resolve_expert_bundle(mock_pool, bundle_id, org_a, user_a)

    assert resolved is not None
    assert resolved.effective_skills == ["born_for_this_expert"]
    assert resolved.stripped_members_count == 0
    assert resolved.stripped_details == []


@pytest.mark.asyncio
async def test_born_for_a_different_bundle_is_stripped(caplog):
    """D-263-07 narrowness: the marker scopes to ONE bundle, so another bundle's mark is foreign."""
    mock_pool = MagicMock()
    org_a = uuid4()
    user_a = uuid4()
    user_b = uuid4()
    bundle_id = uuid4()
    other_bundle_id = uuid4()

    mock_pool.fetchrow = AsyncMock(
        return_value=_bundle_row(bundle_id, org_a, user_b, ["born_for_other_expert"])
    )
    mock_pool.fetch = AsyncMock(
        side_effect=[
            [
                {
                    "name": "born_for_other_expert",
                    "is_system": False,
                    "org_id": org_a,
                    "user_id": user_b,
                    "is_org_shared": False,
                    "is_enabled": True,
                    "born_for_expert_bundle_id": other_bundle_id,
                },
            ],
        ]
    )

    with caplog.at_level(logging.WARNING):
        resolved = await resolve_expert_bundle(mock_pool, bundle_id, org_a, user_a)

    assert resolved is not None
    assert resolved.effective_skills == []
    assert "born_for_other_expert" not in resolved.effective_skills
    assert resolved.stripped_members_count == 1
    assert "skill:born_for_other_expert" in resolved.stripped_details
    assert "EXPERT_MEMBER_CROSS_ORG_STRIPPED" in caplog.text


@pytest.mark.asyncio
async def test_null_marker_is_stripped_no_regression(caplog):
    """D-263-08: an abandoned draft / ordinary library skill keeps NULL and behaves exactly as today."""
    mock_pool = MagicMock()
    org_a = uuid4()
    user_a = uuid4()
    user_b = uuid4()
    bundle_id = uuid4()

    mock_pool.fetchrow = AsyncMock(
        return_value=_bundle_row(bundle_id, org_a, user_b, ["unstamped_private_skill"])
    )
    mock_pool.fetch = AsyncMock(
        side_effect=[
            [
                {
                    "name": "unstamped_private_skill",
                    "is_system": False,
                    "org_id": org_a,
                    "user_id": user_b,
                    "is_org_shared": False,
                    "is_enabled": True,
                    "born_for_expert_bundle_id": None,
                },
            ],
        ]
    )

    with caplog.at_level(logging.WARNING):
        resolved = await resolve_expert_bundle(mock_pool, bundle_id, org_a, user_a)

    assert resolved is not None
    assert resolved.effective_skills == []
    assert resolved.stripped_members_count == 1
    assert "skill:unstamped_private_skill" in resolved.stripped_details
    assert "EXPERT_MEMBER_CROSS_ORG_STRIPPED" in caplog.text


@pytest.mark.asyncio
async def test_cross_org_row_with_matching_marker_is_still_stripped(caplog):
    """PACK-17 / T-263-01 — the org fence sits ABOVE the new arm, structurally.

    The row carries the MAXIMALLY PRIVILEGED combination the new feature can express:
    ``born_for_expert_bundle_id`` equals this very bundle AND ``is_org_shared`` is True.
    It belongs to another org, so it is stripped anyway. A top-level ``elif`` placement of
    the arm makes exactly THIS case go red and no other — which is why the RED drive plants
    that placement rather than deleting the arm.
    """
    mock_pool = MagicMock()
    org_a = uuid4()
    org_b = uuid4()
    user_a = uuid4()
    bundle_id = uuid4()

    mock_pool.fetchrow = AsyncMock(
        return_value=_bundle_row(bundle_id, org_a, user_a, ["org_b_marked_skill"])
    )
    mock_pool.fetch = AsyncMock(
        side_effect=[
            [
                {
                    "name": "org_b_marked_skill",
                    "is_system": False,
                    "org_id": org_b,
                    "user_id": uuid4(),
                    "is_org_shared": True,
                    "is_enabled": True,
                    "born_for_expert_bundle_id": bundle_id,
                },
            ],
        ]
    )

    with caplog.at_level(logging.WARNING):
        resolved = await resolve_expert_bundle(mock_pool, bundle_id, org_a, user_a)

    assert resolved is not None
    assert resolved.effective_skills == []
    assert "org_b_marked_skill" not in resolved.effective_skills
    assert resolved.stripped_members_count == 1
    assert "skill:org_b_marked_skill" in resolved.stripped_details
    assert "EXPERT_MEMBER_CROSS_ORG_STRIPPED" in caplog.text


@pytest.mark.asyncio
async def test_disabled_born_for_skill_is_stripped():
    """``is_enabled`` sits inside the same fence as ``org_id`` — the new arm does not bypass it."""
    mock_pool = MagicMock()
    org_a = uuid4()
    user_a = uuid4()
    user_b = uuid4()
    bundle_id = uuid4()

    mock_pool.fetchrow = AsyncMock(
        return_value=_bundle_row(bundle_id, org_a, user_b, ["disabled_born_skill"])
    )
    mock_pool.fetch = AsyncMock(
        side_effect=[
            [
                {
                    "name": "disabled_born_skill",
                    "is_system": False,
                    "org_id": org_a,
                    "user_id": user_b,
                    "is_org_shared": False,
                    "is_enabled": False,
                    "born_for_expert_bundle_id": bundle_id,
                },
            ],
        ]
    )

    resolved = await resolve_expert_bundle(mock_pool, bundle_id, org_a, user_a)

    assert resolved is not None
    assert resolved.effective_skills == []
    assert resolved.stripped_members_count == 1


@pytest.mark.asyncio
async def test_resolve_query_selects_the_marker_column():
    """⛔ The half most likely to be missed: the SELECT must fetch the new column.

    The predicate is Python over rows already fetched. With ``row.get()`` and an unwidened
    SELECT the feature silently does nothing AND every pre-263 test still passes — the bug
    signature is 'case 1 fails, cases 2-4 pass'. This pins the column list itself.
    """
    mock_pool = MagicMock()
    org_a = uuid4()
    user_a = uuid4()
    bundle_id = uuid4()

    mock_pool.fetchrow = AsyncMock(
        return_value=_bundle_row(bundle_id, org_a, user_a, ["any_skill"])
    )
    mock_pool.fetch = AsyncMock(side_effect=[[]])

    await resolve_expert_bundle(mock_pool, bundle_id, org_a, user_a)

    skill_query = mock_pool.fetch.call_args_list[0].args[0]
    assert "born_for_expert_bundle_id" in skill_query
    assert "FROM public.skills" in skill_query


@pytest.mark.asyncio
async def test_bundle_id_none_does_not_admit_unstamped_foreign_row():
    """T-263-02 — the ``None == None`` trap, driven directly against the save-time call shape.

    263-03 calls this helper with ``bundle_id=None`` because at save time the bundle does not
    exist yet. Every unstamped row carries ``born_for_expert_bundle_id = None``. Without the
    ``bundle_id is not None`` guard the third arm evaluates ``None == None`` -> True and the
    save-time fence admits every other user's private skill in the org.
    """
    mock_pool = MagicMock()
    org_a = uuid4()
    user_a = uuid4()
    user_b = uuid4()

    mock_pool.fetch = AsyncMock(
        return_value=[
            {
                "name": "someone_elses_private_skill",
                "is_system": False,
                "org_id": org_a,
                "user_id": user_b,
                "is_org_shared": False,
                "is_enabled": True,
                "born_for_expert_bundle_id": None,
            },
        ]
    )

    visible = await filter_visible_skill_names(
        mock_pool,
        ["someone_elses_private_skill"],
        org_a,
        user_a,
        bundle_id=None,
    )

    assert visible == set()


@pytest.mark.asyncio
async def test_filter_visible_skill_names_admits_own_and_shared_and_system():
    """The extracted helper holds the WHOLE predicate — the three pre-263 arms still pass."""
    mock_pool = MagicMock()
    org_a = uuid4()
    org_b = uuid4()
    user_a = uuid4()
    user_b = uuid4()

    mock_pool.fetch = AsyncMock(
        return_value=[
            {"name": "sys", "is_system": True, "org_id": None, "user_id": None,
             "is_org_shared": False, "is_enabled": True, "born_for_expert_bundle_id": None},
            {"name": "mine", "is_system": False, "org_id": org_a, "user_id": user_a,
             "is_org_shared": False, "is_enabled": True, "born_for_expert_bundle_id": None},
            {"name": "shared", "is_system": False, "org_id": org_a, "user_id": user_b,
             "is_org_shared": True, "is_enabled": True, "born_for_expert_bundle_id": None},
            {"name": "foreign_shared", "is_system": False, "org_id": org_b, "user_id": user_b,
             "is_org_shared": True, "is_enabled": True, "born_for_expert_bundle_id": None},
        ]
    )

    visible = await filter_visible_skill_names(
        mock_pool, ["sys", "mine", "shared", "foreign_shared"], org_a, user_a
    )

    assert visible == {"sys", "mine", "shared"}


@pytest.mark.asyncio
async def test_filter_visible_skill_names_empty_input_short_circuits():
    """No names -> no query. A DB round trip for an empty list is pure waste."""
    mock_pool = MagicMock()
    mock_pool.fetch = AsyncMock(return_value=[])

    visible = await filter_visible_skill_names(mock_pool, [], uuid4(), uuid4())

    assert visible == set()
    mock_pool.fetch.assert_not_awaited()


@pytest.mark.asyncio
async def test_stamp_skills_born_for_bundle_sql_and_argument_order():
    """T-263-03 — all four WHERE predicates present, arguments bound positionally in order.

    Each predicate is load-bearing and is asserted individually rather than as one blob:
      * ``org_id = $3``  — a foreign-org row cannot be stamped (the stamp IS a privilege
        grant under D-263-06).
      * ``user_id = $4`` — another author's pre-existing row cannot be conscripted.
      * ``born_for_expert_bundle_id IS NULL`` — D-263-07's rejection of re-stamping; at two
        bundles the FIRST Expert would otherwise silently lose the skill.
    """
    mock_pool = MagicMock()
    bundle_id = uuid4()
    org_id = uuid4()
    user_id = uuid4()

    mock_pool.fetch = AsyncMock(return_value=[{"name": "alpha"}])

    stamped = await stamp_skills_born_for_bundle(
        mock_pool,
        bundle_id=bundle_id,
        skill_names=["alpha", "beta"],
        org_id=org_id,
        user_id=user_id,
    )

    assert stamped == ["alpha"]

    call = mock_pool.fetch.call_args
    sql = call.args[0]
    assert "UPDATE public.skills" in sql
    assert "born_for_expert_bundle_id = $1" in sql
    assert "name = ANY($2::text[])" in sql
    assert "org_id = $3" in sql
    assert "user_id = $4" in sql
    assert "born_for_expert_bundle_id IS NULL" in sql
    assert "RETURNING name" in sql
    # ⛔ numbered parameters, never f-string interpolation of a runtime value
    assert str(org_id) not in sql
    assert str(user_id) not in sql

    assert call.args[1:] == (bundle_id, ["alpha", "beta"], org_id, user_id)


@pytest.mark.asyncio
async def test_stamp_skills_born_for_bundle_empty_names_short_circuits():
    """An Expert saved with no skills must not issue an UPDATE at all."""
    mock_pool = MagicMock()
    mock_pool.fetch = AsyncMock(return_value=[])

    stamped = await stamp_skills_born_for_bundle(
        mock_pool,
        bundle_id=uuid4(),
        skill_names=[],
        org_id=uuid4(),
        user_id=uuid4(),
    )

    assert stamped == []
    mock_pool.fetch.assert_not_awaited()
