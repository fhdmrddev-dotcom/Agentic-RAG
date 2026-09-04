---
name: gsd
description: Get Shit Done (GSD) Framework. Use whenever the user asks for GSD commands (progress, next, execute-phase, plan-phase, sketch, state, roadmap, audit, etc.) or wants to advance project milestones in .planning/.
---

# GSD (Get Shit Done) Framework for Antigravity

This skill enables Google Antigravity to natively interpret and execute all GSD workflows in this repository.

## 1. Project Context & Locations
* **Project State & Roadmap:** `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`
* **Phase Specs & Plans:** `.planning/phases/`
* **Workflows & References:** `.claude/get-shit-done/workflows/` and `.claude/get-shit-done/references/`
* **Commands Reference:** `.claude/commands/gsd/`

## 2. How to Handle GSD Invocations

When the user asks for a GSD command (e.g. `gsd progress`, `/gsd:progress`, `gsd next`, `gsd execute phase X`, `gsd sketch`, `gsd plan-phase`, etc.):

1. **Identify the Target Workflow:**
   - Look up the corresponding workflow markdown file in `.claude/get-shit-done/workflows/<workflow_name>.md`.
   - Read the workflow instructions and rules.

2. **Read Current State:**
   - Inspect `.planning/STATE.md` to understand current milestone, active phase, stopped point, and owed tasks.
   - Inspect the active phase directory under `.planning/phases/`.

3. **Execute the Step:**
   - Follow the exact steps specified in the GSD workflow.
   - Use Antigravity tools (`view_file`, `replace_file_content`, `write_to_file`, `run_command`) to edit code, execute tests, and generate plans.

4. **Update State Files:**
   - Keep `.planning/STATE.md` updated with the new phase status, completed plans, and next actions.
   - Preserve existing decisions and audit entries verbatim.
