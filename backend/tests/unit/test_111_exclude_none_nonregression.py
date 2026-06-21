"""Phase 111 Wave-0 (RED) — exclude_none non-regression (D-111-9).

An unset flat field (e.g. author=None) must be DROPPED by
`model_dump(exclude_none=True)` — never persisted as "". Flat fields that ARE
set stay top-level (so the existing flat `@>` containment filters keep
matching). This guards the enrichment change from silently turning the
metadata shape from "absent key" into "empty-string key".

The exclude_none behavior is real today on a plain BaseModel, so the design
proof runs green now; the dynamic-model variant xfails until Plan 02/03.
"""

from pydantic import BaseModel


def test_plain_model_drops_none_keeps_flat():
    """DESIGN PROOF (real today): exclude_none drops None, keeps set flats."""
    class M(BaseModel):
        title: str | None = None
        author: str | None = None
        document_type: str | None = None

    m = M(title="Doc", author=None, document_type="report")
    dumped = m.model_dump(exclude_none=True)

    assert "author" not in dumped, "None author must be DROPPED, never persisted as ''"
    assert dumped.get("title") == "Doc", "set flat field must stay top-level"
    assert dumped.get("document_type") == "report", "set flat field must stay top-level"
    # Explicitly: the dropped key is absent, NOT an empty string.
    assert dumped.get("author", "__MISSING__") == "__MISSING__"


def test_dynamic_model_drops_none_author():
    """Build the dynamic model with author=None; exclude_none drops it; flat
    fields stay top-level."""
    from app.services.embedding_service import build_metadata_model

    Model = build_metadata_model([])
    inst = Model(title="My Doc", author=None, document_type="report")
    dumped = inst.model_dump(exclude_none=True)

    assert "author" not in dumped, "None author must be dropped in the dynamic model too"
    assert dumped.get("title") == "My Doc"
    assert dumped.get("document_type") == "report"
