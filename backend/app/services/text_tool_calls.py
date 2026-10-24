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
* ``detect_markup`` / ``strip_markup`` know the six measured families (F1-F6) and never look inside
  fenced code or inline code (Pitfall 6): an answer that EXPLAINS a tool-call format is content.
  A clean answer comes back as the same object, byte-identical (D-10).
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
    "MARKUP_OPENERS",
    "DsmlResult",
    "Settled",
    "TagHoldback",
    "detect_markup",
    "parse_dsml",
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

# ── The measured markup families (D-06). ONE data tuple of (family, opener, closer) ───────────────
# ``opener`` is a regex; ``closer`` is a regex or None. Vendor forms with ZERO measured hits
# (``<function_calls>``, ``<minimax:tool_call>``, ``[TOOL_CALLS]``, ``<|python_tag|>``) are NOT here.
MARKUP_OPENERS: tuple[tuple[str, re.Pattern[str], re.Pattern[str]], ...] = (
    # F1 / F2 / F3 — DeepSeek DSML, every measured spelling (prod msg 4226d237; local 3d043068,
    # aeddd9f8 / 5bf39685 / dcf1b29e).
    ("dsml", DSML_OPENER_RE, _DSML_CLOSER_RE),
    # F4 (Qwen XML, local x6) and F5 (GLM XML, local x4) — self-hosted only.
    ("xml_tool_call", re.compile(r"<tool_call>"), re.compile(r"</tool_call>")),
    # F6 — Gemma-style, non-JSON args (local x3).
    ("gemma_tool_call", re.compile(r"<\|tool_call>"), re.compile(r"<tool_call\|>")),
    # F4's inner form, seen bare: `<function=NAME>…</function>`.
    ("xml_function", re.compile(r"<function="), re.compile(r"</function>")),
)

# Literal openers the holdback can prefix-match while text is still arriving (the DSML opener is a
# pattern and gets its own prefix test, ``_could_become_dsml``).
_LITERAL_OPENERS = ("<tool_call>", "<|tool_call>", "<function=")

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


def _first_markup(text: str) -> tuple[int, re.Pattern[str]] | None:
    """(index, closer) of the first opener OUTSIDE code, else None."""
    if "<" not in text:
        return None
    ranges: list[tuple[int, int]] | None = None
    best: tuple[int, re.Pattern[str]] | None = None
    for _family, opener, closer in MARKUP_OPENERS:
        for m in opener.finditer(text):
            if best is not None and m.start() >= best[0]:
                break
            if ranges is None:
                ranges = _code_ranges(text)
            if any(a <= m.start() < b for a, b in ranges):
                continue
            best = (m.start(), closer)
            break
    return best


def detect_markup(text: str) -> int | None:
    """Index of the first tool-call opener outside fenced / inline code, else None."""
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
        start, closer = hit
        c = closer.search(out, start + 1)
        end = len(out) if c is None else c.end()
        out = out[:start] + out[end:]


# ── DSML parser ──────────────────────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class DsmlResult:
    ok: bool
    calls: list[dict] = field(default_factory=list)
    preamble: str = ""
    found: bool = False


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
    return DsmlResult(ok=True, calls=calls, preamble=preamble, found=True)


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


def _first_complete_opener(buf: str) -> int | None:
    hits = [i for i in (buf.find(o) for o in _LITERAL_OPENERS) if i >= 0]
    m = DSML_OPENER_RE.search(buf)
    if m:
        hits.append(m.start())
    return min(hits) if hits else None


def _partial_tail_start(buf: str) -> int:
    for p in range(max(0, len(buf) - _PARTIAL_WINDOW), len(buf)):
        if buf[p] == "<" and _could_become_opener(buf[p:]):
            return p
    return len(buf)


class TagHoldback:
    """Gate the live ``delta`` emit for one provider call, on EVERY calling path.

    ``feed`` returns what may be emitted now; ``released`` is the concatenation of everything it
    returned. From a complete opener everything is held until ``finish`` (the Phase 273 sticky
    rule). The holdback does not skip code: it only delays, and ``finish`` hands back the held text
    byte-for-byte for the caller to settle.
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
        buf = self._pending
        at = _first_complete_opener(buf)
        if at is not None:
            self._holding = True
        else:
            at = _partial_tail_start(buf)
        out, self._pending = buf[:at], buf[at:]
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
    * ``parsed`` — the first markup is a DSML block that parsed exactly: queue its calls.
    * ``unparseable`` — markup that could not be parsed exactly (D-07): remove it, queue nothing.

    ``markup_*`` describe the removed text for ONE bounded log line (D-08); the caller logs.
    """
    idx = detect_markup(full_content)
    if idx is None:
        return Settled(kind="none", calls=[], visible=full_content)
    markup = full_content[idx:]
    meta = {
        "markup_len": len(markup),
        "markup_sha256": hashlib.sha256(markup.encode("utf-8")).hexdigest(),
        "markup_preview": markup[:_PREVIEW_MAX],
    }
    if buffer_has_calls:
        return Settled(kind="stripped", calls=[], visible=strip_markup(full_content), **meta)
    parsed = parse_dsml(full_content, offered)
    if parsed.found and parsed.ok and len(parsed.preamble) == idx:
        return Settled(kind="parsed", calls=parsed.calls, visible=parsed.preamble, **meta)
    return Settled(kind="unparseable", calls=[], visible=strip_markup(full_content), **meta)


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
