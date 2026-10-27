"""Phase 295 plan 05 (RUN-01 read half / RUN-04 / D-04, D-22, D-37) — two run-read facts, pure.

PURE LEAF: no ``app`` import, no pool, no clock read (``now`` is passed in). Every run read that
carries these facts imports them from HERE, so the run page, the evidence page / its JSON export
and the chat panel cannot disagree about either one:

  * ``unsourced`` (D-04). 295-03 stores ``{"continued_by": <answering user uuid>, "at": <ISO>}``
    on a step kept without sources. The wire carries ``{"continued_by": <words>, "at": <ISO>}``:
    the caller resolves the viewer-aware words (``workflow_runs.unsourced_who``) and this module
    REPLACES the uuid with them. The stored id is never copied, so it cannot reach a client
    (T-295-05-01).
  * ``end_reason`` (D-22). Why a failed or cancelled run stopped, read only from what was
    RECORDED: the failed step's ``_failure_reason``, else the run's latest ``run_failed`` audit
    reason, else (a cancelled run only) the latest ``policy_applied`` audit whose policy is
    ``run_cancelled`` (295-04, D-19). Whitespace normalises to ``None`` (the 214 rule, never
    ``?? ""``). Nothing here composes a reason: a run with none recorded reads ``None`` and the
    client says so (T-295-05-04).
  * ``deadline_passed`` (D-37). "The answer window has passed" is a fact about TIME — the
    prompt's own ``created_at + timeout_seconds`` — never about ``runs.status``. An engine ask
    pauses the run at second 0 with ``timeout_seconds`` null and must never read as passed.
  * ``origin`` (Phase 293, D-22 / D-23). How a run was started, read only from the two columns
    ``create_workflow_run`` stamped once at start (``origin_kind`` / ``origin_label``). The wire
    is ``{"kind", "label", "actor_name"}``; a NULL kind (every run that was never backfilled) or
    any kind outside the three is ``None`` — never a default kind, never guessed. ``actor_name``
    is an app-start fact only: a schedule or a key names no person.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta
from typing import Any, Iterable, Literal

from pydantic import BaseModel

# The audit kinds an end reason may be read from. ``policy_applied`` is an existing kind; only
# the ``run_cancelled`` policy is read off it (any other policy is ignored).
END_REASON_AUDIT_KINDS: tuple[str, ...] = ("run_failed", "policy_applied")
_CANCEL_POLICY = "run_cancelled"
_ENDED = frozenset({"failed", "cancelled"})
# Phase 293 — the three recorded start kinds (migration 215's CHECK). Anything else reads None.
ORIGIN_KINDS = frozenset({"app", "schedule", "key"})


class UnsourcedMark(BaseModel):
    """The wire shape of the mark: words and a timestamp, never an id."""

    continued_by: str
    at: str


def _nonblank(value: Any) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def unsourced_for_wire(raw: Any, *, who: str) -> dict[str, str] | None:
    """``{"continued_by": who, "at": <ISO>}`` for a recorded mark, else ``None``.

    A mark with no readable ``at`` is not a mark (the choice's time is half the fact). The
    stored ``continued_by`` is deliberately NOT read: the words come from ``who``.
    """
    if not isinstance(raw, dict):
        return None
    at = _nonblank(raw.get("at"))
    if at is None:
        return None
    return {"continued_by": who, "at": at}


def end_reason_for_wire(raw: Any) -> str | None:
    """A recorded reason, stripped; anything blank or non-``str`` is ``None``."""
    return _nonblank(raw)


def _metadata_object(raw: Any) -> dict:
    """``write_audit`` double-encodes ``metadata``; a dict, a JSON string or a twice-encoded
    string all read the same. Anything unreadable is an empty object."""
    value = raw
    for _ in range(3):
        if isinstance(value, dict):
            return value
        if not isinstance(value, str):
            return {}
        try:
            value = json.loads(value)
        except (TypeError, ValueError):
            return {}
    return value if isinstance(value, dict) else {}


def resolve_end_reason(
    status: Any, phase_reasons: Iterable[Any], audit_rows: Iterable[dict]
) -> str | None:
    """The recorded reason a failed or cancelled run stopped, or ``None``.

    ``phase_reasons`` are the ``_failure_reason`` values of the run's FAILED steps in
    ``phase_index`` order (the latest one wins). ``audit_rows`` are ``harness_audit`` rows of
    ``END_REASON_AUDIT_KINDS`` in recorded order (the latest one wins).
    """
    if status not in _ENDED:
        return None
    for reason in reversed([end_reason_for_wire(r) for r in phase_reasons or []]):
        if reason is not None:
            return reason
    rows = [r for r in audit_rows or [] if isinstance(r, dict)]
    for row in reversed(rows):
        if row.get("event_type") == "run_failed":
            reason = end_reason_for_wire(_metadata_object(row.get("metadata")).get("reason"))
            if reason is not None:
                return reason
    if status != "cancelled":
        return None
    for row in reversed(rows):
        if row.get("event_type") != "policy_applied":
            continue
        meta = _metadata_object(row.get("metadata"))
        if meta.get("policy") == _CANCEL_POLICY:
            reason = end_reason_for_wire(meta.get("reason"))
            if reason is not None:
                return reason
    return None


def _instant(raw: Any) -> datetime | None:
    if isinstance(raw, datetime):
        return raw
    if isinstance(raw, str) and raw.strip():
        try:
            return datetime.fromisoformat(raw.strip().replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


class RunOriginWire(BaseModel):
    """Phase 293 — how a run started, as recorded at start. Every run read declares this."""

    kind: Literal["app", "schedule", "key"]
    label: str | None = None
    actor_name: str | None = None


def origin_for_wire(kind: Any, label: Any, actor_name: Any) -> dict[str, Any] | None:
    """``{"kind", "label", "actor_name"}`` for a recorded origin, else ``None``.

    ``kind`` must be one of ``ORIGIN_KINDS`` exactly (no coercion); a blank label or name reads
    ``None``. ``actor_name`` is kept only for an app start.
    """
    if not isinstance(kind, str) or kind not in ORIGIN_KINDS:
        return None
    return {
        "kind": kind,
        "label": _nonblank(label),
        "actor_name": _nonblank(actor_name) if kind == "app" else None,
    }


def deadline_passed(timeout_seconds: Any, created_at: Any, now: datetime) -> bool:
    """True only when the prompt HAS a deadline and it is behind ``now``.

    ``timeout_seconds`` must be a real number (never coerced from a string); an unreadable
    ``created_at`` is an unmeasurable deadline, which never reads as passed.
    """
    if isinstance(timeout_seconds, bool) or not isinstance(timeout_seconds, (int, float)):
        return False
    asked = _instant(created_at)
    if asked is None:
        return False
    if asked.tzinfo is None and now.tzinfo is not None:
        asked = asked.replace(tzinfo=now.tzinfo)
    return asked + timedelta(seconds=float(timeout_seconds)) < now


__all__ = [
    "END_REASON_AUDIT_KINDS",
    "ORIGIN_KINDS",
    "RunOriginWire",
    "UnsourcedMark",
    "deadline_passed",
    "end_reason_for_wire",
    "origin_for_wire",
    "resolve_end_reason",
    "unsourced_for_wire",
]
