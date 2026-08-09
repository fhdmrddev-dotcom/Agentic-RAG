"""Phase 182 (VALID-01 / D-182-02 / D-182-03) — the `POST /workflows/validate` verdict set.

The anti-drift seam's unit contract. `/validate` aggregates the FULL STATIC publish
gauntlet into one per-node envelope and CLASSIFIES each finding — it never changes a
check:

  1. structural lint       -> `reachability.lint_workflow` (verbatim, pure)
  2. grounding fidelity    -> `grounding.grounding_verdicts` (verbatim, the ONE copy)
  3. business_requirement  -> `grounding.business_requirement_missing` (D-13, shared with publish)
  4. interactive phase     -> `publish_service._interactive_phase_failures` (WR-04, verbatim)

Pinned here:
  * every code the four checks can emit surfaces as a verdict;
  * per-node keying — `phase == phase.slug`, `phase is None` for workflow-global (SC#4);
  * the severity split (D-182-03) INCLUDING the `no_terminal` empty-vs-unreachable case
    (Pitfall 2: `phases == []` is "still building" -> `incomplete`; an unreachable terminal
    is "broken" -> `error`, from the SAME lint code);
  * `ok == (verdicts == [])` — BOTH severities set `ok False` (an incomplete draft can't publish);
  * the route gates on `require_canvas` ALONE, never `require_visible` (Pitfall 3 — 403 leaks).

CONVENTION (Phase 102 posture): imports INSIDE the test bodies. No live DB — the route
handler is called DIRECTLY (the `test_workflows_routes.py` / `test_103_draft_crud.py`
precedent) with `grounding.assemble_grounding_bundle` monkeypatched to a fake bundle, so the
whole verdict matrix runs offline.
"""

from __future__ import annotations

import pytest

# The conftest mock identity — `_coerce_user_id` needs a parseable UUID.
_USER = {"id": "00000000-0000-0000-0000-000000000001"}
_BR = "Deliver a cited answer to the requester."

_PROJECT = "11111111-1111-1111-1111-111111111111"
_OUTSIDE_FOLDER = "22222222-2222-2222-2222-222222222222"
_SKILL_ID = "33333333-3333-3333-3333-333333333333"


# ── definition builders (shape-valid; mirrors test_103_grounding_fidelity) ─────


def _definition(phases: list[dict], **extra) -> dict:
    base = {
        "slug": "validate-wf",
        "version": 1,
        "name": "Validate Workflow",
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


def _llm_agent(slug: str = "research", index: int = 0, *, tools: list[str]) -> dict:
    return {
        "slug": slug,
        "phase_index": index,
        "config": {
            "phase_type": "llm_agent",
            "prompt": "Research the topic.",
            "available_tools": tools,
        },
        "validators": [],
    }


# ── the offline seams ─────────────────────────────────────────────────────────


def _patch_bundle(monkeypatch, *, tool_names=(), skill_ids=()) -> None:
    """Swap the ONE registry read for a fake bundle (no live DB, no supabase call).

    Patches the MODULE attribute (`app.services.harness.grounding`), which is exactly the
    seam the route resolves at call time — the `test_103_grounding_fidelity.py`
    monkeypatch posture, pointed at the Phase-182 shared grounding source.
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
        )

    monkeypatch.setattr(g, "assemble_grounding_bundle", _fake_assemble)


def _patch_scope_clean(monkeypatch) -> None:
    """Stub the ⊆ walk to CLEAN so a **bound** definition needs no DB.

    ``folder_scope_violations`` short-circuits to ``[]`` for an unbound workflow, so every
    pre-187 fixture reached it without touching ``supabase`` (which is ``object()`` here).
    A definition that carries a ``project_folder_id`` resolves the project subtree for real,
    so the bound fixtures D-187-11 needs stub the ONE walk — the same seam, and the same
    monkeypatch posture, ``test_folder_scope_verdict_is_keyed_to_the_phase`` already uses.
    """
    import app.services.harness.scope as scope_mod

    async def _no_violations(definition, *, supabase, user_id, restrict_org_ids=None):
        return []

    monkeypatch.setattr(scope_mod, "folder_scope_violations", _no_violations)


async def _validate(definition: dict):
    """Call the route handler directly and return the ValidateResponse."""
    from app.api import workflows as wf
    from app.models.harness import WorkflowDefinition

    return await wf.validate_workflow(
        body=WorkflowDefinition.model_validate(definition),
        current_user=dict(_USER),
        supabase=object(),
    )


def _codes(response) -> set[str]:
    return {v.code for v in response.verdicts}


def _by_code(response, code: str):
    matches = [v for v in response.verdicts if v.code == code]
    assert matches, f"expected a {code!r} verdict, got {sorted(_codes(response))}"
    return matches[0]


# ── 1) a clean definition is ok, with zero verdicts ───────────────────────────


@pytest.mark.asyncio
async def test_clean_definition_is_ok_with_no_verdicts(monkeypatch):
    """The full static gauntlet clean -> `{ok: True, verdicts: []}` (the publishable-now signal).

    BOUND since Phase 187 (D-187-11). This fixture is a retrieval workflow — its phase carries
    `search_documents` — so leaving `project_folder_id` unset would now (correctly) earn the
    `unbound_retrieval` verdict and this test would be asserting that an unbound retrieval
    workflow is publishable-now. Binding it is the honest fix: the clean case is a workflow
    that is clean on EVERY rule, including the newest one.
    """
    _patch_bundle(monkeypatch, tool_names={"search_documents"})
    _patch_scope_clean(monkeypatch)

    resp = await _validate(
        _definition([_llm_agent(tools=["search_documents"])], project_folder_id=_PROJECT)
    )

    assert resp.verdicts == []
    assert resp.ok is True


# ── 2) every lint code surfaces as a verdict (reused verbatim) ─────────────────


@pytest.mark.asyncio
async def test_lint_codes_surface_as_verdicts(monkeypatch):
    """`lint_workflow`'s codes ride through unchanged — bad_index + orphan_phase +
    no_terminal from one non-contiguous draft, and unsatisfiable_skip / input_unsatisfied
    from their own shapes. The route maps LintError -> verdict exactly as publish does."""
    _patch_bundle(monkeypatch)

    # non-contiguous indices [0, 2] -> bad_index (contiguity) + orphan_phase + no_terminal
    gapped = await _validate(
        _definition([_llm_single("first", 0), _llm_single("second", 2)])
    )
    assert {"bad_index", "orphan_phase", "no_terminal"} <= _codes(gapped)

    # a skip target that does not exist -> unsatisfiable_skip
    skip = _llm_single("answer", 0)
    skip["validators"] = [
        {
            "kind": "regex_match",
            "config": {"pattern": "VERIFIED"},
            "on_failure": "skip_to_phase:nowhere",
        }
    ]
    dangling = await _validate(_definition([skip]))
    assert "unsatisfiable_skip" in _codes(dangling)

    # an input_key no upstream phase produces (and not a known run input)
    programmatic = {
        "slug": "split",
        "phase_index": 0,
        "config": {"phase_type": "programmatic", "fn": "split_topic", "input_keys": ["nope"]},
        "validators": [],
    }
    unsatisfied = await _validate(_definition([programmatic]))
    assert "input_unsatisfied" in _codes(unsatisfied)


# ── 3) grounding-fidelity verdicts (the ONE shared rule copy) ──────────────────


@pytest.mark.asyncio
async def test_unregistered_tool_verdict_is_keyed_to_the_phase(monkeypatch):
    """A hallucinated `available_tools` entry -> `unregistered_tool` keyed to the phase slug."""
    _patch_bundle(monkeypatch, tool_names={"search_documents"})

    resp = await _validate(_definition([_llm_agent("research", 0, tools=["not_a_real_tool"])]))

    verdict = _by_code(resp, "unregistered_tool")
    assert verdict.phase == "research"  # per-node keying (SC#4)
    assert verdict.severity == "error"
    assert resp.ok is False


@pytest.mark.asyncio
async def test_unregistered_skill_verdict_is_keyed_to_the_phase(monkeypatch):
    """A `skill_ref` outside the enabled owner/global set -> `unregistered_skill` per node."""
    _patch_bundle(monkeypatch, skill_ids=set())

    resp = await _validate(_definition([_llm_single("answer", 0, skill_ref=_SKILL_ID)]))

    verdict = _by_code(resp, "unregistered_skill")
    assert verdict.phase == "answer"
    assert verdict.severity == "error"


@pytest.mark.asyncio
async def test_folder_scope_verdict_is_keyed_to_the_phase(monkeypatch):
    """A non-⊆ per-phase folder_scope -> a `folder_scope` verdict KEYED to the phase (SC#4).

    `assert_folder_scopes_subset` is reused VERBATIM; it raises `FolderScopeSubsetError`
    (a `ValueError` subclass) carrying the offending slug on `.phase_slug`, and the
    collector threads that attribute onto `verdict.phase`. The slug travels STRUCTURALLY —
    the message still names it for humans, but no consumer may parse the prose to attribute
    the finding to a node (D-182-06). We monkeypatch `scope.folder_scope_violations` — the
    non-raising LIST form the per-node collector consumes since WR-04 — to RETURN one
    violation, so the route is driven with no DB. (The raising `assert_folder_scopes_subset`
    is the short-circuit presentation NL generation uses.) The end-to-end proof through the
    REAL ⊆ walk, and the multi-offender WR-04 guard, live in
    tests/unit/test_182_folder_scope_keying.py.
    """
    import app.services.harness.scope as scope_mod
    from app.services.harness.scope import FolderScopeSubsetError

    _patch_bundle(monkeypatch)

    async def _one_subset_violation(definition, *, supabase, user_id):
        return [
            FolderScopeSubsetError(
                "phase 'answer' folder_scope is not a subset of the project subtree: "
                f"['{_OUTSIDE_FOLDER}']",
                phase_slug="answer",
            )
        ]

    monkeypatch.setattr(scope_mod, "folder_scope_violations", _one_subset_violation)

    resp = await _validate(
        _definition(
            [_llm_single("answer", 0, folder_scope=[_OUTSIDE_FOLDER])],
            project_folder_id=_PROJECT,
        )
    )

    verdict = _by_code(resp, "folder_scope")
    assert verdict.phase == "answer"  # per-node keying (SC#4) — NOT None
    assert "answer" in verdict.message  # the message is unchanged, just no longer load-bearing
    assert verdict.severity == "error"


# ── 4) the other two static publish blockers ──────────────────────────────────


@pytest.mark.asyncio
async def test_business_requirement_verdict_is_incomplete_and_global(monkeypatch):
    """A draft with no `business_requirement` (D-13) -> a global `incomplete` verdict.

    `ok` is still False — an incomplete draft cannot publish either (severity is an
    ORTHOGONAL UI hint, not a pass/fail axis).
    """
    _patch_bundle(monkeypatch)

    resp = await _validate(_definition([_llm_single()], business_requirement=None))

    verdict = _by_code(resp, "business_requirement")
    assert verdict.phase is None
    assert verdict.severity == "incomplete"
    assert resp.ok is False  # an "incomplete"-only verdict set still blocks


@pytest.mark.asyncio
async def test_interactive_phase_verdict_is_incomplete_and_per_node(monkeypatch):
    """An `llm_human_input` phase (WR-04) -> `interactive_phase`, keyed to the phase, incomplete."""
    _patch_bundle(monkeypatch)

    human = {
        "slug": "confirm",
        "phase_index": 0,
        "config": {"phase_type": "llm_human_input", "prompt": "Confirm?"},
        "validators": [],
    }
    resp = await _validate(_definition([human]))

    verdict = _by_code(resp, "interactive_phase")
    assert verdict.phase == "confirm"
    assert verdict.severity == "incomplete"


# ── 5) the severity split — the no_terminal empty-vs-broken case (Pitfall 2) ───


@pytest.mark.asyncio
async def test_no_terminal_empty_draft_is_incomplete(monkeypatch):
    """`phases: []` is shape-valid and reaches the handler -> `no_terminal` as INCOMPLETE.

    The empty canvas must paint "you're still building", never red "this is broken".
    """
    _patch_bundle(monkeypatch)

    resp = await _validate(_definition([]))

    verdict = _by_code(resp, "no_terminal")
    assert verdict.phase is None
    assert verdict.severity == "incomplete"
    assert resp.ok is False


@pytest.mark.asyncio
async def test_no_terminal_unreachable_terminal_is_error(monkeypatch):
    """The SAME `no_terminal` code on a NON-empty draft is an ERROR — the split (D-182-03)."""
    _patch_bundle(monkeypatch)

    resp = await _validate(_definition([_llm_single("first", 0), _llm_single("second", 2)]))

    assert _by_code(resp, "no_terminal").severity == "error"
    # ... and its structural siblings are errors too
    assert _by_code(resp, "bad_index").severity == "error"
    assert _by_code(resp, "orphan_phase").severity == "error"


@pytest.mark.asyncio
async def test_input_unsatisfied_is_incomplete_while_wiring(monkeypatch):
    """`input_unsatisfied` is a still-wiring condition -> incomplete, not error (D-182-03)."""
    _patch_bundle(monkeypatch)

    programmatic = {
        "slug": "split",
        "phase_index": 0,
        "config": {"phase_type": "programmatic", "fn": "split_topic", "input_keys": ["nope"]},
        "validators": [],
    }
    resp = await _validate(_definition([programmatic]))

    assert _by_code(resp, "input_unsatisfied").severity == "incomplete"


@pytest.mark.asyncio
async def test_a_dirty_draft_produces_verdicts_and_reports_not_ok(monkeypatch):
    """A genuinely dirty draft yields a non-empty verdict set and `ok False`.

    Round-2 gap closure (plan 182-08 / IN-04): this test used to also assert that the set of
    emitted severities was a subset of the two allowed literals, and was named for that claim.
    That assertion could never fail — `Verdict.severity` is typed as a two-value `Literal`, so
    constructing an out-of-taxonomy verdict raises inside the route long before the assertion
    runs. It was false coverage, so it is gone rather than left standing.

    The closed-taxonomy claim now lives where it is actually falsifiable:
    `test_182_severity_codes.py::test_every_known_code_classifies_exactly_as_the_pinned_table`
    pins every emitted code against a hand-written table, and
    `test_lint_codes_match_the_reachability_emit_sites` detects drift in the code sets.
    """
    _patch_bundle(monkeypatch, tool_names=set())

    resp = await _validate(
        _definition(
            [_llm_agent("research", 0, tools=["not_a_real_tool"]), _llm_single("second", 2)],
            business_requirement=None,
        )
    )

    assert resp.verdicts  # a genuinely dirty draft
    assert resp.ok is False


# ── 6) the gate: require_canvas ALONE (Pitfall 3 — never require_visible's 403) ─


def _route_dependency_qualnames(path: str, method: str) -> set[str]:
    from app.main import app

    for route in app.routes:
        if getattr(route, "path", None) == path and method in (
            getattr(route, "methods", None) or set()
        ):
            return {
                getattr(dep.call, "__qualname__", "") for dep in route.dependant.dependencies
            }
    raise AssertionError(f"route {method} {path} is not mounted")


def test_validate_route_gates_on_require_canvas_alone():
    """`POST /workflows/validate` carries `require_canvas` and NOT `require_visible`.

    `require_visible` raises **403** on deny, which would leak that the route exists when
    the canvas is on but authoring visibility is restricted (Pitfall 3). The canvas gate is
    the byte-identical 404 (D-182-05) — and it must be the ONLY gate.
    """
    qualnames = _route_dependency_qualnames("/workflows/validate", "POST")

    assert any(q.startswith("require_canvas") for q in qualnames), qualnames
    assert not any(q.startswith("require_visible") for q in qualnames), qualnames


# ── 7) D-187-11 — the unbound-retrieval verdict (BUG-260731-03, the verdict half) ─
#
# A phase whose ``available_tools`` intersects the KB tools while the DEFINITION carries no
# ``project_folder_id`` means "the knowledge base" is EVERYTHING. `BUG-260731-03` recorded
# exactly that shipping: the publish gauntlet's probabilistic judge PASSED a worse deliverable
# (11 files / 5+ folders) than the one it FAILED (3 files / 3 folders) an hour apart, so a hard
# wall that fails open under variance is not a control for this failure mode. Scope-boundness is
# a STRUCTURAL property of the definition, so it is checked HERE, where the answer is the same
# every time, before a golden run is spent.


@pytest.mark.asyncio
async def test_unbound_retrieval_verdict_is_incomplete_and_per_node(monkeypatch):
    """Unbound + a KB-reading phase -> ONE `unbound_retrieval` verdict, keyed to that node."""
    _patch_bundle(monkeypatch, tool_names={"search_documents"})

    resp = await _validate(_definition([_llm_agent("retrieve", 0, tools=["search_documents"])]))

    matching = [v for v in resp.verdicts if v.code == "unbound_retrieval"]
    assert len(matching) == 1, sorted(_codes(resp))
    verdict = matching[0]
    assert verdict.phase == "retrieve"  # per-node keying (SC#4), like interactive_phase
    assert verdict.severity == "incomplete"
    assert resp.ok is False  # an "incomplete"-only verdict set still blocks publish


@pytest.mark.asyncio
async def test_a_bound_retrieval_workflow_earns_no_unbound_verdict(monkeypatch):
    """The SAME definition with `project_folder_id` set is clean on this rule."""
    _patch_bundle(monkeypatch, tool_names={"search_documents"})
    _patch_scope_clean(monkeypatch)

    resp = await _validate(
        _definition(
            [_llm_agent("retrieve", 0, tools=["search_documents"])],
            project_folder_id=_PROJECT,
        )
    )

    assert "unbound_retrieval" not in _codes(resp), sorted(_codes(resp))


@pytest.mark.asyncio
async def test_an_unbound_workflow_that_reads_nothing_earns_no_unbound_verdict(monkeypatch):
    """Unbound is only a finding for a step that actually READS the knowledge base.

    An `llm_single` has no `available_tools` at all, and an agent whose tools miss the KB set
    reads nothing either — neither may be accused of searching everything. This is the same
    reason `grounding_cause` (the ONE intersection home) refuses to read `folder_scope`.
    """
    _patch_bundle(monkeypatch, tool_names={"web_search"})

    bare = await _validate(_definition([_llm_single("answer", 0)]))
    assert "unbound_retrieval" not in _codes(bare), sorted(_codes(bare))

    non_kb = await _validate(_definition([_llm_agent("browse", 0, tools=["web_search"])]))
    assert "unbound_retrieval" not in _codes(non_kb), sorted(_codes(non_kb))


@pytest.mark.asyncio
async def test_every_unbound_kb_reading_phase_gets_its_own_verdict(monkeypatch):
    """PER-NODE and PLURAL (WR-04 posture): two offending phases -> two keyed verdicts.

    A short-circuited rule would leave the second node rendering CLEAN on the canvas and the
    author would rediscover it one at a time.
    """
    _patch_bundle(monkeypatch, tool_names={"search_documents", "read_document"})

    resp = await _validate(
        _definition(
            [
                _llm_agent("retrieve", 0, tools=["search_documents"]),
                _llm_agent("reread", 1, tools=["read_document"]),
            ]
        )
    )

    slugs = [v.phase for v in resp.verdicts if v.code == "unbound_retrieval"]
    assert slugs == ["retrieve", "reread"], sorted(_codes(resp))


@pytest.mark.asyncio
async def test_the_unbound_check_reuses_the_one_kb_intersection_home(monkeypatch):
    """The route calls `grounding.grounding_cause` — it does NOT carry a local KB-tool list.

    The day a 6th KB tool lands in `grounding.KB_TOOLS`, this check must pick it up for free.
    Proven by ADDING one to the frozenset and observing the verdict appear for a phase whose
    only tool is that new name — impossible if `workflows.py` held its own copy.
    """
    from app.services.harness import grounding as g

    _patch_bundle(monkeypatch, tool_names={"a_sixth_kb_tool"})
    monkeypatch.setattr(g, "KB_TOOLS", frozenset(g.KB_TOOLS | {"a_sixth_kb_tool"}))

    resp = await _validate(_definition([_llm_agent("retrieve", 0, tools=["a_sixth_kb_tool"])]))

    assert "unbound_retrieval" in _codes(resp), sorted(_codes(resp))


def test_severity_classifies_unbound_retrieval_as_incomplete_without_failing_loud(caplog):
    """`incomplete`, and NOT via the fail-loud unknown branch (WR-05).

    An unregistered code would still classify — as `error`, with a warning logged on EVERY
    canvas edit. That is the opposite of D-187-11, which wants grey "still building".
    """
    import logging

    from app.api import workflows

    with caplog.at_level(logging.WARNING, logger="app.api.workflows"):
        caplog.clear()
        got = workflows._severity("unbound_retrieval", phases_empty=False)

    assert got == "incomplete"
    assert "unbound_retrieval" not in caplog.text, (
        "the code reached the fail-loud unknown branch — register it in BOTH "
        "workflows._ROUTE_ASSIGNED_CODES and workflows._INCOMPLETE_CODES"
    )
