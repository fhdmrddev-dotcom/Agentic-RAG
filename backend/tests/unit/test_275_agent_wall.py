"""Phase 275 plan 02 Task 2 (RET-04 / D-18 / D-36; revision B-2) — THE AGENT DOCUMENT-READ WALL.

⛔ THE GAP. Migration 205 takes an archived or source-gone document out of both search arms and out of
model-written SQL. But the agent has other doors: it can name a document id (``read_document``,
``fetch_document_file``, ``attach_skill_file``), a filename (``analyze_document``, ``query_tables``),
or LIST documents (``ls`` / ``tree`` / ``glob`` / ``query_documents_by_view`` /
``get_related_documents``). Each of those read ``documents`` directly and saw every row.

⭐ THE CONTRACT, case by case (each "absent" assertion carries a positive control):
  * ``agent_wall.unretrievable`` is ONE batched read; an unknown id is never refused (the normal
    not-found path speaks);
  * the id doors refuse with a readable ``not_retrievable`` error and never read content or bytes;
  * the filename doors resolve only retrievable documents (``.eq(RETRIEVABLE_COLUMN, True)``);
  * the listing tools omit them at the query, and a view's reported total counts the FILTERED set;
  * the Library keeps opening them: the shared cores default to unfiltered, only the agent handlers
    pass ``retrievable_only=True``, and ``read_path`` (shared with Library GET content) is untouched.

Every case is STUBBED — no Postgres connection reaches a real service.
"""
from __future__ import annotations

import ast
import asyncio
import json
import re
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.services.retrieval_scope import RETRIEVABLE_COLUMN

USER = "33333333-3333-4333-8333-333333333333"
LIVE = "11111111-1111-4111-8111-111111111111"
GONE = "22222222-2222-4222-8222-222222222222"
UNKNOWN = "99999999-9999-4999-8999-999999999999"
SUBJECT = "55555555-5555-4555-8555-555555555555"
FOLDER = "66666666-6666-4666-8666-666666666666"

BACKEND = Path(__file__).resolve().parents[2]
APP = BACKEND / "app"


def _run(coro):
    return asyncio.run(coro)


# ── a simulating supabase-py fake: chained filters are APPLIED to in-memory rows ──────────────

class _Resp:
    def __init__(self, data):
        self.data = data


class _SimQuery:
    def __init__(self, sb: "_SimSupabase", table: str):
        self.sb = sb
        self.table = table
        self.calls: list[tuple] = []

    def __getattr__(self, name):
        def _chain(*args, **kwargs):
            self.calls.append((name, args))
            return self

        return _chain

    def _match(self, row: dict) -> bool:
        for name, args in self.calls:
            if name == "eq" and args[0] in row and row[args[0]] != args[1]:
                return False
            if name == "in_" and args[0] in row and row[args[0]] not in list(args[1]):
                return False
            if name == "is_" and args[1] == "null" and row.get(args[0]) is not None:
                return False
        return True

    def execute(self):
        self.sb.log.append((self.table, list(self.calls)))
        rows = [dict(r) for r in self.sb.rows.get(self.table, []) if self._match(r)]
        if any(c[0] in ("maybe_single", "single") for c in self.calls):
            return _Resp(rows[0] if rows else None)
        return _Resp(rows)


class _SimSupabase:
    def __init__(self, rows: dict | None = None):
        self.rows = rows or {}
        self.log: list = []
        self.downloads: list = []
        sb = self

        class _Bucket:
            def download(self, path):
                sb.downloads.append(path)
                return b"bytes"

        class _Storage:
            def from_(self, bucket):
                return _Bucket()

        self.storage = _Storage()

    def table(self, name):
        return _SimQuery(self, name)


def _doc(doc_id, *, retrievable, filename=None, folder_id=None, **extra):
    return {
        "id": doc_id,
        "user_id": USER,
        "filename": filename or f"{doc_id[:4]}.pdf",
        "folder_id": folder_id,
        "is_latest": True,
        "status": "completed",
        "created_at": "2026-10-01T00:00:00Z" if doc_id == LIVE else "2026-10-02T00:00:00Z",
        "file_path": f"{USER}/{doc_id}.pdf",
        "file_size": 10,
        "mime_type": "application/pdf",
        "full_markdown": "body",
        RETRIEVABLE_COLUMN: retrievable,
        **extra,
    }


def _ctx(sb, **kw):
    return SimpleNamespace(
        supabase=sb,
        current_user={"id": USER},
        folder_subtree_ids=None,
        scoped_folder_path=None,
        spawn=None,
        **kw,
    )


# ── agent_wall ───────────────────────────────────────────────────────────────────────────────

def test_unretrievable_is_one_batched_read_and_unknown_ids_are_not_refused():
    from app.services.retention import agent_wall

    sb = _SimSupabase({"documents": [_doc(LIVE, retrievable=True), _doc(GONE, retrievable=False)]})
    out = _run(agent_wall.unretrievable(sb, [LIVE, GONE, UNKNOWN]))
    assert out == {GONE}
    assert len(sb.log) == 1
    table, calls = sb.log[0]
    assert table == "documents"
    assert ("select", (f"id, {RETRIEVABLE_COLUMN}",)) in calls
    in_calls = [c for c in calls if c[0] == "in_"]
    assert in_calls and in_calls[0][1][0] == "id" and sorted(in_calls[0][1][1]) == sorted([LIVE, GONE, UNKNOWN])


def test_unretrievable_issues_no_read_for_no_ids_and_skips_a_non_uuid():
    from app.services.retention import agent_wall

    sb = _SimSupabase({"documents": []})
    assert _run(agent_wall.unretrievable(sb, [])) == set()
    assert _run(agent_wall.unretrievable(sb, ["not-a-uuid", "report.pdf"])) == set()
    assert sb.log == []


def test_the_refusal_is_readable_and_typed():
    from app.services.retention import agent_wall

    out = agent_wall.not_retrievable_result(GONE)
    assert out["error_kind"] == "not_retrievable"
    assert out["error"] == (
        f"Document {GONE} is archived or no longer available at its source, so it can't be read here."
    )


# ── the id doors ─────────────────────────────────────────────────────────────────────────────

def test_read_document_refuses_a_non_retrievable_id_and_never_reads_it(monkeypatch):
    from app.services import tool_dispatcher as td

    reads: list = []

    async def _read_path(*a, **k):
        reads.append(a)
        return {"content": "secret"}

    monkeypatch.setattr(td, "read_path", _read_path)
    sb = _SimSupabase({"documents": [_doc(LIVE, retrievable=True), _doc(GONE, retrievable=False)]})
    res = _run(td._handle_read_document({"document_id": GONE}, _ctx(sb)))
    body = json.loads(res.result)
    assert body["error_kind"] == "not_retrievable"
    assert "archived or no longer available at its source" in body["error"]
    assert reads == []

    # positive control: a retrievable document is read
    res = _run(td._handle_read_document({"document_id": LIVE}, _ctx(sb)))
    assert json.loads(res.result) == {"content": "secret"}
    assert len(reads) == 1


def test_the_byte_path_behind_fetch_document_file_and_attach_skill_file_refuses(monkeypatch):
    from app.services import tool_dispatcher as td

    sb = _SimSupabase({"documents": [_doc(LIVE, retrievable=True), _doc(GONE, retrievable=False)]})
    out = _run(td._fetch_owned_document_bytes(_ctx(sb), GONE))
    assert isinstance(out, dict) and out["error_kind"] == "not_retrievable"
    assert sb.downloads == []

    # positive control: the retrievable document's bytes are fetched
    out = _run(td._fetch_owned_document_bytes(_ctx(sb), LIVE))
    assert isinstance(out, tuple) and out[1] == b"bytes"
    assert len(sb.downloads) == 1


def test_both_byte_tools_reach_the_walled_resolver():
    src = (APP / "services" / "tool_dispatcher.py").read_text(encoding="utf-8")
    tree = ast.parse(src)
    callers = set()
    for fn in ast.walk(tree):
        if isinstance(fn, (ast.FunctionDef, ast.AsyncFunctionDef)):
            for n in ast.walk(fn):
                if isinstance(n, ast.Call) and getattr(n.func, "id", None) == "_fetch_owned_document_bytes":
                    callers.add(fn.name)
    assert "_handle_fetch_document_file" in callers
    assert len(callers) >= 2, callers  # fetch_document_file + the attach_skill_file source resolver


def test_analyze_document_refuses_a_non_retrievable_resolved_id(monkeypatch):
    from app.services import tool_dispatcher as td

    fetched: list = []

    async def _resolve(filename, user_id, supabase):
        return GONE

    async def _fetch_full(doc_id, user_id, supabase):
        fetched.append(doc_id)
        return {"filename": "x", "content": "secret"}

    monkeypatch.setattr(td, "resolve_document_id", _resolve)
    monkeypatch.setattr(td, "fetch_full_document", _fetch_full)
    sb = _SimSupabase({"documents": [_doc(GONE, retrievable=False)]})
    res = _run(td._handle_analyze_document({"filename": "x.pdf", "task": "t"}, _ctx(sb)))
    assert json.loads(res.result)["error_kind"] == "not_retrievable"
    assert fetched == []


# ── the filename doors (agent-only readers) ──────────────────────────────────────────────────

@pytest.mark.parametrize("fn_name", ["resolve_document_id", "resolve_document"])
def test_filename_resolution_skips_a_non_retrievable_document(fn_name):
    from app.services import retrieval_documents as rd

    sb = _SimSupabase({"documents": [_doc(GONE, retrievable=False, filename="Report.pdf")]})
    assert _run(getattr(rd, fn_name)("Report.pdf", USER, sb)) is None
    assert all(("eq", (RETRIEVABLE_COLUMN, True)) in calls for _, calls in sb.log)

    # positive control: the same file, retrievable, resolves
    sb = _SimSupabase({"documents": [_doc(LIVE, retrievable=True, filename="Report.pdf")]})
    out = _run(getattr(rd, fn_name)("Report.pdf", USER, sb))
    assert (out if isinstance(out, str) else out["id"]) == LIVE


def test_fetch_full_document_reads_only_a_retrievable_document():
    from app.services import retrieval_documents as rd

    sb = _SimSupabase({"documents": [_doc(GONE, retrievable=False)]})
    assert _run(rd.fetch_full_document(GONE, USER, sb)) is None
    assert ("eq", (RETRIEVABLE_COLUMN, True)) in sb.log[0][1]

    sb = _SimSupabase({"documents": [_doc(LIVE, retrievable=True)]})
    assert _run(rd.fetch_full_document(LIVE, USER, sb))["content"] == "body"


def test_query_tables_cannot_name_a_non_retrievable_document():
    from app.services import multimodal_service as ms

    sb = _SimSupabase({"documents": [_doc(GONE, retrievable=False, filename="Budget.xlsx")],
                       "document_tables": [{"document_id": GONE, "table_index": 0,
                                            "headers": ["a"], "rows": [["1"]]}]})
    out = json.loads(_run(ms.handle_query_tables({"document_name": "Budget.xlsx"}, USER, sb)))
    assert "error" in out and "not found" in out["error"]
    assert not [t for t, _ in sb.log if t == "document_tables"]  # no table content was read


# ── the listing tools (kb.py reads) ──────────────────────────────────────────────────────────

def _patch_kb_folders(monkeypatch, folders):
    from app.api import kb

    async def _visible(supabase, user_id):
        return [dict(f) for f in folders]

    async def _global(supabase, user_id):
        return []

    monkeypatch.setattr(kb, "_fetch_visible_folders", _visible)
    monkeypatch.setattr(kb, "get_globally_visible_folder_ids", _global)


def _two_docs(folder_id=None):
    return {"documents": [
        _doc(LIVE, retrievable=True, filename="live.pdf", folder_id=folder_id),
        _doc(GONE, retrievable=False, filename="gone.pdf", folder_id=folder_id),
    ]}


def test_ls_omits_a_non_retrievable_document(monkeypatch):
    from app.services import tool_dispatcher as td

    _patch_kb_folders(monkeypatch, [])
    res = json.loads(_run(td._handle_ls({"path": "/"}, _ctx(_SimSupabase(_two_docs())))).result)
    assert [d["id"] for d in res["documents"]] == [LIVE]


def test_ls_in_a_folder_omits_a_non_retrievable_document(monkeypatch):
    from app.services import tool_dispatcher as td

    folder = {"id": FOLDER, "name": "Reports", "parent_id": None, "is_org_shared": False, "user_id": USER}
    _patch_kb_folders(monkeypatch, [folder])
    sb = _SimSupabase(_two_docs(FOLDER))
    res = json.loads(_run(td._handle_ls({"path": "/Reports"}, _ctx(sb))).result)
    assert [d["id"] for d in res["documents"]] == [LIVE]


def test_tree_omits_a_non_retrievable_document(monkeypatch):
    from app.services import tool_dispatcher as td

    folder = {"id": FOLDER, "name": "Reports", "parent_id": None, "is_org_shared": False, "user_id": USER}
    _patch_kb_folders(monkeypatch, [folder])
    res = json.loads(_run(td._handle_tree({"path": "/"}, _ctx(_SimSupabase(_two_docs(FOLDER))))).result)
    names = [d["filename"] for d in res["tree"][0]["documents"]]
    assert names == ["live.pdf"]


def test_glob_omits_a_non_retrievable_document(monkeypatch):
    from app.services import tool_dispatcher as td

    _patch_kb_folders(monkeypatch, [])
    res = json.loads(_run(td._handle_glob({"pattern": "*.pdf"}, _ctx(_SimSupabase(_two_docs())))).result)
    assert [m["filename"] for m in res["matches"]] == ["live.pdf"]
    assert res["total"] == 1


def test_read_path_is_untouched_so_the_library_still_opens_an_archived_document():
    src = (APP / "api" / "kb.py").read_text(encoding="utf-8")
    fn = next(n for n in ast.walk(ast.parse(src))
              if isinstance(n, ast.AsyncFunctionDef) and n.name == "read_path")
    body = ast.get_source_segment(src, fn)
    assert body and "retrievable" not in body.lower() and "RETRIEVABLE_COLUMN" not in body


# ── views (revision B-2) ─────────────────────────────────────────────────────────────────────

def _patch_resolver(monkeypatch):
    from app.services import document_view_resolver as dvr
    from app.services import tool_dispatcher as td

    async def _compile(caller, flt, supabase):
        return []

    async def _global(supabase, user_id):
        return []

    monkeypatch.setattr(dvr, "validate_and_compile", _compile)
    monkeypatch.setattr(dvr, "get_globally_visible_folder_ids", _global)
    monkeypatch.setattr(td, "resolve_filter", dvr.resolve_filter)
    return dvr


@pytest.mark.parametrize("gone_retrievable, expected", [(False, [LIVE]), (True, [GONE, LIVE])])
def test_query_documents_by_view_inline_filters_rows_and_counts_the_filtered_set(
    monkeypatch, gone_retrievable, expected,
):
    from app.services import tool_dispatcher as td

    _patch_resolver(monkeypatch)
    sb = _SimSupabase({"documents": [_doc(LIVE, retrievable=True), _doc(GONE, retrievable=gone_retrievable)]})
    res = json.loads(_run(td._handle_query_documents_by_view(
        {"filter": {"op": "and", "conditions": []}}, _ctx(sb),
    )).result)
    assert [d["document_id"] for d in res["documents"]] == expected
    assert res["total"] == len(expected)


def test_query_documents_by_view_saved_view_is_filtered_the_same_way(monkeypatch):
    from app.services import document_view_service
    from app.services import tool_dispatcher as td

    _patch_resolver(monkeypatch)

    async def _get_view(name, caller, supabase=None):
        return {"id": "v1", "name": name, "filter_expr": {"op": "and", "conditions": []}, "folder_scope": None}

    monkeypatch.setattr(document_view_service, "get_view_by_name", _get_view)
    sb = _SimSupabase({"documents": [_doc(LIVE, retrievable=True), _doc(GONE, retrievable=False)]})
    res = json.loads(_run(td._handle_query_documents_by_view({"view": "Contracts"}, _ctx(sb))).result)
    assert [d["document_id"] for d in res["documents"]] == [LIVE]
    assert res["total"] == 1


def test_the_library_view_resolve_keeps_the_default_and_still_returns_the_archived_row(monkeypatch):
    dvr = _patch_resolver(monkeypatch)
    from app.models.document_view import ViewFilter

    sb = _SimSupabase({"documents": [_doc(LIVE, retrievable=True), _doc(GONE, retrievable=False)]})
    flt = ViewFilter.model_validate({"op": "and", "conditions": []})
    full = _run(dvr.resolve_filter(caller=USER, flt=flt, folder_scope=None, count_only=False, supabase=sb))
    count = _run(dvr.resolve_filter(caller=USER, flt=flt, folder_scope=None, count_only=True, supabase=sb))
    assert sorted(d["id"] for d in full["documents"]) == sorted([LIVE, GONE])
    assert count["total"] == 2


# ── relationships (revision B-2) ─────────────────────────────────────────────────────────────

def _patch_relationships(monkeypatch, *, gone_retrievable: bool):
    from app.services import document_relationship_service as drs

    rows = {
        SUBJECT: _doc(SUBJECT, retrievable=True, filename="subject.pdf"),
        LIVE: _doc(LIVE, retrievable=True, filename="live.pdf"),
        GONE: _doc(GONE, retrievable=gone_retrievable, filename="gone.pdf"),
    }

    async def _resolve(handle, caller, *, by_filename=False, supabase=None):
        return dict(rows[handle]) if handle in rows else None

    async def _versions(subject, *, supabase=None):
        return [SUBJECT]

    monkeypatch.setattr(drs, "_resolve_readable_latest", _resolve)
    monkeypatch.setattr(drs, "_subject_version_ids", _versions)
    edges = [
        {"id": "e1", "source_doc_id": SUBJECT, "target_doc_id": LIVE, "rel_type": "references", "user_id": USER},
        {"id": "e2", "source_doc_id": SUBJECT, "target_doc_id": GONE, "rel_type": "references", "user_id": USER},
    ]
    return drs, _SimSupabase({drs._TABLE: edges})


@pytest.mark.parametrize("gone_retrievable, expected", [(False, ["live.pdf"]), (True, ["live.pdf", "gone.pdf"])])
def test_get_related_documents_tool_omits_a_source_gone_endpoint(monkeypatch, gone_retrievable, expected):
    from app.services import tool_dispatcher as td

    _, sb = _patch_relationships(monkeypatch, gone_retrievable=gone_retrievable)
    res = json.loads(_run(td._handle_get_related_documents({"document_id": SUBJECT}, _ctx(sb))).result)
    assert [d["filename"] for d in res["documents"]] == expected


def test_the_library_relationship_read_keeps_the_default_and_lists_both(monkeypatch):
    drs, sb = _patch_relationships(monkeypatch, gone_retrievable=False)
    out = _run(drs.get_related_documents(USER, document_id=SUBJECT, supabase=sb))
    assert [d["filename"] for d in out["documents"]] == ["live.pdf", "gone.pdf"]
    assert out["total"] == 2


# ── source fences ────────────────────────────────────────────────────────────────────────────

def test_retrievable_only_true_is_passed_by_the_agent_handlers_only():
    hits = {}
    for path in APP.rglob("*.py"):
        text = path.read_text(encoding="utf-8")
        n = len(re.findall(r"retrievable_only\s*=\s*True", text))
        if n:
            hits[path.relative_to(APP).as_posix()] = n
    assert hits == {"services/tool_dispatcher.py": 3}, hits  # 2 resolve_filter legs + 1 relationships


def test_the_library_routes_never_name_the_keyword():
    for rel in ("api/document_views.py", "api/document_relationships.py", "api/documents.py"):
        path = APP / rel
        if path.exists():
            assert "retrievable_only" not in path.read_text(encoding="utf-8"), rel


def test_the_shared_cores_default_the_keyword_to_false():
    for rel, name in (("services/document_view_resolver.py", "resolve_filter"),
                      ("services/document_relationship_service.py", "get_related_documents")):
        tree = ast.parse((APP / rel).read_text(encoding="utf-8"))
        fn = next(n for n in ast.walk(tree) if isinstance(n, ast.AsyncFunctionDef) and n.name == name)
        kw = [a.arg for a in fn.args.kwonlyargs]
        assert "retrievable_only" in kw, (rel, kw)
        default = fn.args.kw_defaults[kw.index("retrievable_only")]
        assert isinstance(default, ast.Constant) and default.value is False


def test_the_column_name_is_imported_never_retyped():
    for rel in ("services/retention/agent_wall.py", "services/tool_dispatcher.py", "api/kb.py"):
        assert '"retrievable"' not in (APP / rel).read_text(encoding="utf-8"), rel
