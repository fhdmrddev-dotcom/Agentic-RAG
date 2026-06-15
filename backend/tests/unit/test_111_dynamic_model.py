"""Phase 111 Wave-0 (RED) — dynamic metadata model builder (META-01).

`build_metadata_model(enabled_fields)` folds the user's enabled custom
metadata field definitions into a Pydantic model that ALSO carries the 7
built-in fields (title/author/date/document_type/topics/language/summary)
plus a `confidence` map. The `field_type` vocabulary is a CLOSED Literal
{string, date, number, boolean, enum}; an unknown type is rejected.

RED convention (Phase 110): the symbol `build_metadata_model` does not
exist until Plan 02/03 lands it, so we import it INSIDE each test body and
mark the not-yet-built behavior xfail(strict=False) — the suite exits 0
today and each test flips to a real assertion when its owning plan ships.
"""

import pytest

# The 7 always-on built-ins the dynamic model mirrors (models/document.py:8-15).
BUILT_INS = {"title", "author", "date", "document_type", "topics", "language", "summary"}

# The closed field_type vocabulary (D-111-5; migration 072 adds the options carrier).
FIELD_TYPE_VOCAB = {"string", "date", "number", "boolean", "enum"}


@pytest.mark.xfail(
    reason="build_metadata_model not built until Plan 02/03 (META-01)",
    strict=False,
)
def test_custom_fields_in_schema():
    """A dynamic model built from an enabled custom field carries the 7
    built-ins + the custom field + the confidence map."""
    from app.services.embedding_service import build_metadata_model

    Model = build_metadata_model([{"field_key": "contract_value", "field_type": "number"}])
    fields = set(Model.model_fields.keys())

    # All 7 built-ins survive.
    assert BUILT_INS <= fields, f"built-ins missing from dynamic model: {BUILT_INS - fields}"
    # The custom field folded in.
    assert "contract_value" in fields, "custom field contract_value not folded into schema"
    # A per-field confidence carrier is present (A1 — the no-underscore design).
    assert "confidence" in fields, "confidence map field absent from dynamic model"


@pytest.mark.xfail(
    reason="build_metadata_model field_type vocabulary not built until Plan 02/03 (META-01)",
    strict=False,
)
def test_field_type_vocabulary():
    """An unknown field_type is rejected by the closed Literal vocabulary;
    an enum field with options yields the options as Literal members."""
    from app.services.embedding_service import build_metadata_model

    # Unknown field_type rejected (not in the closed vocab).
    with pytest.raises((ValueError, KeyError, TypeError)):
        build_metadata_model([{"field_key": "weird", "field_type": "spaceship"}])

    # Every member of the closed vocab is accepted.
    for ftype in sorted(FIELD_TYPE_VOCAB):
        spec = {"field_key": f"f_{ftype}", "field_type": ftype}
        if ftype == "enum":
            spec["options"] = ["draft", "final"]
        Model = build_metadata_model([spec])
        assert f"f_{ftype}" in Model.model_fields, f"{ftype} field not folded into schema"

    # An enum field surfaces its options as the allowed members.
    EnumModel = build_metadata_model(
        [{"field_key": "status", "field_type": "enum", "options": ["draft", "final"]}]
    )
    assert "status" in EnumModel.model_fields
