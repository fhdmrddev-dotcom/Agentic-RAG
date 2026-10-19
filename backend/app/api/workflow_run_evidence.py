"""Phase 289 (VIS-03 / D-01, D-05, D-06) — what a finished run did, and on what evidence.

ONE read: ``GET /workflow-runs/{workflow_run_id}/evidence``. Its payload is the single source
for the run evidence page, its JSON export and its print view (D-03), so every field below is
the wire, and the field names are pinned by plan 05's shared fixture.

**Access is the run's ORGANISATION, not its owner (D-05).** The four run tables carry
owner-only SELECT policies, so a colleague's user-JWT read returns nothing. This route
therefore reads through the service pool (it bypasses RLS) with the access rule written into
the ONE query that finds the run: the id, a terminal status, and "the caller started it OR is a
member of the run's org". That is the shipped library-feed posture; no RLS policy is widened
and no migration is added.

**One query, one answer for every miss.** A nonexistent id, a run in another org, and a run
that is still active or paused (D-06: the live surface keeps those) all take the SAME single
SELECT to the SAME ``{"detail": "Run not found"}`` body as the owner read. Nothing else is read
before that row is found, so neither the status code nor the query shape can tell "not yours"
from "not there". The gate list holds ``require_canvas()`` ALONE and identity comes from
``canvas_caller`` (WR-08); the two names the run read's docblock (``workflow_runs.py``) leaves
unspelled stay unspelled here too, and no forbidden-status answer exists in this module.

**What a colleague does not get (A-06, R-01..R-04).** No owner email, no thread id, no
workspace file id, no citation passage or score. A cited document the colleague cannot read
under THEIR OWN RLS is masked to its step numbers, and the KB label is resolved on that same
RLS connection, so a private folder's name never crosses (W3a). If that RLS block fails, every
source is masked and the label is the default words: fail closed. The human-input step reports
only whether it was answered.

**Accepted, stated rather than silent (T-289-18 / T-289-31):** a same-org colleague receives
each non-human step's ``output_text``, the full definition and the gate rows' validator kinds.
That is the record of what ran, which is this page's purpose.

The path template is registered in ``middleware/canvas_gate.py``'s ``CANVAS_GATED_PATHS`` in
the same commit that mounts this router.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app import dependencies as deps
from app.api.workflow_runs import _parse_instant
from app.dependencies import canvas_caller, require_canvas
from app.services import run_evidence as ev
from app.services.harness.phase_confidence import KB_LABEL_DEFAULT, resolve_kb_label

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/workflow-runs", tags=["workflow-runs"])


# ── the wire (RunEvidenceRead) — every field declared, because response_model drops the rest ──


class RunEvidenceStartedBy(BaseModel):
    name: str
    email: str | None = None
    is_you: bool = False


class RunEvidenceRun(BaseModel):
    id: str
    status: str
    workflow_name: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    started_by: RunEvidenceStartedBy
    org_name: str | None = None
    model: str | None = None
    viewer_is_owner: bool
    thread_id: str | None = Field(default=None, description="The owner's thread; null for anyone else.")


class RunEvidenceDefinitionPhase(BaseModel):
    n: int
    slug: str
    name: str
    phase_type: str | None = None


class RunEvidenceDefinition(BaseModel):
    recorded: bool = Field(description="False only when the run predates version recording.")
    version: int | None = None
    phases: list[RunEvidenceDefinitionPhase] = Field(default_factory=list)
    full: dict[str, Any] | None = None


class RunEvidenceDefinitionChanged(BaseModel):
    changed: bool = False
    current_version: int | None = None


class RunEvidenceDeliverable(BaseModel):
    kind: str = Field(description='"file" | "text" | "none"')
    name: str | None = None
    file_id: str | None = Field(default=None, description="Workspace file id; owner only.")


class RunEvidenceConfidence(BaseModel):
    level: str
    avg_similarity: float | None = None
    disclaimer: str | None = None
    passages: int = 0
    kb_label: str


class RunEvidenceHumanInput(BaseModel):
    answered: bool
    question: str | None = None
    answer: str | None = None
    answered_by: str | None = None


class RunEvidenceLogEntry(BaseModel):
    n: int
    slug: str
    name: str
    phase_type: str | None = None
    status: str
    started_at: datetime | None = None
    completed_at: datetime | None = None
    step_count: int | None = None
    step_noun: str | None = None
    output_text: str | None = None
    failure_reason: str | None = None
    confidence: RunEvidenceConfidence | None = None
    human_input: RunEvidenceHumanInput | None = None


class RunEvidenceVerdict(BaseModel):
    step_n: int | None = None
    phase_slug: str | None = None
    kind: str
    result: str = Field(description='"passed" | "failed" | "recorded"')
    checked: list[str] = Field(default_factory=list)
    at: datetime | None = None


class RunEvidenceSource(BaseModel):
    masked: bool
    document_id: str | None = None
    filename: str | None = None
    locations: list[int] = Field(default_factory=list)
    cited_by: list[int] = Field(default_factory=list)


class RunEvidenceRead(BaseModel):
    run: RunEvidenceRun
    definition: RunEvidenceDefinition
    definition_changed: RunEvidenceDefinitionChanged
    kb_label: str
    deliverable: RunEvidenceDeliverable
    phase_log: list[RunEvidenceLogEntry] = Field(default_factory=list)
    verdicts: list[RunEvidenceVerdict] = Field(default_factory=list)
    sources: list[RunEvidenceSource] = Field(default_factory=list)


# ── SQL ─────────────────────────────────────────────────────────────────────────────────────

# THE access query. id, terminal status and owner-or-member travel TOGETHER, so every kind of
# miss is the same miss. The three literals are the DB's terminal statuses
# (workflow_runs_status_check admits no ``timed_out``). Membership is read per request inside
# this statement: a removed member loses access on the next read, with no cache (T-289-16).
_ACCESS_SQL = """
    SELECT wr.id, wr.thread_id, wr.definition_id, wr.status, wr.org_id, wr.user_id,
           wr.created_at, wr.updated_at, wr.definition_snapshot, wr.model
    FROM workflow_runs wr
    WHERE wr.id = $1
      AND wr.status IN ('completed', 'failed', 'cancelled')
      AND (wr.user_id = $2
           OR EXISTS (SELECT 1 FROM org_members m
                      WHERE m.org_id = wr.org_id AND m.user_id = $2))
"""

_PHASES_SQL = """
    SELECT slug, phase_index, status, started_at, completed_at, output
    FROM workflow_phases
    WHERE workflow_run_id = $1
    ORDER BY phase_index
"""

# ``metadata`` is unwrapped in Python (write_audit double-encodes it), never with ``->>``.
_AUDIT_SQL = """
    SELECT event_type, metadata, created_at
    FROM harness_audit
    WHERE run_id = $1 AND event_type = ANY($2::text[])
    ORDER BY created_at, id
"""

_OWN_DEFINITION_SQL = (
    "SELECT slug, version, name, status, definition FROM workflow_definitions WHERE id = $1"
)
_SAME_SLUG_VERSIONS_SQL = "SELECT version FROM workflow_definitions WHERE slug = $1 AND org_id = $2"
_DISPLAY_NAME_SQL = "SELECT display_name FROM profiles WHERE id = $1"
_ORG_NAME_SQL = "SELECT name FROM organizations WHERE id = $1"
_WORKSPACE_FILE_SQL = "SELECT id FROM workspace_files WHERE thread_id = $1 AND path = $2"
# Run on the VIEWER's RLS connection: what comes back is exactly what they may read.
_READABLE_DOCUMENTS_SQL = "SELECT id::text AS id FROM public.documents WHERE id = ANY($1::uuid[])"


def _not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")


async def _optional(label: str, run_id: Any, awaitable: Any) -> Any:
    """An affordance read: on failure, log the run id and degrade to None (never 500)."""
    try:
        return await awaitable
    except Exception:  # noqa: BLE001 — a pure read never fails over an additional fact
        logger.warning("evidence %s read failed for run %s", label, run_id, exc_info=True)
        return None


def _span(phase_rows: list[dict], run: dict) -> tuple[Any, Any]:
    """Earliest step start and latest step end; else the run row's own instants."""
    starts = [i for i in (_parse_instant(r.get("started_at")) for r in phase_rows) if i]
    ends = [i for i in (_parse_instant(r.get("completed_at")) for r in phase_rows) if i]
    return (
        min(starts) if starts else run.get("created_at"),
        max(ends) if ends else run.get("updated_at"),
    )


async def _viewer_reads(
    viewer_id: str, document_ids: list[str], definition: Any
) -> tuple[set[str], str]:
    """A colleague's readable cited documents AND the KB label, on ONE RLS connection (W3a).

    Any failure masks every source and yields the default words: fail closed.
    """
    try:
        async with deps.get_user_pg_connection(None, {"id": viewer_id}) as conn:
            readable: set[str] = set()
            if document_ids:
                rows = await conn.fetch(_READABLE_DOCUMENTS_SQL, document_ids)
                readable = {str(r["id"]) for r in rows}
            label = await resolve_kb_label(conn, definition)
        return readable, label
    except Exception:  # noqa: BLE001 — fail closed (R-01)
        logger.warning("evidence RLS readability check failed; masking every source",
                       exc_info=True)
        return set(), KB_LABEL_DEFAULT


@router.get(
    "/{workflow_run_id}/evidence",
    response_model=RunEvidenceRead,
    # D-182-05 / D-188-16 — require_canvas ALONE in this list; see the module docblock.
    dependencies=[Depends(require_canvas())],
)
async def read_run_evidence(
    workflow_run_id: UUID,
    # WR-08: the identity require_canvas already validated; never re-resolved here.
    current_user: dict = Depends(canvas_caller),
) -> RunEvidenceRead:
    """PURE READ — a finished run's evidence for its owner or a member of its org. Writes nothing."""
    viewer_id = str(current_user["id"])
    try:
        viewer_uuid = UUID(viewer_id)
    except (ValueError, TypeError, AttributeError):
        raise _not_found() from None

    pool = await deps.get_pg_pool()

    # ── Step 1: the ONE access query. Nothing is read before this row exists. ──
    run = await pool.fetchrow(_ACCESS_SQL, workflow_run_id, viewer_uuid)
    if run is None:
        raise _not_found()
    run = dict(run)
    run_id = run["id"]
    viewer_is_owner = run.get("user_id") is not None and str(run["user_id"]) == viewer_id

    # ── Step 2: everything else, keyed by that row only ──
    phase_rows = [dict(r) for r in (await pool.fetch(_PHASES_SQL, run_id) or [])]
    audit_rows = [
        dict(r) for r in (await pool.fetch(_AUDIT_SQL, run_id, list(ev.VERDICT_KINDS)) or [])
    ]

    own_row = await _optional(
        "definition", run_id, pool.fetchrow(_OWN_DEFINITION_SQL, run["definition_id"])
    )
    own_row = dict(own_row) if own_row is not None else {}
    definition = ev.compose_definition(
        run.get("definition_snapshot"), own_row.get("definition"), own_row.get("version")
    )
    full = definition["full"]

    slug = (full or {}).get("slug") if isinstance(full, dict) else None
    if not isinstance(slug, str) or not slug:
        slug = own_row.get("slug")
    versions: list[Any] = []
    if isinstance(slug, str) and slug:
        version_rows = await _optional(
            "versions", run_id, pool.fetch(_SAME_SLUG_VERSIONS_SQL, slug, run["org_id"])
        )
        versions = [r["version"] for r in (version_rows or [])]
    changed = ev.definition_changed(
        full if definition["recorded"] else None, versions, own_row
    )

    display_name = await _optional(
        "profile", run_id, pool.fetchval(_DISPLAY_NAME_SQL, run["user_id"])
    ) if run.get("user_id") is not None else None
    org_name = await _optional("org", run_id, pool.fetchval(_ORG_NAME_SQL, run["org_id"]))
    who = ev.started_by(display_name, current_user.get("email"), viewer_is_owner)

    # ── Step 3: what the viewer may see (R-01 / R-05 / W3a) ──
    if viewer_is_owner:
        readable: set[str] | None = None
        kb_label = await resolve_kb_label(pool, full)
    else:
        readable, kb_label = await _viewer_reads(
            viewer_id, ev.cited_document_ids(phase_rows), full
        )

    phase_log = ev.compose_phase_log(phase_rows, full, viewer_is_owner, who["name"], kb_label)
    steps = ev.step_numbers(phase_log)

    file_id = None
    path = ev.deliverable_path(phase_rows)
    if viewer_is_owner and path is not None:
        file_id = await _optional(
            "deliverable", run_id, pool.fetchval(_WORKSPACE_FILE_SQL, run["thread_id"], path)
        )

    started_at, completed_at = _span(phase_rows, run)
    workflow_name = (full or {}).get("name") if isinstance(full, dict) else None
    if not isinstance(workflow_name, str) or not workflow_name:
        workflow_name = own_row.get("name") or None

    return RunEvidenceRead(
        run=RunEvidenceRun(
            id=str(run_id),
            status=run["status"],
            workflow_name=workflow_name,
            started_at=started_at,
            completed_at=completed_at,
            started_by=RunEvidenceStartedBy(**who),
            org_name=org_name if isinstance(org_name, str) and org_name else None,
            model=run.get("model"),
            viewer_is_owner=viewer_is_owner,
            thread_id=str(run["thread_id"]) if viewer_is_owner and run.get("thread_id") else None,
        ),
        definition=RunEvidenceDefinition(**definition),
        definition_changed=RunEvidenceDefinitionChanged(**changed),
        kb_label=kb_label,
        deliverable=RunEvidenceDeliverable(
            **ev.compose_deliverable(phase_rows, viewer_is_owner, file_id)
        ),
        phase_log=[RunEvidenceLogEntry(**e) for e in phase_log],
        verdicts=[RunEvidenceVerdict(**v) for v in ev.compose_verdicts(audit_rows, full, steps)],
        sources=[RunEvidenceSource(**s) for s in ev.compose_sources(phase_rows, steps, readable)],
    )
