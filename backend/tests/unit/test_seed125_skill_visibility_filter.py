"""SEED-125 (CR-01) — pure unit tests for the org-gated skill-visibility filter builder.

``tool_dispatcher._build_skill_visibility_or`` is the single source of the corrected
PostgREST ``.or_()`` predicate applied at all six service-role skill-resolution sites
(load_skill / read_skill_file / execute_code injection / save_skill sibling-lint). These
offline tests pin its shape and the two safety-critical properties independently of a live
DB (the live two-org proof lives in tests/integration/test_v3_4_org_isolation.py):

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

from app.services.tool_dispatcher import _build_skill_visibility_or

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
