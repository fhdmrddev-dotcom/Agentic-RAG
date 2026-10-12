"""Phase 275-03 (D-20 / D-22) — period arithmetic for the retention clock.

``add_period`` is the ONE place a retention period is added to a date. Calendar months clamp to
the month's last day (31 Jan + 1 month = 28 Feb), a leap day plus one year lands on 28 Feb, and an
unknown unit is an error rather than a guess (fail closed: a rule that cannot be read must never
produce a due date).
"""
from __future__ import annotations

from datetime import date

import pytest

from app.services.retention.periods import add_period


def test_one_month_after_the_last_day_of_january_clamps_to_february_28():
    assert add_period(date(2026, 1, 31), 1, "months") == date(2026, 2, 28)


def test_one_month_in_a_leap_year_clamps_to_february_29():
    assert add_period(date(2024, 1, 31), 1, "months") == date(2024, 2, 29)


def test_a_leap_day_plus_one_year_is_february_28():
    assert add_period(date(2024, 2, 29), 1, "years") == date(2025, 2, 28)


def test_a_leap_day_plus_four_years_is_a_leap_day():
    assert add_period(date(2024, 2, 29), 4, "years") == date(2028, 2, 29)


def test_days_are_plain_calendar_days():
    assert add_period(date(2026, 10, 12), 1, "days") == date(2026, 10, 13)
    assert add_period(date(2026, 12, 31), 2, "days") == date(2027, 1, 2)


def test_months_roll_the_year():
    assert add_period(date(2026, 11, 15), 3, "months") == date(2027, 2, 15)


def test_years_keep_the_day():
    assert add_period(date(2016, 5, 3), 7, "years") == date(2023, 5, 3)


@pytest.mark.parametrize("unit", ["weeks", "", "Years", None])
def test_an_unknown_unit_is_an_error_never_a_guess(unit):
    with pytest.raises(ValueError):
        add_period(date(2026, 1, 1), 1, unit)  # type: ignore[arg-type]


@pytest.mark.parametrize("value", [0, -1, True, 1.5])
def test_a_non_positive_or_non_integer_value_is_an_error(value):
    with pytest.raises(ValueError):
        add_period(date(2026, 1, 1), value, "days")  # type: ignore[arg-type]


def test_the_module_does_no_io():
    import inspect

    from app.services.retention import periods

    src = inspect.getsource(periods)
    for forbidden in ("app.db", "app.api", "asyncpg", "supabase", "app.dependencies", "httpx", "open("):
        assert forbidden not in src, f"periods must not reach {forbidden}"
