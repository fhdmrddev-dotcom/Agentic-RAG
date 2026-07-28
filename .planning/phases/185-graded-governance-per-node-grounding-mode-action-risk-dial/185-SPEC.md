# Phase 185: Graded Governance — Per-Node Grounding Mode + Action-Risk Dial — Specification

**Created:** 2026-07-28
**Ambiguity score:** 0.12 (gate: ≤ 0.20)
**Requirements:** 9 locked

## Goal

Every workflow step that reads the knowledge base is detected, locked to *must prove it*, and has the
`citations_required` coverage gate enforced by the engine at run time whether or not the definition
declares it — while steps that read nothing stay ungated and freely mixable in the same workflow; and
any step may carry an author-set action-risk checkpoint that waits indefinitely rather than expiring
into "yes".

## Background

Grounded in code read on 2026-07-28.

**Engine.** `backend/app/models/harness.py` defines `PhaseConfig` as a 6-member `extra="forbid"`
discriminated union. **No grounding field exists on any member.** `citation_policy`
(`strict|flag|partial|draft`) lives only on `LlmEmitPhaseConfig:153`. `available_tools` exists only on
`LlmAgentPhaseConfig:80` and `LlmBatchAgentsPhaseConfig:97`. `ValidatorSpec.kind:180` includes
`citations_required`, which `validator_kinds.py:199` wraps around `template_render_service.check_coverage`
— a **deterministic coverage check** returning `uncited_value_count` / `invented_citation_count` /
`uncited_leaves`. It is not a threshold: `grep -rn confidence backend/app/services/harness/
backend/app/models/harness.py` returns **nothing**.

**The gate only fires when an author declared it.** Live corpus, 2026-07-28 — 133 `workflow_definitions`
/ 170 phases: **84 phases carry a KB-reading tool, 48 are strict. 36 steps read your documents and cite
nothing.**

**The approval substrate expires into "yes".** `_exec_llm_human_input`
(`backend/app/services/harness/phase_types.py:594`) clamps to `min(phase.config.timeout_seconds,
settings.ask_user_max_timeout_seconds)` (300 / 1800) and on timeout sets `answer = ""` and **returns
normally** — a normal return advances the run. In the canonical example the next step sends the email.

**Frontend.** `phaseVocabulary.groundingFor()` (`frontend/src/components/workflows/phaseVocabulary.ts:223`)
*derives* a 3-face grounding word-badge (`🔒 Must cite its sources` / `◐ Flags uncited claims` /
`○ No sources needed`) from `citation_policy` + the presence of a `citations_required` validator, and its
own docblock states "Phase 185 later replaces this derivation with an authored grounding-mode field; 183
must NOT invent that field." `PhaseFormPanel.tsx:85-107` ships a `PhaseFormRails.gates: PhaseGateRow[]`
container documented as the plug-in point for exactly this phase. `PhaseFormPanel.tsx` is **1078 lines**.
The `/validate` + `/grounding-bundle` seam (Phase 182) already returns per-node verdicts keyed on
`node id == phase.slug`.

**Design is pre-settled.** Sketches 142–146 are operator-approved, wrapped, and packaged into
`Skill("sketch-findings-agentic-rag")` → `references/graded-governance.md` and
`references/approval-and-review.md`. Their locked decisions are constraints on this phase, not options.

## Requirements

1. **Authored grounding field**: The phase model carries an additive-optional grounding state that
   survives the canvas round trip, with zero migrations.
   - Current: `PhaseConfig` is a 6-member `extra="forbid"` union with no grounding field; the frontend
     derives a 3-face badge instead
   - Target: an additive-optional grounding field on the phase model (JSONB, not a column) carrying a
     two-valued state (*must prove it* / *free to think*) plus its cause (`detected` / `already-set` /
     `escalated`)
   - Acceptance: a pre-185 `workflow_definitions` JSONB row with no such field `model_validate()`s
     without error; a definition carrying the field round-trips `toCanvas` → `fromCanvas` → save with
     reference identity preserved; `git diff -- supabase/migrations` is **0 lines**

2. **Detection is a named list, never a judgement call**: A step is detected as grounded iff its
   `available_tools` intersects a fixed 5-name KB tool list.
   - Current: nothing detects anything; grounding is derived from `citation_policy` + validator presence
   - Target: `KB_TOOLS = [search_documents, query_documents, read_document, analyze_document,
     get_related_documents]`; `available_tools ∩ KB_TOOLS ≠ ∅` ⇒ *must prove it*, cause `detected`. Only
     `llm_agent` / `llm_batch_agents` can auto-lock (they are the only configs with `available_tools`).
     `LlmEmitPhaseConfig.citation_policy == "strict"` is the separate `already-set` cause. `folder_scope`
     is **not** a detection input.
   - Acceptance: a unit test over the 5 names returns `detected` for each in isolation and `free to think`
     for an `llm_agent` carrying only non-KB tools; an `llm_single` step never auto-locks; an `llm_emit`
     at `citation_policy: "strict"` reports cause `already-set`

3. **One-way lock — you can only undo a lock you created**: A detected or already-set lock has no
   author-facing removal path; an escalated one does, and loses it if detection later applies.
   - Current: no lock exists in any form
   - Target: cause `detected` → no removal control exists in any variant (removing the KB tool is the only
     exit); cause `already-set` → owned by the existing `citation_policy` dial, unchanged; cause
     `escalated` → the author may undo, **unless** detection subsequently applies, at which point detection
     wins and the undo disappears
   - Acceptance: a test that hand-escalates a step then adds `search_documents` observes the cause flip
     `escalated → detected` and the undo affordance disappear; a test that removes the tool from a detected
     step observes the lock clear; no code path anywhere sets a detected step back to *free to think*

4. **The engine enforces the gate at run time, on every definition**: A detected step's
   `citations_required` coverage gate fires whether or not the definition JSONB declares the validator.
   - Current: `citations_required` fires only when an author placed the `ValidatorSpec` in the definition;
     36 KB-reading steps in the live corpus carry no citation gate
   - Target: the engine attaches the `citations_required` coverage gate when a detected phase executes —
     including for **already-published** definitions, on their next run. The Deep chat path is untouched.
   - Acceptance: a run of a definition whose JSONB carries `search_documents` and **no**
     `citations_required` validator fails on uncited output; deleting the validator from the JSONB via a
     direct DB/API write does not remove enforcement; a `git diff`-level check confirms zero changes to the
     Deep (non-harness) chat path, and the Deep byte-identity assertion of D-14 holds

5. **The dial is a switch that visibly refuses**: The step panel carries a two-position control whose
   refused press prints its reason as real DOM text.
   - Current: `PhaseFormPanel`'s `gates: PhaseGateRow[]` rail is an empty container with no control
   - Target: `○ Free to think` ⇄ `⛨ Must prove it` in a self-contained governance component that
     `PhaseFormPanel.tsx` mounts. On a locked step the loose side is struck through; pressing it renders the
     refusal reason as real DOM text wired by `aria-describedby`. On a step type where grounding cannot
     apply, the control is **absent, not disabled**. The panel also states the attached gate in plain
     language and names the tool list as the real control.
   - Acceptance: pressing the refused side makes the reason findable by text query in the DOM;
     `getByTitle` finds no refusal text anywhere; a step type that cannot be grounded renders **no** dial
     element (query returns null, not a disabled node); the refusal copy names what switching the tool off
     costs, not a loosening alternative

6. **The canvas mark is shape, not colour or a badge**: The node card's governance signal is a sealed
   edge plus a corner seal, and the shipped 3-face word-badge is deleted.
   - Current: `PhaseNodeCard` renders `groundingFor()`'s word-badge (`🔒 Must cite its sources` /
     `◐ Flags uncited claims` / `○ No sources needed`)
   - Target: that word-badge is **removed**; governance renders as a sealed border (reinforcement) plus a
     corner seal at **top-right** carrying its own background and border. The seal is **never** conditional
     on run state. Top-right of the card is CLAIMED for governance — 188/189 may not take it. Governance
     spends **no colour** and **no word-badge slot**.
   - Acceptance: a snapshot/grep over the workflow component tree finds **0** occurrences of the three
     retired badge strings; the seal renders identically across all four run states (idle / running /
     needs-you / failed); a greyscale (colour-stripped) render still distinguishes a grounded card from an
     open one

7. **Binding vocabulary**: The surface uses the locked words and none of the banned ones.
   - Current: the shipped badge says "Must cite its sources"; nothing says "Must prove it"
   - Target: **Must prove it** (canvas, at rest) · **Free to think** · **Nothing to prove here**
     (connectors and question-to-a-human steps). Banned: *Proven*, *Ungoverned*, *Unchecked*,
     *Not applicable*, *N/A*. *Traceable* is legitimate only at the review moment, which is not in this
     phase.
   - Acceptance: `grep -ri` over the workflow component tree returns **0** for each banned term in
     user-visible strings, and ≥1 for each required term

8. **Action-risk checkpoint is a gate ON the step, never an extra step**: Any step may carry an
   author-set checkpoint that does not change the flow's shape.
   - Current: no checkpoint concept; an author places an `llm_human_input` phase manually, which is a
     separate step and changes the step count
   - Target: an author-set action-risk checkpoint available on every step type, **default OFF** in 185
     (no engine step type performs outbound egress yet; Phase 189's external-action node arrives
     armed-on, per its SC#2). Arming it must not change `len(phases)` or any `phase_index`. The step must
     be visibly marked as armed at rest **without spending colour or a word-badge**.
   - Acceptance: arming a checkpoint on a 5-step workflow leaves `len(phases) == 5`, every `phase_index`
     unchanged, and the canvas rendering exactly 5 nodes; "step 4 of 5" still means what it says

9. **The action-risk gate fails closed**: With the checkpoint set, no answer means the run never
   proceeds.
   - Current: `_exec_llm_human_input:594` sets `answer = ""` on timeout and **returns normally**, so the
     run advances after 300s of silence
   - Target: when the action-risk checkpoint is set, the gate waits indefinitely and never auto-advances.
     A plain `llm_human_input` step (checkpoint unset) keeps its **current** timeout disposition
     unchanged. GOVERN-03 reuses the `llm_human_input` substrate (durable prompt row, `tool_call_id`,
     boot-time resume sweep) but not its timeout disposition.
   - Acceptance: a test where `subscribe_for_response` returns `None` with the checkpoint **set** shows
     the run does NOT advance to the next phase; the same test with the checkpoint **unset** produces
     behaviour byte-identical to today's; the surface never claims "the run waits" on an unarmed step

## Boundaries

**In scope:**
- The authored grounding field on the phase model (additive-optional, zero-migration)
- The `KB_TOOLS` detection rule and the three-cause lock model (`detected` / `already-set` / `escalated`)
- Run-time engine attachment of the `citations_required` coverage gate on detected phases, for
  already-published definitions too
- The two-position dial + refusal text + attached-gate statement, as a self-contained component the
  1078-line `PhaseFormPanel.tsx` mounts
- Deletion of the shipped 3-face grounding word-badge and replacement with the sealed edge + corner seal
- The binding vocabulary swap
- The author-set action-risk checkpoint (default OFF) and its at-rest canvas mark
- The fail-closed change to the approval gate, scoped to armed checkpoints only
- Cross-provider UAT (SC#10) proving graded strictness holds on all four providers

**Out of scope:**
- **A confidence threshold.** GOVERN-01's phrase "`citations_required` + confidence gate" is **amended at
  spec time**: no confidence concept exists in the engine (no threshold, no score, no source of a score),
  and inventing one is a design sub-project. Grounded means *every value traceable, zero invented sources* —
  the deterministic `check_coverage` that already exists and already fails honestly. `REQUIREMENTS.md`
  GOVERN-01 is amended to drop the word.
- **The review moment (sketch 145) and the round trip (sketch 146).** Both are drawn on a dedicated
  workflow run surface that the sketches themselves call "a proposal to Phase 188, not a commitment
  inside 185". The approval prompt keeps rendering on the existing surface. → **Phase 188**
- **A dedicated workflow run surface.** Workflows still launch by creating a thread and redirecting into
  Chat (`WorkflowsPage.tsx`). Fixing that is RUNVIZ work. → **Phase 188**
- **`.docx` / `.pptx` / `.xlsx` / `.pdf` inline preview.** Its consumer (`FilesSection` → `FilePreview`,
  `frontend/src/components/panel/`) already ships and is independent of governance; it maps to no GOVERN
  requirement, needs a net-new frontend dependency, and is really four format decisions, not one. →
  **its own insert phase immediately after 185** (operator decision 2026-07-28, superseding the sketch
  wrap-up's "defer to 190"). The sketch's 190 re-open trigger is satisfied early rather than dropped.
- **Armed-on-by-default for external actions.** The default rule ships with the risk it protects
  against. → **Phase 189** (already its SC#2)
- **A global fix to the `llm_human_input` timeout-advances-silently behaviour.** Real, but outside 185's
  requirements and it would break D-14 byte-identity for existing human-input steps. Only armed
  checkpoints change.
- **"Someone else approved it" (a second approver must be told who decided).** → **Phase 186**, the
  run-time twin of the co-editing guard
- **A grandfathering / backfill affordance for existing `workflow_definitions` rows.** Every row is
  throwaway test data (operator); detection simply applies.
- **A third "reads but exploring" grounding state.** A named escape hatch inside the milestone's only
  differentiator. The exploratory-reading case is handled by splitting the step in two.
- **A separate refactor phase for `PhaseFormPanel.tsx`.** G-5 is honoured by construction instead — see
  Constraints.
- **A run-state shape for the canvas** (run status does not survive a colour-blind read). → **Phase 188**
- **Any database migration.** Live head stays at 113.

## Constraints

- **Zero migrations.** The grounding field and the action-risk checkpoint are additive-optional fields in
  the `WorkflowDefinition` JSONB, not columns. `git diff -- supabase/migrations` must be 0 lines.
- **D-14 (red line) — Deep byte-identical when unset.** The Deep chat path must be untouched. The harness
  path changes deliberately and only for detected phases / armed checkpoints.
- **`extra="forbid"` is load-bearing.** New fields must be added the way the existing 6 union members
  were, so pre-185 JSONB rows still `model_validate()`.
- **Governance spends no colour and no word-badge.** Colour is banked for Phase 188's run status; both
  card word-badge slots are committed to 188/189. Every governance signal is made of **shape**.
- **The corner seal is load-bearing; the edge is reinforcement.** Run status overwrites the border, so
  the seal is the only carrier that survives mid-run. It may never be conditional on run state, and
  top-right of the card is permanently CLAIMED.
- **Refusal reasons are real DOM text wired by `aria-describedby`** — never a `title` attribute, never
  omitted (the 184-07 lesson).
- **A control that could never do anything is removed, not disabled.**
- **G-5 honoured by construction.** `PhaseNode.tsx` (279 L) already has `PhaseNodeCard.tsx` (335 L) and
  `nodePresentation.ts` (201 L) extracted by 183/184. The real hot file is `PhaseFormPanel.tsx` at
  **1078 lines** — 185 adds a **mount point**, not another 200 lines. The governance section ships as its
  own component. Record the fire as honoured-by-construction in STATE.md.
- **SC#10 (cross-provider mandate) applies** — a grounded node's citation enforcement rides the
  provider-sensitive retrieval/agent path. UAT must cover OpenAI / Anthropic / Google / OpenRouter, plus
  the multi-tool, parallel-thread, and long-message axes.
- **No full threat model** (roadmap): this phase reuses the enforced validation-gate library. The
  structural "not author-loosenable-away" property is verified in-phase (Requirement 3 + 4).
- **G-2 satisfied.** Sketches 142–146 are operator-approved and packaged; their locked decisions are
  constraints, not options. The one design question they left genuinely open is the **at-rest canvas mark
  for an armed action-risk checkpoint** — sketch 144 drew two shapes (collar vs connector checkpoint) and
  locked no winner. discuss-phase or a short sketch picks the shape; the requirement (Req 8) locks that it
  must be marked, without colour or a badge.

## Acceptance Criteria

- [ ] A pre-185 `workflow_definitions` JSONB row with no grounding field `model_validate()`s without error
- [ ] `git diff -- supabase/migrations` is 0 lines; live migration head is still 113
- [ ] A definition carrying the grounding field round-trips `toCanvas` → `fromCanvas` with reference
      identity preserved
- [ ] Each of the 5 `KB_TOOLS` names, in isolation, detects a step as *must prove it* with cause `detected`
- [ ] An `llm_agent` with only non-KB tools is *free to think*; an `llm_single` never auto-locks; an
      `llm_emit` at `citation_policy: "strict"` reports cause `already-set`
- [ ] `folder_scope` alone never triggers detection
- [ ] A hand-escalated step that later gains a KB tool flips cause to `detected` and loses its undo
- [ ] No code path sets a `detected` step back to *free to think*
- [ ] A run of a published definition carrying a KB tool and **no** `citations_required` validator fails on
      uncited output
- [ ] Deleting the `citations_required` validator from the JSONB does not remove enforcement
- [ ] The Deep chat path is byte-identical (D-14)
- [ ] Pressing the refused dial side renders the reason as text-queryable DOM; `getByTitle` finds no
      refusal text
- [ ] A step type where grounding cannot apply renders **no** dial element (query returns null, not a
      disabled node)
- [ ] A grep over the workflow component tree returns 0 for `Must cite its sources`, `Flags uncited
      claims`, `No sources needed`
- [ ] A grep returns 0 for each banned term (`Proven`, `Ungoverned`, `Unchecked`, `Not applicable`, `N/A`)
      in user-visible strings, and ≥1 for `Must prove it`, `Free to think`, `Nothing to prove here`
- [ ] The corner seal renders identically across idle / running / needs-you / failed
- [ ] A colour-stripped render still distinguishes a grounded card from an open one
- [ ] Arming an action-risk checkpoint on a 5-step workflow leaves `len(phases) == 5`, every `phase_index`
      unchanged, and the canvas rendering exactly 5 nodes
- [ ] With the checkpoint **set** and `subscribe_for_response` returning `None`, the run does NOT advance
- [ ] With the checkpoint **unset**, `_exec_llm_human_input` behaviour is byte-identical to today
- [ ] `PhaseFormPanel.tsx` grows by a mount point only; the governance section is its own component
- [ ] SC#10 UAT covers OpenAI / Anthropic / Google / OpenRouter, plus one multi-tool row, one
      parallel-thread row, and one long-message row

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                                        |
|--------------------|-------|------|--------|--------------------------------------------------------------|
| Goal Clarity       | 0.90  | 0.75 | ✓      | Confidence dropped; detection rule + bite-point both settled |
| Boundary Clarity   | 0.92  | 0.70 | ✓      | 185/188 seam explicit; 12 out-of-scope items with reasons    |
| Constraint Clarity | 0.85  | 0.65 | ✓      | Zero-migration, D-14, no-colour/no-badge, G-5, SC#10         |
| Acceptance Criteria| 0.82  | 0.70 | ✓      | 23 pass/fail criteria                                        |
| **Ambiguity**      | 0.12  | ≤0.20| ✓      |                                                              |

Status: ✓ = met minimum, ⚠ = below minimum (planner treats as assumption)

## Interview Log

| Round | Perspective     | Question summary                                          | Decision locked                                                                                          |
|-------|-----------------|-----------------------------------------------------------|----------------------------------------------------------------------------------------------------------|
| 1     | Researcher      | GOVERN-01's "confidence gate" vs an engine with no confidence concept | **Drop the word.** Grounded = deterministic `check_coverage`. `REQUIREMENTS.md` GOVERN-01 amended |
| 1     | Researcher      | How much of sketches 145/146 lands in 185?                | **Engine + authoring only.** Review moment + round trip + run surface → Phase 188                          |
| 1     | Researcher      | What can carry the action-risk checkpoint before 189?     | **Author-set on any step, default OFF.** Armed-on ships with 189's external-action node                    |
| 2     | Researcher      | What exactly makes a step "reads the knowledge base"?     | **Tool list only** — `available_tools ∩ KB_TOOLS`. `folder_scope` is not an input; `llm_emit` strict is the separate `already-set` cause |
| 2     | Simplifier      | Does detection bite at authoring time or run time?        | **Run time, every definition** — including already-published. D-14 holds for Deep; the harness path changes deliberately |
| 2     | Simplifier      | How wide is the fail-closed fix?                          | **Armed checkpoints only.** Plain `llm_human_input` keeps its current disposition                          |
| 3     | Boundary Keeper | Where does the `.docx` viewer live?                       | **Its own insert phase right after 185** — consumer (`FilesSection`/`FilePreview`) already ships, maps to no GOVERN requirement. Supersedes the wrap-up's "defer to 190" |
| 3     | Boundary Keeper | How is G-5 honoured, given `PhaseFormPanel.tsx` is 1078 L?| **Honoured by construction** — the governance section is its own component; 185 adds a mount point, no separate refactor phase |
| 3     | Boundary Keeper | Does 185 delete the shipped grounding word-badge?         | **Yes** — word-badge deleted, corner seal ships; top-right permanently CLAIMED for governance               |

---

*Phase: 185-graded-governance-per-node-grounding-mode-action-risk-dial*
*Spec created: 2026-07-28*
*Next step: /gsd:discuss-phase 185 — implementation decisions (where the field sits in the union, how the engine attaches the gate, the at-rest mark for an armed checkpoint)*
