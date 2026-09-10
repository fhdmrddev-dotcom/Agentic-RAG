"""Phase 233 (PREV-01 / PREV-02) — the four buckets, driven rather than asserted.

These tests are the backend half of the same invariants the locked sketches' `drive.cjs` files
assert against the mockups (`.planning/sketches/229-the-four-buckets`,
`.planning/sketches/230-nothing-has-been-written-yet`). The mockup and the shipped code therefore
cannot come to disagree about what the four buckets mean.

⭐ The load-bearing one is `test_here_verdict_makes_no_content_identity_claim`. The ROADMAP's own
failure list opens with *"The preview says 'already here' about a file whose bytes we never
compared, and the label claims certainty we do not have."*
"""

from __future__ import annotations

import pytest

from app.services.sources.preview_service import BUCKETS, classify_source_file

SUPPORTED = {
    "text/plain",
    "text/markdown",
    "text/csv",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


def _classify(name, mime, *, modified="2026-09-01T10:00:00Z", ext_id="f1", known=None):
    return classify_source_file(
        name=name,
        mime_type=mime,
        modified_at=modified,
        external_id=ext_id,
        known=known or {},
        supported=SUPPORTED,
    )


# ── bucket 1: will be added ────────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "name,mime",
    [
        ("Rate Sheet Q3.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
        ("Carrier Terms.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        ("Fuel Index.csv", "text/csv"),
        ("2026 Tariff Notes.md", "text/markdown"),
    ],
)
def test_readable_types_are_added(name, mime):
    bucket, fragment, _ = _classify(name, mime)
    assert bucket == "add"
    assert fragment  # the row still shows what kind of file it is


# ── bucket 2: already here — and the claim it must NOT make ────────────────────────────────


def test_same_source_file_same_version_is_already_here():
    bucket, fragment, reason = _classify(
        "Master Rate Sheet.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        modified="2026-08-12T09:00:00Z",
        ext_id="drive-1",
        known={"drive-1": "2026-08-12T09:00:00Z"},
    )
    assert bucket == "here"
    assert "unchanged" in fragment


def test_same_source_file_at_a_NEW_version_is_not_already_here():
    """⚠ The version MOVED. Saying "already here" would be a claim about bytes we never read."""
    bucket, _, _ = _classify(
        "Master Rate Sheet.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        modified="2026-09-04T11:00:00Z",
        ext_id="drive-1",
        known={"drive-1": "2026-08-12T09:00:00Z"},
    )
    assert bucket == "add"


def test_here_verdict_makes_no_content_identity_claim():
    """⛔ THE LOAD-BEARING FENCE. Tier 1 is an equality on a source version, never a digest.

    Driven RED against a reason sentence rewritten to claim a content hash: the assertion fires.
    """
    _, _, reason = _classify(
        "Master Rate Sheet.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        modified="2026-08-12T09:00:00Z",
        ext_id="drive-1",
        known={"drive-1": "2026-08-12T09:00:00Z"},
    )
    lowered = reason.lower()
    assert "hash" not in lowered, reason
    assert "checksum" not in lowered, reason
    assert "digest" not in lowered, reason
    # …and it must POSITIVELY state the qualifier, not merely omit the overclaim.
    assert "not by content" in lowered, reason
    assert "have not been compared" in lowered, reason


def test_a_known_file_with_no_recorded_version_is_not_claimed_as_here():
    """A NULL stored version cannot equal anything. Fail toward honesty, not toward tidy."""
    bucket, _, _ = _classify(
        "Old Import.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ext_id="drive-9",
        known={"drive-9": None},
    )
    assert bucket == "add"


# ── bucket 3: type not supported ───────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "name,mime",
    [
        ("kickoff-call.mp4", "video/mp4"),
        ("rate-sheets-archive.zip", "application/zip"),
        ("brand-assets.psd", "image/vnd.adobe.photoshop"),
        ("Lane Pricing Deck", "application/vnd.google-apps.presentation"),
        ("Intake Form", "application/vnd.google-apps.form"),
    ],
)
def test_unreadable_types_are_unsupported_and_say_nothing_is_imported(name, mime):
    bucket, fragment, reason = _classify(name, mime)
    assert bucket == "uns"
    assert fragment
    assert "Nothing is imported" in reason, reason


# ── bucket 4: can't tell without reading it ────────────────────────────────────────────────


@pytest.mark.parametrize(
    "name,mime",
    [
        ("scan_2026-03-11.pdf", "application/pdf"),
        ("Q3 Pricing Review", "application/vnd.google-apps.document"),
        ("Warehouse Rates", "application/vnd.google-apps.spreadsheet"),
        ("NOTES", "application/octet-stream"),
        ("Regional Rates", "application/vnd.google-apps.shortcut"),
    ],
)
def test_the_fourth_bucket_holds_what_a_listing_cannot_decide(name, mime):
    bucket, _, _ = _classify(name, mime)
    assert bucket == "unk"


@pytest.mark.parametrize(
    "name,mime",
    [
        ("scan_2026-03-11.pdf", "application/pdf"),
        ("Q3 Pricing Review", "application/vnd.google-apps.document"),
        ("NOTES", "application/octet-stream"),
        ("Regional Rates", "application/vnd.google-apps.shortcut"),
    ],
)
def test_no_unknown_is_a_shrug(name, mime):
    """A bucket labelled "can't tell" whose rows never say WHY is a shrug (sketch 229 §2).

    The fragment is what the row shows at rest; the reason is what lives behind it. BOTH are
    required — a fragment with no sentence behind it is the shrug this guards.
    """
    _, fragment, reason = _classify(name, mime)
    assert 0 < len(fragment) <= 24, fragment
    assert len(reason) > 40, reason


def test_a_pdf_is_never_optimistically_added():
    """⚠ `application/pdf` IS in the supported set. Being optimistic here is exactly how a
    preview lies: an image-only scan has no text and only reading it can say so."""
    assert "application/pdf" in SUPPORTED
    bucket, _, _ = _classify("Detention Policy.pdf", "application/pdf")
    assert bucket == "unk"


# ── the arithmetic the whole surface rests on ──────────────────────────────────────────────


def test_every_file_lands_in_exactly_one_of_four_buckets():
    corpus = [
        ("a.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        ("b.csv", "text/csv"),
        ("c.pdf", "application/pdf"),
        ("d.mp4", "video/mp4"),
        ("e", "application/octet-stream"),
        ("f", "application/vnd.google-apps.document"),
        ("g", "application/vnd.google-apps.presentation"),
        ("h.zip", "application/zip"),
    ]
    verdicts = [_classify(n, m)[0] for n, m in corpus]
    assert len(verdicts) == len(corpus)
    assert all(v in BUCKETS for v in verdicts)
    assert len(BUCKETS) == 4


def test_the_bucket_set_is_exactly_four_and_ordered():
    """⛔ There is no fifth bucket, and no arm of the classifier can produce one."""
    assert BUCKETS == ("add", "here", "uns", "unk")
