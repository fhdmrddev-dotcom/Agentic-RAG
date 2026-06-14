"""Phase 103 (REQ-2 / WFAUTH-02 / D-103-C) — the NL one-shot authoring service.

The describe-first BIRTH path: a domain expert's plain-language description becomes a
single ``model_validate()``-clean, GROUNDED ``WorkflowDefinition`` draft — or an honest
structured failure. It is a thin orchestration over the SHIPPED forced-emit substrate:

  - ``resolve_authoring_model`` mirrors ``resolve_judge_model`` (D-103-2 — the
    independent, confirmed-forceable authoring model; NOT the composer's model).
  - the emit tool is the ``WorkflowDefinition`` JSON schema with OpenAPI ``discriminator``
    keys stripped (Pitfall 7 — Pydantic re-applies the discriminator at
    ``model_validate``, the real strict gate).
  - ``generate_workflow_definition`` assembles server-side grounding (folder tree +
    tool/skill registry + optional template placeholders), forces ONE emit via
    ``forced_emit(schema_model=WorkflowDefinition, strict=False)`` (Pitfall 1 — strict
    OFF so the optional-heavy schema does NOT 400 on OpenAI/DeepSeek), validates,
    retries EXACTLY once on a first-pass failure, then honest-fails (NEVER a partial
    draft), and runs grounding FIDELITY (⊆ subtree + registry membership) after a
    successful validate.

RED LINE (D-01 / G-5): this REUSES ``forced_emit`` → the Phase 092.5 provider gateway.
It NEVER opens the agent loop, NEVER imports a new SDK path, NEVER touches the gateway.
The spike (``scripts/spike-097/authoring_feel.py``) is THROWAWAY — its grounding-assembly
logic is REPRODUCED here, never imported.

Observability (RESEARCH A2): each provider call emits one ``nl_generation_attempt
{attempt: int}`` structured log event (NOT a ``harness_audit`` row — that CHECK is a
closed constraint that would need a migration). The integer attempt index is the ONLY
payload (no prompt / no secret — T-103-02-06).
"""

from __future__ import annotations

import copy
import logging
from typing import Any
from uuid import UUID

from starlette.concurrency import run_in_threadpool

from app.models.harness import WorkflowDefinition

logger = logging.getLogger(__name__)


# The authoring system prompt — instructs the model to compose typed phases into ONE
# valid WorkflowDefinition using ONLY the grounded folder ids / tool names / skill ids /
# placeholders. Copy is Claude's discretion (the contracts are locked, not the prose).
AUTHORING_SYSTEM_PROMPT = (
    "You are a workflow authoring assistant for a knowledge-base agent platform. A "
    "non-coder domain expert describes a recurring knowledge task in plain English; your "
    "job is to translate it into ONE valid WorkflowDefinition by composing typed phases, "
    "then emit it via the `emit_workflow_definition` tool.\n\n"
    "The 6 phase types you can compose (set `phase_type` per phase's `config`):\n"
    "- programmatic: a deterministic registered function (`fn`); no LLM.\n"
    "- llm_single: one LLM completion with a `prompt` (no tools).\n"
    "- llm_agent: an autonomous agent with a `prompt` and an `available_tools` whitelist.\n"
    "- llm_batch_agents: a fan-out of parallel agents over a `prompt` + `available_tools`.\n"
    "- llm_human_input: PAUSE and ask the human (`prompt`, optional `options`) — use for "
    "any 'confirm before finalizing' step.\n"
    "- llm_emit: a sealed forced emission that produces a typed deliverable (`emitter`).\n\n"
    "Rules — these are HARD constraints enforced after you emit:\n"
    "- `available_tools` may ONLY contain tool names from the provided tool registry.\n"
    "- `skill_ref`, if set, MUST be a skill id from the provided skill registry.\n"
    "- A per-phase `folder_scope` MUST contain only folder ids from the provided folder "
    "tree, and only ids inside the bound project subtree; set the definition's "
    "`project_folder_id` when any phase declares a `folder_scope`.\n"
    "- Emit ONLY the schema's fields; do NOT invent keys (extra keys are rejected).\n"
    "- Give each phase a short `slug` and a sequential `phase_index` starting at 0; set "
    "the definition `slug`, `version` (1), `name`, and `status` ('draft')."
)


def resolve_authoring_model(settings) -> str | None:
    """Resolve the NL-authoring model (D-103-2) the same way the judge resolves its model
    (``resolve_judge_model`` — WR-05 discipline). NOT the composer's selected model — a
    fixed, confirmed-forceable strong default so draft quality is consistent and the
    ``emit_workflow_definition`` shot is guaranteed forceable.

    Resolution order:
      1. ``settings.harness_authoring_model`` if set.
      2. else the first registry default in ``("claude-opus-4-8", "gpt-5.5")`` whose
         ``get_model_capability(candidate).get("forced_emission")`` is truthy.
      3. else ``None`` (the caller emits an honest "no authoring model resolved" failure).
    """
    model = getattr(settings, "harness_authoring_model", None)
    if model:
        return model

    from app.config import get_model_capability  # function-local (Pitfall 4 discipline)

    for candidate in ("claude-opus-4-8", "gpt-5.5"):
        cap = get_model_capability(candidate) or {}
        if cap.get("forced_emission"):
            return candidate
    return None


def _strip_discriminator(node):
    """Remove OpenAPI-style ``discriminator`` keys before the schema reaches the emit tool
    (Pitfall 7 — some providers' ``input_schema`` validation rejects them). The ``oneOf``
    variants keep their ``const phase_type`` so the model still picks the right config;
    Pydantic re-applies the discriminator at ``model_validate``, the real strict gate.
    REPRODUCED from the throwaway spike (``authoring_feel.py:241``) — not imported.
    """
    if isinstance(node, dict):
        node.pop("discriminator", None)
        for v in node.values():
            _strip_discriminator(v)
    elif isinstance(node, list):
        for v in node:
            _strip_discriminator(v)
    return node


# Built once at import — the discriminator-stripped WorkflowDefinition schema the emit
# tool advertises. A deepcopy so the model's cached json schema is never mutated.
WF_SCHEMA = _strip_discriminator(copy.deepcopy(WorkflowDefinition.model_json_schema()))

# The emit tool the forced shot names (the FORCE-tier path sets force_tool_name to this).
EMIT_TOOL: dict = {
    "type": "function",
    "function": {
        "name": "emit_workflow_definition",
        "description": "Emit a single valid WorkflowDefinition for this task.",
        "parameters": WF_SCHEMA,
    },
}


def _skill_registry(supabase, user_id: str) -> list[dict]:
    """Owner + global ENABLED skills (service-role bypasses RLS — scope by hand).

    Reproduces the spike's query shape (RESEARCH A3) — ``user_id.eq OR is_global`` +
    an ``is_enabled`` filter. ``skill_ref`` in a PhaseConfig is the skill ``id`` (a UUID),
    so the caller builds the membership set from ``s["id"]``. Synchronous supabase-py is
    wrapped in ``run_in_threadpool`` by the async caller (D-v2.5-01)."""
    try:
        rows = (
            supabase.table("skills")
            .select("id,name,is_global,user_id,is_enabled")
            .or_(f"user_id.eq.{user_id},is_global.eq.true")
            .execute()
            .data
        ) or []
    except Exception:  # noqa: BLE001 — defensive: fall back to a full read + filter client-side
        logger.warning("workflow_authoring: scoped skills read failed; filtering client-side")
        rows = supabase.table("skills").select("id,name,is_global,user_id,is_enabled").execute().data or []
    return [
        r
        for r in rows
        if r.get("is_enabled") and (str(r.get("user_id")) == str(user_id) or r.get("is_global"))
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
        logger.warning("workflow_authoring: template placeholder resolution failed; skipping")
        return []


async def _assemble_grounding(
    *,
    supabase,
    pool,
    user_id: str,
    project_folder_id: str | None,
    template_asset_id: str | None = None,
    template_placeholders: list[str] | None = None,
) -> tuple[str, set[str], set[str]]:
    """Assemble the server-side grounding bundle and return ``(grounded_prompt,
    tool_names, skill_ids)``. All accessors are OWNER-scoped reads; the valid folder /
    tool / skill SETS are computed server-side so KB content can never whitelist itself
    (T-103-02-03; the 101.1-06 precedent)."""
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

    folder_tree = _render_folder_tree(folders)
    skill_lines = (
        "\n".join(f"- {s.get('name')} (id={s['id']})" for s in skills)
        or "(no skills registered)"
    )
    project_line = (
        f"The workflow is BOUND to project folder id={project_folder_id}. Any "
        "per-phase folder_scope must be inside this folder's subtree.\n"
        if project_folder_id
        else "The workflow is NOT bound to a project folder (whole-KB).\n"
    )
    grounded = (
        "## Grounding (use ONLY these ids / names)\n\n"
        f"{project_line}\n"
        "### KB folder tree (name + id)\n"
        f"{folder_tree}\n\n"
        "### Tool registry — names eligible for an `available_tools` whitelist\n"
        f"{', '.join(sorted(tool_names)) or '(none)'}\n\n"
        "### Skill registry (enabled; owner + global) — ids eligible for `skill_ref`\n"
        f"{skill_lines}\n\n"
        "### Template placeholder fields (if the workflow must fill a template)\n"
        f"{', '.join(placeholders) if placeholders else '(none)'}\n"
    )
    return grounded, tool_names, skill_ids


def _grounding_failed(detail: str) -> dict:
    """An honest grounding failure — distinct from model_validate (shape-only). A
    shape-valid but UNGROUNDED draft is a failure, NEVER a draft (T-103-02-04, G-6)."""
    return {"ok": False, "error": "grounding_failed", "detail": detail}


async def _check_grounding_fidelity(
    wd: WorkflowDefinition,
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
    """
    from app.services.harness.scope import assert_folder_scopes_subset  # function-local

    try:
        await assert_folder_scopes_subset(wd, supabase=supabase, user_id=user_id)
    except ValueError as exc:
        return _grounding_failed(str(exc))

    for phase in wd.phases:
        for tool in getattr(phase.config, "available_tools", None) or []:
            if tool not in tool_names:
                return _grounding_failed(
                    f"phase '{phase.slug}' references a non-registered tool {tool!r}"
                )
        ref = getattr(phase.config, "skill_ref", None)
        if ref is not None and str(ref) not in skill_ids:
            return _grounding_failed(
                f"phase '{phase.slug}' references a non-registered skill_ref {str(ref)!r}"
            )
    return None


async def generate_workflow_definition(
    *,
    describe: str,
    supabase,
    user_id: str,
    settings,
    pool: Any = None,
    project_folder_id: "UUID | str | None" = None,
    template_asset_id: "UUID | str | None" = None,
    template_placeholders: list[str] | None = None,
) -> dict:
    """Generate ONE grounded ``WorkflowDefinition`` draft from an NL description.

    Returns on success ``{"ok": True, "definition": <model_dump json>}`` (NOT persisted —
    persistence is REQ-1's explicit ``POST /workflows`` create). On failure returns an
    honest structured error: ``{"ok": False, "error": <code>, "detail": ...}`` where code
    is one of ``no_authoring_model`` / ``could_not_generate`` / ``grounding_failed``. A
    failure NEVER carries a runnable/partial draft (REQ-2 c).

    Provider-call budget (REQ-2 a/b): EXACTLY one call on a valid first emit; EXACTLY two
    (attempt 1 then 2, no third) on a first-pass ValidationError; each call emits one
    ``nl_generation_attempt`` structured-log event.
    """
    from app.config import get_model_capability  # function-local
    from app.services.forced_emit import forced_emit  # function-local

    authoring_model = resolve_authoring_model(settings)
    if authoring_model is None:
        return {
            "ok": False,
            "error": "no_authoring_model",
            "detail": "no authoring model resolved (Settings.harness_authoring_model unset)",
        }
    provider = (get_model_capability(authoring_model) or {}).get("provider")
    if provider is None:
        return {
            "ok": False,
            "error": "no_authoring_model",
            "detail": f"no provider for authoring model {authoring_model!r}",
        }

    project_id_str = str(project_folder_id) if project_folder_id is not None else None
    grounded_prompt, tool_names, skill_ids = await _assemble_grounding(
        supabase=supabase,
        pool=pool,
        user_id=user_id,
        project_folder_id=project_id_str,
        template_asset_id=str(template_asset_id) if template_asset_id is not None else None,
        template_placeholders=template_placeholders,
    )

    base_messages = [
        {"role": "user", "content": grounded_prompt + "\n\n## The task to author\n" + describe}
    ]

    async def _shot(messages: list[dict], attempt: int) -> dict:
        # RESEARCH A2: a structured log event (NOT a harness_audit row — closed CHECK).
        # The integer attempt index is the ONLY payload (T-103-02-06 — no prompt/secret).
        logger.info("nl_generation_attempt", extra={"attempt": attempt})
        return await forced_emit(
            messages=messages,
            model=authoring_model,
            provider=provider,
            emitter="emit_workflow_definition",
            tools=[EMIT_TOOL],
            user_settings=settings,
            system_prompt=AUTHORING_SYSTEM_PROMPT,
            schema_model=WorkflowDefinition,
            strict=False,  # Pitfall 1: force-without-strict for the optional-heavy schema
        )

    res1 = await _shot(base_messages, 1)
    wd = res1.get("emitted")

    if wd is None:
        # EXACTLY one retry with the failure fed back (REQ-2 b — no third call).
        err = res1.get("failure") or "validation_failed"
        retry_messages = base_messages + [
            {"role": "assistant", "content": "(the previous emission failed validation)"},
            {
                "role": "user",
                "content": (
                    f"Your emission failed strict validation:\n{err}\n"
                    "Re-emit a COMPLETE valid WorkflowDefinition using ONLY schema fields."
                ),
            },
        ]
        res2 = await _shot(retry_messages, 2)
        wd = res2.get("emitted")
        if wd is None:
            return {
                "ok": False,
                "error": "could_not_generate",
                "detail": res2.get("failure") or "model_failed_to_emit",
            }

    # Grounding fidelity (only on a non-None wd) — distinct from model_validate.
    fidelity = await _check_grounding_fidelity(
        wd, supabase=supabase, user_id=user_id, tool_names=tool_names, skill_ids=skill_ids
    )
    if fidelity is not None:
        return fidelity

    return {"ok": True, "definition": wd.model_dump(mode="json")}
