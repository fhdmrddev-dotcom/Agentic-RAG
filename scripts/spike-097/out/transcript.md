# Phase 097 Plan 04 — Authoring-Feel Transcript (unknowns c + d)

**Spike:** Phase 097 Wave 1 (SEED-051) — THROWAWAY · **Generated:** 2026-06-08T19:49:23.734342+00:00
**Provider:** anthropic (native SDK, forced tool_choice) · **Model that answered:** `claude-opus-4-8`
**Response schema:** the strict `WorkflowDefinition` (`extra="forbid"`) — the SAME model an
NL generator would target in Phase 103. Hallucinated/extra keys are rejected and re-prompted.

This transcript captures the authoring conversation the operator judges in Task 2 (does
**describe -> refine -> publish** feel like talking, not wiring?). It is NOT the verdict —
that is `unknown-d.md`, the operator's call.

---

## Design-time grounding (names + template fields only)

### (a) KB folder tree
- DBA  (id=37380338-2ccd-4eec-84be-645036d37a09)
- Hybrid Search  (id=0e479f7e-98bc-46d7-90ad-852d0f027d9b)
- Project Meridian — Risks  (id=75755ec9-5ba7-495b-ad93-7500011cf6f2)   <-- the project folder (spike-config.folder_id)
- Test Wasim  (id=33358dfe-1ad0-4907-89d2-86cff44808e1)
- Weekly reports  (id=2a33b3e3-4904-4671-af1c-d041805ded47)

### (b) Tool registry — names eligible for an llm_agent `available_tools` whitelist
- search_documents: Search the user's uploaded documents for relevant information
- query_documents: Run a SQL SELECT query against the user's documents or folders tables to answer structured questions about their uploaded files...
- ls: List the immediate contents (subfolders and documents) at a folder path in the user's knowledge base
- tree: Show the full folder hierarchy of the user's knowledge base as a tree, with documents attached to each folder
- grep: Search the content of the user's documents using a regex pattern
- glob: Find documents by filename pattern using glob syntax
- read_document: Read the raw markdown content of a document by its ID
- analyze_document: Perform deep analysis of a specific document by reading its FULL content
- load_skill: Load the full instructions and attached file list for a skill by name
- save_skill: Create or update a skill with the given name, description, and instructions
- read_skill_file: Read the content of a file attached to a skill
- remember: Store a fact or preference about the user that should persist across conversations
- recall: Retrieve stored memory entries about the user
- query_tables: Query structured tables extracted from a specific document
- workspace_write: Write or update a file in the thread's persistent workspace
- workspace_read: Read a file from the thread's workspace
- workspace_list: List files in the thread's workspace, optionally filtered by path prefix
- workspace_delete: Delete a file from the thread's workspace
- workspace_diff: Show the differences between two versions of a workspace file
- write_todos: Record or update the task list for a multi-step request so it appears in the user's workspace panel
- task: Spawn a focused sub-agent to perform a delegated piece of work and return a summary
- ask_user: Pause and ask the user a question
- web_search: Search the web for current information not available in the user's uploaded documents
- execute_code: Execute Python code in a sandboxed Docker container

### (c) Skill registry (enabled, user-owned + global)
- pptx: Use this skill any time a .pptx file is involved in any way — as input, output, or both. This includes: creating slide d
- docx: Use this skill whenever the user wants to create, read, edit, or manipulate Word documents (.docx files). Triggers inclu
- weekly-report-writer: Generates a weekly status report as a formatted Word document (.docx). Activate when the user says: write my weekly repo

### (d) Template-derived placeholder fields (the risk-register the workflow must fill)
project_name, report_date, rows


---

## 1. Describe (plain-English task — the literal description)

> Each week, fill our risk register from the Acme project folder, grounded in our KB, and pause for me to confirm before finalizing.

### First draft — WorkflowDefinition (validated against the strict schema)

Validation:
  - Attempt 1 [claude-opus-4-8, stop_reason=tool_use, in=4328 out=1043 tok]: VALID

```json
{
  "slug": "weekly-risk-register-fill",
  "version": 1,
  "name": "Weekly Risk Register Fill — Project Meridian",
  "status": "draft",
  "phases": [
    {
      "slug": "gather-risks",
      "phase_index": 0,
      "config": {
        "phase_type": "llm_agent",
        "prompt": "Research the latest project risks for the risk register. Work strictly within the 'Project Meridian — Risks' folder (id=75755ec9-5ba7-495b-ad93-7500011cf6f2) in the knowledge base. List its contents, read and analyze the relevant documents, and extract every current risk grounded in those documents. For each risk capture: a short description, likelihood, impact, owner, and mitigation/status. Do NOT invent risks — every row must be supported by content found in this folder. Output a structured list of risk rows plus the project_name and report_date (use today's date) to fill the risk register template (fields: project_name, report_date, rows).",
        "available_tools": [
          "ls",
          "tree",
          "search_documents",
          "grep",
          "glob",
          "read_document",
          "analyze_document",
          "query_documents",
          "workspace_write"
        ],
        "max_steps": 20,
        "wall_clock_seconds": null,
        "model": null
      },
      "validators": []
    },
    {
      "slug": "draft-register",
      "phase_index": 1,
      "config": {
        "phase_type": "llm_single",
        "prompt": "Using the extracted risk data from the previous phase, assemble a clean draft of the risk register. Produce the template fields: project_name (Project Meridian), report_date (today's date), and rows (one entry per risk with description, likelihood, impact, owner, and mitigation/status). Present the draft clearly so the human can review it before finalizing.",
        "model": null,
        "temperature": null
      },
      "validators": []
    },
    {
      "slug": "confirm-before-finalize",
      "phase_index": 2,
      "config": {
        "phase_type": "llm_human_input",
        "prompt": "Here is the drafted risk register filled from the 'Project Meridian — Risks' folder. Please review the risks and their details. Do you approve finalizing this risk register, or would you like to edit it first?",
        "options": [
          "Approve and finalize",
          "Request edits"
        ],
        "timeout_seconds": 300
      },
      "validators": []
    },
    {
      "slug": "finalize-register",
      "phase_index": 3,
      "config": {
        "phase_type": "llm_agent",
        "prompt": "After human approval, finalize the weekly risk register. Render the confirmed template fields (project_name, report_date, rows) into the final risk register document and save it to the workspace. Save the finalized risk register into the 'Weekly reports' folder (id=2a33b3e3-4904-4671-af1c-d041805ded47). If the human requested edits, apply them first, then finalize.",
        "available_tools": [
          "workspace_write",
          "workspace_read",
          "workspace_list",
          "read_document"
        ],
        "max_steps": 12,
        "wall_clock_seconds": null,
        "model": null
      },
      "validators": []
    }
  ]
}
```

---

## 2. Refine (the literal one refine turn)

> Make the research phase pull only from the /Risks subfolder, and add a human-confirm step before the file is produced.

### Re-draft — WorkflowDefinition (validated against the strict schema)

Validation:
  - Attempt 1 [claude-opus-4-8, stop_reason=tool_use, in=5380 out=1030 tok]: VALID

```json
{
  "slug": "weekly-risk-register-fill",
  "version": 1,
  "name": "Weekly Risk Register Fill — Project Meridian",
  "status": "draft",
  "phases": [
    {
      "slug": "gather-risks",
      "phase_index": 0,
      "config": {
        "phase_type": "llm_agent",
        "prompt": "Research the latest project risks for the risk register. Work STRICTLY and ONLY within the 'Project Meridian — Risks' folder (id=75755ec9-5ba7-495b-ad93-7500011cf6f2) — this is the /Risks subfolder. Do not read or pull from any other folder in the knowledge base. List its contents, read and analyze the documents inside it, and extract every current risk grounded in those documents. For each risk capture: a short description, likelihood, impact, owner, and mitigation/status. Do NOT invent risks — every row must be supported by content found in this folder. Output a structured list of risk rows plus the project_name and report_date (use today's date) to fill the risk register template (fields: project_name, report_date, rows).",
        "available_tools": [
          "ls",
          "tree",
          "search_documents",
          "grep",
          "glob",
          "read_document",
          "analyze_document",
          "query_documents",
          "workspace_write"
        ],
        "max_steps": 20,
        "wall_clock_seconds": null,
        "model": null
      },
      "validators": []
    },
    {
      "slug": "draft-register",
      "phase_index": 1,
      "config": {
        "phase_type": "llm_single",
        "prompt": "Using the extracted risk data from the previous phase, assemble a clean draft of the risk register. Produce the template fields: project_name (Project Meridian), report_date (today's date), and rows (one entry per risk with description, likelihood, impact, owner, and mitigation/status). Present the draft clearly so the human can review it before finalizing.",
        "model": null,
        "temperature": null
      },
      "validators": []
    },
    {
      "slug": "confirm-before-file",
      "phase_index": 2,
      "config": {
        "phase_type": "llm_human_input",
        "prompt": "Here is the drafted risk register filled from the 'Project Meridian — Risks' folder. Please review the risks and their details before the file is produced. Do you approve producing the final risk register file, or would you like to edit it first?",
        "options": [
          "Approve and produce file",
          "Request edits"
        ],
        "timeout_seconds": 300
      },
      "validators": []
    },
    {
      "slug": "finalize-register",
      "phase_index": 3,
      "config": {
        "phase_type": "llm_agent",
        "prompt": "Only after human approval, produce the final weekly risk register FILE. Render the confirmed template fields (project_name, report_date, rows) into the final risk register document and save it to the workspace. Save the finalized risk register into the 'Weekly reports' folder (id=2a33b3e3-4904-4671-af1c-d041805ded47). If the human requested edits, apply them first, then produce the file.",
        "available_tools": [
          "workspace_write",
          "workspace_read",
          "workspace_list",
          "read_document"
        ],
        "max_steps": 12,
        "wall_clock_seconds": null,
        "model": null
      },
      "validators": []
    }
  ]
}
```

---

## 3. Validation summary

- Both drafts validated against the strict `WorkflowDefinition` schema via
  `WorkflowDefinition.model_validate(...)`.
- First draft: valid on first emission.
- Re-draft: valid on first emission.
- The strict schema rejects extra keys (`extra="forbid"`), so any hallucinated field would
  have surfaced as a ValidationError and triggered the recorded re-prompt.
