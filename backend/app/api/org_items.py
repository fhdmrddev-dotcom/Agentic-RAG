"""Phase 298 (ORG-06 count read; D-15, D-16, D-22, D-36) — the two org reads the UI needs.

Lists follow the active org (``app.services.org_lists``). That makes two honest questions
answerable that were not before, and this router answers exactly those two:

  * ``GET /org-items/elsewhere`` — "how many of MY items live in my OTHER orgs?" One row per other
    org the caller is a member of: the org's name and five counts of the caller's OWN rows there
    (folders, Root documents, workflows, threads, runs). One round trip; the UI re-asks on switch.
  * ``GET /org-items/folder-labels?ids=…`` — "what is this bound folder called, and which org is it
    in?", for a Builder picker whose narrowed list no longer offers a folder the definition names.

**Security posture.**

  * ⭐ RLS-ENFORCED, NOT SERVICE-ROLE — deliberately (the ``library.py`` precedent). Every SQL here
    runs on ``get_user_pg_connection`` (``SET LOCAL ROLE authenticated`` + the caller's claims), so
    Postgres itself restricts every table to ``org_id IN current_user_org_ids()`` and
    ``organizations`` to member orgs. The explicit predicates below say the same thing again; if
    they were ever wrong, RLS would still hold the line. No new SQL function, so no PUBLIC grant.
  * Only orgs the caller is a MEMBER of are ever named (an ``org_members`` join on ``auth.uid()``),
    and only the caller's OWN rows are counted — another member's folder in that org is not.
  * No active org resolved (no header, a malformed one, or one naming an org the caller is not in)
    -> ``elsewhere`` is ``[]`` without a query: when nothing is narrowed nothing is hidden. The org
    is read only through ``org_lists`` (membership re-validated), never through the 400-ing gate.
  * ``folder-labels`` answers ONLY for ids already in the caller's UNRESTRICTED visible set
    (``fetch_visible_folders`` with no org keyword — today's visibility, nothing new revealed), and
    only when the folder's org name is readable over RLS. Every other id is OMITTED, identically to
    an id that does not exist, so the route is not an existence oracle. ``ids`` is at most
    ``MAX_LABEL_IDS`` strict UUIDs; anything else is a 422 for the whole request.
  * Every route here answers **401** without a bearer (``_require_bearer``, a router dependency, so
    routes later plans add to this router inherit it). The shared ``HTTPBearer()`` answers 403 for
    a missing header on FastAPI 0.115; a missing credential is a 401 (D-22).
  * Read-only by construction: no INSERT, UPDATE, DELETE or audit event.
"""
from __future__ import annotations

import re
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from supabase import Client

from app.dependencies import get_current_user, get_user_pg_connection, get_user_supabase_client
from app.services import org_lists
from app.utils.folder_utils import fetch_visible_folders

_optional_bearer = HTTPBearer(auto_error=False)


async def _require_bearer(
    credentials: HTTPAuthorizationCredentials | None = Depends(_optional_bearer),
) -> None:
    """D-22: no credential is a 401 with ``WWW-Authenticate: Bearer`` — checked before any read."""
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )


router = APIRouter(
    prefix="/org-items", tags=["org-items"], dependencies=[Depends(_require_bearer)]
)

#: The most folder ids one label read answers for (T-298-04 / T-298-05).
MAX_LABEL_IDS = 50

_UUID_RE = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)

#: ONE round trip. The predicates are the LISTS' predicates, so a count equals what Switch shows:
#: folders = the caller's own; Root documents = own, no folder, latest, archived excluded (D-36 —
#: the Library list's default); workflows = own and not system-global; threads = own, non-eval;
#: runs = own. ``$1`` = the active org, never listed as "elsewhere".
ELSEWHERE_SQL = """
SELECT o.id AS org_id, o.name AS org_name,
  (SELECT count(*) FROM public.folders f
     WHERE f.org_id = o.id AND f.user_id = auth.uid())                                   AS folders,
  (SELECT count(*) FROM public.documents d
     WHERE d.org_id = o.id AND d.user_id = auth.uid() AND d.folder_id IS NULL
       AND d.is_latest AND d.archived_at IS NULL)                                         AS root_documents,
  (SELECT count(*) FROM public.workflow_definitions w
     WHERE w.org_id = o.id AND w.created_by = auth.uid() AND NOT w.is_system_global)      AS workflows,
  (SELECT count(*) FROM public.threads t
     WHERE t.org_id = o.id AND t.user_id = auth.uid() AND t.is_eval = false)             AS threads,
  (SELECT count(*) FROM public.workflow_runs r
     WHERE r.org_id = o.id AND r.user_id = auth.uid())                                    AS runs
FROM public.organizations o
JOIN public.org_members m ON m.org_id = o.id AND m.user_id = auth.uid()
WHERE o.id <> $1
ORDER BY o.name, o.id
"""

#: Org names for the label read — member orgs only, by RLS (``organizations`` SELECT policy).
ORG_NAMES_SQL = "SELECT id, name FROM public.organizations WHERE id = ANY($1::uuid[])"


class ElsewhereOrgCounts(BaseModel):
    org_id: str
    org_name: str
    folders: int
    root_documents: int
    workflows: int
    threads: int
    runs: int


class ElsewhereCounts(BaseModel):
    orgs: list[ElsewhereOrgCounts]


class FolderLabel(BaseModel):
    id: str
    name: str
    org_id: str
    org_name: str


class FolderLabels(BaseModel):
    labels: list[FolderLabel]


def fold_elsewhere_rows(rows) -> ElsewhereCounts:
    """The counts rows -> the wire model, ordered by org name then id (the SQL's own order)."""
    orgs = [
        ElsewhereOrgCounts(
            org_id=str(r["org_id"]),
            org_name=r["org_name"] or "",
            folders=int(r["folders"] or 0),
            root_documents=int(r["root_documents"] or 0),
            workflows=int(r["workflows"] or 0),
            threads=int(r["threads"] or 0),
            runs=int(r["runs"] or 0),
        )
        for r in rows
    ]
    orgs.sort(key=lambda o: (o.org_name, o.org_id))
    return ElsewhereCounts(orgs=orgs)


def parse_folder_ids(raw: str | None) -> list[str]:
    """Comma-separated strict UUIDs, de-duplicated in request order; ``[]`` for none.

    A malformed id, or more than ``MAX_LABEL_IDS``, refuses the WHOLE request with 422 — never a
    partial answer that would let a caller probe which ids parsed.
    """
    ids: list[str] = []
    for part in (raw or "").split(","):
        token = part.strip()
        if not token:
            continue
        if not _UUID_RE.match(token):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="ids must be folder ids (UUIDs), separated by commas.",
            )
        token = token.lower()
        if token not in ids:
            ids.append(token)
    if len(ids) > MAX_LABEL_IDS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"At most {MAX_LABEL_IDS} folder ids per request.",
        )
    return ids


@router.get("/elsewhere", response_model=ElsewhereCounts)
async def get_elsewhere_counts(
    request: Request,
    current_user: dict = Depends(get_current_user),
) -> ElsewhereCounts:
    """Your own items in your other organizations, counted per organization.

    One row per organization you belong to other than the active one (`X-Org-Id`), with its name
    and how many of your folders, Root documents (archived excluded), workflows, chats and runs
    live there. Without an active organization the answer is an empty list.
    """
    active = await org_lists.active_org_uuid(request, current_user)
    if active is None:
        return ElsewhereCounts(orgs=[])
    async with get_user_pg_connection(request, current_user) as conn:
        rows = await conn.fetch(ELSEWHERE_SQL, active)
    return fold_elsewhere_rows(rows)


@router.get("/folder-labels", response_model=FolderLabels)
async def get_folder_labels(
    request: Request,
    ids: str | None = Query(
        None, description="Up to 50 folder ids, comma-separated. Unknown or unreadable ids are omitted."
    ),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
) -> FolderLabels:
    """The name and organization of folders you can already see, by id.

    For each requested id that is one of your visible folders, its name, its organization's id and
    that organization's name. An id you cannot see is left out, exactly like an id that does not
    exist.
    """
    wanted = parse_folder_ids(ids)
    if not wanted:
        return FolderLabels(labels=[])
    # UNRESTRICTED on purpose: today's visibility, so a label never reveals a folder the caller
    # could not already read. No org keyword (the seam-contract rule).
    visible = {str(f["id"]): f for f in await fetch_visible_folders(supabase, current_user["id"])}
    hits = [visible[i] for i in wanted if i in visible and visible[i].get("org_id")]
    if not hits:
        return FolderLabels(labels=[])
    org_ids = sorted({str(f["org_id"]) for f in hits})
    async with get_user_pg_connection(request, current_user) as conn:
        rows = await conn.fetch(ORG_NAMES_SQL, [UUID(o) for o in org_ids])
        names = {str(r["id"]): r["name"] for r in rows}
    return FolderLabels(
        labels=[
            FolderLabel(
                id=str(f["id"]), name=f["name"], org_id=str(f["org_id"]),
                org_name=names[str(f["org_id"])],
            )
            for f in hits
            if names.get(str(f["org_id"])) is not None
        ]
    )
