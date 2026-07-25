"""Phase 182 (VALID-01 / D-182-02 / D-182-06) — the ONE shared grounding source.

This module is the anti-drift mechanism for the visual workflow canvas. The grounding
computation and the three grounding-FIDELITY rules used to live private inside
``app.services.workflow_authoring`` (Phase 103, coupled to NL generation). Phase 182
MOVES them here VERBATIM so that:

  - NL generation (``workflow_authoring._assemble_grounding`` /
    ``_check_grounding_fidelity``) — now thin delegates,
  - the ``POST /workflows/validate`` seam (Wave 2) — per-node verdicts,
  - the ``GET /workflows/grounding-bundle`` palette (Wave 2, D-182-01),

all read the SAME copy. **RED LINE (D-182-06 / D-14): there is exactly ONE copy of every
grounding rule and it lives here. No rule is ever re-implemented in a second backend
module, and NEVER client-side.** The canvas is a pure client of this seam.

Two presentations over ONE rule set (RESEARCH Pattern 2):
  - ``_check_grounding_fidelity`` — SHORT-CIRCUITS on the first violation and returns the
    ``{ok: False, error: "grounding_failed", detail}`` dict NL generation has always
    returned (byte-identical to the pre-extraction behavior).
  - ``grounding_verdicts``       — COLLECTS every violation as a per-node
    ``{code, phase, message}`` dict (the canvas needs all of them, keyed by phase slug).
    ALL THREE fidelity rules key to a phase slug AND all three report EVERY violation, so
    Phase 184 can paint a COMPLETE per-node badge set from one call — no node that is
    actually broken ever renders clean. ``folder_scope``'s slug is threaded structurally
    off ``scope.FolderScopeSubsetError.phase_slug`` (Phase 182 SC#4), never parsed out of
    the message. Only a non-typed ⊆-path ``ValueError`` degrades to a single ``phase:
    None`` verdict.
    Provenance: 182-04 fixed rule 1's KEYING (the verdict names its phase); the Phase-182
    gap closure (WR-04) then fixed its MULTIPLICITY — until then it reported only the FIRST
    offending phase, so later offenders rendered clean and the author found them one at a
    time.

One computation, three consumers (RESEARCH Pattern 1):
  ``assemble_grounding_bundle`` returns the STRUCTURED ``GroundingBundle``;
  ``render_grounding_prompt`` re-renders the NL prose prompt FROM that bundle (so NL-gen
  is byte-for-byte unchanged); the fidelity rules read ``bundle.tool_names`` /
  ``bundle.skill_ids``; the GET palette route serializes ``bundle.tools`` /
  ``.folders`` / ``.skills`` / ``.placeholders`` as JSON.

MODULE-SHAPE DISCIPLINE (Pitfall 1): grounding TOUCHES the DB (folder tree + skill
registry). It deliberately does NOT live in ``reachability.py``, which is documented
"PURE — no I/O, no DB, no engine import" — folding DB code in there would poison the
pure-import property that lets the ``/validate`` route import ``lint_workflow`` cheaply.
For the same reason this module is NOT re-exported from ``harness/__init__.py``; import
it module-direct (``from app.services.harness.grounding import ...``).

BLOCKING-I/O CONTRACT (D-v2.5-01): the blocking ``supabase-py`` skill read rides
``run_in_threadpool`` — never on the event loop.

OWNER + ORG SCOPING (V4 / T-182-03 / T-103-02-03 / CR-01): every read is gated by hand (the
service runs as service-role, which bypasses RLS). Owner scoping alone is NOT sufficient —
both reads also gate on the caller's ORG membership, because ``is_org_shared`` is a
cross-user scope and without an org term it spans cross-TENANT too: folders via
``fetch_visible_folders`` (D-165-04 / SEED-124) and skills via the one shared rule in
``app.utils.skill_visibility`` (CR-01 / SEED-125). Both fail closed on an unresolvable org
set. The palette must NEVER widen to another user's or another org's folders or skills — KB
content can never whitelist itself.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from starlette.concurrency import run_in_threadpool

# CR-01 — module top on purpose: both are stdlib-light and cycle-free (``app.utils.db`` pulls
# only logging/uuid/starlette; ``app.utils.skill_visibility`` pulls only ``app.utils.db``), so
# they do not compromise this module's import-light property. ``skill_visibility`` is the ONE
# home of the org-gated skill rule — see its docstring for the rule + the RLS shape it mirrors.
from app.utils.db import coerce_uid
from app.utils.skill_visibility import build_skill_visibility_or, skill_row_visible

if TYPE_CHECKING:  # pragma: no cover — typing only, keeps the module import-light
    from app.models.harness import WorkflowDefinition

logger = logging.getLogger(__name__)


# ── the structured bundle (one computation, three consumers) ──────────────────


@dataclass
class GroundingBundle:
    """The server-sourced palette of valid building blocks for one owner.

    ``tools``/``folders``/``skills``/``placeholders`` are the JSON-serializable shapes the
    ``GET /workflows/grounding-bundle`` route returns (D-182-01 — Phase 184's node-config
    dropdowns bind to these, NEVER to a frontend constant / Pitfall 1). ``tool_names`` and
    ``skill_ids`` are the membership SETS the fidelity rules test against (the same values,
    set-shaped for O(1) checks and for NL generation's historical tuple contract).
    """

    tools: list[str] = field(default_factory=list)  # sorted(tool_names) — JSON-friendly
    tool_names: set[str] = field(default_factory=set)  # membership set for fidelity
    folders: list[dict] = field(default_factory=list)  # fetch_visible_folders rows
    # enabled skills visible to the caller: is_system, or in-org owned / org-shared (CR-01).
    # RAW rows — the ``/grounding-bundle`` route projects them through ``PaletteSkill`` before
    # serializing, so ``org_id`` / ``user_id`` never reach the wire (CR-02).
    skills: list[dict] = field(default_factory=list)
    skill_ids: set[str] = field(default_factory=set)  # membership set for fidelity
    placeholders: list[str] = field(default_factory=list)  # template placeholder fields


# ── moved verbatim from workflow_authoring (Phase 103) ────────────────────────


def _skill_registry(supabase, user_id: str, caller_org_ids: set[str]) -> list[dict]:
    """ENABLED skills VISIBLE to the caller (service-role bypasses RLS — gate by hand).

    ``skill_ref`` in a PhaseConfig is the skill ``id`` (a UUID), so the caller builds the
    membership set from ``s["id"]``.

    ORG GATE (CR-01 / SEED-125). The pre-182 predicate was
    ``.or_(user_id.eq.<caller>,is_org_shared.eq.true)`` with a matching Python post-filter and
    NO org term — on the BYPASSRLS service-role client that matched **every** org's
    ``is_org_shared`` skill, so ``/grounding-bundle`` returned foreign-org skill rows and
    ``/validate`` grounded a foreign-org ``skill_ref`` as valid. Both the pushed-down query and
    the in-process post-filter now go through the ONE shared rule in
    ``app.utils.skill_visibility`` (``build_skill_visibility_or`` / ``skill_row_visible``),
    which mirrors the live ``public.skills`` SELECT policy term-for-term. The two must agree —
    a post-filter looser than the query would re-admit exactly the rows the gate excluded — so
    they are derived from the same module rather than hand-written twice.

    ``caller_org_ids`` is resolved by the ASYNC caller (``assemble_grounding_bundle``) and
    threaded in: this function is sync-by-contract (see below) and must not perform the
    ``org_members`` round-trip itself. An empty set is fail-closed, NOT a bypass: only
    ``is_system`` skills resolve.

    ``coerce_uid`` UUID-validates the caller id before it is spliced into the PostgREST
    ``.or_()`` grammar. On the service-role client that predicate IS the only owner gate, so a
    malformed id must RAISE, never break out of the DSL. It is deliberately outside the
    ``try`` below: a bad identity is a caller bug to surface, not a read failure to swallow.

    BLOCKING-I/O CONTRACT (IR-01 / D-v2.5-01): this is a plain ``def`` and calls
    synchronous ``supabase-py``. It MUST be invoked via ``run_in_threadpool`` (it is —
    ``assemble_grounding_bundle`` wraps it). NEVER call it directly from an async handler
    or the blocking read lands on the event loop."""
    caller = coerce_uid(user_id)
    org_ids = {coerce_uid(o) for o in (caller_org_ids or set())}
    try:
        rows = (
            supabase.table("skills")
            # is_system + org_id are selected because the post-filter below needs them to
            # evaluate the SAME rule the .or_() pushes down (they are projected off the wire
            # by the route's PaletteSkill model — CR-02).
            .select("id,name,is_org_shared,is_system,org_id,user_id,is_enabled")
            .or_(build_skill_visibility_or(caller, org_ids))
            .execute()
            .data
        ) or []
    except Exception:  # noqa: BLE001 — a gated read miss must FAIL CLOSED, never widen scope.
        # The service runs as service-role (RLS-bypassing), so there is no safe fallback read:
        # a bare full-table query would pull EVERY org's skill rows over the wire. Return []
        # (no skill grounding) rather than a possibly-polluted set. The pre-182 code "retried"
        # here with a byte-identical query — a duplicated no-op that made any deterministic
        # failure fail twice, under a comment describing a narrowing that never happened. One
        # attempt, one honest fail-closed exit.
        logger.warning(
            "grounding: org-gated skills read failed; using empty skill set", exc_info=True
        )
        return []
    return [
        r
        for r in rows
        if r.get("is_enabled") and skill_row_visible(r, caller_id=caller, org_ids=org_ids)
    ]


def _render_folder_tree(folders: list[dict]) -> str:
    """Render the owner's folders as an indented name/id tree (parent_id → children).
    Reproduces the spike's ``build_folder_tree`` shape (no project-root marker — the
    bound project is passed separately to the prompt)."""
    from collections import defaultdict

    children: dict[Any, list[dict]] = defaultdict(list)
    for f in folders:
        children[f.get("parent_id")].append(f)
    for kids in children.values():
        kids.sort(key=lambda f: (f.get("name") or "").lower())

    lines: list[str] = []

    def walk(parent, depth: int) -> None:
        for f in children.get(parent, []):
            lines.append(f"{'  ' * depth}- {f['name']}  (id={f['id']})")
            walk(f["id"], depth + 1)

    walk(None, 0)
    owned = {f["id"] for f in folders}
    for f in folders:
        if f.get("parent_id") is not None and f["parent_id"] not in owned:
            lines.append(f"- {f['name']}  (id={f['id']})")
    return "\n".join(lines) if lines else "(no folders)"


async def _resolve_template_placeholders(
    *,
    supabase,
    pool,
    user_id: str,
    template_asset_id: str | None,
    template_placeholders: list[str] | None,
) -> list[str]:
    """OPTIONAL template grounding (D-103-3 / D-103-CONF-2). ``template_placeholders`` is
    used directly; ``template_asset_id`` resolves a LIBRARY asset
    (``resolve_template_source`` Branch 1, which keys on ``asset_id`` as the storage path
    and never touches ``thread_id``) then parses its docx placeholder vocabulary. A
    resolution miss degrades to no placeholders (template grounding is optional) — never
    a hard failure of the whole generate."""
    if template_placeholders:
        return list(template_placeholders)
    if not template_asset_id:
        return []
    try:
        from app.models.harness import AssetRef  # function-local
        from app.services.template_asset_service import resolve_template_source
        from app.services.template_render_service import parse_docx_template_variables

        asset_ref = AssetRef(
            asset_id=str(template_asset_id),
            filename=str(template_asset_id),
            kind="template",
            mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
        resolved = await resolve_template_source(
            pool=pool,
            supabase=supabase,
            thread_id="",  # library path (Branch 1) ignores thread_id
            user_id=user_id,
            asset_ref=asset_ref,
        )
        data = resolved.get("bytes")
        if not data:
            return []
        parsed = parse_docx_template_variables(data)
        if not parsed:
            return []
        names: list[str] = list(parsed.get("scalars") or [])
        for col_keys in (parsed.get("columns") or {}).values():
            names.extend(col_keys)
        return sorted(set(names))
    except Exception:  # noqa: BLE001 — optional grounding: a miss is no placeholders, not a crash
        logger.warning("grounding: template placeholder resolution failed; skipping")
        return []


def _grounding_failed(detail: str) -> dict:
    """An honest grounding failure — distinct from model_validate (shape-only). A
    shape-valid but UNGROUNDED draft is a failure, NEVER a draft (T-103-02-04, G-6)."""
    return {"ok": False, "error": "grounding_failed", "detail": detail}


# ── the registry compute + the NL render (RESEARCH Pattern 1) ─────────────────


async def assemble_grounding_bundle(
    *,
    supabase,
    pool=None,
    user_id: str,
    project_folder_id: str | None = None,
    template_asset_id: str | None = None,
    template_placeholders: list[str] | None = None,
) -> GroundingBundle:
    """Compute the server-side grounding palette for ``user_id`` (the ONE registry read).

    Lifted VERBATIM from ``workflow_authoring._assemble_grounding`` (Phase 103) — the
    accessors, their order, the ``run_in_threadpool`` wrap (D-v2.5-01) and the owner
    scoping are unchanged. The valid folder / tool / skill SETS are computed server-side
    so KB content can never whitelist itself (T-103-02-03 / T-182-03; the 101.1-06
    precedent).

    ``project_folder_id`` does NOT affect the palette (a bound project only narrows the
    per-phase ``folder_scope`` ⊆ check and the NL prose line) — it is accepted for
    signature symmetry with ``render_grounding_prompt`` so the GET palette route can omit
    it. ``pool`` is only needed when ``template_asset_id`` must be resolved.
    """
    from app.services.openai_service import get_tools  # function-local
    from app.utils.folder_utils import (  # function-local
        _resolve_caller_org_ids,
        fetch_visible_folders,
    )

    folders = await fetch_visible_folders(supabase, user_id)
    tool_names = {t["function"]["name"] for t in get_tools(None)}
    # CR-01 — the caller's org set gates the skill read. Resolved HERE, in the async caller,
    # because ``_skill_registry`` is sync-by-contract (D-v2.5-01) and must not do its own
    # ``org_members`` round-trip; it receives the set and applies the shared rule. This is the
    # same fail-closed resolver the SEED-124 folder fix uses, and it adds no new failure mode:
    # ``fetch_visible_folders`` on the line above already calls it internally (the duplicate
    # round-trip is one small indexed read — folder_utils' signature is contractually fixed).
    caller_org_ids = await _resolve_caller_org_ids(supabase, user_id)
    skills = await run_in_threadpool(_skill_registry, supabase, user_id, caller_org_ids)
    skill_ids = {str(s["id"]) for s in skills}
    placeholders = await _resolve_template_placeholders(
        supabase=supabase,
        pool=pool,
        user_id=user_id,
        template_asset_id=template_asset_id,
        template_placeholders=template_placeholders,
    )
    return GroundingBundle(
        tools=sorted(tool_names),
        tool_names=tool_names,
        folders=list(folders or []),
        skills=list(skills or []),
        skill_ids=skill_ids,
        placeholders=placeholders,
    )


def render_grounding_prompt(bundle: GroundingBundle, project_folder_id: str | None) -> str:
    """Render the NL authoring grounding prose FROM the structured bundle.

    Lifted VERBATIM from ``workflow_authoring._assemble_grounding`` (the string-render
    half) so the NL prompt stays BYTE-IDENTICAL after the Phase 182 extraction.
    ``", ".join(bundle.tools)`` is exactly the old ``", ".join(sorted(tool_names))``
    (``tools == sorted(tool_names)`` by construction).
    """
    folder_tree = _render_folder_tree(bundle.folders)
    skill_lines = (
        "\n".join(f"- {s.get('name')} (id={s['id']})" for s in bundle.skills)
        or "(no skills registered)"
    )
    project_line = (
        f"The workflow is BOUND to project folder id={project_folder_id}. Any "
        "per-phase folder_scope must be inside this folder's subtree.\n"
        if project_folder_id
        else "The workflow is NOT bound to a project folder (whole-KB).\n"
    )
    return (
        "## Grounding (use ONLY these ids / names)\n\n"
        f"{project_line}\n"
        "### KB folder tree (name + id)\n"
        f"{folder_tree}\n\n"
        "### Tool registry — names eligible for an `available_tools` whitelist\n"
        f"{', '.join(bundle.tools) or '(none)'}\n\n"
        "### Skill registry (enabled; owner + global) — ids eligible for `skill_ref`\n"
        f"{skill_lines}\n\n"
        "### Template placeholder fields (if the workflow must fill a template)\n"
        f"{', '.join(bundle.placeholders) if bundle.placeholders else '(none)'}\n"
    )


# ── the CANONICAL set of codes ``grounding_verdicts`` can emit (Phase 182 / WR-05) ──
#
# ONE code per atomic rule below. Published for the same derive-don't-duplicate reason
# ``reachability.LINT_CODES`` is: ``api/workflows.py``'s ``/validate`` severity classifier
# COMPOSES its known-code set from the two owning modules, so it can never drift from a
# hardcoded copy of these literals (the WR-05 defect).
#
# ADDING A CODE: a new verdict code emitted by ``grounding_verdicts`` MUST be added here in
# the SAME commit. ``tests/unit/test_182_severity_codes.py`` scans this file's verdict emit
# sites and fails when the published set and the real emit sites disagree.
#
# DELIBERATELY NOT INCLUDED — ``grounding_unavailable``. That code is minted by
# ``publish_service``'s fail-closed stage-2.6 wrapper (plan 182-06), never by
# ``grounding_verdicts``, and it travels on the PUBLISH verdict's ``named_failures``, never
# through ``/validate``. Its canonical home is ``publish_service.py``; the boundary is
# pinned by ``test_publish_only_codes_are_an_acknowledged_boundary``.
GROUNDING_VERDICT_CODES: frozenset[str] = frozenset(
    {
        "folder_scope",
        "unregistered_skill",
        "unregistered_tool",
    }
)


# ── the three atomic grounding-fidelity rules (the ONE copy) ──────────────────
#
# Rule 1: every per-phase ``folder_scope`` UUID ⊆ the bound project subtree.
# Rule 2: every ``available_tools`` entry ∈ the real tool registry.
# Rule 3: every ``skill_ref`` ∈ the owner/global ENABLED skill set.
#
# Both presentations below (short-circuit dict for NL-gen, per-node list for /validate)
# call THESE helpers — there is no second implementation of any rule (D-182-06).


async def _folder_scope_violation(
    wd: "WorkflowDefinition", *, supabase, user_id: str
) -> tuple[str, str | None] | None:
    """Rule 1 — reuse ``assert_folder_scopes_subset`` VERBATIM; never re-derive the ⊆ walk.

    That helper is the owner-scoped, cycle-guarded, security-reviewed check (T-098-02); it
    raises ``FolderScopeSubsetError`` (a ``ValueError`` subclass) naming the offending phase
    slug, and is a no-op when the definition is unbound (``project_folder_id is None``).
    Returns ``(message, phase_slug)`` on a violation, else ``None``. Imported
    function-locally so a monkeypatch on ``app.services.harness.scope`` (the Phase-103 test
    seam) is honored.

    THE SLUG TRAVELS STRUCTURALLY (SC#4 / D-182-06). The offending phase rides the
    exception's ``phase_slug`` ATTRIBUTE — it is never recovered by regexing / splitting the
    message. The canvas is a pure client of this seam and must never re-derive a server rule
    from server prose; parsing here would legitimize exactly that pattern one layer down.

    The ``ValueError`` catch below is deliberately NOT narrowed to
    ``FolderScopeSubsetError``: the Phase-103 / Phase-182 test doubles raise a PLAIN
    ``ValueError`` through this same seam, and a future ⊆-path failure may too. Reading the
    slug through ``getattr`` with a ``None`` default degrades such a case to an UNKEYED
    verdict (``phase: None``) instead of an ``AttributeError`` — the ``/validate`` route is
    documented ALWAYS HTTP 200, so a raise here would be a 500 (T-182-10).
    """
    from app.services.harness.scope import assert_folder_scopes_subset  # function-local

    try:
        await assert_folder_scopes_subset(wd, supabase=supabase, user_id=user_id)
    except ValueError as exc:
        return str(exc), getattr(exc, "phase_slug", None)
    return None


async def _folder_scope_violations(
    wd: "WorkflowDefinition", *, supabase, user_id: str
) -> list[tuple[str, str | None]]:
    """Rule 1, PER-NODE — every offending phase, not just the first (Phase 182 WR-04).

    The plural presentation of the sibling above. ``scope.folder_scope_violations`` is the
    ONE ⊆ walk (owner-scoped, cycle-guarded, security-reviewed — T-098-02); this helper
    only maps its violations onto the ``(message, phase_slug)`` shape the collector emits.
    The walk is never re-derived here (D-182-06). Imported function-locally, the same
    posture the singular helper uses — that is what makes a monkeypatch on
    ``app.services.harness.scope`` honored by the tests.

    WHY PLURAL: the canvas needs EVERY offending node at once. Phase 184 paints a badge per
    node from these verdicts (VALID-03), so a short-circuited rule 1 would leave the second
    and third out-of-subtree nodes rendering CLEAN and the author would rediscover them one
    at a time. The singular ``_folder_scope_violation`` above remains the SHORT-CIRCUIT
    presentation NL generation keeps using (``_check_grounding_fidelity`` wants the first
    thing to fix, and its ``detail`` string is byte-identical to the pre-182 contract).

    The slug rides ``getattr(exc, "phase_slug", None)`` — the STRUCTURAL channel 182-04
    built. It is never recovered by regexing or splitting the message; a source guard in
    ``tests/unit/test_182_folder_scope_keying.py`` pins that red line over this whole file.

    CATCH BREADTH IS DELIBERATE AND UNCHANGED. Like the singular helper, this catches
    ``ValueError`` rather than ``FolderScopeSubsetError``, degrading an untyped failure to
    ONE unkeyed verdict instead of raising inside an always-HTTP-200 route (T-182-10).
    Round-2 review WR-03 argues for narrowing it — a ``pydantic.ValidationError`` IS a
    ``ValueError`` subclass in Pydantic v2 and would render as a false ``folder_scope``
    verdict. WR-03 is DEFERRED and explicitly outside this round's operator-selected scope;
    narrowing here would be unrequested scope creep and would break the documented
    degradation contract. Recorded so a future reader sees a decision, not an oversight.
    """
    from app.services.harness.scope import folder_scope_violations  # function-local

    try:
        violations = await folder_scope_violations(wd, supabase=supabase, user_id=user_id)
    except ValueError as exc:
        return [(str(exc), getattr(exc, "phase_slug", None))]
    return [(str(exc), getattr(exc, "phase_slug", None)) for exc in violations]


def _unregistered_tools(phase, tool_names: set[str]) -> list[str]:
    """Rule 2 — the ``available_tools`` entries of one phase that are NOT in the registry
    (order-preserving, so the short-circuit presentation reports the same first offender
    the pre-extraction code did)."""
    return [
        tool
        for tool in (getattr(phase.config, "available_tools", None) or [])
        if tool not in tool_names
    ]


def _unregistered_skill_ref(phase, skill_ids: set[str]) -> str | None:
    """Rule 3 — the phase's ``skill_ref`` as a string when it is NOT in the enabled
    owner/global skill set, else ``None`` (an unset ``skill_ref`` is always clean)."""
    ref = getattr(phase.config, "skill_ref", None)
    if ref is not None and str(ref) not in skill_ids:
        return str(ref)
    return None


# ── presentation A: the per-node collector (POST /workflows/validate, Wave 2) ──


async def grounding_verdicts(
    wd: "WorkflowDefinition",
    *,
    supabase,
    user_id: str,
    tool_names: set[str],
    skill_ids: set[str],
) -> list[dict]:
    """Collect EVERY grounding-fidelity violation as a per-node verdict dict.

    Same three rules as ``_check_grounding_fidelity``, but APPENDING instead of
    short-circuiting (RESEARCH Pattern 2) — the canvas needs all findings at once, keyed
    per node. That holds for ALL THREE rules: rule 1's ⊆ check reports one verdict per
    out-of-subtree phase (WR-04), matching rules 2 and 3. Verdict shape mirrors the publish
    lint block dict
    (``publish_service.py``: ``{"code", "phase", "message"}``); ``phase`` is the phase
    ``slug`` (the 181/183 ``node id == phase.slug`` contract) or ``None`` for a
    workflow-global finding. Severity classification is the ROUTE's job (D-182-03) — this
    collector never classifies, so the rules stay verbatim.
    """
    out: list[dict] = []

    # Rule 1 — PER-NODE *and* PLURAL, exactly like Rules 2 and 3 below. A non-⊆
    # folder_scope is declared PER PHASE, so EVERY offending phase gets its own keyed
    # verdict (WR-04): the slug is threaded off ``FolderScopeSubsetError.phase_slug`` (SC#4)
    # — structurally, never parsed out of the message. The ⊆ walk itself is still the single
    # copy in ``scope.py`` and is never re-derived here (D-182-06). Only a non-typed
    # ``ValueError`` off the ⊆ path leaves ``phase`` as ``None``, as one unkeyed verdict.
    for message, phase_slug in await _folder_scope_violations(
        wd, supabase=supabase, user_id=user_id
    ):
        out.append({"code": "folder_scope", "phase": phase_slug, "message": message})

    # Rules 2 + 3 — per-phase (per-node keying is natural here).
    for phase in wd.phases:
        for tool in _unregistered_tools(phase, tool_names):
            out.append(
                {
                    "code": "unregistered_tool",
                    "phase": phase.slug,
                    "message": f"phase '{phase.slug}' references a non-registered tool {tool!r}",
                }
            )
        ref = _unregistered_skill_ref(phase, skill_ids)
        if ref is not None:
            out.append(
                {
                    "code": "unregistered_skill",
                    "phase": phase.slug,
                    "message": (
                        f"phase '{phase.slug}' references a non-registered skill_ref {ref!r}"
                    ),
                }
            )
    return out


# ── presentation B: the short-circuit dict (NL generation, byte-identical) ─────


async def _check_grounding_fidelity(
    wd: "WorkflowDefinition",
    *,
    supabase,
    user_id: str,
    tool_names: set[str],
    skill_ids: set[str],
) -> dict | None:
    """Grounding FIDELITY (REQ-2 d) — returns a grounding_failed dict on any violation,
    or ``None`` when clean. Three server-side checks the model cannot widen:
      1. every per-phase folder_scope UUID ⊆ the bound project subtree
         (``assert_folder_scopes_subset`` — owner-scoped, raises ValueError on non-⊆);
      2. every ``available_tools`` entry ∈ the real tool registry;
      3. every ``skill_ref`` ∈ the owner/global enabled skill set.

    BYTE-IDENTICAL to the pre-182 ``workflow_authoring._check_grounding_fidelity``: same
    rule order (folder ⊆ first, then per-phase tools then skill_ref), same first-offender
    short-circuit, same ``detail`` message strings.
    """
    violation = await _folder_scope_violation(wd, supabase=supabase, user_id=user_id)
    if violation is not None:
        # ONLY the message reaches ``detail`` — the slug is the per-node collector's
        # concern; this dict stays byte-identical to the pre-182 NL-gen contract.
        return _grounding_failed(violation[0])

    for phase in wd.phases:
        offending = _unregistered_tools(phase, tool_names)
        if offending:
            return _grounding_failed(
                f"phase '{phase.slug}' references a non-registered tool {offending[0]!r}"
            )
        ref = _unregistered_skill_ref(phase, skill_ids)
        if ref is not None:
            return _grounding_failed(
                f"phase '{phase.slug}' references a non-registered skill_ref {ref!r}"
            )
    return None


# ── the shared D-13 publish invariant (Pitfall 4 — one source, even trivial) ───


def business_requirement_missing(definition: "WorkflowDefinition") -> bool:
    """The D-13 publish invariant: a workflow must declare exactly one
    ``business_requirement`` before publish.

    Lifted from the inline predicate at publish stage 1 (``publish_service.py``) so BOTH
    publish and the ``/validate`` seam call ONE copy — a trivial check is still a rule,
    and a copy-pasted rule drifts (Pitfall 4 / D-182-06).
    """
    return not (definition.business_requirement or "").strip()
