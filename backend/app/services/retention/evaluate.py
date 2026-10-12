"""Phase 275 (RET-03 / D-06 / D-11 / D-19 / D-20 / D-22..D-25 / D-34) — what happens to one document.

⭐ THE RULE LIVES HERE AND NOWHERE ELSE. Preview, the org dry run, the nightly sweep, the confirm
re-check and the Library's document-states all call ``evaluate``. If two of them computed the answer
separately, "Preview showed it" and "the sweep did it" could disagree (RESEARCH Pitfall 14), and
SC#3's "exactly" would be a hope rather than a property.

── THE DECISION ORDER (first match wins) ──────────────────────────────────────────────────────

 1. not org-visible            → ``private``      (D-34: a member's private document is never covered)
 2. on legal hold              → ``held``         (D-06: the sweep skips it entirely)
 3. no folder or class policy  → ``no_policy``
 4. folder + class rules differ→ ``collision``    (D-24: nothing happens; never "longest keep wins")
 5. a policy not previewed at  → ``not_previewed`` (D-02 defence: revision != previewed_revision)
    this revision, or a rule that cannot be read
 6. the chosen clock date is   → ``no_date``      (D-22: NO fallback between the two clocks)
    missing
 7. a skip marker for the same → ``kept`` / ``unarchived`` (D-11 / D-19)
    (policy revision, fingerprint)
 8. past the stage-2 date      → ``archive_and_queue_delete`` / ``queue_delete`` (D-20)
 9. past the stage-1 date      → ``archive`` / ``already_archived`` / ``queue_delete`` / ``queue_review``
10. otherwise                  → ``not_due`` (with the next due date)
    A queue row that already matches (same revision + fingerprint) turns a queue decision into
    ``pending``: the sweep is idempotent and never proposes the same family twice.

Folder policies: the NEAREST ancestor-or-self folder with a policy that covers the document wins
(D-23). A policy with ``include_subfolders = False`` covers only its own folder, and the walk keeps
going past it. Two folder policies at different depths are therefore never a collision.

Versions (D-25): a family is evaluated by its LATEST row; the decision carries every row id, and the
callers archive / queue / delete them together.

Fingerprint (D-11 / D-19): ``latest_id | clock date | folder_id | document_type_norm``. A new
version, a move, or a metadata edit that changes the date or the type re-opens a kept or
un-archived family.

FAIL-CLOSED POLARITY. Every kind outside ``DISPOSE_KINDS`` changes nothing. An unknown unit, an
unknown action or an unknown clock is UNDECIDABLE (``not_previewed`` with a reason), never a
disposal. "Incomplete" is not decided here: the loader raises before a partial context can reach
this function.

── WHAT THIS MODULE MAY NOT DO: NO I/O ─────────────────────────────────────────────────────────

It is handed frozen facts and answers. ``tests/unit/test_275_evaluate.py`` fences its LIVE SOURCE
against every data-access and routing import, the health_verdict precedent.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import Literal, Mapping, Optional

from app.services.retention.periods import UNITS, add_period

DecisionKind = Literal[
    "private",
    "held",
    "no_policy",
    "collision",
    "not_previewed",
    "no_date",
    "kept",
    "unarchived",
    "archive_and_queue_delete",
    "queue_delete",
    "archive",
    "already_archived",
    "queue_review",
    "not_due",
    "pending",
]

#: The only kinds that change anything. Every other kind is "nothing happens".
DISPOSE_KINDS: frozenset[str] = frozenset({"archive", "archive_and_queue_delete", "queue_delete", "queue_review"})
#: Fail-closed states shown in Preview's "can't be decided" bucket.
UNDECIDABLE_KINDS: frozenset[str] = frozenset({"collision", "no_date", "not_previewed"})
#: Kinds whose family the sweep archives on its own (D-08).
ARCHIVE_KINDS: frozenset[str] = frozenset({"archive", "archive_and_queue_delete"})
#: Kinds whose family the sweep queues for a person to confirm a delete (D-08).
QUEUE_DELETE_KINDS: frozenset[str] = frozenset({"queue_delete", "archive_and_queue_delete"})
#: Kinds whose family the sweep queues for a person to decide (D-10).
QUEUE_REVIEW_KINDS: frozenset[str] = frozenset({"queue_review"})
#: Kinds that mean "skipped because a person decided" (D-11 / D-19).
SKIPPED_KINDS: frozenset[str] = frozenset({"kept", "unarchived"})

CLOCKS: tuple[str, ...] = ("document_date", "date_added")
STAGE1_ACTIONS: tuple[str, ...] = ("archive", "delete", "review")
STAGE2_ACTIONS: tuple[str, ...] = ("delete",)

_CLOCK_TEXT = {"document_date": "the document date", "date_added": "added to the Library"}
_THEN_TEXT = {"archive": "archived", "delete": "deleted after an admin approves", "review": "reviewed by a person"}


@dataclass(frozen=True)
class Stage:
    """One step of a policy: ``value`` ``unit`` after the clock date, then ``action``."""

    value: int
    unit: str
    action: str


@dataclass(frozen=True)
class PolicyFacts:
    """A saved (or draft) retention policy, as the evaluator needs it."""

    id: str
    name: str
    #: ``folder`` or ``class`` — one scope per stored policy (migration 204 scope_shape CHECK).
    scope_kind: str
    folder_id: Optional[str]
    include_subfolders: bool
    document_type_norm: Optional[str]
    #: ``document_date`` (documents.date_typed) or ``date_added`` (documents.created_at). No fallback.
    clock: str
    stage1: Stage
    stage2: Optional[Stage]
    revision: int
    previewed_revision: Optional[int]

    def rule(self) -> tuple:
        """What two policies must share to AGREE about a document (D-24)."""
        s2 = (self.stage2.value, self.stage2.unit, self.stage2.action) if self.stage2 else None
        return (self.clock, self.stage1.value, self.stage1.unit, self.stage1.action, s2)


@dataclass(frozen=True)
class FamilyFacts:
    """One version family — the disposition key (user_id, filename, folder_id) — at its latest row."""

    family_key: str
    #: The latest row's id. Its dates and type decide for the whole family (D-25).
    latest_id: str
    #: Every row of the family, latest included: archived / queued / deleted together (D-25).
    row_ids: tuple[str, ...]
    file_paths: tuple[str, ...]
    org_id: str
    folder_id: Optional[str]
    document_type_norm: Optional[str]
    date_typed: Optional[date]
    created_at: Optional[datetime]
    archived_at: Optional[datetime]
    #: True only through the org-shared folder arm or the org-visible connection arm of the
    #: documents SELECT policy. The owner arm alone is PRIVATE (D-34).
    org_visible: bool
    name: str = ""
    archived_policy_id: Optional[str] = None
    archived_policy_name: Optional[str] = None
    source_state: Optional[str] = None


@dataclass(frozen=True)
class SkipMarker:
    """A person kept (D-11) or un-archived (D-19) this family under this policy revision."""

    revision: int
    fingerprint: str
    reason: str
    actor_name: Optional[str] = None
    created_at: Optional[datetime] = None


@dataclass(frozen=True)
class QueueMarker:
    """A queue row already waiting for a person, as it was proposed."""

    revision: int
    fingerprint: str


@dataclass(frozen=True)
class EvalContext:
    """Everything about the org that is not one family. Built by the loader, complete or not at all."""

    #: folder_id → parent folder_id (None at the root).
    folder_parent: Mapping[str, Optional[str]]
    #: folder_id → the folder policy on that folder.
    folder_policies: Mapping[str, PolicyFacts]
    #: document_type_norm → the class policy for that type.
    class_policies: Mapping[str, PolicyFacts]
    #: family_key → the earliest time an active hold has covered it.
    held: Mapping[str, Optional[datetime]] = field(default_factory=dict)
    #: (policy_id, family_key) → the skip marker.
    skips: Mapping[tuple[str, str], SkipMarker] = field(default_factory=dict)
    #: (policy_id, family_key, queue kind) → the queue row already waiting.
    pending: Mapping[tuple[str, str, str], QueueMarker] = field(default_factory=dict)


@dataclass(frozen=True)
class Decision:
    """What happens to one family, and why."""

    kind: DecisionKind
    #: The applying policies, nearest folder policy first, then the class policy.
    policy_ids: tuple[str, ...]
    #: The next relevant due date (the one that was passed, or the one still ahead).
    due_at: Optional[date]
    #: The governing policy's rule as a sentence ("Kept 7 years after …, then archived.").
    rule_text: str
    family_key: str = ""
    row_ids: tuple[str, ...] = ()
    fingerprint: Optional[str] = None
    policy_revision: Optional[int] = None
    #: ``delete`` / ``review`` for a queue-class decision (and for ``pending``), else None.
    queue_kind: Optional[str] = None
    held_since: Optional[datetime] = None
    clock_date: Optional[date] = None
    skip: Optional[SkipMarker] = None
    #: A short reason for Preview rows ("no document date", "also under “X”").
    why: str = ""

    @property
    def policy_id(self) -> Optional[str]:
        return self.policy_ids[0] if self.policy_ids else None


# ── text (the sketch's scopeText / policyRow / retentionFor sentences, UI-SPEC S1 / S8) ──────────

def _unit_word(value: int, unit: str) -> str:
    word = unit[:-1] if (value == 1 and unit.endswith("s")) else unit
    return f"{value} {word}"


def kept_for_text(p: PolicyFacts) -> str:
    """``7 years after the document date`` · ``1 day after added to the Library, delete after 2 days``."""
    clock = _CLOCK_TEXT.get(p.clock, p.clock)
    text = f"{_unit_word(p.stage1.value, p.stage1.unit)} after {clock}"
    if p.stage2 is not None:
        text += f", delete after {_unit_word(p.stage2.value, p.stage2.unit)}"
    return text


def then_text(action: str) -> str:
    return _THEN_TEXT.get(action, action)


def rule_text(p: PolicyFacts) -> str:
    """The S8 "not due" sentence body, without the due date."""
    clock = _CLOCK_TEXT.get(p.clock, p.clock)
    text = f"Kept {_unit_word(p.stage1.value, p.stage1.unit)} after {clock}, then {then_text(p.stage1.action)}"
    if p.stage2 is not None:
        text += f"; queued for deletion {_unit_word(p.stage2.value, p.stage2.unit)} after {clock}"
    return text + "."


def scope_text(p: PolicyFacts, *, folder_path: Optional[str] = None) -> str:
    """``All documents in /Finance/Invoices (and subfolders)`` · ``Personnel records anywhere``."""
    if p.scope_kind == "folder":
        where = folder_path or "a folder"
        return f"All documents in {where}" + (" (and subfolders)" if p.include_subfolders else "")
    t = (p.document_type_norm or "").strip()
    plural = (t[:1].upper() + t[1:] + ("s" if not t.endswith("s") else "")) if t else "Documents"
    return f"{plural} anywhere"


# ── the fingerprint ─────────────────────────────────────────────────────────────────────────

def fingerprint(latest_id: str, clock_date: Optional[date], folder_id: Optional[str], document_type_norm: Optional[str]) -> str:
    """``latest | clock date | folder | type`` — any change re-opens a kept / un-archived family."""
    return "|".join((
        str(latest_id),
        clock_date.isoformat() if clock_date else "",
        str(folder_id) if folder_id else "",
        document_type_norm or "",
    ))


def clock_date_for(p: PolicyFacts, family: FamilyFacts) -> Optional[date]:
    """Exactly the policy's chosen date (D-22). ``None`` when it is missing — never the other clock."""
    if p.clock == "document_date":
        return family.date_typed
    if p.clock == "date_added":
        return _utc_day(family.created_at)
    return None


# ── policy resolution ───────────────────────────────────────────────────────────────────────

def folder_policy_for(folder_id: Optional[str], ctx: EvalContext) -> Optional[PolicyFacts]:
    """The nearest ancestor-or-self folder policy that covers ``folder_id`` (D-23). Cycle-bounded."""
    current = folder_id
    depth = 0
    seen: set[str] = set()
    while current is not None and current not in seen:
        seen.add(current)
        p = ctx.folder_policies.get(current)
        if p is not None and (depth == 0 or p.include_subfolders):
            return p
        current = ctx.folder_parent.get(current)
        depth += 1
    return None


def applying_policies(family: FamilyFacts, ctx: EvalContext) -> tuple[Optional[PolicyFacts], Optional[PolicyFacts]]:
    folder_p = folder_policy_for(family.folder_id, ctx)
    class_p = ctx.class_policies.get(family.document_type_norm) if family.document_type_norm else None
    return folder_p, class_p


def _readable(p: PolicyFacts) -> bool:
    if p.clock not in CLOCKS:
        return False
    if p.stage1.unit not in UNITS or p.stage1.action not in STAGE1_ACTIONS:
        return False
    if isinstance(p.stage1.value, bool) or not isinstance(p.stage1.value, int) or p.stage1.value <= 0:
        return False
    if p.stage2 is not None:
        s2 = p.stage2
        if s2.unit not in UNITS or s2.action not in STAGE2_ACTIONS or p.stage1.action != "archive":
            return False
        if isinstance(s2.value, bool) or not isinstance(s2.value, int) or s2.value <= 0:
            return False
    return True


# ── the rule ────────────────────────────────────────────────────────────────────────────────

def evaluate(family: FamilyFacts, ctx: EvalContext, now: datetime | date) -> Decision:
    """Decide what happens to ``family`` on the day ``now`` falls on (UTC). Pure."""
    today = now if (isinstance(now, date) and not isinstance(now, datetime)) else _utc_day(now)
    folder_p, class_p = applying_policies(family, ctx)
    applying = tuple(p for p in (folder_p, class_p) if p is not None)
    ids = tuple(p.id for p in applying)

    def decide(kind: DecisionKind, **kw) -> Decision:
        kw.setdefault("policy_ids", ids)
        kw.setdefault("due_at", None)
        kw.setdefault("rule_text", "")
        return Decision(kind=kind, family_key=family.family_key, row_ids=family.row_ids, **kw)

    # 1. private (D-34)
    if not family.org_visible:
        return decide("private", why="private")

    # 2. held (D-06)
    if family.family_key in ctx.held:
        return decide("held", held_since=ctx.held.get(family.family_key), why="on legal hold")

    # 3. no policy
    if not applying:
        return decide("no_policy")

    # 4. collision (D-24)
    if folder_p is not None and class_p is not None and folder_p.rule() != class_p.rule():
        return decide("collision", why=f"also under “{class_p.name}”")

    p = applying[0]

    # 5. not previewed at this revision (D-02), or a rule that cannot be read (fail closed)
    for q in applying:
        if q.previewed_revision is None or q.revision != q.previewed_revision:
            return decide("not_previewed", why=f"“{q.name}” was saved without a preview of this version")
        if not _readable(q):
            return decide("not_previewed", why=f"the rule of “{q.name}” can't be read")

    text = rule_text(p)

    # 6. the clock date (D-22)
    clock = clock_date_for(p, family)
    if clock is None:
        why = "no document date" if p.clock == "document_date" else "no date added"
        return decide("no_date", rule_text=text, policy_revision=p.revision, why=why)

    fp = fingerprint(family.latest_id, clock, family.folder_id, family.document_type_norm)
    common = dict(rule_text=text, fingerprint=fp, policy_revision=p.revision, clock_date=clock)

    # 7. a person already decided (D-11 / D-19)
    marker = ctx.skips.get((p.id, family.family_key))
    if marker is not None and marker.revision == p.revision and marker.fingerprint == fp:
        kind: DecisionKind = "unarchived" if marker.reason == "unarchived" else "kept"
        return decide(kind, skip=marker, **common)

    due1 = add_period(clock, p.stage1.value, p.stage1.unit)
    due2 = add_period(clock, p.stage2.value, p.stage2.unit) if p.stage2 is not None else None
    archived = family.archived_at is not None

    def queued(qkind: str) -> bool:
        m = ctx.pending.get((p.id, family.family_key, qkind))
        return m is not None and m.revision == p.revision and m.fingerprint == fp

    # 8. past stage 2 (D-20): archive (if not already) AND queue the delete — one rule, no disagreement
    if due2 is not None and today >= due2:
        if queued("delete"):
            if archived:
                return decide("pending", due_at=due2, queue_kind="delete", **common)
            return decide("archive", due_at=due2, **common)
        if archived:
            return decide("queue_delete", due_at=due2, queue_kind="delete", **common)
        return decide("archive_and_queue_delete", due_at=due2, queue_kind="delete", **common)

    # 9. past stage 1
    if today >= due1:
        action = p.stage1.action
        if action == "archive":
            if archived:
                return decide("already_archived", due_at=due2 or due1, **common)
            return decide("archive", due_at=due1, **common)
        qkind = "delete" if action == "delete" else "review"
        if queued(qkind):
            return decide("pending", due_at=due1, queue_kind=qkind, **common)
        return decide("queue_delete" if qkind == "delete" else "queue_review", due_at=due1, queue_kind=qkind, **common)

    # 10. not yet
    return decide("not_due", due_at=due1, **common)


def _utc_day(value: Optional[datetime]) -> Optional[date]:
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is not None:
            value = value.astimezone(timezone.utc)
        return value.date()
    return value
