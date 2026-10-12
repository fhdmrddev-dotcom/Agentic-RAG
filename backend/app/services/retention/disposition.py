"""Phase 275 (RET-02 / RET-03 / D-02 / D-03 / D-08..D-13 / D-19 / D-25) — what a policy DOES.

Four verbs, each built on the ONE rule (``evaluate``) over the ONE fail-closed read (``load``):

* ``preview_draft`` — the dry run. Loads the org, substitutes the draft for the policy being edited,
  evaluates every family, and buckets the result exactly as the sweep would act on it (D-02, Pitfall
  14). Nothing is written by this function; the router records the preview row.
* ``run_org_sweep`` — the nightly sweep. In ONE transaction it ARCHIVES the archive set on its own
  and QUEUES the delete and review sets (D-08). It never deletes a document. One receipt per action.
  An incomplete read writes nothing but a ``sweep_incomplete`` receipt (SC#3).
* ``confirm_batch`` — the ONLY code path in retention that deletes a document (D-08), reached only
  behind ``require_org_manage`` with a typed count that equals the delete list (D-03). Each family is
  re-checked inside its own transaction — row lock, ``retention_held_documents``, policy revision and
  fingerprint — and a family that became held, moved or changed is DROPPED with a ``did_not_delete``
  receipt, never deleted. Every version row goes (chunks, tables and images cascade); the file bytes
  are removed right AFTER that family's commit and a storage failure is logged (D-12, D-38). A
  family missing from the snapshot is dropped, never deleted unseen (275-REVIEW B-WR-05); a family
  that fails is reported under ``failed`` while the batch continues (B-WR-04); Archive on a review
  row runs the same in-transaction re-check as Delete (B-WR-07).
* ``unarchive_family`` — an admin brings a family back (D-19, revision B-NEW-1).

⛔ EVERY STATEMENT BINDS ``org_id``. The pool is the service role; the explicit predicate is the wall
between orgs (T-275-20). ⛔ This module never reads or writes the thread-attachment table — a
thread attachment is never a document (D-274-01); its library link is ON DELETE SET NULL, and a
source fence in ``test_275_sweep.py`` keeps that table's name out of every retention module.

Every disposition receipt names its policy (W-4): archived, queued_delete, queued_review, deleted,
did_not_delete, kept and unarchived all carry ``policy_name``, and migration 204's CHECK refuses one
that does not.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field, replace
from datetime import datetime, timezone
from typing import Any, Iterable, Optional, Sequence
from uuid import UUID

from starlette.concurrency import run_in_threadpool

from app.db import retention as rdb
from app.services.retention.evaluate import (
    ARCHIVE_KINDS,
    DISPOSE_KINDS,
    QUEUE_DELETE_KINDS,
    QUEUE_REVIEW_KINDS,
    SKIPPED_KINDS,
    UNDECIDABLE_KINDS,
    Decision,
    EvalContext,
    PolicyFacts,
    evaluate,
    fingerprint,
)
from app.services.retention.load import (
    IncompleteEvaluation,
    OrgSnapshot,
    family_key_of,
    load_snapshot,
)

logger = logging.getLogger(__name__)

SWEEP_ACTOR = rdb.SWEEP_ACTOR_NAME
STORAGE_BUCKET = "documents"


class DispositionError(Exception):
    """A refusal with an HTTP status and a sentence for a person."""

    status = 409

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class ConfirmRefused(DispositionError):
    status = 422


class NotFound(DispositionError):
    status = 404


class DraftConflict(DispositionError):
    status = 409


def _now(now: Optional[datetime]) -> datetime:
    return now if now is not None else datetime.now(timezone.utc)


def _u(v: Any) -> UUID:
    return v if isinstance(v, UUID) else UUID(str(v))


# ════════════════════════════════════════════════════════════════════════════════════════════
# Preview (the dry run)
# ════════════════════════════════════════════════════════════════════════════════════════════

DRAFT_ID = "draft"

BUCKETS = ("act", "hold", "undecidable", "kept", "not_yet", "already")


def bucket_of(d: Decision) -> Optional[str]:
    """Which Preview bucket a decision lands in (UI-SPEC S2). ``None`` = not shown."""
    if d.kind in DISPOSE_KINDS or d.kind == "pending":
        return "act"
    if d.kind == "held":
        return "hold"
    if d.kind in UNDECIDABLE_KINDS:
        return "undecidable"
    if d.kind in SKIPPED_KINDS:
        return "kept"
    if d.kind == "not_due":
        return "not_yet"
    if d.kind == "already_archived":
        return "already"
    return None


def draft_policy_facts(draft: dict, *, policy_id: str, revision: int) -> PolicyFacts:
    """A draft as the evaluator sees it — previewed at its own revision, by definition."""
    from app.services.retention.load import policy_facts  # noqa: PLC0415 — one constructor

    row = dict(draft)
    row.update(id=policy_id, revision=revision, previewed_revision=revision)
    return policy_facts(row)


def substitute(snapshot: OrgSnapshot, draft_p: PolicyFacts, *, editing_policy_id: Optional[str]) -> EvalContext:
    """The org's context with the draft in place of the policy being edited.

    A second policy on the SAME scope cannot exist (migration 204's unique indexes), so a draft that
    lands on another policy's folder or type is refused here rather than silently replacing it.
    """
    ctx = snapshot.ctx
    folders = {k: v for k, v in ctx.folder_policies.items() if v.id != editing_policy_id}
    classes = {k: v for k, v in ctx.class_policies.items() if v.id != editing_policy_id}
    if draft_p.scope_kind == "folder":
        other = folders.get(draft_p.folder_id or "")
        if other is not None:
            raise DraftConflict(f"“{other.name}” already covers this folder. Edit that policy instead.")
        folders[draft_p.folder_id or ""] = draft_p
    else:
        other = classes.get(draft_p.document_type_norm or "")
        if other is not None:
            raise DraftConflict(f"“{other.name}” already covers this document type. Edit that policy instead.")
        classes[draft_p.document_type_norm or ""] = draft_p
    return replace(ctx, folder_policies=folders, class_policies=classes)


async def preview_draft(
    pool,
    org_id,
    draft: dict,
    *,
    editing_policy_id: Optional[str] = None,
    now: Optional[datetime] = None,
    snapshot: Optional[OrgSnapshot] = None,
) -> dict:
    """What tonight's sweep would do under ``draft``. Raises ``IncompleteEvaluation``; writes nothing."""
    at = _now(now)
    snap = snapshot if snapshot is not None else await load_snapshot(pool, org_id)
    pid = str(editing_policy_id) if editing_policy_id else DRAFT_ID
    revision = draft_revision(snap, draft, editing_policy_id)
    draft_p = draft_policy_facts(draft, policy_id=pid, revision=revision)
    ctx = substitute(snap, draft_p, editing_policy_id=pid if editing_policy_id else None)
    names = {p.id: p.name for p in list(ctx.folder_policies.values()) + list(ctx.class_policies.values())}

    buckets: dict[str, list[dict]] = {b: [] for b in BUCKETS}
    sets: dict[str, set[str]] = {"archive": set(), "queue_delete": set(), "queue_review": set()}
    private = 0
    for fam in snap.families:
        d = evaluate(fam, ctx, at)
        if pid not in d.policy_ids:
            continue
        if d.kind == "private":
            private += 1
            continue
        _collect_sets(sets, d, fam.latest_id)
        b = bucket_of(d)
        if b is None:
            continue
        buckets[b].append(_preview_row(snap, fam, d, names, pid))
    for rows in buckets.values():
        rows.sort(key=lambda r: (r.get("due_at") or "9999", r["name"].lower()))
    counts = {b: len(rows) for b, rows in buckets.items()}
    counts["private_not_covered"] = private
    return {
        "policy_id": editing_policy_id,
        "action": draft_p.stage1.action,
        "has_stage2": draft_p.stage2 is not None,
        "buckets": buckets,
        "counts": counts,
        "private_not_covered": private,
        "sets": {k: sorted(v) for k, v in sets.items()},
    }


def draft_revision(snap: OrgSnapshot, draft: dict, editing_policy_id: Optional[str]) -> int:
    """The revision the draft will have once saved: unchanged rules keep it, changed rules bump it."""
    if not editing_policy_id:
        return 1
    row = snap.policy_rows.get(str(editing_policy_id))
    if row is None:
        raise NotFound("That policy no longer exists.")
    return int(row["revision"]) + (1 if rule_changed(row, draft) else 0)


RULE_FIELDS = (
    "scope_kind", "folder_id", "include_subfolders", "document_type_norm", "clock",
    "stage1_value", "stage1_unit", "stage1_action", "stage2_value", "stage2_unit", "stage2_action",
)


def rule_changed(stored: dict, draft: dict) -> bool:
    """A change to scope or rule re-opens kept families (D-11); a rename does not."""
    for f in RULE_FIELDS:
        a, b = stored.get(f), draft.get(f)
        if f == "folder_id":
            a, b = (str(a) if a else None), (str(b) if b else None)
        if f == "include_subfolders":
            a, b = bool(a if a is not None else True), bool(b if b is not None else True)
        if a != b:
            return True
    return False


def _collect_sets(sets: dict[str, set[str]], d: Decision, latest_id: str) -> None:
    if d.kind in ARCHIVE_KINDS:
        sets["archive"].add(latest_id)
    if d.kind in QUEUE_DELETE_KINDS or (d.kind == "pending" and d.queue_kind == "delete"):
        sets["queue_delete"].add(latest_id)
    if d.kind in QUEUE_REVIEW_KINDS or (d.kind == "pending" and d.queue_kind == "review"):
        sets["queue_review"].add(latest_id)


def _preview_row(snap: OrgSnapshot, fam, d: Decision, names: dict[str, str], pid: str) -> dict:
    why = d.why
    other = None
    if d.kind == "collision":
        other_id = next((x for x in d.policy_ids if x != pid), None)
        other = names.get(other_id or "")
        why = f"also under “{other}”" if other else why
    hold_names = [snap.holds[h]["name"] for h in snap.family_holds.get(fam.family_key, []) if h in snap.holds]
    if d.kind == "held" and hold_names:
        why = hold_names[0]
    return {
        "document_id": fam.latest_id,
        "name": fam.name,
        "folder_path": snap.folder_paths.get(fam.folder_id) if fam.folder_id else None,
        "document_date": fam.date_typed.isoformat() if fam.date_typed else None,
        "due_at": d.due_at.isoformat() if d.due_at else None,
        "kind": d.kind,
        "why": why,
        "other_policy_name": other,
        "hold_names": hold_names,
        "kept_by": d.skip.actor_name if d.skip else None,
        "kept_at": d.skip.created_at.isoformat() if d.skip and d.skip.created_at else None,
        "archived_at": fam.archived_at.isoformat() if fam.archived_at else None,
    }


async def dry_run_org(pool, org_id, *, now: Optional[datetime] = None) -> dict:
    """The whole-org dry run: the exact sets the sweep would act on, with nothing written."""
    snap = await load_snapshot(pool, org_id)
    at = _now(now)
    sets: dict[str, set[str]] = {"archive": set(), "queue_delete": set(), "queue_review": set()}
    for fam in snap.families:
        _collect_sets(sets, evaluate(fam, snap.ctx, at), fam.latest_id)
    return {k: sorted(v) for k, v in sets.items()}


# ════════════════════════════════════════════════════════════════════════════════════════════
# The sweep — archives on its own, queues the rest, never deletes (D-08)
# ════════════════════════════════════════════════════════════════════════════════════════════

@dataclass
class SweepResult:
    status: str
    counts: dict = field(default_factory=dict)
    error: Optional[str] = None
    archived: list[str] = field(default_factory=list)
    queued_delete: list[str] = field(default_factory=list)
    queued_review: list[str] = field(default_factory=list)


async def run_org_sweep(pool, org_id, *, now: Optional[datetime] = None) -> SweepResult:
    """Sweep ONE org: read, decide and write in one REPEATABLE READ transaction.

    ``IncompleteEvaluation`` → nothing is changed; one ``sweep_incomplete`` receipt is written and
    the result says ``incomplete``. Any other exception propagates (the caller releases ``failed``,
    and the transaction has rolled back, so a failure writes nothing either).
    """
    at = _now(now)
    try:
        async with pool.acquire() as con:
            async with con.transaction(isolation="repeatable_read"):
                snap = await load_snapshot(pool, org_id, con=con)
                return await _sweep_write(con, snap, at)
    except IncompleteEvaluation as exc:
        try:
            await rdb.insert_receipt(
                pool, org_id, "sweep_incomplete", actor_name=SWEEP_ACTOR,
                detail={"reason": exc.reason, "at": at.isoformat()},
            )
        except Exception:  # the receipt is best-effort; the refusal to dispose is not
            logger.exception("retention: sweep_incomplete receipt failed for org %s", org_id)
        return SweepResult(status="incomplete", error=exc.reason, counts={"incomplete": 1})


async def _sweep_write(con, snap: OrgSnapshot, at: datetime) -> SweepResult:
    org = _u(snap.org_id)
    result = SweepResult(status="ok")
    receipts: list[tuple] = []
    counts = {"families": len(snap.families), "archived": 0, "queued_delete": 0, "queued_review": 0,
              "held": 0, "undecidable": 0, "private": 0}
    decisions: dict[str, Decision] = {}

    for fam in snap.families:
        d = evaluate(fam, snap.ctx, at)
        decisions[fam.family_key] = d
        if d.kind == "held":
            counts["held"] += 1
        elif d.kind in UNDECIDABLE_KINDS:
            counts["undecidable"] += 1
        elif d.kind == "private":
            counts["private"] += 1

    # 1. queue rows no longer backed by a matching decision are withdrawn (a held, edited, moved or
    #    kept family is never left waiting for a person). This deletes PROPOSALS, never documents.
    keep_queue: list[UUID] = []
    for row in snap.queue_rows:
        d = decisions.get(str(row["family_key"]))
        if (
            d is not None
            and d.policy_id == str(row["policy_id"])
            and d.fingerprint == str(row["fingerprint"])
            and d.policy_revision == int(row["policy_revision"])
            and d.kind in ("pending", "archive")
        ):
            keep_queue.append(_u(row["id"]))
    await con.execute(
        "DELETE FROM public.retention_queue WHERE org_id = $1 AND NOT (id = ANY($2::uuid[]))",
        org, keep_queue,
    )

    for fam in snap.families:
        d = decisions[fam.family_key]
        if d.kind not in DISPOSE_KINDS:
            continue
        p = snap.policies.get(d.policy_id or "")
        if p is None:  # cannot happen with a complete snapshot; fail closed if it does
            continue

        # 2. archive the WHOLE family on its own (D-08, D-25)
        if d.kind in ARCHIVE_KINDS:
            status = await con.execute(
                "UPDATE public.documents SET archived_at = $3, archived_policy_id = $4, archived_policy_name = $5 "
                "WHERE org_id = $1 AND id = ANY($2::uuid[]) AND archived_at IS NULL",
                org, [_u(x) for x in fam.row_ids], at, _u(p.id), p.name,
            )
            if _affected(status):
                counts["archived"] += 1
                result.archived.append(fam.latest_id)
                receipts.append(rdb.receipt_args(
                    org, "archived", document_id=fam.latest_id, document_name=fam.name,
                    policy_id=p.id, policy_name=p.name, actor_name=SWEEP_ACTOR,
                    detail={"rows": len(fam.row_ids), "due_at": d.due_at.isoformat() if d.due_at else None},
                ))

        # 3. queue for a person (D-08 delete, D-10 review) — never delete here
        if d.queue_kind in ("delete", "review") and d.kind in (QUEUE_DELETE_KINDS | QUEUE_REVIEW_KINDS):
            inserted = await con.fetchval(
                "INSERT INTO public.retention_queue (org_id, policy_id, family_key, latest_document_id, kind, "
                "policy_revision, fingerprint, found_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) "
                "ON CONFLICT (policy_id, family_key, kind) DO NOTHING RETURNING id",
                org, _u(p.id), fam.family_key, _u(fam.latest_id), d.queue_kind,
                d.policy_revision, d.fingerprint, at,
            )
            if inserted is not None:
                action = "queued_delete" if d.queue_kind == "delete" else "queued_review"
                counts[action] += 1
                (result.queued_delete if d.queue_kind == "delete" else result.queued_review).append(fam.latest_id)
                receipts.append(rdb.receipt_args(
                    org, action, document_id=fam.latest_id, document_name=fam.name,
                    policy_id=p.id, policy_name=p.name, actor_name=SWEEP_ACTOR,
                    detail={"due_at": d.due_at.isoformat() if d.due_at else None},
                ))

    await rdb.insert_receipts(con, receipts)
    result.counts = counts
    return result


def _affected(status: Any) -> bool:
    try:
        return int(str(status).rsplit(" ", 1)[-1]) > 0
    except (ValueError, IndexError):
        return False


# ════════════════════════════════════════════════════════════════════════════════════════════
# Confirm — the ONLY retention path that deletes a document (D-03, D-08, D-12)
# ════════════════════════════════════════════════════════════════════════════════════════════

_FAMILY_ROWS_SQL = (
    "SELECT id, filename, file_path, folder_id, document_type_norm, date_typed, created_at, is_latest, "
    "version_number, archived_at FROM public.documents "
    "WHERE org_id = $1 AND user_id = $2 AND filename = $3 AND folder_id IS NOT DISTINCT FROM $4 FOR UPDATE"
)


async def confirm_batch(
    pool,
    org_id,
    policy_id,
    *,
    delete_ids: Sequence[str],
    keep_ids: Sequence[str] = (),
    archive_ids: Sequence[str] = (),
    typed_count: int,
    actor_id,
    actor_name: str,
    now: Optional[datetime] = None,
    storage=None,
) -> dict:
    """Apply an admin's decisions on one policy's waiting list.

    Ids are the ``latest_document_id`` of queue rows. ``typed_count`` must equal ``len(delete_ids)``
    or NOTHING is written (D-03). Each family is re-checked in its own transaction.

    275-REVIEW B-WR-04: a family that fails with a non-hold error is reported under ``failed`` (it
    rolled back; its queue row stays for a retry) and the batch CONTINUES — never a bare 500 after
    other families were already deleted. Each deleted family's bytes are removed right after its
    own commit, and its ``deleted`` receipt names the file paths so a failed removal can be found
    and retried (``bytes_not_removed``).
    """
    delete_ids = [str(x) for x in delete_ids]
    keep_ids = [str(x) for x in keep_ids]
    archive_ids = [str(x) for x in archive_ids]
    if isinstance(typed_count, bool) or not isinstance(typed_count, int) or typed_count != len(delete_ids):
        raise ConfirmRefused(f"Type {len(delete_ids)} to confirm.")
    everything = delete_ids + keep_ids + archive_ids
    if len(set(everything)) != len(everything):
        raise ConfirmRefused("A document can have only one decision.")
    if not everything:
        raise ConfirmRefused("Nothing was chosen.")

    at = _now(now)
    snap = await load_snapshot(pool, org_id)  # IncompleteEvaluation → nothing is written
    p = snap.policies.get(str(policy_id))
    if p is None:
        raise NotFound("That policy no longer exists.")
    queue = {str(r["latest_document_id"]): r for r in snap.queue_rows if str(r["policy_id"]) == p.id}

    out: dict[str, list] = {
        "deleted": [], "did_not_delete": [], "kept": [], "archived": [], "not_found": [], "skipped": [],
        "failed": [],
    }
    removed: list[str] = []
    not_removed: list[str] = []

    who = dict(actor_id=actor_id, actor_name=actor_name)

    for doc_id in delete_ids:
        row = queue.get(doc_id)
        if row is None:
            out["not_found"].append({"document_id": doc_id})
            continue
        try:
            paths = await _confirm_delete(pool, snap, p, row, at=at, out=out, **who)
        except Exception as exc:  # B-WR-04: reported, never a silent partial 500
            await _record_failure(pool, snap, p, row, "delete", exc, out=out, **who)
            continue
        # D-12 / D-38: this family's bytes right after ITS commit; a storage failure is logged.
        await _remove_bytes(storage, paths, removed, not_removed)

    for doc_id in keep_ids:
        row = queue.get(doc_id)
        if row is None:
            out["not_found"].append({"document_id": doc_id})
            continue
        try:
            await _confirm_keep(pool, snap, p, row, out=out, **who)
        except Exception as exc:
            await _record_failure(pool, snap, p, row, "keep", exc, out=out, **who)

    for doc_id in archive_ids:
        row = queue.get(doc_id)
        if row is None or str(row["kind"]) != "review":
            out["not_found"].append({"document_id": doc_id})
            continue
        try:
            await _confirm_archive(pool, snap, p, row, at=at, out=out, **who)
        except Exception as exc:
            await _record_failure(pool, snap, p, row, "archive", exc, out=out, **who)

    out["removed_paths"] = removed
    out["bytes_not_removed"] = not_removed
    return out


async def _remove_bytes(storage, paths: list[str], removed: list[str], not_removed: list[str]) -> None:
    if not paths or storage is None:
        return
    try:
        await run_in_threadpool(lambda: storage.storage.from_(STORAGE_BUCKET).remove(paths))
        removed.extend(paths)
    except Exception:
        logger.exception("retention: removing %d file(s) after a confirmed delete failed", len(paths))
        not_removed.extend(paths)


async def _record_failure(pool, snap, p: PolicyFacts, qrow: dict, decision: str, exc: Exception, *,
                          actor_id, actor_name, out) -> None:
    """A family that failed for a reason other than a hold: nothing of it was committed (its
    transaction rolled back) and its queue row stays for a retry. Reported, and receipted
    best-effort — a second failure here is logged, never raised over the batch."""
    org = _u(snap.org_id)
    fam = snap.family(str(qrow["family_key"]))
    name = fam.name if fam else None
    logger.error("retention: confirm %s failed for %s: %r", decision, qrow.get("latest_document_id"), exc)
    out["failed"].append({
        "document_id": str(qrow["latest_document_id"]), "name": name, "decision": decision,
        "error": type(exc).__name__,
    })
    try:
        await rdb.insert_receipt(
            pool, org, "did_not_delete", document_id=qrow["latest_document_id"], document_name=name,
            policy_id=p.id, policy_name=p.name, actor_id=actor_id, actor_name=actor_name,
            detail={"reason": "error", "decision": decision, "error": type(exc).__name__},
        )
    except Exception:
        logger.exception("retention: the failure receipt for %s could not be written", qrow.get("latest_document_id"))


@dataclass
class _Recheck:
    """What one family looks like INSIDE the confirm transaction (rows locked FOR UPDATE)."""

    status: str  # "ok" | "not_found" | "held" | "changed"
    q: Optional[Any] = None
    rows: list = field(default_factory=list)
    ids: list = field(default_factory=list)
    name: Optional[str] = None
    since: Optional[datetime] = None


async def _recheck_in_tx(con, org: UUID, p: PolicyFacts, qrow: dict, fam, name: Optional[str]) -> _Recheck:
    """The ONE in-transaction re-check Delete and Archive both run (D-03; B-WR-05, B-WR-07): the
    queue row still exists, nothing in the family is held, the policy is at the queued revision,
    the latest row still has the queued fingerprint, and the family is still EXACTLY the rows the
    snapshot evaluated — a rename that merged another family into this key is "changed"."""
    q = await con.fetchrow(
        "SELECT id, family_key, latest_document_id, kind, policy_revision, fingerprint "
        "FROM public.retention_queue WHERE id = $1 AND org_id = $2 AND policy_id = $3 FOR UPDATE",
        _u(qrow["id"]), org, _u(p.id),
    )
    head = await con.fetchrow(
        "SELECT user_id, filename, folder_id FROM public.documents WHERE id = $1 AND org_id = $2",
        _u(qrow["latest_document_id"]), org,
    )
    if q is None or head is None:
        return _Recheck("not_found", name=name)
    rows = [dict(r) for r in await con.fetch(_FAMILY_ROWS_SQL, org, head["user_id"], head["filename"], head["folder_id"])]
    pol = await con.fetchrow(
        "SELECT revision, clock FROM public.retention_policies WHERE id = $1 AND org_id = $2 FOR SHARE",
        _u(p.id), org,
    )
    ids = [r["id"] for r in rows]
    latest = _latest_row(rows)
    name = str(latest["filename"]) if latest else name
    held = await con.fetch("SELECT document_id, held_since FROM public.retention_held_documents($1::uuid[])", ids)
    if held:
        since = min((h["held_since"] for h in held if h["held_since"] is not None), default=None)
        return _Recheck("held", q=q, rows=rows, ids=ids, name=name, since=since)
    fp_now = None
    if latest is not None and pol is not None:
        clock = latest["date_typed"] if pol["clock"] == "document_date" else _day(latest["created_at"])
        fp_now = fingerprint(str(latest["id"]), clock, str(latest["folder_id"]) if latest["folder_id"] else None, latest["document_type_norm"])
    same_family = fam is not None and {str(i) for i in ids} == set(fam.row_ids)
    if (pol is None or int(pol["revision"]) != int(q["policy_revision"]) or fp_now != str(q["fingerprint"])
            or not same_family):
        return _Recheck("changed", q=q, rows=rows, ids=ids, name=name)
    return _Recheck("ok", q=q, rows=rows, ids=ids, name=name)


async def _confirm_delete(pool, snap, p: PolicyFacts, qrow: dict, *, at, actor_id, actor_name, out) -> list[str]:
    """Delete one family, or drop it with a receipt. Returns the file paths of a COMMITTED delete."""
    org = _u(snap.org_id)
    fam = snap.family(str(qrow["family_key"]))
    name = fam.name if fam else None
    # B-WR-05: a family missing from the snapshot was never evaluated — it is DROPPED, never
    # deleted unseen (it may now share its key with a family nobody proposed).
    if fam is None:
        await _did_not_delete(pool, org, p, qrow, name, "changed", None, actor_id, actor_name, out)
        return []
    # The rule, again (D-09): only a family the evaluator still says is waiting under THIS policy.
    d = evaluate(fam, snap.ctx, at)
    if d.kind == "held":
        await _did_not_delete(pool, org, p, qrow, name, "held", d.held_since, actor_id, actor_name, out)
        return []
    if not (d.kind == "pending" and d.policy_id == p.id and d.queue_kind == str(qrow["kind"])):
        await _did_not_delete(pool, org, p, qrow, name, "changed", None, actor_id, actor_name, out)
        return []

    try:
        async with pool.acquire() as con:
            async with con.transaction():
                rc = await _recheck_in_tx(con, org, p, qrow, fam, name)
                name = rc.name
                if rc.status == "not_found":
                    out["not_found"].append({"document_id": str(qrow["latest_document_id"]), "name": name})
                    return []
                if rc.status in ("held", "changed"):
                    await con.execute("DELETE FROM public.retention_queue WHERE id = $1 AND org_id = $2", rc.q["id"], org)
                    await _receipt_did_not_delete(con, org, p, qrow, name, rc.status, rc.since, actor_id, actor_name)
                    out["did_not_delete"].append(_dnd(qrow, name, rc.status, rc.since))
                    return []
                paths = [str(r["file_path"]) for r in rc.rows if r.get("file_path")]
                # ⛔ THE ONE DELETE (D-08). Every version row; chunks/tables/images cascade (D-12).
                await con.execute(
                    "DELETE FROM public.documents WHERE org_id = $1 AND id = ANY($2::uuid[])", org, rc.ids,
                )
                latest = _latest_row(rc.rows)
                await rdb.insert_receipt(
                    con, org, "deleted", document_id=latest["id"], document_name=name,
                    policy_id=p.id, policy_name=p.name, actor_id=actor_id, actor_name=actor_name,
                    detail={"rows": len(rc.ids), "approved_at": at.isoformat(), "file_paths": paths},
                )
        out["deleted"].append({"document_id": str(qrow["latest_document_id"]), "name": name, "rows": len(rc.ids)})
        return paths
    except Exception as exc:
        if getattr(exc, "sqlstate", None) == "PT409":  # a hold raced past the check — the DB refused
            await _did_not_delete(pool, org, p, qrow, name, "held", None, actor_id, actor_name, out)
            return []
        raise


async def _did_not_delete(pool, org, p, qrow, name, reason, since, actor_id, actor_name, out, *, detail=None) -> None:
    async with pool.acquire() as con:
        async with con.transaction():
            await con.execute("DELETE FROM public.retention_queue WHERE id = $1 AND org_id = $2", _u(qrow["id"]), org)
            await _receipt_did_not_delete(con, org, p, qrow, name, reason, since, actor_id, actor_name, detail=detail)
    out["did_not_delete"].append(_dnd(qrow, name, reason, since))


async def _receipt_did_not_delete(con, org, p, qrow, name, reason, since, actor_id, actor_name, *, detail=None) -> None:
    await rdb.insert_receipt(
        con, org, "did_not_delete", document_id=qrow["latest_document_id"], document_name=name,
        policy_id=p.id, policy_name=p.name, actor_id=actor_id, actor_name=actor_name,
        detail={"reason": reason, "held_since": since.isoformat() if since else None, **(detail or {})},
    )


def _dnd(qrow, name, reason, since) -> dict:
    return {
        "document_id": str(qrow["latest_document_id"]), "name": name, "reason": reason,
        "held_since": since.isoformat() if since else None,
    }


async def _confirm_keep(pool, snap, p: PolicyFacts, qrow: dict, *, actor_id, actor_name, out) -> None:
    """D-11: skipped until the policy is edited or the document changes."""
    org = _u(snap.org_id)
    fam = snap.family(str(qrow["family_key"]))
    name = fam.name if fam else None
    async with pool.acquire() as con:
        async with con.transaction():
            await con.execute(
                "INSERT INTO public.retention_skips (org_id, policy_id, family_key, reason, policy_revision, "
                "fingerprint, actor_id, actor_name) VALUES ($1,$2,$3,'kept',$4,$5,$6,$7) "
                "ON CONFLICT (policy_id, family_key) DO UPDATE SET reason = 'kept', "
                "policy_revision = EXCLUDED.policy_revision, fingerprint = EXCLUDED.fingerprint, "
                "actor_id = EXCLUDED.actor_id, actor_name = EXCLUDED.actor_name, created_at = now()",
                org, _u(p.id), str(qrow["family_key"]), p.revision, str(qrow["fingerprint"]),
                _u(actor_id) if actor_id else None, actor_name,
            )
            await con.execute("DELETE FROM public.retention_queue WHERE id = $1 AND org_id = $2", _u(qrow["id"]), org)
            await rdb.insert_receipt(
                con, org, "kept", document_id=qrow["latest_document_id"], document_name=name,
                policy_id=p.id, policy_name=p.name, actor_id=actor_id, actor_name=actor_name,
                detail={"kind": str(qrow["kind"])},
            )
    out["kept"].append({"document_id": str(qrow["latest_document_id"]), "name": name})


async def _confirm_archive(pool, snap, p: PolicyFacts, qrow: dict, *, at, actor_id, actor_name, out) -> None:
    """D-10: a review decided "archive" by a person. A held family is skipped (held = untouched).

    275-REVIEW B-WR-07: the same re-check as Delete — the evaluator must still say this family is
    waiting for review under THIS policy, and in-transaction the revision, fingerprint and family
    membership must still match. Otherwise nothing is archived; the stale row is dropped with a
    ``did_not_delete`` receipt (``decision: archive``) and reported as skipped / ``changed``.
    """
    org = _u(snap.org_id)
    fam = snap.family(str(qrow["family_key"]))
    name = fam.name if fam else None

    def _skip(reason: str, shown: Optional[str]) -> None:
        out["skipped"].append({"document_id": str(qrow["latest_document_id"]), "name": shown, "reason": reason})

    async def _changed() -> None:
        await _did_not_delete(pool, org, p, qrow, name, "changed", None, actor_id, actor_name, {"did_not_delete": []},
                              detail={"decision": "archive"})
        _skip("changed", name)

    if fam is None:
        await _changed()
        return
    d = evaluate(fam, snap.ctx, at)
    if d.kind == "held":
        _skip("held", fam.name)
        return
    if not (d.kind == "pending" and d.policy_id == p.id and d.queue_kind == "review"):
        await _changed()
        return
    async with pool.acquire() as con:
        async with con.transaction():
            rc = await _recheck_in_tx(con, org, p, qrow, fam, name)
            if rc.status == "not_found":
                out["not_found"].append({"document_id": str(qrow["latest_document_id"]), "name": rc.name})
                return
            if rc.status == "held":
                _skip("held", rc.name)
                return
            if rc.status == "changed":
                await con.execute("DELETE FROM public.retention_queue WHERE id = $1 AND org_id = $2", rc.q["id"], org)
                await _receipt_did_not_delete(con, org, p, qrow, rc.name, "changed", None, actor_id, actor_name,
                                              detail={"decision": "archive"})
                _skip("changed", rc.name)
                return
            await con.execute(
                "UPDATE public.documents SET archived_at = $3, archived_policy_id = $4, archived_policy_name = $5 "
                "WHERE org_id = $1 AND id = ANY($2::uuid[]) AND archived_at IS NULL",
                org, rc.ids, at, _u(p.id), p.name,
            )
            await con.execute("DELETE FROM public.retention_queue WHERE id = $1 AND org_id = $2", rc.q["id"], org)
            await rdb.insert_receipt(
                con, org, "archived", document_id=fam.latest_id, document_name=fam.name,
                policy_id=p.id, policy_name=p.name, actor_id=actor_id, actor_name=actor_name,
                detail={"decided_by": actor_name},
            )
    out["archived"].append({"document_id": fam.latest_id, "name": fam.name})


def _latest_row(rows: list[dict]) -> Optional[dict]:
    if not rows:
        return None
    latest = [r for r in rows if r.get("is_latest")] or rows
    return max(latest, key=lambda r: (int(r.get("version_number") or 0), str(r["id"])))


def _day(value):
    if value is None:
        return None
    if isinstance(value, datetime):
        return (value.astimezone(timezone.utc) if value.tzinfo else value).date()
    return value


# ════════════════════════════════════════════════════════════════════════════════════════════
# Un-archive (D-19; revision B-NEW-1)
# ════════════════════════════════════════════════════════════════════════════════════════════

REMOVED_POLICY_NAME = "a removed policy"


async def unarchive_family(pool, org_id, document_id, *, actor_id, actor_name: str) -> dict:
    """Bring an archived family back. Clears ``archived_at``, ``archived_policy_id`` and
    ``archived_policy_name`` on every row, writes the ``unarchived`` receipt naming the snapshot, and
    writes a skip marker ONLY while the archiving policy still exists (a removed policy cannot
    re-archive anything)."""
    org = _u(org_id)
    async with pool.acquire() as con:
        async with con.transaction():
            head = await con.fetchrow(
                "SELECT user_id, filename, folder_id FROM public.documents WHERE id = $1 AND org_id = $2",
                _u(document_id), org,
            )
            if head is None:
                raise NotFound("Document not found.")
            rows = [dict(r) for r in await con.fetch(_FAMILY_ROWS_SQL, org, head["user_id"], head["filename"], head["folder_id"])]
            archived = [r for r in rows if r.get("archived_at") is not None]
            if not archived:
                raise DispositionError("This document is not archived.")
            info = await con.fetchrow(
                "SELECT archived_policy_id, archived_policy_name FROM public.documents "
                "WHERE org_id = $1 AND id = ANY($2::uuid[]) AND archived_at IS NOT NULL "
                "ORDER BY is_latest DESC, version_number DESC LIMIT 1",
                org, [r["id"] for r in rows],
            )
            pid = info["archived_policy_id"] if info else None
            snapshot_name = (info["archived_policy_name"] if info else None) or REMOVED_POLICY_NAME
            await con.execute(
                "UPDATE public.documents SET archived_at = NULL, archived_policy_id = NULL, archived_policy_name = NULL "
                "WHERE org_id = $1 AND id = ANY($2::uuid[])",
                org, [r["id"] for r in rows],
            )
            latest = _latest_row(rows)
            skip_written = False
            if pid is not None:
                pol = await con.fetchrow(
                    "SELECT id, revision, clock FROM public.retention_policies WHERE id = $1 AND org_id = $2",
                    pid, org,
                )
                if pol is not None and latest is not None:
                    clock = latest["date_typed"] if pol["clock"] == "document_date" else _day(latest["created_at"])
                    fp = fingerprint(str(latest["id"]), clock, str(latest["folder_id"]) if latest["folder_id"] else None, latest["document_type_norm"])
                    key = family_key_of(head["user_id"], str(head["folder_id"]) if head["folder_id"] else None, head["filename"])
                    await con.execute(
                        "INSERT INTO public.retention_skips (org_id, policy_id, family_key, reason, policy_revision, "
                        "fingerprint, actor_id, actor_name) VALUES ($1,$2,$3,'unarchived',$4,$5,$6,$7) "
                        "ON CONFLICT (policy_id, family_key) DO UPDATE SET reason = 'unarchived', "
                        "policy_revision = EXCLUDED.policy_revision, fingerprint = EXCLUDED.fingerprint, "
                        "actor_id = EXCLUDED.actor_id, actor_name = EXCLUDED.actor_name, created_at = now()",
                        org, pol["id"], key, int(pol["revision"]), fp, _u(actor_id) if actor_id else None, actor_name,
                    )
                    skip_written = True
            await rdb.insert_receipt(
                con, org, "unarchived", document_id=latest["id"] if latest else _u(document_id),
                document_name=str(head["filename"]), policy_id=pid if skip_written else None,
                policy_name=snapshot_name, actor_id=actor_id, actor_name=actor_name,
                detail={"rows": len(rows), "policy_removed": pid is None},
            )
    return {
        "document_id": str(document_id),
        "name": str(head["filename"]),
        "policy_name": snapshot_name,
        "skip_written": skip_written,
    }


def iter_decisions(snap: OrgSnapshot, at: datetime) -> Iterable[tuple[Any, Decision]]:
    """Every family with its decision — the shared walk for summaries and document-states."""
    for fam in snap.families:
        yield fam, evaluate(fam, snap.ctx, at)
