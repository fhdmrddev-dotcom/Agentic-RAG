"""Phase 292-01 (D-07, T-292-01) — a ``source`` handle resolves against THIS turn's citation manifest.

The model sees ``[n] filename · chunk k`` lines (``citation_markers.format_citation_manifest`` over
``_deduplicate_citations(retrieved_citations)``). A handle is that ``n``. The server resolves it to
``{document, page: null, excerpt}``; the model never writes a document name, page or clause.
"""
from __future__ import annotations

import ast
from pathlib import Path

import pytest

from app.models.artifact import MAX_EXCERPT_CHARS, ArtifactRefusal, _js_len
from app.services.artifact_sources import excerpt_for, parse_source_handle, resolve_sources
from app.services.citation_markers import _deduplicate_citations

SRC = Path(__file__).resolve().parents[2] / "app" / "services" / "artifact_sources.py"

POLICY = (
    "This policy applies to every supplier invoice. Invoices are received by the accounts payable "
    "team. Any invoice that does not match its purchase order is returned to the supplier for "
    "correction. Approved invoices are paid on the next payment run. Records are kept for seven years."
)


def _citations() -> list[dict]:
    return [
        {"document_id": "d1", "chunk_index": 0, "filename": "Invoice_Policy.pdf", "passage": POLICY},
        {"document_id": "d2", "chunk_index": 3, "filename": "Finance_Handbook.pdf",
         "passage": "Finance creates the vendor record. Bank details are verified by call-back."},
        {"document_id": "d1", "chunk_index": 0, "filename": "Invoice_Policy.pdf", "passage": POLICY},  # dup
        {"document_id": "d3", "chunk_index": None, "filename": "Whole_Contract.pdf", "passage": None,
         "is_full_doc": True},
    ]


def test_numbering_equals_the_manifest_dedup_order():
    cites = _citations()
    unique = _deduplicate_citations(cites)
    assert len(unique) == 3
    out = resolve_sources([2], cites, ["Bank details verified"])
    assert isinstance(out, list)
    assert out[0]["document"] == unique[1]["filename"] == "Finance_Handbook.pdf"
    assert out[0]["page"] is None
    assert out[0]["excerpt"] and out[0]["excerpt"] in unique[1]["passage"]
    assert _js_len(out[0]["excerpt"]) <= MAX_EXCERPT_CHARS


def test_handle_three_is_the_full_document_with_no_excerpt():
    out = resolve_sources([3], _citations(), ["anything"])
    assert out == [{"document": "Whole_Contract.pdf", "page": None, "excerpt": None}]


def test_out_of_range_handle_is_refused_naming_the_range():
    out = resolve_sources([4], _citations(), ["x"])
    assert isinstance(out, ArtifactRefusal)
    assert out.reason == "a source it cites wasn't retrieved in this turn"
    assert "1-3" in out.detail


@pytest.mark.parametrize("cites", [None, []])
def test_any_handle_with_no_retrieval_is_refused(cites):
    out = resolve_sources([None, 1], cites, ["a", "b"])
    assert isinstance(out, ArtifactRefusal)
    assert out.reason == "a source it cites wasn't retrieved in this turn"
    assert "nothing was retrieved" in out.detail
    assert "omit `source`" in out.detail.lower() or "omit" in out.detail.lower()


@pytest.mark.parametrize("cites", [None, [], _citations()])
def test_all_none_handles_resolve_to_nones(cites):
    assert resolve_sources([None, None, None], cites, ["a", "b", "c"]) == [None, None, None]


def test_document_names_get_the_caption_hygiene():
    cites = [{"document_id": "d", "chunk_index": 0, "filename": "  Re\x00port.pdf  " + "x" * 300, "passage": "Hi."}]
    out = resolve_sources([1], cites, ["hi"])
    doc = out[0]["document"]
    assert "\x00" not in doc
    assert not doc.startswith(" ")
    assert len(doc) <= 200


def test_excerpt_picks_the_best_overlapping_sentence():
    ex = excerpt_for(POLICY, "Matches the purchase order?")
    assert "purchase order is returned to the supplier" in ex
    assert _js_len(ex) <= MAX_EXCERPT_CHARS
    assert ex in " ".join(POLICY.split())


def test_excerpt_falls_back_to_the_passage_head():
    ex = excerpt_for(POLICY, "zzz qqq")
    assert ex.startswith("This policy applies")


def test_excerpt_widens_but_never_past_the_cap():
    long = " ".join(f"Sentence number {i} talks about widgets and gadgets." for i in range(40))
    ex = excerpt_for(long, "widgets gadgets")
    assert 0 < _js_len(ex) <= MAX_EXCERPT_CHARS
    one_huge = "word " * 400
    assert _js_len(excerpt_for(one_huge, "word")) <= MAX_EXCERPT_CHARS


def test_excerpt_strips_nul_and_control_characters():
    ex = excerpt_for("Line one\x00 has\x07 a bell.\nLine two\x1b ends.", "bell")
    assert all(ord(ch) >= 32 for ch in ex), repr(ex)


@pytest.mark.parametrize("passage", [None, "", "   ", 5])
def test_excerpt_of_no_passage_is_none(passage):
    assert excerpt_for(passage, "x") is None


def test_excerpt_counts_utf16_units():
    emoji_text = "\U0001F600" * 300 + "."
    ex = excerpt_for(emoji_text, "x")
    assert _js_len(ex) <= MAX_EXCERPT_CHARS


def test_parse_source_handle_is_the_models_rule():
    assert parse_source_handle("[2]") == 2
    with pytest.raises(ValueError):
        parse_source_handle(True)


def test_module_is_pure():
    tree = ast.parse(SRC.read_text(encoding="utf-8"))
    mods = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            mods.update(a.name for a in node.names)
        elif isinstance(node, ast.ImportFrom):
            mods.add(node.module or "")
    app_mods = {m for m in mods if m.startswith("app")}
    assert app_mods <= {"app.services.citation_markers", "app.models.artifact"}, app_mods
    for banned in ("asyncpg", "httpx", "openai", "anthropic", "google", "supabase"):
        assert not any(m.split(".")[0] == banned for m in mods), banned
