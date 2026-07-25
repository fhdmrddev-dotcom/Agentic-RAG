from __future__ import annotations

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from supabase import Client

logger = logging.getLogger(__name__)


class FolderReadTruncatedError(RuntimeError):
    """The ``folders`` read came back SHORT of the row count the server reported (WR-07).

    PostgREST caps an unbounded select at ``max-rows`` (Supabase's Data API default is 1000
    rows) and then silently returns a PREFIX — a partial answer that is indistinguishable, at
    the call site, from a complete one. For a caller that merely LISTS folders that is a
    display bug. For a caller that GATES on the folder tree it is an accusation: the grounding
    palette loses org-shared folders, ``is_in_global_subtree`` starts returning False,
    ``resolve_project_subtree`` resolves a SHRUNKEN subtree, and
    ``assert_folder_scopes_subset`` reports a ``folder_scope`` violation against a definition
    that is actually correct — which, since Phase 182 plan 182-06, BLOCKS publish.

    This project targets org-scale multi-tenant production, where 1000 folders ACROSS ALL
    TENANTS is not a large deployment, so the cap is reachable in normal operation.

    Deliberately a ``RuntimeError`` and **NOT** a ``ValueError`` (T-182-47). The ⊆ rule in
    ``harness/grounding.py`` catches bare ``ValueError`` and renders what it catches as a
    ``folder_scope`` verdict. A truncation caught there would be re-dressed as exactly the
    false accusation this error exists to prevent, one layer down. It must stay uncatchable by
    that rule so it reaches the caller that knows how to say "we could not check"
    (``assemble_grounding_bundle``, which degrades the bundle instead).
    """


async def fetch_all_folders(
    supabase: "Client",
    fields: str = "id, user_id, name, parent_id, is_org_shared, org_id",
    *,
    strict: bool = False,
) -> list[dict]:
    """Fetch ALL folders using service role key (no RLS). Returns everything.

    The default field list carries ``is_org_shared`` (the post-Phase-165 org-share flag —
    D-165-01 semantic split) AND ``org_id`` (D-165-04) so the org-aware visibility predicate can
    scope a shared folder to the caller's org set. Callers passing ``fields="*"`` already receive
    both columns.

    ``strict`` (WR-07, keyword-only, default False) makes the read TRUNCATION-AWARE: it asks
    PostgREST for an exact count and raises ``FolderReadTruncatedError`` when fewer rows come
    back than the server says exist. The default is load-bearing, not timidity — with
    ``strict=False`` this issues the byte-identical query it always has (no ``count``, no extra
    round trip, same rows). This helper sits on the chat agent-loop path
    (``agent_loop.py:1209``) and on four ``/folders`` routes; an unconditional ``count="exact"``
    would add a ``COUNT(*)`` to every one of them (T-182-48). Only the two grounding GATE call
    sites — the ones that turn this read into a verdict about the author's definition — opt in.

    The ``isinstance(total, int)`` guard is required, not defensive noise: a missing or
    non-integer count means the server did not honour the header (or the client is a test
    double — conftest's supabase is a ``MagicMock``), and an unusable count is NEVER evidence
    of a truncation.
    """
    # Local import avoids any potential cycle: folder_utils is imported by sql_service
    # and threads.py; aexec lives under app.utils as well — keeping the import inside
    # the function follows the PATTERNS.md "Async helper migration" pattern.
    from app.utils.db import aexec  # noqa: PLC0415
    if not strict:
        resp = await aexec(supabase.table("folders").select(fields))
        return resp.data or []

    resp = await aexec(supabase.table("folders").select(fields, count="exact"))
    rows = resp.data or []
    total = getattr(resp, "count", None)
    if isinstance(total, int) and total > len(rows):
        logger.warning(
            "folders read TRUNCATED: %s rows returned but the server reports %s — a gating "
            "caller would resolve a shrunken folder subtree and accuse a correct definition "
            "of a folder_scope violation (WR-07). Failing the read instead.",
            len(rows),
            total,
        )
        raise FolderReadTruncatedError(
            f"the folders read returned {len(rows)} of {total} rows (PostgREST max-rows "
            "truncation) — the folder tree cannot be trusted for a scope decision"
        )
    return rows


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
    # ``.select().eq()`` (no ``.maybe_single()``) always yields a LIST of rows; the
    # isinstance coercion is defensive belt-and-suspenders (SEED-125 reuse) so a stray
    # dict-shaped response — an accidental ``.maybe_single()`` or a duck-typed test stub —
    # can never crash the org-resolution walk. It degrades to the fail-closed empty set.
    rows = resp.data if isinstance(resp.data, list) else ([resp.data] if resp.data else [])
    return {
        str(r["org_id"]) for r in rows
        if isinstance(r, dict) and r.get("org_id") is not None
    }


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


async def fetch_visible_folders(
    supabase: "Client",
    user_id: str,
    *,
    strict: bool = False,
    restrict_org_ids: set[str] | None = None,
) -> list[dict]:
    """Fetch all folders visible to user: owned by user OR in an org-shared folder's subtree
    within the caller's org set (D-165-04). POSITIONAL signature unchanged — org resolution
    happens INSIDE, and several suites drive this positionally while ``harness/scope.py``
    patches it as a module global.

    ``strict`` (WR-07, keyword-only, default False) is threaded straight through to
    ``fetch_all_folders``: opting in makes a PostgREST ``max-rows`` truncation raise
    ``FolderReadTruncatedError`` instead of silently shrinking the visible set. Only the
    grounding GATE call site passes it; every other caller is byte-identical by construction.

    ``restrict_org_ids`` (WR-05, keyword-only, default ``None``) NARROWS the caller's resolved
    org set before the visibility rule runs. The semantics are asymmetric ON PURPOSE and the
    polarity is load-bearing (T-182-54):

      * ``None``   — NO restriction. Today's behaviour, and what every caller that omits the
        keyword gets: the chat agent loop, the four ``/folders`` routes, run-start kickoff,
        resume, Continue and NL generation are byte-identical by construction.
      * ``set()``  — an EMPTY restriction means NO org-shared visibility at all: only the
        caller's OWNED folders resolve. This is the FAIL-CLOSED direction and must NEVER be
        re-interpreted as "unrestricted" — a caller acting on behalf of a definition whose org
        cannot be resolved must see less, never everything the caller personally can reach.

    WHY THE INTERSECTION BELONGS HERE, and nowhere else (the SEED-124 lesson). This is the ONE
    place the caller's org set is resolved for folders, so narrowing it REUSES the entire
    existing visibility rule — ``is_in_global_subtree``'s ancestor walk, its memo cache and its
    ``is_org_shared`` + ``org_id`` predicate all stay untouched and simply receive a smaller
    set. Writing a second predicate one layer up (post-filtering the returned rows, say) is how
    the SEED-124 class of leak re-opens: a post-filter looser than the rule silently re-admits
    exactly the rows the gate excluded, and the two copies drift the first time either changes.

    WHO PASSES IT: publish stage 2.6 only, with the org of the DEFINITION being published (read
    once by ``publish_service._resolve_publish_supabase``, the same value that scopes the
    BYPASSRLS client). A publish gate must answer "is this definition grounded in ITS OWN
    org?", not "can this publisher see everything it names" — for a multi-org author those are
    different questions, and the RUNNER's answer is the one that matters (WR-05).

    Both sides are coerced to ``str`` so a ``UUID`` object and its string form compare equal —
    the restriction arrives from a DB read on one path and from a caller-built set on another.
    """
    caller_org_ids = await _resolve_caller_org_ids(supabase, user_id)
    if restrict_org_ids is not None:
        allowed = {str(o) for o in restrict_org_ids}
        caller_org_ids = {o for o in caller_org_ids if str(o) in allowed}
    all_folders = await fetch_all_folders(supabase, fields="*", strict=strict)
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
