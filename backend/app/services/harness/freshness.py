"""Phase 102 (GATE-01 / D-09) — net-new deterministic KB-freshness queries.

Two pure READ checks against a workflow's resolved ``folder_scope`` (the 098
project-folder binding, PROJ-02 — server-side resolved folder ids, NEVER a
prompt-supplied scope). The ``freshness`` validator (``validator_kinds.py``,
``timing="pre"``) wraps these; the engine resolves them with ``ctx.pool`` + the
phase's ``folder_scope``.

Two v1 checks (deterministic only — semantic/fuzzy dedup is deferred per CONTEXT):
  1. ``newest_document_age_days`` — the age in days of the newest document in scope
     (stale-source check vs the per-workflow ``max_age_days``; NO global default).
  2. ``exact_stem_collisions`` — documents grouped by filename stem (extension
     stripped); groups of >= 2 distinct documents sharing a stem (the version
     ambiguity ``report-v2.docx`` / ``report-v3.docx`` finding for ``ask_user``).

SECURITY (T-102-03-05 — Information Disclosure): both queries bind the scope with
``ANY($1::uuid[])`` — ``$N`` placeholders ONLY, NEVER f-string SQL — and read ONLY
the documents whose ``folder_id`` is in the caller-supplied resolved scope. The
``documents`` table columns are confirmed against ``supabase/full-schema.sql``:
``created_at`` (the upload/creation timestamp), ``filename``, ``folder_id``.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

__all__ = ["newest_document_age_days", "exact_stem_collisions"]


def _stem(filename: str) -> str:
    """The filename with its extension stripped (``report-v2.docx`` -> ``report-v2``).

    Uses ``os.path.splitext`` (stdlib) — splits on the LAST dot only, so a
    dotted name keeps its earlier dots (``a.b.docx`` -> ``a.b``). A name with no
    extension returns itself.
    """
    return os.path.splitext(filename)[0]


async def newest_document_age_days(
    pool: Any, folder_ids: list[UUID]
) -> float | None:
    """Age in days of the NEWEST document in the resolved ``folder_ids`` scope.

    ``SELECT max(created_at) FROM documents WHERE folder_id = ANY($1::uuid[])`` —
    ``$N`` only (T-102-03-05). Returns ``None`` when the scope is empty OR no
    document exists in it (an empty scope is "no freshness signal", NOT stale —
    the validator decides what to do with ``None``). The age is computed against
    ``datetime.now(timezone.utc)`` so it is timezone-correct.
    """
    if not folder_ids:
        return None
    row = await pool.fetchrow(
        """
        SELECT max(created_at) AS newest
        FROM documents
        WHERE folder_id = ANY($1::uuid[])
        """,
        list(folder_ids),
    )
    newest = row["newest"] if row is not None else None
    if newest is None:
        return None
    if newest.tzinfo is None:
        newest = newest.replace(tzinfo=timezone.utc)
    delta = datetime.now(timezone.utc) - newest
    return delta.total_seconds() / 86400.0


async def exact_stem_collisions(
    pool: Any, folder_ids: list[UUID]
) -> list[dict]:
    """Documents in scope sharing an exact filename STEM (the version-ambiguity check).

    ``SELECT filename FROM documents WHERE folder_id = ANY($1::uuid[])`` — ``$N``
    only (T-102-03-05) — then group by the extension-stripped stem in Python.
    Returns groups with >= 2 DISTINCT filenames sharing a stem, deterministic v1
    only (exact-stem; NO semantic/fuzzy dedup — deferred per CONTEXT):

        [{"stem": "report-v", "filenames": ["report-v2.docx", "report-v3.docx"]}]

    The app's own version history (``documents.is_latest`` / ``version_number``)
    already de-duplicates true re-uploads of the SAME filename (a v2 of
    ``report.docx`` is the same stem AND filename, not a collision), so this check
    targets DISTINCT filenames that collapse to one stem — the ``report-v2`` /
    ``report-v3`` case the author cannot disambiguate without asking. Empty scope
    -> ``[]``. Deterministic ordering (sorted) so the finding is reproducible.
    """
    if not folder_ids:
        return []
    rows = await pool.fetch(
        """
        SELECT filename
        FROM documents
        WHERE folder_id = ANY($1::uuid[])
        """,
        list(folder_ids),
    )
    by_stem: dict[str, set[str]] = {}
    for r in rows:
        fname = r["filename"]
        if not fname:
            continue
        by_stem.setdefault(_stem(fname), set()).add(fname)
    collisions: list[dict] = []
    for stem, fnames in by_stem.items():
        if len(fnames) >= 2:
            collisions.append({"stem": stem, "filenames": sorted(fnames)})
    collisions.sort(key=lambda c: c["stem"])
    return collisions
