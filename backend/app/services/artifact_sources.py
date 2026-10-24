"""Phase 292 (D-07, T-292-01) — resolve a ``show_artifact`` element's ``source`` handle. Pure, no I/O.

A diagram node, a comparison cell or a timeline event may carry ``source: n``. ``n`` is the number the
model saw beside a source in THIS turn's citation manifest — ``[n] filename · chunk k``, rendered by
``citation_markers.format_citation_manifest`` over ``_deduplicate_citations(retrieved_citations)``.
The handler passes ``ctx.turn_citations`` (agent_loop's ``retrieved_citations``, by reference), and
this module numbers them with the SAME dedup, never a second numbering.

The resolved value is ``{document, page, excerpt}``:
  * ``document`` — the citation's filename, through ``clean_document_name`` (NUL stripped, trimmed,
    ≤ 200 UTF-16 units; one home in ``app.models.artifact``, shared with the caption — 292-REVIEW IN-04);
  * ``page`` — always null today: ``document_chunks`` carries no page column;
  * ``excerpt`` — up to 280 UTF-16 units of the cited passage, chosen by OUR code: the passage
    sentence sharing the most words (≥ 3 letters) with the element's own text, widened to its
    neighbours while it fits, else the passage head. Model text only steers which sentence; the
    excerpt is always document text. NUL and C0 control characters are stripped. A full-document
    citation (``passage`` None) resolves with no excerpt.

⛔ The model never writes a document name, a page or a clause (D-07). A handle outside 1..k, or any
handle in a turn that retrieved nothing (a Continue run starts empty, RESEARCH IN-01), is a worded
refusal the model can fix by omitting ``source``.

⛔ Imports the standard library, ``app.services.citation_markers`` and ``app.models.artifact`` only:
no DB pool, no supabase client, no provider SDK (the hot-file ledger row's binding invariant).
"""
from __future__ import annotations

import re
from typing import Any

from app.models.artifact import (
    MAX_EXCERPT_CHARS,
    ArtifactRefusal,
    _js_len,
    _refusal,
    clean_document_name,
    parse_source_handle,
)
from app.services.citation_markers import _deduplicate_citations

__all__ = ["excerpt_for", "parse_source_handle", "resolve_sources"]

_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_WHITESPACE = re.compile(r"\s+")
_SENTENCE_END = re.compile(r"(?<=[.!?])\s+")
_WORD = re.compile(r"[^\W\d_]{3,}")
_ELLIPSIS = "…"


def _words(s: str) -> set[str]:
    return {w.lower() for w in _WORD.findall(s)}


def _cut(s: str, limit: int = MAX_EXCERPT_CHARS) -> str:
    """``s`` cut to at most ``limit`` UTF-16 units, at a word boundary when one is near, plus ``…``."""
    if _js_len(s) <= limit:
        return s
    out: list[str] = []
    units = 0
    for ch in s:
        u = _js_len(ch)
        if units + u > limit - 1:  # leave one unit for the ellipsis
            break
        out.append(ch)
        units += u
    head = "".join(out)
    space = head.rfind(" ")
    if space >= len(head) - 40 and space > 0:
        head = head[:space]
    return head.rstrip() + _ELLIPSIS


def excerpt_for(passage: Any, element_text: Any) -> str | None:
    """The excerpt of ``passage`` that best supports ``element_text`` (≤ 280 UTF-16 units), or None."""
    if not isinstance(passage, str):
        return None
    text = _WHITESPACE.sub(" ", _CONTROL.sub("", passage)).strip()
    if not text:
        return None
    sentences = [s for s in _SENTENCE_END.split(text) if s]
    want = _words(element_text) if isinstance(element_text, str) else set()
    scores = [len(want & _words(s)) for s in sentences]
    best = max(range(len(sentences)), key=lambda i: (scores[i], -i))
    if scores[best] == 0:
        return _cut(text)  # nothing overlaps: the passage head
    window = sentences[best]
    if _js_len(window) > MAX_EXCERPT_CHARS:
        return _cut(window)
    lo = hi = best
    while True:
        grew = False
        if hi + 1 < len(sentences):
            cand = window + " " + sentences[hi + 1]
            if _js_len(cand) <= MAX_EXCERPT_CHARS:
                window, hi, grew = cand, hi + 1, True
        if lo > 0:
            cand = sentences[lo - 1] + " " + window
            if _js_len(cand) <= MAX_EXCERPT_CHARS:
                window, lo, grew = cand, lo - 1, True
        if not grew:
            return window


def resolve_sources(
    handles: list[int | None],
    citations: list[dict] | None,
    texts: list[str],
    *,
    seen: int | None = None,
) -> list[dict | None] | ArtifactRefusal:
    """Resolve each handle (in order) against this turn's deduplicated citations.

    ``handles[i]`` is a validated ``int >= 1`` or None; ``texts[i]`` is that element's own text,
    which steers the excerpt. Returns one resolved source (or None) per handle, or a refusal.

    ``seen`` (292-REVIEW WR-01) is how many of those sources the manifest the model was SHOWN
    numbered. ``citations`` keeps growing while one response's tools run, so a handle above ``seen``
    names a source the model never saw as ``[n]`` (a search in the same batch, or a resumed batch
    written against another run's manifest) and is refused. The handler always passes it; ``None``
    (no cap) is for direct callers of this pure function only.
    """
    if all(h is None for h in handles):
        return [None] * len(handles)
    try:
        unique = _deduplicate_citations([c for c in citations or [] if isinstance(c, dict)])
    except (KeyError, TypeError):  # a citation with no document_id cannot be numbered
        unique = []
    if not unique:
        return _refusal(
            "unresolved_source",
            "a `source` was given, but nothing was retrieved in this turn, so there is no [n] to cite. "
            "Omit `source` (the caption will say the values came from you), or search first.",
        )
    k = len(unique)
    shown = k if seen is None else max(0, min(k, seen))
    out: list[dict | None] = []
    for h, text in zip(handles, texts):
        if h is None:
            out.append(None)
            continue
        if not 1 <= h <= k:
            return _refusal(
                "unresolved_source",
                f"source {h} is not one of this turn's sources (1-{k}). Use the [n] shown beside a source "
                "retrieved in this turn, or omit `source`.",
            )
        if h > shown:
            if shown == 0:
                detail = (f"source {h} was retrieved in this same step, so it had no [n] in the list you were "
                          "shown. Search first, then call show_artifact in a later step using the [n] you see "
                          "then, or omit `source`.")
            else:
                detail = (f"source {h} wasn't in the list you were shown (1-{shown}); it was retrieved in this "
                          "same step. Search first, then call show_artifact in a later step, or use a number "
                          f"from 1-{shown}, or omit `source`.")
            return _refusal("unresolved_source", detail)
        c = unique[h - 1]
        out.append({
            "document": clean_document_name(c.get("filename")),
            "page": None,
            "excerpt": excerpt_for(c.get("passage"), text),
        })
    return out
