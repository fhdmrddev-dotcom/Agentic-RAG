"""Phase 268 (CHAT-08 / D-268-12 / D-268-12c / D-268-25) — ONE payload states a folder-scope change.

The composer chip, the picker ledger and the transcript card all render from one server payload:

* ``build_scope_effect`` (pure) → ``ScopeEffect{held, expert, next, stops, saved}``. ``held`` is
  decided HERE (a Restricted Expert does not search the thread folder), never in the client
  (D-267-11 / D-268-12c).
* ``build_scope_changed_event`` (pure) snapshots the same structure plus ``from_folder`` /
  ``to_folder`` / ``during_run`` into the ``scope_changed`` transcript kind.
* ``describe_scope_change`` is the one async helper: two ``describe_expert_scope`` statements (the
  same statement the Expert event and the run read) and one ``fetch_visible_folders`` for paths.

``stops`` reuses the ``dropped`` computation of 267's ``build_expert_changed_event`` through the
extracted ``_dropped_line`` — 267's fixture byte-equality (``test_267_expert_changed_event.py``) is
the guard that the extraction changed nothing.
"""
from __future__ import annotations

import json
import pathlib
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tests.unit.test_267_scope_preview import (
    ACME_FOLDER,
    ACME_SUB,
    FA_ID,
    FIN_FOLDER,
    HR_FOLDER,
    HR_ID,
    ORG_ID,
    USER_ID,
    FakeSupabase,
    scope_patches,
)

AT = datetime(2026, 9, 28, 14, 35, tzinfo=timezone.utc)
FIXTURES = pathlib.Path(__file__).resolve().parent.parent / "fixtures" / "phase268"


async def change(expert_id, from_folder, to_folder, **kw):
    from app.services.expert_scope import describe_scope_change

    p1, p2, p3 = scope_patches(**kw)
    with p1, p2, p3:
        return await describe_scope_change(
            supabase=FakeSupabase(),
            pool=MagicMock(),
            user_id=USER_ID,
            org_id=ORG_ID,
            caller_roles=["member"],
            expert_id=expert_id,
            from_folder_id=from_folder,
            to_folder_id=to_folder,
        )


async def effect(expert_id, from_folder, to_folder, **kw):
    from app.services.expert_scope import build_scope_effect

    before, after, from_ref, to_ref = await change(expert_id, from_folder, to_folder, **kw)
    return build_scope_effect(before, after, from_ref=from_ref, to_ref=to_ref)


async def event(expert_id, from_folder, to_folder, *, during_run=False, **kw):
    from app.services.expert_scope import build_scope_changed_event

    before, after, from_ref, to_ref = await change(expert_id, from_folder, to_folder, **kw)
    return build_scope_changed_event(
        before, after, at=AT, during_run=during_run, from_ref=from_ref, to_ref=to_ref
    )


def _tf(ref):
    return None if ref is None else (str(ref.id), ref.name, ref.doc_count, ref.path)


# ── the folder path is a REUSE of compose_expert_scope, not a second tree walk ─────────────────────


def test_folder_path_reuses_the_composition_and_drops_the_leading_slash():
    from app.services.expert_scope import folder_path
    from tests.unit.test_267_scope_preview import VISIBLE_FOLDERS

    assert folder_path(ACME_SUB, VISIBLE_FOLDERS) == "Client ACME/Contracts"
    assert folder_path(ACME_FOLDER, VISIBLE_FOLDERS) == "Client ACME"
    # a folder the caller cannot see has no path (it renders as the unnameable phrase)
    assert folder_path("f9000000-0000-4000-8000-000000000009", VISIBLE_FOLDERS) is None
    assert folder_path(None, VISIBLE_FOLDERS) is None


# ── ScopeEffect ────────────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_no_expert_narrowing_next_is_the_new_subtree_and_stops_the_old():
    eff = await effect(None, ACME_FOLDER, ACME_SUB)
    assert eff.held is False
    assert eff.expert is None
    assert eff.saved is None
    assert _tf(eff.next.thread_folder) == (ACME_SUB, "Contracts", 2, "Client ACME/Contracts")
    assert eff.next.folders == [] and eff.next.all_documents is False
    assert _tf(eff.stops.thread_folder) == (ACME_FOLDER, "Client ACME", 4, "Client ACME")
    assert eff.stops.all_documents is False and eff.stops.folders == []


@pytest.mark.asyncio
async def test_biased_next_is_the_new_subtree_union_the_expert_folders():
    eff = await effect(FA_ID, ACME_FOLDER, ACME_SUB)
    assert eff.held is False
    assert (str(eff.expert.id), eff.expert.name, eff.expert.scope_mode) == (FA_ID, "Financial Analyzer", "biased")
    assert [str(f.id) for f in eff.next.folders] == [FIN_FOLDER]
    assert _tf(eff.next.thread_folder) == (ACME_SUB, "Contracts", 2, "Client ACME/Contracts")
    assert eff.next.connections == ["Slack"]
    # the Expert's folder stays; only the old thread subtree is dropped
    assert eff.stops.folders == []
    assert _tf(eff.stops.thread_folder) == (ACME_FOLDER, "Client ACME", 4, "Client ACME")
    assert eff.saved is None


@pytest.mark.asyncio
async def test_restricted_the_change_is_HELD_decided_on_the_server():
    eff = await effect(HR_ID, ACME_FOLDER, ACME_SUB)
    assert eff.held is True
    assert eff.expert.scope_mode == "restricted"
    # saved = the draft folder (with its path); next = the Expert's folders only
    assert _tf(eff.saved) == (ACME_SUB, "Contracts", 2, "Client ACME/Contracts")
    assert [(str(f.id), f.name) for f in eff.next.folders] == [(HR_FOLDER, "HR Policies")]
    assert eff.next.thread_folder is None
    assert eff.stops.folders == [] and eff.stops.thread_folder is None and eff.stops.all_documents is False


@pytest.mark.asyncio
async def test_widening_the_new_scope_contains_the_old_so_nothing_stops():
    eff = await effect(None, ACME_SUB, ACME_FOLDER)
    assert _tf(eff.next.thread_folder) == (ACME_FOLDER, "Client ACME", 4, "Client ACME")
    assert eff.stops.thread_folder is None
    assert eff.stops.folders == [] and eff.stops.all_documents is False and eff.stops.connections == []


@pytest.mark.asyncio
async def test_no_folder_to_a_folder_stops_all_other_documents():
    eff = await effect(None, None, ACME_FOLDER)
    assert eff.stops.all_documents is True
    assert _tf(eff.next.thread_folder) == (ACME_FOLDER, "Client ACME", 4, "Client ACME")


@pytest.mark.asyncio
async def test_a_folder_to_no_folder_searches_all_documents_next():
    eff = await effect(None, ACME_FOLDER, None)
    assert eff.next.all_documents is True
    assert eff.next.thread_folder is None
    assert eff.stops.thread_folder is None and eff.stops.all_documents is False


@pytest.mark.asyncio
async def test_at_rest_from_equals_to_and_nothing_stops():
    eff = await effect(None, ACME_FOLDER, ACME_FOLDER)
    assert _tf(eff.next.thread_folder) == (ACME_FOLDER, "Client ACME", 4, "Client ACME")
    assert eff.stops.thread_folder is None and eff.stops.all_documents is False


@pytest.mark.asyncio
async def test_at_rest_restricted_is_held_and_saved_is_the_current_folder():
    eff = await effect(HR_ID, ACME_FOLDER, ACME_FOLDER)
    assert eff.held is True
    assert _tf(eff.saved) == (ACME_FOLDER, "Client ACME", 4, "Client ACME")


@pytest.mark.asyncio
async def test_an_unresolvable_expert_falls_back_to_the_thread_alone_rather_than_blocking():
    """A folder change is never blocked by an Expert that no longer exists at all (LookupError)."""
    with patch("app.services.expert_scope.get_expert_service", AsyncMock(return_value=None)):
        eff = await effect(HR_ID, ACME_FOLDER, ACME_SUB, bundles={})
    assert eff.expert is None
    assert eff.held is False
    assert _tf(eff.next.thread_folder) == (ACME_SUB, "Contracts", 2, "Client ACME/Contracts")


# ── the scope_changed event ───────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_the_event_snapshots_from_to_expert_held_now_dropped_saved_and_during_run():
    ev = await event(HR_ID, ACME_FOLDER, ACME_SUB, during_run=True)
    assert ev.kind == "scope_changed"
    assert ev.at == AT
    assert _tf(ev.from_folder) == (ACME_FOLDER, "Client ACME", 4, "Client ACME")
    assert _tf(ev.to_folder) == (ACME_SUB, "Contracts", 2, "Client ACME/Contracts")
    assert ev.expert.name == "HR Advisor"
    assert ev.held is True
    assert _tf(ev.saved) == (ACME_SUB, "Contracts", 2, "Client ACME/Contracts")
    assert [f.name for f in ev.now.folders] == ["HR Policies"]
    assert ev.during_run is True


@pytest.mark.asyncio
async def test_clearing_the_folder_snapshots_to_folder_none():
    ev = await event(None, ACME_FOLDER, None)
    assert ev.to_folder is None
    assert ev.now.all_documents is True
    assert ev.held is False and ev.saved is None


@pytest.mark.asyncio
async def test_the_267_ref_models_are_unchanged_path_lives_on_the_subclass_only():
    """Pitfall 11: a defaulted ``path`` on TranscriptFolderRef would add a key to 267's dumps."""
    from app.models.message import ScopeFolderRef, TranscriptFolderRef

    assert "path" not in TranscriptFolderRef.model_fields
    assert "path" in ScopeFolderRef.model_fields
    assert issubclass(ScopeFolderRef, TranscriptFolderRef)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "name,expert_id,from_folder,to_folder,during_run",
    [
        ("scope_changed.json", None, ACME_FOLDER, ACME_SUB, False),
        ("scope_changed_held.json", HR_ID, ACME_FOLDER, ACME_SUB, False),
        ("scope_changed_during_run.json", FA_ID, ACME_FOLDER, ACME_SUB, True),
    ],
)
async def test_the_fixtures_are_the_real_builders_output(name, expert_id, from_folder, to_folder, during_run):
    """The wire contract ``ExpertEventCard``'s scope branch renders (268-03 Task 2)."""
    ev = await event(expert_id, from_folder, to_folder, during_run=during_run)
    fixture = json.loads((FIXTURES / name).read_text(encoding="utf-8"))
    assert fixture == ev.model_dump(mode="json")


# ── the NOT NULL content sentence ──────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_the_sentence_is_plain_text_from_the_same_payload():
    from app.services.expert_scope import scope_event_sentence

    assert scope_event_sentence(await event(None, ACME_FOLDER, ACME_SUB)) == (
        "Scope /Client ACME → /Client ACME/Contracts. "
        "Now: /Client ACME/Contracts (2). Dropped: /Client ACME (4)."
    )
    assert scope_event_sentence(await event(None, ACME_SUB, ACME_FOLDER)).endswith("Dropped: Nothing.")
    assert scope_event_sentence(await event(None, None, ACME_FOLDER)) == (
        "Scope All your documents → /Client ACME. Now: /Client ACME (4). Dropped: All other documents."
    )
    assert scope_event_sentence(await event(HR_ID, ACME_FOLDER, ACME_SUB)) == (
        "Scope /Client ACME → /Client ACME/Contracts. Saved: /Client ACME/Contracts. "
        "Searching: HR Policies only · HR Advisor is Restricted. Takes effect when HR Advisor leaves."
    )
