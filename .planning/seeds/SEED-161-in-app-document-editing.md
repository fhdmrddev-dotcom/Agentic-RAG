---
seed_id: SEED-161
title: In-app document editing — a general capability, explicitly NOT this milestone
status: open
planted: 2026-08-14
planted_by: Operator direction during the 260814-q5r end-to-end UAT
surface: Agentic-RAG
severity: medium
affected_areas: [documents, templates, document-management, sandbox, frontend]
requirements: []
re_open_trigger: >
  A milestone being scoped around document management or content authoring, OR [[SEED-158]]
  (plain templates) being picked up and its option 1/3 chosen — both need an editor and neither
  should build a private one. Whichever comes first.
trigger_when: unset
---

# Editing documents inside the app

## The operator's direction (2026-08-14), verbatim in substance

> *"I think the ability to edit documents — not only docx — should be there in the application
> anyway. But this is a future thing; I don't know if we need to build it during this workflow
> milestone."*

**Recorded as a dated direction, and the answer to their own question is: no, not this
milestone.** It is a document-editor feature wearing a workflow costume, and scoping it into
v3.7 would swallow the workflow work.

## Why it keeps surfacing anyway

It is the hidden dependency under [[SEED-158]]. Two of that seed's three shapes — *"the AI
proposes placeholder edits and the human applies them"* and *"the AI authors the tokens"* — are
both **document editing**. If [[SEED-158]] is picked up without this, someone will build a
private, single-purpose docx mutator inside the template path, and that is the *"one home per
concern"* red line this project already holds.

## Scope, when it comes

The operator said **"not only docx"** and that word is load-bearing:

- the KB already ingests `.pdf`, `.docx`, `.md`, `.pptx`, `.xlsx`, images
- the sandbox image already carries `python-docx`, `openpyxl`, `python-pptx`, `reportlab`,
  `pypdf`, `docxtpl` (`docs/SANDBOX-PACKAGES.md`) — so the *mechanical* ability to write most of
  these formats is already installed and in the trusted-path render engine
- what does not exist is the **surface**: a viewer/editor, a diff, an approval step, and an
  answer to "which version is the truth" once a document can be changed in two places

## The questions that need answering before it can be scoped

1. Edit **which** documents — KB documents, templates, produced deliverables, or all three? These
   have different owners and different truth semantics.
2. **Round-trip fidelity**: styles, tables, headers, numbering, branding. An editor that silently
   degrades a client's format is worse than no editor. This is the same risk [[SEED-158]] names.
3. **Versioning**: does editing a KB document re-embed it? (It must — otherwise retrieval serves
   the old text.) Does editing a bound template supersede it? (See [[SEED-160]].)
4. **Who edits** — the human, the AI, or the AI-with-approval? The project's standing rule is that
   the AI never silently changes a document a human approved.
5. Is this a **first-party build or an embedded editor**? Not obviously ours to write.

⚠ **Do not let this seed be satisfied by a narrow "add placeholders to a docx" feature.** That
would deliver [[SEED-158]] option 3 and leave the general capability unbuilt while marking it
done — the exact shape of the AUTH-03 mistake recorded in `REQUIREMENTS.md` (a requirement naming
a solution instead of a goal, then built to literally).

Related: [[SEED-158]], [[SEED-160]].
