"""Document search — Phase 271 (FIND-01 / FIND-02 / FIND-03).

`POST /document-search` — find whole documents by structured fields (type, custom fields,
date in the document, name, folder path with subfolders, who added it, the three file dates,
relationships in both directions, version state), in a STATED server order, server-paged,
with an exact total. Its own mode beside RAG (FIND-02): it ranks nothing and returns no
passage or chunk.

⭐ **Deliberately NOT in api/documents.py.** That module is a G-5-firing hot file; this is a
read surface of its own with its own request contract. The core lives in
`app.services.document_search_service` (FastAPI-free, so Phase 272's agent tool can call it
in-process); this module is the thin wrapper — the `document_views.resolve_adhoc` shape.

⭐ **RLS-ENFORCED: the user-JWT client** (`get_user_supabase_client`). The core's own legs
(own ∪ org-shared folder) mirror `list_documents`, and RLS on `documents` and
`document_relationships` is the wall beneath them. The core's relationship helpers are
handed THIS client explicitly — their `None` default is the service-role client.

Read-only by construction: no INSERT, no UPDATE, no DELETE, no audit event — safe to call
per keystroke. A core `ResolveError` becomes an `HTTPException` with the same status and
detail (422 for a bad filter field, 503 when a read could not be completed).

The response is a plain dict (no `response_model`) so each row keeps its exact `metadata`
blob — the 112 CR-01 lesson.
"""

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from app.dependencies import get_current_user, get_user_supabase_client
from app.models.document_search import DocumentSearchRequest
from app.services.document_search_service import search_documents
from app.services.document_view_resolver import ResolveError

router = APIRouter(prefix="/document-search", tags=["document-search"])


@router.post("")
async def search(
    body: DocumentSearchRequest,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    """Find documents by structured fields — exact match, server order, exact total."""
    try:
        return await search_documents(caller=current_user["id"], req=body, supabase=supabase)
    except ResolveError as e:
        raise HTTPException(status_code=e.status, detail=e.detail)
