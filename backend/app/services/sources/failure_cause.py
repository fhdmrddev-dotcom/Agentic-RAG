"""Phase 235 plan 02 (LIB-10 · D-235-10 · D-235-11) — a source failure is a NAMED CAUSE.

⭐ **THE DEFECT THIS EXISTS TO CLOSE.** `watch_service.py:189-197` is the only failure
classification this backend has, and it is a substring sniff::

    err_str = str(list_exc).lower()
    if "403" in err_str or "permission" in err_str or "unauthorized" in err_str:

Its output is `str(exc)` written into a `text` column and rendered VERBATIM at
`WatchedFoldersSection.tsx:373` (``Last check error: {watch.last_error}``) — the exact defect
`ingestionErrorVocabulary.ts` was built to close, one directory over. LIB-10's *"offers the one
action that fixes it"* is impossible while the cause is a string: you cannot key a control off
prose. So the cause becomes a VALUE here, and the sentence and the control key off that value.

⚠ Every token the old sniff matched — ``403`` / ``permission`` / ``unauthorized`` — stays
reachable as a matcher input below, so no failure classified today becomes unclassified.

── THE THREE BINDING PROPERTIES ───────────────────────────────────────────────────────────

1. ⛔ **This module WRITES NOTHING.** No row, no audit entry, no log line that reads like a
   decision. It is asked a question and it answers. (`preview_service.py`'s own docblock rule,
   applied to the same package.)
2. ⛔ **It imports nothing from the DB or the app's service graph** — no `app.db`, no
   `supabase`, no `asyncpg`, no `app.dependencies`. `test_failure_cause.py` asserts this over
   the live source, because an import added here would make the classifier unusable from the
   one place it is most needed: a producer that has not opened a pool yet.
3. ⭐ **Hard vs soft is DATA, never an inline branch** (D-235-10). The deferred email producer
   will need this same verdict when its trigger fires, and a branch inside `watch_service`
   could not be reused by it. So it is a table, and `is_hard` has no branch of its own.

── ⚠ THE FRONTEND BINDS TO THIS FILE'S LIVE SOURCE ────────────────────────────────────────

`frontend/src/components/sources/sourceHealthVocabulary.test.ts` imports this module via
``?raw`` and extracts the cause literals with a regex, then asserts each has a sentence AND a
control. So `Cause` must stay a **plain-text `Literal` union on one line** — a computed set,
a loop, or a union assembled from constants would be invisible to that fence and a fifth cause
could ship with nothing to say about it.
"""

from __future__ import annotations

import re
from typing import Literal

# ⚠ ONE LINE, PLAIN TEXT, GREPPABLE. See the ``?raw`` note in the module docblock.
Cause = Literal["token_revoked", "folder_gone", "unreachable", "unknown"]

#: ⭐ D-235-10 — **cause-dependent promotion to `stopped`.** A cause the next tick CANNOT
#: recover from is stopped on the FIRST failure. Membership here is the whole rule; there is
#: deliberately no second place that decides it.
HARD_CAUSES: frozenset[Cause] = frozenset({"token_revoked", "folder_gone"})

#: ⭐ D-235-10 — a cause that MIGHT recover needs this many consecutive failures before the
#: source is called stopped. A uniform N-failure rule for every cause was rejected: at a
#: 6-hour cadence it keeps a definitively-dead token silent for 18 hours, and "we knew at
#: 09:00 and told you at 03:00" is the silence LIB-10 exists to end.
SOFT_FAILURE_THRESHOLD: int = 3

#: The status codes we are willing to read a verdict from, consulted BEFORE the regexes when
#: a caller supplies one. ⚠ A code is a stronger signal than prose — the provider's English
#: can be reworded by a dependency upgrade, the number cannot.
#: There is deliberately no catch-all arm: an unlisted code falls through to the message, and
#: a message we do not recognise is `unknown`. Guessing from a number we have no row for would
#: be the same failure as printing the exception, one step politer.
_STATUS_CAUSE: dict[int, Cause] = {
    401: "token_revoked",
    403: "token_revoked",
    404: "folder_gone",
    408: "unreachable",
    429: "unreachable",
    500: "unreachable",
    502: "unreachable",
    503: "unreachable",
    504: "unreachable",
}

#: ⭐ Ordered — FIRST MATCH WINS — mirroring `ingestionErrorVocabulary.ts:99-112`. Each matcher
#: is deliberately BROAD ON THE FACT and NARROW ON THE WORDING: a provider's prose is not ours
#: and can change under us, so every cause is reachable by more than one tell.
#:
#: ⚠ Order matters between the first two. "not found" appears inside some authorisation
#: messages ("the caller does not have permission ... file not found"), so authorisation is
#: asked first: a revoked token is the more consequential verdict and the one whose control
#: (Reconnect) cannot be reached from the other arm.
_MATCHERS: tuple[tuple[Cause, re.Pattern[str]], ...] = (
    (
        "token_revoked",
        re.compile(
            r"invalid_grant"
            r"|token (?:has been )?(?:expired|revoked)"
            r"|(?:expired|revoked) (?:credentials|token)"
            r"|unauthoriz|unauthoris"
            r"|\b401\b"
            r"|\b403\b"
            r"|permission"
            r"|insufficient (?:authentication )?scopes"
            r"|access denied"
            r"|forbidden",
            re.IGNORECASE,
        ),
    ),
    (
        "folder_gone",
        re.compile(
            r"not ?found"
            r"|no longer shared"
            r"|unshared"
            r"|\b404\b"
            r"|file ?not ?found"
            r"|does not exist"
            r"|has been (?:deleted|removed|trashed)",
            re.IGNORECASE,
        ),
    ),
    (
        "unreachable",
        re.compile(
            r"tim(?:ed|e) ?out"
            r"|timeout"
            r"|connection (?:reset|refused|aborted|error)"
            r"|\b429\b"
            r"|rate ?limit"
            r"|quota exceeded"
            r"|\b5\d\d\b"
            r"|temporarily unavailable"
            r"|service unavailable"
            r"|backend ?error"
            r"|try again later",
            re.IGNORECASE,
        ),
    ),
)


def classify_failure_cause(message: str | None, *, status_code: int | None = None) -> Cause:
    """Name the cause of a source failure, or say honestly that we do not know.

    Resolution order, and it matters:

      1. a status code we have a row for → its cause (the number outlives the prose)
      2. the first matcher whose pattern hits the message → its cause
      3. anything else → ``"unknown"``

    ⚠ Step 3 NEVER guesses. `None`, an empty or whitespace-only string, and a message no
    matcher recognises all resolve to ``"unknown"``, whose sentence on the frontend is the
    shipped honest fallback. A confident cause we cannot prove is worse than admitting it.
    """
    if status_code is not None:
        mapped = _STATUS_CAUSE.get(status_code)
        if mapped is not None:
            return mapped

    if not message or not message.strip():
        return "unknown"

    for cause, pattern in _MATCHERS:
        if pattern.search(message):
            return cause

    return "unknown"


def is_hard(cause: Cause) -> bool:
    """Does this cause stop the source on the FIRST failure?

    ⚠ No branch of its own by design — it reads `HARD_CAUSES` and nothing else, so the rule
    lives in exactly one place and a new cause is a table edit rather than a code edit.
    """
    return cause in HARD_CAUSES
