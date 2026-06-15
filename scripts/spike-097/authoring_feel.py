"""Authoring-feel: grounded one-shot WorkflowDefinition generation + refine loop (THROWAWAY spike).

Phase 097 Wave 1 (SEED-051) — Plan 097-04 Task 1. Answers unknowns (c) and (d):

  (c) what authoring-time grounding does an NL->workflow generator NEED?
  (d) does describe -> refine -> publish FEEL like talking, not wiring?  (the
      subjective verdict is the OPERATOR's call in Task 2 — this script only
      produces the conversation transcript + the grounding inventory.)

It runs a throwaway one-shot structured generation over the EXISTING strict
``WorkflowDefinition`` schema (``extra="forbid"`` rejects hallucinated keys),
grounded at DESIGN time in four sources:

  (a) the KB folder tree for the test user (mirrors Plan 01's folders read),
  (b) the tool registry — whitelist-eligible tool NAMES from the in-repo tool
      catalog (names + a one-line purpose; no schemas),
  (c) the skill registry — names/descriptions from the ``skills`` table,
  (d) the template-derived placeholder set via
      ``DocxTemplate(template).get_undeclared_template_variables()``.

The loop: a plain-English description -> a forced-tool WorkflowDefinition draft
-> ONE refine turn -> a re-draft. Each draft is validated with
``WorkflowDefinition.model_validate(...)``; on ``ValidationError`` it re-prompts
ONCE with the error fed back (the spike does this loop by hand) and records both
attempts.

Provider: Anthropic native SDK, forced ``tool_choice`` (SC#10 does NOT bind the
spike — single provider by design).

Red line / G-5: imports ``app.models.harness`` + the in-repo tool catalog
READ-ONLY; MIRRORS the native Anthropic SDK call shape but NEVER imports or
mutates the native Anthropic service adapter. No ``backend/app/**`` edits;
throwaway code lives only under ``scripts/spike-097/``. Secrets stay name-only —
never echoed to stdout/out/.

Run from the repo root:
    backend/venv/Scripts/python.exe scripts/spike-097/authoring_feel.py [--model claude-opus-4-8]
"""

from __future__ import annotations

import argparse
import copy
import json
import os
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

# scripts/spike-097/authoring_feel.py -> parents[2] == repo root
REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = REPO_ROOT / "backend"
SPIKE_DIR = Path(__file__).resolve().parent
OUT_DIR = SPIKE_DIR / "out"
CONFIG_PATH = OUT_DIR / "spike-config.json"
TRANSCRIPT_PATH = OUT_DIR / "transcript.md"
UNKNOWN_C_PATH = OUT_DIR / "unknown-c.md"

# Make backend/ importable, then load backend/.env so `settings` + the read-only
# service imports resolve (mirrors find_risk_folder.py / derive_fields.py bootstrap).
sys.path.insert(0, str(SPIKE_DIR))
sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(BACKEND_DIR / ".env")  # secrets stay name-only — never echoed

import anthropic  # noqa: E402
from docxtpl import DocxTemplate  # noqa: E402
from pydantic import ValidationError  # noqa: E402
from supabase import Client, create_client  # noqa: E402  (mirrors dependencies.get_supabase)

from app.models.harness import WorkflowDefinition  # noqa: E402  READ-ONLY — the strict response schema
from app.services.openai_service import get_tools  # noqa: E402  READ-ONLY — the whitelist-eligible tool NAMES


# ---------------------------------------------------------------------------
# Literal inputs (do NOT paraphrase — fixed by Plan 097-04 Task 1 action).
# ---------------------------------------------------------------------------
DESCRIPTION = (
    "Each week, fill our risk register from the Acme project folder, grounded in our KB, "
    "and pause for me to confirm before finalizing."
)
REFINE = (
    "Make the research phase pull only from the /Risks subfolder, and add a human-confirm "
    "step before the file is produced."
)

# Strong-Claude-first (RESEARCH Open Question 1 + "prioritize newest models"); the
# fallback chain keeps the spike alive if the live /models set differs from the
# registry. The model that actually answered is recorded in the evidence.
MODEL_CANDIDATES = [
    "claude-opus-4-8",
    "claude-sonnet-4-6",
    "claude-sonnet-4-5-20250929",
    "claude-haiku-4-5-20251001",
]

TOOL_NAME = "emit_workflow_definition"

SYSTEM_PROMPT = (
    "You are a workflow authoring assistant for a knowledge-base agent platform. "
    "A non-coder domain expert describes a recurring knowledge task in plain English. "
    "Your job is to translate it into ONE valid WorkflowDefinition by composing typed "
    "phases, then emit it via the provided tool.\n\n"
    "The 5 phase types you can compose (set `phase_type` per phase):\n"
    "- programmatic: a deterministic registered function (`fn`); no LLM. Use for compute / "
    "merge / file-render steps.\n"
    "- llm_single: a single LLM completion with a `prompt` (no tools).\n"
    "- llm_agent: an autonomous agent with a `prompt` and an `available_tools` whitelist "
    "(tool names from the registry below). Use for KB research / retrieval.\n"
    "- llm_batch_agents: a fan-out of parallel agents over a `prompt` + `available_tools`.\n"
    "- llm_human_input: PAUSE and ask the human (`prompt`, optional `options`). Use this for "
    "any 'confirm before finalizing' / human-in-the-loop step.\n\n"
    "Rules:\n"
    "- `available_tools` may ONLY contain tool names from the provided tool registry.\n"
    "- Ground every folder reference in the provided KB folder tree — use a real folder name "
    "and/or id from the tree, never an invented one.\n"
    "- If the description asks to pause for confirmation, include an llm_human_input phase "
    "before the finalizing step.\n"
    "- Honor the strict schema: emit ONLY the schema's fields; do NOT invent keys (extra keys "
    "are rejected at validation).\n"
    "- Give each phase a short slug and a sequential `phase_index` starting at 0; set the "
    "definition `slug`, `version` (1), `name`, and `status` ('draft')."
)


# ---------------------------------------------------------------------------
# Bootstrap
# ---------------------------------------------------------------------------
def get_supabase() -> Client:
    """Service-role client (mirrors dependencies.get_supabase()). Key name-only."""
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        missing = [n for n, v in (("SUPABASE_URL", url), ("SUPABASE_SERVICE_ROLE_KEY", key)) if not v]
        raise SystemExit(f"Missing env var(s) in backend/.env: {', '.join(missing)}")
    return create_client(url, key)


def load_config() -> dict:
    if not CONFIG_PATH.exists():
        raise SystemExit(f"Missing {CONFIG_PATH} — run Plan 097-01 (find_risk_folder.py) first.")
    return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))


# ---------------------------------------------------------------------------
# Step 1 — assemble design-time grounding (the unknown-c inventory)
# ---------------------------------------------------------------------------
def build_folder_tree(folders: list[dict], project_folder_id: str) -> str:
    """Render the user's folders as an indented name/id tree (parent_id -> children)."""
    children: dict[str | None, list[dict]] = defaultdict(list)
    for f in folders:
        children[f.get("parent_id")].append(f)
    for kids in children.values():
        kids.sort(key=lambda f: (f.get("name") or "").lower())

    lines: list[str] = []

    def walk(parent: str | None, depth: int) -> None:
        for f in children.get(parent, []):
            mark = "   <-- the project folder (spike-config.folder_id)" if f["id"] == project_folder_id else ""
            lines.append(f"{'  ' * depth}- {f['name']}  (id={f['id']}){mark}")
            walk(f["id"], depth + 1)

    walk(None, 0)
    # Orphans (parent_id points outside the user's owned set) — surface flat so nothing is lost.
    owned = {f["id"] for f in folders}
    for f in folders:
        if f.get("parent_id") is not None and f["parent_id"] not in owned:
            mark = "   <-- the project folder (spike-config.folder_id)" if f["id"] == project_folder_id else ""
            lines.append(f"- {f['name']}  (id={f['id']}){mark}")
    return "\n".join(lines) if lines else "(no folders)"


def tool_registry() -> tuple[list[str], list[str]]:
    """Return (rendered 'name: one-line purpose' lines, bare tool names) from the catalog."""
    tools = get_tools(None)  # default toolbox (web/sandbox gated by settings); names only
    lines: list[str] = []
    names: list[str] = []
    for t in tools:
        fn = t["function"]
        name = fn["name"]
        desc = " ".join((fn.get("description") or "").split())
        # First sentence as the one-line purpose (no schemas).
        purpose = desc.split(". ")[0].rstrip(".")
        if len(purpose) > 130:
            purpose = purpose[:127] + "..."
        lines.append(f"- {name}: {purpose}")
        names.append(name)
    return lines, names


def skill_registry(supabase: Client, user_id: str) -> list[dict]:
    """User-owned + global enabled skills (service-role bypasses RLS — scope by hand)."""
    try:
        rows = (
            supabase.table("skills")
            .select("name,description,is_global,user_id,is_enabled")
            .or_(f"user_id.eq.{user_id},is_global.eq.true")
            .execute()
            .data
        ) or []
    except Exception as exc:  # noqa: BLE001 — defensive: fall back to a full read + filter
        print(f"[warn] scoped skills read failed ({type(exc).__name__}: {exc}); filtering client-side")
        rows = supabase.table("skills").select("name,description,is_global,user_id,is_enabled").execute().data or []
    return [
        r
        for r in rows
        if r.get("is_enabled") and (str(r.get("user_id")) == str(user_id) or r.get("is_global"))
    ]


def render_grounding(folder_tree: str, tool_lines: list[str], skills: list[dict], placeholders: list[str]) -> str:
    """The design-time grounding bundle (names + placeholders only — no content, no secrets)."""
    skill_lines = (
        "\n".join(
            f"- {s['name']}: {' '.join((s.get('description') or '').split())[:120] or '(no description)'}"
            + (" [global]" if s.get("is_global") else "")
            for s in skills
        )
        or "(no skills registered)"
    )
    return (
        "## Design-time grounding (names + template fields only)\n\n"
        "### (a) KB folder tree\n"
        f"{folder_tree}\n\n"
        "### (b) Tool registry — names eligible for an llm_agent `available_tools` whitelist\n"
        f"{chr(10).join(tool_lines)}\n\n"
        "### (c) Skill registry (enabled, user-owned + global)\n"
        f"{skill_lines}\n\n"
        "### (d) Template-derived placeholder fields (the risk-register the workflow must fill)\n"
        f"{', '.join(placeholders)}\n"
    )


# ---------------------------------------------------------------------------
# Step 2/3 — forced WorkflowDefinition emission + validate + re-prompt-once
# ---------------------------------------------------------------------------
def _strip_discriminator(node):
    """Remove OpenAPI-style `discriminator` keys (Anthropic input_schema compat).

    The `oneOf` variants each keep a `const` phase_type, so the model can still pick
    the right config; Pydantic re-applies the discriminator at model_validate, which
    is the real strict gate.
    """
    if isinstance(node, dict):
        node.pop("discriminator", None)
        for v in node.values():
            _strip_discriminator(v)
    elif isinstance(node, list):
        for v in node:
            _strip_discriminator(v)
    return node


WF_SCHEMA = _strip_discriminator(copy.deepcopy(WorkflowDefinition.model_json_schema()))


def _force_emit(client: anthropic.Anthropic, model: str, system: str, messages: list[dict], max_tokens: int = 8192):
    """One forced tool_use emission of a WorkflowDefinition (native Anthropic SDK)."""
    resp = client.messages.create(
        model=model,
        max_tokens=max_tokens,
        tools=[
            {
                "name": TOOL_NAME,
                "description": "Emit a single WorkflowDefinition for this recurring task.",
                "input_schema": WF_SCHEMA,
            }
        ],
        tool_choice={"type": "tool", "name": TOOL_NAME},  # FORCE one structured emission
        system=system,
        messages=messages,
    )
    tool_block = None
    for block in resp.content:
        if getattr(block, "type", None) == "tool_use":
            tool_block = block
            break
    if tool_block is None:
        raise ValueError(
            f"No tool_use block (stop_reason={getattr(resp, 'stop_reason', '?')}); forced tool_choice did not hold."
        )
    usage = getattr(resp, "usage", None)
    meta = {
        "model": model,
        "stop_reason": getattr(resp, "stop_reason", None),
        "input_tokens": getattr(usage, "input_tokens", None) if usage else None,
        "output_tokens": getattr(usage, "output_tokens", None) if usage else None,
    }
    return tool_block, resp, meta


def generate(client: anthropic.Anthropic, model: str, system: str, base_messages: list[dict], label: str):
    """Emit -> validate -> (on ValidationError) re-prompt ONCE with the error fed back.

    Returns (validated_definition, raw_dict, attempts, accepted_resp_content, accepted_tool_use_id).
    The accepted resp content + tool_use id let the caller chain the next (refine) turn.
    """
    attempts: list[dict] = []
    messages = list(base_messages)

    tool_block, resp, meta = _force_emit(client, model, system, messages)
    raw = tool_block.input
    try:
        wd = WorkflowDefinition.model_validate(raw)
        attempts.append({**meta, "attempt": 1, "validated": True, "error": None})
        print(f"      [{label}] attempt 1 [{meta['model']}]: VALID ({len(raw.get('phases', []))} phases)")
        return wd, raw, attempts, resp.content, tool_block.id
    except ValidationError as exc:
        err = str(exc)
        attempts.append({**meta, "attempt": 1, "validated": False, "error": err[:1800]})
        print(f"      [{label}] attempt 1 [{meta['model']}]: INVALID — re-prompting once with the error")
        # Re-prompt once with the validation error fed back (the spike does this by hand).
        messages = messages + [
            {"role": "assistant", "content": resp.content},
            {
                "role": "user",
                "content": [
                    {"type": "tool_result", "tool_use_id": tool_block.id, "content": "Validation failed."},
                    {
                        "type": "text",
                        "text": (
                            "Your previous emission failed STRICT schema validation (extra/unknown keys are "
                            "forbidden). Validation errors:\n"
                            f"{err}\n"
                            "Re-emit a COMPLETE, valid WorkflowDefinition using ONLY the schema's fields. "
                            "Remove any key the schema does not declare."
                        ),
                    },
                ],
            },
        ]
        tool_block2, resp2, meta2 = _force_emit(client, model, system, messages)
        raw2 = tool_block2.input
        wd2 = WorkflowDefinition.model_validate(raw2)  # if this raises, the spike surfaces it (honest failure)
        attempts.append({**meta2, "attempt": 2, "validated": True, "error": None})
        print(f"      [{label}] attempt 2 [{meta2['model']}]: VALID ({len(raw2.get('phases', []))} phases)")
        return wd2, raw2, attempts, resp2.content, tool_block2.id


# ---------------------------------------------------------------------------
# Analysis — which grounding did the draft actually USE? (unknown-c inventory)
# ---------------------------------------------------------------------------
def _prompt_blob(d: dict) -> str:
    """All author-controlled free text in a definition (names, slugs, prompts, fn, input_keys)."""
    parts = [d.get("name", ""), d.get("slug", "")]
    for p in d.get("phases", []):
        parts.append(p.get("slug", ""))
        c = p.get("config", {})
        parts.append(c.get("prompt", "") or "")
        parts.append(c.get("fn", "") or "")
        for ik in c.get("input_keys", []) or []:
            parts.append(ik)
    return "\n".join(parts)


def used_tools(d: dict) -> list[str]:
    s: set[str] = set()
    for p in d.get("phases", []):
        for t in (p.get("config", {}).get("available_tools") or []):
            s.add(t)
    return sorted(s)


def phase_summary(d: dict) -> list[str]:
    out = []
    for p in d.get("phases", []):
        out.append(f"{p.get('phase_index')}:{p.get('slug')} ({p.get('config', {}).get('phase_type')})")
    return out


def analyse(d: dict, folders: list[dict], skills: list[dict], placeholders: list[str], tool_names: list[str]) -> dict:
    blob = _prompt_blob(d)
    folder_name_hits = [f["name"] for f in folders if f.get("name") and f["name"] in blob]
    folder_id_hits = [f["id"] for f in folders if f["id"] in blob]
    skill_hits = [s["name"] for s in skills if s.get("name") and s["name"] in blob]
    placeholder_hits = [k for k in placeholders if k in blob]
    tools = used_tools(d)
    valid_tools = [t for t in tools if t in tool_names]
    invalid_tools = [t for t in tools if t not in tool_names]
    return {
        "phase_summary": phase_summary(d),
        "phase_types": [p.get("config", {}).get("phase_type") for p in d.get("phases", [])],
        "used_tools": tools,
        "valid_tools": valid_tools,
        "invalid_tools": invalid_tools,
        "folder_name_hits": sorted(set(folder_name_hits)),
        "folder_id_hits": sorted(set(folder_id_hits)),
        "skill_hits": sorted(set(skill_hits)),
        "placeholder_hits": placeholder_hits,
        "has_human_input": "llm_human_input" in [p.get("config", {}).get("phase_type") for p in d.get("phases", [])],
        "mentions_risks_path": ("/Risks" in blob) or ("Risks subfolder" in blob),
        "blob": blob,
    }


# ---------------------------------------------------------------------------
# Capture — transcript.md + unknown-c.md
# ---------------------------------------------------------------------------
def write_transcript(grounding: str, draft1: dict, attempts1: list, draft2: dict, attempts2: list, meta: dict) -> None:
    def att_md(attempts: list) -> str:
        return "\n".join(
            f"  - Attempt {a['attempt']} [{a['model']}, stop_reason={a['stop_reason']}, "
            f"in={a['input_tokens']} out={a['output_tokens']} tok]: "
            f"{'VALID' if a['validated'] else 'INVALID (re-prompted)'}"
            + ("" if a["validated"] else f"\n    - error: {a['error'].splitlines()[0] if a['error'] else ''}")
            for a in attempts
        )

    body = f"""# Phase 097 Plan 04 — Authoring-Feel Transcript (unknowns c + d)

**Spike:** Phase 097 Wave 1 (SEED-051) — THROWAWAY · **Generated:** {meta['generated_at']}
**Provider:** {meta['provider']} · **Model that answered:** `{meta['model']}`
**Response schema:** the strict `WorkflowDefinition` (`extra="forbid"`) — the SAME model an
NL generator would target in Phase 103. Hallucinated/extra keys are rejected and re-prompted.

This transcript captures the authoring conversation the operator judges in Task 2 (does
**describe -> refine -> publish** feel like talking, not wiring?). It is NOT the verdict —
that is `unknown-d.md`, the operator's call.

---

{grounding}

---

## 1. Describe (plain-English task — the literal description)

> {DESCRIPTION}

### First draft — WorkflowDefinition (validated against the strict schema)

Validation:
{att_md(attempts1)}

```json
{json.dumps(draft1, indent=2, ensure_ascii=False)}
```

---

## 2. Refine (the literal one refine turn)

> {REFINE}

### Re-draft — WorkflowDefinition (validated against the strict schema)

Validation:
{att_md(attempts2)}

```json
{json.dumps(draft2, indent=2, ensure_ascii=False)}
```

---

## 3. Validation summary

- Both drafts validated against the strict `WorkflowDefinition` schema via
  `WorkflowDefinition.model_validate(...)`.
- First draft: {'valid on first emission' if len(attempts1) == 1 else 'needed one re-prompt-on-error round (recorded above)'}.
- Re-draft: {'valid on first emission' if len(attempts2) == 1 else 'needed one re-prompt-on-error round (recorded above)'}.
- The strict schema rejects extra keys (`extra="forbid"`), so any hallucinated field would
  have surfaced as a ValidationError and triggered the recorded re-prompt.
"""
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    TRANSCRIPT_PATH.write_text(body, encoding="utf-8")
    print(f"      wrote {TRANSCRIPT_PATH}")


def write_unknown_c(a1: dict, a2: dict, folders: list[dict], skills: list[dict], placeholders: list[str], tool_names: list[str], meta: dict) -> None:
    # Did the refine narrow scope + add a human-confirm phase?
    added_human = a2["has_human_input"] and not a1["has_human_input"]
    narrowed = a2["mentions_risks_path"] and not a1["mentions_risks_path"]

    # folder_scope shape finding: the strict WorkflowDefinition has NO folder_scope field
    # today, so any retrieval scope can only land in PROMPT TEXT, not a bound structured field.
    used_ids = bool(a1["folder_id_hits"] or a2["folder_id_hits"])
    used_names = bool(a1["folder_name_hits"] or a2["folder_name_hits"])
    if used_ids:
        scope_shape = "resolved folder id(s) embedded in prompt text"
    elif used_names:
        scope_shape = "folder NAME / path string embedded in prompt text"
    else:
        scope_shape = "no concrete folder reference (scope stayed implicit in the prompt)"

    body = f"""# Unknown (c) — What authoring-time grounding does the NL->workflow generator NEED?

**Spike:** Phase 097 Plan 04 (Wave 1) — THROWAWAY · **Generated:** {meta['generated_at']}
**Provider:** {meta['provider']} · **Model:** `{meta['model']}`
**Method:** one forced-tool generation over the strict `WorkflowDefinition` schema, grounded
at design time in four sources (folder tree / tool names / skill names / template placeholders),
then one refine turn. This is the inventory that feeds the Phase 103 generator prompt (WFAUTH-02).

## Grounding inventory — what the draft actually USED

| Grounding source | Provided? | Used by the draft? | Evidence |
|------------------|-----------|--------------------|----------|
| (a) KB folder tree | yes ({len(folders)} folders) | {'YES' if (used_ids or used_names) else 'NO'} | folder refs in draft: names={a1['folder_name_hits'] or a2['folder_name_hits']}, ids={a1['folder_id_hits'] or a2['folder_id_hits']} |
| (b) Tool registry (names) | yes ({len(tool_names)} tools) | {'YES' if (a1['used_tools'] or a2['used_tools']) else 'NO'} | whitelisted tools: draft1={a1['used_tools']}, redraft={a2['used_tools']}; invalid (off-registry): {sorted(set(a1['invalid_tools']) | set(a2['invalid_tools']))} |
| (c) Skill registry (names) | yes ({len(skills)} skills) | {'YES' if (a1['skill_hits'] or a2['skill_hits']) else 'NO'} | skill refs in draft: {sorted(set(a1['skill_hits']) | set(a2['skill_hits'])) or 'none'} |
| (d) Template placeholders | yes ({len(placeholders)} fields) | {'YES' if (a1['placeholder_hits'] or a2['placeholder_hits']) else 'NO'} | placeholder refs in draft: {sorted(set(a1['placeholder_hits']) | set(a2['placeholder_hits'])) or 'none'} |

**Provided placeholders:** {placeholders}
**Provided tool names:** {tool_names}

## Did the draft propose correct structure from the description alone?

- First-draft phases: {a1['phase_summary']}
- Re-draft phases: {a2['phase_summary']}
- First draft already contains an `llm_human_input` (the 'pause for me to confirm') phase: {a1['has_human_input']}
- Refine ADDED a human-confirm phase that wasn't there: {added_human}
- Refine narrowed retrieval scope toward `/Risks`: {narrowed}

## `folder_scope` shape finding (RESEARCH Open Question — the resolution seam)

The current strict `WorkflowDefinition` schema has **no `folder_scope` field** (and no
`project_folder_id` / `inputs` / `assets`). So the generator had nowhere to put a BOUND
retrieval scope — the scope can only surface as **{scope_shape}**.

- Scope expressed as a structured/bound field: **NO** (the schema offers none — `extra="forbid"`
  would reject an invented `folder_scope` key, which is exactly why both drafts had to encode
  scope as free text inside an llm_agent `prompt`).
- Scope expressed as a string path vs a resolved id: **{('resolved id(s)' if used_ids else ('name/path string' if used_names else 'neither — left implicit'))}**.

**Implication for the production schema (PROJ-02, informs — does not lock):** the additive
`folder_scope` (per-phase) + `project_folder_id` (per-definition) fields hypothesised in
RESEARCH are *needed* — without them the generator leaks scope into prompt text, where it is a
hint the agent can widen, not a server-side bound parameter. The generator should emit a
folder id (resolved from the grounded tree), and the engine binds it via the existing
`ToolContext.folder_subtree_ids` seam. The description's "/Risks subfolder" also shows the
generator must RESOLVE a spoken path against the real folder tree (the tree here has
'Project Meridian — Risks' but no literal '/Risks' child), so path->id resolution is a
required authoring-time grounding step, not a free-text passthrough.

## The grounding the Phase 103 generator prompt MUST carry

1. **Folder tree (name + id)** — load-bearing: the generator needs real folder ids to bind
   scope, and to resolve spoken folder names/paths from the description.
2. **Tool registry (names only)** — load-bearing: the generator populates `available_tools`
   whitelists; it must be constrained to real tool names (off-registry names = a lint/validation
   failure, the Phase 102 gate).
3. **Template placeholder set** — needed so the generator knows what the fill step must produce
   (shapes the render/programmatic phase + any `inputs`).
4. **Skill registry (names)** — useful-but-optional here: {('the draft referenced a skill' if (a1['skill_hits'] or a2['skill_hits']) else 'the draft did not reference a skill in this run')}; carry it so skill-backed phases are authorable, but it is lower-priority than (1)-(3) for this task.

**Net:** folder tree + tool names + template placeholders are the MUST-HAVE grounding; the
skill registry is nice-to-have. The biggest schema gap surfaced is the missing bound
`folder_scope`/`project_folder_id` (PROJ-02) — the single most important additive field the
spike's evidence points the Phase 098/100/101 schema work at.
"""
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    UNKNOWN_C_PATH.write_text(body, encoding="utf-8")
    print(f"      wrote {UNKNOWN_C_PATH}")


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------
def main() -> int:
    parser = argparse.ArgumentParser(description="Authoring-feel: grounded WorkflowDefinition generation (spike 097-04).")
    parser.add_argument("--model", default=None, help="Override the Claude model id (default: registry fallback chain).")
    args = parser.parse_args()
    models = [args.model] if args.model else MODEL_CANDIDATES

    cfg = load_config()
    user_id = cfg["user_id"]
    project_folder_id = cfg["folder_id"]
    template_path = REPO_ROOT / cfg["template_path"]

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise SystemExit("ANTHROPIC_API_KEY not set — load backend/.env before running.")

    # --- Step 1: assemble design-time grounding ---
    supabase = get_supabase()
    folders = supabase.table("folders").select("id,name,parent_id").eq("user_id", user_id).execute().data or []
    folder_tree = build_folder_tree(folders, project_folder_id)
    tool_lines, tool_names = tool_registry()
    skills = skill_registry(supabase, user_id)
    placeholders = sorted(DocxTemplate(str(template_path)).get_undeclared_template_variables())
    grounding = render_grounding(folder_tree, tool_lines, skills, placeholders)
    print(f"[1/4] grounding assembled: {len(folders)} folders, {len(tool_names)} tools, "
          f"{len(skills)} skills, {len(placeholders)} template fields")

    # --- Step 2: first draft (describe) with model fallback ---
    user1 = (
        f"{grounding}\n\n"
        "## The task to author (plain English)\n"
        f"{DESCRIPTION}\n\n"
        "Emit ONE WorkflowDefinition that automates this recurring task. Ground every folder "
        "reference in the KB folder tree above, and use only tool names from the tool registry."
    )
    base1 = [{"role": "user", "content": user1}]

    client = anthropic.Anthropic(api_key=api_key)
    model_errors: list[str] = []
    result1 = None
    chosen_model = None
    for m in models:
        try:
            print(f"[2/4] generating first draft (model: {m}) ...")
            result1 = generate(client, m, SYSTEM_PROMPT, base1, label="describe")
            chosen_model = m
            break
        except (anthropic.NotFoundError, anthropic.BadRequestError) as exc:
            model_errors.append(f"{m}: {type(exc).__name__}: {exc}")
            print(f"      model {m} rejected ({type(exc).__name__}); trying next candidate")
            continue
    if result1 is None:
        raise SystemExit(
            "All candidate Claude models were rejected by the live API:\n  "
            + "\n  ".join(model_errors)
            + "\nPass --model with a served model id."
        )
    wd1, raw1, attempts1, accepted_content1, accepted_tu_id1 = result1

    # --- Step 3: one refine turn (chain off the accepted first draft) ---
    base2 = [
        {"role": "user", "content": user1},
        {"role": "assistant", "content": accepted_content1},
        {
            "role": "user",
            "content": [
                {"type": "tool_result", "tool_use_id": accepted_tu_id1, "content": "Draft received."},
                {"type": "text", "text": REFINE},
            ],
        },
    ]
    print(f"[3/4] generating re-draft after one refine turn (model: {chosen_model}) ...")
    wd2, raw2, attempts2, _c2, _tu2 = generate(client, chosen_model, SYSTEM_PROMPT, base2, label="refine")

    # --- Step 4: capture transcript + unknown-c inventory ---
    meta = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "provider": "anthropic (native SDK, forced tool_choice)",
        "model": chosen_model,
        "model_fallback_errors": model_errors,
    }
    draft1 = wd1.model_dump()
    draft2 = wd2.model_dump()
    write_transcript(grounding, draft1, attempts1, draft2, attempts2, meta)

    a1 = analyse(draft1, folders, skills, placeholders, tool_names)
    a2 = analyse(draft2, folders, skills, placeholders, tool_names)
    write_unknown_c(a1, a2, folders, skills, placeholders, tool_names, meta)

    print("[4/4] done. Task 2 (operator) judges the FEEL into out/unknown-d.md.")
    print(f"      draft1 phases: {a1['phase_summary']}")
    print(f"      redraft phases: {a2['phase_summary']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
