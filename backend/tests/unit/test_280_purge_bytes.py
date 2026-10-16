"""Phase 280 plan 01 Task 1 (DEBT-10 / D-11 / D-12 / D-13 / D-31 / BUG-261012-01) — PURGE BYTES.

⛔ THE DEFECT. Both watch purge doors (``DELETE /sources/watches/{id}?purge_documents=true`` and
``POST /sources/watches/{id}/purge``) deleted the ``documents`` rows and never removed the stored
file bytes, so every purged watch document left an orphaned object in the ``documents`` bucket.

⭐ THE CONTRACT (275 D-38 / T-275-12, binding), now in ONE helper —
``app.services.document_purge.purge_documents``:
  * ``hold_guard.assert_none_held`` first — a held document refuses 409 before anything is removed;
  * then the user-JWT row DELETE inside ``hold_guard.map_hold_refusal`` (a PT409 race is the 409);
  * then ``remove_document_bytes`` for the ``file_path`` of the rows the DELETE RETURNED (D-31: no
    pre-SELECT, so only rows actually deleted lose bytes);
  * a storage failure is logged, never raised; any other DB error propagates and removes nothing.

The guard is called THROUGH the module attribute (D-31) — a by-name import would make every
monkeypatched guard test here vacuous, so that is pinned too.

Every case is STUBBED, reusing the recording fakes of ``test_275_delete_paths.py``.
"""
from __future__ import annotations

import ast
import logging
from pathlib import Path

import pytest
from fastapi import HTTPException

from app.services.retention import hold_guard
from tests.unit.test_275_delete_paths import (
    CURRENT_USER,
    DOC,
    SIB,
    USER,
    _FakeSupabase,
    _Pool,
    _delete_watch_purge,
    _deletes,
    _guard,
    _kinds,
    _missing_items,
    _patch_watch,
    _pt409,
    _purge_missing,
    _refusal,
    _removes,
    _run,
)

BACKEND = Path(__file__).resolve().parents[2]
PURGE_PATH = BACKEND / "app" / "services" / "document_purge.py"

PATH_DOC = f"{USER}/{DOC}/a.pdf"
PATH_SIB = f"{USER}/{SIB}/b.pdf"


def _deleted_rows():
    return {("documents", "delete"): [{"id": DOC, "file_path": PATH_DOC},
                                      {"id": SIB, "file_path": PATH_SIB}]}


async def _purge(sb, *, kind="watch_delete", ids=(DOC, SIB)):
    from app.services import document_purge

    return await document_purge.purge_documents(
        object(), CURRENT_USER, list(ids), kind=kind, supabase=sb, service_supabase=object(),
    )


# ── the helper ───────────────────────────────────────────────────────────────────────────

def test_purge_order_is_guard_then_rows_then_bytes(monkeypatch):
    log: list = []
    monkeypatch.setattr(hold_guard, "assert_none_held", _guard(log))
    sb = _FakeSupabase(log, answers=_deleted_rows())
    deleted = _run(_purge(sb))
    assert _kinds(log) == ["guard", "documents.delete", "storage.remove"]
    assert sorted(_removes(log)[0][2]) == sorted([PATH_DOC, PATH_SIB])
    assert [r["id"] for r in deleted] == [DOC, SIB]


def test_bytes_come_only_from_rows_the_delete_returned(monkeypatch):
    """D-31: a row the DELETE did not return (RLS-scoped) keeps its bytes; a row with no
    file_path contributes nothing."""
    log: list = []
    monkeypatch.setattr(hold_guard, "assert_none_held", _guard(log))
    sb = _FakeSupabase(log, answers={("documents", "delete"): [
        {"id": DOC, "file_path": PATH_DOC},
        {"id": SIB, "file_path": None},
    ]})
    _run(_purge(sb, ids=(DOC, SIB, "99999999-9999-4999-8999-999999999999")))
    assert _removes(log) == [("storage", "remove", [PATH_DOC])]


def test_a_delete_that_returned_no_rows_removes_no_bytes(monkeypatch):
    log: list = []
    monkeypatch.setattr(hold_guard, "assert_none_held", _guard(log))
    sb = _FakeSupabase(log)  # answers [] for the delete
    assert _run(_purge(sb)) == []
    assert _removes(log) == []


def test_a_held_document_refuses_before_any_delete_and_keeps_its_bytes(monkeypatch):
    log: list = []
    monkeypatch.setattr(hold_guard, "assert_none_held", _guard(log, refuse=_refusal("watch_delete", 1)))
    sb = _FakeSupabase(log, answers=_deleted_rows())
    with pytest.raises(HTTPException) as exc:
        _run(_purge(sb))
    assert exc.value.status_code == 409
    assert _deletes(log) == []
    assert _removes(log) == []


def test_a_pt409_race_on_the_row_delete_is_409_and_removes_no_bytes(monkeypatch):
    log: list = []
    monkeypatch.setattr(hold_guard, "assert_none_held", _guard(log))
    sb = _FakeSupabase(log, answers=_deleted_rows(), raises={("documents", "delete"): _pt409()})
    with pytest.raises(HTTPException) as exc:
        _run(_purge(sb, kind="watch_purge"))
    assert exc.value.status_code == 409
    assert _removes(log) == []


def test_a_non_hold_db_error_propagates_and_removes_no_bytes(monkeypatch):
    log: list = []
    monkeypatch.setattr(hold_guard, "assert_none_held", _guard(log))
    sb = _FakeSupabase(log, answers=_deleted_rows(), raises={("documents", "delete"): RuntimeError("db down")})
    with pytest.raises(RuntimeError):
        _run(_purge(sb))
    assert _removes(log) == []


def test_a_storage_failure_is_logged_never_raised(monkeypatch, caplog):
    log: list = []
    monkeypatch.setattr(hold_guard, "assert_none_held", _guard(log))
    sb = _FakeSupabase(log, answers=_deleted_rows())
    sb.remove_raises = True
    with caplog.at_level(logging.WARNING, logger="app.services.document_purge"):
        deleted = _run(_purge(sb))
    assert [r["id"] for r in deleted] == [DOC, SIB]
    assert _kinds(log) == ["guard", "documents.delete", "storage.remove"]
    failures = [r for r in caplog.records if r.name == "app.services.document_purge"]
    assert failures, "the storage failure was swallowed without a log line"
    assert any(r.exc_info for r in failures), "the storage exception was not logged with its traceback"
    # 280-REVIEW IN-04: the bytes step is shared by retention AND both watch purge doors, so its
    # line must not claim the failure for retention. This is a watch purge.
    bytes_line = next(r for r in failures if r.exc_info)
    assert not bytes_line.getMessage().startswith("retention:"), bytes_line.getMessage()
    assert bytes_line.getMessage().startswith("remove_document_bytes:"), bytes_line.getMessage()


# ── the two doors, through the helper ────────────────────────────────────────────────────

def test_watch_delete_door_removes_bytes_after_the_rows_and_before_the_watch(monkeypatch):
    log: list = []
    _patch_watch(monkeypatch, log)
    monkeypatch.setattr(hold_guard, "assert_none_held", _guard(log))
    sb = _FakeSupabase(log, answers=_deleted_rows())
    _run(_delete_watch_purge(sb, _Pool(log, [])))
    order = [e[0] if e[0] in ("guard", "watch") else f"{e[0]}.{e[1]}" for e in log]
    assert order == ["guard", "documents.delete", "storage.remove", "watch"]
    assert [e[1] for e in log if e[0] == "guard"] == ["watch_delete"]


def test_purge_missing_door_removes_bytes_after_the_rows_and_before_the_items(monkeypatch):
    log: list = []
    _patch_watch(monkeypatch, log)
    monkeypatch.setattr(hold_guard, "assert_none_held", _guard(log))
    sb = _FakeSupabase(log, answers=_deleted_rows())
    resp = _run(_purge_missing(sb, _Pool(log, _missing_items())))
    order = [e[0] if e[0] in ("guard", "pool") else f"{e[0]}.{e[1]}" for e in log]
    assert order == ["guard", "documents.delete", "storage.remove", "pool"]
    assert [e[1] for e in log if e[0] == "guard"] == ["watch_purge"]
    assert resp.purged_count == 2  # D-12: purged_count stays len(doc_ids) — behaviour preserved


def test_a_held_purge_door_keeps_every_byte(monkeypatch):
    log: list = []
    _patch_watch(monkeypatch, log)
    monkeypatch.setattr(hold_guard, "assert_none_held", _guard(log, refuse=_refusal("watch_purge", 1)))
    sb = _FakeSupabase(log, answers=_deleted_rows())
    with pytest.raises(HTTPException) as exc:
        _run(_purge_missing(sb, _Pool(log, _missing_items())))
    assert exc.value.status_code == 409
    assert _removes(log) == []
    assert not [e for e in log if e[0] == "pool"]


# ── source fences ────────────────────────────────────────────────────────────────────────

def _function_node(source: str, name: str) -> ast.AST:
    tree = ast.parse(source)
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == name:
            return node
    raise AssertionError(f"{name} not found — the fence would pass vacuously")


def _order_violations(source: str) -> list[str]:
    """Inside ``purge_documents``: the guard call < every ``.delete(`` < every bytes removal."""
    node = _function_node(source, "purge_documents")
    guards, deletes, removes = [], [], []
    for n in (n for stmt in node.body for n in ast.walk(stmt)):
        if not isinstance(n, ast.Call):
            continue
        fname = n.func.attr if isinstance(n.func, ast.Attribute) else getattr(n.func, "id", None)
        if fname == "assert_none_held":
            guards.append(n.lineno)
        elif fname == "delete":
            deletes.append(n.lineno)
        elif fname in ("remove", "remove_document_bytes"):
            removes.append(n.lineno)
    out = []
    if not (guards and deletes and removes):
        out.append(f"vacuous: guard={guards} delete={deletes} remove={removes}")
        return out
    if max(guards) >= min(deletes):
        out.append(f"guard line {max(guards)} is not before delete line {min(deletes)}")
    if max(deletes) >= min(removes):
        out.append(f"delete line {max(deletes)} is not before bytes-removal line {min(removes)}")
    return out


def test_purge_documents_orders_guard_then_delete_then_bytes():
    assert _order_violations(PURGE_PATH.read_text(encoding="utf-8")) == []


def test_the_order_fence_can_fire():
    planted = (
        "async def purge_documents(request, current_user, doc_ids, *, kind, supabase, service_supabase):\n"
        "    await hold_guard.assert_none_held(request, current_user, doc_ids, kind=kind)\n"
        "    await remove_document_bytes(supabase, ['p'], [], [])\n"
        "    supabase.table('documents').delete().in_('id', doc_ids).execute()\n"
    )
    assert _order_violations(planted), "the order fence cannot detect bytes removed before the rows"


def test_only_the_storage_remove_may_sit_inside_a_try():
    src = PURGE_PATH.read_text(encoding="utf-8")
    assert [n for n in ast.walk(_function_node(src, "purge_documents")) if isinstance(n, ast.Try)] == []
    tries = [n for n in ast.walk(_function_node(src, "remove_document_bytes")) if isinstance(n, ast.Try)]
    assert len(tries) == 1


def test_the_guard_is_called_through_the_module_attribute_d31():
    from app.services import document_purge

    assert not hasattr(document_purge, "assert_none_held")
    assert not hasattr(document_purge, "map_hold_refusal")
    assert document_purge.hold_guard is hold_guard
    src = PURGE_PATH.read_text(encoding="utf-8")
    assert "hold_guard.assert_none_held(" in src
    assert "hold_guard.map_hold_refusal(" in src


def test_disposition_shares_the_one_bytes_function():
    from app.services import document_purge
    from app.services.retention import disposition

    assert disposition._remove_bytes is document_purge.remove_document_bytes


def test_the_bucket_name_has_one_home():
    """280-REVIEW IN-03: after the lift, disposition kept an unused ``STORAGE_BUCKET`` copy, so the
    bucket name had two homes and a rename could update one and not the other."""
    from app.services import document_purge
    from app.services.retention import disposition

    assert document_purge.STORAGE_BUCKET == "documents"
    assert not hasattr(disposition, "STORAGE_BUCKET"), "disposition.py still carries its own bucket name"
