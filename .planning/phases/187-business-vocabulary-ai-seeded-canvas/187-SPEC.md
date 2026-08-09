# Phase 187: Business Vocabulary + AI-Seeded Canvas — Specification

**Created:** 2026-08-01
**Ambiguity score:** 0.17 (gate: ≤ 0.20)
**Requirements:** 7 locked

## Goal

Every step on the canvas says what **that** step does rather than what its **type** does — the node
face gains an AI-seeded name and a config-derived tier beneath it, the ⌥ reveal stops destroying
that name, the AI seed explains the grounding it applied without being asked, a template can seed
the describe box, and an armed action-risk checkpoint becomes impossible to preempt.

## Background

Grounded in a live read of the code and the local DB (port 54322) on 2026-08-01. **Two of the three
requirements are largely already shipped**, which is why this phase is narrower than the ROADMAP
wording implies — and one inherited measurement did not reproduce.

**VOCAB-01 — both named deliverables already ship.** The plain-language layer is
`phaseVocabulary.ts` (`PHASE_TYPE_SENTENCES`, D-183-06) and the ⌥ Technical-names reveal is fully
wired on both graph views: one app-wide boolean (`TechnicalNamesProvider`, Phase 154 / LANG-01), the
toolbar toggle (`WorkflowCanvas.tsx:1285`), `technical` merged onto node data
(`WorkflowCanvas.tsx:945`), and the swap at both `PhaseNode.tsx:144` and `PhaseSpineGraph.tsx:125`.
**No reveal wiring is owed.**

**The real gap is specificity, and it is worse than sketched.** Sketch 148 recorded "10 of 119
phases carry a `phase.name`". That figure **does not reproduce**. Measured live: 172
`workflow_definitions` rows, of which **145 store `definition` as a double-encoded JSON string**
(fixtures — the shape has no `phases` key at all). The **27 well-formed rows hold 57 phases, of
which 0 carry a non-empty `name`**; 6 carry the key with a null/empty value. So `nodeTitle()`
(`phaseVocabulary.ts:169`) falls through its first tier **100% of the time**, and every node face on
every workflow is one of exactly **6** type sentences. Sketch 148's scenario reproduces on real
data: two steps that do different work render letter-for-letter identical faces. The generator is
the cause — `AUTHORING_SYSTEM_PROMPT` (`workflow_authoring.py:88`) instructs a **definition-level**
`name` only and never a per-step one.

**VOCAB-02 — the NL→canvas path already ships end to end.** `generateWorkflow` → the builder's
`empty → composing → drafted` machine (`WorkflowBuilderPage.tsx:11`, `:1175`) → `toCanvas`. And
SC#3's safety is **already enforced server-side**: `grounding.py:940` appends a `citations_required`
validator whenever `grounding_cause(phase) == "detected"`, at the run seam, unconditionally. What is
missing is not the mechanism but its **legibility** — two steps arrive carrying a governance seal
the user never asked for and nothing explains why.

**VOCAB-03 — the fork already exists, the door does not.** `list_starter_workflows`
(`db/workflows.py:291`) filters `status='published' AND is_system_global=true AND
definition->>'category'='starter'` and yields exactly **3** curated starters (Risk Register, Weekly
Status Report, Compliance Gap Report — migration 094). Note the raw `category='starter'` marker
matches **6** rows; the extra 3 are Phase-185 UAT probes and a draft duplicate, correctly excluded
by the full filter. "Fork a starter" is already one of the four routes into the Builder
(`WorkflowBuilderPage.tsx:459`) — what is missing is a door on the **first screen**.

**SC#6 / SEED-137 — the bypass is real and verified in source.** `grounding.py:951` APPENDS the
armed spec to `phase.validators`; `run_gates` returns on the **first** failure
(`validators.py:230`); and an `ask_user` Proceed **falls through to the body** without re-running
the remaining pre-gates (`harness_engine.py:739`, comment: *"outcome is None → ask_user Proceed:
fall through and run the body"*). So one author-declared `timing="pre"` / `on_failure="ask_user"`
validator preempts the armed gate: the person is shown the wrong choices, `action_risk_pending` is
never emitted, and the step runs unapproved. This is SC#3's counterexample — "safe-by-construction"
cannot ship while a governance gate can be silently skipped.

## Requirements

1. **Layered node face**: `nodeTitle()` resolves through three tiers instead of two, inserting a
   config-derived tier between the stored name and the type sentence.
   - Current: `phaseVocabulary.ts:169` resolves `phase.name` → `PHASE_TYPE_SENTENCES[type]` → raw
     type. Tier 1 is empty on 0/57 measured phases, so the face is one of 6 sentences, always.
   - Target: `phase.name` → **config-derived sentence** → type sentence → raw type. The derived tier
     is a pure function of the step's real config in the precedence sketch 148-B established —
     folder scope → bound skill → template — computed at render and **never stored**, the same shape
     as the shipped `groundingCauseOf` derivation. It lives in `phaseVocabulary.ts`, the ONE shared
     vocabulary module, so the canvas and the vertical spine cannot disagree.
   - Acceptance: a step with a bound skill and no name renders a face naming that skill; re-binding
     the skill changes the face without any write; a step with nothing bound still renders its type
     sentence; an unknown `phase_type`, an absent `config` and a malformed `available_tools` all
     resolve without throwing (the CANVAS-01 totality contract); `?raw` source guards still show
     exactly one copy of the vocabulary.

2. **Generator-authored step names**: the NL generator writes a per-step `name`, not only a
   definition-level one.
   - Current: `AUTHORING_SYSTEM_PROMPT` (`workflow_authoring.py:88`) instructs the definition's
     `slug`, `version`, `name` and `status` plus a per-phase `slug` and `phase_index` — no per-phase
     `name`. `PhaseSpec.name` exists and is additive-optional (`harness.py:206`).
   - Target: the authoring prompt instructs a short, specific, plain-language `name` per phase,
     describing what **that** step does. The response schema is unchanged — `name` is already a
     `PhaseSpec` field, so this remains inside the `extra="forbid"` union and adds no schema surface.
   - Acceptance: a generated definition has a non-empty `name` on every phase; the emitted definition
     still passes `model_validate()` and the existing grounding-fidelity checks unchanged; the
     provider-call budget is unchanged (exactly one call on a valid first emit, exactly two on a
     first-pass `ValidationError`, never three).

3. **Seeded names demote, authored names do not**: a stored name that a config edit invalidates
   falls back to the derived tier — but only if the generator wrote it.
   - Current: no provenance is recorded and no name is ever cleared. A stored name that predates a
     config edit would silently misdescribe the step (sketch 148: *"the face now lies"*).
   - Target: an additive-optional provenance marker on `PhaseSpec` alongside `name` (JSONB, **zero
     migration**, the same shape `grounding_escalated` already uses — pre-187 rows read with it
     absent). An identity-bearing config edit (folder scope, bound skill, template, available tools)
     **clears a generator-seeded name**, so the face falls to the derived tier and resumes tracking.
     A hand-typed name is never cleared by a config edit.
   - Acceptance: re-binding the skill on a seeded step clears its name and the face changes to the
     derived sentence; performing the same edit on a hand-typed step leaves both the name and the
     face untouched; a pre-187 definition row loads with the marker absent and no validation error;
     no migration file is added.

4. **The reveal swaps the subtitle, not the title**: turning ⌥ Technical-names ON no longer destroys
   the plain title.
   - Current: `PhaseNode.tsx:144` and `PhaseSpineGraph.tsx:125` compute
     `technical ? technicalTitle(phase) : nodeTitle(phase)` — the plain title is replaced. Sketch 149
     measured the second cost: `technicalTitle` renders as `AI agent step · find-renewal-t…`, because
     the title is `truncate` at 14px in a 248px card, so **the slug clips** — the one genuinely
     technical token on the card, and the main reason to turn the reveal on.
   - Target: the plain title stays in the title slot in both states; the **subtitle**
     (`PHASE_TYPE_SUBTITLES`, `canvasModel.ts:286`) is what the reveal replaces. The declared
     `technicalLine` slot (`PhaseNodeCard.tsx:325`, reserved at `PhaseNode.tsx:183`) is **not**
     spent — it stays Phase 188's.
   - Acceptance: with the reveal ON, the card's title equals its reveal-OFF title; the full slug is
     present in the DOM with no ellipsis; `technicalLine` is still not passed; both graph views agree
     in both toggle states; the toggle remains the single app-wide `TechnicalNamesProvider` boolean
     with no second source of truth.

5. **Seed receipt**: the AI seed states what grounding it applied and why.
   - Current: nothing. Seeded steps arrive carrying a governance seal the user never requested, with
     no explanation anywhere on the canvas.
   - Target: after a draft lands, a dismissible receipt names the step count and each auto-grounded
     step **with its reason**, rendered from the server's own verdict verbatim — never re-derived
     client-side (the sketch-#16 publish-gauntlet discipline). Generation is **single-shot**
     (`workflow_authoring.py:217` — one provider call on a valid first emit), so the receipt appears
     with the whole canvas at once and must not imply node-by-node progress the surface never
     received.
   - Acceptance: seeding a workflow whose steps read the KB shows a receipt naming exactly those
     steps and no others; seeding one with zero grounded steps shows no grounded-step list rather
     than an empty or fabricated one; the receipt dismisses and does not reappear on the same draft;
     no node-by-node staging animation is rendered.

6. **Template seeds the describe box**: the first screen gains one door to the starters without
   gaining a second way to create a workflow.
   - Current: the first screen is the describe box alone (a deliberate 3-second read — decisions
     #11/#12/#13). Forking a starter requires already knowing to arrive via the Workflows page.
   - Target: one quiet line under the CTA opens a picker over the 3 curated starters; choosing one
     **fills the describe box** with its plain-language description. The forward path stays
     `describe → draft` with no exceptions. The curated definitions keep their existing direct-fork
     home on the **Workflows page**, where a library belongs per the #19 three-homes contract.
   - Acceptance: choosing a template populates the textarea and leaves the user on the describe
     screen with the CTA enabled; no path from the first screen places a definition on the canvas
     without passing through generation; the Workflows-page fork is unchanged; the first screen adds
     exactly one line at rest.

7. **An armed checkpoint is always asked**: arming an action-risk checkpoint guarantees the human is
   asked before the step body runs, whatever else the author declared.
   - Current: false. An author-declared `timing="pre"` / `on_failure="ask_user"` validator preempts
     the armed gate — `run_gates` returns the first failure (`validators.py:230`) and an `ask_user`
     Proceed falls through to the body (`harness_engine.py:739`) without re-running the remaining
     pre-gates. Fenced today only by `publish_service.py:464-503` refusing author-declared `ask_user`
     validators — a fence the ROADMAP records as slated for removal by the deferred Phase-103
     background-job publish (`publish_service.py:478-479`).
   - Target: the guarantee is a **property, not a position**: for any set of author-declared
     validators, `action_risk_armed` on a phase implies the checkpoint is asked before the body runs.
     The fix shape is a discuss-phase decision among the three candidates recorded at fold time
     (graft at index 0 / re-run remaining pre-gates after Proceed / hoist to an explicit pre-body
     checkpoint) — this spec locks the guarantee, not the mechanism.
   - Acceptance: a property test over author-declared validator sets is observed **FAILING on HEAD
     before the fix** and passing after; a live run of an armed phase carrying a `timing="pre"`
     `ask_user` validator asks the checkpoint, does not run the body on a refusal, and writes zero
     approval receipts to `harness_audit`; `test_185_engine_attachment.py:153-165` stays green, or is
     visibly re-shaped with the reasoning recorded.

## Boundaries

**In scope:**
- The config-derived tier in `phaseVocabulary.ts` and its two consumers
- A per-step `name` instruction in the NL authoring prompt
- A provenance marker on `PhaseSpec` (additive-optional, JSONB, zero migration) and the
  demote-on-config-edit rule that reads it
- The ⌥ reveal moving from the title slot to the subtitle slot, on both graph views
- The post-draft seed receipt
- A template picker that seeds the describe box on the Builder's first screen
- The armed-checkpoint precedence fix + its property test + one live confirmation

**Out of scope:**
- **Per-node review state (✦ drafted / ✓ reviewed, sketch 150-C)** — its mark occupies the card's
  left edge at `-left-2 top-1.5`, which is the server verdict mark's slot; the corners are fully
  allocated (top-right = governance seal permanently, left = transient verdict). It also opens an
  unresolved publish-gate question. Excluded at round 1.
- **Filling `technicalLine` (sketch 149-B)** — the slot is reserved for Phase 188 alongside `status`
  and `stepNumber` (`PhaseNode.tsx:183`); spending it here is a 188 scope decision this phase
  declines to make.
- **A direct template→canvas fork on the first screen (sketch 151-A/B)** — it creates a second way a
  workflow comes into existence, with different code and different failure modes.
- **Retiring the Workflows-page fork** — the curated definitions stay reachable as definitions.
- **A run surface for the armed checkpoint** — Phase 188 owns where a run lives (RUNVIZ-03). SC#6 is
  proved through the shipped chat `PendingAskCard`, the Phase-185 precedent.
- **A stale-name marker on the card** — demote-on-edit removes the need, and a new mark would hit the
  same corner-allocation problem that excluded 150-C.
- **Migrations** — every new field is additive-optional inside the `definition` JSONB.
- **A second technical-names toggle** — `TechnicalNamesProvider` stays the one app-wide boolean.

## Constraints

- **Zero migrations.** `name` is already a `PhaseSpec` field; the provenance marker is additive-
  optional JSONB exactly as `grounding_escalated` is. Pre-187 rows must load with it absent.
- **Card budget is fixed and type-enforced.** At most two badge slots — `BadgeSlots` is a max-2 tuple
  union, so a third badge is a typecheck error, not a review comment. Slot 1 is empty and belongs to
  188/189. The top-right corner is the governance seal's, permanently. **No focusable control may
  live inside the card** (the ✕ and ＋ live on the lane).
- **One vocabulary module.** The derived tier lives in `phaseVocabulary.ts`. A second copy of the
  glyph map, the parse, or the title resolution fails the `?raw` source guards in
  `PhaseSpineGraph.test.tsx` / `PhaseSpine.test.tsx`.
- **Generation is single-shot.** One provider call on a valid first emit, two on a first-pass
  `ValidationError`, never three. The receipt must not imply progress the surface never received.
- **SC#10 cross-provider — the Phase-185 method does NOT apply here.** `POST /workflows/generate`
  (`workflows.py:1292`) accepts **no per-request `model` or `provider`**;
  `generate_workflow_definition` resolves its model through `resolve_authoring_model(settings)` →
  `settings.harness_authoring_model` or the first `forced_emission`-capable registry default. So the
  roster must be driven by that **app setting**, which means rows mutate global state and **cannot
  run concurrently without contaminating each other** — unlike Phase 185's per-request rows. A crude
  parse of `MODEL_CAPABILITIES` on 2026-08-01 found 23 models across 7 provider groups (openai 7,
  anthropic 2, google 3, moonshot 1, minimax 3, zhipu 2, openrouter 5), **all** declaring
  `forced_emission: True`. **DeepSeek did not appear in that parse — confirm at plan time rather than
  assuming it is absent.** Blocked rows are recorded ⛔ with a reason, never omitted.
- **Red line D-14** — no second runtime. The generator continues to reuse `forced_emit` → the Phase
  092.5 provider gateway; it never opens the agent loop and never touches the gateway.
- **G-5 hot-file ledger.** `WorkflowBuilderPage.tsx` (1810 L) takes the template door and the receipt
  mount; `PhaseNode.tsx` takes the reveal change. Audit both at discuss-phase — the ledger already
  fires on `WorkflowCanvas.tsx` with extraction due in Phase 188.
- **The SC#5 corpus is small.** 27 well-formed definitions, 57 phases, **max 5 phases per workflow**.
  The "no two steps share a face" check is meaningful but modest at this scale — do not over-claim it.

## Acceptance Criteria

- [ ] `nodeTitle()` resolves through three tiers; the derived tier is computed at render and written
      nowhere
- [ ] Re-binding a step's skill changes its derived face with no write to the definition
- [ ] Every phase of a freshly generated definition carries a non-empty `name`
- [ ] Generation still costs exactly one provider call on a valid first emit (two on a first-pass
      `ValidationError`, never three)
- [ ] An identity-bearing config edit clears a **generator-seeded** name and leaves a **hand-typed**
      name untouched
- [ ] A pre-187 definition row loads with the provenance marker absent and no validation error
- [ ] No migration file is added by this phase
- [ ] With ⌥ Technical-names ON, the card title equals its reveal-OFF title and the full slug appears
      with no ellipsis
- [ ] `technicalLine` is still not passed to `PhaseNodeCard`
- [ ] The canvas and the vertical spine render the same title in both toggle states
- [ ] A seeded draft with grounded steps shows a receipt naming exactly those steps, with reasons,
      rendered from the server verdict verbatim
- [ ] A seeded draft with zero grounded steps shows no grounded-step list
- [ ] No node-by-node staging animation is rendered on arrival
- [ ] Choosing a template fills the describe box and leaves the user on the describe screen
- [ ] No first-screen path places a definition on the canvas without passing through generation
- [ ] **SC#5 check 1 (no jargon leak):** across the corpus — the 3 curated starters + the 4 canonical
      seed shapes (migration 061, via the `four_seed_defs()` helper) + the PM pack (Phase 104:
      project charter / weekly status report / risk register) — **zero** reveal-OFF faces contain a
      slug or a raw `phase_type` token
- [ ] **SC#5 check 2 (no over-simplification):** across that same corpus, **no two steps within one
      workflow render identical faces** (this check FAILS on HEAD today)
- [ ] **SC#6:** a property test asserting `armed(phase) ⇒ checkpoint asked before body` over
      author-declared validator sets is observed **RED on HEAD** before the fix and green after
- [ ] **SC#6:** a live run of an armed phase carrying a `timing="pre"` `ask_user` validator asks the
      checkpoint, does not run the body on a refusal, and writes zero approval receipts to
      `harness_audit`
- [ ] `test_185_engine_attachment.py:153-165` is green, or visibly re-shaped with reasoning recorded
- [ ] `?raw` source guards show exactly one copy of the vocabulary
- [ ] SC#10 roster driven by `harness_authoring_model`, rows run **serially**, blocked rows recorded
      ⛔ with reasons rather than omitted

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                                      |
|--------------------|-------|------|--------|------------------------------------------------------------|
| Goal Clarity       | 0.88  | 0.75 | ✓      | 7 requirements; scope narrowed by measurement, not guesswork |
| Boundary Clarity   | 0.82  | 0.70 | ✓      | 9 explicit exclusions, each with a reason                   |
| Constraint Clarity | 0.75  | 0.65 | ✓      | SC#10 method corrected — no per-request override exists     |
| Acceptance Criteria| 0.85  | 0.70 | ✓      | 23 pass/fail criteria; SC#5 made falsifiable over a named corpus |
| **Ambiguity**      | 0.17  | ≤0.20| ✓      |                                                             |

Status: ✓ = met minimum, ⚠ = below minimum (planner treats as assumption)

## Interview Log

| Round | Perspective | Question summary | Decision locked |
|-------|-------------|------------------|-----------------|
| 0 | Researcher | What actually ships vs. what the ROADMAP claims? | Reveal + plain-language layer both already ship; VOCAB-01 owes no wiring. Sketch 148's "10 of 119 names" **does not reproduce** — measured 0 of 57 |
| 1 | Researcher | What is VOCAB-01's real deliverable? | Layered ladder (148-C) **and** generator-authored names — they compose, not compete |
| 1 | Researcher | What does the ⌥ reveal cost now that titles are meaningful? | 149-C — swap the SUBTITLE; `technicalLine` stays Phase 188's |
| 1 | Researcher | What does VOCAB-02 add, given the path already ships? | Seed receipt only (150-B); 150-C's ✦/✓ review state excluded on the mark collision |
| 2 | Simplifier | What happens to a stored name after a config edit? | Demote on config edit — the face can never be stale |
| 2 | Boundary Keeper | Where does the curated starter definition live? | 151-C on the first screen **plus** the existing Workflows-page fork — both have a home, one forward path |
| 2 | Failure Analyst | What must SC#6 guarantee, falsifiably? | A **property** (armed ⇒ always asked), not an ordering claim; fix shape stays a discuss-phase call |
| 3 | Boundary Keeper | Does the demote fire on hand-typed names too? | Seeded names only, via an additive-optional provenance marker; zero migration |
| 3 | Boundary Keeper | What makes SC#5's "no jargon leak" falsifiable? | Two measured checks over a named corpus (3 starters + 4 canonical seeds + PM pack) |
| 3 | Failure Analyst | How is SC#6 proved without Phase 188's run surface? | Property test RED-first + one live confirm through the shipped chat `PendingAskCard` (the 185 precedent) |

**Measurements taken during this interview** (re-derived, not inherited — per the standing
"don't inherit unmeasured claims" rule):

| Claim | Source said | Measured 2026-08-01 |
|---|---|---|
| Phases carrying a `name` | 10 of 119 (sketch 148) | **0 of 57** across 27 well-formed rows (145 of 172 rows are double-encoded string fixtures) |
| Curated starters | 3 (sketch 151) | **3** ✓ (the raw `category='starter'` marker matches 6; the full filter correctly excludes 3 UAT probes/dupes) |
| ⌥ reveal already wired | fully shipped (sketch 149) | **✓** confirmed at all 5 cited sites |
| SEED-137 bypass | real (ROADMAP) | **✓** confirmed in source at all 3 cited sites |
| "4 canonical seed shapes" | acceptance bar (ROADMAP) | **✓** migration 061, `four_seed_defs()` helper |
| "PM pack" | acceptance bar (ROADMAP) | **✓** Phase 104 flagship content pack, ships as published `workflow_definitions` rows |
| `/generate` is "provider-routed" | ROADMAP flag | **partly false** — no per-request model/provider; resolves via the `harness_authoring_model` app setting |

---

*Phase: 187-business-vocabulary-ai-seeded-canvas*
*Spec created: 2026-08-01*
*Next step: /gsd:discuss-phase 187 — implementation decisions (the derived-tier sentence wording and
precedence, which of the three SEED-137 fix shapes, receipt placement and dismissal persistence,
the template picker's surface)*
