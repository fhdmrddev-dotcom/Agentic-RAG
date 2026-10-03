"""Phase 273 (SC#2 / RESEARCH OQ1 (RESOLVED) / OV-273-04 / Pitfall 2) — the STRUCTURED-path delta gate.

⛔ THE DEFECT. On the STRUCTURED calling path (a model without native tool calling — every
OpenRouter registry row is ``native_tools: False``) the model writes its tool call as TEXT: a
```` ```json ```` fence or an inline ``{"tool": …}`` object. ``agent_loop`` emitted every chunk of
that text as a ``delta``; the parse at stream end then cleared ``full_content`` BEFORE the
``turn_boundary`` check, so no fold fired and the call — for ``show_artifact``, up to 500 rows of
spec — stayed in the message body until a reload. ``delta`` is append-only; nothing could take it
back.

THE GATE. This class decides what may be EMITTED; it never changes what is ACCUMULATED.
``full_content`` still receives every chunk, so ``parse_structured_tool_calls`` sees exactly the
text it saw before this phase.

* It holds only the two openers ``tool_parser`` can parse — a ```` ```json ```` fence and an inline
  ``{"tool":`` — so an ordinary ```` ```python ```` block, or a brace in prose, keeps streaming.
* Text before the first opener streams. From the first complete opener onward everything is held
  until the stream ends (a parsed call can only start at an opener; holding the tail is what
  keeps a 500-row spec off the screen).
* A suffix that could still BECOME an opener (``"``"``, ``"```js"``, ``"{"``, ``'{ "to'``) is held
  until the next chunk disambiguates it — the 1-char-split case.
* ``finish(True)`` (the text parsed as a tool call) drops the held block; ``finish(False)`` returns
  it so the answer completes byte-for-byte.

Pure: no I/O, no logging. One instance per provider call.
"""
from __future__ import annotations

import re

_FENCE_OPENER = "```json"
_INLINE_OPENER = re.compile(r'\{\s*"tool"\s*:')
_INLINE_KEY = '"tool"'
# How far back from the end a partial opener is looked for. The fence is 7 chars; the inline form is
# `{` + whitespace + `"tool"` + whitespace — a model does not pad that with dozens of blanks.
_PARTIAL_WINDOW = 64


def _could_become_inline(s: str) -> bool:
    if not s.startswith("{"):
        return False
    rest = s[1:].lstrip()
    if not rest:
        return True
    if len(rest) < len(_INLINE_KEY):
        return _INLINE_KEY.startswith(rest)
    if not rest.startswith(_INLINE_KEY):
        return False
    return rest[len(_INLINE_KEY):].strip() == ""


def _could_become_opener(s: str) -> bool:
    return (len(s) < len(_FENCE_OPENER) and _FENCE_OPENER.startswith(s)) or _could_become_inline(s)


def _first_opener(buf: str) -> int | None:
    hits = [i for i in (buf.find(_FENCE_OPENER),) if i >= 0]
    m = _INLINE_OPENER.search(buf)
    if m:
        hits.append(m.start())
    return min(hits) if hits else None


def _partial_tail_start(buf: str) -> int:
    for p in range(max(0, len(buf) - _PARTIAL_WINDOW), len(buf)):
        if _could_become_opener(buf[p:]):
            return p
    return len(buf)


class StructuredTextHoldback:
    """Gate the ``delta`` emit for one STRUCTURED provider call."""

    def __init__(self) -> None:
        self._pending = ""
        self._holding = False
        self.released_text = False  # any non-whitespace text was released by feed()

    def feed(self, chunk: str) -> str:
        """Return the part of ``chunk`` (plus anything previously pending) safe to emit now."""
        if not chunk:
            return ""
        if self._holding:
            self._pending += chunk
            return ""
        buf = self._pending + chunk
        at = _first_opener(buf)
        if at is not None:
            self._holding = True
        else:
            at = _partial_tail_start(buf)
        out, self._pending = buf[:at], buf[at:]
        if out.strip():
            self.released_text = True
        return out

    def finish(self, parsed_calls: bool) -> str:
        """End of stream: "" when the held text parsed as a tool call, else the held text."""
        held, self._pending, self._holding = self._pending, "", False
        return "" if parsed_calls else held
