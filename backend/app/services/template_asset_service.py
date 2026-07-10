"""Phase 101 (TMPL-02 / D-09) — template byte resolution by PROVENANCE.

The seam the fill tool (Plan 04) calls to obtain the template bytes BEFORE shipping
them into the sandbox. Two mutually-exclusive sources, each carrying a provenance tag
that Plan 02's ``template_render_service.select_engine`` consumes to pick the render
engine — this module never re-implements that routing, it only RETURNS the tag:

  - **Library ``AssetRef`` (trusted → docxtpl):** a published, immutable
    ``WorkflowDefinition.assets[]`` ref whose ``asset_id`` is a Storage path in the
    ``workspace-files`` bucket (no-TTL row, D-09). Bytes fetched via the existing
    ``workspace_service._read_from_storage`` (run_in_threadpool-wrapped — CLAUDE.md
    D-v2.5-01). Provenance ``"library"``.
  - **Ephemeral upload (untrusted → run_replace):** the newest non-expired
    ``kind='template_input'`` ``workspace_files`` row for this thread+user
    (newest-wins per 100/D-14). Bytes fetched via ``workspace_service._get_file_content``
    (inline-or-Storage). Provenance ``"template_input"``.

Security posture (STRIDE register T-101-03-01..04):
  - Every ephemeral query is user-scoped on ``created_by`` (the RLS backstop column
    set by ``write_file``). A cross-user thread → no matching row → the clean
    "no template" error, NEVER another user's bytes (V4 / 404-not-403).
  - The expiry read gate ``(expires_at IS NULL OR expires_at > now())`` (100 D-10)
    keeps an expired template unreadable; an expired row → a relay-able "expired"
    error, never stale bytes.
  - On ANY failure (download error, no row, expired, cross-user) the function
    returns ``bytes=None`` + a relay-able ``error`` STRING — it NEVER raises a raw
    404 / never leaks a traceback to the agent context (D-05 clean error).
  - Blocking ``supabase-py`` Storage calls are wrapped via the reused
    ``_read_from_storage`` / ``_get_file_content`` helpers (run_in_threadpool).

This module does NOT import ``template_render_service`` (no circular import — Plan 04
composes the two) and adds NO query/Storage logic to ``threads.py`` (G-5 hot file).
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from app.services.workspace_service import (  # reuse — do NOT hand-roll Storage I/O
    BUCKET_NAME,
    _get_file_content,
    _read_from_storage,
)

if TYPE_CHECKING:
    import asyncpg
    from supabase import Client

logger = logging.getLogger(__name__)

# The two-bucket envelope the resolver always returns. Keys are stable so the Plan-04
# tool handler can destructure without guessing.
_EMPTY: dict[str, Any] = {
    "bytes": None,
    "filename": None,
    "provenance": None,
    "mime": None,
    "error": None,
}


def _result(**overrides: Any) -> dict[str, Any]:
    """Build a complete result envelope from defaults + overrides (never a partial dict)."""
    out = dict(_EMPTY)
    out.update(overrides)
    return out


def _filename_from_path(path: str | None) -> str | None:
    """Derive a display filename from a workspace_files.path (e.g. '/template.docx').

    workspace_files has no dedicated `filename` column — `path` carries it. Strip the
    leading slash + any directory segments so the agent sees a clean name.
    """
    if not path:
        return None
    return path.rstrip("/").rsplit("/", 1)[-1] or path


# ── Phase 141 (COLL-02 / D-141-01, D-141-02) — run-scope claim helpers ──────────────
# Pure (no I/O), importable by the offline truth-table tests AND by the Plan-02 callers.
# `claim_visible` is the SINGLE source of the run-context eligibility truth — the Branch-2
# WHERE predicate (Plan 02) mirrors it (`run_claim IS NULL OR run_claim = $own`) so the SQL
# and this helper can never disagree (mirror Phase 120's `_apply_origin_filter`).

DEEP_CLAIM = "deep"
"""The fixed sentinel a Deep turn stamps as its run-context lineage — distinct from a
`str(workflow_run_id)`. It is what makes the block SYMMETRIC: a Deep-claimed row is invisible
to a workflow run AND a workflow-claimed row is invisible to a Deep turn (D-141-02). Without
the sentinel, a Deep-touched row would stay NULL and a later workflow run could claim it =
an unblocked Deep→workflow leak."""


def claim_visible(row_claim: "str | None", own_claim: str) -> bool:
    """Is a `workspace_files` row with claim `row_claim` resolvable by the run-context whose
    own-claim is `own_claim`? (pure — no I/O).

    True iff the row is unclaimed (`row_claim is None` → first claimer wins) OR already
    claimed by this same run-context (`row_claim == own_claim` → same-mode reuse: Deep→Deep,
    same-`workflow_run` across phases). A FOREIGN claim (`row_claim != own_claim`) → False →
    the row is invisible → the resolver's clean "belongs to another run" path (D-141-05).
    This is the exact predicate the Plan-02 Branch-2 WHERE clause mirrors."""
    return row_claim is None or row_claim == own_claim


def own_claim_for_ctx(ctx: Any) -> str:
    """Derive the current run-context's own-claim from a ToolContext-like `ctx` (pure — no I/O).

    Keyed off `workflow_run_id` ONLY: it is `None` on EVERY Deep caller and the
    `workflow_runs.id` on a workflow phase (inherited by sub-agents at `task_service.py:625`
    with zero plumbing → a sub-agent shares its parent run's context). Returns
    `str(workflow_run_id)` when set, else the `DEEP_CLAIM` sentinel. Do NOT key off `run_id`
    (differs every Deep turn → breaks Deep→Deep reuse) or `parent_run_id` (null on top-level
    runs) — `workflow_run_id` is the only clean discriminator (141-RESEARCH §sub-agent lineage)."""
    wf = getattr(ctx, "workflow_run_id", None)
    return str(wf) if wf is not None else DEEP_CLAIM


async def resolve_template_source(
    *,
    pool: "asyncpg.Pool",
    supabase: "Client",
    thread_id: str,
    user_id: str,
    asset_ref: Any | None = None,  # AssetRef | None — library path (trusted)
    own_claim: str | None = None,  # Phase 141 (COLL-02) — the caller's run-context claim
) -> dict:
    """Resolve template bytes by PROVENANCE (D-02/D-09).

    Returns ``{"bytes": bytes|None, "filename": str|None,
    "provenance": "library"|"template_input"|None, "mime": str|None,
    "error": str|None}``. On any failure returns ``bytes=None`` + a relay-able error
    string — NEVER raises a raw 404 / never returns another user's bytes.

    Branch selection is by source, NOT by content (D-02): an ``asset_ref`` resolves the
    trusted library path; ``asset_ref is None`` resolves the untrusted ephemeral upload.

    Phase 141 (COLL-02) — ``own_claim`` run-scopes the ephemeral Branch 2 ONLY. It is the
    resolving run-context's lineage (``str(workflow_run_id)`` or the ``'deep'`` sentinel,
    derived by the callers via ``own_claim_for_ctx`` / raw-bag ``run_id``). Branch 1 (the
    trusted library path) ignores it. ``own_claim=None`` (legacy / Branch-1-only callers)
    is a pure no-op — pre-141 behavior, no claim predicate, no stamp.
    """
    # ── Branch 1: Library AssetRef (trusted → docxtpl) ──────────────────────────────
    if asset_ref is not None:
        filename = getattr(asset_ref, "filename", None)
        mime = getattr(asset_ref, "mime", None)
        asset_id = getattr(asset_ref, "asset_id", None)
        if not asset_id:
            return _result(
                provenance="library",
                filename=filename,
                mime=mime,
                error=f"Library template '{filename or 'unknown'}' is missing its storage reference.",
            )
        try:
            # asset_id is the Storage path in the workspace-files bucket (RESEARCH Q1:
            # the seeded fixture lives at {user_id}/_library/...). Blocking download is
            # run_in_threadpool-wrapped inside _read_from_storage (D-v2.5-01).
            data = await _read_from_storage(supabase, asset_id)
        except Exception:
            # NEVER surface a raw 404 / traceback — relay a clean message (D-05).
            logger.warning(
                "Library template download failed for asset_id=%s (relaying clean error)",
                asset_id,
            )
            return _result(
                provenance="library",
                filename=filename,
                mime=mime,
                error=f"Library template '{filename or asset_id}' could not be loaded.",
            )
        return _result(
            bytes=data,
            provenance="library",
            filename=filename,
            mime=mime,
            error=None,
        )

    # ── Branch 2: Ephemeral upload (untrusted → run_replace) ────────────────────────
    # Newest-wins per 100/D-14. User-scoped on created_by (RLS backstop, V4): a
    # cross-user thread yields no row → the clean "no template" error below, never
    # another user's bytes. Mirror template_service.py:105 WHERE clause + the 100 D-10
    # read gate (expires_at IS NULL OR expires_at > now()).
    #
    # Phase 141 (COLL-02): the WHERE now also carries the run-lineage claim
    # `(run_claim IS NULL OR run_claim = $3 OR $3 IS NULL)` — the `OR $3 IS NULL` arm
    # makes `own_claim=None` (legacy / Branch-1-only callers) a pure no-op (pre-141
    # behavior, single static query, no dynamic SQL). This mirrors the pure
    # `claim_visible` helper (the single source of the run-eligibility truth).

    def _foreign_error() -> dict:
        # D-141-05: name the condition ONLY — never the foreign run's id/filename/bytes.
        return _result(
            provenance="template_input",
            error=(
                "This template belongs to a different run or context. "
                "Upload it again for this run."
            ),
        )

    row = await pool.fetchrow(
        """
        SELECT id, thread_id, path, mime_type, content_inline,
               content_storage_path, created_by, created_at, kind, expires_at, run_claim
        FROM workspace_files
        WHERE thread_id = $1
          AND created_by = $2
          AND kind = 'template_input'
          AND (expires_at IS NULL OR expires_at > now())
          AND (run_claim IS NULL OR run_claim = $3 OR $3 IS NULL)
        ORDER BY created_at DESC
        LIMIT 1
        """,
        thread_id,
        user_id,
        own_claim,
    )

    file_row = dict(row) if row is not None else None

    # In-code claim mirror (defense-in-depth + faithful offline repro): the WHERE above
    # already filters foreign rows in the live DB, but the offline recorder does NOT
    # evaluate the predicate — and any future WHERE drift must never leak foreign bytes.
    # `claim_visible` encodes the SAME truth as the SQL (Plan 01), so re-checking here can
    # never disagree with the WHERE.
    if (
        file_row is not None
        and own_claim is not None
        and not claim_visible(file_row.get("run_claim"), own_claim)
    ):
        return _foreign_error()

    if file_row is None:
        # Row-not-found probe chain (Pitfall 4 ordering: eligible → FOREIGN → expired →
        # never). FIRST, when own_claim is set, distinguish a foreign-claimed non-expired
        # row (honest "belongs to a different run" relay) from a genuinely absent/expired
        # template — WITHOUT ever reading the foreign row's bytes / id / filename (D-141-05).
        if own_claim is not None:
            foreign_row = await pool.fetchrow(
                """
                SELECT id
                FROM workspace_files
                WHERE thread_id = $1
                  AND created_by = $2
                  AND kind = 'template_input'
                  AND (expires_at IS NULL OR expires_at > now())
                  AND run_claim IS NOT NULL
                  AND run_claim <> $3
                ORDER BY created_at DESC
                LIMIT 1
                """,
                thread_id,
                user_id,
                own_claim,
            )
            if foreign_row is not None:
                return _foreign_error()

        # Distinguish "expired" from "never uploaded" by dropping the expiry gate (D-10):
        # a row that exists but is gated-out is expired; truly no row → not uploaded.
        # Still user-scoped (cross-user → no row here either → "no template", never 403).
        expired_row = await pool.fetchrow(
            """
            SELECT id, path
            FROM workspace_files
            WHERE thread_id = $1
              AND created_by = $2
              AND kind = 'template_input'
            ORDER BY created_at DESC
            LIMIT 1
            """,
            thread_id,
            user_id,
        )
        if expired_row is not None:
            return _result(
                provenance="template_input",
                filename=_filename_from_path(expired_row.get("path")),
                error="This template has expired. Upload it again.",
            )
        return _result(
            provenance="template_input",
            error=(
                "No template uploaded to this thread. "
                "Upload a .docx/.pptx/.xlsx first."
            ),
        )

    # The eligible row is visible to this run-context. Phase 141 (D-141-03): claim it on
    # first resolve via a CONDITIONAL, race-safe UPDATE — only an unclaimed row is stamped,
    # and only when the caller supplied an own_claim (legacy callers skip the stamp). The
    # stamp is a non-blocking asyncpg execute (CLAUDE.md D-v2.5-01 — no run_in_threadpool).
    if own_claim is not None and file_row.get("run_claim") is None:
        status = await pool.execute(
            "UPDATE workspace_files SET run_claim = $1 WHERE id = $2 AND run_claim IS NULL",
            own_claim,
            file_row.get("id"),
        )
        # Pitfall 2 / T-141-03 — losing race: our conditional stamp affected 0 rows because
        # another context claimed it first. Re-SELECT the claim; if it is now foreign, relay
        # the honest error rather than returning bytes.
        if isinstance(status, str) and status.strip().upper().endswith(" 0"):
            recheck = await pool.fetchrow(
                "SELECT run_claim FROM workspace_files WHERE id = $1",
                file_row.get("id"),
            )
            current = dict(recheck).get("run_claim") if recheck is not None else None
            if not claim_visible(current, own_claim):
                return _foreign_error()

    filename = _filename_from_path(file_row.get("path"))
    mime = file_row.get("mime_type")
    try:
        data = await _get_file_content(pool, supabase, file_row)
    except Exception:
        logger.warning(
            "Ephemeral template read failed for workspace_file=%s (relaying clean error)",
            file_row.get("id"),
        )
        return _result(
            provenance="template_input",
            filename=filename,
            mime=mime,
            error=f"Uploaded template '{filename or 'file'}' could not be read.",
        )
    return _result(
        bytes=data,
        provenance="template_input",
        filename=filename,
        mime=mime,
        error=None,
    )
