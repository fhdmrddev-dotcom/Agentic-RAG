"""Pure claim extraction for the citation check (Phase 294-03, DEC-03, Pitfall 7).

The server derives every claim it judges from the STORED assistant message — a client can never
supply text to be judged. Each in-range citation marker ``[n]`` (``1 <= n <= len(source_refs)``)
gets an ``ordinal``: its 0-based position among the markers the chat actually upgrades. Plan 05
decorates the k-th upgraded marker with claim k's verdict only when its ``n`` matches, so these
ordinals must equal what ``CitedMarkdown`` renders. That is pinned from both stacks by
``backend/tests/unit/fixtures/citation_ordinals_v1.json``.

What the chat renders, and so what this module mirrors:
  * the content is ``dedupParagraphs(content)`` first (``messageText.ts``) — ported 1:1 below,
    including JS ``trim`` / ``\\s`` whitespace and UTF-16 ``length``;
  * markers inside code (fenced blocks, inline spans) are never upgraded — the SAME ``_CODE_RE``
    the backend's marker normaliser uses, imported, never re-typed;
  * markers inside markdown link text (rendered inside ``<a>``) are never upgraded.

Units (what a claim's sentence is cut from): each list item line, each table row and each
heading line is one unit; a plain paragraph is split on ``(?<=[.!?])\\s+(?=[A-Z0-9"(\\[])``, and a
marker cluster that the split would leave at the START of the next sentence is attached to the
preceding one. A claim's text runs from the previous in-range marker cluster in its unit (or the
unit start) to its own cluster; under 20 characters, the whole unit is used. Markers and markdown
emphasis are stripped from the text (code spans are kept verbatim).

Design constraints (do NOT relax):
  * PURE — no I/O, no settings, no provider. Imports only ``re`` and ``citation_markers``.
  * Never imports the agent loop module (``citation_markers`` documents the import cycle that
    would create).
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.services.citation_markers import _CODE_RE, _MARKER_RE

#: At most this many claims are sent to an engine per check; the rest are ``couldnt_check``.
MAX_CHECKED_CLAIMS = 60
#: A claim span shorter than this (after cleaning) uses its whole unit instead.
MIN_SPAN_CHARS = 20

# ── JavaScript whitespace, so the dedup port is 1:1 (String.prototype.trim and regex ``\s``) ─────
_JS_WS_CHARS = (
    "\t\n\x0b\x0c\r   "
    + "".join(chr(c) for c in range(0x2000, 0x200B))
    + "    　﻿"
)
_JS_WS_CLASS = "[" + re.escape(_JS_WS_CHARS) + "]"
_DEDUP_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])" + _JS_WS_CLASS + r"+(?=[A-Z])")

# ── units ───────────────────────────────────────────────────────────────────────────────────────
_LIST_ITEM = re.compile(r"^[ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]+")
_HEADING = re.compile(r"^[ \t]{0,3}#{1,6}[ \t]+")
_TABLE_ROW = re.compile(r"^[ \t]*\|")
_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\"(\[])")
_LEADING_CLUSTER = re.compile(r"(?:\[\d+\])+")
#: A markdown link or image: ``[text](dest "title")``; text may hold one level of brackets.
_LINK = re.compile(r"!?\[((?:[^\[\]\n]|\[[^\[\]\n]*\])*)\]\([^\s)]*(?:\s+\"[^\"]*\")?\)")

# ── cleaning ────────────────────────────────────────────────────────────────────────────────────
_STRONG = re.compile(r"\*\*|__|~~")
_EMPHASIS = re.compile(r"(?<!\w)[*_]+(?=\w)|(?<=\w)[*_]+(?!\w)")
_TABLE_EDGE = re.compile(r"^\s*\||\|\s*$")
_LEAD_PUNCT = re.compile(r"^[\s,;:>\-–—]+")
_TRAIL_PUNCT = re.compile(r"[\s,;:]+$")
_WS = re.compile(r"\s+")


@dataclass(frozen=True)
class Claim:
    ordinal: int
    n: int
    sentence: str
    passage: str | None
    no_passage: bool
    over_cap: bool = False


def _js_trim(s: str) -> str:
    return s.strip(_JS_WS_CHARS)


def _js_len(s: str) -> int:
    """JavaScript ``String.length`` (UTF-16 code units)."""
    return len(s.encode("utf-16-le")) // 2


def dedup_paragraphs(text: str) -> str:
    """1:1 port of ``frontend/src/components/chat/messageText.ts::dedupParagraphs``."""
    if not text:
        return text

    # Pass 1: paragraph-level dedup (split by \n\n)
    deduped: list[str] = []
    prev = ""
    for p in text.split("\n\n"):
        trimmed = _js_trim(p)
        if trimmed == prev and _js_len(trimmed) > 20:
            continue
        deduped.append(p)
        prev = trimmed

    # Pass 2: within a single-line block >= 80 chars, collapse consecutive repeated sentences.
    result: list[str] = []
    for block in deduped:
        if _js_len(block) < 80 or "\n" in block:
            result.append(block)
            continue
        sentences = _DEDUP_SENTENCE_SPLIT.split(block)
        if len(sentences) < 2:
            result.append(block)
            continue
        seen: list[str] = []
        for s in sentences:
            trimmed = _js_trim(s)
            if _js_len(trimmed) > 30 and seen and seen[-1] == trimmed:
                continue
            seen.append(trimmed)
        result.append(" ".join(seen))
    return "\n\n".join(result)


def _blank(chars: list[str], start: int, end: int) -> None:
    for i in range(start, end):
        if chars[i] != "\n":
            chars[i] = " "


def _clean_prose(seg: str) -> str:
    seg = _LINK.sub(r"\1", seg)
    seg = _MARKER_RE.sub("", seg)
    seg = _STRONG.sub("", seg)
    return _EMPHASIS.sub("", seg)


def _clean(raw: str) -> str:
    """Strip markers and emphasis outside code; keep code spans verbatim."""
    parts = _CODE_RE.split(raw)
    for i in range(0, len(parts), 2):  # even indices are prose
        parts[i] = _clean_prose(parts[i])
    out = _WS.sub(" ", "".join(parts))
    out = _TABLE_EDGE.sub("", out.strip())
    out = _LEAD_PUNCT.sub("", out)
    return _TRAIL_PUNCT.sub("", out).strip()


def _units(layout: str) -> list[tuple[int, int]]:
    """Unit spans over ``layout`` (the text with fenced code blanked, offsets preserved)."""
    units: list[tuple[int, int]] = []
    para: list[int] = []  # [start, end] of the open paragraph run

    def close_para() -> None:
        if para:
            units.extend(_split_paragraph(layout, para[0], para[1]))
            para.clear()

    pos = 0
    for line in layout.split("\n"):
        s, e = pos, pos + len(line)
        pos = e + 1
        if not line.strip():
            close_para()
            continue
        m = _LIST_ITEM.match(line) or _HEADING.match(line)
        if m:
            close_para()
            units.append((s + m.end(), e))
        elif _TABLE_ROW.match(line):
            close_para()
            units.append((s, e))
        elif para:
            para[1] = e
        else:
            para.extend((s, e))
    close_para()
    return units


def _split_paragraph(layout: str, start: int, end: int) -> list[tuple[int, int]]:
    out: list[tuple[int, int]] = []
    cur = start
    for m in _SENTENCE_SPLIT.finditer(layout, start, end):
        if m.start() < cur:
            continue  # inside a cluster already attached to the previous unit
        cut, nxt = m.start(), m.end()
        cluster = _LEADING_CLUSTER.match(layout, nxt, end)
        if cluster:
            cut = cluster.end()
            nxt = cluster.end()
            while nxt < end and layout[nxt].isspace():
                nxt += 1
        out.append((cur, cut))
        cur = nxt
    if cur < end:
        out.append((cur, end))
    return out


def _passage(ref: object) -> str | None:
    if not isinstance(ref, dict):
        return None
    p = ref.get("passage")
    if not isinstance(p, str) or not p.strip():
        return None
    return p


def extract_claims(content: str, source_refs: list) -> list[Claim]:
    """Every in-range citation marker the chat upgrades, in document order, as a claim."""
    text = dedup_paragraphs(content or "")
    k = len(source_refs or [])
    if not text or k == 0:
        return []

    masked = list(text)  # every code region blanked: markers inside code vanish
    layout = list(text)  # only fenced blocks blanked: units never span code blocks
    for m in _CODE_RE.finditer(text):
        _blank(masked, m.start(), m.end())
        if m.group(0).startswith(("```", "~~~")):
            _blank(layout, m.start(), m.end())
    masked_s = "".join(masked)
    layout_s = "".join(layout)

    links = [(m.start(), m.end()) for m in _LINK.finditer(masked_s)]

    def in_link(i: int) -> bool:
        return any(a <= i < b for a, b in links)

    markers = [
        (m.start(), m.end(), int(m.group(1)))
        for m in _MARKER_RE.finditer(masked_s)
        if 1 <= int(m.group(1)) <= k and not in_link(m.start())
    ]
    if not markers:
        return []

    units = _units(layout_s)

    def unit_of(i: int) -> tuple[int, int]:
        for us, ue in units:
            if us <= i < ue:
                return us, ue
        line_start = layout_s.rfind("\n", 0, i) + 1
        line_end = layout_s.find("\n", i)
        return line_start, (len(layout_s) if line_end == -1 else line_end)

    claims: list[Claim] = []
    prev_unit: tuple[int, int] | None = None
    span_start = 0
    cluster_start: int | None = None
    prev_end: int | None = None
    for start, end, n in markers:
        unit = unit_of(start)
        if unit != prev_unit:
            prev_unit, span_start, cluster_start, prev_end = unit, unit[0], None, None
        # Adjacent markers (only whitespace between) share one span: "[1][2]" -> same sentence.
        if prev_end is not None and not layout_s[prev_end:start].strip():
            pass  # same cluster
        else:
            if prev_end is not None:
                span_start = prev_end
            cluster_start = start
        sentence = _clean(layout_s[span_start:cluster_start])
        if len(sentence) < MIN_SPAN_CHARS:
            sentence = _clean(layout_s[unit[0]:unit[1]])
        passage = _passage(source_refs[n - 1])
        ordinal = len(claims)
        claims.append(
            Claim(
                ordinal=ordinal,
                n=n,
                sentence=sentence,
                passage=passage,
                no_passage=passage is None,
                over_cap=ordinal >= MAX_CHECKED_CLAIMS,
            )
        )
        prev_end = end
    return claims
