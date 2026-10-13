"""Phase 279 (SEAM-01 / D-01) — the expert-scope STATEMENT: the async reads, moved verbatim from
``app.services.expert_scope`` (PHASE_BASE ``a5a94ba67``; pinned by ``tests/unit/test_279_pure_move.py``).

⚠ 279: "this module" below now means THIS module; ``compose_expert_scope`` ("above") lives in the
pure ``app.services.expert_scope``, and ``build_expert_changed_event`` / ``event_sentence`` live in
``app.services.expert_scope_events``, which imports this module (never the reverse).

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
(``match_document_chunks``): ``is_latest = true`` and the ``retrievable`` column (migration 205),
queried on the USER-JWT client so the ``documents`` SELECT RLS policy — the same visibility predicate
retrieval applies — decides what is counted. Ingest status is NOT filtered: a document still ingesting
is "one of this chat's documents that will not be used" all the same. The D-267-20 DB check (267-05)
must use this identical predicate.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from uuid import UUID

from app.models.message import (
    ScopeFolderRef,
    TranscriptExpertRef,
    TranscriptFolderRef,
    TranscriptScopeLine,
)
from app.models.thread import ExpertScopePreview, ScopePreviewFolder, ScopePreviewThreadFolder
from app.services.expert_scope import ExpertScope, compose_expert_scope, folder_path
from app.services.expert_service import connection_states, get_expert_service, resolve_expert_bundle
from app.services.retrieval_scope import RETRIEVABLE_COLUMN
from app.utils.db import aexec
from app.utils.folder_utils import fetch_visible_folders

logger = logging.getLogger(__name__)


# ── Phase 267-02: the statement ──────────────────────────────────────────────────────────────────

_NAMED_LIMIT = 5


def _mode(raw: object) -> str:
    """The two scope modes ``compose_expert_scope`` distinguishes: anything not restricted is biased."""
    return "restricted" if raw == "restricted" else "biased"


async def _count_kb_documents(supabase, folder_ids) -> tuple[int, tuple[str, ...]]:
    """THE document predicate, written once: exact count + up to 5 filenames from ONE response.

    Latest, retrievable (mig 205), any ingest status — under the caller's RLS (user-JWT client).
    """
    ids = list(folder_ids)
    if not ids:
        return 0, ()
    resp = await aexec(
        supabase.table("documents")
        .select("id, filename", count="exact")
        .in_("folder_id", ids)
        .eq("is_latest", True)
        .eq(RETRIEVABLE_COLUMN, True)  # Phase 275 D-36: retrieval's own predicate, by name
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


def _scope_ref(ref: TranscriptFolderRef | None, path: str | None) -> ScopeFolderRef | None:
    if ref is None:
        return None
    return ScopeFolderRef(id=ref.id, name=ref.name, doc_count=ref.doc_count, path=path)


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
