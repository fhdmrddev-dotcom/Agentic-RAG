# Phase 187: Business Vocabulary + AI-Seeded Canvas - Context

**Gathered:** 2026-08-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Every step on the canvas says what **that** step does rather than what its **type** does — the
node face gains a config-derived tier and AI-seeded names, the ⌥ reveal stops destroying that
name, the AI seed explains the grounding it silently applied, a template seeds the describe box,
and an armed action-risk checkpoint becomes impossible to preempt.

Requirements: **VOCAB-01, VOCAB-02, VOCAB-03** + **SC#6** (SEED-137, folded 2026-07-31).

### Five scouting findings that reframe the SPEC — established, do not re-derive

Verified live in source on 2026-08-01 during this discussion.

1. **The derived tier CANNOT be a pure function of the phase alone.** `folder_scope` and
   `skill_ref` store **resolved UUIDs, never names** (`backend/app/models/harness.py:88`, `:93`),
   `skill_snapshot` is `None` on drafts — which is exactly when a seeded canvas is shown — and the
   template lives on the **definition** (`assets[].filename`), not the phase. SPEC Req 1's phrase
   *"a pure function of the step's real config"* is therefore achievable only with an injected
   name-lookup context. See **D-187-05**.

2. **SPEC Req 1's precedence contradicts sketch 148-C, and the sketch is right.** `folder_scope` is
   a subset of the single `project_folder_id` (`harness.py:_folder_scope_requires_project`), so in
   practice most steps in one workflow share it. Folder-first would render them identically —
   reproducing the exact failure SC#5 check 2 exists to catch. See **D-187-04**.

3. **`POST /generate` returns no grounding verdict** — only `{ok, definition}`
   (`backend/app/api/workflows.py:1323`). SPEC Req 5's *"rendered from the server's own verdict
   verbatim"* is not satisfiable as literally written. What Phase 185 shipped instead is
   `kb_tools` served from the server (`workflows.py:745`) with `groundingCauseOf` declared **"THE
   ONE CLIENT GROUNDING DERIVATION"** over it. See **D-187-08**.

4. **`harness_authoring_model` is env-only.** It exists solely as a pydantic field
   (`backend/app/config.py:1164`). Grep over `backend/app`, `frontend/src` and
   `supabase/migrations` returns **2 non-cache hits** — no Settings UI, no `app_settings` row, no
   `load_app_settings` sync. SPEC's SC#10 instruction to *"drive the roster by that app setting"*
   describes a knob that does not exist. Same defect class as open bug `BUG-260731-01`. See
   **D-187-13**.

5. **Prepending the armed spec would silently rebind the author's retry bound.** The engine seeds
   `phase_max_retries` **and** the `on_failure` routing from `validators[0]` (WR-03), and
   `backend/tests/unit/test_185_engine_attachment.py:153-165` asserts
   `eff.validators[0].max_retries == 7` survives. Fix shape **A** would make it `0`. This is a
   measured defect in A beyond the ordering objection the ROADMAP recorded. See **D-187-01**.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**7 requirements are locked.** See `187-SPEC.md` for full requirements, boundaries, and
acceptance criteria (23 pass/fail criteria; ambiguity 0.17).

Downstream agents MUST read `187-SPEC.md` before planning or implementing. Requirements are not
duplicated here.

**In scope (from SPEC.md):**
- The config-derived tier in `phaseVocabulary.ts` and its two consumers
- A per-step `name` instruction in the NL authoring prompt
- A provenance marker on `PhaseSpec` (additive-optional, JSONB, zero migration) and the
  demote-on-config-edit rule that reads it
- The ⌥ reveal moving from the title slot to the subtitle slot, on both graph views
- The post-draft seed receipt
- A template picker that seeds the describe box on the Builder's first screen
- The armed-checkpoint precedence fix + its property test + one live confirmation

**Out of scope (from SPEC.md):**
- Per-node review state (✦ drafted / ✓ reviewed, sketch 150-C) — mark collision at `-left-2 top-1.5`
- Filling `technicalLine` (sketch 149-B) — reserved for Phase 188
- A direct template→canvas fork on the first screen (sketch 151-A/B) — a second forward path
- Retiring the Workflows-page fork
- A run surface for the armed checkpoint — Phase 188 owns RUNVIZ-03
- A stale-name marker on the card
- Migrations
- A second technical-names toggle

**AMENDED BY THIS DISCUSSION — three corrections to SPEC.md, each recorded in the open:**
- **Req 1's precedence order is overridden** by D-187-04 (drafting slip, not a decision).
- **Req 1's "pure function of the step's real config" is widened** by D-187-05 to a pure function
  of *(phase, injected name context)* — purity preserved, inputs made explicit.
- **Req 5's "never re-derived client-side"** is read as *"never invent a reason string
  client-side"* per D-187-08; the shipped one-home derivation is reused.

**ADDED BY THIS DISCUSSION:** the `BUG-260731-03` verdict half (D-187-11), which D-186-14 routed
to this phase and the SPEC omitted.

</spec_lock>

<decisions>
## Implementation Decisions

### SC#6 — the armed action-risk checkpoint (SEED-137)

- **D-187-01 — Fix shape C: an explicit pre-body checkpoint.** Hoist the armed check **out of the
  validator list** into an explicit engine checkpoint keyed on `phase.action_risk_armed`. This is
  the only one of the three candidates where *"armed ⇒ asked"* is a **property of the phase**
  rather than a position in a list — which is what SPEC Req 7 locks (*"the guarantee is a
  property, not a position"*). **A is rejected on measured grounds**, not only the ROADMAP's
  ordering objection: prepending makes `validators[0]` the armed spec, and the engine seeds
  `phase_max_retries` + `on_failure` from `validators[0]` (WR-03), so the author's
  `max_retries: 7` silently becomes `0` — the exact assertion at
  `test_185_engine_attachment.py:157`. A also skips the author's own pre-gate entirely on Proceed.
  **B is rejected** as still positional (it holds only because the armed spec is appended last)
  and because it changes control flow on a path shared with non-armed workflows.
  **D-185-05's append stays untouched**, so `test_185_engine_attachment.py:153-165` stays green
  as-is rather than being re-shaped.

- **D-187-02 — The checkpoint fires AFTER pre-gates resolve, immediately before the body.**
  Pre-gates run and route exactly as today (`fail_run` / `skip_to_phase` / `ask_user`); the armed
  checkpoint fires only if control actually reaches the body. Rationale: a step an author's gate
  **skips** never runs, so approving it would be approving something that will not happen — and a
  `harness_audit` approval receipt would exist for a step with no body, which is the
  consequence ≠ receipt rule violated. **Known and accepted cost:** an author `ask_user` Proceed
  followed by the armed checkpoint means two prompts in a row. That is honest, not a defect.

- **D-187-03 — `grounding.py` stops appending the `action_risk_approval` ValidatorSpec.** The
  checkpoint calls `_approval_sentence()` directly. Consequences, all wanted:
  - **No double-gate** and no resolved-marker mechanism to build.
  - The engine's `_is_action_risk_finding` **string-prefix sniff on an error message
    (`harness_engine.py:931`) is deleted** — the armed reading becomes `phase.action_risk_armed`,
    a boolean on the phase. **Exactly ONE reading of "this phase is armed" must survive.**
  - `validator_index` arithmetic returns to its pre-185 shape; T-185-03-03's accepted doubled
    gate row **disappears** rather than needing new accounting.
  - The `citations_required` gate at `grounding.py:940` is **`timing="post"` and stays exactly as
    it is** — it is not reachable by this hazard. Confirm rather than assume at plan time.
  - `ValidatorSpec.kind`'s `"action_risk_approval"` literal (`harness.py`) may become unused;
    decide deliberately whether to keep it (pre-187 rows that named it must still validate) —
    **do not remove a Literal member without checking stored rows.**

### The derived node face (VOCAB-01 / Req 1, 3, 4)

- **D-187-04 — Precedence is sketch 148-C's, NOT SPEC Req 1's.** Resolution order, first hit wins:
  **bound skill → template → folder scope → human input → null**. SPEC Req 1's *"folder scope →
  bound skill → template"* is recorded as a **drafting slip and is overridden**. Reason:
  `folder_scope` is a subset of the single `project_folder_id`, so most steps in one workflow
  share it; folder-first collapses distinct steps back into identical faces, defeating SC#5
  check 2 — the phase's own falsifiable bar. Most-specific-first is the rule.

- **D-187-05 — The derivation takes an injected name-lookup context, exactly like `kbTools`.**
  `nodeTitle()` gains a second **optional** parameter carrying the folder id→name map, the skill
  id→name map, and the definition's template filename. **Absent or empty ⇒ fall through to the
  type sentence — never a fabricated name and never an id-shaped one.** This is the shipped
  D-185-09 precedent verbatim: `toCanvas` stays **PURE** (D-183-12), fetches nothing, hardcodes
  nothing, and every existing caller that omits the parameter renders byte-identically to today.
  The maps already exist — `PhaseFormPanel.tsx:126-128` (`folderNames` / `skillNames`, Phase
  103-ux). The template filename comes from `definition.assets[]` where `kind == "template"`.

- **D-187-06 — The type subtitle ALWAYS stays.** The title says what *this* step does; the
  subtitle says what *kind* of step it is ("Searches and decides its own next move" tells you it
  is agentic, which a derived title never does). One rule, no render-time conditional, and Req 4's
  subtitle-swap always has something to swap. **Measured redundancy is confined to two types** —
  `llm_human_input` ("Wait for your approval" / "Pauses here until you answer") and `llm_emit`
  ("Fill Renewal Summary.pptx" / "Fills your template and produces the file"). Recorded as an
  accepted cost. Rejected: suppressing the subtitle when the derived tier resolved — it makes card
  height depend on which tier won, and makes the reveal *add* a line rather than swap one.

- **D-187-07 — Demote fires on exactly the fields the derived tier READS.** `skill_ref`, the
  template asset, `folder_scope`, `available_tools` — the SPEC's list, but **justified rather than
  enumerated**: a config edit clears a generator-seeded name precisely when it could change the
  derived face. This stays correct automatically if the derivation later gains a field. `prompt`,
  `model`, `max_steps`, `wall_clock_seconds`, `temperature` leave the name untouched. A
  **hand-typed** name is never cleared by any config edit (SPEC Req 3).

### The seed receipt (VOCAB-02 / Req 5)

- **D-187-08 — The reason comes from the shipped `groundingCauseOf` over server `kb_tools`.** Reuse
  the one client derivation Phase 185 built for exactly this question. The safety-**defining**
  input is the server's and has one home (`workflows.py:745` → `bundle.kb_tools` →
  `WorkflowBuilderPage.tsx:873`); the client only renders it. SPEC Req 5's *"never re-derived
  client-side"* is read as **"never invent a REASON STRING client-side"** — which this honours,
  because the reason names the actual intersecting tool (`search_documents`). **Rejected:** adding
  a grounding verdict to the `/generate` response — it would create a second server statement of a
  fact the canvas already derives one way, they can drift, and it is exactly the second-source-of-
  truth D-182-06 forbids.

- **D-187-09 — Above the canvas; dismissal is in-memory, per draft.** Sketch 150-B's placement.
  Dismissed state lives in component state keyed to the draft, so it does not reappear while you
  work (Req 5's acceptance) and a fresh generation gets a fresh receipt. **A page reload re-shows
  it, and that is correct** — the grounding it describes is still true and nothing was persisted.
  No storage key to go stale, nothing to clean up. Rejected: persisting per draft id — a seeded
  draft is **not persisted at generation time**, so there may be no id to key on until the first
  save.

- **D-187-10 — With ZERO auto-grounded steps the receipt still appears, minus the grounded list.**
  *"Here's what I built — 5 steps … Nothing is saved or published yet."* The orientation half and
  the not-yet-committed half are useful regardless; only the grounding paragraph and the step list
  are conditional. Satisfies Req 5's *"no grounded-step list rather than an empty or fabricated
  one"* while keeping **one component with one arrival behaviour**.

### Scope: the folded bug half, the deferred hole, and SC#10

- **D-187-11 — FOLD `BUG-260731-03`'s verdict half: one new `incomplete` verdict in `/validate`.**
  A phase whose `available_tools` intersects the KB tools **while the definition has no
  `project_folder_id`** earns a deterministic `severity: "incomplete"` verdict. `/validate` already
  aggregates the full static gauntlet including `grounding_verdicts` on every canvas edit and
  already carries the `incomplete` severity (`api/workflows.py:322`, `:562-567`) — this is **one
  check on an existing seam, not new machinery**, and it lands on the same tool-intersection
  reading the derived tier and the receipt already use. It is SC#3's counterexample: safe-by-
  construction cannot ship while an unbound retrieval workflow reaches a golden run unchallenged.
  **`BUG-260731-03` frontmatter must be updated at the plan-phase touchpoint** — this closes the
  half 186 did not, and the report may flip to `closed` only when BOTH halves verify.

- **D-187-12 — The armed-phase golden-run hole is DEFERRED with a concrete trigger, not folded.**
  Verified: `_interactive_phase_failures` reads the **raw** definition
  (`publish_service.py:196`, `:518`), while `effective_phase` is applied at run time at a single
  call site (`harness_engine.py:1339`) that the golden run also goes through. So an armed phase
  publishes past the pre-run interactive fence and its checkpoint fires inside the synchronous
  golden run with **no subscriber**. **This is unchanged by D-187-01** — armed phases were never
  caught by that fence. See `<deferred>` for the trigger.

- **D-187-13 — SC#10 = automated per-provider generation tests + ONE live restart row.** Because
  `harness_authoring_model` is env-only (finding 4), the SPEC's app-setting-driven roster is not
  reachable. Instead:
  - **All 8 roster rows** (the full native 7 + OpenRouter, derived from `MODEL_CAPABILITIES` by
    grouping on `provider`, never re-typed) are covered by a backend test that
    **monkeypatches `settings.harness_authoring_model` per row**, makes a **real `forced_emit`
    call**, and asserts a valid `WorkflowDefinition` with a non-empty `name` on **every** phase.
    Serial by construction, no global mutation, no contamination between rows.
  - **ONE live row** driven by restarting the backend with `HARNESS_AUTHORING_MODEL` set, to prove
    the env path actually reaches `resolve_authoring_model`.
  - **Blocked rows are recorded ⛔ with the reason and blocking id — never omitted.**
  - **Confirm at plan time whether DeepSeek appears in `MODEL_CAPABILITIES`** (the SPEC's crude
    2026-08-01 parse did not find it) rather than assuming its absence.

- **D-187-14 — G-5 on `WorkflowBuilderPage.tsx` (1810 L) is honoured BY CONSTRUCTION.** The seed
  receipt and the template picker **each land as their own component file**; the page gains one
  gated mount line per surface and nothing else. This is the shape CLAUDE.md's hot-file ledger
  explicitly praises from Phase 185 (*"only 4 insertions reach the render body … keep this
  shape"*). No refactor phase is inserted. **The measured `git diff --stat` on
  `WorkflowBuilderPage.tsx` is a phase gate** — if the render body grows beyond a handful of
  insertions, the surface belongs in its own component, not the page.

### Post-research amendments (operator-decided 2026-08-02, at the plan-phase touchpoint)

Four measured findings in `187-RESEARCH.md` contradicted locked SPEC/CONTEXT text. Each was put to
the operator and decided in the open. **These override the text they name.**

- **D-187-15 — SC#5 check 2 is NARROWED to "no two steps with materially different config render
  identical faces."** Measured: `four_seed_defs()`'s `plan_execute_verify` seed
  (`backend/tests/conftest.py:867-890`) has two bare `llm_single` steps — `plan` and `verify` —
  whose only differing field is `prompt`. The D-187-04 tier reads none of that, so both resolve to
  `null` and both render `"Write it up"`; and because they are migration-061 seeds rather than
  generator-authored, Req 2 can never fill their `name` either. Two genuinely identical configs
  rendering identically is an **honest statement, not a defect**. `plan_execute_verify` is recorded
  as the documented exception **with its measured shape** in the corpus test. **Rejected:** a
  prompt-derived tier (violates D-187-05's never-fabricate floor — a prompt is not a name); editing
  the seed fixture to fit the test (the acceptance bar would stop measuring the real corpus).

- **D-187-16 — "Face" = the string `nodeTitle()` returns (plus the canvas card's subtitle), and the
  spine gets the TITLE agreement only.** Measured: `PhaseSpineGraph` has **no subtitle slot** — its
  second line is a raw `phase_index` (`:187-189`) and `:184` prints the raw `phase_type` in a mono
  chip **unconditionally**, reveal-OFF included, as does the `aria-label` at `:164`. So Req 4's
  "both graph views agree in both toggle states" is satisfied on the **title**, which is what the
  SPEC's own acceptance criterion says. The canvas gets the subtitle swap; **the spine simply stops
  swapping its title.** The asymmetry is recorded, not designed away. SC#5 check 1 is tested as a
  **pure-function assertion over the corpus**, not a DOM scrape — otherwise it fails 100% on the
  spine's pre-existing chrome and could only pass by deleting shipped UI. **Rejected:** adding a
  `PHASE_TYPE_SUBTITLES` consumer to the spine, and stripping the spine's raw chrome — both grow
  scope into a second component's layout for no Req-4 gain.

- **D-187-17 — The armed checkpoint fires BEFORE the `while True:` retry loop.** The body sits at
  `harness_engine.py:747` inside the loop at `:743`; neither SPEC nor CONTEXT settled the side.
  **Before** = one prompt per phase execution, matching the once-per-phase pre-gate pass. A retry
  after a failed attempt does **not** re-ask. **Rejected:** inside the loop — a 3-retry phase would
  ask a person three times for one step.

- **D-187-18 — The `validator_ask_user_approved` receipt writes `validator: null` for a hoisted
  checkpoint.** After the hoist there is no validator index, and saying so is honest. Existing rows
  keep their ints; the key stays present so readers see one shape per `event_type`. **This is a
  deliberate governance-ledger shape change and must be stated in the plan, not discovered.**
  Note the hard constraint from research: `harness_audit.event_type` is a **closed CHECK of 23
  values** — the checkpoint MUST reuse `action_risk_pending` + `validator_ask_user_approved`
  (metadata is free; a new event_type would need a migration and this phase ships zero).
  **Rejected:** omitting the key for armed rows (two shapes for one event type).

### Corrections research forced on the decisions above (planner MUST honour)

- **D-187-03's "exactly ONE reading of armed" cannot hold as stated.** `_is_armed_action_risk`
  (`harness_engine.py:2148`) is already a **second** phase-level armed reading. The decision's
  intent survives — delete the `_is_action_risk_finding` string-prefix sniff on an error message —
  but the plan must reconcile with `:2148` rather than claim a uniqueness it cannot deliver.
- **`is_action_risk` must be a PARAMETER of `_resolve_failure_with_ask_user`, not a
  `phase.action_risk_armed` read inside it.** That function serves both the armed checkpoint and
  the author's own `ask_user` gates on the same phase (its shipped docblock at `:934-939` says
  why). A phase read there would hand an unrelated freshness gate the indefinite wait, the shutdown
  escape and the exact-match allow-list.
- **A fail-open lurks in the hoist (same class as Phase 185's BLOCKER T-185-04-01).**
  `_resolve_failure_with_ask_user:979` resolves the disposition from `phase.validators[failed_idx]`.
  With no armed spec in the list, `failed_idx` is `None` and an author's `fail_run` routing could
  send the checkpoint to `_route_on_failure` — **the person is never asked.** The disposition
  resolution must be short-circuited when `is_action_risk`.
- **D-187-03's "T-185-03-03's doubled gate row disappears" is REFUTED.** That row is the
  `citations_required` doubling (`185-03-PLAN.md:364`), which this phase leaves in place.
- **The SPEC's `MODEL_CAPABILITIES` parse is REFUTED on four counts.** Measured: **61 models /
  8 provider groups**; **DeepSeek IS present** (`deepseek-v4-flash`, `deepseek-v4-pro`); 5 models
  declare no `forced_emission` (moonshot, `emit_tier: coerce`); **all 8 provider keys are configured
  locally ⇒ zero ⛔ rows expected.** Derive the roster by importing the registry, never by grep.
- **Project memory's "~14-17 frontend vitest failures" is REFUTED.** Measured **42–49 across 11
  files, flaky at the same commit**; `WorkflowCanvas.test.tsx` and `PublishGauntlet.test.tsx` are
  **100% green in isolation**. Gate on the two isolated named sets per `187-VALIDATION.md` — never
  on the full frontend suite.
- **`ValidatorSpec.kind`'s `"action_risk_approval"` Literal: KEEP it.** Live DB measured — 0 stored
  rows name it, so removal is technically safe on this DB, but Literal sets grow additively and an
  existing member's spelling never changes (`harness.py:10-21`).
- **SC#10 needs no monkeypatch.** `generate_workflow_definition` takes `settings` as a **parameter**
  (`workflow_authoring.py:222`), so each roster row passes a stub — zero global mutation.
- **`vitest` is 4.1.0 — `--reporter=basic` no longer exists** and fails with `Failed to load url
  basic`. Use the default reporter or `--reporter=json --outputFile=…`.
- **D-187-11 placement:** put the new `incomplete` check in the `/validate` route's own code
  (`_ROUTE_ASSIGNED_CODES`), **not** in `grounding.grounding_verdicts` — the latter is shared with
  publish (182-06 made publish enforcing), so a check added there silently becomes a **publish
  blocker** as well as a canvas verdict.

### Claude's Discretion

- Whether the seed receipt also appears on the `autoDraft` hand-off path
  (`WorkflowBuilderPage.tsx:1202-1216`, the Phase-124 "Describe & run" door). Recommended **yes** —
  it is a genuine AI seed — but state it in the plan so it is not discovered in UAT.
- How many of the six `nodeTitle()` call sites receive the name context. Floor: canvas + spine
  (SPEC's bar). `ProblemsTray` and both `WorkflowBuilderPage` announcement sites are cheap and
  prevent a screen-reader/tray disagreement. `definitionOps.canRemovePhase` needs a signature
  widening — decide deliberately.
- The exact derived sentence templates (`"Run the <skill>"` / `"Fill <template>"` /
  `"Search <folder>"`) — the precedence and the never-fabricate floor are locked by D-187-04 /
  D-187-05; the phrasing is not.
- The provenance marker's field name and spelling on `PhaseSpec` — hard constraints only:
  additive-optional, JSONB, zero migration, pre-187 rows read with it absent (the
  `grounding_escalated` shape).
- The receipt's exact copy, bounded by sketch 150-B's four load-bearing properties (per-step with
  its cause; states the one-way rule plainly; dismissible; ends with nothing-committed) and the
  one-time seal arrival pulse.
- **The template picker's surface** (popover vs dialog vs inline sheet) and the exact sentence that
  seeds the describe box. Bounded by: sketch 151-C is the locked shape (**seeds the box, never
  forks to canvas**); the `initialDescribe` seam already exists (`WorkflowBuilderPage.tsx`, Phase
  124 CR-01) so the picker only needs to set that text; **a starter is identified by its phase
  SPINE, never one phase-type glyph** (icon-convention §4, finding #36); exactly one line at rest
  on the first screen.
- The per-step `name` wording in `AUTHORING_SYSTEM_PROMPT` (`workflow_authoring.py:88`).
- Whether `ValidatorSpec.kind`'s now-possibly-unused `"action_risk_approval"` literal is retained
  — hard constraint: any stored row naming it must still `model_validate()`.

### Folded Bugs

- **`BUG-260731-03`** (severity `blocking`, status `folded`, `folded_into: "186 (control) / 187
  (verdict)"`) — **the verdict half is folded here** per D-187-11. Path:
  `.planning/reported-bugs/BUG-260731-03-no-ui-to-rebind-workflow-knowledge-base.md`. Its
  `re_open_trigger` requires BOTH halves verified before `closed`: an author can re-bind from all
  three creation paths (shipped in 186-08) **AND** an unbound retrieval workflow is caught
  deterministically on the canvas before a golden run is spent (this phase).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked requirements
- `.planning/phases/187-business-vocabulary-ai-seeded-canvas/187-SPEC.md` — **Locked requirements
  — MUST read before planning.** 7 requirements, 9 explicit exclusions, 23 acceptance criteria.
  Note the three amendments recorded in `<spec_lock>` above (Req 1 precedence, Req 1 purity,
  Req 5 verdict source) and the one addition (D-187-11).

### The folded bug
- `.planning/reported-bugs/BUG-260731-03-no-ui-to-rebind-workflow-knowledge-base.md` — the full
  investigation. Read §"Suggested fix direction" and §3 (three entry points). The second same-day
  update — **the judge PASSED a worse deliverable than it failed** (11 files / 5+ folders vs
  3 files / 3 folders) — is why a deterministic check matters and a probabilistic hard-wall is not
  a control for this failure mode.

### Sketch findings (G-2 satisfied — read the SKILL, do not paraphrase the MANIFEST)
- `Skill("sketch-findings-agentic-rag")` → `references/node-vocabulary-and-reveal.md` — sketches
  148-C / 149-C: the layered ladder, the derivation table, and the measured truncation finding
  (`technicalTitle` clips the slug at 14px in a 248px card). ⚠ **Its "10 of 119 names" figure is
  REFUTED** — the SPEC measured 0 of 57.
- `references/ai-seed-and-templates.md` — sketches 150-B / 151-C: the seed receipt's four
  load-bearing properties, why single-shot generation forbids a staged reveal, the three-starters
  measurement, and why C collapses to one forward path.
- `references/icon-convention.md` **§4** — **the canvas glyph vocabulary. Read before drawing any
  canvas mark.** `⛨ 🔒 ⤳ ＋ ✕ ↶ ↷ ◆` with source lines; the word-badge carries NO glyph; there is
  NO category-icon vocabulary — a workflow is its **spine** (#36); `✦`/`✓` are unshipped proposals.
- `references/graded-governance.md` — Phase 185's seal, the one-way lock, and `groundingCauseOf`.

### The vocabulary module (one home)
- `frontend/src/components/workflows/phaseVocabulary.ts` — `:120-135` `PHASE_TYPE_SENTENCES`,
  `:137` `PHASE_TYPE_SUBTITLES`, `:150` `PHASE_TYPE_LABELS`, `:169` `nodeTitle()`, `:180`
  `technicalTitle()`, and the Phase 185 `groundingCauseOf` section below them.
  ⚠ **`:118-123`'s docblock still claims "Only 10 of 119 live phases carry a real `phase.name`" —
  a figure the SPEC refuted (0 of 57). Correct it in the same edit.**
- `frontend/src/components/workflows/canvasModel.ts:278-291` (`buildPhaseData`), `:295-317`
  (the PURE projection docblock + `ToCanvasOptions.kbTools` — **the exact precedent D-187-05
  copies**), `:62` `CANVAS_LAYOUT`.
- `frontend/src/components/workflows/PhaseNode.tsx:144` (the title swap Req 4 moves), `:183` (the
  reserved `technicalLine` slot — **stays Phase 188's**), `:238` (`⤳`).
- `frontend/src/components/workflows/PhaseSpineGraph.tsx:125` — the SAME swap; both views must
  agree in both toggle states.
- `frontend/src/components/workflows/PhaseNodeCard.tsx:325` (`technicalLine`), `:440` (`⛨`) —
  and its docblock's two hard invariants: **a third badge is a typecheck error**
  (`BadgeSlots` is a max-2 tuple union), **no focusable control may live inside the card**.
- `frontend/src/components/workflows/PhaseFormPanel.tsx:121-128` — `folderName` / `folderNames` /
  `skillNames` (the id→name maps D-187-05 injects), `:370-400` `FolderScopeField`, `:726-728`
  the `skill_ref` → name resolution already shipped.
- Source guards: `PhaseSpineGraph.test.tsx` / `PhaseSpine.test.tsx` `?raw` checks — **exactly one
  copy of the vocabulary** must survive.

### The armed-checkpoint seam (SC#6)
- `backend/app/services/harness/grounding.py:877-965` — `effective_phase`, the **D-185-05 append
  docblock** (`:895-915`: why appending is structural), the armed spec at `:918-933` (**the append
  D-187-03 removes**), the `citations_required` append at `:936-951` (**`timing="post"` — stays**).
- `backend/app/services/harness_engine.py:690-740` — the pre-gate block, the
  `_is_action_risk_finding` branch and its `action_risk_pending` audit + emit, the
  `_resolve_failure_with_ask_user` call, and **`:739` `"outcome is None → ask_user Proceed: fall
  through and run the body"` — the bypass itself**. `:931-942` `_is_action_risk_finding` (**the
  string-prefix sniff D-187-03 deletes**). `:1336-1339` — the ONE `effective_phase` call site.
- `backend/app/services/harness/validators.py:215-245` — `run_gates`, the `timing` filter, the
  full-list `idx` invariant, and **`:230` first-failure-wins**.
- `backend/tests/unit/test_185_engine_attachment.py:140-165` — **the APPEND + WR-03 retry-seed
  proof.** Must stay green, or be visibly re-shaped with reasoning recorded (ROADMAP threat-model
  item). This is the test that measures why fix shape A is wrong.
- `backend/app/models/harness.py:200-235` — `PhaseSpec` (`name`, `grounding_escalated`,
  `action_risk_armed`) and the **additive-optional / zero-migration docblock the provenance marker
  must copy**; `:172-199` `ValidatorSpec` and its `kind` Literal.

### Generation, validate, and publish
- `backend/app/services/workflow_authoring.py:88` (`AUTHORING_SYSTEM_PROMPT` — the per-step `name`
  instruction Req 2 adds), `:92-114` (`resolve_authoring_model` — **env-only**), `:217-260`
  (`generate_workflow_definition`, the single-shot budget).
- `backend/app/api/workflows.py:1288-1323` — the `/generate` route (**returns `{ok, definition}`
  only — no verdict**); `:316-330` the `ValidateVerdict` envelope and the `incomplete` severity;
  `:547-580` the `/validate` route docblock (**the four aggregated checks D-187-11 extends**);
  `:402`, `:745` `kb_tools`.
- `backend/app/services/harness/publish_service.py:196` + `:500-540` —
  `_interactive_phase_failures`, which reads the **raw** definition (the D-187-12 hole);
  `:464-503` the author-declared `ask_user` fence, **slated for removal by the deferred Phase-103
  background-job publish** (`:478-479`).
- `backend/app/db/workflows.py:291` — `list_starter_workflows` (the **3** curated starters).
- `frontend/src/pages/WorkflowBuilderPage.tsx:11` (the `empty → composing → drafted` machine),
  `:440-520` (the four routes + **`initialDescribe` / `autoDraft`, the seam the template picker
  reuses**), `:459` (fork a starter), `:861-889` (`kbTools` / `gatesFor` / `rails`), `:1523`
  (the canvas `kbTools` prop).

### Prior-phase context that binds this phase
- `.planning/phases/186-concurrency-autosave/186-CONTEXT.md` — **D-186-14** (the split routing that
  owes 187 the verdict half), **D-186-15/16** (the promoted KB chip + invitation-never-verdict),
  **D-186-17** (an editable `folder_scope` on an unbound workflow raises a raw 422, which under
  D-186-04's hold-the-write rule produces a permanently-unsaveable draft — **carry forward**).
- `.planning/phases/185-graded-governance-per-node-grounding-mode-action-risk-dial/185-CONTEXT.md`
  — D-185-05 / D-185-09 / D-185-12, the seal's corner claim, and the honest-refusal vocabulary.
- `.planning/ROADMAP.md` §"Phase 187" — the goal, SC#1-6, the flags line, and the **SEED-137
  scoping note written at fold time** (the three candidate fix shapes A/B/C with their costs).

### Project rules that bind this phase
- `CLAUDE.md` §"Workflow guardrails" — **G-2** (satisfied: sketches 148-151 wrapped up),
  **G-4** (lived-experience UAT: wire format + screenshot insufficient), **G-5** (hot-file ledger
  — `WorkflowCanvas.tsx` fires with extraction due in Phase 188; `PhaseNodeCard.tsx` invariants),
  **G-6** (failure criteria upfront — SPEC §"How we'd know this failed" equivalent).
- `CLAUDE.md` §"UAT scoreboard recipe" — the **full native roster + OpenRouter (8 rows)**, derive
  from `MODEL_CAPABILITIES` never re-type, and **"blocked, never silently omitted"**.
- `CLAUDE.md` §"Reported bugs cross-check" — the `plan-phase` touchpoint requires every report with
  `folded_into: 187` to be covered by at least one plan task.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`ToCanvasOptions.kbTools` (`canvasModel.ts:295-317`)** — the exact precedent D-187-05 copies:
  an external, safety-relevant lookup passed **in** with a safe default, keeping the projection
  pure. Its docblock even states the safe direction out loud ("an unread palette marks NOTHING
  rather than un-marking something"). The name-lookup context should read the same way.
- **`folderNames` / `skillNames` id→name maps (`PhaseFormPanel.tsx:126-128`, Phase 103-ux)** — the
  resolution D-187-05 needs already exists and is already threaded to a sibling surface. Reuse the
  same source rather than fetching again.
- **`groundingCauseOf` (`phaseVocabulary.ts`, Phase 185)** — declared "THE ONE CLIENT GROUNDING
  DERIVATION". The receipt becomes its **second** consumer, not a second derivation.
- **`initialDescribe` / `autoDraft` (`WorkflowBuilderPage.tsx`, Phase 124 CR-01)** — a describe-box
  seeding seam that already exists. Req 6's template picker sets this text; it does not need a new
  channel.
- **`grounding_verdicts` inside `/validate` (`api/workflows.py:562-567`)** — the seam D-187-11's
  new `incomplete` check joins. Already runs on every canvas edit, already static/no-provider.
- **`grounding_escalated` on `PhaseSpec` (`harness.py:234`)** — the exact additive-optional,
  zero-migration shape the provenance marker copies, with its own docblock explaining why.

### Established Patterns
- **One home per rule.** `phaseVocabulary.ts` is the ONE vocabulary module and `?raw` source guards
  enforce it; `grounding.py` is the ONE grounding home server-side (D-182-06). A second copy of the
  title resolution, the glyph map, or a grounding rule fails a shipped test.
- **Derive, never store.** `groundingCauseOf`, `grounding_cause`, and now the derived tier are all
  computed at read time specifically so a stale or hand-edited JSONB row cannot lie. The
  `PhaseSpec` docblock (`harness.py:213-230`) explains why a `model_validator` would bake the
  derivation into the JSONB and break this permanently.
- **Invitation ≠ verdict (D-184-15 / D-182-06).** The client may state a neutral fact about
  configuration; the **server** owns every verdict. D-187-11 puts the unbound-retrieval verdict on
  the server side of that line, which is why it belongs in `/validate` and not on the chip.
- **Honest refusal / consequence ≠ receipt (Phase 185).** D-187-02's placement choice is this rule:
  no approval receipt may exist for a step that never ran.
- **Additive-optional, zero-migration JSONB.** Every new field in this phase rides it.
- **Red line D-14.** No second runtime; the generator keeps using `forced_emit` → the Phase 092.5
  gateway and never opens the agent loop.

### Integration Points
- `phaseVocabulary.nodeTitle()` — gains the derived tier + the injected name context; both graph
  views consume it.
- `canvasModel.buildPhaseData` / `toCanvas` — threads the name context through, mirroring `kbTools`.
- `PhaseNode.tsx:144` + `PhaseSpineGraph.tsx:125` — the reveal moves from the title slot to the
  subtitle slot on **both**.
- `harness_engine.py` pre-gate block — gains the explicit armed checkpoint; `grounding.py` loses
  the armed append; `_is_action_risk_finding` is deleted.
- `api/workflows.py` `/validate` — gains the unbound-retrieval `incomplete` verdict.
- `workflow_authoring.py:88` — the authoring prompt gains a per-step `name` instruction; the
  response schema is unchanged (`PhaseSpec.name` already exists inside the `extra="forbid"` union).
- `WorkflowBuilderPage.tsx` — **two mount lines only** (D-187-14): the receipt component and the
  template-picker component.

</code_context>

<specifics>
## Specific Ideas

- **"Most-specific-first" is the whole argument for the precedence.** A bound skill states what
  *this* step does; a folder is usually the workflow's. Any future tier is inserted by that test,
  not by taste.
- **Never fabricate a name.** When the name context is absent or a lookup misses, fall through to
  the type sentence. An id-shaped face is worse than a generic one.
- **Exactly one reading of "this phase is armed" must survive D-187-03** — `phase.action_risk_armed`,
  a boolean, replacing a string-prefix sniff on an error message.
- **The receipt reappearing on reload is correct, not a bug.** The grounding it describes is still
  true and nothing was persisted; a storage key that outlives its draft is the worse failure.
- **A workflow is its SPINE, never one glyph** (icon-convention §4 / finding #36) — binding on the
  template picker's rows and chips.
- **`technicalLine` stays Phase 188's.** Req 4 is satisfied by swapping the subtitle; spending the
  reserved slot is a 188 scope decision this phase declines to make.
- **Rows may be blocked, never silently omitted** — applies to D-187-13's 8-row scoreboard.

</specifics>

<deferred>
## Deferred Ideas

- **The armed-phase / synchronous-publish hole (D-187-12).** `_interactive_phase_failures` reads
  the raw definition, so an armed phase publishes past the pre-run interactive fence and its
  checkpoint fires inside the golden run with no subscriber. **Re-open trigger:** whichever phase
  makes publish a background job (the deferred Phase-103 rework named at
  `publish_service.py:478-479`), **or** the first time an armed workflow is published and its
  golden run wedges. Cheap fix when it lands: add `action_risk_armed` to
  `_interactive_phase_failures`, which `/validate` then picks up for free.

- **Per-node review state (✦ drafted / ✓ reviewed, sketch 150-C).** Excluded by SPEC. Owes two
  things before it can ship: a **placement** (its mark sits at `-left-2 top-1.5`, the transient
  server-verdict mark's coordinates; the card's corners are fully allocated) and a **meaning at
  publish** (decorative, or a soft publish gate the 8-stage gauntlet has opinions about).
  **Re-open trigger:** Phase 188's run state lands on these same nodes — decide the corner
  allocation there, or when a user asks "which of these did I actually check?".

- **Filling `technicalLine` (sketch 149-B).** Reserved at `PhaseNode.tsx:183` alongside `status`
  and `stepNumber`. **Re-open trigger:** Phase 188 scoping — it is 188's slot to spend.

- **A direct template → canvas fork on the Builder's first screen (sketch 151-A/B).** Creates a
  second way a workflow comes into existence, with different code and different failure modes. The
  curated fork keeps its home on the **Workflows page** per the #19 three-homes contract.
  **Re-open trigger:** evidence that re-deriving a starter from its sentence loses something users
  notice — sketch 151 already records this as C's honest cost.

- **Making `harness_authoring_model` a real dynamic setting** (Settings UI + `app_settings` row +
  `load_app_settings` sync). Would make SC#10's roster driveable at runtime and closes the same
  defect class as open bug `BUG-260731-01` (the judge-model knob). Out of scope here — a settings
  surface plus a seed row is a capability, not a fold. **Re-open trigger:** `BUG-260731-01`'s
  investigation, the SEED-117 config-consolidation revival, or the next phase that needs a
  provider-routed authoring roster.

- **Making `folder_scope` editable per-phase.** Carried forward from **D-186-17**: an editable
  `folder_scope` on an unbound workflow raises a raw Pydantic 422
  (`harness.py:_folder_scope_requires_project`), which under D-186-04's hold-the-write rule
  produces a permanently-unsaveable draft. Whichever phase makes it editable must land the
  workflow-level binding first and gate the per-phase control on it. **Not** made editable here.

- **Suppressing the type subtitle when the derived tier resolves.** Rejected as D-187-06's
  alternative. **Re-open trigger:** live UAT showing the `llm_human_input` / `llm_emit`
  restatements read as noise on a real workflow.

### Reviewed Todos (not folded)

Open `surface: Agentic-RAG` reports reviewed at this touchpoint, **not** folded:
- `BUG-260609-02` (phantom Sub-Results "Sub-task") and `BUG-260609-04` (phase-card slug clobber) —
  both are the **live-run** workspace-panel surface; 187 projects a static definition. `-04` is
  already routed to Phase 188 by its own trigger. Left `open`.
- `BUG-260730-02` (emit gate reports citations when coverage was 100%) — touches
  `citations_required`, which this phase leaves exactly as shipped (`timing="post"`, D-187-03).
  Left `open`; natural home is a harness-verdict-honesty phase.
- `BUG-260731-01` (judge-model knob may be inert on the env-backed singleton) — **same defect class
  as finding 4**, and D-187-13 works around it rather than fixing it. Left `open`, with the
  connection recorded above so the investigation inherits the `harness_authoring_model` evidence.
- `BUG-260718-02/03/04`, `BUG-260722-02`, `chat-list-too-narrow` — chat/nav surfaces, no overlap.

</deferred>

---

*Phase: 187-business-vocabulary-ai-seeded-canvas*
*Context gathered: 2026-08-01*
