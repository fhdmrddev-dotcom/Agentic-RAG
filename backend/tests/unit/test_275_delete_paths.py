"""Phase 275 plan 02 Task 1 (RET-02 / D-14 / D-15 / D-32 / D-38) — THE FIVE APP DELETE DOORS.

⛔ THE GAP. Migration 204 makes the database refuse a held delete (PT409). But every app delete
door removed the file BYTES first and the row second, so a refused row still cost its file; and the
two watch-purge doors swallowed every database error and reported success anyway.

⭐ THE CONTRACT, asserted case by case:
  * every door calls ``hold_guard.assert_none_held`` ONCE, before anything is removed;
  * order: check hold → delete rows → remove bytes (a refusal, or a PT409 race, never costs a byte);
  * a database refusal is the same 409 (``map_hold_refusal``), and any other error PROPAGATES —
    never logged-and-continued, never counted as purged;
  * a folder delete is refused WHOLE when anything in its subtree is held — documents AND folders
    (revision B-1: a held EMPTY subfolder is invisible to any document id list);
  * a successful folder delete writes ONE ``folder.delete`` audit row carrying the folder's org;
  * ``delete_document`` gained no ``if`` (D-32: guard calls + reorder only).

Every case is STUBBED — no Postgres connection and no Storage call reaches a real service.
"""
from __future__ import annotations

import ast
import asyncio
import logging
import subprocess
from pathlib import Path
from types import SimpleNamespace
from uuid import UUID

import pytest
from fastapi import HTTPException
from postgrest.exceptions import APIError

from app.services.retention import hold_guard

USER = "33333333-3333-4333-8333-333333333333"
ORG = "44444444-4444-4444-8444-444444444444"
DOC = "11111111-1111-4111-8111-111111111111"
SIB = "22222222-2222-4222-8222-222222222222"
FOLDER = "55555555-5555-4555-8555-555555555555"
CHILD = "66666666-6666-4666-8666-666666666666"
GRANDCHILD = "77777777-7777-4777-8777-777777777777"
WATCH = "88888888-8888-4888-8888-888888888888"

BACKEND = Path(__file__).resolve().parents[2]
REPO_ROOT = BACKEND.parent
DOCUMENTS_PATH = BACKEND / "app" / "api" / "documents.py"
FOLDERS_PATH = BACKEND / "app" / "api" / "folders.py"
SOURCES_PATH = BACKEND / "app" / "api" / "sources.py"
PHASE_BASE = "b41d51d6b2de26f70d97bd1b8f8c39a889b9b8c4"

CURRENT_USER = {"id": USER, "email": "member@example.com"}


# ── the recording fakes ──────────────────────────────────────────────────────────────────

class _Resp:
    def __init__(self, data):
        self.data = data


class _Query:
    """A recording supabase-py builder: chained calls are kept, ``.execute()`` logs and answers."""

    def __init__(self, sb: "_FakeSupabase", table: str):
        self.sb = sb
        self.table = table
        self.calls: list[tuple] = []

    def __getattr__(self, name):
        def _chain(*args, **kwargs):
            self.calls.append((name, args))
            return self

        return _chain

    @property
    def verb(self) -> str:
        for name, _ in self.calls:
            if name in ("select", "delete", "update", "insert", "upsert"):
                return name
        return "?"

    def execute(self):
        self.sb.log.append((self.table, self.verb, list(self.calls)))
        exc = self.sb.raises.get((self.table, self.verb))
        if exc is not None:
            raise exc
        return _Resp(self.sb.answer(self.table, self.verb, self.calls))


class _FakeSupabase:
    def __init__(self, log: list, answers=None, raises=None):
        self.log = log
        self.answers = answers or {}
        self.raises = raises or {}
        self.remove_raises = False
        sb = self

        class _Bucket:
            def remove(self, paths):
                sb.log.append(("storage", "remove", list(paths)))
                if sb.remove_raises:
                    raise RuntimeError("storage unavailable")
                return [{"name": p} for p in paths]

        class _Storage:
            def from_(self, bucket):
                return _Bucket()

        self.storage = _Storage()

    def table(self, name):
        return _Query(self, name)

    def rpc(self, name, params):
        """275-REVIEW B-WR-03: the folder door's one transactional call (``delete_folder_tree``)."""
        sb = self

        class _Call:
            def execute(self_inner):
                sb.log.append(("rpc", name, dict(params)))
                exc = sb.raises.get(("rpc", name))
                if exc is not None:
                    raise exc
                return _Resp(sb.answers.get(("rpc", name), []))

        return _Call()

    def answer(self, table, verb, calls):
        single = any(c[0] in ("maybe_single", "single") for c in calls)
        key = (table, verb, "single") if single else (table, verb)
        value = self.answers.get(key)
        if callable(value):
            return value(calls)
        if value is None:
            return None if single else []
        return value


class _BackgroundTasks:
    def __init__(self, log):
        self.log = log

    def add_task(self, fn, *args, **kwargs):
        self.log.append(("audit", kwargs.get("action_type"), kwargs))


def _guard(log, *, refuse: HTTPException | None = None):
    """A stand-in for ``assert_none_held`` that records its arguments in the shared log."""

    async def _assert_none_held(request, current_user, document_ids, *, kind, folder_ids=None,
                                service_supabase=None):
        log.append(("guard", kind, {"document_ids": list(document_ids),
                                    "folder_ids": list(folder_ids) if folder_ids is not None else None}))
        if refuse is not None:
            raise refuse

    return _assert_none_held


def _refusal(kind: str, held_count: int | None, *, can_manage: bool = False) -> HTTPException:
    return hold_guard.refusal_for(kind, held_count=held_count, can_manage=can_manage).to_http()


def _pt409() -> APIError:
    return APIError({"code": "PT409", "message": "document 1111 is on legal hold", "hint": None,
                     "details": None})


def _kinds(log):
    """The log reduced to its order-relevant events."""
    out = []
    for entry in log:
        if entry[0] == "guard":
            out.append("guard")
        elif entry[0] == "storage":
            out.append("storage.remove")
        elif entry[0] == "audit":
            out.append(f"audit:{entry[1]}")
        elif entry[0] == "rpc":
            out.append(f"rpc:{entry[1]}")
        elif entry[1] in ("delete", "update"):
            out.append(f"{entry[0]}.{entry[1]}")
    return out


def _deletes(log):
    return [e for e in log if len(e) == 3 and e[1] == "delete" and e[0] != "storage"]


def _removes(log):
    return [e for e in log if e[0] == "storage"]


def _run(coro):
    return asyncio.run(coro)


# ── documents: scope=version / scope=all ─────────────────────────────────────────────────

def _doc_supabase(log, *, siblings=None, raises=None, is_latest=True):
    target = {"id": DOC, "filename": "contract.pdf", "folder_id": FOLDER, "file_path": f"{USER}/doc.pdf",
              "is_latest": is_latest}
    sibs = siblings if siblings is not None else [
        {"id": DOC, "file_path": f"{USER}/doc.pdf", "version_number": 2},
        {"id": SIB, "file_path": f"{USER}/sib.pdf", "version_number": 1},
    ]
    return _FakeSupabase(
        log,
        answers={("documents", "select", "single"): target, ("documents", "select"): sibs},
        raises=raises,
    )


async def _delete_document(sb, log, scope):
    from app.api import documents

    return await documents.delete_document(
        document_id=DOC,
        request=SimpleNamespace(state=SimpleNamespace()),
        background_tasks=_BackgroundTasks(log),
        scope=scope,
        current_user=CURRENT_USER,
        supabase=sb,
        service_supabase=object(),
    )


def test_version_scope_held_refuses_before_anything_is_removed(monkeypatch):
    log: list = []
    monkeypatch.setattr(hold_guard, "assert_none_held", _guard(log, refuse=_refusal("document", 1)))
    sb = _doc_supabase(log)
    with pytest.raises(HTTPException) as exc:
        _run(_delete_document(sb, log, "version"))
    assert exc.value.status_code == 409
    assert exc.value.detail["code"] == "legal_hold"
    assert exc.value.detail["message"] == hold_guard.DOCUMENT_MEMBER
    assert _deletes(log) == [] and _removes(log) == []
    assert not [e for e in log if e[0] == "audit"]
    guard = [e for e in log if e[0] == "guard"]
    assert guard == [("guard", "document", {"document_ids": [DOC], "folder_ids": None})]


def test_version_scope_unheld_runs_guard_rows_bytes_promote_audit_in_that_order(monkeypatch):
    log: list = []
    monkeypatch.setattr(hold_guard, "assert_none_held", _guard(log))
    sb = _doc_supabase(log, siblings=[{"id": SIB, "version_number": 1}])
    _run(_delete_document(sb, log, "version"))
    assert _kinds(log) == [
        "guard", "documents.delete", "storage.remove", "documents.update", "audit:document.delete",
    ]


def test_all_scope_held_sibling_refuses_with_every_sibling_id_and_removes_nothing(monkeypatch):
    log: list = []
    monkeypatch.setattr(hold_guard, "assert_none_held", _guard(log, refuse=_refusal("document", 1)))
    sb = _doc_supabase(log)
    with pytest.raises(HTTPException) as exc:
        _run(_delete_document(sb, log, "all"))
    assert exc.value.status_code == 409
    assert _deletes(log) == [] and _removes(log) == []
    guard = [e for e in log if e[0] == "guard"]
    assert len(guard) == 1
    assert sorted(guard[0][2]["document_ids"]) == sorted([DOC, SIB])


def test_all_scope_unheld_deletes_rows_before_bytes(monkeypatch):
    log: list = []
    monkeypatch.setattr(hold_guard, "assert_none_held", _guard(log))
    sb = _doc_supabase(log)
    _run(_delete_document(sb, log, "all"))
    assert _kinds(log) == [
        "guard", "documents.delete", "storage.remove", "storage.remove", "audit:document.delete",
    ]


@pytest.mark.parametrize("scope", ["version", "all"])
def test_a_pt409_race_on_the_row_delete_is_the_member_409_and_no_byte_is_removed(monkeypatch, scope):
    log: list = []
    monkeypatch.setattr(hold_guard, "assert_none_held", _guard(log))  # the pre-check passes
    sb = _doc_supabase(log, raises={("documents", "delete"): _pt409()})
    with pytest.raises(HTTPException) as exc:
        _run(_delete_document(sb, log, scope))
    assert exc.value.status_code == 409
    assert exc.value.detail["message"] == hold_guard.DOCUMENT_MEMBER
    assert "“" not in exc.value.detail["message"]  # D-17: no matter name to a member
    assert _removes(log) == []
    assert not [e for e in log if e[0] == "audit"]


def test_a_non_hold_database_error_on_the_row_delete_propagates_unchanged(monkeypatch):
    log: list = []
    monkeypatch.setattr(hold_guard, "assert_none_held", _guard(log))
    boom = APIError({"code": "42501", "message": "permission denied", "hint": None, "details": None})
    sb = _doc_supabase(log, raises={("documents", "delete"): boom})
    with pytest.raises(APIError):
        _run(_delete_document(sb, log, "version"))
    assert _removes(log) == []


def test_a_storage_failure_after_the_row_delete_is_logged_and_the_delete_still_succeeds(monkeypatch, caplog):
    log: list = []
    monkeypatch.setattr(hold_guard, "assert_none_held", _guard(log))
    sb = _doc_supabase(log, siblings=[])
    sb.remove_raises = True
    with caplog.at_level(logging.WARNING):
        assert _run(_delete_document(sb, log, "version")) is None
    assert _kinds(log)[:3] == ["guard", "documents.delete", "storage.remove"]
    assert any("storage" in r.getMessage().lower() for r in caplog.records if r.levelno >= logging.WARNING)


# ── folders ──────────────────────────────────────────────────────────────────────────────

def _folder_supabase(log, *, docs, raises=None):
    tree = {FOLDER: [{"id": CHILD}], CHILD: [{"id": GRANDCHILD}], GRANDCHILD: []}

    def _children(calls):
        parent = next(c[1][1] for c in calls if c[0] == "eq" and c[1][0] == "parent_id")
        return tree.get(parent, [])

    return _FakeSupabase(
        log,
        answers={
            ("folders", "select"): _children,
            ("folders", "select", "single"): {"id": FOLDER, "name": "Contracts", "org_id": ORG},
            ("documents", "select"): docs,
            ("folders", "delete"): [{"id": FOLDER}],
            ("documents", "delete"): docs,
            ("rpc", "delete_folder_tree"): [{"document_id": d["id"], "file_path": d["file_path"]} for d in docs],
        },
        raises=raises,
    )


async def _delete_folder(sb):
    from app.api import folders

    return await folders.delete_folder(
        folder_id=FOLDER,
        request=SimpleNamespace(state=SimpleNamespace()),
        current_user=CURRENT_USER,
        supabase=sb,
        service_supabase=object(),
    )


def _audit_recorder(log):
    async def _write_audit_entry(**kwargs):
        log.append(("audit", kwargs.get("action_type"), kwargs))

    return _write_audit_entry


def test_folder_with_a_held_document_two_levels_down_is_refused_whole(monkeypatch):
    from app.api import folders

    log: list = []
    monkeypatch.setattr(folders, "write_audit_entry", _audit_recorder(log))
    monkeypatch.setattr(hold_guard, "assert_none_held", _guard(log, refuse=_refusal("folder", 1)))
    docs = [{"id": DOC, "file_path": f"{USER}/a.pdf"}, {"id": SIB, "file_path": f"{USER}/b.pdf"}]
    sb = _folder_supabase(log, docs=docs)
    with pytest.raises(HTTPException) as exc:
        _run(_delete_folder(sb))
    assert exc.value.status_code == 409
    assert exc.value.detail["message"].startswith(
        "This folder has 1 document on legal hold. Nothing was deleted."
    )
    assert _deletes(log) == [] and _removes(log) == []
    assert not [e for e in log if e[0] == "audit"]


def test_a_held_empty_subfolder_refuses_the_parent_with_zero_deletes_b1(monkeypatch):
    """Revision B-1: the parent's two documents are unheld; the EMPTY grandchild is held. No id the
    caller's own document read returns can reveal that — only ``folder_ids`` can."""
    from app.api import folders

    log: list = []
    monkeypatch.setattr(folders, "write_audit_entry", _audit_recorder(log))
    monkeypatch.setattr(hold_guard, "assert_none_held", _guard(log, refuse=_refusal("folder", 0)))
    docs = [{"id": DOC, "file_path": f"{USER}/a.pdf"}, {"id": SIB, "file_path": f"{USER}/b.pdf"}]
    sb = _folder_supabase(log, docs=docs)
    with pytest.raises(HTTPException) as exc:
        _run(_delete_folder(sb))
    assert exc.value.status_code == 409
    assert exc.value.detail["message"] == hold_guard.FOLDER_HELD + hold_guard.MEMBER_SUFFIX
    assert _deletes(log) == [] and _removes(log) == []
    guard = [e for e in log if e[0] == "guard"]
    assert len(guard) == 1
    assert guard[0][1] == "folder"
    assert guard[0][2]["folder_ids"] == [FOLDER, CHILD, GRANDCHILD]
    assert sorted(guard[0][2]["document_ids"]) == sorted([DOC, SIB])


def test_folder_unheld_runs_guard_rows_bytes_then_one_audit_row_with_the_folders_org(monkeypatch):
    from app.api import folders

    log: list = []
    monkeypatch.setattr(folders, "write_audit_entry", _audit_recorder(log))
    monkeypatch.setattr(hold_guard, "assert_none_held", _guard(log))
    docs = [{"id": DOC, "file_path": f"{USER}/a.pdf"}, {"id": SIB, "file_path": f"{USER}/b.pdf"}]
    sb = _folder_supabase(log, docs=docs)
    _run(_delete_folder(sb))
    # 275-REVIEW B-WR-03: rows and folder in ONE transactional call, then bytes, then the audit row
    assert _kinds(log) == [
        "guard", "rpc:delete_folder_tree", "storage.remove", "storage.remove", "audit:folder.delete",
    ]
    audits = [e for e in log if e[0] == "audit"]
    assert len(audits) == 1
    kwargs = audits[0][2]
    assert kwargs["org_id"] == ORG
    assert kwargs["user_id"] == USER
    assert kwargs["metadata"] == {"folder_id": FOLDER, "name": "Contracts", "documents_deleted": 2}


def test_a_pt409_race_on_the_folder_document_delete_removes_no_byte(monkeypatch):
    from app.api import folders

    log: list = []
    monkeypatch.setattr(folders, "write_audit_entry", _audit_recorder(log))
    monkeypatch.setattr(hold_guard, "assert_none_held", _guard(log))
    docs = [{"id": DOC, "file_path": f"{USER}/a.pdf"}]
    sb = _folder_supabase(log, docs=docs, raises={("rpc", "delete_folder_tree"): _pt409()})
    with pytest.raises(HTTPException) as exc:
        _run(_delete_folder(sb))
    assert exc.value.status_code == 409
    assert exc.value.detail["message"].endswith("Nothing was deleted." + hold_guard.MEMBER_SUFFIX)
    assert _removes(log) == []
    assert not [e for e in log if e[0] == "folders" and e[1] == "delete"]
    assert not [e for e in log if e[0] == "audit"]


# ── sources: watch delete with purge, purge-missing ──────────────────────────────────────

class _Con:
    def __init__(self, log, items):
        self.log = log
        self.items = items

    async def fetch(self, sql, *args):
        return self.items

    async def execute(self, sql, *args):
        self.log.append(("pool", "execute", sql))
        return "DELETE 1"


class _Acquire:
    def __init__(self, con):
        self.con = con

    async def __aenter__(self):
        return self.con

    async def __aexit__(self, *a):
        return False


class _Pool:
    def __init__(self, log, items):
        self.con = _Con(log, items)

    def acquire(self):
        return _Acquire(self.con)


def _patch_watch(monkeypatch, log, *, items=None):
    from app.api import sources

    async def _get_watch(pool, watch_id, user_id=None):
        return {"id": UUID(WATCH), "user_id": UUID(USER)}

    async def _get_watch_items(pool, watch_id):
        return items if items is not None else [{"document_id": DOC}, {"document_id": SIB}]

    async def _delete_watch(pool, watch_id, user_id=None):
        log.append(("watch", "delete", str(watch_id)))
        return True

    monkeypatch.setattr(sources, "get_watch", _get_watch)
    monkeypatch.setattr(sources, "get_watch_items", _get_watch_items)
    monkeypatch.setattr(sources, "delete_watch", _delete_watch)


async def _delete_watch_purge(sb, pool):
    from app.api import sources

    return await sources.delete_folder_watch(
        watch_id=UUID(WATCH),
        request=SimpleNamespace(state=SimpleNamespace()),
        purge_documents=True,
        current_user=CURRENT_USER,
        supabase=sb,
        service_supabase=object(),
        pool=pool,
    )


async def _purge_missing(sb, pool):
    from app.api import sources

    return await sources.purge_missing_watch_documents(
        watch_id=UUID(WATCH),
        request=SimpleNamespace(state=SimpleNamespace()),
        current_user=CURRENT_USER,
        supabase=sb,
        service_supabase=object(),
        pool=pool,
    )


def test_watch_delete_with_purge_on_a_held_document_deletes_neither_documents_nor_watch(monkeypatch):
    log: list = []
    _patch_watch(monkeypatch, log)
    monkeypatch.setattr(hold_guard, "assert_none_held", _guard(log, refuse=_refusal("watch_delete", 1)))
    sb = _FakeSupabase(log)
    with pytest.raises(HTTPException) as exc:
        _run(_delete_watch_purge(sb, _Pool(log, [])))
    assert exc.value.status_code == 409
    assert "Nothing was deleted." in exc.value.detail["message"]
    assert _deletes(log) == []
    guard = [e for e in log if e[0] == "guard"]
    assert guard[0][1] == "watch_delete"
    assert sorted(guard[0][2]["document_ids"]) == sorted([DOC, SIB])


def test_watch_delete_with_purge_pt409_race_keeps_the_watch(monkeypatch):
    log: list = []
    _patch_watch(monkeypatch, log)
    monkeypatch.setattr(hold_guard, "assert_none_held", _guard(log))
    sb = _FakeSupabase(log, raises={("documents", "delete"): _pt409()})
    with pytest.raises(HTTPException) as exc:
        _run(_delete_watch_purge(sb, _Pool(log, [])))
    assert exc.value.status_code == 409
    assert not [e for e in log if e[0] == "watch"]


def test_watch_delete_with_purge_non_hold_error_propagates_and_keeps_the_watch(monkeypatch):
    log: list = []
    _patch_watch(monkeypatch, log)
    monkeypatch.setattr(hold_guard, "assert_none_held", _guard(log))
    sb = _FakeSupabase(log, raises={("documents", "delete"): RuntimeError("db down")})
    with pytest.raises(RuntimeError):
        _run(_delete_watch_purge(sb, _Pool(log, [])))
    assert not [e for e in log if e[0] == "watch"]


def test_watch_delete_with_purge_unheld_deletes_documents_then_the_watch(monkeypatch):
    log: list = []
    _patch_watch(monkeypatch, log)
    monkeypatch.setattr(hold_guard, "assert_none_held", _guard(log))
    sb = _FakeSupabase(log)
    _run(_delete_watch_purge(sb, _Pool(log, [])))
    order = [e[0] if e[0] in ("guard", "watch") else f"{e[0]}.{e[1]}" for e in log]
    assert order == ["guard", "documents.delete", "watch"]


def _missing_items():
    return [{"id": UUID(DOC), "document_id": DOC}, {"id": UUID(SIB), "document_id": SIB}]


def test_purge_missing_with_a_held_document_purges_nothing(monkeypatch):
    log: list = []
    _patch_watch(monkeypatch, log)
    monkeypatch.setattr(hold_guard, "assert_none_held", _guard(log, refuse=_refusal("watch_purge", 1)))
    sb = _FakeSupabase(log)
    with pytest.raises(HTTPException) as exc:
        _run(_purge_missing(sb, _Pool(log, _missing_items())))
    assert exc.value.status_code == 409
    assert exc.value.detail["message"].startswith("1 of this watch's missing files are on legal hold.")
    assert "Nothing was purged." in exc.value.detail["message"]
    assert _deletes(log) == []
    assert not [e for e in log if e[0] == "pool"]  # watch items NOT deleted
    assert [e[1] for e in log if e[0] == "guard"] == ["watch_purge"]


def test_purge_missing_non_hold_error_propagates_and_items_are_not_deleted(monkeypatch):
    log: list = []
    _patch_watch(monkeypatch, log)
    monkeypatch.setattr(hold_guard, "assert_none_held", _guard(log))
    sb = _FakeSupabase(log, raises={("documents", "delete"): RuntimeError("db down")})
    with pytest.raises(RuntimeError):
        _run(_purge_missing(sb, _Pool(log, _missing_items())))
    assert not [e for e in log if e[0] == "pool"]


def test_purge_missing_pt409_race_is_the_409_and_items_are_not_deleted(monkeypatch):
    log: list = []
    _patch_watch(monkeypatch, log)
    monkeypatch.setattr(hold_guard, "assert_none_held", _guard(log))
    sb = _FakeSupabase(log, raises={("documents", "delete"): _pt409()})
    with pytest.raises(HTTPException) as exc:
        _run(_purge_missing(sb, _Pool(log, _missing_items())))
    assert exc.value.status_code == 409
    assert "Nothing was purged." in exc.value.detail["message"]
    assert not [e for e in log if e[0] == "pool"]


def test_purge_missing_unheld_counts_only_after_the_delete_succeeded(monkeypatch):
    log: list = []
    _patch_watch(monkeypatch, log)
    monkeypatch.setattr(hold_guard, "assert_none_held", _guard(log))
    sb = _FakeSupabase(log)
    resp = _run(_purge_missing(sb, _Pool(log, _missing_items())))
    assert resp.purged_count == 2
    order = [e[0] if e[0] in ("guard", "pool") else f"{e[0]}.{e[1]}" for e in log]
    assert order == ["guard", "documents.delete", "pool"]


# ── source fences ────────────────────────────────────────────────────────────────────────

def _function_node(source: str, name: str) -> ast.AST:
    tree = ast.parse(source)
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == name:
            return node
    raise AssertionError(f"{name} not found — the fence would pass vacuously")


def _if_count(source: str, name: str) -> int:
    return sum(isinstance(n, ast.If) for n in ast.walk(_function_node(source, name)))


def test_delete_document_gained_no_if_branch_d32():
    try:
        base = subprocess.run(
            ["git", "show", f"{PHASE_BASE}:backend/app/api/documents.py"],
            cwd=REPO_ROOT, capture_output=True, text=True, encoding="utf-8", check=True,
        ).stdout
    except (OSError, subprocess.CalledProcessError) as exc:  # pragma: no cover - environment
        pytest.skip(f"git unavailable to read PHASE_BASE ({exc}); the D-32 fence needs the base source")
    now = DOCUMENTS_PATH.read_text(encoding="utf-8")
    base_ifs = _if_count(base, "delete_document")
    assert base_ifs > 0, "vacuous: the base delete_document had no if at all"
    assert _if_count(now, "delete_document") == base_ifs


def test_every_storage_remove_in_delete_document_follows_its_row_delete():
    node = _function_node(DOCUMENTS_PATH.read_text(encoding="utf-8"), "delete_document")
    removes, deletes = [], []
    body_nodes = [n for stmt in node.body for n in ast.walk(stmt)]  # never the @router.delete decorator
    for n in body_nodes:
        if isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute):
            if n.func.attr == "remove":
                removes.append(n.lineno)
            elif n.func.attr == "delete":
                deletes.append(n.lineno)
    assert len(removes) == 2 and len(deletes) == 2, (removes, deletes)
    # scope=all and scope=version each: its delete, then its remove
    for d, r in zip(sorted(deletes), sorted(removes)):
        assert r > d


def test_folder_guard_names_the_subtree_before_any_delete_or_remove():
    src = FOLDERS_PATH.read_text(encoding="utf-8")
    node = _function_node(src, "delete_folder")
    lines = src.splitlines()
    body = range(node.lineno, node.end_lineno + 1)
    guard_line = next(i for i in body if "folder_ids=" in lines[i - 1])
    action_lines = [
        i for i in body
        if ".delete()" in lines[i - 1] or ".remove(" in lines[i - 1] or "rpc(\"delete_folder_tree\"" in lines[i - 1]
    ]
    assert action_lines, "vacuous: no delete/remove found in delete_folder"
    assert all(guard_line < a for a in action_lines)


def test_sources_no_longer_log_and_continue_around_a_document_delete():
    src = SOURCES_PATH.read_text(encoding="utf-8")
    for name in ("delete_folder_watch", "purge_missing_watch_documents"):
        node = _function_node(src, name)
        handlers = [n for n in ast.walk(node) if isinstance(n, ast.ExceptHandler)]
        assert handlers == [], f"{name} still catches around the purge"
