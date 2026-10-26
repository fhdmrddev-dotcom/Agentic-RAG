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
  * markers inside markdown link text (rendered inside ``<a>``) are never upgraded;
  * 294-REVIEW CR-02 — block constructs a regex over the raw text missed, MEASURED against marked:
    an indented (4-column) code block and an unclosed fence render as code; a link reference
    definition (``[1]: annual-report.pdf``) is dropped, and every ``[1]`` naming it becomes a
    link. ``_block_regions`` / ``_reference_links`` blank those. Before the fix the review's
    example gave backend ordinals ``n = 1, 2, 2, 1`` against the chat's ``2, 2``, so the
    Headcount marker showed the Margins sentence's verdict (same ``n``, wrong sentence).

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

# ── block constructs marked renders as code or drops (294-REVIEW CR-02) ──────────────────────────
# Mirrors marked 17 (gfm, breaks), MEASURED against it, not CommonMark from memory: the drive set
# is in fixtures/citation_ordinals_v1.json (rendered through the real CitedMarkdown by
# citationOrdinals.parity.test.tsx).
#: A fence opener after at most 3 columns of (relative) indent. A backtick fence's info string
#: may not contain a backtick (then the line is a paragraph).
_FENCE_OPEN = re.compile(r"(`{3,}|~{3,})(.*)")
#: A link reference definition (marked's ``def`` rule): ``[label]: dest "title"``. The label has
#: a non-space character and no unescaped bracket; only spaces may follow the colon (a tab makes
#: it a paragraph); a destination with trailing text that is not a quoted title is no definition.
_DEF_LABEL = r"\[(?P<label>(?!\s*\])(?:\\.|[^\[\]\\\n])+)\]:"
_DEF_DEST = r"(?P<dest><[^<>\n]*>|[^<\s]\S*)"
_DEF_TITLE = r"(?P<title>\"(?:\\\"?|[^\"\\\n])*\"|'[^'\n]*'|\([^()\n]*\))"
_REF_DEF = re.compile(_DEF_LABEL + r" *" + _DEF_DEST + r"(?: +" + _DEF_TITLE + r")? *$")
#: ``[label]:`` alone; the destination may then sit on the next line.
_REF_DEF_OPEN = re.compile(_DEF_LABEL + r" *$")
_REF_DEF_DEST_LINE = re.compile(r"[ \t]*" + _DEF_DEST + r"(?: +" + _DEF_TITLE + r")? *$")
_REF_DEF_TITLE_LINE = re.compile(r"[ \t]*" + _DEF_TITLE + r" *$")
_QUOTE_PREFIX = re.compile(r"(?: {0,3}> ?)+")
#: One bracket group (one level of nesting), the unit marked's reflink / nolink rules work on.
_BRACKET = re.compile(r"!?\[((?:[^\[\]\n\\]|\\.|\[[^\[\]\n]*\])*)\]")

# ── 296-03 (294-CR-02 residual) — setext headings and HTML, MEASURED against marked 17 ───────────
# tests/fixtures/phase296/claim_ordinals_marked.json holds the measurement (marked -> DOMPurify ->
# text nodes outside code/pre/a, the CitedMarkdown pipeline).
#: A setext underline: after a paragraph line the paragraph becomes a heading, and (like an ATX
#: heading) an indented code block or a link definition may follow it with no blank line.
_SETEXT_UNDERLINE = re.compile(r"[ \t]{0,3}(?:=+|-+)[ \t]*$")
#: A thematic break (outside a paragraph): a leaf block an indented code block may follow.
_THEMATIC_BREAK = re.compile(r"[ \t]{0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$")
#: HTML marked passes through that DOMPurify then drops: comments, processing instructions,
#: declarations, CDATA. No marker inside one is ever rendered.
_HTML_DROPPED = re.compile(r"<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<![A-Za-z][^>]*>|<!\[CDATA\[[\s\S]*?\]\]>")
#: Raw HTML elements whose text the chat never upgrades (it skips code / pre / a; DOMPurify drops
#: script and style).
_HTML_SKIPPED = re.compile(r"<(pre|code|a|script|style)\b[^>]*>[\s\S]*?</\1\s*>", re.IGNORECASE)
#: Any other raw tag: rendered as an element, so its text is prose but the tag itself is not.
_HTML_TAG = re.compile(r"</?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>\n]*)?/?>")

# ── cleaning ────────────────────────────────────────────────────────────────────────────────────
_STRONG = re.compile(r"\*\*|__|~~")
_EMPHASIS = re.compile(r"(?<!\w)[*_]+(?=\w)|(?<=\w)[*_]+(?!\w)")
_TABLE_EDGE = re.compile(r"^\s*\||\|\s*$")
_LEAD_PUNCT = re.compile(r"^[\s,;:>\-–—]+")
_TRAIL_PUNCT = re.compile(r"[\s,;:]+$")
_WS = re.compile(r"\s+")
#: 296-03 (294-IN-07): the space a stripped marker leaves before punctuation ("sharply [2]." ->
#: "sharply .").
_SPACE_BEFORE_PUNCT = re.compile(r"\s+(?=[.,;:!?])")


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
    return _SPACE_BEFORE_PUNCT.sub("", _EMPHASIS.sub("", seg))


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
        # 296-03: a setext underline turns the open paragraph into ONE heading unit (never split,
        # underline excluded); a thematic break outside a paragraph is no unit at all.
        if para and _SETEXT_UNDERLINE.match(line):
            units.append((para[0], para[1]))
            para.clear()
            continue
        if not para and _THEMATIC_BREAK.match(line):
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


def _indent(line: str) -> tuple[int, int]:
    """``(columns, chars)`` of leading whitespace; a tab advances to the next multiple of 4."""
    col = 0
    for i, ch in enumerate(line):
        if ch == " ":
            col += 1
        elif ch == "\t":
            col += 4 - col % 4
        else:
            return col, i
    return col, len(line)


def _norm_label(label: str) -> str:
    """marked's label key: whitespace runs collapsed to one space, lowercased (no trim)."""
    return re.sub(r"\s+", " ", label).lower()


def _block_regions(text: str) -> tuple[list[tuple[int, int]], set[str]]:
    """Spans marked renders as ``<pre><code>`` or drops, and the link-reference labels it defines.

    294-REVIEW CR-02: ``_CODE_RE`` (shared with the marker normaliser) sees only CLOSED fences
    and inline spans. marked also renders an indented (4-column) code block and an UNCLOSED fence
    as code, and drops a link reference definition (``[1]: annual-report.pdf``) while turning
    every ``[1]`` that names it into a link. None of those markers is upgraded in the chat, so
    none may get an ordinal here.

    Line-based, like marked's block lexer: a fence may interrupt a paragraph; an indented code
    block and a definition may not (they need a blank line, the start, or a heading / fence /
    definition before them). Inside a list item, indent counts from the item's content column,
    so a 4-space line under ``- item`` is a paragraph and a 6-space one is code. A blockquote
    prefix is stripped before classifying.
    """
    lines = text.split("\n")
    starts: list[int] = []
    pos = 0
    for line in lines:
        starts.append(pos)
        pos += len(line) + 1

    regions: list[tuple[int, int]] = []
    labels: set[str] = set()
    list_col: int | None = None   # content column of the open list item, None outside a list
    prev = "blank"                # blank | para | list | heading | table | fence | code | def

    def content_of(j: int) -> tuple[str, int]:
        line = lines[j]
        q = _QUOTE_PREFIX.match(line)
        return (line[q.end():], q.end()) if q else (line, 0)

    def rel_indent(j: int) -> tuple[int | None, str]:
        """(columns past the list content column, rest of the line) or (None, rest) when the
        line is outside the open list."""
        body, _ = content_of(j)
        col, n = _indent(body)
        base = list_col or 0
        if list_col is not None and col < list_col:
            return None, body[n:]
        return col - base, body[n:]

    def try_def(j: int, rest: str) -> int | None:
        """Last line index of a definition starting at line ``j`` (``rest`` = its text), or None."""
        m = _REF_DEF.match(rest)
        end = j
        if m is None:
            if not _REF_DEF_OPEN.match(rest) or j + 1 >= len(lines):
                return None
            m2 = _REF_DEF_DEST_LINE.match(content_of(j + 1)[0])
            if m2 is None:
                return None
            label = _REF_DEF_OPEN.match(rest).group("label")
            end, has_title = j + 1, m2.group("title") is not None
        else:
            label, has_title = m.group("label"), m.group("title") is not None
        if not has_title and end + 1 < len(lines) and _REF_DEF_TITLE_LINE.match(content_of(end + 1)[0]):
            end += 1
        labels.add(_norm_label(label))
        return end

    i = 0
    while i < len(lines):
        body, _ = content_of(i)
        if not body.strip():
            prev = "blank"
            i += 1
            continue
        col, n = _indent(body)
        rest = body[n:]
        if list_col is not None and col < list_col and prev == "blank" and not _LIST_ITEM.match(body):
            list_col = None           # a blank line, then a line left of the item: the list ended
        rel = col - (list_col or 0) if (list_col is None or col >= list_col) else 0

        # indented code: 4+ columns past the content column, never interrupting a paragraph
        if rel >= 4 and prev in ("blank", "heading", "fence", "def", "code"):
            j, last = i, i
            while j < len(lines):
                b, _ = content_of(j)
                if not b.strip():
                    j += 1
                    continue
                r, _rest = rel_indent(j)
                if r is None or r < 4:
                    break
                last = j
                j += 1
            regions.append((starts[i], starts[last] + len(lines[last])))
            prev, i = "code", last + 1
            continue

        fence = _FENCE_OPEN.match(rest) if rel <= 3 else None
        if fence and not (fence.group(1)[0] == "`" and "`" in fence.group(2)):
            ch, width = fence.group(1)[0], len(fence.group(1))
            close = re.compile(r"[ \t]{0,3}" + re.escape(ch) + "{" + str(width) + r",}[ \t]*$")
            j = i + 1
            while j < len(lines):
                r, rest_j = rel_indent(j)
                if r is not None and r <= 3 and close.match(rest_j):
                    break
                j += 1
            last = min(j, len(lines) - 1)   # unclosed: the fence runs to the end, as in marked
            regions.append((starts[i], starts[last] + len(lines[last])))
            prev, i = "fence", last + 1
            continue

        item = _LIST_ITEM.match(body)
        if item and rel <= 3:
            list_col = item.end()
            end = try_def(i, body[item.end():]) if body[item.end():].strip() else None
            if end is not None:   # "- [1]: a.pdf" — marked takes it as a definition, the item empty
                regions.append((starts[i] + item.end(), starts[end] + len(lines[end])))
                prev, i = "def", end + 1
                continue
            prev, i = "list", i + 1
            continue

        if rel <= 3 and prev in ("blank", "heading", "fence", "def", "code"):
            end = try_def(i, rest)
            if end is not None:
                regions.append((starts[i], starts[end] + len(lines[end])))
                prev, i = "def", end + 1
                continue

        # 296-03: a setext underline makes the paragraph above it a heading, and a thematic break
        # is a leaf block; either lets an indented code block or a definition follow directly.
        if _HEADING.match(body) or (prev == "para" and rel <= 3 and _SETEXT_UNDERLINE.match(body)):
            prev = "heading"
        elif _THEMATIC_BREAK.match(body):
            prev = "heading"
        elif _TABLE_ROW.match(body):
            prev = "table"
        else:
            prev = "para"
        i += 1
    return regions, labels


def _reference_links(masked: str, labels: set[str], inline: list[tuple[int, int]]) -> list[tuple[int, int]]:
    """Spans marked renders as reference links (``<a>``), given the defined ``labels``.

    marked, left to right: ``[text][ref]`` (no space between) is a full reference — a link when
    ``ref`` is defined; when it is not, the ``[`` is literal and scanning resumes one character
    on, so ``[text]`` is NOT then tried as a shortcut. Otherwise ``[ref]`` / ``[ref][]`` is a
    shortcut link when ``ref`` is defined. An inline link ``[text](url)`` wins over both.
    """
    if not labels:
        return []
    out: list[tuple[int, int]] = []
    pos = 0
    while True:
        m = _BRACKET.search(masked, pos)
        if m is None:
            return out
        inside = next((b for a, b in inline if a <= m.start() < b), None)
        if inside is not None:
            pos = inside
            continue
        nxt = _BRACKET.match(masked, m.end())
        if nxt is not None and nxt.group(1).strip():
            if _norm_label(nxt.group(1)) in labels:
                out.append((m.start(), nxt.end()))
                pos = nxt.end()
            else:
                pos = m.start() + 1
            continue
        text = m.group(1)
        end = nxt.end() if nxt is not None and nxt.group(1) == "" else m.end()
        if text.strip() and "[" not in text and "]" not in text and _norm_label(text) in labels:
            out.append((m.start(), end))
            pos = end
        else:
            pos = m.start() + 1


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
    layout = list(text)  # only block code (and definitions) blanked: units never span code blocks
    blocks, labels = _block_regions(text)   # CR-02: indented / unclosed code, link definitions
    for a, b in blocks:
        _blank(masked, a, b)
        _blank(layout, a, b)
    for m in _CODE_RE.finditer("".join(masked)):
        _blank(masked, m.start(), m.end())
        if m.group(0).startswith(("```", "~~~")):
            _blank(layout, m.start(), m.end())
    # 296-03 (294-CR-02 residual): raw HTML, found OUTSIDE code. Dropped constructs and skipped
    # elements vanish whole; any other tag is blanked so its text stays prose but the tag never
    # reaches a sentence.
    for rx in (_HTML_DROPPED, _HTML_SKIPPED, _HTML_TAG):
        for m in list(rx.finditer("".join(masked))):
            _blank(masked, m.start(), m.end())
            _blank(layout, m.start(), m.end())
    masked_s = "".join(masked)
    layout_s = "".join(layout)

    links = [(m.start(), m.end()) for m in _LINK.finditer(masked_s)]
    links += _reference_links(masked_s, labels, links)

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
