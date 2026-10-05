"""Phase 274 (ATT-03) — the wire contract of the Save-to-Library door.

Three routes in `app/api/workspace_promote.py` speak these models, and 274-03's client
(`frontend/src/lib/api/attachments.ts`) reads every field name below verbatim. ⛔ A renamed field
is a silent `undefined` in the dialog, never a type error — so the names are pinned by
`test_274_promote_helpers.py`, and 274-05 fences them against the client.
"""
from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

#: What a promote did. Migration 203's `workspace_files_library_link_check` holds exactly these.
#:   - `saved`   — a new Library document was minted from the attachment.
#:   - `already` — the same bytes were already in this person's Library (in this org), so the
#:                 attachment was LINKED to that document and nothing was copied (D-13).
LibraryLink = Literal["saved", "already"]


class PromoteRequest(BaseModel):
    """Phase 274 (ATT-03 / D-10) — save ONE thread attachment into a Library folder.

    ⛔ A FOLDER IS REQUIRED. There is no default and no Root sentinel: an unset folder is refused
    by validation, never read as "the top of the Library" (D-10, the D-244-06 rule that a chat
    door never writes to a root it did not name).

    ⛔ `extra="forbid"`: the body carries a folder and nothing else. The org comes ONLY from the
    membership-validated `X-Org-Id` dependency, so no body key can choose one (T-274-13).
    """

    model_config = ConfigDict(extra="forbid")

    #: The Library folder to save into. The minter's folder-owner check is the authority (D-12).
    folder_id: UUID


class PromoteResult(BaseModel):
    """POST .../promote — 201 with `saved`, 200 with `already`.

    ⚠ On `already`, `folder_id` is the EXISTING document's folder, which may differ from the one
    picked. The dialog says so rather than hiding it (D-13).
    """

    outcome: LibraryLink
    document_id: str
    folder_id: str | None
    document_status: str
    filename: str
    version_number: int | None


class DuplicateOf(BaseModel):
    """The completed Library copy that holds the same bytes (D-13)."""

    document_id: str
    folder_id: str | None


class PromotePreview(BaseModel):
    """GET .../promote-preview — what confirming WOULD do, read-only (D-14).

    - `promotable: false` + `refusal` — the Library refuses this type (D-22); nothing is hashed.
    - `duplicate_of` set — the same bytes are already in the Library; confirming links to that
      copy. `next_version` then carries that copy's version number, exactly what the minter
      returns for a duplicate (`MintResult.version_number`), so the parity test can hold the two
      equal in every case. The dialog keys its warning on `duplicate_of`, never on this number.
    - otherwise `next_version` — the version the new document will be in the chosen folder.
      `1` is a fresh document; anything above it is a new version of a same-named file THERE.
    """

    promotable: bool
    refusal: str | None
    filename: str
    duplicate_of: DuplicateOf | None
    next_version: int | None


class LibraryLinkInfo(BaseModel):
    """An attachment's `In Library` mark, built only from a document the person can still see."""

    document_id: str
    outcome: LibraryLink
    folder_id: str | None
    document_status: str
    filename: str


class AttachmentLibraryState(BaseModel):
    """One thread attachment: can it be saved, and where is it already."""

    workspace_file_id: str
    promotable: bool
    link: LibraryLinkInfo | None


class LibraryLinksResponse(BaseModel):
    """GET .../library-links — every attachment of the thread, in ONE request (D-15)."""

    files: list[AttachmentLibraryState]
