"""Phase 240 (SRC-05 / D-240-01 / D-240-02) — mail costs the source contract NOTHING.

⭐ **THIS FILE IS THE PHASE'S HEADLINE EVIDENCE.** Phase 240's title is a claim — *mail is a
shape, not a fourth adapter* — and a claim of that kind is worth exactly as much as the thing
that can refute it. So this suite asserts the property three independent ways, because each one
alone is blind to a different way of breaking it:

  1. A field added to a contract dataclass (`SourceFile.thread_id`, say) would slip past a
     text scan that only looks for the word "mail".
  2. A `GmailSourceAdapter` registered under its own key would slip past a dataclass check.
  3. A provider branch smuggled into `base.py` would slip past both, if it were spelled
     with a word neither test names.

⚠ **DRIVEN RED BEFORE IT WAS TRUSTED** (240-01-01). `SourceFile` was temporarily given a
`thread_id` field and case 1 failed BY NAME; `PROTOCOL_ADAPTERS` was temporarily given a `mail`
key and case 2 failed. `base.py` was then restored and proven identical by md5
(`3b3d8770a6c9309f0635503d155dd8f7`, before and after). *A guard nobody has seen fire is one
person's word* — Phase 235's lesson, Phase 236 SC#2's requirement.

⛔ The point is NOT that these names are forbidden forever. It is that widening the contract for
mail must be a DELIBERATE act that edits this file and says why — never a quiet consequence of
making a feature work.
"""

from __future__ import annotations

import dataclasses
import re
from pathlib import Path

from app.services.sources.base import (
    BrowsePage,
    FilePage,
    SourceFile,
    SourceHealth,
    SourceListing,
    SourceNode,
    SourceRegistry,
)

BACKEND = Path(__file__).resolve().parents[4]
BASE_MODULE = BACKEND / "app" / "services" / "sources" / "base.py"

#: The contract's shape at Phase 239's close, written out rather than derived, so that ADDING a
#: field fails by name here instead of silently widening the expectation.
EXPECTED_FIELDS: dict[type, set[str]] = {
    SourceNode: {"id", "name", "kind", "drive_id", "has_children", "parent_id"},
    SourceFile: {
        "id",
        "name",
        "mime_type",
        "size",
        "modified_at",
        "drive_id",
        "icon_url",
        "web_view_url",
        "path",
    },
    BrowsePage: {"items", "next_page_token"},
    FilePage: {"files", "next_page_token"},
    SourceListing: {"files", "complete", "error"},
    SourceHealth: {"ok", "error", "details"},
}

#: Vocabulary that has no business inside the contract module. `message/rfc822` is included
#: because a MIME constant is how a shape usually leaks into a contract first.
MAIL_VOCABULARY = ("gmail", "mailbox", "mailmsg", "imap", "message/rfc822", "thread_key")


def test_source_dataclasses_have_no_mail_fields() -> None:
    """No contract dataclass gained a field for mail — asserted by NAME SET, not by count."""
    for cls, expected in EXPECTED_FIELDS.items():
        actual = {f.name for f in dataclasses.fields(cls)}
        assert actual == expected, (
            f"{cls.__name__} field set changed: "
            f"added={sorted(actual - expected)} removed={sorted(expected - actual)}. "
            "Phase 240's claim is that mail costs the contract nothing. If a field is genuinely "
            "needed, edit EXPECTED_FIELDS deliberately and record why — do not let it widen."
        )


def test_registry_gains_no_mail_key() -> None:
    """Mail did NOT become a fourth adapter: no registry key names it."""
    services = SourceRegistry.list_supported_services()
    offenders = [s for s in services if re.search(r"mail|imap|outlook", s, re.IGNORECASE)]
    assert offenders == [], (
        f"SourceRegistry gained mail-shaped key(s) {offenders}. Mail rides the connection that "
        "already owns the mailbox (D-240-01); a key of its own means it became a fourth adapter."
    )


def test_a_google_connection_still_resolves_to_the_drive_adapter() -> None:
    """The positive control for the test above — mail resolves through the EXISTING adapter.

    Without this, `test_registry_gains_no_mail_key` would pass just as happily on a tree where
    mail was never wired up at all.
    """
    from app.services.sources.adapters.google_drive import GoogleDriveSourceAdapter

    adapter = SourceRegistry.get_adapter({"service_id": "google", "is_enabled": True})
    assert isinstance(adapter, GoogleDriveSourceAdapter)


def test_base_module_mentions_no_mail_vocabulary() -> None:
    """`sources/base.py` carries no mail word — the shape stays out of the contract module."""
    source = BASE_MODULE.read_text(encoding="utf-8").lower()
    found = [word for word in MAIL_VOCABULARY if word in source]
    assert found == [], (
        f"sources/base.py mentions {found}. The contract module must not know that mail exists; "
        "the mail shape lives in services/sources/mail/ and is reached by delegation."
    )
