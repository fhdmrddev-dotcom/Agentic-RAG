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

    def _walk(rid: str, seen: set[str] | None = None) -> list[str]:
        # IN-01 (098 secure-phase): cycle/visited guard. A self-parented row
        # (parent_id == id) or any cyclic folder hierarchy (corrupt/legacy data the
        # UI normally prevents) would otherwise recurse unbounded → RecursionError.
        # The Deep copy (agent_loop.py) is the RED LINE and stays untouched; this
        # shared helper is the right place to harden against bad data.
        seen = seen if seen is not None else set()
        if rid in seen:
            return []
        seen.add(rid)
        out = [rid]
        for f in folders:
            if f["parent_id"] == rid:
                out.extend(_walk(f["id"], seen))
        return out

    return _walk(root)  # list[str] — Pitfall 1: NEVER a set


def _definition_has_phase_folder_scope(definition: "WorkflowDefinition") -> bool:
    """True when ANY phase of the definition declares a per-phase ``folder_scope``.

    Used by the A4 composition guard: a scoped workflow intersects each phase's
    ``folder_scope`` with the resolved project subtree (``phase_types.py:326``), so a
    per-run override OUTSIDE that subtree would silently empty the intersection.
    """
    for phase in getattr(definition, "phases", None) or []:
        if getattr(getattr(phase, "config", None), "folder_scope", None):
            return True
    return False


async def resolve_run_scope_root(
    definition: "WorkflowDefinition",
    *,
    run_inputs: "dict | None",
    thread_folder_id: "str | None",
    supabase: "Client",
    user_id: str,
) -> str | None:
    """Resolve the run-start retrieval scope ROOT, layering the per-run override (WFIN-02).

    Precedence (highest → lowest):
      1. an owner-gated per-run OVERRIDE — ``run_inputs["folder_id"]`` (D-05 gated)
      2. the definition's author-time default — ``project_folder_id`` (D-03)
      3. the thread-folder fallback — ``thread_folder_id`` (legacy / unbound)

    Returns the scope ROOT as ``str | None`` (NEVER a set — Pitfall 6). Callers pass the
    result to ``resolve_project_subtree(root, ...)``, so this keeps the run-start sites
    (threads.py / harness_engine.py / runs.py) minimal — the precedence lives HERE, not
    in inline branches (G-5). ``None`` out = whole-KB (unchanged behavior — D-06).

    D-05 owner gate: a client-supplied override ``folder_id`` is UNTRUSTED. It is honored
    ONLY when it is owner-reachable (``str(override) in fetch_visible_folders(owner)``);
    a never-owned / unreachable id DROPS the override (no narrowing / refuse) and the
    precedence falls through to the author default — a run can NEVER scope into a folder
    the owner cannot see. ``fetch_visible_folders`` is consulted only when an override is
    present (absence is the free D-06 path — no owner-fetch cost).

    A4 composition guard (WR-03): when the definition declares ANY per-phase ``folder_scope``,
    resolve the OVERRIDE's OWN subtree and DROP the override unless EVERY declared phase
    ``folder_scope`` still intersects it. Membership in the project subtree is necessary but
    NOT sufficient — an in-subtree override whose subtree misses a phase's ``folder_scope``
    would empty that phase's intersection at ``phase_types.py:326`` (silent no-retrieval), so
    it is DROPPED, falling back to the author default. A phase with no ``folder_scope``
    imposes no constraint.

    Owner-scoped via ``user_id`` (same threat posture as ``resolve_project_subtree`` —
    the run-start sites pass the durable run owner on the service-role path).
    """
    author_default = getattr(definition, "project_folder_id", None)
    author_root = str(author_default) if author_default is not None else None

    override = (run_inputs or {}).get("folder_id")
    if override is not None:
        override = str(override)
        # D-05 owner-reachability gate — NEVER trust a client folder_id blindly.
        visible = {f["id"] for f in await fetch_visible_folders(supabase, user_id)}
        if override not in visible:
            override = None  # never-owned / unreachable → drop (no narrowing / refuse)
        elif _definition_has_phase_folder_scope(definition):
            # A4 (WR-03): resolve the OVERRIDE's OWN subtree and drop the override unless
            # EVERY declared per-phase folder_scope still intersects it. Membership in the
            # project subtree is necessary but NOT sufficient: an in-subtree override (e.g.
            # child A of project P) whose subtree misses a phase whose folder_scope=[B]
            # would empty that phase's ∩ at phase_types.py:326 → the phase retrieves NOTHING.
            # Drop such an override so it degrades to the author default (fail-safe), never a
            # silently-empty phase. A phase with no folder_scope imposes no constraint.
            override_subtree = set(
                await resolve_project_subtree(override, supabase=supabase, user_id=user_id) or []
            )
            for phase in definition.phases:
                scope = getattr(phase.config, "folder_scope", None)
                if scope and not ({str(f) for f in scope} & override_subtree):
                    override = None  # would empty this phase's intersection → drop
                    break

    return override or author_root or thread_folder_id


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
