"""Typed-relationship CRUD router (Phase 116, REL-01 create / REL-03 remove).

The thin REST write surface the Phase 117 relationship panel consumes (D-116-8). It
turns the inert Plan 01 ``document_relationship_service`` into a live, leak-safe API:

  - ``POST ""`` — the VISIBLE-BOTH gate (D-116-5) → idempotent persist → a
    fire-and-forget ``relationship.create`` audit row (DMF-01). Cloned from
    ``api/document_views.py:create_view`` (the validation-gate-then-service-then-audit
    shape).

  - ``DELETE /{relationship_id}`` — own-scoped (``delete_relationship`` filters
    ``.eq("user_id", caller)``) → a cross-user/absent id collapses to a uniform 404,
    NEVER a forbidden status — no existence leak (cloned from
    ``document_views.py:delete_view``). Unlike
    ``document_views`` DELETE (which writes no audit), this fires a
    ``relationship.delete`` governance row AFTER a successful remove (D-116-12).

Safety invariants composed here (the threat register, 116-02-PLAN.md):

  - The VISIBLE-BOTH gate (T-116-02-01, probe-by-link): ``_resolve_readable_latest`` is
    called on BOTH ``source_doc_id`` AND ``target_doc_id`` BEFORE any persist. If EITHER
    endpoint is unreadable by the caller, a UNIFORM 422 is raised — the detail never
    names WHICH endpoint failed, and the readability check runs BEFORE the
    self-link/CHECK consideration, so an unseeable id and a self-link collapse to the
    SAME 422 code (no ordering oracle — mirrors the ``document_views.py:154-162``
    ownership-before-validation ordering, Pitfall 4). A probe cannot distinguish
    "this id exists but you can't see it" from "this id doesn't exist" from "self-link".

  - The self-link guard (CHECK ``no_self_rel`` at migration 071:66): ``source ==
    target`` → 422. The Pydantic model does NOT reject this (both are free ``str``),
    so the router checks it explicitly AFTER the visible-both gate; a ``no_self_rel``
    CHECK violation that surfaces from the DB (defense-in-depth) also maps to 422.

  - The forged ``rel_type`` (T-116-02-03): rejected at parse by the ``RelationshipCreate``
    ``Literal`` (Plan 01) → 422 before this handler runs; the DB CHECK is
    defense-in-depth.

  - Duplicate edges (T-116-02-05): ``create_relationship`` returns the EXISTING edge on
    a unique-violation (the 23505-catch, D-116-6) — one row, no 409, no duplicate. The
    race-immune backstop is migration 075's additive partial unique index (Plan 04
    applies it; until then the app-code SELECT-then-INSERT is the guarantee).

  - Read-time follow-to-latest (D-116-1a mechanism (a)): the STORED ``source_doc_id`` /
    ``target_doc_id`` are creation-time ids; the follow-to-latest happens at READ time
    inside ``_resolve_readable_latest``, never on write. This router does NOT touch
    ``documents.py`` (no re-point hook — mechanism (a)).

Per the 111/112/113 precedent: NO ``document_management_enabled`` feature gate is added
here — the gate lives at the UI surface (Phase 117). ``threads.py`` is NOT touched (G-5
— this phase is REST + tool only, never the shared SSE/agent-loop path).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from app.dependencies import get_current_user, get_user_supabase_client
from app.models.document_relationship import RelationshipCreate, RelationshipResponse
from app.services import document_relationship_service
from app.services.audit_service import write_audit_entry

router = APIRouter(prefix="/document-relationships", tags=["document-relationships"])

# The uniform rejection detail for the visible-both gate AND the self-link guard. Both
# collapse to ONE message so a probe cannot distinguish "unseeable endpoint" from
# "self-link" by error shape (T-116-02-01 — no ordering oracle).
_INVALID_LINK_DETAIL = "Both documents must be readable and distinct"


@router.get("")
async def get_relationships(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    """Read a document's outgoing + incoming typed links (REL-02 / D-117-7).

    The net-new REST read seam the Phase 117 relationship PANEL consumes (the panel
    cannot call an agent tool). It is a THIN wrapper — auth → the SHARED leak-safe read
    core → the plain dict — and deliberately re-implements NOTHING (the "share, do NOT
    fork" invariant, mirroring how ``document_views.py:resolve_view`` wraps the shared
    ``resolve_filter``; ``test_117_no_fork.py`` is the guard against drift):

      1. ``Depends(get_current_user)`` (JWT) scopes from the CALLER (``current_user["id"]``),
         NEVER the subject/edge owner (T-117-02-05 / SC#1). No net-new auth.
      2. Delegate to ``document_relationship_service.get_related_documents`` (Plan 01) — the
         ONE leak-safe outgoing+incoming traversal: subject resolve (the sole access gate),
         edge queries over the subject's full ``(user_id, filename)`` version set
         (follow-to-latest), per-endpoint caller-readability re-check → an unreadable endpoint
         is masked (``document_id: None`` + the no-access mask string the SERVICE owns,
         D-117-8). The shared fn already rides ``aexec``/``run_in_threadpool`` for every query
         (D-v2.5-01), so this route adds NO bare supabase call (T-117-02-04).
      3. A ``None`` return (unreadable / unknown subject) maps to a UNIFORM 404 — never a
         403, never a 200-with-partial-leak — so the route is no existence-probe oracle
         (T-117-02-03, mirrors ``resolve_view``'s 404-not-403). Otherwise return the plain
         dict directly: NO ``response_model`` (the 112 CR-01 lesson — a tight response_model
         would strip ``direction``/``label``/``relationship_id``/the masked rows).

    Writes NO audit row: ``audit_service.VALID_ACTION_TYPES`` has only the create/delete
    relationship action types — there is no read action type, and reads are not audited
    (mirrors ``resolve_view``, which writes no audit). ``threads.py`` is untouched (G-5).
    """
    caller = current_user["id"]
    try:
        result = await document_relationship_service.get_related_documents(
            caller, document_id=document_id, supabase=supabase
        )
    except Exception:  # noqa: BLE001 — WR-01
        # A malformed (non-UUID) document_id makes PostgREST raise 22P02 →
        # supabase-py APIError, and aexec (utils/db.py) does NOT catch it, so the
        # bare call would surface as an unhandled 500. A 500 is BOTH a robustness
        # bug AND an existence oracle (malformed→500 is distinguishable from
        # well-formed-unknown→404). Collapse ANY resolve/traversal failure to the
        # SAME uniform 404 the unknown-subject path uses below, so the route stays a
        # non-oracle and matches the agent-tool caller's catch-everything posture
        # (tool_dispatcher._handle_get_related_documents). The route — NOT the shared
        # service fn — owns this mapping (D-117-7: shared read core, per-caller
        # error→response mapping).
        raise HTTPException(status_code=404, detail="Document not found")
    if result is None:
        # Uniform 404 on an unreadable/unknown subject — no existence leak, no 403, no
        # 200-with-partial-leak (T-117-02-03; mirrors document_views.py:resolve_view).
        raise HTTPException(status_code=404, detail="Document not found")
    return result


@router.post("", response_model=RelationshipResponse, status_code=status.HTTP_201_CREATED)
async def create_relationship(
    body: RelationshipCreate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    """Create a typed link between two caller-readable documents (REL-01).

    Order (no ordering oracle — D-116-5 / T-116-02-01):
      1. VISIBLE-BOTH gate FIRST: resolve BOTH endpoints from the CALLER; either
         unreadable → uniform 422 (BEFORE the self-link/CHECK consideration).
      2. Self-link guard: source == target → the SAME uniform 422. (Both branches return
         the identical status+detail, so the RESPONSE carries no ordering oracle; step 2
         specifically rejects the READABLE self-link — it is NOT dead code: WR-04.)
      3. Idempotent persist (the 23505-catch returns the existing edge).
      4. Write the ``relationship.create`` governance receipt (DMF-01) — a BLOCKING
         (error-swallowing) audit write on the response path, not fire-and-forget (WR-03).
    """
    caller = current_user["id"]

    # 1. VISIBLE-BOTH gate (D-116-5 / T-116-02-01). Resolve BOTH endpoints from the
    #    CALLER (own ∪ globally-visible-folder, latest version). If EITHER returns None,
    #    the caller cannot see that endpoint → a UNIFORM 422 that names neither which
    #    endpoint nor why (no probe-by-link existence oracle). Both this branch AND the
    #    step-2 self-link branch return the identical status+detail, so the RESPONSE
    #    carries no ordering oracle (a probe can't distinguish unseeable-endpoint from
    #    self-link by error shape — mirrors document_views.py:154-162).
    #    A malformed (non-UUID) endpoint id makes _resolve_readable_latest's
    #    PostgREST query raise 22P02 → APIError (aexec does not catch it), which
    #    runs BEFORE the None-gate below and would surface as a 500 (WR-01). Collapse
    #    that to the SAME uniform 422 + identical detail the unseeable/self-link/forged
    #    paths use, so a malformed body value carries no oracle either. Lower risk than
    #    the GET path (the panel always sends real ids) but kept uniform for
    #    consistency.
    try:
        source_doc = await document_relationship_service._resolve_readable_latest(
            body.source_doc_id, caller, supabase=supabase
        )
        target_doc = await document_relationship_service._resolve_readable_latest(
            body.target_doc_id, caller, supabase=supabase
        )
    except Exception:  # noqa: BLE001 — WR-01: malformed id → uniform 422, never 500
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=_INVALID_LINK_DETAIL,
        )
    if source_doc is None or target_doc is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=_INVALID_LINK_DETAIL,
        )

    # 2. Self-link guard (CHECK no_self_rel, migration 071:66). Compare the SUBMITTED
    #    ids — the same uniform 422 (a self-link is rejected indistinguishably from an
    #    unseeable endpoint, Pitfall 4). The Pydantic model does NOT reject this (both
    #    ends are free str), so the router owns this check. NOTE (WR-04): this branch is
    #    the SOLE rejector for a READABLE self-link (one that passes step 1) — it is NOT
    #    dead code; do not remove it on the assumption step 1 already covers it.
    if body.source_doc_id == body.target_doc_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=_INVALID_LINK_DETAIL,
        )

    # 3. Idempotent persist (D-116-6). create_relationship inserts then catches a 23505
    #    and re-fetches the existing edge — one row, no 409, no duplicate. A surfacing
    #    no_self_rel CHECK violation (defense-in-depth, if step 2 were ever bypassed)
    #    maps to the same 422.
    try:
        created = await document_relationship_service.create_relationship(
            user_id=caller,
            source_doc_id=body.source_doc_id,
            target_doc_id=body.target_doc_id,
            rel_type=body.rel_type,
            supabase=supabase,
        )
    except Exception as exc:  # noqa: BLE001 — map the DB CHECK to a uniform 422
        msg = str(exc)
        if "no_self_rel" in msg or "23514" in msg:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=_INVALID_LINK_DETAIL,
            )
        raise

    # 4. Write the governance receipt (DMF-01). This is a BLOCKING (error-swallowing)
    #    audit write on the response path — it is awaited in-band, NOT fire-and-forget
    #    (WR-03): a failure won't 500 (errors are swallowed), but a slow audit round-trip
    #    adds to the create latency. Full decoupling (BackgroundTasks) is out of scope —
    #    the inherited pattern matches document_views.py. The LIVE round-trip is the real
    #    proof (test_116_audit_live.py).
    await write_audit_entry(
        user_id=caller,
        action_type="relationship.create",
        metadata={
            "relationship_id": created["id"],
            "source_doc_id": body.source_doc_id,
            "target_doc_id": body.target_doc_id,
            "rel_type": body.rel_type,
        },
        supabase=supabase,
    )
    return created


@router.delete("/{relationship_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_relationship(
    relationship_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    """Remove an owned relationship (REL-03); a cross-user/absent id is a uniform 404.

    ``delete_relationship`` is own-scoped (``.eq("user_id", caller)``) → False on a
    cross-user/absent miss → 404 (no existence leak, T-116-02-02 — never a forbidden
    status). A ``relationship.delete`` governance row is fired AFTER a successful remove
    (D-116-12 — document_views DELETE has no audit; 116 adds it).
    """
    caller = current_user["id"]
    removed = await document_relationship_service.delete_relationship(
        caller, relationship_id, supabase=supabase
    )
    if not removed:
        # Uniform 404 on a cross-user/absent miss — never a forbidden status, no leak.
        raise HTTPException(status_code=404, detail="Relationship not found")

    # Governance receipt AFTER a confirmed delete (D-116-12). BLOCKING (error-swallowing)
    # audit write on the response path — awaited in-band, NOT fire-and-forget (WR-03);
    # the inherited pattern matches document_views.py, full decoupling is out of scope.
    await write_audit_entry(
        user_id=caller,
        action_type="relationship.delete",
        metadata={"relationship_id": relationship_id},
        supabase=supabase,
    )
