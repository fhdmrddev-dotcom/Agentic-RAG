"""Phase 306-01 (D-39, D-12) — the read shape of a key-started run, moved out of ``api/inbound.py``.

Pure move (306-01, D-39); 306-05 adds the MCP file arm; no access SQL lives here — every caller
runs its own. ``api/inbound.py`` keeps the route, the per-key limiter, THE access query
(``_RUN_ACCESS_SQL``, D-12: id, origin and owner travel together), the refusal and the audit, and
calls ``read_key_run`` once the run is proven to be this key's.

The read wire models and the one-time link constants moved WITH the read and are re-exported from
``api/inbound.py`` as the same objects, so the public OpenAPI names (``InboundRunRead`` and its
parts) and the download route are unchanged. This module imports nothing from ``app.api``.

Pinned by ``tests/unit/test_306_key_run_pure_move.py`` (every moved binding AST-identical to
PHASE_BASE; ``read_key_run``'s body is the base slice with two named substitutions).
"""
from __future__ import annotations

import json
import logging
import posixpath
import secrets
from typing import Any

from pydantic import BaseModel, Field

from app.security.api_key_auth import ResolvedKey

logger = logging.getLogger(__name__)

# A2 — a file link lives 300 s and works once; a fresh one comes with every status read.
_DOWNLOAD_TTL = 300
_DOWNLOAD_PREFIX = "apikey:dl:"


# ── wire models (public OpenAPI names; re-exported from api/inbound.py) ────────────────────


class InboundStep(BaseModel):
    name: str
    state: str


class InboundFile(BaseModel):
    name: str
    size_bytes: int | None = None
    url: str = Field(description=(
        "An absolute, one-time link to the file. Fetch it with no header; it works once and "
        "for `expires_in` seconds."
    ))
    expires_in: int


class InboundWaitingOn(BaseModel):
    who: str


class InboundRunRead(BaseModel):
    run_id: str
    status: str
    step_index: int | None = None
    step_total: int | None = None
    waiting_on: InboundWaitingOn | None = None
    output_text: str | None = None
    end_reason: str | None = None
    steps: list[InboundStep] = Field(default_factory=list)
    files: list[InboundFile] = Field(default_factory=list)


# ── SQL (explicit columns; the pool bypasses RLS, so the caller's access query came first) ──

# The evidence read's phase shape (api/workflow_run_evidence.py `_PHASES_SQL`).
_PHASES_SQL = (
    "SELECT slug, phase_index, status, started_at, completed_at, output "
    "FROM workflow_phases WHERE workflow_run_id = $1 ORDER BY phase_index"
)

_END_REASON_AUDIT_SQL = (
    "SELECT event_type, metadata, created_at FROM harness_audit "
    "WHERE run_id = $1 AND event_type = ANY($2::text[]) ORDER BY created_at, id"
)

_DISPLAY_NAME_SQL = "SELECT display_name FROM profiles WHERE id = $1"

# The run's own thread (one thread per run, D-09). `IS DISTINCT FROM`, never `<>`: a NULL kind
# (every ordinary produced file) must be listed, and `NULL <> 'x'` is NULL.
_FILES_SQL = (
    "SELECT id, path, size_bytes FROM workspace_files "
    "WHERE thread_id = $1 AND kind IS DISTINCT FROM 'template_input' "
    "AND (expires_at IS NULL OR expires_at > now()) ORDER BY created_at, path"
)


async def _optional(label: str, run_id: Any, awaitable: Any) -> Any:
    """An affordance read: on failure, log the run id and degrade to None (never 500)."""
    try:
        return await awaitable
    except Exception:  # noqa: BLE001 — a status read never fails over an additional fact
        logger.warning("inbound %s read failed for run %s", label, run_id, exc_info=True)
        return None


def _step_position(phase_rows: list[dict]) -> int | None:
    """1-based position of the step running now, else of the next step to run."""
    for i, r in enumerate(phase_rows, start=1):
        if r.get("status") == "active":
            return i
    done = sum(1 for r in phase_rows if r.get("status") == "completed")
    return min(done + 1, len(phase_rows)) if phase_rows else None


async def _file_links(
    pool, redis, *, key: ResolvedKey | None, run: dict, base: str | None
) -> list[InboundFile]:
    rows = await pool.fetch(_FILES_SQL, run["thread_id"])
    files: list[InboundFile] = []
    if base is None:
        # 306-05 (D-12 / Pitfall 13): the MCP arm. File NAMES only — no one-time link is minted
        # (``/inbound/files`` serves key-origin runs only); the caller points at /app/runs/<id>.
        return [
            InboundFile(name=posixpath.basename(str(r.get("path") or "").replace("\\", "/")) or "file",
                        size_bytes=r.get("size_bytes"), url="", expires_in=0)
            for r in rows or []
        ]
    for r in rows or []:
        token = secrets.token_urlsafe(24)
        await redis.set(
            f"{_DOWNLOAD_PREFIX}{token}",
            json.dumps({"key_id": key.id, "run_id": str(run["id"]), "file_id": str(r["id"])}),
            ex=_DOWNLOAD_TTL,
        )
        path = str(r.get("path") or "")
        files.append(InboundFile(
            name=posixpath.basename(path.replace("\\", "/")) or "file",
            size_bytes=r.get("size_bytes"),
            url=f"{base}/inbound/files/{token}",
            expires_in=_DOWNLOAD_TTL,
        ))
    return files


async def read_key_run(
    pool, redis, *, run: dict, key: ResolvedKey | None, files_base: str | None
) -> InboundRunRead:
    """The status read of a run the caller has ALREADY proven is this key's (its own access SQL).

    ``files_base`` is the absolute API base each one-time file link is built on (the route's
    ``_public_api_base(request)``). The caller writes the read audit row with ``result.status``.
    306-05: ``files_base=None`` is the MCP arm — file names, no link, no token (``_file_links``).
    """
    from app.db import workflows as workflows_db  # noqa: PLC0415
    from app.models.thread import phase_output_object  # noqa: PLC0415
    from app.services import run_evidence as ev  # noqa: PLC0415
    from app.services.harness.run_read_wire import (  # noqa: PLC0415
        END_REASON_AUDIT_KINDS,
        resolve_end_reason,
    )
    from app.services.harness.run_read_words import waiting_who  # noqa: PLC0415

    phase_rows = sorted(
        (dict(r) for r in (await pool.fetch(_PHASES_SQL, run["id"]) or [])),
        key=lambda r: r.get("phase_index") if isinstance(r.get("phase_index"), int) else 1 << 30,
    )
    names = {p["slug"]: p["name"] for p in ev.compose_definition(
        run.get("definition_snapshot"), None
    )["phases"]}
    steps = [
        InboundStep(name=names.get(r.get("slug")) or str(r.get("slug") or ""),
                    state=str(r.get("status") or ""))
        for r in phase_rows
    ]

    db_status = run.get("status")
    wire_status = "running" if db_status == "active" else str(db_status)
    waiting_on = None
    if db_status in ("paused", "cap_paused"):
        wire_status = "paused"
    # 293-05: a human-input STEP keeps the run `active` while its question is open (only an
    # engine pause flips it to `paused`), so the open question is read for both, exactly as the
    # run page's `_read_waiting_on` does.
    if db_status in ("active", "paused"):
        prompt = await _optional(
            "waiting", run["id"], workflows_db.get_unanswered_ask_user(pool, run["id"])
        )
        if prompt:
            wire_status = "waiting_for_person"
            display = await _optional(
                "profile", run["id"], pool.fetchval(_DISPLAY_NAME_SQL, run["user_id"])
            )
            # The name only: a non-owner reader never gets the question (T-293-19).
            waiting_on = InboundWaitingOn(
                who=waiting_who(is_owner=False, display_name=display, viewer_email=None)
            )

    failed_reasons = []
    for r in phase_rows:
        if r.get("status") == "failed":
            obj = phase_output_object(r.get("output"))
            failed_reasons.append(obj.get("_failure_reason") if isinstance(obj, dict) else None)
    end_reason = resolve_end_reason(db_status, failed_reasons, [])
    if end_reason is None and db_status in ("failed", "cancelled"):
        audit_rows = await _optional(
            "end reason", run["id"],
            pool.fetch(_END_REASON_AUDIT_SQL, run["id"], list(END_REASON_AUDIT_KINDS)),
        )
        end_reason = resolve_end_reason(
            db_status, failed_reasons, [dict(r) for r in (audit_rows or [])]
        )

    files = await _optional("files", run["id"], _file_links(
        pool, redis, key=key, run=run, base=files_base,
    ))

    return InboundRunRead(
        run_id=str(run["id"]),
        status=wire_status,
        step_index=_step_position(phase_rows) if db_status == "active" else None,
        step_total=len(phase_rows) if db_status == "active" else None,
        waiting_on=waiting_on,
        output_text=ev.final_output_text(phase_rows),
        end_reason=end_reason,
        steps=steps,
        files=files or [],
    )
