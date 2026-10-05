"""Save a thread attachment to the Library — Phase 274 (ATT-03 / D-09..D-14, D-22, D-27, D-28).

Promotion is the ONE deliberate act that carries a file from a conversation into the Library. A chat
attachment lives in `workspace_files` for as long as its thread does (ATT-01); this door copies it,
on request, into a folder the person picks — through the Library's own minter, refusals, dedup and
versioning, never a second ingest path.

⭐ **Deliberately its own module, never `app/api/workspace.py`.** That module carries a source fence
(`test_244_cloud_attach_is_thread_scoped.py`) forbidding any reach to the minter — that absence IS
the structural guarantee *"the chat door cannot write the Library"*. This module is the one place
the reach is allowed, and `test_274_minter_inventory.py` pins it as the sixth and last minter caller.
It also keeps `workspace.py`, `documents.py` and `ingest_splice.py` (all G-5 FIRING) untouched (D-19).

**The read order (D-12, the BUG-260903-02 shape).** Thread ownership first (404), then the
attachment row and its bytes through the person's own user-JWT connection (RLS), and only then a
mint. No service-role client is created anywhere in this module: the bytes come from the RLS read,
and the service role appears only inside the shared `_enqueue_or_splice`, after the document exists.

**The rules the minter already decides, and this door does not re-decide:**
- *Rights* — whoever can upload into the folder through the Library can promote into it. The
  minter's `404 Folder not found` / `403 Cannot upload to a folder you do not own` reach the caller
  verbatim. This module never reads `folders` (D-12).
- *Duplicates* (D-13) — the same bytes already completed in this person's Library (in this org) are
  LINKED, not copied: 200 `already`, naming the EXISTING copy's folder even when it differs from the
  one picked.
- *Versions* (D-14) — a same-named file in the CHOSEN folder becomes the next version. The minter is
  called with `version_scope="folder"`, so a same-named file in another folder is never retired.

**The parameters that matter** — `version_scope="folder"`, `org_id=<active org>`,
`on_conflict="link"` (a double-click race collapses into a duplicate, T-274-16). ⚠ This door is
deliberately ORG-scoped, unlike `/documents/upload`, which passes no `org_id` (SEED-313, accepted).

The preview (`preview_promotion`) asks the minter's two questions read-only. It DUPLICATES the two
predicates rather than sharing a helper, because `ingest_splice.py` stays byte-unchanged;
`test_274_promote_preview_parity.py` is what holds the copies equal.
"""
from __future__ import annotations

import hashlib
import logging
import re

from supabase import Client

# D-22: the Library door's own lists, imported — never a second allow-list here.
from app.api.documents import ALLOWED_MIME_TYPES, _EXT_MIME_OVERRIDES
from app.models.workspace_promote import DuplicateOf, PromotePreview
from app.utils.db import aexec

logger = logging.getLogger(__name__)

#: The prefix `workspace.py` stamps on a stored upload: `/{uuid4().hex[:8]}-{safe_name}`.
#: ⛔ Lowercase only, exactly eight — the stamp is `uuid4().hex`, which never emits uppercase, so an
#: uppercase run is a person's own name. Mirrored lockstep in `frontend/src/lib/attachmentLifetime.ts`.
WORKSPACE_UPLOAD_PREFIX = re.compile(r"^[0-9a-f]{8}-")


def library_filename(path: str) -> str:
    """The name the Library document gets: the basename, with the stored prefix removed (D-27).

    Without this, D-14's same-name versioning could never match a person's real file. Never
    returns an empty string: a name that is ONLY the prefix keeps it.
    """
    base = (path or "").rsplit("/", 1)[-1]
    stripped = WORKSPACE_UPLOAD_PREFIX.sub("", base, count=1)
    return stripped or base


def _ext(filename: str) -> str:
    return "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def library_mime(filename: str, row_mime: str | None) -> str:
    """The MIME the Library mints with: its own extension table FIRST, then the row's (D-27).

    The workspace row's MIME is the PLATFORM's `mimetypes` guess, and it differs by box (`.csv`
    reads `application/vnd.ms-excel` on Windows, `.webp` reads `application/octet-stream`).
    """
    return _EXT_MIME_OVERRIDES.get(_ext(filename)) or row_mime or "application/octet-stream"


def promotability(filename: str, row_mime: str | None) -> tuple[bool, str | None]:
    """Can the Library take this file? `(True, None)`, or `(False, <the Library's own sentence>)`.

    D-22: gated on the imported `ALLOWED_MIME_TYPES`, after `library_mime`, and refused in the
    sentence shape `/documents/upload` uses — derived from the set, never re-typed.
    """
    mime = library_mime(filename, row_mime)
    if mime in ALLOWED_MIME_TYPES:
        return True, None
    return False, (
        f"Unsupported file type: {mime}. "
        f"Allowed: {', '.join(sorted(ALLOWED_MIME_TYPES))}."
    )


async def preview_promotion(
    supabase: Client,
    *,
    raw: bytes,
    filename: str,
    user_id: str,
    org_id: str,
    folder_id: str,
) -> PromotePreview:
    """What saving `raw` as `filename` into `folder_id` would do — without doing it (D-14).

    Mirrors `ingest_splice.mint_document_row`'s two predicates, in its order:
      1. dedup — user_id + content_hash + status='completed' + org_id. A hit wins: the minter
         returns before it ever looks at versions (D-13).
      2. folder-scoped version — user_id + filename + org_id + folder_id, highest version + 1.

    ⛔ Read-only. ⛔ Never reads `folders` — whether the person may write there is the minter's
    answer on confirm (D-12), and a refusal surfaces then, verbatim.
    """
    content_hash = hashlib.sha256(raw).hexdigest()

    dup = await aexec(
        supabase.table("documents")
        .select("id, folder_id, version_number")
        .eq("user_id", user_id)
        .eq("content_hash", content_hash)
        .eq("status", "completed")
        .eq("org_id", org_id)
        .limit(1)
    )
    if dup.data:
        existing = dup.data[0]
        return PromotePreview(
            promotable=True,
            refusal=None,
            filename=filename,
            duplicate_of=DuplicateOf(
                document_id=str(existing["id"]),
                folder_id=str(existing["folder_id"]) if existing.get("folder_id") else None,
            ),
            next_version=existing.get("version_number", 1),
        )

    versions = await aexec(
        supabase.table("documents")
        .select("id, version_number")
        .eq("user_id", user_id)
        .eq("filename", filename)
        .eq("org_id", org_id)
        .eq("folder_id", folder_id)
        .order("version_number", desc=True)
        .limit(1)
    )
    next_version = versions.data[0]["version_number"] + 1 if versions.data else 1
    return PromotePreview(
        promotable=True,
        refusal=None,
        filename=filename,
        duplicate_of=None,
        next_version=next_version,
    )
