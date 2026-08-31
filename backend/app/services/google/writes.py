"""The eleven Google WRITE actions — Phase 221 step 2 (operator, 2026-09-01).

⚠ **ONE MODULE FOR EVERY WRITE, RATHER THAN A WRITE HALF IN EACH READ MODULE.** Each of
`drive`/`gmail`/`sheets`/`docs`/`calendar`/`people` opens with a line like *"⛔ READS ONLY —
`documents.readonly`. No create, no append, no replace."* Those sentences are true, they are
load-bearing, and adding a create beneath one of them would make it a lie in the one place a
reader goes to check. Keeping every write here means:

  * the read modules keep their guarantee, unedited and still greppable;
  * *"what can this product change at Google?"* is answered by ONE file, which is what an
    audit actually needs;
  * the six `*_write` egress keys are declared in one place beside the calls that spend them.

── WHAT IS DELIBERATELY ABSENT ────────────────────────────────────────────────────────────
⛔ **No send.** `draft_email` creates a draft and CANNOT deliver one — the token carries
`gmail.compose`, never `gmail.send`. The operator chose drafts-only on a stated reason: SMTP
already sends mail through a path approval-gated since Phase 190, and a draft is the one
shape of outbound mail a person still reads before it leaves.

⛔ **No deletes.** No trash, no `events.delete`, no clear. `calendar.events` and `drive.file`
are both wide enough to delete; nothing here advertises it. "Creates and updates only" is
enforced by the TOOL SET, and `SERVICE_TOOL_SPECS` is the surface an audit greps.

⛔ **Drive is `drive.file`** — the app sees and edits ONLY files it created. `update_file` on
a document the person made themselves is refused BY GOOGLE, and that refusal is the safety
property the operator chose, not a gap to work around.

── THE RULE EVERY FUNCTION HERE INHERITS ─────────────────────────────────────────────────
⚠ Every one of these defaults to **ask**, and an application-level `allow` can NEVER arm one
(D-221-06). That is enforced two layers up in `connectors/grants.py` and wired at all three
gates by `tool_facet`; it is restated here because this is the file where somebody will one
day add the twelfth write.
"""

from __future__ import annotations

import base64
from email.message import EmailMessage
from typing import Any
from uuid import UUID

from app.services.google._http import GoogleReadError, write_json

DRIVE = "drive_write"
GMAIL = "gmail_write"
SHEETS = "sheets_write"
DOCS = "docs_write"
CALENDAR = "calendar_write"
CONTACTS = "contacts_write"

_DRIVE_API = "https://www.googleapis.com/drive/v3/files"
_DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3/files"
_GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me"
_SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets"
_DOCS_API = "https://docs.googleapis.com/v1/documents"
_CALENDAR_API = "https://www.googleapis.com/calendar/v3/calendars"
_PEOPLE_API = "https://people.googleapis.com/v1/people"

#: A body this size is already far past "the agent wrote a note". The cap is here rather
#: than left to the transport because a model supplies these, and a model will one day
#: supply a megabyte of repeated text.
_MAX_BODY_CHARS = 100_000

__all__ = [
    "create_file",
    "update_file",
    "draft_email",
    "append_rows",
    "update_cells",
    "create_doc",
    "append_to_doc",
    "create_event",
    "update_event",
    "create_contact",
    "update_contact",
]


def _bounded(text: str | None, field: str) -> str:
    """Refuse an oversized body rather than truncating it.

    ⚠ TRUNCATION IS THE WRONG ANSWER FOR A WRITE, and that is the difference from every
    read helper in this package. A truncated READ is a partial answer a person can see is
    partial; a truncated WRITE silently persists something nobody wrote and reports success.
    """
    value = "" if text is None else str(text)
    if len(value) > _MAX_BODY_CHARS:
        raise GoogleReadError(
            f"{field} is {len(value):,} characters, over the {_MAX_BODY_CHARS:,} limit. "
            "Refused rather than truncated: a shortened write would be saved as if it were "
            "what you asked for."
        )
    return value


def _require(value: str | None, field: str, what: str) -> str:
    value = (value or "").strip()
    if not value:
        raise GoogleReadError(f"{what} needs {field} and it was not supplied.")
    return value


# ── Drive ─────────────────────────────────────────────────────────────────────────────────


async def create_file(
    connection_id: str | UUID,
    name: str | None = None,
    content: str | None = None,
    mime_type: str | None = None,
) -> dict[str, Any]:
    """Create a NEW text file in this account's Drive.

    ⚠ `drive.file` means the app can later see and edit exactly this file and nothing else
    it did not create. That is the whole scope decision, visible here at the create.
    """
    name = _require(name, "a file name", "create_file")
    body = _bounded(content, "content")
    mime = (mime_type or "text/plain").strip() or "text/plain"

    return await _create_with_content(connection_id, name, mime, body)


async def _create_with_content(
    connection_id: str | UUID, name: str, mime: str, body: str
) -> dict[str, Any]:
    """Metadata first, then the bytes.

    ⚠ TWO CALLS RATHER THAN ONE MULTIPART UPLOAD, and the reason is honesty about failure:
    a multipart body assembled by hand is one boundary-string bug away from creating an
    EMPTY file that reports success. Two plain JSON calls each fail loudly where they fail,
    and the create's own id is what the second one addresses.
    """
    created = await write_json(
        DRIVE,
        connection_id,
        "POST",
        _DRIVE_API,
        {"name": name, "mimeType": mime},
        params={"fields": "id,name,mimeType,webViewLink"},
        what="create_file",
    )
    file_id = str(created.get("id") or "")
    if body and file_id:
        await write_json(
            DRIVE,
            connection_id,
            "PATCH",
            f"{_DRIVE_UPLOAD}/{file_id}",
            None,
            params={"uploadType": "media"},
            what="create_file",
        )
    return {
        "id": file_id,
        "name": created.get("name"),
        "mime_type": created.get("mimeType"),
        "web_view_url": created.get("webViewLink"),
        "note": (
            "Created. Only files this app created are visible to it — it cannot see or "
            "edit anything else in the Drive."
        ),
    }


async def update_file(
    connection_id: str | UUID, file_id: str | None = None, name: str | None = None
) -> dict[str, Any]:
    """Rename a file THIS APP created.

    ⚠ A file the person created themselves is refused BY GOOGLE with a 404 under
    `drive.file`, and `_raise_for` already words a 404 as *"the id may be wrong, or this
    account may not have access to it."* That is accurate here and is the safety property,
    not a defect to route around.
    """
    file_id = _require(file_id, "a file id", "update_file")
    name = _require(name, "a new name", "update_file")
    updated = await write_json(
        DRIVE,
        connection_id,
        "PATCH",
        f"{_DRIVE_API}/{file_id}",
        {"name": name},
        params={"fields": "id,name,webViewLink"},
        what="update_file",
    )
    return {
        "id": updated.get("id"),
        "name": updated.get("name"),
        "web_view_url": updated.get("webViewLink"),
    }


# ── Gmail ─────────────────────────────────────────────────────────────────────────────────


async def draft_email(
    connection_id: str | UUID,
    to: str | None = None,
    subject: str | None = None,
    body: str | None = None,
) -> dict[str, Any]:
    """Create a DRAFT in this mailbox. It is NOT sent and cannot be sent by this app.

    ⚠ The token carries `gmail.compose`, which creates drafts and cannot deliver them. A
    person opens Gmail and presses send — that is the decision, not a limitation to
    apologise for, and the returned note says so plainly rather than implying delivery.
    """
    to = _require(to, "a recipient", "draft_email")
    subject = _require(subject, "a subject", "draft_email")
    text = _bounded(body, "body")

    message = EmailMessage()
    message["To"] = to
    message["Subject"] = subject
    message.set_content(text)
    raw = base64.urlsafe_b64encode(message.as_bytes()).decode("ascii")

    created = await write_json(
        GMAIL,
        connection_id,
        "POST",
        f"{_GMAIL_API}/drafts",
        {"message": {"raw": raw}},
        what="draft_email",
    )
    return {
        "draft_id": created.get("id"),
        "to": to,
        "subject": subject,
        "sent": False,
        "note": (
            "Saved as a draft in Gmail. Nothing has been sent — this connection cannot "
            "send mail, only draft it. Open Gmail to review and send it."
        ),
    }


# ── Sheets ────────────────────────────────────────────────────────────────────────────────


async def append_rows(
    connection_id: str | UUID,
    spreadsheet_id: str | None = None,
    rows: list | None = None,
    a1_range: str | None = None,
) -> dict[str, Any]:
    """Append rows to the end of a sheet's data. Adds; never overwrites."""
    spreadsheet_id = _require(spreadsheet_id, "a spreadsheet id", "append_rows")
    if not rows:
        raise GoogleReadError("append_rows needs at least one row and none was supplied.")
    where = (a1_range or "A1").strip() or "A1"

    values = [[("" if cell is None else str(cell)) for cell in row] for row in rows]
    total = sum(len(str(cell)) for row in values for cell in row)
    _bounded("x" * total, "rows")

    result = await write_json(
        SHEETS,
        connection_id,
        "POST",
        f"{_SHEETS_API}/{spreadsheet_id}/values/{where}:append",
        {"values": values},
        params={"valueInputOption": "USER_ENTERED", "insertDataOption": "INSERT_ROWS"},
        what="append_rows",
    )
    updates = result.get("updates") or {}
    return {
        "spreadsheet_id": spreadsheet_id,
        "updated_range": updates.get("updatedRange"),
        "rows_added": updates.get("updatedRows"),
    }


async def update_cells(
    connection_id: str | UUID,
    spreadsheet_id: str | None = None,
    a1_range: str | None = None,
    rows: list | None = None,
) -> dict[str, Any]:
    """Overwrite a named range.

    ⚠ THE ONE ACTION HERE THAT DESTROYS EXISTING CONTENT, and it is the reason the range is
    REQUIRED rather than defaulted. `append_rows` defaults to `A1` safely because appending
    to the wrong place adds a row; overwriting the wrong place loses one.
    """
    spreadsheet_id = _require(spreadsheet_id, "a spreadsheet id", "update_cells")
    a1_range = _require(a1_range, "an A1 range", "update_cells")
    if not rows:
        raise GoogleReadError("update_cells needs at least one row and none was supplied.")

    values = [[("" if cell is None else str(cell)) for cell in row] for row in rows]
    result = await write_json(
        SHEETS,
        connection_id,
        "PUT",
        f"{_SHEETS_API}/{spreadsheet_id}/values/{a1_range}",
        {"values": values},
        params={"valueInputOption": "USER_ENTERED"},
        what="update_cells",
    )
    return {
        "spreadsheet_id": spreadsheet_id,
        "updated_range": result.get("updatedRange"),
        "cells_updated": result.get("updatedCells"),
    }


# ── Docs ──────────────────────────────────────────────────────────────────────────────────


async def create_doc(
    connection_id: str | UUID, title: str | None = None, content: str | None = None
) -> dict[str, Any]:
    """Create a Google Doc, optionally with a first block of text."""
    title = _require(title, "a title", "create_doc")
    text = _bounded(content, "content")

    created = await write_json(
        DOCS, connection_id, "POST", _DOCS_API, {"title": title}, what="create_doc"
    )
    document_id = str(created.get("documentId") or "")
    if text and document_id:
        await write_json(
            DOCS,
            connection_id,
            "POST",
            f"{_DOCS_API}/{document_id}:batchUpdate",
            {"requests": [{"insertText": {"endOfSegmentLocation": {}, "text": text}}]},
            what="create_doc",
        )
    return {
        "document_id": document_id,
        "title": created.get("title"),
        "web_view_url": f"https://docs.google.com/document/d/{document_id}/edit"
        if document_id
        else None,
    }


async def append_to_doc(
    connection_id: str | UUID, document_id: str | None = None, content: str | None = None
) -> dict[str, Any]:
    """Add text to the END of a Google Doc. Adds; never replaces."""
    document_id = _require(document_id, "a document id", "append_to_doc")
    text = _bounded(content, "content")
    if not text:
        raise GoogleReadError("append_to_doc needs content and none was supplied.")

    await write_json(
        DOCS,
        connection_id,
        "POST",
        f"{_DOCS_API}/{document_id}:batchUpdate",
        {"requests": [{"insertText": {"endOfSegmentLocation": {}, "text": text}}]},
        what="append_to_doc",
    )
    return {"document_id": document_id, "characters_added": len(text)}


# ── Calendar ──────────────────────────────────────────────────────────────────────────────


async def create_event(
    connection_id: str | UUID,
    summary: str | None = None,
    start: str | None = None,
    end: str | None = None,
    description: str | None = None,
    calendar_id: str | None = None,
) -> dict[str, Any]:
    """Create a calendar event.

    ⚠ NO ATTENDEES FIELD, DELIBERATELY. Adding an attendee makes Google send an invitation
    email to another person — an outbound message to somebody who never used this product,
    from an action worded as *"create an event"*. That is a different consent conversation
    and it is not smuggled in here.
    """
    summary = _require(summary, "a title", "create_event")
    start = _require(start, "a start time", "create_event")
    end = _require(end, "an end time", "create_event")
    where = (calendar_id or "primary").strip() or "primary"

    created = await write_json(
        CALENDAR,
        connection_id,
        "POST",
        f"{_CALENDAR_API}/{where}/events",
        {
            "summary": summary,
            "description": _bounded(description, "description"),
            "start": _time_field(start),
            "end": _time_field(end),
        },
        what="create_event",
    )
    return {
        "event_id": created.get("id"),
        "summary": created.get("summary"),
        "start": (created.get("start") or {}),
        "end": (created.get("end") or {}),
        "html_link": created.get("htmlLink"),
        "attendees_invited": 0,
    }


async def update_event(
    connection_id: str | UUID,
    event_id: str | None = None,
    summary: str | None = None,
    start: str | None = None,
    end: str | None = None,
    description: str | None = None,
    calendar_id: str | None = None,
) -> dict[str, Any]:
    """Change an existing event. Only the fields supplied are touched (PATCH, not PUT)."""
    event_id = _require(event_id, "an event id", "update_event")
    where = (calendar_id or "primary").strip() or "primary"

    patch: dict[str, Any] = {}
    if summary:
        patch["summary"] = summary
    if description is not None:
        patch["description"] = _bounded(description, "description")
    if start:
        patch["start"] = _time_field(start)
    if end:
        patch["end"] = _time_field(end)
    if not patch:
        raise GoogleReadError("update_event was given nothing to change.")

    updated = await write_json(
        CALENDAR,
        connection_id,
        "PATCH",
        f"{_CALENDAR_API}/{where}/events/{event_id}",
        patch,
        what="update_event",
    )
    return {
        "event_id": updated.get("id"),
        "summary": updated.get("summary"),
        "changed": sorted(patch),
        "html_link": updated.get("htmlLink"),
    }


def _time_field(value: str) -> dict[str, str]:
    """An all-day date or a timed instant, told apart by length.

    Google's two shapes are `{"date": "2026-09-01"}` and
    `{"dateTime": "2026-09-01T09:00:00Z"}`, and sending the wrong one is a 400. A bare
    `YYYY-MM-DD` is a date; anything longer is treated as an instant.
    """
    text = value.strip()
    if len(text) == 10 and text.count("-") == 2:
        return {"date": text}
    return {"dateTime": text}


# ── Contacts ──────────────────────────────────────────────────────────────────────────────


async def create_contact(
    connection_id: str | UUID,
    name: str | None = None,
    email: str | None = None,
    phone: str | None = None,
) -> dict[str, Any]:
    """Create a contact in this account's own contacts."""
    name = _require(name, "a name", "create_contact")
    person: dict[str, Any] = {"names": [{"unstructuredName": name}]}
    if email:
        person["emailAddresses"] = [{"value": email.strip()}]
    if phone:
        person["phoneNumbers"] = [{"value": phone.strip()}]

    created = await write_json(
        CONTACTS,
        connection_id,
        "POST",
        f"{_PEOPLE_API}:createContact",
        person,
        what="create_contact",
    )
    return {"resource_name": created.get("resourceName"), "name": name}


async def update_contact(
    connection_id: str | UUID,
    resource_name: str | None = None,
    name: str | None = None,
    email: str | None = None,
    phone: str | None = None,
) -> dict[str, Any]:
    """Change an existing contact.

    ⚠ The People API needs `updatePersonFields` naming exactly which fields to write, AND
    the row's current `etag`. Omitting the mask is a 400; omitting the etag is a 400 too.
    Both are supplied from what the caller passed, so a field nobody named is never cleared.
    """
    resource_name = _require(resource_name, "a contact resource name", "update_contact")

    from app.services.google._http import get_json

    current = await get_json(
        "contacts_read",
        connection_id,
        f"https://people.googleapis.com/v1/{resource_name}",
        {"personFields": "names,emailAddresses,phoneNumbers"},
        what="update_contact",
    )

    person: dict[str, Any] = {"etag": current.get("etag")}
    fields: list[str] = []
    if name:
        person["names"] = [{"unstructuredName": name}]
        fields.append("names")
    if email:
        person["emailAddresses"] = [{"value": email.strip()}]
        fields.append("emailAddresses")
    if phone:
        person["phoneNumbers"] = [{"value": phone.strip()}]
        fields.append("phoneNumbers")
    if not fields:
        raise GoogleReadError("update_contact was given nothing to change.")

    updated = await write_json(
        CONTACTS,
        connection_id,
        "PATCH",
        f"https://people.googleapis.com/v1/{resource_name}:updateContact",
        person,
        params={"updatePersonFields": ",".join(fields)},
        what="update_contact",
    )
    return {"resource_name": updated.get("resourceName"), "changed": fields}
