"""Phase 240 (SRC-05) — mail as a SHAPE carried by the adapters that already exist.

⛔ **THIS PACKAGE MUST NOT IMPORT AN ADAPTER.** ``sources/__init__.py`` eagerly imports every
adapter to populate the registry, and an adapter imports this package — so an import back the
other way is a cycle that would break registration for every source family, not just mail.

The split is the whole point (D-240-03): ``mailbox`` knows about mailboxes and knows nothing
about Google; ``gmail`` knows about Google. A second family is a third module beside them.
"""

from app.services.sources.mail import gmail, mailbox
from app.services.sources.mail.mailbox import (
    FILE_PREFIX,
    FOLDER_PREFIX,
    MAIL_MIME,
    MAIL_PAGE_SIZE,
    MAIL_ROOT_ID,
    is_mail_file,
    is_mail_folder,
    label_to_node,
    mail_root_node,
    message_filename,
    message_to_file,
    strip_file_prefix,
    strip_folder_prefix,
)

__all__ = [
    "FILE_PREFIX",
    "FOLDER_PREFIX",
    "MAIL_MIME",
    "MAIL_PAGE_SIZE",
    "MAIL_ROOT_ID",
    "gmail",
    "is_mail_file",
    "is_mail_folder",
    "label_to_node",
    "mail_root_node",
    "mailbox",
    "message_filename",
    "message_to_file",
    "strip_file_prefix",
    "strip_folder_prefix",
]
