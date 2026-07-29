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

THE SECOND ORG DIMENSION (round-2 gap closure — WR-05). Gating on the CALLER's org membership
answers "what can this person see". A caller acting ON BEHALF OF a definition — the publish
gate — must be narrowed FURTHER, to that definition's own org, or the gate answers "can the
publisher see this?" when the question is "is this definition grounded in its own org?". For a
multi-org author the two answers differ, and the one that matters is the RUNNER's: at run time
``tool_dispatcher``'s skill resolution and ``fetch_visible_folders`` gate on the runner's org
set, so a definition green-lit on the publisher's wider view silently under-performs for every
colleague. The optional ``restrict_org_ids`` keyword carries that narrowing; it is applied at
the two points where the caller's org set is ALREADY resolved (here for skills, inside
``folder_utils.fetch_visible_folders`` for folders), so no visibility rule is duplicated —
``_skill_registry`` keeps calling the ONE shared predicate and simply receives a smaller set.
Same family as SEED-124 / SEED-125 (org-blind service-role reads), one layer up: the read IS
org-gated, the SCOPE of the gate was wrong. ``None`` means no restriction, so every caller
that omits it — NL generation, ``/validate``, the palette route — is byte-identical.
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
    # Phase 185 (GOVERN-01 / D-185-09) — the KB-reading tool names, carried so the ONE
    # bundle assembler stays the ONE computation and the palette route serializes a field
    # rather than reaching for the constant itself. This is the safety-DEFINING list, NOT a
    # per-caller registry read: unlike `tools` / `folders` / `skills` it does not depend on
    # who is asking, and it is populated UNCONDITIONALLY — INCLUDING on the `degraded` path
    # below. A folders/skills outage must never silently un-mark a locked step: "we could
    # not read your palette" is a different sentence from "this step reads nothing".
    kb_tools: list[str] = field(default_factory=list)  # == KB_TOOLS_SORTED (the wire form)
    # THE ONE DEGRADATION SIGNAL (round-2 gap closure — WR-01 / WR-02 / WR-07). The set of
    # registry names that could NOT be resolved for this bundle; currently ``"folders"``
    # and/or ``"skills"``. Declared last because a dataclass field with a default must follow
    # the other defaulted fields.
    #
    # THE CONTRACT BOTH CONSUMERS RELY ON: when ``degraded`` is non-empty the grounding
    # FIDELITY rules MUST NOT be run and MUST NOT be reported. An unresolved registry makes
    # every membership test vacuously false, and a vacuously-false membership test does not
    # read to the author as "we could not check" — it reads as a specific, factual accusation
    # against a definition that is actually correct (WR-01: every valid phase skill reference
    # reported unregistered because a read 5xx'd). Both consumers instead emit the ONE shared
    # ``grounding_unavailable_finding`` below.
    degraded: frozenset[str] = frozenset()


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
    malformed id must RAISE, never break out of the DSL.

    FAIL-CLOSED, ONE LAYER UP (round-2 gap closure — WR-01). This function used to end its
    read in ``except Exception: ... return []``. The fail-closed DECISION has not been
    abandoned; it MOVED to the only caller that can describe it honestly. The service runs as
    service-role (RLS-bypassing), so there is still no safe fallback read — a bare full-table
    query would pull EVERY org's skill rows over the wire — and ``assemble_grounding_bundle``
    still yields NO skill grounding when this read fails. What it additionally does now is
    RECORD the failure on ``GroundingBundle.degraded``. That difference is the whole finding:
    a swallow here produced a bundle that looked HEALTHY with an empty registry, so both
    consumers reported every valid phase skill reference as unregistered — "this skill does
    not exist" instead of "we could not check". A read failure therefore PROPAGATES from here.

    Same consequence for the identity path, and it is an improvement: a malformed caller id
    raised by ``coerce_uid`` now also surfaces as a bundle degradation rather than as an
    unhandled error, which is strictly better on a route documented ALWAYS HTTP 200.

    BLOCKING-I/O CONTRACT (IR-01 / D-v2.5-01): this is a plain ``def`` and calls
    synchronous ``supabase-py``. It MUST be invoked via ``run_in_threadpool`` (it is —
    ``assemble_grounding_bundle`` wraps it). NEVER call it directly from an async handler
    or the blocking read lands on the event loop."""
    caller = coerce_uid(user_id)
    org_ids = {coerce_uid(o) for o in (caller_org_ids or set())}
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
    restrict_org_ids: set[str] | None = None,
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

    NEVER RAISES ON A REGISTRY FAILURE (round-2 gap closure — WR-01 / WR-02 / WR-07). Both
    DB-backed reads are guarded here and their failure is RECORDED on ``bundle.degraded``
    rather than propagated or swallowed. This is the ONE place the degradation decision is
    made; ``/validate``, ``GET /workflows/grounding-bundle`` and publish stage 2.6 all branch on
    the result — the first and third mint the ONE shared ``grounding_unavailable_finding``, the
    palette route surfaces the same signal as its own ``degraded`` field.

    NL generation (``workflow_authoring``) is the fourth consumer and is the ONE that still does
    not branch. That is a KNOWN GAP, not a safe design: this docstring previously defended it by
    claiming "its own fidelity check re-reads the folder tree through the ⊆ walk, so its
    behaviour is unchanged by this guard" — and that claim is FALSE for the common case. A
    freshly NL-generated draft has no ``project_folder_id`` yet, and ``scope.resolve_project_
    subtree`` returns ``None`` for an unbound definition (``scope.py:124-125``), so the ⊆ walk is
    a no-op that re-reads nothing. A folders-read failure during NL generation therefore yields a
    folder-blind draft presented as ``{"ok": True}``. Tracked as SEED-133; do not re-derive the
    disproven claim.

    ``restrict_org_ids`` (WR-05, keyword-only) narrows BOTH org-gated reads to a specific org
    set. The polarity is load-bearing and identical to ``fetch_visible_folders``' (T-182-54):

      * ``None``  — NO restriction. Every caller that omits it (NL generation, ``/validate``,
        the ``GET /grounding-bundle`` palette) is byte-identical to before this parameter.
      * ``set()`` — an EMPTY restriction means NO org-shared visibility: only owned folders,
        and — via ``_skill_registry``'s already-documented fail-closed contract — only
        ``is_system`` skills. That is the FAIL-CLOSED direction and is the CORRECT answer for
        a definition whose org resolves to nothing. It must never be read as "unrestricted".

    ONE INTERSECTION, NO SECOND PREDICATE. The folders half is applied inside
    ``fetch_visible_folders`` (the one place its org set is resolved); the skills half is
    applied HERE, immediately after ``_resolve_caller_org_ids``, BEFORE the set reaches
    ``_skill_registry``. ``_skill_registry`` therefore keeps applying the ONE shared
    ``app.utils.skill_visibility`` rule verbatim — both encodings of it — and simply receives a
    narrower org set. Re-filtering its RESULT here instead would be a second copy of the
    visibility rule, and a post-filter that drifts from the pushed-down query is precisely how
    SEED-124 / SEED-125 happened.
    """
    from app.services.openai_service import get_tools  # function-local
    from app.utils.folder_utils import (  # function-local
        _resolve_caller_org_ids,
        fetch_visible_folders,
    )

    degraded: set[str] = set()

    # WHY ``strict=True`` HERE COVERS THE ⊆ WALK TOO (WR-07). This function runs FIRST on BOTH
    # consumers (``/validate`` and publish stage 2.6), and it performs the SAME
    # ``fetch_visible_folders`` read that ``scope.resolve_project_subtree`` will later perform
    # against the SAME table under the SAME PostgREST ``max-rows`` cap. So a truncation is
    # detected before the ⊆ walk is ever reached, and the consumer skips the fidelity rules
    # entirely rather than accusing a correct definition of a ``folder_scope`` violation.
    # BOUNDED RESIDUAL, recorded honestly: the two reads are separate round-trips, so a
    # truncation that appears ONLY on the second one is not caught by this check.
    # ``restrict_org_ids`` forwarded only when set — the seam-contract rule written out in
    # ``scope.resolve_project_subtree``. ``strict=True`` stays unconditional: it is plan
    # 182-11's, it is this call site's whole reason for existing, and it is already part of
    # this seam's contract.
    _org_kw = {} if restrict_org_ids is None else {"restrict_org_ids": restrict_org_ids}
    try:
        folders = await fetch_visible_folders(supabase, user_id, strict=True, **_org_kw)
    except Exception:  # noqa: BLE001 — an unreadable registry is a degradation, not a verdict
        logger.warning(
            "grounding: visible-folders read failed or was truncated; folder grounding is "
            "unavailable for this bundle",
            exc_info=True,
        )
        folders = []
        degraded.add("folders")

    tool_names = {t["function"]["name"] for t in get_tools(None)}

    # CR-01 — the caller's org set gates the skill read. Resolved HERE, in the async caller,
    # because ``_skill_registry`` is sync-by-contract (D-v2.5-01) and must not do its own
    # ``org_members`` round-trip; it receives the set and applies the shared rule. This is the
    # same fail-closed resolver the SEED-124 folder fix uses, and it adds no new failure mode:
    # ``fetch_visible_folders`` on the line above already calls it internally (the duplicate
    # round-trip is one small indexed read — folder_utils' signature is contractually fixed).
    #
    # WR-01: the guard that used to live INSIDE ``_skill_registry`` lives here now, with the
    # SAME warning text so the operational signal is unchanged — but it also records the
    # degradation, which is the half the swallow could not express.
    try:
        caller_org_ids = await _resolve_caller_org_ids(supabase, user_id)
        # WR-05 — THE ONE INTERSECTION for skills, at the single point the caller's org set is
        # resolved and BEFORE it reaches the shared visibility rule. Both sides coerced to
        # ``str`` so a UUID object and its string form compare equal. ``None`` = unrestricted;
        # an empty result set is fail-closed (only ``is_system`` skills resolve), never a
        # bypass — see this function's docstring for why that polarity is load-bearing.
        if restrict_org_ids is not None:
            _allowed = {str(o) for o in restrict_org_ids}
            caller_org_ids = {o for o in caller_org_ids if str(o) in _allowed}
        skills = await run_in_threadpool(_skill_registry, supabase, user_id, caller_org_ids)
    except Exception:  # noqa: BLE001 — a gated read miss must FAIL CLOSED, never widen scope.
        logger.warning(
            "grounding: org-gated skills read failed; using empty skill set", exc_info=True
        )
        skills = []
        degraded.add("skills")

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
        # D-185-09 — the ONE computation stays here, not in the palette route. Placed
        # OUTSIDE every ``try`` above on purpose: it is a module constant, it cannot fail,
        # and a degraded registry read must not blank it (see the field's own comment).
        kb_tools=KB_TOOLS_SORTED,
        degraded=frozenset(degraded),
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
# STILL NOT INCLUDED, for a DIFFERENT reason now — the degraded code below. Until the
# round-2 gap closure it was publish-only ("its canonical home is publish_service.py"); that
# is no longer true. Both consumers of this module's collector now mint it, from the ONE
# shared builder ``grounding_unavailable_finding``, and ``/validate`` composes it into its
# known-code set. It stays OUT of this frozenset because this frozenset means exactly one
# thing — the codes ``grounding_verdicts`` itself emits — and ``grounding_verdicts`` does not
# emit it. It is an infrastructure-honesty code, not a rule finding.
GROUNDING_VERDICT_CODES: frozenset[str] = frozenset(
    {
        "folder_scope",
        "unregistered_skill",
        "unregistered_tool",
    }
)


# ── the ONE honest degraded finding, shared by BOTH consumers (WR-01 / WR-02) ──

# The code string lives HERE so neither consumer carries a literal: ``/validate`` composes it
# into ``workflows._DEGRADED_CODES`` and publish stage 2.6 returns the builder's dict verbatim.
GROUNDING_UNAVAILABLE_CODE: str = "grounding_unavailable"


def grounding_unavailable_finding(degraded: frozenset[str] | None = None) -> dict:
    """The ``{code, phase, message}`` finding for "we could not CHECK" — the one copy.

    ``phase`` is ``None``: an unreachable registry is not attributable to a node, and keying
    it to one would re-create the very confusion this finding exists to remove. When the
    unresolved registries are known (``bundle.degraded``) the message NAMES them; otherwise it
    falls back to the exact wording ``publish_service`` has emitted since plan 182-06, so that
    path's user-visible message is byte-identical to before.

    The message names registry KINDS only — never rows, ids, counts, connection strings or
    driver text (T-182-49). The underlying exception is logged server-side with ``exc_info``
    and never serialized to the caller.

    BUILT FROM THE CONSTANT, NEVER FROM A QUOTED LITERAL — and that is load-bearing, not
    style. ``tests/unit/test_182_severity_codes.py``'s drift scanner matches the token
    sequence ``"code": "<name>"`` in THIS file's source (docstrings included, since it strips
    only whole-line comments). A literal here would make the scanner demand this code join
    ``GROUNDING_VERDICT_CODES``, which would be wrong — ``grounding_verdicts`` does not emit
    it. The scanner therefore cannot see this code at all, so the link between the published
    constant and ``/validate``'s classifier is pinned by an explicit assertion instead, in
    ``tests/unit/test_182_grounding_degradation.py``.
    """
    if degraded:
        message = (
            "the grounding registry could not be resolved "
            f"({', '.join(sorted(degraded))}), so grounding fidelity could not be verified — "
            "this reports what we could not CHECK, not a problem with the definition"
        )
    else:
        message = (
            "the grounding registry could not be resolved, so grounding fidelity "
            "could not be verified — publish is blocked"
        )
    return {"code": GROUNDING_UNAVAILABLE_CODE, "phase": None, "message": message}


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
    wd: "WorkflowDefinition",
    *,
    supabase,
    user_id: str,
    restrict_org_ids: set[str] | None = None,
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

    ``restrict_org_ids`` (WR-05, default ``None`` = no restriction) is passed straight through
    to the ⊆ walk's folder read so the PUBLISH gate evaluates rule 1 against the DEFINITION's
    org rather than its multi-org author's union. Only the PLURAL helper carries it: the
    singular ``_folder_scope_violation`` above serves NL generation, which runs in the author's
    OWN context, not on behalf of a definition.
    """
    from app.services.harness.scope import folder_scope_violations  # function-local

    # Forwarded only when set — the seam-contract rule written out in
    # ``scope.resolve_project_subtree``. This call is a monkeypatch seam in three suites.
    _org_kw = {} if restrict_org_ids is None else {"restrict_org_ids": restrict_org_ids}
    try:
        violations = await folder_scope_violations(
            wd, supabase=supabase, user_id=user_id, **_org_kw
        )
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
    restrict_org_ids: set[str] | None = None,
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

    ``restrict_org_ids`` (WR-05, keyword-only, default ``None`` = no restriction) reaches rule
    1's folder read only — rules 2 and 3 test membership against the ``tool_names`` /
    ``skill_ids`` sets the CALLER computed, so the caller narrows those by passing the same
    restriction to ``assemble_grounding_bundle``. Both halves of the publish gate therefore
    share one restriction, read once from the definition's own ``org_id``.
    """
    out: list[dict] = []

    # Rule 1 — PER-NODE *and* PLURAL, exactly like Rules 2 and 3 below. A non-⊆
    # folder_scope is declared PER PHASE, so EVERY offending phase gets its own keyed
    # verdict (WR-04): the slug is threaded off ``FolderScopeSubsetError.phase_slug`` (SC#4)
    # — structurally, never parsed out of the message. The ⊆ walk itself is still the single
    # copy in ``scope.py`` and is never re-derived here (D-182-06). Only a non-typed
    # ``ValueError`` off the ⊆ path leaves ``phase`` as ``None``, as one unkeyed verdict.
    for message, phase_slug in await _folder_scope_violations(
        wd, supabase=supabase, user_id=user_id, restrict_org_ids=restrict_org_ids
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


# ── Phase 185 (GOVERN-01 / D-185-09) — the KB-reading rule ────────────────────
#
# THE ONE HOME, and the reason it is here rather than in the canvas: this list DEFINES
# which steps are governed, so a second copy is a safety hole, not a duplication smell.
# The day a 6th KB tool lands, a frontend constant would silently stop marking it and the
# author would see an ungoverned step that the engine gates anyway. That is the exact drift
# D-182-06's RED LINE (see this module's docblock) was written against. The client receives
# this list as DATA on ``GET /workflows/grounding-bundle`` and performs only the trivial set
# intersection, for zero-lag display; it never enforces.


KB_TOOLS: frozenset[str] = frozenset({
    "search_documents", "query_documents", "read_document",
    "analyze_document", "get_related_documents",
})
# The wire/JSON form, mirroring how ``GroundingBundle`` already carries ``tools: list[str]``
# (JSON-friendly, sorted) beside ``tool_names: set[str]`` (membership) for the same values.
KB_TOOLS_SORTED: list[str] = sorted(KB_TOOLS)


def grounding_cause(phase) -> str | None:
    """Why this phase is locked to *must prove it* — ``"detected"`` / ``"already-set"`` /
    ``"escalated"``, or ``None`` when it is free to think.

    PURE, ZERO I/O, NO DB POOL. Unlike almost everything else in this module — which reads
    the folder tree and the skill registry — this is a total function of one already-parsed
    ``PhaseSpec``. Do not assume a pool is needed to call it.

    D-185-07: only ``escalated`` is ever AUTHORED. ``detected`` and ``already-set`` are
    recomputed here, every read, from data already in the row, and are NEVER persisted. That
    is what makes SPEC Req 3 structural: there is no representable value that says a detected
    step is free to think, so a stale or hand-edited JSONB row cannot claim one.

    **THE BRANCH ORDER IS LOAD-BEARING AND MUST NOT BE REORDERED.** Checking ``detected``
    FIRST is what makes "detection wins and the undo disappears" true by construction rather
    than by a rule somebody has to keep enforcing: an escalated step that later gains
    ``search_documents`` reports ``detected``, and its stored ``grounding_escalated: True``
    simply goes inert — the author is offered no undo, because the cause is no longer theirs.
    Remove the tool again and the cause falls back to ``escalated``, undo included.

    ``folder_scope`` is deliberately NOT an input. It exists on all five LLM config members
    (including ``llm_single``, which has no tools at all), so reading it would auto-lock steps
    that read nothing — and a step with no retrieval path can never satisfy the gate.
    ``getattr(..., None)`` is this module's shipped totality idiom for the discriminated
    config union: only some members carry ``available_tools`` / ``citation_policy``.
    """
    if set(getattr(phase.config, "available_tools", None) or ()) & KB_TOOLS:
        return "detected"
    if getattr(phase.config, "citation_policy", None) == "strict":
        return "already-set"
    if getattr(phase, "grounding_escalated", False):
        return "escalated"
    return None
