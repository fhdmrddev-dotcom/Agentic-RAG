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


# ── WR-01: a handle resolves only against the manifest the model was SHOWN ──────────────────────

import ast as _ast  # noqa: E402
import asyncio  # noqa: E402
import io as _io  # noqa: E402
import json as _json  # noqa: E402
import pathlib as _pathlib  # noqa: E402
import tokenize as _tokenize  # noqa: E402
from types import SimpleNamespace  # noqa: E402
from unittest.mock import AsyncMock, patch  # noqa: E402
from uuid import UUID  # noqa: E402

from app.services.tools.base import ToolContext  # noqa: E402

_CITES = [
    {"document_id": "d1", "chunk_index": 0, "filename": "Invoice_Policy.pdf",
     "passage": "Invoices are received by accounts payable. Approved invoices are paid on the next run."},
    {"document_id": "d2", "chunk_index": 1, "filename": "Kestrel_Proposal.pdf",
     "passage": "Sixty days' written notice is required to terminate."},
]


def test_a_handle_beyond_the_shown_manifest_is_refused():
    out = artifact_sources.resolve_sources([2], _CITES, ["notice"], seen=1)
    assert isinstance(out, ArtifactRefusal)
    assert out.reason == "a source it cites wasn't retrieved in this turn"
    assert "wasn't in the list you were shown" in out.detail and "1-1" in out.detail
    ok = artifact_sources.resolve_sources([1], _CITES, ["Invoices"], seen=1)
    assert isinstance(ok, list) and ok[0]["document"] == "Invoice_Policy.pdf"


def test_sources_retrieved_in_the_same_step_are_not_citable_yet():
    out = artifact_sources.resolve_sources([1], _CITES, ["x"], seen=0)
    assert isinstance(out, ArtifactRefusal)
    assert "later step" in out.detail


def test_seen_never_exceeds_what_was_retrieved():
    out = artifact_sources.resolve_sources([3], _CITES, ["x"], seen=9)
    assert isinstance(out, ArtifactRefusal) and "1-2" in out.detail


def test_tool_context_defaults_to_nothing_shown():
    assert ToolContext.__dataclass_fields__["turn_citations_seen"].default == 0


_U = "0f3a9c71-2b6e-4f18-a5d4-7e8b9c0d1a2f"
_T = "5b1f6c2e-8a47-4d3b-9e0f-2c7a1d9b4e63"


def _handler_ctx(**over):
    base = dict(redis=object(), run_id=UUID("9d7e3b21-4c58-4a6f-b0e2-1f8c6a3d5b79"), thread_id=_T, pool=object(),
                current_user={"id": _U, "org_id": None}, emit=AsyncMock(), tool_call_id="call_0",
                parent_run_id=None, phase_whitelist=None, turn_tool_calls=[], turn_citations=list(_CITES))
    base.update(over)
    return SimpleNamespace(**base)


def _timeline_args(source):
    return {"component": "timeline", "title": "History",
            "timeline": {"events": [{"date": "2024-02-09", "title": "Notice period agreed", "source": source}]}}


def _handle(args, ctx):
    with patch("app.services.show_artifact_tool.insert_artifact", new=AsyncMock(return_value={
        "id": "a_0000000001", "label": "timeline 1", "component": "timeline", "row_count": 1,
        "spec": {"title": "History", "timeline": {"events": []}}})) as ins:
        res = asyncio.run(sat.handle_show_artifact(args, ctx))
    return _json.loads(res.result), ins


def test_the_handler_refuses_a_handle_the_model_was_not_shown():
    obj, ins = _handle(_timeline_args(2), _handler_ctx(turn_citations_seen=1))
    assert obj.get("status") == "refused", obj
    ins.assert_not_called()
    obj2, ins2 = _handle(_timeline_args(2), _handler_ctx(turn_citations_seen=2))
    assert obj2.get("status") != "refused", obj2
    assert ins2.call_count == 1


def test_an_unwired_ctx_has_seen_nothing():
    obj, ins = _handle(_timeline_args(1), _handler_ctx())  # no turn_citations_seen attribute
    assert obj.get("status") == "refused"
    ins.assert_not_called()


_LOOP = _pathlib.Path(__file__).resolve().parents[2] / "app" / "services" / "agent_loop.py"


def _loop_code() -> str:
    src = _LOOP.read_text(encoding="utf-8")
    toks = [t for t in _tokenize.generate_tokens(_io.StringIO(src).readline) if t.type != _tokenize.COMMENT]
    return _tokenize.untokenize(toks)


def test_both_tool_context_builds_pass_what_the_model_was_shown():
    tree = _ast.parse(_LOOP.read_text(encoding="utf-8"))
    builds = [n for n in _ast.walk(tree) if isinstance(n, _ast.Call)
              and getattr(n.func, "id", getattr(n.func, "attr", None)) == "ToolContext"]
    assert len(builds) == 2
    values = []
    for call in builds:
        kw = {k.arg: k.value for k in call.keywords}
        assert "turn_citations_seen" in kw, f"ToolContext at line {call.lineno} lacks turn_citations_seen"
        values.append(kw["turn_citations_seen"])
    first, second = sorted(zip([c.lineno for c in builds], values))
    # The resume build (first in the file) resolves against a fresh run's list: nothing was shown.
    assert isinstance(first[1], _ast.Constant) and first[1].value == 0
    # The main build reads the count frozen where the manifest is injected.
    assert isinstance(second[1], _ast.Name) and second[1].id == "citations_shown"


def test_the_shown_count_is_frozen_where_the_manifest_is_injected():
    code = _loop_code()
    assert code.count("citations_shown = 0") == 1
    assert code.count("citations_shown = len(_deduplicate_citations(retrieved_citations))") == 1
    inject = code.index("apply_citation_instruction(\n")
    frozen = code.index("citations_shown = len(_deduplicate_citations(retrieved_citations))")
    assert 0 < frozen - inject < 400, "the count is taken next to the manifest it describes"
