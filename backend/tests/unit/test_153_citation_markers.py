"""Wave-0 unit tests for the pure citation-marker normalizer (Phase 153, D-02/D-03).

TDD (RED first): these fail with ImportError until ``citation_markers.py`` provides
``normalize_citation_markers`` + ``format_citation_manifest``.

The module under test is PURE — no Redis, no DB, no I/O, no provider fork. It is the
single source of numbering truth (D-03): the backend strips every out-of-range /
non-member ``[n]`` marker before persist (D-02) and keeps survivors aligned to the
finalized ``unique_citations`` footer order.
"""

from app.services.citation_markers import (
    format_citation_manifest,
    normalize_citation_markers,
)


def _chunk(doc_id: str, chunk_index: int = 0, filename: str = "doc.pdf") -> dict:
    return {
        "document_id": doc_id,
        "filename": filename,
        "chunk_index": chunk_index,
        "passage": "some passage",
        "similarity": 0.7,
        "is_full_doc": False,
        "version_number": 1,
    }


def _full_doc(doc_id: str, filename: str = "whole.docx") -> dict:
    return {
        "document_id": doc_id,
        "filename": filename,
        "chunk_index": None,
        "passage": None,
        "similarity": None,
        "is_full_doc": True,
        "version_number": 1,
    }


class TestStripAndRenumber:
    def test_strips_non_members(self):
        # 2 real sources; [3] and [9] are out of range -> removed so those claims
        # read unmarked (D-02). The valid [1] survives; surrounding prose is intact.
        citations = [_chunk("a"), _chunk("b", chunk_index=2)]
        text = "A [1] B [3] C [9]"
        out = normalize_citation_markers(text, citations)
        assert "[1]" in out
        assert "[3]" not in out
        assert "[9]" not in out
        assert out.startswith("A [1] B")
        assert out.endswith("C ")

    def test_renumbers_to_footer(self):
        # Survivors map 1:1 to existing footer rows in the canonical order. When the
        # manifest order equals the dedup order the renumber is an identity (D-03);
        # out-of-order VALID markers all survive pointing at their footer row.
        citations = [
            _chunk("a"),
            _chunk("b", chunk_index=2),
            _chunk("c", chunk_index=5),
        ]
        text = "X [2] Y [1] Z [3]"
        assert normalize_citation_markers(text, citations) == "X [2] Y [1] Z [3]"
        # A survivor never maps to a footer row that does not exist (k == 3 -> no [4]).
        assert "[4]" not in normalize_citation_markers("W [4] done", citations)

    def test_skips_code_spans(self):
        citations = [_chunk("a")]

        # Inline code span: `arr[1]` must stay literal; the prose [1] is a real marker.
        inline = "prose [1] and `arr[1]` inline"
        out = normalize_citation_markers(inline, citations)
        assert "`arr[1]`" in out
        assert out.count("[1]") == 2  # prose marker kept + literal inside the code span

        # Fenced block: the [1] inside ``` fences is NOT a marker (Pitfall 2).
        fenced = "before [1]\n```\ncode [1] here\n```\nafter [1]"
        out2 = normalize_citation_markers(fenced, citations)
        assert "code [1] here" in out2
        assert out2.count("[1]") == 3  # before + fenced-literal + after

    def test_no_markers_noop(self):
        citations = [_chunk("a")]
        text = "no markers at all here"
        assert normalize_citation_markers(text, citations) == text
        # Empty citation set strips every [n] (nothing is a valid member).
        assert normalize_citation_markers("A [1] B [2]", []) == "A  B "


class TestManifest:
    def test_format_citation_manifest(self):
        citations = [
            _chunk("a", chunk_index=3, filename="Q3.pdf"),
            _full_doc("b", filename="contract.docx"),
        ]
        lines = format_citation_manifest(citations).splitlines()
        assert lines[0] == "[1] Q3.pdf · chunk 4"  # 1-based number + chunk_index+1
        assert lines[1] == "[2] contract.docx · full document"  # is_full_doc branch
