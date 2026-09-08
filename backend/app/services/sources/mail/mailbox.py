"""Phase 240 (SRC-05 / D-240-02 · D-240-03 · D-240-12 · D-240-13) — the mail SHAPE.

⭐ **THIS MODULE IS THE PHASE'S THESIS, AND IT IS DELIBERATELY PROVIDER-BLIND.** Phase 240's
title claims mail is a *shape*, not a fourth adapter. A shape is only a shape if the part that
is not Gmail can be pointed at something that is not Gmail — so everything here is about
messages and mailboxes in the abstract, and everything Google-specific lives one file over in
``gmail.py``.

⛔ **DO NOT IMPORT ANYTHING GOOGLE-SHAPED INTO THIS FILE.** It is listed in
``test_boundary_fence.py``'s ``FENCED_MODULES``, so a provider literal here fails a test by
name. That fence is not decoration: ``sources/base.py``'s own comments record provider branching
being removed from the contract module **twice**, and the second time it had sat three lines from
the guard that was supposed to catch it.

## Why a namespace prefix rather than a new contract field

``SourceRegistry`` resolves ONE adapter per connection, and the Gmail mailbox **is** the Google
connection — one row, one token, one consent, one place to revoke (``oauth_service.py``, BUS-037
§B: *"one connection, not two"*). So a mail folder and a Drive folder travel through the same
``folder_id`` parameter, and something has to tell them apart. The two available moves were a new
field on ``SourceFile`` / ``SourceNode``, or a namespaced id.

A new field loses the phase: ``base.py`` closing byte-identical is the evidence that mail cost
the contract nothing, and ``test_240_contract_unchanged.py`` asserts exactly that by field-name
set. A prefix costs the contract nothing at all.

⚠ **TWO PREFIXES, NOT ONE.** ``mailbox:`` for folders and ``mailmsg:`` for messages, so a
delegation test can never confuse the two. One shared prefix would have made
``is_mail(folder_or_file_id)`` ambiguous at exactly the call site where guessing wrong means
reading a message id as a label.

⚠ Drive ids are base64url-ish (``0ABCdef…``) and contain no ``:``, so the namespaces cannot
collide with a real Drive id.
"""

from __future__ import annotations

from app.services.email_extraction_service import sanitize_attachment_filename
from app.services.sources.base import SourceFile, SourceNode

#: The third virtual root, returned beside the two the adapter already offers.
MAIL_ROOT_ID = "mailbox_root"
MAIL_ROOT_NAME = "Mail"

FOLDER_PREFIX = "mailbox:"
FILE_PREFIX = "mailmsg:"

#: Every message is handed to the pipeline as RFC-822 bytes, which is what makes it land on the
#: SAME ``parse_eml_bytes`` a hand-uploaded ``.eml`` lands on. One parser, two doors.
MAIL_MIME = "message/rfc822"

#: ⚠ SMALLER THAN DRIVE'S 30, ON PURPOSE (D-240-12). Google's own reference states that
#: ``users.messages.list`` returns *"only an `id` and a `threadId`"* per message, so a page of
#: N messages costs N+1 requests once subjects and sizes are fetched. The alternative — naming
#: every row by its message id — would reduce Phase 233's honest preview labels to hex, which is
#: the one thing that phase existed to prevent. ``service_tools.py``'s ``search_email`` already
#: caps at 25 for the same stated reason; this matches it rather than inventing a second number.
MAIL_PAGE_SIZE = 25

#: What a message with no Subject header is called. NEVER an empty string: an empty filename
#: propagates into storage paths and into the Library list as a blank row.
NO_SUBJECT_NAME = "(no subject)"


def is_mail_folder(folder_id: str | None) -> bool:
    """True for the mail root and for any label id."""
    if not folder_id:
        return False
    return folder_id == MAIL_ROOT_ID or folder_id.startswith(FOLDER_PREFIX)


def is_mail_file(file_id: str | None) -> bool:
    """True for a namespaced message id."""
    return bool(file_id) and str(file_id).startswith(FILE_PREFIX)


def strip_folder_prefix(folder_id: str) -> str:
    """The provider's own label id, with the namespace removed."""
    return folder_id[len(FOLDER_PREFIX):] if folder_id.startswith(FOLDER_PREFIX) else folder_id


def strip_file_prefix(file_id: str) -> str:
    """The provider's own message id, with the namespace removed."""
    return file_id[len(FILE_PREFIX):] if file_id.startswith(FILE_PREFIX) else file_id


def mail_root_node() -> SourceNode:
    """The third virtual root. Returned WITHOUT a network call, exactly like the other two.

    ⚠ The no-network property is load-bearing rather than an optimisation: the roots are what a
    person sees the instant the picker opens, and a root list that costs a round trip to the mail
    API is a root list that fails for anyone whose token predates the mail scope.
    """
    return SourceNode(id=MAIL_ROOT_ID, name=MAIL_ROOT_NAME, kind="folder", has_children=True)


def label_to_node(label_id: str, label_name: str) -> SourceNode:
    """A mail label, wearing the shape of a folder."""
    return SourceNode(
        id=f"{FOLDER_PREFIX}{label_id}",
        name=label_name or label_id,
        kind="folder",
        has_children=False,
        parent_id=MAIL_ROOT_ID,
    )


def message_filename(subject: str | None) -> str:
    """A message Subject, made safe to be a filename.

    ⛔ TM-240-02. A Subject is text a stranger chose, and this Library has already paid for
    treating one as safe: during v3.7 UAT a NUL byte inside a ``.msg`` subject produced a
    Postgres ``22P05`` that 5,438 green tests had missed. The sanitiser is the one that already
    guards attachment filenames — reused rather than re-written, so there is one rule to audit.
    """
    cleaned = sanitize_attachment_filename((subject or "").strip() or NO_SUBJECT_NAME)
    stem = cleaned[:-4] if cleaned.lower().endswith(".eml") else cleaned
    stem = stem.strip() or NO_SUBJECT_NAME
    return f"{stem}.eml"


def message_to_file(
    *,
    message_id: str,
    subject: str | None,
    internal_date: str | None,
    size: int | None,
    label_name: str | None,
) -> SourceFile:
    """A message, wearing the shape of a file (D-240-13).

    ⭐ ``modified_at`` carries the provider's internal timestamp rather than the ``Date`` header,
    because Google's own reference calls ``internalDate`` *"more reliable than the `Date`
    header"* — and because a message is immutable, so a watch pass never re-reads one it has
    already seen. That is what makes a mailbox cheap to watch.

    ⭐ ``path`` is a REAL breadcrumb, not the fabricated ``/<filename>`` SEED-253 recorded.
    Mail closes that seed's gap on arrival: a message's folder is exactly its label.
    """
    return SourceFile(
        id=f"{FILE_PREFIX}{message_id}",
        name=message_filename(subject),
        mime_type=MAIL_MIME,
        size=size,
        modified_at=str(internal_date) if internal_date is not None else None,
        path=f"/{label_name}" if label_name else None,
    )
