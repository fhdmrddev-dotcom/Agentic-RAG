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

from app.dependencies import get_current_user, get_supabase
from app.models.document_relationship import RelationshipCreate, RelationshipResponse
from app.services import document_relationship_service
from app.services.audit_service import write_audit_entry

router = APIRouter(prefix="/document-relationships", tags=["document-relationships"])

# The uniform rejection detail for the visible-both gate AND the self-link guard. Both
# collapse to ONE message so a probe cannot distinguish "unseeable endpoint" from
# "self-link" by error shape (T-116-02-01 — no ordering oracle).
_INVALID_LINK_DETAIL = "Both documents must be readable and distinct"


@router.post("", response_model=RelationshipResponse, status_code=status.HTTP_201_CREATED)
async def create_relationship(
    body: RelationshipCreate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Create a typed link between two caller-readable documents (REL-01).

    Order (no ordering oracle — D-116-5 / T-116-02-01):
      1. VISIBLE-BOTH gate FIRST: resolve BOTH endpoints from the CALLER; either
         unreadable → uniform 422 (BEFORE the self-link/CHECK consideration).
      2. Self-link guard: source == target → the SAME uniform 422.
      3. Idempotent persist (the 23505-catch returns the existing edge).
      4. Fire the ``relationship.create`` governance receipt (DMF-01).
    """
    caller = current_user["id"]

    # 1. VISIBLE-BOTH gate (D-116-5 / T-116-02-01). Resolve BOTH endpoints from the
    #    CALLER (own ∪ globally-visible-folder, latest version). If EITHER returns None,
    #    the caller cannot see that endpoint → a UNIFORM 422 that names neither which
    #    endpoint nor why (no probe-by-link existence oracle). This runs BEFORE the
    #    self-link / CHECK gate so an unseeable id and a self-link are indistinguishable
    #    by error shape (mirrors document_views.py:154-162 ownership-before-validation).
    source_doc = await document_relationship_service._resolve_readable_latest(
        body.source_doc_id, caller, supabase=supabase
    )
    target_doc = await document_relationship_service._resolve_readable_latest(
        body.target_doc_id, caller, supabase=supabase
    )
    if source_doc is None or target_doc is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=_INVALID_LINK_DETAIL,
        )

    # 2. Self-link guard (CHECK no_self_rel, migration 071:66). Compare the SUBMITTED
    #    ids — the same uniform 422 (a self-link is rejected indistinguishably from an
    #    unseeable endpoint, Pitfall 4). The Pydantic model does NOT reject this (both
    #    ends are free str), so the router owns this check.
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

    # 4. Fire the governance receipt (DMF-01). write_audit_entry is async and SWALLOWS
    #    errors, so the LIVE round-trip is the real proof (test_116_audit_live.py).
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
    supabase: Client = Depends(get_supabase),
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

    # Governance receipt AFTER a confirmed delete (D-116-12). Fire-and-forget / swallows.
    await write_audit_entry(
        user_id=caller,
        action_type="relationship.delete",
        metadata={"relationship_id": relationship_id},
        supabase=supabase,
    )
