"""Phase 275 (D-20 / D-22) — the ONE place a retention period is added to a date.

Calendar arithmetic, stdlib only:

* ``days``   — plain calendar days.
* ``months`` — calendar months; the day clamps to the target month's last day
  (31 Jan + 1 month = 28 Feb, or 29 Feb in a leap year).
* ``years``  — twelve calendar months, so a leap day plus one year is 28 Feb.

FAIL CLOSED. An unknown unit or a non-positive / non-integer value raises ``ValueError``. A rule that
cannot be read must never produce a due date; the evaluator turns the error into an undecidable
decision (nothing happens).

WHAT THIS MODULE MAY NOT DO: NO I/O. It is handed a date and answers.
"""
from __future__ import annotations

import calendar
from datetime import date, timedelta
from typing import Literal

PeriodUnit = Literal["days", "months", "years"]
UNITS: tuple[str, ...] = ("days", "months", "years")


def add_period(d: date, value: int, unit: PeriodUnit) -> date:
    """``d`` plus ``value`` ``unit``s, with the calendar month-end clamp."""
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        raise ValueError(f"a retention period must be a positive whole number, got {value!r}")
    if unit == "days":
        return d + timedelta(days=value)
    if unit == "months":
        return _add_months(d, value)
    if unit == "years":
        return _add_months(d, value * 12)
    raise ValueError(f"unknown retention period unit {unit!r}")


def _add_months(d: date, months: int) -> date:
    index = d.month - 1 + months
    year = d.year + index // 12
    month = index % 12 + 1
    last = calendar.monthrange(year, month)[1]
    return date(year, month, min(d.day, last))
