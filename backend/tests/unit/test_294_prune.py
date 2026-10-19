"""Phase 294-01 (D-07) — the pure prune for probabilistic engines.

Drop a candidate only when its probability is < 0.1; keep at least 3 (or all if fewer); never
more than top_n; never empty; on the filtered path keep every matched document's best row.
"""
from __future__ import annotations


def _row(i: int, doc: str | None = None, **extra) -> dict:
    return {"id": f"c{i}", "document_id": doc or f"d{i}", "chunk_index": i, "content": f"p{i}", **extra}


def _scored(probs, docs=None):
    return [(p, _row(i, docs[i] if docs else None)) for i, p in enumerate(probs)]


def test_constants():
    from app.services.rerank_engines.prune import MIN_KEEP, PRUNE_FLOOR

    assert PRUNE_FLOOR == 0.1 and MIN_KEEP == 3


def test_drops_below_the_floor():
    from app.services.rerank_engines.prune import prune

    out = prune(_scored([0.9, 0.05, 0.6, 0.02, 0.5]), 5)
    assert [r["relevance_score"] for r in out] == [0.9, 0.6, 0.5]
    assert [r["id"] for r in out] == ["c0", "c2", "c4"]


def test_all_below_the_floor_keeps_the_top_three():
    from app.services.rerank_engines.prune import prune

    out = prune(_scored([0.01, 0.05, 0.02, 0.09, 0.03]), 5)
    assert [r["relevance_score"] for r in out] == [0.09, 0.05, 0.03]


def test_two_rows_both_below_the_floor_are_both_kept():
    from app.services.rerank_engines.prune import prune

    out = prune(_scored([0.02, 0.05]), 5)
    assert [r["id"] for r in out] == ["c1", "c0"]


def test_empty_is_empty():
    from app.services.rerank_engines.prune import prune

    assert prune([], 5) == []


def test_ties_keep_pre_rerank_order():
    from app.services.rerank_engines.prune import prune

    out = prune(_scored([0.5, 0.7, 0.5, 0.5]), 4)
    assert [r["id"] for r in out] == ["c1", "c0", "c2", "c3"]


def test_never_more_than_top_n():
    from app.services.rerank_engines.prune import prune

    out = prune(_scored([0.9, 0.8, 0.7, 0.6]), 2)
    assert [r["id"] for r in out] == ["c0", "c1"]


def test_keep_documents_keeps_the_best_row_of_a_document_below_the_floor():
    from app.services.rerank_engines.prune import prune

    docs = ["dA", "dA", "dA", "dA", "dB", "dB"]
    out = prune(_scored([0.9, 0.8, 0.7, 0.6, 0.04, 0.08], docs), 3, keep_documents=True)
    assert {r["document_id"] for r in out} == {"dA", "dB"}
    weak = [r for r in out if r["document_id"] == "dB"]
    assert len(weak) == 1 and weak[0]["id"] == "c5", "dB's BEST row (0.08) is the one kept"


def test_rows_are_copies_that_keep_every_key():
    from app.services.rerank_engines.prune import prune

    src = (0.7, _row(0, "dA", low_similarity=True))
    out = prune([src], 5)
    assert out[0] is not src[1]
    for key in ("id", "document_id", "chunk_index", "low_similarity", "content"):
        assert out[0][key] == src[1][key]
    assert out[0]["relevance_score"] == 0.7
    assert "relevance_score" not in src[1], "pure: the input row is never mutated"


def test_never_empty_for_non_empty_input():
    from app.services.rerank_engines.prune import prune

    for n in range(1, 6):
        assert prune(_scored([0.0] * n), 5)
