"""Phase 235 plan 06 (LIB-10 · D-235-05 / D-235-10) — is this source STOPPED, in one place.

⭐ **THE DEBOUNCE RULE LIVES HERE AND NOWHERE ELSE (D-235-05).** The rail badge, the Library
Health row and the source card all read the verdict this module computes, served by ONE
endpoint. A client that re-derives "which sources are stopped" from run rows has created a
second verdict that can disagree with the first, and the person who finds the disagreement is
a user. So the threshold is applied once, on the server, and the surfaces render what they are
told.

── THE THREE DECISIONS IN FORCE ────────────────────────────────────────────────────────────

1. ⭐ **DERIVED, NEVER COUNTED (RESEARCH §13.2).** The consecutive-failure count is read off
   the stored run history, not off a `consecutive_failures` column. A counter would have to be
   incremented and reset by all FOUR release arms the watch loop has today, and a fifth arm
   added later would drift from the history the user is looking at — undetectably, because
   both would render. Deriving it is correct BY CONSTRUCTION: every tick writes a row
   (D-235-07), so the sequence IS the truth. This is the "two paths serving one outcome"
   shape this codebase has been bitten by five measured times.

2. ⭐ **HARD vs SOFT IS DATA ON THE CAUSE (D-235-10), imported and never re-declared.** A cause
   the next tick CANNOT recover from — a revoked token, a folder that is gone — stops the
   source on failure ONE. A cause that MIGHT recover needs `SOFT_FAILURE_THRESHOLD`
   consecutive failures. A uniform N-failure rule for every cause was rejected explicitly: at
   a 6-hour cadence it keeps a definitively-dead token silent for 18 hours.
   ⛔ The threshold is `failure_cause.SOFT_FAILURE_THRESHOLD`. There is deliberately no second
   number in this file — a literal here would be the same "two places, one rule" defect one
   level down.

3. ⭐ **ZERO ROWS IS A DIFFERENT SENTENCE FROM ZERO FAILURES.** A watch created and never
   ticked has no history to derive from. That is `never_read` — *"It has not read successfully
   yet"* — and it is emphatically not `stopped`. Calling a brand-new watch broken is the
   overclaim this whole phase exists to stop making.

── WHAT THIS MODULE MAY NOT DO ─────────────────────────────────────────────────────────────

⛔ It performs NO I/O and reaches no data-access or routing layer. It is handed rows and it
answers. `test_source_health_verdict.py` asserts that over this file's LIVE SOURCE, not over
its import list, because the property that matters is that the verdict stays usable from a
producer which has not opened a connection — the deferred email notifier being the next such
caller.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from app.services.sources.failure_cause import (
    Cause,
    SOFT_FAILURE_THRESHOLD,
    is_hard,
)

#: The one status that ENDS a failure streak. Everything else — `failed`, `paused`, and any
#: status a future release arm invents — counts toward it. ⚠ The polarity is deliberate: an
#: unrecognised status must count as "did not read", never as "read fine". A deny-list here
#: would let a new status silently reset the streak and re-hide a dead source.
SUCCESS_STATUS = "success"

#: The cause a non-success row resolves to when it carries none. ⚠ It is SOFT — a failure we
#: could not name is not a licence to escalate on the first tick. `failure_cause.py` already
#: refuses to guess; this refuses to act on a guess.
UNNAMED_CAUSE: Cause = "unknown"


@dataclass(frozen=True)
class Verdict:
    """What the server is willing to say about one source, from its stored history."""

    #: The debounce rule has fired: hard cause on failure 1, or `SOFT_FAILURE_THRESHOLD`
    #: consecutive non-successes. This is the ONLY field a surface may use to decide whether
    #: to show the attention signal.
    stopped: bool
    #: The named cause of the CURRENT failure streak, or `None` when the newest tick read
    #: fine (or there are no ticks at all).
    cause: Cause | None
    #: Whether `cause` is one the next tick cannot recover from.
    hard: bool
    #: `started_at` of the OLDEST tick in the current failure streak. ⚠ Not the newest — a
    #: source that has been dead a week must not read as having stopped a minute ago.
    stopped_since: datetime | None
    #: `started_at` of the newest successful tick, or `None` if it has never had one.
    last_good_at: datetime | None
    #: No stored ticks at all. Not broken — not yet observed.
    never_read: bool


def _started_at(row: dict[str, Any]) -> datetime | None:
    val = row.get("started_at")
    return val if isinstance(val, datetime) else None


def verdict_for_runs(runs: list[dict]) -> Verdict:
    """Decide whether a source has stopped, from its runs NEWEST FIRST.

    `runs` is the shape the windowed history read returns: one dict per stored tick, ordered
    `started_at DESC`. Only the LEADING non-successes count — a recovered blip resets the
    streak, because the question is *"is it broken now?"*, not *"has it ever been?"*.
    """
    if not runs:
        return Verdict(
            stopped=False,
            cause=None,
            hard=False,
            stopped_since=None,
            last_good_at=None,
            never_read=True,
        )

    last_good_at = next(
        (_started_at(r) for r in runs if r.get("status") == SUCCESS_STATUS),
        None,
    )

    streak: list[dict] = []
    for row in runs:
        if row.get("status") == SUCCESS_STATUS:
            break
        streak.append(row)

    if not streak:
        return Verdict(
            stopped=False,
            cause=None,
            hard=False,
            stopped_since=None,
            last_good_at=last_good_at,
            never_read=False,
        )

    # The cause of the CURRENT failure is the newest failing tick's, not the oldest — the
    # control the surface offers keys off what is wrong now.
    cause: Cause = streak[0].get("failure_cause") or UNNAMED_CAUSE
    hard = is_hard(cause)

    # ⛔ The whole rule, in one expression, reading the imported table and the imported
    # threshold. Hard on 1; soft only at SOFT_FAILURE_THRESHOLD — so failure 2 of a soft
    # cause is NOT stopped, which is the case SC#4 is most easily lost on.
    stopped = hard or len(streak) >= SOFT_FAILURE_THRESHOLD

    return Verdict(
        stopped=stopped,
        cause=cause,
        hard=hard,
        stopped_since=_started_at(streak[-1]),
        last_good_at=last_good_at,
        never_read=False,
    )
