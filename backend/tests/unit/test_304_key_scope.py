"""Phase 304-02 (KEY-03, KEY-04; D-21, D-22, D-40; T-304-16) — the pure ``KeyScope`` composition.

``compose_key_scope`` is the ONE place an MCP key's narrowing becomes a scope. Pinned here:

  * an un-narrowed key's folder scope is ``None`` ("everything the member sees in the org");
  * a narrowed key's scope is the VISIBLE subtree of each ticked folder, resolved per call, so a
    subfolder made after the key was minted is included (D-21);
  * a ticked folder the member can no longer see is dropped, and when every one is dropped the
    scope is ``()`` — which matches nothing — and NEVER ``None`` (the 266 CR-01 class, T-304-16);
  * an org-shared or global folder is in a narrowed key's scope only when it is ticked (D-22);
  * connector-fed content has one home: ``source_connection_id IS NOT NULL`` (D-40);
  * the module is pure: no ``app.`` imports, no I/O, never raises.
"""

from __future__ import annotations

import dataclasses
import pathlib
import re

import pytest

from app.services import key_scope as ks

A, B, C, D = "a" * 8, "b" * 8, "c" * 8, "d" * 8
S, G, X = "s" * 8, "g" * 8, "x" * 8


def _folders(*pairs: tuple[str, str | None]) -> list[dict]:
    return [{"id": fid, "parent_id": parent, "name": fid[:1].upper()} for fid, parent in pairs]


TREE = _folders((A, None), (B, A), (C, B), (S, None), (G, None))


def _compose(key_folder_ids, *, visible=TREE, include_external=False, tools=("read_document",)):
    return ks.compose_key_scope(
        key_folder_ids=key_folder_ids,
        include_external=include_external,
        tools=list(tools),
        visible_folders=visible,
    )


def test_an_unnarrowed_key_has_no_folder_scope():
    scope = _compose(None)
    assert scope.folder_ids is None


def test_a_ticked_folder_brings_its_whole_visible_subtree():
    scope = _compose([A])
    assert set(scope.folder_ids) == {A, B, C}


def test_a_subfolder_made_after_the_key_is_included():
    later = TREE + _folders((D, B))
    scope = _compose([A], visible=later)
    assert set(scope.folder_ids) == {A, B, C, D}


def test_ticking_a_subfolder_does_not_widen_to_its_parent():
    scope = _compose([B])
    assert set(scope.folder_ids) == {B, C}


def test_a_ticked_folder_no_longer_visible_is_dropped():
    scope = _compose([A, X])
    assert set(scope.folder_ids) == {A, B, C}
    assert X not in scope.folder_ids


def test_all_ticked_folders_dropped_is_empty_never_none():
    scope = _compose([X])
    assert scope.folder_ids == ()
    assert scope.folder_ids is not None


def test_an_empty_ticked_list_is_empty_never_none():
    scope = _compose([])
    assert scope.folder_ids == ()


def test_an_org_shared_or_global_folder_needs_a_tick():
    narrowed = _compose([A])
    assert S not in narrowed.folder_ids and G not in narrowed.folder_ids
    ticked = _compose([A, S, G])
    assert {S, G} <= set(ticked.folder_ids)


def test_a_parent_cycle_terminates():
    cyclic = _folders((A, B), (B, A))
    scope = _compose([A], visible=cyclic)
    assert set(scope.folder_ids) == {A, B}


def test_a_self_parent_and_malformed_rows_never_raise():
    odd = [{"id": A, "parent_id": A}, {"parent_id": A}, {"id": None}, {"id": B, "parent_id": A}]
    scope = _compose([A], visible=odd)
    assert set(scope.folder_ids) == {A, B}


def test_the_folder_ids_are_unique_and_ordered():
    overlapping = _compose([A, B])
    assert len(overlapping.folder_ids) == len(set(overlapping.folder_ids))
    assert list(overlapping.folder_ids) == sorted(overlapping.folder_ids)


def test_uuid_shaped_ids_compare_as_strings():
    import uuid

    a, b = uuid.uuid4(), uuid.uuid4()
    visible = [{"id": a, "parent_id": None}, {"id": b, "parent_id": a}]
    scope = _compose([str(a)], visible=visible)
    assert set(scope.folder_ids) == {str(a), str(b)}


def test_external_and_tools_carry_through():
    off = _compose(None, include_external=False, tools=("search_knowledge_base", "read_document"))
    assert off.exclude_external is True
    assert off.tools == frozenset({"search_knowledge_base", "read_document"})
    on = _compose(None, include_external=True)
    assert on.exclude_external is False


def test_the_scope_is_frozen():
    scope = _compose([A])
    with pytest.raises(dataclasses.FrozenInstanceError):
        scope.folder_ids = None  # type: ignore[misc]


# ── connector-fed: one home (D-40) ─────────────────────────────────────────────────────────────


def test_connector_fed_is_one_column():
    assert ks.EXTERNAL_COLUMN == "source_connection_id"
    assert ks.EXTERNAL_SQL == "source_connection_id IS NOT NULL"
    assert ks.EXTERNAL_COLUMN in ks.EXTERNAL_SQL


@pytest.mark.parametrize(
    "row, external",
    [
        ({"source_connection_id": "x"}, True),
        ({"source_connection_id": None}, False),
        ({}, False),
    ],
)
def test_is_external(row, external):
    assert ks.is_external(row) is external


# ── purity fences ──────────────────────────────────────────────────────────────────────────────


def _source() -> str:
    return pathlib.Path(ks.__file__).read_text(encoding="utf-8")


def test_the_module_imports_nothing_from_the_app():
    assert not re.search(r"^\s*(from app|import app)\b", _source(), re.M)


def test_the_module_never_turns_nothing_into_everything():
    src = _source()
    assert not re.search(r"if .* else None", src)
    assert not re.search(r"\bor None\b", src)
