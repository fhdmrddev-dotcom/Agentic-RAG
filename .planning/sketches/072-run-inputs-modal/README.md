---
sketch: 072
name: run-inputs-modal
question: >-
  How do a file-upload run-input (WFIN-01) and an EDITABLE KB-folder scope
  control (WFIN-02) fold into the existing calm 560px Run modal without breaking
  the 3-second read — and what SHAPE is the scope control (SEED-112: Perplexity
  3-way toggle vs inline dropdown vs picker)?
winner: "A"
tags: [phase-152, wfin-01, wfin-02, run-modal, run-inputs, template-upload, kb-scope, seed-112, scope-shape, provenance, net-new-wire, three-homes]
---

# Sketch 072 — Run-Inputs Modal

> **Extends the LIVE `RunModal`** (`frontend/src/pages/WorkflowsPage.tsx:719`), not a
> greenfield surface. Today that modal shows a **read-only** "Knowledge base: 📁 {folder}"
> chip (D-103-1) + a kickoff textarea + an `input_keys` hint. Phase 152 turns it into a
> real **run-input channel** wired to `create_workflow_run.inputs`. This sketch answers
> the two net-new controls and the SEED-112 scope-shape question.

## Design Question

The Run modal is where a workflow launch becomes a real, parameterized run. Two net-new
inputs land here — a **template file** (WFIN-01) and an **editable retrieval scope**
(WFIN-02) — and both must fit the app's "calm instrument / 3-second-read-at-rest" bar
without turning a one-glance dialog into a form. The genuinely-undecided call is the
**scope control's shape** (SEED-112, Glean/Beam-informed, Perplexity 3-way toggle ref):
inline dropdown vs a segmented toggle vs a picker.

Concrete run content (continuing sketch 022's vendor-risk example): launch **Vendor-risk
portfolio review v4**, upload a `committee-brief-template.docx`, point retrieval at
`📁 Procurement KB` (the workflow's author-time default) or override it per-run, and
kick off with "Score the Q3 vendors and draft the committee brief."

## How to View

open .planning/sketches/072-run-inputs-modal/index.html

## Variants

- **A: Inline-grows** *(path of least resistance)* — keep the 560px dialog verbatim; the
  read-only chip becomes an **inline `<select>`** (mirrors chat's "All documents / folder"
  selector), the upload is a **quiet `TemplateUpload`-style button**. Smallest diff, lowest
  risk, closest to what ships today. The author default is tagged "workflow default".
- **B: 3-way scope toggle + dropzone** — the scope becomes a **segmented toggle**
  `[ All documents | 📁 Procurement KB (default) | Pick a folder… ]` (the Perplexity /
  SEED-112 reference; "Pick…" reveals a folder dropdown), and the upload is a real
  **drag-and-drop dropzone**. More expressive and legible; more vertical weight.
- **C: Two-step / panel** — a **2-step wizard** (Inputs → Confirm receipt) so the resting
  screen is never crowded, plus a toggle to preview the same inputs **docked in the
  right-side workspace panel** (the app's established push/split pattern) instead of a modal.

## What to Look For

- **3-second read:** which variant still reads in one glance once two new controls are added?
  A is calmest; B is most legible; C hides depth behind a step.
- **Scope shape (the SEED-112 decision):** does the segmented toggle (B/C) make "whole KB vs
  bound folder vs override" clearer than a plain dropdown (A)? This choice locks the phase.
- **Author-default honesty:** every variant marks the workflow's bound folder as the *default*
  and the per-run choice as an *override* — server-enforced (Phase-098), the model can't widen it.
- **Provenance cue (WFIN-01 threat model):** the "stored untrusted — never run as code / never
  fed to the fill engine" note. Is it reassuring or noisy? Right weight?
- **Upload states:** click upload to see validating → validated file card (`kind=template_input`,
  ✓, remove). Toolbar **"✕ bad file"** simulates a rejected file (422 → inline error).
- **NET-NEW flags:** violet flags mark the run-input channel as net-new wire (app honesty convention).
- **Mobile:** toolbar 📱 constrains the modal — does the dropzone (B) / two-step (C) hold at 375px?

## Honesty — REAL-NOW vs NET-NEW

| Element | Status | Note |
|---|---|---|
| The modal frame, kickoff box, `input_keys` hint, read-only folder chip | **REAL today** | `RunModal` in `WorkflowsPage.tsx:719` |
| Editable scope control (dropdown/toggle) | **NET-NEW** | WFIN-02 — makes the chip a per-run override over the Phase-098 resolver |
| Template file upload as a run input | **NET-NEW** | WFIN-01 — reuses Phase-100 `upload_template` (`kind='template_input'`) but at launch, into `create_workflow_run.inputs` |
| `template_input` provenance / never-to-Jinja | **REAL boundary** | Phase-100/151 threat model; shown as an honest note, not a new claim |
