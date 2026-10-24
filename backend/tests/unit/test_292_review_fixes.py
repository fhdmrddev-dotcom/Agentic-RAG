"""Phase 292 code-review fixes (292-REVIEW.md), one section per finding.

Each section was written RED against the reviewed code and turned GREEN by its fix commit. The
cross-stack cases (what both validators must refuse) live in the shared parity fixture
``fixtures/artifact_bad_specs_292.json``; this file holds the backend-only halves.
⛔ Invisible characters are written ONLY as ``\\uXXXX`` escapes.
"""
from __future__ import annotations

import pytest

import app.services.artifact_sources as artifact_sources
import app.services.show_artifact_tool as sat
from app.models import artifact as am
from app.models.artifact import (
    MAX_SOURCE_DOCUMENT_CHARS,
    ArtifactRefusal,
    ComparisonArgs,
    StoredSource,
    StoredTimelineEvent,
    _js_len,
    clean_document_name,
    is_event_date,
    validate_args,
)

FEFF = "﻿"
PAGE = "\U0001F4C4"  # 2 UTF-16 units


# ── CR-01 (1): a date is ASCII digits only, as JavaScript's \d ───────────────────────────────────


@pytest.mark.parametrize("date", [
    "٢٠٢٤-01-15",      # Arabic-Indic year
    "２０２４-01",          # fullwidth year, month precision
    "2024-01-１５",                 # fullwidth day
    "२०२४-01",          # Devanagari year
])
def test_non_ascii_digits_are_not_a_date(date):
    assert is_event_date(date) is False
    out = validate_args({"component": "timeline", "title": "History",
                         "timeline": {"events": [{"date": date, "title": "Signed"}]}})
    assert isinstance(out, ArtifactRefusal)
    with pytest.raises(ValueError):
        StoredTimelineEvent.model_validate({"date": date, "title": "Signed", "detail": None, "category": None,
                                            "deadline": False, "source": None})


def test_ascii_dates_still_parse():
    assert is_event_date("2024-01-15") and is_event_date("2024-01")


def test_a_source_handle_is_ascii_digits_only():
    assert am.parse_source_handle("[3]") == 3
    with pytest.raises(ValueError):
        am.parse_source_handle("３")
    with pytest.raises(ValueError):
        am.parse_source_handle("[٣]")


# ── CR-01 (3): blank means blank by BOTH rules (Python strip and JavaScript trim) ────────────────


@pytest.mark.parametrize("blank", [FEFF, " " + FEFF + " ", "　", "  "])
def test_js_blank_text_is_refused_where_text_is_required(blank):
    out = validate_args({"component": "comparison", "title": "Contracts",
                         "comparison": {"options": [blank, "B"],
                                        "terms": [{"name": "T", "cells": [{"verdict": "y"}, {"verdict": "n"}]}]}})
    assert isinstance(out, ArtifactRefusal), repr(blank)


def test_js_blank_optional_text_is_stored_as_none():
    out = validate_args({"component": "comparison", "title": "Contracts",
                         "comparison": {"options": ["A", "B"],
                                        "terms": [{"name": "T", "cells": [{"verdict": "y", "text": FEFF},
                                                                          {"verdict": "n"}]}]}})
    assert isinstance(out, ComparisonArgs), out
    assert out.comparison.terms[0].cells[0].text is None


# ── CR-01 (2) + IN-04: one document-name rule, cut in UTF-16 units ───────────────────────────────


def test_clean_document_name_has_one_home():
    # IN-04: the caption and the per-element source share ONE function, imported from the model layer.
    assert sat.clean_document_name is clean_document_name
    assert artifact_sources.clean_document_name is clean_document_name
    assert not hasattr(sat, "_clean_document")
    assert not hasattr(artifact_sources, "_clean_document")


def test_clean_document_name_counts_utf16_units_and_never_splits_a_pair():
    doc = clean_document_name(PAGE * 150 + ".pdf")
    assert doc == PAGE * 100 and _js_len(doc) == MAX_SOURCE_DOCUMENT_CHARS
    odd = clean_document_name("a" + PAGE * 150)
    assert odd == "a" + PAGE * 99 and _js_len(odd) == 199
    assert clean_document_name("  x.pdf\x00 ") == "x.pdf"
    assert clean_document_name("\x00 ") is None
    assert clean_document_name(7) is None


def test_stored_source_document_cap_is_utf16():
    with pytest.raises(ValueError):
        StoredSource.model_validate({"document": PAGE * 101, "page": None, "excerpt": None})
    StoredSource.model_validate({"document": PAGE * 100, "page": None, "excerpt": None})


def test_a_long_emoji_filename_resolves_to_a_source_the_guard_accepts():
    cites = [{"document_id": "d1", "chunk_index": 0, "filename": PAGE * 150 + ".pdf", "passage": "Net 30."}]
    out = artifact_sources.resolve_sources([1], cites, ["Net 30"])
    assert isinstance(out, list)
    assert _js_len(out[0]["document"]) <= MAX_SOURCE_DOCUMENT_CHARS
    StoredSource.model_validate(out[0])


def test_the_caption_document_is_cut_the_same_way():
    call = {"name": "analyze_document", "status": "done", "sub_agent": {"filename": PAGE * 150 + ".pdf"}}
    assert sat._source_of(call)["document"] == PAGE * 100


# ── WR-03: a tabular call tolerates empty fillers in the three new encodings ─────────────────────


def _chart(**extra):
    base = {"component": "chart", "title": "Revenue", "chart": {"kind": "bar", "x": "q", "y": ["rev"]},
            "columns": [{"name": "q", "type": "string"}, {"name": "rev", "type": "number"}],
            "rows": [["Q1", 10], ["Q2", 12]]}
    base.update(extra)
    return base


@pytest.mark.parametrize("key", ["diagram", "comparison", "timeline"])
@pytest.mark.parametrize("filler", [{}, [], "", "  ", "null", "{}", "[]", None])
def test_a_chart_with_an_empty_new_encoding_is_still_shown(key, filler):
    out = validate_args(_chart(**{key: filler}))
    assert isinstance(out, am.ChartArgs), out
    assert getattr(out, key) is None


@pytest.mark.parametrize("component", ["table", "metric"])
def test_table_and_metric_tolerate_the_same_fillers(component):
    args = _chart(component=component, diagram={}, comparison=[], timeline="null")
    args.pop("chart")
    if component == "metric":
        args["metric"] = {"value_column": "rev"}
        args["rows"] = [["Q1", 10]]
    out = validate_args(args)
    assert not isinstance(out, ArtifactRefusal), out


def test_a_real_new_encoding_on_a_chart_is_still_refused():
    out = validate_args(_chart(diagram={"nodes": [{"id": "a", "label": "A"}], "edges": []}))
    assert isinstance(out, ArtifactRefusal)


def test_the_filler_normalisation_never_mutates_the_callers_args():
    args = _chart(diagram={})
    validate_args(args)
    assert args["diagram"] == {}


# ── WR-02: a "not stated" (q) cell carries no source ─────────────────────────────────────────────


def _cmp(cells):
    return {"component": "comparison", "title": "Contracts",
            "comparison": {"options": ["Atlas", "Borealis"], "terms": [{"name": "Termination", "cells": cells}]}}


def test_a_q_cell_with_a_source_is_refused_in_words():
    out = validate_args(_cmp([{"verdict": "q", "source": 1}, {"verdict": "n"}]))
    assert isinstance(out, ArtifactRefusal)
    assert out.reason == "a cell marked not stated cites a source"
    assert "omit" in out.detail and "q" in out.detail


def test_a_q_cell_without_a_source_and_a_sourced_verdict_cell_are_accepted():
    out = validate_args(_cmp([{"verdict": "q"}, {"verdict": "n", "source": 2}]))
    assert isinstance(out, ComparisonArgs), out


def test_the_stored_cell_refuses_a_sourced_q_too():
    src = {"document": "a.pdf", "page": None, "excerpt": "x"}
    with pytest.raises(ValueError):
        am.StoredComparisonCell.model_validate({"verdict": "q", "text": None, "source": src})
    am.StoredComparisonCell.model_validate({"verdict": "m", "text": None, "source": src})
