"""Phase 279 (SEAM-01 / D-01) — the expert-scope TRANSCRIPT WORDING plus its ONE writer, moved
verbatim from ``app.services.expert_scope`` (PHASE_BASE ``a5a94ba67``; pinned by
``tests/unit/test_279_pure_move.py``).

It holds the pure payload builders (``build_expert_changed_event``, ``build_scope_effect``,
``build_scope_changed_event``), the plain-text sentences for the NOT NULL ``messages.content``
column (``event_sentence``, ``scope_event_sentence``) and their labels — plus
``insert_expert_changed_row`` (async DB I/O), which must sit beside ``event_sentence``. So this
module is "wording plus its one writer", NOT pure. It imports the statement module
(``ScopeStatement``, ``_scope_ref``); the statement module never imports this one (D-01: no cycle).
"""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from app.models.message import (
    ExpertChangedEvent,
    ScopeChangedEvent,
    ScopeFolderRef,
    ScopeTranscriptLine,
    TranscriptExclusion,
    TranscriptScopeLine,
)
from app.models.thread import ScopeEffect
from app.services.expert_scope_statement import ScopeStatement, _scope_ref

# Shared plain-text vocabulary for ``event_sentence`` only. The UI renders from the payload through
# its own one-home module (expertEventCopy.ts); these words mirror UI-SPEC §7.3.
_UNNAMEABLE_FOLDER = "a knowledge folder you cannot see"
_ALL_DOCUMENTS = "All your documents"
_NOTHING = "Nothing"


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
    # 279-02 D-07 (SEED-328 drive note): the exclusion is a DROP only if the previous side read the
    # thread folder (or everything). Restricted → restricted on a folder-scoped thread used to state
    # the thread folder's documents as newly lost, though the previous Expert never read them either.
    # ``_dropped_line`` is unchanged (268's ``stops`` shares it).
    # ⚠ CORRECTED 2026-10-14 (279-REVIEW WR-03): that was a yes/no switch, not "computed against the
    # previous side's effective scope". A previous RESTRICTED Expert never reports a thread folder, so
    # every restricted → restricted swap lost the line — including one whose previous Expert DID read
    # part of what is now excluded. The previous side's effective folders overlapping the new
    # exclusion now keep it (pure set arithmetic on the two statements; no I/O).
    prev = before.used()
    if (
        after.expert is not None
        and after.expert.scope_mode == "restricted"
        and after.excluded_count > 0
        and (
            prev.all_documents
            or prev.thread_folder is not None
            or bool(set(before.scope.effective_folder_ids) & set(after.scope.excluded_folder_ids))
        )
    ):
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
