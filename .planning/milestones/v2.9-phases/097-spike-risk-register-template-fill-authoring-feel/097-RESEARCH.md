# Phase 097: Spike — Risk-Register Template-Fill + Authoring Feel — Research

**Researched:** 2026-06-08
**Domain:** Throwaway de-risking spike — KB-grounded `.docx` template-fill (docxtpl) + AI-derived input fields + NL authoring-feel, on ONE provider
**Confidence:** HIGH on the composition seams + docxtpl mechanics (read from live code + verified upstream research); MEDIUM on the schema-shape hypothesis (that is what the spike exists to confirm) and provider choice.

---

## Summary

Phase 097 is a **throwaway evidence-gathering spike (SEED-051)**, not a production build. Its job is to run a Risk-Register fill from a real KB folder **end-to-end on one provider** and answer four schema-shaping unknowns *before* any production schema (`inputs` / `assets` / `folder_scope`) is locked. The spike's **output becomes** the recommended schema shape — so every research finding below is framed as "what the planner needs to design experiments that produce evidence + a go/no-go," not "what to build durably."

The good news, established by the v2.9 exploration (reports C/D/E) and confirmed against live code in this session: **almost everything the spike composes already exists and works.** The sandbox already ships `python-docx`, `python-pptx`, `openpyxl`, `reportlab` (`backend/Dockerfile.sandbox`). KB retrieval already takes a bound folder scope (`retrieval_service.search_documents(..., folder_ids=...)`, dispatched via `ToolContext.folder_subtree_ids`). The harness already runs `programmatic → llm_agent → gate → llm_human_input → programmatic` compositions (`phase_types.py` + `validators.py`). The strict `extra="forbid"` `WorkflowDefinition` model (`models/harness.py`) is *already the response schema* an NL generator would target. **The only genuinely new dependency is `docxtpl`** (latest **0.20.2**, 2025-11-13 — `[VERIFIED: pypi.org/pypi/docxtpl/json]`), which pulls `jinja2` + `lxml` transitively and is **absent from the backend venv today** `[VERIFIED: glob backend/venv]`.

The genuinely *unproven-here* parts — the four unknowns — are: (a) can a model reliably **derive the field schema** from a risk-register template; (b) does **docxtpl KB-grounded fill** produce a clean, re-openable `.docx`; (c) what does **authoring-time grounding** (folder tree + tool/skill registry + template fed to a one-shot generator) actually need; (d) does **describe → refine → publish FEEL good** with a human in the loop. None of these is a code-availability question; all four are *behavioral evidence* questions, which is exactly why a throwaway spike answers them cheaper than a schema commitment.

**Primary recommendation:** Build a **standalone throwaway script** (live in `scripts/spike-097/` at the repo root — **outside** `backend/`'s uvicorn `--reload` watch tree) that imports the real `app.services` read-only and composes: scoped retrieval → an Anthropic forced-tool **cited field-map** → docxtpl render → re-open integrity check. Keep ALL orchestration glue out of `threads.py` / `anthropic_service.py` (the red line + G-5 hot files). Run on **one provider (Anthropic / Claude native SDK, forced tool-use)** — SC#10 does NOT bind the spike. Capture per-run evidence (filled `.docx`, corruption log, field-map JSON, authoring transcript) and end with a **written go/no-go on the docxtpl path + the `inputs`/`assets`/`folder_scope` schema shape**.

---

<user_constraints>
## Constraints (from ROADMAP.md / STATE.md / SEED-051 — no CONTEXT.md yet)

> No `CONTEXT.md` exists for this phase (the spike precedes discuss; it is the very first v2.9 move). The following are the locked milestone constraints that bind the spike, copied verbatim/near-verbatim from the authoritative planning docs. Treat them with the same authority as locked decisions.

### Locked decisions (binding on the spike)
- **This is a throwaway SPIKE, not production code.** "De-risk the entire milestone — fill a Risk Register from a real KB folder end-to-end on ONE provider, answering the 4 schema-shaping unknowns BEFORE any production schema is locked." (ROADMAP Phase 097 Goal)
- **NO production schema locks before the spike.** "Do NOT pre-commit the `inputs`/`assets`/`folder_scope` schema before this." (EXPLORATION §9 CORE-1; STATE "Next action")
- **The red line.** "Workflows COMPOSE the shipped harness / agent-loop / provider-gateway — they never re-implement them. Deep Mode stays byte-identical. No new runtime." (ROADMAP Red line; STATE Workflow guardrails)
- **Off the hot files (G-1/G-5).** Work must NOT pile onto `backend/app/api/threads.py` or `backend/app/services/anthropic_service.py`. (STATE; ROADMAP)
- **Only `docxtpl` is new.** "Stack addition surfaced here: only `docxtpl` is new — add to `backend/Dockerfile.sandbox`, bump `SANDBOX_IMAGE` tag." (ROADMAP Phase 097 Note). The spike needs no SQL migration.
- **Both fill strategies are in milestone scope** (resolved scope fork #3): trusted library templates use docxtpl/Jinja; arbitrary uploads use non-Jinja run-replace. **The spike focuses on the docx/docxtpl path first.** (STATE scope fork #3)
- **PM flagship demo = a single template-fill** (resolved scope fork #5): the Risk Register fill is the spike + acceptance bar; the standup-to-artifacts cascade is later showcase content.
- **G-6 (failure criteria upfront).** Template-fill known failure modes (run-split silent miss, unescaped XML corruption, pptx variable-row table, xlsx chart strip, merged-cell mis-write, produced-file-won't-open) become **pre-named UAT rows** — the spike logs evidence for each so Phase 101 inherits them.

### Claude's discretion (spike author's freedom)
- Exact provider model id, the throwaway harness shape, the risk-register template chosen, whether docxtpl renders locally (fast loop) vs inside the sandbox image for the spike, the exact authoring-feel artifact (throwaway HTML / transcript / Markdown is all fine).

### Out of scope for the spike (deferred)
- Locking any production schema or migration; cross-provider coverage (SC#10 binds 098+, NOT the spike); the Workflows page / NL form editor UI (Phase 103, sketch-gated); the ephemeral upload plumbing (Phase 100); the validation-gate library + judge gate (Phase 102); scheduling/budgets/grid/provenance/plugin/operator-tier (STRETCH 105–109); the `.pptx`/`.xlsx` fill paths (the spike is docx-first).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

This spike **closes no REQ-ID** — it precedes schema lock and exists to inform downstream phases. It must produce evidence that de-risks the following (closed later, not here):

| ID | Description | How the spike informs it (research support) |
|----|-------------|---------------------------------------------|
| PROJ-02 | Per-phase `folder_scope` narrows retrieval; scope from the binding, not a prompt hint | Spike exercises the existing `ToolContext.folder_subtree_ids` → `search_documents(folder_ids=...)` bound-scope seam (`tool_dispatcher.py:171`) and confirms it is a bound parameter, not a hint. Output → the `folder_scope` field hypothesis. |
| TMPL-02 | Cited Pydantic field-map (nullable, source chunk/page) rendered deterministically | Spike builds the field-map model + the forced-tool prompt and proves the LLM-produces-DATA / code-produces-FILE golden rule. Output → the `inputs` field-spec shape. |
| TMPL-03 | Re-open to assert integrity; SSTI contained via `SandboxedEnvironment` | Spike runs the re-open integrity check + `jinja2.sandbox.SandboxedEnvironment` and records clean/corrupt/won't-open evidence. |
| WFAUTH-02 | NL → draft via one-shot structured generation grounded in folder tree + registries + template | Spike's unknown (c)+(d): a throwaway one-shot generation over the `WorkflowDefinition` schema, grounded in the folder tree + tool/skill registry + the template, judged for "does it feel good." |

**The four unknowns the spike must answer in writing (ROADMAP SC#2):**
(a) Can a model reliably **derive input fields** from a template? → informs `inputs`.
(b) Does **KB-grounded docx fill** produce a clean artifact? → informs TMPL go/no-go on docxtpl.
(c) What does **authoring-time grounding** need? → informs WFAUTH generator prompt.
(d) Does **describe → refine → publish FEEL good?** → informs the Phase 103 authoring loop.
</phase_requirements>

---

## Architectural Responsibility Map

The spike is a backend-only, throwaway composition — no production tier. The map shows which *existing* tier owns each capability the spike exercises, so the planner can keep glue off the wrong tier.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Scoped KB retrieval (folder subtree) | API / Backend (`retrieval_service.search_documents`) | Database (pgvector RPC `match_document_chunks`, RLS) | Retrieval already takes a bound `folder_ids` param; spike calls it directly, server-side scope. |
| Field-map structured generation | API / Backend (native provider SDK call) | — | LLM produces DATA only; forced-tool / structured output. Never the browser. |
| `.docx` render (docxtpl) | Code-execution sandbox (Docker `llm_sandbox`) | Local venv (spike-only fast loop) | Production renders in the sealed sandbox (SSTI containment); spike may render locally first for iteration speed. |
| Integrity re-open check | Code-execution sandbox / local venv | — | Pure-Python `Document(out)` reparse; same library that wrote it. |
| Throwaway orchestration glue | Standalone script (`scripts/spike-097/`, repo root) | — | MUST be outside `backend/` (`--reload` wedge risk) and off the hot files (red line / G-5). |
| Authoring-feel one-shot generation | API / Backend (native SDK over `WorkflowDefinition` schema) | Throwaway HTML/transcript artifact | Generator grounded at *design time*; output is evidence, not a UI. |

---

## Standard Stack

### Core (what the spike composes)

| Library | Version | Purpose | Why standard / status |
|---------|---------|---------|------------------------|
| `docxtpl` | **0.20.2** (2025-11-13) | `.docx` Jinja2 templating — solves the run-split problem structurally via `{{tag}}`/`{%p %}`/`{%tr %}` | `[VERIFIED: pypi.org/pypi/docxtpl/json]` The only NEW dependency. **Absent from backend venv** `[VERIFIED: glob]`. Pulls `jinja2` + `lxml` transitively. |
| `python-docx` | 1.1.2 | OOXML read/write; the non-Jinja run-replace fallback path | `[VERIFIED: backend/Dockerfile.sandbox:43]` already in sandbox |
| `jinja2` (incl. `jinja2.sandbox`) | transitive w/ docxtpl | `SandboxedEnvironment` for SSTI containment | `[CITED: docxtpl jinja_env hook]` |
| Anthropic Python SDK (native) | as pinned in backend | Forced-tool structured field-map + authoring-feel generation | `[VERIFIED: backend/app/services/anthropic_service.py exists]`; CLAUDE.md: "Anthropic (native SDK) … raw SDK calls only" |
| `retrieval_service.search_documents` | in-repo | Scoped hybrid KB retrieval (`folder_ids` bound param) | `[VERIFIED: retrieval_service.py:244-317]` |
| `llm_sandbox` Docker sandbox | in-repo | Sealed, network-less render of the `.docx` | `[VERIFIED: sandbox_service.py]` |

### Supporting (already shipped — used only if the spike widens)

| Library | Version | Purpose | When to use |
|---------|---------|---------|-------------|
| `python-pptx` | 1.0.2 | `.pptx` run-level replace | Only if spike touches pptx (it should NOT — docx-first) |
| `openpyxl` | 3.1.5 | `.xlsx` cell write | Only if spike touches xlsx (defer) |
| `reportlab` | 4.2.5 | PDF *generate* (not fill) | Out of spike scope |

### Alternatives considered

| Instead of | Could use | Tradeoff |
|------------|-----------|----------|
| docxtpl (Jinja) | python-docx run-replace | Run-replace is the *arbitrary-upload* path (untrusted, no Jinja → no SSTI). docxtpl is the *trusted library template* path. Spike is docx/docxtpl-first; note run-replace as the Phase 101 second path. |
| Anthropic forced-tool field-map | OpenAI strict Structured Outputs (`response_format` json_schema, `strict:true`) | OpenAI's constrained decoding is the schema-conformance *ceiling*. Use as fallback comparison if Anthropic forced-tool drifts on nullable+citation fields (see Provider Choice). |
| Word content controls / SDT | — | Most robust marker but `.NET` Open-XML-SDK toolchain; no high-level Python API. **Deferred** (EXPLORATION §4). |

**Installation (spike-local fast loop):**
```bash
# in the backend venv (spike iteration only — production path is the sandbox image)
pip install docxtpl==0.20.2
```

**Sandbox image (production path — surfaced here, built in Phase 101):** add `docxtpl==0.20.2` to `backend/Dockerfile.sandbox`, rebuild, bump `SANDBOX_IMAGE` tag (CLAUDE.md convention — new chats only; sessions cache per `thread_id` until idle eviction). The spike MAY validate this image to prove the production render path, but local rendering is sufficient to answer unknown (b).

**Version verification:** docxtpl `0.20.2` confirmed against the PyPI JSON API this session (release 2025-11-13). Sandbox library versions confirmed against `backend/Dockerfile.sandbox` lines 37-49.

---

## Architecture Patterns

### System Architecture Diagram — the minimal throwaway end-to-end harness

```
                  ┌─────────────────────────────────────────────────────────────┐
   INPUT          │  scripts/spike-097/run_spike.py  (throwaway glue, repo root) │
   - KB folder id │  imports app.services READ-ONLY; native Anthropic SDK direct │
   - template.docx│  NOT in backend/ (reload wedge) · NOT threads.py/anthropic_  │
   - 1 provider   │  service.py (red line / G-5)                                 │
                  └──────────────┬──────────────────────────────────────────────┘
                                 │
            (1) PARSE TEMPLATE   ▼
      docxtpl.DocxTemplate(t).get_undeclared_template_variables()  ──►  {placeholder keys}
                                 │   = the coverage oracle for unknown (a)
                                 ▼
            (2) SCOPED RETRIEVE
      retrieval_service.search_documents(query, user_id, supabase,
            folder_ids=<risk folder subtree>)  ──►  [chunks w/ document_id, chunk_index, content]
                                 │   server-side bound scope (NOT a prompt hint)
                                 ▼
            (3) CITED FIELD-MAP  (LLM produces DATA, not the file)
      Anthropic native SDK, tool_choice=forced single tool whose input_schema
            = RiskRegisterFieldMap (every field nullable + carries source_chunk_id/page)
                                 │   ──►  field-map JSON (the evidence artifact)
                                 ▼
            (4) COVERAGE/CITATION CHECK  (deterministic, no LLM)
      assert every key ∈ field-map ∪ explicitly null; assert non-null ⇒ source present
                                 │   (fail → re-prompt once; this previews citations_required)
                                 ▼
            (5) RENDER  (deterministic; sealed sandbox OR local venv)
      DocxTemplate.render(context, jinja_env=SandboxedEnvironment(), autoescape=True)
            → doc.save(out.docx)
                                 │   ──►  filled risk-register.docx  (the headline artifact)
                                 ▼
            (6) INTEGRITY RE-OPEN  (the mandatory corruption guard)
      Document(out.docx)  → assert opens + expected table/row/section counts
                                 │   ──►  clean / corrupt / where-it-broke  (corruption log)
                                 ▼
   OUTPUT EVIDENCE: filled .docx · field-map JSON · corruption log · (separately) authoring transcript
                  + a written go/no-go + the inputs/assets/folder_scope schema shape
```

The diagram is the literal answer to the planner's question #2 ("the smallest composition that runs"). Step-to-service mapping is in the Component Responsibilities below.

### Component Responsibilities (file-to-step mapping)

| Step | Calls (existing) | Spike-new (throwaway) |
|------|------------------|------------------------|
| 1 Parse | `docxtpl.DocxTemplate.get_undeclared_template_variables()` | the parse wrapper |
| 2 Retrieve | `app.services.retrieval_service.search_documents(folder_ids=...)` (`retrieval_service.py:244`) | folder-subtree resolution for the chosen risk folder |
| 3 Field-map | native Anthropic SDK (mirror `anthropic_service` call shape, **do not import/modify it**) | `RiskRegisterFieldMap` Pydantic model + forced-tool prompt |
| 4 Coverage | — (pure Python) | the deterministic coverage+citation assertion (previews `citations_required`) |
| 5 Render | `docxtpl` + `jinja2.sandbox.SandboxedEnvironment`; optionally `sandbox_service.SandboxSessionManager.get_or_create` | the render script |
| 6 Integrity | `python-docx.Document(out)` reparse | the count assertions + corruption log |

### Recommended throwaway layout
```
scripts/spike-097/                 # repo root — OUTSIDE backend/ (no --reload wedge)
├── run_spike.py                   # the 6-step orchestrator
├── field_map.py                   # RiskRegisterFieldMap Pydantic + the forced-tool prompt
├── render_docx.py                 # docxtpl render + SandboxedEnvironment + re-open check
├── authoring_feel.py             # one-shot WorkflowDefinition generation + transcript capture
├── templates/risk-register.docx   # the real {{jinja}} template under test
└── out/                           # filled docx + field-map.json + corruption.log + transcript.md
```

### Pattern 1: LLM produces DATA, deterministic code produces the FILE
**What:** The model never touches `.docx` bytes. It emits a typed field-map; pinned library code renders.
**When to use:** Every template-fill step. This is the golden rule from EXPLORATION §4 and report C §2.
**Why it matters for the spike:** isolates unknown (a) — *can the model produce a correct, cited field-map?* — from unknown (b) — *does the renderer produce a clean file?* The two failure surfaces stay independently observable in the evidence.

### Pattern 2: Bound server-side scope, never a prompt hint
**What:** Retrieval scope is a bound `folder_ids` parameter resolved server-side, not text the model can widen.
**Source:** `tool_dispatcher.py:171` (`folder_ids=ctx.folder_subtree_ids`) + `retrieval_service.py:53` (`params["p_folder_ids"]`).
**Spike action:** call `search_documents(folder_ids=<resolved subtree>)` directly; record that scope is honored at the DB layer (this is the evidence that PROJ-02's mechanism already exists).

### Anti-patterns to avoid
- **Putting glue in `backend/app/`** — uvicorn `--reload` watches that tree; a stray scratch `.py` has wedged the backend on Windows before (project memory). Keep glue in `scripts/spike-097/`.
- **Importing/editing `anthropic_service.py` or `threads.py`** — red line + G-5. Mirror the SDK call shape in throwaway code instead.
- **Letting the LLM write OOXML / call python-docx free-hand** — the corruption source; constrain to the field-map.
- **Treating the spike's code as production** — it is throwaway. Optimize for evidence speed, not durability.

---

## The Cited Field-Map Shape (unknown a + future `inputs`)

A Pydantic model where **each field is nullable** and **carries its source chunk/page**, so the model can decline rather than hallucinate. This is the concrete artifact for unknown (a) and the direct input to the future `inputs` schema design.

```python
# scripts/spike-097/field_map.py  (throwaway)
from pydantic import BaseModel, Field

class Cited(BaseModel):
    """A single filled value with provenance. value=None means 'not found in KB'."""
    value: str | None = Field(None, description="The value, or null if the KB does not support it.")
    source_chunk_id: str | None = Field(None, description="document_chunks.id this came from.")
    source_doc: str | None = Field(None, description="filename of the source document.")
    source_page: int | None = Field(None, description="page/chunk_index if known.")

class RiskRow(BaseModel):
    risk_id: Cited
    cause: Cited
    event: Cited
    effect: Cited
    probability: Cited          # 1-5 (validate numeric downstream)
    impact: Cited               # 1-5
    # score = P×I is COMPUTE, not LLM (deterministic; render-time)
    response_strategy: Cited
    owner: Cited
    status: Cited

class RiskRegisterFieldMap(BaseModel):
    project_name: Cited
    report_date: Cited
    rows: list[RiskRow] = Field(default_factory=list, description="One per distinct KB-grounded risk.")
```

**How the LLM is prompted (forced tool-use, Anthropic native):**
- System framing: *"You fill a risk register ONLY from the provided KB excerpts. For every field, set `value` and the `source_chunk_id` it came from. If the excerpts do not support a value, set `value` to null and leave the source null. NEVER invent risks, owners, or dates."*
- User turn: the retrieved chunks (each wrapped in `<doc id="{chunk_id}" file="{filename}">…</doc>` spotlight delimiters — report E mode 7) + the placeholder key set from step 1.
- `tool_choice = {"type": "tool", "name": "emit_risk_register"}` with `input_schema = RiskRegisterFieldMap.model_json_schema()` → forces one structured emission.

**Evidence this produces:** the field-map JSON shows (i) whether the model derived the right fields from the template, (ii) the null-rate (declines vs invents), (iii) the citation coverage. That JSON is one of the four required spike artifacts.

---

## Recommended `inputs` / `assets` / `folder_scope` Schema Hypothesis (to TEST, not lock)

Based on the **current** `WorkflowDefinition` / phase configs (`models/harness.py`, read this session), the spike should *validate* this additive-optional extension. **Nothing is committed before the spike confirms the shape** — frame as a hypothesis.

Current shape (verbatim from `harness.py`): `WorkflowDefinition{ slug, version, name, status, phases }`; phase configs are an `extra="forbid"` discriminated union; immutability = "no-edit-published" (so *adding optional fields is zero-migration, non-breaking*).

**Hypothesis to validate (all OPTIONAL → old published rows still `model_validate()` cleanly):**

```python
# additive on WorkflowDefinition
project_folder_id: UUID | None = None          # PROJ-01: project = folder + subtree
inputs:  list[InputFieldSpec] | None = None    # AI-derived launch form (dynamic@design, fixed@run)
assets:  list[AssetRef]       | None = None     # Storage-backed workflow-owned templates/refs

class InputFieldSpec(_StrictBase):
    key: str
    label: str
    type: Literal["text","number","date","enum","file","kb_auto"]
    required: bool = True
    source: Literal["user","kb_auto","template_derived"] = "user"
    enum_options: list[str] = []                # when type == enum
    folder_scope: str | None = None             # if kb_auto: where to pull from

class AssetRef(_StrictBase):
    asset_id: str                               # Storage path / id
    filename: str
    kind: Literal["template","reference"]
    mime: str

# additive on LlmAgent / LlmSingle phase configs
folder_scope: str | None = None                 # PROJ-02: per-phase retrieval narrowing
```

**What the spike confirms (and may revise):**
- Whether `InputFieldSpec` needs a `template_derived` provenance flag (does the model reliably know which fields came from the template vs the description?) → unknown (a).
- Whether `Cited` provenance belongs in the *run output* vs the *inputs schema* (the field-map carries citations at run time; `inputs` only declares the shape). The spike's field-map JSON answers where provenance lives.
- Whether `folder_scope` is sufficient as a string path or needs a resolved id list (the existing `ToolContext.folder_subtree_ids` is a set of ids — the spike confirms the resolution seam).

This section is explicitly a **hypothesis the spike tests**; per the locked constraint, the spike's written output *becomes* the schema design for Phase 098/100/101.

---

## Authoring-Feel Artifact (unknown d)

The cheapest artifact that tests whether **describe → refine → publish feels good**: a throwaway one-shot structured generation over the `WorkflowDefinition` schema, grounded at design time, with the transcript captured.

**Minimal experiment:**
1. Feed a one-shot Anthropic call: (a) a plain-English description ("each week, fill our risk register from the Acme project folder"), (b) **authoring-time grounding** = the KB **folder tree** (from `folders` table) + the **tool registry** (the names `llm_agent` phases may whitelist) + the **skill registry** + the uploaded `risk-register.docx`'s derived placeholder set.
2. `WorkflowDefinition.model_json_schema()` as the response schema (`extra="forbid"` rejects hallucinated keys); `lint_workflow` (Phase D upstream — `reachability.py`) would reject unreachable graphs; on invalid, re-prompt with the validation error fed back (the spike can do this loop by hand).
3. Capture the **transcript** (`out/transcript.md`): the description, the drafted definition, one refine turn ("make phase 2 pull from /People"), the re-draft. Judge subjectively: *did the draft propose correct fields/tools/scope? Did refinement feel like talking, not wiring?*

**Throwaway is fine** — no UI. A Markdown transcript + the generated `WorkflowDefinition` JSON is sufficient evidence for unknown (d). `sketch-findings-agentic-rag` already names the production Workflows-page + NL-builder surfaces (Phase 103, sketch-gated) — the spike does **not** build them.

**What unknown (c) needs (authoring-time grounding inventory):** folder tree (exists: `folders` table), tool registry (exists: the whitelist-eligible tool names), skill registry (exists: `skills` table + catalog), template-derived field set (from step 1). The spike confirms which of these the generator actually needs to propose a correct draft — that list feeds the Phase 103 generator prompt.

---

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| docx placeholder that survives Word's run-splitting | A literal find/replace over `paragraph.text` | **docxtpl** `{{tag}}` / `{%tr %}` | Word splits `{{var}}` across XML runs; literal replace silently misses. docxtpl tags live inside one run/paragraph/row by design (report C §1.1). Also assigning `paragraph.text=` **destroys all runs + formatting**. |
| Knowing which placeholders the template needs | Regex-scan the XML yourself | `DocxTemplate.get_undeclared_template_variables()` | Built-in coverage oracle; the completeness check for unknown (a). |
| Stopping SSTI from a Jinja template | A custom Jinja allow-list | `jinja2.sandbox.SandboxedEnvironment` passed to `doc.render(..., jinja_env=...)` | docxtpl renders Jinja server-side = textbook SSTI→RCE (GHSA-v5gf-r78h-55q6). Use the maintained sandbox env + the sealed Docker sandbox. |
| Proving the file isn't corrupt | Trust the writer | Re-open with `Document(out)` + assert counts | A file that re-opens clean is a strong not-corrupted signal; catches unescaped-XML corruption + won't-open before the user does. |
| Structured field-map | Parse free-text JSON from the model | Forced tool-use (Anthropic) / strict `response_format` (OpenAI) over a Pydantic schema | Constrained/forced structured output gives near-zero format failure; matches "Pydantic for structured outputs, raw SDK" rule. |
| Scoped retrieval | A new retrieval path | `search_documents(folder_ids=...)` | The bound-scope param already exists and is RLS-backed; re-implementing would breach the red line. |

**Key insight:** the spike's *only* legitimately new code is the throwaway field-map model, the forced-tool prompt, and a thin render+check wrapper. Everything load-bearing (retrieval, sandbox, the OOXML library) is shipped — so the spike's risk is entirely *behavioral* (do the four unknowns hold), not *constructional*.

---

## Common Pitfalls / Named Failure Modes to Instrument (G-6)

The spike MUST capture evidence (clean / corrupt / where-it-broke) for each — these become Phase 101's pre-named UAT rows. Detection methods:

### Pitfall 1: docx run-split silent miss
**What goes wrong:** a placeholder typed across multiple Word runs (`{NAM`|`E}`) is never matched → silent non-replacement.
**Applies to:** the non-Jinja run-replace path (NOT docxtpl, which is run-safe by design). The spike's docxtpl path *avoids* this — record that as the reason to prefer docxtpl for trusted templates.
**How to detect:** after render, assert no residual `{{`/`{%` or literal placeholder text remains in `Document(out)`; diff the rendered text against the field-map values.

### Pitfall 2: Unescaped `& < >` XML corruption
**What goes wrong:** a KB value containing `&`, `<`, or `>` injected raw corrupts the OOXML.
**How to avoid:** `doc.render(context, autoescape=True)` or `|e` / `RichText` (report C §1.1).
**How to detect:** seed a field with a `&<>`-laden value on purpose; assert the file still re-opens. Log clean/corrupt.

### Pitfall 3: Produced file won't open
**What goes wrong:** bad tags / malformed `[Content_Types].xml` → "Word needs to repair."
**How to detect (mandatory gate):** `Document(out)` reparse must not raise and must show expected table/row counts. This is the `output_file_valid` gate previewed.

### Pitfall 4: docxtpl tag spans a structural boundary
**What goes wrong:** a `{%tr %}`/`{%p %}` tag split across a paragraph/row boundary → `TemplateSyntaxError`.
**How to detect:** catch `TemplateSyntaxError` at render; log the offending tag. (Author-side fix: keep each tag in one element.)

### Pitfall 5: Variable-length rows (the risk register IS variable-length)
**What goes wrong:** N risks ≠ template's pre-sized rows. docxtpl's `{%tr %}` repeats table rows correctly; **python-docx/pptx cannot grow tables** (pptx #192).
**How to detect:** render a 1-row, a 5-row, and a 20-row field-map; assert row counts match. This is the single most likely docx-path surprise — instrument it explicitly.
**Note:** this is *why* docx (docxtpl `{%tr %}`) is the spike target, not pptx.

### Pitfall 6: Hallucinated / uncited rows (unknown a quality)
**What goes wrong:** the model invents a plausible risk with no KB source.
**How to detect:** the step-4 coverage check — every non-null `value` must carry a `source_chunk_id`; count invented (uncited) rows. This previews `citations_required`.

### Pitfall 7: Stale-data read ("check the date first")
**What goes wrong:** the folder holds v1/v2/v3 of the register; semantic search retrieves any version.
**How to detect (lightweight for the spike):** note in the field-map evidence whether retrieved chunks span multiple register versions. Full `freshness` gate is Phase 102; the spike just *observes* whether this is a real risk in the chosen folder.

---

## Code Examples

### docxtpl render with SSTI containment + autoescape
```python
# scripts/spike-097/render_docx.py  (throwaway)
# Source: docxtpl docs (docxtpl.readthedocs.io) + jinja2.sandbox API
from docxtpl import DocxTemplate
from jinja2.sandbox import SandboxedEnvironment

def render(template_path: str, context: dict, out_path: str) -> None:
    doc = DocxTemplate(template_path)
    jenv = SandboxedEnvironment(autoescape=True)   # SSTI containment + XML-safe values
    doc.render(context, jinja_env=jenv)            # docxtpl owns the bytes; LLM never does
    doc.save(out_path)
```

### Coverage oracle + integrity re-open (the two deterministic gates, previewed)
```python
# Source: docxtpl get_undeclared_template_variables + python-docx reparse
from docxtpl import DocxTemplate
from docx import Document

def required_keys(template_path: str) -> set[str]:
    return DocxTemplate(template_path).get_undeclared_template_variables()  # coverage oracle

def assert_integrity(out_path: str, expect_min_rows: int) -> dict:
    doc = Document(out_path)                        # raises if corrupt / won't open
    tables = doc.tables
    rows = sum(len(t.rows) for t in tables)
    return {"opened": True, "tables": len(tables), "rows": rows,
            "rows_ok": rows >= expect_min_rows}
```

### Forced-tool field-map (Anthropic native — mirror, do NOT import anthropic_service)
```python
# Source: Anthropic Messages API tool_choice forcing (docs.anthropic.com tool-use)
import anthropic
from field_map import RiskRegisterFieldMap

client = anthropic.Anthropic()  # key from env (name-only per project secrets rule)
SCHEMA = RiskRegisterFieldMap.model_json_schema()

resp = client.messages.create(
    model="claude-...",                            # spike author picks the model id
    max_tokens=4096,
    tools=[{"name": "emit_risk_register",
            "description": "Emit the cited risk-register field-map.",
            "input_schema": SCHEMA}],
    tool_choice={"type": "tool", "name": "emit_risk_register"},  # FORCE structured emission
    system="Fill ONLY from the provided KB excerpts; null + no source when unsupported; never invent.",
    messages=[{"role": "user", "content": spotlighted_chunks_plus_keys}],
)
field_map = RiskRegisterFieldMap.model_validate(resp.content[0].input)  # typed, validated
```

### Scoped retrieval (existing service, read-only)
```python
# Source: backend/app/services/retrieval_service.py:244
from app.services.retrieval_service import search_documents
chunks, avg_sim = await search_documents(
    query="project risks, causes, owners, mitigation",
    user_id=user_id, supabase=supabase,
    folder_ids=risk_folder_subtree_ids,            # BOUND scope — not a prompt hint
)
```

---

## State of the Art

| Old approach | Current approach | When changed | Impact for the spike |
|--------------|------------------|--------------|----------------------|
| Visual drag-to-build workflow canvas | NL-describe → strict-parse → form-edit → lint-on-publish + read-only graph | OpenAI sunsetting hosted Agent Builder (shutdown 2026-11-30) | The authoring-feel experiment (unknown d) is NL + form, never a canvas — confirmed market direction (EXPLORATION §3/§5). |
| LLM writes the document / OOXML | LLM emits a typed cited field-map; pinned code renders | 2025-26 structured-output maturity | The golden rule the spike proves. |
| Prompt-hint folder scoping | Bound server-side `folder_ids` param + RLS backstop | shipped in-repo | Spike confirms the mechanism already exists (PROJ-02). |

**Deprecated/outdated for this spike:**
- python-docx `paragraph.text =` assignment for fills — destroys runs/formatting; superseded by docxtpl tags (or run-level replace for the arbitrary path).

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | Anthropic forced-tool gives sufficient schema fidelity for the nested nullable+citation field-map | Provider Choice / Field-Map | If it drifts, switch the spike to OpenAI strict Structured Outputs (the reliability ceiling) — cheap pivot, single-provider spike. |
| A2 | A real KB folder with risk-relevant content exists for the test user (`fhdmrd@gmail.com`) | Environment | Without it, the spike can't ground; mitigation = ingest a small risk corpus first (one-time, manual upload). |
| A3 | Docker sandbox is running and a docxtpl-augmented image is buildable for the *production-path* validation | Environment | If Docker unavailable, render locally in the venv (sufficient for unknown b); defer sandbox-image proof to Phase 101. |
| A4 | The additive-optional schema hypothesis (`inputs`/`assets`/`folder_scope`) is zero-migration | Schema Hypothesis | Immutability=no-edit-not-no-grow is verified in `harness.py` + reports D/E; very low risk, but the spike's output formally confirms the field shapes. |
| A5 | docxtpl `{%tr %}` correctly grows the risk-register table for N rows | Pitfall 5 | If it doesn't, that is a *go/no-go-affecting* finding — instrument 1/5/20-row renders explicitly. |
| A6 | The spike does NOT need an SQL migration | Constraints | Confirmed: no schema locks, workspace/storage untouched in the spike; if the spike needs to persist anything, write to `scripts/spike-097/out/` files, not the DB. |

**Empty?** No — six assumptions; A1 and A5 are the two that most affect the go/no-go.

---

## Open Questions

1. **Which exact Claude model for the field-map?**
   - Known: forced tool-use works across Claude tiers; reasoning quality varies.
   - Unclear: whether a mid-tier model suffices for field-derivation (unknown a) or a top-tier is needed.
   - Recommendation: spike with a strong Claude model first (answer the unknown cleanly), note if a cheaper one also passes.

2. **Does the chosen risk folder hold multiple register versions (freshness risk)?**
   - Known: the folder may accumulate v1/v2/v3.
   - Unclear: whether the spike's folder actually exhibits this.
   - Recommendation: just *observe and record* — the `freshness` gate is Phase 102, not the spike.

3. **Local render vs sandbox render for the spike?**
   - Known: production path is the sealed sandbox; local is faster to iterate.
   - Recommendation: render locally to answer unknown (b) fast; OPTIONALLY build the docxtpl sandbox image once to prove the production path (de-risks Phase 101). Either satisfies the spike; doing both is best evidence.

4. **Does the field-map provenance (`Cited`) belong in `inputs` or only in run output?**
   - Recommendation: the spike's field-map JSON answers this empirically — likely run-output-only, with `inputs` declaring just the shape. Capture the finding.

---

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| `docxtpl` | unknown (b) render | ✗ (not installed) | target 0.20.2 | `pip install docxtpl==0.20.2` in backend venv (spike) |
| `python-docx` | integrity re-open | ✓ (sandbox) | 1.1.2 | also `pip install` locally for the spike venv |
| Anthropic API key | field-map + authoring-feel | ✓ (in `backend/.env`) | — | OpenAI strict structured-output as A1 fallback |
| `retrieval_service` + Supabase (local :54322) | scoped retrieval | ✓ (local dev infra) | — | — |
| A real KB folder w/ risk content for the test user | grounding | ✗ confirm at plan time | — | ingest a small risk corpus once (manual upload) — A2 |
| Docker / `llm_sandbox` | production render path (optional for spike) | ⚠ confirm (Docker probe denied this session) | — | render locally in venv — A3 |
| A `{{jinja}}` risk-register `.docx` template | unknown (a)/(b) | ✗ create one | — | author a small docxtpl template with `{%tr %}` rows |

**Missing with no fallback (blocks the spike until provided):**
- A real KB folder with risk-relevant documents for the test user (A2) — *the* prerequisite; without grounding there is nothing to fill.
- A `{{jinja}}` risk-register template — must be authored (small, with a `{%tr %}` table).

**Missing with fallback:**
- docxtpl (install), Docker sandbox (render locally), Anthropic fidelity (OpenAI fallback).

**Skip note:** Runtime State Inventory is **omitted** — this is a greenfield throwaway spike, not a rename/refactor/migration. No SQL migration (A6).

---

## Validation Architecture (spike-framed)

> `nyquist_validation: true` in `.planning/config.json` — section included. For a SPIKE, "validation" = **what observable evidence proves each of the 4 unknowns was actually answered**, not production test coverage. There is no durable code to unit-test; the deliverable is evidence + a go/no-go.

### Evidence framework
| Property | Value |
|----------|-------|
| Framework | None (throwaway script; no test suite added) — the spike's "tests" are the captured artifacts |
| Artifacts dir | `scripts/spike-097/out/` |
| Quick run | `python scripts/spike-097/run_spike.py --folder <id> --template templates/risk-register.docx` |
| Full evidence run | the quick run + `authoring_feel.py` transcript capture |

### Unknown → evidence map (the spike's acceptance bar)
| Unknown | Behavior to prove | Evidence type | Observable artifact (pass condition) |
|---------|-------------------|---------------|--------------------------------------|
| (a) derive input fields | Model emits the right cited field schema from the template | field-map JSON | `out/field-map.json` keys ⊇ template placeholder set; null-rate sane; non-null rows carry `source_chunk_id` |
| (b) clean docx fill | docxtpl renders an openable, correctly-rowed `.docx` | filled file + integrity log | `out/risk-register-filled.docx` re-opens; `out/corruption.log` shows clean for 1/5/20-row renders |
| (c) authoring-time grounding | A grounded one-shot generation needs folder tree + tool/skill registry + template | grounding inventory + draft | `out/transcript.md` lists what grounding the draft used; draft proposes correct fields/tools/scope |
| (d) describe→refine→publish feel | The loop feels like talking, not wiring | transcript | `out/transcript.md` captures describe → 1 refine → re-draft; subjective written verdict |
| failure modes (G-6) | Each named mode is observed clean/corrupt/where-broke | corruption log | `out/corruption.log` has a row per Pitfall 1-6 (the Phase 101 UAT seed) |
| go/no-go | A written recommendation on docxtpl + the schema shape | the RESEARCH-CONCLUSION doc | a written go/no-go + the `inputs`/`assets`/`folder_scope` shape |

### Sampling rate
- **Per spike iteration:** the quick run (one folder, one template) — < 1 min after warm KB.
- **Phase gate:** all four unknowns have a written answer + the six failure-mode rows logged + the go/no-go written (ROADMAP SC#1-4).

### Wave 0 gaps
- [ ] Author `scripts/spike-097/templates/risk-register.docx` (a `{%tr %}` table template) — covers (a)/(b)
- [ ] Ensure a real risk-content KB folder exists for the test user — covers grounding (A2)
- [ ] `pip install docxtpl==0.20.2` in the spike venv — covers (b)
*(No conftest/framework install — throwaway script, no suite.)*

---

## Security Domain

> `security_enforcement` absent in config → treated as enabled. Scoped to the spike: the load-bearing item is **SSTI containment** (docxtpl renders Jinja server-side). Other categories are largely inherited from shipped infra.

### Applicable ASVS categories
| ASVS category | Applies | Standard control |
|---------------|---------|------------------|
| V5 Input Validation | yes | Pydantic `extra="forbid"` field-map + `WorkflowDefinition` schema; coverage/citation assertion |
| V6 Cryptography | no (spike) | none — no secrets minted; never hand-roll |
| V12/V5 SSTI (template injection) | **yes — load-bearing** | `jinja2.sandbox.SandboxedEnvironment` passed to `doc.render(jinja_env=...)` + render inside the sealed, network-less Docker sandbox |
| V4 Access Control / RLS | yes (inherited) | `search_documents` bound `folder_ids` + Supabase RLS backstop; retrieved `folder_id` ⊆ scope |
| V2/V3 Auth/Session | no (spike) | spike runs as the dev test user; no new auth surface |

### Known threat patterns for this stack
| Pattern | STRIDE | Standard mitigation |
|---------|--------|---------------------|
| SSTI → RCE via a malicious `.docx` Jinja template (GHSA-v5gf-r78h-55q6, RAGFlow GHSA-vvwj-fvwh-4whx) | Elevation of Privilege | `SandboxedEnvironment` + sealed sandbox; **reserve Jinja templates for trusted library authors**; arbitrary uploads use the non-Jinja run-replace path (Phase 101) |
| Indirect prompt injection from KB content (EchoLeak CVE-2025-32711 class) | Tampering | spotlight retrieved chunks in `<doc>` delimiters; the field-map phase has NO outbound/exfil tool (read-only); split read-vs-act phases (report E mode 7) |
| Hallucinated (uncited) register rows | Tampering (data integrity) | deterministic coverage+citation check before delivery (previews `citations_required`) |
| Unescaped XML corruption | Tampering | `autoescape=True` / `|e` / `RichText`; re-open integrity gate |

**Spike security note:** the spike's docxtpl path uses a **trusted, spike-authored** template, so SSTI is low-risk in the spike itself — but the spike MUST still wire `SandboxedEnvironment` to *prove the containment pattern works* (it is the TMPL-03 mechanism Phase 101 depends on).

---

## Sources

### Primary (HIGH confidence)
- `backend/app/models/harness.py` — current `WorkflowDefinition`/`PhaseConfig`/`ValidatorSpec` (additive-optional, `extra="forbid"`) — read this session
- `backend/app/services/harness/phase_types.py`, `validators.py`, `programmatic.py` — the 5 executors, gate fan-in, closed registries — read this session
- `backend/app/services/retrieval_service.py:244-317` + `tool_dispatcher.py:165-216` — `search_documents(folder_ids=...)` bound-scope seam — read this session
- `backend/app/services/sandbox_service.py` + `backend/Dockerfile.sandbox` — sandbox manager + shipped library set (python-docx 1.1.2 etc.; docxtpl NOT present) — read this session
- `pypi.org/pypi/docxtpl/json` — docxtpl 0.20.2, released 2025-11-13, deps python-docx/jinja2/lxml — `[VERIFIED]` this session
- `.planning/research/v2.9-exploration/C-template-fill-tech.md` — docxtpl mechanics, run-split, SSTI, validation layers — PRIMARY upstream
- `.planning/research/v2.9-exploration/D-workflow-authoring-arch.md` — additive fields, one-shot NL generation, authoring loop
- `.planning/research/v2.9-exploration/E-pitfalls-governance.md` — failure taxonomy, citations/freshness/integrity gates, injection, RLS
- `.planning/ROADMAP.md` (Phase 097 detail), `.planning/STATE.md`, `.planning/REQUIREMENTS.md`, `.planning/seeds/SEED-051-*.md` — locked scope/constraints

### Secondary (MEDIUM confidence)
- EXPLORATION §4 golden-rule + format-by-format table (synthesized from C, verified-supported)
- docxtpl docs (docxtpl.readthedocs.io) — tag vocabulary, `get_undeclared_template_variables`, `jinja_env` hook (cited via report C)
- Anthropic tool-use / forced `tool_choice` (docs.anthropic.com) — structured emission pattern (cited)
- GHSA-v5gf-r78h-55q6 (document-merge-service SSTI), Jinja2 `sandbox` API — SSTI mitigation (cited via report C)

### Tertiary (LOW confidence — to confirm during the spike)
- Anthropic forced-tool fidelity on a nested nullable+citation schema (A1 — confirm empirically; OpenAI strict is the fallback)
- docxtpl `{%tr %}` row growth for variable-length risk registers (A5 — confirm with 1/5/20-row renders)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — docxtpl version verified on PyPI; all other libs verified in the live sandbox Dockerfile + venv.
- Composition seams (retrieval/sandbox/harness): HIGH — read from live code this session.
- Schema hypothesis: MEDIUM — that is precisely what the spike exists to confirm; framed as a hypothesis to test.
- Provider choice: MEDIUM — Anthropic recommended on native-flagship + forced-tool grounds; OpenAI strict named as the fidelity-ceiling fallback.
- Authoring-feel (unknown d): MEDIUM — experimental design is sound; the "feel" verdict is inherently subjective and is the spike's job to produce.

**Research date:** 2026-06-08
**Valid until:** ~2026-07-08 (30 days; docxtpl is stable, the in-repo seams are shipped). Re-verify docxtpl version + Docker availability at plan time.

---

## Provider Choice for the Spike

**Recommendation: run the spike on Anthropic (Claude), native SDK, forced tool-use.**

Rationale:
1. **Native-flagship alignment** — Anthropic is the project's native-SDK flagship (CLAUDE.md); the production milestone leans on it. De-risking on it gives the most transferable evidence.
2. **Forced tool-use = reliable structured emission** — `tool_choice={"type":"tool","name":...}` with the field-map as `input_schema` forces a single schema-conformant emission, which handles the nested nullable + citation field-map well in practice.
3. **Strong at the derive-fields-from-template task** (unknown a) — Claude's document reasoning is a good fit for inferring the register schema from the template.
4. **SC#10 does NOT bind the spike** — cross-provider coverage is mandated for 098+ (workflow-run-bearing), not for the throwaway spike. Single-provider is correct here.

**Honest tradeoff (A1):** OpenAI's strict Structured Outputs (`response_format` json_schema, `strict: true`) is the schema-conformance *ceiling* (constrained decoding guarantees a valid object). If, during the spike, Anthropic forced-tool shows drift on the nullable/citation fields, **pivot the single-provider spike to OpenAI strict** — a cheap swap since the field-map model is provider-agnostic. Do not run both as a matrix; the spike is single-provider by design.
