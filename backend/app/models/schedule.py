"""Phase 204 (SCHED-01 / D-204-08 / D-204-10) — the workflow-schedule wire models.

The ONE home for what a schedule looks like on the wire, and — more importantly — the ONE
home for **what a valid cadence is**. Both validations that matter run here, at the request
boundary, before anything is persisted:

  * **the cron string is parsed by ``croniter``**, not pattern-matched. A cron expression is
    not a regex-shaped thing; ``0 0 31 2 *`` is well-formed and never fires, and
    ``*/15 * * * *`` and ``* * * * * *`` differ in FIELD COUNT rather than in syntax. The only
    honest validator is the library that will later be asked to compute the next fire time —
    so this module asks exactly that library, at exactly the moment a person can still be told
    they typed something wrong.
  * **the timezone is resolved by ``zoneinfo``**, for the same reason: an unrecognised zone
    stored today becomes a run that fires at the wrong hour, or not at all, weeks later with
    nobody watching.

⚠ **THE CADENCE IS EXACTLY ONE OF TWO AND THAT IS SAID IN THREE PLACES ON PURPOSE** — here (a
400 with a sentence a person can act on), in the ``schedule_cadence_exactly_one`` CHECK on the
table (the invariant a writer bypassing this API still cannot violate), and in
``scheduler_service._next_fire_at``'s branch (which would otherwise have no defined answer).
The three are not redundant: the first is a message, the second is a guarantee, the third is a
computation.

⚠ **THE READ MODEL IS AN EXPLICIT FIELD LIST, NEVER A PASSTHROUGH.** ``response_model`` DROPS
UNDECLARED KEYS SILENTLY — a green DB test beside an unchanged UI is this project's most
frequently re-learned lesson — so a column added to ``workflow_schedules`` reaches the client
only when this model, the ``.select()`` in ``db/schedules.py`` and the serializer all move in
the same commit.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from croniter import croniter
from pydantic import BaseModel, Field, field_validator, model_validator

# The interval floor is spelled here AND as `schedule_interval_floor` on the table. This
# constant is the one the API message quotes, so the two can be compared by a reader.
MIN_INTERVAL_SECONDS = 60
# A ceiling on the caps, so a typo (`max_tokens_per_run: 50000000`) is refused rather than
# quietly authorising a schedule that can spend for hours, forever, unattended.
MAX_TOKENS_CEILING = 2_000_000
MAX_DURATION_CEILING_SECONDS = 24 * 60 * 60


def validate_cron(expression: str) -> str:
    """Return ``expression`` if ``croniter`` accepts it, else raise ``ValueError``.

    The ONE cron validator in the tree. It is a plain function rather than a method so the
    scheduler service and the tests can ask the same question the API boundary asks, without
    constructing a request model to do it.
    """
    if not croniter.is_valid(expression):
        raise ValueError(
            f"{expression!r} is not a valid cron expression "
            "(five fields: minute hour day-of-month month day-of-week)"
        )
    return expression


def validate_timezone(name: str) -> str:
    """Return ``name`` if ``zoneinfo`` can resolve it, else raise ``ValueError``."""
    try:
        ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError, KeyError) as exc:
        raise ValueError(f"{name!r} is not a known IANA timezone") from exc
    return name


def compute_next_run_at(
    *,
    cron_expression: str | None,
    interval_seconds: int | None,
    timezone: str = "UTC",
    after: datetime | None = None,
) -> datetime:
    """The next fire instant, in UTC, strictly AFTER ``after`` (default: now).

    ⚠ **THE ONE HOME FOR CADENCE MATH.** ``db.schedules.claim_due_schedules`` calls it inside
    the claiming transaction and ``scheduler_service`` calls it when a schedule is created or
    re-activated. A second copy is how a schedule comes to fire at one instant according to the
    claimer and a different one according to the list the author is looking at.

    **Cron is evaluated IN THE SCHEDULE'S OWN ZONE and returned in UTC** — that round trip is
    the whole reason the ``timezone`` column exists. Evaluating ``0 8 * * 1`` in UTC on a server
    in UTC and on a laptop in CET produces two different Monday mornings; converting the anchor
    into the author's zone, asking croniter there, and converting the answer back to UTC makes
    the stored instant independent of where the process runs. **Interval schedules ignore the
    zone entirely** — a duration has no timezone, and pretending otherwise would make a
    15-minute cadence skip or repeat an hour at a DST boundary.

    Raises ``ValueError`` when neither or both cadences are supplied: this function has no
    defined answer for such a row, and the two places that could have produced one (the request
    models above, the table's CHECK) both refuse it first.
    """
    from datetime import timezone as _dt_timezone

    anchor = after or datetime.now(_dt_timezone.utc)
    if anchor.tzinfo is None:
        anchor = anchor.replace(tzinfo=_dt_timezone.utc)

    has_cron = cron_expression is not None
    has_interval = interval_seconds is not None
    if has_cron == has_interval:
        raise ValueError(
            "compute_next_run_at needs exactly one cadence "
            "(cron_expression xor interval_seconds)"
        )

    if has_interval:
        return anchor + timedelta(seconds=int(interval_seconds))  # type: ignore[arg-type]

    validate_cron(cron_expression)  # type: ignore[arg-type]
    zone = ZoneInfo(validate_timezone(timezone))
    local_anchor = anchor.astimezone(zone)
    nxt = croniter(cron_expression, local_anchor).get_next(datetime)
    # croniter returns a tz-aware datetime in the anchor's zone; normalise to UTC so the
    # column always stores one comparable instant.
    return nxt.astimezone(_dt_timezone.utc)


class _ScheduleCadenceMixin(BaseModel):
    """Shared cadence validation for the create and update bodies."""

    @field_validator("cron_expression", check_fields=False)
    @classmethod
    def _check_cron(cls, v: str | None) -> str | None:
        return None if v is None else validate_cron(v)

    @field_validator("timezone", check_fields=False)
    @classmethod
    def _check_timezone(cls, v: str | None) -> str | None:
        return None if v is None else validate_timezone(v)


class WorkflowScheduleCreate(_ScheduleCadenceMixin):
    """``POST /workflows/{workflow_id}/schedules`` body."""

    name: str = Field(min_length=1, max_length=200)
    cron_expression: str | None = None
    interval_seconds: int | None = Field(default=None, ge=MIN_INTERVAL_SECONDS)
    timezone: str = "UTC"
    is_active: bool = True
    max_tokens_per_run: int = Field(default=500_000, gt=0, le=MAX_TOKENS_CEILING)
    max_duration_seconds: int = Field(
        default=1_800, gt=0, le=MAX_DURATION_CEILING_SECONDS
    )
    inputs: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def _exactly_one_cadence(self) -> "WorkflowScheduleCreate":
        has_cron = self.cron_expression is not None
        has_interval = self.interval_seconds is not None
        if has_cron == has_interval:
            raise ValueError(
                "a schedule needs exactly one cadence: either cron_expression or "
                "interval_seconds, never both and never neither"
            )
        return self


class WorkflowScheduleUpdate(_ScheduleCadenceMixin):
    """``PATCH /schedules/{id}`` body — every field optional (a toggle is a one-key PATCH).

    ⚠ Sending BOTH cadence fields is refused here, exactly as on create. Sending ONE is
    allowed and the paired field is cleared by the writer — see ``db.schedules.update_schedule``,
    which is where that clearing is done, because doing it in two places is how the table's
    CHECK ends up being the thing that discovers the bug.
    """

    name: str | None = Field(default=None, min_length=1, max_length=200)
    cron_expression: str | None = None
    interval_seconds: int | None = Field(default=None, ge=MIN_INTERVAL_SECONDS)
    timezone: str | None = None
    is_active: bool | None = None
    max_tokens_per_run: int | None = Field(default=None, gt=0, le=MAX_TOKENS_CEILING)
    max_duration_seconds: int | None = Field(
        default=None, gt=0, le=MAX_DURATION_CEILING_SECONDS
    )
    inputs: dict[str, Any] | None = None

    @model_validator(mode="after")
    def _not_both_cadences(self) -> "WorkflowScheduleUpdate":
        if self.cron_expression is not None and self.interval_seconds is not None:
            raise ValueError(
                "a schedule needs exactly one cadence: send cron_expression or "
                "interval_seconds, never both"
            )
        return self


class WorkflowScheduleRead(BaseModel):
    """One ``workflow_schedules`` row as the client renders it.

    ⚠ EXPLICIT FIELD LIST. See the module docblock: the three-place lockstep is
    ``.select()`` string + this model + the serializer.
    """

    id: UUID
    workflow_id: UUID
    name: str
    cron_expression: str | None = None
    interval_seconds: int | None = None
    timezone: str = "UTC"
    is_active: bool = True
    max_tokens_per_run: int
    max_duration_seconds: int
    inputs: dict[str, Any] = Field(default_factory=dict)
    last_run_at: datetime | None = None
    next_run_at: datetime | None = None
    last_status: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    # Resolved by the list reads via a join — the workflow's display name, so the schedule
    # list can SAY what it schedules rather than showing a uuid. Optional because the
    # single-row reads do not join.
    workflow_name: str | None = None


class ScheduleTriggerResult(BaseModel):
    """``POST /schedules/{id}/trigger`` response — the run this launched, or why it did not."""

    launched: bool
    workflow_run_id: UUID | None = None
    detail: str | None = None
