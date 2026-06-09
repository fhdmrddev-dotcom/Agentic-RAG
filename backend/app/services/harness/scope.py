"""Phase 098 — the ONE shared project-scope resolver + the DB-aware narrow-only
⊆ validator (GOV-01 + PROJ-02).

Two responsibilities, both server-side (the model never participates in scope):

  1. ``resolve_project_subtree`` — centralizes the ``parent_id`` subtree walk that
     was triplicated inline (``agent_loop.py:982-989`` Deep RED LINE — do NOT
     touch that copy; ``threads.py``'s ``_wf_get_subtree``; ``kb.py``'s
     ``_collect_folder_ids`` BFS). Run-start callers (Plan 04: live kickoff +
     resume + Continue) resolve a workflow's ``project_folder_id`` to a concrete
     ``list[str]`` of folder ids the run's retrieval is bound to. ``None`` in →
     ``None`` out so an UNBOUND workflow keeps whole-KB behavior (unchanged).

  2. ``assert_folder_scopes_subset`` — the DB half of D-07 (the structural half is
     the ``@model_validator`` on ``WorkflowDefinition``): every per-phase
     ``folder_scope`` MUST be a subset of the project subtree, proven against the
     REAL owner folder tree. A non-⊆ declared scope is a definition-VALIDITY error
     (``ValueError`` → 400 at the run-start callers), NEVER a silent clip. This is
     a DIFFERENT failure class from Plan 05's runtime ``scope_violation`` clip
     (a RETRIEVED row outside scope → clip+warn in ``tool_dispatcher.py``); the two
     live in separate mechanisms (Pitfall 5 — do NOT conflate).

THREAT (T-098-02 / Information Disclosure): both functions fetch folders via
``fetch_visible_folders(supabase, user_id)`` which is OWNER-scoped. On the
service-role resume/Continue path RLS is bypassed, so the caller MUST pass the
durable run owner's id (``harness_engine.py:1118-1123``) — never widen across users.

THREAT (T-098-11 / serialization fault): the subtree is returned as a
``list[str]``, NEVER a ``set`` — a ``set`` would raise in supabase-py ``json.dumps``
on the RPC ``p_folder_ids`` param (Pitfall 1).

Anti-pattern (do NOT): put this DB logic in a Pydantic ``@model_validator`` — a
pure validator has no ``supabase``/``user_id`` (RESEARCH §4). And do NOT emit a
``scope_violation`` event here — that is Plan 05's runtime path; this is the
definition-time guard.
"""

from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from app.utils.folder_utils import fetch_visible_folders

if TYPE_CHECKING:  # pragma: no cover — typing only
    from supabase import Client

    from app.models.harness import WorkflowDefinition


async def resolve_project_subtree(
    project_folder_id: "UUID | str | None",
    *,
    supabase: "Client",
    user_id: str,
) -> list[str] | None:
    """Resolve a workflow's project binding to its folder subtree (root + descendants).

    ``None`` in → ``None`` out: an UNBOUND workflow keeps whole-KB retrieval
    behavior (unchanged). Otherwise: fetch the owner's visible folders and walk the
    flat ``parent_id`` adjacency from the project root, returning a ``list[str]``
    (NEVER a ``set`` — Pitfall 1: the RPC ``p_folder_ids`` channel is JSON-serialized).

    ``user_id`` MUST be the run OWNER. On the service-role resume/Continue path the
    caller passes the durable run owner (``harness_engine.py:1118-1123``), so this
    can never reach another user's folders.
    """
    if project_folder_id is None:
        return None  # unbound workflow → whole-KB (unchanged behavior)
    root = str(project_folder_id)
    folders = await fetch_visible_folders(supabase, user_id)  # owner-scoped fetch

    def _walk(rid: str) -> list[str]:
        out = [rid]
        for f in folders:
            if f["parent_id"] == rid:
                out.extend(_walk(f["id"]))
        return out

    return _walk(root)  # list[str] — Pitfall 1: NEVER a set


async def assert_folder_scopes_subset(
    definition: "WorkflowDefinition",
    *,
    supabase: "Client",
    user_id: str,
) -> None:
    """DB-aware narrow-only ⊆ check (D-07 DB half) — raises on a non-⊆ phase scope.

    Resolves the project subtree, then asserts every per-phase ``folder_scope`` is a
    subset of it. A phase scope with any id OUTSIDE the subtree raises ``ValueError``
    (a definition-VALIDITY error the run-start callers map to a 400) — this NEVER
    silently clips a declared scope (Pitfall 5: distinct from Plan 05's runtime clip).

    If the workflow is unbound (``project_folder_id is None``) there is nothing to
    bound against, so this is a no-op — the structural ``@model_validator`` (Plan 01)
    has already rejected any phase ``folder_scope`` on an unbound workflow.

    Owner-scoped via ``user_id`` (same threat posture as ``resolve_project_subtree``).
    """
    subtree = await resolve_project_subtree(
        definition.project_folder_id, supabase=supabase, user_id=user_id
    )
    if subtree is None:
        return  # unbound → nothing to bound against (structural validator already guards)
    allowed = set(subtree)
    for phase in definition.phases:
        scope = getattr(phase.config, "folder_scope", None)
        if scope:
            outside = {str(f) for f in scope} - allowed
            if outside:
                raise ValueError(
                    f"phase '{phase.slug}' folder_scope is not a subset of the "
                    f"project subtree: {sorted(outside)}"
                )
