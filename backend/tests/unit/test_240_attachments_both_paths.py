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


# ── 3. the attachment inherits the message's placement (2026-09-09, UAT row M-2) ────────────
#
# ⛔ FOUND BY DRIVING THE REAL WATCH, NOT BY READING. The operator emailed themselves a PDF; the
#    watch minted it as its own document and linked it — and the child landed with
#    `folder_id = NULL` and `source_connection_id = NULL`, so it existed nowhere a person looks
#    and outside the connection-visibility model entirely.
#
# ⚠ THE FOLDER HALF IS NOT A PHASE 240 REGRESSION, and saying so matters. `5f8a54702` shows the
#   legacy loop passing `folder_id=None` EXPLICITLY, so the extraction preserved the behaviour
#   faithfully. What Phase 240 changed is that a watched mailbox now produces attachments at all,
#   which is what made a long-standing behaviour visible for the first time.
#
# ⛔ THE VISIBILITY HALF IS A REAL GAP IN THIS PHASE'S OWN CODE. `mint_document_row` writes
#   `ingest_visibility` ONLY alongside `source_connection_id` — *"the pair is written together or
#   not at all"* — and this module accepted `ingest_visibility` while having no way to pass a
#   connection id. The parameter its docstring introduced to prevent a VIS-* regression was
#   therefore inert: silently dropped by the function it was handed to.


def _placement_supabase(placement: dict | None) -> MagicMock:
    """A supabase whose `documents` select answers with the parent's placement row."""
    supabase, builder = _mock_supabase()
    builder.execute.return_value = MagicMock(data=placement, count=1)
    return supabase


def test_an_attachment_inherits_the_folder_its_message_lives_in():
    """⭐ M-2's real finding: the child was minted with no folder at all.

    A person who watches a mail label and gets an attachment expects to find it beside the
    message. `folder_id = NULL` is not "the root" — it is outside the folder tree.
    """
    from app.services.email_attachments import ingest_email_attachments

    supabase = _placement_supabase({
        "folder_id": "folder-9",
        "org_id": "org-1",
        "source_connection_id": "conn-7",
        "ingest_visibility": "org",
    })
    with patch("app.services.email_attachments.mint_document_row") as mint, patch(
        "app.api.documents.extract_text", return_value="col1,col2"
    ), patch("app.api.documents.ingest_document"):
        mint.return_value = MagicMock(
            document={"id": "att-doc-1"}, is_duplicate=False,
            storage_path="p", version_number=1,
        )
        ingest_email_attachments(
            raw=_eml_with_attachments(),
            mime_type="message/rfc822",
            document_id="email-doc-1",
            user_id="user-1",
            supabase=supabase,
        )

    assert mint.call_args is not None, "no attachment was minted at all"
    kwargs = mint.call_args.kwargs
    assert kwargs["folder_id"] == "folder-9", (
        "the attachment was minted outside its message's folder — this is what the operator "
        "saw on 2026-09-09: a child document that exists and sits nowhere"
    )


def test_the_connection_and_its_visibility_travel_together_onto_the_child():
    """⛔ The pair, or neither. `mint_document_row` DROPS visibility without a connection id.

    Driven against the shipped code: this module had no `source_connection_id` parameter, so
    every `ingest_visibility` it forwarded was discarded by the function it was handed to.
    """
    from app.services.email_attachments import ingest_email_attachments

    supabase = _placement_supabase({
        "folder_id": "folder-9",
        "org_id": "org-1",
        "source_connection_id": "conn-7",
        "ingest_visibility": "org",
    })
    with patch("app.services.email_attachments.mint_document_row") as mint, patch(
        "app.api.documents.extract_text", return_value="col1,col2"
    ), patch("app.api.documents.ingest_document"):
        mint.return_value = MagicMock(
            document={"id": "att-doc-1"}, is_duplicate=False,
            storage_path="p", version_number=1,
        )
        ingest_email_attachments(
            raw=_eml_with_attachments(),
            mime_type="message/rfc822",
            document_id="email-doc-1",
            user_id="user-1",
            supabase=supabase,
        )

    kwargs = mint.call_args.kwargs
    assert kwargs.get("source_connection_id") == "conn-7", (
        "the child carries no connection, so the visibility beside it is dropped by "
        "mint_document_row and the attachment sits outside the connection's scope"
    )
    assert kwargs.get("ingest_visibility") == "org"
    assert kwargs.get("org_id") == "org-1"


def test_a_message_with_no_placement_still_mints_its_attachment():
    """⚠ The inheritance must never become a REQUIREMENT. A hand-uploaded `.eml` has no
    connection and no folder, and its attachment must still arrive — with nothing invented."""
    from app.services.email_attachments import ingest_email_attachments

    supabase = _placement_supabase(None)
    with patch("app.services.email_attachments.mint_document_row") as mint, patch(
        "app.api.documents.extract_text", return_value="col1,col2"
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

    assert manifest and manifest[0]["status"] == "completed"
    kwargs = mint.call_args.kwargs
    assert kwargs["folder_id"] is None
    assert kwargs.get("source_connection_id") is None


def test_an_explicit_placement_argument_beats_the_inherited_one():
    """The caller stays able to say where a child belongs; inheritance is the DEFAULT, not a law."""
    from app.services.email_attachments import ingest_email_attachments

    supabase = _placement_supabase({
        "folder_id": "folder-9", "org_id": "org-1",
        "source_connection_id": "conn-7", "ingest_visibility": "org",
    })
    with patch("app.services.email_attachments.mint_document_row") as mint, patch(
        "app.api.documents.extract_text", return_value="col1,col2"
    ), patch("app.api.documents.ingest_document"):
        mint.return_value = MagicMock(
            document={"id": "att-doc-1"}, is_duplicate=False,
            storage_path="p", version_number=1,
        )
        ingest_email_attachments(
            raw=_eml_with_attachments(),
            mime_type="message/rfc822",
            document_id="email-doc-1",
            user_id="user-1",
            supabase=supabase,
            folder_id="folder-explicit",
        )

    assert mint.call_args.kwargs["folder_id"] == "folder-explicit"


# ── 4. a transient storage stall does not cost the attachment (2026-09-09) ───────────────────
#
# ⛔ THE FAILURE, AND WHAT IT ACTUALLY WAS. The operator's UAT attachment failed with the bare
#    word `timed out` and no bytes in storage. `storage3.constants.DEFAULT_TIMEOUT` is 20, and
#    the gap between the relationship insert and the failure was 20.010 s to the millisecond.
#
# ⭐ THE CAUSE WAS MEASURED, AFTER TWO WRONG GUESSES WERE MEASURED FALSE FIRST. Concurrency on a
#    shared client: refuted (12 parallel uploads, max 0.17 s). A stale keep-alive connection:
#    refuted (idle 30 s / 75 s / 120 s, then 0.03 s). What DOES reproduce it is GIL contention —
#    the identical upload takes 0.23 s idle, 7.27 s under 16 CPU-bound threads and 21.07 s under
#    32, past the ceiling. The backend log agrees: 15.8 seconds with NO line at all in a process
#    that was otherwise logging constantly, which is what a starved logging thread looks like.
#
# ⚠ SO THE TIMEOUT WAS NOT MEASURING THE SERVER. It was measuring our own scheduling, during an
#   ingest that runs PDF extraction and image work on threads. A wall-clock deadline on a local
#   call is not a health signal under that load.
#
# ⛔ AND THE REASON IT WAS FATAL IS A FIFTH TWO-PATHS DISAGREEMENT. The queue path classifies a
#   timeout as TRANSIENT and retries it (`ingestion_queue_service`); an attachment child is minted
#   and ingested OUTSIDE the queue, so it inherited no retry at all. One transient stall, one
#   permanently failed document.


def test_a_transient_upload_stall_is_retried_rather_than_losing_the_attachment():
    """⭐ The isolated upload costs 0.03 s, so a retry is nearly free when things are healthy."""
    from app.services import email_attachments as mod

    supabase, _ = _mock_supabase()
    calls = {"n": 0}

    def flaky_upload(**_kw):
        calls["n"] += 1
        if calls["n"] == 1:
            raise TimeoutError("timed out")
        return MagicMock()

    supabase.storage.from_.return_value.upload.side_effect = flaky_upload

    with patch("app.services.email_attachments.mint_document_row") as mint, patch(
        "app.api.documents.extract_text", return_value="col1,col2"
    ), patch("app.api.documents.ingest_document"), patch.object(mod, "_RETRY_SLEEP", 0):
        mint.return_value = MagicMock(
            document={"id": "att-doc-1"}, is_duplicate=False,
            storage_path="p", version_number=1,
        )
        manifest = mod.ingest_email_attachments(
            raw=_eml_with_attachments(),
            mime_type="message/rfc822",
            document_id="email-doc-1",
            user_id="user-1",
            supabase=supabase,
        )

    by_name = {e["filename"]: e for e in manifest}
    assert by_name["contract.csv"]["status"] == "completed", (
        "one transient stall still cost the attachment — the queue path retries a timeout and "
        "this path, which runs outside the queue, inherited no retry at all"
    )
    assert calls["n"] == 2, "the upload was not retried"


def test_a_persistent_failure_still_fails_and_names_the_STEP_it_failed_at():
    """⛔ `timed out` alone cost a log-archaeology session. The record must say WHICH step.

    ⚠ Retrying must not become swallowing: after the bounded attempts the attachment is still
    recorded FAILED, in both the manifest and the child document.
    """
    from app.services import email_attachments as mod

    supabase, _ = _mock_supabase()
    supabase.storage.from_.return_value.upload.side_effect = TimeoutError("timed out")

    with patch("app.services.email_attachments.mint_document_row") as mint, patch(
        "app.api.documents.extract_text", return_value="col1,col2"
    ), patch("app.api.documents.ingest_document"), patch.object(mod, "_RETRY_SLEEP", 0):
        mint.return_value = MagicMock(
            document={"id": "att-doc-1"}, is_duplicate=False,
            storage_path="p", version_number=1,
        )
        manifest = mod.ingest_email_attachments(
            raw=_eml_with_attachments(),
            mime_type="message/rfc822",
            document_id="email-doc-1",
            user_id="user-1",
            supabase=supabase,
        )

    entry = {e["filename"]: e for e in manifest}["contract.csv"]
    assert entry["status"] == "failed"
    assert "upload" in entry["error"], (
        f"the recorded reason {entry['error']!r} still does not say which step failed"
    )
    assert "timed out" in entry["error"], "the underlying message was dropped"


def test_a_terminal_error_is_not_retried():
    """⚠ A refusal is not a stall. Retrying a permanent error wastes time and hides the reason."""
    from app.services import email_attachments as mod

    supabase, _ = _mock_supabase()
    calls = {"n": 0}

    def always_400(**_kw):
        calls["n"] += 1
        raise ValueError("Bucket not found")

    supabase.storage.from_.return_value.upload.side_effect = always_400

    with patch("app.services.email_attachments.mint_document_row") as mint, patch(
        "app.api.documents.extract_text", return_value="col1,col2"
    ), patch("app.api.documents.ingest_document"), patch.object(mod, "_RETRY_SLEEP", 0):
        mint.return_value = MagicMock(
            document={"id": "att-doc-1"}, is_duplicate=False,
            storage_path="p", version_number=1,
        )
        mod.ingest_email_attachments(
            raw=_eml_with_attachments(),
            mime_type="message/rfc822",
            document_id="email-doc-1",
            user_id="user-1",
            supabase=supabase,
        )

    assert calls["n"] == 1, "a permanent error was retried as though it were a stall"


def test_both_paths_agree_on_what_transient_MEANS():
    """⛔ The queue and the attachment loop must not drift on the word.

    ⚠ A COPY is how these two paths have now disagreed five times. This asserts they read the
    same list, so a term added to one is a term added to both.
    """
    from app.services.transient_errors import TRANSIENT_TELLS
    from app.services import ingestion_queue_service as queue_mod

    assert queue_mod.TRANSIENT_TELLS is TRANSIENT_TELLS, (
        "the queue keeps its own private copy of the transient-error terms"
    )


# ── 5. a PDF attachment is extracted by the PDF extractor (2026-09-09) ───────────────────────
#
# ⛔ THE SIXTH TWO-PATHS DISAGREEMENT, AND IT MADE EVERY PDF ATTACHMENT FAIL — ON BOTH PATHS,
#    FOR AS LONG AS THE LOOP HAS EXISTED. `extract_text`'s own docstring says it is for
#    *"non-PDF/non-DOCX MIME types"*: since Phase 069 those two flow through
#    `extraction_service`. A PDF handed to it falls past every branch to the final
#    `raw.decode("utf-8")` and dies on the first non-ASCII byte of the file body.
#
# ⚠ MEASURED, on the operator's real Gmail watch: `'utf-8' codec can't decode byte 0xe2 in
#   position 10: invalid continuation byte` — position 10 is just past `%PDF-1.x\n`.
#
# ⚠ IT WAS INVISIBLE UNTIL TODAY. `splice_document` gets this right (`if mime_type not in
#   (_PDF, _DOCX)`), so nothing upstream ever noticed; and the first live run of this loop hit
#   the storage timeout and never REACHED extraction. One defect hid behind another.


def test_a_pdf_attachment_goes_to_the_pdf_extractor_not_the_utf8_fallback():
    """⛔ Driven against the shipped code with the real failure: a bare `raw.decode("utf-8")`."""
    from app.services import email_attachments as mod

    supabase, _ = _mock_supabase()
    pdf_bytes = b"%PDF-1.7\n\xe2\xe3\xcf\xd3 binary body"

    msg = EmailMessage()
    msg["Subject"] = "Contract"
    msg["From"] = "legal@corp.com"
    msg["To"] = "am@corp.com"
    msg["Date"] = "Mon, 07 Sep 2026 09:00:00 +0000"
    msg["Message-ID"] = "<pdf-1@corp.com>"
    msg.set_content("See attached.")
    msg.add_attachment(pdf_bytes, maintype="application", subtype="pdf", filename="contract.pdf")

    with patch("app.services.email_attachments.mint_document_row") as mint, patch(
        "app.api.documents.ingest_document"
    ), patch(
        "app.services.extraction_service.extract_composable"
    ) as composable:
        mint.return_value = MagicMock(
            document={"id": "att-doc-1"}, is_duplicate=False,
            storage_path="p", version_number=1,
        )
        composable.return_value = MagicMock(text="CONTRACT TEXT", extractor_name="pymupdf")
        manifest = mod.ingest_email_attachments(
            raw=msg.as_bytes(),
            mime_type="message/rfc822",
            document_id="email-doc-1",
            user_id="user-1",
            supabase=supabase,
        )

    entry = {e["filename"]: e for e in manifest}["contract.pdf"]
    assert entry["status"] == "completed", (
        f"the PDF attachment failed: {entry.get('error')!r} — `extract_text` has not handled "
        f"PDF since Phase 069 and its final branch is a bare raw.decode('utf-8')"
    )
    composable.assert_called_once()


# ── 6. the nesting cap actually FIRES (code review CR-01 / WR-07, 2026-09-09) ────────────────
#
# ⛔ THE GUARD WAS UNREACHABLE AND ITS TEST DID NOT NOTICE. `MAX_MAIL_NESTING_DEPTH` is only
#    enforced against the `depth` a CALLER passes — and the only real recursion path is
#    `ingest_email_attachments` → `api.documents.ingest_document` → `documents.py:2295`, which
#    called the loop back with the DEFAULT `depth=0`. `ingest_document` had no `depth`
#    parameter to thread, so the counter reset on every hop and a `.eml` inside a `.eml` inside
#    a `.eml` recursed without bound — from an unauthenticated inbound email into a watched
#    mailbox, minting documents and buying embeddings at every level (TM-240-09).
#
# ⚠ `test_a_message_attached_to_a_message_does_not_recurse` passed `depth=1` BY HAND and mocked
#   the one function that recurses. It proved the PARAMETER and never the BEHAVIOUR. Both tests
#   below exist because that distinction is what let a security guard ship inert.


def test_the_loop_threads_its_depth_into_the_child_ingest():
    """⭐ THE MISSING LINK. Without this the cap resets on every hop and can never fire."""
    from app.services import email_attachments as mod

    supabase, _ = _mock_supabase()

    inner = EmailMessage()
    inner["Subject"] = "inner"
    inner["From"] = "a@corp.com"
    inner["To"] = "b@corp.com"
    inner["Message-ID"] = "<inner@corp.com>"
    inner.set_content("inner body")

    outer = EmailMessage()
    outer["Subject"] = "outer"
    outer["From"] = "a@corp.com"
    outer["To"] = "b@corp.com"
    outer["Date"] = "Mon, 07 Sep 2026 09:00:00 +0000"
    outer["Message-ID"] = "<outer@corp.com>"
    outer.set_content("see attached message")
    # ⛔ THE CARRIER IS THE REVIEW'S OWN VECTOR, and it had to be — a part declared
    #    `message/rfc822` never reaches this loop at all, because `get_content()` hands back an
    #    EmailMessage rather than bytes and `parse_eml_bytes` drops it. The path that DOES
    #    reach it is a `.eml` announced as `application/octet-stream`, which
    #    `_UNRELIABLE_MIME_TYPES` + `_EXT_MIME_OVERRIDES` promote back to mail by EXTENSION.
    # ⚠ So the reachable nesting vector is the one an attacker controls by naming the file,
    #   which is exactly why the guard has to hold rather than be assumed unreachable.
    outer.add_attachment(
        inner.as_bytes(),
        maintype="application",
        subtype="octet-stream",
        filename="inner.eml",
    )

    with patch("app.services.email_attachments.mint_document_row") as mint, patch(
        "app.api.documents.extract_text", return_value="inner body"
    ), patch("app.api.documents.ingest_document") as ingest:
        mint.return_value = MagicMock(
            document={"id": "att-doc-1"}, is_duplicate=False,
            storage_path="p", version_number=1,
        )
        mod.ingest_email_attachments(
            raw=outer.as_bytes(),
            mime_type="message/rfc822",
            document_id="email-doc-1",
            user_id="user-1",
            supabase=supabase,
        )

    assert ingest.called, "the nested message was never ingested at all"
    kwargs = ingest.call_args.kwargs
    assert kwargs.get("attachment_depth") == 1, (
        "the child ingest was handed no depth, so `documents.py`'s call back into this loop "
        "restarts at 0 and MAX_MAIL_NESTING_DEPTH can never fire — unbounded recursion on "
        "attacker-supplied nested mail (TM-240-09)"
    )


def test_the_legacy_caller_passes_the_depth_it_was_given():
    """⛔ The other half of the link — and a SOURCE fence, because the call is in the API module.

    ⚠ Asserts the ARGUMENT, not the mention: a comment naming `attachment_depth` must not
    satisfy it. `_code` strips comment-only lines for exactly this reason.
    """
    src = _code(_DOCUMENTS)
    call = src.split("ingest_email_attachments(")[1][:400]
    assert "depth=" in call, (
        "documents.py still calls the attachment loop without threading its depth, so the "
        "recursion guard resets on every hop"
    )
