"""Phase 182 gap closure round 2 (VALID-01, plan 182-11) — an unresolvable registry says
"we could not CHECK", never "your definition is wrong".

THE SHARED DEFECT, three costumes. WR-01, WR-02 and WR-07 in `182-REVIEW.md` are one bug:
a transient INFRASTRUCTURE failure is rendered to the author as a FALSE, specific,
actionable-looking accusation against a definition that is actually correct.

  * **WR-01** — `grounding._skill_registry`'s fail-closed `except Exception: return []` sat
    INSIDE `assemble_grounding_bundle`, so a PostgREST 5xx / timeout / reset on the skills
    read produced `skills = []`, `skill_ids = set()` and a bundle that returned
    SUCCESSFULLY. Publish stage 2.6's `try` never saw a failure, so `_unregistered_skill_ref`
    reported EVERY phase skill reference as unregistered. PRE-FIX OUTCOME: publish blocked at
    `grounding_fidelity` with `unregistered_skill` naming the author's VALID id, and
    `/validate` painted that node red with the same message — actively directing the author
    to "fix" a correct reference.
  * **WR-02** — `postgrest.exceptions.APIError` is NOT a `ValueError`, so it escaped the ⊆
    rule's catch and reached FastAPI. PRE-FIX OUTCOME: HTTP 500 from a route whose own
    docstring promises "ALWAYS HTTP 200", on the route Phase 184 calls on every canvas edit.
  * **WR-07** — the unbounded full-table `folders` read is capped by PostgREST at `max-rows`
    and silently returns a PREFIX. The resolved project subtree then shrinks. PRE-FIX
    OUTCOME: a FALSE `folder_scope` violation against a correct definition — and since
    182-06 that false violation BLOCKS publish.

THE ONE MECHANISM. All three are closed by a single signal: `GroundingBundle.degraded`
names the registries that could not be resolved, and BOTH consumers of the shared collector
(`POST /workflows/validate` and publish stage 2.6) branch on it identically, emitting the
ONE shared `grounding.grounding_unavailable_finding`. There is no second copy of the
degradation decision and no second message.

EVERY TEST HERE FAILS AGAINST THE PRE-FIX CODE — the pre-fix outcome is named in each
docstring, and the three falsification recipes are recorded in the plan's SUMMARY.

CONVENTION (Phase 102 posture): imports INSIDE the test bodies; the route handler is called
DIRECTLY (the `test_182_validate.py` precedent) so the whole matrix runs OFFLINE — no live
DB, no provider, no network.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

# conftest's canonical mock identity — `coerce_uid` needs a parseable UUID.
_CALLER = "00000000-0000-0000-0000-000000000001"
_ORG = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"

_PROJECT = "11111111-1111-1111-1111-111111111111"
_OUTSIDE_FOLDER = "22222222-2222-2222-2222-222222222222"
_REAL_SKILL = "33333333-3333-3333-3333-333333333333"
_BR = "Deliver a cited answer to the requester."

# Distinguishes "the response carried no count header at all" from "the count was None".
_NO_COUNT = object()


# ── the offline fakes ─────────────────────────────────────────────────────────


class _FakeQuery:
    """A fluent supabase-py query stand-in that RECORDS whether a count was requested.

    `count_arg` is the load-bearing recording: the WR-07 fix must request an exact count
    ONLY on the two grounding gate call sites (`strict=True`) and NEVER on the default path,
    which is also the chat agent-loop path and four `/folders` routes.
    """

    def __init__(self, rows, count=_NO_COUNT):
        self._rows = list(rows)
        self._count = count
        self.count_arg = None
        self.selected = None

    def select(self, *cols, count=None, **_kwargs):
        self.selected = cols[0] if cols else "*"
        self.count_arg = count
        return self

    def eq(self, *_a, **_k):
        return self

    def or_(self, *_a, **_k):
        return self

    def execute(self):
        resp = SimpleNamespace(data=list(self._rows))
        if self._count is not _NO_COUNT:
            resp.count = self._count
        return resp


class _FakeSupabase:
    """Per-table fake: `.table(name)` returns that table's recorder (created on demand)."""

    def __init__(self, **tables):
        self.tables = {
            name: (q if isinstance(q, _FakeQuery) else _FakeQuery(q))
            for name, q in tables.items()
        }

    def table(self, name):
        return self.tables.setdefault(name, _FakeQuery([]))


def _folder_rows(n: int) -> list[dict]:
    return [
        {
            "id": f"{i:08d}-0000-0000-0000-00000000000f",
            "user_id": _CALLER,
            "name": f"folder-{i}",
            "parent_id": None,
            "is_org_shared": False,
            "org_id": _ORG,
        }
        for i in range(n)
    ]


def _skill_rows() -> list[dict]:
    return [
        {
            "id": _REAL_SKILL,
            "name": "A Real Registered Skill",
            "user_id": _CALLER,
            "is_org_shared": False,
            "is_system": False,
            "org_id": _ORG,
            "is_enabled": True,
        }
    ]


def _healthy_client(*, folder_count: int = 2) -> _FakeSupabase:
    """A fake whose three grounding reads all succeed — the control for every degraded case."""
    return _FakeSupabase(
        folders=_FakeQuery(_folder_rows(folder_count)),
        org_members=_FakeQuery([{"org_id": _ORG}]),
        skills=_FakeQuery(_skill_rows()),
    )


# ── definition builders (shape-valid; mirrors test_182_validate.py) ───────────


def _definition(phases: list[dict], **extra) -> dict:
    base = {
        "slug": "degradation-wf",
        "version": 1,
        "name": "Degradation Workflow",
        "status": "draft",
        "business_requirement": _BR,
        "phases": phases,
    }
    base.update(extra)
    return base


def _llm_single(slug: str = "answer", index: int = 0, **config_extra) -> dict:
    cfg = {"phase_type": "llm_single", "prompt": "Answer the question."}
    cfg.update(config_extra)
    return {"slug": slug, "phase_index": index, "config": cfg, "validators": []}


# ── the consumer seams ────────────────────────────────────────────────────────


def _patch_degraded_bundle(monkeypatch, *degraded: str, skill_ids=(), tool_names=()):
    """Swap the ONE registry read for a bundle that reports itself DEGRADED.

    Patches the MODULE attribute (`app.services.harness.grounding`) — the seam both
    consumers resolve at call time (the `test_182_validate.py` posture).
    """
    from app.services.harness import grounding as g

    async def _fake_assemble(**_kwargs):
        return g.GroundingBundle(
            tools=sorted(tool_names),
            tool_names=set(tool_names),
            folders=[],
            skills=[],
            skill_ids=set(skill_ids),
            placeholders=[],
            degraded=frozenset(degraded),
        )

    monkeypatch.setattr(g, "assemble_grounding_bundle", _fake_assemble)


async def _validate(definition: dict, supabase=None):
    """Call the `/validate` handler DIRECTLY and return the ValidateResponse."""
    from app.api import workflows as wf
    from app.models.harness import WorkflowDefinition

    return await wf.validate_workflow(
        body=WorkflowDefinition.model_validate(definition),
        current_user={"id": _CALLER},
        supabase=object() if supabase is None else supabase,
    )


def _codes(response) -> set[str]:
    return {v.code for v in response.verdicts}


def _by_code(response, code: str):
    matches = [v for v in response.verdicts if v.code == code]
    assert matches, f"expected a {code!r} verdict, got {sorted(_codes(response))}"
    return matches[0]


# ═══ (A) WR-07 — the truncation-aware read, at the read itself ════════════════


def test_the_truncation_error_is_not_a_value_error():
    """`FolderReadTruncatedError` is a `RuntimeError`, DELIBERATELY not a `ValueError`.

    The ⊆ rule catches bare `ValueError` (`grounding._folder_scope_violations`). If a
    truncation were a `ValueError` it would be caught there and rendered as a `folder_scope`
    verdict — re-creating the exact false accusation this plan exists to close, one layer
    down (T-182-47). It must reach the caller that knows how to say "we could not check".
    """
    from app.utils.folder_utils import FolderReadTruncatedError

    assert issubclass(FolderReadTruncatedError, RuntimeError)
    assert not issubclass(FolderReadTruncatedError, ValueError), (
        "FolderReadTruncatedError became a ValueError subclass — the ⊆ rule's broad "
        "`except ValueError` would now swallow an infrastructure truncation and render it "
        "as a false folder_scope verdict (T-182-47)"
    )


@pytest.mark.asyncio
async def test_the_strict_read_raises_when_the_rows_are_short_of_the_reported_total():
    """A PostgREST `max-rows` truncation is DETECTED instead of silently returning a prefix.

    PRE-FIX OUTCOME: `fetch_all_folders` had no count and no limit, so a capped read returned
    a prefix indistinguishable from a complete answer — `folder_map` lost ancestors, the
    resolved project subtree shrank, and `assert_folder_scopes_subset` accused a correct
    definition of a `folder_scope` violation that (post-182-06) BLOCKS publish.
    """
    from app.utils.folder_utils import FolderReadTruncatedError, fetch_all_folders

    sb = _FakeSupabase(folders=_FakeQuery(_folder_rows(3), count=7))

    with pytest.raises(FolderReadTruncatedError):
        await fetch_all_folders(sb, fields="*", strict=True)

    assert sb.tables["folders"].count_arg == "exact", (
        "the strict read must ask PostgREST for an exact count — without it there is nothing "
        "to compare the returned row count against"
    )


@pytest.mark.asyncio
async def test_the_strict_read_returns_normally_on_a_complete_or_uncountable_response():
    """The negative controls: only a SHORT read is a truncation.

    A count equal to the row count is a complete read. A missing count (a mock, or a server
    that did not honour the header) and a non-integer count are UNUSABLE, never a truncation
    — the `isinstance` guard is required, not defensive noise: conftest's supabase is a
    `MagicMock`, so an unguarded truthiness check on `resp.count` would raise on every test.
    """
    from app.utils.folder_utils import fetch_all_folders

    rows = _folder_rows(3)

    complete = _FakeSupabase(folders=_FakeQuery(rows, count=3))
    assert await fetch_all_folders(complete, fields="*", strict=True) == rows

    no_count = _FakeSupabase(folders=_FakeQuery(rows))  # no `count` attribute at all
    assert await fetch_all_folders(no_count, fields="*", strict=True) == rows

    none_count = _FakeSupabase(folders=_FakeQuery(rows, count=None))
    assert await fetch_all_folders(none_count, fields="*", strict=True) == rows

    text_count = _FakeSupabase(folders=_FakeQuery(rows, count="7"))  # not an int
    assert await fetch_all_folders(text_count, fields="*", strict=True) == rows


@pytest.mark.asyncio
async def test_the_default_read_requests_no_count_and_never_raises():
    """THE BYTE-IDENTITY CONTROL. Every existing caller is unaffected BY CONSTRUCTION.

    `fetch_all_folders` is on the chat agent-loop path (`agent_loop.py`) and on four
    `/folders` routes. An unconditional `count="exact"` would add a COUNT(*) to every one of
    them (T-182-48). Driven against the SAME truncating response the strict test raises on:
    the default caller gets its rows, raises nothing, and asks for no count.
    """
    from app.utils.folder_utils import fetch_all_folders, fetch_visible_folders

    rows = _folder_rows(3)
    sb = _FakeSupabase(folders=_FakeQuery(rows, count=7), org_members=_FakeQuery([]))

    assert await fetch_all_folders(sb, fields="*") == rows
    assert sb.tables["folders"].count_arg is None, (
        "the DEFAULT folders read asked PostgREST for a count — that is a COUNT(*) added to "
        "the chat agent-loop path and four /folders routes (T-182-48)"
    )

    # ... and the same holds one layer up, through the visibility filter.
    sb2 = _FakeSupabase(folders=_FakeQuery(rows, count=7), org_members=_FakeQuery([]))
    assert await fetch_visible_folders(sb2, _CALLER) == rows
    assert sb2.tables["folders"].count_arg is None


# ═══ (B) the ONE degradation signal on the bundle ═════════════════════════════


@pytest.mark.asyncio
async def test_a_healthy_bundle_is_not_degraded():
    """The control for every case below: all three reads succeed -> `degraded` is EMPTY.

    Without this, a fix that marked every bundle degraded would pass the whole file while
    destroying the product (nothing would ever be grounded again).
    """
    from app.services.harness.grounding import assemble_grounding_bundle

    bundle = await assemble_grounding_bundle(supabase=_healthy_client(), user_id=_CALLER)

    assert bundle.degraded == frozenset()
    assert bundle.skill_ids == {_REAL_SKILL}
    assert len(bundle.folders) == 2
    assert bundle.tool_names  # the in-process registry is never degraded


@pytest.mark.asyncio
async def test_a_raising_skills_read_degrades_the_bundle_instead_of_emptying_it(monkeypatch):
    """WR-01 AT THE BUNDLE. A skills-read failure is RECORDED, not swallowed.

    PRE-FIX OUTCOME: `_skill_registry` swallowed the exception and returned `[]`, so the
    bundle came back SUCCESSFULLY with an empty registry and no trace of the failure — and
    every downstream membership test became vacuously false. This asserts the failure now
    travels on the bundle, while the fail-closed OUTCOME (no skill grounding) is unchanged.
    """
    from app.services.harness import grounding as g

    def _boom(*_a, **_k):
        raise RuntimeError("postgrest 503 on the org-gated skills read")

    monkeypatch.setattr(g, "_skill_registry", _boom)

    bundle = await g.assemble_grounding_bundle(supabase=_healthy_client(), user_id=_CALLER)

    assert bundle.degraded == frozenset({"skills"}), (
        "WR-01: a raising skills read produced a bundle that looks HEALTHY. Every skill "
        "reference in the author's definition would now be reported unregistered."
    )
    assert bundle.skills == []  # still fail-closed — the decision MOVED, it did not vanish
    assert bundle.skill_ids == set()
    # the folders half is untouched: one degraded read must not degrade the other registry
    assert bundle.folders, "a skills failure emptied the folder palette too"


@pytest.mark.asyncio
async def test_a_raising_skills_table_degrades_the_bundle_through_the_real_registry_read():
    """THE LITERAL WR-01 REPRODUCTION — the REAL `_skill_registry` against a real failure.

    The sibling above patches the registry function out. This one does not: it drives the
    genuine `_skill_registry` body against a client whose `skills` table raises, which is
    exactly the PostgREST 5xx / timeout / reset the review describes.

    PRE-FIX OUTCOME: `_skill_registry`'s own `except Exception: return []` absorbed it and
    the bundle came back looking healthy — no exception, no signal, an empty registry. This
    test is therefore the direct guard on the removed swallow: restore it and this fails.
    """
    from app.services.harness.grounding import assemble_grounding_bundle

    class _SkillsBoom(_FakeSupabase):
        def table(self, name):
            if name == "skills":
                raise RuntimeError("postgrest is down")
            return super().table(name)

    sb = _SkillsBoom(
        folders=_FakeQuery(_folder_rows(2)),
        org_members=_FakeQuery([{"org_id": _ORG}]),
    )

    bundle = await assemble_grounding_bundle(supabase=sb, user_id=_CALLER)

    assert bundle.degraded == frozenset({"skills"}), (
        "WR-01: the skills read failed and the bundle reports itself HEALTHY. Both consumers "
        "would now report every phase skill reference as unregistered — a factual accusation "
        "against a correct definition, sourced from an outage."
    )
    assert bundle.skill_ids == set()


@pytest.mark.asyncio
async def test_a_raising_folders_read_degrades_only_the_folders_registry(monkeypatch):
    """The folders half of the same signal — and the skills read still runs.

    PRE-FIX OUTCOME: the folders read had NO guard at any level, so a PostgREST error
    propagated straight out of `assemble_grounding_bundle` to the caller (WR-02's path 1).
    """
    from app.services.harness import grounding as g
    from app.utils import folder_utils as fu

    async def _boom(*_a, **_k):
        raise RuntimeError("postgrest 503 on the visible-folders read")

    monkeypatch.setattr(fu, "fetch_visible_folders", _boom)

    bundle = await g.assemble_grounding_bundle(supabase=_healthy_client(), user_id=_CALLER)

    assert bundle.degraded == frozenset({"folders"})
    assert bundle.folders == []
    assert bundle.skill_ids == {_REAL_SKILL}, (
        "the skills read was skipped because the folders read failed — one unreachable "
        "registry must not cost the author the other one"
    )


@pytest.mark.asyncio
async def test_a_truncated_folders_read_degrades_the_bundle_end_to_end():
    """WR-07 END TO END: a `max-rows` prefix reaches the bundle as a DEGRADATION.

    PRE-FIX OUTCOME: the prefix was accepted as the complete folder tree, so the palette
    silently lost org-shared folders and the ⊆ walk resolved a shrunken subtree — producing
    a FALSE `folder_scope` accusation rather than an honest "we could not check".

    The strict read on THIS call site covers the later ⊆ walk too: `assemble_grounding_bundle`
    runs FIRST on both consumers and reads the SAME table under the SAME cap, so a truncation
    is detected before `resolve_project_subtree` is ever reached.
    """
    from app.services.harness.grounding import assemble_grounding_bundle

    sb = _FakeSupabase(
        folders=_FakeQuery(_folder_rows(3), count=1000),  # PostgREST's default max-rows
        org_members=_FakeQuery([{"org_id": _ORG}]),
        skills=_FakeQuery(_skill_rows()),
    )

    bundle = await assemble_grounding_bundle(supabase=sb, user_id=_CALLER)

    assert "folders" in bundle.degraded
    assert bundle.folders == []
    assert sb.tables["folders"].count_arg == "exact"


@pytest.mark.asyncio
async def test_the_bundle_never_raises_to_its_caller_on_either_degradation(monkeypatch):
    """Both degradations are RETURNED, never raised — the property both consumers rely on.

    `/validate` is documented ALWAYS-HTTP-200 and publish's orchestration is sealed against
    raises, so a bundle that raised would defeat both. This drives the two failures together.
    """
    from app.services.harness import grounding as g
    from app.utils import folder_utils as fu

    async def _folders_boom(*_a, **_k):
        raise RuntimeError("folders read down")

    def _skills_boom(*_a, **_k):
        raise RuntimeError("skills read down")

    monkeypatch.setattr(fu, "fetch_visible_folders", _folders_boom)
    monkeypatch.setattr(g, "_skill_registry", _skills_boom)

    bundle = await g.assemble_grounding_bundle(supabase=_healthy_client(), user_id=_CALLER)

    assert bundle.degraded == frozenset({"folders", "skills"})
    assert bundle.folders == []
    assert bundle.skill_ids == set()
    assert bundle.tool_names, "the in-process tool registry cannot fail and must survive"


# ═══ (C) WR-01 at BOTH consumers — "could not check", never a false accusation ══


@pytest.mark.asyncio
async def test_validate_reports_grounding_unavailable_not_a_false_unregistered_skill(monkeypatch):
    """WR-01 AT `/validate`. A degraded registry must not accuse a valid skill reference.

    PRE-FIX OUTCOME: the bundle came back with `skill_ids = set()` and no signal, so rule 3
    reported `unregistered_skill` for the author's REAL id and the canvas painted that node
    red — telling the author to "fix" a reference that is perfectly correct.
    """
    _patch_degraded_bundle(monkeypatch, "skills")

    resp = await _validate(_definition([_llm_single("answer", 0, skill_ref=_REAL_SKILL)]))

    codes = _codes(resp)
    assert "unregistered_skill" not in codes, (
        "WR-01 REGRESSION: an unreachable skill registry was reported as the author's "
        f"skill reference {_REAL_SKILL} being unregistered. That is a factual accusation "
        "against a correct definition, manufactured out of an outage."
    )
    assert "unregistered_tool" not in codes and "folder_scope" not in codes
    verdict = _by_code(resp, "grounding_unavailable")
    assert verdict.phase is None  # an unreachable registry is not attributable to a node
    assert verdict.severity == "error"  # never the soft "incomplete" (the WR-05 posture)
    assert resp.ok is False
    assert "skills" in verdict.message  # names WHICH registry could not be resolved


@pytest.mark.asyncio
async def test_publish_blocks_with_grounding_unavailable_not_a_false_unregistered_skill():
    """WR-01 AT PUBLISH. Same bundle, same honest answer, on the ENFORCING side.

    PRE-FIX OUTCOME: publish blocked at `grounding_fidelity` with an `unregistered_skill`
    named failure quoting the author's valid id — and the stage's own docstring claimed it
    shared `_skill_registry`'s fail-closed posture, which was exactly the thing that was not
    true (the swallow was INVISIBLE to this wrapper).
    """
    from contextlib import ExitStack
    from unittest.mock import AsyncMock, patch
    from uuid import UUID, uuid4

    from app.services.harness import grounding as g
    from app.services.harness import publish_service

    definition = _definition([_llm_single("answer", 0, skill_ref=_REAL_SKILL)])
    definition_id = uuid4()
    row = {
        "id": definition_id,
        "slug": definition["slug"],
        "version": definition["version"],
        "name": definition["name"],
        "status": definition["status"],
        "definition": definition,
        "created_by": UUID(_CALLER),
    }

    drive = AsyncMock(return_value=(uuid4(), {"text": "x"}, "completed"))
    flip = AsyncMock(return_value=2)

    async def _degraded_assemble(**_kwargs):
        return g.GroundingBundle(degraded=frozenset({"skills"}))

    with ExitStack() as stack:
        stack.enter_context(patch("app.db.workflows.get_definition", AsyncMock(return_value=row)))
        stack.enter_context(patch("app.db.workflows.write_audit", AsyncMock()))
        stack.enter_context(patch("app.db.workflows.publish_definition", flip))
        stack.enter_context(patch.object(publish_service, "_drive_golden_run", drive))
        stack.enter_context(patch.object(publish_service, "_judge_golden_output", AsyncMock()))
        stack.enter_context(
            patch.object(
                publish_service, "_resolve_publish_supabase", AsyncMock(return_value=object())
            )
        )
        stack.enter_context(patch.object(g, "assemble_grounding_bundle", _degraded_assemble))
        result = await publish_service.publish(
            definition_id=definition_id,
            golden_input="a representative kickoff prompt",
            user={"id": _CALLER},
            pool=AsyncMock(),
            redis=AsyncMock(),
        )

    assert result["published"] is False
    assert result["blocked_stage"] == "grounding_fidelity"
    codes = [f.get("code") for f in result["named_failures"] if isinstance(f, dict)]
    assert codes == ["grounding_unavailable"], (
        "WR-01 REGRESSION on the publish side: an unreachable registry produced "
        f"{codes} instead of exactly one honest grounding_unavailable."
    )
    assert "unregistered_skill" not in codes
    drive.assert_not_called()  # never burn a real provider run on an unverifiable definition
    flip.assert_not_called()  # and certainly never mint a version


class _SkillsBoom(_FakeSupabase):
    """Healthy folders + org_members, a SKILLS read that raises — the WR-01 outage, exactly."""

    def table(self, name):
        if name == "skills":
            raise RuntimeError("postgrest 503 on the org-gated skills read")
        return super().table(name)


def _skills_boom_client() -> _SkillsBoom:
    return _SkillsBoom(
        folders=_FakeQuery(_folder_rows(2)),
        org_members=_FakeQuery([{"org_id": _ORG}]),
    )


@pytest.mark.asyncio
async def test_validate_end_to_end_over_a_raising_skills_read_never_accuses_the_reference():
    """WR-01 AT `/validate`, END TO END — nothing mocked between the read and the verdict.

    The two tests above inject a synthetic degraded bundle, which isolates the consumer
    branch but cannot see the swallow that CAUSED the defect. This one drives the REAL
    `assemble_grounding_bundle` and the REAL `_skill_registry` against a client whose skills
    read raises, so restoring the swallow re-opens WR-01 and this test fails.

    PRE-FIX OUTCOME (observed by exactly that mutation):
    `{'code': 'unregistered_skill', 'phase': 'answer', 'message': "phase 'answer' references
    a non-registered skill_ref '33333333-3333-3333-3333-333333333333'"}` — the author's real,
    valid id, called non-existent because a read returned 503.
    """
    resp = await _validate(
        _definition([_llm_single("answer", 0, skill_ref=_REAL_SKILL)]),
        supabase=_skills_boom_client(),
    )

    codes = _codes(resp)
    assert "unregistered_skill" not in codes, (
        "WR-01 REGRESSION (end to end): the skills read failed and the author was told their "
        f"valid skill reference {_REAL_SKILL} does not exist."
    )
    assert "grounding_unavailable" in codes
    assert _by_code(resp, "grounding_unavailable").severity == "error"
    assert resp.ok is False


@pytest.mark.asyncio
async def test_publish_end_to_end_over_a_raising_skills_read_never_accuses_the_reference():
    """WR-01 AT PUBLISH, END TO END — the real assembler, the real registry read.

    Same shape as the sibling above, on the ENFORCING side: `_resolve_publish_supabase` hands
    stage 2.6 a client whose skills read raises, and nothing else is faked between that read
    and the block. PRE-FIX OUTCOME: `blocked_stage="grounding_fidelity"` with a named failure
    accusing the author's valid reference — and no way for them to tell it from a real one.
    """
    from contextlib import ExitStack
    from unittest.mock import AsyncMock, patch
    from uuid import UUID, uuid4

    from app.services.harness import publish_service

    definition = _definition([_llm_single("answer", 0, skill_ref=_REAL_SKILL)])
    definition_id = uuid4()
    row = {
        "id": definition_id,
        "slug": definition["slug"],
        "version": definition["version"],
        "name": definition["name"],
        "status": definition["status"],
        "definition": definition,
        "created_by": UUID(_CALLER),
    }
    drive = AsyncMock(return_value=(uuid4(), {"text": "x"}, "completed"))
    flip = AsyncMock(return_value=2)

    with ExitStack() as stack:
        stack.enter_context(patch("app.db.workflows.get_definition", AsyncMock(return_value=row)))
        stack.enter_context(patch("app.db.workflows.write_audit", AsyncMock()))
        stack.enter_context(patch("app.db.workflows.publish_definition", flip))
        stack.enter_context(patch.object(publish_service, "_drive_golden_run", drive))
        stack.enter_context(patch.object(publish_service, "_judge_golden_output", AsyncMock()))
        stack.enter_context(
            patch.object(
                publish_service,
                "_resolve_publish_supabase",
                AsyncMock(return_value=_skills_boom_client()),
            )
        )
        result = await publish_service.publish(
            definition_id=definition_id,
            golden_input="a representative kickoff prompt",
            user={"id": _CALLER},
            pool=AsyncMock(),
            redis=AsyncMock(),
        )

    assert result["blocked_stage"] == "grounding_fidelity"
    codes = [f.get("code") for f in result["named_failures"] if isinstance(f, dict)]
    assert "unregistered_skill" not in codes, (
        f"WR-01 REGRESSION (end to end, publish side): got {codes}"
    )
    assert codes == ["grounding_unavailable"]
    drive.assert_not_called()
    flip.assert_not_called()


# ═══ (D) WR-07 end to end — a truncation is not a scope violation ═════════════


@pytest.mark.asyncio
async def test_validate_reports_grounding_unavailable_not_a_false_folder_scope():
    """WR-07 END TO END, through the REAL assembler and the REAL ⊆ rule.

    The folders read is TRUNCATED (1 row returned, 1000 reported). The definition is bound
    to a project and declares a per-phase `folder_scope` that is NOT in the returned prefix.

    PRE-FIX OUTCOME: the prefix was accepted as the whole tree, `resolve_project_subtree`
    resolved a shrunken subtree, and the author was told their phase's `folder_scope` is not
    a subset of the project — a fabricated governance violation that (post-182-06) BLOCKS
    publish. Nothing about the definition is wrong; the read was short.
    """
    sb = _FakeSupabase(
        folders=_FakeQuery(
            [
                {
                    "id": _PROJECT,
                    "user_id": _CALLER,
                    "name": "project-root",
                    "parent_id": None,
                    "is_org_shared": False,
                    "org_id": _ORG,
                }
            ],
            count=1000,  # PostgREST's default max-rows: 1000 exist, 1 came back
        ),
        org_members=_FakeQuery([{"org_id": _ORG}]),
        skills=_FakeQuery(_skill_rows()),
    )

    resp = await _validate(
        _definition(
            [_llm_single("answer", 0, folder_scope=[_OUTSIDE_FOLDER])],
            project_folder_id=_PROJECT,
        ),
        supabase=sb,
    )

    codes = _codes(resp)
    assert "folder_scope" not in codes, (
        "WR-07 REGRESSION: a truncated folders read was rendered as a folder_scope "
        "violation. The definition is correct; the read was short — and since 182-06 that "
        "false violation blocks publish."
    )
    assert "grounding_unavailable" in codes
    assert "folders" in _by_code(resp, "grounding_unavailable").message
    assert resp.ok is False


# ═══ (E) WR-02 — the route cannot 500 on a grounding read ════════════════════


class _ApiErrorLike(Exception):
    """Mirrors `postgrest.exceptions.APIError`'s shape: a plain `Exception` subclass.

    NOT a `ValueError` — which is precisely why the ⊆ rule's `except ValueError` never saw
    the real thing and it escaped `validate_workflow` as an HTTP 500.
    """


@pytest.mark.asyncio
async def test_a_postgrest_style_error_from_the_collector_is_a_200_not_a_500(monkeypatch):
    """WR-02, THE DIRECT REPRODUCTION. A non-`ValueError` off the ⊆ walk must not escape.

    PRE-FIX OUTCOME: `postgrest.exceptions.APIError` propagated out of the handler and
    FastAPI turned it into an HTTP 500 — on a route whose docstring promises ALWAYS 200 and
    which Phase 184 calls on every canvas edit. One transient blip became a 500 storm
    mid-authoring, with no verdict payload and nothing for the canvas to render.
    """
    from app.services.harness import grounding as g

    # The premise, PINNED rather than assumed — the whole finding rests on it.
    assert not issubclass(_ApiErrorLike, ValueError), (
        "the injected exception is a ValueError, so this test would prove nothing about the "
        "class of error that actually escapes (postgrest's APIError is not a ValueError)"
    )

    _patch_degraded_bundle(monkeypatch, tool_names={"search_documents"})  # healthy bundle

    async def _boom(*_a, **_k):
        raise _ApiErrorLike({"message": "JWT expired", "code": "PGRST301"})

    monkeypatch.setattr(g, "grounding_verdicts", _boom)

    resp = await _validate(_definition([_llm_single("answer", 0)]))  # must NOT raise

    assert "grounding_unavailable" in _codes(resp)
    assert _by_code(resp, "grounding_unavailable").severity == "error"
    assert resp.ok is False


@pytest.mark.asyncio
async def test_a_raise_from_the_registry_read_itself_is_a_200_not_a_500(monkeypatch):
    """The sibling escape path: `assemble_grounding_bundle` raising (WR-02's path 1).

    PRE-FIX OUTCOME: the same HTTP 500, one stage earlier — `fetch_visible_folders` had no
    guard at any level and it is the FIRST thing the handler touches.
    """
    from app.services.harness import grounding as g

    async def _boom(**_kwargs):
        raise _ApiErrorLike("connection reset by peer")

    monkeypatch.setattr(g, "assemble_grounding_bundle", _boom)

    resp = await _validate(_definition([_llm_single("answer", 0)]))  # must NOT raise

    assert "grounding_unavailable" in _codes(resp)
    assert resp.ok is False


# ═══ (F) the seal is SCOPED — the pure checks keep running ═══════════════════


@pytest.mark.asyncio
async def test_structural_verdicts_survive_a_degraded_grounding_read(monkeypatch):
    """A registry blip costs the author the THREE grounding rules, not the whole validation.

    `lint_workflow`, the D-13 business-requirement check and the interactive-phase check are
    PURE — no registry, nothing to fail — so they must run outside the seal and still
    contribute. A blanket `try` around the handler body would have discarded them, and a
    blanket `except` returning `ok: True` would have been WORSE than the 500 it replaced
    (SEED-131: it paints a possibly-broken workflow green).
    """
    _patch_degraded_bundle(monkeypatch, "folders", "skills")

    # non-contiguous indices [0, 2] -> bad_index + orphan_phase + no_terminal, and no
    # business_requirement -> the D-13 verdict.
    resp = await _validate(
        _definition(
            [_llm_single("first", 0), _llm_single("second", 2)],
            business_requirement=None,
        )
    )

    codes = _codes(resp)
    assert {"bad_index", "orphan_phase", "no_terminal"} <= codes, (
        "the structural lint verdicts vanished when grounding degraded — the seal is too "
        f"wide. Got {sorted(codes)}."
    )
    assert "business_requirement" in codes, "the pure D-13 check was swallowed by the seal"
    assert "grounding_unavailable" in codes
    assert resp.ok is False
    # the degraded message names BOTH unresolved registries, in sorted order
    assert "folders, skills" in _by_code(resp, "grounding_unavailable").message


# ═══ (G) the code is COMPOSED into the taxonomy, not hardcoded ═══════════════


def test_grounding_unavailable_is_known_to_the_classifier_and_classifies_error():
    """The constant-to-classifier link, pinned HERE by an explicit assertion.

    `test_182_severity_codes.py`'s drift scanner matches the token sequence `"code": "<name>"`
    in `grounding.py`'s source. This code is built from `GROUNDING_UNAVAILABLE_CODE`, never a
    quoted literal (deliberately — a literal would make the scanner demand it join
    `GROUNDING_VERDICT_CODES`, which `grounding_verdicts` does not emit). The scanner is
    therefore BLIND to it, so the link is asserted here rather than left as a loophole.

    Classification is `error` in BOTH `phases_empty` states: "we could not verify" must never
    paint the soft `incomplete`. An author shown "still building" would hit a hard publish
    block they were never warned about (the WR-05 posture 182-07 established).
    """
    from app.api import workflows
    from app.services.harness import grounding

    code = grounding.GROUNDING_UNAVAILABLE_CODE

    assert code in workflows._KNOWN_CODES, (
        "the degraded code is not composed into _KNOWN_CODES, so it reaches _severity as an "
        "UNKNOWN and logs a fail-loud warning on every degraded request"
    )
    assert code not in workflows._INCOMPLETE_CODES
    assert code in workflows._ERROR_CODES  # derived, not listed
    assert workflows._severity(code, phases_empty=False) == "error"
    assert workflows._severity(code, phases_empty=True) == "error"

    # ... and it is minted from ONE builder, whose dict is the finding shape both sides use.
    finding = grounding.grounding_unavailable_finding(frozenset({"skills"}))
    assert set(finding) == {"code", "phase", "message"}
    assert finding["code"] == code
    assert finding["phase"] is None
