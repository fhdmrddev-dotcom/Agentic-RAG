"""Phase 182 (VALID-01 / D-182-02 / D-182-06) — the grounding-extraction ANTI-DRIFT guard.

Plan 182-01 MOVED the grounding compute, the NL grounding render and the three
grounding-FIDELITY rules out of ``app.services.workflow_authoring`` into ONE shared source,
``app.services.harness.grounding``, so that NL generation, the ``POST /workflows/validate``
seam and the ``GET /workflows/grounding-bundle`` palette all read the SAME copy. This file
is the backstop for that move. It guards three things a passing test suite alone would NOT
catch:

  1. EXTRACTION PARITY — ``workflow_authoring._assemble_grounding`` still returns the exact
     ``(grounded_prompt, tool_names, skill_ids)`` tuple, and the NL prompt prose is pinned
     BYTE-FOR-BYTE against an explicit golden string. A silent reword of the grounding
     prompt is a behavior change to every NL generation; this catches it.
  2. ONE SOURCE (the D-182-06 red line) — the registry compute exists in ``grounding.py``
     and NOWHERE else; ``workflow_authoring`` holds only delegates; ``reachability.py``
     stays DB-free (Pitfall 1 — grounding must not poison its pure-import property).
     ``grounding.py`` exposes BOTH presentations over the SAME rules (short-circuit dict
     for NL-gen, per-node collector for ``/validate``).
  3. NL-GEN TEST COUNT — the Phase-103 regression suites still hold their full test COUNT.
     This is the Phase-177 coverage-loss lesson: a failures-only differential cannot see a
     silently DROPPED test, so an extraction that quietly deletes a regression test looks
     green. The counts are asserted as EXACT literals (never ``>=``); if you legitimately
     add a Phase-103 test, bump the literal here in the same commit.

CONVENTION (Phase 102 posture): imports INSIDE the test bodies; ``pytest.mark.asyncio`` on
async tests; no live DB, no provider call — every boundary is monkeypatched.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

_TESTS_DIR = Path(__file__).resolve().parent
_BACKEND_DIR = _TESTS_DIR.parent

_TEST_DEF_RE = re.compile(r"^\s*(?:async\s+)?def\s+test_")


def _count_test_defs_in_text(text: str) -> int:
    """Count module-level ``def test_`` / ``async def test_`` definitions, skipping
    commented-out lines (the ``grep -v '^#'`` hygiene the plan calls for)."""
    return sum(
        1
        for line in text.splitlines()
        if not line.lstrip().startswith("#") and _TEST_DEF_RE.match(line)
    )


def _count_test_defs(path: Path) -> int:
    return _count_test_defs_in_text(path.read_text(encoding="utf-8"))


def _fake_bundle():
    """A fixed, fully-populated ``GroundingBundle`` — the input to the byte-identical
    prompt pin. One folder, one skill, two tools, one placeholder: enough to exercise every
    branch of the render (tree indentation, skill line, tool join, placeholder join)."""
    from app.services.harness.grounding import GroundingBundle

    return GroundingBundle(
        tools=["execute_code", "search_documents"],  # == sorted(tool_names)
        tool_names={"search_documents", "execute_code"},
        folders=[{"id": "f1", "name": "Q3 Reports", "parent_id": None}],
        skills=[{"id": "s1", "name": "Legal Review"}],
        skill_ids={"s1"},
        placeholders=["client_name"],
    )


# The GOLDEN grounding prompt for ``_fake_bundle()`` bound to _PROJECT_ID. Written out as an
# explicit literal (NOT re-derived from the renderer) so this genuinely PINS the prose — a
# reworded heading or a lost blank line fails here.
_PROJECT_ID = "11111111-1111-1111-1111-111111111111"
_GOLDEN_PROMPT = (
    "## Grounding (use ONLY these ids / names)\n"
    "\n"
    f"The workflow is BOUND to project folder id={_PROJECT_ID}. Any per-phase "
    "folder_scope must be inside this folder's subtree.\n"
    "\n"
    "### KB folder tree (name + id)\n"
    "- Q3 Reports  (id=f1)\n"
    "\n"
    "### Tool registry — names eligible for an `available_tools` whitelist\n"
    "execute_code, search_documents\n"
    "\n"
    "### Skill registry (enabled; owner + global) — ids eligible for `skill_ref`\n"
    "- Legal Review (id=s1)\n"
    "\n"
    # ⚠ SUPERSEDED 2026-08-15. This line read, from Phase 182 until Phase 193.1:
    #     "### Template placeholder fields (if the workflow must fill a template)\n"
    # Phase 193.1's D-26 replaced that ONE hedged heading with TWO ASSERTIVE ARMS
    # (`grounding.py:618-632`), because the hedge was measured to SUPPRESS the branch it
    # was meant to license: three `POST /workflows/generate` calls out of three emitted
    # 0 `render_template` phases while the names were reaching the prompt intact. The old
    # wording is kept here rather than overwritten so a later reader can see WHAT changed
    # and why this pin moved — the string below is not a reword, it is a different claim.
    #
    # `_fake_bundle()` sets `placeholders=["client_name"]`, so this pins the PRESENT arm.
    # ⚠ The ABSENT arm has no byte pin in this file; D-26's "the two arms share no
    # sentence" property is guarded in Phase 193.1's own suite, not here.
    "### Template placeholder fields — the user HAS attached a template document "
    "to this workflow; the final deliverable MUST therefore be an `llm_emit` phase "
    "with `emitter: 'render_template'` that fills EXACTLY the fields named on the "
    "next line\n"
    "client_name\n"
)


@pytest.mark.asyncio
async def test_assemble_grounding_returns_byte_identical_tuple(monkeypatch):
    """``_assemble_grounding`` delegates to the shared source and returns the IDENTICAL
    ``(str, set, set)`` tuple NL generation has always received (D-182-02).

    The compute boundary is monkeypatched (a fixed ``GroundingBundle``) so no DB is
    touched; the RENDER runs for real and is pinned against ``_GOLDEN_PROMPT`` byte-for-byte.
    """
    import app.services.harness.grounding as grounding
    import app.services.workflow_authoring as wa

    bundle = _fake_bundle()
    seen: dict = {}

    async def _fake_assemble(**kwargs):
        seen.update(kwargs)
        return bundle

    # ``_assemble_grounding`` imports the compute function-locally FROM the grounding
    # module → patch it on that module so the in-function import picks up the patch.
    monkeypatch.setattr(grounding, "assemble_grounding_bundle", _fake_assemble)

    result = await wa._assemble_grounding(
        supabase=object(),
        pool=None,
        user_id="u1",
        project_folder_id=_PROJECT_ID,
    )

    # The tuple CONTRACT: exactly 3 members, (str, set, set) — the shape the Phase-103
    # monkeypatch seam (`monkeypatch.setattr(wa, "_assemble_grounding", ...)`) mimics.
    assert isinstance(result, tuple)
    assert len(result) == 3
    grounded, tool_names, skill_ids = result
    assert isinstance(grounded, str)
    assert isinstance(tool_names, set)
    assert isinstance(skill_ids, set)

    # The VALUES come straight off the shared bundle (no re-derivation in the delegate).
    assert tool_names == bundle.tool_names
    assert skill_ids == bundle.skill_ids

    # The prose is byte-identical to the pre-extraction render.
    assert grounded == _GOLDEN_PROMPT

    # The delegate forwards the owner scope + the project binding unchanged (T-182-03 —
    # the move must not widen the palette to another user).
    assert seen["user_id"] == "u1"
    assert seen["project_folder_id"] == _PROJECT_ID


@pytest.mark.asyncio
async def test_render_grounding_prompt_is_the_one_render(monkeypatch):
    """``render_grounding_prompt`` called DIRECTLY produces the same golden prose — i.e.
    the delegate adds nothing and the render is genuinely the single source of the NL
    grounding string (the ``/grounding-bundle`` palette and NL-gen cannot diverge)."""
    from app.services.harness.grounding import render_grounding_prompt

    assert render_grounding_prompt(_fake_bundle(), _PROJECT_ID) == _GOLDEN_PROMPT

    # The unbound (whole-KB) branch of the SAME render — the only other project_line shape.
    unbound = render_grounding_prompt(_fake_bundle(), None)
    assert "The workflow is NOT bound to a project folder (whole-KB)." in unbound
    assert "BOUND to project folder" not in unbound


def test_grounding_is_the_one_source():
    """The D-182-06 red line, asserted structurally over the source files.

    ``grounding.py`` owns the registry compute and BOTH presentations of the fidelity
    rules; ``workflow_authoring.py`` holds only delegates; ``reachability.py`` stays DB-free.
    """
    from app.services.harness.grounding import (  # importable = the shared surface exists
        GroundingBundle,
        assemble_grounding_bundle,
        business_requirement_missing,
        grounding_verdicts,
        render_grounding_prompt,
    )

    for symbol in (
        GroundingBundle,
        assemble_grounding_bundle,
        business_requirement_missing,
        grounding_verdicts,
        render_grounding_prompt,
    ):
        assert symbol is not None

    grounding_src = (
        _BACKEND_DIR / "app" / "services" / "harness" / "grounding.py"
    ).read_text(encoding="utf-8")
    authoring_src = (
        _BACKEND_DIR / "app" / "services" / "workflow_authoring.py"
    ).read_text(encoding="utf-8")
    reachability_src = (
        _BACKEND_DIR / "app" / "services" / "harness" / "reachability.py"
    ).read_text(encoding="utf-8")

    # The registry compute lives in grounding.py ...
    assert "fetch_visible_folders" in grounding_src
    assert "get_tools" in grounding_src
    assert "_skill_registry" in grounding_src
    assert "run_in_threadpool" in grounding_src  # D-v2.5-01 wrap preserved on the move
    # ... and the ⊆ check is REUSED verbatim, never re-derived.
    assert "assert_folder_scopes_subset" in grounding_src

    # ... and NOWHERE else. workflow_authoring must hold NO second copy.
    for duplicated in ("fetch_visible_folders", "get_tools", "_skill_registry", "_render_folder_tree"):
        assert duplicated not in authoring_src, (
            f"{duplicated!r} reappeared in workflow_authoring.py — the grounding compute "
            "must exist ONLY in harness/grounding.py (D-182-06 one-source red line)"
        )
    assert "from app.services.harness.grounding import" in authoring_src
    assert "return grounded, bundle.tool_names, bundle.skill_ids" in authoring_src

    # Pitfall 1: reachability stays PURE — grounding's DB reads must never land there.
    for db_marker in ("folder_utils", "supabase", "_skill_registry"):
        assert db_marker not in reachability_src, (
            f"{db_marker!r} leaked into reachability.py — it is documented PURE (no I/O, "
            "no DB) so /validate can import lint_workflow import-light (Pitfall 1)"
        )

    # Publish stage-1 shares the D-13 predicate (Pitfall 4 — one source even for a one-liner).
    publish_src = (
        _BACKEND_DIR / "app" / "services" / "harness" / "publish_service.py"
    ).read_text(encoding="utf-8")
    assert "business_requirement_missing" in publish_src
    assert '(definition.business_requirement or "").strip()' not in publish_src


@pytest.mark.asyncio
async def test_two_presentations_over_the_same_rules(monkeypatch):
    """``grounding_verdicts`` (per-node COLLECTOR) and ``_check_grounding_fidelity``
    (SHORT-CIRCUIT dict) are two presentations of ONE rule set (D-182-02).

    Same definition, same registries: the collector reports EVERY violation keyed by phase
    slug; the wrapper reports the FIRST as the historical ``grounding_failed`` dict. If a
    future edit re-implements a rule in only one of them, this diverges and fails.
    """
    from app.models.harness import WorkflowDefinition
    from app.services.harness.grounding import _check_grounding_fidelity, grounding_verdicts

    wd = WorkflowDefinition.model_validate(
        {
            "slug": "two-bad-phases",
            "version": 1,
            "name": "Two Bad Phases",
            "status": "draft",
            "phases": [
                {
                    "slug": "research",
                    "phase_index": 0,
                    "config": {
                        "phase_type": "llm_agent",
                        "prompt": "Research.",
                        "available_tools": ["not_a_real_tool"],
                    },
                    "validators": [],
                },
                {
                    "slug": "write",
                    "phase_index": 1,
                    "config": {
                        "phase_type": "llm_agent",
                        "prompt": "Write.",
                        "available_tools": ["also_fake"],
                    },
                    "validators": [],
                },
            ],
        }
    )
    registries = {"tool_names": {"search_documents"}, "skill_ids": set()}

    # The COLLECTOR sees BOTH violations, each keyed to its phase slug (SC#4 per-node).
    verdicts = await grounding_verdicts(wd, supabase=object(), user_id="u1", **registries)
    assert [v["phase"] for v in verdicts] == ["research", "write"]
    assert {v["code"] for v in verdicts} == {"unregistered_tool"}

    # The SHORT-CIRCUIT wrapper returns the historical dict for the FIRST violation only.
    failure = await _check_grounding_fidelity(wd, supabase=object(), user_id="u1", **registries)
    assert failure == {
        "ok": False,
        "error": "grounding_failed",
        "detail": "phase 'research' references a non-registered tool 'not_a_real_tool'",
    }

    # A clean definition: BOTH presentations agree it is clean.
    clean = {"tool_names": {"not_a_real_tool", "also_fake"}, "skill_ids": set()}
    assert await grounding_verdicts(wd, supabase=object(), user_id="u1", **clean) == []
    assert await _check_grounding_fidelity(wd, supabase=object(), user_id="u1", **clean) is None


def test_nl_gen_regression_test_count_unchanged():
    """COUNT GUARD (the Phase-177 coverage-loss lesson).

    The Phase-103 NL-gen + grounding-fidelity suites are THE extraction regression backstop.
    A failures-only differential cannot see a silently DELETED test, so pin the exact counts.
    Bump these literals only when a Phase-103 test is deliberately added/removed.

    ⚠ THIS FILE IS INVISIBLE TO EVERY PHASE-SCOPE PYTEST COMMAND (D-189-DEF-01). It is not in
    the nine-file 189-scope command from ``189-RESEARCH.md`` §D15, nor in the ten-file variant
    189-02 introduced, so a phase whose standing baseline is those scopes cannot see this pin
    go RED. That is exactly how it stayed RED for the whole of Phase 189 while every reported
    gate read green. Whoever narrows a scope command next: this file belongs in it.

    ⚠ THE FIDELITY PIN MOVED 2 → 8 ACROSS PHASE 189, and every step is dated rather than
    asserted (``git show <ref>:<path> | grep -cE '^(async )?def test_'``):

    | Ref             | defs | What added them                                        |
    |-----------------|------|--------------------------------------------------------|
    | ``fe7bd092~1``  | 2    | the pre-189 baseline this literal used to hold           |
    | ``fe7bd092``    | 6    | 189-02 Task 2 — the D-20 leak guards (pin went RED HERE) |
    | ``b6225aec~1``  | 7    | 189-04 — the ``EXTERNAL_ACTION_CAPABILITIES`` union case |
    | ``b6225aec``    | 8    | review finding CR-01 — the negative control proving a    |
    |                 |      | capability on an ``llm_agent`` step STILL blocks         |

    All six additions are deliberate and none replaced a deleted test, so the guard's own
    contract ("bump only on a deliberate add/remove") is satisfied by bumping, not by relaxing
    the assertion to ``>=``. A floor would answer a different question than the one the
    Phase-177 lesson asked: an exact count is what catches a silent swap of one test for
    another, and that is the failure this backstop exists for.
    """
    fidelity = _TESTS_DIR / "unit" / "test_103_grounding_fidelity.py"
    nl_generate = _TESTS_DIR / "unit" / "test_103_nl_generate.py"

    assert fidelity.exists(), f"the grounding-fidelity backstop is GONE: {fidelity}"
    assert nl_generate.exists(), f"the NL-gen backstop is GONE: {nl_generate}"

    assert _count_test_defs(fidelity) == 8, (
        "test_103_grounding_fidelity.py must hold exactly 8 tests — a dropped grounding "
        "test silently removes the extraction backstop (Phase-177 lesson)"
    )
    assert _count_test_defs(nl_generate) == 6, (
        "test_103_nl_generate.py must hold exactly 6 tests — a dropped NL-gen test "
        "silently removes the extraction backstop (Phase-177 lesson)"
    )


def test_count_guard_has_teeth():
    """The count guard is only worth having if the counter is correct — prove it counts
    real definitions, ignores commented-out ones, and does not miss ``async def``."""
    sample = "\n".join(
        [
            "def test_plain():",
            "    pass",
            "async def test_async():",
            "    pass",
            "# def test_commented_out():",
            "  # async def test_indented_comment():",
            "def helper_not_a_test():",
            "    pass",
        ]
    )
    assert _count_test_defs_in_text(sample) == 2
    assert _count_test_defs_in_text("") == 0
