"""Phase 298 (ORG-06) — move ONE of your own items to another organization you belong to.

WHAT MOVES (D-19 / D-31), one item per request, never a bulk job (D-18):

  * ``folder`` — a Library folder the caller owns, with its whole subtree, every document in it and
    every org-stamped child row of those documents (chunks, images, tables, extraction runs,
    ingestion jobs) and every relationship whose BOTH ends move. The moved root becomes a top-level
    folder in the target org (its parent stays behind).
  * ``document`` — a Root document (no folder) and its whole version family (same owner, same name,
    same org), with the same child rows.
  * ``draft`` — one draft workflow row the caller created. Its past runs stay where they ran.

Threads and runs are NOT movable (count + Switch only); a published, starter or system-global
workflow is refused in words (D-31: the publish lock is not loosened). Both are seeded deferrals.

THE ONLY CLEAN CASE MOVES (D-33). Every blocker the research found is a refusal sentence that names
the item, the cause and the way out (UI-SPEC §4): org-shared, legal hold, watched by a connection,
retention policy / pending decision / retention history / archived, contents not owned, contents
stamped in another organization than the folder's (298-review CR-01), an org-shared ancestor or one
a chat, workflow or Expert binds (298-review WR-04), chats bound
to the folder, a workflow binding it (every D-34 arm, double-encoded definitions included), an
Expert install or bundle, a classification rule, a saved view, a recall check, a document still
processing, a version family crossing the subtree, a relationship with one end staying behind, and
a same-content (or same-name) document already in the target org. ``preview_move`` returns EVERY
sentence; ``execute_move`` refuses on the first.

ONE TRANSACTION ON THE POOL (D-20 / D-35). ``execute_move`` runs ``async with pool.acquire() as con:
async with con.transaction():`` and, on that one connection: checks ``org_members`` for the caller in
BOTH the source org (read from the row, never from the client) and the target org; locks the moved
rows ``FOR UPDATE``; re-runs every refusal (so a blocker created between preview and confirm is
caught — TOCTOU); updates ``org_id`` on every moved row; and INSERTs exactly one ``audit_log`` row
(``org.item.move``, ``org_id`` = the org the item LEAVES, metadata ``{kind, item_id, from_org,
to_org, counts}``). Move and receipt commit together or not at all.

Why the pool and not the caller's RLS connection: the document child tables are service-written and
have no authenticated UPDATE policy, so a user-JWT move would silently update 0 child rows and
half-apply (memory 268: user-JWT UPDATEs no-op). The price is that RLS does not guard this write, so
every check above is app-level and runs inside the transaction.

⛔ ``write_audit_entry`` is never used here: it swallows failures, which would make the receipt
unprovable. ⛔ There is no bulk entry point and no migration repair (D-18).

NO EXISTENCE ORACLE (D-22 / T-298-21): a missing item and an item the caller does not own read the
same 404 sentence; a target org the caller is not in reads the same 403 sentence whether or not it
exists; an org is named only when the caller is a member of it.
"""
from __future__ import annotations

import json
import logging
from dataclasses import asdict, dataclass, field
from typing import Any, Iterable, Literal
from uuid import UUID

import asyncpg

from app.services.foreign_folder_refusal import bound_folder_ids
from app.services.retention.hold_guard import is_hold_refusal

logger = logging.getLogger(__name__)

MoveKind = Literal["folder", "document", "draft"]
MOVE_KINDS: tuple[str, ...] = ("folder", "document", "draft")
AUDIT_ACTION = "org.item.move"

#: Document child tables that carry ``org_id`` and move WITH their document (D-19). Verified against
#: information_schema by the live post-condition test (every table with document_id + org_id either
#: moves here or is a refusal: connector_watch_items, legal_hold_documents, retention_receipts).
DOCUMENT_CHILD_TABLES: tuple[str, ...] = (
    "document_chunks",
    "document_images",
    "document_tables",
    "pdf_extraction_runs",
    "ingestion_jobs",
)

#: A run in one of these states is still live; a draft with one cannot move (D-19).
LIVE_RUN_STATUSES: tuple[str, ...] = ("active", "paused", "cap_paused")

#: The order refusals are stated in (D-33's order). ``order_refusals`` is the only sorter.
REFUSAL_ORDER: tuple[str, ...] = (
    "published",
    "system_global",
    "org_shared",
    "shared_documents",
    "legal_hold",
    "watched",
    "retention_policy",
    "retention_queue",
    "retention_receipt",
    "archived",
    "not_owned_folders",
    "not_owned_documents",
    "mixed_orgs",
    "chats",
    "workflows",
    "live_run",
    "schedules",
    "api_keys",
    "draft_folders",
    "expert",
    "classification_rule",
    "saved_view",
    "recall_check",
    "processing",
    "version_split",
    "family_in_folder",
    "relationship",
    "collision",
    "name_in_target",
)

# ── the words (UI-SPEC §4 copy contract; curly quotes, no codes, no route names) ──────────────

NOT_FOUND = "We couldn't find that among your items, so nothing was moved."
TARGET_NOT_MEMBER = "You're not a member of that organization, so nothing can move there."
SOURCE_NOT_MEMBER = (
    "You're no longer a member of the organization this is in, so you can't move it from there."
)
BAD_KIND = "Only a folder, a Root document or a draft workflow can move to another organization."
BAD_ID = "That isn't a valid id."
NO_SOURCE_ORG = "“{name}” isn't in any organization, so there is nothing to move it from."
SAME_ORG = "“{name}” is already in {org}."
CHANGED = "“{name}” changed while it was being checked. Nothing was moved. Try again."


def q(name: str | None) -> str:
    """An item name in curly quotes (UI-SPEC copy rule)."""
    return f"“{name or 'Untitled'}”"


def plural(n: int, one: str, many: str) -> str:
    """``1 document`` / ``2 documents`` — the exact plural, never ``document(s)``."""
    return f"{n} {one if n == 1 else many}"


def _is(n: int) -> str:
    return "is" if n == 1 else "are"


def _docs_in(kind: str, name: str, n: int) -> str:
    """The subject of a document-level sentence: ``2 documents in “Q3”`` for a folder, the
    document itself (``“MSA.pdf”``) for a Root document — its versions are one item to the reader."""
    if kind == "document":
        return f"{q(name)} is"
    return f"{plural(n, 'document', 'documents')} in {q(name)} {_is(n)}"


def s_published(name: str) -> str:
    return (
        f"{q(name)} is published, and published workflows can't move to another organization yet. "
        "Switch to its organization to use it there."
    )


def s_system_global(name: str) -> str:
    return f"{q(name)} is a starter workflow everyone shares, so it can't move."


def s_org_shared(folder: str, org: str) -> str:
    return f"{q(folder)} is shared with everyone in {org}. Make it private first, then move it."


def s_shared_documents(kind: str, name: str, n: int, org: str) -> str:
    return (
        f"{_docs_in(kind, name, n)} shared with everyone in {org} through a connection, "
        f"so {'it stays' if kind == 'document' or n == 1 else 'they stay'} there."
    )


def s_legal_hold(name: str, org: str) -> str:
    return f"{q(name)} is under a legal hold, so it stays in {org} until the hold is released."


def s_watched(name: str) -> str:
    return f"{q(name)} is kept in sync from a connected source. Stop watching it first, then move it."


def s_retention_policy(name: str, org: str) -> str:
    return f"{q(name)} has a retention policy in {org}. An org admin must remove it first."


def s_retention_queue(kind: str, name: str, n: int) -> str:
    return f"{_docs_in(kind, name, n)} waiting on a retention decision."


def s_retention_receipt(kind: str, name: str, n: int, org: str) -> str:
    one = kind == "document" or n == 1
    return (
        f"{_docs_in(kind, name, n)} part of {org}'s retention history, "
        f"so {'it stays' if one else 'they stay'} there."
    )


def s_archived(kind: str, name: str, n: int) -> str:
    one = kind == "document" or n == 1
    return (
        f"{_docs_in(kind, name, n)} archived by a retention policy. "
        f"Restore {'it' if one else 'them'} first, then move it."
    )


def s_not_owned_folders(name: str, n: int) -> str:
    return (
        f"{q(name)} holds {plural(n, 'folder', 'folders')} you don't own, "
        "so it can't move as a whole."
    )


def s_not_owned_documents(name: str, n: int) -> str:
    return (
        f"{q(name)} holds {plural(n, 'document', 'documents')} you don't own, "
        "so it can't move as a whole."
    )


def s_mixed_orgs(name: str, n: int, one: str, many: str, where: str, src: str) -> str:
    """298-review CR-01: a subfolder or document inside the folder is stamped in another org."""
    return (
        f"{q(name)} holds {plural(n, one, many)} that {_is(n)} in {where}, not in {src}. "
        f"Move {'it' if n == 1 else 'them'} out of {q(name)} first, then move the folder."
    )


def s_inside(name: str, ancestor: str, clause: str) -> str:
    """298-review WR-04: a blocker inherited from an ANCESTOR folder (the move detaches the root)."""
    return (
        f"{q(name)} is inside {q(ancestor)}, which {clause}. "
        f"Move {q(name)} out of {q(ancestor)} first, then move it."
    )


def s_chats(name: str, n: int, org: str) -> str:
    return (
        f"{plural(n, 'chat', 'chats')} in {org} {'uses' if n == 1 else 'use'} {q(name)}. "
        f"Moving it would cut {'it' if n == 1 else 'them'} off from it."
    )


def s_workflows(folder: str, workflow: str | None, others: int) -> str:
    who = f"The workflow {q(workflow)}" if workflow else "A workflow you can't open"
    tail = (
        f" {plural(others, 'other workflow uses', 'other workflows use')} it too." if others else ""
    )
    return f"{who} uses {q(folder)}. Moving the folder would stop it running.{tail}"


def s_live_run(name: str, n: int) -> str:
    return (
        f"{q(name)} has {plural(n, 'run', 'runs')} in progress. "
        "Wait for it to finish or stop it, then move it."
    )


def s_schedules(name: str, n: int, org: str) -> str:
    return (
        f"{q(name)} has {plural(n, 'schedule', 'schedules')} in {org}. "
        f"Remove {'it' if n == 1 else 'them'} first, then move it."
    )


def s_api_keys(name: str, n: int, org: str) -> str:
    keys = "An API key" if n == 1 else f"{n} API keys"
    return (
        f"{keys} in {org} can start {q(name)}. "
        f"Remove it from the {'key' if n == 1 else 'keys'} first, then move it."
    )


def s_draft_folder(folder: str | None, folder_org: str | None, target: str) -> str:
    if folder is None:
        return (
            "Its knowledge base is a folder you can't open. "
            f"Pick a folder from {target} first, then move it."
        )
    where = folder_org or "another organization"
    return f"Its knowledge base {q(folder)} is in {where}. Pick a folder from {target} first, then move it."


def s_expert(name: str, org: str | None) -> str:
    if org:
        return f"An Expert installed in {org} reads {q(name)}."
    return f"An Expert reads {q(name)}."


def s_classification_rule(name: str, org: str) -> str:
    return f"A classification rule in {org} files documents into {q(name)}."


def s_saved_view(view: str, name: str) -> str:
    return f"The saved view {q(view)} looks inside {q(name)}."


def s_recall_check(kind: str, name: str) -> str:
    if kind == "document":
        return f"A recall check expects {q(name)}."
    return f"A recall check expects a document in {q(name)}."


def s_processing(kind: str, name: str, n: int) -> str:
    one = kind == "document" or n == 1
    return (
        f"{_docs_in(kind, name, n)} still processing. "
        f"Try again when {'it finishes' if one else 'they finish'}."
    )


def s_version_split(doc: str) -> str:
    return (
        f"{q(doc)} has earlier versions outside this folder, "
        "so they would be split across organizations."
    )


def s_family_in_folder(doc: str) -> str:
    return f"{q(doc)} has a version inside a folder, so it can't move on its own."


def s_relationship(doc: str, org: str) -> str:
    return f"{q(doc)} is linked to a document that stays in {org}. Remove the link first, then move it."


def s_collision(doc: str, target: str) -> str:
    return f"{q(doc)} is already in {target}."


def s_collision_race(target: str) -> str:
    """The collision found by the database (a racing insert), not by the pre-check."""
    return f"The same file was just added to {target}. Nothing was moved. Try again to see which one."


def s_name_in_target(doc: str, target: str) -> str:
    return (
        f"A document named {q(doc)} is already in {target}, so their versions would mix. "
        "Rename one of them first."
    )


# ── the shapes ───────────────────────────────────────────────────────────────────────────────


class MoveRefused(Exception):
    """A worded refusal. ``status``: 409 blocker · 403 membership · 404 not found / not yours ·
    422 bad kind, id or target."""

    def __init__(self, sentence: str, status: int):
        super().__init__(sentence)
        self.sentence = sentence
        self.status = status


@dataclass
class MoveCounts:
    subfolders: int = 0
    documents: int = 0
    earlier_versions: int = 0
    past_runs: int = 0


@dataclass
class MovePreview:
    kind: str
    item_id: str
    item_name: str
    from_org_id: str
    from_org_name: str
    to_org_id: str
    to_org_name: str
    counts: MoveCounts = field(default_factory=MoveCounts)
    refusals: list[str] = field(default_factory=list)


# ── pure helpers (unit-tested) ───────────────────────────────────────────────────────────────


def parse_kind(kind: Any) -> str:
    if kind not in MOVE_KINDS:
        raise MoveRefused(BAD_KIND, 422)
    return str(kind)


def parse_id(value: Any) -> UUID:
    """A strict UUID (canonical 8-4-4-4-12), else a 422 — never a 500, never a lookup."""
    text = str(value or "").strip()
    try:
        parsed = UUID(text)
    except (ValueError, TypeError, AttributeError):
        raise MoveRefused(BAD_ID, 422) from None
    if str(parsed) != text.lower():
        raise MoveRefused(BAD_ID, 422)
    return parsed


def order_refusals(found: dict[str, list[str]]) -> list[str]:
    """Every sentence, in ``REFUSAL_ORDER``. An unknown code is a programming error."""
    unknown = set(found) - set(REFUSAL_ORDER)
    if unknown:
        raise ValueError(f"unknown refusal codes: {sorted(unknown)}")
    return [s for code in REFUSAL_ORDER for s in found.get(code, [])]


def fold_counts(
    kind: str, *, folder_count: int = 0, latest_documents: int = 0, earlier_versions: int = 0,
    past_runs: int = 0,
) -> MoveCounts:
    """The confirm's numbers (UI-D18). ``documents`` counts the LATEST version of each document —
    what the Library lists — and ``earlier_versions`` the rest; a folder's own row is not a
    subfolder."""
    if kind == "folder":
        return MoveCounts(
            subfolders=max(folder_count - 1, 0), documents=latest_documents,
            earlier_versions=earlier_versions,
        )
    if kind == "document":
        return MoveCounts(documents=1, earlier_versions=earlier_versions)
    return MoveCounts(past_runs=past_runs)


def audit_metadata(preview: MovePreview) -> dict:
    """The receipt's metadata (D-20): kind, item, both orgs and the counts that moved."""
    return {
        "kind": preview.kind,
        "item_id": preview.item_id,
        "from_org": preview.from_org_id,
        "to_org": preview.to_org_id,
        "counts": asdict(preview.counts),
    }


# ── SQL ──────────────────────────────────────────────────────────────────────────────────────

_MEMBER_SQL = "SELECT 1 FROM public.org_members WHERE org_id = $1 AND user_id = $2 LIMIT 1"
_ORG_NAMES_SQL = "SELECT id, name FROM public.organizations WHERE id = ANY($1::uuid[])"

_FOLDER_ROOT_SQL = (
    "SELECT id, name, org_id, user_id FROM public.folders WHERE id = $1 AND user_id = $2"
)
_SUBTREE_SQL = """
WITH RECURSIVE sub(id) AS (
  SELECT id FROM public.folders WHERE id = $1
  UNION
  SELECT f.id FROM public.folders f JOIN sub ON f.parent_id = sub.id
)
SELECT f.id, f.name, f.parent_id, f.user_id, f.org_id, f.is_org_shared
FROM public.folders f JOIN sub ON sub.id = f.id
"""
_DOCS_COLS = (
    "id, user_id, org_id, folder_id, filename, status, content_hash, is_latest, archived_at, "
    "ingest_visibility"
)
_DOCS_IN_FOLDERS_SQL = f"SELECT {_DOCS_COLS} FROM public.documents WHERE folder_id = ANY($1::uuid[])"
_DOC_ROOT_SQL = (
    "SELECT id, user_id, org_id, folder_id, filename FROM public.documents "
    "WHERE id = $1 AND user_id = $2"
)
_FAMILY_SQL = (
    f"SELECT {_DOCS_COLS} FROM public.documents "
    "WHERE user_id = $1 AND filename = $2 AND org_id = $3"
)
_DRAFT_SQL = (
    "SELECT id, name, status, org_id, is_system_global, definition FROM public.workflow_definitions "
    "WHERE id = $1 AND created_by = $2"
)


def _lock(sql: str, lock: bool, of: str | None = None) -> str:
    if not lock:
        return sql
    return f"{sql.rstrip()} FOR UPDATE" + (f" OF {of}" if of else "")


def _ids(rows: Iterable[Any], key: str = "id") -> list[UUID]:
    return [r[key] for r in rows]


# ── collection ───────────────────────────────────────────────────────────────────────────────


@dataclass
class _Items:
    kind: str
    item_id: UUID
    name: str
    source_org: UUID | None
    folders: list[Any] = field(default_factory=list)
    documents: list[Any] = field(default_factory=list)
    draft: Any = None


async def _collect(con, *, kind: str, item_id: UUID, user_id: UUID, lock: bool) -> _Items:
    """The item set. With ``lock`` every collected row is ``FOR UPDATE`` (inside the transaction)."""
    if kind == "folder":
        root = await con.fetchrow(_lock(_FOLDER_ROOT_SQL, lock), item_id, user_id)
        if root is None:
            raise MoveRefused(NOT_FOUND, 404)
        # Lock the root first: a new child folder needs KEY SHARE on its parent, so no subfolder can
        # appear under a locked folder. Re-read until the subtree is stable under its own locks.
        folders = await con.fetch(_lock(_SUBTREE_SQL, lock, "f"), item_id)
        if lock:
            again = await con.fetch(_SUBTREE_SQL, item_id)
            if {r["id"] for r in again} != {r["id"] for r in folders}:
                raise MoveRefused(CHANGED.format(name=root["name"]), 409)
        documents = await con.fetch(_lock(_DOCS_IN_FOLDERS_SQL, lock), _ids(folders))
        return _Items(kind, item_id, root["name"], root["org_id"], folders=folders, documents=documents)

    if kind == "document":
        doc = await con.fetchrow(_lock(_DOC_ROOT_SQL, lock), item_id, user_id)
        if doc is None:
            raise MoveRefused(NOT_FOUND, 404)
        family = await con.fetch(_lock(_FAMILY_SQL, lock), user_id, doc["filename"], doc["org_id"])
        if lock and item_id not in {r["id"] for r in family}:
            raise MoveRefused(CHANGED.format(name=doc["filename"]), 409)
        return _Items(kind, item_id, doc["filename"], doc["org_id"], documents=family)

    draft = await con.fetchrow(_lock(_DRAFT_SQL, lock), item_id, user_id)
    if draft is None:
        raise MoveRefused(NOT_FOUND, 404)
    return _Items(kind, item_id, draft["name"], draft["org_id"], draft=draft)


# ── refusals ─────────────────────────────────────────────────────────────────────────────────


async def _org_names(con, ids: Iterable[UUID | None]) -> dict[UUID, str]:
    wanted = sorted({i for i in ids if i is not None}, key=str)
    if not wanted:
        return {}
    rows = await con.fetch(_ORG_NAMES_SQL, wanted)
    return {r["id"]: r["name"] for r in rows}


async def _member_orgs(con, user_id: UUID, orgs: Iterable[UUID | None]) -> set[UUID]:
    wanted = sorted({o for o in orgs if o is not None}, key=str)
    if not wanted:
        return set()
    rows = await con.fetch(
        "SELECT org_id FROM public.org_members WHERE user_id = $1 AND org_id = ANY($2::uuid[])",
        user_id, wanted,
    )
    return {r["org_id"] for r in rows}


async def _document_refusals(
    con, items: _Items, *, user_id: UUID, src_name: str, dst: UUID, dst_name: str,
    found: dict[str, list[str]],
) -> None:
    """Every refusal that is about the documents themselves (both the folder and document kinds)."""
    kind, name = items.kind, items.name
    docs = items.documents
    doc_ids = _ids(docs)
    if not doc_ids:
        return

    def add(code: str, sentence: str) -> None:
        found.setdefault(code, []).append(sentence)

    shared = [d for d in docs if (d["ingest_visibility"] or "private") != "private"]
    if shared:
        add("shared_documents", s_shared_documents(kind, name, len(shared), src_name))

    if kind == "document":
        held = await con.fetchval(
            "SELECT count(DISTINCT document_id) FROM public.retention_held_documents($1::uuid[])",
            doc_ids,
        )
        if held:
            add("legal_hold", s_legal_hold(name, src_name))
        if await con.fetchval(
            "SELECT 1 FROM public.connector_watch_items WHERE document_id = ANY($1::uuid[]) LIMIT 1",
            doc_ids,
        ):
            add("watched", s_watched(name))

    queued = await con.fetchval(
        "SELECT count(DISTINCT latest_document_id) FROM public.retention_queue "
        "WHERE latest_document_id = ANY($1::uuid[])", doc_ids,
    )
    if queued:
        add("retention_queue", s_retention_queue(kind, name, queued))
    receipts = await con.fetchval(
        "SELECT count(DISTINCT document_id) FROM public.retention_receipts "
        "WHERE document_id = ANY($1::uuid[])", doc_ids,
    )
    if receipts:
        add("retention_receipt", s_retention_receipt(kind, name, receipts, src_name))
    archived = [d for d in docs if d["archived_at"] is not None]
    if archived:
        add("archived", s_archived(kind, name, len(archived)))

    if kind == "folder":
        not_owned = [d for d in docs if d["user_id"] != user_id]
        if not_owned:
            add("not_owned_documents", s_not_owned_documents(name, len(not_owned)))

    checks = await con.fetchval(
        "SELECT count(*) FROM public.checked_queries WHERE expected_document_id = ANY($1::uuid[])",
        doc_ids,
    )
    if checks:
        add("recall_check", s_recall_check(kind, name))

    processing = [d for d in docs if d["status"] in ("pending", "processing")]
    if processing:
        add("processing", s_processing(kind, name, len(processing)))

    moving = set(doc_ids)
    if kind == "folder":
        # A version family is (owner, name, org); every member must move together.
        split: list[str] = []
        for d in docs:
            if d["filename"] in split:
                continue
            outside = await con.fetchval(
                "SELECT count(*) FROM public.documents WHERE user_id = $1 AND filename = $2 "
                "AND org_id = $3 AND NOT (id = ANY($4::uuid[]))",
                d["user_id"], d["filename"], d["org_id"], list(moving),
            )
            if outside:
                split.append(d["filename"])
        for fname in split:
            add("version_split", s_version_split(fname))
    else:
        if any(d["folder_id"] is not None for d in docs):
            add("family_in_folder", s_family_in_folder(name))

    linked = await con.fetch(
        "SELECT r.source_doc_id, r.target_doc_id FROM public.document_relationships r "
        "WHERE (r.source_doc_id = ANY($1::uuid[])) <> (r.target_doc_id = ANY($1::uuid[]))",
        list(moving),
    )
    if linked:
        by_id = {d["id"]: d["filename"] for d in docs}
        named: list[str] = []
        for r in linked:
            mine = r["source_doc_id"] if r["source_doc_id"] in moving else r["target_doc_id"]
            fname = by_id.get(mine, name)
            if fname not in named:
                named.append(fname)
        for fname in named:
            add("relationship", s_relationship(fname, src_name))

    # The two unique indexes on documents, checked against the target org before the write
    # (documents_completed_hash_unique_idx, documents_dedup_idx); a racing insert still maps to the
    # same sentence through UniqueViolationError.
    collide = await con.fetch(
        """
        SELECT DISTINCT m.filename
        FROM public.documents m
        JOIN public.documents t
          ON t.org_id = $2 AND t.user_id = m.user_id AND t.content_hash = m.content_hash
         AND NOT (t.id = ANY($1::uuid[]))
        WHERE m.id = ANY($1::uuid[]) AND m.content_hash IS NOT NULL
          AND (
            (m.status = 'completed' AND t.status = 'completed')
            OR (m.status <> 'failed' AND t.status <> 'failed'
                AND COALESCE(m.folder_id, '00000000-0000-0000-0000-000000000000'::uuid)
                  = COALESCE(t.folder_id, '00000000-0000-0000-0000-000000000000'::uuid))
          )
        ORDER BY m.filename
        """,
        list(moving), dst,
    )
    for r in collide:
        add("collision", s_collision(r["filename"], dst_name))
    same_name = await con.fetch(
        """
        SELECT DISTINCT m.filename FROM public.documents m
        JOIN public.documents t ON t.org_id = $2 AND t.user_id = m.user_id AND t.filename = m.filename
         AND NOT (t.id = ANY($1::uuid[]))
        WHERE m.id = ANY($1::uuid[]) ORDER BY m.filename
        """,
        list(moving), dst,
    )
    colliding = {r["filename"] for r in collide}
    for r in same_name:
        if r["filename"] not in colliding:
            add("name_in_target", s_name_in_target(r["filename"], dst_name))


async def _mixed_org_refusals(
    con, items: _Items, *, user_id: UUID, src: UUID, src_name: str, found: dict[str, list[str]],
) -> None:
    """298-review CR-01: every moving row must already be in the source org.

    Subfolders and documents carry their OWN ``org_id`` (the SEED-313 class). Membership is checked
    against the root's org only, so a row stamped elsewhere would leave an org the caller may not be
    in, under a receipt naming the wrong from-org. Refusal, not a per-org membership sweep: the safe
    polarity, and the way out (move the stray rows out of the folder) is the user's to choose. An org
    is named only when the caller is a member of it (T-298-21)."""
    stray_folders = [f for f in items.folders if f["org_id"] != src]
    stray_docs = [d for d in items.documents if d["org_id"] != src]
    if not (stray_folders or stray_docs):
        return
    members = await _member_orgs(con, user_id, [r["org_id"] for r in (*stray_folders, *stray_docs)])
    names = await _org_names(con, members)

    def where(rows: list[Any]) -> str:
        orgs = {r["org_id"] for r in rows}
        if len(orgs) > 1:
            return "other organizations"
        (org,) = orgs
        return names.get(org, "another organization") if org in members else "another organization"

    for rows, one, many in ((stray_folders, "folder", "folders"), (stray_docs, "document", "documents")):
        if rows:
            found.setdefault("mixed_orgs", []).append(
                s_mixed_orgs(items.name, len(rows), one, many, where(rows), src_name)
            )


_ANCESTORS_SQL = """
SELECT f.id, f.name, f.is_org_shared, a.depth
FROM public.retention_folder_ancestors($1) a JOIN public.folders f ON f.id = a.folder_id
WHERE a.depth > 0 ORDER BY a.depth
"""


async def _ancestor_refusals(
    con, items: _Items, *, user_id: UUID, src_name: str, found: dict[str, list[str]],
) -> None:
    """298-review WR-04: blockers that reach the subtree THROUGH an ancestor folder.

    Org-shared visibility (``is_in_global_subtree``) and the chat / workflow / Expert bindings all
    expand to a bound folder's descendants, and the move detaches the root (``parent_id = NULL``),
    so each would silently lose the subtree. The same walk the retention arm uses
    (``retention_folder_ancestors``, CYCLE-safe); the NEAREST ancestor carrying each blocker is
    named. NOT refused on an ancestor: a connector watch (``WatchService`` writes into
    ``library_folder_id`` itself, never a descendant; the subtree's own watch items are checked
    above), a saved view (per-user, re-pickable) and a classification rule (files into its own
    folder only)."""
    ancestors = await con.fetch(_ANCESTORS_SQL, items.item_id)
    if not ancestors:
        return
    name = items.name
    anc_ids = _ids(ancestors)

    def nearest(ids: set[UUID]) -> Any:
        return next((a for a in ancestors if a["id"] in ids), None)

    def add(code: str, ancestor: Any, clause: str) -> None:
        found.setdefault(code, []).append(s_inside(name, ancestor["name"], clause))

    shared = nearest({a["id"] for a in ancestors if a["is_org_shared"]})
    if shared is not None:
        add("org_shared", shared, f"is shared with everyone in {src_name}")

    chats = {
        r["folder_id"]: r["n"] for r in await con.fetch(
            "SELECT folder_id, count(*) AS n FROM public.threads WHERE folder_id = ANY($1::uuid[]) "
            "GROUP BY folder_id", anc_ids,
        )
    }
    if chats:
        a = nearest(set(chats))
        n = int(chats[a["id"]])
        add("chats", a, f"{plural(n, 'chat', 'chats')} in {src_name} {'uses' if n == 1 else 'use'}")

    candidates = await con.fetch(
        "SELECT id, name, created_by, definition FROM public.workflow_definitions "
        "WHERE definition::text LIKE ANY($1::text[]) ORDER BY name, id",
        [f"%{aid}%" for aid in anc_ids],
    )
    by_anc: dict[UUID, Any] = {}
    for wf in candidates:
        bound = set(bound_folder_ids(wf["definition"]))
        for a in ancestors:
            if str(a["id"]) in bound and a["id"] not in by_anc:
                by_anc[a["id"]] = wf
    if by_anc:
        a = nearest(set(by_anc))
        wf = by_anc[a["id"]]
        who = f"the workflow {q(wf['name'])}" if wf["created_by"] == user_id else "a workflow you can't open"
        add("workflows", a, f"{who} uses")

    installs = await con.fetch(
        "SELECT folder_id, org_id FROM public.expert_installs WHERE folder_id = ANY($1::uuid[])",
        anc_ids,
    )
    bundles = await con.fetch(
        "SELECT knowledge_folder_ids FROM public.expert_bundles WHERE knowledge_folder_ids && $1::uuid[]",
        anc_ids,
    )
    if installs:
        a = nearest({r["folder_id"] for r in installs})
        orgs = [r["org_id"] for r in installs if r["folder_id"] == a["id"]]
        members = await _member_orgs(con, user_id, orgs)
        names = await _org_names(con, members)
        org = next((names[o] for o in sorted(members, key=str) if o in names), None)
        add("expert", a, f"an Expert installed in {org} reads" if org else "an Expert reads")
    elif bundles:
        a = nearest({fid for r in bundles for fid in (r["knowledge_folder_ids"] or [])})
        if a is not None:
            add("expert", a, "an Expert reads")


async def _folder_refusals(
    con, items: _Items, *, user_id: UUID, src_name: str, found: dict[str, list[str]],
) -> None:
    name = items.name
    folders = items.folders
    folder_ids = _ids(folders)
    doc_ids = _ids(items.documents)

    def add(code: str, sentence: str) -> None:
        found.setdefault(code, []).append(sentence)

    for f in folders:
        if f["is_org_shared"]:
            add("org_shared", s_org_shared(f["name"], src_name))

    held_folders = await con.fetchval(
        "SELECT count(*) FROM public.retention_held_folders($1::uuid[])", folder_ids
    )
    held_docs = 0
    if not held_folders and doc_ids:
        held_docs = await con.fetchval(
            "SELECT count(DISTINCT document_id) FROM public.retention_held_documents($1::uuid[])",
            doc_ids,
        )
    if held_folders or held_docs:
        add("legal_hold", s_legal_hold(name, src_name))

    watched = await con.fetchval(
        "SELECT 1 FROM public.connector_watches WHERE library_folder_id = ANY($1::uuid[]) LIMIT 1",
        folder_ids,
    )
    if not watched and doc_ids:
        watched = await con.fetchval(
            "SELECT 1 FROM public.connector_watch_items WHERE document_id = ANY($1::uuid[]) LIMIT 1",
            doc_ids,
        )
    if watched:
        add("watched", s_watched(name))

    # A folder policy on any subtree folder, or an include-subfolders policy on an ANCESTOR: either
    # way an org admin's retention coverage would silently stop applying.
    policy = await con.fetchval(
        """
        SELECT 1 FROM public.retention_policies p
        WHERE p.scope_kind = 'folder' AND (
          p.folder_id = ANY($1::uuid[])
          OR (p.include_subfolders AND p.folder_id IN (
                SELECT a.folder_id FROM public.retention_folder_ancestors($2) a WHERE a.depth > 0))
        ) LIMIT 1
        """,
        folder_ids, items.item_id,
    )
    if policy:
        add("retention_policy", s_retention_policy(name, src_name))

    not_owned = [f for f in folders if f["user_id"] != user_id]
    if not_owned:
        add("not_owned_folders", s_not_owned_folders(name, len(not_owned)))

    chats = await con.fetchval(
        "SELECT count(*) FROM public.threads WHERE folder_id = ANY($1::uuid[])", folder_ids
    )
    if chats:
        add("chats", s_chats(name, chats, src_name))

    # A workflow binding any subtree folder (D-34 arms, SEED-154 double-encoding decoded).
    patterns = [f"%{fid}%" for fid in folder_ids]
    candidates = await con.fetch(
        "SELECT id, name, created_by, definition FROM public.workflow_definitions "
        "WHERE definition::text LIKE ANY($1::text[]) ORDER BY name, id",
        patterns,
    )
    wanted = {str(f) for f in folder_ids}
    binding = [w for w in candidates if wanted & set(bound_folder_ids(w["definition"]))]
    if binding:
        first = binding[0]
        add(
            "workflows",
            s_workflows(name, first["name"] if first["created_by"] == user_id else None, len(binding) - 1),
        )

    installs = await con.fetch(
        "SELECT DISTINCT org_id FROM public.expert_installs WHERE folder_id = ANY($1::uuid[])",
        folder_ids,
    )
    bundles = await con.fetchval(
        "SELECT 1 FROM public.expert_bundles WHERE knowledge_folder_ids && $1::uuid[] LIMIT 1",
        folder_ids,
    )
    if installs:
        members = await _member_orgs(con, user_id, [r["org_id"] for r in installs])
        names = await _org_names(con, members)
        org = next((names[o] for o in sorted(members, key=str) if o in names), None)
        add("expert", s_expert(name, org))
    elif bundles:
        add("expert", s_expert(name, None))

    if await con.fetchval(
        "SELECT 1 FROM public.classification_rules WHERE suggest_folder_id = ANY($1::uuid[]) LIMIT 1",
        folder_ids,
    ):
        add("classification_rule", s_classification_rule(name, src_name))

    views = await con.fetch(
        "SELECT name, user_id FROM public.document_views WHERE folder_scope = ANY($1::uuid[]) "
        "ORDER BY name",
        folder_ids,
    )
    for v in views:
        add("saved_view", s_saved_view(v["name"] if v["user_id"] == user_id else "a view", name))


async def _draft_refusals(
    con, items: _Items, *, user_id: UUID, src_name: str, dst: UUID, dst_name: str,
    found: dict[str, list[str]],
) -> int:
    """The draft's refusals; returns its past-run count (they stay where they ran)."""
    row = items.draft
    name = items.name

    def add(code: str, sentence: str) -> None:
        found.setdefault(code, []).append(sentence)

    if row["is_system_global"]:
        add("system_global", s_system_global(name))
    elif row["status"] != "draft":
        add("published", s_published(name))

    live = await con.fetchval(
        "SELECT count(*) FROM public.workflow_runs WHERE definition_id = $1 AND status = ANY($2::text[])",
        items.item_id, list(LIVE_RUN_STATUSES),
    )
    if live:
        add("live_run", s_live_run(name, live))
    schedules = await con.fetchval(
        "SELECT count(*) FROM public.workflow_schedules WHERE workflow_id = $1", items.item_id
    )
    if schedules:
        add("schedules", s_schedules(name, schedules, src_name))
    keys = await con.fetchval(
        "SELECT count(*) FROM public.api_keys WHERE revoked_at IS NULL "
        "AND workflows @> jsonb_build_array(jsonb_build_object('id', $1::text))",
        str(items.item_id),
    )
    if keys:
        add("api_keys", s_api_keys(name, keys, src_name))

    bound = bound_folder_ids(row["definition"])
    if bound:
        folders = await con.fetch(
            "SELECT id, name, org_id, user_id, is_org_shared FROM public.folders "
            "WHERE id = ANY($1::uuid[])",
            [UUID(b) for b in bound],
        )
        by_id = {str(f["id"]): f for f in folders}
        offenders = [by_id[b] for b in bound if b in by_id and by_id[b]["org_id"] != dst]
        if offenders:
            members = await _member_orgs(con, user_id, [f["org_id"] for f in offenders])
            names = await _org_names(con, members)
            for f in offenders:
                visible = f["user_id"] == user_id or (f["is_org_shared"] and f["org_id"] in members)
                add(
                    "draft_folders",
                    s_draft_folder(
                        f["name"] if visible else None,
                        names.get(f["org_id"]) if f["org_id"] in members else None,
                        dst_name,
                    ),
                )

    return int(
        await con.fetchval(
            "SELECT count(*) FROM public.workflow_runs WHERE definition_id = $1", items.item_id
        ) or 0
    )


# ── the shared prepare (preview and execute run the SAME checks) ─────────────────────────────


async def _prepare(
    con, *, user_id: UUID, kind: str, item_id: UUID, to_org_id: UUID, lock: bool,
) -> tuple[_Items, MovePreview]:
    # Target membership first: a non-member target reads the same 403 whether or not it exists.
    if await con.fetchval(_MEMBER_SQL, to_org_id, user_id) is None:
        raise MoveRefused(TARGET_NOT_MEMBER, 403)
    items = await _collect(con, kind=kind, item_id=item_id, user_id=user_id, lock=lock)
    src = items.source_org
    if src is None:
        raise MoveRefused(NO_SOURCE_ORG.format(name=items.name), 422)
    # The source org is READ FROM THE ROW, never from the client (T-298-15).
    if await con.fetchval(_MEMBER_SQL, src, user_id) is None:
        raise MoveRefused(SOURCE_NOT_MEMBER, 403)
    names = await _org_names(con, [src, to_org_id])
    src_name, dst_name = names.get(src, "this organization"), names.get(to_org_id, "that organization")
    if src == to_org_id:
        raise MoveRefused(SAME_ORG.format(name=items.name, org=dst_name), 422)

    found: dict[str, list[str]] = {}
    past_runs = 0
    if kind == "folder":
        await _mixed_org_refusals(
            con, items, user_id=user_id, src=src, src_name=src_name, found=found
        )
        await _folder_refusals(con, items, user_id=user_id, src_name=src_name, found=found)
        await _ancestor_refusals(con, items, user_id=user_id, src_name=src_name, found=found)
    if kind in ("folder", "document"):
        await _document_refusals(
            con, items, user_id=user_id, src_name=src_name, dst=to_org_id, dst_name=dst_name,
            found=found,
        )
    if kind == "draft":
        past_runs = await _draft_refusals(
            con, items, user_id=user_id, src_name=src_name, dst=to_org_id, dst_name=dst_name,
            found=found,
        )

    docs = items.documents
    counts = fold_counts(
        kind,
        folder_count=len(items.folders),
        latest_documents=sum(1 for d in docs if d["is_latest"]) if kind == "folder" else 0,
        earlier_versions=(
            sum(1 for d in docs if not d["is_latest"]) if kind == "folder"
            else max(len(docs) - 1, 0)
        ),
        past_runs=past_runs,
    )
    preview = MovePreview(
        kind=kind, item_id=str(item_id), item_name=items.name or "",
        from_org_id=str(src), from_org_name=src_name, to_org_id=str(to_org_id),
        to_org_name=dst_name, counts=counts, refusals=order_refusals(found),
    )
    return items, preview


def _parse(kind: Any, item_id: Any, to_org_id: Any, user_id: Any) -> tuple[str, UUID, UUID, UUID]:
    return parse_kind(kind), parse_id(item_id), parse_id(to_org_id), UUID(str(user_id))


async def preview_move(pool, *, user_id, kind, item_id, to_org_id) -> MovePreview:
    """What a move would do, and every reason it can't — READ-ONLY, nothing is locked or written.

    Raises ``MoveRefused`` for 422 (kind / id), 403 (membership) and 404 (not found / not yours);
    blockers come back as ``refusals`` with a 200.
    """
    k, item, dst, uid = _parse(kind, item_id, to_org_id, user_id)
    async with pool.acquire() as con:
        _items, preview = await _prepare(con, user_id=uid, kind=k, item_id=item, to_org_id=dst, lock=False)
    return preview


async def execute_move(pool, *, user_id, kind, item_id, to_org_id) -> MovePreview:
    """Move the item in ONE transaction with its audit row, or refuse and change nothing.

    Raises ``MoveRefused`` (409 on the first blocker found inside the transaction, including a
    blocker created since the preview; 403 / 404 / 422 as for ``preview_move``).
    """
    k, item, dst, uid = _parse(kind, item_id, to_org_id, user_id)
    preview: MovePreview | None = None
    async with pool.acquire() as con:
        try:
            async with con.transaction():
                items, preview = await _prepare(
                    con, user_id=uid, kind=k, item_id=item, to_org_id=dst, lock=True
                )
                if preview.refusals:
                    raise MoveRefused(preview.refusals[0], 409)
                await _apply(con, items, dst)
                await con.execute(
                    "INSERT INTO public.audit_log (user_id, action_type, metadata, org_id) "
                    "VALUES ($1, $2, $3::text::jsonb, $4)",
                    uid, AUDIT_ACTION, json.dumps(audit_metadata(preview)), items.source_org,
                )
        except MoveRefused:
            raise
        except asyncpg.UniqueViolationError as exc:
            # A same-content document reached the target org between the check and the write.
            logger.info("org_move: unique violation on %s %s: %s", k, item, exc)
            raise MoveRefused(
                s_collision_race(preview.to_org_name if preview else "that organization"), 409
            ) from exc
        except Exception as exc:
            if not is_hold_refusal(exc):
                raise
            # The database backstop (folders/documents_hold_identity_guard, PT409).
            raise MoveRefused(
                s_legal_hold(preview.item_name if preview else "This item",
                             preview.from_org_name if preview else "its organization"),
                409,
            ) from exc
    return preview



async def _apply(con, items: _Items, dst: UUID) -> None:
    """Every UPDATE of one move, on the transaction connection."""
    if items.kind == "draft":
        status = await con.execute(
            "UPDATE public.workflow_definitions SET org_id = $1 WHERE id = $2 AND status = 'draft' "
            "AND NOT is_system_global",
            dst, items.item_id,
        )
        if status != "UPDATE 1":
            raise MoveRefused(CHANGED.format(name=items.name), 409)
        return

    if items.kind == "folder":
        folder_ids = _ids(items.folders)
        await con.execute(
            "UPDATE public.folders SET org_id = $1, "
            "parent_id = CASE WHEN id = $2 THEN NULL ELSE parent_id END "
            "WHERE id = ANY($3::uuid[])",
            dst, items.item_id, folder_ids,
        )
    doc_ids = _ids(items.documents)
    if not doc_ids:
        return
    await con.execute(
        "UPDATE public.documents SET org_id = $1 WHERE id = ANY($2::uuid[])", dst, doc_ids
    )
    for table in DOCUMENT_CHILD_TABLES:
        await con.execute(
            f"UPDATE public.{table} SET org_id = $1 WHERE document_id = ANY($2::uuid[])",
            dst, doc_ids,
        )
    # Both ends move -> the link moves with them (a one-ended link is a refusal above).
    await con.execute(
        "UPDATE public.document_relationships SET org_id = $1 "
        "WHERE source_doc_id = ANY($2::uuid[]) AND target_doc_id = ANY($2::uuid[])",
        dst, doc_ids,
    )
