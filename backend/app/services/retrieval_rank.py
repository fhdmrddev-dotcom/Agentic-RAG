"""Phase 272 (D-13) — pure ranking helpers, moved VERBATIM out of ``retrieval_service.py``.

Part of discharging the ``retrieval_service.py`` extraction that had been owed since Phase 231 (SEED-224);
``tests/unit/test_272_pure_move.py`` proves each function is AST-identical to its PHASE_BASE source.

Reciprocal Rank Fusion, near-duplicate removal and the average-cosine summary. ⛔ **What this
module is NOT:** it does no I/O — no database, no embedding, no network. A function that needs
any of those belongs in ``retrieval_rpc.py`` or ``retrieval_documents.py``, never here.
"""
from __future__ import annotations


def _rrf_fuse(
    vector_results: list[dict],
    keyword_results: list[dict],
    k: int = 60,
    vector_weight: float = 1.0,
    keyword_weight: float = 1.0,
) -> list[dict]:
    """Reciprocal Rank Fusion: score(d) = Σ weight/(k + rank_i(d))"""
    scores: dict[str, float] = {}
    docs: dict[str, dict] = {}

    for rank, row in enumerate(vector_results):
        chunk_id = row["id"]
        scores[chunk_id] = scores.get(chunk_id, 0.0) + vector_weight / (k + rank + 1)
        docs[chunk_id] = row

    for rank, row in enumerate(keyword_results):
        chunk_id = row["id"]
        scores[chunk_id] = scores.get(chunk_id, 0.0) + keyword_weight / (k + rank + 1)
        if chunk_id not in docs:
            docs[chunk_id] = row

    fused = sorted(scores.keys(), key=lambda cid: scores[cid], reverse=True)
    result = []
    for chunk_id in fused:
        doc = dict(docs[chunk_id])
        doc["rrf_score"] = scores[chunk_id]
        result.append(doc)
    return result


def _deduplicate_chunks(rows: list[dict], text_overlap_threshold: float = 0.85) -> list[dict]:
    """Remove near-duplicate chunks from a ranked result list.

    Two chunks are considered duplicates when their word-set Jaccard similarity
    exceeds *text_overlap_threshold* (default 0.85). The higher-scoring chunk is
    kept. This is a safety net against the old chunking algorithm producing
    near-identical overlapping chunks and, after the fix, against any edge cases
    in very repetitive documents.
    """
    kept: list[dict] = []
    for candidate in rows:
        words_c = set(candidate["content"].lower().split())
        is_dup = False
        for existing in kept:
            words_e = set(existing["content"].lower().split())
            union = words_c | words_e
            if not union:
                continue
            jaccard = len(words_c & words_e) / len(union)
            if jaccard >= text_overlap_threshold:
                is_dup = True
                break
        if not is_dup:
            kept.append(candidate)
    return kept


def _avg_cosine(rows: list[dict]) -> float:
    """Average cosine similarity from vector search rows. Returns 0.0 if no rows."""
    sims = [row["similarity"] for row in rows if row.get("similarity") and row["similarity"] > 0]
    return sum(sims) / len(sims) if sims else 0.0
