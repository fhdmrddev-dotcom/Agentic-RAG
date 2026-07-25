"""Phase 182 gap-closure (SC#4 / D-182-03 / D-182-06) — the `folder_scope` verdict is
keyed to the OFFENDING PHASE, structurally.

The 182 verification found the one grounding-fidelity rule that is genuinely per-phase
(`folder_scope`) emitted with `phase: None`, stranding the offending slug in free-text
prose. A canvas consumer could only attribute it to a node by REGEXING the message —
exactly the client-side re-derivation the D-182-06 red line forbids.

The round-2 review then found the SECOND half of the same defect (WR-04): 182-04 fixed the
KEYING but not the MULTIPLICITY. `assert_folder_scopes_subset` raised inside its
`for phase in definition.phases` loop, so a definition with three out-of-subtree phases
still produced exactly ONE verdict — the author fixes node A, re-validates, and node B
lights up. Phase 184 paints per-node badges from this verdict, so later offenders rendered
CLEAN. The fix moved the ⊆ walk into a non-raising `scope.folder_scope_violations`, with
`assert_folder_scopes_subset` re-raising `violations[0]` as its short-circuit presentation.

This file is the regression proof, in five layers:

  1. SCOPE level    — the REAL `assert_folder_scopes_subset` raises a `ValueError`
                      SUBCLASS carrying the offending slug on `.phase_slug`, with a
                      BYTE-IDENTICAL message (asserted against a written-out golden
                      literal, never re-derived from the source).
  1b. MULTIPLICITY  — `scope.folder_scope_violations` (the ONE ⊆ walk) is non-raising and
     at the SOURCE   returns EVERY offending phase in author order, resolving the subtree
                      exactly once; the raising form still reports the first offender only.
  2. CALLER level   — `pytest.raises(ValueError, ...)` still catches it, so
                      `workflow_kickoff`'s 400, `runs.py`'s best-effort Continue and
                      `harness_engine`'s resume fallback keep working BY CONSTRUCTION.
  3. COLLECTOR level— `grounding.grounding_verdicts` threads that slug onto the
                      `folder_scope` verdict's `phase` field (the SC#4 guard: this FAILS
                      if `phase` ever reverts to `None`), proven BOTH with a hand-faked
                      violation AND end-to-end through the real ⊆ check — and emits ONE
                      verdict PER offending phase (the WR-04 guard), while the
                      short-circuit presentation still reports only the first. Rule 1's
                      new plurality is also proven to compose with the already-plural
                      rules 2/3, preserving verdict order.
  4. DEGRADATION    — a PLAIN `ValueError` off the ⊆ path (a test double / a future
                      non-phase-specific failure) still yields a SINGLE `phase: None`
                      verdict and never raises, so the always-HTTP-200 `/validate`
                      contract holds. Its seam is the PLURAL `folder_scope_violations`,
                      which is what the collector consumes.

CONVENTION (Phase 102 posture): imports INSIDE the test bodies. Offline only — no DB:
`assert_folder_scopes_subset` resolves `resolve_project_subtree` as a MODULE global, so
monkeypatching that one seam runs the REAL ⊆ walk with a fake subtree.
"""

from __future__ import annotations

from uuid import uuid4

import pytest

# Fixed ids so the golden message literal below can be written out by hand (b).
_PROJECT = "11111111-1111-1111-1111-111111111111"
_CHILD = "44444444-4444-4444-4444-444444444444"
_OUTSIDE = "22222222-2222-2222-2222-222222222222"

# The BYTE-IDENTICAL message contract. Written out in full, NOT re-derived from
# scope.py's f-string — a re-derivation would pass even if the wording changed, and
# `workflow_kickoff`'s HTTP 400 `detail`, `_grounding_failed(...)`'s `detail`, and
# `test_098_scope_governance`'s `match=` all depend on this exact text.
_GOLDEN_MESSAGE = (
    "phase 'answer' folder_scope is not a subset of the project subtree: "
    "['22222222-2222-2222-2222-222222222222']"
)


def _scoped_definition(*, scope: list[str], slug: str = "answer", bound: bool = True):
    """A shape-valid single-phase definition, optionally bound to `_PROJECT`."""
    from app.models.harness import WorkflowDefinition

    config: dict = {"phase_type": "llm_agent", "prompt": "Answer.", "available_tools": []}
    if scope:
        config["folder_scope"] = scope
    payload: dict = {
        "slug": "scoped-wf",
        "version": 1,
        "name": "Scoped Workflow",
        "status": "draft",
        "phases": [
            {"slug": slug, "phase_index": 0, "config": config, "validators": []}
        ],
    }
    if bound:
        payload["project_folder_id"] = _PROJECT
    return WorkflowDefinition.model_validate(payload)


def _multi_phase_definition(phases: list[dict], *, bound: bool = True):
    """A shape-valid MULTI-phase definition — the multiplicity layer's builder (WR-04).

    Each entry is ``{"slug": ..., "scope": [...] | None, "tools": [...] | None}``. The
    single-phase ``_scoped_definition`` above is deliberately left untouched (every
    pre-WR-04 test still drives it); this sibling exists because the whole point of the
    multiplicity layer is that SEVERAL phases are out of subtree in ONE definition, and
    the mixed-rule test additionally needs a phase that offends a DIFFERENT rule.
    """
    from app.models.harness import WorkflowDefinition

    built: list[dict] = []
    for index, spec in enumerate(phases):
        config: dict = {
            "phase_type": "llm_agent",
            "prompt": "Answer.",
            "available_tools": list(spec.get("tools") or []),
        }
        if spec.get("scope"):
            config["folder_scope"] = spec["scope"]
        built.append(
            {
                "slug": spec["slug"],
                "phase_index": index,
                "config": config,
                "validators": [],
            }
        )
    payload: dict = {
        "slug": "multi-scoped-wf",
        "version": 1,
        "name": "Multi Scoped Workflow",
        "status": "draft",
        "phases": built,
    }
    if bound:
        payload["project_folder_id"] = _PROJECT
    return WorkflowDefinition.model_validate(payload)


def _three_offenders():
    """The canonical WR-04 shape: phases `a`, `b`, `c` ALL out of subtree."""
    return _multi_phase_definition(
        [
            {"slug": "a", "scope": [_OUTSIDE]},
            {"slug": "b", "scope": [_OUTSIDE]},
            {"slug": "c", "scope": [_OUTSIDE]},
        ]
    )


def _patch_subtree(monkeypatch, subtree: list[str] | None):
    """Fake ONLY the subtree resolution so the REAL ⊆ walk runs (no DB, no second walk)."""
    from app.services.harness import scope as scope_mod

    async def _fake_resolve(project_folder_id, *, supabase, user_id):
        return subtree

    monkeypatch.setattr(scope_mod, "resolve_project_subtree", _fake_resolve)


# ── 1) SCOPE level — the real check supplies the slug structurally ─────────────


@pytest.mark.asyncio
async def test_real_check_raises_typed_error_carrying_the_offending_slug(monkeypatch):
    """The REAL `assert_folder_scopes_subset` (not a test double) raises
    `FolderScopeSubsetError` — a `ValueError` SUBCLASS — carrying the offending phase
    slug on `.phase_slug`. This is the NON-TAUTOLOGICAL proof: the slug comes out of the
    production ⊆ walk, so `grounding.py` never has to parse the message (D-182-06)."""
    from app.services.harness.scope import FolderScopeSubsetError, assert_folder_scopes_subset

    _patch_subtree(monkeypatch, [_PROJECT, _CHILD])

    with pytest.raises(FolderScopeSubsetError) as excinfo:
        await assert_folder_scopes_subset(
            _scoped_definition(scope=[_OUTSIDE]), supabase=object(), user_id="u1"
        )

    exc = excinfo.value
    assert isinstance(exc, ValueError)  # every pre-existing `except ValueError` still catches
    assert exc.phase_slug == "answer"  # the STRUCTURAL channel (SC#4)


@pytest.mark.asyncio
async def test_raised_message_is_byte_identical_to_the_golden_literal(monkeypatch):
    """`str(exc)` is UNCHANGED by the typed-exception change.

    Compared against a hand-written literal (never re-derived from scope.py), because the
    `{ok, error, detail}` short-circuit dict, `workflow_kickoff`'s HTTP-400 `detail`, and
    `test_098_scope_governance`'s `match="is not a subset"` all pin this exact wording."""
    from app.services.harness.scope import assert_folder_scopes_subset

    _patch_subtree(monkeypatch, [_PROJECT, _CHILD])

    with pytest.raises(ValueError) as excinfo:
        await assert_folder_scopes_subset(
            _scoped_definition(scope=[_OUTSIDE]), supabase=object(), user_id="u1"
        )

    assert str(excinfo.value) == _GOLDEN_MESSAGE
    # `super().__init__(message)` keeps `args` single-valued too — anything unpacking
    # `exc.args` (logging formatters, re-raises) behaves exactly as before.
    assert excinfo.value.args == (_GOLDEN_MESSAGE,)


@pytest.mark.asyncio
async def test_existing_value_error_callers_still_catch_it(monkeypatch):
    """CALLER COMPATIBILITY: `pytest.raises(ValueError, match="is not a subset")` — the
    literal contract `test_098_scope_governance::test_narrow_only_reject` asserts, and the
    same clause `workflow_kickoff.py` (→ 400), `runs.py` and `harness_engine.py` catch."""
    from app.services.harness.scope import assert_folder_scopes_subset

    _patch_subtree(monkeypatch, [_PROJECT, _CHILD])

    with pytest.raises(ValueError, match="is not a subset"):
        await assert_folder_scopes_subset(
            _scoped_definition(scope=[_OUTSIDE]), supabase=object(), user_id="u1"
        )


@pytest.mark.asyncio
async def test_clean_and_unbound_definitions_still_raise_nothing(monkeypatch):
    """The ⊆ walk itself is UNCHANGED: an in-subtree scope and an unbound workflow are
    both no-ops (the early return on `resolve_project_subtree(...) is None`)."""
    from app.services.harness.scope import assert_folder_scopes_subset

    # (a) scope ⊆ subtree → clean
    _patch_subtree(monkeypatch, [_PROJECT, _CHILD])
    await assert_folder_scopes_subset(
        _scoped_definition(scope=[_CHILD]), supabase=object(), user_id="u1"
    )

    # (b) unbound workflow (project_folder_id absent → resolver returns None) → no-op
    _patch_subtree(monkeypatch, None)
    await assert_folder_scopes_subset(
        _scoped_definition(scope=[], bound=False), supabase=object(), user_id="u1"
    )


# ── 1b) MULTIPLICITY at the SOURCE — ONE walk, every offender (WR-04) ─────────


@pytest.mark.asyncio
async def test_collector_returns_one_violation_per_offending_phase(monkeypatch):
    """WR-04 at the RULE-SOURCE layer: `folder_scope_violations` is NON-raising and returns
    EVERY offending phase, in `definition.phases` order, each carrying its own slug.

    This is the half of WR-04 that lives below `grounding.py`. `assert_folder_scopes_subset`
    used to `raise` INSIDE its `for phase in definition.phases` loop, so the rule physically
    could not report more than one offender — no amount of collecting one layer up could have
    recovered the others. The non-raising form is the ONE walk; the raising form below is a
    presentation over it (D-182-06: the ⊆ walk is never re-derived, here or anywhere).
    """
    from app.services.harness.scope import FolderScopeSubsetError, folder_scope_violations

    _patch_subtree(monkeypatch, [_PROJECT, _CHILD])

    violations = await folder_scope_violations(
        _three_offenders(), supabase=object(), user_id="u1"
    )

    assert [v.phase_slug for v in violations] == ["a", "b", "c"], (
        "WR-04: the ⊆ rule must report EVERY out-of-subtree phase, in the order the author "
        f"drew them — got {[getattr(v, 'phase_slug', None) for v in violations]!r}"
    )
    assert all(isinstance(v, FolderScopeSubsetError) for v in violations)
    # Each violation carries ITS OWN message — hand-written literals, never re-derived from
    # scope.py's f-string (a re-derivation would pass even if the wording drifted).
    assert [str(v) for v in violations] == [
        "phase 'a' folder_scope is not a subset of the project subtree: "
        f"['{_OUTSIDE}']",
        "phase 'b' folder_scope is not a subset of the project subtree: "
        f"['{_OUTSIDE}']",
        "phase 'c' folder_scope is not a subset of the project subtree: "
        f"['{_OUTSIDE}']",
    ]


@pytest.mark.asyncio
async def test_collector_is_empty_for_single_clean_and_unbound_definitions(monkeypatch):
    """One offender → a ONE-element list; a clean scope and an unbound workflow → `[]`.

    The single-offender case is the 182-04 behaviour, preserved: multiplicity must not
    change what a one-bad-phase definition reports."""
    from app.services.harness.scope import folder_scope_violations

    _patch_subtree(monkeypatch, [_PROJECT, _CHILD])

    one = await folder_scope_violations(
        _scoped_definition(scope=[_OUTSIDE]), supabase=object(), user_id="u1"
    )
    assert [v.phase_slug for v in one] == ["answer"]
    assert str(one[0]) == _GOLDEN_MESSAGE  # byte-identical to the raising form's message

    clean = await folder_scope_violations(
        _scoped_definition(scope=[_CHILD]), supabase=object(), user_id="u1"
    )
    assert clean == []

    _patch_subtree(monkeypatch, None)  # unbound → nothing to bound against
    unbound = await folder_scope_violations(
        _scoped_definition(scope=[], bound=False), supabase=object(), user_id="u1"
    )
    assert unbound == []


@pytest.mark.asyncio
async def test_collector_resolves_the_subtree_exactly_once(monkeypatch):
    """The subtree is resolved ONCE for the whole definition, not once per phase.

    Removing the early exit must not turn one DB-backed folder-tree walk into N of them
    (T-182-43). A counting fake is the only honest proof — a per-phase resolve would still
    return the right answer, just N times."""
    from app.services.harness import scope as scope_mod
    from app.services.harness.scope import folder_scope_violations

    calls: list[str] = []

    async def _counting_resolve(project_folder_id, *, supabase, user_id):
        calls.append(str(project_folder_id))
        return [_PROJECT, _CHILD]

    monkeypatch.setattr(scope_mod, "resolve_project_subtree", _counting_resolve)

    violations = await folder_scope_violations(
        _three_offenders(), supabase=object(), user_id="u1"
    )

    assert len(violations) == 3
    assert calls == [_PROJECT], (
        "the subtree must be resolved exactly ONCE per collector call — "
        f"observed {len(calls)} resolutions for a 3-phase definition"
    )


@pytest.mark.asyncio
async def test_raising_form_reports_the_first_offender_only(monkeypatch):
    """The SHORT-CIRCUIT presentation is unchanged: `assert_folder_scopes_subset` still
    raises for the FIRST offending phase, with a byte-identical message, `args` and slug.

    The two presentations diverge DELIBERATELY. Every `except ValueError` caller
    (`workflow_kickoff`'s 400, `runs.py`'s Continue fallback, `harness_engine`'s resume
    fallback, the NL-gen short-circuit) sees exactly what it saw before WR-04."""
    from app.services.harness.scope import FolderScopeSubsetError, assert_folder_scopes_subset

    _patch_subtree(monkeypatch, [_PROJECT, _CHILD])

    with pytest.raises(FolderScopeSubsetError) as excinfo:
        await assert_folder_scopes_subset(_three_offenders(), supabase=object(), user_id="u1")

    expected = (
        "phase 'a' folder_scope is not a subset of the project subtree: " f"['{_OUTSIDE}']"
    )
    assert excinfo.value.phase_slug == "a"  # first offender, not "the last one collected"
    assert str(excinfo.value) == expected
    assert excinfo.value.args == (expected,)


# ── 2) COLLECTOR level — the slug reaches the verdict (THE SC#4 GUARD) ─────────


def _folder_scope_verdict(verdicts: list[dict]) -> dict:
    matches = [v for v in verdicts if v["code"] == "folder_scope"]
    assert matches, f"expected a folder_scope verdict, got {[v['code'] for v in verdicts]}"
    return matches[0]


@pytest.mark.asyncio
async def test_grounding_verdicts_keys_folder_scope_to_the_offending_phase(monkeypatch):
    """SC#4 REGRESSION GUARD — `grounding_verdicts` emits `folder_scope` with a POPULATED
    `phase`, read off the typed exception's `phase_slug`.

    This test FAILS if `phase` ever reverts to `None`. That regression is exactly the
    182-VERIFICATION BLOCKER: an unkeyed verdict forces a canvas consumer to regex the
    message to attribute the finding to a node (the D-182-06 red line).

    SEAM: patches `scope.folder_scope_violations` — the LIST form the collector consumes
    since WR-04. (The raising `assert_folder_scopes_subset` is the NL-generation
    presentation; it is exercised directly by the scope-level layer above and by
    `test_short_circuit_dict_is_byte_identical_after_the_tuple_change` below.) The
    SUBJECT of this test is unchanged: the slug must reach `verdict['phase']`."""
    from app.services.harness import grounding, scope as scope_mod
    from app.services.harness.scope import FolderScopeSubsetError

    async def _one_typed_violation(definition, *, supabase, user_id):
        return [
            FolderScopeSubsetError(
                "phase 'p1' folder_scope is not a subset of the project subtree: "
                f"['{_OUTSIDE}']",
                phase_slug="p1",
            )
        ]

    monkeypatch.setattr(scope_mod, "folder_scope_violations", _one_typed_violation)

    verdicts = await grounding.grounding_verdicts(
        _scoped_definition(scope=[_OUTSIDE]),
        supabase=object(),
        user_id="u1",
        tool_names=set(),
        skill_ids=set(),
    )

    verdict = _folder_scope_verdict(verdicts)
    assert verdict["phase"] == "p1", (
        "SC#4 REGRESSION: the folder_scope verdict lost its per-node key. The offending "
        "slug must ride FolderScopeSubsetError.phase_slug onto verdict['phase'], exactly "
        "as unregistered_tool / unregistered_skill already do — never in prose only "
        f"(got {verdict['phase']!r})"
    )
    assert "p1" in verdict["message"]  # the message is unchanged, just no longer load-bearing


@pytest.mark.asyncio
async def test_verdict_keying_holds_end_to_end_through_the_real_subset_check(monkeypatch):
    """END-TO-END: NOTHING about the exception is hand-faked.

    Only `resolve_project_subtree` is faked (no DB); the REAL `assert_folder_scopes_subset`
    runs, raises for real, and `grounding_verdicts` keys the verdict off the REAL slug. This
    proves the whole chain — a mock's attribute echoing itself would prove nothing."""
    from app.services.harness import grounding

    _patch_subtree(monkeypatch, [_PROJECT, _CHILD])

    verdicts = await grounding.grounding_verdicts(
        _scoped_definition(scope=[_OUTSIDE], slug="research"),
        supabase=object(),
        user_id="u1",
        tool_names=set(),
        skill_ids=set(),
    )

    verdict = _folder_scope_verdict(verdicts)
    assert verdict["phase"] == "research"  # the REAL check supplied this, not a test double
    assert verdict["message"] == (
        "phase 'research' folder_scope is not a subset of the project subtree: "
        f"['{_OUTSIDE}']"
    )


def _folder_scope_verdicts(verdicts: list[dict]) -> list[dict]:
    return [v for v in verdicts if v["code"] == "folder_scope"]


@pytest.mark.asyncio
async def test_every_out_of_subtree_phase_gets_its_own_keyed_verdict(monkeypatch):
    """WR-04 REGRESSION GUARD — a THREE-offender definition produces THREE keyed verdicts.

    Driven END TO END: only `resolve_project_subtree` is faked, so the REAL ⊆ walk runs and
    the real slugs come out of production code. Nothing about the exceptions is hand-made.

    This assertion FAILS against the pre-WR-04 code with a SINGLE verdict keyed to `a`,
    because `assert_folder_scopes_subset` raised inside its `for phase in
    definition.phases` loop on the first offender. `grounding_verdicts` — whose own
    docstring promises it "COLLECTS every violation ... the canvas needs all of them at
    once" — could therefore never emit more than one `folder_scope` verdict, no matter how
    many phases were out of subtree. Phase 184 paints per-node badges from exactly this
    verdict (VALID-03), so nodes `b` and `c` would render CLEAN and the author would
    rediscover them one at a time: the whack-a-mole loop the per-node collector exists to
    eliminate. Rules 2 and 3 were already plural (see
    `test_182_extraction_parity.py::test_two_presentations_over_the_same_rules`) — the
    asymmetry was visible inside the suite itself.
    """
    from app.services.harness import grounding

    _patch_subtree(monkeypatch, [_PROJECT, _CHILD])

    verdicts = await grounding.grounding_verdicts(
        _three_offenders(),
        supabase=object(),
        user_id="u1",
        tool_names=set(),
        skill_ids=set(),
    )

    found = _folder_scope_verdicts(verdicts)
    assert [v["phase"] for v in found] == ["a", "b", "c"], (
        "WR-04 REGRESSION: rule 1 short-circuited again. A definition with three "
        "out-of-subtree phases emitted "
        f"{[v['phase'] for v in found]!r} instead of ['a', 'b', 'c'] — so Phase 184 paints "
        "one badge, nodes b and c render clean, and the author fixes them one at a time. "
        "Every offending phase must get its OWN keyed verdict, exactly as "
        "unregistered_tool / unregistered_skill already do."
    )
    # ...and each verdict carries ITS OWN message, naming ITS OWN slug.
    for slug, verdict in zip(["a", "b", "c"], found):
        assert verdict["message"] == (
            f"phase '{slug}' folder_scope is not a subset of the project subtree: "
            f"['{_OUTSIDE}']"
        )


@pytest.mark.asyncio
async def test_short_circuit_still_reports_only_the_first_offender(monkeypatch):
    """The SHORT-CIRCUIT counterpart of the test above — the two presentations diverge
    DELIBERATELY (mirrors `test_two_presentations_over_the_same_rules`).

    The SAME three-offender definition yields exactly ONE `grounding_failed` dict from
    `_check_grounding_fidelity`, naming phase `a` only. NL generation is byte-identical:
    it wants the first thing to fix, not the whole findings set."""
    from app.services.harness import grounding

    _patch_subtree(monkeypatch, [_PROJECT, _CHILD])

    result = await grounding._check_grounding_fidelity(
        _three_offenders(),
        supabase=object(),
        user_id="u1",
        tool_names=set(),
        skill_ids=set(),
    )

    assert result == {
        "ok": False,
        "error": "grounding_failed",
        "detail": (
            "phase 'a' folder_scope is not a subset of the project subtree: "
            f"['{_OUTSIDE}']"
        ),
    }


@pytest.mark.asyncio
async def test_rule_1_plurality_composes_with_the_already_plural_rules(monkeypatch):
    """MIXED RULES — rule 1's new plurality composes with rules 2 and 3, and the verdict
    ORDER is preserved (rule 1 first, then the per-phase loop).

    Phase `a` is out of subtree; phase `b` declares an unregistered tool. Both findings
    surface, each keyed to its own node — the shape Phase 184 needs to paint a complete
    badge set from ONE `/validate` call."""
    from app.services.harness import grounding

    _patch_subtree(monkeypatch, [_PROJECT, _CHILD])

    verdicts = await grounding.grounding_verdicts(
        _multi_phase_definition(
            [
                {"slug": "a", "scope": [_OUTSIDE]},
                {"slug": "b", "tools": ["not_a_real_tool"]},
            ]
        ),
        supabase=object(),
        user_id="u1",
        tool_names={"search_documents"},
        skill_ids=set(),
    )

    assert [(v["code"], v["phase"]) for v in verdicts] == [
        ("folder_scope", "a"),
        ("unregistered_tool", "b"),
    ]


# ── 3) DEGRADATION — a plain ValueError never breaks the always-200 route ──────


@pytest.mark.asyncio
async def test_plain_value_error_degrades_to_an_unkeyed_verdict(monkeypatch):
    """T-182-10: `except ValueError` is deliberately NOT narrowed and the slug is read via
    `getattr(..., None)`. A ⊆-path `ValueError` with no `phase_slug` (a test double, or a
    future non-phase-specific failure) yields `phase: None` and NEVER raises — `/validate`
    is documented ALWAYS HTTP 200, so an AttributeError here would be a 500.

    SEAM: patches `scope.folder_scope_violations` (the list form the collector consumes) to
    RAISE. Even the plural helper degrades a raise to exactly ONE unkeyed verdict — an
    infrastructure failure is not N findings. The catch breadth is deliberately unchanged;
    round-2 review WR-03 (a `pydantic.ValidationError` is a `ValueError` in Pydantic v2)
    is deferred and out of this round's scope."""
    from app.services.harness import grounding, scope as scope_mod

    async def _raise_plain(definition, *, supabase, user_id):
        raise ValueError("something else went wrong")

    monkeypatch.setattr(scope_mod, "folder_scope_violations", _raise_plain)

    verdicts = await grounding.grounding_verdicts(
        _scoped_definition(scope=[_OUTSIDE]),
        supabase=object(),
        user_id="u1",
        tool_names=set(),
        skill_ids=set(),
    )

    found = _folder_scope_verdicts(verdicts)
    assert len(found) == 1, (
        "an infrastructure failure off the ⊆ path is ONE finding, not N — the plural "
        f"helper must not fan it out per phase (got {len(found)})"
    )
    verdict = found[0]
    assert verdict["phase"] is None  # degrades safely — unkeyed, not a crash
    assert verdict["message"] == "something else went wrong"


@pytest.mark.asyncio
async def test_short_circuit_dict_is_byte_identical_after_the_tuple_change(monkeypatch):
    """`_check_grounding_fidelity` still returns the historical
    `{ok, error, detail}` dict with ONLY the message as `detail` — the tuple return is an
    internal detail, never a shape change (D-182-02 extraction-parity guarantee)."""
    from app.services.harness import grounding

    _patch_subtree(monkeypatch, [_PROJECT, _CHILD])

    result = await grounding._check_grounding_fidelity(
        _scoped_definition(scope=[_OUTSIDE]),
        supabase=object(),
        user_id="u1",
        tool_names=set(),
        skill_ids=set(),
    )

    assert result == {
        "ok": False,
        "error": "grounding_failed",
        "detail": _GOLDEN_MESSAGE,
    }


# ── 4) ONE-SOURCE guard — the slug is NEVER extracted by parsing prose ─────────


def test_no_message_parsing_exists_in_the_folder_scope_path():
    """D-182-06 RED LINE, asserted structurally over the source.

    The offending phase must travel on a typed exception ATTRIBUTE. If a future edit ever
    reaches for the slug by regexing / splitting the verdict message — in the collector or
    in the route that serializes it — this fails. (A client-side regex is the very
    re-derivation the red line forbids; a server-side one would legitimize the pattern.)"""
    from pathlib import Path

    backend_dir = Path(__file__).resolve().parents[2]
    forbidden = ("re.search", "re.match", "re.findall", ".split(\"'\")", ".split(\"'\", ", 'verdict["message"]')

    for rel in ("app/services/harness/grounding.py", "app/api/workflows.py"):
        src = (backend_dir / rel).read_text(encoding="utf-8")
        for token in forbidden:
            assert token not in src, (
                f"{token!r} appeared in {rel} — the folder_scope slug must travel "
                "STRUCTURALLY on FolderScopeSubsetError.phase_slug, never by parsing the "
                "message prose (D-182-06: no validation rule is ever re-derived from "
                "server output, server-side or client-side)"
            )

    # ... and the structural channel IS present where the verdict is built.
    grounding_src = (backend_dir / "app/services/harness/grounding.py").read_text(encoding="utf-8")
    assert 'getattr(exc, "phase_slug", None)' in grounding_src
    assert '"code": "folder_scope"' in grounding_src
