"""Centralized audit log write service.

Always fire-and-forget via BackgroundTasks.add_task() or asyncio.create_task().
Never await directly in a request handler.
"""
import logging
from supabase import Client

logger = logging.getLogger(__name__)

VALID_ACTION_TYPES = frozenset({
    "document.upload", "document.delete", "search.query",
    "code.execute", "skill.load", "thread.create",
    "thread.delete", "settings.update",
    "memory.remember", "memory.recall",   # Phase 33
})


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
        supabase.table("audit_log").insert({
            "user_id": user_id,
            "action_type": action_type,
            "metadata": metadata,
        }).execute()
    except Exception as exc:
        logger.error("audit write failed [action=%s user=%s]: %s", action_type, user_id, exc)
