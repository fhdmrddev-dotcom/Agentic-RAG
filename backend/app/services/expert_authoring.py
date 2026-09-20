from __future__ import annotations

import json
import logging
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.config import get_model_capability
from app.models.expert import PromptSuggestion
from app.services.forced_emit import forced_emit

logger = logging.getLogger(__name__)

ScopeMode = Literal["biased", "restricted"]


class ExpertDraftOutput(BaseModel):
    name: str = Field(..., description="Display name for the expert")
    slug: str = Field(..., description="URL-safe slug for the expert")
    icon: str = Field(default="chart", description="Lucide vector glyph name (e.g. chart, scale, shield, briefcase, truck, terminal)")
    category: str = Field(default="General", description="Domain category classification")
    when_to_use: str = Field(default="", description="Short guidance on when to consult this expert")
    example_output: str = Field(default="", description="Representative answer or deliverable snippet")
    description: str = Field(default="", description="Detailed description of expert capabilities")
    scope_mode: ScopeMode = Field(default="biased", description="Knowledge composition mode (defaults to biased per D-v4.3-01)")
    tool_floor_enabled: bool = Field(default=True, description="Whether deliverable tools are kept as additive floor")
    prompt_suggestions: list[PromptSuggestion] = Field(default_factory=list, description="3 starter Action Tiles")
    member_skills: list[str] = Field(default_factory=list, description="Selected skills from available skills")
    knowledge_folder_ids: list[UUID] = Field(default_factory=list, description="Selected folder UUIDs from available folders")
    required_connections: list[str] = Field(default_factory=list, description="Selected connection slugs from available connections")


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


_EXPERT_DRAFTER_SYSTEM_PROMPT = """You are an AI assistant helping an organization admin draft a Domain Expert bundle.
An Expert bundles together skills, connections, knowledge folders, starter prompts, and presentation attributes.

Guidelines:
1. Provide a professional, concise 'name' and URL-safe 'slug'.
2. Select an appropriate vector glyph 'icon' from: chart, scale, shield, briefcase, truck, terminal, book, cpu, database, file-text.
3. Classify into a relevant 'category' (e.g., Finance, Legal, HR, Operations, Engineering, General).
4. Provide a punchy 'when_to_use' one-liner (under 120 chars) and a realistic 'example_output' snippet.
5. Create exactly 3 starter Action Tiles in 'prompt_suggestions' [{title, prompt}] that users can click to immediately get value.
6. For 'scope_mode', default to 'biased' (Union Scope) unless the description explicitly requests strict isolation.
7. Select only valid IDs/names from the provided available knowledge folders, member skills, and required connections.
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
    clean_desc = (description or "Specialized Domain Expert").strip()
    words = clean_desc.split()
    name = " ".join(words[:4]).title() if words else "Domain Expert"
    slug = "-".join([w.lower() for w in words[:3] if w.isalnum()]) or "domain-expert"

    combined_text = f"{clean_desc} {brainstorm_text or ''}".lower()
    search_words = set(re.findall(r"[a-z0-9]+", combined_text))

    # Category and icon heuristic
    lower = combined_text
    icon = "chart"
    category = "General"
    if any(k in lower for k in ("hr", "people", "leave", "employee", "onboarding", "policy", "policies")):
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
        when_to_use=f"Consult when working with {name.lower()} questions.",
        example_output=f"Analysis deliverable for {name.lower()}.",
        description=clean_desc,
        scope_mode="biased",
        tool_floor_enabled=True,
        prompt_suggestions=[
            PromptSuggestion(title=f"Analyze {name}", prompt=f"Provide a comprehensive summary and analysis of {name}."),
            PromptSuggestion(title="Identify Key Risks", prompt="Extract and assess the top 3 risks or anomalies."),
            PromptSuggestion(title="Generate Action Items", prompt="Draft an executive summary and recommended next steps."),
        ],
        member_skills=matched_skills,
        knowledge_folder_ids=matched_folder_ids,
        required_connections=matched_connections,
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
        model = getattr(user_settings, "builder_model", None) or getattr(user_settings, "llm_model", None)
    if not model:
        model = "deepseek-v4-flash"

    provider = (get_model_capability(model) or {}).get("provider", "openai")

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
            if isinstance(emitted, dict):
                return ExpertDraftOutput(**emitted)
            if isinstance(emitted, ExpertDraftOutput):
                return emitted
    except Exception as exc:
        logger.warning("forced_emit expert draft failed (%s), using grounded fallback", exc)

    return _generate_fallback_draft(
        description=description,
        brainstorm_text=brainstorm_text,
        available_folders=available_folders,
        available_skills=available_skills,
        available_connections=available_connections,
    )
