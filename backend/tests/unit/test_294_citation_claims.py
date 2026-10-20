"""Phase 294-03 (DEC-03, Pitfall 7) — claim extraction + ordinals, and the check's wire model.

The server derives every claim it judges from the STORED message, and numbers each in-range
citation marker in document order (``ordinal``). The chat decorates a marker with a verdict only
when its ordinal's ``n`` matches, so the backend ordinals must equal the markers ``CitedMarkdown``
upgrades. ``fixtures/citation_ordinals_v1.json`` is the shared pin: this file asserts the backend
half; ``frontend/src/components/chat/__tests__/citationOrdinals.parity.test.tsx`` renders the
same cases through the real CitedMarkdown.
"""

from __future__ import annotations

import ast
import json
from pathlib import Path
from typing import get_args

import pytest
from pydantic import ValidationError

from app.models.citation_check import (
    CHOICE_LABELS,
    CheckEngineId,
    CitationCheckResult,
    Verdict,
)
from app.services import citation_claims
from app.services.citation_claims import MAX_CHECKED_CLAIMS, dedup_paragraphs, extract_claims

FIXTURES = Path(__file__).resolve().parent / "fixtures"
ORDINALS = json.loads((FIXTURES / "citation_ordinals_v1.json").read_text(encoding="utf-8"))
RESULT_V1 = json.loads((FIXTURES / "citation_check_result_v1.json").read_text(encoding="utf-8"))
CASES = ORDINALS["cases"]
CLAIMS_SRC = Path(citation_claims.__file__).read_text(encoding="utf-8")


def _refs(k: int, passage: str | None = "A source passage with enough text to judge.") -> list[dict]:
    return [
        {"document_id": f"doc-{i}", "filename": f"f{i}.pdf", "chunk_index": i, "passage": passage}
        for i in range(1, k + 1)
    ]


# ── fixture shape (non-vacuity) ─────────────────────────────────────────────────────────────────


def test_fixture_covers_the_required_case_kinds():
    ids = {c["id"] for c in CASES}
    assert len(CASES) >= 9
    for needed in (
        "inline_code_marker_skipped",
        "fenced_code_marker_skipped",
        "link_text_marker_skipped",
        "duplicated_paragraph",
        "out_of_range_and_zero",
        "stacked_markers",
        "table_rows",
        "list_items",
        "heading_with_marker",
    ):
        assert needed in ids, needed


# ── dedup port (1:1 with messageText.ts) ────────────────────────────────────────────────────────


@pytest.mark.parametrize("case", CASES, ids=[c["id"] for c in CASES])
def test_dedup_paragraphs_matches_the_fixture(case):
    assert dedup_paragraphs(case["content"]) == case.get("deduped", case["content"])


def test_dedup_paragraphs_edge_cases():
    assert dedup_paragraphs("") == ""
    # a short repeated paragraph (<= 20 chars) is kept
    assert dedup_paragraphs("Short one.\n\nShort one.") == "Short one.\n\nShort one."
    # a block with a real line break is never sentence-flattened
    block = "This is a long sentence that repeats itself here. \nThis is a long sentence that repeats itself here."
    assert dedup_paragraphs(block) == block


# ── ordinals ────────────────────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize("case", CASES, ids=[c["id"] for c in CASES])
def test_ordinals_equal_the_rendered_markers(case):
    claims = extract_claims(case["content"], _refs(case["n_sources"]))
    assert [c.n for c in claims] == case["expected"]
    assert [c.ordinal for c in claims] == list(range(len(case["expected"])))


@pytest.mark.parametrize("case", CASES, ids=[c["id"] for c in CASES])
def test_claim_sentences(case):
    claims = extract_claims(case["content"], _refs(case["n_sources"]))
    assert [c.sentence for c in claims] == case["expected_sentences"]


def test_out_of_range_markers_get_no_ordinal():
    claims = extract_claims("Alpha beta gamma delta epsilon [5]. Zeta eta theta iota kappa [1].", _refs(1))
    assert [(c.ordinal, c.n) for c in claims] == [(0, 1)]


def test_no_source_refs_means_no_claims():
    assert extract_claims("Alpha beta gamma delta epsilon [1].", []) == []
    assert extract_claims("", _refs(2)) == []


def test_claim_carries_the_cited_passage():
    refs = _refs(2)
    refs[1]["passage"] = "Second passage text."
    claims = extract_claims("First claim is long enough here [1]. Second claim is long enough too [2].", refs)
    assert claims[1].passage == "Second passage text."
    assert not claims[1].no_passage


@pytest.mark.parametrize("passage", [None, "", "   "])
def test_missing_passage_is_flagged(passage):
    refs = _refs(2)
    refs[0]["passage"] = passage
    claims = extract_claims("First claim is long enough here [1]. Second claim is long enough too [2].", refs)
    assert claims[0].no_passage is True
    assert claims[0].passage is None
    assert claims[1].no_passage is False


def test_a_non_dict_source_ref_is_no_passage():
    claims = extract_claims("First claim is long enough here [1].", ["not-a-dict"])  # type: ignore[list-item]
    assert claims[0].no_passage is True


def test_claims_over_the_cap_are_flagged_not_dropped():
    content = "\n".join(f"- Claim number {i} is a long enough sentence [1]" for i in range(MAX_CHECKED_CLAIMS + 5))
    claims = extract_claims("Intro:\n\n" + content, _refs(1))
    assert MAX_CHECKED_CLAIMS == 60
    assert len(claims) == MAX_CHECKED_CLAIMS + 5
    assert not any(c.over_cap for c in claims[:MAX_CHECKED_CLAIMS])
    assert all(c.over_cap for c in claims[MAX_CHECKED_CLAIMS:])


# ── module discipline ───────────────────────────────────────────────────────────────────────────


def test_regexes_are_imported_from_citation_markers_not_retyped():
    tree = ast.parse(CLAIMS_SRC)
    imported = {
        a.name
        for node in ast.walk(tree)
        if isinstance(node, ast.ImportFrom) and node.module == "app.services.citation_markers"
        for a in node.names
    }
    assert {"_MARKER_RE", "_CODE_RE"} <= imported
    assert r"\[(\d+)\]" not in CLAIMS_SRC
    assert "```.*?```" not in CLAIMS_SRC


def test_no_agent_loop_import():
    assert "agent_loop" not in CLAIMS_SRC


def test_pure_module_imports():
    tree = ast.parse(CLAIMS_SRC)
    mods = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            mods |= {a.name.split(".")[0] for a in node.names}
        elif isinstance(node, ast.ImportFrom) and node.module:
            mods.add(node.module)
    assert mods <= {"re", "__future__", "dataclasses", "typing", "app.services.citation_markers"}, mods


# ── wire model ──────────────────────────────────────────────────────────────────────────────────


def test_verdict_literal_is_exactly_the_five_labels():
    assert get_args(Verdict) == ("supported", "partly_supported", "not_supported", "contradicted", "couldnt_check")


def test_choice_labels_are_the_canonical_four():
    assert CHOICE_LABELS == ("supported", "partly_supported", "not_supported", "contradicted")
    assert set(CHOICE_LABELS) == set(get_args(Verdict)) - {"couldnt_check"}


def test_engine_literal_equals_the_migration_check():
    from tests.unit.test_294_migration_211_shape import engine_check_labels

    assert set(get_args(CheckEngineId)) == engine_check_labels()


def test_result_fixture_validates():
    r = CitationCheckResult.model_validate(RESULT_V1)
    assert r.version == 1
    assert [c.verdict for c in r.claims] == [
        "supported", "contradicted", "partly_supported", "not_supported", "couldnt_check",
    ]
    assert r.claims[-1].confidence is None
    assert r.model_dump(mode="json") == RESULT_V1


def test_extra_key_fails_validation():
    bad = json.loads(json.dumps(RESULT_V1))
    bad["reason"] = "model-written prose"
    with pytest.raises(ValidationError):
        CitationCheckResult.model_validate(bad)
    bad2 = json.loads(json.dumps(RESULT_V1))
    bad2["claims"][0]["why"] = "x"
    with pytest.raises(ValidationError):
        CitationCheckResult.model_validate(bad2)


def test_unknown_verdict_fails_validation():
    bad = json.loads(json.dumps(RESULT_V1))
    bad["claims"][0]["verdict"] = "definitely_true"
    with pytest.raises(ValidationError):
        CitationCheckResult.model_validate(bad)


def test_unknown_engine_and_version_fail_validation():
    bad = json.loads(json.dumps(RESULT_V1))
    bad["engine"] = "cohere"
    with pytest.raises(ValidationError):
        CitationCheckResult.model_validate(bad)
    bad2 = json.loads(json.dumps(RESULT_V1))
    bad2["version"] = 2
    with pytest.raises(ValidationError):
        CitationCheckResult.model_validate(bad2)
