"""Phase 249 Plan 03 (MODEL-08 / BUG-260909-01) — a refused write and an unreachable database
are two different answers.

── THE DEFECT, REPRODUCED AGAINST THE LIVE DATABASE BEFORE THIS FILE WAS WRITTEN ────

``save_app_settings`` caught ``Exception``, logged the column names, and returned ``False``.
All six call sites turn ``False`` into a bare HTTP 500 *"Failed to save settings"* — true, and
undiagnosable. Driven 2026-09-15 against the running local Postgres, calling the function
directly exactly as the bug report did::

    BEFORE source_max_file_size_mb = 25
      set      0 -> returned False
      set     51 -> returned False
      set    999 -> returned False
    AFTER  source_max_file_size_mb = 25

Every one of those raised ``asyncpg.exceptions.CheckViolationError`` on
``app_settings_source_max_file_size_mb_bounds`` — **the database did its job** — and the caller
could not tell that from a connection reset. Nothing was corrupted: the defect is the REPORTING.

⭐ AND A SECOND FINDING THE DRIVE SURFACED, WHICH THE BUG REPORT DOES NOT MENTION. The old arm
logged with ``exc_info=True``, and asyncpg's ``CheckViolationError`` carries a ``DETAIL:`` line
containing **the entire failing row** — every ``enc:v1:`` secret envelope and the operator's
self-hosted tunnel URL among them. ``T-081.1-04`` says these rows must never be logged. So the
refusal arm logs **without** a traceback and raises ``from None``: a 500 handler that rendered
``__cause__`` would put that row in front of a user.

── WHAT IS MOCKED AND WHAT IS NOT, STATED PLAINLY ───────────────────────────────────

The cases below drive the **branch** — which exception class produces which behaviour — through
the patched pool. That is our code and a mock is the right instrument for it. The claim *"the
database refuses this value"* is NOT taken from a mock: it was driven against the real constraint
first, and the transcript above is the evidence. A mocked violation proves an ``except`` clause
matches a class; it does not prove the database refuses what we think it refuses.
"""
import asyncpg
import pytest

import app.models.user_settings as us
from app.models.user_settings import SettingsWriteRefused, save_app_settings


# The real constraint, named once. Driven live 2026-09-15.
CONSTRAINT = "app_settings_source_max_file_size_mb_bounds"
COLUMN = "source_max_file_size_mb"
REFUSED_VALUE = 999


class _Pool:
    """asyncpg-pool stand-in whose ``execute`` raises whatever it was handed."""

    def __init__(self, exc=None):
        self.exc = exc
        self.calls = 0

    async def execute(self, sql, *args):
        self.calls += 1
        if self.exc is not None:
            raise self.exc
        return "UPDATE 1"


def _check_violation():
    """A CheckViolationError shaped like the live one — including the row-bearing DETAIL."""
    exc = asyncpg.exceptions.CheckViolationError(
        f'new row for relation "app_settings" violates check constraint "{CONSTRAINT}"'
    )
    # asyncpg populates these from the server; set them the way the live error arrives.
    exc.constraint_name = CONSTRAINT
    exc.detail = (
        "Failing row contains (global, [], text-embedding-3-small, "
        "enc:v1:gAAAAABqWy2JjZytc78fGDf4lnJfjOxZbNI54oDh, "
        "https://acquisition-wiring-dana-joining.trycloudflare.com/v1)."
    )
    return exc


@pytest.fixture(autouse=True)
def _quiet_broadcast(monkeypatch):
    """Keep the success path from touching Redis; the broadcast has its own fences."""
    async def _noop():
        return None

    monkeypatch.setattr(us, "broadcast_settings_change", _noop)


def _prime(monkeypatch, pool):
    monkeypatch.setattr("app.dependencies._pg_pool", pool)
    us._settings_cache = None
    us._settings_cache_time = 0.0


# ── the refusal arm ────────────────────────────────────────────────────────────

async def test_a_refused_value_raises_rather_than_returning_false(monkeypatch):
    """⭐ BUG-260909-01 itself. `False` cannot express "the database said no"."""
    pool = _Pool(_check_violation())
    _prime(monkeypatch, pool)

    with pytest.raises(SettingsWriteRefused):
        await save_app_settings({COLUMN: REFUSED_VALUE})


async def test_the_refusal_names_the_column_and_the_constraint(monkeypatch):
    """A caller can only answer 400 with a REASON if it is given one."""
    pool = _Pool(_check_violation())
    _prime(monkeypatch, pool)

    with pytest.raises(SettingsWriteRefused) as ei:
        await save_app_settings({COLUMN: REFUSED_VALUE})

    assert COLUMN in ei.value.columns
    assert ei.value.constraint == CONSTRAINT
    assert COLUMN in str(ei.value)
    assert CONSTRAINT in str(ei.value)


async def test_the_refusal_never_carries_the_value_or_the_row(monkeypatch, caplog):
    """⛔ THE LOAD-BEARING CASE. These rows hold API keys (T-081.1-04).

    Three surfaces are checked, because the value can escape by any of them: the exception's
    message, its chained cause, and the log record. The live DETAIL line carries the WHOLE row —
    encrypted secret envelopes and the operator's tunnel URL included.
    """
    pool = _Pool(_check_violation())
    _prime(monkeypatch, pool)

    with caplog.at_level("ERROR"):
        with pytest.raises(SettingsWriteRefused) as ei:
            await save_app_settings({COLUMN: REFUSED_VALUE})

    blob = (
        str(ei.value)
        + repr(getattr(ei.value, "__cause__", None))
        # ⛔ WR-01: `__context__` too. `from None` clears `__cause__` ONLY; implicit chaining still
        # attaches the asyncpg error, whose `DETAIL:` line carries the whole row. `traceback` and
        # `logging` honour `__suppress_context__` so nothing leaks TODAY — but the arm's own
        # comment states an absolute, and a future structured reporter that walks the chain
        # without checking that flag would re-open exactly the leak this arm exists to close.
        + repr(getattr(ei.value, "__context__", None))
        + caplog.text
    )
    assert str(REFUSED_VALUE) not in blob, "the refused VALUE must never be echoed"
    assert "enc:v1:" not in blob, "the failing row's secret envelopes must never be logged"
    assert "trycloudflare" not in blob, "the failing row's URLs must never be logged"
    # ⛔ BOTH chain slots, not just one. WR-01: `raise … from None` clears `__cause__` and leaves
    # `__context__` pointing at the asyncpg error — whose `DETAIL:` line carries the whole row.
    # The exception is now BUILT in the except arm and RAISED outside it, so neither is set.
    assert ei.value.__cause__ is None
    assert ei.value.__context__ is None, (
        "__context__ still holds the asyncpg error and its row-bearing DETAIL line — raise the "
        "exception OUTSIDE the except block, not merely `from None`"
    )


@pytest.mark.parametrize("exc_cls", [
    asyncpg.exceptions.CheckViolationError,
    asyncpg.exceptions.NotNullViolationError,
    asyncpg.exceptions.UndefinedColumnError,
    # WR-02: the SIBLINGS. They were falling into the broad arm, which logs `exc_info=True` and
    # therefore the same row-bearing DETAIL line the refusal arm exists to keep out of the log.
    asyncpg.exceptions.UniqueViolationError,
    asyncpg.exceptions.ForeignKeyViolationError,
    asyncpg.exceptions.ExclusionViolationError,
])
async def test_the_whole_refusal_family_raises(monkeypatch, exc_cls):
    """⭐ `UndefinedColumnError` is the highest-value member and the least obvious one.

    It is the *knob shipped in CODE without its migration* signature: mig 078's
    `skill_builder_model` hid for ~10 days, and `lmstudio_api_key` hid until mig 180. Naming that
    column in the response is the difference between ten days and ten seconds.
    """
    exc = exc_cls("nope")
    exc.constraint_name = None
    _prime(monkeypatch, _Pool(exc))

    with pytest.raises(SettingsWriteRefused):
        await save_app_settings({COLUMN: 1})


# ── ⛔ the arm that must NOT change ────────────────────────────────────────────

async def test_an_unreachable_database_still_returns_false(monkeypatch):
    """The broad catch exists so a pool blip cannot crash a request. It is untouched.

    Pinned so the split cannot collapse back into one arm: if this ever raises, a connection
    reset has become a caller error, which is the mirror of the bug being fixed.
    """
    _prime(monkeypatch, _Pool(ConnectionResetError("pool went away")))

    assert await save_app_settings({COLUMN: 1}) is False


async def test_a_successful_write_is_unchanged(monkeypatch):
    """The regression arm — success still returns True and still broadcasts."""
    seen = {"broadcast": False}

    async def _spy():
        seen["broadcast"] = True

    monkeypatch.setattr(us, "broadcast_settings_change", _spy)
    _prime(monkeypatch, _Pool())

    assert await save_app_settings({COLUMN: 25}) is True
    assert seen["broadcast"] is True


async def test_nothing_to_persist_is_still_a_successful_no_op(monkeypatch):
    """An empty/unknown-key payload short-circuits BEFORE the try block and must stay True."""
    _prime(monkeypatch, _Pool(_check_violation()))

    assert await save_app_settings({}) is True
