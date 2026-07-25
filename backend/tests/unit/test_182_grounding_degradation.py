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
