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

OWNER SCOPING (V4 / T-182-03 / T-103-02-03): every read is scoped by hand on ``user_id``
(the service runs as service-role, which bypasses RLS). The palette must NEVER widen to
another user's folders or skills — KB content can never whitelist itself.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from starlette.concurrency import run_in_threadpool

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
    skills: list[dict] = field(default_factory=list)  # enabled owner + org-shared skills
    skill_ids: set[str] = field(default_factory=set)  # membership set for fidelity
    placeholders: list[str] = field(default_factory=list)  # template placeholder fields


# ── moved verbatim from workflow_authoring (Phase 103) ────────────────────────


def _skill_registry(supabase, user_id: str) -> list[dict]:
    """Owner + global ENABLED skills (service-role bypasses RLS — scope by hand).

    Reproduces the spike's query shape (RESEARCH A3) — ``user_id.eq OR is_org_shared`` +
    an ``is_enabled`` filter. ``skill_ref`` in a PhaseConfig is the skill ``id`` (a UUID),
    so the caller builds the membership set from ``s["id"]``.

    BLOCKING-I/O CONTRACT (IR-01 / D-v2.5-01): this is a plain ``def`` and calls
    synchronous ``supabase-py``. It MUST be invoked via ``run_in_threadpool`` (it is —
    ``assemble_grounding_bundle`` wraps it). NEVER call it directly from an async handler
    or the blocking read lands on the event loop."""
    try:
        rows = (
            supabase.table("skills")
            .select("id,name,is_org_shared,user_id,is_enabled")
            .or_(f"user_id.eq.{user_id},is_org_shared.eq.true")
            .execute()
            .data
        ) or []
    except Exception:  # noqa: BLE001 — CR-01: a scoped read miss must FAIL CLOSED, never widen scope.
        # The service runs as service-role (RLS-bypassing). A bare full-table fallback
        # would pull EVERY user's skill rows over the wire and lean on a Python-side
        # filter — fragile and a scope-leak risk on orphaned/None user_id rows. Retry
        # with the SAME owner+global predicate pushed down to the DB; if that also
        # fails, return [] (no skill grounding) rather than a possibly-polluted set.
        logger.warning("grounding: scoped skills read failed; retrying owner-scoped, else empty")
        try:
            rows = (
                supabase.table("skills")
                .select("id,name,is_org_shared,user_id,is_enabled")
                .or_(f"user_id.eq.{user_id},is_org_shared.eq.true")
                .execute()
                .data
            ) or []
        except Exception:  # noqa: BLE001 — fail closed: no skills rather than cross-user names.
            logger.warning("grounding: owner-scoped skills retry failed; using empty skill set")
            rows = []
    return [
        r
        for r in rows
        if r.get("is_enabled") and (str(r.get("user_id")) == str(user_id) or r.get("is_org_shared"))
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
    from app.utils.folder_utils import fetch_visible_folders  # function-local

    folders = await fetch_visible_folders(supabase, user_id)
    tool_names = {t["function"]["name"] for t in get_tools(None)}
    skills = await run_in_threadpool(_skill_registry, supabase, user_id)
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


# ── the three atomic grounding-fidelity rules (the ONE copy) ──────────────────
#
# Rule 1: every per-phase ``folder_scope`` UUID ⊆ the bound project subtree.
# Rule 2: every ``available_tools`` entry ∈ the real tool registry.
# Rule 3: every ``skill_ref`` ∈ the owner/global ENABLED skill set.
#
# Both presentations below (short-circuit dict for NL-gen, per-node list for /validate)
# call THESE helpers — there is no second implementation of any rule (D-182-06).


async def _folder_scope_violation(wd: "WorkflowDefinition", *, supabase, user_id: str) -> str | None:
    """Rule 1 — reuse ``assert_folder_scopes_subset`` VERBATIM; never re-derive the ⊆ walk.

    That helper is the owner-scoped, cycle-guarded, security-reviewed check (T-098-02); it
    raises ``ValueError`` naming the offending phase slug, and is a no-op when the
    definition is unbound (``project_folder_id is None``). Returns the raised message on a
    violation, else ``None``. Imported function-locally so a monkeypatch on
    ``app.services.harness.scope`` (the Phase-103 test seam) is honored.
    """
    from app.services.harness.scope import assert_folder_scopes_subset  # function-local

    try:
        await assert_folder_scopes_subset(wd, supabase=supabase, user_id=user_id)
    except ValueError as exc:
        return str(exc)
    return None


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
    per node. Verdict shape mirrors the publish lint block dict
    (``publish_service.py``: ``{"code", "phase", "message"}``); ``phase`` is the phase
    ``slug`` (the 181/183 ``node id == phase.slug`` contract) or ``None`` for a
    workflow-global finding. Severity classification is the ROUTE's job (D-182-03) — this
    collector never classifies, so the rules stay verbatim.
    """
    out: list[dict] = []

    # Rule 1 — workflow-global (the offending phase slug is inside the message).
    violation = await _folder_scope_violation(wd, supabase=supabase, user_id=user_id)
    if violation is not None:
        out.append({"code": "folder_scope", "phase": None, "message": violation})

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
        return _grounding_failed(violation)

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
