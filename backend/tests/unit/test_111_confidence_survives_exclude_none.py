"""Phase 111 Wave-0 (RED) — BLOCKING A1 caveat: confidence survives exclude_none.

THE BLOCKING A1 proof scaffold. The metadata pipeline calls
`model_dump(exclude_none=True)` on the extracted model (so empty fields drop
out rather than persist as ""). A per-field confidence map MUST survive that
dump and then be attached to the stored metadata as a nested `_confidence`
key — WITHOUT being declared as a Pydantic field named `_confidence`.

The design (A1): the Pydantic field is named `confidence` (NO leading
underscore) — a field literally named `_confidence` would be treated by
Pydantic as a PRIVATE attribute (ModelPrivateAttr) and would NOT appear in
`model_dump()` AT ALL. So the chosen design declares `confidence` (public)
on the model, lets it survive the exclude_none dump, then the post-dump step
RENAMES it into the nested `_confidence` containment key on the stored dict.

RED convention: `build_metadata_model` doesn't exist until Plan 02/03 — import
inside the body, xfail the not-yet-built assertions. The DESIGN assertions
(what Pydantic does with `confidence` vs `_confidence`) are real today and
prove the naming choice is correct regardless of the builder.
"""

from pydantic import BaseModel


def test_underscore_named_field_is_a_private_attr_and_excluded():
    """DESIGN PROOF (real today, no builder needed): a field literally named
    `_confidence` is a Pydantic PRIVATE attr — it never appears in model_dump.
    This is WHY the design names the public field `confidence`, not `_confidence`.
    """
    class WithUnderscore(BaseModel):
        title: str | None = None
        _confidence: dict | None = None  # leading underscore => ModelPrivateAttr

    m = WithUnderscore(title="X")
    # `_confidence` is NOT a regular model field — it's a private attr.
    assert "_confidence" not in WithUnderscore.model_fields, (
        "a leading-underscore field must be a private attr, not a model field"
    )
    dumped = m.model_dump(exclude_none=True)
    assert "_confidence" not in dumped, (
        "a `_confidence`-named field would be EXCLUDED from model_dump — the design avoids this"
    )

    class WithPublic(BaseModel):
        title: str | None = None
        confidence: dict | None = None  # public => a real model field

    m2 = WithPublic(title="X", confidence={"title": 0.9})
    assert "confidence" in WithPublic.model_fields, "public `confidence` must be a real model field"
    dumped2 = m2.model_dump(exclude_none=True)
    assert dumped2.get("confidence") == {"title": 0.9}, (
        "public `confidence` must survive model_dump(exclude_none=True)"
    )


def test_confidence_survives_exclude_none_and_attaches():
    """Build the dynamic model with confidence={"title":0.9}; assert the public
    `confidence` field survives exclude_none, then the documented post-dump
    attach yields metadata_dict["_confidence"] == {"title":0.9}."""
    from app.services.embedding_service import (
        build_metadata_model,
        attach_confidence,  # the documented post-dump rename step
    )

    Model = build_metadata_model([])
    inst = Model(title="My Doc", confidence={"title": 0.9})

    dumped = inst.model_dump(exclude_none=True)
    assert dumped.get("confidence") == {"title": 0.9}, (
        "public `confidence` must survive exclude_none (no private-attr drop)"
    )

    metadata_dict = attach_confidence(dumped)
    assert metadata_dict.get("_confidence") == {"title": 0.9}, (
        "post-dump attach must rename `confidence` into the nested `_confidence` key"
    )
    assert "confidence" not in metadata_dict, (
        "the top-level public `confidence` is renamed away after attach"
    )


def test_ingest_callsite_uses_attach_confidence_not_handrolled():
    """WR-01 regression guard (call-site, not helper).

    The 111-04 ingest enriched branch must route the dumped model through
    `attach_confidence` — which POPS the public `confidence` field and renames
    it to nested `_confidence`. The original call site hand-rolled
    ``metadata_dict["_confidence"] = emitted.confidence`` WITHOUT popping the
    flat `confidence` key; because `confidence` has a populated-dict default it
    survives `model_dump(exclude_none=True)`, so every enriched doc persisted a
    flat top-level `confidence` key that pollutes the `metadata @>` containment
    pre-filter (D-111-3 violation). The helper-level test above false-greens
    this; this source guard catches the regression at the call site.
    """
    from pathlib import Path

    src = Path(__file__).resolve().parents[2] / "app" / "api" / "documents.py"
    text = src.read_text(encoding="utf-8")

    assert "attach_confidence(" in text, (
        "the ingest enriched branch must use attach_confidence() to nest _confidence"
    )
    assert 'metadata_dict["_confidence"] = emitted.confidence' not in text, (
        "the hand-rolled _confidence attach (WR-01) must not return — it leaves the "
        "flat `confidence` key in the dump, polluting the metadata containment filter"
    )
