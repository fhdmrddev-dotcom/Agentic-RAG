---
sketch: 018
name: requirement-first-authoring
question: >
  You describe a business requirement and the AI drafts the whole workflow AND
  sets a strictness dial — how does it confirm its grey-area guesses (ambiguous
  folder ref, vague scope, unmapped template placeholder) instead of silently
  inventing them?
winner: "A"
tags: [phase-103, net-new, authoring, grey-area-confirm, strictness-dial, no-silent-substitution, citation-policy, llm-emit, template-fill]
---

# Sketch 018 — Requirement-First Authoring

## The operator-decided calm shape

**The first screen is JUST the describe box.** You type a *business requirement* in
plain terms (not a phase list). Grounding, the strictness dial, inputs, and the
grey-area confirms appear **only after the first draft** — the very first screen reads
in 3 seconds. The AI drafts the **whole** workflow in one shot, sets a strictness dial
proportional to the stakes, and then **the draft itself reveals what grounding it still
needs.** The load-bearing moment: when the AI has to **guess** on a grey area — an
ambiguous folder ref, a vague scope, an unmapped template placeholder — it drafts, then
**ASKS**, instead of silently inventing it. Silent substitution is the exact failure
this surface is designed against (it caused the spike's MIXED verdict — it swapped a
non-existent "Acme folder" for a real one and presented it as settled fact). The
grey-area confirm loop is the centerpiece; grounding is a **refinement, not a precondition.**

## Design Question

Given describe-first authoring with one-shot draft + an AI-set strictness dial, what is
the calm shape for the **residual grey-area confirm loop** — how does the draft surface
its own grounding gaps (the template it needs, the folder it inferred, the guesses it
made) and confirm them without ever silently binding?

## How to View

Open `index.html` in a browser (links `../themes/default.css`). Use the **sketch
toolbar** (bottom-right of the viewport, top-right here since it's pinned) to cycle
the 5 states: **Empty → Composing → Draft + grey areas → Confirming → Cleared**.

- **Empty (the first screen)** is a single calm column — ONLY the required
  `business_requirement` describe box (large, prominent) + one one-line hint. No
  grounding chips, no dial, no inputs, no phase list. Type in the box and the Draft
  button enables (the required-field affordance lives on the box itself — publish 400s
  without a requirement).
- **Composing** is a single "Composing your workflow…" working state — the draft
  appears WHOLE, not drawn phase-by-phase (one-shot, proven in spike-097).
- **Draft** is where everything else appears: the whole draft renders on the right,
  and the post-draft refine surface comes alive — the **project-folder rail** ("I
  inferred a project folder — confirm it"), the per-phase grounding reveals (the
  `llm_emit` phase shows "needs a template to fill → attach"; the searching phase shows
  the folder it INFERRED with "confirm folder"), the **collapsed strictness dial**
  (`⚙ Strict · N gates + judge · adjust ▾`), and the residual grey-area confirms in the
  variant's shape.

Use the **variant tabs** (top) to switch A/B/C. Everything is interactive: click the
**confirm-folder** affordance on the searching phase or the **needs-a-template** affordance
on the emit phase; expand the dial's **Advanced** to see the two composed controls (gate
menu + the 4-stop `citation_policy` segmented control); **Confirm / correct** each
grey-area guess — the header bind-badge and draft chips update live. Attaching a template
opens the **fill-contract inspection** popover — cycle its flag-state picker
(clean / malformed / word run-split / no-placeholders / wrong-format) to feel each parser
outcome; the **📁 project folder** chip opens the searchable folder-tree picker.

## Progressive disclosure / calm rules (applied throughout)

- **LEFT side = a LIGHT conversation only** (a few lines: your requirement → the AI's
  draft note → a re-draft composer), never a control panel. The EMPTY screen has no left
  rail at all — the describe box is the whole screen.
- **RIGHT side = the artifact** (the phases) **+ on-demand controls** — the dial collapsed
  to one line, the fill-contract in a popover, the folder picker in a popover.
- **Comprehensiveness in DEPTH** (one tap away), not BREADTH. Every panel that isn't needed
  right-now is collapsed / popover / post-draft.
- **Template-present ⇒ fill mode; template-absent ⇒ analysis / prose mode** (tied to the dial).

## Variants

All three share the calm describe-first EMPTY screen, the same post-draft **project-folder
rail** + **per-phase grounding reveals**, and the same **fill-contract inspection** popover;
they differ only in how the residual-guess confirm loop is shaped.

- **A — describe-then-confirm ★** — the full draft + collapsed dial appear, then a single
  batched "Confirm the N guesses the draft flagged" panel sits above the provisional draft;
  the user clears every residual guess in one place before the draft binds.
- **B — inline checkpoint cards** — the AI surfaces one "I read X as Y — confirm or
  correct?" card at a time in the talk stream, with a checkpoint-progress pip row;
  resolved guesses collapse to a one-line receipt, the next opens. (No talk rail, so the
  grounding choices show as a compact **"grounding the draft revealed"** receipt that
  re-opens the fill-contract / folder picker.)
- **C — confirm-chips on draft** — the finished draft renders immediately, but each
  guessed field (and each phase that still needs grounding) wears an amber confirm chip
  with a popover until the user clears it; a draft-confirmation meter tracks "n of N
  grounded → bound" (the grey-area guesses + the template + the project folder all count).

### Grounding surfaced BY the draft (post-draft only) + fill-contract inspection — NET-NEW

The key reframe: the AI drafted from the **requirement alone**, so the DRAFT reveals what
grounding it still needs. None of this exists on the first screen.

- **Project-folder rail** — the AI INFERRED a project folder from the requirement and surfaces
  it for confirmation ("I inferred a project folder — confirm it"); it never silently binds one.
  This is the workflow-level `project_folder_id` (the workflow's home KB), made legibly distinct
  from per-phase `folder_scope` (which the AI *infers per searching phase* and you confirm in the
  grey-area loop). The copy spells out the two levels: **you SET / confirm** the project folder;
  the AI only **guesses** the per-phase narrowing. It binds as a single UUID, never a path; the
  picker pre-selects the inferred folder so confirming is one click.
- **Per-phase grounding reveals** — the `llm_emit` deliverable phase shows a "needs a template to
  fill → attach" affordance (template-absent ⇒ analysis/prose mode; attach ⇒ fill mode). The
  searching `llm_agent` phase shows the folder it INFERRED with a "confirm folder" affordance that
  opens the grey-area confirm popover. The AI never silently assumed a template or a folder.
- **Template fill-contract inspection** (a POPOVER off the template affordance, not a permanent
  panel) — listing the parsed placeholders, framed as parsed via the **real extractor**
  (`DocxTemplate.get_undeclared_template_variables()` / `parse_docx_template_variables()`, stdlib
  zip + regex). A flag-state picker demonstrates all five states the parser can return:
  **(a) CLEAN** (5 placeholders — simple fields `{{vendor_name}}`, a loop/table block
  `{%tr for r in risks%}`, 4 mappable from KB, 1 unmapped); **(b) MALFORMED** tag (unclosed `{{` →
  rejected, exact bad tag shown, no auto-repair); **(c) WORD RUN-SPLIT** (a placeholder Word
  fragmented across XML runs → "retype it in one pass", named as a known silent-miss failure mode);
  **(d) NO placeholders** ("this is not a fillable template; did you mean analysis mode?");
  **(e) WRONG format** (only `.docx`/`.pptx`/`.xlsx`). The 1 unmapped placeholder
  (`{{committee_sign_off_date}}`) flows into the grey-area confirm loop (route / leave
  blank / make it a run-time input) — never silently filled.
- **Two-layer guarantee** copy: upload-time inspection is **layer 1** (catch malformed / empty /
  run-split early); the run-time `output_file_valid` integrity gate is **layer 2** (re-opens the
  produced file on every run, and at the publish-time golden run for real against your KB; residual
  unfilled tags fail closed) — so an unfillable template can never publish.

## What to Look For

- **The first screen reads in 3 seconds.** EMPTY is just the describe box + one hint
  ("you describe the goal — the AI drafts the phases, sets the strictness, and asks about
  anything it had to guess"). No grounding, no dial, no inputs, no phases. The required
  `business_requirement` affordance lives on the box itself (publish 400s without it).
- **Grounding is surfaced BY the draft (post-draft only).** Nothing collects grounding up
  front. After the one-shot draft renders, the draft reveals its own gaps: the project-folder
  rail asks you to confirm the folder it INFERRED, the `llm_emit` phase shows "needs a template
  to fill → attach", the searching phase shows the folder it INFERRED with "confirm folder".
  Grounding is a **refinement, not a precondition** — "I drafted from your requirement alone."
- **Two-level folder distinction.** The author **SETS/confirms** the project folder
  (`project_folder_id`, the workflow's home KB — binds as a single UUID); the AI only **GUESSES**
  the per-phase narrowing (`folder_scope`, a bound list of folder ids) and surfaces that guess on
  the searching phase. The rail copy + picker keep them distinct.
- **Fill-contract is a POPOVER, not a panel.** Attaching a template opens a popover off the
  template affordance; the flag-state picker cycles CLEAN / MALFORMED / WORD RUN-SPLIT /
  NO-PLACEHOLDERS / WRONG-FORMAT, each framed as parsed via the real extractor
  (`DocxTemplate.get_undeclared_template_variables()` / `parse_docx_template_variables()`).
- **Two-layer fill guarantee.** A small honest note states upload-time inspection is **layer 1**
  (catch malformed / empty / run-split tags early) and the run-time `output_file_valid` gate is
  **layer 2** (re-opens the produced file at the publish golden run; residual unfilled tags fail
  closed) — so an unfillable template can never publish.
- **No silent substitution.** Every guess is shown as a guess: "You said *‘…’* →
  I'll bind **folder_scope: [`<bound id>`]**" with alternatives + a Confirm button. The draft
  stays **provisional** (header reads "⚠ N items await you") and `Continue to publish` is
  disabled until every guess is cleared AND the grounding is provided.
- **At least 2 grey areas per variant:** the **ambiguous folder ref** (prime trigger
  — "the latest vendor assessments" → AI found "Vendors — 2025 Assessments",
  must confirm vs the 2024 archive / a procurement folder / the whole project folder) **and** an
  **unmapped template placeholder** (`{{committee_sign_off_date}}` the AI can't source).
- **The strictness dial appears COLLAPSED** to one line (`⚙ Strict · N gates + judge · adjust ▾`)
  while guesses/grounding are open; Advanced (gate menu + 4-stop `citation_policy` control) is
  hidden until clicked. Comprehensiveness in depth, not breadth.
- **One-shot generation honesty.** "Composing your workflow…" is a single working
  state; the draft appears **whole** (no phase-by-phase token narration). The
  auto-repair "caught an invalid field, regenerating…" micro-state is labelled as
  *designed-for resilience that never fired in the live spike*.
- **Real strictness vocabulary only.** Presets **Strict / Middle / Loose** map to the
  real enum `citation_policy strict|flag|partial|draft`; Advanced reveals the gate
  menu (`citations_required` / `output_file_valid` / `freshness` / `structure_check` /
  `llm_judge_rubric`) with the publish judge shown as an **always-on** gate the dial can't
  switch off, and the 4-stop `citation_policy` control with plain-language captions. No invented
  labels (no "level 1/2/3", no "compliance mode"). `integrity_policy` is greyed
  "coming with the Phase 106 emitters".
- **`llm_emit` as the deliverable terminus.** The example workflow uses 4 of the 6 real phase
  types (`llm_agent` → `llm_batch_agents` → `llm_human_input` → `llm_emit`), ending in the
  visually-distinct `llm_emit` terminus carrying the `emitter: render_template` + citation badge.
  (Showing all six types is 019's read-only-graph job; 018 demonstrates a faithful subset.)
- **Domain-agnostic content** — vendor-risk is example *content*, the surface is a
  domain-neutral instrument; folder_scope resolves to a real folder NAME + bound id.
- **NET-NEW honesty.** The fill-contract popover and the project-folder picker are flagged
  NET-NEW — there is no backend draft-CRUD and no upload-validate endpoint yet; the fill-contract
  popover names the real parser it *would* call. `integrity_policy` stays greyed "coming with Phase
  106". One-shot generation (draft appears whole) and `llm_emit` as the deliverable terminus are
  preserved.

## Decision — winner: A ★ (locked)

The A/B/C pick (the **grey-area residual-confirm shape**) is **locked to A — describe-then-confirm**:
a single batched "Confirm the N guesses the draft flagged" panel sits above the provisional draft,
and the user clears every residual guess in one place before the draft binds. B (inline checkpoint
cards in the talk stream) and C (confirm-chips on the rendered draft) remain present + navigable as
documented alternatives, but A is the selected shape (the ★ Selected marker rides tab A). The
describe-first calm shape, post-draft grounding reveal, fill-contract popover + two-layer guarantee,
and progressive-disclosure principle are **shared across all three** — only the residual-confirm
shaping differed, and A won.

## Polish pass (winner-lock session)

Three additive refinements landed on top of the locked winner, all preserving the describe-first calm
structure, the A/B/C variants, the 5-state cycler, and the toolbar JS:

- **Template-upload discoverability (the operator asked twice where to upload).** On the `llm_emit`
  deliverable phase the attach affordance is now a **prominent, clearly-labeled button** —
  "⬆ Attach the .docx / .pptx / .xlsx this fills" (violet, pulsing, with a lead line "To fill a document
  this phase needs a template:") — not a faint chip. A **one-time dismissible contextual banner** appears
  *with the draft* ("Your deliverable needs a template — attach it on the fill step ↓", ✕ to dismiss,
  non-blocking, **never on the empty screen**) and points down at the fill step. Clicking attach still
  opens the **fill-contract popover** (placeholders + flag states). NET-NEW — there is no upload-validate
  endpoint yet; only `.docx`/`.pptx`/`.xlsx`.
- **Tiered guidance layer (match surface to stakes; the calm screen stays calm).** Small **ⓘ info
  affordances** open a **non-blocking popover** on hover/tap for key terms — **Project folder**
  (`project_folder_id` you confirm vs the per-phase `folder_scope` the AI infers), **Strict /
  citation_policy** (the real `strict|flag|partial|draft` enum, no invented labels), and **the always-on
  judge** (the publish-gauntlet judge the dial can't switch off). Default state is **hidden behind the ⓘ**.
  Contextual nudges stay dismissible + relevance-gated (the run-split / unmapped flags live in the
  fill-contract popover; the template-attach banner above). **First-time teaching for the EMPTY screen adds
  NO space-occupying banner** — instead an "ⓘ how this works" affordance sits *next to the existing one-line
  hint* and opens a small popover ("describe the goal — the AI drafts the phases, sets strictness, and asks
  about anything it had to guess"). The empty screen's 3-second read stays intact: just the describe box +
  one hint line.
- **No modal windows added.** Modals are reserved for must-decide moments only — none required in 018
  (the publish block lives in sketch 020).
