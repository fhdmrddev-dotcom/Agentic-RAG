"""Phase 182 (CR-01) — the grounding skill registry is ORG-GATED, not just owner-scoped.

`grounding._skill_registry` runs on the **service-role** (BYPASSRLS) client, so the in-app
predicate IS the only tenant gate. Its pre-182 filter — `.or_(user_id.eq.<caller>,
is_org_shared.eq.true)` plus a matching Python post-filter — carried NO org term, so it matched
**every** org's `is_org_shared` skill. Consequences, both on the brand-new canvas surface:
`GET /workflows/grounding-bundle` handed a caller another org's skill rows, and
`POST /workflows/validate` reported a foreign-org `skill_ref` as grounded. That is verbatim the
leak SEED-125 closed at the six `tool_dispatcher` resolution sites.

This file is the falsification backstop for the fix. Every test here FAILS against the old
predicate/post-filter pair (verified by reverting them before trusting the tests), and they
attack the gate from all four directions a refactor-only "fix" would pass:

  1. THE QUERY — the pushed-down `.or_()` is the org-gated shape, not the legacy flat one.
  2. THE POST-FILTER — a foreign-org `is_org_shared` row is rejected IN PYTHON even when the
     query hands it over anyway. This is the load-bearing test: the post-filter was an
     independent copy of the rule and had the identical hole, so a fix that only changed the
     query would still leak the moment the DB filter is bypassed, degraded or widened.
  3. FAIL-CLOSED — an unresolvable caller org set yields ONLY `is_system` skills, never "all".
  4. END-TO-END — the foreign-org skill is absent from the real `/grounding-bundle` response,
     and its id is absent from `bundle.skill_ids` (the set `/validate`'s fidelity rule 3 tests
     `skill_ref` against, i.e. the half that decides "is this reference valid").

Runs fully OFFLINE: a per-table fake Supabase client, no live DB, no provider call.
CONVENTION (Phase 102 posture): imports inside the test bodies; every boundary faked.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

# The caller: conftest's canonical mock identity, which `_inject_caller` also injects.
_CALLER = "00000000-0000-0000-0000-000000000001"
_ORG_MINE = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
_ORG_THEIRS = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
_OTHER_USER = "cccccccc-cccc-cccc-cccc-cccccccccccc"

_MY_SKILL = {
    "id": "11111111-1111-1111-1111-111111111111",
    "name": "My Own Skill",
    "user_id": _CALLER,
    "is_org_shared": False,
    "is_system": False,
    "org_id": _ORG_MINE,
    "is_enabled": True,
}
_IN_ORG_SHARED = {
    "id": "22222222-2222-2222-2222-222222222222",
    "name": "Shared In My Org",
    "user_id": _OTHER_USER,
    "is_org_shared": True,
    "is_system": False,
    "org_id": _ORG_MINE,
    "is_enabled": True,
}
# THE LEAK: another tenant's shared skill. Pre-182 this matched on `is_org_shared` alone.
_FOREIGN_ORG_SHARED = {
    "id": "33333333-3333-3333-3333-333333333333",
    "name": "Foreign Org Secret Skill",
    "user_id": _OTHER_USER,
    "is_org_shared": True,
    "is_system": False,
    "org_id": _ORG_THEIRS,
    "is_enabled": True,
}
_SYSTEM_SKILL = {
    "id": "44444444-4444-4444-4444-444444444444",
    "name": "skill-creator",
    "user_id": _OTHER_USER,
    "is_org_shared": False,
    "is_system": True,
    "org_id": _ORG_THEIRS,  # a system skill is cross-org BY DESIGN (the universal escape)
    "is_enabled": True,
}

_ALL_ROWS = [_MY_SKILL, _IN_ORG_SHARED, _FOREIGN_ORG_SHARED, _SYSTEM_SKILL]


class _Query:
    """A fluent supabase-py query stand-in that records the filter it was handed.

    Deliberately IGNORES the recorded `.or_()` when returning rows: it always yields the full
    `rows` set. That is the point — it simulates a service-role read whose pushed-down filter
    did nothing, which is precisely the condition under which the in-Python post-filter is the
    last line of defense.
    """

    def __init__(self, rows):
        self._rows = rows
        self.or_arg: str | None = None
        self.selected: str | None = None

    def select(self, cols="*", *a, **k):
        self.selected = cols
        return self

    def eq(self, *a, **k):
        return self

    def or_(self, expr):
        self.or_arg = expr
        return self

    def execute(self):
        return SimpleNamespace(data=list(self._rows))


class _FakeSupabase:
    """Per-table fake: `.table(name)` returns that table's recorder (created on demand)."""

    def __init__(self, **tables):
        self.tables = {name: _Query(rows) for name, rows in tables.items()}

    def table(self, name):
        return self.tables.setdefault(name, _Query([]))


def _org_member_rows(*org_ids):
    """`org_members` rows as `_resolve_caller_org_ids` reads them (`.select("org_id")`)."""
    return [{"org_id": o} for o in org_ids]


# ── 1) the QUERY: the pushed-down predicate is org-gated, not the legacy flat filter ──


def test_skill_registry_pushes_down_the_org_gated_predicate():
    """The `.or_()` handed to PostgREST is the org-gated shape (CR-01).

    Pins the two properties that distinguish the fix from the leak: the shared branch is
    NESTED inside an `and(org_id.in.(...))` gate, and the legacy flat
    `user_id.eq.<caller>,is_org_shared.eq.true` predicate is gone.
    """
    from app.services.harness.grounding import _skill_registry

    sb = _FakeSupabase(skills=_ALL_ROWS)
    _skill_registry(sb, _CALLER, {_ORG_MINE})

    sent = sb.tables["skills"].or_arg
    assert sent is not None, "no .or_() filter was pushed down at all"
    # the org gate exists and the owner/shared disjunction lives INSIDE it
    assert f"and(org_id.in.({_ORG_MINE})," in sent, sent
    assert f"or(user_id.eq.{_CALLER},is_org_shared.eq.true)" in sent, sent
    # the legacy un-gated predicate must NOT be what we send
    assert sent != f"user_id.eq.{_CALLER},is_org_shared.eq.true"
    # exactly one is_org_shared term, and it is the org-gated one (no bare flat term)
    assert sent.count("is_org_shared.eq.true") == 1, sent
    # the post-filter needs these columns, so the select must carry them
    selected = sb.tables["skills"].selected or ""
    assert "org_id" in selected and "is_system" in selected, selected


# ── 2) the POST-FILTER: rejects a foreign-org row even when the query hands it over ──


def test_post_filter_rejects_foreign_org_shared_skill():
    """THE CR-01 PROOF. A disjoint-org `is_org_shared` skill is NOT returned (CR-01).

    The fake client returns ALL rows regardless of the filter, so this isolates the in-Python
    post-filter — the copy of the rule that had the identical hole. Against the pre-182
    post-filter (`user_id == caller or is_org_shared`) the foreign row PASSES and this fails.
    """
    from app.services.harness.grounding import _skill_registry

    sb = _FakeSupabase(skills=_ALL_ROWS)
    out = _skill_registry(sb, _CALLER, {_ORG_MINE})

    ids = {r["id"] for r in out}
    assert _FOREIGN_ORG_SHARED["id"] not in ids, (
        "another org's is_org_shared skill is visible to a disjoint-org caller — the CR-01 "
        "cross-org skill leak is OPEN"
    )
    assert "Foreign Org Secret Skill" not in {r.get("name") for r in out}
    # ...while everything legitimately visible still resolves (not an over-restriction):
    assert _MY_SKILL["id"] in ids  # owned, in-org
    assert _IN_ORG_SHARED["id"] in ids  # someone else's, shared, IN my org
    assert _SYSTEM_SKILL["id"] in ids  # is_system — universal escape, outside the org gate


def test_disabled_skills_are_still_excluded():
    """The org gate did not displace the `is_enabled` filter (regression guard)."""
    from app.services.harness.grounding import _skill_registry

    disabled = {**_IN_ORG_SHARED, "id": "55555555-5555-5555-5555-555555555555", "is_enabled": False}
    sb = _FakeSupabase(skills=[_MY_SKILL, disabled])
    ids = {r["id"] for r in _skill_registry(sb, _CALLER, {_ORG_MINE})}

    assert disabled["id"] not in ids
    assert _MY_SKILL["id"] in ids


# ── 3) FAIL-CLOSED: no resolvable org -> is_system only, never "everything" ────


def test_empty_org_set_is_fail_closed_to_system_only():
    """An unresolvable caller org set over-restricts; it never over-shares (CR-01)."""
    from app.services.harness.grounding import _skill_registry

    sb = _FakeSupabase(skills=_ALL_ROWS)
    out = _skill_registry(sb, _CALLER, set())

    assert {r["id"] for r in out} == {_SYSTEM_SKILL["id"]}, (
        "an empty caller org set must resolve ONLY is_system skills"
    )
    # and the pushed-down filter never emits an empty in.() (a PostgREST syntax error)
    assert sb.tables["skills"].or_arg == "is_system.eq.true"
    assert "in.()" not in (sb.tables["skills"].or_arg or "")


def test_read_failure_fails_closed_to_empty():
    """A read failure yields [] — never a widened scope (the documented posture)."""
    from app.services.harness.grounding import _skill_registry

    class _Boom(_FakeSupabase):
        def table(self, name):
            raise RuntimeError("postgrest is down")

    assert _skill_registry(_Boom(), _CALLER, {_ORG_MINE}) == []


def test_malformed_caller_id_raises_instead_of_breaking_the_dsl():
    """A non-UUID identity RAISES (coerce_uid) rather than being spliced into the `.or_()`.

    On the service-role client that predicate is the only owner gate, so a DSL breakout has no
    RLS backstop. Pre-182 the id was interpolated raw with an f-string.
    """
    from app.services.harness.grounding import _skill_registry

    with pytest.raises(ValueError):
        _skill_registry(_FakeSupabase(skills=_ALL_ROWS), "not-a-uuid", {_ORG_MINE})


# ── 4) END-TO-END: through the real assembler and the real palette route ──────


@pytest.mark.asyncio
async def test_bundle_skill_ids_exclude_the_foreign_org_skill():
    """`assemble_grounding_bundle` threads the org set through, so `skill_ids` is gated.

    `skill_ids` is the set `/validate`'s fidelity rule 3 tests `skill_ref` membership against,
    so this is the assertion that stops the seam from telling an author a cross-tenant
    reference is valid.
    """
    from app.services.harness.grounding import assemble_grounding_bundle

    sb = _FakeSupabase(
        skills=_ALL_ROWS,
        org_members=_org_member_rows(_ORG_MINE),
        folders=[],
    )
    bundle = await assemble_grounding_bundle(supabase=sb, user_id=_CALLER)

    assert _FOREIGN_ORG_SHARED["id"] not in bundle.skill_ids, (
        "/validate would ground a foreign-org skill_ref as valid — CR-01 is OPEN"
    )
    assert _IN_ORG_SHARED["id"] in bundle.skill_ids
    assert _MY_SKILL["id"] in bundle.skill_ids
    # the org gate was genuinely resolved from org_members, not defaulted
    assert sb.tables["org_members"].selected == "org_id"


def test_grounding_bundle_route_omits_the_foreign_org_skill(client, monkeypatch):
    """The live palette response carries no foreign-org skill (CR-01 + CR-02 together).

    Drives the REAL route + REAL assembler with the canvas flag on, against a fake client whose
    `skills` table returns all four rows. Mirrors `test_182_grounding_bundle.py`'s `_flipped_on`
    + `_inject_caller` seams (each 18x file defines its own, per the established pattern).
    """
    import app.dependencies as deps
    from app.dependencies import get_supabase
    from app.main import app
    from app.models import user_settings as us

    monkeypatch.setattr(
        us,
        "load_app_settings",
        lambda: SimpleNamespace(
            feature_visibility={"visual_workflow_canvas": {"audience": "everyone"}}
        ),
    )

    async def _fake_caller(credentials, supabase):
        return {"id": _CALLER, "email": "u@x.co"}

    async def _is_op_false(user_id):
        return False

    monkeypatch.setattr(deps, "authenticate_canvas_request", _fake_caller)
    monkeypatch.setattr(deps, "is_operator", _is_op_false)

    sb = _FakeSupabase(
        skills=_ALL_ROWS,
        org_members=_org_member_rows(_ORG_MINE),
        folders=[],
    )
    # conftest's autouse `reset_mocks` restores the canonical override after this test.
    app.dependency_overrides[get_supabase] = lambda: sb

    resp = client.get("/workflows/grounding-bundle")
    assert resp.status_code == 200, resp.text

    raw = resp.text
    body = resp.json()
    returned = {s["id"] for s in body["skills"]}

    assert _FOREIGN_ORG_SHARED["id"] not in returned, (
        "the palette handed a caller another org's skill — CR-01 is OPEN"
    )
    assert "Foreign Org Secret Skill" not in raw
    assert _ORG_THEIRS not in raw  # nor the foreign tenant id (CR-02)
    assert {_MY_SKILL["id"], _IN_ORG_SHARED["id"], _SYSTEM_SKILL["id"]} == returned
