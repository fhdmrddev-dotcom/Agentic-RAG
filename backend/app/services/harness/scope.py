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

  2. the narrow-only ⊆ rule — the DB half of D-07 (the structural half is the
     ``@model_validator`` on ``WorkflowDefinition``): every per-phase ``folder_scope``
     MUST be a subset of the project subtree, proven against the REAL owner folder tree.
     A non-⊆ declared scope is a definition-VALIDITY error (``ValueError`` → 400 at the
     run-start callers), NEVER a silent clip. This is a DIFFERENT failure class from
     Plan 05's runtime ``scope_violation`` clip (a RETRIEVED row outside scope →
     clip+warn in ``tool_dispatcher.py``); the two live in separate mechanisms
     (Pitfall 5 — do NOT conflate).

     ONE walk, TWO presentations (Phase 182 WR-04):
       - ``folder_scope_violations`` — the walk itself. Non-raising; returns EVERY
         offending phase in author order. The ``POST /workflows/validate`` per-node
         collector (``grounding._folder_scope_violations``) takes this form, because the
         canvas paints a badge per node and must not leave later offenders rendering
         clean (ROADMAP SC#4 / VALID-03).
       - ``assert_folder_scopes_subset`` — a thin presentation that re-raises the first
         violation. Run-start callers (``workflow_kickoff`` → 400, ``runs.py``'s Continue
         fallback, ``harness_engine``'s resume fallback) and the NL-generation
         short-circuit (``grounding._folder_scope_violation``) take this form.
     The rule exists exactly once; only the terminal action differs.

THREAT (T-098-02 / Information Disclosure): both functions fetch folders via
``fetch_visible_folders(supabase, user_id)`` which is OWNER-scoped. On the
service-role resume/Continue path RLS is bypassed, so the caller MUST pass the
durable run owner's id (``harness_engine.py:1118-1123``) — never widen across users.

  THE ORG DIMENSION (Phase 182 WR-05, extending T-098-02). Owner scoping alone stopped
  being sufficient the moment ``is_org_shared`` existed: a folder can be visible to a
  caller through org membership rather than ownership, so "the owner's tree" and "the
  tree this caller can reach" are different sets (D-165-04 / SEED-124). A second axis
  follows from that — a caller acting ON BEHALF OF a definition must additionally be
  narrowed to THAT DEFINITION's org, or the walk resolves a subtree the definition's own
  org cannot reach and the ⊆ rule answers a question nobody asked. The optional
  ``restrict_org_ids`` keyword on the two non-raising functions below carries that
  narrowing; ``None`` (every current caller) means no restriction.

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


class FolderScopeSubsetError(ValueError):
    """The non-⊆ phase ``folder_scope`` failure, carrying the OFFENDING PHASE SLUG.

    A ``ValueError`` SUBCLASS **on purpose**: every pre-existing handler keeps working by
    construction, with no call-site edit and no behavior change —
    ``workflow_kickoff.py``'s ``except ValueError`` → HTTP 400 (``detail=str(err)``),
    ``runs.py``'s best-effort Continue broad-try, ``harness_engine.py``'s resume
    unscoped-fallback, and ``test_098_scope_governance.py``'s
    ``pytest.raises(ValueError, match="is not a subset")``. ``super().__init__(message)``
    keeps ``str(exc)`` and ``args`` BYTE-IDENTICAL to the plain ``ValueError`` this
    replaces, so every message/``detail`` string on every path is unchanged.

    The added ``phase_slug`` attribute is the STRUCTURAL channel for the offending phase
    (Phase 182 SC#4 / D-182-06): the ``POST /workflows/validate`` seam keys its
    ``folder_scope`` verdict to a NODE by reading this attribute — never by parsing the
    message prose. The canvas is a pure client of the seam and must never re-derive a
    server rule client-side, and a regex over free text is exactly that re-derivation.

    ``phase_slug`` is keyword-only and defaults to ``None`` so a future non-phase-specific
    ⊆ failure can still raise this type honestly (consumers read it via
    ``getattr(exc, "phase_slug", None)`` and degrade to an unkeyed verdict).
    """

    def __init__(self, message: str, *, phase_slug: str | None = None) -> None:
        super().__init__(message)  # str(exc) / args unchanged — the parity guarantee
        self.phase_slug = phase_slug


async def resolve_project_subtree(
    project_folder_id: "UUID | str | None",
    *,
    supabase: "Client",
    user_id: str,
    restrict_org_ids: set[str] | None = None,
) -> list[str] | None:
    """Resolve a workflow's project binding to its folder subtree (root + descendants).

    ``None`` in → ``None`` out: an UNBOUND workflow keeps whole-KB retrieval
    behavior (unchanged). Otherwise: fetch the owner's visible folders and walk the
    flat ``parent_id`` adjacency from the project root, returning a ``list[str]``
    (NEVER a ``set`` — Pitfall 1: the RPC ``p_folder_ids`` channel is JSON-serialized).

    ``user_id`` MUST be the run OWNER. On the service-role resume/Continue path the
    caller passes the durable run owner (``harness_engine.py:1118-1123``), so this
    can never reach another user's folders.

    ``restrict_org_ids`` (WR-05, keyword-only, default ``None`` = no restriction) is passed
    straight through to ``fetch_visible_folders``, which owns the intersection — see its
    docstring for the semantics, including why an EMPTY set is fail-closed rather than
    unrestricted. Nothing about the walk changes; it simply walks a narrower tree.
    """
    if project_folder_id is None:
        return None  # unbound workflow → whole-KB (unchanged behavior)
    root = str(project_folder_id)
    # THE SEAM-CONTRACT RULE (WR-05), applied at every internal call this plan threads the
    # restriction through. The keyword is forwarded ONLY when it carries information, so an
    # UNRESTRICTED call is byte-identical ON THE WIRE, not merely in outcome. That matters
    # because these are documented MONKEYPATCH seams: ``fetch_visible_folders`` is patched as a
    # module global by the folder-override and scope-governance suites, and
    # ``resolve_project_subtree`` is the seam ``test_182_folder_scope_keying`` uses to run the
    # REAL ⊆ walk against a fake subtree. Forwarding ``restrict_org_ids=None`` would break every
    # existing double — and every future one — for callers that do not use the feature at all.
    # A RESTRICTED call still passes it explicitly, so a double that cannot accept it fails
    # LOUDLY rather than silently ignoring a tenancy narrowing.
    _org_kw = {} if restrict_org_ids is None else {"restrict_org_ids": restrict_org_ids}
    folders = await fetch_visible_folders(supabase, user_id, **_org_kw)  # owner-scoped fetch

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

    A4 composition guard (WR-03 + author-subtree containment, 152-08): when the definition
    declares ANY per-phase ``folder_scope`` the override must satisfy BOTH conditions —
    "Membership in the project subtree is necessary but NOT sufficient":
      * NECESSARY (author-project-subtree membership): the override MUST be a member of the
        AUTHOR's own project subtree (``resolve_project_subtree(author_root)``). A strict
        ANCESTOR/SIBLING of the bound project trivially satisfies the per-phase intersection
        (the project's own scoped descendants are still inside the ancestor's subtree) yet
        WIDENS the run's retrieval to unrelated sibling projects — a same-account cross-project
        leak. An override outside the author subtree is DROPPED, restoring the D-04/WFIN-02
        narrow-only contract (this is the check 152-06's WR-03 fix removed and 152-08 restores).
      * SUFFICIENT (per-phase intersection): even an in-subtree override is DROPPED unless
        EVERY declared phase ``folder_scope`` still intersects the OVERRIDE's OWN subtree; an
        override whose subtree misses a phase's ``folder_scope`` would empty that phase's
        intersection at ``phase_types.py:326`` (silent no-retrieval).
    Either failure falls back to the author default (fail-safe). A phase with no
    ``folder_scope`` imposes no constraint.

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
            # A4 (WR-03 + author-subtree containment, 152-08): a scoped workflow's override
            # must satisfy BOTH the NECESSARY author-project-subtree membership AND the
            # SUFFICIENT per-phase intersection — matching this function's own docstring.
            #
            # NECESSARY: the override MUST be a member of the AUTHOR's own project subtree. A
            # strict ANCESTOR/SIBLING of the bound project trivially satisfies the per-phase
            # intersection below (the project's own scoped descendants are still inside the
            # ancestor's subtree) yet WIDENS retrieval to unrelated sibling projects — the
            # D-04/WFIN-02 narrow-only contract break. This is the check 152-06's WR-03 fix
            # dropped; restore it so an out-of-subtree override degrades to the author default.
            project_subtree = set(
                await resolve_project_subtree(author_root, supabase=supabase, user_id=user_id) or []
            )
            if override not in project_subtree:
                override = None  # outside the author project subtree → drop (would widen)
            else:
                # SUFFICIENT: resolve the OVERRIDE's OWN subtree and drop it unless EVERY
                # declared per-phase folder_scope still intersects it. An in-subtree override
                # (e.g. child A of project P) whose subtree misses a phase whose folder_scope=[B]
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


async def folder_scope_violations(
    definition: "WorkflowDefinition",
    *,
    supabase: "Client",
    user_id: str,
    restrict_org_ids: set[str] | None = None,
) -> list[FolderScopeSubsetError]:
    """THE ⊆ walk (D-07 DB half) — the ONE implementation of rule 1, non-raising.

    Resolves the project subtree ONCE for the whole definition, then checks every
    per-phase ``folder_scope`` against it and RETURNS one ``FolderScopeSubsetError`` per
    offending phase, in ``definition.phases`` order so the canvas can render findings in
    the order the author drew them. Clean definitions and unbound workflows
    (``project_folder_id is None`` — nothing to bound against, and the structural
    ``@model_validator`` from Plan 01 already rejects a phase ``folder_scope`` there)
    return ``[]``.

    This function NEVER raises for a rule violation. Raising is a PRESENTATION choice, and
    it is made by the sibling below — one source, two presentations, exactly the pattern
    ``grounding.py`` documents for its short-circuit dict versus its per-node collector:

      - ``assert_folder_scopes_subset`` (below) — the SHORT-CIRCUIT presentation. Run-start
        callers (``workflow_kickoff`` → HTTP 400, ``runs.py``'s Continue fallback,
        ``harness_engine``'s resume fallback) and the NL-generation short-circuit
        (``grounding._folder_scope_violation``) all want the first offender and nothing more.
      - the LIST form (this one) — what the ``POST /workflows/validate`` per-node collector
        (``grounding._folder_scope_violations``) consumes, because the canvas needs EVERY
        offending node at once. A short-circuited rule 1 would leave the second and third
        out-of-subtree nodes rendering CLEAN in Phase 184's per-node badges, and the author
        would rediscover them one at a time (ROADMAP SC#4 / VALID-03; Phase-182 WR-04).

    Each violation carries the offending phase on ``.phase_slug`` — the STRUCTURAL channel
    (Phase 182 SC#4 / D-182-06). The message still names the slug for humans, but no
    consumer may PARSE it: consumers read the attribute, never a regex over prose.

    Owner scoping and the cycle guard are inherited unchanged from
    ``resolve_project_subtree`` — see its docstring and the module-header T-098-02 /
    T-098-11 notes; this function adds no new read. Pitfall 5 still applies: a non-⊆
    declared scope is a definition-VALIDITY error, NEVER a silent clip (that is Plan 05's
    distinct runtime ``scope_violation`` path in ``tool_dispatcher.py``).

    ``restrict_org_ids`` (WR-05, keyword-only, default ``None`` = no restriction) rides
    through to the subtree resolution above. It is what lets the PUBLISH gate ask "is this
    definition's ``folder_scope`` inside a subtree its OWN org can reach?" rather than "inside
    a subtree its multi-org author can reach" — the two differ exactly when they matter, and
    the runner's answer is the first one. The ⊆ rule itself is unchanged; only the tree it is
    evaluated against narrows.
    """
    # Forwarded only when set — see the seam-contract rule in ``resolve_project_subtree``.
    _org_kw = {} if restrict_org_ids is None else {"restrict_org_ids": restrict_org_ids}
    subtree = await resolve_project_subtree(
        definition.project_folder_id, supabase=supabase, user_id=user_id, **_org_kw
    )
    if subtree is None:
        return []  # unbound → nothing to bound against (structural validator already guards)
    allowed = set(subtree)
    violations: list[FolderScopeSubsetError] = []
    for phase in definition.phases:
        scope = getattr(phase.config, "folder_scope", None)
        if scope:
            outside = {str(f) for f in scope} - allowed
            if outside:
                # Message expression UNCHANGED (both f-string fragments verbatim) — the
                # byte-identical guarantee, pinned against a hand-written golden literal in
                # tests/unit/test_182_folder_scope_keying.py and by
                # test_098_scope_governance's match="is not a subset". Only the terminal
                # ACTION moved (append, was raise); the rule itself did not change.
                violations.append(
                    FolderScopeSubsetError(
                        f"phase '{phase.slug}' folder_scope is not a subset of the "
                        f"project subtree: {sorted(outside)}",
                        phase_slug=phase.slug,
                    )
                )
    return violations


async def assert_folder_scopes_subset(
    definition: "WorkflowDefinition",
    *,
    supabase: "Client",
    user_id: str,
) -> None:
    """The SHORT-CIRCUIT presentation of ``folder_scope_violations`` — same rule, FIRST
    offender only, raised.

    Delegates the entire ⊆ walk to the collector above and re-raises its first element.
    No part of the walk is re-implemented here (D-182-06: exactly one copy of every rule),
    so the two forms can never disagree about what a violation IS — only about how many
    they report.

    RAISING ``violations[0]`` rather than a synthesized error is what makes the parity
    guarantee structural: the object raised **IS** the first violation the collector built,
    so its type (``FolderScopeSubsetError``, a ``ValueError`` SUBCLASS), its ``str(exc)``,
    its ``args`` and its ``phase_slug`` are identical by construction rather than by careful
    copying. Every pre-existing handler is therefore unaffected —
    ``workflow_kickoff.py``'s ``except ValueError`` → HTTP 400 (``detail=str(err)``),
    ``runs.py``'s best-effort Continue broad-try, ``harness_engine.py``'s resume
    unscoped-fallback, ``grounding._folder_scope_violation``'s NL-generation short-circuit,
    and ``test_098_scope_governance``'s ``pytest.raises(ValueError, match="is not a subset")``.

    Clean and unbound definitions return ``None``, exactly as before.

    DELIBERATELY WITHOUT ``restrict_org_ids`` (Phase 182 WR-05 / T-182-55) — a recorded
    decision, not an omission. The collector and ``resolve_project_subtree`` both gained that
    optional org narrowing; this presentation did NOT, because of WHO calls it. Every caller of
    the raising form acts AS ITSELF, never on behalf of a definition's org:
    ``workflow_kickoff``'s HTTP 400 and ``harness_engine``'s resume / ``runs.py``'s Continue
    fallbacks are a RUNNER starting or resuming THEIR OWN run, and
    ``grounding._folder_scope_violation`` is an AUTHOR generating their own draft. Narrowing
    those to some definition's org would not close a leak — it would break correct behaviour,
    refusing folders the acting user can legitimately reach. The asymmetry is asserted by
    ``tests/unit/test_182_publish_org_scope.py`` so a future reader meets a choice, not a gap.
    """
    violations = await folder_scope_violations(
        definition, supabase=supabase, user_id=user_id
    )
    if violations:
        raise violations[0]  # the collector's OWN object — parity by construction
