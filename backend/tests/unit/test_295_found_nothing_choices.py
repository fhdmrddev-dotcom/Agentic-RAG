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
