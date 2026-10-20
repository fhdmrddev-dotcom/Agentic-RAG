"""Phase 295 (RUN-01, plan 295-03) — the found-nothing choices, the folder bound, the lock.

Task 1 half: the server-built prompt and option list (UI-SPEC A.2), and the folder list
bounded by THE SAME acceptance rule the run already obeys (D-03 / D-39): a candidate folder
is offered only when ``scope.resolve_run_scope_root`` accepts it as a per-run override, it is
not already searched, its effective search for this step is not a subset of what was
searched, and it has a name.

``scope.resolve_run_scope_root`` and ``scope.resolve_project_subtree`` run FOR REAL here; only
``fetch_visible_folders`` (the one network read under them) is replaced by a fixture tree.
"""
from __future__ import annotations

import asyncio
from unittest.mock import patch
from uuid import uuid4

STEP = "Summarise the renewal terms"
FOLDER = "Contracts"


# ── compose_engine_choices — the exact words (UI-SPEC A.2) ────────────────────────────────
def _compose(finding, *, locked=False, folders=()):
    from app.services.harness.engine_ask import compose_engine_choices

    return compose_engine_choices(
        finding, step_label=STEP, folder_label=FOLDER, locked=locked, folders=list(folders),
    )


_ONE = [{"id": "f1", "name": "Archive", "depth": 0}]


def test_no_sources_unlocked_with_a_folder_offers_all_three_in_order():
    prompt, options = _compose("no_sources", folders=_ONE)
    assert prompt == f"Searched {FOLDER} and found nothing for “{STEP}”. How should the run continue?"
    assert options == ["Search another folder", "Continue without sources", "Stop the run"]


def test_no_sources_without_another_folder_drops_the_search_choice():
    _prompt, options = _compose("no_sources", folders=[])
    assert options == ["Continue without sources", "Stop the run"]


def test_no_markers_never_offers_another_folder():
    prompt, options = _compose("no_markers", folders=_ONE)
    assert prompt == (
        f"“{STEP}” answered without citing its sources in {FOLDER}. How should the run continue?"
    )
    assert options == ["Continue without sources", "Stop the run"]


def test_locked_drops_continue_and_carries_the_addendum():
    prompt, options = _compose("no_sources", locked=True, folders=_ONE)
    assert prompt == (
        f"Searched {FOLDER} and found nothing for “{STEP}”. This step is set to Must prove it, "
        "so it can't continue without sources. How should the run continue?"
    )
    assert options == ["Search another folder", "Stop the run"]

    prompt2, options2 = _compose("no_markers", locked=True)
    assert "This step is set to Must prove it" in prompt2
    assert options2 == ["Stop the run"]


def test_the_engine_labels_are_the_module_constants():
    from app.services.harness import engine_ask

    assert engine_ask.ENGINE_CHOICE_SEARCH == "Search another folder"
    assert engine_ask.ENGINE_CHOICE_CONTINUE == "Continue without sources"
    assert engine_ask.ENGINE_CHOICE_STOP == "Stop the run"
    assert engine_ask.ENGINE_ASK_POLICY == "engine_ask_pause"


# ── permitted_folder_options — the bound (D-03 / D-39) ────────────────────────────────────
P, CHILD, Q, QSUB, NAMELESS, A, B = (str(uuid4()) for _ in range(7))

_TREE = [
    {"id": P, "name": "Contracts", "parent_id": None},
    {"id": CHILD, "name": "Contracts 2025", "parent_id": P},
    {"id": Q, "name": "Archive", "parent_id": None},
    {"id": QSUB, "name": "Archive 2019", "parent_id": Q},
    {"id": NAMELESS, "name": "   ", "parent_id": None},
]


def _definition(*, root, scopes=None):
    from app.models.harness import WorkflowDefinition

    phases = []
    for i, scope in enumerate(scopes or [None]):
        cfg = {"phase_type": "llm_agent", "prompt": "p", "available_tools": ["search_documents"]}
        if scope is not None:
            cfg["folder_scope"] = scope
        phases.append({"slug": f"s{i}", "phase_index": i, "config": cfg})
    return WorkflowDefinition(
        slug="w", name="W", version=1, phases=phases, project_folder_id=root,
    )


def _options(definition, *, searched, tree, phase_index=0):
    from app.services.harness import engine_ask

    calls = {"n": 0}

    async def _fetch(_supabase, _user_id, **_kw):
        calls["n"] += 1
        return [dict(f) for f in tree]

    with patch("app.services.harness.scope.fetch_visible_folders", _fetch), \
         patch("app.utils.folder_utils.fetch_visible_folders", _fetch):
        out = asyncio.run(engine_ask.permitted_folder_options(
            definition, phase=definition.phases[phase_index], searched_ids=searched,
            supabase=object(), user_id=str(uuid4()),
        ))
    return out, calls["n"]


def test_an_unbound_definition_offers_no_folder():
    out, fetched = _options(_definition(root=None), searched=None, tree=_TREE)
    assert out == []
    assert fetched == 0, "an unbound definition never reads the folder tree"


def test_an_unscoped_definition_offers_owner_visible_folders_outside_what_was_searched():
    out, _ = _options(_definition(root=P), searched=[P, CHILD], tree=_TREE)
    assert out == [
        {"id": Q, "name": "Archive", "depth": 0},
        {"id": QSUB, "name": "Archive 2019", "depth": 1},
    ]
    assert all(isinstance(f["id"], str) for f in out)
    assert NAMELESS not in {f["id"] for f in out}, "a nameless row is dropped, never blank"


def test_a_scoped_definition_offers_only_what_resolve_run_scope_root_accepts():
    tree = [
        {"id": P, "name": "Contracts", "parent_id": None},
        {"id": A, "name": "Leases", "parent_id": P},
        {"id": B, "name": "Renewals", "parent_id": P},
        {"id": Q, "name": "Archive", "parent_id": None},
    ]
    definition = _definition(root=P, scopes=[[A, B]])
    # The run was narrowed to A, so A is what this step searched.
    out, _ = _options(definition, searched=[A], tree=tree)
    ids = [f["id"] for f in out]
    assert Q not in ids, "outside the author's subtree: resolve_run_scope_root drops it"
    assert A not in ids, "already searched"
    assert set(ids) == {P, B}
    assert {f["id"]: f["depth"] for f in out} == {P: 0, B: 1}


def test_a_folder_whose_effective_search_is_a_subset_of_what_was_searched_is_not_offered():
    tree = [
        {"id": P, "name": "Contracts", "parent_id": None},
        {"id": A, "name": "Leases", "parent_id": P},
        {"id": B, "name": "Renewals", "parent_id": P},
    ]
    definition = _definition(root=P, scopes=[[A, B]])
    # Searched A and B already: every candidate's effective set (∩ the step scope) ⊆ {A, B}.
    out, _ = _options(definition, searched=[A, B], tree=tree)
    assert out == []


def test_the_acceptance_rule_is_resolve_run_scope_root_itself():
    """No second rule: a candidate the shipped resolver would DROP is never offered, even when
    the folder is otherwise visible. Proven by making the resolver refuse everything."""
    from app.services.harness import engine_ask

    async def _refuse(definition, *, run_inputs, thread_folder_id, supabase, user_id):
        return str(definition.project_folder_id)  # override dropped → author default

    async def _fetch(_supabase, _user_id, **_kw):
        return [dict(f) for f in _TREE]

    with patch("app.services.harness.scope.resolve_run_scope_root", _refuse), \
         patch("app.services.harness.scope.fetch_visible_folders", _fetch), \
         patch("app.utils.folder_utils.fetch_visible_folders", _fetch):
        out = asyncio.run(engine_ask.permitted_folder_options(
            _definition(root=P), phase=_definition(root=P).phases[0], searched_ids=[P, CHILD],
            supabase=object(), user_id="u",
        ))
    assert out == []


# ══ Task 2 — consuming the answer on the re-drive (D-02 / D-03 / D-04 / D-05 / D-36) ══════
SLUG = "summarise"
OTHER = str(uuid4())
OTHER_SUB = str(uuid4())


def _raw_kb_phase(*, escalated: bool):
    from app.models.harness import PhaseSpec

    return PhaseSpec(
        slug=SLUG, phase_index=0, name=STEP,
        config={"phase_type": "llm_agent", "prompt": "Find the terms and cite them.",
                "available_tools": ["search_documents"]},
        grounding_escalated=escalated,
    )


def _run_definition(*, escalated: bool):
    from app.models.harness import WorkflowDefinition

    return WorkflowDefinition(
        slug="w", name="W", version=1, project_folder_id=P,
        phases=[_raw_kb_phase(escalated=escalated).model_dump()],
    )


def _pause_then_consume(answer, *, finding="no_sources", locked=False, locked_now=None,
                        folders=None, flag=True, stale_tcid=False, subtree=None):
    """Pause the engine citations gate for real, persist ``answer`` as the answer route
    does, then run ``consume_engine_answer`` the way the top of ``_run_phase_with_gates``
    does on the re-drive. Returns ``(result, world, ctx)``."""
    from contextlib import ExitStack

    from app.services import harness_engine
    from app.services.harness import engine_ask
    from app.services.harness.grounding import effective_phase
    from tests.unit.engine_ask_fakes import FakePool, World

    world = World(SLUG, kb_label=FOLDER, folders=list(folders or []))
    phase = effective_phase(_raw_kb_phase(escalated=locked), total_phases=1)
    now = locked if locked_now is None else locked_now
    ctx = world.ctx(definition=_run_definition(escalated=now))
    output = {"text": "The term renews yearly.", "sub_run_id": "s",
              "citations": [] if finding == "no_sources" else [{"doc": "d"}]}
    run_id, user, pool = uuid4(), uuid4(), FakePool()

    async def _subtree(root, *, supabase, user_id, **_kw):
        return list(subtree or [root])

    with ExitStack() as stack:
        world.enter(stack)
        stack.enter_context(patch("app.services.harness.scope.resolve_project_subtree", _subtree))
        paused = asyncio.run(harness_engine._resolve_failure_with_ask_user(
            phase, "citations_required: planted", 2, len(phase.validators) - 1,
            run_id=run_id, pool=pool, redis=object(), ctx=ctx, _audit_user_id=user,
            produced_output=output, is_pre=False,
        ))
        assert paused.kind == "pause_run", paused
        tcid = world.latest_tool_call()["tool_call_id"]
        if answer is not None:
            world.answer(**answer)
        if flag:
            ctx.resume_answered_tool_call_id = "someone-else" if stale_tcid else tcid
        result = asyncio.run(engine_ask.consume_engine_answer(
            phase, ctx, run_id=run_id, pool=pool, redis=object(),
            _audit_user_id=user, stream_run_id=None,
        ))
    return result, world, ctx


def test_no_flag_or_another_questions_flag_is_left_for_the_human_step():
    result, _w, ctx = _pause_then_consume({"response_text": "Stop the run"}, flag=False)
    assert result is None and ctx.resume_answered_tool_call_id is None
    result, _w, ctx = _pause_then_consume({"response_text": "Stop the run"}, stale_tcid=True)
    assert result is None
    assert ctx.resume_answered_tool_call_id == "someone-else", "the human executor's flag was eaten"


def test_continue_keeps_the_output_and_marks_it_unsourced():
    from datetime import datetime

    result, world, ctx = _pause_then_consume(
        {"response_text": "Continue without sources", "choice_index": 1},
        folders=[{"id": OTHER, "name": "Archive", "depth": 0}],
    )
    assert result.kind == "completed"
    out = result.output
    assert out["text"] == "The term renews yearly."
    assert out["citations"] == []
    assert out["unsourced"]["continued_by"] == str(ctx.current_user["id"])
    datetime.fromisoformat(out["unsourced"]["at"])
    assert set(out) - {"text", "sub_run_id", "citations"} == {"unsourced"}, "ONE field added"
    receipt = world.audits("validator_ask_user_approved")[-1]["metadata"]
    assert receipt["phase"] == SLUG and receipt["choice"] == "Continue without sources"
    assert receipt["finding"] == "no_sources" and receipt["unsourced"] is True
    assert ctx.resume_answered_tool_call_id is None, "the single-use flag was not cleared"


def test_continue_on_a_step_locked_since_the_pause_never_completes():
    result, world, _ctx = _pause_then_consume(
        {"response_text": "Continue without sources"}, locked=False, locked_now=True,
    )
    assert result.kind != "completed"
    assert result.kind == "fail_run"
    assert "Must prove it" in result.reason and STEP in result.reason
    assert world.audits("validator_ask_user_approved") == []


def test_stop_fails_with_the_finding_and_the_person():
    result, _w, _ctx = _pause_then_consume({"response_text": "Stop the run", "choice_index": 1})
    assert result.kind == "fail_run"
    assert result.reason == (
        f"Searched {FOLDER} and found nothing for “{STEP}”. Stopped by Fahad Murad."
    )


def test_stop_after_an_uncited_answer_uses_the_markers_sentence():
    result, _w, _ctx = _pause_then_consume(
        {"response_text": "Stop the run"}, finding="no_markers",
    )
    assert result.reason == f"“{STEP}” answered without citing its sources. Stopped by Fahad Murad."


def test_a_folder_answer_reruns_the_step_with_that_folder_only():
    result, world, ctx = _pause_then_consume(
        {"response_text": "Search another folder", "choice_index": 0, "folder_id": OTHER},
        folders=[{"id": OTHER, "name": "Archive", "depth": 0}], subtree=[OTHER, OTHER_SUB],
    )
    assert result is None, "a folder answer re-runs the body (None)"
    assert ctx.phase_scope_override == {SLUG: [OTHER, OTHER_SUB]}
    assert isinstance(ctx.phase_scope_override[SLUG], list)
    assert ctx.phase_scope_label == {SLUG: "Archive"}
    receipt = world.audits("validator_ask_user_approved")[-1]["metadata"]
    assert receipt["folder_id"] == OTHER and receipt["choice"] == "Search another folder"
    assert ctx.definition.project_folder_id is not None  # the definition is never rewritten
    assert str(ctx.definition.project_folder_id) == P


def test_unmatched_answers_never_proceed_and_leave_the_run_paused():
    folders = [{"id": OTHER, "name": "Archive", "depth": 0}]
    for answer in (
        {"response_text": "Proceed anyway"},
        {"response_text": "", "choice_index": 7},
        {"response_text": "Search another folder", "folder_id": str(uuid4())},
        {"response_text": "Search another folder"},
        {"response_text": "continue without sources"},
    ):
        result, world, _ctx = _pause_then_consume(answer, folders=folders)
        assert result is not None and result.kind == "pause_run", (answer, result)
        assert world.audits("validator_ask_user_approved") == [], answer
        assert world.count("prompt_row") == 1, "an unmatched answer must not mint a new prompt"


def test_a_locked_prompt_refuses_continue_even_when_forged_at_consume():
    result, _w, _ctx = _pause_then_consume(
        {"response_text": "Continue without sources"}, locked=True,
        folders=[{"id": OTHER, "name": "Archive", "depth": 0}],
    )
    assert result.kind == "pause_run", "a label the prompt never offered is unmatched"


def test_phase_scope_ids_prefers_the_override_and_is_a_pure_leaf():
    from types import SimpleNamespace

    from app.services.harness.run_handoff import phase_scope_ids

    phase = SimpleNamespace(slug="a")
    assert phase_scope_ids(SimpleNamespace(folder_subtree_ids=["r"]), phase) == ["r"]
    assert phase_scope_ids(SimpleNamespace(), phase) is None
    ctx = SimpleNamespace(folder_subtree_ids=["r"], phase_scope_override={"a": ["f", "g"]})
    assert phase_scope_ids(ctx, phase) == ["f", "g"]
    assert phase_scope_ids(ctx, SimpleNamespace(slug="b")) == ["r"]


def test_the_tool_context_searches_the_override_folder():
    from types import SimpleNamespace

    from app.services.harness.phase_types import _build_phase_tool_context

    phase = _raw_kb_phase(escalated=False)
    ctx = SimpleNamespace(producer_run_id=uuid4(), folder_subtree_ids=[P, CHILD],
                          phase_scope_override={SLUG: [OTHER]}, current_user={})
    assert _build_phase_tool_context(phase, ctx).folder_subtree_ids == [OTHER]
    ctx.phase_scope_override = {}
    assert _build_phase_tool_context(phase, ctx).folder_subtree_ids == [P, CHILD]
