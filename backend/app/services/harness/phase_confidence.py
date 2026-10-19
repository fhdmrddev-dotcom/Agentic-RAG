"""Phase 289 (TRUST-01 / SEED-152) — chat's retrieval confidence, on ONE KB phase output.

Three functions, and the whole point is that none of them computes anything new:

  * ``phase_confidence`` (pure, write side) — called by the two LLM-agent executors in
    ``phase_types.py``. It averages the similarity scores the phase's OWN ``search_documents``
    calls returned and hands that mean to ``agent_loop._compute_confidence`` with the run
    owner's ``user_settings``: the same function, the same buckets, the same disclaimer chat
    uses at ``agent_loop.py`` (the ``similarity_scores`` / ``_compute_confidence`` block before
    the assistant message is persisted). No model or provider is called (D-07 / SC#5).
  * ``confidence_for_wire`` (pure, read side) — the run read's allow-list over the stored dict.
  * ``resolve_kb_label`` (async, read side) — the words a person reads for "<KB>" (R-05).

The level is FROZEN AT WRITE TIME. Runs recorded before this phase carry no ``confidence`` key
and render no line; nothing here backfills, because recomputing at read time would let a later
bucket change re-label a record that already happened.

D-09, the absence rules, all owned here so the executors add no branch (D-16):
  * no ``search_documents`` call            -> ``None`` (the UI draws nothing)
  * searched, scores empty, no error        -> level ``"none"`` ("nothing matched")
  * searched, scores empty, retrieval error -> ``None`` — "nothing matched" would be a false
    sentence about a search that never ran to completion.

⚠ ``agent_loop`` is imported INSIDE the functions, never at module top: ``agent_loop`` imports
the harness package transitively (``harness_engine._finalize_run_grounding`` carries the same
lazy import for the same reason). It also keeps this module free of any top-level provider
import, which ``test_289_phase_confidence.py`` fences by AST (T-289-11).

⚠ This is NOT the metadata ConfidenceChip's tier (0.75 / 0.5 on extracted fields). Those are a
different measurement and must never be conflated with retrieval confidence (research F1).
"""
from __future__ import annotations

import logging
import unicodedata
from typing import Any
from uuid import UUID

logger = logging.getLogger(__name__)

KB_LABEL_DEFAULT = "the knowledge base"
_KB_LABEL_MAX = 80
_WIRE_LEVELS = frozenset({"high", "medium", "low", "none"})


def _passage_count(citations: Any) -> int:
    """Unique ``(document_id, chunk_index)`` pairs — chat's own dedupe, fed only real citations."""
    from app.services.agent_loop import _deduplicate_citations  # noqa: PLC0415

    usable = [
        c for c in (citations or []) if isinstance(c, dict) and c.get("document_id") is not None
    ]
    return len(_deduplicate_citations(usable)) if usable else 0


def phase_confidence(
    scores: Any,
    searched: bool = False,
    user_settings: Any = None,
    citations: Any = None,
    retrieval_error: Any = None,
) -> dict | None:
    """The confidence dict stored on a KB phase output, or ``None`` for a phase with no KB use.

    ``scores`` is the per-call similarity list the sub-agent harvested (one mean per
    ``search_documents`` call). A non-empty list IS a search — scores only come from that tool —
    so ``searched`` is only needed for the "searched and matched nothing" case.
    """
    usable = [
        float(s)
        for s in (scores or [])
        if isinstance(s, (int, float)) and not isinstance(s, bool)
    ]
    if not usable:
        if not searched or retrieval_error:
            return None
        return {"level": "none", "avg_similarity": None, "disclaimer": None, "passages": 0}

    from app.services.agent_loop import (  # noqa: PLC0415
        CONFIDENCE_DISCLAIMER,
        _compute_confidence,
    )

    avg = sum(usable) / len(usable)
    level = _compute_confidence(avg, user_settings)
    return {
        "level": level,
        "avg_similarity": round(avg, 4),
        "disclaimer": CONFIDENCE_DISCLAIMER if level == "low" else None,
        "passages": _passage_count(citations),
    }


def confidence_for_wire(raw: Any, kb_label: str) -> dict | None:
    """Allow-list a stored confidence dict for the run read (T-289-07).

    Unknown level, non-dict input or a jsonb string scalar -> ``None``. Each of the four stored
    keys is read BY NAME and coerced; nothing else on the object can travel.
    """
    if not isinstance(raw, dict):
        return None
    level = raw.get("level")
    if not isinstance(level, str) or level not in _WIRE_LEVELS:
        return None
    avg = raw.get("avg_similarity")
    avg_out = float(avg) if isinstance(avg, (int, float)) and not isinstance(avg, bool) else None
    disclaimer = raw.get("disclaimer")
    passages = raw.get("passages")
    if isinstance(passages, float) and passages.is_integer():
        passages = int(passages)
    passages_out = passages if isinstance(passages, int) and not isinstance(passages, bool) else 0
    return {
        "level": level,
        "avg_similarity": avg_out,
        "disclaimer": disclaimer if isinstance(disclaimer, str) and disclaimer else None,
        "passages": max(passages_out, 0),
        "kb_label": kb_label,
    }


def _clean_folder_name(value: Any) -> str | None:
    """Strip control (Cc) and format (Cf) characters, trim, clamp (T-289-08)."""
    if not isinstance(value, str):
        return None
    kept = "".join(ch for ch in value if unicodedata.category(ch) not in ("Cc", "Cf"))
    kept = kept.strip()[:_KB_LABEL_MAX].strip()
    return kept or None


async def resolve_kb_label(conn: Any, definition: Any) -> str:
    """The words for "<KB>": the bound project folder's name, else ``KB_LABEL_DEFAULT``.

    ``conn`` is duck-typed — only ``await conn.fetchval(sql, folder_id)`` is called — so the
    caller may pass the pool OR a single RLS-enforced connection (plan 03 passes a non-owner
    viewer's own connection, so a folder the viewer cannot see resolves to the default words).
    Never raises: a label is an affordance on a pure read, and a failure here must not 500 it.
    """
    if isinstance(definition, dict):
        raw_id = definition.get("project_folder_id")
    else:
        raw_id = getattr(definition, "project_folder_id", None)
    if raw_id is None or conn is None:
        return KB_LABEL_DEFAULT
    try:
        folder_id = raw_id if isinstance(raw_id, UUID) else UUID(str(raw_id))
    except (ValueError, TypeError, AttributeError):
        return KB_LABEL_DEFAULT
    try:
        name = await conn.fetchval("SELECT name FROM folders WHERE id = $1", folder_id)
    except Exception:  # noqa: BLE001 — degrade to the default words, never fail the read.
        logger.warning("kb label lookup failed for folder %s", folder_id, exc_info=True)
        return KB_LABEL_DEFAULT
    return _clean_folder_name(name) or KB_LABEL_DEFAULT
