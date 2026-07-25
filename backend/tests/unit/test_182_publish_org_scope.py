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
from contextlib import ExitStack, contextmanager
from types import SimpleNamespace
from uuid import uuid4

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

_DEF_ID = uuid4()
_GOLDEN_RUN_ID = uuid4()


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

    return WorkflowDefinition.model_validate(_bound_payload(folder_scope=folder_scope))


def _bound_payload(*, folder_scope: list[str]) -> dict:
    return {
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


def _skill_payload(*, skill_ref: str) -> dict:
    """A lint-clean, NON-interactive, unbound definition whose only grounding surface is
    its `skill_ref` — so stage 2.6 is the only thing that can block it."""
    return {
        "slug": "org-scoped-wf",
        "version": 1,
        "name": "Org Scoped Workflow",
        "status": "draft",
        "business_requirement": _BR,
        "phases": [
            {
                "slug": "answer",
                "phase_index": 0,
                "config": {
                    "phase_type": "llm_single",
                    "prompt": "Answer the question.",
                    "skill_ref": skill_ref,
                },
                "validators": [],
            }
        ],
    }


# ══ GROUP B — the REAL publish orchestration, end to end ══════════════════════


def _row(payload: dict) -> dict:
    """A `get_definition` row whose `definition` JSONB model_validates."""
    from uuid import UUID

    return {
        "id": _DEF_ID,
        "slug": payload["slug"],
        "version": payload["version"],
        "name": payload["name"],
        "status": payload["status"],
        "definition": payload,
        "created_by": UUID(_PUBLISHER),
    }


@contextmanager
def _publish_env(payload: dict):
    """The patch stack — deliberately NARROWER than `test_182_publish_grounding_stage`'s.

    Patched: the DB accessors (`get_definition` / `write_audit` / `publish_definition`) and
    the two expensive boundaries (`_drive_golden_run` / `_judge_golden_output`).

    NOT patched, and that is the whole point of this file:

      * `_resolve_publish_supabase` — the REAL helper runs, so the definition's own `org_id`
        is genuinely read from the pool and genuinely reaches the gate. The sibling file
        patches this seam (it is testing the RULES, not the SCOPE), which is exactly why it
        could not have caught WR-05.
      * `assemble_grounding_bundle` / `grounding_verdicts` — the REAL org gate executes
        against the offline fake client, so a green assertion here is the gate agreeing, not
        a mock firing.
    """
    from unittest.mock import AsyncMock, patch

    from app.services.harness import publish_service

    drive = AsyncMock(return_value=(_GOLDEN_RUN_ID, {"text": "an answer [doc1]"}, "completed"))
    judge = AsyncMock(
        return_value={
            "overall_passed": True,
            "overall_score": 95,
            "summary": "good",
            "criteria": [],
        }
    )
    flip = AsyncMock(return_value=2)

    with ExitStack() as stack:
        stack.enter_context(
            patch("app.db.workflows.get_definition", AsyncMock(return_value=_row(payload)))
        )
        stack.enter_context(patch("app.db.workflows.write_audit", AsyncMock()))
        stack.enter_context(patch("app.db.workflows.publish_definition", flip))
        stack.enter_context(patch.object(publish_service, "_drive_golden_run", drive))
        stack.enter_context(patch.object(publish_service, "_judge_golden_output", judge))
        yield SimpleNamespace(drive=drive, judge=judge, flip=flip)


def _pool(*, org=_ORG_A, raises=None):
    """An asyncpg-pool stand-in whose ONE relevant read is
    `SELECT org_id FROM workflow_definitions WHERE id = $1`."""
    from unittest.mock import AsyncMock

    pool = AsyncMock()
    pool.fetchval = (
        AsyncMock(side_effect=raises) if raises is not None else AsyncMock(return_value=org)
    )
    return pool


async def _publish(*, sb, pool):
    from unittest.mock import AsyncMock

    from app.services.harness import publish_service

    return await publish_service.publish(
        definition_id=_DEF_ID,
        golden_input="a representative kickoff prompt",
        user={"id": _PUBLISHER},
        pool=pool,
        redis=AsyncMock(),
        supabase=sb,
    )


def _codes(result) -> list[str]:
    return [f.get("code") for f in result["named_failures"] if isinstance(f, dict)]


@pytest.mark.asyncio
async def test_a_multi_org_publisher_cannot_publish_an_org_a_definition_naming_an_org_b_skill():
    """THE LOAD-BEARING TEST (WR-05). An org-A definition whose `skill_ref` names an org-B
    skill is BLOCKED at `grounding_fidelity`, even though the publisher belongs to BOTH orgs.

    PRE-FIX OUTCOME: `published is True`. `_resolve_publish_supabase` had already read this
    definition's `org_id` (to scope the BYPASSRLS client) and then discarded it, so the gate
    resolved visibility from the PUBLISHER's org-membership union and the org-B skill grounded
    as valid. The version was minted. Every org-A colleague who then ran that workflow got an
    unresolvable skill — a workflow that passed the hard gate and works only for its author.
    """
    pool = _pool(org=_ORG_A)

    with _publish_env(_skill_payload(skill_ref=_SKILL_B)) as env:
        result = await _publish(sb=_sb(), pool=pool)

    assert result["published"] is False, (
        "WR-05: an org-A definition referencing an org-B skill PUBLISHED, because the gate "
        "asked 'can this publisher see it?' instead of 'is this definition grounded in its "
        "own org?'"
    )
    assert result["blocked_stage"] == "grounding_fidelity"
    assert _codes(result) == ["unregistered_skill"], result["named_failures"]
    failure = result["named_failures"][0]
    assert failure["phase"] == "answer"  # per-node keyed like every grounding verdict (SC#4)
    assert _SKILL_B in failure["message"]
    env.drive.assert_not_called()  # never burn a real provider run on a cross-org definition
    env.flip.assert_not_called()  # and certainly never mint a version


@pytest.mark.asyncio
async def test_the_same_definition_with_an_in_org_skill_still_publishes():
    """THE POSITIVE CONTROL. Identical construction, org-A skill: publishes exactly as today.

    Without this, the test above could pass simply because the restriction blocks everything —
    which would be a worse bug than the one being fixed.
    """
    with _publish_env(_skill_payload(skill_ref=_SKILL_A)) as env:
        result = await _publish(sb=_sb(), pool=_pool(org=_ORG_A))

    assert result["published"] is True, result
    assert result.get("blocked_stage") is None
    env.drive.assert_awaited_once()  # stage 2.6 let it through to the golden run
    env.flip.assert_called_once()


@pytest.mark.asyncio
async def test_an_org_b_folder_scope_cannot_publish_on_an_org_a_definition():
    """The FOLDER half of the same gate, through the REAL publish orchestration.

    PRE-FIX OUTCOME: `published is True`. The ⊆ walk resolved a subtree from the PUBLISHER's
    folder view, which reaches the org-B-shared child, so the phase's `folder_scope` looked
    like a subset. At run time an org-A colleague's `fetch_visible_folders` never returns that
    folder, the phase's ∩ empties, and the phase retrieves nothing — silently.
    """
    with _publish_env(_bound_payload(folder_scope=[_FOLDER_B])) as env:
        result = await _publish(sb=_sb(), pool=_pool(org=_ORG_A))

    assert result["published"] is False
    assert result["blocked_stage"] == "grounding_fidelity"
    assert _codes(result) == ["folder_scope"], result["named_failures"]
    assert result["named_failures"][0]["phase"] == "answer"
    env.drive.assert_not_called()
    env.flip.assert_not_called()


@pytest.mark.asyncio
async def test_an_in_org_folder_scope_still_publishes():
    """The folder half's positive control — an org-A `folder_scope` publishes as today."""
    with _publish_env(_bound_payload(folder_scope=[_CHILD_A])) as env:
        result = await _publish(sb=_sb(), pool=_pool(org=_ORG_A))

    assert result["published"] is True, result
    env.drive.assert_awaited_once()


@pytest.mark.asyncio
async def test_the_org_is_read_even_when_the_caller_supplies_the_client():
    """`_resolve_publish_supabase` returns `(client, org_id)` on BOTH branches.

    The caller-supplied branch must STILL read `workflow_definitions.org_id`. Returning
    `(supabase, None)` there would silently disable the restriction in exactly the tests meant
    to prove it — and would leave the client scope and the gate scope free to disagree about
    which tenant a publish is acting for. One read, one org, both consumers.

    PRE-FIX OUTCOME: the helper returned the bare client and the caller-supplied branch never
    touched the pool, so `fetchval` was never awaited and the tuple unpack is a `TypeError`.
    """
    from app.services.harness import publish_service

    pool = _pool(org=_ORG_A)
    sb = _sb()

    resolved, org_id = await publish_service._resolve_publish_supabase(
        sb, definition_id=_DEF_ID, pool=pool
    )

    assert resolved is sb, "a supplied client must be handed back unchanged"
    assert str(org_id) == _ORG_A
    pool.fetchval.assert_awaited_once()
    sql = pool.fetchval.await_args.args[0]
    assert "org_id" in sql and "workflow_definitions" in sql, sql


@pytest.mark.asyncio
async def test_an_unresolvable_definition_org_blocks_fail_closed_never_widens():
    """A definition org that cannot be READ degrades to `grounding_unavailable`, which BLOCKS.

    This is plan 182-11's honest degraded finding, reached through the fail-closed
    `except Exception`. The direction is the whole point: a publish that cannot establish
    WHICH TENANT it is acting for must not fall back to the publisher's wider view.
    """
    with _publish_env(_skill_payload(skill_ref=_SKILL_B)) as env:
        result = await _publish(
            sb=None, pool=_pool(raises=RuntimeError("postgrest 503 on the org read"))
        )

    assert result["published"] is False
    assert result["blocked_stage"] == "grounding_fidelity"
    assert _codes(result) == ["grounding_unavailable"], result["named_failures"]
    assert result["named_failures"][0]["phase"] is None
    env.drive.assert_not_called()
    env.flip.assert_not_called()


@pytest.mark.asyncio
async def test_a_falsy_definition_org_blocks_rather_than_publishing_unrestricted():
    """A FALSY org is refused on BOTH branches — it must never resolve to an unrestricted gate.

    Without a client the org-requiring factory (`get_service_role_supabase`) already refuses.
    With a client supplied there is no factory to refuse, so the helper must refuse itself:
    otherwise the org-B skill below grounds as valid and a definition with no resolvable tenant
    publishes against its author's whole org union.

    PRE-FIX OUTCOME: `published is True` — the org was never read on this branch at all.
    """
    with _publish_env(_skill_payload(skill_ref=_SKILL_B)) as env:
        result = await _publish(sb=_sb(), pool=_pool(org=None))

    assert result["published"] is False, (
        "a definition whose org resolved to nothing published against the PUBLISHER's full "
        "org-membership union — the fail-OPEN direction"
    )
    assert result["blocked_stage"] == "grounding_fidelity"
    assert _codes(result) == ["grounding_unavailable"], result["named_failures"]
    env.drive.assert_not_called()
    env.flip.assert_not_called()


def test_validate_was_deliberately_not_given_a_restriction():
    """`POST /workflows/validate` passes NO restriction — a recorded decision (T-182-55).

    An author validating their own draft acts AS THEMSELVES; narrowing that surface to some
    org would refuse folders and skills they can legitimately reach, and it is not this
    finding. Asserted structurally so a verifier reads the asymmetry as a choice rather than
    as an omission on the route that Phase 184 calls on every canvas edit.
    """
    from pathlib import Path

    import app.api.workflows as wf

    source = Path(wf.__file__).read_text(encoding="utf-8")
    assert "restrict_org_ids" not in source, (
        "the /validate seam grew an org restriction — if that is intentional it needs its own "
        "decision record; WR-05 is about the PUBLISH gate only"
    )


# ═══ Round-3 Truth 9 / WR-02 — the PRIMARY binding, not just the references ═══
#
# 182-12 gated the two SECONDARY bindings (a phase's `skill_ref`, a phase's `folder_scope`)
# and left the PRIMARY one — the definition's own `project_folder_id` — ungated, because
# `resolve_project_subtree`'s `_walk` seeds its result with the root UNCONDITIONALLY. So an
# org-A definition bound DIRECTLY to an org-B folder published clean under the org-A
# restriction. The round-3 verification reproduced it using this very file's fixtures,
# varying the one input all 16 tests above hold constant.
#
# EVERY TEST BELOW FAILS AGAINST THE ROUND-3 CODE.


def _rooted_at_org_b(*, folder_scope: list[str]):
    """The org-A definition whose PROJECT ROOT is itself the org-B folder."""
    from app.models.harness import WorkflowDefinition

    payload = _bound_payload(folder_scope=folder_scope)
    payload["project_folder_id"] = _FOLDER_B
    return WorkflowDefinition.model_validate(payload)


@pytest.mark.asyncio
async def test_a_project_root_outside_the_restriction_is_reported_even_with_no_folder_scope():
    """THE LOAD-BEARING CASE. No per-phase `folder_scope` at all — nothing for the ⊆ loop.

    This is the shape that made the hole invisible: with no phase declaring a `folder_scope`,
    the subset loop has nothing to test, so an empty allowed-set alone still reports CLEAN.
    The root violation has to be raised on its own.

    PRE-FIX OUTCOME: `[]` — the org-B-rooted definition published clean under the org-A
    restriction, and at run time an org-A colleague resolved an empty folder intersection.
    """
    from app.services.harness.grounding import grounding_verdicts

    wd = _rooted_at_org_b(folder_scope=[])

    clean = await grounding_verdicts(
        wd, supabase=_sb(), user_id=_PUBLISHER, tool_names=set(), skill_ids=set()
    )
    assert [v["code"] for v in clean] == [], (
        "premise broken: unrestricted, the multi-org publisher CAN see the org-B root, so "
        "this must look clean — otherwise the restricted assertion proves nothing"
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
    assert _FOLDER_B in scoped[0]["message"]


@pytest.mark.asyncio
async def test_a_project_root_outside_the_restriction_is_reported_when_it_names_itself():
    """The second shape the verification drove: `folder_scope` naming the bound root.

    PRE-FIX OUTCOME: `[]` here too — the root was unconditionally in `allowed`, so a
    `folder_scope` naming it was trivially a subset of itself.
    """
    from app.services.harness.grounding import grounding_verdicts

    wd = _rooted_at_org_b(folder_scope=[_FOLDER_B])

    scoped = await grounding_verdicts(
        wd,
        supabase=_sb(),
        user_id=_PUBLISHER,
        tool_names=set(),
        skill_ids=set(),
        restrict_org_ids={_ORG_A},
    )
    assert [v["code"] for v in scoped] == ["folder_scope"], scoped


@pytest.mark.asyncio
async def test_an_in_org_project_root_still_resolves_its_whole_subtree():
    """THE POSITIVE CONTROL. The restriction must not break the ordinary case.

    Without this, the two tests above would pass against a `resolve_project_subtree` that
    simply returned `[]` for every restricted call — which would make EVERY scoped workflow
    unpublishable.
    """
    from app.services.harness.scope import resolve_project_subtree

    subtree = await resolve_project_subtree(
        _PROJECT_A, supabase=_sb(), user_id=_PUBLISHER, restrict_org_ids={_ORG_A}
    )

    assert subtree is not None and _PROJECT_A in subtree, (
        "an in-org root must still resolve — a blanket empty return would make every scoped "
        "workflow unpublishable"
    )
    assert _CHILD_A in subtree, "the in-org descendant must still be walked"
    assert _FOLDER_B not in subtree, "the org-B child must still be excluded (182-12)"


@pytest.mark.asyncio
async def test_an_unrestricted_out_of_scope_root_is_byte_identical_to_today():
    """THE BYTE-IDENTITY CONTROL. The root check is restricted-callers-only.

    Run start, resume, Continue, NL generation, /validate and the four /folders routes all
    pass no restriction. For them a root outside the visible set must STILL resolve to
    `[root]`, exactly as it always has — this fix must not change one of them.
    """
    from app.services.harness.scope import resolve_project_subtree

    unknown_root = "dddddddd-dddd-dddd-dddd-dddddddddddd"  # in no folder row at all

    subtree = await resolve_project_subtree(
        unknown_root, supabase=_sb(), user_id=_PUBLISHER
    )

    assert subtree == [unknown_root], (
        "an UNRESTRICTED caller's out-of-set root must still come back as [root] — the "
        "round-3 root check leaked into the shared path"
    )


@pytest.mark.asyncio
async def test_an_unbound_definition_is_still_not_a_violation_under_a_restriction():
    """`None` (unbound) and `[]` (bound, out of scope) must stay DIFFERENT answers.

    An unbound workflow keeps whole-KB behaviour and is not an org offence; collapsing the
    two would report a violation on every unbound draft the moment publish gained a
    restriction.
    """
    from app.services.harness.grounding import grounding_verdicts
    from app.models.harness import WorkflowDefinition

    payload = _bound_payload(folder_scope=[])
    payload["project_folder_id"] = None
    wd = WorkflowDefinition.model_validate(payload)

    scoped = await grounding_verdicts(
        wd,
        supabase=_sb(),
        user_id=_PUBLISHER,
        tool_names=set(),
        skill_ids=set(),
        restrict_org_ids={_ORG_A},
    )
    assert [v["code"] for v in scoped] == [], scoped
