---
id: SEED-051
title: Generalized NL→Workflow authoring — describe-it + upload-assets → AI-derived inputs/phases/tools, KB-grounded, human-refined, lint-safe, locked-on-publish
status: planted
planted: 2026-06-03
planted_by: orchestrator (/gsd:explore session with operator — "create workflows naturally by describing to the AI; how it differs from skills")
trigger_when: v2.9 milestone kickoff (/gsd:new-milestone), OR D-092-AUTHOR Authoring Phase B (NL-to-draft) / Phase C (guided form editor), OR any phase that touches WorkflowDefinition input/asset shape, OR **Phase 094 (Workflow Legibility + Mode Clarity) discuss/sketch** — the "Authoring surface & builder UX" section below carries a 094-relevant subset (composer simplification, Deep-not-a-toggle/mode-clarity, and the workflows-as-a-page-vs-launch-from-panel refinement to D-092-UX) that this CURRENT-milestone phase needs, not just v2.9
priority: high
tags: [harness, workflows, authoring, nl-generate, templates, dynamic-inputs, rag, kb-grounding, plugin-contract, v2.9, D-092-AUTHOR, SEED-050]
---

# SEED-051: Generalized NL→Workflow Authoring

## Context (how it surfaced)

In a `/gsd:explore` session (2026-06-03), the operator asked how the 4 seed workflows are
architected, how it was decided which tools to equip each, and how workflows will be **created
naturally by describing them to the AI** in future — and how that differs from **skills**. A
12-agent grounding investigation (workflow `wf_7faac1cf-4fa`: 6 codebase mappers + 5 field
researchers + synthesis) confirmed the operator's instinct is **~80% already the plan**
(D-092-AUTHOR) and sharpened it in three concrete ways. This seed captures the **generalized**
vision so it's waiting at v2.9 kickoff. The operator's explicit guardrail: *"this is an EXAMPLE
case not the only case — generalize the idea, don't build the whole architecture on one
specific example."*

## The vision (generalized — not legal-specific)

> You **describe a recurring task in plain English** and optionally **upload the assets it
> revolves around** (a template, a form, reference docs). A **strong model — grounded in your KB
> folder structure, your available tools/skills, and those uploaded assets — proposes the whole
> workflow**: the input fields it needs, the phase sequence, the tools per phase, which KB folder
> each step pulls from, and the fill/output steps. **You refine it with the AI (human in the
> loop)** until the shape is right, it's **lint-checked so it can't be structurally broken**, and
> it's **published as a locked, repeatable workflow**. At run time it collects the inputs (which
> can themselves be auto-pulled from the KB), runs the locked steps grounded in the right scope,
> fills your uploaded asset, pauses for human review, and produces the final artifact.

Generalizes to any **"fill-and-reason-over-a-template-from-known-data"** knowledge task:
contracts, RFP responses, onboarding packets, financial memos, incident reports, compliance
filings, etc. This is the "durable automation engine replacing manual knowledge work" framing
(see [[feedback_business_value_framing]]).

## Three architectural sharpenings the operator added

1. **Templates are uploadable assets *owned by the workflow*** — not hardcoded. A workflow
   carries its template(s)/form(s) as attached files; steps fill them with KB-grounded data.
   NEW concept: a `WorkflowDefinition` can reference attached assets (Storage-backed).
2. **Inputs are *AI-derived, not hand-defined*** — the generator infers the input fields from the
   description + the uploaded template, the human refines them, **then they lock on publish**.
   The key nuance: **dynamic at design time, fixed at run time** — which IS the operator's
   "same steps" definition of consistency (chosen in-session over "same output" / "reliable
   quality"). The cleverness is spent once, at authoring; every run is deterministic in shape.
   NEW concept: an `inputs` schema field on `WorkflowDefinition` (generated, not hand-written).
3. **Two distinct grounding moments** (where the operator's "DB-schema + RAG injection for
   consistency" idea actually belongs — conflating them is the usual mistake):
   - **Authoring-time grounding** — the *generator's* prompt is fed the KB folder tree + the
     tool/skill registry + the uploaded template, so it proposes correct fields/tools/scoping.
   - **Run-time grounding** — each phase pulls fresh KB data (scoped to the right folder) to
     fill the template. (Partly already shipped via per-phase `search_documents` + F7 grounding.)

Plus a fourth, *per-phase KB folder scoping* (pin a phase to a folder so it always pulls from the
right place) — the reliability-from-grounding lever; search is whole-KB today.

## What already exists to build on (do NOT re-derive)

- `backend/app/models/harness.py` — `WorkflowDefinition` + the 5-type discriminated-union
  `PhaseConfig` with `extra="forbid"`. **This strict model IS the response schema** for
  NL-generation (safe-by-construction: the model literally cannot emit unknown fields).
- `backend/app/services/harness/reachability.py` — `lint_workflow` (orphans, unsatisfiable
  skips, `INPUT_UNSATISFIED`). Kills structurally-broken graphs at publish.
- Migration `056` immutable-on-publish trigger + `UNIQUE(slug, version)` + RLS (users draft
  `is_global=false`; only seed/operator publishes global) — the versioning + authz substrate.
- Sandbox ships `python-docx` + `reportlab` + `openpyxl` + `python-pptx` → **template/document
  generation is already possible today via an `execute_code` phase.**
- `llm_human_input` phase type → the "refine / review before send" gate, already first-class.
- v2.7 workspace filesystem → holds the produced artifact.
- **D-092-AUTHOR** (the locked decision this extends): NL-describe → strict-parse → edit-as-form
  → lint-on-publish; NOT a visual drag-canvas ("the squeezed dead middle"). Phase A (authoring
  API onto existing validator/lint, late-v2.8) → B (NL-to-draft, v2.9, structured-output layer,
  always a draft) → C (guided form editor — the discriminated union *is* the form schema, G-2
  sketch-first) → D (read-mostly DAG, optional). This seed = the **generalized + asset-driven +
  AI-derived-inputs** elaboration of B/C.

## Authoring surface & builder UX (operator refinement, 2026-06-03 session 2)

> **⚠ PHASE 094 (next phase, CURRENT milestone) needs a subset of this NOW.** The bullets below
> on composer simplification, Deep-not-a-toggle / mode clarity, and **workflows-as-a-page → launch
> from the page (NOT from the composer/panel)** REFINE the existing **D-092-UX** (which had
> workflow-start moving to the panel). Pull these into `/gsd:sketch 094` + `/gsd:discuss-phase
> 094`. NOTE the v2.8/v2.9 sequencing question they raise: the full Workflows *page* is v2.9
> authoring — so what does 094 do for launch in the interim (panel "Run workflow" per D-092-UX,
> or defer the launcher to v2.9)? Decide at 094 discuss. (Recorded in ROADMAP.md Phase 094
> "SKETCH/DISCUSS INPUTS" callout on 2026-06-03 once 093 closed — the earlier lost-update race
> with the concurrent 093 session is gone.)

- **Workflows = a first-class PAGE in the nav (like Skills), not a chat dropdown.** Nav →
  "Automation / Workflows" → library (your drafts + published + shared/seed) + "Build new" +
  Run/Edit. The operator: picking a workflow from a composer menu "is not user-friendly nor
  practical." This is the home authoring always needed (you can't build from a dropdown/panel).
- **Two surfaces, cleanly split — this RESOLVES the earlier page-vs-panel tension:**
  - **Library + builder = the page** (browse, build, edit, publish, launch).
  - **Execution = in a thread** (Run → opens/redirects to a normal chat-style thread, streams
    there; shares run SSE/lock/anchor). NO separate execution route. Operator is explicitly fine
    running in the existing thread UI "without any risk or architectural changes."
    **⚠ SUPERSEDED 2026-07-31 by RUNVIZ-03 — see the dated note at the end of this seed before
    treating this bullet as governing.**
  - Reconciliation with D-092-UX: that decision rejected a separate route for where a workflow
    *runs/lives* (must stay thread-bound) — it never rejected a library/builder PAGE. So this is
    the missing piece, NOT a conflict (D-092-AUTHOR Phase A/B/C authoring always implied a
    management surface; this names it).
- **Composer simplifies further than D-092-UX planned:** the workflow-picker dropdown AND the
  Deep/Harness pill leave the composer. You never "switch to Harness" — you Run a workflow from
  the page, which puts THAT thread into workflow mode; Deep is the resting default (Deep =
  `active_workflow_run_id IS NULL`, not a toggle — verified `threads.py:1146`). Composer can
  settle to `[Model ▾] [General/Explorer ▾]` with launch moved to the page.
- **Builder = AI heavy-lifts, human observes/approves/suggests (HITL).** Drafts never
  auto-publish; user role = observe + approve, optionally suggest changes — NOT manual-first.
- **Visualization = live, transparent, engaging — but VIEW, not drag-to-build.** The operator
  wants the workflow's shape visible as it's built ("transparent building process… clarity +
  simplification + engagement + innovation + transparency"), explicitly "without
  over-complicating or over-engineering." KEY distinction (preserves D-092-AUTHOR's rejection of
  the drag-canvas "squeezed dead middle"): a **read-mostly diagram that updates LIVE as the AI
  proposes phases** — phase cards in sequence; tools/folder-scope/template attaching to each;
  data-flow arrows; per-card approve / tweak(form) / add — steered by TALKING, not wiring. Editing
  stays describe + form-tweak + approve. **Cheap to build:** it renders the `WorkflowDefinition`
  + the reachability graph (`reachability.py` already computes nodes+edges) as it changes —
  reusing existing data, not new backend. This is a **/gsd:sketch** deliverable (G-2 fires).

## Recommended approach: SPIKE-FIRST (operator-agreed)

Do NOT pre-commit schema. The migration fear is low (the format is JSONB + a Pydantic model;
adding **optional** `inputs`/`assets` fields does not break old published rows — immutability =
no-edit-published, not no-grow-format). The genuinely-new, unproven-here parts must be *seen*
working before designing the schema:
- can a model reliably **derive input fields** from a description + an uploaded template?
- does **KB-grounded template-fill** produce a clean `.docx`/`.pdf` reliably?
- what does **authoring-time grounding** (folder tree + tools fed to the generator) need?
- does the **describe → refine → publish** loop *feel* good with a human in the loop?

A throwaway spike on a real case answers all four cheaply, and its output **becomes** the v2.9
schema design (evidence-first). See the companion todo `spike-nl-workflow-authoring.md`.
Sequencing: **finish v2.8 first** (094 → 095 → 096); open v2.9 with this spike as the very first
move; then plan Authoring Phase B/C on the evidence. Do not fragment the current milestone.

## Relationship to skills (the operator's core question — keep this distinction crisp)

- **Skill** = optional, **model-pulled judgment** — reusable instructions/assets the model
  *chooses* to load when it judges them relevant (progressive disclosure). Adds method, not
  control. Non-deterministic activation.
- **Workflow** = author-locked **orchestration** — the same steps every run; the backend (not the
  LLM) owns the order. Adds control, not judgment. Deterministic activation.
- They compose; they don't compete. Skills work identically in Deep and Harness mode.
- **Open composition fork** (deferred, but design the seam): should a *phase* be able to inject a
  *skill* (a step whose system prompt = a loaded skill) for a consistent per-step quality bar?
  Industry best practice says yes. Captured in the research questions.

## Dependencies / cross-refs

- **SEED-050 (workflow result-quality)** — HARD dependency: a generated workflow can be
  structurally perfect (passes lint) and still produce garbage. NL-authoring MUST NOT ship
  without an output-quality gate. SEED-050 owns that gate; this seed consumes it at publish.
- **Plugin Contract (v2.9, deferred per D-v2.8-01)** — outbound "send / integrate with other
  apps" is a workflow phase that calls an integration tool. **Cross-link seam:** the Plugin
  Contract (`tool` / `data_source` / `secrets_adapter` extension types) and the workflow engine
  must meet at the "send" phase. Keep integrations in v2.9 as planned; note the seam now.
- **D-092-AUTHOR / D-092-UX** (`.planning/phases/092-.../092-WORKFLOW-UX-STRATEGY-BRIEF.md`).
- Companion: `.planning/notes/workflow-authoring-exploration-2026-06-03.md` (the worked
  example + reasoning) and `.planning/research/questions.md` (the open decisions).

## Re-open trigger (concrete)

Promote at **/gsd:new-milestone v2.9** (sweep open seeds), OR when **D-092-AUTHOR Phase B/C**
enters scope, OR whenever a phase proposes changing `WorkflowDefinition`'s input/asset shape.
First action when promoted: run the spike (companion todo), then design the `inputs` + `assets`
schema from what it teaches.

## SUPERSEDED IN PART (2026-07-31) — "Execution = in a thread … NO separate execution route"

**What is superseded:** the "Two surfaces, cleanly split" bullet above that reads *"Execution = in a
thread (Run → opens/redirects to a normal chat-style thread…). NO separate execution route."* That
position no longer governs. **Everything else in this seed stands** — the NL→workflow generation
vision, the three sharpenings, the skill-vs-workflow distinction, and "Library + builder = the page"
are all unchanged.

**What replaces it:** **RUNVIZ-03** (`.planning/REQUIREMENTS.md`, mapped to **Phase 188** in
`.planning/ROADMAP.md`, status **Pending** — nothing is built yet) — *a workflow run and its finished
deliverable have their own home: launching stops redirecting into Chat, a run is retrievable after the
fact, and the artefact is reachable from the run rather than only from a live panel.*

**Why (operator call, 2026-07-31, after Phase 185 UAT):** *"a workflow that is RUNNING, and its
output, should have their own place — not be dumped into chat."* The seed's original reasoning was
that thread-bound execution costs nothing architecturally; the operator now rejects the **product**
outcome, not the architecture.

**Verified in code today, not assumed:** `frontend/src/pages/WorkflowsPage.tsx` owns no run route — it
calls `onLaunch` = `ChatLayout.doRun` (`ChatLayout.tsx:233`, wired at `:596`), which creates a thread,
kicks off the server-side run, and redirects into Chat. The page docblock says so verbatim
(`WorkflowsPage.tsx:9-13`). So the shipped behaviour matches this seed exactly — which is the point:
it is what the operator asked to change.

**The distinction a future planner MUST keep:** the D-14 red line forbids a second **runtime**, not a
second **view**. The harness engine stays the ONLY executor and a run stays thread-backed
(`active_workflow_run_id`). RUNVIZ-03 changes *where the user stands* and *how a finished run and its
artefact are reached* — it does not fork execution. Reading this bullet as "execution belongs in chat"
would rebuild the thing the operator just rejected.

**Design evidence (NOT a commitment — its author says so explicitly):**
`.planning/sketches/145-the-review-moment/README.md` — a dedicated run surface with its own header and
its own spine, **no message list and no composer**; the sketch frames itself as *"evidence for Phase
188 … not a commitment inside Phase 185."*

**Sibling note:** SEED-038's D-094-UNIFY ("workflow artefacts live in the chat-thread panel FILES
section, NOT a separate place") is re-opened for the workflow-run case by the same call — see the
dated note at the end of that seed.
