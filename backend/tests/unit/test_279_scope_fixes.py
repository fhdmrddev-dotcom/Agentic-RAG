"""Phase 279 (SEAM-01 / SEED-328) — the two scope fixes that land after the pure move.

* **D-07 — restricted → restricted no longer over-states.** ``build_expert_changed_event`` set
  ``excluded`` (the "won't be searched" sub-line inside the Dropped row) from the AFTER side alone.
  A swap between two restricted Experts on a folder-scoped thread therefore said the thread folder's
  documents were newly lost, although the previous Expert never read them either. ``excluded`` is
  now computed against the PREVIOUS side's effective scope: it is set only when the previous side
  read the thread folder (or everything) — ⚠ CORRECTED 2026-10-14 (279-REVIEW WR-03): or when the
  previous side's effective folders overlap the new exclusion. ``_dropped_line`` is untouched (268 shares it), and no
  existing 267/268 fixture line changes. The new fixture is the real builder's output.
* **WR-08 (D-17) — the folder-scope note names every folder** when a run is scoped to 2+, and the
  single-folder note stays byte-identical to the phase base (see the section below).
"""
from __future__ import annotations

import ast
import json
import pathlib
import subprocess
from datetime import datetime, timezone

import pytest

from tests.unit.test_267_scope_preview import (
    ACME_FOLDER,
    BUNDLES,
    FA_ID,
    FIN_FOLDER,
    HR_ID,
    FakeSupabase,
    describe,
    resolved,
)

AT = datetime(2026, 9, 25, 14, 32, tzinfo=timezone.utc)
FIXTURES_279 = pathlib.Path(__file__).resolve().parent.parent / "fixtures" / "phase279"

# A second RESTRICTED Expert (the existing roster has one: HR Advisor).
LEGAL_ID = "e4000000-0000-4000-8000-0000000000d4"
LEGAL = resolved(LEGAL_ID, "Legal Advisor", "restricted", [FIN_FOLDER])
R2R_BUNDLES = {**BUNDLES, LEGAL_ID: LEGAL}


async def _event(before_id, after_id, thread_folder=ACME_FOLDER):
    from app.services.expert_scope_events import build_expert_changed_event

    before = await describe(FakeSupabase(), before_id, thread_folder, bundles=R2R_BUNDLES)
    after = await describe(FakeSupabase(), after_id, thread_folder, bundles=R2R_BUNDLES)
    return build_expert_changed_event(before, after, at=AT), after


# ── D-07 ──────────────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_D07_restricted_to_restricted_states_no_exclusion():
    ev, after = await _event(LEGAL_ID, HR_ID)
    assert after.excluded_count > 0  # non-vacuity: the AFTER side alone WOULD have stated one
    assert ev.excluded is None


@pytest.mark.asyncio
async def test_D07_plain_to_restricted_keeps_the_exclusion():
    ev, after = await _event(None, HR_ID)
    assert ev.excluded is not None and ev.excluded.count == after.excluded_count


@pytest.mark.asyncio
async def test_D07_biased_with_a_thread_folder_to_restricted_keeps_the_exclusion():
    ev, after = await _event(FA_ID, HR_ID)
    assert ev.excluded is not None and ev.excluded.count == after.excluded_count == 4


@pytest.mark.asyncio
async def test_D07_the_restricted_to_restricted_fixture_is_the_real_builders_output():
    ev, _after = await _event(LEGAL_ID, HR_ID)
    fixture = json.loads(
        (FIXTURES_279 / "expert_changed_restricted_to_restricted.json").read_text(encoding="utf-8")
    )
    assert fixture == ev.model_dump(mode="json")
    assert fixture["excluded"] is None



# ── 279-REVIEW WR-03: the exclusion is computed against the PREVIOUS side's effective scope ─────────
#
# The reviewer's probe: a restricted "ACME Specialist" bound to the thread folder (Client ACME),
# swapped to the restricted HR Advisor on an ACME-scoped thread. The previous Expert DID read part of
# what is now excluded, so the card must still say what won't be searched. Before the fix the D-07
# switch saw only "previous side read no thread folder" and dropped the line (``excluded`` None).

ACME_SPEC_ID = "e5000000-0000-4000-8000-0000000000e5"
ACME_SPEC = resolved(ACME_SPEC_ID, "ACME Specialist", "restricted", [ACME_FOLDER])
R2R_BUNDLES[ACME_SPEC_ID] = ACME_SPEC


@pytest.mark.asyncio
async def test_WR03_restricted_to_restricted_keeps_the_exclusion_when_the_previous_expert_read_it():
    from app.services.expert_scope_events import event_sentence

    ev, after = await _event(ACME_SPEC_ID, HR_ID)
    assert after.excluded_count == 4
    assert ev.excluded is not None, "the card lost its 'Won't be searched' line"
    assert ev.excluded.count == 4
    assert ev.excluded.names == [
        "ACME_MSA_2026.pdf", "ACME_SOW_03.docx", "ACME_invoices_Q3.xlsx", "Board_deck_Q3.pptx",
    ]
    # Dropped was already right (``_dropped_line`` reads the previous side's folders) — unchanged.
    assert event_sentence(ev) == "ACME Specialist → HR Advisor. Now: HR Policies. Dropped: Client ACME."


@pytest.mark.asyncio
async def test_WR03_the_overlap_fixture_is_the_real_builders_output():
    ev, _after = await _event(ACME_SPEC_ID, HR_ID)
    fixture = json.loads(
        (FIXTURES_279 / "expert_changed_restricted_overlap_to_restricted.json").read_text(encoding="utf-8")
    )
    assert fixture == ev.model_dump(mode="json")
    assert fixture["excluded"]["count"] == 4


@pytest.mark.asyncio
async def test_WR03_no_overlap_still_states_no_exclusion():
    """D-07's case is unchanged: Legal Advisor (Financial Reports) never read the thread folder."""
    ev, after = await _event(LEGAL_ID, HR_ID)
    assert after.excluded_count > 0 and ev.excluded is None


# ── WR-08 (D-17): the folder-scope note names every folder, only when there is more than one ─────
#
# ``ExpertScope.scoped_folder_path`` carried the FIRST folder only, so a run scoped to two folders was
# told "This chat is scoped to the folder '/HR'" while retrieval searched '/HR' AND '/Legal' — the
# model then filtered its own ls/grep/query_documents calls to half the scope. The paths now travel
# as ``scoped_folder_paths`` (ExpertScope → ThreadScoping → RunContext) and the note lists them all
# when there are 2+; the single-folder note stays BYTE-IDENTICAL to the phase base (pinned below by
# evaluating the base revision's own f-string). The sub-agent (task_service.py) keeps the first-path
# note by decision (D-17).

PHASE_BASE = "a5a94ba676a63a595f0c2408c7ce17b2ddfe5ada"
REPO_ROOT = pathlib.Path(__file__).resolve().parents[3]
AGENT_LOOP = REPO_ROOT / "backend" / "app" / "services" / "agent_loop.py"

HR_F = "f2000000-0000-4000-8000-000000000002"
LEGAL_F = "f7000000-0000-4000-8000-000000000007"
ACME_F = "f3000000-0000-4000-8000-000000000003"
ACME_SUB_F = "f4000000-0000-4000-8000-000000000004"
GONE_F = "f9000000-0000-4000-8000-000000000009"
FOLDERS = [
    {"id": HR_F, "name": "HR Policies", "parent_id": None},
    {"id": LEGAL_F, "name": "Legal", "parent_id": None},
    {"id": ACME_F, "name": "Client ACME", "parent_id": None},
    {"id": ACME_SUB_F, "name": "Contracts", "parent_id": ACME_F},
]


def _base_note(path: str) -> str:
    """The PHASE_BASE note, rendered by evaluating the base revision's own f-string."""
    try:
        src = subprocess.run(
            ["git", "show", f"{PHASE_BASE}:backend/app/services/agent_loop.py"],
            cwd=REPO_ROOT, capture_output=True, text=True, encoding="utf-8", check=True,
        ).stdout
    except (subprocess.CalledProcessError, FileNotFoundError):
        pytest.skip("phase base not reachable from this checkout")
    for node in ast.walk(ast.parse(src)):
        if (
            isinstance(node, ast.Assign)
            and any(isinstance(t, ast.Name) and t.id == "folder_scope_note" for t in node.targets)
        ):
            expr = ast.Expression(node.value)
            return eval(compile(expr, "<base>", "eval"), {"scoped_folder_path": path})  # noqa: S307
    raise AssertionError("base folder_scope_note assignment not found")


@pytest.mark.parametrize("paths", [None, (), ("/HR Policies",)], ids=["none", "empty", "one"])
def test_WR08_the_single_folder_note_is_byte_identical_to_the_phase_base(paths):
    from app.services.agent_loop import _folder_scope_note

    assert _folder_scope_note("/HR Policies", paths) == _base_note("/HR Policies")


def test_WR08_two_folders_are_both_named_and_the_default_path_stays_the_first():
    from app.services.agent_loop import _folder_scope_note

    note = _folder_scope_note("/HR Policies", ("/HR Policies", "/Legal"))
    assert "'/HR Policies'" in note and "'/Legal'" in note
    assert "default the path to '/HR Policies'" in note
    assert note != _base_note("/HR Policies")
    assert "expert" not in note.lower()


def test_WR08_the_call_site_passes_the_run_contexts_paths():
    calls = [
        n for n in ast.walk(ast.parse(AGENT_LOOP.read_text(encoding="utf-8")))
        if isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id == "_folder_scope_note"
    ]
    assert len(calls) == 1
    assert [ast.unparse(a) for a in calls[0].args] == ["scoped_folder_path", "ctx.scoped_folder_paths"]


def test_WR08_compose_restricted_with_two_visible_folders_carries_both_paths():
    from app.services.expert_scope import compose_expert_scope

    s = compose_expert_scope(
        scope_mode="restricted", thread_folder_id=None, expert_folder_ids=[HR_F, LEGAL_F], visible_folders=FOLDERS
    )
    assert s.scoped_folder_paths == ("/HR Policies", "/Legal")
    assert s.scoped_folder_paths[0] == s.scoped_folder_path


def test_WR08_compose_invisible_folders_carry_no_paths():
    from app.services.expert_scope import compose_expert_scope

    s = compose_expert_scope(
        scope_mode="restricted", thread_folder_id=None, expert_folder_ids=[GONE_F], visible_folders=FOLDERS
    )
    assert s.scoped_folder_path is None and s.scoped_folder_paths == ()


def test_WR08_compose_biased_with_a_thread_folder_lists_the_union_thread_first():
    from app.services.expert_scope import compose_expert_scope

    s = compose_expert_scope(
        scope_mode="biased", thread_folder_id=ACME_F, expert_folder_ids=[HR_F, ACME_SUB_F], visible_folders=FOLDERS
    )
    # ACME_SUB_F is inside the thread subtree, so it is already covered by '/Client ACME'.
    assert s.scoped_folder_paths == ("/Client ACME", "/HR Policies")
    assert s.scoped_folder_path == "/Client ACME"


def test_WR08_compose_biased_inside_the_thread_folder_stays_single():
    from app.services.expert_scope import compose_expert_scope

    s = compose_expert_scope(
        scope_mode="biased", thread_folder_id=ACME_F, expert_folder_ids=[ACME_SUB_F], visible_folders=FOLDERS
    )
    assert s.scoped_folder_paths == ("/Client ACME",)


def test_WR08_thread_scoping_keeps_its_five_positional_shape_and_carries_the_paths():
    import app.services.run_producer as rp

    legacy = rp.ThreadScoping(None, None, None, None, None)
    assert legacy.scoped_folder_paths is None
    src = (REPO_ROOT / "backend" / "app" / "services" / "run_producer.py").read_text(encoding="utf-8")
    assert src.count("scoped_folder_paths=_scoping.scoped_folder_paths") == 2  # both RunContext builds


def test_WR08_run_context_has_a_default_none_paths_field():
    from app.services.agent_loop import RunContext

    fields = RunContext.__dataclass_fields__
    assert "scoped_folder_paths" in fields and fields["scoped_folder_paths"].default is None
