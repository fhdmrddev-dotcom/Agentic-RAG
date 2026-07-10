---
seed_id: SEED-112
title: Per-workflow / per-run KB folder-scope selection — let a workflow retrieve from ONLY a chosen project folder
status: open
planted: 2026-07-10
phase_origin: "Operator, during Phase 143 (Starter Workflow Library) live UAT: after forking a starter, asked where to make the workflow 'only search for that specific folder of the project.' The 3 starters deliberately ship UNSCOPED (the private folder binding was stripped at promotion so retrieval runs over the forker's whole KB — D-143-4b). Operator wants the inverse option for their OWN workflows: bind/select a target project folder so a run retrieves only from it. Operator framed it as a future UX enhancement (‘let's ignore this [for 143]’), gated on competitor research first."
category: product capability — workflow run-input / retrieval-scope surface, deferred (v3.3 workflow-UX cluster)
related_seeds:
  - SEED-110-workflow-runtime-template-file-upload (sibling run-input surface — the Run modal already shows a READ-ONLY bound-folder chip; this seed makes that scope user-selectable)
  - SEED-051-generalized-nl-workflow-authoring (authoring surface that would expose the scope control)
  - SEED-111-workflow-delete-and-cascade-lifecycle (workflow lifecycle sibling)
  - SEED-076-filtered-vector-search-recall-pgvector-index-scale (the retrieval-filter INFRA this UX rides on)
related_phases:
  - Phase 143 (Starter Workflow Library) — surfaced this gap; starters are intentionally unscoped
related_memories: [reference_render_template_workflow_only, feedback_iterate_leverage_existing]
priority: medium
---

# SEED-112 — per-workflow / per-run KB folder-scope selection (deferred, v3.3 workflow-UX cluster)

## The finding (2026-07-10, Phase 143 live UAT)

A forked starter's `retrieve` step (`llm_agent`) uses the `search_documents` tool over the user's
knowledge base with **no folder-scope field in the Builder** — by design for the starters (D-143-4b
strips the private folder binding so retrieval runs over the FORKER's own KB, never the operator's
private "PM Demo Project"). Chat scopes retrieval per-thread via the "Scope this conversation to a
specific folder" dropdown; the Workflows Run modal already carries a **read-only** bound-folder chip
(see SEED-110). What is missing is the operator's wanted case:

> "I have a project and I need this workflow to only search that specific folder of the project."

i.e. a **user-selectable retrieval scope** on a workflow (at author/publish time, or as a run input),
so a run retrieves ONLY from a chosen project folder instead of the whole KB.

## Why deferred (not folded into Phase 143)

- Phase 143's red line was "no new runtime — one shelf section + content authoring." A selectable
  retrieval scope touches the workflow definition schema (a per-workflow/per-run scope field), the
  agent's `search_documents` tool wiring (constrain to a folder), the Run modal (make the chip
  editable), and RLS/ownership on the chosen folder — comfortably its own phase.
- It needs an **SC#10 cross-provider proof** (scope must constrain retrieval identically across
  OpenAI / Anthropic / Google / OpenRouter).
- It did NOT block 143: the 3 shipped starters are universal KB→document workflows that work over
  whatever the forker's KB holds.

## Design input — competitor research FIRST (operator directive)

Before expanding the workflow UX, research how competitors expose workflow scope + inputs — the
operator specifically named **Glean** and **Beam AI**. Capture how they let a user (a) point a
workflow at a subset of the knowledge base, (b) hand in run inputs, and (c) keep it simple. The
north star the operator restated: **enhance UX / simplify, while keeping workflows accurate, smooth,
and error-free.** This research should inform the whole v3.3 workflow-UX cluster (this seed +
SEED-110 template upload + SEED-051 NL authoring + SEED-111 lifecycle), not just this one control.

## Re-open trigger

Fire when **either**:
1. A user asks to **constrain a workflow's retrieval to a specific folder/project** (recurring "make
   it only search this folder" signal), OR
2. The **v3.3 workflow-UX expansion** is scoped — at which point the Glean/Beam competitor research
   runs FIRST and this becomes a concrete scope-selection sub-feature.

**MUST be surfaced at the `/gsd:new-milestone` v3.3 sweep** alongside SEED-110 as part of the
workflow-UX cluster — do not let it rot as a dormant seed.

## Implementation sketch (when promoted)

- Add an OPTIONAL retrieval-scope field on the workflow definition (folder_id) OR a run-input scope
  selector; absent = current whole-KB behavior (keep the starters' unscoped default intact).
- Constrain `search_documents` to the chosen folder when a scope is set (reuse the chat per-thread
  folder-scope path + SEED-076 filtered-vector-search infra — don't invent a second retrieval path).
- Make the Run modal's bound-folder chip editable (or add a scope picker), owner-scoped by RLS.
- Cross-check SEED-110's Run-modal upload surface for a shared "run inputs" pattern.

## Related
- Phase 143 CONTEXT `<deferred>` — the starters-are-unscoped decision (D-143-4b) that surfaced this.
- SEED-110 — sibling run-input surface (template upload); the two form the v3.3 Run-modal enhancement.
- `[[reference_render_template_workflow_only]]` — `render_template` is fill-only, whitelist-gated.
