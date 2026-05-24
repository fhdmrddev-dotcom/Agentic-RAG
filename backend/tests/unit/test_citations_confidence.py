"""Unit tests for _compute_confidence, _deduplicate_citations, and confidence event helpers.

These tests are written TDD-style: they will fail with ImportError until Task 2
adds the helper functions to threads.py.
"""
import pytest

from app.api.threads import _compute_confidence, _deduplicate_citations

# ---------------------------------------------------------------------------
# Helpers used in multiple test classes
# ---------------------------------------------------------------------------

LOW_DISCLAIMER = (
    "This answer is based on limited or weakly-matched evidence. "
    "Please verify with the source documents."
)

CONFIDENCE_THRESHOLDS = {
    "high": 0.54,
    "medium_upper": 0.53,
    "medium_lower": 0.38,
    "low": 0.37,
}


def _make_citation(
    doc_id: str,
    chunk_index: int | None = 1,
    filename: str = "test.pdf",
    passage: str | None = "Some text",
    similarity: float | None = 0.8,
    is_full_doc: bool = False,
) -> dict:
    return {
        "document_id": doc_id,
        "filename": filename,
        "chunk_index": chunk_index,
        "passage": passage,
        "similarity": similarity,
        "is_full_doc": is_full_doc,
    }


# ---------------------------------------------------------------------------
# TestComputeConfidence — 6 tests
# ---------------------------------------------------------------------------

class TestComputeConfidence:
    """Tests for _compute_confidence(avg_similarity: float) -> str."""

    def test_high_confidence(self):
        """avg_similarity >= 0.54 maps to 'high' (Phase 076 recalibration)."""
        assert _compute_confidence(0.85) == "high"

    def test_high_confidence_boundary(self):
        """Boundary value 0.54 maps to 'high' (inclusive, Phase 076)."""
        assert _compute_confidence(CONFIDENCE_THRESHOLDS["high"]) == "high"

    def test_medium_confidence(self):
        """avg_similarity in [0.38, 0.54) maps to 'medium' (Phase 076)."""
        assert _compute_confidence(0.45) == "medium"

    def test_medium_confidence_boundary(self):
        """Boundary value 0.38 maps to 'medium' (inclusive, Phase 076)."""
        assert _compute_confidence(CONFIDENCE_THRESHOLDS["medium_lower"]) == "medium"

    def test_low_confidence(self):
        """avg_similarity < 0.38 maps to 'low' (Phase 076)."""
        assert _compute_confidence(0.3) == "low"

    def test_low_confidence_zero(self):
        """0.0 similarity maps to 'low'."""
        assert _compute_confidence(0.0) == "low"


# ---------------------------------------------------------------------------
# TestDeduplicateCitations — 5 tests
# ---------------------------------------------------------------------------

class TestDeduplicateCitations:
    """Tests for _deduplicate_citations(citations: list[dict]) -> list[dict]."""

    def test_deduplicates_by_document_id_and_chunk_index(self):
        """Two citations with same (doc_id, chunk_index) → returns 1 citation."""
        c1 = _make_citation("doc-1", chunk_index=1)
        c2 = _make_citation("doc-1", chunk_index=1)
        result = _deduplicate_citations([c1, c2])
        assert len(result) == 1

    def test_keeps_different_chunks_same_document(self):
        """Same doc_id but different chunk_index → both kept."""
        c1 = _make_citation("doc-1", chunk_index=1)
        c2 = _make_citation("doc-1", chunk_index=2)
        result = _deduplicate_citations([c1, c2])
        assert len(result) == 2

    def test_handles_null_chunk_index(self):
        """Two citations with same doc_id and chunk_index=None → deduplicated to 1."""
        c1 = _make_citation("doc-1", chunk_index=None)
        c2 = _make_citation("doc-1", chunk_index=None)
        result = _deduplicate_citations([c1, c2])
        assert len(result) == 1

    def test_preserves_order(self):
        """First occurrence wins; duplicates removed in insertion order.

        Input: A, B, C where A and C share (doc_id, chunk_index).
        Expected output: A, B (C is dropped as duplicate of A).
        """
        a = _make_citation("doc-a", chunk_index=1)
        b = _make_citation("doc-b", chunk_index=1)
        c = _make_citation("doc-a", chunk_index=1, passage="Different text")
        result = _deduplicate_citations([a, b, c])
        assert len(result) == 2
        assert result[0]["document_id"] == "doc-a"
        assert result[1]["document_id"] == "doc-b"
        # First occurrence wins — passage from 'a', not 'c'
        assert result[0]["passage"] == a["passage"]

    def test_empty_input(self):
        """Empty list → empty list."""
        assert _deduplicate_citations([]) == []


# ---------------------------------------------------------------------------
# TestConfidenceDisclaimer — 3 tests
# ---------------------------------------------------------------------------

class TestConfidenceDisclaimer:
    """Tests for disclaimer logic tied to _compute_confidence levels.

    The disclaimer is expected to be part of the confidence event payload.
    We test it via the CONFIDENCE_DISCLAIMER constant from threads.py and
    by asserting the expected disclaimer text is correctly associated with 'low'.
    """

    def test_disclaimer_present_when_low(self):
        """For level 'low', disclaimer text must equal the canonical disclaimer string."""
        from app.api.threads import CONFIDENCE_DISCLAIMER

        level = _compute_confidence(0.3)
        assert level == "low"
        disclaimer = CONFIDENCE_DISCLAIMER if level == "low" else None
        assert disclaimer == LOW_DISCLAIMER

    def test_disclaimer_absent_when_high(self):
        """For level 'high', disclaimer is None."""
        from app.api.threads import CONFIDENCE_DISCLAIMER

        level = _compute_confidence(0.85)
        assert level == "high"
        disclaimer = CONFIDENCE_DISCLAIMER if level == "low" else None
        assert disclaimer is None

    def test_disclaimer_absent_when_medium(self):
        """For level 'medium', disclaimer is None."""
        from app.api.threads import CONFIDENCE_DISCLAIMER

        level = _compute_confidence(0.45)
        assert level == "medium"
        disclaimer = CONFIDENCE_DISCLAIMER if level == "low" else None
        assert disclaimer is None
