"""Phase 274 plan 02 Task 1 (ATT-03 / D-10 / D-22 / D-27) — the promote door's pure helpers and
its request contract.

Three rules live here, each one a way a promote could land the WRONG file in the Library:

- **D-27 — the stored prefix is not part of the name.** A workspace upload is stored as
  `/{hex8}-{safe_name}` (`workspace.py`'s path stamp). Minting that path verbatim would name the
  Library document `1a2b3c4d-Meridian.xlsx`, and D-14's same-name versioning could then never
  match the person's real `Meridian.xlsx`.
- **D-27 — the MIME comes from the Library's own extension table first.** The workspace row's
  MIME is the PLATFORM's `mimetypes` guess, and it differs by box (`.csv` reads
  `application/vnd.ms-excel` on Windows, `.webp` reads `application/octet-stream`).
- **D-22 — the Library's allow-list is the only allow-list.** `.json .py .js .sh` are refused with
  the Library door's own sentence, built over the imported `ALLOWED_MIME_TYPES` — never a second
  list in this module.

Pure functions and a Pydantic model only: nothing here touches a database.
"""
from __future__ import annotations

import typing
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.api.documents import ALLOWED_MIME_TYPES, _EXT_MIME_OVERRIDES
from app.services.workspace_service import guess_mime_type

PROMOTABLE_EXTS = (".docx", ".pptx", ".xlsx", ".md", ".csv", ".txt",
                   ".png", ".jpg", ".jpeg", ".gif", ".webp", ".pdf")
REFUSED_EXTS = (".json", ".py", ".js", ".sh")


# ── library_filename (D-27) ─────────────────────────────────────────────────────────────────
def test_library_filename_strips_the_stored_hex8_prefix():
    """PLANT to drive RED: return the basename without stripping the prefix."""
    from app.api.workspace_promote import library_filename

    assert library_filename("/1a2b3c4d-Meridian-Q4-pricing.xlsx") == "Meridian-Q4-pricing.xlsx"


def test_library_filename_leaves_an_unprefixed_name_alone():
    """PLANT to drive RED: strip the first 9 characters unconditionally."""
    from app.api.workspace_promote import library_filename

    assert library_filename("/Meridian.xlsx") == "Meridian.xlsx"


def test_library_filename_uppercase_hex_is_not_the_stamped_prefix():
    """PLANT to drive RED: compile the prefix regex with re.IGNORECASE.

    The stamp is `uuid4().hex[:8]`, which is lowercase by construction. An uppercase run is a
    person's own name and must survive.
    """
    from app.api.workspace_promote import library_filename

    assert library_filename("/1A2B3C4D-x.md") == "1A2B3C4D-x.md"


def test_library_filename_is_never_empty():
    """PLANT to drive RED: return the stripped remainder even when it is empty."""
    from app.api.workspace_promote import library_filename

    assert library_filename("/1a2b3c4d-") == "1a2b3c4d-"


def test_the_prefix_rule_is_the_one_the_frontend_mirrors():
    """PLANT to drive RED: widen the regex (e.g. `{6,8}`). 274-05 fences this text lockstep
    against `frontend/src/lib/attachmentLifetime.ts`'s `/^[0-9a-f]{8}-/`."""
    from app.api.workspace_promote import WORKSPACE_UPLOAD_PREFIX

    assert WORKSPACE_UPLOAD_PREFIX.pattern == r"^[0-9a-f]{8}-"


# ── library_mime (D-27) ─────────────────────────────────────────────────────────────────────
def test_library_mime_applies_the_library_extension_override_first():
    """PLANT to drive RED: prefer the row's mime over the override."""
    from app.api.workspace_promote import library_mime

    assert library_mime("data.csv", "application/vnd.ms-excel") == _EXT_MIME_OVERRIDES[".csv"]
    assert library_mime("photo.webp", "application/octet-stream") == _EXT_MIME_OVERRIDES[".webp"]
    assert library_mime("PHOTO.WEBP", None) == _EXT_MIME_OVERRIDES[".webp"]


def test_library_mime_keeps_the_row_mime_when_no_override_exists():
    """PLANT to drive RED: fall back to octet-stream even when the row carries a mime."""
    from app.api.workspace_promote import library_mime

    assert ".txt" not in _EXT_MIME_OVERRIDES  # non-vacuity: this case really is "no override"
    assert library_mime("notes.txt", "text/plain") == "text/plain"
    assert library_mime("noext", None) == "application/octet-stream"


# ── promotability (D-22) ───────────────────────────────────────────────────────────────────
@pytest.mark.parametrize("ext", PROMOTABLE_EXTS)
def test_the_twelve_library_types_are_promotable(ext):
    """PLANT to drive RED: gate on the row mime without applying the override (`.webp` and
    `.csv` then fail on this box)."""
    from app.api.workspace_promote import promotability

    name = f"file{ext}"
    assert promotability(name, guess_mime_type(name)) == (True, None)


@pytest.mark.parametrize("ext", REFUSED_EXTS)
def test_the_four_types_the_library_refuses_are_refused_in_its_own_words(ext):
    """PLANT to drive RED: return a hand-written sentence or a re-typed allow-list."""
    from app.api.workspace_promote import promotability

    name = f"file{ext}"
    ok, refusal = promotability(name, guess_mime_type(name))
    assert ok is False
    assert refusal is not None
    assert refusal.startswith("Unsupported file type: ")
    assert f"Allowed: {', '.join(sorted(ALLOWED_MIME_TYPES))}." in refusal


def test_the_module_imports_the_allow_list_and_never_redeclares_it():
    """PLANT to drive RED: paste a local `ALLOWED_MIME_TYPES = {...}` into the module."""
    from pathlib import Path

    from app.api import workspace_promote

    src = Path(workspace_promote.__file__).read_text(encoding="utf-8")
    assert "from app.api.documents import" in src  # non-vacuity
    assert "ALLOWED_MIME_TYPES = " not in src
    assert workspace_promote.ALLOWED_MIME_TYPES is ALLOWED_MIME_TYPES


# ── the request contract (D-10 / T-274-13) ─────────────────────────────────────────────────
def test_promote_request_requires_a_folder():
    """PLANT to drive RED: give `folder_id` a default of None (a Root by another name)."""
    from app.models.workspace_promote import PromoteRequest

    fid = uuid4()
    assert PromoteRequest(folder_id=fid).folder_id == fid
    with pytest.raises(ValidationError):
        PromoteRequest()


def test_promote_request_refuses_any_other_key():
    """PLANT to drive RED: drop `extra="forbid"`. An `org_id` in the body must never be read."""
    from app.models.workspace_promote import PromoteRequest

    with pytest.raises(ValidationError):
        PromoteRequest(folder_id=uuid4(), org_id=str(uuid4()))
    assert set(PromoteRequest.model_fields) == {"folder_id"}


def test_library_link_is_exactly_saved_or_already():
    """PLANT to drive RED: add a third literal. Migration 203's CHECK holds exactly these two."""
    from app.models.workspace_promote import LibraryLink

    assert typing.get_origin(LibraryLink) is typing.Literal
    assert typing.get_args(LibraryLink) == ("saved", "already")


def test_the_response_models_carry_the_wire_contract_field_names():
    """PLANT to drive RED: rename any field. 274-03's client reads these names verbatim, and a
    renamed field is a silent `undefined` in the dialog, never a type error."""
    from app.models.workspace_promote import (
        AttachmentLibraryState,
        LibraryLinkInfo,
        LibraryLinksResponse,
        PromotePreview,
        PromoteResult,
    )

    assert set(PromoteResult.model_fields) == {
        "outcome", "document_id", "folder_id", "document_status", "filename", "version_number",
    }
    assert set(PromotePreview.model_fields) == {
        "promotable", "refusal", "filename", "duplicate_of", "next_version",
    }
    assert set(LibraryLinkInfo.model_fields) == {
        "document_id", "outcome", "folder_id", "document_status", "filename",
    }
    assert set(AttachmentLibraryState.model_fields) == {"workspace_file_id", "promotable", "link"}
    assert set(LibraryLinksResponse.model_fields) == {"files"}
