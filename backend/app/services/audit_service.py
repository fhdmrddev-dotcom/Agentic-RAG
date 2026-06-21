"""Centralized audit log write service.

Always fire-and-forget via BackgroundTasks.add_task() or asyncio.create_task().
Never await directly in a request handler.
"""
import logging
from supabase import Client

from app.utils.db import aexec

logger = logging.getLogger(__name__)

VALID_ACTION_TYPES = frozenset({
    "document.upload", "document.delete", "search.query",
    "code.execute", "skill.load", "thread.create",
    "thread.delete", "settings.update",
    "memory.remember", "memory.recall",   # Phase 33
    "feedback.submit",                    # Phase 39
    # Phase 110 DMF-01 — Document Management (lockstep with migration 071 CHECK;
    # downstream phases consume as-is):
    "view.create", "view.delete",                       # 113/114
    "relationship.create", "relationship.delete",       # 116
    "classification.apply", "classification.rule.create",  # 118
    "metadata.update",                                  # 112
    "metadata.field.create",                            # 111
})


async def assert_action_types_synced(pool) -> None:
    """Raise if VALID_ACTION_TYPES is NOT a subset of the live audit_log CHECK enum.

    Subset only (frozenset ⊆ live CHECK) — a frozenset type missing from the DB is the
    DANGEROUS direction (a silent 23514 drop, since write_audit_entry swallows). A DB type
    not in the frozenset is harmless (no writer) and must NOT fail. Called from main.py
    lifespan (boot, hard-fail) AND tests/integration/test_110_audit_drift_guard.py (CI).
    """
    import re
    row = await pool.fetchrow(
        "SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint "
        "WHERE conname = 'audit_log_action_type_check'"
    )
    if row is None:
        raise RuntimeError(
            "audit drift guard: audit_log_action_type_check constraint missing from live DB "
            "(migration 071 not applied)."
        )
    live_check = set(re.findall(r"'([^']+)'", row["def"]))
    missing = VALID_ACTION_TYPES - live_check
    if missing:
        raise RuntimeError(
            f"audit drift guard: VALID_ACTION_TYPES not a subset of live audit_log CHECK enum; "
            f"missing from DB: {sorted(missing)}. Migration 071 is not applied. Audit writes for "
            f"these action types would SILENTLY drop (audit_service swallows 23514)."
        )


async def write_audit_entry(
    user_id: str,
    action_type: str,
    metadata: dict,
    supabase: Client,
) -> None:
    """Write a single audit log entry.

    Exceptions are caught, logged to stderr, and swallowed (D-05).
    """
    try:
        await aexec(supabase.table("audit_log").insert({
            "user_id": user_id,
            "action_type": action_type,
            "metadata": metadata,
        }))
    except Exception as exc:
        logger.error("audit write failed [action=%s user=%s]: %s", action_type, user_id, exc)
