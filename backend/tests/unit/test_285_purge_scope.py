"""Phase 285-02 (FIX-13 / BUG-261014-03 / BUG-261014-05; D-06, D-08, D-09, D-10) — unit pins.

⛔ THE DEFECTS.
  * Both watch purge doors deleted EVERY document a watch item pointed at — including a hand
    upload the watch only dedup-linked to (FIX-13).
  * Door 2's ``purged_count`` was ``len(doc_ids)`` — the REQUESTED set, never what was deleted.
  * ``remove_document_bytes`` reported every path removed without reading what Storage answered
    (BUG-261014-05): storage3 2.29 returns only the objects it deleted and silently omits the rest.

⭐ THE CONTRACT.
  * The doors take their delete set from ``db.watches.watch_purge_scope`` — the documents the watch
    MINTED and that no item outside the purge scope still references (D-06 / D-08) — and pass only
    ``purge_doc_ids`` to ``document_purge.purge_documents``.
  * Door 2: ``purged_count = len(rows the DELETE returned)``; additive ``kept_count``; every
    in-scope item row is still deleted (unlinking is not deleting).
  * Order unchanged: guard → rows → bytes (275 D-38 / T-275-12).

⚠ Pitfall 2 (RESEARCH): ``test_275_delete_paths._Con.fetch`` returns the items for ANY SQL, so a
scope query run through it would report every document as shared and a green "kept" would prove
nothing. The doors' scope is therefore patched BY ATTRIBUTE (``app.api.sources.watch_purge_scope``),
and the helper's own partitioning is driven through an SQL-AWARE fake below.
"""
from __future__ import annotations

import ast
import asyncio
import inspect
from pathlib import Path
from types import SimpleNamespace
from uuid import UUID

import pytest

from app.services.retention import hold_guard
from tests.unit.test_275_delete_paths import (
    DOC,
    SIB,
    USER,
    WATCH,
    _FakeSupabase,
    _Pool,
    _delete_watch_purge,
    _guard,
    _kinds,
    _patch_watch,
    _purge_missing,
    _removes,
    _run,
)

BACKEND = Path(__file__).resolve().parents[2]
SOURCES_PATH = BACKEND / "app" / "api" / "sources.py"
PURGE_PATH = BACKEND / "app" / "services" / "document_purge.py"

I1 = UUID("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1")
I2 = UUID("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2")
PATH_DOC = f"{USER}/{DOC}/a.pdf"
PATH_SIB = f"{USER}/{SIB}/b.pdf"


def _scope(*, item_ids, purge, kept):
    from app.db.watches import WatchPurgeScope

    return WatchPurgeScope(item_ids=list(item_ids), purge_doc_ids=list(purge), kept_doc_ids=list(kept))


def _patch_scope(monkeypatch, scope, calls: list):
    from app.api import sources

    async def _watch_purge_scope(pool, watch_id, *, user_id, states):
        calls.append({"watch_id": watch_id, "user_id": user_id, "states": states})
        return scope

    # raising=True (the default): before the fix the door module has no such attribute — RED.
    monkeypatch.setattr(sources, "watch_purge_scope", _watch_purge_scope)


class _ArgCon:
    """A pool connection that RECORDS the args of every execute and refuses any fetch.

    The doors must read their scope through ``watch_purge_scope`` (patched), never inline.
    """

    def __init__(self, log, executes):
        self.log = log
        self.executes = executes

    async def fetch(self, sql, *args):  # pragma: no cover - the assertion IS the failure
        raise AssertionError(f"the door read watch items inline instead of via watch_purge_scope: {sql}")

    async def execute(self, sql, *args):
        self.log.append(("pool", "execute", sql))
        self.executes.append((sql, args))
        return "DELETE 1"


class _ArgPool:
    def __init__(self, log):
        self.executes: list = []
        self.con = _ArgCon(log, self.executes)

    def acquire(self):
        con = self.con

        class _A:
            async def __aenter__(self):
                return con

            async def __aexit__(self, *a):
                return False

        return _A()


def _delete_ids(log) -> list:
    """The ``in_("id", [...])`` argument of every documents DELETE in the log."""
    out = []
    for table, verb, calls in (e for e in log if len(e) == 3 and e[0] == "documents" and e[1] == "delete"):
        for name, args in calls:
            if name == "in_":
                out.append(list(args[1]))
    return out


# ── door 2 (POST /sources/watches/{id}/purge) ────────────────────────────────────────────

def test_door2_purges_only_the_scope_purge_set_and_deletes_every_scope_item(monkeypatch):
    log: list = []
    calls: list = []
    _patch_watch(monkeypatch, log)
    _patch_scope(monkeypatch, _scope(item_ids=[I1, I2], purge=[DOC], kept=[SIB]), calls)
    monkeypatch.setattr(hold_guard, "assert_none_held", _guard(log))
    sb = _FakeSupabase(log, answers={("documents", "delete"): [{"id": DOC, "file_path": PATH_DOC}]})
    pool = _ArgPool(log)

    resp = _run(_purge_missing(sb, pool))

    assert calls == [{"watch_id": UUID(WATCH), "user_id": UUID(USER), "states": ["missing", "unauthorized"]}]
    guard = [e for e in log if e[0] == "guard"]
    assert guard[0][2]["document_ids"] == [DOC], "the hold guard saw a document the purge must keep"
    assert _delete_ids(log) == [[DOC]], "the DELETE named a linked/shared document (FIX-13)"
    assert _removes(log) == [("storage", "remove", [PATH_DOC])]
    item_deletes = [args for sql, args in pool.executes if "connector_watch_items" in sql]
    assert item_deletes == [([I1, I2],)], "every in-scope item row is deleted, linked ones included"
    assert resp.purged_count == 1
    assert resp.kept_count == 1
    assert "Purged 1" in resp.message and "Kept 1" in resp.message, resp.message


def test_door2_purged_count_is_rows_deleted_not_ids_requested(monkeypatch):
    """D-09: a DELETE that returned no rows (RLS-filtered, or already gone) purged nothing."""
    log: list = []
    _patch_watch(monkeypatch, log)
    _patch_scope(monkeypatch, _scope(item_ids=[I1, I2], purge=[DOC, SIB], kept=[]), [])
    monkeypatch.setattr(hold_guard, "assert_none_held", _guard(log))
    sb = _FakeSupabase(log)  # answers [] for the delete
    resp = _run(_purge_missing(sb, _ArgPool(log)))
    assert resp.purged_count == 0, "purged_count counted the requested ids, not the rows deleted"
    assert resp.kept_count == 0


def test_door2_with_nothing_to_purge_calls_no_purge_and_still_unlinks(monkeypatch):
    log: list = []
    _patch_watch(monkeypatch, log)
    _patch_scope(monkeypatch, _scope(item_ids=[I1, I2], purge=[], kept=[DOC, SIB]), [])
    monkeypatch.setattr(hold_guard, "assert_none_held", _guard(log))
    sb = _FakeSupabase(log)
    pool = _ArgPool(log)
    resp = _run(_purge_missing(sb, pool))
    assert not [e for e in log if e[0] == "guard"], "a purge with an empty delete set still ran"
    assert _delete_ids(log) == []
    assert _removes(log) == []
    assert [args for sql, args in pool.executes if "connector_watch_items" in sql] == [([I1, I2],)]
    assert resp.purged_count == 0
    assert resp.kept_count == 2
    assert "Kept 2" in resp.message and " are " in resp.message, resp.message


def test_door2_order_is_guard_then_rows_then_bytes(monkeypatch):
    log: list = []
    _patch_watch(monkeypatch, log)
    _patch_scope(monkeypatch, _scope(item_ids=[I1], purge=[DOC], kept=[]), [])
    monkeypatch.setattr(hold_guard, "assert_none_held", _guard(log))
    sb = _FakeSupabase(log, answers={("documents", "delete"): [{"id": DOC, "file_path": PATH_DOC}]})
    _run(_purge_missing(sb, _ArgPool(log)))
    assert _kinds(log) == ["guard", "documents.delete", "storage.remove"]
    order = [e[0] if e[0] in ("guard", "pool") else f"{e[0]}.{e[1]}" for e in log]
    assert order == ["guard", "documents.delete", "storage.remove", "pool"]


# ── door 1 (DELETE /sources/watches/{id}?purge_documents=true) ───────────────────────────

def test_door1_with_only_kept_documents_purges_nothing_and_deletes_the_watch(monkeypatch):
    log: list = []
    calls: list = []
    _patch_watch(monkeypatch, log)
    _patch_scope(monkeypatch, _scope(item_ids=[I1], purge=[], kept=[SIB]), calls)
    monkeypatch.setattr(hold_guard, "assert_none_held", _guard(log))
    sb = _FakeSupabase(log)
    assert _run(_delete_watch_purge(sb, _Pool(log, []))) is None  # 204: no body
    assert calls == [{"watch_id": UUID(WATCH), "user_id": UUID(USER), "states": None}]
    assert not [e for e in log if e[0] == "guard"]
    assert _delete_ids(log) == []
    assert [e for e in log if e[0] == "watch"], "the watch was not deleted"


def test_door1_purges_only_the_minted_unshared_set_in_order(monkeypatch):
    log: list = []
    _patch_watch(monkeypatch, log)
    _patch_scope(monkeypatch, _scope(item_ids=[I1, I2], purge=[DOC], kept=[SIB]), [])
    monkeypatch.setattr(hold_guard, "assert_none_held", _guard(log))
    sb = _FakeSupabase(log, answers={("documents", "delete"): [{"id": DOC, "file_path": PATH_DOC}]})
    _run(_delete_watch_purge(sb, _Pool(log, [])))
    assert [e[2]["document_ids"] for e in log if e[0] == "guard"] == [[DOC]]
    assert _delete_ids(log) == [[DOC]]
    order = [e[0] if e[0] in ("guard", "watch") else f"{e[0]}.{e[1]}" for e in log]
    assert order == ["guard", "documents.delete", "storage.remove", "watch"]


# ── watch_purge_scope: the partition, through an SQL-AWARE fake ──────────────────────────

class _ScopeCon:
    def __init__(self, item_rows, doc_rows):
        self.item_rows, self.doc_rows = item_rows, doc_rows
        self.sql: list[tuple[str, tuple]] = []

    async def fetch(self, sql, *args):
        self.sql.append((sql, args))
        if "bool_or" in sql:
            return self.doc_rows
        return self.item_rows


class _ScopePool:
    def __init__(self, con):
        self.con = con

    def acquire(self):
        con = self.con

        class _A:
            async def __aenter__(self):
                return con

            async def __aexit__(self, *a):
                return False

        return _A()


def test_watch_purge_scope_partitions_minted_unshared_from_linked_and_shared():
    from app.db import watches

    d_minted, d_linked, d_shared = (
        "d0000000-0000-4000-8000-000000000001",
        "d0000000-0000-4000-8000-000000000002",
        "d0000000-0000-4000-8000-000000000003",
    )
    con = _ScopeCon(
        item_rows=[{"id": I1}, {"id": I2}],
        doc_rows=[
            {"document_id": UUID(d_minted), "minted": True, "shared": False},
            {"document_id": UUID(d_linked), "minted": False, "shared": False},
            {"document_id": UUID(d_shared), "minted": True, "shared": True},
        ],
    )
    scope = asyncio.run(watches.watch_purge_scope(
        _ScopePool(con), UUID(WATCH), user_id=UUID(USER), states=["missing", "unauthorized"],
    ))
    assert scope.item_ids == [I1, I2]
    assert scope.purge_doc_ids == [d_minted]
    assert sorted(scope.kept_doc_ids) == sorted([d_linked, d_shared])
    # Every statement carries the watch id, the owner and the state filter.
    for _sql, args in con.sql:
        assert args[:3] == (UUID(WATCH), UUID(USER), ["missing", "unauthorized"]), args


def test_watch_purge_scope_sql_reads_the_marker_and_never_the_provenance_field():
    """D-06: the scope is the minted MARKER — never ``source_connection_id``, the copied
    provenance field the roadmap names as the failure mode. D-08: the shared check is an
    anti-join over items OUTSIDE the scope. T-285-13: an owner predicate is IN the SQL."""
    from app.db import watches

    src = inspect.getsource(watches.watch_purge_scope)
    assert "minted" in src
    assert "NOT IN (SELECT id FROM scope)" in src
    assert "user_id = $2" in src
    assert "source_connection_id" not in src


def test_doors_call_the_scope_helper_and_never_import_purge_by_name():
    src = SOURCES_PATH.read_text(encoding="utf-8")
    assert src.count("watch_purge_scope(") == 2
    assert "purged_count = len(deleted)" in src
    assert "purged_count = len(doc_ids)" not in src
    tree = ast.parse(src)
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module == "app.services.document_purge":
            raise AssertionError("purge_documents imported by name — the query param shadows it (D-31)")
        if isinstance(node, ast.ImportFrom):
            names = {a.name for a in node.names}
            assert "purge_documents" not in names and "assert_none_held" not in names, node.module


# ── BUG-261014-05 / D-10: remove_document_bytes reads Storage's answer ───────────────────

class _Store:
    def __init__(self, answer=None, raises=False):
        self.answer, self.raises = answer, raises
        self.calls: list[list[str]] = []
        outer = self

        class _B:
            def remove(self, paths):
                outer.calls.append(list(paths))
                if outer.raises:
                    raise RuntimeError("storage unavailable")
                return outer.answer(paths) if callable(outer.answer) else outer.answer

        self.storage = SimpleNamespace(from_=lambda bucket: _B())


def _remove(store, paths):
    from app.services import document_purge

    removed: list[str] = []
    not_removed: list[str] = []
    asyncio.run(document_purge.remove_document_bytes(store, list(paths), removed, not_removed))
    return removed, not_removed


def test_a_path_storage_did_not_confirm_is_not_reported_removed():
    p1, p2 = "u/d1/a.txt", "u/d2/never-existed.txt"
    removed, not_removed = _remove(_Store(answer=[{"name": p1, "bucket_id": "documents"}]), [p1, p2])
    assert removed == [p1]
    assert not_removed == [p2], "a path Storage silently omitted was reported removed (BUG-261014-05)"


@pytest.mark.parametrize("answer", [None, []])
def test_no_confirmation_at_all_reports_every_path_not_removed(answer):
    p1, p2 = "u/d1/a.txt", "u/d2/b.txt"
    removed, not_removed = _remove(_Store(answer=answer), [p1, p2])
    assert removed == []
    assert not_removed == [p1, p2]


def test_a_full_confirmation_reports_every_path_removed():
    p1, p2 = "u/d1/a.txt", "u/d2/b.txt"
    removed, not_removed = _remove(_Store(answer=lambda ps: [{"name": p} for p in ps]), [p1, p2])
    assert removed == [p1, p2]
    assert not_removed == []


def test_a_raising_remove_still_reports_every_path_not_removed():
    p1, p2 = "u/d1/a.txt", "u/d2/b.txt"
    removed, not_removed = _remove(_Store(raises=True), [p1, p2])
    assert removed == []
    assert not_removed == [p1, p2]


def test_remove_document_bytes_still_has_exactly_one_try():
    tree = ast.parse(PURGE_PATH.read_text(encoding="utf-8"))
    fn = next(n for n in ast.walk(tree)
              if isinstance(n, ast.AsyncFunctionDef) and n.name == "remove_document_bytes")
    assert len([n for n in ast.walk(fn) if isinstance(n, ast.Try)]) == 1
