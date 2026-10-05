"""asyncpg-backed helpers for public.message_artifacts (Phase 273 — migration 202, I-5, UI-D-03).

Dual-caller "pool" contract (the db/workspace.py shape): reads take a first positional ``pool`` and
call only ``.fetchrow`` / ``.fetch``, so they are duck-typed over an asyncpg ``Pool`` and a
``Connection``. ``insert_artifact`` needs a transaction for its label lock and therefore calls
``pool.acquire()`` — it is a POOL-only helper (the agent / producer path via ``ctx.pool``).

SECURITY (T-273-08): every value is bound with a ``$N`` positional placeholder. No f-string or
string-formatting method is ever applied to a SQL string here.

⛔ SECURITY (Pitfall 11 / T-273-04): the pool connects as ``postgres`` and BYPASSES RLS. A lookup by
artifact id alone would let a prompt-injected model read another person's artifact, so EVERY read
binds ``thread_id`` AND ``user_id``, and a reference that is neither a well-formed id nor a
well-formed label returns ``None`` without a query.

Immutability (D-08): this module never modifies a stored row — the table has no client write path,
no role holds the privilege, and a BEFORE trigger refuses it.

Org posture (the db/runs.py 268 pattern): ``insert_artifact`` takes an optional ``org_id``. The
caller passes the validated active org (``current_user.get("org_id")``) when it has one; ``None``
falls to the ``autofill_org_id_by_owner('user_id')`` trigger, exactly as public.messages.

The returned dict is the WIRE CONTRACT (Pattern 4 / I-2): the ``RETURNING`` row made JSON-safe —
emit THIS, never a Python-built copy, so the live SSE event equals what reload reads back.
"""

from __future__ import annotations

import json
import secrets
from datetime import date, datetime
from typing import Any
from uuid import UUID

import asyncpg

from app.models.artifact import ARTIFACT_COMPONENTS, ARTIFACT_ID_RE, ARTIFACT_LABEL_RE

_ID_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz"
_PK_CONSTRAINT = "message_artifacts_pkey"
# The second hashtextextended argument is a fixed seed (the phase number) so this lock space is
# this table's alone.
_LOCK_SQL = "SELECT pg_advisory_xact_lock(hashtextextended($1::text, 273))"

_NEXT_ORDINAL_SQL = """
    SELECT COALESCE(MAX(split_part(label, ' ', 2)::int), 0) + 1
    FROM public.message_artifacts
    WHERE thread_id = $1 AND component = $2
"""

_INSERT_SQL = """
    INSERT INTO public.message_artifacts
        (id, thread_id, user_id, org_id, run_id, tool_call_id, parent_id,
         label, component, spec, caption, row_count)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *
"""

_BY_REF_SQL = """
    SELECT *
    FROM public.message_artifacts
    WHERE (id = $1 OR label = $1) AND thread_id = $2 AND user_id = $3
    LIMIT 1
"""

_LABELS_SQL = """
    SELECT label
    FROM public.message_artifacts
    WHERE thread_id = $1 AND user_id = $2
    ORDER BY created_at, label
"""


def new_artifact_id() -> str:
    """``a_`` + 10 characters of ``[0-9a-z]`` from ``secrets`` (≈ 51.7 bits)."""
    return "a_" + "".join(secrets.choice(_ID_ALPHABET) for _ in range(10))


def _uuid(v: Any) -> UUID | None:
    if v is None:
        return None
    return v if isinstance(v, UUID) else UUID(str(v))


def _jsonable(v: Any) -> Any:
    if isinstance(v, UUID):
        return str(v)
    if isinstance(v, (datetime, date)):
        return v.isoformat()
    if isinstance(v, dict):
        return {k: _jsonable(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [_jsonable(x) for x in v]
    return v


def _row_out(row: Any) -> dict:
    out = _jsonable(dict(row))
    # Belt: a pool without the jsonb codec returns text. The production pool registers it
    # (dependencies._init_pg_connection), so this is a no-op there.
    for key in ("spec", "caption"):
        if isinstance(out.get(key), str):
            out[key] = json.loads(out[key])
    return out


async def insert_artifact(
    pool: asyncpg.Pool,
    *,
    thread_id: UUID | str,
    user_id: UUID | str,
    org_id: UUID | str | None,
    run_id: UUID | str | None,
    tool_call_id: str | None,
    parent_id: str | None,
    component: str,
    spec: dict,
    caption: dict,
    row_count: int,
) -> dict:
    """Store one artifact and return its RETURNING row as a JSON-safe dict.

    The label (``<component> <n>``) is numbered per component per thread inside the same
    transaction that inserts it, under ``pg_advisory_xact_lock`` keyed on the thread, so two
    concurrent emissions in one thread can never draw the same number (UNIQUE (thread_id, label)
    is the belt). A primary-key collision on the random id is retried ONCE with a fresh id; any
    other violation propagates.

    ``spec`` / ``caption`` are passed as dicts — the pool's jsonb codec encodes them.
    """
    if component not in ARTIFACT_COMPONENTS:
        raise ValueError("component must be one of chart, table, metric")
    t_id = _uuid(thread_id)
    u_id = _uuid(user_id)
    o_id = _uuid(org_id)
    r_id = _uuid(run_id)

    for attempt in range(2):
        art_id = new_artifact_id()
        try:
            async with pool.acquire() as conn:
                async with conn.transaction():
                    await conn.execute(_LOCK_SQL, str(t_id))
                    ordinal = await conn.fetchval(_NEXT_ORDINAL_SQL, t_id, component)
                    label = component + " " + str(int(ordinal))
                    row = await conn.fetchrow(
                        _INSERT_SQL,
                        art_id, t_id, u_id, o_id, r_id, tool_call_id, parent_id,
                        label, component, spec, caption, row_count,
                    )
            return _row_out(row)
        except asyncpg.exceptions.UniqueViolationError as exc:
            if attempt == 0 and getattr(exc, "constraint_name", None) == _PK_CONSTRAINT:
                continue
            raise
    raise RuntimeError("unreachable")  # pragma: no cover


def _normalise_ref(ref: Any) -> str | None:
    if not isinstance(ref, str):
        return None
    r = ref.strip().lower()
    if ARTIFACT_ID_RE.fullmatch(r) or ARTIFACT_LABEL_RE.fullmatch(r):
        return r
    return None


async def get_artifact_by_ref(
    pool: asyncpg.Pool,
    *,
    ref: Any,
    thread_id: UUID | str,
    user_id: UUID | str,
) -> dict | None:
    """The artifact named by id (``a_…``) or label (``chart 1``) IN THIS THREAD FOR THIS USER.

    A malformed reference returns ``None`` without a query (Pitfall 11). The label alias exists
    because a long thread can trim the id out of the model's context (Pitfall 12).
    """
    r = _normalise_ref(ref)
    if r is None:
        return None
    row = await pool.fetchrow(_BY_REF_SQL, r, _uuid(thread_id), _uuid(user_id))
    return _row_out(row) if row else None


async def list_thread_labels(
    pool: asyncpg.Pool,
    *,
    thread_id: UUID | str,
    user_id: UUID | str,
) -> list[str]:
    """Every label shown in this thread for this user, in creation order (for an unknown-ref hint)."""
    rows = await pool.fetch(_LABELS_SQL, _uuid(thread_id), _uuid(user_id))
    return [r["label"] for r in rows]
