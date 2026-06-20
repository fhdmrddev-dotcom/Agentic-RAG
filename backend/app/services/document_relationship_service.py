"""Typed-relationship data-access service (Phase 116, REL-01/03/04).

The data-access core behind the ``/document-relationships`` router (Plan 02) AND the
``get_related_documents`` agent tool (Plan 03). Cloned from ``document_view_service.py``
so the live-DB integration tests can drive create / delete / resolve directly against
:54322 without a FastAPI TestClient + JWT.

A relationship is a typed link between two documents — never a copy. It is inherently
user-owned (the ``document_relationships`` RLS is user-scoped ONLY, no ``is_global`` —
``migration 071:142-150``), so every read/write here is owner-scoped.

THE SHARED CORE — ``_resolve_readable_latest`` (RESEARCH Open Question 2, the 115
"one core, no fork" precedent): a single FastAPI-free helper that, given a
``document_id`` OR an EXACT ``filename``, returns the caller's LATEST ACCESSIBLE
version of that document (own ``is_latest=True`` ∪ global-folder ``is_latest=True``,
mirroring the live ``GET /documents`` access model at ``documents.py:535-561``) or
None. BOTH the create gate (Plan 02 — visible-both check) and the read tool (Plan 03
— leak-safe per-viewer masking) call it in-process, so there is no fork.

Security invariants:
  - ``_uid`` (T-116-01-02): copied VERBATIM from ``document_view_service.py:51`` — the
    UUID-coercion guard for any runtime value interpolated into a PostgREST ``.eq()`` /
    ``.or_()`` filter grammar. ``get_supabase()`` is the SERVICE-ROLE client (RLS
    bypassed) → these app predicates are the SOLE owner-scoping gate.
  - ``_resolve_readable_latest`` does EXACT own-or-global matching (T-116-01-04, D-116-3):
    it deliberately does NOT reuse the own-only + partial-``ilike`` filename lookup in
    ``retrieval_service`` (the documented probe-surface anti-pattern) — EXACT match +
    own-or-global only.
  - ``create_relationship`` catches the 23505 unique-violation (migration 075's additive
    partial index) and RE-FETCHES the existing edge (D-116-6 idempotent) — the
    ``documents.py:491-505`` pattern, but returning the existing row instead of raising
    409.
  - ``delete_relationship`` is own-scoped (``.eq("user_id", caller)``) → False on a
    cross-user miss → the router maps it to 404 (never 403, no existence leak).

Every Supabase query runs through ``aexec`` (``run_in_threadpool``) so an async caller
never blocks the event loop (D-v2.5-01) — there is no bare ``.execute`` call anywhere
in this module.
"""

from uuid import UUID

from supabase import Client

from app.dependencies import get_supabase
from app.utils.db import aexec
from app.utils.folder_utils import get_globally_visible_folder_ids

_TABLE = "document_relationships"


def _client(supabase: Client | None) -> Client:
    return supabase if supabase is not None else get_supabase()


def _uid(user_id) -> str:
    """Coerce ``user_id`` to a canonical UUID string before it is interpolated into a
    PostgREST ``.or_()`` / ``.eq()`` filter grammar (WR-02 hardening — copied verbatim
    from ``document_view_service.py``).

    ``user_id`` is the JWT-subject UUID from ``get_current_user`` and is not attacker-
    influenced today, but ``get_supabase()`` is the SERVICE-ROLE client (RLS bypassed)
    — these app-level predicates are the SOLE owner-scoping gate. Wrapping it in
    ``UUID(...)`` makes the one unparameterized runtime-value-into-DSL spot safe by
    construction: any value that is not a well-formed UUID raises ``ValueError``
    instead of breaking out of the ``user_id.eq.<...>`` term.
    """
    return str(UUID(str(user_id)))


async def _latest_by_filename(
    filename: str, caller, *, supabase: Client | None = None
) -> dict | None:
    """Return the caller-accessible LATEST-version doc row for an EXACT filename, else None.

    Own leg: ``documents WHERE user_id = caller AND filename ILIKE <exact> AND
    is_latest = True``. Global leg: the same exact filename in a globally-visible
    folder. EXACT match (no ``%..%`` superstring) — the probe-surface guard (D-116-3 /
    T-116-01-04). ``ILIKE`` without wildcards is a case-insensitive EXACT compare.
    """
    client = _client(supabase)

    # Own leg — caller's own latest version with this exact filename.
    own = await aexec(
        client.table("documents")
        .select("*")
        .eq("user_id", _uid(caller))
        .eq("is_latest", True)
        .ilike("filename", filename)  # no %..% → case-insensitive EXACT (D-116-3)
        .limit(1)
    )
    if own.data:
        return own.data[0]

    # Global leg — a globally-visible folder's latest version with this exact filename.
    global_folder_ids = await get_globally_visible_folder_ids(client, str(caller))
    if global_folder_ids:
        glob = await aexec(
            client.table("documents")
            .select("*")
            .in_("folder_id", global_folder_ids)
            .eq("is_latest", True)
            .ilike("filename", filename)
            .limit(1)
        )
        if glob.data:
            return glob.data[0]
    return None


async def _resolve_readable_latest(
    doc_id_or_filename: str,
    caller,
    *,
    by_filename: bool = False,
    supabase: Client | None = None,
) -> dict | None:
    """Resolve a document handle to the caller's LATEST ACCESSIBLE version, or None.

    The SHARED FastAPI-free core (RESEARCH Open Question 2). Called in-process by BOTH
    the create visible-both gate (Plan 02) and the leak-safe read tool (Plan 03), so
    there is no fork.

    Modes:
      * ``by_filename=False`` (default): ``doc_id_or_filename`` is a ``document_id``.
        Verify the caller can READ that id (own ``is_latest`` row ∪ a globally-visible
        folder's row), then map it to its LATEST version via ``(user_id, filename,
        is_latest=True)`` — so a creation-time id that is now an old version resolves
        forward to the current one (D-116-1a read-time follow-to-latest). An id the
        caller cannot read → None (no leak).
      * ``by_filename=True``: ``doc_id_or_filename`` is an EXACT filename →
        ``_latest_by_filename``.

    Returns the latest accessible ``documents`` row dict or None. Never raises on a miss
    (the calm-resolution contract). The own-only + partial-match filename lookup in
    ``retrieval_service`` is NOT reused (T-116-01-04 / D-116-3).

    Leak-safety invariant (CR-01 / gap-closure Plan 05): readable = own-latest ∪
    global-latest, exactly mirroring ``list_documents`` (``documents.py:540-561``). A
    global-leg match NEVER launders an old version into a PRIVATE latest — the global
    by-id leg is ``is_latest``-gated (so an old version in a global folder is not
    independently readable) AND the follow-to-latest target of a global match is
    re-verified to still sit in the caller's global-visible folder set before it is
    returned (so a latest that moved out of view → None).
    """
    if by_filename:
        return await _latest_by_filename(doc_id_or_filename, caller, supabase=supabase)

    client = _client(supabase)

    # Step 1 — can the caller READ this id at all? (own OR global-folder). We fetch the
    # row to learn its owner + filename. Track whether the match came from the GLOBAL leg
    # (vs the OWN leg) — the Step-2 visibility re-check below applies ONLY to the global
    # path (the caller always owns its own follow-to-latest target, user_id == caller).
    global_folder_ids: list[str] = []
    from_global = False
    own = await aexec(
        client.table("documents")
        .select("*")
        .eq("id", doc_id_or_filename)
        .eq("user_id", _uid(caller))
        .limit(1)
    )
    row = own.data[0] if own.data else None

    if row is None:
        # Not the caller's own — is it the LATEST version in a globally-visible folder?
        # An OLD version sitting in a global folder is NOT independently readable
        # (mirror ``_latest_by_filename:102`` and ``list_documents:558``), so the global
        # by-id leg is ``is_latest``-gated. (Fold-in IN-01 — the symmetric is_latest gate.)
        global_folder_ids = await get_globally_visible_folder_ids(client, str(caller))
        if global_folder_ids:
            glob = await aexec(
                client.table("documents")
                .select("*")
                .eq("id", doc_id_or_filename)
                .in_("folder_id", global_folder_ids)
                .eq("is_latest", True)
                .limit(1)
            )
            if glob.data:
                row = glob.data[0]
                from_global = True

    if row is None:
        return None  # unreadable / unknown id → None (no existence leak, no raise)

    # Step 2 — follow forward to the LATEST accessible version of the SAME document
    # (same owner + filename), so an old-version id resolves to the current row.
    if row.get("is_latest"):
        latest_row = row
    else:
        owner = row.get("user_id")
        fname = row.get("filename")
        if owner is None or fname is None:
            return row
        latest = await aexec(
            client.table("documents")
            .select("*")
            .eq("user_id", _uid(owner))
            .eq("filename", fname)
            .eq("is_latest", True)
            .limit(1)
        )
        latest_row = latest.data[0] if latest.data else row

    # Step 2b (CR-01 post-follow visibility re-check): when the source row matched via the
    # GLOBAL leg, the followed-to-latest row must ITSELF still be caller-visible — i.e. its
    # folder is still in the caller's global-visible set. If the latest moved OUT of view
    # (e.g. re-uploaded/moved into a private folder), return None so a non-owner can never
    # launder an old-global id into the owner's PRIVATE latest. The OWN leg needs no
    # re-check (the caller owns its follow-to-latest target across versions).
    if from_global and latest_row.get("folder_id") not in global_folder_ids:
        return None
    return latest_row


async def create_relationship(
    user_id,
    source_doc_id: str,
    target_doc_id: str,
    rel_type: str,
    supabase: Client | None = None,
) -> dict:
    """Insert a typed link owned by ``user_id``; idempotent via the 23505-catch (D-116-6).

    First identical ``(source, target, rel_type)`` inserts and returns the new row; a
    second identical create hits migration 075's partial unique index → 23505 →
    re-fetch and return the EXISTING edge (never a duplicate, never an error). A
    non-23505 exception re-raises.

    The visible-both readability gate lives in the ROUTER (Plan 02), BEFORE this call,
    so an unseeable endpoint never reaches the insert (the ordering-oracle guard).
    """
    client = _client(supabase)
    payload = {
        "user_id": str(user_id),
        "source_doc_id": source_doc_id,
        "target_doc_id": target_doc_id,
        "rel_type": rel_type,
    }
    try:
        result = await aexec(client.table(_TABLE).insert(payload))
        return result.data[0]
    except Exception as exc:  # noqa: BLE001 — supabase-py surfaces 23505 in the message
        if "23505" in str(exc):
            existing = await aexec(
                client.table(_TABLE)
                .select("*")
                .eq("user_id", _uid(user_id))
                .eq("source_doc_id", source_doc_id)
                .eq("target_doc_id", target_doc_id)
                .eq("rel_type", rel_type)
                .limit(1)
            )
            if existing.data:
                return existing.data[0]
        raise


async def delete_relationship(
    user_id, rel_id: str, supabase: Client | None = None
) -> bool:
    """Own-scoped delete; True if a row was removed, False on a cross-user/absent miss (→404)."""
    client = _client(supabase)
    result = await aexec(
        client.table(_TABLE)
        .delete()
        .eq("id", rel_id)
        .eq("user_id", str(user_id))
    )
    return bool(result.data)
