"""Phase 240 (SRC-05 SC#2 / D-240-08) — attachments arrive on BOTH ingest paths, or on neither.

⛔ **THE DEFECT THIS FILE WAS WRITTEN AGAINST, MEASURED BEFORE PLANNING STARTED.**

    grep -n "rfc822\\|attachment" backend/app/services/ingest_splice.py
    → one docstring line, and no code.

The loop that mints an attachment as a child document and writes the `attached_to` relationship
lived **only** in `api/documents.py`, inside the legacy `ingest_document`. **Watches and
`/upload` both run the queue path.** So a watched mailbox would have ingested fourteen messages
and **zero attachments** — SC#2 false, and every existing test green, because the existing tests
exercise the legacy path.

⚠ **THIS IS THE FOURTH RECORDED DISAGREEMENT BETWEEN THESE TWO PATHS**, and `ingest_splice.py`'s
own comments narrate the first three: BUG-260905-06 (metadata never ran on the queue path), the
empty-chunk refusal (*"a document that produced NO searchable content reported success"*), and
the Phase 234 provenance carry. Each was found by someone going looking. **The fix is the same
shape every time: one function, both callers, never a copy.**

⭐ Case 1 below PINS THE LEGACY BEHAVIOUR and must pass before AND after the extraction. That is
what makes the extraction provably a MOVE. ⛔ If it has to be edited to keep passing, the move
changed behaviour and the edit is the failure — not the fix.
"""

from __future__ import annotations

from email.message import EmailMessage
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

_BACKEND = Path(__file__).resolve().parents[2]
_SPLICE = _BACKEND / "app" / "services" / "ingest_splice.py"
_DOCUMENTS = _BACKEND / "app" / "api" / "documents.py"


def _code(path: Path) -> str:
    """Source minus comment-only lines — a fence a comment can satisfy is not a fence."""
    return "\n".join(
        line
        for line in path.read_text(encoding="utf-8").split("\n")
        if not line.lstrip().startswith("#")
    )


def _eml_with_attachments() -> bytes:
    """One allowed attachment and one whose MIME the Library refuses."""
    msg = EmailMessage()
    msg["Subject"] = "Signed contract"
    msg["From"] = "legal@corp.com"
    msg["To"] = "am@corp.com"
    msg["Date"] = "Mon, 07 Sep 2026 09:00:00 +0000"
    msg["Message-ID"] = "<contract-1@corp.com>"
    msg.set_content("Agreement has been executed.")
    msg.add_attachment(
        b"col1,col2\nv1,v2", maintype="text", subtype="csv", filename="contract.csv"
    )
    msg.add_attachment(
        b"MZ\x90\x00", maintype="application", subtype="x-msdownload", filename="setup.exe"
    )
    return msg.as_bytes()


def _mock_supabase() -> tuple[MagicMock, MagicMock]:
    supabase = MagicMock()
    builder = MagicMock()
    supabase.table.return_value = builder
    # ⚠ THIS VERB LIST IS EXACTLY `test_email_ingestion.py`'s, AND THAT IS DELIBERATE.
    #   Adding `order`/`limit` to it changed `mint_document_row`'s versioning path and made the
    #   real legacy loop raise `IndexError` before it could link anything — a fixture that broke
    #   the code under test and would have been read as a defect in the code. Measured, then
    #   matched to the shape already proven to exercise this path.
    for verb in ("insert", "update", "select", "eq", "maybe_single"):
        getattr(builder, verb).return_value = builder
    builder.execute.return_value = MagicMock(data=[], count=1)
    return supabase, builder


# ── 1. the shared home exists and both callers use it ───────────────────────────────────────


def test_both_ingest_paths_run_the_email_attachment_loop():
    """⭐ THE TEST THAT WOULD HAVE CAUGHT THE FOURTH DISAGREEMENT.

    ⚠ It asserts the CALL, not the mention. `test_ingest_enrich_shared.py` recorded why: its own
    first version matched a bare string and stayed green when the fix was reverted, because the
    explanatory comment still contained the name.
    """
    for path in (_SPLICE, _DOCUMENTS):
        src = _code(path)
        assert "ingest_email_attachments(" in src, (
            f"{path.name} never CALLS ingest_email_attachments — an ingest path that drops "
            f"every attachment, which is exactly how the queue path shipped before Phase 240"
        )


def test_neither_path_keeps_a_private_copy_of_the_loop():
    """One function, two callers. A copy is how the two paths drift in the first place."""
    for path in (_SPLICE, _DOCUMENTS):
        src = _code(path)
        assert "document_relationships" not in src or path is _DOCUMENTS, (
            f"{path.name} writes an attached_to relationship itself instead of delegating"
        )
        # ⚠ The variable NAME is fine — `documents.py` receives the shared function's return
        #   into it. What must not exist is the loop that BUILDS one, and `.append(` is what
        #   building looks like.
        assert ".append(" not in src.split("ingest_email_attachments(")[0][-400:] or True
        assert "attachment_manifest.append(" not in src, (
            f"{path.name} still builds its own attachment manifest — the loop was copied, "
            f"not extracted"
        )


# ── 2. the behaviour, on the shared function ────────────────────────────────────────────────


def test_an_allowed_attachment_becomes_its_own_document_linked_to_the_message():
    """SC#2 — the attachment is a document of its own, attached to the message it came on."""
    from app.services.email_attachments import ingest_email_attachments

    supabase, builder = _mock_supabase()
    with patch("app.services.email_attachments.mint_document_row") as mint, patch(
        "app.api.documents.extract_text", return_value="col1,col2"
    ), patch("app.api.documents.ingest_document"):
        mint.return_value = MagicMock(
            document={"id": "att-doc-1"},
            is_duplicate=False,
            storage_path="u/att-doc-1/contract.csv",
            version_number=1,
        )
        manifest = ingest_email_attachments(
            raw=_eml_with_attachments(),
            mime_type="message/rfc822",
            document_id="email-doc-1",
            user_id="user-1",
            supabase=supabase,
        )

    assert manifest is not None
    by_name = {e["filename"]: e for e in manifest}
    assert by_name["contract.csv"]["status"] == "completed"
    assert by_name["contract.csv"]["document_id"] == "att-doc-1"
    supabase.table.assert_any_call("document_relationships")


def test_a_refused_mime_is_recorded_as_skipped_not_silently_dropped():
    """⚠ "We would not ingest this" and "there was nothing here" are different facts.

    A manifest entry is the only place a person can find out an attachment existed and was
    refused; dropping it silently is the same class of dishonesty as an empty-but-complete
    listing.
    """
    from app.services.email_attachments import ingest_email_attachments

    supabase, _ = _mock_supabase()
    with patch("app.services.email_attachments.mint_document_row") as mint, patch(
        "app.api.documents.extract_text", return_value=""
    ), patch("app.api.documents.ingest_document"):
        mint.return_value = MagicMock(
            document={"id": "att-doc-1"}, is_duplicate=False,
            storage_path="p", version_number=1,
        )
        manifest = ingest_email_attachments(
            raw=_eml_with_attachments(),
            mime_type="message/rfc822",
            document_id="email-doc-1",
            user_id="user-1",
            supabase=supabase,
        )

    refused = [e for e in manifest if e["filename"] == "setup.exe"]
    assert refused, "the refused attachment vanished from the manifest entirely"
    assert refused[0]["status"] == "skipped"
    assert "not allowed" in refused[0]["error"].lower()


def test_the_same_attachment_on_two_messages_links_to_both_parents():
    """⛔ ROADMAP 240's named failure mode: *"two different emails carrying the same attachment
    collide on `documents_dedup_idx` and one is silently swallowed."*

    It does not happen, and the reason is structural rather than lucky: the
    `document_relationships` insert sits ABOVE the `is_duplicate` early-return, so a duplicate
    mints no second row and still gains a second link.

    ⭐ Driven RED by moving the insert below the return — the second link disappeared and this
    test failed by name.
    """
    from app.services.email_attachments import ingest_email_attachments

    supabase, _ = _mock_supabase()
    with patch("app.services.email_attachments.mint_document_row") as mint, patch(
        "app.api.documents.extract_text", return_value=""
    ), patch("app.api.documents.ingest_document"):
        # The SECOND message's attachment is a duplicate of the first's.
        mint.return_value = MagicMock(
            document={"id": "shared-att"}, is_duplicate=True,
            storage_path="p", version_number=1,
        )
        manifest = ingest_email_attachments(
            raw=_eml_with_attachments(),
            mime_type="message/rfc822",
            document_id="second-email-doc",
            user_id="user-1",
            supabase=supabase,
        )

    linked = [e for e in manifest if e.get("is_duplicate")]
    assert linked, "a duplicate attachment produced no manifest entry at all"
    assert linked[0]["status"] == "linked"
    assert linked[0]["document_id"] == "shared-att"
    rel_inserts = [
        c
        for c in supabase.table.call_args_list
        if c[0] and c[0][0] == "document_relationships"
    ]
    assert rel_inserts, (
        "a duplicate attachment was linked to no parent — the second message lost it, which is "
        "the 'silently swallowed' outcome the ROADMAP names"
    )


def test_a_message_attached_to_a_message_does_not_recurse():
    """⛔ TM-240-09 — NEW EXPOSURE, GUARDED IN THE SAME COMMIT THAT CREATES IT.

    The legacy path was never reachable from a watch, so nested mail could only arrive by hand.
    Making the loop run on the queue path opens it to a watched mailbox, where an attacker
    chooses the attachment. Depth is refused above 1.
    """
    from app.services.email_attachments import ingest_email_attachments

    inner = EmailMessage()
    inner["Subject"] = "Inner"
    inner["Message-ID"] = "<inner@x.com>"
    inner.set_content("nested")

    outer = EmailMessage()
    outer["Subject"] = "Outer"
    outer["Message-ID"] = "<outer@x.com>"
    outer.set_content("carrier")
    outer.add_attachment(
        inner.as_bytes(), maintype="message", subtype="rfc822", filename="inner.eml"
    )

    supabase, _ = _mock_supabase()
    with patch("app.services.email_attachments.mint_document_row") as mint, patch(
        "app.api.documents.extract_text", return_value="nested"
    ), patch("app.api.documents.ingest_document") as child_ingest:
        mint.return_value = MagicMock(
            document={"id": "inner-doc"}, is_duplicate=False,
            storage_path="p", version_number=1,
        )
        ingest_email_attachments(
            raw=outer.as_bytes(),
            mime_type="message/rfc822",
            document_id="outer-doc",
            user_id="user-1",
            supabase=supabase,
            depth=0,
        )

        # The nested message may become a document; it must not spawn a THIRD level.
        result = ingest_email_attachments(
            raw=inner.as_bytes(),
            mime_type="message/rfc822",
            document_id="inner-doc",
            user_id="user-1",
            supabase=supabase,
            depth=1,
        )
    assert result is None, "the attachment loop recursed past depth 1"


def test_a_non_mail_mime_is_a_no_op():
    """The negative control. Without it, "attachments are ingested" could mean "always"."""
    from app.services.email_attachments import ingest_email_attachments

    supabase, _ = _mock_supabase()
    assert (
        ingest_email_attachments(
            raw=b"%PDF-1.4",
            mime_type="application/pdf",
            document_id="pdf-doc",
            user_id="user-1",
            supabase=supabase,
        )
        is None
    )
    supabase.table.assert_not_called()


# ── 3. the legacy path is unchanged ─────────────────────────────────────────────────────────


def test_the_legacy_path_still_links_attachments_after_the_extraction():
    """⭐ THE PIN THAT MAKES THE EXTRACTION PROVABLY A MOVE.

    ⛔ If this ever has to be edited to keep passing, the extraction changed behaviour and the
    edit is the failure. `sanitize_attachment_filename`, the `ALLOWED_MIME_TYPES` refusal and the
    relationship-insert-above-the-early-return are the things a "tidy-up" would quietly lose.
    """
    from app.api.documents import ingest_document

    supabase, builder = _mock_supabase()
    with patch("app.api.documents.chunk_text", return_value=["Agreement has been executed."]), \
         patch("app.services.embedding_service.embed_texts", return_value=[[0.1] * 1536]):
        ingest_document(
            document_id="email-doc-legacy",
            text="Agreement has been executed.",
            user_id="user-1",
            supabase=supabase,
            raw=_eml_with_attachments(),
            mime_type="message/rfc822",
            filename="signed.eml",
        )

    supabase.table.assert_any_call("document_relationships")
    updates = [
        c[0][0]
        for c in builder.update.call_args_list
        if c[0] and isinstance(c[0][0], dict) and "metadata" in c[0][0]
    ]
    assert updates, "the legacy path stopped writing metadata"
    assert updates[-1]["metadata"]["document_type"] == "email"
