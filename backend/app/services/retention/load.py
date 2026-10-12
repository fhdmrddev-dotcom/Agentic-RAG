"""Phase 275 (RET-03 / SC#3 / D-34; RESEARCH Pattern 5) — the fail-closed read behind every evaluation.

``load_snapshot(pool, org_id)`` reads ONE org's documents, folders, policies, holds, skip markers and
queue rows in ONE ``REPEATABLE READ`` transaction (one snapshot, so the counts and the rows agree)
and turns them into the frozen facts ``evaluate`` needs.

⛔ INCOMPLETE MEANS NOTHING HAPPENS (SC#3). Any of these raises ``IncompleteEvaluation`` and the
caller disposes NOTHING for the org:
  * a row count that disagrees with the rows read (planning flag 8 — there is no "missing count,
    return what we have" branch here, unlike the Find reader this is modelled on);
  * a folder whose parent is outside the org's folder set, or a parent cycle;
  * a hold row that names a hold the org does not have;
  * any exception while reading.
It never returns partial data.

NOT incomplete (275-REVIEW B-WR-01 — one member must never be able to stop the org's retention):
  * a document whose folder is outside the org's folder set → THAT family is ``unreadable`` and
    the evaluator decides "can't be decided" for it alone;
  * a folder policy whose folder is outside the org → that policy governs nothing here and is
    recorded in ``OrgSnapshot.unreadable_policies``.

⛔ EVERY STATEMENT BINDS ``org_id = $1``. The pool is the service role (BYPASSRLS); the explicit org
predicate is the only wall between two orgs here (T-275-20).

D-34 — org-visible only. A family is org-visible through the org-shared folder arm (its folder or an
ancestor is ``is_org_shared``, walked here cycle-bounded) or the org-visible connection arm
(``public.connection_doc_is_visible``) of the documents SELECT policy. The owner arm alone is
PRIVATE: a member's private document is never archived, queued or deleted by a policy.

Families use the DISPOSITION key ``(user_id, filename, folder_id)`` — the existing delete-all key —
never the hold's wider ``(user_id, filename)`` key (Pitfall 9). Whether a family is held comes from
``public.retention_held_documents`` over EVERY row id, so a hold on any version holds the family.

asyncpg only; this module never touches the documents table through a client library.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from app.services.retention.evaluate import (
    EvalContext,
    FamilyFacts,
    PolicyFacts,
    QueueMarker,
    SkipMarker,
    Stage,
)

logger = logging.getLogger(__name__)


class IncompleteEvaluation(Exception):
    """The org could not be read completely, so nothing may be disposed for it."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


@dataclass
class OrgSnapshot:
    """One org, read in one snapshot."""

    org_id: str
    families: list[FamilyFacts]
    ctx: EvalContext
    #: policy id → facts / raw row (names, authors, timestamps).
    policies: dict[str, PolicyFacts]
    policy_rows: dict[str, dict]
    #: folder id → "/A/B" and the raw row.
    folder_paths: dict[str, str]
    folders: dict[str, dict]
    #: active holds of the org: hold id → row (name, reason, created_by_name, created_at).
    holds: dict[str, dict]
    #: family key → the active hold ids covering it; folder id → hold ids covering it directly.
    family_holds: dict[str, list[str]]
    folder_holds: dict[str, list[str]]
    #: document id → its family key; family key → the latest row (user_id, filename, folder_id …).
    doc_family: dict[str, str]
    family_latest: dict[str, dict]
    queue_rows: list[dict] = field(default_factory=list)
    skip_rows: list[dict] = field(default_factory=list)
    #: policy id → why it governs nothing in this org (its folder left the org; B-WR-01).
    unreadable_policies: dict[str, str] = field(default_factory=dict)

    def family(self, key: str) -> Optional[FamilyFacts]:
        return self._by_key().get(key)

    def _by_key(self) -> dict[str, FamilyFacts]:
        cache = getattr(self, "_family_index", None)
        if cache is None:
            cache = {f.family_key: f for f in self.families}
            object.__setattr__(self, "_family_index", cache)
        return cache


def family_key_of(user_id: Any, folder_id: Any, filename: str) -> str:
    """The disposition family key. UUIDs are fixed-width, so the filename tail is unambiguous."""
    return f"{user_id}/{folder_id or '-'}/{filename}"


def policy_facts(row: dict) -> PolicyFacts:
    s2 = None
    if row.get("stage2_value") is not None:
        s2 = Stage(int(row["stage2_value"]), str(row.get("stage2_unit")), str(row.get("stage2_action")))
    return PolicyFacts(
        id=str(row["id"]),
        name=str(row["name"]),
        scope_kind=str(row["scope_kind"]),
        folder_id=str(row["folder_id"]) if row.get("folder_id") else None,
        include_subfolders=bool(row.get("include_subfolders", True)),
        document_type_norm=row.get("document_type_norm"),
        clock=str(row["clock"]),
        stage1=Stage(int(row["stage1_value"]), str(row["stage1_unit"]), str(row["stage1_action"])),
        stage2=s2,
        revision=int(row["revision"]),
        previewed_revision=int(row["previewed_revision"]) if row.get("previewed_revision") is not None else None,
    )


async def load_org(pool, org_id) -> tuple[list[FamilyFacts], EvalContext]:
    """The plan's signature: ``(families, ctx)`` for one org, or ``IncompleteEvaluation``."""
    snap = await load_snapshot(pool, org_id)
    return snap.families, snap.ctx


async def load_snapshot(pool, org_id, *, con=None) -> OrgSnapshot:
    """Read one org completely, or raise ``IncompleteEvaluation``.

    With ``con`` the read runs inside the caller's open transaction (the sweep reads and writes in
    one snapshot); otherwise a connection is acquired and a REPEATABLE READ transaction opened.
    """
    org = UUID(str(org_id))
    try:
        if con is not None:
            return await _load(con, org)
        async with pool.acquire() as c:
            async with c.transaction(isolation="repeatable_read", readonly=True):
                return await _load(c, org)
    except IncompleteEvaluation:
        raise
    except Exception as exc:  # any read failure is incomplete — never partial data
        logger.warning("retention load for org %s failed: %s", org_id, exc)
        raise IncompleteEvaluation(f"the read failed: {type(exc).__name__}") from exc


_FOLDERS_SQL = "SELECT id, parent_id, name, is_org_shared, user_id FROM public.folders WHERE org_id = $1"
_FOLDERS_COUNT_SQL = "SELECT count(*) FROM public.folders WHERE org_id = $1"
_DOCS_SQL = (
    "SELECT id, user_id, filename, file_path, folder_id, document_type_norm, date_typed, created_at, "
    "archived_at, archived_policy_id, archived_policy_name, is_latest, version_number, source_state, "
    "public.connection_doc_is_visible(source_connection_id, ingest_visibility) AS connection_visible "
    "FROM public.documents WHERE org_id = $1"
)
_DOCS_COUNT_SQL = "SELECT count(*) FROM public.documents WHERE org_id = $1"
_POLICIES_SQL = "SELECT * FROM public.retention_policies WHERE org_id = $1 ORDER BY created_at, id"
_HOLDS_SQL = (
    "SELECT id, name, reason, created_by_name, created_at FROM public.legal_holds "
    "WHERE org_id = $1 AND released_at IS NULL"
)
_HOLD_FOLDERS_SQL = (
    "SELECT lhf.folder_id, lhf.hold_id FROM public.legal_hold_folders lhf "
    "JOIN public.legal_holds h ON h.id = lhf.hold_id "
    "WHERE lhf.org_id = $1 AND h.org_id = $1 AND h.released_at IS NULL"
)
_HELD_SQL = "SELECT document_id, hold_id, held_since FROM public.retention_held_documents($1::uuid[])"
_SKIPS_SQL = (
    "SELECT policy_id, family_key, reason, policy_revision, fingerprint, actor_id, actor_name, created_at "
    "FROM public.retention_skips WHERE org_id = $1"
)
_QUEUE_SQL = (
    "SELECT id, policy_id, family_key, latest_document_id, kind, policy_revision, fingerprint, found_at "
    "FROM public.retention_queue WHERE org_id = $1"
)


async def _load(con, org: UUID) -> OrgSnapshot:
    org_id = str(org)

    # ── folders: complete, closed under parent, acyclic ──────────────────────────────────────
    folder_rows = [dict(r) for r in await con.fetch(_FOLDERS_SQL, org)]
    _expect_count(await con.fetchval(_FOLDERS_COUNT_SQL, org), len(folder_rows), "folders")
    folders = {str(r["id"]): r for r in folder_rows}
    parent: dict[str, Optional[str]] = {}
    for fid, r in folders.items():
        pid = str(r["parent_id"]) if r.get("parent_id") else None
        if pid is not None and pid not in folders:
            raise IncompleteEvaluation(f"folder {fid} has a parent outside the organization")
        parent[fid] = pid
    _assert_acyclic(parent)
    paths = {fid: _path(fid, parent, folders) for fid in folders}
    shared = {fid: _shared(fid, parent, folders) for fid in folders}

    # ── documents: complete; families by the disposition key ────────────────────────────────
    doc_rows = [dict(r) for r in await con.fetch(_DOCS_SQL, org)]
    _expect_count(await con.fetchval(_DOCS_COUNT_SQL, org), len(doc_rows), "documents")
    grouped: dict[str, list[dict]] = {}
    doc_family: dict[str, str] = {}
    stray_families: set[str] = set()
    for r in doc_rows:
        fid = str(r["folder_id"]) if r.get("folder_id") else None
        key = family_key_of(r["user_id"], fid, r["filename"])
        if fid is not None and fid not in folders:
            # 275-REVIEW B-WR-01: ONE document in another org's folder is that family's "can't be
            # decided" — never a reason to dispose nothing for the whole org, indefinitely.
            stray_families.add(key)
        grouped.setdefault(key, []).append(r)
        doc_family[str(r["id"])] = key

    # ── policies ────────────────────────────────────────────────────────────────────────────
    policy_rows = {str(r["id"]): dict(r) for r in await con.fetch(_POLICIES_SQL, org)}
    policies = {pid: policy_facts(r) for pid, r in policy_rows.items()}
    folder_policies: dict[str, PolicyFacts] = {}
    class_policies: dict[str, PolicyFacts] = {}
    unreadable_policies: dict[str, str] = {}
    for p in policies.values():
        if p.scope_kind == "folder":
            if not p.folder_id or p.folder_id not in folders:
                # 275-REVIEW B-WR-01: a folder policy whose folder left the org governs nothing
                # here (no document of this org can be in that folder and be decided), so it is
                # that POLICY's problem, recorded, never the whole org's. Migration 206 refuses
                # writing such a policy; a folder that moves org later is how one can still occur.
                unreadable_policies[p.id] = "its folder is outside the organization"
                logger.warning("retention: policy %s names a folder outside org %s", p.id, org_id)
                continue
            folder_policies[p.folder_id] = p
        elif p.scope_kind == "class" and p.document_type_norm:
            class_policies[p.document_type_norm] = p
        else:
            raise IncompleteEvaluation(f"policy “{p.name}” has no readable scope")

    # ── holds (active only), evaluated now through the ONE predicate ────────────────────────
    holds = {str(r["id"]): dict(r) for r in await con.fetch(_HOLDS_SQL, org)}
    folder_holds: dict[str, list[str]] = {}
    for r in await con.fetch(_HOLD_FOLDERS_SQL, org):
        folder_holds.setdefault(str(r["folder_id"]), []).append(str(r["hold_id"]))
    held_since: dict[str, Optional[datetime]] = {}
    family_holds: dict[str, list[str]] = {}
    if holds and doc_family:
        for r in await con.fetch(_HELD_SQL, [UUID(d) for d in doc_family]):
            hid = str(r["hold_id"])
            key = doc_family.get(str(r["document_id"]))
            if key is None:
                raise IncompleteEvaluation("a held document is outside the organization")
            since = r["held_since"]
            prev = held_since.get(key)
            held_since[key] = since if prev is None or (since is not None and since < prev) else prev
            if hid not in holds:
                # Migration 206 matches a hold to its coverage row's org, so a document sitting in
                # ANOTHER org's held folder is held by that org's matter. Fail closed: the family is
                # held (nothing happens to it) and the foreign matter is never named here (D-17).
                continue
            hl = family_holds.setdefault(key, [])
            if hid not in hl:
                hl.append(hid)

    # ── skip markers and queue rows ─────────────────────────────────────────────────────────
    skip_rows = [dict(r) for r in await con.fetch(_SKIPS_SQL, org)]
    skips = {
        (str(r["policy_id"]), str(r["family_key"])): SkipMarker(
            revision=int(r["policy_revision"]), fingerprint=str(r["fingerprint"]), reason=str(r["reason"]),
            actor_name=r.get("actor_name"), created_at=r.get("created_at"),
        )
        for r in skip_rows
    }
    queue_rows = [dict(r) for r in await con.fetch(_QUEUE_SQL, org)]
    pending = {
        (str(r["policy_id"]), str(r["family_key"]), str(r["kind"])): QueueMarker(
            revision=int(r["policy_revision"]), fingerprint=str(r["fingerprint"]),
        )
        for r in queue_rows
    }

    # ── the families ─────────────────────────────────────────────────────────────────────────
    families: list[FamilyFacts] = []
    family_latest: dict[str, dict] = {}
    for key, rows in grouped.items():
        latest = _latest(rows)
        family_latest[key] = latest
        fid = str(latest["folder_id"]) if latest.get("folder_id") else None
        # D-34 fail closed: every row must be org-visible for the family to be covered.
        visible = all((fid is not None and shared.get(fid, False)) or bool(r.get("connection_visible")) for r in rows)
        archived_row = next((r for r in sorted(rows, key=lambda x: not x.get("is_latest")) if r.get("archived_at")), None)
        families.append(FamilyFacts(
            family_key=key,
            latest_id=str(latest["id"]),
            row_ids=tuple(str(r["id"]) for r in rows),
            file_paths=tuple(str(r["file_path"]) for r in rows if r.get("file_path")),
            org_id=org_id,
            folder_id=fid,
            document_type_norm=latest.get("document_type_norm"),
            date_typed=latest.get("date_typed"),
            created_at=latest.get("created_at"),
            # 275-REVIEW B-WR-02: the LATEST row decides. A family whose newest version is not
            # archived reads as not archived, so the sweep archives the rest of it (D-25) instead
            # of reporting "Archived" while that version is still served to agents. Migration 206
            # makes a new version inherit the archive on insert; this heals rows from before it.
            archived_at=latest.get("archived_at"),
            org_visible=visible,
            name=str(latest.get("filename") or ""),
            archived_policy_id=str(archived_row["archived_policy_id"]) if archived_row and archived_row.get("archived_policy_id") else None,
            archived_policy_name=(archived_row or {}).get("archived_policy_name"),
            source_state=latest.get("source_state"),
            unreadable="its folder is outside the organization" if key in stray_families else None,
        ))

    ctx = EvalContext(
        folder_parent=parent,
        folder_policies=folder_policies,
        class_policies=class_policies,
        held=held_since,
        skips=skips,
        pending=pending,
    )
    return OrgSnapshot(
        org_id=org_id,
        families=families,
        ctx=ctx,
        policies=policies,
        policy_rows=policy_rows,
        folder_paths=paths,
        folders=folders,
        holds=holds,
        family_holds=family_holds,
        folder_holds=folder_holds,
        doc_family=doc_family,
        family_latest=family_latest,
        queue_rows=queue_rows,
        skip_rows=skip_rows,
        unreadable_policies=unreadable_policies,
    )


# ── helpers ─────────────────────────────────────────────────────────────────────────────────

def _expect_count(counted: Any, read: int, what: str) -> None:
    if not isinstance(counted, int) or isinstance(counted, bool):
        raise IncompleteEvaluation(f"the {what} count could not be read")
    if counted != read:
        raise IncompleteEvaluation(f"read {read} {what} of {counted}")


def _assert_acyclic(parent: dict[str, Optional[str]]) -> None:
    clear: set[str] = set()
    for start in parent:
        trail: list[str] = []
        seen: set[str] = set()
        cur: Optional[str] = start
        while cur is not None and cur not in clear:
            if cur in seen:
                raise IncompleteEvaluation(f"folder {cur} is part of a parent cycle")
            seen.add(cur)
            trail.append(cur)
            cur = parent.get(cur)
        clear.update(trail)


def _path(fid: str, parent: dict[str, Optional[str]], folders: dict[str, dict]) -> str:
    names: list[str] = []
    cur: Optional[str] = fid
    seen: set[str] = set()
    while cur is not None and cur not in seen:
        seen.add(cur)
        names.append(str(folders[cur].get("name") or ""))
        cur = parent.get(cur)
    return "/" + "/".join(reversed(names))


def _shared(fid: str, parent: dict[str, Optional[str]], folders: dict[str, dict]) -> bool:
    cur: Optional[str] = fid
    seen: set[str] = set()
    while cur is not None and cur not in seen:
        seen.add(cur)
        if folders[cur].get("is_org_shared"):
            return True
        cur = parent.get(cur)
    return False


def _latest(rows: list[dict]) -> dict:
    latest = [r for r in rows if r.get("is_latest")]
    pool = latest or rows
    return max(pool, key=lambda r: (int(r.get("version_number") or 0), str(r.get("created_at") or ""), str(r["id"])))
