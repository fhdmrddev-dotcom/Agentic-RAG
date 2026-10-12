"""Phase 275 (RET-01 / RET-03 / D-02 / D-28 / D-31) — data-access home for the retention tables.

The nightly sweep claim (the watch pattern, ``db/watches.py``) and the service-pool WRITE verbs the
``/retention`` router calls after its gates.

Key invariants:
1. ``claim_due_retention_sweeps`` uses ``SELECT … FOR UPDATE SKIP LOCKED`` inside an explicit
   transaction and advances ``next_run_at`` to the next 02:00 UTC and sets the lease BEFORE commit,
   so two uvicorn workers never sweep one org twice (D-31, T-275-26). The workflow scheduler is not
   involved and is not imported.
2. ``release_retention_sweep`` is the ONE place a sweep's terminal status is written — every arm
   (ok / incomplete / failed) records it through here, so a new arm cannot forget.
3. Every statement binds ``org_id``. The pool is the service role (BYPASSRLS); the explicit org
   predicate is the wall (T-275-20). The poller is the only caller without a request identity.
4. Policy create / update / delete and hold release are written HERE, through the service pool,
   only after the router has run ``require_org_manage`` and its in-code checks (revision W-2): the
   database makes ``revision`` / ``previewed_revision`` / ``released_*`` service-role-only.
5. Nothing in this module deletes a document. The one document delete in the codebase's retention
   code lives in ``services/retention/disposition.confirm_batch`` (D-08).

asyncpg only (D-v2.5-01 does not apply: every statement is awaited).
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, time, timedelta, timezone
from typing import Any, Iterable, Optional
from uuid import UUID

logger = logging.getLogger(__name__)

#: The nightly sweep hour (UTC). A code constant — one env var only ships (D-37).
SWEEP_HOUR_UTC = 2
#: How often the poller looks for a due org.
POLL_INTERVAL_SECONDS = 300
#: How long a claimed org is leased to one worker.
LEASE_SECONDS = 900
#: How long a preview stays valid for Save (D-02).
PREVIEW_TTL_MINUTES = 30

SWEEP_ACTOR_NAME = "Nightly sweep"


def _uuid(v: Any) -> UUID:
    return v if isinstance(v, UUID) else UUID(str(v))


def _jsonable(value: Any) -> Any:
    """A plain JSON value for a ``jsonb`` parameter. The pool's codec encodes it ONCE (encoding here
    as well would store a JSON string, not an object)."""
    return json.loads(json.dumps(value, default=str))


def next_sweep_at(now: datetime) -> datetime:
    """The next ``SWEEP_HOUR_UTC``:00 UTC strictly after ``now``."""
    now = now.astimezone(timezone.utc) if now.tzinfo else now.replace(tzinfo=timezone.utc)
    today = datetime.combine(now.date(), time(SWEEP_HOUR_UTC, 0), tzinfo=timezone.utc)
    return today if now < today else today + timedelta(days=1)


def _now(now: Optional[datetime]) -> datetime:
    return now if now is not None else datetime.now(timezone.utc)


# ── the sweep claim (D-31) ──────────────────────────────────────────────────────────────────

async def seed_sweep_row(con_or_pool, org_id, *, now: Optional[datetime] = None) -> None:
    """One claim row per org with a policy; created on policy save. Idempotent."""
    await con_or_pool.execute(
        "INSERT INTO public.retention_sweeps (org_id, next_run_at) VALUES ($1, $2) "
        "ON CONFLICT (org_id) DO NOTHING",
        _uuid(org_id),
        next_sweep_at(_now(now)),
    )


async def claim_due_retention_sweeps(
    pool,
    *,
    limit: int = 5,
    lease_seconds: int = LEASE_SECONDS,
    now: Optional[datetime] = None,
) -> list[dict]:
    """Atomically claim due orgs with FOR UPDATE SKIP LOCKED.

    Inside the transaction: lock due rows whose lease is free, set the lease, advance
    ``next_run_at`` to the next 02:00 UTC (so a crash cannot re-fire it tonight), and mark
    ``last_status = 'running'``.
    """
    at = _now(now)
    claimed: list[dict] = []
    async with pool.acquire() as con:
        async with con.transaction():
            due = await con.fetch(
                """
                SELECT org_id, next_run_at, last_run_at, last_status
                FROM public.retention_sweeps
                WHERE next_run_at <= $2
                  AND (leased_until IS NULL OR leased_until < $2)
                ORDER BY next_run_at
                LIMIT $1
                FOR UPDATE SKIP LOCKED
                """,
                limit,
                at,
            )
            for row in due:
                record = dict(row)
                await con.execute(
                    """
                    UPDATE public.retention_sweeps
                    SET leased_until = $2,
                        next_run_at = $3,
                        last_status = 'running'
                    WHERE org_id = $1
                    """,
                    record["org_id"],
                    at + timedelta(seconds=lease_seconds),
                    next_sweep_at(at),
                )
                claimed.append(record)
    return claimed


async def claim_org_sweep_now(pool, org_id, *, lease_seconds: int = LEASE_SECONDS, now: Optional[datetime] = None) -> bool:
    """Run-now: lease ONE org if no worker holds it. ``next_run_at`` is left alone."""
    at = _now(now)
    async with pool.acquire() as con:
        async with con.transaction():
            await seed_sweep_row(con, org_id, now=at)
            row = await con.fetchrow(
                """
                UPDATE public.retention_sweeps
                SET leased_until = $2, last_status = 'running'
                WHERE org_id = $1 AND (leased_until IS NULL OR leased_until < $3)
                RETURNING org_id
                """,
                _uuid(org_id),
                at + timedelta(seconds=lease_seconds),
                at,
            )
    return row is not None


async def release_retention_sweep(
    pool,
    org_id,
    *,
    status: str,
    error: Optional[str] = None,
    counts: Optional[dict] = None,
) -> None:
    """Clear the lease and write the terminal outcome in ONE place (ok / incomplete / failed)."""
    if status not in ("ok", "incomplete", "failed"):
        raise ValueError(f"unknown sweep status {status!r}")
    await pool.execute(
        """
        UPDATE public.retention_sweeps
        SET leased_until = NULL,
            last_run_at = now(),
            last_status = $2,
            last_error = $3,
            last_counts = $4::jsonb
        WHERE org_id = $1
        """,
        _uuid(org_id),
        status,
        error,
        _jsonable(counts or {}),
    )


async def read_sweep_row(pool, org_id) -> Optional[dict]:
    row = await pool.fetchrow(
        "SELECT org_id, next_run_at, leased_until, last_run_at, last_status, last_error, last_counts "
        "FROM public.retention_sweeps WHERE org_id = $1",
        _uuid(org_id),
    )
    return dict(row) if row else None


# ── receipts ────────────────────────────────────────────────────────────────────────────────

RECEIPT_COLUMNS = (
    "org_id", "action", "document_id", "document_name", "policy_id", "policy_name",
    "hold_id", "hold_name", "actor_id", "actor_name", "detail",
)
_RECEIPT_SQL = (
    "INSERT INTO public.retention_receipts (org_id, action, document_id, document_name, policy_id, "
    "policy_name, hold_id, hold_name, actor_id, actor_name, detail) "
    "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)"
)


def receipt_args(org_id, action: str, **kw) -> tuple:
    def u(v):
        return _uuid(v) if v else None

    return (
        _uuid(org_id), action, u(kw.get("document_id")), kw.get("document_name"), u(kw.get("policy_id")),
        kw.get("policy_name"), u(kw.get("hold_id")), kw.get("hold_name"), u(kw.get("actor_id")),
        kw.get("actor_name"), _jsonable(kw.get("detail") or {}),
    )


async def insert_receipts(con_or_pool, rows: Iterable[tuple]) -> int:
    rows = list(rows)
    if rows:
        await con_or_pool.executemany(_RECEIPT_SQL, rows)
    return len(rows)


async def insert_receipt(con_or_pool, org_id, action: str, **kw) -> None:
    await con_or_pool.execute(_RECEIPT_SQL, *receipt_args(org_id, action, **kw))


async def list_receipts(pool, org_id, *, offset: int, limit: int) -> list[dict]:
    rows = await pool.fetch(
        "SELECT id, action, document_id, document_name, policy_id, policy_name, hold_id, hold_name, "
        "actor_id, actor_name, detail, created_at FROM public.retention_receipts "
        "WHERE org_id = $1 ORDER BY created_at DESC, id DESC OFFSET $2 LIMIT $3",
        _uuid(org_id), offset, limit,
    )
    return [dict(r) for r in rows]


# ── previews (D-02) ─────────────────────────────────────────────────────────────────────────

async def record_preview(pool, org_id, *, policy_id, draft_hash: str, created_by, counts: dict) -> None:
    await pool.execute(
        "INSERT INTO public.retention_previews (org_id, policy_id, draft_hash, created_by, counts) "
        "VALUES ($1, $2, $3, $4, $5::jsonb)",
        _uuid(org_id), _uuid(policy_id) if policy_id else None, draft_hash,
        _uuid(created_by) if created_by else None, _jsonable(counts),
    )


async def fresh_preview_exists(pool, org_id, draft_hash: str, *, minutes: int = PREVIEW_TTL_MINUTES) -> bool:
    """A preview of exactly this draft, in this org, no older than ``minutes``."""
    found = await pool.fetchval(
        "SELECT EXISTS (SELECT 1 FROM public.retention_previews WHERE org_id = $1 AND draft_hash = $2 "
        "AND created_at >= now() - ($3 || ' minutes')::interval)",
        _uuid(org_id), draft_hash, str(minutes),
    )
    return found is True


# ── policies (service pool, after require_org_manage + in-code checks; W-2) ─────────────────

_POLICY_COLUMNS = (
    "id, org_id, name, scope_kind, folder_id, include_subfolders, document_type_norm, clock, "
    "stage1_value, stage1_unit, stage1_action, stage2_value, stage2_unit, stage2_action, revision, "
    "previewed_revision, created_by, created_by_name, updated_by, updated_by_name, created_at, updated_at"
)


async def folder_org(pool, folder_id) -> Optional[str]:
    org = await pool.fetchval("SELECT org_id FROM public.folders WHERE id = $1", _uuid(folder_id))
    return str(org) if org else None


async def get_policy(pool, org_id, policy_id) -> Optional[dict]:
    row = await pool.fetchrow(
        f"SELECT {_POLICY_COLUMNS} FROM public.retention_policies WHERE id = $1 AND org_id = $2",
        _uuid(policy_id), _uuid(org_id),
    )
    return dict(row) if row else None


async def insert_policy(pool, org_id, draft: dict, *, actor_id, actor_name: str, now: Optional[datetime] = None) -> dict:
    """Create a policy at revision 1, previewed at revision 1 (the caller proved the preview)."""
    async with pool.acquire() as con:
        async with con.transaction():
            row = await con.fetchrow(
                f"""
                INSERT INTO public.retention_policies (
                    org_id, name, scope_kind, folder_id, include_subfolders, document_type_norm, clock,
                    stage1_value, stage1_unit, stage1_action, stage2_value, stage2_unit, stage2_action,
                    revision, previewed_revision, created_by, created_by_name, updated_by, updated_by_name)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, 1, 1, $14, $15, $14, $15)
                RETURNING {_POLICY_COLUMNS}
                """,
                _uuid(org_id), draft["name"], draft["scope_kind"],
                _uuid(draft["folder_id"]) if draft.get("folder_id") else None,
                bool(draft.get("include_subfolders", True)), draft.get("document_type_norm"), draft["clock"],
                draft["stage1_value"], draft["stage1_unit"], draft["stage1_action"],
                draft.get("stage2_value"), draft.get("stage2_unit"), draft.get("stage2_action"),
                _uuid(actor_id) if actor_id else None, actor_name,
            )
            policy = dict(row)
            await insert_receipt(
                con, org_id, "policy_saved", policy_id=policy["id"], policy_name=policy["name"],
                actor_id=actor_id, actor_name=actor_name, detail={"revision": 1, "created": True},
            )
            await seed_sweep_row(con, org_id, now=now)
    return policy


async def update_policy(pool, org_id, policy_id, draft: dict, *, rule_changed: bool, actor_id, actor_name: str) -> Optional[dict]:
    """Update a policy; a rule or scope change bumps ``revision`` (re-opening kept families, D-11).

    ``previewed_revision`` is set to the new revision — the caller proved a fresh preview of exactly
    this draft (D-02). Row org == active org is part of the WHERE.
    """
    async with pool.acquire() as con:
        async with con.transaction():
            row = await con.fetchrow(
                f"""
                UPDATE public.retention_policies
                SET name = $3, scope_kind = $4, folder_id = $5, include_subfolders = $6,
                    document_type_norm = $7, clock = $8, stage1_value = $9, stage1_unit = $10,
                    stage1_action = $11, stage2_value = $12, stage2_unit = $13, stage2_action = $14,
                    revision = revision + (CASE WHEN $15 THEN 1 ELSE 0 END),
                    previewed_revision = revision + (CASE WHEN $15 THEN 1 ELSE 0 END),
                    updated_by = $16, updated_by_name = $17, updated_at = now()
                WHERE id = $1 AND org_id = $2
                RETURNING {_POLICY_COLUMNS}
                """,
                _uuid(policy_id), _uuid(org_id), draft["name"], draft["scope_kind"],
                _uuid(draft["folder_id"]) if draft.get("folder_id") else None,
                bool(draft.get("include_subfolders", True)), draft.get("document_type_norm"), draft["clock"],
                draft["stage1_value"], draft["stage1_unit"], draft["stage1_action"],
                draft.get("stage2_value"), draft.get("stage2_unit"), draft.get("stage2_action"),
                bool(rule_changed), _uuid(actor_id) if actor_id else None, actor_name,
            )
            if row is None:
                return None
            policy = dict(row)
            await insert_receipt(
                con, org_id, "policy_saved", policy_id=policy["id"], policy_name=policy["name"],
                actor_id=actor_id, actor_name=actor_name,
                detail={"revision": policy["revision"], "rule_changed": bool(rule_changed)},
            )
    return policy


async def delete_policy(pool, org_id, policy_id, *, actor_id, actor_name: str) -> Optional[dict]:
    """Remove a policy. No document is deleted; its queue rows and skip markers cascade away, and a
    document it archived keeps ``archived_policy_name`` (B-NEW-1)."""
    async with pool.acquire() as con:
        async with con.transaction():
            row = await con.fetchrow(
                "DELETE FROM public.retention_policies WHERE id = $1 AND org_id = $2 RETURNING id, name",
                _uuid(policy_id), _uuid(org_id),
            )
            if row is None:
                return None
            await insert_receipt(
                con, org_id, "policy_deleted", policy_id=None, policy_name=row["name"],
                actor_id=actor_id, actor_name=actor_name, detail={"policy_id": str(row["id"])},
            )
    return dict(row)


# ── holds ───────────────────────────────────────────────────────────────────────────────────

async def release_hold(pool, org_id, hold_id, *, actor_id, actor_name: str, note: Optional[str], released_count: int) -> Optional[dict]:
    """Release (never delete) a hold, through the service pool (W-2: released_* are service-only)."""
    async with pool.acquire() as con:
        async with con.transaction():
            row = await con.fetchrow(
                """
                UPDATE public.legal_holds
                SET released_at = now(), released_by = $3, released_by_name = $4, release_note = $5
                WHERE id = $1 AND org_id = $2 AND released_at IS NULL
                RETURNING id, name, released_at
                """,
                _uuid(hold_id), _uuid(org_id), _uuid(actor_id) if actor_id else None, actor_name, note,
            )
            if row is None:
                return None
            await insert_receipt(
                con, org_id, "hold_released", hold_id=row["id"], hold_name=row["name"],
                actor_id=actor_id, actor_name=actor_name,
                detail={"released_count": released_count, "note": note},
            )
    return dict(row)


async def get_hold(pool, org_id, hold_id) -> Optional[dict]:
    row = await pool.fetchrow(
        "SELECT id, org_id, name, reason, created_by_name, created_at, released_at, released_by_name, "
        "release_note FROM public.legal_holds WHERE id = $1 AND org_id = $2",
        _uuid(hold_id), _uuid(org_id),
    )
    return dict(row) if row else None


async def list_holds(pool, org_id) -> list[dict]:
    rows = await pool.fetch(
        "SELECT h.id, h.name, h.reason, h.created_by_name, h.created_at, h.released_at, h.released_by_name, "
        "h.release_note, "
        "(SELECT count(*) FROM public.legal_hold_documents d WHERE d.hold_id = h.id) AS document_count, "
        "COALESCE((SELECT array_agg(f.folder_id) FROM public.legal_hold_folders f WHERE f.hold_id = h.id), "
        "'{}'::uuid[]) AS folder_ids "
        "FROM public.legal_holds h WHERE h.org_id = $1 ORDER BY h.released_at IS NOT NULL, h.created_at DESC",
        _uuid(org_id),
    )
    return [dict(r) for r in rows]


async def count_policies_and_holds(pool, org_id) -> dict:
    row = await pool.fetchrow(
        "SELECT (SELECT count(*) FROM public.retention_policies WHERE org_id = $1) AS policies, "
        "(SELECT count(*) FROM public.legal_holds WHERE org_id = $1 AND released_at IS NULL) AS active_holds, "
        "(SELECT count(*) FROM public.retention_queue WHERE org_id = $1) AS waiting",
        _uuid(org_id),
    )
    return {k: int(row[k] or 0) for k in ("policies", "active_holds", "waiting")} if row else {
        "policies": 0, "active_holds": 0, "waiting": 0,
    }
