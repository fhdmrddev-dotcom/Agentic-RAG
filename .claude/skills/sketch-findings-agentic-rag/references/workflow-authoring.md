# Workflow Authoring — Requirement-First Describe → Draft → Refine (v2.9, built)

> **This reference SUPERSEDES the design-ahead `workflow-builder.md` (sketch 013).** 013 was the
> *talk-led* vision (a conversation rail steers a streaming diagram). The operator pivoted to a
> **form-led** shape and then locked it across two sketches: **018 (winner A)** for describe-first
> authoring + the no-silent-substitution grey-area confirm, and **019 (winner D)** for the read-only
> phase-spine graph + per-node form in a fixed right-side panel. Where 013 and this file disagree,
> **this file wins.** 013 survives only as historical context (the inputs/assets strip and the KB
> scope-picker combobox concepts carried forward; the "talk-led as primary" layout did not).

You **author a workflow by describing a business requirement** — not by assembling phases, not by
wiring nodes. The very first screen is **just a describe box**. You type a *business requirement* in
plain terms; the AI drafts the **whole** `WorkflowDefinition` in one shot and **sets a strictness
dial** proportional to the stakes you described. Everything else — grounding (the template + the
project folder), the strictness dial, and the grey-area confirms — appears **POST-DRAFT, revealed by
the draft itself**. Grounding is a *refinement, not a precondition* ("I drafted from your requirement
alone"). You then refine the draft **by FORM** (talk available for big moves) against a **read-only
vertical phase-spine graph**, each node's `phase_type`-conditioned form opening in a **fixed-width
push/split right-side panel**. The single load-bearing guarantee: when the AI had to **guess** on a
grey area, it **drafts then ASKS** — it never silently substitutes.

---

## Design Decisions

### D1 — Describe-box-only first screen (018-A; MANIFEST D-11)

**The EMPTY screen is a single calm column: ONLY the required `business_requirement` describe box +
one hint line.** No grounding chips, no dial, no inputs, no phase list, no left rail. The describe-box
hero centers in the viewport (`.describe-first` flex-center, `.df-inner` `max-width:640px`) and reads
in **3 seconds** — the acceptance test. Won over collecting grounding/template/folder up front because
that is exactly the failure mode the operator rejected: forcing the user to set up scaffolding before
they've described what they want. The AI drafts from the requirement *alone*, so the draft reveals
what grounding it still needs.

Key visual properties (from the winning variant):
- Hero glyph 30px / title `var(--text-2xl)` Manrope 700 / centered `.df-lead`.
- The describe box `.df-input`: `var(--color-surface)` fill, `1px solid var(--color-border)`,
  `radius-lg`, `padding: var(--space-5)`, `font-size: var(--text-md)`, `line-height:1.6`,
  `resize:none`. Focus = `border-color: var(--color-primary-glow)` + `box-shadow: var(--shadow-glow-primary)`.
- **Required-field affordance lives on the box itself**: a mono `.df-req-label` with an amber
  `.req-star`, and `.df-input.req-empty { border-color: hsl(38 92% 60% / .5) }`. This mirrors the real
  invariant — **publish 400s without a `business_requirement`** (`workflows.py:136-139`).
- First-time teaching uses an inline **`ⓘ how this works`** affordance *next to* the hint, never a
  space-occupying banner (the empty screen stays at a 3-second read; MANIFEST D-13).

### D2 — One-shot composing, draft appears WHOLE (018-A)

"Composing your workflow…" is a **single working state** (`.composing-card`, a pulsing brand orb +
checklist steps), then the draft renders **whole** — never narrated phase-by-phase token-by-token.
This honors the spike fact: one-shot emission is proven (both spike drafts validated on attempt 1).
Do **not** promise a live per-phase drawing animation. The auto-repair "caught an invalid field,
regenerating…" micro-state (`.repair-flash`, amber spinner) is a designed-for-resilience state that
is honestly labeled **never fired in the live spike**.

### D3 — Grounding is surfaced BY the draft, POST-DRAFT only (018-A; MANIFEST D-11)

The core reframe. After the one-shot draft renders, the draft reveals its own gaps via three surfaces
that **do not exist on the first screen**:

1. **Project-folder rail** (`.ground-rail`) — the AI **inferred** a `project_folder_id` from the
   requirement and surfaces it for **confirmation** ("I inferred a project folder — confirm it"). It
   never silently binds one. Unconfirmed = amber `.gr-folder.unset`; confirmed = green
   `.gr-folder.set` with a `✓`. Binds as a **single UUID, never a path**; the picker pre-selects the
   inferred folder so confirming is one click.
2. **Per-phase grounding reveals** (`.p-reveal` pinned inside a draft phase card) — the `llm_emit`
   phase reveals "needs a template to fill → attach"; the searching `llm_agent` phase reveals the
   `folder_scope` it **inferred** with a "confirm folder" affordance.
3. The **two-level folder distinction** is spelled out everywhere: you **SET/confirm** the
   workflow-level `project_folder_id` (the home KB); the AI only **GUESSES** the per-phase
   `folder_scope` (which can only *narrow within* the project folder — `harness.py:241-253`) and
   surfaces that guess for you to confirm.

### D4 — The batched "review these assumptions" confirm — no silent substitution (018-A; the centerpiece)

The grey-area residual-confirm shape is **A — describe-then-confirm**: a single **batched panel**
(`.assume-panel`) titled "Confirm the N guesses the draft flagged" sits *above* the provisional draft;
the user clears **every** residual guess **in one place** before the draft binds. The draft header
reads `⚠ N items await you` (the `.bind-badge.blocked`) and **`Continue to publish` is disabled until
every guess is cleared AND the revealed grounding is provided** (`fullyGrounded()` = all greys cleared
AND template attached AND project folder confirmed).

Won over B (inline checkpoint cards one-at-a-time in a talk stream) and C (confirm-chips scattered on
the rendered draft) because A puts every unresolved decision in **one auditable place** the user
clears before binding — the cleanest "no surprises" contract. B and C remain documented navigable
alternatives.

Each grey card (`.grey-card`, the shared confirm vocabulary) shows:
- **An honest origin line** — `requirement`-derived greys use the **"You said '…'"** quote frame (a
  *verbatim* fragment of the user's text); `template`-derived greys use **"In your template I
  found …"** (the AI's parsed finding). **Never conflate the user's words with the AI's reading** —
  this is the no-silent-substitution rule at the copy level.
- **The bound read** — for a folder it leads with the **bound id as the primary token**
  (`I'll bind folder_scope: [fld_8c1a]`), with the human breadcrumb explicitly marked "only for you
  to read." `folder_scope` renders as a `list[UUID]` even with one element (`BRIEF §3.6`).
- **Alternatives** (`.grey-alt`) computed to stay **within the project folder** (a per-phase scope can
  only narrow inside `project_folder_id`).
- **Confirm / correct** buttons. Resolved cards collapse to a green `.grey-card.resolved` one-liner
  with a `change` re-open.
- At least **two grey areas per draft**: the **ambiguous folder ref** (prime trigger — "the latest
  vendor assessments" → AI found "Vendors — 2025 Assessments", must confirm vs the 2024 archive / a
  procurement folder / the whole project folder) **and** an **unmapped template placeholder**
  (`{{committee_sign_off_date}}` the AI can't source — routes to phase / blank / run-time input,
  never silently filled).

Visual: warning palette throughout — `border: 1px solid hsl(38 92% 60% / .5)`,
`background: var(--color-warning-dim)`; the batch bar carries an amber `.ab-count` pill; cleared state
flips the whole panel to the success palette (`hsl(142 71% 45% / .35)`).

### D5 — The strictness dial = REAL enums only, presets + advanced, collapsed while greys are open (018-A; MANIFEST D-12)

The dial is **two composed axes**, never a single invented slider: (1) **which per-phase gates run**,
and (2) the **`citation_policy`** value on the `llm_emit` deliverable. It is **AI-set** (flagged
`AI set this · net-new (spike-097)`) and appears **collapsed to one line** while grey areas are open —
`⚙ <Preset> · N per-phase gates + publish judge · citation_policy <enum> · adjust ▾` (`dialOrSummaryHTML`).
Comprehensiveness in depth, not breadth.

- **Presets** (`.preset` cards): **Strict / Middle / Loose**, each mapping to the real
  `citation_policy` enum (`citation_policy = strict|flag|partial|draft` printed on every card).
  - **Strict** 🔒 — all gates ON (`citations_required` deterministic + `output_file_valid` +
    `freshness` + `llm_judge_rubric`), `citation_policy=strict` (honest fail, deliverable NOT produced).
  - **Middle** ⚖️ — `citations_required` presence + `structure_check` + `llm_judge_rubric`,
    `citation_policy=flag` (deliver with ` [unverified]` marks + coverage summary).
  - **Loose** ✎ — judge-only / no per-phase gate, `citation_policy=draft` (prepend
    `DRAFT — citations not enforced`).
- **Advanced** (hidden until clicked) reveals the **two controls a preset composes**:
  1. The **gate menu** (`.gate-chip` toggles): `citations_required`, `output_file_valid`, `freshness`,
     `structure_check`, `llm_judge_rubric`. `freshness` shows its mandatory `max_age_days: 7` config
     chip when on, with the honest warning that without one it fails the run closed.
  2. The **4-stop `citation_policy` segmented control** (`.seg` with `strict|flag|partial|draft`) +
     plain-language caption per stop (`CIT_CAPTIONS`).
- **The publish judge is an always-on banner** (`.judge-banner`, violet) the dial **cannot switch
  off** — "even a loose draft with zero per-phase gates still faces it before it can publish"
  (lives in the publish flow, sketch 020 stage 4).
- **`integrity_policy` is greyed** "coming with the Phase 106 emitters (declared in the schema, not
  wired yet)" — `.policy-grey`.

**NO invented labels** — no "level 1/2/3", no "compliance mode", no "high/medium/low strictness".
Only the real enum words + plain-language captions.

### D6 — Template upload = post-draft, on the `llm_emit` phase, two-layer guarantee (018-A; MANIFEST D-14)

The template attach affordance is a **prominent, clearly-labeled button** on the `llm_emit` deliverable
phase — `.attach-tpl-btn` "⬆ Attach the .docx / .pptx / .xlsx this fills" (violet, **pulsing**, with a
lead line "To fill a document this phase needs a template:"). It is **not** a faint chip (the operator
asked twice where to upload). A **one-time dismissible contextual banner** (`.tpl-nudge`) appears *with
the draft* pointing down at the fill step — **never on the empty screen**, `✕` to dismiss,
non-blocking.

- **Template presence flips the mode**: template-absent ⇒ **analysis / prose mode**; attach ⇒ **fill
  mode**. Tied to the dial.
- Clicking attach opens the **fill-contract inspection popover** (`.fc-pop`, a POPOVER not a permanent
  panel), framed as parsed via the **real extractor** —
  `DocxTemplate.get_undeclared_template_variables()` / `parse_docx_template_variables()` (stdlib zip +
  regex). A flag-state picker (`.fc-flagpick`) demonstrates all **five** states the parser can return:
  **clean** (5 placeholders, 4 mappable, 1 unmapped — the unmapped one flows into the grey-area loop),
  **malformed tag** (unclosed `{{` → rejected, exact bad tag shown via `.fc-badtag`, no auto-repair),
  **word run-split** (a placeholder Word fragmented across XML runs → "retype it in one pass", a named
  silent-miss failure mode), **no placeholders** ("not a fillable template; did you mean analysis
  mode?"), **wrong format** (only `.docx`/`.pptx`/`.xlsx`).
- **Two-layer guarantee** copy (`.two-layer`, green): **layer 1** = upload-time inspection (the fill
  contract — catch malformed / empty / run-split early); **layer 2** = the run-time
  `output_file_valid` integrity gate (re-opens the produced file on every run AND at the publish golden
  run for real against your KB; residual unfilled tags **fail closed**). So an unfillable template can
  never publish. (PDF re-open is a v1 stub — real integrity → Phase 106.)

### D7 — Tiered guidance: ⓘ popovers / dismissible banners / modals reserved (018-A; MANIFEST D-13)

Match the surface to the stakes so the calm screen stays calm:
- **`ⓘ` info dots** (`.info-dot`, hidden behind the dot until hover/tap) carry passive explainers for
  key terms — **Project folder** (`project_folder_id` vs per-phase `folder_scope`), **Strict /
  citation_policy** (the real enum, no invented labels), **the always-on judge**. Non-blocking
  `.info-pop`.
- **Dismissible inline banners** (relevance-gated, **never on the empty screen**) carry contextual
  nudges (the template-attach nudge above).
- **Modal windows are reserved for must-decide moments only** (e.g., a publish block — sketch 020).
  None are used for passive teaching.

### D8 — Refine by FORM on a read-only VERTICAL phase-spine graph (019-D; MANIFEST D-15)

The refine surface is a **read-only vertical phase-spine graph** with each node's form opening in a
**fixed-width right-side push/split inspector panel** — *not* an inline-expand under the node (that
was variant A, which D beat), and emphatically **not a drag-canvas**.

- **The graph** (left, `.spine-wrap` / `.spine-inner` `max-width:680px`): one node per `PhaseSpec`
  ordered by `phase_index`. **Solid edges = run order `i→i+1`** (the `::before` gutter line);
  **the only non-linear edge = a dashed `on fail → skip_to_phase` branch** parsed from a validator's
  `on_failure` (`.spine-skiprail`, amber dashed, geometry-measured post-render so it lands *on* the
  target node's bullet, with a `⤳` glyph). An explicit legend (`graphCap()`):
  *"READ-ONLY GRAPH · ordered by phase_index · run order (i→i+1) · on-fail branch (skip_to_phase) · no
  depends_on · no parallel lanes · inspect, don't drag."*
- **No build affordances**: no `+` add-node, no connection handles, no drag anywhere, a `View only`
  badge in the header. (The real schema has no `depends_on`, no DAG, no edge model — `max_parallel_agents`
  is internal fan-out *within* one `llm_batch_agents` node, not a graph branch.)
- **The side panel** (right) is **PUSH/SPLIT** — the graph column **shrinks** to make room, exactly
  like the app's existing right-side workspace panel. **Never an overlay, never a slider.** The
  `minmax(0,1fr)` graph track is what guarantees the fixed panel + flexible graph **always fit with no
  horizontal scrollbar at any desktop width** (verified to 1100px):
  - At rest (no node selected): `grid-template-columns: minmax(0, 1fr) 44px` — the panel collapses to a
    thin **44px rail** (`.d-rail`, a vertical "select a phase to refine its fields" hint) so the
    resting graph reads clean (3-second test).
  - Open: `.panel-open` → `grid-template-columns: minmax(0, 1fr) 400px`, animated via
    `transition: grid-template-columns`. The open node glows as the selection anchor (`.snode.open` =
    primary border + `--shadow-glow-primary`); a `✕` back-control returns the graph to full width.
  - **Mobile** (`max-width: 760px`): the panel becomes a **bottom-sheet** (full-width row 2), matching
    the app — noted in CSS, not over-built.

### D9 — Per-node form conditioned on `phase_type`; all SIX phase types (019-D; MANIFEST D-15)

The form (`formBody`) is **never a wall of all fields** — it renders **only** the real editable fields
for that node's `phase_type`. All **six** real phase types live in one graph, each with the
run-surface glyph vocabulary borrowed from `PhaseCard.tsx` (`BRIEF §4.4`) — the 6th (`◆` Deliverable)
is net-new because `PhaseCard.tsx` predates `llm_emit`:

| `phase_type` | Glyph | Form fields rendered | Notes |
|---|---|---|---|
| `programmatic` | ⚙ Server step | `fn` (registry key), `input_keys` | **no** model/tools/scope — a deterministic server step |
| `llm_single` | ✎ AI write step | `prompt`, `model`, `temperature`, `folder_scope`, `skill_ref` | no tools/max_steps |
| `llm_agent` | 🤖 AI agent step | + `available_tools` (per-phase **whitelist**), `max_steps`, `wall_clock_seconds` | validators (e.g. `freshness`) shown here |
| `llm_batch_agents` | ⛓ Parallel agents | + `max_parallel_agents`, `merge_strategy` (`concat`/`concat_numbered`) | violet accent; fan-out type |
| `llm_human_input` | ☺ Needs you | `prompt`, `options`, `timeout_seconds` | **no** model/tools/scope — a human pause |
| `llm_emit` | ◆ Deliverable | `prompt`, `emitter`, `model`, `folder_scope`, `skill_ref`, **`citation_policy`**, **`integrity_policy`** (greyed) + template placeholders | the **only** type with the policy enums; visually distinct terminus |

- Every node carries REAL chips (`nodeChips`): `📁 folder_scope` (name + bound id), `✦ skill_ref`,
  `⚑ validator` (with `on_failure` in the title), `⛓ cite: <citation_policy>` on `llm_emit`.
  `folder_scope` always renders the **real folder name + bound id**, never a path/prose.
- `available_tools` render as **real registry tool chips** (`toolWhitelist` over `TOOL_REGISTRY`);
  `citation_policy` as a segmented control with per-stop captions; the `llm_emit` template placeholders
  link back to the 018 fill-contract.
- **Talk is available for big moves** ("💬 talk") but the surface stays read-only — talk is the escape
  hatch for "add a web-search step", not the primary editor.

### D10 — Honesty caveats encoded in the UI (018-A + 019-D)

Every net-new surface is flagged honestly. There is **no backend draft-CRUD, no NL-gen endpoint, no
upload-validate endpoint, no graph lib** today (only `GET /workflows/published` + `POST
/workflows/{id}/publish` are live). The dial carries `AI set this · net-new (spike-097)`; the
fill-contract popover names the real parser it *would* call + `NET-NEW · no upload-validate endpoint`;
the graph header carries `NET-NEW · no graph lib` (plain HTML/CSS + one SVG overlay); `integrity_policy`
stays greyed "Phase 106."

---

## CSS Patterns

The push/split grid that guarantees no horizontal scrollbar (019-D — the load-bearing layout):

```css
/* the graph column is FLEXIBLE and shrinks; the panel is FIXED-WIDTH and pushes (never overlays). */
.body-area.vD            { grid-template-columns: minmax(0, 1fr) 44px;   /* resting: thin rail */
                           transition: grid-template-columns var(--dur-base) var(--ease-out); }
.body-area.vD.panel-open { grid-template-columns: minmax(0, 1fr) 400px; } /* open: fixed inspector */
/* minmax(0,1fr) lets the graph track shrink BELOW its content's intrinsic width — the key trick.
   belt-and-braces: min-width:0 on the graph wrap so it can shrink under flex/grid too. */
.body-area.vD .spine-wrap  { min-width: 0; }
.body-area.vD .spine-inner { max-width: 680px; }
.d-panel       { border-left: 1px solid var(--color-border); background: var(--color-bg-elev1);
                 overflow: hidden; display: flex; flex-direction: column; min-width: 0; }
.d-panel-open  { width: 400px; height: 100%; display: flex; flex-direction: column;
                 animation: fadeSlideUp var(--dur-base) var(--ease-out); }
.dp-body       { flex: 1; overflow-y: auto; padding: var(--space-3) var(--space-4) 80px; }

@media (max-width: 760px) {  /* mobile: bottom-sheet, matching the app's workspace panel */
  .body-area.vD, .body-area.vD.panel-open { grid-template-columns: 1fr; grid-template-rows: 1fr auto; }
  .d-panel { border-left: none; border-top: 1px solid var(--color-border); max-height: 55vh; }
}
```

The read-only spine + the single dashed skip branch (019-D):

```css
.spine > li::before { content: ''; position: absolute; left: 13px; top: 38px; bottom: -6px;
                      width: 2px; background: var(--color-border-soft); }  /* solid run-order edge */
.spine > li:last-child::before { display: none; }
.spine-node      { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center;
                   font-family: var(--font-mono); border: 1.5px solid var(--color-border); }
.spine > li.is-emit .spine-node { border-color: var(--color-accent-violet); color: var(--color-accent-violet);
                                  box-shadow: 0 0 0 3px hsl(258 90% 66% / .12); }  /* distinct ◆ terminus */
.snode.open      { border-color: var(--color-primary); box-shadow: var(--shadow-glow-primary); }
/* the ONLY non-linear edge: a dashed on-fail rail, geometry-measured to land on the target bullet */
.spine-skiprail        { position: absolute; width: 2px; border-left: 2px dashed var(--color-warning);
                         pointer-events: none; z-index: 0; }
.spine-skiprail::after { content: '⤳'; position: absolute; bottom: -7px; left: -5px;
                         color: var(--color-warning); }
```

The describe-box hero — the 3-second first screen (018-A):

```css
.describe-first { height: 100%; display: flex; flex-direction: column; align-items: center;
                  justify-content: center; padding: var(--space-8) var(--space-6); background: var(--color-bg); }
.df-inner       { width: 100%; max-width: 640px; display: flex; flex-direction: column; gap: var(--space-4);
                  animation: fadeSlideUp var(--dur-slow) var(--ease-out); }
.df-input       { width: 100%; background: var(--color-surface); border: 1px solid var(--color-border);
                  border-radius: var(--radius-lg); padding: var(--space-5); font-size: var(--text-md);
                  line-height: 1.6; resize: none; }
.df-input:focus     { outline: none; border-color: var(--color-primary-glow); box-shadow: var(--shadow-glow-primary); }
.df-input.req-empty { border-color: hsl(38 92% 60% / .5); }  /* required-field affordance ON the box */
```

The grey-area confirm card + batched panel — the no-silent-substitution centerpiece (018-A):

```css
.grey-card          { border: 1px solid hsl(38 92% 60% / .5); background: var(--color-warning-dim);
                      border-radius: var(--radius-md); padding: var(--space-3);
                      animation: fadeSlideUp var(--dur-base) var(--ease-out); }
.grey-card.resolved { border-color: hsl(142 71% 45% / .35); background: var(--color-success-dim); }
.grey-said .quote   { color: var(--color-text); font-style: italic; }  /* "You said '…'" verbatim frame */
.grey-read          { font-size: 12.5px; margin-top: 8px; padding: 8px var(--space-3);
                      background: var(--color-surface); border: 1px solid var(--color-border-soft);
                      border-radius: var(--radius-sm); display: flex; align-items: center; gap: 8px; }
.grey-read .bound-id { font-family: var(--font-mono); margin-left: auto; }  /* id is the bound token */
/* A's batched panel sits ABOVE the provisional draft; cleared flips warning→success */
.assume-panel         { border: 1px solid hsl(38 92% 60% / .5); background: var(--color-surface);
                        border-radius: var(--radius-lg); overflow: hidden; }
.assume-panel.cleared { border-color: hsl(142 71% 45% / .35); }
.assume-bar .ab-count { margin-left: auto; font-family: var(--font-mono);
                        background: var(--color-warning); color: hsl(40 60% 10%); border-radius: var(--radius-full); }
```

The collapsed strictness dial + preset cards (real enums only) (018-A):

```css
.dial-summary       { display: flex; align-items: center; gap: var(--space-2); border: 1px solid var(--color-border);
                      border-radius: var(--radius-lg); padding: var(--space-3) var(--space-4); }  /* one-line while greys open */
.dial-summary .ds-enum { font-family: var(--font-mono); color: var(--color-accent-violet); }       /* the real citation_policy */
.dial-summary .ds-ai   { background: hsl(258 90% 66% / .15); color: var(--color-accent-violet); }   /* "AI set this · net-new" */
.preset             { flex: 1; border: 1px solid var(--color-border); border-radius: var(--radius-md);
                      background: var(--color-bg-elev1); padding: var(--space-3); cursor: pointer; }
.preset.on          { border-color: var(--color-primary); background: var(--color-primary-dim); }
.preset .penum      { font-family: var(--font-mono); color: var(--color-text-dim); margin-top: 6px; }  /* "citation_policy = strict" */
.seg button.on      { background: var(--color-primary-dim); color: var(--color-primary); }             /* 4-stop policy control */
.judge-banner       { border: 1px solid hsl(258 90% 66% / .4); background: hsl(258 90% 66% / .1); }     /* always-on, dial can't remove */
.policy-grey        { opacity: .7; }  /* integrity_policy — "coming with Phase 106" */
```

Per-node form, conditioned on `phase_type` (019-D):

```css
.pf-grid       { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
.pf-field.full { grid-column: 1 / -1; }
.pf-input      { background: var(--color-surface-hi); border: 1px solid var(--color-border);
                 border-radius: var(--radius-sm); padding: 6px 8px; font-size: 12px; }
.pf-input.greyed { background: var(--color-muted); color: var(--color-text-dim); cursor: not-allowed; }  /* integrity_policy */
.pf-static     { font-family: var(--font-mono); background: var(--color-surface-hi);
                 border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: 6px 8px;
                 overflow-wrap: anywhere; }  /* read-only bound values: folder_scope, emitter, placeholders */
.tw-chip.on    { background: var(--color-success-dim); border-color: hsl(142 71% 45% / .4); color: var(--color-success); }
.tw-chip.on::before { content: '✓ '; }  /* available_tools whitelist chip */
.cite-seg button.on { background: var(--color-primary-dim); color: var(--color-primary); }  /* citation_policy segmented */
```

---

## HTML Structures

The body grid — graph + push/split panel (019-D). The SAME spine renders whether the panel is open;
the inline form is simply suppressed in D (it lives in the side panel instead):

```html
<div class="body-area vD panel-open">       <!-- .panel-open grows the track 44px → 400px -->
  <div class="spine-wrap"><div class="spine-inner">
    <div class="graph-cap">READ-ONLY GRAPH · ordered by phase_index · run order (i→i+1)
      · on-fail branch (skip_to_phase) · no depends_on · no parallel lanes · inspect, don't drag</div>
    <ol class="spine">
      <li class="is-emit">
        <span class="spine-node" id="spineNode5">◆</span>          <!-- ◆ = the llm_emit terminus -->
        <div class="snode is-emit open" onclick="toggleNode(5)">   <!-- click selects; .open = glow anchor -->
          <div class="snode-top">
            <span class="node-type"><span class="glyph gl-emit">◆</span>
              <span class="tlabel">Render the vendor-risk brief</span></span>
            <span class="idx-atom">llm_emit</span>
          </div>
          <div class="sn-purpose">Fills the brief template from the confirmed narrative…</div>
          <div class="nchips">…📁 scope · ✦ skill · ⚑ gate · ⛓ cite: strict…</div>
        </div>
        <!-- a gated node shows the dashed on-fail label; the rail itself is drawn in the gutter -->
        <div class="skip-branch"><span class="arc"></span>on fail (freshness · ≤90d) → skip to <b>human-confirm</b></div>
      </li>
    </ol>
    <div class="spine-skiprail" id="spineSkipRail"></div>   <!-- geometry-measured dashed branch -->
  </div></div>

  <div class="d-panel">              <!-- RESTING: a thin 44px rail; OPEN: the 400px form -->
    <div class="d-panel-open">
      <div class="dp-head">
        <span class="node-type"><span class="glyph gl-emit">◆</span><span class="dp-name">Render the vendor-risk brief</span></span>
        <button class="dp-back" onclick="toggleNode(5)" title="Close — return the graph to full width">✕</button>
      </div>
      <div class="dp-sub"><span class="idx-atom">phase_index 5</span><span class="idx-atom">llm_emit</span></div>
      <div class="dp-body">
        <div class="pform-h">refine by form · fields for <b>llm_emit</b>
          <span class="talk-mini" onclick="openTalk(event,5)">💬 talk</span></div>
        <!-- formBody(p) renders ONLY this phase_type's real fields -->
      </div>
    </div>
  </div>
</div>
```

The describe-box-only first screen (018-A):

```html
<div class="body-area first">                  <!-- ONE column; no rail on EMPTY -->
  <div class="describe-first"><div class="df-inner">
    <div class="df-lead"><div class="df-glyph">✎</div>
      <div class="df-title">What recurring work should this automate?</div></div>
    <div class="df-box">
      <div class="df-req-label"><span class="req-star">✦</span> business requirement
        <span class="req-tag">required</span></div>
      <textarea class="df-input req-empty" placeholder="Describe the goal in plain language…"></textarea>
    </div>
    <div class="df-actions"><button class="df-draft-btn" disabled>Draft the workflow</button></div>
    <div class="df-hint">You describe the goal — the AI <b>drafts the phases</b>, <b>sets the strictness</b>,
      and <b>asks about anything it had to guess</b>.
      <button class="info-dot how"><span>ⓘ</span> how this works</button></div>
  </div></div>
</div>
```

The batched assumptions panel + an `llm_emit` reveal with the prominent attach button (018-A):

```html
<!-- sits ABOVE the provisional draft; Continue-to-publish disabled until cleared -->
<div class="assume-panel">
  <div class="assume-bar"><span class="ab-ico">⚠</span>
    <span class="ab-title">Confirm the 2 guesses the draft flagged</span>
    <span class="ab-count">2</span></div>
  <div class="assume-body">
    <div class="grey-card">
      <div class="grey-head"><span class="grey-batch">1 of 2</span><span class="gico">📁</span>
        I made a guess here — confirm before it binds<span class="grey-kind">folder ref</span></div>
      <div class="grey-said">You said <span class="quote">"the latest vendor assessments in our knowledge base"</span></div>
      <div class="grey-read"><span class="ico">→</span> I'll bind <b>folder_scope: [fld_8c1a]</b>
        <span class="bound-id">Vendors — 2025 Assessments</span></div>
      <div class="grey-alts"><!-- alternatives WITHIN the project folder --></div>
      <div class="grey-actions"><button class="gbtn confirm">✓ Confirm — bind it</button></div>
    </div>
  </div>
</div>

<!-- inside the llm_emit draft card: the post-draft reveal + the prominent (not faint) attach button -->
<div class="p-reveal"><span class="pr-lead">⬆ To fill a document this phase needs a template:</span>
  <button class="attach-tpl-btn" onclick="attachTemplate()">
    <span class="atb-ico">⬆</span> Attach the .docx / .pptx / .xlsx this fills
    <span class="atb-fmt">net-new</span></button>
</div>
```

---

## What to Avoid

- **Drag-canvas / node-and-edge wiring.** Operator-rejected outright ("the squeezed dead middle").
  No connection handles, no `+` add-node, no drag anywhere — the graph is **read-only**: inspect,
  don't drag. The real schema has no `depends_on`, no DAG, no edge model to draw.
- **Talk-led as the primary surface (the old 013 vision).** Superseded by **form-led**. A
  conversation rail steering a streaming diagram inverts the chosen model: you refine by **FORM** on a
  read-only graph; talk is an *available* escape hatch for big moves, not the main editor. Do not
  reinstate the 013 left-conversation-rail-primary layout.
- **Faking grounding / template / folder up front.** No grounding chips, no dial, no template upload,
  no folder picker on the **first screen** — it is **just the describe box**. Grounding is *revealed by
  the draft*, post-draft, a refinement not a precondition. Collecting it up front is the rejected
  setup-scaffolding flow.
- **A horizontal graph that needs a slider.** Sketch 019 variant B (left-to-right flow with an SVG
  edge overlay) lost to D. The vertical spine matches the run-time `PhaseTimeline` reading direction
  and fits the fixed side-panel via `minmax(0,1fr)` with **no horizontal scrollbar at any width**. Do
  not build an LTR canvas that scrolls sideways.
- **Inline-expand the form under the node (019 variant A).** D beat A: opening the form *inline beneath
  the node* in a single scroll column. D's **side-panel push/split** keeps the graph a clean read-only
  spine while you edit. Use the fixed right panel, not an inline accordion.
- **Invented strictness labels.** No "level 1/2/3", no "compliance mode", no "lenient", no
  "high/medium/low strictness". Use the REAL enum `citation_policy strict|flag|partial|draft` + the
  real gate kinds + plain-language captions only.
- **Silent substitution.** Never present a guessed folder / scope / placeholder as settled fact. Every
  guess is shown *as a guess* with a Confirm/correct, and the draft stays **provisional** until all are
  cleared. Never conflate the user's words ("You said …", verbatim) with the AI's reading ("In your
  template I found …").
- **Per-phase-drawing animation / token-by-token narration of the draft.** One-shot emission is proven
  — the draft appears **whole** after a single "Composing…" state. Don't promise live drawing.
- **Rendering `llm_emit`'s policy fields on the wrong phase types,** or showing model/tools/scope on
  `programmatic` or `llm_human_input`. The form is **conditioned on `phase_type`** — render only that
  type's real fields.
- **Modal windows for passive teaching,** or a space-occupying first-time banner on the empty screen.
  Modals are reserved for must-decide moments; teaching uses `ⓘ` popovers + an inline "how this works"
  affordance.

---

## Origin

Synthesized from sketches: **018 (requirement-first-authoring, winner A — describe-then-confirm)** and
**019 (draft-refine-and-readonly-graph, winner D — vertical spine + side-panel form synthesis)**.

- 018 owns: the describe-box-only first screen, one-shot composing, post-draft grounding reveal, the
  batched no-silent-substitution confirm, the real-enum strictness dial (presets + advanced), the
  template-upload fill-contract + two-layer guarantee, and tiered guidance.
- 019 owns: the read-only vertical phase-spine graph (linear `i→i+1` + dashed `skip_to_phase`, no
  drag-canvas), the fixed-width right-side push/split form panel, and the six `phase_type`-conditioned
  per-node forms.

Grounded by `.planning/sketches/103-grounding/BRIEF.md` (the real `WorkflowDefinition` vocabulary —
6 phase types, the `citation_policy strict|flag|partial|draft` enum, `project_folder_id` vs per-phase
`folder_scope`, the per-phase validator/gate set) and **MANIFEST Running Design Decisions 11–15**.

Source files in `sources/018-requirement-first-authoring/` and
`sources/019-draft-refine-and-readonly-graph/`.

**SUPERSEDES** `references/workflow-builder.md` (sketch 013, the design-ahead talk-led vision) with
the built form-led version.
