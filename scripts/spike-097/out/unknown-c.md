# Unknown (c) — What authoring-time grounding does the NL->workflow generator NEED?

**Spike:** Phase 097 Plan 04 (Wave 1) — THROWAWAY · **Generated:** 2026-06-08T19:49:23.734342+00:00
**Provider:** anthropic (native SDK, forced tool_choice) · **Model:** `claude-opus-4-8`
**Method:** one forced-tool generation over the strict `WorkflowDefinition` schema, grounded
at design time in four sources (folder tree / tool names / skill names / template placeholders),
then one refine turn. This is the inventory that feeds the Phase 103 generator prompt (WFAUTH-02).

## Grounding inventory — what the draft actually USED

| Grounding source | Provided? | Used by the draft? | Evidence |
|------------------|-----------|--------------------|----------|
| (a) KB folder tree | yes (5 folders) | YES | folder refs in draft: names=['Project Meridian — Risks', 'Weekly reports'], ids=['2a33b3e3-4904-4671-af1c-d041805ded47', '75755ec9-5ba7-495b-ad93-7500011cf6f2'] |
| (b) Tool registry (names) | yes (24 tools) | YES | whitelisted tools: draft1=['analyze_document', 'glob', 'grep', 'ls', 'query_documents', 'read_document', 'search_documents', 'tree', 'workspace_list', 'workspace_read', 'workspace_write'], redraft=['analyze_document', 'glob', 'grep', 'ls', 'query_documents', 'read_document', 'search_documents', 'tree', 'workspace_list', 'workspace_read', 'workspace_write']; invalid (off-registry): [] |
| (c) Skill registry (names) | yes (3 skills) | NO | skill refs in draft: none |
| (d) Template placeholders | yes (3 fields) | YES | placeholder refs in draft: ['project_name', 'report_date', 'rows'] |

**Provided placeholders:** ['project_name', 'report_date', 'rows']
**Provided tool names:** ['search_documents', 'query_documents', 'ls', 'tree', 'grep', 'glob', 'read_document', 'analyze_document', 'load_skill', 'save_skill', 'read_skill_file', 'remember', 'recall', 'query_tables', 'workspace_write', 'workspace_read', 'workspace_list', 'workspace_delete', 'workspace_diff', 'write_todos', 'task', 'ask_user', 'web_search', 'execute_code']

## Did the draft propose correct structure from the description alone?

- First-draft phases: ['0:gather-risks (llm_agent)', '1:draft-register (llm_single)', '2:confirm-before-finalize (llm_human_input)', '3:finalize-register (llm_agent)']
- Re-draft phases: ['0:gather-risks (llm_agent)', '1:draft-register (llm_single)', '2:confirm-before-file (llm_human_input)', '3:finalize-register (llm_agent)']
- First draft already contains an `llm_human_input` (the 'pause for me to confirm') phase: True
- Refine ADDED a human-confirm phase that wasn't there: False
- Refine narrowed retrieval scope toward `/Risks`: True

## `folder_scope` shape finding (RESEARCH Open Question — the resolution seam)

The current strict `WorkflowDefinition` schema has **no `folder_scope` field** (and no
`project_folder_id` / `inputs` / `assets`). So the generator had nowhere to put a BOUND
retrieval scope — the scope can only surface as **resolved folder id(s) embedded in prompt text**.

- Scope expressed as a structured/bound field: **NO** (the schema offers none — `extra="forbid"`
  would reject an invented `folder_scope` key, which is exactly why both drafts had to encode
  scope as free text inside an llm_agent `prompt`).
- Scope expressed as a string path vs a resolved id: **resolved id(s)**.

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
4. **Skill registry (names)** — useful-but-optional here: the draft did not reference a skill in this run; carry it so skill-backed phases are authorable, but it is lower-priority than (1)-(3) for this task.

**Net:** folder tree + tool names + template placeholders are the MUST-HAVE grounding; the
skill registry is nice-to-have. The biggest schema gap surfaced is the missing bound
`folder_scope`/`project_folder_id` (PROJ-02) — the single most important additive field the
spike's evidence points the Phase 098/100/101 schema work at.
