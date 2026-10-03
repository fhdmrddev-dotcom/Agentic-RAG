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

⛔ 273-REVIEW CR-02 — ``finish(False)`` alone could not tell "held text that is an answer" from
"held text that is a tool call which FAILED to parse" (a ``show_artifact`` spec cut off at the
output-token limit, a missing comma). Flushing the second kind put up to 500 rows of spec into the
answer — SC#2's leak, invisible to the model. ``failed_tool_call`` names that case so the loop
drops it (``drop_held``) and says one plain sentence (``FAILED_CALL_NOTICE``) instead.

Pure: no I/O, no logging. One instance per provider call.
"""
from __future__ import annotations

import re

_FENCE_OPENER = "```json"
_INLINE_OPENER = re.compile(r'\{\s*"tool"\s*:')
_INLINE_KEY = '"tool"'

# A `"tool": "<name>` key. ``closed`` is absent when the text was cut off inside the name.
_CALL_NAME = re.compile(r'"tool"\s*:\s*"(?P<name>[A-Za-z_][\w.-]*)(?P<closed>")?')
# The key with no name yet: `{"tool": ` / `{"tool": "` at the very end of the text.
_CALL_KEY_AT_END = re.compile(r'"tool"\s*:\s*"?\s*$')

#: The one sentence a person sees where a failed tool-call block would have been (CR-02).
FAILED_CALL_NOTICE = "*The agent's tool request was cut off or malformed, so it was not run.*"


def failed_tool_call(held: str, known_tools: set[str] | None = None) -> bool:
    """True when UNPARSED held text is a tool call that failed to parse, not an answer.

    Called only after ``parse_structured_tool_calls`` found no call, so any held block naming a known
    tool (or cut off while naming one) is a call that was truncated or malformed. An ordinary JSON
    answer has no ``"tool"`` key naming one of our tools and stays a flush (byte-identical).
    """
    if not held:
        return False
    if known_tools is None:
        from app.services.tool_parser import _get_known_tools  # lazy: tool_parser → openai_service

        known_tools = _get_known_tools()
    if _CALL_KEY_AT_END.search(held):
        return True
    for m in _CALL_NAME.finditer(held):
        name = m.group("name")
        if m.group("closed"):
            if name in known_tools:
                return True
        elif m.end() == len(held) and any(t.startswith(name) for t in known_tools):
            return True
    return False


def drop_held(full_content: str, held: str) -> str:
    """``full_content`` without the held block (which was never emitted), so what persists is what
    the person saw. The block is normally the suffix; ``rfind`` covers text appended after it."""
    if not held:
        return full_content
    if full_content.endswith(held):
        return full_content[: len(full_content) - len(held)]
    at = full_content.rfind(held)
    return full_content if at < 0 else full_content[:at] + full_content[at + len(held):]
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
