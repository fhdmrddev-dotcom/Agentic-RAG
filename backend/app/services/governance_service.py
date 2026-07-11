"""Governance service — cross-user platform audit browse + capped CSV export + users roster.

Phase 148 (ADMIN-03). The SC#4-sensitive cross-user read layer: every query here runs with
the service-role client and NO RLS backstop, so it is PARAMETERIZED ($N binds only), explicitly
user-scoped-or-all (a NULL ``user_id`` = the deliberate all-users read; a value = single-user
scope), and ALWAYS paginated (``page_size`` clamped ``<= 100``) — never an unbounded ``SELECT *``
(Pitfall 5 — full-tenant leak). The CSV export is COUNT-first and REFUSES over the cap rather
than silently truncating the filtered set.

Kept a thin, unit-tested core so the ``admin.py`` controllers (148-06) stay thin — there are NO
request handlers here.

Import discipline (breaks the ``dependencies`` <-> service cycle): ``get_pg_pool`` is imported
lazily *inside each function* so importing this module never triggers a partial-import of
``app.dependencies``.
"""
import csv
import io
import json
import logging
from datetime import datetime

from fastapi.responses import StreamingResponse

logger = logging.getLogger(__name__)

# Max page size for any cross-user browse read (no-full-tenant-leak, SC#4). An over-cap
# request is CLAMPED here, never passed through to the LIMIT bind.
_MAX_PAGE_SIZE = 100

# CSV export row cap — over this the export REFUSES (narrow the filter) rather than silently
# truncating the filtered set (Pitfall 5 / RESEARCH §Pattern 3 CSV cap rule).
_CSV_MAX_ROWS = 50000

# Explicit column list — code constants, NEVER interpolated user input (SELECT * is banned).
_AUDIT_COLUMNS = "id, user_id, action_type, metadata, created_at"

# Shared WHERE for the platform audit browse + export (RESEARCH §Pattern 3). Every filter is a
# NULL-guarded $N bind: $1 user scope (NULL = all users), $2 action_type text[] ANY, $3/$4 the
# half-open [since, until) window. No value is ever string-interpolated into the SQL text.
_AUDIT_WHERE = (
    "WHERE ($1::uuid IS NULL OR user_id = $1) "
    "AND ($2::text[] IS NULL OR action_type = ANY($2)) "
    "AND ($3::timestamptz IS NULL OR created_at >= $3) "
    "AND ($4::timestamptz IS NULL OR created_at < $4)"
)


class AuditExportTooLarge(Exception):
    """The filtered audit set exceeds ``_CSV_MAX_ROWS`` — the export refuses (narrow the filter).

    Carries the exact over-cap ``count`` so 148-06's controller can map it to a 413/422 with an
    honest number. A refused export must write NO ``audit.export`` row (148-06 controller job).
    The refusal is a deliberate 4xx and must PROPAGATE — never swallowed like a browse read.
    """

    def __init__(self, count: int):
        self.count = count
        super().__init__(f"Too many rows ({count}) — narrow the filter")


def _clamp_page_size(page_size: int) -> int:
    """Clamp a requested page size into ``[1, _MAX_PAGE_SIZE]`` — never a full-table dump."""
    try:
        return max(1, min(int(page_size), _MAX_PAGE_SIZE))
    except (TypeError, ValueError):
        return _MAX_PAGE_SIZE


async def query_platform_audit(
    user_id: str | None = None,
    action_types: list[str] | None = None,
    since: datetime | None = None,
    until: datetime | None = None,
    page_size: int = 50,
    offset: int = 0,
) -> list[dict]:
    """Cross-user platform ``audit_log`` browse — parameterized, scoped, always paginated.

    ``user_id`` NULL -> the deliberate cross-user read (all users); a value -> single-user scope.
    ``action_types`` is a text[] ``ANY`` filter; ``since``/``until`` a half-open ``[since, until)``
    window. Every filter is a ``$N`` bind (never string-interpolated); the LIMIT is clamped
    ``<= 100`` so the response is never larger than one page (SC#4 no-full-tenant-leak).

    Swallow-and-log posture (mirrors ``operator_service.get_recent_operator_audit``): a DB blip
    returns ``[]`` for a best-effort browse feed rather than raising into the request.
    """
    from app.dependencies import get_pg_pool

    limit = _clamp_page_size(page_size)
    try:
        offset = max(0, int(offset))
    except (TypeError, ValueError):
        offset = 0

    sql = (
        f"SELECT {_AUDIT_COLUMNS} FROM audit_log "
        f"{_AUDIT_WHERE} "
        "ORDER BY created_at DESC "
        "LIMIT $5 OFFSET $6"
    )
    try:
        pool = await get_pg_pool()
        rows = await pool.fetch(sql, user_id, action_types, since, until, limit, offset)
        return [dict(r) for r in rows]
    except Exception as exc:
        logger.error("platform audit browse read failed: %s", exc)
        return []


async def export_platform_audit_csv(
    user_id: str | None = None,
    action_types: list[str] | None = None,
    since: datetime | None = None,
    until: datetime | None = None,
) -> tuple[StreamingResponse, int]:
    """Stream EXACTLY the filtered ``audit_log`` set as CSV; REFUSE over the cap.

    COUNT-first with the SAME parameterized WHERE the browse uses. When the count exceeds
    ``_CSV_MAX_ROWS`` (50000) it raises :class:`AuditExportTooLarge` ("narrow the filter") —
    NEVER a silent truncation. Otherwise it streams the filtered rows via the stdlib
    ``csv.writer`` + ``io.StringIO`` + ``StreamingResponse`` shape (the ``audit.py`` export
    precedent, minus the owner ``.eq(user_id)`` filter) and returns ``(StreamingResponse, count)``
    so 148-06 can stamp ``audit.export`` with the EXACT count.

    Unlike the browse read this does NOT swallow — the over-cap refusal (and any genuine DB
    error) must propagate so the controller maps it to a deliberate 4xx.
    """
    from app.dependencies import get_pg_pool

    pool = await get_pg_pool()

    # COUNT-first (same WHERE) — the cap gate before any streaming.
    count_sql = f"SELECT count(*) FROM audit_log {_AUDIT_WHERE}"
    count = await pool.fetchval(count_sql, user_id, action_types, since, until)
    count = int(count or 0)
    if count > _CSV_MAX_ROWS:
        raise AuditExportTooLarge(count)

    # Stream exactly the filtered set. Belt-and-suspenders LIMIT (== the cap) bounds the fetch
    # without truncating a validated under-cap set.
    data_sql = (
        f"SELECT {_AUDIT_COLUMNS} FROM audit_log "
        f"{_AUDIT_WHERE} "
        "ORDER BY created_at DESC "
        "LIMIT $5"
    )
    raw = await pool.fetch(data_sql, user_id, action_types, since, until, _CSV_MAX_ROWS)
    rows = [dict(r) for r in raw]

    output = io.StringIO()
    writer = csv.writer(output, lineterminator="\n")
    writer.writerow(["timestamp", "user_id", "action_type", "metadata_json"])
    for row in rows:
        meta = row.get("metadata") or {}
        if not isinstance(meta, (dict, list)):
            # metadata may arrive as a JSON string if the JSONB codec is not registered.
            try:
                meta = json.loads(meta)
            except Exception:
                meta = {}
        writer.writerow([
            row.get("created_at", ""),
            row.get("user_id", ""),
            row.get("action_type", ""),
            json.dumps(meta, default=str),
        ])

    output.seek(0)
    stream = StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=platform-audit.csv"},
    )
    return stream, count
