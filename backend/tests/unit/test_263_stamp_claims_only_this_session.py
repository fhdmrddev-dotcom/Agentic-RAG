"""263-REVIEW.md WR-08 — the born-for stamp must claim only what this session CREATED.

WHAT WAS WRONG. ``_stamp_born_for`` was handed ``member_skills`` — the whole selected set —
and the UPDATE's only narrowing predicates were ``org_id``, ``user_id`` and
``born_for_expert_bundle_id IS NULL``. **Nothing tied a row to this authoring session.** So
every unstamped skill of the saver's that appeared anywhere in ``member_skills`` was claimed,
including rows created years earlier through ``SkillsPage`` and deliberately never shared.

THE CONSEQUENCE, concretely. Author A has a private skill ``exec-comp-benchmarks`` — never
``is_org_shared``, never through the publish gate (``PATCH /skills/{id}/toggle-global`` 409s
without eval evidence). A builds an ``org``-visibility Expert and merely TICKS that skill in
the existing-skills picker. On save it is stamped, and from then on every member of the org
resolving that Expert gets it. **A sharing decision the publish gate exists to mediate, taken
by a checkbox, with no disclosure anywhere in the UI.**

⚠ It was never a cross-org leak — ``org_id = $3`` and ``s_org_id == caller_org_id`` both hold
and both are driven. The defect is the SCOPE of an in-org widening, and its silence.

OPERATOR DECISION 2026-09-22: **narrow the claim.** The client now passes the names it
created in THIS session (``born_skills``), and only those are stamped. Migration 191's
``COMMENT ON COLUMN`` — *"NULL for every skill not born from Expert authoring"* — becomes true
as written, which it was not before.

⛔ ``born_skills`` IS REQUEST-ONLY. It is on ``ExpertBundleCreate`` / ``ExpertBundleUpdate``
and NOT on ``ExpertBundleBase``, because ``ExpertBundle`` (the response model) extends Base —
a field added there would ship back to every caller and into the persisted row. Pinned below.

⛔ AN OLD CLIENT SENDING NOTHING MUST STAMP NOTHING. That is the fail-safe direction: no
stamp means the pre-263 behaviour (resolvable by its author, stripped for everyone else),
which is degraded but never a widening. Pinned below, because the tempting "fall back to
member_skills for compatibility" would restore the exact defect.
"""

from __future__ import annotations

import inspect
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.models.expert import ExpertBundle, ExpertBundleBase, ExpertBundleCreate, ExpertBundleUpdate
from app.services import expert_service

ORG = uuid4()
USER = uuid4()
BUNDLE = uuid4()


def _create_payload(**over) -> ExpertBundleCreate:
    base = dict(name="Comp Analyst", slug="comp-analyst", member_skills=["docx", "exec-comp-benchmarks"])
    base.update(over)
    return ExpertBundleCreate(**base)


# ── the field's placement is the contract ─────────────────────────────────────────────


def test_born_skills_is_request_only_and_never_on_the_response_model():
    assert "born_skills" in ExpertBundleCreate.model_fields
    assert "born_skills" in ExpertBundleUpdate.model_fields
    assert "born_skills" not in ExpertBundleBase.model_fields, (
        "Base is extended by ExpertBundle (the RESPONSE model) — a field here ships back to "
        "every caller and into the persisted row."
    )
    assert "born_skills" not in ExpertBundle.model_fields


def test_born_skills_defaults_to_none_not_to_member_skills():
    """⛔ `None` means 'this client said nothing', which must stamp NOTHING."""
    assert _create_payload().born_skills is None


# ── create path ───────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_stamps_only_the_session_created_names():
    payload = _create_payload(born_skills=["exec-comp-benchmarks-v2"])
    with patch.object(expert_service.experts_db, "create_expert_bundle", new=AsyncMock(return_value={"id": BUNDLE})), \
         patch.object(expert_service.experts_db, "stamp_skills_born_for_bundle", new=AsyncMock(return_value=[])) as stamp:
        await expert_service.create_expert_service(pool=object(), org_id=ORG, user_id=USER, bundle_in=payload)

    stamp.assert_awaited_once()
    assert stamp.await_args.kwargs["skill_names"] == ["exec-comp-benchmarks-v2"], (
        "WR-08 regression: the stamp is claiming the whole member_skills set again."
    )


@pytest.mark.asyncio
async def test_create_with_no_born_skills_stamps_nothing():
    """The whole finding, as one call: ticking a long-standing private skill claims it."""
    payload = _create_payload()  # member_skills has two names; born_skills is None
    with patch.object(expert_service.experts_db, "create_expert_bundle", new=AsyncMock(return_value={"id": BUNDLE})), \
         patch.object(expert_service.experts_db, "stamp_skills_born_for_bundle", new=AsyncMock(return_value=[])) as stamp:
        await expert_service.create_expert_service(pool=object(), org_id=ORG, user_id=USER, bundle_in=payload)

    assert not stamp.await_count, (
        "WR-08 regression: a pre-existing private skill was claimed merely by being ticked. "
        f"Stamped: {stamp.await_args_list}"
    )


# ── update path ───────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_update_stamps_only_the_session_created_names():
    upd = ExpertBundleUpdate(member_skills=["docx", "exec-comp-benchmarks"], born_skills=["new-thing"])
    with patch.object(expert_service.experts_db, "update_expert_bundle", new=AsyncMock(return_value={"id": BUNDLE})), \
         patch.object(expert_service.experts_db, "stamp_skills_born_for_bundle", new=AsyncMock(return_value=[])) as stamp:
        await expert_service.update_expert_service(
            pool=object(), bundle_id=BUNDLE, caller_org_id=ORG, bundle_update=upd, caller_user_id=USER,
        )

    stamp.assert_awaited_once()
    assert stamp.await_args.kwargs["skill_names"] == ["new-thing"]


@pytest.mark.asyncio
async def test_update_never_forwards_born_skills_to_the_db_writer():
    """⛔ It is not a column. `update_expert_bundle`'s allowed_fields would skip it, but
    relying on that makes a request field's safety depend on a list it is not named in."""
    upd = ExpertBundleUpdate(member_skills=["docx"], born_skills=["new-thing"])
    with patch.object(expert_service.experts_db, "update_expert_bundle", new=AsyncMock(return_value={"id": BUNDLE})) as writer, \
         patch.object(expert_service.experts_db, "stamp_skills_born_for_bundle", new=AsyncMock(return_value=[])):
        await expert_service.update_expert_service(
            pool=object(), bundle_id=BUNDLE, caller_org_id=ORG, bundle_update=upd, caller_user_id=USER,
        )

    assert "born_skills" not in writer.await_args.kwargs, writer.await_args.kwargs


@pytest.mark.asyncio
async def test_update_with_no_born_skills_stamps_nothing():
    upd = ExpertBundleUpdate(member_skills=["docx", "exec-comp-benchmarks"])
    with patch.object(expert_service.experts_db, "update_expert_bundle", new=AsyncMock(return_value={"id": BUNDLE})), \
         patch.object(expert_service.experts_db, "stamp_skills_born_for_bundle", new=AsyncMock(return_value=[])) as stamp:
        await expert_service.update_expert_service(
            pool=object(), bundle_id=BUNDLE, caller_org_id=ORG, bundle_update=upd, caller_user_id=USER,
        )

    assert not stamp.await_count, stamp.await_args_list


# ── the migration comment must now be true ────────────────────────────────────────────


def test_no_stamp_call_site_passes_member_skills():
    """The source-level statement of the same rule — the two call sites read `born_skills`.

    ⛔ Named because the comfortable regression is a one-word edit that every mock above
    could still be made to pass if someone also 'fixed' the fixtures.
    """
    src = inspect.getsource(expert_service)
    assert "skill_names=bundle_in.member_skills" not in src, src[:0] or "create path reverted"
    assert 'skill_names=update_data["member_skills"]' not in src, "update path reverted"
