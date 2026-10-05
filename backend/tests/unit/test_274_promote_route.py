"""Phase 274 plan 02 Task 2 (ATT-03 / D-09 / D-11..D-14 / D-22 / D-28) — the promote, preview and
library-links routes.

The ROADMAP's named failure for SC#3 is a promote that lands somewhere the person did not pick, or a
Library write that skips the Library's own rules. So these cases pin, per path:

- **D-09** — only the person's OWN, live, `template_input` attachment can be saved. A foreign
  thread is `Thread not found`; a missing, cross-thread, expired, agent-written or malformed id is
  one `File not found`, and nothing is minted or even read.
- **D-11 / D-14** — the mint goes through the shipped minter with `version_scope="folder"`, the
  active org and `on_conflict="link"`, and the fresh document through `_enqueue_or_splice`.
- **D-12** — the minter's own 403/404 reach the caller verbatim.
- **D-13** — a duplicate is 200 `already`, names the EXISTING folder, and enqueues nothing.
- **D-28** — the `In Library` mark is stamped through the user-JWT client, best-effort.

Every case is STUBBED — ⛔ no `documents` row, no `workspace_files` row and no Postgres connection
is created by this file. Worktrees isolate files, not the local database.
"""
from __future__ import annotations

import logging
import re
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import BackgroundTasks, HTTPException, Response
from uuid import UUID

from app.api import workspace_promote
from app.models.workspace_promote import PromoteRequest
from app.services.ingest_splice import MintResult

THREAD = "11111111-1111-4111-8111-111111111111"
ORG = "22222222-2222-4222-8222-222222222222"
USER = {"id": "33333333-3333-4333-8333-333333333333"}
FILE_ID = "44444444-4444-4444-8444-444444444444"
FOLDER_PICKED = "55555555-5555-4555-8555-555555555555"
FOLDER_EXISTING = "66666666-6666-4666-8666-666666666666"
DOC_ID = "77777777-7777-4777-8777-777777777777"
RAW = b"PK\x03\x04 pretend xlsx bytes"
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

SRC = Path(workspace_promote.__file__).read_text(encoding="utf-8")


def _strip_comments(src: str) -> str:
    """Prose about code is not code: this module's docblock NAMES what it never calls."""
    out = re.sub(r'"""(?:.|\n)*?"""', "", src)
    out = re.sub(r"'''(?:.|\n)*?'''", "", out)
    out = re.sub(r"(?m)#.*$", "", out)
    return out


# ── a recording user-JWT supabase ─────────────────────────────────────────────────────────
class _Result:
    def __init__(self, data):
        self.data = data


class _Builder:
    def __init__(self, sb: "_RecSupabase", table: str):
        self.sb, self.table, self.op, self.payload = sb, table, "select", None
        self.cols: str | None = None
        self.filters: list = []

    def select(self, cols="*", **_k):
        self.op, self.cols = "select", cols
        return self

    def update(self, payload):
        self.op, self.payload = "update", payload
        return self

    def insert(self, payload):
        self.op, self.payload = "insert", payload
        return self

    def __getattr__(self, name):  # eq / in_ / or_ / is_ / order / limit / maybe_single
        def _f(*a, **_k):
            self.filters.append((name, a))
            return self
        return _f

    def execute(self):
        self.sb.calls.append(self)
        outcome = self.sb.results.get((self.table, self.op, self.cols), self.sb.results.get((self.table, self.op)))
        if isinstance(outcome, Exception):
            raise outcome
        if callable(outcome):
            return _Result(outcome(self))
        return _Result(outcome)


class _RecSupabase:
    def __init__(self, results: dict | None = None):
        self.results = results or {}
        self.calls: list[_Builder] = []
        self.storage = MagicMock()

    def table(self, name: str):
        return _Builder(self, name)

    def ops(self, table: str, op: str):
        return [c for c in self.calls if c.table == table and c.op == op]


class _FakeConn:
    async def __aenter__(self):
        return MagicMock()

    async def __aexit__(self, *a):
        return False


def _row(**over) -> dict:
    row = {
        "id": UUID(FILE_ID),
        "thread_id": UUID(THREAD),
        "path": "/1a2b3c4d-Meridian-Q4-pricing.xlsx",
        "size_bytes": len(RAW),
        "mime_type": XLSX,
        "kind": "template_input",
        "expires_at": None,
        "is_expired": False,
    }
    row.update(over)
    return row


def _doc(**over) -> dict:
    d = {
        "id": DOC_ID,
        "folder_id": FOLDER_PICKED,
        "status": "pending",
        "filename": "Meridian-Q4-pricing.xlsx",
        "version_number": 1,
        "file_path": f"{USER['id']}/{DOC_ID}/Meridian-Q4-pricing.xlsx",
    }
    d.update(over)
    return d


@pytest.fixture
def stubbed(monkeypatch):
    """Every seam the routes touch, replaced. Nothing reaches a database."""
    s = MagicMock()
    s.ownership = AsyncMock(return_value=None)
    s.get_file = AsyncMock(return_value=_row())
    s.content = AsyncMock(return_value=RAW)
    s.enqueue = AsyncMock(return_value=None)
    s.mint_kwargs = {}
    s.mint_result = MintResult(document=_doc(), is_duplicate=False, storage_path="sp/1", version_number=1)
    s.mint_raises = None

    async def _mint(**kw):
        s.mint_kwargs.update(kw)
        s.mint_calls = getattr(s, "mint_calls", 0) + 1
        if s.mint_raises:
            raise s.mint_raises
        return s.mint_result

    s.mint_calls = 0
    monkeypatch.setattr(workspace_promote, "_verify_thread_ownership", s.ownership)
    monkeypatch.setattr(workspace_promote, "get_user_pg_connection", lambda *a, **k: _FakeConn())
    monkeypatch.setattr(workspace_promote, "get_file_by_id", s.get_file)
    monkeypatch.setattr(workspace_promote, "_get_file_content", s.content)
    monkeypatch.setattr(workspace_promote.ingest_splice, "async_mint_document_row", _mint)
    monkeypatch.setattr(workspace_promote, "_enqueue_or_splice", s.enqueue)
    return s


async def _promote(supabase=None, *, file_id=FILE_ID, folder=FOLDER_PICKED):
    resp = Response()
    bg = BackgroundTasks()
    sb = supabase if supabase is not None else _RecSupabase()
    result = await workspace_promote.promote_attachment(
        thread_id=THREAD,
        file_id=file_id,
        body=PromoteRequest(folder_id=folder),
        request=MagicMock(),
        response=resp,
        background_tasks=bg,
        active_org=ORG,
        current_user=USER,
        supabase=sb,
    )
    return result, resp, bg, sb


def _assert_404(exc: HTTPException, detail: str):
    assert exc.status_code == 404
    assert exc.detail == detail
    assert "permission" not in str(exc.detail).lower()


# ── D-09 · the 404 collapse ────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_a_foreign_thread_is_thread_not_found_and_nothing_else_runs(stubbed):
    """PLANT to drive RED: read the file row before verifying the thread."""
    stubbed.ownership.side_effect = HTTPException(status_code=404, detail="Thread not found")
    with pytest.raises(HTTPException) as ei:
        await _promote()
    _assert_404(ei.value, "Thread not found")
    stubbed.get_file.assert_not_awaited()
    assert stubbed.mint_calls == 0


@pytest.mark.asyncio
async def test_a_malformed_file_id_is_file_not_found(stubbed):
    """PLANT to drive RED: let `UUID(file_id)` raise its ValueError (a 500)."""
    with pytest.raises(HTTPException) as ei:
        await _promote(file_id="not-a-uuid")
    _assert_404(ei.value, "File not found")
    stubbed.get_file.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "row",
    [
        None,
        _row(thread_id=UUID("99999999-9999-4999-8999-999999999999")),
        _row(is_expired=True),
        _row(kind="agent"),
        _row(kind=None),
    ],
    ids=["missing", "other-thread", "expired", "agent-written", "kind-null"],
)
async def test_every_unreachable_file_collapses_to_one_404_and_mints_nothing(stubbed, row):
    """PLANT to drive RED: drop any one predicate from the collapse (e.g. the `kind` check, which
    lets an agent-written deliverable be promoted — D-09)."""
    stubbed.get_file.return_value = row
    with pytest.raises(HTTPException) as ei:
        await _promote()
    _assert_404(ei.value, "File not found")
    stubbed.content.assert_not_awaited()
    assert stubbed.mint_calls == 0


# ── D-22 · refused types ───────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_a_python_attachment_is_refused_with_the_library_sentence(stubbed):
    """PLANT to drive RED: skip the promotability gate before minting."""
    stubbed.get_file.return_value = _row(path="/1a2b3c4d-script.py", mime_type="text/x-python")
    with pytest.raises(HTTPException) as ei:
        await _promote()
    assert ei.value.status_code == 422
    assert str(ei.value.detail).startswith("Unsupported file type: ")
    assert stubbed.mint_calls == 0
    stubbed.content.assert_not_awaited()


# ── D-11 / D-14 · a fresh promote ──────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_a_fresh_promote_mints_through_the_library_minter_and_enqueues_once(stubbed):
    """PLANT to drive RED: drop `version_scope="folder"` (a same-named file in ANOTHER folder is
    then retired), or pass the raw stored path as the filename."""
    result, resp, _bg, sb = await _promote()

    kw = stubbed.mint_kwargs
    assert kw["filename"] == "Meridian-Q4-pricing.xlsx"
    assert kw["mime_type"] == workspace_promote.library_mime("Meridian-Q4-pricing.xlsx", XLSX)
    assert kw["folder_id"] == FOLDER_PICKED
    assert kw["org_id"] == ORG
    assert kw["on_conflict"] == "link"
    assert kw["version_scope"] == "folder"
    assert kw["user_id"] == USER["id"]
    assert kw["raw"] == RAW
    assert kw["supabase"] is sb, "the mint runs on the injected user-JWT client"

    stubbed.enqueue.assert_awaited_once()
    eq = stubbed.enqueue.await_args.kwargs
    assert eq["storage_path"] == "sp/1"
    assert eq["active_org"] == ORG
    assert eq["raw"] == RAW

    assert resp.status_code == 201
    assert result.outcome == "saved"
    assert result.document_id == DOC_ID
    assert result.folder_id == FOLDER_PICKED
    assert result.filename == "Meridian-Q4-pricing.xlsx"

    stamps = sb.ops("workspace_files", "update")
    assert len(stamps) == 1
    assert stamps[0].payload == {"library_document_id": DOC_ID, "library_link": "saved"}
    assert ("eq", ("id", FILE_ID)) in stamps[0].filters
    assert ("eq", ("thread_id", THREAD)) in stamps[0].filters


# ── D-13 · a duplicate ─────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_a_duplicate_is_already_names_the_existing_folder_and_enqueues_nothing(stubbed):
    """PLANT to drive RED: return `body.folder_id` instead of the existing copy's folder, or
    enqueue the duplicate."""
    stubbed.mint_result = MintResult(
        document=_doc(folder_id=FOLDER_EXISTING, status="completed", version_number=3),
        is_duplicate=True,
        storage_path="sp/existing",
        version_number=3,
    )
    result, resp, _bg, sb = await _promote()

    stubbed.enqueue.assert_not_awaited()
    assert resp.status_code == 200
    assert result.outcome == "already"
    assert result.folder_id == FOLDER_EXISTING != FOLDER_PICKED
    assert result.document_status == "completed"
    assert result.version_number == 3
    stamps = sb.ops("workspace_files", "update")
    assert stamps and stamps[0].payload["library_link"] == "already"


# ── D-12 · the minter's refusals are the authority ─────────────────────────────────────────
@pytest.mark.asyncio
@pytest.mark.parametrize(
    "status_code,detail",
    [(403, "Cannot upload to a folder you do not own"), (404, "Folder not found")],
)
async def test_the_minters_folder_refusals_reach_the_caller_verbatim(stubbed, status_code, detail):
    """PLANT to drive RED: catch the minter's HTTPException and re-raise a paraphrase."""
    stubbed.mint_raises = HTTPException(status_code=status_code, detail=detail)
    with pytest.raises(HTTPException) as ei:
        await _promote()
    assert ei.value.status_code == status_code
    assert ei.value.detail == detail
    stubbed.enqueue.assert_not_awaited()


# ── D-29 (274 review CR-01) · a folder outside the ACTIVE org is refused before any mint ───
OTHER_ORG = "99999999-9999-4999-8999-999999999990"
REFUSE_OTHER_ORG = "Cannot upload to a folder in another organization"


@pytest.mark.asyncio
async def test_a_folder_in_another_org_is_refused_403_and_nothing_is_read_or_minted(stubbed):
    """PLANT to drive RED: drop the folder-org read (the minter's check compares `user_id` only,
    so an org-A folder the person owns accepts an org-B document — and an org-SHARED org-A folder
    then shows it to every member of org B)."""
    sb = _RecSupabase({("folders", "select"): {"id": FOLDER_PICKED, "org_id": OTHER_ORG}})
    with pytest.raises(HTTPException) as ei:
        await _promote(sb)
    assert ei.value.status_code == 403
    assert ei.value.detail == REFUSE_OTHER_ORG
    assert stubbed.mint_calls == 0
    stubbed.content.assert_not_awaited()
    stubbed.enqueue.assert_not_awaited()
    reads = sb.ops("folders", "select")
    assert len(reads) == 1
    assert ("eq", ("id", FOLDER_PICKED)) in reads[0].filters


@pytest.mark.asyncio
async def test_a_folder_in_the_active_org_promotes_as_before(stubbed):
    """The same read with the ACTIVE org is a pass, never a refusal (non-vacuity of the case above)."""
    sb = _RecSupabase({("folders", "select"): {"id": FOLDER_PICKED, "org_id": ORG}})
    result, resp, _bg, _sb = await _promote(sb)
    assert resp.status_code == 201
    assert result.outcome == "saved"
    assert stubbed.mint_calls == 1


@pytest.mark.asyncio
async def test_the_preview_refuses_a_folder_in_another_org_too(stubbed):
    """PLANT to drive RED: refuse on the POST only — the preview would then hash the bytes and
    describe a save that can never happen."""
    sb = _RecSupabase({("folders", "select"): {"id": FOLDER_PICKED, "org_id": OTHER_ORG}})
    with pytest.raises(HTTPException) as ei:
        await _preview(sb)
    assert ei.value.status_code == 403
    assert ei.value.detail == REFUSE_OTHER_ORG
    stubbed.content.assert_not_awaited()


# ── D-28 · the stamp is best-effort ────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_a_failed_stamp_never_fails_a_promote_whose_document_exists(stubbed, caplog):
    """PLANT to drive RED: let the stamp UPDATE's exception propagate."""
    sb = _RecSupabase({("workspace_files", "update"): RuntimeError("column library_link does not exist")})
    with caplog.at_level(logging.WARNING, logger=workspace_promote.logger.name):
        result, resp, _bg, _sb = await _promote(sb)
    assert resp.status_code == 201
    assert result.outcome == "saved"
    assert any("stamp" in r.getMessage().lower() for r in caplog.records)


# ── T-274-16 · an already-linked row returns its link and mints nothing ────────────────────
@pytest.mark.asyncio
async def test_an_already_linked_attachment_returns_its_link_without_minting(stubbed):
    """PLANT to drive RED: skip the existing-link check (a double-click then mints twice)."""
    sb = _RecSupabase({
        ("workspace_files", "select"): {"library_document_id": DOC_ID, "library_link": "saved"},
        ("documents", "select"): {**_doc(status="completed")},
    })
    result, resp, _bg, _sb = await _promote(sb)
    assert stubbed.mint_calls == 0
    stubbed.content.assert_not_awaited()
    assert resp.status_code == 200
    assert result.outcome == "saved"
    assert result.document_id == DOC_ID
    assert result.document_status == "completed"


@pytest.mark.asyncio
async def test_a_link_to_a_document_no_longer_visible_is_ignored_and_promote_proceeds(stubbed):
    """PLANT to drive RED: trust the stored id without re-reading the document through RLS."""
    sb = _RecSupabase({
        ("workspace_files", "select"): {"library_document_id": DOC_ID, "library_link": "saved"},
        ("documents", "select"): None,
    })
    result, resp, _bg, _sb = await _promote(sb)
    assert stubbed.mint_calls == 1
    assert resp.status_code == 201


# ── T-274-17 · audit ───────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_a_promote_is_audited_as_a_document_upload_from_a_thread(stubbed):
    """PLANT to drive RED: drop the audit task, or invent a new action type (boot hard-fails on
    an unsynced action type)."""
    result, _resp, bg, sb = await _promote()
    audits = [t for t in bg.tasks if t.func is workspace_promote.write_audit_entry]
    assert len(audits) == 1
    kw = audits[0].kwargs
    assert kw["action_type"] == "document.upload"
    assert kw["user_id"] == USER["id"]
    assert kw["supabase"] is sb, "the user-JWT client, never a service-role one"
    md = kw["metadata"]
    assert md["source"] == "thread_attachment"
    assert md["workspace_file_id"] == FILE_ID
    assert md["thread_id"] == THREAD
    assert md["document_id"] == DOC_ID
    assert md["outcome"] == "saved"


# ── the preview route ──────────────────────────────────────────────────────────────────────
async def _preview(supabase=None, *, file_id=FILE_ID):
    return await workspace_promote.promote_preview(
        thread_id=THREAD,
        file_id=file_id,
        request=MagicMock(),
        folder_id=UUID(FOLDER_PICKED),
        active_org=ORG,
        current_user=USER,
        supabase=supabase if supabase is not None else _RecSupabase(),
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("row", [None, _row(kind="agent"), _row(is_expired=True)], ids=["missing", "agent", "expired"])
async def test_the_preview_collapses_unreachable_files_to_404(stubbed, row):
    """PLANT to drive RED: drop the 404 collapse from the preview (it would then hash an
    agent-written file)."""
    stubbed.get_file.return_value = row
    with pytest.raises(HTTPException) as ei:
        await _preview()
    _assert_404(ei.value, "File not found")


@pytest.mark.asyncio
async def test_the_preview_reports_a_refused_type_without_hashing(stubbed):
    """PLANT to drive RED: read the bytes / query documents before checking the type."""
    stubbed.get_file.return_value = _row(path="/1a2b3c4d-data.json", mime_type="application/json")
    sb = _RecSupabase()
    out = await _preview(sb)
    assert out.promotable is False
    assert out.refusal and out.refusal.startswith("Unsupported file type: ")
    assert out.filename == "data.json"
    assert out.duplicate_of is None and out.next_version is None
    stubbed.content.assert_not_awaited()
    assert sb.ops("documents", "select") == []


@pytest.mark.asyncio
async def test_the_preview_delegates_to_preview_promotion(stubbed, monkeypatch):
    """PLANT to drive RED: compute the preview inline with different predicates."""
    seen = {}

    async def _fake_preview(supabase, **kw):
        seen.update(kw)
        return "sentinel"

    monkeypatch.setattr(workspace_promote, "preview_promotion", _fake_preview)
    out = await _preview()
    assert out == "sentinel"
    assert seen == {
        "raw": RAW,
        "filename": "Meridian-Q4-pricing.xlsx",
        "user_id": USER["id"],
        "org_id": ORG,
        "folder_id": FOLDER_PICKED,
    }


# ── the library-links route ────────────────────────────────────────────────────────────────
F1, F2, F3 = (
    "aaaaaaa1-0000-4000-8000-000000000001",
    "aaaaaaa2-0000-4000-8000-000000000002",
    "aaaaaaa3-0000-4000-8000-000000000003",
)


def _ws_rows():
    return [
        {"id": F1, "path": "/1a2b3c4d-a.xlsx", "mime_type": XLSX, "kind": "template_input",
         "expires_at": None, "library_document_id": DOC_ID, "library_link": "already"},
        {"id": F2, "path": "/1a2b3c4d-gone.pdf", "mime_type": "application/pdf", "kind": "template_input",
         "expires_at": None, "library_document_id": "88888888-8888-4888-8888-888888888888", "library_link": "saved"},
        {"id": F3, "path": "/1a2b3c4d-s.sh", "mime_type": "application/x-sh", "kind": "template_input",
         "expires_at": None, "library_document_id": None, "library_link": None},
    ]


async def _links(sb):
    return await workspace_promote.list_library_links(
        thread_id=THREAD, current_user=USER, supabase=sb,
    )


@pytest.mark.asyncio
async def test_library_links_reports_only_documents_the_person_can_still_see(stubbed):
    """PLANT to drive RED: build `link` from the stored id without the RLS documents read (a
    deleted or foreign document would then leak its id — T-274-14)."""
    sb = _RecSupabase({
        ("workspace_files", "select"): _ws_rows(),
        ("documents", "select"): [{"id": DOC_ID, "folder_id": FOLDER_EXISTING, "status": "completed",
                                    "filename": "a.xlsx"}],
    })
    out = await _links(sb)
    stubbed.ownership.assert_awaited_once()
    by_id = {f.workspace_file_id: f for f in out.files}
    assert set(by_id) == {F1, F2, F3}
    assert by_id[F1].link is not None
    assert by_id[F1].link.outcome == "already"
    assert by_id[F1].link.folder_id == FOLDER_EXISTING
    assert by_id[F1].link.document_status == "completed"
    assert by_id[F1].promotable is True
    assert by_id[F2].link is None, "a document RLS no longer returns is no link"
    assert by_id[F3].link is None and by_id[F3].promotable is False

    ws = sb.ops("workspace_files", "select")[0]
    assert ("eq", ("thread_id", THREAD)) in ws.filters
    assert ("eq", ("kind", "template_input")) in ws.filters
    assert any(name == "or_" and "expires_at.is.null" in a[0] for name, a in ws.filters)


@pytest.mark.asyncio
async def test_library_links_degrades_to_no_links_when_the_mig_203_columns_are_missing(stubbed, caplog):
    """PLANT to drive RED: let the column select's error become a 500."""
    base = [{k: v for k, v in r.items() if not k.startswith("library_")} for r in _ws_rows()]

    def _select(b):
        if "library_document_id" in (b.cols or ""):
            raise RuntimeError("column workspace_files.library_document_id does not exist")
        return base

    sb = _RecSupabase({("workspace_files", "select"): _select})
    with caplog.at_level(logging.WARNING, logger=workspace_promote.logger.name):
        out = await _links(sb)
    assert len(out.files) == 3
    assert all(f.link is None for f in out.files)
    assert caplog.records


# ── static: what this module must never contain ────────────────────────────────────────────
def test_the_module_has_no_service_role_no_folders_read_and_no_second_ingest_path():
    """PLANT to drive RED: add `get_supabase()` (a service-role read keyed on a client id —
    BUG-260903-02), a direct `splice_document`, or a hand-rolled `documents` insert.

    ⚠ AMENDED by D-29 (274 review CR-01) — the original forbade ANY `table("folders")` read (D-12:
    the minter's folder check is the authority). That check compares `user_id` only, so the module
    now reads the folder ONCE, for its `org_id`, through the injected user-JWT client. What stays
    forbidden is everything else a folders reference could be: a write, or a second read."""
    body = _strip_comments(SRC)
    assert "async def promote_attachment" in body  # non-vacuity
    for forbidden in ("get_supabase(", "service_role", "splice_document"):
        assert forbidden not in body, forbidden
    folder_reads = re.findall(r'table\("folders"\)\s*\.(\w+)\(([^)]*)\)', body)
    assert folder_reads == [("select", '"id, org_id"')], folder_reads
    assert not re.search(r'table\("documents"\)\s*\.insert\(', body)
    assert 'version_scope="folder"' in body
    assert 'on_conflict="link"' in body


def test_main_includes_the_router_exactly_once():
    """PLANT to drive RED: forget the include (every route 404s) or include it twice."""
    from app import main

    main_src = Path(main.__file__).read_text(encoding="utf-8")
    assert main_src.count("include_router(workspace_promote.router)") == 1
    paths = {getattr(r, "path", "") for r in main.app.routes}
    assert "/threads/{thread_id}/workspace/files/{file_id}/promote" in paths
    assert "/threads/{thread_id}/workspace/files/{file_id}/promote-preview" in paths
    assert "/threads/{thread_id}/workspace/library-links" in paths
