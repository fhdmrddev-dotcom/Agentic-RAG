"""Phase 267 (D-267-17 / PACK-25) — the ONE composition of an Expert's knowledge scope.

Two readers depend on this module, and that is the whole point of it existing:

* the RUN — ``run_producer._resolve_thread_scoping`` hands ``effective_folder_ids`` and
  ``scoped_folder_path`` to the loop as data;
* the STATEMENT — the invite-dialog preview and the transcript event (267-02) tell the user which
  folders the Expert reads and which it will NOT read (``excluded_folder_ids``).

Because both read one function, the sentence a user is shown and the retrieval the run performs
cannot disagree. ⛔ Never re-derive a scope anywhere else; import this.

``compose_expert_scope`` is PURE: plain data in, a frozen value out. It performs no I/O, imports no
database or LLM client, and never raises. ``ExpertScopeUnavailable`` (a restricted Expert with zero
folders — 266 CR-01) stays in ``run_producer``, which is the caller that must refuse the run.

The body was MOVED byte-for-byte from ``run_producer.py:480-516`` (phase base ``785c03274``);
``tests/unit/test_267_expert_scope.py`` keeps a verbatim copy of the old branch and compares every
case against it.

⚠ MEASURED CHARACTERIZATION, MOVED UNCHANGED (D-267-35): a **BIASED** Expert on a thread with
**NO folder** narrows retrieval to the Expert's folders only — "biased" behaves as a filter there,
not a boost. This module preserves that exactly. It is stated to the user as
``Dropped: All your documents`` and routed to SEED-303 as an open arm (re-open trigger: the first
phase that gives "biased" real ranking semantics, after the SEED-224 retrieval extraction).

Plan 267-02 adds the one async helper that STATES a scope beside this function, so the run and the
statement share one module; the pure function stays separately testable.

── THE STATEMENT (267-02: D-267-11 / D-267-17..19 / PACK-23 / PACK-25) ────────────────────────────
``describe_expert_scope`` is the ONE async part of this module. It turns (thread folder, Expert) into
a ``ScopeStatement`` using ``resolve_expert_bundle`` (install-aware, access-checked folders),
``fetch_visible_folders`` (names + subtree), ``compose_expert_scope`` (above), ``connection_states``
(the one "is it connected" rule) and ONE documents query per counted folder set.
Its two readers are pure functions below it:

* ``scope_preview`` — the invite dialog's restricted-cost preview (GET /threads/expert-scope-preview);
* ``build_expert_changed_event`` — the transcript event rename_thread writes (plus ``event_sentence``
  for the NOT NULL ``content`` column).

So the preview, the event and the run all read one composition. ⛔ No LLM client, no agent loop.

⚠ THE DOCUMENT PREDICATE is written ONCE (``_count_kb_documents``) and is retrieval's own
(``match_document_chunks``): ``is_latest = true`` and ``source_state`` not ``source_disconnected``,
queried on the USER-JWT client so the ``documents`` SELECT RLS policy — the same visibility predicate
retrieval applies — decides what is counted. Ingest status is NOT filtered: a document still ingesting
is "one of this chat's documents that will not be used" all the same. The D-267-20 DB check (267-05)
must use this identical predicate.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from app.models.message import (
    ExpertChangedEvent,
    TranscriptExclusion,
    TranscriptExpertRef,
    TranscriptFolderRef,
    TranscriptScopeLine,
)
from app.models.thread import ExpertScopePreview, ScopePreviewFolder, ScopePreviewThreadFolder
from app.services.expert_service import connection_states, get_expert_service, resolve_expert_bundle
from app.utils.db import aexec
from app.utils.folder_utils import fetch_visible_folders

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ExpertScope:
    """The composed scope. Every tuple is sorted.

    ``excluded_folder_ids`` is the thread-folder subtree minus the Expert's folders, and is
    non-empty ONLY for a ``restricted`` Expert on a folder-scoped thread; ``()`` otherwise.
    """

    effective_folder_ids: tuple[str, ...]
    scoped_folder_path: str | None
    excluded_folder_ids: tuple[str, ...]


def compose_expert_scope(
    *,
    scope_mode: str,
    thread_folder_id: str | None,
    expert_folder_ids: list[str],
    visible_folders: list[dict],
) -> ExpertScope:
    """Compose an Expert's knowledge scope from plain data. Pure; never raises; no I/O.

    ``visible_folders`` is ``fetch_visible_folders(...)``'s result — the caller fetches it, so the
    SEED-124 visibility rule keeps its one home.

    - ``restricted``: the Expert's folders only. On a folder-scoped thread, the thread subtree
      minus the Expert's folders is reported as ``excluded_folder_ids``.
    - ``biased`` + a thread folder: the thread subtree ∪ the Expert's folders.
    - ``biased`` + no thread folder: the Expert's folders only (characterization, D-267-35).
    """
    all_folders = visible_folders
    folder_map = {str(f["id"]): f for f in all_folders}

    def _get_subtree(root_id: str) -> list[str]:
        res = [root_id]
        for f in all_folders:
            if str(f.get("parent_id") or "") == root_id:
                res.extend(_get_subtree(str(f["id"])))
        return res

    def _get_path(fid: str) -> str:
        parts = []
        curr: str | None = fid
        while curr:
            f = folder_map.get(curr)
            if not f:
                break
            parts.append(f.get("name", ""))
            curr = str(f["parent_id"]) if f.get("parent_id") else None
        return ("/" + "/".join(reversed(parts))) if parts else ""

    scoped_folder_path: str | None = None
    excluded_folder_ids: tuple[str, ...] = ()

    if scope_mode == "restricted":
        # Strict isolation (S5 / D-v4.3-01): exclusive to expert folders
        effective_folder_ids = tuple(sorted(set(expert_folder_ids)))
        if expert_folder_ids:
            scoped_folder_path = _get_path(expert_folder_ids[0]) or None
        if thread_folder_id:
            # D-267-17: what the thread's own folder would have given retrieval, and this
            # Expert will not read. Only ever a statement — the run above already reads
            # effective_folder_ids alone.
            excluded_folder_ids = tuple(
                sorted(set(_get_subtree(str(thread_folder_id))) - set(expert_folder_ids))
            )
    else:
        # Union Scope (default, S4 / D-v4.3-01): thread folder + expert folders
        if thread_folder_id:
            thread_subfolder_ids = _get_subtree(str(thread_folder_id))
            effective_folder_ids = tuple(sorted(set(thread_subfolder_ids).union(expert_folder_ids)))
            scoped_folder_path = _get_path(str(thread_folder_id)) or None
        else:
            effective_folder_ids = tuple(sorted(set(expert_folder_ids)))
            if expert_folder_ids:
                scoped_folder_path = _get_path(expert_folder_ids[0]) or None

    return ExpertScope(
        effective_folder_ids=effective_folder_ids,
        scoped_folder_path=scoped_folder_path,
        excluded_folder_ids=excluded_folder_ids,
    )


# ── Phase 267-02: the statement ──────────────────────────────────────────────────────────────────

# Retrieval's source-state predicate (match_document_chunks), in PostgREST ``or_`` form.
_NOT_SOURCE_DISCONNECTED = "source_state.is.null,source_state.neq.source_disconnected"
_NAMED_LIMIT = 5

# Shared plain-text vocabulary for ``event_sentence`` only. The UI renders from the payload through
# its own one-home module (expertEventCopy.ts); these words mirror UI-SPEC §7.3.
_UNNAMEABLE_FOLDER = "a knowledge folder you cannot see"
_ALL_DOCUMENTS = "All your documents"
_NOTHING = "Nothing"


def _mode(raw: object) -> str:
    """The two scope modes ``compose_expert_scope`` distinguishes: anything not restricted is biased."""
    return "restricted" if raw == "restricted" else "biased"


async def _count_kb_documents(supabase, folder_ids) -> tuple[int, tuple[str, ...]]:
    """THE document predicate, written once: exact count + up to 5 filenames from ONE response.

    Latest, not source-disconnected, any ingest status — under the caller's RLS (user-JWT client).
    """
    ids = list(folder_ids)
    if not ids:
        return 0, ()
    resp = await aexec(
        supabase.table("documents")
        .select("id, filename", count="exact")
        .in_("folder_id", ids)
        .eq("is_latest", True)
        .or_(_NOT_SOURCE_DISCONNECTED)
        .order("filename")
        .limit(_NAMED_LIMIT)
    )
    rows = (getattr(resp, "data", None) or []) if resp is not None else []
    count = getattr(resp, "count", None) if resp is not None else None
    if not isinstance(count, int):
        count = len(rows)
    names = tuple(str(r.get("filename") or "") for r in rows[:_NAMED_LIMIT])
    return count, names


@dataclass(frozen=True)
class ScopeStatement:
    """What one side of a thread reads — the ONE object the preview and the event are built from.

    ``expert`` None = a plain thread; then ``scope`` is the thread's own composition (its folder
    subtree, or nothing = all documents). ``thread_folder`` carries its KB ``doc_count``.
    ``readable`` False = an Expert the caller can no longer resolve (named, but reading nothing).
    """

    expert: TranscriptExpertRef | None
    scope: ExpertScope
    expert_folders: tuple[TranscriptFolderRef, ...] = ()
    thread_folder: TranscriptFolderRef | None = None
    excluded_count: int = 0
    excluded_names: tuple[str, ...] = ()
    connections: tuple[str, ...] = ()
    readable: bool = True

    def used(self) -> TranscriptScopeLine:
        """The knowledge (and connections) this side actually hands a run, as a generic line."""
        if self.expert is None:
            return TranscriptScopeLine(
                thread_folder=self.thread_folder,
                all_documents=self.thread_folder is None,
            )
        if not self.readable:
            return TranscriptScopeLine()
        if self.expert.scope_mode == "restricted":
            return TranscriptScopeLine(
                folders=list(self.expert_folders),
                connections=list(self.connections),
            )
        # biased: thread subtree ∪ Expert folders. With NO thread folder this narrows to the
        # Expert's folders (D-267-35) — and an empty composition reaches retrieval as no filter.
        return TranscriptScopeLine(
            folders=list(self.expert_folders),
            thread_folder=self.thread_folder,
            all_documents=not self.scope.effective_folder_ids,
            connections=list(self.connections),
        )

    def covers(self, folder_id: object) -> bool:
        if not self.readable:
            return False
        line = self.used()
        return line.all_documents or str(folder_id) in set(self.scope.effective_folder_ids)


async def describe_expert_scope(
    *,
    supabase,
    pool,
    user_id: str,
    org_id: str | None,
    caller_roles: list[str] | None,
    expert_id: str | None,
    thread_folder_id: str | None,
    allow_unresolved: bool = False,
) -> ScopeStatement:
    """State what a thread reads with ``expert_id`` active (None = no Expert).

    Raises ``LookupError`` when ``expert_id`` does not resolve for the caller — unless
    ``allow_unresolved`` (the BEFORE side of a change: an Expert whose access has since gone), in
    which case the Expert is named from its bundle row and stated as reading nothing.
    """
    thread_folder_id = str(thread_folder_id) if thread_folder_id else None
    visible: list[dict] = []
    if thread_folder_id or expert_id:
        try:
            visible = await fetch_visible_folders(supabase, str(user_id))
        except Exception:  # noqa: BLE001 — names degrade to "cannot see"; the statement still stands
            logger.warning("describe_expert_scope: visible folders unavailable", exc_info=True)
            visible = []
    names = {str(f.get("id")): f.get("name") for f in visible}

    # The thread's OWN scope, through the same composition: no Expert folders, biased = its subtree.
    thread_scope = compose_expert_scope(
        scope_mode="biased",
        thread_folder_id=thread_folder_id,
        expert_folder_ids=[],
        visible_folders=visible,
    )
    thread_ref: TranscriptFolderRef | None = None
    thread_counted: tuple[int, tuple[str, ...]] | None = None
    if thread_folder_id:
        thread_counted = await _count_kb_documents(supabase, thread_scope.effective_folder_ids)
        thread_ref = TranscriptFolderRef(
            id=UUID(thread_folder_id),
            name=names.get(thread_folder_id),
            doc_count=thread_counted[0],
        )

    if not expert_id:
        return ScopeStatement(expert=None, scope=thread_scope, thread_folder=thread_ref)

    org_uuid = UUID(str(org_id)) if org_id else None
    resolved = await resolve_expert_bundle(
        pool=pool,
        bundle_id=UUID(str(expert_id)),
        caller_org_id=org_uuid,
        caller_user_id=UUID(str(user_id)),
        caller_roles=list(caller_roles or []),
    )
    if resolved is None:
        if allow_unresolved:
            bundle = await get_expert_service(pool=pool, bundle_id=UUID(str(expert_id)), caller_org_id=org_uuid)
            if bundle:
                return ScopeStatement(
                    expert=TranscriptExpertRef(
                        id=UUID(str(expert_id)),
                        name=str(bundle.get("name") or ""),
                        scope_mode=_mode(bundle.get("scope_mode")),
                    ),
                    scope=ExpertScope(effective_folder_ids=(), scoped_folder_path=None, excluded_folder_ids=()),
                    thread_folder=thread_ref,
                    readable=False,
                )
        raise LookupError("Expert bundle not found or access denied")

    mode = _mode(resolved.scope_mode)
    expert_folder_ids = [str(f) for f in resolved.effective_folder_ids]
    scope = compose_expert_scope(
        scope_mode=mode,
        thread_folder_id=thread_folder_id,
        expert_folder_ids=expert_folder_ids,
        visible_folders=visible,
    )

    excluded_count, excluded_names = 0, ()
    if scope.excluded_folder_ids:
        if thread_counted is not None and set(scope.excluded_folder_ids) == set(thread_scope.effective_folder_ids):
            excluded_count, excluded_names = thread_counted  # the same folder set: the same response
        else:
            excluded_count, excluded_names = await _count_kb_documents(supabase, scope.excluded_folder_ids)

    states = await connection_states(pool, org_uuid, list(resolved.effective_connections))
    return ScopeStatement(
        expert=TranscriptExpertRef(id=resolved.bundle_id, name=resolved.name, scope_mode=mode),
        scope=scope,
        expert_folders=tuple(TranscriptFolderRef(id=UUID(f), name=names.get(f)) for f in expert_folder_ids),
        thread_folder=thread_ref,
        excluded_count=excluded_count,
        excluded_names=excluded_names,
        connections=tuple(s.name for s in states if s.connected),
    )


def build_expert_changed_event(before: ScopeStatement, after: ScopeStatement, *, at: datetime) -> ExpertChangedEvent:
    """Pure: ``now`` = what the next turn reads; ``dropped`` = what the previous turn read and the
    next will not. Every name comes from the two statements (snapshotted at write time)."""
    now = after.used()
    prev = before.used()
    dropped = TranscriptScopeLine(
        folders=[f for f in prev.folders if not after.covers(f.id)],
        thread_folder=(
            prev.thread_folder
            if prev.thread_folder is not None and not after.covers(prev.thread_folder.id)
            else None
        ),
        all_documents=prev.all_documents and not now.all_documents,
        connections=[c for c in prev.connections if c not in now.connections],
    )
    excluded = None
    if after.expert is not None and after.expert.scope_mode == "restricted" and after.excluded_count > 0:
        excluded = TranscriptExclusion(count=after.excluded_count, names=list(after.excluded_names))
    return ExpertChangedEvent(
        at=at,
        before=before.expert,
        after=after.expert,
        now=now,
        dropped=dropped,
        excluded=excluded,
    )


def _line_items(line: TranscriptScopeLine) -> list[str]:
    items = [f.name or _UNNAMEABLE_FOLDER for f in line.folders]
    if line.thread_folder is not None:
        tf = line.thread_folder
        label = f"/{tf.name or _UNNAMEABLE_FOLDER}"
        items.append(f"{label} ({tf.doc_count})" if tf.doc_count is not None else label)
    if line.all_documents:
        items.append(_ALL_DOCUMENTS)
    items.extend(line.connections)
    return items


def event_sentence(event: ExpertChangedEvent) -> str:
    """The plain-text ``messages.content`` of an event row (NOT NULL). Rendered from the payload."""
    b = event.before.name if event.before else None
    a = event.after.name if event.after else None
    if b and a:
        header = f"{b} → {a}"
    elif a:
        header = f"{a} joined"
    elif b:
        header = f"{b} left"
    else:
        header = "Expert changed"
    now = ", ".join(_line_items(event.now)) or _NOTHING
    dropped = ", ".join(_line_items(event.dropped)) or _NOTHING
    return f"{header}. Now: {now}. Dropped: {dropped}."


def scope_preview(statement: ScopeStatement) -> ExpertScopePreview:
    """Pure: the invite dialog's preview of one Expert, from the one statement."""
    if statement.expert is None:
        raise ValueError("a scope preview needs an Expert")
    tf = statement.thread_folder
    return ExpertScopePreview(
        expert_id=statement.expert.id,
        expert_name=statement.expert.name,
        mode=statement.expert.scope_mode,
        expert_folders=[ScopePreviewFolder(id=f.id, name=f.name) for f in statement.expert_folders],
        thread_folder=(
            ScopePreviewThreadFolder(id=tf.id, name=tf.name, doc_count=tf.doc_count or 0)
            if tf is not None and tf.id is not None
            else None
        ),
        excluded_count=statement.excluded_count,
        excluded_names=list(statement.excluded_names),
    )
