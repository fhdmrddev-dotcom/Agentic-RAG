---
seed_id: SEED-157
title: The AI drafts a workflow BLIND to the template it will have to fill
status: open
planted: 2026-08-14
planted_by: Quick task 260814-q5r — operator critique during the end-to-end UAT
surface: Agentic-RAG
severity: high
affected_areas: [workflow-authoring, WorkflowBuilderPage, workflows/generate, templates, grounding]
requirements: [AUTH-03, AUTH-02]
re_open_trigger: >
  Any phase touching the describe door's pre-draft screen, OR any phase touching
  POST /workflows/generate or its client, OR the next phase that claims AUTH-03 is satisfied.
  Whichever comes first.
trigger_when: unset
---

# The AI drafts blind to the template

## The operator's words (2026-08-14)

> *"if I describe today a workflow that I need a template, then it will draft without knowing what
> is in my template anyway. So I don't know, this is not a valid case."*

They are right, and the measurement below is worse than the critique.

## Measured, not assumed

- `POST /workflows/generate` has accepted **`template_asset_id` AND `template_placeholders`
  since Phase 103** (`backend/app/api/workflows.py:1538-1547`, `GenerateRequest`).
- **The frontend has never sent either.** `WorkflowBuilderPage.tsx:1267` sends exactly
  `{ describe, project_folder_id? }`. Verified at the only call site of `generateWorkflow(` in the
  whole app.
- `template_asset_id` is typed **`UUID | None`**, while the Phase-193 upload door mints a Storage
  **path** (`{user_id}/_library/{definition_id}/{uuid8}-{name}`). Passing a real asset id is a
  **422** before the handler runs — the *identical* defect found the same day on
  `/workflows/grounding-bundle` (see `260814-q5r-SUMMARY.md`). **So that channel is unwirable as
  typed, and only `template_placeholders: list[str]` actually works.**

## ⚠ The precise failure is NOT what it looks like

At **run** time the emit step **is** shown the template's placeholder keys — Phase 101.1-06
productized that after a live run failed (`7fa36d2a`, *"UndefinedError: 'project_name' is
undefined … the model, never shown the template's placeholders, invented its own key names"*,
recorded at `template_render_service.py:355-375`). Runs no longer crash on this.

The damage is **upstream, at draft time, and it is silent**: the AI designs *retrieval steps* for
fields it has never seen. The run then fills a correct template from evidence gathered to answer a
different question. You get a document; it is simply not grounded in the right things. Nothing
fails, so nothing reports it.

## Why it is now cheap to fix

Quick task `260814-q5r` shipped `GET /workflows/{id}/template/placeholders`, which returns exactly
the `list[str]` that `/generate` already accepts. **The producer and the consumer now both exist
and have never been connected.** The wire-up is: attach template → read placeholders → pass them
as `template_placeholders` on generate.

## The business case

A weekly status report, a QBR deck, a compliance return — the client's format is fixed and is the
*whole point*. The template's placeholders **are** the requirement: `pm-weekly-status-report.docx`
asks for exactly 8 fields (`accomplishments, milestones, overall_rag_status, planned_next,
project_name, reporting_period, risks_blockers, summary`, measured by parsing the real file). A
workflow whose job is "retrieve enough evidence to fill those 8" writes itself. Describing that
same intent in prose and hoping the model reconstructs the same 8 field names is strictly worse.

## The shape to build (proposal, not a decision)

**Template-first becomes the default door**: attach the template *before* describing → its
placeholders become the visible spec → the AI drafts to a known target. Draft-then-attach
(shipped 2026-08-14) stays as the fallback for when no template exists yet.

⚠ **The fallback needs a safety net that does not exist:** when a template is attached to an
already-drafted workflow, nothing re-checks the draft against the placeholders. The AI should
reconcile and offer the diff. Without it, scenario 2 quietly inherits scenario 1's defect.

Related: [[SEED-158]] (plain templates with no placeholders), [[SEED-159]] (silent blanks).
