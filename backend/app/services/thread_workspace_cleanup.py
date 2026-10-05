"""Phase 274 (ATT-01 / D-08) — a deleted thread takes its attachment BYTES with it.

Two thin async-service functions, mirroring the ``template_service.py`` thin-seam shape (all
logic here; main.py / threads.py gain only delegating call-throughs so the G-5 hot file
threads.py never grows inline query/Storage logic):

- ``collect_thread_workspace_paths`` — every non-null bucket path of the thread's
  ``workspace_files`` rows AND their ``workspace_file_versions`` rows. Called BEFORE the
  ``threads`` delete, because the FK cascade removes the rows that name the paths.
- ``remove_workspace_paths`` — removes those paths from the workspace bucket in chunks of at
  most 100. Called AFTER the ``threads`` delete returns, so a failed delete never leaves rows
  pointing at removed bytes.

⛔ THE D-08 CONTRACT.
  * USER-JWT client only. RLS (``workspace_files_select_own`` / ``workspace_versions_select_own``)
    decides which rows are visible, so a foreign thread id yields ``[]``; the storage policy
    ``workspace_storage_delete_own`` (first folder = ``auth.uid()``) decides what is deletable.
    No service-role client is used anywhere on this path.
  * Belt over that policy: a path whose first segment is not the caller's user id is dropped
    and logged, never asked for.
  * Supabase Storage has no prefix delete and ``list()`` is one level deep, so the DB-derived
    set is the only complete set. Only files over the inline threshold (256 KB) live in the
    bucket at all; smaller ones are ``content_inline`` and leave with the cascade.
  * Best-effort, LOGGED: a collect or remove failure is a ``logger.warning`` and never blocks
    the delete. Never a bare ``pass`` — an invisible failure is how bytes orphan silently.
"""

from __future__ import annotations

import logging

from starlette.concurrency import run_in_threadpool

from app.services.workspace_service import BUCKET_NAME
from app.utils.db import aexec

logger = logging.getLogger(__name__)

#: Storage ``remove`` takes a list; a bounded chunk keeps one request small and lets a single
#: failed chunk leave the rest of the removal intact.
REMOVE_CHUNK = 100
#: Bounds the ``in_`` list on the versions read, so a thread with many files cannot build an
#: over-long request URL.
_ID_CHUNK = 100


async def collect_thread_workspace_paths(supabase, thread_id: str, user_id: str) -> list[str]:
    """Return the sorted, unique, non-null bucket paths of this thread's workspace files.

    Reads through the passed USER-JWT client (RLS decides visibility). Never raises: a read
    failure logs a warning and returns ``[]`` — the thread delete must go ahead regardless.
    """
    try:
        files = await aexec(
            supabase.table("workspace_files")
            .select("id, content_storage_path")
            .eq("thread_id", thread_id)
        )
        file_rows = files.data or []
        paths = {r["content_storage_path"] for r in file_rows if r.get("content_storage_path")}
        ids = [r["id"] for r in file_rows if r.get("id")]
        for start in range(0, len(ids), _ID_CHUNK):
            versions = await aexec(
                supabase.table("workspace_file_versions")
                .select("content_storage_path")
                .in_("workspace_file_id", ids[start : start + _ID_CHUNK])
            )
            paths.update(
                r["content_storage_path"]
                for r in (versions.data or [])
                if r.get("content_storage_path")
            )
    except Exception as exc:
        logger.warning(
            "Thread delete %s: could not collect workspace storage paths (%s); "
            "no attachment bytes will be removed",
            thread_id,
            exc,
        )
        return []

    owned = sorted(p for p in paths if p.split("/", 1)[0] == user_id)
    foreign = len(paths) - len(owned)
    if foreign:
        logger.warning(
            "Thread delete %s: dropped %d workspace storage path(s) outside the caller's "
            "user prefix; they are not removed",
            thread_id,
            foreign,
        )
    return owned


async def remove_workspace_paths(supabase, paths: list[str], thread_id: str | None = None) -> None:
    """Remove ``paths`` from the workspace bucket in chunks of at most ``REMOVE_CHUNK``.

    Never raises: a failed chunk is logged with its size and the thread it belonged to
    (T-274-04 — an orphaned-bytes report must trace back to its delete), and the remaining
    chunks are still attempted.
    """
    for start in range(0, len(paths), REMOVE_CHUNK):
        chunk = paths[start : start + REMOVE_CHUNK]
        try:
            await run_in_threadpool(supabase.storage.from_(BUCKET_NAME).remove, chunk)
        except Exception as exc:
            logger.warning(
                "Thread delete %s: failed to remove %d workspace storage object(s) (%s); "
                "those bytes are orphaned",
                thread_id,
                len(chunk),
                exc,
            )
