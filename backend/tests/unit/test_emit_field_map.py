"""Phase 101.1 (TMPL-02 / D-09) — the flat ``EmitFieldMap`` strict-schema contract.

Wave 0 RED stubs (the Nyquist contract for the flatten lever). The production
symbols these tests target are authored in THIS plan (101.1-01 Task 2):

  - ``FlatScalar`` / ``FlatRow`` / ``EmitFieldMap`` — the flat, strict-friendly
    cited field-map (citation as a SIBLING field, ``extra="forbid"`` everywhere,
    no recursion, fixed depth 3, no minLength/maxLength/pattern). RESEARCH §3.
  - ``emit_field_map_to_legacy`` — normalizer that maps a flat ``EmitFieldMap`` to
    the SAME flat-dict shape ``_iter_leaves`` / ``check_coverage`` / ``build_context``
    already consume (the additive seam — ``GenericFieldMap`` stays untouched).

CONVENTION (101-01/02 + 098/099/100): the ``from app.services... import ...`` is
INSIDE each test body so a not-yet-existing symbol never breaks COLLECTION. The
three tests this plan's OWN Task 2 satisfies are written as REAL GREEN behavioral
tests (no ``xfail``) once the model lands — Task 1 marks them ``xfail(strict=False)``
so the suite exits 0 BEFORE Task 2, and Task 2 un-marks them to GREEN.
"""

from __future__ import annotations


# ── D-09 — the flat model strict-schema + back-compat (this plan's Task 2) ────


def test_flat_model_strict_schema():
    """``EmitFieldMap.model_json_schema()`` is strict-provider-friendly:
    ``additionalProperties: false`` at every object level, NO minLength/maxLength/
    pattern anywhere, and a bounded nesting depth of 3
    (``EmitFieldMap -> FlatRow -> FlatScalar``)."""
    from app.services.template_render_service import EmitFieldMap

    schema = EmitFieldMap.model_json_schema()

    # Walk every nested object/$def and assert the strict-schema invariants.
    defs = schema.get("$defs", {}) or schema.get("definitions", {})
    object_schemas = [schema, *defs.values()]

    forbidden_keywords = {"minLength", "maxLength", "pattern"}

    def _walk(node, depth=0):
        max_depth = depth
        if isinstance(node, dict):
            # No string-constraint keywords anywhere (Anthropic + DeepSeek strict).
            assert not (forbidden_keywords & node.keys()), (
                f"strict-unfriendly keyword in schema node: {forbidden_keywords & node.keys()}"
            )
            if node.get("type") == "object":
                assert node.get("additionalProperties") is False, (
                    "every object level must set additionalProperties:false"
                )
            for v in node.values():
                max_depth = max(max_depth, _walk(v, depth + 1))
        elif isinstance(node, list):
            for v in node:
                max_depth = max(max_depth, _walk(v, depth + 1))
        return max_depth

    for obj in object_schemas:
        assert obj.get("additionalProperties") is False
        _walk(obj)

    # Bounded model nesting depth: exactly 3 model classes deep, no recursion.
    assert len(object_schemas) == 3, (
        f"expected EmitFieldMap + FlatRow + FlatScalar = 3 object schemas, got {len(object_schemas)}"
    )


def test_legacy_nested_still_validates():
    """A 097/101-shaped NESTED ``GenericFieldMap`` artifact (per-leaf ``Cited``
    wrapper) STILL ``model_validate()``s unchanged — the flatten is additive
    (D-09 back-compat)."""
    from app.services.template_render_service import GenericFieldMap

    legacy_nested = {
        "scalars": {
            "project_name": {
                "value": "Meridian",
                "source_chunk_id": "chunk-1",
                "source_doc": "brief.docx",
                "source_page": 2,
            },
        },
        "collections": {
            "rows": [
                {
                    "risk_id": {
                        "value": "R-01",
                        "source_chunk_id": "chunk-2",
                        "source_doc": "risks.docx",
                        "source_page": None,
                    }
                }
            ]
        },
    }

    fm = GenericFieldMap.model_validate(legacy_nested)
    assert fm.scalars["project_name"].value == "Meridian"
    assert fm.collections["rows"][0]["risk_id"].value == "R-01"


def test_emit_field_map_to_legacy_roundtrip():
    """``emit_field_map_to_legacy`` maps a flat ``EmitFieldMap`` to the SAME flat-dict
    shape the existing ``_iter_leaves`` / ``check_coverage`` / ``build_context`` consume:
    ``{scalar_key: {value, source_chunk_id, source_doc, source_page}}`` for scalars +
    ``{collection: [{col_key: {...cited...}}]}`` for rows."""
    from app.services.template_render_service import (
        EmitFieldMap,
        _iter_leaves,
        emit_field_map_to_legacy,
    )

    fm = EmitFieldMap(
        scalars=[
            {
                "key": "project_name",
                "value": "Meridian",
                "source_chunk_id": "chunk-1",
                "source_doc": "brief.docx",
                "source_page": 2,
            },
        ],
        rows=[
            {
                "collection": "rows",
                "cells": [
                    {
                        "key": "risk_id",
                        "value": "R-01",
                        "source_chunk_id": "chunk-2",
                        "source_doc": "risks.docx",
                        "source_page": None,
                    },
                ],
            }
        ],
    )

    legacy = emit_field_map_to_legacy(fm)

    # Scalar shape: top-level keyed cited dicts the existing gate/driver consume.
    assert legacy["scalars"]["project_name"]["value"] == "Meridian"
    assert legacy["scalars"]["project_name"]["source_chunk_id"] == "chunk-1"
    # Collection shape: list-of-rows keyed by column name.
    assert legacy["collections"]["rows"][0]["risk_id"]["value"] == "R-01"
    assert legacy["collections"]["rows"][0]["risk_id"]["source_chunk_id"] == "chunk-2"

    # The normalized shape is exactly what _iter_leaves walks: every leaf yielded.
    leaves = list(_iter_leaves(legacy))
    values = {cited.get("value") for _, _, cited in leaves}
    assert "Meridian" in values
    assert "R-01" in values
