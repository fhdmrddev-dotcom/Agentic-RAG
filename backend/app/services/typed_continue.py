"""Phase 292.1 (BUG-261024-03, D-12 / D-13) — is this message a typed Continue?

After a tool-limit pause a person types "continue" as often as they press the button. The send
door (``threads.send_message`` → ``_typed_continue_or_none``) resumes the paused run when the
text is one of a SHORT FIXED LIST of words, matched exactly after normalisation. No model call
decides intent: a sentence that merely contains a word ("please continue", "continue with the
chart") is a new request, and so is anything else.

Normalisation: casefold, collapse runs of whitespace to one space, trim, then strip trailing
``.``, ``!``, ``?`` and ``…`` (repeatedly). Nothing else.

⚠ The frontend mirror (``frontend/src/lib/continueWords.ts``) is a RENDERING HINT only — the
server decides. The two lists are held in lockstep by
``frontend/src/lib/__tests__/continueWords.lockstep.test.ts``, which parses the set literal
below and replays ``backend/tests/unit/fixtures/continue_words_cases.json``.
"""
from __future__ import annotations

import re

CONTINUE_WORDS: frozenset[str] = frozenset({"continue", "keep going", "go on", "carry on", "resume", "proceed"})

_WHITESPACE = re.compile(r"\s+")
_TRAILING_PUNCTUATION = ".!?…"


def is_continue_word(text: str) -> bool:
    """True when ``text`` is exactly one of ``CONTINUE_WORDS`` after normalisation (D-13)."""
    if not isinstance(text, str):
        return False
    normalised = _WHITESPACE.sub(" ", text.casefold()).strip()
    normalised = normalised.rstrip(_TRAILING_PUNCTUATION).strip()
    return normalised in CONTINUE_WORDS
