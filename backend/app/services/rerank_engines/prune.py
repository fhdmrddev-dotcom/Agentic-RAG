"""PURE D-07 prune for the probabilistic engines (Jev ``noul``, OpenAI ``predicate``).

Drop a candidate only when its probability is < ``PRUNE_FLOOR``; keep at least ``MIN_KEEP`` (or
all if fewer); never more than ``top_n``; never return an empty set for a non-empty input. On the
filtered path (``keep_documents=True``, D-27) every matched document keeps its best row — the
caller then applies ``_cover_matched_documents(…, top_k)`` unchanged.

⛔ Cohere and Local never come through here: their scores are ranks, not probabilities (D-08).
No I/O and no settings reads — everything arrives as an argument.
"""
from __future__ import annotations

PRUNE_FLOOR = 0.1   # D-07
MIN_KEEP = 3        # D-07


def prune(scored: list[tuple[float, dict]], top_n: int, *, keep_documents: bool = False) -> list[dict]:
    """``scored`` = ``[(probability, row)]`` in PRE-rerank order. Returns COPIES of the rows, in
    probability order (ties keep the pre-rerank order), each with ``relevance_score`` added."""
    ranked = [s for _, s in sorted(enumerate(scored), key=lambda t: (-t[1][0], t[0]))]
    floor_keep = min(MIN_KEEP, len(ranked))
    kept = [s for s in ranked if s[0] >= PRUNE_FLOOR]
    if len(kept) < floor_keep:
        kept = ranked[:floor_keep]                     # never empty
    if keep_documents:
        have = {row.get("document_id") for _, row in kept}
        for s in ranked:                               # ranked order: the first row seen is the BEST
            doc = s[1].get("document_id")
            if doc not in have:
                kept.append(s)
                have.add(doc)
        order = {id(s): i for i, s in enumerate(ranked)}
        kept.sort(key=lambda s: order[id(s)])          # back into probability order, stable
    else:
        kept = kept[:top_n]                            # never more than top_n
    return [{**row, "relevance_score": p} for p, row in kept]
