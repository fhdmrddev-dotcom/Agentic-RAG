from __future__ import annotations

import json
import logging
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.config import get_model_capability, settings
from app.models.expert import PromptSuggestion


class DraftPromptSuggestion(BaseModel):
    """Phase 261 (BUG-260921-01a) — a DRAFT tile, with a floor on the prompt body.

    Deliberately NOT ``models.expert.PromptSuggestion``: that model is also the read
    shape for every persisted bundle, and tightening it would make an older thin row
    unreadable. The floor belongs where the content is GENERATED, not where it is read.
    """

    title: str = Field(..., min_length=3, max_length=60, description="Crisp action-oriented button label")
    prompt: str = Field(..., min_length=150, description="Detailed multi-sentence starter prompt (2-3 sentences minimum)")


class SuggestedNewSkill(BaseModel):
    """Phase 263 (PACK-14 / D-263-02) — a domain skill the library does NOT have yet.

    Mirrors ``DraftPromptSuggestion``'s reasoning, not just its shape: this is a DRAFT-only
    model, deliberately NOT a persisted read shape. A proposal is CREATED here and then
    handed to the existing ``POST /skills`` write path (D-263-03), so the floors belong
    where the content is GENERATED — tightening a persisted model would make an older thin
    row unreadable, which is the mistake BUG-260921-01a already paid for once.
    """

    name: str = Field(..., min_length=3, max_length=80, description="kebab-case name of a domain skill that is NOT in the provided available skills")
    description: str = Field(..., min_length=40, max_length=240, description="one line saying what this skill would do")
    why_needed: str = Field(..., min_length=40, description="why this Expert's blueprint requires it")
from app.services.forced_emit import forced_emit

logger = logging.getLogger(__name__)

ScopeMode = Literal["biased", "restricted"]


class ExpertDraftOutput(BaseModel):
    """Phase 261 (BUG-260921-01a) — THE SCHEMA IS THE CONTRACT.

    ⛔ Every substantive field used to carry a Pydantic default, so a model that returned
    one thin sentence validated perfectly and richness was a lottery: measured on ONE
    identical prompt, ``description`` came back 293 chars on one run and 2163 on another,
    and ``example_output`` 164 chars then 6. The system prompt asked for richness; nothing
    ever checked. These floors are what turns the ask into a requirement.

    ⭐ A floor is SAFE here because ``forced_emit`` runs a recovery LADDER: a rung whose
    payload fails ``model_validate`` re-drives the next rung rather than going dark, so a
    thin first answer is re-asked instead of accepted. The honest floor below every rung
    is ``_generate_fallback_draft``.
    """

    name: str = Field(..., min_length=3, max_length=120, description="Authoritative professional domain title")
    slug: str = Field(..., min_length=3, max_length=120, description="URL-safe kebab-case slug for the expert")
    icon: str = Field(..., description="Lucide vector glyph name (one of: book, scale, chart, shield, briefcase, truck, terminal, cpu, database, file-text)")
    category: str = Field(..., min_length=3, max_length=60, description="Domain category classification")
    when_to_use: str = Field(..., min_length=40, max_length=240, description="One or two sentences on when and why to summon this expert (max 240 chars — it renders as a one-liner on the Expert card)")
    example_output: str = Field(..., min_length=120, description="Realistic, concrete sample excerpt of the expert's deliverable")
    description: str = Field(..., min_length=400, description="COMPREHENSIVE operating blueprint: mandate, methodologies, rubrics, quality standards, procedures (2-3 rich paragraphs)")
    scope_mode: ScopeMode = Field(default="biased", description="Knowledge composition mode (defaults to biased per D-v4.3-01)")
    tool_floor_enabled: bool = Field(default=True, description="Whether deliverable tools are kept as additive floor")
    prompt_suggestions: list[DraftPromptSuggestion] = Field(..., min_length=3, max_length=3, description="Exactly 3 starter Action Tiles")
    member_skills: list[str] = Field(..., description="Skill names selected from the provided available skills (may be empty when none match)")
    knowledge_folder_ids: list[UUID] = Field(..., description="Folder UUIDs selected from the provided available folders (may be empty)")
    required_connections: list[str] = Field(..., description="Connection slugs selected from the provided available connections (may be empty)")
    suggested_new_skills: list[SuggestedNewSkill] = Field(..., min_length=0, description="Domain skills this Expert needs that do NOT exist in the provided available skills. An EMPTY list is a real answer.")
    # Phase 263 (D-263-02): REQUIRED, never ``Field(default=[])``. A default is the exact
    # shape 757bb9e25 had to undo — with one, a model returning nothing validates perfectly
    # and richness becomes a lottery. ``min_length=0`` enforces NOTHING; it is kept for what
    # it DOCUMENTS ("empty is a real answer"), not for what it checks.
    #
    # ⚠ THE SAFETY ARGUMENT IS THINNER THAN CONTEXT.md IMPLIES, and it is recorded here
    # rather than repeated in its stronger form. ``generate_expert_draft`` passes
    # ``strict=False``, and ``forced_emit:490-491`` SKIPS the ``strict_force`` rung whenever
    # ``strict is False``. So on a ``force_strict``-tier model the recovery ladder is TWO
    # rungs, not three: a required field gets exactly ONE retry before the honest floor.
    # ``_generate_fallback_draft`` is that floor, which is why it constructs this field too.


def _flatten_nullable(node: Any) -> Any:
    if isinstance(node, dict):
        any_of = node.get("anyOf")
        if isinstance(any_of, list):
            non_null = [b for b in any_of if not (isinstance(b, dict) and b.get("type") == "null")]
            if len(non_null) == 1:
                collapsed = {k: v for k, v in node.items() if k not in ("anyOf", "default")}
                collapsed.update(non_null[0])
                return _flatten_nullable(collapsed)
        return {k: _flatten_nullable(v) for k, v in node.items()}
    if isinstance(node, list):
        return [_flatten_nullable(v) for v in node]
    return node


def _emit_tool(emitter: str, schema_model: type[BaseModel]) -> list[dict]:
    return [
        {
            "type": "function",
            "function": {
                "name": emitter,
                "description": f"Emit the structured result per the {schema_model.__name__} schema.",
                "parameters": _flatten_nullable(schema_model.model_json_schema()),
            },
        }
    ]


_EXPERT_DRAFTER_SYSTEM_PROMPT = """You are an elite AI Architect and Consultant specializing in authoring Domain Expert personas for an enterprise agentic platform.
An Expert is NOT a simple tool or single-function skill; it is an autonomous, high-caliber specialist endowed with intensive capabilities, sophisticated domain frameworks, and rigorous analytical standards.

When drafting an Expert from the user's high-level goal, you must synthesize and pre-populate an exhaustive, turnkey configuration from A to Z:

1. 'name': Authoritative, professional domain title (e.g. 'Academic Literature & Thesis Reviewer', 'Senior M&A & Corporate Structuring Counsel', 'Enterprise Cloud & DevOps Architect'). Avoid generic names or copying user filler phrases.
2. 'slug': Clean, URL-safe kebab-case slug matching the name (e.g. 'academic-thesis-reviewer').
3. 'icon': Choose the most fitting vector glyph from: book, scale, chart, shield, briefcase, truck, terminal, cpu, database, file-text.
4. 'category': Appropriate domain classification (e.g., 'Research & Academia', 'Legal & Compliance', 'Finance & Accounting', 'Human Resources', 'Engineering', 'Operations', 'General').
5. 'when_to_use': One or two crisp sentences (40-240 chars, HARD LIMIT 240 — it renders as a one-liner on the Expert card) stating exactly when and why users should summon this expert.
6. 'example_output': A realistic, rich, and concrete sample excerpt of the expert's deliverable (e.g. a structured literature matrix, gap analysis, methodology audit, or policy memorandum).
7. 'description': COMPREHENSIVE, INTENSIVE, AND DETAILED (2-3 rich paragraphs). Do NOT simply repeat the user's prompt. Formulate an in-depth operating blueprint detailing:
   - The expert's core mandate, domain philosophy, and specialized competencies.
   - Specific methodologies, analytical frameworks, and evaluation rubrics applied.
   - Critical quality standards, fact-checking/citation rigor, and output expectations.
   - Step-by-step procedures for handling complex user requests in this domain.
8. 'prompt_suggestions': Exactly 3 high-impact Action Tiles [{title, prompt}] representing 1-click powerhouse tasks. Each tile must have:
   - 'title': Crisp, action-oriented button label (e.g. 'Synthesize Literature Gap', 'Audit Research Methodology', 'Structure Thesis Outline').
   - 'prompt': A detailed, multi-sentence starter prompt template (2-3 sentences) instructing the expert on how to execute that action with maximum academic/professional rigor.
9. 'scope_mode': MUST be 'biased' (Union Scope) as the universal platform default. Never use 'restricted' unless the user prompt specifically commands strict isolation.
10. 'tool_floor_enabled': Set to true so deliverable tools (code execution, file writing, template rendering) are active.
11. 'member_skills': Select all matching skill names from the provided available skills. ONLY names that appear verbatim in that list — never invent one.
12. 'knowledge_folder_ids': Select relevant folder UUIDs from the provided available knowledge folders that align with this domain.
13. 'required_connections': Select relevant connection slugs from the provided available connections.
14. 'suggested_new_skills': For every domain capability this Expert's description requires that is NOT present in the provided available skills, emit one entry {name, description, why_needed}. Use kebab-case names. Emit an EMPTY list when the available skills already cover the domain — an empty list is a real answer, not a failure. NEVER put a name from this list into member_skills.
"""


import re


def _generate_fallback_draft(
    description: str,
    brainstorm_text: str | None = None,
    available_folders: list[dict[str, Any]] | None = None,
    available_skills: list[dict[str, Any]] | None = None,
    available_connections: list[dict[str, Any]] | None = None,
) -> ExpertDraftOutput:
    """Deterministic fallback draft when LLM emission is unavailable (e.g. offline/mock environments)."""
    raw_desc = (description or "Specialized Domain Expert").strip()

    # Clean out user prompt prefixes (e.g. "I want an expert that is specialised in...")
    clean_core = raw_desc
    patterns = [
        r"^(?:please\s+)?(?:i\s+want|i\s+need|create|build|author|draft|generate)?\s*(?:an?\s+)?(?:expert|specialist|assistant|agent|consultant)?\s*(?:that\s+is|who\s+is)?\s*(?:speciali[sz]ed\s+in|focused\s+on|for|to\s+help\s+with|to)?\s*",
    ]
    for p in patterns:
        clean_core = re.sub(p, "", clean_core, flags=re.IGNORECASE).strip()
    if not clean_core:
        clean_core = raw_desc

    words = [w for w in re.findall(r"[A-Za-z0-9]+", clean_core) if w.lower() not in {"and", "or", "the", "a", "an", "in", "for", "with", "to"}]
    if not words:
        words = clean_core.split()

    # Generate professional domain name & slug.
    # BUG-260921-01a: both are FLOORED, because the fallback must be TOTAL — it is the
    # last rung under forced_emit's ladder, so a ValidationError here 500s the draft
    # endpoint for exactly the request that has nothing else left. Driven against a
    # one-character prompt, which produced a 1-char slug and raised.
    name = f"{' '.join(words[:4]).title()} Specialist".strip()
    if len(name) < 3:
        name = "Specialist Domain Expert"
    slug = "-".join([w.lower() for w in words[:3] if w.isalnum()])
    if len(slug) < 3:
        slug = "domain-specialist"

    combined_text = f"{raw_desc} {brainstorm_text or ''}".lower()
    search_words = set(re.findall(r"[a-z0-9]+", combined_text))

    # Category and icon heuristic
    lower = combined_text
    icon = "chart"
    category = "General"
    if any(k in lower for k in ("academic", "thesis", "literature", "paper", "scholar", "dissertation", "research")):
        icon = "book"
        category = "Research & Academia"
    elif any(k in lower for k in ("hr", "people", "leave", "employee", "onboarding", "policy", "policies")):
        icon = "shield"
        category = "Human Resources"
    elif any(k in lower for k in ("legal", "contract", "compliance", "law", "attorney")):
        icon = "scale"
        category = "Legal"
    elif any(k in lower for k in ("finance", "tax", "accounting", "ebitda", "revenue", "audit")):
        icon = "chart"
        category = "Finance"
    elif any(k in lower for k in ("code", "developer", "engineering", "devops", "terminal")):
        icon = "terminal"
        category = "Engineering"
    elif any(k in lower for k in ("logistics", "supply", "inventory", "shipping")):
        icon = "truck"
        category = "Operations"

    # Rich, multi-paragraph operational blueprint
    detailed_desc = (
        f"The {name} is an autonomous domain specialist dedicated to {clean_core.lower()}.\n\n"
        f"Operating with rigorous analytical methodologies and professional standards, this expert conducts deep-dive "
        f"investigations, synthesizes complex source material, and produces structured deliverables tailored to strategic needs. "
        f"Core capabilities include multi-step domain analysis, structured evidence extraction, critical review rubrics, "
        f"and deliverable synthesis.\n\n"
        f"When executing tasks, it enforces systematic quality checks, citation integrity, and actionable recommendations."
    )

    when_to_use = f"Consult when conducting deep analysis, critical reviews, or structured deliverables in {clean_core.lower()}."[:140]
    example_output = (
        f"## Comprehensive {name} Review Matrix\n\n"
        f"| Domain Area | Key Findings / Methodology | Confidence | Strategic Impact |\n"
        f"|---|---|---|---|\n"
        f"| Core Subject | Evaluated across benchmark criteria with empirical validation | High | Significant |\n"
        f"| Risk & Gaps | Identified critical variance points and synthesis opportunities | High | Actionable |\n\n"
        f"**Synthesis**: Systematic evidence indicates robust feasibility with recommended focus on methodology rigor."
    )

    # Contextual 1-click Action Tiles
    # BUG-260921-01a: these are DraftPromptSuggestion (min_length=150 on the prompt body),
    # not models.expert.PromptSuggestion. Driving the fallback against the tightened schema
    # is what caught that — the ValidationError would have 500'd the draft endpoint on every
    # request that reached the floor, which is precisely the request least able to afford it.
    prompts = [
        DraftPromptSuggestion(
            title=f"Analyze {words[0].title() if words else 'Topic'}"[:60],
            prompt=(
                f"Conduct a comprehensive, structured analysis of {clean_core}. Identify the seminal themes and "
                f"the current state of the art, evaluate the strength of the underlying evidence, and separate "
                f"well-supported conclusions from contested ones. Present the synthesis with explicit citations "
                f"to the source material and state plainly where the evidence does not support a conclusion."
            ),
        ),
        DraftPromptSuggestion(
            title="Identify Key Gaps & Risks",
            prompt=(
                f"Perform a rigorous methodology and gap audit on {clean_core}. Pinpoint the weakest links in the "
                f"current evidence base, surface conflicting findings and explain why they conflict, and name the "
                f"specific risks this creates for any decision taken on it. Finish with prioritised, concrete "
                f"remediations rather than general advice."
            ),
        ),
        DraftPromptSuggestion(
            title="Synthesize Deliverable",
            prompt=(
                f"Draft an executive-grade deliverable on {clean_core}. Use structured sections, an evidence table "
                f"that cites each source, and a short recommendation set with actionable next steps. State the "
                f"deliverable's own limitations — what it could not establish from the available material — rather "
                f"than presenting partial coverage as complete."
            ),
        ),
    ]

    # Match available assets
    matched_folder_ids: list[UUID] = []
    if available_folders:
        for f in available_folders:
            f_text = f"{f.get('name', '')}".lower()
            f_tokens = set(re.findall(r"[a-z0-9]+", f_text))
            if any(w in f_tokens or any(f_w.startswith(w[:4]) for f_w in f_tokens if len(w) >= 4) for w in search_words if len(w) >= 3):
                try:
                    matched_folder_ids.append(UUID(str(f["id"])))
                except Exception:
                    pass

    matched_skills: list[str] = []
    if available_skills:
        for s in available_skills:
            s_text = f"{s.get('name', '')} {s.get('description', '')}".lower()
            s_tokens = set(re.findall(r"[a-z0-9]+", s_text))
            if any(w in s_tokens or any(s_w.startswith(w[:4]) for s_w in s_tokens if len(w) >= 4) for w in search_words if len(w) >= 3):
                matched_skills.append(s["name"])

    matched_connections: list[str] = []
    if available_connections:
        for c in available_connections:
            c_slug = c.get("slug") or c.get("name") or c.get("capability") or ""
            c_text = f"{c_slug} {c.get('name', '')} {c.get('capability', '')}".lower()
            c_tokens = set(re.findall(r"[a-z0-9]+", c_text))
            if any(w in c_tokens or any(c_w.startswith(w[:4]) for c_w in c_tokens if len(w) >= 4) for w in search_words if len(w) >= 3):
                matched_connections.append(c_slug)

    return ExpertDraftOutput(
        name=name,
        slug=slug,
        icon=icon,
        category=category,
        when_to_use=when_to_use,
        example_output=example_output,
        description=detailed_desc,
        scope_mode="biased",
        tool_floor_enabled=True,
        prompt_suggestions=prompts,
        member_skills=matched_skills,
        knowledge_folder_ids=matched_folder_ids,
        required_connections=matched_connections,
        # Phase 263 (D-263-02): the floor NAMES NO GAP rather than inventing one. This
        # constructor takes thirteen — now fourteen — explicit kwargs and no ``**extra``,
        # and it is reached from inside ``except Exception`` when forced_emit fails. Omit
        # this line and the draft endpoint 500s precisely when the fallback exists to help.
        suggested_new_skills=[],
    )


async def generate_expert_draft(
    description: str,
    brainstorm_text: str | None = None,
    available_folders: list[dict[str, Any]] | None = None,
    available_skills: list[dict[str, Any]] | None = None,
    available_connections: list[dict[str, Any]] | None = None,
    user_settings: Any = None,
    model: str | None = None,
) -> ExpertDraftOutput:
    """Generate candidate ExpertDraftOutput using forced_emit substrate (PACK-09).

    Never ingests uploaded brainstorm files into permanent document storage.
    Emits a draft row that the user can inspect, edit, and save.
    """
    if not model and user_settings:
        model = (
            getattr(user_settings, "builder_model", None)
            or getattr(user_settings, "llm_model", None)
            or getattr(settings, "llm_model", None)
            or "gpt-4o"
        )
    if not model:
        model = getattr(settings, "llm_model", None) or "gpt-4o"

    provider = getattr(user_settings, "active_provider", None) or (get_model_capability(model) or {}).get("provider", "openai")

    context_parts = [f"Goal / Desired Expert:\n{description}"]
    if brainstorm_text:
        context_parts.append(f"\nUploaded Brainstorm Content:\n{brainstorm_text[:10000]}")

    if available_folders:
        folder_list = [{"id": str(f.get("id")), "name": f.get("name")} for f in available_folders]
        context_parts.append(f"\nAvailable Knowledge Folders:\n{json.dumps(folder_list)}")

    if available_skills:
        skill_list = [{"name": s.get("name"), "description": s.get("description", "")} for s in available_skills]
        context_parts.append(f"\nAvailable Skills:\n{json.dumps(skill_list)}")

    if available_connections:
        conn_list = [{"slug": c.get("slug"), "service_name": c.get("service_name", "")} for c in available_connections]
        context_parts.append(f"\nAvailable Connections:\n{json.dumps(conn_list)}")

    prompt_content = "\n".join(context_parts)

    try:
        result = await forced_emit(
            messages=[{"role": "user", "content": prompt_content}],
            model=model,
            provider=provider,
            emitter="emit_expert_draft",
            tools=_emit_tool("emit_expert_draft", ExpertDraftOutput),
            user_settings=user_settings,
            system_prompt=_EXPERT_DRAFTER_SYSTEM_PROMPT,
            schema_model=ExpertDraftOutput,
            strict=False,
        )
        emitted = result.get("emitted")
        if emitted:
            draft_out = ExpertDraftOutput(**emitted) if isinstance(emitted, dict) else emitted
            if isinstance(draft_out, ExpertDraftOutput):
                # D-v4.3-01: Union Scope is universal platform default unless user explicitly demanded strict isolation
                req_text = f"{description} {brainstorm_text or ''}".lower()
                if "strict" not in req_text and "isolat" not in req_text and "restrict" not in req_text:
                    draft_out.scope_mode = "biased"
                return draft_out
    except Exception as exc:
        logger.warning("forced_emit expert draft failed (%s), using grounded fallback", exc)

    return _generate_fallback_draft(
        description=description,
        brainstorm_text=brainstorm_text,
        available_folders=available_folders,
        available_skills=available_skills,
        available_connections=available_connections,
    )
