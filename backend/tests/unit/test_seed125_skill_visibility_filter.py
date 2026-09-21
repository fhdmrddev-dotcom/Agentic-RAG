"""SEED-125 (CR-01) — pure unit tests for the org-gated skill-visibility filter builder.

``app.utils.skill_visibility.build_skill_visibility_or`` is the single source of the corrected
PostgREST ``.or_()`` predicate applied at every service-role skill-resolution site — the six in
``tool_dispatcher`` (load_skill / read_skill_file / execute_code injection / save_skill
sibling-lint) and, since Phase 182 (CR-01), ``harness.grounding._skill_registry`` (the
``/workflows/validate`` + ``/workflows/grounding-bundle`` canvas seam). It was hoisted out of
``tool_dispatcher`` into ``app.utils.skill_visibility`` when that second consumer arrived,
because ``grounding.py`` cannot import the dispatcher (import cycle) and a copied predicate is
the drift this rule exists to prevent. These offline tests pin its shape and the two
safety-critical properties independently of a live DB (the live two-org proof lives in
tests/integration/test_v3_4_org_isolation.py):

  * FAIL-CLOSED — an empty caller org set yields ONLY ``is_system.eq.true`` (no empty
    ``in.()`` PostgREST syntax error; 0 shared cross-org — over-restrict, never over-share).
  * is_system UNIVERSAL escape — always present OUTSIDE the org gate (built-in skill-creator
    content is legitimately cross-org, mig-109 FIX-A / D-165-02).
  * ORG-GATED shared branch — the owner/is_org_shared disjunction is nested INSIDE
    ``and(org_id.in.(<orgs>), ...)`` so another org's is_org_shared skill can never match.
  * DSL hardening — every runtime value is UUID-validated via ``coerce_uid``; a malformed
    id RAISES instead of breaking out of the ``.or_()`` grammar (the service-role client has
    no RLS backstop, so this one runtime-value-into-DSL splice must be safe by construction).
"""
from __future__ import annotations

import pytest

from app.utils.skill_visibility import build_skill_visibility_or as _build_skill_visibility_or
from app.utils.skill_visibility import skill_row_visible as _skill_row_visible

_UID = "00000000-0000-0000-0000-000000000042"
_ORG_A = "11111111-1111-1111-1111-111111111111"
_ORG_B = "22222222-2222-2222-2222-222222222222"


def test_empty_org_set_is_fail_closed_system_only():
    """No resolvable caller org → ONLY is_system resolves (fail-closed, no empty in())."""
    out = _build_skill_visibility_or(_UID, set())
    assert out == "is_system.eq.true"
    assert "in.()" not in out  # never an empty IN → never a PostgREST syntax error
    assert "org_id" not in out  # no org branch at all when the caller has no org


def test_org_gated_shape_preserves_is_system_and_scopes_shared_branch():
    """Non-empty org set → is_system universal OR (org_id ∈ orgs AND (owner OR is_org_shared))."""
    out = _build_skill_visibility_or(_UID, {_ORG_A})
    # is_system escape stays OUTSIDE the org gate (leading top-level term).
    assert out.startswith("is_system.eq.true,")
    # the owner/is_org_shared disjunction is nested INSIDE the org gate.
    assert f"and(org_id.in.({_ORG_A})," in out
    assert f"or(user_id.eq.{_UID},is_org_shared.eq.true)" in out
    # a bare is_org_shared term must NOT appear outside the and(...) org gate — i.e. the
    # only is_org_shared token is the org-gated one (guards against a regressed flat filter).
    assert out.count("is_org_shared.eq.true") == 1


def test_multiple_orgs_are_sorted_and_comma_joined():
    """All of the caller's orgs are included in the in.() list (deterministic sorted order)."""
    out = _build_skill_visibility_or(_UID, {_ORG_B, _ORG_A})
    assert f"org_id.in.({_ORG_A},{_ORG_B})" in out  # sorted → A before B, deterministic


def test_malformed_ids_raise_not_inject():
    """A non-UUID caller id or org id RAISES (coerce_uid) rather than breaking the DSL."""
    with pytest.raises(ValueError):
        _build_skill_visibility_or("not-a-uuid", {_ORG_A})
    with pytest.raises(ValueError):
        _build_skill_visibility_or(_UID, {"'; drop table skills;--"})


# ---------------------------------------------------------------------------
# Phase 263 (PACK-17) — the NEGATIVE half of the born-for-Expert provenance arm.
#
# Migration 191 adds ``public.skills.born_for_expert_bundle_id``. The Expert-side
# resolver reads it as a third disjunct (D-263-06), and that arm lives in
# ``expert_service.filter_visible_skill_names`` — deliberately NOT here, because
# THIS module is the one home of the AGENT-side rule, imported by
# ``tool_dispatcher`` (five call sites) and ``harness/grounding.py``. Widening it
# here would widen skill resolution for the agent loop and for workflow grounding,
# which is the exact shape of SEED-125.
#
# So the property these cases pin is an ABSENCE: a row carrying the new column,
# even with the most privileged value it can hold, must be exactly as invisible
# cross-org as it was before the column existed. BOTH encodings are driven, because
# this module's own docstring says they MUST agree and a post-filter looser than the
# query re-opens the leak the moment the query is bypassed, degraded, or widened.
# ---------------------------------------------------------------------------

_BUNDLE = "33333333-3333-3333-3333-333333333333"
_OTHER_USER = "99999999-9999-9999-9999-999999999999"


def test_born_for_marker_does_not_widen_cross_org_visibility_query_encoding():
    """The pushed-down predicate names no provenance column at all — by design."""
    out = _build_skill_visibility_or(_UID, {_ORG_A})
    assert "born_for_expert_bundle_id" not in out
    # the org gate is still the only thing wrapping the owner/shared disjunction
    assert f"and(org_id.in.({_ORG_A})," in out
    assert out.count("is_org_shared.eq.true") == 1


def test_born_for_marker_does_not_widen_cross_org_visibility_row_encoding():
    """A foreign-org row carrying the marker AND is_org_shared is still invisible.

    This is the maximally-privileged combination the Phase 263 feature can express.
    On the AGENT-side axis it must change nothing: the org gate rejects the row before
    any provenance could be considered, and provenance is not considered here at all.
    """
    foreign_marked = {
        "is_system": False,
        "org_id": _ORG_B,
        "user_id": _OTHER_USER,
        "is_org_shared": True,
        "born_for_expert_bundle_id": _BUNDLE,
    }
    assert _skill_row_visible(foreign_marked, caller_id=_UID, org_ids={_ORG_A}) is False

    # ...and the SAME row WITHOUT the column is equally invisible. Adding the column
    # changed nothing on this axis, which is the whole claim — an assertion about the
    # marked row alone could not distinguish "still closed" from "never open".
    unmarked = dict(foreign_marked)
    unmarked.pop("born_for_expert_bundle_id")
    assert _skill_row_visible(unmarked, caller_id=_UID, org_ids={_ORG_A}) is False


def test_born_for_marker_does_not_admit_another_users_private_same_org_skill():
    """Same org, another author, not shared, marker set -> still invisible HERE.

    ⛔ A DELIBERATE ASYMMETRY, and the reason it is safe: the Expert resolver DOES
    admit this row (D-263-06), because an Expert is a scope its author opted the skill
    into. The agent loop has no such scope, so admitting it here would hand every
    Expert-authored skill in the org to every user's ordinary chat. The two predicates
    may differ ONLY in this direction — Expert-side wider, agent-side byte-unchanged.
    """
    same_org_private_marked = {
        "is_system": False,
        "org_id": _ORG_A,
        "user_id": _OTHER_USER,
        "is_org_shared": False,
        "born_for_expert_bundle_id": _BUNDLE,
    }
    assert _skill_row_visible(same_org_private_marked, caller_id=_UID, org_ids={_ORG_A}) is False
