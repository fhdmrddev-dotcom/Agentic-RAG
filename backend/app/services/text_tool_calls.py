"""Phase 292.1 (BUG-261024-03) — tool calls a model writes as TEXT, for every provider.

⛔ THE DEFECT. At the round cap the request carries no tools, and a DeepSeek model answered with its
next call written as DSML text (``<｜DSML｜ calls>…``). Three causes stacked:

* D-01 — the only markup strip lived in the OpenAI-compat adapter, gated on ONE provider's name;
  the failing run was routed through a different provider (an aggregator), so it never ran.
* D-02 — its opener literal was ``<｜｜DSML｜｜`` (two bars); production writes ``<｜DSML｜ calls>``
  (one bar, then a space), so native DeepSeek v4.1 leaked too.
* D-04 — the cap check read only the structured ``tool_calls_buffer``, so a text call was never
  "work still pending": the markup became the answer and no Continue was offered.

No DSML *parser* existed (D-03). This module is it, plus the provider-blind detector, the live
holdback and the round-cap resolver. ``agent_loop`` only calls in (G-5, D-20).

THE RULES.

* ``parse_dsml`` reads the MEASURED DSML set (292.1-RESEARCH.md §"Measured format set"): one or two
  fullwidth bars, an optional space, any block name ending in ``calls``. Tolerant on the opener,
  STRICT on the body: a truncated block, a name outside the run's OFFERED tools, or a
  ``string="false"`` value that is not JSON refuses the WHOLE block (D-07). Nothing is repaired.
* ``detect_markup`` / ``strip_markup`` know the seven measured families (F1-F7) and never look inside
  fenced code or inline code (Pitfall 6): an answer that EXPLAINS a tool-call format is content.
  A clean answer comes back as the same object, byte-identical (D-10).
* ``parse_harmony`` reads F7 — the harmony response format's recipient, written as text with its
  special tokens decoded away (``to=functions.NAME code\\n{...}``). Same rules as DSML: tolerant on
  the content-type tokens between name and arguments, STRICT on the call: every recipient must be
  ``to=functions.<offered name>`` followed by ONE JSON object, or the whole block is refused.
* ``TagHoldback`` decides what may be EMITTED live; it never changes what is accumulated. It holds
  from a tag opener to the end of the provider call, and holds a suffix that could still become one
  (the 1-char split). It only delays: ``finish`` returns the held text byte-for-byte (D-11, I-2).
* ``settle`` is the ONE post-drain classification: ``parsed`` / ``unparseable`` / ``stripped`` /
  ``none``. With structured calls already in the buffer it only strips — never a double dispatch.
* ``resolve_round_cap`` reads the two operator knobs once per run (D-17 / D-18): 15 general, 8
  explorer, clamped to 2..50 (a cap of 1 would make round 1 the forced-final round, so no tool
  could ever run).

No provider name appears anywhere in this module, by design: gating on one is the bug.

Pure: no I/O, no logging. One TagHoldback per provider call.
"""
from __future__ import annotations

import hashlib
import json
import re
import uuid
from dataclasses import dataclass, field
from typing import Literal

# One copy home for the worded failure (Phase 273 CR-02) — imported, never redefined.
from app.services.structured_text_holdback import (  # noqa: F401  (re-exported for the loop)
    FAILED_CALL_NOTICE,
    drop_held,
    replace_failed_call,
)

__all__ = [
    "DSML_OPENER_RE",
    "HARMONY_OPENER_RE",
    "MARKUP_OPENERS",
    "DsmlResult",
    "Settled",
    "TagHoldback",
    "cap_round_unanswered",
    "detect_markup",
    "parse_dsml",
    "parse_harmony",
    "resolve_round_cap",
    "settle",
    "strip_markup",
    "ROUND_CAP_DEFAULTS",
    "ROUND_CAP_MIN",
    "ROUND_CAP_MAX",
    "FAILED_CALL_NOTICE",
    "replace_failed_call",
    "drop_held",
]

# ── DSML grammar (vLLM deepseekv32 tool parser shapes, widened on the bar count only) ─────────────
# Fullwidth bar U+FF5C ONLY — ASCII `|DSML|` is not in the measured set and must never match.
_BAR = "｜{1,2}"
DSML_OPENER_RE = re.compile(rf"<{_BAR}DSML{_BAR}\s*[A-Za-z_]*calls\s*>")
_DSML_CLOSER_RE = re.compile(rf"</{_BAR}DSML{_BAR}\s*[A-Za-z_]*calls\s*>")
_INVOKE_RE = re.compile(
    rf'<{_BAR}DSML{_BAR} ?invoke\s+name="([^"]+)"\s*>(.*?)</{_BAR}DSML{_BAR} ?invoke\s*>', re.DOTALL
)
_PARAM_RE = re.compile(
    rf'<{_BAR}DSML{_BAR} ?parameter\s+name="([^"]+)"(?:\s+string="(true|false)")?\s*>(.*?)'
    rf"</{_BAR}DSML{_BAR} ?parameter\s*>",
    re.DOTALL,
)

# ── F7 harmony grammar (harmony response format docs/format.md §"Receiving tool calls") ─────────
#   <|start|>assistant<|channel|>commentary to=functions.NAME <|constrain|>json<|message|>{…}<|call|>
# The recipient may also sit in the role section. MEASURED (292.1 forced-pending board, 4 runs, 3/3
# + the main board): the special tokens are decoded away and the content-type slot carries garbage —
# `` to=functions.search_documents code_WORDRY <noise>\n{"query":"milestones"}``, ``  (analysis
# code)``, ``  (json) code:``, a stuttered recipient ``code to=functions.X  (json)``, ``}, `` between
# calls, and one recipient with NO namespace (``to=search_documents``). The block has no closer: it
# ends where its last JSON object ends. Blanks at the START OF THE TEXT before a recipient belong to
# the block (the decoded `` to=`` opens the whole message in every measured row); elsewhere a blank
# before ``to=`` is the preamble's, so the live holdback and this scan agree on where a block starts.
_HNAME = r"[A-Za-z_][\w\-]*"
HARMONY_OPENER_RE = re.compile(rf"(?:^[ \t]+|(?<![\w=.\-]))to=functions\.({_HNAME})")
# A later recipient in the same block: after `}` / `,` / blanks; namespace optional (refused if absent).
_HARMONY_NEXT_RE = re.compile(rf"[\s,]*to=(functions\.)?({_HNAME})")
# A recipient repeated inside the content-type slot (the stutter).
_HARMONY_INNER_RE = re.compile(rf"to=(functions\.)?({_HNAME})")
# The decoded stop token, when it survives as text.
_HARMONY_STOP_RE = re.compile(r"[ \t]*<\|(?:call|end|return)\|>")
# WR-01 call shape: the slot between name and ``{`` starts with a content-type token and is short.
_HARMONY_LEAD_RE = re.compile(r"(?:<\|\w+\|>|code|json|to=|\((?:analysis|commentary|code|json)\b)")
_HARMONY_LEADS = ("code", "json", "to=", "(analysis", "(commentary", "(code", "(json")
_HARMONY_SLOT_MAX = 96      # measured max 45 (the stutter)
_HARMONY_SLOT_TOKENS = 3    # measured max 3 (the stutter); every documented form has <= 2
_JSON = json.JSONDecoder()


def _harmony_brace(text: str, at: int) -> int | None:
    """Index of the ``{`` opening the arguments of a recipient whose name ends at ``at``; ``-1`` when
    the text proves this is prose; ``None`` when it ran out before telling (WR-01)."""
    n = len(text)
    i = at
    while i < n and text[i] not in "\n{}" and i - at <= _HARMONY_SLOT_MAX:
        i += 1
    slot = text[at:i].strip()
    if i - at > _HARMONY_SLOT_MAX or len(slot.split()) > _HARMONY_SLOT_TOKENS:
        return -1
    if slot and not _HARMONY_LEAD_RE.match(slot):
        could_lead = any(t.startswith(slot) for t in _HARMONY_LEADS) or re.fullmatch(r"<\|\w*\|?", slot)
        return None if i == n and could_lead else -1
    if i == n:
        return None
    if text[i] == "\n":
        i += 1
        while i < n and text[i] in " \t":
            i += 1
        if i == n:
            return None
    return i if text[i] == "{" else -1


def _harmony_scan(text: str, m: re.Match[str]) -> tuple[int, list[tuple[str, str]] | None]:
    """``(end, calls)`` of the harmony block whose first recipient is ``m``. ``calls`` is the
    ``(name, raw JSON arguments)`` list, or ``None`` when any recipient is not exactly
    ``to=functions.NAME`` + one JSON object (D-07). A cut-off block runs to the end of the text."""
    calls: list[tuple[str, str]] | None = []
    name, name_end, namespaced = m.group(1), m.end(), True
    while True:
        brace = _harmony_brace(text, name_end)
        if brace is None or brace < 0:
            return len(text), None
        for inner in _HARMONY_INNER_RE.finditer(text, name_end, brace):
            if inner.group(2) != name or not inner.group(1):
                calls = None  # a stutter naming another tool: whose arguments these are is unknown
        try:
            _, end = _JSON.raw_decode(text, brace)
        except ValueError:
            return len(text), None
        if calls is not None and namespaced:
            calls.append((name, text[brace:end]))
        else:
            calls = None
        stop = _HARMONY_STOP_RE.match(text, end)
        end = stop.end() if stop else end
        nxt = _HARMONY_NEXT_RE.match(text, end)
        if nxt is None:
            return end, calls
        after = _harmony_brace(text, nxt.end())
        if after is None:
            return len(text), None
        if after < 0:
            return end, calls
        name, name_end, namespaced = nxt.group(2), nxt.end(), bool(nxt.group(1))


# ── The measured markup families (D-06). ONE data tuple of (family, opener, closer) ───────────────
# ``opener`` is a regex; ``closer`` is a regex or None. Vendor forms with ZERO measured hits
# (``<function_calls>``, ``<minimax:tool_call>``, ``[TOOL_CALLS]``, ``<|python_tag|>``) are NOT here.
MARKUP_OPENERS: tuple[tuple[str, re.Pattern[str], re.Pattern[str] | None], ...] = (
    # F1 / F2 / F3 — DeepSeek DSML, every measured spelling (prod msg 4226d237; local 3d043068,
    # aeddd9f8 / 5bf39685 / dcf1b29e).
    ("dsml", DSML_OPENER_RE, _DSML_CLOSER_RE),
    # F4 (Qwen XML, local x6) and F5 (GLM XML, local x4) — self-hosted only.
    ("xml_tool_call", re.compile(r"<tool_call>"), re.compile(r"</tool_call>")),
    # F6 — Gemma-style, non-JSON args (local x3).
    ("gemma_tool_call", re.compile(r"<\|tool_call>"), re.compile(r"<tool_call\|>")),
    # F4's inner form, seen bare: `<function=NAME>…</function>`.
    ("xml_function", re.compile(r"<function="), re.compile(r"</function>")),
    # F7 — harmony recipient as text (292.1 SC#2; runs ed030690 / 2b7c16a0 / f1c46597 / 34748d7c).
    # No closer: the block ends where its last JSON object does (``_harmony_scan``).
    ("harmony", HARMONY_OPENER_RE, None),
)
_CLOSERS: dict[str, re.Pattern[str]] = {f: c for f, _o, c in MARKUP_OPENERS if c is not None}

# Literal openers the holdback can prefix-match while text is still arriving (the DSML opener is a
# pattern and gets its own prefix test, ``_could_become_dsml``), each with its MARKUP_OPENERS family.
_LITERAL_FAMILY: dict[str, str] = {
    "<tool_call>": "xml_tool_call",
    "<|tool_call>": "gemma_tool_call",
    "<function=": "xml_function",
}
_LITERAL_OPENERS = tuple(_LITERAL_FAMILY)

# ── Call shape (292.1-REVIEW WR-01): a bare opener in PROSE is not a call ──────────────────────────
# "Qwen-style models wrap each call in <tool_call> tags" used to be cut at the tag (and, on the
# forced-final round, paused a run that had answered). A non-DSML opener now counts only when what
# follows it has the family's measured call shape:
#   * xml_tool_call  — ``{`` (JSON body), ``<function=`` (F4), or ``NAME`` then ``<arg_key>`` /
#                      ``</tool_call>`` (F5 GLM);
#   * gemma_tool_call — ``{``, or ``[call:]NAME`` then ``{`` (F6);
#   * xml_function   — at the START OF A LINE and ``NAME>`` (the bare F4 inner form).
# DSML is unchanged: its fullwidth-bar spellings never occur in prose, so its opener alone counts.
_NAME_RE = re.compile(r"[A-Za-z_][\w.\-]*")
_GLM_AFTER_NAME = ("<arg_key>", "</tool_call>")


def _is_line_start(prefix: str) -> bool:
    """True when the text before an opener is empty or ends a line (trailing spaces/tabs allowed)."""
    p = prefix.rstrip(" \t")
    return p == "" or p.endswith("\n")


def _call_shape(family: str, rest: str, *, line_start: bool) -> bool | None:
    """Does the text after an opener make it a CALL? ``True`` a call, ``False`` proof of prose,
    ``None`` undecided — the text ran out before the shape could be told (a later chunk decides;
    at the end of a whole text an undecided block counts only when it starts a line)."""
    if family == "dsml":
        return True
    if family == "harmony":  # F7: a content-type slot, then `{` (``_harmony_brace``)
        brace = _harmony_brace(rest, 0)
        return None if brace is None else brace >= 0
    if family == "xml_function":
        if not line_start:
            return False
        m = _NAME_RE.match(rest)
        if m is None:
            return None if rest == "" else False
        tail = rest[m.end():]
        return None if tail == "" else tail[0] == ">"
    body = rest.lstrip()
    if body == "":
        return None
    if body[0] == "{":
        return True
    if family == "xml_tool_call":
        if body.startswith("<function="):
            return True
        if "<function=".startswith(body):
            return None
        m = _NAME_RE.match(body)
        if m is None:
            return False
        after = body[m.end():].lstrip()
        if after == "":
            return None
        if after.startswith(_GLM_AFTER_NAME):
            return True
        return None if any(o.startswith(after) for o in _GLM_AFTER_NAME) else False
    # gemma_tool_call
    if len(body) < len("call:") and "call:".startswith(body):
        return None
    if body.startswith("call:"):
        body = body[len("call:"):]
    m = _NAME_RE.match(body)
    if m is None:
        return None if body == "" else False
    after = body[m.end():].lstrip()
    if after == "":
        return None
    return after[0] == "{"

# ── Code spans: an opener inside fenced code or inline code is content, not a call (Pitfall 6) ─────
_FENCE_LINE = re.compile(r"(?m)^[ \t]*(`{3,}|~{3,})")
_INLINE_CODE = re.compile(r"(`+)(?:(?!\1).)+?\1")


def _code_ranges(text: str) -> list[tuple[int, int]]:
    ranges: list[tuple[int, int]] = []
    pos = 0
    while True:
        m = _FENCE_LINE.search(text, pos)
        if m is None:
            break
        marker = m.group(1)
        close_re = re.compile(rf"(?m)^[ \t]*{re.escape(marker[0])}{{{len(marker)},}}[ \t]*$")
        eol = text.find("\n", m.end())
        if eol < 0:
            ranges.append((m.start(), len(text)))
            break
        c = close_re.search(text, eol + 1)
        end = len(text) if c is None else c.end()
        ranges.append((m.start(), end))
        pos = end
    # inline code, outside fences
    for im in _INLINE_CODE.finditer(text):
        if "\n" in im.group(0):
            continue
        if not any(a <= im.start() < b for a, b in ranges):
            ranges.append((im.start(), im.end()))
    return ranges


def _is_call_at(family: str, text: str, m: re.Match[str]) -> bool:
    """A whole-text verdict for one opener: its call shape, and — when the text ends before the shape
    is told (a cut-off block) — whether it starts a line (WR-01)."""
    line_start = _is_line_start(text[: m.start()])
    verdict = _call_shape(family, text[m.end():], line_start=line_start)
    return line_start if verdict is None else verdict


def _first_markup(text: str) -> tuple[int, str, re.Match[str]] | None:
    """(index, family, opener match) of the first CALL-SHAPED opener OUTSIDE code, else None."""
    if "<" not in text and "to=" not in text:
        return None
    ranges: list[tuple[int, int]] | None = None
    best: tuple[int, str, re.Match[str]] | None = None
    for family, opener, _closer in MARKUP_OPENERS:
        for m in opener.finditer(text):
            if best is not None and m.start() >= best[0]:
                break
            if ranges is None:
                ranges = _code_ranges(text)
            if any(a <= m.start() < b for a, b in ranges):
                continue
            if not _is_call_at(family, text, m):  # WR-01: prose that mentions the tag
                continue
            best = (m.start(), family, m)
            break
    return best


def _markup_end(text: str, family: str, m: re.Match[str]) -> int:
    """End of the block opened at ``m``: its closer, or the end of the text when it was cut off."""
    if family == "harmony":
        return _harmony_scan(text, m)[0]
    c = _CLOSERS[family].search(text, m.start() + 1)
    return len(text) if c is None else c.end()


def detect_markup(text: str) -> int | None:
    """Index of the first call-shaped tool-call opener outside fenced / inline code, else None."""
    hit = _first_markup(text)
    return None if hit is None else hit[0]


def strip_markup(text: str) -> str:
    """Remove every tool-call block outside code (opener to its closer, or to end of text when the
    block was cut off). Returns ``text`` itself when nothing is found, so a clean answer is
    byte-identical (D-10)."""
    out = text
    while True:
        hit = _first_markup(out)
        if hit is None:
            return out
        start, family, m = hit
        out = out[:start] + out[_markup_end(out, family, m):]


# ── DSML parser ──────────────────────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class DsmlResult:
    ok: bool
    calls: list[dict] = field(default_factory=list)
    preamble: str = ""
    found: bool = False
    #: The text AFTER the parsed block's closer (WR-06) — ``settle`` keeps it, never drops it.
    rest: str = ""


def _first_dsml_outside_code(text: str) -> re.Match[str] | None:
    ranges: list[tuple[int, int]] | None = None
    for m in DSML_OPENER_RE.finditer(text):
        if ranges is None:
            ranges = _code_ranges(text)
        if not any(a <= m.start() < b for a, b in ranges):
            return m
    return None


def parse_dsml(text: str, offered: frozenset[str] | set[str]) -> DsmlResult:
    """Parse the first DSML block in ``text`` into ``tool_calls_buffer``-shaped entries.

    Strict on the body (D-07): ANY refusal refuses the whole block — never a partial dispatch.
    ⛔ Never coerce, brace-balance or re-escape a value: that fabricates a call the model did not
    make (the MiniMax precedent, ``agent_loop._minimax_args_all_valid``).
    """
    m = _first_dsml_outside_code(text)
    if m is None:
        return DsmlResult(ok=False, calls=[], preamble=text, found=False)
    preamble = text[: m.start()]
    refused = DsmlResult(ok=False, calls=[], preamble=preamble, found=True)

    close = _DSML_CLOSER_RE.search(text, m.end())
    if close is None:  # the block was cut off
        return refused
    body = text[m.end() : close.start()]

    calls: list[dict] = []
    for inv in _INVOKE_RE.finditer(body):
        name, inner = inv.group(1), inv.group(2)
        if name not in offered:
            return refused
        args: dict = {}
        for p in _PARAM_RE.finditer(inner):
            key, is_str, value = p.group(1), p.group(2), p.group(3)
            if is_str == "false":
                try:
                    args[key] = json.loads(value)
                except (ValueError, TypeError):
                    return refused
            else:  # string="true" or no attribute: the raw text, verbatim
                args[key] = value
        if _PARAM_RE.sub("", inner).strip():  # a truncated / malformed parameter
            return refused
        calls.append({
            "id": f"call_{uuid.uuid4().hex[:24]}",
            "name": name,
            "arguments": json.dumps(args, ensure_ascii=False),
        })
    # Anything between invokes that is not an invoke (e.g. an invoke missing its closer) refuses.
    if not calls or _INVOKE_RE.sub("", body).strip():
        return refused
    return DsmlResult(ok=True, calls=calls, preamble=preamble, found=True, rest=text[close.end():])


def parse_harmony(text: str, offered: frozenset[str] | set[str]) -> DsmlResult:
    """Parse the first call-shaped F7 block outside code — the same contract as ``parse_dsml``.

    Every recipient must be ``to=functions.<offered name>`` + ONE JSON object, or the WHOLE block
    is refused (D-07): a cut-off object, a recipient with no namespace, a stutter naming another
    tool, a name the run did not offer. The arguments are the model's JSON verbatim — never
    re-serialised, never repaired.
    """
    ranges = _code_ranges(text) if "to=" in text else []
    for m in HARMONY_OPENER_RE.finditer(text):
        if any(a <= m.start() < b for a, b in ranges) or not _is_call_at("harmony", text, m):
            continue
        preamble = text[: m.start()]
        end, found = _harmony_scan(text, m)
        if found is None or not found or any(name not in offered for name, _ in found):
            return DsmlResult(ok=False, calls=[], preamble=preamble, found=True)
        calls = [{"id": f"call_{uuid.uuid4().hex[:24]}", "name": name, "arguments": args}
                 for name, args in found]
        return DsmlResult(ok=True, calls=calls, preamble=preamble, found=True, rest=text[end:])
    return DsmlResult(ok=False, calls=[], preamble=text, found=False)


# ── Live holdback ────────────────────────────────────────────────────────────────────────────────

# How far back from the end a partial opener is looked for (the Phase 273 ``_PARTIAL_WINDOW``).
_PARTIAL_WINDOW = 64


def _could_become_dsml(s: str) -> bool:
    """True when ``s`` is a strict prefix of some text ``DSML_OPENER_RE`` would match."""
    n = len(s)
    if not s.startswith("<"):
        return False
    i = 1
    bars = 0
    while i < n and s[i] == "｜" and bars < 2:
        i, bars = i + 1, bars + 1
    if i == n:
        return True
    if bars == 0:
        return False
    for ch in "DSML":
        if i == n:
            return True
        if s[i] != ch:
            return False
        i += 1
    bars = 0
    while i < n and s[i] == "｜" and bars < 2:
        i, bars = i + 1, bars + 1
    if i == n:
        return True
    if bars == 0:
        return False
    while i < n and s[i].isspace():
        i += 1
    while i < n and (s[i].isalpha() or s[i] == "_"):
        i += 1
    return s[i:].strip() == ""  # still waiting for the rest of the name and its `>`


def _could_become_opener(s: str) -> bool:
    if any(len(s) < len(o) and o.startswith(s) for o in _LITERAL_OPENERS):
        return True
    return _could_become_dsml(s)


_HARMONY_PREFIX = "to=functions."


def _could_become_harmony(buf: str, p: int, ctx: str) -> bool:
    """True when ``buf[p:]`` could still become an F7 recipient (``ctx`` as in ``TagHoldback``)."""
    s = buf[p:]
    if p == 0 and ctx == "" and s[:1] in (" ", "\t"):  # blanks at the start of the text
        return _HARMONY_PREFIX.startswith(s.lstrip(" \t"))
    before = buf[p - 1] if p else ctx[-1:]
    return s[:1] == "t" and not re.match(r"[\w=.\-]", before) and _HARMONY_PREFIX.startswith(s)


def _first_complete_opener(buf: str, ctx: str = "") -> tuple[int, int, str] | None:
    """(start, end, family) of the earliest complete opener in ``buf``, else None. ``ctx`` is ""
    at the start of the text, else a sentinel + the last released char, so the F7 lookbehind and
    its start-of-text blanks read exactly as the whole-text scan reads them."""
    best: tuple[int, int, str] | None = None
    for lit, family in _LITERAL_FAMILY.items():
        i = buf.find(lit)
        if i >= 0 and (best is None or i < best[0]):
            best = (i, i + len(lit), family)
    m = DSML_OPENER_RE.search(buf)
    if m and (best is None or m.start() < best[0]):
        best = (m.start(), m.end(), "dsml")
    h = HARMONY_OPENER_RE.search(ctx + buf, len(ctx))
    if h and (best is None or h.start() - len(ctx) < best[0]):
        best = (h.start() - len(ctx), h.end() - len(ctx), "harmony")
    return best


def _partial_tail_start(buf: str, ctx: str = "") -> int:
    for p in range(max(0, len(buf) - _PARTIAL_WINDOW), len(buf)):
        if buf[p] == "<" and _could_become_opener(buf[p:]):
            return p
        if buf[p] in "t \t" and _could_become_harmony(buf, p, ctx):
            return p
    return len(buf)


class TagHoldback:
    """Gate the live ``delta`` emit for one provider call, on EVERY calling path.

    ``feed`` returns what may be emitted now; ``released`` is the concatenation of everything it
    returned. From a complete opener with the family's CALL SHAPE everything is held until
    ``finish`` (the Phase 273 sticky rule; a DSML opener is call-shaped by itself). A non-DSML
    opener whose shape is not yet told is held without sticking, and is RELEASED the moment the
    following text proves it is prose (292.1-REVIEW WR-01) — so an answer that mentions a tag
    streams live instead of waiting for the end of the call. The holdback does not skip code: it
    only delays, and ``finish`` hands back the held text byte-for-byte for the caller to settle.
    """

    def __init__(self) -> None:
        self._pending = ""
        self._holding = False
        self.released = ""

    def feed(self, chunk: str) -> str:
        if not chunk:
            return ""
        self._pending += chunk
        if self._holding:
            return ""
        parts: list[str] = []
        while True:
            buf = self._pending
            last = next((p[-1] for p in reversed(parts) if p), self.released[-1:])
            ctx = "\x00" + last if last else ""  # F7 context: "" only at the start of the text
            hit = _first_complete_opener(buf, ctx)
            if hit is None:
                at = _partial_tail_start(buf, ctx)
                parts.append(buf[:at])
                self._pending = buf[at:]
                break
            start, end, family = hit
            before = self.released[-_PARTIAL_WINDOW:] + "".join(parts) + buf[:start]
            verdict = _call_shape(family, buf[end:], line_start=_is_line_start(before))
            if verdict is False:  # proof of prose: release through the opener, keep scanning
                parts.append(buf[:end])
                self._pending = buf[end:]
                continue
            parts.append(buf[:start])
            self._pending = buf[start:]
            self._holding = verdict is True  # undecided: hold, re-judge on the next chunk
            break
        out = "".join(parts)
        self.released += out
        return out

    def finish(self) -> str:
        """End of the provider call: the held text (possibly ""), and reset the hold."""
        held, self._pending, self._holding = self._pending, "", False
        return held


# ── Settle: the one post-drain classification ────────────────────────────────────────────────────

_PREVIEW_MAX = 200


@dataclass(frozen=True)
class Settled:
    kind: Literal["parsed", "unparseable", "stripped", "none"]
    calls: list[dict]
    visible: str
    markup_len: int = 0
    markup_sha256: str = ""
    markup_preview: str = ""


def settle(full_content: str, offered: frozenset[str] | set[str], *, buffer_has_calls: bool) -> Settled:
    """Classify one provider call's text after the stream drained.

    * ``none`` — no markup outside code: ``visible`` is ``full_content`` itself.
    * ``stripped`` — structured calls are already queued: remove the markup, parse nothing.
    * ``parsed`` — the first markup is a DSML or F7 block that parsed exactly: queue its calls.
    * ``unparseable`` — markup that could not be parsed exactly (D-07): remove it, queue nothing.

    ``markup_*`` describe the removed text for ONE bounded log line (D-08); the caller logs.

    292.1-REVIEW WR-06: the text after a parsed block is settled too, never dropped. Trailing prose
    stays visible; a further DSML block's calls are queued after the first block's, in order; a
    further block that cannot be parsed is removed and worded (``FAILED_CALL_NOTICE``) while the
    first block's calls still run — each block stands or falls whole (D-07), not the message.
    """
    hit = _first_markup(full_content)
    if hit is None:
        return Settled(kind="none", calls=[], visible=full_content)
    idx = hit[0]
    markup = full_content[idx:]
    meta = {
        "markup_len": len(markup),
        "markup_sha256": hashlib.sha256(markup.encode("utf-8")).hexdigest(),
        "markup_preview": markup[:_PREVIEW_MAX],
    }
    if buffer_has_calls:
        return Settled(kind="stripped", calls=[], visible=strip_markup(full_content), **meta)
    parser = parse_harmony if hit[1] == "harmony" else parse_dsml
    parsed = parser(full_content, offered)
    if parsed.found and parsed.ok and len(parsed.preamble) == idx:
        calls, visible = list(parsed.calls), parsed.preamble
        if parsed.rest:
            after = settle(parsed.rest, offered, buffer_has_calls=False)
            visible += after.visible
            if after.kind == "parsed":
                calls.extend(after.calls)
            elif after.kind == "unparseable":
                visible, _ = replace_failed_call(visible, "")
        return Settled(kind="parsed", calls=calls, visible=visible, **meta)
    return Settled(kind="unparseable", calls=[], visible=strip_markup(full_content), **meta)


def cap_round_unanswered(*, force_no_tools: bool, buffer_has_calls: bool, markup_seen: bool,
                         visible: str) -> bool:
    """The forced-final round at the cap queued nothing and wrote no answer (operator option A).

    Measured on the forced-pending board (2026-10-24): anthropic claude-opus-5-5 (3 of 3 runs) and
    openai gpt-5.6-luna (run 7c9a4a3f) reached the cap mid-plan and the forced-final round came back
    with no text and no call, so the run completed on the loop's fallback sentence with no Continue.
    Such a round pauses ``cap_paused`` with the empty-queue marker, exactly like D-07.

    ``visible`` is the round's text AFTER ``settle``; whitespace is not an answer. Any round before
    the cap, a cap round with calls queued (D-05) or markup seen (D-07), and a cap round that wrote
    prose are all False, so every one of them keeps its existing behaviour.
    """
    return force_no_tools and not buffer_has_calls and not markup_seen and not visible.strip()


# ── Round cap (D-17 / D-18) ──────────────────────────────────────────────────────────────────────

ROUND_CAP_DEFAULTS: dict[str, int] = {"general": 15, "explorer": 8}
ROUND_CAP_MIN = 2
ROUND_CAP_MAX = 50


def resolve_round_cap(user_settings: object, agent_mode: str | None) -> int:
    """The provider-call cap for one run, read once at loop start.

    ``explorer_max_tool_rounds`` for the explorer agent, else ``chat_max_tool_rounds``. Only a real
    ``int`` (never a ``bool``) counts; anything else — absent, ``None``, a mock — is the default.
    """
    if agent_mode == "explorer":
        mode, attr = "explorer", "explorer_max_tool_rounds"
    else:
        mode, attr = "general", "chat_max_tool_rounds"
    value = getattr(user_settings, attr, None)
    if not isinstance(value, int) or isinstance(value, bool):
        return ROUND_CAP_DEFAULTS[mode]
    return max(ROUND_CAP_MIN, min(ROUND_CAP_MAX, value))
