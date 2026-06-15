---
sketch: 013
name: workflow-builder
question: "How do you build a workflow by describing it — AI drafts a read-mostly live diagram, you refine by talking, then publish (locked + versioned)?"
winner: "A"
tags: [builder, nl-authoring, v2.9, design-ahead, hitl, seed-051, phase-094]
---

# Sketch 013: Workflow Builder (NL authoring vision)

> **DESIGN NOW, BUILD v2.9.** This is the "Build a workflow" card from 012 brought to life. It's the
> SEED-051 vision — spike-first next milestone — sketched now so the Workflows page is coherent.

## Design Question
You **describe** a recurring task (and upload a template); a strong model, grounded in your KB +
tool registry + the template, **proposes the whole workflow** — inputs, phases, tools, KB scope. You
**refine by talking** (not wiring), it's **lint-checked**, and **published as a locked, versioned**
workflow. The operator's hard constraint: a **read-mostly diagram that updates live** as the AI
proposes phases — **NOT a drag-canvas** ("the squeezed dead middle"). Editing = talk + form-tweak +
approve.

## How to View
open .planning/sketches/013-workflow-builder/index.html

**Stage cycler** (top-right): `1 Describe → 2 Drafting → 3 Refine → 4 Published`. Variants = layout.

## Variants (layout)
- **A: Talk-led ★** — conversation rail on the left (primary), the live phase-card diagram on the
  right (the artifact). Best matches "you build by *talking*; the AI draws." Most natural for the
  HITL "AI heavy-lifts, you approve" model.
- **B: Diagram-hero** — diagram center (hero), talk as a bottom bar, inspector on the right. More
  "editing a doc with an AI helper"; talk feels secondary.
- **C: Three-pane** — talk + diagram + inspector all visible. Most powerful, but densest — risks the
  over-engineering the operator explicitly warned against for this vision.

## What to Look For
- **Read-mostly, not drag:** phase cards stream in as the AI proposes them (Drafting stage); you
  approve / tweak / replace per card or just talk — there's no connect-the-dots gesture anywhere.
- **Real building blocks only:** every phase is one of the 5 real types (`llm_agent`, `llm_single`,
  `llm_human_input`, `programmatic`, `llm_batch_agents`) with a tool whitelist + optional gate +
  KB-folder scope. No invented node types.
- **Inferred inputs + grounding:** the AI-derived inputs (topic, template) + KB folder scope, shown
  for review/edit, locked on publish (SEED-051's "dynamic at design time, fixed at run time").
- **Lint + publish→lock→version:** lint-clean badge (reachable/terminal/inputs-satisfied);
  Publish freezes an immutable v1 (mirrors migration 056); edits fork a v2 draft, never mutate v1.
- **Hand-off, not execution:** the builder authors the *definition*; you still **Run** it from the
  Workflows page (012), which streams in a thread (008-D/009-C/011-A).

## Refinements (operator, 2026-06-04)
- **Per-phase, optional KB scope — production picker (researched 2026-06-04).** A click-to-cycle
  chip is an anti-pattern at scale, so each searching phase shows a `📁 scope: … ▾` chip that opens a
  **searchable folder picker** (ARIA combobox + tree popup): a search box over a browsable folder
  **tree** with **checkboxes (multi-select)**, **"Whole knowledge base"** as the checked default, and
  **breadcrumb paths** when searching (so 3 different "NDAs" folders are disambiguated). Demo data =
  ~109 nested folders. Grounded in our real model: folders are a `parent_id` tree and
  `search_documents` already takes `folder_ids[]` + auto-expands subtrees → **multi-select needs zero
  backend change** (checking a folder = that folder + its subtree, which the backend already does).
  Default empty = whole KB (optional). Build path: add `folder_ids: list[str]` to the phase config
  JSONB (no migration). Non-searching phases show no scope control.
- **Template/asset upload location.** The inputs strip now splits **Inputs** (run-time, collected each
  run) from **Assets** (authoring-time uploads, *owned by the workflow*) with an explicit
  **⬆ Upload template / form** button — answering "where do I upload the template?". Assets are
  Storage-backed workflow assets (SEED-051), attached here at authoring, used at run time.
- **Where final artifacts download → SEE [[SEED-038]]** (artifacts unification, updated for the
  workflow dimension): the panel FILES section is the single home; backend gap (093 finding #4) =
  workflow `execute_code` files aren't threaded up yet.

## Recommendation
**A (talk-led).** It best expresses "steered by talking, not wiring" and keeps the surface calm
(the operator's "without over-complicating"). C's inspector is valuable but should be a click-to-open
drawer, not a permanent third pane. This is a v2.9 build — the spike (SEED-051 companion todo)
validates NL→draft + KB-grounded template-fill before we commit the `inputs`/`assets` schema.
