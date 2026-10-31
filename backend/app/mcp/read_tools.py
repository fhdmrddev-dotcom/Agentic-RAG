"""Phase 305-02 (MCP-02, MCP-03; D-12..D-16 / D-22 / D-51) — the three read tools' handlers.

Each one is a THIN wrapper over 304's ``services/acting_member_reads`` — the narrowed reads an MCP
key makes as its owner, in one org, on the acting connection, with the key's folder and
connector-fed scope applied (D-12 / T-305-21). This module adds only argument handling, paging and
shaping; it holds no visibility rule of its own and runs no statement.

A handler returns a RESULT MODEL (``app.mcp.results``) or a refusal SENTENCE (``str``) — never a
``CallToolResult`` — so 305-04's outbound guard can redact the model between the handler and the
rendering (``dispatch`` does the rendering).

* ``search_knowledge_base`` — the member's own settings with ``retrieval_top_k`` overridden by
  ``limit`` (D-51); twice ``limit`` when the key leaves connector-fed documents out, because the
  reads drop those rows AFTER ranking, then trimmed back to ``limit``.
* ``list_documents`` — the top level is the visible folders whose parent is not visible, plus (for
  an all-folders key only) the Root documents; a folder lists its visible subfolders (first page
  only, capped) then its documents by offset. A folder the key cannot see is the SAME empty page
  as an empty folder. A cursor that does not belong to this listing is refused before visibility
  is consulted, so the refusal says nothing about the folder.
* ``read_document`` — one bounded chunk per call. Missing, forbidden, other-org, out-of-scope,
  superseded, archived and malformed ids are the reads' one ``None`` and become ONE sentence, and
  a cursor that is not for this document is the SAME sentence (D-16 / T-305-04 / T-305-18). The
  document is re-read (re-authorised) on every call; the cursor only says where to resume.
"""
from __future__ import annotations

from typing import Any

from starlette.concurrency import run_in_threadpool

from app.mcp import results as R
from app.models.user_settings import load_user_settings
from app.services import acting_member_reads as reads
from app.services import usage_sink
from app.services.acting_member_reads import _uuid_or_none

NOT_AVAILABLE_SENTENCE = "No document with that id is available to this key."
NO_TEXT_SENTENCE = "This document has no readable text yet."
BAD_CURSOR_SENTENCE = "That cursor doesn't belong to this listing. List the folder again without a cursor."


# ── search_knowledge_base ───────────────────────────────────────────────────────────────────


async def search_knowledge_base(principal: Any, args: R.SearchArgs) -> R.SearchResult | str:
    excludes_external = not principal.include_external
    settings = await run_in_threadpool(load_user_settings, principal.user_id)
    top_k = 2 * args.limit if excludes_external else args.limit
    settings = settings.model_copy(update={"retrieval_top_k": top_k})
    rows = await reads.search(principal, args.query, user_settings=settings)
    if getattr(settings, "rerank_enabled", False) and rows:
        # 305-03 (D-29): a rerank spends too; its provider reports no tokens, so the row is an
        # honest unmeasured one (NULL tokens, never 0).
        usage_sink.record(getattr(settings, "rerank_model", None), None,
                          provider=getattr(settings, "rerank_provider", None))
    return R.SearchResult(passages=[R.passage_from_row(r) for r in rows[: args.limit]])


# ── list_documents ──────────────────────────────────────────────────────────────────────────


def _document_entry(row: dict) -> R.DocumentEntry:
    document_id = str(row.get("id"))
    return R.DocumentEntry(
        document_id=document_id,
        title=R.defang(str(row.get("filename") or "")),
        link=R.doc_link(document_id),
        origin=R.origin_of(row),
    )


def _folder_entry(row: dict) -> R.FolderEntry:
    return R.FolderEntry(folder_id=str(row["id"]), name=R.defang(str(row.get("name") or "")))


async def list_documents(principal: Any, args: R.ListArgs) -> R.ListResult | str:
    folder_id = None
    if args.folder_id is not None:
        folder_id = _uuid_or_none(args.folder_id)
    offset = 0
    if args.cursor is not None:
        decoded = R.decode_list_cursor(args.cursor, folder_id if args.folder_id is not None else None)
        if decoded is None:
            return BAD_CURSOR_SENTENCE
        offset = decoded
    empty = R.ListResult(folders=[], documents=[], next_cursor=None)
    if args.folder_id is not None and folder_id is None:
        return empty  # a malformed folder id: the same page as an empty folder

    visible = await reads.list_folders(principal)
    visible_ids = {str(f["id"]) for f in visible}
    if folder_id is None:
        folders = [f for f in visible if f.get("parent_id") is None or str(f["parent_id"]) not in visible_ids]
        if principal.folder_ids is not None:
            # a narrowed key has no Root documents: its world is its ticked subtrees
            documents: list[dict] = []
            total = 0
        else:
            page = await reads.list_documents(
                principal, limit=args.limit, offset=offset, folder_id=None, root_only=True
            )
            documents, total = page["items"], page["total"]
    else:
        if folder_id not in visible_ids:
            return empty
        folders = [f for f in visible if f.get("parent_id") is not None and str(f["parent_id"]) == folder_id]
        page = await reads.list_documents(principal, limit=args.limit, offset=offset, folder_id=folder_id)
        documents, total = page["items"], page["total"]

    shown_folders = folders[: R.SUBFOLDER_CAP] if offset == 0 else []
    end = offset + len(documents)
    next_cursor = R.encode_list_cursor(folder_id, end) if documents and end < total else None
    return R.ListResult(
        folders=[_folder_entry(f) for f in shown_folders],
        documents=[_document_entry(d) for d in documents],
        next_cursor=next_cursor,
    )


# ── read_document ───────────────────────────────────────────────────────────────────────────


async def read_document(principal: Any, args: R.ReadArgs) -> R.ReadResult | str:
    row = await reads.read_document(principal, args.document_id)
    if row is None:
        return NOT_AVAILABLE_SENTENCE
    text = row.get("full_markdown")
    total = len(text) if isinstance(text, str) else 0
    start = 0
    if args.cursor is not None:
        decoded = R.decode_read_cursor(args.cursor, str(row["id"]), total)
        if decoded is None:
            return NOT_AVAILABLE_SENTENCE  # the same bytes as a missing document (T-305-18)
        start = decoded
    if not isinstance(text, str) or not text:
        return NO_TEXT_SENTENCE
    piece, end = R.chunk(text, start)
    document_id = str(row["id"])
    return R.ReadResult(
        document_id=document_id,
        title=R.defang(str(row.get("filename") or "")),
        link=R.doc_link(document_id),
        origin=R.origin_of(row),
        text=R.defang(piece),
        offset=start,
        end=end,
        total_chars=total,
        next_cursor=R.encode_read_cursor(document_id, end) if end < total else None,
    )
