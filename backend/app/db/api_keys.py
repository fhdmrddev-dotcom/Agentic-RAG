"""Phase 293 (START-02; D-01..D-06, D-17, D-19) — every read and write of ``api_keys``.

The ONE data-access home for API keys. Nothing outside this module writes the table, and the API
layer never composes SQL.

⚠ **THE OWNER PREDICATE IS IN EVERY STATEMENT, INCLUDING THE ONES THAT ALREADY HAVE AN ID.**
These queries run on the **service-role asyncpg pool**, which is ``BYPASSRLS`` — migration 215's
SELECT policy is the belt, and *this file is the braces*. A ``WHERE id = $1`` with no
``AND org_id = $2`` is a cross-tenant read of somebody else's key. The single exception is
``get_key_for_auth``: it is the inbound door's lookup, run BEFORE anyone is known — the presented
key IS the identity — so it is deliberately owner-agnostic, and it is the only function here
whose docstring says so.

⚠ **``workflows`` IS BOUND AS A PLAIN ``list``.** The pool registers a jsonb codec
(``dependencies.py:_init_pg_connection``), so ``json.dumps`` at a call site would store a jsonb
**string scalar** — the defect migration 123 had to repair. There is no ``json`` import in this
module and there must not be one.

⚠ **THE DIGEST NEVER LEAVES THIS MODULE TOWARD A CLIENT.** ``_KEY_COLUMNS`` (every list and
revoke) leaves ``key_hash`` out; only ``_AUTH_COLUMNS`` (the resolver's lookup) carries it. That
is the code-side twin of migration 215's column-level grant (T-293-02).

⚠ **THE THREE-PLACE LOCKSTEP.** ``_KEY_COLUMNS`` below, ``ApiKeyRead`` in ``models/api_key.py``
and the API's serializer in ``api/api_keys.py`` move in ONE commit. ``response_model`` drops
undeclared keys **silently**.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any
from uuid import UUID

import asyncpg

logger = logging.getLogger(__name__)

_KEY_COLUMN_NAMES = (
    "id", "org_id", "user_id", "label", "key_prefix", "workflows", "expires_at",
    "revoked_at", "revoked_by", "last_used_at", "created_at",
)

# The client-facing projection. NEVER `select *` — see the module docblock.
_KEY_COLUMNS = ", ".join(_KEY_COLUMN_NAMES)

# The resolver's projection: the client columns plus the digest it compares in constant time.
_AUTH_COLUMNS = _KEY_COLUMNS + ", key_hash"

_LABEL_INDEX = "api_keys_owner_label_active_uq"


class DuplicateKeyLabel(Exception):
    """The member already has an ACTIVE key with this label (``api_keys_owner_label_active_uq``)."""


async def create_api_key(
    pool: asyncpg.Pool,
    *,
    org_id: UUID,
    user_id: UUID,
    label: str,
    key_prefix: str,
    key_hash: str,
    workflows: list[dict[str, Any]],
    expires_at: datetime | None,
) -> dict:
    """Insert one key and return its CLIENT projection (never the digest).

    ``org_id`` is BOUND, not left to the ``autofill_org_id_by_owner`` trigger: a member of two
    orgs must get a key in the org they were acting in, and the trigger's ``LIMIT 1`` lookup
    would guess.
    """
    try:
        row = await pool.fetchrow(
            f"INSERT INTO api_keys "
            f"(org_id, user_id, label, key_prefix, key_hash, workflows, expires_at) "
            f"VALUES ($1, $2, $3, $4, $5, $6, $7) "
            f"RETURNING {_KEY_COLUMNS}",
            org_id,
            user_id,
            label,
            key_prefix,
            key_hash,
            workflows,  # plain list — the pool's jsonb codec encodes it (see the module docblock)
            expires_at,
        )
    except asyncpg.UniqueViolationError as exc:
        if getattr(exc, "constraint_name", None) == _LABEL_INDEX:
            raise DuplicateKeyLabel(label) from exc
        raise
    return dict(row)


def _named_columns() -> str:
    cols = ", ".join(f"k.{c}" for c in _KEY_COLUMN_NAMES)
    return f"{cols}, po.display_name AS owner_name, pr.display_name AS revoked_by_name"


_NAME_JOINS = (
    "LEFT JOIN profiles po ON po.id = k.user_id "
    "LEFT JOIN profiles pr ON pr.id = k.revoked_by "
)


async def list_keys_for_owner(pool: asyncpg.Pool, *, org_id: UUID, user_id: UUID) -> list[dict]:
    """Every key this member owns in this org, newest first (revoked and expired included), with
    the revoker's display name (an admin may have revoked it)."""
    rows = await pool.fetch(
        f"SELECT {_named_columns()} FROM api_keys k {_NAME_JOINS}"
        f"WHERE k.org_id = $1 AND k.user_id = $2 "
        f"ORDER BY k.created_at DESC",
        org_id,
        user_id,
    )
    return [dict(r) for r in rows]


async def list_keys_for_org(pool: asyncpg.Pool, *, org_id: UUID) -> list[dict]:
    """Every key in this org, with the owner's and the revoker's display names (D-03, admin)."""
    rows = await pool.fetch(
        f"SELECT {_named_columns()} FROM api_keys k {_NAME_JOINS}"
        f"WHERE k.org_id = $1 "
        f"ORDER BY k.created_at DESC",
        org_id,
    )
    return [dict(r) for r in rows]


async def get_key_for_auth(pool: asyncpg.Pool, key_hash: str) -> dict | None:
    """The resolver's lookup, by digest. ⚠ OWNER-AGNOSTIC BY DESIGN — the one statement here
    without an ``org_id`` / ``user_id`` predicate.

    Nobody is known yet when it runs: the presented key IS the identity. The unique index on
    ``key_hash`` makes it one row or none. Every live-state check (revoked, expired, membership,
    ban) happens in ``security/api_key_auth.resolve_api_key`` on the row this returns.
    """
    row = await pool.fetchrow(
        f"SELECT {_AUTH_COLUMNS} FROM api_keys WHERE key_hash = $1",
        key_hash,
    )
    return dict(row) if row is not None else None


async def revoke_key(
    pool: asyncpg.Pool,
    *,
    key_id: UUID,
    org_id: UUID,
    owner_id: UUID | None,
    revoked_by: UUID,
) -> dict | None:
    """Revoke one key. ``None`` for a miss AND for a key outside the caller's scope.

    ``owner_id`` is the member path's scope (their own keys only). ``None`` is the ADMIN path
    only (``/org/api-keys``, behind ``require_org_manage``): org-scoped, any owner.

    An already-revoked key is returned UNCHANGED — the UPDATE matches live keys only, so a second
    revoke can never overwrite who revoked it first, or when.

    Two statements, not a data-modifying CTE: an outer SELECT cannot see its own CTE's UPDATE of
    the same table, and the read-back must carry the revoker's NEW name.
    """
    if owner_id is None:
        scope, args = "id = $1 AND org_id = $2", (key_id, org_id)
        k_scope = "k.id = $1 AND k.org_id = $2"
    else:
        scope, args = "id = $1 AND org_id = $2 AND user_id = $3", (key_id, org_id, owner_id)
        k_scope = "k.id = $1 AND k.org_id = $2 AND k.user_id = $3"
    by = f"${len(args) + 1}"
    await pool.execute(
        f"UPDATE api_keys SET revoked_at = now(), revoked_by = {by} "
        f"WHERE {scope} AND revoked_at IS NULL",
        *args,
        revoked_by,
    )
    row = await pool.fetchrow(
        f"SELECT {_named_columns()} FROM api_keys k {_NAME_JOINS}WHERE {k_scope}",
        *args,
    )
    return dict(row) if row is not None else None


async def touch_last_used(pool: asyncpg.Pool, key_id: UUID, *, org_id: UUID) -> None:
    """Record an accepted call — at most once per 30 seconds per key, so a busy key is not a
    write per call. Org-scoped like every other statement here, even though the resolver has
    just read this exact row."""
    await pool.execute(
        "UPDATE api_keys SET last_used_at = now() "
        "WHERE id = $1 AND org_id = $2 "
        "AND (last_used_at IS NULL OR last_used_at < now() - interval '30 seconds')",
        key_id,
        org_id,
    )


async def is_org_member(pool: asyncpg.Pool, *, org_id: UUID, user_id: UUID) -> bool:
    """Is the key's owner STILL a member of the key's org? Read live, never cached: a member who
    is removed loses every key on the next call (D-05)."""
    value = await pool.fetchval(
        "SELECT 1 FROM org_members WHERE org_id = $1 AND user_id = $2 LIMIT 1",
        org_id,
        user_id,
    )
    return value is not None


async def list_key_calls(
    pool: asyncpg.Pool, *, org_id: UUID, key_ids: list[str], since: datetime
) -> list[dict]:
    """The recent CALLS made with these keys (start / read / refused), newest first (D-17).

    Read from ``audit_log`` — the activity record is the audit record, so there is no second
    table to drift. Management rows (create / revoke) are not calls and are left out. The
    expression index ``audit_log_api_key_id_idx`` (migration 215) serves the ``api_key_id`` match.
    """
    if not key_ids:
        return []
    rows = await pool.fetch(
        "SELECT action_type, metadata, created_at FROM audit_log "
        "WHERE org_id = $1 AND action_type LIKE 'api_key.%' "
        "AND action_type NOT IN ('api_key.create','api_key.revoke') "
        "AND metadata->>'api_key_id' = ANY($2) AND created_at > $3 "
        "ORDER BY created_at DESC LIMIT 600",
        org_id,
        key_ids,
        since,
    )
    return [dict(r) for r in rows]


# ── the workflows a key names (read for create, list and the picker) ──────────────────────────
#
# ⚠ The readability predicate below is ``db/workflows.get_definition``'s, PLUS the org: a key
#   belongs to one org (D-01), so the caller's own workflow counts only in the org they are acting
#   in. A workflow outside it reads exactly like one that does not exist.
_READABLE_SQL = (
    "((created_by = $2 AND org_id = $3) OR (is_system_global = true AND status = 'published'))"
)


async def get_key_workflows(
    pool: asyncpg.Pool, *, workflow_ids: list[UUID], user_id: UUID, org_id: UUID
) -> list[dict]:
    """One row per EXISTING id: ``{id, readable, name, status, definition}``.

    A row the caller may not read comes back with ``readable = false`` and every content column
    NULL, so a route can tell "deleted" (absent) from "you can no longer run it" without this
    function ever returning someone else's workflow content.
    """
    if not workflow_ids:
        return []
    rows = await pool.fetch(
        f"SELECT id, {_READABLE_SQL} AS readable, "
        f"CASE WHEN {_READABLE_SQL} THEN name END AS name, "
        f"CASE WHEN {_READABLE_SQL} THEN status END AS status, "
        f"CASE WHEN {_READABLE_SQL} THEN definition END AS definition "
        f"FROM workflow_definitions WHERE id = ANY($1::uuid[])",
        workflow_ids,
        user_id,
        org_id,
    )
    return [dict(r) for r in rows]


async def list_startable_candidates(
    pool: asyncpg.Pool, *, user_id: UUID, org_id: UUID
) -> list[dict]:
    """The caller's OWN published workflows in this org — the key form's checklist."""
    rows = await pool.fetch(
        "SELECT id, name, definition FROM workflow_definitions "
        "WHERE status = 'published' AND created_by = $1 AND org_id = $2 "
        "ORDER BY name, version DESC",
        user_id,
        org_id,
    )
    return [dict(r) for r in rows]


async def count_own_drafts(pool: asyncpg.Pool, *, user_id: UUID, org_id: UUID) -> int:
    """How many of the caller's drafts the checklist hides ("N drafts are hidden")."""
    value = await pool.fetchval(
        "SELECT count(*) FROM workflow_definitions "
        "WHERE status = 'draft' AND created_by = $1 AND org_id = $2",
        user_id,
        org_id,
    )
    return int(value or 0)
