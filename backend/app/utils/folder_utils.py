from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from supabase import Client


async def fetch_all_folders(supabase: "Client", fields: str = "id, user_id, name, parent_id, is_global") -> list[dict]:
    """Fetch ALL folders using service role key (no RLS). Returns everything."""
    # Local import avoids any potential cycle: folder_utils is imported by sql_service
    # and threads.py; aexec lives under app.utils as well — keeping the import inside
    # the function follows the PATTERNS.md "Async helper migration" pattern.
    from app.utils.db import aexec  # noqa: PLC0415
    resp = await aexec(supabase.table("folders").select(fields))
    return resp.data or []


def is_in_global_subtree(folder_id: str, folder_map: dict, cache: dict | None = None) -> bool:
    """True if folder_id or any ancestor has is_global=True (recursive, with optional cache)."""
    if cache is None:
        cache = {}
    if folder_id in cache:
        return cache[folder_id]
    f = folder_map.get(folder_id)
    if not f:
        cache[folder_id] = False
        return False
    if f["is_global"]:
        cache[folder_id] = True
        return True
    parent_id = f.get("parent_id")
    result = is_in_global_subtree(parent_id, folder_map, cache) if parent_id else False
    cache[folder_id] = result
    return result


async def fetch_visible_folders(supabase: "Client", user_id: str) -> list[dict]:
    """Fetch all folders visible to user: owned by user OR in any global folder's subtree."""
    all_folders = await fetch_all_folders(supabase, fields="*")
    folder_map = {f["id"]: f for f in all_folders}
    cache: dict = {}
    return [
        f for f in all_folders
        if f["user_id"] == user_id or is_in_global_subtree(f["id"], folder_map, cache)
    ]


async def get_globally_visible_folder_ids(supabase: "Client", user_id: str) -> list[str]:
    """Return IDs of folders NOT owned by user but visible due to global subtree ancestry."""
    all_folders = await fetch_all_folders(supabase, fields="id, user_id, parent_id, is_global")
    folder_map = {f["id"]: f for f in all_folders}
    cache: dict = {}
    return [
        f["id"] for f in all_folders
        if f["user_id"] != user_id and is_in_global_subtree(f["id"], folder_map, cache)
    ]
