"""Phase 275 code-review fix pass (275-REVIEW-backend.md) — the Python halves, stubbed.

* **B-WR-03** — the folder delete door issues ONE ``delete_folder_tree`` call (one transaction) and
  no PostgREST table delete of its own; bytes are removed only for the paths that call returned.
* **B-WR-06** — every supabase-py ``execute`` / storage ``remove`` in the two rewritten delete doors
  runs off the event loop (D-v2.5-01).

The live halves (migration 206, confirm) are in ``tests/integration/test_275_review_*.py``.
"""
from __future__ import annotations

import ast
import asyncio
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.services.retention import hold_guard

BACKEND = Path(__file__).resolve().parents[2]
DOCUMENTS_PATH = BACKEND / "app" / "api" / "documents.py"
FOLDERS_PATH = BACKEND / "app" / "api" / "folders.py"

# ── B-WR-03: the folder door is one call ─────────────────────────────────────────────────────

def _folder_door(monkeypatch, *, rpc_rows, rpc_raises=None):
    from app.api import folders
    from tests.unit.test_275_delete_paths import _FakeSupabase, _audit_recorder, _guard

    log: list = []
    monkeypatch.setattr(folders, "write_audit_entry", _audit_recorder(log))
    monkeypatch.setattr(hold_guard, "assert_none_held", _guard(log))
    docs = [{"id": "d1", "file_path": "u/a.pdf"}, {"id": "d2", "file_path": "u/b.pdf"}]
    sb = _FakeSupabase(
        log,
        answers={
            ("folders", "select"): [],
            ("folders", "select", "single"): {"id": "f", "name": "Contracts", "org_id": "o"},
            ("documents", "select"): docs,
        },
    )

    class _Rpc:
        def execute(self_inner):
            log.append(("rpc", "delete_folder_tree", None))
            if rpc_raises is not None:
                raise rpc_raises
            return SimpleNamespace(data=rpc_rows)

    def _rpc(name, params):
        assert name == "delete_folder_tree" and params == {"p_folder_id": "f"}
        return _Rpc()

    sb.rpc = _rpc
    coro = folders.delete_folder(
        folder_id="f", request=SimpleNamespace(state=SimpleNamespace()),
        current_user={"id": "u", "email": "m@example.com"}, supabase=sb, service_supabase=object(),
    )
    return log, coro


def test_wr03_the_folder_door_deletes_through_one_transactional_call(monkeypatch):
    log, coro = _folder_door(monkeypatch, rpc_rows=[{"document_id": "d1", "file_path": "u/a.pdf"}])
    asyncio.run(coro)
    table_deletes = [e for e in log if len(e) == 3 and e[1] == "delete" and e[0] in ("documents", "folders")]
    assert table_deletes == [], "B-WR-03: the door still issues its own non-atomic deletes"
    assert [e[0] for e in log if e[0] in ("guard", "rpc", "storage", "audit")] == ["guard", "rpc", "storage", "audit"]
    # bytes only for the rows the transaction actually deleted (d2 was another owner's, untouched)
    assert [e[2] for e in log if e[0] == "storage"] == [["u/a.pdf"]]
    audit = next(e for e in log if e[0] == "audit")
    assert audit[2]["metadata"]["documents_deleted"] == 1


def test_wr03_a_refused_transaction_removes_no_byte(monkeypatch):
    from tests.unit.test_275_delete_paths import _pt409

    log, coro = _folder_door(monkeypatch, rpc_rows=[], rpc_raises=_pt409())
    with pytest.raises(Exception) as exc:
        asyncio.run(coro)
    assert getattr(exc.value, "status_code", None) == 409
    assert exc.value.detail["message"].endswith("Nothing was deleted." + hold_guard.MEMBER_SUFFIX)
    assert not [e for e in log if e[0] in ("storage", "audit")]


# ── B-WR-06: off the event loop ──────────────────────────────────────────────────────────────

def _function_node(path: Path, name: str):
    for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == name:
            return node
    raise AssertionError(f"{name} not found — the fence would pass vacuously")


def _blocking_calls_on_the_loop(fn) -> list[int]:
    """Every ``.execute()`` / ``.remove(...)`` call that is NOT inside a lambda (a lambda is what
    ``run_in_threadpool`` runs; ``aexec`` takes the builder and calls ``execute`` itself)."""
    inside_lambda: set[int] = set()
    for node in ast.walk(fn):
        if isinstance(node, ast.Lambda):
            inside_lambda.update(id(n) for n in ast.walk(node))
    out = []
    for node in ast.walk(fn):
        if (isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
                and node.func.attr in ("execute", "remove") and id(node) not in inside_lambda):
            out.append(node.lineno)
    return out


@pytest.mark.parametrize("path, name", [(DOCUMENTS_PATH, "delete_document"), (FOLDERS_PATH, "delete_folder")])
def test_wr06_the_delete_doors_run_no_blocking_supabase_call_on_the_event_loop(path, name):
    fn = _function_node(path, name)
    calls = [n for n in ast.walk(fn) if isinstance(n, ast.Call)]
    assert calls, "vacuous"
    assert _blocking_calls_on_the_loop(fn) == [], f"{name}: blocking supabase-py calls on the event loop"
