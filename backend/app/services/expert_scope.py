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
    ScopeChangedEvent,
    ScopeFolderRef,
    ScopeTranscriptLine,
    TranscriptExclusion,
    TranscriptExpertRef,
    TranscriptFolderRef,
    TranscriptScopeLine,
)
from app.models.thread import ExpertScopePreview, ScopeEffect, ScopePreviewFolder, ScopePreviewThreadFolder
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
        # ⚠ CORRECTED 2026-09-29 (267-REVIEW-INDEPENDENT CR-02): that clause was FALSE when written —
        # `()` reached the tool_dispatcher folder wall as `[]` and every hit was dropped. It is true
        # since `run_producer._resolve_thread_scoping` hands an empty composition on as `None`.
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


def _dropped_line(before: ScopeStatement, after: ScopeStatement) -> TranscriptScopeLine:
    """Pure: what ``before`` read and ``after`` will not. The ONE ``dropped`` computation — 267's
    Expert event and 268's scope event (``stops``) both call it, so the two can never disagree about
    what a change stops searching. Extracted verbatim; 267's fixture byte-equality is the guard."""
    now = after.used()
    prev = before.used()
    return TranscriptScopeLine(
        folders=[f for f in prev.folders if not after.covers(f.id)],
        thread_folder=(
            prev.thread_folder
            if prev.thread_folder is not None and not after.covers(prev.thread_folder.id)
            else None
        ),
        all_documents=prev.all_documents and not now.all_documents,
        connections=[c for c in prev.connections if c not in now.connections],
    )


def build_expert_changed_event(before: ScopeStatement, after: ScopeStatement, *, at: datetime) -> ExpertChangedEvent:
    """Pure: ``now`` = what the next turn reads; ``dropped`` = what the previous turn read and the
    next will not. Every name comes from the two statements (snapshotted at write time)."""
    now = after.used()
    dropped = _dropped_line(before, after)
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


async def insert_expert_changed_row(conn, *, thread_id, user_id, org_id, event: ExpertChangedEvent) -> None:
    """THE one writer of an ``expert_changed`` transcript row (267-REVIEW-INDEPENDENT CR-03).

    Two callers, one row shape: ``PATCH /threads/{id}`` (inside its user-JWT transaction, beside the
    UPDATE) and ``run_producer._resolve_thread_scoping`` when it clears an Expert the caller can no
    longer resolve. ``org_id`` is the THREAD's own org, set explicitly (D-267-34 — the messages autofill
    trigger takes ``org_members … LIMIT 1``). ``tool_calls`` is a plain list: the pool's jsonb codec
    encodes it (a pre-dumped string would be double-encoded).
    """
    await conn.execute(
        "INSERT INTO public.messages (thread_id, user_id, org_id, role, content, tool_calls) "
        "VALUES ($1::uuid, $2::uuid, $3::uuid, 'system', $4, $5::jsonb)",
        UUID(str(thread_id)),
        UUID(str(user_id)),
        UUID(str(org_id)),
        event_sentence(event),
        [event.model_dump(mode="json")],
    )


def _line_items(line: TranscriptScopeLine, *, all_label: str = _ALL_DOCUMENTS) -> list[str]:
    items = [f.name or _UNNAMEABLE_FOLDER for f in line.folders]
    if line.thread_folder is not None:
        tf = line.thread_folder
        # 268: a scope ref carries its full ``path``; a 267 ref has no such attribute (unchanged).
        label = f"/{getattr(tf, 'path', None) or tf.name or _UNNAMEABLE_FOLDER}"
        items.append(f"{label} ({tf.doc_count})" if tf.doc_count is not None else label)
    if line.all_documents:
        items.append(all_label)
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


# ── Phase 268 (D-268-12 / D-268-12c / D-268-25 / CHAT-08): a live thread's folder scope changes ──
#
# ONE payload for three renderings — the composer chip, the picker ledger and the transcript card —
# built from two ``describe_expert_scope`` statements (the same statement the Expert event, the
# invite preview and the run read). ``held`` is decided HERE, never by a client (D-267-11).

# "Dropped: All other documents" — moving from no folder to a folder (UI-SPEC §7.3).
_ALL_OTHER_DOCUMENTS = "All other documents"


def folder_path(folder_id: object, visible_folders: list[dict]) -> str | None:
    """A folder's full path without the leading slash (``"Client ACME/Q3 Contracts"``); None when
    the caller cannot see it. A REUSE of ``compose_expert_scope``'s own path walk — never a second
    tree derivation."""
    if not folder_id:
        return None
    path = compose_expert_scope(
        scope_mode="biased",
        thread_folder_id=str(folder_id),
        expert_folder_ids=[],
        visible_folders=visible_folders,
    ).scoped_folder_path
    return (path.lstrip("/") or None) if path else None


def _scope_ref(ref: TranscriptFolderRef | None, path: str | None) -> ScopeFolderRef | None:
    if ref is None:
        return None
    return ScopeFolderRef(id=ref.id, name=ref.name, doc_count=ref.doc_count, path=path)


def _scope_line(line: TranscriptScopeLine, refs: dict[str, ScopeFolderRef]) -> ScopeTranscriptLine:
    """A generic line re-typed so its thread folder carries its snapshotted path (Pitfall 11)."""
    tf = line.thread_folder
    thread_folder = None
    if tf is not None:
        thread_folder = refs.get(str(tf.id)) or _scope_ref(tf, None)
    return ScopeTranscriptLine(
        folders=list(line.folders),
        thread_folder=thread_folder,
        all_documents=line.all_documents,
        connections=list(line.connections),
    )


def build_scope_effect(
    before: ScopeStatement,
    after: ScopeStatement,
    *,
    from_ref: ScopeFolderRef | None,
    to_ref: ScopeFolderRef | None,
) -> ScopeEffect:
    """Pure: what the NEXT message searches if the thread's folder goes ``before`` → ``after``.

    ``held`` = a Restricted Expert is active, so the thread folder is saved but not searched (Save &
    say). ``next`` = ``after.used()``; ``stops`` = the shared ``_dropped_line`` (empty when widening);
    ``saved`` = the draft folder, only when held.
    """
    refs = {str(r.id): r for r in (from_ref, to_ref) if r is not None and r.id is not None}
    held = after.expert is not None and after.expert.scope_mode == "restricted"
    return ScopeEffect(
        held=held,
        expert=after.expert,
        next=_scope_line(after.used(), refs),
        stops=_scope_line(_dropped_line(before, after), refs),
        saved=to_ref if held else None,
    )


def build_scope_changed_event(
    before: ScopeStatement,
    after: ScopeStatement,
    *,
    at: datetime,
    during_run: bool,
    from_ref: ScopeFolderRef | None,
    to_ref: ScopeFolderRef | None,
) -> ScopeChangedEvent:
    """Pure: the ``scope_changed`` transcript payload — the ScopeEffect SNAPSHOTTED at write time,
    plus where it came from, where it went and whether an answer was streaming (Pitfall 4)."""
    effect = build_scope_effect(before, after, from_ref=from_ref, to_ref=to_ref)
    return ScopeChangedEvent(
        at=at,
        from_folder=from_ref,
        to_folder=to_ref,
        expert=effect.expert,
        held=effect.held,
        now=effect.next,
        dropped=effect.stops,
        saved=effect.saved,
        during_run=during_run,
    )


def _folder_label(ref: ScopeFolderRef | None) -> str:
    if ref is None:
        return _ALL_DOCUMENTS
    if ref.path or ref.name:
        return f"/{ref.path or ref.name}"
    return _UNNAMEABLE_FOLDER


def scope_event_sentence(event: ScopeChangedEvent) -> str:
    """The plain-text ``messages.content`` of a scope event row (NOT NULL). Rendered from the payload."""
    from_label = _folder_label(event.from_folder)
    header = f"Scope {from_label} → {_folder_label(event.to_folder)}"
    if event.held and event.expert is not None:
        folders = " · ".join(f.name or _UNNAMEABLE_FOLDER for f in event.now.folders) or _NOTHING
        name = event.expert.name
        return (
            f"{header}. Saved: {_folder_label(event.saved)}. "
            f"Searching: {folders} only · {name} is Restricted. Takes effect when {name} leaves."
        )
    now = ", ".join(_line_items(event.now)) or _NOTHING
    dropped = ", ".join(_line_items(event.dropped, all_label=_ALL_OTHER_DOCUMENTS)) or _NOTHING
    sentence = f"{header}. Now: {now}. Dropped: {dropped}."
    if event.during_run:
        sentence += f" The answer in progress keeps {from_label}."
    return sentence


async def describe_scope_change(
    *,
    supabase,
    pool,
    user_id: str,
    org_id: str | None,
    caller_roles: list[str] | None,
    expert_id: str | None,
    from_folder_id: str | None,
    to_folder_id: str | None,
) -> tuple[ScopeStatement, ScopeStatement, ScopeFolderRef | None, ScopeFolderRef | None]:
    """The ONE async part of a scope change: ``(before, after, from_ref, to_ref)``.

    Two ``describe_expert_scope`` statements with the thread's active Expert (one when ``from ==
    to``: the at-rest effect), then one ``fetch_visible_folders`` for the two paths.

    Both sides are stated with ``allow_unresolved=True``: the Expert is the SAME on both sides of a
    folder change, so an Expert whose access has gone is named and stated as reading nothing rather
    than blocking the change (the run refuses it anyway, fail-closed). An Expert that no longer
    exists at all (``LookupError``) cannot be named truthfully, so the thread is stated alone and a
    warning is logged — a folder change is never blocked by it.
    """
    from_id = str(from_folder_id) if from_folder_id else None
    to_id = str(to_folder_id) if to_folder_id else None
    common = dict(supabase=supabase, pool=pool, user_id=user_id, org_id=org_id, caller_roles=caller_roles)

    async def _pair(expert: str | None) -> tuple[ScopeStatement, ScopeStatement]:
        before = await describe_expert_scope(
            expert_id=expert, thread_folder_id=from_id, allow_unresolved=True, **common
        )
        if to_id == from_id:
            return before, before
        after = await describe_expert_scope(
            expert_id=expert, thread_folder_id=to_id, allow_unresolved=True, **common
        )
        return before, after

    try:
        before, after = await _pair(expert_id)
    except LookupError:
        logger.warning("scope change: the thread's Expert could not be named; stating the thread alone")
        before, after = await _pair(None)

    visible: list[dict] = []
    if from_id or to_id:
        try:
            visible = await fetch_visible_folders(supabase, str(user_id))
        except Exception:  # noqa: BLE001 — a path is presentation; the name still stands
            logger.warning("describe_scope_change: visible folders unavailable", exc_info=True)
    return (
        before,
        after,
        _scope_ref(before.thread_folder, folder_path(from_id, visible)),
        _scope_ref(after.thread_folder, folder_path(to_id, visible)),
    )


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
