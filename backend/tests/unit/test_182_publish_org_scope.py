"""Phase 182 gap closure round 2 (VALID-01, plan 182-12 / WR-05) — the publish grounding
gate is scoped to the DEFINITION's org, not to the PUBLISHER's org-membership union.

THE DEFECT. `publish_service._resolve_publish_supabase` reads
`SELECT org_id FROM workflow_definitions WHERE id = $1` **specifically** so the BYPASSRLS
service-role client is org-scoped (Phase 163, D-05 / T-163-05b). It then threw that value
away: stage 2.6 passed only `user_id` down, and `assemble_grounding_bundle` resolved
visibility from `_resolve_caller_org_ids(supabase, user_id)` — EVERY org the publisher
belongs to. The org that was just read scoped the CLIENT and was never consulted for the
GATE.

THE CONSEQUENCE, and why it is not cosmetic. For a multi-org author, publish green-lit a
definition in org A whose `skill_ref` named an org-B skill (or whose `folder_scope` named an
org-B folder) because the PUBLISHER could see both. At run time the picture flips:
`tool_dispatcher`'s skill resolution and `fetch_visible_folders` gate on the **runner's** org
set, so an org-A colleague running the published workflow gets an unresolvable skill or an
empty folder intersection. The workflow passed the hard gate and silently under-performs for
everyone but its author, and nobody can tell whether the definition or the environment is
wrong. Nothing crosses a tenant boundary on the wire — this is the SEED-124 / SEED-125 shape
(org-blind service-role reads) one layer up: the read IS org-gated, the SCOPE of the gate was
wrong. Plan 182-06 is what made that gate authoritative.

THE FIX, in one sentence: one optional `restrict_org_ids` keyword, intersected at the two
points where the caller's org set is ALREADY resolved (folders in `folder_utils`, skills in
`grounding`), threaded from the definition's own org. No visibility rule is duplicated — the
shared `app.utils.skill_visibility` predicate and `is_in_global_subtree`'s ancestor walk are
untouched and simply receive a narrower org set.

EVERY TEST HERE FAILS AGAINST THE PRE-FIX CODE. The pre-fix outcome is named in each
docstring. Group A pins the MECHANISM (and isolates it from incidental emptiness — the WR-01
trap: a block proves nothing if the registry was empty anyway); Group B drives the REAL
publish orchestration end to end.

CONVENTION (Phase 102 posture): imports INSIDE the test bodies; offline fakes only — no live
DB, no provider, no network.
"""

from __future__ import annotations

import copy
from types import SimpleNamespace

import pytest

# ── the cast ──────────────────────────────────────────────────────────────────
#
# UUID-shaped on purpose: `_skill_registry` runs every org id through `coerce_uid`
# before splicing it into the PostgREST `.or_()` grammar, so a non-UUID org would raise
# there rather than exercise the gate.
_PUBLISHER = "00000000-0000-0000-0000-000000000001"  # a member of BOTH orgs
_COLLEAGUE = "cccccccc-cccc-cccc-cccc-cccccccccccc"  # someone else, in org B
_ORG_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"  # the DEFINITION's org
_ORG_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"  # the publisher's OTHER org

_SKILL_A = "11111111-1111-1111-1111-111111111111"  # enabled, owned, org A
_SKILL_B = "22222222-2222-2222-2222-222222222222"  # enabled, org-SHARED, org B

_PROJECT_A = "aaaa1111-0000-0000-0000-000000000001"  # the bound project root (org A)
_CHILD_A = "aaaa1111-0000-0000-0000-000000000002"  # an owned descendant (org A)
_FOLDER_B = "bbbb2222-0000-0000-0000-000000000001"  # org-B-shared, under the project root

_BR = "Deliver a cited answer to the requester."


# ── the offline fakes ─────────────────────────────────────────────────────────


class _Query:
    """A fluent supabase-py query stand-in that RECORDS what was pushed down.

    `.eq()` genuinely filters (so `_resolve_caller_org_ids`' `org_members` read behaves like
    the real one), while `.or_()` is RECORDED AND IGNORED. That asymmetry is deliberate and
    mirrors `test_182_grounding_skill_org_gate.py`: ignoring the pushed-down skill predicate
    simulates a service-role read whose DB-side filter did nothing, which isolates the
    in-Python post-filter — the second encoding of the same rule, and the one that must not be
    looser than the query. `or_arg` is still asserted on, so BOTH encodings are covered.

    `count="exact"` (the WR-07 `strict=True` gate path) answers with an HONEST count equal to
    the number of rows returned, so nothing here is ever mistaken for a truncation.
    """

    def __init__(self, rows):
        self._rows = list(rows)
        self._eqs: list[tuple] = []
        self.or_arg: str | None = None
        self.selected: str | None = None
        self.count_arg: str | None = None

    def select(self, *cols, count=None, **_kwargs):
        self.selected = cols[0] if cols else "*"
        self.count_arg = count
        return self

    def eq(self, col, val):
        self._eqs.append((col, val))
        return self

    def or_(self, expr):
        self.or_arg = expr
        return self

    def execute(self):
        rows = self._rows
        for col, val in self._eqs:
            rows = [r for r in rows if str(r.get(col)) == str(val)]
        # Deep-copy so code under test mutates its own copy, never the fixture rows.
        resp = SimpleNamespace(data=copy.deepcopy(rows))
        if self.count_arg == "exact":
            resp.count = len(rows)  # complete read — never a truncation
        return resp


class _FakeSupabase:
    """Per-table fake. A FRESH `_Query` per `.table()` call (so accumulated `.eq()` filters
    never leak between the several reads one bundle performs), with every query retained so a
    test can assert on the LAST predicate a table was handed."""

    def __init__(self, **tables):
        self._rows = {name: list(rows) for name, rows in tables.items()}
        self.queries: dict[str, list[_Query]] = {}

    def table(self, name):
        q = _Query(self._rows.get(name, []))
        self.queries.setdefault(name, []).append(q)
        return q

    def last(self, name) -> _Query:
        return self.queries[name][-1]


def _org_members() -> list[dict]:
    """The publisher belongs to BOTH orgs — the whole premise of WR-05."""
    return [
        {"user_id": _PUBLISHER, "org_id": _ORG_A},
        {"user_id": _PUBLISHER, "org_id": _ORG_B},
        {"user_id": _COLLEAGUE, "org_id": _ORG_B},
    ]


def _skills() -> list[dict]:
    return [
        {
            "id": _SKILL_A,
            "name": "An Org-A Skill",
            "user_id": _PUBLISHER,
            "is_org_shared": False,
            "is_system": False,
            "org_id": _ORG_A,
            "is_enabled": True,
        },
        {
            "id": _SKILL_B,
            "name": "An Org-B Skill",
            "user_id": _COLLEAGUE,
            "is_org_shared": True,
            "is_system": False,
            "org_id": _ORG_B,
            "is_enabled": True,
        },
    ]


def _folders() -> list[dict]:
    """A project root in org A with two children: one owned (org A) and one shared into org B.

    The org-B child is what makes the folder half discriminating. The publisher can reach it
    (they are in org B), so the ⊆ walk resolves a subtree that CONTAINS it and the definition
    looks clean. An org-A colleague running the published workflow cannot reach it at all —
    the phase's `folder_scope` intersects to nothing and the phase retrieves silently. Scoping
    the gate to the definition's own org makes the gate's answer and the runner's agree.
    """
    return [
        {
            "id": _PROJECT_A,
            "user_id": _PUBLISHER,
            "name": "Project A",
            "parent_id": None,
            "is_org_shared": False,
            "org_id": _ORG_A,
        },
        {
            "id": _CHILD_A,
            "user_id": _PUBLISHER,
            "name": "Child A",
            "parent_id": _PROJECT_A,
            "is_org_shared": False,
            "org_id": _ORG_A,
        },
        {
            "id": _FOLDER_B,
            "user_id": _COLLEAGUE,
            "name": "Shared Into Org B",
            "parent_id": _PROJECT_A,
            "is_org_shared": True,
            "org_id": _ORG_B,
        },
    ]


def _sb() -> _FakeSupabase:
    return _FakeSupabase(
        org_members=_org_members(), skills=_skills(), folders=_folders()
    )


# ══ GROUP A — the MECHANISM, isolated from any incidental emptiness ═══════════


@pytest.mark.asyncio
async def test_the_restriction_is_what_excludes_the_org_b_skill_not_an_empty_registry():
    """THE MECHANISM PROOF (WR-05). Same fake, same publisher, two calls.

    Without `restrict_org_ids` the org-B skill IS in `skill_ids`; with
    `restrict_org_ids={org_a}` it is NOT. Asserting both directions is what separates "the
    restriction works" from "the registry happened to be empty" — the exact trap WR-01 was
    about, where a swallowed read produced an empty set that looked like a clean gate.

    PRE-FIX OUTCOME: `assemble_grounding_bundle` took no restriction at all, so the second
    call is a `TypeError: unexpected keyword argument 'restrict_org_ids'`.
    """
    from app.services.harness.grounding import assemble_grounding_bundle

    wide = await assemble_grounding_bundle(supabase=_sb(), user_id=_PUBLISHER)
    assert _SKILL_B in wide.skill_ids, (
        "premise broken: the publisher must be able to see the org-B skill UNRESTRICTED, "
        "or the restricted assertion below would pass vacuously"
    )
    assert _SKILL_A in wide.skill_ids

    sb = _sb()
    narrow = await assemble_grounding_bundle(
        supabase=sb, user_id=_PUBLISHER, restrict_org_ids={_ORG_A}
    )
    assert _SKILL_B not in narrow.skill_ids, (
        "WR-05: the publish gate would ground an org-B skill_ref as valid on an org-A "
        "definition, because the PUBLISHER can see both orgs"
    )
    assert _SKILL_A in narrow.skill_ids, "the definition's OWN org must still resolve"

    # BOTH encodings of the one shared rule are narrowed — the pushed-down predicate as well
    # as the in-Python post-filter the fake above deliberately leaves as the last line of
    # defense. A query narrower than the post-filter (or the reverse) is how the SEED-124
    # class of leak re-opens.
    pushed = sb.last("skills").or_arg or ""
    assert _ORG_A in pushed, pushed
    assert _ORG_B not in pushed, (
        f"the org-B id was still pushed down to PostgREST: {pushed!r}"
    )


@pytest.mark.asyncio
async def test_an_empty_restriction_is_fail_closed_never_unrestricted():
    """`restrict_org_ids=set()` means NO org-shared visibility — never "no restriction".

    That polarity is the difference between a fail-closed gate and a fail-OPEN one: a
    definition whose org cannot be resolved must see only its owner's rows and `is_system`
    skills, not everything the publisher can reach. `None` (the default) is the unrestricted
    value; an EMPTY SET must never be re-interpreted as `None`.

    PRE-FIX OUTCOME: `TypeError` — the parameter did not exist.
    """
    from app.services.harness.grounding import assemble_grounding_bundle

    bundle = await assemble_grounding_bundle(
        supabase=_sb(), user_id=_PUBLISHER, restrict_org_ids=set()
    )

    assert _SKILL_B not in bundle.skill_ids
    assert _SKILL_A not in bundle.skill_ids, (
        "an empty restriction resolved the caller's OWN org anyway — the empty set was "
        "read as 'unrestricted', which is the fail-OPEN direction"
    )
    assert bundle.degraded == frozenset(), "an empty restriction is a scope, not a failure"


@pytest.mark.asyncio
async def test_an_omitted_restriction_is_byte_identical_to_today():
    """The control every existing caller depends on: no keyword -> today's behaviour.

    NL generation, `/validate`, run-start kickoff, resume, Continue and the four `/folders`
    routes all omit the parameter, so this is the assertion that keeps them unchanged.
    """
    from app.services.harness.grounding import assemble_grounding_bundle
    from app.utils.folder_utils import fetch_visible_folders

    bundle = await assemble_grounding_bundle(supabase=_sb(), user_id=_PUBLISHER)
    assert bundle.skill_ids == {_SKILL_A, _SKILL_B}
    assert {f["id"] for f in bundle.folders} == {_PROJECT_A, _CHILD_A, _FOLDER_B}

    explicit_none = await fetch_visible_folders(
        _sb(), _PUBLISHER, restrict_org_ids=None
    )
    assert {f["id"] for f in explicit_none} == {_PROJECT_A, _CHILD_A, _FOLDER_B}


@pytest.mark.asyncio
async def test_visible_folders_excludes_the_org_b_folder_under_the_restriction():
    """The FOLDER half of the same mechanism, at the one place the org set is resolved.

    Unrestricted, the publisher reaches the org-B-shared folder through
    `is_in_global_subtree`'s ancestor walk. Restricted to the definition's org, they do not —
    and the walk itself is untouched: it simply receives a narrower `caller_org_ids`.

    PRE-FIX OUTCOME: `TypeError: unexpected keyword argument 'restrict_org_ids'`.
    """
    from app.utils.folder_utils import fetch_visible_folders

    wide = {f["id"] for f in await fetch_visible_folders(_sb(), _PUBLISHER)}
    assert _FOLDER_B in wide, "premise broken: the publisher must see it unrestricted"

    narrow = {
        f["id"]
        for f in await fetch_visible_folders(
            _sb(), _PUBLISHER, restrict_org_ids={_ORG_A}
        )
    }
    assert _FOLDER_B not in narrow, (
        "WR-05 (folder half): an org-B folder stayed visible while acting on behalf of an "
        "org-A definition"
    )
    assert narrow == {_PROJECT_A, _CHILD_A}, "owned folders must be unaffected"


@pytest.mark.asyncio
async def test_the_restriction_composes_with_the_wr_07_strict_read():
    """The new keyword must compose with plan 182-11's `strict=` on the SAME functions.

    Both are keyword-only additions to `fetch_visible_folders` / `fetch_all_folders`; the
    grounding gate passes BOTH. A truncation-aware read that quietly dropped the org
    restriction (or vice versa) would be a silent regression neither plan's own suite catches.
    """
    from app.utils.folder_utils import fetch_visible_folders

    sb = _sb()
    rows = await fetch_visible_folders(
        sb, _PUBLISHER, strict=True, restrict_org_ids={_ORG_A}
    )

    assert {f["id"] for f in rows} == {_PROJECT_A, _CHILD_A}
    assert sb.last("folders").count_arg == "exact", (
        "strict=True stopped requesting an exact count once restrict_org_ids was threaded "
        "through — WR-07's truncation guard would be silently disarmed"
    )


@pytest.mark.asyncio
async def test_an_org_b_folder_scope_is_reported_on_an_org_a_definition():
    """END TO END through the REAL ⊆ walk: the restricted subtree turns an org-B
    `folder_scope` into a keyed `folder_scope` verdict (WR-05, folder half).

    Unrestricted, `resolve_project_subtree` walks a folder tree that INCLUDES the org-B child,
    so the phase's `folder_scope` is a subset and the definition reports CLEAN. That is
    exactly the false green: an org-A colleague running it resolves an empty intersection at
    `phase_types.py`'s ∩ and the phase retrieves nothing.

    PRE-FIX OUTCOME: `TypeError` on the restricted call; and with the restriction removed,
    NO verdict at all — the definition published clean.
    """
    from app.services.harness.grounding import grounding_verdicts

    wd = _bound_definition(folder_scope=[_FOLDER_B])

    clean = await grounding_verdicts(
        wd, supabase=_sb(), user_id=_PUBLISHER, tool_names=set(), skill_ids=set()
    )
    assert [v["code"] for v in clean] == [], (
        "premise broken: unrestricted, this definition must look CLEAN — otherwise the "
        "restricted assertion below proves nothing about the restriction"
    )

    scoped = await grounding_verdicts(
        wd,
        supabase=_sb(),
        user_id=_PUBLISHER,
        tool_names=set(),
        skill_ids=set(),
        restrict_org_ids={_ORG_A},
    )
    assert [v["code"] for v in scoped] == ["folder_scope"], scoped
    assert scoped[0]["phase"] == "answer", "the verdict must stay keyed to its node (SC#4)"
    assert _FOLDER_B in scoped[0]["message"]


@pytest.mark.asyncio
async def test_an_in_org_folder_scope_still_passes_under_the_restriction():
    """The positive control for the folder half: an org-A `folder_scope` on an org-A
    definition is CLEAN under the same restriction. Without this, the test above could pass
    simply because the restriction blocks everything."""
    from app.services.harness.grounding import grounding_verdicts

    wd = _bound_definition(folder_scope=[_CHILD_A])

    verdicts = await grounding_verdicts(
        wd,
        supabase=_sb(),
        user_id=_PUBLISHER,
        tool_names=set(),
        skill_ids=set(),
        restrict_org_ids={_ORG_A},
    )
    assert verdicts == [], verdicts


def test_the_run_start_raiser_did_not_gain_a_restriction():
    """`assert_folder_scopes_subset` keeps its THREE-parameter signature, deliberately.

    Its callers — `workflow_kickoff`'s HTTP 400, `runs.py`'s Continue fallback,
    `harness_engine`'s resume fallback and the NL-generation short-circuit — all act AS
    THEMSELVES, not on behalf of a definition's org. Narrowing them would break correct
    behaviour rather than close a leak (T-182-55), so the asymmetry is pinned here as a
    DECISION rather than left to read as an omission.
    """
    import inspect

    from app.services.harness.scope import (
        assert_folder_scopes_subset,
        folder_scope_violations,
        resolve_project_subtree,
    )

    raiser = inspect.signature(assert_folder_scopes_subset).parameters
    assert set(raiser) == {"definition", "supabase", "user_id"}, raiser
    assert "restrict_org_ids" not in raiser

    # ...while the two NON-raising forms it delegates to DO carry it.
    assert "restrict_org_ids" in inspect.signature(folder_scope_violations).parameters
    assert "restrict_org_ids" in inspect.signature(resolve_project_subtree).parameters


# ── definition builders ───────────────────────────────────────────────────────


def _bound_definition(*, folder_scope: list[str]):
    """A single-phase definition BOUND to the org-A project, declaring `folder_scope`."""
    from app.models.harness import WorkflowDefinition

    return WorkflowDefinition.model_validate(
        {
            "slug": "org-scoped-wf",
            "version": 1,
            "name": "Org Scoped Workflow",
            "status": "draft",
            "business_requirement": _BR,
            "project_folder_id": _PROJECT_A,
            "phases": [
                {
                    "slug": "answer",
                    "phase_index": 0,
                    "config": {
                        "phase_type": "llm_agent",
                        "prompt": "Answer.",
                        "available_tools": [],
                        "folder_scope": folder_scope,
                    },
                    "validators": [],
                }
            ],
        }
    )
