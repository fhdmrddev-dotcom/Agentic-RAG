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
    # Phase 223 (GRANT-05 / SC#1 / SC#1a / lockstep with migration 152 CHECK):
    "connector.call", "connector.grant",
    # Phase 234 (LIB-08) — in the migration 170 CHECK since then, missing here until 275 (D-27):
    "connector.watch.create", "connector.watch.delete", "connector.watch.sync",
    # Phase 275 (D-27 / lockstep with migration 204 CHECK) — retention admin commands + folder delete:
    "retention.policy.create", "retention.policy.update", "retention.policy.delete",
    "retention.hold.create", "retention.hold.update", "retention.hold.release",
    "retention.disposition.confirm", "retention.document.unarchive", "retention.document.keep",
    "folder.delete",
    # Phase 293 (D-16 / lockstep with migration 215 CHECK) — API keys:
    "api_key.create", "api_key.revoke", "api_key.start", "api_key.read", "api_key.refused",
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
    org_id: str | None = None,
) -> None:
    """Write a single audit log entry.

    Exceptions are caught, logged to stderr, and swallowed (D-05).

    ``org_id`` is OPTIONAL and defaults to ``None`` → the insert dict is byte-identical
    to the historical 3-column write, so every existing caller is unchanged (the mig-106
    ``autofill_org_id_by_owner`` BEFORE-INSERT trigger still fills org_id for them). When a
    caller passes an EXPLICIT ``org_id`` (Phase 167, T-167-23), it is added to the insert dict
    and — because the trigger's first statement is ``IF NEW.org_id IS NOT NULL THEN RETURN
    NEW`` — the trigger becomes a no-op and the provided value is written verbatim. This is the
    only way a 2+-org caller's row lands on the CORRECT org's /org/audit tab (the trigger's
    ORDER-BY-less ``org_members … LIMIT 1`` lookup would otherwise misattribute it).
    """
    try:
        entry = {
            "user_id": user_id,
            "action_type": action_type,
            "metadata": metadata,
        }
        if org_id is not None:
            entry["org_id"] = org_id
        await aexec(supabase.table("audit_log").insert(entry))
    except Exception as exc:
        logger.error("audit write failed [action=%s user=%s]: %s", action_type, user_id, exc)
