from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from supabase import Client


async def fetch_all_folders(
    supabase: "Client",
    fields: str = "id, user_id, name, parent_id, is_org_shared, org_id",
) -> list[dict]:
    """Fetch ALL folders using service role key (no RLS). Returns everything.

    The default field list carries ``is_org_shared`` (the post-Phase-165 org-share flag —
    D-165-01 semantic split) AND ``org_id`` (D-165-04) so the org-aware visibility predicate can
    scope a shared folder to the caller's org set. Callers passing ``fields="*"`` already receive
    both columns.
    """
    # Local import avoids any potential cycle: folder_utils is imported by sql_service
    # and threads.py; aexec lives under app.utils as well — keeping the import inside
    # the function follows the PATTERNS.md "Async helper migration" pattern.
    from app.utils.db import aexec  # noqa: PLC0415
    resp = await aexec(supabase.table("folders").select(fields))
    return resp.data or []


async def _resolve_caller_org_ids(supabase: "Client", user_id: str) -> set[str]:
    """Resolve the caller's org-membership set directly from ``org_members`` (D-165-04 / SEED-124).

    The KB browse/read tools run in the producer on the BYPASSRLS service-role client, so
    ``auth.uid()`` / ``current_user_org_ids()`` never resolve — the caller's org set MUST be
    resolved HERE from the threaded ``user_id`` (mirrors ``current_user_org_ids()`` in mig 104:
    ``SELECT org_id FROM org_members WHERE user_id = <caller>``). **Fail-closed:** an empty / missing
    membership yields an EMPTY set (mirrors 164's fail-closed org derivation), which makes
    ``is_in_global_subtree`` return False for every non-owned folder — 0 shared folders visible
    (over-restrict, never over-share).
    """
    from app.utils.db import aexec  # noqa: PLC0415
    resp = await aexec(
        supabase.table("org_members").select("org_id").eq("user_id", user_id)
    )
    return {str(r["org_id"]) for r in (resp.data or []) if r.get("org_id") is not None}


def is_in_global_subtree(
    folder_id: str,
    folder_map: dict,
    cache: dict | None = None,
    caller_org_ids: set[str] | None = None,
) -> bool:
    """True if folder_id or any ancestor is an ORG-SHARED folder WITHIN the caller's org set.

    D-165-04: a folder counts as an org-shared ancestor ONLY when ``is_org_shared`` is true AND its
    ``org_id`` is in ``caller_org_ids`` — the org gate RLS/DEFINER enforce everywhere else but which
    never reaches this service-role path. ``caller_org_ids`` defaults to an empty set (fail-closed):
    with no resolvable caller org, no non-owned folder is ever shared-visible. Folders carry no
    ``is_system`` / platform-universal branch — that is skills-only per SEED-124. Recursive
    ancestor-walk with an optional memo cache (unchanged).
    """
    if cache is None:
        cache = {}
    if caller_org_ids is None:
        caller_org_ids = set()
    if folder_id in cache:
        return cache[folder_id]
    f = folder_map.get(folder_id)
    if not f:
        cache[folder_id] = False
        return False
    if f.get("is_org_shared") and str(f.get("org_id")) in caller_org_ids:
        cache[folder_id] = True
        return True
    parent_id = f.get("parent_id")
    result = is_in_global_subtree(parent_id, folder_map, cache, caller_org_ids) if parent_id else False
    cache[folder_id] = result
    return result


def _null_foreign_global_owner(
    rows: list[dict],
    caller_id,
    visible_non_owned_ids: set[str] | None = None,
) -> list[dict]:
    """SEED-091 / D-164-05 (TEN-06) + D-165-05 (WR-01): hide the seeding owner's identity from
    non-owner readers.

    For every row NOT owned by ``caller_id`` that is EITHER org-shared / system (``is_org_shared``
    OR ``is_system``) OR present in ``visible_non_owned_ids``, null the owner ``user_id`` IN PLACE —
    RLS gates rows, not columns, so this serialize-time projection is what stops a non-owner from
    learning who seeded a shared resource.

    D-165-05 (WR-01) broadens the rule for the folders serialize path: ``visible_non_owned_ids`` is
    the caller's non-owned-visible folder id set (from ``get_globally_visible_folder_ids``), which
    ALSO includes NON-shared descendants visible via a shared ancestor — the
    ``is_org_shared``/``is_system`` predicate alone misses those subtree descendants. Callers that do
    NOT pass the set (skills / views — no subtree) keep the original shared-row-only behavior. THE
    single uniform rule across folders / skills / views (skills add the ``is_system`` OR-branch — the
    built-in skill-creator IS the skills allow-list, D-165-02; folders/views carry no ``is_system``
    column so ``.get`` yields None and the branch is inert there). Returns ``rows`` for chaining.
    """
    cid = str(caller_id)
    vis = visible_non_owned_ids or set()
    for row in rows:
        if str(row.get("user_id")) == cid:
            continue
        if row.get("is_org_shared") or row.get("is_system") or row.get("id") in vis:
            row["user_id"] = None
    return rows


async def fetch_visible_folders(supabase: "Client", user_id: str) -> list[dict]:
    """Fetch all folders visible to user: owned by user OR in an org-shared folder's subtree
    within the caller's org set (D-165-04). Signature unchanged — org resolution happens INSIDE."""
    caller_org_ids = await _resolve_caller_org_ids(supabase, user_id)
    all_folders = await fetch_all_folders(supabase, fields="*")
    folder_map = {f["id"]: f for f in all_folders}
    cache: dict = {}
    return [
        f for f in all_folders
        if f["user_id"] == user_id or is_in_global_subtree(f["id"], folder_map, cache, caller_org_ids)
    ]


async def get_globally_visible_folder_ids(supabase: "Client", user_id: str) -> list[str]:
    """Return IDs of folders NOT owned by user but visible due to org-shared subtree ancestry
    within the caller's org set (D-165-04 — fail-closed on an empty caller org set). Signature
    unchanged (the exit-gate leak test drives it positionally)."""
    caller_org_ids = await _resolve_caller_org_ids(supabase, user_id)
    all_folders = await fetch_all_folders(
        supabase, fields="id, user_id, parent_id, is_org_shared, org_id"
    )
    folder_map = {f["id"]: f for f in all_folders}
    cache: dict = {}
    return [
        f["id"] for f in all_folders
        if f["user_id"] != user_id and is_in_global_subtree(f["id"], folder_map, cache, caller_org_ids)
    ]
